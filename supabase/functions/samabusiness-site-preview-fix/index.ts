import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "12.1.2";
const SCRIPT = String.raw`;(function(){
'use strict';
const VERSION='12.1.2';
if(window.__SAMA_SITE_PREVIEW_FIX_V1212__)return;
window.__SAMA_SITE_PREVIEW_FIX_V1212__=true;
let lastHtml='';
function tokenFrom(v){if(!v)return'';if(typeof v==='string'){const s=v.trim();if(/^sama_[A-Za-z0-9_-]{30,}$/.test(s))return s;try{return tokenFrom(JSON.parse(s))}catch(_){return''}}if(typeof v==='object')for(const k of ['token','sessionToken','session_token','accessToken','access_token']){const r=tokenFrom(v[k]);if(r)return r}return''}
function getToken(){for(const v of [window.__SAMA_SESSION_TOKEN__,window.SAMA_SESSION_TOKEN,window.SAMABUSINESS?.sessionToken,window.SAMABUSINESS?.session?.token]){const r=tokenFrom(v);if(r)return r}for(const store of [localStorage,sessionStorage])try{for(let i=0;i<store.length;i++){const k=store.key(i)||'';if(!/sama|session|auth/i.test(k))continue;const r=tokenFrom(store.getItem(k));if(r)return r}}catch(_){}return''}
function sourceUrl(raw){const u=new URL(raw,location.href);let site=u.searchParams.get('site');if(!site&&u.pathname.startsWith('/sites/'))site=decodeURIComponent(u.pathname.slice('/sites/'.length));if(!site)throw new Error('Site introuvable.');const signedPreview=u.searchParams.get('preview')||'1';const target=new URL('/sites/'+encodeURIComponent(site),location.origin);target.searchParams.set('preview',signedPreview);return target.toString()}
function ensureControls(){const bar=document.querySelector('.ss-preview-bar');if(!bar||bar.querySelector('[data-preview-open]'))return;const open=document.createElement('button');open.type='button';open.className='ss-btn ss-secondary';open.dataset.previewOpen='1';open.textContent='↗ Ouvrir';open.style.marginLeft='auto';const close=bar.querySelector('#ss-preview-close');bar.insertBefore(open,close||null);open.addEventListener('click',()=>{if(!lastHtml)return;const blob=new Blob([lastHtml],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000)})}
function setFrame(html){const frame=document.querySelector('#ss-preview-frame');if(!frame)return;frame.removeAttribute('src');frame.srcdoc=html}
function showLoading(){const overlay=document.querySelector('#ss-preview');if(!overlay)return false;ensureControls();overlay.classList.add('open');setFrame('<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui;background:#f5f8f6;color:#10231c"><div style="text-align:center;padding:24px"><div style="font-size:42px">⏳</div><h2>Préparation de l’aperçu…</h2><p>Le brouillon est chargé avec son autorisation privée.</p></div></body></html>');return true}
function safeMessage(value){return String(value||'Fermez cette fenêtre puis réessayez.').replace(/[<>&]/g,'')}
async function openPreview(raw){if(!showLoading())return;try{const target=sourceUrl(raw);const previewValue=new URL(target).searchParams.get('preview')||'';const token=getToken();if(previewValue==='1'&&!token)throw new Error('Reconnectez-vous à Sama Business.');const headers={'x-client-info':'site-preview/'+VERSION};if(token)headers['x-sama-session']=token;const response=await fetch(target,{cache:'no-store',headers});const html=await response.text();if(!response.ok||!/^\s*<!doctype html/i.test(html))throw new Error(html||'Aperçu indisponible');lastHtml=html;setFrame(html)}catch(error){setFrame('<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui;background:#fff8f7;color:#8a1c13"><div style="max-width:430px;padding:28px;text-align:center"><div style="font-size:48px">⚠️</div><h2>Aperçu momentanément indisponible</h2><p>'+safeMessage(error&&error.message)+'</p><button onclick="parent.postMessage({type:\'sama-preview-retry\'},\'*\')" style="border:0;border-radius:14px;padding:13px 18px;background:#0b7a46;color:white;font-weight:800">Réessayer</button></div></body></html>')}}
document.addEventListener('click',event=>{const button=event.target.closest('[data-preview]');if(!button||!button.closest('#ss-root'))return;const raw=button.dataset.preview;if(!raw)return;event.preventDefault();event.stopImmediatePropagation();openPreview(raw)},true);
window.addEventListener('message',event=>{if(event.data&&event.data.type==='sama-preview-retry'){const active=document.querySelector('#ss-root [data-preview]');if(active)openPreview(active.dataset.preview)}});
new MutationObserver(()=>ensureControls()).observe(document.documentElement,{childList:true,subtree:true});
window.SAMABUSINESS=Object.assign(window.SAMABUSINESS||{},{sitePreview:{version:VERSION,open:openPreview,signedPreviewTokens:true}});
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
