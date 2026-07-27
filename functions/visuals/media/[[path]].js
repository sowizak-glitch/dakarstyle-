export async function onRequestGet(context) {
  const { env, params } = context;
  const bucket = resolveBucket(env);
  if (!bucket) {
    return Response.json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, { status: 500 });
  }

  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const relative = parts.map(String).join('/');
  if (!relative || relative.includes('..')) {
    return Response.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }

  const key = `visuals/media/${relative}`;
  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

function resolveBucket(env) {
  if (env?.VISUALS_BUCKET && typeof env.VISUALS_BUCKET.get === 'function') return env.VISUALS_BUCKET;
  for (const value of Object.values(env || {})) {
    if (value && typeof value === 'object' && typeof value.get === 'function' && typeof value.put === 'function') {
      return value;
    }
  }
  return null;
}
