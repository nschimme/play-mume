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
}

declare var DecafMUD: DecafMUDStatic;

declare interface DecafMUDSocket {
  write(data: string): void;
}

declare const MENU_HELP: number;
declare const MI_SUBMENU: number;
declare const MENU_OPTIONS: number;

declare function fkeys_enabled(): boolean;
declare function numpad_enabled(): boolean;
