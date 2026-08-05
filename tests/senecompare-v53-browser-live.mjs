import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://senecompare.dakarstyle.com';
const OUTPUT = process.env.E2E_OUTPUT_DIR || 'test-results/senecompare-v53';
await fs.mkdir(OUTPUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

async function check(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  const response = await page.goto(`${APP_URL}/?v=530&certification=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(response?.status(), 200, `${name}: root status`);
  await page.waitForSelector('#scSponsored', { state: 'visible', timeout: 30_000 });
  assert.equal(await page.locator('.sc-sponsored-card').count(), 1, `${name}: one compact ad card`);
  assert.ok(await page.locator('.sc-sponsored-dot').count() >= 3, `${name}: campaign controls`);
  assert.match(await page.locator('.sc-sponsored-label').innerText(), /Sponsorisé/i, `${name}: transparent label`);
  assert.ok((await page.locator('.sc-sponsored-content h3').innerText()).trim().length > 8, `${name}: campaign title`);
  assert.ok((await page.locator('.sc-sponsored-action a').getAttribute('href') || '').startsWith('https://'), `${name}: safe destination`);

  await page.locator('.sc-sponsored-dot').last().click();
  await page.waitForTimeout(200);
  assert.match(await page.locator('.sc-sponsored-content h3').innerText(), /activité|liggéey/i, `${name}: advertiser campaign`);
  await page.locator('.sc-sponsored-action a').click();
  await page.waitForSelector('#scPartnerDialog[open]', { state: 'visible', timeout: 10_000 });
  assert.equal(await page.locator('#scBusinessName').count(), 1, `${name}: partner form`);
  assert.equal(await page.locator('#scPartnerEmail').getAttribute('type'), 'email', `${name}: lead email`);
  await page.locator('.sc-partner-close').click();

  await page.screenshot({ path: path.join(OUTPUT, `${name}-public.png`), fullPage: true });

  const adminResponse = await page.goto(`${APP_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(adminResponse?.status(), 200, `${name}: admin status`);
  assert.equal(await page.locator('#adminLoginForm').count(), 1, `${name}: admin login`);
  assert.equal(await page.locator('#adminEmail').inputValue(), 'idrissaminata@gmail.com', `${name}: owner email`);
  assert.equal(await page.locator('#adminEmail').isEditable(), false, `${name}: locked owner address`);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content') || '', /noindex/i, `${name}: admin noindex`);
  await page.screenshot({ path: path.join(OUTPUT, `${name}-admin.png`), fullPage: true });

  const relevantErrors = consoleErrors.filter((item) => !/favicon|manifest|ResizeObserver/i.test(item));
  assert.deepEqual(relevantErrors, [], `${name}: browser console errors`);
  results.push({ name, ads: await page.locator('.sc-sponsored-dot').count().catch(() => 0), consoleErrors: relevantErrors });
  await context.close();
}

try {
  await check('desktop', { viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
  await check('samsung', { ...devices['Galaxy S9+'], locale: 'fr-FR' });
} finally {
  await browser.close();
}

await fs.writeFile(path.join(OUTPUT, 'report.json'), JSON.stringify({ ok: true, version: '5.3.0', results }, null, 2));
console.log(JSON.stringify({ ok: true, version: '5.3.0', results }, null, 2));
