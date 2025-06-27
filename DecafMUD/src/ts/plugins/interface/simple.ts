/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD User Interface: Simple
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

import { DecafMUD, TN } from '../../decafmud'; // Assuming TN might be needed for telopt access
import { StandardDisplay } from '../display/standard'; // Assuming StandardDisplay might be used

// Helper to determine if running in a Firefox-like environment
const bodyHack = typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent);

// Helper function to add events (can be module-local)
function addEvent(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
    if (node.addEventListener) {
        node.addEventListener(etype, func, false);
    } else if ((node as any).attachEvent) { // Fallback for older IE
        (node as any).attachEvent('on' + etype, func);
    } else { // Last resort
        (node as any)['on' + etype] = func;
    }
}

// Helper function to remove events (can be module-local)
// Note: Fallback for detachEvent is not perfectly symmetrical to attachEvent if using node[onetype]
/* function delEvent(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
    if (node.removeEventListener) {
        node.removeEventListener(etype, func, false);
    } else if ((node as any).detachEvent) { // Fallback for older IE
        (node as any).detachEvent('on' + etype, func);
    }
} */

interface ToolButton {
    0: HTMLAnchorElement; // The button element
    1: string;            // Original text
    2?: string;           // Icon URL
    3?: string;           // Tooltip
    4: number;            // Type (0 normal, 1 toggle)
    5: boolean;           // Enabled
    6: boolean;           // Pressed (for toggle)
    7?: string;           // Additional class
    8?: (e: Event) => void; // onclick handler
}

interface InfoBarItem {
    text: string;
    class: string;
    timeout: number;
    icon?: string;
    buttons?: [string, (e: Event) => void][];
    click?: (e: Event) => void;
    close?: (e: Event) => void;
    el?: HTMLElement; // Element associated with this ibar item when shown
}

export class SimpleInterface {
    private decaf: DecafMUD;
    public container: HTMLElement;
    public el_display: HTMLElement; // Main display pane container
    private _input: HTMLElement;    // Container for input element and tray
    public tray: HTMLElement;       // Icon tray
    public toolbar: HTMLElement;
    public input: HTMLInputElement | HTMLTextAreaElement;

    private toolbuttons: { [id: number]: ToolButton } = {};
    private toolbutton_id: number = -1;

    private infobars: InfoBarItem[] = [];
    private ibar?: HTMLElement; // Currently displayed info bar element
    private ibartimer?: ReturnType<typeof setTimeout>;


    private icons: [HTMLElement, ((e: Event) => void) | undefined, ((e: Event) => void) | undefined][] = [];

    public echo: boolean = true;
    private inpFocus: boolean = false; // If the main input has focus
    private inp_buffer: string = '';   // Buffer for input when switching types

    private old_parent?: Node | null;
    private next_sib?: Node | null;
    private old_body_over?: string;
    private old_children: HTMLElement[] = [];
    private old_display_styles: (string | null)[] = []; // Store display style of hidden elements

    private oldscrollX: number = 0;
    private oldscrollY: number = 0;

    // Splash screen elements
    private splash: HTMLElement | null = null;
    private splash_st: HTMLElement | null = null; // Status text
    private splash_pg: HTMLElement | null = null; // Progress bar container
    private splash_pgi: HTMLElement | null = null; // Inner progress bar
    private splash_pgt: HTMLElement | null = null; // Progress text
    private splash_old: HTMLElement | null = null; // Old status messages
    private splash_err: boolean = false;
    private old_y: string = ''; // Old overflowY style for el_display

    // Sizing elements
    private sizeel?: HTMLElement;
    private sizetm?: ReturnType<typeof setTimeout>;
    private old_height: number = -1;
    private old_width: number = -1;
    private old_fs: boolean = false; // If previously in browser fullscreen
    public goFullOnResize: boolean = true;

    // Toolbar
    private old_tbarpos: string = '';
    private toolbarPadding?: number;

    // Scroll button
    private scrollButton?: HTMLElement;

