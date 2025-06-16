// SPDX-License-Identifier: MIT
import { Inflate } from 'pako'; // Added pako import
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

declare global {
    interface String {
        endsWith(suffix: string): boolean;
        substr_count(needle: string): number;
        tr(decafOrObjOrString?: DecafMUD | any | string, ...args: any[]): string;
    }
     interface Navigator {
        userLanguage?: string;
    }
    // Removed: declare var Zlib: any;
}


// Extend the String prototype with endsWith and substr_count.
if ( String.prototype.endsWith === undefined ) {
        String.prototype.endsWith = function(this: string, suffix: string): boolean {
                var startPos = this.length - suffix.length;
                return startPos < 0 ? false : this.lastIndexOf(suffix, startPos) === startPos;
        }
}

if ( String.prototype.substr_count === undefined ) {
        String.prototype.substr_count = function(this: string, needle: string): number {
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
        Array.prototype.indexOf = function<T>(this: T[], searchElement: T, fromIndex?: number): number {
                if (fromIndex === undefined) { fromIndex = 0; }
                if (fromIndex < 0) { fromIndex = Math.max(0, this.length + fromIndex); }
                for (let i = fromIndex; i < this.length; i++) {
                    if (this[i] === searchElement) { return i; }
                }
                return -1;
        };
}

const arrayFromPolyfill = function<T>(arrayLike: ArrayLike<T>): T[] {
    const arr: T[] = [];
    if (arrayLike == null) {
        return arr;
    }
    for (let i = 0; i < arrayLike.length; i++) {
        arr.push(arrayLike[i]);
    }
    return arr;
};


// Create a function for extending Objects
const extend_obj = function(base: any, obj: any): any {
        for ( var key in obj ) {
            if (obj.hasOwnProperty(key)) {
                var o = obj[key];
                if ( typeof o === 'object' && o !== null && !('nodeType' in o) ) {
                        if ( Array.isArray(o) ) {
                                if ( base[key] === undefined || !Array.isArray(base[key]) ) { base[key] = []; }
                                for(var i=0; i<o.length; i++) {
                                        base[key].push(o[i]);
                                }
                        } else {
                                if ( base[key] === undefined || typeof base[key] !== 'object' || base[key] === null ) { base[key] = {}; }
                                extend_obj(base[key], o);
                        }
                } else {
                        base[key] = o;
                }
            }
        }
        return base;
}

const iac_reg = /\xFF/g;

// Helper functions defined before DecafMUD class
const iacToWord = function(c: string): string {
    const t = DecafMUD.TN;
    switch(c) {
        case t.IAC: return 'IAC'; case t.DONT: return 'DONT'; case t.DO: return 'DO'; case t.WONT: return 'WONT'; case t.WILL: return 'WILL';
        case t.SB: return 'SB'; case t.SE: return 'SE'; case t.BINARY: return 'TRANSMIT-BINARY'; case t.ECHO: return 'ECHO';
        case t.SUPGA: return 'SUPPRESS-GO-AHEAD'; case t.STATUS: return 'STATUS'; case t.SENDLOC: return 'SEND-LOCATION';
        case t.TTYPE: return 'TERMINAL-TYPE'; case t.EOR: return 'END-OF-RECORD'; case t.NAWS: return 'NEGOTIATE-ABOUT-WINDOW-SIZE';
        case t.TSPEED: return 'TERMINAL-SPEED'; case t.RFLOW: return 'REMOTE-FLOW-CONTROL'; case t.AUTH: return 'AUTH';
        case t.LINEMODE: return 'LINEMODE'; case t.NEWENV: return 'NEW-ENVIRON'; case t.CHARSET: return 'CHARSET';
        case t.MSDP: return 'MSDP'; case t.MSSP: return 'MSSP'; case t.COMPRESS: return 'COMPRESS'; case t.COMPRESSv2: return 'COMPRESSv2';
        case t.MSP: return 'MSP'; case t.MXP: return 'MXP'; case t.ZMP: return 'ZMP'; case t.CONQUEST: return 'CONQUEST-PROPRIETARY';
        case t.ATCP: return 'ATCP'; case t.GMCP: return 'GMCP';
    }
    let code = c.charCodeAt(0);
    return code > 15 ? code.toString(16) : '0' + code.toString(16);
};

const readMSDP = function(data: string): [any, string] {
    var out: any = {};
    var variable: string | undefined = undefined;
    const msdp_ctrl = /[\x01\x02\x03\x04]/;

    while ( data.length > 0 ) {
        var c_code = data.charCodeAt(0);
        if ( c_code === 1 ) {
            var ind = data.substr(1).search(msdp_ctrl);
            if ( ind === -1 ) { variable = data.substr(1); data = ''; }
            else { variable = data.substr(1, ind); data = data.substr(ind+1); }
            out[variable] = undefined; continue;
        } else if ( c_code === 4 ) { data = data.substr(1); break; }
        if ( variable === undefined ) { return [out, '']; }
        if ( c_code === 2 ) {
            let val: any;
            if ( data.charCodeAt(1) === 3 ) {
                var o = readMSDP(data.substr(2)); val = o[0]; data = o[1];
            } else {
                var ind = data.substr(1).search(msdp_ctrl);
                if ( ind === -1 ) { val = data.substr(1); data = ''; }
                else { val = data.substr(1, ind); data = data.substr(ind+1); }
            }
            if ( out[variable] === undefined ) { out[variable] = val; }
            else if ( Array.isArray(out[variable]) ) { out[variable].push(val); }
            else { out[variable] = [out[variable], val]; }
            continue;
        }
        break;
    }
    return [out, data];
};

const writeMSDP = function(obj: any): string {
    const t = typeof obj;
    if ( t === 'string' || t === 'number' ) { return obj.toString(); }
    else if ( t === 'boolean' ) { return obj ? '1' : '0'; }
    else if ( t === 'undefined' || obj === null ) { return ''; }
    else if ( t === 'object' ) {
        let out_str = '';
        for(const k in obj) {
            if (obj.hasOwnProperty(k)) {
                if ( obj[k] === undefined || obj[k] === null || typeof obj[k] === 'function' ) { continue; }
                out_str += '\x01' + k;
                if ( typeof obj[k] === 'object' && obj[k] !== null) {
                    if ( Array.isArray(obj[k]) ) {
                        const v = obj[k];
                        for(let i=0; i < v.length; i++) { out_str += '\x02' + writeMSDP(v[i]); }
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


export class DecafMUD {
    static instances: DecafMUD[] = [];
    static last_id: number = -1;

    static version: {major: number, minor: number, micro: number, flag: string, toString: () => string} = {
        major: 0, minor: 10, micro: 0, flag: 'beta',
        toString: function(this: {major: number, minor: number, micro: number, flag: string}){ return this.major+'.'+this.minor+'.'+this.micro+(this.flag ? '-' + this.flag : ''); }
    };

    static ESC: string = "\x1B";
    static BEL: string = "\x07";

    static TN: any = {
        IAC: "\xFF", DONT: "\xFE", DO: "\xFD", WONT: "\xFC", WILL: "\xFB", SB: "\xFA", SE: "\xF0", IS: "\x00", EORc: "\xEF", GA: "\xF9",
        BINARY: "\x00", ECHO: "\x01", SUPGA: "\x03", STATUS: "\x05", SENDLOC: "\x17", TTYPE: "\x18", EOR: "\x19", NAWS: "\x1F", TSPEED: "\x20",
        RFLOW: "\x21", LINEMODE: "\x22", AUTH: "\x23", NEWENV: "\x27", CHARSET: "\x2A", MSDP: "E", MSSP: "F", COMPRESS: "U", COMPRESSv2: "V",
        MSP: "Z", MXP: "[", ZMP: "]", CONQUEST: "^", ATCP: "\xC8", GMCP: "\xC9",
    };

    static plugins: {
        Display: Record<string, any>, Encoding: Record<string, any>, Extra: Record<string, any>, Interface: Record<string, any>,
        Language: Record<string, any>, Socket: Record<string, any>, Storage: Record<string, any>,
        Telopt: Record<string, any>, TextInputFilter: Record<string, any>
    } = {
        Display: {}, Encoding: {}, Extra: {}, Interface: {}, Language: {}, Socket: {}, Storage: {},
        Telopt: {},
        TextInputFilter: {}
    };

    static settings: any = {
        'startup': { '_path': "/", '_desc': "Control what happens when DecafMUD is opened.",
            'autoconnect': { '_type': 'boolean', '_desc': 'Automatically connect to the server.'},
            'autoreconnect': { '_type': 'boolean', '_desc': 'Automatically reconnect when the connection is lost.'}
        },
        'appearance': { '_path': "display/", '_desc': "Control the appearance of the client.",
            'font': { '_type': 'font', '_desc': 'The font to display MUD output in.' }
        }
    };

    static options: any = {
        host: undefined, port: 4000, autoconnect: true, connectonsend: true, autoreconnect: true, connect_timeout: 5000, reconnect_delay: 5000, reconnect_tries: 3,
        storage: 'standard', display: 'standard', encoding: 'utf8', socket: 'flash', interface: 'simple', language: 'autodetect', textinputfilter: '',
        jslocation: undefined, wait_delay: 25, wait_tries: 1000, load_language: true, plugins: [], set_storage: {},
        set_display: { maxscreens: 100, minelements: 10, handlecolor: true, fgclass: 'c', bgclass: 'b', fntclass: 'fnt', inputfg: '-7', inputbg: '-0' },
        set_socket: { policyport: undefined, swf: '/media/DecafMUDFlashSocket.swf', wsport: undefined, wspath: '' },
        set_interface: { container: undefined, start_full: false, mru: true, mru_size: 15, multiline: true, clearonsend: false, focusinput: true, repeat_input: true, blurclass: 'mud-input-blur',
            msg_connect: 'Press Enter to connect and type here...', msg_connecting: 'DecafMUD is attempting to connect...', msg_empty: 'Type commands here, or use the Up and Down arrows to browse your recently used commands.', connect_hint: true
        },
        ttypes: ['decafmud-' + DecafMUD.version.toString(), 'decafmud', 'xterm', 'unknown'],
        environ: {}, encoding_order: ['utf8'], plugin_order: []
    };

    options: any;
    settings: any;
    need: [string, () => boolean][];
    inbuf: string[]; // Changed to string[] as pako will handle Uint8Array conversion
    telopt: any;
    id: number;
    loaded: boolean = false;
    connecting: boolean = false;
    connected: boolean = false;
    loadTimer: any = null;
    timer: any = null;
    connect_try: number = 0;
    required: number = 0;
    ui: any;
    socket: any;
    store: any;
    storage: any;
    socket_ready: boolean = false;
    conn_timer: any = null;
    display: any;
    textInputFilter: any;
    // decompressStream: any; // Removed old Zlib stream
    private pakoInflator: Inflate | undefined; // Added pako inflator
    startCompressV2: boolean = false;
    cconnect_try: number = 0;
    loaded_plugs: any = {};

    decode: (data: string) => [string, string];
    encode: (data: string) => string;


    constructor(options?: any) {
        this.options = {};
        extend_obj(this.options, DecafMUD.options);

        if (options !== undefined) {
            if (typeof options !== 'object' || options === null) { throw "The DecafMUD options argument must be an object!"; }
            extend_obj(this.options, options);
        }

        this.settings = {};
        extend_obj(this.settings, DecafMUD.settings);

        this.need = [];
        this.inbuf = []; // Initialize as string array
        this.telopt = {};

        const initialEncoding = this.options.encoding || 'iso88591';
        const defaultEncoding = DecafMUD.plugins.Encoding[initialEncoding] || DecafMUD.plugins.Encoding.iso88591;
        this.decode = defaultEncoding.decode;
        this.encode = defaultEncoding.encode;
        if (!DecafMUD.plugins.Encoding[initialEncoding]) {
             this.debugString(`Warning: Encoding ${initialEncoding} not found, defaulting to iso88591.`, 'warn');
        }
        this.setEncoding(initialEncoding);


        if (this.options.language === 'autodetect') {
            var lang = typeof navigator !== 'undefined' ? (navigator.language ? navigator.language : (navigator as any).userLanguage) : 'en';
            this.options.language = lang.split('-', 1)[0];
        }

        this.id = (++DecafMUD.last_id);
        DecafMUD.instances.push(this);

        this.debugString('Created new instance.', 'info');

        if (typeof window !== 'undefined' && 'console' in window && (console as any).groupCollapsed) {
            (console as any).groupCollapsed('DecafMUD[' + this.id + '] Provided Options');
            console.dir(this.options);
            console.groupEnd();
        }

        if (this.options.language !== 'en' && this.options.load_language) {
            this.require('decafmud.language.' + this.options.language);
        }
        this.require('decafmud.interface.' + this.options.interface);

        this.waitLoad(this.initSplash.bind(this), this.updateSplash.bind(this));
    }

    private initializePakoInflator(): void {
        if (this.pakoInflator) {
            this.pakoInflator.push(new Uint8Array(0), true); // Finalize existing one if any
        }
        this.pakoInflator = new Inflate({
            to: 'string' // Ensure output is string
        });

        // Type for pako's Data, can be simplified to 'any' if not importing specific types
        type PakoData = Uint8Array | Array<number> | ArrayBuffer | string;

        this.pakoInflator.onData = (chunk: PakoData) => {
            // Since { to: 'string' } is used, pako should provide a string.
            // If it could still be Uint8Array, further checks are needed.
            if (typeof chunk === 'string') {
                this.inbuf.push(chunk);
            } else {
                // This case should ideally not be hit with { to: 'string' }
                // but as a fallback, convert Uint8Array if received.
                // Other types (Array<number>, ArrayBuffer) would need more complex handling.
                let strChunk = "";
                if (chunk instanceof Uint8Array) {
                    for(let i = 0; i < chunk.length; i++) strChunk += String.fromCharCode(chunk[i]);
                } else {
                    this.debugString('Pako onData received unexpected non-string chunk type despite {to: "string"}', 'error');
                    // Potentially handle Array<number> or ArrayBuffer if necessary, or simply ignore/error.
                    // For now, only pushing if it was converted.
                    return;
                }
                this.inbuf.push(strChunk);
            }
            this.processBuffer();
        };

        this.pakoInflator.onEnd = (status: number) => {
            if (status !== 0) { // pako uses 0 for success
                this.error('MCCP2 stream error: pako status ' + status);
                this.disableMCCP2();
            } else {
                this.debugString('MCCP2 stream ended.', 'info');
                // Optionally, could set this.pakoInflator = undefined here if stream is done
                // but disableMCCP2 handles that if server signals end of compression.
            }
        };
    }

    about(): void {
        var abt = ["DecafMUD v{0} \u00A9 2010 Stendec"];
        abt.push("Updated and improved by Pit from Discworld.");
        abt.push("Further bugfixes and improvements by Waba from MUME.");
        abt.push("https://github.com/MUME/DecafMUD\n");
        abt.push("DecafMUD is a web-based MUD client written in JavaScript, rather" +
                " than a plugin like Flash or Java, making it load faster and react as" +
                " you'd expect a website to.\n");
        abt.push("It's easy to customize as well, using simple CSS and JavaScript," +
                " and free to use and modify, so long as your MU* is free to play!");

        const message = abt.join('\n').tr(this, DecafMUD.version.toString());
        if (typeof alert !== 'undefined') {
            alert(message);
        } else {
            if (typeof console !== 'undefined') console.log(message);
        }
    }

    debugString(text: string, type?: string, obj?: any): void {
        if (typeof window === 'undefined' || !('console' in window) ) { return; }
        if (type === undefined) { type = 'debug'; }

        let processedText = text;
        if (obj !== undefined && text.tr) {
             processedText = text.tr(this, obj);
        }

        var st = 'DecafMUD[' + this.id + ']: %s';
        if (typeof console !== 'undefined') {
            if (type === 'info' && console.info) { console.info(st, processedText); }
            else if (type === 'warn' && console.warn) { console.warn(st, processedText); }
            else if (type === 'error' && console.error) { console.error(st, processedText); }
            else if (type === 'debug' && (console as any).debug) { (console as any).debug(st, processedText); }
            else if (console.log) { console.log(st, processedText); }
        }
    }

    error(text: string): void {
        this.debugString(text, 'error');
        if (typeof window !== 'undefined' && 'console' in window && (console as any).groupCollapsed !== undefined) {
            (console as any).groupCollapsed('DecafMUD[' + this.id + '] Instance State');
            console.dir(this);
            console.groupEnd();
        }

        if (this.ui && this.ui.splashError && this.ui.splashError(text)) { return; }

        const message = "DecafMUD Error\n\n" + (text.tr ? text.tr(this) : text);
        if (typeof alert !== 'undefined') {
            alert(message);
        } else {
            if (typeof console !== 'undefined') console.error(message);
        }
    }

    loadScript(filename: string, path?: string): void {
        if (path === undefined) {
            if (this.options.jslocation !== undefined) { path = this.options.jslocation; }
            if (path === undefined || typeof path === 'string' && path.length === 0) {
                if (typeof document !== 'undefined') {
                    var obj = document.querySelector('script[src*="decafmud.js"]') as HTMLScriptElement | null;
                    if (obj === null) {
                        obj = document.querySelector('script[src*="decafmud.min.js"]') as HTMLScriptElement | null;
                    }
                    if (obj !== null && obj.src) {
                        path = obj.src.substr(0, obj.src.lastIndexOf('/') + 1);
                    }
                }
            }
        }

        if (typeof document !== 'undefined' && path !== undefined) {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = path + filename;
            document.getElementsByTagName('head')[0].appendChild(script);
            this.debugString('Loading script: ' + filename);
        } else {
            this.debugString('Cannot load script: ' + filename + ' (document or path undefined)', 'warn');
        }
    }

    require(moduleName: string, check?: () => boolean): void {
        if (this.options.load_language && this.options.language !== 'en' &&
            moduleName.indexOf('language') === -1 && moduleName.indexOf('decafmud') !== -1) {
            var parts = moduleName.split('.');
            parts.splice(1, 0, "language", this.options.language);
            this.require(parts.join('.'));
        }

        if (check === undefined) {
            if (moduleName.toLowerCase().indexOf('decafmud') === 0) {
                var parts = moduleName.split('.');
                if (parts.length < 2) { return; }
                parts.shift();
                parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);

                if (parts[0] === 'Telopt') {
                    for (var k in DecafMUD.TN) {
                        if (parts[1].toUpperCase() === k.toUpperCase()) {
                            parts[1] = DecafMUD.TN[k];
                            break;
                        }
                    }
                }
                check = () => {
                    if ((DecafMUD.plugins as any)[parts[0]] !== undefined) {
                        if (parts.length > 1) {
                            return (DecafMUD.plugins as any)[parts[0]][parts[1]] !== undefined;
                        } else { return true; }
                    }
                    return false;
                };
            } else {
                throw "Can't build checker for non-DecafMUD module!";
            }
        }

        this.required++;
        if (check.call(this)) { this.required--; return; }

        this.loadScript(moduleName + '.js');
        this.need.push([moduleName, check]);
    }

    waitLoad(next: () => void, itemloaded?: (moduleName: string | null | true | undefined, nextModule?: string, perc?: number) => void, tr: number = 0): void {
        clearTimeout(this.loadTimer);

        if (tr > this.options.wait_tries) {
            if (this.need[0] && this.need[0][0].indexOf('language') === -1) {
                this.error("Timed out attempting to load the module: " + this.need[0][0]);
                this.required -= this.need.length;
                this.need = [];
                return;
            } else {
                if (itemloaded && this.need[0]) {
                    itemloaded.call(this, this.need[0][0], this.need.length > 1 ? this.need[1][0] : undefined);
                }
                if (this.need.length > 0) {this.required--; this.need.shift();}
                tr = 0;
            }
        }

        while (this.need.length) {
             if (this.need[0][1].call(this)) {
                if (itemloaded) {
                    itemloaded.call(this, this.need[0][0], this.need.length > 1 ? this.need[1][0] : undefined);
                }
                this.required--;
                this.need.shift();
                tr = 0;
            } else { break; }
        }

        if (this.need.length === 0) {
            next.call(this);
        } else {
            this.loadTimer = setTimeout(() => { this.waitLoad(next, itemloaded, tr + 1); }, this.options.wait_delay);
        }
    }

    initSplash(): void {
        if (this.options.interface !== undefined) {
            this.debugString('Attempting to initialize the interface plugin "' + this.options.interface + '".');
            this.ui = new (DecafMUD.plugins as any).Interface[this.options.interface](this);
            if (this.ui.initSplash) this.ui.initSplash();
        }

        (this as any).extra = 3;

        this.require('decafmud.storage.' + this.options.storage);
        this.require('decafmud.socket.' + this.options.socket);
        this.require('decafmud.encoding.' + this.options.encoding);

        if (this.ui && this.need.length > 0) { this.updateSplash(this.need[0][0], this.need.length > 1 ? this.need[1][0] : undefined, 0); }
        this.waitLoad(this.initSocket.bind(this), this.updateSplash.bind(this));
    }

    updateSplash(moduleName: string | null | true | undefined, nextModule?: string, perc?: number): void {
        if (!this.ui || !this.ui.updateSplash) { return; }
        let current_required_count = this.required + (this as any).extra;
        let current_need_count = this.need.length;

        if (perc === undefined) {
            perc = current_required_count > 0 ? Math.min(100, Math.floor(100 * (current_required_count - current_need_count) / current_required_count )) : 0;
        }

        let message: string | undefined;
        if (moduleName === true) {
            message = nextModule;
        } else if (nextModule !== undefined) {
            if (nextModule.indexOf('decafmud') === 0) {
                const parts = nextModule.split('.');
                message = 'Loading the {0} module "{1}"...'.tr(this, parts[1], parts[2]);
            } else {
                message = 'Loading: {0}'.tr(this, nextModule);
            }
        } else if (perc === 100) {
            message = "Loading complete.".tr(this);
        }
        this.ui.updateSplash(perc, message);
    }

    initSocket(): void {
        (this as any).extra = 1;
        this.store = new (DecafMUD.plugins as any).Storage[this.options.storage](this);
        this.storage = this.store;

        if (this.ui) {
            this.updateSplash(true, "Initializing the user interface...".tr(this));
            if (this.ui.load) this.ui.load();
        }

        this.debugString('Creating a socket using the "' + this.options.socket + '" plugin.');
        this.socket = new (DecafMUD.plugins as any).Socket[this.options.socket](this);
        if (this.socket.setup) this.socket.setup();

        this.waitLoad(this.initUI.bind(this), this.updateSplash.bind(this));
    }

    initUI(): void {
        if (this.ui && this.ui.setup) {
            this.ui.setup();
        }

        for (var i = 0; i < this.options.plugins.length; i++) {
            this.require('decafmud.' + this.options.plugins[i]);
        }
        this.waitLoad(this.initFinal.bind(this), this.updateSplash.bind(this));
    }

    initFinal(): void {
        this.updateSplash(true, "Initializing triggers system...".tr(this));
        this.updateSplash(true, "Initializing TELNET extensions...".tr(this));

        for (var k in DecafMUD.plugins.Telopt) {
            if (DecafMUD.plugins.Telopt.hasOwnProperty(k)) {
                const o = (DecafMUD.plugins as any).Telopt[k];
                if (typeof o === 'function') {
                    this.telopt[k] = new o(this);
                } else {
                    this.telopt[k] = o;
                }
            }
        }

        this.updateSplash(true, "Initializing filters...".tr(this));

        const textInputFilterCtor = (DecafMUD.plugins as any).TextInputFilter[this.options.textinputfilter];
        if (textInputFilterCtor) {
            this.textInputFilter = new textInputFilterCtor(this);
        }

        this.loaded = true;
        if (this.ui && this.ui.endSplash) this.ui.endSplash();

        if ((!this.options.autoconnect) || (!this.socket || !this.socket.ready)) { return; }
        this.connect();
    }

    connect(): void {
        if (this.connecting || this.connected) { return; }
        if (this.socket_ready !== true) {
            this.error("The socket isn't ready yet.");
            return;
        }

        this.connecting = true;
        this.connect_try = 0;
        this.debugString("Attempting to connect...", "info");

        if (this.ui && this.ui.connecting) {
            this.ui.connecting();
        }

        this.conn_timer = setTimeout(() => { this.connectFail(); }, this.options.connect_timeout);
        if (this.socket && this.socket.connect) this.socket.connect();
    }

    connectFail(): void {
        clearTimeout(this.conn_timer);
        this.connect_try++;

        if (this.connect_try > this.options.reconnect_tries) { return; }

        if (this.socket && this.socket.close) this.socket.close();
        if (this.socket && this.socket.connect) this.socket.connect();

        this.conn_timer = setTimeout(() => { this.connectFail(); }, this.options.connect_timeout);
    }

    reconnect(): void {
        this.connect_try++;
        if (this.ui && this.ui.connecting) {
            this.ui.connecting();
        }
        if (this.socket && this.socket.connect) this.socket.connect();
    }

    socketReady(): void {
        this.debugString("The socket is ready.");
        this.socket_ready = true;
        if (this.loaded && this.options.autoconnect) {
            this.connect();
        }
    }

    socketConnected(): void {
        this.connecting = false; this.connected = true; this.connect_try = 0;
        clearTimeout(this.conn_timer);

        var host = this.socket.host, port = this.socket.port;
        this.debugString("The socket has connected successfully to {0}:{1}.".tr(this, host, port), "info");

        for (var k in this.telopt) {
            if (this.telopt.hasOwnProperty(k) && this.telopt[k] && this.telopt[k].connect) {
                this.telopt[k].connect();
            }
        }

        if (this.textInputFilter && this.textInputFilter.connected) {
            this.textInputFilter.connected();
        }

        if (this.ui && this.ui.connected) {
            this.ui.connected();
        }
    }

    socketClosed(): void {
        clearTimeout(this.conn_timer);
        this.connecting = false; this.connected = false;
        this.debugString("The socket has disconnected.", "info");

        for (var k in this.telopt) {
             if (this.telopt.hasOwnProperty(k) && this.telopt[k] && this.telopt[k].disconnect) {
                this.telopt[k].disconnect();
            }
        }
        this.inbuf = [];
        // this.decompressStream = undefined; // Old Zlib
        if (this.pakoInflator) { // Finalize pako stream
            try {
                this.pakoInflator.push(new Uint8Array(0), true);
            } catch (e) { /* ignore errors on close */ }
            this.pakoInflator = undefined;
        }
        this.startCompressV2 = false;

        if (this.options.autoreconnect) {
            this.connect_try++;
            if (this.connect_try < this.options.reconnect_tries) {
                if (this.ui && this.ui.disconnected) {
                    this.ui.disconnected(true);
                }
                var s = this.options.reconnect_delay / 1000;
                if (this.ui && this.ui.immediateInfoBar && s >= 0.25) {
                    this.ui.immediateInfoBar("You have been disconnected. Reconnecting in {0} second{1}...".tr(this, s, (s === 1 ? '' : 's')),
                        'reconnecting',
                        s,
                        undefined,
                        [['Reconnect Now'.tr(this), () => { clearTimeout(this.timer); if (this.socket && this.socket.connect) this.socket.connect(); }]],
                        undefined,
                        () => { clearTimeout(this.timer); }
                    );
                }
                this.timer = setTimeout(() => {
                    this.debugString('Attempting to connect...', 'info');
                    if (this.ui && this.ui.connecting) { this.ui.connecting(); }
                    if (this.socket && this.socket.connect) this.socket.connect();
                }, this.options.reconnect_delay);
                return;
            }
        }
        if (this.ui && this.ui.disconnected) {
            this.ui.disconnected(false);
        }
    }

    socketData(data: string | Uint8Array): void {
        if (this.startCompressV2) {
            if (!this.pakoInflator) {
                this.initializePakoInflator();
            }
            if (this.pakoInflator) {
                try {
                    let dataToPush: Uint8Array;
                    if (typeof data === 'string') {
                        // Convert string to Uint8Array (assuming ISO-8859-1/latin1 for raw bytes)
                        dataToPush = new Uint8Array(data.length);
                        for (let i = 0; i < data.length; i++) {
                            dataToPush[i] = data.charCodeAt(i) & 0xFF;
                        }
                    } else {
                        dataToPush = data;
                    }
                    this.pakoInflator.push(dataToPush, false);
                } catch (e: any) {
                    this.error('MCCP2 stream error: ' + e.message);
                    this.disableMCCP2();
                }
                return; // Data will be processed by pakoInflator.onData
            }
        }

        // If not compressing or pakoInflator not active, handle as plain text
        let stringData: string;
        if (typeof data === 'string') {
            stringData = data;
        } else {
            // Convert Uint8Array to string (assuming default/current encoding or simple char codes)
            // This might need to use this.decode if the Uint8Array represents encoded text
            stringData = "";
            for(let k=0; k < data.length; k++) {
                stringData += String.fromCharCode(data[k]);
            }
        }
        this.inbuf.push(stringData);

        if (this.loaded) {
            this.processBuffer();
        }
    }

    socketError(data: any, data2?: any): void {
        this.debugString('Socket Err: {0}  d2="{1}"'.tr(this, data, data2), 'error');
    }

    getEnc(enc: string): string {
        enc = enc.replace(/-/g, '').toLowerCase();
        return enc;
    }

    setEncoding(enc: string): void {
        enc = this.getEnc(enc);
        if (DecafMUD.plugins.Encoding[enc] === undefined) {
            this.error(`Encoding '${enc}' isn't a valid encoding scheme, or it isn't loaded. Defaulting to iso88591.`);
            enc = 'iso88591';
        }
        this.debugString("Switching to character encoding: " + enc);
        this.options.encoding = enc;
        this.decode = DecafMUD.plugins.Encoding[enc].decode;
        this.encode = DecafMUD.plugins.Encoding[enc].encode;
    }

    sendInput(input: string): void {
        if (!this.socket || !this.socket.connected) {
            this.debugString("Cannot send input: not connected");
            return;
        }
        this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));
        if (this.ui && this.ui.displayInput) {
            this.ui.displayInput(input);
        }
    }

    processBuffer(): void {
        let enc: [string, string];
        let data_str: string;
        let ind: number;
        let out: string | false;

        // Consolidate inbuf to a single string
        data_str = this.inbuf.join('');
        this.inbuf = []; // Clear buffer after joining

        var IAC = DecafMUD.TN.IAC, left = '';

        while (data_str.length > 0) {
            ind = data_str.indexOf(IAC);
            if (ind === -1) {
                enc = this.decode(data_str);
                this.handleInputText(enc[0]);
                if(enc[1]) this.inbuf.splice(0, 0, enc[1]);
                break;
            } else if (ind > 0) {
                enc = this.decode(data_str.substr(0, ind));
                this.handleInputText(enc[0]);
                left = enc[1];
                data_str = data_str.substr(ind);
            }

            out = this.readIAC(data_str);
            // MCCP2 data is now handled by pako in socketData, direct Zlib processing removed here
            if (out === false) { // Not enough data to process IAC sequence
                if(left + data_str) this.inbuf.splice(0, 0, left + data_str);
                break;
            }
            data_str = left + (out as string);
            left = '';
        }
    }

    handleInputText(text: string): void {
        if (this.textInputFilter && this.textInputFilter.filterInputText) {
            text = this.textInputFilter.filterInputText(text);
        }
        if (this.display && this.display.handleData) {
            this.display.handleData(text);
        }
    }

    readIAC(data: string): string | false {
        if (data.length < 2) { return false; }
        const t_IAC = DecafMUD.TN.IAC;
        const t_SB = DecafMUD.TN.SB;
        const t_SE = DecafMUD.TN.SE;

        if (data.charCodeAt(1) === 255) {
            if (this.display && this.display.handleData) this.display.handleData('\xFF');
            return data.substr(2);
        } else if (data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241) {
            return data.substr(2);
        } else if ("\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1) {
            if (data.length < 3) { return false; }
            var seq = data.substr(0, 3);
            this.debugString('RCVD ' + DecafMUD.debugIAC(seq));
            this.handleIACSimple(seq);
            return data.substr(3);
        } else if (data.charAt(1) === t_SB) {
            var seq_data = '', l_seq = t_IAC + t_SE;
            var code = data.charAt(2);
            let current_data = data.substr(3);
            if (current_data.length === 0) { return false; }
            while (current_data.length > 0) {
                var ind = current_data.indexOf(l_seq);
                if (ind === -1) { return false; }
                if (ind > 0 && current_data.charAt(ind - 1) === t_IAC) {
                    seq_data += current_data.substr(0, ind + 1);
                    current_data = current_data.substr(ind + 1);
                    continue;
                }
                seq_data += current_data.substr(0, ind);
                current_data = current_data.substr(ind + l_seq.length);
                break;
            }

            var dbg = true;
            const teloptHandler = this.telopt[code];
            if (teloptHandler !== undefined && typeof teloptHandler === 'object' && teloptHandler._sb !== undefined) {
                if (teloptHandler._sb.call(teloptHandler, seq_data) === false) { dbg = false; }
            }

            if (dbg) {
                 if (code === DecafMUD.TN.MSSP && typeof window !== 'undefined' && 'console' in window && (console as any).groupCollapsed !== undefined ) {
                    (console as any).groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
                    console.dir(readMSDP(seq_data)[0]);
                    console.groupEnd();
                } else {
                    this.debugString('RCVD ' + DecafMUD.debugIAC(t_IAC + t_SB + code + seq_data + t_IAC + t_SE));
                }
            }
            return current_data;
        }
        return data.substr(1);
    }

    sendIAC(seq: string): void {
        this.debugString('SENT ' + DecafMUD.debugIAC(seq));
        if (this.socket && this.socket.write) { this.socket.write(seq); }
    }

    handleIACSimple(seq: string): void {
        var t_tn = DecafMUD.TN;
        var option_char = seq.charAt(2);
        var telopt_handler = this.telopt[option_char];

        if (telopt_handler === undefined || (typeof telopt_handler !== 'object' && typeof telopt_handler !== 'boolean')) {
            if (seq.charAt(1) === t_tn.DO) {
                this.sendIAC(t_tn.IAC + t_tn.WONT + option_char);
            } else if (seq.charAt(1) === t_tn.WILL) {
                this.sendIAC(t_tn.IAC + t_tn.DONT + option_char);
            }
            return;
        }

        if (typeof telopt_handler === 'boolean' && telopt_handler === true) {
            if (seq.charAt(1) === t_tn.DO) this.sendIAC(t_tn.IAC + t_tn.WILL + option_char);
            else if (seq.charAt(1) === t_tn.WILL) this.sendIAC(t_tn.IAC + t_tn.DO + option_char);
            return;
        }

        if (typeof telopt_handler !== 'object' || telopt_handler === null) return;

        switch (seq.charAt(1)) {
            case t_tn.DO:
                if (!(telopt_handler._do && telopt_handler._do.call(telopt_handler) === false)) {
                    this.sendIAC(t_tn.IAC + t_tn.WILL + option_char);
                }
                return;
            case t_tn.DONT:
                if (!(telopt_handler._dont && telopt_handler._dont.call(telopt_handler) === false)) {
                    this.sendIAC(t_tn.IAC + t_tn.WONT + option_char);
                }
                return;
            case t_tn.WILL:
                if (!(telopt_handler._will && telopt_handler._will.call(telopt_handler) === false)) {
                    this.sendIAC(t_tn.IAC + t_tn.DO + option_char);
                }
                return;
            case t_tn.WONT:
                if (!(telopt_handler._wont && telopt_handler._wont.call(telopt_handler) === false)) {
                    this.sendIAC(t_tn.IAC + t_tn.DONT + option_char);
                }
                return;
        }
    }

    requestPermission(option: string, promptText: string, callback: (result: boolean) => void): void {
        if (!this.store) { callback(false); return; }
        var cur = this.store.get(option);
        if (cur !== undefined && cur !== null) {
            callback.call(this, !!(cur));
            return;
        }

        var closer = () => {
            callback.call(this, false);
        };
        var help_allow = () => {
            if (this.store) this.store.set(option, true);
            callback.call(this, true);
        };
        var help_deny = () => {
            if (this.store) this.store.set(option, false);
            callback.call(this, false);
        };

        if (this.ui && this.ui.infoBar) {
            this.ui.infoBar(promptText, 'permission', 0, undefined,
                [['Allow'.tr(this), help_allow], ['Deny'.tr(this), help_deny]], undefined, closer);
            return;
        }
        callback.call(this, false);
    }

    disableMCCP2(): void {
        this.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.DONT + DecafMUD.TN.COMPRESSv2);
        if (this.pakoInflator) {
            try {
                this.pakoInflator.push(new Uint8Array(0), true); // Finalize the stream
            } catch (e) {
                this.debugString('Error finalizing pakoInflator: ' + (e as Error).message, 'warn');
            }
            this.pakoInflator = undefined;
        }
        this.startCompressV2 = false;
        // this.inbuf = []; // Clearing inbuf might be too aggressive if there's uncompressed data pending
    }

    static debugIAC(seq: string): string {
        var out = '', t = DecafMUD.TN, state = 0, st: number | boolean = false, l = seq.length;

        for( var i = 0; i < l; i++ ) {
                var c = seq.charAt(i),
                        cc = c.charCodeAt(0);

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
                else if ( state === 5 ) {
                        if ( c === t.IAC ) {
                                st = false; out += 'IAC ';
                                state = 0;
                        } else {
                                if ( st === false ) { st = cc * 255; }
                                else {
                                        out += (cc + (st as number)).toString() + ' ';
                                        st = false;
                                }
                        }
                        continue;
                }
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
                else if ( state < 2 ) {
                        out += iacToWord(c) + ' '; }

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
}


if (typeof String.prototype.tr === 'undefined') {
    (String as any).logNonTranslated = true && typeof window !== 'undefined' && typeof console !== 'undefined' && console.warn;
    String.prototype.tr = function (this: string, ...args: any[]): string {
        let decaf: DecafMUD | undefined;
        let off: number;
        let s: string = this.toString();
        let lang: string;

        if (args.length > 0 && args[0] instanceof DecafMUD) {
            decaf = args[0];
            off = 1;
        } else if (DecafMUD.instances && DecafMUD.instances.length > 0) {
            decaf = DecafMUD.instances[DecafMUD.instances.length - 1];
            off = 0;
        } else {
            off = 0;
            if (args.length - off === 1 && typeof args[off] === 'object' && args[off] !== null && !(args[off] instanceof DecafMUD)) {
                const obj = args[off];
                for (const i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        s = s.replace('{' + i + '}', obj[i]);
                    }
                }
            } else {
                const replacements = args.slice(off);
                s = s.replace(/{(\d+)}/g, function (m, p1) {
                    const p = parseInt(p1);
                    return p < replacements.length ? replacements[p] : '';
                });
            }
            return s;
        }

        lang = decaf.options.language;
        if (lang === 'en') {
            s = this.toString();
        } else {
            const langPlugins = (DecafMUD.plugins as any).Language;
            if (langPlugins && langPlugins[lang] && langPlugins[lang][this.toString()]) {
                s = langPlugins[lang][this.toString()];
            } else {
                s = this.toString();
            }
        }

        if (args.length - off === 1 && typeof args[off] === 'object' && args[off] !== null && !(args[off] instanceof DecafMUD)) {
            const obj = args[off];
            for (const i in obj) {
                if (obj.hasOwnProperty(i)) {
                    s = s.replace('{' + i + '}', obj[i]);
                }
            }
        } else {
            const replacements = args.slice(off);
            s = s.replace(/{(\d+)}/g, function (m, p1) {
                const p = parseInt(p1);
                return p < replacements.length ? replacements[p] : '';
            });
        }
        return s;
    };
}

var tTTYPE = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.current = -1; } as any;
tTTYPE.prototype._dont = tTTYPE.prototype.disconnect = function() { this.current = -1; }
tTTYPE.prototype._sb = function(data: string) {
    if ( data !== DecafMUD.TN.ECHO ) { return; }
    this.current = (this.current + 1) % this.decaf.options.ttypes.length;
    this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.TTYPE + DecafMUD.TN.ECHO + DecafMUD.TN.IAC + DecafMUD.TN.SE));
    this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.TTYPE + DecafMUD.TN.IS + this.decaf.options.ttypes[this.current] + DecafMUD.TN.IAC + DecafMUD.TN.SE);
    return false;
}

