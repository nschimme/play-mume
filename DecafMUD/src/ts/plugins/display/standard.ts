/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD Display Provider: Standard
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

import { DecafMUD } from '../../decafmud'; // Adjust path as needed
// import { TN } from '../../decafmud'; // Not directly used here, but DecafMUD.ESC is

// Helper functions (can be private static or module-local)
function addEvent(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
    if (node.addEventListener) {
        node.addEventListener(etype, func, false);
        return;
    }
    // Fallback for older browsers (though largely obsolete)
    if ((node as any).attachEvent) {
        (node as any).attachEvent('on' + etype, func);
    } else {
        (node as any)['on' + etype] = func;
    }
}

function delEvent(node: EventTarget, etype: string, func: EventListenerOrEventListenerObject): void {
    if (node.removeEventListener) {
        node.removeEventListener(etype, func, false);
    }
    // Fallback for older browsers
    // No straightforward 'detachEvent' for all cases if attachEvent wasn't used or if node[onetype] was overwritten
}


// ANSI SGR Flags (using const for immutability)
const BRIGHT = 1 << 0;    // 00000001
const NEGATIVE = 1 << 1;  // 00000010
const ITALIC = 1 << 2;    // 00000100
const BLINK = 1 << 3;     // 00001000
const UNDERLINE = 1 << 4; // 00010000
const FAINT = 1 << 5;     // 00100000
const STRIKE = 1 << 6;    // 01000000
const DBLUNDER = 1 << 7;  // 10000000

interface MxpTagArgument {
    [key: string]: string | boolean | number;
}

interface MxpTagDefinition {
    default: boolean;
    secure: boolean;
    want: boolean;
    open_tag: string;
    close_tag: string;
    arg_order?: string[];
    arguments?: MxpTagArgument;
    handler?: (...args: any[]) => void; // Define more specific handler signature if possible
    [key: string]: any; // Allow other properties
}

interface MxpTags {
    [tagName: string]: MxpTagDefinition | string; // string for aliases
}


export class StandardDisplay {
    private decaf: DecafMUD;
    private ui: any; // Should be a specific UI interface type
    private _display: HTMLElement; // The container element for this display instance

    public display: HTMLElement; // The main div where content is rendered
    private splash: string;
    private orig_title: string | null = null;

    // ANSI State
    private state: number = 0;
    private c_fg: number = 7;
    private c_bg: number = 0;
    private c_fnt: number = 0; // Font choice
    private readyClear: boolean = false; // For VT100 clear screen commands
    // private endSpace: boolean = false; // Not used in provided code
    private scrollTime: ReturnType<typeof setTimeout> | null = null;
    private willScroll: boolean | undefined = undefined; // true, false, or undefined (means check)
    private vt100Warning: boolean = false;
    public mxp: boolean = false; // Whether MXP is active

    private inbuf: string[] = [];
    private outbuf: string[] = [];
    private needline: boolean = false; // True if the last output didn't end with a newline

    private sbw: number | undefined = undefined; // Scrollbar width cache
    private cz: [number, number] | undefined = undefined; // Character size [width, height] cache
    private scrollTarget: HTMLElement | undefined = undefined; // HR element used as scroll point marker

    // MXP Tags (simplified, full typing would be extensive)
    public tags: MxpTags = {
        'VAR': {
            'default': true, 'secure': true, 'want': true,
            'open_tag': '', 'close_tag': '',
            'arg_order': ['name', 'desc', 'private', 'publish', 'delete', 'add', 'remove'],
            'arguments': { 'name': '', 'desc': '', 'private': false, 'publish': true, 'delete': false, 'add': true, 'remove': false },
            'handler': function () { } // Placeholder
        },
        'B': { 'default': true, 'secure': false, 'want': false, 'open_tag': '<b class="mxp">', 'close_tag': '</b>' },
        'BOLD': 'B', 'STRONG': 'B',
        'I': { 'default': true, 'secure': false, 'want': false, 'open_tag': '<i class="mxp">', 'close_tag': '</i>' },
        'ITALIC': 'I', 'EM': 'I',
        'U': { 'default': true, 'secure': false, 'want': false, 'open_tag': '<u class="mxp">', 'close_tag': '</u>' },
        'UNDERLINE': 'U',
        'S': { 'default': true, 'secure': false, 'want': false, 'open_tag': '<s class="mxp">', 'close_tag': '</s>' },
        'STRIKEOUT': 'S',
        'COLOR': {
            'default': true, 'secure': false, 'want': false,
            'open_tag': '<span class="mxp mxp-color" style="color:&fore;;background-color:&back;">',
            'close_tag': '</span>',
            'arg_order': ['fore', 'back'],
            'arguments': { 'fore': 'inherit', 'back': 'inherit' }
        },
        'C': 'COLOR',
        'HIGH': { 'default': true, 'secure': false, 'want': true, 'open_tag': '', 'close_tag': '' } // Placeholder
    };


