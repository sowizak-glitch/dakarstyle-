import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "12.2.0";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const value of Object.values(parsed))if (typeof value === "string" && value.length > 40) return value;
  } catch  {
    return packed.length > 40 ? packed : "";
  }
  return "";
}
const KEY = serviceKey();
if (!URL || !KEY) throw new Error("STUDIO_UI_CONFIG_MISSING");
const db = createClient(URL, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
let cached = "";
let cachedSha = "";
async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [
    ...bytes
  ].map((byte)=>byte.toString(16).padStart(2, "0")).join("");
}
function helperLoaders() {
  const helpers = [
    [
      "site-network",
      "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-network-v12?v=12.1.1"
    ],
    [
      "site-preview",
      "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-preview-fix?v=12.1.2"
    ],
    [
      "studio-language",
      "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-studio-language-v12?v=12.0.0"
    ],
    [
      "site-experience",
      "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-experience-v122?v=12.2.0"
    ],
    [
      "ecosystem",
      "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-ecosystem-ui?v=12.0.1"
    ]
  ];
  return `\n;(()=>{const helpers=${JSON.stringify(helpers)};for(const [name,src] of helpers){document.querySelectorAll('script[data-sama-helper="'+name+'"]').forEach(s=>s.remove());const s=document.createElement('script');s.src=src;s.defer=true;s.crossOrigin='anonymous';s.dataset.samaHelper=name;document.head.appendChild(s)}})();`;
}
async function loadScript() {
  const result = await db.from("sama_app_assets").select("content,sha256,updated_at").eq("path", "site-studio-v1122-script").maybeSingle();
  if (result.error) throw result.error;
  const script = String(result.data?.content ?? "");
  const storedSha = String(result.data?.sha256 ?? "");
  if (!script || !storedSha) throw new Error("STUDIO_UI_ASSET_MISSING");
  const computedSha = await digest(script);
  if (computedSha !== storedSha) throw new Error("STUDIO_UI_CHECKSUM_INVALID");
  if (cached && cachedSha === storedSha) return cached;
  cachedSha = storedSha;
  cached = script + helperLoaders();
  return cached;
}
Deno.serve(async (req)=>{
  const baseHeaders = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-samabusiness-version": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: baseHeaders
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", {
    status: 405,
    headers: baseHeaders
  });
  try {
    const script = await loadScript();
    return new Response(req.method === "HEAD" ? null : script, {
      headers: {
        ...baseHeaders,
        etag: `W/\"${VERSION}-${cachedSha.slice(0, 16)}\"`
      }
    });
  } catch (error) {
    console.error("site_studio_ui", error);
    return new Response("Studio unavailable", {
      status: 503,
      headers: baseHeaders
    });
  }
});
