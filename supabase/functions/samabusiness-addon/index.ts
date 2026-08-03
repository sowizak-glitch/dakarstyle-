import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = rawKeys ? JSON.parse(rawKeys).default : (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const EXPECTED_B64_SHA = "95ae64cacd76133084bd5faca4edd2e928606634ec2bbdaab546560b060a5f3d";
const EXPECTED_SOURCE_SHA = "e22caaf8f2d0126c515893cf094653180890343351885dab41f3216a7ec08c3d";
const PWA_ROOT = `${SUPABASE_URL}/functions/v1/samabusiness-pwa`;
const API_PROXY = `${SUPABASE_URL}/functions/v1/samabusiness-api-v10`;
const LEGACY_API = `${SUPABASE_URL}/functions/v1/sama-business-api`;
const LOGO = "https://dakarstyle.com/assets/samabusiness/samabusiness-192.webp?v=20260803";
const VERSION = "10.1.0";
let cached = "";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function decodeBase64(value: string): Uint8Array {
  const raw = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function runtimePatch(): string {
  return `
;(()=>{
  'use strict';
  const VERSION='${VERSION}';
  const PWA='${PWA_ROOT}';
  const LOGO='${LOGO}';
  const OLD_API='${LEGACY_API}';
  const API_PROXY='${API_PROXY}';
  const NEW_ORIGIN='https://samabusiness.dakarstyle.com';

  if(!window.__SAMABUSINESS_FETCH_PATCHED__){
    window.__SAMABUSINESS_FETCH_PATCHED__=true;
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,init)=>{
      try{
        if(typeof input==='string' && input.startsWith(OLD_API)) input=API_PROXY+input.slice(OLD_API.length);
        else if(input instanceof Request && input.url.startsWith(OLD_API)) input=new Request(API_PROXY+input.url.slice(OLD_API.length),input);
      }catch(_){ }
      return originalFetch(input,init);
    };
  }

  function upsertLink(rel,href,extra){
    let node=document.querySelector('link[rel="'+rel+'"]');
    if(!node){node=document.createElement('link');node.rel=rel;document.head.appendChild(node);}
    node.href=href;
    if(extra) Object.entries(extra).forEach(([k,v])=>node.setAttribute(k,v));
    return node;
  }

  function patchProductSelectors(){
    if(window.__SAMABUSINESS_PRODUCT_SELECTORS_PATCHED__) return;
    try{
      if(typeof populateProductSelects!=='function' || typeof productOptions!=='function') return;
      const originalPopulateProductSelects=populateProductSelects;
      populateProductSelects=function(){
        originalPopulateProductSelects();
        const options='<option value="">Article libre</option>'+productOptions();
        document.querySelectorAll('#saleItems .sale-product').forEach((select)=>{
          const current=select.value;
          select.innerHTML=options;
          if(Array.from(select.options).some((option)=>option.value===current)) select.value=current;
        });
      };
      window.__SAMABUSINESS_PRODUCT_SELECTORS_PATCHED__=true;
      populateProductSelects();
      document.addEventListener('click',(event)=>{
        if(event.target.closest('[data-open="saleModal"]')) setTimeout(()=>{try{populateProductSelects();}catch(_){}},0);
      });
    }catch(_){ }
  }

  function applyBrand(){
    document.documentElement.dataset.samabusinessVersion=VERSION;
    document.title='SAMABUSINESS';
    upsertLink('manifest',PWA+'?mode=manifest&v='+VERSION,{crossorigin:'anonymous'});
    upsertLink('icon',LOGO,{type:'image/webp'});
    upsertLink('apple-touch-icon',LOGO,{type:'image/webp'});
    upsertLink('canonical',NEW_ORIGIN+'/');
    document.querySelectorAll('.logo-mark').forEach((el)=>{
      el.textContent='';
      el.setAttribute('role','img');
      el.setAttribute('aria-label','Logo SAMABUSINESS');
      el.style.backgroundImage='url("'+LOGO+'")';
      el.style.backgroundSize='cover';
      el.style.backgroundPosition='center';
      el.style.backgroundRepeat='no-repeat';
      el.style.backgroundColor='#071a32';
      el.style.border='1px solid rgba(214,162,40,.45)';
      el.style.boxShadow='0 8px 24px rgba(7,26,50,.22)';
    });
    const styleId='samabusiness-finition-2026';
    if(!document.getElementById(styleId)){
      const style=document.createElement('style');
      style.id=styleId;
      style.textContent='.logo-mark{flex:0 0 auto}.quick,.more-card,.primary,.secondary,.mini-btn,.nav-btn,.icon-btn{touch-action:manipulation}.quick:focus-visible,.more-card:focus-visible,.primary:focus-visible,.secondary:focus-visible,.mini-btn:focus-visible,.nav-btn:focus-visible,.icon-btn:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #f2b84b;outline-offset:2px}@media(max-width:620px){button,.quick,.nav-btn{min-height:44px}.logo-mark{border-radius:14px}}';
      document.head.appendChild(style);
    }
    patchProductSelectors();
  }

  function cleanStaleCaches(){
    if('caches' in window){caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sama-')||k.startsWith('samabusiness-shell-v8')||k.startsWith('samabusiness-shell-v9')).map(k=>caches.delete(k)))).catch(()=>{});}
    if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(r=>r.unregister()))).catch(()=>{});}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyBrand,{once:true}); else applyBrand();
  setTimeout(applyBrand,350);
  setTimeout(patchProductSelectors,700);
  setTimeout(cleanStaleCaches,800);
  window.SAMABUSINESS=Object.assign(window.SAMABUSINESS||{},{version:VERSION,canonicalOrigin:NEW_ORIGIN,logo:LOGO,pwa:PWA,apiProxy:API_PROXY,productSelectorFix:true});
})();`;
}

async function loadSource(): Promise<string> {
  if (cached) return cached;
  const q = await db.from("sama_app_assets").select("content,sha256").eq("path", "addon-v10-b64").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data?.content) throw new Error("Missing addon bundle");
  const b64 = String(q.data.content).trim();
  if (b64.length !== 23876) throw new Error("Invalid bundle length");
  if (q.data.sha256 !== EXPECTED_B64_SHA || await sha256(b64) !== EXPECTED_B64_SHA) throw new Error("Invalid bundle checksum");
  const stream = new Blob([decodeBase64(b64)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const source = await new Response(stream).text();
  const sourceBytes = new TextEncoder().encode(source).length;
  if (sourceBytes !== 70689 || await sha256(source) !== EXPECTED_SOURCE_SHA) throw new Error("Invalid source checksum");
  const markers = ["window.SAMABUSINESS", "Cahier & dettes", "Commande vocale", "Pilotage général", "samabusiness-control-api", "samabusiness-livraison-proxy"];
  if (!markers.every((marker) => source.includes(marker))) throw new Error("Missing functional markers");
  cached = source + runtimePatch();
  return cached;
}

Deno.serve(async (req: Request) => {
  const baseHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cache-control": "public,max-age=120,stale-while-revalidate=300",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "x-samabusiness-version": VERSION,
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: baseHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: baseHeaders });
  try {
    const source = await loadSource();
    return new Response(req.method === "HEAD" ? null : source, { headers: { ...baseHeaders, "content-type": "application/javascript; charset=utf-8" } });
  } catch (error) {
    console.error("samabusiness-addon", error);
    return Response.json({ ok: false, error: "Addon unavailable" }, { status: 503, headers: { ...baseHeaders, "cache-control": "no-store" } });
  }
});
