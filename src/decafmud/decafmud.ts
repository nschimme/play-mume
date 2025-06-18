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
(DecafMUDInternal.plugins.Encoding as any).iso88591 = {
	proper : 'ISO-8859-1',
    /**
     * Decodes an ISO-8859-1 byte array to a JavaScript string.
     * @param {Uint8Array} data The byte array to decode.
     * @returns {[string, Uint8Array]} Tuple containing the decoded string and an empty Uint8Array for remaining data.
     */
	decode : function(data: Uint8Array): [string, Uint8Array] {
        let result = "";
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data[i]);
        }
        return [result, new Uint8Array()];
    },
    /**
     * Encodes a JavaScript string to an ISO-8859-1 byte array.
     * @param {string} data The string to encode. Characters outside the 0-255 range will be truncated.
     * @returns {Uint8Array} The resulting byte array.
     */
	encode : function(data: string): Uint8Array {
        const arr = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            arr[i] = data.charCodeAt(i) & 0xFF; // Ensure byte is within 0-255 range
        }
        return arr;
    }
};

/** This provides support for UTF-8 encoded data to DecafMUD, using built-in
 *  functions in a slightly hack-ish way to convert between UTF-8 and unicode.
 * @example
 * // let decoded = DecafMUD.plugins.Encoding.utf8.decode(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])); // "Hello"
 * @namespace DecafMUD Character Encoding: UTF-8 */
(DecafMUDInternal.plugins.Encoding as any).utf8 = {
	proper : 'UTF-8',

	/** Convert UTF-8 sequences to unicode characters.
     * @example
     * // DecafMUD.plugins.Encoding.utf8.decode(new Uint8Array([0xE2, 0x96, 0x93]));
     * // Becomes: ["\u2593", Uint8Array[]]
     * @param {Uint8Array} data The bytes to decode.
     * @returns {[string, Uint8Array]} Tuple containing the decoded string and an empty Uint8Array for remaining data.
     */
	decode : function(data: Uint8Array): [string, Uint8Array] {
        try {
            // NOTE: stream: true might be useful if data can be partial,
            // but for now, assume complete sequences or rely on replacement chars.
            const decodedString = new TextDecoder('utf-8', { fatal: false }).decode(data);
            return [decodedString, new Uint8Array()];
        } catch (e) {
            console.warn("DecafMUD UTF-8 decoding error:", e);
            // Fallback: return an empty string and the original data as 'remaining'
            // or try a lossy conversion if preferred. For now, empty string.
            return ["", data];
        }
    },

	/** Encode unicode characters into UTF-8 sequences.
     * @example
     * // DecafMUD.plugins.Encoding.utf8.encode("\u2593");
     * // Becomes: Uint8Array([0xE2, 0x96, 0x93])
     * @param {string} data The text to encode.
     * @returns {Uint8Array} The resulting byte array.
     */
	encode : function(data: string): Uint8Array {
        try {
            return new TextEncoder().encode(data);
        } catch (e) {
            console.warn("DecafMUD UTF-8 encoding error:", e);
            return new Uint8Array(); // Fallback to empty array on error
        }
    }
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
	IAC			: 0xFF, // 255
	DONT		: 0xFE, // 254
	DO			: 0xFD, // 253
	WONT		: 0xFC, // 252
	WILL		: 0xFB, // 251
	SB			: 0xFA, // 250
	SE			: 0xF0, // 240

	IS			: 0x00, // 0

	// END-OF-RECORD Marker / GO-AHEAD
	EORc		: 0xEF, // 239
	GA			: 0xF9, // 249

	// TELNET Options
	TRANSMIT_BINARY	: 0x00, // 0 - Corrected name
	ECHO			: 0x01, // 1
	SUPPRESS_GO_AHEAD: 0x03, // 3 - Corrected name
	STATUS			: 0x05, // 5
	SEND_LOCATION	: 0x17, // 23 - Corrected name (was SENDLOC)
	TTYPE			: 0x18, // 24
	END_OF_RECORD	: 0x19, // 25 - Corrected name (was EOR)
	NAWS			: 0x1F, // 31
	TERMINAL_SPEED	: 0x20, // 32 - Corrected name (was TSPEED)
	REMOTE_FLOW_CONTROL: 0x21, // 33 - Corrected name (was RFLOW)
	LINEMODE		: 0x22, // 34
	AUTHENTICATION	: 0x23, // 35 - Corrected name (was AUTH)
	NEW_ENVIRON		: 0x27, // 39 - Corrected name
	CHARSET			: 0x2A, // 42

	MSDP		: 0x45, // 69
	MSSP		: 0x46, // 70
	COMPRESS	: 0x55, // 85
	COMPRESS2	: 0x56, // 86 - Corrected name (was COMPRESSv2)
	MSP			: 0x5A, // 90
	MXP			: 0x5B, // 91
	ZMP			: 0x5D, // 93
	CONQUEST_PROPRIETARY: 0x5E, // 94 - Corrected name
	ATCP		: 0xC8, // 200
	GMCP		: 0xC9, // 201
};
const t = DecafMUDInternal.TN;

