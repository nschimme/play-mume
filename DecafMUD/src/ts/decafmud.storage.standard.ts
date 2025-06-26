/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules
 */

import { DecafMUD, DecafMUDStorage } from "./decafmud";

class StandardStorage implements DecafMUDStorage {
    private decaf: DecafMUD;
    private path: string;
    private children: StandardStorage[] = [];

    constructor(decafOrParentStorage: DecafMUD | StandardStorage, path?: string) {
        if (typeof window === 'undefined' || !('localStorage' in window)) {
            // Not throwing an error here as DecafMUD core might handle it or run in environments without localStorage.
            // The original code throws, but for broader compatibility, a warning might be better,
            // or DecafMUD itself should check this before attempting to instantiate.
            // For now, let's assume DecafMUD handles the check or this plugin won't be used if localStorage is absent.
            // If DecafMUD requires a storage plugin, it should have a fallback or error gracefully.
            console.error("StandardStorage: localStorage is not available. This storage backend will not function.");
            // To prevent errors if methods are called, we could make decaf a dummy object,
            // but that might hide issues. Let's proceed, assuming it won't be used if localStorage is missing.
        }

        this.path = (path || '') + '/';

        if (decafOrParentStorage instanceof StandardStorage) {
            // Creating a sub-storage
            this.decaf = decafOrParentStorage.decaf;
            decafOrParentStorage.children.push(this);
        } else {
            // Creating a root storage for a DecafMUD instance
            this.decaf = decafOrParentStorage;
            // In the original JS, this was stored on decaf.loaded_plugs.storage
            // For TS, direct instantiation by DecafMUD core is cleaner.
            // However, to maintain compatibility with how DecafMUD core initializes plugins:
            if (!(this.decaf as any).loaded_plugs) { (this.decaf as any).loaded_plugs = {}; }
            (this.decaf as any).loaded_plugs.storage = this;

        }
    }

    get<T = any>(key: string, def?: T): T | undefined {
        if (typeof window === 'undefined' || !window.localStorage) return def;
        try {
            const val = window.localStorage.getItem(this.path + key);
            if (val === undefined || val === null) {
                return def;
            }
            return JSON.parse(val) as T;
        } catch (e) {
            this.decaf.debugString(`Error parsing localStorage key ${this.path + key}: ${e}`, 'error');
            return def;
        }
    }

    set(key: string, val: any): void {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            // Original code had a specific string handling, JSON.stringify handles strings correctly by double-quoting them.
            window.localStorage.setItem(this.path + key, JSON.stringify(val));
        } catch (e) {
            this.decaf.debugString(`Error setting localStorage key ${this.path + key}: ${e}`, 'error');
            // Handle potential quota exceeded errors, etc.
        }
    }

    del(key: string): void { // Original returned the result of delete, which is usually true/false
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.removeItem(this.path + key);
    }

    sub(name: string): StandardStorage {
        return new StandardStorage(this, this.path + name);
    }

    keys(): string[] {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        const out: string[] = [];
        const pathPrefix = this.path;
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(pathPrefix)) {
                out.push(k.substring(pathPrefix.length));
            }
        }
        return out;
    }

    // This method was in the original JS, used for changing paths,
    // potentially if the root path for storage needed to change.
    change(newBasePath: string): void {
        const oldPathPrefix = this.path;
        this.path = newBasePath + '/';

        for (const child of this.children) {
            // Construct the new path for the child relative to the new parent path
            // Child's path was relative to the old parent path.
            // Example: old parent path = "root/", child path = "root/plugin/"
            // new parent path = "newRoot/", child's part = "plugin/"
            // new child path = "newRoot/plugin/"
            const childRelativePath = child.path.substring(oldPathPrefix.length, child.path.length -1); // Get 'plugin'
            child.change(this.path + childRelativePath); // Pass "newRoot/plugin"
        }
        // Note: This does not migrate data in localStorage, only updates paths for future access.
        // Data migration would require iterating keys, reading, deleting old, and writing new.
    }
}

// Expose to DecafMUD
if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins && DecafMUD.plugins.Storage) {
    DecafMUD.plugins.Storage.standard = StandardStorage as any;
}

export { StandardStorage };
