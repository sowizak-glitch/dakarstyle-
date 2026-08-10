/**
 * SOWHAT Control V5 - Scheduler de publications
 *
 * Flux, dans cet ordre exact :
 *   1. acquisition du verrou
 *   2. verification de l etat du brouillon
 *   3. portail SAFE
 *   4. sante du jeton
 *   5. validation du media
 *   6. publication
 *   7. confirmation
 *   8. stockage du resultat
 *   9. liberation du verrou
 *
 * Deux protections independantes contre la double publication :
 *   - le verrou, qui empeche deux executions de travailler en meme temps ;
 *   - l idempotence metier, qui empeche une double publication meme si le
 *     verrou venait a etre contourne (expiration, reprise, deploiement).
 *
 * La seconde protection est la vraie garantie. Le verrou n est qu une economie
 * d appels : on ne s en remet jamais a lui seul.
 */

import { validateMedia } from './security-v5.js';
import {
  STUDIO_STATE, beginPublishing, markFailed, markPublished, publicationQueue, readDraft, writeDraft,
} from './studio-v5.js';
import { PUBLISH_STATUS, publishDraft } from './publishing-v5.js';

export const SCHEDULER_LOCK_KEY = 'visuals/social-intelligence/v5/scheduler.lock';
export const SCHEDULER_RUNS_KEY = 'visuals/social-intelligence/v5/scheduler-runs.json';

export const SCHEDULER_STATUS = Object.freeze({
  COMPLETED: 'completed',
  LOCKED: 'locked',
  NO_WORK: 'no_work',
  BLOCKED: 'blocked',
});

export const SCHEDULER_ERROR = Object.freeze({
  LOCK_UNAVAILABLE: 'scheduler_lock_unavailable',
  TOKEN_UNHEALTHY: 'scheduler_token_unhealthy',
  MEDIA_INVALID: 'scheduler_media_invalid',
  STATE_CHANGED: 'scheduler_state_changed',
  NOT_DUE: 'scheduler_not_due',
});

export const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_MAX_PER_RUN = 3;
const MAX_RUN_HISTORY = 40;

/* ------------------------------------------------------------------ */
/* Verrou                                                              */
/* ------------------------------------------------------------------ */