var tECHO = function(this: any, decaf: DecafMUD) { this.decaf = decaf; } as any;
tECHO.prototype._will = function() { if ( this.decaf.ui ) { this.decaf.ui.localEcho(false); } }
tECHO.prototype._wont = tECHO.prototype.disconnect = function() { if ( this.decaf.ui ) { this.decaf.ui.localEcho(true); } }

var tNAWS = function(this: any, decaf: DecafMUD) { this.decaf = decaf; this.enabled = false; this.last = undefined; } as any;
tNAWS.prototype._do = function() { this.last = undefined; this.enabled = true; var n=this; setTimeout(function(){n.send();},0); }
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
    data = DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.NAWS + data.replace(/\xFF/g,'\xFF\xFF') + DecafMUD.TN.IAC + DecafMUD.TN.SE;
    this.decaf.sendIAC(data);
}

var tCHARSET = function(this: any, decaf: DecafMUD) { this.decaf = decaf; } as any;
tCHARSET.prototype._dont = function() { return false; }
tCHARSET.prototype._will = function() { var c = this; setTimeout(function() {
    var cs = [], done: string[] = [];
    var e = c.decaf.options.encoding;
    if ( e !== 'iso88591' && (DecafMUD.plugins as any).Encoding[e] !== undefined && (DecafMUD.plugins as any).Encoding[e].proper !== undefined ) {
        cs.push((DecafMUD.plugins as any).Encoding[e].proper);
        done.push(e);
    }
    for(var i=0;i<c.decaf.options.encoding_order.length;i++) {
        var e_loop = c.decaf.options.encoding_order[i];
        if ( (DecafMUD.plugins as any).Encoding[e_loop] === undefined || (DecafMUD.plugins as any).Encoding[e_loop].proper === undefined || done.indexOf(e_loop) !== -1 ) { continue; }
        cs.push((DecafMUD.plugins as any).Encoding[e_loop].proper);
        done.push(e_loop);
    }
    for(var k in (DecafMUD.plugins as any).Encoding) {
        if ( done.indexOf(k) !== -1 || (DecafMUD.plugins as any).Encoding[k].proper === undefined ) { continue; }
        cs.push((DecafMUD.plugins as any).Encoding[k].proper);
    }
    c.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + DecafMUD.TN.ECHO + ' ' + cs.join(' ') + DecafMUD.TN.IAC + DecafMUD.TN.SE);
},0); }
tCHARSET.prototype._sb = function(data: string) {
    this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + data + DecafMUD.TN.IAC + DecafMUD.TN.SE));
    if ( data.charCodeAt(0) === 1 ) {
        data = data.substr(1);
        if ( data.indexOf('TTABLE ') === 0 ) { data = data.substr(8); }
        var sep = data.charAt(0);
        var data_arr = data.substr(1).split(sep);
        var e_enc: string | undefined, o_opt: string | undefined;
        for (let enc_opt of this.decaf.options.encoding_order) {
            const enc_plugin = (DecafMUD.plugins as any).Encoding[enc_opt];
            if (enc_plugin === undefined || enc_plugin.proper === undefined) continue;
            if (data_arr.indexOf(enc_opt) !== -1) { o_opt = enc_opt; e_enc = enc_opt; break; }
            if (data_arr.indexOf(enc_plugin.proper) !== -1) { o_opt = enc_plugin.proper; e_enc = enc_opt; break; }
        }
        if (e_enc === undefined) {
            for(var i=0;i < data_arr.length; i++) {
                o_opt = data_arr[i];
                for(var k in (DecafMUD.plugins as any).Encoding) {
                    if ( o_opt === k || o_opt === (DecafMUD.plugins as any).Encoding[k].proper ) { e_enc = k; break; }
                }
                if ( e_enc ) { break; }
            }
        }
        if ( e_enc !== undefined && o_opt !== undefined) {
            this.decaf.setEncoding(e_enc);
            this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + '\x02' + o_opt + DecafMUD.TN.IAC + DecafMUD.TN.SE);
        } else {
            this.decaf.debugString("No encoder for: " + data_arr.join(sep));
            this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + '\x03' + DecafMUD.TN.IAC + DecafMUD.TN.SE);
        }
    } else if ( data.charCodeAt(0) === 2 ) {
        data = data.substr(1);
        var e_enc: string | undefined = undefined;
        for(var k in (DecafMUD.plugins as any).Encoding) {
            if ( (DecafMUD.plugins as any).Encoding[k].proper === data ) { e_enc = k; break; }
        }
        if ( e_enc !== undefined ) { this.decaf.setEncoding(e_enc); }
    }
    return false;
}

