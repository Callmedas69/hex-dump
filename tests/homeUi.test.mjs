import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("homepage keeps the converter gated and explains the separate dead-drop entry", async () => {
  const ui = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../components/TerminalHeader.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /through the Onion network/);
  assert.match(header, /href="\/dead-drop"/);
  assert.match(header, /Work with hex\. Share private messages\./);
  assert.match(header, /no wallet needed/);
  assert.doesNotMatch(header, /access\.enterWorkspace|hello-example|CAPABILITY/);
  assert.match(ui, /<SecurityGate/);
  assert.match(ui, /setFormat\(full \? "dump" : "raw"\)/);
  assert.match(ui, /useState<"raw" \| "dump">\("raw"\)/);
});
