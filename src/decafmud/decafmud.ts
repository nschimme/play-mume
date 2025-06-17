// SPDX-License-Identifier: MIT
import * as pako from 'pako';
import { IDecafMUD, ITeloptHandler, DecafMUDOptions, DecafMUDSettings, DecafMUDConstructor } from './decafmud.types';

/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

/**
 * @fileOverview DecafMUD's Core
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// The obligatory, oh-so-popular wrapper function
(function(window) {

// Create a function for extending Objects
const extend_obj = function(base: { [key: string]: any }, obj: { [key: string]: any }) {
	for ( const key in obj ) {
		const o = obj[key];
		if ( typeof o === 'object' && o !== null && !('nodeType' in o) ) {
			if ( Array.isArray(o) ) {
				if ( base[key] === undefined ) { base[key] = []; }
				for(let i=0; i<o.length; i++) { // Loop variable i
					base[key].push(o[i]);
				}
			} else {
				if ( base[key] === undefined ) { base[key] = {}; }
				if ( typeof base[key] === 'object' && base[key] !== null ) {
					extend_obj(base[key], o);
				}
			}
		} else {
			base[key] = o;
		}
	}
	return base;
}

/**
 * Create a new instance of the DecafMUD client.
 * @name DecafMUD
 * @class The DecafMUD Core
 * @property {boolean} loaded This is true if DecafMUD has finished loading all
 *     the external files it requires. We won't start executing anything until
 *     this is true.
 * @property {boolean} connecting This is true while DecafMUD is trying to
 *     connect to a server and is still waiting for the socket to respond.
 * @property {boolean} connected This is true if DecafMUD is connected to a
 *     server. For internal use.
 * @property {number} id The id of the DecafMUD instance.
 * @param {Partial<DecafMUDOptions>} options Configuration settings for setting up DecafMUD.
 */
const DecafMUDInternal = function DecafMUD(this: IDecafMUD, options?: Partial<DecafMUDOptions>) {
	// Store the options for later.
	this.options = {} as DecafMUDOptions; // Initialize with base options type
	extend_obj(this.options, (DecafMUDInternal as unknown as DecafMUDConstructor).options);

	if ( options !== undefined ) {
		if ( typeof options !== 'object' ) { throw "The DecafMUD options argument must be an object!"; }
		extend_obj(this.options, options);
	}

	// Store the settings for later.
	this.settings = {} as DecafMUDSettings;
	extend_obj(this.settings, (DecafMUDInternal as unknown as DecafMUDConstructor).settings);

	// Set up the objects that'd be shared.
	this.need = [];
	this.inbuf = [];
	this.telopt = {};
	this.isCompressionActive = false;
	this.pakoInflateStream = undefined;

	// Increment DecafMUDInternal.last_id and use that as this instance's ID.
	this.id = ( ++DecafMUDInternal.last_id );

	// Store this instance for easy retrieval.
	DecafMUDInternal.instances.push(this);

	// Start doing debug stuff.
	this.debugString('Created new instance.', 'info');

	// If we have console grouping, log the options.
	if ( 'console' in window && console.groupCollapsed ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Provided Options');
		console.dir(this.options);
		console.groupEnd();
	}

	// Require the UI.
	this.require('decafmud.interface.'+this.options.interface);

	// Load those. After that, chain to the initSplash function.
	this.waitLoad(this.initSplash);

	return this;
} as unknown as DecafMUDConstructor; // Keep this cast for the object being constructed

// Instance Information
/** <p>An array with references to all the created instances of DecafMUD.</p>
 *  <p>Generally, each DecafMUD's id is the instance's index in
 *  this array.</p>
 * @type DecafMUD[] */
(DecafMUDInternal as any).instances	= [] as IDecafMUD[];

/** The ID of the latest instance of DecafMUD.
 * @type number */
(DecafMUDInternal as any).last_id	= -1;

/** DecafMUD's version. This can be used to check plugin compatability.
 * @example
 * if ( DecafMUD.version.major >= 1 ) {
 *   // Some Code Here
 * }
 * @example
 * alert("You're using DecafMUD v" + DecafMUD.version.toString() + "!");
 * // You're using DecafMUD v0.9.0alpha!
 * @type Object */
(DecafMUDInternal as any).version = {major: 0, minor: 10, micro: 0, flag: 'beta',
	toString: function(){ return this.major+'.'+this.minor+'.'+this.micro+( this.flag ? '-' + this.flag : ''); } };

// Default Values
// These are prototype methods, so they remain on DecafMUDInternal's prototype
DecafMUDInternal.prototype.loaded		= false;
DecafMUDInternal.prototype.connecting	= false;
DecafMUDInternal.prototype.connected	= false;

DecafMUDInternal.prototype.loadTimer	= null as number | null;
DecafMUDInternal.prototype.timer		= null as number | null;
DecafMUDInternal.prototype.connect_try	= 0;
DecafMUDInternal.prototype.required		= 0;

///////////////////////////////////////////////////////////////////////////////
// Plugins System
///////////////////////////////////////////////////////////////////////////////
/** This object stores all the available plugins for DecafMUD using a simple
 *  hierarchy. Every plugin should register itself in this tree once it's done
 *  loading.
 * @example
 * // Add the plugin MyPluginClass to DecafMUD as my_plugin.
 * DecafMUD.plugins.Extra.my_plugin = MyPluginClass;
 * @namespace All the available plugins for {@link DecafMUD}, in one easy-to-access
              tree. */
(DecafMUDInternal as any).plugins = {
	/** These plugins provide support for MUD output.
	 * @type Object */
	Display		: {},

	/** These plugins provide support for different text encodings.
	 * @type Object */
	Encoding	: {
    iso88591: undefined as any, // Will be assigned below
    utf8: undefined as any, // Will be assigned below
  } as DecafMUDConstructor['plugins']['Encoding'],

	/** These plugins don't fit into any other categories.
	 * @type Object */
	Extra		: {},

	/** These plugins provide user interfaces for the client.
	 * @type Object */
	Interface	: {},

	/** These plugins provide sockets for network connectivity, a must for a
	 *  mud client.
	 * @type Object */
	Socket		: {},

	/** These plugins provide persistent storage for the client, letting the
	 *  client remember user settings across browser sessions.
	 * @type Object */
	Storage		: {},

	/** These plugins provide extra telnet options for adding more sophisticated
	 *  client/server interaction to DecafMUD.
	 * @type Object */
	Telopt		: {} as DecafMUDConstructor['plugins']['Telopt'],

        /** These plugins filter text sent by the MUD after the Telnet
         * sequences are interpreted and removed, but it still contains the
         * ANSI escape sequences (colors etc).
         *
         * These plugins must provide the following functions:
         * - filterInputText( text ), returns the modified text.
         * - connected(), for clearing any internal state upon (re)connecting.
         *
         * You can enable the registered plugin to use with the
         * "textinputfilter" DecafMUD instance option.
         *
         * Example usage:  MUME makes it easier to parse its output by adding
         * pseudo-XML tags. They need to be parsed and removed from what's
         * shown to the user.
         */
        TextInputFilter : {}
};

/** This plugin handles conversion between raw data and iso-8859-1 encoded
 *  text, somewhat unimpressively as they're effectively the same thing.
 * @type Object */
/** This provides support for iso-8859-1 encoded data to DecafMUD, which isn't
 *  saying much as you realize that iso-8859-1 is simple, unencoded binary
 *  strings. We just have this so that the encoding system can work with a
 *  default encoder.
 * @example
 * alert(DecafMUD.plugins.Encoding.iso88591.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: iso-8859-1 */
(DecafMUD.plugins.Encoding as any).iso88591 = {
	proper : 'ISO-8859-1',

	/** Convert iso-8859-1 encoded text to unicode, by doing nothing.
     * @example
     * DecafMUD.plugins.Encoding.iso88591.decode("\xE2\x96\x93");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to decode. */
	decode : function(data: string): [string, string] { return [data,'']; },
	/** Convert unicode characters to iso-8859-1 encoded text, by doing
	 *  nothing. Should probably add some sanity checks in later, but I
	 *  don't really care for now.
     * @example
     * DecafMUD.plugins.Encoding.iso88591.encode("\xE2\x96\x93");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to encode. */
	encode : function(data: string): string { return data; }
};

/** This provides support for UTF-8 encoded data to DecafMUD, using built-in
 *  functions in a slightly hack-ish way to convert between UTF-8 and unicode.
 * @example
 * alert(DecafMUD.plugins.Encoding.utf8.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: UTF-8 */
