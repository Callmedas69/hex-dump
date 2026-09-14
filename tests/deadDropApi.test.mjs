import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dead-drop API contract keeps secrets server-side", async () => {
  const post = await readFile(new URL("../app/api/drops/route.ts", import.meta.url), "utf8");
  const get = await readFile(new URL("../app/api/drops/[id]/route.ts", import.meta.url), "utf8");
  assert.match(post, /Bearer/);
  assert.match(post, /no-store/);
  assert.match(post, /MAX_ENVELOPE_BYTES/);
  assert.match(post, /idempotencyKey/);
  assert.doesNotMatch(get, /key|plaintext/i);
  assert.match(get, /no-store/);
});
