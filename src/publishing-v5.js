/**
 * SOWHAT Control V5 - Publication Instagram
 *
 * Pipeline officiel Meta, en quatre temps distincts :
 *
 *   1. creation du conteneur   POST /{ig-user-id}/media
 *   2. suivi du traitement     GET  /{creation-id}?fields=status_code
 *   3. publication             POST /{ig-user-id}/media_publish
 *   4. confirmation finale     GET  /{media-id}?fields=id,permalink,timestamp
 *
 * Regle centrale : un HTTP 200 a l etape 1 ne veut PAS dire publie. Le
 * conteneur n est qu un brouillon cote Meta. L etat PUBLISHED n est atteint
 * qu apres l etape 4, quand Meta confirme un identifiant de media reel.
 *
 * Asymetrie assumee entre les etapes :
 *   - creer un conteneur est sans consequence : on peut recommencer ;
 *   - media_publish ne l est pas : c est la seule etape qui peut produire un
 *     doublon visible par l audience. Elle est donc protegee par une trace
 *     ecrite AVANT l appel. Si le resultat reste inconnu, on ne rejoue jamais :
 *     on demande une verification humaine.
 */

import { META_ERROR, MetaApiError } from './instagram-client-v5.js';
import {
  businessIdempotencyKey, completeIdempotencyKey, readIdempotencyRecord, reserveIdempotencyKey,
} from './security-v5.js';
import { assertPublishable, previewDraft } from './studio-v5.js';

export const PUBLISH_STATUS = Object.freeze({
  PUBLISHED: 'published',
  ALREADY_PUBLISHED: 'already_published',
  FAILED: 'failed',
  REQUIRES_MANUAL_CHECK: 'requires_manual_check',
});

export const PUBLISH_STAGE = Object.freeze({
  PREFLIGHT: 'preflight',
  CONTAINER: 'container',
  PROCESSING: 'processing',
  PUBLISH: 'publish',
  CONFIRMATION: 'confirmation',
});

export const PUBLISH_ERROR = Object.freeze({
  MEDIA_URL_NOT_CONFIGURED: 'publish_media_url_not_configured',
  CONTAINER_ERROR: 'publish_container_error',
  CONTAINER_EXPIRED: 'publish_container_expired',
  CONTAINER_TIMEOUT: 'publish_container_timeout',
  NO_CREATION_ID: 'publish_no_creation_id',
  NO_MEDIA_ID: 'publish_no_media_id',
  NOT_CONFIRMED: 'publish_not_confirmed',
  RESULT_UNKNOWN: 'publish_result_unknown',
  IDEMPOTENCY_UNAVAILABLE: 'publish_idempotency_unavailable',
});

/** Etats renvoyes par Meta pour un conteneur. */
const CONTAINER_FINISHED = new Set(['FINISHED', 'PUBLISHED']);
const CONTAINER_FATAL = new Set(['ERROR', 'EXPIRED']);

const DEFAULT_MAX_STATUS_CHECKS = 12;
const DEFAULT_STATUS_DELAY_MS = 5000;

function publishError(code, detail, stage) {
  const error = new Error(code);
  error.code = code;
  error.detail = String(detail || '');
  error.stage = stage;
  return error;
}

/**
 * URL publique du media. Meta doit pouvoir la telecharger : elle doit donc
 * etre servie en https, sans port, depuis une base explicitement configuree.
 * Sans configuration, on refuse : on ne devine pas un domaine.
 */
export function mediaUrlFor(env, r2Key) {
  const base = String(env?.SOWHAT_MEDIA_PUBLIC_BASE || '').trim();
  if (!base) {
    throw publishError(PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, 'SOWHAT_MEDIA_PUBLIC_BASE absent', PUBLISH_STAGE.PREFLIGHT);
  }
  let origin;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.port !== '') {
      throw new Error('base non https ou avec port');
    }
    origin = url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    throw publishError(PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, 'SOWHAT_MEDIA_PUBLIC_BASE invalide', PUBLISH_STAGE.PREFLIGHT);
  }
  const key = String(r2Key || '').replace(/^\/+/, '');
  if (!key) {
    throw publishError(PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, 'cle de media absente', PUBLISH_STAGE.PREFLIGHT);
  }
  return `${origin}/${key}`;
}