    constructor(decaf: DecafMUD, ui: any, disp: HTMLElement) {
        this.decaf = decaf;
        this.ui = ui;
        this._display = disp;

        this.display = document.createElement('div');
        this.display.className = `decafmud display ${this.decaf.options.set_display.fgclass}7`; // Default color
        this._display.appendChild(this.display);

        addEvent(this._display, 'scroll', this.onScroll.bind(this));
        addEvent(this._display, 'mousedown', (e: MouseEvent) => {
            if (e.which !== 2 || !this.decaf.store.get('ui/middle-click-scroll', false)) { return; }
            this.scroll();
            if (e.cancelBubble) { e.cancelBubble = true; }
            e.preventDefault();
        });

        this.decaf.loaded_plugs.display = this; // Keep this pattern for now

        this.splash = this.display.innerHTML; // Capture any pre-existing splash text
        this.orig_title = document.title; // Store original document title

        this.clear(); // Initialize state

        this.message('<br><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> v' + DecafMUD.version.toString() + ' by Stendec &lt;<a href="mailto:stendec365@gmail.com">stendec365@gmail.com</a>&gt;<br>');
        if (this.splash.length > 0) {
            this.message(this.splash + '<br>');
        }
    }

    public clear(): void {
        if (this.scrollTime) clearTimeout(this.scrollTime);
        this.display.innerHTML = '';
        this.reset();
        this.inbuf = [];
        this.outbuf = [];
    }

    public reset(): void {
        this.state = 0;
        this.c_fg = 7;
        this.c_bg = 0;
        this.c_fnt = 0;
        this.readyClear = false;
        // this.endSpace = false; // Not used
    }

    private scrollbarWidth(): number {
        if (this.sbw !== undefined) { return this.sbw; }

        const oldOverflowY = this._display.style.overflowY;
        this._display.style.overflowY = 'scroll';
        if (this._display.offsetWidth > this._display.clientWidth) {
            this.sbw = this._display.offsetWidth - this._display.clientWidth;
            this._display.style.overflowY = oldOverflowY; // Restore
            return this.sbw;
        }
        this._display.style.overflowY = oldOverflowY;
        this.sbw = 15; // Default if undetectable
        return this.sbw;
    }

    private charSize(): [number, number] {
        if (this.cz !== undefined) { return this.cz; }
        const span = document.createElement('span');
        span.style.visibility = 'hidden'; // Prevent brief flash
        span.style.position = 'absolute'; // Prevent layout shift
        span.innerHTML = 'W'; // Representative character
        this.display.appendChild(span);
        const w = span.offsetWidth;
        const h = span.offsetHeight;
        this.display.removeChild(span);
        this.cz = [w, h];
        return this.cz;
    }

    public getSize(): [number, number] {
        const sbw = this.decaf.options.set_display.scrollbarwidth || this.scrollbarWidth();
        const tw = this._display.clientWidth - sbw;
        const th = this._display.clientHeight;
        const [charW, charH] = this.charSize();

        if (charW === 0 || charH === 0) return [80, 24]; // Fallback if char size is zero

        return [Math.floor(tw / charW) + 1, Math.floor(th / charH)];
    }

    public handleData(data: string): void {
        this.inbuf.push(data);
        this.processData();
    }

