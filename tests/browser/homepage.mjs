// Run against a production server. RPC and wallet responses are isolated test doubles.
// PLAYWRIGHT_MODULE_URL may point to an already installed Playwright module.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encodeFunctionResult, decodeFunctionData, erc20Abi, multicall3Abi } from "viem";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || "playwright");
const base = process.env.HEX_TEST_URL || "http://localhost:3100";
const unavailable = process.argv.includes("--unavailable");
const walletRpcChecks = process.argv.includes("--wallet-rpc");
const tokenChecks = walletRpcChecks || process.argv.includes("--token-check");
const output = resolve(walletRpcChecks ? "docs/audits/assets/2026-09-14-wallet-rpc" : tokenChecks ? "docs/audits/assets/2026-09-14-token-check" : "docs/audits/assets/2026-09-14-homepage-two-tools");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const observations = [];
const errors = [];
const blockedExternalUrls = new Set();
const expectedNetworkErrors = [];
let balance = 10000n;
let failRpc = false;
let closeRpc = false;
let hangRpc = false;
const heldRpc = [];
let symbol = "USDG";
let xConfigured = false;
let postCount = 0;
const rpcCalls = [];

function contractResult(data) {
  if (data.startsWith("0x82ad56cb")) {
    const { args } = decodeFunctionData({ abi: multicall3Abi, data });
    return encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: args[0].map(call => ({ success: true, returnData: contractResult(call.callData) })) });
  }
  const fn = { "0x70a08231": ["balanceOf", balance], "0x313ce567": ["decimals", 6], "0x95d89b41": ["symbol", symbol] }[data.slice(0, 10)];
  assert.ok(fn, `Unexpected contract call: ${data.slice(0, 10)}`);
  return encodeFunctionResult({ abi: erc20Abi, functionName: fn[0], result: fn[1] });
}

async function createPage(viewport = { width: 1440, height: 1000 }, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(() => {
    const listeners = new Map();
    const wallet = {
      connected: false, chain: "0x1237", chainReply: null, requests: [], calls: [], replies: null,
      account: `0x${"1".repeat(40)}`,
      emit(event, value) { for (const cb of listeners.get(event) || []) cb(value); },
      setChain(chain) { this.chain = chain; this.emit("chainChanged", chain); },
      setAccount(lastDigit) { this.account = `0x${"1".repeat(39)}${lastDigit}`; this.emit("accountsChanged", [this.account]); },
      disconnect() { this.connected = false; this.emit("accountsChanged", []); },
    };
    window.hexTestWallet = wallet;
    window.ethereum = {
      isMetaMask: true,
      on(event, cb) { const list = listeners.get(event) || []; list.push(cb); listeners.set(event, list); },
      removeListener(event, cb) { listeners.set(event, (listeners.get(event) || []).filter(item => item !== cb)); },
      async request({ method, params }) {
        wallet.requests.push(method);
        if (method === "eth_requestAccounts") { wallet.connected = true; return [wallet.account]; }
        if (method === "eth_accounts") return wallet.connected ? [wallet.account] : [];
        if (method === "eth_chainId") return wallet.chainReply || wallet.chain;
        if (method === "eth_call" && wallet.replies) {
          wallet.calls.push(params[0]);
          const result = wallet.replies[params[0].data.slice(0, 10)];
          if (result) return result;
        }
        if (method === "wallet_switchEthereumChain") { wallet.setChain(params[0].chainId); return null; }
        if (method === "wallet_requestPermissions") { wallet.connected = true; return [{ parentCapability: "eth_accounts" }]; }
        if (method === "wallet_getPermissions") return wallet.connected ? [{ parentCapability: "eth_accounts" }] : [];
        const error = new Error(`Test wallet does not support ${method}`); error.code = 4200; throw error;
      },
    };
    // Standard discovery makes wagmi use its injected connector rather than a wallet SDK.
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: {
      info: { uuid: "c00a0000-0000-4000-8000-000000000001", name: "Test Wallet", rdns: "dev.hexonion.test", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" },
      provider: window.ethereum,
    } }));
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/x/")) {
      if (url.pathname === "/api/x/post") postCount++;
      return route.fulfill({ json: { configured: xConfigured, connected: false } });
    }
    if (route.request().method() === "POST" && !url.pathname.startsWith("/api/")) {
      let requests;
      try { requests = route.request().postDataJSON(); } catch { return route.continue(); }
      if (Array.isArray(requests) || requests?.jsonrpc) {
        if (closeRpc) { blockedExternalUrls.add(url.href); return route.abort("connectionclosed"); }
        const reply = request => {
          rpcCalls.push(request.method);
          if (failRpc && request.method === "eth_call") return { jsonrpc: "2.0", id: request.id, error: { code: -32000, message: "Simulated RPC failure" } };
          const result = request.method === "eth_call" ? contractResult(request.params[0].data)
            : request.method === "eth_chainId" ? "0x1237" : request.method === "eth_blockNumber" ? "0x100" : "0x0";
          return { jsonrpc: "2.0", id: request.id, result };
        };
        const json = Array.isArray(requests) ? requests.map(reply) : reply(requests);
        if (hangRpc) { heldRpc.push({ route, json }); return; }
        return route.fulfill({ json });
      }
    }
    if (url.origin !== new URL(base).origin) {
      blockedExternalUrls.add(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const url = message.location().url;
    if (/^Failed to load resource: net::ERR_(FAILED|CONNECTION_CLOSED)$/.test(message.text()) && blockedExternalUrls.has(url)) {
      const parsed = new URL(url);
      expectedNetworkErrors.push(`${parsed.origin}${parsed.pathname}`);
    } else errors.push(`${message.text()} (${url})`);
  });
  return page;
}

