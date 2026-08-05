const SOWHAT_UPLOAD_KEY_SHA256 = 'ed51c5e5e73785e254d4ee5974193b22cecbb29b667c5651641d838e5bbcde35';
const SAMABUSINESS_HOSTS = new Set(['samabusiness.dakarstyle.com', 'samacahier.dakarstyle.com']);
const SAMABUSINESS_ASSETS = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/sama-assets';
const SAMABUSINESS_PWA = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-pwa';
const SAMABUSINESS_API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-api-v10';
const SAMABUSINESS_CANONICAL = 'https://samabusiness.dakarstyle.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (SAMABUSINESS_HOSTS.has(url.hostname)) {
      return handleSamabusiness(request);
    }

    if (url.pathname === '/visuals/api/upload') {
      if (request.method === 'OPTIONS') return corsPreflight();
      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
      return handleUpload(request, env);
    }

    if (url.pathname === '/visuals/instagram-image') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
      return handleInstagramImage(request);
    }

    if (url.pathname.startsWith('/visuals/media/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
      return serveR2Object(request, env, 'visuals/media/', '/visuals/media/');
    }

    if (url.pathname.startsWith('/visuals/manifest/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
      return serveR2Object(request, env, 'visuals/manifest/', '/visuals/manifest/', 'application/json; charset=utf-8');
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSamabusiness(request) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return json({ ok: false, error: 'method_not_allowed' }, 405, samabusinessHeaders(url.hostname, 'application/json; charset=utf-8', 'no-store'));
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: samabusinessHeaders(url.hostname, 'text/plain; charset=utf-8', 'public, max-age=86400') });
  }

  const mode = String(url.searchParams.get('mode') || '').toLowerCase();
  let upstreamUrl = '';
  let cache = 'no-store, no-cache, must-revalidate';

  if (url.pathname === '/health' || mode === 'health') {
    const [pwa, api] = await Promise.allSettled([
      fetch(`${SAMABUSINESS_PWA}?mode=health`, { headers: { accept: 'application/json' } }),
      fetch(SAMABUSINESS_API, { headers: { accept: 'application/json' } }),
    ]);
    const pwaOk = pwa.status === 'fulfilled' && pwa.value.ok;
    const apiOk = api.status === 'fulfilled' && api.value.ok;
    return json({
      ok: pwaOk && apiOk,
      app: 'SAMABUSINESS',
      version: '10.1.0',
      domain: url.hostname,
      canonical: SAMABUSINESS_CANONICAL,
      pwa: pwaOk,
      api: apiOk,
      checked_at: new Date().toISOString(),
    }, pwaOk && apiOk ? 200 : 503, samabusinessHeaders(url.hostname, 'application/json; charset=utf-8', 'no-store'));
  }

  if (url.pathname === '/manifest.webmanifest' || mode === 'manifest') {
    upstreamUrl = `${SAMABUSINESS_PWA}?mode=manifest&v=10.1.0`;
    cache = 'public, max-age=300';
  } else if (url.pathname === '/sw.js' || mode === 'sw') {
    upstreamUrl = `${SAMABUSINESS_PWA}?mode=sw&v=10.1.0`;
    cache = 'no-cache';
  } else if (url.pathname === '/icon.svg' || mode === 'icon') {
    upstreamUrl = `${SAMABUSINESS_PWA}?mode=icon&size=${encodeURIComponent(url.searchParams.get('size') || '512')}&v=10.1.0`;
    cache = 'public, max-age=31536000, immutable';
  } else if (url.pathname === '/logo.webp') {
    return Response.redirect('https://dakarstyle.com/assets/samabusiness/samabusiness-192.webp?v=20260803', 302);
  } else {
    const upstream = new URL(SAMABUSINESS_ASSETS);
    for (const [key, value] of url.searchParams) upstream.searchParams.append(key, value);
    upstreamUrl = upstream.toString();
  }

  try {
    const response = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        accept: request.headers.get('accept') || '*/*',
        'accept-language': request.headers.get('accept-language') || 'fr-SN,fr;q=0.9',
        'user-agent': request.headers.get('user-agent') || 'SAMABUSINESS-Cloudflare-Gateway/10.1.0',
      },
      redirect: 'follow',
    });
    const headers = new Headers(response.headers);
    const contentType = headers.get('content-type') || 'application/octet-stream';
    const secured = samabusinessHeaders(url.hostname, contentType, cache);
    for (const [key, value] of Object.entries(secured)) headers.set(key, value);
    headers.set('link', `<${SAMABUSINESS_CANONICAL}${url.pathname}>; rel="canonical"`);
    if (url.pathname === '/sw.js' || mode === 'sw') headers.set('service-worker-allowed', '/');
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('set-cookie');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  } catch (error) {
    return json({ ok: false, error: 'samabusiness_upstream_unavailable', detail: error instanceof Error ? error.message : String(error) }, 503, samabusinessHeaders(url.hostname, 'application/json; charset=utf-8', 'no-store'));
  }
}

