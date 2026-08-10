/**
 * SOWHAT Control V5 - Content Memory
 *
 * La memoire apprend sur ce qui a reellement ete publie et mesure. Elle est
 * derivee : elle se recalcule integralement a partir des enregistrements bruts,
 * qu'elle ne modifie jamais. Perdre la memoire n'a donc aucune consequence,
 * perdre l'historique brut en aurait une.
 *
 * Elle distingue strictement trois niveaux, et ne les melange jamais :
 *
 *   OBSERVATION    un fait mesure. Aucune causalite, aucun conseil.
 *   CORRELATION    un ecart constate entre un groupe et sa reference, toujours
 *                  accompagne de sa taille d echantillon et de sa confiance.
 *                  Une correlation faible reste une correlation faible.
 *   RECOMMANDATION une action proposee. Produite par le Coach, jamais par la
 *                  memoire, et seulement a partir de correlations assez solides.
 */

export const INSIGHT_KIND = Object.freeze({
  OBSERVATION: 'OBSERVATION',
  CORRELATION: 'CORRELATION',
  RECOMMENDATION: 'RECOMMANDATION',
});

export const CONFIDENCE = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const MEMORY_V5_KEY = 'visuals/social-intelligence/v5/content-memory.json';
export const MEMORY_V5_VERSION = '5.0.0';

export const DEFAULT_MEMORY_WINDOW_DAYS = 90;
/** En dessous, on observe, on ne correle pas. */
export const MIN_CORRELATION_SAMPLE = 3;
/** Ecart en dessous duquel il n'y a rien a signaler. */
export const MIN_CORRELATION_DELTA_PCT = 15;

const DAY_MS = 86400000;
const TIMEZONE = 'Africa/Dakar';
const MAX_VALUES_PER_DIMENSION = 40;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

function metric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  const list = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

/**
 * Arrondi d'affichage. Les taux utiles ici valent souvent quelques millemes :
 * un arrondi a deux decimales ecraserait 0.015 sur 0.02 et fabriquerait un
 * ecart de 25 % la ou il n y en a aucun. On garde donc quatre chiffres
 * significatifs sous 1, deux decimales au-dessus.
 *
 * Cet arrondi ne sert QU A l affichage : deltas, references et comparaisons
 * sont toujours calcules sur les valeurs brutes.
 */
export function displayRound(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value === 0) return 0;
  const magnitude = Math.abs(value);
  if (magnitude >= 1) return Math.round(value * 100) / 100;
  const digits = Math.min(10, 2 - Math.floor(Math.log10(magnitude)));
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const round2 = displayRound;

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function cleanLabel(value, max = 60) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Extraction des dimensions                                           */
/* ------------------------------------------------------------------ */

export const HOUR_SLOTS = Object.freeze([
  ['00-06', 0, 6], ['06-09', 6, 9], ['09-12', 9, 12], ['12-15', 12, 15],
  ['15-18', 15, 18], ['18-21', 18, 21], ['21-24', 21, 24],
]);

/** Heure et jour vus depuis Dakar : le fuseau de l'audience, pas celui du serveur. */
export function dakarParts(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return { hour: null, weekday: null };
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: TIMEZONE, hour: '2-digit', hour12: false, weekday: 'long',
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || null;
    return { hour: Number.isFinite(hour) ? hour : null, weekday };
  } catch {
    return { hour: null, weekday: null };
  }
}

export function hourSlot(hour) {
  if (hour === null || !Number.isFinite(hour)) return null;
  const found = HOUR_SLOTS.find(([, start, end]) => hour >= start && hour < end);
  return found ? found[0] : null;
}

export function captionLengthBucket(caption) {
  const length = String(caption ?? '').trim().length;
  if (!length) return null;
  if (length <= 120) return 'court';
  if (length <= 600) return 'moyen';
  return 'long';
}

/** Nature de l'accroche : une categorie apprenable, pas une chaine unique. */
export function hookType(hook) {
  const text = cleanLabel(hook, 200);
  if (!text) return null;
  if (text.includes('?')) return 'question';
  if (/\d/.test(text)) return 'chiffre';
  if (/^(decouvre|decouvrez|essaie|essayez|regarde|regardez|viens|venez|profite|profitez|commande|commandez|clique|cliquez)\b/i.test(text)) return 'imperatif';
  return 'declaratif';
}

