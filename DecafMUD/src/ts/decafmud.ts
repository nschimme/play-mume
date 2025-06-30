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

// Import Core Plugins
import { StandardDisplay } from './plugins/display/standard';
import { WebSocketSocket } from './plugins/socket/websocket';
import { StandardStorage } from './plugins/storage/standard';
import { SimpleInterface } from './plugins/interface/simple';
import { PanelsInterface } from './plugins/interface/panels';

// Import Telopt Plugins
import { GmcpTelopt } from './plugins/telopt/gmcp';
import { NawsTelopt } from './plugins/telopt/naws';
import { TTypeTelopt } from './plugins/telopt/ttype';
import { EchoTelopt } from './plugins/telopt/echo';
import { CharsetTelopt } from './plugins/telopt/charset';
import { CompressV2Telopt } from './plugins/telopt/compressv2';
import { MsdpTelopt, readMSDP } from './plugins/telopt/msdp';
import { ZmpTelopt } from './plugins/telopt/zmp';

// Import TN constants
import { TN as ImportedTelnetConstants } from './telnetConstants';


// Simple string formatting utility
function formatString(text: string, ...args: any[]): string {
    console.log("[DEBUG DecafMUD.formatString] Called with text:", JSON.stringify(text), "Args:", JSON.stringify(args));
	let s = text;
	if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
		const obj = args[0];
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const pattern = `{${key}}`;
                const replacementValue = obj[key] !== undefined && obj[key] !== null ? obj[key].toString() : "";
                console.log("[DEBUG DecafMUD.formatString keyed pattern]:", pattern, "Replacing with:", replacementValue);
                try {
                    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    s = s.replace(regex, replacementValue);
                } catch (e: any) {
                    console.error("[DEBUG DecafMUD.formatString keyed RegExp FAILED]:", e.message, "Pattern was:", pattern);
                    let parts = s.split(pattern);
                    s = parts.join(replacementValue);
                }
			}
		}
	} else {
		for (let i = 0; i < args.length; i++) {
            const placeholder = `{${i}}`;
            const replacementValue = args[i] !== undefined && args[i] !== null ? args[i].toString() : "";
            console.log("[DEBUG DecafMUD.formatString indexed placeholder]:", placeholder, "Replacing with:", replacementValue);

            if (s.includes(placeholder)) {
                try {
                    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    console.log("[DEBUG DecafMUD.formatString] Testing indexed RegExp construction with pattern:", escapedPlaceholder);
                    const regex = new RegExp(escapedPlaceholder, 'g');
                    console.log("[DEBUG DecafMUD.formatString] Indexed RegExp construction successful for:", escapedPlaceholder);
                    s = s.replace(regex, replacementValue);
                } catch (e: any) {
                    console.error("[DEBUG DecafMUD.formatString] Indexed RegExp FAILED for placeholder:", placeholder, "Error:", e.message);
                    console.log("[DEBUG DecafMUD.formatString] Falling back to string.split().join() for placeholder:", placeholder);
                    let parts = s.split(placeholder);
                    s = parts.join(replacementValue);
                }
            }
		}
	}
	return s;
}

// Object extension utility
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

class DecafMUD {
    public id: number;
    public options: any;
    public settings: any;
    public inbuf: (string | ArrayBuffer | Uint8Array)[];
    public telopt: any;
    public loaded: boolean;
    public connecting: boolean;
    public connected: boolean;
    public timer: any;
    public connect_try: number;
    public ui: any;
    public store: any;
    public storage: any;
    public socket: any;
    public display: any;
    public textInputFilter: any;
    public decompressStream: pako.Inflate | undefined;
    public startCompressV2: boolean;
    public socket_ready: boolean;
    public conn_timer: any;
    public loaded_plugs: any;
    public cconnect_try: number;

