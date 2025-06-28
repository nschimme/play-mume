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
import '../DecafMUD/src/css/decafmud.css';
import $ from 'jquery';
import Split from 'split.js';

// Import the main DecafMUD class
import { DecafMUD } from '../DecafMUD/src/ts/decafmud'; // Adjusted path to submodule source

// The following script-loader imports are being removed as their functionalities
// should now be part of the main DecafMUD ES6 module or explicitly imported if necessary.
// import 'script-loader!../DecafMUD/src/js/decafmud.js'; // Core, replaced by ES6 import
// import 'script-loader!../DecafMUD/src/js/inflate_stream.min.js'; // Handled by pako import in DecafMUD
// import 'script-loader!../DecafMUD/src/js/decafmud.display.standard.js'; // Should be part of DecafMUD core plugins
// import 'script-loader!../DecafMUD/src/js/decafmud.encoding.iso885915.js'; // Should be part of DecafMUD core plugins
// import 'script-loader!../DecafMUD/src/js/decafmud.socket.websocket.js'; // Should be part of DecafMUD core plugins
// import 'script-loader!../DecafMUD/src/js/decafmud.storage.standard.js'; // Should be part of DecafMUD core plugins
// import 'script-loader!../DecafMUD/src/js/decafmud.telopt.gmcp.js'; // Should be part of DecafMUD core plugins

// These interface related scripts might need special handling or conversion to TS modules.
// For now, their direct loading is removed. Their functionality will be addressed in Step 4.
// import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.js';
// import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.menu.js';
// import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.settings.js';
// import 'script-loader!../DecafMUD/src/js/dragelement.js';


import { throttle } from './utils';
import './errorhandler';
import './mume.macros';
import './mume.menu';
import { MumeMap, MumeXmlParser } from './mume.mapper';
import { type SplitInstance } from 'split.js'; // Import the type

let globalMapWindow: Window | null | undefined;
let _globalSplit: SplitInstance | undefined; // Use the imported type
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
  if (typeof DecafMUD === 'undefined' || !DecafMUD.plugins?.TextInputFilter) {
    console.error('DecafMUD or DecafMUD.plugins.TextInputFilter is not loaded!');
    return;
  }

  DecafMUD.plugins.TextInputFilter.mumexml = MumeXmlParser;

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
    textinputfilter: 'mumexml',
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

  MumeMap.load('mume-map').done(function (map: MumeMap) {
    let parser: MumeXmlParser;
    let tagEventHandler;

    if (DecafMUD.instances && DecafMUD.instances[0] && DecafMUD.instances[0].textInputFilter) {
      parser = DecafMUD.instances[0].textInputFilter as MumeXmlParser;
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
