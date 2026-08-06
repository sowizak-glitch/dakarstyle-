const COMMERCE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-commerce-v13';
const VERSION = '13.0.0';
const R2_PREFIX = 'samabusiness/site-media-review/';

function responseHeaders(request, contentType = 'application/json; charset=utf-8') {
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': 'no-store, no-cache, must-revalidate',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-samabusiness-media-review': VERSION,
  });
  const origin = request.headers.get('origin');
  if (origin && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  return headers;
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders(request),
  });
}

function commerceHeaders(request, contentType = '') {
  const headers = new Headers({
    'x-client-info': request.headers.get('x-client-info') || `cloudflare-media-review/${VERSION}`,
  });
  const session = request.headers.get('x-sama-session');
  if (session) headers.set('x-sama-session', session);
  if (contentType) headers.set('content-type', contentType);
  return headers;
}

async function commerceJson(request, action, payload = {}) {
  const response = await fetch(COMMERCE, {
    method: 'POST',
    headers: commerceHeaders(request, 'application/json'),
    body: JSON.stringify({ action, payload }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Réponse commerce invalide.' }));
  return { response, data };
}

async function proxyJson(request, env) {
  const body = await request.text();
  let parsed = {};
  try { parsed = JSON.parse(body || '{}'); } catch (_) {}
  const response = await fetch(COMMERCE, {
    method: request.method,
    headers: commerceHeaders(request, 'application/json'),
    body,
    cache: 'no-store',
  });
  const text = await response.text();
  let result = {};
  try { result = JSON.parse(text); } catch (_) {}

  if (response.ok && result?.ok && parsed?.action === 'admin_review_media') {
    const mediaId = String(parsed?.payload?.mediaId || '');
    if (mediaId) await env.VISUALS_BUCKET.delete(`${R2_PREFIX}${mediaId}`).catch(() => {});
  }

  const headers = responseHeaders(request, response.headers.get('content-type') || 'application/json; charset=utf-8');
  return new Response(text, { status: response.status, headers });
}

async function proxyMultipart(request, env) {
  const form = await request.formData();
  const action = String(form.get('action') || '');
  const file = form.get('file');
  let bytes = null;
  let fileType = '';
  let fileName = '';
  if (file instanceof File) {
    bytes = await file.arrayBuffer();
    fileType = file.type || 'application/octet-stream';
    fileName = file.name || 'image';
  }

  const response = await fetch(COMMERCE, {
    method: 'POST',
    headers: commerceHeaders(request),
    body: form,
    cache: 'no-store',
  });
  const text = await response.text();
  let result = {};
  try { result = JSON.parse(text); } catch (_) {}

  if (response.ok && result?.ok && action === 'upload_product_image' && result?.media?.id && bytes) {
    await env.VISUALS_BUCKET.put(`${R2_PREFIX}${result.media.id}`, bytes, {
      httpMetadata: { contentType: fileType },
      customMetadata: {
        originalName: fileName.slice(0, 180),
        uploadedAt: new Date().toISOString(),
        generatedSiteId: String(result.media.generated_site_id || ''),
        moderationStatus: String(result.media.moderation_status || 'pending_review'),
      },
    });
  }

  const headers = responseHeaders(request, response.headers.get('content-type') || 'application/json; charset=utf-8');
  return new Response(text, { status: response.status, headers });
}

async function proxyGet(request) {
  const source = new URL(request.url);
  const target = new URL(COMMERCE);
  for (const [key, value] of source.searchParams) target.searchParams.set(key, value);
  const response = await fetch(target, {
    method: 'GET',
    headers: commerceHeaders(request),
    cache: 'no-store',
  });
  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders(request, response.headers.get('content-type') || 'application/json; charset=utf-8'),
  });
}

async function privatePreview(request, env) {
  const session = request.headers.get('x-sama-session') || '';
  if (!session.startsWith('sama_') || session.length < 40) {
    return json(request, { ok: false, error: 'Connexion requise.' }, 401);
  }
  const url = new URL(request.url);
  const mediaId = String(url.searchParams.get('mediaId') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) {
    return json(request, { ok: false, error: 'Photo invalide.' }, 422);
  }

  const { response, data } = await commerceJson(request, 'bootstrap');
  if (!response.ok || !data?.ok) {
    return json(request, { ok: false, error: data?.error || 'Accès refusé.' }, response.status || 403);
  }
  const allowed = Array.isArray(data.media) && data.media.some((item) => item?.id === mediaId);
  if (!allowed) return json(request, { ok: false, error: 'Accès refusé.' }, 403);

  const object = await env.VISUALS_BUCKET.get(`${R2_PREFIX}${mediaId}`);
  if (!object) return json(request, { ok: false, error: 'Aperçu privé indisponible. Réenvoyez la photo.' }, 404);

  const headers = responseHeaders(request, object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('content-length', String(object.size));
  headers.set('content-security-policy', "default-src 'none'; sandbox");
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        const headers = responseHeaders(request);
        headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
        headers.set('access-control-allow-headers', 'content-type,x-sama-session,x-client-info');
        headers.set('access-control-max-age', '86400');
        return new Response(null, { status: 204, headers });
      }
      if (url.pathname === '/api/site-media-preview') {
        if (request.method !== 'GET') return json(request, { ok: false, error: 'Method Not Allowed' }, 405);
        return privatePreview(request, env);
      }
      if (url.pathname !== '/api/site-commerce') return json(request, { ok: false, error: 'Not Found' }, 404);
      if (request.method === 'GET') return proxyGet(request);
      if (request.method !== 'POST') return json(request, { ok: false, error: 'Method Not Allowed' }, 405);
      const type = (request.headers.get('content-type') || '').toLowerCase();
      if (type.includes('multipart/form-data')) return proxyMultipart(request, env);
      return proxyJson(request, env);
    } catch (error) {
      console.error('samabusiness-media-review', error);
      return json(request, { ok: false, error: 'Service momentanément indisponible.' }, 503);
    }
  },
};
