// SPDX-License-Identifier: MIT
import { IDecafMUD, IUi, IStorage, IDisplay } from './decafmud.types';

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

(function(DecafMUD_Global) { // Renamed to avoid conflict with imported IDecafMUD

var addEvent = function(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
		if ( node.addEventListener ) {
			node.addEventListener(etype, func, false); return; }

		// Fallback for older browsers (less type-safe)
		const onEtype = 'on' + etype as keyof EventTarget;
		if ((node as any).attachEvent ) {
			(node as any).attachEvent(onEtype, func); }
		else {
			(node as any)[onEtype] = func; }
	},
	delEvent = function(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
		if ( node.removeEventListener ) {
			node.removeEventListener(etype, func, false); }
	};

var bodyHack = /Firefox\//.test(navigator.userAgent);

/** <p>This is a minimal user interface for DecafMUD, only providing a basic
 *  input handler if an input element is provided and rendering output to a
 *  display.</p>
 *  <p>Generally, you'll want to use the full interface for a richer user
 *  experience.</p>
 * @name SimpleInterface
 * @class DecafMUD User Interface: Simple
 * @exports SimpleInterface as DecafMUD.plugins.Interface.simple
 * @param {IDecafMUD} decaf The instance of DecafMUD using this plugin. */
var SimpleInterface = function(this: IUi, decaf: IDecafMUD): IUi {
	var si = this;

	// Store the instance of DecafMUD.
	this.decaf = decaf;

	// If we have elements, get them.
	let containerElement: HTMLElement | null = null;
	if (typeof decaf.options.set_interface!.container === 'string') {
		containerElement = document.querySelector(decaf.options.set_interface!.container as string);
	} else if (decaf.options.set_interface!.container instanceof HTMLElement) {
		containerElement = decaf.options.set_interface!.container;
	}

	if (!containerElement || !('nodeType' in containerElement) ) {
		throw "The container must be a valid DOM element or selector!";
	}
	this.container = containerElement;

	// Build our element tree.
	this.container.setAttribute('role', 'application');
	this.container.className += ' decafmud mud interface';

	// Make the display container
	this.el_display = document.createElement('div');
	this.el_display.className = 'decafmud mud-pane primary-pane';
	this.el_display.setAttribute('role', 'log');
	this.el_display.setAttribute('aria-live', 'assertive');
	this.el_display.setAttribute('tabIndex','0');
	this.container.appendChild(this.el_display);

	// Handle keypresses in scrollback.
	addEvent(this.el_display,'keydown',function(e){ si.displayKey!(e as KeyboardEvent); });

	// Put the input in a container.
	this._input = document.createElement('div');
	this._input.className = 'decafmud input-cont';

	// Create a container for the icons.
	this.tray = document.createElement('div');
	this.tray.className = 'decafmud icon-tray';
	this._input.appendChild(this.tray);

	// A variable for storing toolbar buttons.
	this.toolbuttons = {};

	// A variable for storing queued information bars.
	this.infobars = [];

	// A variable for storing notification icons.
	this.icons = [];

	// Create the toolbar. Don't attach it yet though.
	this.toolbar = document.createElement('div');
	this.toolbar.className = 'decafmud toolbar';
	this.toolbar.setAttribute('role','toolbar');
	var h = function(this: HTMLElement){if(!this.className){return;}this.className = this.className.replace(' visible','');}
	addEvent(this.toolbar,'mousemove', h);
	addEvent(this.toolbar,'blur', h);

	// Make the input element.
	const inputEl = document.createElement('input');
	inputEl.title = "MUD Input"; // Removed .tr
	inputEl.setAttribute('role','textbox');
	inputEl.setAttribute('aria-label', inputEl.title);
	inputEl.type = 'text';
	inputEl.className = 'decafmud input';
	this.input = inputEl; // Assign to typed property
	this._input.insertBefore(this.input, this._input.firstChild);
	this.container.appendChild(this._input);

	// Listen to input.
	addEvent(this.input,'keydown', function(e){ si.handleInput(e as KeyboardEvent); });

	var helper = function(e: Event) { si.handleBlur(e as FocusEvent); };
	addEvent(this.input, 'blur', helper);
	addEvent(this.input, 'focus', helper);

	// Reset the interface state.
	this.reset();

	// Listen to window resizing
	addEvent(window,'resize',function() { si.resizeScreen(); });

	return this;
} as any as { new (decaf: IDecafMUD): IUi; }; // Cast to allow constructor signature

SimpleInterface.prototype.toString = function(this: IUi): string {
	return '<DecafMUD Interface: Simple' + (this.container.id ? ' (#'+this.container.id+')' : '') + '>'; }

// Defaults - These will be initialized in the constructor or as class properties if converted
SimpleInterface.prototype.toolbutton_id = -1; // This is an internal counter, not part of IUi state
SimpleInterface.prototype.echo = true;
SimpleInterface.prototype.inpFocus = false;
SimpleInterface.prototype.old_parent = undefined as HTMLElement | undefined | null; // For fullscreen
SimpleInterface.prototype.next_sib = undefined as Element | undefined | null; // For fullscreen
// this.input is already typed via IUi
SimpleInterface.prototype.display = undefined as IDisplay | undefined;
SimpleInterface.prototype.splash = null as HTMLElement | null;
SimpleInterface.prototype.splash_st = null as HTMLElement | null;
SimpleInterface.prototype.splash_pgi = null as HTMLElement | null;
SimpleInterface.prototype.splash_pgt = null as HTMLElement | null;
SimpleInterface.prototype.splash_old = null as HTMLElement | null;
SimpleInterface.prototype.scrollButton = undefined as HTMLElement | undefined;
SimpleInterface.supports = { // This is static-like, not per instance normally
	'tabComplete'	: true,
	'multipleOut'	: false,
	'fullscreen'	: true,
	'editor'		: false,
	'splash'		: true
};

///////////////////////////////////////////////////////////////////////////////
// Splash Functionality
///////////////////////////////////////////////////////////////////////////////

/** Initialize the splash screen and display an initial message.
 * @param {Number} [percentage] The initial percent to display the progress
 *    bar at.
 * @param {String} [message] The initial message for the splash screen to
 *    display. */
SimpleInterface.prototype.initSplash = function(this: IUi, percentage?: number, message?: string): void {
	if ( percentage === undefined ) { percentage = 0; }
	if ( message === undefined ) { message = 'Discombobulating interface recipient...'; } // Removed .tr

	// Disable scrolling
	(this as any).old_y = this.el_display.style.overflowY; // Store on 'this' if needed elsewhere for restore
	this.el_display.style.overflowY = 'hidden';

	// Create a <div> to serve as the splash.
	this.splash = document.createElement('div');
	this.splash.className = 'decafmud splash';

	// Build the contents.
	this.splash.innerHTML  = `<h2 class="decafmud heading"><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> <span class="version">v${this.decaf.version.toString()}</span></h2>`;

	// Create a <div> to act as the progress indicator.
	const splash_pg_el = document.createElement('div'); // Renamed to avoid conflict with this.splash_pg assignment for IUi
	splash_pg_el.className = 'decafmud progress';
	splash_pg_el.setAttribute('role','progressbar');
	splash_pg_el.setAttribute('aria-valuemax', '100');
	splash_pg_el.setAttribute('aria-valuemin', '0');
	splash_pg_el.setAttribute('aria-valuenow', String(percentage));
	splash_pg_el.setAttribute('aria-valuetext', `${percentage}%`); // Removed .tr

	this.splash_pgi = document.createElement('div');
	this.splash_pgi.className = 'decafmud inner-progress';
	this.splash_pgi.style.width = `${percentage}%`;
	splash_pg_el.appendChild(this.splash_pgi);

	this.splash_pgt = document.createElement('div');
	this.splash_pgt.className = 'decafmud progress-text';
	this.splash_pgt.innerHTML = `${percentage}%`; // Removed .tr
	splash_pg_el.appendChild(this.splash_pgt);

	this.splash.appendChild(splash_pg_el);

	// Create a <div> to contain the status line.
	this.splash_st = document.createElement('div');
	this.splash_st.className = 'decafmud status';
	this.splash_st.innerHTML = message;

	this.splash.appendChild(this.splash_st);

	// Add another element for old status messages
	this.splash_old = document.createElement('div');
	this.splash_old.className = 'decafmud old';
	this.splash_old.innerHTML = '';
	this.splash.appendChild(this.splash_old);

	// Add the splash to the display.
	this.container.appendChild(this.splash);
	(this as any).splash_pg = splash_pg_el; // Store if needed for updateSplash
}

/** Destroy the splash screen. */
SimpleInterface.prototype.endSplash = function(this: IUi): void {
	if (this.splash && this.splash.parentNode === this.container) { // Check if splash is child of container
		// Rip it apart.
		this.container.removeChild(this.splash);
	}

	this.el_display.style.overflowY = (this as any).old_y || ''; // Restore old_y

	(this as any).splash_err = false; // Assuming splash_err is a boolean property
	this.splash = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
	(this as any).splash_pg = null; // Clear stored splash_pg if any
}

/** Update the splash screen with the provided percentage and text.
 * @param {Number} [percentage] If provided, the percentage will be changed to
 *    this value.
 * @param {String} [message] If provided, this message will be displayed. */
SimpleInterface.prototype.updateSplash = function(this: IUi, percentage?: number, message?: string): void {
	if ( this.splash === null || (this as any).splash_err ) { return; }
	const splash_pg_el = (this as any).splash_pg as HTMLElement | null; // Retrieve stored splash_pg

	if ( percentage !== undefined && splash_pg_el && this.splash_pgt && this.splash_pgi) {
		var t = `${percentage}%`; // Removed .tr
		splash_pg_el.setAttribute('aria-valuenow', String(percentage));
		splash_pg_el.setAttribute('aria-valuetext', t);

		this.splash_pgt.innerHTML = t;
		this.splash_pgi.style.width = `${percentage}%`;
	}
	if (!message || !this.splash_st || !this.splash_old) { return; }

	// Append the current message to old.
	var e = document.createElement('div');
	var currentMessage = this.splash_st.innerHTML; // Renamed t to currentMessage
	if ( currentMessage.endsWith('...') ) { currentMessage += 'done.'; }
	e.innerHTML = currentMessage;
	this.splash_old.insertBefore(e, this.splash_old.firstChild);

	this.splash_st.innerHTML = message;
}

/** Show an error with the splash message so it doesn't need to be presented as
 *  an alert dialog.
 * @param {String} message The error to display. This can have HTML.
 * @returns {boolean} True if the error was displayed, else false. */
SimpleInterface.prototype.splashError = function(this: IUi, message: string): boolean {
	if ( this.splash === null || !this.splash_pgt || !this.splash_pgi || !this.splash_st ) { return false; }

	this.splash_pgt.innerHTML = '<b>Error</b>';
	this.splash_pgi.className += ' error';
	this.splash_st.innerHTML = message;
	(this as any).splash_err = true; // Assuming splash_err is a boolean property

	return true;
}

SimpleInterface.prototype.sizeel = undefined as HTMLElement | undefined; // For showSize/hideSize
SimpleInterface.prototype.sizetm = undefined as any; // Timer ID for showSize/hideSize

/** Show the current size of the primary display, if we can. Fade out over time
 *  too. */
SimpleInterface.prototype.showSize = function(this: IUi): void {
	clearTimeout(this.sizetm);

	// If we don't have a display, quit.
	if ( this.display === undefined ) { return; }

	// If the element doesn't exist, create it.
	if ( this.sizeel === undefined ) {
		this.sizeel = document.createElement('div');
		this.sizeel.className = 'decafmud note center';
		this.container.appendChild(this.sizeel);
	}

	var sz = this.display.getSize();
	this.sizeel.style.opacity = '1'; // Direct assignment
	this.sizeel.innerHTML = `${sz[0]}x${sz[1]}`; // Removed .tr

	// Set a timer for hiding.
	var si = this;
	this.sizetm = setTimeout(function(){si.hideSize!();},500);
}

/** Hide the element, with a CSS fade. */
SimpleInterface.prototype.hideSize = function(this: IUi, fnl?: boolean): void {
	clearTimeout(this.sizetm);

	if ( fnl === true ) {
		// Don't try to NAWS until this happens, to avoid socket spam.
		if ( this.decaf.telopt && this.decaf.telopt[DecafMUD_Global.TN.NAWS] ) { // Check if telopt and specific option exist
			try { (this.decaf.telopt[DecafMUD_Global.TN.NAWS] as any).send(); } // Cast to any if send is not on base ITeloptHandler
			catch(err) { }
		}
		if (this.sizeel && this.sizeel.parentNode === this.container) { // Check parent before removing
			this.container.removeChild(this.sizeel);
			this.sizeel = undefined;
		}
		return;
	}

	// Still here? Show the transition.
	if (this.sizeel) {
		this.sizeel.style.transition = 'opacity 0.25s linear'; // Use transition for cleaner CSS
		// Set a timer for hiding.
		var si = this;
		setTimeout(function(){ if(si.sizeel) si.sizeel.style.opacity='0';},0); // Start fade out
		this.sizetm = setTimeout(function(){si.hideSize!(true);},250); // Remove after transition
	}
}

///////////////////////////////////////////////////////////////////////////////
// Status Notifications (and Stuff)
///////////////////////////////////////////////////////////////////////////////

/** Called by Decaf upon connection to let us know. */
(SimpleInterface.prototype as any).ico_connected = -1; // Internal icon ID

SimpleInterface.prototype.connected = function(this: IUi): void {
	this.updateIcon((this as any).ico_connected, "DecafMUD is currently connected.", // Removed .tr
		'', 'connectivity connected');
}

/** Called by Decaf when it's trying to connect. */
SimpleInterface.prototype.connecting = function(this: IUi): void {
	this.updateIcon((this as any).ico_connected, "DecafMUD is attempting to connect.", // Removed .tr
		'', 'connectivity connecting');
}

/** Called by Decaf upon disconnection to let us know. */
SimpleInterface.prototype.disconnected = function(this: IUi, reconnecting?: boolean): void { // Added reconnecting based on IUi
	this.updateIcon((this as any).ico_connected, "DecafMUD is currently disconnected.", // Removed .tr
		'', 'connectivity disconnected');
}

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

/** Load our dependencies. That's pretty much it. */
SimpleInterface.prototype.load = function(this: IUi): void {
	// Require whatever display handler we use, and that's it.
	this.decaf.require('decafmud.display.'+this.decaf.options.display!); // Add non-null assertion if display is always set
}

// Reset the interface to its default state.
SimpleInterface.prototype.reset = function(this: IUi): void {
	// Reset the input handling state
	this.masked		= false;
	this.inputCtrl	= false;
	this.mruIndex	= 0;
	this.mruHistory	= [];
	this.mruSize	= this.decaf.options.set_interface.mru_size;
	this.mruTemp	= false;
	this.hasFocus	= false;

	// Tab Completion Data
	this.reqTab		= false;
	this.wantTab	= false;
	this.tabIndex	= -1;
	this.tabValues	= [];

	this.buffer		= '';

	// Update the input handler if it exists.
	if ( this.input !== undefined ) {
		this.updateInput(); }

	// Reset the display.
	if ( this.display !== undefined ) {
		this.display.reset(); }
}

/** Setup the UI plugin associated with this, this being a DecafMUD instance. */
SimpleInterface.prototype.setup = function(this: IUi): void {
	// Get a settings object.
	this.store = this.decaf.store!.sub('ui'); // Assuming decaf.store is defined
	// this.storage = this.store; // storage is an alias in IDecafMUD

	// Should the toolbar be on the left or the right?
	var tbar = this.store.get('toolbar-position','top-left') as string;
	(this as any).old_tbarpos = tbar; // Store for internal use
	this.toolbar.className += ' ' + tbar;
	this.container.insertBefore(this.toolbar, this.container.firstChild);

	// Get the display type.
	var displayType = this.decaf.options.display!;

	// Create the display.
	this.decaf.debugString('Initializing display plugin "'+displayType+'" in: #' + this.el_display.id,'info');
	const DisplayPlugin = DecafMUD_Global.plugins.Display[displayType];
	if (DisplayPlugin) {
		this.display = new DisplayPlugin(this.decaf, this, this.el_display);
		this.decaf.display = this.display; // Also assign to decaf's main display reference
	}


	// Should we go fullscreen automatically?
	(this as any).goFullOnResize = this.store.get('fullscreen-auto', true) as boolean;

	// Should we be starting in fullscreen?
	var fs = this.store.get('fullscreen-start', this.decaf.options.set_interface!.start_full) as boolean;

	// Create the fullscreen button.
	(this as any).fsbutton = this.tbNew( // fsbutton is an internal ID, not directly on IUi
		"Fullscreen", // Removed .tr
		undefined,
		"Click to enter fullscreen mode.", // Removed .tr
		1,
		true,
		fs,
		undefined,
		function(this: IUi, e: Event){ (this as any).click_fsbutton(e); }
	);

	// Create the log button.
	(this as any).logbutton = this.tbNew( // logbutton is an internal ID
		"Logs", // Removed .tr
		undefined,
		"Click to open a window containing this session's logs.", // Removed .tr
		0,
		true,
		false,
		undefined,
		function(this: IUi, e: Event){ this.showLogs!(); }
	);


	// Create the connected notification icon.
	(this as any).ico_connected = this.addIcon("You are currently disconnected.", '', 'connectivity disconnected'); // Removed .tr ico_connected is internal ID

	// Go directly to fullscreen if necessary.
	if ( fs ) {
		this.enter_fs!(false);
	} else {
		// Still resize stuff.
		if ( !(this as any)._resizeToolbar() ) { // Assuming _resizeToolbar is an internal method
			this.resizeScreen(false); }
	}
}

/** Quick and dirty function for saving logs. */
SimpleInterface.prototype.showLogs = function(this: IUi): void {

	// Build some CSS.
	var css = '', css2 = '';
	if ( window.getComputedStyle && this.display ) {
		var node: HTMLElement | null = this.display.display; // Type node explicitly
		var count=0;
		while(node) {
			count += 1;
			if(count>15){alert('Too high count!');return;}
			var style = getComputedStyle(node,null);
			if (!style.backgroundColor ||
				style.backgroundColor === 'transparent' ||
				style.backgroundColor.substr(0,5) === 'rgba(') {
				if(node === document.body) { break; }
				node = node.parentNode as HTMLElement | null; // Ensure parentNode is HTMLElement or null
			} else {
				css = 'background-color:' + style.backgroundColor + ';';
				break;
			}
		}
		if(!css) { css = 'background-color:#000;'; }
		var displayStyle = getComputedStyle(this.display.display,null); // display is potentially undefined
		css = 'body{'+css+'color:'+displayStyle.color+';}';

		css2 = 'div{font-family:'+displayStyle.fontFamily+';font-size:'+displayStyle.fontSize+';}';
	} else {
		css = 'body{background:#000;color:#C0C0C0;}';
		css2= 'div{font-family:monospace;}';
	}

	var url = 'data:text/html,';

	url += '<html><head><title>';
	url += 'DecafMUD Session Log'; // Removed .tr
	url += '</title><style>'+css+css2+'</style></head><body>';
	url += '<h1>';
	url += 'DecafMUD Session Log'; // Removed .tr
	url += '</h2>';
	url += '<div>' + (this.display ? this.display.display.innerHTML : '') + '</div>'; // Check if display exists
	url += '</body></html>';

	var win = window.open(url,'log-window','width=700,height=400,directories=no,location=no,menubar=no,status=no,toolbar=no,scrollbars=yes');
}

///////////////////////////////////////////////////////////////////////////////
// Settings
///////////////////////////////////////////////////////////////////////////////

/** Storage for the settings div. */
SimpleInterface.prototype.settings = undefined as HTMLElement | undefined; // For showSettings
(SimpleInterface.prototype as any).set_cont = undefined as HTMLElement | undefined; // Internal for showSettings
(SimpleInterface.prototype as any).set_mid = undefined as HTMLElement | undefined; // Internal for showSettings
(SimpleInterface.prototype as any).stbutton = -1; // Internal button ID for settings
(SimpleInterface.prototype as any).toolbarPadding = undefined as number | undefined; // Internal

/** Load the settings interface. */
SimpleInterface.prototype.showSettings = function(this: IUi): void {
	/** Is there already a settings element? */
	if ( this.settings ) {
		if (this.settings.parentNode) { // Check if it has a parent before removing
			this.settings.parentNode.removeChild(this.settings);
		}
		this.settings = undefined;
		(this as any).set_cont = undefined;
		this.tbPressed((this as any).stbutton,false); // Assuming stbutton is an ID
		this.tbTooltip((this as any).stbutton,"Click to close the settings window.") // Removed .tr
		this.el_display.setAttribute('tabIndex','0');

		return;
	}

	// Create the element.
	var set = document.createElement('div');
	set.className = 'decafmud window settings';

	// Apply top padding if the toolbar is visible
	const currentToolbarPadding = (this as any).toolbarPadding as number | undefined;
	if ( currentToolbarPadding ) {
		set.style.paddingTop = (currentToolbarPadding-5) + 'px';
	}

	// Create the secondary layer for pretty spacing.
	var seccont = document.createElement('div');
	seccont.className = 'decafmud window-middle';
	set.appendChild(seccont);

	// Create the actual holder.
	var cont = document.createElement('div');
	cont.className = 'decafmud window-inner';
	seccont.appendChild(cont);

	// Fill it with settings!
	var h = document.createElement('h2');
	h.innerHTML = "DecafMUD Settings"; // Removed .tr
	cont.appendChild(h);

	var pDesc = document.createElement('p'); // Renamed d
	pDesc.innerHTML = "Use the form below to adjust DecafMUD's settings, then click Apply when you're done."; // Removed .tr
	cont.appendChild(pDesc);

	// Go through decaf.settings.
	for(var k in this.decaf.settings) {
		var setting = this.decaf.settings[k];
		// Create the container for this settings branch.
		var fieldsetEl = document.createElement('fieldset'); // Renamed s
		fieldsetEl.className = 'decafmud settings';

		// Calculate the name.
		var name = k.substr(0,1).toUpperCase() + k.substr(1); // Renamed n
		if ( setting['_name'] !== undefined ) { name = setting['_name']; }

		// Create a header.
		var legendEl = document.createElement('legend'); // Renamed l
		legendEl.innerHTML = name; // Removed .tr
		fieldsetEl.appendChild(legendEl);

		// Is there a description?
		if ( setting['_desc'] !== undefined ) {
			var settingDescP = document.createElement('p'); // Renamed d
			settingDescP.innerHTML = setting['_desc']; // Removed .tr
			fieldsetEl.appendChild(settingDescP);
		}

		// Get the path.
		var path = setting['_path'] || '/';
		if ( path.substr(-1) !== '/' ) { path += '/'; }

		// Go through the controls.
		for(var _k in setting) {
			if ( _k.substr(0,1) === '_' ) { continue; }
			var controlDiv = document.createElement('div'); // Renamed d
			const sett = setting[_k] as any; // Cast to any for simplicity

			// Calculate the name.
			var controlName = _k.substr(0,1).toUpperCase() + _k.substr(1); // Renamed n
			if ( sett['_name'] !== undefined ) { controlName = sett['_name']; }

			// Calculate the ID.
			var id = path + _k;

			// Get the type of input element necessary.
			var controlType = sett['_type'] || 'text'; // Renamed t

			// Create the label if not boolean.
			if ( controlType !== 'boolean' ) {
				var labelEl = document.createElement('label'); // Renamed l
				labelEl.htmlFor = id; // Use htmlFor for label
				labelEl.innerHTML = controlName; // Removed .tr
				controlDiv.appendChild(labelEl);
			}

			// Create the input control
			let inputEl: HTMLElement; // Renamed i
			if ( controlType === 'password' ) {
				const passInput = document.createElement('input');
				passInput.id = id; passInput.type = 'password';
				inputEl = passInput;
			} else if ( controlType === 'boolean' ) {
				const boolInput = document.createElement('input');
				boolInput.id = id; boolInput.type = 'checkbox';
				inputEl = boolInput;
			} else if ( controlType === 'nochance' ) {
				const selectInput = document.createElement('select');
				selectInput.id = id;
				var optTrue = document.createElement('option'); // Renamed c
				optTrue.value = 'true'; optTrue.innerHTML = 'Yes';
				selectInput.appendChild(optTrue);
				var optFalse = document.createElement('option');
				optFalse.value = 'false'; optFalse.innerHTML = 'No';
				selectInput.appendChild(optFalse);
				inputEl = selectInput;
			} else {
				const textInput = document.createElement('input');
				textInput.id = id;
				inputEl = textInput;
			}
			controlDiv.appendChild(inputEl);

			// Is there a desc?
			if ( sett['_desc'] !== undefined ) {
				let descElement: HTMLElement; // Renamed i
				if ( controlType === 'boolean' ) {
					descElement = document.createElement('label');
					(descElement as HTMLLabelElement).htmlFor = id;
				} else {
					descElement = document.createElement('p');
				}
				descElement.innerHTML = sett['_desc']; // Removed .tr
				controlDiv.appendChild(descElement);
			} else if ( controlType === 'boolean' ) {
				var boolLabel = document.createElement('label'); // Renamed i
				boolLabel.htmlFor = id;
				boolLabel.innerHTML = controlName; // Removed .tr
				controlDiv.appendChild(boolLabel);
			}

			// Add this.
			fieldsetEl.appendChild(controlDiv);
		}


		// Append the fieldset to the document.
		cont.appendChild(fieldsetEl);
	}

	// Compute the height.
	var tot = this.container.offsetHeight - (this._input.offsetHeight + 17);
	if ( currentToolbarPadding ) { tot = tot - (currentToolbarPadding-12); }
	if ( tot < 0 ) { tot = 0; }
	seccont.style.height = tot + 'px';

	// Show the settings pane.
	this.el_display.setAttribute('tabIndex','-1'); // Make display unfocusable while settings open
	this.container.insertBefore(set, this.el_display);
	this.settings = set;
	(this as any).set_cont = cont;
	(this as any).set_mid  = seccont;
	this.tbPressed((this as any).stbutton,true);
	this.tbTooltip((this as any).stbutton,"Click to close the settings window."); // Removed .tr
}

///////////////////////////////////////////////////////////////////////////////
// Toolbar Functions
///////////////////////////////////////////////////////////////////////////////

/** Delete a toolbar button with the given ID.
 * @param {number} id The ID of the button to delete. */
SimpleInterface.prototype.tbDelete = function(this: IUi, id: number): void {
	if ( this.toolbuttons[id] === undefined ) { return; }
	var btnTuple = this.toolbuttons[id]; // btn is a tuple: [HTMLElement, ...]
	if (btnTuple[0].parentNode) { // Check parentNode before removing
		btnTuple[0].parentNode.removeChild(btnTuple[0]);
	}
	delete this.toolbuttons[id]; // Use delete for object properties

	// Resize the toolbar.
	(this as any)._resizeToolbar(); // Internal method, cast to any if not on IUi
}

/** Change a toolbar button's text. */
SimpleInterface.prototype.tbText = function(this: IUi, id: number, text: string): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	if ( !text ) { throw "Text can't be empty/false/null/whatever."; }
	btnTuple[0].innerHTML = text; // Element is at index 0
	if ( btnTuple[3] === undefined ) { // Tooltip is at index 3
		btnTuple[3] = text; // Store original text as tooltip if no tooltip
		(btnTuple[0] as HTMLElement).title = text; }
}

/** Change a toolbar button's tooltip. */
SimpleInterface.prototype.tbTooltip = function(this: IUi, id: number, tooltip: string): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	btnTuple[3] = tooltip; // Store new tooltip (index 3)
	if ( tooltip ) { (btnTuple[0] as HTMLElement).title = tooltip; }
	else { (btnTuple[0] as HTMLElement).title = btnTuple[1]; } // Use text (index 1) as title if tooltip empty
}

