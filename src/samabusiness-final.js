import application from './worker-entry.js';

const VERSION = '10.4.0';
const HOSTS = new Set(['samabusiness.dakarstyle.com', 'samacahier.dakarstyle.com']);
const CANONICAL = 'https://samabusiness.dakarstyle.com';
const BRAND_SOURCE = 'https://dakarstyle.com/assets/samabusiness/samabusiness-192.webp?v=20260805';
const BRAND_ASSETS = new Set([
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/profile-256.png',
  '/apple-touch-icon.png',
  '/favicon-64.png',
]);

function secureHeaders(headers, html = false) {
  headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=()');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', html ? 'same-origin' : 'same-origin');
  headers.set('x-samabusiness-version', VERSION);
  headers.set('x-sama-version', VERSION);
  if (html) {
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    headers.set('pragma', 'no-cache');
  }
}

function manifest(origin) {
  const icon = (path, sizes, purpose = 'any') => ({
    src: `${origin}${path}?v=${VERSION}`,
    sizes,
    type: 'image/png',
    purpose,
  });
  return {
    id: `${origin}/`,
    name: 'SAMABUSINESS',
    short_name: 'SAMABUSINESS',
    description: 'Gestion simple des ventes, dettes, stock, dépenses, commandes WhatsApp, livraison et bénéfice réel.',
    start_url: `${origin}/?source=pwa`,
    scope: `${origin}/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#f5f8f6',
    theme_color: '#123c2f',
    lang: 'fr-SN',
    dir: 'ltr',
    orientation: 'portrait-primary',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      icon('/icon-192.png', '192x192'),
      icon('/icon-512.png', '512x512'),
      icon('/maskable-512.png', '512x512', 'maskable'),
    ],
    shortcuts: [
      { name: 'Nouvelle vente', short_name: 'Vente', url: `${origin}/?action=sale`, icons: [icon('/icon-192.png', '192x192')] },
      { name: 'Cahier et dettes', short_name: 'Dettes', url: `${origin}/?module=debts`, icons: [icon('/icon-192.png', '192x192')] },
      { name: 'Commande vocale', short_name: 'Vocal', url: `${origin}/?module=voice`, icons: [icon('/icon-192.png', '192x192')] },
    ],
    share_target: {
      action: `${origin}/share-voice`,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [{ name: 'audio', accept: ['audio/*', '.ogg', '.opus', '.m4a', '.aac', '.mp3', '.wav', '.webm', '.mp4'] }],
      },
    },
    related_applications: [],
    prefer_related_applications: false,
  };
}

function serviceWorker() {
  return `
const VERSION=${JSON.stringify(VERSION)};
const SHELL='samabusiness-shell-'+VERSION;
const SHARE='samabusiness-shares-v1';
const SHARED_AUDIO='/__samabusiness_shared_audio__';
const PRECACHE=['/','/manifest.webmanifest?v='+VERSION,'/icon-192.png?v='+VERSION,'/icon-512.png?v='+VERSION,'/maskable-512.png?v='+VERSION,'/profile-256.png?v='+VERSION,'/apple-touch-icon.png?v='+VERSION,'/favicon-64.png?v='+VERSION];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('samabusiness-shell-')&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
async function saveSharedVoice(request){
  try{
    const form=await request.formData();
    let file=form.get('audio');
    if(!(file instanceof File)){for(const value of form.values()){if(value instanceof File){file=value;break;}}}
    if(file instanceof File&&file.size>0){
      const headers=new Headers({'content-type':file.type||'application/octet-stream','x-sama-file-name':encodeURIComponent(file.name||'vocal-whatsapp'),'x-sama-file-size':String(file.size),'cache-control':'no-store'});
      await caches.open(SHARE).then(cache=>cache.put(SHARED_AUDIO,new Response(file,{headers})));
    }
  }catch(_){ }
  return Response.redirect(new URL('/?shared=voice',self.location.origin).toString(),303);
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method==='POST'&&url.origin===self.location.origin&&url.pathname==='/share-voice'){
    event.respondWith(saveSharedVoice(request));
    return;
  }
  if(request.method!=='GET')return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put('/',copy)).catch(()=>{});}return response;}).catch(()=>caches.match('/')));
    return;
  }
  if(url.origin===self.location.origin&&['/manifest.webmanifest','/icon-192.png','/icon-512.png','/maskable-512.png','/profile-256.png','/apple-touch-icon.png','/favicon-64.png'].includes(url.pathname)){
    event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put(request,copy)).catch(()=>{});}return response;})));
  }
});`;
}

async function serveFavicon(request, env) {
  const assetUrl = new URL('/assets/samabusiness/samabusiness-official-favicon-64.png', request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method, headers: request.headers }));
  if (!response.ok) return serveBrandImage(request, 64, false);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'image/png');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  secureHeaders(headers, false);
  headers.delete('set-cookie');
  return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
}

async function serveBrandImage(request, size, maskable = false) {
  try {
    const response = await fetch(BRAND_SOURCE, {
      cf: {
        image: {
          format: 'png',
          width: size,
          height: size,
          fit: maskable ? 'contain' : 'cover',
          background: '#071a32',
          quality: 100,
          metadata: 'none',
        },
      },
    });
    if (!response.ok) throw new Error(`brand_transform_${response.status}`);
    const headers = new Headers(response.headers);
    headers.set('content-type', 'image/png');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    secureHeaders(headers, false);
    headers.delete('set-cookie');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
  } catch (_) {
    const inset = maskable ? Math.round(size * 0.14) : 0;
    const imageSize = size - (inset * 2);
    const radius = Math.round(size * 0.18);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#071a32"/><image href="${BRAND_SOURCE}" x="${inset}" y="${inset}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet"/></svg>`;
    const headers = new Headers({
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=900',
      'x-content-type-options': 'nosniff',
    });
    secureHeaders(headers, false);
    return new Response(request.method === 'HEAD' ? null : svg, { status: 200, headers });
  }
}

