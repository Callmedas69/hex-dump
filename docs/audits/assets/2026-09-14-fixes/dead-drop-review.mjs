import { chromium } from 'file:///C:/Users/herryanto/.claude/skills/gstack/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(12000);
const errors = [];
const id = 'a'.repeat(32);
let envelope;
let sendCalls = 0;
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  window.reviewCopied = '';
  window.reviewFailClipboard = false;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
    if (window.reviewFailClipboard) throw Error('Test clipboard failure');
    window.reviewCopied = text;
  } } });
});
await page.route('**/api/drops**', async route => {
  if (route.request().method() === 'POST') {
    sendCalls++;
    envelope = route.request().postDataJSON().payload;
    return route.fulfill({ json: { id, expiresAt: '2026-09-15T12:00:00.000Z' } });
  }
  return route.fulfill({ json: envelope });
});
try {
  await page.goto('http://localhost:3100/dead-drop', { waitUntil: 'networkidle' });
  await page.locator('#invitation').fill('synthetic-review-invitation-00000000000000');
  await page.locator('#message').fill('Synthetic review message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Copy HTTPS link' }).waitFor();
  await page.getByRole('button', { name: 'Open message', exact: true }).click();
  const senderError = await page.locator('.notice').innerText();
  const senderUrl = page.url();
  await page.evaluate(() => { window.reviewFailClipboard = true; });
  await page.getByRole('button', { name: 'Copy HTTPS link' }).click();
  const clipboardNotice = await page.locator('.notice').innerText();
  const visibleUrl = await page.locator('body').innerText();
  await page.screenshot({ path: fileURLToPath(new URL('dead-drop-sender-after-send.png', import.meta.url)), fullPage: true });
  await page.evaluate(() => { window.reviewFailClipboard = false; });
  await page.getByRole('button', { name: 'Copy HTTPS link' }).click();
  const copied = await page.evaluate(() => window.reviewCopied);
  await page.goto(copied, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open message', exact: true }).waitFor();
  const recipientIntro = await page.locator('.intro').first().innerText();
  await page.getByRole('button', { name: 'Open message', exact: true }).click();
  await page.getByText('Synthetic review message', { exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('dead-drop-recipient.png', import.meta.url)), fullPage: true });
  const result = {
    scope: 'Mocked deposit/retrieval API with actual browser encryption. No real service writes, wallet, or Tor.',
    sendCalls, senderUrl, senderError, clipboardNotice,
    fullLinkVisibleForManualCopy: visibleUrl.includes(`#${copied.split('#')[1]}`),
    recipientIntro, recipientDecryptionPassed: true, errors,
  };
  await writeFile(new URL('dead-drop-review.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
