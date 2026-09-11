/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

import { DecafMUDDisplay, ESC, BEL } from './types';
import type { DecafMUD } from './decafmud';
import type { PanelsInterface } from './interface';

const BRIGHT = 1;
const NEGATIVE = 2;
const ITALIC = 4;
const BLINK = 8;
const UNDERLINE = 16;
const FAINT = 32;
const STRIKE = 64;
const DBLUNDER = 128;

export class StandardDisplay implements DecafMUDDisplay {
  public decaf: DecafMUD;
  public ui?: PanelsInterface;
  public _display: HTMLElement;
  public display: HTMLElement;

  public state = 0;
  public c_fg = 7;
  public c_bg = 0;
  public c_fnt = 0;
  public readyClear = false;
  public endSpace = false;
  public scrollTime: ReturnType<typeof setTimeout> | null = null;
  public willScroll?: boolean;
  public vt100Warning = false;
  public splash = '';
  public needline = false;
  public scrollTarget?: HTMLElement;

  private inbuf: string[] = [];
  private outbuf: string[] = [];
  private sbw?: number;
  private cz?: [number, number];

  constructor(decaf: DecafMUD, ui: PanelsInterface, disp: HTMLElement) {
    this.decaf = decaf;
    this.ui = ui;
    this._display = disp;

    this.display = document.createElement('div');
    const fgClass = this.decaf.options.set_display?.fgclass || 'c';
    this.display.className = `decafmud display ${fgClass}7`;
    this._display.appendChild(this.display);

    this._display.addEventListener('scroll', () => this.onScroll());
    this._display.addEventListener('mousedown', (e) => {
      if (e.which !== 2 || !this.decaf.store.get('ui/middle-click-scroll', false)) return;
      this.scroll();
      e.stopPropagation();
      e.preventDefault();
    });

    this.splash = this.display.innerHTML;
    this.clear();

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
    this.endSpace = false;
  }

  public scrollbarWidth(): number {
    if (this.sbw !== undefined) return this.sbw;
    const old = this._display.style.overflowY;
    this._display.style.overflowY = 'scroll';
    if (this._display.offsetWidth > this._display.clientWidth) {
      this.sbw = this._display.offsetWidth - this._display.clientWidth;
      return this.sbw;
    }
    this._display.style.overflowY = old;
    this.sbw = 15;
    return this.sbw;
  }

  public charSize(): [number, number] {
    if (this.cz) return this.cz;
    const span = document.createElement('span');
    span.innerHTML = 'W';
    this.display.appendChild(span);
    const w = span.offsetWidth;
    const h = span.offsetHeight;
    this.display.removeChild(span);
    this.cz = [w || 8, h || 16];
    return this.cz;
  }

  public getSize(): [number, number] {
    const customSbw = this.decaf.options.set_display?.scrollbarwidth;
    const sbw = customSbw !== undefined ? customSbw : this.scrollbarWidth();

    const tw = this._display.clientWidth - sbw;
    const th = this._display.clientHeight;
    const sz = this.charSize();

    return [Math.max(1, Math.floor(tw / sz[0]) + 1), Math.max(1, Math.floor(th / sz[1]))];
  }

  public handleData(data: string): void {
    this.inbuf.push(data);
    this.processData();
  }

  public processData(): void {
    if (this.inbuf.length < 1) return;

    let data = this.inbuf.join('');
    this.inbuf = [];

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

      const remaining = this.readANSI(data);
      if (remaining === false) {
        this.inbuf.push(data);
        break;
      }
      data = remaining;
    }

    const outputHtml = this.outbuf.join('');
    this.outbuf = [];
    this.outColor(false);

    this.needline = !outputHtml.endsWith('\n');
    this._display.setAttribute('aria-busy', 'true');

    const span = document.createElement('span');
    span.innerHTML = outputHtml
      .replace(/\r\n|\r|\n/g, '<br>')
      .replace(/> /g, '>&nbsp;')
      .replace(/ ( +)/g, (m) => (m.length === 2 ? ' &nbsp;' : ' ' + new Array(m.length - 1).join('&nbsp;') + ' '));