async function brandAssetResponse(request, env, url) {
  if (url.pathname === '/favicon-64.png') return serveFavicon(request, env);
  if (url.pathname === '/icon-192.png') return serveBrandImage(request, 192, false);
  if (url.pathname === '/icon-512.png') return serveBrandImage(request, 512, false);
  if (url.pathname === '/maskable-512.png') return serveBrandImage(request, 512, true);
  if (url.pathname === '/profile-256.png') return serveBrandImage(request, 256, false);
  if (url.pathname === '/apple-touch-icon.png') return serveBrandImage(request, 180, false);
  return new Response('Not Found', { status: 404 });
}

function identityInjection() {
  return `<link rel="icon" href="/favicon-64.png?v=${VERSION}" sizes="64x64" type="image/png" data-samabusiness-brand="${VERSION}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${VERSION}" sizes="180x180" data-samabusiness-brand="${VERSION}">
<meta property="og:image" content="${CANONICAL}/profile-256.png?v=${VERSION}">
<style data-samabusiness-brand-style="${VERSION}">
.samabusiness-brand-profile{display:flex;flex-direction:column;align-items:center;gap:9px;margin:0 auto 18px;text-align:center}.samabusiness-brand-profile img{width:92px;height:92px;border-radius:24px;object-fit:cover;box-shadow:0 12px 34px rgba(7,26,50,.22);border:1px solid rgba(183,134,11,.35)}.samabusiness-brand-profile strong{font-size:18px;letter-spacing:.01em;color:#0b2d22}.samabusiness-brand-profile span{font-size:12px;color:#61736c}
</style>
<script data-samabusiness-brand-bootstrap="${VERSION}">(()=>{const V='${VERSION}',P='/profile-256.png?v='+V;window.__SAMABUSINESS_BRAND__={version:V,profile:P,icon:'/icon-192.png?v='+V};const install=()=>{const auth=document.querySelector('#authScreen');if(!auth||auth.querySelector('.samabusiness-brand-profile'))return;const host=auth.querySelector('.auth-card')||auth;const block=document.createElement('div');block.className='samabusiness-brand-profile';block.innerHTML='<img src="'+P+'" alt="SAMABUSINESS"><strong>SAMABUSINESS</strong><span>Votre commerce, simplement</span>';host.prepend(block);};const refresh=()=>{document.querySelectorAll('[data-samabusiness-profile],.samabusiness-profile-image').forEach(img=>{if(img.tagName==='IMG'&&!img.getAttribute('src'))img.src=P;});install();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js?v='+V,{scope:'/',updateViaCache:'none'}).then(r=>r.update().catch(()=>{})).catch(()=>{});})();</script>`;
}

function upgradeHtml(html) {
  let output = html
    .replaceAll('v=10.3.0', `v=${VERSION}`)
    .replaceAll('data-samabusiness-manifest="10.3.0"', `data-samabusiness-manifest="${VERSION}"`)
    .replaceAll('data-samabusiness-pwa-bootstrap="10.3.0"', `data-samabusiness-pwa-bootstrap="${VERSION}"`);
  if (!output.includes('data-samabusiness-brand-bootstrap')) {
    output = /<\/head>/i.test(output)
      ? output.replace(/<\/head>/i, `${identityInjection()}</head>`)
      : `${identityInjection()}${output}`;
  }
  return output;
}

function isHealth(url) {
  return url.pathname === '/health' || String(url.searchParams.get('mode') || '').toLowerCase() === 'health';
}

function isHtml(response, url) {
  if (isHealth(url) || url.pathname === '/manifest.webmanifest' || url.pathname === '/sw.js' || BRAND_ASSETS.has(url.pathname)) return false;
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!HOSTS.has(url.hostname)) return application.fetch(request, env, ctx);

    if (request.method === 'OPTIONS') {
      const response = await application.fetch(request, env, ctx);
      const headers = new Headers(response.headers);
      secureHeaders(headers, false);
      return new Response(null, { status: response.status, headers });
    }

    if (url.pathname === '/manifest.webmanifest') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      const headers = new Headers({
        'content-type': 'application/manifest+json; charset=utf-8',
        'cache-control': 'no-cache, must-revalidate',
      });
      secureHeaders(headers, false);
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(manifest(url.origin)), { status: 200, headers });
    }

    if (url.pathname === '/sw.js') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      const headers = new Headers({
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
        'service-worker-allowed': '/',
      });
      secureHeaders(headers, false);
      return new Response(request.method === 'HEAD' ? null : serviceWorker(), { status: 200, headers });
    }

    if (BRAND_ASSETS.has(url.pathname)) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      return brandAssetResponse(request, env, url);
    }

    const upstream = await application.fetch(request, env, ctx);
    const headers = new Headers(upstream.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('set-cookie');

    if (isHealth(url)) {
      let payload = {};
      if (request.method !== 'HEAD') {
        try { payload = await upstream.clone().json(); } catch (_) { payload = {}; }
      }
      const body = {
        ...payload,
        ok: payload.ok !== false,
        app: 'SAMABUSINESS',
        version: VERSION,
        domain: url.hostname,
        canonical: CANONICAL,
        checked_at: new Date().toISOString(),
      };
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('cache-control', 'no-store');
      secureHeaders(headers, false);
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(body), { status: upstream.ok ? 200 : upstream.status, headers });
    }

    const html = isHtml(upstream, url);
    secureHeaders(headers, html);
    if (!html || request.method === 'HEAD') return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });

    headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(upgradeHtml(await upstream.text()), { status: upstream.status, statusText: upstream.statusText, headers });
  },
};
