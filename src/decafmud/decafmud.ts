// SPDX-License-Identifier: MIT
// Copyright (c) 2012-2021 gunther cox, All rights reserved.
// Copyright (c) 2022-2023 The Mudlets. All rights reserved.

/**
 * @fileoverview This file defines the DecafMUD class, the core of the client.
 * It handles WebSocket connections, Telnet option negotiation, data display,
 * and plugin management.
 */

// Define DecafMUDGlobal if it's not already defined (for plugin compatibility)
if (typeof DecafMUDGlobal === 'undefined') {
  // We'll assign DecafMUD to it later, once the class is defined.
  // Using 'any' for now as the class isn't defined yet.
  (window as any).DecafMUDGlobal = {};
}

/**
 * The main DecafMUD client class.
 */
export default class DecafMUD {
  // #region Properties
  // Store the options
  options: any = {
    // The host to connect to
    host: null,

    // The port to connect to
    port: null,

    // The path to connect to (for WebSocket)
    path: '/',

    // SSL?
    ssl: false,

    // Default socket type
    socket: 'websocket', // Changed from 'flash'

    // Path to SWF for Flash socket (if used, though default is now websocket)
    // swf: 'swf/decafmud.swf', // Commented out as flash is no longer default

    // What to do on connect
    on_connect: null,

    // What to do on disconnect
    on_disconnect: null,

    // What to do on data
    on_data: null,

    // What to do on error
    on_error: null,

    // What to do when a telnet subnegotiation is received
    on_telnet: null,

    // What to do when we receive a GMCP message
    on_gmcp: null,

    // What to do when a new option is set
    on_option_set: null,

    // What to do when DecafMUD is ready
    on_ready: null,

    // The default encoding to use.
    encoding: 'utf8',

    // The element to append the display to
    display_element: null,

    // The type of display to use.
    display_type: 'standard',

    // Whether to parse ANSI
    parse_ansi: true,

    // Whether to strip repeating newlines.
    strip_newlines: false,

    // The maximum number of lines to store in a display.
    // Set to 0 for infinite.
    line_buffer_size: 0, // Keep all lines

    // The maximum number of commands to store in history.
    command_history_size: 100,

    // How many commands to show from history at once.
    command_history_display: 5,

    // Enable MCCP (Mud Client Compression Protocol)
    mccp: true,

    // Enable GMCP (Generic Mud Communication Protocol)
    gmcp: true,

    // Default prompt title for popups.
    // This may be overridden by plugins.
    default_prompt_title: 'DecafMUD Prompt',

    // Default okay message for popups.
    // This may be overridden by plugins.
    default_prompt_okay: 'Okay',

    // Default cancel message for popups.
    // This may be overridden by plugins.
    default_prompt_cancel: 'Cancel',
  };

  // Store the version
  static version = '0.7.0'; // Or a relevant version

  // Default settings for a new window.
  static new_window_settings = 'menubar=0,toolbar=0,location=0,directories=0,personalbar=0,status=0,resizable=1,scrollbars=1';

  // Our display
  display: any = null;

  // Our socket
  socket: any = null;

  // Our telnet parser
  telnet: any = new DecafMUD.Telnet(this);

  // Our plugins
  static plugins: any = {};

  // Our plugin instances
  plugin_instances: any = {};

  // Are we connected?
  connected = false;

  // Line buffer for incomplete lines
  private line_buffer: string = '';

  // Zlib stream for MCCP
  private zlib_stream: any = null; // Will be pako.Inflate if MCCP is active

  // Command history
  private command_history: string[] = [];
  private command_history_position: number = -1;
  // #endregion

  /**
   * The constructor for the DecafMUD class.
   * @param {object} options The initial options.
   */
  constructor(options?: any) {
    if (options) {
      for (const k in options) {
        if (options.hasOwnProperty(k) && this.options.hasOwnProperty(k)) {
          this.options[k] = options[k];
        }
      }
    }

    // Initialize plugins
    for (const name in DecafMUD.plugins) {
      if (DecafMUD.plugins.hasOwnProperty(name)) {
        if (typeof DecafMUD.plugins[name] === 'function') {
          this.plugin_instances[name] = new DecafMUD.plugins[name](this);
        } else {
          this.plugin_instances[name] = DecafMUD.plugins[name];
          if (this.plugin_instances[name].hasOwnProperty('init')) {
            this.plugin_instances[name].init(this);
          }
        }
      }
    }

    // Assign the created instance to DecafMUDGlobal for plugins
    (window as any).DecafMUDGlobal.DecafMUD = this;
  }

  // #region Public API
  /**
   * Set an option.
   * @param {string} key The option key.
   * @param {any} value The option value.
   */
  set_option(key: string, value: any): void {
    this.options[key] = value;
    if (this.options.on_option_set) {
      this.options.on_option_set.call(this, key, value);
    }

    // Handle specific option changes
    if (key === 'display_element' || key === 'display_type') {
      this.set_display(this.options.display_type, this.options.display_element);
    }
  }

  /**
   * Get an option.
   * @param {string} key The option key.
   * @returns {any} The option value.
   */
  get_option(key: string): any {
    return this.options[key];
  }

