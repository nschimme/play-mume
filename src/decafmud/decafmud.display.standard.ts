// SPDX-License-Identifier: GPL-3.0-or-later
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

import DecafMUD from './decafmud'; // Assuming DecafMUD is exported from decafmud.ts
import type SimpleInterface from './decafmud.interface.panels'; // Assuming this is the type

type DecafMUDInstance = InstanceType<typeof DecafMUD>;

(function(DecafMUDGlobal: any) {

const addEvent = function(node: HTMLElement | Document | Window, etype: string, func: (e: Event) => void): void {
    if ( node.addEventListener ) {
        node.addEventListener(etype, func, false); return;
    }
    etype = 'on' + etype;
    if ( (node as any).attachEvent ) {
        (node as any).attachEvent(etype, func);
    } else {
        (node as any)[etype] = func;
    }
};

const delEvent = function(node: HTMLElement | Document | Window, etype: string, func: (e: Event) => void): void {
    if ( node.removeEventListener ) {
        node.removeEventListener(etype, func, false);
    }
};

// Flags
const BRIGHT              = parseInt('00000001',2);
const NEGATIVE        = parseInt('00000010',2);
const ITALIC          = parseInt('00000100',2);
const BLINK           = parseInt('00001000',2);
const UNDERLINE       = parseInt('00010000',2);
const FAINT           = parseInt('00100000',2);
const STRIKE          = parseInt('01000000',2);
const DBLUNDER        = parseInt('10000000',2);


class Display {
    decaf: DecafMUDInstance;
    ui: SimpleInterface; // Use the imported type
    _display: HTMLElement;
    display: HTMLElement;
    splash: string;
    orig_title: string | null;

    state: number = 0;
    c_fg: number = 7;
    c_bg: number = 0;
    c_fnt: number = 0;
    readyClear: boolean = false;
    endSpace: boolean = false;
    scrollTime: NodeJS.Timeout | null = null;
    willScroll: boolean | undefined = undefined; // undefined means not yet determined
    vt100Warning: boolean = false;
    mxp: boolean = false; // TODO: Define MXP types/interfaces

    inbuf: string[] = [];
    outbuf: string[] = [];
    needline: boolean = false;
    scrollTarget: HTMLElement | undefined;

    sbw: number | undefined;
    cz: [number, number] | undefined;

    // MXP Tags definition
    tags: any = { // TODO: Define specific type for tags
        'VAR'           : {
            'default'       : true,
            'secure'        : true,
            'want'          : true,
            'open_tag'      : '',
            'close_tag'     : '',
            'arg_order'     : ['name','desc','private','publish','delete','add','remove'],
            'arguments'     : {
                'name'          : '',
                'desc'          : '',
                'private'       : false,
                'publish'       : true,
                'delete'        : false,
                'add'           : true,
                'remove'        : false },
            'handler'       : function() { }
        },
        'B' : { 'default': true, 'secure': false, 'want': false, 'open_tag': '<b class="mxp">', 'close_tag': '</b>' },
        'BOLD': 'B', 'STRONG' : 'B',
        'I' : { 'default': true, 'secure': false, 'want': false, 'open_tag': '<i class="mxp">', 'close_tag': '</i>' },
        'ITALIC': 'I', 'EM': 'I',
        'U' : { 'default': true, 'secure': false, 'want': false, 'open_tag': '<u class="mxp">', 'close_tag': '</u>' },
        'UNDERLINE': 'U',
        'S' : { 'default': true, 'secure': false, 'want': false, 'open_tag': '<s class="mxp">', 'close_tag': '</s>' },
        'STRIKEOUT': 'S',
        'COLOR' : {
            'default': true, 'secure': false, 'want': false,
            'open_tag': '<span class="mxp mxp-color" style="color:&fore;;background-color:&back;">',
            'close_tag': '</span>',
            'arg_order': ['fore','back'],
            'arguments': { 'fore': 'inherit', 'back': 'inherit' }
        },
        'C': 'COLOR',
        'HIGH': { 'default': true, 'secure': false, 'want': true }
    };

    id: string = ''; // Added to satisfy usage in SimpleInterface setup

    constructor(decaf: DecafMUDInstance, ui: SimpleInterface, disp: HTMLElement) {
        this.decaf = decaf;
        this.ui = ui;
        this._display = disp;

        this.display = document.createElement('div');
        this.display.className = 'decafmud display ' + this.decaf.options.set_display.fgclass + '7';
        this._display.appendChild(this.display);

        const d = this;
        addEvent(this._display, 'scroll', (e) => { d.onScroll(); });
        addEvent(this._display, 'mousedown', (e) => {
            const event = e as MouseEvent;
            if ( event.which !== 2 || !d.decaf.store.get('ui/middle-click-scroll',false) ) { return; }
            d.scroll();
            if ( (event as any).cancelBubble ) { (event as any).cancelBubble = true; }
            event.preventDefault();
        });

        (this.decaf.loaded_plugs as any).display = this;
        this.splash = this.display.innerHTML;
        this.orig_title = document.title; // Store original document title

        this.clear();

        this.message('<br><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> v' + DecafMUDGlobal.version + ' by Stendec &lt;<a href="mailto:stendec365@gmail.com">stendec365@gmail.com</a>&gt;<br>');
        if ( this.splash.length > 0 ) {
            this.message(this.splash + '<br>');
        }
    }

    clear(): void {
        clearTimeout(this.scrollTime!);
        this.display.innerHTML = '';
        this.reset();
        this.inbuf = [];
        this.outbuf = [];
    }

    reset(): void {
        this.state      = 0;
        this.c_fg       = 7;
        this.c_bg       = 0;
        this.c_fnt      = 0;
        this.readyClear = false;
        this.endSpace   = false;
    }

    scrollbarWidth(): number {
        if ( this.sbw !== undefined) { return this.sbw; } // Check if undefined, not just falsy
        const old = this._display.style.overflowY;
        this._display.style.overflowY = 'scroll';
        if ( this._display.offsetWidth > this._display.clientWidth ) {
            this.sbw = this._display.offsetWidth - this._display.clientWidth;
            this._display.style.overflowY = old; // Restore before returning
            return this.sbw;
        }
        this._display.style.overflowY = old;
        return 15; // Default
    }

    charSize(): [number, number] {
        if ( this.cz ) { return this.cz; }
        const span = document.createElement('span');
        span.innerHTML = 'W'; // Use a common wide character
        this.display.appendChild(span);
        const w = span.offsetWidth, h = span.offsetHeight;
        this.display.removeChild(span);
        this.cz = [w,h];
        return this.cz;
    }

    getSize(): [number, number] {
        let sbw: number;
        if ( this.decaf.options.set_display.scrollbarwidth ) {
            sbw = this.decaf.options.set_display.scrollbarwidth;
        } else { sbw = this.scrollbarWidth(); }

        const tw = this._display.clientWidth - sbw;
        const th = this._display.clientHeight;
        const sz = this.charSize();
        const w = sz[0], h = sz[1];
        return [ Math.floor(tw/w) + 1, Math.floor(th/h) ];
    }

    handleData(data: string): void {
        this.inbuf.push(data);
        this.processData();
    }

    processData(): void {
        if ( this.inbuf.length < 1 ) { return; }
        let data = this.inbuf.join('');
        this.inbuf = [];
        const ESC = DecafMUDGlobal.ESC;

        while ( data.length > 0 ) {
            const ind = data.indexOf(ESC);
            if ( ind === -1 ) {
                this.outbuf.push(data.replace(/</g,'&lt;'));
                break;
            }
            if ( ind > 0 ) {
                this.readyClear = false;
                this.outbuf.push(data.substr(0, ind).replace(/</g,'&lt;'));
                data = data.substr(ind);
            }
            const out = this.readANSI(data);
            if ( out === false ) {
                this.inbuf.push(data);
                break;
            }
            data = out as string; // out is string if not false
        }

        const currentOutput = this.outbuf.join('');
        this.outbuf = [];
        this.outColor(false); // Pass false to indicate not closing a tag

        this.needline = !currentOutput.endsWith('\n');
        this._display.setAttribute('aria-busy','true');

        const span = document.createElement('span');
        span.innerHTML = currentOutput.replace(/\n\r?/g,'<br>').replace(/> /g,'>&nbsp;')
            .replace(/ ( +)/g, function(m) { if (m.length ===2) {return ' &nbsp;';}
                return ' ' + new Array(m.length-1).join('&nbsp;') + ' ';
            });
        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();
        this.truncateLines();
    }

    truncateLines(): void {
        if ((this.display.clientHeight < (window.innerHeight * this.decaf.options.set_display.maxscreens)) || (this.display.children.length < this.decaf.options.set_display.minelements)) {
            return;
        }
        let height = 0;
        const elems: Element[] = [];
        const targetHeight = (this.display.clientHeight - (window.innerHeight * this.decaf.options.set_display.maxscreens));

        // Ensure children exist before trying to access offsetHeight
        for (let i = 0; i < this.display.children.length; i++) {
            if (height >= targetHeight) break;
            const child = this.display.children[i] as HTMLElement; // Cast to HTMLElement
            if (child && typeof child.offsetHeight === 'number') {
                 height += child.offsetHeight;
                 elems.push(child);
            }
        }
        elems.forEach(i => i.remove());
    }

    readANSI(data: string): string | false {
        if ( data.length < 2 ) { return false; }
        if ( data.charAt(1) == '[' ) {
            const ind = data.substr(2).search(/[\x40-\x7E]/);
            if ( ind === -1 ) { return false; }
            this.handleAnsiCSI(data.substr(2, ind)); // ind is length for substr
            return data.substr(ind + 3); // Skip ESC, [, sequence, and final char
        } else if ( data.charAt(1) == ']' ) {
            let ind = data.substr(2).indexOf(DecafMUDGlobal.BEL);
            const in2 = data.substr(2).indexOf(DecafMUDGlobal.ESC + '\\');
            if ( in2 !== -1 && (in2 < ind || ind === -1) ) { ind = in2; } // Check in2 !== -1
            if ( ind === -1 ) { return false; }
            // this.handleAnsiOSC(data.substr(2, ind)); // OSC handling removed for now
            return data.substr(ind + (data.substr(ind+2,2) === DecafMUDGlobal.ESC + '\\' ? 4:3) ); // Adjust for ST length
        }
        return data.substr(1); // Unknown sequence, skip ESC
    }

    handleAnsiCSI(seq: string): void {
        const lastChar = seq.charAt(seq.length-1);
        const params = seq.substring(0, seq.length-1);

        switch(lastChar) {
            case 'm':
                const old_state = this.state, old_fg = this.c_fg, old_bg = this.c_bg, old_fnt = this.c_fnt;
                const cs = (params === '' ? '0' : params).split(';'); // Ensure '0' if params is empty
                for(let i=0; i < cs.length; i++) {
                    const c = parseInt(cs[i]);
                    if ( c === 38 ) { i+=2; if ( i >= cs.length ) { break; } this.c_fg = parseInt(cs[i]); }
                    else if ( c === 39 ) { this.c_fg = 7; }
                    else if ( c === 48 ) { i+=2; if ( i >= cs.length ) { break; } this.c_bg = parseInt(cs[i]); }
                    else if ( 29 < c && c < 38 ) { this.c_fg = c - 30; }
                    else if ( 39 < c && c < 48 ) { this.c_bg = c - 40; }
                    else if ( c === 0 ) { this.state = 0; this.c_fg = 7; this.c_bg = 0; this.c_fnt = 0; }
                    else if ( c === 1 ) { this.state |= BRIGHT; this.state &= ~FAINT; }
                    else if ( c === 2 ) { this.state &= ~BRIGHT; this.state |= FAINT; }
                    else if ( c === 3 ) { this.state |= ITALIC; }
                    else if ( c === 4 ) { this.state |= UNDERLINE; this.state &= ~DBLUNDER; }
                    else if ( c < 7   ) { this.state |= BLINK; }
                    else if ( c === 7 ) { this.state |= NEGATIVE; }
                    else if ( c === 9 ) { this.state |= STRIKE; }
                    else if ( c < 20 && c >=10 ) { this.c_fnt = c - 10; } // Font selection based on original
                    else if ( c === 21 ) { this.state |= DBLUNDER; this.state &= ~UNDERLINE; }
                    else if ( c === 22 ) { this.state &= ~(BRIGHT | FAINT); }
                    else if ( c === 23 ) { this.state &= ~ITALIC; }
                    else if ( c === 24 ) { this.state &= ~(UNDERLINE | DBLUNDER); }
                    else if ( c === 25 ) { this.state &= ~BLINK; }
                    else if ( c === 27 ) { this.state &= ~NEGATIVE; }
                    else if ( c === 29 ) { this.state &= ~STRIKE; }
                    else if ( c === 49 ) { this.c_bg = 0; }
                    else if ( 89 < c && c < 98 ) { this.state |= BRIGHT; this.state &= ~FAINT; this.c_fg = c - 90; }
                    else if ( 99 < c && c < 108 ) { this.c_bg = c - 92; } // Original was c-92, should be c-100+8?
                }
                if ( this.state !== old_state || old_fg !== this.c_fg || old_bg !== this.c_bg || old_fnt !== this.c_fnt ) {
                    this.outColor();
                }
                this.readyClear = false;
                return;
            case '@': case 'C':
                let count = params ? parseInt(params) : 1;
                if (isNaN(count) || count < 1) count = 1;
                this.outbuf.push(new Array(count+1).join(' '));
                this.readyClear = false;
                return;
            case 'E':
                let e_count = params ? parseInt(params) : 1;
                if (isNaN(e_count) || e_count < 1) e_count = 1;
                this.outbuf.push(new Array(e_count+1).join('\n'));
                this.readyClear = false;
                return;
            case 'H':
                if ( params === '' ) { this.readyClear = true; } // Only if no params
                return;
            case 'J':
                const j_mode = params ? parseInt(params) : 0;
                if ( (j_mode === 0 && this.readyClear) || j_mode === 2 ) {
                    this.clear();
                }
                this.readyClear = false;
                return;
            case 'K':
                const k_mode = params ? parseInt(params) : 0;
                if ( k_mode === 2 ) { // Erase entire line
                    let found = false;
                    if ( this.outbuf.length > 0 ) {
                        while(this.outbuf.length > 0) {
                            const st = this.outbuf[this.outbuf.length-1];
                            const lastNL = st.lastIndexOf('\n');
                            if ( lastNL === -1 ) {
                                this.outbuf.pop();
                            } else {
                                found = true;
                                this.outbuf[this.outbuf.length-1] = st.substring(0, lastNL + 1);
                                break;
                            }
                        }
                    }
                    if(!found && this.display.lastChild) { // Check display if not found in outbuf
                         while(this.display.lastChild) {
                            const last = this.display.lastChild as HTMLElement;
                            const html = last.innerHTML;
                            const lastBR = html.lastIndexOf('<br>');
                            if ( lastBR === -1 ) {
                                this.display.removeChild(last);
                            } else {
                                last.innerHTML = html.substring(0, lastBR + 4);
                                break;
                            }
                        }
                    }
                } else if ( k_mode === 1 ) { // Erase from start to cursor
                     this.decaf.debugString('ANSI Sequence ESC ['+seq+' -- TODO: Mode 1');
                } // Mode 0 (erase from cursor to end) would typically clear current outbuf line part
                return;
        }
        if ( 'ABCDEFGHJKSTfnsulh'.indexOf(lastChar) !== -1 ) {
            if (! this.vt100Warning ) {
                this.decaf.debugString("Notice: This display handler only provides"+
                        " a subset of VT100, and doesn't handle cursor movement commands.");
                this.vt100Warning = true;
            }
        } else {
            this.decaf.debugString('Unhandled ANSI Sequence: ESC [' + seq);
        }
    }

    outColor(closing: boolean = true, ret: boolean = false): string | void { // Default closing to true
        let f = this.c_fg, b = this.c_bg, s = this.state;
        const opt = this.decaf.options.set_display;

        if ( s & BRIGHT && f < 8 ) { f += 8; }

        let out = ( closing ? '</span>' : '' ) + '<span class="';

        if ( s & ITALIC         ) { out += 'italic '; }
        if ( s & BLINK          ) { out += 'blink '; }
        if ( s & UNDERLINE      ) { out += 'underline '; }
        if ( s & DBLUNDER       ) { out += 'doubleunderline '; }
        if ( s & FAINT          ) { out += 'faint '; }
        if ( s & STRIKE         ) { out += 'strike '; }
        if ( s & NEGATIVE       ) { const temp = f; f = b; b = temp; } // Swap fg and bg for negative

        if ( this.c_fnt !== 0 ) { out += opt.fntclass + this.c_fnt + ' '; }
        // Apply actual fg and bg after potential swap by NEGATIVE
        if ( f !== 7 ) { out += opt.fgclass + f + ' '; }
        if ( b !== 0 ) { out += opt.bgclass + b; }
        out += '">';

        if ( ret === true ) { return out; }
        this.outbuf.push(out);
    }

    message(text: string, className: string = 'message', needLine: boolean = true): void {
        const span = document.createElement('span');
        span.className = className; // Assign class name
        if ( this.needline && needLine ) { span.innerHTML = '<br>'; }
        this.needline = false; // Message implies it ends a line or starts a new one
        span.innerHTML += text.replace(/ ( +)/g, function(m) { if (m.length ===2){return ' &nbsp;';} return ' ' + new Array(m.length-1).join('&nbsp;') + ' '; }) + '<br>';
        this.shouldScroll();
        this.display.appendChild(span);
        this.doScroll();
    }

    shouldScroll(addTarget: boolean = true): void {
        if ( this.willScroll !== undefined || this._display.style.overflowY === 'hidden' ) { return; }
        this.willScroll = this._display.scrollTop + 1 >= (this._display.scrollHeight - this._display.offsetHeight);
        if ( addTarget && this.willScroll === false && !this.scrollTarget) {
            const st = document.createElement('hr');
            st.className = 'scroll-point';
            this.scrollTarget = st;
            this.display.appendChild(st);
            if ( this.ui && this.ui.showScrollButton ) {
                this.ui.showScrollButton();
            }
        }
    }

    doScroll(): void {
        clearTimeout(this.scrollTime!);
        if ( this.willScroll ) {
            this.scrollTime = setTimeout(() => {
                if ( this.scrollTarget && this.scrollTarget.parentNode ) { // Check parentNode
                    this.scrollTarget.parentNode.removeChild(this.scrollTarget);
                    this.scrollTarget = undefined;
                }
                this._display.setAttribute('aria-busy','false');
                this.scroll();
                this.willScroll = undefined;
            },5);
        } else {
            this.scrollTime = setTimeout(() => {
                this._display.setAttribute('aria-busy','false');
                this.willScroll = undefined;
            },5);
        }
    }

    scrollNew(): void {
        if (! this.scrollTarget ) { this.scroll(); return; } // Scroll to bottom if no target
        const to = this.scrollTarget.offsetTop;
        if ( to > this._display.scrollTop ) {
            this._display.scrollTop = to;
        } else {
            this.scroll();
        }
    }

    scroll(): void {
        if ( this._display.style.overflowY === 'hidden' ) { return; }
        this._display.scrollTop = this._display.scrollHeight;
    }

    onScroll(): void {
        if ( this.scrollTarget === undefined ) { return; }
        if (!(this._display.scrollTop >= (this._display.scrollHeight - this._display.offsetHeight))) {
            return;
        }
        if ( this.scrollTarget && this.scrollTarget.parentNode ) {
            this.scrollTarget.parentNode.removeChild(this.scrollTarget);
            this.scrollTarget = undefined;
        }
        if ( this.ui && this.ui.hideScrollButton ) {
            this.ui.hideScrollButton();
        }
    }

    scrollUp(): void {
        let top = this._display.scrollTop - this._display.clientHeight;
        if ( top < 0 ) { top = 0; }
        this._display.scrollTop = top;
    }

    scrollDown(): void {
        let top = this._display.scrollTop + this._display.clientHeight;
        this._display.scrollTop = top;
    }
}

// Expose the display to DecafMUD
(DecafMUDGlobal as any).plugins.Display.standard = Display;

})(DecafMUD); // Pass the imported DecafMUD