/** Enable or disable a toolbar button. */
SimpleInterface.prototype.tbEnabled = function(this: IUi, id: number, enabled: boolean): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	enabled = !!(enabled);
	btnTuple[5] = enabled; // Store enabled state (index 5)
	btnTuple[0].setAttribute('aria-disabled', String(!enabled));
	if ( enabled ) { btnTuple[0].className = btnTuple[0].className.replace(' disabled',''); }
	else if (! /disabled/.test(btnTuple[0].className) ) {
		btnTuple[0].className += ' disabled'; }
}

/** Change a toolbar button's pressed state. */
SimpleInterface.prototype.tbPressed = function(this: IUi, id: number, pressed: boolean): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	pressed = !!(pressed);
	btnTuple[6] = pressed; // Store pressed state (index 6)
	btnTuple[0].setAttribute('aria-pressed', String(pressed));
	if ( pressed ) {
		if ( /toggle-depressed/.test(btnTuple[0].className) ) {
			btnTuple[0].className = btnTuple[0].className.replace(' toggle-depressed',' toggle-pressed'); }
	} else {
		if ( /toggle-pressed/.test(btnTuple[0].className) ) {
			btnTuple[0].className = btnTuple[0].className.replace(' toggle-pressed',' toggle-depressed'); }
	}
}

