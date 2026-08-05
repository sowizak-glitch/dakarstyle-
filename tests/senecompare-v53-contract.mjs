import assert from 'node:assert/strict';
import application from '../src/senecompare-v53.js';
import router from '../src/senecompare-v5-router.js';

const calls = [];
const env = {
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      const files = {
        '/senecompare/index.html': '<!doctype html><html lang="fr"><head><link rel="icon" href="/icon.svg"></head><body><header><span class="brand-mark">SC</span><span class="brand-copy"><strong>SeneCompare <em>AI</em></strong></span></header><button id="installButton">Installer</button><footer><div class="footer-links"></div></footer></body></html>',
        '/senecompare/admin-v53.html': '<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/admin-v53.css?v=530"></head><body><form id="adminLoginForm"><input value="idrissaminata@gmail.com"></form><script src="/admin-v53.js?v=530" defer></script></body></html>',
        '/senecompare/monetization-v53.css': '.sc-sponsored-shell{display:block}',
        '/senecompare/monetization-v53.js': "window.__SENECOMPARE_MONETIZATION__={version:'5.3.0'};",
        '/senecompare/admin-v53.css': '.sc-admin-login{display:grid}',
        '/senecompare/admin-v53.js': "window.__SENECOMPARE_ADMIN__={version:'5.3.0'};",
        '/senecompare/premium-v51.css': '.premium{}',
        '/senecompare/premium-v51.js': "window.__premium='5.1.0';",
        '/senecompare/final-v52.css': '.final{}',
        '/senecompare/final-v52.js': "window.__final='5.2.0';",
      };
      if (!(path in files)) return new Response('not found', { status: 404 });
      const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'application/javascript' : 'text/html';
      return new Response(files[path], { status: 200, headers: { 'content-type': `${type}; charset=utf-8` } });
    },
  },
};

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/?v=530'), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-senecompare-release'), '5.3.0');
  assert.equal(response.headers.get('x-senecompare-analytics'), 'first-party-private-v53');
  assert.equal(response.headers.get('x-senecompare-ads'), 'transparent-house-campaigns-v53');
  const html = await response.text();
  assert.match(html, /monetization-v53\.css\?v=530/);
  assert.match(html, /monetization-v53\.js\?v=530/);
  assert.match(html, /data-admin-enabled="true"/);
  assert.match(html, /Release 5\.3\.0/);
  assert.match(html, /SeneCompare <em>Sénégal<\/em>/);
}

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/admin'), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-senecompare-release'), '5.3.0');
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /idrissaminata@gmail\.com/);
  assert.match(html, /admin-v53\.css\?v=530/);
  assert.match(html, /admin-v53\.js\?v=530/);
  assert.match(html, /data-senecompare-admin-release="5\.3\.0"/);
}

for (const [path, pattern] of [
  ['/monetization-v53.css', /sc-sponsored-shell/],
  ['/monetization-v53.js', /SENECOMPARE_MONETIZATION/],
  ['/admin-v53.css', /sc-admin-login/],
  ['/admin-v53.js', /SENECOMPARE_ADMIN/],
]) {
  const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
  assert.equal(response.status, 200, path);
  assert.match(await response.text(), pattern, path);
}

const originalFetch = globalThis.fetch;
const upstreams = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const requestHeaders = input instanceof Request ? input.headers : new Headers(init.headers || {});
  const method = input instanceof Request ? input.method : String(init.method || 'GET').toUpperCase();
  upstreams.push({ url: url.toString(), headers: Object.fromEntries(requestHeaders.entries()), method });
  return new Response(JSON.stringify({ ok: true, route: url.pathname }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-senecompare-version': '5.1.0' },
  });
};

try {
  {
    const response = await router.fetch(new Request('https://senecompare.dakarstyle.com/api/ads'), env, {});
    assert.equal(response.status, 200);
    assert.ok(upstreams.at(-1).url.includes('/functions/v1/senecompare-admin-v53/ads'));
    assert.equal(response.headers.get('x-senecompare-admin'), '5.3.0');
  }
  {
    const response = await router.fetch(new Request('https://senecompare.dakarstyle.com/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }), env, {});
    assert.equal(response.status, 200);
    assert.ok(upstreams.at(-1).url.endsWith('/functions/v1/senecompare-admin-v53/track'));
  }
  {
    const upstreamCount = upstreams.length;
    const response = await router.fetch(new Request('https://senecompare.dakarstyle.com/api/admin/overview?days=7'), env, {});
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('x-senecompare-admin'), '5.3.0');
    assert.equal(upstreams.length, upstreamCount, 'anonymous admin traffic must not reach Supabase');
    const payload = await response.json();
    assert.equal(payload.code, 'AUTH_REQUIRED');
  }
  {
    const response = await router.fetch(new Request('https://senecompare.dakarstyle.com/api/admin/overview?days=7', {
      headers: { authorization: 'Bearer test-admin-token' },
    }), env, {});
    assert.equal(response.status, 200);
    assert.ok(upstreams.at(-1).url.includes('/functions/v1/senecompare-admin-v53/admin/overview?days=7'));
    assert.equal(upstreams.at(-1).headers.authorization, 'Bearer test-admin-token');
  }
  {
    const response = await router.fetch(new Request('https://senecompare.dakarstyle.com/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }), env, {});
    assert.equal(response.status, 200);
    assert.ok(upstreams.at(-1).url.endsWith('/functions/v1/senecompare-gateway-v5/search'));
  }
} finally {
  globalThis.fetch = originalFetch;
}

assert.ok(calls.includes('/senecompare/index.html'));
assert.ok(calls.includes('/senecompare/admin-v53.html'));
console.log('SeneCompare 5.3 admin and advertising contract passed');
