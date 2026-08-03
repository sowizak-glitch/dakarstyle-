import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.SAMABUSINESS_URL || 'https://samabusiness.dakarstyle.com';
const OUT = process.env.E2E_OUTPUT_DIR || 'test-results/samabusiness-native-pwa';
await fs.mkdir(OUT, { recursive: true });
const report = { ok: false, checks: [], pageErrors: [], serverErrors: [], audioConfigured: null, failure: '' };
const pass = (name, detail = '') => { report.checks.push({ name, detail }); console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(String(error)));
page.on('response', (response) => { if (response.status() >= 500) report.serverErrors.push({ url: response.url(), status: response.status() }); });

try {
  const response = await page.goto(`${BASE}/?native-pwa-e2e=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert(response, 'Réponse principale absente');
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['x-samabusiness-version'], '10.3.0');
  const headers = response.headers();
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['strict-transport-security'] || '', /max-age=63072000/);
  assert.match(headers['content-security-policy'] || '', /frame-ancestors 'none'/);
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
  pass('En-têtes de sécurité renforcés');

  await page.waitForFunction(() => window.__SAMABUSINESS_NATIVE_PWA__?.version === '10.3.0', null, { timeout: 30000 });
  pass('Module PWA native 10.3.0 chargé');

  const manifestHref = await page.locator('link[rel="manifest"]').first().getAttribute('href');
  assert(manifestHref?.startsWith('/manifest.webmanifest'));
  const manifestResponse = await page.request.get(`${BASE}/manifest.webmanifest?v=10.3.0`);
  assert.equal(manifestResponse.status(), 200);
  assert.match(manifestResponse.headers()['content-type'] || '', /application\/manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, `${BASE}/?source=pwa`);
  assert(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  assert.equal(manifest.share_target.method, 'POST');
  assert.equal(manifest.share_target.params.files[0].name, 'audio');
  pass('Manifest Android standalone, icônes et partage vocal conformes');

  for (const [route, expected] of [['/icon-192.png?v=10.3.0', 192], ['/icon-512.png?v=10.3.0', 512], ['/maskable-512.png?v=10.3.0', 512]]) {
    const dimensions = await page.evaluate(async ({ url, expected }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, expected };
    }, { url: `${BASE}${route}`, expected });
    assert.equal(dimensions.width, expected);
    assert.equal(dimensions.height, expected);
  }
  pass('Icônes officielles 192 et 512 réellement décodables');

  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration('/')), null, { timeout: 30000 });
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return { scope: reg?.scope || '', active: Boolean(reg?.active || reg?.waiting || reg?.installing) };
  });
  assert.equal(registration.scope, `${BASE}/`);
  assert(registration.active);
  pass('Service Worker actif sur toute l’application');

  await page.locator('#sb-native-install-card').waitFor({ state: 'visible', timeout: 20000 });
  assert.match(await page.locator('#sb-native-install-card').innerText(), /Installer SAMABUSINESS/);
  await page.locator('#sb-audio-modal').waitFor({ state: 'attached', timeout: 20000 });
  assert.match(await page.locator('#sb-audio-file').getAttribute('accept'), /audio\/\*/);
  pass('Installation guidée et import de vocal disponibles sans menu caché');

  const audioHealth = await page.request.get('https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-audio-api', {
    headers: { Origin: BASE },
  });
  assert.equal(audioHealth.status(), 200);
  const audio = await audioHealth.json();
  assert.equal(audio.version, '10.3.0');
  assert.equal(audio.audio_retained, false);
  report.audioConfigured = Boolean(audio.configured);
  pass('API vocale protégée et sans conservation audio', `cloud=${report.audioConfigured ? 'actif' : 'secours manuel'}`);

  await page.screenshot({ path: path.join(OUT, 'native-pwa-mobile.png'), fullPage: true });
  assert.equal(report.pageErrors.length, 0, `Erreurs JavaScript: ${report.pageErrors.join(' | ')}`);
  assert.equal(report.serverErrors.length, 0, `Réponses serveur 5xx: ${JSON.stringify(report.serverErrors)}`);
  report.ok = true;
  console.log(`SAMABUSINESS native PWA: PASS (${report.checks.length} contrôles)`);
} catch (error) {
  report.failure = error?.stack || String(error);
  await page.screenshot({ path: path.join(OUT, 'native-pwa-failure.png'), fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(OUT, 'native-pwa-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
