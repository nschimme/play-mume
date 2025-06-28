import type { DecafMUD, DecafPlugins } from '../../decafmud'; // Import DecafPlugins too
import { TN } from '../../decafmud'; // Import TN

export class CharsetTelopt {
    private decaf: DecafMUD;

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
    }

    public _dont(): false { // Server should not say DONT CHARSET
        return false;
    }

    public _will(): void {
        setTimeout(() => {
            const requestedCharsets: string[] = [];
            const doneEncodings: string[] = [];
            // const TN = this.decaf.constructor.TN; // Static access - Now imported
            const DecafMUDGlobal = this.decaf.constructor as any; // To access static DecafMUD.plugins

            const currentEncoding = this.decaf.options.encoding;
            if (currentEncoding !== 'iso88591' &&
                DecafMUDGlobal.plugins.Encoding[currentEncoding]?.proper) {
                requestedCharsets.push(DecafMUDGlobal.plugins.Encoding[currentEncoding].proper);
                doneEncodings.push(currentEncoding);
            }

            for (const encName of this.decaf.options.encoding_order) {
                if (DecafMUDGlobal.plugins.Encoding[encName]?.proper &&
                    !doneEncodings.includes(encName)) {
                    requestedCharsets.push(DecafMUDGlobal.plugins.Encoding[encName].proper);
                    doneEncodings.push(encName);
                }
            }

            for (const encKey in DecafMUDGlobal.plugins.Encoding) {
                if (Object.prototype.hasOwnProperty.call(DecafMUDGlobal.plugins.Encoding, encKey)) {
                    if (!doneEncodings.includes(encKey) && DecafMUDGlobal.plugins.Encoding[encKey].proper) {
                        requestedCharsets.push(DecafMUDGlobal.plugins.Encoding[encKey].proper);
                        // No need to add to doneEncodings here as we are iterating all available
                    }
                }
            }

            const uniqueCharsets = [...new Set(requestedCharsets)]; // Ensure uniqueness
            this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + TN.ECHO + ' ' + uniqueCharsets.join(' ') + TN.IAC + TN.SE);
        }, 0);
    }

    public _sb(data: string): false | void {
        // const TN = this.decaf.constructor.TN; // Static access - Now imported
        const DecafMUDGlobal = this.decaf.constructor as any; // To access static DecafMUD.plugins

        this.decaf.debugString('RCVD ' + DecafMUDGlobal.debugIAC(TN.IAC + TN.SB + TN.CHARSET + data + TN.IAC + TN.SE));

        if (data.charCodeAt(0) === 1) { // REQUEST / TTABLE-IS
            let dataStr = data.substring(1);
            if (dataStr.startsWith('TTABLE ')) { // Obsolete part of RFC, but handle
                dataStr = dataStr.substring(8);
            }
            const sep = dataStr.charAt(0); // Separator for charsets list
            const receivedCharsets = dataStr.substring(1).split(sep);

            let chosenEncodingKey: string | undefined = undefined;
            let chosenEncodingProperName: string | undefined = undefined;

            // Prioritize options.encoding_order
            for (const orderedEnc of this.decaf.options.encoding_order) {
                const pluginEnc = DecafMUDGlobal.plugins.Encoding[orderedEnc];
                if (pluginEnc?.proper) {
                    if (receivedCharsets.includes(orderedEnc)) { // Direct match "utf8"
                        chosenEncodingKey = orderedEnc;
                        chosenEncodingProperName = orderedEnc;
                        break;
                    }
                    if (receivedCharsets.includes(pluginEnc.proper)) { // Match "UTF-8"
                        chosenEncodingKey = orderedEnc;
                        chosenEncodingProperName = pluginEnc.proper;
                        break;
                    }
                }
            }

            if (!chosenEncodingKey) { // If not found in order, check all available
                 for (const encKey in DecafMUDGlobal.plugins.Encoding) {
                    if (Object.prototype.hasOwnProperty.call(DecafMUDGlobal.plugins.Encoding, encKey)) {
                        const pluginEnc = DecafMUDGlobal.plugins.Encoding[encKey];
                        if (pluginEnc?.proper) {
                             if (receivedCharsets.includes(encKey)) {
                                chosenEncodingKey = encKey;
                                chosenEncodingProperName = encKey;
                                break;
                            }
                            if (receivedCharsets.includes(pluginEnc.proper)) {
                                chosenEncodingKey = encKey;
                                chosenEncodingProperName = pluginEnc.proper;
                                break;
                            }
                        }
                    }
                }
            }

            if (chosenEncodingKey && chosenEncodingProperName) {
                this.decaf.setEncoding(chosenEncodingKey);
                this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + '\x02' + chosenEncodingProperName + TN.IAC + TN.SE); // ACCEPTED
            } else {
                this.decaf.debugString("No suitable encoder found for: " + receivedCharsets.join(sep), "warn");
                this.decaf.sendIAC(TN.IAC + TN.SB + TN.CHARSET + '\x03' + TN.IAC + TN.SE); // REJECTED
            }

        } else if (data.charCodeAt(0) === 2) { // ACCEPTED
            const acceptedEncProperName = data.substring(1);
            let foundKey: string | undefined = undefined;
            for (const encKey in DecafMUDGlobal.plugins.Encoding) {
                 if (Object.prototype.hasOwnProperty.call(DecafMUDGlobal.plugins.Encoding, encKey)) {
                    if (DecafMUDGlobal.plugins.Encoding[encKey].proper === acceptedEncProperName) {
                        foundKey = encKey;
                        break;
                    }
                }
            }
            if (foundKey) {
                this.decaf.setEncoding(foundKey);
            } else {
                 this.decaf.debugString(`Server accepted unknown encoding: ${acceptedEncProperName}`, "warn");
            }
        }
        // Other CHARSET subnegotiation commands (REJECTED, TTABLE-ACK, etc.) are not typically sent by servers
        // or don't require a specific client response beyond what DONT/WONT would handle.
        return false; // Suppress default debug message for SB
    }
}
