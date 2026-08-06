import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const router = read('src/senecompare-v54-router.js');
const premiumJs = read('senecompare/premium-ads-v54.js');
const premiumCss = read('senecompare/premium-ads-v54.css');
const authJs = read('senecompare/admin-auth-v54.js');
const authCss = read('senecompare/admin-auth-v54.css');
const mediaEdge = read('supabase/functions/senecompare-media-v54/index.ts');
const migration = read('supabase/migrations/20260806014500_senecompare_premium_media_notifications_v54.sql');

for (const marker of [
  "import application from './senecompare-v5-router.js'",
  "const RELEASE = '5.4.0'",
  '/media/samabusiness-campaign.webp',
  '/media/sowhat-africa-campaign.webp',
  '/premium-ads-v54.js?v=540',
  '/admin-auth-v54.js?v=540',
  'X-SeneCompare-Premium-Ads',
  'X-SeneCompare-Admin-Auth',
]) assert.match(router, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(router, /replaceAll\('SeneCompare AI', 'SeneCompare Sénégal'\)/);
assert.doesNotMatch(router, /localhost:3000/);

for (const marker of [
  'hellodakarstyle@gmail.com',
  '/media/samabusiness-campaign.webp',
  '/media/sowhat-africa-campaign.webp',
  'Sponsorisé clairement',
  'prefers-reduced-motion',
  'MutationObserver',
  'sc-sponsored-visual',
]) assert.match(premiumJs + premiumCss, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(premiumCss, /perspective\(1400px\)/);
assert.match(premiumCss, /@media\(max-width:720px\)/);
assert.match(premiumCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(premiumJs, /SeneCompare AI/);

for (const marker of [
  "const OWNER = 'idrissaminata@gmail.com'",
  "const CONTACT = 'hellodakarstyle@gmail.com'",
  "const TOKEN_KEY = 'senecompare.v53.admin.token'",
  'extractToken',
  'OWNER_INVALID',
  'TOKEN_EXPIRED',
  "history.replaceState({}, document.title, '/admin')",
  'Le lien ouvre “localhost” ?',
]) assert.match(authJs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(authJs, /localStorage\.setItem\([^)]*token/i);
assert.doesNotMatch(authJs, /console\.(log|info|debug)\([^)]*token/i);
assert.match(authCss, /sc-admin-recovery/);
assert.match(authCss, /@media\(max-width:700px\)/);

for (const marker of [
  "const VERSION = '5.4.0'",
  'senecompare_media_assets',
  'content_base64',
  'MEDIA_NOT_FOUND',
  'MEDIA_NOT_READY',
  'immutable',
  'If-None-Match'.toLowerCase(),
]) {
  const source = marker === 'if-none-match' ? mediaEdge.toLowerCase() : mediaEdge;
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.doesNotMatch(mediaEdge, /SUPABASE_SERVICE_ROLE_KEY\s*=/);

assert.match(migration, /senecompare_media_assets/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.senecompare_media_assets from anon, authenticated/);
assert.match(migration, /notification_sent_at/);
assert.match(migration, /hellodakarstyle@gmail\.com/);
assert.doesNotMatch(migration, /UklGR[A-Za-z0-9+/]{100}/, 'binary Base64 must not be committed');

console.log('SeneCompare 5.4 premium media, contact and authentication audit passed');
