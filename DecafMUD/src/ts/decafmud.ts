/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

// TODO: Move these prototype extensions to a separate utility file or handle as global augmentations
if ( String.prototype.endsWith === undefined ) {
	/** Determine if a string ends with the given suffix.
	 * @example
	 * if ( "some string".endsWith("ing") ) {
	 *   // Something Here!
	 * }
	 * @param {String} suffix The suffix to test.
	 * @returns {boolean} true if the string ends with the given suffix */
	String.prototype.endsWith = function(suffix: string): boolean {
		var startPos = this.length - suffix.length;
		return startPos < 0 ? false : this.lastIndexOf(suffix, startPos) === startPos;
	}
}

if ( String.prototype.substr_count === undefined ) {
	/** Count the number of times a specific string occures within a larger
	 *  string.
	 * @example
	 * "This is a test of a fishy function for string counting.".substr_count("i");
	 * // Returns: 6
	 * @param {String} needle The text to search for.
	 * @returns {Number} The number of matches found. */
	String.prototype.substr_count = function(needle: string): number {
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
	Array.prototype.indexOf = function<T>(text: T, i?: number): number {
		if ( i === undefined ) { i = 0; }
		for(;i<this.length;i++){if(this[i]===text){return i;}}
		return -1;
	}
}

// Helper function for extending objects
const extend_obj = function(base: any, obj: any): any {
	for ( var key in obj ) {
		var o = obj[key];
		if ( typeof o === 'object' && !('nodeType' in o) ) {
			if ( o.push !== undefined ) { // Check if it's an array
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

export interface DecafMUDOptions {
    host?: string;
    port?: number;
    autoreconnect?: boolean;
    autoconnect?: boolean;
    set_socket?: any; // TODO: Define specific type
    interface?: string;
    set_interface?: any; // TODO: Define specific type
    language?: string;
    textinputfilter?: string;
    socket?: string;
    jslocation?: string;
    wait_delay?: number;
    wait_tries?: number;
    load_language?: boolean;
    plugins?: string[];
    set_storage?: any; // TODO: Define specific type
    set_display?: any; // TODO: Define specific type
    ttypes?: string[];
    environ?: any; // TODO: Define specific type
    encoding_order?: string[];
    plugin_order?: string[];
    encoding?: string; // Added based on usage
    storage?: string; // Added based on usage
    display?: string; // Added based on usage
    connect_timeout?: number; // Added based on usage
    reconnect_delay?: number; // Added based on usage
    reconnect_tries?: number; // Added based on usage
    connectonsend?: boolean; // Added from original options
}

export interface DecafMUDSettings {
    startup?: {
        _path?: string;
        _desc?: string;
        autoconnect?: {
            _type?: string;
            _desc?: string;
        };
        autoreconnect?: {
            _type?: string;
            _desc?: string;
        };
    };
    appearance?: {
        _path?: string;
        _desc?: string;
        font?: {
            _type?: string;
            _desc?: string;
        };
    };
}

// TODO: Define these interfaces more completely
export interface DecafMUDPlugin {
    // Common plugin methods/properties can be defined here
    [key: string]: any;
}

export interface DecafMUDTeloptHandler {
    connect?(): void;
    disconnect?(): void;
    _will?(): boolean | void;
    _wont?(): boolean | void;
    _do?(): boolean | void;
    _dont?(): boolean | void;
    _sb?(data: string): boolean | void;
    [key: string]: any;
}

export interface DecafMUDInterface extends DecafMUDPlugin {
    initSplash(): void;
    updateSplash(perc: number, next_mod?: string): void;
    endSplash(): void;
    load(): void;
    setup(): void;
    displayInput(input: string): void;
    localEcho(enable: boolean): void;
    connecting?(): void;
    connected?(): void;
    disconnected?(reconnecting: boolean): void;
    splashError?(text: string): boolean;
    // Signature to match PanelsInterface implementation
    infoBar?(message: string, type?: string, duration?: number, icon?: string, buttons?: [string, (e: Event) => void][], onClick?: (e: Event) => void, onClose?: (e: Event) => void): void;
    immediateInfoBar?(message: string, type?: string, duration?: number, icon?: string, buttons?: [string, (e: Event) => void][], onClick?: (e: Event) => void, onClose?: (e: Event) => void): boolean | void; // PanelsInterface returns boolean
}

export interface DecafMUDSocket extends DecafMUDPlugin {
    host?: string;
    port?: number;
    ready: boolean;
    connected: boolean;
    setup(num: number): void;
    connect(): void;
    close(): void;
    write(data: string): void;
}

export interface DecafMUDStorage extends DecafMUDPlugin {
    get(key: string): any;
    set(key: string, value: any): void;
}

export interface DecafMUDDisplay extends DecafMUDPlugin {
    handleData(text: string): void;
    getSize?(): [number, number];
    message?(text: string, type: string): void;
}

export interface DecafMUDEncoding {
    proper: string;
    decode(data: string): [string, string];
    encode(data: string): string;
}

export interface DecafMUDTextInputFilter {
    filterInputText(text: string): string;
    connected(): void;
}


export class DecafMUD {
    // Static properties
    static instances: DecafMUD[] = [];
    static last_id: number = -1;
    static version = {
        major: 0, minor: 10, micro: 0, flag: 'beta',
        toString: function() { return this.major + '.' + this.minor + '.' + this.micro + (this.flag ? '-' + this.flag : ''); }
    };

    static plugins: {
        Display: { [key: string]: new (decaf: DecafMUD) => DecafMUDDisplay };
        Encoding: { [key: string]: DecafMUDEncoding };
        Extra: { [key: string]: new (decaf: DecafMUD) => DecafMUDPlugin }; // Or specific type if known
        Interface: { [key: string]: new (decaf: DecafMUD) => DecafMUDInterface };
        Language: { [key: string]: { [key: string]: string } }; // Language packs
        Socket: { [key: string]: new (decaf: DecafMUD) => DecafMUDSocket };
        Storage: { [key: string]: new (decaf: DecafMUD) => DecafMUDStorage };
        Telopt: { [key: string]: (new (decaf: DecafMUD) => DecafMUDTeloptHandler) | boolean | string };
        TextInputFilter: { [key: string]: new (decaf: DecafMUD) => DecafMUDTextInputFilter };
    } = {
        Display: {},
        Encoding: {},
        Extra: {},
        Interface: {},
        Language: {},
        Socket: {},
        Storage: {},
        Telopt: {},
        TextInputFilter: {}
    };

    static TN = {
        // Negotiation Bytes
        IAC: "\xFF", // 255
        DONT: "\xFE", // 254
        DO: "\xFD", // 253
        WONT: "\xFC", // 252
        WILL: "\xFB", // 251
        SB: "\xFA", // 250
        SE: "\xF0", // 240
        IS: "\x00", // 0
        // END-OF-RECORD Marker / GO-AHEAD
        EORc: "\xEF", // 239
        GA: "\xF9", // 249
        // TELNET Options
        BINARY: "\x00", // 0
        ECHO: "\x01", // 1
        SUPGA: "\x03", // 3
        STATUS: "\x05", // 5
        SENDLOC: "\x17", // 23
        TTYPE: "\x18", // 24
        EOR: "\x19", // 25
        NAWS: "\x1F", // 31
        TSPEED: "\x20", // 32
        RFLOW: "\x21", // 33
        LINEMODE: "\x22", // 34
        AUTH: "\x23", // 35
        NEWENV: "\x27", // 39
        CHARSET: "\x2A", // 42
        MSDP: "E", // 69
        MSSP: "F", // 70
        COMPRESS: "U", // 85
        COMPRESSv2: "V", // 86
        MSP: "Z", // 90
        MXP: "[", // 91
        ZMP: "]", // 93
        CONQUEST: "^", // 94
        ATCP: "\xC8", // 200
        GMCP: "\xC9" // 201
    };

    static ESC = "\x1B";
    static BEL = "\x07";

    static settings: DecafMUDSettings = {
        startup: {
            _path: "/",
            _desc: "Control what happens when DecafMUD is opened.",
            autoconnect: { _type: 'boolean', _desc: 'Automatically connect to the server.' },
            autoreconnect: { _type: 'boolean', _desc: 'Automatically reconnect when the connection is lost.' }
        },
        appearance: {
            _path: "display/",
            _desc: "Control the appearance of the client.",
            font: { _type: 'font', _desc: 'The font to display MUD output in.' }
        }
    };

    static options: DecafMUDOptions = {
        host: undefined,
        port: 4000,
        autoconnect: true,
        connectonsend: true,
        autoreconnect: true,
        connect_timeout: 5000,
        reconnect_delay: 5000,
        reconnect_tries: 3,
        storage: 'standard',
        display: 'standard',
        encoding: 'utf8',
        socket: 'flash',
        interface: 'simple',
        language: 'autodetect',
        textinputfilter: '',
        jslocation: undefined,
        wait_delay: 25,
        wait_tries: 1000,
        load_language: true,
        plugins: [],
        set_storage: {},
        set_display: {
            maxscreens  : 100,
            minelements : 10,
            handlecolor	: true,
            fgclass		: 'c',
            bgclass		: 'b',
            fntclass	: 'fnt',
            inputfg		: '-7',
            inputbg		: '-0'
        },
        set_socket: {
            policyport: undefined,
            swf: '/media/DecafMUDFlashSocket.swf',
            wsport: undefined,
            wspath: '',
        },
        set_interface: {
            container: undefined,
            start_full: false,
            mru: true,
            mru_size: 15,
            multiline: true,
            clearonsend: false,
            focusinput: true,
            repeat_input: true,
            blurclass: 'mud-input-blur',
            msg_connect: 'Press Enter to connect and type here...',
            msg_connecting: 'DecafMUD is attempting to connect...',
            msg_empty: 'Type commands here, or use the Up and Down arrows to browse your recently used commands.',
            connect_hint: true
        },
        ttypes: ['decafmud-' + DecafMUD.version.toString(), 'decafmud', 'xterm', 'unknown'],
        environ: {},
        encoding_order: ['utf8'],
        plugin_order: []
    };

    // Instance properties
    options: DecafMUDOptions;
    settings: DecafMUDSettings;
    id: number;
    loaded: boolean = false;
    connecting: boolean = false;
    connected: boolean = false;
    loadTimer: any = null; // Consider using NodeJS.Timeout or number for browser
    timer: any = null; // Consider using NodeJS.Timeout or number for browser
    connect_try: number = 0;
    required: number = 0;

    need: ([string, (() => boolean)?] | string)[] = [];
    inbuf: (string | Uint8Array)[] = []; // Updated to reflect usage in processBuffer
    telopt: { [key: string]: DecafMUDTeloptHandler | boolean | string } = {}; // More specific type

    ui?: DecafMUDInterface;
    socket?: DecafMUDSocket;
    storage?: DecafMUDStorage;
    display?: DecafMUDDisplay;
    textInputFilter?: DecafMUDTextInputFilter;

    // For MCCP2
    decompressor: Inflate | null = null; // For pako Inflate instance
    isCompressed: boolean = false; // Flag if compression is active
    startCompressV2: boolean = false; // Original flag, may be redundant now but kept for logic flow if needed

    // For socket readiness
    socket_ready: boolean = false;
    conn_timer: any = null; // Timer for connection attempts

    // For splash screen updates
    extra: number = 0;


    constructor(options?: DecafMUDOptions) {
        this.options = {} as DecafMUDOptions;
        extend_obj(this.options, DecafMUD.options);

        if (options !== undefined) {
            if (typeof options !== 'object') { throw "The DecafMUD options argument must be an object!"; }
            extend_obj(this.options, options);
        }

        this.settings = {} as DecafMUDSettings;
        extend_obj(this.settings, DecafMUD.settings);

        this.id = (++DecafMUD.last_id);
        DecafMUD.instances.push(this);

        this.debugString('Created new instance.', 'info');

        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed('DecafMUD[' + this.id + '] Provided Options');
            console.dir(this.options);
            console.groupEnd();
        }

        if (this.options.language === 'autodetect') {
            const lang = typeof navigator !== 'undefined' ? (navigator.language ? navigator.language : (navigator as any).userLanguage) : 'en';
            this.options.language = lang.split('-', 1)[0];
        }

        // Initial plugin loading (language and interface)
        if (this.options.language !== 'en' && this.options.load_language) {
            this.require('decafmud.language.' + this.options.language);
        }
        this.require('decafmud.interface.' + (this.options.interface || 'simple'));


        this.waitLoad(this.initSplash);
    }

    // --- Instance Methods ---

    debugString(text: string, type: string = 'debug', obj?: any): void {
        if (typeof window === 'undefined' || !('console' in window)) { return; }

        if (obj !== undefined) { text = this.tr(text, obj); } // Assuming tr is available or will be defined

        const st = 'DecafMUD[%d]: %s';
        switch (type) {
            case 'info': console.info(st, this.id, text); return;
            case 'warn': console.warn(st, this.id, text); return;
            case 'error': console.error(st, this.id, text); return;
            default:
                if ('debug' in console) {
                    (console as any).debug(st, this.id, text);
                    return;
                }
                // Fallback to console.log if debug is not available
                if (typeof window !== 'undefined' && window.console && typeof window.console.log === 'function') {
                    window.console.log(st, this.id, text);
                }
        }
    }

    error(text: string): void {
        this.debugString(text, 'error');

        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed !== undefined) {
            console.groupCollapsed('DecafMUD[' + this.id + '] Instance State');
            console.dir(this);
            console.groupEnd();
        }

        if (this.ui && this.ui.splashError && this.ui.splashError(this.tr(text))) { return; }
        alert("DecafMUD Error\n\n" + this.tr(text));
    }

    tr(text: string, ...args: any[]): string {
        // Simplified translation logic for now, assuming English or direct passthrough
        // TODO: Implement full translation logic if DecafMUD.plugins.Language is populated
        let s = text;
        if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            const obj = args[0];
            for (const i in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, i)) {
                    s = s.replace(new RegExp('{' + i + '}', 'g'), obj[i]);
                }
            }
        } else {
            s = s.replace(/{(\d+)}/g, (match, p1) => {
                const index = parseInt(p1, 10);
                return index < args.length ? args[index] : match;
            });
        }
        return s;
    }

    loadScript(filename: string, path?: string): void {
        if (typeof document === 'undefined') {
            this.debugString(`Skipping loadScript in non-browser environment: ${filename}`, 'warn');
            return;
        }

        if (path === undefined) {
            if (this.options.jslocation !== undefined) { path = this.options.jslocation; }
            if (path === undefined || typeof path === 'string' && path.length === 0) {
                const scripts = document.getElementsByTagName('script');
                for (let i = 0; i < scripts.length; i++) {
                    const src = scripts[i].src;
                    if (src.includes('decafmud.js') || src.includes('decafmud.min.js')) {
                        path = src.substring(0, src.lastIndexOf('/') + 1);
                        break;
                    }
                }
            }
        }
        path = path || ''; // Ensure path is a string

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = path + filename;
        document.getElementsByTagName('head')[0].appendChild(script);
        this.debugString('Loading script: ' + filename);
    }

    require(moduleName: string, check?: () => boolean): void {
        if (this.options.load_language && this.options.language !== 'en' &&
            moduleName.indexOf('language') === -1 && moduleName.indexOf('decafmud') !== -1) {
            const parts = moduleName.split('.');
            parts.splice(1, 0, "language", this.options.language!);
            this.require(parts.join('.'));
        }

        if (check === undefined) {
            if (moduleName.toLowerCase().indexOf('decafmud') === 0) {
                const parts = moduleName.split('.');
                if (parts.length < 2) { return; } // Already have DecafMUD
                parts.shift(); // remove "decafmud"
                const mainPart = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

                let currentPluginSection: any = DecafMUD.plugins;
                if (mainPart === 'Telopt' && parts.length > 1) {
                     // Special handling for Telopt: parts[1] is the Telnet code (e.g., TTYPE, NAWS)
                    const teloptKey = (DecafMUD.TN as any)[parts[1].toUpperCase()];
                    check = () => teloptKey !== undefined && (DecafMUD.plugins.Telopt as any)[teloptKey] !== undefined;
                } else {
                    check = () => {
                        let base = (DecafMUD.plugins as any)[mainPart];
                        if (!base) return false;
                        if (parts.length > 1) {
                            return base[parts[1]] !== undefined;
                        }
                        return true;
                    };
                }
            } else {
                // For non-DecafMUD modules, a check function must be provided if auto-detection isn't possible.
                // Or, we can assume it's loaded via other means (e.g. import statement if it were a TS module)
                this.debugString(`Cannot build checker for non-DecafMUD module: ${moduleName}. Assuming loaded or check function will be provided.`, 'warn');
                // For now, let's assume if no check, it's an external script that will announce itself.
                // To make it proceed, we can just return if no check can be made.
                // This part needs careful handling based on how these external modules are meant to be loaded.
                // For this conversion, we'll primarily focus on DecafMUD's own plugins.
                return;
            }
        }

        this.required++;
        if (check && check.call(this)) { this.required--; return; } // Already loaded

        this.loadScript(moduleName + '.js');
        this.need.push([moduleName, check]);
    }

    waitLoad(next: () => void, itemloaded?: (moduleName: string | null, nextModule?: string, perc?: number) => void, tr: number = 0): void {
        clearTimeout(this.loadTimer);

        if (tr > this.options.wait_tries!) {
            if (this.need.length > 0 && typeof this.need[0] !== 'string' && this.need[0][0].indexOf('language') === -1) {
                this.error(`Timed out attempting to load the module: ${this.need[0][0]}`);
                return;
            } else if (this.need.length > 0) { // Language file timeout, try to proceed
                if (itemloaded && typeof this.need[0] !== 'string') {
                    itemloaded.call(this, this.need[0][0], this.need.length > 1 && typeof this.need[1] !== 'string' ? this.need[1][0] : undefined);
                }
                this.need.shift();
                tr = 0;
            }
        }

        while (this.need.length) {
            const currentNeed = this.need[0];
            if (typeof currentNeed === 'string') { // Placeholder string
                this.need.shift();
            } else {
                const [moduleName, checkFn] = currentNeed;
                if (checkFn && checkFn.call(this)) {
                    if (itemloaded) {
                        itemloaded.call(this, moduleName, this.need.length > 1 && typeof this.need[1] !== 'string' ? this.need[1][0] : undefined);
                    }
                    this.need.shift();
                    tr = 0;
                } else {
                    break;
                }
            }
        }

        if (this.need.length === 0) {
            next.call(this);
        } else {
            this.loadTimer = setTimeout(() => { this.waitLoad(next, itemloaded, tr + 1); }, this.options.wait_delay);
        }
    }

    initSplash(): void {
        if (this.options.interface && DecafMUD.plugins.Interface[this.options.interface]) {
            this.debugString(`Attempting to initialize the interface plugin "${this.options.interface}".`);
            this.ui = new DecafMUD.plugins.Interface[this.options.interface](this);
            this.ui.initSplash();
        } else {
            this.debugString(`Interface plugin "${this.options.interface}" not found or not specified.`, 'warn');
        }

        this.extra = 3; // Predicted steps for storage, socket, encoding

        this.require('decafmud.storage.' + (this.options.storage || 'standard'));
        this.require('decafmud.socket.' + (this.options.socket || 'flash'));
        this.require('decafmud.encoding.' + (this.options.encoding || 'utf8'));

        if (this.ui && this.need.length > 0 && typeof this.need[0] !== 'string') {
            this.updateSplash(null, this.need[0][0], 0);
        }
        this.waitLoad(this.initSocket, this.updateSplash);
    }

    updateSplash(moduleName: string | null, nextModule?: string, perc?: number): void {
        if (!this.ui) { return; }

        if (perc === undefined) {
            perc = Math.min(100, Math.floor(100 * (((this.extra + this.required) - this.need.length) / (this.required + this.extra))));
        }

        let message = nextModule;
        if (moduleName === true) { // Special flag to just use next_mod as message
             // message is already nextModule
        } else if (nextModule) {
            if (nextModule.indexOf('decafmud') === 0) {
                const parts = nextModule.split('.');
                message = this.tr('Loading the {0} module "{1}"...', parts[1], parts[2]);
            } else {
                message = this.tr('Loading: {0}', nextModule);
            }
        } else if (perc === 100) {
            message = this.tr("Loading complete.");
        }

        this.ui.updateSplash(perc, message);
    }

    initSocket(): void {
        this.extra = 1; // For UI initialization
        if (this.options.storage && DecafMUD.plugins.Storage[this.options.storage]) {
            this.storage = new DecafMUD.plugins.Storage[this.options.storage](this);
        } else {
             this.debugString(`Storage plugin "${this.options.storage}" not found.`, 'warn');
        }
        // this.storage is equivalent to this.store in original JS

        if (this.ui) {
            this.need.push('.'); // Placeholder for UI loading step in splash
            this.updateSplash(true, this.tr("Initializing the user interface..."));
            this.ui.load();
        }

        if (this.options.socket && DecafMUD.plugins.Socket[this.options.socket]) {
            this.debugString(`Creating a socket using the "${this.options.socket}" plugin.`);
            this.socket = new DecafMUD.plugins.Socket[this.options.socket](this);
            this.socket.setup(0); // Argument seems to be unused in implementations
        } else {
            this.debugString(`Socket plugin "${this.options.socket}" not found.`, 'error');
            this.error(this.tr("Socket plugin not found: {0}", this.options.socket || 'N/A'));
            return;
        }

        this.waitLoad(this.initUI, this.updateSplash);
    }

    initUI(): void {
        if (this.ui) {
            this.ui.setup();
        }

        if(this.options.plugins) {
            for (let i = 0; i < this.options.plugins.length; i++) {
                this.require('decafmud.' + this.options.plugins[i]);
            }
        }
        this.waitLoad(this.initFinal, this.updateSplash);
    }

    initFinal(): void {
        this.need.push('.'); // Placeholder for triggers
        this.updateSplash(true, this.tr("Initializing triggers system..."));
        this.need.shift(); // Remove placeholder

        this.need.push('.'); // Placeholder for Telnet
        this.updateSplash(true, this.tr("Initializing TELNET extensions..."));
        for (const k in DecafMUD.plugins.Telopt) {
            if (Object.prototype.hasOwnProperty.call(DecafMUD.plugins.Telopt, k)) {
                const o = (DecafMUD.plugins.Telopt as any)[k];
                if (typeof o === 'function') {
                    this.telopt[k] = new o(this);
                } else {
                    this.telopt[k] = o;
                }
            }
        }
        this.need.shift(); // Remove placeholder

        this.need.push('.'); // Placeholder for filters
        this.updateSplash(true, this.tr("Initializing filters..."));
        if (this.options.textinputfilter && DecafMUD.plugins.TextInputFilter[this.options.textinputfilter]) {
            const textInputFilterCtor = DecafMUD.plugins.TextInputFilter[this.options.textinputfilter];
            this.textInputFilter = new textInputFilterCtor(this);
        }
        this.need.shift(); // Remove placeholder

        this.loaded = true;
        if (this.ui) {
            this.ui.endSplash();
        }

        // Example of IE warning, can be removed or adapted
        // if (typeof navigator !== 'undefined' && /MSIE/.test(navigator.userAgent) && this.ui && this.ui.infoBar) {
        //    const msg = 'You may experience poor performance...';
        //    this.ui.infoBar(this.tr(msg));
        // }

        if (this.options.autoconnect && this.socket?.ready) {
            this.connect();
        }
    }

    connect(): void {
        if (this.connecting || this.connected) { return; }
        if (this.socket_ready !== true) {
            this.debugString("The socket isn't ready yet.", "warn");
            // Potentially queue the connect call or error
            return;
         }

        this.connecting = true;
        this.connect_try = 0;
        this.debugString("Attempting to connect...", "info");

        if (this.ui && this.ui.connecting) {
            this.ui.connecting();
        }

        this.conn_timer = setTimeout(() => { this.connectFail(); }, this.options.connect_timeout);
        this.socket!.connect(); // socket should be defined if socket_ready is true
    }

    connectFail(): void {
        clearTimeout(this.conn_timer);
        if (!this.connecting) return; // Already connected or disconnected

        this.connect_try++; // connect_try was cconnect_try in original JS, typo?
        this.debugString(`Connection attempt ${this.connect_try} failed or timed out.`, "warn");


        if (this.connect_try > this.options.reconnect_tries!) {
            this.debugString("Max connection retries reached.", "error");
            this.connecting = false; // Stop trying
            // Potentially call a more specific error handler or UI update
            if (this.ui && this.ui.disconnected) { // To show a final disconnected state
                this.ui.disconnected(false);
            }
            return;
        }

        // Retry.
        if (this.socket) {
             this.socket.close(); // Close before reconnecting
             this.socket.connect();
        } else {
            this.error("Socket not available for reconnection attempt.");
            this.connecting = false;
            return;
        }

        this.conn_timer = setTimeout(() => { this.connectFail(); }, this.options.connect_timeout);
    }

    reconnect(): void { // This method seems to be manually callable
        this.connect_try++;
        this.debugString(`Manual reconnect attempt ${this.connect_try}.`, "info");
        if (this.ui && this.ui.connecting) {
            this.ui.connecting();
        }
        if (this.socket) {
            this.socket.connect();
        } else {
            this.error("Socket not available for manual reconnect.");
        }
    }

    // --- Socket Event Handlers ---
    socketReady(): void {
        this.debugString("The socket is ready.");
        this.socket_ready = true;
        if (this.loaded && this.options.autoconnect) {
            this.connect();
        }
    }

    socketConnected(): void {
        this.connecting = false;
        this.connected = true;
        this.connect_try = 0;
        clearTimeout(this.conn_timer);

        const host = this.socket?.host || 'unknown';
        const port = this.socket?.port || 0;
        this.debugString(this.tr("The socket has connected successfully to {0}:{1}.", host, port), "info");

        for (const k in this.telopt) {
            if (this.telopt[k] && typeof (this.telopt[k] as DecafMUDTeloptHandler).connect === 'function') {
                ((this.telopt[k] as DecafMUDTeloptHandler).connect! as () => void)();
            }
        }

        if (this.textInputFilter) {
            this.textInputFilter.connected();
        }

        if (this.ui && this.ui.connected) {
            this.ui.connected();
        }
        // if (this.display && this.display.message) {
        //     this.display.message(this.tr('<b>Connected.</b>', host, port), 'decafmud socket status');
        // }
    }

    socketClosed(): void {
        clearTimeout(this.conn_timer);
        this.connecting = false;
        this.connected = false;
        this.debugString("The socket has disconnected.", "info");

        for (const k in this.telopt) {
            if (this.telopt[k] && typeof (this.telopt[k] as DecafMUDTeloptHandler).disconnect === 'function') {
                ((this.telopt[k] as DecafMUDTeloptHandler).disconnect! as () => void)();
            }
        }

        this.inbuf = [];
        this.decompressor = null; // Corrected: was decompressStream
        this.isCompressed = false;  // Also reset isCompressed flag
        this.startCompressV2 = false; // This flag is largely redundant but reset for safety

        if (this.options.autoreconnect) {
            this.connect_try++;
            if (this.connect_try < this.options.reconnect_tries!) {
                if (this.ui && this.ui.disconnected) {
                    this.ui.disconnected(true); // true for reconnecting
                }

                const s = this.options.reconnect_delay! / 1000;
                if (this.ui && this.ui.immediateInfoBar && s >= 0.25) {
                    this.ui.immediateInfoBar(
                        this.tr("You have been disconnected. Reconnecting in {0} second{1}...", s, (s === 1 ? '' : 's')),
                        'reconnecting',
                        s, // duration
                        undefined, // no actions initially for this specific message
                        [['Reconnect Now'.tr(this), () => { clearTimeout(this.timer); this.socket?.connect(); }]],
                        undefined, // on click general
                        () => { clearTimeout(this.timer); } // on close
                    );
                }

                this.timer = setTimeout(() => {
                    this.debugString('Attempting to connect...', 'info');
                    if (this.ui && this.ui.connecting) {
                        this.ui.connecting();
                    }
                    this.socket?.connect();
                }, this.options.reconnect_delay);
                return;
            }
        }

        if (this.ui && this.ui.disconnected) {
            this.ui.disconnected(false); // false for not reconnecting
        }
    }

    socketData(data: string | Uint8Array): void { // data can be string (Flash) or Uint8Array (WebSocket)
        if (this.isCompressed && this.decompressor) {
            try {
                let byteArray: Uint8Array;
                if (typeof data === 'string') {
                    // Convert binary string to Uint8Array
                    byteArray = new Uint8Array(data.length);
                    for (let i = 0; i < data.length; i++) {
                        byteArray[i] = data.charCodeAt(i) & 0xFF;
                    }
                } else {
                    byteArray = data;
                }
                this.decompressor.push(byteArray, false); // false means not the final chunk
            } catch (e: any) {
                this.error(this.tr('MCCP2 decompression error: {0}', e.message || e));
                // Attempt to disable compression. The `disconnect` method on TeloptCOMPRESSv2 handles this.
                const compressHandler = this.telopt[TN.COMPRESSv2] as TeloptCOMPRESSv2 | undefined;
                compressHandler?.disconnect();
                // Push the raw data to inbuf as a fallback, though it's likely corrupt/unreadable
                this.inbuf.push(data);
                if (this.loaded) this.processBuffer();
            }
            // Decompressed data will be handled by decompressor.onData, which calls processBuffer
        } else {
            // Not compressed, or decompressor not ready: proceed as before
            this.inbuf.push(data);
            if (this.loaded) {
                this.processBuffer();
            }
        }
    }

    socketError(data: string, data2?: string): void {
        this.debugString(this.tr('Socket Err: {0}  d2="{1}"', data, data2 || ''), 'error');
    }

    // --- Data Processing ---
    getEnc(enc: string): string {
        return enc.replace(/-/g, '').toLowerCase();
    }

    setEncoding(enc: string): void {
        const normalizedEnc = this.getEnc(enc);
        if (DecafMUD.plugins.Encoding[normalizedEnc] === undefined) {
            throw new Error(`'${enc}' isn't a valid encoding scheme, or it isn't loaded.`);
        }
        this.debugString(`Switching to character encoding: ${normalizedEnc}`);
        this.options.encoding = normalizedEnc;
        // Reroute functions are implicitly handled by using this.options.encoding in decode/encode calls
    }

    // Default decode/encode, plugins will provide actual implementations
    private _decode(data: string): [string, string] {
        const currentEncoding = this.options.encoding || 'utf8'; // Default to utf8 if not set
        const C = DecafMUD.plugins.Encoding[currentEncoding];
        if (C) return C.decode(data);
        this.debugString(`Encoding not found: ${currentEncoding}. Passing through.`, "warn");
        return [data, '']; // Passthrough if no encoder
    }

    private _encode(data: string): string {
        const currentEncoding = this.options.encoding || 'utf8';
        const C = DecafMUD.plugins.Encoding[currentEncoding];
        if (C) return C.encode(data);
        this.debugString(`Encoding not found: ${currentEncoding}. Passing through.`, "warn");
        return data; // Passthrough if no encoder
    }


    sendInput(input: string): void {
        if (!this.socket || !this.socket.connected) {
            this.debugString("Cannot send input: not connected", "warn");
            return;
        }
        const iacRegex = /\xFF/g;
        const encodedInput = this._encode(input + '\r\n').replace(iacRegex, '\xFF\xFF');
        this.socket.write(encodedInput);

        if (this.ui) {
            this.ui.displayInput(input);
        }
    }

    processBuffer(): void {
        let currentBuffer = "";
        for (const chunk of this.inbuf) {
            if (typeof chunk === 'string') {
                currentBuffer += chunk;
            } else { // Uint8Array
                // Convert Uint8Array to string (assuming ISO-8859-1 / binary string)
                // More robust conversion might be needed if other encodings are involved at this stage
                for (let i = 0; i < chunk.length; i++) {
                    currentBuffer += String.fromCharCode(chunk[i]);
                }
            }
        }
        this.inbuf = []; // Clear buffer after consolidating

        const IAC = DecafMUD.TN.IAC;
        let remainingDataForNextRound = '';

        while (currentBuffer.length > 0) {
            const iacIndex = currentBuffer.indexOf(IAC);

            if (iacIndex === -1) { // No IAC found
                const [decodedText, undecodedRemainder] = this._decode(currentBuffer);
                this.handleInputText(decodedText);
                remainingDataForNextRound = undecodedRemainder; // This should be empty if full decode
                currentBuffer = ''; // All processed
                break;
            }

            if (iacIndex > 0) { // Text before IAC
                const textPart = currentBuffer.substring(0, iacIndex);
                const [decodedText, undecodedRemainder] = this._decode(textPart);
                this.handleInputText(decodedText);
                remainingDataForNextRound += undecodedRemainder; // Collect undecoded parts
                currentBuffer = currentBuffer.substring(iacIndex);
            }

            // At this point, currentBuffer starts with IAC
            const iacResult = this.readIAC(currentBuffer);

            // The old startCompressV2 logic is removed. Compression state is now managed by
            // this.isCompressed and this.decompressor, handled in socketData and TeloptCOMPRESSv2.
            // readIAC will handle the IAC SB COMPRESSV2 sequence itself, and the TeloptCOMPRESSv2
            // plugin will set up the decompressor. Subsequent data will be piped through it
            // by socketData.

            if (iacResult === false) { // Incomplete IAC sequence
                remainingDataForNextRound += currentBuffer; // Prepend current (incomplete IAC) buffer
                currentBuffer = ''; // Stop processing this chunk
                break;
            } else { // IAC processed, iacResult is the rest of the buffer
                currentBuffer = remainingDataForNextRound + iacResult;
                remainingDataForNextRound = '';
            }
        }
        if (remainingDataForNextRound) {
            this.inbuf.unshift(remainingDataForNextRound); // Put back any remaining undecoded/incomplete parts
        }
    }


    handleInputText(text: string): void {
        if (this.textInputFilter) {
            text = this.textInputFilter.filterInputText(text);
        }
        if (this.display) {
            this.display.handleData(text);
        }
    }

    readIAC(data: string): string | false {
        const t = DecafMUD.TN;
        if (data.length < 2) { return false; } // Not enough data for command

        if (data.charCodeAt(1) === 255) { // IAC IAC -> literal 255
            if (this.display) this.display.handleData('\xFF');
            return data.substring(2);
        }

        if (data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241) { // GA or NOP
            return data.substring(2);
        }

        // WILL, WONT, DO, DONT (3 bytes total)
        if ("\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1) {
            if (data.length < 3) { return false; }
            const seq = data.substring(0, 3);
            this.debugString('RCVD ' + DecafMUD.debugIAC(seq));
            this.handleIACSimple(seq);
            return data.substring(3);
        }

        // SB (Subnegotiation)
        if (data.charAt(1) === t.SB) {
            if (data.length < 3) return false; // Need at least IAC SB OPTION
            const optionCode = data.charAt(2);
            let endIndex = -1;
            let searchIndex = 3;

            // Find IAC SE, handling escaped IACs
            while (searchIndex < data.length) {
                const iacSeIndex = data.indexOf(t.IAC + t.SE, searchIndex);
                if (iacSeIndex === -1) return false; // Incomplete SB

                // Check if the IAC in IAC SE is escaped (part of data, not end marker)
                // This logic seems a bit off in original, usually IAC IAC is the escape.
                // The original check was: if ( ind > 0 && data.charAt(ind-1) === t.IAC )
                // This should be: if data.charAt(iacSeIndex -1) === t.IAC (meaning IAC IAC SE)
                // However, an IAC byte within SB data should be doubled (IAC IAC).
                // So, a simple indexOf(IAC + SE) is usually correct unless the data can contain IAC SE.

                // Let's assume simple IAC SE is the terminator for now, as complex escapes are rare.
                // A robust parser would scan byte by byte.
                endIndex = iacSeIndex;
                break;
            }

            if (endIndex === -1) return false; // IAC SE not found

            const subnegotiationData = data.substring(3, endIndex).replace(/\xFF\xFF/g, '\xFF'); // Handle doubled IACs
            const fullSbSequenceForDebug = t.IAC + t.SB + optionCode + subnegotiationData + t.IAC + t.SE;

            let handledByPlugin = false;
            if (this.telopt[optionCode] && typeof (this.telopt[optionCode] as DecafMUDTeloptHandler)._sb === 'function') {
                if (((this.telopt[optionCode] as DecafMUDTeloptHandler)._sb! as (data: string) => boolean | void)(subnegotiationData) === false) {
                    handledByPlugin = true; // Plugin indicated it handled debugging
                }
            }

            if (!handledByPlugin) {
                 // Special logging for MSSP (from original)
                if (optionCode === t.MSSP && typeof window !== 'undefined' && console.groupCollapsed) {
                    console.groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
                    // console.dir(readMSDP(subnegotiationData)[0]); // readMSDP might be specific
                    console.log("MSSP Data:", subnegotiationData); // Simplified
                    console.groupEnd();
                } else {
                    this.debugString('RCVD ' + DecafMUD.debugIAC(fullSbSequenceForDebug));
                }
            }
            return data.substring(endIndex + 2); // Skip IAC SE
        }

        // Unknown IAC sequence, log and skip the IAC byte
        this.debugString('RCVD Unknown IAC sequence: ' + DecafMUD.debugIAC(data.substring(0, Math.min(data.length, 3))), 'warn');
        return data.substring(1); // Skip the initial IAC
    }

    sendIAC(seq: string): void {
        this.debugString('SENT ' + DecafMUD.debugIAC(seq));
        if (this.socket && this.socket.connected) {
            this.socket.write(seq);
        } else {
            this.debugString('Cannot send IAC: socket not connected or not available.', 'warn');
        }
    }

    handleIACSimple(seq: string): void {
        const t = DecafMUD.TN;
        const command = seq.charAt(1);
        const option = seq.charAt(2);
        const handler = this.telopt[option] as DecafMUDTeloptHandler | boolean;

        if (handler === undefined || typeof handler === 'boolean') { // No handler or simple boolean flag
            if (command === t.DO) this.sendIAC(t.IAC + t.WONT + option);
            else if (command === t.WILL) this.sendIAC(t.IAC + t.DONT + option);
            return;
        }

        // Handler is a DecafMUDTeloptHandler object
        switch (command) {
            case t.DO:
                if (!(handler._do && handler._do() === false)) { // if returns true or undefined
                    this.sendIAC(t.IAC + t.WILL + option);
                } // else: plugin sent custom response or doesn't want default
                break;
            case t.DONT:
                if (!(handler._dont && handler._dont() === false)) {
                    this.sendIAC(t.IAC + t.WONT + option);
                }
                break;
            case t.WILL:
                if (!(handler._will && handler._will() === false)) {
                    this.sendIAC(t.IAC + t.DO + option);
                }
                break;
            case t.WONT:
                if (!(handler._wont && handler._wont() === false)) {
                    this.sendIAC(t.IAC + t.DONT + option);
                }
                break;
        }
    }

    disableMCCP2(): void {
        this.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.DONT + DecafMUD.TN.COMPRESSv2);
        this.isCompressed = false;
        this.decompressor = null;
        // this.startCompressV2 = false; // This flag is somewhat redundant now
        this.inbuf = []; // Clear buffer as its state might be inconsistent
        this.debugString("MCCP2 compression has been disabled (called from disableMCCP2).", "info");
    }

    requestPermission(optionPath: string, promptText: string, callback: (allowed: boolean) => void): void {
        if (!this.storage) {
            this.debugString("Storage plugin not available for permissions.", "warn");
            callback(false); // Default to deny if no storage
            return;
        }
        const currentSetting = this.storage.get(optionPath);
        if (currentSetting !== undefined && currentSetting !== null) {
            callback(!!currentSetting);
            return;
        }

        const self = this; // for closures

        const allowAction = () => {
            self.storage!.set(optionPath, true);
            callback(true);
        };
        const denyAction = () => {
            self.storage!.set(optionPath, false);
            callback(false);
        };
        const closeAction = () => { // User dismissed without choosing
            callback(false); // Treat as deny for this session
        };

        if (this.ui && this.ui.infoBar) {
            const buttons: [string, (e: Event) => void][] = [
                [this.tr('Allow'), allowAction],
                [this.tr('Deny'), denyAction]
            ];
            this.ui.infoBar(
                promptText,
                'permission', // type/clss
                0,            // duration
                undefined,    // icon
                buttons,      // buttons
                undefined,    // onClick
                closeAction   // onClose
            );
        } else {
            // Fallback if no infobar (e.g., confirm dialog)
            // This is a blocking operation, not ideal, but matches original alert fallback potential
            if (typeof window !== 'undefined' && window.confirm(promptText)) {
                allowAction();
            } else {
                denyAction();
            }
        }
    }

    // --- Static helper methods (if any) ---
    static debugIAC(seq: string): string {
        // This is a simplified version. The original is quite complex.
        // For full fidelity, the original iacToWord and state machine logic would be needed.
        let out = [];
        for (let i = 0; i < seq.length; i++) {
            const charCode = seq.charCodeAt(i);
            let charStr = "";
            Object.entries(DecafMUD.TN).forEach(([key, value]) => {
                if (value.charCodeAt(0) === charCode && value.length === 1) { // Ensure it's a single char constant
                    charStr = key;
                }
            });
            if (charStr) {
                out.push(charStr);
            } else {
                out.push(charCode.toString(16).toUpperCase().padStart(2, '0'));
            }
        }
        return out.join(' ');
    }

    // TODO: Add other methods like about(), etc.
    about(): void {
        const abt = [
            "DecafMUD v{0} \u00A9 2010 Stendec",
            "Updated and improved by Pit from Discworld.",
            "Further bugfixes and improvements by Waba from MUME.",
            "https://github.com/MUME/DecafMUD\n",
            "DecafMUD is a web-based MUD client written in JavaScript, rather" +
            " than a plugin like Flash or Java, making it load faster and react as" +
            " you'd expect a website to.\n",
            "It's easy to customize as well, using simple CSS and JavaScript," +
            " and free to use and modify, so long as your MU* is free to play!"
        ];
        alert(this.tr(abt.join('\n'), DecafMUD.version.toString()));
    }
}

