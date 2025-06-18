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

(function(DecafMUD) {

// ISO-8859-1 --> ISO-8859-15
var replaces = {
	'\xA4': '\u20AC',
	'\xA6': '\u0160',
	'\xA8': '\u0161',
	'\xB4': '\u017D',
	'\xB8': '\u017E',
	'\xBC': '\u0152',
	'\xBD': '\u0153',
	'\xBE': '\u0178'
}

// Reverse the array for ISO-8859-15 --> ISO-8859-1
var unreplaces: {[key: string]: string} = {};
for(var k in replaces) {
	unreplaces[replaces[k as keyof typeof replaces]] = k;
}

// Regexes rep_reg and unrep_reg removed as per instructions.

var decode = function(data: Uint8Array): [string, Uint8Array] {
		const outputChars: string[] = [];
		for (let i = 0; i < data.length; i++) {
			const byte = data[i];
			const charFromByte = String.fromCharCode(byte);
			if (replaces[charFromByte as keyof typeof replaces]) {
				outputChars.push(replaces[charFromByte as keyof typeof replaces]);
			} else {
				outputChars.push(charFromByte);
			}
		}
		const decodedString = outputChars.join('');
		return [decodedString, new Uint8Array()];
	},

	encode = function(data: string): Uint8Array {
		const outputBytes: number[] = [];
		for (let i = 0; i < data.length; i++) {
			const char = data[i];
			if (unreplaces[char]) {
				outputBytes.push(unreplaces[char].charCodeAt(0));
			} else {
				const charCode = char.charCodeAt(0);
				if (charCode < 0x100) { // Fits in a single byte (Latin-1 range)
					outputBytes.push(charCode);
				} else { // Unicode character not representable in ISO-8859-15
					outputBytes.push(0x3F); // Question mark
				}
			}
		}
		return new Uint8Array(outputBytes);
	};

// Expose to DecafMUD.
/** This provides support for the <a href="http://en.wikipedia.org/wiki/ISO/IEC_8859-15">ISO-8859-15</a>
 *  character encoding to DecafMUD by translating the different characters into
 *  their unicode equivilents.
 * @example
 * // decaf.decode(new Uint8Array([0xA4])); // Assuming this is how it's used
 * @namespace DecafMUD Character Encoding: ISO-8859-15 */
DecafMUD.plugins.Encoding.iso885915 = {
	proper : 'ISO-8859-15',

    /** Replace ISO-8859-15 encoded bytes with their unicode equivilents.
     * @example
     * // decaf.decode(new Uint8Array([0xA4]));
     * // Becomes: "\u20AC"
     * @function
     * @param {Uint8Array} data The bytes to decode. */
	decode: decode,

    /** Replace the unicode equivilents of ISO-8859-15 characters with their
     *  ISO-8859-15 byte values.
     * @example
     * // decaf.encode("\u20AC")
     * // Becomes: Uint8Array([0xA4])
     * @function
     * @param {String} data The text to encode. */
	encode: encode
};

})(window.DecafMUD);