import frontend from './senecompare-final-v52.js';

const VERSION = '5.0.0';
const RELEASE = '5.2.0';
const GATEWAY = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-gateway-v5';
const ORIGIN = 'https://senecompare.dakarstyle.com';

function responseHeaders(upstream) {
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('X-SeneCompare-Version', VERSION);
  headers.set('X-SeneCompare-Release', RELEASE);
  headers.set('X-SeneCompare-Intent-Router', upstream.headers.get('X-SeneCompare-Intent-Router') || '5.0.1');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

async function proxyApi(request, url) {
  const suffix = url.pathname.slice('/api'.length) || '/health';
  const target = new URL(`${GATEWAY}${suffix}${url.search}`);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || '*/*',
    Origin: ORIGIN,
    'X-Client-Version': request.headers.get('X-Client-Version') || `senecompare-cloudflare-${RELEASE}`,
    'User-Agent': request.headers.get('User-Agent') || `SeneCompareCloudflare/${RELEASE}`,
  });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(url.pathname.includes('/voice/') ? 65_000 : url.pathname.endsWith('/search') ? 58_000 : 25_000),
    });
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v5_gateway_unavailable', detail: String(error) }));
    return new Response(JSON.stringify({ ok: false, code: 'GATEWAY_UNAVAILABLE', message: 'Le moteur est momentanément indisponible.' }), {
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
