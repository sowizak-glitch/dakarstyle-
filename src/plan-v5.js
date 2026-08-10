/**
 * SOWHAT Control V5 - Plan editorial 7 jours
 *
 * Le plan n'est pas un gabarit rempli au hasard : chaque choix (format, heure,
 * produit, accroche, appel a l action) est soit tire d une correlation reelle
 * de la Content Memory, soit declare explicitement comme non fonde.
 *
 * Deux garanties :
 *   - aucune justification ne cite un chiffre que la memoire n a pas mesure ;
 *   - quand rien n est mesurable, le plan le dit et propose une rotation
 *     neutre, au lieu de deguiser une devinette en recommandation.
 */

import { CONFIDENCE } from './content-memory-v5.js';
import { createDraft } from './studio-v5.js';

export const PLAN_KEY = 'visuals/social-intelligence/v5/plan-7-jours.json';
export const PLAN_DAYS = 7;

/** Rotation d objectifs, stable et lisible. */
const OBJECTIVES = ['notoriete', 'engagement', 'conversion', 'notoriete', 'engagement', 'conversion', 'communaute'];

const FALLBACK_FORMATS = ['REEL', 'IMAGE', 'CAROUSEL'];
const DAY_MS = 86400000;
const TIMEZONE = 'Africa/Dakar';

const CONFIDENCE_ORDER = {
  [CONFIDENCE.HIGH]: 3, [CONFIDENCE.MEDIUM]: 2, [CONFIDENCE.LOW]: 1, [CONFIDENCE.NONE]: 0,
};

const HOOK_TEMPLATES = {
  question: 'Tu connais deja {sujet} ?',
  chiffre: '3 raisons de choisir {sujet}',
  imperatif: 'Decouvre {sujet}',
  declaratif: '{sujet}, disponible maintenant',
};

/* ------------------------------------------------------------------ */
/* Selection fondee sur les donnees                                    */
/* ------------------------------------------------------------------ */

/**
 * Meilleure valeur observee pour une dimension. Ne renvoie une valeur que si
 * une correlation POSITIVE existe reellement ; sinon `null`, jamais un choix
 * par defaut deguise en recommandation.
 */
export function bestValueFor(memory, dimension, options = {}) {
  const correlations = Array.isArray(memory?.correlations) ? memory.correlations : [];
  const candidates = correlations.filter((c) => c.dimension === dimension
    && c.delta_pct > 0
    && CONFIDENCE_ORDER[c.confidence] > 0
    && (!options.metric || c.metric === options.metric));
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => (CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence])
    || (b.delta_pct - a.delta_pct)
    || String(a.value).localeCompare(String(b.value)))[0];
  return {
    value: best.value,
    confidence: best.confidence,
    sample_size: best.sample_size,
    delta_pct: best.delta_pct,
    metric: best.metric,
    statement: best.statement,
  };
}

/** Formats classes par evidence, complete par une rotation neutre si besoin. */
export function rankedFormats(memory) {
  const correlations = Array.isArray(memory?.correlations) ? memory.correlations : [];
  const ranked = correlations
    .filter((c) => c.dimension === 'format' && c.delta_pct > 0 && CONFIDENCE_ORDER[c.confidence] > 0)
    .sort((a, b) => (CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence]) || (b.delta_pct - a.delta_pct))
    .map((c) => c.value);
  const observed = Object.keys(memory?.dimensions?.format?.values || {});
  const pool = [...new Set([...ranked, ...observed, ...FALLBACK_FORMATS])];
  return { ranked, pool: pool.length ? pool : FALLBACK_FORMATS };
}

/** Heure concrete au milieu d un creneau observe. Sans creneau, pas d heure. */
export function hourFromSlot(slot) {
  if (!slot || typeof slot !== 'string' || !slot.includes('-')) return null;
  const [start, end] = slot.split('-').map(Number);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((start + end) / 2);
}

