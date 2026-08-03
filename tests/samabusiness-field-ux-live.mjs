import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.SAMABUSINESS_URL || 'https://samabusiness.dakarstyle.com';
const RUN = process.env.GITHUB_RUN_ID || String(Date.now());
const EMAIL = `samabusiness-field-e2e-${RUN}@example.com`;
const PIN = '483920';
const PRODUCT = `Filtre Test ${RUN}`;
const OUT = process.env.E2E_OUTPUT_DIR || 'test-results/samabusiness-field-ux';
await fs.mkdir(OUT, { recursive: true });

const checks = [];
const pass = (name, detail = '') => { checks.push({ name, detail }); console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`); };
const visible = (locator, timeout = 20000) => locator.waitFor({ state: 'visible', timeout });
const waitReady = (page) => page.locator('#loadingCover').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
const report = { ok: false, account: EMAIL, checks, pageErrors: [], serverErrors: [], failure: '' };

async function pollPage(page, reader, predicate, message, timeout = 30000, interval = 120) {
  const started = Date.now();
  let latest;
  while (Date.now() - started < timeout) {
    latest = await page.evaluate(reader);
    if (predicate(latest)) return latest;
    await page.waitForTimeout(interval);
  }
  throw new Error(`${message}. Dernière valeur : ${JSON.stringify(latest)}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: false, serviceWorkers: 'block' });
