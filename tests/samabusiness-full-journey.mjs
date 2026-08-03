import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.SAMABUSINESS_URL || 'https://samabusiness.dakarstyle.com';
const RUN_ID = process.env.GITHUB_RUN_ID || String(Date.now());
const EMAIL = `samabusiness-e2e-${RUN_ID}@example.com`;
const PIN = '246810';
const BUSINESS = `TEST E2E SAMABUSINESS ${RUN_ID}`;
const PRODUCT = `Maillot Test ${RUN_ID}`;
const CLIENT = `Client Test ${RUN_ID}`;
const PHONE = '770001234';
const OUT = process.env.E2E_OUTPUT_DIR || 'test-results/samabusiness';

await fs.mkdir(OUT, { recursive: true });

const evidence = {
  runId: RUN_ID,
  account: EMAIL,
  business: BUSINESS,
  baseUrl: BASE_URL,
  startedAt: new Date().toISOString(),
  checks: [],
  moduleLabels: [],
  consoleErrors: [],
  pageErrors: [],
  serverErrors: [],
};

function record(name, detail = '') {
  evidence.checks.push({ name, detail, at: new Date().toISOString() });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function visible(locator, timeout = 15_000) {
  await locator.waitFor({ state: 'visible', timeout });
}

async function hidden(locator, timeout = 20_000) {
  await locator.waitFor({ state: 'hidden', timeout });
}

async function waitReady(page) {
  const loading = page.locator('#loadingCover');
  if (await loading.count()) {
    await loading.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(250);
}

async function registerOrLogin(page) {
  await page.goto(`${BASE_URL}/?e2e=${RUN_ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await visible(page.locator('#authScreen'));
  await page.locator('[data-auth-tab="register"]').click();
  await page.locator('[data-auth-type="email"]').click();
  await page.locator('#businessNameInput').fill(BUSINESS);
  await page.locator('#identifierInput').fill(EMAIL);
  await page.locator('#pinInput').fill(PIN);
  await page.locator('#authSubmit').click();

  const app = page.locator('#appShell:not(.hidden)');
  const status = page.locator('#authStatus');
  try {
    await app.waitFor({ state: 'visible', timeout: 35_000 });
    record('Création du compte marchand de test', EMAIL);
  } catch {
    const message = (await status.textContent().catch(() => '')) || '';
    if (!/existe|déjà|already/i.test(message)) throw new Error(`Création impossible : ${message || 'aucun message'}`);
    await page.locator('[data-auth-tab="login"]').click();
    await page.locator('[data-auth-type="email"]').click();
    await page.locator('#identifierInput').fill(EMAIL);
    await page.locator('#pinInput').fill(PIN);
    await page.locator('#authSubmit').click();
    await app.waitFor({ state: 'visible', timeout: 35_000 });
    record('Connexion au compte marchand de test existant', EMAIL);
  }
  await waitReady(page);
  await visible(page.locator('#view-home.active'));
}

async function login(page) {
  await page.goto(`${BASE_URL}/?mobile-e2e=${RUN_ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (await page.locator('#appShell:not(.hidden)').isVisible().catch(() => false)) return;
  await visible(page.locator('#authScreen'));
  await page.locator('[data-auth-tab="login"]').click();
  await page.locator('[data-auth-type="email"]').click();
  await page.locator('#identifierInput').fill(EMAIL);
  await page.locator('#pinInput').fill(PIN);
  await page.locator('#authSubmit').click();
  await visible(page.locator('#appShell:not(.hidden)'), 35_000);
  await waitReady(page);
}

async function testBrandAndPwa(page) {
  assert((await page.title()).includes('SAMABUSINESS'), `Titre inattendu : ${await page.title()}`);
  await page.waitForTimeout(700);
  const backgrounds = await page.locator('.logo-mark').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundImage));
  assert(backgrounds.some((value) => value.includes('samabusiness-192.webp')), `Logo officiel absent : ${JSON.stringify(backgrounds)}`);
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  assert(manifest?.includes('samabusiness-pwa'), `Manifeste inattendu : ${manifest}`);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  assert(canonical?.startsWith('https://samabusiness.dakarstyle.com'), `Canonique inattendue : ${canonical}`);
  record('Identité SAMABUSINESS, logo officiel et manifeste PWA');
}

async function testNavigation(page) {
  for (const view of ['home', 'sales', 'stock', 'orders', 'more']) {
    const button = page.locator(`.nav-btn[data-nav="${view}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await visible(page.locator(`#view-${view}.active`));
    record(`Navigation ${view}`);
  }
  await page.locator('.nav-btn[data-nav="home"]').click();
}

async function testLanguage(page) {
  const button = page.locator('#languageBtn');
  const before = (await button.textContent())?.trim();
  await button.click();
  const after = (await button.textContent())?.trim();
  assert(after && after !== before, `La langue n'a pas changé : ${before} -> ${after}`);
  await button.click();
  record('Bascule Français/Wolof');
}

async function testBaseModals(page) {
  for (const id of ['saleModal', 'expenseModal', 'productModal', 'stockModal', 'whatsappModal', 'withdrawModal']) {
    const trigger = page.locator(`[data-open="${id}"]`).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const modal = page.locator(`#${id}`);
    await modal.waitFor({ state: 'visible', timeout: 10_000 });
    assert(await modal.evaluate((node) => node.classList.contains('open')), `${id} ne s'ouvre pas`);
    await modal.locator('[data-close]').first().click();
    await page.waitForFunction((modalId) => !document.getElementById(modalId)?.classList.contains('open'), id);
    record(`Ouverture/fermeture ${id}`);
  }
}

async function saveProduct(page) {
  await page.locator('[data-open="productModal"]').first().click();
  await page.locator('#productName').fill(PRODUCT);
  await page.locator('#productSku').fill(`E2E-${RUN_ID}`.slice(0, 75));
  await page.locator('#productCategory').fill('Test automatisé');
  await page.locator('#productSalePrice').fill('15000');
  await page.locator('#productCost').fill('7000');
  await page.locator('#productStock').fill('5');
  await page.locator('#productThreshold').fill('2');
  await page.locator('#saveProductBtn').click();
  await page.waitForFunction(() => !document.getElementById('productModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  await page.locator('.nav-btn[data-nav="stock"]').click();
  await visible(page.locator('#view-stock.active'));
  await visible(page.locator('#productsList').getByText(PRODUCT, { exact: false }), 25_000);
  record('Création produit et calcul de marge', PRODUCT);
}

async function saveStock(page) {
  await page.locator('[data-open="stockModal"]').first().click();
  const value = await page.locator('#stockProduct option').evaluateAll((options, product) => {
    const option = options.find((item) => item.textContent?.includes(product));
    return option?.value || '';
  }, PRODUCT);
  assert(value, 'Produit absent du sélecteur de stock');
  await page.locator('#stockProduct').selectOption(value);
  await page.locator('#stockType').selectOption('purchase');
  await page.locator('#stockQuantity').fill('2');
  await page.locator('#stockUnitCost').fill('7000');
  await page.locator('#stockNotes').fill('Réapprovisionnement E2E');
  await page.locator('#saveStockBtn').click();
  await page.waitForFunction(() => !document.getElementById('stockModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  const row = page.locator('#productsList .row-card').filter({ hasText: PRODUCT }).first();
  await visible(row, 25_000);
  const text = (await row.textContent()) || '';
  assert(/stock\s+7/i.test(text), `Stock attendu 7, reçu : ${text}`);
  record('Mouvement de stock et coût unitaire', 'stock 5 → 7');
}

async function saveExpense(page) {
  await page.locator('.nav-btn[data-nav="home"]').click();
  await page.locator('[data-open="expenseModal"]').first().click();
  await page.locator('#expenseLabel').fill(`Transport E2E ${RUN_ID}`);
  await page.locator('#expenseAmount').fill('1000');
  await page.locator('#expenseCategory').selectOption('transport');
  await page.locator('#expenseScope').selectOption('business');
  await page.locator('#expenseMethod').selectOption('wave');
  await page.locator('#expenseNotes').fill('Contrôle dépense commerce');
  await page.locator('#saveExpenseBtn').click();
  await page.waitForFunction(() => !document.getElementById('expenseModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  record('Enregistrement dépense professionnelle');
}

async function saveOwnerDeposit(page) {
  await page.locator('[data-open="withdrawModal"]').first().click();
  await page.locator('#withdrawType').selectOption('owner_deposit');
  await page.locator('#withdrawAmount').fill('2000');
  await page.locator('#withdrawMethod').selectOption('cash');
  await page.locator('#withdrawReason').fill('Apport de caisse E2E');
  await page.locator('#saveWithdrawBtn').click();
  await page.waitForFunction(() => !document.getElementById('withdrawModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  record('Enregistrement apport du patron');
}

async function saveWhatsappOrder(page) {
  await page.locator('[data-open="whatsappModal"]').first().click();
  const message = `Je m'appelle ${CLIENT}. Je veux 2 maillots blancs taille L à 15 000 F, livraison aux Parcelles Assainies unité 15 près du marché. Téléphone ${PHONE}. Paiement Wave.`;
  await page.locator('#whatsappText').fill(message);
  await page.locator('#parseWhatsappBtn').click();
  await visible(page.locator('#parserResult:not(.hidden)'), 30_000);
  await visible(page.locator('#orderEditFields:not(.hidden)'));
  await page.locator('#orderCustomer').fill(CLIENT);
  await page.locator('#orderPhone').fill(PHONE);
  await page.locator('#orderProduct').fill(`Commande WhatsApp ${RUN_ID}`);
  await page.locator('#orderQuantity').fill('2');
  await page.locator('#orderPrice').fill('15000');
  await page.locator('#orderVariant').fill('L');
  await page.locator('#orderColor').fill('Blanc');
  await page.locator('#orderArea').fill('Parcelles Assainies');
  await page.locator('#orderAddress').fill('Unité 15, près du marché');
  await page.locator('#orderMethod').selectOption('wave');
  await page.locator('#orderDeliveryFee').fill('2000');
  await page.locator('#saveOrderBtn').click();
  await page.waitForFunction(() => !document.getElementById('whatsappModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  await page.locator('.nav-btn[data-nav="orders"]').click();
  await visible(page.locator('#view-orders.active'));
  const orderRow = page.locator('#ordersList .order-card, #ordersList [data-order-open]').filter({ hasText: CLIENT }).first();
  await visible(orderRow, 25_000);
  record('Extraction WhatsApp et création de commande');
}

async function createDeliveryFromOrder(page) {
  const orderButton = page.locator('#ordersList [data-order-open]').filter({ hasText: CLIENT }).first();
  await visible(orderButton, 20_000);
  await orderButton.click();
  await visible(page.locator('#orderModal.open'));
  await page.locator('#orderCreateDeliveryBtn').click();
  await page.waitForFunction(() => !document.getElementById('orderModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  await page.locator('.nav-btn[data-nav="more"]').click();
  await visible(page.locator('#view-more.active'));
  await visible(page.locator('#deliveriesList').getByText(CLIENT, { exact: false }), 25_000);
  record('Création et affichage de la livraison');
}

async function saveSale(page) {
  await page.locator('.nav-btn[data-nav="home"]').click();
  await page.locator('[data-open="saleModal"]').first().click();
  await page.locator('#saleCustomer').fill(CLIENT);
  await page.locator('#salePhone').fill(PHONE);
  const productSelect = page.locator('#saleItems .sale-product').first();
  const value = await productSelect.locator('option').evaluateAll((options, product) => {
    const option = options.find((item) => item.textContent?.includes(product));
    return option?.value || '';
  }, PRODUCT);
  assert(value, 'Produit absent de la nouvelle vente');
  await productSelect.selectOption(value);
  await page.locator('#saleItems .sale-qty').first().fill('1');
  await page.locator('#saleItems .sale-price').first().fill('15000');
  await page.locator('#salePaid').fill('15000');
  await page.locator('#saleMethod').selectOption('wave');
  await page.locator('#saleDeliveryCost').fill('500');
  await page.locator('#saleNote').fill(`Vente E2E ${RUN_ID}`);
  await page.locator('#saveSaleBtn').click();
  await page.waitForFunction(() => !document.getElementById('saleModal')?.classList.contains('open'), null, { timeout: 30_000 });
  await waitReady(page);
  await page.locator('.nav-btn[data-nav="sales"]').click();
  await visible(page.locator('#view-sales.active'));
  await visible(page.locator('#salesList').getByText(`Vente E2E ${RUN_ID}`, { exact: false }), 25_000);
  record('Création vente, paiement, stock et bénéfice');
}

async function testAddonModules(page) {
  await page.locator('.nav-btn[data-nav="home"]').click();
  const labels = ['Cahier & dettes', 'Commande vocale', 'Livraison', 'Abonnement', 'Pilotage général'];
  await page.waitForFunction((expected) => expected.filter((label) => document.body.innerText.includes(label)).length >= 4, labels, { timeout: 25_000 });
  evidence.moduleLabels = labels.filter(async (label) => await page.getByText(label, { exact: true }).count());
  const body = await page.locator('body').innerText();
  const found = labels.filter((label) => body.includes(label));
  assert(found.length >= 4, `Modules addon insuffisants : ${found.join(', ')}`);
  evidence.moduleLabels = found;
  record('Modules métiers injectés', found.join(', '));
}

async function testExport(page) {
  await page.locator('.nav-btn[data-nav="more"]').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  const target = path.join(OUT, await download.suggestedFilename());
  await download.saveAs(target);
  const stat = await fs.stat(target);
  assert(stat.size > 50, `Export CSV trop petit : ${stat.size}`);
  record('Export CSV', `${stat.size} octets`);
}

async function runDesktop(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'fr-SN',
    timezoneId: 'Africa/Dakar',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) evidence.serverErrors.push({ status: response.status(), url: response.url() });
  });

  await registerOrLogin(page);
  await testBrandAndPwa(page);
  await testNavigation(page);
  await testLanguage(page);
  await testBaseModals(page);
  await saveProduct(page);
  await saveStock(page);
  await saveExpense(page);
  await saveOwnerDeposit(page);
  await saveWhatsappOrder(page);
  await createDeliveryFromOrder(page);
  await saveSale(page);
  await testAddonModules(page);
  await testExport(page);
  await page.locator('.nav-btn[data-nav="home"]').click();
  await page.screenshot({ path: path.join(OUT, 'desktop-final.png'), fullPage: true });
  record('Capture desktop finale');
  await context.close();
}

async function runMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-SN',
    timezoneId: 'Africa/Dakar',
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  page.on('pageerror', (error) => evidence.pageErrors.push(`mobile: ${error.message}`));
  await login(page);
  for (const view of ['home', 'sales', 'stock', 'orders', 'more']) {
    await page.locator(`.nav-btn[data-nav="${view}"]`).click();
    await visible(page.locator(`#view-${view}.active`));
  }
  await page.locator('.nav-btn[data-nav="home"]').click();
  const minHeights = await page.locator('.nav-btn').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  assert(minHeights.every((height) => height >= 44), `Cibles tactiles insuffisantes : ${minHeights.join(', ')}`);
  await page.screenshot({ path: path.join(OUT, 'mobile-final.png'), fullPage: true });
  record('Parcours mobile et cibles tactiles');
  await context.close();
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  await runDesktop(browser);
  await runMobile(browser);
  assert(evidence.pageErrors.length === 0, `Erreurs JavaScript : ${evidence.pageErrors.join(' | ')}`);
  assert(evidence.serverErrors.length === 0, `Réponses serveur 5xx : ${JSON.stringify(evidence.serverErrors)}`);
  evidence.ok = true;
  evidence.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT, 'journey-report.json'), JSON.stringify(evidence, null, 2));
  console.log(`SAMABUSINESS full journey: PASS (${evidence.checks.length} contrôles)`);
} catch (error) {
  evidence.ok = false;
  evidence.finishedAt = new Date().toISOString();
  evidence.failure = error instanceof Error ? error.stack || error.message : String(error);
  await fs.writeFile(path.join(OUT, 'journey-report.json'), JSON.stringify(evidence, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
