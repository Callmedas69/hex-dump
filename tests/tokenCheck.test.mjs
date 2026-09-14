import test from "node:test";
import assert from "node:assert/strict";
import { runTokenCheck, runTokenCheckWithFallback, TokenCheckTimeoutError } from "../lib/tokenCheck.ts";

test("a closed public RPC falls back to the wallet while a successful zero balance does not", async () => {
  const signal = new AbortController().signal;
  let calls = 0;
  const wallet = async () => { calls++; return [501403n, 6, "USDG"]; };
  assert.deepEqual(await runTokenCheckWithFallback(async () => { throw new Error("ERR_CONNECTION_CLOSED"); }, wallet, signal), [501403n, 6, "USDG"]);
  assert.deepEqual(await runTokenCheckWithFallback(async () => [0n, 6, "USDG"], wallet, signal), [0n, 6, "USDG"]);
  assert.equal(calls, 1);
});

test("a stalled public RPC leaves time for wallet recovery and late public responses are ignored", async () => {
  let finish;
  const check = runTokenCheckWithFallback(() => new Promise(resolve => { finish = resolve; }), async () => [0n, 6, "USDG"], new AbortController().signal, 10, 100);
  assert.deepEqual(await check, [0n, 6, "USDG"]);
  finish([501403n, 6, "USDG"]);
  assert.deepEqual(await check, [0n, 6, "USDG"]);
});

test("wallet fallback failures stay locked and hung wallets share the overall deadline", async () => {
  const signal = new AbortController().signal;
  const primary = async () => { throw new Error("Connection closed"); };
  await assert.rejects(runTokenCheckWithFallback(primary, async () => { throw new Error("Wallet RPC unavailable"); }, signal), /Wallet RPC unavailable/);
  await assert.rejects(runTokenCheckWithFallback(primary, () => new Promise(() => {}), signal, 10, 20), TokenCheckTimeoutError);
});

test("cancelling the primary check never starts a wallet fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  const check = runTokenCheckWithFallback(() => new Promise(() => {}), async () => { calls++; }, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(check, { name: "AbortError" });
  assert.equal(calls, 0);
});

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
