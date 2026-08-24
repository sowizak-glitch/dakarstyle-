const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const EVIDENCE_SCHEMA = 'sowhat-guardian-evidence-v1';
const INDEX_PREFIX = 'visuals/index/';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{16}$/;
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

    if (url.pathname === '/visuals/api/upload' || url.pathname === '/visuals/api/upload-secured') {
      if (request.method === 'OPTIONS') return corsPreflight();
      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
      return handleUpload(request, env, url.pathname.endsWith('/upload-secured'));
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

class UploadFailure extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.name = 'UploadFailure';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

async function handleUpload(request, env, guardianRequired = false) {
  const cors = corsHeaders();
  const requestId = request.headers.get('cf-ray') || crypto.randomUUID();
  const log = (level, event, fields = {}) => {
    console[level](JSON.stringify({
      event,
      request_id: requestId,
      route: guardianRequired ? 'upload-secured' : 'upload',
      ...fields,
    }));
  };

  try {
    const configuredKey = String(env.SOWHAT_UPLOAD_KEY || '');
    const suppliedKey = request.headers.get('X-SOWHAT-KEY') || '';
    if (!(await timingSafeSecretEqual(suppliedKey, configuredKey))) {
      log('warn', 'visual_upload_rejected', { reason: configuredKey ? 'unauthorized' : 'key_unconfigured' });
      throw new UploadFailure('unauthorized', 401);
    }
    if (!env.VISUALS_BUCKET) throw new UploadFailure('visual_storage_unavailable', 503);

    const declared = Number(request.headers.get('content-length') || 0);
    const maximum = guardianRequired ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (Number.isFinite(declared) && declared > maximum + 256 * 1024) {
      throw new UploadFailure('media_too_large', 413, { max_bytes: maximum });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      throw new UploadFailure('invalid_multipart', 400);
    }

    const file = form.get('file');
    if (!(file instanceof File) || !file.size) throw new UploadFailure('file_required', 400);
    if (file.size > maximum) throw new UploadFailure('media_too_large', 413, { max_bytes: maximum });

    const publicationType = clean(form.get('publication_type'), 24).toUpperCase() || 'POST IMAGE';
    const mediaKind = clean(form.get('media_kind'), 12).toUpperCase() || inferMediaKind(file);
    if (!['POST IMAGE', 'REEL', 'STORY'].includes(publicationType)) {
      throw new UploadFailure('invalid_publication_type', 400);
    }
    if (!['IMAGE', 'VIDEO'].includes(mediaKind)) throw new UploadFailure('invalid_media_kind', 400);
    if (publicationType === 'POST IMAGE' && mediaKind !== 'IMAGE') {
      throw new UploadFailure('post_image_requires_image', 400);
    }
    if (publicationType === 'REEL' && mediaKind !== 'VIDEO') {
      throw new UploadFailure('reel_requires_video', 400);
    }
    if (guardianRequired && mediaKind !== 'IMAGE') {
      throw new UploadFailure('guardian_image_required', 415);
    }

    const ext = inferExtension(file);
    if (!ext) throw new UploadFailure('unsupported_file_type', 415);
    const contentType = file.type || contentTypeFromExtension(ext);
    const buffer = await file.arrayBuffer();
    if (!magicMatches(new Uint8Array(buffer), contentType)) {
      throw new UploadFailure('file_signature_mismatch', 415);
    }

    const sha256 = await sha256Hex(buffer);
    const evidence = guardianRequired ? readGuardianEvidence(form) : null;
    if (evidence) {
      await verifyGuardianEvidence(evidence, env.GUARDIAN_EVIDENCE_KEY);
      if (!(await timingSafeHexEqual(sha256, evidence.secured_sha256))) {
        throw new UploadFailure('guardian_hash_mismatch', 422);
      }
    }

    const requestedAssetId = sanitizeAssetId(String(form.get('asset_id') || '').trim());
    const assetId = evidence
      ? sanitizeAssetId(`SWA-GDN-${evidence.asset_id}`)
      : (requestedAssetId || makeAssetId());
    const title = clean(form.get('title'), 160);
    const collection = clean(form.get('collection'), 120);
    const product = clean(form.get('product'), 120);
    const location = clean(form.get('location'), 120);
    const objective = clean(form.get('objective'), 120);
    const altText = clean(form.get('alt_text'), 300);
    const publish = String(form.get('publish') || 'false').trim().toLowerCase() === 'true';
    const originalFilename = safeFilename(file.name || `${assetId}.${ext}`);
    const mediaKey = `visuals/media/${assetId}.${ext}`;
    const manifestKey = `visuals/manifest/${assetId}.json`;
    const reverseTime = String(9999999999999 - Date.now()).padStart(13, '0');
    const indexKey = `${INDEX_PREFIX}${reverseTime}-${assetId}.json`;

    const existing = await env.VISUALS_BUCKET.head(mediaKey);
    if (existing) {
      const existingManifest = await loadJsonObject(env.VISUALS_BUCKET, manifestKey);
      if (existingManifest?.sha256 === sha256) {
        log('info', 'visual_upload_replayed', { asset_id: assetId, sha256 });
        return json({ ...existingManifest, replayed: true }, 200, cors);
      }
      throw new UploadFailure('asset_collision', 409);
    }

    const origin = new URL(request.url).origin;
    const originalMediaUrl = `${origin}/visuals/media/${assetId}.${ext}`;
    const instagramReadyUrl = mediaKind === 'IMAGE'
      ? `${origin}/visuals/instagram-image?src=${encodeURIComponent(originalMediaUrl)}`
      : originalMediaUrl;
    const manifestUrl = `${origin}/visuals/manifest/${assetId}.json`;
    const passportUrl = `https://dakarstyle.com/visuals/${assetId}`;
    const uploadedAt = new Date().toISOString();
    const guardian = evidence ? {
      evidence_schema: evidence.schema,
      evidence_verified: true,
      asset_id: evidence.asset_id,
      source_sha256: evidence.source_sha256,
      secured_sha256: evidence.secured_sha256,
      phash: evidence.phash,
      dhash: evidence.dhash,
      watermark_valid: true,
      c2pa_signed: true,
      c2pa_valid: true,
      metadata_written: true,
      report_sha256: evidence.report_sha256,
      evidence_signature: evidence.signature,
    } : null;

    const manifest = {
      ok: true,
      schema: guardianRequired
        ? 'https://sowhatafrica.com/schemas/visual-passport-v2'
        : 'https://sowhatafrica.com/schemas/visual-passport-v1',
      version: guardianRequired ? 2 : 1,
      status: guardianRequired ? 'GUARDIAN_VERIFIED' : 'LEGACY_UNVERIFIED',
      provenance_standard: guardianRequired
        ? 'SOWHAT_VISUAL_PASSPORT_V2_C2PA'
        : 'SOWHAT_VISUAL_PASSPORT_V1',
      asset_id: assetId,
      upstream_asset_id: requestedAssetId || null,
      title,
      collection,
      product,
      location,
      objective,
      creator: 'SOWHAT AFRICA',
      distribution: 'DakarStyle × Sowhat OS',
      publication_type: publicationType,
      media_kind: mediaKind,
      media_url: instagramReadyUrl,
      instagram_ready_url: instagramReadyUrl,
      original_media_url: originalMediaUrl,
      canonical_url: passportUrl,
      passport_url: passportUrl,
      manifest_url: manifestUrl,
      alt_text: altText,
      publish,
      watermark_applied: Boolean(guardian),
      c2pa_signed: Boolean(guardian),
      c2pa_valid: Boolean(guardian),
      metadata_written: Boolean(guardian),
      guardian,
      sha256,
      integrity: {
        algorithm: 'SHA-256',
        sha256,
        guardian_evidence_bound: Boolean(guardian),
      },
      size_bytes: buffer.byteLength,
      content_type: contentType,
      original_filename: originalFilename,
      uploaded_at: uploadedAt,
      sealed_at: uploadedAt,
      source: guardianRequired ? 'sowhat_image_guardian' : 'sowhat_creative_os_legacy_upload',
    };

    const compact = {
      asset_id: assetId,
      title,
      collection,
      product,
      status: manifest.status,
      sha256,
      media_url: instagramReadyUrl,
      manifest_url: manifestUrl,
      passport_url: passportUrl,
      uploaded_at: uploadedAt,
      content_type: contentType,
      size_bytes: buffer.byteLength,
      watermark_applied: manifest.watermark_applied,
      c2pa_valid: manifest.c2pa_valid,
      guardian_verified: Boolean(guardian),
      legacy_repair: false,
    };

    let mediaWritten = false;
    let manifestWritten = false;
    try {
      await env.VISUALS_BUCKET.put(mediaKey, buffer, {
        httpMetadata: {
          contentType,
          contentDisposition: `inline; filename="${originalFilename}"`,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          asset_id: assetId,
          sha256,
          secured_by: guardianRequired ? 'image_guardian_v1' : 'legacy_upload',
          c2pa_valid: String(Boolean(guardian)),
        },
      });
      mediaWritten = true;
      await env.VISUALS_BUCKET.put(manifestKey, JSON.stringify(manifest, null, 2), {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'public, max-age=300',
        },
      });
      manifestWritten = true;
      await env.VISUALS_BUCKET.put(indexKey, JSON.stringify(compact), {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'no-store',
        },
      });
      const [mediaHead, manifestHead] = await Promise.all([
        env.VISUALS_BUCKET.head(mediaKey),
        env.VISUALS_BUCKET.head(manifestKey),
      ]);
      if (!mediaHead || !manifestHead) throw new Error('write_verification_failed');
    } catch (error) {
      const cleanup = [];
      if (mediaWritten) cleanup.push(env.VISUALS_BUCKET.delete(mediaKey));
      if (manifestWritten) cleanup.push(env.VISUALS_BUCKET.delete(manifestKey));
      cleanup.push(env.VISUALS_BUCKET.delete(indexKey));
      await Promise.allSettled(cleanup);
      log('error', 'visual_storage_failed', {
        asset_id: assetId,
        error_type: error instanceof Error ? error.name : 'unknown',
      });
      throw new UploadFailure('visual_storage_failed', 503);
    }

    log('info', 'visual_upload_committed', {
      asset_id: assetId,
      sha256,
      guardian_verified: Boolean(guardian),
      size_bytes: buffer.byteLength,
    });
    return json(manifest, guardianRequired ? 201 : 200, cors);
  } catch (error) {
    if (error instanceof UploadFailure) {
      return json({ ok: false, error: error.code, ...error.extra }, error.status, cors);
    }
    log('error', 'visual_upload_failed', {
      error_type: error instanceof Error ? error.name : 'unknown',
    });
    return json({ ok: false, error: 'upload_failed' }, 500, cors);
  }
}