async function readLock(env) {
  try {
    const object = await env?.VISUALS_BUCKET?.get(SCHEDULER_LOCK_KEY);
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

/**
 * Acquiert le verrou par ecriture conditionnelle. Un verrou expire est
 * repris : sans cela, un worker interrompu bloquerait toutes les publications
 * a venir. La reprise n est pas parfaitement atomique, et c est assume :
 * l idempotence metier reste la garantie finale contre le doublon.
 */
export async function acquireLock(env, options = {}) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return { acquired: false, code: SCHEDULER_ERROR.LOCK_UNAVAILABLE, holder: null };

  const now = Number(options.now) || Date.now();
  const ttl = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : DEFAULT_LOCK_TTL_MS;
  const holder = String(options.holder || `RUN-${now.toString(36).toUpperCase()}`);
  const body = JSON.stringify({ holder, acquired_at: new Date(now).toISOString(), expires_at: new Date(now + ttl).toISOString() });

  const written = await bucket.put(SCHEDULER_LOCK_KEY, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  if (written) return { acquired: true, holder, code: null };

  const existing = await readLock(env);
  const expiresAt = Date.parse(existing?.expires_at || '');
  if (existing && Number.isFinite(expiresAt) && expiresAt > now) {
    return { acquired: false, code: null, holder: existing.holder || null, expires_at: existing.expires_at };
  }

  // Verrou perime ou illisible : on le reprend.
  try { await bucket.delete?.(SCHEDULER_LOCK_KEY); } catch { /* reprise best effort */ }
  const retaken = await bucket.put(SCHEDULER_LOCK_KEY, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  if (retaken) return { acquired: true, holder, code: null, retaken: true };
  return { acquired: false, code: null, holder: existing?.holder || null };
}

export async function releaseLock(env, holder) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return false;
  const existing = await readLock(env);
  // On ne libere que SON propre verrou : liberer celui d un autre worker
  // reviendrait a ouvrir la porte au milieu de son travail.
  if (existing && existing.holder && existing.holder !== holder) return false;
  try { await bucket.delete?.(SCHEDULER_LOCK_KEY); } catch { return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/* Journal des executions                                              */
/* ------------------------------------------------------------------ */

async function recordRun(env, run) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return;
  let rows = [];
  try {
    const object = await bucket.get(SCHEDULER_RUNS_KEY);
    if (object) {
      const parsed = JSON.parse(await object.text());
      if (Array.isArray(parsed)) rows = parsed;
    }
  } catch { rows = []; }
  await bucket.put(SCHEDULER_RUNS_KEY, JSON.stringify([run, ...rows].slice(0, MAX_RUN_HISTORY)), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

/* ------------------------------------------------------------------ */
/* Traitement d une echeance                                           */
/* ------------------------------------------------------------------ */

/**
 * Publication d un brouillon, puis application du resultat a la machine a
 * etats du Studio. C est la SEULE implementation de cette sequence : le
 * scheduler et la publication immediate depuis le Studio l appellent tous les
 * deux. Dupliquer cette logique reviendrait a entretenir deux machines a
 * etats qui divergeraient au premier correctif applique a une seule.
 *
 * Le brouillon transmis doit etre en READY ou SCHEDULED : `beginPublishing`
 * le verifie, ainsi que le portail SAFE et la validite du contenu.
 */
export async function publishAndPersist(env, client, draft, options = {}) {
  const now = options.now || (() => Date.now());
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const draftId = draft?.draft_id;

  // 5. Media revalide juste avant l envoi : un media accepte hier peut avoir
  // ete remplace depuis.
  const media = validateMedia(draft?.media || {});
  if (!media.valid) {
    const failed = markFailed(draft, {
      code: SCHEDULER_ERROR.MEDIA_INVALID, detail: media.errors.join(' ; '), stage: 'preflight',
    }, { now: now() });
    await writeDraft(env, failed);
    return { draft_id: draftId, outcome: 'failed', reason: SCHEDULER_ERROR.MEDIA_INVALID, detail: media.errors, draft: failed };
  }

  // 6. Publication. Le passage en PUBLISHING est ecrit AVANT l appel Meta :
  // une interruption laisse une trace visible, pas un etat silencieux.
  let publishing;
  try {
    publishing = beginPublishing(env, draft, { now: now(), jobId: options.jobId || `PUB-${now().toString(36).toUpperCase()}` });
  } catch (error) {
    const failed = markFailed(draft, { code: error.code, detail: error.detail || error.message, stage: 'preflight' }, { now: now() });
    await writeDraft(env, failed);
    return { draft_id: draftId, outcome: 'failed', reason: error.code, detail: error.detail || error.message, draft: failed };
  }
  await writeDraft(env, publishing);

  const result = await publishDraft(env, client, draft, {
    ...options.publishOptions,
    now,
    jobId: publishing.publication_job_id,
    onEvent,
  });

  // 7 et 8. Confirmation puis stockage du resultat.
  if (result.status === PUBLISH_STATUS.PUBLISHED || result.status === PUBLISH_STATUS.ALREADY_PUBLISHED) {
    const published = markPublished(publishing, result.instagram_media_id, { now: now() });
    const stored = {
      ...published,
      permalink: result.permalink || null,
      idempotency_key: result.idempotency_key || published.idempotency_key,
    };
    await writeDraft(env, stored);
    return { draft_id: draftId, outcome: result.status, instagram_media_id: result.instagram_media_id, permalink: stored.permalink, draft: stored };
  }

  const failed = markFailed(publishing, {
    code: result.error_code || 'publish_failed',
    detail: result.detail || '',
    stage: result.stage || 'publish',
  }, { now: now() });
  const stored = {
    ...failed,
    requires_manual_check: result.status === PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
    creation_id: result.creation_id || null,
  };
  await writeDraft(env, stored);
  return {
    draft_id: draftId,
    outcome: result.status,
    reason: result.error_code,
    detail: result.detail || '',
    requires_manual_check: result.status === PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
    draft: stored,
  };
}

async function processDue(env, client, draftId, context) {
  const { now, onEvent, publishOptions, runId } = context;

  // 2. Etat reel relu depuis le stockage : l index peut avoir vieilli.
  const draft = await readDraft(env, draftId);
  if (!draft) return { draft_id: draftId, outcome: 'skipped', reason: 'brouillon introuvable' };
  if (draft.state !== STUDIO_STATE.SCHEDULED) {
    return { draft_id: draftId, outcome: 'skipped', reason: SCHEDULER_ERROR.STATE_CHANGED, state: draft.state };
  }
  const due = Date.parse(draft.scheduled_for || '');
  if (!Number.isFinite(due) || due > now()) {
    return { draft_id: draftId, outcome: 'skipped', reason: SCHEDULER_ERROR.NOT_DUE, scheduled_for: draft.scheduled_for };
  }

  const outcome = await publishAndPersist(env, client, draft, {
    now, onEvent, publishOptions, jobId: `${runId}-${draftId}`,
  });
  // Le brouillon complet n interesse pas le compte rendu d execution.
  const { draft: _stored, ...report } = outcome;
  return report;
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

/**
 * Une execution du scheduler. Renvoie toujours un compte rendu, y compris
 * quand elle n a rien fait : une execution silencieuse serait indistinguable
 * d une execution qui n a jamais eu lieu.
 */
export async function runScheduler(env, client, options = {}) {
  const now = options.now || (() => Date.now());
  const startedAt = now();
  const runId = String(options.runId || `SCHED-${startedAt.toString(36).toUpperCase()}`);
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const maxPerRun = Number(options.maxPerRun) > 0 ? Number(options.maxPerRun) : DEFAULT_MAX_PER_RUN;

  const base = {
    run_id: runId,
    started_at: new Date(startedAt).toISOString(),
    processed: [],
    published: 0,
    failed: 0,
    skipped: 0,
  };

  // 1. Verrou.
  const lock = await acquireLock(env, { now: startedAt, holder: runId, ttlMs: options.lockTtlMs });
  if (!lock.acquired) {
    const run = {
      ...base,
      status: lock.code === SCHEDULER_ERROR.LOCK_UNAVAILABLE ? SCHEDULER_STATUS.BLOCKED : SCHEDULER_STATUS.LOCKED,
      error_code: lock.code || null,
      lock_holder: lock.holder || null,
      finished_at: new Date(now()).toISOString(),
      duration_ms: now() - startedAt,
    };
    onEvent({ type: 'scheduler_locked', run_id: runId, holder: lock.holder || null });
    await recordRun(env, run);
    return run;
  }

  try {
    const queue = await publicationQueue(env, { now: startedAt });
    const due = queue.filter((row) => row.state === STUDIO_STATE.SCHEDULED && row.due).slice(0, maxPerRun);

    if (!due.length) {
      const run = {
        ...base, status: SCHEDULER_STATUS.NO_WORK,
        finished_at: new Date(now()).toISOString(), duration_ms: now() - startedAt,
      };
      await recordRun(env, run);
      return run;
    }

    // 4. Sante du jeton, une seule fois pour toute l execution.
    const health = await client?.checkTokenHealth?.();
    if (!health || health.status !== 'valid') {
      const run = {
        ...base,
        status: SCHEDULER_STATUS.BLOCKED,
        error_code: SCHEDULER_ERROR.TOKEN_UNHEALTHY,
        token_status: health?.status || 'unknown',
        pending: due.length,
        finished_at: new Date(now()).toISOString(),
        duration_ms: now() - startedAt,
      };
      onEvent({ type: 'scheduler_blocked', run_id: runId, reason: SCHEDULER_ERROR.TOKEN_UNHEALTHY, token_status: run.token_status });
      await recordRun(env, run);
      return run;
    }

    const processed = [];
    for (const row of due) {
      const outcome = await processDue(env, client, row.draft_id, {
        now, onEvent, runId, publishOptions: options.publishOptions,
      });
      processed.push(outcome);
    }

    const run = {
      ...base,
      status: SCHEDULER_STATUS.COMPLETED,
      processed,
      published: processed.filter((p) => p.outcome === PUBLISH_STATUS.PUBLISHED || p.outcome === PUBLISH_STATUS.ALREADY_PUBLISHED).length,
      failed: processed.filter((p) => p.outcome === 'failed' || p.outcome === PUBLISH_STATUS.FAILED).length,
      manual_check: processed.filter((p) => p.requires_manual_check).length,
      skipped: processed.filter((p) => p.outcome === 'skipped').length,
      finished_at: new Date(now()).toISOString(),
      duration_ms: now() - startedAt,
    };
    await recordRun(env, run);
    return run;
  } finally {
    // 9. Le verrou est libere quoi qu il arrive, y compris apres une exception.
    await releaseLock(env, runId);
  }
}
