/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules
 */

import { DecafMUD, DecafMUDEncoding } from "decafmud";

// ISO-8859-1 --> ISO-8859-15 replacements
const replaces: { [key: string]: string } = {
    '\xA4': '\u20AC', // EURO SIGN
    '\xA6': '\u0160', // LATIN CAPITAL LETTER S WITH CARON
    '\xA8': '\u0161', // LATIN SMALL LETTER S WITH CARON
    '\xB4': '\u017D', // LATIN CAPITAL LETTER Z WITH CARON
    '\xB8': '\u017E', // LATIN SMALL LETTER Z WITH CARON
    '\xBC': '\u0152', // LATIN CAPITAL LIGATURE OE
    '\xBD': '\u0153', // LATIN SMALL LIGATURE OE
    '\xBE': '\u0178'  // LATIN CAPITAL LETTER Y WITH DIAERESIS
};

// Reverse the map for ISO-8859-15 --> ISO-8859-1 (Unicode to single byte)
const unreplaces: { [key: string]: string } = {};
let rep_reg_str = '[';
let unrep_reg_str = '[';

for (const k in replaces) {
    if (Object.prototype.hasOwnProperty.call(replaces, k)) {
        rep_reg_str += k;
        unrep_reg_str += replaces[k];
        unreplaces[replaces[k]] = k;
    }
}
rep_reg_str += ']';
unrep_reg_str += ']';

const rep_reg = new RegExp(rep_reg_str, "g");
const unrep_reg = new RegExp(unrep_reg_str, "g");

const decode = function(data: string): [string, string] {
    return [data.replace(rep_reg, (m) => replaces[m]), ''];
};

const encode = function(data: string): string {
    return data.replace(unrep_reg, (m) => unreplaces[m]);
};

const iso885915Encoding: DecafMUDEncoding = {
    proper: 'ISO-8859-15',
    decode: decode,
    encode: encode
};

// Expose to DecafMUD
if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins && DecafMUD.plugins.Encoding) {
    DecafMUD.plugins.Encoding.iso885915 = iso885915Encoding;
}

export default iso885915Encoding;
// Exporting the object itself in case direct import is ever preferred,
// but primary mechanism for now is self-registration.
