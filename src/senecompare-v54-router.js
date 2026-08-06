import application from './senecompare-v5-router.js';

const RELEASE = '5.4.0';
const MEDIA_EDGE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-media-v54';
const MEDIA = new Map([
  ['/media/samabusiness-campaign.webp', 'samabusiness-campaign.webp'],
  ['/media/sowhat-africa-campaign.webp', 'sowhat-africa-campaign.webp'],
]);
const FILES = new Map([
  ['/premium-ads-v54.css', { source: '/senecompare/premium-ads-v54.css', type: 'text/css; charset=utf-8' }],
  ['/premium-ads-v54.js', { source: '/senecompare/premium-ads-v54.js', type: 'application/javascript; charset=utf-8' }],
  ['/admin-auth-v54.css', { source: '/senecompare/admin-auth-v54.css', type: 'text/css; charset=utf-8' }],
  ['/admin-auth-v54.js', { source: '/senecompare/admin-auth-v54.js', type: 'application/javascript; charset=utf-8' }],
]);

function assetRequest(request, source) {
  const url = new URL(request.url);
  url.pathname = source;
  url.search = '';
  return new Request(url, { method: 'GET', headers: { Accept: request.headers.get('Accept') || '*/*' } });
}

function releaseHeaders(source, type = '') {
  const headers = new Headers(source);
  if (type) headers.set('Content-Type', type);
  headers.set('X-SeneCompare-Release', RELEASE);
  headers.set('X-SeneCompare-Premium-Ads', 'campaign-media-v54');
  headers.set('X-SeneCompare-Admin-Auth', 'secure-link-recovery-v54');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

async function serveLocal(request, env, descriptor) {
  if (!env?.ASSETS?.fetch) return null;
  const asset = await env.ASSETS.fetch(assetRequest(request, descriptor.source));
  if (!asset.ok) return null;
  const headers = releaseHeaders(asset.headers, descriptor.type);
  headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
}

async function serveMedia(request, filename) {
  const target = `${MEDIA_EDGE}/${filename}`;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Accept: request.headers.get('Accept') || 'image/webp,image/*;q=0.8,*/*;q=0.5',
        'If-None-Match': request.headers.get('If-None-Match') || '',
        'User-Agent': request.headers.get('User-Agent') || `SeneCompare/${RELEASE}`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    const headers = releaseHeaders(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=2592000, immutable');
    headers.set('CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_media_proxy_failed', detail: String(error) }));
    return new Response('Media momentanément indisponible', {
      status: 503,
      headers: releaseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }),
    });
  }
}

function injectPublic(html) {
  let output = html.replaceAll('SeneCompare AI', 'SeneCompare Sénégal');
  if (!output.includes('/premium-ads-v54.css')) {
    output = output.replace('</head>', '<link rel="stylesheet" href="/premium-ads-v54.css?v=540"></head>');
  }
  if (!output.includes('/premium-ads-v54.js')) {
    output = output.replace('</body>', '<script src="/premium-ads-v54.js?v=540" defer></script></body>');
  }
  return output.replace('<body', '<body data-senecompare-premium="5.4.0"');
}

function injectAdmin(html) {
  let output = html.replace('Console propriétaire 5.3', 'Console propriétaire sécurisée');
  output = output.replace('SeneCompare 5.3 — audience et régie actives', 'SeneCompare — audience et régie actives');
  if (!output.includes('/admin-auth-v54.css')) {
    output = output.replace('</head>', '<link rel="stylesheet" href="/admin-auth-v54.css?v=540"></head>');
  }
  if (!output.includes('/admin-auth-v54.js')) {
    output = output.replace('</body>', '<script src="/admin-auth-v54.js?v=540" defer></script></body>');
  }
  return output.replace('<body', '<body data-senecompare-admin-auth="5.4.0"');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const media = MEDIA.get(url.pathname);
    if (media && ['GET', 'HEAD'].includes(request.method)) return serveMedia(request, media);

    const descriptor = FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const local = await serveLocal(request, env, descriptor);
      if (local) return local;
    }

    const response = await application.fetch(request, env, ctx);
    const contentType = response.headers.get('Content-Type') || '';
    const html = contentType.includes('text/html') && request.method !== 'HEAD';
    if (html) {
      const source = await response.text();
      const output = url.pathname.startsWith('/admin') ? injectAdmin(source) : injectPublic(source);
      const headers = releaseHeaders(response.headers, 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return new Response(output, { status: response.status, statusText: response.statusText, headers });
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: releaseHeaders(response.headers),
    });
  },
};