  /**
   * Connect to the MUD.
   * @param {string} [host] The host to connect to.
   * @param {number} [port] The port to connect to.
   * @param {string} [path] The path for WebSocket connections.
   */
  connect(host?: string, port?: number, path?: string): void {
    if (this.connected) {
      this.disconnect();
    }

    this.options.host = host || this.options.host;
    this.options.port = port || this.options.port;
    this.options.path = path || this.options.path;

    if (!this.options.host || !this.options.port) {
      this.error('Host and Port must be set before connecting.');
      return;
    }

    // Initialize display if not already
    if (!this.display && this.options.display_element && this.options.display_type) {
      this.set_display(this.options.display_type, this.options.display_element);
    }

    // Get the socket type and connect.
    const sock: any = DecafMUD.sockets[this.options.socket];
    if (!sock) {
      this.error("Socket type '" + this.options.socket + "' is invalid.");
      return;
    }

    this.socket = new sock(this);
    this.socket.connect(this.options.host, this.options.port, this.options.path);
  }

  /**
   * Disconnect from the MUD.
   */
  disconnect(): void {
    if (this.socket && this.connected) {
      this.socket.disconnect();
    }
    this.connected = false;
    // MCCP stream should be reset on disconnect
    if (this.zlib_stream) {
        // No specific close method in pako's Inflate, just nullify
        this.zlib_stream = null;
    }
  }

  /**
   * Send data to the MUD.
   * @param {string | Uint8Array} data The data to send.
   * @param {boolean} [raw=false] Whether to send data raw (without Telnet IAC).
   */
  send(data: string | Uint8Array, raw: boolean = false): void {
    if (this.socket && this.connected) {
      if (typeof data === 'string' && !raw) {
        this.socket.send(data + '\r\n');
      } else {
        this.socket.send(data);
      }
    }
  }

  /**
   * Display data received from the MUD.
   * @param {string} data The data to display.
   */
  print(data: string): void {
    if (this.display) {
      if (this.options.strip_newlines) {
        data = data.replace(/\n+$/, '');
      }
      this.display.print(data);
    }
  }

  /**
   * Display an error message.
   * @param {string} message The error message.
   */
  error(message: string): void {
    if (this.options.on_error) {
      this.options.on_error.call(this, message);
    } else {
      // Fallback if no error handler is set
      console.error('DecafMUD Error:', message);
      if (this.display) {
        this.display.print('\n<span style="color:red;">ERROR: ' + message + '</span>\n');
      }
    }
  }

  /**
   * Handles incoming data from the socket.
   * @param {ArrayBuffer | string} data The data received.
   */
  private handle_data(data: ArrayBuffer | string): void {
    let byte_array: Uint8Array;

    if (typeof data === 'string') {
      // This case might be less common with WebSockets using binaryType = "arraybuffer"
      // but handle it for completeness or other socket types.
      const encoder = new TextEncoder(); // Defaults to utf-8
      byte_array = encoder.encode(data);
    } else if (data instanceof ArrayBuffer) {
      byte_array = new Uint8Array(data);
    } else {
      this.error('Received data in unknown format.');
      return;
    }

    // If MCCP is active, decompress the data.
    if (this.zlib_stream) {
      try {
        this.zlib_stream.push(byte_array, false); // false for Z_NO_FLUSH
        if (this.zlib_stream.err) {
            this.error('MCCP Decompression error: ' + this.zlib_stream.msg);
            this.zlib_stream = null; // Stop further processing with this stream
            // We might still have some uncompressed data or the rest of the stream is uncompressed
            // For simplicity, we'll process what we have decompressed so far if any.
            // A more robust solution might try to process the original byte_array or parts of it.
        }
        const decompressed_chunks = this.zlib_stream.result;
        if (decompressed_chunks && decompressed_chunks.length > 0) {
            // Assuming pako.Inflate returns a Uint8Array or similar
            // We need to concatenate them if it's an array of arrays/chunks
            // For pako, .result is typically the full decompressed data so far
            byte_array = (decompressed_chunks instanceof Uint8Array) ? decompressed_chunks : new Uint8Array(0) ;

            // Reset the result buffer for the next push if pako works like that
            // or handle how pako manages its internal state for streamed data.
            // With pako, you usually create a new Inflate instance or manage its state carefully.
            // For simplicity, if we get a result, we'll assume it's the complete current block.
        } else {
            byte_array = new Uint8Array(0); // Nothing to process after decompression this round
        }

      } catch (e: any) {
        this.error('MCCP Decompression failed: ' + e.message);
        this.zlib_stream = null; // Disable MCCP on error
        // Continue with the original byte_array, assuming it might be uncompressed
      }
    }

    // Telnet negotiation
    const [processed_data, remaining_data] = this.telnet.receive(byte_array);

    // Convert processed data to string using the specified encoding
    let display_data = '';
    if (processed_data.length > 0) {
        const decoder = DecafMUD.get_decoder(this.options.encoding);
        if (!decoder) {
            this.error(`Unsupported encoding: ${this.options.encoding}. Falling back to UTF-8.`);
            display_data = new TextDecoder('utf-8', { fatal: false }).decode(processed_data);
        } else {
            try {
                display_data = decoder.decode(processed_data);
            } catch (e: any) {
                this.error(`Error decoding data with ${this.options.encoding}: ${e.message}. Falling back to UTF-8.`);
                display_data = new TextDecoder('utf-8', { fatal: false }).decode(processed_data); // fatal:false means it won't throw on invalid sequences
            }
        }
    }

    // Prepend any leftover from the previous chunk
    display_data = this.line_buffer + display_data;
    this.line_buffer = ''; // Clear buffer after prepending

    // Handle incomplete lines: if data doesn't end with a newline, buffer the last line.
    if (display_data.length > 0 && !display_data.endsWith('\n')) {
        const last_newline = display_data.lastIndexOf('\n');
        if (last_newline !== -1) {
            this.line_buffer = display_data.substring(last_newline + 1);
            display_data = display_data.substring(0, last_newline + 1);
        } else {
            // No newline at all in this chunk, buffer everything
            this.line_buffer = display_data;
            display_data = '';
        }
    }

    if (display_data.length > 0) {
        if (this.options.on_data) {
            this.options.on_data.call(this, display_data);
        } else {
            this.print(display_data); // Default action
        }
    }

    // If there was remaining data from telnet processing (e.g. after MCCP ended)
    // re-process it. This is a simplified loop; careful with deep recursion.
    if (remaining_data.length > 0) {
        this.handle_data(remaining_data.buffer); // Assuming remaining_data is a view (Uint8Array)
    }
  }