    // Settings Dialog
    public settings?: HTMLElement;
    private set_cont?: HTMLElement; // Inner container for settings content
    private set_mid?: HTMLElement; // Middle container for scrolling

    // Buttons
    private fsbutton?: number; // ID of fullscreen button
    private logbutton?: number;
    // private stbutton?: number; // Settings button ID

    // Icons
    private ico_connected?: number; // ID of connectivity icon

    // Input handling state
    private masked: boolean = false; // If input is password type (not directly used by this.echo?)
    private inputCtrl: boolean = false; // If Ctrl is pressed (for future use, not in original logic)
    private mruHistory: string[] = [];
    private mruIndex: number = 0;
    private mruSize: number = 15;
    private mruTemp: string | false = false; // Temporary storage for current input when browsing MRU
    public hasFocus: boolean = false; // If input element has focus (distinct from inpFocus?)

    // Tab Completion
    private reqTab: boolean = false; // If a tab completion has been requested
    private wantTab: boolean = false; // If a tab key press is being processed
    private tabIndex: number = -1;
    private tabValues: string[] = [];
    private buffer: string = ''; // Current input buffer before MRU/tab

    public static supports = {
        tabComplete: true,
        multipleOut: false,
        fullscreen: true,
        editor: false,
        splash: true
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;

        let containerOpt = decaf.options.set_interface.container;
        if (typeof containerOpt === 'string') {
            const el = document.querySelector(containerOpt);
            if (!el || !(el instanceof HTMLElement)) {
                throw new Error("Container element not found or is not an HTMLElement!");
            }
            this.container = el;
        } else if (containerOpt && 'nodeType' in containerOpt && containerOpt instanceof HTMLElement) {
            this.container = containerOpt;
        } else {
            throw new Error("The container must be a valid DOM HTMLElement or a selector string!");
        }

        this.container.setAttribute('role', 'application');
        this.container.classList.add('decafmud', 'mud', 'interface');

        this.el_display = document.createElement('div');
        this.el_display.className = 'decafmud mud-pane primary-pane';
        this.el_display.setAttribute('role', 'log');
        this.el_display.setAttribute('aria-live', 'polite'); // Changed from assertive for less interruption
        this.el_display.setAttribute('tabIndex', '0');
        this.container.appendChild(this.el_display);
        addEvent(this.el_display, 'keydown', (e) => this.displayKey(e as KeyboardEvent));

        this._input = document.createElement('div');
        this._input.className = 'decafmud input-cont';

        this.tray = document.createElement('div');
        this.tray.className = 'decafmud icon-tray';
        this._input.appendChild(this.tray);

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'decafmud toolbar';
        this.toolbar.setAttribute('role', 'toolbar');
        const hideToolbar = () => { if (this.toolbar.className) this.toolbar.className = this.toolbar.className.replace(' visible', ''); };
        addEvent(this.toolbar, 'mousemove', hideToolbar);
        addEvent(this.toolbar, 'blur', hideToolbar);

        this.input = document.createElement('input');
        this.input.type = 'text'; // Default type
        this.input.title = "MUD Input"; // i18n was removed, using direct string
        this.input.setAttribute('role', 'textbox');
        this.input.setAttribute('aria-label', this.input.title);
        this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);

        addEvent(this.input, 'keydown', (e) => this.handleInput(e as KeyboardEvent));
        const blurFocusHelper = (e: Event) => this.handleBlur(e as FocusEvent);
        addEvent(this.input, 'blur', blurFocusHelper);
        addEvent(this.input, 'focus', blurFocusHelper);

        this.mruSize = this.decaf.options.set_interface.mru_size || 15;

