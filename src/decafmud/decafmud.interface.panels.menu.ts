import { DecafMUD } from './decafmud';
import { dragObject } from './dragelement';
import {
    get_fontsize,
    set_fontsize,
    fkeymacros,
    numpadwalking,
    toggle_fkeys,
    toggle_numpad,
    progress_visible,
    toggle_progressbars,
    showmap,
    toggle_map
} from './decafmud.interface.panels.settings';
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

const toolbar_menus = [
  [ 'File', 'menu_file', 'Used for (re-)connecting.',
    ['Reconnect', 'menu_reconnect();']
  ],
  [ 'Log', 'menu_log', 'Create a log file for this session.',
    ['HTML log', 'menu_log(\'html\');',
     'Plain Text Log', 'menu_log(\'plain\');']
  ],
  [ 'Options', 'menu_options', 'Change DecafMud Options',
    [/*'Fullscreen', 'DecafMUD.instances[0].ui.click_fsbutton()',*/
     'Font (Size)', 'menu_font_size();',
     'Macros', 'menu_macros();',
     'Flush History', 'menu_history_flush();']
  ],
  [ 'Help', 'menu_help', 'Info about DecafMUD and its usage.',
    ['Client Features', 'menu_features();',
     'About', 'menu_about();' ]
  ]
];

const MENU_FILE    = 0,
    MENU_LOG     = 1,
    MENU_OPTIONS = 2,
    MENU_HELP    = 3,
    MI_SUBMENU = 3;

/**
 * =======================================
 * Functionality for generating the menus.
 * =======================================
 */
function build_menu(id) {
  let ret = toolbar_menus[id][0] + "<ul id=\"sub" +
            toolbar_menus[id][1] + "\" class=\"submenu\">";
  for (let j = 0; j < toolbar_menus[id][3].length; j+=2) {
    ret += "<li><a href=\"javascript:" + toolbar_menus[id][3][j+1] +
           "\">" + toolbar_menus[id][3][j] + "</a></li>";
  }
  ret += "</ul>";
  return ret;
}

/**
 * This function tells decafmud.interface.discworld.js which menus it
 * should put on the screen.
 */
export function get_menus() {
  const ret = new Array();
  for (let i = 0; i < toolbar_menus.length; i++) {
    ret.push(toolbar_menus[i][1]);
    ret.push(build_menu(i));
    ret.push(toolbar_menus[i][2]);
  }
  return ret;
}

/**
 * ================================================
 * Functionality for opening and closing the menus.
 * ================================================
 */
export let open_menu = -1;

export function close_menus() {
  for (let i = 0; i < toolbar_menus.length; i++) {
    let menuname = "sub" + toolbar_menus[i][1];
    document.getElementById(menuname).style.visibility = 'hidden';
  }
  open_menu = -1;
  DecafMUD.instances[0].ui.input.focus();
}

export function toggle_menu(index: number) { // Added type for index
  let menuid = "sub" + toolbar_menus[index][1];
  if (open_menu == index) {
    document.getElementById(menuid).style.visibility = 'hidden';
    open_menu = -1;
    DecafMUD.instances[0].ui.input.focus();
  }
  else {
    close_menus();
    document.getElementById(menuid).style.visibility = 'visible';
    open_menu = index;
  }
}

/**
 * ===============================================
 * Functionality to open and close a popup window.
 * ===============================================
 */
let popup: HTMLDivElement | undefined;
let popupheader: HTMLDivElement | undefined;
let headerdrag: any; // Changed from dragObject | undefined to any

