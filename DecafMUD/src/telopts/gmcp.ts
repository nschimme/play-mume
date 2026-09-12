/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { GMCPHandlerCallback, GMCPPlugin, TeloptHandler, TN } from '../types';
import { DecafMUD } from '../decafmud';

export class GMCPTelopt implements GMCPPlugin, TeloptHandler {
  public decaf: DecafMUD;
  public pingDelay = 60;
  public pingAverage = 0;
  public pingCount = 0;
  public pingWhen?: Date;
  public pingTimer?: ReturnType<typeof setTimeout>;
  public packages: Record<string, unknown> = {};

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    this.decaf.gmcp = this;

    this.packages.Core = {
      version: 1,
      Ping: (_data: unknown) => {
        if (this.pingWhen) {
          const n = new Date().getTime() - this.pingWhen.getTime();
          this.pingCount++;
          this.pingAverage = Math.ceil((n + this.pingAverage * (this.pingCount - 1)) / this.pingCount);
          this.decaf.debugString(`PING: ${this.pingAverage}ms over ${this.pingCount} pings`);
        }
      },
      Goodbye: (data: unknown) => {
        this.decaf.debugString(`Reason for disconnect: ${JSON.stringify(data)}`);
      },
    };
  }

  public sendGMCP(pckg: string, data?: unknown): void {
    let out = '';
    if (data !== undefined) {
      out = JSON.stringify([data]);
      out = ' ' + out.substring(1, out.length - 1);
    }

    this.decaf.sendIAC(TN.IAC + TN.SB + TN.GMCP + pckg + out + TN.IAC + TN.SE);
  }

  public _wont(): void {
    this.disconnect();
  }

  public disconnect(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = undefined;
    }
    this.pingAverage = 0;
    this.pingCount = 0;
  }

  public _will(): void {
    setTimeout(() => {
      this.sendGMCP('Core.Hello', {
        client: 'DecafMUD',
        version: DecafMUD.version.toString(),
      });
    }, 0);

    this.pingTimer = setTimeout(() => this.ping(), this.pingDelay * 1000);
  }

  public ping(): void {
    const avg = this.pingCount > 0 ? this.pingAverage : undefined;
    this.sendGMCP('Core.Ping', avg);
    this.pingWhen = new Date();

    this.pingTimer = setTimeout(() => this.ping(), this.pingDelay * 1000);
  }

  public _sb(data: string): boolean {
    const ind = data.search(/[^A-Za-z0-9._]/);
    let ret = false;
    let pckg: string;
    let out: unknown;

    if (ind !== -1) {
      pckg = data.substring(0, ind);
      if (ind + 1 !== data.length) {
        try {
          out = JSON.parse('[' + data.substring(ind + 1) + ']')[0];
        } catch (err) {
          this.decaf.debugString(`GMCP JSON parse error: ${err}`, 'warn');
        }
      }
    } else {
      pckg = data;
    }

    if (pckg.length === 0) return true;

    if (out !== undefined && typeof console !== 'undefined' && console.groupCollapsed) {
      console.groupCollapsed(`DecafMUD[${this.decaf.id}] RCVD IAC SB GMCP "${pckg}" ... IAC SE`);
      console.dir(out);
      console.groupEnd();
    } else {
      ret = true;
    }

    this.decaf.emit('gmcp', { package: pckg, data: out });

    const func = this.getFunction(pckg);
    if (func) {
      func.call(this, out);
    }

    return ret;
  }

  public getFunction(pckg: string): ((data: unknown) => void) | undefined {
    const parts = pckg.split('.');
    let top: unknown = this.packages;

    while (parts.length > 0) {
      const part = parts.shift()!;
      if (!top || typeof top !== 'object') return undefined;
      top = (top as Record<string, unknown>)[part];
    }

    if (typeof top === 'function') {
      return top as (data: unknown) => void;
    }

    if (Array.isArray(top)) {
      const handlers = [...top];
      return (data: unknown) => {
        for (const h of handlers) {
          if (typeof h === 'function') {
            h.call(this, data);
          }
        }
      };
    }

    return undefined;
  }

  public registerHandler(pckg: string, callback: GMCPHandlerCallback): () => void {
    const parts = pckg.split('.');
    const last = parts.pop()!;
    let top = this.packages;

    while (parts.length > 0) {
      const part = parts.shift()!;
      if (!top[part] || typeof top[part] !== 'object') {
        top[part] = {};
      }
      top = top[part] as Record<string, unknown>;
    }

    const existing = top[last];
    if (existing === undefined) {
      top[last] = [callback];
    } else if (Array.isArray(existing)) {
      existing.push(callback);
    } else if (typeof existing === 'function') {
      top[last] = [existing, callback];
    } else {
      top[last] = [callback];
    }

    return () => {
      this.unregisterHandler(pckg, callback);
    };
  }

  public unregisterHandler(pckg: string, callback: GMCPHandlerCallback): void {
    const parts = pckg.split('.');
    const last = parts.pop()!;
    let top = this.packages;

    while (parts.length > 0) {
      const part = parts.shift()!;
      if (!top[part] || typeof top[part] !== 'object') return;
      top = top[part] as Record<string, unknown>;
    }

    const existing = top[last];
    if (Array.isArray(existing)) {
      const index = existing.indexOf(callback);
      if (index !== -1) {
        existing.splice(index, 1);
      }
      if (existing.length === 0) {
        delete top[last];
      }
    } else if (existing === callback) {
      delete top[last];
    }
  }
}
