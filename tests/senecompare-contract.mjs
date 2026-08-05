import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import senecompare from '../src/senecompare.js';

const root = resolve(import.meta.dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const env = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      const path = resolve(root, `.${url.pathname}`);
      const body = await readFile(path);
      const extension = Object.keys(contentTypes).find((key) => path.endsWith(key));
      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers: { 'content-type': contentTypes[extension] || 'application/octet-stream' },
      });
    },
  },
};

const ctx = {
  waitUntil(promise) {
    void Promise.resolve(promise);
  },
};

{
  const response = await senecompare.fetch(new Request('https://senecompare.dakarstyle.com/api/health'), env, ctx);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.app, 'SeneCompare AI');
  assert.equal(payload.data_mode, 'starter_catalog');
}

{
  const response = await senecompare.fetch(new Request('https://senecompare.dakarstyle.com/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'Samsung', city: 'Dakar', category: 'phones', sort: 'price_asc' }),
  }), env, ctx);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data_mode, 'starter_catalog');
  assert.ok(payload.results.length >= 1);
  assert.equal(payload.results[0].category, 'phones');
  assert.equal(payload.results[0].city, 'Dakar');
  assert.ok(payload.results[0].trust.score >= 0 && payload.results[0].trust.score <= 100);
  assert.ok(['high', 'medium', 'low'].includes(payload.results[0].trust.label));
}

{
  const response = await senecompare.fetch(new Request('https://senecompare.dakarstyle.com/'), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  const html = await response.text();
  assert.match(html, /SeneCompare AI/);
  assert.match(html, /Comparaison côte à côte/);
}

{
  const response = await senecompare.fetch(new Request('https://senecompare.dakarstyle.com/manifest.webmanifest'), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /manifest\+json/);
  const manifest = await response.json();
  assert.equal(manifest.short_name, 'SeneCompare');
}

{
  const response = await senecompare.fetch(new Request('https://senecompare.dakarstyle.com/api/search', { method: 'DELETE' }), env, ctx);
  assert.equal(response.status, 405);
}

console.log('SeneCompare contract tests passed');
