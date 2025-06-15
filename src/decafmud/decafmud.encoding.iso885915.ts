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

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUDGlobal } from './decafmud'; // Hypothetical import for DecafMUD type
// For now, we'll assume DecafMUD is a global object with a plugins property.

(function(DecafMUD: any) { // Use 'any' if DecafMUD type is not directly available/imported

// ISO-8859-1 --> ISO-8859-15
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

// Reverse the array for ISO-8859-15 --> ISO-8859-1
// Also, build our regexes.
let rep_reg_str: string = '[';
let unrep_reg_str: string = '[';
const unreplaces: { [key: string]: string } = {};

for (const k in replaces) {
	if (replaces.hasOwnProperty(k)) {
		rep_reg_str += k;
		unrep_reg_str += replaces[k];
		unreplaces[replaces[k]] = k;
	}
}

// Build regexes
const rep_reg: RegExp = new RegExp(rep_reg_str + ']', "g");
const unrep_reg: RegExp = new RegExp(unrep_reg_str + ']', "g");

const decode = function(data: string): [string, string] {
	return [data.replace(rep_reg, function(m: string): string { return replaces[m]; }), ''];
};

const encode = function(data: string): string {
	return data.replace(unrep_reg, function(m: string): string { return unreplaces[m]; });
};

// Expose to DecafMUD.
/** This provides support for the <a href="http://en.wikipedia.org/wiki/ISO/IEC_8859-15">ISO-8859-15</a>
 *  character encoding to DecafMUD by translating the different characters into
 *  their unicode equivilents.
 * @example
 * alert(DecafMUD.plugins.Encoding.iso885915.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: ISO-8859-15 */
DecafMUD.plugins.Encoding.iso885915 = {
	proper : 'ISO-8859-15',

	/** Replace ISO-8859-15 encoded characters with their unicode equivilents.
	 * @example
	 * DecafMUD.plugins.Encoding.iso885915.decode("\xA4");
	 * // Becomes: "\u20AC"
	 * @function
	 * @param {String} data The text to decode. */
	decode: decode,

	/** Replace the unicode equivilents of ISO-8859-15 characters with their
	 *  ISO-8859-15 values.
	 * @example
	 * DecafMUD.plugins.Encoding.iso885915.encode("\u20AC")
	 * // Becomes: "\xA4"
	 * @function
	 * @param {String} data The text to encode. */
	encode: encode
};

})(DecafMUD);