(DecafMUD.plugins.Encoding as any).utf8 = {
	proper : 'UTF-8',

	/** Convert UTF-8 sequences to unicode characters.
     * @example
     * DecafMUD.plugins.Encoding.utf8.decode("\xE2\x96\x93");
     * // Becomes: "\u2593"
     * @param {String} data The text to decode. */
	decode : function(data: string): [string, string] {
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			// Decode manually so we can catch what's left.
			let out = '', i=0;
			const l=data.length;
			let c = 0, c2 = 0, c3 = 0, c4 = 0; // Ensure c2, c3, c4 are initialized if used later, or remove if not.
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) {
					// Normal Character
					out += String.fromCharCode(c); }

				else if ( (c > 0xBF) && (c < 0xE0) ) {
					// Two-Byte Sequence
					if ( i >= l ) { break; } // Adjusted condition to i >= l from i+1 >= l
					out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }

				else if ( (c > 0xDF) && (c < 0xF0) ) {
					// Three-Byte Sequence
					if ( i+1 >= l ) { break; } // Adjusted condition to i+1 >= l from i+2 >= l
					out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }

				else if ( (c > 0xEF) && (c < 0xF5) ) {
					// Four-Byte Sequence
					if ( i+2 >= l ) { break; } // Adjusted condition to i+2 >= l from i+3 >= l
					out += String.fromCharCode(((c & 10) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }

				else {
					// Bad Character.
					out += String.fromCharCode(c); }
			}
			return [out, data.substr(i)];
		} },

	/** Encode unicode characters into UTF-8 sequences.
     * @example
     * DecafMUD.plugins.Encoding.utf8.encode("\u2593");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to encode. */
	encode : function(data: string): string {
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) {
			console.dir(err); return data; } }
};

/** The variable storing instances of plugins is called loaded_plugs to avoid
 *  any unnecessary confusion created by {@link DecafMUD.plugins}.
 * @type Object */
DecafMUD.prototype.loaded_plugs = {};

// Create a function for class inheritence
const inherit = function(subclass: any, superclass: any) {
	const f = function() {};
	f.prototype = superclass.prototype;
	subclass.prototype = new f();
	subclass.superclass = superclass.prototype;
	if ( superclass.prototype.constructor == Object.prototype.constructor ) {
		superclass.prototype.constructor = superclass; }
};

///////////////////////////////////////////////////////////////////////////////
// TELNET Internals
///////////////////////////////////////////////////////////////////////////////
// Extra Constants
(DecafMUDInternal as any).ESC = "\x1B";
(DecafMUDInternal as any).BEL = "\x07";

// TELNET Constants
(DecafMUDInternal as any).TN = {
	// Negotiation Bytes
	IAC			: "\xFF", // 255
	DONT		: "\xFE", // 254
	DO			: "\xFD", // 253
	WONT		: "\xFC", // 252
	WILL		: "\xFB", // 251
	SB			: "\xFA", // 250
	SE			: "\xF0", // 240

	IS			: "\x00", // 0

	// END-OF-RECORD Marker / GO-AHEAD
	EORc		: "\xEF", // 239
	GA			: "\xF9", // 249

	// TELNET Options
	BINARY		: "\x00", // 0
	ECHO		: "\x01", // 1
	SUPGA		: "\x03", // 3
	STATUS		: "\x05", // 5
	SENDLOC		: "\x17", // 23
	TTYPE		: "\x18", // 24
	EOR			: "\x19", // 25
	NAWS		: "\x1F", // 31
	TSPEED		: "\x20", // 32
	RFLOW		: "\x21", // 33
	LINEMODE	: "\x22", // 34
	AUTH		: "\x23", // 35
	NEWENV		: "\x27", // 39
	CHARSET		: "\x2A", // 42

	MSDP		: "E", // 69
	MSSP		: "F", // 70
	COMPRESS	: "U", // 85
	COMPRESSv2	: "V", // 86
	MSP			: "Z", // 90
	MXP			: "[", // 91
	ZMP			: "]", // 93
	CONQUEST	: "^", // 94
	ATCP		: "\xC8", // 200
	GMCP		: "\xC9", // 201
}
const t = DecafMUD.TN;

const iacToWord = function(c: string): string {
	// var t = DecafMUD.TN; // t is already defined in the outer scope
	switch(c) {
		case t.IAC			: return 'IAC';
		case t.DONT			: return 'DONT';
		case t.DO			: return 'DO';
		case t.WONT			: return 'WONT';
		case t.WILL			: return 'WILL';
		case t.SB			: return 'SB';
		case t.SE			: return 'SE';

		case t.BINARY		: return 'TRANSMIT-BINARY';
		case t.ECHO			: return 'ECHO';
		case t.SUPGA		: return 'SUPPRESS-GO-AHEAD';
		case t.STATUS		: return 'STATUS';
		case t.SENDLOC		: return 'SEND-LOCATION';
		case t.TTYPE		: return 'TERMINAL-TYPE';
		case t.EOR			: return 'END-OF-RECORD';
		case t.NAWS			: return 'NEGOTIATE-ABOUT-WINDOW-SIZE';
		case t.TSPEED		: return 'TERMINAL-SPEED';
		case t.RFLOW		: return 'REMOTE-FLOW-CONTROL';
		case t.AUTH			: return 'AUTH';
		case t.LINEMODE		: return 'LINEMODE';
		case t.NEWENV		: return 'NEW-ENVIRON';
		case t.CHARSET		: return 'CHARSET';

		case t.MSDP			: return 'MSDP';
		case t.MSSP			: return 'MSSP';
		case t.COMPRESS		: return 'COMPRESS';
		case t.COMPRESSv2	: return 'COMPRESSv2';
		case t.MSP			: return 'MSP';
		case t.MXP			: return 'MXP';
		case t.ZMP			: return 'ZMP';
		case t.CONQUEST		: return 'CONQUEST-PROPRIETARY';
		case t.ATCP			: return 'ATCP';
		case t.GMCP			: return 'GMCP';
	}
	c = c.charCodeAt(0);
	if ( c > 15 ) { return c.toString(16); }
	else { return '0' + c.toString(16); }
}

/** Convert a telnet IAC sequence from raw bytes to a human readable format that
 *  can be output for debugging purposes.
 * @example
 * var IAC = "\xFF", DO = "\xFD", TTYPE = "\x18";
 * DecafMUDInternal.debugIAC(IAC + DO + TTYPE);
 * // Returns: "IAC DO TERMINAL-TYPE"
 * @param {String} seq The sequence to convert.
 * @returns {String} The human readable description of the IAC sequence. */
