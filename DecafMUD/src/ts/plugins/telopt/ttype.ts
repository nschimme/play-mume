import { DecafMUD } from '../../decafmud'; // Changed to value import
import { TN } from '../../telnetConstants'; // Import TN from telnetConstants

export class TTypeTelopt {
    private decaf: DecafMUD;
    private current: number = -1;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
    }

    public _dont(): void {
        this.current = -1;
    }

    public disconnect(): void {
        this.current = -1;
    }

    public _sb(data: string): false | void {
        // TTYPE subnegotiation SEND command is \x01
        // data here is the content of the subnegotiation, after IAC SB TTYPE
        if (data.charCodeAt(0) !== 1 || data.length !== 1) {
            this.decaf.debugString('TTYPE: Received unexpected subnegotiation data: ' + data, 'warn');
            return false; // Don't process further if not TTYPE SEND
        }
        this.current = (this.current + 1) % this.decaf.options.ttypes.length;

        // Corrected debug string to show actual received data (which is just the SEND command)
        this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(TN.IAC + TN.SB + TN.TTYPE + data + TN.IAC + TN.SE));
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.TTYPE + TN.IS + this.decaf.options.ttypes[this.current] + TN.IAC + TN.SE);

        return false; // Suppress default debug message for SB, as we've logged a more accurate one
    }
}
