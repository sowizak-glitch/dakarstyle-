const API_BACKEND = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio';
const COMPATIBILITY = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-platform';
const RENDERER = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-renderer-v12';
const VERSION = '12.1.1';

function sameOriginSiteUrl(value, origin) {
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    const base = `${url.origin}${url.pathname}`;
    if (![API_BACKEND, COMPATIBILITY, RENDERER].includes(base)) return value;
    const site = url.searchParams.get('site');
    if (!site) return `${origin}/api/site-platform`;
    const target = new URL(`${origin}/sites/${encodeURIComponent(site)}`);
    const previewToken = url.searchParams.get('preview');
    if (previewToken) target.searchParams.set('preview', previewToken);
    return target.toString();
  } catch (_) {
    return value;
  }
}

function rewrite(value, origin) {
  if (typeof value === 'string') return sameOriginSiteUrl(value, origin);
  if (Array.isArray(value)) return value.map((item) => rewrite(item, origin));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = rewrite(item, origin);
    return output;
  }
  return value;
}

function commonHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-samabusiness-site-platform': VERSION,
  };
}

async function apiProxy(request, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...commonHeaders(),
        'access-control-allow-origin': url.origin,
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-sama-session,x-client-info',
        'access-control-max-age': '86400',
      },
    });
  }
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: commonHeaders() });

  const headers = new Headers({
    'content-type': 'application/json',
    'x-client-info': request.headers.get('x-client-info') || `cloudflare-site-proxy/${VERSION}`,
  });
  const session = request.headers.get('x-sama-session');
  if (session) headers.set('x-sama-session', session);
  const body = await request.text();

  let upstream;
  try {
    upstream = await fetch(API_BACKEND, { method: 'POST', headers, body, cache: 'no-store' });
  } catch (_) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    upstream = await fetch(API_BACKEND, { method: 'POST', headers, body, cache: 'no-store' });
  }

  const text = await upstream.text();
  let payload;
  try {
    payload = rewrite(JSON.parse(text), url.origin);
  } catch (_) {
    payload = { ok: false, error: 'Réponse serveur invalide.', code: 'INVALID_RESPONSE' };
  }

  return new Response(JSON.stringify(payload), {
    status: upstream.status,
    headers: {
      ...commonHeaders(),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'access-control-allow-origin': url.origin,
      vary: 'Origin',
    },
  });
}

async function sitePage(request, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: commonHeaders() });
  const pathSite = url.pathname.startsWith('/sites/') ? decodeURIComponent(url.pathname.slice('/sites/'.length)) : '';
  const site = pathSite || url.searchParams.get('site') || '';
  if (!site || !/^[a-z0-9][a-z0-9-]{1,79}$/i.test(site)) {
    return new Response('Site introuvable', { status: 404, headers: { ...commonHeaders(), 'content-type': 'text/plain; charset=utf-8' } });
  }

  const previewToken = url.searchParams.get('preview') || '';
  const isPreview = Boolean(previewToken);
  const signedPreview = previewToken && previewToken !== '1';
  const endpoint = signedPreview
    ? `${API_BACKEND}?site=${encodeURIComponent(site)}&preview=${encodeURIComponent(previewToken)}`
    : `${RENDERER}?site=${encodeURIComponent(site)}${isPreview ? '&preview=1' : ''}`;

  const upstreamHeaders = new Headers({
    'x-client-info': `cloudflare-site-renderer/${VERSION}`,
    'x-samabusiness-render-proxy': '1',
  });
  const session = request.headers.get('x-sama-session');
  if (session) upstreamHeaders.set('x-sama-session', session);
  const upstream = await fetch(endpoint, {
    method: request.method,
    headers: upstreamHeaders,
    cache: isPreview ? 'no-store' : 'no-cache',
  });
  const body = request.method === 'HEAD' ? null : await upstream.text();

  const responseHeaders = new Headers(commonHeaders());
  responseHeaders.set('content-type', upstream.ok ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
  responseHeaders.set('content-disposition', 'inline');
  responseHeaders.set('cache-control', isPreview ? 'private, no-store, no-cache, must-revalidate' : 'public, max-age=60, stale-while-revalidate=300');
  responseHeaders.set('cross-origin-resource-policy', 'same-origin');
  responseHeaders.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  responseHeaders.set('content-security-policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'self' https://wa.me; frame-ancestors 'self' https://samabusiness.dakarstyle.com https://samacahier.dakarstyle.com");
  responseHeaders.set('x-robots-tag', isPreview ? 'noindex, nofollow, noarchive' : 'index, follow');
  responseHeaders.delete('x-frame-options');
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('set-cookie');

  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/site-platform') return await apiProxy(request, url);
      if (url.pathname === '/site-preview' || url.pathname.startsWith('/sites/')) return await sitePage(request, url);
      if (url.pathname === '/site-platform-health') {
        return Response.json({ ok: true, service: 'samabusiness-site-proxy', version: VERSION, renderer: '12.1.0', signedPreviewTokens: true }, { headers: { ...commonHeaders(), 'cache-control': 'no-store' } });
      }
      return new Response('Not Found', { status: 404, headers: commonHeaders() });
    } catch (error) {
      console.error('samabusiness-site-proxy', error);
      return Response.json({ ok: false, error: 'Service temporairement indisponible.' }, { status: 503, headers: { ...commonHeaders(), 'cache-control': 'no-store' } });
    }
  },
};
