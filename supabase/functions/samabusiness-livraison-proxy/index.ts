import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const UPSTREAM = `${SUPABASE_URL}/functions/v1/sama-livraison-api-v3`;
const allowedOrigins = new Set([
  "https://samacahier.dakarstyle.com",
  "https://samabusiness.dakarstyle.com",
  "https://sama-cahier-ia.vercel.app"
]);
function allowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && allowed(origin) ? origin : "https://samacahier.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type,apikey,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS",
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
    error: "Origin non autorisée."
  }, {
    status: 403,
    headers: cors(origin)
  });
  if (!SUPABASE_URL) return Response.json({
    ok: false,
    error: "Backend indisponible."
  }, {
    status: 503,
    headers: cors(origin)
  });
  if (req.method === "GET") return Response.json({
    ok: true,
    service: "samabusiness-livraison-proxy",
    version: "10.0.0",
    upstream: "sama-livraison-api-v3"
  }, {
    headers: cors(origin)
  });
  if (req.method !== "POST") return Response.json({
    ok: false,
    error: "Méthode non autorisée."
  }, {
    status: 405,
    headers: cors(origin)
  });
  const headers = new Headers({
    "content-type": "application/json"
  });
  for (const name of [
    "x-sama-session",
    "apikey",
    "x-client-info"
  ]){
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers,
    body: await req.arrayBuffer()
  });
  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers(cors(origin));
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders
  });
});
