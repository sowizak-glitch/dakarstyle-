const VERSION = '4.1.0';
const PROJECT_ORIGIN = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const FUNCTIONS = `${PROJECT_ORIGIN}/functions/v1`;
const APP_UPSTREAM = `${FUNCTIONS}/senecompare-app`;
const GATEWAY_UPSTREAM = `${FUNCTIONS}/senecompare-gateway`;
const CANONICAL_ORIGIN = 'https://senecompare.dakarstyle.com';
const METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);

const MANIFEST = {
  id: `${CANONICAL_ORIGIN}/`,
  name: 'SeneCompare AI',
  short_name: 'SeneCompare',
  description: 'Comparez les produits et services au Sénégal avec sources et confiance visibles.',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  background_color: '#f4f7f8',
  theme_color: '#071c2c',
  lang: 'fr-SN',
  dir: 'ltr',
  orientation: 'portrait-primary',
  categories: ['shopping', 'utilities', 'business'],
  icons: [{ src: `/icon.svg?v=${VERSION}`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  shortcuts: [
    { name: 'Comparer un téléphone', short_name: 'Téléphone', url: '/?q=telephone%20smartphone&source=shortcut' },
    { name: 'Comparer une voiture', short_name: 'Voiture', url: '/?q=voiture%20occasion&source=shortcut' },
    { name: 'Comparer une livraison', short_name: 'Livraison', url: '/?q=service%20livraison%20colis&source=shortcut' },
  ],
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="SeneCompare AI"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#04131f"/><stop offset="1" stop-color="#0b3d4a"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7db8d"/><stop offset="1" stop-color="#e8b84c"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#b)"/><circle cx="256" cy="256" r="174" fill="none" stroke="#10a982" stroke-opacity=".25" stroke-width="18"/><path d="M126 183h194l-32-32 27-27 78 78-78 78-27-27 32-32H126z" fill="#10a982"/><path d="M386 329H192l32 32-27 27-78-78 78-78 27 27-32 32h194z" fill="url(#g)"/><rect x="181" y="181" width="150" height="150" rx="42" fill="#fff" fill-opacity=".96"/><text x="256" y="279" text-anchor="middle" font-family="Arial,sans-serif" font-size="78" font-weight="900" letter-spacing="-8" fill="#071c2c">SC</text></svg>`;

function serviceWorker() {
  return `const VERSION=${JSON.stringify(VERSION)};
const CACHE='senecompare-shell-'+VERSION;
const ASSETS=['/','/manifest.webmanifest?v='+VERSION,'/icon.svg?v='+VERSION];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('senecompare-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__')){event.respondWith(fetch(request,{cache:'no-store'}));return;}if(request.mode==='navigate'){event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/',copy)));}return response;}).catch(()=>caches.match('/')));return;}event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));});`;
}

function baseHeaders(contentType, cacheControl = 'no-store') {
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
    'X-SeneCompare-Frontend': 'cloudflare-zero-trust-facade',
  });
  if (contentType.startsWith('text/html')) {
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
  } else {
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  return headers;
}

function text(value, contentType, cacheControl = 'no-store', status = 200) {
  return new Response(value, { status, headers: baseHeaders(contentType, cacheControl) });
}

function json(value, status = 200, extra = {}) {
  const headers = baseHeaders('application/json; charset=utf-8', 'no-store');
  for (const [key, val] of Object.entries(extra)) headers.set(key, String(val));
  return new Response(JSON.stringify(value), { status, headers });
}

function apiSuffix(pathname) {
  const suffix = pathname.slice('/api'.length);
  return suffix || '/health';
}

async function proxyApi(request, url) {
  const target = new URL(`${GATEWAY_UPSTREAM}${apiSuffix(url.pathname)}${url.search}`);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || 'application/json',
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
    Origin: CANONICAL_ORIGIN,
    'X-Client-Version': request.headers.get('X-Client-Version') || `senecompare-domain-${VERSION}`,
    'User-Agent': request.headers.get('User-Agent') || `SeneCompareDomain/${VERSION}`,
  });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(url.pathname.endsWith('/search') ? 58_000 : 20_000),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_gateway_unavailable', detail: String(error) }));
    return json({ ok: false, code: 'GATEWAY_UNAVAILABLE', message: 'Le moteur est momentanément indisponible.' }, 503, { 'Retry-After': '30' });
  }

  const responseHeaders = baseHeaders(upstream.headers.get('Content-Type') || 'application/json; charset=utf-8', 'no-store');
  const serverTiming = upstream.headers.get('Server-Timing');
  const retryAfter = upstream.headers.get('Retry-After');
  if (serverTiming) responseHeaders.set('Server-Timing', serverTiming);
  if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
  responseHeaders.set('X-SeneCompare-Gateway-Version', upstream.headers.get('X-SeneCompare-Version') || VERSION);
  responseHeaders.delete('Content-Length');
  responseHeaders.delete('Content-Encoding');
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function serveApp(request) {
  try {
    const upstream = await fetch(`${APP_UPSTREAM}?v=${VERSION}`, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': request.headers.get('User-Agent') || `SeneCompareDomain/${VERSION}`,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error(`app_${upstream.status}`);
    const headers = baseHeaders('text/html; charset=utf-8', 'no-cache, no-store, must-revalidate');
    headers.set('Link', `<${CANONICAL_ORIGIN}/>; rel="canonical"`);
    headers.set('Content-Language', 'fr-SN');
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: 200, headers });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_app_unavailable', detail: String(error) }));
    return text('SeneCompare est momentanément indisponible.', 'text/plain; charset=utf-8', 'no-store', 503);
  }
}

