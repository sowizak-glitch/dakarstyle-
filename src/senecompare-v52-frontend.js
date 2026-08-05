import baseFrontend from './senecompare-resilient.js';

const VERSION = '5.2.0';
const TEXT_ASSETS = new Map([
  ['/future-v52.css', { source: '/senecompare/future-v52.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/future-v52.js', { source: '/senecompare/future-v52.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
  ['/manifest.webmanifest', { source: '/senecompare/manifest-v52.webmanifest', type: 'application/manifest+json; charset=utf-8', cache: 'no-cache, must-revalidate' }],
  ['/sw.js', { source: '/senecompare/sw-v52.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, no-store, must-revalidate' }],
]);
const BINARY_ASSETS = new Map([
  ['/icon-192.png', { source: '/senecompare/brand/icon-192.png', type: 'image/png' }],
  ['/icon-512.png', { source: '/senecompare/brand/icon-512.png', type: 'image/png' }],
  ['/maskable-512.png', { source: '/senecompare/brand/maskable-512.png', type: 'image/png' }],
  ['/apple-touch-icon.png', { source: '/senecompare/brand/apple-touch-icon.png', type: 'image/png' }],
  ['/profile-256.png', { source: '/senecompare/brand/profile-256.png', type: 'image/png' }],
  ['/og-image.png', { source: '/senecompare/brand/og-image.png', type: 'image/png' }],
]);

function headers(type, cache = 'no-cache') {
  return new Headers({
    'Content-Type': type,
    'Cache-Control': cache,
    'CDN-Cache-Control': cache,
    'Cloudflare-CDN-Cache-Control': cache,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': type.startsWith('image/') ? 'same-origin' : 'cross-origin',
    'X-SeneCompare-Version': VERSION,
    'X-SeneCompare-Experience': 'senegal-universal-v52',
  });
}

function assetRequest(request, path) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = '';
  return new Request(url.toString(), {
    method: 'GET',
    headers: { Accept: request.headers.get('Accept') || '*/*' },
  });
}

async function asset(env, request, path) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const response = await env.ASSETS.fetch(assetRequest(request, path));
    return response.ok ? response : null;
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v52_asset_failed', path, detail: String(error) }));
    return null;
  }
}

async function serveText(env, request, descriptor) {
  const response = await asset(env, request, descriptor.source);
  if (!response) return null;
  const result = new Response(request.method === 'HEAD' ? null : await response.text(), {
    status: 200,
    headers: headers(descriptor.type, descriptor.cache),
  });
  if (new URL(request.url).pathname === '/sw.js') result.headers.set('Service-Worker-Allowed', '/');
  return result;
}

async function serveBinary(env, request, descriptor) {
  const response = await asset(env, request, descriptor.source);
  if (!response) return null;
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: 200,
    headers: headers(descriptor.type, 'public, max-age=31536000, immutable'),
  });
}

function inject(html) {
  let output = html;
  const head = [
    `<link rel="manifest" href="/manifest.webmanifest?v=${VERSION}" data-senecompare-v52="${VERSION}">`,
    `<link rel="icon" href="/icon-192.png?v=${VERSION}" sizes="192x192" type="image/png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${VERSION}" sizes="180x180">`,
    `<meta property="og:image" content="https://senecompare.dakarstyle.com/og-image.png?v=${VERSION}">`,
    `<link rel="stylesheet" href="/future-v52.css?v=${VERSION}">`,
  ].join('');
  const script = `<script src="/future-v52.js?v=${VERSION}" defer></script>`;
  if (!output.includes('data-senecompare-v52')) {
    output = output.includes('</head>') ? output.replace('</head>', `${head}</head>`) : `${head}${output}`;
  }
  if (!output.includes('/future-v52.js')) {
    output = output.includes('</body>') ? output.replace('</body>', `${script}</body>`) : `${output}${script}`;
  }
  output = output
    .replaceAll('Version 5.0.0 · Moteur hybride local · Sénégal', 'Version 5.2.0 · Comparateur universel local · Sénégal')
    .replaceAll('v=5.0.0', `v=${VERSION}`);
  return output;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const textDescriptor = TEXT_ASSETS.get(url.pathname);
    if (textDescriptor && ['GET', 'HEAD'].includes(request.method)) {
      const response = await serveText(env, request, textDescriptor);
      if (response) return response;
    }
    const binaryDescriptor = BINARY_ASSETS.get(url.pathname);
    if (binaryDescriptor && ['GET', 'HEAD'].includes(request.method)) {
      const response = await serveBinary(env, request, binaryDescriptor);
      if (response) return response;
    }

    const response = await baseFrontend.fetch(request, env, ctx);
    const type = response.headers.get('Content-Type') || '';
    if (!type.includes('text/html') || request.method === 'HEAD') {
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-SeneCompare-Version', VERSION);
      responseHeaders.set('X-SeneCompare-Experience', 'senegal-universal-v52');
      return new Response(request.method === 'HEAD' ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-SeneCompare-Version', VERSION);
    responseHeaders.set('X-SeneCompare-Experience', 'senegal-universal-v52');
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');
    return new Response(inject(await response.text()), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
