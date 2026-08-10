/**
 * SOWHAT Control V5 - Tests du Coach analytique.
 * Le Coach ne calcule rien : il cite. Ces tests verifient qu il ne peut pas
 * inventer un chiffre, ni transformer un signal faible en certitude.
 */

import assert from 'node:assert/strict';
import { CONFIDENCE, INSIGHT_KIND, buildContentMemory } from '../src/content-memory-v5.js';
import {
  MAX_RECOMMENDATIONS, RECOMMENDATION_MODE, buildCoachBriefing, insufficientDataBriefing,
} from '../src/coach-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const NOW = Date.parse('2026-06-30T12:00:00.000Z');
const DAY = 86400000;

function rec(id, overrides = {}) {
  return {
    instagram_media_id: id,
    media_type: 'VIDEO',
    format: 'REEL',
    published_at: new Date(NOW - 10 * DAY).toISOString(),
    caption: 'Une legende ordinaire pour un contenu ordinaire.',
    hook: 'Une legende ordinaire',
    reach: 1000, likes: 40, comments: 5, shares: 5, saves: 10,
    interactions: 50, engagement_rate: 0.05,
    product: null, collection: null, campaign: null, cta: null,
    ...overrides,
  };
}

/** Corpus ou une collection surperforme nettement et regulierement. */
function strongMemory() {
  const strong = Array.from({ length: 10 }, (_, i) => rec(`H${i}`, {
    collection: 'bazin',
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 3000 + i * 10,
  }));
  const base = Array.from({ length: 10 }, (_, i) => rec(`L${i}`, {
    published_at: new Date(NOW - (i + 20) * DAY).toISOString(),
    reach: 1000 + i * 10,
  }));
  return buildContentMemory([...strong, ...base], { now: NOW });
}

/* ---------------- Contenu obligatoire d une recommandation ---------------- */

test('chaque recommandation porte les sept elements exiges', () => {
  const briefing = buildCoachBriefing(strongMemory());
  assert.equal(briefing.status, 'ok');
  assert.ok(briefing.recommendations.length > 0);
  for (const reco of briefing.recommendations) {
    assert.equal(reco.kind, INSIGHT_KIND.RECOMMENDATION);
    assert.ok(typeof reco.conclusion === 'string' && reco.conclusion.length > 0, 'conclusion');
    assert.ok(Array.isArray(reco.evidence) && reco.evidence.length > 0, 'preuves');
    assert.ok(reco.metrics && reco.metrics.baseline !== undefined, 'metriques');
    assert.ok(Number.isInteger(reco.sample_size) && reco.sample_size > 0, 'sample_size');
    assert.ok(Object.values(CONFIDENCE).includes(reco.confidence), 'confidence');
    assert.ok(typeof reco.next_action === 'string' && reco.next_action.length > 0, 'prochaine action');
    assert.ok(Array.isArray(reco.limits) && reco.limits.length > 0, 'limites');
  }
});

test('les chiffres cites proviennent des donnees, jamais du Coach', () => {
  const memory = strongMemory();
  const briefing = buildCoachBriefing(memory);
  const reco = briefing.recommendations.find((r) => r.dimension === 'collection' && r.value === 'bazin');
  assert.ok(reco);
  const source = memory.correlations.find((c) => c.dimension === 'collection' && c.value === 'bazin' && c.metric === reco.metric);
  assert.equal(reco.metrics.delta_pct, source.delta_pct);
  assert.equal(reco.metrics.baseline, source.baseline);
  assert.equal(reco.metrics.group_median, source.median);
  assert.equal(reco.sample_size, source.sample_size);
  assert.ok(reco.conclusion.includes(String(Math.abs(source.delta_pct))), 'le chiffre cite est celui mesure');
});

test('toute limite mentionne la fenetre, l echantillon et l absence de causalite', () => {
  const briefing = buildCoachBriefing(strongMemory());
  const reco = briefing.recommendations[0];
  const joined = reco.limits.join(' | ');
  assert.ok(/cause a effet/.test(joined));
  assert.ok(/fenetre de \d+ jours/.test(joined));
  assert.ok(/\d+ contenu\(s\) comparable/.test(joined));
});

/* ---------------- Un signal faible reste un signal faible ---------------- */

