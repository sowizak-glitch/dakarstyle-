/**
 * SOWHAT Control V5 - Score Sowhat
 *
 * Le score n'est pas une note d'ambiance : c'est une fonction pure,
 * deterministe et entierement explicable. Les memes entrees donnent toujours
 * la meme sortie, et chaque sous-score sait dire pourquoi il vaut ce qu'il vaut.
 *
 * Trois regles non negociables :
 *   1. une donnee absente reste absente. Jamais convertie en zero, jamais
 *      remplacee par une moyenne, jamais devinee ;
 *   2. un sous-score qui n'a pas assez de matiere ne vaut pas 0 : il vaut
 *      `null` avec un statut explicite (`not_available` ou
 *      `insufficient_sample`) et une raison lisible ;
 *   3. la taille d'echantillon et la fenetre de comparaison sont toujours
 *      exposees, parce qu'un score sans echantillon n'est pas une information.
 */

/** Statuts possibles d'un sous-score. */
export const SUBSCORE_STATUS = Object.freeze({
  SCORED: 'scored',
  NOT_AVAILABLE: 'not_available',
  INSUFFICIENT_SAMPLE: 'insufficient_sample',
});

/** Nombre minimal de contenus comparables pour oser un classement. */
export const MIN_COHORT_SIZE = 3;
/** Nombre minimal de publications pour parler de regularite. */
export const MIN_REGULARITY_SAMPLE = 4;
/** Nombre minimal de releves de followers pour parler de croissance. */
export const MIN_GROWTH_POINTS = 2;
/** Fenetre de comparaison par defaut, en jours. */
export const DEFAULT_COMPARISON_WINDOW_DAYS = 90;

export const SUBSCORE_WEIGHTS = Object.freeze({
  reach: 0.20,
  engagement: 0.20,
  saves_shares: 0.15,
  relative_performance: 0.20,
  video_retention: 0.10,
  growth: 0.075,
  regularity: 0.075,
});

const DAY_MS = 86400000;

/* ------------------------------------------------------------------ */
/* Outils numeriques : aucun ne transforme une absence en zero          */
/* ------------------------------------------------------------------ */

