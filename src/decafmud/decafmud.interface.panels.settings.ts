// SPDX-License-Identifier: MIT
import { DecafMUD } from './decafmud';
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

export let fontpercentage = 100;
export let fkeymacros = true;
export let numpadwalking = true;

export let showprogressbars = false;
export let showmap = false;

export function set_fontsize(k: number) {
  fontpercentage = k;
  DecafMUD.instances[0].ui.el_display.style.fontSize = (k*110/100) + "%";
}

export function get_fontsize(): number {
  return fontpercentage;
}

export function fkeys_enabled(): boolean {
  return fkeymacros;
}

export function toggle_fkeys(value: boolean) {
  fkeymacros = value;
}

export function numpad_enabled(): boolean {
  return numpadwalking;
}

export function toggle_numpad(value: boolean) {
  numpadwalking = value;
}

export function progress_visible(): boolean {
  return showprogressbars;
}

export function map_visible(): boolean {
  return showmap;
}

export function toggle_progressbars(value: boolean) {
  showprogressbars = value;
  if (value) {
    DecafMUD.instances[0].ui.showSidebar();
    DecafMUD.instances[0].ui.showProgressBars();
  }
  else {
    DecafMUD.instances[0].ui.hideProgressBars();
    if (!showmap) DecafMUD.instances[0].ui.hideSidebar();
  }
}

export function toggle_map(value: boolean) {
  showmap = value;
  if (value) DecafMUD.instances[0].ui.showMap();
  else DecafMUD.instances[0].ui.hideMap();
  if (!showmap && !showprogressbars) DecafMUD.instances[0].ui.hideSidebar();
  else DecafMUD.instances[0].ui.showSidebar();
}