function samabusinessHeaders(hostname, contentType, cache) {
  return {
    'content-type': contentType,
    'cache-control': cache,
    'content-language': 'fr-SN',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self), geolocation=(self), microphone=(self), payment=(), usb=()',
    'cross-origin-resource-policy': contentType.includes('text/html') ? 'same-origin' : 'cross-origin',
    'x-sama-domain': hostname,
    'x-sama-version': '10.1.0',
    'x-samabusiness-version': '10.1.0',
  };
}

async function handleUpload(request, env) {
  const cors = corsHeaders();
  try {
    const apiKey = request.headers.get('X-SOWHAT-KEY') || '';
    const apiKeyHash = await sha256Text(apiKey);
    if (!apiKey || apiKeyHash !== SOWHAT_UPLOAD_KEY_SHA256) {
      return json({ ok: false, error: 'unauthorized' }, 401, cors);
    }
    if (!env.VISUALS_BUCKET) {
      return json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, 500, cors);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ ok: false, error: 'file_required' }, 400, cors);

    const publicationType = String(form.get('publication_type') || 'POST IMAGE').trim().toUpperCase();
    const mediaKind = String(form.get('media_kind') || inferMediaKind(file)).trim().toUpperCase();
    if (!['POST IMAGE', 'REEL', 'STORY'].includes(publicationType)) return json({ ok: false, error: 'invalid_publication_type' }, 400, cors);
    if (!['IMAGE', 'VIDEO'].includes(mediaKind)) return json({ ok: false, error: 'invalid_media_kind' }, 400, cors);
    if (publicationType === 'POST IMAGE' && mediaKind !== 'IMAGE') return json({ ok: false, error: 'post_image_requires_image' }, 400, cors);
    if (publicationType === 'REEL' && mediaKind !== 'VIDEO') return json({ ok: false, error: 'reel_requires_video' }, 400, cors);

    const ext = inferExtension(file);
    if (!ext) return json({ ok: false, error: 'unsupported_file_type' }, 400, cors);

    const assetId = sanitizeAssetId(String(form.get('asset_id') || '').trim() || makeAssetId());
    const title = String(form.get('title') || '').trim();
    const collection = String(form.get('collection') || '').trim();
    const product = String(form.get('product') || '').trim();
    const altText = String(form.get('alt_text') || '').trim();
    const publish = String(form.get('publish') || 'false').trim().toLowerCase() === 'true';

    const buffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    const contentType = file.type || contentTypeFromExtension(ext);
    const mediaKey = `visuals/media/${assetId}.${ext}`;
    const manifestKey = `visuals/manifest/${assetId}.json`;

    await env.VISUALS_BUCKET.put(mediaKey, buffer, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: {
        asset_id: assetId,
        publication_type: publicationType,
        media_kind: mediaKind,
        original_filename: file.name || `${assetId}.${ext}`,
        sha256,
      },
    });

    const origin = new URL(request.url).origin;
    const originalMediaUrl = `${origin}/visuals/media/${assetId}.${ext}`;
    const instagramReadyUrl = mediaKind === 'IMAGE'
      ? `${origin}/visuals/instagram-image?src=${encodeURIComponent(originalMediaUrl)}`
      : originalMediaUrl;
    const manifestUrl = `${origin}/visuals/manifest/${assetId}.json`;
    const manifest = {
      ok: true,
      asset_id: assetId,
      title,
      collection,
      product,
      publication_type: publicationType,
      media_kind: mediaKind,
      media_url: instagramReadyUrl,
      instagram_ready_url: instagramReadyUrl,
      original_media_url: originalMediaUrl,
      canonical_url: originalMediaUrl,
      manifest_url: manifestUrl,
      alt_text: altText,
      publish,
      watermark_applied: false,
      sha256,
      size_bytes: buffer.byteLength,
      content_type: contentType,
      original_filename: file.name || `${assetId}.${ext}`,
      uploaded_at: new Date().toISOString(),
      source: 'sowhat_creative_os_upload',
    };

    await env.VISUALS_BUCKET.put(manifestKey, JSON.stringify(manifest, null, 2), {
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'public, max-age=300' },
    });

    return json(manifest, 200, cors);
  } catch (error) {
    return json({ ok: false, error: 'upload_failed', detail: error instanceof Error ? error.message : String(error) }, 500, cors);
  }
}

