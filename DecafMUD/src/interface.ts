/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

import { DecafMUDDisplay, DecafMUDInterface } from './types';
import { DecafMUD } from './decafmud';
import { StandardDisplay } from './display';
import { DragObject } from './dragelement';
import { StandardStorage } from './storage';

export type SubmenuList = (string | undefined)[];
export type ToolbarMenuItem = [string, string, string, SubmenuList];

export interface InfoBarData {
  text: string;
  clss: string;
  timeout: number;
  icon?: string;
  buttons?: [string, (e: Event) => void][];
  click?: (e: Event) => void;
  close?: (e: Event) => void;
  el?: HTMLElement;
}

export class PanelsInterface implements DecafMUDInterface {
  public decaf: DecafMUD;
  public container!: HTMLElement;
  public el_display!: HTMLElement;
  public sidebar!: HTMLElement;
  public progresstable!: HTMLElement;
  public mapdiv!: HTMLElement;
  public _input!: HTMLElement;
  public tray!: HTMLElement;
  public toolbar!: HTMLElement;
  public input!: HTMLInputElement | HTMLTextAreaElement;

  public display?: DecafMUDDisplay;
  public store!: StandardStorage;

  public echo = true;
  public inpFocus = false;
  public history: string[] = [];
  public historyPosition = -1;

  public splash: HTMLElement | null = null;
  public splash_pg: HTMLElement | null = null;
  public splash_pgi: HTMLElement | null = null;
  public splash_pgt: HTMLElement | null = null;
  public splash_st: HTMLElement | null = null;
  public splash_old: HTMLElement | null = null;
  public splash_err = false;

  public popup?: HTMLElement;
  public popupheader?: HTMLElement;
  public headerdrag?: DragObject;

  public infobars: InfoBarData[] = [];
  public ibar?: HTMLElement;
  public ibartimer?: ReturnType<typeof setTimeout>;

  public icons: [HTMLElement, ((e: Event) => void) | undefined, ((e: Event) => void) | undefined][] = [];
  public toolbuttons: Record<number, [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, ((e: Event) => void) | undefined]> = {};
  public toolbutton_id = -1;
  public toolbarPadding?: number;
  public ico_connected?: number;
  public scrollButton?: HTMLElement;

  private progressbars: [string, HTMLElement, HTMLElement][] = [];
  private old_y = '';
  private old_parent?: HTMLElement;
  private next_sib?: Element | null;
  private old_children: HTMLElement[] = [];
  private old_display: string[] = [];
  private old_body_over = '';

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;

