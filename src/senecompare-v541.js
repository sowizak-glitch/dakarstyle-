import application from './senecompare-v5-router.js';

const RELEASE = '5.4.1';
const MEDIA_EDGE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-media-v54';
const MEDIA = new Map([
  ['/media/v541/samabusiness-campaign.webp', 'samabusiness-campaign.webp'],
  ['/media/v541/sowhat-africa-campaign.webp', 'sowhat-africa-campaign.webp'],
]);
const SCRIPT_PATH = '/media-path-v541.js';
const SCRIPT_SOURCE = '/senecompare/media-path-v541.js';

function releaseHeaders(source, contentType = '') {
  const headers = new Headers(source);
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('X-SeneCompare-Release', RELEASE);
  headers.set('X-SeneCompare-Media-Path', 'physical-v541');
  headers.set('X-SeneCompare-Contact', 'hellodakarstyle@gmail.com');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  return headers;
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
    const headers = releaseHeaders(upstream.headers, upstream.headers.get('Content-Type') || 'image/webp');
    const etag = upstream.headers.get('ETag');
    if (etag) headers.set('ETag', etag);
    headers.set('X-SeneCompare-Media', 'verified-physical-v541');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_v541_media_failed', detail: String(error) }));
    return new Response('Media momentanément indisponible', {
      status: 503,
      headers: releaseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }),
    });
  }
}

async function serveScript(request, env) {
  if (!env?.ASSETS?.fetch) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  url.pathname = SCRIPT_SOURCE;
  url.search = '';
  const asset = await env.ASSETS.fetch(new Request(url, { headers: { Accept: 'application/javascript' } }));
  if (!asset.ok) return new Response('Not found', { status: 404 });
  const type = asset.headers.get('Content-Type') || '';
  if (type.includes('text/html')) return new Response('Not found', { status: 404 });
  const headers = releaseHeaders(asset.headers, 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
}

function injectScript(html) {
  if (html.includes(`${SCRIPT_PATH}?v=541`)) return html;
  return html.replace('</body>', `<script src="${SCRIPT_PATH}?v=541" defer></script></body>`);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = MEDIA.get(url.pathname);
    if (filename && ['GET', 'HEAD'].includes(request.method)) return serveMedia(request, filename);
    if (url.pathname === SCRIPT_PATH && ['GET', 'HEAD'].includes(request.method)) return serveScript(request, env);

    const response = await application.fetch(request, env, ctx);
    const contentType = response.headers.get('Content-Type') || '';
    if (request.method !== 'HEAD' && contentType.includes('text/html') && !url.pathname.startsWith('/admin')) {
      const html = injectScript(await response.text());
      const headers = releaseHeaders(response.headers, 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: releaseHeaders(response.headers),
    });
  },
};