async function health(request) {
  const probe = new Request(`${CANONICAL_ORIGIN}/api/health`, { method: 'GET', headers: request.headers });
  const response = await proxyApi(probe, new URL(probe.url));
  if (!response.ok) return response;
  const value = await response.json().catch(() => ({}));
  return json({
    ...value,
    ok: value.ok === true,
    frontend_version: VERSION,
    frontend: 'Cloudflare Zero Trust Facade',
    same_origin_api: true,
    checked_at: new Date().toISOString(),
  }, value.ok === true ? 200 : 503);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!METHODS.has(request.method)) return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, HEAD, POST, OPTIONS' });

    if (request.method === 'OPTIONS') {
      const headers = baseHeaders('text/plain; charset=utf-8', 'public, max-age=86400');
      headers.set('Access-Control-Allow-Origin', CANONICAL_ORIGIN);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'content-type,x-client-version');
      headers.set('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname.startsWith('/api/')) return proxyApi(request, url);
    if (url.pathname === '/__health') return health(request);
    if (url.pathname === '/manifest.webmanifest') return text(JSON.stringify(MANIFEST), 'application/manifest+json; charset=utf-8', 'no-cache, must-revalidate');
    if (url.pathname === '/sw.js') {
      const response = text(serviceWorker(), 'application/javascript; charset=utf-8', 'no-cache, no-store, must-revalidate');
      response.headers.set('Service-Worker-Allowed', '/');
      return response;
    }
    if (url.pathname === '/icon.svg') return text(ICON, 'image/svg+xml; charset=utf-8', 'public, max-age=86400');
    if (url.pathname === '/expansion.js') return text(`globalThis.__SENECOMPARE_EXPANSION_VERSION__=${JSON.stringify(VERSION)};`, 'application/javascript; charset=utf-8', 'no-cache');
    if (url.pathname === '/__cache_reset') {
      const headers = baseHeaders('application/json; charset=utf-8', 'no-store');
      headers.set('Clear-Site-Data', '"cache"');
      return new Response(JSON.stringify({ ok: true, version: VERSION }), { status: 200, headers });
    }
    if (url.pathname === '/robots.txt') return text('User-agent: *\nAllow: /\nSitemap: https://senecompare.dakarstyle.com/sitemap.xml\n', 'text/plain; charset=utf-8', 'public, max-age=3600');
    if (url.pathname === '/sitemap.xml') return text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${CANONICAL_ORIGIN}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`, 'application/xml; charset=utf-8', 'public, max-age=3600');

    return serveApp(request);
  },
};
