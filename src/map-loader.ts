import $ from 'jquery';
// Assuming jquery-throttle-debounce is loaded via main import or extends jQuery prototype
import { MumeMap, MumeXmlParser, RoomCoords } from './mume.mapper'; // Ensure RoomCoords is exported from mume.mapper if not already

// It's good practice to ensure DecafMUD and its parts are loaded if they are needed globally.
// However, map.html's script primarily interacts with an existing DecafMUD instance from the opener window.

(function () {
  "use strict";

  let tagEventHandler: ((_event: unknown, tag: any) => void) | undefined; // Define type for tagEventHandler

  $(window).on("load", function (_e: any) { // _e for event object type
    MumeMap.load("mume-map").done(function (map: MumeMap) { // map type
      let parser: MumeXmlParser; // parser type
      let matches: RegExpExecArray | null; // matches type

      // Accessing DecafMUD from the opener window. This is a cross-window communication.
      // Ensure that window.opener and its properties exist before accessing them.
      if (window.opener && (window.opener as any).DecafMUD && (window.opener as any).DecafMUD.instances && (window.opener as any).DecafMUD.instances[0]) {
        parser = (window.opener as any).DecafMUD.instances[0].textInputFilter as MumeXmlParser;

        // A more robust check for parser validity might be needed here
        // e.g., if (!parser || !(parser instanceof MumeXmlParser)) if MumeXmlParser is a class
        if (!parser || typeof parser.filterInputText !== 'function') { // Example check
          console.error("Bug: expected to find a MumeXmlParser instance in opener window.");
          throw new Error("MumeXmlParser not found or invalid in opener window.");
        }

        tagEventHandler = map.processTag.bind(map);
        (window.opener as any).$(parser).on(MumeXmlParser.SIG_TAG_END, tagEventHandler);

        console.log("The main window will now send data to the map window");

        if ((matches = /^#(\d+),(\d+),(\d+)$/.exec(location.hash))) {
          // Ensure RoomCoords can be instantiated. It might need to be exported from mume.mapper.ts
          map.onMovement(null, new RoomCoords(+matches[1], +matches[2], +matches[3]));
        }

        if (map.display && typeof map.display.fitParent === 'function') {
          map.display.fitParent();
          // Assuming $.throttle is available from the main bundle or jQuery extension
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
        console.error("DecafMUD instance not found in opener window. Map cannot be initialized.");
        // Optionally, display a message to the user in the map window itself.
        $('#mume-map').html('<p>Error: Could not connect to the main MUME window. Please ensure the main window is open and DecafMUD is running.</p>');
      }
    }).fail(function(error: any) {
      console.error("Failed to load MumeMap for map.html:", error);
      $('#mume-map').html('<p>Error: Failed to load map components.</p>');
    });
  });

  $(window).on("unload", function (_e: any) { // _e for event object type
    if (window.opener && (window.opener as any).DecafMUD && (window.opener as any).DecafMUD.instances && (window.opener as any).DecafMUD.instances[0]) {
      const parser = (window.opener as any).DecafMUD.instances[0].textInputFilter;
      if (tagEventHandler && parser) {
        (window.opener as any).$(parser).off(MumeXmlParser.SIG_TAG_END, tagEventHandler);
      }
    }
  });
})();

export {}; // Make this a module