var tCOMPRESSv2 = function(this: any, decaf: DecafMUD) {
    this.decaf = decaf;
    this.decaf.startCompressV2 = false;
    // Removed: this.decaf.loadScript('inflate_stream.min.js');
} as any;
tCOMPRESSv2.prototype._will = function() {
    if (this.decaf.options.socket == 'flash') { // Currently pako won't work with flash direct byte manipulation
        this.decaf.debugString('Flash COMPRESSv2 support with pako has not been implemented/tested. Disabling.'); return false;
    }
    // No Zlib check needed, pako is imported.
    return true;
}
tCOMPRESSv2.prototype._sb = function() {
    this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.COMPRESSv2 + DecafMUD.TN.IAC + DecafMUD.TN.SE ));
    this.decaf.startCompressV2 = true;
    // Actual pakoInflator initialization is deferred to socketData when first compressed data arrives
}

var tMSDP = function(this: any, decaf: DecafMUD) { this.decaf = decaf; } as any;
tMSDP.prototype.connect = function() { this.commands = ['LIST']; this.variables = []; this.reportable = []; }
tMSDP.config_vars = {
    'CLIENT_NAME'           : 'decafmud',
    'CLIENT_VERSION'        : DecafMUD.version.toString(),
    'PLUGIN_ID'                     : '0',
    'ANSI_COLORS'           : '1',
    'UTF_8'                         : '1',
    'XTERM_256_COLORS'      : '1'
}
tMSDP.prototype._will = function() { var m = this; setTimeout(function() {
    m.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.MSDP + '\x01LIST\x02COMMANDS' + DecafMUD.TN.IAC + DecafMUD.TN.SE);
    m.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.MSDP + '\x01LIST\x02VARIABLES' + DecafMUD.TN.IAC + DecafMUD.TN.SE);
    m.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.MSDP + '\x01LIST\x02CONFIGURABLE_VARIABLES' + DecafMUD.TN.IAC + DecafMUD.TN.SE);
    m.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.MSDP + '\x01LIST\x02REPORTABLE_VARIABLES' + DecafMUD.TN.IAC + DecafMUD.TN.SE);
},0); }
tMSDP.prototype._sb = function(data: string) {
    var out = readMSDP(data)[0], ret = false;
    if ( typeof window !== 'undefined' && 'console' in window && (console as any).groupCollapsed ) {
        (console as any).groupCollapsed('DecafMUD['+this.decaf.id+']: RCVD IAC SB MSDP ... IAC SE');
        console.dir(out);
        console.groupEnd();
    } else { ret = true; }

    if ( out['COMMANDS'] !== undefined ) {
        for(var i=0; i<out['COMMANDS'].length;i++) { this.commands.push(out['COMMANDS'][i]); }
    }
    if ( out['VARIABLES'] !== undefined ) {
        for(var i=0; i<out['VARIABLES'].length;i++) { this.variables.push(out['VARIABLES'][i]); }
    }
    if ( out['CONFIGURABLE_VARIABLES'] !== undefined ) {
        var o = out['CONFIGURABLE_VARIABLES'];
        var ot: any = {};
        for(var i=0;i<o.length;i++) {
            if ( (tMSDP as any).config_vars[o[i]] !== undefined ) { ot[o[i]] = (tMSDP as any).config_vars[o[i]]; }
        }
        this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.MSDP + writeMSDP(ot) + DecafMUD.TN.IAC + DecafMUD.TN.SE);
    }
    return ret;
}

