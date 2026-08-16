import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const U = Deno.env.get("SUPABASE_URL");
const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
const K = raw ? JSON.parse(raw).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(U, K, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
let cached = "";
function bytes(value) {
  const raw = atob(value), out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++)out[i] = raw.charCodeAt(i);
  return out;
}
async function load() {
  if (cached) return cached;
  const q = await db.from("sama_app_assets").select("path,content,sha256").like("path", "livraison/chunk-%").order("path");
  if (q.error || !q.data || q.data.length !== 6) throw q.error || new Error("bundle missing");
  const compressed = bytes(q.data.map((x)=>x.content).join(""));
  const stream = new Blob([
    compressed
  ]).stream().pipeThrough(new DecompressionStream("gzip"));
  cached = await new Response(stream).text();
  const low = cached.toLowerCase();
  if (cached.length < 100000 || !cached.includes("ESPACE ADMINISTRATEUR") || !cached.includes("sama-livraison-api-v3") || low.includes("yango")) throw new Error("invalid v3 bundle");
  return cached;
}
Deno.serve(async (req)=>{
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "X-SAMA-Livraison-Version": "3.0.0"
  };
  if (req.method === "OPTIONS") return new Response("ok", {
    headers
  });
  if (req.method !== "GET") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  try {
    return new Response(await load(), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    console.error("sama-livraison-bundle-v3", error);
    return new Response("Bundle unavailable", {
      status: 503,
      headers: {
        ...headers,
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
});
