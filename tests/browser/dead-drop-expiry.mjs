// Production-browser regressions. API requests are intercepted; no live messages are created.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encryptDeadDrop } from "../../lib/deadDropCrypto.ts";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || "playwright");
const base = process.env.HEX_TEST_URL || "http://localhost:3100";
const output = resolve("docs/audits/assets/2026-09-14-automatic-purge");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const text = "Synthetic message that must disappear.";
const encrypted = await encryptDeadDrop(text);
const id = "a".repeat(32);
const link = `${base}/dead-drop/${id}#${encrypted.key}`;
const now = new Date("2026-09-14T12:00:00Z");
const deadline = new Date(now.getTime() + 30000).toISOString();

async function makePage({ expiresAt = deadline, delayDecrypt = false } = {}) {
  const context = await browser.newContext();
  if (delayDecrypt) await context.addInitScript(() => {
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    crypto.subtle.decrypt = async (...args) => {
      const result = await decrypt(...args);
      window.decryptReady = true;
      await new Promise(resolve => { window.finishDecrypt = resolve; });
      return result;
    };
  });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname === "/api/drops") return route.fulfill({ status: 201, json: { id, expiresAt } });
    if (url.pathname.startsWith("/api/drops/")) return route.fulfill({ json: { ...encrypted.envelope, expiresAt }, headers: { "Cache-Control": "no-store" } });
    if (url.pathname.startsWith("/api/")) throw new Error("Unexpected API request");
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: now });
  return page;
}

async function open(page) {
  await page.goto(link, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open message", exact: true }).click();
}
async function expired(page) {
  await page.getByRole("heading", { name: "MESSAGE EXPIRED", exact: true }).waitFor();
  assert.equal(await page.locator(".dead-drop-plaintext").count(), 0);
  assert.equal(await page.locator("#message-link").count(), 0);
  assert.equal(await page.evaluate(() => location.hash), "");
}

try {
  const reader = await makePage();
  await open(reader);
  await reader.locator(".dead-drop-plaintext").waitFor();
  assert.equal(await reader.locator(".dead-drop-plaintext").innerText(), text);
  await reader.clock.fastForward(60000);
  await expired(reader);
  assert.equal(await reader.evaluate(() => document.activeElement?.textContent), "MESSAGE EXPIRED");
  await reader.screenshot({ path: resolve(output, "recipient-expired.png"), fullPage: true });
  results.push("Already-open plaintext and URL key clear at expiry.");
  await reader.context().close();

  const sender = await makePage();
  await sender.goto(`${base}/dead-drop`, { waitUntil: "networkidle" });
  await sender.locator("#invitation").fill("synthetic-invitation-code-for-local-qa-only");
  await sender.locator("#message").fill(text);
  await sender.getByRole("button", { name: "Create message link", exact: true }).click();
  await sender.locator("#message-link").waitFor();
  await sender.clock.fastForward(60000);
  await expired(sender);
  await sender.screenshot({ path: resolve(output, "sender-expired.png"), fullPage: true });
  await sender.getByRole("button", { name: "Create another message", exact: true }).click();
  assert.equal(await sender.locator("#message").inputValue(), "");
  results.push("Sender link and key clear at expiry; a new message starts empty.");
  await sender.context().close();

  for (const event of ["focus", "visibilitychange", "pageshow"]) {
    const page = await makePage();
    await open(page);
    await page.locator(".dead-drop-plaintext").waitFor();
    // Change wall time without firing timers, as can happen while a device sleeps.
    await page.clock.setSystemTime(new Date(now.getTime() + 60000));
    await page.evaluate(event => (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event)), event);
    await expired(page);
    await page.context().close();
  }
  results.push("Focus, visibility restoration and pageshow enforce expiry after suspended timers.");

  const late = await makePage({ expiresAt: new Date(now.getTime() - 1000).toISOString() });
  await open(late);
  await expired(late);
  await late.context().close();
  const decrypting = await makePage({ delayDecrypt: true });
  await open(decrypting);
  await decrypting.waitForFunction(() => window.decryptReady);
  await decrypting.clock.fastForward(60000);
  await decrypting.evaluate(() => window.finishDecrypt());
  await expired(decrypting);
  await decrypting.context().close();
  results.push("Responses and decryption finishing after expiry never reveal plaintext.");

  const missing = await makePage({ expiresAt: "invalid-date" });
  await open(missing);
  await missing.getByText("The message expiry could not be verified. Try opening it again.").waitFor();
  assert.equal(await missing.locator(".dead-drop-plaintext").count(), 0);
  await missing.context().close();
  results.push("Invalid expiry fails closed.");
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, "browser-results.json"), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
