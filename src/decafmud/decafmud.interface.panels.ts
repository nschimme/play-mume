// SPDX-License-Identifier: GPL-3.0-or-later
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
 * @fileOverview DecafMUD User Interface: Panels
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

import DecafMUD from './decafmud'; // Assuming DecafMUD is exported from decafmud.ts

// Helper types - consider moving to a central types file later
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) { // Use a different name to avoid conflict with imported DecafMUD

const addEvent = function(node: HTMLElement | Document | Window, etype: string, func: (e: Event) => void): void {
    if ( node.addEventListener ) {
        node.addEventListener(etype, func, false); return;
    }

    etype = 'on' + etype;
    if ( (node as any).attachEvent ) {
        (node as any).attachEvent(etype, func);
    } else {
        (node as any)[etype] = func;
    }
};

const delEvent = function(node: HTMLElement | Document | Window, etype: string, func: (e: Event) => void): void {
    if ( node.removeEventListener ) {
        node.removeEventListener(etype, func, false);
    }
};

const bodyHack: boolean = /Firefox\//.test(navigator.userAgent);

class SimpleInterface {
    decaf: DecafMUDInstance;
    container: HTMLElement;
    el_display: HTMLElement;
    sidebar: HTMLElement;
    progresstable: HTMLTableElement;
    progressbars: any[]; // TODO: Define specific type
    mapdiv: HTMLElement;
    _input: HTMLElement;
    tray: HTMLElement;
    toolbuttons: any = {}; // TODO: Define specific type
    infobars: any[] = []; // TODO: Define specific type
    icons: any[] = []; // TODO: Define specific type
    toolbar: HTMLElement;
    input: HTMLInputElement | HTMLTextAreaElement; // Can be input or textarea
    history: string[];
    historyPosition: number;
    echo: boolean = true;
    inpFocus: boolean = false;
    old_parent: HTMLElement | undefined | null;
    next_sib: Element | undefined | null;
    splash: HTMLElement | null = null;
    splash_st: HTMLElement | null = null;
    splash_pgi: HTMLElement | null = null;
    splash_pgt: HTMLElement | null = null;
    splash_old: HTMLElement | null = null;
    scrollButton: HTMLElement | undefined;
    toolbutton_id: number = -1;
    masked: boolean = false;
    inputCtrl: boolean = false;
    hasFocus: boolean = false;
    reqTab: boolean = false;
    wantTab: boolean = false;
    tabIndex: number = -1;
    tabValues: string[] = [];
    buffer: string = '';
    old_y: string = '';
    splash_err: boolean = false;
    sizeel: HTMLElement | undefined;
    sizetm: NodeJS.Timeout | undefined;
    old_tbarpos: string = '';
    toolbarPadding: number | undefined;
    oldscrollX: number | undefined;
    oldscrollY: number | undefined;
    old_children: HTMLElement[] = [];
    old_display: string[] = [];
    old_body_over: string = '';
    goFullOnResize: boolean = false;
    old_fs: boolean = false;
    old_height: number = -1;
    old_width: number = -1;
    popup: HTMLElement | undefined;
    headerdrag: any; // TODO: Type for dragObject instance
    popupheader: HTMLElement | undefined;
    inp_buffer: string = ''; // Buffer for input value when switching input types
    ibar: HTMLElement | undefined; // Current info bar element
    ibartimer: NodeJS.Timeout | undefined;


    static supports: any = { // Static properties should be part of the class
        'tabComplete'   : true,
        'multipleOut'   : false,
        'fullscreen'    : true,
        'editor'        : false,
        'splash'        : true
    };


    constructor(decaf: DecafMUDInstance) {
        const si = this;
        this.decaf = decaf;

        this.container = decaf.options.set_interface.container;
        if ( typeof this.container === 'string' ) {
            this.container = document.querySelector(this.container) as HTMLElement;
        }
        if (!(this.container && 'nodeType' in this.container )) { // Check if container is a valid Node
            throw "The container must be a node in the DOM!";
        }

        this.container.setAttribute('role', 'application');
        this.container.className += ' decafmud mud interface';

        this.el_display = document.createElement('div');
        this.el_display.className = 'decafmud mud-pane primary-pane';
        this.el_display.setAttribute('role', 'log');
        this.el_display.setAttribute('tabIndex','0');
        this.container.appendChild(this.el_display);

        this.sidebar = document.createElement('div');
        this.sidebar.className = 'decafmud mud-pane side-pane';
        this.sidebar.setAttribute('tabIndex', '1');
        this.container.appendChild(this.sidebar);

        this.progresstable = document.createElement('table');
        this.progresstable.style.display = 'none';
        this.sidebar.appendChild(this.progresstable);
        this.progressbars = [];

        this.mapdiv = document.createElement('div');
        this.mapdiv.style.display = 'none';
        this.sidebar.appendChild(this.mapdiv);

        this.el_display.onmouseup = this.maybeFocusInput.bind(this);
        addEvent(this.el_display,'keydown', (e) => { si.displayKey(e as KeyboardEvent); });
        addEvent(this.sidebar,'keydown', (e) => { si.displayKey(e as KeyboardEvent); });

        this._input = document.createElement('div');
        this._input.className = 'decafmud input-cont';

        this.tray = document.createElement('div');
        this.tray.className = 'decafmud icon-tray';
        this._input.appendChild(this.tray);

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'decafmud toolbar';
        this.toolbar.setAttribute('role','toolbar');
        const h = function(this: HTMLElement){ if(!this.className){return;}this.className = this.className.replace(' visible',''); };
        addEvent(this.toolbar,'mousemove', h as (e: Event) => void);
        addEvent(this.toolbar,'blur', h as (e: Event) => void);

        this.input = document.createElement('input');
        this.input.id = "inputelement";
        this.input.title = "MUD Input".tr(this.decaf);
        this.input.type = 'text';
        this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);

        addEvent(this.input,'keydown', (e) => { si.handleInput(e as KeyboardEvent); });
        const helper = (e: Event) => { si.handleBlur(e as FocusEvent); };
        addEvent(this.input, 'blur', helper);
        addEvent(this.input, 'focus', helper);

        this.history = [];
        this.historyPosition = -1;
        for (let i = 0; i < 100; i++) this.history[i] = '';

        this.reset();
        addEvent(window, 'resize', this.resizeScreenFromEvent.bind(this, 'window resize'));

        if ("onhelp" in window) {
            (window as any).onhelp = function() { return false; };
        }
        window.onbeforeunload = this.unloadPageFromEvent.bind(this);

        this.input.focus();
    }

    toString(): string {
        return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#'+this.container.id+')' : '') + '>';
    }

    initSplash(percentage?: number, message?: string): void {
        if ( percentage === undefined ) { percentage = 0; }
        if ( message === undefined ) { message = 'Discombobulating interface recipient...'.tr(this.decaf); }

        this.old_y = this.el_display.style.overflowY;
        this.el_display.style.overflowY = 'hidden';

        this.splash = document.createElement('div');
        this.splash.className = 'decafmud splash';
        this.splash.innerHTML  = '<h2 class="decafmud heading"><a href="http://decafmud.stendec.me/">DecafMUD</a> <span class="version">v'+DecafMUDGlobal.version+'</span></h2>';

        const splash_pg = document.createElement('div');
        splash_pg.className = 'decafmud progress';
        splash_pg.setAttribute('role','progressbar');
        splash_pg.setAttribute('aria-valuemax', '100');
        splash_pg.setAttribute('aria-valuemin', '0');
        splash_pg.setAttribute('aria-valuenow', String(percentage));
        splash_pg.setAttribute('aria-valuetext', '{0}%'.tr(this.decaf,percentage));
        this.splash_pgi = document.createElement('div');
        this.splash_pgi.className = 'decafmud inner-progress';
        this.splash_pgi.style.cssText = 'width:'+percentage+'%;';
        splash_pg.appendChild(this.splash_pgi);
        this.splash_pgt = document.createElement('div');
        this.splash_pgt.className = 'decafmud progress-text';
        this.splash_pgt.innerHTML = '{0}%'.tr(this.decaf,percentage);
        splash_pg.appendChild(this.splash_pgt);
        this.splash.appendChild(splash_pg);

        this.splash_st = document.createElement('div');
        this.splash_st.className = 'decafmud status';
        this.splash_st.innerHTML = message;
        this.splash.appendChild(this.splash_st);

        this.splash_old = document.createElement('div');
        this.splash_old.className = 'decafmud old';
        this.splash_old.innerHTML = '';
        this.splash.appendChild(this.splash_old);
        this.container.appendChild(this.splash);
    }

    endSplash(): void {
        if (this.splash) {
            this.container.removeChild(this.splash);
        }
        this.el_display.style.overflowY = this.old_y;
        this.splash_err = false;
        this.splash = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
    }

    updateSplash(percentage?: number, message?: string): void {
        if ( this.splash === null || this.splash_err ) { return; }
        if ( percentage !== undefined && this.splash_pgi && this.splash_pgt) {
            const t = '{0}%'.tr(this.decaf, percentage);
            (this.splash_pgi.parentNode as HTMLElement).setAttribute('aria-valuenow', String(percentage));
            (this.splash_pgi.parentNode as HTMLElement).setAttribute('aria-valuetext', t);
            this.splash_pgt.innerHTML = t;
            this.splash_pgi.style.cssText = 'width:'+percentage+'%;';
        }
        if (!message || !this.splash_st || !this.splash_old) { return; }

        const e = document.createElement('div');
        let t = this.splash_st.innerHTML;
        if ( t.endsWith('...') ) { t += 'done.'; }
        e.innerHTML = t;
        this.splash_old.insertBefore(e, this.splash_old.firstChild);
        this.splash_st.innerHTML = message;
    }

    splashError(message: string): boolean {
        if ( this.splash === null || !this.splash_pgt || !this.splash_pgi || !this.splash_st ) { return false; }
        this.splash_pgt.innerHTML = '<b>Error</b>';
        this.splash_pgi.className += ' error';
        this.splash_st.innerHTML = message;
        this.splash_err = true;
        return true;
    }

    showSize(): void {
        clearTimeout(this.sizetm);
        if ( this.decaf.display === undefined ) { return; }
        if ( this.sizeel === undefined ) {
            this.sizeel = document.createElement('div');
            this.sizeel.className = 'decafmud note center';
            this.container.appendChild(this.sizeel);
        }
        const sz = this.decaf.display.getSize();
        this.sizeel.style.cssText = 'opacity:1';
        this.sizeel.innerHTML = "{0}x{1}".tr(this.decaf, sz[0], sz[1]);
        this.sizetm = setTimeout(() => { this.hideSize(); },500);
    }

    hideSize(fnl?: boolean): void {
        clearTimeout(this.sizetm);
        if (!this.sizeel) return;

        if ( fnl === true ) {
            if ( this.decaf.telopt[(DecafMUDGlobal as any).TN.NAWS] !== undefined ) {
                try { this.decaf.telopt[(DecafMUDGlobal as any).TN.NAWS].send(); }
                catch(err) { }
            }
            if (this.sizeel.parentNode) this.container.removeChild(this.sizeel);
            this.sizeel = undefined;
            return;
        }
        this.sizeel.style.cssText  = '-webkit-transition: opacity 0.25s linear;';
        this.sizeel.style.cssText += '-moz-transition: opacity 0.25s linear;';
        this.sizeel.style.cssText += '-o-transition: opacity 0.25s linear;';
        this.sizeel.style.cssText += 'transition: opacity 0.25s linear;';
        setTimeout(() => { if(this.sizeel) this.sizeel.style.opacity='0';},0);
        this.sizetm = setTimeout(() => { this.hideSize(true);},250);
    }

    print_msg(txt: string): void {
      if (this.decaf.display) this.decaf.display.message("<span class=\"c6\">" + txt + "</span>");
    }

    connected(): void {
        this.updateIcon(this.ico_connected, "DecafMUD is currently connected.".tr(this.decaf),
            '', 'connectivity connected');
    }

    connecting(): void {
      this.print_msg(this.decaf.options.set_interface.msg_connecting);
      if (this.decaf.options.set_interface.connect_hint) {
        if (this.decaf.options.socket == "websocket") {
          if (this.decaf.display) this.decaf.display.message("<span>You are connecting using <i>websockets</i> " +
            "on port " + this.decaf.options.set_socket.wsport + ".  If this does " +
            "not work (for example because the port is blocked or you have an " +
            "older version of websockets), you can connecting with flash.  To do " +
            "so, open <a href=\"web_client.html?socket=flash\">the flash version</a> " +
            "instead.</span>");
        } else {
          if (this.decaf.display) this.decaf.display.message("<span>You are connecting using <i>flash</i> " +
            "on port " + this.decaf.options.port + ".  To connect using " +
            "websockets, make sure you have an up-to-date browser which " +
            "supports this, and open " +
            "<a href=\"web_client.html?socket=websocket\">the websocket version</a> " +
            "instead.</span>");
        }
      }
      this.updateIcon(this.ico_connected,
                      "DecafMUD is attempting to connect.".tr(this.decaf),
                      '', 'connectivity connecting');
    }

    disconnected(): void {
      this.print_msg("Connection closed.");
      this.updateIcon(this.ico_connected,
                      "DecafMUD is currently not connected.".tr(this.decaf),
                      '', 'connectivity disconnected');
    }

    unloadPageFromEvent(e: BeforeUnloadEvent): string | void {
        if (this.decaf.connected) {
            return "You are still connected.";
        }
    }

    load(): void {
        this.decaf.require('decafmud.display.'+this.decaf.options.display);
    }

    reset(): void {
        this.masked = false;
        this.inputCtrl  = false;
        this.hasFocus   = false;
        this.reqTab = false;
        this.wantTab = false;
        this.tabIndex   = -1;
        this.tabValues  = [];
        this.buffer = '';
        if ( this.input !== undefined ) {
            this.updateInput();
        }
        if ( this.decaf.display !== undefined ) {
            this.decaf.display.reset();
        }
    }

    private ico_connected: number = -1; // Placeholder, will be assigned in setup

    setup(): void {
        this.store = this.decaf.store.sub('ui');
        this.storage = this.store;

        const tbar = this.store.get('toolbar-position','top-left');
        this.old_tbarpos = tbar;
        this.toolbar.className += ' ' + tbar;
        this.container.insertBefore(this.toolbar, this.container.firstChild);

        const displayPluginName = this.decaf.options.display;
        this.decaf.debugString('Initializing display plugin "'+displayPluginName+'"','info');
        // Ensure DecafMUD.plugins.Display is defined before accessing
         if (!(DecafMUDGlobal.plugins && DecafMUDGlobal.plugins.Display && DecafMUDGlobal.plugins.Display[displayPluginName])) {
            throw new Error(`Display plugin ${displayPluginName} not found.`);
        }

        this.decaf.display = new DecafMUDGlobal.plugins.Display[displayPluginName](this.decaf, this, this.el_display);
        if (this.decaf.display) this.decaf.display.id = 'mud-display';


        // Assuming get_menus is a global function for now
        const menus = (window as any).get_menus();
        if (menus) {
            for (let i = 0; i < menus.length; i+=3) {
              this.tbNew(
                menus[i],
                menus[i+1].tr(this.decaf),
                undefined,
                menus[i+2].tr(this.decaf),
                1,
                true,
                false,
                undefined,
                ((j: number) => {return (e: Event) => {(window as any).toggle_menu(j/3);}})(i)
              );
            }
        }

        this.goFullOnResize = false;
        const fs = this.store.get('fullscreen-start', this.decaf.options.set_interface.start_full);
        this.ico_connected = this.addIcon("You are currently disconnected.".tr(this.decaf), '', 'connectivity disconnected');
        if ( fs ) {
            this.enter_fs(false);
        } else {
            if ( !this._resizeToolbar() ) {
                this.resizeScreen(false,true);
            }
        }
    }

    tbDelete(id: number): void {
        if ( this.toolbuttons[id] === undefined ) { return; }
        const btn = this.toolbuttons[id];
        btn[0].parentNode.removeChild(btn[0]);
        this.toolbuttons[id] = undefined;
        // delete btn; // 'btn' is not a direct property, cannot delete like this.
        this._resizeToolbar();
    }

    tbText(id: number, text: string): void {
        const btn = this.toolbuttons[id];
        if ( btn === undefined ) { throw "Invalid button ID."; }
        if ( !text ) { throw "Text can't be empty/false/null/whatever."; }
        btn[0].innerHTML = text;
        if ( btn[3] === undefined ) {
            btn[3] = text;
            btn[0].title = text;
        }
    }

    // ... other tb* methods will be here

    tbNew(btnid: string, text: string, icon?: string, tooltip?: string, type?: number, enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void): number {
        if ( typeof icon === 'function' ) { // Shift arguments if icon is omitted
            onclick = icon as unknown as (e: Event) => void; // Cast since it's a function now
            icon = tooltip;
            tooltip = type as unknown as string | undefined; // type could be number or string
            type = enabled as unknown as number | undefined;
            enabled = pressed;
            pressed = clss as unknown as boolean | undefined;
            clss = onclick as unknown as string | undefined; // This seems wrong, onclick is a function
        }

        const ind = ( ++this.toolbutton_id );
        const btn = document.createElement('span');
        btn.id = btnid;
        btn.className = 'decafmud button toolbar-button';
        if ( clss ) { btn.className += ' ' + clss; }
        if ( type === 1 ) { btn.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }
        btn.innerHTML = text;
        if ( tooltip ) { btn.title = tooltip; }
        else { btn.title = text; }
        if ( enabled !== false ) { enabled = true; }
        if ( !enabled ) { btn.className += ' disabled'; }
        btn.setAttribute('tabIndex','0');
        btn.setAttribute('role','button');
        btn.setAttribute('aria-disabled', String(!enabled));
        if ( type === 1 ) {
            btn.setAttribute('aria-pressed', String(!!pressed)); // Ensure boolean to string
        }
        if ( icon ) {
            btn.style.backgroundImage = 'url('+icon+')';
            btn.className += ' icon';
        }

        if ( onclick ) {
            const si = this;
            const helper = (e: Event) => {
                if ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; }
                const currentBtn = si.toolbuttons[ind];
                if ( currentBtn[5] !== true ) { return; } // Index 5 is 'enabled'
                onclick.call(si, e);
                if ( e.type && e.type !== 'keydown' ) { (currentBtn[0] as HTMLElement).blur(); }
            };
            addEvent(btn, 'click', helper);
            addEvent(btn, 'keydown', helper);
        }

        addEvent(btn,'focus',function(this: HTMLElement, e: Event) { // Added 'this' type
            if (! this.parentNode ) { return; }
            if (/toolbar/.test((this.parentNode as HTMLElement).className)) {
                (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', this.id);
                (this.parentNode as HTMLElement).className += ' visible';
            }
        });
        addEvent(btn,'blur',function(this: HTMLElement, e: Event) { // Added 'this' type
            if (! this.parentNode ) { return; }
            if (/toolbar/.test((this.parentNode as HTMLElement).className)) {
                if ( (this.parentNode as HTMLElement).getAttribute('aria-activedescendant') === this.id ) {
                    (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', '');
                }
                (this.parentNode as HTMLElement).className = (this.parentNode as HTMLElement).className.replace(' visible','');
            }
        });
        this.toolbuttons[ind] = [btn,text,icon,tooltip,type,enabled,pressed,clss,onclick];
        btn.setAttribute('button-id', String(ind));
        this.toolbar.appendChild(btn);
        this._resizeToolbar();
        return ind;
    }

    _resizeToolbar(): boolean {
      let ret = false;
      if ( this.decaf.display && this.toolbarPadding !== this.toolbar.clientHeight ) {
        this.decaf.display.shouldScroll();
        this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px';
        this.toolbarPadding = this.toolbar.clientHeight;
        this.resizeScreen(false,true);
        this.decaf.display.doScroll();
        ret = true;
      } else {
        this.toolbarPadding = this.toolbar.clientHeight;
      }
      return ret;
    }

    // ... other methods to be converted
    // Placeholder for the rest of the methods to keep TSC happy for now
    tbTooltip(id: number, tooltip: string): void {}
    tbEnabled(id: number, enabled: boolean): void {}
    tbPressed(id: number, pressed: boolean): void {}
    tbClass(id: number, clss: string): void {}
    tbIcon(id: number, icon: string): void {}
    showScrollButton(): void {}
    hideScrollButton(): void {}
    infoBar(text: string, clss?: string | number, timeout?: number, icon?: string, buttons?: any[], click?: Function, close?: Function): void {}
    immediateInfoBar(text: string, clss?: string | number, timeout?: number, icon?: string, buttons?: any[], click?: Function, close?: Function): boolean { return false; }
    createIBar(): void {}
    closeIBar(steptwo?: boolean): void {}
    addIcon(text: string, html: string, clss: string, onclick?: Function, onkey?: Function): number { return 0; }
    delIcon(ind: number): void {}
    updateIcon(ind: number, text?: string, html?: string, clss?: string): void {}
    _resizeTray(): void {}
    click_fsbutton(e: MouseEvent): void {}
    enter_fs(showSize?: boolean): void {}
    exit_fs(): void {}
    resizeScreen(showSize?: boolean, force?: boolean): void {}
    resizeScreenFromEvent(source: string, event: Event): void {}
    showSidebar(): void {}
    hideSidebar(): void {}
    showProgressBars(): void {}
    hideProgressBars(): void {}
    showMap(): void {}
    hideMap(): void {}
    addProgressBar(name: string, col: string): void {}
    setProgress(name: string, percent: number,txt: string): void {}
    setProgressColor(name: string, col: string): void {}
    printMap(txt: string): void {}
    maxPopupHeight(): number { return 0; }
    maxPopupWidth(): number { return 0; }
    verticalPopupOffset(): number { return 0; }
    horizontalPopupOffset(): number { return 0; }
    hidePopup(): void {}
    showPopup(): HTMLElement | undefined { return undefined; }
    popupHeader(text: string): void {}
    buttonLine(par: HTMLElement): HTMLElement { return document.createElement('p'); }
    createButton(caption: string, func: string | Function): HTMLButtonElement { return document.createElement('button'); }
    popupTextarea(name: string, adjust: number): HTMLTextAreaElement { return document.createElement('textarea'); }
    popupTextdiv(): HTMLElement { return document.createElement('div'); }
    displayInput(text: string): void {}
    localEcho(echo: boolean): void {}
    maybeFocusInput(e: MouseEvent): void {}
    displayKey(e: KeyboardEvent): void {}
    handleInputPassword(e: KeyboardEvent): void {}
    saveInputInHistory(): void {}
    inputModified(): boolean { return false;}
    loadInput(): void {}
    parseInput(inp: string): void {}
    handleInput(e: KeyboardEvent): void {}
    handleBlur(e: FocusEvent): void {}
    updateInput(force?: boolean): void {}

}

// Expose this to DecafMUD
(DecafMUDGlobal as any).plugins.Interface.panels = SimpleInterface;

})(DecafMUD); // Pass the imported DecafMUD
