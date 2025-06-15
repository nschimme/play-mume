// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 *
 * This is disc.menu.js from Discworld, but after stripping it down it is now
 * generic and can be included in the upstream.
 */

/**
 * To add a new menu or menu item, just add it in the following variable.
 * The format is: [name of the menu item, css id, tool tip, list of
 * submenu items, each followed by the function to be executed as a
 * string.
 */

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUD } from './decafmud'; // Hypothetical import
// import type { PanelsInterface } from './decafmud.interface.panels'; // Hypothetical for DecafMUD.instances[0].ui
declare var DecafMUD: any; // Placeholder for DecafMUD static and instance types
declare function get_fontsize(): number; // Assumed global from settings
declare function set_fontsize(size: number): void; // Assumed global from settings
declare var fkeymacros: boolean; // Assumed global from settings
declare var numpadwalking: boolean; // Assumed global from settings
declare function toggle_fkeys(value: boolean): void; // Assumed global from settings
declare function toggle_numpad(value: boolean): void; // Assumed global from settings
declare function progress_visible(): boolean; // Assumed global from settings
declare function toggle_progressbars(value: boolean): void; // Assumed global from settings
declare var showmap: boolean; // Assumed global from settings
declare function toggle_map(value: boolean): void; // Assumed global from settings
declare class dragObject { constructor(elementId: string, handleId: string); StopListening(arg: boolean): void; }


type MenuItem = [string, string]; // [Text, ActionString]
type MenuDefinition = [string, string, string, MenuItem[]];

const toolbar_menus: MenuDefinition[] = [
  [ 'File', 'menu_file', 'Used for (re-)connecting.',
    [['Reconnect', 'menu_reconnect();']]
  ],
  [ 'Log', 'menu_log', 'Create a log file for this session.',
    [['HTML log', 'menu_log("html");'],
     ['Plain Text Log', 'menu_log("plain");']]
  ],
  [ 'Options', 'menu_options', 'Change DecafMud Options',
    [[/*'Fullscreen', 'DecafMUD.instances[0].ui.click_fsbutton()',*/ // Fullscreen handled differently in modern browsers
     'Font (Size)', 'menu_font_size();'],
     ['Macros', 'menu_macros();'],
     ['Flush History', 'menu_history_flush();']]
  ],
  [ 'Help', 'menu_help', 'Info about DecafMUD and its usage.',
    [['Client Features', 'menu_features();'],
     ['About', 'menu_about();']]
  ]
];

const MENU_FILE: number    = 0;
const MENU_LOG: number     = 1;
const MENU_OPTIONS: number = 2;
const MENU_HELP: number    = 3;
const MI_SUBMENU: number = 3; // Index of submenu items in MenuDefinition

/**
 * =======================================
 * Functionality for generating the menus.
 * =======================================
 */
function build_menu(id: number): string {
  let ret: string = toolbar_menus[id][0] + "<ul id=\"sub" +
            toolbar_menus[id][1] + "\" class=\"submenu\">";
  const submenuItems = toolbar_menus[id][MI_SUBMENU];
  for (let j = 0; j < submenuItems.length; j++) {
    ret += "<li><a href=\"javascript:" + submenuItems[j][1] +
           "\">" + submenuItems[j][0] + "</a></li>";
  }
  ret += "</ul>";
  return ret;
}

/**
 * This function tells decafmud.interface.panels.js which menus it
 * should put on the screen.
 */
function get_menus(): string[] {
  const ret: string[] = [];
  for (let i = 0; i < toolbar_menus.length; i++) {
    ret.push(toolbar_menus[i][1]); // CSS id
    ret.push(build_menu(i));       // HTML string for the menu
    ret.push(toolbar_menus[i][2]); // Tooltip
  }
  return ret;
}

/**
 * ================================================
 * Functionality for opening and closing the menus.
 * ================================================
 */
let open_menu: number = -1;

function close_menus(): void {
  for (let i = 0; i < toolbar_menus.length; i++) {
    const menuname: string = "sub" + toolbar_menus[i][1];
    const menuElement = document.getElementById(menuname);
    if (menuElement) {
        menuElement.style.visibility = 'hidden';
    }
  }
  open_menu = -1;
  if (DecafMUD.instances[0] && DecafMUD.instances[0].ui && DecafMUD.instances[0].ui.input) {
    (DecafMUD.instances[0].ui.input as HTMLElement).focus();
  }
}

