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

import {
  DecafMUD as DecafMUDClass,
  GMCPRoomInfoData as GMCPRoomInfoDataType,
  GMCPEventMovedData as GMCPEventMovedDataType,
  GMCPPlugin as GMCPPluginType,
  DecafMUDSocket as DecafMUDSocketType,
  DecafMUDOptions as DecafMUDOptionsType,
  DecafMUDInterface as DecafMUDInterfaceType,
  ToolbarMenuItem as ToolbarMenuItemType,
} from '../DecafMUD/src';

declare global {
  var DecafMUD: typeof DecafMUDClass;

  var MENU_FILE: number;
  var MENU_LOG: number;
  var MENU_OPTIONS: number;
  var MENU_HELP: number;
  var MI_SUBMENU: number;

  type GMCPRoomInfoData = GMCPRoomInfoDataType;
  type GMCPEventMovedData = GMCPEventMovedDataType;
  type GMCPPlugin = GMCPPluginType;
  type DecafMUDSocket = DecafMUDSocketType;
  type DecafMUDOptions = DecafMUDOptionsType;
  type DecafMUDInterface = DecafMUDInterfaceType;
  type ToolbarMenuItem = ToolbarMenuItemType;
  type DecafMUDInstance = DecafMUDClass;

  function fkeys_enabled(): boolean;
  function numpad_enabled(): boolean;
  function get_fontsize(): number;
  function set_fontsize(size: number): void;
  function toggle_fkeys(enable: boolean): void;
  function toggle_numpad(enable: boolean): void;

  interface Window {
    globalMap?: {
      display?: {
        setCenterOffsetPercent: (percent: number) => void;
      };
      pathMachine?: {
        here?: {
          x: number;
          y: number;
          z: number;
        } | null;
      };
    } | null;
    globalMapWindow?: Window | null;
    globalSplit?: {
      collapse: (index: number) => void;
    } | null;
    toolbar_menus: ToolbarMenuItem[];
    open_mume_map_window?: () => void;
    mume_menu_new?: () => void;
    mume_menu_help?: () => void;
    mume_menu_rules?: () => void;
    mume_menu_about_map?: () => void;
    mume_menu_map_bug?: () => void;
    menu_reconnect?: () => void;
    menu_log?: (style: string) => void;
    menu_font_size?: () => void;
    menu_macros?: () => void;
    menu_history_flush?: () => void;
    menu_features?: () => void;
    menu_about?: () => void;
  }
}

export type {
  GMCPRoomInfoDataType as GMCPRoomInfoData,
  GMCPEventMovedDataType as GMCPEventMovedData,
  GMCPPluginType as GMCPPlugin,
  DecafMUDSocketType as DecafMUDSocket,
  DecafMUDOptionsType as DecafMUDOptions,
  DecafMUDInterfaceType as DecafMUDInterface,
  ToolbarMenuItemType as ToolbarMenuItem,
};
