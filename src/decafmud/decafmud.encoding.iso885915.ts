import { DecafMUD } from './decafmud';
// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

 /**
 * @fileOverview DecafMUD Character Encoding: ISO-8859-15
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// ISO-8859-1 --> ISO-8859-15
const replaces: Record<string, string> = {
	'\xA4': '\u20AC', // EURO SIGN
	'\xA6': '\u0160', // LATIN CAPITAL LETTER S WITH CARON
	'\xA8': '\u0161', // LATIN SMALL LETTER S WITH CARON
	'\xB4': '\u017D', // LATIN CAPITAL LETTER Z WITH CARON
	'\xB8': '\u017E', // LATIN SMALL LETTER Z WITH CARON
	'\xBC': '\u0152', // LATIN CAPITAL LIGATURE OE
	'\xBD': '\u0153', // LATIN SMALL LIGATURE OE
	'\xBE': '\u0178'  // LATIN CAPITAL LETTER Y WITH DIAERESIS
};

// Reverse the array for ISO-8859-15 --> ISO-8859-1
// Also, build our regexes.
let rep_reg_str: string = '['; // Use let as it's modified
let unrep_reg_str: string = '['; // Use let as it's modified
const unreplaces: Record<string, string> = {};

for(const k in replaces) { // Use const for k in loop
    if (replaces.hasOwnProperty(k)) {
        rep_reg_str += k;
        unrep_reg_str += replaces[k];
        unreplaces[replaces[k]] = k;
    }
}
rep_reg_str += ']';
unrep_reg_str += ']';

// Build regexes
const rep_reg = new RegExp(rep_reg_str,"g");
const unrep_reg = new RegExp(unrep_reg_str,"g");

const decode = function(data: string): [string, string] {
	return [data.replace(rep_reg, function(m: string): string { return replaces[m]; }), ''];
};

const encode = function(data: string): string {
	return data.replace(unrep_reg, function(m: string): string { return unreplaces[m]; });
};

DecafMUD.plugins.Encoding.iso885915 = {
	proper : 'ISO-8859-15',
	decode: decode,
	encode: encode
};