  /**
   * Called by the socket when it connects.
   */
  private socket_connect(): void {
    this.connected = true;
    this.telnet.reset(); // Reset Telnet state on new connection
    if (this.options.on_connect) {
      this.options.on_connect.call(this);
    } else {
      this.print('[[Connected]]\n');
    }
    // After connection, attempt to negotiate default Telnet options like GMCP, MCCP
    this.telnet.negotiate();
  }

  /**
   * Called by the socket when it disconnects.
   */
  private socket_disconnect(): void {
    const was_connected = this.connected;
    this.connected = false;
    if (this.zlib_stream) {
        this.zlib_stream = null; // Clear MCCP stream
    }
    if (this.options.on_disconnect) {
      this.options.on_disconnect.call(this);
    } else {
      if (was_connected) this.print('\n[[Disconnected]]\n');
    }
  }

  /**
   * Called by the socket when there's an error.
   * @param {string} message The error message.
   */
  private socket_error(message: string): void {
    this.error(message);
    this.socket_disconnect(); // Ensure disconnected state on socket error
  }

  /**
   * Set the display type and element.
   * @param {string} type The display type.
   * @param {HTMLElement | string} element The display element or its ID.
   */
  set_display(type: string, element: HTMLElement | string): void {
    if (typeof element === 'string') {
      const el = document.getElementById(element);
      if (!el) {
        this.error("Display element '" + element + "' not found.");
        return;
      }
      this.options.display_element = el;
    } else {
      this.options.display_element = element;
    }

    const disp_class = DecafMUD.displays[type];
    if (!disp_class) {
      this.error("Display type '" + type + "' is invalid.");
      return;
    }

    if (this.display && typeof this.display.destroy === 'function') {
        this.display.destroy();
    }
    this.display = new disp_class(this, this.options.display_element);
    this.options.display_type = type;
  }

  /**
   * Sends a Telnet command.
   * @param {number} command The command code (e.g., DecafMUD.Telnet.WILL).
   * @param {number} option The Telnet option code.
   */
  send_telnet_command(command: number, option: number): void {
    if (this.socket && this.connected) {
      this.socket.send(new Uint8Array([DecafMUD.Telnet.IAC, command, option]));
    }
  }

  /**
   * Sends a Telnet subnegotiation.
   * @param {number} option The Telnet option code.
   * @param {Uint8Array | string} data The subnegotiation data.
   */
  send_telnet_subnegotiation(option: number, data: Uint8Array | string): void {
    if (this.socket && this.connected) {
      const iac = DecafMUD.Telnet.IAC;
      const sb = DecafMUD.Telnet.SB;
      const se = DecafMUD.Telnet.SE;
      let data_bytes: Uint8Array;

      if (typeof data === 'string') {
        data_bytes = new TextEncoder().encode(data); // UTF-8 assumed
      } else {
        data_bytes = data;
      }

      const arr = [iac, sb, option, ...data_bytes, iac, se];
      this.socket.send(new Uint8Array(arr));
    }
  }

  /**
   * Sends a GMCP message.
   * @param {string} message The GMCP message (e.g., "Core.Hello").
   * @param {any} [data] The data payload for the GMCP message.
   */
  send_gmcp(message: string, data?: any): void {
    const payload = data !== undefined ? message + ' ' + JSON.stringify(data) : message;
    this.send_telnet_subnegotiation(DecafMUD.Telnet.GMCP, payload);
  }

  /**
   * Starts MCCP (version 2) by enabling the zlib stream.
   * Called by Telnet handler when server sends IAC WILL COMPRESS2.
   */
  start_mccp(): void {
    // Dynamically import pako when MCCP is started
    import('pako').then(pako => {
        this.zlib_stream = new pako.Inflate({
            // If you need to handle specific zlib headers/windowBits:
            // windowBits: 15 // Default, or adjust if issues with server implementation
        });
        this.print('[[MCCP Enabled]]\n'); // Inform user
    }).catch(error => {
        this.error('Failed to load pako for MCCP: ' + error);
        // Optionally, send Telnet WONT COMPRESS2 back to server if pako fails
        this.send_telnet_command(DecafMUD.Telnet.WONT, DecafMUD.Telnet.COMPRESS2);
    });
  }


