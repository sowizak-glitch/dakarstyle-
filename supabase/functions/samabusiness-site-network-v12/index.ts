import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "12.1.2";
const SCRIPT = String.raw`;(function(){
'use strict';
const VERSION='12.1.2';
if(window.__SAMA_SITE_NETWORK_V1211__)return;
window.__SAMA_SITE_NETWORK_V1211__=true;
const OLD='https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio';
const PLATFORM='https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-platform';
const RENDERER='https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-renderer-v12';
const API='/api/site-platform';
function route(raw){
  if(typeof raw!=='string')return raw;
  try{
    const u=new URL(raw,location.href);
    const base=u.origin+u.pathname;
    if(base!==OLD&&base!==PLATFORM&&base!==RENDERER)return raw;
    const site=u.searchParams.get('site');
    if(site){const target=new URL('/sites/'+encodeURIComponent(site),location.origin);const preview=u.searchParams.get('preview');if(preview)target.searchParams.set('preview',preview);return target.pathname+target.search;}
    return API;
  }catch(_){return raw;}
}
function jsonFailure(message){return new Response(JSON.stringify({ok:false,error:message,code:'NETWORK_TEMPORARY'}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
async function fetchWithRetry(nativeFetch,target,init){
  try{return await nativeFetch(target,{...init,cache:'no-store'});}catch(first){
    await new Promise(r=>setTimeout(r,420));
    return await nativeFetch(target,{...init,cache:'no-store'});
  }
}
if(!window.__SAMA_SITE_FETCH_V1211__){
  window.__SAMA_SITE_FETCH_V1211__=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    let target=input;
    try{
      if(typeof input==='string')target=route(input);
      else if(input instanceof Request){const next=route(input.url);if(next!==input.url)target=new Request(next,input);}
    }catch(_){}
    const url=typeof target==='string'?target:(target instanceof Request?target.url:'');
    const apiRequest=url.startsWith(API)||url.includes('/api/site-platform');
    const studioRequest=apiRequest||url.startsWith('/sites/')||url.includes('/sites/');
    if(!studioRequest)return nativeFetch(target,init);
    try{
      const response=await fetchWithRetry(nativeFetch,target,init);
      if(!apiRequest)return response;
      const type=(response.headers.get('content-type')||'').toLowerCase();
      if(response.ok&&type.includes('application/json'))return response;
      const fallbackInput=typeof input==='string'?PLATFORM:(input instanceof Request?new Request(PLATFORM,input):PLATFORM);
      return await fetchWithRetry(nativeFetch,fallbackInput,init);
    }catch(error){
      console.error('samabusiness-site-network',error);
      if(apiRequest){
        try{
          const fallbackInput=typeof input==='string'?PLATFORM:(input instanceof Request?new Request(PLATFORM,input):PLATFORM);
          return await fetchWithRetry(nativeFetch,fallbackInput,init);
        }catch(_){}
      }
      return jsonFailure('Connexion momentanément indisponible. Vérifiez le réseau puis réessayez.');
    }
  };
}
function patchLinks(root=document){
  root.querySelectorAll?.('iframe[src],a[href],[data-preview]').forEach(el=>{
    if(el.hasAttribute('src')){const v=route(el.getAttribute('src')||'');if(v)el.setAttribute('src',v);}
    if(el.hasAttribute('href')){const v=route(el.getAttribute('href')||'');if(v)el.setAttribute('href',v);}
    if(el.dataset?.preview){const v=route(el.dataset.preview);if(v)el.dataset.preview=v;}
  });
}
patchLinks();
new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)patchLinks(n)}))).observe(document.documentElement,{childList:true,subtree:true});
window.SAMABUSINESS=Object.assign(window.SAMABUSINESS||{},{siteNetwork:{version:VERSION,api:API,fallback:PLATFORM,rewrite:route,signedPreviewTokens:true}});
})();`;
Deno.serve((req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  return new Response(req.method === "HEAD" ? null : SCRIPT, {
    headers
  });
});
