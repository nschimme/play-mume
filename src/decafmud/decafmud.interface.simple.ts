// SPDX-License-Identifier: MIT
import { IDecafMUD, IUi, IDisplay, IStorage, DecafMUDConstructor, SetInterfaceOptions } from './decafmud.types';

((DecafMUD_Global: DecafMUDConstructor | any) => {

class SimpleInterface implements IUi {
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
    private ibar?: HTMLElement;
    private ibartimer?: number;

    public static supports = {
        "tabComplete": true,
        "multipleOut": false,
        "fullscreen": true,
        "editor": false,
        "splash": true
    };

    /**
     * @name SimpleInterface
     * @class DecafMUD User Interface: Simple
     * @param decaf - The instance of DecafMUD using this plugin.
     */
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

        this.toolbuttons = {};
        this.infobars = [];
        this.icons = [];

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

    /** Resets the interface to its default state. */
    public reset(): void {
        this.masked = false;
        this.inputCtrl = false;
        this.mruIndex = 0;
        this.mruHistory = [];
        this.mruTemp = false;
        this.hasFocus = false;
        this.reqTab = false;
        this.wantTab = false;
        this.tabIndex = -1;
        this.tabValues = [];
        this.buffer = "";
        if (this.input) { this.updateInput(); }
        if (this.display) { this.display.reset(); }
    }

    /** Initialize the splash screen and display an initial message.
     * @param percentage The initial percent to display the progress bar at.
     * @param message The initial message for the splash screen to display. */
    public initSplash(percentage?: number, message?: string): void {
        const p = percentage === undefined ? 0 : percentage;
        const msg = message === undefined ? "Discombobulating interface recipient..." : message;
        this.old_y = this.el_display.style.overflowY;
        this.el_display.style.overflowY = "hidden";
        this.splash = document.createElement("div");
        this.splash.className = "decafmud splash";
        this.splash.innerHTML = '<h2 class="decafmud heading"><a href="https://github.com/MUME/DecafMUD">DecafMUD</a> <span class="version">v' + this.decaf.version.toString() + '</span></h2>';
        const splash_pg_el = document.createElement("div");
        splash_pg_el.className = "decafmud progress";
        splash_pg_el.setAttribute("role","progressbar");
        splash_pg_el.setAttribute("aria-valuemax", "100");
        splash_pg_el.setAttribute("aria-valuemin", "0");
        splash_pg_el.setAttribute("aria-valuenow", String(p));
        splash_pg_el.setAttribute("aria-valuetext", p + "%");
        this.splash_pgi = document.createElement("div");
        this.splash_pgi.className = "decafmud inner-progress";
        this.splash_pgi.style.width = p + "%";
        splash_pg_el.appendChild(this.splash_pgi);
        this.splash_pgt = document.createElement("div");
        this.splash_pgt.className = "decafmud progress-text";
        this.splash_pgt.innerHTML = p + "%";
        splash_pg_el.appendChild(this.splash_pgt);
        this.splash.appendChild(splash_pg_el);
        this.splash_st = document.createElement("div");
        this.splash_st.className = "decafmud status";
        this.splash_st.innerHTML = msg;
        this.splash.appendChild(this.splash_st);
        this.splash_old = document.createElement("div");
        this.splash_old.className = "decafmud old";
        this.splash_old.innerHTML = "";
        this.splash.appendChild(this.splash_old);
        this.container.appendChild(this.splash);
    }

    /** Destroy the splash screen. */
    public endSplash(): void {
        if (this.splash && this.splash.parentNode === this.container) {
            this.container.removeChild(this.splash);
        }
        if (this.old_y !== undefined) {
            this.el_display.style.overflowY = this.old_y;
        }
        this.splash_err = false;
        this.splash = null;
        this.splash_pgi = null;
        this.splash_pgt = null;
        this.splash_st = null;
        this.splash_old = null;
    }

    /** Update the splash screen with the provided percentage and text.
     * @param percentage If provided, the percentage will be changed to this value.
     * @param message If provided, this message will be displayed. */
    public updateSplash(percentage?: number, message?: string): void {
        if (this.splash === null || this.splash_err) { return; }
        const splash_pg_el = this.splash.querySelector('.decafmud.progress') as HTMLElement | null;
        if (percentage !== undefined && splash_pg_el && this.splash_pgt && this.splash_pgi) {
            const percText = percentage + "%";
            splash_pg_el.setAttribute("aria-valuenow", String(percentage));
            splash_pg_el.setAttribute("aria-valuetext", percText);
            this.splash_pgt.innerHTML = percText;
            this.splash_pgi.style.width = percentage + "%";
        }
        if (message && this.splash_st && this.splash_old) {
            const e = document.createElement("div");
            let currentMessage = this.splash_st.innerHTML;
            if (currentMessage.endsWith("...")) { currentMessage += "done."; }
            e.innerHTML = currentMessage;
            this.splash_old.insertBefore(e, this.splash_old.firstChild);
            this.splash_st.innerHTML = message;
        }
    }

    /** Show an error with the splash message so it doesn\'t need to be presented as an alert dialog.
     * @param message The error to display. This can have HTML.
     * @returns True if the error was displayed, else false. */
    public splashError(message: string): boolean {
        if (this.splash === null || !this.splash_pgt || !this.splash_pgi || !this.splash_st) { return false; }
        this.splash_pgt.innerHTML = "<b>Error</b>";
        this.splash_pgi.className += " error";
        this.splash_st.innerHTML = message;
        this.splash_err = true;
        return true;
    }

    // --- Other IUi Method Stubs (Ultra-Minimal: No default parameter values in signatures) ---
    public showSize(): void { console.warn("showSize not implemented"); }
    public hideSize(fnl?: boolean): void { console.warn("hideSize not implemented"); }
    public connected(): void { if(this.ico_connected !== -1 && this.updateIcon) this.updateIcon(this.ico_connected, "DecafMUD is currently connected.", "", "connectivity connected"); }
    public connecting(): void { if(this.ico_connected !== -1 && this.updateIcon) this.updateIcon(this.ico_connected, "DecafMUD is attempting to connect.", "", "connectivity connecting"); }
    public disconnected(reconnecting?: boolean): void { if(this.ico_connected !== -1 && this.updateIcon) this.updateIcon(this.ico_connected, "DecafMUD is currently disconnected.", "", "connectivity disconnected" + (reconnecting ? " reconnecting" : "")); }
    public load(): void { if(this.decaf) this.decaf.require("decafmud.display." + this.decaf.options.display); }
    public setup(): void { console.warn("setup not implemented"); }
    public showLogs(): void { console.warn("showLogs not implemented"); }
    public showSettings(): void { console.warn("showSettings not implemented"); }
    public tbDelete(id?: number): void { console.warn("tbDelete not implemented"); }
    public tbText(id?: number, text?: string): void { console.warn("tbText not implemented"); }
    public tbTooltip(id?: number, tooltip?: string): void { console.warn("tbTooltip not implemented"); }
    public tbEnabled(id?: number, enabled?: boolean): void { console.warn("tbEnabled not implemented"); }
    public tbPressed(id?: number, pressed?: boolean): void { console.warn("tbPressed not implemented"); }
    public tbClass(id?: number, clss?: string): void { console.warn("tbClass not implemented"); }
    public tbIcon(id?: number, icon?: string): void { console.warn("tbIcon not implemented"); }
    public tbNew(text?: string, icon?: string, tooltip?: string, type?: number, enabled?: boolean, pressed?: boolean, clss?: string, onclick?: (e: Event) => void): number { console.warn("tbNew not implemented"); return 0; }
    public infoBar(text?: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): void { console.warn("infoBar not implemented"); }
    public immediateInfoBar(text?: string, clss?: string, timeout?: number, icon?: string, buttons?: [string, (e: Event) => void][], click?: (e: Event) => void, close?: (e: Event) => void): boolean { console.warn("immediateInfoBar not implemented"); return false; }
    public createIBar?(): void { console.warn("createIBar not implemented"); }
    public closeIBar?(steptwo?: boolean): void { console.warn("closeIBar not implemented"); }
    public addIcon(text?: string, html?: string, clss?: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number { console.warn("addIcon not implemented"); return 0; }
    public delIcon(ind?: number): void { console.warn("delIcon not implemented"); }
    public updateIcon(ind?: number, text?: string, html?: string, clss?: string): void { console.warn("updateIcon not implemented"); }
    public enter_fs(showSize?: boolean): void { console.warn("enter_fs not implemented"); }
    public exit_fs?(): void { console.warn("exit_fs not implemented"); }
    public resizeScreen(showSize?: boolean, force?: boolean): void { console.warn("resizeScreen not implemented"); }
    public displayInput(text?: string): void { console.warn("displayInput not implemented"); }
    public localEcho(echo?: boolean): void { console.warn("localEcho not implemented"); }
    public updateInput(force?: boolean): void { console.warn("updateInput not implemented"); }
    public handleBlur(e?: FocusEvent): void { console.warn("handleBlur not implemented"); }
    public handleInput(e?: KeyboardEvent): void { console.warn("handleInput not implemented"); }
    public displayKey(e?: KeyboardEvent): void { console.warn("displayKey not implemented"); }

    public toString(): string { return "<DecafMUD Interface: Simple" + (this.container.id ? " (#" + this.container.id + ")" : "") + ">"; }
}

(DecafMUD_Global as any).plugins.Interface.simple = SimpleInterface;

})(window.DecafMUD);