  /**
   * Prompts the user with a dialog.
   * This is a basic implementation. Plugins can override this.
   * @param {string} message The message for the prompt.
   * @param {Function} callback The callback function, receives input or boolean.
   * @param {boolean} [password=false] Whether the input is a password.
   * @param {string} [type='input'] 'input', 'confirm', or 'alert'.
   * @param {string} [default_value=''] Default value for input.
   */
  prompt(
    message: string,
    callback: (result: string | boolean | null) => void,
    password: boolean = false,
    type: string = 'input', // 'input', 'confirm', 'alert'
    default_value: string = ''
  ): void {
    // Allow plugins to override the prompt
    if (typeof (this as any).hook_prompt === 'function') {
      (this as any).hook_prompt(message, callback, password, type, default_value);
      return;
    }

    // Default browser-based implementation
    switch (type) {
      case 'alert':
        alert(message);
        if (callback) callback(true);
        break;
      case 'confirm':
        if (callback) callback(confirm(message));
        break;
      case 'input':
      default:
        const result = window.prompt(message, default_value);
        if (callback) callback(result); // result is null if Cancel is hit
        break;
    }
  }

  /**
   * Adds a command to the command history.
   * @param {string} command The command to add.
   */
  add_command_history(command: string): void {
    if (this.options.command_history_size > 0) {
      // Remove command if it already exists to avoid duplicates and move it to the end
      const index = this.command_history.indexOf(command);
      if (index > -1) {
        this.command_history.splice(index, 1);
      }

      this.command_history.unshift(command); // Add to the beginning (most recent)

      // Trim history if it exceeds size
      if (this.command_history.length > this.options.command_history_size) {
        this.command_history.pop();
      }
      this.command_history_position = -1; // Reset position
    }
  }

  /**
   * Gets the previous command from history.
   * @returns {string | null} The command or null if at the end of history.
   */
  get_previous_command(): string | null {
    if (this.command_history_position < this.command_history.length - 1) {
      this.command_history_position++;
      return this.command_history[this.command_history_position];
    }
    return null; // Or keep returning the oldest
  }

  /**
   * Gets the next command from history.
   * @returns {string | null} The command or null if at the beginning of history.
   */
  get_next_command(): string | null {
    if (this.command_history_position > 0) {
      this.command_history_position--;
      return this.command_history[this.command_history_position];
    } else if (this.command_history_position === 0) {
      this.command_history_position = -1; // Moved past the newest, back to current input line
      return ''; // Return empty string to clear input
    }
    return null; // Or keep returning empty / current input line
  }

  /**
   * Opens a new window.
   * @param {string} url The URL to open.
   * @param {string} [name='DecafMUD_Window'] The window name.
   * @param {string} [settings] Window settings string.
   * @returns {Window | null} The new window object or null.
   */
  static open_window(url: string, name: string = 'DecafMUD_Window', settings?: string): Window | null {
    settings = settings || DecafMUD.new_window_settings;
    const new_win = window.open(url, name, settings);
    if (new_win) {
        new_win.focus();
    }
    return new_win;
  }
  // #endregion

  // #region Static Plugin, Display, Socket, Encoding Registries
  /**
   * Registers a plugin.
   * @param {string} name The plugin name.
   * @param {Function | object} plugin The plugin class or object.
   */
  static register_plugin(name: string, plugin: any): void {
    DecafMUD.plugins[name] = plugin;
    // If DecafMUDGlobal.DecafMUD instance exists, initialize new plugin for it
    if ((window as any).DecafMUDGlobal && (window as any).DecafMUDGlobal.DecafMUD) {
        const instance = (window as any).DecafMUDGlobal.DecafMUD;
        if (typeof plugin === 'function') {
            instance.plugin_instances[name] = new plugin(instance);
        } else {
            instance.plugin_instances[name] = plugin;
            if (plugin.hasOwnProperty('init')) {
                plugin.init(instance);
            }
        }
    }
  }

  // Store display types
  static displays: any = {};

  /**
   * Registers a display type.
   * @param {string} name The display type name.
   * @param {Function} display The display class.
   */
  static register_display(name: string, display: any): void {
    DecafMUD.displays[name] = display;
  }

  // Store socket types
  static sockets: any = {};
  /**
   * Registers a socket type.
   * @param {string} name The socket type name.
   * @param {Function} socket The socket class.
   */
  static register_socket(name: string, socket: any): void {
    DecafMUD.sockets[name] = socket;
  }

  // Store Encoders/Decoders
  static decoders: { [key: string]: TextDecoder } = {};
  static encoders: { [key: string]: TextEncoder } = {}; // Though TextEncoder is mostly UTF-8

  /**
   * Registers an encoding.
   * @param {string} name The encoding name (e.g., 'cp437').
   * @param {any} definition The encoding definition or decoder instance.
   * For TextDecoder, this would typically be pre-instantiated.
   * For custom decoders, it might be an object with a `decode` method.
   */
  static register_encoding(name: string, definition: any): void {
    // Check if the definition is a direct TextDecoder instance
    if (typeof definition.decode === 'function' && definition.encoding) {
        DecafMUD.decoders[name.toLowerCase()] = definition;
    }
    // Add more sophisticated checks if definition is a spec or needs construction
    // For now, this simplifies for pre-made TextDecoder objects for cp437 etc.
    // For TextEncoder, it's usually just new TextEncoder() for UTF-8.
    // Other encodings might need specific encoder logic if not just UTF-8.
  }

