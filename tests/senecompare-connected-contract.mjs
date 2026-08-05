import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import connected from '../src/senecompare-connected.js';

const root = resolve(import.meta.dirname, '..');
const originalFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  calls.push({ method: request.method, pathname: url.pathname });

  if (url.hostname === 'xmdpmtvieqgoorbxytey.supabase.co' && url.pathname === '/rest/v1/rpc/senecompare_search_catalog') {
    return new Response(JSON.stringify([
      {
        id: 'offer-live-1',
        title: 'iPhone 13 128 Go — Venant',
        category: 'phones',
        seller: 'Marchand test',
        seller_type: 'merchant',
        city: 'Dakar',
        price: 175000,
        currency: 'XOF',
        condition: 'used',
        source_name: 'Expat-Dakar',
        source_url: 'https://example.com/offer',
        verified_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        cross_checks: 2,
        seller_verified: true,
        price_consistency: 0.9,
        image_url: '',
        description: 'Annonce publique à confirmer.',
        status: 'verified',
      },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (url.hostname === 'xmdpmtvieqgoorbxytey.supabase.co' && url.pathname.startsWith('/rest/v1/senecompare_')) {
    return new Response(null, { status: 201 });
  }

  throw new Error(`Unexpected outbound request: ${request.method} ${request.url}`);
};

const env = {
  SENECOMPARE_SUPABASE_URL: 'https://xmdpmtvieqgoorbxytey.supabase.co',
  SENECOMPARE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      const path = resolve(root, `.${url.pathname}`);
      const body = await readFile(path);
      return new Response(request.method === 'HEAD' ? null : body, { status: 200 });
    },
  },
};
const ctx = { waitUntil(promise) { void Promise.resolve(promise); } };

try {
  {
    const response = await connected.fetch(new Request('https://senecompare.dakarstyle.com/api/health'), env, ctx);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.version, '4.1.0');
    assert.equal(payload.catalog_connected, true);
    assert.equal(payload.data_mode, 'supabase_catalog');
  }

  {
    const response = await connected.fetch(new Request('https://senecompare.dakarstyle.com/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://senecompare.dakarstyle.com' },
      body: JSON.stringify({ query: 'iPhone moins de 250000 F à Dakar', category: 'phones', city: 'Dakar', maxPrice: 250000 }),
    }), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-senecompare-version'), '4.1.0');
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data_mode, 'supabase_catalog');
    assert.equal(payload.results.length, 1);
    assert.equal(payload.results[0].price, 175000);
    assert.equal(payload.results[0].trust.label, 'high');
  }

  {
    const response = await connected.fetch(new Request('https://senecompare.dakarstyle.com/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://senecompare.dakarstyle.com' },
      body: JSON.stringify({ offerId: 'offer-live-1', reason: 'price_outdated', details: 'Test contract', locale: 'fr' }),
    }), env, ctx);
    assert.equal(response.status, 202);
    assert.equal((await response.json()).accepted, true);
  }

  {
    const response = await connected.fetch(new Request('https://senecompare.dakarstyle.com/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ offerId: 'offer-live-1', reason: 'other' }),
    }), env, ctx);
    assert.equal(response.status, 403);
  }

  assert.ok(calls.some((call) => call.pathname === '/rest/v1/rpc/senecompare_search_catalog'));
  assert.ok(calls.some((call) => call.pathname === '/rest/v1/senecompare_price_reports'));
  console.log('SeneCompare connected contract tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
