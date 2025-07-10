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
import { MumeMap, MumeXmlParser, MumeXmlParserTag } from './mume.mapper';
import { DecafMUDExternalPlugin } from './decafmud-plugin-api';

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

class MumePlayPlugin implements DecafMUDExternalPlugin {
  private xmlParser: MumeXmlParser;
  private decafMUD: DecafMUDInstance | null = null;

  constructor() {
    // The DecafMUD instance isn't available at construction time of the plugin object
    // if the plugin is instantiated before DecafMUD.
    // We'll get it during onConnect or rely on DecafMUD.instances[0] if needed sooner.
    this.xmlParser = new MumeXmlParser(this.getDecafMUDInstance.bind(this));

    // Forwarding events from MumeXmlParser to MumeMap
    $(this.xmlParser).on(MumeXmlParser.SIG_TAG_END, (_event: unknown, tag: MumeXmlParserTag) => {
      if (globalMap) {
        globalMap.processTag(_event, tag);
      }
    });
  }

  private getDecafMUDInstance(): DecafMUDInstance {
    if (this.decafMUD) {
      return this.decafMUD;
    }
    // This is a fallback if the plugin needs the instance before onConnect.
    // Assumes only one DecafMUD instance.
    if (typeof DecafMUD !== 'undefined' && DecafMUD.instances && DecafMUD.instances[0]) {
      return DecafMUD.instances[0];
    }
    throw new Error("DecafMUD instance not available to MumePlayPlugin.");
  }

  onConnect(): void {
    console.log("MumePlayPlugin: Connected to DecafMUD.");
    if (DecafMUD.instances && DecafMUD.instances[0]) {
      this.decafMUD = DecafMUD.instances[0];
    }
    this.xmlParser.connected();
  }

  onDisconnect(): void {
    console.log("MumePlayPlugin: Disconnected from DecafMUD.");
    this.xmlParser.clear(); // Reset XML parser state
  }

  onData(text: string): string {
    // Pass data through the XML parser
    // The MumeXmlParser.filterInputText will handle text accumulation and event emission.
    return this.xmlParser.filterInputText(text);
  }

  // The 'send' and 'sendGMCP' methods will be injected by DecafMUD itself.
  // We just declare them here to satisfy the interface for type-checking if we were to call them internally,
  // though typically they are for DecafMUD to provide to us.
  send?: (dataToSend: string) => void;
  sendGMCP?: (packageName: string, message: any) => void;
}


$(window).on('load', function () {
  if (typeof DecafMUD === 'undefined') {
    console.error('DecafMUD is not loaded!');
    return;
  }

  const mumePlugin = new MumePlayPlugin();

  const decafOptions = {
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
    // textinputfilter: 'mumexml', // This will be handled by our plugin's onData method
    socket: 'websocket',
  };

  const decaf = new DecafMUD(decafOptions);

  // Register the MUME plugin
  if (decaf.registerExternalPlugin) {
    decaf.registerExternalPlugin("MumePlayFeatures", mumePlugin);
  } else {
    console.error("DecafMUD registerExternalPlugin function not found. MUME features may not work.");
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
    // The MumeXmlParser event handling is now set up within the MumePlayPlugin constructor.
    // We just need to assign the loaded map to the global variable so the plugin can use it.
    globalMap = map;
    console.log('MumeMap loaded and ready for MumePlayPlugin.');

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