  /**
   * Gets a decoder for the specified encoding.
   * @param {string} encodingName The name of the encoding.
   * @returns {TextDecoder | null} A TextDecoder instance or null if not found/supported.
   */
  static get_decoder(encodingName: string): TextDecoder | null {
    const lname = encodingName.toLowerCase();
    if (DecafMUD.decoders[lname]) {
        return DecafMUD.decoders[lname];
    }
    try {
        // Try to create a native TextDecoder
        const decoder = new TextDecoder(lname);
        DecafMUD.decoders[lname] = decoder; // Cache it
        return decoder;
    } catch (e) {
        // If native TextDecoder doesn't support it, and not in our registered list.
        if (lname !== 'utf-8' && lname !== 'utf8') { // Don't warn for utf-8 itself if it fails somehow
            console.warn(`No decoder registered for encoding '${encodingName}' and native TextDecoder failed. `);
        }
        return null; // Or return a default UTF-8 decoder
    }
  }

  // #endregion
}

// #region Telnet Constants and Class
// Define Telnet constants directly on the DecafMUD class
namespace DecafMUD { // Using namespace merging for Telnet
  export class Telnet {
    decaf: DecafMUD;
    iac_buffer: Uint8Array | null = null; // Buffer for IAC sequences

    // Standard Telnet Commands
    static SE = 240; // End of subnegotiation parameters
    static NOP = 241; // No operation
    static DataMark = 242; // The data stream portion of a Synch sequence
    static BRK = 243; // Break
    static IP = 244; // Interrupt Process
    static AO = 245; // Abort Output
    static AYT = 246; // Are You There
    static EC = 247; // Erase Character
    static EL = 248; // Erase Line
    static GA = 249; // Go Ahead
    static SB = 250; // Subnegotiation message
    static WILL = 251; // Will option code
    static WONT = 252; // Won't option code
    static DO = 253; // Do option code
    static DONT = 254; // Don't option code
    static IAC = 255; // Interpret As Command

    // Telnet Options
    static TRANSMIT_BINARY = 0; // Transmit Binary
    static ECHO = 1; // Echo
    static SUPPRESS_GO_AHEAD = 3; // Suppress Go Ahead
    static STATUS = 5; // Status
    static TIMING_MARK = 6; // Timing Mark
    static NAOCRD = 10; // Output CR Disposition
    static NAOHTS = 11; // Output HT Stops
    static NAOHTD = 12; // Output HT Disposition
    static NAOFFD = 13; // Output FF Disposition
    static NAOVTS = 14; // Output VT Stops
    static NAOVTD = 15; // Output VT Disposition
    static NAOLFD = 16; // Output LF Disposition
    static EXTEND_ASCII = 17; // Extend ASCII
    static TERMINAL_TYPE = 24; // Terminal Type
    static NAWS = 31; // Negotiate About Window Size
    static TSPEED = 32; // Terminal Speed
    static LFLOW = 33; // Remote Flow Control
    static LINEMODE = 34; // Linemode
    static XDISPLOC = 35; // X Display Location
    static AUTHENTICATION = 37; // Authentication
    static ENCRYPTION = 38; // Encryption
    static NEW_ENVIRON = 39; // New Environment Option
    static MSDP = 69; // Mud Server Data Protocol
    static MSSP = 70; // Mud Server Status Protocol
    static COMPRESS = 85; // MCCP (old, v1) - not typically used
    static COMPRESS2 = 86; // MCCP (v2)
    static MSP = 90; // Mud Sound Protocol
    static MXP = 91; // Mud Extension Protocol
    static ZMP = 93; // Zenith Mud Protocol
    static GCMP = 201; // Generic Mud Communication Protocol (misnamed, should be GMCP)
    static GMCP = 201; // Correct name for GMCP

    // Telnet states for NAWS subnegotiation
    static NAWS_STATE_NORMAL = 0;
    static NAWS_STATE_IAC = 1;
    static NAWS_STATE_SB = 2;
    static NAWS_STATE_NAWS = 3;
    static NAWS_STATE_WIDTH_1 = 4;
    static NAWS_STATE_WIDTH_2 = 5;
    static NAWS_STATE_HEIGHT_1 = 6;
    static NAWS_STATE_HEIGHT_2 = 7;

    // Internal state for telnet option tracking
    private telnet_options: { [key: number]: { local: boolean, remote: boolean } } = {};


    constructor(decaf: DecafMUD) {
      this.decaf = decaf;
      this.reset();
    }

    reset(): void {
        this.iac_buffer = null;
        this.telnet_options = {};

        // Initialize options we care about
        const options_to_init = [
            DecafMUD.Telnet.GMCP,
            DecafMUD.Telnet.COMPRESS2,
            DecafMUD.Telnet.TERMINAL_TYPE,
            DecafMUD.Telnet.NAWS,
            DecafMUD.Telnet.MSDP,
            DecafMUD.Telnet.MSSP,
        ];
        options_to_init.forEach(opt => {
            this.telnet_options[opt] = { local: false, remote: false };
        });
    }

    /**
     * Initial Telnet negotiations. Call this after connection is established.
     */
    negotiate(): void {
        // Example: Offer to support GMCP and MCCP2
        if (this.decaf.options.gmcp) {
            this.send_will(DecafMUD.Telnet.GMCP);
            this.send_do(DecafMUD.Telnet.GMCP); // Also ask server to do GMCP
        }
        if (this.decaf.options.mccp) {
            this.send_will(DecafMUD.Telnet.COMPRESS2);
        }
        // Ask server to send TERMINAL-TYPE
        this.send_do(DecafMUD.Telnet.TERMINAL_TYPE);
        // Offer to send NAWS if display is available
        if (this.decaf.display && this.decaf.display.get_cols && this.decaf.display.get_rows) {
            this.send_will(DecafMUD.Telnet.NAWS);
        }
    }


