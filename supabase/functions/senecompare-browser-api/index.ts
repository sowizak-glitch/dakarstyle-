const VERSION = '1.0.0';
const UPSTREAM = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-api';
const ALLOWED_ORIGINS = new Set([
  'https://senecompare.dakarstyle.com',
  'https://idrissa-glitch.github.io',
  'https://sowizak-glitch.github.io',
  'http://localhost:5173',
  'http://localhost:8787'
]);
function cors(request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://idrissa-glitch.github.io',
    'Access-Control-Allow-Headers': 'content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function responseHeaders(request, contentType) {
  const headers = new Headers(cors(request));
  headers.set('Content-Type', contentType || 'application/json; charset=UTF-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-SeneCompare-Browser-API-Version', VERSION);
  return headers;
}
Deno.serve(async (request)=>{
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors(request)
  });
  if (![
    'GET',
    'POST',
    'HEAD'
  ].includes(request.method)) {
    return new Response(JSON.stringify({
      ok: false,
      code: 'METHOD_NOT_ALLOWED'
    }), {
      status: 405,
      headers: responseHeaders(request, 'application/json; charset=UTF-8')
    });
  }
  const url = new URL(request.url);
  const marker = '/senecompare-browser-api';
  const markerIndex = url.pathname.indexOf(marker);
  const suffix = markerIndex >= 0 ? url.pathname.slice(markerIndex + marker.length) : '';
  const target = UPSTREAM + (suffix || '/health') + url.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Client-Version', headers.get('X-Client-Version') || 'browser-proxy-1.0.0');
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: [
        'GET',
        'HEAD'
      ].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(30000)
    });
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=UTF-8';
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders(request, contentType)
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({
      event: 'browser_proxy_error',
      requestId,
      error: String(error)
    }));
    return new Response(JSON.stringify({
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      request_id: requestId,
      message: 'Le moteur de comparaison est momentanément indisponible.'
    }), {
      status: 503,
      headers: responseHeaders(request, 'application/json; charset=UTF-8')
    });
  }
});
