import { capabilities, findResults, getStats, parseQuery, proxyLegacy } from './engine.ts';
const VERSION = '5.0.0';
const SECURITY_REVISION = '2026-08-05.1';
const PROD = 'https://senecompare.dakarstyle.com';
const ALLOWED = new Set([
  PROD,
  'https://senecompare-ai.vercel.app',
  'http://localhost:5173'
]);
const MAX_SEARCH_BODY_BYTES = 16_384;
const MAX_EVENT_BODY_BYTES = 8_192;
function route(url) {
  if (url.pathname.endsWith('/stats')) return 'stats';
  if (url.pathname.endsWith('/search')) return 'search';
  if (url.pathname.endsWith('/click')) return 'click';
  if (url.pathname.endsWith('/feedback')) return 'feedback';
  if (url.pathname.endsWith('/health') || url.pathname.endsWith('/senecompare-production')) return 'health';
  return 'unknown';
}
function originAllowed(req) {
  const origin = req.headers.get('origin');
  return !origin || ALLOWED.has(origin);
}
function responseHeaders(req) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : PROD,
    'Access-Control-Allow-Headers': 'content-type,x-client-version,x-senecompare-gateway',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SeneCompare-Engine-Security': SECURITY_REVISION,
    'X-SeneCompare-Version': VERSION,
    Vary: 'Origin'
  };
}
function json(req, value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      ...extra
    }
  });
}
async function readBody(req, maxBytes) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  return text;
}
async function readJson(req, maxBytes) {
  if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('JSON_REQUIRED'), {
      status: 415
    });
  }
  const text = await readBody(req, maxBytes);
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch  {
    throw Object.assign(new Error('INVALID_JSON'), {
      status: 400
    });
  }
}
Deno.serve(async (req)=>{
  const currentRoute = route(new URL(req.url));
  if (req.method === 'OPTIONS') {
    if (!originAllowed(req)) return new Response(null, {
      status: 403,
      headers: responseHeaders(req)
    });
    return new Response(null, {
      status: 204,
      headers: responseHeaders(req)
    });
  }
  if (!originAllowed(req)) return json(req, {
    ok: false,
    code: 'ORIGIN_FORBIDDEN'
  }, 403);
  try {
    if (req.method === 'GET' && currentRoute === 'stats') return json(req, await getStats(req));
    if (req.method === 'GET' && currentRoute === 'health') {
      return json(req, {
        ok: true,
        service: 'SeneCompare Hybrid Local Search Engine',
        version: VERSION,
        security_revision: SECURITY_REVISION,
        hybrid_search: true,
        guaranteed_continuity: true,
        directory_sources: true,
        typo_tolerance: true,
        wolof_intent_aliases: true,
        supports_unpriced_services: true,
        capabilities,
        timestamp: new Date().toISOString()
      });
    }
    if (req.method === 'POST' && currentRoute === 'search') {
      const input = await readJson(req, MAX_SEARCH_BODY_BYTES);
      const query = typeof input.query === 'string' ? input.query.trim() : '';
      if (query.length < 2 || query.length > 320) {
        return json(req, {
          ok: false,
          code: 'QUERY_INVALID',
          message: 'La recherche doit contenir entre 2 et 320 caractères.'
        }, 400);
      }
      input.query = query;
      const parsed = parseQuery(query, typeof input.category === 'string' ? input.category : '');
      const data = await findResults(req, input, parsed);
      return json(req, {
        ok: true,
        version: VERSION,
        search_id: data.search_id,
        parsed,
        results: data.results,
        suggestions: data.suggestions,
        meta: data.meta
      }, 200, {
        'Server-Timing': `total;dur=${data.meta.response_ms}`
      });
    }
    if (req.method === 'POST' && (currentRoute === 'click' || currentRoute === 'feedback')) {
      const body = await readBody(req, MAX_EVENT_BODY_BYTES);
      JSON.parse(body || '{}');
      try {
        const response = await proxyLegacy(`/${currentRoute}`, req, body);
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...responseHeaders(req),
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      } catch  {
        return json(req, {
          ok: true,
          queued: false
        });
      }
    }
    if (![
      'GET',
      'POST'
    ].includes(req.method)) return json(req, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED'
    }, 405, {
      Allow: 'GET,POST,OPTIONS'
    });
    return json(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
  } catch (error) {
    const status = Number(error?.status || 500);
    const message = String(error?.message || 'INTERNAL_ERROR');
    if (status === 413) return json(req, {
      ok: false,
      code: 'PAYLOAD_TOO_LARGE'
    }, 413);
    if (status === 415) return json(req, {
      ok: false,
      code: 'JSON_REQUIRED'
    }, 415);
    if (status === 400 && message === 'INVALID_JSON') return json(req, {
      ok: false,
      code: 'INVALID_JSON'
    }, 400);
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({
      request_id: requestId,
      message
    }));
    return json(req, {
      ok: false,
      code: 'INTERNAL_ERROR',
      request_id: requestId,
      message: 'La recherche a rencontré un problème temporaire.'
    }, 500);
  }
});
