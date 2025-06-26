/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Adapted for TypeScript by Jules
 */

import { DecafMUD, DecafMUDDisplay, DecafMUDInterface } from "./decafmud";

const addEvent = function(node: HTMLElement | Window, etype: string, func: EventListenerOrEventListenerObject): void {
    if (node.addEventListener) {
        node.addEventListener(etype, func, false);
        return;
    }
    // Fallback for older IE (not strictly necessary for modern targets but kept for fidelity)
    const onEtype = 'on' + etype as keyof WindowEventMap;
    if ((node as any).attachEvent) {
        (node as any).attachEvent(onEtype, func);
    } else {
        (node as any)[onEtype] = func;
    }
};

// delEvent is not used in the original script, so omitting unless needed.

// ANSI Flags (copied from original, ensure these are not duplicated if defined elsewhere)
const BRIGHT    = 1;  // 00000001
const NEGATIVE  = 2;  // 00000010
const ITALIC    = 4;  // 00000100
const BLINK     = 8;  // 00001000
const UNDERLINE = 16; // 00010000
const FAINT     = 32; // 00100000
const STRIKE    = 64; // 01000000
const DBLUNDER  = 128;// 10000000

class StandardDisplay implements DecafMUDDisplay {
    // DecafMUD instance
    private decaf: DecafMUD;
    // UI Interface instance
    private ui: DecafMUDInterface;
    // The main container element for the display output (e.g., #decafmud-display-pane)
    private _displayContainer: HTMLElement;
    // The actual div where lines of text are appended
    public display: HTMLElement;

    private splash: string = '';
    // private orig_title: string | null = null; // Not used

    // ANSI State
    private state: number = 0;
    private c_fg: number = 7;
    private c_bg: number = 0;
    private c_fnt: number = 0; // Font choice from ANSI codes 10-19

    private readyClear: boolean = false; // For ANSI clear screen sequence
    // private endSpace: boolean = false; // Not used

    private scrollTime: any = null; // NodeJS.Timeout or number
    private willScroll: boolean | undefined = undefined; // undefined means check, true/false means decision made
    private scrollTarget?: HTMLElement; // HR element used as a scroll point marker

    private vt100Warning: boolean = false; // To show VT100 subset warning only once
    public mxp: boolean = false; // MXP mode active (currently unused functionality)

    // Buffers
    private inbuf: string[] = []; // Buffer for incoming raw data
    private outbuf: string[] = []; // Buffer for processed HTML strings before appending to DOM
    private needline: boolean = false; // True if the last output didn't end with a newline

    // Cached values
    private sbw: number | undefined = undefined; // Scrollbar width
    private cz: [number, number] | undefined = undefined; // Character width and height [w, h]

    // DecafMUD options for display
    private displayOptions: any; // Should be specific type from DecafMUDOptions['set_display']


    constructor(decaf: DecafMUD, ui: DecafMUDInterface, dispContainer: HTMLElement) {
        this.decaf = decaf;
        this.ui = ui;
        this._displayContainer = dispContainer;
        this.displayOptions = this.decaf.options.set_display || {};

        this.display = document.createElement('div');
        // Default class plus fg7 for default white text
        this.display.className = 'decafmud display ' + (this.displayOptions.fgclass || 'c') + '7';
        this._displayContainer.appendChild(this.display);

        addEvent(this._displayContainer, 'scroll', () => this.onScroll());
        addEvent(this._displayContainer, 'mousedown', (event) => {
            const e = event as MouseEvent;
            // Middle-click scroll to bottom
            if (e.which !== 2 || !this.decaf.storage?.get('ui/middle-click-scroll', false)) {
                return;
            }
            this.scroll();
            if (e.stopPropagation) e.stopPropagation(); // Modern way
            if ((e as any).cancelBubble !== undefined) (e as any).cancelBubble = true; // Older IE
            e.preventDefault();
        });

        // Store this in DecafMUD's loaded plugins registry (if DecafMUD supports this pattern)
        // This was `this.decaf.loaded_plugs.display = this;`
        // For TS, plugins are usually registered differently, but to maintain compatibility:
        if (!(this.decaf as any).loaded_plugs) { (this.decaf as any).loaded_plugs = {}; }
        (this.decaf as any).loaded_plugs.display = this;


        this.splash = this.display.innerHTML; // Capture any existing splash text
        this.clear(); // Clears display and resets ANSI state
        // Example of tr usage if it were here:
        // this.someProperty = ("Test string {0}").tr(this.decaf, "value");

        this.message('<br><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> v' + DecafMUD.version.toString() + ' by Stendec &lt;<a href="mailto:stendec365@gmail.com">stendec365@gmail.com</a>&gt;<br>');
        if (this.splash.length > 0) {
            this.message(this.splash + '<br>');
        }
    }

