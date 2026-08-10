/**
 * SOWHAT Control V5 - Routage
 *
 * Espace de noms dedie `/social-intelligence/v5` et `/api/social-intelligence/v5/`.
 * Aucune route V4 n est interceptee, aucun comportement V4 n est modifie : la
 * V5 s ajoute a cote, elle ne se substitue pas.
 *
 * Authentification propre a la V5, independante de la session V4 : une cle
 * d administration dont seul le condensat est stocke en configuration. Sans
 * condensat configure, tout est refuse.
 */

import { createInstagramClient, isInstagramConfigured } from './instagram-client-v5.js';
import { readMediaRecords, readAccountHistory, runIncrementalSync } from './instagram-sync-v5.js';
import { buildContentMemory } from './content-memory-v5.js';
import { buildCoachBriefing } from './coach-v5.js';
import { buildSevenDayPlan } from './plan-v5.js';
import { scoreAll } from './sowhat-score-v5.js';
import { publicationQueue } from './studio-v5.js';
import { runScheduler } from './scheduler-v5.js';
import { buildTechnicalCockpit, createLogger, newRequestId } from './observability-v5.js';
import { renderCockpitDocument } from './social-intelligence-ui-v5.js';
import { constantTimeEqual, verifyCsrfToken } from './security-v5.js';

export const V5_ROUTE_PREFIX = '/social-intelligence/v5';
export const V5_API_PREFIX = '/api/social-intelligence/v5/';

const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow, noarchive',
});

/** CSP stricte : aucun script, aucune ressource externe, aucun cadre. */
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function isSocialIntelligenceV5Route(url) {
  return url.pathname === V5_ROUTE_PREFIX
    || url.pathname.startsWith(`${V5_ROUTE_PREFIX}/`)
    || url.pathname.startsWith(V5_API_PREFIX);
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, ...extra, 'content-type': 'application/json; charset=utf-8' },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, 'content-security-policy': CSP, 'content-type': 'text/html; charset=utf-8' },
  });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value ?? '')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Autorisation. Fail closed : condensat absent ou mal forme, en-tete absent,
 * ou comparaison negative, tout finit par un refus. La comparaison est a duree
 * constante pour ne pas renseigner un attaquant sur le prefixe correct.
 */