(DecafMUDInternal as any).debugIAC = function(seq: string): string {
	let out = '', state = 0, st: boolean | number = false; // st can be boolean or number
	const l = seq.length,
		  i2w = iacToWord;

	for( let i = 0; i < l; i++ ) {
		const c = seq.charAt(i),
			  cc = c.charCodeAt(0);

		// TTYPE Sequence
		if ( state === 2 ) {
			if ( c === t.ECHO ) { out += 'SEND '; }
			else if ( c === t.IS ) { out += 'IS '; }
			else if ( c === t.IAC ) {
				if ( st ) { st = false; out += '" IAC '; }
				else { out += 'IAC '; }
				state = 0;
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
			continue;
		}

		// MSSP / MSDP Sequence
		else if ( state === 3 || state === 4 ) {
			if ( c === t.IAC || (cc >= 1 && cc <= 4) ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 3 ) { out += 'MSDP_OPEN '; }
				else if ( cc === 4 ) { out += 'MSDP_CLOSE '; }
				else {
					if ( state === 3 ) { out += 'MSSP_'; }
					else { out += 'MSDP_'; }
					if ( cc === 1 ) { out += 'VAR '; }
					else { out += 'VAL '; }
				}
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
			continue;
		}

		// NAWS Sequence
		else if ( state === 5 ) {
			if ( c === t.IAC ) {
				st = false; out += 'IAC ';
				state = 0;
			} else {
				if ( st === false ) { st = cc * 255; }
				else {
					out += (cc + st).toString() + ' ';
					st = false;
				}
			}
			continue;
		}

		// CHARSET Sequence
		else if ( state === 6 ) {
			if ( c === t.IAC || (cc > 0 && cc < 8) ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 1 ) { out += 'REQUEST '; }
				else if ( cc === 2 ) { out += 'ACCEPTED '; }
				else if ( cc === 3 ) { out += 'REJECTED '; }
				else if ( cc === 4 ) { out += 'TTABLE-IS '; }
				else if ( cc === 5 ) { out += 'TTABLE-REJECTED '; }
				else if ( cc === 6 ) { out += 'TTABLE-ACK '; }
				else if ( cc === 7 ) { out += 'TTABLE-NAK '; }
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
		}

		// ZMP Sequence
		else if ( state === 7 ) {
			if ( c === t.IAC || cc === 0 ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 0 ) { out += 'NUL '; }
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
		}

		// Normal Sequence
		else if ( state < 2 ) {
			out += i2w(c) + ' '; }

		if ( state === 0 ) {
			if ( c === t.SB ) { state = 1; }
		} else if ( state === 1 ) {
			if ( c === t.TTYPE || c === t.TSPEED ) { state = 2; }
			else if ( c === t.MSSP ) { state = 3; }
			else if ( c === t.MSDP ) { state = 4; }
			else if ( c === t.NAWS ) { state = 5; }
			else if ( c === t.CHARSET ) { state = 6; }
			else if ( c === t.SENDLOC ) { state = 6; }
			else if ( c === t.GMCP ) { state = 6; }
			else if ( c === t.ZMP ) { state = 7; }
			else { state = 0; }
		}
	}

	return out.substr(0, out.length-1);
}

///////////////////////////////////////////////////////////////////////////////
// TELOPTS
///////////////////////////////////////////////////////////////////////////////

/** Handles the telopt TTYPE. */
class TeloptTTYPE implements ITeloptHandler {
    public decaf: IDecafMUD;
    public current: number = -1;

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public _dont(): void {
        this.current = -1;
    }

    public disconnect(): void {
        this.current = -1;
    }

    public _sb(data: string): false | void { // Return type based on original behavior
        if (data !== t.ECHO) { return; }
        this.current = (this.current + 1) % (this.decaf.options.ttypes?.length ?? 1); // Added nullish coalescing for safety
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.TTYPE + t.ECHO + t.IAC + t.SE));
        this.decaf.sendIAC(t.IAC + t.SB + t.TTYPE + t.IS + (this.decaf.options.ttypes?.[this.current] ?? '') + t.IAC + t.SE); // Added nullish coalescing

        return false; // We print our own debug info.
    }
}
(DecafMUD.plugins.Telopt as any)[t.TTYPE] = TeloptTTYPE;

/** Handles the telopt ECHO. */
class TeloptECHO implements ITeloptHandler {
    public decaf: IDecafMUD;

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public _will(): void {
        if (this.decaf.ui) { this.decaf.ui.localEcho(false); }
    }

    public _wont(): void {
        if (this.decaf.ui) { this.decaf.ui.localEcho(true); }
    }

    public disconnect(): void {
        if (this.decaf.ui) { this.decaf.ui.localEcho(true); }
    }
}
(DecafMUD.plugins.Telopt as any)[t.ECHO] = TeloptECHO;


/** Handles the telopt NAWS. */
class TeloptNAWS implements ITeloptHandler {
    public decaf: IDecafMUD;
    public enabled: boolean = false;
    public last: [number, number] | undefined = undefined; // Assuming getSize returns [number, number]

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public _do(): void {
        this.last = undefined;
        this.enabled = true;
        setTimeout(() => { this.send(); }, 0);
    }

    public _dont(): void {
        this.enabled = false;
    }

    public disconnect(): void {
        this.enabled = false;
    }

    public send(): void {
        if (!this.decaf.display || !this.enabled) { return; }
        const sz = this.decaf.display.getSize(); // Assumes IDisplay has getSize
        if (this.last !== undefined && this.last[0] === sz[0] && this.last[1] === sz[1]) { return; }
        this.last = sz;
        let data = String.fromCharCode(Math.floor(sz[0] / 255));
        data += String.fromCharCode(sz[0] % 255);
        data += String.fromCharCode(Math.floor(sz[1] / 255));
        data += String.fromCharCode(sz[1] % 255);
        data = t.IAC + t.SB + t.NAWS + data.replace(/ÿ/g, 'ÿÿ') + t.IAC + t.SE;
        this.decaf.sendIAC(data);
    }
}
(DecafMUD.plugins.Telopt as any)[t.NAWS] = TeloptNAWS;


/** Handles the telopt CHARSET. */
class TeloptCHARSET implements ITeloptHandler {
    public decaf: IDecafMUD;

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public _dont(): false { // Original returned false
        return false;
    }

    public _will(): void {
        setTimeout(() => {
            const cs: string[] = [];
            const done: string[] = [];
            let e_val: string | undefined; // To avoid conflict with loop var e

            // Add the current encoding first if not ISO-8859-1
            const currentEncoding = this.decaf.options.encoding;
            if (currentEncoding && currentEncoding !== 'iso88591' &&
                DecafMUD.plugins.Encoding[currentEncoding] !== undefined &&
                DecafMUD.plugins.Encoding[currentEncoding].proper !== undefined) {
                cs.push(DecafMUD.plugins.Encoding[currentEncoding].proper);
                done.push(currentEncoding);
            }

            // Add the encodings in the order we want.
            for (const encKey of this.decaf.options.encoding_order ?? []) {
                e_val = encKey;
                if (DecafMUD.plugins.Encoding[e_val] === undefined ||
                    DecafMUD.plugins.Encoding[e_val].proper === undefined ||
                    done.includes(e_val)) { continue; }
                cs.push(DecafMUD.plugins.Encoding[e_val].proper);
                done.push(e_val);
            }

            // Add the rest now.
            for (const k in DecafMUD.plugins.Encoding) {
                if (done.includes(k) || DecafMUD.plugins.Encoding[k].proper === undefined) { continue; }
                cs.push(DecafMUD.plugins.Encoding[k].proper);
            }

            this.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + t.ECHO + ' ' + cs.join(' ') + t.IAC + t.SE);
        }, 0);
    }

    public _sb(data: string): false | void { // Return type based on original
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.CHARSET + data + t.IAC + t.SE));

        if (data.charCodeAt(0) === 1) { // REQUEST
            let requestData = data.substr(1);
            if (requestData.indexOf('TTABLE ') === 0) {
                requestData = requestData.substr(8);
            }

            const sep = requestData.charAt(0);
            const requestedCharsets = requestData.substr(1).split(sep);
            let chosenEncoding: string | undefined;
            let originalCharsetName: string | undefined;

            // Check preferred encoding order
            for (const encKey of this.decaf.options.encoding_order ?? []) {
                const encodingPlugin = DecafMUD.plugins.Encoding[encKey];
                if (encodingPlugin === undefined || encodingPlugin.proper === undefined) continue;
                if (requestedCharsets.includes(encKey)) {
                    originalCharsetName = encKey;
                    chosenEncoding = encKey;
                    break;
                }
                if (requestedCharsets.includes(encodingPlugin.proper)) {
                    originalCharsetName = encodingPlugin.proper;
                    chosenEncoding = encKey;
                    break;
                }
            }

            if (chosenEncoding === undefined) {
                for (const reqCharset of requestedCharsets) {
                    originalCharsetName = reqCharset;
                    for (const k in DecafMUD.plugins.Encoding) {
                        if (reqCharset === k || reqCharset === DecafMUD.plugins.Encoding[k].proper) {
                            chosenEncoding = k;
                            break;
                        }
                    }
                    if (chosenEncoding) { break; }
                }
            }

            if (chosenEncoding && originalCharsetName) {
                this.decaf.setEncoding(chosenEncoding);
                this.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + '\x02' + originalCharsetName + t.IAC + t.SE);
            } else {
                this.decaf.debugString("No encoder for: " + requestedCharsets.join(sep));
                this.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + '\x03' + t.IAC + t.SE);
            }
        } else if (data.charCodeAt(0) === 2) { // ACCEPTED
            const acceptedCharsetName = data.substr(1);
            let newEncoding: string | undefined;
            for (const k in DecafMUD.plugins.Encoding) {
                if (DecafMUD.plugins.Encoding[k].proper === acceptedCharsetName) {
                    newEncoding = k;
                    break;
                }
            }
            if (newEncoding) { this.decaf.setEncoding(newEncoding); }
        }
        return false; // We print our own debug.
    }
}
(DecafMUD.plugins.Telopt as any)[t.CHARSET] = TeloptCHARSET;


/** Handles the telopt COMPRESSv2 (MCCP2) */
class TeloptCompressV2 implements ITeloptHandler {
    public decaf: IDecafMUD;

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public _will(): boolean { // Original returned true
        return true;
    }

