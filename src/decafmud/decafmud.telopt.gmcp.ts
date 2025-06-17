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

import { IDecafMUD, IGMCP } from './decafmud.types';

// Ensure DecafMUD_Global is defined for plugin registration, or use window.DecafMUD
declare var DecafMUD_Global: any;

class TeloptGMCP implements IGMCP {
    public decaf: IDecafMUD;

    public pingDelay: number;
    public pingAverage: number;
    public pingCount: number;
    public pingWhen?: Date;
    public pingTimer?: any; // NodeJS.Timeout or number for browser

    public packages: {
        Core: {
            ' version': number; // Note the space from original
            Ping: (data?: any) => void;
            Goodbye: (data?: any) => void;
            [key: string]: any;
        };
        [key: string]: any;
    };

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
        this.decaf.gmcp = this;

        this.pingDelay = 60;
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
        this.pingTimer = undefined;

        // Initialize packages structure
        this.packages = {
            Core: {
                ' version': 1,
                Ping: (data?: any) => {
                    if (!this.pingWhen) return;
                    const n: number = new Date().getTime() - this.pingWhen.getTime();
                    this.pingCount++;
                    this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);
                    if (this.decaf.debugString) {
                        this.decaf.debugString(`PING: ${this.pingAverage}ms over ${this.pingCount} pings`, 'gmcp');
                    } else {
                        console.debug(`GMCP PING: ${this.pingAverage}ms over ${this.pingCount} pings`);
                    }
                },
                Goodbye: (data?: any) => {
                    if (this.decaf.debugString) {
                        this.decaf.debugString(`Reason for disconnect: ${data}`, 'gmcp');
                    } else {
                        console.log(`GMCP Goodbye: Reason for disconnect: ${data}`);
                    }
                }
            }
        };
    }

/** Helper for sending GMCP messages. */
    public sendGMCP(pckg: string, data?: any): void {
        const TN = (this.decaf.constructor as any).TN;
        let out_data_str = '';
        if (data !== undefined) {
            const arrStr = JSON.stringify([data]);
            out_data_str = ' ' + arrStr.substring(1, arrStr.length - 1);
        }
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.GMCP + pckg + out_data_str + TN.IAC + TN.SE);
    }

/** Abort the ping information on disconnect. */
    public disconnect(): void {
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
            this.pingTimer = undefined;
        }
        this.pingAverage = 0;
        this.pingCount = 0;
    }

    public _wont(d?: string): void { this.disconnect(); }

/** Send the Core.Hello message upon connecting. */
    public _will(d?: string): void {
        setTimeout(() => {
            this.sendGMCP("Core.Hello", {
                "client": "DecafMUD",
                "version": (this.decaf.constructor as any).version.toString()
            });
        }, 0);

        // Also, start the ping loop.
        if (this.pingTimer) clearTimeout(this.pingTimer);
        this.pingTimer = setTimeout(() => { this.ping(); }, this.pingDelay * 1000);
    }

    public _do(data?: string): void { /* Not implemented */ }
    public _dont(data?: string): void { /* Not implemented */ }

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
    public _sb(data: string): boolean | void {
	// Find the end of the package.
	var ind = data.search(/[^A-Za-z0-9._]/), ret = false, pckg: string, out: any;
	if ( ind !== -1 ) {
		pckg = data.substr(0, ind);
        let jsonDataStr: string | undefined;
        if (ind + 1 <= data.length -1) {
            jsonDataStr = data.substring(ind).trim();
        }
        if (jsonDataStr && jsonDataStr.length > 0) {
            try {
                out = JSON.parse(jsonDataStr);
            } catch (e: any) {
                if (this.decaf.debugString) {
                    this.decaf.debugString(`GMCP JSON parse error for package ${pckg}: ${e.message || e}`, 'error');
                    this.decaf.debugString(`GMCP problematic data: ${jsonDataStr}`, 'error');
                } else {
                    console.error(`GMCP JSON parse error for package ${pckg}: ${e.message || e}`);
                    console.error(`GMCP problematic data: ${jsonDataStr}`);
                }
                return; // Don't process further
            }
        }
	} else { pckg = data; }

	// If there's no package, return.
	if ( pckg.length === 0 ) { return; }

	// Debug it.
    if (this.decaf.debugString) {
        this.decaf.debugString(`RCVD IAC SB GMCP "${pckg}"`, 'gmcp', out);
    } else if ( out !== undefined && typeof window !== 'undefined' && window.console && console.groupCollapsed ) {
		console.groupCollapsed('DecafMUD['+this.decaf.id+'] RCVD IAC SB GMCP "'+pckg+'" ... IAC SE');
		console.dir(out);
		console.groupEnd();
	} else { ret = true; }

	// Get the function
	var func = this.getFunction(pckg);

	// Call it.
	if ( func ) { func.call(this, out); }

	return ret; // We print our own debug info.
}

/** Command to find a given function. */
    public getFunction(pckg: string): Function | undefined {
        const parts: string[] = pckg.split('.');
        let current: any = this.packages;
        while (parts.length > 0) {
            const part: string = parts.shift()!;
            if (current[part] === undefined) { return undefined; }
            current = current[part];
        }

        if (typeof current === 'function') {
            return current;
        }
        return undefined;
    }
}

// Expose it to DecafMUD
// This registration assumes DecafMUD_Global or window.DecafMUD is available.
const DecafMUD = (typeof DecafMUD_Global !== 'undefined' ? DecafMUD_Global : (window as any).DecafMUD);
if (DecafMUD && DecafMUD.plugins && DecafMUD.plugins.Telopt && DecafMUD.TN) {
    DecafMUD.plugins.Telopt[DecafMUD.TN.GMCP] = TeloptGMCP;
} else {
    console.error("DecafMUD global or plugins structure not found for GMCP registration.");
}