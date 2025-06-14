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

import DecafMUD from './decafmud'; // Assuming DecafMUD is exported from decafmud.ts
type DecafMUDInstance = InstanceType<typeof DecafMUD>;


(function(DecafMUDGlobal: any) {

class DecafWebSocket {
    decaf: DecafMUDInstance;
    host: string | undefined = undefined;
    port: number | undefined = undefined;
    ssl: boolean | undefined = undefined;
    connected: boolean = false;
    ready: boolean = false;
    websocket: WebSocket | null = null;

    constructor(decaf: DecafMUDInstance) {
        this.decaf = decaf;
    }

    setup(): void {
        if ( "WebSocket" in window ) {
            this.ready = true;
            this.decaf.socketReady(); // Removed 'this' argument as socketReady in DecafMUD class doesn't expect it
            return;
        }

        clearTimeout(this.decaf.timer!);
        this.decaf.error("Unable to create a WebSocket. Does your browser support them? If not, try {0}.".tr(
            this.decaf, '<a href="http://www.google.com/chrome" target="_blank">Google Chrome</a>'));
    }

    connect(): void {
        if ( this.connected && this.websocket ) {
            this.websocket.close();
            this.websocket = null;
        }

        let port = this.port;
        if ( port === undefined ) {
            port = this.decaf.options.set_socket.wsport;
            if ( port < 1 || port > 65535 ) {
                port = this.decaf.options.set_socket.policyport;
            }
            if ( port === undefined ) { // Default if still undefined
                port = 843;
            }
            this.port = port;
        }

        let path = this.decaf.options.set_socket.wspath;
        if ( path === undefined ) {
            path = 'port_' + this.decaf.options.port;
        }

        let host = this.host;
        if ( host === undefined ) {
            host = this.decaf.options.host;
            if ( !host ) {
                host = document.location.host;
            }
            this.host = host;
        }

        let ssl = this.ssl;
        if ( ssl === undefined ) {
            ssl = this.decaf.options.set_socket.ssl;
            if ( ssl === undefined) {
                ssl = false;
            }
            this.ssl = ssl;
        }

        const con = 'ws' + (ssl ? 's' : '') + '://' + host + ':' + port + '/' + path;
        this.decaf.debugString('WebSocket Connection String: ' + con);

        this.websocket = new WebSocket(con, 'binary');
        this.websocket.binaryType = 'arraybuffer'; // Ensure binary type is arraybuffer for modern WebSockets

        this.websocket.onopen           = this.onOpen.bind(this);
        this.websocket.onclose          = this.onClose.bind(this);
        this.websocket.onmessage        = this.onMessage.bind(this);
        // It's good practice to also handle onerror
        this.websocket.onerror          = this.onError.bind(this);
    }

    close(): void {
        this.connected = false;
        if ( this.websocket ) {
            this.websocket.onopen = null; // Clear handlers to prevent events on closed socket
            this.websocket.onclose = null;
            this.websocket.onmessage = null;
            this.websocket.onerror = null;
            this.websocket.close();
            this.websocket = null;
        }
    }

    private assertConnected(): void {
        if ( !this.connected || !this.websocket ) {
            throw "DecafMUD is not currently connected.";
        }
    }

    write(data: string): void {
        this.assertConnected();
        const text = new Array(data.length);
        for(let i=0; i< data.length; i++) {
            text[i] = data.charCodeAt(i);
        }
        const arr = (new Uint8Array(text)).buffer;
        this.websocket!.send(arr); // Add non-null assertion operator
    }

    private onOpen(event: Event): void {
        if ( this.websocket && this.websocket.readyState === WebSocket.OPEN ) { // Use WebSocket.OPEN
            this.connected = true;
            this.decaf.socketConnected();
        }
    }

    private onClose(event: CloseEvent): void { // event is CloseEvent
        if ( this.connected ) {
            this.connected = false;
            this.decaf.socketClosed();
        }
        // Ensure websocket is nullified if it was the one that closed
        if (this.websocket && event.target === this.websocket) {
             this.websocket = null;
        }
    }

    private onMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            this.decaf.socketData(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
            // If data is string, convert to Uint8Array (should ideally not happen with binaryType='arraybuffer')
             const encoder = new TextEncoder(); // Modern way to encode string to Uint8Array
             this.decaf.socketData(encoder.encode(event.data));
        } else if (event.data instanceof Blob) {
             const reader = new FileReader();
             reader.onload = (e: ProgressEvent<FileReader>) => {
                 if (e.target && e.target.result instanceof ArrayBuffer) {
                    this.decaf.socketData(new Uint8Array(e.target.result));
                 }
             };
             reader.readAsArrayBuffer(event.data);
        }
    }

    private onError(event: Event): void {
        // Handle WebSocket errors, e.g., by logging or attempting to reconnect
        this.decaf.socketError("WebSocket error", event);
        // Consider closing the socket and informing DecafMUD
        if (this.connected) {
            this.connected = false;
            this.decaf.socketClosed();
        }
        this.websocket = null;
    }
}

// Add this to DecafMUD
(DecafMUDGlobal as any).plugins.Socket.websocket = DecafWebSocket;

})(DecafMUD);