    clear(): void {
        clearTimeout(this.scrollTime);
        this.display.innerHTML = '';
        this.reset();
        this.inbuf = [];
        this.outbuf = [];
    }

    reset(): void {
        this.state = 0;
        this.c_fg = 7;
        this.c_bg = 0;
        this.c_fnt = 0;
        this.readyClear = false;
        // this.endSpace = false; // Not used
    }

    private scrollbarWidth(): number {
        if (this.sbw !== undefined) { return this.sbw; }

        const oldOverflowY = this._displayContainer.style.overflowY;
        this._displayContainer.style.overflowY = 'scroll';
        if (this._displayContainer.offsetWidth > this._displayContainer.clientWidth) {
            this.sbw = this._displayContainer.offsetWidth - this._displayContainer.clientWidth;
            this._displayContainer.style.overflowY = oldOverflowY; // Restore
            return this.sbw;
        }
        this._displayContainer.style.overflowY = oldOverflowY; // Restore
        return 15; // Default fallback
    }

    private charSize(): [number, number] {
        if (this.cz) { return this.cz; }
        const span = document.createElement('span');
        span.innerHTML = 'W'; // Use a common wide character
        this.display.appendChild(span);
        const w = span.offsetWidth;
        const h = span.offsetHeight;
        this.display.removeChild(span);
        this.cz = [w, h];
        return this.cz;
    }

    getSize(): [number, number] {
        let sbw = this.displayOptions.scrollbarwidth;
        if (sbw === undefined) {
            sbw = this.scrollbarWidth();
        }

        const tw = this._displayContainer.clientWidth - sbw;
        const th = this._displayContainer.clientHeight;
        const [charW, charH] = this.charSize();

        if (charW === 0 || charH === 0) return [80, 24]; // Fallback if char size is zero

        return [Math.floor(tw / charW) + 1, Math.floor(th / charH)];
    }

    handleData(data: string): void {
        this.inbuf.push(data);
        this.processData();
    }

    private processData(): void {
        if (this.inbuf.length < 1) { return; }
        let data = this.inbuf.join('');
        this.inbuf = [];

        const ESC = DecafMUD.ESC; // "\x1B"

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

            const remainingDataAfterANSI = this.readANSI(data);
            if (remainingDataAfterANSI === false) { // Incomplete ANSI sequence
                this.inbuf.push(data); // Push back for next processing cycle
                break;
            }
            data = remainingDataAfterANSI as string;
        }

        const processedHTML = this.outbuf.join('');
        this.outbuf = [];
        this.outColor(false); // Ensure final span is closed if one was open

        if (processedHTML.length === 0) return;

        this.needline = !processedHTML.endsWith('\n') && !processedHTML.endsWith('<br>'); // Check for explicit newlines too

        this._displayContainer.setAttribute('aria-busy', 'true');

        const span = document.createElement('span');
        // Replace newlines, then multiple spaces, being careful with > entities
        span.innerHTML = processedHTML
            .replace(/\n\r?/g, '<br>')
            .replace(/> /g, '>&nbsp;') // Space after >
            .replace(/ ( +)/g, (match: string) => { // Multiple spaces
                if (match.length === 2) { return ' &nbsp;'; } // Single space followed by one space -> &nbsp;
                return ' ' + '&nbsp;'.repeat(match.length - 2) + ' '; // Space, then n-2 nbsp, then space
            });

        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();

