/**
 * SOWHAT Control V5 - Tests de la Content Memory.
 * Aucun reseau : la memoire est derivee d enregistrements fournis en dur.
 */

import assert from 'node:assert/strict';
import {
  CONFIDENCE, DIMENSIONS, INSIGHT_KIND, MEMORY_V5_KEY, MIN_CORRELATION_SAMPLE,
  buildContentMemory, captionLengthBucket, correlationConfidence, detectCta,
  dimensionsOf, extractHashtags, hookType, hourSlot, readContentMemory, writeContentMemory,
} from '../src/content-memory-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v) { this.s.set(k, String(v)); }
}

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
    reach: 1000,
    likes: 40, comments: 5, shares: 5, saves: 10,
    interactions: 50,
    engagement_rate: 0.05,
    product: null, collection: null, campaign: null, cta: null,
    ...overrides,
  };
}

/* ---------------- Extraction des dimensions ---------------- */

test('creneaux horaires et longueur de legende', () => {
  assert.equal(hourSlot(20), '18-21');
  assert.equal(hourSlot(0), '00-06');
  assert.equal(hourSlot(23), '21-24');
  assert.equal(hourSlot(null), null);
  assert.equal(captionLengthBucket('court'), 'court');
  assert.equal(captionLengthBucket('x'.repeat(300)), 'moyen');
  assert.equal(captionLengthBucket('x'.repeat(900)), 'long');
  assert.equal(captionLengthBucket('   '), null, 'une legende vide n est pas une categorie');
});

test('type d accroche : categorie apprenable, absente si pas d accroche', () => {
  assert.equal(hookType('Tu connais ce tissu ?'), 'question');
  assert.equal(hookType('3 raisons de porter du bazin'), 'chiffre');
  assert.equal(hookType('Decouvre la collection'), 'imperatif');
  assert.equal(hookType('Le bazin revient cette saison'), 'declaratif');
  assert.equal(hookType(''), null);
});

test('hashtags et CTA : detectes, jamais inventes', () => {
  assert.deepEqual(extractHashtags('Style #dakar #BAZIN #dakar'), ['#dakar', '#bazin']);
  assert.deepEqual(extractHashtags('aucun tag'), []);
  assert.equal(detectCta({ caption: 'Commande via WhatsApp' }), 'whatsapp');
  assert.equal(detectCta({ caption: 'Lien en bio' }), 'lien_en_bio');
  assert.equal(detectCta({ cta: 'Promo speciale', caption: 'lien en bio' }), 'promo speciale', 'l annotation humaine prime');
  assert.equal(detectCta({ caption: 'Belle journee' }), null, 'aucun CTA detecte = aucun CTA');
});

test('dimension non renseignee : absente, jamais categorie inconnu', () => {
  const dims = dimensionsOf(rec('X', { product: null, collection: '', campaign: undefined }));
  assert.equal(dims.product, null);
  assert.equal(dims.collection, null);
  assert.equal(dims.campaign, null);
  assert.equal(dims.format, 'REEL');
});

test('toutes les dimensions demandees sont couvertes', () => {
  for (const dimension of ['media_type', 'product', 'collection', 'campaign', 'weekday', 'hour_slot', 'hook_type', 'cta', 'format', 'caption_length', 'tag']) {
    assert.ok(DIMENSIONS.includes(dimension), `dimension manquante : ${dimension}`);
  }
});

/* ---------------- Fenetre et corpus ---------------- */

test('fenetre de comparaison : hors fenetre, hors calcul', () => {
  const memory = buildContentMemory([
    rec('IN', { published_at: new Date(NOW - 5 * DAY).toISOString() }),
    rec('OUT', { published_at: new Date(NOW - 300 * DAY).toISOString() }),
  ], { now: NOW });
  assert.equal(memory.corpus.total_records, 2);
  assert.equal(memory.corpus.in_window, 1);
  assert.equal(memory.comparison_window.days, 90);
});

test('un contenu sans metrique ne fait pas baisser la reference a zero', () => {
  const memory = buildContentMemory([
    rec('A', { reach: 1000 }),
    rec('B', { reach: null, engagement_rate: null }),
    rec('C', { reach: 1000 }),
  ], { now: NOW });
  assert.equal(memory.baselines.reach.median, 1000, 'la portee absente est ignoree, pas comptee zero');
  assert.equal(memory.baselines.reach.sample_size, 2);
  assert.equal(memory.corpus.with_reach, 2);
});

