import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [moduleSource, routerSource, wranglerSource] = await Promise.all([
  readFile(new URL('../src/social-intelligence-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/router.js', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
]);

const requiredRoutes = [
  '/social-intelligence',
  '/api/social-intelligence/health',
  '/api/social-intelligence/data',
  '/api/social-intelligence/snapshot',
  '/api/social-intelligence/sync-instagram',
];

for (const route of requiredRoutes) {
  assert.ok(moduleSource.includes(route), `missing route: ${route}`);
}

assert.ok(moduleSource.includes('INSTAGRAM_ACCESS_TOKEN'), 'Instagram token binding is missing');
assert.ok(moduleSource.includes('INSTAGRAM_USER_ID'), 'Instagram user binding is missing');
assert.ok(moduleSource.includes('VISUALS_BUCKET'), 'R2 analytics storage is missing');
assert.ok(moduleSource.includes('content-security-policy'), 'CSP is missing');
assert.ok(moduleSource.includes("x-frame-options':'DENY'"), 'clickjacking protection is missing');
assert.ok(moduleSource.includes('noindex, nofollow, noarchive'), 'private dashboard noindex contract is missing');
assert.ok(moduleSource.includes('timingSafeEqual'), 'constant-time hash comparison helper is missing');
assert.ok(moduleSource.includes('SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256'), 'admin key hash binding is missing');
assert.ok(moduleSource.includes('SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256'), 'write key hash binding is missing');
assert.ok(moduleSource.includes('median('), 'personal baseline scoring is missing');
assert.ok(moduleSource.includes('buildWeeklyPlan'), 'weekly content plan engine is missing');
assert.ok(moduleSource.includes('buildRecommendations'), 'coach recommendation engine is missing');
assert.ok(moduleSource.includes('mapWithConcurrency'), 'bounded Instagram insight concurrency is missing');

assert.ok(routerSource.includes("from './social-intelligence-v1.js'"), 'router does not import Social Intelligence');
assert.ok(routerSource.includes('handleSocialIntelligence(request, env, ctx)'), 'router does not route Social Intelligence');
assert.ok(routerSource.includes('runInstagramSync(env, null)'), 'scheduled Instagram learning is not wired');
assert.ok(routerSource.includes('socialIntelligenceSecurityReady(url, env)'), 'router security gate is missing');
assert.ok(routerSource.includes('SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256'), 'router does not require a dedicated admin hash');
assert.ok(routerSource.includes('SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256'), 'router does not require a dedicated write hash');
assert.ok(routerSource.includes('social_intelligence_security_not_configured'), 'router must fail closed when private hashes are absent');
assert.ok(wranglerSource.includes('17 */6 * * *'), 'six-hour cron schedule is missing');

const rawSecretPatterns = [
  /INSTAGRAM_ACCESS_TOKEN\s*=\s*['"][^'"]+['"]/,
  /INSTAGRAM_USER_ID\s*=\s*['"][^'"]+['"]/,
  /Bearer\s+[A-Za-z0-9_-]{24,}/,
];
for (const pattern of rawSecretPatterns) {
  assert.equal(pattern.test(moduleSource), false, `possible raw Instagram credential detected: ${pattern}`);
}

assert.equal(moduleSource.includes('fetch(`https://graph.facebook.com'), false, 'Graph endpoint must remain configurable rather than interpolating credentials or versions in source');

console.log('SOWHAT Social Intelligence contract: PASS');