function show_popup(): HTMLDivElement | undefined {
  // if we already have a popup, clear it
  if (popup != null) {
    while (popup.children.length > 0) {
      popup.removeChild(popup.children.item(1));
    }
  }

  // otherwise create it
  popup = document.createElement("div");

  // get data about the screen size
  const w_base = DecafMUD.instances[0].ui.maxPopupWidth();
  const h_base = DecafMUD.instances[0].ui.maxPopupHeight();
  const t = DecafMUD.instances[0].ui.verticalPopupOffset();
  let l = DecafMUD.instances[0].ui.horizontalPopupOffset();

  l += w_base * 2 / 10;
  const w = w_base * 6 / 10;
  const h = h_base * 7 / 10;

  popup.style.width = w + "px";
  popup.style.height = h + "px";
  popup.style.top = t + "px";
  popup.style.left = l + "px";
  popup.className = 'decafmud window';
  popup.id = "popup";
  DecafMUD.instances[0].ui.container.insertBefore(popup, DecafMUD.instances[0].ui.el_display);

  // create the draggable header
  popupheader = document.createElement("div");
  popupheader.style.width = w + "px";
  popupheader.style.height = "25px";
  popupheader.style.top = "0px";
  popupheader.className = 'decafmud window-header';
  popupheader.id = "popupheader";
  popup.appendChild(popupheader);
  if (popup && popupheader) {
    headerdrag = new dragObject(popup, popupheader);
  }

  // create a close button
  const x = document.createElement('button');
  x.innerHTML = '<big>X</big>';
  x.className = 'closebutton';
  x.onclick = function() { close_popup(); };
  popup.appendChild(x);

  return popup;
}

function close_popup() {
  headerdrag.StopListening(true);
  popup.parentNode.removeChild(popup);
  popup = undefined;
  popupheader = undefined;
}

function add_element(inside: HTMLElement, kind: string, innerhtml: string): HTMLElement {
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

function add_close_button(parentob: HTMLElement) {
  const closebtn = document.createElement('a');
  closebtn.className = "fakebutton";
  closebtn.href = 'javascript:close_popup();';
  closebtn.innerHTML = '<big>Close</big>';
  parentob.appendChild(closebtn);
}

function popup_header(text: string) {
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
  const w = DecafMUD.instances[0].ui.maxPopupWidth() * 6 / 10 - 15;
  const h = DecafMUD.instances[0].ui.maxPopupHeight() * 7 / 10 - 100 - adjust;
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
  const w = DecafMUD.instances[0].ui.maxPopupWidth() * 6 / 10 - 10;
  const h = DecafMUD.instances[0].ui.maxPopupHeight() * 7 / 10 - 60;
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

function menu_reconnect() {
  DecafMUD.instances[0].reconnect();
}

function menu_log(style: string) {
  const popup_el = show_popup();
  if (!popup_el) return; // Guard against undefined popup
  const textarea = popup_textarea("editor", 70);

  // get the log file
  let txt = DecafMUD.instances[0].ui.display.display.innerHTML;
  if (style == "plain") {
    txt = txt.replace(/\n/g, ' ');
    txt = txt.replace(/<br>/g, '\n');
    txt = txt.replace(/<.*?>/g, '');
    txt = txt.replace(/&nbsp;/g, ' ');
    txt = txt.replace(/\&lt;/g, '<');
    txt = txt.replace(/\&gt;/g, '>');
  }
  else {
    const currentTime = new Date();
    txt = "<html><head><title>DecafMUD " + currentTime.getDate() +
      "/" + currentTime.getMonth() + "/" + currentTime.getFullYear()+
      "</title>\n<link rel=\"stylesheet\" href=\"mud-colors.css\" "+
      "type=\"text/css\" />\n</head><body>\n" + txt +
      "</body></html>";
  }
  textarea.value = txt;

  // add an explanation
  add_element(popup_el, "p", "To log, copy the text from this area to "+
    "a text file (on most systems you can copy by clicking in the " +
    "field, then ctrl+a, ctrl+c).");
  if (style == "html") add_element(popup_el, "p", "The css-file used "+
    "for the colours can be downloaded <a href=\"mud-colors.css\">"+
    "here</a>.");

  // and end with a closing button
  const btns = button_line(popup_el);
  add_close_button(btns);
}

function menu_font_size() {
  const pop = popup_textdiv(); // Removed show_popup() argument
  add_element(pop, "h2", "Change fonts.");
  const frm = document.createElement("form");
  frm.name = "formfonts";
  pop.appendChild(frm);
  add_element(frm, "p", "Font Size: "+
    "<input name=\"txtfontsize\" type=\"text\" size=5 value=\"" +
    get_fontsize() + "\">");
  add_element(frm, "p", "(Select a value between 50 and 500 - the "+
    "default size is 100.)");
  add_element(frm, "p", "Font Family: "+
    "<input name=\"txtfontfamily\" type=\"text\" size=20 value=\"\">");
  add_element(frm, "p", "(Select a font that is supported by your "+
    "browser, or leave empty for the current font.)");
  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_font();";
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);
  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");
  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();";
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function change_font() {
  const k_input = (document.getElementsByName("txtfontsize")[0] as HTMLInputElement)?.value;
  const k = parseInt(k_input || "100"); // Provide a default if input not found or empty
  if (k < 50 || k > 500) {
    alert("Please select a size between 50 and 500.");
    return;
  }

  set_fontsize(k);
  const s_input = (document.getElementsByName("txtfontfamily")[0] as HTMLInputElement)?.value;
  const s = s_input || ""; // Provide a default if input not found or empty
  if (s != "")
    DecafMUD.instances[0].ui.el_display.style.fontFamily = "'" + s + "', Consolas, "+
          "Courier, 'Courier New', 'Andale Mono', Monaco, monospace";
  close_popup();
  DecafMUD.instances[0].ui.display.scroll();
  DecafMUD.instances[0].ui.input.focus();
}

function menu_macros() {
  const pop = popup_textdiv(); // Removed show_popup() argument

  add_element(pop, "p", "Decafmud supports both F-key macro's "+
    "(you need to use the mud's alias system to use them, for "+
    "example <tt>alias f1 score</tt>), and numpad navigation (you "+
    "need to turn numlock on for this to work).");
  const frm = document.createElement("form");
  frm.name = "formmacros";
  pop.appendChild(frm);
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cfkey\" " +
    (fkeymacros ? "checked" : "") + "/>Enable f-key macros.");
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cnumpad\" "+
    (numpadwalking ? "checked" : "") + "/>Enable numpad navigation.");
  const savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_macros();";
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);
  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");
  const closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();";
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function menu_history_flush() {
  DecafMUD.instances[0].ui.display.clear();
}

