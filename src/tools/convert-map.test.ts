import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { convertMap } from './convert-map';
import { Dir } from '../mume.shared';

test('convertMap correctly resolves numeric and string exit destination IDs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-map-test-'));
  const xmlPath = path.join(tmpDir, 'test_arda.xml');
  const outDir = path.join(tmpDir, 'dist');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<map type="mmapper2xml" version="1.0.0">
    <room id="100" server_id="111" name="Entrance">
        <coord x="0" y="0" z="0"/>
        <terrain>CITY</terrain>
        <exit dir="east">
            <to>101</to>
        </exit>
        <exit dir="down">
            <to>102</to>
        </exit>
        <description>Main Entrance</description>
    </room>
    <room id="101" server_id="222" name="Hallway">
        <coord x="1" y="0" z="0"/>
        <terrain>CITY</terrain>
        <exit dir="west">
            <to>100</to>
        </exit>
        <description>Long Hallway</description>
    </room>
    <room id="102" server_id="333" name="Cellar">
        <coord x="0" y="0" z="-1"/>
        <terrain>INDOORS</terrain>
        <exit dir="up">
            <to>100</to>
        </exit>
        <description>Dark Cellar</description>
    </room>
</map>`;

  fs.writeFileSync(xmlPath, xmlContent, 'utf8');

  try {
    convertMap(xmlPath, outDir);

    const metadataPath = path.join(outDir, 'v1', 'arda.json');
    assert.ok(fs.existsSync(metadataPath), 'arda.json metadata file should exist');

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.equal(metadata.roomsCount, 3);

    const zoneFilePath = path.join(outDir, 'v1', 'zone', '0,0.json');
    assert.ok(fs.existsSync(zoneFilePath), 'Zone file 0,0.json should exist');

    const zoneRooms = JSON.parse(fs.readFileSync(zoneFilePath, 'utf8'));
    assert.equal(zoneRooms.length, 3);

    // Room 0 (id="100", index="0")
    const room0 = zoneRooms.find((r: { id: string }) => r.id === '0');
    assert.ok(room0, 'Room 0 should exist');
    assert.deepEqual(room0.exits[Dir.EAST].out, ['1']);
    assert.deepEqual(room0.exits[Dir.DOWN].out, ['2']);

    // Room 1 (id="101", index="1")
    const room1 = zoneRooms.find((r: { id: string }) => r.id === '1');
    assert.ok(room1, 'Room 1 should exist');
    assert.deepEqual(room1.exits[Dir.WEST].out, ['0']);

    // Room 2 (id="102", index="2")
    const room2 = zoneRooms.find((r: { id: string }) => r.id === '2');
    assert.ok(room2, 'Room 2 should exist');
    assert.deepEqual(room2.exits[Dir.UP].out, ['0']);

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
