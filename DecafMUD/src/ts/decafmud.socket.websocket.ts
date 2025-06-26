/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules
 */

import { DecafMUD, DecafMUDSocket } from "./decafmud";

class DecafWebSocket implements DecafMUDSocket {
    private decaf: DecafMUD;
    public host: string | undefined = undefined;
    public port: number | undefined = undefined;
    private ssl: boolean | undefined = undefined;
    public connected: boolean = false;
    public ready: boolean = false; // Indicates if the WebSocket API is available in the browser

    private websocket: WebSocket | null = null;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        // In the original JS, this was stored on decaf.loaded_plugs.socket
        // For TS, direct instantiation by DecafMUD core is cleaner,
        // but to maintain compatibility with how DecafMUD core initializes plugins:
        if (!(this.decaf as any).loaded_plugs) { (this.decaf as any).loaded_plugs = {}; }
        (this.decaf as any).loaded_plugs.socket = this;
    }

    setup(): void {
        if (typeof window !== 'undefined' && "WebSocket" in window) {
            this.ready = true;
            this.decaf.socketReady(); // Pass 'this' if DecafMUD expects the socket instance
            return;
        }

        clearTimeout(this.decaf.timer); // Assuming decaf.timer is a general purpose timer
        this.decaf.error(("Unable to create a WebSocket. Does your browser support them? If not, try {0}." as string).tr(this.decaf,
            '<a href="http://www.google.com/chrome" target="_blank">Google Chrome</a>'));
    }

    connect(): void {
        if (this.connected && this.websocket) {
            this.websocket.close();
            // this.websocket = null; // onclose will handle this
        }

        if (this.port === undefined) {
            let p = this.decaf.options.set_socket?.wsport;
            if (p === undefined || p < 1 || p > 65535) {
                p = this.decaf.options.set_socket?.policyport; // Flash policy port fallback
            }
            if (p === undefined) {
                p = 843; // Default policy port
            }
            this.port = p;
        }

        let path = this.decaf.options.set_socket?.wspath;
        if (path === undefined) {
            path = 'port_' + this.decaf.options.port;
        }

        if (this.host === undefined) {
            let h = this.decaf.options.host;
            if (!h && typeof document !== 'undefined') {
                h = document.location.host;
            }
            this.host = h || 'localhost'; // Fallback host
        }

        if (this.ssl === undefined) {
            this.ssl = this.decaf.options.set_socket?.ssl || false;
        }

        const protocol = this.ssl ? 'wss' : 'ws';
        const connectionString = `${protocol}://${this.host}:${this.port}/${path}`;
        this.decaf.debugString('WebSocket Connection String: ' + connectionString);

        try {
            this.websocket = new WebSocket(connectionString, 'binary'); // 'binary' subprotocol is often used for MUDs
            this.websocket.binaryType = 'arraybuffer'; // Important for receiving binary data

            // Using .bind ensures 'this' context is correct in event handlers
            this.websocket.onopen = this.onOpen.bind(this);
            this.websocket.onclose = this.onClose.bind(this);
            this.websocket.onmessage = this.onMessage.bind(this);
            this.websocket.onerror = this.onError.bind(this); // Added error handler

        } catch (e: any) {
            this.decaf.error(("Failed to create WebSocket: {0}" as string).tr(this.decaf, e.message || String(e)));
            // Ensure we call socketClosed or similar if an immediate error occurs
             if (this.decaf.connecting) { // If DecafMUD thinks it's in the process of connecting
                this.decaf.socketClosed(); // Simulate a closure to allow reconnect logic etc.
            }
        }
    }

    close(): void {
        this.connected = false; // Set immediately
        if (this.websocket) {
            // Prevent onclose from triggering normal disconnect logic if we are manually closing
            this.websocket.onclose = null;
            this.websocket.close();
            this.websocket = null;
        }
    }

    private assertConnected(): void {
        if (!this.connected || !this.websocket) {
            throw "DecafMUD is not currently connected.";
        }
    }

    write(data: string): void {
        this.assertConnected();
        // Convert string to Uint8Array (assuming ISO-8859-1 or similar byte string)
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            buffer[i] = data.charCodeAt(i) & 0xFF; // Ensure byte values
        }
        this.websocket!.send(buffer.buffer); // Send ArrayBuffer
    }

    private onOpen(event: Event): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.connected = true;
            this.decaf.socketConnected();
        }
    }

    private onClose(event: CloseEvent): void {
        // Only trigger socketClosed if we were previously connected or attempting to connect.
        // Avoids issues if connection failed very early or was manually closed cleanly.
        if (this.connected || this.decaf.connecting) {
            const wasConnected = this.connected;
            this.connected = false;
            this.websocket = null; // Clear reference
            if (wasConnected) { // Only call socketClosed if it was genuinely connected
                 this.decaf.socketClosed();
            } else if (this.decaf.connecting) { // If it failed during connection attempt
                this.decaf.socketClosed(); // Allow DecafMUD to handle failed connection
            }
        }
         this.decaf.debugString(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`, 'info');
    }

    private onMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            const dataArray = new Uint8Array(event.data);
            this.decaf.socketData(dataArray);
        } else if (typeof event.data === 'string') {
            // WebSockets can technically send string data, though we requested 'binary'
            // Convert string to Uint8Array assuming it's a binary string
            const strData = event.data;
            const buffer = new Uint8Array(strData.length);
            for (let i = 0; i < strData.length; i++) {
                buffer[i] = strData.charCodeAt(i) & 0xFF;
            }
            this.decaf.socketData(buffer);
             this.decaf.debugString('WebSocket received string data, converted to Uint8Array.', 'warn');
        } else if (event.data instanceof Blob) {
            // Original code used FileReader for Blobs. This is generally correct.
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                if (e.target && e.target.result instanceof ArrayBuffer) {
                    this.decaf.socketData(new Uint8Array(e.target.result));
                } else {
                    this.decaf.socketError("Failed to read Blob data from WebSocket.");
                }
            };
            reader.onerror = () => {
                 this.decaf.socketError("Error reading Blob data from WebSocket.");
            };
            reader.readAsArrayBuffer(event.data);
        } else {
            this.decaf.socketError(`Unknown data type from WebSocket: ${typeof event.data}`);
        }
    }

    private onError(event: Event): void {
        // Try to get more specific error information if possible
        let errorMessage = "WebSocket error occurred.";
        if (event instanceof ErrorEvent && event.message) {
            errorMessage = event.message;
        }
        this.decaf.socketError(errorMessage);
        // Consider also calling socketClosed here if the error implies a disconnect
        // However, onClose is usually also triggered.
    }
}

// Expose to DecafMUD
if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins && DecafMUD.plugins.Socket) {
    DecafMUD.plugins.Socket.websocket = DecafWebSocket as any;
}

export { DecafWebSocket };