/** Valeur reellement mesuree, ou null. Number(null) === 0 est un piege. */
export function metric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function median(values) {
  const list = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

/**
 * Rang centile d'une valeur dans un echantillon, methode du rang moyen.
 * Deterministe et symetrique : les ex aequo comptent pour moitie.
 */
export function percentileRank(value, sample) {
  const list = sample.filter((v) => v !== null && Number.isFinite(v));
  if (!list.length || value === null || !Number.isFinite(value)) return null;
  let below = 0;
  let equal = 0;
  for (const item of list) {
    if (item < value) below += 1;
    else if (item === value) equal += 1;
  }
  return round2(((below + equal / 2) / list.length) * 100);
}

function round2(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/* Cohorte                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cohorte comparable : meme format, publie dans la meme fenetre, hors le
 * media evalue lui-meme. Comparer un Reel a une photo n'aurait aucun sens,
 * et comparer a des contenus d'il y a deux ans non plus.
 */
export function buildCohort(target, records, options = {}) {
  const windowDays = Number(options.windowDays) > 0
    ? Number(options.windowDays)
    : DEFAULT_COMPARISON_WINDOW_DAYS;
  const reference = options.now ? Number(options.now) : Date.parse(target?.published_at || '') || Date.now();
  const floor = reference - windowDays * DAY_MS;

  const members = (Array.isArray(records) ? records : []).filter((row) => {
    if (!row || row.instagram_media_id === target?.instagram_media_id) return false;
    if (row.format !== target?.format) return false;
    const published = Date.parse(row.published_at || '');
    return Number.isFinite(published) && published >= floor && published <= reference;
  });

  return {
    members,
    size: members.length,
    format: target?.format || 'UNKNOWN',
    window_days: windowDays,
    window_start: new Date(floor).toISOString(),
    window_end: new Date(reference).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Fabrique de sous-scores                                             */
/* ------------------------------------------------------------------ */

function subscore(key, label, payload) {
  return {
    key,
    label,
    weight: SUBSCORE_WEIGHTS[key],
    status: payload.status,
    value: payload.value ?? null,
    sample_size: payload.sample_size ?? 0,
    basis: payload.basis ?? null,
    explanation: payload.explanation,
    evidence: payload.evidence ?? null,
  };
}

function unavailable(key, label, reason, sampleSize = 0) {
  return subscore(key, label, {
    status: SUBSCORE_STATUS.NOT_AVAILABLE,
    value: null,
    sample_size: sampleSize,
    explanation: reason,
  });
}

function insufficient(key, label, sampleSize, required) {
  return subscore(key, label, {
    status: SUBSCORE_STATUS.INSUFFICIENT_SAMPLE,
    value: null,
    sample_size: sampleSize,
    explanation: `echantillon insuffisant : ${sampleSize} element(s) comparables, ${required} requis`,
  });
}

/* ------------------------------------------------------------------ */
/* Sous-scores                                                         */
/* ------------------------------------------------------------------ */

function scoreReach(media, cohort) {
  const key = 'reach';
  const label = 'Portee';
  const value = metric(media?.reach);
  if (value === null) return unavailable(key, label, 'portee non fournie par Meta pour ce media', cohort.size);
  const sample = cohort.members.map((row) => metric(row.reach)).filter((v) => v !== null);
  if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
  const rank = percentileRank(value, sample);
  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value: rank,
    sample_size: sample.length,
    basis: 'rang centile de la portee dans la cohorte',
    explanation: `portee de ${value} contre une mediane de ${median(sample)} sur ${sample.length} ${cohort.format} comparables`,
    evidence: { reach: value, cohort_median: median(sample) },
  });
}

function scoreEngagement(media, cohort) {
  const key = 'engagement';
  const label = 'Engagement';
  const value = metric(media?.engagement_rate);
  if (value === null) {
    return unavailable(key, label, 'taux d engagement incalculable : interactions ou portee absentes', cohort.size);
  }
  const sample = cohort.members.map((row) => metric(row.engagement_rate)).filter((v) => v !== null);
  if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
  const rank = percentileRank(value, sample);
  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value: rank,
    sample_size: sample.length,
    basis: 'rang centile du taux d engagement dans la cohorte',
    explanation: `taux d engagement de ${round2(value * 100)} % contre une mediane de ${round2(median(sample) * 100)} % sur ${sample.length} comparables`,
    evidence: { engagement_rate: value, cohort_median: median(sample) },
  });
}

/**
 * Saves et partages : signaux d'intention forte. Exiges tous les deux pour
 * eviter de comparer une somme partielle a une somme complete, ce qui
 * fabriquerait un ecart qui n'existe pas.
 */
function savesSharesRate(row) {
  const saves = metric(row?.saves);
  const shares = metric(row?.shares);
  const reach = metric(row?.reach);
  if (saves === null || shares === null || reach === null || reach === 0) return null;
  return (saves + shares) / reach;
}

function scoreSavesShares(media, cohort) {
  const key = 'saves_shares';
  const label = 'Sauvegardes et partages';
  const value = savesSharesRate(media);
  if (value === null) {
    return unavailable(key, label, 'sauvegardes, partages ou portee absents : aucun taux comparable', cohort.size);
  }
  const sample = cohort.members.map(savesSharesRate).filter((v) => v !== null);
  if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value: percentileRank(value, sample),
    sample_size: sample.length,
    basis: 'rang centile de (sauvegardes + partages) / portee',
    explanation: `${round2(value * 100)} % de la portee a sauvegarde ou partage, contre ${round2(median(sample) * 100)} % en mediane sur ${sample.length} comparables`,
    evidence: { saves: metric(media.saves), shares: metric(media.shares), rate: value, cohort_median: median(sample) },
  });
}

/**
 * Performance relative : ce n'est pas un classement mais un rapport a la
 * mediane. 50 signifie exactement la mediane, 100 signifie le double.
 */
