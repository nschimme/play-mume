// SPDX-License-Identifier: MIT
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

import DecafMUD from './decafmud';
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) {

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
    _input: HTMLElement;
    tray: HTMLElement;
    toolbuttons: any = {}; // TODO: Define specific type
    infobars: any[] = [];
    icons: any[] = [];
    toolbar: HTMLElement;
    input: HTMLInputElement | HTMLTextAreaElement;

    toolbutton_id: number = -1;
    echo: boolean = true;
    inpFocus: boolean = false;
    old_parent: Node | null | undefined = undefined; // More specific type
    next_sib: Node | null | undefined = undefined; // More specific type

    // display related properties from SimpleInterface.prototype.display
    // Assuming 'display' refers to an instance of the Display class from 'decafmud.display.standard.ts'
    // This might need to be adjusted if 'display' is a different type or structure.
    display: any | undefined = undefined; // TODO: Replace 'any' with actual Display class type if available

    splash: HTMLElement | null = null;
    splash_st: HTMLElement | null = null;
    splash_pg: HTMLElement | null = null; // Added this based on usage in initSplash
    splash_pgi: HTMLElement | null = null;
    splash_pgt: HTMLElement | null = null;
    splash_old: HTMLElement | null = null;
    scrollButton: HTMLElement | undefined;

    static supports: any = {
        'tabComplete'   : true,
        'multipleOut'   : false,
        'fullscreen'    : true,
        'editor'        : false,
        'splash'        : true
    };

    old_y: string = '';
    splash_err: boolean = false;
    sizeel: HTMLElement | undefined;
    sizetm: NodeJS.Timeout | undefined;
    store: any; // Storage instance
    storage: any; // Alias for store
    old_tbarpos: string = '';
    toolbarPadding: number | undefined;
    fsbutton: number = -1; // id of fullscreen button
    logbutton: number = -1; // id of log button
    stbutton: number = -1; // id of settings button
    ico_connected: number = -1;

    masked: boolean = false;
    inputCtrl: boolean = false;
    mruIndex: number = 0;
    mruHistory: string[] = [];
    mruSize: number = 15; // Default, will be overwritten
    mruTemp: boolean | string = false; // Can be boolean or string
    hasFocus: boolean = false;
    reqTab: boolean = false;
    wantTab: boolean = false;
    tabIndex: number = -1;
    tabValues: string[] = [];
    buffer: string = '';
    inp_buffer: string = ''; // For storing input value during type changes
    ibar: HTMLElement | undefined;
    ibartimer: NodeJS.Timeout | undefined;
    set_cont: HTMLElement | undefined; // For settings window
    set_mid: HTMLElement | undefined; // For settings window
    settings: HTMLElement | undefined; // The settings window element

    oldscrollX: number | undefined;
    oldscrollY: number | undefined;
    old_children: HTMLElement[] = [];
    old_display: string[] = [];
    old_body_over: string = '';
    goFullOnResize: boolean = true;
    old_fs: boolean = false;
    old_height: number = -1;
    old_width: number = -1;


    constructor(decaf: DecafMUDInstance) {
        const si = this;
        this.decaf = decaf;

        let containerOpt = decaf.options.set_interface.container;
        if ( typeof containerOpt === 'string' ) {
            this.container = document.querySelector(containerOpt) as HTMLElement;
        } else {
            this.container = containerOpt as HTMLElement; // Assume it's already an HTMLElement
        }

        if (!(this.container && 'nodeType' in this.container )) {
            throw "The container must be a node in the DOM!";
        }

        this.container.setAttribute('role', 'application');
        this.container.className += ' decafmud mud interface';

        this.el_display = document.createElement('div');
        this.el_display.className = 'decafmud mud-pane primary-pane';
        this.el_display.setAttribute('role', 'log');
        this.el_display.setAttribute('aria-live', 'assertive');
        this.el_display.setAttribute('tabIndex','0');
        this.container.appendChild(this.el_display);

        addEvent(this.el_display,'keydown', (e) => { si.displayKey(e as KeyboardEvent); });

        this._input = document.createElement('div');
        this._input.className = 'decafmud input-cont';

        this.tray = document.createElement('div');
        this.tray.className = 'decafmud icon-tray';
        this._input.appendChild(this.tray);

        this.toolbuttons = {};
        this.infobars = [];
        this.icons = [];

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'decafmud toolbar';
        this.toolbar.setAttribute('role','toolbar');
        const h = function(this: HTMLElement) { if(!this.className){return;}this.className = this.className.replace(' visible',''); };
        addEvent(this.toolbar,'mousemove', h as (e: Event) => void);
        addEvent(this.toolbar,'blur', h as (e: Event) => void);

        this.input = document.createElement('input');
        this.input.title = "MUD Input".tr(this.decaf);
        this.input.setAttribute('role','textbox');
        this.input.setAttribute('aria-label', this.input.title);
        this.input.type = 'text';
        this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);

        addEvent(this.input,'keydown', (e) => { si.handleInput(e as KeyboardEvent); });
        const helper = (e: Event) => { si.handleBlur(e as FocusEvent); };
        addEvent(this.input, 'blur', helper);
        addEvent(this.input, 'focus', helper);

        this.reset();
        addEvent(window,'resize', () => { si.resizeScreen(); });
    }

    toString(): string {
        return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#'+this.container.id+')' : '') + '>';
    }

    // ... All other prototype methods will be converted to class methods here ...
    // For brevity, only a few are shown fully converted, others are stubs

    initSplash(percentage?: number, message?: string): void {
        if ( percentage === undefined ) { percentage = 0; }
        if ( message === undefined ) { message = 'Discombobulating interface recipient...'.tr(this.decaf); }

        this.old_y = this.el_display.style.overflowY;
        this.el_display.style.overflowY = 'hidden';

        this.splash = document.createElement('div');
        this.splash.className = 'decafmud splash';
        this.splash.innerHTML  = '<h2 class="decafmud heading"><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> <span class="version">v'+DecafMUDGlobal.version+'</span></h2>';

        this.splash_pg = document.createElement('div'); // ensure splash_pg is assigned
        this.splash_pg.className = 'decafmud progress';
        this.splash_pg.setAttribute('role','progressbar');
        this.splash_pg.setAttribute('aria-valuemax', '100');
        this.splash_pg.setAttribute('aria-valuemin', '0');
        this.splash_pg.setAttribute('aria-valuenow', String(percentage));
        this.splash_pg.setAttribute('aria-valuetext', '{0}%'.tr(this.decaf,percentage));

        this.splash_pgi = document.createElement('div');
        this.splash_pgi.className = 'decafmud inner-progress';
        this.splash_pgi.style.cssText = 'width:'+percentage+'%;';
        this.splash_pg.appendChild(this.splash_pgi);

        this.splash_pgt = document.createElement('div');
        this.splash_pgt.className = 'decafmud progress-text';
        this.splash_pgt.innerHTML = '{0}%'.tr(this.decaf,percentage);
        this.splash_pg.appendChild(this.splash_pgt);
        this.splash.appendChild(this.splash_pg);

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
        if (this.splash && this.splash.parentNode) {
             this.splash.parentNode.removeChild(this.splash);
        }
        this.el_display.style.overflowY = this.old_y;
        this.splash_err = false;
        this.splash = this.splash_pg = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
    }

    updateSplash(percentage?: number, message?: string): void {
        if ( this.splash === null || this.splash_err || !this.splash_pg || !this.splash_pgi || !this.splash_pgt || !this.splash_st || !this.splash_old) { return; }
        if ( percentage !== undefined ) {
            const t = '{0}%'.tr(this.decaf, percentage);
            this.splash_pg.setAttribute('aria-valuenow', String(percentage));
            this.splash_pg.setAttribute('aria-valuetext', t);
            this.splash_pgt.innerHTML = t;
            this.splash_pgi.style.cssText = 'width:'+percentage+'%;';
        }
        if (!message) { return; }
        const e = document.createElement('div');
        let currentMessageText = this.splash_st.innerHTML;
        if ( currentMessageText.endsWith('...') ) { currentMessageText += 'done.'; }
        e.innerHTML = currentMessageText;
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

    // ... stubs for other methods ...
    showSize(): void {}
    hideSize(fnl?: boolean): void {}
    connected(): void {}
    connecting(): void {}
    disconnected(): void {}
    load(): void { this.decaf.require('decafmud.display.'+this.decaf.options.display); }
    reset(): void {
        this.masked = false; this.inputCtrl  = false; this.mruIndex = 0;
        this.mruHistory = []; this.mruSize = this.decaf.options.set_interface.mru_size;
        this.mruTemp = false; this.hasFocus = false; this.reqTab = false;
        this.wantTab = false; this.tabIndex = -1; this.tabValues = [];
        this.buffer = '';
        if ( this.input !== undefined ) { this.updateInput(); }
        if ( this.display !== undefined ) { this.display.reset(); }
    }
    setup(): void {}
    showLogs(): void {}
    showSettings(): void {}
    tbDelete(id: number): void {}
    tbText(id: number, text: string): void {}
    tbTooltip(id: number, tooltip: string): void {}
    tbEnabled(id: number, enabled: boolean): void {}
    tbPressed(id: number, pressed: boolean): void {}
    tbClass(id: number, clss: string): void {}
    tbIcon(id: number, icon: string): void {}
    tbNew(text: string,icon?: string,tooltip?: string,type?: number,enabled?: boolean,pressed?: boolean,clss?: string,onclick?: (e: Event) => void): number { return 0; }
    _resizeToolbar(): boolean { return false; }
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
    resizeScreen(showSize?: boolean,force?: boolean): void {}
    displayInput(text: string): void {}
    localEcho(echo: boolean): void {}
    displayKey(e: KeyboardEvent): void {}
    handleInputPassword(e: KeyboardEvent): void {}
    handleInput(e: KeyboardEvent): void {}
    handleBlur(e: FocusEvent): void {}
    updateInput(force?: boolean): void {}

}

// Expose this to DecafMUD
(DecafMUDGlobal as any).plugins.Interface.simple = SimpleInterface;

})(DecafMUD);
