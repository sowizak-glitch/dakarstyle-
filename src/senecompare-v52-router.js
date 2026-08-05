import base from './senecompare-v5-router.js';

const UI_VERSION = '5.2.0';
const STATIC = new Map([
  ['/__sc/universal.css', '/senecompare/universal-v52.css'],
  ['/__sc/universal.js', '/senecompare/universal-v52.js'],
  ['/__sc/taxonomy.json', '/senecompare/taxonomy-v52.json'],
]);

function responseHeaders(headers, type) {
  const next = new Headers(headers);
  next.set('x-senecompare-ui-version', UI_VERSION);
  next.set('x-content-type-options', 'nosniff');
  if (type) next.set('content-type', type);
  return next;
}

async function staticAsset(request, env, url) {
  const path = STATIC.get(url.pathname);
  if (!path || !env?.ASSETS?.fetch) return new Response('Not Found', { status: 404 });
  const internal = new URL(request.url);
  internal.pathname = path;
  internal.search = '';
  const upstream = await env.ASSETS.fetch(new Request(internal, request));
  const contentType = path.endsWith('.css')
    ? 'text/css; charset=utf-8'
    : path.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : 'application/json; charset=utf-8';
  const headers = responseHeaders(upstream.headers, contentType);
  headers.set('cache-control', path.endsWith('.json') ? 'public, max-age=900' : 'public, max-age=86400, stale-while-revalidate=604800');
  headers.set('cross-origin-resource-policy', 'same-origin');
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}

function inject(html) {
  let output = html.replace(/SeneCompare\s+AI/gi, 'SeneCompare');
  const head = `<link rel="stylesheet" href="/__sc/universal.css?v=${UI_VERSION}" data-senecompare-universal="${UI_VERSION}">
<link rel="apple-touch-icon" href="/icon-192.png?v=${UI_VERSION}">
<meta name="application-name" content="SeneCompare">
<meta name="apple-mobile-web-app-title" content="SeneCompare">`;
  const script = `<script defer src="/__sc/universal.js?v=${UI_VERSION}" data-senecompare-universal="${UI_VERSION}"></script>`;
  if (!output.includes('data-senecompare-universal')) {
    output = /<\/head>/i.test(output) ? output.replace(/<\/head>/i, `${head}</head>`) : `${head}${output}`;
    output = /<\/body>/i.test(output) ? output.replace(/<\/body>/i, `${script}</body>`) : `${output}${script}`;
  }
  return output;
}

async function manifestResponse(request, response) {
  if (!response.ok || request.method === 'HEAD') return response;
  try {
    const data = await response.json();
    data.name = 'SeneCompare';
    data.short_name = 'SeneCompare';
    data.description = 'Comparez simplement les prix, produits, services et équipements au Sénégal, en français ou en wolof.';
    data.lang = data.lang || 'fr-SN';
    data.categories = ['shopping', 'business', 'finance', 'utilities'];
    data.start_url = '/?source=pwa';
    data.scope = '/';
    data.display = 'standalone';
    data.display_override = ['window-controls-overlay', 'standalone', 'minimal-ui'];
    data.icons = Array.isArray(data.icons) && data.icons.length ? data.icons : [
      { src: '/icon-192.png?v=5.2.0', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=5.2.0', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-512.png?v=5.2.0', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
    data.shortcuts = [
      { name: 'Comparer un produit', short_name: 'Produit', url: '/?focus=products', icons: [{ src: '/icon-192.png?v=5.2.0', sizes: '192x192', type: 'image/png' }] },
      { name: 'Trouver un service', short_name: 'Service', url: '/?focus=services', icons: [{ src: '/icon-192.png?v=5.2.0', sizes: '192x192', type: 'image/png' }] },
      { name: 'Matériel professionnel', short_name: 'Pro', url: '/?focus=professional', icons: [{ src: '/icon-192.png?v=5.2.0', sizes: '192x192', type: 'image/png' }] },
    ];
    const headers = responseHeaders(response.headers, 'application/manifest+json; charset=utf-8');
    headers.set('cache-control', 'no-cache, must-revalidate');
    headers.delete('content-length');
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (_) {
    return response;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (STATIC.has(url.pathname)) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
      return staticAsset(request, env, url);
    }

    const response = await base.fetch(request, env, ctx);
    if (url.pathname === '/manifest.webmanifest') return manifestResponse(request, response);

    const type = response.headers.get('content-type') || '';
    if (request.method !== 'HEAD' && type.includes('text/html')) {
      const html = inject(await response.text());
      const headers = responseHeaders(response.headers, 'text/html; charset=utf-8');
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('cache-control', 'no-store, no-cache, must-revalidate');
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }

    const headers = responseHeaders(response.headers);
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
