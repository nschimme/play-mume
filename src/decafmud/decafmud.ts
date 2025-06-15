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

// Make TypeScript aware of the custom String.prototype.tr method
interface String {
    tr(decaf: any, ...args: any[]): string;
    // If logNonTranslated is meant to be a static property on String constructor
    // It should be handled differently, e.g. via a namespace or a global var.
}
// We'll assume logNonTranslated is handled by the tr implementation or is not type-critical for now.

// Extend the String prototype with endsWith and substr_count.
if ( String.prototype.endsWith === undefined ) {
	(String.prototype as any).endsWith = function(suffix: string) {
		var startPos = this.length - suffix.length;
		return startPos < 0 ? false : this.lastIndexOf(suffix, startPos) === startPos;
	}
}

if ( (String.prototype as any).substr_count === undefined ) {
	(String.prototype as any).substr_count = function(needle: string) {
		var count = 0,
			i = this.indexOf(needle);
		while ( i !== -1 ) {
			count++;
			i = this.indexOf(needle, i+1);
		}
		return count;
	}
}

// Extend Array with indexOf if it doesn't exist, for IE8
if ( Array.prototype.indexOf === undefined ) {
	(Array.prototype as any).indexOf = function(text: any,i?: number) {
		if ( i === undefined ) { i = 0; }
		for(;i<this.length;i++){if(this[i]===text){return i;}}
		return -1;
	}
}

// Declare Zlib as it's loaded via script and will be global
declare var Zlib: any;

