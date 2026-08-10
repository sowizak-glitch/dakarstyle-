/**
 * SOWHAT Control V5 - Tests du scheduler.
 * La concurrence est testee explicitement : deux executions simultanees ne
 * doivent produire qu une seule publication.
 */

import assert from 'node:assert/strict';
import { META_ERROR, MetaApiError } from '../src/instagram-client-v5.js';
import { MEDIA_KEY_PREFIX } from '../src/security-v5.js';
import {
  SCHEDULER_ERROR, SCHEDULER_LOCK_KEY, SCHEDULER_RUNS_KEY, SCHEDULER_STATUS,
  acquireLock, releaseLock, runScheduler,
} from '../src/scheduler-v5.js';
import { PUBLISH_STATUS } from '../src/publishing-v5.js';
import {
  STUDIO_STATE, approveDraft, createDraft, markReady, readDraft, scheduleDraft, writeDraft,
} from '../src/studio-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v, o = {}) {
    if (o?.onlyIf?.etagDoesNotMatch === '*' && this.s.has(k)) return null;
    this.s.set(k, String(v)); return { key: k };
  }
  async delete(k) { this.s.delete(k); }
  json(k) { const r = this.s.get(k); return r ? JSON.parse(r) : null; }
}

const NOW = Date.parse('2026-07-01T12:00:00.000Z');
const DUE = Date.parse('2026-07-01T11:00:00.000Z');
const USER = '17841400000000000';

function makeEnv(overrides = {}) {
  return {
    VISUALS_BUCKET: new Bucket(),
    INSTAGRAM_USER_ID: USER,
    INSTAGRAM_ACCESS_TOKEN: 'x',
    SOWHAT_PUBLISH_ENABLED: 'true',
    SOWHAT_MEDIA_PUBLIC_BASE: 'https://visuals.dakarstyle.com',
    ...overrides,
  };
}

function scheduledDraft(id = 'DRAFT-1', scheduledFor = DUE, mediaOverrides = {}) {
  const draft = createDraft({
    draft_id: id,
    caption: 'Contenu programme.',
    format: 'IMAGE',
    media: {
      r2_key: `${MEDIA_KEY_PREFIX}2026/07/v.jpg`,
      content_type: 'image/jpeg',
      size_bytes: 300000,
      filename: 'v.jpg',
      ...mediaOverrides,
    },
  }, { now: DUE - 7200000 });
  const ready = markReady(approveDraft(draft, { now: DUE - 7200000 }), { now: DUE - 7200000 });
  return scheduleDraft(ready, new Date(scheduledFor).toISOString(), { now: DUE - 7200000 });
}

function makeClient(script = {}) {
  const calls = [];
  return {
    calls,
    isConfigured: () => true,
    async checkTokenHealth() {
      calls.push({ kind: 'health' });
      return { status: script.tokenStatus || 'valid' };
    },
    async mutate(path, fields) {
      calls.push({ kind: 'POST', path, fields });
      if (path.endsWith('/media')) {
        if (script.containerError) throw script.containerError;
        return { id: 'CONTAINER-1' };
      }
      if (path.endsWith('/media_publish')) {
        if (script.publishError) throw script.publishError;
        return { id: script.mediaId || '17999' };
      }
      throw new Error(`chemin inattendu ${path}`);
    },
    async request(path, params) {
      calls.push({ kind: 'GET', path, params });
      if (String(params?.fields || '').includes('status_code')) return { status_code: script.statusCode || 'FINISHED' };
      return { id: script.mediaId || '17999', permalink: 'https://www.instagram.com/p/x/', timestamp: '2026-07-01T11:00:05+0000' };
    },
  };
}

const fast = { publishOptions: { containerPolling: { delayMs: 0, sleep: async () => {} } } };

/* ---------------- Verrou ---------------- */

test('verrou : le premier l obtient, le second est refuse', async () => {
  const env = makeEnv();
  const first = await acquireLock(env, { now: NOW, holder: 'A' });
  assert.equal(first.acquired, true);
  const second = await acquireLock(env, { now: NOW, holder: 'B' });
  assert.equal(second.acquired, false);
  assert.equal(second.holder, 'A');
});

test('verrou : un verrou expire est repris, un verrou valide ne l est pas', async () => {
  const env = makeEnv();
  await acquireLock(env, { now: NOW, holder: 'A', ttlMs: 60000 });
  assert.equal((await acquireLock(env, { now: NOW + 30000, holder: 'B' })).acquired, false);
  const takeover = await acquireLock(env, { now: NOW + 120000, holder: 'C' });
  assert.equal(takeover.acquired, true);
  assert.equal(takeover.retaken, true);
});