function dakarWeekday(timestamp) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, weekday: 'long' }).format(new Date(timestamp));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Construction du plan                                                */
/* ------------------------------------------------------------------ */

function justificationFor(sources, fallbackReason) {
  const used = sources.filter(Boolean);
  if (!used.length) {
    return {
      basis: 'aucune_donnee',
      confidence: CONFIDENCE.NONE,
      sample_size: 0,
      statements: [fallbackReason],
    };
  }
  const weakest = used.reduce(
    (min, source) => (CONFIDENCE_ORDER[source.confidence] < CONFIDENCE_ORDER[min.confidence] ? source : min),
    used[0],
  );
  return {
    basis: 'correlations_observees',
    confidence: weakest.confidence,
    sample_size: Math.min(...used.map((s) => s.sample_size)),
    statements: used.map((s) => s.statement),
  };
}

function captionDraft({ hook, product, cta, objective }) {
  const subject = product || 'la selection du moment';
  const lines = [
    hook || `${subject}, a decouvrir.`,
    objective === 'conversion'
      ? `Disponible des maintenant. ${cta ? '' : 'Ecris-nous pour commander.'}`
      : 'Dis-nous ce que tu en penses en commentaire.',
  ];
  if (cta) lines.push(cta);
  return lines.filter(Boolean).join('\n\n');
}

/**
 * Construit le plan des sept prochains jours.
 * `memory` est la Content Memory ; `briefing` est le briefing du Coach, cite
 * tel quel. Aucun des deux n est recalcule ici.
 */
export function buildSevenDayPlan(memory, options = {}) {
  const now = Number(options.now) || Date.now();
  const startAt = Number(options.startAt) || now + DAY_MS;

  const formats = rankedFormats(memory);
  const bestHour = bestValueFor(memory, 'hour_slot');
  const bestWeekday = bestValueFor(memory, 'weekday');
  const bestCta = bestValueFor(memory, 'cta');
  const bestHook = bestValueFor(memory, 'hook_type');
  const bestProduct = bestValueFor(memory, 'product');
  const bestCollection = bestValueFor(memory, 'collection');
  const bestCaptionLength = bestValueFor(memory, 'caption_length');

  const evidenceCount = [bestHour, bestWeekday, bestCta, bestHook, bestProduct, bestCollection]
    .filter(Boolean).length + formats.ranked.length;
  const status = evidenceCount > 0 ? 'ok' : 'no_evidence';

  const hashtagPool = Object.entries(memory?.dimensions?.tag?.values || {})
    .sort((a, b) => b[1].sample_size - a[1].sample_size)
    .map(([tag]) => tag)
    .slice(0, 8);

  const days = [];
  for (let index = 0; index < PLAN_DAYS; index += 1) {
    const date = new Date(startAt + index * DAY_MS);
    const weekday = dakarWeekday(date.getTime());
    const objective = OBJECTIVES[index % OBJECTIVES.length];

    // Le format le mieux note revient un jour sur deux ; les autres tournent.
    const format = formats.ranked.length
      ? (index % 2 === 0 ? formats.ranked[0] : formats.pool[(index % formats.pool.length)])
      : formats.pool[index % formats.pool.length];

    const hour = hourFromSlot(bestHour?.value);
    const product = bestProduct?.value || null;
    const collection = bestCollection?.value || null;
    const cta = bestCta?.value || null;
    const hookStyle = bestHook?.value || null;
    const hook = hookStyle
      ? (HOOK_TEMPLATES[hookStyle] || HOOK_TEMPLATES.declaratif).replace('{sujet}', product || collection || 'la nouveaute')
      : null;

    const isPriorityDay = Boolean(bestWeekday && weekday === bestWeekday.value);
    const justification = justificationFor(
      [
        formats.ranked.length ? bestValueFor(memory, 'format') : null,
        bestHour,
        isPriorityDay ? bestWeekday : null,
        bestCta,
        bestHook,
      ],
      'Aucun ecart mesurable sur cette fenetre : rotation neutre proposee, a valider par un humain.',
    );

    days.push({
      day_index: index + 1,
      date: date.toISOString().slice(0, 10),
      weekday,
      priority_day: isPriorityDay,
      format,
      time: hour === null ? null : `${String(hour).padStart(2, '0')}:00`,
      timezone: TIMEZONE,
      objective,
      product,
      collection,
      hook,
      angle: product || collection
        ? `Mettre en avant ${product || collection} sous l angle ${objective}.`
        : `Angle ${objective}, sujet a choisir : aucune donnee produit disponible.`,
      cta,
      caption_draft: captionDraft({ hook, product, cta, objective }),
      caption_length_target: bestCaptionLength?.value || null,
      hashtags: hashtagPool,
      justification,
      confidence: justification.confidence,
      needs_human_edit: true,
    });
  }

  return {
    kind: 'PLAN_7_JOURS',
    status,
    version: '5.0.0',
    generated_at: new Date(now).toISOString(),
    start_date: days[0]?.date || null,
    end_date: days[days.length - 1]?.date || null,
    timezone: TIMEZONE,
    comparison_window: memory?.comparison_window || null,
    evidence: {
      format: formats.ranked[0] || null,
      hour_slot: bestHour?.value || null,
      weekday: bestWeekday?.value || null,
      cta: bestCta?.value || null,
      hook_type: bestHook?.value || null,
      product: bestProduct?.value || null,
      collection: bestCollection?.value || null,
      correlations_used: evidenceCount,
    },
    coach_headline: options.briefing?.headline || null,
    days,
    limits: status === 'ok'
      ? [
        'Le plan repose sur des correlations observees, pas sur des relations causales demontrees.',
        'Chaque legende est un brouillon : elle doit etre relue et adaptee avant publication.',
        'Aucun media n est choisi automatiquement : le visuel reste un choix humain.',
      ]
      : [
        'Aucun ecart mesurable sur la fenetre : ce plan est une rotation neutre, pas une recommandation.',
        'Aucun chiffre n est avance parce qu aucun n a ete mesure.',
        'Chaque jour doit etre revu et complete par un humain.',
      ],
  };
}