        this.reset(); // Initialize states
        addEvent(window, 'resize', () => this.resizeScreen());
    }

    public toString(): string {
        return `<DecafMUD Interface: Simple${this.container.id ? ' (#' + this.container.id + ')' : ''}>`;
    }

    public initSplash(percentage: number = 0, message: string = 'Discombobulating interface recipient...'): void {
        this.old_y = this.el_display.style.overflowY;
        this.el_display.style.overflowY = 'hidden';

        this.splash = document.createElement('div');
        this.splash.className = 'decafmud splash';

        this.splash.innerHTML = `<h2 class="decafmud heading"><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> <span class="version">v${DecafMUD.version.toString()}</span></h2>`;

        this.splash_pg = document.createElement('div');
        this.splash_pg.className = 'decafmud progress';
        this.splash_pg.setAttribute('role', 'progressbar');
        this.splash_pg.setAttribute('aria-valuemax', '100');
        this.splash_pg.setAttribute('aria-valuemin', '0');

        this.splash_pgi = document.createElement('div');
        this.splash_pgi.className = 'decafmud inner-progress';

        this.splash_pgt = document.createElement('div');
        this.splash_pgt.className = 'decafmud progress-text';

        this.updateSplashProgress(percentage); // Initial progress

        this.splash_pg.appendChild(this.splash_pgi);
        this.splash_pg.appendChild(this.splash_pgt);
        this.splash.appendChild(this.splash_pg);

        this.splash_st = document.createElement('div');
        this.splash_st.className = 'decafmud status';
        this.splash_st.innerHTML = message;
        this.splash.appendChild(this.splash_st);

        this.splash_old = document.createElement('div');
        this.splash_old.className = 'decafmud old';
        this.splash.appendChild(this.splash_old);

        this.container.appendChild(this.splash);
    }

    private updateSplashProgress(percentage: number): void {
        if (!this.splash_pg || !this.splash_pgi || !this.splash_pgt) return;
        const text = `${percentage}%`;
        this.splash_pg.setAttribute('aria-valuenow', percentage.toString());
        this.splash_pg.setAttribute('aria-valuetext', text);
        this.splash_pgt.innerHTML = text;
        this.splash_pgi.style.width = `${percentage}%`;
    }


    public endSplash(): void {
        if (this.splash) {
            this.container.removeChild(this.splash);
        }
        this.el_display.style.overflowY = this.old_y;
        this.splash_err = false;
        this.splash = this.splash_pg = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
    }

    public updateSplash(percentage?: number, message?: string): void {
        if (!this.splash || this.splash_err || !this.splash_st || !this.splash_old) return;

        if (percentage !== undefined) {
            this.updateSplashProgress(percentage);
        }

        if (!message) return;

        const currentMessage = this.splash_st.innerHTML;
        const e = document.createElement('div');
        e.innerHTML = currentMessage.endsWith('...') ? currentMessage + 'done.' : currentMessage;
        this.splash_old.insertBefore(e, this.splash_old.firstChild);
        this.splash_st.innerHTML = message;
    }

    public splashError(message: string): boolean {
        if (!this.splash || !this.splash_pgt || !this.splash_pgi || !this.splash_st) return false;
        this.splash_pgt.innerHTML = '<b>Error</b>';
        this.splash_pgi.classList.add('error');
        this.splash_st.innerHTML = message;
        this.splash_err = true;
        return true;
    }

    // ... (rest of the methods: showSize, hideSize, connected, connecting, disconnected, load, reset, setup, showLogs, showSettings, tb*, _resizeToolbar, showScrollButton, hideScrollButton, infoBar, immediateInfoBar, createIBar, closeIBar, addIcon, delIcon, updateIcon, _resizeTray, click_fsbutton, enter_fs, exit_fs, resizeScreen, displayInput, localEcho, displayKey, handleInputPassword, handleInput, handleBlur, updateInput )
    // These methods will be implemented progressively, ensuring types and modern JS.
    // For brevity in this step, I'm showing the structure and initial methods.
    // The full implementation would follow the patterns of the original JS but with TS enhancements.

    public load(): void {
        this.decaf.require('decafmud.display.' + this.decaf.options.display);
    }

    public reset(): void {
        this.masked = false;
        this.inputCtrl = false;
        this.mruIndex = 0;
        this.mruHistory = [];
        // this.mruSize is set in constructor
        this.mruTemp = false;
        this.hasFocus = false; // This seems to be the intended focus flag from original
        this.inpFocus = false; // Keeping both for now if they had distinct uses

        this.reqTab = false;
        this.wantTab = false;
        this.tabIndex = -1;
        this.tabValues = [];
        this.buffer = '';

        this.updateInput();
        if (this.decaf.display && (this.decaf.display as StandardDisplay).reset) { // Check if display is StandardDisplay and has reset
            (this.decaf.display as StandardDisplay).reset();
        }
    }

    public setup(): void {
        // this.store = this.decaf.store.sub('ui'); // Assuming store has a 'sub' method
        // this.storage = this.store; // Alias, if still needed

        this.goFullOnResize = this.decaf.store.get('ui/fullscreen-auto', true);
        const startFullscreen = this.decaf.store.get('ui/fullscreen-start', this.decaf.options.set_interface.start_full);

        // Initialize display
        const displayPluginName = this.decaf.options.display;
        const DisplayPluginConstructor = DecafMUD.plugins.Display[displayPluginName];
        if (DisplayPluginConstructor) {
            this.decaf.display = new DisplayPluginConstructor(this.decaf, this, this.el_display);
        } else {
            this.decaf.error(`Display plugin "${displayPluginName}" not found.`);
            return;
        }

        // Setup toolbar
        this.old_tbarpos = this.decaf.store.get('ui/toolbar-position', 'top-left');
        this.toolbar.classList.add(this.old_tbarpos);
        this.container.insertBefore(this.toolbar, this.container.firstChild);

        // Create buttons and icons (simplified for now)
        this.fsbutton = this.tbNew("Fullscreen", undefined, "Click to toggle fullscreen mode.", 1, true, startFullscreen, undefined, (e) => this.click_fsbutton(e));
        this.logbutton = this.tbNew("Logs", undefined, "Click to open session logs.", 0, true, false, undefined, () => this.showLogs());
        this.ico_connected = this.addIcon("You are currently disconnected.", '', 'connectivity disconnected');

        if (startFullscreen) {
            this.enter_fs(false);
        } else {
            if (!this._resizeToolbar()) {
                this.resizeScreen(false);
            }
        }
    }

    // Placeholder for tbNew - will need full implementation
    private tbNew(text: string, icon?: string, tooltip?: string, type?: number, enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void): number {
        const id = ++this.toolbutton_id;
        const btn = document.createElement('a');
        // ... (full button creation logic from original, adapted)
        btn.id = `${this.container.id || 'decafmud'}-toolbar-button-${id}`;
        btn.className = 'decafmud button toolbar-button';
        if (clss) btn.classList.add(clss);
        // ...
        if (onclick) addEvent(btn, 'click', (e) => {
            if (this.toolbuttons[id] && this.toolbuttons[id][5]) onclick(e);
        });
        this.toolbuttons[id] = [btn, text, icon, tooltip, type || 0, enabled === undefined ? true : enabled, !!pressed, clss, onclick];
        this.toolbar.appendChild(btn);
        this._resizeToolbar();
        return id;
    }

    private click_fsbutton(e: Event): void {
        if (this.container.classList.contains('fullscreen')) {
            this.exit_fs();
        } else {
            this.enter_fs();
        }
    }

    // Placeholder implementations for fs methods
    private enter_fs(showSize: boolean = true): void { /* ... original logic ... */ this.container.classList.add('fullscreen'); this.tbPressed(this.fsbutton!, true); this._resizeToolbar(); if (showSize) this.showSize(); }
    private exit_fs(): void { /* ... original logic ... */ this.container.classList.remove('fullscreen'); this.tbPressed(this.fsbutton!, false); this._resizeToolbar(); this.showSize(); }
    private tbPressed(id: number, pressed: boolean): void { if(this.toolbuttons[id]) this.toolbuttons[id][6] = pressed; /* ... update DOM ... */ }
    private showSize(): void { /* ... */ }
    private _resizeToolbar(): boolean { /* ... */ return false; }
    public resizeScreen(showSize: boolean = true, force?: boolean): void { /* ... */ }
    private showLogs(): void { /* ... */ }


    // Placeholder for addIcon - will need full implementation
    private addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number {
        const id = this.icons.length;
        const ico = document.createElement('div');
        // ... (full icon creation logic)
        this.icons.push([ico, onclick, onkey]);
        this.tray.appendChild(ico);
        this._resizeTray();
        return id;
    }
     private _resizeTray(): void { /* ... */ }
     public updateIcon(ind: number, text?: string, html?: string, clss?: string): void { /* ... */ }


    public localEcho(echo: boolean): void {
        if (echo === this.echo) return;
        this.echo = echo;
        this.updateInput();
    }

    private displayKey(e: KeyboardEvent): void {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (!((e.keyCode > 64 && e.keyCode < 91) || // A-Z
              (e.keyCode > 47 && e.keyCode < 58) || // 0-9
              (e.keyCode > 185 && e.keyCode < 193) || // ;=,-./`
              (e.keyCode > 218 && e.keyCode < 223))) { // [\]'
            return;
        }
        this.input.focus();
    }

    private handleInputPassword(e: KeyboardEvent): void {
        if (e.keyCode !== 13) return; // Enter key
        this.inpFocus = true; // Or this.hasFocus = true
        this.decaf.sendInput((this.input as HTMLInputElement).value);
        (this.input as HTMLInputElement).value = '';
    }

    private handleInput(e: KeyboardEvent): void {
        // Simplified version of original input handler
        if (e.keyCode === 13) { // Enter
            if (e.shiftKey && this.decaf.options.set_interface.multiline) {
                // Handle shift-enter for multiline if enabled (not fully implemented here)
            } else {
                this.decaf.sendInput(this.input.value);
                if (this.decaf.options.set_interface.clearonsend) {
                    this.input.value = '';
                } else {
                    (this.input as HTMLInputElement).select?.();
                }
                // Add to MRU history
                if (this.decaf.options.set_interface.mru && this.input.value.trim() !== '') {
                    this.mruHistory.unshift(this.input.value);
                    if (this.mruHistory.length > this.mruSize) {
                        this.mruHistory.pop();
                    }
                }
                this.mruIndex = 0;
                this.mruTemp = false;
                e.preventDefault();
            }
        } else if (e.keyCode === 38) { // Up arrow for MRU
             if (this.decaf.options.set_interface.mru && this.mruHistory.length > 0) {
                if (this.mruIndex === 0 && this.mruTemp === false) {
                    this.mruTemp = this.input.value;
                }
                if (this.mruIndex < this.mruHistory.length) {
                    this.input.value = this.mruHistory[this.mruIndex];
                    this.mruIndex++;
                }
                e.preventDefault();
            }
        } else if (e.keyCode === 40) { // Down arrow for MRU
            if (this.decaf.options.set_interface.mru && this.mruHistory.length > 0) {
                if (this.mruIndex > 0) {
                    this.mruIndex--;
                    this.input.value = this.mruHistory[this.mruIndex];
                } else if (this.mruTemp !== false) {
                    this.input.value = this.mruTemp as string;
                    this.mruTemp = false;
                }
                e.preventDefault();
            }
        }
        // PgUp, PgDown for display scroll
        else if (e.keyCode === 33 && this.decaf.display && (this.decaf.display as StandardDisplay).scrollUp) {
            (this.decaf.display as StandardDisplay).scrollUp(); e.preventDefault();
        } else if (e.keyCode === 34 && this.decaf.display && (this.decaf.display as StandardDisplay).scrollDown) {
            (this.decaf.display as StandardDisplay).scrollDown(); e.preventDefault();
        }
    }


    private handleBlur(e: FocusEvent): void {
        const blurClass = this.decaf.options.set_interface.blurclass || 'mud-input-blur';
        if (e.type === 'blur') {
            if (this.input.value === '') {
                this.input.classList.add(blurClass);
            }
            this.inpFocus = false; // Or this.hasFocus
            if (this.settings && this.set_mid) { // Restore settings scrollability
                this.settings.style.top = '0px';
                this.set_mid.style.overflowY = 'scroll';
            }
        } else if (e.type === 'focus') {
            this.input.classList.remove(blurClass);
            this.inpFocus = true; // Or this.hasFocus
             if (this.settings && this.set_mid) { // Adjust settings position when input focused
                const topPos = -1 * (this.settings.clientHeight * 0.5);
                this.settings.style.top = `${topPos}px`;
                this.set_mid.style.overflowY = 'hidden';
            }
        }
    }

    public updateInput(force: boolean = false): void {
        if (!this.input) return;

        const currentTag = this.input.tagName.toUpperCase();
        const currentType = (this.input as HTMLInputElement).type?.toLowerCase();
        const currentValue = this.input.value;

        let newTag: 'INPUT' | 'TEXTAREA' = 'INPUT';
        let newType: string | undefined = 'text';

        if (!this.echo) {
            newType = 'password';
        } else if (this.decaf.options.set_interface.multiline && currentValue.includes('\n')) {
            newTag = 'TEXTAREA';
            newType = undefined; // Textareas don't have a 'type' attribute in the same way
        }

        if (!force && currentTag === newTag && (currentTag !== 'INPUT' || currentType === newType)) {
            return; // No change needed
        }

        const parent = this.input.parentNode;
        if (!parent) return;

        const nextSibling = this.input.nextSibling;
        const oldClassName = this.input.className;
        const oldStyle = this.input.getAttribute('style');
        const oldId = this.input.id;

        parent.removeChild(this.input);

        let newElement: HTMLInputElement | HTMLTextAreaElement;
        if (newTag === 'TEXTAREA') {
            newElement = document.createElement('textarea');
            if (this.decaf.options.set_interface.multiline) {
                const lines = currentValue.split('\n').length;
                (newElement as HTMLTextAreaElement).rows = bodyHack ? Math.max(1, lines -1 ) : lines;
            }
        } else {
            newElement = document.createElement('input');
            (newElement as HTMLInputElement).type = newType as string;
        }

        newElement.className = oldClassName;
        if (oldStyle) newElement.setAttribute('style', oldStyle);
        if (oldId) newElement.id = oldId;
        newElement.value = currentValue; // Preserve content

        this.input = newElement; // Update instance reference

        if (nextSibling) {
            parent.insertBefore(newElement, nextSibling);
        } else {
            parent.appendChild(newElement);
        }

        // Re-attach event listeners
        addEvent(this.input, 'keydown', (e) => this.handleInput(e as KeyboardEvent));
        const blurFocusHelper = (e: Event) => this.handleBlur(e as FocusEvent);
        addEvent(this.input, 'blur', blurFocusHelper);
        addEvent(this.input, 'focus', blurFocusHelper);

        if (this.inpFocus) { // Re-focus if it was focused before
            setTimeout(() => { this.input.focus(); (this.input as HTMLInputElement).select?.(); }, 1);
        }
    }

    public displayInput(text: string): void {
        if (!this.decaf.display || !this.echo) return;
        // Assuming display plugin has a 'message' method
        if ((this.decaf.display as any).message) {
            (this.decaf.display as any).message(`<b>${text}</b>`, 'user-input', false);
        }
    }

    // Connectivity status updates
    public connected(): void { this.updateIcon(this.ico_connected!, "DecafMUD is currently connected.", '', 'connectivity connected'); }
    public connecting(): void { this.updateIcon(this.ico_connected!, "DecafMUD is attempting to connect.", '', 'connectivity connecting'); }
    public disconnected(willReconnect?: boolean): void {
        const message = willReconnect ? "DecafMUD disconnected. Attempting to reconnect..." : "DecafMUD is currently disconnected.";
        this.updateIcon(this.ico_connected!, message, '', 'connectivity disconnected');
    }
}

// Registration in decafmud.ts:
// import { SimpleInterface } from './plugins/interface/simple';
// DecafMUD.plugins.Interface.simple = SimpleInterface;

```
