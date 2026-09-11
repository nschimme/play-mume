/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { EncodingPlugin } from './types';

export const ISO88591Encoding: EncodingPlugin = {
  proper: 'ISO-8859-1',
  decode(data: string): [string, string] {
    return [data, ''];
  },
  encode(data: string): string {
    return data;
  },
};

export const UTF8Encoding: EncodingPlugin = {
  proper: 'UTF-8',
  decode(data: string): [string, string] {
    try {
      return [decodeURIComponent(escape(data)), ''];
    } catch {
      let out = '';
      let i = 0;
      const l = data.length;
      let c = 0;
      while (i < l) {
        c = data.charCodeAt(i++);
        if (c < 0x80) {
          out += String.fromCharCode(c);
        } else if (c > 0xbf && c < 0xe0) {
          if (i + 1 >= l) break;
          out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63));
        } else if (c > 0xdf && c < 0xf0) {
          if (i + 2 >= l) break;
          out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63));
        } else if (c > 0xef && c < 0xf5) {
          if (i + 3 >= l) break;
          out += String.fromCharCode(((c & 10) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63));
        } else {
          out += String.fromCharCode(c);
        }
      }
      return [out, data.substring(i)];
    }
  },
  encode(data: string): string {
    try {
      return unescape(encodeURIComponent(data));
    } catch (err) {
      console.dir(err);
      return data;
    }
  },
};

export const ISO885915Encoding: EncodingPlugin = {
  proper: 'ISO-8859-15',
  decode(data: string): [string, string] {
    let out = '';
    for (let i = 0; i < data.length; i++) {
      const c = data.charCodeAt(i);
      switch (c) {
        case 0xa4: out += '\u20ac'; break;
        case 0xa6: out += '\u0160'; break;
        case 0xa8: out += '\u0161'; break;
        case 0xb4: out += '\u017d'; break;
        case 0xb8: out += '\u017e'; break;
        case 0xbc: out += '\u0152'; break;
        case 0xbd: out += '\u0153'; break;
        case 0xbe: out += '\u0178'; break;
        default: out += String.fromCharCode(c);
      }
    }
    return [out, ''];
  },
  encode(data: string): string {
    let out = '';
    for (let i = 0; i < data.length; i++) {
      const c = data.charCodeAt(i);
      switch (c) {
        case 0x20ac: out += '\xa4'; break;
        case 0x0160: out += '\xa6'; break;
        case 0x0161: out += '\xa8'; break;
        case 0x017d: out += '\xb4'; break;
        case 0x017e: out += '\xb8'; break;
        case 0x0152: out += '\xbc'; break;
        case 0x0153: out += '\xbd'; break;
        case 0x0178: out += '\xbe'; break;
        default: out += String.fromCharCode(c);
      }
    }
    return out;
  },
};

export const CP437Encoding: EncodingPlugin = {
  proper: 'CP437',
  decode(data: string): [string, string] {
    const cp437Table = [
      '\u0000', '\u263A', '\u263B', '\u2665', '\u2666', '\u2663', '\u2660', '\u2022',
      '\u25D8', '\u25CB', '\u25D9', '\u2642', '\u2640', '\u266A', '\u266B', '\u263C',
      '\u25BA', '\u25C4', '\u2195', '\u203C', '\u00B6', '\u00A7', '\u25AC', '\u21A8',
      '\u2191', '\u2193', '\u2192', '\u2190', '\u221F', '\u2194', '\u25B2', '\u25BC',
    ];
    let out = '';
    for (let i = 0; i < data.length; i++) {
      const c = data.charCodeAt(i);
      if (c < 32) {
        out += cp437Table[c];
      } else if (c === 127) {
        out += '\u2302';
      } else {
        out += String.fromCharCode(c);
      }
    }
    return [out, ''];
  },
  encode(data: string): string {
    return data;
  },
};

export const ENCODINGS: Record<string, EncodingPlugin> = {
  iso88591: ISO88591Encoding,
  'iso-8859-1': ISO88591Encoding,
  utf8: UTF8Encoding,
  'utf-8': UTF8Encoding,
  iso885915: ISO885915Encoding,
  'iso-8859-15': ISO885915Encoding,
  cp437: CP437Encoding,
};
