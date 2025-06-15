// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 *
 * This is decafmud.interface.discworld.js from Discworld, but it is generic
 * and can be included in the upstream.
 */

/**
 * This file has functionality to change DecafMud settings.
 */

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUD } from './decafmud'; // Hypothetical
// import type { PanelsInterface } from './decafmud.interface.panels'; // For ui type
declare var DecafMUD: any; // Placeholder for DecafMUD static and instance types

let fontpercentage: number = 100;
let fkeymacros: boolean = true;
let numpadwalking: boolean = true;

let showprogressbars: boolean = false;
let showmap: boolean = false;

function set_fontsize(k: number): void {
  fontpercentage = k;
  // Assuming DecafMUD.instances[0].ui.el_display is an HTMLElement
  const ui = DecafMUD.instances[0]?.ui;
  if (ui && ui.el_display) {
    (ui.el_display as HTMLElement).style.fontSize = (k * 110 / 100) + "%";
  }
}

function get_fontsize(): number {
  return fontpercentage;
}

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

function progress_visible(): boolean {
  return showprogressbars;
}

function map_visible(): boolean {
  return showmap;
}

function toggle_progressbars(value: boolean): void {
  showprogressbars = value;
  const ui = DecafMUD.instances[0]?.ui;
  if (ui) {
    if (value) {
      ui.showSidebar();
      ui.showProgressBars();
    } else {
      ui.hideProgressBars();
      if (!showmap) ui.hideSidebar();
    }
  }
}

function toggle_map(value: boolean): void {
  showmap = value;
  const ui = DecafMUD.instances[0]?.ui;
  if (ui) {
    if (value) ui.showMap();
    else ui.hideMap();

    if (!showmap && !showprogressbars) ui.hideSidebar();
    else ui.showSidebar();
  }
}

// Expose functions to be callable from other files, e.g., menu actions
// This might be better handled with exports if this becomes a module
(window as any).get_fontsize = get_fontsize;
(window as any).set_fontsize = set_fontsize;
(window as any).fkeys_enabled = fkeys_enabled;
(window as any).toggle_fkeys = toggle_fkeys;
(window as any).numpad_enabled = numpad_enabled;
(window as any).toggle_numpad = toggle_numpad;
(window as any).progress_visible = progress_visible;
(window as any).map_visible = map_visible;
(window as any).toggle_progressbars = toggle_progressbars;
(window as any).toggle_map = toggle_map;
