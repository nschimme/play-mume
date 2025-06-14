// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD Storage Provider: Standard
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

import DecafMUD from './decafmud';
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) {

class Storage {
    path: string;
    decaf: DecafMUDInstance | Storage; // Can be DecafMUD instance or another Storage instance for sub-storages
    children: Storage[] = [];

    constructor(decaf: DecafMUDInstance | Storage, path?: string) {
        if ( path === undefined ) { path = ''; }
        this.path = path + '/';

        this.decaf = decaf;
        if ( decaf instanceof Storage ) {
            // If decaf is a Storage instance, this is a sub-storage.
            // The actual DecafMUD instance is decaf.decaf in that case.
            (decaf as Storage).children.push(this);
        }
        // For top-level storage, this.decaf is already the DecafMUDInstance.

        if ( !('localStorage' in window) ) {
            const decafInstance = (this.decaf instanceof Storage) ? (this.decaf.decaf as DecafMUDInstance) : this.decaf;
            if (decafInstance && decafInstance.error) {
                 decafInstance.error("localStorage is not available in this browser. Settings will not be saved.");
            } else {
                console.error("localStorage is not available. Settings will not be saved.");
            }
            // Depending on desired behavior, you might want to throw an error or use a fallback.
            // For now, operations will likely fail if localStorage is truly unavailable.
        }
    }

    get(key: string, def?: any): any {
        try {
            const val = window.localStorage[this.path + key];
            if ( val === undefined || val === null ) { return def; }
            return JSON.parse(val);
        } catch (e) {
            // console.warn(`Error parsing localStorage item ${this.path + key}:`, e);
            return def;
        }
    }

    set(key: string, val: any): void {
        try {
            const valueToStore = JSON.stringify(val);
            window.localStorage[this.path + key] = valueToStore;
        } catch (e) {
            // console.error(`Error setting localStorage item ${this.path + key}:`, e);
        }
    }

    del(key: string): boolean {
        try {
            delete window.localStorage[this.path + key];
            return true;
        } catch (e) {
            // console.error(`Error deleting localStorage item ${this.path + key}:`, e);
            return false;
        }
    }

    sub(name: string): Storage {
        return new Storage(this, this.path + name);
    }

    keys(): string[] {
        const out: string[] = [];
        const p: string = this.path;
        try {
            for(let i=0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if ( k && k.indexOf(p) === 0 ) { // Check if k is not null and starts with path
                    out.push(k.substr(p.length));
                }
            }
        } catch (e) {
            // console.error("Error retrieving keys from localStorage:", e);
        }
        return out;
    }

    change(path: string): void {
        const oldp: string = this.path;
        this.path = path + '/';

        for(let i=0; i < this.children.length; i++) {
            const child = this.children[i];
            const newChildPath = this.path + child.path.substr(oldp.length);
            child.change(newChildPath.substr(0, newChildPath.length-1)); // Remove trailing slash for child's change method
        }
    }
}

// Expose this to DecafMUD
(DecafMUDGlobal as any).plugins.Storage.standard = Storage;

})(DecafMUD);
