// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 *
 * This is decafmud.interface.discworld.js from Discworld, but it is generic
 * and can be included in the upstream.
 */

/**
 * @fileOverview DecafMUD User Interface: Simple
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// Assume DecafMUD and other related types might be imported or globally available
// import type { DecafMUD as DecafMUDInstance, DecafMUDOptions } from './decafmud';
// import type { StandardDisplay } from './decafmud.display.standard'; // Assuming this is the type for this.display
// For now, using 'any' for DecafMUDInstance and other complex types if not fully defined.

(function(DecafMUD: any) {

const addEvent = (node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void => {
    if (node.addEventListener) {
        node.addEventListener(etype, func, false);
    } else if ((node as any).attachEvent) { // For older IE
        (node as any).attachEvent('on' + etype, func);
    } else {
        (node as any)['on' + etype] = func; // Last resort
    }
};

const delEvent = (node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void => {
    if (node.removeEventListener) {
        node.removeEventListener(etype, func, false);
    } else if ((node as any).detachEvent) { // For older IE
        (node as any).detachEvent('on' + etype, func);
    }
};

const bodyHack: boolean = /Firefox\//.test(navigator.userAgent);

// Forward declare global functions or assume they are available (e.g., from imported scripts)
declare function get_menus(): any[];
declare function toggle_menu(index: number): void;
declare var open_menu: number; // Assuming this is a global variable related to menus
declare function close_menus(): void;
declare class dragObject { constructor(elementId: string, handleId: string); StopListening(arg: boolean): void; }
declare function tryExtraMacro(decaf: any, keyCode: number): boolean;


interface DecafMUDInstanceInterface { // Placeholder
    options: any;
    store: any;
    telopt: any;
    TN: any;
    connected: boolean;
    display: any; // Should be StandardDisplay or a common display interface
    require(moduleName: string): void;
    debugString(message: string, type?: string, obj?: any): void;
    sendInput(input: string): void;
    tr(text: string, ...args: any[]): string; // Assuming tr is a method on DecafMUD instance
    [key: string]: any;
}

interface InfoBarItem {
    text: string;
    class: string;
    timeout: number;
    icon?: string;
    buttons?: [string, (e: Event) => void][];
    click?: (e: Event) => void;
    close?: (e: Event) => void;
    el?: HTMLElement;
}


class PanelsInterface {
    private decaf: DecafMUDInstanceInterface;
    public container: HTMLElement;
    public el_display: HTMLElement;
    public sidebar: HTMLElement;
    public progresstable: HTMLTableElement;
    public progressbars: [string, HTMLDivElement, HTMLDivElement][] = [];
    public mapdiv: HTMLElement;
    private _input: HTMLElement;
    public tray: HTMLElement;
    public toolbuttons: { [key: number]: [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, ((e: Event) => void) | undefined] } = {};
    private infobars: InfoBarItem[] = [];
    private icons: [HTMLElement, ((e: Event) => void) | undefined, ((e: KeyboardEvent) => void) | undefined][] = [];
    public toolbar: HTMLElement;
    public input: HTMLInputElement | HTMLTextAreaElement; // Can be input or textarea

    // Properties from prototype
    private toolbutton_id: number = -1;
    public echo: boolean = true;
    private inpFocus: boolean = false; // Renamed from hasFocus for clarity
    private old_parent: HTMLElement | undefined = undefined;
    private next_sib: Element | null | undefined = undefined; // Element or null

    // this.display is initialized in setup()
    public display: any; // Should be StandardDisplay or a common display interface

    private splash: HTMLElement | null = null;
    private splash_st: HTMLElement | null = null; // splash status text
    private splash_pgi: HTMLElement | null = null; // splash progress inner
    private splash_pgt: HTMLElement | null = null; // splash progress text
    private splash_old: HTMLElement | null = null; // old splash messages
    private splash_err: boolean = false;
    private scrollButton: HTMLElement | undefined = undefined;

    public static supports = {
        'tabComplete': true,
        'multipleOut': false,
        'fullscreen': true,
        'editor': false,
        'splash': true
    };

    private history: string[] = [];
    private historyPosition: number = -1;

    private old_y: string = ''; // For storing display's overflowY
    private sizeel: HTMLElement | undefined = undefined;
    private sizetm: number | undefined = undefined; // Timeout ID for size display

    private ico_connected: number = -1; // Index for the connection status icon

    private old_tbarpos: string = '';
    public toolbarPadding: number | undefined = undefined;

    private ibar: HTMLElement | undefined = undefined; // Current info bar element
    private ibartimer: number | undefined = undefined; // Timeout ID for info bar

    private oldscrollX: number | undefined = undefined;
    private oldscrollY: number | undefined = undefined;
    private old_children: HTMLElement[] = [];
    private old_display_styles: string[] = []; // Renamed from old_display to avoid conflict
    private old_body_over: string = '';

    private goFullOnResize: boolean = false;
    private old_height: number = -1;
    private old_width: number = -1;
    private old_fs: boolean = false; // Previous fullscreen state

    private masked: boolean = false; // For password input
    private inputCtrl: boolean = false; // Ctrl key state for input
    // Tab Completion Data
    private reqTab: boolean = false;
    private wantTab: boolean = false;
    private tabIndex: number = -1;
    private tabValues: string[] = [];
    private buffer: string = ''; // General buffer, often for input
    private inp_buffer: string = ''; // Buffer for input element value during type changes


    // For settings popup, if re-integrated
    private settings: HTMLElement | undefined;
    private set_cont: HTMLElement | undefined;
    private set_mid: HTMLElement | undefined;
    private stbutton: number = -1; // Assuming this was a toolbar button ID for settings

    // For generic popup
    public popup: HTMLElement | undefined;
    private headerdrag: dragObject | undefined;
    private popupheader: HTMLElement | undefined;


    constructor(decaf: DecafMUDInstanceInterface) {
        this.decaf = decaf;
        const si = this; // For event handlers if needed, though .bind or arrow functions are preferred

        let containerOption = decaf.options.set_interface.container;
        if (typeof containerOption === 'string') {
            const queryResult = document.querySelector(containerOption);
            if (!queryResult) throw new Error(`Container element "${containerOption}" not found.`);
            this.container = queryResult as HTMLElement;
        } else if (containerOption && 'nodeType' in containerOption) {
            this.container = containerOption as HTMLElement;
        } else {
            throw new Error("The container must be a valid DOM node or a selector string.");
        }

        this.container.setAttribute('role', 'application');
        this.container.className += ' decafmud mud interface';

        this.el_display = document.createElement('div');
        this.el_display.className = 'decafmud mud-pane primary-pane';
        this.el_display.setAttribute('role', 'log');
        this.el_display.setAttribute('tabIndex', '0');
        this.container.appendChild(this.el_display);

        this.sidebar = document.createElement('div');
        this.sidebar.className = 'decafmud mud-pane side-pane';
        this.sidebar.setAttribute('tabIndex', '1');
        this.container.appendChild(this.sidebar);

        this.progresstable = document.createElement('table');
        this.progresstable.style.display = 'none';
        this.sidebar.appendChild(this.progresstable);

        this.mapdiv = document.createElement('div');
        this.mapdiv.style.display = 'none';
        this.sidebar.appendChild(this.mapdiv);

        this.el_display.onmouseup = (e) => this.maybeFocusInput(e as MouseEvent);
        addEvent(this.el_display, 'keydown', (e) => si.displayKey(e as KeyboardEvent));
        addEvent(this.sidebar, 'keydown', (e) => si.displayKey(e as KeyboardEvent));

        this._input = document.createElement('div');
        this._input.className = 'decafmud input-cont';

        this.tray = document.createElement('div');
        this.tray.className = 'decafmud icon-tray';
        this._input.appendChild(this.tray);

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'decafmud toolbar';
        this.toolbar.setAttribute('role', 'toolbar');
        const h = function(this: HTMLElement) { if (!this.className) { return; } this.className = this.className.replace(' visible', ''); };
        addEvent(this.toolbar, 'mousemove', h.bind(this.toolbar)); // Bind context
        addEvent(this.toolbar, 'blur', h.bind(this.toolbar)); // Bind context

        this.input = document.createElement('input');
        this.input.id = "inputelement";
        // Assuming `tr` is a method on DecafMUD instance, or a global function
        this.input.title = this.decaf.tr ? this.decaf.tr("MUD Input") : "MUD Input";
        this.input.type = 'text';
        this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);

        addEvent(this.input, 'keydown', (e) => si.handleInput(e as KeyboardEvent));
        const blurFocusHelper = (e: FocusEvent) => { si.handleBlur(e); };
        addEvent(this.input, 'blur', blurFocusHelper);
        addEvent(this.input, 'focus', blurFocusHelper);

        for (let i = 0; i < 100; i++) this.history[i] = '';

        this.reset();

        addEvent(window, 'resize', (e) => this.resizeScreenFromEvent('window resize', e));

        if ("onhelp" in window) { // IE specific
            (window as any).onhelp = function() { return false; };
        }
        window.onbeforeunload = (e) => this.unloadPageFromEvent(e);

        this.input.focus();
    }

    public toString(): string {
        return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#' + this.container.id + ')' : '') + '>';
    }
// Defaults from prototype are now initialized in class properties or constructor

// Splash Functionality
    public initSplash(percentage: number = 0, message?: string): void {
        if (message === undefined) {
            message = (this.decaf.tr ? this.decaf.tr('Discombobulating interface recipient...') : 'Discombobulating interface recipient...');
        }

        this.old_y = this.el_display.style.overflowY;
        this.el_display.style.overflowY = 'hidden';

        this.splash = document.createElement('div');
        this.splash.className = 'decafmud splash';

        this.splash.innerHTML = `<h2 class="decafmud heading"><a href="http://decafmud.stendec.me/">DecafMUD</a> <span class="version">v${(DecafMUD as any).version}</span></h2>`;

        const splash_pg = document.createElement('div');
        this.splash_pgi = document.createElement('div'); // Store this on the instance
        this.splash_pgt = document.createElement('div'); // Store this on the instance

        splash_pg.className = 'decafmud progress';
        splash_pg.setAttribute('role', 'progressbar');
        splash_pg.setAttribute('aria-valuemax', '100');
        splash_pg.setAttribute('aria-valuemin', '0');
        splash_pg.setAttribute('aria-valuenow', percentage.toString());
        const percentText = (this.decaf.tr ? this.decaf.tr('{0}%', percentage) : `${percentage}%`);
        splash_pg.setAttribute('aria-valuetext', percentText);

        this.splash_pgi.className = 'decafmud inner-progress';
        this.splash_pgi.style.width = `${percentage}%`;
        splash_pg.appendChild(this.splash_pgi);

        this.splash_pgt.className = 'decafmud progress-text';
        this.splash_pgt.innerHTML = percentText;
        splash_pg.appendChild(this.splash_pgt);

        this.splash.appendChild(splash_pg);

        this.splash_st = document.createElement('div');
        this.splash_st.className = 'decafmud status';
        this.splash_st.innerHTML = message;
        this.splash.appendChild(this.splash_st);

        this.splash_old = document.createElement('div');
        this.splash_old.className = 'decafmud old';
        this.splash.appendChild(this.splash_old);

        this.container.appendChild(this.splash);
    }

    public endSplash(): void {
        if (this.splash) {
            this.container.removeChild(this.splash);
        }
        this.el_display.style.overflowY = this.old_y;
        this.splash_err = false;
        this.splash = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
    }

    public updateSplash(percentage?: number, message?: string): void {
        if (this.splash === null || this.splash_err) { return; }
        if (percentage !== undefined && this.splash_pgi && this.splash_pgt) {
            const t = (this.decaf.tr ? this.decaf.tr('{0}%', percentage) : `${percentage}%`);
            (this.splash_pgi.parentNode as HTMLElement).setAttribute('aria-valuenow', percentage.toString());
            (this.splash_pgi.parentNode as HTMLElement).setAttribute('aria-valuetext', t);
            this.splash_pgt.innerHTML = t;
            this.splash_pgi.style.width = `${percentage}%`;
        }
        if (!message || !this.splash_st || !this.splash_old) { return; }

        const e = document.createElement('div');
        let currentStatusText = this.splash_st.innerHTML;
        if (currentStatusText.endsWith('...')) { currentStatusText += 'done.'; }
        e.innerHTML = currentStatusText;
        this.splash_old.insertBefore(e, this.splash_old.firstChild);
        this.splash_st.innerHTML = message;
    }

    public splashError(message: string): boolean {
        if (this.splash === null || !this.splash_pgt || !this.splash_pgi || !this.splash_st) { return false; }
        this.splash_pgt.innerHTML = '<b>Error</b>';
        this.splash_pgi.className += ' error';
        this.splash_st.innerHTML = message;
        this.splash_err = true;
        return true;
    }

    public showSize(): void {
        if (this.sizetm !== undefined) clearTimeout(this.sizetm);
        if (this.display === undefined) { return; }

        if (this.sizeel === undefined) {
            this.sizeel = document.createElement('div');
            this.sizeel.className = 'decafmud note center';
            this.container.appendChild(this.sizeel);
        }

        const sz = this.display.getSize();
        this.sizeel.style.opacity = '1';
        this.sizeel.innerHTML = (this.decaf.tr ? this.decaf.tr("{0}x{1}", sz[0], sz[1]) : `${sz[0]}x${sz[1]}`);

        this.sizetm = window.setTimeout(() => this.hideSize(), 500);
    }

    private hideSize(fnl: boolean = false): void {
        if (this.sizetm !== undefined) clearTimeout(this.sizetm);
        if (!this.sizeel) return;

        if (fnl === true) {
            if (this.decaf.telopt[this.decaf.TN.NAWS] !== undefined) {
                try { this.decaf.telopt[this.decaf.TN.NAWS].send(); }
                catch (err) { /* Ignore error */ }
            }
            if (this.sizeel.parentNode === this.container) {
                 this.container.removeChild(this.sizeel);
            }
            this.sizeel = undefined;
            return;
        }

        this.sizeel.style.cssText = '-webkit-transition: opacity 0.25s linear; -moz-transition: opacity 0.25s linear; -o-transition: opacity 0.25s linear; transition: opacity 0.25s linear;';

        window.setTimeout(() => { if (this.sizeel) this.sizeel.style.opacity = '0'; }, 0);
        this.sizetm = window.setTimeout(() => this.hideSize(true), 250);
    }

