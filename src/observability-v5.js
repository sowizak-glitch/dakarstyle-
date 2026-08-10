/**
 * SOWHAT Control V5 - Observabilite
 *
 * Un journal sert a comprendre un incident sans le reproduire. Il doit donc
 * etre structure, correlable, et surtout inoffensif : aucun secret n y entre,
 * jamais, quelle que soit la maniere dont l appelant a construit son message.
 *
 * La redaction n est pas une politesse ajoutee a la fin : c est la derniere
 * barriere avant la sortie, appliquee a toutes les valeurs, y compris celles
 * imbriquees dans des objets.
 */

import { redactSecrets } from './instagram-client-v5.js';

export const LOG_LEVEL = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
});

/** Champs de correlation attendus sur les evenements V5. */
export const CORRELATION_FIELDS = Object.freeze([
  'request_id', 'sync_id', 'publication_job_id', 'instagram_media_id', 'run_id',
]);

/**
 * Cles interdites en sortie. Une valeur portant l un de ces noms est remplacee
 * par un marqueur : on ne tente meme pas de la nettoyer, on la supprime.
 */
const FORBIDDEN_KEYS = /(token|secret|password|passwd|authorization|credential|api[_-]?key|access[_-]?token)/i;

const MAX_STRING = 500;
const MAX_DEPTH = 4;

/** Nettoie recursivement une valeur avant journalisation. */
export function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactSecrets(value).slice(0, MAX_STRING);
  if (depth >= MAX_DEPTH) return '[TRONQUE]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      out[key] = FORBIDDEN_KEYS.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1);
    }
    return out;
  }
  return '[NON_SERIALISABLE]';
}

