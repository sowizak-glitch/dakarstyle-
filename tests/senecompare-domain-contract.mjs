import assert from 'node:assert/strict';
import domain from '../src/senecompare-domain.js';

const originalFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const isRequest = input instanceof Request;
  const url = new URL(isRequest ? input.url : String(input));
  const method = isRequest ? input.method : String(init.method || 'GET');
  const headers = isRequest ? input.headers : new Headers(init.headers || {});
  calls.push({ method, url: url.toString(), origin: headers.get('origin'), contentType: headers.get('content-type') });

  if (url.pathname.endsWith('/senecompare-gateway/health')) {
    return new Response(JSON.stringify({
      ok: true,
      app: 'SeneCompare AI',
      version: '5.0.0',
      engine_version: '5.0.0',
      data_mode: 'hybrid_local_search',
      catalog_connected: true,
      human_voice_available: true,
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-senecompare-version': '5.0.0' } });
  }

  if (url.pathname.endsWith('/senecompare-gateway/search')) {
    return new Response(JSON.stringify({
      ok: true,
      version: '5.0.0',
      data_mode: 'hybrid_local_search',
      results: [
        { id: 'offer-1', title: 'iPhone 13', total_fcfa: 175000, source_url: 'https://example.com/offer', result_type: 'offer' },
        { id: 'source-1', title: 'Chercher sur CoinAfrique', total_fcfa: null, source_url: 'https://sn.coinafrique.com', result_type: 'source' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-senecompare-version': '5.0.0' } });
  }

  if (url.pathname.endsWith('/senecompare-gateway/voice/speech')) {
    return new Response(new Uint8Array([73, 68, 51]), { status: 200, headers: { 'content-type': 'audio/mpeg', 'x-senecompare-voice': 'test' } });
  }

  throw new Error(`Unexpected upstream request: ${method} ${url}`);
};

try {
  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/?v=500'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-senecompare-version'), '5.0.0');
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.match(await response.text(), /Version 5\.0\.0/);
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/api/health'));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.version, '5.0.0');
    assert.equal(payload.data_mode, 'hybrid_local_search');
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
    assert.equal(payload.results[1].result_type, 'source');
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/api/voice/speech', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Bonjour', language: 'fr' }),
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /audio\/mpeg/);
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/manifest.webmanifest'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /manifest\+json/);
    const manifest = await response.json();
    assert.equal(manifest.short_name, 'SeneCompare');
    assert.equal(manifest.start_url, '/?source=pwa&v=5');
    assert.equal(manifest.display, 'standalone');
  }

  {
    const response = await domain.fetch(new Request('https://senecompare.dakarstyle.com/sw.js'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('service-worker-allowed'), '/');
    assert.match(await response.text(), /5\.0\.0/);
  }

  assert.ok(calls.some((call) => call.url.includes('/senecompare-gateway/health')));
  assert.ok(calls.some((call) => call.url.includes('/senecompare-gateway/search')));
  assert.ok(calls.some((call) => call.url.includes('/senecompare-gateway/voice/speech')));
  assert.ok(calls.every((call) => call.origin === 'https://senecompare.dakarstyle.com'));
  console.log('SeneCompare v5 domain contract tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
