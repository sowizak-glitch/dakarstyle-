/**
 * SOWHAT Control V5 - API du Studio
 *
 * Ce module n implemente AUCUNE regle metier. Il expose en HTTP les fonctions
 * deja ecrites et deja testees de `studio-v5.js`, et applique le resultat de
 * la publication via `publishAndPersist`, la meme fonction que le scheduler.
 *
 * Il n existe donc qu une seule machine a etats dans la V5. Une seconde, meme
 * apparemment identique, finirait par diverger : c est exactement ainsi qu on
 * publie deux fois ou qu on laisse partir un contenu non approuve.
 */

import { checkSafeGate, SECURITY_ERROR } from './security-v5.js';
import {
  STUDIO_ERROR, STUDIO_STATE,
  approveDraft, cancelSchedule, createDraft, markReady, previewDraft,
  readDraft, readDraftIndex, saveDraft, scheduleDraft, transition, validateDraft, writeDraft,
} from './studio-v5.js';
import { publishAndPersist } from './scheduler-v5.js';
import { prefillDraftFromPlanDay } from './plan-v5.js';
import { prefillDraftFromRecommendation } from './coach-v5.js';

export const STUDIO_API_PREFIX = '/api/social-intelligence/v5/studio/';

export const STUDIO_ROUTE_ERROR = Object.freeze({
  BODY_INVALID: 'studio_body_invalid',
  BODY_TOO_LARGE: 'studio_body_too_large',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  NOT_FOUND: 'not_found',
  META_NOT_CONFIGURED: 'meta_not_configured',
  STORAGE_UNAVAILABLE: 'studio_storage_unavailable',
  PREFILL_SOURCE_UNKNOWN: 'studio_prefill_source_unknown',
  PLAN_UNAVAILABLE: 'studio_plan_unavailable',
});

/** Correspondance entre les erreurs metier et les codes HTTP. */
const STATUS_BY_CODE = {
  [STUDIO_ERROR.NOT_FOUND]: 404,
  [STUDIO_ERROR.INVALID_TRANSITION]: 409,
  [STUDIO_ERROR.VALIDATION_FAILED]: 422,
  [STUDIO_ERROR.SCHEDULE_IN_PAST]: 422,
  [SECURITY_ERROR.SAFE_GATE_CLOSED]: 409,
  [SECURITY_ERROR.MEDIA_INVALID]: 422,
  plan_day_not_found: 404,
  coach_recommendation_not_found: 404,
};

const MAX_BODY_BYTES = 64 * 1024;

function ok(body, status = 200) { return { status, body: { ok: true, ...body } }; }
function ko(status, error, extra = {}) { return { status, body: { ok: false, error, ...extra } }; }

function fromError(error) {
  const code = error?.code || 'studio_error';
  return ko(STATUS_BY_CODE[code] || 400, code, {
    detail: String(error?.detail || error?.message || '').slice(0, 300),
    ...(error?.errors ? { errors: error.errors } : {}),
  });
}

async function readJsonBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    const error = new Error(STUDIO_ROUTE_ERROR.BODY_TOO_LARGE);
    error.code = STUDIO_ROUTE_ERROR.BODY_TOO_LARGE;
    throw error;
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    const error = new Error(STUDIO_ROUTE_ERROR.BODY_TOO_LARGE);
    error.code = STUDIO_ROUTE_ERROR.BODY_TOO_LARGE;
    throw error;
  }
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('objet attendu');
    return parsed;
  } catch {
    const error = new Error(STUDIO_ROUTE_ERROR.BODY_INVALID);
    error.code = STUDIO_ROUTE_ERROR.BODY_INVALID;
    throw error;
  }
}

/** Vue renvoyee au Studio : le brouillon et l apercu exact de ce qui partira. */
function draftView(draft) {
  return { draft, preview: previewDraft(draft) };
}

/* ------------------------------------------------------------------ */
/* Prefill : plan et coach                                             */
/* ------------------------------------------------------------------ */

