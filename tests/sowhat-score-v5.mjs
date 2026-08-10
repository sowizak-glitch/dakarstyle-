/**
 * SOWHAT Control V5 - Tests du Score Sowhat.
 * Fonctions pures : aucun reseau, aucune horloge reelle, resultats reproductibles.
 */

import assert from 'node:assert/strict';
import {
  MIN_COHORT_SIZE,
  MIN_GROWTH_POINTS,
  MIN_REGULARITY_SAMPLE,
  SUBSCORE_STATUS,
  SUBSCORE_WEIGHTS,
  aggregate,
  buildCohort,
  confidenceFrom,
  median,
  metric,
  percentileRank,
  scoreAll,
  scoreGrowth,
  scoreMedia,
  scoreRegularity,
} from '../src/sowhat-score-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const T0 = Date.parse('2026-06-01T12:00:00.000Z');
const DAY = 86400000;

function media(overrides = {}) {
  return {
    instagram_media_id: overrides.id || 'M1',
    format: 'REEL',
    published_at: new Date(T0).toISOString(),
    caption: 'test',
    reach: 1000,
    views: null,
    likes: 50,
    comments: 5,
    shares: 10,
    saves: 20,
    interactions: 65,
    engagement_rate: 0.065,
    ...overrides,
  };
}

function cohortOf(n, reachStart, options = {}) {
  return Array.from({ length: n }, (_, i) => media({
    id: `C${i}`,
    published_at: new Date(T0 - (i + 1) * DAY).toISOString(),
    reach: reachStart + i * 100,
    engagement_rate: 0.05,
    saves: 10,
    shares: 5,
    ...options,
  }));
}

function sub(result, key) {
  return result.subscores.find((s) => s.key === key);
}

/* ---------------- Outils : jamais de zero invente ---------------- */

test('metric : absence reste absence, zero reste zero', () => {
  assert.equal(metric(null), null);
  assert.equal(metric(undefined), null);
  assert.equal(metric(''), null);
  assert.equal(metric(true), null);
  assert.equal(metric('abc'), null);
  assert.equal(metric(0), 0, 'zero est une mesure, pas une absence');
  assert.equal(metric('42'), 42);
});

test('median ignore les absences sans les compter comme zero', () => {
  assert.equal(median([null, 10, null, 20]), 15);
  assert.equal(median([]), null);
  assert.equal(median([null, null]), null);
});

test('percentileRank : rang moyen, ex aequo comptes pour moitie', () => {
  assert.equal(percentileRank(10, [0, 5, 20, 30]), 50);
  assert.equal(percentileRank(10, [10, 10]), 50);
  assert.equal(percentileRank(100, [1, 2, 3]), 100);
  assert.equal(percentileRank(0, [1, 2, 3]), 0);
  assert.equal(percentileRank(null, [1, 2, 3]), null);
  assert.equal(percentileRank(5, []), null);
});

/* ---------------- Cohorte ---------------- */

test('cohorte : meme format, meme fenetre, sans le media lui-meme', () => {
  const target = media({ id: 'TARGET' });
  const records = [
    target,
    media({ id: 'SAME', published_at: new Date(T0 - 10 * DAY).toISOString() }),
    media({ id: 'AUTRE_FORMAT', format: 'IMAGE', published_at: new Date(T0 - 10 * DAY).toISOString() }),
    media({ id: 'TROP_VIEUX', published_at: new Date(T0 - 200 * DAY).toISOString() }),
    media({ id: 'FUTUR', published_at: new Date(T0 + 5 * DAY).toISOString() }),
  ];
  const cohort = buildCohort(target, records);
  assert.deepEqual(cohort.members.map((m) => m.instagram_media_id), ['SAME']);
  assert.equal(cohort.size, 1);
  assert.equal(cohort.window_days, 90);
});

/* ---------------- Regle centrale : null n est jamais zero ---------------- */

test('portee absente : sous-score indisponible, jamais zero', () => {
  const target = media({ reach: null, engagement_rate: null });
  const result = scoreMedia(target, { records: [target, ...cohortOf(5, 800)], now: T0 });
  const reach = sub(result, 'reach');
  assert.equal(reach.status, SUBSCORE_STATUS.NOT_AVAILABLE);
  assert.equal(reach.value, null, 'une portee inconnue ne vaut pas 0');
  assert.ok(reach.explanation.includes('portee non fournie'));
});