/** Change a toolbar button's class. */
SimpleInterface.prototype.tbClass = function(this: IUi, id: number, clss: string): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	var old_clss = btnTuple[7]; // Store old class (index 7)
	btnTuple[7] = clss; // Store new class
	if ( old_clss !== undefined ) { btnTuple[0].className = btnTuple[0].className.replace(' '+old_clss,''); }
	if ( clss ) { btnTuple[0].className += ' ' + clss; }
}

/** Change a toolbar button's icon. */
SimpleInterface.prototype.tbIcon = function(this: IUi, id: number, icon: string): void {
	var btnTuple = this.toolbuttons[id];
	if ( btnTuple === undefined ) { throw "Invalid button ID."; }
	btnTuple[2] = icon; // Store icon URL (index 2)
	if ( icon ) {
		if (! / icon/.test(btnTuple[0].className) ) { btnTuple[0].className += ' icon'; }
		(btnTuple[0] as HTMLElement).style.backgroundImage = `url(${icon})`;
	} else {
		btnTuple[0].className = btnTuple[0].className.replace(' icon','');
		(btnTuple[0] as HTMLElement).style.backgroundImage = ''; }
}

/** Create a new toolbar button.
 * @param {String} text The name of the button. Will be displayed if no icon is
 *    given, and also used as title text if no tooltip is given.
 * @param {String} [icon] The icon to display on the button.
 * @param {String} [tooltip] The tooltip text to associate with the button.
 * @param {number} [type=0] The type of button. 0 is normal, 1 is toggle.
 * @param {boolean} [enabled=true] Whether or not the button is enabled.
 * @param {boolean} [pressed=false] Whether or not a toggle button is pressed.
 * @param {String} [clss] Any additional class to set on the button.
 * @param {function} [onclick] The function to call when the button is clicked
 *    or toggled. */
