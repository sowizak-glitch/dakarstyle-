import domain from './senecompare-domain.js';

const VERSION = '4.1.0';
const FRONTEND_FILES = new Map([
  ['/styles.css', { source: '/senecompare/styles.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/app.js', { source: '/senecompare/app.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
]);
const DOMAIN_PATHS = new Set([
  '/manifest.webmanifest',
  '/sw.js',
  '/icon.svg',
  '/expansion.js',
  '/__cache_reset',
  '/__health',
  '/robots.txt',
  '/sitemap.xml',
]);

function secureHeaders(contentType, cacheControl) {
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'CDN-Cache-Control': cacheControl,
    'Cloudflare-CDN-Cache-Control': cacheControl,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), geolocation=(self), microphone=(self), payment=(), usb=(), serial=(), bluetooth=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-SeneCompare-Version': VERSION,
    'X-SeneCompare-Frontend': 'cloudflare-local-assets',
  });

  if (contentType.startsWith('text/html')) {
    headers.set('Content-Language', 'fr-SN');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self' data: https:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '));
    headers.set('Link', '<https://senecompare.dakarstyle.com/>; rel="canonical"');
  } else {
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  return headers;
}

function assetRequest(request, sourcePath) {
  const source = new URL(request.url);
  source.pathname = sourcePath;
  source.search = '';
  return new Request(source.toString(), {
    method: 'GET',
    headers: {
      Accept: request.headers.get('Accept') || '*/*',
      'Accept-Language': request.headers.get('Accept-Language') || 'fr-SN,fr;q=0.9',
    },
  });
}

async function readAsset(request, env, sourcePath) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const response = await env.ASSETS.fetch(assetRequest(request, sourcePath));
    return response.ok ? response : null;
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_local_asset_failed', sourcePath, detail: String(error) }));
    return null;
  }
}

function upgradeVersion(content) {
  return content
    .replaceAll('4.0.0', VERSION)
    .replaceAll('v=400', 'v=410');
}

async function serveFrontendFile(request, env, descriptor) {
  const asset = await readAsset(request, env, descriptor.source);
  if (!asset) return null;

  let body = await asset.text();
  if (descriptor.source.endsWith('/app.js')) body = upgradeVersion(body);

  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: secureHeaders(descriptor.type, descriptor.cache),
  });
}

async function serveLocalApplication(request, env) {
  const asset = await readAsset(request, env, '/senecompare/index.html');
  if (!asset) return null;

  let html = upgradeVersion(await asset.text());
  const marker = `<span hidden data-senecompare-version="${VERSION}">Version ${VERSION}</span>`;
  html = html.includes('</body>') ? html.replace('</body>', `${marker}</body>`) : `${html}${marker}`;

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: secureHeaders('text/html; charset=utf-8', 'no-cache, no-store, must-revalidate'),
  });
}

function shouldUseDomain(url) {
  return url.pathname.startsWith('/api/') || DOMAIN_PATHS.has(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (shouldUseDomain(url)) return domain.fetch(request, env, ctx);

    const frontendFile = FRONTEND_FILES.get(url.pathname);
    if (frontendFile && ['GET', 'HEAD'].includes(request.method)) {
      const local = await serveFrontendFile(request, env, frontendFile);
      if (local) return local;
      return domain.fetch(request, env, ctx);
    }

    if (['GET', 'HEAD'].includes(request.method)) {
      const local = await serveLocalApplication(request, env);
      if (local) return local;
    }

    return domain.fetch(request, env, ctx);
  },
};