function change_macros() {
  const fkey_checkbox = document.getElementsByName("cfkey")[0] as HTMLInputElement;
  const nump_checkbox = document.getElementsByName("cnumpad")[0] as HTMLInputElement;
  const fkey = fkey_checkbox?.checked || false;
  const nump = nump_checkbox?.checked || false;
  toggle_fkeys(fkey);
  toggle_numpad(nump);
  close_popup();
}

function menu_progressbars() {
  if (progress_visible()) toggle_progressbars(false);
  else toggle_progressbars(true);
}

function menu_map() {
  if (showmap) {
    toggle_map(false);
    alert("Warning: the map will automatically reappear when the "+
      "mud sends it.  To stop the side-map, change your settings "+
      "in options output map.");
    const p = document.getElementById("submenu_options");
    const c = document.getElementById("submenu_options_map");
    if (p && c) { // Add null check
        p.removeChild(c);
    }
  }
}

function menu_features() {
  // create the popup
  const pop = popup_textdiv(); // Removed show_popup() argument
  // show the necessary help
  let el: HTMLElement; // Explicitly type el
  add_element(pop, "h2", "Client Features");
  add_element(pop, "p", "Decafmud is a basic mud client, "+
    "with just a few features.");
  el = document.createElement("ul"); // el is assigned here
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
  // add end with a closing button
  add_close_button(button_line(pop));
}

function menu_about() {
  DecafMUD.instances[0].about();
}

/**
 * ===========================================
 * Functionality for the troubleshooting menu.
 * ===========================================
 */

function menu_trouble() {
  window.open("help.html", "Troubleshooting", "width=800,height=400,resizable=yes,scrollbar=yes,toolbar=yes,menubar=no,location=no,directories=no,status=no");
}