async function handlePrefill(url, env, context) {
  const source = String(url.searchParams.get('source') || '').trim().toLowerCase();

  if (source === 'plan') {
    const plan = typeof context.loadPlan === 'function' ? await context.loadPlan() : null;
    if (!plan) return ko(503, STUDIO_ROUTE_ERROR.PLAN_UNAVAILABLE);
    const dayIndex = Number(url.searchParams.get('day'));
    const draft = prefillDraftFromPlanDay(plan, dayIndex, { now: context.now });
    const day = (plan.days || []).find((item) => item.day_index === dayIndex) || null;
    return ok({
      ...draftView(draft),
      persisted: false,
      suggested_schedule: day && day.date && day.time ? `${day.date}T${day.time}:00.000Z` : null,
    });
  }

  if (source === 'coach') {
    const briefing = typeof context.loadBriefing === 'function' ? await context.loadBriefing() : null;
    if (!briefing) return ko(503, STUDIO_ROUTE_ERROR.PLAN_UNAVAILABLE);
    const draft = prefillDraftFromRecommendation(
      briefing, url.searchParams.get('recommendation'), { now: context.now },
    );
    return ok({ ...draftView(draft), persisted: false, suggested_schedule: null });
  }

  return ko(400, STUDIO_ROUTE_ERROR.PREFILL_SOURCE_UNKNOWN);
}

/* ------------------------------------------------------------------ */
/* Actions sur un brouillon                                            */
/* ------------------------------------------------------------------ */

async function handleDraftAction(action, draft, request, env, context) {
  const now = context.now;

  if (action === 'approve') {
    const approved = approveDraft(draft, { now, approvedBy: context.operator });
    await writeDraft(env, approved);
    return ok(draftView(approved));
  }

  if (action === 'ready') {
    // Deja valide : l intention est satisfaite. Refuser ici casserait toute
    // reprise apres une erreur de saisie, alors que rien n a change d etat.
    // Le contenu est quand meme revalide : un media retire entre-temps ne
    // doit pas rester tapi dans un brouillon marque valide.
    if (draft.state === STUDIO_STATE.READY) {
      const validation = validateDraft(draft);
      if (!validation.valid) {
        return ko(422, STUDIO_ERROR.VALIDATION_FAILED, {
          detail: validation.errors.join(' ; '), errors: validation.errors,
        });
      }
      return ok(draftView(draft));
    }
    const ready = markReady(draft, { now });
    await writeDraft(env, ready);
    return ok(draftView(ready));
  }

  if (action === 'schedule') {
    const body = await readJsonBody(request);
    // Reprogrammation : on repasse par READY, une transition deja declaree.
    // Aucune transition nouvelle n est inventee pour l occasion.
    const base = draft.state === STUDIO_STATE.SCHEDULED
      ? transition(draft, STUDIO_STATE.READY, { now, reason: 'reprogrammation' })
      : draft;
    const scheduled = scheduleDraft(base, body.scheduled_for, { now });
    await writeDraft(env, scheduled);
    return ok(draftView(scheduled));
  }

  if (action === 'cancel') {
    const cancelled = cancelSchedule(draft, { now, reason: 'annule depuis le Studio' });
    await writeDraft(env, cancelled);
    return ok(draftView(cancelled));
  }

  if (action === 'publish') {
    // Le portail SAFE est verifie ICI, avant toute transition d etat. Le
    // laisser echouer plus loin marquerait le brouillon FAILED alors que rien
    // n a ete tente : un contenu parfaitement sain paraitrait casse.
    const gate = checkSafeGate(env, draft);
    if (!gate.allowed) return ko(409, gate.code, { detail: gate.reason });

    if (draft.state !== STUDIO_STATE.READY && draft.state !== STUDIO_STATE.SCHEDULED) {
      return ko(409, STUDIO_ERROR.INVALID_TRANSITION, {
        detail: `un contenu en ${draft.state} ne peut pas partir en publication`,
      });
    }
    if (!context.client?.isConfigured?.()) {
      return ko(503, STUDIO_ROUTE_ERROR.META_NOT_CONFIGURED);
    }

    const outcome = await publishAndPersist(env, context.client, draft, {
      now: () => now,
      jobId: `STUDIO-${String(now.toString(36)).toUpperCase()}-${draft.draft_id}`,
      publishOptions: context.publishOptions,
      onEvent: context.onEvent,
    });
    const { draft: stored, ...report } = outcome;
    const published = report.outcome === 'published' || report.outcome === 'already_published';
    const failureView = published ? {} : {
      error: report.reason || 'publish_failed',
      detail: String(report.detail || '').slice(0, 300),
      requires_manual_check: Boolean(report.requires_manual_check),
    };
    return {
      status: published ? 200 : 502,
      body: { ok: published, ...failureView, result: report, ...draftView(stored) },
    };
  }

  return ko(404, STUDIO_ROUTE_ERROR.NOT_FOUND);
}