// Default plugins that were embedded in decafmud.js
DecafMUD.plugins.Encoding.iso88591 = {
    proper: 'ISO-8859-1',
    decode: function(data: string): [string, string] { return [data, '']; },
    encode: function(data: string): string { return data; }
};

DecafMUD.plugins.Encoding.utf8 = {
    proper: 'UTF-8',
    decode: function(data: string): [string, string] {
        try {
            // Use TextDecoder if available (modern browsers)
            if (typeof TextDecoder !== 'undefined') {
                const decoder = new TextDecoder('utf-8', { fatal: false }); // fatal: false to mimic original's fallback
                // Convert string to Uint8Array for TextDecoder
                const bytes = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    bytes[i] = data.charCodeAt(i) & 0xFF; // Ensure byte values
                }
                return [decoder.decode(bytes), ''];
            }
            return [decodeURIComponent(escape(data)), ''];
        } catch (err) {
            // Fallback for invalid sequences (simplified from original)
            let out = '';
            let i = 0;
            const l = data.length;
            while (i < l) {
                const c = data.charCodeAt(i++);
                if (c < 0x80) { // 1-byte
                    out += String.fromCharCode(c);
                } else if ((c > 0xBF) && (c < 0xE0)) { // 2-byte
                     if (i >= l) break;
                    out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63));
                } else if ((c > 0xDF) && (c < 0xF0)) { // 3-byte
                    if (i + 1 >= l) break;
                    out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63));
                } else { // Potentially 4-byte or invalid
                     // Original had a more complex 4-byte handling, this is simplified
                    out += String.fromCharCode(0xFFFD); // Replacement char
                }
            }
            return [out, data.substring(i)]; // Return remaining if loop broke early
        }
    },
    encode: function(data: string): string {
         try {
            // Use TextEncoder if available
            if (typeof TextEncoder !== 'undefined') {
                const encoder = new TextEncoder(); // Defaults to UTF-8
                const utf8Bytes = encoder.encode(data);
                let result = '';
                for (let i = 0; i < utf8Bytes.length; i++) {
                    result += String.fromCharCode(utf8Bytes[i]);
                }
                return result;
            }
            return unescape(encodeURIComponent(data));
        } catch (err) {
            console.error("UTF-8 encoding failed:", err);
            return data; // Fallback
        }
    }
};

