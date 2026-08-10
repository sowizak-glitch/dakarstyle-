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
import { buildCoachBriefing, prefillDraftFromRecommendation } from './coach-v5.js';
import { buildSevenDayPlan, prefillDraftFromPlanDay } from './plan-v5.js';
import { scoreAll } from './sowhat-score-v5.js';
import { publicationQueue } from './studio-v5.js';
import { runScheduler } from './scheduler-v5.js';
import { buildTechnicalCockpit, createLogger, newRequestId } from './observability-v5.js';
import { renderCockpitDocument } from './social-intelligence-ui-v5.js';
import { STUDIO_CLIENT_ROUTE, STUDIO_ROUTE, renderStudioDocument } from './studio-ui-v5.js';
import { STUDIO_CLIENT_CONTENT_TYPE, STUDIO_CLIENT_JS } from './studio-client-v5.js';
import { handleStudioApi, isStudioApiPath } from './studio-routes-v5.js';
import { handleMediaUpload, isV5PublicMediaPath, serveV5Media } from './media-upload-v5.js';
import { constantTimeEqual, issueCsrfToken, verifyCsrfToken } from './security-v5.js';

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

/**
 * CSP du Studio. L ecran d edition a besoin de JavaScript : choisir un
 * fichier, en montrer l apercu, suivre l envoi. Le script est servi depuis
 * cette origine et rien d autre n est autorise — pas d`unsafe-inline`, pas de
 * `unsafe-eval`, aucune origine tierce. `blob:` couvre l apercu local du
 * fichier choisi, qui ne quitte pas le navigateur tant qu il n est pas envoye.
 */
const STUDIO_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; "
  + "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
  + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Session du cockpit V4, telle qu elle est deja posee par la V4. */
const V4_SESSION_COOKIE = '__Host-sowhat_si';
const V4_SESSION_PREFIX = 'visuals/social-intelligence/sessions/';

export function isSocialIntelligenceV5Route(url) {
  return url.pathname === V5_ROUTE_PREFIX
    || url.pathname.startsWith(`${V5_ROUTE_PREFIX}/`)
    || url.pathname.startsWith(V5_API_PREFIX)
    // Les medias V5 sont servis publiquement : Meta doit pouvoir les
    // telecharger sans authentification. Ce chemin est distinct de
    // `/visuals/media/` et `/visuals/manifest/`, qui restent a la V4.
    || isV5PublicMediaPath(url.pathname);
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

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

/**
 * Session navigateur. La V5 n ouvre pas une seconde porte : elle reconnait la
 * session que la V4 a deja creee apres saisie du mot de passe du cockpit,
 * avec la meme duree de vie et le meme stockage.
 *
 * C est ce qui rend l ecran « Publier » atteignable depuis un telephone : un
 * navigateur ne peut pas poser d en-tete `x-sowhat-admin-key` en suivant un
 * lien. Sans cela, l interface existerait sans etre accessible.
 */
async function authorizeBrowserSession(request, env) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.get !== 'function') return null;
  const token = readCookie(request.headers.get('cookie'), V4_SESSION_COOKIE);
  if (!token || token.length < 32) return null;
  const digest = await sha256Hex(token);
  try {
    const object = await bucket.get(`${V4_SESSION_PREFIX}${digest}.json`);
    if (!object) return null;
    const session = JSON.parse(await object.text());
    if (!session || Number(session.expires_at || 0) <= Date.now()) return null;
    // L identifiant de session utilise pour le CSRF derive du condensat du
    // jeton : il n est ni devinable, ni transferable a une autre session.
    return `session:${digest.slice(0, 32)}`;
  } catch {
    return null;
  }
}

/**
 * Autorisation. Fail closed : condensat absent ou mal forme, aucun credential
 * reconnu, ou comparaison negative, tout finit par un refus. La comparaison
 * est a duree constante pour ne pas renseigner un attaquant sur le prefixe
 * correct.
 *
 * Deux porteurs acceptes, au meme niveau de privilege :
 *   - la cle d administration en en-tete, pour les outils ;
 *   - la session du cockpit V4 en cookie, pour un vrai navigateur.
 */
