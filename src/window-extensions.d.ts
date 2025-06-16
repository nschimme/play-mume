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

// src/window-extensions.d.ts
import { JQueryStatic } from 'jquery'; // Add this import at the top of the file if not already there for other reasons

// Assuming DecafMUDStatic is globally available via src/decafmud.d.ts
// If not, we might need to import it or ensure its global scope.
// For now, let's assume DecafMUDStatic is a known global type.

declare global {
  interface MenuItemArray extends Array<string> {
    // Define unshift and push specifically if needed, but Array<string> usually covers it.
    // Unshift and push are standard array methods.
  }

  interface ToolbarSubmenu {
    [miSubmenu: string]: MenuItemArray;
  }

  interface ToolbarMenus {
    [menuHelpOrOptions: string]: ToolbarSubmenu;
  }

  interface Window {
    toolbar_menus: ToolbarMenus;
    Zlib?: {
      InflateStream?: any; // Changed from Inflate to InflateStream
    };
    jQuery?: JQueryStatic;
  }

  interface OpenerWindow extends Window {
    DecafMUD?: DecafMUDStatic; // Optional because it might not be loaded yet or exist
    $?: JQueryStatic;          // Optional jQuery static
    // Add any other properties that scripts in map-loader.ts expect on window.opener
  }
}

// Export an empty object to make this file a module if necessary,
// though for global augmentations, it's often not strictly needed.
export {};
