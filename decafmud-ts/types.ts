import type { DecafMUD } from './decafmud';

/**
 * Defines the contract for a DecafMUD plugin.
 */
export interface Plugin {
  /** A unique name for the plugin. */
  readonly name: string;

  /**
   * Called by the DecafMUD core to initialize the plugin.
   * @param decaf The DecafMUD instance.
   */
  install(decaf: DecafMUD): void;
}

/**
 * Configuration options for a DecafMUD instance.
 */
export interface DecafMUDOptions {
  // Connection Basics
  host?: string;
  port?: number;
  autoconnect?: boolean;
  connectonsend?: boolean;
  autoreconnect?: boolean;
  connect_timeout?: number;
  reconnect_delay?: number;
  reconnect_tries?: number;

  // Plugins to use
  storage?: string;
  display?: string;
  encoding?: string;
  socket?: string;
  interface?: string;
  textinputfilter?: string;

  // Loading Settings
  jslocation?: string;
  wait_delay?: number;
  wait_tries?: number;
  plugins?: Plugin[];

  // Storage Settings
  set_storage?: Record<string, unknown>;

  // Display Settings
  set_display?: {
    maxscreens?: number;
    minelements?: number;
    handlecolor?: boolean;
    fgclass?: string;
    bgclass?: string;
    fntclass?: string;
    inputfg?: string;
    inputbg?: string;
  };

  // Socket Settings
  set_socket?: {
    policyport?: number;
    swf?: string;
    wsport?: number;
    wspath?: string;
    ssl?: boolean;
  };

  // Interface Settings
  set_interface?: {
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
  };

  // Telnet Settings
  ttypes?: string[];
  environ?: Record<string, unknown>;
  encoding_order?: string[];
}
