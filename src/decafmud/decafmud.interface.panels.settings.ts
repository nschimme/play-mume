// SPDX-License-Identifier: GPL-3.0-or-later
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

import DecafMUD from './decafmud';
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

let fontpercentage: number = 100;
let fkeymacros: boolean = true;
let numpadwalking: boolean = true;

let showprogressbars: boolean = false;
let showmap: boolean = false;

export function set_fontsize(k: number): void {
  fontpercentage = k;
  if (DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
    DecafMUD.instances[0].ui.el_display.style.fontSize = (k * 110 / 100) + "%";
  }
}

export function get_fontsize(): number {
  return fontpercentage;
}

export function fkeys_enabled(): boolean {
  return fkeymacros;
}

export function toggle_fkeys(value: boolean): void {
  fkeymacros = value;
}

export function numpad_enabled(): boolean {
  return numpadwalking;
}

export function toggle_numpad(value: boolean): void {
  numpadwalking = value;
}

export function progress_visible(): boolean {
  return showprogressbars;
}

export function map_visible(): boolean {
  return showmap;
}

export function toggle_progressbars(value: boolean): void {
  showprogressbars = value;
  const ui = DecafMUD.instances[0]?.ui;
  if (!ui) return;

  if (value) {
    ui.showSidebar();
    ui.showProgressBars();
  } else {
    ui.hideProgressBars();
    if (!showmap) ui.hideSidebar();
  }
}

export function toggle_map(value: boolean): void {
  showmap = value;
  const ui = DecafMUD.instances[0]?.ui;
  if (!ui) return;

  if (value) ui.showMap();
  else ui.hideMap();

  if (!showmap && !showprogressbars) ui.hideSidebar();
  else ui.showSidebar();
}