function scoreRelativePerformance(media, cohort) {
  const key = 'relative_performance';
  const label = 'Performance relative';
  const value = metric(media?.reach);
  if (value === null) return unavailable(key, label, 'portee absente : aucun rapport a la mediane possible', cohort.size);
  const sample = cohort.members.map((row) => metric(row.reach)).filter((v) => v !== null);
  if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
  const base = median(sample);
  if (base === null || base === 0) {
    return unavailable(key, label, 'mediane de cohorte nulle ou inconnue : rapport non calculable', sample.length);
  }
  const ratio = value / base;
  const delta = round2((ratio - 1) * 100);
  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value: round2(clamp(ratio * 50, 0, 100)),
    sample_size: sample.length,
    basis: '50 = mediane de la cohorte, 100 = le double de la mediane',
    explanation: `portee ${delta >= 0 ? 'superieure' : 'inferieure'} de ${Math.abs(delta)} % a la mediane des ${sample.length} ${cohort.format} comparables`,
    evidence: { reach: value, cohort_median: base, ratio: round2(ratio), delta_pct: delta },
  });
}

/**
 * Retention video. Meta ne fournit cette metrique que pour certains formats et
 * certains comptes. Si elle n'a pas ete collectee, le sous-score le dit : il ne
 * la remplace pas par un proxy inventé a partir des vues.
 */
function retentionRatio(row) {
  const watched = metric(row?.avg_watch_time_ms);
  const duration = metric(row?.video_duration_ms);
  if (watched === null || duration === null || duration <= 0) return null;
  return clamp(watched / duration, 0, 1);
}

function watchTime(row) {
  const watched = metric(row?.avg_watch_time_ms);
  return watched === null || watched < 0 ? null : watched;
}

function scoreVideoRetention(media, cohort) {
  const key = 'video_retention';
  const label = 'Retention video';
  const isVideo = media?.format === 'REEL' || media?.format === 'VIDEO';
  if (!isVideo) return unavailable(key, label, 'format non video : la retention ne s applique pas');

  // Mode exact : part de la video reellement vue. Exige la duree totale.
  const ratio = retentionRatio(media);
  if (ratio !== null) {
    const sample = cohort.members.map(retentionRatio).filter((v) => v !== null);
    if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
    return subscore(key, label, {
      status: SUBSCORE_STATUS.SCORED,
      value: percentileRank(ratio, sample),
      sample_size: sample.length,
      basis: 'rang centile de la duree vue moyenne rapportee a la duree totale',
      explanation: `${round2(ratio * 100)} % de la video vue en moyenne, contre ${round2(median(sample) * 100)} % en mediane sur ${sample.length} videos comparables`,
      evidence: { mode: 'ratio', retention: ratio, cohort_median: median(sample) },
    });
  }

  // Mode degrade assume : Meta fournit la duree vue moyenne mais pas la duree
  // totale. On compare alors des durees vues entre elles, et on le DIT. On ne
  // fabrique jamais un pourcentage de retention a partir des vues ou de la portee.
  const watched = watchTime(media);
  if (watched === null) {
    return unavailable(key, label, 'duree de visionnage moyenne non fournie par l API pour ce media', cohort.size);
  }
  const sample = cohort.members.map(watchTime).filter((v) => v !== null);
  if (sample.length < MIN_COHORT_SIZE) return insufficient(key, label, sample.length, MIN_COHORT_SIZE);
  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value: percentileRank(watched, sample),
    sample_size: sample.length,
    basis: 'rang centile de la duree vue moyenne, la duree totale n etant pas fournie par l API',
    explanation: `duree vue moyenne de ${round2(watched / 1000)} s contre ${round2(median(sample) / 1000)} s en mediane sur ${sample.length} videos comparables ; part visionnee non calculable sans duree totale`,
    evidence: { mode: 'watch_time_only', avg_watch_time_ms: watched, cohort_median: median(sample) },
  });
}

/**
 * Croissance : mesuree sur une serie de releves d'abonnes, jamais deduite
 * d'un seul point. Un seul releve ne dit rien d'une evolution.
 */
