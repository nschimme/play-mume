// Data structure for toolbar menus, adapted from decafmud.interface.panels.menu.js

// Define an interface for menu items and top-level menus for better type safety
export interface MenuItemAction {
    name: string;
    action: string; // String to be evaluated, or a key to map to a method
    id?: string; // Optional ID for the menu item element
}

export interface MenuDefinition {
    name: string;
    id: string; // CSS ID for the top-level menu button/element
    tooltip: string;
    items: MenuItemAction[];
}

// MENU_FILE, MENU_LOG, etc., can be mapped to indices or specific IDs if needed elsewhere.
// For now, the array index will serve this purpose.
export const MENU_FILE = 0;
export const MENU_LOG = 1;
export const MENU_OPTIONS = 2;
export const MENU_HELP = 3;
// MI_SUBMENU constant was 3 in original, likely indicating the start of items array.

export const toolbarMenus: MenuDefinition[] = [
    {
        name: 'File',
        id: 'menu_file',
        tooltip: 'Used for (re-)connecting.',
        items: [
            { name: 'Reconnect', action: 'this.menu_reconnect();', id: 'menu_file_reconnect' }
        ]
    },
    {
        name: 'Log',
        id: 'menu_log',
        tooltip: 'Create a log file for this session.',
        items: [
            { name: 'HTML log', action: 'this.menu_log("html");', id: 'menu_log_html' },
            { name: 'Plain Text Log', action: 'this.menu_log("plain");', id: 'menu_log_plain'}
        ]
    },
    {
        name: 'Options',
        id: 'menu_options',
        tooltip: 'Change DecafMUD Options',
        items: [
            // { name: 'Fullscreen', action: 'this.click_fsbutton(event);' }, // Already handled by a direct toolbar button
            { name: 'Font (Size)', action: 'this.menu_font_size();', id: 'menu_options_font' },
            { name: 'Macros', action: 'this.menu_macros();', id: 'menu_options_macros' },
            { name: 'Flush History', action: 'this.menu_history_flush();', id: 'menu_options_flushhistory' }
        ]
    },
    {
        name: 'Help',
        id: 'menu_help',
        tooltip: 'Info about DecafMUD and its usage.',
        items: [
            { name: 'Client Features', action: 'this.menu_features();', id: 'menu_help_features' },
            { name: 'About', action: 'this.menu_about();', id: 'menu_help_about' }
            // { name: 'Troubleshooting', action: 'this.menu_trouble();' } // Opens external page, can be simple link
        ]
    }
];

// Example of how a settings structure might be defined for `panels.settings.js` content
// This would be better placed in its own settings management module or within DecafMUD core options.
export interface ClientSettings {
    fontPercentage: number;
    fkeyMacrosEnabled: boolean;
    numpadWalkingEnabled: boolean;
    showProgressBars: boolean;
    showMap: boolean;
}

export const defaultClientSettings: ClientSettings = {
    fontPercentage: 100,
    fkeyMacrosEnabled: true,
    numpadWalkingEnabled: true,
    showProgressBars: false, // Default to false, user can enable
    showMap: false,          // Default to false
};

// Functions from panels.settings.js would interact with these settings,
// likely through the DecafMUD store or by directly updating these and UI.
// For example:
// set_fontsize(k: number, ui: SimpleInterface) {
//   settings.fontPercentage = k;
//   ui.el_display.style.fontSize = `${k * 110 / 100}%`;
//   DecafMUD.instances[0].store.set('ui/fontpercentage', k);
// }
// These will be integrated into SimpleInterface methods or a dedicated settings service.
