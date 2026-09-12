/*!
 * DecafMUD Unit Tests
 */

import assert from 'node:assert';
import test from 'node:test';

import {
  DecafMUD,
  EventEmitter,
  GMCPTelopt,
  UTF8Encoding,
  ISO88591Encoding,
  ISO885915Encoding,
  CP437Encoding,
  NAWSHandler,
  TTYPEHandler,
} from './index';

test('EventEmitter registers, emits, and unregisters events', () => {
  const emitter = new EventEmitter();
  let calledCount = 0;
  let receivedData: unknown = null;

  const handler = (data: unknown) => {
    calledCount++;
    receivedData = data;
  };

  const unbind = emitter.on('test-event', handler);
  emitter.emit('test-event', { payload: 123 });

  assert.strictEqual(calledCount, 1);
  assert.deepStrictEqual(receivedData, { payload: 123 });

  unbind();
  emitter.emit('test-event', { payload: 456 });

  assert.strictEqual(calledCount, 1);
});

test('GMCPTelopt registers, dispatches, and unregisters handlers', () => {
  // Mock dummy decaf instance
  const dummyDecaf = {
    id: 1,
    version: { toString: () => '0.9.0' },
    sendIAC: () => {},
    debugString: () => {},
    emit: () => {},
  } as unknown as DecafMUD;

  const gmcp = new GMCPTelopt(dummyDecaf);
  let roomInfoReceived: unknown = null;

  const unregister = gmcp.registerHandler('Room.Info', (data) => {
    roomInfoReceived = data;
  });

  gmcp._sb('Room.Info {"num":1234,"name":"Market"}');
  assert.deepStrictEqual(roomInfoReceived, { num: 1234, name: 'Market' });

  unregister();
  roomInfoReceived = null;
  gmcp._sb('Room.Info {"num":5678,"name":"Square"}');
  assert.strictEqual(roomInfoReceived, null);
});

test('Encodings encode and decode text properly', () => {
  // UTF-8
  const [decodedUtf8] = UTF8Encoding.decode('Hello World');
  assert.strictEqual(decodedUtf8, 'Hello World');

  // ISO-8859-1
  const [decodedIso1] = ISO88591Encoding.decode('TestString');
  assert.strictEqual(decodedIso1, 'TestString');

  // ISO-8859-15 (Euro sign)
  const [decodedEuro] = ISO885915Encoding.decode(String.fromCharCode(0xa4));
  assert.strictEqual(decodedEuro, '€');
  const encodedEuro = ISO885915Encoding.encode('€');
  assert.strictEqual(encodedEuro, String.fromCharCode(0xa4));

  // CP437
  const [decodedCp437] = CP437Encoding.decode(String.fromCharCode(1));
  assert.strictEqual(decodedCp437, '☺');
});

test('Telnet option handlers generate correct IAC subnegotiations', () => {
  const sentIACs: string[] = [];
  const dummyDecaf = {
    id: 1,
    version: { toString: () => '0.9.0' },
    options: {
      ttypes: ['testclient'],
      encoding: 'utf8',
      encoding_order: ['utf8'],
    },
    display: {
      getSize: () => [80, 24],
    },
    sendIAC: (seq: string) => {
      sentIACs.push(seq);
    },
    debugString: () => {},
    setEncoding: () => {},
  } as unknown as DecafMUD;

  // TTYPE
  const ttype = new TTYPEHandler(dummyDecaf);
  ttype._sb('\x01'); // SEND
  assert.strictEqual(sentIACs.length, 1);
  assert.ok(sentIACs[0].includes('testclient'));

  // NAWS
  sentIACs.length = 0;
  const naws = new NAWSHandler(dummyDecaf);
  naws.enabled = true;
  naws.send();
  assert.strictEqual(sentIACs.length, 1);
  assert.strictEqual(sentIACs[0].charCodeAt(0), 255); // IAC
});
