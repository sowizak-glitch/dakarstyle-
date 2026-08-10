/**
 * SOWHAT Control V5 - Tests de la boucle d apprentissage.
 * Le client Meta est un double : aucun appel reseau.
 */

import assert from 'node:assert/strict';
import { META_ERROR, MetaApiError } from '../src/instagram-client-v5.js';
import {
  CHECKPOINTS, LEARNING_STATUS, dueCheckpoints, forecastFor, learningKey,
  readLearningRecord, recordCheckpoint, runLearningLoop, summarizeLearning,
} from '../src/learning-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v, o = {}) {
    if (o?.onlyIf?.etagDoesNotMatch === '*' && this.s.has(k)) return null;
    this.s.set(k, String(v)); return { key: k };
  }
}

const HOUR = 3600000;
const DAY = 86400000;
const PUBLISHED_AT = '2026-07-01T10:00:00.000Z';
const T0 = Date.parse(PUBLISHED_AT);

const makeEnv = () => ({ VISUALS_BUCKET: new Bucket() });

function insights(values) {
  return { data: Object.entries(values).map(([name, value]) => ({ name, values: [{ value }] })) };
}

function makeClient(script = {}) {
  const calls = [];
  return {
    calls,
    async request(path, params) {
      calls.push({ path, params });
      if (script.error) throw script.error;
      return insights(script.values || { reach: 1500, likes: 80, saved: 12, shares: 6, total_interactions: 98 });
    },
  };
}

function record(id, reach, offsetDays) {
  return {
    instagram_media_id: id,
    format: 'REEL',
    published_at: new Date(T0 - offsetDays * DAY).toISOString(),
    reach,
  };
}

const cohort = [record('C1', 1000, 1), record('C2', 1200, 2), record('C3', 800, 3)];
const self = { instagram_media_id: 'M1', format: 'REEL', published_at: PUBLISHED_AT, reach: null };

/* ---------------- Echeances ---------------- */

test('les quatre horizons sont T+1h, T+6h, T+24h et T+72h', () => {
  assert.deepEqual(CHECKPOINTS.map((c) => c.label), ['T+1h', 'T+6h', 'T+24h', 'T+72h']);
  assert.deepEqual(CHECKPOINTS.map((c) => c.offset_ms), [HOUR, 6 * HOUR, 24 * HOUR, 72 * HOUR]);
});

test('seuls les checkpoints echus sont proposes', () => {
  assert.deepEqual(dueCheckpoints(PUBLISHED_AT, T0 + 30 * 60000).map((c) => c.label), []);
  assert.deepEqual(dueCheckpoints(PUBLISHED_AT, T0 + HOUR).map((c) => c.label), ['T+1h']);
  assert.deepEqual(dueCheckpoints(PUBLISHED_AT, T0 + 25 * HOUR).map((c) => c.label), ['T+1h', 'T+6h', 'T+24h']);
  assert.equal(dueCheckpoints(PUBLISHED_AT, T0 + 100 * HOUR).length, 4);
  assert.deepEqual(dueCheckpoints('date illisible', T0 + 100 * HOUR), []);
});

/* ---------------- Prevision ---------------- */

test('prevision : mediane des comparables, avec sa taille d echantillon', () => {
  const forecast = forecastFor(self, [self, ...cohort]);
  assert.equal(forecast.value, 1000);
  assert.equal(forecast.sample_size, 3);
  assert.ok(forecast.basis.includes('3'));
});

test('aucun comparable : aucune prevision, jamais zero', () => {
  const forecast = forecastFor(self, [self]);
  assert.equal(forecast.value, null);
  assert.equal(forecast.sample_size, 0);
  assert.ok(forecast.basis.includes('aucun contenu comparable'));
});

/* ---------------- Releve d un checkpoint ---------------- */