    private processData(): void {
        if (this.inbuf.length < 1) { return; }
        let data = this.inbuf.join('');
        this.inbuf = [];

        const ESC = DecafMUD.ESC; // Static property from DecafMUD

        while (data.length > 0) {
            const ind = data.indexOf(ESC);
            if (ind === -1) {
                this.outbuf.push(data.replace(/</g, '&lt;'));
                break;
            }

            if (ind > 0) {
                this.readyClear = false;
                this.outbuf.push(data.substring(0, ind).replace(/</g, '&lt;'));
                data = data.substring(ind);
            }

            const remainingDataAfterAnsi = this.readANSI(data);
            if (remainingDataAfterAnsi === false) { // Incomplete ANSI sequence
                this.inbuf.push(data);
                break;
            }
            data = remainingDataAfterAnsi;
        }

        const outputHtml = this.outbuf.join('');
        this.outbuf = [];
        this.outColor(false); // Ensure current color span is opened if needed

        this.needline = !outputHtml.endsWith('\n') && !outputHtml.endsWith('<br>');

        this._display.setAttribute('aria-busy', 'true');

        const span = document.createElement('span');
        // Process line breaks and spacing
        let processedHtml = outputHtml.replace(/\n\r?/g, '<br>');
        processedHtml = processedHtml.replace(/> /g, '>&nbsp;'); // Space after tag
        processedHtml = processedHtml.replace(/ ( +)/g, (match: string) => { // Multiple spaces
            if (match.length === 2) { return ' &nbsp;'; }
            return ' ' + '&nbsp;'.repeat(match.length - 2) + ' ';
        });
        span.innerHTML = processedHtml;

        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();

        this.truncateLines();
    }

    private truncateLines(): void {
        const maxScreens = this.decaf.options.set_display.maxscreens;
        const minElements = this.decaf.options.set_display.minelements;
        const displayHeight = this.display.clientHeight;
        const windowInnerHeight = typeof window !== 'undefined' ? window.innerHeight : displayHeight; // Fallback for non-browser

        if (displayHeight < (windowInnerHeight * maxScreens) || this.display.children.length < minElements) {
            return;
        }

        let removedHeight = 0;
        const elementsToRemove: HTMLElement[] = [];
        // Calculate target height to remove (scrollback beyond maxscreens)
        const targetHeightToRemove = displayHeight - (windowInnerHeight * maxScreens);

        // Iterate from the top (oldest children)
        for (let i = 0; i < this.display.children.length; i++) {
            if (removedHeight >= targetHeightToRemove) break;
            const child = this.display.children[i] as HTMLElement;
            removedHeight += child.offsetHeight;
            elementsToRemove.push(child);
        }

        elementsToRemove.forEach(el => el.remove());
    }


    private readANSI(data: string): string | false {
        if (data.length < 2) { return false; } // Not enough data for ESC + char

        const secondChar = data.charAt(1);
        if (secondChar === '[') { // CSI Sequence
            const csiMatch = data.substring(2).match(/^([\d;]*)([\x40-\x7E])/);
            if (!csiMatch) { return false; } // Incomplete CSI

            const params = csiMatch[1];
            const command = csiMatch[2];
            this.handleAnsiCSI(params + command); // Pass params and command char
            return data.substring(2 + csiMatch[0].length);

        } else if (secondChar === ']') { // OSC Sequence
            const oscEndBel = data.substring(2).indexOf(DecafMUD.BEL);
            const oscEndSt = data.substring(2).indexOf(DecafMUD.ESC + '\\');

            let endMarkerIndex = -1;
            if (oscEndBel !== -1 && (oscEndSt === -1 || oscEndBel < oscEndSt)) {
                endMarkerIndex = oscEndBel;
            } else if (oscEndSt !== -1) {
                endMarkerIndex = oscEndSt;
            }

            if (endMarkerIndex === -1) { return false; } // Incomplete OSC

            // const oscContent = data.substring(2, 2 + endMarkerIndex);
            // this.handleAnsiOSC(oscContent); // OSC handling (e.g., title) can be added here
            // For now, just consuming it
            const consumedLength = 2 + endMarkerIndex + (data.substring(2 + endMarkerIndex).startsWith(DecafMUD.ESC + '\\') ? 2 : 1);
            return data.substring(consumedLength);
        }

        // Unrecognized ESC sequence, consume ESC and move on
        return data.substring(1);
    }

