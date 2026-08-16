import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const UPSTREAM = `${SUPABASE_URL}/functions/v1/sama-support-api`;
const EXPECTED_APP_VERSION = "8.3.1";
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
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin"
  };
}
function json(origin, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "content-type": "application/json; charset=utf-8"
    }
  });
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
  if (!allowed(origin)) return json(origin, {
    ok: false,
    error: "Origin not allowed"
  }, 403);
  if (!SUPABASE_URL) return json(origin, {
    ok: false,
    error: "Backend unavailable"
  }, 503);
  if (req.method === "GET") {
    return json(origin, {
      ok: true,
      service: "sama-support-api-v2",
      version: "2.1.0",
      upstream: "sama-support-api",
      expected_app_version: EXPECTED_APP_VERSION,
      recovery: true,
      telemetry: "minimal"
    });
  }
  if (req.method !== "POST") return json(origin, {
    ok: false,
    error: "Méthode non autorisée."
  }, 405);
  const rawBody = await req.text();
  let action = "";
  try {
    action = String(JSON.parse(rawBody || "{}").action || "");
  } catch (_) {}
  const headers = new Headers({
    "content-type": "application/json"
  });
  for (const key of [
    "apikey",
    "x-sama-session",
    "x-client-info"
  ]){
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers,
    body: rawBody
  });
  const rawResponse = await upstream.text();
  const responseHeaders = new Headers(cors(origin));
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("retry-after", retryAfter);
  if (upstream.ok && action === "admin_support_dashboard") {
    try {
      const data = JSON.parse(rawResponse);
      const latest = new Map();
      for (const device of Array.isArray(data.health) ? data.health : []){
        if (device?.account_id && !latest.has(device.account_id)) latest.set(device.account_id, device);
      }
      data.metrics = data.metrics || {};
      data.metrics.outdated = [
        ...latest.values()
      ].filter((device)=>device.app_version && device.app_version !== EXPECTED_APP_VERSION).length;
      data.expectedAppVersion = EXPECTED_APP_VERSION;
      return new Response(JSON.stringify(data), {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch (_) {}
  }
  return new Response(rawResponse, {
    status: upstream.status,
    headers: responseHeaders
  });
});