SimpleInterface.prototype.tbNew = function(
	this: IUi,
	text: string,
	icon?: string,
	tooltip?: string,
	type?: number, // 0 normal, 1 toggle
	enabled?: boolean,
	pressed?: boolean,
	clss?: string,
	onclick?: (e: Event) => void
): number {
	// Simplified overload handling for type safety, assuming standard order or explicit undefined
	if ( typeof icon === 'function' ) { // This was a JS way to handle optional args, less safe in TS
		onclick = icon as (e: Event) => void; // Cast: if icon is func, it's onclick
		icon = tooltip as string | undefined; // Shift args
		tooltip = type as string | undefined;
		type = enabled as number | undefined;
		enabled = pressed as boolean | undefined;
		pressed = clss as boolean | undefined;
		clss = undefined; // onc was not defined here, assume no class
	 }

	// Get this button's ID.
	var ind = ( ++(this as any).toolbutton_id ); // Internal counter

	var btn = document.createElement('a'); // Toolbar buttons are anchors
	btn.id = this.container.id + '-toolbar-button-' + ind;
	btn.className = 'decafmud button toolbar-button';
	if ( clss ) { btn.className += ' ' + clss; }
	if ( type === 1 ) { btn.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }
	btn.innerHTML = text;
	if ( tooltip ) { btn.title = tooltip; }
	else { btn.title = text; } // Default tooltip to text
	if ( enabled !== false ) { enabled = true; } // Default to true
	else { enabled = false; }
	if ( !enabled ) { btn.className += ' disabled'; }
	btn.setAttribute('tabIndex','0'); // Make it focusable

	// Set accessibility data
	btn.setAttribute('role','button');
	btn.setAttribute('aria-disabled', String(!enabled));
	if ( type === 1 ) { // Toggle button
		btn.setAttribute('aria-pressed', String(!!pressed)); } // Ensure pressed is boolean

	// Is there an icon?
	if ( icon ) {
		btn.style.backgroundImage = `url(${icon})`; // Use template literal
		btn.className += ' icon'; }

	if ( onclick ) {
		var si = this; // Capture 'this' (the IUi instance)
		var helper = function(e: Event) {
			if ( (e as KeyboardEvent).type === 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; } // Only act on Enter for keydown
			var btnArr = si.toolbuttons[ind]; // Get button data from stored array
			if ( btnArr && btnArr[5] !== true ) { return; } // Check enabled state (index 5 in tuple)

			onclick!.call(si, e); // Call the provided onclick, 'this' will be the IUi instance
			if ( e.type && e.type !== 'keydown' && btnArr) { (btnArr[0] as HTMLElement).blur(); } // Blur after click unless it was a keydown
		}
		addEvent(btn, 'click', helper);
		addEvent(btn, 'keydown', helper);
	}

	// Focus Helpers
	addEvent(btn,'focus',function(this: HTMLElement, e: Event) { // 'this' is the button element here
		if (! this.parentNode ) { return; }
		const parentNode = this.parentNode as HTMLElement; // Assume parent is HTMLElement
		if (/toolbar/.test(parentNode.className)) { // If parent is the toolbar
			parentNode.setAttribute('aria-activedescendant', this.id); // For ARIA navigation
			parentNode.className += ' visible'; } // Make toolbar visible on focus
	});
	addEvent(btn,'blur',function(this: HTMLElement, e: Event) { // 'this' is the button element
		if (! this.parentNode ) { return; }
		const parentNode = this.parentNode as HTMLElement;
		if (/toolbar/.test(parentNode.className)) {
			if ( parentNode.getAttribute('aria-activedescendant') === this.id ) {
				parentNode.setAttribute('aria-activedescendant', ''); } // Clear active descendant
			parentNode.className = parentNode.className.replace(' visible',''); } // Hide toolbar if no focus
	});

	// Store the button and its data in a tuple/array
	this.toolbuttons[ind] = [btn,text,icon,tooltip,type || 0,enabled,!!pressed,clss,onclick];
	btn.setAttribute('button-id', String(ind)); // Store ID on element for easier retrieval if needed

	// Add it to the toolbar.
	this.toolbar.appendChild(btn);

	// Resize the toolbar.
	(this as any)._resizeToolbar(); // Internal method, cast to any if not on IUi

	return ind; // Return the ID of the new button
}


