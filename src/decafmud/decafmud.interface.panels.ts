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
import { IDecafMUD, IUi, IDisplay, IStorage, ITeloptHandler } from './decafmud.types';
import { makeDraggable, DraggableController } from './simple-dragger';

(function(DecafMUD_Global: any) {

var addEvent = function(node: HTMLElement | Document | Window, etype: string, func: EventListenerOrEventListenerObject) {
		if ( node.addEventListener ) {
			node.addEventListener(etype, func, false); return; }

		const onetype = 'on' + etype;
		if ( (node as any).attachEvent ) {
			(node as any).attachEvent(onetype, func); }
		else {
			(node as any)[onetype] = func; }
	},
	delEvent = function(node: HTMLElement | Document | Window, etype: string, func: EventListenerOrEventListenerObject) {
		if ( node.removeEventListener ) {
			node.removeEventListener(etype, func, false); }
	};

var bodyHack = /Firefox\//.test(navigator.userAgent);

class SimpleInterface implements IUi {
    public decaf: IDecafMUD;
    public container: HTMLElement;
    public el_display: HTMLElement;
    public sidebar: HTMLElement;
    public progresstable: HTMLTableElement;
    public progressbars: any[];
    public mapdiv: HTMLElement;
    public _input: HTMLElement;
    public tray: HTMLElement;
    public toolbuttons: { [id: number]: [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, ((e: Event) => void) | undefined] };
    public infobars: any[];
    public icons: [HTMLElement, ((e: Event) => void) | undefined, ((e: KeyboardEvent) => void) | undefined][];
    public toolbar: HTMLElement;
    public input: HTMLInputElement;
    public toolbutton_id: number = -1;
    public echo: boolean = true;
    public inpFocus: boolean = false;
    public old_parent: (Node & ParentNode) | undefined = undefined;
    public next_sib: ChildNode | null | undefined = undefined;
    public display: IDisplay | undefined = undefined;
    public splash: HTMLElement | null = null;
    public splash_st: HTMLElement | null = null;
    public splash_pgi: HTMLElement | null = null;
    public splash_pgt: HTMLElement | null = null;
    public splash_old: HTMLElement | null = null;
    public splash_err: boolean = false;
    public scrollButton: HTMLElement | undefined = undefined;
    public history: string[];
    public historyPosition: number;
    public masked: boolean = false;
    public inputCtrl: boolean = false;
    public reqTab: boolean = false;
    public wantTab: boolean = false;
    public tabIndex: number = -1;
    public tabValues: string[] = [];
    public buffer: string = '';
    public old_y?: string;
    public inp_buffer?: string;
    public popup: HTMLElement | undefined = undefined;
    public headerdrag: DraggableController | undefined = undefined;
    public popupheader: HTMLElement | undefined = undefined;
    public settings?: HTMLElement;
    public set_cont?: HTMLElement;
    public set_mid?: HTMLElement;
    public stbutton?: number;
    public old_tbarpos: string = '';
    public toolbarPadding: number | undefined = undefined;
    public oldscrollX: number | undefined = undefined;
    public oldscrollY: number | undefined = undefined;
    public old_children: HTMLElement[] = [];
    public old_display: (string | null)[] = [];
    public old_body_over: string = '';
    public goFullOnResize: boolean = false;
    public old_fs: boolean = false;
    public sizeel: HTMLElement | undefined = undefined;
    public sizetm: number | undefined = undefined;
    public ico_connected!: number;
    public store?: IStorage;
    public storage?: IStorage;
    private ibar?: HTMLElement;
    private ibartimer?: number;
		private hasFocus: boolean = false;

    public static supports = {
        'tabComplete'   : true,
        'multipleOut'   : false,
        'fullscreen'    : true,
        'editor'        : false,
        'splash'        : true
    };

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
        const passed_container = decaf.options.set_interface?.container;
        if ( typeof passed_container === 'string' ) { this.container = document.querySelector(passed_container) as HTMLElement; }
        else { this.container = passed_container as HTMLElement; }
        if (!this.container || !( 'nodeType' in this.container )) { throw "The container must be a node in the DOM!"; }
        this.container.setAttribute('role', 'application'); this.container.className += ' decafmud mud interface';
        this.el_display = document.createElement('div'); this.el_display.className = 'decafmud mud-pane primary-pane'; this.el_display.setAttribute('role', 'log'); this.el_display.setAttribute('tabIndex','0'); this.container.appendChild(this.el_display);
        this.sidebar = document.createElement('div'); this.sidebar.className = 'decafmud mud-pane side-pane'; this.sidebar.setAttribute('tabIndex', '1'); this.container.appendChild(this.sidebar);
        this.progresstable = document.createElement('table'); this.progresstable.style.display = 'none'; this.sidebar.appendChild(this.progresstable);
        this.progressbars = []; this.mapdiv = document.createElement('div'); this.mapdiv.style.display = 'none'; this.sidebar.appendChild(this.mapdiv);
        this.el_display.onmouseup = (e: MouseEvent) => this.maybeFocusInput(e);
        addEvent(this.el_display,'keydown', (e) => this.displayKey(e as KeyboardEvent));
        addEvent(this.sidebar,'keydown', (e) => this.displayKey(e as KeyboardEvent));
        this._input = document.createElement('div'); this._input.className = 'decafmud input-cont';
        this.tray = document.createElement('div'); this.tray.className = 'decafmud icon-tray'; this._input.appendChild(this.tray);
        this.toolbuttons = {}; this.infobars = []; this.icons = [];
        this.toolbar = document.createElement('div'); this.toolbar.className = 'decafmud toolbar'; this.toolbar.setAttribute('role','toolbar');
        const h = function(this: HTMLElement) { if(!this.className){return;}this.className = this.className.replace(' visible',''); };
        addEvent(this.toolbar,'mousemove', h.bind(this.toolbar)); addEvent(this.toolbar,'blur', h.bind(this.toolbar));
        this.input = document.createElement('input') as HTMLInputElement; this.input.id = "inputelement"; this.input.title = "MUD Input"; this.input.type = 'text'; this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild); this.container.appendChild(this._input);
        addEvent(this.input,'keydown', (e) => this.handleInput(e as KeyboardEvent));
        const blurFocusHelper = (e: Event) => { this.handleBlur(e as FocusEvent); };
        addEvent(this.input, 'blur', blurFocusHelper); addEvent(this.input, 'focus', blurFocusHelper);
        this.history = []; this.historyPosition = -1; for (let i = 0; i < 100; i++) this.history[i] = '';
        this.reset();
        addEvent(window, 'resize', (e: Event) => this.resizeScreenFromEvent('window resize', e));
        if ("onhelp" in window) { (window as any).onhelp = function() { return false; }; }
        window.onbeforeunload = (e: BeforeUnloadEvent) => this.unloadPageFromEvent(e);
        this.input.focus();
    }

    public toString(): string { return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#'+this.container.id+')' : '') + '>'; }

		public initSplash(percentage: number = 0, message: string = 'Discombobulating interface recipient...'): void {
			this.old_y = this.el_display.style.overflowY; this.el_display.style.overflowY = 'hidden';
			this.splash = document.createElement('div'); this.splash.className = 'decafmud splash';
			this.splash.innerHTML  = '<h2 class="decafmud heading"><a href="http://decafmud.stendec.me/">DecafMUD</a> <span class="version">v'+(DecafMUD_Global as any).version+'</span></h2>';
			const splash_pg = document.createElement('div'); splash_pg.className = 'decafmud progress'; splash_pg.setAttribute('role','progressbar'); splash_pg.setAttribute('aria-valuemax', "100"); splash_pg.setAttribute('aria-valuemin', "0"); splash_pg.setAttribute('aria-valuenow', String(percentage)); splash_pg.setAttribute('aria-valuetext', `${percentage}%`);
			this.splash_pgi = document.createElement('div'); this.splash_pgi.className = 'decafmud inner-progress'; this.splash_pgi.style.cssText = 'width:'+percentage+'%;'; splash_pg.appendChild(this.splash_pgi);
			this.splash_pgt = document.createElement('div'); this.splash_pgt.className = 'decafmud progress-text'; this.splash_pgt.innerHTML = `${percentage}%`; splash_pg.appendChild(this.splash_pgt);
			this.splash.appendChild(splash_pg);
			this.splash_st = document.createElement('div'); this.splash_st.className = 'decafmud status'; this.splash_st.innerHTML = message; this.splash.appendChild(this.splash_st);
			this.splash_old = document.createElement('div'); this.splash_old.className = 'decafmud old'; this.splash_old.innerHTML = ''; this.splash.appendChild(this.splash_old);
			this.container.appendChild(this.splash);
		}

		public endSplash(): void {
			if (!this.splash) return; this.container.removeChild(this.splash);
			if (this.old_y !== undefined) { this.el_display.style.overflowY = this.old_y; }
			this.splash_err = false; this.splash = null; this.splash_pgi = null; this.splash_pgt = null; this.splash_st = null; this.splash_old = null;
		}

		public updateSplash(percentage?: number, message?: string): void {
			if ( this.splash === null || this.splash_err ) { return; }
			const splash_pg_element = this.splash.querySelector('.decafmud.progress') as HTMLElement | null;
			if ( percentage !== undefined && splash_pg_element && this.splash_pgt && this.splash_pgi) {
				var t = `${percentage}%`; splash_pg_element.setAttribute('aria-valuenow', String(percentage)); splash_pg_element.setAttribute('aria-valuetext', t);
				this.splash_pgt.innerHTML = t; this.splash_pgi.style.cssText = 'width:'+percentage+'%;';
			}
			if (! message) { return; }
			var e = document.createElement('div'); var current_status_text = this.splash_st ? this.splash_st.innerHTML : "";
			if ( current_status_text.endsWith('...') ) { current_status_text += 'done.'; } e.innerHTML = current_status_text;
			if (this.splash_old) { this.splash_old.insertBefore(e, this.splash_old.firstChild); }
			if (this.splash_st) { this.splash_st.innerHTML = message; }
		}

		public splashError(message: string): boolean {
			if ( this.splash === null ) { return false; }
			if (this.splash_pgt) { this.splash_pgt.innerHTML = '<b>Error</b>'; }
			if (this.splash_pgi) { this.splash_pgi.className += ' error'; }
			if (this.splash_st) { this.splash_st.innerHTML = message; }
			this.splash_err = true; return true;
		}

		public showSize(): void {
			clearTimeout(this.sizetm); if ( this.display === undefined ) { return; }
			if ( this.sizeel === undefined ) { this.sizeel = document.createElement('div'); (this.sizeel as HTMLElement).className = 'decafmud note center'; this.container.appendChild(this.sizeel); }
			var sz = this.display!.getSize(); (this.sizeel as HTMLElement).style.cssText = 'opacity:1'; (this.sizeel as HTMLElement).innerHTML = `${sz[0]}x${sz[1]}`;
			var si = this; this.sizetm = window.setTimeout(function(){si.hideSize()},500);
		}

		public hideSize(fnl?: boolean): void {
			clearTimeout(this.sizetm);
			if ( fnl === true ) {
				if (this.decaf.telopt && this.decaf.telopt[(DecafMUD_Global as any).TN.NAWS] !== undefined ) { try { ((this.decaf.telopt[(DecafMUD_Global as any).TN.NAWS]) as any).send!(); } catch(err) { } }
				if (this.sizeel && this.sizeel.parentNode) { this.sizeel.parentNode.removeChild(this.sizeel); this.sizeel = undefined; } return;
			}
			if (this.sizeel) {
				(this.sizeel as HTMLElement).style.cssText  = '-webkit-transition: opacity 0.25s linear; -moz-transition: opacity 0.25s linear; -o-transition: opacity 0.25s linear; transition: opacity 0.25s linear;';
				var si = this as any; setTimeout(function(){ if(si.sizeel) { (si.sizeel as HTMLElement).style.opacity='0';} },0);
				this.sizetm = window.setTimeout(function(){(si as IUi).hideSize!(true)},250);
			}
		}

		public print_msg(txt: string): void { if (this.display) { this.display.message("<span class=\"c6\">" + txt + "</span>"); } }
		public connected():void { if (this.ico_connected !== undefined) this.updateIcon(this.ico_connected, "DecafMUD is currently connected.", '', 'connectivity connected'); }
		public connecting():void {
			if(this.decaf.options.set_interface?.msg_connecting) { this.print_msg(this.decaf.options.set_interface.msg_connecting); }
			if (this.decaf.options.set_interface?.connect_hint && this.display) {
				const wsport = this.decaf.options.set_socket?.wsport; const port = this.decaf.options.port;
				if (this.decaf.options.socket == "websocket") { this.display.message("<span>You are connecting using <i>websockets</i> on port " + wsport + ". If this does not work (for example because the port is blocked or you have an older version of websockets), you can connecting with flash. To do so, open <a href=\"web_client.html?socket=flash\">the flash version</a> instead.</span>"); }
				else { this.display.message("<span>You are connecting using <i>flash</i> on port " + port + ". To connect using websockets, make sure you have an up-to-date browser which supports this, and open <a href=\"web_client.html?socket=websocket\">the websocket version</a> instead.</span>"); }
			}
			if (this.ico_connected !== undefined) this.updateIcon(this.ico_connected, "DecafMUD is attempting to connect.", '', 'connectivity connecting');
		}
		public disconnected(reconnecting?: boolean):void { this.print_msg("Connection closed."); if (this.ico_connected !== undefined) this.updateIcon(this.ico_connected, "DecafMUD is currently not connected.", '', 'connectivity disconnected');}
		public unloadPageFromEvent(e: BeforeUnloadEvent): string | undefined { if (this.decaf.connected) { return "You are still connected."; } return undefined; }
		public load(): void { this.decaf.require('decafmud.display.'+this.decaf.options.display); }
		public reset(): void { this.masked = false; this.inputCtrl = false; this.hasFocus = false; this.reqTab = false; this.wantTab = false; this.tabIndex = -1; this.tabValues = []; this.buffer = ''; if ( this.input !== undefined ) { this.updateInput(); } if ( this.display !== undefined ) { this.display.reset(); } }
		public setup(): void {
			this.store = this.decaf.store.sub('ui'); this.storage = this.store;
			var tbar = this.store.get('toolbar-position','top-left'); this.old_tbarpos = tbar; this.toolbar.className += ' ' + tbar; this.container.insertBefore(this.toolbar, this.container.firstChild);
			var display_plugin_name = this.decaf.options.display!; this.decaf.debugString('Initializing display plugin "'+display_plugin_name+'" in: #' + this.el_display.id,'info');
			const DisplayPlugin = (DecafMUD_Global as any).plugins.Display[display_plugin_name];
			if (DisplayPlugin) { this.display = new DisplayPlugin(this.decaf, this, this.el_display); (this.display as any).id = 'mud-display'; this.decaf.display = this.display; } else { this.decaf.error(`Display plugin "${display_plugin_name}" not found.`); }
			var menus = (window as any).get_menus();
      // Corrected tbNew call: menus[i] is btnid (not used), menus[i+1] is text, menus[i+2] is tooltip
			for (let i = 0; i < menus.length; i+=3) { this.tbNew(menus[i+1], undefined, menus[i+2], 1, true, false, undefined, function(idx) {return function(e: Event) { (window as any).toggle_menu(idx/3);}}(i)); }
			(this as any).goFullOnResize = false; var fs = this.store!.get('fullscreen-start', this.decaf.options.set_interface?.start_full);
			this.ico_connected = this.addIcon("You are currently disconnected.", '', 'connectivity disconnected');
			if ( fs ) { this.enter_fs(false); } else { if ( ! this._resizeToolbar() ) { this.resizeScreen(false); } }
		}
		public tbDelete(id: number): void { if ( this.toolbuttons[id] === undefined ) { return; } var btn_arr = this.toolbuttons[id]; if (btn_arr[0] && btn_arr[0].parentNode) { btn_arr[0].parentNode.removeChild(btn_arr[0]); } delete this.toolbuttons[id]; this._resizeToolbar(); }
		public tbText(id: number, text: string): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } if ( !text ) { throw "Text can't be empty/false/null/whatever."; } btn_arr[0].innerHTML = text; if ( btn_arr[3] === undefined ) { btn_arr[3] = text; btn_arr[0].title = text; } }
		public tbTooltip(id: number, tooltip: string): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } btn_arr[3] = tooltip; if ( tooltip ) { btn_arr[0].title = tooltip; } else { btn_arr[0].title = btn_arr[1]; } }
		public tbEnabled(id: number, enabled: boolean): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } enabled = !!(enabled); btn_arr[5] = enabled; btn_arr[0].setAttribute('aria-disabled', String(!enabled)); if ( enabled ) { btn_arr[0].className = btn_arr[0].className.replace(' disabled',''); } else if (! /disabled/.test(btn_arr[0].className) ) { btn_arr[0].className += ' disabled'; } }
		public tbPressed(id: number, pressed: boolean): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } pressed = !!(pressed); btn_arr[6] = pressed; btn_arr[0].setAttribute('aria-pressed', String(pressed)); if ( pressed ) { if ( /toggle-depressed/.test(btn_arr[0].className) ) { btn_arr[0].className = btn_arr[0].className.replace(' toggle-depressed',' toggle-pressed'); } } else { if ( /toggle-pressed/.test(btn_arr[0].className) ) { btn_arr[0].className = btn_arr[0].className.replace(' toggle-pressed',' toggle-depressed'); } } }
		public tbClass(id: number, clss: string): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } var old_clss = btn_arr[7]; btn_arr[7] = clss; if ( old_clss !== undefined ) { btn_arr[0].className = btn_arr[0].className.replace(' '+old_clss,''); } if ( clss ) { btn_arr[0].className += ' ' + clss; } }
		public tbIcon(id: number, icon: string): void { var btn_arr = this.toolbuttons[id]; if ( btn_arr === undefined ) { throw "Invalid button ID."; } btn_arr[2] = icon; if ( icon ) { if (! / icon/.test(btn_arr[0].className) ) { btn_arr[0].className += ' icon'; } btn_arr[0].style.cssText = 'background-image: url('+icon+');'; } else { btn_arr[0].className = btn_arr[0].className.replace(' icon',''); btn_arr[0].style.cssText = ''; } }
    public tbNew(text: string, icon?: string, tooltip?: string, type: number = 0, enabled: boolean = true, pressed: boolean = false, clss?: string, onclick?: (e: Event) => void): number {
        var ind = ( ++this.toolbutton_id );
        const btnid = this.decaf.id + '-toolbar-button-' + ind;
        var btn = document.createElement('span'); btn.id = btnid; btn.className = 'decafmud button toolbar-button';
        if ( clss ) { btn.className += ' ' + clss; } if ( type === 1 ) { btn.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }
        btn.innerHTML = text; if ( tooltip ) { btn.title = tooltip; } else { btn.title = text; }
        if ( enabled !== false ) { enabled = true; } if ( !enabled ) { btn.className += ' disabled'; } btn.setAttribute('tabIndex','0');
        btn.setAttribute('role','button'); btn.setAttribute('aria-disabled', String(!enabled)); if ( type === 1 ) { btn.setAttribute('aria-pressed', String(pressed)); }
        if ( icon ) { btn.style.cssText = 'background-image: url('+icon+');'; btn.className += ' icon'; }
        if ( onclick ) { var si = this; var helper = function(e: Event) { if ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; } var current_btn_arr = si.toolbuttons[ind]; if ( current_btn_arr[5] !== true ) { return; } onclick.call(si, e); if ( e.type && e.type !== 'keydown' ) { (current_btn_arr[0] as HTMLElement).blur(); } }; addEvent(btn, 'click', helper); addEvent(btn, 'keydown', helper); }
        addEvent(btn,'focus',function(this: HTMLElement, e: Event) { if (! this.parentNode ) { return; } if (/toolbar/.test((this.parentNode as HTMLElement).className)) { (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', this.id); (this.parentNode as HTMLElement).className += ' visible'; } });
        addEvent(btn,'blur',function(this: HTMLElement, e: Event) { if (! this.parentNode ) { return; } if (/toolbar/.test((this.parentNode as HTMLElement).className)) { if ( (this.parentNode as HTMLElement).getAttribute('aria-activedescendant') === this.id ) { (this.parentNode as HTMLElement).setAttribute('aria-activedescendant', ''); } (this.parentNode as HTMLElement).className = (this.parentNode as HTMLElement).className.replace(' visible',''); } });
        this.toolbuttons[ind] = [btn,text,icon,tooltip,type,enabled,pressed,clss,onclick]; btn.setAttribute('button-id', String(ind));
        this.toolbar.appendChild(btn); this._resizeToolbar(); return ind;
    }
		public _resizeToolbar(): boolean { var ret = false; if ( this.display && this.toolbarPadding !== this.toolbar.clientHeight ) { this.display.shouldScroll(); this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px'; this.toolbarPadding = this.toolbar.clientHeight; this.resizeScreen(false,true); this.display.doScroll(); ret = true; } else { this.toolbarPadding = this.toolbar.clientHeight; } return ret; }
		public click_fsbutton(e: Event): void { if ( this.container.className.indexOf('fullscreen') === -1 ) { this.enter_fs(); } else { this.exit_fs(); } }
		public enter_fs(showSize: boolean = true): void { if ( this.container.className.indexOf('fullscreen') !== -1 ) { return; } var has_focus = this.inpFocus; if ( this.display ) { this.display.shouldScroll(false); } this.oldscrollY = window.scrollY; this.oldscrollX = window.scrollX; if (this.container.parentNode) { this.old_parent = this.container.parentNode; this.next_sib = this.container.nextElementSibling; if ( this.next_sib === undefined ) { if ( this.container.nextSibling && this.container.nextSibling.nodeType == this.container.nodeType ) { this.next_sib = this.container.nextSibling; } } (this.old_parent as Node).removeChild(this.container); } this.container.className += ' fullscreen'; for(var i=0;i<document.body.children.length;i++) { var child = document.body.children[i] as HTMLElement; if ( child.id !== '_firebugConsole' && child.id.indexOf('DecafFlashSocket') !== 0 ) { this.old_children.push(child); this.old_display.push(child.style.display); child.style.display = 'none'; } } this.old_body_over = document.body.style.overflow; if ( !bodyHack ) { document.body.style.overflow = 'hidden'; } document.body.appendChild(this.container); window.scroll(0,0); this._resizeToolbar(); this.resizeScreen(showSize, false); if ( showSize !== false ) { this.showSize(); } if ( has_focus ) { this.input.focus(); } if ( this.display ) { this.display.doScroll(); } }
		public exit_fs(): void { if ( this.old_parent === undefined ) { return; } var has_focus = this.inpFocus; if ( this.display ) { this.display.shouldScroll(false); } if (this.container.parentNode) { this.container.parentNode.removeChild(this.container); } for(var i=0; i<this.old_children.length;i++) { var child = this.old_children[i]; child.style.display = this.old_display[i]!; } this.old_children = []; this.old_display = []; var classes = this.container.className.split(' '),idx=0; while(idx<classes.length){ if ( classes[idx] === 'fullscreen' ) { classes.splice(idx,1); continue; } idx++; } this.container.className = classes.join(' '); if ( this.next_sib !== undefined && this.next_sib !== null ) { (this.old_parent as Node).insertBefore(this.container, this.next_sib); } else { (this.old_parent as Node).appendChild(this.container); } document.body.style.overflow = this.old_body_over; if(this.oldscrollX !== undefined && this.oldscrollY !== undefined) { window.scroll(this.oldscrollX, this.oldscrollY); } this._resizeToolbar(); this.showSize(); if ( has_focus ) { this.input.focus(); } if ( this.display ) { this.display.doScroll(); } }
		public resizeScreen(showSize: boolean = true, force?: boolean): void { if ( this.goFullOnResize ) { var fs = (window as any).fullScreen === true; if ( !fs ) { if ( window.outerHeight ) { fs = (window.screen.height - window.outerHeight) <= 5; } else if ( window.innerHeight ) { fs = (window.screen.height - window.innerHeight <= 5); } } if ( fs && !this.old_fs ) { this.old_fs = fs; this.enter_fs(); return; } else if ( !fs && this.old_fs ) { this.old_fs = fs; this.exit_fs(); return; } this.old_fs = fs; } if ( force !== true && (this as any).old_height === this.container.offsetHeight && (this as any).old_width === this.container.offsetWidth ) { return; } if(this.hidePopup)this.hidePopup(); (this as any).old_height = this.container.offsetHeight; (this as any).old_width = this.container.offsetWidth; var tot = (this as any).old_height - (this._input.offsetHeight + 17); if ( this.toolbarPadding ) { tot = tot - (this.toolbarPadding-12); } if ( tot < 0 ) { tot = 0; } if ( this.popup && this.set_mid) { this.set_mid.style.height = tot + 'px'; } if ( this.toolbarPadding ) { tot -= 12; if ( tot < 0 ) { tot = 0; } } this.el_display.style.height = tot + 'px'; if ( force !== true && this.display ) { this.display.scroll(); } if ( this.scrollButton ) { this.scrollButton.style.cssText = 'bottom:' + (this._input.offsetHeight + 12) + 'px'; } if ( showSize !== false ) { this.showSize(); } }
		public resizeScreenFromEvent(source: string, event: Event): void { this.resizeScreen(true, false); }
		public showScrollButton():void { if ( this.scrollButton !== undefined ) { return; } var sb = document.createElement('div'); var si = this as any; sb.className = 'button scroll-button'; sb.setAttribute('tabIndex','0'); sb.innerHTML = "More"; var helper = function(e: Event) { if ( (e as KeyboardEvent).type == 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; } if (si.display) { si.display.scrollNew(); } }; addEvent(sb, 'click', helper); addEvent(sb, 'keydown', helper); this.scrollButton = sb; this.container.appendChild(sb); sb.style.cssText = 'bottom:' + (this._input.offsetHeight + 12) + 'px'; }
		public hideScrollButton(): void { if ( this.scrollButton === undefined ) { return; } if (this.scrollButton.parentNode) { this.scrollButton.parentNode.removeChild(this.scrollButton); } this.scrollButton = undefined; }
		public infoBar(text: string, clssOrTimeout?: string | number, timeoutOrClss?: number | string, icon?: string, buttons?: [string, Function][], click?: (e: Event) => void, close?: (e: Event) => void): void { let clss: string | undefined = 'info'; let timeout: number = 0; if ( typeof clssOrTimeout === 'number' ) { timeout = clssOrTimeout; clss = timeoutOrClss as string | undefined; } else { clss = clssOrTimeout; timeout = timeoutOrClss as number | undefined || 0; } if ( clss === undefined ) { clss = 'info'; } var ibar_data: any = { 'text': text, 'class': clss, 'timeout': timeout, 'icon': icon, 'buttons': buttons, 'click': click, 'close': close, 'el': null }; this.infobars.push(ibar_data); if ( this.ibar !== undefined ) { return; } this.createIBar(); }
		public immediateInfoBar(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, Function][], click?: (e: Event) => void, close?: (e: Event) => void): boolean { if ( this.ibar !== undefined ) { return false; } this.infoBar(text, clss, timeout, icon, buttons, click, close); return true; }
		private _addButtonToIBar(bar: HTMLElement, btn_data: [string, Function], si: SimpleInterface): void { var b = document.createElement('a'); b.className = 'button'; b.setAttribute('href','#'); b.setAttribute('onclick','return false;'); b.innerHTML = btn_data[0]; addEvent(b, 'click', function(this: SimpleInterface, e: Event) { this.closeIBar(true); setTimeout(() => { btn_data[1].call(this,e); },0); (e as any).cancelBubble = true; if ( e.stopPropagation ) { e.stopPropagation(); } return false; }.bind(si)); bar.appendChild(b); }
		public createIBar(): void { var ibar_data = this.infobars[0] as any; if (!ibar_data) return; var obj = document.createElement('div'); this.ibar = obj; ibar_data.el = obj; obj.setAttribute('role', 'alert'); obj.className = 'decafmud infobar ' + ibar_data['class']; obj.innerHTML = ibar_data.text; obj.style.cssText = 'top: -26px;'; if ( ibar_data.click !== undefined ) { obj.className += ' clickable'; obj.setAttribute('tabIndex','0'); } var closer = function(this: SimpleInterface, e: Event) { if ( e === undefined || ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 && (e as KeyboardEvent).keyCode !== 27 )) { return; } if ( e.type === 'click' && !ibar_data.click ) { return; } (e as any).cancelBubble = true; if ( e.stopPropagation ) { e.stopPropagation(); } this.closeIBar(true); if ( e.type === 'keydown' && (e as KeyboardEvent).keyCode === 27 ) { if ( ibar_data.close ) { ibar_data.close.call(this, e); } return; } if ( ibar_data.click ) { ibar_data.click.call(this, e); } }.bind(this); addEvent(obj, 'click', closer); addEvent(obj, 'keydown', closer); var closebtn = document.createElement('div'); closebtn.innerHTML = 'X'; closebtn.className = 'close'; closebtn.setAttribute('tabIndex','0'); var helper = function(this: SimpleInterface, e: Event) { if ( e === undefined || ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 )) { return; } this.closeIBar(true); if ( ibar_data.close ) { ibar_data.close.call(this, e); } (e as any).cancelBubble = true; if ( e.stopPropagation ) { e.stopPropagation(); } }.bind(this); addEvent(closebtn, 'click', helper); addEvent(closebtn, 'keydown', helper); obj.insertBefore(closebtn, obj.firstChild); if ( ibar_data.buttons ) { var btncont = document.createElement('div'); btncont.className = 'btncont'; for(var i=0; i<ibar_data.buttons.length; i++) { this._addButtonToIBar(btncont, ibar_data.buttons[i], this); } obj.insertBefore(btncont, closebtn); } this.container.insertBefore(obj, this.container.firstChild); setTimeout(() => { var pt = 0; if ( window.getComputedStyle ) { pt = parseInt(getComputedStyle(obj,null).paddingTop); } else if ( (obj as any).currentStyle ) { pt = parseInt((obj as any).currentStyle['paddingTop']); } if ( this.toolbarPadding ) { pt += this.toolbarPadding - 10; } obj.style.cssText = 'background-position: 5px '+pt+'px; padding-top: '+pt+'px; -webkit-transition: top 0.1s linear; -moz-transition: top 0.1s linear; -o-transition: top 0.1s linear; transition: top 0.1s linear; top: inherit'; if ( ibar_data.icon ) { obj.style.cssText += 'background-image: url("'+ibar_data.icon+'")'; } },0); if ( ibar_data.timeout > 0 ) { this.ibartimer = window.setTimeout(() => { this.closeIBar(); }, 1000 * ibar_data.timeout); } }
		public closeIBar(steptwo?: boolean): void { const currentIbar = this.ibar; if ( currentIbar === undefined ) { return; } clearTimeout(this.ibartimer); if ( !steptwo ) { currentIbar.style.cssText += '-webkit-transition: opacity 0.25s linear; -moz-transition: opacity 0.25s linear; -o-transition: opacity 0.25s linear; transition: opacity 0.25s linear; opacity: 0'; this.ibartimer = window.setTimeout(() => {this.closeIBar(true)},250); return; } if (currentIbar.parentNode) { currentIbar.parentNode.removeChild(currentIbar); } delete this.ibar; this.infobars.shift(); if ( this.infobars.length > 0 ) { this.createIBar(); } }
		public addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number { var ico = document.createElement('div'); ico.className = 'decafmud status-icon ' + clss + ( onclick ? ' icon-click' : '' ); ico.innerHTML = html; ico.setAttribute('title', text); ico.setAttribute('role','status'); ico.setAttribute('aria-label', text); if ( onclick || onkey ) { ico.setAttribute('tabIndex','0'); } var ind = this.icons.push([ico,onclick as any,onkey as any]) - 1; for(var i=0; i < this.icons.length; i++) { this.icons[i][0].style.cssText = 'right:'+(((this.icons.length-i)-1)*21)+'px'; } this.tray.appendChild(ico); var si = this; if ( onclick ) { addEvent(ico, 'click', function(e) { onclick!.call(si,e); }); } if ( onclick && !onkey ) { addEvent(ico, 'keydown', function(e) { if ((e as KeyboardEvent).keyCode !== 13) { return; } onclick!.call(si,e); }); } if ( onkey ) { addEvent(ico, 'keydown', function(e) { onkey!.call(si,e as KeyboardEvent); }); } this._resizeTray(); return ind; }
		public delIcon(ind: number): void { if ( ind < 0 || ind >= this.icons.length ) { throw "Invalid index for icon!"; } var el_arr = this.icons[ind]; var el = el_arr[0]; this.icons.splice(ind,1); if (el.parentNode) { el.parentNode.removeChild(el); } for(var i=0; i < this.icons.length; i++) { this.icons[i][0].style.cssText = 'right:'+(((this.icons.length-i)-1)*21)+'px'; } this._resizeTray(); }
		public updateIcon(ind: number, text?: string, html?: string, clss?: string): void { if ( ind < 0 || ind >= this.icons.length ) { throw "Invalid index for icon!"; } var icon_arr = this.icons[ind]; var el = icon_arr[0]; var onclick = icon_arr[1]; if ( clss ) { el.className = 'decafmud status-icon ' + clss + ( onclick ? ' icon-click' : ''); } if ( html !== undefined ) { el.innerHTML = html; } if ( text ) { el.setAttribute('title', text); el.setAttribute('aria-label', text); } }
		public _resizeTray(): void { var w = this.tray.clientWidth; this._input.style.cssText = 'padding-right:'+w+'px'; }
		public showSidebar(): void { this.sidebar.style.display = 'inline'; }
		public hideSidebar(): void { this.sidebar.style.display = 'none'; }
		public showProgressBars(): void { this.progresstable.style.display = 'inline'; this.progresstable.style.height = "auto"; }
		public hideProgressBars(): void { this.progresstable.style.display = 'none'; this.progresstable.style.height = "0"; }
		public showMap(): void { this.mapdiv.style.display = 'inline'; }
		public hideMap(): void { this.mapdiv.style.display = 'none'; }
		public addProgressBar(name: string, col: string): void { var w = 100; var h = 20; var tr = document.createElement("tr"); this.progresstable.appendChild(tr); var td = document.createElement("td"); tr.appendChild(td); td.innerHTML = name + ":"; td = document.createElement("td"); tr.appendChild(td); var bar = document.createElement("div"); bar.style.width = w + 'px'; bar.style.height = h + 'px'; bar.style.backgroundColor = 'white'; bar.style.padding = '0px'; var progress = document.createElement("div"); progress.style.width = "0px"; progress.style.height = h + 'px'; progress.style.backgroundColor = col; progress.style.color = "black"; progress.style.padding = "0px"; progress.style.overflow = "hidden"; progress.style.overflowX = "visible"; var info = document.createElement("div"); info.style.width = bar.style.width; info.style.height = bar.style.height; info.style.marginTop = (-h) + "px"; info.style.textAlign = "center"; info.style.paddingTop = "3px"; info.style.fontWeight = "bold"; info.style.color = "black"; td.appendChild(bar); bar.appendChild(progress); td.appendChild(info); var i = this.progressbars.length; this.progressbars[i] = [name,progress,info]; }
		public setProgress(name: string, percent: number, txt: string): void { var w = 100; for (let i = 0; i < this.progressbars.length; i++) { if (this.progressbars[i][0] == name) { (this.progressbars[i][1] as HTMLElement).style.width = (percent*w/100) + "px"; (this.progressbars[i][2] as HTMLElement).innerHTML = txt; } } }
		public setProgressColor(name: string, col: string): void { for (let i = 0; i < this.progressbars.length; i++) { if (this.progressbars[i][0] == name) { (this.progressbars[i][1] as HTMLElement).style.backgroundColor = col; } } }
		public printMap(txt: string): void { this.mapdiv.innerHTML = "<hr><i>Map:</i><center>" + txt + "</center>"; }
		public maxPopupHeight(): number { var tot = this.container.offsetHeight - (this._input.offsetHeight + 50); if ( this.toolbarPadding ) { tot = tot - (this.toolbarPadding-12); } if ( tot < 0 ) { tot = 0; } return tot; }
		public maxPopupWidth(): number { var tot = this.container.offsetWidth - 12; if ( tot < 0 ) { tot = 0; } return tot; }
		public verticalPopupOffset(): number { return 50; }
		public horizontalPopupOffset(): number { return 0; }
		public hidePopup(): void { if (!this.popup) return; if (this.headerdrag) { this.headerdrag.dispose(); this.headerdrag = undefined; } if (this.popup.parentNode) { this.popup.parentNode.removeChild(this.popup); } this.popup = undefined; this.popupheader = undefined; if (this.input) { (this.input as HTMLElement).focus(); } }
		public showPopup(): HTMLElement { if (this.popup) this.hidePopup(); this.popup = document.createElement("div"); var w = this.maxPopupWidth(); var h = this.maxPopupHeight(); var t = this.verticalPopupOffset(); var l = this.horizontalPopupOffset(); l += w * 2 / 10; w = w * 6 / 10; h = h * 7 / 10; this.popup.style.width = w + "px"; this.popup.style.height = h + "px"; this.popup.style.top = t + "px"; this.popup.style.left = l + "px"; this.popup.className = 'decafmud window'; this.popup.id = "popup"; this.container.insertBefore(this.popup, this.el_display); this.popupheader = document.createElement("div"); this.popupheader.style.width = w + "px"; this.popupheader.style.height = "25px"; this.popupheader.style.top = "0px"; this.popupheader.className = 'decafmud window-header'; this.popupheader.id = "popupheader"; this.popup.appendChild(this.popupheader); if (this.popup && this.popupheader) { this.headerdrag = makeDraggable(this.popup as HTMLElement, this.popupheader as HTMLElement); } var x = document.createElement('button'); x.innerHTML = '<big>X</big>'; x.className = 'closebutton'; var si = this; addEvent(x, 'click', function() { si.hidePopup(); }); this.popup.appendChild(x); addEvent(this.popup, 'mousedown', function(e: Event) { if ( (e as MouseEvent).which == 1 && (window as any).open_menu !== -1 ) { (window as any).close_menus(); } }); return this.popup; }
		public popupHeader(text: string): void { if (!this.popup) return; var p = document.createElement("p"); p.innerHTML = text; p.className = "headertext"; this.popup.appendChild(p); }
		public buttonLine(par: HTMLElement): HTMLElement { var buttonline = document.createElement("p"); buttonline.style.textAlign = "center"; par.appendChild(buttonline); return buttonline; }
		public createButton(caption: string, func: string | Function): HTMLButtonElement { var btn = document.createElement("button"); btn.className = "prettybutton"; btn.innerHTML = "<big>" + caption + "</big>"; if (typeof func == 'string') btn.onclick = function() { eval(func); }; else btn.onclick = func as any; return btn; }
		public popupTextarea(name: string, adjust: number): HTMLTextAreaElement { if (!this.popup) throw new Error("Popup not shown"); var w = this.maxPopupWidth() * 6 / 10 - 15; var h = this.maxPopupHeight() * 7 / 10 - 100 - adjust; var textarea = document.createElement("textarea"); textarea.id = name; textarea.cols = 80; textarea.rows = 20; textarea.style.width = w + "px"; textarea.style.height = h + "px"; textarea.style.margin = "5px"; this.popup.appendChild(textarea); textarea.focus(); return textarea; }
		public popupTextdiv(): HTMLDivElement { if (!this.popup) throw new Error("Popup not shown"); var w = this.maxPopupWidth() * 6 / 10 - 10; var h = this.maxPopupHeight() * 7 / 10 - 60; var div = document.createElement("div"); div.style.width = w + "px"; div.style.height = h + "px"; div.style.margin = "5px"; div.style.overflowY = "auto"; this.popup.appendChild(div); return div; }
		public displayInput(text: string): void { if ( (!this.display) || (!this.echo) ) { return; } this.display.message("<span class=\"command\">" + text + "</span>",'user-input',false); }
		public localEcho(echo: boolean): void { if ( echo === this.echo ) { return; } this.echo = echo; this.updateInput(); }
		public maybeFocusInput(e: MouseEvent): void { var sel = window.getSelection(); if (sel && sel.toString() !== '' && this.el_display.contains(sel.focusNode?.parentNode as Node | null) ) { this.decaf.debugString('not focusing this.input: selection active'); return; } this.input.focus(); }
		public displayKey(e: KeyboardEvent): void { if (e.altKey || e.ctrlKey || e.metaKey ) { return; } if (!( (e.keyCode > 64 && e.keyCode < 91) || (e.keyCode > 47 && e.keyCode < 58) || (e.keyCode > 185 && e.keyCode < 193)||(e.keyCode > 218 && e.keyCode < 223) )) { return; } this.input.focus(); }
		public handleInputPassword(e: KeyboardEvent): void { if ( e.keyCode !== 13 ) { return; } this.inpFocus = true; this.decaf.sendInput(this.input.value); this.input.value = ''; }
		public saveInputInHistory(): void { let txt = this.input.value; if (txt == "") return; if (txt == this.history[0]) return; var lastid = -1; for (let i = 0; i < this.history.length; i++) { if (this.history[i] == txt) { lastid = i; break; } } if (lastid == -1) lastid = this.history.length-1; for (let i = lastid; i > 0; i--) this.history[i] = this.history[i-1]; this.history[0] = txt; }
		public inputModified(): boolean { let txt = this.input.value; if (this.historyPosition == -1) return txt !== ''; return txt !== this.history[this.historyPosition]; }
		public loadInput(): void { if (this.historyPosition == -1) this.input.value = ''; else { this.input.focus(); this.input.value = this.history[this.historyPosition]; } }
		public parseInput(inp: string): void { let lines = inp.split(';;'); for (var i = 0, c = lines.length; i < c; i++) { this.decaf.sendInput(lines[i]); } }
		public handleInput(e: KeyboardEvent): void { if ( e.type !== 'keydown' ) { return; } if ( e.keyCode == 112 || e.keyCode === 116 ) e.preventDefault(); if ( e.keyCode === 13 ) { this.parseInput(this.input.value); this.saveInputInHistory(); this.historyPosition = 0; if (!this.decaf.options.set_interface?.repeat_input) this.input.value = ''; this.input.select(); } else if ( typeof (window as any).tryExtraMacro !== 'undefined' && (window as any).tryExtraMacro(this.decaf, e.keyCode) ) { if (e.preventDefault) e.preventDefault(); else (e as any).returnValue = false; } else if ( e.keyCode === 33 ) { if ( this.display && this.display.scrollUp ) { this.display.scrollUp(); e.preventDefault(); } } else if ( e.keyCode === 34 ) { if ( this.display && this.display.scrollDown ) { this.display.scrollDown(); e.preventDefault(); } } else if ( e.keyCode == 40 ) { if (this.inputModified()) this.historyPosition = -1; if (this.historyPosition == -1) this.saveInputInHistory(); else if (this.historyPosition == 0) this.historyPosition = -1; else this.historyPosition = this.historyPosition-1; this.loadInput(); } else if ( e.keyCode == 38 ) { if (this.inputModified()) this.historyPosition = -1; if (this.historyPosition == -1) { if (this.input.value == '') this.historyPosition = 0; else { this.saveInputInHistory(); this.historyPosition = 1; } } else if (this.historyPosition < this.history.length-1) { this.historyPosition = this.historyPosition+1; } this.loadInput(); } else if ( e.keyCode == 8 && e.shiftKey === true ) { this.input.value = ''; } }
		public handleBlur(e: FocusEvent): void { var inp = this.input; var bc = this.decaf.options.set_interface?.blurclass; if ( e.type === 'blur' ) { if ( inp.value === '' && bc) { inp.className += ' ' + bc; } var si = this; setTimeout(function(){ if ( si.settings && si.set_mid ) { si.settings.style.top = '0px'; si.set_mid.style.overflowY = 'scroll'; } },100); this.inpFocus = false; } else if ( e.type === 'focus' ) { var parts = inp.className.split(' '), out = []; for(var i=0;i<parts.length;i++) { if ( parts[i] !== bc ) { out.push(parts[i]); } } inp.className = out.join(' '); if ( this.settings && this.set_mid ) { var t = -1* (this.settings.clientHeight * 0.5); this.settings.style.top = t + 'px'; this.set_mid.style.overflowY = 'hidden'; } this.inpFocus = true; } }
		public updateInput(force?: boolean): void { if ( !this.input ) return; var foc = this.inpFocus; var si = this, inp = this.input, type: string, tag = this.input.tagName; type = tag === 'TEXTAREA' ? 'text' : inp.type; if ( force !== true && ( (!this.echo && type === 'password') || (this.echo && type !== 'password') ) ) { return; } var cl = inp.className, st = inp.getAttribute('style'), id = inp.id, par = inp.parentNode as Node, pos = inp.nextElementSibling as Node | null; if ( pos === undefined ) { if ( inp.nextSibling && inp.nextSibling.nodeType === inp.nodeType ) { pos = inp.nextSibling; } } if ( !this.echo ) { this.inp_buffer = inp.value; var new_inp = document.createElement('input'); new_inp.type = 'password'; if ( cl ) { new_inp.className = cl; } if ( st ) { new_inp.setAttribute('style', st); } par.removeChild(inp); delete (this as any).input; if ( id ) { new_inp.id = id; } if ( pos ) { par.insertBefore(new_inp, pos); } else { par.appendChild(new_inp); } this.input = new_inp; addEvent(new_inp, 'keydown', (e) => { si.handleInputPassword(e as KeyboardEvent); }); } else { var lines = 1, new_inp_el: HTMLInputElement | HTMLTextAreaElement; if ( this.inp_buffer ) { lines = (this.inp_buffer.match(/\n/g) || []).length + 1; } if ( lines === 1 ) { new_inp_el = document.createElement('input'); new_inp_el.type = 'text'; } else { new_inp_el = document.createElement('textarea'); if ( bodyHack ) { new_inp_el.setAttribute('rows', String(lines-1)); } else { new_inp_el.setAttribute('rows', String(lines)); } } if ( cl ) { new_inp_el.className = cl; } if ( st ) { new_inp_el.setAttribute('style', st); } if ( this.inp_buffer ) { new_inp_el.value = this.inp_buffer; } par.removeChild(inp); delete (this as any).input; if ( id ) { new_inp_el.id = id; } if ( pos ) { par.insertBefore(new_inp_el, pos); } else { par.appendChild(new_inp_el); } this.input = new_inp_el as HTMLInputElement; addEvent(new_inp_el, 'keydown', (e) => { si.handleInput(e as KeyboardEvent); }); } this.inpFocus = foc; var helper = (e: Event) => { si.handleBlur(e as FocusEvent); }; addEvent(this.input, 'blur', helper); addEvent(this.input, 'focus', helper); if ( this.inpFocus ) { setTimeout(()=>{si.input.select();si.input.focus();},1); } }

}

// Expose this to DecafMUD
(DecafMUD_Global as any).plugins.Interface.panels = SimpleInterface;
})(window.DecafMUD);
