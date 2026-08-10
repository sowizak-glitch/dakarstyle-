/**
 * SOWHAT Control V5 - Studio
 *
 * Le Studio tient l etat de ce qui va etre publie. Il n appelle jamais Meta :
 * il decide seulement ce qui a le droit de partir, et dans quel etat se trouve
 * chaque contenu.
 *
 * L etat n est pas une etiquette decorative : c est une machine a etats fermee.
 * Toute transition non declaree est refusee. Un contenu PUBLISHED ne peut plus
 * bouger, un contenu FAILED ne repart pas tout seul, et rien ne passe en
 * PUBLISHING sans avoir franchi le portail SAFE.
 */

import {
  SECURITY_ERROR, checkSafeGate, validateMedia,
} from './security-v5.js';

export const DRAFT_PREFIX = 'visuals/social-intelligence/v5/drafts/';
export const DRAFT_INDEX_KEY = 'visuals/social-intelligence/v5/drafts-index.json';

export const STUDIO_STATE = Object.freeze({
  DRAFT: 'DRAFT',
  READY: 'READY',
  SCHEDULED: 'SCHEDULED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const STUDIO_ERROR = Object.freeze({
  NOT_FOUND: 'studio_draft_not_found',
  INVALID_TRANSITION: 'studio_invalid_transition',
  VALIDATION_FAILED: 'studio_validation_failed',
  SCHEDULE_IN_PAST: 'studio_schedule_in_past',
  SAFE_GATE_CLOSED: SECURITY_ERROR.SAFE_GATE_CLOSED,
  MEDIA_INVALID: SECURITY_ERROR.MEDIA_INVALID,
});

/**
 * Transitions autorisees. Tout ce qui n est pas ici est interdit.
 * PUBLISHED est terminal : un contenu publie ne redevient jamais brouillon.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'CANCELLED'],
  SCHEDULED: ['PUBLISHING', 'CANCELLED', 'READY'],
  PUBLISHING: ['PUBLISHED', 'FAILED'],
  PUBLISHED: [],
  FAILED: ['READY', 'CANCELLED'],
  CANCELLED: ['DRAFT'],
});

export const MAX_CAPTION_LENGTH = 2200;
export const MAX_HASHTAGS = 30;

const CONTROL_CHARS = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F]', 'g');

function studioError(code, detail, extra = {}) {
  const error = new Error(code);
  error.code = code;
  error.detail = String(detail || '');
  Object.assign(error, extra);
  return error;
}

/**
 * Nettoyage d une legende. Les sauts de ligne sont PRESERVES : une legende
 * Instagram est un texte multiligne, et les ecraser changerait ce que
 * l operateur a ecrit. Tous les autres caracteres de controle sont retires.
 */
function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Champ court : une seule ligne, quoi qu il arrive. */
function cleanLine(value, max) {
  return cleanText(value, max).replace(/\n+/g, ' ').replace(/[ ]+/g, ' ').trim();
}

export function normalizeHashtags(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[\s,]+/);
  const cleaned = list
    .map((tag) => cleanLine(tag, 60).toLowerCase())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .filter((tag) => /^#[\p{L}\p{N}_]{2,40}$/u.test(tag));
  return [...new Set(cleaned)].slice(0, MAX_HASHTAGS);
}

/* ------------------------------------------------------------------ */
/* Modele                                                              */
/* ------------------------------------------------------------------ */

export function newDraftId(now = Date.now(), suffix = '') {
  const stamp = new Date(now).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const tail = cleanLine(suffix, 8).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `DRAFT-${stamp}${tail ? `-${tail}` : ''}`;
}

/**
 * Cree un brouillon. Un brouillon nait toujours en DRAFT, jamais approuve :
 * l approbation SAFE est un geste humain distinct de la creation.
 */
