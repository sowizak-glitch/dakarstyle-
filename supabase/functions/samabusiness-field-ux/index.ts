import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "11.7.0";
const CORE_SOURCE_REF = "62de4076ff7b717770b3b6ff1b8821b0fbf5950f";
const SALES_SOURCE_REF = "a7f76ff339a23a33514b4901c4949f748cdf78ac";
const WHATSAPP_SOURCE_REF = "b6914736730d82ae5bbd8ca0d9b395d2bbcdd396";
const WHATSAPP_DIRECT_SOURCE_REF = "7929ef854d38ee384803c9e62b836ddc7beae320";
const ICON_SOURCE_REF = "9c7d8e197c6d0fcc1ba25952fcff657e5d3b9307";

const CORE_PARTS = Array.from({ length: 10 }, (_, index) =>
  `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${CORE_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-${String(index).padStart(2, "0")}.js`
);
const SALES_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${SALES_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-10-sales-ops.js`;
const WHATSAPP_BUSINESS_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${WHATSAPP_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-11-whatsapp-business.js`;
const WHATSAPP_DIRECT_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${WHATSAPP_DIRECT_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-12-whatsapp-business-direct.js`;
const ICON_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${ICON_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-13-icon-system.js`;
const PARTS = [...CORE_PARTS, SALES_PART, WHATSAPP_BUSINESS_PART, WHATSAPP_DIRECT_PART, ICON_PART];
const STUDIO = "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio-ui?v=11.2.2";
let cached = "";

function loader(): string {
  return `;(()=>{if(window.__SAMABUSINESS_SITE_STUDIO_LOADER_V1122__)return;window.__SAMABUSINESS_SITE_STUDIO_LOADER_V1122__=true;document.querySelectorAll('script[data-samabusiness-site-network],script[data-samabusiness-ecosystem],script[data-samabusiness-site-studio],script[data-samabusiness-admin-fix]').forEach(s=>s.remove());const s=document.createElement('script');s.src=${JSON.stringify(STUDIO)};s.defer=true;s.crossOrigin='anonymous';s.dataset.samabusinessSiteStudio='11.2.2';s.onerror=()=>console.error('Sama Business Site Studio unavailable');document.head.appendChild(s);})();`;
}

async function source(): Promise<string> {
  if (cached) return cached;
  const responses = await Promise.all(PARTS.map((url) => fetch(url, { headers: { accept: "text/plain" } })));
  if (responses.some((response) => !response.ok)) {
    throw new Error(`FIELD_SOURCE_UNAVAILABLE:${responses.map((response) => response.status).join(",")}`);
  }
  let code = (await Promise.all(responses.map((response) => response.text()))).join("");
  const markers = [
    "__SAMABUSINESS_FIELD_UX__",
    "Partager sur WhatsApp",
    "Commander sur WhatsApp",
    "Wolof activé",
    "__SAMABUSINESS_NATIVE_PWA__",
    "Importer un vocal WhatsApp",
    "__SAMABUSINESS_SALES_OPS_V2__",
    "Ventes & livraisons",
    "__SAMABUSINESS_WHATSAPP_BUSINESS_ROUTER__",
    "com.whatsapp.w4b",
    "com.samabusiness.wabridge2",
    "native-explicit-package-bridge-v2",
    "__SAMABUSINESS_WHATSAPP_DIRECT_V3__",
    "native-v3-bridge2",
    "__SAMABUSINESS_ICON_SYSTEM_V2026__",
    "sbix-2026-styles",
  ];
  if (code.length < 88000 || !markers.every((marker) => code.includes(marker))) {
    throw new Error("FIELD_SOURCE_INVALID");
  }
  code = code
    .replace("const VERSION = '10.2.0';", "const VERSION = '11.2.2';")
    .replace("const VERSION='10.2.0';", "const VERSION='11.2.2';");
  cached = code + loader();
  return cached;
}

Deno.serve(async (req: Request) => {
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-samabusiness-field-ux": VERSION,
    "x-samabusiness-version": VERSION,
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers });
  try {
    const code = await source();
    return new Response(req.method === "HEAD" ? null : code, { headers });
  } catch (error) {
    console.error("samabusiness_field_ux", error);
    return Response.json(
      { ok: false, error: "Field UX unavailable" },
      { status: 503, headers: { ...headers, "content-type": "application/json; charset=utf-8" } },
    );
  }
});