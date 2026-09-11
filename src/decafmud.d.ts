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

// src/decafmud.d.ts

interface GMCPRoomInfoData {
  id?: number | string;
  name?: string;
  desc?: string;
  area?: string;
  environment?: string;
  exits?: Record<string, unknown>;
}

interface GMCPEventMovedData {
  dir?: string;
}

interface GMCPPlugin {
  _will?: (...args: unknown[]) => void;
  sendGMCP?: (pckg: string, data?: unknown) => void;
  getFunction?: (pckg: string) => ((data?: unknown) => void) | undefined;
  registerHandler?: (pckg: string, callback: (data: unknown) => void) => (() => void);
  unregisterHandler?: (pckg: string, callback: (data: unknown) => void) => void;
  packages: Record<string, Record<string, unknown>>;
}

interface DecafMUDInstance {
  textInputFilter?: unknown;
  gmcp?: GMCPPlugin;
  socket: DecafMUDSocket;
  sendInput: (command: string) => void;
}

interface DecafMUDOptions {
  host?: string;
  port?: number;
  autoreconnect?: boolean;
  autoconnect?: boolean;
  set_socket?: {
    wsport?: number;
    wspath?: string;
    ssl?: boolean;
  };
  interface?: string;
  set_interface?: {
    container?: string;
    connect_hint?: boolean;
    repeat_input?: boolean;
    start_full?: boolean;
  };
  language?: string;
  socket?: string;
}

interface DecafMUDStatic {
  new (options: DecafMUDOptions): DecafMUDInstance;
  plugins?: {
    TextInputFilter?: Record<string, unknown>;
  };
  instances?: DecafMUDInstance[];
  TN?: {
    NAWS: string;
    [key: string]: string;
  };
}

declare var DecafMUD: DecafMUDStatic;

declare interface DecafMUDSocket {
  connected?: boolean;
  write(data: string): void;
}

declare const MENU_FILE: number;
declare const MENU_LOG: number;
declare const MENU_OPTIONS: number;
declare const MENU_HELP: number;
declare const MI_SUBMENU: number;

type SubmenuList = (string | undefined)[];
type ToolbarMenuItem = [string, string, string, SubmenuList];

interface DecafMUDUI {
  container?: HTMLElement;
  el_display?: HTMLElement;
  display?: {
    display: HTMLElement;
    scroll: () => void;
    clear: () => void;
  };
  input?: {
    focus: () => void;
  };
  click_fsbutton?: () => void;
  maxPopupWidth?: () => number;
  maxPopupHeight?: () => number;
  verticalPopupOffset?: () => number;
  horizontalPopupOffset?: () => number;
  resizeScreen?: (showSize?: boolean, force?: boolean) => void;
}

interface DecafMUDInstance {
  textInputFilter?: unknown;
  gmcp?: GMCPPlugin;
  socket: DecafMUDSocket;
  ui?: DecafMUDUI;
  telopt?: Record<string, unknown>;
  connected?: boolean;
  connecting?: boolean;
  sendInput: (command: string) => void;
  reconnect: () => void;
  disconnect?: () => void;
  connect?: () => void;
  about: () => void;
}

declare function fkeys_enabled(): boolean;
declare function numpad_enabled(): boolean;
declare function get_fontsize(): number;
declare function set_fontsize(size: number): void;
declare function toggle_fkeys(enable: boolean): void;
declare function toggle_numpad(enable: boolean): void;

interface Window {
  globalMap?: {
    pathMachine?: {
      here?: {
        x: number;
        y: number;
        z: number;
      } | null;
    };
  } | null;
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