test('verrou : on ne libere que le sien', async () => {
  const env = makeEnv();
  await acquireLock(env, { now: NOW, holder: 'A' });
  assert.equal(await releaseLock(env, 'B'), false, 'liberer le verrou d un autre ouvrirait la porte pendant son travail');
  assert.ok(env.VISUALS_BUCKET.json(SCHEDULER_LOCK_KEY));
  assert.equal(await releaseLock(env, 'A'), true);
  assert.equal(env.VISUALS_BUCKET.json(SCHEDULER_LOCK_KEY), null);
});

test('verrou indisponible : execution bloquee, aucune publication', async () => {
  const run = await runScheduler({ INSTAGRAM_USER_ID: USER }, makeClient({}), { now: () => NOW, ...fast });
  assert.equal(run.status, SCHEDULER_STATUS.BLOCKED);
  assert.equal(run.error_code, SCHEDULER_ERROR.LOCK_UNAVAILABLE);
});

/* ---------------- Concurrence ---------------- */

test('deux executions simultanees : une seule publication', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  const clientA = makeClient({});
  const clientB = makeClient({});

  const [a, b] = await Promise.all([
    runScheduler(env, clientA, { now: () => NOW, runId: 'RUN-A', ...fast }),
    runScheduler(env, clientB, { now: () => NOW, runId: 'RUN-B', ...fast }),
  ]);

  const publishCalls = [...clientA.calls, ...clientB.calls].filter((c) => String(c.path || '').endsWith('media_publish'));
  assert.equal(publishCalls.length, 1, 'media_publish ne doit partir qu une fois');

  const statuses = [a.status, b.status];
  assert.ok(statuses.includes(SCHEDULER_STATUS.COMPLETED), 'une execution doit travailler');
  assert.ok(statuses.includes(SCHEDULER_STATUS.LOCKED), 'l autre doit etre bloquee par le verrou');

  const draft = await readDraft(env, 'DRAFT-1');
  assert.equal(draft.state, STUDIO_STATE.PUBLISHED);
  assert.equal(draft.instagram_media_id, '17999');
});

test('meme sans verrou, l idempotence metier empeche le doublon', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  const clientA = makeClient({});
  const clientB = makeClient({});

  // Premiere execution normale.
  await runScheduler(env, clientA, { now: () => NOW, runId: 'RUN-A', ...fast });
  // Verrou efface a la main : on simule une reprise apres incident.
  await env.VISUALS_BUCKET.delete(SCHEDULER_LOCK_KEY);
  await runScheduler(env, clientB, { now: () => NOW, runId: 'RUN-B', ...fast });

  const publishCalls = [...clientA.calls, ...clientB.calls].filter((c) => String(c.path || '').endsWith('media_publish'));
  assert.equal(publishCalls.length, 1, 'le brouillon est deja PUBLISHED : la seconde execution ne republie pas');
});

/* ---------------- Flux nominal ---------------- */

test('rien a echeance : execution comptabilisee, aucun appel Meta', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft('DRAFT-FUTUR', NOW + 7200000));
  const client = makeClient({});
  const run = await runScheduler(env, client, { now: () => NOW, ...fast });
  assert.equal(run.status, SCHEDULER_STATUS.NO_WORK);
  assert.equal(client.calls.length, 0);
  assert.ok(env.VISUALS_BUCKET.json(SCHEDULER_RUNS_KEY).length >= 1, 'une execution vide reste tracee');
});

test('publication a echeance : PUBLISHING puis PUBLISHED avec identifiant Meta', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  const run = await runScheduler(env, makeClient({}), { now: () => NOW, ...fast });
  assert.equal(run.status, SCHEDULER_STATUS.COMPLETED);
  assert.equal(run.published, 1);
  const draft = await readDraft(env, 'DRAFT-1');
  assert.equal(draft.state, STUDIO_STATE.PUBLISHED);
  const states = draft.history.map((h) => h.to);
  assert.ok(states.includes(STUDIO_STATE.PUBLISHING), 'le passage par PUBLISHING doit etre trace');
  assert.ok(states.indexOf(STUDIO_STATE.PUBLISHING) < states.indexOf(STUDIO_STATE.PUBLISHED));
});

test('le verrou est libere apres l execution', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  await runScheduler(env, makeClient({}), { now: () => NOW, runId: 'RUN-X', ...fast });
  assert.equal(env.VISUALS_BUCKET.json(SCHEDULER_LOCK_KEY), null);
});

test('plusieurs echeances : traitement borne par execution', async () => {
  const env = makeEnv();
  for (let i = 0; i < 5; i += 1) await writeDraft(env, scheduledDraft(`DRAFT-${i}`, DUE - i * 60000));
  const run = await runScheduler(env, makeClient({}), { now: () => NOW, maxPerRun: 2, ...fast });
  assert.equal(run.processed.length, 2, 'une execution ne vide pas la file d un coup');
});