    /**
     * Process incoming raw data from the socket for Telnet commands.
     * @param {Uint8Array} data The raw byte array from the socket.
     * @returns {[Uint8Array, Uint8Array]} A tuple containing [processed_display_data, remaining_data_after_mccp_end]
     *          The remaining_data_after_mccp_end is usually empty, unless MCCP was active and just ended.
     */
    receive(data: Uint8Array): [Uint8Array, Uint8Array] {
      let display_bytes: number[] = [];
      let i = 0;

      // If there's a leftover IAC sequence, prepend it
      if (this.iac_buffer) {
        const temp_data = new Uint8Array(this.iac_buffer.length + data.length);
        temp_data.set(this.iac_buffer);
        temp_data.set(data, this.iac_buffer.length);
        data = temp_data;
        this.iac_buffer = null;
      }

      while (i < data.length) {
        if (data[i] === DecafMUD.Telnet.IAC) {
          // Start of an IAC sequence
          if (i + 1 >= data.length) { // IAC at end of buffer
            this.iac_buffer = new Uint8Array([data[i]]);
            i++;
            continue;
          }

          if (data[i+1] === DecafMUD.Telnet.IAC) { // Escaped IAC (255 255)
            display_bytes.push(DecafMUD.Telnet.IAC);
            i += 2;
            continue;
          }

          // We have at least IAC + command
          if (i + 2 >= data.length) { // IAC + command at end of buffer
            this.iac_buffer = new Uint8Array([data[i], data[i+1]]);
            i += 2;
            continue;
          }

          const command = data[i+1];
          const option = data[i+2]; // Option byte for WILL/WONT/DO/DONT/SB

          switch (command) {
            case DecafMUD.Telnet.WILL: // Server WILL enable option
              this.handle_will(option);
              i += 3;
              break;
            case DecafMUD.Telnet.WONT: // Server WONT enable option
              this.handle_wont(option);
              i += 3;
              break;
            case DecafMUD.Telnet.DO: // Server requests US to DO option
              this.handle_do(option);
              i += 3;
              break;
            case DecafMUD.Telnet.DONT: // Server requests US to DONT option
              this.handle_dont(option);
              i += 3;
              break;
            case DecafMUD.Telnet.SB: // Subnegotiation
              let sb_end = -1;
              for (let j = i + 3; j < data.length -1; j++) { // Search for IAC SE
                  if (data[j] === DecafMUD.Telnet.IAC && data[j+1] === DecafMUD.Telnet.SE) {
                      sb_end = j;
                      break;
                  }
              }

              if (sb_end !== -1) {
                  const sb_data = data.slice(i + 3, sb_end); // Data between SB OPTION and IAC SE
                  this.handle_sb(option, sb_data);
                  i = sb_end + 2; // Move past IAC SE
              } else {
                  // Subnegotiation sequence is incomplete, buffer it
                  this.iac_buffer = data.slice(i);
                  i = data.length; // Consume rest of buffer
              }
              break;
            // Other IAC commands (NOP, DataMark, BRK, IP, AO, AYT, EC, EL, GA)
            // These are typically just 2 bytes (IAC + CMD) and don't have an "option" byte in the same way.
            // For simplicity, we'll assume they are 2-byte commands if not WILL/WONT/DO/DONT/SB.
            // A more robust parser would handle each command's specific length.
            default:
              // This handles NOP, GA etc. - any other command we don't specifically process.
              // Most of these are 2 bytes (IAC + command).
              // If a command *did* have an option byte but wasn't one of the above,
              // this would incorrectly consume only 2 bytes. However, the common ones are covered.
              if (this.decaf.options.on_telnet) {
                  this.decaf.options.on_telnet.call(this.decaf, command, null);
              }
              i += 2; // Assuming a 2-byte command (IAC + CMD)
              break;
          }
        } else {
          // Not an IAC sequence, just data
          display_bytes.push(data[i]);
          i++;
        }
      }
      // If MCCP was active and has just ended, the remaining data in the original `data` buffer
      // (after the MCCP end sequence) might be uncompressed.
      // This simple model doesn't explicitly return that yet, but a full implementation would.
      // For now, we assume remaining_data is empty unless specifically set by COMPRESS2 handling.
      return [new Uint8Array(display_bytes), new Uint8Array()];
    }

