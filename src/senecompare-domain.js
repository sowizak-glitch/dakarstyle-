const VERSION = '5.0.0';
const PROJECT_ORIGIN = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const GATEWAY = `${PROJECT_ORIGIN}/functions/v1/senecompare-gateway`;
const CANONICAL_ORIGIN = 'https://senecompare.dakarstyle.com';
const METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);

const MANIFEST = {
  id: `${CANONICAL_ORIGIN}/`,
  name: 'SeneCompare AI',
  short_name: 'SeneCompare',
  description: 'Cherchez et comparez les produits et services au Sénégal, en français ou en wolof, avec sources visibles.',
  start_url: '/?source=pwa&v=5',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  launch_handler: { client_mode: 'navigate-existing' },
  background_color: '#f3f7f7',
  theme_color: '#071c2c',
  lang: 'fr-SN',
  dir: 'ltr',
  orientation: 'portrait-primary',
  categories: ['shopping', 'utilities', 'business', 'lifestyle'],
  icons: [
    { src: `/icon.svg?v=${VERSION}`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: `/icon.svg?v=${VERSION}`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Comparer un téléphone', short_name: 'Téléphone', url: '/?q=telephone%20smartphone&category=phones&source=shortcut' },
    { name: 'Chercher une voiture', short_name: 'Voiture', url: '/?q=voiture%20occasion&category=cars&source=shortcut' },
    { name: 'Trouver une pharmacie', short_name: 'Pharmacie', url: '/?q=pharmacie%20Dakar&source=shortcut' },
    { name: 'Trouver une livraison', short_name: 'Livraison', url: '/?q=service%20livraison%20colis&source=shortcut' },
  ],
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="SeneCompare AI"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#04131f"/><stop offset="1" stop-color="#0b3d4a"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#71e1c2"/><stop offset="1" stop-color="#0a9b78"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#b)"/><circle cx="256" cy="256" r="174" fill="none" stroke="#e5b94f" stroke-opacity=".2" stroke-width="18"/><path d="M126 183h194l-32-32 27-27 78 78-78 78-27-27 32-32H126z" fill="url(#g)"/><path d="M386 329H192l32 32-27 27-78-78 78-78 27 27-32 32h194z" fill="#e5b94f"/><rect x="181" y="181" width="150" height="150" rx="42" fill="#fff" fill-opacity=".97"/><text x="256" y="279" text-anchor="middle" font-family="Arial,sans-serif" font-size="78" font-weight="900" letter-spacing="-8" fill="#071c2c">SC</text></svg>`;

function serviceWorker() {
  return `const VERSION=${JSON.stringify(VERSION)};
const SHELL='senecompare-shell-'+VERSION;
const RUNTIME='senecompare-runtime-'+VERSION;
const PRECACHE=['/','/styles.css?v='+VERSION,'/app.js?v='+VERSION,'/manifest.webmanifest?v='+VERSION,'/icon.svg?v='+VERSION];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('senecompare-')&&![SHELL,RUNTIME].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__')){event.respondWith(fetch(request,{cache:'no-store'}));return;}if(request.mode==='navigate'){event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(SHELL).then(cache=>cache.put('/',copy)));}return response;}).catch(()=>caches.match('/')));return;}event.respondWith(caches.match(request).then(cached=>{const network=fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(RUNTIME).then(cache=>cache.put(request,copy)));}return response;});return cached||network;}));});`;
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
    'Origin-Agent-Cluster': '?1',
    'X-SeneCompare-Version': VERSION,
    'X-SeneCompare-Frontend': 'cloudflare-zero-trust-v5',
  });
  if (contentType.startsWith('text/html')) {
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
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
  } else headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
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
  const target = new URL(`${GATEWAY}${apiSuffix(url.pathname)}${url.search}`);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || '*/*',
    Origin: CANONICAL_ORIGIN,
    'X-Client-Version': request.headers.get('X-Client-Version') || `senecompare-domain-${VERSION}`,
    'User-Agent': request.headers.get('User-Agent') || `SeneCompareDomain/${VERSION}`,
  });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);

  let upstream;
  try {
    const timeout = url.pathname.includes('/voice/') ? 65_000 : url.pathname.endsWith('/search') ? 58_000 : 20_000;
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_gateway_unavailable', detail: String(error) }));
    return json({ ok: false, code: 'GATEWAY_UNAVAILABLE', message: 'Le moteur est momentanément indisponible.' }, 503, { 'Retry-After': '30' });
  }

  const responseHeaders = baseHeaders(upstream.headers.get('Content-Type') || 'application/octet-stream', 'no-store');
  for (const name of ['Server-Timing', 'Retry-After', 'Content-Disposition', 'X-SeneCompare-Voice', 'X-SeneCompare-Version', 'X-SeneCompare-Engine-Version']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('X-SeneCompare-Gateway-Version', upstream.headers.get('X-SeneCompare-Version') || VERSION);
  responseHeaders.delete('Content-Length');
  responseHeaders.delete('Content-Encoding');
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

async function health(request) {
  const probe = new Request(`${CANONICAL_ORIGIN}/api/health`, { method: 'GET', headers: request.headers });
  const response = await proxyApi(probe, new URL(probe.url));
  if (!response.ok) return response;
  const value = await response.json().catch(() => ({}));
  return json({ ...value, ok: value.ok === true, frontend_version: VERSION, frontend: 'Cloudflare Local Assets v5', same_origin_api: true, checked_at: new Date().toISOString() }, value.ok === true ? 200 : 503);
}

function fallbackPage() {
  return `<!doctype html><html lang="fr-SN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071c2c"><title>SeneCompare AI</title><style>body{font-family:system-ui;margin:0;background:#f3f7f7;color:#071c2c;display:grid;place-items:center;min-height:100vh}.card{max-width:520px;margin:20px;padding:30px;border-radius:24px;background:white;box-shadow:0 20px 60px #071c2c22;text-align:center}a{display:inline-block;padding:13px 18px;border-radius:12px;background:#0a9b78;color:white;text-decoration:none;font-weight:800}</style><div class="card"><h1>SeneCompare AI</h1><p>Le moteur fonctionne, mais l’interface principale se recharge. Réessayez immédiatement.</p><a href="/?v=${VERSION}">Recharger l’application</a><small hidden>Version ${VERSION}</small></div></html>`;
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
    return text(fallbackPage(), 'text/html; charset=utf-8', 'no-cache, no-store, must-revalidate');
  },
};
