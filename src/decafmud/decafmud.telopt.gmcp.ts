// SPDX-License-Identifier: MIT
/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD TELOPT Handler: GMCP
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// Assuming DecafMUD is globally available or imported.
// import type { DecafMUD as DecafMUDInstance, DecafMUDStatic } from './decafmud'; // Hypothetical
// For now, use 'any' for DecafMUD type if not directly available/imported.

(function(DecafMUD: any) {

// Shortcut the TELNET constants for ease of use.
const t = DecafMUD.TN;

interface DecafMUDInstanceInterface { // Minimal interface for what GMCP needs
    gmcp: any; // Reference to this GMCP instance
    sendIAC: (data: string) => void;
    debugString: (message: string, type?: string, obj?: any) => void;
    id: number; // For debugging
    [key: string]: any; // Allow other properties from DecafMUD instance
}

interface GMCPPackage {
    [key: string]: GMCPPackage | ((this: GMCP, data?: any) => void) | number | string;
}

class GMCP {
    private decaf: DecafMUDInstanceInterface;
    public pingDelay: number = 60; // seconds
    public pingAverage: number = 0;
    public pingCount: number = 0;
    public pingWhen: Date | undefined = undefined;
    public pingTimer: number | undefined = undefined; // Stores timeout ID

    public packages: { Core?: GMCPPackage } & GMCPPackage = {};


    constructor(decaf: DecafMUDInstanceInterface) {
        this.decaf = decaf;
        this.decaf.gmcp = this; // DecafMUD instance holds a reference to this GMCP handler

        this.packages.Core = {
            ' version': 1, // Note: leading space in original, kept for compatibility
            'Ping': (data?: any) => { // Explicitly type 'this' if it refers to GMCP instance
                if (!this.pingWhen) return;
                const n = new Date().getTime() - this.pingWhen.getTime();
                this.pingCount++;
                this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);
                console.debug('PING: {0}ms over {1} pings'.tr(this.decaf as any, this.pingAverage, this.pingCount));
            },
            'Goodbye': (data?: any) => {
                this.decaf.debugString('Reason for disconnect: {0}'.tr(this.decaf as any, data));
            }
        };
    }

    public sendGMCP(pckg: string, data?: any): void {
        let out: string = '';
        if (data !== undefined) {
            // JSON.stringify will handle single values, arrays, or objects.
            // The original code stringifies an array `[data]` then removes brackets.
            // This is equivalent to just stringifying `data` if `data` is not an array/object needing brackets.
            // If `data` is a simple string or number, `JSON.stringify([data])` -> `["somestring"]` -> `"somestring"`
            // If `data` is an object, `JSON.stringify([data])` -> `[{"key":"val"}]` -> `{"key":"val"}`
            // So, the original logic seems to ensure the payload is the content of a single-element array.
            // Let's replicate carefully:
            let jsonData = JSON.stringify([data]);
            out = ' ' + jsonData.substring(1, jsonData.length - 1);
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.GMCP + pckg + out + t.IAC + t.SE);
    }

    public _wont(): void { // Typically called by Telopt handler
        this.disconnect();
    }
    public disconnect(): void { // Called on disconnect or WONT
        if (this.pingTimer !== undefined) clearTimeout(this.pingTimer);
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
    }

    public _will(): void { // Typically called by Telopt handler
        const g = this;
        setTimeout(function() {
            g.sendGMCP("Core.Hello", {
                "client": "DecafMUD",
                "version": DecafMUD.version.toString()
            });
        }, 0);

        // Also, start the ping loop
        if (this.pingTimer !== undefined) clearTimeout(this.pingTimer); // Clear existing timer
        this.pingTimer = window.setTimeout(function() { g.ping(); }, this.pingDelay * 1000);
    }

    public ping(): void {
        let avg: number | undefined = undefined;
        if (this.pingCount > 0) { avg = this.pingAverage; }
        this.sendGMCP("Core.Ping", avg);
        this.pingWhen = new Date();

        // Schedule a new ping
        if (this.pingTimer !== undefined) clearTimeout(this.pingTimer);
        const g = this;
        this.pingTimer = window.setTimeout(function() { g.ping(); }, this.pingDelay * 1000);
    }

    public _sb(data: string): boolean {
        const ind: number = data.search(/[^A-Za-z0-9._]/);
        let ret: boolean = false;
        let pckg: string;
        let out: any; // Data part of the GMCP message

        if (ind !== -1) {
            pckg = data.substring(0, ind);
            if (ind + 1 < data.length) { // Check if there is data after package name
                try {
                    // The original JSON.parse('['+data.substr(ind+1)+']')[0] is a bit unusual.
                    // It wraps the data part in an array, parses it, then takes the first element.
                    // This implies the data part itself should be a valid JSON value (string, number, object, array).
                    out = JSON.parse(data.substring(ind + 1).trim());
                } catch (e: any) {
                    this.decaf.debugString(`GMCP: Error parsing JSON data for package ${pckg}: ${data.substring(ind + 1)}`, 'error', e.message);
                    return true; // Error occurred, but we handled it by logging.
                }
            }
        } else {
            pckg = data;
        }

        if (!pckg || pckg.length === 0) { return true; } // Nothing to do

        if (out !== undefined && 'console' in window && (console as any).groupCollapsed) {
            (console as any).groupCollapsed('DecafMUD[' + this.decaf.id + '] RCVD IAC SB GMCP "' + pckg + '" ... IAC SE');
            console.dir(out);
            console.groupEnd();
        } else {
            // If no console.groupCollapsed, or no 'out', we might still want to log the raw package if debugIAC is available
            // this.decaf.debugString('RCVD GMCP: ' + pckg + (out ? ' with data' : ''));
            ret = true; // Indicate that default debug logging might be needed if specific logging didn't happen
        }

        const func = this.getFunction(pckg);
        if (func) {
            func.call(this, out); // Call the handler with 'this' as GMCP instance
        }
        return ret;
    }

    public getFunction(pckg: string): ((this: GMCP, data?: any) => void) | undefined {
        const parts: string[] = pckg.split('.');
        let currentLevel: any = this.packages;

        for (const part of parts) {
            if (currentLevel[part] === undefined) { return undefined; }
            currentLevel = currentLevel[part];
        }

        if (typeof currentLevel === 'function') {
            return currentLevel as (this: GMCP, data?: any) => void;
        }
        return undefined;
    }
}

// Expose it to DecafMUD
(DecafMUD as any).plugins.Telopt[t.GMCP] = GMCP;
//DecafMUD.plugins.Telopt.gmcp = true; // This line seems redundant if the above line works.
})(DecafMUD);
