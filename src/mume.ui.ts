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

export type MapMode = 'auto' | 'overlay' | 'split' | 'map-only' | 'hidden';
export type OffsetSide = 'left' | 'right';

export interface UIManagerOptions {
  onCanvasFit?: () => void;
  onMapModeChange?: (mode: MapMode) => void;
}

export class UIManager {
  private currentModeSetting: MapMode = 'auto';
  private activeEffectiveMode: 'split' | 'overlay' | 'map-only' | 'hidden' = 'split';
  private opacity: number = 0.85;
  private offsetSide: OffsetSide = 'right';
  private offsetPercent: number = 15;
  private onCanvasFit?: () => void;
  private onMapModeChange?: (mode: MapMode) => void;

  constructor(options?: UIManagerOptions) {
    this.onCanvasFit = options?.onCanvasFit;
    this.onMapModeChange = options?.onMapModeChange;

    const savedMode = localStorage.getItem('mume_map_mode') as MapMode | null;
    if (savedMode && ['auto', 'overlay', 'split', 'map-only', 'hidden'].includes(savedMode)) {
      this.currentModeSetting = savedMode;
    }

    const savedOpacity = localStorage.getItem('mume_map_opacity');
    if (savedOpacity) {
      const parsed = parseFloat(savedOpacity);
      if (!isNaN(parsed) && parsed >= 0.2 && parsed <= 1.0) {
        this.opacity = parsed;
      }
    }

    const savedSide = localStorage.getItem('mume_map_offset_side') as OffsetSide | null;
    if (savedSide && ['left', 'right'].includes(savedSide)) {
      this.offsetSide = savedSide;
    }

    const savedOffset = localStorage.getItem('mume_map_offset_percent');
    if (savedOffset) {
      const parsed = parseInt(savedOffset, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
        this.offsetPercent = parsed;
      }
    }
  }

  public init(): void {
    this.createHeaderAndDrawer();
    this.updateLayoutState();
    this.applyOpacity();
    this.applyOffset();
    this.bindEvents();
  }

  public getEffectiveMode(): 'split' | 'overlay' | 'map-only' | 'hidden' {
    return this.activeEffectiveMode;
  }

  public getModeSetting(): MapMode {
    return this.currentModeSetting;
  }

