import frontend from './senecompare-v53.js';

const RELEASE = '5.3.0';
const DIALOG_FIX = '5.3.1-dialog';
const FILES = new Map([
  ['/monetization-v53-dialog.css', { source: '/senecompare/monetization-v53-dialog.css', type: 'text/css; charset=utf-8' }],
  ['/monetization-v53-dialog.js', { source: '/senecompare/monetization-v53-dialog.js', type: 'application/javascript; charset=utf-8' }],
]);

function assetRequest(request, sourcePath) {
  const url = new URL(request.url);
  url.pathname = sourcePath;
  url.search = '';
  return new Request(url.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || '*/*' } });
}

function secureHeaders(type) {
  return new Headers({
    'Content-Type': type,
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-SeneCompare-Release': RELEASE,
    'X-SeneCompare-Dialog-Fix': DIALOG_FIX,
  });
}

async function serveLocal(request, env, descriptor) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const asset = await env.ASSETS.fetch(assetRequest(request, descriptor.source));
    if (!asset.ok) return null;
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      status: 200,
      headers: secureHeaders(descriptor.type),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_dialog_asset_failed', detail: String(error) }));
    return null;
  }
}

function injectDialogFix(html) {
  let output = html;
  if (!output.includes('/monetization-v53-dialog.css')) {
    output = output.replace('</head>', '<link rel="stylesheet" href="/monetization-v53-dialog.css?v=531"></head>');
  }
  if (!output.includes('/monetization-v53-dialog.js')) {
    output = output.replace('</body>', '<script src="/monetization-v53-dialog.js?v=531" defer></script></body>');
  }
  return output;
}

function withReleaseHeaders(source) {
  const value = new Headers(source);
  value.set('X-SeneCompare-Release', RELEASE);
  value.set('X-SeneCompare-Dialog-Fix', DIALOG_FIX);
  value.delete('Content-Length');
  value.delete('Content-Encoding');
  return value;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const descriptor = FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const response = await serveLocal(request, env, descriptor);
      if (response) return response;
    }

    const response = await frontend.fetch(request, env, ctx);
    const contentType = response.headers.get('Content-Type') || '';
    const publicHtml = contentType.includes('text/html') && !url.pathname.startsWith('/admin');
    if (publicHtml && request.method !== 'HEAD') {
      return new Response(injectDialogFix(await response.text()), {
        status: response.status,
        statusText: response.statusText,
        headers: withReleaseHeaders(response.headers),
      });
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: withReleaseHeaders(response.headers),
    });
  },
};
