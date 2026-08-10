/**
 * SOWHAT Control V5 - Tests de la synchronisation incrementale et du modele.
 * Aucun appel reseau : le client Meta est un double injecte.
 */

import assert from 'node:assert/strict';
import { META_ERROR, MetaApiError } from '../src/instagram-client-v5.js';
import {
  ACCOUNT_HISTORY_KEY, ACCOUNT_KEY, ERROR_EVENTS_KEY, MEDIA_KEY, SYNC_RUNS_KEY, SYNC_STATE_KEY,
  appendAccountHistory, engagementRate, extractHook, measured, normalizeMediaRecord,
  readAccountHistory, readMediaRecords, runIncrementalSync,
} from '../src/instagram-sync-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v) { this.s.set(k, String(v)); return { key: k }; }
  async delete(k) { this.s.delete(k); }
  json(k) { const r = this.s.get(k); return r ? JSON.parse(r) : null; }
}

function makeEnv() {
  return { VISUALS_BUCKET: new Bucket(), INSTAGRAM_USER_ID: '17841400000000000', INSTAGRAM_ACCESS_TOKEN: 'x' };
}

function media(id, timestamp, extra = {}) {
  return {
    id, timestamp, media_type: 'IMAGE', media_product_type: 'FEED',
    caption: `Legende ${id}. Suite du texte.`, permalink: `https://www.instagram.com/p/${id}/`,
    like_count: 10, comments_count: 2, ...extra,
  };
}

const insightsPayload = (values) => ({
  data: Object.entries(values).map(([name, value]) => ({ name, values: [{ value }] })),
});

function makeClient({ accountData = { id: 'acc', username: 'sowhatafrika', followers_count: 1200 }, items = [], insights = {}, failInsightsFor = [], fetchError = null } = {}) {
  const requests = [];
  return {
    requests,
    isConfigured: () => true,
    async request(path, params) {
      requests.push({ path, params });
      if (fetchError && !path.includes('/insights')) throw fetchError;
      if (path.includes('/insights')) {
        const id = path.split('/')[0];
        if (failInsightsFor.includes(id)) throw new MetaApiError(META_ERROR.FORBIDDEN, { detail: 'pas de permission' });
        return insightsPayload(insights[id] || {});
      }
      return accountData;
    },
    async paginate() { return { items, pages: 1, truncated: false }; },
  };
}

/* ---------------- Modele de donnees ---------------- */

test('metrique absente = null, jamais zero', () => {
  assert.equal(measured(0), 0, 'zero mesure reste zero');
  assert.equal(measured(undefined), null);
  assert.equal(measured(null), null);
  assert.equal(measured('abc'), null);
  assert.equal(measured(-3), null);
});

test('taux d engagement : null si la base est inconnue', () => {
  assert.equal(engagementRate(50, 1000), 0.05);
  assert.equal(engagementRate(50, null), null, 'pas de portee = pas de taux');
  assert.equal(engagementRate(null, 1000), null);
  assert.equal(engagementRate(50, 0), null, 'diviser par zero n est pas un taux');
});

test('hook = premiere phrase de la legende', () => {
  assert.equal(extractHook('Le Senegal na jamais porte ca. Ensuite du bla.'), 'Le Senegal na jamais porte ca');
  assert.equal(extractHook(''), '');
});

test('enregistrement canonique : identifiant stable et champs obligatoires', () => {
  const record = normalizeMediaRecord(media('M1', '2026-08-01T19:00:00Z'), { reach: 500, total_interactions: 40 }, null);
  assert.equal(record.instagram_media_id, 'M1');
  assert.equal(record.format, 'IMAGE');
  assert.equal(record.reach, 500);
  assert.equal(record.engagement_rate, 0.08);
  assert.equal(record.views, null, 'une image n a pas de vues : null, pas zero');
  assert.equal(record.performance_score, null, 'le score n est pas calcule a la collecte');
  assert.ok(record.created_at && record.updated_at);
});

test('un Reel est reconnu via media_product_type', () => {
  const record = normalizeMediaRecord(media('R1', '2026-08-02T19:00:00Z', { media_type: 'VIDEO', media_product_type: 'REELS' }), { views: 38400 }, null);
  assert.equal(record.format, 'REEL');
  assert.equal(record.views, 38400);
});

test('les annotations manuelles survivent a une resynchronisation', () => {
  const previous = { created_at: '2026-01-01T00:00:00Z', collection: 'Summer', product: 'Chemise', campaign: 'Lancement', cta: 'commentaire' };
  const record = normalizeMediaRecord(media('M1', '2026-08-01T19:00:00Z'), { reach: 10 }, previous);
  assert.equal(record.collection, 'Summer');
  assert.equal(record.product, 'Chemise');
  assert.equal(record.campaign, 'Lancement');
  assert.equal(record.cta, 'commentaire');
  assert.equal(record.created_at, '2026-01-01T00:00:00Z', 'la date de creation ne doit pas etre reecrite');
});

