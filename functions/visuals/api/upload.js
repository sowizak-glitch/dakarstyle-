export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-SOWHAT-KEY',
    'Content-Type': 'application/json; charset=utf-8',
  };

  try {
    const apiKey = request.headers.get('X-SOWHAT-KEY') || '';
    if (!env.SOWHAT_UPLOAD_API_KEY || apiKey !== env.SOWHAT_UPLOAD_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    if (!env.VISUALS_BUCKET) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: 'file_required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const rawAssetId = String(form.get('asset_id') || '').trim();
    const assetId = sanitizeAssetId(rawAssetId || makeAssetId());
    const title = String(form.get('title') || '').trim();
    const collection = String(form.get('collection') || '').trim();
    const product = String(form.get('product') || '').trim();
    const publicationType = String(form.get('publication_type') || 'POST IMAGE').trim().toUpperCase();
    const mediaKind = String(form.get('media_kind') || inferMediaKind(file)).trim().toUpperCase();
    const altText = String(form.get('alt_text') || '').trim();
    const publish = String(form.get('publish') || 'false').trim().toLowerCase() === 'true';

    if (!['POST IMAGE', 'REEL', 'STORY'].includes(publicationType)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_publication_type' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!['IMAGE', 'VIDEO'].includes(mediaKind)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_media_kind' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (publicationType === 'POST IMAGE' && mediaKind !== 'IMAGE') {
      return new Response(JSON.stringify({ ok: false, error: 'post_image_requires_image' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (publicationType === 'REEL' && mediaKind !== 'VIDEO') {
      return new Response(JSON.stringify({ ok: false, error: 'reel_requires_video' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const ext = inferExtension(file);
    if (!ext) {
      return new Response(JSON.stringify({ ok: false, error: 'unsupported_file_type' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const mediaKey = `visuals/media/${assetId}.${ext}`;
    const manifestKey = `visuals/manifest/${assetId}.json`;

    const buffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(buffer);
    const contentType = file.type || contentTypeFromExtension(ext);

    await env.VISUALS_BUCKET.put(mediaKey, buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        asset_id: assetId,
        title,
        collection,
        product,
        publication_type: publicationType,
        media_kind: mediaKind,
        alt_text: altText,
        original_filename: file.name || `${assetId}.${ext}`,
        sha256,
      },
    });

    const mediaBase = String(
      env.VISUALS_PUBLIC_BASE_URL || env.PUBLIC_MEDIA_BASE_URL || `${new URL(request.url).origin}/visuals/media`
    ).replace(/\/$/, '');
    const manifestBase = String(
      env.MANIFEST_PUBLIC_BASE_URL || `${new URL(request.url).origin}/visuals/manifest`
    ).replace(/\/$/, '');
    const mediaUrl = `${mediaBase}/${assetId}.${ext}`;
    const manifestUrl = `${manifestBase}/${assetId}.json`;

    const manifest = {
      ok: true,
      asset_id: assetId,
      title,
      collection,
      product,
      publication_type: publicationType,
      media_kind: mediaKind,
      media_url: mediaUrl,
      canonical_url: mediaUrl,
      manifest_url: manifestUrl,
      alt_text: altText,
      publish,
      watermark_applied: false,
      sha256,
      size_bytes: buffer.byteLength,
      content_type: contentType,
      original_filename: file.name || `${assetId}.${ext}`,
      uploaded_at: new Date().toISOString(),
      source: 'form_upload',
    };

    await env.VISUALS_BUCKET.put(manifestKey, JSON.stringify(manifest, null, 2), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'public, max-age=300',
      },
      customMetadata: {
        asset_id: assetId,
        media_kind: mediaKind,
        publication_type: publicationType,
      },
    });

    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'upload_failed',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-SOWHAT-KEY',
    },
  });
}

function sanitizeAssetId(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || makeAssetId();
}

function makeAssetId() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(8, 'X').slice(0, 8);
  return `SWA-${y}${m}${day}-${rand}`;
}

function inferMediaKind(file) {
  return (file?.type || '').startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

function inferExtension(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  const byType = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
  };
  if (byType[type]) return byType[type];
  const m = name.match(/\.([a-z0-9]+)$/i);
  if (!m) return '';
  const ext = m[1].toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v'].includes(ext)
    ? (ext === 'jpeg' ? 'jpg' : ext)
    : '';
}

function contentTypeFromExtension(ext) {
  switch (ext) {
    case 'jpg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'm4v': return 'video/x-m4v';
    default: return 'application/octet-stream';
  }
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
