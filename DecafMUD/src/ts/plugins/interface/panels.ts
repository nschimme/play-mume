import type { DecafMUD } from '../../decafmud';
import { DragObject, Position, hookEvent, unhookEvent, cancelEvent, absoluteCursorPosition } from '../../util/dragObject';
import { toolbarMenus, MenuDefinition, MenuItemAction, ClientSettings, defaultClientSettings } from './menuData'; // Assuming menuData will be used

// Helper to translate, placeholder for now
function tr(this: DecafMUD | PanelsInterface, text: string, ...args: any[]): string {
    // In a real scenario, this would use the DecafMUD instance's language capabilities
    // For now, just basic replacement or return text
    let s = text;
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        const obj = args[0];
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                s = s.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
            }
        }
    } else {
        for (let i = 0; i < args.length; i++) {
            s = s.replace(new RegExp(`{${i}}`, 'g'), args[i]);
        }
    }
    return s;
}


export class PanelsInterface {
    public decaf: DecafMUD;
    public container: HTMLElement;
    public el_display: HTMLElement;
    public sidebar: HTMLElement;
    public progresstable: HTMLTableElement;
    public progressbars: Array<[string, HTMLDivElement, HTMLDivElement]> = [];
    public mapdiv: HTMLElement;
    public _input: HTMLElement;
    public tray: HTMLElement;
    public toolbuttons: { [key: number]: [HTMLElement, string, string | undefined, string | undefined, number, boolean, boolean, string | undefined, Function | undefined] } = {};
    public infobars: {
        id: string;
        element: HTMLElement;
        timer?: number; // NodeJS.Timeout not available in browser, using number for setTimeout/clearTimeout
        closecb?: () => void;
        buttons?: Array<[string, (e: MouseEvent) => void]>; // Button text and callback
    }[] = [];
    public icons: Array<[HTMLElement, Function | undefined, Function | undefined]> = [];
    public toolbar: HTMLElement;
    public input: HTMLInputElement | HTMLTextAreaElement; // Can be input or textarea

    public history: string[] = [];
    public historyPosition: number = -1;

    // States
    public echo: boolean = true;
    public inpFocus: boolean = false;
    public masked: boolean = false;
    public inputCtrl: boolean = false; // If true, input is handled by a special handler (e.g. password)
    public hasFocus: boolean = false; // TODO: Consolidate with inpFocus?

    // Tab Completion Data
    public reqTab: boolean = false;
    public wantTab: boolean = false;
    public tabIndex: number = -1;
    public tabValues: string[] = [];
    public buffer: string = ''; // Stores input value during tab completion or multi-line edit

    // Fullscreen state
    public old_parent: HTMLElement | null = null;
    public next_sib: Element | null = null;
    public old_body_over: string = '';
    public oldscrollX: number = 0;
    public oldscrollY: number = 0;
    public old_children: HTMLElement[] = [];
    public old_display: string[] = [];
    public goFullOnResize: boolean = false;
    public old_fs: boolean = false;


    // Splash screen elements
    public splash: HTMLElement | null = null;
    public splash_st: HTMLElement | null = null; // Status text
    public splash_pg: HTMLElement | null = null; // Progress bar container
    public splash_pgi: HTMLElement | null = null; // Progress bar inner
    public splash_pgt: HTMLElement | null = null; // Progress bar text
    public splash_old: HTMLElement | null = null; // Old status messages
    public splash_err: boolean = false;
    private old_y: string = ''; // To store original overflowY of display

    public toolbutton_id: number = -1;
    public toolbarPadding: number | undefined;

    public scrollButton: HTMLElement | undefined;

    public settings: ClientSettings; // From menuData.ts or a dedicated settings module
    public store: any; // DecafMUD storage sub-object
    private fontBaseSize: number = 13; // Base font size in pixels, assuming 100% is this.

    // Popups
    public popup: HTMLElement | undefined;
    public popupheader: HTMLElement | undefined;
    public headerdrag: DragObject | undefined;
    private open_menu: number = -1; // For managing which main menu is open


    static supports = {
        'tabComplete': true,
        'multipleOut': false, // This interface seems to manage its own output rather than multiple Decaf displays
        'fullscreen': true,
        'editor': false, // No specific editor functionality noted beyond textarea for popups
        'splash': true
    };

    constructor(decaf: DecafMUD) {
        this.decaf = decaf;
        // Settings are loaded/initialized in this.loadSettings() which is called by setup()
        this.settings = { ...defaultClientSettings }; // Initialize with defaults, will be overridden by stored settings

        const containerOpt = decaf.options.set_interface.container;
        if (typeof containerOpt === 'string') {
            this.container = document.querySelector(containerOpt) as HTMLElement;
        } else {
            this.container = containerOpt;
        }

        if (!this.container || typeof this.container.nodeType !== 'number') {
            throw new Error("The container must be a valid DOM node!");
        }

        this.store = this.decaf.store.sub('ui-panels'); // Create a sub-store for this interface


        // Build element tree
        this.container.setAttribute('role', 'application');
        this.container.className += ' decafmud mud interface panels-interface'; // Added panels-interface

        // Display container
        this.el_display = document.createElement('div');
        this.el_display.className = 'decafmud mud-pane primary-pane';
        this.el_display.setAttribute('role', 'log');
        this.el_display.setAttribute('tabIndex', '0');
        this.container.appendChild(this.el_display);

        // Sidebar
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'decafmud mud-pane side-pane';
        this.sidebar.setAttribute('tabIndex', '1');
        this.container.appendChild(this.sidebar);

        this.progresstable = document.createElement('table');
        this.progresstable.style.display = 'none'; // Initially hidden
        this.sidebar.appendChild(this.progresstable);

        this.mapdiv = document.createElement('div');
        this.mapdiv.style.display = 'none'; // Initially hidden
        this.sidebar.appendChild(this.mapdiv);

        // Input container
        this._input = document.createElement('div');
        this._input.className = 'decafmud input-cont';

        this.tray = document.createElement('div');
        this.tray.className = 'decafmud icon-tray';
        this._input.appendChild(this.tray);

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'decafmud toolbar';
        this.toolbar.setAttribute('role','toolbar');
        // Prevent toolbar disappearing on mouse move over it if it's meant to be visible
        hookEvent(this.toolbar, 'mousemove', (e) => {
            // if(!this.toolbar.classList.contains('always-on')) { // Or some other condition for visibility
            //    this.toolbar.classList.remove('visible');
            // }
        });
        hookEvent(this.toolbar, 'blur', (e) => {
            // if(!this.toolbar.classList.contains('always-on')) {
            //    this.toolbar.classList.remove('visible');
            // }
        });


        this.input = document.createElement('input');
        this.input.id = "inputelement"; // From original
        this.input.title = tr.call(this, "MUD Input");
        this.input.type = 'text';
        this.input.className = 'decafmud input';
        this._input.insertBefore(this.input, this._input.firstChild);
        this.container.appendChild(this._input);

        // Event listeners
        hookEvent(this.el_display, 'mouseup', this.maybeFocusInput.bind(this));
        hookEvent(this.el_display, 'keydown', (e) => this.displayKey(e as KeyboardEvent));
        hookEvent(this.sidebar, 'keydown', (e) => this.displayKey(e as KeyboardEvent));
        hookEvent(this.input, 'keydown', (e) => this.handleInput(e as KeyboardEvent));
        hookEvent(this.input, 'blur', (e) => this.handleBlur(e as FocusEvent));
        hookEvent(this.input, 'focus', (e) => this.handleBlur(e as FocusEvent));
        hookEvent(window, 'resize', this.resizeScreenFromEvent.bind(this, 'window resize'));

        if ("onhelp" in window) { // Neuters IE's F1 help popup
            (window as any).onhelp = () => false;
        }
        window.onbeforeunload = this.unloadPageFromEvent.bind(this);

        this.reset(); // Initialize states
        this.input.focus();
    }

    // Methods will be ported here
    // ... initSplash, endSplash, updateSplash, splashError ...
    // ... showSize, hideSize ...
    // ... print_msg, connected, connecting, disconnected, unloadPageFromEvent ...
    // ... load, reset (partially done), setup ...
    // ... tbNew, tbDelete, tbText, etc. ... _resizeToolbar ...
    // ... showScrollButton, hideScrollButton ...
    // ... infoBar, immediateInfoBar, createIBar, closeIBar ...
    // ... addIcon, delIcon, updateIcon, _resizeTray ...
    // ... click_fsbutton, enter_fs, exit_fs, resizeScreen, resizeScreenFromEvent ...
    // ... sidebar methods, progress bar methods, map methods ...
    // ... popup methods ...
    // ... menu action handlers (menu_reconnect, menu_log, etc.) ...
    // ... displayInput, localEcho, maybeFocusInput, displayKey, handleInputPassword, handleInput, handleBlur, updateInput ...

    // #region Settings Management
    private loadSettings(): void {
        if (!this.store) {
            this.decaf.error("PanelsInterface: Store not available for loading settings.");
            this.settings = { ...defaultClientSettings }; // Use defaults if store is missing
            return;
        }

        this.settings = {
            fontPercentage: this.store.get('fontPercentage', defaultClientSettings.fontPercentage),
            fkeyMacrosEnabled: this.store.get('fkeyMacrosEnabled', defaultClientSettings.fkeyMacrosEnabled),
            numpadWalkingEnabled: this.store.get('numpadWalkingEnabled', defaultClientSettings.numpadWalkingEnabled),
            showProgressBars: this.store.get('showProgressBars', defaultClientSettings.showProgressBars),
            showMap: this.store.get('showMap', defaultClientSettings.showMap),
        };

        // Apply initial settings that affect UI
        this.apply_font_size();
        this.apply_progress_bars_visibility();
        this.apply_map_visibility();
        // Fkey and Numpad settings are typically checked during input handling, no direct UI apply needed here.
    }