/* ------------------------------------------------------------------ */
/* Routage                                                             */
/* ------------------------------------------------------------------ */

export function isStudioApiPath(pathname) {
  return String(pathname || '').startsWith(STUDIO_API_PREFIX);
}

/**
 * Repartition des chemins du Studio. `context.requireCsrf` est appele pour
 * TOUTE methode qui n est pas une lecture : la verification n est pas
 * optionnelle et ne depend pas de la route.
 */
export async function handleStudioApi(request, env, context = {}) {
  const url = new URL(request.url);
  const rest = url.pathname.slice(STUDIO_API_PREFIX.length);
  const segments = rest.split('/').filter(Boolean);
  const method = request.method.toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = await context.requireCsrf();
    if (!csrf.ok) return ko(csrf.status || 403, csrf.error);
  }

  if (!env?.VISUALS_BUCKET) return ko(503, STUDIO_ROUTE_ERROR.STORAGE_UNAVAILABLE);

  try {
    // --- /studio/prefill ---
    if (segments.length === 1 && segments[0] === 'prefill') {
      if (method !== 'GET') return ko(405, STUDIO_ROUTE_ERROR.METHOD_NOT_ALLOWED);
      return await handlePrefill(url, env, context);
    }

    if (segments[0] !== 'drafts') return ko(404, STUDIO_ROUTE_ERROR.NOT_FOUND);

    // --- /studio/drafts ---
    if (segments.length === 1) {
      if (method === 'GET') {
        const rows = await readDraftIndex(env);
        return ok({ drafts: rows.slice(0, 100) });
      }
      if (method === 'POST') {
        const body = await readJsonBody(request);
        const draft = createDraft(body, { now: context.now });
        await writeDraft(env, draft);
        return ok(draftView(draft), 201);
      }
      return ko(405, STUDIO_ROUTE_ERROR.METHOD_NOT_ALLOWED);
    }

    // --- /studio/drafts/:id[/action] ---
    const draftId = decodeURIComponent(segments[1]);
    const draft = await readDraft(env, draftId);
    if (!draft) return ko(404, STUDIO_ERROR.NOT_FOUND, { draft_id: draftId });

    if (segments.length === 2) {
      if (method === 'GET') return ok(draftView(draft));
      if (method === 'PATCH') {
        const body = await readJsonBody(request);
        const next = saveDraft(draft, body, { now: context.now });
        await writeDraft(env, next);
        return ok(draftView(next));
      }
      return ko(405, STUDIO_ROUTE_ERROR.METHOD_NOT_ALLOWED);
    }

    if (segments.length === 3) {
      if (method !== 'POST') return ko(405, STUDIO_ROUTE_ERROR.METHOD_NOT_ALLOWED);
      return await handleDraftAction(segments[2], draft, request, env, context);
    }

    return ko(404, STUDIO_ROUTE_ERROR.NOT_FOUND);
  } catch (error) {
    return fromError(error);
  }
}