    public _sb(): void {
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.COMPRESSv2 + t.IAC + t.SE));
        this.decaf.pakoInflateStream = new pako.Inflate({ to: 'string' });
        this.decaf.isCompressionActive = true;
    }
}
(DecafMUD.plugins.Telopt as any)[t.COMPRESSv2] = TeloptCompressV2;

DecafMUD.prototype.disableMCCP2 = function(this: IDecafMUD): void {
	this.sendIAC(t.IAC + t.DONT + t.COMPRESSv2);
	this.isCompressionActive = false;
	this.pakoInflateStream = undefined;
	this.inbuf = [];
}

/** Handles the telopt MSDP. */
class TeloptMSDP implements ITeloptHandler {
    public decaf: IDecafMUD;
    public commands: string[] = [];
    public variables: string[] = [];
    public reportable: string[] = [];

    static readonly config_vars = {
        'CLIENT_NAME'		: 'decafmud',
        'CLIENT_VERSION'	: DecafMUD.version.toString(),
        'PLUGIN_ID'			: '0',
        'ANSI_COLORS'		: '1',
        'UTF_8'				: '1',
        'XTERM_256_COLORS'	: '1'
    };

    private static readonly msdpRegExp = /[]/;

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
    }

    public connect(): void {
        this.commands = ['LIST'];
        this.variables = [];
        this.reportable = [];
    }

    public _will(): void {
        setTimeout(() => {
            this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02COMMANDS' + t.IAC + t.SE);
            this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02VARIABLES' + t.IAC + t.SE);
            this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02CONFIGURABLE_VARIABLES' + t.IAC + t.SE);
            this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02REPORTABLE_VARIABLES' + t.IAC + t.SE);
        }, 0);
    }

    public _sb(data: string): boolean | void { // Based on original
        const out = TeloptMSDP.readMSDPData(data)[0];
        let ret = false;

        if ('console' in window && console.groupCollapsed) {
            console.groupCollapsed('DecafMUD[' + this.decaf.id + ']: RCVD IAC SB MSDP ... IAC SE');
            console.dir(out);
            console.groupEnd(); // Corrected: console.groupEnd();
        } else { ret = true; }

        if (out['COMMANDS'] !== undefined) {
            for (let i = 0; i < out['COMMANDS'].length; i++) {
                this.commands.push(out['COMMANDS'][i]);
            }
        }

        if (out['VARIABLES'] !== undefined) {
            for (let i = 0; i < out['VARIABLES'].length; i++) {
                this.variables.push(out['VARIABLES'][i]);
            }
        }

        if (out['CONFIGURABLE_VARIABLES'] !== undefined) {
            const o = out['CONFIGURABLE_VARIABLES'];
            const ot: { [key: string]: string } = {};
            for (let i = 0; i < o.length; i++) {
                if (TeloptMSDP.config_vars[o[i]] !== undefined) {
                    ot[o[i]] = TeloptMSDP.config_vars[o[i]];
                }
            }
            this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + TeloptMSDP.writeMSDPData(ot) + t.IAC + t.SE);
        }
        return ret;
    }

    /** Read a string of MSDP-formatted variables and return an object. */
    public static readMSDPData(data: string): [any, string] {
        let out: any = {};
        let variable: string | undefined = undefined;

        while (data.length > 0) {
            const c = data.charCodeAt(0);

            if (c === 1) { // MSDP_VAR
                const ind = data.substr(1).search(TeloptMSDP.msdpRegExp);
                if (ind === -1) {
                    variable = data.substr(1);
                    data = '';
                } else {
                    variable = data.substr(1, ind);
                    data = data.substr(ind + 1);
                }
                out[variable] = undefined;
                continue;
            } else if (c === 4) { // MSDP_CLOSE
                data = data.substr(1);
                break;
            }

            if (variable === undefined) {
                return [out, '']; // Should not happen if protocol is followed
            }

            if (c === 2) { // MSDP_VAL
                let val;
                if (data.charCodeAt(1) === 3) { // MSDP_OPEN
                    const o = TeloptMSDP.readMSDPData(data.substr(2));
                    val = o[0];
                    data = o[1];
                } else {
                    const ind = data.substr(1).search(TeloptMSDP.msdpRegExp);
                    if (ind === -1) {
                        val = data.substr(1);
                        data = '';
                    } else {
                        val = data.substr(1, ind);
                        data = data.substr(ind + 1);
                    }
                }

                if (out[variable] === undefined) {
                    out[variable] = val;
                } else if (Array.isArray(out[variable])) {
                    out[variable].push(val);
                } else {
                    out[variable] = [out[variable], val];
                }
                continue;
            }
            break;
        }
        return [out, data];
    }

    /** Convert a variable to a string of valid MSDP-formatted data. */
    public static writeMSDPData(obj: any): string {
        const type = typeof obj;
        if (type === 'string' || type === 'number') { return obj.toString(); }
        else if (type === 'boolean') { return obj ? '1' : '0'; }
        else if (type === 'undefined') { return ''; }
        else if (type === 'object') {
            let outStr = '';
            for (const k in obj) {
                if (obj[k] === undefined || obj[k] === null || typeof obj[k] === 'function') { continue; }
                outStr += '\x01' + k; // MSDP_VAR
                if (typeof obj[k] === 'object') {
                    if (Array.isArray(obj[k])) {
                        const v = obj[k];
                        for (let i = 0; i < v.length; i++) {
                            outStr += '\x02' + TeloptMSDP.writeMSDPData(v[i]); // MSDP_VAL
                        }
                    } else if (obj[k].nodeType === undefined) { // Avoid DOM nodes
                        outStr += '\x02\x03' + TeloptMSDP.writeMSDPData(obj[k]) + '\x04'; // MSDP_VAL, MSDP_OPEN, ..., MSDP_CLOSE
                    }
                } else {
                    outStr += '\x02' + TeloptMSDP.writeMSDPData(obj[k]); // MSDP_VAL
                }
            }
            return outStr;
        }
        return obj.toString();
    }
}
(DecafMUD.plugins.Telopt as any)[t.MSDP] = TeloptMSDP;

/** We always transmit binary. What else would we transmit? */
(DecafMUD.plugins.Telopt as any)[t.BINARY] = true;

/** Only use MSSP for debugging purposes. */
(DecafMUD.plugins.Telopt as any)[t.MSSP] = 'console' in window;

///////////////////////////////////////////////////////////////////////////////
// Debugging
///////////////////////////////////////////////////////////////////////////////

/** Write a string to the debug console. The type can be one of: debug, info,
  * error, or warn, and defaults to debug. This does nothing if the console
  * doesn't exist.
  * @param {String} text The text to write to the debug console.
  * @param {String} [type="debug"] The type of message. One of: debug, info, error, warn
  * @param {Record<string, any>} [obj]  An object with extra details for use in the provided text.
  * @example
  * const details = {name: "Fred", bone: "tibia"};
  * decaf.debugString("{name} broke their {bone}!", 'info', details);
  */
DecafMUD.prototype.debugString = function(this: IDecafMUD, text: string, type?: string, obj?: Record<string, any>): void {
	// Return if we don't have the console or a debug pane.
	if (!('console' in window) ) { return; }

	// Set the type to debug by default
	if ( type === undefined ) { type = 'debug'; }

	// Prepare the string.
	if ( obj !== undefined ) {
		for (const i in obj) {
			text = text.replace(`{${i}}`, String(obj[i])); // Ensure obj value is string
		}
	}

	// Firebug / Console Logging
	// if (!( 'console' in window )) { return; } // Redundant check
	const st = 'DecafMUD[%d]: %s';
	switch(type) {
		case 'info':	console.info(st, this.id, text); return;
		case 'warn':	console.warn(st, this.id, text); return;
		case 'error':	console.error(st, this.id, text); return;
		default:
			if ( 'debug' in console ) {
				console.debug(st, this.id, text);
				return;
			}
			console.log(st, this.id, text);
	}
}

/** Show an error to the user, either via the interface if it's loaded or,
 *  failing that, a call to alert().
 * @param {String} text The error message to display.
 * @example
 * decaf.error("My pants are on fire!");
 */
DecafMUD.prototype.error = function(this: IDecafMUD, text: string): void {
	// Print to debug
	this.debugString(text, 'error');

	// If we have console grouping, log the options.
	if ( 'console' in window && console.groupCollapsed !== undefined ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Instance State');
		console.dir(this);
		console.groupEnd();
	}

	// If we have a UI, try splashError.
	if ( this.ui && this.ui.splashError(text) ) { return; }

	// TODO: Check the Interface and stuff
	alert(`DecafMUD Error\n\n${text}`);
}

