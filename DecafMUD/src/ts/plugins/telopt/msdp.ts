import type { DecafMUD } from '../../decafmud';

const MSDP_VAR = '\x01';
const MSDP_VAL = '\x02';
const MSDP_TABLE_OPEN = '\x03';
const MSDP_TABLE_CLOSE = '\x04';
// const MSDP_ARRAY_OPEN = '\x05'; // Not standard, but some MUDs might use it
// const MSDP_ARRAY_CLOSE = '\x06'; // Not standard

const msdpControlChars = /[\x01\x02\x03\x04\x05\x06]/;

/**
 * Read a string of MSDP-formatted variables and return an object.
 * This is a simplified parser focusing on var-val pairs and basic tables.
 */
function readMSDP(data: string): [Record<string, any>, string] {
    let out: Record<string, any> = {};
    let variable: string | undefined = undefined;
    let i = 0;

    while (i < data.length) {
        const char = data[i];
        i++;

        if (char === MSDP_VAR) {
            let varName = "";
            while (i < data.length && !msdpControlChars.test(data[i])) {
                varName += data[i];
                i++;
            }
            variable = varName;
            out[variable] = undefined; // Initialize
        } else if (char === MSDP_VAL) {
            if (variable === undefined) continue; // Should not happen in valid MSDP

            let value: any = "";
            if (i < data.length && data[i] === MSDP_TABLE_OPEN) {
                i++; // Skip TABLE_OPEN
                const [tableObj, remainingTableData] = readMSDP(data.substring(i));
                value = tableObj;
                // Advance i by the length of data consumed by the recursive call
                // This requires knowing how much was consumed. The returned 'remainingTableData'
                // implies the original 'data.substring(i)' was fully processed up to 'TABLE_CLOSE'.
                // Find the end of this table structure to correctly advance 'i'.
                let tableEndIndex = i;
                let openTables = 1;
                while(tableEndIndex < data.length && openTables > 0) {
                    if (data[tableEndIndex] === MSDP_TABLE_OPEN) openTables++;
                    else if (data[tableEndIndex] === MSDP_TABLE_CLOSE) openTables--;
                    tableEndIndex++;
                }
                i = tableEndIndex;

            } else {
                let valStr = "";
                while (i < data.length && !msdpControlChars.test(data[i])) {
                    valStr += data[i];
                    i++;
                }
                value = valStr;
            }

            if (out[variable] === undefined) {
                out[variable] = value;
            } else if (Array.isArray(out[variable])) {
                out[variable].push(value);
            } else {
                out[variable] = [out[variable], value];
            }
        } else if (char === MSDP_TABLE_CLOSE) {
            // This signals the end of a recursive table parse
            break;
        }
        // Other characters are part of names/values or should be ignored if malformed
    }
    return [out, data.substring(i)]; // Return remaining data
}

/** Convert a variable to a string of valid MSDP-formatted data. */
function writeMSDP(obj: any): string {
    var type = typeof obj;
    if (type === 'string' || type === 'number') { return obj.toString(); }
    else if (type === 'boolean') { return obj ? '1' : '0'; }
    else if (type === 'undefined' || obj === null) { return ''; }
    else if (type === 'object') {
        let out_str = '';
        for (const k in obj) {
            if (Object.hasOwnProperty.call(obj, k)) {
                if (obj[k] === undefined || obj[k] === null || typeof obj[k] === 'function') { continue; }

                out_str += MSDP_VAR + k;
                if (Array.isArray(obj[k])) {
                    for (const item of obj[k]) {
                        out_str += MSDP_VAL;
                        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                            out_str += MSDP_TABLE_OPEN + writeMSDP(item) + MSDP_TABLE_CLOSE;
                        } else {
                            out_str += writeMSDP(item);
                        }
                    }
                } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                     out_str += MSDP_VAL + MSDP_TABLE_OPEN + writeMSDP(obj[k]) + MSDP_TABLE_CLOSE;
                } else {
                    out_str += MSDP_VAL + writeMSDP(obj[k]);
                }
            }
        }
        return out_str;
    }
    return obj.toString(); // Fallback
}


export class MsdpTelopt {
    private decaf: DecafMUD;
    private commands: string[] = [];
    private variables: string[] = [];
    // private reportable: string[] = []; // Not directly used in provided logic but part of MSDP spec

    private static readonly config_vars: Record<string, string> = {
        'CLIENT_NAME': 'DecafMUD', // Updated name
        'CLIENT_VERSION': '0.10.0-beta', // Use static version or get from DecafMUD instance
        'PLUGIN_ID': 'MSDP', // More descriptive
        'ANSI_COLORS': '1',
        'UTF_8': '1', // Assuming UTF-8 is generally supported by the client
        'XTERM_256_COLORS': '1' // Assuming support
        // Add other capabilities like GMCP, MXP if client supports them
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        // CLIENT_VERSION should ideally come from DecafMUD.version
        MsdpTelopt.config_vars['CLIENT_VERSION'] = (this.decaf.constructor as any).version.toString();
        this.connect(); // Initialize on creation
    }

