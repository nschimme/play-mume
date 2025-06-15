// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

/**
 * @fileOverview DecafMUD Socket Provider: WebSocket
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUD as DecafMUDInstance, DecafMUDOptions } from './decafmud'; // Hypothetical import

(function(DecafMUD: any) { // Use 'any' if DecafMUD type is not directly available/imported

interface DecafMUDInstanceInterface { // Minimal interface for what DecafWebSocket needs
    options: any; // Should be DecafMUDOptions
    timer: number | null;
    error: (message: string) => void;
    socketReady: (socket: any) => void; // socket should be DecafWebSocket
    debugString: (message: string, type?: string) => void;
    socketConnected: () => void;
    socketClosed: () => void;
    socketData: (data: Uint8Array) => void; // Assuming socketData expects Uint8Array
}

class DecafWebSocket {
    private decaf: DecafMUDInstanceInterface;
    public host: string | undefined = undefined;
    public port: number | undefined = undefined;
    public ssl: boolean | undefined = undefined;
    public connected: boolean = false;
    public ready: boolean = false;
    private websocket: WebSocket | null = null;

    constructor(decaf: DecafMUDInstanceInterface) {
        this.decaf = decaf;
    }

    public setup(): void {
        if ("WebSocket" in window) {
            this.ready = true;
            this.decaf.socketReady(this);
            return;
        }

        if (this.decaf.timer !== null) {
             clearTimeout(this.decaf.timer);
        }
        this.decaf.error("Unable to create a WebSocket. Does your browser support them? If not, try {0}.".tr(
            this.decaf as any, // Cast needed if tr method expects full DecafMUD instance
             '<a href="http://www.google.com/chrome" target="_blank">Google Chrome</a>')
        );
    }

    public connect(): void {
        if (this.connected && this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        let port = this.port;
        if (port === undefined) {
            port = this.decaf.options.set_socket.wsport;
            if (port < 1 || port > 65535) {
                port = this.decaf.options.set_socket.policyport;
            }
            if (port === undefined) {
                port = 843;
            }
            this.port = port;
        }

        let path = this.decaf.options.set_socket.wspath;
        if (path === undefined) {
            path = 'port_' + this.decaf.options.port;
        }

        let host = this.host;
        if (host === undefined) {
            host = this.decaf.options.host;
            if (!host) {
                host = document.location.host;
            }
            this.host = host;
        }

        let ssl = this.ssl;
        if (ssl === undefined) {
            ssl = this.decaf.options.set_socket.ssl;
            if (ssl === undefined) {
                ssl = false;
            }
            this.ssl = ssl;
        }

        const con = 'ws' + (ssl ? 's' : '') + '://' + host + ':' + port + '/' + path;
        this.decaf.debugString('WebSocket Connection String: ' + con);

        try {
            this.websocket = new WebSocket(con, 'binary'); // 'binary' is a subprotocol string
            this.websocket.binaryType = 'arraybuffer'; // Ensure binary data is received as ArrayBuffer
        } catch (e: any) {
            this.decaf.error("Failed to create WebSocket: " + e.message);
            return;
        }

        this.websocket.onopen = (event) => this.onOpen(event);
        this.websocket.onclose = (event) => this.onClose(event as CloseEvent);
        this.websocket.onmessage = (event) => this.onMessage(event as MessageEvent);
        this.websocket.onerror = (event) => this.onError(event);
    }

    public close(): void {
        this.connected = false;
        if (this.websocket) {
            this.websocket.onopen = null;
            this.websocket.onclose = null;
            this.websocket.onmessage = null;
            this.websocket.onerror = null;
            if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
                 this.websocket.close();
            }
            this.websocket = null;
        }
    }

    private assertConnected(): void {
        if (!this.connected || !this.websocket) {
            throw new Error("DecafMUD is not currently connected.");
        }
    }

    public write(data: string): void {
        this.assertConnected();
        if (this.websocket) { // Check again, as assertConnected might not be enough if called async
            const text = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                text[i] = data.charCodeAt(i);
            }
            const arr = new Uint8Array(text).buffer;
            this.websocket.send(arr);
        }
    }

    private onOpen(event: Event): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.connected = true;
            this.decaf.socketConnected();
        }
    }

    private onClose(event: CloseEvent): void {
        if (this.connected) {
            this.connected = false;
            this.decaf.socketClosed();
        }
        // Ensure websocket is cleaned up regardless of previous connected state
        if (this.websocket) {
             this.websocket = null;
        }
        this.decaf.debugString(`WebSocket closed: Code=${event.code}, Reason="${event.reason}", WasClean=${event.wasClean}`);
    }

    private onMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            this.decaf.socketData(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
            // If text data is received, convert to Uint8Array (assuming UTF-8 for text)
            // This might need adjustment based on how string data should be handled
            const encoder = new TextEncoder(); // UTF-8 by default
            this.decaf.socketData(encoder.encode(event.data));
        } else {
            this.decaf.debugString('WebSocket received non-binary data that was not a string.', 'warn');
        }
    }

    private onError(event: Event): void {
        // The 'event' for onerror is a generic Event and doesn't contain specific error details.
        // Modern browsers might provide more info on the console directly.
        this.decaf.error("WebSocket error occurred.");
        // Consider closing the socket and attempting reconnect based on strategy
        if (this.websocket) {
            this.websocket.close(); // This will trigger onClose
        }
    }
}

// Add this to DecafMUD
(DecafMUD as any).plugins.Socket.websocket = DecafWebSocket;
})(DecafMUD);
