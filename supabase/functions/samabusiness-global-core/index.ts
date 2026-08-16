// SAMABUSINESS — Global Core addon script server
//
// Serves the built src/global-core bundle (scripts/build-global-core.mjs
// output) exactly the way samabusiness-addon already serves
// addon-v1122-script: fetch the checksummed row from sama_app_assets,
// verify it, serve as application/javascript. Deploying a new script this
// way is what makes country/locale/currency/timezone/phone/RTL "any
// country, any locale, any currency" opt-in and instantly rollback-able —
// stop referencing this URL from sama-assets's patchBusinessHtml() and the
// canonical HTML reverts to exactly what it was before this mission,
// unchanged.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const VERSION = "1.0.0";
const ASSET_PATH = "global-core-v1-script";
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";

function key() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const value = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof value === "string") return value;
    for (const candidate of Object.values(parsed)) if (typeof candidate === "string" && candidate.length > 40) return candidate;
  } catch {
    return packed.length > 40 ? packed : "";
  }
  return "";
}

const KEY = key();
if (!URL_ || !KEY) throw new Error("GLOBAL_CORE_CONFIG_MISSING");
const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const encoder = new TextEncoder();

let cached = "";
let cachedSha = "";

async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function load() {
  if (cached) return cached;
  const r = await db.from("sama_app_assets").select("content,sha256").eq("path", ASSET_PATH).maybeSingle();
  if (r.error) throw r.error;
  const script = String(r.data?.content ?? "");
  if (!script) throw new Error("GLOBAL_CORE_ASSET_MISSING");
  const expected = String(r.data?.sha256 ?? "");
  const actual = await digest(script);
  if (expected && actual !== expected) throw new Error("GLOBAL_CORE_CHECKSUM_INVALID");
  cached = script;
  cachedSha = actual;
  return cached;
}

Deno.serve(async (req) => {
  const h = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": "application/javascript; charset=utf-8",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-global-core-version": VERSION,
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: h });
  const url = new URL(req.url);
  if (url.searchParams.get("mode") === "health") {
    try {
      const script = await load();
      return Response.json({ ok: true, version: VERSION, bytes: script.length, sha256: cachedSha }, { headers: h });
    } catch (error) {
      return Response.json({ ok: false, error: String(error && error.message || error) }, { status: 503, headers: h });
    }
  }
  try {
    const script = await load();
    return new Response(req.method === "HEAD" ? null : script, { headers: h });
  } catch (error) {
    console.error("samabusiness_global_core", error);
    return new Response("Global Core unavailable", { status: 503, headers: { ...h, "cache-control": "no-store" } });
  }
});
