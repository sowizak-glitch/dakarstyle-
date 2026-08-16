import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const APP = "https://samabusiness.dakarstyle.com", LEGACY = "https://samacahier.dakarstyle.com", LOGO = "https://dakarstyle.com/assets/samabusiness/samabusiness-192.webp?v=20260803", VERSION = "11.2.2";
const headers = (type, cache = "public,max-age=300")=>({
    "content-type": type,
    "cache-control": cache,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "x-samabusiness-version": VERSION
  });
const manifest = ()=>({
    id: `${APP}/`,
    name: "SAMABUSINESS",
    short_name: "SAMABUSINESS",
    description: "Gestion et création de sites simples pour les commerçants, artisans et PME.",
    start_url: `${APP}/`,
    scope: `${APP}/`,
    display: "standalone",
    display_override: [
      "window-controls-overlay",
      "standalone",
      "minimal-ui"
    ],
    background_color: "#F4F7F5",
    theme_color: "#087A45",
    lang: "fr-SN",
    dir: "ltr",
    orientation: "any",
    categories: [
      "business",
      "finance",
      "productivity"
    ],
    icons: [
      {
        src: LOGO,
        sizes: "192x192",
        type: "image/webp",
        purpose: "any maskable"
      },
      {
        src: `https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-pwa?mode=icon&v=${VERSION}`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ],
    shortcuts: [
      {
        name: "Créer mon site",
        short_name: "Mon site",
        url: `${APP}/?module=site-studio`,
        icons: [
          {
            src: LOGO,
            sizes: "192x192",
            type: "image/webp"
          }
        ]
      },
      {
        name: "Nouvelle vente",
        short_name: "Vente",
        url: `${APP}/?action=sale`,
        icons: [
          {
            src: LOGO,
            sizes: "192x192",
            type: "image/webp"
          }
        ]
      },
      {
        name: "Cahier et dettes",
        short_name: "Dettes",
        url: `${APP}/?module=debts`,
        icons: [
          {
            src: LOGO,
            sizes: "192x192",
            type: "image/webp"
          }
        ]
      },
      {
        name: "Commande vocale",
        short_name: "Vocal",
        url: `${APP}/?module=voice`,
        icons: [
          {
            src: LOGO,
            sizes: "192x192",
            type: "image/webp"
          }
        ]
      }
    ],
    related_applications: [],
    prefer_related_applications: false
  });
const icon = ()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="SAMABUSINESS"><rect width="512" height="512" rx="112" fill="#071A32"/><circle cx="256" cy="230" r="142" fill="#087A45"/><path d="M145 245h222v122H145z" fill="#fff"/><path d="M126 240l130-106 130 106" fill="none" stroke="#F4C430" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><rect x="218" y="286" width="76" height="81" rx="10" fill="#071A32"/><circle cx="350" cy="145" r="56" fill="#F4C430"/><path d="M327 145h46M350 122v46" stroke="#071A32" stroke-width="14" stroke-linecap="round"/></svg>`;
const sw = ()=>`const V='${VERSION}',C='samabusiness-'+V,HOME='./';self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.add(HOME)).catch(()=>{}))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('sama-')||k.startsWith('samabusiness-'))&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const x=r.clone();caches.open(C).then(c=>c.put(HOME,x)).catch(()=>{})}return r}).catch(()=>caches.match(HOME)));return}if(u.origin===location.origin)e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})`;
Deno.serve((req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: headers("text/plain", "public,max-age=86400")
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", {
    status: 405,
    headers: headers("text/plain", "no-store")
  });
  const u = new URL(req.url), m = u.searchParams.get("mode") || "manifest";
  if (m === "health") return Response.json({
    ok: true,
    app: "SAMABUSINESS",
    version: VERSION,
    app_origin: APP,
    legacy_origin: LEGACY,
    site_studio: true
  }, {
    headers: headers("application/json; charset=utf-8", "no-store")
  });
  if (m === "icon") return new Response(req.method === "HEAD" ? null : icon(), {
    headers: headers("image/svg+xml; charset=utf-8", "public,max-age=31536000,immutable")
  });
  if (m === "logo") return new Response(null, {
    status: 302,
    headers: {
      ...headers("text/plain", "public,max-age=86400"),
      location: LOGO
    }
  });
  if (m === "sw") return new Response(req.method === "HEAD" ? null : sw(), {
    headers: {
      ...headers("application/javascript; charset=utf-8", "no-cache"),
      "service-worker-allowed": "/"
    }
  });
  return new Response(req.method === "HEAD" ? null : JSON.stringify(manifest()), {
    headers: headers("application/manifest+json; charset=utf-8", "no-store")
  });
});
