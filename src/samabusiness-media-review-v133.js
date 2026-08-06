const COMMERCE = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-commerce-v13';
const VERSION = '13.3.0';
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
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(request) });
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

async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeRpcError(message = '') {
  if (/INSUFFICIENT_STOCK/i.test(message)) return { status: 409, error: 'Stock insuffisant. Réduisez la quantité ou choisissez un autre article.', code: 'INSUFFICIENT_STOCK' };
  if (/RATE_LIMITED/i.test(message)) return { status: 429, error: 'Trop de commandes rapprochées. Réessayez dans quelques minutes.', code: 'RATE_LIMITED' };
  if (/PRODUCT_UNAVAILABLE|VARIANT_UNAVAILABLE/i.test(message)) return { status: 409, error: 'Un article ou une option n’est plus disponible.', code: 'PRODUCT_UNAVAILABLE' };
  if (/STORE_UNAVAILABLE|SUBSCRIPTION_INACTIVE/i.test(message)) return { status: 403, error: 'Cette boutique ne peut pas recevoir de commande actuellement.', code: 'STORE_UNAVAILABLE' };
  if (/CUSTOMER_|EMPTY_|INVALID_|FINGERPRINT/i.test(message)) return { status: 422, error: 'Vérifiez les informations de la commande.', code: 'INVALID_ORDER' };
  return { status: 503, error: 'La commande n’a pas pu être enregistrée. Réessayez.', code: 'ORDER_SERVICE_ERROR' };
}

async function atomicPublicOrder(request, env, parsed) {
  const payload = parsed?.payload && typeof parsed.payload === 'object' ? parsed.payload : {};
  const baseUrl = env.SENECOMPARE_SUPABASE_URL || 'https://xmdpmtvieqgoorbxytey.supabase.co';
  const anonKey = env.SENECOMPARE_SUPABASE_ANON_KEY || '';
  if (!anonKey) return json(request, { ok: false, error: 'Configuration commerce indisponible.' }, 503);

  const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = await sha256(`${forwarded}|${day}|samabusiness-order-v133`);
  const uaHash = await sha256(`${request.headers.get('user-agent') || 'unknown'}|samabusiness-order-v133`);
  const publicToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  const response = await fetch(`${baseUrl}/rest/v1/rpc/sama_create_public_order_public_v133`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
      'x-client-info': `cloudflare-atomic-order/${VERSION}`,
    },
    body: JSON.stringify({
      p_site_id: String(payload.siteId || ''),
      p_items: Array.isArray(payload.items) ? payload.items : [],
      p_customer: payload.customer && typeof payload.customer === 'object' ? payload.customer : {},
      p_payment_method: String(payload.paymentMethod || 'cash'),
      p_delivery_required: payload.deliveryRequired !== false,
      p_public_token: publicToken,
      p_ip_hash: ipHash,
      p_user_agent_hash: uaHash,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const normalized = normalizeRpcError(String(result?.message || result?.error || ''));
    return json(request, { ok: false, error: normalized.error, code: normalized.code }, normalized.status);
  }
  const number = String(result.whatsappNumber || '').replace(/\D/g, '');
  const message = String(result.message || '');
  return json(request, {
    ok: true,
    order: result.order,
    message,
    whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    atomic: true,
    version: VERSION,
  });
}

async function proxyJson(request, env) {
  const body = await request.text();
  let parsed = {};
  try { parsed = JSON.parse(body || '{}'); } catch (_) {}

  if (parsed?.action === 'create_public_order') return atomicPublicOrder(request, env, parsed);

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
  const response = await fetch(target, { method: 'GET', headers: commerceHeaders(request), cache: 'no-store' });
  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders(request, response.headers.get('content-type') || 'application/json; charset=utf-8'),
  });
}

async function privatePreview(request, env) {
  const session = request.headers.get('x-sama-session') || '';
  if (!session.startsWith('sama_') || session.length < 40) return json(request, { ok: false, error: 'Connexion requise.' }, 401);
  const url = new URL(request.url);
  const mediaId = String(url.searchParams.get('mediaId') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return json(request, { ok: false, error: 'Photo invalide.' }, 422);

  const { response, data } = await commerceJson(request, 'bootstrap');
  if (!response.ok || !data?.ok) return json(request, { ok: false, error: data?.error || 'Accès refusé.' }, response.status || 403);
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
      console.error('samabusiness-media-review-v133', error);
      return json(request, { ok: false, error: 'Service momentanément indisponible.' }, 503);
    }
  },
};
