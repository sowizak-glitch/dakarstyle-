import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "11.2.2", AETHER_VERSION = "1.1.0", URL = Deno.env.get("SUPABASE_URL") ?? "", AETHER_GZ = "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";
function key() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const value = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof value === "string") return value;
    for (const candidate of Object.values(parsed))if (typeof candidate === "string" && candidate.length > 40) return candidate;
  } catch  {
    return packed.length > 40 ? packed : "";
  }
  return "";
}
const KEY = key();
if (!URL || !KEY) throw new Error("ADDON_CONFIG_MISSING");
const db = createClient(URL, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}), EXPECTED = "f0fa1016c7d1e520bc2b6f9a25c4aa61882f050fca57560dd3a48347e06e85e1", encoder = new TextEncoder();
let cached = "", aetherCached = "";
async function digest(v) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(v)));
  return [
    ...bytes
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function bytesFromBase64(value) {
  const binary = atob(value), out = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++)out[i] = binary.charCodeAt(i);
  return out;
}
async function aether() {
  if (aetherCached) return aetherCached;
  const stream = new Blob([
    bytesFromBase64(AETHER_GZ)
  ]).stream().pipeThrough(new DecompressionStream("gzip"));
  aetherCached = await new Response(stream).text();
  if (!aetherCached.includes("__SAMABUSINESS_AETHER_CORE_2026__")) throw new Error("AETHER_BUNDLE_INVALID");
  return aetherCached;
}
async function load() {
  if (cached) return cached;
  const r = await db.from("sama_app_assets").select("content,sha256").eq("path", "addon-v1122-script").maybeSingle();
  if (r.error) throw r.error;
  const script = String(r.data?.content ?? "");
  if (!script || r.data?.sha256 !== EXPECTED || await digest(script) !== EXPECTED) throw new Error("ADDON_CHECKSUM_INVALID");
  cached = script + await aether();
  return cached;
}
Deno.serve(async (req)=>{
  const h = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": "application/javascript; charset=utf-8",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION,
    "x-samabusiness-aether": AETHER_VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: h
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", {
    status: 405,
    headers: h
  });
  try {
    const script = await load();
    return new Response(req.method === "HEAD" ? null : script, {
      headers: h
    });
  } catch (error) {
    console.error("samabusiness_addon", error);
    return new Response("Addon unavailable", {
      status: 503,
      headers: {
        ...h,
        "cache-control": "no-store"
      }
    });
  }
});
