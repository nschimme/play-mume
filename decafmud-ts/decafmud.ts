import { DecafMUDOptions } from './types';
import * as pako from 'pako';

// TELNET Constants
const TN = {
  // Negotiation Bytes
  IAC: '\xFF', // 255
  DONT: '\xFE', // 254
  DO: '\xFD', // 253
  WONT: '\xFC', // 252
  WILL: '\xFB', // 251
  SB: '\xFA', // 250
  SE: '\xF0', // 240
  IS: '\x00', // 0
  COMPRESSv2: 'V', // 86
  // ... (other TELNET constants can be added here as needed)
};

let lastInstanceId = -1;

export class DecafMUD {
  // Static properties
  public static instances: DecafMUD[] = [];
  public static version = {
    major: 1,
    minor: 0,
    micro: 0,
    flag: 'alpha',
    toString: () => `${DecafMUD.version.major}.${DecafMUD.version.minor}.${DecafMUD.version.micro}${DecafMUD.version.flag ? '-' + DecafMUD.version.flag : ''}`,
  };

  // Public properties
  public id: number;
  public options: DecafMUDOptions;
  public loaded = false;
  public connecting = false;
  public connected = false;

  // Internal properties
  private inbuf: (string | Uint8Array)[] = [];
  private telopt: Record<string, unknown> = {};
  private decompressStream: pako.Inflate | undefined;
  private startCompressV2 = false;
  private socket: { write: (data: string) => void, connect: () => void, host: string, port: number } | undefined;
  private display: { handleData: (data: string) => void } | undefined;
  public ui: { connecting: () => void, connected: () => void, disconnected: () => void, displayInput: (input: string) => void, splashError: (text: string) => void } | undefined;
  public textInputFilter: { filterInputText: (text: string) => string } | undefined;
  private storage: { get: (key: string, def?: unknown) => unknown, set: (key: string, val: unknown) => void, del: (key: string) => void } | undefined;
  private encoding: { decode: (data: string) => [string, string], encode: (data: string) => string } | undefined;
  private conn_timer: number | undefined;

  constructor(options: DecafMUDOptions) {
    this.id = ++lastInstanceId;
    DecafMUD.instances.push(this);

    // Deep merge of default and provided options
    this.options = this.mergeOptions(this.getDefaultOptions(), options);

    this.debugString('Created new instance.', 'info');

    // Install plugins
    if (this.options.plugins) {
      for (const plugin of this.options.plugins) {
        plugin.install(this);
      }
    }

    if (this.options.autoconnect) {
      this.connect();
    }

    this.telopt[TN.COMPRESSv2] = {
        _will: () => {
            this.debugString('MCCP2 compression enabled.');
        },
        _sb: () => {
            this.startCompressV2 = true;
        }
    };
  }

  /**
   * Deeply merges options.
   */
  private mergeOptions(defaults: DecafMUDOptions, overrides: DecafMUDOptions): DecafMUDOptions {
    const result: DecafMUDOptions = { ...defaults };
    for (const key in overrides) {
      const k = key as keyof DecafMUDOptions;
      if (overrides[k] instanceof Object && !Array.isArray(overrides[k]) && result[k] instanceof Object) {
        (result as Record<string, unknown>)[k] = this.mergeOptions((result as Record<string, unknown>)[k] as DecafMUDOptions, overrides[k] as DecafMUDOptions);
      } else {
        (result as Record<string, unknown>)[k] = overrides[k];
      }
    }
    return result;
  }

