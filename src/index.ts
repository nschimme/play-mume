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

import '../play.scss';
import $ from 'jquery';
import Split from 'split.js';

import 'script-loader!../DecafMUD/src/js/decafmud.js';
import 'script-loader!../DecafMUD/src/js/inflate_stream.min.js';
import 'script-loader!../DecafMUD/src/js/decafmud.display.standard.js';
import 'script-loader!../DecafMUD/src/js/decafmud.encoding.iso885915.js';
import 'script-loader!../DecafMUD/src/js/decafmud.socket.websocket.js';
import 'script-loader!../DecafMUD/src/js/decafmud.storage.standard.js';
import 'script-loader!../DecafMUD/src/js/decafmud.telopt.gmcp.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.menu.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.settings.js';
import 'script-loader!../DecafMUD/src/js/dragelement.js';

import { throttle } from './utils';
import './errorhandler';
import './mume.macros';
import './mume.menu';
import { MumeMap } from './mume.mapper';
import { UIManager } from './mume.ui';

let globalMapWindow: Window | null | undefined;
let _globalSplit: Split.Instance | undefined;
let globalMap: MumeMap | undefined;
let uiManager: UIManager | undefined;

function canvasFitParent(): void {
  if (globalMapWindow != undefined && $('#mume-map-panel').width()! >= 1) {
    globalMapWindow.close();
    globalMapWindow = null;
  }

  if (globalMap != undefined && globalMap.display) {
    globalMap.display.fitParent();
  }
}

$(window).on('load', function () {
  if (typeof DecafMUD === 'undefined' || !DecafMUD.plugins?.TextInputFilter) {
    console.error('DecafMUD or DecafMUD.plugins.TextInputFilter is not loaded!');
    return;
  }

  uiManager = new UIManager({
    onCanvasFit: canvasFitParent,
  });
  uiManager.init();

  new DecafMUD({
    host: 'mume.org',
    port: 443,
    autoreconnect: false,
    autoconnect: true,
    set_socket: {
      wsport: 443,
      wspath: 'ws-play/',
      ssl: true,
    },
    interface: 'panels',
    set_interface: {
      container: '#mume-client',
      connect_hint: false,
      repeat_input: false,
      start_full: false,
    },
    language: 'en',
    socket: 'websocket',
  });

  _globalSplit = Split(['#mume-client-panel', '#mume-map-panel'], {
    sizes: [80, 20],
    cursor: 'col-resize',
    snapOffset: 100,
    minSize: 0,
    elementStyle: function (dimension: string, size: number, gutterSize: number) {
      return {
        'flex-basis': 'calc(' + size + '% - ' + gutterSize + 'px)',
      };
    },
    gutterStyle: function (dimension: string, gutterSize: number) {
      return {
        'flex-basis': gutterSize + 'px',
      };
    },
    onDragEnd: canvasFitParent,
  });

  // Periodically check connection status for badge
  setInterval(() => {
    if (DecafMUD.instances && DecafMUD.instances[0]) {
      const isConnected = !!DecafMUD.instances[0].socket?.connected;
      uiManager?.updateConnectionStatus(isConnected);
    }
  }, 1000);

  MumeMap.load('mume-map').done(function (map: MumeMap) {
    if (DecafMUD.instances && DecafMUD.instances[0]) {
      const decafInstance = DecafMUD.instances[0];

      // Register GMCP module handlers using DecafMUD GMCP plugin methods
      if (decafInstance.gmcp) {
        const gmcp = decafInstance.gmcp;
        const sendSupportsAdd = (gmcpObj: GMCPPlugin) => {
          if (typeof gmcpObj.sendGMCP === 'function' && decafInstance.socket?.connected) {
            try {
              gmcpObj.sendGMCP('Core.Supports.Add', ['Char 1', 'Room 1', 'Event 1']);
            } catch (err) {
              console.warn('Failed to send GMCP Core.Supports.Add:', err);
            }
          }
        };

        const originalWill = gmcp._will;
        gmcp._will = function (...args: unknown[]) {
          if (typeof originalWill === 'function') {
            originalWill.apply(this, args);
          }
          sendSupportsAdd(this as GMCPPlugin);
        };

        // If GMCP option negotiation already completed before MumeMap loaded and socket is connected, send immediately
        if (decafInstance.socket?.connected) {
          sendSupportsAdd(gmcp);
        }

        if (typeof gmcp.registerHandler === 'function') {
          gmcp.registerHandler('Room.Info', (data: unknown) => {
            console.log('GMCP Room.Info handler received:', data);
            if (map && map.pathMachine) {
              map.pathMachine.processGmcpRoomInfo(data as GMCPRoomInfoData);
            }
          });

          gmcp.registerHandler('Event.Moved', (data: unknown) => {
            console.log('GMCP Event.Moved handler received:', data);
            if (map && map.pathMachine) {
              map.pathMachine.processGmcpEventMoved(data as GMCPEventMovedData);
            }
          });
        }
      }
    } else {
      console.error('DecafMUD instance not found for map integration.');
      throw new Error('DecafMUD instance not found.');
    }

    globalMap = map;

    $(window).on('resize', throttle(canvasFitParent, 500));
    canvasFitParent();

    const mumeClientPanel = $('#mume-client-panel');
    function handleSizeChange() {
      const isWide = mumeClientPanel.width()! > 600;
      $('.decafmud.display.c7').css('white-space', isWide ? 'nowrap' : 'normal');
    }

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(handleSizeChange).observe(mumeClientPanel[0]);
    } else {
        console.warn('ResizeObserver not supported. Some UI elements might not adjust correctly.');
    }
    handleSizeChange();
  }).fail(function(error: unknown) {
    console.error("Failed to load MumeMap:", error);
    $('#mume-map').html('<p style="color:#aaa;text-align:center;padding-top:20px;">Map unable to load. Please refresh to try again.</p>');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function (registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(function (error) {
      console.log('ServiceWorker registration failed: ', error);
    });
  }
});

$(window).on('pagehide', function () {
  if (globalMapWindow != undefined) {
    globalMapWindow.close();
  }
});

export {};
