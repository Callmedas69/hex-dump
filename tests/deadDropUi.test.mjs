import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dead-drop UI supports invitation creation and keyboard-safe retrieval", async () => {
  const ui = await readFile(new URL("../app/dead-drop/page.tsx", import.meta.url), "utf8");
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