// The obligatory, oh-so-popular wrapper function
(function(window) {

// Create a function for extending Objects
var extend_obj = function(base: any, obj: any) {
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

// Forward declaration for iacToWord and other IIFE-scoped helpers
let iacToWord: (c: string) => string;
var readMSDP: (data: string) => [any, string]; // Define its signature

class DecafMUD implements DecafMUDInstance {
	// Instance Information
	static instances: DecafMUD[]	= [];
	static last_id: number	= -1;
	static version = {major: 0, minor: 10, micro: 0, flag: 'beta',
		toString: function(this: {major: number, minor: number, micro: number, flag?: string}){ return this.major+'.'+this.minor+'.'+this.micro+( this.flag ? '-' + this.flag : ''); } };

	// Default Values
	loaded: boolean		= false;
	connecting: boolean	= false;
	connected: boolean	= false;

	loadTimer: any	= null;
	timer: any		= null;
	connect_try: number	= 0;
	required: number		= 0;

	// Instance properties
	options: any = {};
	settings: any = {};
	need: any[] = [];
	inbuf: any[] = [];
	telopt: any = {};
	id: number;
	ui: any;
	display: any;
	socket: any;
	store: any;
	storage: any;
	textInputFilter: any;
	extra: number = 0;
	conn_timer: any;
	socket_ready: boolean = false;
	decompressStream: any;
	startCompressV2: boolean = false;

	// TELNET Constants, ESC, BEL
	static readonly ESC = "\x1B";
	static readonly BEL = "\x07";
	static readonly TN = {
		IAC			: "\xFF", DONT		: "\xFE", DO			: "\xFD", WONT		: "\xFC", WILL		: "\xFB", SB			: "\xFA", SE			: "\xF0",
		IS			: "\x00", EORc		: "\xEF", GA			: "\xF9", BINARY		: "\x00", ECHO		: "\x01", SUPGA		: "\x03",
		STATUS		: "\x05", SENDLOC		: "\x17", TTYPE		: "\x18", EOR			: "\x19", NAWS		: "\x1F", TSPEED		: "\x20",
		RFLOW		: "\x21", LINEMODE	: "\x22", AUTH		: "\x23", NEWENV		: "\x27", CHARSET		: "\x2A", MSDP		: "E",
		MSSP		: "F", COMPRESS	: "U", COMPRESSv2	: "V", MSP			: "Z", MXP			: "[", ZMP			: "]",
		CONQUEST	: "^", ATCP		: "\xC8", GMCP		: "\xC9",
	};

	// Default settings and options objects
	static settings: any = {
		'startup': { '_path': "/", '_desc': "Control what happens when DecafMUD is opened.",
			'autoconnect': { '_type': 'boolean', '_desc': 'Automatically connect to the server.'},
			'autoreconnect': { '_type': 'boolean', '_desc': 'Automatically reconnect when the connection is lost.'}
		},
		'appearance': { '_path': "display/", '_desc': "Control the appearance of the client.",
			'font': { '_type': 'font', '_desc': 'The font to display MUD output in.'}
		}
	};
	static options: any = {
		host			: undefined, port			: 4000, autoconnect		: true, connectonsend	: true, autoreconnect	: true,
		connect_timeout : 5000, reconnect_delay	: 5000, reconnect_tries	: 3, storage			: 'standard', display			: 'standard',
		encoding		: 'utf8', socket			: 'flash', interface		: 'simple', language		: 'autodetect',
		textinputfilter		: '', jslocation		: undefined, wait_delay		: 25, wait_tries		: 1000, load_language	: true,
		plugins			: [], set_storage		: {},
		set_display		: { handlecolor	: true, fgclass		: 'c', bgclass		: 'b', fntclass	: 'fnt', inputfg		: '-7', inputbg		: '-0'},
		set_socket		: { policyport	: undefined, swf			: '/media/DecafMUDFlashSocket.swf', wsport		: undefined, wspath		: '',},
		set_interface	: { container	: undefined, start_full	: false, mru			: true, mru_size	: 15, multiline	: true, clearonsend	: false, focusinput	: true, repeat_input    : true, blurclass	: 'mud-input-blur', msg_connect		: 'Press Enter to connect and type here...', msg_connecting	: 'DecafMUD is attempting to connect...', msg_empty		: 'Type commands here, or use the Up and Down arrows to browse your recently used commands.', connect_hint	: true },
		ttypes			: ['decafmud-'+DecafMUD.version.toString(),'decafmud','xterm','unknown'], environ			: {}, encoding_order	: ['utf8'], plugin_order	: []
	};


	constructor(options?: any) {
		this.options = {};
		extend_obj(this.options, DecafMUD.options);

		if ( options !== undefined ) {
			if ( typeof options !== 'object' ) { throw "The DecafMUD options argument must be an object!"; }
			extend_obj(this.options, options);
		}

		this.settings = {};
		extend_obj(this.settings, DecafMUD.settings);

		this.need = [];
		this.inbuf = [];
		this.telopt = {};

		if ( this.options.language === 'autodetect' ) {
			var lang = navigator.language ? navigator.language : (navigator as any).userLanguage;
			this.options.language =lang.split('-',1)[0];
		}

		this.id = ( ++DecafMUD.last_id );
		DecafMUD.instances.push(this);

		this.debugString('Created new instance.', 'info');

		if ( 'console' in window && console.groupCollapsed ) {
			console.groupCollapsed('DecafMUD['+this.id+'] Provided Options');
			console.dir(this.options);
			console.groupEnd();
		}

		if ( this.options.language !== 'en' && this.options.load_language  ) {
			this.require('decafmud.language.'+this.options.language); }
		this.require('decafmud.interface.'+this.options.interface);

		this.waitLoad(this.initSplash);
	}

	static debugIAC(seq: string): string {
		var out = '', t = DecafMUD.TN, state = 0, st: any = false, l = seq.length,
			i2w_func = iacToWord;

		for( var i = 0; i < l; i++ ) {
			var c = seq.charAt(i),	cc = c.charCodeAt(0);
			if ( state === 2 ) { if ( c === t.ECHO ) { out += 'SEND '; } else if ( c === t.IS ) { out += 'IS '; } else if ( c === t.IAC ) { if ( st ) { st = false; out += '" IAC '; } else { out += 'IAC '; } state = 0; } else { if ( !st ) { st = true; out += '"'; } out += c; } continue; }
			else if ( state === 3 || state === 4 ) { if ( c === t.IAC || (cc >= 1 && cc <= 4) ) { if ( st ) { st = false; out += '" '; } if ( c === t.IAC ) { out += 'IAC '; state = 0; } else if ( cc === 3 ) { out += 'MSDP_OPEN '; } else if ( cc === 4 ) { out += 'MSDP_CLOSE '; } else { if ( state === 3 ) { out += 'MSSP_'; } else { out += 'MSDP_'; } if ( cc === 1 ) { out += 'VAR '; } else { out += 'VAL '; } } } else { if ( !st ) { st = true; out += '"'; } out += c; } continue; }
			else if ( state === 5 ) { if ( c === t.IAC ) { st = false; out += 'IAC '; state = 0; } else { if ( st === false ) { st = cc * 255; } else { out += (cc + st).toString() + ' '; st = false; } } continue; }
			else if ( state === 6 ) { if ( c === t.IAC || (cc > 0 && cc < 8) ) { if ( st ) { st = false; out += '" '; } if ( c === t.IAC ) { out += 'IAC '; state = 0; } else if ( cc === 1 ) { out += 'REQUEST '; } else if ( cc === 2 ) { out += 'ACCEPTED '; } else if ( cc === 3 ) { out += 'REJECTED '; } else if ( cc === 4 ) { out += 'TTABLE-IS '; } else if ( cc === 5 ) { out += 'TTABLE-REJECTED '; } else if ( cc === 6 ) { out += 'TTABLE-ACK '; } else if ( cc === 7 ) { out += 'TTABLE-NAK '; } } else { if ( !st ) { st = true; out += '"'; } out += c; } }
			else if ( state === 7 ) { if ( c === t.IAC || cc === 0 ) { if ( st ) { st = false; out += '" '; } if ( c === t.IAC ) { out += 'IAC '; state = 0; } else if ( cc === 0 ) { out += 'NUL '; } } else { if ( !st ) { st = true; out += '"'; } out += c; } }
			else if ( state < 2 ) { if (i2w_func) out += i2w_func(c) + ' '; }
			if ( state === 0 ) { if ( c === t.SB ) { state = 1; } } else if ( state === 1 ) { if ( c === t.TTYPE || c === t.TSPEED ) { state = 2; } else if ( c === t.MSSP ) { state = 3; } else if ( c === t.MSDP ) { state = 4; } else if ( c === t.NAWS ) { state = 5; } else if ( c === t.CHARSET || c === t.SENDLOC || c === t.GMCP ) { state = 6; } else if ( c === t.ZMP ) { state = 7; } else { state = 0; } }
		}
		return out.substr(0, out.length-1);
	}


///////////////////////////////////////////////////////////////////////////////
// Plugins System
///////////////////////////////////////////////////////////////////////////////
static plugins: any = {
	Display		: {}, Encoding	: {}, Extra		: {}, Interface	: {}, Language	: {},
	Socket		: {}, Storage		: {}, Telopt		: {}, TextInputFilter : {}
};

loaded_plugs: any = {};

static inherit(subclass: any, superclass: any) {
	var f: { new(): any; prototype: any } = function() {}; // Add type for f
	f.prototype = superclass.prototype;
	subclass.prototype = new f();
	subclass.superclass = superclass.prototype;
	if ( superclass.prototype.constructor == Object.prototype.constructor ) {
		superclass.prototype.constructor = superclass; }
}

public debugString(text: string, type?: string, obj?: any): void {
	if (!('console' in window)) { return; }
	if (type === undefined) { type = 'debug'; }
	if (obj !== undefined) { text = (text as any).tr(this, obj); }
	var st = 'DecafMUD[' + this.id + ']: %s';
	switch (type) {
		case 'info': console.info(st, this.id, text); return;
		case 'warn': console.warn(st, this.id, text); return;
		case 'error': console.error(st, this.id, text); return;
		default:
			if ('debug' in console && typeof console.debug === 'function') { // Check if console.debug is a function
				console.debug(st, this.id, text);
				return;
			}
			console.log(st, this.id, text);
	}
}

public require(module: string, check?: () => boolean): void {
	if ( this.options.load_language && this.options.language !== 'en' &&
		 module.indexOf('language') === -1 && module.indexOf('decafmud') !== -1 ) {
		var parts = module.split('.');
		parts.splice(1,0,"language",this.options.language);
		this.require(parts.join('.'));
	}

	if ( check === undefined ) {
		if ( module.toLowerCase().indexOf('decafmud') === 0 ) {
			var parts = module.split('.');
			if ( parts.length < 2 ) { return; }
			parts.shift();
			parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);

			if ( parts[0] === 'Telopt' ) {
				for(var k in DecafMUD.TN) {
					if ( parts[1].toUpperCase() === k.toUpperCase() ) {
						parts[1] = (DecafMUD.TN as any)[k];
						break; }
				}
			}

			check = () => {
				if ( (DecafMUD.plugins as any)[parts[0]] !== undefined ) {
					if ( parts.length > 1 ) {
						return (DecafMUD.plugins as any)[parts[0]][parts[1]] !== undefined;
					} else { return true; }
				}
				return false;
			};
		} else {
			throw "Can't build checker for non-DecafMUD module!"
		}
	}

	this.required++;
	if ( check.call(this) ) { return; }
	this.loadScript(module+'.js');
	this.need.push([module,check]);
}

public loadScript(filename: string, path?: string): void {
	if ( path === undefined ) {
		if ( this.options.jslocation !== undefined ) { path = this.options.jslocation; }
		if ( path === undefined || typeof path === 'string' && path.length === 0 ) {
			var obj = document.querySelector('script[src*="decafmud.js"]');
			if ( obj === null ) {
				obj = document.querySelector('script[src*="decafmud.min.js"]'); }
			if ( obj !== null ) {
				path = (obj as HTMLScriptElement).src.substr(0,(obj as HTMLScriptElement).src.lastIndexOf('/')+1); }
		}
	}
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = (path || "") + filename;
	document.getElementsByTagName('head')[0].appendChild(script);
	this.debugString('Loading script: ' + filename);
}

public waitLoad(next: () => void, itemloaded?: (module: string, next_mod?: string, perc?: number) => void, tr: number = 0): void {
	clearTimeout(this.loadTimer);

	if ( tr > this.options.wait_tries ) {
		if ( this.need[0] && this.need[0][0].indexOf('language') === -1 ) {
			this.error("Timed out attempting to load the module: {0}".tr(this, this.need[0][0]));
			return;
		} else {
			if ( itemloaded !== undefined && this.need[0] ) {
				if ( this.need.length > 1 ) {
					itemloaded.call(this,this.need[0][0], this.need[1][0]);
				} else {
					itemloaded.call(this,this.need[0][0]);
				}
			}
			if(this.need[0]) this.need.shift();
			tr = 0;
		}
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

	if ( this.need.length === 0 ) {
		next.call(this);
	} else {
		var decaf = this;
		this.loadTimer = setTimeout(function(){decaf.waitLoad(next,itemloaded,(tr||0)+1)},this.options.wait_delay);
	}
}

public initSplash(): void {
	if ( this.options.interface !== undefined ) {
		this.debugString('Attempting to initialize the interface plugin "{0}".tr(this,this.options.interface)');
		this.ui = new (DecafMUD.plugins as any).Interface[this.options.interface](this);
		this.ui.initSplash();
	}
	this.extra = 3;
	this.require('decafmud.storage.'+this.options.storage);
	this.require('decafmud.socket.'+this.options.socket);
	this.require('decafmud.encoding.'+this.options.encoding);
	if ( this.ui && this.need.length > 0 ) { this.updateSplash(null,this.need[0][0],0); }
	this.waitLoad(this.initSocket, this.updateSplash);
}

public updateSplash(module: string | boolean | null,next_mod?: string,perc?: number): void {
	if ( ! this.ui ) { return; }
	if ( perc === undefined ) {
		perc = Math.min(100,Math.floor(100*(((this.extra+this.required)-this.need.length)/(this.required+this.extra)))); }
	if ( module === true ) { /* Do Nothing */ }
	else if ( next_mod !== undefined ) {
		if ( next_mod.indexOf('decafmud') === 0 ) {
			var parts = next_mod.split('.');
			next_mod = 'Loading the {0} module "{1}"...'.tr(this, parts[1],parts[2]);
		} else { next_mod = 'Loading: {0}'.tr(this,next_mod); }
	} else if ( perc == 100 ) { next_mod = "Loading complete.".tr(this); }
	this.ui.updateSplash(perc, next_mod);
}

public initSocket(): void {
	this.extra = 1;
	this.store = new (DecafMUD.plugins as any).Storage[this.options.storage](this);
	this.storage = this.store;
	if ( this.ui ) {
		this.need.push('.');
		this.updateSplash(true,"Initializing the user interface...".tr(this));
		this.ui.load();
	}
	this.debugString('Creating a socket using the "{0}" plugin.'.tr(this,this.options.socket));
	this.socket = new (DecafMUD.plugins as any).Socket[this.options.socket](this);
	this.socket.setup(0);
	this.waitLoad(this.initUI, this.updateSplash);
}

public initUI(): void {
	if ( this.ui ) { this.ui.setup(); }
	for(var i=0; i<this.options.plugins.length; i++) {
		this.require('decafmud.'+this.options.plugins[i]); }
	this.waitLoad(this.initFinal, this.updateSplash);
}

public initFinal(): void {
	var textInputFilterCtor, o;
	this.need.push('.'); this.updateSplash(true,"Initializing triggers system..."); this.need.shift();
	this.need.push('.'); this.updateSplash(true,"Initializing TELNET extensions...");
	for(var k in DecafMUD.plugins.Telopt) {
		o = (DecafMUD.plugins as any).Telopt[k];
		if ( typeof o === 'function' ) { this.telopt[k] = new o(this); }
		else { this.telopt[k] = o; }
	}
	this.need.push('.'); this.updateSplash(true,"Initializing filters...");
	textInputFilterCtor = (DecafMUD.plugins as any).TextInputFilter[this.options.textinputfilter];
	if ( textInputFilterCtor ) this.textInputFilter = new textInputFilterCtor(this);
	this.loaded = true; this.ui.endSplash();
	if ( (!this.options.autoconnect) || (!this.socket.ready)) { return; }
	this.connect();
}

public connect(): void {
	if ( this.connecting || this.connected ) { return; }
	if ( this.socket_ready !== true ) { throw "The socket isn't ready yet."; }
	this.connecting = true; this.connect_try = 0;
	this.debugString("Attempting to connect...","info");
	if ( this.ui && this.ui.connecting ) { this.ui.connecting(); }
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
	this.socket.connect();
}

public connectFail(): void {
	clearTimeout(this.conn_timer);
	(this as any).cconnect_try += 1; // Assuming cconnect_try was a typo for connect_try
	if ( this.connect_try > this.options.reconnect_tries ) { return; }
	this.socket.close(); this.socket.connect();
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
}

public reconnect(): void {
  this.connect_try++;
  var d = this;
  if ( d.ui && d.ui.connecting ) { d.ui.connecting(); }
  d.socket.connect();
}

public socketReady(): void {
	this.debugString("The socket is ready."); this.socket_ready = true;
	if ( this.loaded && this.options.autoconnect ) { this.connect(); }
}

public socketConnected(): void {
	this.connecting = false; this.connected = true; this.connect_try = 0;
	clearTimeout(this.conn_timer);
	var host = this.socket.host, port = this.socket.port;
	this.debugString("The socket has connected successfully to {0}:{1}.".tr(this,host,port),"info");
	for(var k in this.telopt) { if ( this.telopt[k] && this.telopt[k].connect ) { this.telopt[k].connect(); } }
	if ( this.textInputFilter && this.textInputFilter.connected) this.textInputFilter.connected();
	if ( this.ui && this.ui.connected ) { this.ui.connected(); }
}

public socketClosed(): void {
	clearTimeout(this.conn_timer);
	this.connecting = false; this.connected = false;
	this.debugString("The socket has disconnected.","info");
	for(var k in this.telopt) { if ( this.telopt[k] && this.telopt[k].disconnect ) { this.telopt[k].disconnect(); } }
	this.inbuf = []; this.decompressStream = undefined; this.startCompressV2 = false;
	if ( this.options.autoreconnect ) {
		this.connect_try++;
		if ( this.connect_try < this.options.reconnect_tries ) {
			if ( this.ui && this.ui.disconnected ) { this.ui.disconnected(true); }
			var d = this; var s = this.options.reconnect_delay / 1000;
			if ( this.ui && this.ui.immediateInfoBar && s >= 0.25 ) {
				this.ui.immediateInfoBar("You have been disconnected. Reconnecting in {0} second{1}...".tr(this, s, (s === 1 ? '' : 's')),
					'reconnecting', s, undefined,
					[['Reconnect Now'.tr(this),function(){ clearTimeout(d.timer); d.socket.connect(); }]],
					undefined, function(){ clearTimeout(d.timer);  }
				); }
			this.timer = setTimeout(function(){
				d.debugString('Attempting to connect...','info');
				if ( d.ui && d.ui.connecting ) { d.ui.connecting(); }
				d.socket.connect();
			}, this.options.reconnect_delay);
			return;
		}
	}
	if ( this.ui && this.ui.disconnected ) { this.ui.disconnected(false); }
}

public socketData(data: any): void {
	if (this.decompressStream !== undefined) {
		try { data = this.decompressStream.decompress(data); }
		catch (e: any) { this.error('MCCP2 compression disabled because ' + e); this.disableMCCP2(); return; }
	}
	this.inbuf.push(data);
	if ( this.loaded ) { this.processBuffer(); }
}

public socketError(data: any,data2?: any): void {
	this.debugString('Socket Err: {0}  d2="{1}"'.tr(this,data,data2),'error');
}

public getEnc(enc: string): string { return enc.replace(/-/g,'').toLowerCase(); }

public setEncoding(enc: string): void {
	enc = this.getEnc(enc);
	if ( (DecafMUD.plugins as any).Encoding[enc] === undefined ) {
		throw '"'+enc+"' isn't a valid encoding scheme, or it isn't loaded."; }
	this.debugString("Switching to character encoding: " + enc);
	this.options.encoding = enc;
	this.decode = (DecafMUD.plugins as any).Encoding[enc].decode;
	this.encode = (DecafMUD.plugins as any).Encoding[enc].encode;
}

public sendInput(input: string): void {
	if ( !this.socket || !this.socket.connected ) { this.debugString("Cannot send input: not connected"); return; }
	this.socket.write(this.encode(input + '\r\n').replace(/\xFF/g, '\xFF\xFF'));
	if ( this.ui ) { this.ui.displayInput(input); }
}

public decode(data: any): [string, string] { return (DecafMUD.plugins as any).Encoding[this.options.encoding].decode(data); }
public encode(data: string): any { return (DecafMUD.plugins as any).Encoding[this.options.encoding].encode(data); }

public processBuffer(): void {
	var enc, data_arr: string[] = [], ind, out_str;
	var current_inbuf = this.inbuf;
	this.inbuf = [];

	for (let item of current_inbuf) {
		if (typeof(item) == 'string') { data_arr.push(item); }
		else { data_arr.push(Array.from(item).map((charCode: any)=>String.fromCharCode(charCode)).join('')); }
	}
	var data_str = data_arr.join('');
	var IAC = DecafMUD.TN.IAC, left='';

	while ( data_str.length > 0 ) {
		ind = data_str.indexOf(IAC);
		if ( ind === -1 ) {
			enc = this.decode(data_str); this.handleInputText(enc[0]);
			if (enc[1]) this.inbuf.splice(0,0,enc[1]);
			break;
		}
		else if ( ind > 0 ) {
			enc = this.decode(data_str.substr(0,ind)); this.handleInputText(enc[0]);
			left = enc[1]; data_str = data_str.substr(ind);
		}

		out_str = this.readIAC(data_str);
		if (this.startCompressV2) {
			try {
				this.startCompressV2 = false; this.decompressStream = new (Zlib as any).InflateStream();
				var compressed = (out_str as string).split('').map((char:string)=>char.charCodeAt(0)); // ensure out_str is string
				var decompressed = Array.from(this.decompressStream.decompress(compressed));
				out_str = decompressed.map((charCode: any)=>String.fromCharCode(charCode)).join('');
			} catch(e:any) { this.error('MCCP2 compression disabled because ' + e); this.disableMCCP2(); }
		}
		if ( out_str === false ) { this.inbuf.splice(0,0,left + data_str); break; }
		data_str = left + out_str; left = '';
	}
}

public handleInputText(text: string): void {
	if ( this.textInputFilter ) text = this.textInputFilter.filterInputText(text);
	if ( this.display ) this.display.handleData(text);
}

public readIAC(data: string): string | false {
	if ( data.length < 2 ) { return false; }
	if ( data.charCodeAt(1) === 255 ) { this.display.handleData('\xFF'); return data.substr(2); }
	if ( data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241 ) { return data.substr(2); }
	if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) {
		if ( data.length < 3 ) { return false; }
		var seq = data.substr(0,3); this.debugString('RCVD ' + DecafMUD.debugIAC(seq));
		this.handleIACSimple(seq); return data.substr(3);
	}
	if ( data.charAt(1) === DecafMUD.TN.SB ) {
		var seq = '', l = DecafMUD.TN.IAC + DecafMUD.TN.SE;
		var code = data.charAt(2); data = data.substr(3);
		if ( data.length === 0 ) { return false; }
		while(data.length > 0) {
			var ind = data.indexOf(l); if ( ind === -1 ) { return false; }
			if ( ind > 0 && data.charAt(ind-1) === DecafMUD.TN.IAC ) {
				seq += data.substr(0,ind+1); data = data.substr(ind+1); continue;
			}
			seq += data.substr(0,ind); data = data.substr(ind+2);
			break;
		}
		var dbg = true;
		if ( this.telopt[code] !== undefined && this.telopt[code]._sb !== undefined ) {
			if ( this.telopt[code]._sb(seq) === false ) { dbg = false; }
		}
		if ( dbg ) {
			if ( code === DecafMUD.TN.MSSP && console.groupCollapsed !== undefined ) {
				console.groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
				console.dir(readMSDP(seq)[0]);
				console.groupEnd();
			} else { this.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + code + seq + DecafMUD.TN.IAC + DecafMUD.TN.SE)); }
		}
		return data;
	}
	return data.substr(1);
}

public sendIAC(seq: string): void {
	this.debugString('SENT ' + DecafMUD.debugIAC(seq));
	if ( this.socket ) { this.socket.write(seq); }
}

public handleIACSimple(seq: string): void {
	var t_tn = DecafMUD.TN, o = this.telopt[seq.charAt(2)], c = seq.charAt(2);
	if ( o === undefined ) {
		if ( seq.charAt(1) === t_tn.DO ) { this.sendIAC(t_tn.IAC + t_tn.WONT + c); }
		else if ( seq.charAt(1) === t_tn.WILL ) { this.sendIAC(t_tn.IAC + t_tn.DONT + c); }
		return;
	}
	switch(seq.charAt(1)) {
		case t_tn.DO:   if (!( o._do && o._do() === false )) { this.sendIAC(t_tn.IAC + t_tn.WILL + c); } return;
		case t_tn.DONT: if (!( o._dont && o._dont() === false )) { this.sendIAC(t_tn.IAC + t_tn.WONT + c); } return;
		case t_tn.WILL: if (!( o._will && o._will() === false )) { this.sendIAC(t_tn.IAC + t_tn.DO + c); } return;
		case t_tn.WONT: if (!( o._wont && o._wont() === false )) { this.sendIAC(t_tn.IAC + t_tn.DONT + c); } return;
	}
}

public requestPermission(option: string, prompt: string, callback: (allowed: boolean) => void): void {
	var cur = this.store.get(option);
	if ( cur !== undefined && cur !== null ) { callback.call(this, !!(cur)); return; }
	var decaf = this;
	var closer = function(e?: any) { callback.call(decaf, false); },
		help_allow = function() { decaf.store.set(option, true); callback.call(decaf, true); },
		help_deny = function() { decaf.store.set(option, false); callback.call(decaf, false); };
	if ( this.ui && this.ui.infoBar ) {
		this.ui.infoBar(prompt, 'permission', 0, undefined,
			[['Allow'.tr(this), help_allow], ['Deny'.tr(this), help_deny]], undefined, closer);
		return; }
}

public about(): void {
	var abt = ["DecafMUD v{0} \u00A9 2010 Stendec"];
	abt.push("Updated and improved by Pit from Discworld.");
	abt.push("Further bugfixes and improvements by Waba from MUME.");
	abt.push("https://github.com/MUME/DecafMUD\n");
	abt.push("DecafMUD is a web-based MUD client written in JavaScript, rather" + " than a plugin like Flash or Java, making it load faster and react as" + " you'd expect a website to.\n");
	abt.push("It's easy to customize as well, using simple CSS and JavaScript," + " and free to use and modify, so long as your MU* is free to play!");
	alert(abt.join('\n').tr(this, DecafMUD.version.toString()));
}

public error(text: string): void {
	this.debugString(text, 'error');
	if ( 'console' in window && console.groupCollapsed !== undefined ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Instance State');
		console.dir(this);
		console.groupEnd();
	}
	if ( this.ui && this.ui.splashError(text) ) { return; }
	alert("DecafMUD Error\n\n{0}".tr(this,text));
}

public disableMCCP2(): void {
	this.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.DONT + DecafMUD.TN.COMPRESSv2);
	this.startCompressV2 = false;
	this.decompressStream = undefined;
	this.inbuf = [];
}

