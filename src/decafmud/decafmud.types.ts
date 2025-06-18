// SPDX-License-Identifier: MIT

import * as pako from 'pako';

// Forward declaration for the main class
export interface IDecafMUD {
  // Properties
  options: DecafMUDOptions;
  settings: DecafMUDSettings;
  loaded: boolean;
  connecting: boolean;
  connected: boolean;
  id: number;
  need: [string, () => boolean][]; // Array of modules to load
  inbuf: (string | Uint8Array)[];
  telopt: { [key: string]: ITeloptHandler | boolean | undefined };
  isCompressionActive: boolean;
  pakoInflateStream?: pako.Inflate;
  ui?: IUi;
  socket?: ISocket;
  display?: IDisplay;
  store?: IStorage;
  storage?: IStorage; // Alias for store
  textInputFilter?: ITextInputFilter;
  version: { major: number; minor: number; micro: number; flag: string; toString: () => string; };
  socket_ready?: boolean;
  conn_timer?: number; // Timer ID
  loadTimer?: number; // Timer ID
  timer?: number; // Timer ID
  connect_try: number;
  required: number;
  extra?: number; // Used in loading splash

  // Constructor signature (not directly in interface, but for reference)
  // new (options?: Partial<DecafMUDOptions>): IDecafMUD;

  // Methods
  debugString(text: string, type?: string, obj?: any): void;
  error(text: string): void;
  loadScript(filename: string, path?: string): void;
  require(module: string, check?: () => boolean): void;
  waitLoad(next: () => void, itemloaded?: (module: string, next_mod?: string, perc?: number) => void, tr?: number): void;
  initSplash(): void;
  updateSplash(module: string | boolean | null, next_mod?: string, perc?: number): void;
  initSocket(): void;
  initUI(): void;
  initFinal(): void;
  connect(): void;
  connectFail(): void;
  reconnect(): void;
  socketReady(): void;
  socketConnected(): void;
  socketClosed(): void;
  socketData(data: string | Uint8Array): void;
  socketError(data: string, data2?: string): void;
  getEnc(enc: string): string;
  setEncoding(enc: string): void;
  sendInput(input: string): void;
  decode(data: string): [string, string];
  encode(data: string): string;
  processBuffer(): void;
  handleInputText(text: string): void;
  readIAC(data: string): string | boolean;
  sendIAC(seq: string): void;
  handleIACSimple(seq: string): void;
  requestPermission(option: string, prompt: string, callback: (result: boolean) => void): void;
  disableMCCP2(): void;

  // GMCP specific, might move to a GMCP plugin interface later
  gmcp?: IGMCP; // Reference to the GMCP handler instance
  zmp?: IZMP; // Reference to the ZMP handler instance
}

export interface DecafMUDOptions {
  host?: string;
  port?: number;
  autoconnect?: boolean;
  connectonsend?: boolean;
  autoreconnect?: boolean;
  connect_timeout?: number;
  reconnect_delay?: number;
  reconnect_tries?: number;
  storage?: string;
  display?: string;
  encoding?: string;
  socket?: string;
  interface?: string;
  textinputfilter?: string;
  jslocation?: string;
  wait_delay?: number;
  wait_tries?: number;
  plugins?: string[];
  set_storage?: any; // Can be more specific if storage options are known
  set_display?: SetDisplayOptions;
  set_socket?: SetSocketOptions;
  set_interface?: SetInterfaceOptions;
  ttypes?: string[];
  environ?: { [key: string]: string };
  encoding_order?: string[];
  plugin_order?: string[];
}

export interface SetDisplayOptions {
  handlecolor?: boolean;
  fgclass?: string;
  bgclass?: string;
  fntclass?: string;
  inputfg?: string;
  inputbg?: string;
}

export interface SetSocketOptions {
  wsport?: number;
  wspath?: string;
  ssl?: boolean; // Added based on DecafWebSocket
}

