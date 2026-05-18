import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import * as crypto from 'crypto';
import { DIRECTIONS, normalizeWhitespace, translitUnicodeToAsciiLikeMMapper } from '../mume.shared';

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
  BRUSH: 12,
  CAVERN: 14,
  CITY: 2,
  DEATHTRAP: 15,
  FIELD: 3,
  FOREST: 4,
  HILLS: 5,
  INDOORS: 1,
  MOUNTAINS: 6,
  RAPIDS: 9,
  ROAD: 11,
  SHALLOW: 7,
  TUNNEL: 13,
  UNDEFINED: 0,
  UNDERWATER: 10,
  WATER: 8,
};

const MobFlagsMap: Record<string, number> = {
  AGGRESSIVE_MOB: 12,
  ARMOUR_SHOP: 3,
  CLERIC_GUILD: 9,
  ELITE_MOB: 15,
  FOOD_SHOP: 4,
  GUILD: 6,
  MAGE_GUILD: 8,
  MILKABLE: 17,
  PASSIVE_MOB: 14,
  PET_SHOP: 5,
  QUEST_MOB: 13,
  RANGER_GUILD: 11,
  RATTLESNAKE: 18,
  RENT: 0,
  SCOUT_GUILD: 7,
  SHOP: 1,
  SUPER_MOB: 16,
  WARRIOR_GUILD: 10,
  WEAPON_SHOP: 2,
};

const LoadFlagsMap: Record<string, number> = {
  ARMOUR: 1,
  ATTENTION: 14,
  BOAT: 13,
  CLOCK: 16,
  COACH: 22,
  DARK_WORD: 20,
  DEATHTRAP: 24,
  EQUIPMENT: 21,
  FERRY: 23,
  FOOD: 4,
  HERB: 5,
  HORSE: 8,
  KEY: 6,
  MAIL: 17,
  MULE: 7,
  PACK_HORSE: 9,
  STABLE: 18,
  TOWER: 15,
  TRAINED_HORSE: 10,
  TREASURE: 0,
  WARG: 12,
  WATER: 3,
  WEAPON: 2,
  WHITE_WORD: 19,
};

const ExitFlagsMap: Record<string, number> = {
  CLIMB: 3,
  DAMAGE: 9,
  DOOR: 1,
  EXIT: 0,
  FALL: 10,
  FLOW: 7,
  GUARDED: 11,
  NO_EXIT: 0, // NO_EXIT is mapped to the EXIT flag (inverted logic in MMapper)
  NO_FLEE: 8,
  NO_MATCH: 6,
  RANDOM: 4,
  ROAD: 2,
  SPECIAL: 5,
  UNMAPPED: 12,
};

const DoorFlagsMap: Record<string, number> = {
  ACTION: 9,
  CALLABLE: 6,
  DELAYED: 5,
  HIDDEN: 0,
  KNOCKABLE: 7,
  MAGIC: 8,
  NEED_KEY: 1,
  NO_BASH: 10,
  NO_BLOCK: 2,
  NO_BREAK: 3,
  NO_PICK: 4,
};

const NUM_EXITS = DIRECTIONS.length;
const DirMap: Record<string, number> = DIRECTIONS.reduce((acc, dir, index) => {
  acc[dir.toLowerCase()] = index;
  return acc;
}, {} as Record<string, number>);

const DIR_ALIAS_MAP: Record<string, string> = {
  d: "down",
  e: "east",
  n: "north",
  ne: "northeast",
  nw: "northwest",
  s: "south",
  se: "southeast",
  sw: "southwest",
  u: "up",
  w: "west",
};

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

