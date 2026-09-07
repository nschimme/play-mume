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
import { MumeMap, RoomCoords } from './mume.mapper';
import { throttle } from './utils';

(function () {
  "use strict";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let originalRoomInfoHandler: ((data: any) => void) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decafInstanceRef: any;

  $(window).on("load", function (_e: JQuery.Event) {
    MumeMap.load("mume-map").done(function (map: MumeMap) {
      let matches: RegExpExecArray | null;

      const opener = window.opener as Window; // Cast once

      if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0]) {
        decafInstanceRef = opener.DecafMUD.instances[0];

        // Hook GMCP Room.Info in map.html window if connected
        if (decafInstanceRef && decafInstanceRef.gmcp) {
          originalRoomInfoHandler = typeof decafInstanceRef.gmcp.getFunction === 'function' ? decafInstanceRef.gmcp.getFunction('Room.Info') : undefined;
          decafInstanceRef.gmcp.packages.Room = decafInstanceRef.gmcp.packages.Room || {};
          const prevRoomInfo = originalRoomInfoHandler;
          decafInstanceRef.gmcp.packages.Room.Info = function (data: { id?: number | string; name?: string; desc?: string }) {
            if (map && map.pathMachine) {
              map.pathMachine.processGmcpRoomInfo(data);
            }
            if (typeof prevRoomInfo === 'function') {
              prevRoomInfo.call(this, data);
            }
          };
        }

        if ((matches = /^#(\d+),(\d+),(\d+)$/.exec(location.hash))) {
          map.onMovement(null, new RoomCoords(+matches[1], +matches[2], +matches[3]));
        }

        if (map.display && typeof map.display.fitParent === 'function') {
          map.display.fitParent();
          $(window).on("resize", throttle(map.display.fitParent.bind(map.display), 500));
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
    if (decafInstanceRef && decafInstanceRef.gmcp && decafInstanceRef.gmcp.packages && decafInstanceRef.gmcp.packages.Room) {
      if (originalRoomInfoHandler !== undefined) {
        decafInstanceRef.gmcp.packages.Room.Info = originalRoomInfoHandler;
      } else {
        delete decafInstanceRef.gmcp.packages.Room.Info;
      }
    }
  });
})();

export {};