export interface SetInterfaceOptions {
  container?: string | HTMLElement;
  start_full?: boolean;
  mru?: boolean;
  mru_size?: number;
  multiline?: boolean;
  clearonsend?: boolean;
  focusinput?: boolean;
  repeat_input?: boolean;
  blurclass?: string;
  msg_connect?: string;
  msg_connecting?: string;
  msg_empty?: string;
  connect_hint?: boolean;
}

export interface DecafMUDSettingsEntry {
  _path?: string;
  _desc?: string;
  _type?: string; // 'boolean', 'font', 'text', 'password', 'nochance' (Yes/No select)
  _name?: string; // Optional display name
  [key: string]: any; // For nested settings or actual value
}

export interface DecafMUDSettings {
  [key: string]: DecafMUDSettingsEntry;
}

export interface IPlugin {
  new (decaf: IDecafMUD): any; // Generic constructor for a plugin
}

export interface ISocket {
  host?: string;
  port?: number;
  ssl?: boolean;
  connected: boolean;
  ready: boolean;
  websocket?: WebSocket; // Specific to WebSocket implementation

  setup(arg?: any): void; // arg is 0 in decafmud.ts for socket.setup(0)
  connect(): void;
  close(): void;
  assertConnected?(): void; // Optional, as it's internal to DecafWebSocket
  /**
   * Writes data to the socket.
   * @param {Uint8Array} data The byte array to write.
   */
  write(data: Uint8Array): void;

  // Event handlers, usually bound
  onOpen?(websocket: WebSocket, event: Event): void;
  onClose?(websocket: WebSocket, event: CloseEvent): void;
  onMessage?(websocket: WebSocket, event: MessageEvent): void;
}

export interface IUi {
  decaf: IDecafMUD;
  container: HTMLElement;
  el_display: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement;
  _input: HTMLElement; // Container for input and tray
  tray: HTMLElement;
  toolbar: HTMLElement;
  toolbuttons: { [id: number]: [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, Function | undefined] }; // [btnEl, text, icon, tooltip, type, enabled, pressed, class, onclick]
  infobars: any[]; // Array of infobar objects
  icons: [HTMLElement, Function | undefined, Function | undefined][]; // [iconEl, onclick, onkey]
  echo: boolean;
  inpFocus: boolean;
  splash: HTMLElement | null;
  splash_st: HTMLElement | null; // Status text in splash
  splash_pgi: HTMLElement | null; // Progress inner bar in splash
  splash_pgt: HTMLElement | null; // Progress text in splash
  splash_old: HTMLElement | null; // Old messages in splash
  scrollButton?: HTMLElement;
  settings?: HTMLElement; // Settings window
  store?: IStorage; // UI specific storage

  initSplash(percentage?: number, message?: string): void;
  endSplash(): void;
  updateSplash(percentage?: number, message?: string): void;
  splashError(message: string): boolean;
  showSize?(): void; // Optional as it's part of SimpleInterface
  hideSize?(fnl?: boolean): void; // Optional
  connected(): void;
  connecting(): void;
  disconnected(reconnecting?: boolean): void; // Added reconnecting based on usage
  load(): void;
  reset(): void;
  setup(): void;
  showLogs?(): void;
  showSettings?(): void;
  tbDelete(id: number): void;
  tbText(id: number, text: string): void;
  tbTooltip(id: number, tooltip: string): void;
  tbEnabled(id: number, enabled: boolean): void;
  tbPressed(id: number, pressed: boolean): void;
  tbClass(id: number, clss: string): void;
  tbIcon(id: number, icon: string): void;
  tbNew(text: string, icon?: string, tooltip?: string, type?: number, enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void): number;
  infoBar(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): void;
  immediateInfoBar(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): boolean;
  createIBar?(): void; // Internal helper
  closeIBar?(steptwo?: boolean): void; // Internal helper
  addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number;
  delIcon(ind: number): void;
  updateIcon(ind: number, text?: string, html?: string, clss?: string): void;
  enter_fs?(showSize?: boolean): void;
  exit_fs?(): void;
  resizeScreen(showSize?: boolean, force?: boolean): void;
  displayInput(text: string): void;
  localEcho(echo: boolean): void;
  updateInput(force?: boolean): void;
  handleBlur(e: FocusEvent): void; // Added based on usage
  handleInput(e: KeyboardEvent): void; // Added based on usage
  displayKey?(e: KeyboardEvent): void; // Added based on usage
}

