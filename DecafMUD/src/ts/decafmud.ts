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
import '../scss/decafmud.scss'; // Import DecafMUD's own SCSS

import * as pako from 'pako';
import { GmcpTelopt } from './plugins/telopt/gmcp';
import { StandardDisplay } from './plugins/display/standard';
import { WebSocketSocket } from './plugins/socket/websocket';
import { TTypeTelopt } from './plugins/telopt/ttype';
import { EchoTelopt } from './plugins/telopt/echo';
import { NawsTelopt } from './plugins/telopt/naws';
import { CharsetTelopt } from './plugins/telopt/charset';
import { CompressV2Telopt } from './plugins/telopt/compressv2';
import { MsdpTelopt } from './plugins/telopt/msdp';

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
    // public need: [string, () => boolean][]; // More specific type - REMOVED
    public inbuf: (string | ArrayBuffer | Uint8Array)[]; // More specific type
    public telopt: any;
    public loaded: boolean;
    public connecting: boolean;
    public connected: boolean;
    // public loadTimer: any; // Consider NodeJS.Timeout or number - REMOVED
    public timer: any;     // Consider NodeJS.Timeout or number
    public connect_try: number;
    // public required: number; - REMOVED
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
    // public extra: number; - REMOVED
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

        // this.need = []; // REMOVED
        this.inbuf = [];
        this.telopt = {};

        this.id = (++DecafMUD.last_id);
        DecafMUD.instances.push(this);

        // Initialize other instance properties
        this.loaded = false;
        this.connecting = false;
        this.connected = false;
        // this.loadTimer = null; // REMOVED
        this.timer = null;
        this.connect_try = 0;
        this.cconnect_try = 0; // Assuming this was intended and is same as connect_try for now
        // this.required = 0; // REMOVED
        this.startCompressV2 = false;
        this.socket_ready = false;
        this.conn_timer = null;
        // this.extra = 0; // REMOVED
        this.loaded_plugs = {};

        this.debugString('Created new instance.', 'info');

        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.id}] Provided Options`);
            console.dir(this.options);
            console.groupEnd();
        }

        // All plugins are now imported statically, so we can proceed to initSplash directly.
        // The old require/waitLoad mechanism is being removed.
        this.initSplash();
    }

    // Placeholder for prototype methods that will be moved in later
    // initSplash!: () => void;             // Definition below
    // debugString!: (text: string, type?: string, obj?: any) => void; // Definition below
    // setEncoding!: (enc: string) => void; // Definition below
    // decode!: (data: string) => [string, string]; // Definition below
    // encode!: (data: string) => string; // Definition below
    // disableMCCP2!: () => void; // Definition below
    // readIAC!: (data: string) => string | false; // Definition below
    // handleIACSimple!: (seq: string) => void; // Definition below
    // sendIAC!: (seq: string) => void; // Definition below
    // getEnc!: (enc: string) => string; // Definition below
    // processBuffer!: () => void; // Definition below
    // handleInputText!: (text: string) => void; // Definition below
    // connect!: () => void; // Definition below
    // connectFail!: () => void; // Definition below
    // reconnect!: () => void; // Definition below
    // socketReady!: () => void; // Definition below
    // socketConnected!: () => void; // Definition below
    // socketClosed!: () => void; // Definition below
    // socketData!: (data: string | ArrayBuffer | Uint8Array) => void; // Definition below
    // socketError!: (data: any, data2: any) => void; // Definition below
    // sendInput!: (input: string) => void; // Definition below
    // error!: (text: string) => void; // Definition below
    // updateSplash!: (percentage: number, message?: string) => void; // Definition below - changed signature
    // initSocket!: () => void; // Definition below
    // initUI!: () => void; // Definition below
    // initFinal!: () => void; // Definition below
    // about!: () => void; // Definition below
    // requestPermission!: (option: string, prompt: string, callback: (allowed: boolean) => void) => void; // Definition below

    about() {
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

    debugString(text: string, type?: string, obj?: any) { // Added types
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

    error(text: string) { // Added type
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

    // loadScript, require, waitLoad methods are removed.

    initSplash() {
        // Create the UI.
        if (this.options.interface !== undefined && (DecafMUD as any).plugins.Interface[this.options.interface]) {
            this.debugString(formatString('Initializing the interface plugin "{0}".', this.options.interface));
            this.ui = new (DecafMUD as any).plugins.Interface[this.options.interface](this);
            if (this.ui.initSplash) this.ui.initSplash();
            this.updateSplash(10, "Interface loaded."); // Initial progress
        } else {
            this.error(`Interface plugin "${this.options.interface}" not found or failed to load.`);
            return; // Stop initialization if UI can't load
        }
        // Since plugins are pre-loaded, directly proceed to next initialization step.
        this.initSocket();
    }

    updateSplash(percentage: number, message?: string) { // Signature changed
        if (!this.ui || !this.ui.updateSplash) { return; }
        this.ui.updateSplash(percentage, message);
    }

    initSocket() {
        // Create the master storage object.
        if (!(DecafMUD as any).plugins.Storage[this.options.storage]) {
            this.error(`Storage plugin "${this.options.storage}" not found.`);
            return;
        }
        this.store = new (DecafMUD as any).plugins.Storage[this.options.storage](this);
        this.storage = this.store;
        this.updateSplash(25, "Storage initialized.");

        if (this.ui && this.ui.load) {
            // ui.load() was originally for the UI to load its own dependencies.
            // This might be simplified or removed if all UI assets are bundled/imported directly.
            // For now, call it if it exists, assuming it does synchronous setup.
            this.ui.load();
            this.updateSplash(30, "UI loaded.");
        }

        // Attempt to create the socket.
        if (!(DecafMUD as any).plugins.Socket[this.options.socket]) {
            this.error(`Socket plugin "${this.options.socket}" not found.`);
            return;
        }
        this.debugString(formatString('Creating a socket using the "{0}" plugin.', this.options.socket));
        this.socket = new (DecafMUD as any).plugins.Socket[this.options.socket](this);
        if (this.socket.setup) this.socket.setup(0); // Assuming setup is synchronous
        this.updateSplash(40, "Socket initialized.");

        this.initUI();
    }

    initUI() {
        // Finish setting up the UI.
        if (this.ui && this.ui.setup) {
            this.ui.setup();
            this.updateSplash(50, "UI setup complete.");
        }

        // The old loop for `this.options.plugins` to `this.require` is removed.
        // Essential plugins are expected to be imported and registered statically.
        // Optional/dynamic plugins would need a new loading mechanism if required.

        this.initFinal();
    }

    initFinal() {
        var textInputFilterCtor, o;

        this.updateSplash(60, "Initializing TELNET extensions...");
        for (var k in (DecafMUD as any).plugins.Telopt) { // Cast
            if (Object.hasOwnProperty.call((DecafMUD as any).plugins.Telopt, k)) {
                o = (DecafMUD as any).plugins.Telopt[k];
                if (typeof o === 'function') { // Check if it's a constructor
                    this.telopt[k] = new (o as TeloptPluginConstructor)(this);
                } else if (typeof o === 'boolean' || o === undefined) { // Handle simple boolean flags like BINARY
                    this.telopt[k] = o;
                } else if (typeof o === 'object' && o !== null && typeof (o as any)._sb === 'function') { // Already an instance?
                    this.telopt[k] = o;
                }
            }
        }
        this.updateSplash(75, "TELNET extensions initialized.");

        if (this.options.textinputfilter && (DecafMUD as any).plugins.TextInputFilter) {
            textInputFilterCtor = (DecafMUD as any).plugins.TextInputFilter[this.options.textinputfilter];
            if (textInputFilterCtor) {
                this.textInputFilter = new textInputFilterCtor(this);
                this.updateSplash(85, "Text input filter initialized.");
            } else {
                this.debugString(`Text input filter "${this.options.textinputfilter}" not found.`, "warn");
                this.updateSplash(85, "Text input filter not found (skipped).");
            }
        } else {
            this.updateSplash(85, "No text input filter configured.");
        }


        // We're loaded. Try to connect.
        this.loaded = true;
        if (this.ui && this.ui.endSplash) {
            this.ui.endSplash(); // This will typically set final splash message to 100%
        } else {
            this.updateSplash(100, "Loading complete.");
        }


        if ((!this.options.autoconnect) || (!this.socket_ready)) { // Changed from this.socket.ready
            this.debugString("Autoconnect disabled or socket not ready.", "info");
            return;
        }
        this.connect();
    }

    connect() {
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

    connectFail() {
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

    reconnect() {
      this.connect_try++;
        var d = this;
        if ( d.ui && d.ui.connecting ) {
          d.ui.connecting();
        }
        d.socket.connect();
    }

    socketReady() {
        this.debugString("The socket is ready.");
        this.socket_ready = true;

        if ( this.loaded && this.options.autoconnect ) {
            this.connect();
        }
    }

    socketConnected() {
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

        if ( this.textInputFilter && this.textInputFilter.connected ) {
            this.textInputFilter.connected();
        }

        if ( this.ui && this.ui.connected ) {
            this.ui.connected(); }
    }

    socketClosed() {
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

    socketData(data: string | ArrayBuffer | Uint8Array) {
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

    socketError(data: any,data2: any) {
        this.debugString(formatString('Socket Err: {0}  d2="{1}"',data,data2),'error');
    }

    getEnc(enc: string): string {
        enc = enc.replace(/-/g,'').toLowerCase();
        return enc;
    }

    setEncoding(enc: string) {
        let currentEnc = this.getEnc(enc);
        if ( (DecafMUD as any).plugins.Encoding[currentEnc] === undefined ) {
            throw new Error(`"${currentEnc}" isn't a valid encoding scheme, or it isn't loaded.`); }
        this.debugString("Switching to character encoding: " + currentEnc);
        this.options.encoding = currentEnc;
        this.decode = (DecafMUD as any).plugins.Encoding[currentEnc].decode;
        this.encode = (DecafMUD as any).plugins.Encoding[currentEnc].encode;
    }

    sendInput(input: string) {
        if ( !this.socket || !this.socket.connected ) {
            this.debugString("Cannot send input: not connected");
            return;
        }
        this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));
        if ( this.ui ) {
            this.ui.displayInput(input); }
    }

    decode(data: string): [string, string] { // Default implementation, overridden by setEncoding
        return (DecafMUD as any).plugins.Encoding[this.options.encoding].decode(data);
    }

    encode(data: string): string { // Default implementation, overridden by setEncoding
        return (DecafMUD as any).plugins.Encoding[this.options.encoding].encode(data);
    }

    processBuffer() {
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
                    this.startCompressV2 = false; // Compression starts after this first block
                } catch (e: any) {
                    this.error(formatString('MCCP2 compression disabled because {0}', e.message));
                    this.disableMCCP2();
                    out = ''; // Clear out to prevent processing potentially corrupt data
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

    handleInputText(text: string) {
        if ( this.textInputFilter && this.textInputFilter.filterInputText) {
            text = this.textInputFilter.filterInputText(text);
        }
        if ( this.display && this.display.handleData) {
            this.display.handleData(text);
        }
    }

    readIAC(data: string): string | false {
        const { TN } = (DecafMUD as any);
        if ( data.length < 2 ) { return false; }
        if ( data.charCodeAt(1) === 255 ) { // IAC IAC
            if(this.display) this.display.handleData('\xFF');
            return data.substring(2);
        } else if ( data.charCodeAt(1) === TN.GA.charCodeAt(0) || data.charCodeAt(1) === 241 ) { // GA or old EOR
            return data.substring(2);
        } else if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) { // WILL, WONT, DO, DONT
            if ( data.length < 3 ) { return false; }
            var seq = data.substring(0,3);
            this.debugString('RCVD ' + (DecafMUD as any).debugIAC(seq));
            this.handleIACSimple(seq);
            return data.substring(3);
        } else if ( data.charAt(1) === TN.SB ) { // Subnegotiation
            var seq = '', l_str = TN.IAC + TN.SE;
            var code = data.charAt(2);
            let current_data = data.substring(3);
            if ( current_data.length === 0 ) { return false; } // Not enough data for code + SE
            while(current_data.length > 0) {
                var ind = current_data.indexOf(l_str);
                if ( ind === -1 ) { return false; } // SE not found
                // Handle escaped IAC (IAC IAC SE)
                if ( ind > 0 && current_data.charAt(ind-1) === TN.IAC ) {
                    seq += current_data.substring(0,ind+1); // include the first IAC of IAC IAC
                    current_data = current_data.substring(ind+1); // Continue search after the first IAC
                    continue;
                }
                seq += current_data.substring(0,ind); // content before SE
                current_data = current_data.substring(ind + l_str.length); // The rest of the data
                data = current_data; // Update data to be the remainder
                break;
            }
            var dbg = true; // Debug by default
            if ( this.telopt[code] !== undefined && this.telopt[code]._sb !== undefined ) {
                if ( this.telopt[code]._sb(seq) === false ) { dbg = false; }
            }
            if ( dbg ) { // Log if not handled or if handler didn't return false
                if ( code === TN.MSSP && typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined ) {
                    console.groupCollapsed(`DecafMUD[${this.id}]: RCVD IAC SB MSSP ... IAC SE`);
                    console.dir(readMSDP(seq)[0]);
                    console.groupEnd();
                } else {
                    this.debugString('RCVD ' + (DecafMUD as any).debugIAC(TN.IAC + TN.SB + code + seq + TN.IAC + TN.SE));
                }
            }
            return data; // Return the rest of the buffer
        }
        // Unknown IAC sequence, skip the IAC byte and continue.
        this.debugString('RCVD Unknown IAC sequence: ' + data.charCodeAt(1), 'warn');
        return data.substring(1);
    }

    sendIAC(seq: string) {
        this.debugString('SENT ' + (DecafMUD as any).debugIAC(seq));
        if ( this.socket ) { this.socket.write(seq); }
    }

    handleIACSimple(seq: string) {
        var t_local = (DecafMUD as any).TN, o = this.telopt[seq.charAt(2)],
            c = seq.charAt(2);
        if ( o === undefined ) { // We don't support this option
            if ( seq.charAt(1) === t_local.DO ) { // They said DO, we say WONT
                this.sendIAC(t_local.IAC + t_local.WONT + c); }
            else if ( seq.charAt(1) === t_local.WILL ) { // They said WILL, we say DONT
                this.sendIAC(t_local.IAC + t_local.DONT + c); }
            return;
        }

        // We have a handler for this option
        switch(seq.charAt(1)) {
            case t_local.DO:
                if (!( o._do && o._do() === false )) { // If no _do or _do didn't return false
                    this.sendIAC(t_local.IAC + t_local.WILL + c); } // We say WILL
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

    disableMCCP2() {
        this.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.DONT + (DecafMUD as any).TN.COMPRESSv2);
        this.startCompressV2 = false;
        this.decompressStream = undefined; // Ensures pako instance is cleared
        this.inbuf = []; // Clear input buffer as it might contain compressed data
    }

    requestPermission(option: string, promptText: string, callback: (allowed: boolean) => void) {
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
            this.ui.infoBar(promptText, 'permission', 0, undefined, // Changed prompt to promptText
                [['Allow', help_allow], ['Deny', help_deny]], undefined, closer);
            return; }
        // Fallback if no UI infobar (e.g. confirm or always deny)
        // For now, let's default to denying if no UI for permission.
        callback.call(this, false);
    }
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

// DecafMUD.prototype.loaded_plugs = {}; // REMOVED - instance property now

export { DecafMUD, DecafMUD as Decaf }; // Export DecafMUD also as Decaf for backward compatibility if any old script relied on that name.
export { DecafMUD as default }; // Export as default

// Export TN separately for potential direct use by plugins or external tools
export const TN = DecafMUD.TN;

// Add other exports as needed, e.g. extend_obj, inherit etc. if they are to be used by plugins externally
// For now, keeping them module-local.
// export { extend_obj, inherit, iacToWord, readMSDP, writeMSDP };

```
