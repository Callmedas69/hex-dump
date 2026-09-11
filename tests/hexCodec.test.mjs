import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  decodeAscii,
  decodeUtf8,
  discoverTextRuns,
  encodeText,
  formatDump,
  parseOffsetDump,
  parseRawHex,
  toHex,
} from "../lib/hexCodec.ts";
import {
  GENESIS_BLOCK_HEX,
  GENESIS_HEADER_HEX,
  GENESIS_MESSAGE,
  GENESIS_MESSAGE_HEX,
  GENESIS_TRANSACTION_HEX,
} from "../lib/fixtures/bitcoinGenesis.ts";

test("Genesis fixture is the canonical 285-byte block", () => {
  assert.equal(GENESIS_BLOCK_HEX.length / 2, 285);
  assert.equal(GENESIS_HEADER_HEX.length / 2, 80);
  assert.equal(GENESIS_TRANSACTION_HEX.length / 2, 204);
  assert.equal(GENESIS_BLOCK_HEX.slice(162), GENESIS_TRANSACTION_HEX);
  assert.equal(GENESIS_MESSAGE_HEX.length / 2, 69);
  assert.equal(parseRawHex(GENESIS_BLOCK_HEX).bytes.length, 285);
  assert.equal(GENESIS_BLOCK_HEX.slice(262, 262 + 138), GENESIS_MESSAGE_HEX);
  assert.equal(GENESIS_MESSAGE, "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks");
  const sha256d = (hex) => createHash("sha256").update(createHash("sha256").update(Buffer.from(hex, "hex")).digest()).digest().reverse().toString("hex");
  assert.equal(sha256d(GENESIS_HEADER_HEX), "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f");
  assert.equal(sha256d(GENESIS_TRANSACTION_HEX), "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
});

test("raw hex accepts whitespace and preserves a zero-prefixed byte", () => {
  const parsed = parseRawHex("00 0a\n ff");
  assert.deepEqual([...parsed.bytes], [0, 10, 255]);
  assert.equal(toHex(parsed.bytes), "00 0a ff");
});

test("raw hex reports and ignores an odd trailing half-byte", () => {
  const parsed = parseRawHex("deadb");
  assert.deepEqual([...parsed.bytes], [0xde, 0xad]);
  assert.match(parsed.warning, /half-byte/);
  assert.throws(() => parseRawHex("gg"), /Invalid hex character/);
});

test("offset dumps parse contiguous rows and preserve a nonzero base", () => {
  const parsed = parseOffsetDump("00000010  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f\n00000020  ff");
  assert.equal(parsed.baseOffset, 0x10);
  assert.deepEqual([...parsed.bytes], [...Array.from({ length: 16 }, (_, i) => i), 255]);
  assert.throws(() => parseOffsetDump("00000000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f\n00000011  01"), /discontinuity/);
  assert.throws(() => parseOffsetDump("00000000  00 01\n00000002  01"), /exactly 16/);
});

test("formatted dumps use zero-padded offsets and grouped rows", () => {
  assert.equal(formatDump(Uint8Array.from([0, 1, 254]), 0x10, 2), "00000010  00 01\n00000012  fe");
  assert.throws(() => formatDump(new Uint8Array(), 0, 0), /between 1 and 64/);
});

test("UTF-8 decoding handles BOM and emoji while ASCII masks controls", () => {
  const utf8 = new TextEncoder().encode("\ufeffHi 🌈");
  assert.equal(decodeUtf8(utf8), "\ufeffHi 🌈");
  assert.equal(decodeAscii(Uint8Array.from([0x1f, 0x20, 0x7e, 0x7f])), ". ~.");
  assert.throws(() => decodeUtf8(Uint8Array.from([0xc3, 0x28])), /encoded data/);
});

test("text discovery returns printable candidate ranges and honors minimum", () => {
  const bytes = Uint8Array.from([0, ...new TextEncoder().encode("hello"), 1, ...new TextEncoder().encode("abc")]);
  assert.deepEqual(discoverTextRuns(bytes, 4), [{ start: 1, end: 6, text: "hello" }]);
  const genesis = parseRawHex(GENESIS_BLOCK_HEX).bytes;
  const candidates = discoverTextRuns(genesis, 4);
  assert.ok(candidates.some(({ text }) => text.includes(GENESIS_MESSAGE)));
  const candidate = candidates.find(({ text }) => text.includes(GENESIS_MESSAGE));
  assert.equal(candidate.start, 130);
  assert.equal(candidate.end, 200);
});

test("encoding and parsing enforce byte limits", () => {
  assert.deepEqual([...encodeText("é")], [0xc3, 0xa9]);
  assert.throws(() => encodeText("abcd", 3), /3 byte limit/);
  assert.throws(() => parseRawHex("000102", 2), /2 byte limit/);
  assert.throws(() => parseOffsetDump("00000000  00 01", 1), /1 byte limit/);
});
