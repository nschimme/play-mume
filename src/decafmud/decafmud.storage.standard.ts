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

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUD as DecafMUDInstance } from './decafmud'; // Hypothetical
// For now, use 'any' for DecafMUD instance type if not fully defined/imported.

(function(DecafMUD: any) {

interface DecafMUDInstanceInterface {
    // Define properties/methods of DecafMUD instance that StandardStorage might use
    // For now, this is minimal or can be 'any' if details are unknown
}

class StandardStorage {
    public path: string;
    private decaf: DecafMUDInstanceInterface; // Should be the type of a DecafMUD instance
    private children: StandardStorage[] = [];

    constructor(decafOrParentStorage: DecafMUDInstanceInterface | StandardStorage, path?: string) {
        if (path === undefined) { path = ''; }
        this.path = path + '/';

        if (decafOrParentStorage instanceof StandardStorage) {
            this.decaf = decafOrParentStorage.decaf;
            decafOrParentStorage.children.push(this);
        } else {
            this.decaf = decafOrParentStorage;
        }

        if (!('localStorage' in window)) {
            throw new Error("This storage backend can only be used in browsers supporting localStorage.");
        }
    }

    public get<T = any>(key: string, def?: T): T | undefined {
        const val = window.localStorage[this.path + key];
        if (val === undefined || val === null) { return def; }
        try {
            return JSON.parse(val) as T;
        } catch (e) {
            // If parsing fails, it might not be JSON; return as is or handle error
            // console.warn(`Failed to parse localStorage item ${this.path + key}:`, e);
            return val as any; // Or return def, or throw error, depending on desired behavior
        }
    }

    public set(key: string, val: any): void {
        let valueToStore: string;
        if (typeof val === "string") {
            // Storing plain strings directly without extra quotes, JSON.stringify will handle it
            valueToStore = JSON.stringify(val);
        } else {
            valueToStore = JSON.stringify(val);
        }
        window.localStorage[this.path + key] = valueToStore;
    }

    public del(key: string): boolean {
        // `delete` operator returns true if deletion is successful, or if property doesn't exist.
        // It returns false only if the property is an own non-configurable property.
        // For localStorage, this should generally work as expected.
        delete window.localStorage[this.path + key];
        return true; // Or check if it still exists: !window.localStorage[this.path + key]
    }

    public sub(name: string): StandardStorage {
        return new StandardStorage(this, this.path + name);
    }

    public keys(): string[] {
        const out: string[] = [];
        const p: string = this.path;
        for (let i = 0; i < window.localStorage.length; i++) {
            const k: string | null = window.localStorage.key(i);
            if (k && k.startsWith(p)) { // Use startsWith for clarity
                out.push(k.substring(p.length));
            }
        }
        return out;
    }

    public change(newBasePath: string): void {
        const oldPathPrefix = this.path;
        this.path = newBasePath + '/';

        for (let i = 0; i < this.children.length; i++) {
            // The child's path relative to the old parent path
            const relativeChildPath = this.children[i].path.substring(oldPathPrefix.length);
            // New absolute path for the child
            const newChildPath = this.path + relativeChildPath;
            // Call change on child with its new base path (without trailing slash for consistency)
            this.children[i].change(newChildPath.slice(0, -1));
        }
    }
}

// Expose this to DecafMUD
(DecafMUD as any).plugins.Storage.standard = StandardStorage;
})(DecafMUD);
