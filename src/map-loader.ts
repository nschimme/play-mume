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

declare var $: any;
declare var jQuery: any;
import $ from 'jquery';
// Assuming jquery-throttle-debounce is loaded via main import or extends jQuery prototype
import { MumeMap, MumeXmlParser, RoomCoords, MumeXmlParserTag } from './mume.mapper';
// OpenerWindow is global from src/window-extensions.d.ts

(function () {
  "use strict";

  let tagEventHandler: ((_event: unknown, tag: MumeXmlParserTag) => void) | undefined;

  $(window).on("load", function (_e: JQuery.Event) {
    MumeMap.load("mume-map").done(function (map: MumeMap) {
      let parser: MumeXmlParser | undefined; // Can be undefined if opener setup fails
      let matches: RegExpExecArray | null;

      const opener = window.opener as OpenerWindow; // Cast once

      if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0]) {
        // Assuming textInputFilter is on the instance. If DecafMUDInstance type is correct, this should be fine.
        const decafInstance = opener.DecafMUD.instances[0];
        if (decafInstance) { // Additional check for the instance itself
            parser = decafInstance.textInputFilter as MumeXmlParser; // textInputFilter is any, cast to MumeXmlParser
        }


        if (!parser || typeof parser.filterInputText !== 'function') { // Cast to any for filterInputText if parser is MumeXmlParser|undefined
          console.error("Bug: expected to find a MumeXmlParser instance in opener window or textInputFilter is invalid.");
          // No 'throw' here, allow map to load, but without parser events.
          parser = undefined; // Ensure parser is undefined if not valid
        }

        if (parser && opener.$) { // Check for opener.$ before using it
          tagEventHandler = map.processTag.bind(map);
          opener.$(parser).on(MumeXmlParser.SIG_TAG_END, tagEventHandler);
          console.log("The main window will now send data to the map window");
        } else if (!opener.$) {
            console.error("jQuery ($) not found on opener window. Cannot bind parser events.");
        } else if (!parser) {
            console.log("MumeXmlParser not found or invalid on opener, map events not bound.");
        }


        if ((matches = /^#(\d+),(\d+),(\d+)$/.exec(location.hash))) {
          map.onMovement(null, new RoomCoords(+matches[1], +matches[2], +matches[3]));
        }

        if (map.display && typeof map.display.fitParent === 'function') {
          map.display.fitParent();
          if (typeof $.throttle === 'function') {
            $(window).on("resize", $.throttle(500, map.display.fitParent.bind(map.display)));
          } else {
            console.warn('jQuery throttle function not found for map window. Resize events will not be throttled.');
            $(window).on("resize", map.display.fitParent.bind(map.display));
          }
        } else {
          console.error("map.display or map.display.fitParent is not available.");
        }
      } else {
        console.error("DecafMUD instance not found in opener window. Map cannot be initialized fully.");
        $('#mume-map').html('<p>Error: Could not connect to the main MUME window. Please ensure the main window is open and DecafMUD is running.</p>');
      }
    }).fail(function(error: unknown) {
      console.error("Failed to load MumeMap for map.html:", error);
      $('#mume-map').html('<p>Error: Failed to load map components.</p>');
    });
  });

  $(window).on("unload", function (_e: JQuery.Event) {
    const opener = window.opener as OpenerWindow; // Cast once
    if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0] && opener.$) {
      const decafInstance = opener.DecafMUD.instances[0];
      if (decafInstance) {
        const parser = decafInstance.textInputFilter; // Type will be any if not in DecafMUDInstance
        if (tagEventHandler && parser) {
          opener.$(parser).off(MumeXmlParser.SIG_TAG_END, tagEventHandler);
        }
      }
    }
  });
})();

export {};
