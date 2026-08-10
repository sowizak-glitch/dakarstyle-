/**
 * SOWHAT Control V5 - Modele de donnees et synchronisation incrementale
 *
 * Phase 3 : un enregistrement canonique par media Instagram, identifie par son
 * `instagram_media_id`, qui est l'identifiant stable de tout le systeme.
 *
 * Phase 2 : synchronisation incrementale et idempotente. Relancer une
 * synchronisation ne cree jamais de doublon : chaque media est ecrase par sa
 * version la plus recente, jamais ajoute une seconde fois.
 *
 * Regle non negociable : une metrique indisponible vaut `null`, jamais zero.
 * Zero est une mesure ; null est une absence de mesure. Les confondre
 * reviendrait a inventer des donnees.
 */

import { META_ERROR, MetaApiError } from './instagram-client-v5.js';

export const V5_PREFIX = 'visuals/social-intelligence/v5/';
export const ACCOUNT_KEY = `${V5_PREFIX}account.json`;
export const MEDIA_KEY = `${V5_PREFIX}media.json`;
export const SYNC_STATE_KEY = `${V5_PREFIX}sync-state.json`;
export const SYNC_RUNS_KEY = `${V5_PREFIX}sync-runs.json`;
export const ERROR_EVENTS_KEY = `${V5_PREFIX}error-events.json`;
export const ACCOUNT_HISTORY_KEY = `${V5_PREFIX}account-history.json`;

export const MEDIA_FIELDS = [
  'id', 'caption', 'media_type', 'media_product_type', 'media_url',
  'thumbnail_url', 'permalink', 'timestamp', 'like_count', 'comments_count',
].join(',');

export const ACCOUNT_FIELDS = 'id,username,name,followers_count,follows_count,media_count,profile_picture_url';

const MEDIA_INSIGHT_METRICS = {
  IMAGE: ['reach', 'saved', 'shares', 'total_interactions'],
  CAROUSEL_ALBUM: ['reach', 'saved', 'shares', 'total_interactions'],
  VIDEO: ['reach', 'saved', 'shares', 'total_interactions', 'views'],
  // ig_reels_avg_watch_time est la seule mesure de retention que Meta expose.
  // La duree totale du media n'est pas exposee par l'edge /media : la part
  // visionnee reste donc non calculable, et le score le declare tel quel.
  REELS: ['reach', 'saved', 'shares', 'total_interactions', 'views', 'ig_reels_avg_watch_time'],
};

const MAX_MEDIA_RECORDS = 400;
const MAX_ACCOUNT_HISTORY = 180;
const MAX_SYNC_RUNS = 30;
const MAX_ERROR_EVENTS = 60;
const INSIGHT_CONCURRENCY = 4;