test('URL non https rejetees', () => {
  const record = normalizeMediaRecord(media('M1', '2026-08-01T19:00:00Z', { permalink: 'http://x.com/p', media_url: 'javascript:alert(1)' }), {}, null);
  assert.equal(record.permalink, '');
  assert.equal(record.media_url, '');
});

/* ---------------- Synchronisation ---------------- */

test('client non configure : echec trace, rien ecrase', async () => {
  const env = makeEnv();
  const run = await runIncrementalSync(env, { isConfigured: () => false }, {});
  assert.equal(run.status, 'failed');
  assert.equal(run.error_code, META_ERROR.NOT_CONFIGURED);
  assert.equal(env.VISUALS_BUCKET.json(MEDIA_KEY), null, 'aucune donnee ecrite');
  assert.equal(env.VISUALS_BUCKET.json(SYNC_RUNS_KEY).length, 1);
});

test('premiere synchronisation : medias et compte enregistres', async () => {
  const env = makeEnv();
  const client = makeClient({
    items: [media('M1', '2026-08-01T19:00:00Z'), media('M2', '2026-08-03T19:00:00Z')],
    insights: { M1: { reach: 500, total_interactions: 40, saved: 5, shares: 2 }, M2: { reach: 900, total_interactions: 120 } },
  });
  const run = await runIncrementalSync(env, client, {});
  assert.equal(run.status, 'success');
  assert.equal(run.created, 2);
  assert.equal(run.updated, 0);
  const records = await readMediaRecords(env);
  assert.equal(records.length, 2);
  assert.equal(records[0].instagram_media_id, 'M2', 'tri du plus recent au plus ancien');
  assert.equal(env.VISUALS_BUCKET.json(ACCOUNT_KEY).followers_count, 1200);
  assert.equal(env.VISUALS_BUCKET.json(SYNC_STATE_KEY).last_published_at, '2026-08-03T19:00:00.000Z');
});

test('idempotence : relancer la synchronisation ne cree aucun doublon', async () => {
  const env = makeEnv();
  const items = [media('M1', '2026-08-01T19:00:00Z'), media('M2', '2026-08-03T19:00:00Z')];
  const client = makeClient({ items, insights: { M1: { reach: 500 }, M2: { reach: 900 } } });
  await runIncrementalSync(env, client, {});
  const second = await runIncrementalSync(env, client, { full: true });
  const records = await readMediaRecords(env);
  assert.equal(records.length, 2, 'toujours deux medias apres deux passages');
  assert.equal(second.created, 0);
  assert.equal(second.updated, 2, 'les medias sont mis a jour, pas ajoutes');
  const ids = records.map((r) => r.instagram_media_id);
  assert.equal(new Set(ids).size, ids.length, 'aucun identifiant en double');
});

test('incremental : seuls les medias plus recents que le curseur sont traites', async () => {
  const env = makeEnv();
  const client = makeClient({
    items: [media('M1', '2026-08-01T19:00:00Z'), media('M2', '2026-08-03T19:00:00Z')],
    insights: { M1: { reach: 1 }, M2: { reach: 2 } },
  });
  await runIncrementalSync(env, client, {});
  const client2 = makeClient({
    items: [media('M1', '2026-08-01T19:00:00Z'), media('M2', '2026-08-03T19:00:00Z'), media('M3', '2026-08-05T19:00:00Z')],
    insights: { M3: { reach: 3 } },
  });
  const run = await runIncrementalSync(env, client2, {});
  assert.equal(run.considered, 1, 'un seul media nouveau depuis le curseur');
  assert.equal(run.created, 1);
  assert.equal((await readMediaRecords(env)).length, 3);
});

test('insights partiels : le media est conserve, l erreur tracee, la sync marquee partielle', async () => {
  const env = makeEnv();
  const client = makeClient({
    items: [media('M1', '2026-08-01T19:00:00Z'), media('M2', '2026-08-03T19:00:00Z')],
    insights: { M2: { reach: 900 } },
    failInsightsFor: ['M1'],
  });
  const run = await runIncrementalSync(env, client, {});
  assert.equal(run.status, 'partial');
  assert.equal(run.insight_failures, 1);
  const records = await readMediaRecords(env);
  assert.equal(records.length, 2, 'un echec d insights ne fait pas perdre le media');
  const m1 = records.find((r) => r.instagram_media_id === 'M1');
  assert.equal(m1.reach, null, 'metrique indisponible = null');
  assert.equal(m1.insights_available, false);
  assert.equal(m1.likes, 10, 'les champs du media restent disponibles');
  const errors = env.VISUALS_BUCKET.json(ERROR_EVENTS_KEY);
  assert.equal(errors[0].error_code, META_ERROR.FORBIDDEN);
  assert.equal(errors[0].instagram_media_id, 'M1');
});