export function extractHashtags(caption) {
  const found = String(caption ?? '').match(/#[\p{L}\p{N}_]{2,40}/gu) || [];
  return [...new Set(found.map((tag) => tag.toLowerCase()))].slice(0, 30);
}

/**
 * Appel a l'action. L'annotation humaine prime ; a defaut on detecte un motif
 * explicite. Rien detecte = rien invente : la valeur reste absente.
 */
export function detectCta(record) {
  const annotated = cleanLabel(record?.cta, 40);
  if (annotated) return annotated.toLowerCase();
  const caption = String(record?.caption ?? '').toLowerCase();
  if (!caption) return null;
  if (/lien en bio|link in bio/.test(caption)) return 'lien_en_bio';
  if (/\bdm\b|message prive|ecris-nous|ecrivez-nous/.test(caption)) return 'dm';
  if (/whatsapp|\+221/.test(caption)) return 'whatsapp';
  if (/commente|commentez|dis-nous|dites-nous/.test(caption)) return 'commentaire';
  if (/partage|partagez|identifie|identifiez/.test(caption)) return 'partage';
  if (/commande|commandez|achete|achetez/.test(caption)) return 'achat';
  return null;
}

/**
 * Dimensions d'un enregistrement. Une dimension non renseignee est ABSENTE :
 * elle ne devient pas une categorie « inconnu » qui polluerait les references.
 */
export function dimensionsOf(record) {
  const { hour, weekday } = dakarParts(record?.published_at);
  const tags = extractHashtags(record?.caption);
  return {
    media_type: cleanLabel(record?.media_type) || null,
    format: cleanLabel(record?.format) || null,
    product: cleanLabel(record?.product) || null,
    collection: cleanLabel(record?.collection) || null,
    campaign: cleanLabel(record?.campaign) || null,
    weekday: weekday || null,
    hour_slot: hourSlot(hour),
    hook_type: hookType(record?.hook),
    cta: detectCta(record),
    caption_length: captionLengthBucket(record?.caption),
    tag: tags.length ? tags : null,
  };
}

export const DIMENSIONS = Object.freeze([
  'media_type', 'format', 'product', 'collection', 'campaign',
  'weekday', 'hour_slot', 'hook_type', 'cta', 'caption_length', 'tag',
]);

/* ------------------------------------------------------------------ */
/* Metriques suivies                                                   */
/* ------------------------------------------------------------------ */

function savesSharesRate(record) {
  const saves = metric(record?.saves);
  const shares = metric(record?.shares);
  const reach = metric(record?.reach);
  if (saves === null || shares === null || reach === null || reach === 0) return null;
  return (saves + shares) / reach;
}

export const TRACKED_METRICS = Object.freeze([
  { key: 'reach', label: 'portee', read: (r) => metric(r?.reach) },
  { key: 'engagement_rate', label: 'taux d engagement', read: (r) => metric(r?.engagement_rate) },
  { key: 'saves_shares_rate', label: 'taux de sauvegardes et partages', read: savesSharesRate },
  { key: 'score', label: 'score Sowhat', read: (r) => metric(r?.sowhat_score) },
]);

/* ------------------------------------------------------------------ */
/* Confiance                                                           */
/* ------------------------------------------------------------------ */

/**
 * Confiance d'une correlation : trois exigences cumulees. Un echantillon
 * suffisant, un ecart qui depasse le bruit, et une regularite du signe de
 * l'ecart (test de signe). Un gros ecart porte par un seul contenu
 * exceptionnel ne devient jamais une certitude.
 */
export function correlationConfidence({ sampleSize, deltaPct, shareAbove }) {
  const magnitude = Math.abs(deltaPct);
  const consistency = Math.abs(shareAbove - 0.5) * 2;
  if (sampleSize < MIN_CORRELATION_SAMPLE || magnitude < MIN_CORRELATION_DELTA_PCT) return CONFIDENCE.NONE;
  if (sampleSize >= 8 && magnitude >= 25 && consistency >= 0.5) return CONFIDENCE.HIGH;
  if (sampleSize >= 5 && magnitude >= 20 && consistency >= 0.4) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

/* ------------------------------------------------------------------ */
/* Construction de la memoire                                          */
/* ------------------------------------------------------------------ */

function statsFor(values, baseline) {
  const clean = values.filter((v) => v !== null && Number.isFinite(v));
  if (!clean.length) {
    return { sample_size: 0, median: null, baseline: round2(baseline), delta_pct: null, share_above_baseline: null, confidence: CONFIDENCE.NONE };
  }
  const groupMedian = median(clean);
  const usable = baseline !== null && Number.isFinite(baseline) && baseline !== 0;
  // Ex aequo comptes pour moitie : un groupe rigoureusement egal a sa
  // reference ne doit pas paraitre systematiquement en dessous.
  const shareAbove = usable
    ? (clean.filter((v) => v > baseline).length + clean.filter((v) => v === baseline).length / 2) / clean.length
    : null;
  const deltaPct = usable ? ((groupMedian - baseline) / baseline) * 100 : null;
  const confidence = deltaPct === null || shareAbove === null
    ? CONFIDENCE.NONE
    : correlationConfidence({ sampleSize: clean.length, deltaPct, shareAbove });
  return {
    sample_size: clean.length,
    median: round2(groupMedian),
    baseline: round2(baseline),
    delta_pct: round2(deltaPct),
    share_above_baseline: round2(shareAbove),
    confidence,
  };
}

/**
 * Construit la memoire a partir des enregistrements bruts.
 * `options.scores` accepte une table `instagram_media_id -> score` produite par
 * le moteur de score : la memoire ne calcule jamais de score elle-meme.
 */
export function buildContentMemory(records, options = {}) {
  const windowDays = Number(options.windowDays) > 0 ? Number(options.windowDays) : DEFAULT_MEMORY_WINDOW_DAYS;
  const now = Number(options.now) || Date.now();
  const floor = now - windowDays * DAY_MS;
  const scores = options.scores instanceof Map
    ? options.scores
    : new Map(Object.entries(options.scores || {}));

  const inWindow = (Array.isArray(records) ? records : [])
    .filter((row) => {
      const published = Date.parse(row?.published_at || '');
      return Number.isFinite(published) && published >= floor && published <= now;
    })
    .map((row) => ({ ...row, sowhat_score: metric(scores.get(row.instagram_media_id)) }))
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));

  // Les references sont conservees brutes pour tous les calculs. Elles ne sont
  // arrondies qu au moment d etre exposees.
  const rawBaselines = {};
  const baselines = {};
  for (const spec of TRACKED_METRICS) {
    const values = inWindow.map(spec.read).filter((v) => v !== null);
    const value = median(values);
    rawBaselines[spec.key] = value;
    baselines[spec.key] = { median: round2(value), sample_size: values.length };
  }

  const dimensions = {};
  const unlabeled = {};
  for (const dimension of DIMENSIONS) {
    const groups = new Map();
    let missing = 0;
    for (const record of inWindow) {
      const raw = dimensionsOf(record)[dimension];
      if (raw === null || raw === undefined) { missing += 1; continue; }
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(record);
      }
    }
    unlabeled[dimension] = missing;

    const entries = [...groups.entries()]
      .sort((a, b) => (b[1].length - a[1].length) || String(a[0]).localeCompare(String(b[0])))
      .slice(0, MAX_VALUES_PER_DIMENSION);

    dimensions[dimension] = { unlabeled_count: missing, values: {} };
    for (const [value, rows] of entries) {
      const metrics = {};
      for (const spec of TRACKED_METRICS) {
        metrics[spec.key] = statsFor(rows.map(spec.read), rawBaselines[spec.key]);
      }
      dimensions[dimension].values[value] = {
        sample_size: rows.length,
        first_seen: rows[0]?.published_at || null,
        last_seen: rows[rows.length - 1]?.published_at || null,
        metrics,
      };
    }
  }

  const memory = {
    version: MEMORY_V5_VERSION,
    built_at: new Date(now).toISOString(),
    comparison_window: {
      days: windowDays,
      start: new Date(floor).toISOString(),
      end: new Date(now).toISOString(),
    },
    corpus: {
      total_records: Array.isArray(records) ? records.length : 0,
      in_window: inWindow.length,
      with_reach: inWindow.filter((r) => metric(r.reach) !== null).length,
      with_engagement: inWindow.filter((r) => metric(r.engagement_rate) !== null).length,
      with_score: inWindow.filter((r) => metric(r.sowhat_score) !== null).length,
    },
    baselines,
    dimensions,
    unlabeled,
  };

  memory.observations = buildObservations(memory);
  memory.correlations = buildCorrelations(memory);
  return memory;
}