test('portee reellement nulle : mesuree, donc notee', () => {
  const target = media({ reach: 0, engagement_rate: null, saves: null, shares: null });
  const result = scoreMedia(target, { records: [target, ...cohortOf(5, 800)], now: T0 });
  const reach = sub(result, 'reach');
  assert.equal(reach.status, SUBSCORE_STATUS.SCORED);
  assert.equal(reach.value, 0, 'une portee mesuree a zero est le plus mauvais rang, pas une absence');
  assert.equal(reach.sample_size, 5);
});

test('cohorte trop petite : echantillon insuffisant, pas de score fabrique', () => {
  const target = media();
  const result = scoreMedia(target, { records: [target, ...cohortOf(MIN_COHORT_SIZE - 1, 900)], now: T0 });
  for (const key of ['reach', 'engagement', 'saves_shares', 'relative_performance']) {
    const s = sub(result, key);
    assert.equal(s.status, SUBSCORE_STATUS.INSUFFICIENT_SAMPLE, key);
    assert.equal(s.value, null, key);
    assert.equal(s.sample_size, MIN_COHORT_SIZE - 1, key);
  }
});

test('saves ou shares manquants : aucun taux partiel compare a un taux complet', () => {
  const target = media({ shares: null });
  const result = scoreMedia(target, { records: [target, ...cohortOf(6, 900)], now: T0 });
  const s = sub(result, 'saves_shares');
  assert.equal(s.status, SUBSCORE_STATUS.NOT_AVAILABLE);
  assert.equal(s.value, null);
});

/* ---------------- Sous-scores ---------------- */

test('portee : rang centile explicable et taille d echantillon exposee', () => {
  const target = media({ reach: 2000 });
  const cohort = cohortOf(5, 500); // 500,600,700,800,900
  const result = scoreMedia(target, { records: [target, ...cohort], now: T0 });
  const reach = sub(result, 'reach');
  assert.equal(reach.status, SUBSCORE_STATUS.SCORED);
  assert.equal(reach.value, 100, 'meilleure portee de la cohorte');
  assert.equal(reach.sample_size, 5);
  assert.equal(reach.evidence.cohort_median, 700);
  assert.ok(reach.explanation.includes('5'));
});

test('performance relative : 50 = mediane, 100 = double de la mediane', () => {
  const cohort = cohortOf(5, 500); // mediane 700
  const atMedian = media({ reach: 700 });
  const double = media({ reach: 1400 });
  const half = media({ reach: 350 });
  const ctx = { now: T0 };
  assert.equal(sub(scoreMedia(atMedian, { ...ctx, records: [atMedian, ...cohort] }), 'relative_performance').value, 50);
  assert.equal(sub(scoreMedia(double, { ...ctx, records: [double, ...cohort] }), 'relative_performance').value, 100);
  assert.equal(sub(scoreMedia(half, { ...ctx, records: [half, ...cohort] }), 'relative_performance').value, 25);
  const evidence = sub(scoreMedia(double, { ...ctx, records: [double, ...cohort] }), 'relative_performance').evidence;
  assert.equal(evidence.delta_pct, 100);
});

test('retention video : indisponible sans metrique, jamais deduite des vues', () => {
  const target = media({ views: 5000 });
  const result = scoreMedia(target, { records: [target, ...cohortOf(6, 900)], now: T0 });
  const s = sub(result, 'video_retention');
  assert.equal(s.status, SUBSCORE_STATUS.NOT_AVAILABLE);
  assert.equal(s.value, null);
  assert.ok(s.explanation.includes('non fournie'));
});

