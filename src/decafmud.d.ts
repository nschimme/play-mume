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

// Define the structure of the DecafMUD instance
interface DecafMUDInstance {
  textInputFilter?: any; // Property accessed in src/index.ts
  socket: DecafMUDSocket; // Added this line
  // Add other known properties/methods of an instance if available
  // For example, from the original inline script:
  // host: string;
  // port: number;
  // socket: DecafMUDSocket; // Already partially defined
}

// Define the structure of the DecafMUD constructor/static object
interface DecafMUDStatic {
  new (options: any): DecafMUDInstance; // Constructor
  plugins?: {
    TextInputFilter?: any; // Property accessed in src/index.ts
  };
  instances?: DecafMUDInstance[]; // Property accessed in src/index.ts
}

// Declare DecafMUD as a global variable
declare var DecafMUD: DecafMUDStatic;

// Keep DecafMUDSocket or expand it
declare interface DecafMUDSocket {
  write(data: string): void;
  // Add other known properties/methods
}

declare const MENU_HELP: string;
declare const MI_SUBMENU: string;
declare const MENU_OPTIONS: string;

declare function fkeys_enabled(): boolean;
declare function numpad_enabled(): boolean;