    static instances: DecafMUD[] = [];
    static last_id: number = -1;
    static version: any = {
        major: 0, minor: 10, micro: 0, flag: 'beta',
        toString: function() { return this.major + '.' + this.minor + '.' + this.micro + (this.flag ? '-' + this.flag : ''); }
    };
    static options: any = {
        encoding: 'iso88591', socket: 'websocket', storage: 'standard',
        display: 'standard', interface: 'simple', connect_timeout: 5000,
		reconnect_tries: 10, reconnect_delay: 2500,
    };
    static settings: any = {};

    // Define TN first as plugins.Telopt depends on it
    static TN: any = ImportedTelnetConstants;

    static plugins: DecafPlugins = {
        Display: { standard: StandardDisplay },
        Socket: { websocket: WebSocketSocket },
        Storage: { standard: StandardStorage },
        Interface: { simple: SimpleInterface, panels: PanelsInterface },
        Encoding: {}, // Populated later
        Extra: {},
        Telopt: {
            [DecafMUD.TN.GMCP]: GmcpTelopt,
            [DecafMUD.TN.NAWS]: NawsTelopt,
            [DecafMUD.TN.TTYPE]: TTypeTelopt,
            [DecafMUD.TN.ECHO]: EchoTelopt,
            [DecafMUD.TN.CHARSET]: CharsetTelopt,
            [DecafMUD.TN.COMPRESSv2]: CompressV2Telopt,
            [DecafMUD.TN.MSDP]: MsdpTelopt,
            [DecafMUD.TN.ZMP]: ZmpTelopt
        },
        TextInputFilter: {}
    };

    static ESC: string = "\x1B";
    static BEL: string = "\x07";
    static debugIAC = (seq: string): string => {
        let out = "";
        const tnMap: { [key: string]: string } = {};
        for (const name in DecafMUD.TN) {
            if (Object.prototype.hasOwnProperty.call(DecafMUD.TN, name)) {
                tnMap[DecafMUD.TN[name]] = name;
            }
        }

        for (let i = 0; i < seq.length; i++) {
            const char = seq.charAt(i);
            const charCode = seq.charCodeAt(i);

            if (charCode === 255) out += "IAC "; else if (charCode === 254) out += "DONT ";
            else if (charCode === 253) out += "DO "; else if (charCode === 252) out += "WONT ";
            else if (charCode === 251) out += "WILL "; else if (charCode === 250) out += "SB ";
            else if (charCode === 240) out += "SE ";
            else {
                const optionName = tnMap[char];
                if (optionName) {
                    out += optionName + " ";
                } else {
                    out += charCode.toString(16).toUpperCase() + " ";
                }
            }
        }
        return out.trim();
    };
    static formatString = formatString;