  /**
   * Registers a socket handler.
   */
  public registerSocket(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.socket === name) {
          this.socket = new constructor(this) as { write: (data: string) => void, connect: () => void, host: string, port: number };
      }
  }

  /**
   * Registers a display handler.
   */
  public registerDisplay(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.display === name) {
          this.display = new constructor(this) as { handleData: (data: string) => void };
      }
  }

  /**
   * Registers a storage handler.
   */
  public registerStorage(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.storage === name) {
          this.storage = new constructor(this) as { get: (key: string, def?: unknown) => unknown, set: (key: string, val: unknown) => void, del: (key: string) => void };
      }
  }

  /**
   * Registers a encoding handler.
   */
  public registerEncoding(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.encoding === name) {
          this.encoding = new constructor(this) as { decode: (data: string) => [string, string], encode: (data: string) => string };
      }
  }

  /**
   * Registers a interface handler.
   */
  public registerInterface(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.interface === name) {
          this.ui = new constructor(this) as { connecting: () => void, connected: () => void, disconnected: () => void, displayInput: (input: string) => void, splashError: (text: string) => void };
      }
  }

  /**
   * Registers a text input filter.
   */
  public registerTextInputFilter(name: string, constructor: new (decaf: DecafMUD) => unknown): void {
      if (this.options.textinputfilter === name) {
          this.textInputFilter = new constructor(this) as { filterInputText: (text: string) => string };
      }
  }


  public connect(): void {
    if (this.connecting || this.connected) {
      return;
    }

    if (!this.socket) {
        throw new Error(`Socket handler for '${this.options.socket}' not registered or loaded.`);
    }

    this.connecting = true;
    this.debugString('Attempting to connect...', 'info');

    // Show that we're connecting
    if (this.ui && this.ui.connecting) {
      this.ui.connecting();
    }

    // Set a timer so we can try again.
    this.conn_timer = setTimeout(
      () => this.connectFail(),
      this.options.connect_timeout
    );

    this.socket.connect();
  }

  public reconnect(): void {
      if (this.socket) {
          this.socket.connect();
      }
  }

  private enableCompression(): void {
      this.decompressStream = new pako.Inflate({ to: 'string' });
  }

  private connectFail(): void {
    clearTimeout(this.conn_timer);
    // Add reconnect logic here if needed
  }

  public socketConnected(): void {
    this.connecting = false;
    this.connected = true;
    clearTimeout(this.conn_timer);

    const host = this.socket.host;
    const port = this.socket.port;

    this.debugString(`The socket has connected successfully to ${host}:${port}.`,"info");

    if (this.ui && this.ui.connected) {
        this.ui.connected();
    }
  }

  public socketClosed(): void {
      this.connected = false;
      if (this.ui && this.ui.disconnected) {
          this.ui.disconnected();
      }
  }

  public socketData(data: string | Uint8Array): void {
    if (this.startCompressV2) {
        this.enableCompression();
        this.startCompressV2 = false;
    }

    if (this.decompressStream) {
        // Decompress it first!
        try {
            (this.decompressStream as { push: (data: string | Uint8Array, mode: boolean) => void, err: number, msg: string, result: string | Uint8Array }).push(data, false);
            if ((this.decompressStream as { err: number }).err) {
                throw new Error((this.decompressStream as { msg: string }).msg);
            }
            this.inbuf.push((this.decompressStream as { result: string | Uint8Array }).result);
        } catch (e) {
            this.error('MCCP2 compression disabled because ' + (e as Error).message);
            this.disableMCCP2();
            return;
        }
    } else {
        this.inbuf.push(data);
    }
    this.processBuffer();
  }

  private processBuffer(): void {
    let buffer = '';
    for (const chunk of this.inbuf) {
        if (typeof chunk === 'string') {
            buffer += chunk;
        } else {
            // Assuming the Uint8Array contains UTF-8 text
            const decoder = new TextDecoder();
            buffer += decoder.decode(chunk);
        }
    }
    this.inbuf = [];

    let iacIndex;
    while ((iacIndex = buffer.indexOf(TN.IAC)) !== -1) {
        // Handle text before IAC
        if (iacIndex > 0) {
            this.handleInputText(buffer.substring(0, iacIndex));
        }

        // Handle IAC sequence
        const command = buffer.charAt(iacIndex + 1);
        if (command === TN.IAC) { // Escaped IAC
            this.handleInputText(TN.IAC);
            buffer = buffer.substring(iacIndex + 2);
        } else if (command === TN.SB) {
            const endIndex = buffer.indexOf(`${TN.IAC}${TN.SE}`, iacIndex + 2);
            if (endIndex === -1) {
                // Incomplete subnegotiation, put back in buffer
                this.inbuf.unshift(buffer.substring(iacIndex));
                buffer = '';
                break;
            }
            const telopt = buffer.charAt(iacIndex + 2);
            const data = buffer.substring(iacIndex + 3, endIndex);
            this.handleSubnegotiation(telopt, data);
            buffer = buffer.substring(endIndex + 2);
        } else {
            // Other IAC commands (DO, DONT, WILL, WONT)
            const telopt = buffer.charAt(iacIndex + 2);
            this.handleIAC(command, telopt);
            buffer = buffer.substring(iacIndex + 3);
        }
    }

    // Handle any remaining text
    if (buffer.length > 0) {
        this.handleInputText(buffer);
    }
  }

  private handleSubnegotiation(telopt: string, data: string): void {
    const handler = this.telopt[telopt] as { _sb: (data: string) => void };
    if (handler && handler._sb) {
        handler._sb(data);
    } else {
        this.debugString(`Received unhandled subnegotiation for telopt ${telopt.charCodeAt(0)}`);
    }
  }

  private handleIAC(command: string, telopt: string): void {
      const handler = this.telopt[telopt] as { _will: () => void, _wont: () => void, _do: () => void, _dont: () => void };
      if (handler) {
          if (command === TN.WILL && handler._will) handler._will();
          else if (command === TN.WONT && handler._wont) handler._wont();
          else if (command === TN.DO && handler._do) handler._do();
          else if (command === TN.DONT && handler._dont) handler._dont();
      } else {
          this.debugString(`Received unhandled IAC command ${command.charCodeAt(0)} for telopt ${telopt.charCodeAt(0)}`);
      }
  }

  private handleInputText(text: string): void {
      if (this.display) {
          this.display.handleData(text);
      }
  }

  public sendInput(input: string): void {
    if (!this.socket || !this.connected) {
      this.debugString('Cannot send input: not connected');
      return;
    }

    // Basic encoding and escaping
    const encodedInput = (input + '\r\n').replace(/\xFF/g, '\xFF\xFF');
    this.socket.write(encodedInput);

    if (this.ui) {
      this.ui.displayInput(input);
    }
  }

  public sendIAC(data: string): void {
      if (this.socket) {
          this.socket.write(data);
      }
  }

  private disableMCCP2(): void {
    this.decompressStream = undefined;
    this.startCompressV2 = false;
  }

  public error(text: string): void {
      console.error(`DecafMUD[${this.id}]: ${text}`);
      if (this.ui && this.ui.splashError) {
          this.ui.splashError(text);
      } else {
          alert(`DecafMUD Error:\n\n${text}`);
      }
  }

  public debugString(text: string, type: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    const st = `DecafMUD[${this.id}]: ${text}`;
    switch (type) {
      case 'info':
        console.info(st);
        break;
      case 'warn':
        console.warn(st);
        break;
      case 'error':
        console.error(st);
        break;
      default:
        console.debug(st);
        break;
    }
  }

  private getDefaultOptions(): DecafMUDOptions {
      return {
        host: 'localhost',
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
        socket: 'websocket',
        interface: 'simple',
        textinputfilter: '',
        jslocation: '',
        wait_delay: 25,
        wait_tries: 1000,
        plugins: [],
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
            wsport: undefined,
            wspath: '',
        },
        set_interface	: {
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
            msg_empty: 'Type commands here...',
            connect_hint: true
        },
        ttypes: [`decafmud-${DecafMUD.version}`, 'decafmud', 'xterm', 'unknown'],
        environ: {},
        encoding_order: ['utf8'],
      };
  }
}