// Telopt handlers that were embedded
// Note: These need to be classes or objects that match DecafMUDTeloptHandler structure
// For simplicity, I'll define them as classes.

class TeloptTTYPE implements DecafMUDTeloptHandler {
    current: number = -1;
    constructor(public decaf: DecafMUD) {}
    _dont() { this.current = -1; }
    disconnect() { this.current = -1; }
    _sb(data: string): false | void {
        if (data !== DecafMUD.TN.ECHO) { return; } // IS in original, but ECHO for TTYPE SEND
        this.current = (this.current + 1) % this.decaf.options.ttypes!.length;
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.TTYPE + DecafMUD.TN.ECHO + DecafMUD.TN.IAC + DecafMUD.TN.SE));
        this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.TTYPE + DecafMUD.TN.IS + this.decaf.options.ttypes![this.current] + DecafMUD.TN.IAC + DecafMUD.TN.SE);
        return false; // We print our own debug info.
    }
}
DecafMUD.plugins.Telopt[DecafMUD.TN.TTYPE] = TeloptTTYPE;


class TeloptECHO implements DecafMUDTeloptHandler {
    constructor(public decaf: DecafMUD) {}
    _will() { if (this.decaf.ui) { this.decaf.ui.localEcho(false); } }
    _wont() { if (this.decaf.ui) { this.decaf.ui.localEcho(true); } }
    disconnect() { if (this.decaf.ui) { this.decaf.ui.localEcho(true); } }
}
DecafMUD.plugins.Telopt[DecafMUD.TN.ECHO] = TeloptECHO;