/* ------------------------------------------------------------------ */
/* Prefill du Studio                                                   */
/* ------------------------------------------------------------------ */

/**
 * « Creer a partir de ce jour » : transforme un jour du plan en brouillon
 * Studio reel. Le brouillon nait en DRAFT, sans media et sans approbation :
 * un plan ne peut donc jamais declencher une publication tout seul.
 */
export function prefillDraftFromPlanDay(plan, dayIndex, options = {}) {
  const day = (plan?.days || []).find((item) => item.day_index === Number(dayIndex));
  if (!day) {
    const error = new Error('plan_day_not_found');
    error.code = 'plan_day_not_found';
    throw error;
  }

  const draft = createDraft({
    format: day.format,
    caption: day.caption_draft,
    hashtags: day.hashtags,
    cta: day.cta,
    product: day.product,
    collection: day.collection,
    objective: day.objective,
    angle: day.angle,
    hook: day.hook,
    id_suffix: `J${day.day_index}`,
    source: {
      origin: 'plan_7_jours',
      plan_generated_at: plan.generated_at,
      day_index: day.day_index,
      planned_date: day.date,
      planned_time: day.time,
      confidence: day.confidence,
      justification: day.justification,
    },
  }, { now: options.now });

  return draft;
}

/** Date et heure planifiees d un jour, dans le fuseau du plan. */
export function plannedInstant(day) {
  if (!day?.date || !day?.time) return null;
  // L heure du plan est exprimee a Dakar (UTC+0 toute l annee).
  const iso = `${day.date}T${day.time}:00.000Z`;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

export async function readPlan(env) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return null;
  try {
    const object = await bucket.get(PLAN_KEY);
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

export async function writePlan(env, plan) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return;
  await bucket.put(PLAN_KEY, JSON.stringify(plan), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}
