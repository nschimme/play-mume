"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jquery_1 = __importDefault(require("jquery"));
// Assuming jquery-throttle-debounce is loaded via main import or extends jQuery prototype
const mume_mapper_1 = require("./mume.mapper");
// OpenerWindow is global from src/window-extensions.d.ts
(function () {
    "use strict";
    let tagEventHandler;
    (0, jquery_1.default)(window).on("load", function (_e) {
        mume_mapper_1.MumeMap.load("mume-map").done(function (map) {
            let parser; // Can be undefined if opener setup fails
            let matches;
            const opener = window.opener; // Cast once
            if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0]) {
                // Assuming textInputFilter is on the instance. If DecafMUDInstance type is correct, this should be fine.
                const decafInstance = opener.DecafMUD.instances[0];
                if (decafInstance) { // Additional check for the instance itself
                    parser = decafInstance.textInputFilter; // textInputFilter is any, cast to MumeXmlParser
                }
                if (!parser || typeof parser.filterInputText !== 'function') { // Cast to any for filterInputText if parser is MumeXmlParser|undefined
                    console.error("Bug: expected to find a MumeXmlParser instance in opener window or textInputFilter is invalid.");
                    // No 'throw' here, allow map to load, but without parser events.
                    parser = undefined; // Ensure parser is undefined if not valid
                }
                if (parser && opener.$) { // Check for opener.$ before using it
                    tagEventHandler = map.processTag.bind(map);
                    opener.$(parser).on(mume_mapper_1.MumeXmlParser.SIG_TAG_END, tagEventHandler);
                    console.log("The main window will now send data to the map window");
                }
                else if (!opener.$) {
                    console.error("jQuery ($) not found on opener window. Cannot bind parser events.");
                }
                else if (!parser) {
                    console.log("MumeXmlParser not found or invalid on opener, map events not bound.");
                }
                if ((matches = /^#(\d+),(\d+),(\d+)$/.exec(location.hash))) {
                    map.onMovement(null, new mume_mapper_1.RoomCoords(+matches[1], +matches[2], +matches[3]));
                }
                if (map.display && typeof map.display.fitParent === 'function') {
                    map.display.fitParent();
                    if (typeof jquery_1.default.throttle === 'function') {
                        (0, jquery_1.default)(window).on("resize", jquery_1.default.throttle(500, map.display.fitParent.bind(map.display)));
                    }
                    else {
                        console.warn('jQuery throttle function not found for map window. Resize events will not be throttled.');
                        (0, jquery_1.default)(window).on("resize", map.display.fitParent.bind(map.display));
                    }
                }
                else {
                    console.error("map.display or map.display.fitParent is not available.");
                }
            }
            else {
                console.error("DecafMUD instance not found in opener window. Map cannot be initialized fully.");
                (0, jquery_1.default)('#mume-map').html('<p>Error: Could not connect to the main MUME window. Please ensure the main window is open and DecafMUD is running.</p>');
            }
        }).fail(function (error) {
            console.error("Failed to load MumeMap for map.html:", error);
            (0, jquery_1.default)('#mume-map').html('<p>Error: Failed to load map components.</p>');
        });
    });
    (0, jquery_1.default)(window).on("unload", function (_e) {
        const opener = window.opener; // Cast once
        if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0] && opener.$) {
            const decafInstance = opener.DecafMUD.instances[0];
            if (decafInstance) {
                const parser = decafInstance.textInputFilter; // Type will be any if not in DecafMUDInstance
                if (tagEventHandler && parser) {
                    opener.$(parser).off(mume_mapper_1.MumeXmlParser.SIG_TAG_END, tagEventHandler);
                }
            }
        }
    });
})();