export function scoreGrowth(history, options = {}) {
  const key = 'growth';
  const label = 'Croissance';
  const windowDays = Number(options.windowDays) > 0 ? Number(options.windowDays) : 30;
  const reference = Number(options.now) || Date.now();
  const floor = reference - windowDays * DAY_MS;

  const points = (Array.isArray(history) ? history : [])
    .map((row) => ({ at: Date.parse(row?.at || ''), followers: metric(row?.followers_count) }))
    .filter((row) => Number.isFinite(row.at) && row.followers !== null && row.at >= floor && row.at <= reference)
    .sort((a, b) => a.at - b.at);

  if (points.length < MIN_GROWTH_POINTS) {
    return subscore(key, label, {
      status: SUBSCORE_STATUS.INSUFFICIENT_SAMPLE,
      value: null,
      sample_size: points.length,
      explanation: `croissance non mesurable : ${points.length} releve(s) d abonnes sur ${windowDays} jours, ${MIN_GROWTH_POINTS} requis`,
    });
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first.followers === 0) {
    return unavailable(key, label, 'base d abonnes initiale nulle : taux de croissance non calculable', points.length);
  }
  const spanDays = Math.max(1, (last.at - first.at) / DAY_MS);
  const growthPct = ((last.followers - first.followers) / first.followers) * 100;
  const monthly = (growthPct / spanDays) * 30;
  // 0 %/mois -> 50, +5 %/mois -> 100, -5 %/mois -> 0. Bornes explicites.
  const value = round2(clamp(50 + (monthly / 5) * 50, 0, 100));

  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value,
    sample_size: points.length,
    basis: '50 = stable, 100 = +5 %/mois, 0 = -5 %/mois',
    explanation: `${first.followers} a ${last.followers} abonnes en ${round2(spanDays)} jours, soit ${round2(monthly)} %/mois`,
    evidence: {
      from: first.followers,
      to: last.followers,
      span_days: round2(spanDays),
      growth_pct: round2(growthPct),
      monthly_pct: round2(monthly),
    },
  });
}

/**
 * Regularite : stabilite du rythme de publication. Un compte qui publie tous
 * les deux jours est regulier ; un compte qui publie cinq fois puis disparait
 * trois semaines ne l'est pas, meme a volume egal.
 */
