import frontend from './senecompare-v53.js';

const VERSION = '5.0.0';
const RELEASE = '5.3.0';
const SEARCH_GATEWAY = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-gateway-v5';
const ADMIN_GATEWAY = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-admin-v53';
const ORIGIN = 'https://senecompare.dakarstyle.com';
const ADMIN_API_PREFIXES = [
  '/api/ads',
  '/api/analytics/',
  '/api/partners/',
  '/api/admin/',
];

function responseHeaders(upstream, admin = false) {
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', admin ? 'no-referrer' : 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('X-SeneCompare-Version', VERSION);
  headers.set('X-SeneCompare-Release', RELEASE);
  if (admin) headers.set('X-SeneCompare-Admin', '5.3.0');
  else headers.set('X-SeneCompare-Intent-Router', upstream.headers.get('X-SeneCompare-Intent-Router') || '5.0.1');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

function isAdminApi(pathname) {
  return ADMIN_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function adminSuffix(pathname) {
  if (pathname === '/api/ads') return '/ads';
  if (pathname.startsWith('/api/analytics/')) return `/${pathname.slice('/api/analytics/'.length)}`;
  if (pathname.startsWith('/api/partners/')) return `/partners/${pathname.slice('/api/partners/'.length)}`;
  if (pathname.startsWith('/api/admin/')) return `/admin/${pathname.slice('/api/admin/'.length)}`;
  return pathname.slice('/api'.length) || '/health';
}

async function proxyApi(request, url) {
  const admin = isAdminApi(url.pathname);
  const suffix = admin ? adminSuffix(url.pathname) : (url.pathname.slice('/api'.length) || '/health');
  const target = new URL(`${admin ? ADMIN_GATEWAY : SEARCH_GATEWAY}${suffix}${url.search}`);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || '*/*',
    Origin: ORIGIN,
    'X-Client-Version': request.headers.get('X-Client-Version') || `senecompare-cloudflare-${RELEASE}`,
    'User-Agent': request.headers.get('User-Agent') || `SeneCompareCloudflare/${RELEASE}`,
  });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const authorization = request.headers.get('Authorization');
  if (authorization && admin) headers.set('Authorization', authorization);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(
        url.pathname.includes('/voice/') ? 65_000
          : url.pathname.endsWith('/search') ? 58_000
            : url.pathname.includes('/admin/overview') ? 35_000
              : 25_000,
      ),
    });
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream, admin),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: admin ? 'senecompare_admin_gateway_unavailable' : 'senecompare_v5_gateway_unavailable', detail: String(error) }));
    return new Response(JSON.stringify({ ok: false, code: 'GATEWAY_UNAVAILABLE', message: 'Le service est momentanément indisponible.' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '30',
        'X-SeneCompare-Version': VERSION,
        'X-SeneCompare-Release': RELEASE,
      },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return proxyApi(request, url);
    return frontend.fetch(request, env, ctx);
  },
};