test('echec fatal : l etat precedent n est pas ecrase', async () => {
  const env = makeEnv();
  const good = makeClient({ items: [media('M1', '2026-08-01T19:00:00Z')], insights: { M1: { reach: 500 } } });
  await runIncrementalSync(env, good, {});
  const before = await readMediaRecords(env);

  const broken = makeClient({ fetchError: new MetaApiError(META_ERROR.TOKEN_EXPIRED, { detail: 'expire' }) });
  const run = await runIncrementalSync(env, broken, {});
  assert.equal(run.status, 'failed');
  assert.equal(run.error_code, META_ERROR.TOKEN_EXPIRED);
  assert.deepEqual(await readMediaRecords(env), before, 'les donnees precedentes sont intactes');
  assert.equal(env.VISUALS_BUCKET.json(ERROR_EVENTS_KEY)[0].stage, 'fetch');
});

test('journal des synchronisations : identifiant, duree, compteurs', async () => {
  const env = makeEnv();
  let clock = 1_000_000;
  const client = makeClient({ items: [media('M1', '2026-08-01T19:00:00Z')], insights: { M1: { reach: 5 } } });
  const run = await runIncrementalSync(env, client, { now: () => (clock += 250) });
  assert.ok(run.sync_id.startsWith('SYNC-'));
  assert.ok(run.duration_ms > 0);
  assert.equal(run.mode, 'incremental');
  const runs = env.VISUALS_BUCKET.json(SYNC_RUNS_KEY);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].sync_id, run.sync_id);
});

test('aucun media : synchronisation reussie et vide, sans invention', async () => {
  const env = makeEnv();
  const run = await runIncrementalSync(env, makeClient({ items: [] }), {});
  assert.equal(run.status, 'success');
  assert.equal(run.created, 0);
  assert.deepEqual(await readMediaRecords(env), []);
  assert.equal(env.VISUALS_BUCKET.json(SYNC_STATE_KEY).known_media_count, 0);
});

/* ---------------- Historique de compte : base de la croissance ---------------- */

test('historique : un releve d abonnes est ajoute a chaque synchronisation', async () => {
  const env = makeEnv();
  const client = makeClient({ items: [media('A', '2026-06-01T10:00:00+0000')] });
  await runIncrementalSync(env, client, { now: () => Date.parse('2026-06-01T12:00:00Z') });
  const history = env.VISUALS_BUCKET.json(ACCOUNT_HISTORY_KEY);
  assert.equal(history.length, 1);
  assert.equal(history[0].followers_count, 1200);
});

test('historique : un seul releve par jour, mais les jours s accumulent', async () => {
  const env = makeEnv();
  await appendAccountHistory(env, { at: '2026-06-01T08:00:00.000Z', followers_count: 1000 });
  await appendAccountHistory(env, { at: '2026-06-01T20:00:00.000Z', followers_count: 1010 });
  await appendAccountHistory(env, { at: '2026-06-02T08:00:00.000Z', followers_count: 1050 });
  const history = await readAccountHistory(env);
  assert.equal(history.length, 2, 'un point par jour');
  assert.equal(history[0].followers_count, 1010, 'le releve le plus recent du jour est conserve');
  assert.equal(history[1].followers_count, 1050);
});

test('historique : un nombre d abonnes absent n est jamais enregistre comme zero', async () => {
  const env = makeEnv();
  await appendAccountHistory(env, { at: '2026-06-01T08:00:00.000Z', followers_count: null });
  assert.deepEqual(await readAccountHistory(env), []);
});

test('duree vue moyenne d un Reel : collectee telle quelle, absente sinon', async () => {
  const env = makeEnv();
  const client = makeClient({
    items: [media('R1', '2026-06-01T10:00:00+0000', { media_type: 'VIDEO', media_product_type: 'REELS' })],
    insights: { R1: { reach: 500, ig_reels_avg_watch_time: 4200 } },
  });
  await runIncrementalSync(env, client, { now: () => Date.parse('2026-06-01T12:00:00Z') });
  const [record] = env.VISUALS_BUCKET.json(MEDIA_KEY);
  assert.equal(record.format, 'REEL');
  assert.equal(record.avg_watch_time_ms, 4200);
  assert.equal(record.video_duration_ms, null, 'Meta ne fournit pas la duree totale : elle reste null');
});

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
if (failures) { console.error(`\nSOWHAT V5 sync: ${failures} echec(s) sur ${cases.length}`); process.exit(1); }
console.log(`\nSOWHAT V5 sync: PASS (${cases.length} scenarios)`);
