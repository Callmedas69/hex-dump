// Observational expiry audit: records current behavior without modifying production data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encryptDeadDrop } from '../../lib/deadDropCrypto.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || 'playwright');
const base = process.env.HEX_TEST_URL || 'http://localhost:3100';
const output = resolve('docs/audits/assets/2026-09-14-dead-drop-expiry');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const plaintext = 'Synthetic expiry audit message.';
  const encrypted = await encryptDeadDrop(plaintext);
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  let expired = false;
  let reads = 0;
  const errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname.startsWith('/api/drops/')) {
      reads++;
      return route.fulfill({ status: expired ? 404 : 200, json: expired ? { error: 'Transmission unavailable.' } : { ...encrypted.envelope, expiresAt }, headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) throw new Error('Unexpected API request');
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(expiresAt).getTime() - 30000 });
  const messageLink = `${base}/dead-drop/${'a'.repeat(32)}#${encrypted.key}`;
  await page.goto(messageLink, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open message', exact: true }).click();
  await page.locator('.dead-drop-plaintext').waitFor();
  assert.equal(await page.locator('.dead-drop-plaintext').innerText(), plaintext);
  const initialReads = reads;
  expired = true;
  await page.clock.fastForward(60000);
  const remainsVisibleAfterExpiry = await page.locator('.dead-drop-plaintext').isVisible();
  const readsAfterExpiry = reads - initialReads;
  const browserStorage = await page.evaluate(() => ({ localKeys: Object.keys(localStorage), sessionKeys: Object.keys(sessionStorage) }));
  await page.screenshot({ path: resolve(output, 'opened-message-after-expiry.png'), fullPage: true });
  await page.goto(messageLink, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open message', exact: true }).click();
  await page.getByText(/This message is unavailable\. It may have expired/).waitFor();
  assert.equal(await page.locator('.dead-drop-plaintext').count(), 0);
  await page.screenshot({ path: resolve(output, 'expired-link-reopened.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = { simulatedApi: true, realBrowserEncryption: true, remainsVisibleAfterExpiry, readsAfterExpiry, reopenedExpiredResponseHidesMessage: true, browserStorage, errors };
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
