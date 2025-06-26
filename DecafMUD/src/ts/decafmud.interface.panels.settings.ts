/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules.
 */

import { DecafMUD } from "decafmud";
import { PanelsInterface } from "./decafmud.interface.panels";

// Global settings variables
let fontpercentage: number = 100;
let fkeymacros: boolean = true;
let numpadwalking: boolean = true;
let showprogressbars: boolean = false;
let showmap: boolean = false;

// --- Font Settings ---
function set_fontsize(k: number): void {
  fontpercentage = k;
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface | undefined;
  if (ui?.el_display) {
    // The original (k*110/100) seems like an arbitrary scaling factor.
    // Let's assume k is the desired percentage directly.
    // If 100 is normal, then k should be applied as k + "%".
    // If k=100 means 110% in original, then it's k * 1.1
    ui.el_display.style.fontSize = (k * 110 / 100) + "%"; // Kept original scaling
  }
}

function get_fontsize(): number {
  return fontpercentage;
}

// --- Macro Settings ---
function fkeys_enabled(): boolean {
  return fkeymacros;
}

function toggle_fkeys(value: boolean): void {
  fkeymacros = value;
}

function numpad_enabled(): boolean {
  return numpadwalking;
}

function toggle_numpad(value: boolean): void {
  numpadwalking = value;
}

// --- Sidebar Element Visibility ---
function progress_visible(): boolean {
  return showprogressbars;
}

function map_visible(): boolean {
  return showmap;
}

function toggle_progressbars(value: boolean): void {
  showprogressbars = value;
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface | undefined;
  if (!ui) return;

  if (value) {
    ui.showSidebar?.();
    ui.showProgressBars?.();
  } else {
    ui.hideProgressBars?.();
    if (!showmap) { // Only hide sidebar if map is also hidden
      ui.hideSidebar?.();
    }
  }
}

function toggle_map(value: boolean): void {
  showmap = value;
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface | undefined;
  if (!ui) return;

  if (value) {
    ui.showMap?.();
  } else {
    ui.hideMap?.();
  }

  // Adjust sidebar visibility based on both map and progress bars
  if (!showmap && !showprogressbars) {
    ui.hideSidebar?.();
  } else {
    ui.showSidebar?.(); // Show if either is visible
  }
}

// Expose functions to the global scope for access by menu items / other JS
const globalAccessor = (window as any);
globalAccessor.set_fontsize = set_fontsize;
globalAccessor.get_fontsize = get_fontsize;
globalAccessor.fkeys_enabled = fkeys_enabled;
globalAccessor.toggle_fkeys = toggle_fkeys;
globalAccessor.numpad_enabled = numpad_enabled;
globalAccessor.toggle_numpad = toggle_numpad;
globalAccessor.progress_visible = progress_visible;
globalAccessor.map_visible = map_visible;
globalAccessor.toggle_progressbars = toggle_progressbars;
globalAccessor.toggle_map = toggle_map;

// Also expose the variables if they are directly accessed globally (though this is less common)
// It's better if they are only accessed via their getter/setter functions.
// For fkeymacros and numpadwalking, they were directly used in panels.menu.js, so expose them.
Object.defineProperty(globalAccessor, 'fkeymacros', {
  get: () => fkeymacros,
  set: (val: boolean) => fkeymacros = val // Allow external setting if needed, though toggle_fkeys is preferred
});
Object.defineProperty(globalAccessor, 'numpadwalking', {
  get: () => numpadwalking,
  set: (val: boolean) => numpadwalking = val
});
// showmap was also used in panels.menu.js (commented out logic)
Object.defineProperty(globalAccessor, 'showmap', {
  get: () => showmap,
  set: (val: boolean) => showmap = val
});


// Ensure this module is treated as such
export {};
