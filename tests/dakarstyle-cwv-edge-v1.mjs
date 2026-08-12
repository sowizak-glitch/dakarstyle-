import assert from 'node:assert/strict';
import { applyDakarstyleCwvHints, __testing } from '../src/dakarstyle-cwv-edge-v1.js';

let assertions = 0;
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function response(headers = {}) {
  return new Response('<!doctype html><html><body>ok</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', link: '<https://dakarstyle.com/>; rel="canonical"', ...headers },
  });
}

{
  const transformed = applyDakarstyleCwvHints(new Request('https://dakarstyle.com/'), response());
  equal(transformed.headers.get('x-aether-cwv-release'), __testing.RELEASE, 'release header');
  const link = transformed.headers.get('link') || '';
  ok(link.includes('<https://dakarstyle.com/>; rel="canonical"'), 'canonical Link is preserved');
  ok(link.includes('</assets/css/dakarstyle-base-2026.css>; rel=preload; as=style'), 'base CSS is discovered from response headers');
  ok(link.includes('</assets/js/dakarstyle-base-2026.js>; rel=preload; as=script'), 'base JS is discovered from response headers');
  const body = await transformed.text();
  ok(body.includes('<body>ok</body>'), 'body is unchanged');
}

{
  const original = response();
  const transformed = applyDakarstyleCwvHints(new Request('https://dakarstyle.com/?utm_source=test'), original);
  equal(transformed.headers.get('x-aether-cwv-release'), null, 'tracking variant gets no critical preload mutation');
}

{
  const original = response();
  const transformed = applyDakarstyleCwvHints(new Request('https://senecompare.dakarstyle.com/'), original);
  equal(transformed.headers.get('x-aether-cwv-release'), null, 'other ecosystem host is untouched');
}

{
  const json = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  const transformed = applyDakarstyleCwvHints(new Request('https://dakarstyle.com/'), json);
  equal(transformed.headers.get('x-aether-cwv-release'), null, 'non-HTML response is untouched');
}

{
  const once = applyDakarstyleCwvHints(new Request('https://dakarstyle.com/'), response());
  const twice = applyDakarstyleCwvHints(new Request('https://dakarstyle.com/'), once);
  const link = twice.headers.get('link') || '';
  for (const hint of __testing.CRITICAL_HINTS) {
    equal(link.split(hint).length - 1, 1, `hint remains unique: ${hint}`);
  }
}

console.log(`dakarstyle-cwv-edge-v1: ${assertions} assertions passed`);