export function createDraft(input = {}, options = {}) {
  const now = Number(options.now) || Date.now();
  const timestamp = new Date(now).toISOString();
  return {
    draft_id: String(input.draft_id || newDraftId(now, input.id_suffix)),
    state: STUDIO_STATE.DRAFT,
    format: cleanLine(input.format, 20).toUpperCase() || 'IMAGE',
    caption: cleanText(input.caption, MAX_CAPTION_LENGTH),
    hashtags: normalizeHashtags(input.hashtags),
    cta: cleanLine(input.cta, 60) || null,
    media: input.media ? { ...input.media } : null,
    product: cleanLine(input.product, 60) || null,
    collection: cleanLine(input.collection, 60) || null,
    campaign: cleanLine(input.campaign, 60) || null,
    objective: cleanLine(input.objective, 120) || null,
    angle: cleanLine(input.angle, 200) || null,
    hook: cleanLine(input.hook, 200) || null,
    safe_approved: false,
    scheduled_for: null,
    source: input.source ? { ...input.source } : null,
    instagram_media_id: null,
    publication_job_id: null,
    idempotency_key: null,
    failure: null,
    history: [{ at: timestamp, from: null, to: STUDIO_STATE.DRAFT, reason: 'creation' }],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Un brouillon est publiable s il a un media valide et une legende. La
 * validation ne corrige rien en silence : elle liste ce qui manque.
 */
export function validateDraft(draft) {
  const errors = [];
  if (!draft) return { valid: false, errors: ['brouillon absent'] };

  if (!draft.caption) errors.push('legende absente');
  if (draft.caption && draft.caption.length > MAX_CAPTION_LENGTH) {
    errors.push(`legende trop longue : ${draft.caption.length} caracteres, maximum ${MAX_CAPTION_LENGTH}`);
  }
  if (draft.hashtags && draft.hashtags.length > MAX_HASHTAGS) {
    errors.push(`trop de hashtags : ${draft.hashtags.length}, maximum ${MAX_HASHTAGS}`);
  }

  if (!draft.media) errors.push('media absent');
  else {
    const media = validateMedia(draft.media);
    if (!media.valid) errors.push(...media.errors);
    else if (draft.format === 'REEL' && media.normalized.kind !== 'VIDEO') {
      errors.push('un Reel exige un media video');
    } else if ((draft.format === 'IMAGE' || draft.format === 'CAROUSEL') && media.normalized.kind !== 'IMAGE') {
      errors.push(`le format ${draft.format} exige un media image`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Apercu exact de ce qui partira : legende finale, hashtags, CTA. */
export function previewDraft(draft) {
  const parts = [draft?.caption || ''];
  if (draft?.cta) parts.push(draft.cta);
  if (draft?.hashtags?.length) parts.push(draft.hashtags.join(' '));
  const caption = parts.filter(Boolean).join('\n\n');
  const validation = validateDraft(draft);
  return {
    draft_id: draft?.draft_id || null,
    state: draft?.state || null,
    format: draft?.format || null,
    caption,
    caption_length: caption.length,
    hashtag_count: draft?.hashtags?.length || 0,
    media_key: draft?.media?.r2_key || null,
    publishable: validation.valid,
    blocking_errors: validation.errors,
  };
}

/* ------------------------------------------------------------------ */
/* Machine a etats                                                     */
/* ------------------------------------------------------------------ */

export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/**
 * Applique une transition. Refuse tout ce qui n est pas explicitement
 * autorise, et conserve l historique complet des changements d etat.
 */
export function transition(draft, to, options = {}) {
  const now = Number(options.now) || Date.now();
  const from = draft?.state;
  if (!canTransition(from, to)) {
    throw studioError(
      STUDIO_ERROR.INVALID_TRANSITION,
      `transition refusee : ${from} -> ${to}`,
      { from, to },
    );
  }
  const timestamp = new Date(now).toISOString();
  return {
    ...draft,
    state: to,
    updated_at: timestamp,
    history: [...(draft.history || []), {
      at: timestamp,
      from,
      to,
      reason: cleanLine(options.reason, 200) || null,
    }].slice(-40),
  };
}

/* ------------------------------------------------------------------ */
/* Operations du Studio                                                */
/* ------------------------------------------------------------------ */

export function saveDraft(draft, patch = {}, options = {}) {
  if (draft.state === STUDIO_STATE.PUBLISHED) {
    throw studioError(STUDIO_ERROR.INVALID_TRANSITION, 'un contenu publie ne peut plus etre modifie');
  }
  if (draft.state === STUDIO_STATE.PUBLISHING) {
    throw studioError(STUDIO_ERROR.INVALID_TRANSITION, 'un contenu en cours de publication ne peut plus etre modifie');
  }
  const now = Number(options.now) || Date.now();
  const next = {
    ...draft,
    caption: patch.caption === undefined ? draft.caption : cleanText(patch.caption, MAX_CAPTION_LENGTH),
    hashtags: patch.hashtags === undefined ? draft.hashtags : normalizeHashtags(patch.hashtags),
    cta: patch.cta === undefined ? draft.cta : (cleanLine(patch.cta, 60) || null),
    format: patch.format === undefined ? draft.format : (cleanLine(patch.format, 20).toUpperCase() || draft.format),
    media: patch.media === undefined ? draft.media : (patch.media ? { ...patch.media } : null),
    product: patch.product === undefined ? draft.product : (cleanLine(patch.product, 60) || null),
    collection: patch.collection === undefined ? draft.collection : (cleanLine(patch.collection, 60) || null),
    campaign: patch.campaign === undefined ? draft.campaign : (cleanLine(patch.campaign, 60) || null),
    updated_at: new Date(now).toISOString(),
  };
  // Toute modification de fond retire l approbation SAFE : on n approuve pas
  // un contenu puis on en change le media ou la legende.
  const materialChange = ['caption', 'hashtags', 'cta', 'media', 'format'].some((key) => patch[key] !== undefined);
  if (materialChange && draft.safe_approved) {
    next.safe_approved = false;
    next.history = [...(draft.history || []), {
      at: next.updated_at, from: draft.state, to: draft.state, reason: 'approbation SAFE retiree apres modification',
    }].slice(-40);
  }
  return next;
}

/** Approbation humaine explicite. Sans elle, aucune publication ne part. */
export function approveDraft(draft, options = {}) {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, validation.errors.join(' ; '), { errors: validation.errors });
  }
  const now = Number(options.now) || Date.now();
  return {
    ...draft,
    safe_approved: true,
    approved_by: cleanLine(options.approvedBy, 60) || 'operateur',
    approved_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

export function markReady(draft, options = {}) {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, validation.errors.join(' ; '), { errors: validation.errors });
  }
  return transition(draft, STUDIO_STATE.READY, { ...options, reason: 'brouillon valide' });
}

/**
 * Programmation. Une date dans le passe est refusee : on ne programme pas
 * quelque chose qui aurait deja du partir.
 */
export function scheduleDraft(draft, scheduledFor, options = {}) {
  const now = Number(options.now) || Date.now();
  const target = Date.parse(String(scheduledFor || ''));
  if (!Number.isFinite(target)) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, 'date de programmation illisible');
  }
  if (target <= now) {
    throw studioError(STUDIO_ERROR.SCHEDULE_IN_PAST, 'date de programmation dans le passe');
  }
  const validation = validateDraft(draft);
  if (!validation.valid) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, validation.errors.join(' ; '), { errors: validation.errors });
  }
  const next = transition(draft, STUDIO_STATE.SCHEDULED, { now, reason: `programme pour ${new Date(target).toISOString()}` });
  return { ...next, scheduled_for: new Date(target).toISOString() };
}