// End of DecafMUD class methods
} // End of class DecafMUD

// Assign static plugins after class definition (these are already part of the static plugins object)
(DecafMUD.plugins as any).Encoding.iso88591 = { // Cast to any to assign to plugins
	proper : 'ISO-8859-1',
	decode : function(data: string): [string, string] { return [data,'']; },
	encode : function(data: string): string { return data; }
};

(DecafMUD.plugins as any).Encoding.utf8 = { // Cast to any to assign to plugins
	proper : 'UTF-8',
	decode : function(data: string): [string, string] {
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			var out = '', i=0, l=data.length, c=0, c2=0, c3=0, c4=0; // c2,c3,c4 were not declared before
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) { out += String.fromCharCode(c); }
				else if ( (c > 0xBF) && (c < 0xE0) ) { if ( i+1 >= l ) { break; } out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xDF) && (c < 0xF0) ) { if ( i+2 >= l ) { break; } out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xEF) && (c < 0xF5) ) { if ( i+3 >= l ) { break; } out += String.fromCharCode(((c & 10) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				else { out += String.fromCharCode(c); }
			}
			return [out, data.substr(i)];
		}
	},
	encode : function(data: string): string {
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) { console.dir(err); return data; }
	}
};

// Define iacToWord in the IIFE scope
iacToWord = function(c: string): string {
	var t_tn_ref = DecafMUD.TN;
	switch(c) {
		case t_tn_ref.IAC			: return 'IAC';
		case t_tn_ref.DONT			: return 'DONT';
		case t_tn_ref.DO			: return 'DO';
		case t_tn_ref.WONT			: return 'WONT';
		case t_tn_ref.WILL			: return 'WILL';
		case t_tn_ref.SB			: return 'SB';
		case t_tn_ref.SE			: return 'SE';
		case t_tn_ref.BINARY		: return 'TRANSMIT-BINARY';
		case t_tn_ref.ECHO			: return 'ECHO';
		case t_tn_ref.SUPGA		: return 'SUPPRESS-GO-AHEAD';
		case t_tn_ref.STATUS		: return 'STATUS';
		case t_tn_ref.SENDLOC		: return 'SEND-LOCATION';
		case t_tn_ref.TTYPE		: return 'TERMINAL-TYPE';
		case t_tn_ref.EOR			: return 'END-OF-RECORD';
		case t_tn_ref.NAWS			: return 'NEGOTIATE-ABOUT-WINDOW-SIZE';
		case t_tn_ref.TSPEED		: return 'TERMINAL-SPEED';
		case t_tn_ref.RFLOW		: return 'REMOTE-FLOW-CONTROL';
		case t_tn_ref.AUTH			: return 'AUTH';
		case t_tn_ref.LINEMODE		: return 'LINEMODE';
		case t_tn_ref.NEWENV		: return 'NEW-ENVIRON';
		case t_tn_ref.CHARSET		: return 'CHARSET';
		case t_tn_ref.MSDP			: return 'MSDP';
		case t_tn_ref.MSSP			: return 'MSSP';
		case t_tn_ref.COMPRESS		: return 'COMPRESS';
		case t_tn_ref.COMPRESSv2	: return 'COMPRESSv2';
		case t_tn_ref.MSP			: return 'MSP';
		case t_tn_ref.MXP			: return 'MXP';
		case t_tn_ref.ZMP			: return 'ZMP';
		case t_tn_ref.CONQUEST		: return 'CONQUEST-PROPRIETARY';
		case t_tn_ref.ATCP			: return 'ATCP';
		case t_tn_ref.GMCP			: return 'GMCP';
	}
	let cc = c.charCodeAt(0);
	if ( cc > 15 ) { return cc.toString(16); }
	else { return '0' + cc.toString(16); }
};