    private saveSetting<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]): void {
        if (this.store) {
            this.store.set(key, value);
        } else {
            this.decaf.debugString(`PanelsInterface: Store not available for saving setting ${key}.`, "warn");
        }
        this.settings[key] = value;
    }

    public set_font_size(percentage: number): void {
        this.saveSetting('fontPercentage', Math.max(50, Math.min(300, percentage))); // Clamp between 50% and 300%
        this.apply_font_size();
        this.resizeScreen(false, true); // Font size change can affect layout
    }

    private apply_font_size(): void {
        // Assuming el_display is the primary element whose font size is controlled.
        // The original simple interface used 110% of the base for its default.
        // Let's use a base pixel size and scale that.
        // If base is 13px for 100%, then 110% was ~14.3px.
        // If this.settings.fontPercentage is 100, it means 100% of the base.
        const newSize = (this.fontBaseSize * (this.settings.fontPercentage / 100)) + 'px';
        this.el_display.style.fontSize = newSize;
        // May need to adjust line height or other properties if display plugin doesn't handle it.
        if (this.display && typeof (this.display as any).setFontSize === 'function') {
            (this.display as any).setFontSize(newSize);
        }
    }

    public toggle_fkey_macros(enable?: boolean): void {
        const newValue = enable !== undefined ? enable : !this.settings.fkeyMacrosEnabled;
        this.saveSetting('fkeyMacrosEnabled', newValue);
        this.decaf.debugString(`FKey macros ${newValue ? 'enabled' : 'disabled'}.`);
        // Functionality is checked in handleInput, no direct UI update here usually.
    }

    public toggle_numpad_walking(enable?: boolean): void {
        const newValue = enable !== undefined ? enable : !this.settings.numpadWalkingEnabled;
        this.saveSetting('numpadWalkingEnabled', newValue);
        this.decaf.debugString(`Numpad walking ${newValue ? 'enabled' : 'disabled'}.`);
        // Functionality is checked in handleInput.
    }

    public toggle_progress_bars(show?: boolean): void {
        const newValue = show !== undefined ? show : !this.settings.showProgressBars;
        this.saveSetting('showProgressBars', newValue);
        this.apply_progress_bars_visibility();
    }

    private apply_progress_bars_visibility(): void {
        this.progresstable.style.display = this.settings.showProgressBars ? '' : 'none';
        this.resizeScreen(false, true); // May affect sidebar layout
    }

    public toggle_map_display(show?: boolean): void {
        const newValue = show !== undefined ? show : !this.settings.showMap;
        this.saveSetting('showMap', newValue);
        this.apply_map_visibility();
    }

    private apply_map_visibility(): void {
        this.mapdiv.style.display = this.settings.showMap ? '' : 'none';
        this.resizeScreen(false, true); // May affect sidebar layout
    }
    // #endregion Settings Management

    // #region InfoBar Management
    /**
     * Creates and displays an information bar.
     * @param message The HTML message to display.
     * @param id A unique ID for this infobar. If an infobar with this ID exists, it's updated.
     * @param timeout Time in seconds before the bar auto-closes. 0 for indefinite.
     * @param icon Optional icon class to show.
     * @param buttons Optional array of [text, callback] for buttons.
     * @param barclass Optional additional class for the bar.
     * @param closecb Callback when the bar is closed (manually or by timeout).
     */
    public infoBar(
        message: string,
        id: string,
        timeout: number = 0,
        icon?: string,
        buttons?: Array<[string, (e: MouseEvent) => void]>,
        barclass?: string,
        closecb?: () => void
    ): void {
        let bar = this.infobars.find(b => b.id === id);
        if (bar) { // Update existing bar
            this.closeIBar(id, true); // Close without triggering callback, then recreate
        }
        this.createIBar(message, id, timeout, icon, buttons, barclass, closecb);
    }

    /**
     * Immediately creates and displays an information bar.
     * This is a convenience wrapper for infoBar with a common use case.
     */
    public immediateInfoBar(
        message: string,
        id: string,
        timeout: number = 0,
        icon?: string,
        buttons?: Array<[string, (e: MouseEvent) => void]>,
        barclass?: string,
        closecb?: () => void
    ): void {
        this.infoBar(message, id, timeout, icon, buttons, barclass, closecb);
    }


    private createIBar(
        message: string,
        id: string,
        timeout: number,
        icon?: string,
        buttons?: Array<[string, (e: MouseEvent) => void]>,
        clss?: string,
        closecb?: () => void
    ): void {
        const bar_el = document.createElement('div');
        bar_el.className = 'decafmud infobar';
        if (clss) { bar_el.className += ' ' + clss; }
        if (icon) { bar_el.className += ' icon ' + icon; }

        const msg_el = document.createElement('span');
        msg_el.className = 'message';
        msg_el.innerHTML = message;
        bar_el.appendChild(msg_el);

        if (buttons && buttons.length > 0) {
            const btn_cont = document.createElement('span');
            btn_cont.className = 'buttons';
            buttons.forEach(btn_def => {
                const btn = document.createElement('button');
                btn.innerText = btn_def[0];
                btn.onclick = (e: MouseEvent) => {
                    btn_def[1].call(this, e); // Call with `this` as PanelsInterface
                    // Optionally close the bar after button click, depending on desired behavior
                    // this.closeIBar(id);
                };
                btn_cont.appendChild(btn);
            });
            bar_el.appendChild(btn_cont);
        }

        const close_el = document.createElement('button');
        close_el.className = 'close';
        close_el.innerHTML = '&times;'; // X symbol
        close_el.onclick = () => this.closeIBar(id);
        bar_el.appendChild(close_el);

        // Insert new bar at the top (or bottom, depending on desired layout)
        this.container.insertBefore(bar_el, this.toolbar.nextSibling); // Example: below toolbar

        const barData: PanelsInterface['infobars'][0] = { // Explicitly type barData
            id: id,
            element: bar_el,
            closecb: closecb,
            buttons: buttons
        };

        if (timeout > 0) {
            barData.timer = window.setTimeout(() => this.closeIBar(id), timeout * 1000);
        }

        this.infobars.push(barData);
        this.resizeScreen(false, true); // Infobar might change layout
    }

    public closeIBar(id: string, silent: boolean = false): void {
        const barIndex = this.infobars.findIndex(b => b.id === id);
        if (barIndex === -1) { return; }

        const bar = this.infobars[barIndex];
        if (bar.timer) {
            clearTimeout(bar.timer);
        }

        if (bar.element.parentNode) {
            bar.element.parentNode.removeChild(bar.element);
        }

        if (!silent && bar.closecb) {
            bar.closecb.call(this.decaf); // Call close callback with decaf as context
        }

        this.infobars.splice(barIndex, 1);
        this.resizeScreen(false, true); // Infobar removal might change layout
    }
    // #endregion InfoBar Management

    // #region Fullscreen Management
    public isFullscreen(): boolean {
        return !!this.old_parent;
    }

    public click_fsbutton(event?: Event): void {
        if (event) cancelEvent(event);
        if (this.isFullscreen()) {
            this.exit_fs(true);
        } else {
            this.enter_fs(true);
        }
    }

    public enter_fs(from_click: boolean): void {
        if (this.isFullscreen() || !this.container.parentNode) { return; }

        this.decaf.debugString("Entering fullscreen mode.", "info");
        this.old_parent = this.container.parentNode as HTMLElement;
        this.next_sib = this.container.nextSibling;

        // Save current body overflow and scroll position
        this.old_body_over = document.body.style.overflow;
        this.oldscrollX = window.scrollX;
        this.oldscrollY = window.scrollY;

        // Hide all other direct children of the body
        this.old_children = [];
        this.old_display = [];
        for (let i = 0; i < document.body.children.length; i++) {
            const child = document.body.children[i] as HTMLElement;
            if (child !== this.container) {
                this.old_children.push(child);
                this.old_display.push(child.style.display);
                child.style.display = 'none';
            }
        }

        document.body.appendChild(this.container);
        document.body.style.overflow = 'hidden';
        document.body.scrollTop = 0; // For older browsers
        document.documentElement.scrollTop = 0;


        this.container.classList.add('fullscreen');
        this.old_fs = true; // Track that we initiated fullscreen

        // Update toolbar button if one exists for fullscreen
        // This assumes a button with ID 'fsbutton' or similar
        const fsButton = this.toolbuttons[Object.keys(this.toolbuttons).find(key => this.toolbuttons[parseInt(key)][0].id === 'fsbutton')!];
        if (fsButton && fsButton[4] === 1) { // type 1 is toggle
            fsButton[0].classList.remove('toggle-depressed');
            fsButton[0].classList.add('toggle-pressed');
            fsButton[6] = true; // pressed state
            fsButton[0].setAttribute('aria-pressed', 'true');
        }


        this.resizeScreen(false, true);
        if (from_click) { (this.input as HTMLElement).focus(); }
    }

    public exit_fs(from_click: boolean): void {
        if (!this.isFullscreen() || !this.old_parent) { return; }

        this.decaf.debugString("Exiting fullscreen mode.", "info");

        // Restore visibility of other body children
        for (let i = 0; i < this.old_children.length; i++) {
            this.old_children[i].style.display = this.old_display[i];
        }
        this.old_children = [];
        this.old_display = [];

        // Move container back to its original position
        if (this.next_sib) {
            this.old_parent.insertBefore(this.container, this.next_sib);
        } else {
            this.old_parent.appendChild(this.container);
        }

        document.body.style.overflow = this.old_body_over;
        window.scrollTo(this.oldscrollX, this.oldscrollY);

        this.container.classList.remove('fullscreen');
        this.old_parent = null;
        this.next_sib = null;
        this.old_fs = false;

        // Update toolbar button
        const fsButton = this.toolbuttons[Object.keys(this.toolbuttons).find(key => this.toolbuttons[parseInt(key)][0].id === 'fsbutton')!];
        if (fsButton && fsButton[4] === 1) { // type 1 is toggle
            fsButton[0].classList.remove('toggle-pressed');
            fsButton[0].classList.add('toggle-depressed');
            fsButton[6] = false; // pressed state
            fsButton[0].setAttribute('aria-pressed', 'false');
        }

        this.resizeScreen(false, true);
        if (from_click) { (this.input as HTMLElement).focus(); }

        // If auto-fullscreen on resize was on, turn it off
        if (this.goFullOnResize) {
            this.goFullOnResize = false;
            // this.store.set('fullscreen-auto', false); // Persist this change if desired
        }
    }
    // #endregion Fullscreen Management

    // #region Splash Screen Management
    public initSplash(percentage: number = 0, message?: string): void {
        if (this.splash) { // Already initialized
            this.updateSplash(percentage, message);
            return;
        }

        if (message === undefined) { message = tr.call(this, 'Discombobulating interface recipient...'); }

        this.old_y = this.el_display.style.overflowY; // Save original overflow state
        this.el_display.style.overflowY = 'hidden';

        this.splash = document.createElement('div');
        this.splash.className = 'decafmud splash';

        this.splash.innerHTML = `<h2 class="decafmud heading"><a href="http://decafmud.stendec.me/">DecafMUD</a> <span class="version">v${(this.decaf.constructor as any).version}</span></h2>`;

        this.splash_pg = document.createElement('div');
        this.splash_pg.className = 'decafmud progress';
        this.splash_pg.setAttribute('role', 'progressbar');
        this.splash_pg.setAttribute('aria-valuemax', '100');
        this.splash_pg.setAttribute('aria-valuemin', '0');
        this.updateSplashProgress(percentage);

        this.splash_pgi = document.createElement('div');
        this.splash_pgi.className = 'decafmud inner-progress';
        this.splash_pgi.style.width = `${percentage}%`;
        this.splash_pg.appendChild(this.splash_pgi);

        this.splash_pgt = document.createElement('div');
        this.splash_pgt.className = 'decafmud progress-text';
        this.splash_pgt.innerHTML = tr.call(this, '{0}%', percentage);
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

    private updateSplashProgress(percentage: number): void {
        if (this.splash_pg) {
            const PctString = tr.call(this, '{0}%', percentage);
            this.splash_pg.setAttribute('aria-valuenow', percentage.toString());
            this.splash_pg.setAttribute('aria-valuetext', PctString);
            if (this.splash_pgt) this.splash_pgt.innerHTML = PctString;
            if (this.splash_pgi) this.splash_pgi.style.width = `${percentage}%`;
        }
    }

    public updateSplash(percentage?: number, message?: string): void {
        if (!this.splash || !this.splash_st || !this.splash_pg) { return; }

        if (message !== undefined) {
            this.splash_st.innerHTML = message;
        }

        if (percentage !== undefined) {
            const Pct = Math.max(0, Math.min(100, percentage));
            this.updateSplashProgress(Pct);
        }
    }

    public endSplash(): void {
        if (!this.splash) { return; }

        // Add a class to fade out, then remove
        this.splash.classList.add('fadeout');
        setTimeout(() => {
            if (this.splash && this.splash.parentNode) {
                this.splash.parentNode.removeChild(this.splash);
            }
            this.splash = null;
            this.splash_st = null;
            this.splash_pg = null;
            this.splash_pgi = null;
            this.splash_pgt = null;
            this.splash_old = null;
            this.el_display.style.overflowY = this.old_y; // Restore original overflow
            this.decaf.debugString("Splash screen ended.", "info");
            this.resizeScreen(false, true); // Recalculate layout
            (this.input as HTMLElement).focus();
        }, 500); // Match CSS animation duration
    }

    public splashError(text: string, fatal: boolean = true): boolean {
        if (!this.splash || !this.splash_st || !this.splash_old) {
            // If splash isn't up, fallback to an alert or console error
            this.decaf.error(`Splash not available for error: ${text}`);
            alert(`DecafMUD Error:\n${text}`);
            return false; // Indicate splash was not used
        }

        this.splash_err = true;
        this.splash_st.innerHTML = `<span class="error">${tr.call(this,'ERROR:')}</span> ${text}`;
        this.splash_st.style.color = 'red'; // Basic error styling

        // Hide progress bar on error
        if (this.splash_pg) this.splash_pg.style.display = 'none';

        // If there were old messages, make them more prominent or style them.
        // For now, just ensure the error message is clear.
        this.decaf.debugString(`Splash Error: ${text}`, "error");

        if (fatal) {
            // For fatal errors, the splash screen might remain indefinitely.
            // No automatic call to endSplash.
        }
        return true; // Indicate splash was used
    }
    // #endregion Splash Screen Management

    // #region Display Interaction and Connection Status
    /**
     * Primary method for DecafMUD core to send data to be displayed.
     * This usually passes data to the active display plugin.
     * @param text The text to display.
     * @param clss Optional CSS class for this specific message. (Not always used by display plugins)
     */
    public print_msg(text: string, clss?: string): void {
        if (this.display && typeof (this.display as any).handleData === 'function') {
            // If a class is provided, the display plugin needs to know how to handle it.
            // StandardDisplay might not use 'clss' directly in handleData, but could have a separate method.
            // For now, just pass the text.
            (this.display as any).handleData(text);
        } else {
            this.decaf.debugString("Display plugin or handleData method not available.", "warn");
            // Fallback: append to el_display directly (highly unrecommended for formatted text)
            // this.el_display.appendChild(document.createTextNode(text));
            // this.el_display.appendChild(document.createElement('br'));
        }
    }

    public connected(): void {
        this.decaf.debugString("PanelsInterface: Connected.", "info");
        // Update connection status icon if one exists
        // Example: this.updateIcon(this.ico_connected_id, 'Connected', 'connected-html', 'connectivity connected');
        const connectIconId = this.icons.findIndex(iconEntry => iconEntry[0].classList.contains('connectivity'));
        if (connectIconId !== -1) {
            this.updateIcon(connectIconId, tr.call(this, "You are connected."), '', 'connectivity connected');
        } else {
            // Add a new one if it doesn't exist (should have been added in _setupInitialIcons)
            this.addIcon(tr.call(this, "You are connected."), '', 'connectivity connected');
        }

        // Clear any "connecting" or "disconnected" info bars
        this.closeIBar('connecting_status');
        this.closeIBar('disconnected_status');
        this.closeIBar('reconnecting'); // From DecafMUD core's reconnect logic

        (this.input as HTMLElement).focus();
        // Enable input, change placeholder, etc.
        (this.input as HTMLInputElement | HTMLTextAreaElement).disabled = false;
        (this.input as HTMLInputElement | HTMLTextAreaElement).value = '';
        // (this.input as HTMLInputElement | HTMLTextAreaElement).placeholder = this.decaf.options.set_interface.msg_empty;
        this.updateInput();

    }

    public connecting(): void {
        this.decaf.debugString("PanelsInterface: Connecting...", "info");
        // Update icon
        const connectIconId = this.icons.findIndex(iconEntry => iconEntry[0].classList.contains('connectivity'));
        if (connectIconId !== -1) {
            this.updateIcon(connectIconId, tr.call(this, "Attempting to connect..."), '', 'connectivity connecting');
        } else {
            this.addIcon(tr.call(this, "Attempting to connect..."), '', 'connectivity connecting');
        }

        // Show "Connecting..." info bar
        this.infoBar(
            this.decaf.options.set_interface.msg_connecting || tr.call(this, "DecafMUD is attempting to connect..."),
            'connecting_status',
            0 // Indefinite, will be closed by connected() or disconnected()
        );

        (this.input as HTMLInputElement | HTMLTextAreaElement).disabled = true;
        // (this.input as HTMLInputElement | HTMLTextAreaElement).placeholder = this.decaf.options.set_interface.msg_connecting;
         this.updateInput();
    }

    public disconnected(will_reconnect: boolean): void {
        this.decaf.debugString(`PanelsInterface: Disconnected. ${will_reconnect ? "Will attempt to reconnect." : "Not reconnecting."}`, "info");
        // Update icon
        const connectIconId = this.icons.findIndex(iconEntry => iconEntry[0].classList.contains('connectivity'));
        if (connectIconId !== -1) {
            this.updateIcon(connectIconId, tr.call(this, "You are currently disconnected."), '', 'connectivity disconnected');
        } else {
            this.addIcon(tr.call(this, "You are currently disconnected."), '', 'connectivity disconnected');
        }

        this.closeIBar('connecting_status');

        if (!will_reconnect) {
            this.infoBar(
                tr.call(this, "You have been disconnected."),
                'disconnected_status',
                0, // Indefinite
                'disconnected', // Icon class
                [['Reconnect', () => {
                    this.decaf.reconnect();
                    // No need to explicitly close this infoBar here,
                    // as connecting() or connected() should clear it via its ID 'disconnected_status'
                    // or a more general "clear connection related info bars" logic.
                    // For safety, we can close it directly too.
                    this.closeIBar('disconnected_status');
                }]],
                undefined, // barclass
                () => { // closecb
                    // If user manually closes this, ensure input is still actionable for manual connect via menu
                     (this.input as HTMLInputElement | HTMLTextAreaElement).disabled = false;
                     // (this.input as HTMLInputElement | HTMLTextAreaElement).placeholder = this.decaf.options.set_interface.msg_connect;
                     this.updateInput();
                }
            );
            // Keep input disabled until user explicitly tries to reconnect or closes the bar
            (this.input as HTMLInputElement | HTMLTextAreaElement).disabled = true;
        } else {
            // Reconnect message is usually handled by DecafMUD core if it's doing timed reconnects.
            // If PanelsInterface needs to show its own, it would be here.
        }
        // (this.input as HTMLInputElement | HTMLTextAreaElement).placeholder = this.decaf.options.set_interface.msg_connect;
        this.updateInput();
    }


    private sizeDisplayTimeout: number | undefined;
    public showSize(): void {
        if (!this.display || typeof (this.display as any).getSize !== 'function') return;

        const size = (this.display as any).getSize(); // Expects [cols, rows]
        const message = `${size[0]}x${size[1]}`;

        let sizeElement = document.getElementById('decaf_size_display');
        if (!sizeElement) {
            sizeElement = document.createElement('div');
            sizeElement.id = 'decaf_size_display';
            sizeElement.className = 'decafmud size-display'; // Style this with CSS
            // Position it, e.g., bottom right of el_display
            sizeElement.style.position = 'absolute';
            sizeElement.style.bottom = '5px';
            sizeElement.style.right = '5px';
            sizeElement.style.padding = '2px 5px';
            sizeElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
            sizeElement.style.color = 'white';
            sizeElement.style.zIndex = '100'; // Above display content
            this.el_display.appendChild(sizeElement);
        }
        sizeElement.innerText = message;
        sizeElement.style.display = '';

        if (this.sizeDisplayTimeout) {
            clearTimeout(this.sizeDisplayTimeout);
        }
        this.sizeDisplayTimeout = window.setTimeout(() => {
            this.hideSize();
        }, 1500); // Hide after 1.5 seconds
    }

    public hideSize(): void {
        const sizeElement = document.getElementById('decaf_size_display');
        if (sizeElement) {
            sizeElement.style.display = 'none';
        }
        if (this.sizeDisplayTimeout) {
            clearTimeout(this.sizeDisplayTimeout);
            this.sizeDisplayTimeout = undefined;
        }
    }
    // #endregion Display Interaction and Connection Status

    // #region Sidebar: Progress Bars and Map
    /**
     * Adds a progress bar to the sidebar.
     * @param id Unique ID for the progress bar.
     * @param name Text label for the progress bar.
     * @param value Current value (0-100).
     * @param text Optional text to display on the bar (e.g., "50/100 HP"). If null, uses value%.
     * @returns The internal ID of the progress bar, or -1 on failure.
     */
    public addProgressBar(id: string, name: string, value: number, text?: string | null): number {
        if (this.progressbars.find(pb => pb[0] === id)) {
            this.decaf.debugString(`Progress bar with ID "${id}" already exists. Use updateProgressBar.`, "warn");
            return -1;
        }

        const row = this.progresstable.insertRow();
        row.id = `pbrow_${id}`;

        const nameCell = row.insertCell();
        nameCell.className = 'name';
        nameCell.innerText = name;

        const barCell = row.insertCell();
        barCell.className = 'bar';

        const outerDiv = document.createElement('div');
        outerDiv.className = 'progress-outer';
        const innerDiv = document.createElement('div');
        innerDiv.className = 'progress-inner';
        const textDiv = document.createElement('div');
        textDiv.className = 'progress-text';

        outerDiv.appendChild(innerDiv);
        outerDiv.appendChild(textDiv);
        barCell.appendChild(outerDiv);

        const val = Math.max(0, Math.min(100, value));
        innerDiv.style.width = `${val}%`;
        textDiv.innerText = text === null ? `${val}%` : (text || `${val}%`);


        const internalIndex = this.progressbars.push([id, innerDiv, textDiv]) -1;

        // Ensure progress table is visible if not already and setting allows
        if (this.settings.showProgressBars && this.progresstable.style.display === 'none') {
             this.progresstable.style.display = '';
             this.resizeScreen(false, true);
        } else if (this.settings.showProgressBars) {
            this.resizeScreen(false, true); // Content added, may need resize
        }


        return internalIndex; // Or return a more stable ID if needed
    }

    /**
     * Updates an existing progress bar.
     * @param id The ID of the progress bar to update.
     * @param value New value (0-100).
     * @param text Optional new text for the bar. If null, uses value%. If undefined, text is unchanged.
     * @returns True if successful, false if bar not found.
     */
    public updateProgressBar(id: string, value: number, text?: string | null): boolean {
        const pbData = this.progressbars.find(pb => pb[0] === id);
        if (!pbData) {
            this.decaf.debugString(`Progress bar with ID "${id}" not found for update.`, "warn");
            return false;
        }

        const innerDiv = pbData[1];
        const textDiv = pbData[2];
        const val = Math.max(0, Math.min(100, value));

        innerDiv.style.width = `${val}%`;

        if (text === null) { // Explicitly set to percentage
            textDiv.innerText = `${val}%`;
        } else if (text !== undefined) { // Text provided
            textDiv.innerText = text;
        } else { // Text undefined, means only update value, text remains as is (or recalculate if it was % based)
            // If current text is "X%", update it. Otherwise, leave it.
            if (textDiv.innerText.endsWith('%')) {
                 textDiv.innerText = `${val}%`;
            }
        }
        return true;
    }

    /**
     * Deletes a progress bar from the sidebar.
     * @param id The ID of the progress bar to delete.
     * @returns True if successful, false if bar not found.
     */
    public delProgressBar(id: string): boolean {
        const pbIndex = this.progressbars.findIndex(pb => pb[0] === id);
        if (pbIndex === -1) {
            this.decaf.debugString(`Progress bar with ID "${id}" not found for deletion.`, "warn");
            return false;
        }

        const rowId = `pbrow_${id}`;
        const row = document.getElementById(rowId);
        if (row && row.parentNode) {
            row.parentNode.removeChild(row);
        }

        this.progressbars.splice(pbIndex, 1);

        if (this.progressbars.length === 0 && this.progresstable.style.display !== 'none') {
            // this.progresstable.style.display = 'none'; // Hide if empty, but setting should control final visibility
            // Visibility is handled by apply_progress_bars_visibility based on setting
        }
        this.resizeScreen(false, true); // Content removed, may need resize
        return true;
    }

    // Map related methods
    public showMap(visible: boolean = true): void {
        this.settings.showMap = visible; // Update setting directly, will be saved by toggle_map_display if called via menu
        this.apply_map_visibility();
        if (this.store) this.store.set('showMap', visible); // Persist
    }

    public hideMap(): void {
        this.showMap(false);
    }

    /**
     * Updates the content of the map area.
     * @param mapData HTML or text content for the map.
     */
    public updateMap(mapData: string): void {
        if (this.mapdiv) {
            // Potentially sanitize mapData if it's HTML from an untrusted source
            this.mapdiv.innerHTML = mapData;

            // Ensure map is visible if not already and setting allows
            if (this.settings.showMap && this.mapdiv.style.display === 'none') {
                this.apply_map_visibility(); // This calls resizeScreen
            } else if (this.settings.showMap) {
                 this.resizeScreen(false, true); // Content changed, may need resize
            }
        }
    }
    // #endregion Sidebar: Progress Bars and Map


    // Placeholder for other methods that will be filled in
    public maybeFocusInput(e: MouseEvent): void {
        const sel = window.getSelection();
        if (sel && sel.toString() !== '' && sel.focusNode && this.el_display.contains(sel.focusNode.parentNode as Node)) {
            this.decaf.debugString('not focusing this.input: selection active');
            return;
        }
        (this.input as HTMLElement).focus();
    }

    public displayKey(e: KeyboardEvent): void {
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }
        if (!((e.keyCode > 64 && e.keyCode < 91) || (e.keyCode > 47 && e.keyCode < 58)
            || (e.keyCode > 185 && e.keyCode < 193) || (e.keyCode > 218 && e.keyCode < 223))) {
            return;
        }
        (this.input as HTMLElement).focus();
    }

    public localEcho(txt: string): void {
        if (this.echo) {
            // This should ideally go through the display plugin to ensure formatting,
            // but for simple echo, direct print might be what original did.
            // For now, let's assume it's a direct message to the display.
            // Consider if this should be formatted as "input" style.
            this.decaf.display.handleData(txt + "\r\n"); // \r\n for new line
        }
    }

    public displayInput(input: string, fromUser: boolean = true, addToHistory: boolean = true): void {
        if (fromUser && this.echo) {
            // Already handled by localEcho if echo is on and it's user input.
            // Or, if there's a specific style for user input, apply here.
        } else if (!fromUser) {
            // Display input that wasn't from the user (e.g. from a script/trigger)
            // This might also go through display.handleData or a specific method.
        }

        if (addToHistory && input.trim() !== "") {
            // Add to history, remove oldest if size exceeded
            if (this.history[this.history.length -1] !== input) { // Avoid duplicate consecutive entries
                this.history.push(input);
                if (this.history.length > this.decaf.options.set_interface.mru_size) {
                    this.history.shift();
                }
            }
        }
        this.historyPosition = this.history.length; // Reset history position
    }


    public handleInput(e: KeyboardEvent): void {
        if (this.inputCtrl) { // Special input handler active (e.g. password)
            this.handleInputPassword(e);
            return;
        }

        const currentInput = (this.input as HTMLInputElement | HTMLTextAreaElement);
        let text = currentInput.value;

        // Tab Completion Logic
        if (this.wantTab) {
            if (e.keyCode !== 9) { // Tab
                this.wantTab = false;
                this.tabIndex = -1;
                this.tabValues = [];
                currentInput.value = this.buffer; // Restore pre-tab buffer
                // Reprocess the key
                // This is tricky, ideally, we'd re-dispatch the event or call handleInput again.
                // For now, let's assume non-tab keys break the tab sequence.
            }
        }


        switch (e.keyCode) {
            case 13: // Enter
                cancelEvent(e);
                this.wantTab = false;
                this.tabIndex = -1;

                if (this.reqTab) { // Was in middle of tab completion
                    text = this.tabValues[this.tabIndex] || text;
                    this.reqTab = false;
                }
                currentInput.value = text; // Ensure value is current before sending

                if (text.trim() !== "") {
                    this.displayInput(text, true, true); // display + add to history
                    this.decaf.sendInput(text);
                }
                currentInput.value = "";
                this.buffer = "";
                break;

            case 38: // Up Arrow (History Previous)
                cancelEvent(e);
                if (this.historyPosition > 0) {
                    if (this.historyPosition === this.history.length) {
                        this.buffer = text; // Save current input before browsing history
                    }
                    this.historyPosition--;
                    currentInput.value = this.history[this.historyPosition];
                }
                break;

            case 40: // Down Arrow (History Next)
                cancelEvent(e);
                if (this.historyPosition < this.history.length -1) {
                    this.historyPosition++;
                    currentInput.value = this.history[this.historyPosition];
                } else if (this.historyPosition === this.history.length -1) {
                    this.historyPosition++;
                    currentInput.value = this.buffer; // Restore saved input
                }
                break;

            case 9: // Tab
                cancelEvent(e);
                if (this.decaf.options.tabComplete !== true || !this.decaf.telopt.GMCP) { // GMCP needed for tab completion in many MUDs
                    return;
                }

                if (!this.wantTab) { // First tab press
                    this.buffer = text;
                    this.wantTab = true;
                    this.reqTab = true;
                    this.tabIndex = -1;
                    this.tabValues = [];
                    // For GMCP based tab completion:
                    // Example: this.decaf.telopt.GMCP.send("Client.TabComplete", this.buffer);
                    // The MUD would respond with GMCP Client.TabCompleteValues with a list of completions.
                    // For now, let's simulate this:
                    if (typeof (this.decaf.telopt.GMCP as any).handleTabComplete === 'function') {
                        (this.decaf.telopt.GMCP as any).handleTabComplete(this.buffer);
                    } else {
                         this.decaf.debugString("GMCP or handleTabComplete not configured for tab completion.", "warn");
                         this.wantTab = false; // Abort tab if no handler
                         this.reqTab = false;
                    }

                } else { // Subsequent tab presses
                    if (this.tabValues.length > 0) {
                        this.tabIndex = (this.tabIndex + 1) % this.tabValues.length;
                        currentInput.value = this.tabValues[this.tabIndex];
                    }
                }
                break;

            // TODO: Add other key handlers if needed (e.g. F-keys for macros if settings.fkeyMacrosEnabled)
            // TODO: Numpad walking if settings.numpadWalkingEnabled
            // Placeholder for F-Key and Numpad
            if (this.settings.fkeyMacrosEnabled && e.keyCode >= 112 && e.keyCode <= 123) { // F1-F12
                cancelEvent(e);
                this.decaf.debugString(`F-Key ${e.keyCode - 111} pressed. Macro handling not yet implemented.`);
                // TODO: Implement F-Key macro logic here
                // e.g., this.decaf.macros.execute(`f${e.keyCode - 111}`);
            }
            // Placeholder for Numpad walking (common example: numpad 7,8,9,4,6,1,2,3 for directions)
            // This requires more complex mapping based on numlock state and specific keycodes.
            // For now, just a note.
            // if (this.settings.numpadWalkingEnabled && [103,104,105,100,102,97,98,99].includes(e.keyCode)) {
            //    cancelEvent(e);
            //    this.decaf.debugString(`Numpad key ${e.keyCode} pressed. Walking not yet implemented.`);
            // }


            default:
                this.wantTab = false; // Any other key press cancels tab completion sequence
                this.reqTab = false;
                // If we were browsing history and user types, commit current history line to buffer and append typed char
                if (this.historyPosition < this.history.length) {
                    // This behavior might need refinement: does typing append to history item or start new?
                    // Original simple interface might have started new.
                    // For now, let's assume typing while on a history item uses that item as a base.
                    // this.buffer = currentInput.value; // Value already contains the history item
                }
                break;
        }
    }

    /**
     * Called by GMCP when tab completion values are received from the server.
     * @param values An array of completion strings.
     */
    public receivedTabCompletionValues(values: string[]): void {
        if (!this.reqTab) return; // Not expecting tab values

        this.tabValues = values;
        if (this.tabValues.length > 0) {
            this.tabIndex = 0;
            (this.input as HTMLInputElement | HTMLTextAreaElement).value = this.tabValues[this.tabIndex];
        } else {
            // No completions found, maybe beep or flash input?
            this.wantTab = false; // Reset tab state
            this.reqTab = false;
            (this.input as HTMLInputElement | HTMLTextAreaElement).value = this.buffer; // Restore original
        }
    }


    public handleBlur(e: FocusEvent): void {
        this.inpFocus = (e.type === 'focus');
        this.hasFocus = this.inpFocus; // Consolidate these
        // Original had complex logic for blur with click-to-connect hint, etc.
        // For now, just basic focus tracking.
        // this.updateInput();
        this.updateInput(); // Call it to apply initial state based on focus
    }

    public handleInputPassword(e: KeyboardEvent): void {
        const currentInput = (this.input as HTMLInputElement | HTMLTextAreaElement);
        cancelEvent(e); // Prevent default action for most keys in password mode

        if (e.keyCode === 13) { // Enter
            this.decaf.sendInput(currentInput.value);
            // currentInput.value = ""; // Usually clear after sending password
            // this.exit_password_mode(); // Or server might send command to exit it
            // For now, let's assume server handles exiting password mode or another explicit call.
            // If we want client to exit immediately:
            currentInput.value = "";
            this.exit_password_mode("Sent by client after Enter.");


        } else if (e.keyCode === 27) { // Escape
            // Optionally allow Esc to clear and exit password mode
            currentInput.value = "";
            this.exit_password_mode("Cancelled by client with Escape.");
        }
        // Other keys are typically allowed to be typed into the field.
        // No history, no tab completion in password mode.
    }

    public enter_password_mode(reason: string = "Server request"): void {
        this.decaf.debugString(`Entering password mode: ${reason}`, "info");
        this.masked = true;
        this.inputCtrl = true;
        (this.input as HTMLInputElement | HTMLTextAreaElement).value = ""; // Clear input field
        this.updateInput();
        (this.input as HTMLElement).focus();
    }

    public exit_password_mode(reason: string = "Server request"): void {
        this.decaf.debugString(`Exiting password mode: ${reason}`, "info");
        this.masked = false;
        this.inputCtrl = false;
        // Value is usually already cleared or will be cleared by further actions.
        this.updateInput();
        (this.input as HTMLElement).focus();
    }


    public updateInput(): void {
        const currentInput = (this.input as HTMLInputElement | HTMLTextAreaElement);
        if (this.masked) {
            if (currentInput.type !== 'password') currentInput.type = 'password';
        } else {
            if (currentInput.type !== 'text') currentInput.type = 'text'; // Or 'textarea' if it's a textarea
        }

        if (this.inpFocus) {
            currentInput.classList.remove(this.decaf.options.set_interface.blurclass || 'mud-input-blur');
        } else {
            currentInput.classList.add(this.decaf.options.set_interface.blurclass || 'mud-input-blur');
            if (currentInput.value === "") {
                // Show placeholder/hint text if applicable
                // currentInput.placeholder = this.decaf.options.set_interface.msg_empty;
            }
        }
    }


    public reset(): void {
        this.masked = false;
        this.inputCtrl = false;
        this.hasFocus = false; // inpFocus will be set on actual focus event
        this.reqTab = false;
        this.wantTab = false;
        this.tabIndex = -1;
        this.tabValues = [];
        this.buffer = '';
        // this.updateInput(); // This will need to be implemented
        if (this.display) {
            // this.display.reset(); // Assuming display has a reset method
        }
    }

    public unloadPageFromEvent(e: BeforeUnloadEvent): string | undefined {
        if (this.decaf.connected) {
            const confirmationMessage = "You are still connected.";
            (e || window.event).returnValue = confirmationMessage; //Gecko + IE
            return confirmationMessage; //Webkit, Safari, Chrome
        }
        return undefined;
    }

    // ... other methods from SimpleInterface to be ported ...

    public load(): void {
        // In the original SimpleInterface, this required the display plugin.
        // Now, DecafMUD's core (`decafmud.ts`) already imports and registers
        // StandardDisplay. If other display types were to be supported and dynamically loaded,
        // this might need to use the (deprecated) require mechanism or a new system.
        // For now, we assume the display plugin (standard) is already handled by the core.
        this.decaf.debugString("PanelsInterface: load() called. Display should be pre-registered.", "info");
    }

    public setup(): void {
        this.store = this.decaf.store.sub('ui-panels'); // Ensure store is initialized
        this.loadSettings(); // Load user settings

        // Toolbar position (simplified for now, original had more complex logic)
        const tbarPos = this.store.get('toolbar-position', 'top-left');
        this.toolbar.className += ' ' + tbarPos;
        this.container.insertBefore(this.toolbar, this.container.firstChild);

        // Initialize the display plugin instance
        const displayPluginName = this.decaf.options.display || 'standard';
        const DisplayPluginConstructor = (this.decaf.constructor as any).plugins.Display[displayPluginName];
        if (DisplayPluginConstructor) {
            this.display = new DisplayPluginConstructor(this.decaf, this, this.el_display);
            (this.display as any).id = 'mud-display'; // Mirroring original JS
            this.decaf.display = this.display; // Assign to DecafMUD instance
            this.decaf.debugString(`PanelsInterface: Initialized display plugin "${displayPluginName}"`, "info");
        } else {
            this.decaf.error(`Display plugin "${displayPluginName}" not found!`);
            return;
        }

        this._setupToolbar();
        this._setupInitialIcons();

        // Fullscreen settings (simplified)
        this.goFullOnResize = this.store.get('fullscreen-auto', false); // Defaulting to false
        const startFullscreen = this.store.get('fullscreen-start', this.decaf.options.set_interface.start_full);

        if (startFullscreen) {
            // this.enter_fs(false); // enter_fs to be ported
        } else {
            this.resizeScreen(false, true); // Initial resize even if not fullscreen
        }
        this.decaf.debugString("PanelsInterface: setup() complete.", "info");
    }

    private _setupToolbar(): void {
        this.toolbar.innerHTML = ''; // Clear any existing content
        toolbarMenus.forEach((menuDef, menuIndex) => {
            const menuButtonId = this.tbNew( // tbNew to be fully ported
                menuDef.id,
                menuDef.name,
                undefined,
                menuDef.tooltip,
                1, true, false,
                `menu-button-${menuDef.id}`,
                (e: Event) => {
                    this.toggle_menu(menuIndex, e); // toggle_menu to be ported
                }
            );
        });
        // this._resizeToolbar(); // _resizeToolbar to be ported
    }

    private _setupInitialIcons(): void {
        // Add a connectivity icon
        this.addIcon(
            tr.call(this, "You are currently disconnected. Click to reconnect."),
            '', // HTML content for icon, can be empty if styled by CSS
            'connectivity disconnected', // CSS classes for styling (e.g., background image, color)
            () => { // onclick handler
                if (!this.decaf.connected && !this.decaf.connecting) {
                    this.decaf.reconnect();
                } else if (this.decaf.connected) {
                    this.infoBar(tr.call(this, "Connection active to {host}:{port}", {host: this.decaf.socket.host, port: this.decaf.socket.port}), "conn_status_info", 5);
                } else if (this.decaf.connecting) {
                    this.infoBar(tr.call(this, "Connection attempt in progress..."), "conn_status_info", 3);
                }
            },
            (e: KeyboardEvent) => { // onkey handler (for Enter/Space when focused)
                if (e.keyCode === 13 || e.keyCode === 32) { // Enter or Space
                    cancelEvent(e);
                    if (!this.decaf.connected && !this.decaf.connecting) {
                        this.decaf.reconnect();
                    } else if (this.decaf.connected) {
                         this.infoBar(tr.call(this, "Connection active to {host}:{port}", {host: this.decaf.socket.host, port: this.decaf.socket.port}), "conn_status_info", 5);
                    } else if (this.decaf.connecting) {
                        this.infoBar(tr.call(this, "Connection attempt in progress..."), "conn_status_info", 3);
                    }
                }
            }
        );
        // Example: Add a Fullscreen toggle icon if a global fullscreen button is desired in the tray
        // this.addIcon(tr.call(this, "Toggle Fullscreen"), 'FS', 'fullscreen-icon', () => this.click_fsbutton());
    }

    // #region Menu Action Handlers
    public menu_reconnect(): void {
        this.close_menus(); // Close menu before action
        if (this.decaf) this.decaf.reconnect();
    }

    public menu_log(style: string): void {
        this.close_menus();
        this.decaf.debugString(`Logging action: ${style}. Not yet fully implemented.`, "info");
        // TODO: Implement actual logging functionality (e.g., open popup with log, save to file)
        const popup = this.showPopup();
        this.popupHeader(`Session Log (${style})`);
        const logArea = this.popupTextarea('log_content_area', 50);
        logArea.value = `Log content (style: ${style}) would appear here...`;
        logArea.readOnly = true;
        const buttons = this.buttonLine(popup);
        this.addCloseButton(buttons);
    }

    public menu_font_size(): void {
        this.close_menus();
        const popup = this.showPopup();
        this.popupHeader('Set Font Size');

        const currentSize = this.settings.fontPercentage;
        const textDiv = this.popupTextdiv(); // Use a div for more flexible content
        textDiv.style.textAlign = 'center';

        const p = document.createElement('p');
        p.innerHTML = `Current font size: <span id="font_size_display">${currentSize}%</span>`;
        textDiv.appendChild(p);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '50';
        slider.max = '200'; // Max 200% for practical reasons, can adjust
        slider.value = currentSize.toString();
        slider.style.width = '80%';
        slider.oninput = () => {
            const display = document.getElementById('font_size_display');
            if (display) display.innerText = `${slider.value}%`;
        };
        slider.onchange = () => { // Apply on release
            this.set_font_size(parseInt(slider.value, 10));
        };
        textDiv.appendChild(slider);

        const buttons = this.buttonLine(popup);
        const resetButton = this.createButton("Reset to Default", () => {
            this.set_font_size(defaultClientSettings.fontPercentage);
            slider.value = defaultClientSettings.fontPercentage.toString();
            const display = document.getElementById('font_size_display');
            if (display) display.innerText = `${defaultClientSettings.fontPercentage}%`;
        });
        buttons.appendChild(resetButton);
        this.addCloseButton(buttons);
        slider.focus();
    }

    public menu_macros(): void {
        this.close_menus();
        this.decaf.debugString("Macros action. Not yet implemented.", "info");
        // TODO: Implement macro editor popup
        const popup = this.showPopup();
        this.popupHeader('Macro Editor');
        const p = document.createElement('p');
        p.style.textAlign = 'center';
        p.innerText = 'Macro editing functionality will be here.';
        popup.appendChild(p);
        const buttons = this.buttonLine(popup);
        this.addCloseButton(buttons);
    }

    public menu_history_flush(): void {
        this.close_menus();
        if (this.display && typeof (this.display as any).clear === 'function') {
            (this.display as any).clear();
            this.decaf.debugString("Display history flushed.", "info");
        } else {
            this.decaf.debugString("Display plugin does not have a clear method.", "warn");
        }
        // Also clear command history if desired
        // this.history = [];
        // this.historyPosition = 0;
        // this.decaf.debugString("Command history also cleared.", "info");
    }

    public menu_features(): void {
        this.close_menus();
        // This could list supported telnet options, GMCP modules, etc.
        const popup = this.showPopup();
        this.popupHeader('Client Features');
        const content = this.popupTextdiv();
        content.innerHTML = `
            <h4>Supported Features:</h4>
            <ul>
                <li>TELNET Options: NAWS, TTYPE, CHARSET, GMCP, MSDP, COMPRESSv2, ZMP, ECHO</li>
                <li>Interface: Panels with Toolbar, Input History, Tab Completion (GMCP-based)</li>
                <li>Settings: Font Size, Basic Toggles</li>
                <li>Partial GMCP Support (Core, Char, Room, Comm)</li>
                <li>Basic ZMP Support</li>
                <li>Splash Screen</li>
                <li>Fullscreen Mode</li>
                <li>Popups & Info Bars</li>
            </ul>
            <p>More features may be partially implemented or under development.</p>
        `;
        const buttons = this.buttonLine(popup);
        this.addCloseButton(buttons);
    }

    public menu_about(): void {
        this.close_menus();
        // Use DecafMUD's core about, but show it in a popup
        const popup = this.showPopup();
        this.popupHeader('About DecafMUD');
        const content = this.popupTextdiv();

        // Recreate the text from DecafMUD's about() method
        var abt = [`DecafMUD v${(this.decaf.constructor as any).version.toString()} &copy; 2010 Stendec`];
        abt.push("Updated and improved by Pit from Discworld.");
        abt.push("Further bugfixes and improvements by Waba from MUME.");
        abt.push("Typescript port and PanelsInterface by Jules (AI).");
        abt.push("<a href=\"https://github.com/MUME/DecafMUD\" target=\"_blank\">https://github.com/MUME/DecafMUD</a><br/><br/>");
        abt.push("DecafMUD is a web-based MUD client written in JavaScript/TypeScript, " +
            "rather than a plugin like Flash or Java, making it load faster and react as " +
            "you'd expect a website to.<br/><br/>");
        abt.push("It's easy to customize as well, using simple CSS and JavaScript, " +
            "and free to use and modify, so long as your MU* is free to play!");
        content.innerHTML = abt.join('<br/>');

        const buttons = this.buttonLine(popup);
        this.addCloseButton(buttons);
    }
    // #endregion Menu Action Handlers

    // #region Toolbar and Menu Programmatic Modification
    public addMenuItem(
        targetMenuId: string,
        item: MenuItemAction,
        position?: number,
        isSubmenu: boolean = false,
        parentSubmenuText?: string
    ): boolean {
        let targetMenu = toolbarMenus.find(m => m.id === targetMenuId);

        // This is a simplified version. A full implementation might need to handle nested submenus.
        // For now, assuming targetMenuId refers to a top-level menu defined in toolbarMenus.
        if (!targetMenu) {
            this.decaf.debugString(`Target menu "${targetMenuId}" not found for adding item "${item.name}".`, "warn");
            return false;
        }

        if (position === undefined || position < 0 || position > targetMenu.items.length) {
            targetMenu.items.push(item);
        } else {
            targetMenu.items.splice(position, 0, item);
        }

        // If the menu is already rendered, we need to refresh its DOM representation.
        // This is tricky as submenus are created on-demand by toggle_menu.
        // Simplest for now: if a menu that was already opened is modified, close it to force redraw on next open.
        const menuElement = document.getElementById("sub" + targetMenuId);
        if (menuElement) {
           // Force close and clear current DOM for this menu to be rebuilt on next open
           if (this.open_menu !== -1 && toolbarMenus[this.open_menu].id === targetMenuId) {
               this.close_menus(); // Close all menus
           }
           // Remove the existing submenu so it gets rebuilt with new items
           menuElement.remove();
        }
        this.decaf.debugString(`Added menu item "${item.name}" to menu "${targetMenuId}". Interface may need UI refresh for static menus.`, "info");
        return true;
    }
    // #endregion Toolbar and Menu Programmatic Modification

    /** Create a new toolbar button.
     * @param {string} btnDomId The DOM ID for the button element.
     * @param {String} text The name of the button.
     * @param {String} [icon] The icon to display on the button.
     * @param {String} [tooltip] The tooltip text to associate with the button.
     * @param {number} [type=0] The type of button. 0 is normal, 1 is toggle.
     * @param {boolean} [enabled=true] Whether or not the button is enabled.
     * @param {boolean} [pressed=false] Whether or not a toggle button is pressed.
     * @param {String} [clss] Any additional class to set on the button.
     * @param {function} [onclick] The function to call when the button is clicked.
     * @returns {number} The internal ID of the button.
     */
    public tbNew(
        btnDomId: string,
        text: string,
        icon?: string,
        tooltip?: string,
        type: number = 0, // 0 normal, 1 toggle
        enabled: boolean = true,
        pressed: boolean = false,
        clss?: string,
        onclick?: (event: Event) => void
    ): number { // Returns internal numeric ID
        const internalId = ++this.toolbutton_id;

        const btn = document.createElement('span');
        btn.id = btnDomId; // Use provided string id
        btn.className = 'decafmud button toolbar-button';
        if (clss) { btn.className += ' ' + clss; }
        if (type === 1) { btn.className += ' toggle ' + (pressed ? 'toggle-pressed' : 'toggle-depressed'); }

        btn.innerHTML = text; // Text is used as content
        btn.title = tooltip || text; // Tooltip, fallback to text

        if (!enabled) { btn.classList.add('disabled'); }
        btn.setAttribute('tabIndex', '0'); // Make it focusable
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-disabled', (!enabled).toString());
        if (type === 1) {
            btn.setAttribute('aria-pressed', pressed.toString());
        }

        if (icon) {
            btn.style.backgroundImage = `url('${icon}')`;
            btn.classList.add('icon');
        }

        if (onclick) {
            const clickHandler = (e: Event) => {
                if (e.type === 'keydown' && (e as KeyboardEvent).keyCode !== 13) { // 13 is Enter
                    return;
                }
                const currentButtonState = this.toolbuttons[internalId];
                if (!currentButtonState || !currentButtonState[5]) { // Check if button exists and is enabled (index 5)
                    return;
                }
                onclick.call(this, e); // Call the provided onclick
                if (e.type && e.type !== 'keydown') { // Avoid blur if activated by keyboard
                    btn.blur();
                }
            };
            hookEvent(btn, 'click', clickHandler);
            hookEvent(btn, 'keydown', clickHandler);
        }

        hookEvent(btn, 'focus', () => {
            if (btn.parentNode === this.toolbar) {
                this.toolbar.setAttribute('aria-activedescendant', btn.id);
                // Logic for 'visible' class based on 'always-on' needs to be ported to _resizeToolbar or similar
                if (!this.toolbar.classList.contains('always-on')) {
                    this.toolbar.classList.add('visible');
                }
            }
        });
        hookEvent(btn, 'blur', () => {
             if (btn.parentNode === this.toolbar) {
                if (this.toolbar.getAttribute('aria-activedescendant') === btn.id) {
                    this.toolbar.removeAttribute('aria-activedescendant');
                }
                 if (!this.toolbar.classList.contains('always-on')) {
                    // Add a small delay to allow click on submenu to register before hiding
                    setTimeout(() => {
                        // Check if focus is still within toolbar or an open menu
                        let activeElement = document.activeElement;
                        let isFocusInToolbarOrMenu = false;
                        if (this.toolbar.contains(activeElement)) {
                            isFocusInToolbarOrMenu = true;
                        } else if (this.open_menu !== -1) {
                             const menuElement = document.getElementById("sub" + toolbarMenus[this.open_menu].id);
                             if(menuElement && menuElement.contains(activeElement)){
                                isFocusInToolbarOrMenu = true;
                             }
                        }

                        if (!isFocusInToolbarOrMenu) {
                           this.toolbar.classList.remove('visible');
                        }
                    }, 100);
                }
            }
        });

        this.toolbuttons[internalId] = [btn, text, icon, tooltip, type, enabled, pressed, clss, onclick];
        // btn.setAttribute('button-map-id', internalId.toString()); // For mapping DOM element back to internal ID if needed

        this.toolbar.appendChild(btn);
        this._resizeToolbar(); // Call after adding button
        return internalId;
    }

    public tbDelete(id: number): boolean {
        if (!this.toolbuttons[id]) return false;
        const btn = this.toolbuttons[id][0];
        if (btn.parentNode) {
            btn.parentNode.removeChild(btn);
        }
        delete this.toolbuttons[id];
        this._resizeToolbar();
        return true;
    }

    public tbText(id: number, text: string): boolean {
        if (!this.toolbuttons[id]) return false;
        this.toolbuttons[id][0].innerHTML = text; // Assuming text is HTML-safe or simple
        this.toolbuttons[id][1] = text;
        // No resize needed typically for text change unless it wraps
        return true;
    }

    public tbEnable(id: number, enabled: boolean): boolean {
        if (!this.toolbuttons[id]) return false;
        const btn = this.toolbuttons[id][0];
        this.toolbuttons[id][5] = enabled;
        btn.setAttribute('aria-disabled', (!enabled).toString());
        if (enabled) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.add('disabled');
        }
        return true;
    }

    public tbDisable(id: number, disabled: boolean): boolean {
        return this.tbEnable(id, !disabled);
    }

    public tbToggle(id: number, pressed: boolean): boolean {
        if (!this.toolbuttons[id] || this.toolbuttons[id][4] !== 1) return false; // Not a toggle button
        const btn = this.toolbuttons[id][0];
        this.toolbuttons[id][6] = pressed;
        btn.setAttribute('aria-pressed', pressed.toString());
        if (pressed) {
            btn.classList.remove('toggle-depressed');
            btn.classList.add('toggle-pressed');
        } else {
            btn.classList.remove('toggle-pressed');
            btn.classList.add('toggle-depressed');
        }
        return true;
    }

    public tbIcon(id: number, icon: string): boolean {
        if (!this.toolbuttons[id]) return false;
        const btn = this.toolbuttons[id][0];
        this.toolbuttons[id][2] = icon;
        if (icon) {
            btn.style.backgroundImage = `url('${icon}')`;
            btn.classList.add('icon');
        } else {
            btn.style.backgroundImage = '';
            btn.classList.remove('icon');
        }
        return true;
    }

    public tbTip(id: number, tooltip: string): boolean {
        if (!this.toolbuttons[id]) return false;
        this.toolbuttons[id][0].title = tooltip;
        this.toolbuttons[id][3] = tooltip;
        return true;
    }


    public _resizeToolbar(): boolean {
        let resized = false;
        const currentToolbarHeight = this.toolbar.offsetHeight;

        // Ensure display leaves enough space for the toolbar
        // The padding approach might need adjustment if toolbar is not at the top or if layout is complex.
        // For a top toolbar, el_display needs paddingTop.
        // If toolbar is positioned differently (e.g. bottom), other elements might need paddingBottom.

        // Assuming toolbar is always at the top for now.
        if (this.el_display && this.toolbarPadding !== currentToolbarHeight) {
            if (this.display && typeof (this.display as any).shouldScroll === 'function') {
                 (this.display as any).shouldScroll();
            }
            this.el_display.style.paddingTop = currentToolbarHeight + 'px';

            // Adjust infobar container top position if it exists and is directly after toolbar
            const infoBarContainer = this.container.querySelector('.infobar-container') as HTMLElement; // Assuming a wrapper for info bars
            if (infoBarContainer) {
                infoBarContainer.style.top = currentToolbarHeight + 'px';
            }


            this.toolbarPadding = currentToolbarHeight;
            // Toolbar height change means overall screen layout might change
            this.resizeScreen(false, true);
             if (this.display && typeof (this.display as any).doScroll === 'function') {
                (this.display as any).doScroll();
            }
            resized = true;
        } else if (!this.toolbarPadding && currentToolbarHeight > 0) {
             // Initial setup if padding wasn't set but toolbar has height
            this.el_display.style.paddingTop = currentToolbarHeight + 'px';
            this.toolbarPadding = currentToolbarHeight;
            resized = true;
        }


        // Original logic for "always-on" and positioning (tbar: 'bottom-left', 'top-right' etc.)
        // This is simplified here. A full port would need to handle classes like 'always-on',
        // and adjust this.container.insertBefore/appendChild for toolbar based on 'toolbar-position' setting.
        // For example, if this.store.get('toolbar-position', 'top-left').includes('bottom'),
        // then el_display would need paddingBottom, and toolbar would be appended last.

        // Auto-hiding toolbar logic (simplified from original)
        if (!this.toolbar.classList.contains('always-on') && !this.toolbar.matches(':hover')) {
            let hasFocusWithin = this.toolbar.contains(document.activeElement);
            if (!hasFocusWithin && this.open_menu !== -1) { // Check if a submenu is open
                const menuElement = document.getElementById("sub" + toolbarMenus[this.open_menu].id);
                if(menuElement && menuElement.contains(document.activeElement)){
                    hasFocusWithin = true;
                }
            }
            if (!hasFocusWithin) {
                 // this.toolbar.classList.remove('visible'); // Visibility handled by focus/blur on buttons now
            }
        }
        return resized;
    }

    public resizeScreen(showSize?: boolean, force?: boolean): void {
        if (force !== true && this.old_height === this.container.offsetHeight && this.old_width === this.container.offsetWidth && !this.isFullscreen()) {
             // If in fullscreen, dimensions might be same but layout within might need recalc due to body scrollbars gone etc.
            // The original simple interface always resized in fullscreen. Let's stick to that.
            if (!this.isFullscreen()) return;
        }


        let newHeight = 0;
        let newWidth = 0;

        if (this.isFullscreen()) {
            // When fullscreen, container takes viewport dimensions
            newHeight = window.innerHeight;
            newWidth = window.innerWidth;
            this.container.style.height = newHeight + 'px';
            this.container.style.width = newWidth + 'px';
            // No external scrollbars, so body is effectively 0,0
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        } else {
            newHeight = this.container.offsetHeight;
            newWidth = this.container.offsetWidth;
        }

        this.old_height = newHeight;
        this.old_width = newWidth;


        // Calculate available height for el_display
        // Considers input height, toolbar height, and any infobars
        let availableHeight = newHeight;
        availableHeight -= (this._input ? this._input.offsetHeight : 0);
        availableHeight -= (this.toolbar ? this.toolbar.offsetHeight : 0);

        // Subtract height of all visible infobars
        this.infobars.forEach(bar => {
            if (bar.element && bar.element.offsetHeight) {
                availableHeight -= bar.element.offsetHeight;
            }
        });

        // Some padding/margin adjustments, similar to original logic (e.g. +17, -12 were used)
        // These might need fine-tuning based on actual CSS.
        // For now, let's simplify and assume direct subtractions are enough.
        // availableHeight -= 5; // Small buffer

        if (availableHeight < 0) { availableHeight = 0; }
        this.el_display.style.height = availableHeight + 'px';

        // Sidebar width and height (example: 25% of width, same height as display)
        // This needs to be coordinated with CSS or made configurable
        const sidebarWidth = Math.floor(newWidth * 0.25);
        if (this.sidebar.style.display !== 'none') { // Only if sidebar is visible
            this.sidebar.style.width = sidebarWidth + 'px';
            this.sidebar.style.height = availableHeight + 'px'; // Match display height
            this.el_display.style.width = (newWidth - sidebarWidth) + 'px';
        } else {
            this.el_display.style.width = newWidth + 'px';
        }


        if (this.display && typeof (this.display as any).scroll === 'function' && force !== true) {
             (this.display as any).scroll();
        }

        if (this.scrollButton) { // Position scroll button relative to input area
            this.scrollButton.style.bottom = (this._input ? this._input.offsetHeight : 0) + 5 + 'px'; // 5px margin
        }

        if (showSize !== false && this.display && typeof (this.display as any).showSize === 'function') {
            (this.display as any).showSize(); // showSize method to be ported/ensured on display plugin
        }
        this._resizeToolbar(); // Toolbar might need to adjust its items
        this._resizeTray();    // Tray icons might need readjustment
    }


    public resizeScreenFromEvent(reason: string, event?: UIEvent): void {
        this.decaf.debugString('resizeScreenFromEvent due to: ' + reason, 'info');
        if (this.goFullOnResize && !this.isFullscreen()) {
            this.enter_fs(false);
        } else {
            this.resizeScreen(false, true); // showSize=false, force=true
        }
    }


    public addIcon(text: string, html: string, clss: string, onclick?: (e: Event) => void, onkey?: (e: KeyboardEvent) => void): number {
        const ico = document.createElement('div');
        ico.className = 'decafmud status-icon ' + clss + (onclick ? ' icon-click' : '');
        ico.innerHTML = html;
        ico.setAttribute('title', text);
        ico.setAttribute('role', 'status');
        ico.setAttribute('aria-label', text);

        if (onclick || onkey) { ico.setAttribute('tabIndex', '0'); }

        const ind = this.icons.push([ico, onclick, onkey]) - 1;

        this.icons.forEach((iconArr, i) => {
            // Position from right to left
            iconArr[0].style.right = (((this.icons.length - 1) - i) * 21) + 'px';
        });

        this.tray.appendChild(ico);

        if (onclick) { hookEvent(ico, 'click', (e) => onclick.call(this, e)); }
        if (onclick && !onkey) { hookEvent(ico, 'keydown', (e) => { if ((e as KeyboardEvent).keyCode !== 13) return; onclick.call(this, e); });}
        if (onkey) { hookEvent(ico, 'keydown', (e) => onkey.call(this, e as KeyboardEvent)); }

        this._resizeTray();
        return ind;
     }

    public delIcon(id: number): boolean {
        if (!this.icons[id]) return false;
        const ico = this.icons[id][0];
        if (ico.parentNode) {
            ico.parentNode.removeChild(ico);
        }
        // To keep other icon indices stable, we can nullify or use a marker
        // Or, shift and update indices, which is more complex.
        // For simplicity, let's replace with a null marker and filter out in _resizeTray or when iterating.
        // However, the original likely just removed and re-indexed.
        // Given the original code's direct manipulation, let's splice and re-calculate positions.
        this.icons.splice(id, 1);
        this._resizeTray(); // Re-position remaining icons
        return true;
    }

    public updateIcon(id: number, text?: string, html?: string, clss?: string): boolean {
        if (!this.icons[id]) return false;
        const ico = this.icons[id][0];

        if (text !== undefined) {
            ico.setAttribute('title', text);
            ico.setAttribute('aria-label', text);
        }
        if (html !== undefined) {
            ico.innerHTML = html;
        }
        if (clss !== undefined) {
            // Reset classes carefully: remove old icon-specific classes, keep base 'decafmud status-icon'
            const baseClasses = 'decafmud status-icon';
            const clickClass = ico.classList.contains('icon-click') ? ' icon-click' : '';
            ico.className = baseClasses + clickClass + ' ' + clss;
        }
        // onclick and onkey are not updated by this function in original design
        this._resizeTray(); // Class change might affect size/padding
        return true;
    }

    private _resizeTray(): void {
        const iconWidth = 21; // Assumed width of an icon + margin
        let currentRight = 0;
        for (let i = 0; i < this.icons.length; i++) {
            const iconElement = this.icons[i][0];
            if (iconElement) { // Check if icon exists (if using null markers for deletion)
                iconElement.style.right = currentRight + 'px';
                currentRight += (iconElement.offsetWidth || iconWidth); // Use actual or assumed width
            }
        }
        // Adjust input padding to prevent overlap with icons
        if (this.input instanceof HTMLElement) {
            this.input.style.paddingRight = currentRight + 'px';
        }
    }

    public showScrollButton(show: boolean = true): void {
        if (!this.scrollButton) {
            this.scrollButton = document.createElement('button');
            this.scrollButton.className = 'decafmud scrollbutton';
            this.scrollButton.innerHTML = '&darr;'; // Down arrow, can be styled with CSS
            this.scrollButton.title = tr.call(this, 'Scroll to bottom');
            this.scrollButton.onclick = () => {
                if (this.display && typeof (this.display as any).scroll === 'function') {
                    (this.display as any).scroll(true); // Force scroll to bottom
                }
                (this.input as HTMLElement).focus();
            };
            // Position it; initial position might be off-screen until first resize
            this.scrollButton.style.position = 'absolute';
            this.scrollButton.style.right = '5px'; // Example positioning
             this.container.insertBefore(this.scrollButton, this._input); // Insert before input container
        }
        this.scrollButton.style.display = show ? '' : 'none';
        this.resizeScreen(false, true); // Update positioning
    }

    public hideScrollButton(): void {
        this.showScrollButton(false);
    }


    public toggle_menu(index: number, event?: Event): void { // Made event optional
        const menuDef = toolbarMenus[index];
        if (!menuDef) return;

        const menuId = "sub" + menuDef.id;
        let menuElement = document.getElementById(menuId);

        if (!menuElement) {
            // Create and append submenu if it doesn't exist
            menuElement = document.createElement('ul');
            menuElement.id = menuId;
            menuElement.className = 'submenu';
            // Find the corresponding top-level menu button to append to
            const topMenuButton = document.getElementById(menuDef.id);

            if (topMenuButton) {
                 // Position submenu (basic example, needs refinement)
                // const rect = topMenuButton.getBoundingClientRect(); // window-relative
                // const parentRect = this.toolbar.getBoundingClientRect(); // Get toolbar's position
                menuElement.style.position = 'absolute';
                menuElement.style.top = (topMenuButton.offsetTop + topMenuButton.offsetHeight) + 'px';
                menuElement.style.left = topMenuButton.offsetLeft + 'px';
                menuElement.style.zIndex = "1001"; // Ensure it's on top of toolbar buttons

                this.toolbar.appendChild(menuElement); // Append to toolbar for correct relative positioning
            } else {
                this.toolbar.appendChild(menuElement); // Fallback append to toolbar
                menuElement.style.position = 'absolute';
                menuElement.style.top = this.toolbar.offsetHeight + 'px';
                menuElement.style.left = '0px'; // Default to left
                menuElement.style.zIndex = "1001";
            }

            menuDef.items.forEach(item => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = "javascript:void(0);"; // Avoid page jump
                a.innerText = item.name;
                if(item.id) a.id = item.id;

                a.onclick = (ev: MouseEvent) => {
                    ev.stopPropagation();
                    this.executeMenuAction(item.action);
                    this.close_menus();
                };
                li.appendChild(a);
                menuElement.appendChild(li);
            });
        }

        if (this.open_menu === index && menuElement.style.visibility === 'visible') {
            menuElement.style.visibility = 'hidden';
            this.open_menu = -1;
            (this.input as HTMLElement).focus();
        } else {
            this.close_menus();
            menuElement.style.visibility = 'visible';
            this.open_menu = index;
            const firstLink = menuElement.querySelector('a');
            if (firstLink) firstLink.focus();
        }
        if(event) cancelEvent(event);
    }

    public close_menus(): void {
        toolbarMenus.forEach(menuDef => {
            const menuElement = document.getElementById("sub" + menuDef.id);
            if (menuElement) {
                menuElement.style.visibility = 'hidden';
            }
        });
        this.open_menu = -1;
    }

    private executeMenuAction(actionString: string): void {
        try {
            if (actionString.startsWith("this.")) {
                const methodName = actionString.replace("this.", "").replace("()", "").split(";")[0].trim();
                if (typeof (this as any)[methodName] === 'function') {
                    (this as any)[methodName]();
                } else {
                    this.decaf.debugString(`Method '${methodName}' not found on PanelsInterface for action '${actionString}'.`, "warn");
                }
            } else {
                // Attempt to call as a global function.
                // This is a simplified approach. For more complex global calls or namespaced functions,
                // a more robust solution (e.g., function registry or safer eval) might be needed.
                const functionName = actionString.replace("()", "").split(";")[0].trim();
                if (typeof (window as any)[functionName] === 'function') {
                    (window as any)[functionName]();
                } else {
                    this.decaf.debugString(`Global function '${functionName}' not found for action '${actionString}'. Trying eval.`, "warn");
                    // Fallback to eval if it's a more complex statement, but use with caution.
                    // This is potentially unsafe if action strings can be user-supplied without sanitization.
                    // Given these are dev-defined menu actions, risk is lower but present.
                    try {
                        eval(actionString);
                    } catch (e: any) {
                         this.decaf.error(`Error evaluating menu action '${actionString}': ${e.message}`);
                    }
                }
            }
        } catch (err: any) {
            this.decaf.error(`Error executing menu action '${actionString}': ${err.message}`);
        }
    }


    // Popup Management
    private maxPopupHeight(): number {
        let tot = this.container.offsetHeight - (this._input.offsetHeight + 50);
        if (this.toolbarPadding) { tot = tot - (this.toolbarPadding - 12); }
        return Math.max(0, tot);
    }

    private maxPopupWidth(): number {
        return Math.max(0, this.container.offsetWidth - 12); // for potential scrollbar
    }

    private verticalPopupOffset(): number { return 50; }
    private horizontalPopupOffset(): number { return 0; }

    public hidePopup(): void {
        if (!this.popup) return;
        if (this.headerdrag) this.headerdrag.StopListening(true); // Dispose or stop listening
        if (this.popup.parentNode) {
            this.popup.parentNode.removeChild(this.popup);
        }
        this.popup = undefined;
        this.popupheader = undefined;
        this.headerdrag = undefined;
        (this.input as HTMLElement).focus();
    }

    public showPopup(): HTMLElement {
        if (this.popup) this.hidePopup(); // Clear existing popup first

        this.popup = document.createElement("div");

        const w = this.maxPopupWidth() * 0.6; // 60% of max width
        const h = this.maxPopupHeight() * 0.7; // 70% of max height
        const t = this.verticalPopupOffset();
        let l = this.horizontalPopupOffset();
        l += (this.maxPopupWidth() * 0.2); // Centered horizontally (20% margin on left)

        this.popup.style.width = w + "px";
        this.popup.style.height = h + "px";
        this.popup.style.top = t + "px";
        this.popup.style.left = l + "px";
        this.popup.className = 'decafmud window'; // Add 'popup' class for specific styling if needed
        this.popup.id = "decafmud_popup_window"; // Unique ID
        this.popup.style.position = 'absolute'; // Ensure it's positioned relative to container or body
        this.popup.style.zIndex = "1002"; // Above menus

        this.container.insertBefore(this.popup, this.el_display);

        this.popupheader = document.createElement("div");
        this.popupheader.style.width = "100%"; // Relative to popup width
        this.popupheader.style.height = "25px"; // Fixed header height
        this.popupheader.style.top = "0px";
        this.popupheader.style.left = "0px";
        this.popupheader.className = 'decafmud window-header';
        this.popupheader.id = "decafmud_popup_header";
        this.popup.appendChild(this.popupheader);

        try {
            this.headerdrag = new DragObject(this.popup, this.popupheader);
        } catch (e: any) {
            this.decaf.error("Failed to initialize DragObject for popup: " + e.message);
        }


        const x = document.createElement('button');
        x.innerHTML = '<big>X</big>';
        x.className = 'closebutton'; // Style this appropriately
        x.style.position = 'absolute';
        x.style.top = '0px';
        x.style.right = '0px';
        x.onclick = () => { this.hidePopup(); };
        this.popup.appendChild(x);

        hookEvent(this.popup, 'mousedown', (e: Event) => {
            if ((e as MouseEvent).which === 1 && this.open_menu !== -1) {
                this.close_menus();
            }
        });
        return this.popup;
    }

    public popupHeader(text: string): void {
        if (!this.popup) return;
        const p = document.createElement("p");
        p.innerHTML = text;
        p.className = "headertext"; // Style this for centering/padding
        p.style.textAlign = "center";
        p.style.margin = "0";
        p.style.padding = "2px";
        if(this.popupheader) {
            this.popupheader.innerHTML = ''; // Clear previous header content
            this.popupheader.appendChild(p);
        }
    }

    public buttonLine(parent: HTMLElement): HTMLParagraphElement {
        const buttonline = document.createElement("p");
        buttonline.style.textAlign = "center";
        buttonline.style.marginTop = "10px"; // Add some spacing
        parent.appendChild(buttonline);
        return buttonline;
    }

    public createButton(caption: string, func: (() => void) | string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "prettybutton"; // Style this
        btn.innerHTML = `<big>${caption}</big>`;
        if (typeof func === 'string') {
            // Avoid eval. This requires actions to be mapped to methods or a registry.
            // For now, we'll log a warning if a string is passed.
            this.decaf.debugString(`String action for button '${caption}' needs proper handling: ${func}`, "warn");
            btn.onclick = () => console.warn(`Action for '${caption}' not implemented: ${func}`);
        } else {
            btn.onclick = func;
        }
        return btn;
    }

    public addCloseButton(parent: HTMLElement): void {
        const closeBtn = this.createButton("Close", () => this.hidePopup());
        parent.appendChild(closeBtn);
    }

    public popupTextarea(name: string, adjustHeight: number = 0): HTMLTextAreaElement {
        if (!this.popup) throw new Error("Popup not shown before adding textarea.");
        const w = parseFloat(this.popup.style.width || "0") - 30; // Account for padding/borders
        const h = parseFloat(this.popup.style.height || "0") - (this.popupheader?.offsetHeight || 25) - 60 - adjustHeight; // Header, buttons, padding

        const textarea = document.createElement("textarea");
        textarea.id = name;
        textarea.style.width = Math.max(50, w) + "px";
        textarea.style.height = Math.max(20, h) + "px";
        textarea.style.margin = "5px auto";
        textarea.style.display = "block";
        this.popup.appendChild(textarea);
        textarea.focus();
        return textarea;
    }

    public popupTextdiv(): HTMLDivElement {
        if (!this.popup) throw new Error("Popup not shown before adding textdiv.");
        const w = parseFloat(this.popup.style.width || "0") - 20;
        const h = parseFloat(this.popup.style.height || "0") - (this.popupheader?.offsetHeight || 25) - 40;

        const div = document.createElement("div");
        div.style.width = Math.max(50, w) + "px";
        div.style.height = Math.max(20, h) + "px";
        div.style.margin = "5px auto";
        div.style.display = "block";
        div.style.overflowY = "auto";
        div.style.border = "1px solid #ccc"; // Basic styling
        div.style.padding = "5px";
        this.popup.appendChild(div);
        return div;
    }
}

// Make it known to DecafMUD (this would typically be in decafmud.ts)
// (DecafMUD as any).plugins.Interface.panels = PanelsInterface;
// This would typically be done in decafmud.ts, but for standalone development:
// if (typeof DecafMUD !== 'undefined' && DecafMUD.plugins) {
//     DecafMUD.plugins.Interface.panels = PanelsInterface;
// }
