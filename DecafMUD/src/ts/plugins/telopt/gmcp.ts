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

import { DecafMUD } from '../../decafmud'; // Assuming DecafMUD class is exported from here
import { TN } from '../../telnetConstants'; // Import TN from telnetConstants

// Helper type for GMCP package structure
interface GmcpPackage {
    [key: string]: any | GmcpPackage | ((this: GmcpTelopt, data?: any) => void);
}

/** Handles the TELNET option GMCP.
 * @name GmcpTelopt
 * @class DecafMUD TELOPT Handler: GMCP
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
export class GmcpTelopt {
    private decaf: DecafMUD;
    public pingDelay: number = 60; // seconds
    public pingAverage: number = 0;
    public pingCount: number = 0;
    private pingWhen?: Date;
    private pingTimer?: ReturnType<typeof setTimeout>; // For Node.js timer type

    public packages: GmcpPackage = {
        Core: {
            ' version': 1, // Note: leading space in original, keep if significant for server

            Ping: (data?: any) => { // Arrow function to preserve 'this' if needed, or ensure called with .call/.apply
                if (!this.pingWhen) return;
                const n = new Date().getTime() - this.pingWhen.getTime();
                this.pingCount++;
                this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);
                // console.debug not standard, use decaf.debugString or a proper logger
                this.decaf.debugString(`GMCP Ping Reply: ${this.pingAverage}ms over ${this.pingCount} pings`);
            },

            Goodbye: (data?: any) => {
                this.decaf.debugString(`GMCP Core.Goodbye: Server disconnected. Reason: ${data}`);
            }
        }
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        (this.decaf as any).gmcp = this; // Keep the dynamic assignment for now if other parts rely on it
                                      // Consider a more typed approach later if possible.
    }

    /** Helper for sending GMCP messages. */
    public sendGMCP(pckg: string, data?: any): void {
        let out = '';
        if (data !== undefined) {
            // JSON.stringify([data]) then substr seems odd, usually it's just JSON.stringify(data)
            // However, sticking to original logic:
            let jsonData = JSON.stringify([data]);
            out = ' ' + jsonData.substring(1, jsonData.length - 2);
        }
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.GMCP + pckg + out + TN.IAC + TN.SE);
    }

    /** Abort the ping information on disconnect. */
    public _wont(): void { this.disconnect(); }
    public disconnect(): void {
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
            this.pingTimer = undefined;
        }
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
    }

    /** Send the Core.Hello message upon connecting. */
    public _will(): void {
        setTimeout(() => {
            this.sendGMCP("Core.Hello", {
                "client": "DecafMUD",
                "version": DecafMUD.version.toString() // Access static version
            });
        }, 0);

        // Also, start the ping loop.
        if (this.pingTimer) clearTimeout(this.pingTimer); // Clear existing timer if any
        this.pingTimer = setTimeout(() => { this.ping(); }, this.pingDelay * 1000);
    }

    /** Send a ping. */
    public ping(): void {
        let avg: number | undefined = undefined;
        if (this.pingCount > 0) { avg = this.pingAverage; }
        this.sendGMCP("Core.Ping", avg);
        this.pingWhen = new Date();

        // Schedule a new ping.
        if (this.pingTimer) clearTimeout(this.pingTimer);
        this.pingTimer = setTimeout(() => { this.ping(); }, this.pingDelay * 1000);
    }

    /** Handle an incoming GMCP message. */
    public _sb(data: string): boolean {
        let ind = data.search(/[^A-Za-z0-9._]/);
        let ret = false;
        let pckg: string;
        let jsonData: string | undefined;
        let parsedData: any;

        if (ind !== -1) {
            pckg = data.substring(0, ind);
            jsonData = data.substring(ind).trim(); // Get the rest and trim
            if (jsonData.length > 0) {
                try {
                    // Original was JSON.parse('['+data.substr(ind+1)+']')[0];
                    // This implies the data after package name is not a valid JSON array item itself.
                    // e.g. "Package.Name {\"key\": \"value\"}"
                    // A more robust way:
                    parsedData = JSON.parse(jsonData);
                } catch (e) {
                    this.decaf.debugString(`GMCP Error: Could not parse JSON data for package ${pckg}: ${jsonData}`, 'error', e);
                    return true; // Stop processing this malformed SB
                }
            }
        } else {
            pckg = data;
        }

        if (pckg.length === 0) { return true; } // Nothing to do

        if (parsedData !== undefined && typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.decaf.id}] RCVD IAC SB GMCP "${pckg}" ... IAC SE`);
            console.dir(parsedData);
            console.groupEnd();
        } else {
            // If console.groupCollapsed is not available, or no JSON data, this makes debugIAC log it.
            ret = true;
        }

        const func = this.getFunction(pckg);

        if (func) {
            // Ensure 'this' context is correct when calling the package handler
            func.call(this, parsedData);
        } else {
            this.decaf.debugString(`GMCP: No handler for package ${pckg}`);
        }

        return ret; // Original returned true if no console.groupCollapsed, false otherwise
    }

    /** Command to find a given function from the package structure. */
    private getFunction(pckg: string): ((this: GmcpTelopt, data?: any) => void) | undefined {
        const parts = pckg.split('.');
        let currentLevel: GmcpPackage | Function = this.packages;

        for (const part of parts) {
            if (typeof currentLevel === 'function' || !(part in currentLevel)) {
                return undefined;
            }
            currentLevel = currentLevel[part];
        }

        if (typeof currentLevel === 'function') {
            return currentLevel as (this: GmcpTelopt, data?: any) => void;
        }
        return undefined;
    }

    // Example of how a new package might be added by another module/plugin if needed
    // This would typically be done via a public method on GmcpTelopt if designed for extensibility
    public static addGmcpPackage(path: string, handler: any, decafInstance: DecafMUD): void {
        if ((decafInstance as any).gmcp && (decafInstance as any).gmcp instanceof GmcpTelopt) {
            const gmcpHandler = (decafInstance as any).gmcp as GmcpTelopt;
            const parts = path.split('.');
            let current = gmcpHandler.packages;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part] as GmcpPackage;
            }
            current[parts[parts.length - 1]] = handler.bind(gmcpHandler); // Bind to maintain 'this' context
            gmcpHandler.decaf.debugString(`GMCP: Registered external package ${path}`);
        } else {
            decafInstance.debugString(`GMCP: Could not register external package ${path}, GMCP handler not initialized.`, "warn");
        }
    }
}

// The registration will be handled in decafmud.ts by importing this class
// and assigning it to DecafMUD.plugins.Telopt[TN.GMCP].
// No direct DecafMUD.plugins.Telopt[TN.GMCP] = GmcpTelopt; here.

// Note on `(this.decaf as any).gmcp = this;`:
// This creates a circular reference and uses a dynamic property `gmcp` on the DecafMUD instance.
// A cleaner way might be for DecafMUD core to hold a typed reference to the GMCP handler instance
// if it needs to call methods on it, or use an event-based system.
// For now, retaining original pattern to minimize initial refactoring impact.
// Consider improving this when refactoring DecafMUD core interaction with telopt handlers.
// The static `DecafMUD.version` is also now `DecafMUD.version`.
// The `tr` function was removed, so string formatting needs to be done directly.
// `console.debug` and `console.dir` are browser-specific debug tools; using `decaf.debugString` for consistency.
