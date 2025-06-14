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

import DecafMUD from './decafmud';
type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) {

// Shortcut the TELNET constants for ease of use.
const t = DecafMUDGlobal.TN;

type ZMPCommandHandler = (this: ZMP, cmd: string, data: string[]) => void;

interface ZMPCommandPackage {
    [key: string]: ZMPCommandHandler | ZMPCommandPackage;
}

class ZMP {
    decaf: DecafMUDInstance;
    static commands: ZMPCommandPackage = {}; // Static property for commands

    constructor(decaf: DecafMUDInstance) {
        this.decaf = decaf;
        (this.decaf as any).zmp = this; // Assign to decaf instance

        // Initialize ZMP base commands if not already present by other instances (though typically one handler per type)
        if (!ZMP.commands.zmp) {
            ZMP.commands.zmp = {
                'check': (cmd: string, data: string[]): void => {
                    for(let i=0, l=data.length; i < l; i++) {
                        const c = data[i];
                        if ( c.length > 0 ) {
                            const func = this.getFunction((c.substr(-1) === '.' ? c.substr(0,c.length-1) : c), true);
                            if ( func === undefined ) {
                                this.sendZMP("zmp.no-support", [c]);
                            } else {
                                this.sendZMP("zmp.support", [c]);
                            }
                        }
                    }
                },
                'ping': (cmd: string, data: string[]): void => {
                    const c = new Date();
                    const yr = c.getUTCFullYear().toString();
                    let mn = (c.getUTCMonth()+1).toString();
                    let dy = c.getUTCDate().toString();
                    let hr = c.getUTCHours().toString();
                    let mi = c.getUTCMinutes().toString();
                    let sc = c.getUTCSeconds().toString();

                    if (mn.length < 2 ) { mn = '0' + mn; }
                    if (dy.length < 2 ) { dy = '0' + dy; }
                    if (hr.length < 2 ) { hr = '0' + hr; }
                    if (mi.length < 2 ) { mi = '0' + mi; }
                    if (sc.length < 2 ) { sc = '0' + sc; }
                    this.sendZMP("zmp.time",[yr+'-'+mn+'-'+dy+' '+hr+':'+mi+':'+sc]);
                }
            };
        }
    }

    sendZMP(cmd: string, data?: string[]): void {
        let out = '';
        if ( data !== undefined ) {
            out = '\x00' + data.join('\x00');
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.ZMP + cmd + out + '\x00' + t.IAC + t.SE);
    }

    _will(): void {
        const z = this;
        setTimeout(function(){
            z.sendZMP('zmp.ident', [
                "DecafMUD",
                DecafMUDGlobal.version.toString(),
                "HTML5 MUD Client - keep Java out of your browser"
            ]);
        },0);
    }

    _sb(data: string): boolean {
        if ( data.indexOf('\x00') < 1 ) { return true; } // Return true if no NUL or NUL is first (error/ignore)
        const dat = data.split('\x00');
        const cmd = dat.shift();

        if (!cmd) return true; // No command part

        this.decaf.debugString('RCVD ' + DecafMUDGlobal.debugIAC(t.IAC + t.SB + t.ZMP + data + t.IAC + t.SE ));

        const func = this.getFunction(cmd);
        if ( func && typeof func === 'function') { // Ensure func is a function
            (func as ZMPCommandHandler).call(this, cmd, dat);
        }
        return false; // We debugged ourself
    }

    getFunction(cmd: string, package_ok: boolean = false): ZMPCommandHandler | ZMPCommandPackage | undefined {
        const parts = cmd.split('.');
        let top: ZMPCommandPackage | ZMPCommandHandler = ZMP.commands;
        while(parts.length > 0) {
            const part = parts.shift();
            if (part === undefined || (top as ZMPCommandPackage)[part] === undefined ) { return undefined; }
            top = (top as ZMPCommandPackage)[part];
        }

        if (typeof top === 'function') { return top as ZMPCommandHandler; }
        if (package_ok === true ) { return top as ZMPCommandPackage; }
        return undefined;
    }

    addFunction(cmd: string, func: ZMPCommandHandler): void {
        const parts = cmd.split('.');
        const commandName = parts.pop();
        if (!commandName) return;


        let currentLevel: ZMPCommandPackage = ZMP.commands;
        for (const part of parts) {
            if (currentLevel[part] === undefined) {
                currentLevel[part] = {};
            } else if (typeof currentLevel[part] === 'function') {
                // Cannot create a sub-package if a function is already there
                console.error(`ZMP: Cannot create package ${part}, function already exists.`);
                return;
            }
            currentLevel = currentLevel[part] as ZMPCommandPackage;
        }
        currentLevel[commandName] = func;
    }
}

// Expose it to DecafMUD
(DecafMUDGlobal as any).plugins.Telopt[t.ZMP] = ZMP;

})(DecafMUD);
