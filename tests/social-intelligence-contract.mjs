import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [engineSource, shellSource, routerSource, wranglerSource] = await Promise.all([
  readFile(new URL('../src/social-intelligence-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/social-intelligence-v2.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/router.js', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
]);

const legacyRoutes = [
  '/api/social-intelligence/health',
  '/api/social-intelligence/data',
  '/api/social-intelligence/snapshot',
  '/api/social-intelligence/sync-instagram',
];
for (const route of legacyRoutes) assert.ok(engineSource.includes(route), `missing engine route: ${route}`);

const v2Routes = [
  '/social-intelligence',
  '/social-intelligence/login',
  '/social-intelligence/logout',
  '/social-intelligence/manifest.webmanifest',
  '/social-intelligence/sw.js',
  '/social-intelligence/icon.svg',
  '/api/social-intelligence/refresh',
];
for (const route of v2Routes) assert.ok(shellSource.includes(route), `missing v2 route: ${route}`);

assert.ok(engineSource.includes('INSTAGRAM_ACCESS_TOKEN'), 'Instagram token binding is missing');
assert.ok(engineSource.includes('INSTAGRAM_USER_ID'), 'Instagram user binding is missing');
assert.ok(engineSource.includes('median('), 'personal baseline scoring is missing');
assert.ok(engineSource.includes('buildWeeklyPlan'), 'weekly content plan engine is missing');
assert.ok(engineSource.includes('buildRecommendations'), 'coach recommendation engine is missing');
assert.ok(engineSource.includes('mapWithConcurrency'), 'bounded Instagram insight concurrency is missing');

assert.ok(shellSource.includes("const COOKIE_NAME = '__Host-sowhat_si'"), 'secure host cookie is missing');
assert.ok(shellSource.includes('HttpOnly; Secure; SameSite=Strict'), 'secure session cookie attributes are missing');
assert.ok(shellSource.includes('AUTH_MAX_ATTEMPTS = 5'), 'login brute-force limiter is missing');
assert.ok(shellSource.includes('X-SOWHAT-CSRF'), 'CSRF protection for private refresh is missing');
assert.ok(shellSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'password hash binding is missing');
assert.ok(shellSource.includes('@media(max-width:960px)'), 'mobile breakpoint is missing');
assert.ok(shellSource.includes('.side{display:none}'), 'desktop sidebar is not removed on mobile');
assert.ok(shellSource.includes('grid-template-columns:repeat(5,1fr)'), 'mobile bottom navigation is missing');
assert.ok(shellSource.includes('Galaxy A73'), 'target phone optimization contract is missing');
assert.ok(shellSource.includes('viewport-fit=cover'), 'safe-area viewport support is missing');
assert.ok(shellSource.includes('manifest.webmanifest'), 'PWA manifest link is missing');
assert.ok(shellSource.includes('serviceWorker'), 'PWA service worker registration is missing');
assert.ok(shellSource.includes("form-action 'self'"), 'CSP form restriction is missing');
assert.ok(shellSource.includes('no-store, no-cache, must-revalidate'), 'private cache prevention is missing');

assert.ok(routerSource.includes("from './social-intelligence-v2.js'"), 'router does not import Social Intelligence v2');
assert.ok(routerSource.includes('handleSocialIntelligenceV2(request, env, ctx)'), 'router does not route Social Intelligence v2');
assert.ok(routerSource.includes("url.pathname.startsWith('/social-intelligence/')"), 'v2 child routes are not routed');
assert.ok(routerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'router fail-closed login binding is missing');
assert.ok(routerSource.includes('runInstagramSync(env, null)'), 'scheduled Instagram learning is not wired');

assert.ok(wranglerSource.includes('17 */6 * * *'), 'six-hour cron schedule is missing');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_USER'), 'login user binding is missing');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'login password hash binding is missing');
assert.equal(/SOWHAT-A73-9Kx7-Rm2P-2026!/.test(wranglerSource), false, 'raw login password must never be committed');
assert.equal(/INSTAGRAM_ACCESS_TOKEN\s*=\s*['"][^'"]+['"]/.test(engineSource), false, 'raw Instagram credential detected');
assert.equal(/Bearer\s+[A-Za-z0-9_-]{24,}/.test(engineSource), false, 'raw bearer credential detected');

console.log('SOWHAT Social Intelligence v2 contract: PASS');
