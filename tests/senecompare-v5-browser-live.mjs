import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = process.cwd();
const API_BASE = process.env.SENECOMPARE_URL || 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-gateway-v5';
const output = process.env.E2E_OUTPUT_DIR || 'test-results/senecompare-v5-browser';
await mkdir(output, { recursive: true });

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function collectBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 9_000_000) {
        reject(new Error('request too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function proxyApi(request, response, url) {
  const suffix = url.pathname.slice('/api'.length) || '/health';
  const target = `${API_BASE}${suffix}${url.search}`;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await collectBody(request);
  const headers = {
    accept: request.headers.accept || '*/*',
    origin: 'https://senecompare.dakarstyle.com',
    'x-client-version': 'senecompare-v5-browser-e2e',
    'user-agent': request.headers['user-agent'] || 'SeneCompareBrowserE2E/5.0.0',
  };
  if (request.headers['content-type']) headers['content-type'] = request.headers['content-type'];
  const upstream = await fetch(target, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(70000) });
  response.writeHead(upstream.status, Object.fromEntries([...upstream.headers.entries()].filter(([name]) => !['content-encoding', 'content-length'].includes(name.toLowerCase()))));
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveAsset(response, pathname) {
  const map = {
    '/': 'senecompare/index.html',
    '/styles.css': 'senecompare/styles.css',
    '/app.js': 'senecompare/app.js',
    '/manifest.webmanifest': 'senecompare/manifest.webmanifest',
    '/sw.js': 'senecompare/sw.js',
    '/icon.svg': 'senecompare/icon.svg',
  };
  const file = map[pathname];
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const extension = path.extname(file);
  const value = await readFile(path.join(root, file));
  response.writeHead(200, {
    'content-type': contentTypes[extension] || 'application/octet-stream',
    'cache-control': 'no-store',
    'service-worker-allowed': pathname === '/sw.js' ? '/' : undefined,
  });
  response.end(value);
}

const serverErrors = [];
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) await proxyApi(request, response, url);
    else await serveAsset(response, url.pathname);
  } catch (error) {
    serverErrors.push(String(error));
    if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: String(error) }));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const localUrl = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
const report = { ok: false, mobile: {}, desktop: {}, pageErrors: [], consoleErrors: [], serverErrors };

async function attachDiagnostics(page) {
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 500) report.serverErrors.push(`${response.status()} ${response.url()}`); });
}

try {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/151.0 Mobile Safari/537.36',
    locale: 'fr-SN',
  });
  const page = await mobile.newPage();
  await attachDiagnostics(page);
  await page.goto(`${localUrl}/?v=500`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('#installButton').waitFor({ state: 'visible' });
  assert.match(await page.title(), /SeneCompare AI/);
  assert.equal(await page.locator('#searchInput').count(), 1);
  assert.equal(await page.locator('#voiceButton').count(), 1);

  await page.locator('#searchInput').fill('Pharmacie à Dakar');
  await page.locator('#submitButton').click();
  await page.locator('#resultsGrid .result-card').first().waitFor({ state: 'visible', timeout: 70000 });
  const cardCount = await page.locator('#resultsGrid .result-card').count();
  assert.ok(cardCount >= 1);
  const hrefs = await page.locator('#resultsGrid .result-card .result-actions a').evaluateAll((links) => links.map((link) => link.href));
  assert.ok(hrefs.length >= 1 && hrefs.every((href) => /^https?:\/\//.test(href)));
  assert.match(await page.locator('#resultsSummary').textContent(), /Pharmacie/);

  await page.locator('#languageSwitch').click();
  assert.match(await page.locator('html').getAttribute('lang'), /^wo/);
  assert.equal(await page.locator('#searchTitle').textContent(), 'Lan nga bëgg gis ?');

  await page.locator('#installButton').click();
  await page.locator('#appModal[open]').waitFor({ state: 'visible' });
  const installText = await page.locator('#modalBody').textContent();
  assert.match(installText, /Installer l’application|Ajouter à l’écran d’accueil/);
  await page.locator('#modalClose').click();

  if (cardCount >= 2) {
    await page.locator('.compare-toggle').nth(0).check();
    await page.locator('.compare-toggle').nth(1).check();
    await page.locator('#compareButton').click();
    await page.locator('#appModal[open]').waitFor({ state: 'visible' });
    assert.match(await page.locator('#modalTitle').textContent(), /Méngale|Comparer/);
    await page.locator('#modalClose').click();
  }

  await page.screenshot({ path: `${output}/mobile-samsung.png`, fullPage: true });
  report.mobile = { cardCount, hrefs, language: await page.locator('html').getAttribute('lang'), installVisible: true };
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-SN' });
  const desktopPage = await desktop.newPage();
  await attachDiagnostics(desktopPage);
  await desktopPage.goto(`${localUrl}/?q=ordinateur%20portable%20Core%20i5`, { waitUntil: 'networkidle', timeout: 45000 });
  await desktopPage.locator('#resultsGrid .result-card').first().waitFor({ state: 'visible', timeout: 70000 });
  const desktopCards = await desktopPage.locator('#resultsGrid .result-card').count();
  assert.ok(desktopCards >= 1);
  assert.ok((await desktopPage.locator('#categoryGrid button').count()) >= 12);
  await desktopPage.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  report.desktop = { cardCount: desktopCards, categoryCount: await desktopPage.locator('#categoryGrid button').count() };
  await desktop.close();

  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.serverErrors, []);
  report.ok = true;
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
