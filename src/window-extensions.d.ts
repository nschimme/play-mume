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

// More specific types for toolbar_menus
type SubMenuItem = string; // e.g., "Reconnect" or "menu_reconnect();"
type SubMenuArray = SubMenuItem[]; // Represents the array like ['Item1', 'action1();', 'Item2', 'action2();']
type ToolbarMenuItemTuple = [string, string, string, SubMenuArray]; // [name, id, tooltip, submenuArray]
type ToolbarMenusArray = ToolbarMenuItemTuple[];


declare global {
  interface Window {
    toolbar_menus: ToolbarMenusArray; // Updated type
    // Zlib is no longer global, pako is used as a module.
    // DecafMUD?: DecafMUDStatic; // Old declaration
    DecafMUD?: typeof import('../../DecafMUD/src/ts/decafmud').DecafMUD; // New: type of the DecafMUD class itself

    // Functions made global by decafmud.interface.panels.menu.ts
    get_menus?: () => any[];
    close_menus?: () => void;
    toggle_menu?: (index: number) => void;
    show_popup_menu?: () => HTMLElement;
    close_popup_menu?: () => void;
    add_element_menu?: (inside: HTMLElement, kind: string, innerhtml: string) => HTMLElement;
    button_line_menu?: (par: HTMLElement) => HTMLElement;
    add_close_button_menu?: (parentob: HTMLElement) => void;
    popup_header_menu?: (text: string) => void;
    popup_textarea_menu?: (name: string, adjust: number) => HTMLTextAreaElement;
    popup_textdiv_menu?: () => HTMLDivElement;
    menu_reconnect?: () => void;
    menu_log?: (style: 'html' | 'plain') => void;
    menu_font_size?: () => void;
    change_font?: () => void; // Called by menu_font_size popup
    menu_macros?: () => void;
    change_macros?: () => void; // Called by menu_macros popup
    menu_history_flush?: () => void;
    menu_features?: () => void;
    menu_about?: () => void;
    menu_trouble?: () => void;

    // Functions/variables made global by decafmud.interface.panels.settings.ts
    set_fontsize?: (k: number) => void;
    get_fontsize?: () => number;
    fkeys_enabled?: () => boolean;
    toggle_fkeys?: (value: boolean) => void;
    numpad_enabled?: () => boolean;
    toggle_numpad?: (value: boolean) => void;
    progress_visible?: () => boolean;
    map_visible?: () => boolean;
    toggle_progressbars?: (value: boolean) => void;
    toggle_map?: (value: boolean) => void;
    fkeymacros?: boolean; // Exposed via Object.defineProperty
    numpadwalking?: boolean; // Exposed via Object.defineProperty
    showmap?: boolean; // Exposed via Object.defineProperty


    // Functions made global by src/mume.menu.ts
    open_mume_map_window?: () => void;
    mume_menu_new?: () => void;
    mume_menu_help?: () => void;
    mume_menu_rules?: () => void;
    mume_menu_about_map?: () => void;
    mume_menu_map_bug?: () => void;
  }

}

export {};
