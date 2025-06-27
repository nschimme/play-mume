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

import { DecafMUD } from '../../decafmud'; // Adjust path as necessary

export class StandardStorage {
    private decaf: DecafMUD;
    public path: string;
    private children: StandardStorage[] = [];

    constructor(decafOrParentStorage: DecafMUD | StandardStorage, path: string = '') {
        if (path && !path.endsWith('/')) {
            this.path = path + '/';
        } else {
            this.path = path || '/'; // Default to root if empty, ensure trailing slash
        }

        if (decafOrParentStorage instanceof StandardStorage) {
            this.decaf = decafOrParentStorage.decaf;
            decafOrParentStorage.children.push(this);
        } else {
            this.decaf = decafOrParentStorage;
        }

        if (typeof window === 'undefined' || !window.localStorage) {
            const errorMsg = "StandardStorage: localStorage is not available in this environment.";
            if (this.decaf && this.decaf.error) {
                this.decaf.error(errorMsg);
            } else {
                console.error(errorMsg);
            }
            // Depending on strictness, you might throw an error here or allow it to fail silently/gracefully later.
            // For now, it will log an error and methods will likely fail if localStorage is truly absent.
        }
    }

    public get(key: string, def?: any): any {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const val = window.localStorage.getItem(this.path + key);
                if (val === undefined || val === null) {
                    return def;
                }
                return JSON.parse(val);
            }
        } catch (e) {
            this.decaf.debugString(`Error parsing localStorage key "${this.path + key}": ${(e as Error).message}`, 'error', e);
        }
        return def; // Return default if localStorage not available or parsing fails
    }

    public set(key: string, val: any): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const valueToStore = JSON.stringify(val);
                window.localStorage.setItem(this.path + key, valueToStore);
            }
        } catch (e) {
             this.decaf.debugString(`Error setting localStorage key "${this.path + key}": ${(e as Error).message}`, 'error', e);
        }
    }

    public del(key: string): boolean {
         try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(this.path + key);
                return true;
            }
        } catch (e) {
            this.decaf.debugString(`Error deleting localStorage key "${this.path + key}": ${(e as Error).message}`, 'error', e);
        }
        return false;
    }

    public sub(name: string): StandardStorage {
        // Path for sub-storage should not start with '/', it's relative to current path
        const subPath = name.startsWith('/') ? name.substring(1) : name;
        return new StandardStorage(this, this.path + subPath);
    }

    public keys(): string[] {
        const out: string[] = [];
        if (typeof window !== 'undefined' && window.localStorage) {
            const p = this.path;
            for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k && k.startsWith(p)) {
                    out.push(k.substring(p.length));
                }
            }
        }
        return out;
    }

    public change(newBasePath: string): void {
        const oldPath = this.path;
        this.path = newBasePath.endsWith('/') ? newBasePath : newBasePath + '/';

        for (const child of this.children) {
            // Child's path relative to the old parent path
            const relativeChildPath = child.path.startsWith(oldPath) ? child.path.substring(oldPath.length) : child.path;
            // New absolute path for the child
            const newChildAbsolutePath = this.path + relativeChildPath;
            // Call change on child with its new absolute path (stripping trailing slash for consistency if change adds it)
            child.change(newChildAbsolutePath.endsWith('/') ? newChildAbsolutePath.substring(0, newChildAbsolutePath.length -1) : newChildAbsolutePath);
        }
    }
}

// Registration in decafmud.ts:
// import { StandardStorage } from './plugins/storage/standard';
// DecafMUD.plugins.Storage.standard = StandardStorage;

```
