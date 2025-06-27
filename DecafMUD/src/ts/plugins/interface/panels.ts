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
    public infobars: any[] = []; // Define more specific type later
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
        this.settings = { ...defaultClientSettings }; // Initialize with defaults

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
    // ... settings methods (set_fontsize, toggle_fkeys, etc.) ...
    // ... displayInput, localEcho, maybeFocusInput, displayKey, handleInputPassword, handleInput, handleBlur, updateInput ...

    // Example of a method to be ported
    public initSplash(percentage: number = 0, message?: string): void {
        if (message === undefined) { message = tr.call(this, 'Discombobulating interface recipient...'); }

        this.old_y = this.el_display.style.overflowY;
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

    public handleInput(e: KeyboardEvent): void {
        // Simplified for now, will port full logic
        if (e.keyCode === 13) { // Enter
             if (this.input instanceof HTMLInputElement || this.input instanceof HTMLTextAreaElement) {
                this.decaf.sendInput(this.input.value);
                this.input.value = '';
            }
        }
    }

    public handleBlur(e: FocusEvent): void {
        // Simplified
        this.inpFocus = (e.type === 'focus');
    }

    public reset(): void {
        this.masked = false;
        this.inputCtrl = false;
        this.hasFocus = false;
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
        // this.ico_connected = this.addIcon(tr.call(this, "You are currently disconnected."), '', 'connectivity disconnected'); // addIcon to be ported
    }

    // Dummy/Placeholder methods - to be implemented
    public menu_reconnect(): void { if (this.decaf) this.decaf.reconnect(); }
    public menu_log(style: string): void { if (this.decaf) this.decaf.debugString(`Logging action: ${style}`, "info"); }
    public menu_font_size(): void { if (this.decaf) this.decaf.debugString("Font size action", "info");  }
    public menu_macros(): void { if (this.decaf) this.decaf.debugString("Macros action", "info"); }
    public menu_history_flush(): void {
        if (this.display && (this.display as any).clear) {
             (this.display as any).clear(); // TODO: Ensure display plugin has clear method
        }
        if (this.decaf) this.decaf.debugString("History flushed", "info");
    }
    public menu_features(): void { if (this.decaf) this.decaf.debugString("Client features action", "info"); }
    public menu_about(): void { if (this.decaf) this.decaf.about(); }

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

    public _resizeToolbar(): boolean {
        let ret = false;
        // Ensure display leaves enough space for the toolbar
        if (this.display && this.el_display && this.toolbarPadding !== this.toolbar.clientHeight) {
            if (typeof (this.display as any).shouldScroll === 'function') {
                 (this.display as any).shouldScroll();
            }
            this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px';
            this.toolbarPadding = this.toolbar.clientHeight;
            this.resizeScreen(false, true); // Force resize of screen elements
             if (typeof (this.display as any).doScroll === 'function') {
                (this.display as any).doScroll();
            }
            ret = true;
        } else if (!this.display && this.el_display && this.toolbarPadding !== this.toolbar.clientHeight) {
            // Fallback if display object not fully initialized but el_display exists
            this.el_display.style.paddingTop = this.toolbar.clientHeight + 'px';
            this.toolbarPadding = this.toolbar.clientHeight;
            this.resizeScreen(false, true);
             ret = true;
        } else {
             this.toolbarPadding = this.toolbar.clientHeight;
        }
        // TODO: Port original logic for always-on and positioning based on tbar (toolbar-position)
        // For now, this primarily handles the paddingTop for the display.
        return ret;
    }

    public resizeScreen(showSize?: boolean, force?: boolean): void {
        if (force !== true && this.old_height === this.container.offsetHeight && this.old_width === this.container.offsetWidth) { return; }

        this.old_height = this.container.offsetHeight;
        this.old_width = this.container.offsetWidth;

        let tot = this.old_height - (this._input.offsetHeight + 17);
        if (this.toolbarPadding) { tot = tot - (this.toolbarPadding -12); }
        if (tot < 0) { tot = 0; }

        this.el_display.style.height = tot + 'px';

        if (this.display && typeof (this.display as any).scroll === 'function' && force !== true) {
             (this.display as any).scroll();
        }

        if (this.scrollButton) {
            this.scrollButton.style.bottom = (this._input.offsetHeight + 12) + 'px';
        }

        if (showSize !== false && this.display) {
            // this.showSize(); // showSize method to be ported
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
                    try {
                        const methodName = item.action.replace("this.", "").replace("()", "").split(";")[0].trim();
                        if (typeof (this as any)[methodName] === 'function') {
                            (this as any)[methodName]();
                        } else {
                            this.decaf.debugString(`Action '${item.action}' (method '${methodName}') not found on PanelsInterface.`, "warn");
                        }
                    } catch (err: any) {
                        this.decaf.error(`Error executing menu action '${item.action}': ${err.message}`);
                    }
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