export interface IDisplay {
  decaf: IDecafMUD;
  ui: IUi;
  display: HTMLElement; // The actual display element

  // Methods from the base display or standard display
  handleData(text: string): void;
  message(text: string, className?: string, multi?: boolean): void;
  reset(): void;
  scroll(): void;
  scrollUp?(): void;
  scrollDown?(): void;
  scrollNew?(): void;
  shouldScroll(can?: boolean): void;
  doScroll(): void;
  getSize(): [number, number]; // [width, height] in characters
}

export interface IStorage {
  // Based on common storage patterns, actual methods depend on implementation
  get(key: string, def?: any): any;
  set(key: string, value: any): void;
  sub(path: string): IStorage; // For hierarchical storage
  clear?(): void;
  remove?(key: string): void;
}

export interface ITeloptHandler {
  decaf: IDecafMUD;
  // Common methods, specific handlers might have more
  connect?(): void;
  disconnect?(): void;
  _will?(data?: string): boolean | void;
  _wont?(data?: string): boolean | void;
  _do?(data?: string): boolean | void;
  _dont?(data?: string): boolean | void;
  _sb?(data: string): boolean | void; // data is the subnegotiation string
}

export interface IGMCP extends ITeloptHandler {
  pingDelay: number;
  pingAverage: number;
  pingCount: number;
  pingWhen?: Date;
  pingTimer?: any;
  packages: {
    Core: {
      ' version': number;
      Ping: (data?: any) => void;
      Goodbye: (data?: any) => void;
      [key: string]: any; // For other Core.* messages
    };
    [key: string]: any; // For other top-level packages like Char, Room etc.
  };
  sendGMCP(pckg: string, data?: any): void;
  getFunction(pckg: string): Function | undefined;
  ping(): void; // Added from GMCP.prototype.ping
}

/**
 * Interface for ZMP (Zenith MUD Protocol) message handling.
 * Extends the base Telnet option handler.
 */
export interface IZMP extends ITeloptHandler {
  /**
   * Sends a ZMP command to the server.
   * @param cmd The ZMP command string.
   * @param data Optional array of string data accompanying the command.
   */
  sendZMP(cmd: string, data?: string[]): void;

  /**
   * Retrieves a ZMP function or a package of functions.
   * If package_ok is true and the command corresponds to a package,
   * the entire package object is returned. Otherwise, the specific function
   * is returned.
   * @param cmd The ZMP command or package name.
   * @param package_ok Whether to allow returning a whole package.
   * @returns The ZMP function, a package object, or undefined if not found.
   */
  getFunction(cmd: string, package_ok?: boolean): ((cmd: string, data: string[]) => void) | object | undefined;

  /**
   * Adds or replaces a ZMP function handler.
   * @param cmd The ZMP command to register a handler for.
   * @param func The function to be executed when the ZMP command is received.
   *                It takes the command itself and an array of data strings as arguments.
   */
  addFunction(cmd: string, func: (cmd: string, data: string[]) => void): void;

  /**
   * Stores the registered ZMP commands and their handlers or packages.
   * Structure can be nested, e.g., { "package.command": func, "other_cmd": func }
   * or { "package": { "command": func } }
   */
  commands: any; // Using 'any' for now due to potentially complex nested structure.
}

