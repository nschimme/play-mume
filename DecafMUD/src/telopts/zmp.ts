/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { TeloptHandler, TN } from '../types';
import { DecafMUD } from '../decafmud';

export class ZMPTelopt implements TeloptHandler {
  public decaf: DecafMUD;
  public static commands: Record<string, unknown> = {};

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public sendZMP(cmd: string, data?: string[]): void {
    let out = '';
    if (data !== undefined) {
      out = '\x00' + data.join('\x00');
    }
    this.decaf.sendIAC(TN.IAC + TN.SB + TN.ZMP + cmd + out + '\x00' + TN.IAC + TN.SE);
  }

  public _will(): void {
    setTimeout(() => {
      this.sendZMP('zmp.ident', [
        'DecafMUD',
        DecafMUD.version.toString(),
        'HTML5 MUD Client',
      ]);
    }, 0);
  }

  public _sb(data: string): boolean {
    if (data.indexOf('\x00') < 1) return true;
    const dat = data.split('\x00');
    const cmd = dat.shift()!;

    this.decaf.debugString(`RCVD ${TN.IAC}${TN.SB}${TN.ZMP}${data}${TN.IAC}${TN.SE}`);

    const func = this.getFunction(cmd);
    if (func) {
      func.call(this, cmd, dat);
    }

    return false;
  }

  public getFunction(cmd: string, packageOk = false): ((cmd: string, data: string[]) => void) | undefined {
    const parts = cmd.split('.');
    let top: unknown = ZMPTelopt.commands;
    while (parts.length > 0) {
      const part = parts.shift()!;
      if (!top || typeof top !== 'object') return undefined;
      top = (top as Record<string, unknown>)[part];
    }

    if (typeof top === 'function') {
      return top as (cmd: string, data: string[]) => void;
    }
    if (packageOk) return top as unknown as (cmd: string, data: string[]) => void;
    return undefined;
  }
}

ZMPTelopt.commands = {
  zmp: {
    check(this: ZMPTelopt, _cmd: string, data: string[]) {
      for (const c of data) {
        if (c.length > 0) {
          const checkCmd = c.endsWith('.') ? c.substring(0, c.length - 1) : c;
          const func = this.getFunction(checkCmd, true);
          if (func === undefined) {
            this.sendZMP('zmp.no-support', [c]);
          } else {
            this.sendZMP('zmp.support', [c]);
          }
        }
      }
    },
    ping(this: ZMPTelopt, _cmd: string, _data: string[]) {
      const c = new Date();
      const yr = c.getUTCFullYear().toString();
      const mn = (c.getUTCMonth() + 1).toString().padStart(2, '0');
      const dy = c.getUTCDate().toString().padStart(2, '0');
      const hr = c.getUTCHours().toString().padStart(2, '0');
      const mi = c.getUTCMinutes().toString().padStart(2, '0');
      const sc = c.getUTCSeconds().toString().padStart(2, '0');
      this.sendZMP('zmp.time', [`${yr}-${mn}-${dy} ${hr}:${mi}:${sc}`]);
    },
  },
};
