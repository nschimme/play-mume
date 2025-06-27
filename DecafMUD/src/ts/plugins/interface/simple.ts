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
    public sidebar?: HTMLElement;
    private progresstable?: HTMLTableElement;
    private progressbars: {name: string, progressEl: HTMLElement, infoEl: HTMLElement}[] = [];
    private mapdiv?: HTMLElement;

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

    // History properties from panels.js (replaces/enhances mruHistory)
    private history: string[] = []; // Stores command history
    private historyPosition: number = -1; // Current position in history (-1 means not browsing)
    private readonly MAX_HISTORY_SIZE: number = 100; // Max history items

    // mru* properties are related to a simpler history, will be superseded by the above
    // private mruHistory: string[] = [];
    // private mruIndex: number = 0;
    private mruSize: number = 15; // This might still be used by options, or could be MAX_HISTORY_SIZE
    // private mruTemp: string | false = false;
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

        // Make the sidebar (from panels.js)
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'decafmud mud-pane side-pane';
        this.sidebar.setAttribute('tabIndex', '1'); // For keyboard accessibility if needed
        this.container.appendChild(this.sidebar);

        this.progresstable = document.createElement('table');
        this.progresstable.style.display = 'none'; // Initially hidden
        this.sidebar.appendChild(this.progresstable);

        this.mapdiv = document.createElement('div');
        this.mapdiv.style.display = 'none'; // Initially hidden
        this.sidebar.appendChild(this.mapdiv);

        // Handle keypresses and clicks in scrollback & sidebar (from panels.js)
        // this.el_display.onmouseup = this.maybeFocusInput.bind(this); // This was in panels.js, consider if needed
        addEvent(this.el_display, 'keydown', (e) => this.displayKey(e as KeyboardEvent));
        if (this.sidebar) { // Add event listener if sidebar is created
            addEvent(this.sidebar, 'keydown', (e) => this.displayKey(e as KeyboardEvent));
        }

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

        this.mruSize = this.decaf.options.set_interface.mru_size || 15; // Retain for now, might be used by options
        this.history = new Array(this.MAX_HISTORY_SIZE).fill(''); // Initialize history array

        this.reset(); // Initialize states
        addEvent(window, 'resize', () => this.resizeScreenFromEvent('window resize')); // Use resizeScreenFromEvent from panels.js

        // Neuters IE's F1 help popup (from panels.js)
        if (typeof window !== 'undefined' && "onhelp" in window) {
            (window as any).onhelp = () => false;
        }

        // Prevent leaving the page by accident (from panels.js)
        if (typeof window !== 'undefined') {
            addEvent(window, 'beforeunload', (e) => this.unloadPageFromEvent(e as BeforeUnloadEvent));
        }

        // Make sure the input is focussed (from panels.js)
        this.input.focus();
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
        this.hasFocus = false;
        this.inpFocus = false;

        // Reset history state from panels.js
        this.historyPosition = -1;
        // this.history array is already initialized (e.g. in constructor or remains from previous session)
        // If it needs to be cleared on reset:
        // this.history = new Array(this.MAX_HISTORY_SIZE).fill('');


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

        // Create buttons and icons
        // Standard buttons first
        this.fsbutton = this.tbNew("Fullscreen", undefined, "Click to toggle fullscreen mode.", 1, true, startFullscreen, undefined, (e) => this.click_fsbutton(e));
        // this.logbutton = this.tbNew("Logs", undefined, "Click to open session logs.", 0, true, false, undefined, () => this.showLogs()); // Log is now a menu item

        // Create menus from menuData.ts
        const menuConfigs = this.getMenuConfigs();
        menuConfigs.forEach(config => {
            // tbNew expects text for the button face, icon, tooltip, type, enabled, pressed, class, onclick
            // For menus, the 'text' is the menu name, and onclick toggles the submenu.
            // The submenu HTML is built by buildMenuHtml but isn't directly part of the button face.
            // The tbNew will create an anchor; the UL for submenu needs to be appended appropriately or handled by CSS.
            // For now, tbNew creates the main menu button. The UL is part of its innerHTML.
            this.tbNew(config.html, undefined, config.tooltip, 0, true, false, `menu-button ${config.id}`, config.action);
        });

        // Add a global click listener to close menus if clicked outside
        // Ensure this doesn't interfere with other clickables like info bar buttons
        addEvent(document, 'click', (e: Event) => {
            if (this.openMenuIndex !== -1) {
                let target = e.target as HTMLElement;
                let isMenuClick = false;
                while (target && target !== document.body) {
                    if (target.classList.contains('toolbar-button') || target.classList.contains('submenu')) {
                        isMenuClick = true;
                        break;
                    }
                    target = target.parentNode as HTMLElement;
                }
                if (!isMenuClick) {
                    this.closeMenus();
                }
            }
        });


        this.ico_connected = this.addIcon("You are currently disconnected.", '', 'connectivity disconnected');

        if (startFullscreen) {
            this.enter_fs(false);
        } else {
            if (!this._resizeToolbar()) {
                this.resizeScreen(false);
            }
        }
    }

    /** Create a new toolbar button.
     * @param {String} text The name of the button. Will be displayed if no icon is
     *    given, and also used as title text if no tooltip is given.
     * @param {String} [iconUrl] The icon to display on the button. (Renamed from `icon` to avoid conflict with `icons` property)
     * @param {String} [tooltip] The tooltip text to associate with the button.
     * @param {number} [type=0] The type of button. 0 is normal, 1 is toggle.
     * @param {boolean} [enabled=true] Whether or not the button is enabled.
     * @param {boolean} [pressed=false] Whether or not a toggle button is pressed.
     * @param {String} [clss] Any additional class to set on the button.
     * @param {function} [onclick] The function to call when the button is clicked
     *    or toggled. */
    public tbNew(text: string, iconUrl?: string, tooltip?: string, type: number = 0, enabled: boolean = true, pressed: boolean = false, clss?: string, onclick?: (e: Event) => void): number {
        const id = ++this.toolbutton_id;

        const btn = document.createElement('a');
        btn.id = `${this.container.id || 'decafmud'}-toolbar-button-${id}`;
        btn.className = 'decafmud button toolbar-button';
        if (clss) { btn.classList.add(clss); }
        if (type === 1) { btn.classList.add('toggle', (pressed ? 'toggle-pressed' : 'toggle-depressed')); }
        btn.innerHTML = text;
        btn.title = tooltip || text;

        if (!enabled) { btn.classList.add('disabled'); }
        btn.setAttribute('tabIndex', '0'); // Make it focusable

        // Set accessibility data
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-disabled', (!enabled).toString());
        if (type === 1) {
            btn.setAttribute('aria-pressed', pressed.toString());
        }

        if (iconUrl) {
            btn.style.backgroundImage = `url(${iconUrl})`;
            btn.classList.add('icon');
        }

        if (onclick) {
            const clickHandler = (e: Event) => {
                if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { return; } // Enter key for keyboard activation
                const currentButton = this.toolbuttons[id];
                if (currentButton && currentButton[5]) { // Check if button exists and is enabled
                    onclick.call(this, e); // Call original onclick in context of SimpleInterface
                    if (e.type && e.type !== 'keydown') { // Blur after click unless it was a keydown
                        btn.blur();
                    }
                }
            };
            addEvent(btn, 'click', clickHandler);
            addEvent(btn, 'keydown', clickHandler);
        }

        // Focus Helpers
        addEvent(btn, 'focus', (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target.parentNode) { return; }
            if (target.parentNode.classList.contains('toolbar')) {
                target.parentNode.setAttribute('aria-activedescendant', target.id);
                target.parentNode.classList.add('visible');
            }
        });
        addEvent(btn, 'blur', (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target.parentNode) { return; }
            if (target.parentNode.classList.contains('toolbar')) {
                if (target.parentNode.getAttribute('aria-activedescendant') === target.id) {
                    target.parentNode.setAttribute('aria-activedescendant', '');
                }
                target.parentNode.classList.remove('visible');
            }
        });

        this.toolbuttons[id] = [btn, text, iconUrl, tooltip, type, enabled, pressed, clss, onclick];
        btn.setAttribute('button-id', id.toString()); // For easier debugging or selection

        this.toolbar.appendChild(btn);
        this._resizeToolbar();
        return id;
    }

    /** Delete a toolbar button with the given ID. */
    public tbDelete(id: number): void {
        if (this.toolbuttons[id] === undefined) { return; }
        const btnData = this.toolbuttons[id];
        const btnElement = btnData[0];
        if (btnElement.parentNode) {
            btnElement.parentNode.removeChild(btnElement);
        }
        delete this.toolbuttons[id]; // Remove from map
        this._resizeToolbar();
    }

    /** Change a toolbar button's text. */
    public tbText(id: number, text: string): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        if (!text) { throw new Error("Text can't be empty/false/null/whatever."); }
        btnData[0].innerHTML = text;
        btnData[1] = text; // Update stored text
        if (btnData[3] === undefined) { // If no tooltip, update title to match text
            btnData[0].title = text;
        }
    }

    /** Change a toolbar button's tooltip. */
    public tbTooltip(id: number, tooltip?: string): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        btnData[3] = tooltip; // Update stored tooltip
        btnData[0].title = tooltip || btnData[1]; // Use tooltip or fallback to text
    }

    /** Enable or disable a toolbar button. */
    public tbEnabled(id: number, enabled: boolean): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        const isEnabled = !!enabled;
        btnData[5] = isEnabled; // Update stored enabled state
        btnData[0].setAttribute('aria-disabled', (!isEnabled).toString());
        if (isEnabled) {
            btnData[0].classList.remove('disabled');
        } else {
            btnData[0].classList.add('disabled');
        }
    }

    /** Change a toolbar button's pressed state. */
    public tbPressed(id: number, pressed: boolean): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        if (btnData[4] !== 1) return; // Only for toggle buttons

        const isPressed = !!pressed;
        btnData[6] = isPressed; // Update stored pressed state
        btnData[0].setAttribute('aria-pressed', isPressed.toString());
        if (isPressed) {
            btnData[0].classList.remove('toggle-depressed');
            btnData[0].classList.add('toggle-pressed');
        } else {
            btnData[0].classList.remove('toggle-pressed');
            btnData[0].classList.add('toggle-depressed');
        }
    }

    /** Change a toolbar button's class. */
    public tbClass(id: number, clss?: string): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        const oldClss = btnData[7];
        btnData[7] = clss; // Update stored class

        if (oldClss) { btnData[0].classList.remove(oldClss); }
        if (clss) { btnData[0].classList.add(clss); }
    }

    /** Change a toolbar button's icon. */
    public tbIcon(id: number, iconUrl?: string): void {
        const btnData = this.toolbuttons[id];
        if (btnData === undefined) { throw new Error("Invalid button ID."); }
        btnData[2] = iconUrl; // Update stored icon URL

        if (iconUrl) {
            btnData[0].classList.add('icon');
            btnData[0].style.backgroundImage = `url(${iconUrl})`;
        } else {
            btnData[0].classList.remove('icon');
            btnData[0].style.backgroundImage = '';
        }
    }


    private click_fsbutton(e: Event): void {
        if (this.container.classList.contains('fullscreen')) {
            this.exit_fs();
        } else {
            this.enter_fs();
        }
    }

    private enter_fs(showSize: boolean = true): void {
        if (this.container.classList.contains('fullscreen')) { return; }

        const hasFocus = this.inpFocus;
        if (this.decaf.display as StandardDisplay) {
            (this.decaf.display as StandardDisplay).shouldScroll?.(false);
        }

        this.oldscrollX = (typeof window !== 'undefined') ? window.scrollX : 0;
        this.oldscrollY = (typeof window !== 'undefined') ? window.scrollY : 0;

        this.old_parent = this.container.parentNode;
        this.next_sib = this.container.nextElementSibling;
        if (!this.next_sib && this.container.nextSibling && this.container.nextSibling.nodeType === this.container.nodeType) {
            this.next_sib = this.container.nextSibling; // Fallback for older browsers
        }

        if (this.old_parent) {
            this.old_parent.removeChild(this.container);
        }

        this.container.classList.add('fullscreen');

        if (this.fsbutton !== undefined) {
            this.tbPressed(this.fsbutton, true);
            this.tbTooltip(this.fsbutton, "Click to exit fullscreen mode."); // No i18n
        }

        // Hide other body elements
        if (typeof document !== 'undefined') {
            this.old_children = [];
            this.old_display_styles = [];
            for (let i = 0; i < document.body.children.length; i++) {
                const child = document.body.children[i] as HTMLElement;
                // Exclude Firebug console or DecafFlashSocket if they were ever relevant
                if (child.id !== '_firebugConsole' && !child.id.startsWith('DecafFlashSocket')) {
                    this.old_children.push(child);
                    this.old_display_styles.push(child.style.display);
                    child.style.display = 'none';
                }
            }

            this.old_body_over = document.body.style.overflow;
            if (!bodyHack) { // Don't hide scrollbars in Firefox due to potential issues
                document.body.style.overflow = 'hidden';
            }
            document.body.appendChild(this.container);
            window.scroll(0, 0);
        }


        this._resizeToolbar();
        if (showSize !== false) { this.showSize(); }

        if (hasFocus) { this.input.focus(); }
        if (this.decaf.display as StandardDisplay) {
            (this.decaf.display as StandardDisplay).doScroll?.();
        }
    }

    private exit_fs(): void {
        if (!this.old_parent && typeof document === 'undefined') { return; } // Nothing to restore if no old_parent or not in browser

        const hasFocus = this.inpFocus;
        if (this.decaf.display as StandardDisplay) {
            (this.decaf.display as StandardDisplay).shouldScroll?.(false);
        }

        if (typeof document !== 'undefined' && this.container.parentNode === document.body) {
            document.body.removeChild(this.container);
        }


        // Restore other body elements
        for (let i = 0; i < this.old_children.length; i++) {
            this.old_children[i].style.display = this.old_display_styles[i] || '';
        }
        this.old_children = [];
        this.old_display_styles = [];

        this.container.classList.remove('fullscreen');

        if (this.fsbutton !== undefined) {
            this.tbPressed(this.fsbutton, false);
            this.tbTooltip(this.fsbutton, "Click to enter fullscreen mode."); // No i18n
        }

        if (this.old_parent) {
            if (this.next_sib) {
                this.old_parent.insertBefore(this.container, this.next_sib);
            } else {
                this.old_parent.appendChild(this.container);
            }
        }
        this.old_parent = null; // Clear stored parent
        this.next_sib = null;

        if (typeof document !== 'undefined' && this.old_body_over !== undefined) {
            document.body.style.overflow = this.old_body_over;
            this.old_body_over = undefined;
        }

        if (typeof window !== 'undefined') {
            window.scroll(this.oldscrollX, this.oldscrollY);
        }


        this._resizeToolbar();
        this.showSize();

        if (hasFocus) { this.input.focus(); }
        if (this.decaf.display as StandardDisplay) {
            (this.decaf.display as StandardDisplay).doScroll?.();
        }
    }

    private showSize(): void {
        clearTimeout(this.sizetm);
        if (!this.decaf.display) return;

        if (!this.sizeel) {
            this.sizeel = document.createElement('div');
            this.sizeel.className = 'decafmud note center';
            this.container.appendChild(this.sizeel);
        }

        const sz = (this.decaf.display as StandardDisplay).getSize(); // Assume display is StandardDisplay
        this.sizeel.style.opacity = '1';
        this.sizeel.innerHTML = `${sz[0]}x${sz[1]}`;

        this.sizetm = setTimeout(() => this.hideSize(), 500);
    }

    private hideSize(final: boolean = false): void {
        clearTimeout(this.sizetm);
        if (!this.sizeel) return;

        if (final) {
            // NAWS send logic (simplified, assuming NAWS telopt exists and has send method)
            if (this.decaf.telopt[TN.NAWS] && (this.decaf.telopt[TN.NAWS] as any).send) {
                try { (this.decaf.telopt[TN.NAWS] as any).send(); } catch (err) { /* ignore */ }
            }
            if (this.sizeel.parentNode) {
                this.sizeel.parentNode.removeChild(this.sizeel);
            }
            this.sizeel = undefined;
            return;
        }

        this.sizeel.style.transition = 'opacity 0.25s linear'; // Standard property
        setTimeout(() => { if(this.sizeel) this.sizeel.style.opacity = '0'; }, 0); // Ensure transition applies
        this.sizetm = setTimeout(() => this.hideSize(true), 250);
    }


    /** Resize the toolbar when adding/changing/removing a button. */
    private _resizeToolbar(): boolean {
        const tbarPositionSetting = this.decaf.store.get('ui/toolbar-position', 'top-left') as string;
        let alwaysOnSetting = this.decaf.store.get('ui/toolbar-always', 2) as (0 | 1 | 2); // 0:never, 1:always, 2:fullscreen only
        let cssText = this.toolbar.style.cssText || ""; // Ensure cssText is a string
        let needsResizeScreen = false;

        if (this.old_tbarpos !== tbarPositionSetting) {
            this.toolbar.classList.remove(this.old_tbarpos);
            this.toolbar.classList.add(tbarPositionSetting);

            // Remove old positional styles
            if (this.old_tbarpos.startsWith('top-')) {
                cssText = cssText.replace(/top:[\s\-0-9a-z.]+;/gi, '');
            } else if (this.old_tbarpos === 'left') {
                cssText = cssText.replace(/left:[\s\-0-9a-z.]+;/gi, '');
            } else if (this.old_tbarpos === 'right') {
                cssText = cssText.replace(/right:[\s\-0-9a-z.]+;/gi, '');
            }
            this.old_tbarpos = tbarPositionSetting;
        }

        let isAlwaysOn = false;
        if (alwaysOnSetting === 0) { isAlwaysOn = false; }
        else if (alwaysOnSetting === 1) { isAlwaysOn = true; }
        else { isAlwaysOn = this.container.classList.contains('fullscreen'); }

        if (isAlwaysOn && !this.toolbar.classList.contains('always-on')) {
            this.toolbar.classList.add('always-on');
        } else if (!isAlwaysOn && this.toolbar.classList.contains('always-on')) {
            this.toolbar.classList.remove('always-on');
        }

        if (this.toolbar.classList.contains('always-on') && this.old_tbarpos.startsWith('top-')) {
            const currentToolbarHeight = this.toolbar.offsetHeight;
            if (this.settings && this.toolbarPadding !== currentToolbarHeight) {
                (this.settings as HTMLElement).style.paddingTop = `${currentToolbarHeight - 5}px`;
            }
            if (this.decaf.display && this.toolbarPadding !== currentToolbarHeight) {
                (this.decaf.display as StandardDisplay).shouldScroll?.();
                this.el_display.style.paddingTop = `${currentToolbarHeight}px`;
                this.toolbarPadding = currentToolbarHeight;
                needsResizeScreen = true;
            } else if (!this.decaf.display && this.toolbarPadding !== currentToolbarHeight) {
                 this.toolbarPadding = currentToolbarHeight;
            }
        } else if (this.toolbarPadding !== undefined) {
            if (this.settings) { (this.settings as HTMLElement).style.paddingTop = ''; }
            if (this.decaf.display) {
                (this.decaf.display as StandardDisplay).shouldScroll?.();
                this.el_display.style.paddingTop = '0px';
                needsResizeScreen = true;
            }
            this.toolbarPadding = undefined;
        }

        const toolbarClientWidth = this.toolbar.clientWidth;
        const toolbarClientHeight = this.toolbar.clientHeight;

        if (this.old_tbarpos.includes('left')) {
            cssText = cssText.replace(/left:[\s\-0-9a-z.]+;/gi, '') + `left:-${toolbarClientWidth - 15}px;`;
        } else if (this.old_tbarpos.includes('right')) {
            cssText = cssText.replace(/right:[\s\-0-9a-z.]+;/gi, '') + `right:-${toolbarClientWidth - 15}px;`;
        } else if (this.old_tbarpos.startsWith('top-')) {
             if (!this.toolbar.classList.contains('always-on')) {
                cssText = cssText.replace(/top:[\s\-0-9a-z.]+;/gi, '') + `top:-${toolbarClientHeight - 12}px;`;
             } else {
                cssText = cssText.replace(/top:[\s\-0-9a-z.]+;/gi, '') + `top: 0px;`;
             }
        }
        this.toolbar.style.cssText = cssText;

        if (needsResizeScreen) {
            this.resizeScreen(false, true);
            if (this.decaf.display) (this.decaf.display as StandardDisplay).doScroll?.();
        }
        return needsResizeScreen;
    }

    public resizeScreen(showSize: boolean = true, force?: boolean): void {
        if (this.goFullOnResize) {
            let fs = window.fullScreen === true; // Note: window.fullScreen is non-standard
            // Attempt more standard checks if available, or rely on class for internal state
            if (document.fullscreenElement || (document as any).mozFullScreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement) {
                fs = true;
            } else {
                // Fallback to comparing window size to screen size if truly in browser fullscreen
                 if (window.outerHeight && (window.screen.height - window.outerHeight) <= 5) fs = true;
                 else if (window.innerHeight && (window.screen.height - window.innerHeight <= 5)) fs = true;
                 else fs = false;
            }


            if (fs && !this.old_fs) {
                this.old_fs = fs;
                this.enter_fs();
                return;
            } else if (!fs && this.old_fs) {
                this.old_fs = fs;
                this.exit_fs();
                return;
            }
            this.old_fs = fs;
        }

        if (force !== true && this.old_height === this.container.offsetHeight && this.old_width === this.container.offsetWidth) { return; }
        this.old_height = this.container.offsetHeight;
        this.old_width = this.container.offsetWidth;

        let tot = this.old_height - (this._input.offsetHeight + 17);
        if (this.toolbarPadding) { tot -= (this.toolbarPadding - 12); }
        if (tot < 0) { tot = 0; }

        if (this.settings && this.set_mid) { this.set_mid.style.height = `${tot}px`; }
        // if (this.toolbarPadding) { // This seems to double-dip if display padding is already set by toolbar
        //     tot -= 12;
        //     if (tot < 0) { tot = 0; }
        // }

        this.el_display.style.height = `${tot}px`;
        if (force !== true && this.decaf.display) { (this.decaf.display as StandardDisplay).scroll?.(); }

        if (this.scrollButton) {
            this.scrollButton.style.bottom = `${this._input.offsetHeight + 12}px`;
        }

        if (showSize !== false) {
            this.showSize();
        }
    }
    private showLogs(): void {
        let css = 'body{background-color:#000;color:#C0C0C0;}'; // Default fallback
        let css2 = 'div{font-family:monospace;font-size:inherit;}'; // Default fallback

        if (typeof window !== 'undefined' && window.getComputedStyle && this.decaf.display) {
            const displayElement = (this.decaf.display as StandardDisplay).display; // Assuming display property holds the element
            let node: HTMLElement | null = displayElement;
            let bodyBg = '';
            let count = 0;
            while (node && count < 15) { // Limit iterations
                const style = window.getComputedStyle(node, null);
                if (style.backgroundColor && style.backgroundColor !== 'transparent' && !style.backgroundColor.startsWith('rgba(')) {
                    bodyBg = style.backgroundColor;
                    break;
                }
                if (node === document.body) break;
                node = node.parentNode as HTMLElement | null;
                count++;
            }
            css = `body{background-color:${bodyBg || '#000'};`;

            const displayStyle = window.getComputedStyle(displayElement, null);
            css += `color:${displayStyle.color || '#C0C0C0'};}`;
            css2 = `div{font-family:${displayStyle.fontFamily || 'monospace'};font-size:${displayStyle.fontSize || 'inherit'};}`;
        }

        const logTitle = "DecafMUD Session Log"; // No i18n
        const logHTML = (this.decaf.display as StandardDisplay).display.innerHTML;

        const url = `data:text/html,<html><head><title>${logTitle}</title><style>${css}${css2}</style></head><body><h2>${logTitle}</h2><div>${logHTML}</div></body></html>`;

        window.open(url, 'log-window', 'width=700,height=400,directories=no,location=no,menubar=no,status=no,toolbar=no,scrollbars=yes');
     }


    /** Create a scroll button for the main output pane. */
    public showScrollButton(): void {
        if (this.scrollButton) { return; }

        const sb = document.createElement('div');
        sb.className = 'button scroll-button';
        sb.setAttribute('tabIndex', '0');
        sb.innerHTML = "More"; // No i18n
        const clickHandler = (e: Event) => {
            if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { return; }
            if (this.decaf.display as StandardDisplay) {
                (this.decaf.display as StandardDisplay).scrollNew();
            }
        };
        addEvent(sb, 'click', clickHandler);
        addEvent(sb, 'keydown', clickHandler);

        this.scrollButton = sb;
        this.container.appendChild(sb);
        sb.style.bottom = `${this._input.offsetHeight + 12}px`;
    }

    /** Destroy the scroll button. */
    public hideScrollButton(): void {
        if (!this.scrollButton) { return; }
        if (this.scrollButton.parentNode) {
            this.scrollButton.parentNode.removeChild(this.scrollButton);
        }
        this.scrollButton = undefined;
    }

    /**
     * Create a new notification bar.
     * If clss is a number, it's treated as timeout, and subsequent args shift.
     */
    public infoBar(
        text: string,
        clssOrTimeout: string | number = 'info',
        timeoutOrIcon?: number | string,
        iconOrButtons?: string | [string, (e: Event) => void][],
        buttonsOrClick?: [string, (e: Event) => void][] | ((e: Event) => void),
        clickOrClose?: ((e: Event) => void) | ((e: Event) => void),
        closeHandler?: (e: Event) => void
    ): void {
        let actualClass = 'info';
        let actualTimeout = 0;
        let actualIcon: string | undefined = undefined;
        let actualButtons: [string, (e: Event) => void][] | undefined = undefined;
        let actualClick: ((e: Event) => void) | undefined = undefined;
        let actualClose: ((e: Event) => void) | undefined = undefined;

        if (typeof clssOrTimeout === 'number') {
            actualTimeout = clssOrTimeout;
            actualClass = typeof timeoutOrIcon === 'string' ? timeoutOrIcon : 'info'; // class from timeoutOrIcon if string
            actualIcon = typeof iconOrButtons === 'string' ? iconOrButtons : undefined;
            actualButtons = Array.isArray(buttonsOrClick) ? buttonsOrClick : undefined;
            actualClick = typeof clickOrClose === 'function' ? clickOrClose : undefined;
            if (typeof buttonsOrClick === 'function' && !actualButtons) actualClick = buttonsOrClick; // If buttonsOrClick was the click fn
            actualClose = typeof closeHandler === 'function' ? closeHandler : (typeof clickOrClose === 'function' && actualClick !== clickOrClose ? clickOrClose : undefined);
             if (typeof iconOrButtons === 'function' && !actualButtons && !actualClick) actualClick = iconOrButtons as any; // Edge case from original overload
        } else {
            actualClass = clssOrTimeout;
            actualTimeout = typeof timeoutOrIcon === 'number' ? timeoutOrIcon : 0;
            actualIcon = typeof iconOrButtons === 'string' ? iconOrButtons : (typeof timeoutOrIcon === 'string' && typeof iconOrButtons === 'undefined' ? timeoutOrIcon : undefined) ;
            if (typeof timeoutOrIcon === 'string' && typeof iconOrButtons === 'undefined') actualIcon = timeoutOrIcon;


            actualButtons = Array.isArray(iconOrButtons) ? iconOrButtons : (Array.isArray(buttonsOrClick) ? buttonsOrClick : undefined);
            if (Array.isArray(buttonsOrClick)) actualButtons = buttonsOrClick;


            actualClick = typeof buttonsOrClick === 'function' ? buttonsOrClick : (typeof clickOrClose === 'function' ? clickOrClose : undefined);
             if (typeof iconOrButtons === 'function' && !actualButtons && !actualClick) actualClick = iconOrButtons as any;


            actualClose = typeof closeHandler === 'function' ? closeHandler : (typeof clickOrClose === 'function' && actualClick !== clickOrClose ? clickOrClose : undefined);
            if (typeof buttonsOrClick === 'function' && !actualButtons && actualClick !== buttonsOrClick) actualClose = buttonsOrClick as any;

        }


        const ibarItem: InfoBarItem = {
            text: text,
            class: actualClass,
            timeout: actualTimeout,
            icon: actualIcon,
            buttons: actualButtons,
            click: actualClick,
            close: actualClose
        };
        this.infobars.push(ibarItem);

        if (this.ibar === undefined) { // If no current info bar, create this one
            this.createIBar();
        }
    }


    public immediateInfoBar(
        text: string,
        clss?: string | number,
        timeout?: number | string,
        icon?: string | [string, (e: Event) => void][],
        buttons?: [string, (e: Event) => void][] | ((e: Event) => void),
        click?: ((e: Event) => void) | ((e: Event) => void),
        close?: (e: Event) => void
    ): boolean {
        if (this.ibar !== undefined) { return false; } // Only add if it will be displayed immediately
        this.infoBar(text, clss as any, timeout as any, icon as any, buttons as any, click as any, close);
        return true;
    }

    private createIBar(): void {
        if (this.infobars.length === 0) return;

        const currentIbarItem = this.infobars[0];
        const obj = document.createElement('div');
        obj.setAttribute('role', 'alert');
        obj.className = `decafmud infobar ${currentIbarItem.class}`;
        obj.innerHTML = currentIbarItem.text; // Assumes text is safe or sanitized
        obj.style.top = '-50px'; // Start off-screen for slide-in animation

        if (currentIbarItem.click) {
            obj.classList.add('clickable');
            obj.setAttribute('tabIndex', '0');
        }

        const handleClose = (event: Event, isProgrammatic: boolean = false) => {
            // Stop propagation for UI events
            if (!isProgrammatic && event) {
                 event.cancelBubble = true; // IE
                 if (event.stopPropagation) { event.stopPropagation(); }
            }

            this.closeIBar(true); // Close immediately
            if (currentIbarItem.close) {
                currentIbarItem.close.call(this, event);
            }
        };

        const handleClickOrKey = (event: Event) => {
            if ((event as KeyboardEvent).type === 'keydown' && (event as KeyboardEvent).keyCode !== 13 && (event as KeyboardEvent).keyCode !== 27) { return; } // Enter or Esc

            event.cancelBubble = true; // IE
            if (event.stopPropagation) { event.stopPropagation(); }

            if ((event as KeyboardEvent).type === 'keydown' && (event as KeyboardEvent).keyCode === 27) { // Esc key
                handleClose(event);
                return;
            }

            // If it's a click or Enter on a clickable bar
            if (currentIbarItem.click && (event.type === 'click' || ((event as KeyboardEvent).type === 'keydown' && (event as KeyboardEvent).keyCode === 13))) {
                this.closeIBar(true); // Close after click
                currentIbarItem.click.call(this, event);
            } else if (event.type === 'click' && !currentIbarItem.click) {
                // Click on non-clickable part of bar, do nothing beyond stopping propagation if needed
            }
        };

        addEvent(obj, 'click', handleClickOrKey);
        addEvent(obj, 'keydown', handleClickOrKey);


        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = 'X';
        closeBtn.className = 'close';
        closeBtn.setAttribute('tabIndex', '0');
        addEvent(closeBtn, 'click', (e) => handleClose(e));
        addEvent(closeBtn, 'keydown', (e) => { if ((e as KeyboardEvent).keyCode === 13) handleClose(e); });
        obj.insertBefore(closeBtn, obj.firstChild);


        if (currentIbarItem.buttons) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'btncont';
            currentIbarItem.buttons.forEach(btnDef => {
                const b = document.createElement('a');
                b.className = 'button';
                b.href = '#'; // Prevent navigation
                b.onclick = () => false; // Prevent navigation
                b.innerHTML = btnDef[0];
                addEvent(b, 'click', (e: Event) => {
                    e.preventDefault(); // Prevent default anchor action
                    e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation();
                    this.closeIBar(true); // Close the bar first
                    setTimeout(() => btnDef[1].call(this, e), 0); // Then call button action
                });
                btnContainer.appendChild(b);
            });
            obj.insertBefore(btnContainer, closeBtn); // Insert before close button for typical layout
        }

        this.ibar = obj;
        currentIbarItem.el = obj; // Store the element on the item
        this.container.insertBefore(obj, this.container.firstChild);

        // Animate in
        setTimeout(() => {
            let paddingTop = 0;
            if (typeof window !== 'undefined' && window.getComputedStyle) {
                paddingTop = parseInt(window.getComputedStyle(obj, null).paddingTop, 10);
            } else if ((obj as any).currentStyle) { // IE fallback
                paddingTop = parseInt((obj as any).currentStyle.paddingTop, 10);
            }
            if (this.toolbarPadding) { paddingTop += this.toolbarPadding - 10; }

            obj.style.transition = 'top 0.1s linear'; // Standard transition
            obj.style.paddingTop = `${paddingTop}px`;
            obj.style.top = '0px'; // Slide into view

            if (currentIbarItem.icon) {
                obj.style.backgroundImage = `url("${currentIbarItem.icon}")`;
                obj.style.backgroundPosition = `5px ${paddingTop}px`; // Adjust icon based on padding
            }
        }, 0);


        if (currentIbarItem.timeout > 0) {
            this.ibartimer = setTimeout(() => {
                handleClose(new Event('timeout'), true); // Simulate an event for programmatic close
            }, currentIbarItem.timeout * 1000);
        }
    }


    private closeIBar(immediate: boolean = false): void {
        if (!this.ibar) { return; }
        clearTimeout(this.ibartimer);
        this.ibartimer = undefined;

        const barElementToRemove = this.ibar;
        this.ibar = undefined; // Clear current bar immediately to allow next one to show

        const finishClose = () => {
            if (barElementToRemove.parentNode) {
                barElementToRemove.parentNode.removeChild(barElementToRemove);
            }
            const removedItem = this.infobars.shift(); // Remove from queue
            if (removedItem && removedItem.close && immediate) { // Call close handler if provided and closed immediately by user action rather than timeout fade
                 // Check if this close was due to a user action or timeout for the callback
                 // This logic might need refinement based on how `immediate` is used
            }


            if (this.infobars.length > 0) { // If there are more bars in queue
                this.createIBar();
            }
        };

        if (!immediate) {
            barElementToRemove.style.transition = 'opacity 0.25s linear';
            barElementToRemove.style.opacity = '0';
            this.ibartimer = setTimeout(finishClose, 250);
        } else {
            finishClose();
        }
    }



     /** Quick and dirty function for saving logs. */

    /** Load the settings interface. */
    public showSettings(): void {
        if (this.settings) { // Settings window is already open, so close it
            if (this.settings.parentNode) {
                this.settings.parentNode.removeChild(this.settings);
            }
            this.settings = undefined;
            this.set_cont = undefined;
            this.set_mid = undefined;
            // Assuming stbutton is the ID of the settings toolbar button
            // if (this.stbutton !== undefined) {
            //     this.tbPressed(this.stbutton, false);
            //     this.tbTooltip(this.stbutton, "Click to change DecafMUD's settings."); // No i18n
            // }
            this.el_display.setAttribute('tabIndex', '0'); // Make display focusable again
            return;
        }

        // Create the main settings window element
        const settingsWindow = document.createElement('div');
        settingsWindow.className = 'decafmud window settings';

        if (this.toolbarPadding) {
            settingsWindow.style.paddingTop = `${this.toolbarPadding - 5}px`;
        }

        const middleContainer = document.createElement('div');
        middleContainer.className = 'decafmud window-middle';
        settingsWindow.appendChild(middleContainer);

        const innerContainer = document.createElement('div');
        innerContainer.className = 'decafmud window-inner';
        middleContainer.appendChild(innerContainer);

        const title = document.createElement('h2');
        title.innerHTML = "DecafMUD Settings"; // No i18n
        innerContainer.appendChild(title);

        const description = document.createElement('p');
        description.innerHTML = "Use the form below to adjust DecafMUD's settings, then click Apply when you're done."; // No i18n
        innerContainer.appendChild(description);

        // Iterate through decaf.settings
        const decafSettings = this.decaf.settings as any; // Cast to any to access dynamic properties
        for (const categoryKey in decafSettings) {
            if (!Object.prototype.hasOwnProperty.call(decafSettings, categoryKey)) continue;

            const category = decafSettings[categoryKey];
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'decafmud settings';

            const legendText = category._name || categoryKey.substring(0, 1).toUpperCase() + categoryKey.substring(1);
            const legend = document.createElement('legend');
            legend.innerHTML = legendText; // No i18n
            fieldset.appendChild(legend);

            if (category._desc) {
                const catDesc = document.createElement('p');
                catDesc.innerHTML = category._desc; // No i18n
                fieldset.appendChild(catDesc);
            }

            const basePath = category._path || '/';
            const settingPathPrefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

            for (const settingKey in category) {
                if (!Object.prototype.hasOwnProperty.call(category, settingKey) || settingKey.startsWith('_')) continue;

                const settingDetails = category[settingKey];
                const controlDiv = document.createElement('div');
                const fullSettingPath = `${settingPathPrefix}${settingKey}`;
                // Sanitize ID: replace problematic characters like '/'
                const controlId = `setting-${fullSettingPath.replace(/[^a-zA-Z0-9-_]/g, '-')}`;


                const controlName = settingDetails._name || settingKey.substring(0, 1).toUpperCase() + settingKey.substring(1);
                const controlType = settingDetails._type || 'text';

                let inputElement: HTMLInputElement | HTMLSelectElement;
                let labelElement: HTMLLabelElement | null = null;

                if (controlType !== 'boolean') {
                    labelElement = document.createElement('label');
                    labelElement.setAttribute('for', controlId);
                    labelElement.innerHTML = controlName; // No i18n
                    controlDiv.appendChild(labelElement);
                }

                const currentValue = this.decaf.store.get(fullSettingPath, settingDetails._default);


                switch (controlType) {
                    case 'password':
                        inputElement = document.createElement('input');
                        inputElement.type = 'password';
                        (inputElement as HTMLInputElement).value = currentValue || "";
                        break;
                    case 'boolean':
                        inputElement = document.createElement('input');
                        inputElement.type = 'checkbox';
                        (inputElement as HTMLInputElement).checked = !!currentValue;
                        break;
                    case 'nochance': // Yes/No dropdown
                        inputElement = document.createElement('select');
                        const optYes = document.createElement('option');
                        optYes.value = 'true';
                        optYes.innerHTML = 'Yes';
                        inputElement.appendChild(optYes);
                        const optNo = document.createElement('option');
                        optNo.value = 'false';
                        optNo.innerHTML = 'No';
                        inputElement.appendChild(optNo);
                        (inputElement as HTMLSelectElement).value = currentValue ? 'true' : 'false';
                        break;
                    default: // text, font, etc.
                        inputElement = document.createElement('input');
                        inputElement.type = 'text';
                        (inputElement as HTMLInputElement).value = currentValue || "";
                        break;
                }
                inputElement.id = controlId;
                inputElement.setAttribute('data-setting-path', fullSettingPath); // Store path for saving

                controlDiv.appendChild(inputElement);

                if (settingDetails._desc) {
                    let descLabel: HTMLLabelElement | HTMLParagraphElement;
                    if (controlType === 'boolean') {
                        descLabel = document.createElement('label');
                        descLabel.setAttribute('for', controlId);
                    } else {
                        descLabel = document.createElement('p');
                    }
                    descLabel.innerHTML = settingDetails._desc; // No i18n
                    controlDiv.appendChild(descLabel);
                } else if (controlType === 'boolean') { // Add label if boolean and no separate description
                    labelElement = document.createElement('label');
                    labelElement.setAttribute('for', controlId);
                    labelElement.innerHTML = controlName; // No i18n
                    controlDiv.appendChild(labelElement);
                }
                fieldset.appendChild(controlDiv);
            }
            innerContainer.appendChild(fieldset);
        }

        // Add Apply and Cancel buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'settings-buttons';

        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply';
        applyButton.className = 'button apply-button';
        addEvent(applyButton, 'click', () => {
            innerContainer.querySelectorAll('input[data-setting-path], select[data-setting-path]').forEach(el => {
                const inputEl = el as HTMLInputElement | HTMLSelectElement;
                const path = inputEl.getAttribute('data-setting-path');
                if (path) {
                    let value: any;
                    if ((inputEl as HTMLInputElement).type === 'checkbox') {
                        value = (inputEl as HTMLInputElement).checked;
                    } else if (inputEl.tagName === 'SELECT') {
                        value = (inputEl as HTMLSelectElement).value === 'true';
                    } else {
                        value = (inputEl as HTMLInputElement).value;
                    }
                    this.decaf.store.set(path, value);
                }
            });
            this.showSettings(); // This will close the settings window
            // Potentially trigger a refresh or event if settings need immediate effect
        });
        buttonContainer.appendChild(applyButton);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'button cancel-button';
        addEvent(cancelButton, 'click', () => {
            this.showSettings(); // This will close the settings window without saving
        });
        buttonContainer.appendChild(cancelButton);
        innerContainer.appendChild(buttonContainer);


        let totalHeight = this.container.offsetHeight - (this._input.offsetHeight + 17);
        if (this.toolbarPadding) { totalHeight -= (this.toolbarPadding - 12); }
        if (totalHeight < 0) { totalHeight = 0; }
        middleContainer.style.height = `${totalHeight}px`;

        this.el_display.setAttribute('tabIndex', '-1');
        this.container.insertBefore(settingsWindow, this.el_display);

        this.settings = settingsWindow;
        this.set_cont = innerContainer;
        this.set_mid = middleContainer;

        // if (this.stbutton !== undefined) {
        //     this.tbPressed(this.stbutton, true);
        //     this.tbTooltip(this.stbutton, "Click to close the settings window."); // No i18n
        // }
    }


    // Placeholder for addIcon - will need full implementation
    private addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number {
        const id = this.icons.length;
        const ico = document.createElement('div');
        // ... (full icon creation logic)
        ico.className = `decafmud status-icon ${clss} ${onclick ? 'icon-click' : ''}`;
        ico.innerHTML = html;
        ico.setAttribute('title', text);
        ico.setAttribute('role', 'status');
        ico.setAttribute('aria-label', text);
        if (onclick || onkey) { ico.setAttribute('tabIndex', '0'); }


        this.icons.push([ico, onclick, onkey]);

        for(let i=0; i < this.icons.length; i++) {
            this.icons[i][0].style.right = `${((this.icons.length-i)-1)*21}px`;
        }

        this.tray.appendChild(ico);

        if (onclick) { addEvent(ico, 'click', (e) => onclick.call(this, e)); }
        if (onclick && !onkey) { addEvent(ico, 'keydown', (e) => { if ((e as KeyboardEvent).keyCode !== 13) return; onclick.call(this, e); }); }
        if (onkey) { addEvent(ico, 'keydown', (e) => onkey.call(this, e as KeyboardEvent)); }


        this._resizeTray();
        return id;
    }
     private _resizeTray(): void {
        const w = this.tray.clientWidth;
        this._input.style.paddingRight = `${w}px`;
      }
     public updateIcon(ind: number, text?: string, html?: string, clss?: string): void {
        if (ind < 0 || ind >= this.icons.length) { throw new Error("Invalid index for icon!"); }

        const iconData = this.icons[ind];
        const el = iconData[0];
        const onclickHandler = iconData[1];

        if (clss) { el.className = `decafmud status-icon ${clss} ${onclickHandler ? 'icon-click' : ''}`; }
        if (html !== undefined) { el.innerHTML = html; } // Allow empty html
        if (text) {
            el.setAttribute('title', text);
            el.setAttribute('aria-label', text);
        }
     }


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

    /** Save current input to history, avoiding duplicates and managing history size. */
    private saveInputInHistory(): void {
        const txt = this.input.value;
        if (txt === "") return;
        if (txt === this.history[0]) return;

        // Find if the text exists in history to remove the older entry
        const lastId = this.history.indexOf(txt);

        if (lastId !== -1) {
            // Remove the old entry
            this.history.splice(lastId, 1);
        }

        // Add to the beginning
        this.history.unshift(txt);

        // Ensure history does not exceed MAX_HISTORY_SIZE
        if (this.history.length > this.MAX_HISTORY_SIZE) {
            this.history.length = this.MAX_HISTORY_SIZE; // Truncate
        }
    }

    /** Check if the current input value differs from the history item at historyPosition. */
    private inputModified(): boolean {
        const txt = this.input.value;
        if (this.historyPosition === -1) return txt !== ''; // If not browsing, modified if not empty
        // Ensure historyPosition is valid
        if (this.historyPosition < 0 || this.historyPosition >= this.history.length) return true;
        return txt !== this.history[this.historyPosition];
    }

    /** Load command from history into the input field. */
    private loadInputFromHistory(): void {
        if (this.historyPosition === -1) {
            this.input.value = '';
        } else if (this.historyPosition >= 0 && this.historyPosition < this.history.length) {
            this.input.value = this.history[this.historyPosition];
            // this.input.focus(); // Ensure focus
            // (this.input as HTMLInputElement).select?.(); // Select text
        }
        // Move cursor to end of input after loading from history
        setTimeout(() => { // Timeout to ensure focus and value are set
            this.input.focus();
            const len = this.input.value.length;
            if ((this.input as HTMLInputElement).setSelectionRange) {
                (this.input as HTMLInputElement).setSelectionRange(len, len);
            } else if ((this.input as any).createTextRange) { // IE
                const range = (this.input as any).createTextRange();
                range.collapse(true);
                range.moveEnd('character', len);
                range.moveStart('character', len);
                range.select();
            }
        }, 0);
    }

    /** Parse input for ';;' and send multiple commands. */
    private parseAndSendInput(inputValue: string): void {
        const lines = inputValue.split(';;');
        for (const line of lines) {
            if (line.trim() !== '' || lines.length === 1) { // Send empty if it's the only "command"
                this.decaf.sendInput(line);
                // Original panels.js doesn't call displayInput here, relying on server echo or specific display logic
            }
        }
    }

    private handleInput(e: KeyboardEvent): void {
        if (e.type !== 'keydown') { return; }

        // Prevent F1 (help popup) and F5 (page refresh)
        if (e.keyCode === 112 || e.keyCode === 116) { // F1 or F5
            e.preventDefault();
        }

        if (e.keyCode === 13) { // Enter
            this.parseAndSendInput(this.input.value);
            this.saveInputInHistory();
            this.historyPosition = -1; // Reset history browsing
            if (!this.decaf.options.set_interface.repeat_input) { // From original simple.js options
                this.input.value = '';
            }
            (this.input as HTMLInputElement).select?.();
            e.preventDefault(); // Prevent default form submission if input is in a form
        }
        // Support for MUD-specific key bindings (placeholder for tryExtraMacro)
        // else if (typeof window.tryExtraMacro !== 'undefined' && (window as any).tryExtraMacro(this.decaf, e.keyCode)) {
        //     if (e.preventDefault) e.preventDefault();
        //     else (e as any).returnValue = false;
        // }
        else if (e.keyCode === 38) { // Up arrow (history previous)
            if (this.inputModified()) this.historyPosition = -1; // If input changed, reset browsing

            if (this.historyPosition === -1) { // Start browsing or re-start if input was modified
                if (this.input.value !== '' && (this.history.length === 0 || this.input.value !== this.history[0])) {
                    // Save current potentially unsaved line before browsing
                    this.saveInputInHistory();
                }
                this.historyPosition = 0; // Start from the most recent
            } else if (this.historyPosition < this.history.length - 1) {
                this.historyPosition++;
            }
            this.loadInputFromHistory();
            e.preventDefault();
        } else if (e.keyCode === 40) { // Down arrow (history next)
            if (this.inputModified()) this.historyPosition = -1;

            if (this.historyPosition > 0) {
                this.historyPosition--;
                this.loadInputFromHistory();
            } else if (this.historyPosition === 0) { // Was at the most recent, go to empty/current
                this.historyPosition = -1;
                this.loadInputFromHistory(); // This will clear the input
            }
            e.preventDefault();
        } else if (e.keyCode === 8 && e.shiftKey === true) { // Shift+Backspace to clear input
            this.input.value = '';
            e.preventDefault();
        } else if (e.keyCode === 33 && this.decaf.display && (this.decaf.display as StandardDisplay).scrollUp) { // PgUp
            (this.decaf.display as StandardDisplay).scrollUp(); e.preventDefault();
        } else if (e.keyCode === 34 && this.decaf.display && (this.decaf.display as StandardDisplay).scrollDown) { // PgDown
            (this.decaf.display as StandardDisplay).scrollDown(); e.preventDefault();
        } else {
            // Any other key press while browsing history should probably stop history browsing
            // and apply the key to the current history item as a modification.
            // The inputModified() check at the start of up/down arrow handles this implicitly.
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
        if (this.decaf.display && (this.decaf.display as any).message) {
             (this.decaf.display as any).message("Connection closed."); // From panels.js
        }
    }

    // Methods from decafmud.interface.panels.js for sidebar, progress bars, map
    public showSidebar(): void {
        if (this.sidebar) this.sidebar.style.display = 'inline';
    }

    public hideSidebar(): void {
        if (this.sidebar) this.sidebar.style.display = 'none';
    }

    public showProgressBars(): void {
        if (this.progresstable) {
            this.progresstable.style.display = 'table'; // Use 'table' for proper table display
            this.progresstable.style.height = "auto";
        }
    }

    public hideProgressBars(): void {
        if (this.progresstable) {
            this.progresstable.style.display = 'none';
            this.progresstable.style.height = "0";
        }
    }

    public addProgressBar(name: string, color: string): void {
        if (!this.progresstable) return;

        const w = 100; // Width of the progress bar
        const h = 20;  // Height of the progress bar

        const tr = document.createElement("tr");
        this.progresstable.appendChild(tr);

        const tdName = document.createElement("td");
        tdName.innerHTML = name + ":";
        tr.appendChild(tdName);

        const tdBar = document.createElement("td");
        tr.appendChild(tdBar);

        const barContainer = document.createElement("div");
        barContainer.style.width = `${w}px`;
        barContainer.style.height = `${h}px`;
        barContainer.style.backgroundColor = 'white'; // Or a themeable background
        barContainer.style.padding = '0px';
        barContainer.style.border = '1px solid #ccc'; // Optional border

        const progressElement = document.createElement("div");
        progressElement.style.width = "0px"; // Initial progress
        progressElement.style.height = `${h}px`;
        progressElement.style.backgroundColor = color;
        progressElement.style.padding = "0px";
        // progressElement.style.overflow = "hidden"; // Not needed if text is in separate element
        // progressElement.style.overflowX = "visible";

        const infoElement = document.createElement("div");
        infoElement.style.width = barContainer.style.width;
        infoElement.style.height = barContainer.style.height;
        infoElement.style.marginTop = `-${h}px`; // Overlay on top of barContainer
        infoElement.style.textAlign = "center";
        infoElement.style.paddingTop = "1px"; // Adjust for vertical centering
        infoElement.style.lineHeight = `${h}px`; // Vertical centering
        infoElement.style.fontWeight = "bold";
        infoElement.style.color = "black"; // Or contrast with bar color

        tdBar.appendChild(barContainer);
        barContainer.appendChild(progressElement);
        tdBar.appendChild(infoElement); // Info text overlays the bar

        this.progressbars.push({ name: name, progressEl: progressElement, infoEl: infoElement });
        this.showSidebar(); // Ensure sidebar is visible if adding a progress bar
        this.showProgressBars();
    }

    public setProgress(name: string, percent: number, text: string): void {
        const w = 100; // Must match width in addProgressBar
        const barData = this.progressbars.find(pb => pb.name === name);
        if (barData) {
            const newWidth = Math.max(0, Math.min(100, percent)) * w / 100;
            barData.progressEl.style.width = `${newWidth}px`;
            barData.infoEl.innerHTML = text;
        }
    }

    public setProgressColor(name: string, color: string): void {
        const barData = this.progressbars.find(pb => pb.name === name);
        if (barData) {
            barData.progressEl.style.backgroundColor = color;
        }
    }

    public showMap(): void {
        if (this.mapdiv) this.mapdiv.style.display = 'block'; // Use 'block' or 'inline' as appropriate
        this.showSidebar();
    }

    public hideMap(): void {
        if (this.mapdiv) this.mapdiv.style.display = 'none';
        if (this.progresstable && this.progresstable.style.display === 'none') {
            // Only hide sidebar if progress bars are also hidden
            // This logic might need adjustment based on desired behavior from original panels.settings.js
            // For now, if map is hidden and progress table is hidden, hide sidebar.
           if (!this.progressbars.length || (this.progresstable && this.progresstable.style.display === 'none')) {
               this.hideSidebar();
           }
        }
    }

    public printMap(txt: string): void {
        if (this.mapdiv) {
            // Basic HTML structure, can be enhanced with CSS
            this.mapdiv.innerHTML = `<hr><i>Map:</i><div style="text-align:center; font-family: monospace; white-space: pre;">${txt}</div>`;
            this.showMap(); // Ensure map area is visible
        }
    }

    // Placeholder for maybeFocusInput - to be reviewed if needed
    // private maybeFocusInput(e: MouseEvent): void {
    //     const sel = window.getSelection();
    //     if (sel && sel.toString() !== '' && this.el_display.contains(sel.focusNode?.parentNode as Node | null)) {
    //         this.decaf.debugString('not focusing this.input: selection active');
    //         return;
    //     }
    //     this.input.focus();
    // }

    // Placeholder for unloadPageFromEvent
    private unloadPageFromEvent(e: BeforeUnloadEvent): string | undefined {
        if (this.decaf.connected) {
            const confirmationMessage = "You are still connected."; // No i18n
            (e || window.event).returnValue = confirmationMessage; // Gecko + IE
            return confirmationMessage; // Gecko + Webkit, Safari, Chrome etc.
        }
        return undefined;
    }

    private resizeScreenFromEvent(source: string, event?: Event): void {
        this.resizeScreen(true, false);
    }

    // Menu handling methods from panels.menu.js
    private openMenuIndex: number = -1; // Tracks the currently open menu

    private buildMenuHtml(menuDefinition: MenuDefinition): string {
        let listItems = '';
        for (const item of menuDefinition.items) {
            // Ensure action string is properly escaped for HTML attribute if directly embedding
            // A better approach would be to use event listeners rather than javascript: hrefs
            // For now, sticking close to original if it implies direct eval or function call string
            listItems += `<li><a href="#" onclick="${item.action.replace(/"/g, '&quot;')} return false;" id="${item.id || ''}">${item.name}</a></li>`;
        }
        return `${menuDefinition.name}<ul id="sub_${menuDefinition.id}" class="submenu">${listItems}</ul>`;
    }

    // This method will be called by setup to get menu configurations for tbNew
    private getMenuConfigs(): {id: string, html: string, tooltip: string, action: (e: Event) => void}[] {
        const menuConfigs: {id: string, html: string, tooltip: string, action: (e: Event) => void}[] = [];
        toolbarMenus.forEach((menuDef, index) => {
            menuConfigs.push({
                id: menuDef.id,
                html: this.buildMenuHtml(menuDef), // tbNew expects HTML string for the button face
                tooltip: menuDef.tooltip,
                action: (event: Event) => {
                    event.stopPropagation(); // Prevent event from bubbling up and closing menu immediately
                    this.toggleMenu(index);
                }
            });
        });
        return menuConfigs;
    }

    public closeMenus(): void {
        toolbarMenus.forEach((menuDef) => {
            const submenu = document.getElementById(`sub_${menuDef.id}`);
            if (submenu) {
                submenu.style.visibility = 'hidden';
            }
        });
        this.openMenuIndex = -1;
        // Only focus input if it's not part of a popup interaction
        if (!this.popup) { // Assuming this.popup tracks if a menu's popup is open
             this.input.focus();
        }
    }

    public toggleMenu(index: number): void {
        const menuId = `sub_${toolbarMenus[index].id}`;
        const submenu = document.getElementById(menuId);

        if (!submenu) return;

        if (this.openMenuIndex === index) { // Clicked on already open menu, so close it
            submenu.style.visibility = 'hidden';
            this.openMenuIndex = -1;
            this.input.focus();
        } else {
            this.closeMenus(); // Close any other open menu
            submenu.style.visibility = 'visible';
            this.openMenuIndex = index;
            // Optional: focus first item in submenu or the menu button itself
        }
    }
    // End of menu handling methods

    // Popup window methods from panels.menu.js and panels.js (consolidated)
    private popup?: HTMLElement;
    private popupHeaderElement?: HTMLElement; // Renamed from popupheader to avoid conflict if it was a global
    private headerDragInstance?: any; // Placeholder for dragObject instance

    /** Calculate max height for popups. */
    private maxPopupHeight(): number {
        let tot = this.container.offsetHeight - (this._input.offsetHeight + 50);
        if (this.toolbarPadding) { tot -= (this.toolbarPadding - 12); }
        return Math.max(0, tot);
    }

    /** Calculate max width for popups. */
    private maxPopupWidth(): number {
        return Math.max(0, this.container.offsetWidth - 12); // 12 for scrollbar/padding
    }

    /** Vertical offset for popups. */
    private verticalPopupOffset(): number {
        return 50; // px from top of container or screen
    }

    /** Horizontal offset for popups. */
    private horizontalPopupOffset(): number {
        return 0; // Centering or specific alignment handled by width calc
    }

    public hidePopup(): void {
        if (!this.popup) return;
        if (this.headerDragInstance && (this.headerDragInstance as any).StopListening) {
            (this.headerDragInstance as any).StopListening(true);
        }
        if (this.popup.parentNode) {
            this.popup.parentNode.removeChild(this.popup);
        }
        this.popup = undefined;
        this.popupHeaderElement = undefined;
        this.headerDragInstance = undefined;
        this.input.focus(); // Return focus to main input
    }

    public showPopup(): HTMLElement {
        if (this.popup) this.hidePopup(); // Close existing popup first

        this.popup = document.createElement("div");

        const w = this.maxPopupWidth() * 0.6; // 60% of available width
        const h = this.maxPopupHeight() * 0.7; // 70% of available height
        const t = this.verticalPopupOffset();
        // Center the popup: (total width - popup width) / 2
        const l = this.horizontalPopupOffset() + (this.maxPopupWidth() - w) / 2;


        this.popup.style.width = `${w}px`;
        this.popup.style.height = `${h}px`;
        this.popup.style.top = `${t}px`;
        this.popup.style.left = `${l}px`;
        this.popup.className = 'decafmud window'; // General popup class
        this.popup.id = "decafmud-popup"; // Unique ID

        // Draggable Header
        this.popupHeaderElement = document.createElement("div");
        this.popupHeaderElement.style.width = "100%"; // Header takes full width of popup
        this.popupHeaderElement.style.height = "25px"; // Fixed header height
        this.popupHeaderElement.style.top = "0px";
        this.popupHeaderElement.className = 'decafmud window-header';
        this.popupHeaderElement.id = "decafmud-popup-header";
        this.popup.appendChild(this.popupHeaderElement);

        // dragelement.js integration point:
        // dragelement.js integration point:
        // Assuming dragObject is available globally or imported after conversion
        // if (typeof (window as any).dragObject === 'function') { // Old check
        //     this.headerDragInstance = new (window as any).dragObject(this.popup.id, this.popupHeaderElement.id);
        // } else {
        //     this.decaf.debugString("dragObject not available for popup.", "warn");
        //     this.popupHeaderElement.style.cursor = "move"; // Basic move cursor as fallback
        // }
        // Use the imported DragObject
        try {
            this.headerDragInstance = new DragObject(this.popup, this.popupHeaderElement);
        } catch (e) {
            this.decaf.debugString(`Failed to initialize DragObject: ${(e as Error).message}`, "error");
            this.popupHeaderElement.style.cursor = "move"; // Basic move cursor as fallback
        }


        // Close button
        const closeButton = document.createElement('button'); // Use button for better accessibility
        closeButton.innerHTML = '<big>X</big>'; // Or use an icon
        closeButton.className = 'closebutton'; // Style with CSS
        addEvent(closeButton, 'click', () => this.hidePopup());
        this.popup.appendChild(closeButton); // Add to popup, not header, for typical dialog layout

        // Prevent clicks inside popup from closing menus
        addEvent(this.popup, 'mousedown', (e: MouseEvent) => {
            if (e.which === 1 && this.openMenuIndex !== -1) {
                // Check if the click is outside any open menu's submenu
                // This is tricky; for now, just stop propagation if a menu is open.
                // A more robust solution would check if target is part of a menu.
                // e.stopPropagation(); // This might be too aggressive.
            }
        });

        this.container.insertBefore(this.popup, this.el_display); // Insert before main display
        return this.popup;
    }

    /** Adds a P element with text to the popup header. */
    public addPopupHeaderText(text: string): HTMLElement {
        if (!this.popupHeaderElement) {
            this.decaf.debugString("Cannot add header text, popup header not initialized.", "error");
            // Create a dummy paragraph to satisfy return type, though it won't be visible correctly.
            const dummyP = document.createElement("p");
            dummyP.innerHTML = "Error: Popup header missing.";
            return dummyP;
        }
        const p = document.createElement("p");
        p.innerHTML = text;
        p.className = "headertext"; // Style with CSS
        this.popupHeaderElement.appendChild(p); // Add text to the header element
        return p;
    }

    /** Creates a P element for centering buttons. */
    public createButtonLine(parentContainer: HTMLElement): HTMLElement {
        const buttonLine = document.createElement("p");
        buttonLine.style.textAlign = "center";
        parentContainer.appendChild(buttonLine);
        return buttonLine;
    }

    /** Creates a button with a caption and an onclick function. */
    public createButton(caption: string, onclickAction: string | (() => void)): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "prettybutton"; // Style with CSS
        btn.innerHTML = `<big>${caption}</big>`; // Using big tag from original
        if (typeof onclickAction === 'string') {
            // Caution: eval is generally discouraged.
            // If original code relied on 'this' context within eval, this might break.
            // Prefer passing functions directly.
            addEvent(btn, 'click', () => {
                 try { eval(onclickAction); } catch(e) { this.decaf.error("Error in button action: " + e); }
            });
        } else {
            addEvent(btn, 'click', onclickAction);
        }
        return btn;
    }

    /** Creates a textarea element for the popup. */
    public createPopupTextarea(name: string, adjustHeight: number = 0): HTMLTextAreaElement {
        if (!this.popup) throw new Error("Popup not shown, cannot create textarea.");
        const w = parseFloat(this.popup.style.width || '0') - 15; // Adjust for padding/borders
        const h = parseFloat(this.popup.style.height || '0') - 100 - adjustHeight; // Adjust for header, buttons, padding

        const textarea = document.createElement("textarea");
        textarea.id = name;
        textarea.cols = 80; // Default, consider removing if width/height style is sufficient
        textarea.rows = 20; // Default
        textarea.style.width = `${Math.max(50, w)}px`;
        textarea.style.height = `${Math.max(20, h)}px`;
        textarea.style.margin = "5px";
        this.popup.appendChild(textarea);
        textarea.focus();
        return textarea;
    }

    /** Creates a div for scrollable text content in the popup. */
    public createPopupTextDiv(): HTMLElement {
        if (!this.popup) throw new Error("Popup not shown, cannot create text div.");
        const w = parseFloat(this.popup.style.width || '0') - 10; // Adjust for padding
        const h = parseFloat(this.popup.style.height || '0') - 60; // Adjust for header, padding

        const div = document.createElement("div");
        div.style.width = `${Math.max(50, w)}px`;
        div.style.height = `${Math.max(20, h)}px`;
        div.style.margin = "5px";
        div.style.overflowY = "auto";
        this.popup.appendChild(div);
        return div;
    }
    // End of Popup window methods

    // Client-side settings from panels.settings.js, managed by SimpleInterface
    // These will be initialized from and saved to this.decaf.store
    private fontPercentage: number = 100;
    private fkeyMacrosEnabled: boolean = true;
    private numpadWalkingEnabled: boolean = true;
    private clientShowProgressBars: boolean = false; // Renamed to avoid conflict with method
    private clientShowMap: boolean = false;        // Renamed to avoid conflict with method

    private loadClientSettings(): void {
        this.fontPercentage = this.decaf.store.get('ui/fontPercentage', 100);
        this.fkeyMacrosEnabled = this.decaf.store.get('ui/fkeyMacrosEnabled', true);
        this.numpadWalkingEnabled = this.decaf.store.get('ui/numpadWalkingEnabled', true);
        this.clientShowProgressBars = this.decaf.store.get('ui/clientShowProgressBars', false);
        this.clientShowMap = this.decaf.store.get('ui/clientShowMap', false);
        this.applyFontSettings();
        this.applySidebarVisibility();
    }

    private saveClientSetting(key: string, value: any): void {
        this.decaf.store.set(`ui/${key}`, value);
    }

    private applyFontSettings(): void {
         if (this.el_display) { // el_display is the main content area
            this.el_display.style.fontSize = `${this.fontPercentage * 110 / 100}%`;
         }
    }

    private applySidebarVisibility(): void {
        if (this.clientShowProgressBars) {
            this.showProgressBars(); // Assumes this also calls showSidebar
        } else {
            this.hideProgressBars();
        }
        if (this.clientShowMap) {
            this.showMap(); // Assumes this also calls showSidebar
        } else {
            this.hideMap();
        }
        // If both are false, hideSidebar should be called by hideMap/hideProgressBars
        if (!this.clientShowMap && !this.clientShowProgressBars && this.sidebar) {
            this.hideSidebar();
        } else if ((this.clientShowMap || this.clientShowProgressBars) && this.sidebar) {
            this.showSidebar();
        }
    }


    // Menu Action Methods
    public menu_reconnect(): void {
        this.closeMenus();
        this.decaf.reconnect?.(); // Assuming reconnect is a method on DecafMUD
    }

    public menu_log(style: 'html' | 'plain'): void {
        this.closeMenus();
        const popup = this.showPopup();
        this.addPopupHeaderText(`Session Log (${style})`);

        const textarea = this.createPopupTextarea("log_content", 70);

        let logText = "";
        if (this.decaf.display && (this.decaf.display as StandardDisplay).display) {
            logText = (this.decaf.display as StandardDisplay).display.innerHTML;
        }

        if (style === "plain") {
            logText = logText.replace(/\n/g, ' '); // Normalize newlines first
            logText = logText.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to newlines
            logText = logText.replace(/<[^>]*>/g, '');    // Strip other HTML tags
            logText = logText.replace(/&nbsp;/g, ' ');
            logText = logText.replace(/&lt;/g, '<');
            logText = logText.replace(/&gt;/g, '>');
        } else { // html
            const currentTime = new Date();
            const dateString = `${currentTime.getDate()}/${currentTime.getMonth() + 1}/${currentTime.getFullYear()}`;
            // Basic HTML structure, assuming mud-colors.css is available relative to the client
            logText = `<html><head><title>DecafMUD Log ${dateString}</title>\n<link rel="stylesheet" href="DecafMUD/src/css/mud-colors.css" type="text/css" />\n</head><body>\n${logText}</body></html>`;
        }
        textarea.value = logText;

        const explanation = document.createElement('p');
        explanation.innerHTML = "To log, copy the text from this area to a text file (Ctrl+A, Ctrl+C).";
        if (style === "html") {
            explanation.innerHTML += ' The CSS file for colors can be found with the client.';
        }
        popup.appendChild(explanation);

        const btns = this.createButtonLine(popup);
        const closeBtn = this.createButton('Close', () => this.hidePopup());
        btns.appendChild(closeBtn);
    }

    public menu_font_size(): void {
        this.closeMenus();
        const popup = this.showPopup();
        this.addPopupHeaderText("Change Font Settings");

        const formContainer = this.createPopupTextDiv(); // Use text div for form elements

        const currentFontSize = this.fontPercentage;
        // const currentFontFamily = (this.el_display.style.fontFamily || '').split(',')[0].replace(/'/g, '').trim();
        // For simplicity, not implementing font family change via this UI for now, as it's complex.

        formContainer.innerHTML = `
            <p>Font Size:
               <input type="number" id="popup_fontsize" min="50" max="500" value="${currentFontSize}" style="width: 60px;"> %
            </p>
            <p>(Select a value between 50 and 500 - default is 100.)</p>
        `;
        // <p>Font Family: <input type="text" id="popup_fontfamily" value="${currentFontFamily}" placeholder="e.g., Courier New"></p>
        // <p>(Leave empty for current default, or specify a browser-supported font.)</p>

        const btns = this.createButtonLine(popup);
        const saveBtn = this.createButton('Save', () => {
            const sizeInput = document.getElementById('popup_fontsize') as HTMLInputElement;
            // const familyInput = document.getElementById('popup_fontfamily') as HTMLInputElement;

            const newSize = parseInt(sizeInput.value, 10);
            if (newSize >= 50 && newSize <= 500) {
                this.fontPercentage = newSize;
                this.applyFontSettings();
                this.saveClientSetting('fontPercentage', newSize);
            } else {
                alert("Please select a font size between 50 and 500.");
                return;
            }
            // if (familyInput.value.trim() !== "") {
            //    this.el_display.style.fontFamily = `'${familyInput.value.trim()}', Consolas, Courier, 'Courier New', 'Andale Mono', Monaco, monospace`;
            //    this.saveClientSetting('fontFamily', familyInput.value.trim());
            // }
            this.hidePopup();
            if (this.decaf.display as StandardDisplay) (this.decaf.display as StandardDisplay).scroll?.();
        });
        btns.appendChild(saveBtn);
        btns.appendChild(document.createTextNode('\u00A0\u00A0')); // Spacer
        const cancelBtn = this.createButton('Cancel', () => this.hidePopup());
        btns.appendChild(cancelBtn);
    }

    public menu_macros(): void {
        this.closeMenus();
        const popup = this.showPopup();
        this.addPopupHeaderText("Macro Settings");
        const formContainer = this.createPopupTextDiv();

        formContainer.innerHTML = `
            <p>DecafMUD supports F-key macros (use the MUD's alias system, e.g., <code>alias f1 score</code>) and Numpad navigation (NumLock must be on).</p>
            <p><label><input type="checkbox" id="popup_fkeymacros" ${this.fkeyMacrosEnabled ? "checked" : ""}> Enable F-key macros.</label></p>
            <p><label><input type="checkbox" id="popup_numpadwalking" ${this.numpadWalkingEnabled ? "checked" : ""}> Enable Numpad navigation.</label></p>
        `;

        const btns = this.createButtonLine(popup);
        const saveBtn = this.createButton('Save', () => {
            this.fkeyMacrosEnabled = (document.getElementById('popup_fkeymacros') as HTMLInputElement).checked;
            this.numpadWalkingEnabled = (document.getElementById('popup_numpadwalking') as HTMLInputElement).checked;
            this.saveClientSetting('fkeyMacrosEnabled', this.fkeyMacrosEnabled);
            this.saveClientSetting('numpadWalkingEnabled', this.numpadWalkingEnabled);
            this.hidePopup();
        });
        btns.appendChild(saveBtn);
        btns.appendChild(document.createTextNode('\u00A0\u00A0'));
        const cancelBtn = this.createButton('Cancel', () => this.hidePopup());
        btns.appendChild(cancelBtn);
    }

    public menu_history_flush(): void {
        this.closeMenus();
        if (this.decaf.display as StandardDisplay) {
            (this.decaf.display as StandardDisplay).clear?.();
        }
    }

    public menu_features(): void {
        this.closeMenus();
        const popup = this.showPopup();
        this.addPopupHeaderText("Client Features");
        const contentDiv = this.createPopupTextDiv();
        contentDiv.innerHTML = `
            <p>DecafMUD is a web-based MUD client with several features:</p>
            <ul>
                <li>Send multiple commands at once separated by <code>;;</code> (e.g., <code>look;;score</code>).</li>
                <li>Browse command history with Up/Down arrow keys.</li>
                <li>F-key macros: Use your MUD's alias system (e.g., <code>alias f1 score</code>). F-keys send <code>f1</code>, <code>f2</code>, etc.</li>
                <li>Numpad navigation (ensure NumLock is on).</li>
                <li>Clear input field with Shift+Backspace.</li>
                <li>Session logging via the Log menu.</li>
            </ul>
        `;
        const btns = this.createButtonLine(popup);
        btns.appendChild(this.createButton('Close', () => this.hidePopup()));
    }

    public menu_about(): void {
        this.closeMenus();
        this.decaf.about?.(); // Call core about method
    }

    // Methods for settings from panels.settings.js
    // These are now mostly handled by direct property changes and saveClientSetting
    public get_fontsize(): number { return this.fontPercentage; }
    public set_fontsize(k: number): void {
        this.fontPercentage = Math.max(50, Math.min(500, k));
        this.applyFontSettings();
        this.saveClientSetting('fontPercentage', this.fontPercentage);
    }

    public fkeys_enabled(): boolean { return this.fkeyMacrosEnabled; }
    public toggle_fkeys(value: boolean): void {
        this.fkeyMacrosEnabled = value;
        this.saveClientSetting('fkeyMacrosEnabled', this.fkeyMacrosEnabled);
    }

    public numpad_enabled(): boolean { return this.numpadWalkingEnabled; }
    public toggle_numpad(value: boolean): void {
        this.numpadWalkingEnabled = value;
        this.saveClientSetting('numpadWalkingEnabled', this.numpadWalkingEnabled);
    }

    public progress_visible(): boolean { return this.clientShowProgressBars; }
    public map_visible(): boolean { return this.clientShowMap; }

    public toggle_progressbars(value: boolean): void {
        this.clientShowProgressBars = value;
        this.applySidebarVisibility();
        this.saveClientSetting('clientShowProgressBars', this.clientShowProgressBars);
    }

    public toggle_map(value: boolean): void {
        this.clientShowMap = value;
        this.applySidebarVisibility();
        this.saveClientSetting('clientShowMap', this.clientShowMap);
    }


}

// Registration in decafmud.ts:
// import { SimpleInterface } from './plugins/interface/simple';
// DecafMUD.plugins.Interface.simple = SimpleInterface;

// Need to import toolbarMenus from menuData.ts
import { toolbarMenus, MenuDefinition } from './menuData';
import { DragObject } from '../../util/dragObject'; // Import DragObject

```