export interface DecafMUDConstructor {
  new(options?: Partial<DecafMUDOptions>): IDecafMUD;
  instances: IDecafMUD[];
  last_id: number;
  version: { major: number; minor: number; micro: number; flag: string; toString: () => string; };
  plugins: {
    Display: { [key: string]: IPlugin & { new(decaf: IDecafMUD, ui: IUi, el: HTMLElement): IDisplay; } };
    Encoding: {
      iso88591: IEncoding;
      utf8: IEncoding;
      [key: string]: IEncoding | undefined; // For other encodings
    };
    Extra: { [key: string]: IPlugin }; // Assuming IPlugin is a generic base or specific interfaces will be used
    Interface: { [key: string]: IPlugin & { new(decaf: IDecafMUD): IUi; } };
    Socket: { [key: string]: IPlugin & { new(decaf: IDecafMUD): ISocket; } };
    Storage: { [key: string]: IPlugin & { new(decaf: IDecafMUD): IStorage; } };
    Telopt: { [key: string]: (IPlugin & { new(decaf: IDecafMUD): ITeloptHandler; }) | boolean | undefined };
    TextInputFilter: { [key: string]: IPlugin & { new(decaf: IDecafMUD): ITextInputFilter; } };
  };
  options: DecafMUDOptions; // static default options
  settings: DecafMUDSettings; // static default settings
  TN: {
    // Telnet Command Bytes (RFC 854)
    SE: number;     // Subnegotiation End
    NOP: number;    // No Operation
    DM: number;     // Data Mark
    BRK: number;    // Break
    IP: number;     // Interrupt Process
    AO: number;     // Abort Output
    AYT: number;    // Are You There
    EC: number;     // Erase Character
    EL: number;     // Erase Line
    GA: number;     // Go Ahead
    SB: number;     // Subnegotiation Begin
    WILL: number;   // Will option
    WONT: number;   // Won't option
    DO: number;     // Do option
    DONT: number;   // Don't option
    IAC: number;    // Interpret As Command

    // Telnet Option Codes (RFC 855 and others)
    TRANSMIT_BINARY: number; // RFC 856
    ECHO: number;            // RFC 857
    RECONNECTION: number;    // RFC 680 (obsoleted by RFC 4777)
    SUPPRESS_GO_AHEAD: number; // RFC 858
    STATUS: number;          // RFC 859
    TIMING_MARK: number;     // RFC 860
    EXTENDED_OPTIONS_LIST: number; // RFC 861

    TTYPE: number;           // Terminal Type (RFC 930, RFC 1091)
    NAWS: number;            // Negotiate About Window Size (RFC 1073)
    TERMINAL_SPEED: number;  // RFC 1079
    REMOTE_FLOW_CONTROL: number; // RFC 1080 (often miscited as RFC 1372)
    LINEMODE: number;        // RFC 1184
    X_DISPLAY_LOCATION: number; // RFC 1096
    NEW_ENVIRON: number;     // RFC 1572 (replaces ENVIRON RFC 1408)

    COMPRESS: number;        // MCCP v1 (unofficial, widely used)
    COMPRESS2: number;       // MCCP v2 (RFC 1950, unofficial, widely used)

    MSP: number;             // MUD Sound Protocol (unofficial)
    MXP: number;             // MUD eXtension Protocol (unofficial)
    ZMP: number;             // Zenith MUD Protocol (unofficial)
    GMCP: number;            // Generic MUD Communication Protocol (unofficial)

    // MUD Server Data Protocol (unofficial)
    MSDP: number;
    // MUD Client Compression Protocol (unofficial)
    MCCP3: number; // MCCP v3 (unofficial)

    // Telnet Option Numbers from IANA registry (incomplete, just examples)
    TELOPT_CHARSET: number; // RFC 2066
  };
  ESC: string;
  BEL: string;
  debugIAC(seq: string): string;
}

export interface IEncoding {
  proper: string; // e.g., 'UTF-8'
  /**
   * Decodes a Uint8Array of bytes into a JavaScript string.
   * @param {Uint8Array} data The byte array to decode.
   * @returns {[string, Uint8Array]} A tuple containing the decoded string and any remaining unprocessed bytes.
   */
  decode(data: Uint8Array): [string, Uint8Array];
  /**
   * Encodes a JavaScript string into a Uint8Array of bytes.
   * @param {string} data The string to encode.
   * @returns {Uint8Array} The resulting byte array.
   */
  encode(data: string): Uint8Array;
}

export interface ITextInputFilter {
  decaf: IDecafMUD;
  filterInputText(text: string): string;
  connected(): void;
}

// Global DecafMUD constructor type
declare var DecafMUD: DecafMUDConstructor;