/** Resize the toolbar when adding/changing/removing a button. */
// SimpleInterface.prototype.toolbarPadding = undefined; // This is an internal property, should be on `this` if needed
SimpleInterface.prototype._resizeToolbar = function(this: IUi): boolean { // Made internal, return type assumed boolean from original
	var tbarPos = this.store!.get('toolbar-position','top-left') as string; // store is IStorage, get returns any
	var alwaysOpt = this.store!.get('toolbar-always',2) as number; // 0=never, 1=always, 2=fullscreen only
	var css = this.toolbar.style.cssText;
	var ret = false;

	const currentOldTbarPos = (this as any).old_tbarpos as string | undefined; // Internal tracking property
	if ( currentOldTbarPos !== tbarPos ) {
		// Move the toolbar.
		if(currentOldTbarPos) this.toolbar.className = this.toolbar.className.replace(' '+currentOldTbarPos,' '+tbarPos);
		else this.toolbar.className += ' ' + tbarPos; // First time setting


		// Remove the old position class from the toolbar's CSS if it was inline (less likely with class-based positioning)
		if ( currentOldTbarPos === 'top-left' || currentOldTbarPos === 'top-right' ) {
			css = css.replace(/top:[\s\-0-9a-z]+;/g, '');
		} else if ( currentOldTbarPos === 'left' ) {
			css = css.replace(/left:[\s\-0-9a-z]+;/g, '');
		} else if (currentOldTbarPos) { // implies 'right'
			css = css.replace(/right:[\s\-0-9a-z]+;/g, '');
		}

		// Store the new position.
		(this as any).old_tbarpos = tbarPos;
	}

	// Do we need to add or remove always-on?
	let alwaysVisible: boolean;
	if ( alwaysOpt === 0 ) { alwaysVisible = false; }
	else if ( alwaysOpt === 1 ) { alwaysVisible = true; }
	else { alwaysVisible = this.container.className.indexOf('fullscreen') !== -1; } // fullscreen only

	if ( this.toolbar.className.indexOf(' always-on') === -1 && alwaysVisible ) {
		this.toolbar.className += ' always-on';
	} else if ( this.toolbar.className.indexOf(' always-on') !== -1 && !alwaysVisible ) {
		this.toolbar.className = this.toolbar.className.replace(' always-on','');
	}

	const currentToolbarPadding = (this as any).toolbarPadding as number | undefined; // Internal tracking
	// If the toolbar is always-on and top-left or top-right...
	if ( / always-on/.test(this.toolbar.className) && / top-(?:left|right)/.test(this.toolbar.className) ) {
		if ( this.settings && currentToolbarPadding !== this.toolbar.clientHeight ) { // settings is HTMLElement | undefined
			this.settings.style.paddingTop = (this.toolbar.clientHeight-5) + 'px';
		}
		if ( this.display && currentToolbarPadding !== this.toolbar.clientHeight ) { // display is IDisplay | undefined
			// If we have a display, check its padding.
			this.display.shouldScroll(); // Assuming shouldScroll exists
			this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px';
			(this as any).toolbarPadding = this.toolbar.clientHeight;
			this.resizeScreen(false,true); // Call resizeScreen
			this.display.doScroll(); // Assuming doScroll exists
			ret = true;
		} else if (this.display) { // If display exists but padding hasn't changed, still might need to set toolbarPadding
			(this as any).toolbarPadding = this.toolbar.clientHeight;
		}
	} else if ( currentToolbarPadding !== undefined ) { // Toolbar is not always-on top or has changed
		if ( this.settings ) {
			this.settings.style.paddingTop = ''; // Clear padding
		}
		if ( this.display ) {
			this.display.shouldScroll();
			this.el_display.style.paddingTop = '0px'; // Reset padding
			(this as any).toolbarPadding = undefined;
			this.resizeScreen(false,true);
			this.display.doScroll();
			ret = true;
		}
	}

	// Get the toolbar width and height for positioning when not always-on (hover-reveal)
	var w = -1 * (this.toolbar.clientWidth - 15); // Negative for offset
	var h = -1 * (this.toolbar.clientHeight - 12);

	if ( / left/.test(this.toolbar.className) ) { // For left-side toolbar
		css = css.replace(/left:[\s\-0-9a-z]+;/g, '') + 'left:'+w+'px;';
	} else if ( / right/.test(this.toolbar.className) ) { // For right-side toolbar
		css = css.replace(/right:[\s\-0-9a-z]+;/g,'') + 'right:'+w+'px;';
	} else { // top-left or top-right
		css = css.replace(/top:[\s\-0-9a-z]+;/g, '') + 'top:'+h+'px;';
	}
	this.toolbar.style.cssText = css;

	return ret;
}

///////////////////////////////////////////////////////////////////////////////
// Scroll Button
///////////////////////////////////////////////////////////////////////////////

/** Create a scroll button for the main output pane. */
SimpleInterface.prototype.showScrollButton = function(this: IUi): void {
	if ( this.scrollButton !== undefined ) { return; }

	var sb = document.createElement('div');
	var si = this; // Capture 'this'
	sb.className = 'button scroll-button';
	sb.setAttribute('tabIndex','0');
	sb.innerHTML = "More"; // Removed .tr
	var helper = function(e: Event) {
		if ( (e as KeyboardEvent).type == 'keydown' && (e as KeyboardEvent).keyCode !== 13 ) { return; }
		si.display!.scrollNew!(); } // Assuming display and scrollNew are defined and non-null
	addEvent(sb, 'click', helper);
	addEvent(sb, 'keydown', helper);

	this.scrollButton = sb;

	// Add the button, then reflow.
	this.container.appendChild(sb);
	sb.style.bottom = (this._input.offsetHeight + 12) + 'px'; // Direct assignment
}

/** Destroy the scroll button. */
SimpleInterface.prototype.hideScrollButton = function(this: IUi): void {
	if ( this.scrollButton === undefined ) { return; }
	if (this.scrollButton.parentNode) { // Check parentNode before removing
		this.scrollButton.parentNode.removeChild(this.scrollButton);
	}
	this.scrollButton = undefined; }

///////////////////////////////////////////////////////////////////////////////
// Information Bar
///////////////////////////////////////////////////////////////////////////////

/** Create a new notification bar at the top of the interface for the user to
 *  take action on. Actions may be specified to be taken when the bar is clicked
 *  or closed, and buttons may be added as well.
 *
 *  If the second parameter is a number instead of a string, it will be treated
 *  as though timeout and clss have swapped places.
 *
 * @param {String} text The text to display on the bar.
 * @param {String} [clss="info"] Optionally, a class to add to the bar for more
 *    precise styling.
 * @param {Number} [timeout=0] The number of seconds after which the bar should
 *    automatically be closed.
 * @param {String} [icon] The URL of an image to display on the bar.
 * @param {Array}  [buttons] A list of buttons to be displayed.
 * @param {function} [click] A function to be called when the bar is clicked.
 * @param {function} [close] A function to be called when the bar is closed. */
// Internal state for infoBar
(SimpleInterface.prototype as any).ibar = undefined as HTMLElement | undefined;
(SimpleInterface.prototype as any).ibartimer = undefined as any; // Timer ID