    constructor(options?: any) {
        this.options = {};
        extend_obj(this.options, DecafMUD.options);
        if (options !== undefined) {
            if (typeof options !== 'object' || options === null) { throw new Error("The DecafMUD options argument must be an object!"); }
            extend_obj(this.options, options);
        }
        this.settings = {};
        extend_obj(this.settings, DecafMUD.settings);
        this.inbuf = []; this.telopt = {}; this.id = (++DecafMUD.last_id); DecafMUD.instances.push(this);
        this.loaded = false; this.connecting = false; this.connected = false; this.timer = null;
        this.connect_try = 0; this.cconnect_try = 0; this.startCompressV2 = false;
        this.socket_ready = false; this.conn_timer = null; this.loaded_plugs = {};
        this.options.encoding = this.options.encoding || 'iso88591';
        this.options.socket = this.options.socket || 'websocket';
        this.options.storage = this.options.storage || 'standard';
        this.options.display = this.options.display || 'standard';
        this.options.interface = this.options.interface || 'simple';
        this.debugString('Created new instance.', 'info');
        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.id}] Provided Options`); console.dir(this.options); console.groupEnd();
        }
        this.initSplash();
    }

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
        alert(DecafMUD.formatString(abt.join('\n'), DecafMUD.version.toString()));
    }
    debugString(text: string, type?: string, obj?: any) {
        if (typeof window === 'undefined' || !('console' in window) ) { return; }
        if ( type === undefined ) { type = 'debug'; }
        if ( obj !== undefined ) { text = DecafMUD.formatString(text, obj); }
        var st = 'DecafMUD[%d]: %s';
        const con = console as any;
        switch(type) {
            case 'info':	con.info(st, this.id, text); return;
            case 'warn':	con.warn(st, this.id, text); return;
            case 'error':	con.error(st, this.id, text); return;
            default:
                if ( 'debug' in con ) { con.debug(st, this.id, text); return; }
                con.log(st, this.id, text);
        }
    }
    error(text: string) {
        this.debugString(text, 'error');
        if ( typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined ) {
            console.groupCollapsed('DecafMUD['+this.id+'] Instance State');
            console.dir(this);
            console.groupEnd();
        }
        if ( this.ui && this.ui.splashError(text) ) { return; }
        alert(DecafMUD.formatString("DecafMUD Error\n\n{0}", text));
    }

    initSplash() {
        const StoragePlugin = DecafMUD.plugins.Storage[this.options.storage];
        if (!StoragePlugin) { this.error(DecafMUD.formatString(`Storage plugin "${this.options.storage}" not found.`)); return; }
        this.store = new StoragePlugin(this); this.storage = this.store;

        const InterfacePlugin = DecafMUD.plugins.Interface[this.options.interface];
        if (this.options.interface !== undefined && InterfacePlugin) {
            this.debugString(DecafMUD.formatString('Initializing the interface plugin "{0}".', this.options.interface));
            this.ui = new InterfacePlugin(this);
            if (this.ui.initSplash) this.ui.initSplash();
            this.updateSplash(10, "Interface loaded.");
        } else { this.error(DecafMUD.formatString(`Interface plugin "${this.options.interface}" not found or failed to load.`)); return; }
        this.initSocket();
    }

    updateSplash(percentage: number, message?: string) {
        if (!this.ui || !this.ui.updateSplash) { return; }
        this.ui.updateSplash(percentage, message);
    }

    initSocket() {
        this.updateSplash(25, "Storage initialized.");
        if (this.ui && this.ui.load) { this.ui.load(); this.updateSplash(30, "UI loaded."); }
        const SocketPlugin = DecafMUD.plugins.Socket[this.options.socket];
        if (!SocketPlugin) { this.error(DecafMUD.formatString(`Socket plugin "${this.options.socket}" not found.`)); return; }
        this.debugString(DecafMUD.formatString('Creating a socket using the "{0}" plugin.', this.options.socket));
        this.socket = new SocketPlugin(this);
        if (this.socket.setup) this.socket.setup(0);
        this.updateSplash(40, "Socket initialized.");
        this.initUI();
    }

    initUI() {
        const DisplayPlugin = DecafMUD.plugins.Display[this.options.display];
        if (!DisplayPlugin && this.ui) { this.error(DecafMUD.formatString(`Display plugin "${this.options.display}" not found.`)); return; }

        if (this.ui && this.ui.setup) { this.ui.setup(); this.updateSplash(50, "UI setup complete."); }
        this.initFinal();
    }

    initFinal() {
        var textInputFilterCtor, o;
        this.updateSplash(60, "Initializing TELNET extensions...");
        for (var k in DecafMUD.plugins.Telopt) {
            if (Object.prototype.hasOwnProperty.call(DecafMUD.plugins.Telopt, k)) {
                o = (DecafMUD.plugins.Telopt as any)[k];
                if (typeof o === 'function') {
                    this.telopt[k] = new (o as TeloptPluginConstructor)(this);
                } else if (typeof o === 'boolean' || o === undefined) {
                    this.telopt[k] = o;
                } else if (typeof o === 'object' && o !== null && typeof (o as any)._sb === 'function') {
                    this.telopt[k] = o;
                }
            }
        }
        this.updateSplash(75, "TELNET extensions initialized.");

        if (this.options.textinputfilter && DecafMUD.plugins.TextInputFilter) {
            textInputFilterCtor = DecafMUD.plugins.TextInputFilter[this.options.textinputfilter];
            if (textInputFilterCtor) {
                this.textInputFilter = new textInputFilterCtor(this);
                this.updateSplash(85, "Text input filter initialized.");
            } else {
                this.debugString(DecafMUD.formatString(`Text input filter "${this.options.textinputfilter}" not found.`, "warn"));
                this.updateSplash(85, "Text input filter not found (skipped).");
            }
        } else {
            this.updateSplash(85, "No text input filter configured.");
        }

        this.loaded = true;
        if (this.ui && this.ui.endSplash) {
            this.ui.endSplash();
        } else {
            this.updateSplash(100, "Loading complete.");
        }

        if ((!this.options.autoconnect) || (!this.socket_ready)) {
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
        if ( this.ui && this.ui.connecting ) { this.ui.connecting(); }
        var decaf = this;
        this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
        this.socket.connect();
    }
    connectFail() {
        clearTimeout(this.conn_timer);
        this.connect_try += 1;
        if ( this.connect_try > this.options.reconnect_tries ) { return; }
        this.socket.close();
        this.socket.connect();
        var decaf = this;
        this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
    }
    reconnect() {
      this.connect_try++;
        var d = this;
        if ( d.ui && d.ui.connecting ) { d.ui.connecting(); }
        d.socket.connect();
    }
    socketReady() {
        this.debugString("The socket is ready.");
        this.socket_ready = true;
        if ( this.loaded && this.options.autoconnect ) { this.connect(); }
    }
    socketConnected() {
        this.connecting = false; this.connected = true; this.connect_try = 0;
        clearTimeout(this.conn_timer);
        var host = this.socket.host, port = this.socket.port;
        this.debugString(DecafMUD.formatString("The socket has connected successfully to {0}:{1}.",host,port),"info");
        for(var k in this.telopt) {
            if (Object.prototype.hasOwnProperty.call(this.telopt, k)) {
                if ( this.telopt[k] && this.telopt[k].connect ) { this.telopt[k].connect(); }
            }
        }
        if ( this.textInputFilter && this.textInputFilter.connected ) { this.textInputFilter.connected(); }
        if ( this.ui && this.ui.connected ) { this.ui.connected(); }
    }
    socketClosed() {
        clearTimeout(this.conn_timer);
        this.connecting = false; this.connected = false;
        this.debugString("The socket has disconnected.","info");
        for(var k in this.telopt) {
            if (Object.prototype.hasOwnProperty.call(this.telopt, k)) {
                if ( this.telopt[k] && this.telopt[k].disconnect ) { this.telopt[k].disconnect(); }
            }
        }
        this.inbuf = [];
        this.decompressStream = undefined;
        this.startCompressV2 = false;
        if ( this.options.autoreconnect ) {
            this.connect_try++;
            if ( this.connect_try < this.options.reconnect_tries ) {
                if ( this.ui && this.ui.disconnected ) { this.ui.disconnected(true); }
                var d = this;
                var s = this.options.reconnect_delay / 1000;
                if ( this.ui && this.ui.immediateInfoBar && s >= 0.25 ) {
                    this.ui.immediateInfoBar(DecafMUD.formatString("You have been disconnected. Reconnecting in {0} second{1}...", s, (s === 1 ? '' : 's')),
                        'reconnecting', s, undefined,
                        [['Reconnect Now',function(){ clearTimeout(d.timer); d.socket.connect(); }]],
                        undefined, function(){ clearTimeout(d.timer);  });
                }
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
    socketData(data: string | ArrayBuffer | Uint8Array) {
        if (this.decompressStream !== undefined) {
            try {
                let dataToDecompress: Uint8Array | string;
                if (typeof data === 'string') {
                    var arr = new Uint8Array(data.length);
                    for(var i=0; i<data.length; i++) { arr[i] = data.charCodeAt(i); }
                    dataToDecompress = arr;
                } else if (data instanceof ArrayBuffer) {
                    dataToDecompress = new Uint8Array(data);
                } else { dataToDecompress = data; }
                this.decompressStream.push(dataToDecompress, false);
                if (this.decompressStream.err) { throw new Error(this.decompressStream.msg || 'Unknown pako error'); }
            } catch (e: any) {
                this.error(DecafMUD.formatString('MCCP2 compression disabled because {0}', e.message));
                this.disableMCCP2(); return;
            }
        } else { this.inbuf.push(data); }
        if ( this.loaded ) { this.processBuffer(); }
    }
    socketError(data: any,data2: any) {
        this.debugString(DecafMUD.formatString('Socket Err: {0}  d2="{1}"',data,data2),'error');
    }
    getEnc(enc: string): string {
        return enc.replace(/-/g,'').toLowerCase();
    }
    setEncoding(enc: string) {
        let currentEnc = this.getEnc(enc);
        if ( DecafMUD.plugins.Encoding[currentEnc] === undefined ) {
            throw new Error(`"${currentEnc}" isn't a valid encoding scheme, or it isn't loaded.`); }
        this.debugString("Switching to character encoding: " + currentEnc);
        this.options.encoding = currentEnc;
        this.decode = DecafMUD.plugins.Encoding[currentEnc].decode;
        this.encode = DecafMUD.plugins.Encoding[currentEnc].encode;
    }
    sendInput(input: string) {
        if ( !this.socket || !this.socket.connected ) { this.debugString("Cannot send input: not connected"); return; }
        this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));
        if ( this.ui ) { this.ui.displayInput(input); }
    }
    decode(data: string): [string, string] {
        return DecafMUD.plugins.Encoding[this.options.encoding].decode(data);
    }
    encode(data: string): string {
        return DecafMUD.plugins.Encoding[this.options.encoding].encode(data);
    }
    processBuffer() {
        var enc, data_str, ind, out;
        let accumulatedData = "";
        if (this.decompressStream) {
            if (this.decompressStream.result && (this.decompressStream.result as any).length > 0) {
                let chunk = this.decompressStream.result;
                if (typeof chunk !== 'string') { chunk = String.fromCharCode.apply(null, chunk as unknown as number[]); }
                accumulatedData += chunk;
                (this.decompressStream.result as any) = null;
            }
        }
        let stringifiedInbuf = "";
        for (const item of this.inbuf) {
            if (typeof(item) === 'string') { stringifiedInbuf += item; }
            else if (item instanceof Uint8Array) { stringifiedInbuf += Array.from(item).map(charCode=>String.fromCharCode(charCode)).join(''); }
            else if (item instanceof ArrayBuffer) { stringifiedInbuf += Array.from(new Uint8Array(item)).map(charCode=>String.fromCharCode(charCode)).join(''); }
        }
        this.inbuf = [];
        data_str = stringifiedInbuf + accumulatedData;
        var IAC = DecafMUD.TN.IAC, left='';
        while ( data_str.length > 0 ) {
            ind = data_str.indexOf(IAC);
            if ( ind === -1 ) {
                if (this.decompressStream) { this.handleInputText(data_str); data_str = ""; }
                else { enc = this.decode(data_str); this.handleInputText(enc[0]); if (enc[1]) this.inbuf.push(enc[1]); data_str = ""; }
                break;
            } else if ( ind > 0 ) {
                let text_before_iac = data_str.substring(0,ind);
                if (this.decompressStream) { this.handleInputText(text_before_iac); }
                else { enc = this.decode(text_before_iac); this.handleInputText(enc[0]); left = enc[1]; }
                data_str = data_str.substring(ind);
            }
            out = this.readIAC(data_str);
            if (this.startCompressV2 && this.decompressStream && out !== false && typeof out === 'string') {
                try {
                    const outAsBytes = new Uint8Array(out.length);
                    for (let k = 0; k < out.length; k++) { outAsBytes[k] = out.charCodeAt(k); }
                    this.decompressStream.push(outAsBytes, false);
                    if (this.decompressStream.err) { throw new Error(this.decompressStream.msg || 'Unknown pako error'); }
                    let initialDecompressed = this.decompressStream.result;
                    if (typeof initialDecompressed !== 'string') { initialDecompressed = String.fromCharCode.apply(null, initialDecompressed as unknown as number[]); }
                    (this.decompressStream.result as any) = null;
                    out = initialDecompressed;
                    this.startCompressV2 = false;
                } catch (e: any) {
                    this.error(DecafMUD.formatString('MCCP2 compression disabled because {0}', e.message));
                    this.disableMCCP2(); out = '';
                }
            }
            if ( out === false ) { this.inbuf.push(left + data_str); break; }
            data_str = left + (out as string); left = '';
        }
    }
    handleInputText(text: string) {
        if ( this.textInputFilter && this.textInputFilter.filterInputText) { text = this.textInputFilter.filterInputText(text); }
        if ( this.display && this.display.handleData) { this.display.handleData(text); }
    }
    readIAC(data: string): string | false {
        const { TN } = DecafMUD;
        if ( data.length < 2 ) { return false; }
        if ( data.charCodeAt(1) === 255 ) { if(this.display) this.display.handleData('\xFF'); return data.substring(2); }
        else if ( data.charCodeAt(1) === TN.GA.charCodeAt(0) || data.charCodeAt(1) === 241 ) { return data.substring(2); }
        else if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) {
            if ( data.length < 3 ) { return false; }
            var seq = data.substring(0,3);
            this.debugString('RCVD ' + DecafMUD.debugIAC(seq)); this.handleIACSimple(seq); return data.substring(3);
        } else if ( data.charAt(1) === TN.SB ) {
            var seq = '', l_str = TN.IAC + TN.SE; var code = data.charAt(2);
            let current_data = data.substring(3);
            if ( current_data.length === 0 ) { return false; }
            while(current_data.length > 0) {
                var ind = current_data.indexOf(l_str);
                if ( ind === -1 ) { return false; }
                if ( ind > 0 && current_data.charAt(ind-1) === TN.IAC ) {
                    seq += current_data.substring(0,ind+1); current_data = current_data.substring(ind+1); continue;
                }
                seq += current_data.substring(0,ind); current_data = current_data.substring(ind + l_str.length); data = current_data; break;
            }
            var dbg = true;
            if ( this.telopt[code] !== undefined && this.telopt[code]._sb !== undefined ) {
                if ( this.telopt[code]._sb(seq) === false ) { dbg = false; }
            }
            if ( dbg ) {
                if ( code === TN.MSSP && typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined ) {
                    console.groupCollapsed('DecafMUD[' + this.id + ']: RCVD IAC SB MSSP ... IAC SE');
                    console.dir(readMSDP(seq)[0]); console.groupEnd();
                } else { this.debugString('RCVD ' + DecafMUD.debugIAC(TN.IAC + TN.SB + code + seq + TN.IAC + TN.SE)); }
            }
            return data;
        }
        this.debugString('RCVD Unknown IAC sequence: ' + data.charCodeAt(1), 'warn'); return data.substring(1);
    }
    sendIAC(seq: string) {
        this.debugString('SENT ' + DecafMUD.debugIAC(seq)); if ( this.socket ) { this.socket.write(seq); }
    }
    handleIACSimple(seq: string) {
        var t_local = DecafMUD.TN, o = this.telopt[seq.charAt(2)], c = seq.charAt(2);
        if ( o === undefined ) {
            if ( seq.charAt(1) === t_local.DO ) { this.sendIAC(t_local.IAC + t_local.WONT + c); }
            else if ( seq.charAt(1) === t_local.WILL ) { this.sendIAC(t_local.IAC + t_local.DONT + c); }
            return;
        }
        switch(seq.charAt(1)) {
            case t_local.DO: if (!( o._do && o._do() === false )) { this.sendIAC(t_local.IAC + t_local.WILL + c); } return;
            case t_local.DONT: if (!( o._dont && o._dont() === false )) { this.sendIAC(t_local.IAC + t_local.WONT + c); } return;
            case t_local.WILL: if (!( o._will && o._will() === false )) { this.sendIAC(t_local.IAC + t_local.DO + c); } return;
            case t_local.WONT: if (!( o._wont && o._wont() === false )) { this.sendIAC(t_local.IAC + t_local.DONT + c); } return;
        }
    }
    disableMCCP2() {
        this.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.DONT + DecafMUD.TN.COMPRESSv2);
        this.startCompressV2 = false; this.decompressStream = undefined; this.inbuf = [];
    }
    requestPermission(option: string, promptText: string, callback: (allowed: boolean) => void) {
        var cur = this.store.get(option);
        if ( cur !== undefined && cur !== null ) { callback.call(this, !!(cur)); return; }
        var decaf = this;
        var closer = function(e?: any) { callback.call(decaf, false); },
            help_allow = function() { decaf.store.set(option, true); callback.call(decaf, true); },
            help_deny = function() { decaf.store.set(option, false); callback.call(decaf, false); };
        if ( this.ui && this.ui.infoBar ) {
            this.ui.infoBar(promptText, 'permission', 0, undefined,
                [['Allow', help_allow], ['Deny', help_deny]], undefined, closer);
            return;
        }
        callback.call(this, false);
    }
}

interface PluginConstructor { new (decaf: DecafMUD, ...args: any[]): any; }
interface TeloptPluginConstructor {
    new (decaf: DecafMUD): {
        _will?: () => boolean | void; _wont?: () => boolean | void;
        _do?: () => boolean | void; _dont?: () => boolean | void;
        _sb?: (data: string) => boolean | void;
        connect?: () => void; disconnect?: () => void;
        [key: string]: any;
    };
}
interface EncodingPlugin {
    proper: string; decode: (data: string) => [string, string]; encode: (data: string) => string;
    [key: string]: any;
}
interface DecafPlugins {
    Display: { [key: string]: PluginConstructor }; Socket: { [key: string]: PluginConstructor };
    Interface: { [key: string]: PluginConstructor }; Storage: { [key:string]: PluginConstructor };
    Telopt: { [key: string]: TeloptPluginConstructor | boolean | undefined };
    Encoding: { [key: string]: EncodingPlugin }; Extra: { [key: string]: PluginConstructor };
    TextInputFilter?: { [key: string]: PluginConstructor };
}

var t = DecafMUD.TN;
const iac_reg = /\xFF/g;

// Built-in Encoding Plugins are registered directly on DecafMUD.plugins.Encoding
(DecafMUD.plugins.Encoding as any).iso88591 = {
	proper : 'ISO-8859-1',
	decode : function(data: string):[string, string] { return [data,'']; },
	encode : function(data: string):string { return data; }
};
(DecafMUD.plugins.Encoding as any).utf8 = {
	proper : 'UTF-8',
	decode : function(data: string):[string, string] {
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			var out = '', i=0, l=data.length, c = 0;
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) { out += String.fromCharCode(c); }
				else if ( (c > 0xBF) && (c < 0xE0) ) { if ( i+1 > l ) { break; } out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xDF) && (c < 0xF0) ) { if ( i+2 > l ) { break; } out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				else if ( (c > 0xEF) && (c < 0xF5) ) { if ( i+3 > l ) { break; } let charCode = ((c & 7) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63); if (charCode > 0xFFFF) { charCode -= 0x10000; out += String.fromCharCode(0xD800 + (charCode >> 10), 0xDC00 + (charCode & 0x3FF)); } else { out += String.fromCharCode(charCode); }}
                else { out += String.fromCharCode(0xFFFD); }
			}
			return [out, data.substr(i)];
		} },
	encode : function(data: string):string {
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) { console.dir(err); return data; } }
};

export { DecafMUD, DecafMUD as Decaf, DecafPlugins };
export { DecafMUD as default };
export const TN = DecafMUD.TN; // Re-export TN using the static property from DecafMUD class
