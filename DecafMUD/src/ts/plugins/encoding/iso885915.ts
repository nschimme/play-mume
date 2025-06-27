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

// ISO-8859-1 -> ISO-8859-15 character differences
const replaces: { [key: string]: string } = {
    '\xA4': '\u20AC', // CURRENCY SIGN -> EURO SIGN
    '\xA6': '\u0160', // BROKEN BAR -> LATIN CAPITAL LETTER S WITH CARON
    '\xA8': '\u0161', // DIAERESIS -> LATIN SMALL LETTER S WITH CARON
    '\xB4': '\u017D', // ACUTE ACCENT -> LATIN CAPITAL LETTER Z WITH CARON
    '\xB8': '\u017E', // CEDILLA -> LATIN SMALL LETTER Z WITH CARON
    '\xBC': '\u0152', // VULGAR FRACTION ONE QUARTER -> LATIN CAPITAL LIGATURE OE
    '\xBD': '\u0153', // VULGAR FRACTION ONE HALF -> LATIN SMALL LIGATURE OE
    '\xBE': '\u0178'  // VULGAR FRACTION THREE QUARTERS -> LATIN CAPITAL LETTER Y WITH DIAERESIS
};

// Reverse the mapping for ISO-8859-15 -> ISO-8859-1 (or rather, Unicode -> original byte)
const unreplaces: { [key: string]: string } = {};
let repRegexPattern = '';
let unrepRegexPattern = '';

for (const k in replaces) {
    if (Object.prototype.hasOwnProperty.call(replaces, k)) {
        repRegexPattern += k;
        unrepRegexPattern += replaces[k];
        unreplaces[replaces[k]] = k;
    }
}

// Build regexes
// Need to escape special characters if any were in `k` or `replaces[k]` for broader safety,
// though for this specific set, it's not strictly necessary.
const repReg = new RegExp(`[${repRegexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, "g");
const unrepReg = new RegExp(`[${unrepRegexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, "g");


const decode = function(data: string): [string, string] {
    return [data.replace(repReg, (m: string): string => {
        return replaces[m] || m; // Fallback to original if somehow not in replaces
    }), ''];
};

const encode = function(data: string): string {
    return data.replace(unrepReg, (m: string): string => {
        return unreplaces[m] || m; // Fallback to original if not in unreplaces
    });
};

/** This provides support for the <a href="http://en.wikipedia.org/wiki/ISO/IEC_8859-15">ISO-8859-15</a>
 *  character encoding to DecafMUD by translating the different characters into
 *  their unicode equivilents.
 * @example
 * iso885915Encoding.decode("\xA4"); // Becomes: "\u20AC"
 * @namespace DecafMUD Character Encoding: ISO-8859-15 */
export const iso885915Encoding = {
    proper: 'ISO-8859-15',

    /** Replace ISO-8859-15 encoded characters (those different from ISO-8859-1) with their unicode equivilents.
     * @example
     * iso885915Encoding.decode("\xA4"); // Becomes: "\u20AC"
     * @param {String} data The text to decode.
     * @returns {[string, string]} The decoded string and any remaining unparsed data (empty string in this case).
     */
    decode: decode,

    /** Replace the unicode equivilents of ISO-8859-15 characters with their
     *  single-byte ISO-8859-15 values.
     * @example
     * iso885915Encoding.encode("\u20AC"); // Becomes: "\xA4"
     * @param {String} data The text to encode.
     * @returns {string} The encoded string.
     */
    encode: encode
};

// Default export for easy registration
export default iso885915Encoding;
