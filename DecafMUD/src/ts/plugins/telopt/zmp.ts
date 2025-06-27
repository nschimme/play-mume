/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD TELOPT Handler: ZMP
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

import { DecafMUD, TN as DecafTN } from '../../decafmud'; // Using DecafTN to avoid conflict with local t

// Shortcut the TELNET constants for ease of use.
const t = DecafTN;

interface ZmpCommands {
    [key: string]: ((this: ZmpTelopt, cmd: string, data: string[]) => void) | ZmpCommands;
}

/** Handles the TELNET option ZMP.
 * @name ZmpTelopt
 * @class DecafMUD TELOPT Handler: ZMP
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
export class ZmpTelopt {
    private decaf: DecafMUD;

    // Static commands structure, similar to original JS
    private static commands: ZmpCommands = {
        zmp: {
            check: function(this: ZmpTelopt, cmd: string, data: string[]): void {
                for (let i = 0, l = data.length; i < l; i++) {
                    const c = data[i];
                    if (c.length > 0) {
                        const funcOrPackage = this.getFunction((c.endsWith('.') ? c.substring(0, c.length - 1) : c), true);
                        if (funcOrPackage === undefined) {
                            this.sendZMP("zmp.no-support", [c]);
                        } else {
                            this.sendZMP("zmp.support", [c]);
                        }
                    }
                }
            },
            ping: function(this: ZmpTelopt, cmd: string, data: string[]): void {
                const c = new Date();
                const yr = c.getUTCFullYear().toString();
                let mn = (c.getUTCMonth() + 1).toString();
                let dy = c.getUTCDate().toString();
                let hr = c.getUTCHours().toString();
                let mi = c.getUTCMinutes().toString();
                let sc = c.getUTCSeconds().toString();

                if (mn.length < 2) { mn = '0' + mn; }
                if (dy.length < 2) { dy = '0' + dy; }
                if (hr.length < 2) { hr = '0' + hr; }
                if (mi.length < 2) { mi = '0' + mi; }
                if (sc.length < 2) { sc = '0' + sc; }
                this.sendZMP("zmp.time", [yr + '-' + mn + '-' + dy + ' ' + hr + ':' + mi + ':' + sc]);
            }
        }
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        (this.decaf as any).zmp = this; // Keep original dynamic assignment for now
    }

    /** Helper for sending ZMP messages. */
    public sendZMP(cmd: string, data?: string[]): void {
        let out = '';
        if (data !== undefined) {
            out = '\x00' + data.join('\x00');
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.ZMP + cmd + out + '\x00' + t.IAC + t.SE);
    }

    /** Send the zmp.ident message upon connecting. */
    public _will(): void {
        setTimeout(() => {
            this.sendZMP('zmp.ident', [
                "DecafMUD",
                DecafMUD.version.toString(), // Access static version from DecafMUD class
                "HTML5 MUD Client - keep Java out of your browser"
            ]);
        }, 0);
    }

    /** Handle an incoming ZMP command. */
    public _sb(data: string): false { // Return false to indicate self-debugging
        // If there's no NUL byte, or the first byte is NUL, return.
        if (data.indexOf('\x00') < 1) { return false; } // Original logic implies it still returns false
        const dat = data.split('\x00');
        const cmd = dat.shift(); // cmd will not be undefined due to indexOf check

        if (cmd === undefined) return false; // Should not happen due to prior checks

        // Debug it.
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.ZMP + data + t.IAC + t.SE));

        // Get the function.
        const func = this.getFunction(cmd);
        if (func && typeof func === 'function') {
             func.call(this, cmd, dat); // Pass original cmd and remaining dat array
        }

        // We debugged ourself.
        return false;
    }

    /** Find a given command. */
    private getFunction(cmd: string, package_ok: boolean = false): ((this: ZmpTelopt, cmd: string, data: string[]) => void) | ZmpCommands | undefined {
        const parts = cmd.split('.');
        let currentLevel: ZmpCommands | ((this: ZmpTelopt, cmd: string, data: string[]) => void) | undefined = ZmpTelopt.commands;

        for (const part of parts) {
            if (typeof currentLevel !== 'object' || currentLevel === null || !(part in currentLevel)) {
                return undefined;
            }
            currentLevel = (currentLevel as ZmpCommands)[part];
        }

        if (typeof currentLevel === 'function') {
            return currentLevel as (this: ZmpTelopt, cmd: string, data: string[]) => void;
        }
        if (package_ok && typeof currentLevel === 'object' && currentLevel !== null) {
            return currentLevel as ZmpCommands;
        }
        return undefined;
    }

    /** Add a new command. */
    public addFunction(cmdPath: string, func: (this: ZmpTelopt, cmd: string, data: string[]) => void): void {
        const parts = cmdPath.split('.');
        const cmdName = parts.pop();
        if (!cmdName) return; // Invalid command path

        let currentLevel: ZmpCommands = ZmpTelopt.commands;
        for (const part of parts) {
            if (currentLevel[part] === undefined || typeof currentLevel[part] !== 'object') {
                currentLevel[part] = {};
            }
            currentLevel = currentLevel[part] as ZmpCommands;
        }
        currentLevel[cmdName] = func;
    }
}

// Registration will be in decafmud.ts:
// import { ZmpTelopt } from './plugins/telopt/zmp';
// DecafMUD.plugins.Telopt[TN.ZMP] = ZmpTelopt;
