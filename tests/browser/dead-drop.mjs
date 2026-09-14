// Production-browser checks. All API calls are intercepted; no real messages or wallet signatures.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || "playwright");
const base = process.env.HEX_TEST_URL || "http://localhost:3100";
const output = resolve("docs/audits/assets/2026-09-14-dead-drop-fixes");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const requests = [];
const id = "a".repeat(32);
let payload;
let failDeposit = true;
let getMode = "ok";
let gets = 0;
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  window.clipboardFails = false;
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async value => {
    if (window.clipboardFails) throw new Error("Test clipboard denied");
    window.copiedLink = value;
  } } });
});
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (url.pathname === "/api/drops" && route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    requests.push(body);
    payload = body.payload;
    if (failDeposit) { failDeposit = false; return route.abort(); }
    return route.fulfill({ status: 201, json: { id, expiresAt: new Date(Date.now() + 86400000).toISOString() } });
  }
  if (url.pathname.startsWith("/api/drops/")) {
    gets++;
    if (getMode === "network") return route.abort();
    if (getMode !== "ok") return route.fulfill({ status: Number(getMode), json: { error: "Synthetic unavailable response" } });
    return route.fulfill({ json: payload });
  }
  if (url.pathname.startsWith("/api/invitations")) throw new Error("Unexpected invitation API call");
  return route.continue();
});
context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
const page = await context.newPage();
const create = () => page.getByRole("button", { name: "Create message link", exact: true });
const status = () => page.locator(".workspace > .notice");
const notes = [];
try {
  await page.goto(`${base}/dead-drop`, { waitUntil: "networkidle" });
  assert.equal(await create().isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Connect Wallet", exact: true }).isVisible(), false);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    await page.screenshot({ path: resolve(output, `sender-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Need an invitation code?", { exact: true }).click();
  if (await page.getByText(/Creating invitation codes is currently unavailable/).count()) {
    notes.push("Unconfigured wallet policy explains the limit and preserves existing-code sending.");
  } else {
    assert.match(await page.locator(".invitation-creator").innerText(), /Required: .* on Robinhood Chain mainnet/);
    if (process.env.HEX_TEST_REQUIREMENT) assert.ok((await page.locator(".invitation-creator").innerText()).includes(process.env.HEX_TEST_REQUIREMENT));
    await page.getByLabel("Messages allowed", { exact: true }).fill("0");
    assert.equal(await page.getByRole("button", { name: "Create invitation code", exact: true }).isDisabled(), true);
    await page.locator(".invitation-creator").getByRole("alert").waitFor();
    notes.push("Configured policy is shown and invalid invitation limits cannot start authorization.");
  }
  await page.screenshot({ path: resolve(output, "invitation-help.png"), fullPage: true });
  await page.getByText("Need an invitation code?", { exact: true }).click();
  await page.locator("#invitation").fill("synthetic-invitation-code-for-local-qa-only");
  await page.locator("#message").fill("🧅".repeat(4097));
  assert.equal(await create().isDisabled(), true);
  assert.match(await page.locator("#message-size").innerText(), /16,388.*Remove at least 4 bytes/);
  await page.locator("#message").fill("🧅".repeat(4096));
  assert.equal(await create().isEnabled(), true);
  const plaintext = "Private browser test 🧅\nHello from HexOnion.";
  await page.locator("#message").fill(plaintext);
  await create().click();
  await page.getByText(/Could not reach the service\. Your message is still here/).waitFor();
  assert.equal(await page.locator("#message").inputValue(), plaintext);
  await create().click();
  await page.getByRole("heading", { name: "YOUR MESSAGE LINK IS READY" }).waitFor();
  assert.deepEqual(requests[0], requests[1], "Lost responses must reuse the encrypted request and idempotency key");
  assert.doesNotMatch(JSON.stringify(requests), /Private browser test|Hello from HexOnion/);
  assert.deepEqual(Object.keys(requests[0]).sort(), ["idempotencyKey", "payload"]);
  const link = await page.locator("#message-link").inputValue();
  assert.match(link, /\/dead-drop\/[a-f0-9]{32}#[A-Za-z0-9_-]{43}$/);
  assert.equal(await page.getByRole("link", { name: "Open message", exact: true }).getAttribute("href"), link);
  await page.getByRole("button", { name: "Copy message link", exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedLink), link);
  await page.evaluate(() => { window.clipboardFails = true; });
  await page.getByRole("button", { name: "Copy message link", exact: true }).click();
  assert.match(await status().innerText(), /Clipboard unavailable/);
  assert.equal(await page.locator("#message-link").evaluate(el => el.selectionEnd - el.selectionStart), link.length);
  await page.screenshot({ path: resolve(output, "sender-success.png"), fullPage: true });
  await page.getByRole("link", { name: "Open message", exact: true }).click();
  await page.getByRole("heading", { name: "A PRIVATE MESSAGE FOR YOU" }).waitFor();
  assert.equal(await page.locator("#invitation").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Connect Wallet", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  await page.locator(".dead-drop-plaintext").waitFor();
  assert.equal(await page.locator(".dead-drop-plaintext").innerText(), plaintext);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "YOUR MESSAGE");
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, "recipient-open.png"), fullPage: true });
  notes.push("Real browser encryption/decryption, private API payload, retry identity, link opening, and both clipboard paths passed.");

  const beforeMissing = gets;
  await page.goto(link.split("#")[0]);
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  await page.getByText(/missing a valid decryption key/).waitFor();
  assert.equal(gets, beforeMissing);
  await page.goto(`${base}/dead-drop/invalid#${"A".repeat(43)}`);
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  await page.getByText(/incomplete or invalid/).waitFor();
  assert.equal(gets, beforeMissing);
  await page.goto(`${link.split("#")[0]}#${"A".repeat(43)}`);
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  await page.getByText(/This key could not unlock/).waitFor();
  for (const [mode, expected] of [["404", /It may have expired/], ["503", /Try opening it again in a moment/], ["network", /Check your connection, then try/]]) {
    getMode = mode;
    await page.goto(link);
    await page.getByRole("button", { name: "Open message", exact: true }).click();
    await page.getByText(expected).waitFor();
    assert.equal(await page.getByRole("button", { name: "Open message", exact: true }).isEnabled(), true);
  }
  getMode = "ok";
  await page.getByRole("button", { name: "Open message", exact: true }).click();
  await page.locator(".dead-drop-plaintext").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(link);
  assert.equal(await page.locator(".workspace").isVisible(), true);
  await page.getByRole("button", { name: "Motion on", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Motion off", exact: true }).getAttribute("aria-pressed"), "false");
  assert.deepEqual(errors, [], "No browser errors or React hydration mismatches");
  notes.push("UTF-8 limits, four mobile/desktop widths, missing/invalid/wrong keys, unavailable/network recovery, reduced motion and hydration passed.");
  await writeFile(resolve(output, "results.json"), JSON.stringify({ notes, errors, deposits: requests.length, retrievals: gets }, null, 2));
  console.log(notes.join("\n"));
} finally { await browser.close(); }