        this.truncateLines();
    }

    private truncateLines(): void {
        const maxScreens = this.displayOptions.maxscreens || 100;
        const minElements = this.displayOptions.minelements || 10;
        const windowInnerHeight = (typeof window !== 'undefined') ? window.innerHeight : 800; // Fallback for non-browser

        if (this.display.clientHeight < (windowInnerHeight * maxScreens) || this.display.children.length < minElements) {
            return;
        }

        let heightToRemove = 0;
        const elementsToRemove: HTMLElement[] = [];
        // Target height to reach after truncation (e.g. if maxscreens is 2, keep 2 screens worth)
        // Original logic was: targetHeight = (this.display.clientHeight - (window.innerHeight * maxscreens))
        // This seems to calculate how much to *remove* to get *down to* maxscreens.
        // Let's re-evaluate: we want to remove lines if current height > maxscreens * windowInnerHeight
        // And we want to remove lines until current height is approx (maxscreens - buffer) * windowInnerHeight
        // Or, simpler: remove oldest lines until total lines are below a certain threshold.

        // The original logic seems to aim to remove elements if current height > maxScreens * window.innerHeight
        // And remove enough to bring it below that.
        const currentScrollHeight = this.display.scrollHeight;
        const targetScrollHeight = windowInnerHeight * maxScreens;

        if (currentScrollHeight > targetScrollHeight) {
            let removedHeight = 0;
            const amountToRemove = currentScrollHeight - targetScrollHeight;

            // Iterate from the oldest children
            for (let i = 0; i < this.display.children.length; i++) {
                const child = this.display.children[i] as HTMLElement;
                if (removedHeight >= amountToRemove || this.display.children.length - elementsToRemove.length <= minElements) {
                    break;
                }
                removedHeight += child.offsetHeight;
                elementsToRemove.push(child);
            }
        }

        elementsToRemove.forEach(el => el.remove());
    }


    private readANSI(data: string): string | false {
        if (data.length < 2) { return false; }

        const secondChar = data.charAt(1);
        if (secondChar === '[') { // CSI
            const csiMatch = data.substring(2).match(/^([0-9;]*)([@-~])/);
            if (!csiMatch) { return false; } // Incomplete CSI

            const params = csiMatch[1];
            const command = csiMatch[2];
            this.handleAnsiCSI(params + command);
            return data.substring(2 + csiMatch[0].length);

        } else if (secondChar === ']') { // OSC
            const oscMatch = data.substring(2).match(/^(.*?)((\x1B\\)|(\x07))/); // End with ESC \ or BEL
            if (!oscMatch) { return false; } // Incomplete OSC

            // this.handleAnsiOSC(oscMatch[1]); // OSC command string
            // For now, OSC commands are ignored as in original's active logic
            return data.substring(2 + oscMatch[0].length);
        }
        // Unknown ESC sequence, just skip the ESC char
        return data.substring(1);
    }

    private handleAnsiCSI(seq: string): void {
        const command = seq.charAt(seq.length - 1);
        const paramsStr = seq.substring(0, seq.length - 1);
        const params = paramsStr.split(';').map(p => parseInt(p, 10));

        switch (command) {
            case 'm': // SGR (Select Graphic Rendition)
                const oldState = { s: this.state, fg: this.c_fg, bg: this.c_bg, fnt: this.c_fnt };
                if (paramsStr === '' || paramsStr === '0') { // ESC[m or ESC[0m
                    this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0;
                } else {
                    for (let i = 0; i < params.length; i++) {
                        const c = isNaN(params[i]) ? 0 : params[i]; // Default to 0 if NaN (e.g. empty param)
                        if (c === 38) { // XTERM Foreground Color
                            if (params[i+1] === 5 && params[i+2] !== undefined) { // ESC[38;5;{ID}m
                                this.c_fg = params[i+2];
                                i += 2;
                            } // Add support for 24-bit color if needed: ESC[38;2;r;g;bm
                        } else if (c === 39) { this.c_fg = 7; } // Default Foreground
                        else if (c === 48) { // XTERM Background Color
                             if (params[i+1] === 5 && params[i+2] !== undefined) { // ESC[48;5;{ID}m
                                this.c_bg = params[i+2];
                                i += 2;
                            } // Add support for 24-bit color if needed: ESC[48;2;r;g;bm
                        } else if (c === 49) { this.c_bg = 0; } // Default Background
                        else if (c >= 30 && c <= 37) { this.c_fg = c - 30; } // Standard Foreground
                        else if (c >= 40 && c <= 47) { this.c_bg = c - 40; } // Standard Background
                        else if (c >= 90 && c <= 97) { this.state |= BRIGHT; this.state &= ~FAINT; this.c_fg = c - 90 + 8; } // Bright Foreground (map to 8-15)
                        else if (c >= 100 && c <= 107) { this.c_bg = c - 100 + 8; } // Bright Background (map to 8-15)
                        else {
                            switch (c) {
                                case 0: this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0; break;
                                case 1: this.state |= BRIGHT; this.state &= ~FAINT; break;
                                case 2: this.state |= FAINT; this.state &= ~BRIGHT; break;
                                case 3: this.state |= ITALIC; break;
                                case 4: this.state |= UNDERLINE; this.state &= ~DBLUNDER; break;
                                case 5: this.state |= BLINK; break; // Slow blink
                                case 6: this.state |= BLINK; break; // Fast blink (treat as slow)
                                case 7: this.state |= NEGATIVE; break;
                                case 8: /* Conceal - not supported */ break;
                                case 9: this.state |= STRIKE; break;
                                case 21: this.state |= DBLUNDER; this.state &= ~UNDERLINE; break;
                                case 22: this.state &= ~(BRIGHT | FAINT); break; // Normal intensity
                                case 23: this.state &= ~ITALIC; break;
                                case 24: this.state &= ~(UNDERLINE | DBLUNDER); break;
                                case 25: this.state &= ~BLINK; break;
                                case 27: this.state &= ~NEGATIVE; break;
                                case 29: this.state &= ~STRIKE; break;
                                default: if (c >= 10 && c <= 19) { this.c_fnt = c - 10; } // Font selection
                                    break;
                            }
                        }
                    }
                }
                if (this.state !== oldState.s || this.c_fg !== oldState.fg || this.c_bg !== oldState.bg || this.c_fnt !== oldState.fnt) {
                    this.outColor();
                }
                this.readyClear = false;
                return;

            case '@': // Insert Characters (ICH)
            case 'C': // Cursor Forward (CUF)
                const countCUF = (params[0] || 1);
                this.outbuf.push('&nbsp;'.repeat(countCUF));
                this.readyClear = false;
                return;

            case 'E': // Cursor Next Line (CNL)
                const countCNL = (params[0] || 1);
                this.outbuf.push('<br>'.repeat(countCNL));
                this.readyClear = false;
                return;

            case 'H': // Cursor Position (CUP)
            case 'f': // Horizontal and Vertical Position (HVP)
                 // CUP with no params (or 0,0 / 1,1) means home
                if (params.length === 0 || (params.length === 1 && params[0] === 0) || (params.length === 2 && (params[0] === 0 || params[0] === 1) && (params[1] === 0 || params[1] === 1))) {
                    this.readyClear = true;
                } else {
                    // Other cursor movements are ignored for now
                    this.readyClear = false;
                }
                return;

            case 'J': // Erase in Display (ED)
                const modeJ = (params[0] || 0);
                if ((modeJ === 0 && this.readyClear) || modeJ === 2) { // 0 from cursor to end, 2 for entire screen
                    this.clear(); // Effectively clears and resets
                } else if (modeJ === 1) { // from start to cursor
                    // This is complex to implement perfectly without full cursor tracking.
                    // A simple approximation: clear current line's buffered output.
                    if (this.outbuf.length > 0) {
                        const lastEntry = this.outbuf.pop()!;
                        const lastNewline = lastEntry.lastIndexOf('<br>');
                        if (lastNewline !== -1) {
                            this.outbuf.push(lastEntry.substring(0, lastNewline + 4));
                        } // else the current line is the only one in this entry, so it's cleared.
                    }
                }
                this.readyClear = false;
                return;

            case 'K': // Erase in Line (EL)
                const modeK = (params[0] || 0);
                if (modeK === 0) { // Erase from cursor to end of line
                    // Ignored for now, as we don't track cursor precisely within a line being built
                } else if (modeK === 1) { // Erase from start of line to cursor
                     // If outbuf has content for current line, clear it
                    if (this.outbuf.length > 0) {
                        const lastEntry = this.outbuf.pop()!;
                        const lastNewline = lastEntry.lastIndexOf('<br>');
                        if (lastNewline !== -1) { // Content on current line after a newline
                            this.outbuf.push(lastEntry.substring(0, lastNewline + 4));
                        } // else the current line is the only one in this entry, effectively clearing it.
                    }
                } else if (modeK === 2) { // Erase entire line
                    // If outbuf has content for current line, clear it
                    if (this.outbuf.length > 0) {
                        let lastEntry = this.outbuf.pop()!;
                        let lastNewline = lastEntry.lastIndexOf('<br>');
                        while(lastNewline === -1 && this.outbuf.length > 0) { // Current line spans multiple buffer entries
                            lastEntry = this.outbuf.pop()!;
                            lastNewline = lastEntry.lastIndexOf('<br>');
                        }
                        if (lastNewline !== -1) {
                             this.outbuf.push(lastEntry.substring(0, lastNewline + 4));
                        }
                    }
                    // Also try to remove from already rendered DOM if possible (complex)
                    // The original logic for mode 2 was to find last <br> and truncate.
                    if(this.display.childElementCount > 0) {
                        const lastChild = this.display.children[this.display.children.length-1] as HTMLElement;
                        const html = lastChild.innerHTML;
                        const brIndex = html.lastIndexOf('<br>');
                        if (brIndex !== -1) {
                            lastChild.innerHTML = html.substring(0, brIndex + 4);
                        } else {
                            lastChild.remove(); // If no <br>, the whole span was the line
                        }
                    }
                }
                this.readyClear = false;
                return;

            // Other VT100/ANSI codes that might be encountered but are not fully supported
            case 'A': // Cursor Up (CUU)
            case 'B': // Cursor Down (CUD)
            // case 'C': // Cursor Forward (CUF) - Handled above
            case 'D': // Cursor Backward (CUB)
            // case 'E': // Cursor Next Line (CNL) - Handled above
            case 'F': // Cursor Previous Line (CPL)
            case 'G': // Cursor Horizontal Absolute (CHA)
            // case 'H': // Cursor Position (CUP) - Handled above
            case 'S': // Scroll Up (SU)
            case 'T': // Scroll Down (SD)
            // case 'f': // Horizontal and Vertical Position (HVP) - Handled above
            case 'n': // Device Status Report (DSR)
            case 's': // Save Cursor Position (SCP)
            case 'u': // Restore Cursor Position (RCP)
            case 'l': // Reset Mode (RM)
            case 'h': // Set Mode (SM)
                if (!this.vt100Warning) {
                    this.decaf.debugString("Notice: This display handler only provides" +
                        " a subset of VT100, and doesn't fully handle cursor movement or mode commands like ESC[" + seq, 'warn');
                    this.vt100Warning = true;
                }
                break;
            default:
                this.decaf.debugString('Unhandled ANSI CSI Sequence: ESC [' + seq, 'warn');
        }
    }

    private outColor(closing: boolean = true): void {
        // Determine current fg, bg based on state (BRIGHT, NEGATIVE)
        let current_fg = this.c_fg;
        let current_bg = this.c_bg;

        if (this.state & BRIGHT && current_fg < 8) { current_fg += 8; }
        if (this.state & NEGATIVE) {
            const temp = current_fg;
            current_fg = current_bg; // If bg is > 7 (bright), fg becomes bright
            current_bg = (temp >= 8 && this.c_bg < 8) ? temp - 8 : temp; // If fg was bright, bg becomes normal equivalent
        }

        let classes = [];
        if (this.state & ITALIC) { classes.push('italic'); }
        if (this.state & BLINK) { classes.push('blink'); }
        if (this.state & UNDERLINE) { classes.push('underline'); }
        if (this.state & DBLUNDER) { classes.push('doubleunderline'); }
        if (this.state & FAINT) { classes.push('faint'); }
        if (this.state & STRIKE) { classes.push('strike'); }

        if (this.c_fnt !== 0) { classes.push((this.displayOptions.fntclass || 'fnt') + this.c_fnt); }
        if (current_fg !== 7) { classes.push((this.displayOptions.fgclass || 'c') + current_fg); }
        if (current_bg !== 0) { classes.push((this.displayOptions.bgclass || 'b') + current_bg); }

        let html = '';
        if (closing) { html += '</span>'; } // Close previous span
        html += '<span class="' + classes.join(' ') + '">';

        this.outbuf.push(html);
    }

    message(text: string, className: string = 'message', needLineArg?: boolean): void {
        const span = document.createElement('span');
        span.className = className; // Add class to the message span itself

        let html = '';
        if (this.needline && (needLineArg !== false)) {
            html += '<br>';
        }
        this.needline = false; // Message itself will end with a <br>

        // Process spaces like in processData
        html += text.replace(/ ( +)/g, (m: string) => {
            if (m.length === 2) { return ' &nbsp;'; }
            return ' ' + '&nbsp;'.repeat(m.length - 2) + ' ';
        }) + '<br>';

        span.innerHTML = html;

        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();
    }

    private shouldScroll(addTarget: boolean = true): void {
        if (this.willScroll !== undefined || this._displayContainer.style.overflowY === 'hidden') { return; }
        // Check if scrolled to bottom (or very close to it)
        this.willScroll = this._displayContainer.scrollTop + this._displayContainer.offsetHeight >= this._displayContainer.scrollHeight - 5; // 5px tolerance

        if (addTarget && !this.willScroll && !this.scrollTarget) {
            this.scrollTarget = document.createElement('hr');
            this.scrollTarget.className = 'scroll-point';
            this.display.appendChild(this.scrollTarget);

            if (this.ui && (this.ui as any).showScrollButton) { // Cast ui to any if showScrollButton is not in DecafMUDInterface
                (this.ui as any).showScrollButton();
            }
        }
    }

    private doScroll(): void {
        clearTimeout(this.scrollTime);
        const self = this;
        if (this.willScroll) {
            this.scrollTime = setTimeout(() => {
                if (self.scrollTarget) {
                    self.scrollTarget.remove();
                    self.scrollTarget = undefined;
                }
                self._displayContainer.setAttribute('aria-busy', 'false');
                self.scroll();
                self.willScroll = undefined; // Reset for next check
            }, 5);
        } else {
            this.scrollTime = setTimeout(() => {
                self._displayContainer.setAttribute('aria-busy', 'false');
                self.willScroll = undefined; // Reset for next check
            }, 5);
        }
    }

    scrollNew(): void {
        if (!this.scrollTarget) { return; }
        const targetOffsetTop = this.scrollTarget.offsetTop;
        if (targetOffsetTop > this._displayContainer.scrollTop) {
            this._displayContainer.scrollTop = targetOffsetTop;
        } else {
            this.scroll(); // If target is already above viewport, scroll to end
        }
    }

    scroll(): void {
        if (this._displayContainer.style.overflowY === 'hidden') { return; }
        this.display.scrollTop = this.display.scrollHeight; // Scroll the inner display div
        this._displayContainer.scrollTop = this._displayContainer.scrollHeight; // Scroll the container too
    }

    private onScroll(): void {
        if (this.scrollTarget === undefined) { return; }
        // If scrolled to bottom (or very close)
        if (this._displayContainer.scrollTop + this._displayContainer.offsetHeight >= this._displayContainer.scrollHeight - 5) {
            this.scrollTarget.remove();
            this.scrollTarget = undefined;
            if (this.ui && (this.ui as any).hideScrollButton) {
                (this.ui as any).hideScrollButton();
            }
        }
    }

    scrollUp(): void {
        let top = this._displayContainer.scrollTop - this._displayContainer.clientHeight;
        if (top < 0) { top = 0; }
        this._displayContainer.scrollTop = top;
    }

    scrollDown(): void {
        this._displayContainer.scrollTop += this._displayContainer.clientHeight;
    }

    // MXP tags are defined in the original but not used. Omitting for brevity unless requested.
    // tags: { [key: string]: any } = { /* ... MXP tag definitions ... */ };
}

// Expose the display to DecafMUD
// This assignment will be handled by src/index.ts or a plugin loader in a typical TS setup.
// For now, to match existing JS plugin style and simplify incremental conversion:
if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins && DecafMUD.plugins.Display) {
    DecafMUD.plugins.Display.standard = StandardDisplay as any; // Cast as any because constructor signature might not match a generic new()
}

export { StandardDisplay };
// Or export default StandardDisplay; if it's the sole export
// For plugin registration, a named export might be slightly cleaner if a loader iterates exports.
// But direct assignment to DecafMUD.plugins is also a common pattern in older JS.
// Let's stick to the direct assignment for now to ensure plugins are found.
// The class itself is also exported if direct instantiation is needed elsewhere.