/** Identifiant de correlation court et lisible. */
export function newRequestId(now = Date.now(), random = Math.random) {
  const stamp = now.toString(36).toUpperCase();
  const tail = Math.floor(random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `REQ-${stamp}-${tail}`;
}

/**
 * Construit un evenement structure. Le niveau, l horodatage et l evenement sont
 * toujours presents ; tout le reste est nettoye.
 */
export function buildLogEvent(level, event, fields = {}, options = {}) {
  const now = Number(options.now) || Date.now();
  const safeLevel = Object.values(LOG_LEVEL).includes(level) ? level : LOG_LEVEL.INFO;
  const payload = sanitizeValue(fields, 1) || {};
  return {
    ts: new Date(now).toISOString(),
    level: safeLevel,
    event: String(event || 'unknown').slice(0, 80),
    service: 'sowhat-control-v5',
    ...payload,
  };
}

/**
 * Journal structure. `sink` recoit l objet nettoye ; par defaut il part sur la
 * console, ce que Cloudflare capture deja.
 */
export function createLogger(options = {}) {
  const sink = typeof options.sink === 'function' ? options.sink : (line) => console.log(JSON.stringify(line));
  const now = options.now || (() => Date.now());
  const base = sanitizeValue(options.base || {}, 1) || {};

  function emit(level, event, fields) {
    const line = buildLogEvent(level, event, { ...base, ...(fields || {}) }, { now: now() });
    sink(line);
    return line;
  }

  return {
    debug: (event, fields) => emit(LOG_LEVEL.DEBUG, event, fields),
    info: (event, fields) => emit(LOG_LEVEL.INFO, event, fields),
    warn: (event, fields) => emit(LOG_LEVEL.WARN, event, fields),
    error: (event, fields) => emit(LOG_LEVEL.ERROR, event, fields),
    child: (extra) => createLogger({ ...options, base: { ...base, ...(extra || {}) } }),
  };
}

/**
 * Mesure la duree d une operation et la journalise, succes comme echec. Une
 * operation qui echoue doit laisser autant de traces qu une operation qui
 * reussit, sinon les incidents sont invisibles.
 */
export async function timed(logger, event, fields, operation, options = {}) {
  const now = options.now || (() => Date.now());
  const startedAt = now();
  try {
    const result = await operation();
    logger.info(event, { ...fields, status: 'ok', duration_ms: now() - startedAt });
    return result;
  } catch (error) {
    logger.error(event, {
      ...fields,
      status: 'error',
      duration_ms: now() - startedAt,
      error_code: error?.code || 'unknown',
      detail: error?.detail || error?.message || '',
    });
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Cockpit technique                                                   */
/* ------------------------------------------------------------------ */

const SYNC_RUNS_KEY = 'visuals/social-intelligence/v5/sync-runs.json';
const ERROR_EVENTS_KEY = 'visuals/social-intelligence/v5/error-events.json';
const SCHEDULER_RUNS_KEY = 'visuals/social-intelligence/v5/scheduler-runs.json';
const SYNC_STATE_KEY = 'visuals/social-intelligence/v5/sync-state.json';

async function readJson(env, key, fallback) {
  try {
    const object = await env?.VISUALS_BUCKET?.get(key);
    if (!object) return fallback;
    const parsed = JSON.parse(await object.text());
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Etat technique minimal : derniere sync, syncs en echec, file d attente,
 * publications en echec, sante du jeton, erreurs recentes.
 *
 * Chaque champ peut valoir `null`. Un cockpit qui affiche 0 quand il ne sait
 * pas est plus dangereux qu un cockpit qui affiche « inconnu ».
 */
export async function buildTechnicalCockpit(env, options = {}) {
  const now = Number(options.now) || Date.now();
  const syncRuns = await readJson(env, SYNC_RUNS_KEY, []);
  const schedulerRuns = await readJson(env, SCHEDULER_RUNS_KEY, []);
  const errors = await readJson(env, ERROR_EVENTS_KEY, []);
  const syncState = await readJson(env, SYNC_STATE_KEY, null);

  const runs = Array.isArray(syncRuns) ? syncRuns : [];
  const scheduler = Array.isArray(schedulerRuns) ? schedulerRuns : [];
  const recentErrors = (Array.isArray(errors) ? errors : []).slice(0, 10);

  const lastSync = runs[0] || null;
  const nextSyncAt = options.nextSyncAt || null;

  return {
    generated_at: new Date(now).toISOString(),
    instagram: {
      configured: Boolean(String(env?.INSTAGRAM_ACCESS_TOKEN || '').trim() && String(env?.INSTAGRAM_USER_ID || '').trim()),
      token_health: options.tokenHealth || { status: 'unknown', checked_at: null },
    },
    sync: {
      last_run: lastSync
        ? {
          sync_id: lastSync.sync_id || null,
          status: lastSync.status || null,
          finished_at: lastSync.finished_at || null,
          duration_ms: lastSync.duration_ms ?? null,
          created: lastSync.created ?? null,
          updated: lastSync.updated ?? null,
          insight_failures: lastSync.insight_failures ?? null,
        }
        : null,
      last_success_at: runs.find((run) => run.status === 'success')?.finished_at || null,
      failed_runs: runs.filter((run) => run.status === 'failed').length,
      partial_runs: runs.filter((run) => run.status === 'partial').length,
      next_run_at: nextSyncAt,
      known_media_count: syncState?.known_media_count ?? null,
    },
    publication: {
      queue: options.queue || [],
      queue_size: Array.isArray(options.queue) ? options.queue.length : 0,
      due_now: Array.isArray(options.queue) ? options.queue.filter((row) => row.due).length : 0,
      failed_last_runs: scheduler.reduce((sum, run) => sum + (Number(run.failed) || 0), 0),
      manual_check_last_runs: scheduler.reduce((sum, run) => sum + (Number(run.manual_check) || 0), 0),
      last_run: scheduler[0]
        ? {
          run_id: scheduler[0].run_id || null,
          status: scheduler[0].status || null,
          finished_at: scheduler[0].finished_at || null,
          published: scheduler[0].published ?? null,
        }
        : null,
    },
    recent_errors: recentErrors.map((error) => sanitizeValue(error, 1)),
  };
}
