import '../play.scss';
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

import $ from 'jquery'; // Assuming jQuery will be installed as a module
// For Split.js, ensure it's installed via npm if not already, then import
import Split from 'split.js';
// For SparkMD5, ensure it's installed via npm, then import // Or: import * as SparkMD5 from 'spark-md5'; depending on its export structure

// Import DecafMUD related components. This is a placeholder and might need significant adjustment
// depending on how DecafMUD's JS files are structured (ES modules, UMD, or global scripts).
// If they are not modules, this part will fail and need a different strategy (e.g. ordered concatenation or specific loaders).
// For now, let's assume we can import the main DecafMUD object and other specific files if they export anything.
// This path and export needs verification // import { DecafMUD } from '../DecafMUD/src/js/decafmud';
// The following DecafMUD scripts might attach to the DecafMUD object directly or to jQuery.
// Their direct import might not be necessary if DecafMUD itself handles their registration when it's imported/run.
// This is a common pattern for older libraries with plugin architectures.
// We'll need to verify this. If they don't export modules, they might need to be concatenated or loaded sequentially.
import 'script-loader!../DecafMUD/src/js/decafmud.js'; // Main script for side effects (sets up global DecafMUD)
import 'script-loader!../DecafMUD/src/js/inflate_stream.min.js'; // Restored this line
import 'script-loader!../DecafMUD/src/js/decafmud.display.standard.js';
import 'script-loader!../DecafMUD/src/js/decafmud.encoding.iso885915.js';
import 'script-loader!../DecafMUD/src/js/decafmud.socket.websocket.js';
import 'script-loader!../DecafMUD/src/js/decafmud.storage.standard.js';
import 'script-loader!../DecafMUD/src/js/decafmud.telopt.gmcp.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.menu.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.js';
import 'script-loader!../DecafMUD/src/js/decafmud.interface.panels.settings.js';
import 'script-loader!../DecafMUD/src/js/dragelement.js';


// Import project's own TypeScript modules
import { throttle } from './utils';
import './errorhandler'; // Assuming errorhandler.js is compiled from a .ts file we want to include
import './mume.macros';  // Assuming mume.macros.js is compiled from a .ts file
import './mume.menu';    // Assuming mume.menu.js is compiled from a .ts file
import { MumeMap, MumeXmlParser } from './mume.mapper'; // Corrected import from mume.mapper

// Global variables that were in the original script
// We should try to avoid globals if possible, but let's mirror the existing structure first.
let globalMapWindow: Window | null | undefined; // Adjusted type
let _globalSplit: Split.Instance | undefined; // Correct type for Split.js instance
let globalMap: MumeMap | undefined;

// This function was global, now it's part of the module scope
function canvasFitParent(): void {
  if (globalMapWindow != undefined && $('#mume-map-panel').width()! >= 1) { // Added null check for width
    globalMapWindow.close();
    globalMapWindow = null;
  }

  if (globalMap != undefined && globalMap.display) { // Added check for display property
    globalMap.display.fitParent();
  }
}

$(window).on('load', function () {
  // const currentPort = window.location.protocol === 'https:' ? 443 : 80; // Unused
  // const currentHost = window.location.hostname; // Unused

  // Ensure DecafMUD is available. The import above should handle this.
  // If DecafMUD and its plugins are not proper modules, this is where issues will arise.
  if (typeof DecafMUD === 'undefined' || !DecafMUD.plugins?.TextInputFilter) {
    console.error('DecafMUD or DecafMUD.plugins.TextInputFilter is not loaded!');
    // Potentially load DecafMUD scripts dynamically here if they are not modules,
    // or ensure they are globally available due to non-module script tags handled by Webpack.
    // This might require adjusting webpack.config.js to copy and ensure order for non-module scripts.
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
    elementStyle: function (dimension: string, size: number, gutterSize: number) { // Added types
      return {
        'flex-basis': 'calc(' + size + '% - ' + gutterSize + 'px)',
      };
    },
    gutterStyle: function (dimension: string, gutterSize: number) { // Added types
      return {
        'flex-basis': gutterSize + 'px',
      };
    },
    onDragEnd: canvasFitParent,
  });

  MumeMap.load('mume-map').done(function (map: MumeMap) { // Added type for map
    let parser: MumeXmlParser; // Type correctly
    let tagEventHandler;

    if (DecafMUD.instances && DecafMUD.instances[0] && DecafMUD.instances[0].textInputFilter) {
      parser = DecafMUD.instances[0].textInputFilter as MumeXmlParser; // Type assertion
      // Original check: if ( !( parser.isMumeXmlParser ) )
      // We need to ensure isMumeXmlParser is a static property or use instanceof if MumeXmlParser is a class
      // For now, assuming the type assertion is sufficient if structure is correct.
      // A more robust check might be needed depending on MumeXmlParser's definition.
      if (!parser || typeof parser.filterInputText !== 'function') { // Example check
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
      const isWide = mumeClientPanel.width()! > 600; // Added null check
      $('.decafmud.display.c7').css('white-space', isWide ? 'nowrap' : 'normal');
    }

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(handleSizeChange).observe(mumeClientPanel[0]);
    } else {
        console.warn('ResizeObserver not supported. Some UI elements might not adjust correctly.');
        // Fallback or polyfill might be needed for older browser support for ResizeObserver
    }
    handleSizeChange();
  }).fail(function(error: unknown) { // Added error handling for MumeMap.load
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

// Original alert for screen orientation - this can remain as is, or be part of a UI component.
if (screen.availWidth < screen.availHeight) {
  alert(
    'It is not recommended to play MUME with a portrait orientation. ' +
    'If on a mobile device, consider playing in landscape mode with an external keyboard' +
    ' or on a desktop device for a better experience. ' +
    'If on a vertical monitor, consider "popping out" (Options > Detach Map) the map.'
  );
}

// Export something to make it a module, if nothing else.
export {};
