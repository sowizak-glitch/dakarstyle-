import assert from 'node:assert/strict';
import domain from '../src/senecompare-domain.js';

const originalFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  calls.push({ method: request.method, url: url.toString(), origin: request.headers.get('origin') });

  if (url.pathname.endsWith('/senecompare-app')) {
    return new Response('<!doctype html><html><body><h1>SeneCompare AI</h1><footer>Version 4.1.0</footer></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (url.pathname.endsWith('/senecompare-gateway/health')) {
    return new Response(JSON.stringify({
      ok: true,
      app: 'SeneCompare AI',
      service: 'SeneCompare Zero Trust Gateway',
      version: '4.1.0',
      engine_version: '3.0.1',
      data_mode: 'universal_search',
      catalog_connected: true,
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-senecompare-version': '4.1.0' } });
  }

  if (url.pathname.endsWith('/senecompare-gateway/search')) {
    return new Response(JSON.stringify({
      ok: true,
      version: '4.1.0',
      data_mode: 'universal_search',
      results: [{ id: 'offer-1', title: 'iPhone 13', total_fcfa: 175000, source_url: 'https://example.com/offer' }],
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-senecompare-version': '4.1.0' } });
  }

  throw new Error(`Unexpected upstream request: ${request.method} ${request.url}`);
};

try {
  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/?v=410'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-senecompare-version'), '4.1.0');
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.match(await response.text(), /Version 4\.1\.0/);
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/api/health'));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.version, '4.1.0');
    assert.equal(payload.data_mode, 'universal_search');
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://senecompare.dakarstyle.com' },
      body: JSON.stringify({ query: 'iPhone moins de 250000 F à Dakar' }),
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.results[0].total_fcfa, 175000);
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/manifest.webmanifest'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /manifest\+json/);
    const manifest = await response.json();
    assert.equal(manifest.short_name, 'SeneCompare');
    assert.equal(manifest.start_url, '/?source=pwa');
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/sw.js'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('service-worker-allowed'), '/');
    assert.match(await response.text(), /senecompare-shell/);
  }

  assert.ok(calls.some((call) => call.url.includes('/senecompare-app?v=4.1.0')));
  assert.ok(calls.some((call) => call.url.includes('/senecompare-gateway/health')));
  assert.ok(calls.some((call) => call.url.includes('/senecompare-gateway/search')));
  assert.ok(calls.filter((call) => call.url.includes('/senecompare-gateway/')).every((call) => call.origin === 'https://senecompare.dakarstyle.com'));
  console.log('SeneCompare domain contract tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
