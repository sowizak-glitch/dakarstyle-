import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260805234000_senecompare_admin_ads_v53.sql');
const grants = read('supabase/migrations/20260805234100_senecompare_admin_ads_v53_grants.sql');
const edge = read('supabase/functions/senecompare-admin-v53/index.ts');
const publicJs = read('senecompare/monetization-v53.js');
const publicCss = read('senecompare/monetization-v53.css');
const dialogJs = read('senecompare/monetization-v53-dialog.js');
const dialogCss = read('senecompare/monetization-v53-dialog.css');
const adminHtml = read('senecompare/admin-v53.html');
const adminJs = read('senecompare/admin-v53.js');
const adminCss = read('senecompare/admin-v53.css');
const wrapper = read('src/senecompare-v53.js');
const structuralWrapper = read('src/senecompare-v531.js');
const router = read('src/senecompare-v5-router.js');

assert.match(migration, /idrissaminata@gmail\.com/);
assert.match(migration, /senecompare_admin_users/);
assert.match(migration, /senecompare_ad_campaigns/);
assert.match(migration, /senecompare_analytics_events/);
assert.match(migration, /senecompare_partner_leads/);
assert.match(migration, /visitor_hash text not null/);
assert.match(migration, /session_hash text not null/);
assert.doesNotMatch(migration, /\bip_address\b/i);
assert.doesNotMatch(migration, /\braw_ip\b/i);
for (const table of ['senecompare_admin_users', 'senecompare_ad_campaigns', 'senecompare_analytics_events', 'senecompare_partner_leads']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
}
assert.match(migration, /revoke all on table public\.senecompare_admin_users from anon, authenticated/);
assert.match(migration, /security definer/);
assert.match(migration, /set search_path = public, pg_temp/);
assert.match(grants, /to service_role/);
for (const slug of ['samabusiness-launch', 'sowhat-africa-culture', 'advertise-on-senecompare']) assert.match(migration, new RegExp(slug));
for (const url of ['https://samabusiness.dakarstyle.com/', 'https://sowhatafrica.com/']) assert.match(migration, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(edge, /const OWNER_EMAIL = 'idrissaminata@gmail\.com'/);
assert.match(edge, /auth\.getUser\(token\)/);
assert.match(edge, /senecompare_admin_users/);
assert.match(edge, /ADMIN_FORBIDDEN/);
assert.match(edge, /shouldCreateUser: false/);
assert.match(edge, /emailRedirectTo: `\$\{PROD\}\/admin`/);
assert.match(edge, /sha256\(`visitor:/);
assert.match(edge, /sc_take_rate_limit/);
assert.match(edge, /Deno\.serve/);
assert.doesNotMatch(edge, /console\.log\([^)]*token/i);

for (const marker of ['Sponsorisé', 'samabusiness-launch', 'sowhat-africa-culture', 'advertise-on-senecompare', '/api/analytics/track', '/api/partners/leads']) assert.match(publicJs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(publicJs, /prefers-reduced-motion/);
assert.match(publicJs, /rel="noopener sponsored"/);
assert.match(publicCss, /@media\(max-width:760px\)/);
assert.match(publicCss, /sc-sponsored-card/);
assert.match(publicCss, /sc-partner-dialog/);

assert.match(dialogJs, /dialog\.insertBefore\(button, panel\)/);
assert.match(dialogJs, /button\.parentElement !== dialog/);
assert.match(dialogJs, /data.*closeControl|dataset\.closeControl/);
assert.match(dialogCss, /sc-partner-dialog>\.sc-partner-close/);
assert.match(dialogCss, /position:absolute/);
assert.match(dialogCss, /pointer-events:auto/);
assert.doesNotMatch(dialogCss, /sc-partner-dialog\{[^}]*pointer-events:none/);

assert.match(adminHtml, /noindex,nofollow,noarchive/);
assert.match(adminHtml, /idrissaminata@gmail\.com/);
assert.match(adminHtml, /id="adminLoginForm"/);
assert.match(adminHtml, /id="campaignRows"/);
assert.match(adminHtml, /id="leadRows"/);
assert.match(adminJs, /sessionStorage/);
assert.match(adminJs, /\/api\/admin\/overview/);
assert.match(adminJs, /\/api\/admin\/campaigns/);
assert.match(adminJs, /\/api\/admin\/leads/);
assert.match(adminJs, /\/api\/admin\/export/);
assert.match(adminCss, /@media\(max-width:820px\)/);

assert.match(wrapper, /X-SeneCompare-Analytics/);
assert.match(wrapper, /X-SeneCompare-Ads/);
assert.match(wrapper, /X-Robots-Tag/);
assert.match(wrapper, /\/admin-v53\.js\?v=530/);
assert.match(wrapper, /\/monetization-v53\.js\?v=530/);
assert.match(structuralWrapper, /import frontend from '\.\/senecompare-v53\.js'/);
assert.match(structuralWrapper, /\/monetization-v53-dialog\.css\?v=531/);
assert.match(structuralWrapper, /\/monetization-v53-dialog\.js\?v=531/);
assert.match(router, /import frontend from '\.\/senecompare-v531\.js'/);
assert.match(router, /const RELEASE = '5\.3\.0'/);
assert.match(router, /senecompare-admin-v53/);
assert.match(router, /Authorization/);

console.log('SeneCompare 5.3 static privacy, security, monetization and dialog audit passed');
