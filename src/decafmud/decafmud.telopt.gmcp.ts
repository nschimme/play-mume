import { DecafMUD } from './decafmud';

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

// Shortcut the TELNET constants for ease of use.
const t = DecafMUD.TN;

/** Handles the TELNET option GMCP.
 * @name GMCP
 * @class DecafMUD TELOPT Handler: GMCP
 * @exports GMCP as DecafMUD.plugins.Telopt.\xc9 // Original export was by Telnet Code
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
class GMCPHandler { // Changed to class
    decaf: DecafMUD;

    pingDelay: number = 60;
    pingAverage: number = 0;
    pingCount: number = 0;
    pingWhen: Date | undefined = undefined;
    pingTimer: any | undefined = undefined; // Timeout ID can be 'any' or 'number' or a specific NodeJS.Timeout type

    // Package structure for GMCP
    packages: { [key: string]: any } = {
        Core: {
            ' version' : 1, // Note: leading space in original, might be intentional for some GMCP parsers

            'Ping' : function(this: GMCPHandler, data: any) { // Added this type
                if (this.pingWhen instanceof Date) {
                    const n = new Date().getTime() - this.pingWhen.getTime();
                    this.pingCount++;
                    this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount-1))) / this.pingCount);
                    console.debug(`PING: ${this.pingAverage}ms over ${this.pingCount} pings`);
                } else {
                    // First ping response without having sent one, or bad state
                    console.debug('GMCP Core.Ping received without a prior ping sent or pingWhen not set.');
                }
            },

            'Goodbye' : function(this: GMCPHandler, data: any) { // Added this type
                this.decaf.debugString(`Reason for disconnect: ${data}`);
            }
        }
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        (this.decaf as any).gmcp = this; // Assign to decaf instance
    }

    /** Helper for sending GMCP messages. */
    sendGMCP(pckg: string, data?: any) { // data is optional
        let out_data_str = '';
        if ( data !== undefined ) {
            // JSON.stringify([data]) results in "[actual_data_json]"
            // then substr removes brackets: "actual_data_json"
            // then prepends a space: " actual_data_json"
            // This matches the original logic if data is not an array itself.
            // If data is an object: { "key": "value" } -> " {\"key\":\"value\"}"
            let stringifiedData = JSON.stringify(data);
            out_data_str = ' ' + stringifiedData;
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.GMCP + pckg + out_data_str + t.IAC + t.SE);
    }

    /** Abort the ping information on disconnect. */
    _wont() { this.disconnect(); } // Alias
    disconnect() {
        clearTimeout(this.pingTimer);
        this.pingAverage = 0;
        this.pingCount = 0;
        this.pingWhen = undefined;
    }

    /** Send the Core.Hello message upon connecting. */
    _will() {
        const g = this;
        setTimeout(function(){
            g.sendGMCP("Core.Hello", {
                "client"	: "DecafMUD",
                "version"	: DecafMUD.version.toString()
            });
        }, 0);

        // Also, start the ping loop.
        this.pingTimer = setTimeout(function(){g.ping();}, this.pingDelay*1000);
    }

    /** Send a ping. */
    ping() {
        let avg_data: number | undefined = undefined;
        if ( this.pingCount > 0 ) { avg_data = this.pingAverage; }

        this.pingWhen = new Date(); // Set pingWhen *before* sending
        this.sendGMCP("Core.Ping", avg_data); // avg_data can be undefined here

        const g = this;
        this.pingTimer = setTimeout(function(){g.ping();}, this.pingDelay*1000);
    }

    /** Handle an incoming GMCP message. */
    _sb(data: string): boolean { // data is string from telnet
        let ind = data.search(/[^A-Za-z0-9._]/);
        let ret = false;
        let pckg: string;
        let out: any = undefined;

        if ( ind !== -1 ) {
            pckg = data.substr(0, ind);
            // Check if there is data after the package name
            if (data.length > ind && data[ind].trim() !== '') {
                 try {
                    // The original JSON.parse('['+data.substr(ind+1)+']')[0]; is risky
                    // It assumes data.substr(ind+1) is valid inside array brackets
                    // A more robust way is to parse it directly if it's valid JSON
                    out = JSON.parse(data.substr(ind).trim());
                } catch (e) {
                    this.decaf.debugString(`GMCP: Error parsing JSON data for package ${pckg}: ${data.substr(ind).trim()}`, 'error');
                    this.decaf.debugString(e as string, 'error');
                    return true; // Indicate error / malformed
                }
            } else if (data.length > ind) { // Space after package name, but no data
                 pckg = data.trim(); // data was just package name + spaces
            }
        } else {
            pckg = data;
        }

        if ( pckg.length === 0 ) { return true; } // No package name

        if ( out !== undefined && typeof console !== 'undefined' && console.groupCollapsed ) {
            console.groupCollapsed('DecafMUD['+this.decaf.id+'] RCVD IAC SB GMCP "'+pckg+'" ... IAC SE');
            console.dir(out);
            console.groupEnd(); // Removed extra text from groupEnd
        } else { ret = true; }

        const func = this.getFunction(pckg);
        if ( func ) { func.call(this, out); }

        return ret;
    }

    /** Command to find a given function. */
    getFunction(pckg: string): Function | undefined {
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
(DecafMUD.plugins as any).Telopt[t.GMCP] = GMCPHandler;
//DecafMUD.plugins.Telopt.gmcp = true; // This might be an alternative way it was registered