DecafMUD.plugins.Telopt[DecafMUD.TN.TTYPE] = tTTYPE;
DecafMUD.plugins.Telopt[DecafMUD.TN.ECHO] = tECHO;
DecafMUD.plugins.Telopt[DecafMUD.TN.NAWS] = tNAWS;
DecafMUD.plugins.Telopt[DecafMUD.TN.CHARSET] = tCHARSET;
DecafMUD.plugins.Telopt[DecafMUD.TN.COMPRESSv2] = tCOMPRESSv2;
DecafMUD.plugins.Telopt[DecafMUD.TN.MSDP] = tMSDP;
DecafMUD.plugins.Telopt[DecafMUD.TN.BINARY] = true;

if (DecafMUD.plugins.Telopt && typeof DecafMUD.plugins.Telopt === 'object') {
    (DecafMUD.plugins.Telopt as Record<string, any>)[DecafMUD.TN.MSSP] = (typeof window !== 'undefined' && 'console' in window);
}


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
                else if ( (c > 0xBF) && (c < 0xE0) ) { if ( i >= l ) { break; } out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }
                else if ( (c > 0xDF) && (c < 0xF0) ) { if ( i+1 >= l ) { break; } out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
                else if ( (c > 0xEF) && (c < 0xF5) ) { if ( i+2 >= l ) { break; } out += String.fromCharCode(((c & 7) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
                else { out += String.fromCharCode(c); }
            }
            return [out, data.substr(i)];
        }
    },
    encode : function(data: string): string {
        try { return unescape( encodeURIComponent( data ) ); }
        catch(err) { if(typeof console !== 'undefined') console.dir(err); return data; }
    }
};

// Removed Zlib fallback definition