function toggle_menu(index: number): void {
  const menuid: string = "sub" + toolbar_menus[index][1];
  const menuElement = document.getElementById(menuid);
  if (!menuElement) return;

  if (open_menu === index) {
    menuElement.style.visibility = 'hidden';
    open_menu = -1;
    if (DecafMUD.instances[0] && DecafMUD.instances[0].ui && DecafMUD.instances[0].ui.input) {
        (DecafMUD.instances[0].ui.input as HTMLElement).focus();
    }
  } else {
    close_menus();
    menuElement.style.visibility = 'visible';
    open_menu = index;
  }
}

/**
 * ===============================================
 * Functionality to open and close a popup window.
 * ===============================================
 */
let popup: HTMLElement | undefined;
let popupheader: HTMLElement | undefined;
let headerdrag: dragObject | undefined;


function show_popup(): HTMLElement {
  const decafUi = DecafMUD.instances[0].ui; // Assuming PanelsInterface instance

  if (popup) {
    // Clear existing children except the first one (often the header or close button)
    while (popup.children.length > 1) { // Keep one child if needed, or adjust
        if (popup.lastChild) popup.removeChild(popup.lastChild);
    }
    // If headerdrag exists and popup is being reused, ensure it's re-initialized or still valid
    if(headerdrag && popupheader) {
        // Potentially re-initialize dragObject if needed, or ensure it's robust to reuse
    } else {
        // If header/drag elements were removed, they need to be recreated
    }
  } else {
      popup = document.createElement("div");
  }


  let w: number = decafUi.maxPopupWidth();
  let h: number = decafUi.maxPopupHeight();
  let t: number = decafUi.verticalPopupOffset();
  let l: number = decafUi.horizontalPopupOffset();

  l += w * 0.2;
  w *= 0.6;
  h *= 0.7;

  popup.style.width = w + "px";
  popup.style.height = h + "px";
  popup.style.top = t + "px";
  popup.style.left = l + "px";
  popup.className = 'decafmud window';
  popup.id = "popup";

  if (!popup.parentNode) { // Only append if not already in DOM (e.g. first time or if removed)
    decafUi.container.insertBefore(popup, decafUi.el_display);
  }


  if (!popupheader || !popup.contains(popupheader)) { // Create header only if it doesn't exist or was removed
    popupheader = document.createElement("div");
    popupheader.style.width = w + "px";
    popupheader.style.height = "25px";
    popupheader.style.top = "0px";
    popupheader.className = 'decafmud window-header';
    popupheader.id = "popupheader";
    popup.appendChild(popupheader);
    headerdrag = new dragObject("popup", "popupheader"); // dragObject might need to handle re-init
  }

  // Ensure close button is there
  let x = popup.querySelector('.closebutton') as HTMLButtonElement;
  if (!x) {
    x = document.createElement('button');
    x.innerHTML = '<big>X</big>';
    x.className = 'closebutton';
    x.onclick = function() { close_popup(); };
    popup.appendChild(x);
  }


  return popup;
}

function close_popup(): void {
  if (headerdrag) {
    headerdrag.StopListening(true);
  }
  if (popup && popup.parentNode) {
    popup.parentNode.removeChild(popup);
  }
  popup = undefined;
  popupheader = undefined;
  headerdrag = undefined;
}

function add_element<K extends keyof HTMLElementTagNameMap>(inside: HTMLElement, kind: K, innerhtml: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(kind);
  el.innerHTML = innerhtml;
  inside.appendChild(el);
  return el;
}

function button_line(par: HTMLElement): HTMLParagraphElement {
  const buttonline = document.createElement("p");
  buttonline.style.textAlign = "center";
  par.appendChild(buttonline);
  return buttonline;
}

function add_close_button(parentob: HTMLElement): void {
  const closebtn = document.createElement('a');
  closebtn.className = "fakebutton";
  closebtn.href = 'javascript:close_popup();';
  closebtn.innerHTML = '<big>Close</big>';
  parentob.appendChild(closebtn);
}

function popup_header(text: string): void {
  if (!popup) return;
  const p = document.createElement("p");
  p.innerHTML = text;
  p.style.marginLeft = "5px";
  p.style.marginRight = "5px";
  p.style.marginBottom = "0px";
  p.style.fontSize = "150%";
  p.className = "headertext";
  popup.appendChild(p);
}