class TeloptNAWS implements DecafMUDTeloptHandler {
    enabled: boolean = false;
    last?: [number, number];
    constructor(public decaf: DecafMUD) {}
    _do() { this.last = undefined; this.enabled = true; setTimeout(() => { this.send(); }, 0); }
    _dont() { this.enabled = false; }
    disconnect() { this.enabled = false; }
    send() {
        if (!this.decaf.display || !this.enabled || !this.decaf.display.getSize) { return; }
        const sz = this.decaf.display.getSize();
        if (this.last && this.last[0] === sz[0] && this.last[1] === sz[1]) { return; }
        this.last = sz;
        let data = String.fromCharCode(Math.floor(sz[0] / 255)) +
                   String.fromCharCode(sz[0] % 255) +
                   String.fromCharCode(Math.floor(sz[1] / 255)) +
                   String.fromCharCode(sz[1] % 255);
        data = DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.NAWS + data.replace(/\xFF/g, '\xFF\xFF') + DecafMUD.TN.IAC + DecafMUD.TN.SE;
        this.decaf.sendIAC(data);
    }
}
DecafMUD.plugins.Telopt[DecafMUD.TN.NAWS] = TeloptNAWS;

class TeloptCHARSET implements DecafMUDTeloptHandler {
    constructor(public decaf: DecafMUD) {}
    _dont() { return false as false; } // Explicitly return false
    _will() {
        setTimeout(() => {
            let cs: string[] = [], done: string[] = [];
            const currentEncoding = this.decaf.options.encoding;
            if (currentEncoding !== 'iso88591' && DecafMUD.plugins.Encoding[currentEncoding]?.proper) {
                cs.push(DecafMUD.plugins.Encoding[currentEncoding].proper);
                done.push(currentEncoding);
            }
            for (const enc of this.decaf.options.encoding_order || []) {
                const pluginEnc = DecafMUD.plugins.Encoding[enc];
                if (pluginEnc?.proper && !done.includes(enc)) {
                    cs.push(pluginEnc.proper);
                    done.push(enc);
                }
            }
            for (const k in DecafMUD.plugins.Encoding) {
                if (!done.includes(k) && DecafMUD.plugins.Encoding[k]?.proper) {
                    cs.push(DecafMUD.plugins.Encoding[k].proper);
                }
            }
            this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + DecafMUD.TN.ECHO + ' ' + cs.join(' ') + DecafMUD.TN.IAC + DecafMUD.TN.SE);
        }, 0);
    }
    _sb(data: string): false | void {
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + data + DecafMUD.TN.IAC + DecafMUD.TN.SE));
        const command = data.charCodeAt(0);
        let value = data.substring(1);

        if (command === 1) { // REQUEST
            if (value.indexOf('TTABLE ') === 0) value = value.substring(8);
            const sep = value.charAt(0);
            const requestedCharsets = value.substring(1).split(sep);
            let chosenEncoding: string | undefined = undefined;
            let originalCharsetName: string | undefined = undefined;

            for (const preferred of this.decaf.options.encoding_order || []) {
                const pluginEnc = DecafMUD.plugins.Encoding[preferred];
                if (pluginEnc?.proper) {
                    if (requestedCharsets.includes(preferred)) {
                        chosenEncoding = preferred;
                        originalCharsetName = preferred;
                        break;
                    }
                    if (requestedCharsets.includes(pluginEnc.proper)) {
                        chosenEncoding = preferred;
                        originalCharsetName = pluginEnc.proper;
                        break;
                    }
                }
            }
            if (!chosenEncoding) {
                for (const reqCS of requestedCharsets) {
                    for (const k in DecafMUD.plugins.Encoding) {
                        if (reqCS === k || (DecafMUD.plugins.Encoding[k]?.proper && reqCS === DecafMUD.plugins.Encoding[k].proper)) {
                            chosenEncoding = k;
                            originalCharsetName = reqCS;
                            break;
                        }
                    }
                    if (chosenEncoding) break;
                }
            }

            if (chosenEncoding && originalCharsetName) {
                this.decaf.setEncoding(chosenEncoding);
                this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + '\x02' + originalCharsetName + DecafMUD.TN.IAC + DecafMUD.TN.SE);
            } else {
                this.decaf.debugString("No encoder for: " + requestedCharsets.join(sep));
                this.decaf.sendIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.CHARSET + '\x03' + DecafMUD.TN.IAC + DecafMUD.TN.SE); // REJECTED
            }
        } else if (command === 2) { // ACCEPTED
            let acceptedEncodingKey: string | undefined = undefined;
            for (const k in DecafMUD.plugins.Encoding) {
                if (DecafMUD.plugins.Encoding[k]?.proper === value) {
                    acceptedEncodingKey = k;
                    break;
                }
            }
            if (acceptedEncodingKey) this.decaf.setEncoding(acceptedEncodingKey);
        }
        return false; // Handled own debug
    }
}
import { inflate, Inflate } from 'pako'; // Import pako

