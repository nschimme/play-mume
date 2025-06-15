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

// src/jquery-extensions.d.ts
import 'jquery'; // Ensure we are augmenting the JQueryStatic from the 'jquery' module

declare global {
  interface JQueryStatic {
    throttle<T extends (...args: any[]) => any>(
      delay: number,
      noTrailing: boolean | T, // Can be boolean or the callback
      callback?: T,            // Callback if noTrailing was boolean
      debounceMode?: boolean
    ): T;

    throttle<T extends (...args: any[]) => any>(
      delay: number,
      callback: T,
      debounceMode?: boolean
    ): T;

    // Add debounce if it's also used and shows similar errors.
    // For now, only throttle is explicitly mentioned in the errors.
    // debounce<T extends (...args: any[]) => any>(
    //   delay: number,
    //   atBegin?: boolean | T, // Can be boolean or the callback
    //   callback?: T
    // ): T;
    // debounce<T extends (...args: any[]) => any>(
    //   delay: number,
    //   callback: T
    // ): T;
  }
}

// Export an empty object to make this file a module.
// This can sometimes help ensure the augmentations are applied correctly.
export {};
