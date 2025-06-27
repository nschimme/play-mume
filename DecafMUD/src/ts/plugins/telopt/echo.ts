import type { DecafMUD } from '../../decafmud';

export class EchoTelopt {
    private decaf: DecafMUD;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
    }

    public _will(): void {
        if (this.decaf.ui) {
            this.decaf.ui.localEcho(false);
        }
    }

    public _wont(): void {
        if (this.decaf.ui) {
            this.decaf.ui.localEcho(true);
        }
    }

    public disconnect(): void {
        if (this.decaf.ui) {
            this.decaf.ui.localEcho(true); // Default to local echo on disconnect
        }
    }
}
