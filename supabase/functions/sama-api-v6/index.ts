import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const UPSTREAM = `${SUPABASE_URL}/functions/v1/sama-api-v5`;
const allowedOrigins = new Set([
  "https://samacahier.dakarstyle.com",
  "https://sama-cahier-ia.vercel.app",
  "https://sama-cahier-ia-eminix-s-projects.vercel.app",
  "https://sama-cahier-ia-idrissaminata-8568-eminix-s-projects.vercel.app"
]);
function allowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-cahier-[a-z0-9-]+-eminix-s-projects\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && allowed(origin) ? origin : "https://samacahier.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type, apikey, x-sama-session, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  };
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!allowed(origin)) return new Response("Forbidden", {
      status: 403
    });
    return new Response("ok", {
      headers: cors(origin)
    });
  }
  if (!allowed(origin)) return Response.json({
    ok: false,
    error: "Origin not allowed"
  }, {
    status: 403,
    headers: cors(origin)
  });
  if (!SUPABASE_URL) return Response.json({
    ok: false,
    error: "Backend unavailable"
  }, {
    status: 503,
    headers: cors(origin)
  });
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const key of [
    "apikey",
    "x-sama-session",
    "x-client-info"
  ]){
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const upstream = await fetch(UPSTREAM, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer()
  });
  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers(cors(origin));
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("retry-after", retryAfter);
  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders
  });
});
