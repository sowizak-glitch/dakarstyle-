const API_BACKEND = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio';
const COMPATIBILITY = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-platform';
const RENDERER = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-renderer-v12';
const COMMERCE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-commerce-v13';
const VERSION = '13.0.0';
const PLATFORM_HOSTS = new Set(['samabusiness.dakarstyle.com', 'www.samabusiness.dakarstyle.com', 'samacahier.dakarstyle.com']);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
function money(value) {
  return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('fr-FR')} F CFA`;
}
function sameOriginSiteUrl(value, origin) {
  if (typeof value !== 'string') return value;
  try {
    const source = new URL(value);
    const base = `${source.origin}${source.pathname}`;
    if (![API_BACKEND, COMPATIBILITY, RENDERER].includes(base)) return value;
    const site = source.searchParams.get('site');
    if (!site) return `${origin}/api/site-platform`;
    const target = new URL(`${origin}/sites/${encodeURIComponent(site)}`);
    const preview = source.searchParams.get('preview');
    if (preview) target.searchParams.set('preview', preview);
    return target.toString();
  } catch (_) {
    return value;
  }
}
function rewrite(value, origin) {
  if (typeof value === 'string') return sameOriginSiteUrl(value, origin);
  if (Array.isArray(value)) return value.map((item) => rewrite(item, origin));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = rewrite(item, origin);
    return output;
  }
  return value;
}
function commonHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-samabusiness-site-platform': VERSION,
  };
}
function apiHeaders(request, includeContentType = true) {
  const headers = new Headers({ 'x-client-info': request.headers.get('x-client-info') || `cloudflare-site-proxy/${VERSION}` });
  const session = request.headers.get('x-sama-session');
  if (session) headers.set('x-sama-session', session);
  const contentType = request.headers.get('content-type');
  if (includeContentType && contentType) headers.set('content-type', contentType);
  return headers;
}
async function upstreamFetch(target, init) {
  try {
    return await fetch(target, init);
  } catch (_) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await fetch(target, init);
  }
}
async function proxyApi(request, url, target, rewriteResponse = false) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...commonHeaders(),
        'access-control-allow-origin': url.origin,
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-sama-session,x-client-info',
        'access-control-max-age': '86400',
      },
    });
  }
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: commonHeaders() });
  const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
  const targetUrl = new URL(target);
  if (request.method === 'GET') for (const [key, value] of url.searchParams) targetUrl.searchParams.set(key, value);
  const upstream = await upstreamFetch(targetUrl, {
    method: request.method,
    headers: apiHeaders(request),
    body,
    cache: 'no-store',
  });
  const text = await upstream.text();
  let responseText = text;
  if (rewriteResponse) {
    try { responseText = JSON.stringify(rewrite(JSON.parse(text), url.origin)); }
    catch (_) { responseText = JSON.stringify({ ok: false, error: 'Réponse serveur invalide.', code: 'INVALID_RESPONSE' }); }
  }
  const headers = new Headers(commonHeaders());
  headers.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');
  headers.set('access-control-allow-origin', url.origin);
  headers.set('vary', 'Origin');
  return new Response(responseText, { status: upstream.status, headers });
}
async function commerceJson(action, payload, session = '') {
  const headers = new Headers({ 'content-type': 'application/json', 'x-client-info': `cloudflare-catalog/${VERSION}` });
  if (session) headers.set('x-sama-session', session);
  const response = await upstreamFetch(COMMERCE, {
    method: 'POST', headers, body: JSON.stringify({ action, payload }), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Réponse commerce invalide.' }));
  return { response, data };
}
function normalizePreviewCatalog(data, siteId) {
  const site = (data.sites || []).find((item) => item.site_id === siteId);
  if (!site) return { site: null, products: [] };
  const products = (data.products || []).filter((item) => item.generated_site_id === site.id && item.publish_status !== 'archived');
  const media = data.media || [];
  return {
    site,
    products: products.map((product) => ({
      ...product,
      media: media.filter((item) => item.site_product_id === product.id && item.public_url),
      variants: [],
      stock: null,
    })),
  };
}
async function catalogForRequest(siteId, isPreview, session) {
  if (isPreview && session) {
    const { response, data } = await commerceJson('bootstrap', {}, session);
    if (response.ok && data.ok) return { ok: true, ...normalizePreviewCatalog(data, siteId) };
  }
  const { response, data } = await commerceJson('public_catalog', { siteId });
  if (!response.ok || !data.ok) return { ok: false, status: response.status, error: data.error || 'Boutique indisponible.' };
  return { ok: true, site: data.site, products: data.products || [], paymentMethods: data.paymentMethods || [] };
}
function catalogMarkup(siteId, catalog, preview) {
  const products = catalog.products || [];
  const cards = products.map((product) => {
    const image = product.media?.[0]?.public_url || product.media?.[0]?.url || '';
    const available = !product.stock?.track_stock || Number(product.stock?.stock_quantity || 0) > 0;
    const state = preview
      ? `<span class="sc-state">${escapeHtml(product.publish_status || 'brouillon')} · ${escapeHtml(product.safety_status || 'à vérifier')}</span>`
      : available ? '<span class="sc-ok">Disponible</span>' : '<span class="sc-no">Épuisé</span>';
    const variants = (product.variants || []).map((variant) => `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.name)}${Number(variant.price_delta || 0) ? ` (+${money(variant.price_delta)})` : ''}</option>`).join('');
    return `<article class="sc-card" data-product="${escapeHtml(product.id)}"><div class="sc-photo">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.media?.[0]?.alt_text || product.display_name)}" loading="lazy">` : '<div class="sc-placeholder"><b>📦</b><span>Photo en validation</span></div>'}${state}</div><div class="sc-body"><small>${escapeHtml(product.category || 'Produit')}</small><h3>${escapeHtml(product.display_name)}</h3><p>${escapeHtml(product.short_description || 'Informations disponibles auprès du vendeur.')}</p><div class="sc-price"><strong>${money(product.display_price)}</strong>${product.compare_at_price ? `<del>${money(product.compare_at_price)}</del>` : ''}</div>${variants ? `<label>Option<select>${variants}</select></label>` : ''}<button type="button" data-add="${escapeHtml(product.id)}" ${preview || !available ? 'disabled' : ''}>${preview ? 'Aperçu uniquement' : available ? '＋ Ajouter' : 'Indisponible'}</button></div></article>`;
  }).join('');
  const data = products.map((product) => ({
    id: product.id, name: product.display_name, price: Number(product.display_price || 0),
    variants: (product.variants || []).map((variant) => ({ id: variant.id, name: variant.name, delta: Number(variant.price_delta || 0) })),
  }));
  return `<style>
.scatalog{padding:78px 0;background:linear-gradient(180deg,var(--bg,#f7faf8),color-mix(in srgb,var(--p,#087a45) 4%,var(--bg,#f7faf8)))}.sc-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:26px}.sc-head h2{font-size:clamp(2.2rem,6vw,4.5rem);line-height:.95;letter-spacing:-.06em;margin:7px 0}.sc-head p{margin:0;color:var(--muted,#667085)}.sc-count{padding:9px 13px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.1);font-weight:900}.sc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px}.sc-card{overflow:hidden;border-radius:27px;background:#fff;border:1px solid rgba(0,0,0,.1);box-shadow:0 18px 50px rgba(7,26,50,.08);display:flex;flex-direction:column}.sc-photo{aspect-ratio:4/3;position:relative;background:linear-gradient(145deg,#e9f6ef,#fff1bb);overflow:hidden}.sc-photo img{width:100%;height:100%;object-fit:cover}.sc-placeholder{height:100%;display:grid;place-items:center;align-content:center;gap:7px}.sc-placeholder b{font-size:4rem}.sc-placeholder span{font-weight:900}.sc-state,.sc-ok,.sc-no{position:absolute;left:13px;top:13px;padding:7px 10px;border-radius:999px;background:#fff;font-size:11px;font-weight:950;box-shadow:0 8px 22px rgba(0,0,0,.12)}.sc-ok{color:#087a45}.sc-no{color:#a1261d}.sc-state{color:#725300}.sc-body{padding:19px;display:flex;flex:1;flex-direction:column}.sc-body>small{color:var(--p,#087a45);font-weight:950;text-transform:uppercase;letter-spacing:.07em}.sc-body h3{margin:8px 0;font-size:1.28rem}.sc-body p{margin:0 0 14px;color:var(--muted,#667085)}.sc-price{display:flex;align-items:center;gap:9px;margin:auto 0 11px}.sc-price strong{font-size:1.22rem}.sc-price del{color:#667085;font-size:.8rem}.sc-body label{display:grid;gap:5px;margin-bottom:9px;font-size:12px;font-weight:900}.sc-body select{padding:10px;border:1px solid #ddd;border-radius:12px}.sc-body button{min-height:48px;border:0;border-radius:15px;background:var(--p,#087a45);color:#fff;font-weight:950}.sc-body button:disabled{opacity:.45}.sc-empty{grid-column:1/-1;padding:44px;text-align:center;border:2px dashed rgba(8,122,69,.24);border-radius:27px;background:#fff}.sc-empty b{font-size:4rem}.sc-cart-btn{position:fixed;right:18px;bottom:86px;z-index:96;min-width:60px;height:60px;padding:0 18px;border:0;border-radius:20px;background:var(--p,#087a45);color:#fff;font-weight:950;box-shadow:0 18px 45px rgba(8,122,69,.3)}.sc-overlay{display:none;position:fixed;inset:0;z-index:140;background:rgba(5,18,32,.62);align-items:flex-end;justify-content:center;padding:14px}.sc-overlay.open{display:flex}.sc-sheet{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:30px;padding:22px}.sc-sheet-head{display:flex;justify-content:space-between;align-items:center}.sc-sheet-head button{width:44px;height:44px;border:1px solid #ddd;background:#fff;border-radius:14px;font-size:24px}.sc-items{display:grid;gap:9px;margin:15px 0}.sc-item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-radius:15px;background:#f5f7f6}.sc-item button{border:0;background:transparent;font-size:20px}.sc-total{display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid #ddd;font-weight:950}.sc-form{display:grid;gap:9px}.sc-form input{padding:14px;border:2px solid #e3e7e5;border-radius:15px}.sc-send{min-height:54px;border:0;border-radius:17px;background:#087a45;color:#fff;font-weight:950}.sc-note{text-align:center;color:#667085;font-size:12px}@media(max-width:900px){.sc-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.scatalog{padding:52px 0}.sc-head{align-items:flex-start;flex-direction:column}.sc-grid{grid-template-columns:1fr}.sc-cart-btn{bottom:78px}.sc-sheet{border-radius:25px}}
</style><section class="scatalog" id="catalogue"><div class="container"><div class="sc-head"><div><span class="eyebrow">Catalogue visuel</span><h2>${preview ? 'Aperçu des produits' : 'Choisissez simplement'}</h2><p>${preview ? 'Les produits et les photos restent privés jusqu’à leur validation.' : 'Choisissez les articles et envoyez une commande structurée sur WhatsApp.'}</p></div><span class="sc-count">${products.length} article${products.length > 1 ? 's' : ''}</span></div><div class="sc-grid">${cards || (preview ? '<div class="sc-empty"><b>🛍️</b><h3>Ajoutez votre premier produit</h3><p>Nom, prix et photo suffisent. La photo sera vérifiée avant publication.</p></div>' : '')}</div></div></section>${preview ? '' : `<button class="sc-cart-btn" id="sc-cart-btn">🛒 <span id="sc-count">0</span></button><div class="sc-overlay" id="sc-overlay"><div class="sc-sheet"><div class="sc-sheet-head"><div><small>Commande rapide</small><h2>Votre sélection</h2></div><button type="button" id="sc-close">×</button></div><div class="sc-items" id="sc-items"></div><div class="sc-total"><span>Total</span><span id="sc-total">0 F CFA</span></div><form class="sc-form" id="sc-form"><input name="name" required placeholder="👤 Votre nom"><input name="phone" required inputmode="tel" placeholder="📞 Votre téléphone"><input name="area" placeholder="📍 Quartier ou ville"><input name="address" placeholder="🏠 Adresse / point de repère"><button class="sc-send" type="submit">💬 Commander sur WhatsApp</button><div class="sc-note">Aucun compte client requis. La commande est envoyée directement au vendeur.</div></form></div></div><script>window.__SAMA_STORE_PRODUCTS__=${safeJson(data)};window.__SAMA_STORE_SITE__=${safeJson(siteId)};</script><script>(()=>{const products=new Map((window.__SAMA_STORE_PRODUCTS__||[]).map(p=>[p.id,p]));const cart=[];const fmt=n=>Math.round(n).toLocaleString('fr-FR')+' F CFA';const overlay=document.getElementById('sc-overlay'),items=document.getElementById('sc-items'),count=document.getElementById('sc-count'),total=document.getElementById('sc-total');function render(){items.innerHTML=cart.length?cart.map((x,i)=>'<div class="sc-item"><div><strong>'+x.name+'</strong><br><small>'+x.quantity+' × '+fmt(x.price)+(x.variantName?' · '+x.variantName:'')+'</small></div><button data-remove="'+i+'">×</button></div>').join(''):'<p>Votre sélection est vide.</p>';count.textContent=String(cart.reduce((a,x)=>a+x.quantity,0));total.textContent=fmt(cart.reduce((a,x)=>a+x.quantity*x.price,0))}document.addEventListener('click',e=>{const add=e.target.closest('[data-add]');if(add){const p=products.get(add.dataset.add),card=add.closest('[data-product]'),select=card.querySelector('select'),variant=p?.variants?.find(v=>v.id===select?.value);if(!p)return;const current=cart.find(x=>x.siteProductId===p.id&&x.variantId===(variant?.id||''));if(current)current.quantity++;else cart.push({siteProductId:p.id,name:p.name,quantity:1,variantId:variant?.id||'',variantName:variant?.name||'',price:p.price+(variant?.delta||0)});render();overlay.classList.add('open')}const remove=e.target.closest('[data-remove]');if(remove){cart.splice(Number(remove.dataset.remove),1);render()}if(e.target.id==='sc-cart-btn')overlay.classList.add('open');if(e.target.id==='sc-close'||e.target===overlay)overlay.classList.remove('open')});document.getElementById('sc-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!cart.length)return alert('Ajoutez un produit.');const button=e.submitter;button.disabled=true;button.textContent='Préparation…';try{const customer=Object.fromEntries(new FormData(e.target));const response=await fetch('/api/site-commerce',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'create_public_order',payload:{siteId:window.__SAMA_STORE_SITE__,items:cart,customer,deliveryRequired:true,paymentMethod:'cash'}})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Commande indisponible');location.href=result.whatsappUrl}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='💬 Commander sur WhatsApp'}});render()})();</script>`}`;
}
function injectCatalog(html, siteId, catalog, preview) {
  const markup = catalogMarkup(siteId, catalog, preview);
  if (!markup) return html;
  return html.includes('</main>') ? html.replace('</main>', `${markup}</main>`) : html.replace('</body>', `${markup}</body>`);
}
async function sitePage(request, url, forcedSite = '') {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: commonHeaders() });
  const pathSite = url.pathname.startsWith('/sites/') ? decodeURIComponent(url.pathname.slice('/sites/'.length)) : '';
  const site = forcedSite || pathSite || url.searchParams.get('site') || '';
  if (!site || !/^[a-z0-9][a-z0-9-]{1,79}$/i.test(site)) return new Response('Site introuvable', { status: 404, headers: { ...commonHeaders(), 'content-type': 'text/plain; charset=utf-8' } });
  const previewToken = url.searchParams.get('preview') || '';
  const isPreview = Boolean(previewToken);
  const session = request.headers.get('x-sama-session') || '';
  const endpoint = `${RENDERER}?site=${encodeURIComponent(site)}${isPreview ? `&preview=${encodeURIComponent(previewToken)}` : ''}`;
  const upstreamHeaders = new Headers({ 'x-client-info': `cloudflare-site-renderer/${VERSION}`, 'x-samabusiness-render-proxy': '1' });
  if (session) upstreamHeaders.set('x-sama-session', session);
  const upstream = await upstreamFetch(endpoint, { method: request.method, headers: upstreamHeaders, cache: isPreview ? 'no-store' : 'no-cache' });
  let body = request.method === 'HEAD' ? null : await upstream.text();
  let status = upstream.status;
  if (upstream.ok && request.method === 'GET') {
    const catalog = await catalogForRequest(site, isPreview, session);
    if (!catalog.ok && !isPreview) {
      status = catalog.status || 404;
      body = catalog.error || 'Site indisponible';
    } else if (catalog.ok) body = injectCatalog(body, site, catalog, isPreview);
  }
  const responseHeaders = new Headers(commonHeaders());
  responseHeaders.set('content-type', status >= 200 && status < 300 ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
  responseHeaders.set('content-disposition', 'inline');
  responseHeaders.set('cache-control', isPreview ? 'private, no-store, no-cache, must-revalidate' : 'public, max-age=60, stale-while-revalidate=300');
  responseHeaders.set('cross-origin-resource-policy', 'same-origin');
  responseHeaders.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  responseHeaders.set('content-security-policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'self' https://wa.me; frame-ancestors 'self' https://samabusiness.dakarstyle.com https://samacahier.dakarstyle.com");
  responseHeaders.set('x-robots-tag', isPreview ? 'noindex, nofollow, noarchive' : 'index, follow');
  responseHeaders.delete('x-frame-options');responseHeaders.delete('content-length');responseHeaders.delete('content-encoding');responseHeaders.delete('set-cookie');
  return new Response(body, { status, headers: responseHeaders });
}
async function customDomainPage(request, url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const { response, data } = await commerceJson('resolve_domain', { host });
  if (!response.ok || !data.ok || !data.siteId) return new Response('Site introuvable', { status: 404, headers: { ...commonHeaders(), 'content-type': 'text/plain; charset=utf-8' } });
  return sitePage(request, url, data.siteId);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/site-platform') return await proxyApi(request, url, API_BACKEND, true);
      if (url.pathname === '/api/site-commerce') return await proxyApi(request, url, COMMERCE, false);
      if (url.pathname === '/site-preview' || url.pathname.startsWith('/sites/')) return await sitePage(request, url);
      if (url.pathname === '/site-platform-health') return Response.json({ ok: true, service: 'samabusiness-site-proxy', version: VERSION, renderer: '12.2.0', commerce: '13.0.0', catalogInjection: true, customDomains: true, signedPreviewTokens: true }, { headers: { ...commonHeaders(), 'cache-control': 'no-store' } });
      if (!PLATFORM_HOSTS.has(url.hostname.toLowerCase()) && (url.pathname === '/' || url.pathname === '/index.html')) return await customDomainPage(request, url);
      return new Response('Not Found', { status: 404, headers: commonHeaders() });
    } catch (error) {
      console.error('samabusiness-site-proxy', error);
      return Response.json({ ok: false, error: 'Service temporairement indisponible.' }, { status: 503, headers: { ...commonHeaders(), 'cache-control': 'no-store' } });
    }
  },
};