    private handle_will(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        const opt_state = this.telnet_options[option];

        if (this.decaf.options.on_telnet) {
            this.decaf.options.on_telnet.call(this.decaf, DecafMUD.Telnet.WILL, option);
        }

        switch (option) {
            case DecafMUD.Telnet.GMCP:
                if (!opt_state.remote) { // If we weren't already DOing GMCP
                    opt_state.remote = true;
                    // We already sent WILL GMCP as part of initial negotiation if option is on.
                    // If server says WILL GMCP, it means it will send GMCP. We should be ready.
                    // If we hadn't offered WILL GMCP, we might send DO GMCP here.
                    // But our current logic sends WILL and DO together initially.
                }
                break;
            case DecafMUD.Telnet.COMPRESS2:
                if (!opt_state.remote) { // If server WILL COMPRESS2 and we haven't agreed
                    opt_state.remote = true;
                    // We already sent WILL COMPRESS2. Server WILL COMPRESS2 means it agrees.
                    // The server should now send IAC SB COMPRESS2 IAC SE to start compression.
                    // Actual start_mccp() is called upon receiving that SB.
                    this.decaf.print('[[MCCP Negotiation agreed by server, waiting for start sequence...]]\n');
                }
                break;
            case DecafMUD.Telnet.TERMINAL_TYPE:
                 // Server WILL send TERMINAL-TYPE. We already sent DO, so we agree.
                 // Server should now send SB TERMINAL-TYPE SEND IAC SE.
                opt_state.remote = true;
                break;
            case DecafMUD.Telnet.NAWS:
                opt_state.remote = true; // Server WILL NAWS, means it accepts our window size.
                // We can now send initial NAWS subnegotiation if we haven't.
                this.send_naws();
                break;
            default:
                // For other options, if server says WILL and we haven't said DONT, we can say DO.
                if (!opt_state.local) { // If we are not already DOing it (or said WONT)
                     //this.send_do(option); // Example: automatically agree to most WILLs
                     // Be careful with auto-agreeing. Better to explicitly handle known opts.
                }
                break;
        }
        opt_state.remote = true; // Mark that server WILL use this option
    }

    private handle_wont(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].remote = false; // Server WONT use this option
        if (this.decaf.options.on_telnet) {
            this.decaf.options.on_telnet.call(this.decaf, DecafMUD.Telnet.WONT, option);
        }
        // If server WONTs something we wanted (e.g. we sent DO), we should stop asking.
        // If it's MCCP, ensure our MCCP state is off.
        if (option === DecafMUD.Telnet.COMPRESS2 && this.decaf.zlib_stream) {
            this.decaf.zlib_stream = null;
            this.decaf.print('[[MCCP Disabled by server WONT]]\n');
        }
    }

    private handle_do(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        const opt_state = this.telnet_options[option];

        if (this.decaf.options.on_telnet) {
            this.decaf.options.on_telnet.call(this.decaf, DecafMUD.Telnet.DO, option);
        }

        switch (option) {
            case DecafMUD.Telnet.GMCP:
                if (this.decaf.options.gmcp && !opt_state.local) {
                    opt_state.local = true;
                    // We already sent WILL if option is on. No need to resend.
                } else if (!this.decaf.options.gmcp) {
                    this.send_wont(option);
                }
                break;
            case DecafMUD.Telnet.COMPRESS2:
                if (this.decaf.options.mccp && !opt_state.local) {
                    opt_state.local = true; // We WILL do COMPRESS2.
                    // Server is asking us to enable it. Our client doesn't compress, so this is odd.
                    // Typically, client sends WILL COMPRESS2, server sends DO COMPRESS2 or WILL COMPRESS2.
                    // If server sends DO COMPRESS2, it means "You (client) should compress".
                    // DecafMUD doesn't send compressed data, so we WONT.
                    // However, the original code structure suggests `start_mccp` is for client-side DECOMPRESSION.
                    // Let's assume DO COMPRESS2 from server means "I (server) request you (client) to prepare for compression"
                    // which is actually covered by server sending WILL COMPRESS2 and client agreeing with DO.
                    // This path (server DO COMPRESS2) is unusual for client decompression.
                    // For now, we'll interpret this as the server confirming it *wants* compression,
                    // and we've already said we WILL support it (for decompression).
                    // The actual trigger is server WILL COMPRESS2 and then SB COMPRESS2.
                    // So, if server says DO COMPRESS2, and we support MCCP, we just note it.
                } else if (!this.decaf.options.mccp) {
                    this.send_wont(option);
                }
                break;
            case DecafMUD.Telnet.TERMINAL_TYPE:
                // Server requests us to DO TERMINAL-TYPE. This means it wants us to send our terminal type.
                if (!opt_state.local) {
                    opt_state.local = true;
                    this.send_will(option); // We WILL provide terminal type.
                    // Server should follow up with SB TERMINAL-TYPE SEND IAC SE.
                }
                break;
            case DecafMUD.Telnet.NAWS:
                // Server requests us to DO NAWS. This means it wants us to send our window size.
                if (this.decaf.display && this.decaf.display.get_cols && this.decaf.display.get_rows && !opt_state.local) {
                    opt_state.local = true;
                    this.send_will(option); // We WILL provide window size.
                    this.send_naws(); // Send it now.
                } else {
                    this.send_wont(option); // Cannot provide NAWS.
                }
                break;
            default:
                // For other options, default to WONT unless explicitly supported.
                this.send_wont(option);
                break;
        }
         // opt_state.local might have been set true inside switch
    }

