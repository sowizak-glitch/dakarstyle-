import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const bundle = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = bundle ? JSON.parse(bundle)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const ORDER = [
  "chunk-00",
  "chunk-01",
  "chunk-02a",
  "chunk-02b",
  "chunk-03",
  "chunk-04"
];
const TOKEN = "sama-v84-audit-20260802-7c91";
function b64Bytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i += 1)bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function excerpt(text, needle, radius = 900) {
  const match = needle.exec(text);
  if (!match) return null;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  return text.slice(start, end);
}
Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== TOKEN) return new Response("Not found", {
      status: 404
    });
    const { data, error } = await db.from("sama_app_assets").select("path,content,sha256,updated_at").in("path", ORDER);
    if (error) throw error;
    const rows = data ?? [];
    const map = new Map(rows.map((r)=>[
        r.path,
        r
      ]));
    const missing = ORDER.filter((p)=>!map.has(p));
    if (missing.length) throw new Error(`Missing assets: ${missing.join(",")}`);
    const encoded = ORDER.map((p)=>String(map.get(p).content)).join("");
    const stream = new Blob([
      b64Bytes(encoded)
    ]).stream().pipeThrough(new DecompressionStream("gzip"));
    const html = await new Response(stream).text();
    const originalBackupId = crypto.randomUUID();
    const originalBackup = ORDER.map((path)=>({
        backup_id: originalBackupId,
        backup_label: "pre-v8.4.0-20260802",
        path,
        content: String(map.get(path).content),
        sha256: String(map.get(path).sha256)
      }));
    const { error: backupError } = await db.from("sama_app_assets_backup").insert(originalBackup);
    if (backupError) throw backupError;
    const sourceBackupId = crypto.randomUUID();
    const sourceRows = [];
    const partSize = 12000;
    for(let offset = 0, index = 0; offset < html.length; offset += partSize, index += 1){
      const content = html.slice(offset, offset + partSize);
      sourceRows.push({
        backup_id: sourceBackupId,
        backup_label: "decoded-v8.3.1-20260802",
        path: `source-${String(index).padStart(2, "0")}`,
        content,
        sha256: await sha256(content)
      });
    }
    const { error: sourceError } = await db.from("sama_app_assets_backup").insert(sourceRows);
    if (sourceError) throw sourceError;
    const checks = {
      doctype: /<!doctype html/i.test(html),
      appName: html.includes("SAMA Cahier"),
      appVersion: html.match(/APP_VERSION\s*=\s*['\"]([^'\"]+)/)?.[1] ?? null,
      speechRecognition: (html.match(/SpeechRecognition|webkitSpeechRecognition/g) ?? []).length,
      mediaRecorder: (html.match(/MediaRecorder/g) ?? []).length,
      getUserMedia: (html.match(/getUserMedia/g) ?? []).length,
      serviceWorker: (html.match(/serviceWorker/g) ?? []).length,
      cacheApi: (html.match(/caches\.(open|keys|delete|match)/g) ?? []).length,
      indexedDb: (html.match(/indexedDB/g) ?? []).length,
      localStorage: (html.match(/localStorage/g) ?? []).length,
      onlineEvents: (html.match(/addEventListener\([\"']online[\"']/g) ?? []).length,
      offlineEvents: (html.match(/addEventListener\([\"']offline[\"']/g) ?? []).length,
      htmlLength: html.length,
      sourceParts: sourceRows.length,
      originalBackupId,
      sourceBackupId
    };
    const excerpts = {
      head: html.slice(0, 5000),
      version: excerpt(html, /APP_VERSION\s*=/i),
      manifest: excerpt(html, /manifest/i, 1400),
      serviceWorker: excerpt(html, /serviceWorker/i, 1600),
      speech: excerpt(html, /SpeechRecognition|webkitSpeechRecognition|getUserMedia|MediaRecorder/i, 2200),
      cache: excerpt(html, /caches\.(open|keys|delete|match)/i, 1800)
    };
    return Response.json({
      ok: true,
      checks,
      excerpts
    }, {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: String(error)
    }, {
      status: 500,
      headers: {
        "cache-control": "no-store"
      }
    });
  }
});