async function handleInstagramImage(request) {
  try {
    const url = new URL(request.url);
    const src = String(url.searchParams.get('src') || '').trim();
    if (!src) return json({ ok: false, error: 'src_required' }, 400);

    let source;
    try {
      source = new URL(src);
    } catch {
      return json({ ok: false, error: 'invalid_src' }, 400);
    }

    const allowedHosts = new Set([
      'dakarstyle.com',
      'www.dakarstyle.com',
      'dakarstyle-visual-upload.idrissaminata.workers.dev',
    ]);
    if (source.protocol !== 'https:' || !allowedHosts.has(source.hostname) || !source.pathname.startsWith('/visuals/media/')) {
      return json({ ok: false, error: 'src_not_allowed' }, 403);
    }

    const transformed = await fetch(source.toString(), {
      cf: {
        image: {
          format: 'jpeg',
          fit: 'scale-down',
          width: 1080,
          quality: 90,
          metadata: 'none',
        },
      },
    });

    if (!transformed.ok) {
      return json({ ok: false, error: 'image_transform_failed', upstream_status: transformed.status }, 502);
    }

    const headers = new Headers(transformed.headers);
    headers.set('content-type', 'image/jpeg');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('access-control-allow-origin', '*');
    headers.set('x-content-type-options', 'nosniff');
    headers.delete('set-cookie');

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(transformed.body, { status: 200, headers });
  } catch (error) {
    return json({ ok: false, error: 'image_transform_failed', detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}

async function serveR2Object(request, env, prefix, routePrefix, forcedType = '') {
  if (!env.VISUALS_BUCKET) return json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, 500);
  const url = new URL(request.url);
  const relative = decodeURIComponent(url.pathname.slice(routePrefix.length));
  if (!relative || relative.includes('..') || relative.includes('\\')) return json({ ok: false, error: 'invalid_path' }, 400);

  const object = await env.VISUALS_BUCKET.get(prefix + relative);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  if (forcedType) headers.set('content-type', forcedType);
  if (prefix === 'visuals/media/') headers.set('cache-control', 'public, max-age=31536000, immutable');
  else headers.set('cache-control', 'public, max-age=300');

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-SOWHAT-KEY',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function corsPreflight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function sanitizeAssetId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || makeAssetId();
}

function makeAssetId() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SWA-${y}${m}${day}-${rand}`;
}

function inferMediaKind(file) {
  return String(file?.type || '').startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

function inferExtension(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
  };
  if (map[type]) return map[type];
  const match = name.match(/\.([a-z0-9]+)$/i);
  if (!match) return '';
  const ext = match[1].toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : '';
}

function contentTypeFromExtension(ext) {
  return ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v' })[ext] || 'application/octet-stream';
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value));
  return sha256Hex(bytes.buffer);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
