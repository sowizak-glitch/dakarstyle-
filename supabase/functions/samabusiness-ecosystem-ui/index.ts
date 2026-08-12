import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import ecosystem from "./ecosystem.ts";

const VERSION = "12.0.2";
const SCRIPT = `;(${ecosystem.toString()})();`;
Deno.serve((req: Request) => {
  const headers: HeadersInit = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION,
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers });
  return new Response(req.method === "HEAD" ? null : SCRIPT, { headers });
});