// Status Notifications (and Stuff)
    public print_msg(txt: string): void {
        if (this.display) {
            this.display.message("<span class=\"c6\">" + txt + "</span>");
        }
    }

    public connected(): void {
        const msg = this.decaf.tr ? this.decaf.tr("DecafMUD is currently connected.") : "DecafMUD is currently connected.";
        this.updateIcon(this.ico_connected, msg, '', 'connectivity connected');
    }

    public connecting(): void {
        const msgConnecting = this.decaf.options.set_interface.msg_connecting;
        this.print_msg(this.decaf.tr ? this.decaf.tr(msgConnecting) : msgConnecting);

        if (this.decaf.options.set_interface.connect_hint) {
            let hintMsg: string;
            if (this.decaf.options.socket == "websocket") {
                hintMsg = "<span>You are connecting using <i>websockets</i> " +
                    `on port ${this.decaf.options.set_socket.wsport}. If this does ` +
                    "not work (for example because the port is blocked or you have an " +
                    "older version of websockets), you can connecting with flash. To do " +
                    "so, open <a href=\"web_client.html?socket=flash\">the flash version</a> " +
                    "instead.</span>";
            } else {
                hintMsg = "<span>You are connecting using <i>flash</i> " +
                    `on port ${this.decaf.options.port}. To connect using ` +
                    "websockets, make sure you have an up-to-date browser which " +
                    "supports this, and open " +
                    "<a href=\"web_client.html?socket=websocket\">the websocket version</a> " +
                    "instead.</span>";
            }
            if (this.display) this.display.message(hintMsg);
        }
        const attemptingConnectMsg = this.decaf.tr ? this.decaf.tr("DecafMUD is attempting to connect.") : "DecafMUD is attempting to connect.";
        this.updateIcon(this.ico_connected, attemptingConnectMsg, '', 'connectivity connecting');
    }

    public disconnected(): void {
        this.print_msg("Connection closed.");
        const notConnectedMsg = this.decaf.tr ? this.decaf.tr("DecafMUD is currently not connected.") : "DecafMUD is currently not connected.";
        this.updateIcon(this.ico_connected, notConnectedMsg, '', 'connectivity disconnected');
    }

    public unloadPageFromEvent(e?: BeforeUnloadEvent): string | undefined {
        if (this.decaf.connected) {
            const confirmationMessage = "You are still connected.";
            if (e) e.returnValue = confirmationMessage; // Standard for most browsers
            return confirmationMessage; // For older browsers
        }
        return undefined;
    }

