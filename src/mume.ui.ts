/*  Play MUME!, a modern web client for MUME using DecafMUD.
    Copyright (C) 2017, Waba.

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

import $ from 'jquery';

export type MapMode = 'auto' | 'overlay' | 'split' | 'map-only' | 'detached' | 'hidden';

export interface UIManagerOptions {
  onCanvasFit?: () => void;
  onMapModeChange?: (mode: MapMode) => void;
}

export class UIManager {
  private currentModeSetting: MapMode = 'auto';
  private activeEffectiveMode: 'split' | 'overlay' | 'map-only' | 'detached' | 'hidden' = 'split';
  private opacity: number = 0.85;
  private offsetPercent: number = 15; // Positive = Right offset, Negative = Left offset
  private onCanvasFit?: () => void;
  private onMapModeChange?: (mode: MapMode) => void;

  constructor(options?: UIManagerOptions) {
    this.onCanvasFit = options?.onCanvasFit;
    this.onMapModeChange = options?.onMapModeChange;

    const savedMode = localStorage.getItem('mume_map_mode') as MapMode | null;
    if (savedMode && ['auto', 'overlay', 'split', 'map-only', 'detached', 'hidden'].includes(savedMode)) {
      this.currentModeSetting = savedMode;
    }

    const savedOpacity = localStorage.getItem('mume_map_opacity');
    if (savedOpacity) {
      const parsed = parseFloat(savedOpacity);
      if (!isNaN(parsed) && parsed >= 0.2 && parsed <= 1.0) {
        this.opacity = parsed;
      }
    }

    const savedOffset = localStorage.getItem('mume_map_offset_percent');
    if (savedOffset) {
      const parsed = parseInt(savedOffset, 10);
      if (!isNaN(parsed) && parsed >= -50 && parsed <= 50) {
        this.offsetPercent = parsed;
      }
    }
  }

  public init(): void {
    this.createHeaderAndDrawer();
    this.updateLayoutState();
    this.applyOpacity();
    this.applyOffset();
    this.checkNewcomerBanner();
    this.checkConstrainedViewportBanner();
    this.bindEvents();
    this.startDetachedWindowMonitor();

    window.showPersistentPopup = (message: string, title?: string) => {
      this.showPersistentPopup(message, title);
    };

    window.alert = (message?: unknown) => {
      this.showPersistentPopup(String(message ?? ''));
    };
  }

  private startDetachedWindowMonitor(): void {
    setInterval(() => {
      if (this.currentModeSetting === 'detached') {
        if (!window.globalMapWindow || window.globalMapWindow.closed) {
          window.globalMapWindow = null;
          this.setMapMode('auto');
        }
      }
    }, 1000);
  }

  public getEffectiveMode(): 'split' | 'overlay' | 'map-only' | 'detached' | 'hidden' {
    return this.activeEffectiveMode;
  }

  public getModeSetting(): MapMode {
    return this.currentModeSetting;
  }

  public setMapMode(mode: MapMode): void {
    const prevMode = this.currentModeSetting;
    this.currentModeSetting = mode;
    localStorage.setItem('mume_map_mode', mode);

    if (mode === 'detached') {
      if (window.open_mume_map_window) {
        window.open_mume_map_window();
      }
    } else if (prevMode === 'detached' && window.globalMapWindow && !window.globalMapWindow.closed) {
      window.globalMapWindow.close();
      window.globalMapWindow = null;
    }

    this.updateLayoutState();
    if (this.onMapModeChange) {
      this.onMapModeChange(mode);
    }
  }

  public setOpacity(opacity: number): void {
    this.opacity = Math.max(0.2, Math.min(1.0, opacity));
    localStorage.setItem('mume_map_opacity', this.opacity.toString());
    this.applyOpacity();
  }

  public setOffsetPercent(percent: number): void {
    this.offsetPercent = Math.max(-50, Math.min(50, percent));
    localStorage.setItem('mume_map_offset_percent', this.offsetPercent.toString());
    this.applyOffset();
  }

  private updateLayoutState(): void {
    const isNarrow = window.innerWidth <= 768;
    let effective: 'split' | 'overlay' | 'map-only' | 'detached' | 'hidden';

    if (this.currentModeSetting === 'auto') {
      effective = isNarrow ? 'overlay' : 'split';
    } else {
      effective = this.currentModeSetting;
    }

    this.activeEffectiveMode = effective;
    const $app = $('#mume-app');

    $app.removeClass('mode-split mode-overlay mode-map-only mode-detached mode-hidden');
    $app.addClass(`mode-${effective}`);

    // Update active state in drawer buttons
    $('.mume-drawer-mode-btn').removeClass('active');
    $(`.mume-drawer-mode-btn[data-mode="${this.currentModeSetting}"]`).addClass('active');

    this.updateMapCenterOffset();
    this.notifyCanvasFit();

    // Trigger DecafMUD interface resize which handles TELOPT NAWS negotiations natively
    if (typeof DecafMUD !== 'undefined' && DecafMUD.instances && DecafMUD.instances[0]) {
      const decaf = DecafMUD.instances[0];
      if (decaf.ui?.resizeScreen) {
        decaf.ui.resizeScreen(false, true);
      }
    }
  }

  private applyOpacity(): void {
    document.documentElement.style.setProperty('--terminal-bg-opacity', this.opacity.toString());
    $('#mume-opacity-val').text(`${Math.round(this.opacity * 100)}%`);
    const $slider = $('#mume-opacity-slider');
    if ($slider.length) {
      ($slider[0] as HTMLInputElement).value = this.opacity.toString();
    }
  }

  private applyOffset(): void {
    const labelText = this.offsetPercent > 0 ? `+${this.offsetPercent}% (Right)` : (this.offsetPercent < 0 ? `${this.offsetPercent}% (Left)` : '0% (Center)');
    $('#mume-offset-val').text(labelText);

    const $slider = $('#mume-offset-slider');
    if ($slider.length) {
      ($slider[0] as HTMLInputElement).value = this.offsetPercent.toString();
    }

    this.updateMapCenterOffset();
    this.notifyCanvasFit();
  }

  public updateMapCenterOffset(): void {
    if (window.globalMap) {
      const activeOffset = this.activeEffectiveMode === 'overlay' ? this.offsetPercent : 0;
      if (window.globalMap.display) {
        window.globalMap.display.setCenterOffsetPercent(activeOffset);
      }
    }
  }

  private notifyCanvasFit(): void {
    if (this.onCanvasFit) {
      this.onCanvasFit();
      requestAnimationFrame(() => {
        if (this.onCanvasFit) this.onCanvasFit();
      });
    }
  }

  private createHeaderAndDrawer(): void {
    if ($('#mume-drawer').length > 0) return;

    const isTouchOrMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
    const detachedBtnHtml = isTouchOrMobile ? '' : '<button class="mume-btn mume-drawer-mode-btn" data-mode="detached">Detached</button>';

    const uiHtml = `
      <div id="mume-banner-container" class="mume-banner-container"></div>
      <div id="mume-drawer-overlay" class="mume-drawer-overlay"></div>
      <aside id="mume-drawer" class="mume-drawer" aria-hidden="true">
        <div class="mume-drawer-header">
          <h3>Menu & Settings</h3>
          <button id="mume-drawer-close" class="mume-btn mume-close-btn" aria-label="Close Menu">✕</button>
        </div>
        <div class="mume-drawer-content">
          <section class="mume-drawer-section">
            <h4>Map Display</h4>
            <div class="mume-mode-buttons">
              <button class="mume-btn mume-drawer-mode-btn" data-mode="auto">Auto</button>
              <button class="mume-btn mume-drawer-mode-btn" data-mode="overlay">Overlay</button>
              <button class="mume-btn mume-drawer-mode-btn" data-mode="split">Split View</button>
              ${detachedBtnHtml}
              <button class="mume-btn mume-drawer-mode-btn" data-mode="hidden">Hide Map</button>
            </div>

            <div class="mume-setting-row">
              <label for="mume-offset-slider">Overlay Offset: <span id="mume-offset-val">+15% (Right)</span></label>
              <input type="range" id="mume-offset-slider" min="-50" max="50" step="5" value="${this.offsetPercent}">
            </div>

            <div class="mume-setting-row">
              <label for="mume-opacity-slider">Terminal Transparency: <span id="mume-opacity-val">85%</span></label>
              <input type="range" id="mume-opacity-slider" min="0.2" max="1.0" step="0.05" value="${this.opacity}">
            </div>
          </section>

          <section class="mume-drawer-section">
            <h4>Terminal & Controls</h4>
            <div class="mume-action-grid">
              <button id="mume-btn-font" class="mume-btn">Font Size</button>
              <button id="mume-btn-macros" class="mume-btn">Macros</button>
              <button id="mume-btn-reconnect" class="mume-btn">Reconnect</button>
              <button id="mume-btn-clear" class="mume-btn">Clear Screen</button>
            </div>
          </section>

          <section class="mume-drawer-section">
            <h4>Guides & Links</h4>
            <ul class="mume-drawer-links">
              <li><a href="#" id="mume-link-new">🌱 New Player Guide</a></li>
              <li><a href="#" id="mume-link-help">📖 Command & Game Help</a></li>
              <li><a href="#" id="mume-link-rules">⚖️ Official MUME Rules</a></li>
              <li><a href="#" id="mume-link-about-map">🗺️ About Mapper</a></li>
              <li><a href="#" id="mume-link-bug">🐛 Report Mapper Issue</a></li>
            </ul>
          </section>
        </div>
      </aside>
    `;

    $('body').prepend(uiHtml);

    // Attach bottom hamburger button into DecafMUD input-cont when present
    this.ensureBottomHamburgerButton();
  }

  private ensureBottomHamburgerButton(): void {
    if ($('#mume-hamburger-btn').length === 0) {
      const $inputCont = $('.decafmud.input-cont');
      if ($inputCont.length > 0) {
        $inputCont.append(`
          <button id="mume-hamburger-btn" class="mume-btn mume-icon-btn mume-bottom-hamburger" aria-label="Toggle Navigation Menu" title="Menu">
            <span class="mume-hamburger-icon">☰</span>
          </button>
        `);
      } else {
        setTimeout(() => this.ensureBottomHamburgerButton(), 200);
      }
    }
  }

  private bindEvents(): void {
    // Hamburger menu toggle
    $(document).on('click', '#mume-hamburger-btn, #mume-drawer-close, #mume-drawer-overlay', () => {
      this.toggleDrawer();
    });

    // Drawer mode buttons
    $('.mume-drawer-mode-btn').on('click', (e) => {
      const mode = $(e.currentTarget).attr('data-mode') as MapMode;
      if (mode) {
        this.setMapMode(mode);
      }
    });

    // Offset percent slider (-50 to +50)
    $('#mume-offset-slider').on('input change', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.setOffsetPercent(val);
    });

    // Opacity slider
    $('#mume-opacity-slider').on('input change', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.setOpacity(val);
    });

    // Drawer actions & links
    $('#mume-btn-font').on('click', () => {
      if (window.menu_font_size) window.menu_font_size();
      this.toggleDrawer(false);
    });

    $('#mume-btn-macros').on('click', () => {
      if (window.menu_macros) window.menu_macros();
      this.toggleDrawer(false);
    });

    $('#mume-btn-reconnect').on('click', () => {
      if (window.menu_reconnect) window.menu_reconnect();
      this.toggleDrawer(false);
    });

    $('#mume-btn-clear').on('click', () => {
      if (window.menu_history_flush) window.menu_history_flush();
      this.toggleDrawer(false);
    });

    $('#mume-link-new').on('click', (e) => {
      e.preventDefault();
      if (window.mume_menu_new) window.mume_menu_new();
      this.toggleDrawer(false);
    });

    $('#mume-link-help').on('click', (e) => {
      e.preventDefault();
      if (window.mume_menu_help) window.mume_menu_help();
      this.toggleDrawer(false);
    });

    $('#mume-link-rules').on('click', (e) => {
      e.preventDefault();
      if (window.mume_menu_rules) window.mume_menu_rules();
      this.toggleDrawer(false);
    });

    $('#mume-link-about-map').on('click', (e) => {
      e.preventDefault();
      if (window.mume_menu_about_map) window.mume_menu_about_map();
      this.toggleDrawer(false);
    });

    $('#mume-link-bug').on('click', (e) => {
      e.preventDefault();
      if (window.mume_menu_map_bug) window.mume_menu_map_bug();
      this.toggleDrawer(false);
    });

    // Window resize reaction
    $(window).on('resize', () => {
      this.updateLayoutState();
    });
  }

  public showPersistentPopup(message: string, title: string = 'Notification'): void {
    let $popupContainer = $('#mume-persistent-popups');
    if ($popupContainer.length === 0) {
      $popupContainer = $('<div id="mume-persistent-popups" class="mume-persistent-popups"></div>');
      $('body').append($popupContainer);
    }

    const popupId = 'mume-popup-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const formattedMessage = message.replace(/\n/g, '<br>');

    const popupHtml = `
      <div id="${popupId}" class="mume-popup-card">
        <div class="mume-popup-header">
          <span class="mume-popup-title">${title}</span>
          <button class="mume-popup-dismiss" aria-label="Dismiss">&times;</button>
        </div>
        <div class="mume-popup-body">${formattedMessage}</div>
      </div>
    `;

    const $popup = $(popupHtml);
    $popupContainer.append($popup);

    $popup.find('.mume-popup-dismiss').on('click', () => {
      $popup.fadeOut(200, () => $popup.remove());
    });
  }

  private getBannerContainer(): JQuery<HTMLElement> {
    let $container = $('#mume-banner-container');
    if ($container.length === 0) {
      $container = $('<div id="mume-banner-container" class="mume-banner-container"></div>');
      $('body').prepend($container);
    }
    return $container;
  }

  private checkNewcomerBanner(): void {
    const dismissed = localStorage.getItem('mume_newcomer_banner_dismissed');
    if (!dismissed) {
      if ($('#mume-newcomer-notice').length === 0) {
        const noticeHtml = `
          <div id="mume-newcomer-notice" class="mume-notice-banner">
            <div class="mume-notice-content">
              <span>👋 <strong>New to MUDs?</strong> MUME is a text-based multiplayer RPG. Type <code>NEW</code> in the terminal to create a character, or <code>?</code> for help!</span>
            </div>
            <button id="mume-dismiss-newcomer-notice" class="mume-btn mume-notice-dismiss" aria-label="Dismiss">✕</button>
          </div>
        `;
        this.getBannerContainer().append(noticeHtml);

        $('#mume-dismiss-newcomer-notice').on('click', () => {
          localStorage.setItem('mume_newcomer_banner_dismissed', '1');
          $('#mume-newcomer-notice').fadeOut(200, () => $('#mume-newcomer-notice').remove());
        });
      }
    }
  }

  private checkConstrainedViewportBanner(): void {
    const isTouchOrConstrained = ('ontouchstart' in window) || (window.innerWidth <= 768);
    const dismissed = localStorage.getItem('mume_keyboard_notice_dismissed');

    if (isTouchOrConstrained && !dismissed) {
      if ($('#mume-keyboard-notice').length === 0) {
        const noticeHtml = `
          <div id="mume-keyboard-notice" class="mume-notice-banner">
            <div class="mume-notice-content">
              <span>⌨️ <strong>Recommendation:</strong> For the best MUME playing experience on mobile or small screens, a physical keyboard is recommended.</span>
            </div>
            <button id="mume-dismiss-keyboard-notice" class="mume-btn mume-notice-dismiss" aria-label="Dismiss">✕</button>
          </div>
        `;
        this.getBannerContainer().append(noticeHtml);

        $('#mume-dismiss-keyboard-notice').on('click', () => {
          localStorage.setItem('mume_keyboard_notice_dismissed', '1');
          $('#mume-keyboard-notice').fadeOut(200, () => $('#mume-keyboard-notice').remove());
        });
      }
    }
  }

  private toggleDrawer(forceState?: boolean): void {
    const $drawer = $('#mume-drawer');
    const $overlay = $('#mume-drawer-overlay');
    const isOpen = forceState !== undefined ? forceState : !$drawer.hasClass('open');

    if (isOpen) {
      $drawer.addClass('open').attr('aria-hidden', 'false');
      $overlay.addClass('open');
    } else {
      $drawer.removeClass('open').attr('aria-hidden', 'true');
      $overlay.removeClass('open');
    }
  }
}