test('correlation faible : mode tester, jamais un ordre', () => {
  const correlation = {
    kind: INSIGHT_KIND.CORRELATION, dimension: 'cta', value: 'whatsapp', metric: 'reach',
    sample_size: 3, median: 1200, baseline: 1000, delta_pct: 20, share_above_baseline: 0.67,
    confidence: CONFIDENCE.LOW, comparison_window: { days: 90, start: '2026-04-01T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
    statement: 'enonce mesure', caveat: 'correlation',
  };
  const memory = { corpus: { in_window: 6, with_reach: 6 }, comparison_window: correlation.comparison_window, correlations: [correlation], observations: [] };
  const briefing = buildCoachBriefing(memory);
  const reco = briefing.recommendations[0];
  assert.equal(reco.mode, RECOMMENDATION_MODE.EXPERIMENT);
  assert.ok(/piste a tester/i.test(reco.conclusion));
  assert.ok(reco.limits.some((l) => /hypothese a tester/.test(l)));
});

test('correlation solide : mode appliquer, action concrete', () => {
  const briefing = buildCoachBriefing(strongMemory());
  const strong = briefing.recommendations.find((r) => r.confidence === CONFIDENCE.HIGH);
  assert.ok(strong, 'un signal solide doit exister dans ce corpus');
  assert.equal(strong.mode, RECOMMENDATION_MODE.APPLY);
  assert.ok(!/piste a tester/i.test(strong.conclusion));
});

test('une seule recommandation par couple dimension/valeur', () => {
  const briefing = buildCoachBriefing(strongMemory());
  const keys = briefing.recommendations.map((r) => `${r.dimension}:${r.value}`);
  assert.equal(new Set(keys).size, keys.length, 'la meme observation ne doit pas etre repetee sous plusieurs metriques');
});

test('les recommandations sont bornees et triees par solidite', () => {
  const briefing = buildCoachBriefing(strongMemory(), { limit: 3 });
  assert.ok(briefing.recommendations.length <= 3);
  const order = { high: 3, medium: 2, low: 1 };
  const values = briefing.recommendations.map((r) => order[r.confidence]);
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
  assert.equal(MAX_RECOMMENDATIONS, 6);
});

/* ---------------- Repli : ne jamais meubler ---------------- */

test('aucune donnee : repli explicite, zero recommandation, zero chiffre invente', () => {
  const memory = buildContentMemory([], { now: NOW });
  const briefing = buildCoachBriefing(memory);
  assert.equal(briefing.status, 'insufficient_data');
  assert.deepEqual(briefing.recommendations, []);
  assert.ok(briefing.reasons.length > 0);
  assert.ok(briefing.next_actions.length > 0);
  assert.ok(briefing.limits.some((l) => /extrapol/.test(l)));
});

test('memoire absente : repli, pas d exception', () => {
  const briefing = buildCoachBriefing(null);
  assert.equal(briefing.status, 'insufficient_data');
  assert.deepEqual(briefing.recommendations, []);
});

test('donnees presentes mais aucun ecart significatif : repli honnete', () => {
  const flat = Array.from({ length: 10 }, (_, i) => rec(`F${i}`, {
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 1000,
  }));
  const briefing = buildCoachBriefing(buildContentMemory(flat, { now: NOW }));
  assert.equal(briefing.status, 'insufficient_data');
  assert.ok(briefing.next_actions.some((a) => /bruit statistique|Publier/.test(a)));
});

test('repli : signale les insights manquants et les dimensions non annotees', () => {
  const partial = [
    ...Array.from({ length: 4 }, (_, i) => rec(`P${i}`, {
      published_at: new Date(NOW - (i + 1) * DAY).toISOString(), reach: null, engagement_rate: null,
    })),
  ];
  const memory = buildContentMemory(partial, { now: NOW });
  const briefing = insufficientDataBriefing(memory, ['test']);
  const joined = briefing.next_actions.join(' | ');
  assert.ok(/permissions Insights/.test(joined), 'les metriques manquantes doivent etre signalees');
  assert.ok(/Annoter la dimension product/.test(joined));
  assert.equal(briefing.sample.contents_with_reach, 0);
});

/* ---------------- Ancrage sur le score ---------------- */

test('le resume de score est cite tel quel, jamais recalcule', () => {
  const summary = { score: 72.5, confidence: 'medium', coverage: 0.7 };
  const briefing = buildCoachBriefing(strongMemory(), { scoreSummary: summary });
  assert.deepEqual(briefing.score_summary, summary);
  const sansScore = buildCoachBriefing(strongMemory());
  assert.equal(sansScore.score_summary, null, 'aucun score fourni = aucun score affiche');
});

test('le briefing expose son propre echantillon', () => {
  const briefing = buildCoachBriefing(strongMemory());
  assert.equal(briefing.sample.contents_in_window, 20);
  assert.equal(briefing.sample.contents_with_reach, 20);
  assert.ok(briefing.comparison_window.days > 0);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 coach: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
