import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

class WebSocketConnection {
  private decaf: DecafMUD;
  private websocket: WebSocket | null = null;
  public host?: string;
  public port?: number;
  private ssl?: boolean;
  public connected = false;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public connect(): void {
    if (this.connected && this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.port = this.port ?? this.decaf.options.set_socket?.wsport ?? this.decaf.options.port ?? 843;
    const path = this.decaf.options.set_socket?.wspath ?? `port_${this.decaf.options.port}`;
    this.host = this.host ?? this.decaf.options.host ?? document.location.host;
    this.ssl = this.ssl ?? this.decaf.options.set_socket?.ssl ?? false;

    const con = `ws${this.ssl ? 's' : ''}://${this.host}:${this.port}/${path}`;
    this.decaf.debugString(`WebSocket Connection String: ${con}`);

    this.websocket = new WebSocket(con, 'binary');
    this.websocket.onopen = this.onOpen.bind(this);
    this.websocket.onclose = this.onClose.bind(this);
    this.websocket.onmessage = this.onMessage.bind(this);
  }

  public close(): void {
    this.connected = false;
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  public write(data: string): void {
    if (!this.connected || !this.websocket) {
      throw new Error('DecafMUD is not currently connected.');
    }
    const text = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
      text[i] = data.charCodeAt(i);
    }
    const arr = new Uint8Array(text).buffer;
    this.websocket.send(arr);
  }

  private onOpen(): void {
    if (this.websocket?.readyState === 1) {
      this.connected = true;
      this.decaf.socketConnected();
    }
  }

  private onClose(): void {
    if (this.connected) {
      this.connected = false;
      this.decaf.socketClosed();
      this.websocket = null;
    }
  }

  private onMessage(event: MessageEvent): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.decaf.socketData(new Uint8Array(e.target?.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(event.data);
  }
}

class WebSocketPlugin implements Plugin {
  public readonly name = 'websocket';

  public install(decaf: DecafMUD): void {
    if ('WebSocket' in window) {
      decaf.registerSocket('websocket', WebSocketConnection);
    } else {
      decaf.error('WebSockets are not supported in this browser.');
    }
  }
}

export const websocketPlugin = new WebSocketPlugin();
