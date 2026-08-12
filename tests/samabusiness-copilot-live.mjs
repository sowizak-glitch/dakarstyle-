import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.SAMABUSINESS_URL || 'https://samabusiness.dakarstyle.com';
const OUT = process.env.E2E_OUTPUT_DIR || 'test-results/samabusiness-field-ux';
const SHELL_VERSION = process.env.SHELL_VERSION || '10.3.0';
const FIELD_VERSION = process.env.FIELD_UX_VERSION || '11.8.2';
const GUIDE_VERSION = '19.0.0-beta.3';
const PIN = '483920';
const sourceReportPath = path.join(OUT, 'field-ux-report.json');

await fs.mkdir(OUT, { recursive: true });
const sourceReport = JSON.parse(await fs.readFile(sourceReportPath, 'utf8'));
const EMAIL = sourceReport.account;
assert(EMAIL, 'Compte E2E source introuvable');

const checks = [];
const pass = (name, detail = '') => {
  checks.push({ name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
};
const report = { ok: false, account: EMAIL, checks, pageErrors: [], serverErrors: [], failure: '' };
const visible = (locator, timeout = 30000) => locator.waitFor({ state: 'visible', timeout });

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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  bypassCSP: false,
  serviceWorkers: 'block',
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(String(error)));
page.on('response', (response) => {
  if (response.status() >= 500) report.serverErrors.push({ url: response.url(), status: response.status() });
});

try {
  const response = await page.goto(`${BASE}/?copilot-e2e=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  assert(response, 'Réponse principale absente');
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['x-samabusiness-field-ux'], SHELL_VERSION);
  pass(`Shell production ${SHELL_VERSION} détecté`);

  await visible(page.locator('#authScreen'));
  const emailToggle = page.locator('[data-sbfu-email-toggle]');
  if (await emailToggle.isVisible().catch(() => false)) await emailToggle.click();
  await page.locator('#identifierInput').fill(EMAIL);
  await page.locator('#pinInput').fill(PIN);
  await page.locator('#authSubmit').click();
  await visible(page.locator('#appShell:not(.hidden)'), 30000);
  pass('Connexion au compte E2E existant');

  await pollPage(
    page,
    () => ({
      field: window.__SAMABUSINESS_FIELD_UX__?.version || '',
      copilot: document.documentElement.dataset.samaCopilotVersion || '',
      guide: document.documentElement.dataset.samaGuideBridgeVersion || '',
    }),
    (value) => value.field === FIELD_VERSION && value.copilot.startsWith('19.0.0-beta') && value.guide === GUIDE_VERSION,
    'Le copilote guidé ne s’est pas initialisé'
  );
  pass(`UX terrain ${FIELD_VERSION}, copilote V19 et pont guidé chargés`);

  await visible(page.locator('#sama-copilot-fab'));
  await page.locator('#sama-copilot-fab').click();
  await visible(page.locator('#sama-copilot-panel.open'));
  await visible(page.locator('[data-sagb-understand]'));
  await visible(page.locator('[data-sagb-settings]'));
  pass('Panneau SAMA enrichi avec compréhension et préférences');

  const input = page.locator('#sama-copilot-panel [data-sacp-input]');
  await input.fill('vendu 2 tee shirts à 15000 en Wave');
  await input.press('Enter');
  const answer = page.locator('#sama-copilot-panel .sagb-answer').first();
  await visible(answer, 30000);
  const answerText = await answer.innerText();
  assert.match(answerText, /SAMA a compris/i);
  assert.match(answerText.replace(/[\u202f\u00a0]/g, ' '), /15\s*000\s*F/i);
  assert.match(answerText, /wave/i);
  const primaryAction = answer.locator('[data-sagb-act="create_sale"]');
  await visible(primaryAction);
  assert.match(await primaryAction.innerText(), /Préparer la vente/i);
  pass('Interprétation guidée vente + montant + Wave sans écriture automatique');

  await page.locator('[data-sagb-settings]').click();
  await visible(page.locator('.sagb-settings'));
  await page.locator('[data-sagb-style]').selectOption('visual');
  await page.locator('[data-sagb-save]').click();
  await pollPage(
    page,
    () => document.querySelector('[data-sagb-status]')?.textContent || '',
    (value) => /Préférences enregistrées/i.test(value),
    'Les préférences SAMA n’ont pas été enregistrées'
  );
  pass('Préférences persistantes enregistrées via API 10.4');

  await page.screenshot({ path: path.join(OUT, 'copilot-guided-mobile.png'), fullPage: true });
  assert.equal(report.pageErrors.length, 0, `Erreurs JavaScript: ${report.pageErrors.join(' | ')}`);
  assert.equal(report.serverErrors.length, 0, `Réponses 5xx: ${JSON.stringify(report.serverErrors)}`);
  report.ok = true;
  console.log(`SAMABUSINESS guided copilot: PASS (${checks.length} contrôles)`);
} catch (error) {
  report.failure = error?.stack || String(error);
  await page.screenshot({ path: path.join(OUT, 'copilot-guided-failure.png'), fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(OUT, 'copilot-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
