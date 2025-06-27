import type { DecafMUD } from '../../decafmud'; // Type-only import for DecafMUD reference

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
        if (data !== this.decaf.constructor.TN.ECHO) { // Access TN via static context
            return;
        }
        this.current = (this.current + 1) % this.decaf.options.ttypes.length;

        const TN = this.decaf.constructor.TN; // Access TN via static context
        this.decaf.debugString('RCVD ' + (this.decaf.constructor as any).debugIAC(TN.IAC + TN.SB + TN.TTYPE + TN.ECHO + TN.IAC + TN.SE));
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.TTYPE + TN.IS + this.decaf.options.ttypes[this.current] + TN.IAC + TN.SE);

        return false; // Explicitly return false as per original logic potentially suppressing debug
    }
}
