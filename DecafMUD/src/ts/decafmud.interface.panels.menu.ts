/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules.
 */

import { DecafMUD } from "./decafmud";
import { PanelsInterface } from "./decafmud.interface.panels";

// Type definitions for menu structures (mirrors what's in window-extensions.d.ts for clarity here)
type SubMenuItem = string;
type SubMenuArray = SubMenuItem[];
export type ToolbarMenuItemTuple = [string, string, string, SubMenuArray];
export type ToolbarMenusArray = ToolbarMenuItemTuple[];

// These would ideally be imported or properly typed if they come from other TS files.
// For now, declaring them as they are expected by this script.
declare var dragObject: any;
declare function get_fontsize(): number;
declare function set_fontsize(size: number): void;
declare var fkeymacros: boolean;
declare var numpadwalking: boolean;
declare function toggle_fkeys(enabled: boolean): void;
declare function toggle_numpad(enabled: boolean): void;
// declare function progress_visible(): boolean; // Seems unused by this file's direct logic
// declare function toggle_progressbars(visible: boolean): void; // Seems unused
// declare var showmap: boolean; // Seems unused
// declare function toggle_map(visible: boolean): void; // Seems unused

// Exported Menu Constants for external use (e.g., by mume.menu.ts)
export const MENU_FILE = 0;
export const MENU_LOG = 1;
export const MENU_OPTIONS = 2;
export const MENU_HELP = 3;
export const MI_SUBMENU = 3; // Index within a menu item tuple for the submenu array


// --- Menu Structure ---
// This structure matches ToolbarMenusArray in window-extensions.d.ts
const toolbar_menus_local: ToolbarMenusArray = [ // Use ToolbarMenusArray type
  [ 'File', 'menu_file', 'Used for (re-)connecting.',
    ['Reconnect', 'menu_reconnect();']
  ],
  [ 'Log', 'menu_log', 'Create a log file for this session.',
    ['HTML log', 'menu_log("html");', // Note: string literals in actions
     'Plain Text Log', 'menu_log("plain");']
  ],
  [ 'Options', 'menu_options', 'Change DecafMud Options',
    [/*'Fullscreen', 'DecafMUD.instances[0].ui.click_fsbutton()', // click_fsbutton not on PanelsInterface */
     'Font (Size)', 'menu_font_size();',
     'Macros', 'menu_macros();',
     'Flush History', 'menu_history_flush();']
  ],
  [ 'Help', 'menu_help', 'Info about DecafMUD and its usage.',
    ['Client Features', 'menu_features();',
     'About', 'menu_about();']
  ]
];

// Constants for menu indices (if needed by other parts, otherwise just for clarity)
// const MENU_FILE    = 0;
// const MENU_LOG     = 1;
// const MENU_OPTIONS = 2;
// const MENU_HELP    = 3;
// const MI_SUBMENU = 3; // Index of submenu items array in toolbar_menus structure

// --- Menu Building and Management ---
let open_menu_index: number = -1;

function build_menu(id: number): string {
  let ret = toolbar_menus[id][0] + `<ul id="sub${toolbar_menus[id][1]}" class="submenu">`;
  const items = toolbar_menus_local[id][3]; // This is SubMenuArray
  for (let j = 0; j < items.length; j += 2) {
    // items[j] is menu item text, items[j+1] is JS action string
    ret += `<li><a href="javascript:${items[j+1]}">${items[j]}</a></li>`;
  }
  ret += "</ul>";
  return ret;
}

// This function is called by PanelsInterface.setup()
// It needs to be available when PanelsInterface is being set up.
// Making it part of the window scope for now, or PanelsInterface needs to import it.
(window as any).get_menus = function(): any[] {
  const ret: any[] = [];
  for (let i = 0; i < toolbar_menus_local.length; i++) { // Use toolbar_menus_local
    ret.push(toolbar_menus_local[i][1]);      // CSS id
    ret.push(build_menu(i));            // HTML content (build_menu already uses toolbar_menus_local)
    ret.push(toolbar_menus_local[i][2]);      // Tooltip
  }
  return ret;
};

(window as any).close_menus = function(): void {
  for (let i = 0; i < toolbar_menus_local.length; i++) { // Use toolbar_menus_local
    const menuname = "sub" + toolbar_menus_local[i][1];
    const menuElement = document.getElementById(menuname);
    if (menuElement) {
      menuElement.style.visibility = 'hidden';
    }
  }
  open_menu_index = -1;
  const currentUI = DecafMUD.instances[0]?.ui as import("./decafmud.interface.panels").PanelsInterface | undefined; // More specific import if possible
  currentUI?.input?.focus();
};