export async function authorizeV5(request, env) {
  const expected = String(env?.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return { ok: false, status: 503, error: 'v5_admin_key_not_configured' };

  const provided = String(request.headers.get('x-sowhat-admin-key') || '').trim();
  if (provided) {
    const hashed = await sha256Hex(provided);
    if (constantTimeEqual(hashed, expected)) return { ok: true, principal: 'v5-admin', via: 'admin_key' };
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const session = await authorizeBrowserSession(request, env);
  if (session) return { ok: true, principal: session, via: 'session' };

  return { ok: false, status: 401, error: 'unauthorized' };
}

/**
 * Toute ecriture exige un jeton CSRF valide, en plus de l autorisation.
 *
 * L identifiant de session vient du PORTEUR, jamais d un en-tete choisi par
 * l appelant : laisser le client nommer sa propre session reviendrait a le
 * laisser choisir contre quoi son jeton est verifie.
 *
 * Pour une session navigateur, l en-tete `Origin` — quand il est present —
 * doit correspondre a la cible. Un formulaire d un autre site ne peut ni
 * poser l en-tete CSRF, ni maquiller son origine.
 */
async function requireCsrf(request, env, now, principal) {
  if (String(principal || '').startsWith('session:')) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return { ok: false, status: 403, error: 'csrf_invalid' };
    }
  }
  const token = request.headers.get('x-sowhat-csrf') || '';
  const result = await verifyCsrfToken(env, principal || 'v5-admin', token, now);
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

  // --- Media public : le seul chemin V5 sans authentification ---
  // Meta telecharge le fichier lui-meme, sans cookie ni en-tete : exiger une
  // authentification ici rendrait toute publication impossible. La lecture est
  // bornee au prefixe des medias V5 et aux types de l allowlist.
  if (isV5PublicMediaPath(url.pathname)) {
    logger.info('v5_media_served', { path: url.pathname, method: request.method });
    return serveV5Media(request, env);
  }

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
    const csrf = await requireCsrf(request, env, now, auth.principal);
    if (!csrf.ok) return json({ ok: false, error: csrf.error, request_id: requestId }, csrf.status);
    if (!client) return json({ ok: false, error: 'meta_not_configured', request_id: requestId }, 503);
    const run = await runIncrementalSync(env, client, { now: () => now });
    logger.info('v5_sync', { sync_id: run.sync_id, status: run.status, duration_ms: run.duration_ms });
    return json({ ok: run.status !== 'failed', request_id: requestId, run }, run.status === 'failed' ? 502 : 200);
  }

  // --- Execution du scheduler ---
  if (url.pathname === `${V5_API_PREFIX}scheduler/run`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const csrf = await requireCsrf(request, env, now, auth.principal);
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

  // --- Jeton CSRF de la session en cours ---
  // Le jeton est lie au porteur authentifie. Il ne vaut rien ailleurs, et
  // n est jamais emis pour une session que l appelant aurait nommee lui-meme.
  if (url.pathname === `${V5_API_PREFIX}csrf`) {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    try {
      const token = await issueCsrfToken(env, auth.principal, now);
      return json({ ok: true, request_id: requestId, csrf_token: token });
    } catch (error) {
      return json({ ok: false, error: error.code || 'csrf_not_configured', request_id: requestId }, 503);
    }
  }

  // --- Script du Studio ---
  // Servi a part pour que la page tienne sous une CSP sans `unsafe-inline`.
  if (url.pathname === STUDIO_CLIENT_ROUTE) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }
    return new Response(request.method === 'HEAD' ? null : STUDIO_CLIENT_JS, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        'content-type': STUDIO_CLIENT_CONTENT_TYPE,
        'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  }

  // --- Ecran « Publier » ---
  if (url.pathname === STUDIO_ROUTE || url.pathname === `${STUDIO_ROUTE}/`) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }
    // Le preremplissage est resolu cote serveur : le lien « Creer a partir de
    // ce jour » arrive avec sa source, et l ecran s ouvre deja rempli.
    let prefill = null;
    const source = String(url.searchParams.get('source') || '').trim().toLowerCase();
    if (source === 'plan' || source === 'coach') {
      try {
        const { memory, briefing } = await loadIntelligence(env, now);
        if (source === 'plan') {
          const plan = buildSevenDayPlan(memory, { now, briefing });
          prefill = prefillDraftFromPlanDay(plan, Number(url.searchParams.get('day')), { now });
        } else {
          prefill = prefillDraftFromRecommendation(briefing, url.searchParams.get('recommendation'), { now });
        }
      } catch (error) {
        // Un preremplissage impossible ne doit pas priver l operateur de
        // l ecran : il ouvre vide, et il le sait.
        logger.warn('v5_studio_prefill_failed', { source, code: error.code || 'unknown' });
        prefill = null;
      }
    }
    logger.info('v5_studio_rendered', { source: source || 'direct', prefilled: Boolean(prefill) });
    const page = renderStudioDocument({
      prefill,
      draftId: url.searchParams.get('draft') || '',
    });
    return new Response(request.method === 'HEAD' ? null : page, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        'content-security-policy': STUDIO_CSP,
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }

  // --- Televersement d un media ---
  if (url.pathname === `${V5_API_PREFIX}media/upload`) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const csrf = await requireCsrf(request, env, now, auth.principal);
    if (!csrf.ok) return json({ ok: false, error: csrf.error, request_id: requestId }, csrf.status);
    const result = await handleMediaUpload(request, env, { now });
    logger.info('v5_media_upload', {
      status: result.status,
      ok: result.ok,
      error_code: result.ok ? null : result.error,
      kind: result.ok ? result.media.kind : null,
      size_bytes: result.ok ? result.media.size_bytes : null,
    });
    const { status, ...body } = result;
    return json({ ...body, request_id: requestId }, status);
  }

  // --- API du Studio ---
  if (isStudioApiPath(url.pathname)) {
    const result = await handleStudioApi(request, env, {
      now,
      client,
      operator: auth.via === 'session' ? 'operateur cockpit' : 'cle administrateur',
      requireCsrf: () => requireCsrf(request, env, now, auth.principal),
      publishOptions: options.publishOptions,
      onEvent: (event) => logger.info('v5_publish_event', event),
      loadPlan: async () => {
        const { memory, briefing } = await loadIntelligence(env, now);
        return buildSevenDayPlan(memory, { now, briefing });
      },
      loadBriefing: async () => (await loadIntelligence(env, now)).briefing,
    });
    logger.info('v5_studio_api', { path: url.pathname, method: request.method, status: result.status });
    return json({ ...result.body, request_id: requestId }, result.status);
  }

  return json({ ok: false, error: 'not_found', request_id: requestId }, 404);
}
