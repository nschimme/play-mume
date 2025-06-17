// SPDX-License-Identifier: MIT
import { IDecafMUD, IUi, IDisplay, IStorage, DecafMUDConstructor, SetInterfaceOptions } from './decafmud.types';

((DecafMUD_Global: DecafMUDConstructor | any) => {

class SimpleInterface implements IUi {
    // Properties from IUi (and others necessary for these methods)
    public decaf: IDecafMUD;
    public container: HTMLElement;
    public el_display: HTMLElement;
    public input: HTMLInputElement | HTMLTextAreaElement;
    public _input: HTMLElement;
    public tray: HTMLElement;
    public toolbar: HTMLElement;
    public toolbuttons: { [id: number]: [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, Function | undefined] } = {};
    public infobars: any[] = [];
    public icons: [HTMLElement, Function | undefined, Function | undefined][] = [];
    public echo: boolean = true;
    public inpFocus: boolean = false;
    public splash: HTMLElement | null = null;
    public splash_st: HTMLElement | null = null;
    public splash_pgi: HTMLElement | null = null;
    public splash_pgt: HTMLElement | null = null;
    public splash_old: HTMLElement | null = null;
    public scrollButton?: HTMLElement;
    public settings?: HTMLElement;
    public store?: IStorage;

    public display?: IDisplay;
    public mruIndex: number = 0;
    public mruHistory: string[] = [];
    public mruSize: number = 15;
    public mruTemp: boolean = false;
    public masked: boolean = false;
    public inputCtrl: boolean = false;
    public hasFocus: boolean = false;
    public reqTab: boolean = false;
    public wantTab: boolean = false;
    public tabIndex: number = -1;
    public tabValues: string[] = [];
    public buffer: string = '';
    public inp_buffer?: string;
    public toolbutton_id: number = -1;
    public ico_connected: number = -1;
    private splash_err: boolean = false;
    private old_y?: string;

    // Properties needed for methods being implemented now or soon
    private old_parent?: HTMLElement | ParentNode | null;
    private next_sib?: Element | ChildNode | null;
    private oldscrollX?: number;
    private oldscrollY?: number;
    private old_children: Element[] = [];
    private old_display_styles: string[] = [];
    private old_body_over?: string;
    private old_fs: boolean = false;
    private goFullOnResize: boolean = true;
    private sizeel?: HTMLElement;
    private sizetm?: number;
    private set_cont?: HTMLElement;
    private set_mid?: HTMLElement;
    private stbutton: number = -1;
    private toolbarPadding?: number;
    private ibar?: HTMLElement; // For InfoBar
    private ibartimer?: number; // For InfoBar
    private old_tbarpos?: string;
    private fsbutton?: number;
    private logbutton?: number;

    public static supports = {
        "tabComplete": true,
        "multipleOut": false,
        "fullscreen": true,
        "editor": false,
        "splash": true
    };

    constructor(decaf: IDecafMUD) {
        this.decaf = decaf;
        const set_interface = this.decaf.options.set_interface as SetInterfaceOptions;
        const optionsContainer = set_interface.container;
        if (typeof optionsContainer === "string") {
            const el = document.querySelector(optionsContainer);
            if (!el) throw new Error("Container selector \"" + optionsContainer + "\" not found.");
            this.container = el as HTMLElement;
        } else if (optionsContainer instanceof HTMLElement) {
            this.container = optionsContainer;
        } else {
            throw new Error("Container must be a valid DOM element or selector string!");
        }
        this.container.setAttribute("role", "application");
        this.container.className += " decafmud mud interface";
        this.el_display = document.createElement("div");
        this.el_display.className = "decafmud mud-pane primary-pane";
        this.el_display.setAttribute("role", "log");
        this.el_display.setAttribute("aria-live", "assertive");
        this.el_display.setAttribute("tabIndex","0");
        this.container.appendChild(this.el_display);
        this._input = document.createElement("div");
        this._input.className = "decafmud input-cont";
        this.tray = document.createElement("div");
        this.tray.className = "decafmud icon-tray";
        this._input.appendChild(this.tray);
        this.toolbuttons = {}; this.infobars = []; this.icons = [];
        this.toolbar = document.createElement("div");
        this.toolbar.className = "decafmud toolbar";
        this.toolbar.setAttribute("role","toolbar");
        const h = function(this: HTMLElement){if(!this.className){return;}this.className = this.className.replace(" visible","");};
        this.toolbar.addEventListener("mousemove", h.bind(this.toolbar));
        this.toolbar.addEventListener("blur", h.bind(this.toolbar));
        const inputEl = document.createElement("input");
        inputEl.title = "MUD Input";
        inputEl.setAttribute("role","textbox");
        inputEl.setAttribute("aria-label", inputEl.title);
        inputEl.type = "text";
        inputEl.className = "decafmud input";
        this.input = inputEl;
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);
        this.el_display.addEventListener("keydown", (e: Event) => { if(this.displayKey) this.displayKey(e as KeyboardEvent); });
        this.input.addEventListener("keydown", (e: Event) => this.handleInput(e as KeyboardEvent));
        const blurFocusHelper = (e: Event) => { this.handleBlur(e as FocusEvent); };
        this.input.addEventListener("blur", blurFocusHelper);
        this.input.addEventListener("focus", blurFocusHelper);
        window.addEventListener("resize",() => { this.resizeScreen(); });
        this.mruSize = set_interface.mru_size === undefined ? 15 : set_interface.mru_size;
        this.reset();
    }

    public reset(): void {
        this.masked = false; this.inputCtrl = false; this.mruIndex = 0; this.mruHistory = [];
        this.mruTemp = false; this.hasFocus = false; this.reqTab = false; this.wantTab = false;
        this.tabIndex = -1; this.tabValues = []; this.buffer = "";
        if (this.input) { this.updateInput(); }
        if (this.display) { this.display.reset(); }
    }

    public initSplash(percentage?: number, message?: string): void {
        const p = percentage === undefined ? 0 : percentage;
        const msg = message === undefined ? "Discombobulating interface recipient..." : message;
        this.old_y = this.el_display.style.overflowY; this.el_display.style.overflowY = "hidden";
        this.splash = document.createElement("div"); this.splash.className = "decafmud splash";
        this.splash.innerHTML = '<h2 class="decafmud heading"><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> <span class="version">v' + this.decaf.version.toString() + '</span></h2>';
        const pg_el = document.createElement("div"); pg_el.className = "decafmud progress";
        pg_el.setAttribute("role","progressbar"); pg_el.setAttribute("aria-valuemax", "100");
        pg_el.setAttribute("aria-valuemin", "0"); pg_el.setAttribute("aria-valuenow", String(p));
        pg_el.setAttribute("aria-valuetext", p + "%");
        this.splash_pgi = document.createElement("div"); this.splash_pgi.className = "decafmud inner-progress"; this.splash_pgi.style.width = p + "%"; pg_el.appendChild(this.splash_pgi);
        this.splash_pgt = document.createElement("div"); this.splash_pgt.className = "decafmud progress-text"; this.splash_pgt.innerHTML = p + "%"; pg_el.appendChild(this.splash_pgt);
        this.splash.appendChild(pg_el);
        this.splash_st = document.createElement("div"); this.splash_st.className = "decafmud status"; this.splash_st.innerHTML = msg; this.splash.appendChild(this.splash_st);
        this.splash_old = document.createElement("div"); this.splash_old.className = "decafmud old"; this.splash_old.innerHTML = ""; this.splash.appendChild(this.splash_old);
        this.container.appendChild(this.splash);
    }
    public endSplash(): void {
        if (this.splash && this.splash.parentNode === this.container) { this.container.removeChild(this.splash); }
        if (this.old_y !== undefined) { this.el_display.style.overflowY = this.old_y; }
        this.splash_err = false; this.splash = null;this.splash_pgi = null;this.splash_pgt = null;this.splash_st = null;this.splash_old = null;
    }
    public updateSplash(percentage?: number, message?: string): void {
        if (this.splash === null || this.splash_err) { return; }
        const pg_el = this.splash.querySelector('.decafmud.progress') as HTMLElement | null;
        if (percentage !== undefined && pg_el && this.splash_pgt && this.splash_pgi) {
            const percText = percentage + "%"; pg_el.setAttribute("aria-valuenow", String(percentage));
            pg_el.setAttribute("aria-valuetext", percText); this.splash_pgt.innerHTML = percText; this.splash_pgi.style.width = percentage + "%";
        }
        if (message && this.splash_st && this.splash_old) {
            const e = document.createElement("div"); let currentMessage = this.splash_st.innerHTML;
            if (currentMessage.endsWith("...")) { currentMessage += "done."; } e.innerHTML = currentMessage;
            this.splash_old.insertBefore(e, this.splash_old.firstChild); this.splash_st.innerHTML = message;
        }
    }
    public splashError(message: string): boolean {
        if (this.splash === null || !this.splash_pgt || !this.splash_pgi || !this.splash_st) { return false; }
        this.splash_pgt.innerHTML = "<b>Error</b>"; this.splash_pgi.className += " error";
        this.splash_st.innerHTML = message; this.splash_err = true; return true;
    }
    public showSize(): void {
        if (this.sizetm !== undefined) { clearTimeout(this.sizetm); this.sizetm = undefined; }
        if (!this.display) { return; } if (!this.sizeel) {
            this.sizeel = document.createElement("div"); this.sizeel.className = "decafmud note center";
            this.container.appendChild(this.sizeel);
        }
        const sz = this.display.getSize(); this.sizeel.style.opacity = "1";
        this.sizeel.innerHTML = sz[0] + "x" + sz[1];
        this.sizetm = window.setTimeout(() => { if(this.hideSize) this.hideSize(); }, 500);
    }
    public hideSize(fnl?: boolean): void {
        if (this.sizetm !== undefined) { clearTimeout(this.sizetm); this.sizetm = undefined; }
        if (fnl === true) {
            const tn = (this.decaf.constructor as any).TN; const nawsHandler = tn ? this.decaf.telopt[tn.NAWS] : undefined;
            if (nawsHandler && typeof (nawsHandler as any).send === 'function') { try { ((nawsHandler as any).send)(); } catch(err) {/*ignore*/} }
            if (this.sizeel && this.sizeel.parentNode === this.container) { this.container.removeChild(this.sizeel); this.sizeel = undefined; } return;
        }
        if (this.sizeel) {
            this.sizeel.style.transition = "opacity 0.25s linear";
            window.setTimeout(() => { if(this.sizeel) this.sizeel.style.opacity='0';},0);
            this.sizetm = window.setTimeout(() => { if(this.hideSize) this.hideSize(true); }, 250);
        }
    }
    public connected(): void { if(this.ico_connected !== -1 && this.updateIcon) { this.updateIcon(this.ico_connected, "DecafMUD is currently connected.", "", "connectivity connected"); }}
    public connecting(): void { if(this.ico_connected !== -1 && this.updateIcon) { this.updateIcon(this.ico_connected, "DecafMUD is attempting to connect.", "", "connectivity connecting"); }}
    public disconnected(reconnecting?: boolean): void { if(this.ico_connected !== -1 && this.updateIcon) { this.updateIcon(this.ico_connected, "DecafMUD is currently disconnected.", "", "connectivity disconnected" + (reconnecting ? " reconnecting" : "")); }}
    public load(): void { if(this.decaf) { this.decaf.require("decafmud.display." + this.decaf.options.display); }}
    public setup(): void {
        this.store = this.decaf.store?.sub('ui'); const tbarPosFromStore = this.store?.get('toolbar-position','top-left');
        const tbarPos = typeof tbarPosFromStore === 'string' ? tbarPosFromStore : 'top-left';
        this.old_tbarpos = tbarPos; this.toolbar.className = 'decafmud toolbar ' + tbarPos;
        if (this.container.firstChild) { this.container.insertBefore(this.toolbar, this.container.firstChild); } else { this.container.appendChild(this.toolbar); }
        const displayType = this.decaf.options.display!;
        this.decaf.debugString('Initializing display plugin "' + displayType + '" in: #' + this.el_display.id, 'info');
        const DisplayPlugin = (this.decaf.constructor as any).plugins.Display[displayType];
        if (DisplayPlugin) { this.display = new DisplayPlugin(this.decaf, this, this.el_display); this.decaf.display = this.display; }
        this.goFullOnResize = this.store?.get('fullscreen-auto', true) as boolean;
        const fsOpt = this.store?.get('fullscreen-start', this.decaf.options.set_interface?.start_full);
        const fs = typeof fsOpt === 'boolean' ? fsOpt : false;
        this.fsbutton = this.tbNew("Fullscreen", undefined, "Click to enter fullscreen mode.", 1, true, !!fs, undefined, (e: Event) => { if(this.click_fsbutton) this.click_fsbutton(e); });
        this.logbutton = this.tbNew("Logs", undefined, "Click to open a window containing this session\'s logs.", 0, true, false, undefined, (e: Event) => { if(this.showLogs) this.showLogs(); });
        this.ico_connected = this.addIcon("You are currently disconnected.", '', "connectivity disconnected");
        if (fs) { if(this.enter_fs) this.enter_fs(false); }
        else { const resizeToolbarExists = typeof (this as any)._resizeToolbar === 'function';
             if (resizeToolbarExists && !(this as any)._resizeToolbar()) { this.resizeScreen(false); } else if (!resizeToolbarExists) { this.resizeScreen(false); }
        }
    }
    public showLogs(): void { console.warn("showLogs not implemented"); }
    public showSettings(): void { console.warn("showSettings not implemented"); }
    public tbDelete(id: number): void { if (this.toolbuttons[id] === undefined) { return; } const btnTuple = this.toolbuttons[id]; if (btnTuple[0].parentNode) { btnTuple[0].parentNode.removeChild(btnTuple[0]); } delete this.toolbuttons[id]; if (typeof (this as any)._resizeToolbar === 'function') { (this as any)._resizeToolbar(); }}
    public tbText(id: number, text: string): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } if (!text) { throw new Error("Text can't be empty/false/null/whatever."); } btnTuple[0].innerHTML = text; if (btnTuple[3] === undefined) { btnTuple[3] = text; (btnTuple[0] as HTMLElement).title = text; }}
    public tbTooltip(id: number, tooltip: string): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } btnTuple[3] = tooltip; if (tooltip) { (btnTuple[0] as HTMLElement).title = tooltip; } else { (btnTuple[0] as HTMLElement).title = btnTuple[1]; } }
    public tbEnabled(id: number, enabled: boolean): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } const isEnabled = !!enabled; btnTuple[5] = isEnabled; btnTuple[0].setAttribute('aria-disabled', String(!isEnabled)); if (isEnabled) { btnTuple[0].className = btnTuple[0].className.replace(" disabled","").trim(); } else if (!/disabled/.test(btnTuple[0].className)) { btnTuple[0].className += " disabled"; }}
    public tbPressed(id: number, pressed: boolean): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } const isPressed = !!pressed; btnTuple[6] = isPressed; btnTuple[0].setAttribute('aria-pressed', String(isPressed)); if (isPressed) { if (/toggle-depressed/.test(btnTuple[0].className)) { btnTuple[0].className = btnTuple[0].className.replace(" toggle-depressed"," toggle-pressed"); }} else { if (/toggle-pressed/.test(btnTuple[0].className)) { btnTuple[0].className = btnTuple[0].className.replace(" toggle-pressed"," toggle-depressed"); }}}
    public tbClass(id: number, clss: string): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } const old_clss = btnTuple[7]; btnTuple[7] = clss; if (old_clss) { btnTuple[0].className = btnTuple[0].className.replace(" " + old_clss, "").trim(); } if (clss) { btnTuple[0].className += " " + clss; }}
    public tbIcon(id: number, icon: string): void { const btnTuple = this.toolbuttons[id]; if (btnTuple === undefined) { throw new Error("Invalid button ID."); } btnTuple[2] = icon; if (icon) { if (!/ icon/.test(btnTuple[0].className)) { btnTuple[0].className += " icon"; } (btnTuple[0] as HTMLElement).style.backgroundImage = "url(" + icon + ")"; } else { btnTuple[0].className = btnTuple[0].className.replace(" icon","").trim(); (btnTuple[0] as HTMLElement).style.backgroundImage = ""; }}
    public tbNew(text?: string, icon?: string, tooltip?: string, type?: number, enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void): number {
        const actualType = type === undefined ? 0 : type; const actualEnabled = enabled === undefined ? true : enabled;
        const actualPressed = pressed === undefined ? false : pressed; const ind = ++this.toolbutton_id;
        const btn = document.createElement("a"); btn.id = this.container.id + "-toolbar-button-" + ind;
        btn.className = "decafmud button toolbar-button"; if (clss) { btn.className += " " + clss; }
        if (actualType === 1) { btn.className += " toggle " + (actualPressed ? "toggle-pressed" : "toggle-depressed"); }
        btn.innerHTML = text || ""; if (tooltip) { btn.title = tooltip; } else if (text) { btn.title = text; }
        if (!actualEnabled) { btn.className += " disabled"; } btn.setAttribute("tabIndex","0");
        btn.setAttribute("role","button"); btn.setAttribute("aria-disabled", String(!actualEnabled));
        if (actualType === 1) { btn.setAttribute("aria-pressed", String(actualPressed)); }
        if (icon) { btn.style.backgroundImage = "url(" + icon + ")"; btn.className += " icon"; }
        if (onclick) { const helper = (e: Event) => { if ((e as KeyboardEvent).type === "keydown" && (e as KeyboardEvent).keyCode !== 13) { return; } const btnArr = this.toolbuttons[ind]; if (btnArr && btnArr[5] !== true) { return; } onclick.call(this, e); if (e.type && e.type !== "keydown" && btnArr) { (btnArr[0] as HTMLElement).blur(); }}; btn.addEventListener("click", helper); btn.addEventListener("keydown", helper); }
        btn.addEventListener("focus", (e: Event) => { const target = e.currentTarget as HTMLElement; if (!target.parentNode) { return; } const parentNode = target.parentNode as HTMLElement; if (/toolbar/.test(parentNode.className)) { parentNode.setAttribute("aria-activedescendant", target.id); parentNode.className += " visible"; }});
        btn.addEventListener("blur", (e: Event) => { const target = e.currentTarget as HTMLElement; if (!target.parentNode) { return; } const parentNode = target.parentNode as HTMLElement; if (/toolbar/.test(parentNode.className)) { if (parentNode.getAttribute("aria-activedescendant") === target.id) { parentNode.setAttribute("aria-activedescendant", ""); } parentNode.className = parentNode.className.replace(" visible",""); }});
        this.toolbuttons[ind] = [btn, text || "", icon, tooltip, actualType, actualEnabled, actualPressed, clss, onclick];
        btn.setAttribute("button-id", String(ind)); this.toolbar.appendChild(btn);
        if (typeof (this as any)._resizeToolbar === 'function') { (this as any)._resizeToolbar(); } return ind;
    }
    public addIcon(text?: string, html?: string, clss?: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number {
        const ico = document.createElement("div"); ico.className = "decafmud status-icon " + (clss || "") + ( onclick ? " icon-click" : "" );
        ico.innerHTML = html || ""; ico.title = text || ""; ico.setAttribute("role","status"); ico.setAttribute("aria-label", text || "");
        if (onclick || onkey) { ico.setAttribute("tabIndex","0"); } const ind = this.icons.push([ico, onclick, onkey]) - 1;
        for(let i=0; i < this.icons.length; i++) { this.icons[i][0].style.right = (((this.icons.length-i)-1)*21) + 'px'; }
        this.tray.appendChild(ico);
        if (onclick) { ico.addEventListener("click", (e: Event) => onclick.call(this, e)); }
        if (onclick && !onkey) { ico.addEventListener("keydown", (e: Event) => { if ((e as KeyboardEvent).keyCode !== 13) { return; } onclick.call(this, e); }); }
        if (onkey) { ico.addEventListener("keydown", (e: Event) => onkey.call(this, e as KeyboardEvent)); } this._resizeTray(); return ind;
    }
    public delIcon(ind: number): void { if (ind < 0 || ind >= this.icons.length) { throw new Error("Invalid index for icon!"); } const iconArr = this.icons[ind]; if (!iconArr) return; const el = iconArr[0]; this.icons.splice(ind,1); if (el.parentNode) { el.parentNode.removeChild(el); } for(let i=0; i < this.icons.length; i++) { this.icons[i][0].style.right = (((this.icons.length-i)-1)*21) + 'px'; } this._resizeTray(); }
    public updateIcon(ind: number, text?: string, html?: string, clss?: string): void { if (ind < 0 || ind >= this.icons.length || !this.icons[ind]) { console.warn("updateIcon: Invalid index or icon not found", ind); return; } const iconArr = this.icons[ind]; const el = iconArr[0]; const onclickHandler = iconArr[1]; if (clss) { el.className = 'decafmud status-icon ' + clss + (onclickHandler ? ' icon-click' : ''); } if (html !== undefined) { el.innerHTML = html; } if (text) { el.title = text; el.setAttribute("aria-label", text); }}

    // --- Stubs for InfoBar and other remaining IUi methods ---
    /** Create a new notification bar at the top of the interface for the user to take action on.
     * Actions may be specified to be taken when the bar is clicked or closed, and buttons may be added as well.
     * If the second parameter is a number instead of a string, it will be treated as though timeout and clss have swapped places.
     * @param text The text to display on the bar.
     * @param clss Optionally, a class to add to the bar for more precise styling. Defaults to "info".
     * @param timeout The number of seconds after which the bar should automatically be closed. Defaults to 0 (no auto-close).
     * @param icon The URL of an image to display on the bar.
     * @param buttons A list of buttons to be displayed as [text, callback] tuples.
     * @param click A function to be called when the bar is clicked.
     * @param close A function to be called when the bar is closed. */
    public infoBar(text: string, clssOrTimeout?: string | number, timeoutOrClss?: number | string, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): void {
        let actualClss: string = "info";
        let actualTimeout: number = 0;

        if (typeof clssOrTimeout === 'number') {
            actualTimeout = clssOrTimeout;
            if (typeof timeoutOrClss === 'string') { actualClss = timeoutOrClss; }
        } else {
            if (typeof clssOrTimeout === 'string') { actualClss = clssOrTimeout; }
            if (typeof timeoutOrClss === 'number') { actualTimeout = timeoutOrClss; }
        }

        const ibarData = {
            text: text,
            class: actualClss,
            timeout: actualTimeout,
            icon: icon,
            buttons: buttons,
            click: click,
            close: close,
            el: undefined as HTMLElement | undefined
        };
        this.infobars.push(ibarData);

        if (this.ibar !== undefined) { return; } // this.ibar is the current bar HTMLElement
        if (this.createIBar) { this.createIBar(); }
    }
    /** Same as the regular infoBar function, but only adds an infoBar if it will be displayed immediately. */
    public immediateInfoBar(text: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): boolean {
        if (this.ibar !== undefined) { return false; }
        this.infoBar(text, clss, timeout, icon, buttons, click, close);
        return true;
    }
    public createIBar?(): void { console.warn("createIBar not implemented"); } // Made optional to match IUi
    public closeIBar?(steptwo?: boolean): void { console.warn("closeIBar not implemented"); } // Made optional

    public enter_fs(showSize?: boolean): void { console.warn("enter_fs not implemented"); }
    public exit_fs?(): void { console.warn("exit_fs not implemented"); } // Optional in IUi
    public resizeScreen(showSize?: boolean, force?: boolean): void { console.warn("resizeScreen not implemented"); }
    public displayInput(text?: string): void { console.warn("displayInput not implemented"); }
    public localEcho(echo?: boolean): void { console.warn("localEcho not implemented"); }
    public updateInput(force?: boolean): void { console.warn("updateInput not implemented"); }
    public handleBlur(e?: FocusEvent): void { console.warn("handleBlur not implemented"); }
    public handleInput(e?: KeyboardEvent): void { console.warn("handleInput not implemented"); }
    public displayKey(e?: KeyboardEvent): void { console.warn("displayKey not implemented"); }

    public click_fsbutton?(e?: Event): void { console.warn("click_fsbutton not implemented"); } // Stub from previous subtask

    private _addButtonToIBar(bar: HTMLElement, btnData: [string, (e: Event) => void]): void { // Added in this subtask (Turn 22)
        const b = document.createElement("a"); b.className = "button"; b.href = "#"; b.onclick = () => false;
        b.innerHTML = btnData[0];
        b.addEventListener("click", (e: Event) => { if (this.closeIBar) {this.closeIBar(true); } setTimeout(() => { btnData[1].call(this, e); }, 0); if(e.stopPropagation) { e.stopPropagation(); } else { (e as any).cancelBubble = true; } return false; });
        bar.appendChild(b);
    }
    private _resizeTray(): void { const w = this.tray.clientWidth; this._input.style.paddingRight = w + 'px'; }

    public toString(): string { return "<DecafMUD Interface: Simple" + (this.container.id ? " (#" + this.container.id + ")" : "") + ">"; }
}

(DecafMUD_Global as any).plugins.Interface.simple = SimpleInterface;

})(window.DecafMUD);