    private handleAnsiCSI(seq: string): void { // seq includes params and command char
        const command = seq.charAt(seq.length - 1);
        const paramsStr = seq.substring(0, seq.length - 1);
        const params = paramsStr.split(';').map(p => parseInt(p, 10));

        switch (command) {
            case 'm': // SGR (Select Graphic Rendition)
                const oldState = { s: this.state, fg: this.c_fg, bg: this.c_bg, fnt: this.c_fnt };
                if (paramsStr === '' || params[0] === 0) { // ESC[m or ESC[0m
                    this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0;
                } else {
                    for (let i = 0; i < params.length; i++) {
                        const c = params[i];
                        if (c === 38) { // XTERM Foreground Color
                            if (params[i+1] === 5 && params[i+2] !== undefined) { // ESC[38;5;{ID}m
                                this.c_fg = params[i+2]; i += 2;
                            } else if (params[i+1] === 2 && params[i+4] !== undefined) { // ESC[38;2;{R};{G};{B}m (True Color)
                                // True color not directly supported by current class structure, map or ignore
                                i += 4; // Consume params
                            }
                        } else if (c === 48) { // XTERM Background Color
                             if (params[i+1] === 5 && params[i+2] !== undefined) { // ESC[48;5;{ID}m
                                this.c_bg = params[i+2]; i += 2;
                            } else if (params[i+1] === 2 && params[i+4] !== undefined) { // ESC[48;2;{R};{G};{B}m (True Color)
                                i += 4; // Consume params
                            }
                        } else if (c === 39) { this.c_fg = 7; } // Default Foreground
                        else if (c === 49) { this.c_bg = 0; } // Default Background
                        else if (c >= 30 && c <= 37) { this.c_fg = c - 30; } // Standard Foreground
                        else if (c >= 40 && c <= 47) { this.c_bg = c - 40; } // Standard Background
                        else if (c >= 90 && c <= 97) { this.state |= BRIGHT; this.c_fg = c - 90; } // Bright Foreground
                        else if (c >= 100 && c <= 107) { this.state |= BRIGHT; this.c_bg = c - 100; } // Bright Background (Note: original code used c-92, seems off)
                        else if (c === 0) { this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0; }
                        else if (c === 1) { this.state |= BRIGHT; this.state &= ~FAINT; }
                        else if (c === 2) { this.state &= ~BRIGHT; this.state |= FAINT; }
                        else if (c === 3) { this.state |= ITALIC; }
                        else if (c === 4) { this.state |= UNDERLINE; this.state &= ~DBLUNDER; }
                        else if (c === 5 || c === 6) { this.state |= BLINK; } // Slow / Rapid blink
                        else if (c === 7) { this.state |= NEGATIVE; }
                        else if (c === 8) { /* Conceal - Not Supported */ }
                        else if (c === 9) { this.state |= STRIKE; }
                        else if (c >= 10 && c <= 19) { this.c_fnt = c - 10; } // Font selection
                        else if (c === 21) { this.state |= DBLUNDER; this.state &= ~UNDERLINE; }
                        else if (c === 22) { this.state &= ~(BRIGHT | FAINT); } // Normal intensity
                        else if (c === 23) { this.state &= ~ITALIC; }
                        else if (c === 24) { this.state &= ~(UNDERLINE | DBLUNDER); }
                        else if (c === 25) { this.state &= ~BLINK; }
                        else if (c === 27) { this.state &= ~NEGATIVE; }
                        else if (c === 29) { this.state &= ~STRIKE; }
                    }
                }
                if (this.state !== oldState.s || oldState.fg !== this.c_fg || oldState.bg !== this.c_bg || oldState.fnt !== this.c_fnt) {
                    this.outColor();
                }
                this.readyClear = false;
                return;

            case '@': // Insert Characters (ICH)
            case 'C': // Cursor Forward (CUF)
                const countC = (params[0] || 1);
                this.outbuf.push(' '.repeat(countC));
                this.readyClear = false;
                return;

            case 'E': // Cursor Next Line (CNL)
                const countE = (params[0] || 1);
                this.outbuf.push('\n'.repeat(countE));
                this.readyClear = false;
                return;

            case 'H': // Cursor Position (CUP) or Set Mode (SM) - only CUP if no ? prefix
                 if (paramsStr === '') this.readyClear = true; // ESC[H often means home
                // Full CUP (ESC[{ROW};{COL}H) not implemented beyond readyClear for home
                return;

            case 'J': // Erase in Display (ED)
                const modeJ = (params[0] || 0);
                if ((modeJ === 0 && this.readyClear) || modeJ === 2) { // 0 from cursor to end, 2 for entire screen
                    this.clear();
                }
                // Mode 1 (start to cursor) not fully implemented
                this.readyClear = false;
                return;

            case 'K': // Erase in Line (EL)
                const modeK = (params[0] || 0);
                if (modeK === 2) { // Erase entire line
                    let found = false;
                    if (this.outbuf.length > 0) {
                        while (this.outbuf.length > 0) {
                            const lastEntry = this.outbuf[this.outbuf.length - 1];
                            const lastNewline = lastEntry.lastIndexOf('\n');
                            if (lastNewline === -1) {
                                this.outbuf.pop(); // Remove entry if no newline
                            } else {
                                found = true;
                                this.outbuf[this.outbuf.length - 1] = lastEntry.substring(0, lastNewline + 1);
                                break;
                            }
                        }
                    }
                    if (!found && this.display.childElementCount > 0) {
                        // Check rendered elements
                        while (this.display.lastChild) {
                            const lastElement = this.display.lastChild as HTMLElement;
                            const html = lastElement.innerHTML; // Check innerHTML for <br>
                            const lastBr = html.lastIndexOf('<br>');
                            if (lastBr === -1) {
                                this.display.removeChild(lastElement);
                            } else {
                                found = true;
                                lastElement.innerHTML = html.substring(0, lastBr + 4);
                                break;
                            }
                            if (this.display.childElementCount === 0) break; // Safety break
                        }
                    }
                } else if (modeK === 1) { // Erase from start of line to cursor
                    this.decaf.debugString(`ANSI Sequence ESC[${seq} -- EL Mode 1 (Erase to SOL) not fully implemented`);
                } else if (modeK === 0) { // Erase from cursor to EOL
                     this.decaf.debugString(`ANSI Sequence ESC[${seq} -- EL Mode 0 (Erase to EOL) not fully implemented`);
                }
                return;
        }

        // Fallback for unhandled CSI sequences
        if ('ABDFGHJKSTfnsulh'.includes(command)) { // Common cursor movement / erase, often unneeded for simple scroll
            if (!this.vt100Warning) {
                this.decaf.debugString("Notice: This display handler only provides a subset of VT100, and doesn't handle all cursor movement/erase commands.");
                this.vt100Warning = true;
            }
        } else {
            this.decaf.debugString(`Unhandled ANSI Sequence: ESC[${seq}`);
        }
    }

