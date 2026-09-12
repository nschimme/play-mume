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

import { DecafMUD, GMCPPlugin, GMCPRoomInfoData, GMCPEventMovedData } from '../DecafMUD/src/index';

import { throttle } from './utils';
import './errorhandler';
import './mume.macros';
import './mume.menu';
import { MumeMap } from './mume.mapper';
import { UIManager } from './mume.ui';

let _globalSplit: Split.Instance | undefined;
let globalMap: MumeMap | undefined;
let uiManager: UIManager | undefined;

function canvasFitParent(): void {
  if (window.globalMapWindow != undefined && $('#mume-map-panel').width()! >= 1) {
    window.globalMapWindow.close();
    window.globalMapWindow = null;
  }

  if (globalMap != undefined && globalMap.display) {
    globalMap.display.fitParent();
  }
}

$(window).on('load', function () {
  uiManager = new UIManager({
    onCanvasFit: canvasFitParent,
  });
  uiManager.init();

  const decafInstance = new DecafMUD({
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
    onDrag: function () {
      canvasFitParent();
      decafInstance.ui?.resizeScreen?.(false, true);
    },
    onDragEnd: canvasFitParent,
  });
  window.globalSplit = _globalSplit;

  MumeMap.load('mume-map')
    .done(function (map: MumeMap) {
      if (decafInstance.gmcp) {
        const gmcp = decafInstance.gmcp as GMCPPlugin;
        const sendSupportsAdd = () => {
          if (typeof gmcp.sendGMCP === 'function' && decafInstance.socket?.connected) {
            try {
              gmcp.sendGMCP('Core.Supports.Add', ['Char 1', 'Room 1', 'Event 1']);
            } catch (err) {
              console.warn('Failed to send GMCP Core.Supports.Add:', err);
            }
          }
        };

        decafInstance.on('connect', () => {
          sendSupportsAdd();
        });

        if (decafInstance.socket?.connected) {
          sendSupportsAdd();
        }

        if (typeof gmcp.registerHandler === 'function') {
          gmcp.registerHandler('Room.Info', (data: unknown) => {
            if (map && map.pathMachine) {
              map.pathMachine.processGmcpRoomInfo(data as GMCPRoomInfoData);
            }
          });

          gmcp.registerHandler('Event.Moved', (data: unknown) => {
            if (map && map.pathMachine) {
              map.pathMachine.processGmcpEventMoved(data as GMCPEventMovedData);
            }
          });
        }
      }

      globalMap = map;
      window.globalMap = map;

      $(window).on('resize', throttle(canvasFitParent, 500));
      canvasFitParent();

      const mumeClientPanel = $('#mume-client-panel');
      function handleSizeChange() {
        $('.decafmud.display.c7').css('white-space', 'pre-wrap');
        decafInstance.ui?.resizeScreen?.(false, true);
      }

      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(handleSizeChange).observe(mumeClientPanel[0]);
      } else {
        console.warn('ResizeObserver not supported. Some UI elements might not adjust correctly.');
      }
      handleSizeChange();
    })
    .fail(function (error: unknown) {
      console.error('Failed to load MumeMap:', error);
      $('#mume-map').html(
        '<p style="color:#aaa;text-align:center;padding-top:20px;">Map unable to load. Please refresh to try again.</p>'
      );
    });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('sw.js')
      .then(function (registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(function (error) {
        console.log('ServiceWorker registration failed: ', error);
      });
  }
});

$(window).on('pagehide', function () {
  if (window.globalMapWindow != undefined) {
    window.globalMapWindow.close();
  }
});

export {};
