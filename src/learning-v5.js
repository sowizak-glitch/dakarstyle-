/**
 * SOWHAT Control V5 - Boucle d apprentissage
 *
 * Apres publication, on mesure a T+1h, T+6h, T+24h et T+72h. Chaque releve est
 * un fait date : il s ajoute, il n ecrase jamais le precedent. L historique brut
 * est append-only, parce qu une mesure corrigee apres coup n est plus une mesure.
 *
 * Chaque checkpoint est idempotent : le rejouer ne cree pas de doublon et ne
 * remplace pas la valeur deja enregistree.
 *
 * La prevision n est pas une devinette : c est la mediane des contenus
 * comparables au moment de la publication, avec sa taille d echantillon. Quand
 * il n y a pas de comparables, il n y a pas de prevision, et l ecart n est pas
 * calcule plutot que d etre calcule contre zero.
 */

import { META_ERROR, MetaApiError } from './instagram-client-v5.js';
import { buildCohort } from './sowhat-score-v5.js';

export const LEARNING_PREFIX = 'visuals/social-intelligence/v5/learning/';
export const LEARNING_INDEX_KEY = 'visuals/social-intelligence/v5/learning-index.json';

/** Les quatre horizons de mesure, en millisecondes apres publication. */
export const CHECKPOINTS = Object.freeze([
  { label: 'T+1h', offset_ms: 3600000 },
  { label: 'T+6h', offset_ms: 6 * 3600000 },
  { label: 'T+24h', offset_ms: 24 * 3600000 },
  { label: 'T+72h', offset_ms: 72 * 3600000 },
]);

export const LEARNING_STATUS = Object.freeze({
  RECORDED: 'recorded',
  ALREADY_RECORDED: 'already_recorded',
  NOT_DUE: 'not_due',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
});

const MEASURED_METRICS = ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];