function readGuardianEvidence(form) {
  const read = (name, max = 256) => clean(form.get(name), max);
  const evidence = {
    schema: read('guardian_evidence_schema', 80),
    asset_id: read('guardian_asset_id', 100),
    source_sha256: read('guardian_source_sha256', 64).toLowerCase(),
    secured_sha256: read('guardian_secured_sha256', 64).toLowerCase(),
    phash: read('guardian_phash', 16).toLowerCase(),
    dhash: read('guardian_dhash', 16).toLowerCase(),
    watermark_valid: read('guardian_watermark_valid', 8).toLowerCase(),
    c2pa_signed: read('guardian_c2pa_signed', 8).toLowerCase(),
    c2pa_valid: read('guardian_c2pa_valid', 8).toLowerCase(),
    metadata_written: read('guardian_metadata_written', 8).toLowerCase(),
    report_sha256: read('guardian_report_sha256', 64).toLowerCase(),
    signature: read('guardian_evidence_signature', 64).toLowerCase(),
  };

  if (evidence.schema !== EVIDENCE_SCHEMA) throw new UploadFailure('guardian_schema_invalid', 422);
  if (!/^[a-f0-9-]{32,64}$/.test(evidence.asset_id)) {
    throw new UploadFailure('guardian_asset_id_invalid', 422);
  }
  if (![evidence.source_sha256, evidence.secured_sha256, evidence.report_sha256, evidence.signature]
    .every((value) => SHA256_PATTERN.test(value))) {
    throw new UploadFailure('guardian_digest_invalid', 422);
  }
  if (![evidence.phash, evidence.dhash].every((value) => FINGERPRINT_PATTERN.test(value))) {
    throw new UploadFailure('guardian_fingerprint_invalid', 422);
  }
  if ([
    evidence.watermark_valid,
    evidence.c2pa_signed,
    evidence.c2pa_valid,
    evidence.metadata_written,
  ].some((value) => value !== 'true')) {
    throw new UploadFailure('guardian_controls_incomplete', 422);
  }
  return evidence;
}

