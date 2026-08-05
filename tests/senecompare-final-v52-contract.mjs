import assert from 'node:assert/strict';
import application from '../src/senecompare-final-v52.js';

const assets = new Map([
  ['/senecompare/index.html', '<!doctype html><html lang="fr-SN"><head><link rel="manifest" href="/manifest.webmanifest?v=5.0.0"><link rel="icon" href="/icon.svg?v=5.0.0"><link rel="apple-touch-icon" href="/icon.svg?v=5.0.0"><link rel="stylesheet" href="/styles.css?v=5.0.0"></head><body><header><span class="brand-mark">SC</span><span class="brand-copy"><strong>SeneCompare <em>AI</em></strong></span><button id="installButton">Installer</button></header><main>SeneCompare AI</main><script src="/app.js?v=5.0.0"></script><footer>Version 5.0.0</footer></body></html>'],
  ['/senecompare/styles.css', 'body{font-family:system-ui}'],
  ['/senecompare/app.js', "const VERSION='5.0.0';"],
  ['/senecompare/premium-v51.css', '.premium{display:block}'],
  ['/senecompare/premium-v51.js', "globalThis.__PREMIUM__='5.1.0';"],
  ['/senecompare/final-v52.css', '.sc-universe-card{min-height:116px}'],
  ['/senecompare/final-v52.js', "window.__SENECOMPARE_FINAL__={release:'5.2.0'};/* Covoiturage Babysitting Matériel agricole Panneaux solaires */"],
]);

const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (!assets.has(pathname)) return new Response('not found', { status: 404 });
      const type = pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'application/javascript' : 'text/html';
      return new Response(assets.get(pathname), { status: 200, headers: { 'content-type': type } });
    },
  },
};

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/?v=520'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-senecompare-version'), '5.0.0');
  assert.equal(response.headers.get('x-senecompare-release'), '5.2.0');
  assert.equal(response.headers.get('x-senecompare-brand'), 'official-senegal-logo');
  const html = await response.text();
  assert.match(html, /profile\.webp\?v=520/);
  assert.match(html, /final-v52\.css\?v=520/);
  assert.match(html, /final-v52\.js\?v=520/);
  assert.match(html, /SeneCompare <em>Sénégal<\/em>/);
  assert.match(html, /Release 5\.2\.0/);
  assert.doesNotMatch(html, /class="brand-mark">SC/);
}

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/manifest.webmanifest?v=520'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-senecompare-release'), '5.2.0');
  const manifest = await response.json();
  assert.equal(manifest.name, 'SeneCompare Sénégal');
  assert.equal(manifest.short_name, 'SeneCompare');
  assert.equal(manifest.start_url, '/?source=pwa&v=5');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/webp'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.short_name === 'Services'));
}

for (const path of ['/icon-192.webp', '/icon-512.webp', '/maskable-512.webp', '/profile.webp', '/apple-touch-icon.webp']) {
  const response = await application.fetch(new Request(`https://senecompare.dakarstyle.com${path}?v=520`), env);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('content-type'), 'image/webp', path);
  assert.equal(response.headers.get('x-senecompare-release'), '5.2.0', path);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.length > 4000, `${path} is too small`);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
}

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/final-v52.js?v=520'), env);
  assert.equal(response.status, 200);
  const source = await response.text();
  for (const marker of ['Covoiturage', 'Babysitting', 'Matériel agricole', 'Panneaux solaires', '__SENECOMPARE_FINAL__']) assert.match(source, new RegExp(marker));
}

{
  const response = await application.fetch(new Request('https://senecompare.dakarstyle.com/sw.js?v=520'), env);
  assert.equal(response.status, 200);
  const source = await response.text();
  assert.match(source, /icon-192\.webp\?v=520/);
  assert.match(source, /final-v52\.js\?v=520/);
  assert.match(source, /__SENECOMPARE_RELEASE__="5\.2\.0"/);
}

console.log('SeneCompare final 5.2 contract tests passed');