export function scoreRegularity(records, options = {}) {
  const key = 'regularity';
  const label = 'Regularite';
  const windowDays = Number(options.windowDays) > 0 ? Number(options.windowDays) : 30;
  const reference = Number(options.now) || Date.now();
  const floor = reference - windowDays * DAY_MS;

  const dates = (Array.isArray(records) ? records : [])
    .map((row) => Date.parse(row?.published_at || ''))
    .filter((value) => Number.isFinite(value) && value >= floor && value <= reference)
    .sort((a, b) => a - b);

  if (dates.length < MIN_REGULARITY_SAMPLE) {
    return subscore(key, label, {
      status: SUBSCORE_STATUS.INSUFFICIENT_SAMPLE,
      value: null,
      sample_size: dates.length,
      explanation: `regularite non mesurable : ${dates.length} publication(s) sur ${windowDays} jours, ${MIN_REGULARITY_SAMPLE} requises`,
    });
  }

  const gaps = [];
  for (let i = 1; i < dates.length; i += 1) gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
  const meanGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (meanGap === 0) {
    return unavailable(key, label, 'toutes les publications portent le meme horodatage : rythme non mesurable', dates.length);
  }
  const variance = gaps.reduce((sum, gap) => sum + (gap - meanGap) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / meanGap;
  // cv = 0 (rythme parfait) -> 100 ; cv >= 1 (rythme erratique) -> 0.
  const value = round2(clamp((1 - cv) * 100, 0, 100));

  return subscore(key, label, {
    status: SUBSCORE_STATUS.SCORED,
    value,
    sample_size: dates.length,
    basis: '100 = intervalles parfaitement reguliers, 0 = intervalles totalement erratiques',
    explanation: `${dates.length} publications sur ${windowDays} jours, intervalle median de ${round2(median(gaps))} jours, dispersion de ${round2(cv * 100)} %`,
    evidence: { publications: dates.length, mean_gap_days: round2(meanGap), median_gap_days: round2(median(gaps)), cv: round2(cv) },
  });
}

/* ------------------------------------------------------------------ */
/* Agregation                                                          */
/* ------------------------------------------------------------------ */

/** Confiance derivee de la couverture et du plus petit echantillon utilise. */
export function confidenceFrom(coverage, minSample) {
  if (coverage >= 0.75 && minSample >= 8) return 'high';
  if (coverage >= 0.5 && minSample >= 5) return 'medium';
  if (coverage > 0) return 'low';
  return 'none';
}

/**
 * Score global : moyenne ponderee des seuls sous-scores reellement calcules.
 * Les poids des sous-scores indisponibles sont retires du denominateur, ils ne
 * sont jamais comptes comme des zeros. Si rien n'est calculable, le score vaut
 * `null` : c'est un resultat honnete, pas un echec.
 */
export function aggregate(subscores) {
  const scored = subscores.filter((s) => s.status === SUBSCORE_STATUS.SCORED && s.value !== null);
  const totalWeight = subscores.reduce((sum, s) => sum + s.weight, 0);
  const usedWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  const coverage = totalWeight > 0 ? round2(usedWeight / totalWeight) : 0;

  if (!scored.length || usedWeight === 0) {
    return {
      score: null,
      status: 'not_available',
      coverage: 0,
      confidence: 'none',
      scored_subscores: 0,
      total_subscores: subscores.length,
    };
  }

  const weighted = scored.reduce((sum, s) => sum + s.value * s.weight, 0) / usedWeight;
  const minSample = scored.reduce((min, s) => Math.min(min, s.sample_size), Infinity);

  return {
    score: round2(weighted),
    status: 'scored',
    coverage,
    confidence: confidenceFrom(coverage, Number.isFinite(minSample) ? minSample : 0),
    scored_subscores: scored.length,
    total_subscores: subscores.length,
    min_sample_size: Number.isFinite(minSample) ? minSample : 0,
  };
}

/**
 * Score Sowhat V5 d'un media.
 *
 * `context` peut fournir : `records` (corpus complet), `followerHistory`
 * (releves d'abonnes), `now`, `windowDays`. Rien n'est obligatoire : ce qui
 * manque devient un sous-score explicitement indisponible, jamais un zero.
 */
export function scoreMedia(media, context = {}) {
  const records = Array.isArray(context.records) ? context.records : [];
  const cohort = buildCohort(media, records, { windowDays: context.windowDays, now: context.now });

  const publishedAt = Date.parse(media?.published_at || '');
  const reference = context.now ?? (Number.isFinite(publishedAt) ? publishedAt : Date.now());

  const subscores = [
    scoreReach(media, cohort),
    scoreEngagement(media, cohort),
    scoreSavesShares(media, cohort),
    scoreRelativePerformance(media, cohort),
    scoreVideoRetention(media, cohort),
    scoreGrowth(context.followerHistory, { now: reference, windowDays: context.growthWindowDays }),
    scoreRegularity(records, { now: reference, windowDays: context.regularityWindowDays }),
  ];

  const summary = aggregate(subscores);

  return {
    instagram_media_id: media?.instagram_media_id || null,
    format: media?.format || 'UNKNOWN',
    computed_at: new Date(reference).toISOString(),
    ...summary,
    cohort: {
      size: cohort.size,
      format: cohort.format,
      window_days: cohort.window_days,
      window_start: cohort.window_start,
      window_end: cohort.window_end,
    },
    subscores,
  };
}

/** Scores de tout un corpus, tries du plus recent au plus ancien. */
export function scoreAll(records, context = {}) {
  const list = Array.isArray(records) ? records : [];
  return list.map((media) => scoreMedia(media, { ...context, records: list }));
}
