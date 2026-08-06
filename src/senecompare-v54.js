import frontend from './senecompare-v531.js';

const RELEASE = '5.4.0';
const MEDIA_EDGE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-media-v54';
const FILES = new Map([
  ['/monetization-v54.css', { source: '/senecompare/monetization-v54.css', type: 'text/css; charset=utf-8', cache: 3600 }],
  ['/monetization-v54.js', { source: '/senecompare/monetization-v54.js', type: 'application/javascript; charset=utf-8', cache: 3600 }],
  ['/admin-auth-v54.css', { source: '/senecompare/admin-auth-v54.css', type: 'text/css; charset=utf-8', cache: 3600 }],
  ['/admin-auth-v54.js', { source: '/senecompare/admin-auth-v54.js', type: 'application/javascript; charset=utf-8', cache: 3600 }],
]);
const MEDIA = new Map([
  ['/media/sowhat-africa-campaign.jpg', 'sowhat-africa-campaign.webp'],
  ['/media/sowhat-africa-campaign.webp', 'sowhat-africa-campaign.webp'],
  ['/media/samabusiness-campaign.webp', 'samabusiness-campaign.webp'],
]);

function assetRequest(request, sourcePath) {
  const url = new URL(request.url);
  url.pathname = sourcePath;
  url.search = '';
  return new Request(url.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || '*/*' } });
}

function headers(type, cacheSeconds) {
  return new Headers({
    'Content-Type': type,
    'Cache-Control': `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`,
    'CDN-Cache-Control': `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`,
    'Cloudflare-CDN-Cache-Control': `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-SeneCompare-Release': RELEASE,
    'X-SeneCompare-Ads-Experience': 'premium-local-v54',
    'X-SeneCompare-Auth-Recovery': 'verified-owner-link-v54',
  });
}

async function serve(request, env, descriptor) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const asset = await env.ASSETS.fetch(assetRequest(request, descriptor.source));
    if (!asset.ok) return null;
    const type = asset.headers.get('Content-Type') || '';
    if (type.includes('text/html') && !descriptor.type.includes('text/html')) return null;
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      status: 200,
      headers: headers(descriptor.type, descriptor.cache),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v54_asset_failed', detail: String(error) }));
    return null;
  }
}

async function serveMedia(request, filename) {
  try {
    const upstream = await fetch(`${MEDIA_EDGE}/${filename}`, {
      method: request.method,
      headers: {
        Accept: request.headers.get('Accept') || 'image/webp,image/*;q=0.8,*/*;q=0.5',
        'If-None-Match': request.headers.get('If-None-Match') || '',
        'User-Agent': request.headers.get('User-Agent') || `SeneCompare/${RELEASE}`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    const responseHeaders = headers(upstream.headers.get('Content-Type') || 'image/webp', 604800);
    const etag = upstream.headers.get('ETag');
    if (etag) responseHeaders.set('ETag', etag);
    responseHeaders.set('X-SeneCompare-Media', 'verified-supabase-v54');
    responseHeaders.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=2592000, immutable');
    responseHeaders.set('CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    responseHeaders.set('Cloudflare-CDN-Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v54_media_failed', detail: String(error) }));
    return new Response('Media momentanément indisponible', {
      status: 503,
      headers: headers('text/plain; charset=utf-8', 0),
    });
  }
}

function injectPublic(html) {
  let output = html.replaceAll('SeneCompare AI', 'SeneCompare Sénégal');
  if (!output.includes('/monetization-v54.css')) output = output.replace('</head>', '<link rel="stylesheet" href="/monetization-v54.css?v=540"></head>');
  if (!output.includes('/monetization-v54.js')) output = output.replace('</body>', '<script src="/monetization-v54.js?v=540" defer></script></body>');
  return output.replace(/Release 5\.3\.0/g, '');
}

function injectAdmin(html) {
  let output = html;
  if (!output.includes('/admin-auth-v54.css')) output = output.replace('</head>', '<link rel="stylesheet" href="/admin-auth-v54.css?v=540"></head>');
  if (!output.includes('/admin-auth-v54.js')) output = output.replace('</body>', '<script src="/admin-auth-v54.js?v=540" defer></script></body>');
  return output;
}

function releaseHeaders(source) {
  const value = new Headers(source);
  value.set('X-SeneCompare-Release', RELEASE);
  value.set('X-SeneCompare-Ads-Experience', 'premium-local-v54');
  value.set('X-SeneCompare-Auth-Recovery', 'verified-owner-link-v54');
  value.set('X-SeneCompare-Contact', 'hellodakarstyle@gmail.com');
  value.delete('Content-Length');
  value.delete('Content-Encoding');
  return value;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const media = MEDIA.get(url.pathname);
    if (media && ['GET', 'HEAD'].includes(request.method)) return serveMedia(request, media);

    const descriptor = FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const response = await serve(request, env, descriptor);
      if (response) return response;
    }

    const response = await frontend.fetch(request, env, ctx);
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html') && request.method !== 'HEAD') {
      const html = await response.text();
      const updated = url.pathname.startsWith('/admin') ? injectAdmin(html) : injectPublic(html);
      return new Response(updated, {
        status: response.status,
        statusText: response.statusText,
        headers: releaseHeaders(response.headers),
      });
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: releaseHeaders(response.headers),
    });
  },
};
