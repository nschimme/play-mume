/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import {
  DecafMUDDisplay,
  DecafMUDInterface,
  DecafMUDOptions,
  DecafMUDSocket,
  DecafMUDStorage,
  DecafMUDTextInputFilter,
  EncodingPlugin,
  GMCPPlugin,
  TeloptHandler,
  TN,
} from './types';
import { EventEmitter } from './events';
import { ENCODINGS } from './encodings';
import { StandardStorage } from './storage';
import { DecafWebSocket } from './socket';
import { PanelsInterface } from './interface';
import { GMCPTelopt } from './telopts/gmcp';
import { ZMPTelopt } from './telopts/zmp';
import {
  CHARSETHandler,
  COMPRESSv2Handler,
  ECHOHandler,
  MSDPHandler,
  NAWSHandler,
  TTYPEHandler,
} from './telopts/telopts';

export interface DecafVersion {
  major: number;
  minor: number;
  micro: number;
  flag: string;
  toString(): string;
}

export class DecafMUD extends EventEmitter {
  public static version: DecafVersion = {
    major: 0,
    minor: 10,
    micro: 0,
    flag: 'beta',
    toString() {
      return `${this.major}.${this.minor}.${this.micro}${this.flag ? '-' + this.flag : ''}`;
    },
  };

  public static instances: DecafMUD[] = [];
  public static last_id = -1;

  public static defaultOptions: DecafMUDOptions = {
    host: undefined,
    port: 4000,
    autoconnect: true,
    connectonsend: true,
    autoreconnect: false,
    connect_timeout: 5000,
    reconnect_delay: 5000,
    reconnect_tries: 3,
    storage: 'standard',
    display: 'standard',
    encoding: 'utf8',
    socket: 'websocket',
    interface: 'panels',
    language: 'en',
    textinputfilter: '',
    wait_delay: 25,
    wait_tries: 1000,
    plugins: [],
    set_display: {
      maxscreens: 100,
      minelements: 10,
      handlecolor: true,
      fgclass: 'c',
      bgclass: 'b',
      fntclass: 'fnt',
      inputfg: '-7',
      inputbg: '-0',
    },
    set_socket: {
      wsport: 443,
      wspath: '',
      ssl: true,
    },
    set_interface: {
      container: undefined,
      start_full: false,
      mru: true,
      mru_size: 15,
      multiline: true,
      clearonsend: false,
      focusinput: true,
      repeat_input: false,
      blurclass: 'mud-input-blur',
      msg_connect: 'Press Enter to connect and type here...',
      msg_connecting: 'Attempting to connect...',
      msg_empty: 'Type commands here...',
      connect_hint: false,
    },
    ttypes: [`decafmud-${DecafMUD.version.toString()}`, 'decafmud', 'xterm', 'unknown'],
    environ: {},
    encoding_order: ['utf8'],
    plugin_order: [],
  };

  public id: number;
  public options: DecafMUDOptions;
  public loaded = false;
  public connecting = false;
  public connected = false;
  public socket_ready = false;
  public connect_try = 0;

  public store!: DecafMUDStorage;
  public storage!: DecafMUDStorage;
  public socket!: DecafMUDSocket;
  public display?: DecafMUDDisplay;
  public ui?: DecafMUDInterface;
  public gmcp?: GMCPPlugin;
  public textInputFilter?: DecafMUDTextInputFilter;
  public telopt: Record<string, TeloptHandler | boolean | string> = {};

  public startCompressV2 = false;
  public decompressStream?: { decompress(data: number[] | Uint8Array): Uint8Array };

  private inbuf: (string | Uint8Array)[] = [];
  private currentEncoding: EncodingPlugin = ENCODINGS.utf8;
  private conn_timer?: ReturnType<typeof setTimeout>;

  constructor(options?: DecafMUDOptions) {
    super();
    this.id = ++DecafMUD.last_id;
    this.options = { ...DecafMUD.defaultOptions, ...options };

    if (options) {
      if (options.set_display) {
        this.options.set_display = { ...DecafMUD.defaultOptions.set_display, ...options.set_display };
      }
      if (options.set_socket) {
        this.options.set_socket = { ...DecafMUD.defaultOptions.set_socket, ...options.set_socket };
      }
      if (options.set_interface) {
        this.options.set_interface = { ...DecafMUD.defaultOptions.set_interface, ...options.set_interface };
      }
    }

    DecafMUD.instances.push(this);
    this.debugString('Created new DecafMUD instance.', 'info');

    this.initCore();
  }

  private initCore(): void {
    this.store = new StandardStorage('decafmud');
    this.storage = this.store;

    if (this.options.encoding) {
      this.setEncoding(this.options.encoding);
    }

    this.ui = new PanelsInterface(this);
    this.ui.initSplash(50, 'Initializing interface...');

    this.socket = new DecafWebSocket(this);
    this.socket.setup();

    this.initTelopts();

    this.loaded = true;
    this.ui.endSplash();

    if (this.options.autoconnect && this.socket_ready) {
      this.connect();
    }
  }