/** Champs du conteneur, selon le format reel du contenu. */
export function containerFieldsFor(draft, mediaUrl, caption) {
  const format = String(draft?.format || '').toUpperCase();
  if (format === 'STORY') {
    const kind = String(draft?.media?.kind || '').toUpperCase();
    return kind === 'VIDEO'
      ? { media_type: 'STORIES', video_url: mediaUrl }
      : { media_type: 'STORIES', image_url: mediaUrl };
  }
  if (format === 'REEL') {
    return { media_type: 'REELS', video_url: mediaUrl, caption };
  }
  if (format === 'VIDEO') {
    return { media_type: 'VIDEO', video_url: mediaUrl, caption };
  }
  return { image_url: mediaUrl, caption };
}

/**
 * Suit le traitement du conteneur jusqu a un etat terminal. Ne conclut jamais
 * a partir du seul succes HTTP : seul `status_code` fait foi.
 */
export async function waitForContainer(client, creationId, options = {}) {
  const maxChecks = Number(options.maxChecks) > 0 ? Number(options.maxChecks) : DEFAULT_MAX_STATUS_CHECKS;
  const delayMs = Number(options.delayMs) >= 0 ? Number(options.delayMs) : DEFAULT_STATUS_DELAY_MS;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};

  let last = null;
  for (let attempt = 1; attempt <= maxChecks; attempt += 1) {
    const payload = await client.request(creationId, { fields: 'status_code,status' });
    last = String(payload?.status_code || '').toUpperCase();
    onEvent({ type: 'container_status', creation_id: creationId, attempt, status_code: last });

    if (CONTAINER_FINISHED.has(last)) return { ready: true, status_code: last, checks: attempt };
    if (CONTAINER_FATAL.has(last)) {
      const code = last === 'EXPIRED' ? PUBLISH_ERROR.CONTAINER_EXPIRED : PUBLISH_ERROR.CONTAINER_ERROR;
      throw publishError(code, `conteneur en etat ${last} : ${String(payload?.status || '').slice(0, 200)}`, PUBLISH_STAGE.PROCESSING);
    }
    if (attempt < maxChecks) await sleep(delayMs);
  }
  throw publishError(
    PUBLISH_ERROR.CONTAINER_TIMEOUT,
    `conteneur toujours en ${last || 'etat inconnu'} apres ${maxChecks} verifications`,
    PUBLISH_STAGE.PROCESSING,
  );
}

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

function failure(code, detail, stage) {
  return { status: PUBLISH_STATUS.FAILED, error_code: code, detail: String(detail || '').slice(0, 300), stage };
}

/**
 * Publie un brouillon. Ne modifie pas le brouillon : renvoie un resultat que
 * l appelant applique via la machine a etats du Studio.
 */
