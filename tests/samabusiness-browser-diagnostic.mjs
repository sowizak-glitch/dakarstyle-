import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.SAMABUSINESS_URL || 'https://samabusiness.dakarstyle.com';
const out = process.env.E2E_OUTPUT_DIR || 'test-results/samabusiness';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-SN' });
const page = await context.newPage();
const messages = [];
page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => messages.push({ type: 'pageerror', text: error.message }));
const response = await page.goto(`${base}/?diagnostic=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1500);
const report = {
  requested: base,
  finalUrl: page.url(),
  status: response?.status(),
  responseHeaders: response?.headers(),
  title: await page.title(),
  bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000),
  ids: await page.locator('[id]').evaluateAll((nodes) => nodes.slice(0, 300).map((node) => node.id)),
  authCount: await page.locator('#authScreen').count(),
  authVisible: await page.locator('#authScreen').isVisible().catch(() => false),
  appCount: await page.locator('#appShell').count(),
  appVisible: await page.locator('#appShell').isVisible().catch(() => false),
  contentType: response?.headers()['content-type'],
  csp: response?.headers()['content-security-policy'],
  messages,
};
await fs.writeFile(path.join(out, 'browser-diagnostic.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(out, 'startup.html'), await page.content());
await page.screenshot({ path: path.join(out, 'startup.png'), fullPage: true });
console.log(JSON.stringify(report, null, 2));
await browser.close();