test('checkpoint echu : mesure enregistree avec comparaison complete', async () => {
  const env = makeEnv();
  const client = makeClient({ values: { reach: 1500, likes: 80, saved: 12, shares: 6, total_interactions: 98 } });
  const result = await recordCheckpoint(env, client, {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort], baseline: 1200,
  }, { now: T0 + HOUR });

  assert.equal(result.status, LEARNING_STATUS.RECORDED);
  assert.equal(result.entry.metrics.reach, 1500);
  assert.equal(result.entry.comparison.forecast, 1000);
  assert.equal(result.entry.comparison.delta_vs_forecast_pct, 50);
  assert.equal(result.entry.comparison.baseline, 1200);
  assert.equal(result.entry.comparison.delta_vs_baseline_pct, 25);
});

test('checkpoint non echu : rien n est mesure', async () => {
  const env = makeEnv();
  const client = makeClient({});
  const result = await recordCheckpoint(env, client, { mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+24h' }, { now: T0 + HOUR });
  assert.equal(result.status, LEARNING_STATUS.NOT_DUE);
  assert.equal(client.calls.length, 0);
});

test('checkpoint idempotent : le rejouer ne remplace pas la mesure', async () => {
  const env = makeEnv();
  const first = await recordCheckpoint(env, makeClient({ values: { reach: 1500 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + HOUR });
  assert.equal(first.status, LEARNING_STATUS.RECORDED);

  const client = makeClient({ values: { reach: 9999 } });
  const second = await recordCheckpoint(env, client, {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + 2 * HOUR });
  assert.equal(second.status, LEARNING_STATUS.ALREADY_RECORDED);
  assert.equal(client.calls.length, 0, 'aucun appel Meta pour un releve deja fait');

  const stored = await readLearningRecord(env, 'M1');
  assert.equal(stored.checkpoints['T+1h'].metrics.reach, 1500, 'la mesure d origine est conservee');
});

test('les releves s ajoutent sans ecraser l historique brut', async () => {
  const env = makeEnv();
  await recordCheckpoint(env, makeClient({ values: { reach: 500 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + HOUR });
  await recordCheckpoint(env, makeClient({ values: { reach: 1800 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+6h', records: [self, ...cohort],
  }, { now: T0 + 6 * HOUR });
  await recordCheckpoint(env, makeClient({ values: { reach: 2400 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+24h', records: [self, ...cohort],
  }, { now: T0 + 24 * HOUR });

  const stored = await readLearningRecord(env, 'M1');
  assert.deepEqual(Object.keys(stored.checkpoints), ['T+1h', 'T+6h', 'T+24h']);
  assert.equal(stored.checkpoints['T+1h'].metrics.reach, 500, 'le premier releve reste intact');
  assert.equal(stored.checkpoints['T+24h'].metrics.reach, 2400);
});

test('la prevision est figee au premier releve, jamais recalculee apres coup', async () => {
  const env = makeEnv();
  await recordCheckpoint(env, makeClient({ values: { reach: 500 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + HOUR });
  const forecastBefore = (await readLearningRecord(env, 'M1')).forecast.value;

  // Des contenus posterieurs apparaissent : ils ne doivent pas reecrire la prevision.
  const later = [...cohort, record('C4', 9000, 0.5), record('C5', 9500, 0.4)];
  await recordCheckpoint(env, makeClient({ values: { reach: 800 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+6h', records: [self, ...later],
  }, { now: T0 + 6 * HOUR });

  assert.equal((await readLearningRecord(env, 'M1')).forecast.value, forecastBefore);
});

test('metrique absente : enregistree comme absente, jamais comme zero', async () => {
  const env = makeEnv();
  const result = await recordCheckpoint(env, makeClient({ values: { likes: 10 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + HOUR });
  assert.equal(result.entry.metrics.likes, 10);
  assert.equal(result.entry.metrics.reach, null);
  assert.equal(result.entry.comparison.actual, null);
  assert.equal(result.entry.comparison.delta_vs_forecast_pct, null, 'aucun ecart calcule sans mesure');
});

test('echec de mesure : rien n est enregistre, surtout pas un zero', async () => {
  const env = makeEnv();
  const result = await recordCheckpoint(env, makeClient({ error: new MetaApiError(META_ERROR.FORBIDDEN, { status: 403 }) }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self, ...cohort],
  }, { now: T0 + HOUR });
  assert.equal(result.status, LEARNING_STATUS.UNAVAILABLE);
  assert.equal(result.error_code, META_ERROR.FORBIDDEN);
  assert.equal(await readLearningRecord(env, 'M1'), null, 'aucun releve fantome');
});

test('ecart non calcule quand la reference manque', async () => {
  const env = makeEnv();
  const result = await recordCheckpoint(env, makeClient({ values: { reach: 1500 } }), {
    mediaId: 'M1', publishedAt: PUBLISHED_AT, label: 'T+1h', records: [self], baseline: null,
  }, { now: T0 + HOUR });
  assert.equal(result.entry.comparison.forecast, null);
  assert.equal(result.entry.comparison.delta_vs_forecast_pct, null);
  assert.equal(result.entry.comparison.delta_vs_baseline_pct, null);
  assert.equal(result.entry.comparison.actual, 1500, 'la mesure reelle est bien conservee');
});

test('identifiant de media invalide refuse', () => {
  assert.throws(() => learningKey(''), (e) => e.code === 'learning_invalid_media_id');
  assert.throws(() => learningKey('../../evasion'), (e) => e.code !== undefined);
  assert.equal(learningKey('17999'), 'visuals/social-intelligence/v5/learning/17999.json');
});

/* ---------------- Boucle complete ---------------- */

test('boucle : tous les checkpoints dus sont releves en une passe', async () => {
  const env = makeEnv();
  const result = await runLearningLoop(env, makeClient({}), [
    { instagram_media_id: 'M1', published_at: PUBLISHED_AT, format: 'REEL' },
  ], { now: T0 + 25 * HOUR, records: [self, ...cohort], baseline: 1200 });

  assert.equal(result.recorded, 3);
  const stored = await readLearningRecord(env, 'M1');
  assert.deepEqual(Object.keys(stored.checkpoints), ['T+1h', 'T+6h', 'T+24h']);
});

test('boucle rejouee : aucun doublon, aucune reecriture', async () => {
  const env = makeEnv();
  const published = [{ instagram_media_id: 'M1', published_at: PUBLISHED_AT, format: 'REEL' }];
  await runLearningLoop(env, makeClient({}), published, { now: T0 + 25 * HOUR, records: [self, ...cohort] });
  const second = await runLearningLoop(env, makeClient({}), published, { now: T0 + 25 * HOUR, records: [self, ...cohort] });
  assert.equal(second.recorded, 0);
  assert.equal(second.already_recorded, 3);
});

test('boucle : un contenu sans identifiant est ignore proprement', async () => {
  const env = makeEnv();
  const result = await runLearningLoop(env, makeClient({}), [
    { instagram_media_id: '', published_at: PUBLISHED_AT },
    { published_at: PUBLISHED_AT },
  ], { now: T0 + 25 * HOUR });
  assert.equal(result.recorded, 0);
  assert.deepEqual(result.results, []);
});

test('synthese : ce qui est mesure et ce qui ne l est pas, sans combler les trous', async () => {
  const env = makeEnv();
  await runLearningLoop(env, makeClient({ values: { reach: 1500 } }), [
    { instagram_media_id: 'M1', published_at: PUBLISHED_AT, format: 'REEL' },
  ], { now: T0 + 7 * HOUR, records: [self, ...cohort] });

  const summary = summarizeLearning(await readLearningRecord(env, 'M1'));
  assert.equal(summary.measured_points, 2);
  assert.deepEqual(summary.points.map((p) => p.status), ['mesure', 'mesure', 'non mesure', 'non mesure']);
  assert.equal(summary.points[2].reach, null, 'un point non mesure reste vide');
  assert.equal(summary.latest_reach, 1500);
  assert.equal(summarizeLearning(null), null);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 learning: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
