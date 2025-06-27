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

// Moved to import { TTypeTelopt } from './plugins/telopt/ttype';
// /** Handles the telopt TTYPE. */
// var tTTYPE = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.current = -1; }
// tTTYPE.prototype._dont = tTTYPE.prototype.disconnect = function() { this.current = -1; }
// tTTYPE.prototype._sb = function(data: string) {
// 	if ( data !== (DecafMUD as any).TN.ECHO ) { return; }
// 	this.current = (this.current + 1) % this.decaf.options.ttypes.length;
// 	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.TTYPE + (DecafMUD as any).TN.ECHO + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE));
// 	this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.TTYPE + (DecafMUD as any).TN.IS + this.decaf.options.ttypes[this.current] + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
// 	return false;
// }
// DecafMUD.plugins.Telopt[t.TTYPE] = tTTYPE; // This will be handled after class definition

// Moved to import { EchoTelopt } from './plugins/telopt/echo';
// /** Handles the telopt ECHO. */
// var tECHO = function(this: any, decaf: DecafMUD) { this.decaf = decaf; }
// tECHO.prototype._will = function() {
// 	if ( this.decaf.ui ) { this.decaf.ui.localEcho(false); } }
// tECHO.prototype._wont = tECHO.prototype.disconnect = function() {
// 	if ( this.decaf.ui ) { this.decaf.ui.localEcho(true); } }
// // DecafMUD.plugins.Telopt[t.ECHO] = tECHO;

// Moved to import { NawsTelopt } from './plugins/telopt/naws';
// /** Handles the telopt NAWS. */
// var tNAWS = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.enabled = false; this.last = undefined; }
// tNAWS.prototype._do = function() { this.last = undefined; this.enabled = true;
// 	var n=this; setTimeout(function(){n.send();},0); }
// tNAWS.prototype._dont = tNAWS.prototype.disconnect = function() { this.enabled = false; }
// tNAWS.prototype.send = function() {
// 	if ((!this.decaf.display) || (!this.enabled)) { return; }
// 	var sz = this.decaf.display.getSize();
// 	if ( this.last !== undefined && this.last[0] == sz[0] && this.last[1] == sz[1] ) { return; }
// 	this.last = sz;
// 	var data = String.fromCharCode(Math.floor(sz[0] / 255));
// 	data += String.fromCharCode(sz[0] % 255);
// 	data += String.fromCharCode(Math.floor(sz[1] / 255));
// 	data += String.fromCharCode(sz[1] % 255);
// 	data = (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.NAWS + data.replace(/\xFF/g,'\xFF\xFF') + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE;
// 	this.decaf.sendIAC(data);
// }
// // DecafMUD.plugins.Telopt[t.NAWS] = tNAWS;

// Moved to import { CharsetTelopt } from './plugins/telopt/charset';
// /** Handles the telopt CHARSET. */
// var tCHARSET = function(this: any, decaf: DecafMUD) { this.decaf = decaf; }
// tCHARSET.prototype._dont = function() { return false; }
// tCHARSET.prototype._will = function() { var c = this; setTimeout(function() {
// 	var cs: string[] = [], done: string[] = [];
// 	var enc = c.decaf.options.encoding;
// 	if ( enc !== 'iso88591' && (DecafMUD as any).plugins.Encoding[enc] !== undefined && (DecafMUD as any).plugins.Encoding[enc].proper !== undefined ) {
// 		cs.push((DecafMUD as any).plugins.Encoding[enc].proper);
// 		done.push(enc);
// 	}
// 	for(var i=0;i< c.decaf.options.encoding_order.length;i++) {
// 		var currentEnc = c.decaf.options.encoding_order[i];
// 		if ( (DecafMUD as any).plugins.Encoding[currentEnc] === undefined || (DecafMUD as any).plugins.Encoding[currentEnc].proper === undefined || done.indexOf(currentEnc) !== -1 ) { continue; }
// 		cs.push((DecafMUD as any).plugins.Encoding[currentEnc].proper);
// 		done.push(currentEnc);
// 	}
// 	for(var k in (DecafMUD as any).plugins.Encoding) {
//         if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
// 		    if ( done.indexOf(k) !== -1 || (DecafMUD as any).plugins.Encoding[k].proper === undefined ) { continue; }
// 		    cs.push((DecafMUD as any).plugins.Encoding[k].proper);
//         }
// 	}
// 	c.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + (DecafMUD as any).TN.ECHO + ' ' + cs.join(' ') + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
// },0); }
// tCHARSET.prototype._sb = function(data: string) {
// 	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + data + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE));
// 	if ( data.charCodeAt(0) === 1 ) {
// 		let dataStr = data.substring(1);
// 		if ( dataStr.indexOf('TTABLE ') === 0 ) {
// 			dataStr = dataStr.substring(8); }
// 		var sep = dataStr.charAt(0);
// 		var encodings = dataStr.substring(1).split(sep);
// 		var e: string | undefined, o: string | undefined;
// 		for (var currentEncOrder of this.decaf.options.encoding_order) {
// 			let currentPluginEnc = (DecafMUD as any).plugins.Encoding[currentEncOrder];
// 			if (currentPluginEnc === undefined || currentPluginEnc.proper === undefined)
// 				continue;
// 			if (encodings.includes(currentEncOrder)) {
// 				o = currentEncOrder;
// 				e = currentEncOrder;
// 				break;
// 			}
// 			if (encodings.includes(currentPluginEnc.proper)) {
// 				o = currentPluginEnc.proper;
// 				e = currentEncOrder;
// 				break;
// 			}
// 		}
// 		if (e === undefined) {
// 			for(var i=0; i < encodings.length; i++) {
// 				o = encodings[i];
// 				for(var k in (DecafMUD as any).plugins.Encoding) {
//                     if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
// 					    if ( o === k || o === (DecafMUD as any).plugins.Encoding[k].proper ) {
// 						    e = k;
// 						    break;
// 					    }
//                     }
// 				}
// 				if ( e ) { break; }
// 			}
// 		}
// 		if ( e !== undefined ) {
// 			this.decaf.setEncoding(e);
// 			this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + '\x02' + o + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
// 		} else {
// 			this.decaf.debugString("No encoder for: " + encodings.join(sep));
// 			this.decaf.sendIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.CHARSET + '\x03' + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE);
// 		}
// 	} else if ( data.charCodeAt(0) === 2 ) {
// 		let acceptedEnc = data.substring(1);
// 		var e: string | undefined = undefined;
// 		for(var k in (DecafMUD as any).plugins.Encoding) {
//             if (Object.prototype.hasOwnProperty.call((DecafMUD as any).plugins.Encoding, k)) {
// 			    if ( (DecafMUD as any).plugins.Encoding[k].proper === acceptedEnc ) {
// 				    e = k;
// 				    break;
// 			    }
//             }
// 		}
// 		if ( e !== undefined ) { this.decaf.setEncoding(e); }
// 	}
// 	return false;
// }
// // DecafMUD.plugins.Telopt[t.CHARSET] = tCHARSET;