  public setMapMode(mode: MapMode): void {
    this.currentModeSetting = mode;
    localStorage.setItem('mume_map_mode', mode);
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

  public setOffsetSide(side: OffsetSide): void {
    this.offsetSide = side;
    localStorage.setItem('mume_map_offset_side', side);
    this.applyOffset();
  }

  public setOffsetPercent(percent: number): void {
    this.offsetPercent = Math.max(0, Math.min(50, percent));
    localStorage.setItem('mume_map_offset_percent', this.offsetPercent.toString());
    this.applyOffset();
  }

  private updateLayoutState(): void {
    const isNarrow = window.innerWidth <= 768;
    let effective: 'split' | 'overlay' | 'map-only' | 'hidden';

    if (this.currentModeSetting === 'auto') {
      effective = isNarrow ? 'overlay' : 'split';
    } else {
      effective = this.currentModeSetting;
    }

    this.activeEffectiveMode = effective;
    const $app = $('#mume-app');

    $app.removeClass('mode-split mode-overlay mode-map-only mode-hidden');
    $app.addClass(`mode-${effective}`);

    // Update active state in drawer buttons
    $('.mume-drawer-mode-btn').removeClass('active');
    $(`.mume-drawer-mode-btn[data-mode="${this.currentModeSetting}"]`).addClass('active');

    if (this.onCanvasFit) {
      this.onCanvasFit();
    }

    // Trigger DecafMUD interface resize to transmit Telnet NAWS (RFC 1073) window dimensions
    if (typeof DecafMUD !== 'undefined' && DecafMUD.instances && DecafMUD.instances[0] && DecafMUD.instances[0].ui) {
      DecafMUD.instances[0].ui?.resizeScreen?.(false, true);
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
    const leftVal = this.offsetSide === 'right' ? `${this.offsetPercent}%` : '0%';
    const rightVal = this.offsetSide === 'left' ? `${this.offsetPercent}%` : '0%';
    const widthVal = `${100 - this.offsetPercent}%`;

    document.documentElement.style.setProperty('--map-offset-left', leftVal);
    document.documentElement.style.setProperty('--map-offset-right', rightVal);
    document.documentElement.style.setProperty('--map-offset-width', widthVal);

    $('#mume-offset-val').text(`${this.offsetPercent}%`);
    const $slider = $('#mume-offset-slider');
    if ($slider.length) {
      ($slider[0] as HTMLInputElement).value = this.offsetPercent.toString();
    }

    $('.mume-offset-side-btn').removeClass('active');
    $(`.mume-offset-side-btn[data-side="${this.offsetSide}"]`).addClass('active');

    if (this.onCanvasFit) {
      this.onCanvasFit();
    }
  }

  private createHeaderAndDrawer(): void {
    if ($('#mume-header').length > 0) return;

    const headerHtml = `
      <header id="mume-header">
        <div class="mume-header-left">
          <span class="mume-brand">Play MUME!</span>
        </div>
        <div class="mume-header-right">
          <button id="mume-hamburger-btn" class="mume-btn mume-icon-btn" aria-label="Toggle Navigation Menu">
            <span class="mume-hamburger-icon">☰</span>
          </button>
        </div>
      </header>

      <div id="mume-drawer-overlay" class="mume-drawer-overlay"></div>
      <aside id="mume-drawer" class="mume-drawer" aria-hidden="true">
        <div class="mume-drawer-header">
          <h3>Menu & Settings</h3>
          <button id="mume-drawer-close" class="mume-btn mume-close-btn" aria-label="Close Menu">✕</button>
        </div>
        <div class="mume-drawer-content">
          <section class="mume-drawer-section">
            <h4>🗺️ Map View Settings</h4>
            <div class="mume-mode-buttons">
              <button class="mume-btn mume-drawer-mode-btn" data-mode="auto" title="Auto: Split on desktop, translucent overlay on mobile">Auto</button>
              <button class="mume-btn mume-drawer-mode-btn" data-mode="overlay" title="Terminal on top, map behind">Overlay</button>
              <button class="mume-btn mume-drawer-mode-btn" data-mode="split" title="Side-by-side split">Split View</button>
              <button class="mume-btn mume-drawer-mode-btn" data-mode="hidden" title="Terminal only">Hide Map</button>
            </div>

            <div class="mume-setting-row">
              <label>Overlay Map Offset Side:</label>
              <div class="mume-mode-buttons">
                <button class="mume-btn mume-offset-side-btn" data-side="right">Right</button>
                <button class="mume-btn mume-offset-side-btn" data-side="left">Left</button>
              </div>
            </div>

            <div class="mume-setting-row">
              <label for="mume-offset-slider">Overlay Map Offset (<span id="mume-offset-val">15%</span>):</label>
              <input type="range" id="mume-offset-slider" min="0" max="50" step="5" value="${this.offsetPercent}">
            </div>

            <div class="mume-setting-row">
              <label for="mume-opacity-slider">Terminal Opacity (<span id="mume-opacity-val">85%</span>):</label>
              <input type="range" id="mume-opacity-slider" min="0.2" max="1.0" step="0.05" value="${this.opacity}">
            </div>

            <div class="mume-setting-row">
              <button id="mume-detach-map-btn" class="mume-btn mume-full-btn">Detach Map Window</button>
            </div>
          </section>

          <section class="mume-drawer-section">
            <h4>⚙️ Client Controls</h4>
            <div class="mume-action-grid">
              <button id="mume-btn-font" class="mume-btn">Font Size</button>
              <button id="mume-btn-macros" class="mume-btn">Macros</button>
              <button id="mume-btn-reconnect" class="mume-btn">Reconnect</button>
              <button id="mume-btn-clear" class="mume-btn">Clear Screen</button>
            </div>
          </section>

          <section class="mume-drawer-section">
            <h4>📚 Guides & Info</h4>
            <ul class="mume-drawer-links">
              <li><a href="#" id="mume-link-new">New to MUME?</a></li>
              <li><a href="#" id="mume-link-help">MUME Help</a></li>
              <li><a href="#" id="mume-link-rules">MUME Rules</a></li>
              <li><a href="#" id="mume-link-about-map">About Map</a></li>
              <li><a href="#" id="mume-link-bug">Report Mapper Bug</a></li>
            </ul>
          </section>
        </div>
      </aside>
    `;

    $('body').prepend(headerHtml);
  }

  private bindEvents(): void {
    // Hamburger menu toggle
    $('#mume-hamburger-btn, #mume-drawer-close, #mume-drawer-overlay').on('click', () => {
      this.toggleDrawer();
    });

    // Drawer mode buttons
    $('.mume-drawer-mode-btn').on('click', (e) => {
      const mode = $(e.currentTarget).attr('data-mode') as MapMode;
      if (mode) {
        this.setMapMode(mode);
      }
    });

    // Offset side buttons
    $('.mume-offset-side-btn').on('click', (e) => {
      const side = $(e.currentTarget).attr('data-side') as OffsetSide;
      if (side) {
        this.setOffsetSide(side);
      }
    });

    // Offset percent slider
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
    $('#mume-detach-map-btn').on('click', () => {
      if (window.open_mume_map_window) window.open_mume_map_window();
      this.toggleDrawer(false);
    });

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