SimpleInterface.prototype.infoBar = function(
	this: IUi,
	text: string,
	clss?: string,
	timeout?: number,
	icon?: string,
	buttons?: [string, (e: Event) => void][], // Array of [buttonText, callback]
	click?: (e: Event) => void,
	close?: (e: Event) => void
): void {
	if ( typeof clss === 'number' ) { // JS way of handling optional args by type sniffing
		const tempTimeout = timeout; // Store original timeout if it was passed after number-clss
		timeout = clss; // clss is actually timeout
		clss = tempTimeout as string | undefined; // old timeout becomes clss, or undefined
	}

	if ( clss === undefined ) { clss = 'info'; } // Default class
	if ( timeout === undefined ) { timeout = 0; } // Default timeout (0 = no auto-close)

	var ibarData = { // Store as an object for clarity
		text: text,
		class: clss,
		timeout: timeout,
		icon: icon,
		buttons: buttons,
		click: click,
		close: close,
		el: undefined as HTMLElement | undefined // To store the DOM element once created
	};
	this.infobars.push(ibarData); // Add to queue

	// Is there a current information bar? If so, don't create a new one yet.
	if ( (this as any).ibar !== undefined ) { return; }

	// Create a new infobar (will take the first from the queue).
	this.createIBar!(); // Assert createIBar is defined
}

/** Same as the regular infoBar function, but only adds an infoBar if it will
 *  be displayed immediately. */
SimpleInterface.prototype.immediateInfoBar = function(
	this: IUi,
	text: string,
	clss?: string,
	timeout?: number,
	icon?: string,
	buttons?: [string, (e: Event) => void][],
	click?: (e: Event) => void,
	close?: (e: Event) => void
): boolean {
	if ( (this as any).ibar !== undefined ) { return false; } // Don't add if one is already showing
	this.infoBar(text, clss, timeout, icon, buttons, click, close);
	return true;
}

/** Helper for adding buttons to an IBar. */
var addButtonToIBarInternal = function(bar: HTMLElement, btnData: [string, (e: Event) => void], si: IUi): void { // Renamed to avoid conflict
	var b = document.createElement('a');
	b.className = 'button';
	b.href = '#'; // Use href for anchors
	b.onclick = () => false; // Prevent default action and stop propagation simply
	b.innerHTML = btnData[0]; // Button text
	addEvent(b, 'click', function(e: Event) {
		si.closeIBar!(true); // Close the bar, then execute callback
		setTimeout(function(){ btnData[1].call(si,e); },0); // Callback with 'this' as IUi

		// Stop it from propagating
		if(e.stopPropagation) e.stopPropagation();
		else (e as any).cancelBubble = true; // For older IE

		return false; }); // Redundant due to onclick = () => false
	bar.appendChild(b);
}

/** Handle the creation of showing of the info bar. Used internally. */
SimpleInterface.prototype.createIBar = function(this: IUi): void { // Internal method
	var si = this; // Capture 'this' (IUi instance)
	if (this.infobars.length === 0) return; // No bars in queue

	const ibarData = this.infobars[0] as any; // Get first bar from queue (cast to any for simplicity)
	const obj = document.createElement('div'); // The bar element

	// Accessibility
	obj.setAttribute('role', 'alert'); // Important for screen readers

	obj.className = 'decafmud infobar ' + ibarData.class;
	obj.innerHTML = ibarData.text;
	obj.style.top = '-26px'; // Initial position for slide-in animation

	// If it's clickable, make it focusable too.
	if ( ibarData.click !== undefined ) {
		obj.className += ' clickable';
		obj.setAttribute('tabIndex','0'); // Make it focusable
	}

	// Create the close/click handlers.
	var closer = function(e: Event) {
		const keyboardEvent = e as KeyboardEvent;
		if ( e === undefined || ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode !== 13 && keyboardEvent.keyCode !== 27 )) { return; } // Enter or Esc for keydown
		if ( e.type === 'click' && !ibarData.click ) { return; } // If not clickable, ignore click

		// Stop it from propagating
		if(e.stopPropagation) e.stopPropagation();
		else (e as any).cancelBubble = true;

		// Close it.
		si.closeIBar!(true); // Close immediately

		if ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode === 27 ) { // If Esc key
			// Return before the click function can be called.
			if ( ibarData.close ) { // If a close callback is defined
				ibarData.close.call(si, e); } // Call it
			return; }

		if ( ibarData.click ) { // If a click callback is defined
			ibarData.click.call(si, e); } // Call it
	};

	// Add events.
	addEvent(obj, 'click', closer);
	addEvent(obj, 'keydown', closer);

	// Create the close button (the 'X').
	var closebtn = document.createElement('div');
	closebtn.innerHTML = 'X';
	closebtn.className = 'close';
	closebtn.setAttribute('tabIndex','0'); // Make it focusable
	var closeHelper = function(e: Event) { // Renamed helper to avoid conflict
		const keyboardEvent = e as KeyboardEvent;
		if ( e === undefined || ( keyboardEvent.type === 'keydown' && keyboardEvent.keyCode !== 13 )) { return; } // Enter for keydown
		si.closeIBar!(true); // Close immediately
		if ( ibarData.close ) { ibarData.close.call(si, e); } // Call close callback if defined

		// Stop it from propagating
		if(e.stopPropagation) e.stopPropagation();
		else (e as any).cancelBubble = true;
	};
	addEvent(closebtn, 'click', closeHelper);
	addEvent(closebtn, 'keydown', closeHelper);
	obj.insertBefore(closebtn, obj.firstChild); // Insert before text

	// Create the buttons if any are defined.
	if ( ibarData.buttons ) {
		var btncont = document.createElement('div');
		btncont.className = 'btncont'; // Container for buttons
		for(var i=0; i<ibarData.buttons.length; i++) {
			addButtonToIBarInternal(btncont, ibarData.buttons[i], this); // Use renamed helper
		}
		obj.insertBefore(btncont, closebtn); // Insert buttons before close button
	}

	// Add it to the document.
	(this as any).ibar = obj; // Store the current bar element on the instance
	ibarData.el = obj; // Store element on the data object too
	this.container.insertBefore(obj, this.container.firstChild); // Add to top of container

	// Add awesome styling (slide-in animation and icon).
	setTimeout(function(){
		let pt = 0; // Padding-top
		const computedStyle = window.getComputedStyle ? getComputedStyle(obj,null) : (obj as any).currentStyle; // Cross-browser style
		if (computedStyle) {
			pt = parseInt(computedStyle.paddingTop || '0');
		}

		const currentToolbarPadding = (si as any).toolbarPadding as number | undefined; // Internal tracking for toolbar
		if ( currentToolbarPadding ) { pt += currentToolbarPadding - 10; } // Adjust if toolbar is present

		let newCssText = `background-position: 5px ${pt}px; padding-top: ${pt}px; transition: top 0.1s linear; top: inherit;`;
		if ( ibarData.icon ) { // If an icon URL is provided
			newCssText += `background-image: url("${ibarData.icon}")`;
		}
		obj.style.cssText = newCssText; // Apply styles
	},0); // Timeout to allow DOM update before animation

	// If there's a timeout, create the timer to auto-close the bar.
	if ( ibarData.timeout > 0 ) {
		(this as any).ibartimer = setTimeout(function() {
			si.closeIBar!(); }, 1000 * ibarData.timeout); // Call closeIBar after timeout
	}
}

/** Close the info bar. If there's another one waiting, show it next. */
SimpleInterface.prototype.closeIBar = function(this: IUi, steptwo?: boolean): void { // Internal method
	const currentIbarEl = (this as any).ibar as HTMLElement | undefined; // Get current bar element
	if ( currentIbarEl === undefined ) { return; } // No bar to close
	clearTimeout((this as any).ibartimer); // Clear auto-close timer

	if ( !steptwo ) { // First step: start fade-out animation
		currentIbarEl.style.transition = 'opacity 0.25s linear';
		currentIbarEl.style.opacity = '0'; // Fade out
		var si = this;
		(this as any).ibartimer = setTimeout(function(){si.closeIBar!(true);},250); // Call again after animation
		return;
	}

	// Second step: remove element and show next bar
	if (currentIbarEl.parentNode) { // Check if element is still in DOM
		currentIbarEl.parentNode.removeChild(currentIbarEl);
	}
	(this as any).ibar = undefined; // Clear current bar reference
	this.infobars.shift(); // Remove from queue

	// Is there a new one? If so, create it.
	if ( this.infobars.length > 0 ) {
		this.createIBar!(); }
}

///////////////////////////////////////////////////////////////////////////////
// Notification Icons
///////////////////////////////////////////////////////////////////////////////

/** Create a new tray icon. These show up next to the text input and support
 *  click/key events. They can be changed dynamically too, but must remain at
 *  16x16 in size. */
