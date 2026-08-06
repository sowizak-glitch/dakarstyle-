import assert from 'node:assert/strict';
import fs from 'node:fs';
import application from '../src/senecompare-v54.js';

const premiumJs = fs.readFileSync('senecompare/monetization-v54.js', 'utf8');
const premiumCss = fs.readFileSync('senecompare/monetization-v54.css', 'utf8');
const authJs = fs.readFileSync('senecompare/admin-auth-v54.js', 'utf8');
const authCss = fs.readFileSync('senecompare/admin-auth-v54.css', 'utf8');
const wrapper = fs.readFileSync('src/senecompare-v54.js', 'utf8');

for (const marker of [
  '/media/sowhat-africa-campaign.jpg',
  '/media/samabusiness-campaign.webp',
  'hellodakarstyle@gmail.com',
  'sc-sponsored-visual',
  'Envoyer aussi par email',
]) assert.match(premiumJs, new RegExp(marker.replace(/[/.?]/g, '\\$&')));
assert.match(premiumCss, /@keyframes scPremiumSheen/);
assert.match(premiumCss, /prefers-reduced-motion/);
assert.match(premiumCss, /@media\(max-width:720px\)/);

for (const marker of [
  'localhost',
  'access_token',
  'sessionStorage.setItem',
  'decodePayload',
  'OWNER_INVALID',
  'TOKEN_EXPIRED',
  'idrissaminata@gmail.com',
  'hellodakarstyle@gmail.com',
]) assert.match(authJs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(authJs, /localStorage\.setItem\([^)]*token/i);
assert.doesNotMatch(authJs, /console\.(log|debug|info)\([^)]*token/i);
assert.match(authCss, /sc-auth-recovery/);
assert.match(wrapper, /senecompare-media-v54/);
assert.match(wrapper, /verified-owner-link-v54/);
assert.match(wrapper, /type\.includes\('text\/html'\)/);

const calls = [];
const env = {
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      const files = {
        '/senecompare/index.html': '<!doctype html><html><head></head><body><div>SeneCompare AI</div><footer></footer></body></html>',
        '/senecompare/admin-v53.html': '<!doctype html><html><head></head><body><form id="adminLoginForm"></form></body></html>',
        '/senecompare/monetization-v54.css': premiumCss,
        '/senecompare/monetization-v54.js': premiumJs,
        '/senecompare/admin-auth-v54.css': authCss,
        '/senecompare/admin-auth-v54.js': authJs,
      };
      const content = files[path];
      if (content === undefined) return new Response('<html>fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'application/javascript' : 'text/html';
      return new Response(content, { status: 200, headers: { 'content-type': type } });
    },
  },
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname.endsWith('supabase.co') && url.pathname.includes('senecompare-media-v54')) {
    return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]), {
      status: 200,
      headers: { 'content-type': 'image/webp', etag: '"verified-media"' },
    });
  }
  throw new Error(`Unexpected network request ${url}`);
};

try {
  for (const [path, type] of [
    ['/monetization-v54.css', 'text/css'],
    ['/monetization-v54.js', 'application/javascript'],
    ['/admin-auth-v54.css', 'text/css'],
    ['/admin-auth-v54.js', 'application/javascript'],
  ]) {
    const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') || '', new RegExp(type), path);
    assert.equal(response.headers.get('x-senecompare-release'), '5.4.0');
  }

  for (const path of ['/media/sowhat-africa-campaign.jpg', '/media/sowhat-africa-campaign.webp', '/media/samabusiness-campaign.webp']) {
    const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') || '', /image\/webp/, path);
    assert.equal(response.headers.get('x-senecompare-media'), 'verified-supabase-v54');
    assert.match(response.headers.get('cache-control') || '', /immutable/);
    assert.equal((await response.arrayBuffer()).byteLength, 12);
  }

  const page = await application.fetch(new Request('https://senecompare.dakarstyle.com/?v=540'), env, {});
  const html = await page.text();
  assert.doesNotMatch(html, /SeneCompare AI/);
  assert.match(html, /SeneCompare Sénégal/);
} finally {
  globalThis.fetch = originalFetch;
}

assert.ok(calls.includes('/senecompare/monetization-v54.js'));
assert.ok(calls.includes('/senecompare/admin-auth-v54.js'));
assert.ok(!calls.includes('/assets/hero/ensemble-senegal-boutique-2026.jpg'));
console.log('SeneCompare 5.4 verified media, contact and owner-auth contract passed');