(window as any).toggle_menu = function(index: number): void {
  const menuid = "sub" + toolbar_menus_local[index][1]; // Use toolbar_menus_local
  const menuElement = document.getElementById(menuid);
  if (!menuElement) return;

  if (open_menu_index === index) {
    menuElement.style.visibility = 'hidden';
    open_menu_index = -1;
    const currentUI = DecafMUD.instances[0]?.ui as import("./decafmud.interface.panels").PanelsInterface | undefined;
    currentUI?.input?.focus();
  } else {
    (window as any).close_menus(); // Close other menus
    menuElement.style.visibility = 'visible';
    open_menu_index = index;
  }
};

// Assign the local, typed menu structure to the window object
// so mume.menu.ts can modify it, and PanelsInterface can read it via get_menus (which reads the local one).
if (typeof window !== 'undefined') {
    (window as any).toolbar_menus = toolbar_menus_local;
}

// --- Popup Functionality (Duplicated from PanelsInterface, marked for refactor) ---
// These functions are used by the menu actions. Ideally, they should call
// methods on the PanelsInterface instance (DecafMUD.instances[0].ui).
// For now, they are kept similar to original to ensure menu actions work.

let current_popup: HTMLElement | undefined;
let current_popup_header: HTMLElement | undefined;
let current_header_drag: any;

// Making these functions available globally for the javascript: hrefs
(window as any).show_popup_menu = function(): HTMLElement { // Renamed to avoid conflict
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface;
  if (!ui) throw new Error("UI not initialized for popup");

  if (current_popup) { // Clear previous content if any
    while (current_popup.children.length > 0) {
        // Be careful not to remove the header if it's managed separately or part of initial children
        // Assuming children are added after header, or manage header removal/re-addition
       if(current_popup.children.item(0) !== current_popup_header) {
            current_popup.removeChild(current_popup.children.item(0)!);
       } else if (current_popup.children.length > 1) {
            current_popup.removeChild(current_popup.children.item(1)!);
       } else {
           break; // Only header left
       }
    }
  } else {
    current_popup = document.createElement("div");

    const w = ui.maxPopupWidth() * 0.6; // 60%
    const h = ui.maxPopupHeight() * 0.7; // 70%
    const t = ui.verticalPopupOffset();
    const l = ui.horizontalPopupOffset() + (ui.maxPopupWidth() * 0.2); // 20% offset for left margin

    current_popup.style.width = w + "px";
    current_popup.style.height = h + "px";
    current_popup.style.top = t + "px";
    current_popup.style.left = l + "px";
    current_popup.className = 'decafmud window'; // Match PanelsInterface popup style
    current_popup.id = "menu_popup"; // Different ID
    ui.container.insertBefore(current_popup, ui.el_display);

    current_popup_header = document.createElement("div");
    current_popup_header.style.width = w + "px";
    current_popup_header.style.height = "25px";
    // current_popup_header.style.top = "0px"; // Not needed if part of flow
    current_popup_header.className = 'decafmud window-header'; // Match
    current_popup_header.id = "menu_popupheader";
    current_popup.appendChild(current_popup_header);
    if (typeof dragObject === 'function') {
        current_header_drag = new dragObject("menu_popup", "menu_popupheader");
    }

    const x = document.createElement('button');
    x.innerHTML = '<big>X</big>';
    x.className = 'closebutton'; // Match
    x.onclick = () => (window as any).close_popup_menu();
    current_popup.appendChild(x);
  }
  return current_popup;
};

(window as any).close_popup_menu = function(): void { // Renamed
  if (current_header_drag?.StopListening) current_header_drag.StopListening(true);
  current_popup?.parentNode?.removeChild(current_popup);
  current_popup = undefined;
  current_popup_header = undefined;
  current_header_drag = undefined;
  const currentUI = DecafMUD.instances[0]?.ui as PanelsInterface;
  currentUI?.input?.focus();
};

(window as any).add_element_menu = function(inside: HTMLElement, kind: string, innerhtml: string): HTMLElement { // Renamed
  const el = document.createElement(kind);
  el.innerHTML = innerhtml; // Caution with innerHTML
  inside.appendChild(el);
  return el;
};

(window as any).button_line_menu = function(par: HTMLElement): HTMLElement { // Renamed
  const buttonline = document.createElement("p");
  buttonline.style.textAlign = "center";
  par.appendChild(buttonline);
  return buttonline;
};

