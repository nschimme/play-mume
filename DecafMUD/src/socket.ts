/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { DecafMUDSocket } from './types';
import type { DecafMUD } from './decafmud';

export class DecafWebSocket implements DecafMUDSocket {
  public host?: string;
  public port?: number;
  public ssl?: boolean;
  public connected = false;
  public ready = false;

  private websocket: WebSocket | null = null;
  private decaf: DecafMUD;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public setup(): void {
    if (typeof window !== 'undefined' && 'WebSocket' in window) {
      this.ready = true;
      this.decaf.socketReady();
      return;
    }

    this.decaf.error('Unable to create a WebSocket. Does your browser support them?');
  }

  public connect(): void {
    this.close();
    this.connected = false;

    let port = this.port;
    if (port === undefined) {
      port = this.decaf.options.set_socket?.wsport;
      if (!port || port < 1 || port > 65535) {
        port = this.decaf.options.set_socket?.policyport;
      }
      if (port === undefined) {
        port = 843;
      }
      this.port = port;
    }

    let path = this.decaf.options.set_socket?.wspath;
    if (path === undefined) {
      path = 'port_' + (this.decaf.options.port || 4000);
    }

    let host = this.host;
    if (host === undefined) {
      host = this.decaf.options.host;
      if (!host && typeof document !== 'undefined') {
        host = document.location.host;
      }
      this.host = host || 'localhost';
    }

    let ssl = this.ssl;
    if (ssl === undefined) {
      ssl = this.decaf.options.set_socket?.ssl ?? false;
      this.ssl = ssl;
    }

    const con = `ws${ssl ? 's' : ''}://${host}:${port}/${path}`;
    this.decaf.debugString(`WebSocket Connection String: ${con}`);

    try {
      this.websocket = new WebSocket(con, 'binary');
      const ws = this.websocket;

      ws.onopen = (event) => this.onOpen(ws, event);
      ws.onclose = (event) => this.onClose(ws, event);
      ws.onmessage = (event) => this.onMessage(ws, event);
      ws.onerror = (event) => this.onError(ws, event);
    } catch (err) {
      this.decaf.debugString(`WebSocket creation error: ${err}`, 'error');
    }
  }

  public close(): void {
    this.connected = false;
    if (this.websocket) {
      const ws = this.websocket;
      this.websocket = null;
      ws.onopen = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  public write(data: string): void {
    if (!this.connected || !this.websocket) {
      throw new Error('DecafMUD is not currently connected.');
    }
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i);
    }
    this.websocket.send(bytes.buffer);
  }

  private onOpen(ws: WebSocket, _event: Event): void {
    if (ws.readyState === WebSocket.OPEN) {
      this.connected = true;
      this.decaf.socketConnected();
    }
  }

  private onClose(ws: WebSocket, _event: CloseEvent): void {
    const wasConnected = this.connected;
    this.connected = false;

    if (this.websocket === ws) {
      this.websocket = null;
    }

    if (wasConnected) {
      this.decaf.socketClosed();
    }
  }

  private onMessage(_ws: WebSocket, event: MessageEvent): void {
    if (typeof event.data === 'string') {
      this.decaf.socketData(event.data);
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      this.decaf.socketData(new Uint8Array(event.data));
      return;
    }

    if (event.data instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          this.decaf.socketData(new Uint8Array(e.target.result));
        }
      };
      reader.readAsArrayBuffer(event.data);
    }
  }

  private onError(_ws: WebSocket, _event: Event): void {
    this.decaf.socketError('WebSocket error event occurred');
  }
}
