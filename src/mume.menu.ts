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

interface GlobalMapHere {
    x: number;
    y: number;
    z: number;
}

interface GlobalMapPathMachine {
    here: GlobalMapHere | null | undefined;
}

interface GlobalMap {
    pathMachine: GlobalMapPathMachine;
}
declare let globalMap: GlobalMap | null | undefined;

interface GlobalSplit {
    collapse(index: number): void;
}
declare let globalSplit: GlobalSplit | null | undefined;
declare function canvasFitParent(): void;
declare let globalMapWindow: Window | null;

import { toolbarMenus, MENU_HELP, MENU_OPTIONS, MenuItemAction } from '@decafmud/plugins/interface/menuData';

$(document).ready(function() {
    // Modify the imported toolbarMenus directly
    if (toolbarMenus && toolbarMenus[MENU_HELP]) {
        const helpMenuItems: MenuItemAction[] = [
            { name: 'New to MUME?', action: 'mume_menu_new();', id: 'mume_menu_new_to_mume'},
            { name: 'MUME Help',    action: 'mume_menu_help();', id: 'mume_menu_mume_help' },
            { name: 'MUME Rules',   action: 'mume_menu_rules();', id: 'mume_menu_mume_rules' }
        ];
        toolbarMenus[MENU_HELP].items.unshift(...helpMenuItems);

        toolbarMenus[MENU_HELP].items.push(
            { name: 'About Map',     action: 'mume_menu_about_map();', id: 'mume_menu_map_about' },
            { name: 'Map(per) Bug?', action: 'mume_menu_map_bug();', id: 'mume_menu_map_bug_report' });
    } else {
        console.error("DecafMUD toolbarMenus or MENU_HELP not found/initialized correctly. MUME menu extensions failed.");
    }

    if (toolbarMenus && toolbarMenus[MENU_OPTIONS]) {
        toolbarMenus[MENU_OPTIONS].items.unshift(
            { name: 'Detach Map', action: 'open_mume_map_window();', id: 'mume_menu_detach_map' });
    } else {
        console.error("DecafMUD toolbarMenus or MENU_OPTIONS not found/initialized correctly. MUME menu extensions failed.");
    }
});

// These functions will be called by string actions, so they need to be global.
// Assign them to window and ensure they are declared in window-extensions.d.ts
function mume_menu_new(): void
{
    window.open('http://mume.org/newcomers.php', 'mume_new_players');
}

function mume_menu_help(): void
{
    window.open('http://mume.org/help.php', 'mume_help');
}

function mume_menu_rules(): void
{
    window.open('http://mume.org/rules.php', 'mume_rules');
}

function mume_menu_about_map(): void
{
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

function mume_menu_map_bug(): void
{
    window.open( 'https://github.com/MUME/play-mume/issues/new', 'mume_map_bug' );
}

function open_mume_map_window(): void
{
    // let where: string | undefined; // Removed as it became unused after url refactoring
    const url: string = (globalMap && globalMap.pathMachine && globalMap.pathMachine.here) ?
        "map.html#" + globalMap.pathMachine.here.x + "," + globalMap.pathMachine.here.y + "," + globalMap.pathMachine.here.z :
        "map.html";
    // if ( globalMap && globalMap.pathMachine && globalMap.pathMachine.here ) // This check is now part of the ternary for url
        // where = globalMap.pathMachine.here.x + "," + // where is actually not used further after this change
            // globalMap.pathMachine.here.y + "," +
            // globalMap.pathMachine.here.z; // This if block also removed as 'where' is removed

    // url is now defined with const above using a ternary operator
    globalMapWindow = window.open( url, "mume_map", "dialog,minimizable,width=820,height=620" );
    if ( globalMapWindow === null )
    {
        alert( "Your browser refused to open the map window, you have to allow it "
            +"somewhere near the top right corner of your screen. Look for a "
            +"notification about blocking popups." );
        return;
    }

    if ( globalSplit )
    {
        globalSplit.collapse( 1 );
        canvasFitParent();
    }
}

window.open_mume_map_window = open_mume_map_window;
window.mume_menu_new = mume_menu_new;
window.mume_menu_help = mume_menu_help;
window.mume_menu_rules = mume_menu_rules;
window.mume_menu_about_map = mume_menu_about_map;
window.mume_menu_map_bug = mume_menu_map_bug;
