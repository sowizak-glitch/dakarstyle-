const UPSTREAM = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-api';
function origin(req) {
  const o = req.headers.get('origin') || '';
  return /^https:\/\/senecompare-ai(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(o) || o === 'https://senecompare.dakarstyle.com' ? o : 'https://senecompare-ai-eminix-s-projects.vercel.app';
}
function h(req, type = 'application/json; charset=UTF-8') {
  return {
    'Access-Control-Allow-Origin': origin(req),
    'Access-Control-Allow-Headers': 'content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-SeneCompare-Proxy': 'vercel-1.0.0'
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: h(req)
  });
  if (![
    'GET',
    'POST',
    'HEAD'
  ].includes(req.method)) return new Response(JSON.stringify({
    ok: false,
    code: 'METHOD_NOT_ALLOWED'
  }), {
    status: 405,
    headers: h(req)
  });
  const u = new URL(req.url), marker = '/senecompare-vercel-api', i = u.pathname.indexOf(marker), suffix = i >= 0 ? u.pathname.slice(i + marker.length) : '';
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  try {
    const r = await fetch(UPSTREAM + (suffix || '/health') + u.search, {
      method: req.method,
      headers,
      body: [
        'GET',
        'HEAD'
      ].includes(req.method) ? undefined : req.body,
      signal: AbortSignal.timeout(30000)
    });
    return new Response(req.method === 'HEAD' ? null : r.body, {
      status: r.status,
      headers: h(req, r.headers.get('content-type') || undefined)
    });
  } catch (e) {
    console.error(String(e));
    return new Response(JSON.stringify({
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Le moteur est momentanément indisponible.'
    }), {
      status: 503,
      headers: h(req)
    });
  }
});
