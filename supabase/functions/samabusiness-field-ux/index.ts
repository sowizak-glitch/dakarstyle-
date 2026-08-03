import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "10.2.0";
const source = await Deno.readTextFile(new URL("./field-ux.js", import.meta.url));

function headers(type = "application/javascript; charset=utf-8"): HeadersInit {
  return {
    "content-type": type,
    "cache-control": "public, max-age=120, stale-while-revalidate=300",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-field-ux": VERSION,
  };
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(req.method === "HEAD" ? null : source, { headers: headers() });
  }
  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: headers("application/json; charset=utf-8") });
});