///////////////////////////////////////////////////////////////////////////////
// Module Loading
///////////////////////////////////////////////////////////////////////////////

/** Load a script from an external file, using the given path. If a path isn't
 *  provided, find the path to decafmud.js and use that.
 * @param {string} filename The name of the script file to load.
 * @param {string} [path] The path to load the script from.
 * @example
 * decaf.loadScript("my-plugin-stuff.js");
 */
DecafMUD.prototype.loadScript = function(this: IDecafMUD, filename: string, path?: string): void {
	let currentPath = path;
	if ( currentPath === undefined ) {
		if ( this.options.jslocation !== undefined ) { currentPath = this.options.jslocation; }
		if ( currentPath === undefined || typeof currentPath === 'string' && currentPath.length === 0 ) {
			// Attempt to discover the path.
			let obj: HTMLScriptElement | null = document.querySelector('script[src*="decafmud.js"]');
			if ( obj === null ) {
				obj = document.querySelector('script[src*="decafmud.min.js"]'); }
			if ( obj !== null ) {
				currentPath = obj.src.substr(0,obj.src.lastIndexOf('/')+1); }
		}
	}

	// Now that we have a path, create a script element to load our script
	// and add it to the header so that it's loaded.
	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = (currentPath || '') + filename;
	document.getElementsByTagName('head')[0].appendChild(script);

	// Debug that we've loaded it.
	this.debugString('Loading script: ' + filename); // + ' (' + script.src + ')');
}

/** Require a moddule to be loaded. Plugins can call this function to ensure
 *  that their dependencies are loaded. Be sure to use this along with waitLoad
 *  to ensure the modules are loaded before calling code that uses them.
 * @param {String} module The module that has to be loaded.
 * @param {function} [check] If specified, this function will be used to check
 *    that the module is loaded. Otherwise, it will be looked for in the
 *    DecafMUD plugin tree.
 * @example
 * decaf.require('decafmud.encoding.cp437');
 * @example
 * // External module
 * decaf.require('my-module', function() {
 *    return 'SomeRequirement' in window;
 * }); */
DecafMUD.prototype.require = function(this: IDecafMUD, module_name: string, check?: () => boolean): void { // Renamed module to module_name
	let currentCheck = check;
	if ( currentCheck === undefined ) {
		// Build a checker
		if ( module_name.toLowerCase().indexOf('decafmud') === 0 ) {
			const parts = module_name.split('.');
			if ( parts.length < 2 ) { return; } // Already have DecafMUD, duh.
			parts.shift();
			parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);

			// If it's a telopt, search DecafMUD.TN for it.
			if ( parts[0] === 'Telopt' ) {
				for(const k in (DecafMUD as any).TN) { // Use (DecafMUD as any)
					if ( parts[1].toUpperCase() === k.toUpperCase() ) {
						parts[1] = (DecafMUD as any).TN[k]; // Use (DecafMUD as any)
						break; }
				}
			}

			currentCheck = function() {
				if ( (DecafMUD as any).plugins[parts[0]] !== undefined ) { // Use (DecafMUD as any)
					if ( parts.length > 1 ) {
						return (DecafMUD as any).plugins[parts[0]][parts[1]] !== undefined; // Use (DecafMUD as any)
					} else { return true; }
				}
				return false;
			};
		} else {
			throw "Can't build checker for non-DecafMUD module!"
		}
	}

	// Increment required.
	this.required++;

	// Call the checker. If we already have it, return now.
	if ( currentCheck!.call(this) ) { return; } // Assert currentCheck is defined

	// Load the script.
	/*const decaf = this;
	setTimeout(function() {
		decaf.loadScript(module+'.js');
	},this.required*500);*/
	this.loadScript(module_name+'.js'); // Use module_name

	// Finally, push to need for waitLoad to work.
	this.need.push([module_name,currentCheck]); // Use module_name
};

/** Wait for all the currently required modules to load. Then, after everything
 *  has loaded, call the supplied function to continue execution. This function
 *  calls itself on a timer to work without having to block. Since blocking is
 *  evil.
 * @param {function} next The function to call when everything has loaded.
 * @param {function} [itemloaded] If provided, this function will be called
 *    each time a new item has been loaded. Useful for splash screens.
 */
DecafMUD.prototype.waitLoad = function(this: IDecafMUD, next: () => void, itemloaded?: (module_name: string, next_mod?: string, perc?: number) => void, tr?: number): void { // Renamed module to module_name
	clearTimeout(this.loadTimer as number | undefined); // Cast to number if it's a timeout ID

	let currentTr = tr;
	if ( currentTr === undefined ) { currentTr = 0; }
	else if ( currentTr > this.options.wait_tries ) {
		this.error(`Timed out attempting to load the module: ${this.need[0][0]}`);
		return;
	}

	while( this.need.length ) {
		if ( typeof this.need[0] === 'string' ) {
			this.need.shift();
		} else {
			if ( this.need[0][1].call(this) ) {
				if ( itemloaded !== undefined ) {
					if ( this.need.length > 1 ) {
						itemloaded.call(this,this.need[0][0], this.need[1][0]);
					} else {
						itemloaded.call(this,this.need[0][0]);
					}
				}
				this.need.shift();
				tr = 0;
			} else { break; }
		}
	}

	// If this.need is empty, call next. If not, call it again in a bit.
	if ( this.need.length === 0 ) {
		next.call(this);
	} else {
		const decaf = this;
		this.loadTimer = setTimeout(function(){decaf.waitLoad(next,itemloaded,(currentTr || 0)+1)},this.options.wait_delay);
	}
}

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

/** The first step of initialization after loading the user interface. Here, we
 *  create a new instance of the user interface and tell it to show a basic
 *  splash. Then, we start loading the other plugins.
 */
DecafMUD.prototype.initSplash = function(this: IDecafMUD): void {
	// Create the UI if we're using one. Which we always should be.
	if ( this.options.interface !== undefined ) {
		this.debugString(`Attempting to initialize the interface plugin "${this.options.interface}".`);
		const InterfacePlugin = (DecafMUD as any).plugins.Interface[this.options.interface];
		if (InterfacePlugin) {
			this.ui = new InterfacePlugin(this);
			this.ui!.initSplash(); // Add definite assignment assertion or check if ui is defined
		} else {
			this.error(`Interface plugin "${this.options.interface}" not found.`);
			return;
		}
	}

	// Set the number of extra steps predicted after this step of loading for
	// the sake of updating the progress bar.
	this.extra = 3;

	// Require plugins for: storage, socket, encoding, triggers, telopt
	this.require('decafmud.storage.'+this.options.storage);
	this.require('decafmud.socket.'+this.options.socket);
	this.require('decafmud.encoding.'+this.options.encoding);

	// Load them. This is the total number of required things thus far.
	if ( this.ui && this.need.length > 0 ) { this.updateSplash(null,this.need[0][0],0); }
	this.waitLoad(this.initSocket, this.updateSplash);
}

/** Update the splash screen as we load. */
DecafMUD.prototype.updateSplash = function(this: IDecafMUD, module_name: string | boolean | null, next_mod?: string, perc?: number): void { // Renamed module to module_name
	if ( !this.ui ) { return; }

	// Calculate the percentage.
	if ( perc === undefined && this.extra !== undefined && this.required !== undefined) { // Added checks for this.extra and this.required
		perc = Math.min(100,Math.floor(100*(((this.extra+this.required)-this.need.length)/(this.required+this.extra))));
	}


	let message_to_display: string | undefined = next_mod;
	if ( module_name === true ) {
		// Don't do anything with next_mod if module_name is true, use the passed next_mod
	} else if ( next_mod !== undefined ) {
		if ( next_mod.indexOf('decafmud') === 0 ) {
			const parts = next_mod.split('.');
			message_to_display = `Loading the ${parts[1]} module "${parts[2]}"...`;
		} else {
			message_to_display = `Loading: ${next_mod}`;
		}
	} else if ( perc !== undefined && perc >= 100 ) { // Check perc defined
		message_to_display = "Loading complete.";
	}

	this.ui.updateSplash(perc, message_to_display);
}

