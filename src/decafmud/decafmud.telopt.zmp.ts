// SPDX-License-Identifier: MIT

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
import { IDecafMUD, IZMP } from './decafmud.types';

// Ensure DecafMUD_Global is defined for plugin registration, or use window.DecafMUD
declare var DecafMUD_Global: any;

class TeloptZMP implements IZMP {
    public decaf: IDecafMUD;
    public commands: any; // As per IZMP, 'any' is used.

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
        this.decaf.zmp = this; // Register this instance with decaf

        // Initialize commands structure, including the methods directly
        this.commands = {
            zmp: {
                check: (cmd: string, data: string[]): void => {
                    for (let i = 0, l = data.length; i < l; i++) {
                        const c = data[i];
                        if (c.length > 0) {
                            const func = this.getFunction((c.substr(-1) === '.' ? c.substr(0, c.length - 1) : c), true);
                            if (func === undefined) {
                                this.sendZMP("zmp.no-support", [c]);
                            } else {
                                this.sendZMP("zmp.support", [c]);
                            }
                        }
                    }
                },
                ping: (cmd: string, data: string[]): void => {
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
    }

    /** Helper for sending ZMP messages. */
    public sendZMP(cmd: string, data?: string[]): void {
        const TN = (this.decaf.constructor as any).TN;
        let out_data = '';
        if (data !== undefined) {
            out_data = '\x00' + data.join('\x00');
        }
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.ZMP + cmd + out_data + '\x00' + TN.IAC + TN.SE);
    }

    /** Send the zmp.ident message upon connecting. */
    public _will(d?: string): void { // d for data, optional
        setTimeout(() => {
            this.sendZMP('zmp.ident', [
                "DecafMUD",
                (this.decaf.constructor as any).version.toString(),
                "HTML5 MUD Client - keep Java out of your browser"
            ]);
        }, 0);
    }

    public _wont(data?: string): void { /* Not implemented in original ZMP */ }
    public _do(data?: string): void { /* Not implemented in original ZMP */ }
    public _dont(data?: string): void { /* Not implemented in original ZMP */ }


    /** Handle an incoming ZMP command. */
    public _sb(data: string): boolean | void {
        const TN = (this.decaf.constructor as any).TN;
        const debugIAC = (this.decaf.constructor as any).debugIAC;

        // If there's no NUL byte, or the first byte is NUL, return.
        if (data.indexOf('\x00') < 1) { return; }
        const dat: string[] = data.split('\x00');
        const cmd: string | undefined = dat.shift();

        if (!cmd) return; // No command

        // Debug it.
        if (this.decaf.debugString) {
            this.decaf.debugString('RCVD ' + debugIAC(TN.IAC + TN.SB + TN.ZMP + data + TN.IAC + TN.SE), 'zmp');
        } else {
            console.log('ZMP RCVD: ' + debugIAC(TN.IAC + TN.SB + TN.ZMP + data + TN.IAC + TN.SE));
        }

        // Get the function.
        const func = this.getFunction(cmd);
        if (func && typeof func === 'function') {
            // Since the target functions (e.g., this.commands.zmp.check) are arrow functions,
            // their 'this' is lexically bound to the TeloptZMP instance.
            // A direct call is cleaner and avoids 'this' context issues with .call().
            (func as (cmd: string, data: string[]) => void)(cmd, dat);
        } else if (func && typeof func === 'object') {
             if (this.decaf.debugString) {
                this.decaf.debugString(`ZMP: Command '${cmd}' resolved to a package, not a function.`, 'zmp_warn');
            } else {
                console.warn(`ZMP: Command '${cmd}' resolved to a package, not a function.`);
            }
        }

        // We debugged ourself.
        return false;
    }

    /** Find a given command. */
    public getFunction(cmd: string, package_ok?: boolean): ((cmd: string, data: string[]) => void) | object | undefined {
        const parts: string[] = cmd.split('.');
        let current: any = this.commands; // Access instance property
        for (const part of parts) {
            if (current[part] === undefined) { return undefined; }
            current = current[part];
        }

        if (typeof current === 'function') {
            return current;
        }
        if (package_ok === true && typeof current === 'object') {
            return current;
        }
        return undefined;
    }

    /** Add a new command. */
    public addFunction(cmd: string, func: (cmd: string, data: string[]) => void): void {
        const parts: string[] = cmd.split('.');
        const commandName: string | undefined = parts.pop();

        if (!commandName) return;

        // Go through the path, adding arrays as necessary.
        let current: any = this.commands; // Access instance property
        for (const part of parts) {
            if (current[part] === undefined) {
                current[part] = {};
            }
            current = current[part];
        }

        // Add our command.
        current[commandName] = func;
    }
}

// Expose it to DecafMUD
const DecafMUD = (typeof DecafMUD_Global !== 'undefined' ? DecafMUD_Global : (window as any).DecafMUD);
if (DecafMUD && DecafMUD.plugins && DecafMUD.plugins.Telopt && DecafMUD.TN) {
    DecafMUD.plugins.Telopt[DecafMUD.TN.ZMP] = TeloptZMP;
} else {
    console.error("DecafMUD global or plugins structure not found for ZMP registration.");
}