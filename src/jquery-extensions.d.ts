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