function parseFlags(
  flags: string | string[] | undefined,
  map: Record<string, number>,
  context: string,
  category: string,
  unknownFlags: Map<string, Set<string>>,
  strict: boolean
): number {
  if (!flags) return 0;
  const rawFlagArray = Array.isArray(flags) ? flags : [flags];
  const flagArray = rawFlagArray
    .map((f) => (f || "").toString().trim().toUpperCase())
    .filter((f) => f.length > 0);
  let result = 0;
  for (const f of flagArray) {
    if (map[f] !== undefined) {
      result |= (1 << map[f]);
    } else {
      let flagsForCategory = unknownFlags.get(category);
      if (!flagsForCategory) {
        flagsForCategory = new Set<string>();
        unknownFlags.set(category, flagsForCategory);
      }
      if (!flagsForCategory.has(f)) {
        flagsForCategory.add(f);
        const msg = `Unknown flag "${f}" in category "${category}" (first seen in "${context}")`;
        if (strict) {
          throw new Error(msg);
        }
        console.warn(`Warning: ${msg}`);
      }
    }
  }
  return result;
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export interface ConvertOptions {
  strict?: boolean;
}

/**
 * Converts Arda.xml map data into a chunked JSON format.
 * @param xmlPath Path to the Arda.xml file.
 * @param outputDir Directory where the JSON files will be written.
 * @param options Conversion options.
 */
export function convertMap(xmlPath: string, outputDir: string, options: ConvertOptions = {}) {
  const strict = !!options.strict;
  const unknownFlags = new Map<string, Set<string>>();

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
      const rawXmlDir = (exit['@_dir'] || "").toLowerCase();
      const xmlDir = DIR_ALIAS_MAP[rawXmlDir] ?? rawXmlDir;
      const dir = DirMap[xmlDir];
      if (dir !== undefined && dir < NUM_EXITS) {
        jsonExits[dir].name = (exit['@_doorname'] || exit.doorname || "").toString();
        jsonExits[dir].flags = parseFlags(exit.exitflag, ExitFlagsMap, `room ${room['@_id']} exit ${xmlDir}`, 'exitflag', unknownFlags, strict);
        jsonExits[dir].dflags = parseFlags(exit.doorflag, DoorFlagsMap, `room ${room['@_id']} exit ${xmlDir}`, 'dflags', unknownFlags, strict);

        // In the original jsonmapstorage.cpp, "in" and "out" are populated.
        // MM2 XML has "to". In MMapper, an exit is usually bidirectional unless flags say otherwise.
        // MMapper2 XML 'to' contains the destination room ID.
        const toIds = ensureArray(exit.to);
        toIds.forEach(toId => {
          const seqId = xmlIdToSequential.get(toId);
          if (seqId !== undefined) {
            // jsonmapstorage.cpp uses strings for IDs in the arrays too
            (jsonExits[dir].out).push(seqId.toString());
          }
        });
      } else if (rawXmlDir) {
        const msg = `Unrecognized exit direction "${rawXmlDir}" (normalized as "${xmlDir}") in room ${room['@_id']}`;
        if (strict) {
          throw new Error(msg);
        }
        console.warn(`Warning: ${msg}`);
      }
    });

    const terrain = (room.terrain || "UNDEFINED").toString().trim().toUpperCase();
    const light = (room.light || "DARK").toString().trim().toUpperCase();
    const portable = (room.portable || "PORTABLE").toString().trim().toUpperCase();
    const rideable = (room.ridable || "NOT_RIDABLE").toString().trim().toUpperCase();
    const sundeath = (room.sundeath || "NO_SUNDEATH").toString().trim().toUpperCase();

    zones[zoneKey].push({
      x: x,
      y: -y,
      z: z,
      id: index.toString(),
      name: name,
      desc: desc,
      sector: TerrainMap[terrain] || 0,
      light: light === "LIT" ? 1 : 0,
      portable: portable === "NOT_PORTABLE" ? 0 : 1,
      rideable: rideable === "RIDABLE" ? 1 : 0,
      sundeath: sundeath === "SUNDEATH" ? 1 : 0,
      mobflags: parseFlags(room.mobflag, MobFlagsMap, `room ${room['@_id']}`, 'mobflag', unknownFlags, strict),
      loadflags: parseFlags(room.loadflag, LoadFlagsMap, `room ${room['@_id']}`, 'loadflag', unknownFlags, strict),
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
    directions: DIRECTIONS,
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

  if (unknownFlags.size > 0) {
    console.warn("\nSummary of unknown flags encountered:");
    unknownFlags.forEach((flags, category) => {
      console.warn(`  ${category}: ${Array.from(flags).join(", ")}`);
    });
    console.warn("");
  }

  console.log("Conversion complete!");
}

function printUsage() {
  console.log("Usage: npm run convert-map -- [options] <path-to-arda.xml> <output-directory>");
  console.log("");
  console.log("Options:");
  console.log("  --strict    Treat unknown flags or directions as errors");
  console.log("  --help      Show this help message");
}

function runCli() {
  const args = process.argv.slice(2);
  const positionalArgs: string[] = [];
  const options: ConvertOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      console.error(`Error: Unknown option "${arg}"`);
      printUsage();
      process.exit(1);
    } else {
      positionalArgs.push(arg);
    }
  }

  if (positionalArgs.length < 2) {
    console.error("Error: Missing required arguments.");
    printUsage();
    process.exit(1);
  }

  const [xmlPath, outputDir] = positionalArgs;

  try {
    convertMap(xmlPath, outputDir, options);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run the CLI if this script is executed directly
if (require.main === module) {
  runCli();
}