// Initialization
    public load(): void {
        this.decaf.require('decafmud.display.' + this.decaf.options.display);
    }

    public reset(): void {
        this.masked = false;
        this.inputCtrl = false;
        this.inpFocus = false; // Changed from this.hasFocus
        this.reqTab = false;
        this.wantTab = false;
        this.tabIndex = -1;
        this.tabValues = [];
        this.buffer = '';
        if (this.input) {
            this.updateInput();
        }
        if (this.display) {
            this.display.reset();
        }
    }

    public setup(): void {
        this.store = this.decaf.store.sub('ui');
        // this.storage = this.store; // this.storage is not a defined property, perhaps it meant this.store?

        this.old_tbarpos = this.store.get('toolbar-position', 'top-left');
        this.toolbar.className += ' ' + this.old_tbarpos;
        this.container.insertBefore(this.toolbar, this.container.firstChild);

        const displayPluginName = this.decaf.options.display;
        this.decaf.debugString('Initializing display plugin "' + displayPluginName + '"', 'info');
        // Assuming DecafMUD.plugins.Display[pluginName] is a constructor
        this.display = new (DecafMUD as any).plugins.Display[displayPluginName](this.decaf, this, this.el_display);
        (this.display as any).id = 'mud-display'; // If display object can have an id
        this.decaf.display = this.display;

        const menus = get_menus(); // Assumed global
        for (let i = 0; i < menus.length; i += 3) {
            this.tbNew(
                menus[i],
                (this.decaf.tr ? this.decaf.tr(menus[i + 1]) : menus[i + 1]),
                undefined,
                (this.decaf.tr ? this.decaf.tr(menus[i + 2]) : menus[i + 2]),
                1,
                true,
                false,
                undefined,
                ((idx: number) => (e: Event) => { toggle_menu(idx / 3); })(i) // Closure for index
            );
        }

        this.goFullOnResize = this.store.get('fullscreen-auto', false); // Defaulted to false as in original
        const fs = this.store.get('fullscreen-start', this.decaf.options.set_interface.start_full);

        const disconnectedMsg = this.decaf.tr ? this.decaf.tr("You are currently disconnected.") : "You are currently disconnected.";
        this.ico_connected = this.addIcon(disconnectedMsg, '', 'connectivity disconnected');

        if (fs) {
            this.enter_fs(false);
        } else {
            if (!this._resizeToolbar()) {
                this.resizeScreen(false);
            }
        }
    }