/** The second step of initialization. */
DecafMUD.prototype.initSocket = function(this: IDecafMUD): void {
	this.extra = 1;
	// Create the master storage object.
	const StoragePlugin = (DecafMUD as any).plugins.Storage[this.options.storage!]; // Added non-null assertion
	if (StoragePlugin) {
		this.store = new StoragePlugin(this);
		this.storage = this.store;
	} else {
		this.error(`Storage plugin "${this.options.storage}" not found.`);
		return;
	}


	if ( this.ui ) {
		// Push a junk element to need so the status bar shows properly.
		this.need.push('.');
		this.updateSplash(true,"Initializing the user interface...");

		// Set up the UI.
		this.ui.load();
	}

	// Attempt to create the socket.
	this.debugString(`Creating a socket using the "${this.options.socket}" plugin.`);
	const SocketPlugin = (DecafMUD as any).plugins.Socket[this.options.socket!]; // Added non-null assertion
	if (SocketPlugin) {
		this.socket = new SocketPlugin(this);
		this.socket!.setup(0); // Add definite assignment assertion or check
	} else {
		this.error(`Socket plugin "${this.options.socket}" not found.`);
		return;
	}

	// Load the latest round.
	this.waitLoad(this.initUI, this.updateSplash);
}

/** The third step. Now we're creating the UI. */
DecafMUD.prototype.initUI = function(this: IDecafMUD): void {
	// Finish setting up the UI.
	if ( this.ui ) {
		this.ui.setup(); }

	// Now, require all our plugins.
	if (this.options.plugins) {
		for(let i=0; i<this.options.plugins.length; i++) { // Changed var to let
			this.require('decafmud.'+this.options.plugins[i]);
		}
	}

	this.waitLoad(this.initFinal, this.updateSplash);
}

/** The final step. Instantiate all our plugins. */
DecafMUD.prototype.initFinal = function(this: IDecafMUD): void {
	let textInputFilterCtor: any, o: any;

	this.need.push('.');
	this.updateSplash(true,"Initializing triggers system...");
	this.need.shift();

	this.need.push('.');
	this.updateSplash(true,"Initializing TELNET extensions...");

	for(const k in (DecafMUD as any).plugins.Telopt) {
		o = (DecafMUD as any).plugins.Telopt[k];
		if ( typeof o === 'function' ) { // Check if it's a class constructor
			this.telopt[k] = new (o as any)(this);
		} else {
			this.telopt[k] = o; // This could be boolean or undefined
		}
	}

	this.need.push('.');
	this.updateSplash(true,"Initializing filters...");

	if (this.options.textinputfilter) {
		textInputFilterCtor = (DecafMUD as any).plugins.TextInputFilter[this.options.textinputfilter];
		if ( textInputFilterCtor ) {
			this.textInputFilter = new textInputFilterCtor(this);
		}
	}

	// We're loaded. Try to connect.
	this.loaded = true;
	if (this.ui) { this.ui.endSplash(); }


	if ( (!this.options.autoconnect) || (!this.socket || !this.socket.ready)) { return; } // Added check for this.socket
	this.connect();
}

/** Attempt to connect to the server if we aren't. */
DecafMUD.prototype.connect = function(this: IDecafMUD): void {
	if ( this.connecting || this.connected ) { return; }
	if ( this.socket_ready !== true ) { throw "The socket isn't ready yet."; }
	if (!this.socket) { throw "Socket not initialized."; } // Added check


	this.connecting = true;
	this.connect_try = 0;
	this.debugString("Attempting to connect...","info");

	// Show that we're connecting
	if ( this.ui && this.ui.connecting ) {
		this.ui.connecting(); }

	// Set a timer so we can try again.
	const decaf = this; // Changed var to const
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);

	this.socket.connect();
}

/** Called when the socket doesn't connect in a reasonable time. Resets the
 *  socket to try again. */
DecafMUD.prototype.connectFail = function(this: IDecafMUD): void {
	clearTimeout(this.conn_timer);
	if (!this.socket) { this.error("connectFail called without a socket."); return; }


	(this as any).cconnect_try = ((this as any).cconnect_try || 0) + 1; // Initialize if undefined
	// On the last one, just ride it out.
	if ( this.connect_try > (this.options.reconnect_tries ?? 3) ) { return; } // Added nullish coalescing

	// Retry.
	this.socket.close();
	this.socket.connect();

	// Set the timer.
	const decaf = this; // Changed var to const
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
}


DecafMUD.prototype.reconnect = function(this: IDecafMUD): void {
  this.connect_try++;
  //if ( this.connect_try < this.options.reconnect_tries ) {
    const d = this; // Changed var to const
    if ( d.ui && d.ui.connecting ) {
      d.ui.connecting();
    }
    if (d.socket) { d.socket.connect(); } // Added check
  //}
}

///////////////////////////////////////////////////////////////////////////////
// Socket Events
///////////////////////////////////////////////////////////////////////////////

/** Called by the socket when the socket is ready. Make note that the socket is
 *  available, and if desired start trying to connect. */
DecafMUD.prototype.socketReady = function(this: IDecafMUD): void {
	this.debugString("The socket is ready.");
	this.socket_ready = true;

	// If we've loaded, and autoconnect is on, try connecting.
	if ( this.loaded && this.options.autoconnect ) {
		this.connect();
	}
}

/** Called by the socket when the socket connects. */
DecafMUD.prototype.socketConnected = function(this: IDecafMUD): void {
	this.connecting = false; this.connected = true; this.connect_try = 0;
	clearTimeout(this.conn_timer);

	// Get the host and stuff.
	const host = this.socket!.host, port = this.socket!.port; // Add non-null assertion if socket is expected

	this.debugString(`The socket has connected successfully to ${host}:${port}.`,"info");

	// Call telopt connected code.
	for(const k in this.telopt) {
		const handler = this.telopt[k]; // Cache handler
		if ( handler && typeof handler !== 'boolean' && handler.connect ) { // Check handler is not boolean
			handler.connect();
		}
	}


	if ( this.textInputFilter )
		this.textInputFilter.connected();

	// Show that we're connected.
	if ( this.ui && this.ui.connected ) {
		this.ui.connected(); }

}

/** Called by the socket when the socket disconnects. */
DecafMUD.prototype.socketClosed = function(this: IDecafMUD): void {
	clearTimeout(this.conn_timer);
	this.connecting = false; this.connected = false;
	this.debugString("The socket has disconnected.","info");

	// Call telopt disconnected code.
	for(const k in this.telopt) {
		const handler = this.telopt[k]; // Cache handler
		if ( handler && typeof handler !== 'boolean' && handler.disconnect ) { // Check handler is not boolean
			handler.disconnect();
		}
	}

	// Clear the buffer to ensure we don't enter into a bad state on reconnect.
	this.inbuf = [];

	// Disable MCCP2 compression, for the same reason
	(this as any).decompressStream = undefined; // Using any for properties not in IDecafMUD yet
	(this as any).startCompressV2 = false; // Using any for properties not in IDecafMUD yet


	// Should we be reconnecting?
	if ( this.options.autoreconnect ) {
		this.connect_try++;
		if ( this.connect_try < (this.options.reconnect_tries ?? 3) ) { // Added nullish coalescing
			// Show the message, along with a 'reconnecting...' bit if possible.
			if ( this.ui && this.ui.disconnected ) {
				this.ui.disconnected(true); }

			const d = this;

			// Show a reconnect infobar
			const s = (this.options.reconnect_delay ?? 5000) / 1000; // Added nullish coalescing
			if ( this.ui && this.ui.immediateInfoBar && s >= 0.25 ) {
				this.ui.immediateInfoBar(`You have been disconnected. Reconnecting in ${s} second${(s === 1 ? '' : 's')}...`,
					'reconnecting',
					s,
					undefined,
					[['Reconnect Now',function(){ clearTimeout(d.timer as number | undefined); if (d.socket) d.socket.connect(); }]], // Added check
					undefined,
					function(){ clearTimeout(d.timer as number | undefined);  }
				); }

			this.timer = setTimeout(function(){
				d.debugString('Attempting to connect...','info');
				if ( d.ui && d.ui.connecting ) {
					d.ui.connecting(); }
				if (d.socket) {d.socket.connect();} // Added check
			}, this.options.reconnect_delay);
			return;
		}
	}

	// Show that we disconnected.
	if ( this.ui && this.ui.disconnected ) {
		this.ui.disconnected(false); }
}