test('retention video : calculee quand l API fournit reellement la duree vue', () => {
  const withRetention = (id, watched) => media({
    id, avg_watch_time_ms: watched, video_duration_ms: 10000,
    published_at: new Date(T0 - (Number(id.slice(1)) + 1) * DAY).toISOString(),
  });
  const target = media({ avg_watch_time_ms: 9000, video_duration_ms: 10000 });
  const cohort = [withRetention('C0', 2000), withRetention('C1', 3000), withRetention('C2', 4000)];
  const result = scoreMedia(target, { records: [target, ...cohort], now: T0 });
  const s = sub(result, 'video_retention');
  assert.equal(s.status, SUBSCORE_STATUS.SCORED);
  assert.equal(s.value, 100);
  assert.equal(s.sample_size, 3);
});

test('retention video : mode degrade assume quand la duree totale manque', () => {
  const withWatch = (id, watched, offset) => media({
    id, avg_watch_time_ms: watched,
    published_at: new Date(T0 - offset * DAY).toISOString(),
  });
  const target = media({ avg_watch_time_ms: 9000 });
  const cohort = [withWatch('C0', 2000, 1), withWatch('C1', 3000, 2), withWatch('C2', 4000, 3)];
  const s = sub(scoreMedia(target, { records: [target, ...cohort], now: T0 }), 'video_retention');
  assert.equal(s.status, SUBSCORE_STATUS.SCORED);
  assert.equal(s.value, 100);
  assert.equal(s.evidence.mode, 'watch_time_only');
  assert.ok(s.explanation.includes('non calculable'), 'la limite doit etre dite, pas masquee');
});

test('retention video : sans objet sur un format non video', () => {
  const target = media({ format: 'IMAGE' });
  const result = scoreMedia(target, { records: [target], now: T0 });
  const s = sub(result, 'video_retention');
  assert.equal(s.status, SUBSCORE_STATUS.NOT_AVAILABLE);
  assert.ok(s.explanation.includes('non video'));
});

test('croissance : un seul releve ne dit rien', () => {
  const s = scoreGrowth([{ at: new Date(T0).toISOString(), followers_count: 1000 }], { now: T0 });
  assert.equal(s.status, SUBSCORE_STATUS.INSUFFICIENT_SAMPLE);
  assert.equal(s.value, null);
  assert.equal(s.sample_size, 1);
  assert.ok(s.explanation.includes(String(MIN_GROWTH_POINTS)));
});

test('croissance : mesuree sur une serie, stable = 50', () => {
  const history = [
    { at: new Date(T0 - 30 * DAY).toISOString(), followers_count: 1000 },
    { at: new Date(T0).toISOString(), followers_count: 1000 },
  ];
  const s = scoreGrowth(history, { now: T0 });
  assert.equal(s.status, SUBSCORE_STATUS.SCORED);
  assert.equal(s.value, 50);
  assert.equal(s.evidence.monthly_pct, 0);
});

test('croissance : +5 %/mois plafonne a 100, -5 %/mois plancher a 0', () => {
  const up = scoreGrowth([
    { at: new Date(T0 - 30 * DAY).toISOString(), followers_count: 1000 },
    { at: new Date(T0).toISOString(), followers_count: 1050 },
  ], { now: T0 });
  assert.equal(up.value, 100);
  const down = scoreGrowth([
    { at: new Date(T0 - 30 * DAY).toISOString(), followers_count: 1000 },
    { at: new Date(T0).toISOString(), followers_count: 950 },
  ], { now: T0 });
  assert.equal(down.value, 0);
  assert.equal(down.evidence.growth_pct, -5);
});

test('regularite : moins de 4 publications = non mesurable', () => {
  const records = cohortOf(MIN_REGULARITY_SAMPLE - 1, 500);
  const s = scoreRegularity(records, { now: T0 });
  assert.equal(s.status, SUBSCORE_STATUS.INSUFFICIENT_SAMPLE);
  assert.equal(s.value, null);
});

test('regularite : rythme parfait = 100, rythme erratique nettement plus bas', () => {
  const regular = [1, 2, 3, 4, 5].map((i) => media({ id: `R${i}`, published_at: new Date(T0 - i * 2 * DAY).toISOString() }));
  const perfect = scoreRegularity(regular, { now: T0 });
  assert.equal(perfect.status, SUBSCORE_STATUS.SCORED);
  assert.equal(perfect.value, 100);

  const erratic = [1, 2, 3, 25].map((i) => media({ id: `E${i}`, published_at: new Date(T0 - i * DAY).toISOString() }));
  const messy = scoreRegularity(erratic, { now: T0 });
  assert.equal(messy.status, SUBSCORE_STATUS.SCORED);
  assert.ok(messy.value < perfect.value, 'un rythme erratique doit etre moins bien note');
});