test('scores fournis par le moteur, jamais recalcules par la memoire', () => {
  const memory = buildContentMemory([rec('A'), rec('B')], {
    now: NOW,
    scores: { A: 80, B: 40 },
  });
  assert.equal(memory.baselines.score.median, 60);
  assert.equal(memory.corpus.with_score, 2);
  const sansScore = buildContentMemory([rec('A')], { now: NOW });
  assert.equal(sansScore.baselines.score.median, null, 'aucun score fourni = aucun score invente');
});

/* ---------------- Separation stricte des trois niveaux ---------------- */

test('un echantillon trop petit produit une observation, jamais une correlation', () => {
  const records = [
    rec('S1', { hour_forced: true, published_at: new Date(NOW - 3 * DAY).toISOString(), reach: 5000, collection: 'capsule' }),
    rec('N1', { published_at: new Date(NOW - 4 * DAY).toISOString(), reach: 1000 }),
    rec('N2', { published_at: new Date(NOW - 5 * DAY).toISOString(), reach: 1000 }),
    rec('N3', { published_at: new Date(NOW - 6 * DAY).toISOString(), reach: 1000 }),
  ];
  const memory = buildContentMemory(records, { now: NOW });
  const capsule = memory.dimensions.collection.values.capsule;
  assert.equal(capsule.sample_size, 1);
  assert.ok(capsule.sample_size < MIN_CORRELATION_SAMPLE);
  assert.equal(capsule.metrics.reach.confidence, CONFIDENCE.NONE);
  assert.ok(
    memory.correlations.every((c) => !(c.dimension === 'collection' && c.value === 'capsule')),
    'un seul contenu ne doit jamais devenir une correlation',
  );
  assert.ok(
    memory.observations.some((o) => o.dimension === 'collection' && o.value === 'capsule'),
    'le fait reste observable',
  );
});

test('observations : des faits, sans conseil ni causalite', () => {
  const memory = buildContentMemory([rec('A'), rec('B'), rec('C')], { now: NOW });
  assert.ok(memory.observations.length > 0);
  for (const observation of memory.observations) {
    assert.equal(observation.kind, INSIGHT_KIND.OBSERVATION);
    assert.ok(Number.isInteger(observation.sample_size) && observation.sample_size > 0);
    assert.equal(observation.confidence, undefined, 'une observation n a pas de confiance : c est un fait');
    assert.ok(!/devrait|conseill|recommand/i.test(observation.statement), 'une observation ne conseille rien');
  }
});

test('correlations : ecart, echantillon, confiance et mise en garde obligatoires', () => {
  const strong = Array.from({ length: 10 }, (_, i) => rec(`H${i}`, {
    collection: 'bazin',
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 3000 + i * 10,
  }));
  const base = Array.from({ length: 10 }, (_, i) => rec(`L${i}`, {
    published_at: new Date(NOW - (i + 20) * DAY).toISOString(),
    reach: 1000 + i * 10,
  }));
  const memory = buildContentMemory([...strong, ...base], { now: NOW });
  const found = memory.correlations.find((c) => c.dimension === 'collection' && c.value === 'bazin' && c.metric === 'reach');
  assert.ok(found, 'un ecart net et regulier doit produire une correlation');
  assert.equal(found.kind, INSIGHT_KIND.CORRELATION);
  assert.equal(found.confidence, CONFIDENCE.HIGH);
  assert.equal(found.sample_size, 10);
  assert.ok(found.delta_pct > 0);
  assert.ok(found.baseline !== null && found.median !== null);
  assert.ok(found.comparison_window.days > 0);
  assert.ok(found.caveat.includes('cause a effet'), 'toute correlation doit porter sa mise en garde');
});

test('une correlation faible est formulee comme faible, jamais comme une certitude', () => {
  const result = correlationConfidence({ sampleSize: 3, deltaPct: 18, shareAbove: 0.66 });
  assert.equal(result, CONFIDENCE.LOW);
  const memory = buildContentMemory([
    rec('A', { collection: 'test', reach: 1200, published_at: new Date(NOW - 1 * DAY).toISOString() }),
    rec('B', { collection: 'test', reach: 1250, published_at: new Date(NOW - 2 * DAY).toISOString() }),
    rec('C', { collection: 'test', reach: 1180, published_at: new Date(NOW - 3 * DAY).toISOString() }),
    rec('D', { reach: 1000, published_at: new Date(NOW - 4 * DAY).toISOString() }),
    rec('E', { reach: 950, published_at: new Date(NOW - 5 * DAY).toISOString() }),
    rec('F', { reach: 1000, published_at: new Date(NOW - 6 * DAY).toISOString() }),
  ], { now: NOW });
  const weak = memory.correlations.find((c) => c.dimension === 'collection' && c.value === 'test' && c.metric === 'reach');
  if (weak) {
    assert.notEqual(weak.confidence, CONFIDENCE.HIGH);
    assert.ok(/faible|moyen/.test(weak.statement), `formulation trop affirmative : ${weak.statement}`);
  }
});

