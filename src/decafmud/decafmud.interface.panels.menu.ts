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

import DecafMUD from './decafmud';
import { DragObject } from './dragelement';
// If fkeymacros, numpadwalking, etc. are defined elsewhere, they should be imported or declared.
// For now, assume they are global boolean flags or typed as any.
declare var fkeymacros: boolean;
declare var numpadwalking: boolean;
declare var progress_visible: () => boolean;
declare var toggle_progressbars: (show: boolean) => void;
declare var showmap: boolean;
declare var toggle_map: (show: boolean) => void;
declare var get_fontsize: () => string;
declare var set_fontsize: (size: number) => void;


type MenuItem = [string, string] | [string, string, ...MenuItem[]]; // Name, Action or Submenu
type Menu = [string, string, string, MenuItem[]]; // Name, ID, Tooltip, Items

const toolbar_menus: Menu[] = [
  [ 'File', 'menu_file', 'Used for (re-)connecting.',
    [['Reconnect', 'menu_reconnect();']]
  ],
  [ 'Log', 'menu_log', 'Create a log file for this session.',
    [['HTML log', 'menu_log(\'html\');'],
     ['Plain Text Log', 'menu_log(\'plain\');']]
  ],
  [ 'Options', 'menu_options', 'Change DecafMud Options',
    [/*['Fullscreen', 'DecafMUD.instances[0].ui.click_fsbutton()'],*/
     ['Font (Size)', 'menu_font_size();'],
     ['Macros', 'menu_macros();'],
     ['Flush History', 'menu_history_flush();']]
  ],
  [ 'Help', 'menu_help', 'Info about DecafMUD and its usage.',
    [['Client Features', 'menu_features();'],
     ['About', 'menu_about();']]
  ]
];

export const MENU_FILE: number    = 0;
export const MENU_LOG: number     = 1;
export const MENU_OPTIONS: number = 2;
export const MENU_HELP: number    = 3;
const MI_SUBMENU: number = 3; // Index of submenu items in the Menu tuple

/**
 * =======================================
 * Functionality for generating the menus.
 * =======================================
 */
function build_menu(id: number): string {
  let ret: string = toolbar_menus[id][0] + "<ul id=\"sub" +
            toolbar_menus[id][1] + "\" class=\"submenu\">";
  for (let j = 0; j < toolbar_menus[id][MI_SUBMENU].length; j+=2) {
    ret += "<li><a href=\"javascript:" + toolbar_menus[id][MI_SUBMENU][j+1] +
           "\">" + toolbar_menus[id][MI_SUBMENU][j] + "</a></li>";
  }
  ret += "</ul>";
  return ret;
}

/**
 * This function tells decafmud.interface.discworld.js which menus it
 * should put on the screen.
 */
export function get_menus(): string[] {
  const ret: string[] = [];
  for (let i = 0; i < toolbar_menus.length; i++) {
    ret.push(toolbar_menus[i][1]); // id
    ret.push(build_menu(i));      // html content
    ret.push(toolbar_menus[i][2]); // tooltip
  }
  return ret;
}

/**
 * ================================================
 * Functionality for opening and closing the menus.
 * ================================================
 */
let open_menu: number = -1;

export function close_menus(): void {
  for (let i = 0; i < toolbar_menus.length; i++) {
    const menuname = "sub" + toolbar_menus[i][1];
    const menuElement = document.getElementById(menuname);
    if (menuElement) {
        menuElement.style.visibility = 'hidden';
    }
  }
  open_menu = -1;
  if (DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
    (DecafMUD.instances[0].ui.input as HTMLElement).focus();
  }
}