function popup_textarea(name: string, adjust: number): HTMLTextAreaElement {
  if (!popup) throw new Error("Popup must be shown before adding textarea.");
  const decafUi = DecafMUD.instances[0].ui;
  const w = decafUi.maxPopupWidth() * 0.6 - 15;
  const h = decafUi.maxPopupHeight() * 0.7 - 100 - adjust;
  const textarea = document.createElement("textarea");
  textarea.id = name;
  textarea.cols = 80;
  textarea.rows = 20;
  textarea.style.width = w + "px";
  textarea.style.height = h + "px";
  textarea.style.margin = "5px";
  popup.appendChild(textarea);
  return textarea;
}

function popup_textdiv(): HTMLDivElement {
  if (!popup) throw new Error("Popup must be shown before adding textdiv.");
  const decafUi = DecafMUD.instances[0].ui;
  const w = decafUi.maxPopupWidth() * 0.6 - 10;
  const h = decafUi.maxPopupHeight() * 0.7 - 60;
  const div = document.createElement("div");
  div.style.width = w + "px";
  div.style.height = h + "px";
  div.style.margin = "5px";
  div.style.overflowY = "auto";
  popup.appendChild(div);
  return div;
}

/**
 * ============================================
 * Functionality for the individual menu items.
 * ============================================
 */

function menu_reconnect(): void {
  DecafMUD.instances[0].reconnect();
}

function menu_log(style: 'html' | 'plain'): void {
  const currentPopup = show_popup(); // Ensure popup is shown and get reference
  const textarea = popup_textarea("editor", 70);

  let txt = DecafMUD.instances[0].ui.display.display.innerHTML;
  if (style === "plain") {
    txt = txt.replace(/\n/g, ' ');
    txt = txt.replace(/<br>/gi, '\n'); // Case-insensitive for <br>
    txt = txt.replace(/<.*?>/g, '');
    txt = txt.replace(/&nbsp;/g, ' ');
    txt = txt.replace(/&lt;/g, '<');
    txt = txt.replace(/&gt;/g, '>');
  } else {
    const currentTime = new Date();
    txt = `<html><head><title>DecafMUD ${currentTime.getDate()}/${currentTime.getMonth() + 1}/${currentTime.getFullYear()}</title>
<link rel="stylesheet" href="mud-colors.css" type="text/css" />
</head><body>
${txt}
</body></html>`;
  }
  textarea.value = txt;

  add_element(currentPopup, "p", "To log, copy the text from this area to a text file (on most systems you can copy by clicking in the field, then ctrl+a, ctrl+c).");
  if (style === "html") {
    add_element(currentPopup, "p", "The css-file used for the colours can be downloaded <a href=\"mud-colors.css\">here</a>.");
  }

  const btns = button_line(currentPopup);
  add_close_button(btns);
}

function menu_font_size(): void {
  const pop = popup_textdiv(show_popup());
  add_element(pop, "h2", "Change fonts.");
  const frm = document.createElement("form") as HTMLFormElement; // Cast for form elements
  frm.name = "formfonts";
  pop.appendChild(frm);
  add_element(frm, "p", "Font Size: <input name=\"txtfontsize\" type=\"text\" size=5 value=\"" + get_fontsize() + "\">");
  add_element(frm, "p", "(Select a value between 50 and 500 - the default size is 100.)");
  add_element(frm, "p", "Font Family: <input name=\"txtfontfamily\" type=\"text\" size=20 value=\"\">");
  add_element(frm, "p", "(Select a font that is supported by your browser, or leave empty for the current font.)");

  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_font();"; // change_font needs to be global or on window
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);

  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");

  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();"; // close_popup needs to be global or on window
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function change_font(): void {
  // Assuming formfonts is accessible globally or via document.forms
  const form = document.forms.namedItem("formfonts") as HTMLFormElement;
  if (!form) return;
  const k = parseInt((form.elements.namedItem("txtfontsize") as HTMLInputElement).value);
  if (isNaN(k) || k < 50 || k > 500) {
    alert("Please select a size between 50 and 500.");
    return;
  }

  set_fontsize(k); // Assumed global
  const s = (form.elements.namedItem("txtfontfamily") as HTMLInputElement).value;
  if (s !== "") {
    DecafMUD.instances[0].ui.el_display.style.fontFamily = `'${s}', Consolas, Courier, 'Courier New', 'Andale Mono', Monaco, monospace`;
  }
  close_popup();
  DecafMUD.instances[0].ui.display.scroll();
  (DecafMUD.instances[0].ui.input as HTMLElement).focus();
}