    public connect(): void {
        this.commands = ['LIST']; // Base command
        this.variables = [];
        // this.reportable = [];
    }

    public _will(): void {
        const TN = this.decaf.constructor.TN;
        // Server offers MSDP, client agrees. Client can now send MSDP commands.
        // Standard practice is for client to then LIST known variables.
        setTimeout(() => {
            this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + MSDP_VAR + 'LIST' + MSDP_VAL + 'COMMANDS' + TN.IAC + TN.SE);
            this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + MSDP_VAR + 'LIST' + MSDP_VAL + 'VARIABLES' + TN.IAC + TN.SE);
            this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + MSDP_VAR + 'LIST' + MSDP_VAL + 'CONFIGURABLE_VARIABLES' + TN.IAC + TN.SE);
            this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + MSDP_VAR + 'LIST' + MSDP_VAL + 'REPORTABLE_VARIABLES' + TN.IAC + TN.SE);
            // Example: Send client capabilities
            const clientConfig = writeMSDP(MsdpTelopt.config_vars);
            if (clientConfig) {
                 this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + clientConfig + TN.IAC + TN.SE);
            }
        }, 0);
    }

    public _sb(data: string): boolean { // Return true to allow default debug, false to suppress
        const [msdp_out, ] = readMSDP(data);
        const TN = this.decaf.constructor.TN;
        const DecafMUDGlobal = this.decaf.constructor as any;


        if (typeof window !== 'undefined' && 'console' in window && console.groupCollapsed) {
            console.groupCollapsed(`DecafMUD[${this.decaf.id}]: RCVD IAC SB MSDP ... IAC SE`);
            console.dir(msdp_out);
            console.groupEnd();
        } else {
            this.decaf.debugString('RCVD MSDP data: ', 'debug', msdp_out);
        }

        // Process received MSDP variables
        if (msdp_out['COMMANDS'] && Array.isArray(msdp_out['COMMANDS'])) {
            this.commands = [...new Set([...this.commands, ...msdp_out['COMMANDS']])];
        }
        if (msdp_out['VARIABLES'] && Array.isArray(msdp_out['VARIABLES'])) {
            this.variables = [...new Set([...this.variables, ...msdp_out['VARIABLES']])];
        }
        // if (msdp_out['REPORTABLE_VARIABLES'] && Array.isArray(msdp_out['REPORTABLE_VARIABLES'])) {
        //     this.reportable = [...new Set([...this.reportable, ...msdp_out['REPORTABLE_VARIABLES']])];
        // }

        if (msdp_out['CONFIGURABLE_VARIABLES'] && Array.isArray(msdp_out['CONFIGURABLE_VARIABLES'])) {
            const configurableByServer: string[] = msdp_out['CONFIGURABLE_VARIABLES'];
            const clientCanConfigure: Record<string, string> = {};
            for (const key of configurableByServer) {
                if (MsdpTelopt.config_vars[key] !== undefined) {
                    clientCanConfigure[key] = MsdpTelopt.config_vars[key];
                }
            }
            if (Object.keys(clientCanConfigure).length > 0) {
                this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + writeMSDP(clientCanConfigure) + TN.IAC + TN.SE);
            }
        }

        // Fire an event or handle data (e.g., update UI)
        // This is a placeholder for actual data handling.
        if (this.decaf.ui && typeof this.decaf.ui.handleMsdp === 'function') {
            this.decaf.ui.handleMsdp(msdp_out);
        } else {
            // Generic event if no specific handler
            // $(this.decaf).trigger('msdpReceived', [msdp_out]);
        }

        return false; // Suppress default console logging of the raw SB sequence
    }

    public disconnect(): void {
        // Reset state if needed
        this.connect();
    }

    // Utility to send an MSDP command
    public sendCommand(command: string, args?: Record<string, any>): void {
        if (!this.decaf.connected) return;
        const TN = this.decaf.constructor.TN;
        let msdpPayload = MSDP_VAR + command;
        if (args) {
            for (const key in args) {
                if (Object.hasOwnProperty.call(args, key)) {
                    msdpPayload += MSDP_VAL + key + MSDP_VAR + args[key]; // Simplified example
                }
            }
        } else {
             msdpPayload += MSDP_VAL + "1"; // Common for simple commands
        }
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.MSDP + msdpPayload + TN.IAC + TN.SE);
    }
}
