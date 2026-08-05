import frontend from './senecompare-resilient.js';
import { BRAND_URLS, SENECOMPARE_RELEASE, brandAssetResponse, isBrandAsset } from './senecompare-brand-v52.js';

const FINAL_FILES = new Map([
  ['/final-v52.css', { source: '/senecompare/final-v52.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/final-v52.js', { source: '/senecompare/final-v52.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
]);

function assetRequest(request, sourcePath) {
  const source = new URL(request.url);
  source.pathname = sourcePath;
  source.search = '';
  return new Request(source.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || '*/*' } });
}

async function serveFinalFile(request, env, descriptor) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const asset = await env.ASSETS.fetch(assetRequest(request, descriptor.source));
    if (!asset.ok) return null;
    const headers = new Headers({
      'Content-Type': descriptor.type,
      'Cache-Control': descriptor.cache,
      'CDN-Cache-Control': descriptor.cache,
      'Cloudflare-CDN-Cache-Control': descriptor.cache,
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-SeneCompare-Release': SENECOMPARE_RELEASE,
    });
    return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_final_asset_failed', source: descriptor.source, detail: String(error) }));
    return null;
  }
}

function releaseHeaders(source) {
  const headers = new Headers(source);
  headers.set('X-SeneCompare-Release', SENECOMPARE_RELEASE);
  headers.set('X-SeneCompare-Brand', 'official-senegal-logo');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  return headers;
}

function injectFinal(html) {
  let output = html;
  const favicon = `<link rel="icon" href="${BRAND_URLS.favicon}" type="image/webp" sizes="192x192">`;
  const apple = `<link rel="apple-touch-icon" href="${BRAND_URLS.appleTouch}" sizes="192x192">`;
  if (/<link rel="icon"[^>]*>/i.test(output)) output = output.replace(/<link rel="icon"[^>]*>/i, favicon);
  else output = output.replace('</head>', `${favicon}</head>`);
  if (/<link rel="apple-touch-icon"[^>]*>/i.test(output)) output = output.replace(/<link rel="apple-touch-icon"[^>]*>/i, apple);
  else output = output.replace('</head>', `${apple}</head>`);

  if (!output.includes('property="og:image"')) {
    output = output.replace('</head>', `<meta property="og:type" content="website"><meta property="og:site_name" content="SeneCompare"><meta property="og:image" content="https://senecompare.dakarstyle.com/profile.webp?v=520"><meta name="twitter:card" content="summary"><meta name="twitter:image" content="https://senecompare.dakarstyle.com/profile.webp?v=520"></head>`);
  }
  if (!output.includes('/final-v52.css')) output = output.replace('</head>', `<link rel="stylesheet" href="/final-v52.css?v=520"></head>`);
  if (!output.includes('/final-v52.js')) output = output.replace('</body>', `<script src="/final-v52.js?v=520" defer></script></body>`);

  output = output.replace(/<span class="brand-mark"([^>]*)>SC<\/span>/g, `<span class="brand-mark"$1><img src="${BRAND_URLS.profile}" alt="" width="58" height="58"></span>`);
  output = output.replace('<strong>SeneCompare <em>AI</em></strong>', '<strong>SeneCompare <em>Sénégal</em></strong>');
  const marker = `<span hidden data-senecompare-release="${SENECOMPARE_RELEASE}" data-official-brand="true">Release ${SENECOMPARE_RELEASE}</span>`;
  if (!output.includes('data-senecompare-release')) output = output.replace('</body>', `${marker}</body>`);
  return output;
}

async function finalizeManifest(request, response) {
  const manifest = await response.json().catch(() => ({}));
  manifest.name = 'SeneCompare Sénégal';
  manifest.short_name = 'SeneCompare';
  manifest.description = 'Comparez produits, services et besoins du quotidien au Sénégal, en français ou en wolof.';
  manifest.icons = [
    { src: BRAND_URLS.icon192, sizes: '192x192', type: 'image/webp', purpose: 'any' },
    { src: BRAND_URLS.icon512, sizes: '512x512', type: 'image/webp', purpose: 'any' },
    { src: BRAND_URLS.maskable512, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
  ];
  manifest.shortcuts = [
    { name: 'Comparer un téléphone', short_name: 'Téléphone', url: '/?q=telephone%20smartphone&category=phones&source=shortcut', icons: [{ src: BRAND_URLS.icon192, sizes: '192x192', type: 'image/webp' }] },
    { name: 'Chercher une voiture', short_name: 'Voiture', url: '/?q=voiture%20occasion%20Sénégal&category=cars&source=shortcut', icons: [{ src: BRAND_URLS.icon192, sizes: '192x192', type: 'image/webp' }] },
    { name: 'Trouver un service', short_name: 'Services', url: '/?q=services%20professionnels%20Sénégal&source=shortcut', icons: [{ src: BRAND_URLS.icon192, sizes: '192x192', type: 'image/webp' }] },
    { name: 'Recherche vocale', short_name: 'Parler', url: '/?voice=1&source=shortcut', icons: [{ src: BRAND_URLS.icon192, sizes: '192x192', type: 'image/webp' }] },
  ];
  const headers = releaseHeaders(response.headers);
  headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
  headers.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(manifest), { status: response.status, headers });
}

async function finalizeServiceWorker(request, response) {
  let source = await response.text();
  const replacement = `'/icon-192.webp?v=520','/icon-512.webp?v=520','/maskable-512.webp?v=520','/final-v52.css?v=520','/final-v52.js?v=520'`;
  source = source.replace("'/icon.svg?v='+VERSION", replacement);
  source += `\nself.__SENECOMPARE_RELEASE__=${JSON.stringify(SENECOMPARE_RELEASE)};`;
  const headers = releaseHeaders(response.headers);
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Service-Worker-Allowed', '/');
  return new Response(request.method === 'HEAD' ? null : source, { status: response.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isBrandAsset(url.pathname)) return brandAssetResponse(request, url.pathname);
    const descriptor = FINAL_FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const asset = await serveFinalFile(request, env, descriptor);
      if (asset) return asset;
    }
    if (url.pathname === '/icon.svg') {
      return Response.redirect(new URL(BRAND_URLS.icon512, url.origin).toString(), 302);
    }

    const response = await frontend.fetch(request, env, ctx);
    if (url.pathname === '/manifest.webmanifest' && response.ok) return finalizeManifest(request, response);
    if (url.pathname === '/sw.js' && response.ok) return finalizeServiceWorker(request, response);

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html') && request.method !== 'HEAD') {
      const headers = releaseHeaders(response.headers);
      return new Response(injectFinal(await response.text()), { status: response.status, statusText: response.statusText, headers });
    }
    const headers = releaseHeaders(response.headers);
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
