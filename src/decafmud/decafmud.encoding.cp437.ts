// SPDX-License-Identifier: MIT

/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

 /**
 * @fileOverview DecafMUD Character Encoding: Code Page 437 (IBM PC)
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

(function(DecafMUD) {

// This first list contains the characters 0x00 to 0x1F, with onl a couple
// of exclusions for things like new lines.
var lows = ["\u2007","\u263A","\u263B","\u2665","\u2666","\u2663","\u2660", //  0 -  6
			"\x07","\x08","\x09","\x0A","\x0B","\x0C","\x0D",				//  7 - 13
			"\u266B","\u263C","\u25BA","\u25C4","\u2195","\u203C","\u00B6", // 14 - 20
			"\u00A7","\u25AC","\u21A8","\u2191","\u2193","\u2192","\x1B",	// 21 - 27
			"\u221F","\u2194","\u25B2","\u25BC"], // 28 - 31

// This is a list of cp437 characters in unicode, for the binary characters
// 0x80 to 0xFF, with index 0 coresponding to 0x80.
	chars =["\u00c7","\u00fc","\u00e9","\u00e2","\u00e4","\u00e0","\u00e5",
			"\u00e7","\u00ea","\u00eb","\u00e8","\u00ef","\u00ee","\u00ec",
			"\u00c4","\u00c5","\u00c9","\u00e6","\u00c6","\u00f4","\u00f6",
			"\u00f2","\u00fb","\u00f9","\u00ff","\u00d6","\u00dc","\u00a2",
			"\u00a3","\u00a5","\u20a7","\u0192","\u00e1","\u00ed","\u00f3",
			"\u00fa","\u00f1","\u00d1","\u00aa","\u00ba","\u00bf","\u2310",
			"\u00ac","\u00bd","\u00bc","\u00a1","\u00ab","\u00bb","\u2591",
			"\u2592","\u2593","\u2502","\u2524","\u2561","\u2562","\u2556",
			"\u2555","\u2563","\u2551","\u2557","\u255d","\u255c","\u255b",
			"\u2510","\u2514","\u2534","\u252c","\u251c","\u2500","\u253c",
			"\u255e","\u255f","\u255a","\u2554","\u2569","\u2566","\u2560",
			"\u2550","\u256c","\u2567","\u2568","\u2564","\u2565","\u2559",
			"\u2558","\u2552","\u2553","\u256b","\u256a","\u2518","\u250c",
			"\u2588","\u2584","\u258c","\u2590","\u2580","\u03b1","\u00df",
			"\u0393","\u03c0","\u03a3","\u03c3","\u00b5","\u03c4","\u03a6",
			"\u0398","\u03a9","\u03b4","\u221e","\u03c6","\u03b5","\u2229",
			"\u2261","\u00b1","\u2265","\u2264","\u2320","\u2321","\u00f7",
			"\u2248","\u00b0","\u2219","\u00b7","\u221a","\u207f","\u00b2",
			"\u25a0","\u00a0"],

	decode = function(data: Uint8Array): [string, Uint8Array] {
		const outputChars: string[] = [];
		for (let i = 0; i < data.length; i++) {
			const byte = data[i];
			if (byte < 0x20) {
				if (byte < lows.length && lows[byte] !== undefined) { // Ensure lows[byte] exists
					outputChars.push(lows[byte]);
				} else {
					outputChars.push(String.fromCharCode(byte)); // Default char if not in lows
				}
			} else if (byte >= 0x80) {
				const index = byte - 0x80;
				if (index < chars.length && chars[index] !== undefined) { // Ensure chars[index] exists
					outputChars.push(chars[index]);
				} else {
					outputChars.push(String.fromCharCode(0x3F)); // CP437 question mark for unmappable extended chars
				}
			} else { // Standard ASCII 0x20 - 0x7F
				outputChars.push(String.fromCharCode(byte));
			}
		}
		return [outputChars.join(''), new Uint8Array()];
	},

	encode = function(data: string): Uint8Array {
		const outputBytes: number[] = [];
		for (let i = 0; i < data.length; i++) {
			const char = data[i];
			let index = chars.indexOf(char);
			if (index !== -1) {
				outputBytes.push(0x80 + index);
			} else {
				index = lows.indexOf(char);
				if (index !== -1) {
					outputBytes.push(index);
				} else {
					const charCode = char.charCodeAt(0);
					if (charCode < 0x80) { // Standard ASCII
						outputBytes.push(charCode);
					} else { // Unicode char not in CP437
						outputBytes.push(0x3F); // CP437 question mark '?'
					}
				}
			}
		}
		return new Uint8Array(outputBytes);
	};

// Expose to Decaf
/** This provides support for the <a href="http://en.wikipedia.org/wiki/Code_page_437">CP437</a>
 *  character encoding to DecafMUD by translating the characters into their
 *  unicode equivilents.
 * @example
 * // Assuming DecafMUD.plugins.Encoding.cp437.decode is called with Uint8Array
 * @namespace DecafMUD Character Encoding: Code Page 437 (IBM PC) */
DecafMUD.plugins.Encoding.cp437 = {
	proper : 'CP437',

    /** Replace CP437-encoded bytes with their unicode equivilents.
     * @example
     * // decaf.decode(new Uint8Array([0xB2])); // Assuming this is how it's used
     * // Becomes: "\u2593"
     * @function
     * @param {Uint8Array} data The bytes to decode. */
	decode: decode,

    /** Replace the unicode equivilents of CP437 characters with the
     *  CP437-encoded bytes.
     * @example
     * // decaf.encode("\u2593"); // Assuming this is how it's used
     * // Becomes: Uint8Array([0xB2])
     * @function
     * @param {String} data The text to encode. */
	encode: encode
};

})(window.DecafMUD);