/* ---------------- Agregation ---------------- */

test('agregation : les sous-scores absents sortent du denominateur, jamais comptes zero', () => {
  const scored = [
    { key: 'reach', weight: SUBSCORE_WEIGHTS.reach, status: SUBSCORE_STATUS.SCORED, value: 80, sample_size: 10 },
    { key: 'engagement', weight: SUBSCORE_WEIGHTS.engagement, status: SUBSCORE_STATUS.SCORED, value: 60, sample_size: 10 },
    { key: 'growth', weight: SUBSCORE_WEIGHTS.growth, status: SUBSCORE_STATUS.NOT_AVAILABLE, value: null, sample_size: 0 },
  ];
  const out = aggregate(scored);
  assert.equal(out.score, 70, 'moyenne des seuls sous-scores disponibles');
  assert.equal(out.scored_subscores, 2);
  assert.ok(out.coverage < 1);
});

test('agregation : aucun sous-score calculable = score null, pas zero', () => {
  const out = aggregate([
    { key: 'reach', weight: 0.2, status: SUBSCORE_STATUS.NOT_AVAILABLE, value: null, sample_size: 0 },
    { key: 'growth', weight: 0.1, status: SUBSCORE_STATUS.INSUFFICIENT_SAMPLE, value: null, sample_size: 1 },
  ]);
  assert.equal(out.score, null);
  assert.equal(out.status, 'not_available');
  assert.equal(out.confidence, 'none');
});

test('confiance : derivee de la couverture et du plus petit echantillon', () => {
  assert.equal(confidenceFrom(0.8, 10), 'high');
  assert.equal(confidenceFrom(0.8, 5), 'medium');
  assert.equal(confidenceFrom(0.6, 6), 'medium');
  assert.equal(confidenceFrom(0.3, 20), 'low');
  assert.equal(confidenceFrom(0, 0), 'none');
});

/* ---------------- Determinisme et explicabilite ---------------- */

test('deterministe : deux executions identiques donnent le meme score', () => {
  const target = media();
  const records = [target, ...cohortOf(8, 400)];
  const a = scoreMedia(target, { records, now: T0 });
  const b = scoreMedia(target, { records, now: T0 });
  assert.deepEqual(a, b);
});

test('chaque sous-score porte une explication et une taille d echantillon', () => {
  const target = media();
  const result = scoreMedia(target, { records: [target, ...cohortOf(8, 400)], now: T0 });
  assert.equal(result.subscores.length, 7);
  for (const s of result.subscores) {
    assert.ok(typeof s.explanation === 'string' && s.explanation.length > 0, `${s.key} sans explication`);
    assert.ok(Number.isInteger(s.sample_size), `${s.key} sans taille d echantillon`);
    assert.ok(Object.values(SUBSCORE_STATUS).includes(s.status), `${s.key} statut inconnu`);
    if (s.status !== SUBSCORE_STATUS.SCORED) assert.equal(s.value, null, `${s.key} : un sous-score non calcule doit valoir null`);
  }
  assert.ok(result.cohort.window_days > 0);
  assert.ok(result.cohort.window_start < result.cohort.window_end);
});

test('corpus vide : score null, aucune invention', () => {
  const result = scoreMedia(media(), { records: [], now: T0 });
  assert.equal(result.score, null);
  assert.equal(result.status, 'not_available');
  assert.equal(result.cohort.size, 0);
});

test('scoreAll : un score par media, cohortes calculees sur le corpus complet', () => {
  const records = cohortOf(6, 500);
  const all = scoreAll(records, { now: T0 });
  assert.equal(all.length, 6);
  assert.ok(all.every((r) => r.instagram_media_id));
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const item of cases) {
  try {
    await item.fn();
    console.log(`  PASS  ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL  ${item.name}\n        ${error.message}`);
  }
}
console.log(`\nSOWHAT V5 score: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
