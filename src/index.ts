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

import { DecafMUD } from '../decafmud-ts/decafmud';
import { standardDisplayPlugin } from '../decafmud-ts/plugins/display.standard';
import { iso885915EncodingPlugin } from '../decafmud-ts/plugins/encoding.iso885915';
import { panelsInterfacePlugin } from '../decafmud-ts/plugins/interface.panels';
import { panelsMenuPlugin } from '../decafmud-ts/plugins/interface.panels.menu';
import { panelsSettingsPlugin } from '../decafmud-ts/plugins/interface.panels.settings';
import { websocketPlugin } from '../decafmud-ts/plugins/websocket';
import { standardStoragePlugin } from '../decafmud-ts/plugins/storage.standard';
import { gmcpPlugin } from '../decafmud-ts/plugins/telopt.gmcp';

import { throttle } from './utils';
import './errorhandler';
import './mume.macros';
import './mume.menu';
import { MumeMap, MumeXmlParser } from './mume.mapper';

let globalMapWindow: Window | null | undefined;
let _globalSplit: Split.Instance | undefined;
let globalMap: MumeMap | undefined;

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
  const decaf = new DecafMUD({
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
    textinputfilter: 'mumexml',
    socket: 'websocket',
    plugins: [
        standardDisplayPlugin,
        iso885915EncodingPlugin,
        panelsInterfacePlugin,
        panelsMenuPlugin,
        panelsSettingsPlugin,
        websocketPlugin,
        standardStoragePlugin,
        gmcpPlugin,
    ]
  });

  decaf.registerTextInputFilter('mumexml', MumeXmlParser);

  if (typeof (window as { toggle_numpad?: (val: boolean) => void }).toggle_numpad === 'function') {
    (window as { toggle_numpad?: (val: boolean) => void }).toggle_numpad(true);
  }

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

  MumeMap.load('mume-map').done(function (map: MumeMap) {
    let parser: MumeXmlParser;
    let tagEventHandler;

    if (decaf.textInputFilter) {
      parser = decaf.textInputFilter as MumeXmlParser;
      if (!parser || typeof parser.filterInputText !== 'function') {
         console.error("Bug: expected to find a MumeXmlParser instance.");
         throw new Error("MumeXmlParser not found or invalid.");
      }

      tagEventHandler = map.processTag.bind(map);
      $(parser).on(MumeXmlParser.SIG_TAG_END, tagEventHandler);
      console.log('The map widget will now receive parsing events');
    } else {
      console.error('DecafMUD instance or textInputFilter not found for map integration.');
      throw new Error('DecafMUD instance or textInputFilter not found.');
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
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function (registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(function (error) {
      console.log('ServiceWorker registration failed: ', error);
    });
  }
});

$(window).on('unload', function () {
  if (globalMapWindow != undefined) {
    globalMapWindow.close();
  }
});

if (screen.availWidth < screen.availHeight) {
  alert(
    'It is not recommended to play MUME with a portrait orientation. ' +
    'If on a mobile device, consider playing in landscape mode with an external keyboard' +
    ' or on a desktop device for a better experience. ' +
    'If on a vertical monitor, consider "popping out" (Options > Detach Map) the map.'
  );
}

export {};