export function toggle_menu(index: number): void {
  const menuid = "sub" + toolbar_menus[index][1];
  const menuElement = document.getElementById(menuid);
  if (!menuElement) return;

  if (open_menu == index) {
    menuElement.style.visibility = 'hidden';
    open_menu = -1;
    if (DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
        (DecafMUD.instances[0].ui.input as HTMLElement).focus();
    }
  }
  else {
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
let headerdrag: any; // Instance of dragObject

export function show_popup(): HTMLElement | undefined {
  const currentInstance = DecafMUD.instances[0];
  if (!currentInstance || !currentInstance.ui) return undefined;

  if (popup != null && popup.parentNode) { // Check parentNode before removing
    popup.parentNode.removeChild(popup);
    popup = undefined; // Clear previous popup fully
    popupheader = undefined;
    if (headerdrag) headerdrag.Dispose(); // Assuming dragObject has a Dispose method
    headerdrag = undefined;
  }

  popup = document.createElement("div");

  const w = currentInstance.ui.maxPopupWidth();
  const h = currentInstance.ui.maxPopupHeight();
  const t = currentInstance.ui.verticalPopupOffset();
  const l = currentInstance.ui.horizontalPopupOffset();

  const popupWidth = w * 0.6;
  const popupHeight = h * 0.7;
  const popupLeft = l + w * 0.2;

  popup.style.width = popupWidth + "px";
  popup.style.height = popupHeight + "px";
  popup.style.top = t + "px";
  popup.style.left = popupLeft + "px";
  popup.className = 'decafmud window';
  popup.id = "popup";
  currentInstance.ui.container.insertBefore(popup, currentInstance.ui.el_display);

  popupheader = document.createElement("div");
  popupheader.style.width = popupWidth + "px";
  popupheader.style.height = "25px";
  popupheader.style.top = "0px"; // Position relative to popup
  popupheader.className = 'decafmud window-header';
  popupheader.id = "popupheader";
  popup.appendChild(popupheader);
  if (typeof DragObject !== 'undefined') { // Check for the class name
    headerdrag = new DragObject(popup, popupheader, null, null, null, null, null, false); // Use class name
  }


  const x = document.createElement('button');
  x.innerHTML = '<big>X</big>';
  x.className = 'closebutton';
  x.onclick = function() { close_popup(); };
  popup.appendChild(x);

  return popup;
}

export function close_popup(): void {
  if (headerdrag) {
    headerdrag.StopListening(true); // Assuming this method exists
    headerdrag.Dispose(); // Assuming this method exists
    headerdrag = undefined;
  }
  if (popup && popup.parentNode) {
    popup.parentNode.removeChild(popup);
  }
  popup = undefined;
  popupheader = undefined;
}

function add_element(inside: HTMLElement, kind: string, innerhtml: string): HTMLElement {
  const el = document.createElement(kind);
  el.innerHTML = innerhtml;
  inside.appendChild(el);
  return el;
}

function button_line(par: HTMLElement): HTMLElement {
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
  if (!popup || !DecafMUD.instances[0] || !DecafMUD.instances[0].ui) {
      throw new Error("Popup or DecafMUD UI not initialized");
  }
  const w = DecafMUD.instances[0].ui.maxPopupWidth() * 0.6 - 15;
  const h = DecafMUD.instances[0].ui.maxPopupHeight() * 0.7 - 100 - adjust;
  const textarea = document.createElement("textarea");
  textarea.id = name;
  textarea.cols = 80; // Default, consider making dynamic or removing
  textarea.rows = 20; // Default
  textarea.style.width = w + "px";
  textarea.style.height = h + "px";
  textarea.style.margin = "5px";
  popup.appendChild(textarea);
  return textarea;
}

function popup_textdiv(): HTMLElement {
    if (!popup || !DecafMUD.instances[0] || !DecafMUD.instances[0].ui) {
      throw new Error("Popup or DecafMUD UI not initialized");
    }
  const w = DecafMUD.instances[0].ui.maxPopupWidth() * 0.6 - 10;
  const h = DecafMUD.instances[0].ui.maxPopupHeight() * 0.7 - 60;
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

export function menu_reconnect(): void {
  if (DecafMUD.instances[0]) DecafMUD.instances[0].reconnect();
}

export function menu_log(style: 'html' | 'plain'): void {
  const currentInstance = DecafMUD.instances[0];
  if (!currentInstance || !currentInstance.ui || !currentInstance.ui.display) return;

  const popupNode = show_popup();
  if (!popupNode) return;

  const textarea = popup_textarea("editor", 70);
  let txt = currentInstance.ui.display.display.innerHTML;

  if (style === "plain") {
    txt = txt.replace(/\n/g, ' ');
    txt = txt.replace(/<br>/gi, '\n'); // Case insensitive <br>
    txt = txt.replace(/<.*?>/g, '');
    txt = txt.replace(/&nbsp;/g, ' ');
    txt = txt.replace(/&lt;/g, '<');
    txt = txt.replace(/&gt;/g, '>');
  } else {
    const currentTime = new Date();
    txt = "<html><head><title>DecafMUD " + currentTime.getDate() +
      "/" + (currentTime.getMonth() + 1) + "/" + currentTime.getFullYear()+ // Month is 0-indexed
      "</title>\n<link rel=\"stylesheet\" href=\"mud-colors.css\" "+
      "type=\"text/css\" />\n</head><body>\n" + txt +
      "</body></html>";
  }
  textarea.value = txt;

  add_element(popupNode, "p", "To log, copy the text from this area to "+
    "a text file (on most systems you can copy by clicking in the " +
    "field, then ctrl+a, ctrl+c).");
  if (style === "html") add_element(popupNode, "p", "The css-file used "+
    "for the colours can be downloaded <a href=\"mud-colors.css\">"+
    "here</a>.");

  const btns = button_line(popupNode);
  add_close_button(btns);
}

export function menu_font_size(): void {
  const popContent = show_popup();
  if(!popContent) return;
  const pop = popup_textdiv(); // Use the new div as parent for form

  add_element(pop, "h2", "Change fonts.");
  const frm = document.createElement("form") as HTMLFormElement;
  frm.name = "formfonts";
  pop.appendChild(frm);
  add_element(frm, "p", "Font Size: "+
    "<input name=\"txtfontsize\" type=\"text\" size=5 value=\"" +
    (typeof get_fontsize === 'function' ? get_fontsize() : '100') + "\">"); // Check if get_fontsize is defined
  add_element(frm, "p", "(Select a value between 50 and 500 - the "+
    "default size is 100.)");
  add_element(frm, "p", "Font Family: "+
    "<input name=\"txtfontfamily\" type=\"text\" size=20 value=\"\">");
  add_element(frm, "p", "(Select a font that is supported by your "+
    "browser, or leave empty for the current font.)");

  const buttonContainer = button_line(frm); // Add buttons to the form or a dedicated div
  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_font();"; // change_font needs to be global or exported and called via module
  savebtn.innerHTML = "<big>Save</big>";
  buttonContainer.appendChild(savebtn);

  add_element(buttonContainer, "span", "&nbsp;&nbsp;&nbsp;");
  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();"; // close_popup needs to be global or exported
  closebtn.innerHTML = "<big>Cancel</big>";
  buttonContainer.appendChild(closebtn);
}

// Make change_font accessible, e.g. by attaching to window or exporting and calling via module
(window as any).change_font = function change_font(): void {
  const fontSizeInput = (document.forms as any).formfonts.txtfontsize as HTMLInputElement;
  const k = parseInt(fontSizeInput.value);
  if (isNaN(k) || k < 50 || k > 500) {
    alert("Please select a size between 50 and 500.");
    return;
  }

  if (typeof set_fontsize === 'function') set_fontsize(k);

  const fontFamilyInput = (document.forms as any).formfonts.txtfontfamily as HTMLInputElement;
  const s = fontFamilyInput.value;
  if (s !== "" && DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
    DecafMUD.instances[0].ui.el_display.style.fontFamily = "'" + s + "', Consolas, "+
          "Courier, 'Courier New', 'Andale Mono', Monaco, monospace";
  }
  close_popup();
  if (DecafMUD.instances[0] && DecafMUD.instances[0].ui && DecafMUD.instances[0].ui.display) {
    DecafMUD.instances[0].ui.display.scroll();
  }
   if (DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
    (DecafMUD.instances[0].ui.input as HTMLElement).focus();
  }
};

export function menu_macros(): void {
  const popContent = show_popup();
   if(!popContent) return;
  const pop = popup_textdiv();

  add_element(pop, "p", "Decafmud supports both F-key macro's "+
    "(you need to use the mud's alias system to use them, for "+
    "example <tt>alias f1 score</tt>), and numpad navigation (you "+
    "need to turn numlock on for this to work).");
  const frm = document.createElement("form") as HTMLFormElement;
  frm.name = "formmacros";
  pop.appendChild(frm);
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cfkey\" " +
    (typeof fkeymacros !== 'undefined' && fkeymacros ? "checked" : "") + "/>Enable f-key macros.");
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cnumpad\" "+
    (typeof numpadwalking !== 'undefined' && numpadwalking ? "checked" : "") + "/>Enable numpad navigation.");

  const buttonContainer = button_line(frm);
  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_macros();"; // change_macros needs to be global or exported
  savebtn.innerHTML = "<big>Save</big>";
  buttonContainer.appendChild(savebtn);

  add_element(buttonContainer, "span", "&nbsp;&nbsp;&nbsp;");
  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();"; // close_popup needs to be global or exported
  closebtn.innerHTML = "<big>Cancel</big>";
  buttonContainer.appendChild(closebtn);
}

(window as any).change_macros = function change_macros(): void {
    const fkey = (document.forms as any).formmacros.cfkey.checked;
    const nump = (document.forms as any).formmacros.cnumpad.checked;
    if (typeof (window as any).toggle_fkeys === 'function') (window as any).toggle_fkeys(fkey);
    if (typeof (window as any).toggle_numpad === 'function') (window as any).toggle_numpad(nump);
    close_popup();
};


export function menu_history_flush(): void {
  if (DecafMUD.instances[0] && DecafMUD.instances[0].ui && DecafMUD.instances[0].ui.display) {
    DecafMUD.instances[0].ui.display.clear();
  }
}


export function menu_progressbars(): void {
  if (typeof progress_visible === 'function' && typeof toggle_progressbars === 'function') {
    if (progress_visible()) toggle_progressbars(false);
    else toggle_progressbars(true);
  }
}

export function menu_map(): void {
  if (typeof showmap !== 'undefined' && typeof toggle_map === 'function') {
    if (showmap) {
        toggle_map(false);
        alert("Warning: the map will automatically reappear when the "+
        "mud sends it.  To stop the side-map, change your settings "+
        "in options output map.");
        const p = document.getElementById("submenu_options");
        const c = document.getElementById("submenu_options_map");
        if (p && c && c.parentNode === p) { // Check if c is actually a child of p
            p.removeChild(c);
        }
    }
  }
}

export function menu_features(): void {
  const popContent = show_popup();
  if(!popContent) return;
  const pop = popup_textdiv();

  add_element(pop, "h2", "Client Features");
  add_element(pop, "p", "Decafmud is a basic mud client, "+
    "with just a few features.");
  const el = document.createElement("ul");
  pop.appendChild(el);
  add_element(el, "li", "To send multiple commands at once, separate "+
    "them by putting ;; in between.<br>For example: "+
    "<tt>look;;score</tt>");
  add_element(el, "li", "You can browse your previous commands with "+
    "the up and down arrow keys.");
  add_element(el, "li", "The F1, F2, ... keys send the commands f1, "+
    "f2, ... to the mud.  You can use the MUD's alias system to "+
    "attach commands to this, for example \"alias f1 score\".  Use "+
    "\"help alias\" when logged in to the mud for more information.");
  add_element(el, "li", "You can use the numpad for quick "+
    "navigation.  Make sure you have the numlock key on for it to "+
    "work.");
  add_element(el, "li", "You can clear the input field immediately "+
    "using shift+backspace (useful for MUDs where you send a blank "+
    "line to interrupt the current action).");
  add_element(el, "li", "To create a log file from your current "+
    "session, use the Log menu.  Unfortunately it is not possible "+
    "(due to browers' security restrictions) to automatically save "+
    "a file to your computer, so you will have to copy it to a text "+
    "editor yourself.");

  const btnLine = button_line(pop);
  add_close_button(btnLine);
}

export function menu_about(): void {
  if (DecafMUD.instances[0]) DecafMUD.instances[0].about();
}

/**
 * ===========================================
 * Functionality for the troubleshooting menu.
 * ===========================================
 */

export function menu_trouble(): void {
  window.open("help.html", "Troubleshooting", "width=800,height=400,resizable=yes,scrollbars=yes,toolbar=yes,menubar=no,location=no,directories=no,status=no");
}
