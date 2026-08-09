import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [engineSource, shellSource, routerSource, wranglerSource] = await Promise.all([
  readFile(new URL('../src/social-intelligence-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/social-intelligence-v3.js', import.meta.url), 'utf8'),
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

const v3Routes = [
  '/social-intelligence',
  '/social-intelligence/login',
  '/social-intelligence/logout',
  '/social-intelligence/manifest.webmanifest',
  '/social-intelligence/sw.js',
  '/social-intelligence/icon.svg',
  '/api/social-intelligence/refresh',
  '/api/social-intelligence/publish/preview',
  '/api/social-intelligence/publish/commit',
];
for (const route of v3Routes) assert.ok(shellSource.includes(route), `missing v3 route: ${route}`);

assert.ok(engineSource.includes('INSTAGRAM_ACCESS_TOKEN'), 'Instagram insights token binding is missing');
assert.ok(engineSource.includes('INSTAGRAM_USER_ID'), 'Instagram user binding is missing');
assert.ok(engineSource.includes('median('), 'personal baseline scoring is missing');
assert.ok(engineSource.includes('buildWeeklyPlan'), 'weekly content plan engine is missing');
assert.ok(engineSource.includes('buildRecommendations'), 'coach recommendation engine is missing');
assert.ok(engineSource.includes('mapWithConcurrency'), 'bounded Instagram insight concurrency is missing');

assert.ok(shellSource.includes("const VERSION = '3.0.0'"), 'v3 version marker is missing');
assert.ok(shellSource.includes("const COOKIE_NAME = '__Host-sowhat_si'"), 'secure host cookie is missing');
assert.ok(shellSource.includes('HttpOnly; Secure; SameSite=Strict'), 'secure session cookie attributes are missing');
assert.ok(shellSource.includes('AUTH_MAX_ATTEMPTS = 5'), 'login brute-force limiter is missing');
assert.ok(shellSource.includes('X-SOWHAT-CSRF'), 'CSRF protection is missing');
assert.ok(shellSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'password hash binding is missing');
assert.ok(shellSource.includes('DEFAULT_BRIDGE_URL'), 'existing Instagram Bridge endpoint is not wired');
assert.ok(shellSource.includes('sowhat-visual-factory-v4-instagram-safe'), 'validated safe bridge path is missing');
assert.ok(shellSource.includes("source_workflow: 'SOWHAT — Visual Factory V4'"), 'Visual Factory source contract is missing');
assert.ok(shellSource.includes("ALLOWED_PUBLICATION_TYPES = new Set(['POST IMAGE', 'REEL', 'STORY'])"), 'POST/REEL/STORY publishing contract is missing');
assert.ok(shellSource.includes("dry_run: mode === 'preview'"), 'SAFE dry-run gate is missing');
assert.ok(shellSource.includes("approved: mode === 'commit'"), 'publication approval gate is missing');
assert.ok(shellSource.includes('PREVIEW_TTL_MS'), 'preview-before-publish expiry gate is missing');
assert.ok(shellSource.includes('explicit_confirmation_required'), 'explicit final confirmation gate is missing');
assert.ok(shellSource.includes('PUBLICATION_HISTORY_KEY'), 'publication audit history is missing');
assert.ok(shellSource.includes('@media(hover:none) and (pointer:coarse)'), 'touch-device mobile override is missing');
assert.ok(shellSource.includes('.rail{display:none!important}'), 'desktop rail is not forcibly hidden on touch devices');
assert.ok(shellSource.includes('grid-template-columns:repeat(6,1fr)'), 'six-action mobile navigation is missing');
assert.ok(shellSource.includes('viewport-fit=cover'), 'safe-area viewport support is missing');
assert.ok(shellSource.includes('manifest.webmanifest'), 'PWA manifest link is missing');
assert.ok(shellSource.includes('serviceWorker'), 'PWA service worker registration is missing');
assert.ok(shellSource.includes("form-action 'self'"), 'CSP form restriction is missing');
assert.ok(shellSource.includes('no-store, no-cache, must-revalidate'), 'private cache prevention is missing');

assert.ok(routerSource.includes("from './social-intelligence-v3.js'"), 'router does not import Social Intelligence v3');
assert.ok(routerSource.includes('handleSocialIntelligenceV3(request, env, ctx)'), 'router does not route Social Intelligence v3');
assert.ok(routerSource.includes("url.pathname.startsWith('/social-intelligence/')"), 'v3 child routes are not routed');
assert.ok(routerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'router fail-closed login binding is missing');
assert.ok(routerSource.includes('runInstagramSync(env, null)'), 'scheduled Instagram learning is not wired');

assert.ok(wranglerSource.includes('17 */6 * * *'), 'six-hour cron schedule is missing');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_USER'), 'login user binding is missing');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'login password hash binding is missing');
assert.equal(/"SOCIAL_INTELLIGENCE_LOGIN_PASSWORD"\s*:/.test(wranglerSource), false, 'raw login password binding must never be committed');
assert.equal(/INSTAGRAM_ACCESS_TOKEN\s*=\s*['"][^'"]+['"]/.test(engineSource), false, 'raw Instagram credential detected');
assert.equal(/Bearer\s+[A-Za-z0-9_-]{24,}/.test(engineSource), false, 'raw bearer credential detected');

console.log('SOWHAT Social Intelligence v3 contract: PASS');
