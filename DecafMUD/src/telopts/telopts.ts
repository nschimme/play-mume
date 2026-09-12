/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { TeloptHandler, TN } from '../types';
import { ENCODINGS } from '../encodings';
import type { DecafMUD } from '../decafmud';

export class TTYPEHandler implements TeloptHandler {
  private decaf: DecafMUD;
  public current = -1;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public _dont(): void {
    this.current = -1;
  }

  public disconnect(): void {
    this.current = -1;
  }

  public _sb(data: string): boolean {
    if (data !== TN.ECHO) return true;
    const ttypes = this.decaf.options.ttypes || ['decafmud', 'xterm', 'unknown'];
    this.current = (this.current + 1) % ttypes.length;
    this.decaf.debugString(`RCVD IAC SB TTYPE SEND IAC SE`);
    this.decaf.sendIAC(TN.IAC + TN.SB + TN.TTYPE + TN.IS + ttypes[this.current] + TN.IAC + TN.SE);
    return false;
  }
}

export class ECHOHandler implements TeloptHandler {
  private decaf: DecafMUD;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public _will(): void {
    if (this.decaf.ui) {
      this.decaf.ui.localEcho(false);
    }
  }

  public _wont(): void {
    if (this.decaf.ui) {
      this.decaf.ui.localEcho(true);
    }
  }

  public disconnect(): void {
    if (this.decaf.ui) {
      this.decaf.ui.localEcho(true);
    }
  }
}

export class NAWSHandler implements TeloptHandler {
  private decaf: DecafMUD;
  public enabled = false;
  public last?: [number, number];

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public _do(): void {
    this.last = undefined;
    this.enabled = true;
    setTimeout(() => this.send(), 0);
  }

  public _dont(): void {
    this.enabled = false;
  }

  public disconnect(): void {
    this.enabled = false;
  }

  public send(): void {
    if (!this.decaf.display || !this.enabled) return;
    const sz = this.decaf.display.getSize();
    if (this.last && this.last[0] === sz[0] && this.last[1] === sz[1]) return;
    this.last = sz;

    let data = String.fromCharCode(Math.floor(sz[0] / 255));
    data += String.fromCharCode(sz[0] % 255);
    data += String.fromCharCode(Math.floor(sz[1] / 255));
    data += String.fromCharCode(sz[1] % 255);
    data = TN.IAC + TN.SB + TN.NAWS + data.replace(/\xFF/g, '\xFF\xFF') + TN.IAC + TN.SE;
    this.decaf.sendIAC(data);
  }
}

export class CHARSETHandler implements TeloptHandler {
  private decaf: DecafMUD;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public _dont(): boolean {
    return false;
  }

  public _will(): void {
    setTimeout(() => {
      const cs: string[] = [];
      const done: string[] = [];
      const current = this.decaf.options.encoding || 'utf8';
      const encObj = ENCODINGS[current];

      if (current !== 'iso88591' && encObj && encObj.proper) {
        cs.push(encObj.proper);
        done.push(current);
      }

      const order = this.decaf.options.encoding_order || ['utf8'];
      for (const e of order) {
        const o = ENCODINGS[e];
        if (o && o.proper && !done.includes(e)) {
          cs.push(o.proper);
          done.push(e);
        }
      }

      for (const k in ENCODINGS) {
        if (!done.includes(k) && ENCODINGS[k]?.proper) {
          cs.push(ENCODINGS[k].proper);
        }
      }

      this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + TN.ECHO + ' ' + cs.join(' ') + TN.IAC + TN.SE);
    }, 0);
  }

  public _sb(data: string): boolean {
    this.decaf.debugString(`RCVD IAC SB CHARSET ${data} IAC SE`);

    if (data.charCodeAt(0) === 1) {
      let subData = data.substring(1);
      if (subData.startsWith('TTABLE ')) {
        subData = subData.substring(7);
      }
      const sep = subData.charAt(0);
      const items = subData.substring(1).split(sep);

      let acceptedEnc: string | undefined;
      let matchedName: string | undefined;

      const order = this.decaf.options.encoding_order || ['utf8'];
      for (const i of order) {
        const e = ENCODINGS[i];
        if (!e || !e.proper) continue;
        if (items.includes(i)) {
          matchedName = i;
          acceptedEnc = i;
          break;
        }
        if (items.includes(e.proper)) {
          matchedName = e.proper;
          acceptedEnc = i;
          break;
        }
      }

      if (!acceptedEnc) {
        for (const o of items) {
          for (const k in ENCODINGS) {
            if (o === k || o === ENCODINGS[k]?.proper) {
              acceptedEnc = k;
              matchedName = o;
              break;
            }
          }
          if (acceptedEnc) break;
        }
      }

      if (acceptedEnc) {
        this.decaf.setEncoding(acceptedEnc);
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + '\x02' + (matchedName || acceptedEnc) + TN.IAC + TN.SE);
      } else {
        this.decaf.debugString(`No encoder for: ${items.join(sep)}`);
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + '\x03' + TN.IAC + TN.SE);
      }
    } else if (data.charCodeAt(0) === 2) {
      const targetName = data.substring(1);
      for (const k in ENCODINGS) {
        if (ENCODINGS[k]?.proper === targetName) {
          this.decaf.setEncoding(k);
          break;
        }
      }
    }

    return false;
  }
}

