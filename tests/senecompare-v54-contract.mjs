import assert from 'node:assert/strict';
import fs from 'node:fs';
import application from '../src/senecompare-v54.js';

const premiumJs = fs.readFileSync('senecompare/monetization-v54.js', 'utf8');
const premiumCss = fs.readFileSync('senecompare/monetization-v54.css', 'utf8');
const authJs = fs.readFileSync('senecompare/admin-auth-v54.js', 'utf8');
const authCss = fs.readFileSync('senecompare/admin-auth-v54.css', 'utf8');

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
assert.match(authJs, /localhost/);
assert.match(authJs, /access_token/);
assert.match(authJs, /sessionStorage\.setItem/);
assert.match(authCss, /sc-auth-recovery/);

const calls = [];
const env = {
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      const files = {
        '/senecompare/index.html': '<!doctype html><html><head></head><body><footer></footer></body></html>',
        '/senecompare/admin-v53.html': '<!doctype html><html><head></head><body><form id="adminLoginForm"></form></body></html>',
        '/senecompare/monetization-v54.css': premiumCss,
        '/senecompare/monetization-v54.js': premiumJs,
        '/senecompare/admin-auth-v54.css': authCss,
        '/senecompare/admin-auth-v54.js': authJs,
        '/assets/hero/ensemble-senegal-boutique-2026.jpg': 'jpeg-bytes',
        '/assets/samabusiness/samabusiness-192.webp': 'webp-bytes',
      };
      const content = files[path];
      if (content === undefined) return new Response('not found', { status: 404 });
      const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'application/javascript' : path.endsWith('.jpg') ? 'image/jpeg' : path.endsWith('.webp') ? 'image/webp' : 'text/html';
      return new Response(content, { status: 200, headers: { 'content-type': type } });
    },
  },
};

for (const [path, type] of [
  ['/monetization-v54.css', 'text/css'],
  ['/monetization-v54.js', 'application/javascript'],
  ['/admin-auth-v54.css', 'text/css'],
  ['/admin-auth-v54.js', 'application/javascript'],
  ['/media/sowhat-africa-campaign.jpg', 'image/jpeg'],
  ['/media/samabusiness-campaign.webp', 'image/webp'],
]) {
  const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}`), env, {});
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') || '', new RegExp(type), path);
  assert.equal(response.headers.get('x-senecompare-release'), '5.4.0');
}

assert.ok(calls.includes('/assets/hero/ensemble-senegal-boutique-2026.jpg'));
assert.ok(calls.includes('/assets/samabusiness/samabusiness-192.webp'));
console.log('SeneCompare 5.4 premium ads, contact and auth recovery contract passed');
