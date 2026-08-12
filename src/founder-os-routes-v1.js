import { authorizeV5 } from './social-intelligence-v5-routes.js';
import { issueCsrfToken, verifyCsrfToken } from './security-v5.js';
import {
  FOUNDER_OS_VERSION,
  snapshot,
  runHealthCycle,
  decide,
  updateAlert,
  reserveFounderOsAction,
} from './founder-os-runtime-v1.js';
import { renderFounderOsDocument } from './founder-os-ui-v1.js';
import { FOUNDER_OS_CLIENT_JS } from './founder-os-client-v1.js';

export const FOUNDER_OS_ROUTE = '/founder-os';
export const FOUNDER_OS_API_PREFIX = '/api/founder-os/';

const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store, no-cache, must-revalidate',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
});

const PAGE_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function isFounderOsRoute(url) {
  return url.pathname === FOUNDER_OS_ROUTE
    || url.pathname === `${FOUNDER_OS_ROUTE}/`
    || url.pathname === `${FOUNDER_OS_ROUTE}/client.js`
    || url.pathname.startsWith(FOUNDER_OS_API_PREFIX);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, 'content-security-policy': PAGE_CSP, 'content-type': 'text/html; charset=utf-8' },
  });
}

function javascript(body) {
  return new Response(body, {
    status: 200,
    headers: { ...SECURITY_HEADERS, 'content-type': 'application/javascript; charset=utf-8' },
  });
}

function loginRedirect() {
  return new Response(null, {
    status: 302,
    headers: { ...SECURITY_HEADERS, location: '/social-intelligence' },
  });
}

async function readBody(request) {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return { ok: false, error: 'content_type_required' };
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid_json' };
    return { ok: true, body };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}

async function requireWriteSecurity(request, env, principal, now) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return { ok: false, status: 403, error: 'csrf_origin_invalid' };
  const csrf = await verifyCsrfToken(env, principal, request.headers.get('x-sowhat-csrf') || '', now);
  if (!csrf.valid) return { ok: false, status: 403, error: csrf.code || 'csrf_invalid' };
  const idempotency = String(request.headers.get('x-founder-os-idempotency') || '').trim();
  if (!idempotency) return { ok: false, status: 400, error: 'idempotency_key_required' };
  const reservation = await reserveFounderOsAction(env, idempotency, { principal, path: new URL(request.url).pathname });
  if (!reservation.reserved) {
    return { ok: false, status: reservation.duplicate ? 409 : 503, error: reservation.duplicate ? 'duplicate_action' : reservation.error || 'idempotency_unavailable' };
  }
  return { ok: true };
}

export async function handleFounderOs(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  const now = Number(options.now) || Date.now();

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SECURITY_HEADERS });

  if (url.pathname === `${FOUNDER_OS_API_PREFIX}health`) {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
    return json({ ok: true, service: 'founder-os', version: FOUNDER_OS_VERSION, authentication: 'required-for-data' });
  }

  const auth = await authorizeV5(request, env);
  if (!auth.ok) {
    if (['GET', 'HEAD'].includes(request.method) && url.pathname.startsWith(FOUNDER_OS_ROUTE)) return loginRedirect();
    return json({ ok: false, error: auth.error || 'unauthorized' }, auth.status || 401);
  }

  if (url.pathname === `${FOUNDER_OS_ROUTE}/client.js`) {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
    return javascript(request.method === 'HEAD' ? '' : FOUNDER_OS_CLIENT_JS);
  }

  if (url.pathname === FOUNDER_OS_ROUTE || url.pathname === `${FOUNDER_OS_ROUTE}/`) {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
    const data = await snapshot(env, { now });
    const csrfToken = await issueCsrfToken(env, auth.principal, now);
    const body = renderFounderOsDocument(data, csrfToken);
    return html(request.method === 'HEAD' ? '' : body);
  }

  if (url.pathname === `${FOUNDER_OS_API_PREFIX}snapshot`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return json({ ok: true, data: await snapshot(env, { now }) });
  }

  if (url.pathname === `${FOUNDER_OS_API_PREFIX}refresh`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const secure = await requireWriteSecurity(request, env, auth.principal, now);
    if (!secure.ok) return json({ ok: false, error: secure.error }, secure.status);
    const parsed = await readBody(request);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const state = await runHealthCycle(env, { now, fetcher: options.fetcher, origin: url.origin });
    return json({ ok: true, health: state.health, reason: String(parsed.body.reason || 'manual').slice(0, 80) });
  }

  if (url.pathname === `${FOUNDER_OS_API_PREFIX}decision`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const secure = await requireWriteSecurity(request, env, auth.principal, now);
    if (!secure.ok) return json({ ok: false, error: secure.error }, secure.status);
    const parsed = await readBody(request);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const id = String(parsed.body.id || '').slice(0, 160);
    const action = String(parsed.body.action || '').toLowerCase();
    const result = await decide(env, id, action, auth.principal);
    return json({ ok: result.ok, decision: result.decision, outbox_queued: result.outbox_queued, error: result.error }, result.status);
  }

  if (url.pathname === `${FOUNDER_OS_API_PREFIX}alert`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const secure = await requireWriteSecurity(request, env, auth.principal, now);
    if (!secure.ok) return json({ ok: false, error: secure.error }, secure.status);
    const parsed = await readBody(request);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const id = String(parsed.body.id || '').slice(0, 160);
    const action = String(parsed.body.action || '').toLowerCase();
    const result = await updateAlert(env, id, action, auth.principal);
    return json({ ok: result.ok, alert: result.alert, error: result.error }, result.status);
  }

  return json({ ok: false, error: 'not_found' }, 404);
}