await context.addInitScript(() => {
  window.__openedUrls = [];
  window.open = (url) => { window.__openedUrls.push(String(url)); return null; };
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(String(error)));
page.on('response', (response) => { if (response.status() >= 500) report.serverErrors.push({ url: response.url(), status: response.status() }); });

try {
  const response = await page.goto(`${BASE}/?field-e2e=${RUN}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert(response, 'Réponse principale absente');
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['x-samabusiness-field-ux'], '10.2.0');
  await pollPage(
    page,
    () => window.__SAMABUSINESS_FIELD_UX__?.version || '',
    (value) => value === '10.2.0',
    'Le module UX terrain ne s’est pas initialisé'
  );
  pass('Chargement production 10.2.0 et injection UX terrain');

  await visible(page.locator('#authScreen'));
  await visible(page.locator('[data-sbfu-email-toggle]'));
  assert(await page.locator('[data-auth-type="email"]').evaluate((el) => getComputedStyle(el).display === 'none'));
  await page.locator('[data-auth-tab="register"]').click();
  await page.locator('[data-sbfu-email-toggle]').click();
  await page.locator('#businessNameInput').fill(`Atelier Terrain ${RUN}`);
  await page.locator('#identifierInput').fill(EMAIL);
  await page.locator('#pinInput').fill(PIN);
  await page.locator('#authSubmit').click();
  await visible(page.locator('#appShell:not(.hidden)'), 30000);
  await waitReady(page);
  pass('Onboarding téléphone prioritaire avec accès e-mail secondaire');

  await visible(page.locator('#sbfu-home-voice'));
  assert.match(await page.locator('#heroProfit').innerText(), /F\s*CFA/i);
  assert.match(await page.locator('#sbfu-home-voice').innerText(), /SAMA remplit/i);
  pass('Bouton vocal central et bénéfice réel lisible en F CFA');

  await page.locator('#languageBtn').click();
  await pollPage(
    page,
    () => ({ lang: document.documentElement.lang, text: document.body.innerText }),
    (value) => value.lang === 'wo' && value.text.includes('Lim yi war a xam'),
    'La traduction Wolof n’a pas été appliquée'
  );
  assert.equal((await page.locator('#languageBtn').innerText()).trim(), 'FR');
  assert.match(await page.locator('body').innerText(), /Njariñ dëgg/);
  pass('Traduction Wolof réellement appliquée à l’interface');
  await page.locator('#languageBtn').click();
  await pollPage(
    page,
    () => ({ lang: document.documentElement.lang, text: document.body.innerText }),
    (value) => value.lang === 'fr-SN' && value.text.includes('Les chiffres à comprendre'),
    'Le retour en français n’a pas été appliqué'
  );
  pass('Retour français sans rechargement');

  await page.locator('[data-open="productModal"]').first().click();
  await visible(page.locator('#productModal.open'));
  await page.locator('#productName').fill(PRODUCT);
  await page.locator('#productSku').fill(`FT-${String(RUN).slice(-6)}`);
  await page.locator('#productSalePrice').fill('25000');
  await page.locator('#productCost').fill('10000');
  await page.locator('#productStock').fill('1');
  await page.locator('#productThreshold').fill('3');
  await page.locator('#productTrack').selectOption('true');
  await page.locator('#saveProductBtn').click();
  await page.locator('#productModal').waitFor({ state: 'hidden', timeout: 30000 });
  await waitReady(page);
  await page.locator('.nav-btn[data-nav="stock"]').click();
  await visible(page.locator('#view-stock.active'));
  const productRow = page.locator('#productsList .row-card').filter({ hasText: PRODUCT }).first();
  await visible(productRow, 30000);
  await visible(productRow.locator('[data-sbfu-reorder]'));
  await visible(page.locator('#sbfu-restock'));
  pass('Alerte stock faible et commande fournisseur visibles');

  await productRow.locator('[data-sbfu-supplier]').click();
  await visible(page.locator('#sbfu-supplier-modal.open'));
  await page.locator('#sbfu-supplier-form [name="name"]').fill('Dépôt Test');
  await page.locator('#sbfu-supplier-form [name="phone"]').fill('770000000');
  await page.locator('#sbfu-supplier-form [name="reorderQuantity"]').fill('5');
  await page.locator('#sbfu-supplier-form button[type="submit"]').click();
  await page.locator('#sbfu-supplier-modal').waitFor({ state: 'hidden', timeout: 30000 });
  const openedUrls = await pollPage(
    page,
    () => Array.isArray(window.__openedUrls) ? [...window.__openedUrls] : [],
    (urls) => urls.some((url) => url.includes('wa.me/221770000000') && decodeURIComponent(url).includes('Filtre Test')),
    'Le message WhatsApp fournisseur n’a pas été préparé'
  );
  assert(openedUrls.some((url) => url.includes('wa.me/221770000000')));
  pass('Fournisseur mémorisé et message WhatsApp prérempli');

  await page.locator('.nav-btn[data-nav="more"]').click();
  await visible(page.locator('#view-more.active'));
  await page.locator('[data-sbx-open="voice"]').click();
  await visible(page.locator('#sbx-module-voice'));
  await page.locator('#sbx-voice-text').fill('Achat de pièce 10000');
  await page.locator('#sbx-voice-analyse').click();
  await visible(page.locator('#sbx-voice-form'));
  assert.equal(await page.locator('#sbx-voice-form [name="type"]').inputValue(), 'expense');
  assert.equal(await page.locator('#sbx-voice-form [name="total"]').inputValue(), '10000');
  assert.equal(await page.locator('#sbx-voice-form [name="paid"]').inputValue(), '10000');
  pass('Langage naturel sans devise classé automatiquement en dépense');
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('#sbx-panel .sbx-close').click().catch(() => {});

  await page.locator('.nav-btn[data-nav="home"]').click();
  await visible(page.locator('#view-home.active'));
  await page.locator('[data-open="saleModal"]').first().click();
  await visible(page.locator('#saleModal.open'));
  await page.locator('#saleCustomer').fill('Moustapha Test');
  await page.locator('#salePhone').fill('771112233');
  const item = page.locator('#saleItems .sale-item').first();
  await item.locator('.sale-product').selectOption({ label: PRODUCT });
  await item.locator('.sale-qty').fill('1');
  await item.locator('.sale-price').fill('25000');
  await page.locator('#salePaid').fill('15000');
  await page.locator('#saveSaleBtn').click();
  await visible(page.locator('#sbfu-receipt-modal.open'), 30000);
  await visible(page.locator('#sbfu-receipt-preview canvas'));
  assert.match(await page.locator('#sbfu-receipt-modal').innerText(), /Télécharger image/);
  assert.match(await page.locator('#sbfu-receipt-modal').innerText(), /Télécharger PDF/);
  assert.match(await page.locator('#sbfu-receipt-modal').innerText(), /Partager sur WhatsApp/);
  pass('Reçu visuel disponible en image, PDF et partage WhatsApp');
  await page.locator('#sbfu-receipt-modal [data-sbfu-modal-close]').click();

  await page.locator('.nav-btn[data-nav="sales"]').click();
  const saleRow = page.locator('#salesList .row-card').filter({ hasText: 'Moustapha Test' }).first();
  await visible(saleRow, 30000);
  await visible(saleRow.locator('[data-sbfu-receipt]'));
  pass('Reçu accessible en un clic depuis l’historique des ventes');

  await page.screenshot({ path: path.join(OUT, 'field-ux-mobile.png'), fullPage: true });
  assert.equal(report.pageErrors.length, 0, `Erreurs JavaScript: ${report.pageErrors.join(' | ')}`);
  assert.equal(report.serverErrors.length, 0, `Réponses 5xx: ${JSON.stringify(report.serverErrors)}`);
  report.ok = true;
  console.log(`SAMABUSINESS field UX: PASS (${checks.length} contrôles)`);
} catch (error) {
  report.failure = error?.stack || String(error);
  await page.screenshot({ path: path.join(OUT, 'field-ux-failure.png'), fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(OUT, 'field-ux-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
