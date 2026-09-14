import test from "node:test";
import assert from "node:assert/strict";
import { workspaceStatus, outputHelp } from "../lib/workspacePresentation.ts";

test("workspace status never reports ready for malformed, incomplete or undecodable input", () => {
  const input = { mode: "decode", byteCount: 2 };
  assert.equal(workspaceStatus(input), "Result ready");
  assert.notEqual(workspaceStatus({ ...input, outputError: "Invalid UTF-8" }), "Result ready");
  assert.equal(workspaceStatus({ ...input, warning: "Incomplete", outputError: "Invalid" }), "Complete the final byte");
  assert.equal(workspaceStatus({ ...input, byteCount: 0, error: "Malformed", warning: "Incomplete" }), "Check your input");
  assert.equal(workspaceStatus({ mode: "encode", byteCount: 0 }), "Enter text to begin");
  assert.equal(workspaceStatus({ mode: "decode", byteCount: 0 }), "Paste hex to begin");
});

test("output help tracks the selected decoding view and resets for encoding", () => {
  assert.match(outputHelp("decode", "ascii"), /dots/);
  assert.match(outputHelp("decode", "utf8"), /emoji/);
  assert.match(outputHelp("decode", "dump"), /row positions/);
  for (const view of ["ascii", "utf8", "dump"]) {
    assert.equal(outputHelp("encode", view), outputHelp("encode", "ascii"));
  }
});