    this.shouldScroll();
    this.display.appendChild(span);
    this.doScroll();
    this.truncateLines();
  }

  public truncateLines(): void {
    const maxScreens = this.decaf.options.set_display?.maxscreens || 100;
    const minElements = this.decaf.options.set_display?.minelements || 10;

    if (
      this.display.clientHeight < window.innerHeight * maxScreens ||
      this.display.children.length < minElements
    ) {
      return;
    }

    let height = 0;
    const elems: Element[] = [];
    const targetHeight = this.display.clientHeight - window.innerHeight * maxScreens;

    while (height < targetHeight && this.display.children.length > elems.length) {
      const child = this.display.children[elems.length] as HTMLElement;
      height += child.offsetHeight;
      elems.push(child);
    }
    elems.forEach((i) => i.remove());
  }

  private readANSI(data: string): string | false {
    if (data.length < 2) return false;

    if (data.charAt(1) === '[') {
      const ind = data.substring(2).search(/[\x40-\x7E]/);
      if (ind === -1) return false;
      const matchIndex = ind + 2;
      this.handleAnsiCSI(data.substring(2, matchIndex));
      return data.substring(matchIndex + 1);
    }

    if (data.charAt(1) === ']') {
      let ind = data.substring(2).indexOf(BEL);
      const in2 = data.substring(2).indexOf(ESC + '\\');
      if ((in2 !== -1 && in2 < ind) || ind === -1) {
        ind = in2;
      }
      if (ind === -1) return false;
      return data.substring(ind + 2);
    }

    return data.substring(1);
  }

  private handleAnsiCSI(seq: string): void {
    const lastChar = seq.charAt(seq.length - 1);
    switch (lastChar) {
      case 'm': {
        const oldState = this.state;
        const oldFg = this.c_fg;
        const oldBg = this.c_bg;
        const oldFnt = this.c_fnt;

        const effectiveSeq = seq.length === 1 ? '0m' : seq;
        const cs = effectiveSeq.substring(0, effectiveSeq.length - 1).split(';');
        const l = cs.length;

        for (let i = 0; i < l; i++) {
          const c = parseInt(cs[i], 10);
          if (isNaN(c)) continue;

          if (c === 38) {
            i += 2;
            if (i < l) this.c_fg = parseInt(cs[i], 10);
          } else if (c === 39) {
            this.c_fg = 7;
          } else if (c === 48) {
            i += 2;
            if (i < l) this.c_bg = parseInt(cs[i], 10);
          } else if (c >= 30 && c <= 37) {
            this.c_fg = c - 30;
          } else if (c >= 40 && c <= 47) {
            this.c_bg = c - 40;
          } else if (c === 0) {
            this.state = 0;
            this.c_fg = 7;
            this.c_bg = 0;
            this.c_fnt = 0;
          } else if (c === 1) {
            this.state |= BRIGHT;
            this.state &= ~FAINT;
          } else if (c === 2) {
            this.state &= ~BRIGHT;
            this.state |= FAINT;
          } else if (c === 3) {
            this.state |= ITALIC;
          } else if (c === 4) {
            this.state |= UNDERLINE;
            this.state &= ~DBLUNDER;
          } else if (c < 7) {
            this.state |= BLINK;
          } else if (c === 7) {
            this.state |= NEGATIVE;
          } else if (c === 9) {
            this.state |= STRIKE;
          } else if (c < 20) {
            this.c_fnt = c - 10;
          } else if (c === 21) {
            this.state |= DBLUNDER;
            this.state &= ~UNDERLINE;
          } else if (c === 22) {
            this.state &= ~(BRIGHT | FAINT);
          } else if (c === 23) {
            this.state &= ~ITALIC;
          } else if (c === 24) {
            this.state &= ~(UNDERLINE | DBLUNDER);
          } else if (c === 25) {
            this.state &= ~BLINK;
          } else if (c === 27) {
            this.state &= ~NEGATIVE;
          } else if (c === 29) {
            this.state &= ~STRIKE;
          } else if (c === 49) {
            this.c_bg = 0;
          } else if (c >= 90 && c <= 97) {
            this.state |= BRIGHT;
            this.state &= ~FAINT;
            this.c_fg = c - 90;
          } else if (c >= 100 && c <= 107) {
            this.c_bg = c - 92;
          }
        }

        if (this.state !== oldState || oldFg !== this.c_fg || oldBg !== this.c_bg || oldFnt !== this.c_fnt) {
          this.outColor();
        }
        this.readyClear = false;
        return;
      }
      case '@':
      case 'C': {
        let count = 1;
        if (seq.length > 1) {
          count = parseInt(seq.substring(0, seq.length - 1), 10) || 1;
        }
        this.outbuf.push(new Array(count + 1).join(' '));
        this.readyClear = false;
        return;
      }
      case 'E': {
        let count = 1;
        if (seq.length > 1) {
          count = parseInt(seq.substring(0, seq.length - 1), 10) || 1;
        }
        this.outbuf.push(new Array(count + 1).join('\n'));
        this.readyClear = false;
        return;
      }
      case 'H':
        if (seq.length === 1) this.readyClear = true;
        return;
      case 'J': {
        let mode = 0;
        if (seq.length > 1) {
          mode = parseInt(seq.substring(0, seq.length - 1), 10) || 0;
        }
        if ((mode === 0 && this.readyClear) || mode === 2) {
          this.clear();
        }
        this.readyClear = false;
        return;
      }
      case 'K': {
        let mode = 0;
        if (seq.length > 1) {
          mode = parseInt(seq.substring(0, seq.length - 1), 10) || 0;
        }
        if (mode === 2) {
          let found = false;
          while (this.outbuf.length > 0) {
            const st = this.outbuf[this.outbuf.length - 1];
            if (st.lastIndexOf('\n') === -1) {
              this.outbuf.pop();
            } else {
              found = true;
              this.outbuf[this.outbuf.length - 1] = st.substring(0, st.lastIndexOf('\n') + 1);
              break;
            }
          }
          if (!found) {
            while (this.display.childElementCount > 0) {
              const last = this.display.children[this.display.childElementCount - 1] as HTMLElement;
              const html = last.innerHTML;
              if (html.lastIndexOf('<br>') === -1) {
                this.display.removeChild(last);
              } else {
                last.innerHTML = html.substring(0, html.lastIndexOf('<br>') + 4);
                break;
              }
            }
          }
        }
        return;
      }
    }
  }

  private outColor(closing = true): void {
    let f = this.c_fg;
    let b = this.c_bg;
    const s = this.state;
    const opt = this.decaf.options.set_display;
    const fgClass = opt?.fgclass || 'c';
    const bgClass = opt?.bgclass || 'b';
    const fntClass = opt?.fntclass || 'fnt';

    if (s & BRIGHT && f < 8) f += 8;

    let out = (closing ? '</span>' : '') + '<span class="';

    if (s & ITALIC) out += 'italic ';
    if (s & BLINK) out += 'blink ';
    if (s & UNDERLINE) out += 'underline ';
    if (s & DBLUNDER) out += 'doubleunderline ';
    if (s & FAINT) out += 'faint ';
    if (s & STRIKE) out += 'strike ';
    if (s & NEGATIVE) {
      b = f;
      f = this.c_bg;
    }

    if (this.c_fnt !== 0) out += `${fntClass}${this.c_fnt} `;
    if (f !== 7) out += `${fgClass}${f} `;
    if (b !== 0) out += `${bgClass}${b}`;
    out += '">';

    this.outbuf.push(out);
  }

  public message(text: string, className = 'message', needLine?: boolean): void {
    const span = document.createElement('span');
    if (className) span.className = className;
    if (this.needline && needLine !== false) {
      span.innerHTML = '<br>';
    }
    this.needline = false;
    span.innerHTML += text.replace(/ ( +)/g, (m) => (m.length === 2 ? ' &nbsp;' : ' ' + new Array(m.length - 1).join('&nbsp;') + ' ')) + '<br>';
    this.shouldScroll();
    this.display.appendChild(span);
    this.doScroll();
  }

  public shouldScroll(addTarget = true): void {
    if (this.willScroll !== undefined || this._display.style.overflowY === 'hidden') return;
    this.willScroll = this._display.scrollTop + 1 >= this._display.scrollHeight - this._display.offsetHeight;

    if (addTarget !== false && !this.willScroll && !this.scrollTarget) {
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
    if (this.scrollTime) clearTimeout(this.scrollTime);
    if (this.willScroll) {
      this.scrollTime = setTimeout(() => {
        if (this.scrollTarget) {
          this.scrollTarget.parentNode?.removeChild(this.scrollTarget);
          this.scrollTarget = undefined;
        }
        this._display.setAttribute('aria-busy', 'false');
        this.scroll();
        this.willScroll = undefined;
      }, 5);
    } else {
      this.scrollTime = setTimeout(() => {
        this._display.setAttribute('aria-busy', 'false');
        this.willScroll = undefined;
      }, 5);
    }
  }

  public scrollNew(): void {
    if (!this.scrollTarget) return;
    const to = this.scrollTarget.offsetTop;
    if (to > this._display.scrollTop) {
      this._display.scrollTop = to;
    } else {
      this.scroll();
    }
  }

  public scroll(): void {
    if (this._display.style.overflowY === 'hidden') return;
    this._display.scrollTop = this._display.scrollHeight;
  }

  public onScroll(): void {
    if (!this.scrollTarget) return;
    if (!(this._display.scrollTop >= this._display.scrollHeight - this._display.offsetHeight)) return;

    if (this.scrollTarget.parentNode) {
      this.scrollTarget.parentNode.removeChild(this.scrollTarget);
      this.scrollTarget = undefined;
    }

    if (this.ui && this.ui.hideScrollButton) {
      this.ui.hideScrollButton();
    }
  }

  public scrollUp(): void {
    const top = Math.max(0, this._display.scrollTop - this._display.clientHeight);
    this._display.scrollTop = top;
  }

  public scrollDown(): void {
    this._display.scrollTop = this._display.scrollTop + this._display.clientHeight;
  }
}