export class COMPRESSv2Handler implements TeloptHandler {
  private decaf: DecafMUD;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    this.decaf.startCompressV2 = false;
  }

  public _will(): boolean {
    if (typeof (window as unknown as Record<string, unknown>).Zlib === 'undefined') {
      this.decaf.debugString('Unable to load Zlib for COMPRESSv2 support');
      return false;
    }
    return true;
  }

  public _sb(): void {
    this.decaf.debugString('RCVD IAC SB COMPRESSv2 IAC SE');
    this.decaf.startCompressV2 = true;
  }
}

export class MSDPHandler implements TeloptHandler {
  private decaf: DecafMUD;
  public commands: string[] = ['LIST'];
  public variables: string[] = [];
  public reportable: string[] = [];

  public static configVars: Record<string, string> = {
    CLIENT_NAME: 'decafmud',
    CLIENT_VERSION: '0.9.0',
    PLUGIN_ID: '0',
    ANSI_COLORS: '1',
    UTF_8: '1',
    XTERM_256_COLORS: '1',
  };

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
  }

  public connect(): void {
    this.commands = ['LIST'];
    this.variables = [];
    this.reportable = [];
  }

  public _will(): void {
    setTimeout(() => {
      this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + '\x01LIST\x02COMMANDS' + TN.IAC + TN.SE);
      this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + '\x01LIST\x02VARIABLES' + TN.IAC + TN.SE);
      this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + '\x01LIST\x02CONFIGURABLE_VARIABLES' + TN.IAC + TN.SE);
      this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + '\x01LIST\x02REPORTABLE_VARIABLES' + TN.IAC + TN.SE);
    }, 0);
  }

  public _sb(data: string): boolean {
    const out = readMSDP(data)[0];
    if (out['COMMANDS'] && Array.isArray(out['COMMANDS'])) {
      this.commands.push(...(out['COMMANDS'] as string[]));
    }
    if (out['VARIABLES'] && Array.isArray(out['VARIABLES'])) {
      this.variables.push(...(out['VARIABLES'] as string[]));
    }
    if (out['CONFIGURABLE_VARIABLES'] && Array.isArray(out['CONFIGURABLE_VARIABLES'])) {
      const cfgList = out['CONFIGURABLE_VARIABLES'] as string[];
      const ot: Record<string, string> = {};
      for (const k of cfgList) {
        if (MSDPHandler.configVars[k]) {
          ot[k] = MSDPHandler.configVars[k];
        }
      }
      this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + writeMSDP(ot) + TN.IAC + TN.SE);
    }
    return false;
  }
}

/* eslint-disable-next-line no-control-regex */
const msdpRegex = /[\x01\x02\x03\x04]/;

function readMSDP(data: string): [Record<string, unknown>, string] {
  const out: Record<string, unknown> = {};
  let variable: string | undefined;

  while (data.length > 0) {
    const c = data.charCodeAt(0);

    if (c === 1) {
      const ind = data.substring(1).search(msdpRegex);
      if (ind === -1) {
        variable = data.substring(1);
        data = '';
      } else {
        variable = data.substring(1, ind + 1);
        data = data.substring(ind + 2);
      }
      out[variable] = undefined;
      continue;
    }

    if (c === 4) {
      data = data.substring(1);
      break;
    }

    if (variable === undefined) {
      return [out, ''];
    }

    if (c === 2) {
      let val: unknown = '';
      if (data.charCodeAt(1) === 3) {
        const o = readMSDP(data.substring(2));
        val = o[0];
        data = o[1];
      } else {
        const ind = data.substring(1).search(msdpRegex);
        if (ind === -1) {
          val = data.substring(1);
          data = '';
        } else {
          val = data.substring(1, ind + 1);
          data = data.substring(ind + 2);
        }
      }

      if (out[variable] === undefined) {
        out[variable] = val;
      } else if (Array.isArray(out[variable])) {
        (out[variable] as unknown[]).push(val);
      } else {
        out[variable] = [out[variable], val];
      }
      continue;
    }
    break;
  }
  return [out, data];
}

function writeMSDP(obj: unknown): string {
  const t = typeof obj;
  if (t === 'string' || t === 'number') return (obj as number | string).toString();
  if (t === 'boolean') return obj ? '1' : '0';
  if (t === 'undefined' || obj === null) return '';

  if (t === 'object') {
    let out = '';
    const map = obj as Record<string, unknown>;
    for (const k in map) {
      if (map[k] === undefined || map[k] === null || typeof map[k] === 'function') continue;
      out += '\x01' + k;
      if (typeof map[k] === 'object') {
        if (Array.isArray(map[k])) {
          const arr = map[k] as unknown[];
          for (const item of arr) {
            out += '\x02' + writeMSDP(item);
          }
        } else {
          out += '\x02\x03' + writeMSDP(map[k]) + '\x04';
        }
      } else {
        out += '\x02' + writeMSDP(map[k]);
      }
    }
    return out;
  }
  return String(obj);
}
