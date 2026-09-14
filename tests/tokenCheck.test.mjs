import test from "node:test";
import assert from "node:assert/strict";
import { runTokenCheck, TokenCheckTimeoutError } from "../lib/tokenCheck.ts";

test("token checks return results and preserve RPC failures", async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await runTokenCheck(async () => [10000n, 6, "USDG"], signal), [10000n, 6, "USDG"]);
  const error = new Error("RPC unavailable");
  await assert.rejects(runTokenCheck(async () => { throw error; }, signal), candidate => candidate === error);
});

test("an unresponsive token check times out and a late result cannot turn it into success", async () => {
  let finish;
  const check = runTokenCheck(() => new Promise(resolve => { finish = resolve; }), new AbortController().signal, 20);
  await assert.rejects(check, TokenCheckTimeoutError);
  finish([10000n, 6, "USDG"]);
  await assert.rejects(check, TokenCheckTimeoutError);
});

test("cancelled wallet checks discard stale results and already-cancelled checks never start", async () => {
  const controller = new AbortController();
  let finish;
  const check = runTokenCheck(() => new Promise(resolve => { finish = resolve; }), controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(check, { name: "AbortError" });
  finish([10000n, 6, "USDG"]);
  await assert.rejects(check, { name: "AbortError" });
  let called = false;
  await assert.rejects(runTokenCheck(async () => { called = true; }, controller.signal), { name: "AbortError" });
  assert.equal(called, false);
});