/** Called by the socket when data arrives. */
DecafMUD.prototype.socketData = function(this: IDecafMUD, data: string | Uint8Array): void {
	// Push the text onto the inbuf.

	if (this.isCompressionActive && this.pakoInflateStream) {
		try {
			let binaryData;
			if (typeof data === 'string') {
				binaryData = new Uint8Array(data.length);
				for (let i = 0; i < data.length; i++) {
					binaryData[i] = data.charCodeAt(i);
				}
			} else { // Assuming it's already a Uint8Array or ArrayBuffer-like
				binaryData = new Uint8Array(data);
			}

			this.pakoInflateStream.push(binaryData, false);

			if (this.pakoInflateStream.result) {
				data = this.pakoInflateStream.result as string;
				this.pakoInflateStream = new pako.Inflate({ to: 'string' });
			} else {
				if (this.pakoInflateStream.err) {
					 this.error(`MCCP2 decompression error: ${this.pakoInflateStream.msg}`);
					 this.disableMCCP2();
					 return;
				}
				return;
			}

		} catch (e) {
			const err = e as Error; // Type assertion
			this.error('MCCP2 compression disabled because ' + err.message);
			this.disableMCCP2();
			return;
		}
	}

	this.inbuf.push(data);

	// If we've finished loading, handle it.
	if ( this.loaded ) {
		this.processBuffer();
	}
}

/** Called by the socket when there's an error. */
DecafMUD.prototype.socketError = function(this: IDecafMUD, data: string, data2?: string): void {
	this.debugString(`Socket Err: ${data}  d2="${data2}"`,'error');
}

///////////////////////////////////////////////////////////////////////////////
// Data Processing
///////////////////////////////////////////////////////////////////////////////

/** Get an internal incoder from a formatted name. */
DecafMUD.prototype.getEnc = function(this: IDecafMUD, enc: string): string {
	enc = enc.replace(/-/g,'').toLowerCase();
	return enc;
}

/** Change the active encoding scheme to the provided scheme.
 * @param {String} enc The encoding scheme to use. */
DecafMUD.prototype.setEncoding = function(this: IDecafMUD, enc: string): void {
	const new_enc = this.getEnc(enc); // Store result of getEnc

	const encodingPlugin = (DecafMUD as any).plugins.Encoding[new_enc];
	if ( encodingPlugin === undefined ) {
		throw '"'+new_enc+"' isn't a valid encoding scheme, or it isn't loaded.";
	}


	this.debugString("Switching to character encoding: " + new_enc);
	this.options.encoding = new_enc;

	// Now, reroute functions for speed.
	this.decode = encodingPlugin.decode;
	this.encode = encodingPlugin.encode;
}

const iac_reg = /\xFF/g; // Changed var to const
/** Send input to the MUD, as if typed by a player. This means it also goes out
 *  to the display and stuff. Escape any IAC bytes.
 * @param {String} input The input to send to the server. */
DecafMUD.prototype.sendInput = function(this: IDecafMUD, input: string): void {
	if ( !this.socket || !this.socket.connected ) {
		this.debugString("Cannot send input: not connected");
		return;
	}

	this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));

	if ( this.ui ) {
		this.ui.displayInput(input); }
}

/** This function is a mere helper for decoding. It'll be overwritten. */
DecafMUD.prototype.decode = function(this: IDecafMUD, data: string): [string, string] {
	const encodingPlugin = (DecafMUD as any).plugins.Encoding[this.options.encoding!]; // Added non-null assertion
  if (encodingPlugin) {
    return encodingPlugin.decode(data);
  }
  // Fallback or error if plugin not found (though setEncoding should prevent this)
  return [data, ''];
};

/** This function is a mere helper for encoding. It'll be overwritten. */
DecafMUD.prototype.encode = function(this: IDecafMUD, data: string): string {
	const encodingPlugin = (DecafMUD as any).plugins.Encoding[this.options.encoding!]; // Added non-null assertion
  if (encodingPlugin) {
    return encodingPlugin.encode(data);
  }
  // Fallback or error
  return data;
};

/** Read through data, only stopping for TELNET sequences. Pass data through
 *  towards the display handler. */
DecafMUD.prototype.processBuffer = function(this: IDecafMUD): void {
	let enc: [string, string], currentDataArr: string[] = [], ind: number, out: string | boolean;
	// Each element from inbuf can be either a string (from a Flash socket, for example) or a Uint8Array from a websocket. Either way, each element will be concatenated together as a string
	for (const i of this.inbuf) { // Changed var to const
		if (typeof(i) == 'string') { // If it's a string, just keep it. No need to convert
			currentDataArr.push(i);
			continue;
		}
		// Converts a Uint8Array to a string
		currentDataArr.push(Array.from(i).map(charCode=>String.fromCharCode(charCode)).join(''));
	}
	let currentData = currentDataArr.join(''); // Changed var to let
	const IAC = DecafMUD.TN.IAC; // Changed var to const
	let leftOverForNextIteration=''; // Renamed left to be more descriptive
	this.inbuf = [];
	// Loop through the string.
	while ( currentData.length > 0 ) {
		ind = currentData.indexOf(IAC);
		if ( ind === -1 ) {
			enc = this.decode(currentData);
			this.handleInputText(enc[0]);
			this.inbuf.splice(1,0,enc[1]); // Should be this.inbuf.push(enc[1]) if it's leftover for next full processing
			break;
		}

		else if ( ind > 0 ) {
			enc = this.decode(currentData.substr(0,ind));
			this.handleInputText(enc[0]);
			// leftOverForNextIteration is data that comes before the IAC
			leftOverForNextIteration = enc[1];
			currentData = currentData.substr(ind);
		}

		// out is data after the IAC
		out = this.readIAC(currentData);
		if ( out === false ) {
			// Ensure old data goes to the very beginning.
			this.inbuf.splice(1,0,leftOverForNextIteration + currentData);  // Should be this.inbuf.unshift(...) or similar
			break;
		}
		currentData = leftOverForNextIteration + (out as string); // type assertion for out
		leftOverForNextIteration = ''; // Reset leftover if used

	}
}

/** Filters text (if a filter is installed) and sends it to the display
 *  handler. */
DecafMUD.prototype.handleInputText = function(this: IDecafMUD, text: string): void {

	if ( this.textInputFilter )
		text = this.textInputFilter.filterInputText(text);

	if ( this.display )
		this.display.handleData(text);
}

/** Read an IAC sequence from the supplied data. Then return either the remaining
 *  data, or if a full sequence can't be read, return false.
 * @param {String} data The data to read a sequence from.
 * @returns {String|boolean} False if we can't read a sequence, else the
 *    remaining data. */
DecafMUD.prototype.readIAC = function(this: IDecafMUD, data: string): string | boolean {
	if ( data.length < 2 ) { return false; }

	// If the second character is IAC, push an IAC to the display and return.
	else if ( data.charCodeAt(1) === 255 ) {
		if (this.display) this.display.handleData('\xFF'); // Added check
		return data.substr(2);
	}

	// If the second character is a GA or NOP, ignore it.
	else if ( data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241 ) {
		return data.substr(2);
	}

	// If the second character is one of WILL,WONT,DO,DONT, read it, debug,
	// and handle it.
	else if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) {
		if ( data.length < 3 ) { return false; }
		const seq = data.substr(0,3); // Changed var to const
		this.debugString('RCVD ' + (DecafMUD as any).debugIAC(seq));
		this.handleIACSimple(seq);
		return data.substr(3);
	}

	// If it's an IAC SB, read as much as we can to get it all.
	else if ( data.charAt(1) === t.SB ) {
		let sb_seq = '', l = t.IAC + t.SE; // Changed var to let
		const code = data.charAt(2); // Changed var to const
		let current_data = data.substr(3); // Changed var to let, renamed data to current_data
		if ( current_data.length === 0 ) { return false; }
		while(current_data.length > 0) {
			const ind = current_data.indexOf(l); // Changed var to const
			if ( ind === -1 ) { return false; } // Not enough data for IAC SE
			if ( ind > 0 && current_data.charAt(ind-1) === t.IAC ) {
				// Escaped IAC. Add it and the SE to seq, and continue.
				sb_seq += current_data.substring(0, ind -1) + t.IAC; // Add data up to IAC, then IAC itself
				current_data = current_data.substring(ind + 1); // Skip the escaped IAC
				continue;
			}

			sb_seq += current_data.substring(0,ind);
			current_data = current_data.substring(ind+l.length-1); // Adjusted to remove SE correctly (l.length-1 because SE starts with IAC)
			break;
		}
		data = current_data; // Assign back to data for return

		let dbg = true; // Changed var to let

		const teloptHandler = this.telopt[code];
		if ( teloptHandler && typeof teloptHandler !== 'boolean' && teloptHandler._sb ) {
			if ( teloptHandler._sb(sb_seq) === false ) { dbg = false; }
		}


		if ( dbg ) {
			// MSDP was refactored into a class, readMSDP is static on TeloptMSDP
			// The original readMSDP was global, this needs to be checked if it's still used elsewhere
			// For now, assuming TeloptMSDP.readMSDPData is the replacement if code is MSDP
			if ( code === t.MSSP && 'console' in window && console.groupCollapsed !== undefined ) {
				console.groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
				// console.dir(readMSDP(sb_seq)[0]); // readMSDP is not defined here
				console.dir(TeloptMSDP.readMSDPData(sb_seq)[0]); // Assuming this is the intended replacement
				console.groupEnd(); // Removed extra arguments from groupEnd
			} else {
				this.debugString('RCVD ' + (DecafMUD as any).debugIAC(t.IAC + t.SB + code + sb_seq + t.IAC + t.SE));
			}
		}
		return data; // Return remaining data
	}


	// Just push the IAC off the stack since it's obviously bad.
	return data.substr(1);
}

