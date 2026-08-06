import assert from 'node:assert/strict';
import application from '../src/senecompare-v54-router.js';

const files = {
  '/senecompare/index.html': '<!doctype html><html lang="fr"><head><title>SeneCompare AI</title></head><body><header>SeneCompare AI</header><footer><div class="footer-links"></div></footer></body></html>',
  '/senecompare/admin-v53.html': '<!doctype html><html lang="fr"><head><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/admin-v53.css?v=530"></head><body><section id="adminLogin"><form id="adminLoginForm"><input id="adminEmail" value="idrissaminata@gmail.com"><p id="adminLoginStatus"></p><div class="sc-login-security"></div></form></section><script src="/admin-v53.js?v=530" defer></script></body></html>',
  '/senecompare/premium-ads-v54.css': '.sc-sponsored-visual{display:block}',
  '/senecompare/premium-ads-v54.js': "window.__SENECOMPARE_PREMIUM_ADS__={version:'5.4.0'};",
  '/senecompare/admin-auth-v54.css': '.sc-admin-recovery{display:block}',
  '/senecompare/admin-auth-v54.js': "window.__SENECOMPARE_ADMIN_AUTH__={version:'5.4.0'};",
  '/senecompare/monetization-v53-dialog.css': '.sc-partner-close{display:block}',
  '/senecompare/monetization-v53-dialog.js': "window.__SENECOMPARE_DIALOG_FIX__={version:'5.3.1'};",
  '/senecompare/monetization-v53.css': '.sc-sponsored-shell{display:block}',
  '/senecompare/monetization-v53.js': "window.__SENECOMPARE_MONETIZATION__={version:'5.3.0'};",
  '/senecompare/admin-v53.css': '.sc-admin-login{display:grid}',
  '/senecompare/admin-v53.js': "window.__SENECOMPARE_ADMIN__={version:'5.3.0'};",
  '/senecompare/premium-v51.css': '.premium{}',
  '/senecompare/premium-v51.js': "window.__premium='5.1.0';",
  '/senecompare/final-v52.css': '.final{}',
  '/senecompare/final-v52.js': "window.__final='5.2.0';",
};

const env = {
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (!(path in files)) return new Response('not found', { status: 404 });
      const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'application/javascript' : 'text/html';
      return new Response(files[path], { status: 200, headers: { 'Content-Type': `${type}; charset=utf-8` } });
    },
  },
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname.endsWith('supabase.co') && url.pathname.includes('senecompare-media-v54')) {
    return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', ETag: '"test-media"' },
    });
  }
  return new Response(JSON.stringify({ ok: true, campaigns: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

try {
  for (const [path, pattern, type] of [
    ['/premium-ads-v54.css', /sc-sponsored-visual/, 'text/css'],
    ['/premium-ads-v54.js', /SENECOMPARE_PREMIUM_ADS/, 'application/javascript'],
    ['/admin-auth-v54.css', /sc-admin-recovery/, 'text/css'],
    ['/admin-auth-v54.js', /SENECOMPARE_ADMIN_AUTH/, 'application/javascript'],
  ]) {
    const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') || '', new RegExp(type), path);
    assert.equal(response.headers.get('x-senecompare-release'), '5.4.0');
    assert.match(await response.text(), pattern, path);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/media/samabusiness-campaign.webp'), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('x-senecompare-premium-ads'), 'campaign-media-v54');
    assert.match(response.headers.get('cache-control') || '', /immutable/);
    assert.equal((await response.arrayBuffer()).byteLength, 8);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/?v=540'), env, {});
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /premium-ads-v54\.css\?v=540/);
    assert.match(html, /premium-ads-v54\.js\?v=540/);
    assert.match(html, /data-senecompare-premium="5\.4\.0"/);
    assert.doesNotMatch(html, /SeneCompare AI/);
    assert.match(html, /SeneCompare Sénégal/);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/admin'), env, {});
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /admin-auth-v54\.css\?v=540/);
    assert.match(html, /admin-auth-v54\.js\?v=540/);
    assert.match(html, /data-senecompare-admin-auth="5\.4\.0"/);
    assert.match(response.headers.get('x-senecompare-admin-auth') || '', /recovery-v54/);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log('SeneCompare 5.4 runtime contract passed');