/* ------------------------------------------------------------------ */
/* Observations : des faits, rien d autre                              */
/* ------------------------------------------------------------------ */

export function buildObservations(memory) {
  const out = [];
  for (const dimension of DIMENSIONS) {
    const bucket = memory.dimensions?.[dimension];
    if (!bucket) continue;
    for (const [value, entry] of Object.entries(bucket.values)) {
      for (const spec of TRACKED_METRICS) {
        const stats = entry.metrics[spec.key];
        if (!stats || stats.sample_size === 0 || stats.median === null) continue;
        out.push({
          kind: INSIGHT_KIND.OBSERVATION,
          dimension,
          value,
          metric: spec.key,
          sample_size: stats.sample_size,
          median: stats.median,
          comparison_window: memory.comparison_window,
          statement: `${stats.sample_size} contenu(s) ${dimension} = ${value} : ${spec.label} mediane ${stats.median}.`,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Correlations : un ecart, jamais une certitude                       */
/* ------------------------------------------------------------------ */

const HEDGE = {
  [CONFIDENCE.LOW]: 'signal faible, a confirmer',
  [CONFIDENCE.MEDIUM]: 'signal moyen',
  [CONFIDENCE.HIGH]: 'signal solide sur cette fenetre',
};

export function buildCorrelations(memory) {
  const out = [];
  for (const dimension of DIMENSIONS) {
    const bucket = memory.dimensions?.[dimension];
    if (!bucket) continue;
    for (const [value, entry] of Object.entries(bucket.values)) {
      for (const spec of TRACKED_METRICS) {
        const stats = entry.metrics[spec.key];
        if (!stats || stats.confidence === CONFIDENCE.NONE) continue;
        const direction = stats.delta_pct >= 0 ? 'superieure' : 'inferieure';
        out.push({
          kind: INSIGHT_KIND.CORRELATION,
          dimension,
          value,
          metric: spec.key,
          sample_size: stats.sample_size,
          median: stats.median,
          baseline: stats.baseline,
          delta_pct: stats.delta_pct,
          share_above_baseline: stats.share_above_baseline,
          confidence: stats.confidence,
          comparison_window: memory.comparison_window,
          statement: `Sur ${stats.sample_size} contenu(s) ou ${dimension} = ${value}, la ${spec.label} mediane est ${direction} de ${Math.abs(stats.delta_pct)} % a la reference (${stats.baseline}). ${HEDGE[stats.confidence]}.`,
          caveat: 'Correlation observee sur la fenetre, pas une relation de cause a effet.',
        });
      }
    }
  }
  const order = { [CONFIDENCE.HIGH]: 3, [CONFIDENCE.MEDIUM]: 2, [CONFIDENCE.LOW]: 1 };
  return out.sort((a, b) => (order[b.confidence] - order[a.confidence])
    || (Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
    || String(a.dimension + a.value + a.metric).localeCompare(String(b.dimension + b.value + b.metric)));
}

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

export async function readContentMemory(env) {
  if (!env?.VISUALS_BUCKET) return null;
  try {
    const object = await env.VISUALS_BUCKET.get(MEMORY_V5_KEY);
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

export async function writeContentMemory(env, memory) {
  if (!env?.VISUALS_BUCKET) return;
  await env.VISUALS_BUCKET.put(MEMORY_V5_KEY, JSON.stringify(memory), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}