export async function authorizeV5(request, env) {
  const expected = String(env?.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return { ok: false, status: 503, error: 'v5_admin_key_not_configured' };
  const provided = String(request.headers.get('x-sowhat-admin-key') || '').trim();
  if (!provided) return { ok: false, status: 401, error: 'unauthorized' };
  const hashed = await sha256Hex(provided);
  if (!constantTimeEqual(hashed, expected)) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}

/** Toute ecriture exige un jeton CSRF valide, en plus de l autorisation. */
async function requireCsrf(request, env, now) {
  const token = request.headers.get('x-sowhat-csrf') || '';
  const session = request.headers.get('x-sowhat-session') || 'v5-admin';
  const result = await verifyCsrfToken(env, session, token, now);
  return result.valid ? { ok: true } : { ok: false, status: 403, error: result.code };
}

/* ------------------------------------------------------------------ */
/* Lecture de l etat                                                   */
/* ------------------------------------------------------------------ */

async function loadCockpit(env, options = {}) {
  const now = Number(options.now) || Date.now();
  let tokenHealth = { status: 'not_configured', checked_at: null };
  if (isInstagramConfigured(env) && options.client) {
    try { tokenHealth = await options.client.checkTokenHealth(); } catch { tokenHealth = { status: 'unknown', checked_at: null }; }
  }
  const queue = await publicationQueue(env, { now });
  return buildTechnicalCockpit(env, { now, tokenHealth, queue });
}

async function loadIntelligence(env, now) {
  const records = await readMediaRecords(env);
  const scores = new Map(scoreAll(records, { now })
    .filter((entry) => entry.score !== null)
    .map((entry) => [entry.instagram_media_id, entry.score]));
  const memory = buildContentMemory(records, { now, scores });
  const briefing = buildCoachBriefing(memory);
  return { records, memory, briefing };
}

/* ------------------------------------------------------------------ */
/* Routage                                                             */
/* ------------------------------------------------------------------ */

export async function handleSocialIntelligenceV5(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  const now = Number(options.now) || Date.now();
  const requestId = newRequestId(now);
  const logger = createLogger({ base: { request_id: requestId }, now: () => now, sink: options.sink });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SECURITY_HEADERS });

  const auth = await authorizeV5(request, env);
  if (!auth.ok) {
    logger.warn('v5_unauthorized', { path: url.pathname, status: auth.status });
    return json({ ok: false, error: auth.error, request_id: requestId }, auth.status);
  }

  const client = isInstagramConfigured(env) ? createInstagramClient(env, options.clientOptions) : null;

  // --- Cockpit HTML ---
  if (url.pathname === V5_ROUTE_PREFIX || url.pathname === `${V5_ROUTE_PREFIX}/`) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }
    const cockpit = await loadCockpit(env, { now, client });
    logger.info('v5_cockpit_rendered', { path: url.pathname });
    return html(renderCockpitDocument(cockpit));
  }

  // --- Cockpit JSON ---
  if (url.pathname === `${V5_API_PREFIX}cockpit`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const cockpit = await loadCockpit(env, { now, client });
    return json({ ok: true, request_id: requestId, cockpit });
  }

  // --- Intelligence : score, memoire, coach ---
  if (url.pathname === `${V5_API_PREFIX}intelligence`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const { records, memory, briefing } = await loadIntelligence(env, now);
    return json({
      ok: true,
      request_id: requestId,
      corpus: memory.corpus,
      baselines: memory.baselines,
      correlations: memory.correlations.slice(0, 20),
      briefing,
      records_count: records.length,
    });
  }

  // --- Plan 7 jours ---
  if (url.pathname === `${V5_API_PREFIX}plan`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const { memory, briefing } = await loadIntelligence(env, now);
    return json({ ok: true, request_id: requestId, plan: buildSevenDayPlan(memory, { now, briefing }) });
  }

  // --- File de publication ---
  if (url.pathname === `${V5_API_PREFIX}queue`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return json({ ok: true, request_id: requestId, queue: await publicationQueue(env, { now }) });
  }

  // --- Synchronisation manuelle ---
  if (url.pathname === `${V5_API_PREFIX}sync`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const csrf = await requireCsrf(request, env, now);
    if (!csrf.ok) return json({ ok: false, error: csrf.error, request_id: requestId }, csrf.status);
    if (!client) return json({ ok: false, error: 'meta_not_configured', request_id: requestId }, 503);
    const run = await runIncrementalSync(env, client, { now: () => now });
    logger.info('v5_sync', { sync_id: run.sync_id, status: run.status, duration_ms: run.duration_ms });
    return json({ ok: run.status !== 'failed', request_id: requestId, run }, run.status === 'failed' ? 502 : 200);
  }

  // --- Execution du scheduler ---
  if (url.pathname === `${V5_API_PREFIX}scheduler/run`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const csrf = await requireCsrf(request, env, now);
    if (!csrf.ok) return json({ ok: false, error: csrf.error, request_id: requestId }, csrf.status);
    if (!client) return json({ ok: false, error: 'meta_not_configured', request_id: requestId }, 503);
    const run = await runScheduler(env, client, { now: () => now, ...options.schedulerOptions });
    logger.info('v5_scheduler', { run_id: run.run_id, status: run.status, published: run.published });
    return json({ ok: true, request_id: requestId, run });
  }

  // --- Historique de compte ---
  if (url.pathname === `${V5_API_PREFIX}account-history`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return json({ ok: true, request_id: requestId, history: await readAccountHistory(env) });
  }

  return json({ ok: false, error: 'not_found', request_id: requestId }, 404);
}
