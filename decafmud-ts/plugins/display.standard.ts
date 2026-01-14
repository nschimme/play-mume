import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

class StandardDisplay {
  private decaf: DecafMUD;
  private displayContainer: HTMLElement;
  private display: HTMLElement;
  private needline = false;
  private inbuf: string[] = [];
  private outbuf: string[] = [];

  // ANSI state
  private state = 0;
  private c_fg = 7;
  private c_bg = 0;
  private c_fnt = 0;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    const container = this.decaf.options.set_interface?.container;

    if (!container) {
      throw new Error('Display container not specified in options.');
    }

    this.displayContainer = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container;

    if (!this.displayContainer) {
        throw new Error(`Display container '${container}' not found.`);
    }

    this.display = document.createElement('div');
    this.display.className = 'decafmud display c7';
    this.displayContainer.appendChild(this.display);

    this.clear();
    this.message('DecafMUD v' + DecafMUD.version + ' by Stendec');
  }

  public clear(): void {
    this.display.innerHTML = '';
    this.reset();
  }

  public reset(): void {
    this.state = 0;
    this.c_fg = 7;
    this.c_bg = 0;
    this.c_fnt = 0;
  }

  public handleData(data: string): void {
    this.inbuf.push(data);
    this.processData();
  }

  private processData(): void {
    if (this.inbuf.length === 0) return;

    let data = this.inbuf.join('');
    this.inbuf = [];

    // Basic ANSI parsing (simplified)
    // In a real implementation, a more robust parser would be needed
    const esc = '\x1B';
    let i;
    while ((i = data.indexOf(esc)) !== -1) {
        if (i > 0) this.outbuf.push(data.substring(0, i));

        // Very simplified CSI handling
        if (data.charAt(i + 1) === '[') {
            const end = data.substring(i + 2).search(/[\x40-\x7E]/);
            if (end !== -1) {
                const seq = data.substring(i + 2, i + 2 + end + 1);
                this.handleAnsiCSI(seq);
                data = data.substring(i + 2 + end + 1);
            } else {
                break; // Incomplete sequence
            }
        } else {
            data = data.substring(i + 1); // Skip unknown escape code
        }
    }
    if (data.length > 0) this.outbuf.push(data);

    this.flushOutput();
  }

  private handleAnsiCSI(seq: string): void {
      if (seq.endsWith('m')) {
          // Simplified SGR handling
          this.outColor(true); // Close previous span
          const codes = seq.slice(0, -1).split(';').map(s => parseInt(s) || 0);
          for (const code of codes) {
              if (code === 0) { // Reset
                  this.state = 0; this.c_fg = 7; this.c_bg = 0;
              } else if (code >= 30 && code <= 37) {
                  this.c_fg = code - 30;
              } else if (code >= 40 && code <= 47) {
                  this.c_bg = code - 40;
              }
          }
          this.outColor(false); // Open new span
      }
  }

  private outColor(closing: boolean): void {
      if (closing) {
          this.outbuf.push('</span>');
      } else {
          this.outbuf.push(`<span class="c${this.c_fg} b${this.c_bg}">`);
      }
  }

  private flushOutput(): void {
    if (this.outbuf.length === 0) return;

    // Always start with an open color span if we don't have one
    if (this.outbuf[0] !== '</span>' && !this.outbuf[0].startsWith('<span')) {
        this.outbuf.unshift(`<span class="c${this.c_fg} b${this.c_bg}">`);
    }

    const html = this.outbuf.map(s => {
        if (s.startsWith('<span') || s === '</span>') {
            return s;
        }
        return s.replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
                .replace(/ /g, '&nbsp;');
    }).join('');

    this.outbuf = [];

    const span = document.createElement('span');
    span.innerHTML = html;
    this.display.appendChild(span);
    this.scrollToBottom();
  }

  public message(text: string, className = 'message'): void {
    const span = document.createElement('div');
    span.className = className;
    span.innerHTML = (this.needline ? '<br>' : '') + text.replace(/ /g, '&nbsp;') + '<br>';
    this.needline = false;
    this.display.appendChild(span);
    this.scrollToBottom();
  }

  public getRawContent(): string {
      return this.display.innerHTML;
  }

  private scrollToBottom(): void {
    this.displayContainer.scrollTop = this.displayContainer.scrollHeight;
  }
}

class StandardDisplayPlugin implements Plugin {
  public readonly name = 'standard';

  public install(decaf: DecafMUD): void {
    decaf.registerDisplay('standard', StandardDisplay);
  }
}

export const standardDisplayPlugin = new StandardDisplayPlugin();
