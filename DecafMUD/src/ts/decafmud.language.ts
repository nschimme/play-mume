/*!
 * DecafMUD v0.9.0 Language Extension
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/*
import { DecafMUD } from "./decafmud"; // DecafMUD type is needed for decafInstance

// Global augmentations for String prototype
declare global {
    interface String {
        tr(decafInstance: DecafMUD, ...formatArgs: any[]): string;
    }
    interface StringConstructor {
        logNonTranslated?: boolean;
    }
}
*/

// String.prototype.tr definition
/*
String.prototype.tr = function(this: string, decafInstance: DecafMUD, ...formatArgs: any[]): string {
    let s = this.toString(); // The string to be translated

    // Use the provided decafInstance for language settings
    const lang = decafInstance?.options.language;
    if (lang && lang !== 'en') {
        const langPack = DecafMUD.plugins.Language[lang];
        if (langPack && langPack[s]) {
            s = langPack[s]; // Translated string
        } else {
            if (String.logNonTranslated && typeof console !== 'undefined' && console.warn) {
                 const langName = langPack && langPack['English'] ? langPack['English'] : `"${lang}"`;
                 console.warn(`DecafMUD[${decafInstance?.id || '?'}] i18n: No ${langName} translation for: ${s.replace(/\n/g, '\\n')}`);
            }
        }
    }

    // Replacement logic using formatArgs
    if (formatArgs.length === 1 &&
        typeof formatArgs[0] === 'object' &&
        formatArgs[0] !== null &&
        !Array.isArray(formatArgs[0])) {
        const replacements = formatArgs[0] as Record<string, any>;
        for (const key in replacements) {
            if (Object.prototype.hasOwnProperty.call(replacements, key)) {
                const value = replacements[key];
                s = s.replace(new RegExp('{' + key + '}', 'g'), typeof value !== 'undefined' ? String(value) : '');
            }
        }
    } else { // Numbered arguments from formatArgs array
        s = s.replace(/{(\d+)}/g, (matchString, p1) => {
            const placeholderIndex = parseInt(p1, 10);
            if (placeholderIndex >= 0 && placeholderIndex < formatArgs.length) {
                const value = formatArgs[placeholderIndex];
                return typeof value !== 'undefined' ? String(value) : ''; // Replace undefined with empty string
            }
            return matchString; // Keep placeholder if index out of bounds
        });
    }
    return s;
};
*/
// String.logNonTranslated = (typeof window !== 'undefined' && 'console' in window); // Also commented out

// This file primarily modifies String.prototype and String global.
// It might need to be imported once in a central place (like decafmud.ts or index.ts)
// for the prototype augmentation to take effect.
// No explicit export needed for prototype changes, but exporting something ensures it's treated as a module.
export const i18nRegistered = true;