export function cancelSchedule(draft, options = {}) {
  const next = transition(draft, STUDIO_STATE.CANCELLED, { ...options, reason: options.reason || 'programmation annulee' });
  return { ...next, scheduled_for: null };
}

export function reopenDraft(draft, options = {}) {
  return transition(draft, STUDIO_STATE.DRAFT, { ...options, reason: options.reason || 'reouverture' });
}

/**
 * Autorisation de partir. Trois verrous : etat valide, contenu valide, portail
 * SAFE ouvert. Aucun n est optionnel, et l ordre des verifications ne change
 * rien : il faut les trois.
 */
export function assertPublishable(env, draft, options = {}) {
  if (draft?.state !== STUDIO_STATE.READY && draft?.state !== STUDIO_STATE.SCHEDULED) {
    throw studioError(STUDIO_ERROR.INVALID_TRANSITION, `un contenu en ${draft?.state} ne peut pas partir en publication`);
  }
  const validation = validateDraft(draft);
  if (!validation.valid) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, validation.errors.join(' ; '), { errors: validation.errors });
  }
  const gate = checkSafeGate(env, draft);
  if (!gate.allowed) {
    throw studioError(STUDIO_ERROR.SAFE_GATE_CLOSED, gate.reason);
  }
  if (options.requireSchedule && !draft.scheduled_for) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, 'aucune date de programmation');
  }
  return true;
}