async function settle(page) { await page.waitForTimeout(1500); }
async function shot(page, name, fullPage = true) { await page.screenshot({ path: resolve(output, `${name}.png`), fullPage }); }
async function focused(page, id) { await page.waitForFunction(value => document.activeElement?.id === value, id); }
async function visibleWorkspace(page, visible) { await page.locator("#hex-workspace").waitFor({ state: visible ? "visible" : "hidden" }); }
async function connect(page) {
  await page.locator("#hex-access").getByRole("button", { name: "Connect Wallet", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  const walletButton = page.getByRole("dialog").getByRole("button", { name: /Test Wallet|Injected|Browser Wallet/i }).first();
  if (!await walletButton.count()) throw new Error(`Wallet choices: ${await page.getByRole("dialog").innerText()}`);
  await walletButton.click();
}

try {
  for (const [width, height] of process.argv.includes("--flow-only") ? [] : [[320, 844], [390, 844], [768, 1024], [1440, 1000]]) {
    console.log(`Checking layout ${width}px`);
    const page = await createPage({ width, height });
    await page.goto(base, { waitUntil: "networkidle" });
    await settle(page);
    const metrics = await page.evaluate(() => {
      const actions = [...document.querySelectorAll(".tool-choices .tool-entry")].map(element => element.getBoundingClientRect());
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, actionBottom: Math.max(...actions.map(action => action.bottom)), actionHeight: Math.min(...actions.map(action => action.height)), actionCount: actions.length };
    });
    assert.equal(metrics.documentWidth, width, `Overflow at ${width}px`);
    assert.ok(metrics.actionHeight >= 44);
    assert.equal(metrics.actionCount, 2);
    assert.ok(metrics.actionBottom <= height, `Tool actions below fold at ${width}px: ${metrics.actionBottom}`);
    assert.equal(await page.locator(".hero-message").innerText(), "Work with hex. Share private messages.");
    assert.equal(await page.locator(".home-header #hex-access").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Open hex tool", exact: true }).count(), 0);
    assert.equal(await page.locator(".task-choice-actions").first().getByRole("link", { name: "See a Bitcoin example ↓", exact: true }).count(), 1);
    assert.match(await page.title(), /Hex Tools & Private Message Links/);
    await shot(page, `${unavailable ? "unavailable" : "configured"}-${width}`);
    if (width === 390) await shot(page, `${unavailable ? "unavailable" : "configured"}-390-first-screen`, false);
    await page.getByRole("link", { name: "Explore hex tool ↓", exact: true }).click();
    await focused(page, "hex-tool-title");
    await page.getByRole("link", { name: /See a Bitcoin example/ }).click();
    assert.equal(await page.locator("#bitcoin-example").getAttribute("open"), "");
    assert.match(await page.locator(".example-content").innerText(), /131/);
    assert.match(await page.locator(".example-content pre").innerText(), /00000000/);
    assert.equal(await page.evaluate(() => window.hexTestWallet.requests.includes("eth_requestAccounts")), false);
    await page.getByRole("button", { name: "Decode hex", exact: true }).focus();
    await page.keyboard.press("Enter");
    await focused(page, "hex-access-title");
    await visibleWorkspace(page, false);
    if (unavailable) {
      assert.equal(await page.locator("#hex-access").getByRole("button", { name: "Connect Wallet" }).count(), 0);
      assert.match(await page.locator("#hex-access").innerText(), /temporarily unavailable/);
    }
    observations.push({ name: "layout", ...metrics, unavailable });
    await page.close();
  }

  const reduced = await createPage({ width: 390, height: 844 }, "reduce");
  await reduced.goto(base, { waitUntil: "networkidle" });
  await shot(reduced, "reduced-motion");
  assert.equal(await reduced.locator(".hero-message").isVisible(), true);
  await reduced.getByRole("button", { name: "Motion on", exact: true }).click();
  assert.equal(await reduced.locator("main").getAttribute("data-motion"), "off");
  await shot(reduced, "motion-off");
  await reduced.close();

  const bookmark = await createPage();
  console.log("Checking legacy fragment");
  await bookmark.goto(`${base}/#hex-workspace`, { waitUntil: "networkidle" });
  await focused(bookmark, "hex-access-title");
  await visibleWorkspace(bookmark, false);
  await bookmark.close();
  observations.push({ name: "legacy fragment and reduced motion", passed: true });

  const zoom = await createPage({ width: 720, height: 500 });
  await zoom.goto(base, { waitUntil: "networkidle" });
  // A 1440x1000 viewport at 200% zoom has a 720x500 CSS layout viewport.
  const cdp = await zoom.context().newCDPSession(zoom);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 720, height: 500, deviceScaleFactor: 2, mobile: false });
  assert.equal(await zoom.evaluate(() => document.documentElement.scrollWidth), 720);
  await zoom.getByRole("link", { name: "Explore hex tool ↓", exact: true }).focus();
  await zoom.keyboard.press("Enter");
  await focused(zoom, "hex-tool-title");
  await shot(zoom, "zoom-200-equivalent");
  await zoom.close();
  observations.push({ name: "200% zoom equivalent reflow", cssViewport: "720x500", passed: true });

  const privatePage = await createPage({ width: 390, height: 844 });
  await privatePage.goto(base, { waitUntil: "networkidle" });
  const deadDropEntry = privatePage.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Dead drop", exact: true });
  assert.equal(await deadDropEntry.isVisible(), true);
  assert.equal(await privatePage.locator('[aria-labelledby="dead-drop-choice-title"]').isVisible(), true);
  assert.match(await privatePage.locator('[aria-labelledby="dead-drop-choice-title"]').innerText(), /24 hours[\s\S]*invitation code/);
  await deadDropEntry.focus();
  await privatePage.keyboard.press("Enter");
  await privatePage.waitForURL(`${base}/dead-drop`);
  await privatePage.getByRole("link", { name: "← Home / Bitcoin hex", exact: true }).click();
  await privatePage.getByRole("link", { name: "Open Dead drop →", exact: true }).click();
  await privatePage.waitForURL(`${base}/dead-drop`);
  await settle(privatePage);
  assert.equal(await privatePage.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(await privatePage.getByRole("button", { name: "Create message link", exact: true }).isDisabled(), true);
  await shot(privatePage, "dead-drop-smoke");
  await privatePage.close();
  observations.push({ name: "public dead-drop discovery, keyboard navigation, return and shared CSS", passed: true });

  if (walletRpcChecks && !unavailable) {
    console.log("Checking wallet RPC fallback after a closed public connection");
    const page = await createPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const setWalletReplies = async () => {
      await page.evaluate(replies => { window.hexTestWallet.replies = replies; }, Object.fromEntries(["0x70a08231", "0x313ce567", "0x95d89b41"].map(selector => [selector, contractResult(selector)])));
    };
    balance = 501403n;
    await setWalletReplies();
    closeRpc = true;
    await page.getByRole("button", { name: "Decode hex", exact: true }).click();
    await connect(page);
    await visibleWorkspace(page, true);
    assert.match(await page.locator(".clearance-detail").innerText(), /0.501403 USDG/);
    const calls = await page.evaluate(() => window.hexTestWallet.calls);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.to.toLowerCase() === "0x5fc5360d0400a0fd4f2af552add042d716f1d168"));
    assert.ok(calls.some(call => call.data === `0x70a08231${"1".repeat(40).padStart(64, "0")}`));
    await shot(page, "wallet-recovered");
    balance = 0n;
    await setWalletReplies();
    await page.evaluate(() => window.hexTestWallet.setAccount("2"));
    await page.getByRole("heading", { name: "More USDG is needed", exact: true }).waitFor();
    await visibleWorkspace(page, false);
    balance = 501403n;
    symbol = "OTHER";
    await setWalletReplies();
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await page.getByText("The token details could not be verified.", { exact: false }).waitFor();
    await visibleWorkspace(page, false);
    symbol = "USDG";
    await setWalletReplies();
    await page.evaluate(() => { window.hexTestWallet.chainReply = "0x1"; });
    const readsBefore = await page.evaluate(() => window.hexTestWallet.calls.length);
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await page.getByRole("heading", { name: "We couldn't check your balance", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.hexTestWallet.calls.length), readsBefore, "Wrong-chain wallet must not read balances");
    await visibleWorkspace(page, false);
    // A completely stalled HTTP endpoint must also leave time for wallet recovery.
    await page.evaluate(() => { window.hexTestWallet.chainReply = null; });
    closeRpc = false;
    hangRpc = true;
    const started = Date.now();
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await visibleWorkspace(page, true);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 12000, `Wallet fallback took ${elapsed}ms`);
    const requests = await page.evaluate(() => window.hexTestWallet.requests);
    assert.equal(requests.some(method => /sign|sendTransaction/i.test(method)), false);
    hangRpc = false;
    for (const held of heldRpc.splice(0)) await held.route.fulfill({ json: held.json }).catch(() => {});
    balance = 10000n;
    observations.push({ name: "closed/stalled public RPC recovers through wallet; zero balance, metadata and actual chain are enforced", elapsed, calls, requests, passed: true });
    await page.close();
  }

  if (tokenChecks && !unavailable) {
    console.log("Checking stalled RPC, cancellation and offline recovery");
    const page = await createPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Decode hex", exact: true }).click();
    hangRpc = true;
    const started = Date.now();
    await connect(page);
    await page.getByRole("heading", { name: "Checking your balance…", exact: true }).waitFor();
    await page.getByRole("button", { name: "Check again", exact: true }).waitFor({ timeout: 16000 });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 17000, `Stalled balance read took ${elapsed}ms to become actionable`);
    await visibleWorkspace(page, false);
    assert.match(await page.locator("#hex-access").innerText(), /couldn't read your balance|did not respond within 12 seconds/);
    await shot(page, "rpc-unavailable");
    // Retry, then change wallets before the old read returns.
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await page.waitForTimeout(300);
    hangRpc = false;
    balance = 0n;
    await page.evaluate(() => window.hexTestWallet.setAccount("8"));
    await page.getByRole("heading", { name: "More USDG is needed", exact: true }).waitFor();
    for (const held of heldRpc.splice(0)) await held.route.fulfill({ json: held.json }).catch(() => {});
    await page.waitForTimeout(300);
    await visibleWorkspace(page, false);
    assert.match(await page.locator("#hex-access").innerText(), /Your balance: 0 USDG/);
    balance = 10000n;
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await visibleWorkspace(page, true);
    await focused(page, "hex-input");
    await page.locator("#hex-input").fill("48 69");
    await page.context().setOffline(true);
    await page.evaluate(() => { window.dispatchEvent(new Event("offline")); window.hexTestWallet.setAccount("9"); });
    await page.getByRole("heading", { name: "You're offline", exact: true }).waitFor();
    await visibleWorkspace(page, false);
    assert.equal(await page.getByRole("button", { name: "Waiting for connection", exact: true }).isDisabled(), true);
    await shot(page, "offline");
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await visibleWorkspace(page, true);
    assert.equal(await page.locator("#hex-input").inputValue(), "48 69");
    observations.push({ name: "stalled RPC ends, stale wallet result ignored, zero balance and offline/reconnect recovery", elapsed, passed: true });
    await page.close();
  }

  if (!unavailable) {
    console.log("Checking wallet flow");
    const page = await createPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Decode hex", exact: true }).click();
    await focused(page, "hex-access-title");
    await connect(page);
    console.log("Wallet connected; awaiting access");
    await visibleWorkspace(page, true);
    await focused(page, "hex-input");
    assert.equal(await page.getByRole("button", { name: "Decode hex → text", exact: true }).getAttribute("aria-pressed"), "true");
    await page.locator("#hex-input").fill("00 48 65 6C 6C 6F");
    await page.getByRole("button", { name: "Encode text → hex", exact: true }).click();
    await page.locator("#hex-input").fill("Private test message");
    await page.getByRole("button", { name: "Decode hex → text", exact: true }).click();
    assert.equal(await page.locator("#hex-input").inputValue(), "00 48 65 6C 6C 6F");
    await page.locator("#hex-input").focus();
    balance = 0n;
    await page.evaluate(() => window.hexTestWallet.setAccount("2"));
    await visibleWorkspace(page, false);
    await focused(page, "hex-access-title");
    await page.getByRole("heading", { name: "More USDG is needed" }).waitFor();
    balance = 10000n;
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await visibleWorkspace(page, true);
    assert.equal(await page.locator("#hex-input").inputValue(), "00 48 65 6C 6C 6F");
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), "hex-input");
    await page.locator("#hex-input").focus();
    failRpc = true;
    await page.evaluate(() => window.hexTestWallet.setAccount("3"));
    await visibleWorkspace(page, false);
    await page.getByRole("heading", { name: "We couldn't check your balance", exact: true }).waitFor();
    failRpc = false;
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await visibleWorkspace(page, true);
    await page.getByRole("button", { name: "Encode text → hex", exact: true }).click();
    assert.equal(await page.locator("#hex-input").inputValue(), "Private test message");
    await page.locator("#hex-input").fill("Hi");
    await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").locator("img").waitFor();
    const imageSize = await page.getByRole("dialog").locator("img").evaluate(img => [img.naturalWidth, img.naturalHeight]);
    assert.deepEqual(imageSize, [1600, 900]);
    assert.doesNotMatch(await page.locator("#share-post-text").inputValue(), /Hi|Private test message/);
    assert.match(await page.getByRole("dialog").innerText(), /Direct posting is unavailable\. Download/);
    assert.equal(await page.getByRole("button", { name: "Connect X", exact: true }).count(), 0);
    await shot(page, "share-unconfigured");
    await page.getByRole("button", { name: "Close share preview" }).click();
    xConfigured = true;
    await page.getByRole("button", { name: "Preview sharing", exact: true }).click();
    await page.getByRole("button", { name: "Connect X", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Post to X", exact: true }).count(), 0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Decode hex → text", exact: true }).click();
    await page.locator("#hex-input").fill("FF");
    await page.getByRole("button", { name: "Text including emoji (UTF-8)", exact: true }).click();
    await page.getByText("Choose another output view", { exact: true }).waitFor();
    await page.locator("#hex-input").fill("4");
    await page.getByText("Complete the final byte", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Preview sharing", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.getByText("Paste hex to begin", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Load Bitcoin example", exact: true }).click();
    assert.equal(await page.getByRole("combobox", { name: "Input format" }).inputValue(), "dump");
    assert.match(await page.locator("#hex-input").inputValue(), /^00000000/);
    await page.getByRole("button", { name: "Hex dump", exact: true }).click();
    await settle(page);
    await shot(page, "workspace-desktop");
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `Workspace overflow at ${width}`);
      await shot(page, `workspace-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.hexTestWallet.setChain("0x1"));
    await visibleWorkspace(page, false);
    await page.getByRole("button", { name: "Switch network", exact: true }).click();
    await visibleWorkspace(page, true);
    symbol = "OTHER";
    await page.evaluate(() => window.hexTestWallet.setAccount("4"));
    await visibleWorkspace(page, false);
    await page.getByText("The token details could not be verified.", { exact: false }).waitFor();
    symbol = "USDG";
    await page.getByRole("button", { name: "Check again", exact: true }).click();
    await visibleWorkspace(page, true);
    await page.evaluate(() => window.hexTestWallet.disconnect());
    await visibleWorkspace(page, false);
    const walletRequests = await page.evaluate(() => window.hexTestWallet.requests);
    assert.equal(walletRequests.some(method => /sign|sendTransaction/i.test(method)), false);
    observations.push({ name: "access, draft, workspace and sharing transitions", passed: true, imageSize, walletRequests });
    await page.close();
  }
  assert.equal(postCount, 0);
  assert.deepEqual(errors, []);
  observations.push({ name: "network", postCount, rpcMethods: [...new Set(rpcCalls)], errors, intentionallyBlockedExternalResources: [...new Set(expectedNetworkErrors)] });
  await writeFile(resolve(output, unavailable ? "unavailable-results.json" : "browser-results.json"), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify(observations, null, 2));
} catch (error) {
  const page = browser.contexts().flatMap(context => context.pages()).at(-1);
  if (page) {
    await shot(page, "failure");
    console.error(await page.locator("body").innerText());
    console.error("Wallet requests", await page.evaluate(() => window.hexTestWallet?.requests));
    console.error("RPC requests", [...new Set(rpcCalls)]);
  }
  throw error;
} finally {
  await browser.close();
}
