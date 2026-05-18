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

// Adapted from MMapper2: the result must be identical for the hashes to match
export function translitUnicodeToAsciiLikeMMapper(unicode: string): string {
  const table = [
    /*192*/ 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I',
    /*208*/ 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'x', 'O', 'U', 'U', 'U', 'U', 'Y', 'b', 'B',
    /*224*/ 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i',
    /*248*/ 'o', 'n', 'o', 'o', 'o', 'o', 'o', ':', 'o', 'u', 'u', 'u', 'u', 'y', 'b', 'y',
  ];

  let ascii = "";
  for (const charString of unicode) {
    const ch = charString.charCodeAt(0);
    if (ch > 128) {
      if (ch < 192)
        ascii += "z"; // sic
      else
        ascii += table[ch - 192];
    } else {
      ascii += charString;
    }
  }

  return ascii;
}

export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

export const DIRECTIONS = ["NORTH", "SOUTH", "EAST", "WEST", "UP", "DOWN", "UNKNOWN", "NONE"];

export enum Dir { // Must match MM2's defs.
  NORTH = 0,
  SOUTH = 1,
  EAST = 2,
  WEST = 3,
  LAST_GROUND_DIR = WEST,
  UP = 4,
  DOWN = 5,
  UNKNOWN = 6,
  NONE = 7,
}
