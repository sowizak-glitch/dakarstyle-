import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const VERSION = '5.4.0';
const PROJECT_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ALLOWED = new Set(['samabusiness-campaign', 'sowhat-africa-campaign']);

function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch { /* fallback */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function client() {
  const key = serviceKey();
  if (!key) throw new Error('SERVICE_KEY_MISSING');
  return createClient(PROJECT_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function responseHeaders(type = 'application/json; charset=utf-8', etag = '') {
  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': type.startsWith('image/') ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000, immutable' : 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-SeneCompare-Media-Version': VERSION,
  });
  if (etag) headers.set('ETag', `"${etag}"`);
  return headers;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders() });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders() });
  if (url.pathname.endsWith('/health')) return json({ ok: true, version: VERSION, assets: [...ALLOWED] });
  if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const file = url.pathname.split('/').filter(Boolean).at(-1) || '';
  const slug = file.replace(/\.(webp|jpg|jpeg|png)$/i, '');
  if (!ALLOWED.has(slug)) return json({ ok: false, code: 'MEDIA_NOT_FOUND' }, 404);

  try {
    const { data, error } = await client()
      .from('senecompare_media_assets')
      .select('mime_type,content_base64,sha256')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data?.content_base64) return json({ ok: false, code: 'MEDIA_NOT_READY' }, 404);
    const etag = data.sha256 || '';
    if (etag && request.headers.get('if-none-match') === `"${etag}"`) {
      return new Response(null, { status: 304, headers: responseHeaders(data.mime_type, etag) });
    }
    const body = request.method === 'HEAD' ? null : decodeBase64(data.content_base64);
    return new Response(body, { status: 200, headers: responseHeaders(data.mime_type, etag) });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_media_error', detail: String(error) }));
    return json({ ok: false, code: 'MEDIA_UNAVAILABLE' }, 503);
  }
});
