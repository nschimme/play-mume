/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

export interface DecafMUDDisplayOptions {
  maxscreens?: number;
  minelements?: number;
  handlecolor?: boolean;
  fgclass?: string;
  bgclass?: string;
  fntclass?: string;
  inputfg?: string;
  inputbg?: string;
  scrollbarwidth?: number;
}

export interface DecafMUDSocketOptions {
  wsport?: number;
  wspath?: string;
  ssl?: boolean;
  policyport?: number;
  swf?: string;
}

export interface DecafMUDInterfaceOptions {
  container?: string | HTMLElement | null;
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
  language?: string;
  textinputfilter?: string;
  jslocation?: string;
  wait_delay?: number;
  wait_tries?: number;
  load_language?: boolean;
  plugins?: string[];
  set_storage?: Record<string, unknown>;
  set_display?: DecafMUDDisplayOptions;
  set_socket?: DecafMUDSocketOptions;
  set_interface?: DecafMUDInterfaceOptions;
  ttypes?: string[];
  environ?: Record<string, string>;
  encoding_order?: string[];
  plugin_order?: string[];
}

export interface DecafMUDStorage {
  get<T = unknown>(key: string, def?: T): T;
  set<T = unknown>(key: string, val: T): void;
  del(key: string): boolean;
  sub(name: string): DecafMUDStorage;
  keys(): string[];
  change(path: string): void;
}

export interface DecafMUDSocket {
  connected: boolean;
  ready: boolean;
  host?: string;
  port?: number;
  ssl?: boolean;
  setup(attempt?: number): void;
  connect(): void;
  close(): void;
  write(data: string): void;
}

export interface DecafMUDDisplay {
  display: HTMLElement;
  clear(): void;
  reset(): void;
  handleData(data: string): void;
  message(text: string, className?: string, needLine?: boolean): void;
  getSize(): [number, number];
  scroll(): void;
  scrollUp(): void;
  scrollDown(): void;
  scrollNew(): void;
  shouldScroll(addTarget?: boolean): void;
  doScroll(): void;
}

export interface DecafMUDInterface {
  container?: HTMLElement;
  el_display?: HTMLElement;
  input?: HTMLInputElement | HTMLTextAreaElement;
  display?: DecafMUDDisplay;
  initSplash(percentage?: number, message?: string): void;
  endSplash(): void;
  updateSplash(perc?: number, next_mod?: string | null): void;
  splashError(message: string): boolean;
  load(): void;
  setup(): void;
  reset(): void;
  connected(): void;
  connecting(): void;
  disconnected(reconnecting?: boolean): void;
  displayInput(text: string): void;
  localEcho(echo: boolean): void;
  infoBar?(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): void;
  immediateInfoBar?(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): boolean;
  showScrollButton?(): void;
  hideScrollButton?(): void;
  resizeScreen?(showSize?: boolean, force?: boolean): void;
  showSidebar?(): void;
  hideSidebar?(): void;
  showProgressBars?(): void;
  hideProgressBars?(): void;
  showMap?(): void;
  hideMap?(): void;
  addProgressBar?(name: string, col: string): void;
  setProgress?(name: string, percent: number, txt: string): void;
  setProgressColor?(name: string, col: string): void;
  showPopup?(): HTMLElement;
  hidePopup?(): void;
  maxPopupWidth?(): number;
  maxPopupHeight?(): number;
  verticalPopupOffset?(): number;
  horizontalPopupOffset?(): number;
}

export interface DecafMUDTextInputFilter {
  filterInputText(text: string): string;
  connected(): void;
}

export interface GMCPRoomInfoData {
  id?: number | string;
  name?: string;
  desc?: string;
  area?: string;
  environment?: string;
  exits?: Record<string, unknown>;
}

export interface GMCPEventMovedData {
  dir?: string;
}

export interface GMCPHandlerCallback {
  (data: unknown): void;
}

export interface GMCPPlugin {
  _will?: (...args: unknown[]) => void;
  _wont?: () => void;
  _sb?: (data: string) => boolean | undefined;
  disconnect?: () => void;
  sendGMCP(pckg: string, data?: unknown): void;
  getFunction(pckg: string): ((data: unknown) => void) | undefined;
  registerHandler(pckg: string, callback: GMCPHandlerCallback): () => void;
  unregisterHandler(pckg: string, callback: GMCPHandlerCallback): void;
  packages: Record<string, unknown>;
}

export interface TeloptHandler {
  _do?: () => boolean | void;
  _dont?: () => boolean | void;
  _will?: () => boolean | void;
  _wont?: () => boolean | void;
  _sb?: (data: string) => boolean | void;
  connect?: () => void;
  disconnect?: () => void;
}

export interface EncodingPlugin {
  proper: string;
  decode(data: string): [string, string];
  encode(data: string): string;
}

export const TN = {
  IAC: '\xFF',
  DONT: '\xFE',
  DO: '\xFD',
  WONT: '\xFC',
  WILL: '\xFB',
  SB: '\xFA',
  SE: '\xF0',
  IS: '\x00',
  EORc: '\xEF',
  GA: '\xF9',
  BINARY: '\x00',
  ECHO: '\x01',
  SUPGA: '\x03',
  STATUS: '\x05',
  SENDLOC: '\x17',
  TTYPE: '\x18',
  EOR: '\x19',
  NAWS: '\x1F',
  TSPEED: '\x20',
  RFLOW: '\x21',
  LINEMODE: '\x22',
  AUTH: '\x23',
  NEWENV: '\x27',
  CHARSET: '\x2A',
  MSDP: 'E',
  MSSP: 'F',
  COMPRESS: 'U',
  COMPRESSv2: 'V',
  MSP: 'Z',
  MXP: '[',
  ZMP: ']',
  CONQUEST: '^',
  ATCP: '\xC8',
  GMCP: '\xC9',
} as const;

export const ESC = '\x1B';
export const BEL = '\x07';
