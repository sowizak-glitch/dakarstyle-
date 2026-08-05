import base from './senecompare-v5-router.js';

const UI_VERSION = '5.2.1';
const STATIC_ASSETS = new Map([
  ['/__sc/universal.css', '/senecompare/universal-v521.css'],
  ['/__sc/universal.js', '/senecompare/universal-v521.js'],
  ['/__sc/taxonomy.json', '/senecompare/taxonomy-v521.json'],
]);

function withHeaders(headers, contentType = '') {
  const next = new Headers(headers);
  next.set('x-senecompare-ui-version', UI_VERSION);
  next.set('x-content-type-options', 'nosniff');
  next.set('cross-origin-resource-policy', 'same-origin');
  if (contentType) next.set('content-type', contentType);
  return next;
}

async function serveStatic(request, env, url) {
  const path = STATIC_ASSETS.get(url.pathname);
  if (!path || !env?.ASSETS?.fetch) return new Response('Not Found', { status: 404 });
  const internal = new URL(request.url);
  internal.pathname = path;
  internal.search = '';
  const upstream = await env.ASSETS.fetch(new Request(internal.toString(), request));
  const type = path.endsWith('.css')
    ? 'text/css; charset=utf-8'
    : path.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : 'application/json; charset=utf-8';
  const headers = withHeaders(upstream.headers, type);
  headers.set('cache-control', path.endsWith('.json')
    ? 'public, max-age=900, stale-while-revalidate=3600'
    : 'public, max-age=86400, stale-while-revalidate=604800');
  headers.delete('set-cookie');
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function injectMetadata(html) {
  let output = html.replace(/SeneCompare\s+AI/gi, 'SeneCompare');
  if (output.includes('data-senecompare-universal="5.2.1"')) return output;

  const head = `<link rel="stylesheet" href="/__sc/universal.css?v=${UI_VERSION}" data-senecompare-universal="${UI_VERSION}">
<link rel="apple-touch-icon" href="/icon-192.png?v=${UI_VERSION}">
<meta name="application-name" content="SeneCompare">
<meta name="apple-mobile-web-app-title" content="SeneCompare">
<meta property="og:site_name" content="SeneCompare">
<meta property="og:image" content="/icon-512.png?v=${UI_VERSION}">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="/icon-512.png?v=${UI_VERSION}">`;
  const script = `<script defer src="/__sc/universal.js?v=${UI_VERSION}" data-senecompare-universal="${UI_VERSION}"></script>`;

  output = /<\/head>/i.test(output) ? output.replace(/<\/head>/i, `${head}</head>`) : `${head}${output}`;
  output = /<\/body>/i.test(output) ? output.replace(/<\/body>/i, `${script}</body>`) : `${output}${script}`;
  return output;
}

async function rewriteManifest(request, response) {
  if (!response.ok || request.method === 'HEAD') {
    const headers = withHeaders(response.headers);
    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  }
  try {
    const data = await response.json();
    data.id = '/';
    data.name = 'SeneCompare';
    data.short_name = 'SeneCompare';
    data.description = 'Comparez les prix, produits, services et équipements au Sénégal, simplement en français ou en wolof.';
    data.lang = 'fr-SN';
    data.dir = 'ltr';
    data.start_url = '/?source=pwa';
    data.scope = '/';
    data.display = 'standalone';
    data.display_override = ['window-controls-overlay', 'standalone', 'minimal-ui'];
    data.orientation = 'any';
    data.categories = ['shopping', 'business', 'finance', 'utilities'];
    data.icons = [
      { src: `/icon-192.png?v=${UI_VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icon-512.png?v=${UI_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/maskable-512.png?v=${UI_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
    data.shortcuts = [
      { name: 'Comparer un produit', short_name: 'Produit', url: '/?focus=products', icons: [{ src: `/icon-192.png?v=${UI_VERSION}`, sizes: '192x192', type: 'image/png' }] },
      { name: 'Trouver un service', short_name: 'Service', url: '/?focus=services', icons: [{ src: `/icon-192.png?v=${UI_VERSION}`, sizes: '192x192', type: 'image/png' }] },
      { name: 'Matériel professionnel', short_name: 'Professionnel', url: '/?focus=professional', icons: [{ src: `/icon-192.png?v=${UI_VERSION}`, sizes: '192x192', type: 'image/png' }] },
    ];
    const headers = withHeaders(response.headers, 'application/manifest+json; charset=utf-8');
    headers.set('cache-control', 'no-cache, must-revalidate');
    headers.delete('content-length');
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (_) {
    const headers = withHeaders(response.headers);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (STATIC_ASSETS.has(url.pathname)) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      return serveStatic(request, env, url);
    }

    const response = await base.fetch(request, env, ctx);
    if (url.pathname === '/manifest.webmanifest') return rewriteManifest(request, response);

    const contentType = response.headers.get('content-type') || '';
    if (request.method !== 'HEAD' && contentType.includes('text/html')) {
      const html = injectMetadata(await response.text());
      const headers = withHeaders(response.headers, 'text/html; charset=utf-8');
      headers.set('cache-control', 'no-store, no-cache, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('set-cookie');
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const headers = withHeaders(response.headers);
    headers.delete('set-cookie');
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