// Define readMSDP in the IIFE scope
readMSDP = function(data: string): [any, string] {
	var out:any = {};
	var variable: string | undefined = undefined;
	var val: any; // Declare val here
	var msdp_marker = /[\x01\x02\x03\x04]/;


	while ( data.length > 0 ) {
		var c = data.charCodeAt(0);
		if ( c === 1 ) {
			var ind = data.substr(1).search(msdp_marker);
			if ( ind === -1 ) {
				variable = data.substr(1); data = '';
			} else {
				variable = data.substr(1, ind); data = data.substr(ind+1);
			}
			out[variable] = undefined; continue;
		}
		else if ( c === 4 ) { data = data.substr(1); break; }
		if ( variable === undefined ) { return [out, ''];} // Should not happen with valid MSDP

		if ( c === 2 ) {
			if ( data.charCodeAt(1) === 3 ) {
				var o = readMSDP(data.substr(2)); val = o[0]; data = o[1];
			} else {
				var ind = data.substr(1).search(msdp_marker);
				if ( ind === -1 ) { val = data.substr(1); data = ''; }
				else { val = data.substr(1, ind); data = data.substr(ind+1); }
			}
			if ( out[variable] === undefined ) { out[variable] = val; }
			else if ( typeof out[variable] === 'object' && out[variable].push !== undefined ) { out[variable].push(val); }
			else { out[variable] = [out[variable], val]; }
			continue;
		}
		break;
	}
	return [out, data];
};


// Placeholder for Telopt plugin initializations
// Example: (DecafMUD.plugins as any).Telopt[(DecafMUD.TN as any).TTYPE] = tTTYPE;


})(window);

// Define interfaces used by DecafMUD (can be moved to a .d.ts file later)
// Removed DecafMUDInstance and DecafMUDStatic interfaces from here to rely on decafmud.d.ts
// This should resolve TS2717 and TS2687 errors.