    private outColor(closing: boolean = true, ret: boolean = false): string | void {
        let fg = this.c_fg;
        let bg = this.c_bg;
        const s = this.state;
        const opt = this.decaf.options.set_display;
        let classNames = '';

        if (s & BRIGHT && fg < 8) { fg += 8; } // Brighten standard colors

        if (s & ITALIC)    { classNames += 'italic '; }
        if (s & BLINK)     { classNames += 'blink '; }
        if (s & UNDERLINE) { classNames += 'underline '; }
        if (s & DBLUNDER)  { classNames += 'doubleunderline '; }
        if (s & FAINT)     { classNames += 'faint '; }
        if (s & STRIKE)    { classNames += 'strike '; }

        if (s & NEGATIVE)  { // Swap fg and bg
            const tempFg = fg;
            fg = this.c_bg; // Use original bg before bright adjustment for swapped fg
            bg = tempFg;    // Use fg (potentially brightened) for swapped bg
            if (s & BRIGHT && fg < 8 && this.c_bg < 8) fg +=8; // If original bg was standard, brighten it for Negative+Bright
        }

        if (this.c_fnt !== 0) { classNames += `${opt.fntclass}${this.c_fnt} `; }
        if (fg !== 7)         { classNames += `${opt.fgclass}${fg} `; }
        if (bg !== 0)         { classNames += `${opt.bgclass}${bg}`; }

        classNames = classNames.trim();

        const output = (closing ? '</span>' : '') + (classNames ? `<span class="${classNames}">` : '<span>');

        if (ret) { return output; }
        this.outbuf.push(output);
    }

