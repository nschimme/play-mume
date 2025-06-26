/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules
 */

import { DecafMUD, DecafMUDTeloptHandler } from "./decafmud";

// Telnet constants are on DecafMUD.TN
const { TN } = DecafMUD;

// Define a type for GMCP message handlers
type GMCPMessageHandler = (this: GMCPHandler, data?: any) => void;

interface GMCPPackage {
    [key: string]: GMCPPackage | GMCPMessageHandler | number | string | boolean | undefined; // Added undefined
    ' version'?: number; // Optional version for packages like Core
}

class GMCPHandler implements DecafMUDTeloptHandler {
    public pingDelay: number = 60; // seconds
    private pingAverage: number = 0;
    private pingCount: number = 0;
    private pingWhen: Date | undefined = undefined;
    private pingTimer: any | undefined = undefined; // NodeJS.Timeout or number

    // Structure for GMCP message handlers
    public packages: GMCPPackage = {
        Core: {
            ' version': 1, // Note the leading space in the original, keep if significant for matching
            Ping: (data?: any) => { // `this` will be bound by getFunction
                if (!this.pingWhen) return;
                const now = new Date();
                const rtt = now.getTime() - this.pingWhen.getTime();
                this.pingCount++;
                // Simple moving average, or just RTT? Original was cumulative average.
                this.pingAverage = Math.ceil((rtt + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);

                if (typeof window !== 'undefined' && console.debug) { // Check for console.debug
                     console.debug(('PING: {0}ms over {1} pings' as string).tr(this.decaf, this.pingAverage, this.pingCount));
                } else {
                     this.decaf.debugString(('PING: {0}ms over {1} pings' as string).tr(this.decaf, this.pingAverage, this.pingCount));
                }
            },
            Goodbye: (data?: any) => {
                this.decaf.debugString(('Reason for disconnect: {0}' as string).tr(this.decaf, data));
            }
        }
        // Other packages (Char, Room, etc.) would be added here by other plugins or configurations
    };

    constructor(public decaf: DecafMUD) {
        // Assign this instance to decaf.gmcp for easy access from other parts of the application
        // This was a common pattern in the original JS.
        (this.decaf as any).gmcp = this;

        // Ensure Core package and its handlers are correctly bound if they use `this`
        // This is implicitly handled if getFunction calls them with .call(this, ...)
    }

    /** Helper for sending GMCP messages. */
    sendGMCP(pckg: string, data?: any): void {
        let out = '';
        if (data !== undefined) {
            // JSON.stringify([data]) creates an array: "[{...}]"
            // substr(1, length-2) removes the outer brackets: "{...}"
            // This is a specific way to format the JSON part of the GMCP message.
            const jsonData = JSON.stringify(data); // Standard JSON stringify
            out = ' ' + jsonData;
        }
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.GMCP + pckg + out + TN.IAC + TN.SE);
    }

    /** Abort the ping information on disconnect. */
    _wont(): void { this.disconnect(); }
    disconnect(): void {
        clearTimeout(this.pingTimer);
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
    }

    /** Send the Core.Hello message upon connecting. */
    _will(): void {
        setTimeout(() => {
            this.sendGMCP("Core.Hello", {
                "client": "DecafMUD",
                "version": DecafMUD.version.toString()
            });
        }, 0);

        // Also, start the ping loop.
        clearTimeout(this.pingTimer); // Clear any existing timer
        this.pingTimer = setTimeout(() => { this.ping(); }, this.pingDelay * 1000);
    }

    /** Send a ping. */
    private ping(): void {
        let avg: number | undefined = undefined;
        if (this.pingCount > 0) {
            avg = this.pingAverage;
        }
        this.sendGMCP("Core.Ping", avg); // Send current average if available
        this.pingWhen = new Date();

        // Schedule a new ping.
        clearTimeout(this.pingTimer);
        this.pingTimer = setTimeout(() => { this.ping(); }, this.pingDelay * 1000);
    }

    /** Handle an incoming GMCP message. */
    _sb(data: string): boolean | void {
        // Find the end of the package name (first non-alphanumeric/dot/underscore)
        const match = data.match(/^([A-Za-z0-9._]+)(?:\s+(.*))?$/);
        let pckg: string;
        let jsonDataStr: string | undefined;
        let parsedData: any;

        if (match) {
            pckg = match[1];
            jsonDataStr = match[2];
        } else {
            // If no space, the whole data is the package name (no JSON payload)
            pckg = data;
            jsonDataStr = undefined;
        }

        if (pckg.length === 0) { return; } // No package name

        if (jsonDataStr) {
            try {
                parsedData = JSON.parse(jsonDataStr);
            } catch (e) {
                this.decaf.debugString(`GMCP: Failed to parse JSON for package ${pckg}: ${jsonDataStr}`, 'error');
                parsedData = jsonDataStr; // Pass raw string if JSON parsing fails
            }
        }

        // Debug it
        let shouldReturnTrueForDebug = true; // Default: let DecafMUD core log generic SB
        if (parsedData !== undefined && typeof window !== 'undefined' && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.decaf.id}] RCVD IAC SB GMCP "${pckg}" ... IAC SE`);
            console.dir(parsedData);
            console.groupEnd();
            shouldReturnTrueForDebug = false; // We handled detailed debug
        } else {
            // If no parsedData or no console.groupCollapsed, DecafMUD core can do basic logging
             this.decaf.debugString(`GMCP Received: ${pckg}` + (parsedData ? ` with data.` : ``) , 'info');
        }

        const func = this.getFunction(pckg);
        if (func) {
            try {
                func.call(this, parsedData); // Call with `this` as GMCPHandler instance
            } catch (e: any) {
                 this.decaf.debugString(`Error in GMCP handler for ${pckg}: ${e.message}`, 'error');
            }
        } else {
            this.decaf.debugString(`No GMCP handler for package: ${pckg}`, 'info');
        }

        return shouldReturnTrueForDebug ? undefined : false; // Return false if we did our own detailed debug
    }

    /** Command to find a given function based on package string like "Core.Char.Vitals". */
    private getFunction(pckg: string): GMCPMessageHandler | undefined {
        const parts = pckg.split('.');
        let currentLevel: any = this.packages; // Use 'any' for traversal

        for (const part of parts) {
            // Ensure currentLevel is an object and has the part before trying to access
            if (typeof currentLevel !== 'object' || currentLevel === null || !Object.prototype.hasOwnProperty.call(currentLevel, part)) {
                return undefined;
            }
            currentLevel = currentLevel[part];
        }

        if (typeof currentLevel === 'function') {
            return currentLevel as GMCPMessageHandler;
        }
        return undefined; // Path led to a non-function or was incomplete
    }
}

// Expose it to DecafMUD
// The Telopt key for GMCP is t.GMCP (which is \xC9)
if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins && DecafMUD.plugins.Telopt && DecafMUD.TN) {
    DecafMUD.plugins.Telopt[DecafMUD.TN.GMCP] = GMCPHandler as any;
}

export { GMCPHandler };
