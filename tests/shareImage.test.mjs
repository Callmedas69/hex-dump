import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Match Next's extensionless TypeScript import for the native Node test runner.
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./share" && context.parentURL?.endsWith("/lib/shareImage.ts")) {
      return nextResolve("./share.ts", context);
    }
    return nextResolve(specifier, context);
  },
});
const { renderShareImage } = await import("../lib/shareImage.ts");
hook.deregister();

test("PNG rendering omits encode plaintext, preserves bytes and labels excerpts", async t => {
  const calls = [];
  const fontLoads = [];
  const context = {
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText(text, x, y) { assert.equal(fontLoads.length >= 2, true); calls.push({ text, x, y, font: this.font }); },
    measureText(text) { return { width: text.length * 15 }; },
  };
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: callback => callback(new Blob(["canvas-export"], { type: "image/png" })) };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { fonts: { ready: Promise.resolve(), load: async font => { fontLoads.push(font); return []; } }, documentElement: {}, body: {}, createElement: () => canvas } });
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: () => ({ fontFamily: "NokiaBody", getPropertyValue: () => "NokiaTitle" }) });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else delete globalThis.document;
    if (previousStyle) Object.defineProperty(globalThis, "getComputedStyle", previousStyle); else delete globalThis.getComputedStyle;
  });

  const message = "Never reveal the original message";
  const bytes = new TextEncoder().encode(message.repeat(20));
  const snapshot = { bytes, mode: "encode", baseOffset: 4096, selection: { start: 400, end: 450, text: "PRIVATE PLAINTEXT" } };
  const blob = await renderShareImage(snapshot);
  assert.equal(blob.type, "image/png");
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 900);
  assert.deepEqual(fontLoads, ["46px NokiaTitle", "21px NokiaBody"]);
  assert.equal(calls.find(call => call.text === "HEXONION").font, "400 46px NokiaTitle");
  assert.equal(calls.filter(call => call.text === "HEXONION").length, 1);
  assert.equal(calls.some(call => call.text === "Bitcoin hex encoder · decoder · private dead drops"), false);
  assert.ok(calls.some(call => call.text === "Encrypted in your browser" && call.y > 800));
  assert.equal(calls.some(call => /PRIVATE|Never|YOUR TEXT|READABLE BYTES/.test(call.text)), false);
  const renderedBytes = calls.filter(call => /^[0-9A-F]{2}$/.test(call.text));
  assert.equal(renderedBytes.length, 384);
  assert.ok(renderedBytes.every(call => call.font === "21px NokiaBody"));
  assert.deepEqual(renderedBytes.map(call => parseInt(call.text, 16)), Array.from(bytes.slice(0, 384)));
  assert.ok(renderedBytes.every(call => call.x >= 225 && call.x + 30 < 1565 && call.y < 737));
  assert.ok(calls.some(call => call.text === "BYTE EXCERPT / 00001000–0000117f"));

  calls.length = 0;
  await renderShareImage({ ...snapshot, mode: "decode", bytes: bytes.slice(0, 32), baseOffset: 0, selection: { start: 0, end: 5, text: "Visible decoded text" } });
  assert.ok(calls.some(call => call.text === "READABLE BYTES"));
  assert.ok(calls.some(call => call.text === "Visible decoded text"));
});
