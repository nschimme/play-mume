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

import DecafMUD from './decafmud';
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) {

// Shortcut the TELNET constants for ease of use.
const t = DecafMUDGlobal.TN;

class GMCP {
    decaf: DecafMUDInstance;
    pingDelay: number = 60; // seconds
    pingAverage: number = 0;
    pingCount: number = 0;
    pingWhen: Date | undefined = undefined;
    pingTimer: NodeJS.Timeout | undefined = undefined;
    packages: any = {}; // For GMCP package structure, TODO: define specific types

    constructor(decaf: DecafMUDInstance) {
        this.decaf = decaf;
        (this.decaf as any).gmcp = this; // Assign to decaf instance

        // Initialize packages structure
        this.packages.Core = {
            ' version': 1, // Note the leading space, might be intentional or a typo
            'Ping': (data: any) => { // data is expected to be the average from client if provided
                if (this.pingWhen) {
                    const n = new Date().getTime() - this.pingWhen.getTime();
                    this.pingCount++;
                    this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);
                    // console.debug is not standard, use this.decaf.debugString
                    this.decaf.debugString('PING: {0}ms over {1} pings'.tr(this.decaf,this.pingAverage,this.pingCount), 'debug');
                }
            },
            'Goodbye': (data: any) => { // data is the reason string
                this.decaf.debugString('Reason for disconnect: {0}'.tr(this.decaf, data), 'info');
            }
        };
    }

    sendGMCP(pckg: string, data?: any): void {
        let out = '';
        if ( data !== undefined ) {
            // JSON.stringify([data]) creates an array string like "[{...}]"
            // substr(1, out.length-2) removes the outer brackets " {...} "
            // The leading space is intentional in the original code.
            out = JSON.stringify(data); // Direct stringify should be fine. If server expects array, use [data]
            out = ' ' + out;
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.GMCP + pckg + out + t.IAC + t.SE);
    }

    _wont(): void { this.disconnect(); }
    disconnect(): void {
        clearTimeout(this.pingTimer);
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
    }

    _will(): void {
        const g = this;
        setTimeout(() => {
            g.sendGMCP("Core.Hello", {
                "client": "DecafMUD",
                "version": DecafMUDGlobal.version.toString()
            });
        }, 0);

        clearTimeout(this.pingTimer); // Clear existing timer before starting a new one
        this.pingTimer = setTimeout(() => { g.ping(); }, this.pingDelay * 1000);
    }

    ping(): void {
        let avg: number | undefined = undefined;
        if ( this.pingCount > 0 ) { avg = this.pingAverage; }
        this.sendGMCP("Core.Ping", avg); // Send current average if available
        this.pingWhen = new Date();

        clearTimeout(this.pingTimer);
        const g = this;
        this.pingTimer = setTimeout(() => { g.ping(); }, this.pingDelay * 1000);
    }

    _sb(data: string): boolean {
        let ind = data.search(/[^A-Za-z0-9._]/);
        let ret = false;
        let pckg: string;
        let out: any;

        if ( ind !== -1 ) {
            pckg = data.substring(0, ind);
            const jsonData = data.substring(ind).trim(); // Get the rest and trim spaces
            if ( jsonData.length > 0 ) {
                try {
                    // The original code `JSON.parse('['+jsonData+']')[0]` is a bit strange.
                    // It implies jsonData is not a valid JSON object itself but part of an array.
                    // A more robust way is to try parsing directly, or adjust if server truly sends partial array content.
                    out = JSON.parse(jsonData);
                } catch (e) {
                    this.decaf.debugString(`GMCP: Error parsing JSON data for package ${pckg}: ${jsonData}`, 'error', e);
                    return true; // Error in parsing, don't proceed with this message
                }
            }
        } else {
            pckg = data;
        }

        if ( !pckg || pckg.length === 0 ) { return true; } // No package name, can't process

        if ( out !== undefined && 'console' in window && (console as any).groupCollapsed ) {
            (console as any).groupCollapsed('DecafMUD['+this.decaf.id+'] RCVD IAC SB GMCP "'+pckg+'" ... IAC SE');
            console.dir(out);
            (console as any).groupEnd(); // Removed redundant string
        } else { ret = true; }

        const func = this.getFunction(pckg);
        if ( func ) {
            try {
                func.call(this, out); // `this` context should be the GMCP instance
            } catch (e) {
                 this.decaf.debugString(`GMCP: Error executing handler for ${pckg}`, 'error', e);
            }
        }
        return ret;
    }

    getFunction(pckg: string): ((data?: any) => void) | undefined {
        const parts = pckg.split('.');
        let top: any = this.packages;
        while(parts.length > 0) {
            const part = parts.shift();
            if (part === undefined || top[part] === undefined ) { return undefined; }
            top = top[part];
        }
        if (typeof top === 'function') { return top; }
        return undefined;
    }
}

// Expose it to DecafMUD
(DecafMUDGlobal as any).plugins.Telopt[t.GMCP] = GMCP;

})(DecafMUD);