async function verifyGuardianEvidence(evidence, configuredSecret) {
  const secret = String(configuredSecret || '');
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new UploadFailure('guardian_verifier_unavailable', 503);
  }
  const canonical = [
    evidence.schema,
    evidence.asset_id,
    evidence.source_sha256,
    evidence.secured_sha256,
    evidence.phash,
    evidence.dhash,
    evidence.watermark_valid,
    evidence.c2pa_signed,
    evidence.c2pa_valid,
    evidence.metadata_written,
    evidence.report_sha256,
  ].join('\n');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(evidence.signature),
    encoder.encode(canonical),
  );
  if (!valid) throw new UploadFailure('guardian_evidence_invalid', 422);
}

async function timingSafeSecretEqual(supplied, expected) {
  if (!supplied || !expected) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(supplied))),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(expected))),
  ]);
  return crypto.subtle.timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

async function timingSafeHexEqual(left, right) {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return crypto.subtle.timingSafeEqual(hexToBytes(left), hexToBytes(right));
}

function hexToBytes(value) {
  return Uint8Array.from(String(value).match(/.{2}/g) || [], (part) => Number.parseInt(part, 16));
}

async function loadJsonObject(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
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

function magicMatches(bytes, type) {
  if (type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  if (['video/mp4', 'video/quicktime', 'video/x-m4v'].includes(type)) {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  }
  return false;
}

function safeFilename(value) {
  return String(value || 'media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function clean(value, max = 120) {
  return String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value));
  return sha256Hex(bytes.buffer);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
