import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "11.8.4";
const CORE_SOURCE_REF = "62de4076ff7b717770b3b6ff1b8821b0fbf5950f";
const SALES_SOURCE_REF = "a7f76ff339a23a33514b4901c4949f748cdf78ac";
const WHATSAPP_SOURCE_REF = "b6914736730d82ae5bbd8ca0d9b395d2bbcdd396";
const WHATSAPP_DIRECT_SOURCE_REF = "7929ef854d38ee384803c9e62b836ddc7beae320";
const ICON_SOURCE_REF = "9c7d8e197c6d0fcc1ba25952fcff657e5d3b9307";
const ICON_POLISH_SOURCE_REF = "b760831c403a9d79ff90f271c3b4f174ad02d71a";
const CLIENT_RECAP_SOURCE_REF = "d1fdc9da441cc6645c20d3066c870178b5c477c7";
const DESIGN_SOURCE_REF = "82804d4cc110bfe52fdfa3ce3e28ebeb2de5944e";
const COPILOT_SOURCE_REF = "27a8f63266fdcc451a7a70c7154fac7603e7bd7f";
const CAPTURE_MARKETING_SOURCE_REF = "bfa6b82b58c46a02ae6fa0d4f8e57fc0100caa85";
const OPERATIONAL_SOURCE_REF = "78c732b55666d052e80a2c8bf13160a2a7745c4a";
const GUIDE_BRIDGE_SOURCE_REF = "8ff8417c670f68c805ee81e9bf852ab83138ae86";

const CORE_PARTS = Array.from({ length: 10 }, (_, index) =>
  `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${CORE_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-${String(index).padStart(2, "0")}.js`
);
const SALES_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${SALES_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-10-sales-ops.js`;
const WHATSAPP_BUSINESS_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${WHATSAPP_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-11-whatsapp-business.js`;
const WHATSAPP_DIRECT_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${WHATSAPP_DIRECT_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-12-whatsapp-business-direct.js`;
const ICON_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${ICON_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-13-icon-system.js`;
const ICON_POLISH_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${ICON_POLISH_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-14-icon-polish.js`;
const CLIENT_RECAP_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${CLIENT_RECAP_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-15-client-financial-recap.js`;
const DESIGN_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${DESIGN_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-16-design-system-v18.js`;
const COPILOT_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${COPILOT_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-17-sama-copilot-v19.js`;
const CAPTURE_MARKETING_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${CAPTURE_MARKETING_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-18-capture-marketing-v19.js`;
const OPERATIONAL_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${OPERATIONAL_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-19-operational-intelligence-v19.js`;
const GUIDE_BRIDGE_PART = `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${GUIDE_BRIDGE_SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-20-guide-engine-bridge-v19.js`;
const PARTS = [...CORE_PARTS, SALES_PART, WHATSAPP_BUSINESS_PART, WHATSAPP_DIRECT_PART, ICON_PART, ICON_POLISH_PART, CLIENT_RECAP_PART, DESIGN_PART, COPILOT_PART, CAPTURE_MARKETING_PART, OPERATIONAL_PART, GUIDE_BRIDGE_PART];
const STUDIO = "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio-ui?v=11.2.2";
let cached = "";

function publicDemoGuard(): string {
  return `;(()=>{if(window.__SAMABUSINESS_PUBLIC_DEMO_GUARD_V1184__)return;window.__SAMABUSINESS_PUBLIC_DEMO_GUARD_V1184__=true;let running=false,explicit=false;const visible=(el)=>{if(!el)return false;const style=getComputedStyle(el);return !el.classList.contains('hidden')&&style.display!=='none'&&style.visibility!=='hidden'};const isDemoTrigger=(target)=>{const el=target?.closest?.('button,a,[role="button"]');if(!el)return false;const label=[el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.id].filter(Boolean).join(' ');return /voir\s+la\s+d[eé]mo|watch\s+demo|demo[-_ ]?(?:open|button|trigger)/i.test(label)};const close=(modal)=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');modal.querySelectorAll('video,audio').forEach(media=>{try{media.pause()}catch(_){}});document.documentElement.style.overflow='';if(document.body)document.body.style.overflow=''};const sync=()=>{if(running)return;running=true;try{const shell=document.querySelector('#appShell'),modal=document.querySelector('#sama-demo-modal');if(!modal)return;if(!modal.classList.contains('open')){explicit=false;return}if(visible(shell)||!explicit)close(modal)}finally{running=false}};document.addEventListener('click',event=>{if(event.isTrusted&&isDemoTrigger(event.target))explicit=true},true);sync();new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});window.addEventListener('sama-session-change',sync);window.addEventListener('storage',sync);})();`;
}

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
    "__SAMABUSINESS_ICON_POLISH_V2026__",
    "sbix-2026-polish-styles",
    "__SAMABUSINESS_CLIENT_FINANCIAL_RECAP_V2026__",
    "sbfr-2026-styles",
    "__SAMABUSINESS_DESIGN_SYSTEM_V18_2__",
    "sama-design-system-v18-2",
    "__SAMABUSINESS_COGNITIVE_COPILOT_V19__",
    "sama-copilot-v19-styles",
    "__SAMABUSINESS_CAPTURE_MARKETING_V19__",
    "sama-capture-marketing-styles",
    "__SAMABUSINESS_OPERATIONAL_INTELLIGENCE_V19__",
    "sama-operational-intelligence-styles",
    "__SAMABUSINESS_GUIDE_ENGINE_BRIDGE_V19__",
    "sama-guide-engine-bridge-styles",
  ];
  if (code.length < 160000 || !markers.every((marker) => code.includes(marker))) {
    throw new Error("FIELD_SOURCE_INVALID");
  }
  code = code
    .replace("const VERSION = '10.2.0';", "const VERSION = '11.8.4';")
    .replace("const VERSION='10.2.0';", "const VERSION='11.8.4';");
  cached = code + publicDemoGuard() + loader();
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