DecafMUD.plugins.Telopt[DecafMUD.TN.CHARSET] = TeloptCHARSET;

// declare var Zlib: any; // REMOVED - Zlib global is no longer needed

class TeloptCOMPRESSv2 implements DecafMUDTeloptHandler {
    private inflateStream: Inflate | null = null;

    constructor(public decaf: DecafMUD) {
        // Constructor
    }

    _will(): boolean {
        if (this.decaf.options.socket === 'flash') {
            this.decaf.debugString('Flash COMPRESSv2 support has not been implemented by this client.');
            return false;
        }
        // Pako is imported, so it's available if installation was successful.
        // No need to check for global Zlib.
        return true; // Willing to enable COMPRESSv2
    }

    _sb(): void { // MCCPv2 SB is just IAC SB COMPRESS2 IAC SE (no actual data)
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(DecafMUD.TN.IAC + DecafMUD.TN.SB + DecafMUD.TN.COMPRESSv2 + DecafMUD.TN.IAC + DecafMUD.TN.SE));
        this.decaf.debugString("Switching to compressed stream (MCCPv2)");
        // Initialize the pako inflate stream
        this.inflateStream = new Inflate({ windowBits: 15 }); // Standard zlib stream with default windowBits

        // Signal DecafMUD core to start directing data through the decompressor
        // The original decaf.startCompressV2 was a simple boolean.
        // We need a more robust way for processBuffer to use this.inflateStream.
        // Let's assume DecafMUD class will now have a property like `decompressor`
        // which processBuffer can check and use.
        this.decaf.decompressor = this.inflateStream; // Assign pako Inflate instance
        if (this.inflateStream) {
            this.inflateStream.onData = (chunk: Uint8Array) => {
                // Convert Uint8Array chunk to string (binary string) before pushing to inbuf
                // This matches how non-compressed data is handled by processBuffer
                let binaryString = "";
                for (let i = 0; i < chunk.length; i++) {
                    binaryString += String.fromCharCode(chunk[i]);
                }
                this.decaf.inbuf.push(binaryString);
                // Call processBuffer, but perhaps with a small delay or check to prevent re-entrancy issues
                // For simplicity now, direct call. May need debounce/throttle if issues arise.
                setTimeout(() => this.decaf.processBuffer(), 0);
            };
            this.inflateStream.onEnd = (status: number) => {
                if (status !== 0) { // pako.Z_OK is 0
                    this.decaf.error(`MCCP2 stream ended with error: ${status}`);
                    this.disconnect(); // Stop compression
                } else {
                    this.decaf.debugString("MCCP2 stream ended.");
                }
            };
        }
        this.decaf.isCompressed = true; // A flag to indicate compression is active
    }

    disconnect(): void { // Called when connection closes or DONT COMPRESSV2 is received
        this.decaf.debugString("MCCPv2 compression ended.");
        if (this.inflateStream) {
            // Pako's Inflate doesn't have a specific close/end method to call from outside
            // when aborting. Nullifying it is the main step.
            this.inflateStream = null;
        }
        this.decaf.decompressor = null;
        this.decaf.isCompressed = false;
    }

    _dont(): void { // Server says it WONT do COMPRESSV2, or we sent DONT and got confirmation
        this.disconnect(); // Clean up compression state
    }

    _wont(): void { // Server says it WONT do COMPRESSV2
        this.disconnect();
    }
}
DecafMUD.plugins.Telopt[DecafMUD.TN.COMPRESSv2] = TeloptCOMPRESSv2;

