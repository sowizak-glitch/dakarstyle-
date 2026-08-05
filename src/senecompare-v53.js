import frontend from './senecompare-final-v52.js';

const RELEASE = '5.3.0';
const FILES = new Map([
  ['/monetization-v53.css', { source: '/senecompare/monetization-v53.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/monetization-v53.patch.css', { source: '/senecompare/monetization-v53.patch.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/monetization-v53.js', { source: '/senecompare/monetization-v53.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
  ['/admin-v53.css', { source: '/senecompare/admin-v53.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/admin-v53.js', { source: '/senecompare/admin-v53.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
]);

function assetRequest(request, sourcePath) {
  const source = new URL(request.url);
  source.pathname = sourcePath;
  source.search = '';
  return new Request(source.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || '*/*' } });
}

function headers(type, cache, admin = false) {
  const value = new Headers({
    'Content-Type': type,
    'Cache-Control': cache,
    'CDN-Cache-Control': cache,
    'Cloudflare-CDN-Cache-Control': cache,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': admin ? 'no-referrer' : 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(self), microphone=(self), payment=(), usb=(), serial=(), bluetooth=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-SeneCompare-Release': RELEASE,
    'X-SeneCompare-Analytics': 'first-party-private-v53',
    'X-SeneCompare-Ads': 'transparent-house-campaigns-v53',
  });
  if (type.startsWith('text/html')) {
    value.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '));
    if (admin) value.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return value;
}

async function readAsset(request, env, sourcePath) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const response = await env.ASSETS.fetch(assetRequest(request, sourcePath));
    return response.ok ? response : null;
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v53_asset_failed', sourcePath, detail: String(error) }));
    return null;
  }
}

async function serveFile(request, env, descriptor) {
  const asset = await readAsset(request, env, descriptor.source);
  if (!asset) return null;
  return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers: headers(descriptor.type, descriptor.cache) });
}

async function serveAdmin(request, env) {
  const asset = await readAsset(request, env, '/senecompare/admin-v53.html');
  if (!asset) return null;
  let html = await asset.text();
  const marker = `<span hidden data-senecompare-admin-release="${RELEASE}">Admin ${RELEASE}</span>`;
  if (!html.includes('data-senecompare-admin-release')) html = html.replace('</body>', `${marker}</body>`);
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: headers('text/html; charset=utf-8', 'no-cache, no-store, must-revalidate', true),
  });
}

function injectMonetization(html) {
  let output = html;
  if (!output.includes('/monetization-v53.css')) output = output.replace('</head>', '<link rel="stylesheet" href="/monetization-v53.css?v=530"></head>');
  if (!output.includes('/monetization-v53.patch.css')) output = output.replace('</head>', '<link rel="stylesheet" href="/monetization-v53.patch.css?v=5301"></head>');
  if (!output.includes('/monetization-v53.js')) output = output.replace('</body>', '<script src="/monetization-v53.js?v=530" defer></script></body>');
  const marker = `<span hidden data-senecompare-release="${RELEASE}" data-admin-enabled="true" data-advertising-enabled="true">Release ${RELEASE}</span>`;
  if (!output.includes(`data-senecompare-release="${RELEASE}"`)) output = output.replace('</body>', `${marker}</body>`);
  return output;
}

function releaseHeaders(source, contentType = '') {
  const value = new Headers(source);
  value.set('X-SeneCompare-Release', RELEASE);
  value.set('X-SeneCompare-Analytics', 'first-party-private-v53');
  value.set('X-SeneCompare-Ads', 'transparent-house-campaigns-v53');
  if (contentType) value.set('Content-Type', contentType);
  value.delete('Content-Length');
  value.delete('Content-Encoding');
  return value;
}

async function finalizeServiceWorker(request, response) {
  let source = await response.text();
  const needle = "'/final-v52.js?v=520'";
  const extra = "'/final-v52.js?v=520','/monetization-v53.css?v=530','/monetization-v53.patch.css?v=5301','/monetization-v53.js?v=530','/admin-v53.css?v=530','/admin-v53.js?v=530'";
  if (source.includes(needle) && !source.includes('/monetization-v53.js')) source = source.replace(needle, extra);
  source += `\nself.__SENECOMPARE_RELEASE__=${JSON.stringify(RELEASE)};`;
  const value = releaseHeaders(response.headers, 'application/javascript; charset=utf-8');
  value.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  value.set('Service-Worker-Allowed', '/');
  return new Response(request.method === 'HEAD' ? null : source, { status: response.status, headers: value });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if ((url.pathname === '/admin' || url.pathname === '/admin/') && ['GET', 'HEAD'].includes(request.method)) {
      const admin = await serveAdmin(request, env);
      if (admin) return admin;
    }
    const descriptor = FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const local = await serveFile(request, env, descriptor);
      if (local) return local;
    }

    const response = await frontend.fetch(request, env, ctx);
    if (url.pathname === '/sw.js' && response.ok) return finalizeServiceWorker(request, response);
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html') && request.method !== 'HEAD') {
      return new Response(injectMonetization(await response.text()), {
        status: response.status,
        statusText: response.statusText,
        headers: releaseHeaders(response.headers),
      });
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: releaseHeaders(response.headers),
    });
  },
};