    public message(text: string, className: string = 'message', needLine: boolean = true): void {
        const span = document.createElement('span');
        span.className = className; // Assign class to the message span itself

        let htmlContent = '';
        if (this.needline && needLine) {
            htmlContent += '<br>';
        }
        this.needline = false; // Reset after potentially adding a <br>

        // Process multiple spaces for the message text
        const processedText = text.replace(/ ( +)/g, (match: string) => {
            if (match.length === 2) { return ' &nbsp;'; }
            return ' ' + '&nbsp;'.repeat(match.length - 2) + ' ';
        });

        htmlContent += processedText + '<br>'; // Ensure message ends with a line break
        span.innerHTML = htmlContent;

        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();
    }

    private shouldScroll(addTarget: boolean = true): void {
        if (this.willScroll !== undefined || this._display.style.overflowY === 'hidden') { return; }
        // Check if scrolled to bottom (or very close to it)
        this.willScroll = this._display.scrollTop + this._display.offsetHeight >= this._display.scrollHeight - 5; // 5px buffer

        if (addTarget && !this.willScroll && !this.scrollTarget) {
            const st = document.createElement('hr');
            st.className = 'scroll-point';
            this.scrollTarget = st;
            this.display.appendChild(st);

            if (this.ui && this.ui.showScrollButton) {
                this.ui.showScrollButton();
            }
        }
    }

    private doScroll(): void {
        if (this.scrollTime) clearTimeout(this.scrollTime);

        if (this.willScroll) {
            this.scrollTime = setTimeout(() => {
                if (this.scrollTarget) {
                    this.scrollTarget.remove();
                    this.scrollTarget = undefined;
                }
                this._display.setAttribute('aria-busy', 'false');
                this.scroll(); // Scroll to bottom
                this.willScroll = undefined; // Reset for next check
            }, 5);
        } else {
            this.scrollTime = setTimeout(() => {
                this._display.setAttribute('aria-busy', 'false');
                this.willScroll = undefined; // Reset for next check
            }, 5);
        }
    }

    public scrollNew(): void {
        if (!this.scrollTarget) {
            this.scroll(); // If no target, just scroll to bottom
            return;
        }
        const to = this.scrollTarget.offsetTop;
        if (to > this._display.scrollTop) {
            this._display.scrollTop = to;
        } else {
            this.scroll(); // If target is above current view or not useful, scroll to end
        }
    }

    public scroll(): void {
        if (this._display.style.overflowY === 'hidden') { return; }
        this._display.scrollTop = this._display.scrollHeight;
    }

    private onScroll(): void {
        if (!this.scrollTarget) { return; }
        // If scrolled to the bottom manually
        if (this._display.scrollTop + this._display.offsetHeight >= this._display.scrollHeight - 5) { // 5px buffer
            this.scrollTarget.remove();
            this.scrollTarget = undefined;
            if (this.ui && this.ui.hideScrollButton) {
                this.ui.hideScrollButton();
            }
        }
    }

    public scrollUp(): void {
        const top = this._display.scrollTop - this._display.clientHeight;
        this._display.scrollTop = Math.max(0, top);
    }

    public scrollDown(): void {
        this._display.scrollTop += this._display.clientHeight;
    }
}

// Registration will be handled in decafmud.ts:
// import { StandardDisplay } from './plugins/display/standard';
// DecafMUD.plugins.Display.standard = StandardDisplay;
```
