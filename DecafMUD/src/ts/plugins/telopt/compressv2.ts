import type { DecafMUD } from '../../decafmud';
import { TN } from '../../decafmud'; // Import TN
import * as pako from 'pako'; // Ensure pako is a dependency or provided globally

export class CompressV2Telopt {
    private decaf: DecafMUD;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        // Initialize startCompressV2, though it's primarily managed by DecafMUD instance
        this.decaf.startCompressV2 = false;
    }

    public _will(): boolean {
        // Flash support removed, always allow COMPRESSv2 if pako is available
        // The actual check for pako should ideally be done once at DecafMUD initialization
        // or handled by module resolution. For now, assume pako is available.
        return true;
    }

    public _sb(): void {
        // const TN = this.decaf.constructor.TN; // Static access - Now imported
        this.decaf.debugString('RCVD ' + (this.decaf.constructor as any).debugIAC(TN.IAC + TN.SB + TN.COMPRESSv2 + TN.IAC + TN.SE));

        try {
            // Ensure pako is available before trying to use it
            if (!pako || typeof pako.Inflate !== 'function') {
                this.decaf.error("pako.js is not loaded, MCCP2/COMPRESSv2 cannot be enabled.");
                this.decaf.sendIAC(TN.IAC + TN.WONT + TN.COMPRESSv2); // Tell server we won't do compress
                return;
            }

            this.decaf.decompressStream = new pako.Inflate({ to: 'string' });
            // The flag that indicates to the socketData method to decompress the *next* incoming block.
            // After that first block is decompressed, socketData will continue to use decompressStream
            // but this specific flag (startCompressV2) is typically reset by the main IAC handler
            // or processBuffer after the initial compressed block is handled.
            // For now, setting it here signals the intent to start.
            this.decaf.startCompressV2 = true;

            // It's important that the main client logic (specifically processBuffer or socketData)
            // handles the transition. The server will start sending compressed data *after* this SB.
            // The client needs to decompress the *first* block received after this SB,
            // and then continue decompressing.

        } catch (e: any) {
            this.decaf.error(formatString('Failed to initialize MCCP2 (COMPRESSv2) decompressor: {0}', e.message));
            if (this.decaf.decompressStream) {
                // @ts-ignore pako types might not reflect this usage
                this.decaf.decompressStream = undefined;
            }
            this.decaf.startCompressV2 = false;
            // Optionally, tell the server we can't do COMPRESSV2 if initialization fails
            // this.decaf.sendIAC(TN.IAC + TN.WONT + TN.COMPRESSv2);
        }
    }

    public disconnect(): void {
        // Clean up on disconnect
        this.decaf.startCompressV2 = false;
        if (this.decaf.decompressStream) {
             // @ts-ignore pako types might not reflect this usage
            this.decaf.decompressStream = undefined;
        }
    }
}

// Helper for formatString if it's not globally available or imported directly
// For simplicity, assuming formatString is accessible via this.decaf or globally.
// If not, it should be imported or passed to the class.
function formatString(text: string, ...args: any[]): string {
	let s = text;
	if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
		const obj = args[0];
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				s = s.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
			}
		}
	} else {
		for (let i = 0; i < args.length; i++) {
			s = s.replace(new RegExp(`{${i}}`, 'g'), args[i]);
		}
	}
	return s;
}
