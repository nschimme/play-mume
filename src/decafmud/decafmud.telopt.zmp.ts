import { DecafMUD } from './decafmud';

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

// Shortcut the TELNET constants for ease of use.
const t = DecafMUD.TN;

/** Handles the TELNET option ZMP.
 * @name ZMPHandler
 * @class DecafMUD TELOPT Handler: ZMP
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
class ZMPHandler {
    decaf: DecafMUD;

    static commands: { [key: string]: any } = {
        zmp: {
            'check' : function(this: ZMPHandler, cmd: string, data: string[]) {
                for(let i=0, l=data.length; i<l; i++) { // Changed var to let
                    const c = data[i]; // Changed var to const
                    if ( c.length > 0 ) {
                        const func = this.getFunction((c.substr(-1) == '.' ? c.substr(0,c.length-1) : c), true); // Added const
                        if ( func === undefined ) {
                            this.sendZMP("zmp.no-support", [c]);
                        } else {
                            this.sendZMP("zmp.support", [c]);
                        }
                    }
                }
            },

            'ping' : function(this: ZMPHandler, cmd: string, data: string[]) {
                const c = new Date(); // Changed var to const
                let yr = c.getUTCFullYear().toString(), // Changed var to let
                    mn = (c.getUTCMonth()+1).toString(),
                    dy = c.getUTCDate().toString(),
                    hr = c.getUTCHours().toString(),
                    mi = c.getUTCMinutes().toString(),
                    sc = c.getUTCSeconds().toString();
                if (mn.length < 2 ) { mn = '0' + mn; }
                if (dy.length < 2 ) { dy = '0' + dy; }
                if (hr.length < 2 ) { hr = '0' + hr; }
                if (mi.length < 2 ) { mi = '0' + mi; }
                if (sc.length < 2 ) { sc = '0' + sc; }
                this.sendZMP("zmp.time",[yr+'-'+mn+'-'+dy+' '+hr+':'+mi+':'+sc])
            }
        }
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        (this.decaf as any).zmp = this; // Assign to decaf instance
    }

    /** Helper for sending ZMP messages. */
    sendZMP(cmd: string, data?: string[]) { // data is optional string array
        let out = '';
        if ( data !== undefined ) {
            out = '\x00' + data.join('\x00');
        }
        this.decaf.sendIAC(t.IAC + t.SB + t.ZMP + cmd + out + '\x00' + t.IAC + t.SE);
    }

    /** Send the zmp.ident message upon connecting. */
    _will() {
        const z = this;
        setTimeout(function(){
            z.sendZMP('zmp.ident', [
                "DecafMUD",
                DecafMUD.version.toString(),
                "HTML5 MUD Client - keep Java out of your browser"]);
        },0);
    }

    /** Handle an incoming ZMP command. */
    _sb(data: string): boolean { // data is string from telnet
        if ( data.indexOf('\x00') < 1 ) { return true; } // Return true if no NUL or first byte is NUL
        const dat = data.split('\x00'); // Changed var to const
        const cmd = dat.shift(); // Changed var to const

        if (cmd === undefined) { return true; } // No command found

        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.ZMP + data + t.IAC + t.SE ));

        const func = this.getFunction(cmd);
        if ( func ) { func.call(this, cmd, dat); }

        return false; // We debugged ourself.
    }

    /** Find a given command. */
    getFunction(cmd: string, package_ok?: boolean): Function | undefined { // package_ok is optional
        const parts = cmd.split('.'); // Changed var to const
        let top: any = ZMPHandler.commands; // Use static commands
        while(parts.length > 0) {
            const part = parts.shift(); // Changed var to const
            if (part === undefined || top[part] === undefined ) { return undefined; }
            top = top[part];
        }

        if (typeof top === 'function') { return top; }
        if (package_ok === true && typeof top === 'object' ) { return top; } // Return package if ok
        return undefined;
    }

    /** Add a new command. */
    addFunction(cmd: string, func: Function) {
        const parts = cmd.split('.'); // Changed var to const
        let command_name = parts.pop(); // cmd is now command_name, changed var to let
        if (command_name === undefined) return;

        let top: any = ZMPHandler.commands; // Use static commands
        while(parts.length > 0) {
            const part = parts.shift(); // Changed var to const
            if (part === undefined) return;
            if ( top[part] === undefined ) {
                top[part] = {};
            }
            top = top[part];
        }
        top[command_name] = func;
    }
}

// Expose it to DecafMUD
(DecafMUD.plugins as any).Telopt[t.ZMP] = ZMPHandler;