const iacToWord = function(char_code: number): string { // Parameter changed to number
	switch(char_code) { // Compare directly with number
		case t.IAC			: return 'IAC';
		case t.DONT			: return 'DONT';
		case t.DO			: return 'DO';
		case t.WONT			: return 'WONT';
		case t.WILL			: return 'WILL';
		case t.SB			: return 'SB';
		case t.SE			: return 'SE';

		case t.TRANSMIT_BINARY: return 'TRANSMIT-BINARY';
		case t.ECHO			: return 'ECHO';
		case t.SUPPRESS_GO_AHEAD: return 'SUPPRESS-GO-AHEAD';
		case t.STATUS		: return 'STATUS';
		case t.SEND_LOCATION: return 'SEND-LOCATION';
		case t.TTYPE		: return 'TERMINAL-TYPE';
		case t.END_OF_RECORD: return 'END-OF-RECORD';
		case t.NAWS			: return 'NEGOTIATE-ABOUT-WINDOW-SIZE';
		case t.TERMINAL_SPEED: return 'TERMINAL-SPEED';
		case t.REMOTE_FLOW_CONTROL: return 'REMOTE-FLOW-CONTROL';
		case t.AUTHENTICATION: return 'AUTHENTICATION';
		case t.LINEMODE		: return 'LINEMODE';
		case t.NEW_ENVIRON	: return 'NEW-ENVIRON';
		case t.CHARSET		: return 'CHARSET';

		case t.MSDP			: return 'MSDP';
		case t.MSSP			: return 'MSSP';
		case t.COMPRESS		: return 'COMPRESS';
		case t.COMPRESS2	: return 'COMPRESS2';
		case t.MSP			: return 'MSP';
		case t.MXP			: return 'MXP';
		case t.ZMP			: return 'ZMP';
		case t.CONQUEST_PROPRIETARY: return 'CONQUEST-PROPRIETARY';
		case t.ATCP			: return 'ATCP';
		case t.GMCP			: return 'GMCP';
	}
	// c = c.charCodeAt(0); // No longer needed
	if ( char_code > 15 ) { return char_code.toString(16); }
	else { return '0' + char_code.toString(16); }
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
		const char_val = seq.charAt(i); // Keep original char for string building
		const cc = seq.charCodeAt(i); // Use charCode for comparisons

		// TTYPE Sequence
		if ( state === 2 ) {
			if ( cc === t.ECHO ) { out += 'SEND '; } // Compare with number
			else if ( cc === t.IS ) { out += 'IS '; } // Compare with number
			else if ( cc === t.IAC ) { // Compare with number
				if ( st ) { st = false; out += '" IAC '; }
				else { out += 'IAC '; }
				state = 0;
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += char_val; // Use original char
			}
			continue;
		}

		// MSSP / MSDP Sequence
		else if ( state === 3 || state === 4 ) {
			if ( cc === t.IAC || (cc >= 1 && cc <= 4) ) { // Compare cc with t.IAC
				if ( st ) { st = false; out += '" '; }
				if ( cc === t.IAC ) { // Compare cc with t.IAC
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
				out += char_val; // Use original char
			}
			continue;
		}

		// NAWS Sequence
		else if ( state === 5 ) {
			if ( cc === t.IAC ) { // Compare cc with t.IAC
				st = false; out += 'IAC ';
				state = 0;
			} else {
				if ( st === false ) { st = cc * 255; } // cc is already number
				else {
					out += (cc + st).toString() + ' '; // cc is already number
					st = false;
				}
			}
			continue;
		}

		// CHARSET Sequence
		else if ( state === 6 ) {
			if ( cc === t.IAC || (cc > 0 && cc < 8) ) { // Compare cc with t.IAC
				if ( st ) { st = false; out += '" '; }
				if ( cc === t.IAC ) { // Compare cc with t.IAC
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
				out += char_val; // Use original char
			}
		}

		// ZMP Sequence
		else if ( state === 7 ) {
			if ( cc === t.IAC || cc === 0 ) { // Compare cc with t.IAC
				if ( st ) { st = false; out += '" '; }
				if ( cc === t.IAC ) { // Compare cc with t.IAC
					out += 'IAC ';
					state = 0; }
				else if ( cc === 0 ) { out += 'NUL '; }
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += char_val; // Use original char
			}
		}

		// Normal Sequence
		else if ( state < 2 ) {
			out += i2w(cc) + ' '; } // Pass charCode to i2w

		if ( state === 0 ) {
			if ( cc === t.SB ) { state = 1; } // Compare with number
		} else if ( state === 1 ) { // state for SB content type
			// Ensure all t.OPTIONs are numbers
			if ( cc === t.TTYPE || cc === t.TERMINAL_SPEED ) { state = 2; }
			else if ( cc === t.MSSP ) { state = 3; }
			else if ( cc === t.MSDP ) { state = 4; }
			else if ( cc === t.NAWS ) { state = 5; }
			else if ( cc === t.CHARSET ) { state = 6; }
			else if ( cc === t.SEND_LOCATION ) { state = 6; } // Assuming SEND_LOCATION is defined in t
			else if ( cc === t.GMCP ) { state = 6; }
			else if ( cc === t.ZMP ) { state = 7; }
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
        if (data.charCodeAt(0) !== t.ECHO) { return; } // data is string, t.ECHO is number
        this.current = (this.current + 1) % (this.decaf.options.ttypes?.length ?? 1);
        // For debugIAC and sendIAC, construct string from numbers if needed, or ensure they handle numbers
        const sbSequenceString = String.fromCharCode(t.IAC, t.SB, t.TTYPE, t.ECHO, t.IAC, t.SE);
        this.decaf.debugString('RCVD ' + DecafMUDInternal.debugIAC(sbSequenceString));
        const isSequenceString = String.fromCharCode(t.IAC, t.SB, t.TTYPE, t.IS) + (this.decaf.options.ttypes?.[this.current] ?? '') + String.fromCharCode(t.IAC, t.SE);
        this.decaf.sendIAC(isSequenceString);

        return false; // We print our own debug info.
    }
}
(DecafMUDInternal.plugins.Telopt as any)[t.TTYPE] = TeloptTTYPE;

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
(DecafMUDInternal.plugins.Telopt as any)[t.ECHO] = TeloptECHO;


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
        let naws_data = String.fromCharCode(Math.floor(sz[0] / 255));
        naws_data += String.fromCharCode(sz[0] % 255);
        naws_data += String.fromCharCode(Math.floor(sz[1] / 255));
        naws_data += String.fromCharCode(sz[1] % 255);
        const nawsSequence = String.fromCharCode(t.IAC, t.SB, t.NAWS) + naws_data.replace(/\xFF/g, '\xFF\xFF') + String.fromCharCode(t.IAC, t.SE);
        this.decaf.sendIAC(nawsSequence);
    }
}
(DecafMUDInternal.plugins.Telopt as any)[t.NAWS] = TeloptNAWS;


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
                DecafMUDInternal.plugins.Encoding[currentEncoding] !== undefined &&
                DecafMUDInternal.plugins.Encoding[currentEncoding].proper !== undefined) {
                cs.push(DecafMUDInternal.plugins.Encoding[currentEncoding].proper);
                done.push(currentEncoding);
            }

            // Add the encodings in the order we want.
            for (const encKey of this.decaf.options.encoding_order ?? []) {
                e_val = encKey;
                if (DecafMUDInternal.plugins.Encoding[e_val] === undefined ||
                    DecafMUDInternal.plugins.Encoding[e_val].proper === undefined ||
                    done.includes(e_val)) { continue; }
                cs.push(DecafMUDInternal.plugins.Encoding[e_val].proper);
                done.push(e_val);
            }

            // Add the rest now.
            for (const k in DecafMUDInternal.plugins.Encoding) {
                if (done.includes(k) || DecafMUDInternal.plugins.Encoding[k].proper === undefined) { continue; }
                cs.push(DecafMUDInternal.plugins.Encoding[k].proper);
            }
            const charsetEcho = String.fromCharCode(t.IAC, t.SB, t.CHARSET, t.ECHO) + ' ' + cs.join(' ') + String.fromCharCode(t.IAC, t.SE);
            this.decaf.sendIAC(charsetEcho);
        }, 0);
    }

    public _sb(data: string): false | void { // Return type based on original
        const initialChar = data.charCodeAt(0);
        const fullOriginalIAC = String.fromCharCode(t.IAC, t.SB, t.CHARSET) + data + String.fromCharCode(t.IAC, t.SE);
        this.decaf.debugString('RCVD ' + DecafMUDInternal.debugIAC(fullOriginalIAC));

        if (initialChar === 1) { // REQUEST  (assuming 1 is the number for REQUEST, not char '1')
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
                const encodingPlugin = DecafMUDInternal.plugins.Encoding[encKey];
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
                    for (const k in DecafMUDInternal.plugins.Encoding) {
                        if (reqCharset === k || reqCharset === DecafMUDInternal.plugins.Encoding[k].proper) {
                            chosenEncoding = k;
                            break;
                        }
                    }
                    if (chosenEncoding) { break; }
                }
            }

            if (chosenEncoding && originalCharsetName) {
                this.decaf.setEncoding(chosenEncoding);
                const charsetAccept = String.fromCharCode(t.IAC, t.SB, t.CHARSET, 0x02) + originalCharsetName + String.fromCharCode(t.IAC, t.SE);
                this.decaf.sendIAC(charsetAccept);
            } else {
                this.decaf.debugString("No encoder for: " + requestedCharsets.join(sep));
                const charsetReject = String.fromCharCode(t.IAC, t.SB, t.CHARSET, 0x03, t.IAC, t.SE);
                this.decaf.sendIAC(charsetReject);
            }
        } else if (initialChar === 2) { // ACCEPTED (assuming 2 is the number for ACCEPTED)
            const acceptedCharsetName = data.substr(1);
            let newEncoding: string | undefined;
            for (const k in DecafMUDInternal.plugins.Encoding) {
                if (DecafMUDInternal.plugins.Encoding[k].proper === acceptedCharsetName) {
                    newEncoding = k;
                    break;
                }
            }
            if (newEncoding) { this.decaf.setEncoding(newEncoding); }
        }
        return false; // We print our own debug.
    }
}
(DecafMUDInternal.plugins.Telopt as any)[t.CHARSET] = TeloptCHARSET;


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
        const compressSB = String.fromCharCode(t.IAC, t.SB, t.COMPRESS2, t.IAC, t.SE);
        this.decaf.debugString('RCVD ' + DecafMUDInternal.debugIAC(compressSB));
        this.decaf.pakoInflateStream = new pako.Inflate({ to: 'string' });
        this.decaf.isCompressionActive = true;
    }
}
(DecafMUDInternal.plugins.Telopt as any)[t.COMPRESSv2] = TeloptCompressV2;

