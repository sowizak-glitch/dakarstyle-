import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://senecompare.dakarstyle.com';
const OUTPUT = process.env.E2E_OUTPUT_DIR || 'test-results/senecompare-v54';
await fs.mkdir(OUTPUT, { recursive: true });

function expectedCloudflareNoise(text) {
  return /Content Security Policy directive/i.test(text) && /static\.cloudflareinsights\.com|\/cdn-cgi\/challenge-platform|inline script/i.test(text);
}

async function selectCampaign(page, slug) {
  const dots = page.locator('.sc-sponsored-dot');
  for (let index = 0; index < await dots.count(); index += 1) {
    await dots.nth(index).click();
    await page.waitForTimeout(120);
    if (await page.locator('.sc-sponsored-card').getAttribute('data-campaign') === slug) return;
  }
  throw new Error(`Campaign ${slug} not found`);
}

async function runJourney(browser, name, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const response = await page.goto(`${APP_URL}/?v=540&certification=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(response?.status(), 200, `${name}: root status`);
  await page.waitForSelector('#scSponsored[data-premium="5.4.0"]', { state: 'visible', timeout: 30_000 });
  assert.equal(await page.locator('script[src="/premium-ads-v54.js?v=540"]').count(), 1, `${name}: premium script`);
  assert.match(await page.locator('.sc-sponsored-label').innerText(), /Sponsorisé/i, `${name}: sponsor label`);

  await selectCampaign(page, 'samabusiness-launch');
  const sama = page.locator('.sc-sponsored-visual img');
  await sama.waitFor({ state: 'visible' });
  assert.match(await sama.getAttribute('src') || '', /samabusiness-campaign\.webp/);
  assert.ok(await sama.evaluate((image) => image.complete && image.naturalWidth >= 300), `${name}: SamaBusiness image loaded`);

  await selectCampaign(page, 'sowhat-africa-culture');
  const sowhat = page.locator('.sc-sponsored-visual img');
  assert.match(await sowhat.getAttribute('src') || '', /sowhat-africa-campaign\.webp/);
  assert.ok(await sowhat.evaluate((image) => image.complete && image.naturalWidth >= 300), `${name}: Sowhat image loaded`);
  assert.match(await page.locator('.sc-sponsored-content h3').innerText(), /Sénégal/i);

  await selectCampaign(page, 'advertise-on-senecompare');
  await page.locator('.sc-sponsored-action a').click();
  await page.waitForSelector('#scPartnerDialog[open]', { state: 'visible', timeout: 10_000 });
  assert.match(await page.locator('.sc-partner-contact').innerText(), /hellodakarstyle@gmail\.com/);
  await page.locator('#scPartnerDialog > .sc-partner-close').click();
  await page.waitForFunction(() => !document.querySelector('#scPartnerDialog')?.open);
  assert.equal(await page.locator('#scPartnerEmailLink').count(), 1, `${name}: footer contact`);
  await page.screenshot({ path: path.join(OUTPUT, `${name}-premium-public.png`), fullPage: true });

  const adminResponse = await page.goto(`${APP_URL}/admin?v=540`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(adminResponse?.status(), 200, `${name}: admin status`);
  await page.waitForSelector('#scAdminRecovery', { state: 'visible', timeout: 15_000 });
  assert.equal(await page.locator('#adminEmail').inputValue(), 'idrissaminata@gmail.com');
  assert.match(await page.locator('.sc-admin-help').innerText(), /hellodakarstyle@gmail\.com/);
  await page.locator('.sc-recovery-toggle').click();
  await page.locator('#scRecoveryLink').fill('http://localhost:3000/#access_token=abc');
  await page.locator('.sc-recovery-submit').click();
  assert.match(await page.locator('.sc-recovery-status').innerText(), /jeton d’accès/i);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('senecompare.v53.admin.token')), null, `${name}: invalid token not stored`);
  await page.screenshot({ path: path.join(OUTPUT, `${name}-admin-recovery.png`), fullPage: true });

  assert.deepEqual(pageErrors, [], `${name}: page errors`);
  const relevant = consoleErrors.filter((entry) => !expectedCloudflareNoise(entry) && !/favicon|manifest|ResizeObserver/i.test(entry));
  assert.deepEqual(relevant, [], `${name}: console errors`);
  await context.close();
  return { name, consoleErrors: relevant.length, pageErrors: pageErrors.length };
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  results.push(await runJourney(browser, 'desktop', { viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' }));
  results.push(await runJourney(browser, 'samsung', { ...devices['Galaxy S9+'], locale: 'fr-FR' }));
  await fs.writeFile(path.join(OUTPUT, 'report.json'), JSON.stringify({ ok: true, version: '5.4.0', results }, null, 2));
  console.log(JSON.stringify({ ok: true, version: '5.4.0', results }, null, 2));
} finally {
  await browser.close();
}