// MSDP related functions (readMSDP, writeMSDP) would also go here or be imported if they are complex
// For now, skipping their full implementation detail.
// class TeloptMSDP implements DecafMUDTeloptHandler { ... }
// DecafMUD.plugins.Telopt[DecafMUD.TN.MSDP] = TeloptMSDP;


// We always transmit binary. What else would we transmit?
(DecafMUD.plugins.Telopt as any)[DecafMUD.TN.BINARY] = true;

// Only use MSSP for debugging purposes.
(DecafMUD.plugins.Telopt as any)[DecafMUD.TN.MSSP] = (typeof window !== 'undefined' && 'console' in window);

// Global augmentations for String and Array prototypes if not using a separate utility file
declare global {
    interface String {
        endsWith(suffix: string): boolean;
        substr_count(needle: string): number;
        tr(decafInstance: DecafMUD, ...formatArgs: any[]): string; // Renamed rest param for clarity
    }
    interface Array<T> {
        indexOf(searchElement: T, fromIndex?: number): number;
    }
    interface StringConstructor {
        logNonTranslated?: boolean;
    }
}

// String.prototype.tr definition
String.prototype.tr = function(this: string, decafInstance: DecafMUD, ...formatArgs: any[]): string {
    let s = this.toString(); // The string to be translated

    // Use the provided decafInstance for language settings
    const lang = decafInstance?.options.language; // decafInstance is now guaranteed to be DecafMUD
    if (lang && lang !== 'en') {
        const langPack = DecafMUD.plugins.Language[lang];
        if (langPack && langPack[s]) {
            s = langPack[s]; // Translated string
        } else {
            if (String.logNonTranslated && typeof console !== 'undefined' && console.warn) {
                 const langName = langPack && langPack['English'] ? langPack['English'] : `"${lang}"`;
                 console.warn(`DecafMUD[${decafInstance?.id || '?'}] i18n: No ${langName} translation for: ${s.replace(/\n/g, '\\n')}`);
            }
        }
    }

    // Replacement logic using formatArgs
    // Check if the first formatArg is an object for keyed substitution
    if (formatArgs.length === 1 &&
        typeof formatArgs[0] === 'object' &&
        formatArgs[0] !== null &&
        !Array.isArray(formatArgs[0])) {
        const replacements = formatArgs[0] as Record<string, any>;
        for (const key in replacements) {
            if (Object.prototype.hasOwnProperty.call(replacements, key)) {
                const value = replacements[key];
                s = s.replace(new RegExp('{' + key + '}', 'g'), typeof value !== 'undefined' ? String(value) : '');
            }
        }
    } else { // Numbered arguments from formatArgs array
        s = s.replace(/{(\d+)}/g, (matchString, p1) => {
            const placeholderIndex = parseInt(p1, 10);
            if (placeholderIndex >= 0 && placeholderIndex < formatArgs.length) {
                const value = formatArgs[placeholderIndex];
                return typeof value !== 'undefined' ? String(value) : ''; // Replace undefined with empty string
            }
            return matchString; // Keep placeholder if index out of bounds
        });
    }
    return s;
};
String.logNonTranslated = (typeof window !== 'undefined' && 'console' in window);

// Make sure Zlib is declared if it's expected to be a global (for COMPRESSv2)
// declare var Zlib: any;
// This is usually handled by including the script before DecafMUD or via module imports if Zlib provides them.
// For now, assuming it might be global.

export default DecafMUD;
