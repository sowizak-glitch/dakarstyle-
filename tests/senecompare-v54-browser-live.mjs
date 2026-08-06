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

async function showCampaign(page, slug) {
  const dots = page.locator('.sc-sponsored-dot');
  for (let index = 0; index < await dots.count(); index += 1) {
    await dots.nth(index).click();
    await page.waitForTimeout(180);
    if (await page.locator('.sc-sponsored-card').getAttribute('data-campaign') === slug) return;
  }
  throw new Error(`Campaign ${slug} not found`);
}

async function verify(name, options) {
  const context = await browser.newContext({ ...options, locale: 'fr-FR' });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const root = await page.goto(`${APP_URL}/?v=540&certification=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(root?.status(), 200, `${name}: root status`);
  await page.waitForSelector('#scSponsored', { state: 'visible', timeout: 30_000 });
  assert.equal(await page.locator('script[src="/monetization-v54.js?v=540"]').count(), 1, `${name}: premium script`);
  assert.match(await page.locator('.sc-sponsored-label').innerText(), /Sponsorisé/i, `${name}: sponsor disclosure`);

  await showCampaign(page, 'samabusiness-launch');
  const sama = page.locator('.sc-sponsored-visual img');
  await sama.waitFor({ state: 'visible', timeout: 10_000 });
  assert.match(await sama.getAttribute('src') || '', /samabusiness-campaign\.webp/);
  assert.ok(await sama.evaluate((image) => image.complete && image.naturalWidth >= 300), `${name}: SamaBusiness visual`);

  await showCampaign(page, 'sowhat-africa-culture');
  const sowhat = page.locator('.sc-sponsored-visual img');
  assert.match(await sowhat.getAttribute('src') || '', /sowhat-africa-campaign\.jpg/);
  assert.ok(await sowhat.evaluate((image) => image.complete && image.naturalWidth >= 300), `${name}: Sowhat Africa visual`);

  await showCampaign(page, 'advertise-on-senecompare');
  await page.locator('.sc-sponsored-action a').click();
  await page.waitForSelector('#scPartnerDialog[open]', { state: 'visible', timeout: 10_000 });
  assert.match(await page.locator('.sc-partner-contact').innerText(), /hellodakarstyle@gmail\.com/);
  assert.match(await page.locator('.sc-partner-email-action').getAttribute('href') || '', /^mailto:hellodakarstyle@gmail\.com/);
  await page.locator('#scPartnerDialog > .sc-partner-close').click();
  await page.waitForFunction(() => !document.querySelector('#scPartnerDialog')?.open);
  await page.screenshot({ path: path.join(OUTPUT, `${name}-campaigns.png`), fullPage: true });

  const admin = await page.goto(`${APP_URL}/admin?v=540`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(admin?.status(), 200, `${name}: admin status`);
  await page.waitForSelector('#adminLinkRecovery', { state: 'visible', timeout: 15_000 });
  assert.equal(await page.locator('#adminEmail').inputValue(), 'idrissaminata@gmail.com');
  assert.match(await page.locator('.sc-auth-help-link').innerText(), /hellodakarstyle@gmail\.com/);
  await page.locator('#adminRecoveryLink').fill('http://localhost:3000/#access_token=abc');
  await page.locator('#adminLinkRecovery button').click();
  assert.match(await page.locator('.sc-auth-recovery-status').innerText(), /session valide|jeton/i);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('senecompare.v53.admin.token')), null, `${name}: invalid token rejected`);
  await page.screenshot({ path: path.join(OUTPUT, `${name}-admin.png`), fullPage: true });

  assert.deepEqual(pageErrors, [], `${name}: page errors`);
  const relevant = consoleErrors.filter((entry) => !expectedCloudflareNoise(entry) && !/favicon|manifest|ResizeObserver/i.test(entry));
  assert.deepEqual(relevant, [], `${name}: application console errors`);
  await context.close();
  return { name, pageErrors: pageErrors.length, consoleErrors: relevant.length };
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  results.push(await verify('desktop', { viewport: { width: 1440, height: 1000 } }));
  results.push(await verify('samsung', { ...devices['Galaxy S9+'] }));
  await fs.writeFile(path.join(OUTPUT, 'report.json'), JSON.stringify({ ok: true, release: '5.4.0', results }, null, 2));
  console.log(JSON.stringify({ ok: true, release: '5.4.0', results }, null, 2));
} finally {
  await browser.close();
}
