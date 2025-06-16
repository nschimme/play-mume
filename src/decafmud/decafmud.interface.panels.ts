import { DecafMUD } from './decafmud';
import { get_menus, toggle_menu, close_menus, open_menu } from './decafmud.interface.panels.menu';
import { dragObject } from './dragelement';
// SPDX-License-Identifier: MIT

// Ambient declaration for a global function
declare function tryExtraMacro(decaf: DecafMUD, keyCode: number): boolean;

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

const addEvent = function(node: any, etype: string, func: (...args: any[]) => void) {
		if ( node.addEventListener ) {
			node.addEventListener(etype, func, false); return; }

		etype = 'on' + etype;
		if ( node.attachEvent ) {
			node.attachEvent(etype, func); }
		else {
			node[etype] = func; }
	};

const delEvent = function(node: any, etype: string, func: (...args: any[]) => void) {
		if ( node.removeEventListener ) {
			node.removeEventListener(etype, func, false); }
	};

const bodyHack: boolean = typeof navigator !== 'undefined' ? /Firefox\//.test(navigator.userAgent) : false;

/** Helper for adding buttons to an IBar. */
function addButton(bar: HTMLElement, btn_data: [string, Function], si: any) { // Changed var to function, added types
	var b = document.createElement('a');
	b.className = 'button';
	b.setAttribute('href','#');
	b.setAttribute('onclick','return false;');
	b.innerHTML = btn_data[0];
	addEvent(b, 'click', function(e: Event) { // Typed e
		si.closeIBar(true);
		setTimeout(function(){ btn_data[1].call(si,e); },0);

		(e as any).cancelBubble = true; // Use as any
		if ( e.stopPropagation ) { e.stopPropagation() }

		return false; });
	bar.appendChild(b);
}


