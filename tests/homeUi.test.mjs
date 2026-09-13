import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("homepage presents public X and private Onion paths in plain language", async () => {
  const ui = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(ui, /Share encoded hex on X/);
  assert.match(ui, /share the result publicly on X/);
  assert.match(ui, /Send a private message through the Onion network/);
  assert.match(ui, /encrypt it in your browser/);
  assert.match(ui, /sender needs USDG access/);
  assert.match(ui, /href="#hex-workspace"/);
  assert.match(ui, /href="\/dead-drop"/);
});