/** Metrique reellement mesuree, ou null. Jamais zero par defaut. */
function metric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function median(values) {
  const list = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function round2(value) {
  return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Echeances                                                           */
/* ------------------------------------------------------------------ */

/** Checkpoints dus a l instant donne, jamais ceux du futur. */
export function dueCheckpoints(publishedAt, now) {
  const published = Date.parse(String(publishedAt || ''));
  if (!Number.isFinite(published)) return [];
  return CHECKPOINTS
    .map((checkpoint) => ({ ...checkpoint, due_at: new Date(published + checkpoint.offset_ms).toISOString() }))
    .filter((checkpoint) => published + checkpoint.offset_ms <= now);
}

/* ------------------------------------------------------------------ */
/* Prevision                                                           */
/* ------------------------------------------------------------------ */

/**
 * Prevision de portee : mediane des contenus comparables publies avant celui-ci.
 * Sans comparables, aucune prevision. On ne remplace jamais une absence de
 * reference par zero ni par une moyenne globale hors format.
 */
export function forecastFor(record, records, options = {}) {
  const cohort = buildCohort(record, records, {
    windowDays: options.windowDays,
    now: Date.parse(record?.published_at || '') || options.now,
  });
  const sample = cohort.members.map((row) => metric(row.reach)).filter((v) => v !== null);
  if (!sample.length) {
    return {
      metric: 'reach',
      value: null,
      basis: 'aucun contenu comparable disponible au moment de la publication',
      sample_size: 0,
      comparison_window_days: cohort.window_days,
    };
  }
  return {
    metric: 'reach',
    value: round2(median(sample)),
    basis: `mediane de la portee des ${sample.length} ${cohort.format} comparables publies avant`,
    sample_size: sample.length,
    comparison_window_days: cohort.window_days,
  };
}

/* ------------------------------------------------------------------ */
/* Stockage append-only                                                */
/* ------------------------------------------------------------------ */

/**
 * Cle de stockage d un contenu. L identifiant est VALIDE, pas nettoye :
 * nettoyer silencieusement `../x` en `..x` produirait une cle acceptee mais
 * fausse. Un identifiant qui n a pas la forme attendue est refuse.
 */
export function learningKey(mediaId) {
  const value = String(mediaId ?? '');
  if (!/^[A-Za-z0-9_]{1,64}$/.test(value)) {
    const error = new Error('learning_invalid_media_id');
    error.code = 'learning_invalid_media_id';
    throw error;
  }
  return `${LEARNING_PREFIX}${value}.json`;
}

export function isValidMediaId(value) {
  return /^[A-Za-z0-9_]{1,64}$/.test(String(value ?? ''));
}

export async function readLearningRecord(env, mediaId) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return null;
  try {
    const object = await bucket.get(learningKey(mediaId));
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

async function writeLearningRecord(env, record) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return;
  await bucket.put(learningKey(record.instagram_media_id), JSON.stringify(record), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

/* ------------------------------------------------------------------ */
/* Releve d un checkpoint                                              */
/* ------------------------------------------------------------------ */

function flattenInsights(payload) {
  const values = {};
  for (const row of Array.isArray(payload?.data) ? payload.data : []) {
    const name = String(row?.name || '').trim();
    const value = row?.values?.[0]?.value ?? row?.total_value?.value;
    if (name && value !== undefined && value !== null) values[name] = value;
  }
  return values;
}

function comparison(actualReach, forecast, baseline) {
  const forecastValue = forecast?.value ?? null;
  return {
    actual: actualReach,
    forecast: forecastValue,
    baseline,
    // Un ecart contre une reference absente n a pas de sens : il reste null.
    delta_vs_forecast_pct: actualReach === null || forecastValue === null || forecastValue === 0
      ? null
      : round2(((actualReach - forecastValue) / forecastValue) * 100),
    delta_vs_baseline_pct: actualReach === null || baseline === null || baseline === 0
      ? null
      : round2(((actualReach - baseline) / baseline) * 100),
  };
}

/**
 * Enregistre un checkpoint. Idempotent : si le releve existe deja, il est
 * conserve tel quel et la fonction le signale au lieu de le remplacer.
 */
export async function recordCheckpoint(env, client, context, options = {}) {
  const { mediaId, publishedAt, label, records = [], baseline = null } = context;
  const now = Number(options.now) || Date.now();

  if (!isValidMediaId(mediaId)) {
    return { status: LEARNING_STATUS.FAILED, label, error_code: 'learning_invalid_media_id' };
  }

  const checkpoint = CHECKPOINTS.find((item) => item.label === label);
  if (!checkpoint) return { status: LEARNING_STATUS.FAILED, label, error_code: 'learning_unknown_checkpoint' };

  const published = Date.parse(String(publishedAt || ''));
  if (!Number.isFinite(published)) return { status: LEARNING_STATUS.FAILED, label, error_code: 'learning_invalid_published_at' };
  if (published + checkpoint.offset_ms > now) {
    return { status: LEARNING_STATUS.NOT_DUE, label, due_at: new Date(published + checkpoint.offset_ms).toISOString() };
  }

  const existing = (await readLearningRecord(env, mediaId)) || {
    instagram_media_id: String(mediaId),
    published_at: new Date(published).toISOString(),
    forecast: null,
    checkpoints: {},
    created_at: new Date(now).toISOString(),
  };

  if (existing.checkpoints?.[label]) {
    return { status: LEARNING_STATUS.ALREADY_RECORDED, label, measured_at: existing.checkpoints[label].measured_at };
  }

  // La prevision est figee au premier releve : recalculer une prevision apres
  // coup avec des donnees posterieures reviendrait a tricher.
  if (!existing.forecast) {
    const self = records.find((row) => row.instagram_media_id === String(mediaId))
      || { instagram_media_id: String(mediaId), format: context.format || 'UNKNOWN', published_at: new Date(published).toISOString() };
    existing.forecast = forecastFor(self, records, { now });
  }

  let values;
  try {
    const payload = await client.request(`${mediaId}/insights`, { metric: MEASURED_METRICS.join(',') });
    values = flattenInsights(payload);
  } catch (error) {
    const code = error instanceof MetaApiError ? error.code : META_ERROR.UNKNOWN;
    // Un echec de mesure n est pas une mesure a zero : rien n est enregistre.
    return { status: LEARNING_STATUS.UNAVAILABLE, label, error_code: code };
  }

  const measured = {};
  for (const name of MEASURED_METRICS) measured[name] = metric(values[name]);

  const entry = {
    label,
    due_at: new Date(published + checkpoint.offset_ms).toISOString(),
    measured_at: new Date(now).toISOString(),
    metrics: measured,
    comparison: comparison(measured.reach, existing.forecast, baseline),
    metrics_available: Object.values(measured).some((v) => v !== null),
  };

  const next = {
    ...existing,
    checkpoints: { ...existing.checkpoints, [label]: entry },
    updated_at: new Date(now).toISOString(),
  };
  await writeLearningRecord(env, next);
  return { status: LEARNING_STATUS.RECORDED, label, entry };
}

/* ------------------------------------------------------------------ */
/* Execution de la boucle                                              */
/* ------------------------------------------------------------------ */

/**
 * Passe tous les contenus publies et enregistre les checkpoints dus.
 * `published` est la liste des contenus publies : { instagram_media_id,
 * published_at, format }.
 */
export async function runLearningLoop(env, client, published, options = {}) {
  const now = Number(options.now) || Date.now();
  const records = Array.isArray(options.records) ? options.records : [];
  const baseline = options.baseline ?? null;
  const results = [];

  for (const item of Array.isArray(published) ? published : []) {
    const mediaId = String(item?.instagram_media_id || '').trim();
    if (!isValidMediaId(mediaId)) continue;
    for (const checkpoint of dueCheckpoints(item.published_at, now)) {
      const outcome = await recordCheckpoint(env, client, {
        mediaId,
        publishedAt: item.published_at,
        format: item.format,
        label: checkpoint.label,
        records,
        baseline,
      }, { now });
      results.push({ instagram_media_id: mediaId, ...outcome });
    }
  }

  return {
    run_at: new Date(now).toISOString(),
    considered: Array.isArray(published) ? published.length : 0,
    recorded: results.filter((r) => r.status === LEARNING_STATUS.RECORDED).length,
    already_recorded: results.filter((r) => r.status === LEARNING_STATUS.ALREADY_RECORDED).length,
    unavailable: results.filter((r) => r.status === LEARNING_STATUS.UNAVAILABLE).length,
    results,
  };
}

/**
 * Synthese lisible d un contenu : ce qui a ete prevu, ce qui a ete mesure, et
 * a quel rythme. Aucun trou n est comble.
 */
export function summarizeLearning(record) {
  if (!record) return null;
  const points = CHECKPOINTS.map((checkpoint) => {
    const entry = record.checkpoints?.[checkpoint.label] || null;
    return {
      label: checkpoint.label,
      measured: Boolean(entry),
      reach: entry?.metrics?.reach ?? null,
      delta_vs_forecast_pct: entry?.comparison?.delta_vs_forecast_pct ?? null,
      status: entry ? 'mesure' : 'non mesure',
    };
  });
  const last = [...points].reverse().find((point) => point.reach !== null) || null;
  return {
    instagram_media_id: record.instagram_media_id,
    published_at: record.published_at,
    forecast: record.forecast,
    points,
    measured_points: points.filter((p) => p.measured).length,
    latest_reach: last?.reach ?? null,
    latest_delta_vs_forecast_pct: last?.delta_vs_forecast_pct ?? null,
  };
}
