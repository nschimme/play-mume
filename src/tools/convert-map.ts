import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import * as crypto from 'crypto';

// Types for Arda.xml
interface XmlMap {
  map: {
    room: XmlRoom[];
  };
}

interface XmlRoom {
  '@_id': string;
  '@_name'?: string;
  name?: string;
  description?: string;
  coord: {
    '@_x': string;
    '@_y': string;
    '@_z': string;
  };
  terrain?: string;
  light?: string;
  portable?: string;
  ridable?: string;
  sundeath?: string;
  mobflag?: string | string[];
  loadflag?: string | string[];
  exit?: XmlExit | XmlExit[];
}

interface XmlExit {
  '@_dir': string;
  '@_doorname'?: string;
  doorname?: string;
  to?: string | string[];
  doorflag?: string | string[];
  exitflag?: string | string[];
}

interface ZoneRoom {
  x: number;
  y: number;
  z: number;
  id: string;
  name: string;
  desc: string;
  sector: number;
  light: number;
  portable: number;
  rideable: number;
  sundeath: number;
  mobflags: number;
  loadflags: number;
  exits: {
    name: string;
    dflags: number;
    flags: number;
    in: string[];
    out: string[];
  }[];
}

// Enums and Constants matching MMapper
const ZONE_WIDTH = 20;
const ROOM_INDEX_FILE_NAME_SIZE = 2;

const TerrainMap: Record<string, number> = {
  UNDEFINED: 0,
  INDOORS: 1,
  CITY: 2,
  FIELD: 3,
  FOREST: 4,
  HILLS: 5,
  MOUNTAINS: 6,
  SHALLOW: 7,
  WATER: 8,
  RAPIDS: 9,
  UNDERWATER: 10,
  ROAD: 11,
  BRUSH: 12,
  TUNNEL: 13,
  CAVERN: 14,
  DEATHTRAP: 15,
};

const MobFlagsMap: Record<string, number> = {
  RENT: 0,
  SHOP: 1,
  WEAPON_SHOP: 2,
  ARMOUR_SHOP: 3,
  FOOD_SHOP: 4,
  PET_SHOP: 5,
  GUILD: 6,
  SCOUT_GUILD: 7,
  MAGE_GUILD: 8,
  CLERIC_GUILD: 9,
  WARRIOR_GUILD: 10,
  RANGER_GUILD: 11,
  AGGRESSIVE_MOB: 12,
  QUEST_MOB: 13,
  PASSIVE_MOB: 14,
  ELITE_MOB: 15,
  SUPER_MOB: 16,
  MILKABLE: 17,
  RATTLESNAKE: 18,
};

const LoadFlagsMap: Record<string, number> = {
  TREASURE: 0,
  ARMOUR: 1,
  WEAPON: 2,
  WATER: 3,
  FOOD: 4,
  HERB: 5,
  KEY: 6,
  MULE: 7,
  HORSE: 8,
  PACK_HORSE: 9,
  TRAINED_HORSE: 10,
  ROHIRRIM: 11,
  WARG: 12,
  BOAT: 13,
  ATTENTION: 14,
  TOWER: 15,
  CLOCK: 16,
  MAIL: 17,
  STABLE: 18,
  WHITE_WORD: 19,
  DARK_WORD: 20,
  EQUIPMENT: 21,
  COACH: 22,
  FERRY: 23,
  DEATHTRAP: 24,
};

const ExitFlagsMap: Record<string, number> = {
  EXIT: 0,
  DOOR: 1,
  ROAD: 2,
  CLIMB: 3,
  RANDOM: 4,
  SPECIAL: 5,
  NO_MATCH: 6,
  FLOW: 7,
  NO_FLEE: 8,
  DAMAGE: 9,
  FALL: 10,
  GUARDED: 11,
  UNMAPPED: 12,
};