    let targetContainer = decaf.options.set_interface?.container;
    if (typeof targetContainer === 'string') {
      const found = document.querySelector(targetContainer);
      if (found instanceof HTMLElement) {
        targetContainer = found;
      }
    }

    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error('DecafMUD container element not found or invalid.');
    }

    this.container = targetContainer;
    this.container.setAttribute('role', 'application');
    this.container.className += ' decafmud mud interface';

    this.el_display = document.createElement('div');
    this.el_display.className = 'decafmud mud-pane primary-pane';
    this.el_display.setAttribute('role', 'log');
    this.el_display.setAttribute('tabIndex', '0');
    this.container.appendChild(this.el_display);

    this.sidebar = document.createElement('div');
    this.sidebar.className = 'decafmud mud-pane side-pane';
    this.sidebar.setAttribute('tabIndex', '1');
    this.container.appendChild(this.sidebar);

    this.progresstable = document.createElement('table');
    this.progresstable.style.display = 'none';
    this.sidebar.appendChild(this.progresstable);

    this.mapdiv = document.createElement('div');
    this.mapdiv.style.display = 'none';
    this.sidebar.appendChild(this.mapdiv);

    this.el_display.onmouseup = () => this.maybeFocusInput();
    this.el_display.addEventListener('keydown', (e) => this.displayKey(e));
    this.sidebar.addEventListener('keydown', (e) => this.displayKey(e));

    this._input = document.createElement('div');
    this._input.className = 'decafmud input-cont';

    this.tray = document.createElement('div');
    this.tray.className = 'decafmud icon-tray';
    this._input.appendChild(this.tray);

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'decafmud toolbar';
    this.toolbar.setAttribute('role', 'toolbar');

    const hideHandler = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (el?.className) {
        el.className = el.className.replace(' visible', '');
      }
    };
    this.toolbar.addEventListener('mousemove', hideHandler);
    this.toolbar.addEventListener('blur', hideHandler);

    this.input = document.createElement('input');
    this.input.id = 'inputelement';
    this.input.title = 'MUD Input';
    this.input.type = 'text';
    this.input.className = 'decafmud input';
    this._input.insertBefore(this.input, this._input.firstChild);
    this.container.appendChild(this._input);

    this.input.addEventListener('keydown', (e) => this.handleInput(e));
    const blurHelper = (e: Event) => this.handleBlur(e);
    this.input.addEventListener('blur', blurHelper);
    this.input.addEventListener('focus', blurHelper);

    for (let i = 0; i < 100; i++) this.history[i] = '';

    this.reset();
    window.addEventListener('resize', () => this.resizeScreen(true, false));

    setTimeout(() => {
      if (this.input) this.input.focus();
    }, 10);
  }

  public initSplash(percentage = 0, message = 'Initializing interface...'): void {
    this.old_y = this.el_display.style.overflowY;
    this.el_display.style.overflowY = 'hidden';

    this.splash = document.createElement('div');
    this.splash.className = 'decafmud splash';
    this.splash.innerHTML = `<h2 class="decafmud heading">DecafMUD <span class="version">v${DecafMUD.version.toString()}</span></h2>`;

    this.splash_pg = document.createElement('div');
    this.splash_pg.className = 'decafmud progress';
    this.splash_pg.setAttribute('role', 'progressbar');
    this.splash_pg.setAttribute('aria-valuemax', '100');
    this.splash_pg.setAttribute('aria-valuemin', '0');
    this.splash_pg.setAttribute('aria-valuenow', percentage.toString());
    this.splash_pg.setAttribute('aria-valuetext', `${percentage}%`);

    this.splash_pgi = document.createElement('div');
    this.splash_pgi.className = 'decafmud inner-progress';
    this.splash_pgi.style.cssText = `width:${percentage}%;`;
    this.splash_pg.appendChild(this.splash_pgi);

    this.splash_pgt = document.createElement('div');
    this.splash_pgt.className = 'decafmud progress-text';
    this.splash_pgt.innerHTML = `${percentage}%`;
    this.splash_pg.appendChild(this.splash_pgt);

    this.splash.appendChild(this.splash_pg);

    this.splash_st = document.createElement('div');
    this.splash_st.className = 'decafmud status';
    this.splash_st.innerHTML = message;
    this.splash.appendChild(this.splash_st);

    this.splash_old = document.createElement('div');
    this.splash_old.className = 'decafmud old';
    this.splash.appendChild(this.splash_old);

    this.container.appendChild(this.splash);
  }

  public endSplash(): void {
    if (this.splash && this.splash.parentNode) {
      this.splash.parentNode.removeChild(this.splash);
    }
    this.el_display.style.overflowY = this.old_y;
    this.splash = this.splash_pg = this.splash_pgi = this.splash_pgt = this.splash_st = this.splash_old = null;
  }

  public updateSplash(percentage?: number, message?: string | null): void {
    if (!this.splash || this.splash_err) return;
    if (percentage !== undefined && this.splash_pg && this.splash_pgt && this.splash_pgi) {
      const text = `${percentage}%`;
      this.splash_pg.setAttribute('aria-valuenow', percentage.toString());
      this.splash_pg.setAttribute('aria-valuetext', text);
      this.splash_pgt.innerHTML = text;
      this.splash_pgi.style.cssText = `width:${percentage}%;`;
    }
    if (!message || !this.splash_st || !this.splash_old) return;

    const e = document.createElement('div');
    let t = this.splash_st.innerHTML;
    if (t.endsWith('...')) t += 'done.';
    e.innerHTML = t;
    this.splash_old.insertBefore(e, this.splash_old.firstChild);
    this.splash_st.innerHTML = message;
  }

  public splashError(message: string): boolean {
    if (!this.splash || !this.splash_pgt || !this.splash_pgi || !this.splash_st) return false;
    this.splash_pgt.innerHTML = '<b>Error</b>';
    this.splash_pgi.className += ' error';
    this.splash_st.innerHTML = message;
    this.splash_err = true;
    return true;
  }

  public load(): void {
    // Required resources loaded automatically
  }

  public setup(): void {
    this.store = this.decaf.store.sub('ui') as StandardStorage;
    const tbar = this.store.get('toolbar-position', 'top-left');
    this.toolbar.className += ` ${tbar}`;
    this.container.insertBefore(this.toolbar, this.container.firstChild);

    this.display = new StandardDisplay(this.decaf, this, this.el_display);
    this.display.display.id = 'mud-display';
    this.decaf.display = this.display;

    this.ico_connected = this.addIcon('You are currently disconnected.', '', 'connectivity disconnected');

    const startFull = this.store.get('fullscreen-start', this.decaf.options.set_interface?.start_full || false);
    if (startFull) {
      this.enter_fs(false);
    } else {
      if (!this._resizeToolbar()) {
        this.resizeScreen(false);
      }
    }
  }

  public reset(): void {
    this.echo = true;
    this.inpFocus = false;
    if (this.display) this.display.reset();
  }

  public displayInput(text: string): void {
    if (!this.display || !this.echo) return;
    this.display.message(`<span class="command">${text}</span>`, 'user-input', false);
  }

  public localEcho(echo: boolean): void {
    if (echo === this.echo) return;
    this.echo = echo;
    this.updateInput();
  }

  public connected(): void {
    this.updateIcon(this.ico_connected ?? 0, 'Connected.', '', 'connectivity connected');
  }

  public connecting(): void {
    const msg = this.decaf.options.set_interface?.msg_connecting || 'Attempting to connect...';
    if (this.display) {
      this.display.message(`<span class="c6">${msg}</span>`);
    }
    this.updateIcon(this.ico_connected ?? 0, 'Attempting to connect...', '', 'connectivity connecting');
  }

  public disconnected(): void {
    if (this.display) {
      this.display.message('<span class="c6">Connection closed.</span>');
    }
    this.updateIcon(this.ico_connected ?? 0, 'Disconnected.', '', 'connectivity disconnected');
  }

  public infoBar(
    text: string,
    clss = 'info',
    timeout = 0,
    icon?: string,
    buttons?: [string, (e: Event) => void][],
    click?: (e: Event) => void,
    close?: (e: Event) => void
  ): void {
    const ibarData: InfoBarData = { text, clss, timeout, icon, buttons, click, close };
    this.infobars.push(ibarData);
    if (!this.ibar) {
      this.createIBar();
    }
  }

  public immediateInfoBar(
    text: string,
    clss = 'info',
    timeout = 0,
    icon?: string,
    buttons?: [string, (e: Event) => void][],
    click?: (e: Event) => void,
    close?: (e: Event) => void
  ): boolean {
    if (this.ibar) return false;
    this.infoBar(text, clss, timeout, icon, buttons, click, close);
    return true;
  }

  private createIBar(): void {
    const ibar = this.infobars[0];
    if (!ibar) return;

    const obj = document.createElement('div');
    obj.setAttribute('role', 'alert');
    obj.className = `decafmud infobar ${ibar.clss}`;
    obj.innerHTML = ibar.text;
    obj.style.cssText = 'top: -26px;';

    if (ibar.click) {
      obj.className += ' clickable';
      obj.setAttribute('tabIndex', '0');
    }

    const closer = (e: Event) => {
      const keyEvt = e as KeyboardEvent;
      if (e.type === 'keydown' && keyEvt.keyCode !== 13 && keyEvt.keyCode !== 27) return;
      if (e.type === 'click' && typeof ibar.click !== 'function') return;

      e.stopPropagation();
      this.closeIBar(true);

      if (e.type === 'keydown' && keyEvt.keyCode === 27) {
        if (ibar.close) ibar.close.call(this, e);
        return;
      }
      if (ibar.click) ibar.click.call(this, e);
    };

    obj.addEventListener('click', closer);
    obj.addEventListener('keydown', closer);

    const closebtn = document.createElement('div');
    closebtn.innerHTML = 'X';
    closebtn.className = 'close';
    closebtn.setAttribute('tabIndex', '0');
    closebtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeIBar(true);
      if (ibar.close) ibar.close.call(this, e);
    });
    obj.insertBefore(closebtn, obj.firstChild);

    if (ibar.buttons) {
      const btncont = document.createElement('div');
      btncont.className = 'btncont';
      for (const btn of ibar.buttons) {
        const b = document.createElement('a');
        b.className = 'button';
        b.setAttribute('href', '#');
        b.innerHTML = btn[0];
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeIBar(true);
          btn[1].call(this, e);
        });
        btncont.appendChild(b);
      }
      obj.insertBefore(btncont, closebtn);
    }

    this.ibar = obj;
    ibar.el = obj;
    this.container.insertBefore(obj, this.container.firstChild);

    setTimeout(() => {
      let pt = 0;
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        pt = parseInt(window.getComputedStyle(obj, null).paddingTop, 10) || 0;
      }
      if (this.toolbarPadding) pt += this.toolbarPadding - 10;
      obj.style.cssText = `background-position: 5px ${pt}px; padding-top: ${pt}px; transition: top 0.1s linear; top: inherit;`;
      if (ibar.icon) {
        obj.style.cssText += `background-image: url("${ibar.icon}")`;
      }
    }, 0);

    if (ibar.timeout > 0) {
      this.ibartimer = setTimeout(() => this.closeIBar(), 1000 * ibar.timeout);
    }
  }

  public closeIBar(steptwo = false): void {
    if (!this.ibar) return;
    if (this.ibartimer) clearTimeout(this.ibartimer);

    if (!steptwo) {
      this.ibar.style.opacity = '0';
      this.ibartimer = setTimeout(() => this.closeIBar(true), 250);
      return;
    }

    if (this.ibar.parentNode) {
      this.ibar.parentNode.removeChild(this.ibar);
    }
    this.ibar = undefined;
    this.infobars.shift();

    if (this.infobars.length > 0) {
      this.createIBar();
    }
  }

  public addIcon(
    text: string,
    html: string,
    clss: string,
    onclick?: (e: Event) => void,
    onkey?: (e: Event) => void
  ): number {
    const ico = document.createElement('div');
    ico.className = `decafmud status-icon ${clss}${onclick ? ' icon-click' : ''}`;
    ico.innerHTML = html;
    ico.setAttribute('title', text);
    ico.setAttribute('role', 'status');
    ico.setAttribute('aria-label', text);

    if (onclick || onkey) {
      ico.setAttribute('tabIndex', '0');
    }

    const ind = this.icons.push([ico, onclick, onkey]) - 1;

    for (let i = 0; i < this.icons.length; i++) {
      this.icons[i][0].style.cssText = `right:${(this.icons.length - i - 1) * 21}px`;
    }

    this.tray.appendChild(ico);

    if (onclick) ico.addEventListener('click', (e) => onclick.call(this, e));
    if (onclick && !onkey) {
      ico.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).keyCode === 13) onclick.call(this, e);
      });
    }
    if (onkey) ico.addEventListener('keydown', (e) => onkey.call(this, e));

    this._resizeTray();
    return ind;
  }

  public delIcon(ind: number): void {
    if (ind < 0 || ind >= this.icons.length) return;
    const el = this.icons[ind][0];
    this.icons.splice(ind, 1);
    if (el.parentNode) el.parentNode.removeChild(el);

    for (let i = 0; i < this.icons.length; i++) {
      this.icons[i][0].style.cssText = `right:${(this.icons.length - i - 1) * 21}px`;
    }
    this._resizeTray();
  }

  public updateIcon(ind: number, text?: string, html?: string, clss?: string): void {
    if (ind < 0 || ind >= this.icons.length) return;
    const item = this.icons[ind];
    const el = item[0];
    const onclick = item[1];

    if (clss) el.className = `decafmud status-icon ${clss}${onclick ? ' icon-click' : ''}`;
    if (html !== undefined) el.innerHTML = html;
    if (text) {
      el.setAttribute('title', text);
      el.setAttribute('aria-label', text);
    }
  }

  private _resizeTray(): void {
    const w = this.tray.clientWidth;
    this._input.style.cssText = `padding-right:${w}px`;
  }

  public tbNew(
    btnid: string,
    text: string,
    icon?: string,
    tooltip?: string,
    type = 0,
    enabled = true,
    pressed = false,
    clss?: string,
    onclick?: (e: Event) => void
  ): number {
    const ind = ++this.toolbutton_id;
    const btn = document.createElement('span');
    btn.id = btnid;
    btn.className = 'decafmud button toolbar-button';
    if (clss) btn.className += ` ${clss}`;
    if (type === 1) btn.className += ` toggle ${pressed ? 'toggle-pressed' : 'toggle-depressed'}`;
    btn.innerHTML = text;
    btn.title = tooltip || text;
    if (!enabled) btn.className += ' disabled';
    btn.setAttribute('tabIndex', '0');
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-disabled', (!enabled).toString());
    if (type === 1) btn.setAttribute('aria-pressed', pressed.toString());

    if (icon) {
      btn.style.cssText = `background-image: url(${icon});`;
      btn.className += ' icon';
    }

    if (onclick) {
      const helper = (e: Event) => {
        const keyEvt = e as KeyboardEvent;
        if (e.type === 'keydown' && keyEvt.keyCode !== 13) return;
        const button = this.toolbuttons[ind];
        if (!button || !button[5]) return;
        onclick.call(this, e);
        if (e.type && e.type !== 'keydown') btn.blur();
      };
      btn.addEventListener('click', helper);
      btn.addEventListener('keydown', helper);
    }

    this.toolbuttons[ind] = [btn, text, icon, tooltip, type, enabled, pressed, clss, onclick];
    btn.setAttribute('button-id', ind.toString());
    this.toolbar.appendChild(btn);
    this._resizeToolbar();

    return ind;
  }

  public _resizeToolbar(): boolean {
    let ret = false;
    if (this.display && this.toolbarPadding !== this.toolbar.clientHeight) {
      this.display.shouldScroll();
      this.el_display.style.paddingTop = `${this.toolbar.clientHeight}px`;
      this.toolbarPadding = this.toolbar.clientHeight;
      this.resizeScreen(false, true);
      this.display.doScroll();
      ret = true;
    } else {
      this.toolbarPadding = this.toolbar.clientHeight;
    }
    return ret;
  }

  public showScrollButton(): void {
    if (this.scrollButton) return;
    const sb = document.createElement('div');
    sb.className = 'button scroll-button';
    sb.setAttribute('tabIndex', '0');
    sb.innerHTML = 'More';

    const helper = (e: Event) => {
      const keyEvt = e as KeyboardEvent;
      if (e.type === 'keydown' && keyEvt.keyCode !== 13) return;
      if (this.display) this.display.scrollNew();
    };
    sb.addEventListener('click', helper);
    sb.addEventListener('keydown', helper);

    this.scrollButton = sb;
    this.container.appendChild(sb);
    sb.style.cssText = `bottom:${this._input.offsetHeight + 12}px`;
  }

  public hideScrollButton(): void {
    if (!this.scrollButton) return;
    if (this.scrollButton.parentNode) {
      this.scrollButton.parentNode.removeChild(this.scrollButton);
    }
    this.scrollButton = undefined;
  }

  public enter_fs(_showSize = true): void {
    if (this.container.className.indexOf('fullscreen') !== -1) return;
    const hasFocus = this.inpFocus;
    if (this.display) this.display.shouldScroll(false);

    this.old_parent = this.container.parentNode as HTMLElement;
    this.next_sib = this.container.nextElementSibling;
    this.old_parent.removeChild(this.container);

    this.container.className += ' fullscreen';

    for (let i = 0; i < document.body.children.length; i++) {
      const child = document.body.children[i] as HTMLElement;
      if (child.id !== '_firebugConsole') {
        this.old_children.push(child);
        this.old_display.push(child.style.display);
        child.style.display = 'none';
      }
    }

    this.old_body_over = document.body.style.overflow;
    document.body.appendChild(this.container);
    window.scroll(0, 0);

    this._resizeToolbar();
    this.resizeScreen(_showSize, false);
    if (hasFocus) this.input.focus();
    if (this.display) this.display.doScroll();
  }

  public exit_fs(): void {
    if (!this.old_parent) return;
    const hasFocus = this.inpFocus;
    if (this.display) this.display.shouldScroll(false);

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    for (let i = 0; i < this.old_children.length; i++) {
      this.old_children[i].style.display = this.old_display[i];
    }
    this.old_children = [];
    this.old_display = [];

    this.container.className = this.container.className.replace(' fullscreen', '');

    if (this.next_sib) {
      this.old_parent.insertBefore(this.container, this.next_sib);
    } else {
      this.old_parent.appendChild(this.container);
    }

    document.body.style.overflow = this.old_body_over;

    this._resizeToolbar();
    this.resizeScreen(true, false);
    if (hasFocus) this.input.focus();
    if (this.display) this.display.doScroll();
  }

  public click_fsbutton(): void {
    if (this.container.className.indexOf('fullscreen') === -1) {
      this.enter_fs();
    } else {
      this.exit_fs();
    }
  }

  public resizeScreen(_showSize = false, force = false): void {
    this.hidePopup();
    const totHeight = this.container.offsetHeight;

    let tot = totHeight - (this._input.offsetHeight + 17);
    if (this.toolbarPadding) tot -= this.toolbarPadding - 12;
    if (tot < 0) tot = 0;

    if (this.toolbarPadding) {
      tot -= 12;
      if (tot < 0) tot = 0;
    }

    this.el_display.style.height = `${tot}px`;
    if (force !== true && this.display) {
      this.display.scroll();
    }

    if (this.scrollButton) {
      this.scrollButton.style.cssText = `bottom:${this._input.offsetHeight + 12}px`;
    }
  }

  public showSidebar(): void {
    this.sidebar.style.display = 'inline';
  }

  public hideSidebar(): void {
    this.sidebar.style.display = 'none';
  }

  public showProgressBars(): void {
    this.progresstable.style.display = 'inline';
    this.progresstable.style.height = 'auto';
  }

  public hideProgressBars(): void {
    this.progresstable.style.display = 'none';
    this.progresstable.style.height = '0';
  }

  public showMap(): void {
    this.mapdiv.style.display = 'inline';
  }

  public hideMap(): void {
    this.mapdiv.style.display = 'none';
  }

  public addProgressBar(name: string, col: string): void {
    const w = 100;
    const h = 20;

    const tr = document.createElement('tr');
    this.progresstable.appendChild(tr);

    let td = document.createElement('td');
    tr.appendChild(td);
    td.innerHTML = `${name}:`;

    td = document.createElement('td');
    tr.appendChild(td);

    const bar = document.createElement('div');
    bar.style.width = `${w}px`;
    bar.style.height = `${h}px`;
    bar.style.backgroundColor = 'white';

    const progress = document.createElement('div');
    progress.style.width = '0px';
    progress.style.height = `${h}px`;
    progress.style.backgroundColor = col;

    const info = document.createElement('div');
    info.style.width = bar.style.width;
    info.style.height = bar.style.height;
    info.style.marginTop = `${-h}px`;
    info.style.textAlign = 'center';

    td.appendChild(bar);
    bar.appendChild(progress);
    td.appendChild(info);

    this.progressbars.push([name, progress, info]);
  }

  public setProgress(name: string, percent: number, txt: string): void {
    const w = 100;
    for (const pb of this.progressbars) {
      if (pb[0] === name) {
        pb[1].style.width = `${(percent * w) / 100}px`;
        pb[2].innerHTML = txt;
      }
    }
  }

  public setProgressColor(name: string, col: string): void {
    for (const pb of this.progressbars) {
      if (pb[0] === name) {
        pb[1].style.backgroundColor = col;
      }
    }
  }

  public maxPopupHeight(): number {
    let tot = this.container.offsetHeight - (this._input.offsetHeight + 50);
    if (this.toolbarPadding) tot -= this.toolbarPadding - 12;
    return Math.max(0, tot);
  }

  public maxPopupWidth(): number {
    return Math.max(0, this.container.offsetWidth - 12);
  }

  public verticalPopupOffset(): number {
    return 50;
  }

  public horizontalPopupOffset(): number {
    return 0;
  }

  public hidePopup(): void {
    if (!this.popup) return;
    if (this.headerdrag) this.headerdrag.StopListening(true);
    if (this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
    this.popup = undefined;
    this.popupheader = undefined;
    this.input.focus();
  }

  public showPopup(): HTMLElement {
    if (this.popup) this.hidePopup();

    this.popup = document.createElement('div');

    let w = this.maxPopupWidth();
    let h = this.maxPopupHeight();
    const t = this.verticalPopupOffset();
    let l = this.horizontalPopupOffset();

    l += (w * 2) / 10;
    w = (w * 6) / 10;
    h = (h * 7) / 10;

    this.popup.style.width = `${w}px`;
    this.popup.style.height = `${h}px`;
    this.popup.style.top = `${t}px`;
    this.popup.style.left = `${l}px`;
    this.popup.className = 'decafmud window';
    this.popup.id = 'popup';
    this.container.insertBefore(this.popup, this.el_display);

    this.popupheader = document.createElement('div');
    this.popupheader.style.width = `${w}px`;
    this.popupheader.style.height = '25px';
    this.popupheader.className = 'decafmud window-header';
    this.popupheader.id = 'popupheader';
    this.popup.appendChild(this.popupheader);
    this.headerdrag = new DragObject(this.popup, this.popupheader);

    const x = document.createElement('button');
    x.innerHTML = '<big>X</big>';
    x.className = 'closebutton';
    x.addEventListener('click', () => this.hidePopup());
    this.popup.appendChild(x);

    return this.popup;
  }

  private maybeFocusInput(): void {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.toString() !== '' && sel.focusNode?.parentNode && this.el_display.contains(sel.focusNode.parentNode)) {
      return;
    }
    this.input.focus();
  }

  private displayKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const code = e.keyCode;
    if (
      (code > 64 && code < 91) ||
      (code > 47 && code < 58) ||
      (code > 185 && code < 193) ||
      (code > 218 && code < 223)
    ) {
      this.input.focus();
    }
  }

  private saveInputInHistory(): void {
    const txt = this.input.value;
    if (txt === '' || txt === this.history[0]) return;

    let lastid = -1;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i] === txt) {
        lastid = i;
        break;
      }
    }
    if (lastid === -1) lastid = this.history.length - 1;
    for (let i = lastid; i > 0; i--) {
      this.history[i] = this.history[i - 1];
    }
    this.history[0] = txt;
  }

  private inputModified(): boolean {
    const txt = this.input.value;
    if (this.historyPosition === -1) return txt !== '';
    return txt !== this.history[this.historyPosition];
  }

  private loadInput(): void {
    if (this.historyPosition === -1) {
      this.input.value = '';
    } else {
      this.input.focus();
      this.input.value = this.history[this.historyPosition];
    }
  }

  public parseInput(inp: string): void {
    const lines = inp.split(';;');
    for (const line of lines) {
      this.decaf.sendInput(line);
    }
  }

  private handleInput(e: Event): void {
    if (e.type !== 'keydown') return;
    const keyEvt = e as KeyboardEvent;

    if (keyEvt.keyCode === 112 || keyEvt.keyCode === 116) {
      keyEvt.preventDefault();
    }

    if (keyEvt.keyCode === 13) {
      this.parseInput(this.input.value);
      this.saveInputInHistory();
      this.historyPosition = 0;
      if (!this.decaf.options.set_interface?.repeat_input) {
        this.input.value = '';
      }
      this.input.select();
    } else if (
      typeof (window as unknown as Record<string, unknown>).tryExtraMacro !== 'undefined' &&
      ((window as unknown as Record<string, (decaf: DecafMUD, code: number) => boolean>).tryExtraMacro(this.decaf, keyEvt.keyCode))
    ) {
      keyEvt.preventDefault();
    } else if (keyEvt.keyCode === 33) {
      if (this.display) {
        this.display.scrollUp();
        keyEvt.preventDefault();
      }
    } else if (keyEvt.keyCode === 34) {
      if (this.display) {
        this.display.scrollDown();
        keyEvt.preventDefault();
      }
    } else if (keyEvt.keyCode === 40) {
      if (this.inputModified()) this.historyPosition = -1;
      if (this.historyPosition === -1) this.saveInputInHistory();
      else if (this.historyPosition === 0) this.historyPosition = -1;
      else this.historyPosition--;
      this.loadInput();
    } else if (keyEvt.keyCode === 38) {
      if (this.inputModified()) this.historyPosition = -1;
      if (this.historyPosition === -1) {
        if (this.input.value === '') this.historyPosition = 0;
        else {
          this.saveInputInHistory();
          this.historyPosition = 1;
        }
      } else if (this.historyPosition < this.history.length - 1) {
        this.historyPosition++;
      }
      this.loadInput();
    } else if (keyEvt.keyCode === 8 && keyEvt.shiftKey) {
      this.input.value = '';
    }
  }

  private handleBlur(e: Event): void {
    const bc = this.decaf.options.set_interface?.blurclass || 'mud-input-blur';
    if (e.type === 'blur') {
      if (this.input.value === '') {
        this.input.className += ` ${bc}`;
      }
      this.inpFocus = false;
    } else if (e.type === 'focus') {
      const parts = this.input.className.split(' ');
      this.input.className = parts.filter((p) => p !== bc).join(' ');
      this.inpFocus = true;
    }
  }

  private updateInput(): void {
    if (!this.input) return;
    const foc = this.inpFocus;
    const inp = this.input;
    const par = inp.parentNode;
    if (!par) return;

    if (!this.echo) {
      const newInp = document.createElement('input');
      newInp.type = 'password';
      newInp.className = inp.className;
      newInp.id = inp.id;
      par.replaceChild(newInp, inp);
      this.input = newInp;
      this.input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).keyCode === 13) {
          this.decaf.sendInput(this.input.value);
          this.input.value = '';
        }
      });
    } else {
      const newInp = document.createElement('input');
      newInp.type = 'text';
      newInp.className = inp.className;
      newInp.id = inp.id;
      par.replaceChild(newInp, inp);
      this.input = newInp;
      this.input.addEventListener('keydown', (e) => this.handleInput(e));
    }

    this.inpFocus = foc;
    this.input.addEventListener('blur', (e) => this.handleBlur(e));
    this.input.addEventListener('focus', (e) => this.handleBlur(e));
    if (this.inpFocus) {
      setTimeout(() => {
        this.input.select();
        this.input.focus();
      }, 1);
    }
  }
}