SimpleInterface.prototype.addIcon = function(
	this: IUi,
	text: string,
	html: string,
	clss: string,
	onclick?: (e: Event) => void,
	onkey?: (e: KeyboardEvent) => void
): number {
	var ico = document.createElement('div');
	ico.className = 'decafmud status-icon ' + clss + ( onclick ? ' icon-click' : '' );
	ico.innerHTML = html;
	ico.title = text; // Use direct assignment

	// Accessibility.
	ico.setAttribute('role','status');
	ico.setAttribute('aria-label', text);

	// Make it selectable if necessary.
	if ( onclick || onkey ) { ico.setAttribute('tabIndex','0'); }

	// Add this to icons. this.icons is [HTMLElement, Function | undefined, Function | undefined][]
	var ind = this.icons.push([ico, onclick, onkey]) - 1;


	// Recalculate icon positions.
	for(var i=0; i < this.icons.length; i++) {
		this.icons[i][0].style.right = (((this.icons.length-i)-1)*21)+'px'; // Direct assignment
	}

	// Add to DOM.
	this.tray.appendChild(ico);

	// Add the event listeners.
	var si = this; // Capture 'this' (IUi instance)
	if ( onclick ) { addEvent(ico, 'click', function(e: Event) { onclick!.call(si,e); }); } // Assert onclick is defined
	if ( onclick && !onkey ) { addEvent(ico, 'keydown', function(e: Event) { // Only if onclick and no specific onkey
		if ((e as KeyboardEvent).keyCode !== 13) { return; } // Only Enter key
		onclick!.call(si,e); }); } // Assert onclick is defined
	if ( onkey ) { addEvent(ico, 'keydown', function(e: Event) { onkey!.call(si,e as KeyboardEvent); }); } // Assert onkey is defined

	// Resize the tray now.
	(this as any)._resizeTray(); // Internal method, cast to any if not on IUi

	// Return the index
	return ind;
}

/** Destroy the icon with the given index.
 * @param {Number} ind The index of the icon to destroy. */
SimpleInterface.prototype.delIcon = function(this: IUi, ind: number): void {
	if ( ind < 0 || ind >= this.icons.length ) {
		throw "Invalid index for icon!"; }

	// Get the element and pop it off the list.
	var iconArr = this.icons[ind]; // iconArr is a tuple [HTMLElement, Function?, Function?]
	if (!iconArr) return;
	var el = iconArr[0]; // The HTMLElement
	this.icons.splice(ind,1); // Remove from array

	// Remove the icon from DOM.
	if (el.parentNode) el.parentNode.removeChild(el); // Check parentNode before removing
	// delete el; // Not needed in JS for DOM elements removed this way, garbage collection handles it.

	// Recalculate icon positions.
	for(var i=0; i < this.icons.length; i++) {
		this.icons[i][0].style.right = (((this.icons.length-i)-1)*21)+'px';
	}

	// Resize the tray now.
	(this as any)._resizeTray(); // Internal method
}

/** Update an icon with a new class and/or text.
 * @param {Number} ind The index of the icon to update.
 * @param {String} [text] The title text to attach to the icon.
 * @param {String} [clss] The new class to set on the icon.
 * @param {String} [html] The innerHTML to set on the icon. */
SimpleInterface.prototype.updateIcon = function(this: IUi, ind: number, text?: string, html?: string, clss?: string): void {
	if ( ind < 0 || ind >= this.icons.length ) {
		throw "Invalid index for icon!"; }

	// Get the icon.
	var iconArr = this.icons[ind]; // iconArr is [HTMLElement, Function?, Function?]
	if(!iconArr) return;
	var el = iconArr[0]; // The HTMLElement
	var onclick = iconArr[1]; // The onclick handler

	if ( clss ) { el.className = 'decafmud status-icon ' + clss + ( onclick ? ' icon-click' : ''); }
	if ( html !== undefined ) { el.innerHTML = html; } // Check for undefined to allow setting empty string
	if ( text ) { // If text is provided
		el.title = text; // Set title attribute
		el.setAttribute('aria-label', text); // Update ARIA label
	}
}

/** Helper. Resizes the input based on the number of icons. */
SimpleInterface.prototype._resizeTray = function(this: IUi): void { // Internal method
	var w = this.tray.clientWidth; // Get current width of the tray
	this._input.style.paddingRight = w+'px'; // Set padding on the input container
}

///////////////////////////////////////////////////////////////////////////////
// Element Sizing
///////////////////////////////////////////////////////////////////////////////

/** For when you click the fullscreen div. */
SimpleInterface.prototype.click_fsbutton = function(e) {
	if ( this.container.className.indexOf('fullscreen') === -1 ) {
		this.enter_fs();
	} else {
		this.exit_fs();
	}
}

/** Scroll position for when leaving FS. */
SimpleInterface.prototype.oldscrollX = undefined;
SimpleInterface.prototype.oldscrollY = undefined;
SimpleInterface.prototype.old_children = [];
SimpleInterface.prototype.old_display = [];

/** Enter fullscreen mode. */
SimpleInterface.prototype.enter_fs = function(showSize) {
	if ( this.container.className.indexOf('fullscreen') !== -1 ) { return; }

	var has_focus = this.inpFocus;
	if ( this.display ) { this.display.shouldScroll(false); }

	// Scroll to it.
	this.oldscrollY = window.scrollY;
	this.oldscrollX = window.scrollX;

	// Store the old container position, then pop it.
	this.old_parent = this.container.parentNode;
	this.next_sib = this.container.nextElementSibling;
	if ( this.next_sib === undefined ) {
		// Try getting nextSibling for IE support
		if ( this.container.nextSibling && this.container.nextSibling.nodeType == this.container.nodeType ) {
			this.next_sib = this.container.nextSibling;
		}
	}
	this.old_parent.removeChild(this.container);

	// Set the className so it appears all big.
	this.container.className += ' fullscreen';

	// Adjust the fs button.
	this.tbPressed(this.fsbutton, true);
	this.tbTooltip(this.fsbutton, "Click to exit fullscreen mode.".tr(this.decaf));

	// Hide all the other body elements.
	for(var i=0;i<document.body.children.length;i++) {
		var child = document.body.children[i];
		if ( child.id !== '_firebugConsole' && child.id.indexOf('DecafFlashSocket') !== 0 ) {
			this.old_children.push(child);
			this.old_display.push(child.style.display);
			child.style.display = 'none';
		}
	}

	// Append the container to <body>.
	this.old_body_over = document.body.style.overflow;
	// Don't do in Firefox.
	if ( !bodyHack ) { document.body.style.overflow = 'hidden'; }
	document.body.appendChild(this.container);

	window.scroll(0,0);

	// Resize and show the size.
	this._resizeToolbar();
	if ( showSize !== false ) { this.showSize(); }

	// Refocus input?
	if ( has_focus ) { this.input.focus(); }
	if ( this.display ) { this.display.doScroll(); }
}

/** Exit fullscreen mode. */
SimpleInterface.prototype.exit_fs = function() {
	if ( this.old_parent === undefined ) { return; }

	var has_focus = this.inpFocus;
	if ( this.display ) { this.display.shouldScroll(false); }

	// Pop the container from body.
	this.container.parentNode.removeChild(this.container);

	// Restore all the body elements.
	for(var i=0; i<this.old_children.length;i++) {
		var child = this.old_children[i];
		child.style.display = this.old_display[i];
	}
	this.old_children = [];
	this.old_display = [];

	// Remove the fullscreen class.
	var classes = this.container.className.split(' '),i=0;
	while(i<classes.length){
		if ( classes[i] === 'fullscreen' ) {
			classes.splice(i,1);
			continue;
		}
		i++;
	}
	this.container.className = classes.join(' ');

	// Adjust the fs button.
	this.tbPressed(this.fsbutton, false);
	this.tbTooltip(this.fsbutton, "Click to enter fullscreen mode.".tr(this.decaf));

	// Add the container back to the parent element.
	if ( this.next_sib !== undefined && this.next_sib !== null ) {
		this.old_parent.insertBefore(this.container, this.next_sib);
	} else {
		// Just add to the end.
		this.old_parent.appendChild(this.container);
	}

	// Restore the body overflow style.
	document.body.style.overflow = this.old_body_over;

	// Return to where we were scrolled before.
	window.scroll(this.oldscrollX, this.oldscrollY);

	// Show the size.
	this._resizeToolbar()
	this.showSize();

	// Refocus input?
	if ( has_focus ) { this.input.focus(); }
	if ( this.display ) { this.display.doScroll(); }
}

/** Store the old size. */
SimpleInterface.prototype.old_height = -1;
SimpleInterface.prototype.old_width = -1;
SimpleInterface.prototype.old_fs = false;

