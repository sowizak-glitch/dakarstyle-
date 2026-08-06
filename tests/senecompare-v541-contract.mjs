import assert from 'node:assert/strict';
import fs from 'node:fs';
import application from '../src/senecompare-v541.js';

const wrapper = fs.readFileSync('src/senecompare-v541.js', 'utf8');
const script = fs.readFileSync('senecompare/media-path-v541.js', 'utf8');
const router = fs.readFileSync('src/router.js', 'utf8');
const index = fs.readFileSync('src/index.js', 'utf8');

for (const marker of [
  "import application from './senecompare-v5-router.js'",
  "const RELEASE = '5.4.1'",
  '/media/v541/samabusiness-campaign.webp',
  '/media/v541/sowhat-africa-campaign.webp',
  'verified-physical-v541',
  '/media-path-v541.js?v=541',
]) assert.match(wrapper, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const marker of [
  '/media/v541/samabusiness-campaign.webp',
  '/media/v541/sowhat-africa-campaign.webp',
  'physical-versioned-path',
]) assert.match(script, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(router, /import senecompare from '\.\/senecompare-v541\.js'/);
assert.match(index, /import senecompare from '\.\/senecompare-v541\.js'/);

const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/senecompare/media-path-v541.js') {
        return new Response(script, { status: 200, headers: { 'content-type': 'application/javascript' } });
      }
      return new Response('not found', { status: 404 });
    },
  },
};

const originalFetch = globalThis.fetch;
const edgeCalls = [];
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  edgeCalls.push(url.toString());
  return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]), {
    status: 200,
    headers: { 'content-type': 'image/webp', etag: '"exact-media"' },
  });
};

try {
  for (const [path, filename] of [
    ['/media/v541/samabusiness-campaign.webp', 'samabusiness-campaign.webp'],
    ['/media/v541/sowhat-africa-campaign.webp', 'sowhat-africa-campaign.webp'],
  ]) {
    const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('x-senecompare-release'), '5.4.1');
    assert.equal(response.headers.get('x-senecompare-media'), 'verified-physical-v541');
    assert.match(response.headers.get('cache-control') || '', /immutable/);
    assert.equal((await response.arrayBuffer()).byteLength, 12);
    assert.ok(edgeCalls.at(-1).endsWith(`/senecompare-media-v54/${filename}`));
  }

  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/media-path-v541.js'), env, {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/javascript/);
  assert.equal(response.headers.get('x-senecompare-media-path'), 'physical-v541');
  assert.match(await response.text(), /physical-versioned-path/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('SeneCompare 5.4.1 physical media path contract passed');
