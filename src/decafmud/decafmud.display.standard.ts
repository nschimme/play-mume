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

// Assuming DecafMUD is globally available or imported from decafmud.ts
// For this example, let's assume it's available as `DecafMUD` which is the class itself.
// We'd also need the DecafMUD instance type, let's call it `DecafMUDInstance` for now.
// This would ideally be imported from where DecafMUD class is defined.
// import type { DecafMUD as DecafMUDInstance, DecafMUDOptions } from './decafmud'; // Hypothetical import

(function(DecafMUD: any) { // DecafMUD here is the class/constructor

const addEvent = function(node: HTMLElement | Window, etype: string, func: EventListenerOrEventListenerObject): void {
	if (node.addEventListener) {
		node.addEventListener(etype, func, false);
		return;
	}
	// Fallback for older IE
	(node as any).attachEvent('on' + etype, func);
};

const delEvent = function(node: HTMLElement | Window, etype: string, func: EventListenerOrEventListenerObject): void {
	if (node.removeEventListener) {
		node.removeEventListener(etype, func, false);
	}
	// Fallback for older IE
	(node as any).detachEvent('on' + etype, func);
};

// Flags (constants)
const BRIGHT = 1,		// 00000001
	NEGATIVE = 2,	// 00000010
	ITALIC = 4,		// 00000100
	BLINK = 8,		// 00001000
	UNDERLINE = 16,	// 00010000
	FAINT = 32,		// 00100000
	STRIKE = 64,		// 01000000
	DBLUNDER = 128;	// 10000000

interface DecafMUDInstanceInterface { // A minimal interface for what Display needs from DecafMUD instance
    options: any; // Replace 'any' with DecafMUDOptions if available
    loaded_plugs: any;
    store: any; // Replace 'any' with a proper store interface
    debugString: (text: string, type?: string, obj?: any) => void;
    ESC: string;
    BEL: string;
}

interface DecafMUDUIInstance { // A minimal interface for what Display needs from UI instance
    showScrollButton?: () => void;
    hideScrollButton?: () => void;
}


class StandardDisplay {
	private decaf: DecafMUDInstanceInterface;
	private ui: DecafMUDUIInstance | undefined; // UI might not always be present or fully featured
	private _display: HTMLElement; // The main container element for this display
	public display: HTMLElement;  // The actual div where content is rendered

	private splash: string;
	private orig_title: string | null;

	// State properties
	private state: number = 0;
	private c_fg: number = 7;
	private c_bg: number = 0;
	private c_fnt: number = 0;
	private readyClear: boolean = false;
	private endSpace: boolean = false;
	private scrollTime: number | null = null;
	private willScroll: boolean | undefined = false; // undefined means check is needed
	private vt100Warning: boolean = false;
	private mxp: boolean = false; // MXP state

	private inbuf: string[] = [];
	private outbuf: string[] = [];
	private needline: boolean = false;

	private sbw: number | undefined;
	private cz: [number, number] | undefined; // [width, height] of a character
	private scrollTarget: HTMLElement | undefined;


	constructor(decaf: DecafMUDInstanceInterface, ui: DecafMUDUIInstance | undefined, disp: HTMLElement) {
		this.decaf = decaf;
		this.ui = ui;
		this._display = disp;

		this.display = document.createElement('div');
		this.display.className = 'decafmud display ' + (this.decaf.options.set_display.fgclass || 'c') + '7';
		this._display.appendChild(this.display);

		addEvent(this._display, 'scroll', (e) => this.onScroll(e as Event));
		addEvent(this._display, 'mousedown', (e) => {
			const event = e as MouseEvent;
			if (event.which !== 2 || !this.decaf.store.get('ui/middle-click-scroll', false)) { return; }
			this.scroll();
			if ((event as any).cancelBubble) { (event as any).cancelBubble = true; }
			event.preventDefault();
		});

		this.decaf.loaded_plugs.display = this;

		this.splash = this.display.innerHTML; // Capture any existing content as splash
		this.orig_title = null; // Assuming this was for document.title, not directly used here

		this.clear();

		this.message('<br><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> v' + (DecafMUD as any).version + ' by Stendec &lt;<a href="mailto:stendec365@gmail.com">stendec365@gmail.com</a>&gt;<br>');
		if (this.splash && this.splash.length > 0) {
			this.message(this.splash + '<br>');
		}
	}

	public clear(): void {
		if (this.scrollTime !== null) clearTimeout(this.scrollTime);
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
		this.endSpace = false;
	}

	private scrollbarWidth(): number {
		if (this.sbw !== undefined) { return this.sbw; }

		const oldOverflowY = this._display.style.overflowY;
		this._display.style.overflowY = 'scroll';
		if (this._display.offsetWidth > this._display.clientWidth) {
			this.sbw = this._display.offsetWidth - this._display.clientWidth;
			this._display.style.overflowY = oldOverflowY;
			return this.sbw;
		}
		this._display.style.overflowY = oldOverflowY;
		return 15; // Default assumption
	}

	private charSize(): [number, number] {
		if (this.cz) { return this.cz; }
		const span = document.createElement('span');
		span.innerHTML = 'W'; // Sample character
		this.display.appendChild(span);
		const w = span.offsetWidth;
		const h = span.offsetHeight;
		this.display.removeChild(span);
		this.cz = [w, h];
		return this.cz;
	}

	public getSize(): [number, number] {
		let sbw: number;
		if (this.decaf.options.set_display.scrollbarwidth) {
			sbw = this.decaf.options.set_display.scrollbarwidth;
		} else {
			sbw = this.scrollbarWidth();
		}

		const tw = this._display.clientWidth - sbw;
		const th = this._display.clientHeight;
		const sz = this.charSize();

		const w = sz[0];
		const h = sz[1];
		return [Math.floor(tw / w) + 1, Math.floor(th / h)];
	}

	public handleData(data: string): void {
		this.inbuf.push(data);
		this.processData();
	}

	private processData(): void {
		if (this.inbuf.length < 1) { return; }
		let currentData: string = this.inbuf.join('');
		this.inbuf = [];

		const ESC = this.decaf.ESC;

		while (currentData.length > 0) {
			const ind = currentData.indexOf(ESC);
			if (ind === -1) {
				this.outbuf.push(currentData.replace(/</g, '&lt;'));
				break;
			}

			if (ind > 0) {
				this.readyClear = false;
				this.outbuf.push(currentData.substr(0, ind).replace(/</g, '&lt;'));
				currentData = currentData.substr(ind);
			}

			const remainingDataAfterANSI = this.readANSI(currentData);
			if (remainingDataAfterANSI === false) {
				this.inbuf.push(currentData);
				break;
			}
			currentData = remainingDataAfterANSI as string;
		}

		const outputHtml = this.outbuf.join('');
		this.outbuf = [];
		this.outColor(false); // Ensure current color span is opened if needed

		this.needline = !outputHtml.endsWith('\n') && !outputHtml.endsWith('<br>');

		this._display.setAttribute('aria-busy', 'true');

		const span = document.createElement('span');
		span.innerHTML = outputHtml.replace(/\n\r?/g, '<br>').replace(/> /g, '>&nbsp;')
			.replace(/ ( +)/g, (match: string) => {
				if (match.length === 2) { return ' &nbsp;'; }
				return ' ' + new Array(match.length - 1).join('&nbsp;') + ' ';
			});

		this.shouldScroll();
		this.display.appendChild(span);
		this.doScroll();

		if (this.scrollTime === null) { // Only set if not already handled by doScroll
			this.scrollTime = window.setTimeout(() => {
				this._display.setAttribute('aria-busy', 'false');
				// this.scroll(); // Potentially redundant if doScroll handles it
			}, 50);
		}
	}

	private readANSI(data: string): string | false {
		if (data.length < 2) { return false; }

		if (data.charAt(1) === '[') {
			const match = data.substr(2).match(/([\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E])/);
            if (!match || data.substr(2).indexOf(match[0]) === -1) { return false; }
            const seqEnd = data.substr(2).indexOf(match[0]) + match[0].length;
			this.handleAnsiCSI(data.substring(2, 2 + seqEnd));
			return data.substr(2 + seqEnd);
		} else if (data.charAt(1) === ']') {
			const belIndex = data.substr(2).indexOf(this.decaf.BEL);
			const escSlashIndex = data.substr(2).indexOf(this.decaf.ESC + '\\');

			let endIndex = -1;
			if (belIndex !== -1 && (escSlashIndex === -1 || belIndex < escSlashIndex)) {
				endIndex = belIndex;
			} else if (escSlashIndex !== -1) {
				endIndex = escSlashIndex + 1; // Include the trailing '\' for ESC \
			}

			if (endIndex === -1) { return false; }
			// this.handleAnsiOSC(data.substring(2, 2 + endIndex)); // OSC handling removed in original snippet
			return data.substr(2 + endIndex + (data.charAt(2 + endIndex) === this.decaf.BEL ? 1 : 0) );
		}
		return data.substr(1); // Bad/unhandled sequence, skip ESC
	}

	private handleAnsiCSI(seq: string): void {
		const lastChar = seq.charAt(seq.length - 1);
		const params = seq.substring(0, seq.length - 1).split(';').map(p => parseInt(p, 10));

		switch (lastChar) {
			case 'm':
				const oldState = this.state, oldFg = this.c_fg, oldBg = this.c_bg, oldFnt = this.c_fnt;
				if (seq.length === 1 || seq === '0m') { // Reset or just "m"
					this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0;
				} else {
					for (let i = 0; i < params.length; i++) {
						const c = params[i];
						if (c === 38) { // XTERM Foreground
							if (params[i + 1] === 5 && params[i + 2] !== undefined) {
								this.c_fg = params[i + 2]; i += 2;
							}
						} else if (c === 48) { // XTERM Background
							if (params[i + 1] === 5 && params[i + 2] !== undefined) {
								this.c_bg = params[i + 2]; i += 2;
							}
						} else if (c >= 30 && c <= 37) { this.c_fg = c - 30; } // Standard FG
						else if (c === 39) { this.c_fg = 7; } // Default FG
						else if (c >= 40 && c <= 47) { this.c_bg = c - 40; } // Standard BG
						else if (c === 49) { this.c_bg = 0; } // Default BG
						else if (c === 0) { this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0; }
						else if (c === 1) { this.state |= BRIGHT; this.state &= ~FAINT; }
						else if (c === 2) { this.state &= ~BRIGHT; this.state |= FAINT; }
						else if (c === 3) { this.state |= ITALIC; }
						else if (c === 4) { this.state |= UNDERLINE; this.state &= ~DBLUNDER; }
						else if (c === 5 || c === 6) { this.state |= BLINK; } // Slow or Rapid Blink
						else if (c === 7) { this.state |= NEGATIVE; }
						// c === 8 (Conceal) not supported
						else if (c === 9) { this.state |= STRIKE; }
						else if (c >= 10 && c <= 19) { this.c_fnt = c - 10; } // Font selection
						else if (c === 21) { this.state |= DBLUNDER; this.state &= ~UNDERLINE; }
						else if (c === 22) { this.state &= ~(BRIGHT | FAINT); } // Normal intensity
						else if (c === 23) { this.state &= ~ITALIC; }
						else if (c === 24) { this.state &= ~(UNDERLINE | DBLUNDER); }
						else if (c === 25) { this.state &= ~BLINK; }
						else if (c === 27) { this.state &= ~NEGATIVE; }
						else if (c === 29) { this.state &= ~STRIKE; }
						else if (c >= 90 && c <= 97) { this.state |= BRIGHT; this.state &= ~FAINT; this.c_fg = c - 90 + 8; } // Bright FG (adjust to standard bright range)
						else if (c >= 100 && c <= 107) { this.state |= BRIGHT; this.state &= ~FAINT; this.c_bg = c - 100 + 8; } // Bright BG
					}
				}
				if (this.state !== oldState || oldFg !== this.c_fg || oldBg !== this.c_bg || oldFnt !== this.c_fnt) {
					this.outColor();
				}
				this.readyClear = false;
				return;
			case '@': // Insert Characters
			case 'C': // Move Cursor Ahead
				const countC = (params[0] || 1);
				this.outbuf.push(new Array(countC + 1).join(' '));
				this.readyClear = false;
				return;
			case 'E': // Cursor Next Line
				const countE = (params[0] || 1);
				this.outbuf.push(new Array(countE + 1).join('\n'));
				this.readyClear = false;
				return;
			case 'H': // Cursor Position
				if (seq.length === 1 || seq === 'H') { this.readyClear = true; } // Simplified: only full screen clear if H is alone
				return;
			case 'J': // Erase in Display
				const modeJ = params[0] || 0;
				if ((modeJ === 0 && this.readyClear) || modeJ === 2) {
					this.clear();
				}
				this.readyClear = false;
				return;
			case 'K': // Erase in Line
				const modeK = params[0] || 0;
				if (modeK === 2) { // Erase entire line
					let found = false;
					if (this.outbuf.length > 0) {
						while (this.outbuf.length > 0) {
							const st = this.outbuf[this.outbuf.length - 1];
							const lastNL = st.lastIndexOf('\n');
							if (lastNL === -1) {
								this.outbuf.pop();
							} else {
								found = true;
								this.outbuf[this.outbuf.length - 1] = st.substring(0, lastNL + 1);
								break;
							}
						}
					}
					if (!found && this.display.lastChild) { // Check scrollback
						let lastNode = this.display.lastChild as HTMLElement;
						while(lastNode) {
							const html = lastNode.innerHTML;
							const lastBR = html.lastIndexOf('<br>');
							if (lastBR === -1 && lastNode.tagName !== 'BR') {
								const prev = lastNode.previousSibling as HTMLElement;
								this.display.removeChild(lastNode);
								lastNode = prev;
							} else {
								if (lastBR !== -1) lastNode.innerHTML = html.substring(0, lastBR + 4);
								else if(lastNode.tagName === 'BR') this.display.removeChild(lastNode);
								break;
							}
						}
					}
				} else if (modeK === 1) { // Erase from beginning to cursor
					this.decaf.debugString('ANSI Sequence ESC [' + seq + ' -- TODO: Mode 1');
				} // Mode 0 (erase from cursor to end) is more complex without cursor tracking
				return;
		}

		if ('ABCDEFGHJKSTfnsulh'.indexOf(lastChar) !== -1) {
			if (!this.vt100Warning) {
				this.decaf.debugString("Notice: This display handler only provides" +
					" a subset of VT100, and doesn't handle cursor movement commands.");
				this.vt100Warning = true;
			}
		} else {
			this.decaf.debugString('Unhandled ANSI Sequence: ESC [' + seq);
		}
	}

	private outColor(closing: boolean = true, ret: boolean = false): string | void {
		let f = this.c_fg, b = this.c_bg, s = this.state;
		const opt = this.decaf.options.set_display;
		let out = '';

		if (s & BRIGHT && f < 8) { f += 8; } // Bright colors are 8-15

		out = (closing ? '</span>' : '') + '<span class="';

		if (s & ITALIC) { out += 'italic '; }
		if (s & BLINK) { out += 'blink '; }
		if (s & UNDERLINE) { out += 'underline '; }
		if (s & DBLUNDER) { out += 'doubleunderline '; }
		if (s & FAINT) { out += 'faint '; }
		if (s & STRIKE) { out += 'strike '; }
		if (s & NEGATIVE) { const temp = f; f = b; b = temp; } // Swap fg and bg

		if (this.c_fnt !== 0) { out += (opt.fntclass || 'fnt') + this.c_fnt + ' '; }
		if (f !== 7) { out += (opt.fgclass || 'c') + f + ' '; }
		if (b !== 0) { out += (opt.bgclass || 'b') + b; }
		out += '">';

		if (ret === true) { return out; }
		this.outbuf.push(out);
	}

	public message(text: string, className: string = 'message', needLine: boolean = true): void {
		const span = document.createElement('span');
		if (this.needline && needLine) { span.innerHTML = '<br>'; }
		this.needline = false; // Reset after potential <br>
		span.innerHTML += text.replace(/ ( +)/g, (m) => {
			if (m.length === 2) { return ' &nbsp;'; }
			return ' ' + new Array(m.length - 1).join('&nbsp;') + ' ';
		}) + '<br>';
		this.shouldScroll();
		this.display.appendChild(span);
		this.doScroll();
	}

	public shouldScroll(addTarget: boolean = true): void {
		if (this.willScroll !== undefined || this._display.style.overflowY === 'hidden') { return; }
		this.willScroll = this._display.scrollTop >= (this._display.scrollHeight - this._display.offsetHeight);

		if (addTarget && this.willScroll === false && !this.scrollTarget) {
			const st = document.createElement('hr');
			st.className = 'scroll-point';
			this.scrollTarget = st;
			this.display.appendChild(st);
			if (this.ui && this.ui.showScrollButton) {
				this.ui.showScrollButton();
			}
		}
	}

	public doScroll(): void {
		if (this.scrollTime !== null) clearTimeout(this.scrollTime);
		if (this.willScroll) {
			this.scrollTime = window.setTimeout(() => {
				if (this.scrollTarget && this.scrollTarget.parentNode) { // Ensure parentNode exists
					this.scrollTarget.parentNode.removeChild(this.scrollTarget);
					this.scrollTarget = undefined;
				}
				this._display.setAttribute('aria-busy', 'false');
				this.scroll();
				this.willScroll = undefined;
			}, 5);
		} else {
			this.scrollTime = window.setTimeout(() => {
				this._display.setAttribute('aria-busy', 'false');
				this.willScroll = undefined;
			}, 5);
		}
	}

	public scrollNew(): void {
		if (!this.scrollTarget) { return; }
		const to = this.scrollTarget.offsetTop;
		if (to > this._display.scrollTop) {
			this._display.scrollTop = to;
		} else {
			this.scroll();
		}
	}

	public scroll(): void {
		if (this._display.style.overflowY === 'hidden') { return; }
		this._display.scrollTop = this._display.scrollHeight;
	}

	public onScroll(e: Event): void {
		if (this.scrollTarget === undefined) { return; }
		if (!(this._display.scrollTop >= (this._display.scrollHeight - this._display.offsetHeight))) {
			return;
		}
		if (this.scrollTarget && this.scrollTarget.parentNode) {
			this.scrollTarget.parentNode.removeChild(this.scrollTarget);
			this.scrollTarget = undefined;
		}
		if (this.ui && this.ui.hideScrollButton) {
			this.ui.hideScrollButton();
		}
	}

	public scrollUp(): void {
		let top = this._display.scrollTop - this._display.clientHeight;
		if (top < 0) { top = 0; }
		this._display.scrollTop = top;
	}

	public scrollDown(): void {
		const top = this._display.scrollTop + this._display.clientHeight;
		this._display.scrollTop = top;
	}

	// MXP Tags - this seems to be a placeholder or incomplete feature in the original
	public tags: any = { // Define a more specific interface if MXP is fully implemented
		'VAR': {
			'default': true, 'secure': true, 'want': true, 'open_tag': '', 'close_tag': '',
			'arg_order': ['name', 'desc', 'private', 'publish', 'delete', 'add', 'remove'],
			'arguments': {
				'name': '', 'desc': '', 'private': false, 'publish': true,
				'delete': false, 'add': true, 'remove': false
			},
			'handler': function() { }
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
		'HIGH': { 'default': true, 'secure': false, 'want': true }
	};
}

// Expose the display to DecafMUD
(DecafMUD as any).plugins.Display.standard = StandardDisplay;
})(DecafMUD);