/* ---------------- Verrous de securite ---------------- */

test('jeton en mauvaise sante : rien ne part', async () => {
  for (const status of ['expired', 'invalid', 'insufficient_permissions', 'unknown', 'not_configured']) {
    const env = makeEnv();
    await writeDraft(env, scheduledDraft());
    const client = makeClient({ tokenStatus: status });
    const run = await runScheduler(env, client, { now: () => NOW, ...fast });
    assert.equal(run.status, SCHEDULER_STATUS.BLOCKED, status);
    assert.equal(run.error_code, SCHEDULER_ERROR.TOKEN_UNHEALTHY, status);
    assert.equal(client.calls.some((c) => String(c.path || '').includes('media')), false, `${status} : aucun appel de publication`);
    assert.equal((await readDraft(env, 'DRAFT-1')).state, STUDIO_STATE.SCHEDULED, 'le brouillon reste programme');
  }
});

test('portail SAFE ferme : echec trace, aucune publication', async () => {
  const env = makeEnv({ SOWHAT_PUBLISH_ENABLED: 'false' });
  await writeDraft(env, scheduledDraft());
  const client = makeClient({});
  const run = await runScheduler(env, client, { now: () => NOW, ...fast });
  assert.equal(run.status, SCHEDULER_STATUS.COMPLETED);
  assert.equal(run.failed, 1);
  assert.equal(client.calls.some((c) => String(c.path || '').endsWith('media_publish')), false);
  assert.equal((await readDraft(env, 'DRAFT-1')).state, STUDIO_STATE.FAILED);
});

test('media devenu invalide entre la programmation et l echeance : refus', async () => {
  const env = makeEnv();
  const draft = scheduledDraft();
  await writeDraft(env, { ...draft, media: { ...draft.media, content_type: 'text/html' } });
  const client = makeClient({});
  const run = await runScheduler(env, client, { now: () => NOW, ...fast });
  assert.equal(run.processed[0].reason, SCHEDULER_ERROR.MEDIA_INVALID);
  assert.equal(client.calls.some((c) => String(c.path || '').endsWith('/media')), false);
  assert.equal((await readDraft(env, 'DRAFT-1')).state, STUDIO_STATE.FAILED);
});

test('brouillon annule entre-temps : ignore, pas publie', async () => {
  const env = makeEnv();
  const draft = scheduledDraft();
  await writeDraft(env, draft);
  await writeDraft(env, { ...draft, state: STUDIO_STATE.CANCELLED });
  const client = makeClient({});
  const run = await runScheduler(env, client, { now: () => NOW, ...fast });
  assert.equal(client.calls.some((c) => String(c.path || '').endsWith('media_publish')), false);
  assert.ok(run.status === SCHEDULER_STATUS.NO_WORK || run.processed[0]?.reason === SCHEDULER_ERROR.STATE_CHANGED);
});

/* ---------------- Echecs de publication ---------------- */

test('echec Meta : brouillon en FAILED avec la cause, jamais PUBLISHED', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  const run = await runScheduler(env, makeClient({ containerError: new MetaApiError(META_ERROR.FORBIDDEN, { status: 403 }) }), { now: () => NOW, ...fast });
  assert.equal(run.failed, 1);
  const draft = await readDraft(env, 'DRAFT-1');
  assert.equal(draft.state, STUDIO_STATE.FAILED);
  assert.equal(draft.failure.code, META_ERROR.FORBIDDEN);
  assert.equal(draft.instagram_media_id, null);
});

test('resultat inconnu : marque pour verification humaine, jamais republie', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  const run = await runScheduler(env, makeClient({ publishError: new MetaApiError(META_ERROR.TIMEOUT, {}) }), { now: () => NOW, ...fast });
  assert.equal(run.manual_check, 1);
  const draft = await readDraft(env, 'DRAFT-1');
  assert.equal(draft.state, STUDIO_STATE.FAILED);
  assert.equal(draft.requires_manual_check, true);
  assert.equal(run.processed[0].outcome, PUBLISH_STATUS.REQUIRES_MANUAL_CHECK);
});

test('journal des executions : identifiant, duree et compteurs', async () => {
  const env = makeEnv();
  await writeDraft(env, scheduledDraft());
  await runScheduler(env, makeClient({}), { now: () => NOW, runId: 'RUN-JOURNAL', ...fast });
  const [run] = env.VISUALS_BUCKET.json(SCHEDULER_RUNS_KEY);
  assert.equal(run.run_id, 'RUN-JOURNAL');
  assert.ok(run.started_at && run.finished_at);
  assert.equal(typeof run.duration_ms, 'number');
  assert.equal(run.published, 1);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 scheduler: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
