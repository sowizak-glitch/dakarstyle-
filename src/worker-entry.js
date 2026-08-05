import application from './legacy-index.js';

const SAMABUSINESS_HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

const VERSION = '10.3.0';
const FIELD_UX_URL = `https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-field-ux?v=${VERSION}`;
const OFFICIAL_LOGO = 'https://dakarstyle.com/assets/samabusiness/samabusiness-192.webp?v=20260803';
const AUDIO_API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-audio-api';

const SAMABUSINESS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://xmdpmtvieqgoorbxytey.supabase.co https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://dakarstyle.com https://www.dakarstyle.com",
  "font-src 'self' data: https:",
  `connect-src 'self' https://xmdpmtvieqgoorbxytey.supabase.co wss://xmdpmtvieqgoorbxytey.supabase.co ${AUDIO_API}`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

function manifest(origin) {
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
      { src: `${origin}/icon-192.png?v=${VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/icon-512.png?v=${VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${origin}/maskable-512.png?v=${VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nouvelle vente', short_name: 'Vente', url: `${origin}/?action=sale`, icons: [{ src: `${origin}/icon-192.png?v=${VERSION}`, sizes: '192x192', type: 'image/png' }] },
      { name: 'Cahier et dettes', short_name: 'Dettes', url: `${origin}/?module=debts`, icons: [{ src: `${origin}/icon-192.png?v=${VERSION}`, sizes: '192x192', type: 'image/png' }] },
      { name: 'Commande vocale', short_name: 'Vocal', url: `${origin}/?module=voice`, icons: [{ src: `${origin}/icon-192.png?v=${VERSION}`, sizes: '192x192', type: 'image/png' }] },
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
const PRECACHE=['/','/manifest.webmanifest?v='+VERSION,'/icon-192.png?v='+VERSION,'/icon-512.png?v='+VERSION,'/maskable-512.png?v='+VERSION];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)).catch(()=>{}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('samabusiness-shell-')&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
async function saveSharedVoice(request){
  try{
    const form=await request.formData();
    let file=form.get('audio');
    if(!(file instanceof File)){
      for(const value of form.values()){if(value instanceof File){file=value;break;}}
    }
    if(file instanceof File && file.size>0){
      const headers=new Headers({'content-type':file.type||'application/octet-stream','x-sama-file-name':encodeURIComponent(file.name||'vocal-whatsapp'),'x-sama-file-size':String(file.size),'cache-control':'no-store'});
      await caches.open(SHARE).then(cache=>cache.put(SHARED_AUDIO,new Response(file,{headers})));
    }
  }catch(_){ }
  return Response.redirect(new URL('/?shared=voice',self.location.origin).toString(),303);
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method==='POST' && url.origin===self.location.origin && url.pathname==='/share-voice'){
    event.respondWith(saveSharedVoice(request));
    return;
  }
  if(request.method!=='GET') return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put('/',copy)).catch(()=>{});}return response;}).catch(()=>caches.match('/')));
    return;
  }
  if(url.origin===self.location.origin && ['/manifest.webmanifest','/icon-192.png','/icon-512.png','/maskable-512.png'].includes(url.pathname)){
    event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put(request,copy)).catch(()=>{});}return response;})));
  }
});
`;
}

function isPwaAsset(url) {
  return ['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/maskable-512.png'].includes(url.pathname);
}

async function serveIcon(size, maskable = false) {
  try {
    const response = await fetch(OFFICIAL_LOGO, {
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
    if (!response.ok) throw new Error(`icon_transform_${response.status}`);
    const headers = new Headers(response.headers);
    headers.set('content-type', 'image/png');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('cross-origin-resource-policy', 'same-origin');
    headers.set('x-samabusiness-version', VERSION);
    headers.delete('set-cookie');
    return new Response(response.body, { status: 200, headers });
  } catch (_) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#071a32"/><image href="${OFFICIAL_LOGO}" x="${maskable ? 72 : 0}" y="${maskable ? 72 : 0}" width="${maskable ? 368 : 512}" height="${maskable ? 368 : 512}" preserveAspectRatio="xMidYMid meet"/></svg>`;
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'x-samabusiness-version': VERSION,
      },
    });
  }
}