(window as any).add_close_button_menu = function(parentob: HTMLElement): void { // Renamed
  const closebtn = document.createElement('a'); // Was an 'a' tag
  closebtn.className = "fakebutton"; // Or use ui.createButton style
  closebtn.href = 'javascript:close_popup_menu();';
  closebtn.innerHTML = '<big>Close</big>';
  parentob.appendChild(closebtn);
};

(window as any).popup_header_menu = function(text: string): void { // Renamed
  if (!current_popup) return;
  const p = document.createElement("p");
  p.innerHTML = text;
  // ... styles from original ...
  p.style.marginLeft = "5px";
  p.style.marginRight = "5px";
  p.style.marginBottom = "0px";
  p.style.fontSize = "150%";
  p.className = "headertext"; // Ensure this class is defined or useful
  current_popup.appendChild(p);
};

(window as any).popup_textarea_menu = function(name: string, adjust: number): HTMLTextAreaElement { // Renamed
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface;
  if (!ui || !current_popup) throw new Error("UI or popup not initialized");

  const w = ui.maxPopupWidth() * 0.6 - 15;
  const h = ui.maxPopupHeight() * 0.7 - 100 - adjust;
  const textarea = document.createElement("textarea");
  textarea.id = name;
  textarea.cols = 80; // Default, consider removing if style sets width/height
  textarea.rows = 20; // Default
  textarea.style.width = w + "px";
  textarea.style.height = h + "px";
  textarea.style.margin = "5px";
  current_popup.appendChild(textarea);
  textarea.focus();
  return textarea;
};

(window as any).popup_textdiv_menu = function(): HTMLDivElement { // Renamed
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface;
   if (!ui || !current_popup) throw new Error("UI or popup not initialized");

  const w = ui.maxPopupWidth() * 0.6 - 10;
  const h = ui.maxPopupHeight() * 0.7 - 60;
  const div = document.createElement("div");
  div.style.width = w + "px";
  div.style.height = h + "px";
  div.style.margin = "5px";
  div.style.overflowY = "auto";
  current_popup.appendChild(div);
  return div;
};


// --- Menu Item Actions ---
// These functions are called via `javascript:` hrefs in the menu.
// They need to be globally accessible.
(window as any).menu_reconnect = function(): void {
  DecafMUD.instances[0]?.reconnect();
};

(window as any).menu_log = function(style: 'html' | 'plain'): void {
  const decaf = DecafMUD.instances[0];
  if (!decaf || !decaf.ui) return;
  const ui = decaf.ui as PanelsInterface; // Assuming ui is PanelsInterface
  if (!ui.display?.display) return; // Check if display and its inner display element exist

  const popup = (window as any).show_popup_menu(); // Use the menu's popup system
  const textarea = (window as any).popup_textarea_menu("log_content", 70);

  let txt = ui.display.display.innerHTML;
  if (style === "plain") {
    txt = txt.replace(/\n/g, ' ')
             .replace(/<br\s*\/?>/gi, '\n')
             .replace(/<[^>]*>/g, '')
             .replace(/&nbsp;/g, ' ')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');
  } else { // html
    const currentTime = new Date();
    txt = `<html><head><title>DecafMUD ${currentTime.toLocaleDateString()}</title>
<link rel="stylesheet" href="mud-colors.css" type="text/css" />
</head><body>
${txt}
</body></html>`;
  }
  textarea.value = txt;

  (window as any).add_element_menu(popup, "p", "To log, copy the text from this area to a text file (on most systems you can copy by clicking in the field, then ctrl+a, ctrl+c).");
  if (style === "html") {
    (window as any).add_element_menu(popup, "p", "The css-file used for the colours can be downloaded <a href=\"mud-colors.css\">here</a>.");
  }
  const btns = (window as any).button_line_menu(popup);
  (window as any).add_close_button_menu(btns);
};

(window as any).menu_font_size = function(): void {
  const decaf = DecafMUD.instances[0];
  if (!decaf || !decaf.ui) return;
  const ui = decaf.ui as PanelsInterface;

  const pop = (window as any).popup_textdiv_menu((window as any).show_popup_menu());
  (window as any).add_element_menu(pop, "h2", "Change fonts.");
  const frm = document.createElement("form") as HTMLFormElement;
  frm.name = "formfonts";
  pop.appendChild(frm);
  (window as any).add_element_menu(frm, "p", `Font Size: <input name="txtfontsize" type="text" size="5" value="${get_fontsize()}">`);
  (window as any).add_element_menu(frm, "p", "(Select a value between 50 and 500 - the default size is 100.)");
  (window as any).add_element_menu(frm, "p", `Font Family: <input name="txtfontfamily" type="text" size="20" value="${(DecafMUD.instances[0]?.ui as import("./decafmud.interface.panels").PanelsInterface)?.el_display.style.fontFamily.split(',')[0].replace(/'/g, '') || ''}">`);
  (window as any).add_element_menu(frm, "p", "(Select a font that is supported by your browser, or leave empty for the current font.)");

  const btnsContainer = (window as any).button_line_menu(frm);

  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_font();";
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);
  (window as any).add_element_menu(frm, "span", "&nbsp;&nbsp;&nbsp;");
  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup_menu();";
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
};

