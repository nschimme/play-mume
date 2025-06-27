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
import * as pako from 'pako';
import { GmcpTelopt } from './plugins/telopt/gmcp';
import { StandardDisplay } from './plugins/display/standard';
import { WebSocketSocket } from './plugins/socket/websocket';

// Simple string formatting utility to replace {key} or {0} placeholders
function formatString(text: string, ...args: any[]): string {
	let s = text;
	if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
		const obj = args[0];
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				s = s.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
			}
		}
	} else {
		for (let i = 0; i < args.length; i++) {
			s = s.replace(new RegExp(`{${i}}`, 'g'), args[i]);
		}
	}
	return s;
}

// Create a function for extending Objects
const extend_obj = function(base: any, obj: any): any {
	for ( var key in obj ) {
		var o = obj[key];
		if ( typeof o === 'object' && !('nodeType' in o) ) {
			if ( o.push !== undefined ) {
				if ( base[key] === undefined ) { base[key] = []; }
				for(var i=0; i<o.length; i++) {
					base[key].push(o[i]);
				}
			} else {
				if ( base[key] === undefined ) { base[key] = {}; }
				if ( typeof base[key] === 'object' ) {
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
 * @param {Object} options Configuration settings for setting up DecafMUD.
 */
class DecafMUD {
    // Instance properties - types will be added progressively
    public id: number; // Changed from any
    public options: any;
    public settings: any;
    public need: [string, () => boolean][]; // More specific type
    public inbuf: (string | ArrayBuffer | Uint8Array)[]; // More specific type
    public telopt: any;
    public loaded: boolean;
    public connecting: boolean;
    public connected: boolean;
    public loadTimer: any; // Consider NodeJS.Timeout or number
    public timer: any;     // Consider NodeJS.Timeout or number
    public connect_try: number;
    public required: number;
    public ui: any; // Define specific UI interface later
    public store: any; // Define specific Storage interface later
    public storage: any; // Alias for store
    public socket: any; // Define specific Socket interface later
    public display: any; // Define specific Display interface later
    public textInputFilter: any; // Define specific Filter interface later
    public decompressStream: pako.Inflate | undefined;
    public startCompressV2: boolean;
    public socket_ready: boolean;
    public conn_timer: any; // Consider NodeJS.Timeout or number
    public extra: number;
    public loaded_plugs: any;
    public cconnect_try: number; // from original, might be a typo for connect_try, assuming it is connect_try

    // Static properties
    static instances: DecafMUD[] = [];
    static last_id: number = -1;
    static version: any = { // Will be properly initialized below
        major: 0, minor: 0, micro: 0, flag: '', toString: () => ''
    };
    static options: any = {}; // Will be properly initialized below
    static settings: any = {}; // Will be properly initialized below
    static TN: any = {}; // Will be properly initialized below

    // Typed Plugin Structure
    static plugins: DecafPlugins; // Definition and initialization below

    static ESC: string = ""; // Will be properly initialized below
    static BEL: string = ""; // Will be properly initialized below
    static debugIAC: (seq: string) => string;


    constructor(options?: any) {
        this.options = {};
        extend_obj(this.options, DecafMUD.options); // Access static options directly

        if (options !== undefined) {
            if (typeof options !== 'object' || options === null) { throw new Error("The DecafMUD options argument must be an object!"); }
            extend_obj(this.options, options);
        }

        this.settings = {};
        extend_obj(this.settings, DecafMUD.settings); // Access static settings

        this.need = [];
        this.inbuf = [];
        this.telopt = {};

        this.id = (++DecafMUD.last_id);
        DecafMUD.instances.push(this);

        // Initialize other instance properties
        this.loaded = false;
        this.connecting = false;
        this.connected = false;
        this.loadTimer = null;
        this.timer = null;
        this.connect_try = 0;
        this.cconnect_try = 0; // Assuming this was intended and is same as connect_try for now
        this.required = 0;
        this.startCompressV2 = false;
        this.socket_ready = false;
        this.conn_timer = null;
        this.extra = 0;
        this.loaded_plugs = {};

        this.debugString('Created new instance.', 'info');

        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.id}] Provided Options`);
            console.dir(this.options);
            console.groupEnd();
        }

        this.require('decafmud.interface.' + this.options.interface);
        this.waitLoad(this.initSplash.bind(this)); // Bind this for all callbacks
    }

    // Placeholder for prototype methods that will be moved in later
    initSplash!: () => void;
    debugString!: (text: string, type?: string, obj?: any) => void;
    require!: (moduleName: string, check?: () => boolean) => void;
    waitLoad!: (next: () => void, itemloaded?: (module: string | true, next_mod?: string, perc?: number) => void, tr?: number) => void;
    setEncoding!: (enc: string) => void;
    decode!: (data: string) => [string, string];
    encode!: (data: string) => string;
    disableMCCP2!: () => void;
    readIAC!: (data: string) => string | false;
    handleIACSimple!: (seq: string) => void;
    sendIAC!: (seq: string) => void;
    getEnc!: (enc: string) => string;
    processBuffer!: () => void;
    handleInputText!: (text: string) => void;
    connect!: () => void;
    connectFail!: () => void;
    reconnect!: () => void;
    socketReady!: () => void;
    socketConnected!: () => void;
    socketClosed!: () => void;
    socketData!: (data: string | ArrayBuffer | Uint8Array) => void;
    socketError!: (data: any, data2: any) => void;
    sendInput!: (input: string) => void;
    error!: (text: string) => void;
    loadScript!: (filename: string, path?: string) => void;
    updateSplash!: (module: string | true | null, next_mod?: string, perc?: number) => void;
    initSocket!: () => void;
    initUI!: () => void;
    initFinal!: () => void;
    about!: () => void;
    requestPermission!: (option: string, prompt: string, callback: (allowed: boolean) => void) => void;
}

// Instance Information - These are now static properties of the DecafMUD class
/** <p>An array with references to all the created instances of DecafMUD.</p>
 *  <p>Generally, each DecafMUD's id is the instance's index in
 *  this array.</p>
 * @type DecafMUD[] */
// Define PluginConstructor and DecafPlugins interfaces
interface PluginConstructor {
    new (decaf: DecafMUD, ...args: any[]): any;
}

interface TeloptPluginConstructor {
    new (decaf: DecafMUD): {
        _will?: () => boolean | void;
        _wont?: () => boolean | void;
        _do?: () => boolean | void;
        _dont?: () => boolean | void;
        _sb?: (data: string) => boolean | void;
        connect?: () => void;
        disconnect?: () => void;
        [key: string]: any; // Allow other methods/properties
    };
}

interface EncodingPlugin {
    proper: string;
    decode: (data: string) => [string, string];
    encode: (data: string) => string;
    [key: string]: any;
}

interface DecafPlugins {
    Display: { [key: string]: PluginConstructor };
    Socket: { [key: string]: PluginConstructor };
    Interface: { [key: string]: PluginConstructor };
    Storage: { [key:string]: PluginConstructor };
    Telopt: { [key: string]: TeloptPluginConstructor | boolean | undefined };
    Encoding: { [key: string]: EncodingPlugin };
    Extra: { [key: string]: PluginConstructor };
    TextInputFilter?: { [key: string]: PluginConstructor };
}

// Initialize static properties that were previously set outside or with `(DecafMUD as any)`
DecafMUD.version = {
    major: 0, minor: 10, micro: 0, flag: 'beta',
    toString: function() { return this.major + '.' + this.minor + '.' + this.micro + (this.flag ? '-' + this.flag : ''); }
};

DecafMUD.ESC = "\x1B";
DecafMUD.BEL = "\x07";

DecafMUD.TN = {
    IAC: "\xFF", DONT: "\xFE", DO: "\xFD", WONT: "\xFC", WILL: "\xFB", SB: "\xFA", SE: "\xF0",
    IS: "\x00", EORc: "\xEF", GA: "\xF9", BINARY: "\x00", ECHO: "\x01", SUPGA: "\x03",
    STATUS: "\x05", SENDLOC: "\x17", TTYPE: "\x18", EOR: "\x19", NAWS: "\x1F", TSPEED: "\x20",
    RFLOW: "\x21", LINEMODE: "\x22", AUTH: "\x23", NEWENV: "\x27", CHARSET: "\x2A",
    MSDP: "E", MSSP: "F", COMPRESS: "U", COMPRESSv2: "V", MSP: "Z", MXP: "[", ZMP: "]",
    CONQUEST: "^", ATCP: "\xC8", GMCP: "\xC9"
};

// Keep the t alias for existing telopt handlers that might use it internally if they are not yet converted
var t = DecafMUD.TN;

DecafMUD.plugins = {
    Display: {},
    Encoding: {}, // Will be populated with iso88591 and utf8 below
    Extra: {},
    Interface: {},
    Socket: {},
    Storage: {},
    Telopt: {}, // Will be populated with converted and existing handlers below
    TextInputFilter: {}
};


// Default Values (These were on DecafMUD.prototype, now handled by class field initializers or constructor)
// DecafMUD.prototype.loaded		= false;
// DecafMUD.prototype.connecting	= false;
// DecafMUD.prototype.connected	= false;
// DecafMUD.prototype.loadTimer	= null;
// DecafMUD.prototype.timer		= null;
// DecafMUD.prototype.connect_try	= 0;
// DecafMUD.prototype.required		= 0;


// The old (DecafMUD as any).instances and last_id are handled by static class fields.

/** DecafMUD's version. This can be used to check plugin compatability.
 * @example
 * if ( DecafMUD.version.major >= 1 ) {
 *   // Some Code Here
 * }
 * @example
 * alert("You're using DecafMUD v" + DecafMUD.version.toString() + "!");
 * // You're using DecafMUD v0.9.0alpha!
 * @type Object */
(DecafMUD as any).version = {major: 0, minor: 10, micro: 0, flag: 'beta',
	toString: function(){ return this.major+'.'+this.minor+'.'+this.micro+( this.flag ? '-' + this.flag : ''); } };

// Default Values
DecafMUD.prototype.loaded		= false;
DecafMUD.prototype.connecting	= false;
DecafMUD.prototype.connected	= false;

DecafMUD.prototype.loadTimer	= null;
DecafMUD.prototype.timer		= null;
DecafMUD.prototype.connect_try	= 0;
DecafMUD.prototype.required		= 0;

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
(DecafMUD as any).plugins = {
	/** These plugins provide support for MUD output.
	 * @type Object */
	Display		: {},

	/** These plugins provide support for different text encodings.
	 * @type Object */
	Encoding	: {},

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
	Telopt		: {},

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
(DecafMUD as any).plugins.Encoding.iso88591 = {
	proper : 'ISO-8859-1',

	/** Convert iso-8859-1 encoded text to unicode, by doing nothing.
	 * @example
	 * DecafMUD.plugins.Encoding.iso88591.decode("\xE2\x96\x93");
	 * // Becomes: "\xE2\x96\x93"
	 * @param {String} data The text to decode. */
	decode : function(data: string) { return [data,'']; }, // Added type
	/** Convert unicode characters to iso-8859-1 encoded text, by doing
	 *  nothing. Should probably add some sanity checks in later, but I
	 *  don't really care for now.
	 * @example
	 * DecafMUD.plugins.Encoding.iso88591.encode("\xE2\x96\x93");
	 * // Becomes: "\xE2\x96\x93"
	 * @param {String} data The text to encode. */
	encode : function(data: string) { return data; } // Added type
};

/** This provides support for UTF-8 encoded data to DecafMUD, using built-in
 *  functions in a slightly hack-ish way to convert between UTF-8 and unicode.
 * @example
 * alert(DecafMUD.plugins.Encoding.utf8.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: UTF-8 */
(DecafMUD as any).plugins.Encoding.utf8 = {
	proper : 'UTF-8',

	/** Convert UTF-8 sequences to unicode characters.
	 * @example
	 * DecafMUD.plugins.Encoding.utf8.decode("\xE2\x96\x93");
	 * // Becomes: "\u2593"
	 * @param {String} data The text to decode. */
	decode : function(data: string) { // Added type
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			// Decode manually so we can catch what's left.
			var out = '', i=0, l=data.length,
				c = 0, c2 = 0, c3 = 0, c4 = 0; // Declared c, c2, c3, c4
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) {
					// Normal Character
					out += String.fromCharCode(c); }

				else if ( (c > 0xBF) && (c < 0xE0) ) {
					// Two-Byte Sequence
					if ( i+1 > l ) { break; } // Check against l directly
					out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }

				else if ( (c > 0xDF) && (c < 0xF0) ) {
					// Three-Byte Sequence
					if ( i+2 > l ) { break; } // Check against l directly
					out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }

				else if ( (c > 0xEF) && (c < 0xF5) ) {
					// Four-Byte Sequence
                    if ( i+3 > l ) { break; } // Check against l directly
                    // Corrected bitwise operations for 4-byte sequences
                    let charCode = ((c & 7) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63);
                    if (charCode > 0xFFFF) { // Handle supplementary characters
                        charCode -= 0x10000;
                        out += String.fromCharCode(0xD800 + (charCode >> 10), 0xDC00 + (charCode & 0x3FF));
                    } else {
                        out += String.fromCharCode(charCode);
                    }
				} else {
					// Bad Character.
					out += String.fromCharCode(0xFFFD); } // Replacement char
			}
			return [out, data.substr(i)];
		} },

	/** Encode unicode characters into UTF-8 sequences.
	 * @example
	 * DecafMUD.plugins.Encoding.utf8.encode("\u2593");
	 * // Becomes: "\xE2\x96\x93"
	 * @param {String} data The text to encode. */
	encode : function(data: string) { // Added type
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) {
			console.dir(err); return data; } }
};

/** The variable storing instances of plugins is called loaded_plugs to avoid
 *  any unnecessary confusion created by {@link DecafMUD.plugins}.
 * @type Object */
DecafMUD.prototype.loaded_plugs = {};

// Create a function for class inheritence
const inherit = function(subclass: any, superclass: any) { // Changed var to const
	var f: any = function() {}; // Added type for f
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
(DecafMUD as any).ESC = "\x1B";
(DecafMUD as any).BEL = "\x07";

// TELNET Constants
(DecafMUD as any).TN = {
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
var t = (DecafMUD as any).TN; // Keep t for now, for minimal changes to telopt handlers

const iacToWord = function(c: string) { // Changed var to const, added type
	var t = (DecafMUD as any).TN; // Ensure t references the class static TN
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
	let code = c.charCodeAt(0); // Use let
	if ( code > 15 ) { return code.toString(16); }
	else { return '0' + code.toString(16); }
}

/** Convert a telnet IAC sequence from raw bytes to a human readable format that
 *  can be output for debugging purposes.
 * @example
 * var IAC = "\xFF", DO = "\xFD", TTYPE = "\x18";
 * DecafMUD.debugIAC(IAC + DO + TTYPE);
 * // Returns: "IAC DO TERMINAL-TYPE"
 * @param {String} seq The sequence to convert.
 * @returns {String} The human readable description of the IAC sequence. */
(DecafMUD as any).debugIAC = function(seq: string) { // Added type
	var out = '', t = (DecafMUD as any).TN, state = 0, st: any = false, l = seq.length, // st can be boolean or number
		i2w = iacToWord;

	for( var i = 0; i < l; i++ ) {
		var c = seq.charAt(i),
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
var tTTYPE = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.current = -1; }
tTTYPE.prototype._dont = tTTYPE.prototype.disconnect = function() { this.current = -1; }
tTTYPE.prototype._sb = function(data: string) {
	if ( data !== (DecafMUD as any).TN.ECHO ) { return; }
	this.current = (this.current + 1) % this.decaf.options.ttypes.length;
	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.TTYPE + (DecafMUD as any).TN.ECHO + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE));
	this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.TTYPE + (DecafMUD as any).TN.IS + this.decaf.options.ttypes[this.current] + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);

	return false;
}
// DecafMUD.plugins.Telopt[t.TTYPE] = tTTYPE; // This will be handled after class definition

/** Handles the telopt ECHO. */
var tECHO = function(this: any, decaf: DecafMUD) { this.decaf = decaf; }
tECHO.prototype._will = function() {
	if ( this.decaf.ui ) { this.decaf.ui.localEcho(false); } }
tECHO.prototype._wont = tECHO.prototype.disconnect = function() {
	if ( this.decaf.ui ) { this.decaf.ui.localEcho(true); } }
// DecafMUD.plugins.Telopt[t.ECHO] = tECHO;


/** Handles the telopt NAWS. */
var tNAWS = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.enabled = false; this.last = undefined; }
tNAWS.prototype._do = function() { this.last = undefined; this.enabled = true;
	var n=this; setTimeout(function(){n.send();},0); }
tNAWS.prototype._dont = tNAWS.prototype.disconnect = function() { this.enabled = false; }
tNAWS.prototype.send = function() {
	if ((!this.decaf.display) || (!this.enabled)) { return; }
	var sz = this.decaf.display.getSize();
	if ( this.last !== undefined && this.last[0] == sz[0] && this.last[1] == sz[1] ) { return; }
	this.last = sz;
	var data = String.fromCharCode(Math.floor(sz[0] / 255));
	data += String.fromCharCode(sz[0] % 255);
	data += String.fromCharCode(Math.floor(sz[1] / 255));
	data += String.fromCharCode(sz[1] % 255);
	data = (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.NAWS + data.replace(/\xFF/g,'\xFF\xFF') + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE;
	this.decaf.sendIAC(data);
}
// DecafMUD.plugins.Telopt[t.NAWS] = tNAWS;


/** Handles the telopt CHARSET. */
var tCHARSET = function(this: any, decaf: DecafMUD) { this.decaf = decaf; }
tCHARSET.prototype._dont = function() { return false; }
tCHARSET.prototype._will = function() { var c = this; setTimeout(function() {
	var cs: string[] = [], done: string[] = [];
	var enc = c.decaf.options.encoding;
	if ( enc !== 'iso88591' && (DecafMUD as any).plugins.Encoding[enc] !== undefined && (DecafMUD as any).plugins.Encoding[enc].proper !== undefined ) {
		cs.push((DecafMUD as any).plugins.Encoding[enc].proper);
		done.push(enc);
	}
	for(var i=0;i< c.decaf.options.encoding_order.length;i++) {
		var currentEnc = c.decaf.options.encoding_order[i];
		if ( (DecafMUD as any).plugins.Encoding[currentEnc] === undefined || (DecafMUD as any).plugins.Encoding[currentEnc].proper === undefined || done.indexOf(currentEnc) !== -1 ) { continue; }
		cs.push((DecafMUD as any).plugins.Encoding[currentEnc].proper);
		done.push(currentEnc);
	}
	for(var k in (DecafMUD as any).plugins.Encoding) {
        if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
		    if ( done.indexOf(k) !== -1 || (DecafMUD as any).plugins.Encoding[k].proper === undefined ) { continue; }
		    cs.push((DecafMUD as any).plugins.Encoding[k].proper);
        }
	}
	c.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + (DecafMUD as any).TN.ECHO + ' ' + cs.join(' ') + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
},0); }
tCHARSET.prototype._sb = function(data: string) {
	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + data + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE));
	if ( data.charCodeAt(0) === 1 ) {
		let dataStr = data.substring(1);
		if ( dataStr.indexOf('TTABLE ') === 0 ) {
			dataStr = dataStr.substring(8); }
		var sep = dataStr.charAt(0);
		var encodings = dataStr.substring(1).split(sep);
		var e: string | undefined, o: string | undefined;
		for (var currentEncOrder of this.decaf.options.encoding_order) {
			let currentPluginEnc = (DecafMUD as any).plugins.Encoding[currentEncOrder];
			if (currentPluginEnc === undefined || currentPluginEnc.proper === undefined)
				continue;
			if (encodings.includes(currentEncOrder)) {
				o = currentEncOrder;
				e = currentEncOrder;
				break;
			}
			if (encodings.includes(currentPluginEnc.proper)) {
				o = currentPluginEnc.proper;
				e = currentEncOrder;
				break;
			}
		}
		if (e === undefined) {
			for(var i=0; i < encodings.length; i++) {
				o = encodings[i];
				for(var k in (DecafMUD as any).plugins.Encoding) {
                    if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
					    if ( o === k || o === (DecafMUD as any).plugins.Encoding[k].proper ) {
						    e = k;
						    break;
					    }
                    }
				}
				if ( e ) { break; }
			}
		}
		if ( e !== undefined ) {
			this.decaf.setEncoding(e);
			this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + '\x02' + o + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
		} else {
			this.decaf.debugString("No encoder for: " + encodings.join(sep));
			this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + '\x03' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
		}
	} else if ( data.charCodeAt(0) === 2 ) {
		let acceptedEnc = data.substring(1);
		var e: string | undefined = undefined;
		for(var k in (DecafMUD as any).plugins.Encoding) {
            if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
			    if ( (DecafMUD as any).plugins.Encoding[k].proper === acceptedEnc ) {
				    e = k;
				    break;
			    }
            }
		}
		if ( e !== undefined ) { this.decaf.setEncoding(e); }
	}
	return false;
}
// DecafMUD.plugins.Telopt[t.CHARSET] = tCHARSET;


/** Handles the telopt COMPRESSv2 (MCCP2) */
var tCOMPRESSv2 = function(this: any, decaf: DecafMUD) {  // Added this type
	// Thanks, https://mudhalla.net/tintin/protocols/mccp/
	this.decaf = decaf;
	this.decaf.startCompressV2 = false;
}
tCOMPRESSv2.prototype._will = function() {
	if (this.decaf.options.socket == 'flash') { // Flash support will be removed later
		this.decaf.debugString('Flash COMPRESSv2 support has not been implemented');
		return false;
	}
	return true;
}
tCOMPRESSv2.prototype._sb = function() {
	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.COMPRESSv2 + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE ));
	this.decaf.startCompressV2 = true;
	this.decaf.decompressStream = new pako.Inflate({ to: 'string' });
 }
// DecafMUD.plugins.Telopt[t.COMPRESSv2] = tCOMPRESSv2;

DecafMUD.prototype.disableMCCP2 = function() {
	this.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.DONT + (DecafMUD as any).TN.COMPRESSv2);
	this.startCompressV2 = false;
	this.decompressStream = undefined; // Ensures pako instance is cleared
	this.inbuf = [];
}

/** Read a string of MSDP-formatted variables and return an object with those
 *  variables in an easy-to-use format. This calls itself recursively, and
 *  returns an array. The first item being the object, and the second being
 *  any left over string.
 * @param {String} data The MSDP-formatted data to read.
 * @returns {Array} */
const msdp = /[\x01\x02\x03\x04]/; // Changed var to const
const readMSDP = function(data: string): [Record<string, any>, string] {
	var out: Record<string, any> = {};
	var variable: string | undefined = undefined;
	let currentData = data;

	while ( currentData.length > 0 ) {
		var c = currentData.charCodeAt(0);

		if ( c === 1 ) {
			var ind = currentData.substring(1).search(msdp);
			if ( ind === -1 ) {
				variable = currentData.substring(1);
				currentData = '';
			} else {
				variable = currentData.substring(1, ind + 1);
				currentData = currentData.substring(ind + 1 + 1);
			}
			out[variable] = undefined;
			continue;
		} else if ( c === 4 ) {
			currentData = currentData.substring(1);
			break;
		}

		if ( variable === undefined ) {
			return [out, ''];
		}

		if ( c === 2 ) {
			let val: any;
			if ( currentData.charCodeAt(1) === 3 ) {
				var o = readMSDP(currentData.substring(2));
				val = o[0];
				currentData = o[1];
			} else {
				var ind = currentData.substring(1).search(msdp), inner_val = '';
				if ( ind === -1 ) {
					inner_val = currentData.substring(1);
					currentData = '';
				} else {
					inner_val = currentData.substring(1, ind + 1);
					currentData = currentData.substring(ind + 1 + 1);
				}
				val = inner_val;
			}
			if ( out[variable] === undefined ) {
				out[variable] = val;
			} else if ( typeof out[variable] === 'object' && out[variable].push !== undefined ) {
				out[variable].push(val);
			} else {
				out[variable] = [out[variable], val];
			}
			continue;
		}
		break;
	}
	return [out, currentData];
};

/** Convert a variable to a string of valid MSDP-formatted data.
 * @param {any} obj The variable to convert. */
const writeMSDP = function(obj: any): string {
	var type = typeof obj;
	if ( type === 'string' || type === 'number' ) { return obj.toString(); }
	else if ( type === 'boolean' ) { return obj ? '1' : '0'; }
	else if ( type === 'undefined' || obj === null) { return ''; }

	else if ( type === 'object' ) {
		var out_str = '';
		for(var k in obj) {
			if (Object.hasOwnProperty.call(obj, k)) {
				if ( obj[k] === undefined || obj[k] === null || typeof obj[k] === 'function' ) { continue; }

				out_str += '\x01' + k;
				if ( typeof obj[k] === 'object' && obj[k] !== null) {
					if ( Array.isArray(obj[k]) ) {
						var v = obj[k], l = obj[k].length;
						for(var i=0;i<l;i++) {
							out_str += '\x02' + writeMSDP(v[i]); }
					} else if ( obj[k].nodeType === undefined ) {
						out_str += '\x02\x03' + writeMSDP(obj[k]) + '\x04';
					}
				} else {
					out_str += '\x02' + writeMSDP(obj[k]);
				}
			}
		}
		return out_str;
	}
	return obj.toString();
};

/** Handles the telopt MSDP. */
var tMSDP = function(this: any, decaf: DecafMUD) {
    this.decaf = decaf;
    this.commands = [];
    this.variables = [];
    this.reportable = [];
}
tMSDP.prototype.connect = function() {
	this.commands = ['LIST'];
	this.variables = [];
	this.reportable = [];
}
tMSDP.config_vars = {
	'CLIENT_NAME'		: 'decafmud',
	'CLIENT_VERSION'	: (DecafMUD as any).version.toString(), // Cast
	'PLUGIN_ID'			: '0',
	'ANSI_COLORS'		: '1',
	'UTF_8'				: '1',
	'XTERM_256_COLORS'	: '1'
}
tMSDP.prototype._will = function() { var m = this; setTimeout(function() {
	m.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.MSDP + '\x01LIST\x02COMMANDS' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
	m.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.MSDP + '\x01LIST\x02VARIABLES' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
	m.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.MSDP + '\x01LIST\x02CONFIGURABLE_VARIABLES' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
	m.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.MSDP + '\x01LIST\x02REPORTABLE_VARIABLES' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
},0); }
tMSDP.prototype._sb = function(data: string) {
	var [msdp_out, ] = readMSDP(data);
    var ret = false;
	if ( typeof window !== 'undefined' && 'console' in window && console.groupCollapsed ) {
		console.groupCollapsed(`DecafMUD[${this.decaf.id}]: RCVD IAC SB MSDP ... IAC SE`);
		console.dir(msdp_out);
		console.groupEnd();
	} else { ret = true; }
	if ( msdp_out['COMMANDS'] !== undefined && Array.isArray(msdp_out['COMMANDS']) ) {
		for(var i=0; i< msdp_out['COMMANDS'].length;i++) {
			(this.commands as string[]).push(msdp_out['COMMANDS'][i]); }
	}
	if ( msdp_out['VARIABLES'] !== undefined && Array.isArray(msdp_out['VARIABLES'])) {
		for(var i=0; i< msdp_out['VARIABLES'].length;i++) {
			(this.variables as string[]).push(msdp_out['VARIABLES'][i]); }
	}
	if ( msdp_out['CONFIGURABLE_VARIABLES'] !== undefined && Array.isArray(msdp_out['CONFIGURABLE_VARIABLES']) ) {
		var o = msdp_out['CONFIGURABLE_VARIABLES'];
		var ot: Record<string, string> = {};
		for(var i=0;i<o.length;i++) {
			if ( (tMSDP.config_vars as Record<string,string>)[o[i]] !== undefined ) {
				ot[o[i]] = (tMSDP.config_vars as Record<string,string>)[o[i]]; }
		}
		this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.MSDP + writeMSDP(ot) + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
	}
	return ret;
}
// DecafMUD.plugins.Telopt[t.MSDP] = tMSDP;

// DecafMUD.plugins.Telopt[t.BINARY] = true;
// DecafMUD.plugins.Telopt[t.MSSP] = typeof window !== 'undefined' && 'console' in window;

DecafMUD.prototype.about = function() {
	var abt = ["DecafMUD v{0} \u00A9 2010 Stendec"];

	abt.push("Updated and improved by Pit from Discworld.");
	abt.push("Further bugfixes and improvements by Waba from MUME.");
	abt.push("https://github.com/MUME/DecafMUD\n");

	abt.push("DecafMUD is a web-based MUD client written in JavaScript, rather" +
		" than a plugin like Flash or Java, making it load faster and react as" +
		" you'd expect a website to.\n");

	abt.push("It's easy to customize as well, using simple CSS and JavaScript," +
		" and free to use and modify, so long as your MU* is free to play!");

	// Show the about dialog with a simple alert.
	alert(formatString(abt.join('\n'), (DecafMUD as any).version.toString()));
}

///////////////////////////////////////////////////////////////////////////////
// Debugging
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.debugString = function(text: string, type?: string, obj?: any) { // Added types
	// Return if we don't have the console or a debug pane.
	if (typeof window === 'undefined' || !('console' in window) ) { return; }

	// Set the type to debug by default
	if ( type === undefined ) { type = 'debug'; }

	// Prepare the string.
	if ( obj !== undefined ) { text = formatString(text, obj); }

	// Firebug / Console Logging
	if (typeof window === 'undefined' || !('console' in window )) { return; }
	var st = 'DecafMUD[%d]: %s';
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

DecafMUD.prototype.error = function(text: string) { // Added type
	// Print to debug
	this.debugString(text, 'error');

	// If we have console grouping, log the options.
	if ( typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Instance State');
		console.dir(this);
		console.groupEnd();
	}

	// If we have a UI, try splashError.
	if ( this.ui && this.ui.splashError(text) ) { return; }

	// TODO: Check the Interface and stuff
	alert(formatString("DecafMUD Error\n\n{0}", text));
}

///////////////////////////////////////////////////////////////////////////////
// Module Loading
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.loadScript = function(filename: string, path?: string) {
	// This function will likely need to be re-evaluated with module imports.
	// For now, keep existing logic but add types.
	let scriptPath = path;
	if ( scriptPath === undefined ) {
		if ( this.options.jslocation !== undefined ) { scriptPath = this.options.jslocation; }
		if ( scriptPath === undefined || typeof scriptPath === 'string' && scriptPath.length === 0 ) {
			// Attempt to discover the path.
			var obj = document.querySelector('script[src*="decafmud.js"]');
			if ( obj === null ) {
				obj = document.querySelector('script[src*="decafmud.min.js"]'); }
			if ( obj !== null && obj instanceof HTMLScriptElement) {
				scriptPath = obj.src.substring(0,obj.src.lastIndexOf('/')+1); }
		}
	}

	// Now that we have a path, create a script element to load our script
	// and add it to the header so that it's loaded.
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = (scriptPath || '') + filename;
	document.getElementsByTagName('head')[0].appendChild(script);

	// Debug that we've loaded it.
	this.debugString('Loading script: ' + filename);
}

DecafMUD.prototype.require = function(moduleName: string, check?: () => boolean) {
	// Language loading part fully removed.

	let checker = check;
	if ( checker === undefined ) {
		// Build a checker
		if ( moduleName.toLowerCase().indexOf('decafmud') === 0 ) {
			var parts = moduleName.split('.');
			if ( parts.length < 2 ) { return; }
			parts.shift();
			parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);

			// If it's a telopt, search DecafMUD.TN for it.
			if ( parts[0] === 'Telopt' ) {
				for(var k in (DecafMUD as any).TN) { // Cast
					if ( parts[1].toUpperCase() === k.toUpperCase() ) {
						parts[1] = (DecafMUD as any).TN[k];
						break; }
				}
			}

			checker = function(this: DecafMUD) {
				if ( (DecafMUD as any).plugins[parts[0]] !== undefined ) {
					if ( parts.length > 1 ) {
						return (DecafMUD as any).plugins[parts[0]][parts[1]] !== undefined;
					} else { return true; }
				}
				return false;
			};
		} else {
			throw new Error("Can't build checker for non-DecafMUD module!");
		}
	}

	// Increment required.
	this.required++;

	// Call the checker. If we already have it, return now.
	if ( checker.call(this) ) { return; }

	// Load the script.
	this.loadScript(moduleName+'.js');

	// Finally, push to need for waitLoad to work.
	this.need.push([moduleName,checker]);
}

DecafMUD.prototype.waitLoad = function(next: () => void, itemloaded?: (module: string | true, next_mod?: string, perc?: number) => void, tr?: number) {
	clearTimeout(this.loadTimer);
	let tries = tr === undefined ? 0 : tr;

	if ( tries > this.options.wait_tries ) {
		// Language timeout check removed
		this.error(formatString("Timed out attempting to load the module: {0}", (this.need[0] as any[])[0]));
		return;
	}

	while( this.need.length ) {
		if ( typeof this.need[0] === 'string' ) {
			this.need.shift();
		} else {
			if ( (this.need[0] as any[])[1].call(this) ) {
				if ( itemloaded !== undefined ) {
					if ( this.need.length > 1 ) {
						itemloaded.call(this,(this.need[0] as any[])[0] as string, (this.need[1] as any[])[0] as string);
					} else {
						itemloaded.call(this,(this.need[0]as any[])[0] as string);
					}
				}
				this.need.shift();
				tries = 0;
			} else { break; }
		}
	}

	// If this.need is empty, call next. If not, call it again in a bit.
	if ( this.need.length === 0 ) {
		next.call(this);
	} else {
		var decaf = this;
		this.loadTimer = setTimeout(function(){decaf.waitLoad(next,itemloaded,tries+1)},this.options.wait_delay);
	}
}

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.initSplash = function() {
	// Create the UI if we're using one. Which we always should be.
	if ( this.options.interface !== undefined ) {
		this.debugString(formatString('Attempting to initialize the interface plugin "{0}".',this.options.interface));
		this.ui = new (DecafMUD as any).plugins.Interface[this.options.interface](this);
		this.ui.initSplash();
	}

	// Set the number of extra steps predicted after this step of loading for
	// the sake of updating the progress bar.
	this.extra = 3;

	// Require plugins for: storage, socket, encoding, triggers, telopt
	this.require('decafmud.storage.'+this.options.storage);
	this.require('decafmud.socket.'+this.options.socket);
	this.require('decafmud.encoding.'+this.options.encoding);

	// Load them. This is the total number of required things thus far.
	if ( this.ui && this.need.length > 0 ) { this.updateSplash(null, (this.need[0] as any[])[0] as string,0); }
	this.waitLoad(this.initSocket, this.updateSplash);
}

DecafMUD.prototype.updateSplash = function(module: string | true | null, next_mod?: string, perc?: number) {
	if ( ! this.ui ) { return; }

	let currentPercentage = perc;
	// Calculate the percentage.
	if ( currentPercentage === undefined ) {
		currentPercentage = Math.min(100,Math.floor(100*(((this.extra+this.required)-this.need.length)/(this.required+this.extra)))); }

	let message = next_mod;
	if ( module === true ) {
		// Don't do anything with message if module is true (it's passed directly)
	} else if ( message !== undefined ) {
		if ( message.indexOf('decafmud') === 0 ) {
			var parts = message.split('.');
			message = formatString('Loading the {0} module "{1}"...', parts[1],parts[2]);
		} else {
			message = formatString('Loading: {0}',message);
		}
	} else if ( currentPercentage == 100 ) {
		message = "Loading complete.";
	}

	this.ui.updateSplash(currentPercentage, message);

}

DecafMUD.prototype.initSocket = function() {
	this.extra = 1;
	// Create the master storage object.
	this.store = new (DecafMUD as any).plugins.Storage[this.options.storage](this);
	this.storage = this.store;

	if ( this.ui ) {
		// Push a junk element to need so the status bar shows properly.
		this.need.push(['.', () => true]);
		this.updateSplash(true,"Initializing the user interface...");

		// Set up the UI.
		this.ui.load();
	}

	// Attempt to create the socket.
	this.debugString(formatString('Creating a socket using the "{0}" plugin.',this.options.socket));
	this.socket = new (DecafMUD as any).plugins.Socket[this.options.socket](this);
	this.socket.setup(0);

	// Load the latest round.
	this.waitLoad(this.initUI, this.updateSplash);
}

DecafMUD.prototype.initUI = function() {
	// Finish setting up the UI.
	if ( this.ui ) {
		this.ui.setup(); }

	// Now, require all our plugins.
	for(var i=0; i<this.options.plugins.length; i++) {
		this.require('decafmud.'+this.options.plugins[i]); }

	this.waitLoad(this.initFinal, this.updateSplash);
}

DecafMUD.prototype.initFinal = function() {

	var textInputFilterCtor, o;

	this.need.push(['.', () => true]);
	this.updateSplash(true,"Initializing triggers system...");
	this.need.shift();

	this.need.push(['.', () => true]);
	this.updateSplash(true,"Initializing TELNET extensions...");
	this.need.shift(); // Added missing shift


	for(var k in (DecafMUD as any).plugins.Telopt) { // Cast
		if (Object.hasOwnProperty.call((DecafMUD as any).plugins.Telopt, k)) {
			o = (DecafMUD as any).plugins.Telopt[k];
			if ( typeof o === 'function' ) {
				this.telopt[k] = new o(this);
			} else {
				this.telopt[k] = o;
			}
		}
	}

	this.need.push(['.', () => true]);
	this.updateSplash(true,"Initializing filters...");
	this.need.shift();


	textInputFilterCtor = (DecafMUD as any).plugins.TextInputFilter[this.options.textinputfilter];
	if ( textInputFilterCtor )
		this.textInputFilter = new textInputFilterCtor(this);

	// We're loaded. Try to connect.
	this.loaded = true;
	if (this.ui) { this.ui.endSplash(); }

		/*
	// If this is IE, show a warning.
	if ( /MSIE/.test(navigator.userAgent) && this.ui.infoBar ) {
		var msg = 'You may experience poor performance and UI glitches using ' +
			'DecafMUD with Microsoft Internet Explorer. We recommend switching ' +
			'to <a href="http://www.google.com/chrome">Google Chrome</a> or ' +
			'<a href="http://www.getfirefox.com">Mozilla Firefox</a> for ' +
			'the best experience.';
		this.ui.infoBar(msg);
	}*/

	if ( (!this.options.autoconnect) || (!this.socket.ready)) { return; }
	this.connect();
}

DecafMUD.prototype.connect = function() {
	if ( this.connecting || this.connected ) { return; }
	if ( this.socket_ready !== true ) { throw "The socket isn't ready yet."; }

	this.connecting = true;
	this.connect_try = 0;
	this.debugString("Attempting to connect...","info");

	// Show that we're connecting
	if ( this.ui && this.ui.connecting ) {
		this.ui.connecting(); }

	// Set a timer so we can try again.
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);

	this.socket.connect();
}

DecafMUD.prototype.connectFail = function() {
	clearTimeout(this.conn_timer);

	this.connect_try += 1;
	// On the last one, just ride it out.
	if ( this.connect_try > this.options.reconnect_tries ) { return; }

	// Retry.
	this.socket.close();
	this.socket.connect();

	// Set the timer.
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
}


DecafMUD.prototype.reconnect = function() {
  this.connect_try++;
	var d = this;
	if ( d.ui && d.ui.connecting ) {
	  d.ui.connecting();
	}
	d.socket.connect();
}

///////////////////////////////////////////////////////////////////////////////
// Socket Events
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.socketReady = function() {
	this.debugString("The socket is ready.");
	this.socket_ready = true;

	if ( this.loaded && this.options.autoconnect ) {
		this.connect();
	}
}

DecafMUD.prototype.socketConnected = function() {
	this.connecting = false; this.connected = true; this.connect_try = 0;
	clearTimeout(this.conn_timer);

	var host = this.socket.host, port = this.socket.port;

	this.debugString(formatString("The socket has connected successfully to {0}:{1}.",host,port),"info");

	for(var k in this.telopt) {
		if (Object.hasOwnProperty.call(this.telopt, k)) {
			if ( this.telopt[k] && this.telopt[k].connect ) {
				this.telopt[k].connect(); }
		}
	}

	if ( this.textInputFilter )
		this.textInputFilter.connected();

	if ( this.ui && this.ui.connected ) {
		this.ui.connected(); }

}

DecafMUD.prototype.socketClosed = function() {
	clearTimeout(this.conn_timer);
	this.connecting = false; this.connected = false;
	this.debugString("The socket has disconnected.","info");

	for(var k in this.telopt) {
		if (Object.hasOwnProperty.call(this.telopt, k)) {
			if ( this.telopt[k] && this.telopt[k].disconnect ) {
				this.telopt[k].disconnect(); }
		}
	}

	this.inbuf = [];
	this.decompressStream = undefined;
	this.startCompressV2 = false;

	if ( this.options.autoreconnect ) {
		this.connect_try++;
		if ( this.connect_try < this.options.reconnect_tries ) {
			if ( this.ui && this.ui.disconnected ) {
				this.ui.disconnected(true); }

			var d = this;

			var s = this.options.reconnect_delay / 1000;
			if ( this.ui && this.ui.immediateInfoBar && s >= 0.25 ) {
				this.ui.immediateInfoBar(formatString("You have been disconnected. Reconnecting in {0} second{1}...", s, (s === 1 ? '' : 's')),
					'reconnecting',
					s,
					undefined,
					[['Reconnect Now',function(){ clearTimeout(d.timer); d.socket.connect(); }]],
					undefined,
					function(){ clearTimeout(d.timer);  }
				); }

			this.timer = setTimeout(function(){
				d.debugString('Attempting to connect...','info');
				if ( d.ui && d.ui.connecting ) {
					d.ui.connecting(); }
				d.socket.connect();
			}, this.options.reconnect_delay);
			return;
		}
	}

	if ( this.ui && this.ui.disconnected ) {
		this.ui.disconnected(false); }
}

DecafMUD.prototype.socketData = function(data: string | ArrayBuffer | Uint8Array) {
	// Push the text onto the inbuf.

	if (this.decompressStream !== undefined) {
		// Decompress it first!
		try {
			let dataToDecompress: Uint8Array | string;
			if (typeof data === 'string') {
                var arr = new Uint8Array(data.length);
                for(var i=0; i<data.length; i++) {
                    arr[i] = data.charCodeAt(i);
                }
                dataToDecompress = arr;
			} else if (data instanceof ArrayBuffer) {
                dataToDecompress = new Uint8Array(data);
            } else {
				dataToDecompress = data;
			}

			this.decompressStream.push(dataToDecompress, false);

			if (this.decompressStream.err) {
				throw new Error(this.decompressStream.msg || 'Unknown pako error');
			}
		} catch (e: any) {
			this.error(formatString('MCCP2 compression disabled because {0}', e.message));
			this.disableMCCP2();
			return;
		}
	} else {
		this.inbuf.push(data);
	}

	if ( this.loaded ) {
		this.processBuffer();
	}
}

DecafMUD.prototype.socketError = function(data: any,data2: any) {
	this.debugString(formatString('Socket Err: {0}  d2="{1}"',data,data2),'error');
}

///////////////////////////////////////////////////////////////////////////////
// Data Processing
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.getEnc = function(enc: string): string {
	enc = enc.replace(/-/g,'').toLowerCase();
	return enc;
}

DecafMUD.prototype.setEncoding = function(enc: string) {
	let currentEnc = this.getEnc(enc);
	if ( (DecafMUD as any).plugins.Encoding[currentEnc] === undefined ) {
		throw new Error(`"${currentEnc}" isn't a valid encoding scheme, or it isn't loaded.`); }
	this.debugString("Switching to character encoding: " + currentEnc);
	this.options.encoding = currentEnc;
	this.decode = (DecafMUD as any).plugins.Encoding[currentEnc].decode;
	this.encode = (DecafMUD as any).plugins.Encoding[currentEnc].encode;
}

var iac_reg = /\xFF/g;
DecafMUD.prototype.sendInput = function(input: string) {
	if ( !this.socket || !this.socket.connected ) {
		this.debugString("Cannot send input: not connected");
		return;
	}
	this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));
	if ( this.ui ) {
		this.ui.displayInput(input); }
}

DecafMUD.prototype.decode = function(data: string): [string, string] {
	return (DecafMUD as any).plugins.Encoding[this.options.encoding].decode(data); }

DecafMUD.prototype.encode = function(data: string): string {
	return (DecafMUD as any).plugins.Encoding[this.options.encoding].encode(data); }

DecafMUD.prototype.processBuffer = function() {
	var enc, data_str, ind, out;

	let accumulatedData = "";

	if (this.decompressStream) {
		if (this.decompressStream.result && (this.decompressStream.result as any).length > 0) {
			let chunk = this.decompressStream.result;
			if (typeof chunk !== 'string') {
				chunk = String.fromCharCode.apply(null, chunk as unknown as number[]);
			}
			accumulatedData += chunk;
			this.decompressStream.chunks = [];
            // @ts-ignore: pako types might not show result as nullable like this
			this.decompressStream.result = null;
		}
	}

    let stringifiedInbuf = "";
	for (const item of this.inbuf) {
		if (typeof(item) === 'string') {
			stringifiedInbuf += item;
		} else if (item instanceof Uint8Array) {
			stringifiedInbuf += Array.from(item).map(charCode=>String.fromCharCode(charCode)).join('');
		} else if (item instanceof ArrayBuffer) {
			stringifiedInbuf += Array.from(new Uint8Array(item)).map(charCode=>String.fromCharCode(charCode)).join('');
		}
	}
	this.inbuf = [];

	data_str = stringifiedInbuf + accumulatedData;

	var IAC = (DecafMUD as any).TN.IAC, left='';

	while ( data_str.length > 0 ) {
		ind = data_str.indexOf(IAC);
		if ( ind === -1 ) {
			if (this.decompressStream) {
				this.handleInputText(data_str);
				data_str = "";
			} else {
				enc = this.decode(data_str);
				this.handleInputText(enc[0]);
				if (enc[1]) this.inbuf.push(enc[1]);
				data_str = "";
			}
			break;
		} else if ( ind > 0 ) {
            let text_before_iac = data_str.substring(0,ind);
            if (this.decompressStream) {
                this.handleInputText(text_before_iac);
            } else {
			    enc = this.decode(text_before_iac);
			    this.handleInputText(enc[0]);
			    left = enc[1];
            }
			data_str = data_str.substring(ind);
		}

		out = this.readIAC(data_str);

		if (this.startCompressV2 && this.decompressStream && out !== false && typeof out === 'string') {
			try {
                const outAsBytes = new Uint8Array(out.length);
				for (let k = 0; k < out.length; k++) {
					outAsBytes[k] = out.charCodeAt(k);
				}
                this.decompressStream.push(outAsBytes, false);
                if (this.decompressStream.err) {
                    throw new Error(this.decompressStream.msg || 'Unknown pako error during initial block decompression');
                }
                let initialDecompressed = this.decompressStream.result;
                if (typeof initialDecompressed !== 'string') {
                    initialDecompressed = String.fromCharCode.apply(null, initialDecompressed as unknown as number[]);
                }
                // @ts-ignore
                this.decompressStream.result = null;
                this.decompressStream.chunks = [];
                out = initialDecompressed;
                this.startCompressV2 = false;
            } catch (e: any) {
                this.error(formatString('MCCP2 compression disabled because {0}', e.message));
                this.disableMCCP2();
                out = '';
            }
		}

		if ( out === false ) {
			this.inbuf.push(left + data_str);
			break;
		}
		data_str = left + (out as string); // out should be string here
		left = '';
	}
}

DecafMUD.prototype.handleInputText = function(text: string) {
	if ( this.textInputFilter )
		text = this.textInputFilter.filterInputText(text);
	if ( this.display )
		this.display.handleData(text);
}

DecafMUD.prototype.readIAC = function(data: string): string | false {
	const { TN } = (DecafMUD as any);
	if ( data.length < 2 ) { return false; }
	if ( data.charCodeAt(1) === 255 ) {
		if(this.display) this.display.handleData('\xFF');
		return data.substring(2);
	} else if ( data.charCodeAt(1) === TN.GA || data.charCodeAt(1) === 241 ) {
		return data.substring(2);
	} else if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) {
		if ( data.length < 3 ) { return false; }
		var seq = data.substring(0,3);
		this.debugString('RCVD ' + (DecafMUD as any).debugIAC(seq));
		this.handleIACSimple(seq);
		return data.substring(3);
	} else if ( data.charAt(1) === TN.SB ) {
		var seq = '', l_str = TN.IAC + TN.SE;
		var code = data.charAt(2);
		let current_data = data.substring(3);
		if ( current_data.length === 0 ) { return false; }
		while(current_data.length > 0) {
			var ind = current_data.indexOf(l_str);
			if ( ind === -1 ) { return false; }
			if ( ind > 0 && current_data.charAt(ind-1) === TN.IAC ) {
				seq += current_data.substring(0,ind+1);
				current_data = current_data.substring(ind+1);
				continue;
			}
			seq += current_data.substring(0,ind);
			current_data = current_data.substring(ind + l_str.length);
			data = current_data;
			break;
		}
		var dbg = true;
		if ( this.telopt[code] !== undefined && this.telopt[code]._sb !== undefined ) {
			if ( this.telopt[code]._sb(seq) === false ) { dbg = false; }
		}
		if ( dbg ) {
			if ( code === TN.MSSP && typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined ) {
				console.groupCollapsed(`DecafMUD[${this.id}]: RCVD IAC SB MSSP ... IAC SE`);
				console.dir(readMSDP(seq)[0]);
				console.groupEnd();
			} else {
				this.debugString('RCVD ' + (DecafMUD as any).debugIAC(TN.IAC + TN.SB + code + seq + TN.IAC + TN.SE));
			}
		}
		return data;
	}
	return data.substring(1);
}

DecafMUD.prototype.sendIAC = function(seq: string) {
	this.debugString('SENT ' + (DecafMUD as any).debugIAC(seq));
	if ( this.socket ) { this.socket.write(seq); }
}

DecafMUD.prototype.handleIACSimple = function(seq: string) {
	var t_local = (DecafMUD as any).TN, o = this.telopt[seq.charAt(2)],
		c = seq.charAt(2);
	if ( o === undefined ) {
		if ( seq.charAt(1) === t_local.DO ) {
			this.sendIAC(t_local.IAC + t_local.WONT + c); }
		else if ( seq.charAt(1) === t_local.WILL ) {
			this.sendIAC(t_local.IAC + t_local.DONT + c); }
		return;
	}
	switch(seq.charAt(1)) {
		case t_local.DO:
			if (!( o._do && o._do() === false )) {
				this.sendIAC(t_local.IAC + t_local.WILL + c); }
			return;
		case t_local.DONT:
			if (!( o._dont && o._dont() === false )) {
				this.sendIAC(t_local.IAC + t_local.WONT + c); }
			return;
		case t_local.WILL:
			if (!( o._will && o._will() === false )) {
				this.sendIAC(t_local.IAC + t_local.DO + c); }
			return;
		case t_local.WONT:
			if (!( o._wont && o._wont() === false )) {
				this.sendIAC(t_local.IAC + t_local.DONT + c); }
			return;
	}
}

///////////////////////////////////////////////////////////////////////////////
// Basic Permissions
///////////////////////////////////////////////////////////////////////////////

DecafMUD.prototype.requestPermission = function(option: string, prompt: string, callback: (allowed: boolean) => void) {
	var cur = this.store.get(option);
	if ( cur !== undefined && cur !== null ) {
		callback.call(this, !!(cur));
		return; }
	var decaf = this;
	var closer = function(e?: any) {
			callback.call(decaf, false);
		},
		help_allow = function() {
			decaf.store.set(option, true);
			callback.call(decaf, true);
		},
		help_deny = function() {
			decaf.store.set(option, false);
			callback.call(decaf, false);
		};
	if ( this.ui && this.ui.infoBar ) {
		this.ui.infoBar(prompt, 'permission', 0, undefined,
			[['Allow', help_allow], ['Deny', help_deny]], undefined, closer);
		return; }
}

///////////////////////////////////////////////////////////////////////////////
// Default Settings
///////////////////////////////////////////////////////////////////////////////
(DecafMUD as any).settings = {
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
(DecafMUD as any).options = {
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
	socket			: 'flash', // Will change to websocket later
	interface		: 'simple',
	// language		: 'autodetect', // Removed
	textinputfilter		: '',

	// Loading Settings
	jslocation		: undefined, // undefined = This script's location
	wait_delay		: 25,
	wait_tries		: 1000,
	// load_language	: true, // Removed
	plugins			: [],

	// Storage Settings
	set_storage		: {
		// There are no settings. Yet.
	},

	// Display Settings
	set_display		: {
		maxscreens  : 100,
		minelements : 10,
		handlecolor	: true,
		fgclass		: 'c',
		bgclass		: 'b',
		fntclass	: 'fnt',
		inputfg		: '-7',
		inputbg		: '-0'
	},

	// Socket Settings
	set_socket		: {
		// Flash Specific
		policyport	: undefined,
		swf			: '/media/DecafMUDFlashSocket.swf',

		// WebSocket Specific
		wsport		: undefined,
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
	ttypes			: ['decafmud-'+(DecafMUD as any).version,'decafmud','xterm','unknown'], // Cast
	environ			: {},
	encoding_order	: ['utf8'],

	// Plugin Settings
	plugin_order	: []
};

// Assign telopt handlers after class definition
// Assign telopt handlers after class definition
DecafMUD.plugins.Telopt[DecafMUD.TN.TTYPE] = tTTYPE;
DecafMUD.plugins.Telopt[DecafMUD.TN.ECHO] = tECHO;
DecafMUD.plugins.Telopt[DecafMUD.TN.NAWS] = tNAWS;
DecafMUD.plugins.Telopt[DecafMUD.TN.CHARSET] = tCHARSET;
DecafMUD.plugins.Telopt[DecafMUD.TN.COMPRESSv2] = tCOMPRESSv2;
DecafMUD.plugins.Telopt[DecafMUD.TN.MSDP] = tMSDP;

// Register the converted GMCP plugin
DecafMUD.plugins.Telopt[DecafMUD.TN.GMCP] = GmcpTelopt;

// Register ZMP Telopt plugin
import { ZmpTelopt } from './plugins/telopt/zmp';
DecafMUD.plugins.Telopt[DecafMUD.TN.ZMP] = ZmpTelopt;

// Register CP437 Encoding plugin
import { cp437Encoding } from './plugins/encoding/cp437';
DecafMUD.plugins.Encoding.cp437 = cp437Encoding;

// Register ISO-8859-15 Encoding plugin
import { iso885915Encoding } from './plugins/encoding/iso885915';
DecafMUD.plugins.Encoding.iso885915 = iso885915Encoding;

// Register the converted StandardDisplay plugin
DecafMUD.plugins.Display.standard = StandardDisplay;

// Register the converted WebSocketSocket plugin
DecafMUD.plugins.Socket.websocket = WebSocketSocket;
// Note: The Flash socket plugin (DecafMUD.plugins.Socket.flash) will be omitted as Flash is obsolete.

DecafMUD.plugins.Telopt[DecafMUD.TN.BINARY] = true;
DecafMUD.plugins.Telopt[DecafMUD.TN.MSSP] = typeof window !== 'undefined' && 'console' in window;

// Populate the Encoding plugins (moved from earlier in the original JS)
DecafMUD.plugins.Encoding.iso88591 = {
	proper : 'ISO-8859-1',
	decode : function(data: string): [string, string] { return [data,'']; },
	encode : function(data: string): string { return data; }
};

DecafMUD.plugins.Encoding.utf8 = {
	proper : 'UTF-8',
	decode : function(data: string): [string, string] {
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			var out = '', i=0, l=data.length, c = 0;
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) { out += String.fromCharCode(c); }
				else if ( (c > 0xBF) && (c < 0xE0) ) {
					if ( i+1 > l ) { break; }
					out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xDF) && (c < 0xF0) ) {
					if ( i+2 > l ) { break; }
					out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xEF) && (c < 0xF5) ) {
                    if ( i+3 > l ) { break; }
                    let charCode = ((c & 7) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63);
                    if (charCode > 0xFFFF) {
                        charCode -= 0x10000;
                        out += String.fromCharCode(0xD800 + (charCode >> 10), 0xDC00 + (charCode & 0x3FF));
                    } else { out += String.fromCharCode(charCode); }
				} else { out += String.fromCharCode(0xFFFD); }
			}
			return [out, data.substr(i)];
		}
    },
	encode : function(data: string): string {
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) {
			console.dir(err); return data;
        }
    }
};


export { DecafMUD, DecafMUD as Decaf }; // Export DecafMUD also as Decaf for backward compatibility if any old script relied on that name.
export { DecafMUD as default }; // Export as default

// Export TN separately for potential direct use by plugins or external tools
export const TN = DecafMUD.TN;

// Add other exports as needed, e.g. extend_obj, inherit etc. if they are to be used by plugins externally
// For now, keeping them module-local.
// export { extend_obj, inherit, iacToWord, readMSDP, writeMSDP };

```