/** Resize the screen elements to fit together nicely. */
SimpleInterface.prototype.goFullOnResize = true;
SimpleInterface.prototype.resizeScreen = function(showSize,force) {
	// Are we fullscreen now when we weren't before?
	if ( this.goFullOnResize ) {
		var fs = window.fullScreen === true;
		if ( !fs ) {
			if ( window.outerHeight ) { fs = (window.screen.height - window.outerHeight) <= 5; }
			else if ( window.innerHeight ) { fs = (window.screen.height - window.innerHeight <= 5); }
		}
		if ( fs && !this.old_fs ) {
			this.old_fs = fs;
			this.enter_fs();
			return;
		} else if ( !fs && this.old_fs ) {
			this.old_fs = fs;
			this.exit_fs();
			return;
		}
		this.old_fs = fs;
	}

	// Now, handle actually resizing things.
	if ( force !== true && this.old_height === this.container.offsetHeight && this.old_width === this.container.offsetWidth ) { return; }
	this.old_height = this.container.offsetHeight;
	this.old_width = this.container.offsetWidth;

	// Resize the display element.
	var tot = this.old_height - (this._input.offsetHeight + 17);
	if ( this.toolbarPadding ) { tot = tot - (this.toolbarPadding-12); }
	if ( tot < 0 ) { tot = 0; }

	if ( this.settings ) { this.set_mid.style.height = tot + 'px'; }
	if ( this.toolbarPadding ) {
		tot -= 12;
		if ( tot < 0 ) { tot = 0; }
	}

	this.el_display.style.height = tot + 'px'; //cssText = 'height:'+tot+'px';
	if ( force !== true && this.display ) { this.display.scroll(); }

	// Move the scrollButton if it exists.
	if ( this.scrollButton ) {
		this.scrollButton.style.cssText = 'bottom:' + (this._input.offsetHeight + 12) + 'px';
	}

	if ( showSize !== false ) {
		this.showSize(); }
};

///////////////////////////////////////////////////////////////////////////////
// The Input Element
///////////////////////////////////////////////////////////////////////////////

/** Display user input out to the display, if local echo is enabled.
 * @param {String} text The input to display. */
SimpleInterface.prototype.displayInput = function(text) {
	if ( (!this.display) || (!this.echo) ) { return; }
	this.display.message("<b>" + text + "</b>",'user-intput',false);
}

/** Enable or disable local echoing. This, in addition to preventing player
 *  input from being output to the display, changes the INPUT element to a
 *  password input element.
 * @param {boolean} echo True if we should be echoing locally. */
SimpleInterface.prototype.localEcho = function(echo) {
	if ( echo === this.echo ) { return; }
	this.echo = echo;

	this.updateInput();
}

/** Handle keypresses from the display element. */
SimpleInterface.prototype.displayKey = function(e) {
	if (e.altKey || e.ctrlKey || e.metaKey ) { return; }

	// Range: A-Z=65-90, 1-0=48-57
	if (!( (e.keyCode > 64 && e.keyCode < 91) || (e.keyCode > 47 && e.keyCode < 58)
		|| (e.keyCode > 185 && e.keyCode < 193)||(e.keyCode > 218 && e.keyCode < 223) )) {
		return; }

	this.input.focus();
}

/** A simpler KeyDown handler for passwords. This only cares about the enter
 *  key, and doesn't support MRU or tab completion at all. For internal use. */
SimpleInterface.prototype.handleInputPassword = function(e) {
	if ( e.keyCode !== 13 ) { return; }
	this.inpFocus = true;

	this.decaf.sendInput(this.input.value);
	this.input.value = '';
}

/** Handle a key press in the INPUT element. For internal use. */
SimpleInterface.prototype.handleInput = function(e) {
	if ( e.type !== 'keydown' ) { return; }
	if ( e.keyCode === 13 ) {
		this.decaf.sendInput(this.input.value);
		this.input.select();
	}

	// PgUp
	else if ( e.keyCode === 33 ) {
		if ( this.display && this.display.scrollUp ) {
			this.display.scrollUp();
			e.preventDefault();
		}
	}

	// PgDwn
	else if ( e.keyCode === 34 ) {
		if ( this.display && this.display.scrollDown ) {
			this.display.scrollDown();
			e.preventDefault();
		}
	}
}

/** Handle blur and focus events on the INPUT element. */
SimpleInterface.prototype.handleBlur = function(e) {
	var inp = this.input,
		bc	= this.decaf.options.set_interface.blurclass;

	if ( e.type === 'blur' ) {
		if ( inp.value === '' ) {
			inp.className += ' ' + bc;
		}

		var si = this;
		setTimeout(function(){
			if ( si.settings ) {
				si.settings.style.top = '0px';
				si.set_mid.style.overflowY = 'scroll';
			}
		},100);

		this.inpFocus = false;
	}

	else if ( e.type === 'focus' ) {
		var parts = inp.className.split(' '), out = [];
		for(var i=0;i<parts.length;i++) {
			if ( parts[i] !== bc ) { out.push(parts[i]); } }
		inp.className = out.join(' ');

		if ( this.settings ) {
			var t = -1* (this.settings.clientHeight * 0.5);
			this.settings.style.top = t + 'px';
			this.set_mid.style.overflowY = 'hidden';
		}

		this.inpFocus = true;
	}
}

/** Update the INPUT element to reflect the current state. This exchanges the
 *  current element with a special element if needed, for password input or
 *  multi-line input. For internal use.
 * @param {boolean} force If true, always replace the input element with a new
 *    one. */
SimpleInterface.prototype.updateInput = function(force) {
	if ( !this.input ) return;

	// Cache input focus.
	var foc = this.inpFocus;

	var si = this, inp = this.input, type, tag = this.input.tagName;
	type = tag === 'TEXTAREA' ? 'text' : inp.type;

	// Exit if we've nothing to do.
	if ( force !== true && ( (!this.echo && type === 'password') || (this.echo && type !== 'password') ) ) {
		return; }

	var cl	= inp.className,
		st	= inp.getAttribute('style'),
		id	= inp.id,
		par	= inp.parentNode,
		pos;

	// Determine the position in the DOM.
	pos = inp.nextElementSibling;
	if ( pos === undefined ) {
		// Try getting nextSibling for IE support
		if ( inp.nextSibling && inp.nextSibling.nodeType === inp.nodeType ) {
			pos = inp.nextSibling; }
	}

	// Is this changing to a password?
	if ( !this.echo ) {
		// Store the current input value.
		this.inp_buffer = inp.value;

		// Replace the INPUT element.
		var new_inp = document.createElement('input');
		new_inp.type = 'password';
		if ( cl ) { new_inp.className = cl; }
		if ( st ) { new_inp.setAttribute('style', st); }

		// Remove input.
		par.removeChild(inp);
		delete inp;
		delete this.input;

		// Attach the new input.
		if ( id ) { new_inp.id = id; }
		if ( pos ) { par.insertBefore(new_inp, pos);
		} else { par.appendChild(new_inp); }
		this.input = new_inp;

		// Attach an event listener for onKeyDown.
		addEvent(new_inp, 'keydown', function(e) { si.handleInputPassword(e); });

	} else {
		// Not a password.
		var lines = 1, new_inp;

		// Determine the number of lines.
		if ( this.inp_buffer ) {
			lines = this.inp_buffer.substr_count('\n') + 1; }

		// If one line, we're dealing with basic input. If more than one, a
		// textarea.
		if ( lines === 1 ) {
			new_inp = document.createElement('input');
			new_inp.type = 'text';
		} else {
			new_inp = document.createElement('textarea');
			if ( bodyHack ) {
				new_inp.setAttribute('rows', lines-1);
			} else {
				new_inp.setAttribute('rows', lines); }
		}

		if ( cl ) { new_inp.className = cl; }
		if ( st ) { new_inp.setAttribute('style', st); }

		// Set the value of the input element.
		if ( this.inp_buffer ) {
			new_inp.value = this.inp_buffer; }

		// Remove input.
		par.removeChild(inp);
		delete inp;
		delete this.input;

		// Attach the new input.
		if ( id ) { new_inp.id = id; }
		if ( pos ) { par.insertBefore(new_inp, pos);
		} else { par.appendChild(new_inp); }
		this.input = new_inp;

		// Attach an event listener.
		addEvent(new_inp, 'keydown', function(e) { si.handleInput(e); });
	}

	// Uncache input focus.
	this.inpFocus = foc;

	// Attach handlers for keydown, blur, and focus.
	var helper = function(e) { si.handleBlur(e); };
	addEvent(this.input, 'blur', helper);
	addEvent(this.input, 'focus', helper);

	if ( this.inpFocus ) {
		setTimeout(function(){si.input.select();si.input.focus();},1);
	}
};

// Expose this to DecafMUD
DecafMUD.plugins.Interface.simple = SimpleInterface;
})(DecafMUD);
