/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { DecafMUDStorage } from './types';

export class StandardStorage implements DecafMUDStorage {
  public path: string;
  private children: StandardStorage[] = [];

  constructor(parentOrPath?: StandardStorage | string, path?: string) {
    if (parentOrPath instanceof StandardStorage) {
      this.path = (path || '') + '/';
      parentOrPath.children.push(this);
    } else {
      const p = typeof parentOrPath === 'string' ? parentOrPath : '';
      this.path = p ? p + '/' : '';
    }

    if (typeof window !== 'undefined' && !('localStorage' in window)) {
      console.warn('localStorage is not supported in this environment.');
    }
  }

  public get<T = unknown>(key: string, def?: T): T {
    if (typeof window === 'undefined' || !window.localStorage) return def as T;
    const val = window.localStorage.getItem(this.path + key);
    if (val === undefined || val === null) return def as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return def as T;
    }
  }

  public set<T = unknown>(key: string, val: T): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const jsonVal = typeof val === 'string' ? JSON.stringify(val) : JSON.stringify(val);
    window.localStorage.setItem(this.path + key, jsonVal);
  }

  public del(key: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(this.path + key);
    return true;
  }

  public sub(name: string): DecafMUDStorage {
    return new StandardStorage(this, this.path + name);
  }

  public keys(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const out: string[] = [];
    const p = this.path;
    const len = window.localStorage.length;
    for (let i = 0; i < len; i++) {
      const k = window.localStorage.key(i);
      if (k && k.indexOf(p) === 0) {
        out.push(k.substring(p.length));
      }
    }
    return out;
  }

  public change(newPath: string): void {
    const old = this.path;
    this.path = newPath + '/';
    for (const child of this.children) {
      const nw = this.path + child.path.substring(old.length);
      child.change(nw.substring(0, nw.length - 1));
    }
  }
}