export async function publishDraft(env, client, draft, options = {}) {
  const now = options.now || (() => Date.now());
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const jobId = String(options.jobId || `PUB-${now().toString(36).toUpperCase()}`);

  // --- 1. Pre-vol : etat, contenu, portail SAFE ---
  try {
    assertPublishable(env, draft);
  } catch (error) {
    return { ...failure(error.code, error.detail || error.reason, PUBLISH_STAGE.PREFLIGHT), publication_job_id: jobId };
  }
  if (!client?.isConfigured?.()) {
    return { ...failure(META_ERROR.NOT_CONFIGURED, 'client Meta non configure', PUBLISH_STAGE.PREFLIGHT), publication_job_id: jobId };
  }

  const userId = String(env?.INSTAGRAM_USER_ID || '').trim();
  const preview = previewDraft(draft);

  let mediaUrl;
  try {
    mediaUrl = mediaUrlFor(env, draft.media?.r2_key);
  } catch (error) {
    return { ...failure(error.code, error.detail, PUBLISH_STAGE.PREFLIGHT), publication_job_id: jobId };
  }

  // --- 2. Idempotence metier : la meme intention ne part qu une fois ---
  const key = await businessIdempotencyKey({
    draft_id: draft.draft_id,
    format: draft.format,
    instagram_user_id: userId,
    scheduled_for: draft.scheduled_for || '',
    media_key: draft.media?.r2_key || '',
    caption: preview.caption,
  });

  const reservation = await reserveIdempotencyKey(env, key, { draft_id: draft.draft_id, publication_job_id: jobId });
  if (reservation.duplicate) {
    const existing = reservation.existing || {};
    if (existing.result?.instagram_media_id) {
      onEvent({ type: 'publish_skipped_duplicate', publication_job_id: jobId, idempotency_key: key });
      return {
        status: PUBLISH_STATUS.ALREADY_PUBLISHED,
        instagram_media_id: existing.result.instagram_media_id,
        permalink: existing.result.permalink || null,
        idempotency_key: key,
        publication_job_id: jobId,
      };
    }
    // Une publication a deja ete TENTEE sans resultat confirme. La rejouer
    // risquerait un doublon visible : on demande une verification humaine.
    // Le marqueur est cherche aux deux niveaux ou il peut avoir ete ecrit :
    // le confondre reviendrait a republier, ce qui est exactement ce que ce
    // garde-fou existe pour empecher.
    const attemptedAt = existing.result?.publish_attempted_at || existing.publish_attempted_at || null;
    if (attemptedAt) {
      return {
        status: PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
        error_code: PUBLISH_ERROR.RESULT_UNKNOWN,
        detail: `media_publish deja tente le ${attemptedAt} sans confirmation : verifier le compte avant toute reprise`,
        stage: PUBLISH_STAGE.PUBLISH,
        creation_id: existing.result?.creation_id || existing.creation_id || null,
        idempotency_key: key,
        publication_job_id: jobId,
      };
    }
    // Tentative precedente arretee avant media_publish : rien n a ete publie,
    // la reprise est sans risque.
  } else if (!reservation.reserved) {
    return {
      ...failure(PUBLISH_ERROR.IDEMPOTENCY_UNAVAILABLE, reservation.detail || 'exclusion mutuelle indisponible', PUBLISH_STAGE.PREFLIGHT),
      publication_job_id: jobId,
    };
  }

  // --- 3. Creation du conteneur (sans consequence, rejouable) ---
  let creationId;
  try {
    const container = await client.mutate(`${userId}/media`, containerFieldsFor(draft, mediaUrl, preview.caption));
    creationId = String(container?.id || '').trim();
    if (!creationId) throw publishError(PUBLISH_ERROR.NO_CREATION_ID, 'Meta n a pas renvoye d identifiant de conteneur', PUBLISH_STAGE.CONTAINER);
    onEvent({ type: 'container_created', publication_job_id: jobId, creation_id: creationId });
    await completeIdempotencyKey(env, key, { stage: PUBLISH_STAGE.CONTAINER, creation_id: creationId });
  } catch (error) {
    const code = error instanceof MetaApiError ? error.code : (error.code || META_ERROR.UNKNOWN);
    const detail = error instanceof MetaApiError ? error.detail : error.detail || error.message;
    await completeIdempotencyKey(env, key, { stage: PUBLISH_STAGE.CONTAINER, status: 'failed', error_code: code });
    return { ...failure(code, detail, PUBLISH_STAGE.CONTAINER), idempotency_key: key, publication_job_id: jobId };
  }

  // --- 4. Suivi du traitement : seul status_code fait foi ---
  try {
    await waitForContainer(client, creationId, { ...options.containerPolling, onEvent });
  } catch (error) {
    await completeIdempotencyKey(env, key, { stage: PUBLISH_STAGE.PROCESSING, status: 'failed', creation_id: creationId, error_code: error.code });
    const code = error instanceof MetaApiError ? error.code : (error.code || META_ERROR.UNKNOWN);
    const detail = error instanceof MetaApiError ? error.detail : error.detail || error.message;
    return { ...failure(code, detail, PUBLISH_STAGE.PROCESSING), creation_id: creationId, idempotency_key: key, publication_job_id: jobId };
  }

  // --- 5. Publication : la seule etape non rejouable ---
  // La trace est ecrite AVANT l appel. Si le processus meurt pendant l appel,
  // la reprise saura qu une publication a peut-etre abouti.
  await completeIdempotencyKey(env, key, {
    stage: PUBLISH_STAGE.PUBLISH,
    creation_id: creationId,
    publish_attempted_at: new Date(now()).toISOString(),
  });
  const beforePublish = await readIdempotencyRecord(env, key);
  if (!beforePublish?.result?.publish_attempted_at && !beforePublish?.publish_attempted_at) {
    // La trace n a pas pu etre ecrite : sans elle, une reprise ne saurait pas
    // qu une publication a ete tentee. On s arrete avant de risquer un doublon.
    return {
      ...failure(PUBLISH_ERROR.IDEMPOTENCY_UNAVAILABLE, 'trace de tentative non ecrite : publication annulee avant envoi', PUBLISH_STAGE.PUBLISH),
      creation_id: creationId, idempotency_key: key, publication_job_id: jobId,
    };
  }

  let mediaId;
  try {
    const published = await client.mutate(`${userId}/media_publish`, { creation_id: creationId });
    mediaId = String(published?.id || '').trim();
    if (!mediaId) throw publishError(PUBLISH_ERROR.NO_MEDIA_ID, 'Meta n a pas renvoye d identifiant de media', PUBLISH_STAGE.PUBLISH);
  } catch (error) {
    const code = error instanceof MetaApiError ? error.code : (error.code || META_ERROR.UNKNOWN);
    const detail = error instanceof MetaApiError ? error.detail : error.detail || error.message;
    // Une erreur ambigue (5xx, timeout, reseau) laisse le doute : la
    // publication a peut-etre abouti. On ne rejoue pas, on fait verifier.
    const ambiguous = error instanceof MetaApiError && error.retryable;
    if (ambiguous) {
      return {
        status: PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
        error_code: PUBLISH_ERROR.RESULT_UNKNOWN,
        detail: `media_publish sans reponse exploitable (${code}) : verifier le compte avant toute reprise`,
        stage: PUBLISH_STAGE.PUBLISH,
        creation_id: creationId,
        idempotency_key: key,
        publication_job_id: jobId,
      };
    }
    return { ...failure(code, detail, PUBLISH_STAGE.PUBLISH), creation_id: creationId, idempotency_key: key, publication_job_id: jobId };
  }

  // --- 6. Confirmation finale : sans elle, ce n est pas publie ---
  let confirmation;
  try {
    const fields = String(draft?.format || '').toUpperCase() === 'STORY'
      ? 'id,timestamp,media_product_type'
      : 'id,permalink,timestamp';
    confirmation = await client.request(mediaId, { fields });
  } catch (error) {
    const code = error instanceof MetaApiError ? error.code : META_ERROR.UNKNOWN;
    return {
      status: PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
      error_code: PUBLISH_ERROR.NOT_CONFIRMED,
      detail: `media_publish a renvoye ${mediaId} mais la confirmation a echoue (${code})`,
      stage: PUBLISH_STAGE.CONFIRMATION,
      instagram_media_id: mediaId,
      creation_id: creationId,
      idempotency_key: key,
      publication_job_id: jobId,
    };
  }

  const confirmedId = String(confirmation?.id || '').trim();
  if (!confirmedId || confirmedId !== mediaId) {
    return {
      status: PUBLISH_STATUS.REQUIRES_MANUAL_CHECK,
      error_code: PUBLISH_ERROR.NOT_CONFIRMED,
      detail: 'la confirmation Meta ne correspond pas a l identifiant publie',
      stage: PUBLISH_STAGE.CONFIRMATION,
      instagram_media_id: mediaId,
      creation_id: creationId,
      idempotency_key: key,
      publication_job_id: jobId,
    };
  }

  const result = {
    status: PUBLISH_STATUS.PUBLISHED,
    instagram_media_id: confirmedId,
    permalink: String(confirmation?.permalink || '') || null,
    published_timestamp: String(confirmation?.timestamp || '') || null,
    creation_id: creationId,
    idempotency_key: key,
    publication_job_id: jobId,
  };
  await completeIdempotencyKey(env, key, {
    stage: PUBLISH_STAGE.CONFIRMATION,
    creation_id: creationId,
    instagram_media_id: confirmedId,
    permalink: result.permalink,
  });
  onEvent({ type: 'publish_confirmed', publication_job_id: jobId, instagram_media_id: confirmedId });
  return result;
}
