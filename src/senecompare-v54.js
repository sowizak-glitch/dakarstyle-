import frontend from './senecompare-v531.js';

const RELEASE = '5.4.0';
const FILES = new Map([
  ['/monetization-v54.css', { source: '/senecompare/monetization-v54.css', type: 'text/css; charset=utf-8', cache: 3600 }],
  ['/monetization-v54.js', { source: '/senecompare/monetization-v54.js', type: 'application/javascript; charset=utf-8', cache: 3600 }],
  ['/admin-auth-v54.css', { source: '/senecompare/admin-auth-v54.css', type: 'text/css; charset=utf-8', cache: 3600 }],
  ['/admin-auth-v54.js', { source: '/senecompare/admin-auth-v54.js', type: 'application/javascript; charset=utf-8', cache: 3600 }],
  ['/media/sowhat-africa-campaign.jpg', { source: 'https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/main/assets/hero/ensemble-senegal-boutique-2026.jpg', type: 'image/jpeg', cache: 604800, remote: true }],
  ['/media/samabusiness-campaign.webp', { source: '/assets/samabusiness/samabusiness-192.webp', type: 'image/webp', cache: 604800 }],
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
    'X-SeneCompare-Auth-Recovery': 'secure-link-paste-v54',
  });
}

async function serve(request, env, descriptor) {
  try {
    const asset = descriptor.remote
      ? await fetch(descriptor.source, { headers: { Accept: descriptor.type }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
      : env?.ASSETS && typeof env.ASSETS.fetch === 'function'
        ? await env.ASSETS.fetch(assetRequest(request, descriptor.source))
        : null;
    if (!asset?.ok) return null;
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      status: 200,
      headers: headers(descriptor.type, descriptor.cache),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v54_asset_failed', detail: String(error) }));
    return null;
  }
}

function injectPublic(html) {
  let output = html;
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
  value.set('X-SeneCompare-Contact', 'hellodakarstyle@gmail.com');
  value.delete('Content-Length');
  value.delete('Content-Encoding');
  return value;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