/** Send a telnet sequence, writing it to debug as well.
 * @param {String} seq The sequence to write out. */
DecafMUD.prototype.sendIAC = function(this: IDecafMUD, seq: string): void {
	this.debugString('SENT ' + (DecafMUD as any).debugIAC(seq));
	if ( this.socket ) { this.socket.write(seq); }
}

/** Handle a simple (DO/DONT/WILL/WONT) IAC sequence.
 * @param {String} seq The sequence to handle. */
DecafMUD.prototype.handleIACSimple = function(this: IDecafMUD, seq: string): void {
	const tn = (DecafMUD as any).TN; // Cache t
	const opt_char = seq.charAt(2);
	const handler = this.telopt[opt_char] as ITeloptHandler | boolean | undefined;


	// Ensure we actually have this option to deal with.
	if ( handler === undefined ) {
		if ( seq.charAt(1) === tn.DO ) {
			this.sendIAC(tn.IAC + tn.WONT + opt_char); }
		else if ( seq.charAt(1) === tn.WILL ) {
			this.sendIAC(tn.IAC + tn.DONT + opt_char); }
		return;
	}

	if (typeof handler === 'boolean') { // If it's just a boolean flag
		if (handler) { // If true (we support it)
			if (seq.charAt(1) === tn.DO) this.sendIAC(tn.IAC + tn.WILL + opt_char);
			else if (seq.charAt(1) === tn.WILL) this.sendIAC(tn.IAC + tn.DO + opt_char);
			else if (seq.charAt(1) === tn.DONT) this.sendIAC(tn.IAC + tn.WONT + opt_char);
			else if (seq.charAt(1) === tn.WONT) this.sendIAC(tn.IAC + tn.DONT + opt_char);
		} else { // If false (we don't support it)
			if (seq.charAt(1) === tn.DO) this.sendIAC(tn.IAC + tn.WONT + opt_char);
			else if (seq.charAt(1) === tn.WILL) this.sendIAC(tn.IAC + tn.DONT + opt_char);
		}
		return;
	}


	switch(seq.charAt(1)) {
		case tn.DO:
			if (!( handler._do && handler._do() === false )) {
				this.sendIAC(tn.IAC + tn.WILL + opt_char); }
			return;

		case tn.DONT:
			if (!( handler._dont && handler._dont() === false )) {
				this.sendIAC(tn.IAC + tn.WONT + opt_char); }
			return;

		case tn.WILL:
			if (!( handler._will && handler._will() === false )) {
				this.sendIAC(tn.IAC + tn.DO + opt_char); }
			return;

		case tn.WONT:
			if (!( handler._wont && handler._wont() === false )) {
				this.sendIAC(tn.IAC + tn.DONT + opt_char); }
			return;
	}
}

///////////////////////////////////////////////////////////////////////////////
// Basic Permissions
///////////////////////////////////////////////////////////////////////////////

/** Request permission for a given option, as stored in the global settings
 *  object at the given path. This will ask the user if they want to allow
 *  an action or not, provided they haven't given an answer in the past.
 *
 *  Since the user input may take some time, this will call the provided
 *  callback function with the result when the user makes a decision.
 *
 * @param {String} option The path to the option to check.
 * @param {String} prompt_message The question to show to the user, asking them if it's
 *    alright to do whatever it is you're doing.
 * @param {function} callback The function to call when we have an answer. */
DecafMUD.prototype.requestPermission = function(this: IDecafMUD, option: string, prompt_message: string, callback: (result: boolean) => void): void {
	const cur = this.store!.get(option); // Add non-null assertion if store is expected
	if ( cur !== undefined && cur !== null ) {
		callback.call(this, !!(cur));
		return; }

	const decafInstance = this; // Renamed decaf to avoid conflict
	const closer = function(e: Event) { // Typed e
			// Don't store a setting for next time, but return false for now.
			callback.call(decafInstance, false);
		},
		help_allow = function() {
			decafInstance.store!.set(option, true); // Add non-null assertion
			callback.call(decafInstance, true);
		},
		help_deny = function() {
			decafInstance.store!.set(option, false); // Add non-null assertion
			callback.call(decafInstance, false);
		};

	// First, check for infobars in the UI. That's preferred.
	if ( this.ui && this.ui.infoBar ) {
		this.ui.infoBar(prompt_message, 'permission', 0, undefined,
			[['Allow', help_allow], ['Deny', help_deny]], undefined, closer);
		return; }

}

///////////////////////////////////////////////////////////////////////////////
// Default Settings
///////////////////////////////////////////////////////////////////////////////
(DecafMUDInternal as any).settings = {
	// Absolute Basics
	'startup': {
		'_path': "/",
		'_desc': "Control what happens when DecafMUD is opened.",

		'autoconnect': {
			'_type': 'boolean',
			'_desc': 'Automatically connect to the server.'
		},

		'autoreconnect': {
			'_type': 'boolean',
			'_desc': 'Automatically reconnect when the connection is lost.'
		}
	},

	'appearance': {
		'_path': "display/",
		'_desc': "Control the appearance of the client.",

		'font': {
			'_type': 'font',
			'_desc': 'The font to display MUD output in.'
		}
	}
};

///////////////////////////////////////////////////////////////////////////////
// Default Options
///////////////////////////////////////////////////////////////////////////////
(DecafMUDInternal as any).options = {
	// Connection Basics
	host			: undefined, // undefined = Website's Host
	port			: 4000,
	autoconnect		: true,
	connectonsend	: true,
	autoreconnect	: true,
	connect_timeout : 5000,
	reconnect_delay	: 5000,
	reconnect_tries	: 3,

	// Plugins to use
	storage			: 'standard',
	display			: 'standard',
	encoding		: 'utf8',
	socket			: 'websocket',
	interface		: 'simple',
	textinputfilter		: '',

	// Loading Settings
	jslocation		: undefined, // undefined = This script's location
	wait_delay		: 25,
	wait_tries		: 1000,
	plugins			: [],

	// Storage Settings
	set_storage		: {
		// There are no settings. Yet.
	},

	// Display Settings
	set_display		: {
		handlecolor	: true,
		fgclass		: 'c',
		bgclass		: 'b',
		fntclass	: 'fnt',
		inputfg		: '-7',
		inputbg		: '-0'
	},

	// Socket Settings
	set_socket		: {
		// WebSocket Specific
		wsport		: undefined, // Undefined = Default port
		wspath		: '',
	},

	// Interface Settings
	set_interface	: {
		// Elements
		container	: undefined,

		// Fullscreen
		start_full	: false,

		// Input Specific
		mru			: true,
		mru_size	: 15,
		multiline	: true,
		clearonsend	: false,
		focusinput	: true,
		repeat_input    : true,
		blurclass	: 'mud-input-blur',

		msg_connect		: 'Press Enter to connect and type here...',
		msg_connecting	: 'DecafMUD is attempting to connect...',
		msg_empty		: 'Type commands here, or use the Up and Down arrows to browse your recently used commands.',

		connect_hint	: true
	},

	// Telnet Settings
	ttypes			: ['decafmud-'+DecafMUD.version,'decafmud','xterm','unknown'],
	environ			: {},
	encoding_order	: ['utf8'],

	// Plugin Settings
	plugin_order	: []
};

// Expose DecafMUD to the outside world
(window as any).DecafMUD = DecafMUDInternal as unknown as DecafMUDConstructor; // Cast to DecafMUDConstructor
})(window);