DecafMUDInternal.prototype.disableMCCP2 = function(this: IDecafMUD): void {
	this.sendIAC(String.fromCharCode(t.IAC, t.DONT, t.COMPRESS2));
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
        'CLIENT_VERSION'	: DecafMUDInternal.version.toString(),
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
            this.decaf.sendIAC(String.fromCharCode(t.IAC, t.SB, t.MSDP) + '\x01LIST\x02COMMANDS' + String.fromCharCode(t.IAC, t.SE));
            this.decaf.sendIAC(String.fromCharCode(t.IAC, t.SB, t.MSDP) + '\x01LIST\x02VARIABLES' + String.fromCharCode(t.IAC, t.SE));
            this.decaf.sendIAC(String.fromCharCode(t.IAC, t.SB, t.MSDP) + '\x01LIST\x02CONFIGURABLE_VARIABLES' + String.fromCharCode(t.IAC, t.SE));
            this.decaf.sendIAC(String.fromCharCode(t.IAC, t.SB, t.MSDP) + '\x01LIST\x02REPORTABLE_VARIABLES' + String.fromCharCode(t.IAC, t.SE));
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
                if (TeloptMSDP.config_vars[o[i] as keyof typeof TeloptMSDP.config_vars] !== undefined) {
                    ot[o[i]] = TeloptMSDP.config_vars[o[i] as keyof typeof TeloptMSDP.config_vars];
                }
            }
            this.decaf.sendIAC(String.fromCharCode(t.IAC, t.SB, t.MSDP) + TeloptMSDP.writeMSDPData(ot) + String.fromCharCode(t.IAC, t.SE));
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
(DecafMUDInternal.plugins.Telopt as any)[t.MSDP] = TeloptMSDP;

