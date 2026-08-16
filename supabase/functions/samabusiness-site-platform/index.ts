import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "11.2.2";
const CANONICAL = "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio";
const ALLOWED_ORIGINS = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com",
  "https://sama-livraison.netlify.app"
]);
function originAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.(?:netlify\.app|vercel\.app)$/i.test(origin);
}
function cors(origin) {
  return {
    "access-control-allow-origin": origin && originAllowed(origin) ? origin : "https://samabusiness.dakarstyle.com",
    "access-control-allow-headers": "content-type,apikey,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,HEAD,OPTIONS",
    vary: "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION,
    "x-samabusiness-compatibility-route": "site-platform-to-site-studio"
  };
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return originAllowed(origin) ? new Response(null, {
    status: 204,
    headers: cors(origin)
  }) : new Response("Forbidden", {
    status: 403
  });
  if (!originAllowed(origin)) return Response.json({
    ok: false,
    error: "Origin non autorisée."
  }, {
    status: 403,
    headers: cors(origin)
  });
  if (![
    "GET",
    "HEAD",
    "POST"
  ].includes(req.method)) return new Response("Method not allowed", {
    status: 405,
    headers: cors(origin)
  });
  const incoming = new URL(req.url);
  const upstreamUrl = new URL(CANONICAL);
  incoming.searchParams.forEach((value, key)=>upstreamUrl.searchParams.set(key, value));
  const headers = new Headers();
  for (const name of [
    "content-type",
    "apikey",
    "x-sama-session",
    "x-client-info",
    "origin"
  ]){
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body: req.method === "POST" ? await req.arrayBuffer() : undefined,
    redirect: "manual"
  });
  const responseHeaders = new Headers(upstream.headers);
  for (const [key, value] of Object.entries(cors(origin)))responseHeaders.set(key, value);
  responseHeaders.set("x-samabusiness-compatibility-route", "site-platform-to-site-studio");
  return new Response(req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
});