  private initTelopts(): void {
    const gmcp = new GMCPTelopt(this);
    this.gmcp = gmcp;
    this.telopt[TN.GMCP] = gmcp;
    this.telopt[TN.ZMP] = new ZMPTelopt(this);
    this.telopt[TN.TTYPE] = new TTYPEHandler(this);
    this.telopt[TN.ECHO] = new ECHOHandler(this);
    this.telopt[TN.NAWS] = new NAWSHandler(this);
    this.telopt[TN.CHARSET] = new CHARSETHandler(this);
    this.telopt[TN.COMPRESSv2] = new COMPRESSv2Handler(this);
    this.telopt[TN.MSDP] = new MSDPHandler(this);
    this.telopt[TN.BINARY] = true;
  }

  public debugString(text: string, type: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    if (typeof console === 'undefined') return;
    const msg = `DecafMUD[${this.id}]: ${text}`;
    switch (type) {
      case 'info':
        console.info(msg);
        break;
      case 'warn':
        console.warn(msg);
        break;
      case 'error':
        console.error(msg);
        break;
      default:
        console.log(msg);
        break;
    }
  }

  public error(text: string): void {
    this.debugString(text, 'error');
    if (this.ui && this.ui.splashError(text)) return;
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`DecafMUD Error: ${text}`);
    }
  }

  public setEncoding(enc: string): void {
    const key = enc.replace(/-/g, '').toLowerCase();
    const plugin = ENCODINGS[key];
    if (!plugin) {
      throw new Error(`'${enc}' is not a valid encoding scheme.`);
    }
    this.debugString(`Switching to character encoding: ${enc}`);
    this.options.encoding = enc;
    this.currentEncoding = plugin;
  }

  public decode(data: string): [string, string] {
    return this.currentEncoding.decode(data);
  }

  public encode(data: string): string {
    return this.currentEncoding.encode(data);
  }

  public socketReady(): void {
    this.debugString('The socket is ready.');
    this.socket_ready = true;
    if (this.loaded && this.options.autoconnect) {
      this.connect();
    }
  }

  public socketConnected(): void {
    this.connecting = false;
    this.connected = true;
    this.connect_try = 0;
    if (this.conn_timer) clearTimeout(this.conn_timer);

    this.debugString(`Socket connected to ${this.socket.host}:${this.socket.port}`, 'info');

    for (const k in this.telopt) {
      const handler = this.telopt[k];
      if (typeof handler === 'object' && handler.connect) {
        handler.connect();
      }
    }

    if (this.textInputFilter) {
      this.textInputFilter.connected();
    }

    if (this.ui && this.ui.connected) {
      this.ui.connected();
    }

    this.emit('connect');
  }

  public socketClosed(): void {
    if (this.conn_timer) clearTimeout(this.conn_timer);
    this.connecting = false;
    this.connected = false;
    this.debugString('The socket has disconnected.', 'info');

    for (const k in this.telopt) {
      const handler = this.telopt[k];
      if (typeof handler === 'object' && handler.disconnect) {
        handler.disconnect();
      }
    }

    this.inbuf = [];
    this.decompressStream = undefined;
    this.startCompressV2 = false;

    if (this.ui && this.ui.disconnected) {
      this.ui.disconnected(this.options.autoreconnect);
    }

    this.emit('disconnect');
  }

  public socketData(data: string | Uint8Array): void {
    this.inbuf.push(data);
    if (this.loaded) {
      this.processBuffer();
    }
  }

  public socketError(msg: string): void {
    this.debugString(`Socket error: ${msg}`, 'error');
    this.emit('error', msg);
  }

  public sendInput(input: string): void {
    if (!this.socket || !this.connected) {
      this.debugString('Cannot send input: not connected', 'warn');
      return;
    }

    this.emit('send', input);
    const encoded = this.encode(input + '\r\n').replace(/\xFF/g, '\xFF\xFF');
    this.socket.write(encoded);

    if (this.ui) {
      this.ui.displayInput(input);
    }
  }

  public connect(): void {
    if (this.connecting || this.connected) return;
    if (!this.socket_ready) {
      throw new Error("The socket isn't ready yet.");
    }

    this.connecting = true;
    this.connect_try = 0;
    this.debugString('Attempting to connect...', 'info');

    if (this.ui && this.ui.connecting) {
      this.ui.connecting();
    }

    if (this.options.connect_timeout) {
      this.conn_timer = setTimeout(() => this.connectFail(), this.options.connect_timeout);
    }

    this.socket.connect();
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
    this.socketClosed();
  }

  public reconnect(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close error
      }
    }
    this.socketClosed();
    this.connect_try++;
    if (this.ui && this.ui.connecting) {
      this.ui.connecting();
    }
    this.socket.connect();
  }

  private connectFail(): void {
    if (this.conn_timer) clearTimeout(this.conn_timer);
    this.connect_try++;

    const tries = this.options.reconnect_tries ?? 3;
    if (this.connect_try > tries) return;

    this.socket.close();
    this.socket.connect();

    if (this.options.connect_timeout) {
      this.conn_timer = setTimeout(() => this.connectFail(), this.options.connect_timeout);
    }
  }

  public processBuffer(): void {
    const rawChunks: string[] = [];
    for (const chunk of this.inbuf) {
      if (typeof chunk === 'string') {
        rawChunks.push(chunk);
      } else {
        rawChunks.push(Array.from(chunk).map((charCode) => String.fromCharCode(charCode)).join(''));
      }
    }

    let data = rawChunks.join('');
    const IAC = TN.IAC;
    let left = '';
    this.inbuf = [];

    while (data.length > 0) {
      const ind = data.indexOf(IAC);
      if (ind === -1) {
        const enc = this.decode(data);
        this.handleInputText(enc[0]);
        if (enc[1]) this.inbuf.splice(1, 0, enc[1]);
        break;
      } else if (ind > 0) {
        const enc = this.decode(data.substring(0, ind));
        this.handleInputText(enc[0]);
        left = enc[1];
        data = data.substring(ind);
      }

      const out = this.readIAC(data);
      if (out === false) {
        this.inbuf.splice(1, 0, left + data);
        break;
      }
      data = left + out;
    }
  }

  public handleInputText(text: string): void {
    if (this.textInputFilter) {
      text = this.textInputFilter.filterInputText(text);
    }
    this.emit('data', text);
    if (this.display) {
      this.display.handleData(text);
    }
  }

  public readIAC(data: string): string | false {
    if (data.length < 2) return false;

    if (data.charCodeAt(1) === 255) {
      if (this.display) this.display.handleData('\xFF');
      return data.substring(2);
    }

    if (data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241) {
      return data.substring(2);
    }

    if ('\xFB\xFC\xFD\xFE'.indexOf(data.charAt(1)) !== -1) {
      if (data.length < 3) return false;
      const seq = data.substring(0, 3);
      this.debugString(`RCVD IAC sequence: ${seq.charCodeAt(1)} ${seq.charCodeAt(2)}`);
      this.handleIACSimple(seq);
      return data.substring(3);
    }

    if (data.charAt(1) === TN.SB) {
      const l = TN.IAC + TN.SE;
      const code = data.charAt(2);
      data = data.substring(3);
      if (data.length === 0) return false;

      let seq = '';
      while (data.length > 0) {
        const ind = data.indexOf(l);
        if (ind === -1) return false;
        if (ind > 0 && data.charAt(ind - 1) === TN.IAC) {
          seq += data.substring(0, ind + 1);
          data = data.substring(ind + 1);
          continue;
        }
        seq += data.substring(0, ind);
        data = data.substring(ind + 1);
        break;
      }

      const handler = this.telopt[code];
      if (typeof handler === 'object' && handler._sb) {
        handler._sb(seq);
      }
      return data;
    }

    return data.substring(1);
  }

  public sendIAC(seq: string): void {
    this.debugString(`SENT IAC sequence: ${seq.charCodeAt(1) || 0}`);
    if (this.socket) {
      this.socket.write(seq);
    }
  }

  private handleIACSimple(seq: string): void {
    const optionCode = seq.charAt(2);
    const handler = this.telopt[optionCode];

    if (handler === undefined) {
      if (seq.charAt(1) === TN.DO) {
        this.sendIAC(TN.IAC + TN.WONT + optionCode);
      } else if (seq.charAt(1) === TN.WILL) {
        this.sendIAC(TN.IAC + TN.DONT + optionCode);
      }
      return;
    }

    if (typeof handler === 'object') {
      switch (seq.charAt(1)) {
        case TN.DO:
          if (!(handler._do && handler._do() === false)) {
            this.sendIAC(TN.IAC + TN.WILL + optionCode);
          }
          break;
        case TN.DONT:
          if (!(handler._dont && handler._dont() === false)) {
            this.sendIAC(TN.IAC + TN.WONT + optionCode);
          }
          break;
        case TN.WILL:
          if (!(handler._will && handler._will() === false)) {
            this.sendIAC(TN.IAC + TN.DO + optionCode);
          }
          break;
        case TN.WONT:
          if (!(handler._wont && handler._wont() === false)) {
            this.sendIAC(TN.IAC + TN.DONT + optionCode);
          }
          break;
      }
    }
  }

  public about(): void {
    const abt = [
      `DecafMUD v${DecafMUD.version.toString()} © Stendec`,
      'A modern web-based MUD client written in TypeScript.',
      'Free to use and modify under the MIT License.',
    ];
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(abt.join('\n\n'));
    }
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).DecafMUD = DecafMUD;
}