export function beginPublishing(env, draft, options = {}) {
  assertPublishable(env, draft, options);
  const next = transition(draft, STUDIO_STATE.PUBLISHING, {
    now: options.now,
    reason: options.reason || 'publication demarree',
  });
  return {
    ...next,
    publication_job_id: String(options.jobId || next.publication_job_id || ''),
    idempotency_key: String(options.idempotencyKey || next.idempotency_key || ''),
    failure: null,
  };
}

/** PUBLISHED exige un identifiant Meta reel. Sans lui, ce n est pas publie. */
export function markPublished(draft, instagramMediaId, options = {}) {
  const id = String(instagramMediaId || '').trim();
  if (!id) {
    throw studioError(STUDIO_ERROR.VALIDATION_FAILED, 'aucun instagram_media_id : la publication ne peut pas etre confirmee');
  }
  const next = transition(draft, STUDIO_STATE.PUBLISHED, { ...options, reason: 'publication confirmee par Meta' });
  return {
    ...next,
    instagram_media_id: id,
    published_at: new Date(Number(options.now) || Date.now()).toISOString(),
    failure: null,
  };
}

export function markFailed(draft, failure, options = {}) {
  const next = transition(draft, STUDIO_STATE.FAILED, { ...options, reason: 'echec de publication' });
  return {
    ...next,
    failure: {
      code: String(failure?.code || 'unknown'),
      detail: cleanLine(failure?.detail, 300),
      at: new Date(Number(options.now) || Date.now()).toISOString(),
      stage: String(failure?.stage || ''),
    },
  };
}

/** Reprise apres echec : retour en READY, jamais republication automatique. */
export function retryFailed(draft, options = {}) {
  const next = transition(draft, STUDIO_STATE.READY, { ...options, reason: 'reprise apres echec' });
  return { ...next, publication_job_id: null, idempotency_key: null };
}

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

export function draftKey(draftId) {
  const clean = String(draftId || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!clean) throw studioError(STUDIO_ERROR.VALIDATION_FAILED, 'identifiant de brouillon invalide');
  return `${DRAFT_PREFIX}${clean}.json`;
}

export async function readDraft(env, draftId) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return null;
  try {
    const object = await bucket.get(draftKey(draftId));
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

export async function writeDraft(env, draft) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return draft;
  await bucket.put(draftKey(draft.draft_id), JSON.stringify(draft), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  await indexDraft(env, draft);
  return draft;
}

export async function readDraftIndex(env) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return [];
  try {
    const object = await bucket.get(DRAFT_INDEX_KEY);
    if (!object) return [];
    const parsed = JSON.parse(await object.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function indexDraft(env, draft) {
  const rows = await readDraftIndex(env);
  const entry = {
    draft_id: draft.draft_id,
    state: draft.state,
    format: draft.format,
    scheduled_for: draft.scheduled_for,
    instagram_media_id: draft.instagram_media_id,
    updated_at: draft.updated_at,
  };
  const next = [entry, ...rows.filter((row) => row.draft_id !== draft.draft_id)].slice(0, 200);
  await env.VISUALS_BUCKET.put(DRAFT_INDEX_KEY, JSON.stringify(next), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

/** File d attente des publications : ce qui est programme ou en cours. */
export async function publicationQueue(env, options = {}) {
  const now = Number(options.now) || Date.now();
  const rows = await readDraftIndex(env);
  return rows
    .filter((row) => row.state === STUDIO_STATE.SCHEDULED || row.state === STUDIO_STATE.PUBLISHING)
    .map((row) => ({
      ...row,
      due: row.scheduled_for ? Date.parse(row.scheduled_for) <= now : false,
    }))
    .sort((a, b) => Date.parse(a.scheduled_for || 0) - Date.parse(b.scheduled_for || 0));
}
