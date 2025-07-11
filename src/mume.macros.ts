/**
 * This file defines a number of standard macros.
 *
 * This file is originally from Discworld.
 */

// This function will be imported and called by MumePlayPlugin
export function tryExtraMacro(keycode: number, sendFunction: (command: string) => void): number {
  // f-key macros
  if (112 <= keycode && keycode <= 121 && fkeys_enabled()) {
    const cmd = "f" + (keycode-111);
    sendFunction(cmd);
    return 1;
  }

  // numpad walking
  if (numpad_enabled()) {
    switch (keycode) {
      case 96:  sendFunction("kp0");     return 1;
      case 97:  sendFunction("kp1");     return 1;
      case 98:  sendFunction("south");   return 1;
      case 99:  sendFunction("kp3");     return 1;
      case 100: sendFunction("west");    return 1;
      case 101: sendFunction("kp5");     return 1;
      case 102: sendFunction("east");    return 1;
      case 103: sendFunction("kp7");     return 1;
      case 104: sendFunction("north");   return 1;
      case 105: sendFunction("kp9");     return 1;
      case 106: sendFunction("kpstar");  return 1;
      case 107: sendFunction("kpplus");  return 1;
      case 109: sendFunction("kpminus"); return 1;
      case 110: sendFunction("kpdot");   return 1;
      case 111: sendFunction("kpslash"); return 1;
    }
  }

  // don't allow the tab key to do anything!
  if (keycode == 9) return 1; // This was a comment, but it's functional code

  // anything else (not handled)
  return 0;
}