/** Metrique reellement mesuree, ou `null` si Meta ne l'a pas fournie. */
export function measured(value) {
  // Piege classique : Number(null) vaut 0. Une absence de valeur ne doit
  // jamais devenir une mesure de zero.
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function normalizeFormat(raw) {
  const productType = String(raw?.media_product_type || '').toUpperCase();
  if (productType === 'REELS') return 'REEL';
  const mediaType = String(raw?.media_type || '').toUpperCase();
  if (mediaType === 'CAROUSEL_ALBUM') return 'CAROUSEL';
  if (mediaType === 'VIDEO') return 'VIDEO';
  if (mediaType === 'IMAGE') return 'IMAGE';
  return 'UNKNOWN';
}

/** Premiere phrase de la legende : l'accroche reellement lue par l'audience. */
export function extractHook(caption) {
  const text = cleanText(caption, 240);
  if (!text) return '';
  return text.split(/[.!?\n]/)[0].trim().slice(0, 120);
}

/**
 * Taux d'engagement. Renvoie `null` si l'un des termes manque : un taux
 * calcule sur une base inconnue serait une invention.
 */
export function engagementRate(interactions, reach) {
  const i = measured(interactions);
  const r = measured(reach);
  if (i === null || r === null || r === 0) return null;
  return Math.round((i / r) * 10000) / 10000;
}

/** Enregistrement canonique d'un media. Toute metrique absente reste `null`. */
export function normalizeMediaRecord(raw, insights, existing) {
  const id = String(raw?.id || '').trim();
  if (!id) return null;

  const values = insights && typeof insights === 'object' ? insights : {};
  const likes = measured(raw?.like_count);
  const comments = measured(raw?.comments_count);
  const reach = measured(values.reach);
  const interactions = measured(values.total_interactions);
  const caption = cleanText(raw?.caption, 2200);

  return {
    instagram_media_id: id,
    media_type: String(raw?.media_type || '').toUpperCase() || 'UNKNOWN',
    format: normalizeFormat(raw),
    published_at: normalizeIso(raw?.timestamp),
    caption,
    hook: extractHook(caption),
    permalink: safeHttps(raw?.permalink),
    media_url: safeHttps(raw?.media_url),
    thumbnail_url: safeHttps(raw?.thumbnail_url),
    reach,
    views: measured(values.views),
    likes,
    comments,
    shares: measured(values.shares),
    saves: measured(values.saved),
    avg_watch_time_ms: measured(values.ig_reels_avg_watch_time),
    video_duration_ms: measured(raw?.video_duration_ms),
    interactions,
    engagement_rate: engagementRate(interactions, reach),
    performance_score: null,
    content_category: existing?.content_category ?? null,
    campaign: existing?.campaign ?? null,
    product: existing?.product ?? null,
    collection: existing?.collection ?? null,
    cta: existing?.cta ?? null,
    insights_available: Object.keys(values).length > 0,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeIso(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

async function readJson(env, key, fallback) {
  if (!env?.VISUALS_BUCKET) return fallback;
  try {
    const object = await env.VISUALS_BUCKET.get(key);
    if (!object) return fallback;
    return JSON.parse(await object.text());
  } catch {
    return fallback;
  }
}

async function writeJson(env, key, value) {
  if (!env?.VISUALS_BUCKET) return;
  await env.VISUALS_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

export async function readMediaRecords(env) {
  const stored = await readJson(env, MEDIA_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export async function readAccountHistory(env) {
  const stored = await readJson(env, ACCOUNT_HISTORY_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

/**
 * Un releve d'abonnes par jour. Sans serie, la croissance ne serait pas
 * mesurable : un point unique ne dit rien d'une evolution. On ne reecrit
 * jamais un releve d'un jour anterieur, on ne fait qu'ajouter.
 */
export async function appendAccountHistory(env, snapshot) {
  const followers = measured(snapshot?.followers_count);
  if (followers === null) return;
  const at = String(snapshot?.at || new Date().toISOString());
  const day = at.slice(0, 10);
  const history = await readAccountHistory(env);
  const withoutToday = history.filter((row) => String(row?.at || '').slice(0, 10) !== day);
  withoutToday.push({
    at,
    followers_count: followers,
    follows_count: measured(snapshot?.follows_count),
    media_count: measured(snapshot?.media_count),
  });
  const ordered = withoutToday
    .sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0))
    .slice(-MAX_ACCOUNT_HISTORY);
  await writeJson(env, ACCOUNT_HISTORY_KEY, ordered);
}

export async function readSyncState(env) {
  const stored = await readJson(env, SYNC_STATE_KEY, null);
  return stored && typeof stored === 'object'
    ? stored
    : { last_run_at: null, last_published_at: null, known_media_count: 0 };
}

async function recordErrorEvent(env, event) {
  const rows = await readJson(env, ERROR_EVENTS_KEY, []);
  const list = Array.isArray(rows) ? rows : [];
  list.unshift({ ...event, at: new Date().toISOString() });
  await writeJson(env, ERROR_EVENTS_KEY, list.slice(0, MAX_ERROR_EVENTS));
}

async function recordSyncRun(env, run) {
  const rows = await readJson(env, SYNC_RUNS_KEY, []);
  const list = Array.isArray(rows) ? rows : [];
  list.unshift(run);
  await writeJson(env, SYNC_RUNS_KEY, list.slice(0, MAX_SYNC_RUNS));
}

/* ------------------------------------------------------------------ */
/* Synchronisation incrementale                                        */
/* ------------------------------------------------------------------ */

function insightMetricsFor(record) {
  const key = record.format === 'REEL' ? 'REELS' : record.media_type;
  return MEDIA_INSIGHT_METRICS[key] || MEDIA_INSIGHT_METRICS.IMAGE;
}

function flattenInsights(payload) {
  const values = {};
  for (const row of Array.isArray(payload?.data) ? payload.data : []) {
    const name = String(row?.name || '').trim();
    const value = row?.values?.[0]?.value ?? row?.total_value?.value;
    if (name && value !== undefined && value !== null) values[name] = value;
  }
  return values;
}

/** Applique une fonction avec une concurrence bornee. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * Synchronisation incrementale et idempotente.
 *
 * - ne redemande que les medias publies apres le dernier curseur connu ;
 * - fusionne par `instagram_media_id` : relancer la meme synchronisation ne
 *   duplique rien et n'invente rien ;
 * - un echec d'insights sur un media n'interrompt pas la synchronisation :
 *   le media est conserve avec ses metriques a `null` et l'erreur est tracee ;
 * - un echec fatal (jeton invalide, permissions) arrete la synchronisation et
 *   est enregistre ; l'etat precedent n'est pas ecrase.
 */
export async function runIncrementalSync(env, client, options = {}) {
  const now = options.now || (() => Date.now());
  const maxPages = Number(options.maxPages) > 0 ? Number(options.maxPages) : 5;
  const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : 25;
  const full = options.full === true;
  const startedAt = now();
  const syncId = `SYNC-${startedAt.toString(36).toUpperCase()}`;

  if (!client?.isConfigured?.()) {
    const run = failedRun(syncId, startedAt, now(), META_ERROR.NOT_CONFIGURED, 'credentials Instagram absents');
    await recordSyncRun(env, run);
    return run;
  }

  const userId = String(env.INSTAGRAM_USER_ID || '').trim();
  const state = await readSyncState(env);
  const since = full ? null : state.last_published_at;

  let account = null;
  let rawMedia = [];
  let truncated = false;

  try {
    account = await client.request(userId, { fields: ACCOUNT_FIELDS });
    const page = await client.paginate(`${userId}/media`, { fields: MEDIA_FIELDS }, { maxPages, limit: pageSize });
    rawMedia = page.items;
    truncated = page.truncated;
  } catch (error) {
    const code = error instanceof MetaApiError ? error.code : META_ERROR.UNKNOWN;
    const detail = error instanceof MetaApiError ? error.detail : '';
    await recordErrorEvent(env, { sync_id: syncId, stage: 'fetch', error_code: code, detail });
    const run = failedRun(syncId, startedAt, now(), code, detail);
    await recordSyncRun(env, run);
    return run;
  }

  const fresh = since
    ? rawMedia.filter((item) => {
      const published = Date.parse(String(item?.timestamp || ''));
      return !Number.isFinite(published) || published > Date.parse(since);
    })
    : rawMedia;

  const existing = await readMediaRecords(env);
  const byId = new Map(existing.map((row) => [row.instagram_media_id, row]));

  let insightFailures = 0;
  const records = await mapWithConcurrency(fresh, INSIGHT_CONCURRENCY, async (raw) => {
    const previous = byId.get(String(raw?.id || '')) || null;
    const draft = normalizeMediaRecord(raw, null, previous);
    if (!draft) return null;
    try {
      const payload = await client.request(`${draft.instagram_media_id}/insights`, {
        metric: insightMetricsFor(draft).join(','),
      });
      return normalizeMediaRecord(raw, flattenInsights(payload), previous);
    } catch (error) {
      insightFailures += 1;
      const code = error instanceof MetaApiError ? error.code : META_ERROR.UNKNOWN;
      await recordErrorEvent(env, {
        sync_id: syncId,
        stage: 'insights',
        instagram_media_id: draft.instagram_media_id,
        error_code: code,
        detail: error instanceof MetaApiError ? error.detail : '',
      });
      // Donnee partielle assumee : le media existe, ses metriques restent null.
      return draft;
    }
  });

  let created = 0;
  let updated = 0;
  for (const record of records) {
    if (!record) continue;
    if (byId.has(record.instagram_media_id)) updated += 1; else created += 1;
    byId.set(record.instagram_media_id, record);
  }

  const merged = [...byId.values()]
    .sort((a, b) => Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0))
    .slice(0, MAX_MEDIA_RECORDS);

  const newestPublished = merged.reduce((latest, row) => {
    const value = Date.parse(row.published_at || '');
    return Number.isFinite(value) && value > latest ? value : latest;
  }, since ? Date.parse(since) : 0);

  await writeJson(env, MEDIA_KEY, merged);
  await writeJson(env, ACCOUNT_KEY, {
    instagram_user_id: userId,
    username: String(account?.username || ''),
    name: String(account?.name || ''),
    followers_count: measured(account?.followers_count),
    follows_count: measured(account?.follows_count),
    media_count: measured(account?.media_count),
    synced_at: new Date(now()).toISOString(),
  });
  await appendAccountHistory(env, {
    at: new Date(now()).toISOString(),
    followers_count: account?.followers_count,
    follows_count: account?.follows_count,
    media_count: account?.media_count,
  });
  await writeJson(env, SYNC_STATE_KEY, {
    last_run_at: new Date(now()).toISOString(),
    last_published_at: newestPublished > 0 ? new Date(newestPublished).toISOString() : null,
    known_media_count: merged.length,
  });

  const run = {
    sync_id: syncId,
    status: insightFailures > 0 ? 'partial' : 'success',
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date(now()).toISOString(),
    duration_ms: now() - startedAt,
    mode: full ? 'full' : 'incremental',
    fetched: rawMedia.length,
    considered: fresh.length,
    created,
    updated,
    total_known: merged.length,
    insight_failures: insightFailures,
    truncated,
    error_code: null,
  };
  await recordSyncRun(env, run);
  return run;
}

function failedRun(syncId, startedAt, finishedAt, code, detail) {
  return {
    sync_id: syncId,
    status: 'failed',
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    fetched: 0,
    considered: 0,
    created: 0,
    updated: 0,
    total_known: null,
    insight_failures: 0,
    truncated: false,
    error_code: code,
    detail: String(detail || '').slice(0, 300),
  };
}
