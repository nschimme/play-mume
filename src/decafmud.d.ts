/*  Play MUME!, a modern web client for MUME using DecafMUD.
    Copyright (C) 2017, Waba.

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

// Re-export types from the new TypeScript version of DecafMUD
// This assumes that the tsconfig.json paths will allow importing 'DecafMUD/src/ts/decafmud'
// or a similar path resolution. For now, using a relative path.
// Adjust the path as necessary based on tsconfig settings in the next steps.

export {
    DecafMUD,
    DecafMUDOptions,
    DecafMUDSettings,
    DecafMUDPlugin,
    DecafMUDTeloptHandler,
    DecafMUDInterface,
    DecafMUDSocket,
    DecafMUDStorage,
    DecafMUDDisplay,
    DecafMUDEncoding,
    DecafMUDTextInputFilter
} from '../DecafMUD/src/ts/decafmud'; // Adjusted relative path assuming src/ is base for this file

// Keep other global declarations from the original d.ts if they are still needed
// and not part of the DecafMUD class/module itself.

// MENU_* constants are now imported where needed (e.g., in mume.menu.ts)
// declare const MENU_HELP: number; // REMOVED
// declare const MI_SUBMENU: number; // REMOVED
// declare const MENU_OPTIONS: number; // REMOVED

// fkeys_enabled and numpad_enabled are declared in window-extensions.d.ts as globals
// as they are set on the window object by decafmud.interface.panels.settings.ts
// So, their declarations can be removed from here if window-extensions.d.ts is consistently used for globals.
// However, keeping them here doesn't hurt if some files might still expect these specific declares.
// For cleaner separation, ideally all window globals go to window-extensions.d.ts.
// Let's remove them from here assuming window-extensions.d.ts is the source of truth for window globals.
// declare function fkeys_enabled(): boolean; // REMOVED
// declare function numpad_enabled(): boolean; // REMOVED

// It's also possible that the DecafMUD class itself will be assigned to the global window object
// by the original JS plugins or by src/index.ts for compatibility.
// If so, a global declaration might still be needed for that specific pattern.
// For now, we are aiming for module-based imports.

// If other parts of DecafMUD (like DecafMUD.plugins, DecafMUD.TN) are accessed globally
// by JS plugins, we might need to declare a global DecafMUD type/namespace eventually,
// or ensure src/index.ts correctly sets this up on the window object.

// Example of how one might declare the global DecafMUD if it's still necessary:
/*
import { DecafMUD as DecafMUDClass } from '../../DecafMUD/src/ts/decafmud';
declare global {
  var DecafMUD: typeof DecafMUDClass;
}
*/
// However, the goal is to move away from globals if possible.
// The current `src/index.ts` uses `script-loader` which makes `DecafMUD` global.
// When we switch to importing the TS module, `DecafMUD` will be a module export,
// not automatically global. `src/index.ts` will need to handle making it available
// to any remaining JS plugins that expect it globally.
// For now, this d.ts primarily serves TS imports.