// Moved to import { CompressV2Telopt } from './plugins/telopt/compressv2';
// /** Handles the telopt COMPRESSv2 (MCCP2) */
// var tCOMPRESSv2 = function(this: any, decaf: DecafMUD) {  // Added this type
// 	// Thanks, https://mudhalla.net/tintin/protocols/mccp/
// 	this.decaf = decaf;
// 	this.decaf.startCompressV2 = false;
// }
// tCOMPRESSv2.prototype._will = function() {
// 	if (this.decaf.options.socket == 'flash') { // Flash support will be removed later
// 		this.decaf.debugString('Flash COMPRESSv2 support has not been implemented');
// 		return false;
// 	}
// 	return true;
// }
// tCOMPRESSv2.prototype._sb = function() {
// 	this.decaf.debugString('RCVD ' + (DecafMUD as any).debugIAC((DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SB + (DecafMUD as any).TN.COMPRESSv2 + (DecafMUD as any).TN.IAC + (DecafMUD as any).TN.SE ));
// 	this.decaf.startCompressV2 = true;
// 	this.decaf.decompressStream = new pako.Inflate({ to: 'string' });
//  }
// // DecafMUD.plugins.Telopt[t.COMPRESSv2] = tCOMPRESSv2;

// DecafMUD.prototype.disableMCCP2 method was moved into the DecafMUD class body.

// readMSDP and writeMSDP are now local to the msdp.ts module.
// All tMSDP related code (var tMSDP, prototype assignments, config_vars) removed.
// Moved to import { MsdpTelopt } from './plugins/telopt/msdp';


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

// DecafMUD.prototype.loadScript, require, waitLoad removed.

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

// DecafMUD.prototype.initSplash, updateSplash, initSocket, initUI, initFinal removed
// as they are now part of the class structure and have been refactored.

DecafMUD.prototype.connect = function() { // This connect and below were outside class, now should be part of class or removed if duplicate
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
DecafMUD.plugins.Telopt[DecafMUD.TN.TTYPE] = TTypeTelopt;
DecafMUD.plugins.Telopt[DecafMUD.TN.ECHO] = EchoTelopt;
DecafMUD.plugins.Telopt[DecafMUD.TN.NAWS] = NawsTelopt;
DecafMUD.plugins.Telopt[DecafMUD.TN.CHARSET] = CharsetTelopt;
DecafMUD.plugins.Telopt[DecafMUD.TN.COMPRESSv2] = CompressV2Telopt;
DecafMUD.plugins.Telopt[DecafMUD.TN.MSDP] = MsdpTelopt;

// Register the converted GMCP plugin
DecafMUD.plugins.Telopt[DecafMUD.TN.GMCP] = GmcpTelopt;

// Register ZMP Telopt plugin
import { ZmpTelopt } from './plugins/telopt/zmp';
DecafMUD.plugins.Telopt[DecafMUD.TN.ZMP] = ZmpTelopt;

// Register Panels Interface plugin
import { PanelsInterface } from './plugins/interface/panels';
DecafMUD.plugins.Interface.panels = PanelsInterface;

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

// DecafMUD.prototype.loaded_plugs = {}; // REMOVED - instance property now

export { DecafMUD, DecafMUD as Decaf }; // Export DecafMUD also as Decaf for backward compatibility if any old script relied on that name.
export { DecafMUD as default }; // Export as default

// Export TN separately for potential direct use by plugins or external tools
export const TN = DecafMUD.TN;

// Add other exports as needed, e.g. extend_obj, inherit etc. if they are to be used by plugins externally
// For now, keeping them module-local.
// export { extend_obj, inherit, iacToWord, readMSDP, writeMSDP };

```
