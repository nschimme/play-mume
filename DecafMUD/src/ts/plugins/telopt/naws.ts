import type { DecafMUD } from '../../decafmud';
import { TN } from '../../decafmud'; // Import TN

export class NawsTelopt {
    private decaf: DecafMUD;
    private enabled: boolean = false;
    private last: [number, number] | undefined = undefined;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        // Automatically try to send NAWS info when display is available
        if (this.decaf.display && typeof this.decaf.display.listenResize === 'function') {
            this.decaf.display.listenResize(() => this.send());
        }
    }

    public _do(): void {
        this.last = undefined;
        this.enabled = true;
        // Send current size immediately if possible
        setTimeout(() => this.send(), 0);
    }

    public _dont(): void {
        this.enabled = false;
    }

    public disconnect(): void {
        this.enabled = false;
    }

    public send(): void {
        if (!this.decaf.display || !this.enabled) {
            return;
        }

        const sz = this.decaf.display.getSize(); // [width, height] in characters
        if (!sz || sz.length !== 2) {
            this.decaf.debugString("NAWS: display.getSize() returned invalid data.", "warn", sz);
            return;
        }

        if (this.last !== undefined && this.last[0] === sz[0] && this.last[1] === sz[1]) {
            return; // No change
        }
        this.last = sz;

        let data = String.fromCharCode(Math.floor(sz[0] / 256)); // High byte of width
        data += String.fromCharCode(sz[0] % 256);      // Low byte of width
        data += String.fromCharCode(Math.floor(sz[1] / 256)); // High byte of height
        data += String.fromCharCode(sz[1] % 256);      // Low byte of height

        // Escape IAC characters in data
        data = data.replace(/\xFF/g, '\xFF\xFF');

        // const TN = this.decaf.constructor.TN; // Access TN via static context - Now imported
        this.decaf.sendIAC(TN.IAC + TN.SB + TN.NAWS + data + TN.IAC + TN.SE);
    }
}
