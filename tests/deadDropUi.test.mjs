import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dead-drop UI supports keyboard-safe local retrieval and no wallet provider", async () => {
  const ui = await readFile(new URL("../app/dead-drop/page.tsx", import.meta.url), "utf8");
  assert.match(ui, /decryptDeadDrop/);
  assert.match(ui, /navigator\.clipboard/);
  assert.match(ui, /prefers-reduced-motion/);
  assert.match(ui, /textarea/);
  assert.match(ui, /aria-live/);
  assert.doesNotMatch(ui, /useAccount|RainbowKit|Providers/);
});
