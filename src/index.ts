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
// import './mume.macros'; // Will be handled by the plugin
import './mume.menu'; // For now, keep menu as is, pending further analysis/decision
import { MumeMap } from './mume.mapper'; // Removed MumeXmlParser, MumeXmlParserTag
import { DecafMUDExternalPlugin } from './decafmud-plugin-api';
import { tryExtraMacro } from './mume.macros';

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
  // private xmlParser: MumeXmlParser; // Removed
  private decafMUD: DecafMUDInstance | null = null;
  private boundHandleKeyDown: (event: KeyboardEvent) => void;

  constructor() {
    // this.xmlParser = new MumeXmlParser(this.getDecafMUDInstance.bind(this)); // Removed
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);

    // XML Parser event forwarding removed
    // $(this.xmlParser).on(MumeXmlParser.SIG_TAG_END, (_event: unknown, tag: MumeXmlParserTag) => {
    //   if (globalMap) {
    //     globalMap.processTag(_event, tag);
    //   }
    // });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.send) {
      // Should not happen if called after onConnect where this.send is expected to be set up
      console.warn("MumePlayPlugin: send function not available for macros.");
      return;
    }
    // It's possible that DecafMUD's input handler already prevents default for some keys.
    // We rely on tryExtraMacro's return value to decide if we should prevent default.
    if (tryExtraMacro(event.keyCode, this.send)) {
      event.preventDefault();
    }
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
      // Ensure 'this.send' is populated if DecafMUD populated it on registration and we missed it
      // This is a bit of a safeguard; ideally, this.send is correctly injected by DecafMUD.
      if (!this.send && this.decafMUD.externalPlugins && this.decafMUD.externalPlugins["MumePlayFeatures"]) {
        this.send = this.decafMUD.externalPlugins["MumePlayFeatures"].send;
      }
    }
    // this.xmlParser.connected(); // Removed as xmlParser is removed
    document.addEventListener('keydown', this.boundHandleKeyDown, true);
    // The actual MUME.Client.XML request will be sent in onGMCPReady
  }

  onGMCPReady(gmcpClientInfo: { client: string, version: string }): void {
    console.log("MumePlayPlugin: GMCP ready signal received.", gmcpClientInfo);
    // XML mode request removed as per new plan.
    // if (this.sendGMCP) {
    //   console.log("MumePlayPlugin: Requesting XML mode via GMCP MUME.Client.XML { state: \"on\" }");
    //   this.sendGMCP("MUME.Client.XML", { state: "on" });
    // } else {
    //   console.warn("MumePlayPlugin: sendGMCP method not available at onGMCPReady, cannot request XML mode via GMCP.");
    // }
    console.log("MumePlayPlugin: XML mode request via GMCP has been disabled.");
  }

  onDisconnect(): void {
    console.log("MumePlayPlugin: Disconnected from DecafMUD.");
    document.removeEventListener('keydown', this.boundHandleKeyDown, true);
    // this.xmlParser.clear(); // Removed
  }

  // onData method removed as it's no longer called by DecafMUD for text filtering by this plugin.
  // onData(text: string): string {
  //   return text; // If it were to be kept, it would just pass through.
  // }

  // The 'send' and 'sendGMCP' methods will be injected by DecafMUD itself.
  // We just declare them here to satisfy the interface for type-checking if we were to call them internally,
  // though typically they are for DecafMUD to provide to us.
  send?: (dataToSend: string) => void;
  sendGMCP?: (packageName: string, message: any) => void;

  onGMCPMessage(packageName: string, data: any): void {
    // console.log(`MumePlayPlugin: Received GMCP Message: ${packageName}`, data);

    if (packageName === "Room.Info") {
      console.log("MumePlayPlugin: GMCP Room.Info received:", data);
      if (data && typeof data.name === 'string' && typeof data.desc === 'string' && globalMap && globalMap.pathMachine) {
        // Use a short delay to allow DecafMUD to display the text before map potentially moves.
        // This also helps if Room.Info arrives slightly before XML tags that might clear context.
        setTimeout(() => {
          if (globalMap && globalMap.pathMachine) { // Re-check globalMap in case of disconnect during timeout
            globalMap.pathMachine.updateRoomFromGMCP(data.name, data.desc);
          }
        }, 50);
      } else {
        console.warn("MumePlayPlugin: Invalid or incomplete Room.Info data, or map not ready.", data);
      }
    } else if (packageName === "MUME.Room.UpdateExits") {
      console.log("MumePlayPlugin: GMCP MUME.Room.UpdateExits received:", data);
      if (data && globalMap && globalMap.pathMachine) {
        globalMap.pathMachine.updateExitsFromGMCP(data);
      }
    }
    // Potentially handle other GMCP messages like Char.Vitals, etc. here
  }
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
    // textinputfilter: 'mumexml', // This option is no longer used by DecafMUD's core handleInputText
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
