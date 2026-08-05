import assert from 'node:assert/strict';
import application from '../src/senecompare-resilient.js';

const originalFetch = globalThis.fetch;
const assetCalls = [];
const upstreamCalls = [];

const env = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      assetCalls.push(url.pathname);
      if (url.pathname === '/senecompare/index.html') {
        return new Response('<!doctype html><html><head><link rel="manifest" href="/manifest.webmanifest?v=5.0.0"><link rel="stylesheet" href="/styles.css?v=5.0.0"></head><body><main>SeneCompare AI</main><button id="installButton">Installer</button><script src="/app.js?v=5.0.0"></script><footer>Version 5.0.0</footer></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (url.pathname === '/senecompare/styles.css') return new Response('body{font-family:system-ui}', { status: 200, headers: { 'content-type': 'text/css' } });
      if (url.pathname === '/senecompare/app.js') return new Response("const VERSION='5.0.0';globalThis.__SC_VERSION__=VERSION;", { status: 200, headers: { 'content-type': 'application/javascript' } });
      return new Response('not found', { status: 404 });
    },
  },
};

globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  upstreamCalls.push(url.toString());
  if (url.pathname.endsWith('/senecompare-gateway/health')) {
    return new Response(JSON.stringify({
      ok: true,
      app: 'SeneCompare AI',
      version: '5.0.0',
      engine_version: '5.0.0',
      data_mode: 'hybrid_local_search',
      catalog_connected: true,
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-senecompare-version': '5.0.0' } });
  }
  throw new Error(`Unexpected upstream request: ${url}`);
};

try {
  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/?v=500', { headers: { accept: 'text/html' } }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-senecompare-version'), '5.0.0');
    assert.equal(response.headers.get('x-senecompare-frontend'), 'cloudflare-local-assets-v5');
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
    const html = await response.text();
    assert.match(html, /SeneCompare AI/);
    assert.match(html, /Version 5\.0\.0/);
    assert.match(html, /installButton/);
    assert.match(html, /styles\.css\?v=5\.0\.0/);
    assert.match(html, /app\.js\?v=5\.0\.0/);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/styles.css?v=5.0.0'), env);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/css/);
    assert.match(await response.text(), /font-family/);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/app.js?v=5.0.0'), env);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /javascript/);
    assert.match(await response.text(), /5\.0\.0/);
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/api/health'), env);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.version, '5.0.0');
    assert.equal(payload.data_mode, 'hybrid_local_search');
  }

  {
    const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/manifest.webmanifest'), env);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.short_name, 'SeneCompare');
    assert.equal(payload.start_url, '/?source=pwa&v=5');
  }

  assert.ok(assetCalls.includes('/senecompare/index.html'));
  assert.ok(assetCalls.includes('/senecompare/styles.css'));
  assert.ok(assetCalls.includes('/senecompare/app.js'));
  assert.ok(upstreamCalls.some((url) => url.includes('/senecompare-gateway/health')));
  assert.ok(upstreamCalls.every((url) => !url.includes('/senecompare-app')));
  console.log('SeneCompare v5 resilient frontend contract tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
