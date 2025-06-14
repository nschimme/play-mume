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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var PIXI = __importStar(require("pixi.js"));
var Mapper;
(function (Mapper) {
    var ROOM_PIXELS = 48;
    var MAP_DATA_PATH = "mapdata/v1/";
    var Dir;
    (function (Dir) {
        Dir[Dir["NORTH"] = 0] = "NORTH";
        Dir[Dir["SOUTH"] = 1] = "SOUTH";
        Dir[Dir["EAST"] = 2] = "EAST";
        Dir[Dir["WEST"] = 3] = "WEST";
        Dir[Dir["LAST_GROUND_DIR"] = 3] = "LAST_GROUND_DIR";
        Dir[Dir["UP"] = 4] = "UP";
        Dir[Dir["DOWN"] = 5] = "DOWN";
        Dir[Dir["NONE"] = 6] = "NONE";
        Dir[Dir["UNKNOWN"] = 7] = "UNKNOWN";
    })(Dir || (Dir = {}));
    /* Like JQuery.when(), but the master Promise is resolved only when all
     * promises are resolved or rejected, not at the first rejection. */
    function whenAll(deferreds) {
        var master = jQuery.Deferred();
        if (deferreds.length === 0)
            return master.resolve();
        var pending = new Set();
        for (var _i = 0, deferreds_1 = deferreds; _i < deferreds_1.length; _i++) {
            var dfr = deferreds_1[_i];
            pending.add(dfr);
        }
        var _loop_1 = function (dfr) {
            dfr.always(function () {
                pending.delete(dfr);
                if (pending.size === 0)
                    master.resolve();
            });
        };
        for (var _a = 0, deferreds_2 = deferreds; _a < deferreds_2.length; _a++) {
            var dfr = deferreds_2[_a];
            _loop_1(dfr);
        }
        return master;
    }
    /* Like map.keys(), but as an Array and IE-compatible.
     */
    function mapKeys(map) {
        var keys = [];
        map.forEach(function (value, key) { keys.push(key); });
        return keys;
    }
    // Adapted from MMapper2: the result must be identical for the hashes to match
    function translitUnicodeToAsciiLikeMMapper(unicode) {
        var table = [
            /*192*/ 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I',
            /*208*/ 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'x', 'O', 'U', 'U', 'U', 'U', 'Y', 'b', 'B',
            /*224*/ 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i',
            /*248*/ 'o', 'n', 'o', 'o', 'o', 'o', 'o', ':', 'o', 'u', 'u', 'u', 'u', 'y', 'b', 'y',
        ];
        var ascii = "";
        for (var _i = 0, unicode_1 = unicode; _i < unicode_1.length; _i++) {
            var charString = unicode_1[_i];
            var ch = charString.charCodeAt(0);
            if (ch > 128) {
                if (ch < 192)
                    ascii += "z"; // sic
                else
                    ascii += table[ch - 192];
            }
            else {
                ascii += charString;
            }
        }
        return ascii;
    }
    /* This is the "entry point" to this library for the rest of the code. */
    var MumeMap = /** @class */ (function () {
        function MumeMap(mapData, display) {
            var _this = this;
            this.mapData = null;
            this.mapIndex = null;
            this.mapData = mapData;
            this.display = display;
            this.mapIndex = new MumeMapIndex();
            this.pathMachine = new MumePathMachine(this.mapData, this.mapIndex);
            this.processTag =
                function (event, tag) { return _this.pathMachine.processTag(event, tag); };
            MumeMap.debugInstance = this;
        }
        MumeMap.load = function (containerElementName) {
            var result = jQuery.Deferred();
            MumeMapData.load().done(function (mapData) {
                MumeMapDisplay.load(containerElementName, mapData)
                    .then(function (display) {
                    var map = new MumeMap(mapData, display);
                    $(map.pathMachine).on(MumePathMachine.SIG_MOVEMENT, function (event, where) { return map.onMovement(event, where); });
                    result.resolve(map);
                })
                    .catch(function (error) {
                    console.error("Failed to load MumeMapDisplay:", error);
                    result.reject(error);
                });
            });
            return result;
        };
        MumeMap.prototype.onMovement = function (event, where) {
            this.display.repositionTo(where);
        };
        return MumeMap;
    }());
    Mapper.MumeMap = MumeMap;
    /* Analogy to MMapper2's path machine, although ours is a currently just a
     * naive room+desc exact search with no "path" to speak of.
     */
    var MumePathMachine = /** @class */ (function () {
        function MumePathMachine(mapData, mapIndex) {
            this.mapData = mapData;
            this.mapIndex = mapIndex;
            this.roomName = null;
            this.here = null;
        }
        /* This receives an event from MumeXmlParser when it encounters a closing tag.
         * */
        MumePathMachine.prototype.processTag = function (event, tag) {
            console.log("MumePathMachine processes tag " + tag.name);
            if (tag.name === "name")
                this.roomName = tag.text;
            else if (tag.name === "description") {
                if (this.roomName) {
                    this.enterRoom(this.roomName, tag.text);
                    this.roomName = null;
                }
                else {
                    throw "Bug: the MumePathMachine got a room description but no room name: " +
                        tag.text.substr(0, 50) + "...";
                }
            }
            else if (tag.name === "room") {
                this.roomName = null;
            }
        };
        /* Internal function called when we got a complete room. */
        MumePathMachine.prototype.enterRoom = function (name, desc) {
            var _this = this;
            this.mapIndex.findPosByNameDesc(name, desc)
                .done(function (coordinates) {
                _this.here = coordinates[0];
                $(_this).triggerHandler(MumePathMachine.SIG_MOVEMENT, [coordinates[0]]);
            });
        };
        MumePathMachine.SIG_MOVEMENT = "movement";
        return MumePathMachine;
    }());
    /* Queries and caches the server-hosted index of rooms.
     * For v1 format, that's a roomname+roomdesc => coords index, 2.4MB total,
     * split into 10kB JSON chunks.
     */
    var MumeMapIndex = /** @class */ (function () {
        function MumeMapIndex() {
            this.cache = new Map();
            this.cachedChunks = new Set();
        }
        /* Normalize into text that should match what MMapper used to produce the
         * name+desc hashes.
         */
        MumeMapIndex.normalizeString = function (input) {
            // MMapper indexed the plain text without any escape, obviously.
            var text = input.replace(MumeMapIndex.ANY_ANSI_ESCAPE, '');
            // MMapper applies these conversions to ensure the hashes in the index
            // are resilient to trivial changes.
            return translitUnicodeToAsciiLikeMMapper(text);
        };
        /* Returns a hash of the name+desc that identifies the chunk of the name+desc
         * index we want from the server. This algorithm must be identical to what
         * MMapper uses for this version of the webmap format.
         */
        MumeMapIndex.hashNameDesc = function (name, desc) {
            var normName = MumeMapIndex.normalizeString(name);
            var normDesc = MumeMapIndex.normalizeString(desc.replace(/\s+/g, " "));
            var namedesc = normName + "\n" + normDesc;
            var hash = SparkMD5.hash(namedesc);
            return hash;
        };
        MumeMapIndex.prototype.updateCache = function (json) {
            var hash, oldSize, sizeIncrease, jsonSize;
            var invalid = 0;
            oldSize = this.cache.size;
            for (hash in json) {
                if (json.hasOwnProperty(hash)) {
                    var rawCoordsArray = json[hash];
                    if (!Array.isArray(rawCoordsArray)) {
                        ++invalid;
                        continue;
                    }
                    var coordsArray = [];
                    for (var _i = 0, rawCoordsArray_1 = rawCoordsArray; _i < rawCoordsArray_1.length; _i++) {
                        var rawCoords = rawCoordsArray_1[_i];
                        if (!Array.isArray(rawCoords) || rawCoords.length !== 3) {
                            coordsArray = null;
                            break;
                        }
                        else
                            coordsArray.push(new RoomCoords(rawCoords[0], rawCoords[1], rawCoords[2]));
                    }
                    if (coordsArray === null)
                        ++invalid;
                    else
                        this.cache.set(hash, coordsArray);
                }
            }
            sizeIncrease = this.cache.size - oldSize;
            jsonSize = Object.keys(json).length;
            console.log("MumeMapIndex: cached %d new entries (%d total), ignored %d invalid", sizeIncrease, this.cache.size, jsonSize, invalid);
            if (sizeIncrease != jsonSize)
                console.error("MumeMapIndex: stray index entries in %O?", json);
        };
        // Private helper for findPosByNameDesc().
        MumeMapIndex.prototype.findPosByNameDescCached = function (name, desc, result, hash) {
            var coordinates, roomInfo;
            coordinates = this.cache.get(hash);
            roomInfo = { name: name, desc: desc, hash: hash, };
            if (coordinates === undefined) {
                console.log("MumeMapIndex: unknown room %s (%O)", name, roomInfo);
                result.reject();
            }
            else {
                console.log("MumeMapIndex: found %s (%O) in %O", name, roomInfo, coordinates);
                result.resolve(coordinates);
            }
            return result;
        };
        /* This may be asynchronous if the index chunk has not been downloaded yet, so
         * the result is a jQuery Deferred.
         */
        MumeMapIndex.prototype.findPosByNameDesc = function (name, desc) {
            var _this = this;
            var hash = MumeMapIndex.hashNameDesc(name, desc);
            var result = jQuery.Deferred();
            // Shortcut if we already have that index chunk in cache
            var chunk = hash.substr(0, 2);
            if (this.cachedChunks.has(chunk))
                return this.findPosByNameDescCached(name, desc, result, hash);
            console.log("Downloading map index chunk " + chunk);
            var url = MAP_DATA_PATH + "roomindex/" + chunk + ".json";
            jQuery.getJSON(url)
                .done(function (json) {
                _this.cachedChunks.add(chunk);
                _this.updateCache(json);
                _this.findPosByNameDescCached(name, desc, result, hash);
            })
                .fail(function (jqxhr, textStatus, error) {
                console.error("Loading map index chunk %s failed: %s, %O", url, textStatus, error);
                result.reject();
            });
            return result;
        };
        // This is a vast simplification of course...
        MumeMapIndex.ANY_ANSI_ESCAPE = /\x1B\[[^A-Za-z]+[A-Za-z]/g;
        return MumeMapIndex;
    }());
    /* This is a RoomCoords shifted by metaData.minX/Y/Z to fit a zero-based Array. */
    var ZeroedRoomCoords = /** @class */ (function () {
        function ZeroedRoomCoords(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        return ZeroedRoomCoords;
    }());
    /* Room coordinates, comprised in metaData.minX .. maxX etc. */
    var RoomCoords = /** @class */ (function () {
        function RoomCoords(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        RoomCoords.prototype.toString = function () {
            return "RoomCoords(".concat(this.x, ", ").concat(this.y, ", ").concat(this.z, ")");
        };
        return RoomCoords;
    }());
    Mapper.RoomCoords = RoomCoords;
    /* Stores stuff in a x/y/z-indexed 3D array. The coordinates must be within the
     * minX/maxX/etc bounds of the metaData.
     */
    var SpatialIndex = /** @class */ (function () {
        function SpatialIndex(metaData) {
            this.metaData = metaData;
            // Hopefully, JS' sparse arrays will make this memory-efficient.
            this.data = new Array(this.metaData.maxX - this.metaData.minX);
        }
        /* Private helper to get 0-based coordinates from whatever MM2 provided */
        SpatialIndex.prototype.getZeroedCoordinates = function (pos) {
            return new ZeroedRoomCoords(pos.x - this.metaData.minX, pos.y - this.metaData.minY, pos.z - this.metaData.minZ);
        };
        SpatialIndex.prototype.set = function (c, what) {
            var zero = this.getZeroedCoordinates(c);
            if (this.data[zero.x] === undefined)
                this.data[zero.x] = new Array(this.metaData.maxY - this.metaData.minY);
            if (this.data[zero.x][zero.y] === undefined)
                this.data[zero.x][zero.y] = [];
            this.data[zero.x][zero.y][zero.z] = what;
        };
        /* Public. */
        SpatialIndex.prototype.get = function (c) {
            var zero = this.getZeroedCoordinates(c);
            if (this.data[zero.x] !== undefined &&
                this.data[zero.x][zero.y] !== undefined &&
                this.data[zero.x][zero.y][zero.z] !== undefined) {
                return this.data[zero.x][zero.y][zero.z];
            }
            else {
                return null;
            }
        };
        return SpatialIndex;
    }());
    // This is what we load from the server.
    var MapMetaData = /** @class */ (function () {
        function MapMetaData() {
            /* The default values are never used and only make sure we can compare the
             * declared vs. downloaded properties at runtime. */
            this.directions = [];
            this.maxX = 0;
            this.maxY = 0;
            this.maxZ = 0;
            this.minX = 0;
            this.minY = 0;
            this.minZ = 0;
            this.roomsCount = 0;
        }
        MapMetaData.assertValid = function (json) {
            var missing = new Array();
            for (var prop in new MapMetaData())
                if (!json.hasOwnProperty(prop))
                    missing.push(prop);
            if (missing.length !== 0)
                throw "Missing properties in loaded metadata: " + missing.join(", ");
        };
        return MapMetaData;
    }());
    // This is what we load from the server, inside RoomData.
    var RoomExit = /** @class */ (function () {
        function RoomExit() {
            this.name = "";
            this.dflags = 0;
            this.flags = 0;
            this.in = [];
            this.out = [];
        }
        return RoomExit;
    }());
    var RoomData = /** @class */ (function () {
        function RoomData() {
            this.name = "";
            this.desc = "";
            this.id = 0; // RoomIds are not meant to be created, yet we need a placeholder
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.exits = [];
            this.sector = 0;
            this.loadflags = 0;
            this.mobflags = 0;
            // ...
        }
        return RoomData;
    }());
    var Room = /** @class */ (function () {
        function Room(data) {
            this.data = data;
        }
        Room.prototype.coords = function () {
            return new RoomCoords(this.data.x, this.data.y, this.data.z);
        };
        return Room;
    }());
    /* Stores map data (an array of room structures, exposed as .data) and provides
     * an indexing feature. */
    var MumeMapData = /** @class */ (function () {
        function MumeMapData(json) {
            /* These zones are currently in-memory. */
            this.cachedZones = new Set();
            /* These zones are known not to exist on the server. */
            this.nonExistentZones = new Set();
            MapMetaData.assertValid(json);
            this.metaData = json;
            this.rooms = new SpatialIndex(json);
        }
        /* Initiates loading the external JSON map data.
         * Returns a JQuery Deferred that can be used to execute further code once done.
         */
        MumeMapData.load = function () {
            var result = jQuery.Deferred();
            jQuery.getJSON(MAP_DATA_PATH + "arda.json")
                .done(function (json) {
                try {
                    result.resolve(new MumeMapData(json));
                    console.log("Map metadata loaded");
                }
                catch (e) {
                    console.error("Loading metadata failed: %O", e);
                    result.reject();
                }
            })
                .fail(function (jqxhr, textStatus, error) {
                console.error("Loading metadata failed: %s, %O", textStatus, error);
                result.reject();
            });
            return result;
        };
        /* Private helper that feeds the in-memory cache. */
        MumeMapData.prototype.setCachedRoom = function (room) {
            this.rooms.set(room.coords(), room);
        };
        /* Returns a room from the in-memory cache or null if not found. Does not
         * attempt to download the zone if it's missing from the cache.
         */
        MumeMapData.prototype.getRoomAtCached = function (c) {
            var room = this.rooms.get(c);
            if (room != null) {
                /*console.log( "MumeMapData found room %s (%d) for coords %d,%d,%d",
                    room.name, room.id, x, y, z );*/
                return room;
            }
            else {
                /*console.log( "MumeMapData did not find a room for coords %d,%d,%d",
                    x, y, z );*/
                return null;
            }
        };
        MumeMapData.prototype.getRoomResultAtCached = function (c, result) {
            var room = this.getRoomAtCached(c);
            if (room === null)
                return result.reject();
            else
                return result.resolve(room);
        };
        /* Stores a freshly retrieved JSON zone into the in-memory cache. Returns
         * the rooms added to the cache. */
        MumeMapData.prototype.cacheZone = function (zone, json) {
            if (!Array.isArray(json)) {
                console.error("Expected to find an Array for zone %s, got %O", zone, json);
                return [];
            }
            var cached = new Array();
            for (var i = 0; i < json.length; ++i) {
                var rdata = json[i];
                var missing = new Array();
                for (var prop in new RoomData())
                    if (!rdata.hasOwnProperty(prop))
                        missing.push(prop);
                if (missing.length !== 0) {
                    console.error("Missing properties %O in room #%d of zone %s", missing, i, zone);
                    return cached; // but do not mark the zone as cached - we'll retry it
                }
                var room = new Room(rdata);
                this.setCachedRoom(room);
                cached.push(room);
            }
            console.log("MumeMapData cached %d rooms for zone %s", cached, zone);
            this.cachedZones.add(zone);
            return cached;
        };
        /* Returns the x,y zone for that room's coords, or null if out of the map.
         */
        MumeMapData.prototype.getRoomZone = function (x, y) {
            if (x < this.metaData.minX || x > this.metaData.maxX ||
                y < this.metaData.minY || y > this.metaData.maxY)
                return null;
            var zoneX = x - (x % MumeMapData.ZONE_SIZE);
            var zoneY = y - (y % MumeMapData.ZONE_SIZE);
            var zone = zoneX + "," + zoneY;
            return zone;
        };
        /* Private. */
        MumeMapData.prototype.downloadAndCacheZone = function (zone) {
            var _this = this;
            var result = jQuery.Deferred();
            console.log("Downloading map zone %s", zone);
            var url = MAP_DATA_PATH + "zone/" + zone + ".json";
            jQuery.getJSON(url)
                .done(function (json) {
                _this.cacheZone(zone, json);
                result.resolve();
            })
                .fail(function (jqXHR, textStatus, error) {
                if (jqXHR.status === 404)
                    console.log("Map zone %s does not exist: %s, %O", url, textStatus, error);
                // Not an error: zones without data simply don't get output
                else
                    console.error("Downloading map zone %s failed: %s, %O", url, textStatus, error);
                result.reject();
            });
            return result;
        };
        /* Fetches a room from the cache or the server. Returns a jQuery Deferred. */
        MumeMapData.prototype.getRoomAt = function (c) {
            var _this = this;
            var result = jQuery.Deferred();
            var zone = this.getRoomZone(c.x, c.y);
            if (zone === null || this.nonExistentZones.has(zone))
                return result.reject();
            if (this.cachedZones.has(zone))
                return this.getRoomResultAtCached(c, result);
            this.downloadAndCacheZone(zone)
                .done(function () {
                _this.getRoomResultAtCached(c, result);
            });
            return result;
        };
        /* Fetches rooms at an Array of x/y/z coords from the cache or the server.
         * Returns arrays of rooms through a jQuery Deferred. Partial results are
         * returned as soon as the rooms are available as notify()cations, and the
         * complete array of rooms is also returned when the Promise is resolved.
         * Rooms that do not exist are not part of the results.
         */
        MumeMapData.prototype.getRoomsAt = function (coordinates) {
            var _this = this;
            var result = jQuery.Deferred();
            var downloads = [];
            var downloadDeferreds = [];
            var roomsNotInCachePerZone = new Map();
            var roomsInCache = [];
            var roomsDownloaded = [];
            // Sort coordinates into rooms in cache and rooms needing a download
            for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
                var coords = coordinates_1[_i];
                var zone = this.getRoomZone(coords.x, coords.y);
                if (zone === null)
                    continue;
                if (this.nonExistentZones.has(zone)) {
                    // Do nothing if the zone doesn't exist on the server
                }
                else if (!this.cachedZones.has(zone)) {
                    var roomsNotInCache = roomsNotInCachePerZone.get(zone);
                    if (roomsNotInCache)
                        roomsNotInCache.add(coords);
                    else {
                        roomsNotInCache = new Set();
                        roomsNotInCache.add(coords);
                        roomsNotInCachePerZone.set(zone, roomsNotInCache);
                        console.log("Downloading map zone %s for room %d,%d", zone, coords.x, coords.y);
                        var url = MAP_DATA_PATH + "zone/" + zone + ".json";
                        var deferred = jQuery.getJSON(url);
                        downloads.push({ zone: zone, dfr: deferred });
                        downloadDeferreds.push(deferred);
                    }
                }
                else {
                    var room = this.getRoomAtCached(coords);
                    if (room != null)
                        roomsInCache.push(room);
                }
            }
            // Return cached rooms immediatly through a notify
            result.notify(roomsInCache);
            var _loop_2 = function (download) {
                download.dfr
                    .done(function (json) {
                    console.log("Zone %s downloaded", download.zone);
                    var neededCoords = roomsNotInCachePerZone.get(download.zone);
                    if (neededCoords == undefined)
                        return console.error("Bug: inconsistent download list");
                    var neededCoordsStr = new Set(); // Equivalent Coords are not === equal
                    neededCoords.forEach(function (c) { return neededCoordsStr.add(c.toString()); });
                    var downloaded = _this.cacheZone(download.zone, json);
                    var neededRooms = downloaded
                        .filter(function (r) { return neededCoordsStr.has(r.coords().toString()); });
                    // Send the batch of freshly downloaded rooms
                    roomsDownloaded.push.apply(roomsDownloaded, neededRooms);
                    result.notify(neededRooms);
                })
                    .fail(function (dfr, textStatus, error) {
                    if (dfr.status === 404) {
                        _this.nonExistentZones.add(download.zone);
                        console.log("Map zone %s does not exist: %s, %O", download.zone, textStatus, error);
                        // Not an error: zones without data simply don't get output
                    }
                    else
                        console.error("Downloading map zone %s failed: %s, %O", download.zone, textStatus, error);
                });
            };
            // Async-download the rest (this is out of first for() for legibility only)
            for (var _a = 0, downloads_1 = downloads; _a < downloads_1.length; _a++) {
                var download = downloads_1[_a];
                _loop_2(download);
            }
            // Return the whole batch when done
            var allRooms = roomsInCache.concat(roomsDownloaded);
            whenAll(downloadDeferreds).done(function () { return result.resolve(allRooms); });
            return result;
        };
        // Arda is split into JSON files that wide.
        MumeMapData.ZONE_SIZE = 20;
        return MumeMapData;
    }());
    // Algorithms that build PIXI display elements.
    var Mm2Gfx;
    (function (Mm2Gfx) {
        var Sector;
        (function (Sector) {
            Sector[Sector["UNDEFINED"] = 0] = "UNDEFINED";
            Sector[Sector["INSIDE"] = 1] = "INSIDE";
            Sector[Sector["CITY"] = 2] = "CITY";
            Sector[Sector["FIELD"] = 3] = "FIELD";
            Sector[Sector["FOREST"] = 4] = "FOREST";
            Sector[Sector["HILLS"] = 5] = "HILLS";
            Sector[Sector["MOUNTAIN"] = 6] = "MOUNTAIN";
            Sector[Sector["WATER_SHALLOW"] = 7] = "WATER_SHALLOW";
            Sector[Sector["WATER"] = 8] = "WATER";
            Sector[Sector["WATER_NOBOAT"] = 9] = "WATER_NOBOAT";
            Sector[Sector["UNDERWATER"] = 10] = "UNDERWATER";
            Sector[Sector["ROAD"] = 11] = "ROAD";
            Sector[Sector["BRUSH"] = 12] = "BRUSH";
            Sector[Sector["TUNNEL"] = 13] = "TUNNEL";
            Sector[Sector["CAVERN"] = 14] = "CAVERN";
            Sector[Sector["DEATHTRAP"] = 15] = "DEATHTRAP";
            Sector[Sector["COUNT"] = 16] = "COUNT";
        })(Sector || (Sector = {}));
        var ExitFlags;
        (function (ExitFlags) {
            ExitFlags[ExitFlags["ROAD"] = 4] = "ROAD";
        })(ExitFlags || (ExitFlags = {}));
        var MOB_FLAGS = 17;
        var LOAD_FLAGS = 24;
        function getSectorAssetPath(sector) {
            if (sector < Sector.UNDEFINED || sector >= Sector.COUNT)
                sector = Sector.UNDEFINED;
            var name = "undefined";
            switch (sector) {
                case Sector.UNDEFINED:
                    name = "undefined";
                    break;
                case Sector.INSIDE:
                    name = "indoors";
                    break;
                case Sector.CITY:
                    name = "city";
                    break;
                case Sector.FIELD:
                    name = "field";
                    break;
                case Sector.FOREST:
                    name = "forest";
                    break;
                case Sector.HILLS:
                    name = "hills";
                    break;
                case Sector.MOUNTAIN:
                    name = "mountains";
                    break;
                case Sector.WATER_SHALLOW:
                    name = "shallow";
                    break;
                case Sector.WATER:
                    name = "water";
                    break;
                case Sector.WATER_NOBOAT:
                    name = "rapids";
                    break;
                case Sector.UNDERWATER:
                    name = "underwater";
                    break;
                case Sector.ROAD:
                    name = "road";
                    break;
                case Sector.BRUSH:
                    name = "brush";
                    break;
                case Sector.TUNNEL:
                    name = "tunnel";
                    break;
                case Sector.CAVERN:
                    name = "cavern";
                    break;
                case Sector.DEATHTRAP:
                    name = "deathtrap";
                    break;
                default:
                    console.error("unable to load a texture for sector %d", sector);
            }
            ;
            return "resources/pixmaps/terrain-" + name + ".png";
        }
        function getRoadAssetPath(dirsf, kind) {
            var name = "none";
            switch (dirsf) {
                case 0:
                    name = "none";
                    break;
                case 1:
                    name = "n";
                    break;
                case 2:
                    name = "s";
                    break;
                case 3:
                    name = "ns";
                    break;
                case 4:
                    name = "e";
                    break;
                case 5:
                    name = "ne";
                    break;
                case 6:
                    name = "es";
                    break;
                case 7:
                    name = "nes";
                    break;
                case 8:
                    name = "w";
                    break;
                case 9:
                    name = "nw";
                    break;
                case 10:
                    name = "sw";
                    break;
                case 11:
                    name = "nsw";
                    break;
                case 12:
                    name = "ew";
                    break;
                case 13:
                    name = "new";
                    break;
                case 14:
                    name = "esw";
                    break;
                case 15:
                    name = "all";
                    break;
                default:
                    console.error("unable to load a texture for dirsf %d", dirsf);
            }
            return "resources/pixmaps/".concat(kind, "-").concat(name, ".png");
        }
        function getExtraAssetPath(extra, kind) {
            var name = "";
            if (kind === "mob")
                switch (extra) {
                    case 0:
                        name = "rent";
                        break;
                    case 1:
                        name = "shop";
                        break;
                    case 2:
                        name = "weaponshop";
                        break;
                    case 3:
                        name = "armourshop";
                        break;
                    case 4:
                        name = "foodshop";
                        break;
                    case 5:
                        name = "petshop";
                        break;
                    case 6:
                        name = "guild";
                        break;
                    case 7:
                        name = "scoutguild";
                        break;
                    case 8:
                        name = "mageguild";
                        break;
                    case 9:
                        name = "clericguild";
                        break;
                    case 10:
                        name = "warriorguild";
                        break;
                    case 11:
                        name = "rangerguild";
                        break;
                    case 12:
                        name = "aggmob";
                        break;
                    case 13:
                        name = "questmob";
                        break;
                    case 14:
                        name = "passivemob";
                        break;
                    case 14:
                        name = "elitemob";
                        break;
                    case 15:
                        name = "smob";
                        break;
                    case 16:
                        name = "milkable";
                        break;
                    default:
                        console.error("unable to load mob texture %d", extra);
                }
            else if (kind === "load")
                switch (extra) {
                    case 0:
                        name = "treasure";
                        break;
                    case 1:
                        name = "armour";
                        break;
                    case 2:
                        name = "weapon";
                        break;
                    case 3:
                        name = "water";
                        break;
                    case 4:
                        name = "food";
                        break;
                    case 5:
                        name = "herb";
                        break;
                    case 6:
                        name = "key";
                        break;
                    case 7:
                        name = "mule";
                        break;
                    case 8:
                        name = "horse";
                        break;
                    case 9:
                        name = "pack";
                        break;
                    case 10:
                        name = "trained";
                        break;
                    case 11:
                        name = "rohirrim";
                        break;
                    case 12:
                        name = "warg";
                        break;
                    case 13:
                        name = "boat";
                        break;
                    case 14:
                        name = "attention";
                        break;
                    case 15:
                        name = "watch";
                        break;
                    case 16:
                        name = "clock";
                        break;
                    case 17:
                        name = "mail";
                        break;
                    case 18:
                        name = "stable";
                        break;
                    case 19:
                        name = "whiteword";
                        break;
                    case 20:
                        name = "darkword";
                        break;
                    case 21:
                        name = "equipment";
                        break;
                    case 22:
                        name = "coach";
                        break;
                    case 23:
                        name = "ferry";
                        break;
                    default:
                        console.error("unable to load load texture %d", extra);
                }
            ;
            return "resources/pixmaps/".concat(kind, "-").concat(name, ".png");
        }
        function getAllAssetPaths() {
            var paths = [];
            for (var i = 0; i < Sector.COUNT; ++i)
                paths.push(getSectorAssetPath(i));
            for (var i = 0; i < (1 << (Dir.LAST_GROUND_DIR + 1)); ++i) {
                paths.push(getRoadAssetPath(i, "road"));
                paths.push(getRoadAssetPath(i, "trail"));
            }
            for (var i = 0; i < MOB_FLAGS; ++i)
                paths.push(getExtraAssetPath(i, "mob"));
            for (var i = 0; i < LOAD_FLAGS; ++i)
                paths.push(getExtraAssetPath(i, "load"));
            return paths;
        }
        Mm2Gfx.getAllAssetPaths = getAllAssetPaths;
        // Road and trail assets are numbered 0..15 based on bit operations
        // describing which exits are roads/trails.
        function roadDirsFlags(room) {
            var dirsf = 0;
            for (var dir = 0; dir <= Dir.LAST_GROUND_DIR; ++dir)
                if (room.data.exits[dir].flags & ExitFlags.ROAD)
                    dirsf |= (1 << dir);
            return dirsf;
        }
        function buildRoomSector(room) {
            var display;
            var sector;
            var dirsf = roadDirsFlags(room);
            if (room.data.sector === Sector.ROAD) {
                var imgPath = getRoadAssetPath(dirsf, "road");
                display = sector = new PIXI.Sprite(PIXI.Assets.get(imgPath));
            }
            else {
                var imgPath = getSectorAssetPath(room.data.sector);
                sector = new PIXI.Sprite(PIXI.Assets.get(imgPath));
                if (dirsf !== 0) // Trail (road exits but not Sectors.ROAD)
                 {
                    var trailPath = getRoadAssetPath(dirsf, "trail");
                    var trail = new PIXI.Sprite(PIXI.Assets.get(trailPath));
                    // Just in case the trail and sector dimensions don't match
                    trail.scale.set(sector.width / trail.width, sector.height / trail.height);
                    display = new PIXI.Container();
                    sector.addChild(sector, trail);
                }
                else
                    display = sector;
            }
            sector.height = sector.width = ROOM_PIXELS; // Just in case we got a wrong PNG here
            return sector;
        }
        function buildRoomBorders(room) {
            var borders = new PIXI.Graphics();
            borders.lineStyle(2, 0x000000, 1);
            var borderSpec = [
                { dir: Dir.NORTH, x0: 0, y0: 0, x1: ROOM_PIXELS, y1: 0 },
                { dir: Dir.EAST, x0: ROOM_PIXELS, y0: 0, x1: ROOM_PIXELS, y1: ROOM_PIXELS },
                { dir: Dir.SOUTH, x0: ROOM_PIXELS, y0: ROOM_PIXELS, x1: 0, y1: ROOM_PIXELS },
                { dir: Dir.WEST, x0: 0, y0: ROOM_PIXELS, x1: 0, y1: 0 },
            ];
            for (var _i = 0, borderSpec_1 = borderSpec; _i < borderSpec_1.length; _i++) {
                var spec = borderSpec_1[_i];
                if (room.data.exits[spec.dir].out.length === 0) {
                    borders.moveTo(spec.x0, spec.y0);
                    borders.lineTo(spec.x1, spec.y1);
                }
            }
            ;
            return borders;
        }
        function buildUpExit(room) {
            if (room.data.exits[Dir.UP].out.length === 0)
                return null;
            var exit = new PIXI.Graphics();
            exit.lineStyle(1, 0x000000, 1);
            exit.beginFill(0xffffff, 1);
            exit.drawCircle(ROOM_PIXELS * 0.75, ROOM_PIXELS * 0.25, ROOM_PIXELS / 8);
            exit.endFill();
            exit.drawCircle(ROOM_PIXELS * 0.75, ROOM_PIXELS * 0.25, 1);
            return exit;
        }
        function buildDownExit(room) {
            if (room.data.exits[Dir.DOWN].out.length === 0)
                return null;
            var radius = ROOM_PIXELS / 8;
            var crossCoord = Math.sin(Math.PI / 4) * radius;
            var centerX = ROOM_PIXELS * 0.25;
            var centerY = ROOM_PIXELS * 0.75;
            var exit = new PIXI.Graphics();
            exit.lineStyle(1, 0x000000, 1);
            exit.beginFill(0xffffff, 1);
            exit.drawCircle(centerX, centerY, radius);
            exit.endFill();
            exit.moveTo(centerX - crossCoord, centerY - crossCoord);
            exit.lineTo(centerX + crossCoord, centerY + crossCoord);
            exit.moveTo(centerX - crossCoord, centerY + crossCoord);
            exit.lineTo(centerX + crossCoord, centerY - crossCoord);
            return exit;
        }
        function buildRoomExtra(room, kind) {
            var flagsCount = (kind === "load" ? LOAD_FLAGS : MOB_FLAGS);
            var flags = (kind === "load" ? room.data.loadflags : room.data.mobflags);
            var paths = [];
            for (var i = 0; i < flagsCount; ++i)
                if (flags & (1 << i))
                    paths.push(getExtraAssetPath(i, kind));
            if (paths.length === 0)
                return null;
            // Do not allocate a container for the common case of a single load flag
            if (paths.length === 1) {
                var sprite = new PIXI.Sprite(PIXI.Assets.get(paths[0]));
                sprite.scale.set(ROOM_PIXELS / sprite.width, ROOM_PIXELS / sprite.height);
                return sprite;
            }
            var display = new PIXI.Container();
            for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
                var path = paths_1[_i];
                var sprite = new PIXI.Sprite(PIXI.Assets.get(path));
                sprite.scale.set(ROOM_PIXELS / sprite.width, ROOM_PIXELS / sprite.height);
                display.addChild(sprite);
            }
            return display;
        }
        function maybeAddChild(display, child) {
            if (child != null)
                display.addChild(child);
        }
        /* Returns the graphical structure for a single room for rendering (base
         * texture, walls, flags etc). */
        function buildRoomDisplay(room) {
            var display = new PIXI.Container();
            display.addChild(buildRoomSector(room));
            display.addChild(buildRoomBorders(room));
            maybeAddChild(display, buildUpExit(room));
            maybeAddChild(display, buildDownExit(room));
            maybeAddChild(display, buildRoomExtra(room, "mob"));
            maybeAddChild(display, buildRoomExtra(room, "load"));
            // Position the room display in its layer
            display.position = new PIXI.Point(room.data.x * ROOM_PIXELS, room.data.y * ROOM_PIXELS);
            /*console.log( "MumeMapDisplay added room %s (%d,%d) in PIXI at local:%O, global:%O",
                room.data.name, room.data.x, room.data.y, display.position, display.getGlobalPosition() );*/
            display.cacheAsBitmap = true;
            return display;
        }
        Mm2Gfx.buildRoomDisplay = buildRoomDisplay;
        /* Returns the graphical structure for the yellow square that shows the current
         * position to the player. */
        function buildHerePointer() {
            var size = ROOM_PIXELS * 1.4;
            var offset = (size - ROOM_PIXELS) / 2;
            var square = new PIXI.Graphics();
            square.lineStyle(2, 0xFFFF00, 1);
            square.drawRect(-offset, -offset, size, size);
            square.beginFill(0x000000, 0.1);
            square.drawRect(-offset, -offset, size, size);
            square.endFill();
            return square;
        }
        Mm2Gfx.buildHerePointer = buildHerePointer;
        function buildInitialHint() {
            var text = new PIXI.Text("Enter Arda to see a map here", {
                fontFamily: 'Arial', fontSize: 24, fill: 'white', align: 'center',
                wordWrap: true, wordWrapWidth: 400,
                dropShadow: {
                    alpha: 1, // Default
                    angle: Math.PI / 6, // Default
                    blur: 5, // From original dropShadowBlur
                    color: 'black', // Default
                    distance: 0, // From original dropShadowDistance
                },
            });
            return text;
        }
        Mm2Gfx.buildInitialHint = buildInitialHint;
    })(Mm2Gfx || (Mm2Gfx = {}));
    /* Renders mapData into a DOM placeholder identified by containerElementName.
     */
    var MumeMapDisplay = /** @class */ (function () {
        // Use load() instead if the assets might not have been loaded yet.
        function MumeMapDisplay(containerElementName, mapData) {
            this.layers = [];
            this.mapData = mapData;
            this.roomDisplays = new SpatialIndex(this.mapData.metaData);
            this.installMap(containerElementName);
            this.buildMapDisplay();
        }
        // Async factory function. Returns a Display when the prerequisites are loaded.
        MumeMapDisplay.load = function (containerElementName, mapData) {
            return __awaiter(this, void 0, void 0, function () {
                var assetPaths, display;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            assetPaths = Mm2Gfx.getAllAssetPaths().map(function (p) { return String(p); });
                            return [4 /*yield*/, PIXI.Assets.load(assetPaths)];
                        case 1:
                            _a.sent();
                            display = new MumeMapDisplay(containerElementName, mapData);
                            return [2 /*return*/, display];
                    }
                });
            });
        };
        /* Installs the viewport into the DOM. */
        MumeMapDisplay.prototype.installMap = function (containerElementName) {
            this.pixi = new PIXI.Application({
                autoStart: false,
                backgroundColor: 0x6e6e6e,
                resolution: window.devicePixelRatio || 1, // Added fallback for devicePixelRatio
                autoDensity: true, // Manages resolution and density
            });
            var stub = document.getElementById(containerElementName);
            if (stub == null || stub.parentElement == null) {
                document.body.appendChild(this.pixi.view); // Use app.view
            }
            else {
                stub.parentElement.replaceChild(this.pixi.view, stub); // Use app.view
            }
        };
        MumeMapDisplay.prototype.fitParent = function () {
            var parentElement = this.pixi.view.parentElement;
            if (parentElement === null) {
                console.warn("PIXI canvas parentElement is null.");
                return false;
            }
            var canvasParent = $(parentElement);
            if (canvasParent.is(":visible") && canvasParent.width() && canvasParent.height()) {
                var width = canvasParent.width(); // Added type assertion
                var height = canvasParent.height(); // Added type assertion
                // Non-integers may cause the other dimension to unexpectedly
                // increase. 535.983,520 => 535.983,520.95, then rounded up to the
                // nearest integer, causing scrollbars.
                // Furthermore, in FF 52 ESR (at least), the actual height of the
                // canvas seems to be a few px more than reported by the Dev Tools,
                // causing scrollbars again. Same issue in Chromium 62 for the map window.
                width = Math.floor(width);
                height = Math.floor(height) - 4;
                this.pixi.renderer.resize(width, height); // Resize method might be on app.renderer or app.screen
                this.fullRefresh();
            }
            else {
                this.pixi.renderer.resize(0, 0); // Resize method might be on app.renderer or app.screen
            }
            return true;
        };
        MumeMapDisplay.prototype.isVisible = function () {
            var visible = this.pixi.renderer.width > 0 && this.pixi.renderer.height > 0; // Or app.screen
            return visible;
        };
        /* Called when all assets are available. Constructs the graphical structure
         * (layers etc) used for rendering and throw all that at the rendering layer
         * (Pixi lib). */
        MumeMapDisplay.prototype.buildMapDisplay = function () {
            // Everything belongs to the map, so we can move it around to emulate
            // moving the viewport
            var map = new PIXI.Container();
            // Rooms live on layers, there is one layer per z coord
            for (var i = this.mapData.metaData.minZ; i <= this.mapData.metaData.maxZ; ++i) {
                var layer = new PIXI.Container();
                this.layers.push(layer);
                map.addChild(layer);
            }
            // Add the current room yellow square
            this.herePointer = Mm2Gfx.buildHerePointer();
            this.herePointer.visible = false;
            map.addChild(this.herePointer);
            // Add a hint for new users instead of a blank grey panel
            this.initialHint = Mm2Gfx.buildInitialHint();
            this.pixi.stage.addChild(this.initialHint);
            // And set the stage
            this.pixi.stage.addChild(map);
            this.pixi.render();
            return;
        };
        MumeMapDisplay.dumpContainer = function (indent, name, what) {
            var indentStr = "";
            while (indent--)
                indentStr += "  ";
            console.log("%s%s: @%d,%d x=b=%d y=c=%d tx=%d ty=%d", indentStr, name, what.x, what.y, what.worldTransform.b, what.worldTransform.c, what.worldTransform.tx, what.worldTransform.ty);
        };
        MumeMapDisplay.prototype.dumpAllCoords = function () {
            MumeMapDisplay.dumpContainer(0, "stage", this.pixi.stage);
            var mapDO = this.pixi.stage.children[0];
            if (!(mapDO instanceof PIXI.Container))
                return;
            var map = mapDO;
            MumeMapDisplay.dumpContainer(1, "map", map);
            for (var i = 0; i < map.children.length; ++i) {
                var name_1 = (i == map.children.length - 1) ? "herePointer" : "layer";
                MumeMapDisplay.dumpContainer(2, name_1, map.children[i]);
            }
        };
        MumeMapDisplay.prototype.roomCoordsToPoint = function (where) {
            return new PIXI.Point(where.x * ROOM_PIXELS, where.y * ROOM_PIXELS);
        };
        MumeMapDisplay.prototype.zeroZ = function (z) {
            return z - this.mapData.metaData.minZ;
        };
        MumeMapDisplay.prototype.layerForCoords = function (coords) {
            var zeroedZ = this.zeroZ(coords.z);
            return this.layers[zeroedZ];
        };
        MumeMapDisplay.prototype.roomCoordsNear = function (where) {
            var coordinates = [];
            for (var i = where.x - 20; i < where.x + 20; ++i) {
                for (var j = where.y - 20; j < where.y + 20; ++j) {
                    for (var k = this.mapData.metaData.minZ; k <= this.mapData.metaData.maxZ; ++k) {
                        var c = new RoomCoords(i, j, k);
                        if (this.roomDisplays.get(c) == null)
                            coordinates.push(c);
                        // Yes, this tight loop is probably horrible for memory & CPU
                    }
                }
            }
            return coordinates;
        };
        /* We want a perspective effect between the layers to emulate 3D rendering.
         * For that purpose, we need to set the pivot of each layer to the current
         * position so that the upper/lower layers are scaled up/down like
         * perspective would.
         *
         * However, PIXI's pivot is actually the anchor point for position, too, so
         * under the hood we shift the layers around. It doesn't affect the rest of
         * the code because it is hidden inside the map/stage abstraction.
         */
        MumeMapDisplay.prototype.repositionLayers = function (where) {
            var z = this.zeroZ(where.z);
            for (var i = 0; i < this.layers.length; ++i) {
                var layer = this.layers[i];
                var localPx = this.roomCoordsToPoint(where);
                localPx.x += ROOM_PIXELS / 2;
                localPx.y += ROOM_PIXELS / 2;
                layer.visible = false;
                layer.scale.set(1, 1); // pivot is affected by scale!
                layer.pivot = layer.position = localPx;
                layer.alpha = 1;
                layer.filters = [];
                if (i === z - 1) // Shrink and darken the lower layer
                 {
                    layer.visible = true;
                    layer.scale.set(0.8, 0.8);
                    if (this.pixi.renderer.type === PIXI.RendererType.WEBGL) // Corrected Enum name
                     {
                        var filter = new PIXI.ColorMatrixFilter(); // Namespace Filters removed
                        filter.brightness(0.4, false);
                        layer.filters = [filter];
                    }
                    else {
                        layer.alpha = 0.6;
                    }
                }
                else if (i === z) {
                    layer.visible = true;
                }
                else if (i === z + 1) // Enlarge and brighten the upper layer
                 {
                    layer.visible = true;
                    layer.scale.set(1.2, 1.2);
                    layer.alpha = 0.1;
                }
                /*console.log("layer[%d].position == %d,%d%s", i, layer.position.x, layer.position.y,
                    ( i === z ? " (active)" : "" ) );*/
            }
        };
        /* Repositions the HerePointer (yellow square), centers the view, and fetches
         * nearby rooms for Pixi. Refreshes the view once done.
         */
        MumeMapDisplay.prototype.repositionTo = function (where) {
            var _this = this;
            this.here = where;
            this.initialHint.visible = false;
            if (!this.isVisible())
                return;
            console.log("Recentering view to (r) %O", where);
            this.herePointer.position = new PIXI.Point(where.x * ROOM_PIXELS, where.y * ROOM_PIXELS);
            this.herePointer.visible = true;
            this.repositionLayers(where);
            // Scroll to make the herePointer visible
            var hpPos = this.herePointer.position;
            this.pixi.stage.x = -hpPos.x + this.pixi.screen.width / 2;
            this.pixi.stage.y = -hpPos.y + this.pixi.screen.height / 2;
            // PIXI.CanvasRenderer doesn't seem to update the stage's transform
            // correctly (not all all, lagging, plain wrong, pick one). This forces
            // a working update.
            this.pixi.stage.toGlobal(new PIXI.Point(0, 0));
            var coordinates = this.roomCoordsNear(where);
            var background = this.mapData.getRoomsAt(coordinates)
                .progress(function (rooms) {
                console.log("repositionHere progress, %d rooms", rooms.length);
                for (var k = 0; k < rooms.length; ++k) {
                    var room = rooms[k];
                    var c = room.coords();
                    var display = Mm2Gfx.buildRoomDisplay(room);
                    if (_this.roomDisplays.get(c) == null) {
                        _this.roomDisplays.set(c, display);
                        _this.layerForCoords(c).addChild(display);
                    }
                }
            });
            background.done(function () { return _this.pixi.render(); });
        };
        MumeMapDisplay.prototype.reshapeInitialHint = function () {
            // if (!this.pixi.renderer) await this.pixi.init(); // Ensure renderer is initialized - app constructor should handle this
            this.initialHint.style.wordWrapWidth = this.pixi.renderer.width - 40;
            var hintSize = this.initialHint.getLocalBounds();
            this.initialHint.pivot.x = hintSize.width / 2;
            this.initialHint.pivot.y = hintSize.height / 2;
            this.initialHint.x = this.pixi.renderer.width / 2;
            this.initialHint.y = this.pixi.renderer.height / 2;
            // this.pixi.render(); // render is usually called by Application's ticker or explicitly after stage changes
        };
        /* Update all graphical elements to match the current position, going as
         * far as fetching rooms if needed. */
        MumeMapDisplay.prototype.fullRefresh = function () {
            if (this.here != null)
                this.repositionTo(this.here);
            else if (this.initialHint.visible)
                this.reshapeInitialHint();
            else
                console.warn("ignoring MumeMapDisplay.fullRefresh(): no position known");
        };
        return MumeMapDisplay;
    }());
    var MumeXmlMode;
    (function (MumeXmlMode) {
        // Not requested. We won't interpret <xml> tags, as players could send us fakes.
        MumeXmlMode[MumeXmlMode["Off"] = 0] = "Off";
        // We will request XML mode as soon as we're done with the login prompt.
        MumeXmlMode[MumeXmlMode["AsSoonAsPossible"] = 1] = "AsSoonAsPossible";
        // We requested XML mode and will enable it as soon as we get a <xml>
        MumeXmlMode[MumeXmlMode["Desirable"] = 2] = "Desirable";
        // We are in XML mode, interpreting <tags>
        MumeXmlMode[MumeXmlMode["On"] = 3] = "On";
    })(MumeXmlMode || (MumeXmlMode = {}));
    var ScoutingState = /** @class */ (function () {
        function ScoutingState() {
            this.active = false;
            // We stop scouting automatically after a bit if somehow we missed the STOP message
            this.scoutingBytes = 0;
        }
        ScoutingState.prototype.pushText = function (text) {
            var startMatch = text.match(ScoutingState.START);
            if (startMatch) {
                var startIndex = startMatch.index;
                if (startIndex === undefined) // Shouldn't happen, but it does keep TS happy
                    startIndex = text.indexOf("You quietly scout");
                this.scoutingBytes = text.length - (startIndex + startMatch[0].length);
                this.active = true;
                console.log("Starting to scout, ignoring new rooms.");
            }
            else if (this.active) {
                this.scoutingBytes += text.length;
                if (text.match(ScoutingState.STOP)) {
                    this.active = false;
                    console.log("Done scouting.");
                }
                else if (this.scoutingBytes > 102400) {
                    this.active = false;
                    console.warn("Force-disabling scout mode after a while");
                }
            }
        };
        ScoutingState.prototype.endTag = function (tag) {
            if (this.active && tag.name === "movement") {
                // This typically happens when scouting a oneway
                this.active = false;
                console.log("Aborting scout because of movement");
            }
        };
        ScoutingState.START = /^You quietly scout (north|east|south|west|up|down)wards\.\.\.\s*$/m;
        ScoutingState.STOP = /^You stop scouting\.\s*$/m;
        return ScoutingState;
    }());
    ;
    /* Filters out the XML-like tags that MUME can send in "XML mode", and sends
     * them as events instead.
     *
     * Sample input:
     * <xml>XML mode is now on.
     * <prompt>!f- CW&gt;</prompt>f
     * You flee head over heels.
     * You flee north.
     * <movement dir=north/>
     * <room><name>A Flat Marsh</name>
     * <description>The few, low patches of tangled rushes add a clear tone to the otherwise sombre
     * colour of this flat marshland. Some puddles are scattered behind them, where
     * there are many pebbles of varying sizes. Most of these pebbles have been
     * covered by a thin layer of dark, green moss.
     * </description>A large green shrub grows in the middle of a large pool of mud.
     * </room><exits>Exits: north, east, south.
     * </exits>
     * <prompt>!%- CW&gt;</prompt>cha xml off
     * </xml>XML mode is now off.
     *
     * Matching event output:
     * { name: "prompt",      attr: "",          text: "!f- CW>" }
     * { name: "movement",    attr: "dir=north", text: "" }
     * { name: "name",        attr: "",          text: "A Flat Marsh" }
     * { name: "description", attr: "",          text: "The few... sombre\n...moss.\n" }
     * { name: "room",        attr: "",          text: "A large green...mud.\n" }
     * { name: "exits",       attr: "",          text: "Exits: north, east, south.\n" }
     * { name: "prompt",      attr: "",          text: "!%- CW>" }
     * { name: "xml",         attr: "",          text: "" }
     *
     * Tag hierarchy does not carry a lot of meaning and is not conveyed in the
     * events sent. The text of the XML is always empty as it would be useless but
     * grow huge over the course of the session.
     *
     * At the time of writing, MUME emits at most 1 attribute for tags encountered
     * during mortal sessions, and never quotes it.
     *
     * One registers to events by calling:
     * parser.on( MumeXmlParser.SIG_TAG_END, function( tag ) { /* Use tag.name etc here *./ } );
     */
    var MumeXmlParser = /** @class */ (function () {
        function MumeXmlParser(decaf) {
            // instanceof doesn't work cross-window
            this.isMumeXmlParser = true;
            this.xmlDesirableBytes = 0;
            this.decaf = decaf;
            this.clear();
        }
        MumeXmlParser.prototype.clear = function () {
            this.tagStack = [];
            this.plainText = "";
            this.mode = MumeXmlMode.Off;
            this.scouting = new ScoutingState();
        };
        MumeXmlParser.prototype.connected = function () {
            this.clear();
            this.mode = MumeXmlMode.AsSoonAsPossible;
        };
        MumeXmlParser.prototype.setXmlModeDesirable = function () {
            this.mode = MumeXmlMode.Desirable;
            this.xmlDesirableBytes = 0;
        };
        MumeXmlParser.prototype.detectXml = function (input) {
            switch (this.mode) {
                case MumeXmlMode.AsSoonAsPossible:
                    if (input.match(MumeXmlParser.ENTER_GAME_LINES)) {
                        // Negociating XML mode at once sends a double login prompt,
                        // which is unsightly as it is the first thing that players
                        // see. WebSockets do not let us send the negociation string
                        // before the MUD outputs anything, like MM2 does.
                        // Wait until we're done with the pre-play to request XML mode +
                        // gratuitous descs. Hopefully, the first screen won't be split
                        // across filterInputText() calls, or we'll have to keep state.
                        this.decaf.socket.write("~$#EX2\n1G\n");
                        this.setXmlModeDesirable();
                        console.log("Negotiating MUME XML mode");
                    }
                // fall through
                case MumeXmlMode.Off:
                    return { text: input, xml: "", };
                case MumeXmlMode.Desirable:
                    var xmlStart = input.indexOf("<xml>", 0);
                    // If somehow XML doesn't get enabled right after we asked for it, at
                    // least the xmlDesirableBytes will reduce the window during which
                    // someone might send us a fake <xml> tag and confuse the parser, which
                    // would be dangerous in the middle of PK for example.
                    if (xmlStart !== -1 && this.xmlDesirableBytes + xmlStart < 1024) {
                        console.log("Enabled MUME XML mode");
                        this.mode = MumeXmlMode.On;
                        return { text: input.substr(0, xmlStart), xml: input.substr(xmlStart), };
                    }
                    if (this.xmlDesirableBytes >= 1024)
                        this.mode = MumeXmlMode.Off;
                    this.xmlDesirableBytes += input.length;
                    return { text: input, xml: "", };
                case MumeXmlMode.On:
                    return { text: "", xml: input, };
            }
        };
        MumeXmlParser.prototype.topTag = function () {
            if (this.tagStack.length == 0)
                return null;
            else
                return this.tagStack[this.tagStack.length - 1];
        };
        // True if the current input is wrapped in <gratuitous>, ie. something for
        // the benefit of the client but that the player doesn't want to see.
        MumeXmlParser.prototype.isGratuitous = function () {
            for (var _i = 0, _a = this.tagStack; _i < _a.length; _i++) {
                var tag = _a[_i];
                if (tag.name === "gratuitous")
                    return true;
            }
            return false;
        };
        MumeXmlParser.prototype.resetPlainText = function () {
            var plainText = this.plainText;
            this.plainText = "";
            return plainText;
        };
        MumeXmlParser.decodeEntities = function (text) {
            var decodedText = text
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&");
            return decodedText;
        };
        /* Takes text with pseudo-XML as input, returns plain text and emits events.
         */
        MumeXmlParser.prototype.filterInputText = function (rawInput) {
            if (this.mode === MumeXmlMode.Off)
                return rawInput;
            var input = this.detectXml(rawInput);
            var matched = false;
            var matches;
            while ((matches = MumeXmlParser.TAG_RE.exec(input.xml)) !== null) {
                var textBefore = void 0, isEnd = void 0, tagName = void 0, attr = void 0, isLeaf = void 0, textAfter = void 0;
                textBefore = matches[1], isEnd = matches[2], tagName = matches[3], attr = matches[4], isLeaf = matches[5], textAfter = matches[6];
                matched = true;
                if (textBefore)
                    this.pushText(textBefore);
                if (isLeaf) {
                    this.startTag(tagName, attr);
                    this.endTag(tagName);
                }
                else if (isEnd) {
                    this.endTag(tagName);
                }
                else {
                    this.startTag(tagName, attr);
                }
                if (textAfter)
                    this.pushText(textAfter);
            }
            if (!matched)
                this.pushText(input.xml);
            return input.text + this.resetPlainText();
        };
        MumeXmlParser.prototype.pushText = function (raw) {
            var text = MumeXmlParser.decodeEntities(raw);
            var topTag = this.topTag();
            this.scouting.pushText(text);
            if (!topTag || topTag.name === "xml") {
                this.plainText += text;
            }
            else {
                if (topTag.text.length + text.length > 1500) {
                    console.warn("Run-away MumeXmlParser tag " +
                        topTag.name + ", force-closing the tag.");
                    this.tagStack.pop();
                }
                if (!this.isGratuitous())
                    this.plainText += text;
                topTag.text += text;
            }
        };
        MumeXmlParser.prototype.startTag = function (tagName, attr) {
            if (this.tagStack.length > 5) {
                var tags = this.tagStack.map(function (t) { return t.name; }).join();
                console.warn("Ignoring MumeXmlParser tag ".concat(tagName, " because of deeply nested tags: ").concat(tags));
                return;
            }
            this.tagStack.push({ name: tagName, attr: attr, text: "" });
        };
        MumeXmlParser.prototype.endTag = function (tagName) {
            if (tagName === "xml") {
                // Most likely, the player typed "cha xml" by mistake. Hopefully he'll
                // reenable it soon, otherwise we prefer to break rather than remain
                // wide open to attack.
                this.setXmlModeDesirable();
            }
            // Find the most recent tag in the stack which matches tagName
            var matchingTagIndex = null;
            for (var i = this.tagStack.length - 1; i >= 0; --i) {
                if (this.tagStack[i].name === tagName) {
                    matchingTagIndex = i;
                    break;
                }
            }
            // Perform some sanity checks
            if (matchingTagIndex == null) {
                console.warn("Ignoring unmatched closing MumeXmlParser tag " + tagName);
                return;
            }
            else if (matchingTagIndex + 1 !== this.tagStack.length) {
                var tags = this.tagStack.slice(matchingTagIndex + 1).map(function (t) { return t.name; }).join();
                console.warn("Closing MumeXmlParser tag " + tagName +
                    " with the following other tags open: " + tags);
                this.tagStack.length = matchingTagIndex + 1;
                // fall through
            }
            var topTag = this.tagStack.pop();
            this.scouting.endTag(topTag);
            if (!this.scouting.active)
                $(this).triggerHandler(MumeXmlParser.SIG_TAG_END, [topTag,]);
        };
        MumeXmlParser.SIG_TAG_END = "tagend";
        MumeXmlParser.ENTER_GAME_LINES = new RegExp(/^Reconnecting\.\s*$/.source + "|" +
            /^Never forget! Try to role-play\.\.\.\s*$/.source, 'm');
        /* Matches a start or end tag and captures the following:
         * 1. any text preceeding the tag
         * 2. "/" if this is an end tag
         * 3. tag name
         * 4. any attributes
         * 5. "/" if this is a leaf tag (IOW, no end tag will follow).
         * 6. any text following the tag
         *
         * Pardon the write-only RE, JavaScript doesn't have /x.
         */
        MumeXmlParser.TAG_RE = /([^<]*)<(\/?)(\w+)(?: ([^/>]+))?(\/?)>([^<]*)/g;
        return MumeXmlParser;
    }());
    Mapper.MumeXmlParser = MumeXmlParser;
})(Mapper || (Mapper = {})); // ns
