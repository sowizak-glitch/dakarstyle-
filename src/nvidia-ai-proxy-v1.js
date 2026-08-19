const DEFAULT_GATEWAY = 'https://sowhatafrica.com/api/ai';
const ROUTES = new Set([
  'status',
  'chat',
  'embed',
  'rerank',
  'safety',
  'ocr',
  'vision/extract',
  'knowledge/upsert',
  'knowledge/search',
  'knowledge/answer',
  'video/director',
  'video/clean-plan',
  'video/clean',
]);

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    return source.origin === target.origin
      || (source.protocol === 'https:' && (source.hostname === 'dakarstyle.com' || source.hostname.endsWith('.dakarstyle.com')));
  } catch {
    return false;
  }
}

function cors(request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigin(request)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

function routeName(pathname) {
  const prefix = '/api/sowhat-ai/';
  if (!pathname.startsWith(prefix)) return '';
  return pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
}

function gatewayBase(env) {
  return clean(env.SOWHAT_AI_GATEWAY_URL || DEFAULT_GATEWAY, 1000).replace(/\/+$/, '');
}

function bodyTooLarge(request, maxBytes) {
  const length = Number(request.headers.get('content-length') || 0);
  return Number.isFinite(length) && length > maxBytes;
}

async function proxy(request, env, route) {
  const isStatus = route === 'status';
  if (!isStatus && !env.SOWHAT_AI_GATEWAY_TOKEN) {
    return json({ ok: false, error: 'sowhat_ai_gateway_token_not_configured' }, 503, cors(request));
  }

  const maxBytes = route === 'ocr' || route === 'vision/extract'
    ? 8 * 1024 * 1024
    : route === 'knowledge/upsert'
      ? 512 * 1024
      : 256 * 1024;
  if (bodyTooLarge(request, maxBytes)) return json({ ok: false, error: 'payload_too_large' }, 413, cors(request));

  const isLong = route.startsWith('video/') || route.startsWith('knowledge/') || route.startsWith('vision/') || route === 'ocr';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), isLong ? 150000 : 95000);
  try {
    const headers = { accept: 'application/json' };
    if (!isStatus) headers['x-sowhat-ai-token'] = env.SOWHAT_AI_GATEWAY_TOKEN;
    let body;
    if (request.method === 'POST') {
      headers['content-type'] = 'application/json';
      body = await request.text();
    }
    const upstream = await fetch(`${gatewayBase(env)}/${route}`, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });
    const responseHeaders = { ...cors(request), 'cache-control': 'no-store' };
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    responseHeaders['content-type'] = contentType;
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return json({ ok: false, error: error?.name === 'AbortError' ? 'ai_gateway_timeout' : 'ai_gateway_unavailable' }, error?.name === 'AbortError' ? 504 : 503, cors(request));
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request);
    if (!allowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const route = routeName(url.pathname);
    if (!ROUTES.has(route)) return json({ ok: false, error: 'not_found' }, 404, headers);
    if (route === 'status' && request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
    if (route !== 'status' && request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
    return proxy(request, env, route);
  },
};