// Toolbar Functions
    public tbDelete(id: number): void {
        if (this.toolbuttons[id] === undefined) { return; }
        const btnArray = this.toolbuttons[id];
        if (btnArray && btnArray[0].parentNode) {
            btnArray[0].parentNode.removeChild(btnArray[0]);
        }
        delete this.toolbuttons[id]; // More robust than setting to undefined
        this._resizeToolbar();
    }

    public tbText(id: number, text: string): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        if (!text) { throw new Error("Text can't be empty/false/null/whatever."); }
        btnArray[0].innerHTML = text;
        if (btnArray[3] === undefined) { // If no tooltip, set title to text
            btnArray[3] = text;
            btnArray[0].title = text;
        }
    }

    public tbTooltip(id: number, tooltip?: string): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        btnArray[3] = tooltip;
        btnArray[0].title = tooltip ? tooltip : btnArray[1]; // Use text if tooltip is empty
    }

    public tbEnabled(id: number, enabled: boolean): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        btnArray[5] = enabled; // enabled state
        btnArray[0].setAttribute('aria-disabled', (!enabled).toString());
        if (enabled) {
            btnArray[0].className = btnArray[0].className.replace(' disabled', '');
        } else if (!btnArray[0].className.includes('disabled')) {
            btnArray[0].className += ' disabled';
        }
    }

    public tbPressed(id: number, pressed: boolean): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        btnArray[6] = pressed; // pressed state
        btnArray[0].setAttribute('aria-pressed', pressed.toString());
        if (pressed) {
            if (btnArray[0].className.includes('toggle-depressed')) {
                btnArray[0].className = btnArray[0].className.replace(' toggle-depressed', ' toggle-pressed');
            }
        } else {
            if (btnArray[0].className.includes('toggle-pressed')) {
                btnArray[0].className = btnArray[0].className.replace(' toggle-pressed', ' toggle-depressed');
            }
        }
    }

    public tbClass(id: number, clss?: string): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        const old_clss = btnArray[7];
        btnArray[7] = clss;
        if (old_clss) { btnArray[0].className = btnArray[0].className.replace(' ' + old_clss, ''); }
        if (clss) { btnArray[0].className += ' ' + clss; }
    }

    public tbIcon(id: number, icon?: string): void {
        const btnArray = this.toolbuttons[id];
        if (btnArray === undefined) { throw new Error("Invalid button ID."); }
        btnArray[2] = icon; // icon path
        if (icon) {
            if (!btnArray[0].className.includes(' icon')) { btnArray[0].className += ' icon'; }
            btnArray[0].style.backgroundImage = `url(${icon})`;
        } else {
            btnArray[0].className = btnArray[0].className.replace(' icon', '');
            btnArray[0].style.backgroundImage = '';
        }
    }

    public tbNew(
        btnid: string, text: string, icon?: string, tooltip?: string, type?: number,
        enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void
    ): number {
        // Handle overloaded signature where icon is the callback
        if (typeof icon === 'function') {
            onclick = icon as unknown as (e: Event) => void;
            icon = tooltip as string | undefined; // icon is actually tooltip
            tooltip = type as string | undefined;   // tooltip is type
            type = enabled as number | undefined;     // type is enabled
            enabled = pressed as boolean | undefined;   // enabled is pressed
            pressed = clss as boolean | undefined;    // pressed is clss
            clss = onclick as any; // clss is old onclick (now undefined)
        }

        const ind = ++this.toolbutton_id;
        const btn = document.createElement('span');
        btn.id = btnid;
        btn.className = 'decafmud button toolbar-button';
        if (clss) { btn.className += ' ' + clss; }
        if (type === 1) { btn.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }

        btn.innerHTML = text;
        btn.title = tooltip ? tooltip : text;
        enabled = (enabled !== false); // Default to true
        if (!enabled) { btn.className += ' disabled'; }
        btn.setAttribute('tabIndex', '0');

        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-disabled', (!enabled).toString());
        if (type === 1) { btn.setAttribute('aria-pressed', (!!pressed).toString()); }

        if (icon) {
            btn.style.backgroundImage = `url(${icon})`;
            btn.className += ' icon';
        }

        if (onclick) {
            const si = this; // Keep reference to PanelsInterface instance
            const helper = (e: Event) => {
                if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { return; }
                const currentBtnArray = si.toolbuttons[ind];
                if (currentBtnArray && currentBtnArray[5] !== true) { return; } // Check if enabled

                onclick.call(si, e); // Call with PanelsInterface context
                if (e.type && e.type !== 'keydown') { (e.currentTarget as HTMLElement).blur(); }
            };
            addEvent(btn, 'click', helper);
            addEvent(btn, 'keydown', helper);
        }

        addEvent(btn, 'focus', function(this: HTMLElement, e: FocusEvent) {
            if (!this.parentNode) { return; }
            if ((this.parentNode as HTMLElement).className.includes('toolbar')) {
                (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', this.id);
                (this.parentNode as HTMLElement).className += ' visible';
            }
        });
        addEvent(btn, 'blur', function(this: HTMLElement, e: FocusEvent) {
            if (!this.parentNode) { return; }
            if ((this.parentNode as HTMLElement).className.includes('toolbar')) {
                if ((this.parentNode as HTMLElement).getAttribute('aria-activedescendant') === this.id) {
                    (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', '');
                }
                this.parentNode.className = (this.parentNode as HTMLElement).className.replace(' visible', '');
            }
        });

        this.toolbuttons[ind] = [btn, text, icon, tooltip, type || 0, enabled, !!pressed, clss, onclick];
        btn.setAttribute('button-id', ind.toString());
        this.toolbar.appendChild(btn);
        this._resizeToolbar();
        return ind;
    }

    private _resizeToolbar(): boolean {
        let ret = false;
        if (this.display && this.toolbarPadding !== this.toolbar.clientHeight) {
            this.display.shouldScroll();
            this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px';
            this.toolbarPadding = this.toolbar.clientHeight;
            this.resizeScreen(false, true);
            this.display.doScroll();
            ret = true;
        } else {
            this.toolbarPadding = this.toolbar.clientHeight;
        }
        return ret;
    }

// Scroll Button
    public showScrollButton(): void {
        if (this.scrollButton !== undefined) { return; }
        const sb = document.createElement('div');
        sb.className = 'button scroll-button';
        sb.setAttribute('tabIndex', '0');
        sb.innerHTML = this.decaf.tr ? this.decaf.tr("More") : "More";

        const helper = (e: Event) => {
            if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { return; }
            if (this.display) this.display.scrollNew();
        };
        addEvent(sb, 'click', helper);
        addEvent(sb, 'keydown', helper);

        this.scrollButton = sb;
        this.container.appendChild(sb);
        sb.style.bottom = (this._input.offsetHeight + 12) + 'px';
    }

    public hideScrollButton(): void {
        if (this.scrollButton === undefined) { return; }
        if (this.scrollButton.parentNode) {
            this.scrollButton.parentNode.removeChild(this.scrollButton);
        }
        this.scrollButton = undefined;
    }

// Information Bar
    public infoBar(
        text: string, clssOrTimeout?: string | number, timeoutOrIcon?: number | string,
        iconOrButtons?: string | [string, (e: Event) => void][], buttonsOrClick?: [string, (e: Event) => void][] | ((e: Event) => void),
        clickOrClose?: ((e: Event) => void) | ((e: Event) => void), closeHandler?: (e: Event) => void
    ): void {
        let clss: string, timeout: number, icon: string | undefined, buttons: [string, (e: Event) => void][] | undefined, click: ((e: Event) => void) | undefined;

        if (typeof clssOrTimeout === 'number') {
            clss = timeoutOrIcon as string || 'info';
            timeout = clssOrTimeout;
            icon = iconOrButtons as string | undefined;
            buttons = buttonsOrClick as [string, (e: Event) => void][] | undefined;
            click = clickOrClose as ((e: Event) => void) | undefined;
            closeHandler = closeHandler; // already correct
        } else {
            clss = clssOrTimeout || 'info';
            timeout = timeoutOrIcon as number || 0;
            icon = iconOrButtons as string | undefined;
            buttons = buttonsOrClick as [string, (e: Event) => void][] | undefined;
            click = clickOrClose as ((e: Event) => void) | undefined;
            // closeHandler is the last argument if click is also provided
        }

        const ibarItem: InfoBarItem = {
            text: text,
            class: clss,
            timeout: timeout,
            icon: icon,
            buttons: buttons,
            click: click,
            close: closeHandler || (click && typeof clickOrClose === 'function' ? clickOrClose : undefined)
        };
        this.infobars.push(ibarItem);
        if (this.ibar === undefined) {
            this.createIBar();
        }
    }

    public immediateInfoBar(
        text: string, clss?: string | number, timeout?: number | string,
        icon?: string | [string, (e: Event) => void][], buttons?: [string, (e: Event) => void][] | ((e: Event) => void),
        click?: ((e: Event) => void) | ((e: Event) => void), close?: (e: Event) => void
    ): boolean {
        if (this.ibar !== undefined) { return false; }
        this.infoBar(text, clss, timeout, icon, buttons, click, close);
        return true;
    }

    private createIBar(): void {
        if (this.infobars.length === 0) return;
        const ibarData = this.infobars[0];
        const obj = document.createElement('div');
        obj.setAttribute('role', 'alert');
        obj.className = `decafmud infobar ${ibarData.class}`;
        obj.innerHTML = ibarData.text;
        obj.style.top = '-50px'; // Start off-screen for slide-in animation

        const si = this; // For callbacks

        if (ibarData.click) {
            obj.className += ' clickable';
            obj.setAttribute('tabIndex', '0');
        }

        const closer = (e: Event) => {
            if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 && (e as KeyboardEvent).keyCode !== 27) { return; }
            if (e.type === 'click' && !ibarData.click) { return; }

            if (e.stopPropagation) e.stopPropagation(); else (e as any).cancelBubble = true;

            si.closeIBar(true); // Close immediately

            if (e.type === 'keydown' && (e as KeyboardEvent).keyCode === 27) {
                if (ibarData.close) ibarData.close.call(si, e);
                return;
            }
            if (ibarData.click) ibarData.click.call(si, e);
        };
        addEvent(obj, 'click', closer);
        addEvent(obj, 'keydown', closer);

        const closebtn = document.createElement('div');
        closebtn.innerHTML = 'X';
        closebtn.className = 'close';
        closebtn.setAttribute('tabIndex', '0');
        const closeHelper = (e: Event) => {
            if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { return; }
            if (e.stopPropagation) e.stopPropagation(); else (e as any).cancelBubble = true;
            si.closeIBar(true);
            if (ibarData.close) ibarData.close.call(si, e);
        };
        addEvent(closebtn, 'click', closeHelper);
        addEvent(closebtn, 'keydown', closeHelper);
        obj.insertBefore(closebtn, obj.firstChild);

        if (ibarData.buttons) {
            const btncont = document.createElement('div');
            btncont.className = 'btncont';
            ibarData.buttons.forEach(btnData => {
                const b = document.createElement('a'); // Changed to 'a' for styling as button
                b.className = 'button';
                b.href = '#'; // Prevent page jump
                b.setAttribute('onclick', 'return false;'); // Prevent page jump
                b.innerHTML = btnData[0];
                addEvent(b, 'click', (e: Event) => {
                    si.closeIBar(true);
                    setTimeout(() => { btnData[1].call(si, e); }, 0);
                    if (e.stopPropagation) e.stopPropagation(); else (e as any).cancelBubble = true;
                    return false;
                });
                btncont.appendChild(b);
            });
            obj.insertBefore(btncont, closebtn);
        }

        this.ibar = obj;
        ibarData.el = obj;
        this.container.insertBefore(obj, this.container.firstChild);

        setTimeout(() => {
            let pt = 0;
            const computedStyle = window.getComputedStyle ? window.getComputedStyle(obj, null) : (obj as any).currentStyle;
            if (computedStyle) pt = parseInt(computedStyle.paddingTop || '0', 10);

            if (si.toolbarPadding) { pt += si.toolbarPadding -10; } // Adjust based on toolbar
            obj.style.backgroundPosition = `5px ${pt}px`;
            obj.style.paddingTop = `${pt}px`;
            obj.style.transition = 'top 0.2s linear, opacity 0.25s linear'; // Added opacity transition
            obj.style.top = '0px'; // Slide in
        }, 0);

        if (ibarData.timeout > 0) {
            this.ibartimer = window.setTimeout(() => si.closeIBar(), 1000 * ibarData.timeout);
        }
    }

    private closeIBar(immediate: boolean = false): void {
        if (!this.ibar) { return; }
        if (this.ibartimer) clearTimeout(this.ibartimer);
        this.ibartimer = undefined;

        const currentIbarElement = this.ibar; // Capture for use in timeout

        if (!immediate) {
            currentIbarElement.style.opacity = '0';
            this.ibartimer = window.setTimeout(() => this.closeIBar(true), 250);
            return;
        }

        if (currentIbarElement.parentNode) {
            currentIbarElement.parentNode.removeChild(currentIbarElement);
        }
        this.ibar = undefined;
        this.infobars.shift();

        if (this.infobars.length > 0) {
            this.createIBar();
        }
    }

// Notification Icons
    public addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number {
        const ico = document.createElement('div');
        ico.className = `decafmud status-icon ${clss} ${onclick ? 'icon-click' : ''}`;
        ico.innerHTML = html;
        ico.title = text;
        ico.setAttribute('role', 'status');
        ico.setAttribute('aria-label', text);

        if (onclick || onkey) { ico.setAttribute('tabIndex', '0'); }

        const ind = this.icons.push([ico, onclick, onkey]) - 1;

        this.icons.forEach((iconArr, i) => {
            iconArr[0].style.right = `${((this.icons.length - 1 - i) * 21)}px`;
        });

        this.tray.appendChild(ico);
        const si = this;
        if (onclick) { addEvent(ico, 'click', (e) => onclick.call(si, e)); }
        if (onclick && !onkey) {
            addEvent(ico, 'keydown', (e) => {
                if ((e as KeyboardEvent).keyCode !== 13) { return; }
                onclick.call(si, e);
            });
        }
        if (onkey) { addEvent(ico, 'keydown', (e) => onkey.call(si, e as KeyboardEvent)); }

        this._resizeTray();
        return ind;
    }

    public delIcon(ind: number): void {
        if (ind < 0 || ind >= this.icons.length) { throw new Error("Invalid index for icon!"); }
        const iconArray = this.icons[ind];
        if (iconArray && iconArray[0] && iconArray[0].parentNode) {
            iconArray[0].parentNode.removeChild(iconArray[0]);
        }
        this.icons.splice(ind, 1);
        this.icons.forEach((iconArr, i) => {
            iconArr[0].style.right = `${((this.icons.length - 1 - i) * 21)}px`;
        });
        this._resizeTray();
    }

    public updateIcon(ind: number, text?: string, html?: string, clss?: string): void {
        if (ind < 0 || ind >= this.icons.length) { throw new Error("Invalid index for icon!"); }
        const iconArr = this.icons[ind];
        const el = iconArr[0];
        const onclick = iconArr[1];

        if (clss) { el.className = `decafmud status-icon ${clss} ${onclick ? 'icon-click' : ''}`; }
        if (html !== undefined) { el.innerHTML = html; } // Allow empty string
        if (text) {
            el.title = text;
            el.setAttribute('aria-label', text);
        }
    }

    private _resizeTray(): void {
        const w = this.tray.clientWidth;
        this._input.style.paddingRight = `${w}px`;
    }

// Element Sizing
// Element Sizing
    public click_fsbutton(e: MouseEvent): void {
        if (this.container.className.indexOf('fullscreen') === -1) {
            this.enter_fs();
        } else {
            this.exit_fs();
        }
    }

    public enter_fs(showSize: boolean = true): void {
        if (this.container.className.includes('fullscreen')) { return; }

        const has_focus = this.inpFocus;
        if (this.display) { this.display.shouldScroll(false); }

        this.oldscrollY = window.scrollY;
        this.oldscrollX = window.scrollX;

        if (this.container.parentNode) {
            this.old_parent = this.container.parentNode as HTMLElement;
            this.next_sib = this.container.nextElementSibling;
            this.old_parent.removeChild(this.container);
        }

        this.container.className += ' fullscreen';

        this.old_children = [];
        this.old_display_styles = [];
        Array.from(document.body.children).forEach(child => {
            if (child.id !== '_firebugConsole' && child.id.indexOf('DecafFlashSocket') !== 0) {
                this.old_children.push(child as HTMLElement);
                this.old_display_styles.push((child as HTMLElement).style.display);
                (child as HTMLElement).style.display = 'none';
            }
        });

        this.old_body_over = document.body.style.overflow;
        if (!bodyHack) { document.body.style.overflow = 'hidden'; }
        document.body.appendChild(this.container);

        window.scroll(0, 0);

        this._resizeToolbar();
        this.resizeScreen(showSize, false);
        if (showSize !== false) { this.showSize(); }

        if (has_focus && this.input) { (this.input as HTMLElement).focus(); }
        if (this.display) { this.display.doScroll(); }
    }

    public exit_fs(): void {
        if (this.old_parent === undefined) { return; }

        const has_focus = this.inpFocus;
        if (this.display) { this.display.shouldScroll(false); }

        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.old_children.forEach((child, i) => {
            child.style.display = this.old_display_styles[i];
        });
        this.old_children = [];
        this.old_display_styles = [];

        this.container.className = this.container.className.replace(' fullscreen', '').trim();

        if (this.next_sib) {
            this.old_parent.insertBefore(this.container, this.next_sib);
        } else {
            this.old_parent.appendChild(this.container);
        }
        this.old_parent = undefined;
        this.next_sib = undefined;


        document.body.style.overflow = this.old_body_over;
        if (this.oldscrollX !== undefined && this.oldscrollY !== undefined) {
             window.scroll(this.oldscrollX, this.oldscrollY);
        }

        this._resizeToolbar();
        this.showSize();

        if (has_focus && this.input) { (this.input as HTMLElement).focus(); }
        if (this.display) { this.display.doScroll(); }
    }

    public resizeScreen(showSize: boolean = true, force: boolean = false): void {
        if (this.goFullOnResize) {
            const fs = (window as any).fullScreen === true || (window.screen.height - window.innerHeight <= 5);
            if (fs && !this.old_fs) {
                this.old_fs = fs; this.enter_fs(); return;
            } else if (!fs && this.old_fs) {
                this.old_fs = fs; this.exit_fs(); return;
            }
            this.old_fs = fs;
        }

        if (force !== true && this.old_height === this.container.offsetHeight && this.old_width === this.container.offsetWidth) { return; }

        if (this.popup) this.hidePopup(); // don't bother resizing any open popups

        this.old_height = this.container.offsetHeight;
        this.old_width = this.container.offsetWidth;

        let tot = this.old_height - (this._input.offsetHeight + 17);
        if (this.toolbarPadding) { tot = tot - (this.toolbarPadding - 12); }
        if (tot < 0) { tot = 0; }

        // This part seems to refer to `set_mid` which was part of a commented out showSettings
        // if (this.popup && this.set_mid) { this.set_mid.style.height = tot + 'px'; }

        if (this.toolbarPadding) {
            tot -= 12;
            if (tot < 0) { tot = 0; }
        }

        this.el_display.style.height = tot + 'px';
        if (force !== true && this.display) { this.display.scroll(); }

        if (this.scrollButton) {
            this.scrollButton.style.bottom = (this._input.offsetHeight + 12) + 'px';
        }

        if (showSize !== false) {
            this.showSize();
        }
    }

    public resizeScreenFromEvent(source: string, event: Event): void {
        this.resizeScreen(true, false);
    }

// Sidebar
    public showSidebar(): void { this.sidebar.style.display = 'inline'; }
    public hideSidebar(): void { this.sidebar.style.display = 'none'; }
    public showProgressBars(): void {
        this.progresstable.style.display = 'inline';
        this.progresstable.style.height = "auto";
    }
    public hideProgressBars(): void {
        this.progresstable.style.display = 'none';
        this.progresstable.style.height = "0";
    }
    public showMap(): void { this.mapdiv.style.display = 'inline'; }
    public hideMap(): void { this.mapdiv.style.display = 'none'; }

    public addProgressBar(name: string, col: string): void {
        const w = 100; const h = 20;
        const tr = document.createElement("tr"); this.progresstable.appendChild(tr);
        let td = document.createElement("td"); tr.appendChild(td); td.innerHTML = name + ":";
        td = document.createElement("td"); tr.appendChild(td);

        const bar = document.createElement("div");
        bar.style.width = w + 'px'; bar.style.height = h + 'px';
        bar.style.backgroundColor = 'white'; bar.style.padding = '0px';

        const progress = document.createElement("div");
        progress.style.width = "0px"; progress.style.height = h + 'px';
        progress.style.backgroundColor = col; progress.style.color = "black";
        progress.style.padding = "0px"; progress.style.overflow = "hidden";
        progress.style.overflowX = "visible";

        const info = document.createElement("div");
        info.style.width = bar.style.width; info.style.height = bar.style.height;
        info.style.marginTop = (-h) + "px"; info.style.textAlign = "center";
        info.style.paddingTop = "3px"; info.style.fontWeight = "bold";
        info.style.color = "black";

        td.appendChild(bar); bar.appendChild(progress); td.appendChild(info);
        this.progressbars.push([name, progress, info]);
    }

    public setProgress(name: string, percent: number, txt: string): void {
        const w = 100;
        for (let i = 0; i < this.progressbars.length; i++) {
            if (this.progressbars[i][0] === name) {
                this.progressbars[i][1].style.width = (percent * w / 100) + "px";
                this.progressbars[i][2].innerHTML = txt;
            }
        }
    }
    public setProgressColor(name: string, col: string): void {
        for (let i = 0; i < this.progressbars.length; i++) {
            if (this.progressbars[i][0] === name) {
                this.progressbars[i][1].style.backgroundColor = col;
            }
        }
    }
    public printMap(txt: string): void {
        this.mapdiv.innerHTML = "<hr><i>Map:</i><center>" + txt + "</center>";
    }

// Popups
    public maxPopupHeight(): number {
        let tot = this.container.offsetHeight - (this._input.offsetHeight + 50);
        if (this.toolbarPadding) { tot -= (this.toolbarPadding - 12); }
        return tot < 0 ? 0 : tot;
    }
    public maxPopupWidth(): number {
        let tot = this.container.offsetWidth - 12; // for scrollbar
        return tot < 0 ? 0 : tot;
    }
    public verticalPopupOffset(): number { return 50; }
    public horizontalPopupOffset(): number { return 0; }

    public hidePopup(): void {
        if (!this.popup) return;
        if (this.headerdrag) this.headerdrag.StopListening(true);
        if (this.popup.parentNode) this.popup.parentNode.removeChild(this.popup);
        this.popup = undefined;
        this.headerdrag = undefined;
        this.popupheader = undefined;
        (this.input as HTMLElement).focus();
    }

    public showPopup(): HTMLElement {
        if (this.popup) this.hidePopup();
        this.popup = document.createElement("div");

        let w = this.maxPopupWidth(); let h = this.maxPopupHeight();
        let t = this.verticalPopupOffset(); let l = this.horizontalPopupOffset();
        l += w * 0.2; w *= 0.6; h *= 0.7;

        this.popup.style.width = `${w}px`; this.popup.style.height = `${h}px`;
        this.popup.style.top = `${t}px`; this.popup.style.left = `${l}px`;
        this.popup.className = 'decafmud window'; this.popup.id = "popup";
        this.container.insertBefore(this.popup, this.el_display);

        this.popupheader = document.createElement("div");
        this.popupheader.style.width = `${w}px`; this.popupheader.style.height = "25px";
        this.popupheader.style.top = "0px";
        this.popupheader.className = 'decafmud window-header'; this.popupheader.id = "popupheader";
        this.popup.appendChild(this.popupheader);
        this.headerdrag = new dragObject("popup", "popupheader");

        const x = document.createElement('button');
        x.innerHTML = '<big>X</big>'; x.className = 'closebutton';
        addEvent(x, 'click', (e: Event) => this.hidePopup());
        this.popup.appendChild(x);

        addEvent(this.popup, 'mousedown', (e: Event) => {
            if ((e as MouseEvent).which === 1 && open_menu !== -1) { close_menus(); } // Assumes open_menu & close_menus are global
        });
        return this.popup;
    }

    public popupHeader(text: string): void {
        if (!this.popup) return;
        const p = document.createElement("p");
        p.innerHTML = text; p.className = "headertext";
        this.popup.appendChild(p);
    }

    public buttonLine(par: HTMLElement): HTMLParagraphElement {
        const buttonline = document.createElement("p");
        buttonline.style.textAlign = "center";
        par.appendChild(buttonline);
        return buttonline;
    }

    public createButton(caption: string, func: string | (() => void)): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "prettybutton";
        btn.innerHTML = `<big>${caption}</big>`;
        if (typeof func === 'string') {
            btn.onclick = () => { eval(func); }; // eval is generally discouraged
        } else {
            btn.onclick = func;
        }
        return btn;
    }

    public popupTextarea(name: string, adjust: number): HTMLTextAreaElement {
        if (!this.popup) throw new Error("Popup not shown before creating textarea");
        const w = this.maxPopupWidth() * 0.6 - 15;
        const h = this.maxPopupHeight() * 0.7 - 100 - adjust;
        const textarea = document.createElement("textarea");
        textarea.id = name; textarea.cols = 80; textarea.rows = 20;
        textarea.style.width = `${w}px`; textarea.style.height = `${h}px`;
        textarea.style.margin = "5px";
        this.popup.appendChild(textarea);
        textarea.focus();
        return textarea;
    }

    public popupTextdiv(): HTMLDivElement {
        if (!this.popup) throw new Error("Popup not shown before creating textdiv");
        const w = this.maxPopupWidth() * 0.6 - 10;
        const h = this.maxPopupHeight() * 0.7 - 60;
        const div = document.createElement("div");
        div.style.width = `${w}px`; div.style.height = `${h}px`;
        div.style.margin = "5px"; div.style.overflowY = "auto";
        this.popup.appendChild(div);
        return div;
    }