function menu_macros(): void {
  const pop = popup_textdiv(show_popup());
  add_element(pop, "p", "Decafmud supports both F-key macro's (you need to use the mud's alias system to use them, for example <tt>alias f1 score</tt>), and numpad navigation (you need to turn numlock on for this to work).");
  const frm = document.createElement("form") as HTMLFormElement;
  frm.name = "formmacros";
  pop.appendChild(frm);
  add_element(frm, "p", `<input type="checkbox" name="cfkey" ${fkeymacros ? "checked" : ""}/>Enable f-key macros.`);
  add_element(frm, "p", `<input type="checkbox" name="cnumpad" ${numpadwalking ? "checked" : ""}/>Enable numpad navigation.`);

  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_macros();"; // change_macros needs to be global
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);

  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");

  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();"; // close_popup needs to be global
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function menu_history_flush(): void {
  DecafMUD.instances[0].ui.display.clear();
}

function change_macros(): void {
  const form = document.forms.namedItem("formmacros") as HTMLFormElement;
  if (!form) return;
  const fkey = (form.elements.namedItem("cfkey") as HTMLInputElement).checked;
  const nump = (form.elements.namedItem("cnumpad") as HTMLInputElement).checked;
  toggle_fkeys(fkey);   // Assumed global
  toggle_numpad(nump); // Assumed global
  close_popup();
}

function menu_progressbars(): void {
  if (progress_visible()) toggle_progressbars(false); // Assumed global
  else toggle_progressbars(true); // Assumed global
}

function menu_map(): void {
  if (showmap) { // Assumed global
    toggle_map(false); // Assumed global
    alert("Warning: the map will automatically reappear when the mud sends it.  To stop the side-map, change your settings in options output map.");
    const p = document.getElementById("submenu_options");
    const c = document.getElementById("submenu_options_map");
    if (p && c) p.removeChild(c);
  }
}

function menu_features(): void {
  const pop = popup_textdiv(show_popup());
  add_element(pop, "h2", "Client Features");
  add_element(pop, "p", "Decafmud is a basic mud client, with just a few features.");
  const ul = add_element(pop, "ul", "");
  add_element(ul, "li", "To send multiple commands at once, separate them by putting ;; in between.<br>For example: <tt>look;;score</tt>");
  add_element(ul, "li", "You can browse your previous commands with the up and down arrow keys.");
  add_element(ul, "li", "The F1, F2, ... keys send the commands f1, f2, ... to the mud.  You can use the MUD's alias system to attach commands to this, for example \"alias f1 score\".  Use \"help alias\" when logged in to the mud for more information.");
  add_element(ul, "li", "You can use the numpad for quick navigation.  Make sure you have the numlock key on for it to work.");
  add_element(ul, "li", "You can clear the input field immediately using shift+backspace (useful for MUDs where you send a blank line to interrupt the current action).");
  add_element(ul, "li", "To create a log file from your current session, use the Log menu.  Unfortunately it is not possible (due to browers' security restrictions) to automatically save a file to your computer, so you will have to copy it to a text editor yourself.");

  add_close_button(button_line(pop));
}

function menu_about(): void {
  DecafMUD.instances[0].about();
}

/**
 * ===========================================
 * Functionality for the troubleshooting menu.
 * ===========================================
 */

function menu_trouble(): void {
  window.open("help.html", "Troubleshooting", "width=800,height=400,resizable=yes,scrollbar=yes,toolbar=yes,menubar=no,location=no,directories=no,status=no");
}

// Make functions available on window if they are called via javascript: links
(window as any).change_font = change_font;
(window as any).change_macros = change_macros;
(window as any).close_popup = close_popup;
// Menu item actions are already global.

// Expose get_menus for PanelsInterface
(DecafMUD as any).get_menus = get_menus;
(DecafMUD as any).toggle_menu = toggle_menu; // Also used by PanelsInterface
(DecafMUD as any).close_menus = close_menus; // Potentially used by PanelsInterface or other UI parts
(DecafMUD as any).open_menu = open_menu; // Share state if needed, though encapsulation is better