function pwaAssetResponse(request, url) {
  const origin = url.origin;
  if (url.pathname === '/manifest.webmanifest') {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify(manifest(origin)), {
      headers: {
        'content-type': 'application/manifest+json; charset=utf-8',
        'cache-control': 'no-cache, must-revalidate',
        'x-content-type-options': 'nosniff',
        'cross-origin-resource-policy': 'same-origin',
        'x-samabusiness-version': VERSION,
      },
    });
  }
  if (url.pathname === '/sw.js') {
    return new Response(request.method === 'HEAD' ? null : serviceWorker(), {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
        'service-worker-allowed': '/',
        'x-content-type-options': 'nosniff',
        'cross-origin-resource-policy': 'same-origin',
        'x-samabusiness-version': VERSION,
      },
    });
  }
  if (request.method === 'HEAD') {
    return new Response(null, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'x-samabusiness-version': VERSION,
      },
    });
  }
  if (url.pathname === '/icon-192.png') return serveIcon(192, false);
  if (url.pathname === '/icon-512.png') return serveIcon(512, false);
  return serveIcon(512, true);
}

function isSamabusinessHtmlRoute(url) {
  const mode = String(url.searchParams.get('mode') || '').toLowerCase();
  const nonHtmlModes = new Set(['health', 'manifest', 'sw', 'icon', 'logo']);
  const nonHtmlPaths = new Set([
    '/health',
    '/manifest.webmanifest',
    '/sw.js',
    '/icon.svg',
    '/icon-192.png',
    '/icon-512.png',
    '/maskable-512.png',
    '/logo.webp',
  ]);
  return !nonHtmlModes.has(mode) && !nonHtmlPaths.has(url.pathname);
}

function pwaHead() {
  return `<link rel="manifest" href="/manifest.webmanifest?v=${VERSION}" data-samabusiness-manifest="${VERSION}">
<link rel="icon" href="/icon-192.png?v=${VERSION}" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/icon-192.png?v=${VERSION}" sizes="192x192">
<meta name="theme-color" content="#123c2f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="application-name" content="SAMABUSINESS">
<script data-samabusiness-pwa-bootstrap="${VERSION}">(()=>{const V='${VERSION}';const register=()=>{if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js?v='+V,{scope:'/',updateViaCache:'none'}).then(r=>r.update().catch(()=>{})).catch(()=>{});}};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__SAMA_PWA_PROMPT=e;window.dispatchEvent(new CustomEvent('samabusiness-install-ready'));});window.addEventListener('appinstalled',()=>{window.__SAMA_PWA_PROMPT=null;window.dispatchEvent(new CustomEvent('samabusiness-installed'));});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',register,{once:true});else register();window.addEventListener('load',()=>setTimeout(register,300),{once:true});setTimeout(register,1400);})();</script>`;
}

function injectFieldUx(html) {
  let output = html;
  if (!output.includes('data-samabusiness-manifest')) {
    if (/<\/head>/i.test(output)) output = output.replace(/<\/head>/i, `${pwaHead()}</head>`);
    else output = `${pwaHead()}${output}`;
  }
  if (!output.includes('data-samabusiness-field-ux')) {
    const tag = `<script defer src="${FIELD_UX_URL}" crossorigin="anonymous" data-samabusiness-field-ux="${VERSION}"></script>`;
    if (/<\/body>/i.test(output)) output = output.replace(/<\/body>/i, `${tag}</body>`);
    else output = `${output}${tag}`;
  }
  return output;
}

function applySecurityHeaders(headers, htmlRoute) {
  headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=()');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('origin-agent-cluster', '?1');
  headers.set('x-permitted-cross-domain-policies', 'none');
  headers.set('x-dns-prefetch-control', 'off');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  headers.set('x-samabusiness-version', VERSION);
  if (htmlRoute) {
    headers.set('content-security-policy', SAMABUSINESS_CSP);
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    headers.set('pragma', 'no-cache');
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isSamabusiness = SAMABUSINESS_HOSTS.has(url.hostname);

    if (isSamabusiness && isPwaAsset(url)) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      return await pwaAssetResponse(request, url);
    }

    const response = await application.fetch(request, env, ctx);
    if (!isSamabusiness) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');

    const htmlRoute = isSamabusinessHtmlRoute(url);
    const upstreamContentType = headers.get('content-type') || '';
    let body = response.body;

    if (htmlRoute) {
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('x-samabusiness-content-type-repaired', upstreamContentType || 'missing');
      headers.set('x-samabusiness-field-ux', VERSION);
      if (request.method !== 'HEAD') body = injectFieldUx(await response.text());
    }

    applySecurityHeaders(headers, htmlRoute);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('set-cookie');

    return new Response(request.method === 'HEAD' ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
