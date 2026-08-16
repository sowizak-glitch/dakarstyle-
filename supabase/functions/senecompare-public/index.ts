const VERSION = '4.1.0';
const ORIGIN = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1';
const APP_URL = `${ORIGIN}/senecompare-app`;
let cache = null;
async function getHtml() {
  if (cache && Date.now() - cache.at < 30_000) return cache.html;
  const upstream = await fetch(`${APP_URL}?v=${VERSION}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': `SeneCompare-Public/${VERSION}`
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!upstream.ok) throw new Error(`APP_UPSTREAM_${upstream.status}`);
  const html = await upstream.text();
  cache = {
    html,
    at: Date.now()
  };
  return html;
}
function headers() {
  const h = new Headers();
  h.set('Content-Type', 'text/html; charset=UTF-8');
  h.set('Content-Disposition', 'inline; filename="index.html"');
  h.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  h.set('Pragma', 'no-cache');
  h.set('Expires', '0');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Permissions-Policy', 'camera=(), geolocation=(self), microphone=(self), payment=()');
  h.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://xmdpmtvieqgoorbxytey.supabase.co; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests");
  h.set('X-SeneCompare-Version', VERSION);
  h.set('Vary', 'Accept-Encoding, User-Agent');
  return h;
}
Deno.serve(async (request)=>{
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  });
  if (![
    'GET',
    'HEAD'
  ].includes(request.method)) return new Response('Method not allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD, OPTIONS'
    }
  });
  if (url.pathname.endsWith('/health')) return new Response(JSON.stringify({
    ok: true,
    service: 'SeneCompare Public',
    version: VERSION
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
  try {
    const html = await getHtml();
    return new Response(request.method === 'HEAD' ? null : html, {
      status: 200,
      headers: headers()
    });
  } catch (error) {
    console.error(String(error));
    return new Response('SeneCompare est momentanément indisponible.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });
  }
});
