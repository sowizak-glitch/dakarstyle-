import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "12.2.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function resolveKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
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
const SERVICE_KEY = resolveKey();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("RENDERER_CONFIG_MISSING");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const ORIGINS = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://www.samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com"
]);
function allowed(origin) {
  return !origin || ORIGINS.has(origin);
}
function baseHeaders(origin, type) {
  return {
    "content-type": type,
    "access-control-allow-origin": origin && allowed(origin) ? origin : "https://samabusiness.dakarstyle.com",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "x-sama-session,content-type,x-client-info",
    "access-control-max-age": "86400",
    vary: "Origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-samabusiness-renderer": VERSION
  };
}
function clean(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c)=>({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c] || c);
}
function color(value, fallback) {
  const v = clean(value, 7);
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
function section(config, type) {
  return Array.isArray(config?.sections) ? config.sections.find((s)=>s?.type === type)?.data || {} : {};
}
function b64url(bytes) {
  let raw = "";
  for (const b of bytes)raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function tokenHash(token) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}
async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(SERVICE_KEY), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
async function verifySignedPreview(siteId, updatedAt, token) {
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = await hmac(`${siteId}.${updatedAt}.${expires}`);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for(let i = 0; i < expected.length; i++)diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
async function accountForPreview(req) {
  const token = (req.headers.get("x-sama-session") || "").trim();
  if (!token.startsWith("sama_") || token.length < 40) throw Object.assign(new Error("AUTH_REQUIRED"), {
    status: 401
  });
  const hash = await tokenHash(token);
  const sessionQ = await db.from("sama_sessions").select("account_id,expires_at,revoked_at").eq("token_hash", hash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) throw Object.assign(new Error("SESSION_EXPIRED"), {
    status: 401
  });
  const accountQ = await db.from("sama_accounts").select("id,role,is_active,suspended_at").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active || accountQ.data.suspended_at) throw Object.assign(new Error("ACCOUNT_DISABLED"), {
    status: 403
  });
  return {
    id: accountQ.data.id,
    role: accountQ.data.role
  };
}
function contactHref(method) {
  const value = String(method?.value || "");
  if (method?.type === "phone") return `tel:${value.replace(/[^+0-9]/g, "")}`;
  if (method?.type === "whatsapp") return `https://wa.me/${value.replace(/\D/g, "")}`;
  if (method?.type === "email") return `mailto:${encodeURIComponent(value)}`;
  return "#contact";
}
function icon(name) {
  const map = {
    Sparkles: "✦",
    CheckCircle: "✓",
    MessageCircle: "💬",
    ShoppingBag: "🛍️",
    Truck: "🚚",
    Wallet: "💳",
    Calendar: "📅",
    Shield: "🛡️",
    Target: "🎯",
    Award: "🏅",
    Globe: "🌍",
    Briefcase: "🧰",
    Clock: "⏱️",
    Heart: "♡",
    Zap: "⚡",
    Rocket: "↗",
    MapPin: "📍",
    Users: "👥",
    TrendingUp: "📈"
  };
  return map[String(name || "")] || "✓";
}
function words(language) {
  const wo = language === "wo";
  return wo ? {
    preview: "SEETLU BU SUTURA · PUBLIKUL",
    offer: "Li ñuy joxe",
    about: "Ci sunu mbir",
    contact: "Wax ak nun",
    direct: "Jokkondiral ci saa si",
    mobile: "Defar ngir telefon",
    clear: "Xibaar yu leer",
    local: "Jëfandikoo bu yomb",
    call: "Woote",
    whatsapp: "WhatsApp",
    name: "Sa tur",
    need: "Li nga soxla",
    send: "Yónnee ci WhatsApp",
    ready: "Pare nga?",
    menu: "Ubbi menu"
  } : {
    preview: "APERÇU PRIVÉ · NON PUBLIÉ",
    offer: "Une offre facile à comprendre",
    about: "À propos",
    contact: "Nous contacter",
    direct: "Contact direct",
    mobile: "Pensé pour mobile",
    clear: "Informations claires",
    local: "Parcours simple",
    call: "Appeler",
    whatsapp: "WhatsApp",
    name: "Votre nom",
    need: "Votre besoin",
    send: "Envoyer sur WhatsApp",
    ready: "Prêt à avancer ?",
    menu: "Ouvrir le menu"
  };
}
function render(config, preview) {
  const meta = config?.siteMetadata || {}, theme = config?.theme || {}, nav = config?.navigation || {}, language = String(meta.language || "fr");
  const t = words(language), hero = section(config, "hero"), features = section(config, "features"), about = section(config, "about"), contact = section(config, "contact"), cta = section(config, "ctaBanner"), footer = section(config, "footer");
  const title = esc(meta.title || nav.brandName || "Site professionnel");
  const p = color(theme.primaryColor, "#087A45"), s = color(theme.secondaryColor, "#0B2E24"), a = color(theme.accentColor, "#F4C430"), bg = color(theme.backgroundColor, "#F7FAF8"), surface = color(theme.surfaceColor, "#FFFFFF"), text = color(theme.textColor, "#10231C"), muted = color(theme.mutedTextColor, "#667085");
  const methods = Array.isArray(contact.methods) ? contact.methods : [];
  const phone = methods.find((m)=>m?.type === "phone"), wa = methods.find((m)=>m?.type === "whatsapp") || phone;
  const phoneHref = phone ? contactHref(phone) : "#contact", waHref = wa ? contactHref({
    ...wa,
    type: "whatsapp"
  }) : "#contact";
  const links = Array.isArray(nav.links) ? nav.links : [], items = Array.isArray(features.items) ? features.items : [], values = Array.isArray(about.values) ? about.values : [];
  const mark = esc(hero.visualIcon || "🏪"), image = clean(hero.imageUrl, 1000);
  const navHtml = links.map((l)=>`<a href="${esc(l.anchor || "#")}"><span>${esc(l.visual || "")}</span>${esc(l.label)}</a>`).join("");
  const itemHtml = items.map((i, n)=>`<article class="feature"><span class="num">${String(n + 1).padStart(2, "0")}</span><i>${icon(i.icon)}</i><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p></article>`).join("");
  const valueHtml = values.map((v, n)=>`<div class="value"><b>${[
      "◎",
      "↔",
      "◇"
    ][n] || "✓"}</b><div><strong>${esc(v.title)}</strong><p>${esc(v.description)}</p></div></div>`).join("");
  const contactHtml = methods.map((m)=>`<a class="method" href="${esc(contactHref(m))}"><i>${esc(m.visual || "💬")}</i><span><small>${esc(m.label)}</small><br>${esc(m.value)}</span><b>↗</b></a>`).join("");
  const visual = image ? `<img src="${esc(image)}" alt="${esc(hero.imageAlt || title)}">` : `<div class="art"><div class="mark">${mark}</div><span class="ring r1"></span><span class="ring r2"></span><span class="dot d1"></span><span class="dot d2"></span></div><div class="float f1">✓ <span>${esc(t.clear)}</span></div><div class="float f2">💬 <span>${esc(t.direct)}</span></div>`;
  const description = esc(meta.description || hero.subheadline || "");
  return `<!doctype html><html lang="${esc(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="${p}"><meta name="description" content="${description}"><title>${title}</title><style>
:root{--p:${p};--s:${s};--a:${a};--bg:${bg};--surface:${surface};--text:${text};--muted:${muted};--line:color-mix(in srgb,var(--text) 11%,transparent);--shadow:0 30px 90px rgba(7,26,50,.15)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}a{text-decoration:none;color:inherit}button,input,textarea{font:inherit}.preview{position:sticky;top:0;z-index:100;padding:9px 14px;background:linear-gradient(90deg,#f4c430,#ffe39a);text-align:center;font-size:11px;font-weight:950;letter-spacing:.08em}.container{width:min(1180px,calc(100% - 34px));margin:auto}.nav{position:sticky;top:${preview ? "35px" : "0"};z-index:80;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(20px);border-bottom:1px solid var(--line)}.navin{height:78px;display:flex;align-items:center;gap:18px}.brand{display:flex;align-items:center;gap:11px;font-weight:950;letter-spacing:-.035em}.brandmark{width:48px;height:48px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(145deg,var(--s),var(--p));color:#fff;font-size:22px;box-shadow:0 12px 28px color-mix(in srgb,var(--p) 28%,transparent)}.links{margin-left:auto;display:flex;gap:4px}.links a{padding:10px 12px;border-radius:999px;font-size:13px;font-weight:850}.links a:hover{background:color-mix(in srgb,var(--p) 10%,transparent);color:var(--p)}.navcta{padding:12px 16px;border-radius:14px;background:var(--p);color:#fff;font-weight:950}.menu{display:none;margin-left:auto;border:1px solid var(--line);background:var(--surface);border-radius:13px;width:48px;height:48px}.hero{padding:70px 0 52px;overflow:hidden}.herogrid{display:grid;grid-template-columns:1.08fr .92fr;gap:50px;align-items:center}.badge{display:inline-flex;padding:8px 12px;border:1px solid color-mix(in srgb,var(--p) 22%,transparent);border-radius:999px;background:color-mix(in srgb,var(--p) 8%,var(--surface));color:var(--p);font-size:12px;font-weight:900}.hero h1{margin:22px 0 20px;font-size:clamp(2.9rem,7vw,6.3rem);line-height:.92;letter-spacing:-.072em}.hero p{margin:0;color:var(--muted);font-size:clamp(1.04rem,2vw,1.28rem);max-width:720px}.actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:29px}.btn{min-height:54px;padding:14px 19px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-weight:950;transition:.18s;border:0}.btn:hover{transform:translateY(-3px)}.primary{background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 72%,black));color:#fff;box-shadow:0 15px 34px color-mix(in srgb,var(--p) 28%,transparent)}.secondary{background:var(--surface);border:1px solid var(--line)}.visual{min-height:510px;border-radius:40px;position:relative;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 22% 18%,color-mix(in srgb,var(--a) 78%,white),transparent 29%),linear-gradient(145deg,var(--s),var(--p));box-shadow:var(--shadow)}.visual img{width:100%;height:100%;object-fit:cover}.art{position:relative;width:100%;height:100%;display:grid;place-items:center}.mark{position:relative;z-index:3;font-size:9rem;filter:drop-shadow(0 24px 30px rgba(0,0,0,.25))}.ring{position:absolute;border:1px solid rgba(255,255,255,.24);border-radius:50%}.r1{width:410px;height:410px}.r2{width:270px;height:270px}.dot{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--a);box-shadow:0 0 0 8px rgba(255,255,255,.11)}.d1{left:15%;top:20%}.d2{right:18%;bottom:17%}.float{position:absolute;z-index:4;padding:12px 14px;border-radius:17px;background:rgba(255,255,255,.94);box-shadow:0 16px 38px rgba(0,0,0,.17);font-size:12px;font-weight:900;display:flex;gap:8px}.f1{left:22px;bottom:26px}.f2{right:22px;top:26px}.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.trust div{padding:13px;border-radius:17px;background:var(--surface);border:1px solid var(--line);font-size:12px;font-weight:850}.section{padding:82px 0}.head{max-width:760px;margin-bottom:30px}.eyebrow{display:block;color:var(--p);font-size:11px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.section h2{margin:9px 0 12px;font-size:clamp(2.1rem,5vw,4rem);line-height:1;letter-spacing:-.055em}.head p{margin:0;color:var(--muted)}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.feature{position:relative;min-height:270px;padding:25px;border-radius:28px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 38px rgba(7,26,50,.06)}.feature .num{position:absolute;right:18px;top:12px;color:color-mix(in srgb,var(--text) 13%,transparent);font-size:35px;font-weight:950}.feature i{width:60px;height:60px;border-radius:20px;display:grid;place-items:center;background:color-mix(in srgb,var(--p) 10%,var(--surface));color:var(--p);font-style:normal;font-size:25px}.feature h3{margin:38px 0 8px}.feature p{margin:0;color:var(--muted)}.about{background:linear-gradient(145deg,color-mix(in srgb,var(--s) 96%,black),var(--p));color:#fff}.aboutgrid{display:grid;grid-template-columns:.95fr 1.05fr;gap:50px;align-items:center}.about .eyebrow{color:var(--a)}.about p{color:rgba(255,255,255,.76)}.values{display:grid;gap:11px}.value{display:flex;gap:13px;padding:17px;border-radius:20px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14)}.value>b{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.12);color:var(--a)}.value p{margin:4px 0 0;font-size:13px}.contactgrid{display:grid;grid-template-columns:.9fr 1.1fr;gap:18px}.panel{padding:25px;border-radius:29px;background:var(--surface);border:1px solid var(--line);box-shadow:0 14px 45px rgba(7,26,50,.07)}.methods{display:grid;gap:10px}.method{min-height:74px;display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:18px;background:color-mix(in srgb,var(--p) 6%,var(--surface));border:1px solid color-mix(in srgb,var(--p) 13%,transparent);font-weight:900}.method i{width:43px;height:43px;border-radius:14px;display:grid;place-items:center;background:var(--surface);font-style:normal}.method b{margin-left:auto}.field{margin-bottom:13px}.field label{display:block;margin-bottom:6px;font-size:12px;font-weight:900}.field input,.field textarea{width:100%;padding:14px;border:2px solid var(--line);border-radius:15px;background:#fff}.field textarea{min-height:120px;resize:vertical}.field input:focus,.field textarea:focus{outline:0;border-color:var(--p);box-shadow:0 0 0 4px color-mix(in srgb,var(--p) 14%,transparent)}.ctabox{padding:36px;border-radius:35px;background:linear-gradient(135deg,var(--s),var(--p));color:#fff;display:flex;justify-content:space-between;align-items:center;gap:20px}.ctabox h2{margin:0}.ctabox p{margin:8px 0 0;color:rgba(255,255,255,.76)}footer{padding:38px 0 105px;color:var(--muted)}.footerin{padding-top:24px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px}.mobile{display:none}@media(max-width:850px){.links,.navcta{display:none}.menu{display:block}.links.open{position:absolute;top:78px;left:16px;right:16px;display:grid;padding:10px;border-radius:20px;background:var(--surface);box-shadow:0 18px 45px rgba(7,26,50,.2)}.hero{padding-top:36px}.herogrid,.aboutgrid,.contactgrid{grid-template-columns:1fr}.visual{min-height:360px}.features{grid-template-columns:1fr}.trust{grid-template-columns:1fr}.ctabox{align-items:flex-start;flex-direction:column}.footerin{flex-direction:column}.mobile{position:fixed;left:10px;right:10px;bottom:10px;z-index:90;display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:8px;border-radius:21px;background:rgba(255,255,255,.94);backdrop-filter:blur(16px);box-shadow:0 18px 45px rgba(7,26,50,.22)}.mobile .btn{min-height:49px;padding:10px}.hero h1{font-size:clamp(2.8rem,14vw,4.8rem)}}@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style></head><body>${preview ? `<div class="preview">${esc(t.preview)}</div>` : ""}<nav class="nav"><div class="container navin"><a class="brand" href="#hero"><span class="brandmark">${mark}</span><span>${title}</span></a><div class="links" id="navlinks">${navHtml}</div><a class="navcta" href="${esc(waHref)}">💬 ${esc(nav.ctaButton?.text || t.contact)}</a><button class="menu" id="menu" aria-label="${esc(t.menu)}">☰</button></div></nav><main><section class="hero" id="hero"><div class="container"><div class="herogrid"><div><span class="badge">✦ ${esc(hero.badge || "Simple • Local • Mobile")}</span><h1>${esc(hero.headline || title)}</h1><p>${esc(hero.subheadline || meta.description || "")}</p><div class="actions"><a class="btn primary" href="${esc(hero.primaryCta?.link || "#features")}">→ ${esc(hero.primaryCta?.text || t.offer)}</a><a class="btn secondary" href="${esc(waHref)}">💬 ${esc(hero.secondaryCta?.text || t.contact)}</a></div></div><div><div class="visual">${visual}</div><div class="trust"><div>📱 ${esc(t.mobile)}</div><div>🛡️ ${esc(t.clear)}</div><div>✨ ${esc(t.local)}</div></div></div></div></div></section><section class="section" id="features"><div class="container"><div class="head"><span class="eyebrow">${esc(t.offer)}</span><h2>${esc(features.sectionTitle || t.offer)}</h2><p>${esc(features.sectionSubtitle || "")}</p></div><div class="features">${itemHtml}</div></div></section><section class="section about" id="about"><div class="container aboutgrid"><div><span class="eyebrow">${esc(t.about)}</span><h2>${esc(about.sectionTitle || `${t.about} ${title}`)}</h2><p>${esc(about.description || "")}</p></div><div class="values">${valueHtml}</div></div></section><section class="section" id="contact"><div class="container"><div class="head"><span class="eyebrow">${esc(t.direct)}</span><h2>${esc(contact.sectionTitle || t.contact)}</h2><p>${esc(contact.sectionSubtitle || "")}</p></div><div class="contactgrid"><div class="panel methods">${contactHtml || `<p>${esc(t.contact)}</p>`}</div><form class="panel" id="msg"><div class="field"><label for="customer">👤 ${esc(t.name)}</label><input id="customer" required autocomplete="name"></div><div class="field"><label for="message">💬 ${esc(t.need)}</label><textarea id="message" required></textarea></div><button class="btn primary" type="submit">${esc(t.send)}</button></form></div></div></section><section class="section"><div class="container"><div class="ctabox"><div><h2>${esc(cta.title || t.ready)}</h2><p>${esc(cta.subtitle || "")}</p></div><a class="btn secondary" href="${esc(waHref)}">${esc(cta.buttonText || t.contact)}</a></div></div></section></main><footer><div class="container footerin"><div><strong>${esc(footer.brandName || title)}</strong><br>${esc(footer.description || "")}</div><div>${esc(footer.copyright || "")}</div></div></footer><div class="mobile"><a class="btn secondary" href="${esc(phoneHref)}">📞 ${esc(t.call)}</a><a class="btn primary" href="${esc(waHref)}">💬 ${esc(t.whatsapp)}</a></div><script>(()=>{const menu=document.getElementById('menu'),links=document.getElementById('navlinks');menu?.addEventListener('click',()=>links?.classList.toggle('open'));links?.addEventListener('click',()=>links.classList.remove('open'));const form=document.getElementById('msg');form?.addEventListener('submit',e=>{e.preventDefault();const d='${String(wa?.value || "").replace(/\D/g, "")}';if(!d)return;const n=document.getElementById('customer').value.trim(),m=document.getElementById('message').value.trim();location.href='https://wa.me/'+d+'?text='+encodeURIComponent('Bonjour, je suis '+n+'. '+m)});})();</script></body></html>`;
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return allowed(origin) ? new Response(null, {
    status: 204,
    headers: baseHeaders(origin, "text/plain")
  }) : new Response("Forbidden", {
    status: 403
  });
  if (!allowed(origin)) return Response.json({
    ok: false,
    error: "Origin non autorisée."
  }, {
    status: 403,
    headers: baseHeaders(origin, "application/json; charset=utf-8")
  });
  if (![
    "GET",
    "HEAD"
  ].includes(req.method)) return new Response("Method Not Allowed", {
    status: 405,
    headers: baseHeaders(origin, "text/plain; charset=utf-8")
  });
  try {
    const url = new URL(req.url), siteId = clean(url.searchParams.get("site"), 80), previewValue = clean(url.searchParams.get("preview"), 300);
    if (!siteId) return Response.json({
      ok: true,
      service: "samabusiness-site-renderer-v12",
      version: VERSION,
      signedPreviewTokens: true
    }, {
      headers: baseHeaders(origin, "application/json; charset=utf-8")
    });
    const result = await db.from("sama_generated_sites").select("site_id,account_id,status,safety_status,site_config,updated_at").eq("site_id", siteId).maybeSingle();
    if (result.error) throw result.error;
    const row = result.data;
    if (!row) return new Response("Site introuvable", {
      status: 404,
      headers: baseHeaders(origin, "text/plain; charset=utf-8")
    });
    let preview = false;
    if (previewValue) {
      preview = true;
      if (previewValue === "1") {
        const account = await accountForPreview(req);
        if (account.role !== "admin" && account.id !== row.account_id) return new Response("Accès refusé", {
          status: 403,
          headers: baseHeaders(origin, "text/plain; charset=utf-8")
        });
      } else if (!await verifySignedPreview(siteId, row.updated_at, previewValue)) {
        return new Response("Lien d’aperçu expiré", {
          status: 403,
          headers: baseHeaders(origin, "text/plain; charset=utf-8")
        });
      }
    } else if (row.status !== "published" || row.safety_status !== "approved") {
      return new Response("Site indisponible", {
        status: 404,
        headers: baseHeaders(origin, "text/plain; charset=utf-8")
      });
    }
    const html = render(row.site_config, preview);
    return new Response(req.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        ...baseHeaders(origin, "text/html; charset=utf-8"),
        "cache-control": preview ? "private,no-store,no-cache,must-revalidate" : "public,max-age=60,stale-while-revalidate=300",
        "content-disposition": "inline",
        "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'self' https://wa.me; frame-ancestors 'self' https://samabusiness.dakarstyle.com https://samacahier.dakarstyle.com",
        "permissions-policy": "camera=(),microphone=(),geolocation=(),payment=()",
        "x-robots-tag": preview ? "noindex,nofollow,noarchive" : "index,follow"
      }
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    console.error("site-renderer-v12", status, status < 500 ? "handled" : error.message);
    return new Response(status === 401 ? "Connexion requise" : status === 403 ? "Accès refusé" : "Service indisponible", {
      status,
      headers: baseHeaders(origin, "text/plain; charset=utf-8")
    });
  }
});
