import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dead-drop UI supports invitation creation and keyboard-safe retrieval", async () => {
  const ui = await readFile(new URL("../components/DeadDropWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /decryptDeadDrop/);
  assert.match(ui, /navigator\.clipboard/);
  assert.match(ui, /prefers-reduced-motion/);
  assert.match(ui, /textarea/);
  assert.match(ui, /aria-live/);
  assert.match(ui, /InvitationCreator/);
  assert.match(ui, /href="\/"/);
  assert.match(ui, /Tor Browser/);
  assert.match(ui, /complete link/);
  assert.match(ui, /encrypted message/);
});

test("recipient identity comes from server route params, avoiding hydration mismatch", async () => {
  const route = await readFile(new URL("../app/dead-drop/[id]/page.tsx", import.meta.url), "utf8");
  const ui = await readFile(new URL("../components/DeadDropWorkspace.tsx", import.meta.url), "utf8");
  assert.match(route, /await params/);
  assert.match(route, /retrievalId=\{id\}/);
  assert.doesNotMatch(ui, /window\.location\.(pathname|hostname)/);
});
