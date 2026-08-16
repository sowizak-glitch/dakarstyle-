import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "11.2.4";
const FIELD_UX_VERSION = "11.8.8";
const FINAL_UI_VERSION = "19.3.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
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
const SERVICE_KEY = serviceKey();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SAMA_ASSETS_BACKEND_CONFIG_MISSING");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const BUSINESS_ORDER = [
  "business-v9-00",
  "business-v9-01",
  "business-v9-02",
  "business-v9-03"
];
const REMOTE_PARTS = [
  0,
  1,
  2,
  3
].map((index)=>`https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/main/sama-business/app-v9-0${index}.b64?v=903`);
const EXPECTED = [
  "96588464cc74fb60c06846ce193f8c8fdfb87af971e56cdfd0ec4f6890c5e3cc",
  "584ffd6aa887dee6b599e65dccd5bc9318f9b3bc14a336fb93e9cfb6cfd74399",
  "6c96d546476036a2f98eec5b627a57843b1a2b26128c6019f8291358dc876fc1",
  "1671898f81c952791ec5b58fd6faee45c3babd29b3a113ccb150b4ce1baa0e9c"
];
const ADDON_URL = `${SUPABASE_URL}/functions/v1/samabusiness-addon?v=${VERSION}`;
const FIELD_UX_URL = `${SUPABASE_URL}/functions/v1/samabusiness-field-ux?v=${FIELD_UX_VERSION}`;
const FINAL_UI_URL = `${SUPABASE_URL}/functions/v1/sama-config-check?v=${FINAL_UI_VERSION}`;
// Global Core (country/locale/currency/timezone/phone/RTL — see
// src/global-core/ and docs/SAMABUSINESS-GLOBAL-ARCHITECTURE.md). Injected
// as a 4th, independently-versioned, deferred script exactly like the
// three above: if samabusiness-global-core is ever unreachable it 503s on
// its own and the <script defer> tag simply fails to execute — the rest of
// the canonical HTML (auth, sales, stock, debts, delivery, voice) is
// entirely unaffected, and removing this one constant/tag fully reverts
// the page to its pre-mission behaviour.
const GLOBAL_CORE_VERSION = "1.0.0";
const GLOBAL_CORE_URL = `${SUPABASE_URL}/functions/v1/samabusiness-global-core?v=${GLOBAL_CORE_VERSION}`;
let businessHtml = "";
let bundleSource = "";
function headers(type, cache = "no-store") {
  return {
    "content-type": type,
    "cache-control": cache,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "content-type",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(self),geolocation=(self),microphone=(self),payment=(),usb=()",
    "x-sama-version": VERSION,
    "x-samabusiness-version": VERSION
  };
}
function bytesFromBase64(value) {
  const binary = atob(value.replace(/\s+/g, ""));
  const output = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++)output[i] = binary.charCodeAt(i);
  return output;
}
async function gunzip(value) {
  return await new Response(new Blob([
    bytesFromBase64(value)
  ]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [
    ...bytes
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function validateParts(parts) {
  if (parts.length !== 4) return false;
  const hashes = await Promise.all(parts.map(sha256Hex));
  return hashes.every((h, i)=>h === EXPECTED[i]);
}
function validateOriginalHtml(html) {
  const checks = [
    /<!doctype html/i.test(html),
    html.includes("SAMA BUSINESS IA"),
    html.includes("sama-business-api"),
    html.includes("sama-session-v3"),
    html.includes("parse_whatsapp_order"),
    html.includes("stock_movement"),
    html.includes("withdrawable_amount"),
    html.length > 50_000
  ];
  if (!checks.every(Boolean)) throw new Error("SAMA_ASSETS_ORIGINAL_BUNDLE_INVALID");
}
function patchBusinessHtml(original) {
  let html = original.replaceAll("SAMA BUSINESS IA", "SAMABUSINESS").replaceAll("SAMA BUSINESS", "SAMABUSINESS").replace(/APP_VERSION='(?:9\.0\.0|10\.0\.0|10\.3\.0|11\.2\.2|11\.2\.3)'/, `APP_VERSION='${VERSION}'`).replaceAll("sama-business-shell-v9.0.1", `samabusiness-shell-${VERSION}`).replaceAll("sama-business-api", "samabusiness-api-v10").replace(/<button class="more-card" id="legacyBtn">[\s\S]*?<\/button>/, "").replace("$('legacyBtn').onclick=()=>location.href='?mode=legacy';", "const legacyButton=$('legacyBtn');if(legacyButton)legacyButton.remove();").replace(/<script defer src="[^"]*samabusiness-addon[^\"]*"[^>]*><\/script>/g, "").replace(/<script defer src="[^"]*samabusiness-field-ux[^\"]*"[^>]*><\/script>/g, "").replace(/<script defer src="[^"]*sama-config-check[^\"]*"[^>]*><\/script>/g, "");
  const scripts = `<script defer src="${ADDON_URL}" crossorigin="anonymous" data-samabusiness-addon="${VERSION}"></script><script defer src="${FIELD_UX_URL}" crossorigin="anonymous" data-samabusiness-field-ux="${FIELD_UX_VERSION}"></script><script defer src="${FINAL_UI_URL}" crossorigin="anonymous" data-samabusiness-final="${FINAL_UI_VERSION}"></script><script defer src="${GLOBAL_CORE_URL}" crossorigin="anonymous" data-samabusiness-global-core="${GLOBAL_CORE_VERSION}"></script>`;
  html = html.includes("</body>") ? html.replace("</body>", `${scripts}</body>`) : `${html}${scripts}`;
  const checks = [
    html.includes(`APP_VERSION='${VERSION}'`),
    html.includes(`data-samabusiness-addon="${VERSION}"`),
    html.includes(`data-samabusiness-field-ux="${FIELD_UX_VERSION}"`),
    html.includes(`data-samabusiness-final="${FINAL_UI_VERSION}"`),
    html.includes(`data-samabusiness-global-core="${GLOBAL_CORE_VERSION}"`),
    html.includes("samabusiness-api-v10"),
    !html.includes('id="legacyBtn"'),
    !html.includes("?mode=legacy")
  ];
  if (!checks.every(Boolean)) throw new Error("SAMA_ASSETS_CANONICAL_PATCH_FAILED");
  return html;
}
async function readBusinessParts() {
  const result = await db.from("sama_app_assets").select("path,content,sha256").in("path", BUSINESS_ORDER);
  if (result.error) throw result.error;
  const map = new Map((result.data ?? []).map((row)=>[
      row.path,
      row
    ]));
  if (BUSINESS_ORDER.some((path)=>!map.has(path))) return null;
  const parts = BUSINESS_ORDER.map((path)=>String(map.get(path).content).trim());
  return await validateParts(parts) ? parts : null;
}
async function fetchAndPersistBusinessParts() {
  const responses = await Promise.all(REMOTE_PARTS.map((url)=>fetch(url, {
      headers: {
        accept: "text/plain"
      }
    })));
  if (responses.some((r)=>!r.ok)) throw new Error(`SAMA_ASSETS_SOURCE_UNAVAILABLE:${responses.map((r)=>r.status).join(",")}`);
  const parts = (await Promise.all(responses.map((r)=>r.text()))).map((v)=>v.trim());
  parts[1] = parts[1].replace("D55u859x", "D55b959x");
  if (!await validateParts(parts)) throw new Error("SAMA_ASSETS_SOURCE_CHECKSUM_MISMATCH");
  const rows = BUSINESS_ORDER.map((path, index)=>({
      path,
      content: parts[index],
      sha256: EXPECTED[index],
      updated_at: new Date().toISOString()
    }));
  const upsert = await db.from("sama_app_assets").upsert(rows, {
    onConflict: "path"
  });
  if (upsert.error) throw upsert.error;
  return parts;
}
async function getBusiness() {
  if (businessHtml) return businessHtml;
  let parts = await readBusinessParts();
  bundleSource = "verified_database_base";
  if (!parts) {
    parts = await fetchAndPersistBusinessParts();
    bundleSource = "verified_remote_recovery";
  }
  const original = await gunzip(parts.join(""));
  validateOriginalHtml(original);
  businessHtml = patchBusinessHtml(original);
  return businessHtml;
}
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="SAMABUSINESS"><rect width="512" height="512" rx="112" fill="#071A32"/><circle cx="256" cy="230" r="142" fill="#087A45"/><path d="M145 245h222v122H145z" fill="#fff"/><path d="M126 240l130-106 130 106" fill="none" stroke="#F4C430" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><rect x="218" y="286" width="76" height="81" rx="10" fill="#071A32"/><circle cx="350" cy="145" r="56" fill="#F4C430"/><path d="M327 145h46M350 122v46" stroke="#071A32" stroke-width="14" stroke-linecap="round"/></svg>`;
}
function manifest() {
  return {
    id: "/",
    name: "SAMABUSINESS",
    short_name: "SAMABUSINESS",
    description: "Gestion, ventes, stock, dettes, livraisons et création de sites professionnels.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: [
      "window-controls-overlay",
      "standalone",
      "minimal-ui"
    ],
    background_color: "#F4F7F5",
    theme_color: "#087A45",
    lang: "fr-SN",
    orientation: "any",
    categories: [
      "business",
      "finance",
      "productivity"
    ],
    icons: [
      {
        src: `?mode=icon&size=192&v=${VERSION}`,
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: `?mode=icon&size=512&v=${VERSION}`,
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ],
    shortcuts: [
      {
        name: "Créer mon site",
        short_name: "Mon site",
        url: "/?module=site-studio"
      },
      {
        name: "Nouvelle vente",
        short_name: "Vente",
        url: "/?action=sale"
      },
      {
        name: "Cahier et dettes",
        short_name: "Dettes",
        url: "/?module=debts"
      },
      {
        name: "Commande vocale",
        short_name: "Vocal",
        url: "/?module=voice"
      },
      {
        name: "Livraisons",
        short_name: "Livraison",
        url: "/?module=delivery"
      }
    ]
  };
}
function serviceWorker() {
  return `const V='${VERSION}',CACHE='samabusiness-'+V,HOME='./';self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.add(HOME)).catch(()=>{}))});self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('sama-')||key.startsWith('samabusiness-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(HOME,copy)).catch(()=>{})}return response}).catch(()=>caches.match(HOME)));return}event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)))});self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():''}};event.waitUntil(self.registration.showNotification(data.title||'SAMABUSINESS',{body:data.body||'Vous avez un rappel.',icon:'/?mode=icon&size=192&v=${VERSION}',badge:'/?mode=icon&size=192&v=${VERSION}',tag:data.tag||'sama-reminder',data:data.url||'/'}))});self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const url=event.notification.data||'/';for(const client of list){if('focus'in client){client.navigate(url);return client.focus()}}return clients.openWindow(url)}))})`;
}
Deno.serve(async (request)=>{
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: headers("text/plain", "public,max-age=86400")
  });
  if (request.method !== "GET" && request.method !== "HEAD") return Response.json({
    ok: false,
    error: "Method not allowed"
  }, {
    status: 405,
    headers: headers("application/json")
  });
  const url = new URL(request.url), mode = url.searchParams.get("mode") || "html";
  try {
    if (mode === "manifest") return new Response(request.method === "HEAD" ? null : JSON.stringify(manifest()), {
      headers: headers("application/manifest+json; charset=utf-8", "no-store")
    });
    if (mode === "icon") return new Response(request.method === "HEAD" ? null : iconSvg(), {
      headers: headers("image/svg+xml; charset=utf-8", "public,max-age=31536000,immutable")
    });
    if (mode === "sw") return new Response(request.method === "HEAD" ? null : serviceWorker(), {
      headers: {
        ...headers("application/javascript; charset=utf-8", "no-cache"),
        "service-worker-allowed": "/"
      }
    });
    if (mode === "legacy") return Response.json({
      ok: false,
      error: "L’ancienne application a été retirée. Utilisez SAMABUSINESS.",
      code: "LEGACY_REMOVED",
      version: VERSION
    }, {
      status: 410,
      headers: headers("application/json; charset=utf-8")
    });
    if (mode === "health") {
      const html = await getBusiness();
      return Response.json({
        ok: true,
        app: "SAMABUSINESS",
        version: VERSION,
        html_bytes: new TextEncoder().encode(html).length,
        bundle_source: bundleSource,
        addon: `samabusiness-addon@${VERSION}`,
        field_ux: `samabusiness-field-ux@${FIELD_UX_VERSION}`,
        final_ui: FINAL_UI_VERSION,
        global_core: `samabusiness-global-core@${GLOBAL_CORE_VERSION}`,
        site_studio: `samabusiness-site-studio@${VERSION}`,
        legacy_fallback: false,
        canonical_only: true
      }, {
        headers: headers("application/json; charset=utf-8")
      });
    }
    const html = await getBusiness();
    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        ...headers("text/html; charset=utf-8", "no-store,no-cache,must-revalidate"),
        "x-sama-bundle-source": bundleSource
      }
    });
  } catch (error) {
    console.error("sama_assets", error);
    return Response.json({
      ok: false,
      error: "Application temporairement indisponible",
      version: VERSION
    }, {
      status: 503,
      headers: headers("application/json; charset=utf-8")
    });
  }
});
