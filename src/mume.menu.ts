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

import $ from 'jquery';


declare function canvasFitParent(): void;

$(document).ready(function() {
    if (window.toolbar_menus && window.toolbar_menus[MENU_HELP]) {
        const helpSubmenu = window.toolbar_menus[MENU_HELP][MI_SUBMENU] as (string | undefined)[];
        if (Array.isArray(helpSubmenu)) {
            helpSubmenu.unshift(
                'New to MUME?', 'mume_menu_new();',
                'MUME Help',    'mume_menu_help();',
                'MUME Rules',   'mume_menu_rules();' );

            helpSubmenu.push(
                'About Map',     'mume_menu_about_map();',
                'Map(per) Bug?', 'mume_menu_map_bug();' );
        }
    }

    if (window.toolbar_menus && window.toolbar_menus[MENU_OPTIONS]) {
        const optionsSubmenu = window.toolbar_menus[MENU_OPTIONS][MI_SUBMENU] as (string | undefined)[];
        if (Array.isArray(optionsSubmenu)) {
            optionsSubmenu.unshift(
                'Detach Map', 'open_mume_map_window();' );
        }
    }
});

export function mume_menu_new(): void {
    window.open('https://docs.mume.org/resources/newcomers', 'mume_new_players');
}

export function mume_menu_help(): void {
    window.open('https://mume.org/help/', 'mume_help');
}

export function mume_menu_rules(): void {
    window.open('https://mume.org/rules/', 'mume_rules');
}

export function mume_menu_about_map(): void {
    alert(
        "Play MUME!, a modern web client for MUME using DecafMUD, is brought to you by Waba,\n" +
        "based on the idea and graphics of MMapper (by Alve, Caligor, and Jahara).\n" +
        "\n" +
        "Both are Free and Open Source (GPLv2+).\n" +
        "\n" +
        "Fork Play MUME! on Github: https://github.com/MUME/play-mume/\n" +
        "\n" +
        "The map data is covered by a separate license." );
}

export function mume_menu_map_bug(): void {
    window.open( 'https://github.com/MUME/play-mume/issues/new', 'mume_map_bug' );
}

export function open_mume_map_window(): void {
    const gMap = window.globalMap;
    const url: string = (gMap && gMap.pathMachine && gMap.pathMachine.here) ?
        "map.html#" + gMap.pathMachine.here.x + "," + gMap.pathMachine.here.y + "," + gMap.pathMachine.here.z :
        "map.html";

    window.globalMapWindow = window.open( url, "mume_map", "dialog,minimizable,width=820,height=620" );
    if ( window.globalMapWindow === null ) {
        alert( "Your browser refused to open the map window, you have to allow it "
            +"somewhere near the top right corner of your screen. Look for a "
            +"notification about blocking popups." );
        return;
    }

    if ( window.globalSplit ) {
        window.globalSplit.collapse( 1 );
        if (typeof canvasFitParent === 'function') {
            canvasFitParent();
        }
    }
}

// Bind to global window object
window.open_mume_map_window = open_mume_map_window;
window.mume_menu_new = mume_menu_new;
window.mume_menu_help = mume_menu_help;
window.mume_menu_rules = mume_menu_rules;
window.mume_menu_about_map = mume_menu_about_map;
window.mume_menu_map_bug = mume_menu_map_bug;