test('confiance : un gros ecart porte par un seul contenu ne devient pas une certitude', () => {
  assert.equal(correlationConfidence({ sampleSize: 2, deltaPct: 500, shareAbove: 1 }), CONFIDENCE.NONE);
  assert.equal(correlationConfidence({ sampleSize: 12, deltaPct: 5, shareAbove: 0.9 }), CONFIDENCE.NONE, 'un ecart sous le bruit ne se signale pas');
  assert.equal(correlationConfidence({ sampleSize: 10, deltaPct: 40, shareAbove: 0.55 }), CONFIDENCE.LOW, 'ecart fort mais irregulier : confiance faible');
  assert.equal(correlationConfidence({ sampleSize: 10, deltaPct: 40, shareAbove: 0.9 }), CONFIDENCE.HIGH);
});

test('la memoire ne produit jamais de recommandation : c est le role du Coach', () => {
  const memory = buildContentMemory(Array.from({ length: 12 }, (_, i) => rec(`M${i}`, {
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 1000 + i * 200,
  })), { now: NOW });
  const kinds = new Set([...memory.observations, ...memory.correlations].map((i) => i.kind));
  assert.ok(!kinds.has(INSIGHT_KIND.RECOMMENDATION));
  assert.deepEqual([...kinds].sort(), [INSIGHT_KIND.CORRELATION, INSIGHT_KIND.OBSERVATION].filter((k) => kinds.has(k)).sort());
});

/* ---------------- Champs obligatoires et persistance ---------------- */

test('chaque valeur de dimension stocke echantillon, reference, delta et fenetre', () => {
  const memory = buildContentMemory(Array.from({ length: 6 }, (_, i) => rec(`R${i}`, {
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 900 + i * 100,
  })), { now: NOW });
  const entry = memory.dimensions.format.values.REEL;
  assert.equal(entry.sample_size, 6);
  assert.ok(entry.first_seen && entry.last_seen);
  for (const key of ['reach', 'engagement_rate', 'saves_shares_rate', 'score']) {
    const stats = entry.metrics[key];
    assert.ok('sample_size' in stats && 'baseline' in stats && 'delta_pct' in stats && 'confidence' in stats, key);
  }
  assert.ok(memory.comparison_window.start < memory.comparison_window.end);
});

test('contenus non etiquetes comptes explicitement, jamais fondus dans une categorie', () => {
  const memory = buildContentMemory([rec('A'), rec('B', { product: 'boubou' })], { now: NOW });
  assert.equal(memory.dimensions.product.unlabeled_count, 1);
  assert.equal(memory.dimensions.product.values.boubou.sample_size, 1);
  assert.equal(memory.dimensions.product.values.inconnu, undefined);
});

test('corpus vide : memoire vide et honnete, aucune invention', () => {
  const memory = buildContentMemory([], { now: NOW });
  assert.equal(memory.corpus.in_window, 0);
  assert.equal(memory.baselines.reach.median, null);
  assert.deepEqual(memory.observations, []);
  assert.deepEqual(memory.correlations, []);
});

test('deterministe : deux constructions identiques donnent la meme memoire', () => {
  const records = Array.from({ length: 8 }, (_, i) => rec(`D${i}`, {
    published_at: new Date(NOW - (i + 1) * DAY).toISOString(),
    reach: 800 + i * 150,
  }));
  assert.deepEqual(buildContentMemory(records, { now: NOW }), buildContentMemory(records, { now: NOW }));
});

test('persistance : la memoire se relit telle quelle, l historique brut reste intact', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const records = [rec('A'), rec('B')];
  const snapshot = JSON.stringify(records);
  const memory = buildContentMemory(records, { now: NOW });
  await writeContentMemory(env, memory);
  assert.deepEqual(await readContentMemory(env), JSON.parse(JSON.stringify(memory)));
  assert.equal(JSON.stringify(records), snapshot, 'la memoire ne doit jamais modifier les enregistrements bruts');
  assert.ok(MEMORY_V5_KEY.startsWith('visuals/social-intelligence/v5/'));
});

test('memoire absente : lecture nulle, pas d exception', async () => {
  assert.equal(await readContentMemory({ VISUALS_BUCKET: new Bucket() }), null);
  assert.equal(await readContentMemory({}), null);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 memory: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