const DoorFlagsMap: Record<string, number> = {
  HIDDEN: 0,
  NEED_KEY: 1,
  NO_BLOCK: 2,
  NO_BREAK: 3,
  NO_PICK: 4,
  DELAYED: 5,
  CALLABLE: 6,
  KNOCKABLE: 7,
  MAGIC: 8,
  ACTION: 9,
  NO_BASH: 10,
};

const DirMap: Record<string, number> = {
  north: 0,
  south: 1,
  east: 2,
  west: 3,
  up: 4,
  down: 5,
  unknown: 6,
  none: 7,
};

const NUM_EXITS = 8;

// Utility functions
function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

// Adapted from mume.mapper.ts
function translitUnicodeToAsciiLikeMMapper(unicode: string): string {
  const table = [
    /*192*/ 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I',
    /*208*/ 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'x', 'O', 'U', 'U', 'U', 'U', 'Y', 'b', 'B',
    /*224*/ 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i',
    /*248*/ 'o', 'n', 'o', 'o', 'o', 'o', 'o', ':', 'o', 'u', 'u', 'u', 'u', 'y', 'b', 'y',
  ];

  let ascii = "";
  for (const charString of unicode) {
    const ch = charString.charCodeAt(0);
    if (ch > 128) {
      if (ch < 192)
        ascii += "z"; // sic
      else
        ascii += table[ch - 192];
    } else {
      ascii += charString;
    }
  }
  return ascii;
}

function normalizeForHash(text: string): string {
  // MMapper removes ANSI marks, but Arda.xml shouldn't have them?
  // Just in case, we'll keep it simple as Arda.xml is usually clean.
  return translitUnicodeToAsciiLikeMMapper(text);
}

function getHash(name: string, desc: string): string {
  const normName = normalizeForHash(name);
  const normDesc = normalizeForHash(normalizeWhitespace(desc));
  const namedesc = normName + "\n" + normDesc;
  return crypto.createHash('md5').update(namedesc).digest('hex');
}

function getZoneKey(x: number, y: number): string {
  const calcZoneCoord = (n: number) => {
    return Math.floor(n / ZONE_WIDTH) * ZONE_WIDTH;
  };
  // y is negated in JSON format
  return `${calcZoneCoord(x)},${calcZoneCoord(-y)}`;
}

