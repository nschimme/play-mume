import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

class StandardStorage {
  private decaf: DecafMUD;
  private path: string;

  constructor(decaf: DecafMUD, path = '') {
    this.decaf = decaf;
    this.path = path ? `${path}/` : '';

    if (!('localStorage' in window)) {
      throw new Error('This storage backend requires localStorage.');
    }
  }

  public get(key: string, def?: unknown): unknown {
    const val = window.localStorage.getItem(this.path + key);
    if (val === null || val === undefined) {
      return def;
    }
    return JSON.parse(val);
  }

  public set(key: string, val: unknown): void {
    const s = JSON.stringify(val);
    window.localStorage.setItem(this.path + key, s);
  }

  public del(key: string): void {
    window.localStorage.removeItem(this.path + key);
  }

  public sub(name: string): StandardStorage {
    return new StandardStorage(this.decaf, this.path + name);
  }
}

class StandardStoragePlugin implements Plugin {
  public readonly name = 'standard';

  public install(decaf: DecafMUD): void {
    decaf.registerStorage('standard', StandardStorage);
  }
}

export const standardStoragePlugin = new StandardStoragePlugin();
