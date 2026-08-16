import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "19.3.0";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const EXPECTED = "fa3324805cc9d5fc09c11011cb889307349ba3ae2762c6d5ee5a0c84810e2ee0";
function key() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const candidate of Object.values(parsed))if (typeof candidate === "string" && candidate.length > 40) return candidate;
  } catch  {
    return packed.length > 40 ? packed : "";
  }
  return "";
}
const KEY = key();
if (!URL || !KEY) throw new Error("FINAL_UI_CONFIG_MISSING");
const db = createClient(URL, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const enc = new TextEncoder();
let cached = "";
async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return [
    ...bytes
  ].map((x)=>x.toString(16).padStart(2, "0")).join("");
}
function livePatch() {
  'use strict';
  if (window.__SAMABUSINESS_FINAL_LIVE_PATCH_193__) return;
  window.__SAMABUSINESS_FINAL_LIVE_PATCH_193__ = true;
  const ROOT = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1';
  const BILLING = ROOT + '/sama-env-check';
  const AUDIO = ROOT + '/samabusiness-audio-api';
  let paymentHealth = null, audioHealth = null, audioObjectUrl = '', polishScheduled = false;
  const q = (s, r = document)=>r.querySelector(s);
  const qa = (s, r = document)=>[
      ...r.querySelectorAll(s)
    ];
  const text = (v)=>String(v || '').replace(/\s+/g, ' ').trim();
  const CSS = `
    @media(max-width:900px){
      #appShell #view-home{width:100%!important;max-width:none!important;min-width:0!important}
      #appShell #view-home>.hero,#appShell #view-home .hero{width:100%!important;max-width:none!important;min-width:0!important;grid-column:1/-1!important}
      #appShell #view-home .hero-row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(118px,155px)!important;gap:12px!important;width:100%!important;max-width:none!important;min-width:0!important;align-items:start!important}
      #appShell #view-home .hero-row>div:first-child{width:auto!important;max-width:none!important;min-width:0!important}
      #appShell #view-home .hero-side{width:auto!important;max-width:none!important;min-width:0!important;margin:0!important;text-align:right!important;justify-self:stretch!important}
      #appShell #view-home .hero h1{max-width:none!important}
    }
    @media(max-width:520px){
      #appShell #view-home .hero-row{grid-template-columns:minmax(0,1fr) 108px!important;gap:9px!important}
      #appShell #view-home .hero-side strong{font-size:clamp(21px,7vw,30px)!important;line-height:1!important}
    }
    #sama-site-launch-card .sl-row>div:first-child,#sama-site-launch-card .sl-row>div:first-child *{color:#fff!important;opacity:1!important}
    #sama-site-launch-card h3{color:#fff!important}
    #sama-site-launch-card p,#sama-site-launch-card .sl-note{color:rgba(255,255,255,.84)!important}
    #sama-copilot-fab.v193-dialog-muted{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(10px) scale(.92)!important}
    #sb-audio-modal.open .sb-audio-sheet{padding-bottom:max(18px,env(safe-area-inset-bottom))!important}
    @media(max-width:520px){
      #sb-audio-modal.open{align-items:flex-end!important}
      #sb-audio-modal.open .sb-audio-sheet{width:100%!important;max-height:calc(100dvh - 72px)!important;border-radius:25px 25px 0 0!important}
      #sb-audio-modal .sb-audio-actions{position:sticky!important;bottom:0!important;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 18%)!important;padding-top:18px!important}
    }
  `;
  function installLiveStyle() {
    let style = q('#samabusiness-live-v193-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'samabusiness-live-v193-style';
      document.head.append(style);
    }
    style.textContent = CSS;
  }
  function tokenFrom(v) {
    if (!v) return '';
    if (typeof v === 'string') {
      const s = v.trim();
      if (/^sama_[A-Za-z0-9_-]{30,}$/.test(s)) return s;
      try {
        return tokenFrom(JSON.parse(s));
      } catch  {
        return '';
      }
    }
    if (typeof v === 'object') for (const k of [
      'token',
      'sessionToken',
      'session_token',
      'accessToken',
      'access_token'
    ]){
      const r = tokenFrom(v[k]);
      if (r) return r;
    }
    return '';
  }
  function token() {
    for (const v of [
      window.__SAMA_SESSION_TOKEN__,
      window.SAMA_SESSION_TOKEN,
      window.SAMABUSINESS?.sessionToken,
      window.SAMABUSINESS?.session?.token
    ]){
      const r = tokenFrom(v);
      if (r) return r;
    }
    for (const store of [
      localStorage,
      sessionStorage
    ])try {
      for(let i = 0; i < store.length; i++){
        const k = store.key(i) || '';
        if (!/sama|session|auth/i.test(k)) continue;
        const r = tokenFrom(store.getItem(k));
        if (r) return r;
      }
    } catch  {}
    return '';
  }
  function notice(msg, bad = false) {
    let n = q('#v19-toast');
    if (!n) {
      n = document.createElement('div');
      n.id = 'v19-toast';
      document.body.append(n);
    }
    n.className = 'v19-toast' + (bad ? ' bad' : '');
    n.textContent = msg;
    clearTimeout(n._t);
    n._t = setTimeout(()=>n.remove(), 4300);
  }
  function fixVersionText() {
    if (!document.body) return;
    const rx = /Sama\s*Business\s+V18(?:\.1|\.2)\s*(?:active|·\s*Copilote)?/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while(node = walker.nextNode()){
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) continue;
      const raw = node.nodeValue || '';
      if (raw.length > 140 || !rx.test(raw)) {
        rx.lastIndex = 0;
        continue;
      }
      rx.lastIndex = 0;
      node.nodeValue = raw.replace(rx, 'SAMABUSINESS V19.3 · stable');
      rx.lastIndex = 0;
    }
  }
  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && el.getAttribute('aria-hidden') !== 'true';
  }
  function polish() {
    polishScheduled = false;
    installLiveStyle();
    const panels = qa('#sbx-module-admin .v19-admin');
    if (panels.length > 1) panels.slice(1).forEach((x)=>x.remove());
    fixVersionText();
    const card = q('#sama-site-launch-card');
    if (card) card.querySelectorAll('.sl-row>div:first-child,.sl-row>div:first-child *').forEach((el)=>{
      el.style.setProperty('color', '#fff', 'important');
      el.style.setProperty('opacity', '1', 'important');
    });
    const fab = q('#sama-copilot-fab');
    if (fab) {
      const dialogOpen = qa('[role="dialog"][aria-modal="true"],#sb-audio-modal.open').some((el)=>visible(el) && !el.closest('#sama-copilot-panel'));
      fab.classList.toggle('v193-dialog-muted', dialogOpen);
    }
  }
  function schedulePolish() {
    if (polishScheduled) return;
    polishScheduled = true;
    requestAnimationFrame(polish);
  }
  async function health() {
    try {
      paymentHealth = await fetch(BILLING, {
        cache: 'no-store'
      }).then((r)=>r.json());
    } catch  {}
    try {
      audioHealth = await fetch(AUDIO, {
        cache: 'no-store'
      }).then((r)=>r.json());
    } catch  {}
  }
  async function post(url, body) {
    const tk = token();
    if (!tk) throw new Error('Reconnectez-vous à SAMABUSINESS.');
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sama-session': tk,
        'x-client-info': 'samabusiness-live/19.3.0'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const j = await r.json().catch(()=>({
        ok: false,
        error: 'Réponse serveur invalide.'
      }));
    if (!r.ok || j.ok === false) throw new Error(j.error || 'Action impossible.');
    return j;
  }
  function browserSpeak(value) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(value);
      u.lang = localStorage.getItem('sama-ui-lang') === 'wo' ? 'fr-SN' : 'fr-FR';
      u.rate = .9;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch  {}
  }
  async function naturalSpeak(value) {
    if (!audioHealth?.tts?.configured) {
      browserSpeak(value);
      return;
    }
    try {
      const j = await post(AUDIO, {
        action: 'speak',
        text: value,
        language: localStorage.getItem('sama-ui-lang') === 'wo' ? 'wo' : 'fr'
      });
      const raw = atob(j.audio || '');
      if (!raw) throw new Error('Audio vide.');
      const bytes = new Uint8Array(raw.length);
      for(let i = 0; i < raw.length; i++)bytes[i] = raw.charCodeAt(i);
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = URL.createObjectURL(new Blob([
        bytes
      ], {
        type: j.content_type || 'audio/mpeg'
      }));
      await new Audio(audioObjectUrl).play();
    } catch (e) {
      console.warn('natural tts fallback', e);
      browserSpeak(value);
    }
  }
  function readingText(button) {
    const label = text(button.textContent).toLowerCase();
    if (label.includes('lire cet écran') || label.includes('lire cet ecran')) return text((q('#appShell') || document.body).innerText).slice(0, 1800);
    const host = button.closest('[role="dialog"],section,article,.sama-copilot,.copilot,.guide-card,.ss-card') || q('#appShell') || document.body;
    return text(host.innerText).slice(0, 1800);
  }
  document.addEventListener('click', async (e)=>{
    const pay = e.target.closest?.('#v19-pay');
    if (pay && q('#v19-method')?.value === 'wave') {
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        if (!paymentHealth) await health();
        const plan = q('.v19-pricing')?.dataset.selected || 'lifetime', ref = q('#v19-ref')?.value.trim() || '', auto = Boolean(paymentHealth?.payments?.wave_checkout_configured);
        if (!auto && !ref) {
          notice('Ajoutez la référence de transaction Wave.', true);
          q('#v19-ref')?.focus();
          return;
        }
        pay.disabled = true;
        pay.textContent = auto ? 'Ouverture de Wave…' : 'Enregistrement…';
        const j = await post(BILLING, {
          action: 'submit_subscription',
          planType: plan,
          method: 'wave',
          transactionRef: ref
        });
        if (j.checkout?.launch_url) {
          location.href = j.checkout.launch_url;
          return;
        }
        notice('Paiement enregistré. Validation en cours.');
        pay.disabled = false;
        pay.textContent = plan === 'lifetime' ? 'Choisir la licence à vie' : 'Choisir le mensuel';
      } catch (err) {
        notice(err.message || 'Paiement impossible.', true);
        pay.disabled = false;
      }
      return;
    }
    if (!audioHealth?.tts?.configured) return;
    const b = e.target.closest?.('button,[role="button"]');
    if (!b) return;
    const label = text(b.textContent).toLowerCase();
    if (!/(^|\s)écouter($|\s)|(^|\s)ecouter($|\s)|lire cet écran|lire cet ecran/.test(label)) return;
    if (b.closest('#v19-install')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const value = readingText(b);
    if (value) await naturalSpeak(value);
  }, true);
  installLiveStyle();
  health();
  polish();
  new MutationObserver(schedulePolish).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'class',
      'hidden',
      'aria-hidden',
      'style'
    ]
  });
  window.addEventListener('focus', ()=>{
    health();
    schedulePolish();
  });
  window.addEventListener('resize', schedulePolish, {
    passive: true
  });
  window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, {
    live193: {
      refreshCapabilities: health,
      speak: naturalSpeak,
      polish,
      version: '19.3.0'
    }
  });
}
const PATCH = `;(${livePatch.toString()})();`;
async function load() {
  if (cached) return cached;
  const result = await db.from("sama_app_assets").select("content,sha256").eq("path", "final-v19-base-script").maybeSingle();
  if (result.error) throw result.error;
  const base = String(result.data?.content ?? "");
  if (!base || result.data?.sha256 !== EXPECTED || await digest(base) !== EXPECTED) throw new Error("FINAL_UI_CHECKSUM_INVALID");
  cached = base + PATCH;
  return cached;
}
Deno.serve(async (req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-final": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  try {
    const script = await load();
    return new Response(req.method === "HEAD" ? null : script, {
      headers
    });
  } catch (error) {
    console.error("final ui", error);
    return new Response("Final UI unavailable", {
      status: 503,
      headers
    });
  }
});