function parseFlags(flags: string | string[] | undefined, map: Record<string, number>): number {
  if (!flags) return 0;
  const flagArray = Array.isArray(flags) ? flags : [flags];
  let result = 0;
  for (const f of flagArray) {
    if (map[f] !== undefined) {
      result |= (1 << map[f]);
    }
  }
  return result;
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

async function convert(xmlPath: string, outputDir: string) {
  console.log(`Loading ${xmlPath}...`);
  const xmlData = fs.readFileSync(xmlPath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
      const alwaysArray = [
        'map.room',
        'map.room.exit',
        'map.room.exit.to',
        'map.room.exit.doorflag',
        'map.room.exit.exitflag',
        'map.room.mobflag',
        'map.room.loadflag',
      ];
      return alwaysArray.includes(jpath.toString());
    },
  });
  const parsed: XmlMap = parser.parse(xmlData);

  if (!parsed.map || !parsed.map.room) {
    throw new Error("Invalid XML format");
  }

  const rooms = parsed.map.room;
  console.log(`Processing ${rooms.length} rooms...`);

  const zones: Record<string, ZoneRoom[]> = {};
  const roomIndex: Record<string, Record<string, number[][]>> = {};
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // We need to map XML room IDs (can be large) to 0-based sequential IDs for the JSON format
  const xmlIdToSequential = new Map<string, number>();
  rooms.forEach((room, index) => {
    xmlIdToSequential.set(room['@_id'], index);
  });

  rooms.forEach((room, index) => {
    const name = (room['@_name'] || room.name || "").toString();
    const desc = (room.description || "").toString();
    const x = parseInt(room.coord['@_x'], 10);
    const y = parseInt(room.coord['@_y'], 10);
    const z = parseInt(room.coord['@_z'], 10);

    minX = Math.min(minX, x);
    minY = Math.min(minY, -y); // Negate y for bounds
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, -y); // Negate y for bounds
    maxZ = Math.max(maxZ, z);

    const hash = getHash(name, desc);
    const prefix = hash.substring(0, ROOM_INDEX_FILE_NAME_SIZE);
    if (!roomIndex[prefix]) roomIndex[prefix] = {};
    if (!roomIndex[prefix][hash]) roomIndex[prefix][hash] = [];
    roomIndex[prefix][hash].push([x, -y, z]);

    const zoneKey = getZoneKey(x, y);
    if (!zones[zoneKey]) zones[zoneKey] = [];

    const jsonExits = new Array(NUM_EXITS).fill(null).map(() => ({
      name: "",
      dflags: 0,
      flags: 0,
      in: [] as string[],
      out: [] as string[],
    }));

    ensureArray(room.exit).forEach(exit => {
      const dir = DirMap[exit['@_dir']];
      if (dir !== undefined && dir < NUM_EXITS) {
        jsonExits[dir].name = (exit['@_doorname'] || exit.doorname || "").toString();
        jsonExits[dir].flags = parseFlags(exit.exitflag, ExitFlagsMap);
        jsonExits[dir].dflags = parseFlags(exit.doorflag, DoorFlagsMap);

        // In the original jsonmapstorage.cpp, "in" and "out" are populated.
        // MM2 XML has "to". In MMapper, an exit is usually bidirectional unless flags say otherwise.
        // MMapper2 XML 'to' contains the destination room ID.
        const toIds = ensureArray(exit.to);
        toIds.forEach(toId => {
          const seqId = xmlIdToSequential.get(toId);
          if (seqId !== undefined) {
            // jsonmapstorage.cpp uses strings for IDs in the arrays too
            (jsonExits[dir].out as unknown as string[]).push(seqId.toString());
          }
        });
      }
    });

    zones[zoneKey].push({
      x: x,
      y: -y,
      z: z,
      id: index.toString(),
      name: name,
      desc: desc,
      sector: TerrainMap[room.terrain || "UNDEFINED"] || 0,
      light: room.light === "LIT" ? 1 : 0,
      portable: room.portable === "NOT_PORTABLE" ? 0 : 1,
      rideable: room.ridable === "RIDABLE" ? 1 : 0,
      sundeath: room.sundeath === "SUNDEATH" ? 1 : 0,
      mobflags: parseFlags(room.mobflag, MobFlagsMap),
      loadflags: parseFlags(room.loadflag, LoadFlagsMap),
      exits: jsonExits,
    });
  });

  // Write files
  const v1Dir = path.join(outputDir, 'v1');
  const zoneDir = path.join(v1Dir, 'zone');
  const roomIndexDir = path.join(v1Dir, 'roomindex');

  fs.mkdirSync(zoneDir, { recursive: true });
  fs.mkdirSync(roomIndexDir, { recursive: true });

  console.log("Writing metadata...");
  const metadata = {
    roomsCount: rooms.length,
    minX, minY, minZ,
    maxX, maxY, maxZ,
    directions: ["NORTH", "SOUTH", "EAST", "WEST", "UP", "DOWN", "UNKNOWN", "NONE"],
  };
  fs.writeFileSync(path.join(v1Dir, 'arda.json'), JSON.stringify(metadata, null, 2));

  console.log("Writing zones...");
  for (const [key, data] of Object.entries(zones)) {
    fs.writeFileSync(path.join(zoneDir, `${key}.json`), JSON.stringify(data));
  }

  console.log("Writing room index...");
  for (const [prefix, data] of Object.entries(roomIndex)) {
    fs.writeFileSync(path.join(roomIndexDir, `${prefix}.json`), JSON.stringify(data));
  }

  console.log("Conversion complete!");
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: npm run convert-map -- <path-to-arda.xml> <output-directory>");
  process.exit(1);
}

convert(args[0], args[1]).catch(err => {
  console.error(err);
  process.exit(1);
});