/** <p>This is a minimal user interface for DecafMUD, only providing a basic
 *  input handler if an input element is provided and rendering output to a
 *  display.</p>
 *  <p>Generally, you'll want to use the full interface for a richer user
 *  experience.</p>
 * @name SimpleInterface
 * @class DecafMUD User Interface: Simple
 * @exports SimpleInterface as DecafMUD.plugins.Interface.simple
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
const SimpleInterface = function(this: any, decaf: DecafMUD) {
	var si = this;

	this.decaf = decaf;
	this.container	= decaf.options.set_interface.container;

	if ( typeof this.container === 'string' ) {
		this.container = document.querySelector(this.container); }

	if (!(this.container instanceof Element)) {
		throw "The container must be a node in the DOM!"; }

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
    this.progressbars = new Array();
    this.mapdiv = document.createElement('div');
    this.mapdiv.style.display = 'none';
    this.sidebar.appendChild(this.mapdiv);

	this.el_display.onmouseup = this.maybeFocusInput.bind(this);
	addEvent(this.el_display,'keydown',function(e){si.displayKey(e)});
	addEvent(this.sidebar,'keydown',function(e){si.displayKey(e)});

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
	var h = function(this: HTMLElement){if(!this.className){return;}this.className = this.className.replace(' visible','');}
	addEvent(this.toolbar,'mousemove', h);
	addEvent(this.toolbar,'blur', h);

	this.input = document.createElement('input') as HTMLInputElement | HTMLTextAreaElement;
    (this.input as HTMLInputElement).id = "inputelement";
	(this.input as HTMLInputElement).title = "MUD Input".tr(this.decaf);
	(this.input as HTMLInputElement).type = 'text';
	this.input.className = 'decafmud input';
	this._input.insertBefore(this.input, this._input.firstChild);
	this.container.appendChild(this._input);

	addEvent(this.input,'keydown', function(e){si.handleInput(e);});

	var helper = function(e: FocusEvent) { si.handleBlur(e); }; // Typed e
	addEvent(this.input, 'blur', helper);
	addEvent(this.input, 'focus', helper);

    (this as any).history = [];
    (this as any).historyPosition = -1;
    for (let i = 0; i < 100; i++) { (this as any).history[i] = ''; }

	this.reset();
	addEvent(window, 'resize', this.resizeScreenFromEvent.bind(this, 'window resize'));
	if ("onhelp" in window)
		(window as any).onhelp = function() { return false; };
	window.onbeforeunload = this.unloadPageFromEvent.bind(this);
    (this.input as HTMLElement).focus();
	return this;
};
SimpleInterface.prototype.toString = function() {
	return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#'+this.container.id+')' : '') + '>'; }

SimpleInterface.prototype.toolbutton_id = -1;
SimpleInterface.prototype.echo = true;
SimpleInterface.prototype.inpFocus = false;
SimpleInterface.prototype.old_parent = undefined as HTMLElement | undefined; // Typed
SimpleInterface.prototype.next_sib = undefined as Element | null | undefined; // Typed
SimpleInterface.prototype.input = undefined as HTMLInputElement | HTMLTextAreaElement | undefined;
SimpleInterface.prototype.display = undefined as any;
SimpleInterface.prototype.splash = null as HTMLElement | null;
SimpleInterface.prototype.splash_st = null as HTMLElement | null;
SimpleInterface.prototype.splash_pgi = null as HTMLElement | null;
SimpleInterface.prototype.splash_pgt = null as HTMLElement | null;
SimpleInterface.prototype.splash_old = null as HTMLElement | null;
SimpleInterface.prototype.scrollButton = undefined as HTMLElement | undefined;
SimpleInterface.supports = {
	'tabComplete'   : true,
	'multipleOut'   : false,
	'fullscreen'    : true,
	'editor'        : false,
	'splash'        : true
};

SimpleInterface.prototype.initSplash = function(percentage?: number, message?: string) { // Optional params
	if ( percentage === undefined ) { percentage = 0; }
	if ( message === undefined ) { message = 'Discombobulating interface recipient...'.tr(this.decaf); }

	this.old_y = this.el_display.style.overflowY;
	this.el_display.style.overflowY = 'hidden';
	this.splash = document.createElement('div');
	this.splash!.className = 'decafmud splash'; // Non-null assertion
	this.splash!.innerHTML  = '<h2 class="decafmud heading"><a href="http://decafmud.stendec.me/">DecafMUD</a> <span class="version">v'+DecafMUD.version+'</span></h2>';
	this.splash_pg = document.createElement('div');
	this.splash_pg.className = 'decafmud progress';
	this.splash_pg.setAttribute('role','progressbar');
	this.splash_pg.setAttribute('aria-valuemax', "100");
	this.splash_pg.setAttribute('aria-valuemin', "0");
	this.splash_pg.setAttribute('aria-valuenow', String(percentage));
	this.splash_pg.setAttribute('aria-valuetext', '{0}%'.tr(this.decaf,percentage));
	this.splash_pgi = document.createElement('div');
	this.splash_pgi!.className = 'decafmud inner-progress'; // Non-null assertion
	this.splash_pgi!.style.cssText = 'width:'+percentage+'%;';
	this.splash_pg.appendChild(this.splash_pgi!);
	this.splash_pgt = document.createElement('div');
	this.splash_pgt!.className = 'decafmud progress-text'; // Non-null assertion
	this.splash_pgt!.innerHTML = '{0}%'.tr(this.decaf,percentage);
	this.splash_pg.appendChild(this.splash_pgt!);
	this.splash!.appendChild(this.splash_pg);
	this.splash_st = document.createElement('div');
	this.splash_st!.className = 'decafmud status'; // Non-null assertion
	this.splash_st!.innerHTML = message;
	this.splash!.appendChild(this.splash_st!);
	this.splash_old = document.createElement('div');
	this.splash_old!.className = 'decafmud old'; // Non-null assertion
	this.splash_old!.innerHTML = '';
	this.splash!.appendChild(this.splash_old!);
	this.container.appendChild(this.splash!);
}

SimpleInterface.prototype.endSplash = function() {
	if (this.splash) this.container.removeChild(this.splash);
	this.el_display.style.overflowY = this.old_y;
	(this as any).splash_err = false; // Use as any for dynamic prop
	this.splash = this.splash_pg = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
}

SimpleInterface.prototype.updateSplash = function(percentage?: number, message?: string) { // Optional params
	if ( this.splash === null || (this as any).splash_err ) { return; } // Use as any
	if ( percentage !== undefined ) {
		const t_percent = '{0}%'.tr(this.decaf, percentage) as string;
		this.splash_pg!.setAttribute('aria-valuenow', String(percentage)); // Non-null assertion
		this.splash_pg!.setAttribute('aria-valuetext', t_percent);
		this.splash_pgt!.innerHTML = t_percent; // Non-null assertion
		this.splash_pgi!.style.cssText = 'width:'+percentage+'%;'; // Non-null assertion
	}
	if (!message) { return; }
	var e = document.createElement('div');
	let current_message_html = this.splash_st!.innerHTML; // Non-null assertion
	if ( current_message_html.endsWith('...') ) { current_message_html += 'done.'; }
	e.innerHTML = current_message_html;
	this.splash_old!.insertBefore(e, this.splash_old!.firstChild); // Non-null assertion
	this.splash_st!.innerHTML = message; // Non-null assertion
}

SimpleInterface.prototype.splashError = function(message: string) {
	if ( this.splash === null ) { return false; }
	this.splash_pgt!.innerHTML = '<b>Error</b>'; // Non-null assertion
	this.splash_pgi!.className += ' error'; // Non-null assertion
	this.splash_st!.innerHTML = message; // Non-null assertion
	(this as any).splash_err = true; // Use as any
	return true;
}

SimpleInterface.prototype.sizeel = undefined as HTMLElement | undefined;
SimpleInterface.prototype.sizetm = undefined as any;

SimpleInterface.prototype.showSize = function() {
	clearTimeout(this.sizetm);
	if ( this.display === undefined ) { return; }
	if ( this.sizeel === undefined ) {
		this.sizeel = document.createElement('div');
		this.sizeel.className = 'decafmud note center';
		this.container.appendChild(this.sizeel);
	}
	var sz = this.display.getSize();
	this.sizeel.style.cssText = 'opacity:1';
	this.sizeel.innerHTML = "{0}x{1}".tr(this.decaf, sz[0], sz[1]);
	var si = this;
	this.sizetm = setTimeout(function(){si.hideSize()},500);
}

SimpleInterface.prototype.hideSize = function(fnl?: boolean) {
	clearTimeout(this.sizetm);
	if ( fnl === true ) {
		if ( this.decaf.telopt[DecafMUD.TN.NAWS] !== undefined ) {
			try { this.decaf.telopt[DecafMUD.TN.NAWS].send(); }
			catch(err) { }
		}
		if (this.sizeel && this.sizeel.parentNode) this.sizeel.parentNode.removeChild(this.sizeel); // Check parentNode
		this.sizeel = undefined;
		return;
	}
	if (this.sizeel) {
		this.sizeel.style.cssText  = '-webkit-transition: opacity 0.25s linear;';
		this.sizeel.style.cssText += '-moz-transition: opacity 0.25s linear;';
		this.sizeel.style.cssText += '-o-transition: opacity 0.25s linear;';
		this.sizeel.style.cssText += 'transition: opacity 0.25s linear;';
		var si = this;
		setTimeout(function(){ if(si.sizeel) si.sizeel.style.opacity='0';},0);
		this.sizetm = setTimeout(function(){si.hideSize(true)},250);
	}
}

SimpleInterface.prototype.print_msg = function(txt: string) {
  if (this.display) this.display.message("<span class=\"c6\">" + txt + "</span>");
}

SimpleInterface.prototype.connected = function() {
	this.updateIcon((this as any).ico_connected, "DecafMUD is currently connected.".tr(this.decaf), // Use as any
		'', 'connectivity connected');
}

SimpleInterface.prototype.connecting = function() {
  this.print_msg(this.decaf.options.set_interface.msg_connecting);
  if (this.decaf.options.set_interface.connect_hint)
  {
    if (this.decaf.options.socket == "websocket") {
      this.display.message("<span>You are connecting using <i>websockets</i> " +
        "on port " + this.decaf.options.set_socket.wsport + ".  If this does " +
        "not work (for example because the port is blocked or you have an " +
        "older version of websockets), you can connecting with flash.  To do " +
        "so, open <a href=\"web_client.html?socket=flash\">the flash version</a> " +
        "instead.</span>");
    }
    else {
      this.display.message("<span>You are connecting using <i>flash</i> " +
        "on port " + this.decaf.options.port + ".  To connect using " +
        "websockets, make sure you have an up-to-date browser which " +
        "supports this, and open " +
        "<a href=\"web_client.html?socket=websocket\">the websocket version</a> " +
        "instead.</span>");
    }
  }
  this.updateIcon((this as any).ico_connected, // Use as any
                  "DecafMUD is attempting to connect.".tr(this.decaf),
                  '', 'connectivity connecting');
}

SimpleInterface.prototype.disconnected = function() {
  this.print_msg("Connection closed.");
  this.updateIcon((this as any).ico_connected, // Use as any
                  "DecafMUD is currently not connected.".tr(this.decaf),
                  '', 'connectivity disconnected');
}

SimpleInterface.prototype.unloadPageFromEvent = function(e: BeforeUnloadEvent) {
	if (this.decaf.connected) {
		return "You are still connected.";
	}
}

SimpleInterface.prototype.load = function() {
	this.decaf.require('decafmud.display.'+this.decaf.options.display);
}

SimpleInterface.prototype.reset = function() {
	(this as any).masked = false; // Use as any
	(this as any).inputCtrl = false; // Use as any
	(this as any).hasFocus	= false; // Use as any
	(this as any).reqTab = false; // Use as any
	(this as any).wantTab = false; // Use as any
	(this as any).tabIndex = -1; // Use as any
	(this as any).tabValues = []; // Use as any
	(this as any).buffer = ''; // Use as any
	if ( this.input !== undefined ) { this.updateInput(); }
	if ( this.display !== undefined ) { this.display.reset(); }
};

SimpleInterface.prototype.setup = function() {
	(this as any).store = this.decaf.store.sub('ui'); // Use as any
	(this as any).storage = (this as any).store; // Use as any
	var tbar_pos = (this as any).store.get('toolbar-position','top-left');
	(this as any).old_tbarpos = tbar_pos;
	this.toolbar.className += ' ' + tbar_pos;
	this.container.insertBefore(this.toolbar, this.container.firstChild);
	var display_type = this.decaf.options.display;
	this.decaf.debugString('Initializing display plugin "'+display_type+'" in: #' + this.el_display.id,'info');
	this.display = new (DecafMUD.plugins as any).Display[display_type](this.decaf, this, this.el_display);
    this.display.id = 'mud-display';
	this.decaf.display = this.display;
    const menus = get_menus();
    for (let i = 0; i < menus.length; i+=3) {
      this.tbNew(
        menus[i],
        menus[i+1].tr(this.decaf),
        undefined, // icon
        menus[i+2].tr(this.decaf), // tooltip
        String(1), // type
        true, // enabled
        false, // pressed
        undefined, // clss
        function(idx: number) {return function(e: Event) {toggle_menu(idx/3);}} (i)
      );
    }
	(this as any).goFullOnResize = false;
	var fs = (this as any).store.get('fullscreen-start', this.decaf.options.set_interface.start_full);
	(this as any).ico_connected = this.addIcon("You are currently disconnected.".tr(this.decaf), '', 'connectivity disconnected');
	if ( fs ) { this.enter_fs(false);
	} else { if ( ! this._resizeToolbar() ) { this.resizeScreen(false); } }
}

SimpleInterface.prototype.tbDelete = function(id: number) {
	if ( this.toolbuttons[id] === undefined ) { return; }
	let btn_arr = this.toolbuttons[id];
	if (btn_arr && btn_arr[0] && btn_arr[0].parentNode) {
	  btn_arr[0].parentNode.removeChild(btn_arr[0]);
	}
	this.toolbuttons[id] = undefined;
	this._resizeToolbar();
}

SimpleInterface.prototype.tbPressed = function(id: number, pressed: boolean | string) {
	var btn_arr = this.toolbuttons[id];
	if ( btn_arr === undefined ) { throw "Invalid button ID."; }
	const isPressed = typeof pressed === 'string' ? (pressed === 'true') : !!pressed;
	btn_arr[6] = isPressed;
	btn_arr[0].setAttribute('aria-pressed', String(isPressed));
	if ( isPressed ) {
		if ( /toggle-depressed/.test(btn_arr[0].className) ) {
			btn_arr[0].className = btn_arr[0].className.replace(' toggle-depressed',' toggle-pressed'); }
	} else {
		if ( /toggle-pressed/.test(btn_arr[0].className) ) {
			btn_arr[0].className = btn_arr[0].className.replace(' toggle-pressed',' toggle-depressed'); }
	}
}

SimpleInterface.prototype.tbNew = function(
    this: any, // Add this type
    btnid: string,
    text_or_icon_or_onclick: string | Function,
    icon_or_tooltip_or_type?: string | Function | number | boolean,
    tooltip_or_type_or_enabled?: string | Function | number | boolean,
    type_or_enabled_or_pressed?: number | string | Function | boolean,
    enabled_or_pressed_or_clss?: boolean | Function | string,
    pressed_or_clss?: boolean | Function | string,
    clss_or_onc?: string | Function,
    actual_onclick_param?: Function
) {
    let text: string = btnid; // Default: first param is btnid, which is not text
    let icon: string | undefined = undefined;
    let tooltip: string | undefined = undefined;
    let type: number | string = 0;
    let enabled: boolean = true;
    let pressed: boolean = false;
    let clss: string | undefined = undefined;
    let onclick: Function | undefined = undefined;

    if (typeof text_or_icon_or_onclick === 'function') { // Shortest form: tbNew(id, onclick)
        onclick = text_or_icon_or_onclick;
        text = btnid; // Use btnid as text if only id and onclick are provided
    } else {
        text = text_or_icon_or_onclick; // First param after id is text
        if (typeof icon_or_tooltip_or_type === 'function') { // tbNew(id, text, onclick)
            onclick = icon_or_tooltip_or_type;
        } else {
            icon = icon_or_tooltip_or_type as string | undefined;
            if (typeof tooltip_or_type_or_enabled === 'function') { // tbNew(id, text, icon, onclick)
                onclick = tooltip_or_type_or_enabled;
            } else {
                tooltip = tooltip_or_type_or_enabled as string | undefined;
                if (typeof type_or_enabled_or_pressed === 'function') { // tbNew(id, text, icon, tooltip, onclick)
                    onclick = type_or_enabled_or_pressed;
                } else {
                    type = type_or_enabled_or_pressed as number | string;
                    if (typeof enabled_or_pressed_or_clss === 'function') { // tbNew(id, text, icon, tooltip, type, onclick)
                        onclick = enabled_or_pressed_or_clss;
                    } else {
                        enabled = enabled_or_pressed_or_clss as boolean;
                        if (typeof pressed_or_clss === 'function') { // tbNew(id, text, icon, tooltip, type, enabled, onclick)
                            onclick = pressed_or_clss;
                        } else {
                            pressed = pressed_or_clss as boolean;
                            if (typeof clss_or_onc === 'function') { // tbNew(id, text, icon, tooltip, type, enabled, pressed, onclick)
                                onclick = clss_or_onc;
                            } else {
                                clss = clss_or_onc as string | undefined;
                                onclick = actual_onclick_param; // Full form
                            }
                        }
                    }
                }
            }
        }
    }

	var ind = ( ++this.toolbutton_id );
	var btn_el = document.createElement('span');
    btn_el.id = btnid; // btnid is always the first param
	btn_el.className = 'decafmud button toolbar-button';
	if ( clss ) { btn_el.className += ' ' + clss; }
	if ( type === 1 || type === "1" ) { btn_el.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }
	btn_el.innerHTML = text;
	if ( tooltip ) { btn_el.title = tooltip; }
	else { btn_el.title = text; } // Fallback to text if tooltip undefined
	if ( enabled === false ) { btn_el.className += ' disabled'; } // only add if explicitly false
    else { enabled = true; } // default to true
	btn_el.setAttribute('tabIndex','0');
	btn_el.setAttribute('role','button');
	btn_el.setAttribute('aria-disabled', String(!enabled));
	if ( type === 1 || type === "1" ) {
		btn_el.setAttribute('aria-pressed', String(!!pressed)); }
	if ( icon ) {
		btn_el.style.backgroundImage = 'url('+icon+')';
		btn_el.className += ' icon'; }
	if ( onclick ) {
		var si = this;
		var click_helper = function(e: Event) {
			if ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; }
			var tb_btn_arr = si.toolbuttons[ind];
			if ( tb_btn_arr[5] !== true ) { return; }
			(onclick as Function).call(si, e); // Cast onclick to Function
			if ( e.type && e.type !== 'keydown' ) { (tb_btn_arr[0] as HTMLElement).blur(); }
		}
		addEvent(btn_el, 'click', click_helper);
		addEvent(btn_el, 'keydown', click_helper);
	}
	addEvent(btn_el,'focus',function(this: HTMLElement, e: FocusEvent) {
		if (! this.parentNode ) { return; }
		if (/toolbar/.test((this.parentNode as HTMLElement).className)) {
			(this.parentNode as HTMLElement).setAttribute('aria-activedescendant', this.id);
			(this.parentNode as HTMLElement).className += ' visible'; }
	});
	addEvent(btn_el,'blur',function(this: HTMLElement, e: FocusEvent) {
		if (! this.parentNode ) { return; }
		if (/toolbar/.test((this.parentNode as HTMLElement).className)) {
			if ( (this.parentNode as HTMLElement).getAttribute('aria-activedescendant') === this.id ) {
				(this.parentNode as HTMLElement).setAttribute('aria-activedescendant', ''); }
			(this.parentNode as HTMLElement).className = (this.parentNode as HTMLElement).className.replace(' visible',''); }
	});
	this.toolbuttons[ind] = [btn_el,text,icon,tooltip,type,enabled,pressed,clss,onclick];
	btn_el.setAttribute('button-id', String(ind));
	this.toolbar.appendChild(btn_el);
	this._resizeToolbar();
	return ind;
}

SimpleInterface.prototype.toolbarPadding = undefined as number | undefined;

SimpleInterface.prototype.createIBar = function() {
	var si = this,
		ibar_data = this.infobars[0],
		obj = document.createElement('div');
	obj.setAttribute('role', 'alert');
	obj.className = 'decafmud infobar ' + ibar_data['class'];
	obj.innerHTML = ibar_data.text;
	obj.style.cssText = 'top: -26px;';
	if ( ibar_data.click !== undefined ) {
		obj.className += ' clickable';
		obj.setAttribute('tabIndex','0');
	}
	var closer = function(e: Event) {
        const keyboardEvent = e as KeyboardEvent;
		if ( e === undefined || ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode !== 13 && keyboardEvent.keyCode !== 27 )) { return; }
		if ( e.type === 'click' && !ibar_data.click ) { return; }
		(e as any).cancelBubble = true;
		if ( e.stopPropagation ) { e.stopPropagation() }
		si.closeIBar(true);
		if ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode === 27 ) {
			if ( ibar_data.close ) {
				ibar_data.close.call(si, e); }
			return; }
		if ( ibar_data.click ) {
			ibar_data.click.call(si, e); }
	};
	addEvent(obj, 'click', closer);
	addEvent(obj, 'keydown', closer);
	var closebtn = document.createElement('div');
	closebtn.innerHTML = 'X';
	closebtn.className = 'close';
	closebtn.setAttribute('tabIndex','0');
	var close_helper = function(e: Event) {
        const keyboardEvent = e as KeyboardEvent;
		if ( e === undefined || ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode !== 13 )) { return; }
		si.closeIBar(true);
		if ( ibar_data.close ) { ibar_data.close.call(si, e); }
		(e as any).cancelBubble = true;
		if ( e.stopPropagation ) { e.stopPropagation() }
	};
	addEvent(closebtn, 'click', close_helper);
	addEvent(closebtn, 'keydown', close_helper);
	obj.insertBefore(closebtn, obj.firstChild);
	if ( ibar_data.buttons ) {
		const btncont = document.createElement('div');
		btncont.className = 'btncont';
		for(let i=0; i<ibar_data.buttons.length; i++) {
			addButton(btncont, ibar_data.buttons[i], this);
		}
		obj.insertBefore(btncont, closebtn);
	}
	(this as any).ibar = obj; // Use as any
	ibar_data.el = obj;
	this.container.insertBefore(obj, this.container.firstChild);
	setTimeout(function(){
		var pt = 0;
		if ( window.getComputedStyle ) {
			pt = parseInt(window.getComputedStyle(obj,null).paddingTop); }
		if ( si.toolbarPadding ) { pt += si.toolbarPadding - 10; }
		obj.style.cssText = 'background-position: 5px '+pt+'px;' +
			'padding-top: '+pt+'px;' +
			'-webkit-transition: top 0.1s linear;' +
			'-moz-transition: top 0.1s linear;' +
			'-o-transition: top 0.1s linear;' +
			'transition: top 0.1s linear; top: inherit';
		if ( ibar_data.icon ) {
			obj.style.backgroundImage = 'url("'+ibar_data.icon+'")'; }
	},0);
	if ( ibar_data.timeout > 0 ) {
		(this as any).ibartimer = setTimeout(function() { // Use as any
			si.closeIBar(); }, 1000 * ibar_data.timeout);
	}
}

SimpleInterface.prototype.closeIBar = function(steptwo?: boolean) {
	if ( (this as any).ibar === undefined ) { return; } // Use as any
	clearTimeout((this as any).ibartimer); // Use as any
	if ( !steptwo ) {
		(this as any).ibar.style.cssText += '-webkit-transition: opacity 0.25s linear;' +
			'-moz-transition: opacity 0.25s linear;' +
			'-o-transition: opacity 0.25s linear;' +
			'transition: opacity 0.25s linear; opacity: 0';
		var si = this;
		(this as any).ibartimer = setTimeout(function(){si.closeIBar(true)},250);
		return;
	}
    if ((this as any).ibar && (this as any).ibar.parentNode) {
	    (this as any).ibar.parentNode.removeChild((this as any).ibar);
    }
	(this as any).ibar = undefined;
	this.infobars.shift();
	if ( this.infobars.length > 0 ) {
		this.createIBar(); }
}

SimpleInterface.prototype.resizeScreen = function(showSize?: boolean, force?: boolean) {
	if ( (this as any).goFullOnResize ) { // Use as any
		var fs = !!document.fullscreenElement;
		if ( !fs ) {
			if ( window.outerHeight ) { fs = (window.screen.height - window.outerHeight) <= 5; }
			else if ( window.innerHeight ) { fs = (window.screen.height - window.innerHeight <= 5); }
		}
		if ( fs && !(this as any).old_fs ) { // Use as any
			(this as any).old_fs = fs;
			this.enter_fs();
			return;
		} else if ( !fs && (this as any).old_fs ) { // Use as any
			(this as any).old_fs = fs;
			this.exit_fs();
			return;
		}
		(this as any).old_fs = fs;
	}
	if ( force !== true && (this as any).old_height === this.container.offsetHeight && (this as any).old_width === this.container.offsetWidth ) { return; }
    if (this.popup) this.hidePopup();
	(this as any).old_height = this.container.offsetHeight;
	(this as any).old_width = this.container.offsetWidth;
	var tot = (this as any).old_height - (this._input.offsetHeight + 17);
	if ( this.toolbarPadding ) { tot = tot - (this.toolbarPadding-12); }
	if ( tot < 0 ) { tot = 0; }
	if ( this.popup && (this as any).set_mid ) { (this as any).set_mid.style.height = tot + 'px'; }
	if ( this.toolbarPadding ) {
		tot -= 12;
		if ( tot < 0 ) { tot = 0; }
	}
	this.el_display.style.height = tot + 'px';
	if ( force !== true && this.display ) { this.display.scroll(); }
	if ( this.scrollButton ) {
		this.scrollButton.style.cssText = 'bottom:' + (this._input.offsetHeight + 12) + 'px';
	}
	if ( showSize !== false ) {
		this.showSize(); }
};

SimpleInterface.prototype.createButton = function(caption: string, func: string | Function | null) { // Allow null for func
  var btn = document.createElement("button");
  btn.className = "prettybutton";
  btn.innerHTML = "<big>" + caption + "</big>";
  if (typeof func === 'string' || func instanceof String) {
    const funcStr = func.toString();
    btn.onclick = function() { eval(funcStr); }
  } else if (typeof func === 'function') {
    btn.onclick = func as (event: MouseEvent) => any;
  }
  return btn;
}

SimpleInterface.prototype.saveInputInHistory = function() {
  let txt = (this.input as HTMLInputElement).value;
  if (txt == "") return;
  if (txt == (this as any).history[0]) return;
  var lastid = -1;
  for (let i = 0; i < (this as any).history.length; i++) {
    if ((this as any).history[i] == txt) {
      lastid = i;
      break;
    }
  }
  if (lastid == -1) lastid = (this as any).history.length-1;
  for (let i = lastid; i > 0; i--) (this as any).history[i] = (this as any).history[i-1];
  (this as any).history[0] = txt;
}

SimpleInterface.prototype.inputModified = function(): boolean {
  let txt = (this.input as HTMLInputElement).value;
  if ((this as any).historyposition == -1) return txt !== '';
  return txt !== (this as any).history[(this as any).historyPosition];
}

SimpleInterface.prototype.loadInput = function() {
  if ((this as any).historyPosition == -1) (this.input as HTMLInputElement).value = '';
  else {
    (this.input as HTMLElement).focus();
    (this.input as HTMLInputElement).value = (this as any).history[(this as any).historyPosition];
  }
}

SimpleInterface.prototype.handleInput = function(e: KeyboardEvent) {
  if ( e.type !== 'keydown' ) { return; }
  if ( e.keyCode == 112 || e.keyCode === 116 ) e.preventDefault();
  if ( e.keyCode === 13 ) {
    this.parseInput((this.input as HTMLInputElement).value);
    this.saveInputInHistory();
    (this as any).historyPosition = 0;
    if (!this.decaf.options.set_interface.repeat_input)
      (this.input as HTMLInputElement).value = '';
    (this.input as HTMLInputElement).select();
  }
  else if ( typeof tryExtraMacro !== 'undefined'
      && tryExtraMacro(this.decaf, e.keyCode) ) {
    if (e.preventDefault) e.preventDefault();
    else (e as any).returnValue = false;
  }
  else if ( e.keyCode === 33 ) { if ( this.display && this.display.scrollUp ) { this.display.scrollUp(); e.preventDefault(); } }
  else if ( e.keyCode === 34 ) { if ( this.display && this.display.scrollDown ) { this.display.scrollDown(); e.preventDefault(); } }
  else if ( e.keyCode == 40 ) {
    if (this.inputModified()) (this as any).historyPosition = -1;
    if ((this as any).historyPosition == -1) this.saveInputInHistory();
    else if ((this as any).historyPosition == 0) (this as any).historyPosition = -1;
    else (this as any).historyPosition = (this as any).historyPosition-1;
    this.loadInput();
  }
  else if ( e.keyCode == 38 ) {
    if (this.inputModified()) (this as any).historyPosition = -1;
    if ((this as any).historyPosition == -1) {
      if ((this.input as HTMLInputElement).value == '') (this as any).historyPosition = 0;
      else { this.saveInputInHistory(); (this as any).historyPosition = 1; }
    }
    else if ((this as any).historyPosition < (this as any).history.length-1) {
      (this as any).historyPosition = (this as any).historyPosition+1;
    }
    this.loadInput();
  }
  else if ( e.keyCode == 8 && e.shiftKey === true ) { (this.input as HTMLInputElement).value = ''; }
}

SimpleInterface.prototype.handleBlur = function(e: FocusEvent) {
	var inp = this.input as HTMLInputElement | HTMLTextAreaElement,
		bc	= this.decaf.options.set_interface.blurclass;
	if ( e.type === 'blur' ) {
		if ( inp.value === '' ) { inp.className += ' ' + bc; }
		var si = this;
		setTimeout(function(){
			if ( (si as any).settings ) {
				(si as any).settings.style.top = '0px';
				(si as any).set_mid.style.overflowY = 'scroll';
			}
		},100);
		this.inpFocus = false;
	}
	else if ( e.type === 'focus' ) {
		var parts = inp.className.split(' '), out = [];
		for(let i=0;i<parts.length;i++) {
			if ( parts[i] !== bc ) { out.push(parts[i]); } }
		inp.className = out.join(' ');
		if ( (this as any).settings ) {
			const settings_t = -1* ((this as any).settings.clientHeight * 0.5);
			(this as any).settings.style.top = settings_t + 'px';
			(this as any).set_mid.style.overflowY = 'hidden';
		}
		this.inpFocus = true;
	}
}

SimpleInterface.prototype.updateInput = function(force?: boolean) {
	if ( !this.input ) return;
	var foc = this.inpFocus;
	var si = this;
    let inp = this.input as HTMLInputElement | HTMLTextAreaElement;
    var type: string, tag = inp.tagName;
	type = tag === 'TEXTAREA' ? 'text' : (inp as HTMLInputElement).type;
	if ( force !== true && ( (!this.echo && type === 'password') || (this.echo && type !== 'password') ) ) {
		return; }
	var cl	= inp.className,
		st	= inp.getAttribute('style'),
		id	= inp.id,
		par	= inp.parentNode as Node,
		pos;
	pos = inp.nextElementSibling;
	if ( pos === undefined ) {
		if ( inp.nextSibling && inp.nextSibling.nodeType === inp.nodeType ) {
			pos = inp.nextSibling; }
	}
	if ( !this.echo ) {
		(this as any).inp_buffer = inp.value; // Use as any
		let new_inp_pass = document.createElement('input');
		new_inp_pass.type = 'password';
		if ( cl ) { new_inp_pass.className = cl; }
		if ( st ) { new_inp_pass.setAttribute('style', st); }
		if (par) par.removeChild(inp);
		if ( id ) { new_inp_pass.id = id; }
		if ( pos ) { par.insertBefore(new_inp_pass, pos);
		} else { par.appendChild(new_inp_pass); }
		this.input = new_inp_pass;
		addEvent(new_inp_pass, 'keydown', function(e){ si.handleInputPassword(e); });
	} else {
		var lines = 1;
        let new_inp_text: HTMLInputElement | HTMLTextAreaElement;
		if ( (this as any).inp_buffer ) { // Use as any
			lines = (this as any).inp_buffer.substr_count('\n') + 1; }
		if ( lines === 1 ) {
			new_inp_text = document.createElement('input');
			(new_inp_text as HTMLInputElement).type = 'text';
		} else {
			new_inp_text = document.createElement('textarea');
			if ( bodyHack ) {
				(new_inp_text as HTMLTextAreaElement).setAttribute('rows', String(lines-1));
			} else {
				(new_inp_text as HTMLTextAreaElement).setAttribute('rows', String(lines)); }
		}
		if ( cl ) { new_inp_text.className = cl; }
		if ( st ) { new_inp_text.setAttribute('style', st); }
		if ( (this as any).inp_buffer ) { // Use as any
			new_inp_text.value = (this as any).inp_buffer; }
		if (par) par.removeChild(inp);
		if ( id ) { new_inp_text.id = id; }
		if ( pos ) { par.insertBefore(new_inp_text, pos);
		} else { par.appendChild(new_inp_text); }
		this.input = new_inp_text;
		addEvent(new_inp_text, 'keydown', function(e){ si.handleInput(e); });
	}
	this.inpFocus = foc;
	var blur_focus_helper = function(e: FocusEvent) { si.handleBlur(e); };
	addEvent(this.input, 'blur', blur_focus_helper);
	addEvent(this.input, 'focus', blur_focus_helper);
	if ( this.inpFocus ) {
        const currentInput = this.input;
		setTimeout(function(){
            if (currentInput && typeof (currentInput as any).select === 'function') {
                 (currentInput as any).select();
            }
            if (currentInput) (currentInput as HTMLElement).focus();
        },1);
	}
};

(DecafMUD.plugins as any).Interface.panels = SimpleInterface;