    private handle_dont(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].local = false; // We WONT do this option
        if (this.decaf.options.on_telnet) {
            this.decaf.options.on_telnet.call(this.decaf, DecafMUD.Telnet.DONT, option);
        }
        // If we were WILLing this option, we should stop.
        // e.g. if we sent WILL NAWS and server says DONT NAWS.
    }

    private handle_sb(option: number, data: Uint8Array): void {
        if (this.decaf.options.on_telnet) {
            this.decaf.options.on_telnet.call(this.decaf, DecafMUD.Telnet.SB, option, data);
        }

        switch (option) {
            case DecafMUD.Telnet.GMCP:
                if (this.decaf.options.gmcp && this.decaf.options.on_gmcp) {
                    const gmcp_string = new TextDecoder().decode(data); // GMCP is UTF-8
                    const space = gmcp_string.indexOf(' ');
                    let gmcp_package: string;
                    let gmcp_data_json: string | undefined;
                    let gmcp_data: any = null;

                    if (space !== -1) {
                        gmcp_package = gmcp_string.substring(0, space);
                        gmcp_data_json = gmcp_string.substring(space + 1);
                        try {
                            gmcp_data = JSON.parse(gmcp_data_json);
                        } catch (e) {
                            this.decaf.error('Invalid GMCP JSON: ' + gmcp_data_json);
                            return; // Don't call handler with invalid data
                        }
                    } else {
                        gmcp_package = gmcp_string;
                    }
                    this.decaf.options.on_gmcp.call(this.decaf, gmcp_package, gmcp_data);
                }
                break;
            case DecafMUD.Telnet.COMPRESS2:
                // Server is starting compression. IAC SB COMPRESS2 IAC SE
                // This is the official start signal for MCCP.
                if (this.decaf.options.mccp && this.telnet_options[DecafMUD.Telnet.COMPRESS2]?.local) {
                    this.decaf.start_mccp();
                } else {
                    // We received SB COMPRESS2 but we are not in a state to start it
                    // (e.g., mccp option is false, or we didn't agree to WILL COMPRESS2)
                    // This shouldn't happen if negotiation is correct.
                    this.decaf.error('Received unexpected SB COMPRESS2.');
                }
                break;
            case DecafMUD.Telnet.TERMINAL_TYPE:
                // Server sent SB TERMINAL-TYPE <type> IAC SE
                // If <type> is SEND (1), we should respond with SB TERMINAL-TYPE IS <our_type> IAC SE
                if (data.length === 1 && data[0] === 1 /* SEND */) {
                    // TODO: Make terminal type configurable
                    const terminal_type = "DecafMUD"; // Or make it more specific like "DecafMUD-0.7.0-ANSI"
                    const client_name = "DecafMUD"; // Could be more specific
                    const version = DecafMUD.version;
                    // MUDs might expect "MTTS 1" or similar for terminal type count.
                    // Or specific strings like "ANSI", "XTERM", "MUDLET", etc.
                    // Common practice for GMCP clients is to also send a client name via GMCP Core.Hello
                    // For TERMINAL-TYPE, "MTTS 1" or just "ANSI" is common.
                    // Sending "DECAFMUD" and then client name via GMCP might be good.
                    // Let's send "DECAFMUD" as the primary terminal type.
                    // Some MUDs also parse for "Proxy" for screen reader users.
                    // Format: IAC SB TERMINAL-TYPE IS <string> [IS <string> ...] IAC SE
                    // We'll send one: "DECAFMUD"
                    // And optionally a second one for client identification if not using GMCP Core.Hello for it.
                    // For now, just "DECAFMUD".

                    const type_is = 0; // IS
                    const encoder = new TextEncoder(); // For UTF-8 encoding of terminal type string
                    const type_bytes = encoder.encode(terminal_type.toUpperCase());

                    const response_data = new Uint8Array(1 + type_bytes.length);
                    response_data[0] = type_is;
                    response_data.set(type_bytes, 1);

                    this.decaf.send_telnet_subnegotiation(DecafMUD.Telnet.TERMINAL_TYPE, response_data);
                }
                break;
            // Handle other subnegotiations (MSDP, MSSP, ZMP, etc.) if needed
        }
    }

    // Helper methods to send Telnet commands
    send_will(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].local = true;
        this.decaf.send_telnet_command(DecafMUD.Telnet.WILL, option);
    }
    send_wont(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].local = false;
        this.decaf.send_telnet_command(DecafMUD.Telnet.WONT, option);
    }
    send_do(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].remote = true; // We want the server to do this
        this.decaf.send_telnet_command(DecafMUD.Telnet.DO, option);
    }
    send_dont(option: number): void {
        if (!this.telnet_options[option]) this.telnet_options[option] = {local: false, remote: false};
        this.telnet_options[option].remote = false;
        this.decaf.send_telnet_command(DecafMUD.Telnet.DONT, option);
    }

    /** Send NAWS subnegotiation with current window size. */
    send_naws(): void {
        if (this.decaf.display && this.decaf.display.get_cols && this.decaf.display.get_rows) {
            const cols = this.decaf.display.get_cols();
            const rows = this.decaf.display.get_rows();

            if (cols > 0 && rows > 0) {
                // Ensure values are within 0-65535
                const c1 = Math.min(255, Math.floor(cols / 256));
                const c2 = Math.min(255, cols % 256);
                const r1 = Math.min(255, Math.floor(rows / 256));
                const r2 = Math.min(255, rows % 256);

                // Double IAC if any value is 255
                const naws_data: number[] = [];
                const add_byte = (byte: number) => {
                    naws_data.push(byte);
                    if (byte === DecafMUD.Telnet.IAC) naws_data.push(DecafMUD.Telnet.IAC); // Escape IAC
                };

                add_byte(c1);
                add_byte(c2);
                add_byte(r1);
                add_byte(r2);

                this.decaf.send_telnet_subnegotiation(DecafMUD.Telnet.NAWS, new Uint8Array(naws_data));
            }
        }
    }
  }
}
// #endregion

// Assign the class to the global object property after class definition
(window as any).DecafMUDGlobal.DecafMUD = DecafMUD;

// Make DecafMUD available on the window directly for convenience, if not already taken.
if (typeof (window as any).DecafMUD === 'undefined') {
  (window as any).DecafMUD = DecafMUD;
}