(window as any).change_font = function(): void { // Must be global for href
  const decaf = DecafMUD.instances[0];
  if (!decaf || !decaf.ui) return;
  const ui = decaf.ui as PanelsInterface;

  const form = document.forms.namedItem("formfonts");
  if (!form) return;
  const fontSizeInput = form.elements.namedItem("txtfontsize") as HTMLInputElement;
  const fontFamilyInput = form.elements.namedItem("txtfontfamily") as HTMLInputElement;

  const k = parseInt(fontSizeInput.value);
  if (isNaN(k) || k < 50 || k > 500) {
    alert("Please select a size between 50 and 500.");
    return;
  }
  set_fontsize(k); // Assumes set_fontsize is global and handles applying the size

  const s = fontFamilyInput.value.trim();
  if (s !== "") {
    // More robust font family setting
    ui.el_display.style.fontFamily = `'${s}', Consolas, Courier, 'Courier New', 'Andale Mono', Monaco, monospace`;
  }
  (window as any).close_popup_menu();
  ui.display?.scroll?.();
  ui.input.focus();
};

(window as any).menu_macros = function(): void {
  const pop = (window as any).popup_textdiv_menu((window as any).show_popup_menu());
  (window as any).add_element_menu(pop, "p", "Decafmud supports both F-key macro's (you need to use the mud's alias system to use them, for example <tt>alias f1 score</tt>), and numpad navigation (you need to turn numlock on for this to work).");
  const frm = document.createElement("form") as HTMLFormElement;
  frm.name = "formmacros";
  pop.appendChild(frm);
  (window as any).add_element_menu(frm, "p", `<input type="checkbox" name="cfkey" ${(window as any).fkeymacros ? "checked" : ""}>Enable f-key macros.`);
  (window as any).add_element_menu(frm, "p", `<input type="checkbox" name="cnumpad" ${(window as any).numpadwalking ? "checked" : ""}>Enable numpad navigation.`);

  const btnsContainer = (window as any).button_line_menu(frm); // Create a container for buttons

  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_macros();";
  savebtn.innerHTML = "<big>Save</big>";
  btnsContainer.appendChild(savebtn);

  const spacer = document.createElement("span");
  spacer.innerHTML = "&nbsp;&nbsp;&nbsp;";
  btnsContainer.appendChild(spacer);

  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup_menu();";
  closebtn.innerHTML = "<big>Cancel</big>";
  btnsContainer.appendChild(closebtn);
};

(window as any).change_macros = function(): void { // Must be global
  const form = document.forms.namedItem("formmacros");
  if (!form) return;
  const fkey = (form.elements.namedItem("cfkey") as HTMLInputElement).checked;
  const nump = (form.elements.namedItem("cnumpad") as HTMLInputElement).checked;
  toggle_fkeys(fkey);   // Assumes these are global
  toggle_numpad(nump); // Assumes these are global
  (window as any).close_popup_menu();
};


(window as any).menu_history_flush = function(): void {
  const ui = DecafMUD.instances[0]?.ui as PanelsInterface;
  ui?.display?.clear?.();
};

(window as any).menu_features = function(): void {
  const pop = (window as any).popup_textdiv_menu((window as any).show_popup_menu());
  (window as any).add_element_menu(pop, "h2", "Client Features");
  // ... (add list items with feature descriptions) ...
  (window as any).add_element_menu(pop, "p", "Decafmud is a basic mud client, with just a few features.");
  const el = document.createElement("ul");
  pop.appendChild(el);
  (window as any).add_element_menu(el, "li", "To send multiple commands at once, separate them by putting ;; in between.<br>For example: <tt>look;;score</tt>");
  // ... more features ...
  const btns = (window as any).button_line_menu(pop);
  (window as any).add_close_button_menu(btns);
};

(window as any).menu_about = function(): void {
  DecafMUD.instances[0]?.about();
};

(window as any).menu_trouble = function(): void { // Unused in default toolbar_menus
  window.open("help.html", "Troubleshooting", "width=800,height=400,resizable=yes,scrollbars=yes,toolbar=yes,menubar=no,location=no,directories=no,status=no");
};

// Ensure this module is treated as such, even if all functions are global.
export {};