// Input Element
    public displayInput(text: string): void {
        if (!this.display || !this.echo) { return; }
        this.display.message("<span class=\"command\">" + text + "</span>", 'user-input', false);
    }

    public localEcho(echo: boolean): void {
        if (echo === this.echo) { return; }
        this.echo = echo;
        this.updateInput();
    }

    public maybeFocusInput(e: MouseEvent): void {
        const sel = window.getSelection();
        if (sel && sel.toString() !== '' && sel.focusNode && this.el_display.contains(sel.focusNode.parentNode as Node)) {
            this.decaf.debugString('not focusing this.input: selection active');
            return;
        }
        (this.input as HTMLElement).focus();
    }

    public displayKey(e: KeyboardEvent): void {
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }
        if (!((e.keyCode > 64 && e.keyCode < 91) || (e.keyCode > 47 && e.keyCode < 58) ||
            (e.keyCode > 185 && e.keyCode < 193) || (e.keyCode > 218 && e.keyCode < 223))) {
            return;
        }
        (this.input as HTMLElement).focus();
    }

    private handleInputPassword(e: KeyboardEvent): void {
        if (e.keyCode !== 13) { return; } // Enter key
        this.inpFocus = true;
        this.decaf.sendInput((this.input as HTMLInputElement).value);
        (this.input as HTMLInputElement).value = '';
    }

    public saveInputInHistory(): void {
        const txt = (this.input as HTMLInputElement).value;
        if (txt === "") return;
        if (txt === this.history[0]) return;
        let lastid = -1;
        for (let i = 0; i < this.history.length; i++) {
            if (this.history[i] === txt) {
                lastid = i;
                break;
            }
        }
        if (lastid === -1) lastid = this.history.length - 1;
        for (let i = lastid; i > 0; i--) this.history[i] = this.history[i - 1];
        this.history[0] = txt;
    }

    private inputModified(): boolean {
        const txt = (this.input as HTMLInputElement).value;
        if (this.historyPosition === -1) return txt !== '';
        return txt !== this.history[this.historyPosition];
    }

    private loadInput(): void {
        if (this.historyPosition === -1) (this.input as HTMLInputElement).value = '';
        else {
            (this.input as HTMLElement).focus();
            (this.input as HTMLInputElement).value = this.history[this.historyPosition];
        }
    }

    private parseInput(inp: string): void {
        const lines = inp.split(';;');
        for (let i = 0, c = lines.length; i < c; i++) {
            this.decaf.sendInput(lines[i]);
        }
    }

    public handleInput(e: KeyboardEvent): void {
        if (e.type !== 'keydown') { return; }

        if (e.keyCode === 112 || e.keyCode === 116) { // F1 or F5
            e.preventDefault();
        }

        if (e.keyCode === 13) { // Enter
            this.parseInput((this.input as HTMLInputElement).value);
            this.saveInputInHistory();
            this.historyPosition = -1; // Reset history position after sending
            if (!this.decaf.options.set_interface.repeat_input) {
                (this.input as HTMLInputElement).value = '';
            }
            (this.input as HTMLInputElement).select();
        } else if (typeof window.tryExtraMacro !== 'undefined' && tryExtraMacro(this.decaf, e.keyCode)) {
            if (e.preventDefault) e.preventDefault(); else (e as any).returnValue = false;
        } else if (e.keyCode === 33) { // PgUp
            if (this.display && this.display.scrollUp) { this.display.scrollUp(); e.preventDefault(); }
        } else if (e.keyCode === 34) { // PgDown
            if (this.display && this.display.scrollDown) { this.display.scrollDown(); e.preventDefault(); }
        } else if (e.keyCode === 40) { // ArrowDown
            if (this.inputModified()) this.historyPosition = -1;
            if (this.historyPosition === -1) this.saveInputInHistory(); // Save current if modified
            else if (this.historyPosition > 0) this.historyPosition--; // Move towards more recent
            else if (this.historyPosition === 0) this.historyPosition = -1; // At newest, go to current input line
            this.loadInput();
        } else if (e.keyCode === 38) { // ArrowUp
            if (this.inputModified()) this.historyPosition = -1; // If input changed, current is new top
            if (this.historyPosition === -1) { // Starting to browse from current input
                if ((this.input as HTMLInputElement).value !== '') this.saveInputInHistory();
                this.historyPosition = 0; // Move to the most recent history item
            } else if (this.historyPosition < this.history.length - 1 && this.history[this.historyPosition + 1] !== '') {
                this.historyPosition++; // Move towards older items
            }
            this.loadInput();
        } else if (e.keyCode === 8 && e.shiftKey === true) { // Shift+Backspace
            (this.input as HTMLInputElement).value = '';
        }
    }

    public handleBlur(e: FocusEvent): void {
        const inp = this.input as HTMLInputElement;
        const bc = this.decaf.options.set_interface.blurclass;
        if (e.type === 'blur') {
            if (inp.value === '') {
                inp.className += ' ' + bc;
            }
            // Commented out settings related logic
            // setTimeout(() => {
            //     if (this.settings) {
            //         this.settings.style.top = '0px';
            //         if(this.set_mid) this.set_mid.style.overflowY = 'scroll';
            //     }
            // }, 100);
            this.inpFocus = false;
        } else if (e.type === 'focus') {
            inp.className = inp.className.replace(' ' + bc, '').trim();
            // Commented out settings related logic
            // if (this.settings && this.set_mid) {
            //     const t = -1 * (this.settings.clientHeight * 0.5);
            //     this.settings.style.top = t + 'px';
            //     this.set_mid.style.overflowY = 'hidden';
            // }
            this.inpFocus = true;
        }
    }

    public updateInput(force: boolean = false): void {
        if (!this.input) return;
        const foc = this.inpFocus;
        const currentInput = this.input as HTMLInputElement | HTMLTextAreaElement;
        const currentType = currentInput.tagName === 'TEXTAREA' ? 'text' : (currentInput as HTMLInputElement).type;

        if (force !== true && ((!this.echo && currentType === 'password') || (this.echo && currentType !== 'password'))) {
            return;
        }

        const cl = currentInput.className;
        const st = currentInput.getAttribute('style');
        const id = currentInput.id;
        const par = currentInput.parentNode as HTMLElement;
        const pos = currentInput.nextElementSibling;

        this.inp_buffer = currentInput.value; // Save current value

        let new_inp: HTMLInputElement | HTMLTextAreaElement;

        if (!this.echo) { // Changing to password
            new_inp = document.createElement('input');
            new_inp.type = 'password';
            addEvent(new_inp, 'keydown', (e) => this.handleInputPassword(e as KeyboardEvent));
        } else { // Changing to text or textarea
            const lines = this.inp_buffer ? this.inp_buffer.split('\n').length : 1;
            if (lines === 1 && this.decaf.options.set_interface.multiline === false) { // Explicitly check for multiline option
                new_inp = document.createElement('input');
                new_inp.type = 'text';
            } else {
                new_inp = document.createElement('textarea');
                (new_inp as HTMLTextAreaElement).rows = bodyHack ? lines -1 : lines;
            }
            addEvent(new_inp, 'keydown', (e) => this.handleInput(e as KeyboardEvent));
        }

        if (cl) { new_inp.className = cl; }
        if (st) { new_inp.setAttribute('style', st); }
        if (id) { new_inp.id = id; }

        new_inp.value = this.inp_buffer; // Restore value

        par.removeChild(currentInput);
        if (pos) { par.insertBefore(new_inp, pos); }
        else { par.appendChild(new_inp); }
        this.input = new_inp;

        this.inpFocus = foc;
        const blurFocusHelper = (e: FocusEvent) => { this.handleBlur(e); };
        addEvent(this.input, 'blur', blurFocusHelper);
        addEvent(this.input, 'focus', blurFocusHelper);

        if (this.inpFocus) {
            setTimeout(() => { (this.input as HTMLElement).focus(); (this.input as HTMLInputElement).select?.(); }, 1);
        }
    }
}


// Expose this to DecafMUD
(DecafMUD as any).plugins.Interface.panels = PanelsInterface;
})(DecafMUD);