/** We always transmit binary. What else would we transmit? */
(DecafMUDInternal.plugins.Telopt as any)[t.BINARY] = true;

/** Only use MSSP for debugging purposes. */
(DecafMUDInternal.plugins.Telopt as any)[t.MSSP] = 'console' in window;

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
DecafMUDInternal.prototype.debugString = function(this: IDecafMUD, text: string, type?: string, obj?: Record<string, any>): void {
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
DecafMUDInternal.prototype.error = function(this: IDecafMUD, text: string): void {
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
DecafMUDInternal.prototype.loadScript = function(this: IDecafMUD, filename: string, path?: string): void {
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
DecafMUDInternal.prototype.require = function(this: IDecafMUD, module_name: string, check?: () => boolean): void { // Renamed module to module_name
	let currentCheck = check;
	if ( currentCheck === undefined ) {
		// Build a checker
		if ( module_name.toLowerCase().indexOf('decafmud') === 0 ) {
			const parts = module_name.split('.');
			if ( parts.length < 2 ) { return; } // Already have DecafMUD, duh.
			parts.shift();
			parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);

			// If it's a telopt, search DecafMUDInternal.TN for it.
			if ( parts[0] === 'Telopt' ) {
				for(const k in (DecafMUDInternal as any).TN) { // Use (DecafMUDInternal as any)
					if ( parts[1].toUpperCase() === k.toUpperCase() ) {
						parts[1] = (DecafMUDInternal as any).TN[k]; // Use (DecafMUDInternal as any)
						break; }
				}
			}

			currentCheck = function() {
				if ( (DecafMUDInternal as any).plugins[parts[0]] !== undefined ) { // Use (DecafMUDInternal as any)
					if ( parts.length > 1 ) {
						return (DecafMUDInternal as any).plugins[parts[0]][parts[1]] !== undefined; // Use (DecafMUDInternal as any)
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
DecafMUDInternal.prototype.waitLoad = function(this: IDecafMUD, next: () => void, itemloaded?: (module_name: string, next_mod?: string, perc?: number) => void, tr?: number): void { // Renamed module to module_name
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
DecafMUDInternal.prototype.initSplash = function(this: IDecafMUD): void {
	// Create the UI if we're using one. Which we always should be.
	if ( this.options.interface !== undefined ) {
		this.debugString(`Attempting to initialize the interface plugin "${this.options.interface}".`);
		const InterfacePlugin = (DecafMUDInternal as any).plugins.Interface[this.options.interface];
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
DecafMUDInternal.prototype.updateSplash = function(this: IDecafMUD, module_name: string | boolean | null, next_mod?: string, perc?: number): void { // Renamed module to module_name
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
DecafMUDInternal.prototype.initSocket = function(this: IDecafMUD): void {
	this.extra = 1;
	// Create the master storage object.
	const StoragePlugin = (DecafMUDInternal as any).plugins.Storage[this.options.storage!]; // Added non-null assertion
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
	const SocketPlugin = (DecafMUDInternal as any).plugins.Socket[this.options.socket!]; // Added non-null assertion
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
DecafMUDInternal.prototype.initUI = function(this: IDecafMUD): void {
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
DecafMUDInternal.prototype.initFinal = function(this: IDecafMUD): void {
	let textInputFilterCtor: any, o: any;

	this.need.push('.');
	this.updateSplash(true,"Initializing triggers system...");
	this.need.shift();

	this.need.push('.');
	this.updateSplash(true,"Initializing TELNET extensions...");

	for(const k in (DecafMUDInternal as any).plugins.Telopt) {
		o = (DecafMUDInternal as any).plugins.Telopt[k];
		if ( typeof o === 'function' ) { // Check if it's a class constructor
			this.telopt[k] = new (o as any)(this);
		} else {
			this.telopt[k] = o; // This could be boolean or undefined
		}
	}

	this.need.push('.');
	this.updateSplash(true,"Initializing filters...");

	if (this.options.textinputfilter) {
		textInputFilterCtor = (DecafMUDInternal as any).plugins.TextInputFilter[this.options.textinputfilter];
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
DecafMUDInternal.prototype.connect = function(this: IDecafMUD): void {
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
DecafMUDInternal.prototype.connectFail = function(this: IDecafMUD): void {
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


DecafMUDInternal.prototype.reconnect = function(this: IDecafMUD): void {
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
DecafMUDInternal.prototype.socketReady = function(this: IDecafMUD): void {
	this.debugString("The socket is ready.");
	this.socket_ready = true;

	// If we've loaded, and autoconnect is on, try connecting.
	if ( this.loaded && this.options.autoconnect ) {
		this.connect();
	}
}

/** Called by the socket when the socket connects. */
DecafMUDInternal.prototype.socketConnected = function(this: IDecafMUD): void {
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
DecafMUDInternal.prototype.socketClosed = function(this: IDecafMUD): void {
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
DecafMUDInternal.prototype.socketData = function(this: IDecafMUD, data: string | Uint8Array): void {
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
DecafMUDInternal.prototype.socketError = function(this: IDecafMUD, data: string, data2?: string): void {
	this.debugString(`Socket Err: ${data}  d2="${data2}"`,'error');
}

///////////////////////////////////////////////////////////////////////////////
// Data Processing
///////////////////////////////////////////////////////////////////////////////

/** Get an internal incoder from a formatted name. */
DecafMUDInternal.prototype.getEnc = function(this: IDecafMUD, enc: string): string {
	enc = enc.replace(/-/g,'').toLowerCase();
	return enc;
}

/** Change the active encoding scheme to the provided scheme.
 * @param {String} enc The encoding scheme to use. */
DecafMUDInternal.prototype.setEncoding = function(this: IDecafMUD, enc: string): void {
	const new_enc = this.getEnc(enc); // Store result of getEnc

	const encodingPlugin = (DecafMUDInternal.plugins.Encoding as any)[new_enc]; // Ensure this is IEncoding
	if ( encodingPlugin === undefined ) {
		throw '"'+new_enc+"' isn't a valid encoding scheme, or it isn't loaded.";
	}


	this.debugString("Switching to character encoding: " + new_enc);
	this.options.encoding = new_enc;

	// Now, reroute functions for speed.
	this.decode = encodingPlugin.decode as (data: Uint8Array) => [string, Uint8Array];
	this.encode = encodingPlugin.encode as (data: string) => Uint8Array;
}

/** Send input to the MUD, as if typed by a player. This means it also goes out
 *  to the display and stuff. Escape any IAC bytes.
 * @param {String} input The input to send to the server. */
DecafMUDInternal.prototype.sendInput = function(this: IDecafMUD, input: string): void {
	if ( !this.socket || !this.socket.connected ) {
		this.debugString("Cannot send input: not connected");
		return;
	}

    // Step 1: Encode the string (e.g., to UTF-8 or ISO-8859-15)
    let encoded_data_uint8array = this.encode(input + '\r\n');

    // Step 2: Double IAC bytes in the resulting Uint8Array
    const finalBytes: number[] = [];
    for (let i = 0; i < encoded_data_uint8array.length; i++) {
        const byte = encoded_data_uint8array[i];
        finalBytes.push(byte);
        if (byte === 0xFF) { // IAC
            finalBytes.push(0xFF); // Double it
        }
    }
    const finalUint8Array = new Uint8Array(finalBytes);

	this.socket.write(finalUint8Array);

	if ( this.ui ) {
		this.ui.displayInput(input); }
}

/**
 * Decodes data using the currently selected encoding. This is a placeholder
 * that will be overwritten by `setEncoding`.
 * @param {Uint8Array} data The byte array to decode.
 * @returns {[string, Uint8Array]} Decoded string and remaining bytes.
 */
DecafMUDInternal.prototype.decode = function(this: IDecafMUD, data: Uint8Array): [string, Uint8Array] {
	const encodingPlugin = (DecafMUDInternal.plugins.Encoding as any)[this.options.encoding!];
    if (encodingPlugin) {
        return encodingPlugin.decode(data);
    }
    // Fallback: Should ideally not be reached if an encoding is always set.
    // Defaulting to UTF-8 for safety if this were ever called before setEncoding.
    const decodedString = new TextDecoder('utf-8', { fatal: false }).decode(data);
    return [decodedString, new Uint8Array()];
};

/**
 * Encodes data using the currently selected encoding. This is a placeholder
 * that will be overwritten by `setEncoding`.
 * @param {string} data The string to encode.
 * @returns {Uint8Array} Encoded byte array.
 */
DecafMUDInternal.prototype.encode = function(this: IDecafMUD, data: string): Uint8Array {
	const encodingPlugin = (DecafMUDInternal.plugins.Encoding as any)[this.options.encoding!];
    if (encodingPlugin) {
        return encodingPlugin.encode(data);
    }
    // Fallback: Should ideally not be reached.
    return new TextEncoder().encode(data);
};

/** Read through data, only stopping for TELNET sequences. Pass data through
 *  towards the display handler. */
DecafMUDInternal.prototype.processBuffer = function(this: IDecafMUD): void {
	let currentBuffer = new Uint8Array();

	for (const chunk of this.inbuf) {
		let chunkAsUint8: Uint8Array;
		if (typeof chunk === 'string') {
            // This path should be rare if socketData consistently provides Uint8Array
			chunkAsUint8 = Uint8Array.from(chunk, char => char.charCodeAt(0));
		} else {
			chunkAsUint8 = chunk;
		}
		const newBuffer = new Uint8Array(currentBuffer.length + chunkAsUint8.length);
		newBuffer.set(currentBuffer);
		newBuffer.set(chunkAsUint8, currentBuffer.length);
		currentBuffer = newBuffer;
	}
	this.inbuf = [];

	const IAC_BYTE = DecafMUDInternal.TN.IAC;
	let unprocessedData = new Uint8Array();

	while (currentBuffer.length > 0) {
		const iacIndex = currentBuffer.indexOf(IAC_BYTE);

		if (iacIndex === -1) {
			const [decodedText, remainingBytesAfterDecode] = this.decode(currentBuffer);
			this.handleInputText(decodedText);
			if (remainingBytesAfterDecode.length > 0) {
				unprocessedData = remainingBytesAfterDecode;
			}
			currentBuffer = new Uint8Array();
			break;
		}

		if (iacIndex > 0) {
			const dataBeforeIAC = currentBuffer.subarray(0, iacIndex);
			const [decodedText, remainingBytesAfterDecode] = this.decode(dataBeforeIAC);
			this.handleInputText(decodedText);
			if (remainingBytesAfterDecode.length > 0) {
                 const temp = currentBuffer.subarray(iacIndex);
                 currentBuffer = new Uint8Array(remainingBytesAfterDecode.length + temp.length);
                 currentBuffer.set(remainingBytesAfterDecode);
                 currentBuffer.set(temp, remainingBytesAfterDecode.length);
                 continue;
            }
            currentBuffer = currentBuffer.subarray(iacIndex); // Advance buffer to start of IAC
		} else {
            // IAC is at the beginning of currentBuffer
        }

		const iacProcessingResult = this.readIAC(currentBuffer);

		if (iacProcessingResult === false) {
			unprocessedData = currentBuffer;
			currentBuffer = new Uint8Array();
			break;
		} else {
            currentBuffer = iacProcessingResult; // readIAC returns the remaining Uint8Array
		}
	}

	if (unprocessedData.length > 0) {
		this.inbuf.push(unprocessedData);
	}
}

/** Filters text (if a filter is installed) and sends it to the display
 *  handler. */
DecafMUDInternal.prototype.handleInputText = function(this: IDecafMUD, text: string): void {

	if ( this.textInputFilter )
		text = this.textInputFilter.filterInputText(text);

	if ( this.display )
		this.display.handleData(text);
}

/** Read an IAC sequence from the supplied data. Then return either the remaining
 *  data, or if a full sequence can't be read, return false.
 * @param {Uint8Array} data The byte array to read an IAC sequence from.
 * @returns {Uint8Array|boolean} False if we can't read a complete sequence,
 *    otherwise the remaining data as a Uint8Array.
 */
DecafMUDInternal.prototype.readIAC = function(this: IDecafMUD, data: Uint8Array): Uint8Array | false {
	if ( data.length < 2 ) { return false; }

	const iac = DecafMUDInternal.TN.IAC; // Number
	const tn = DecafMUDInternal.TN;

	if ( data[0] !== iac ) { // Should always be IAC if called correctly
		return data.subarray(1); // Skip the erroneous byte
	}

	if ( data[1] === iac ) { // Escaped IAC: IAC IAC
		if (this.display) this.display.handleData(String.fromCharCode(iac));
		return data.subarray(2);
	}

	if ( data[1] === tn.GA || data[1] === tn.NOP ) {
		return data.subarray(2);
	}

	if ( [tn.WILL, tn.WONT, tn.DO, tn.DONT].includes(data[1]) ) {
		if ( data.length < 3 ) { return false; } // Not enough data for IAC CMD OPTION
		const action_code = data[1];
		const option_code = data[2];

        // For debugIAC, convert the sequence to a binary string
        const seqForDebug = String.fromCharCode(data[0], data[1], data[2]);
		this.debugString('RCVD ' + (DecafMUDInternal as any).debugIAC(seqForDebug));
		this.handleIACSimple(action_code, option_code);
		return data.subarray(3);
	}

	if ( data[1] === tn.SB ) {
		if (data.length < 4) return false; // Need IAC SB OPTION ...
        const option_code_sb = data[2];
        let sb_end_index = -1;

        // Find IAC SE
        for (let i = 3; i < data.length - 1; i++) {
            if (data[i] === tn.IAC && data[i+1] === tn.SE) {
                sb_end_index = i;
                break;
            }
        }

		if ( sb_end_index === -1 ) { return false; } // No IAC SE found

        const sb_data_uint8array = data.subarray(3, sb_end_index);
        // TEMPORARY: Convert Uint8Array to binary string for _sb, as ITeloptHandler._sb expects string
        let sb_data_string = "";
        for(let i=0; i < sb_data_uint8array.length; i++) {
            sb_data_string += String.fromCharCode(sb_data_uint8array[i]);
        }

		let dbg = true;
        // For debugIAC, convert the sequence to a binary string
        const full_sb_for_debug_array = data.subarray(0, sb_end_index + 2); // Include IAC SE
        let full_sb_for_debug_string = "";
        for(let i=0; i < full_sb_for_debug_array.length; i++) {
            full_sb_for_debug_string += String.fromCharCode(full_sb_for_debug_array[i]);
        }

		const teloptHandler = this.telopt[option_code_sb] as ITeloptHandler | boolean | undefined;
		if ( teloptHandler && typeof teloptHandler !== 'boolean' && teloptHandler._sb ) {
			if ( teloptHandler._sb(sb_data_string) === false ) { dbg = false; }
		}

		if ( dbg ) {
			if ( option_code_sb === tn.MSSP && 'console' in window && console.groupCollapsed !== undefined ) {
				console.groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
				console.dir(TeloptMSDP.readMSDPData(sb_data_string)[0]);
				console.groupEnd();
			} else {
				this.debugString('RCVD ' + (DecafMUDInternal as any).debugIAC(full_sb_for_debug_string));
			}
		}
		return data.subarray(sb_end_index + 2); // Remaining data after IAC SE
	}

	// Unknown IAC sequence, just skip the IAC byte itself.
	return data.subarray(1);
}

/** Send a telnet sequence, writing it to debug as well.
 * @param {Uint8Array} seq The byte sequence to write out.
 */
DecafMUDInternal.prototype.sendIAC = function(this: IDecafMUD, seq: Uint8Array): void {
    let seqStringForDebug = "";
    for(let i=0; i<seq.length; i++) seqStringForDebug += String.fromCharCode(seq[i]);
	this.debugString('SENT ' + (DecafMUDInternal as any).debugIAC(seqStringForDebug));
	if ( this.socket ) { this.socket.write(seq); }
}

/** Handle a simple (DO/DONT/WILL/WONT) IAC sequence.
 * @param {number} action_code The numeric IAC command (e.g., `t.DO`, `t.WILL`).
 * @param {number} option_code The numeric Telnet option code (e.g., `t.TTYPE`).
 */
DecafMUDInternal.prototype.handleIACSimple = function(this: IDecafMUD, action_code: number, option_code: number): void {
	const tn = (DecafMUDInternal as any).TN;
	const handler = this.telopt[option_code] as ITeloptHandler | boolean | undefined;

	if ( handler === undefined ) {
		if ( action_code === tn.DO ) {
			this.sendIAC(new Uint8Array([tn.IAC, tn.WONT, option_code])); }
		else if ( action_code === tn.WILL ) {
			this.sendIAC(new Uint8Array([tn.IAC, tn.DONT, option_code])); }
		return;
	}

	if (typeof handler === 'boolean') {
		if (handler) { // If true (we support it)
			if (action_code === tn.DO) this.sendIAC(new Uint8Array([tn.IAC, tn.WILL, option_code]));
			else if (action_code === tn.WILL) this.sendIAC(new Uint8Array([tn.IAC, tn.DO, option_code]));
			else if (action_code === tn.DONT) this.sendIAC(new Uint8Array([tn.IAC, tn.WONT, option_code])); // Should respond WONT if asked DONT and we agree
			else if (action_code === tn.WONT) this.sendIAC(new Uint8Array([tn.IAC, tn.DONT, option_code])); // Should respond DONT if asked WONT and we agree
		} else { // If false (we don't support it)
			if (action_code === tn.DO) this.sendIAC(new Uint8Array([tn.IAC, tn.WONT, option_code]));
			else if (action_code === tn.WILL) this.sendIAC(new Uint8Array([tn.IAC, tn.DONT, option_code]));
			// No explicit response needed for DONT/WONT if we already don't support/aren't doing it.
		}
		return;
	}

	switch(action_code) {
		case tn.DO:
			if (!( handler._do && handler._do(String.fromCharCode(option_code)) === false )) { // _do still expects string
				this.sendIAC(new Uint8Array([tn.IAC, tn.WILL, option_code])); }
			return;

		case tn.DONT:
			if (!( handler._dont && handler._dont(String.fromCharCode(option_code)) === false )) { // _dont still expects string
				this.sendIAC(new Uint8Array([tn.IAC, tn.WONT, option_code])); }
			return;

		case tn.WILL:
			if (!( handler._will && handler._will(String.fromCharCode(option_code)) === false )) { // _will still expects string
				this.sendIAC(new Uint8Array([tn.IAC, tn.DO, option_code])); }
			return;

		case tn.WONT:
			if (!( handler._wont && handler._wont(String.fromCharCode(option_code)) === false )) { // _wont still expects string
				this.sendIAC(new Uint8Array([tn.IAC, tn.DONT, option_code])); }
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
DecafMUDInternal.prototype.requestPermission = function(this: IDecafMUD, option: string, prompt_message: string, callback: (result: boolean) => void): void {
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
    host            : undefined, // undefined = Website's Host
    port            : 4000,
    autoconnect     : true,
    connectonsend   : true,
    autoreconnect   : true,
    connect_timeout : 5000,
    reconnect_delay : 5000,
    reconnect_tries : 3,

    // Plugins to use
    storage         : 'standard',
    display         : 'standard',
    encoding        : 'utf8',
    socket          : 'websocket',
    interface       : 'simple',
    textinputfilter : '',

    // Loading Settings
    jslocation      : undefined, // undefined = This script's location
    wait_delay      : 25,
    wait_tries      : 1000,
    plugins         : [],

    // Storage Settings
    set_storage     : {},

    // Display Settings
    set_display     : {
        handlecolor : true,
        fgclass     : 'c',
        bgclass     : 'b',
        fntclass    : 'fnt',
        inputfg     : '-7',
        inputbg     : '-0'
    },

    // Socket Settings
    set_socket      : {
        wsport      : undefined, // Undefined = Default port
        wspath      : '',
        ssl         : false // Added based on type definition
    },

    // Interface Settings
    set_interface   : {
        container   : undefined,
        start_full  : false,
        mru         : true,
        mru_size    : 15,
        multiline   : true,
        clearonsend : false,
        focusinput  : true,
        repeat_input: true,
        blurclass   : 'mud-input-blur',
        msg_connect     : 'Press Enter to connect and type here...',
        msg_connecting  : 'DecafMUD is attempting to connect...',
        msg_empty       : 'Type commands here, or use the Up and Down arrows to browse your recently used commands.',
        connect_hint    : true
    },

    // Telnet Settings
    ttypes          : ['decafmud-' + DecafMUDInternal.version.toString(),'decafmud','xterm','unknown'],
    environ         : {},
    encoding_order  : ['utf8'],

    // Plugin Settings
    plugin_order    : []
}; // Ensuring semicolon termination

// Expose DecafMUD to the outside world
(window as any).DecafMUD = DecafMUDInternal as unknown as DecafMUDConstructor; // Cast to DecafMUDConstructor
})(window);

[end of src/decafmud/decafmud.ts]

[end of src/decafmud/decafmud.ts]

[end of src/decafmud/decafmud.ts]
