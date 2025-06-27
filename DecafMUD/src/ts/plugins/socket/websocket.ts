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

import { DecafMUD } from '../../decafmud'; // Adjust path as necessary

export class WebSocketSocket {
    private decaf: DecafMUD;
    public host: string | undefined = undefined;
    public port: number | undefined = undefined;
    private ssl: boolean | undefined = undefined;
    public connected: boolean = false;
    public ready: boolean = false;
    private websocket: WebSocket | null = null;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
    }

    public setup(): void {
        if ("WebSocket" in window) {
            this.ready = true;
            this.decaf.socketReady(); // Removed 'this' argument as socketReady in core doesn't expect it.
            return;
        }

        if (this.decaf.timer) clearTimeout(this.decaf.timer); // Assuming decaf.timer is public or accessible
        this.decaf.error(
            formatString( // Assuming formatString is globally available or imported into DecafMUD core
                "Unable to create a WebSocket. Does your browser support them? If not, try {0}.",
                '<a href="http://www.google.com/chrome" target="_blank">Google Chrome</a>'
            )
        );
    }

    public connect(): void {
        if (this.connected && this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        let currentPort = this.port;
        if (currentPort === undefined) {
            currentPort = this.decaf.options.set_socket.wsport;
            if (typeof currentPort !== 'number' || currentPort < 1 || currentPort > 65535) {
                currentPort = this.decaf.options.set_socket.policyport; // Fallback, though policyport is for Flash
            }
            if (typeof currentPort !== 'number' || currentPort < 1 || currentPort > 65535) { // Final fallback if policyport also not set
                currentPort = 843; // Default WebSocket proxy wrapper often runs here
            }
            this.port = currentPort;
        }

        let path = this.decaf.options.set_socket.wspath;
        if (path === undefined) { // Default path construction if not provided
            path = 'port_' + this.decaf.options.port;
        }

        let currentHost = this.host;
        if (currentHost === undefined) {
            currentHost = this.decaf.options.host;
            if (!currentHost && typeof document !== 'undefined') {
                currentHost = document.location.host;
            }
            this.host = currentHost;
        }

        let currentSsl = this.ssl;
        if (currentSsl === undefined) {
            currentSsl = this.decaf.options.set_socket.ssl;
            if (currentSsl === undefined) {
                currentSsl = false;
            }
            this.ssl = currentSsl;
        }

        if (!currentHost) {
            this.decaf.error("WebSocket connection failed: Hostname is not defined.");
            return;
        }

        const protocol = currentSsl ? 'wss' : 'ws';
        const connectionString = `${protocol}://${currentHost}:${currentPort}/${path}`;
        this.decaf.debugString(`WebSocket Connection String: ${connectionString}`);

        try {
            this.websocket = new WebSocket(connectionString, 'binary'); // 'binary' is a subprotocol hint
            this.websocket.binaryType = 'arraybuffer'; // Crucial for receiving binary data correctly

            this.websocket.onopen = (event) => this.onOpen(event);
            this.websocket.onclose = (event) => this.onClose(event);
            this.websocket.onmessage = (event) => this.onMessage(event);
            this.websocket.onerror = (event) => this.onError(event);
        } catch (e: any) {
            this.decaf.error(formatString("Failed to create WebSocket: {0}", e.message));
            if (this.decaf.socketClosed) { // Check if method exists before calling
                this.decaf.socketClosed(); // Simulate a closure if connection failed to start
            }
        }
    }

    public close(): void {
        this.connected = false;
        if (this.websocket) {
            this.websocket.onopen = null; // Clear handlers to prevent events during manual close
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
            throw new Error("DecafMUD is not currently connected via WebSocket.");
        }
    }

    public write(data: string): void {
        this.assertConnected();
        if (!this.websocket) return; // Should be caught by assertConnected, but good for type safety

        // Convert string to Uint8Array then to ArrayBuffer, as WebSocket.send(ArrayBuffer) is preferred for binary
        const byteArray = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            byteArray[i] = data.charCodeAt(i) & 0xFF; // Ensure byte values
        }
        this.websocket.send(byteArray.buffer);
    }

    private onOpen(event: Event): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.connected = true;
            this.decaf.socketConnected();
        }
    }

    private onClose(event: CloseEvent): void {
        const previouslyConnected = this.connected;
        this.close(); // Perform full cleanup
        if (previouslyConnected) {
            this.decaf.socketClosed();
        }
        // Optionally log event.code and event.reason for debugging
        this.decaf.debugString(`WebSocket closed. Code: ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}`);
    }

    private onError(event: Event): void {
        // Type assertion if specific error properties are needed, e.g. (event as ErrorEvent).message
        this.decaf.error(formatString("WebSocket error occurred. See browser console for details. Event: {0}", event.type));
        // Consider also calling decaf.socketClosed() or a more specific error handler if the connection drops
        // The onClose event will likely fire after an error that closes the socket.
    }

    private onMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            this.decaf.socketData(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
            // This case should ideally not happen if server respects 'binary' subprotocol and we set binaryType='arraybuffer'
            // However, if it does, we need to convert string to Uint8Array
            this.decaf.debugString("WebSocket received string data, converting to Uint8Array. This is unexpected for 'binary' protocol.", "warn");
            const stringData = event.data as string;
            const buffer = new Uint8Array(stringData.length);
            for (let i = 0; i < stringData.length; i++) {
                buffer[i] = stringData.charCodeAt(i);
            }
            this.decaf.socketData(buffer);
        } else if (event.data instanceof Blob) {
            // If data is a Blob, convert it to ArrayBuffer
             this.decaf.debugString("WebSocket received Blob data, converting to ArrayBuffer.", "warn");
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                if (e.target && e.target.result instanceof ArrayBuffer) {
                    this.decaf.socketData(new Uint8Array(e.target.result));
                } else {
                    this.decaf.error("Failed to read Blob data from WebSocket.");
                }
            };
            reader.onerror = () => {
                 this.decaf.error("Error reading Blob data from WebSocket.");
            };
            reader.readAsArrayBuffer(event.data as Blob);
        } else {
            this.decaf.error(formatString("WebSocket received unknown data type: {0}", typeof event.data));
        }
    }
}

// Helper function `formatString` needs to be available.
// Assuming it's accessible via DecafMUD instance or globally.
// For direct use here, it would need to be imported or defined in this scope.
// For now, assuming `this.decaf.error` or `this.decaf.debugString` might internally use it,
// or it's a global utility. If not, this will cause runtime errors.
// Let's define a local one for safety if it's not part of DecafMUD's public API for plugins.
function formatString(text: string, ...args: any[]): string {
	let s = text;
	if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
		const obj = args[0];
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				s = s.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
			}
		}
	} else {
		for (let i = 0; i < args.length; i++) {
			s = s.replace(new RegExp(`{${i}}`, 'g'), args[i]);
		}
	}
	return s;
}

// Registration:
// import { WebSocketSocket } from './plugins/socket/websocket';
// DecafMUD.plugins.Socket.websocket = WebSocketSocket;
// This will be done in decafmud.ts
```
