/**
 * SOWHAT Control V5 - Tests d observabilite.
 * Le point critique : aucun secret ne doit pouvoir sortir dans un journal.
 */

import assert from 'node:assert/strict';
import {
  CORRELATION_FIELDS, LOG_LEVEL, buildLogEvent, buildTechnicalCockpit,
  createLogger, newRequestId, sanitizeValue, timed,
} from '../src/observability-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v) { this.s.set(k, String(v)); return { key: k }; }
}

const NOW = Date.parse('2026-07-01T12:00:00.000Z');
const TOKEN = 'EAAtokentresecretquilnefautjamaisvoirdanslogs';

function collector() {
  const lines = [];
  return { lines, sink: (line) => lines.push(line) };
}

/* ---------------- Aucun secret en sortie ---------------- */

test('un token ne sort jamais, quelle que soit la forme du message', () => {
  const shapes = [
    { detail: `Bearer ${TOKEN}` },
    { url: `https://graph.instagram.com/me?access_token=${TOKEN}` },
    { body: `{"access_token":"${TOKEN}"}` },
    { nested: { deep: { value: TOKEN } } },
    { list: [TOKEN, 'autre'] },
  ];
  for (const fields of shapes) {
    const serialized = JSON.stringify(buildLogEvent(LOG_LEVEL.INFO, 'test', fields, { now: NOW }));
    assert.ok(!serialized.includes(TOKEN), `token visible dans ${JSON.stringify(fields)}`);
  }
});

test('un champ nomme comme un secret est supprime, pas nettoye', () => {
  const event = buildLogEvent(LOG_LEVEL.INFO, 'test', {
    access_token: 'valeur', api_key: 'valeur', password: 'valeur',
    authorization: 'valeur', INSTAGRAM_ACCESS_TOKEN: 'valeur', autre: 'visible',
  }, { now: NOW });
  for (const key of ['access_token', 'api_key', 'password', 'authorization', 'INSTAGRAM_ACCESS_TOKEN']) {
    assert.equal(event[key], '[REDACTED]', key);
  }
  assert.equal(event.autre, 'visible');
});

test('le journal complet ne laisse rien passer', () => {
  const { lines, sink } = collector();
  const logger = createLogger({ sink, now: () => NOW, base: { request_id: 'REQ-1' } });
  logger.error('publish_failed', { detail: `echec avec Bearer ${TOKEN}`, token: TOKEN });
  const serialized = JSON.stringify(lines);
  assert.ok(!serialized.includes(TOKEN));
  assert.ok(serialized.includes('[REDACTED]'));
});

/* ---------------- Structure ---------------- */

test('tout evenement porte horodatage, niveau, evenement et service', () => {
  const event = buildLogEvent(LOG_LEVEL.WARN, 'sync_partial', { sync_id: 'SYNC-1' }, { now: NOW });
  assert.equal(event.ts, '2026-07-01T12:00:00.000Z');
  assert.equal(event.level, 'warn');
  assert.equal(event.event, 'sync_partial');
  assert.equal(event.service, 'sowhat-control-v5');
  assert.equal(event.sync_id, 'SYNC-1');
});

test('les champs de correlation exiges sont supportes', () => {
  const fields = Object.fromEntries(CORRELATION_FIELDS.map((f) => [f, `${f}-1`]));
  const event = buildLogEvent(LOG_LEVEL.INFO, 'publication', { ...fields, status: 'ok', duration_ms: 12, error_code: null }, { now: NOW });
  for (const field of CORRELATION_FIELDS) assert.equal(event[field], `${field}-1`);
  assert.equal(event.status, 'ok');
  assert.equal(event.duration_ms, 12);
});

test('niveau inconnu ramene a info, evenement borne', () => {
  assert.equal(buildLogEvent('inexistant', 'e', {}, { now: NOW }).level, 'info');
  assert.equal(buildLogEvent(LOG_LEVEL.INFO, 'x'.repeat(200), {}, { now: NOW }).event.length, 80);
});

test('valeurs non serialisables et profondeur excessive maitrisees', () => {
  assert.equal(sanitizeValue(() => {}), '[NON_SERIALISABLE]');
  assert.equal(sanitizeValue(Number.NaN), null);
  assert.equal(sanitizeValue({ a: { b: { c: { d: { e: 'trop profond' } } } } }).a.b.c.d, '[TRONQUE]');
  assert.equal(sanitizeValue('x'.repeat(900)).length, 500);
});

test('identifiants de requete uniques et lisibles', () => {
  const a = newRequestId(NOW, () => 0.1);
  const b = newRequestId(NOW, () => 0.9);
  assert.ok(a.startsWith('REQ-'));
  assert.notEqual(a, b);
});

test('journal enfant : le contexte parent est conserve', () => {
  const { lines, sink } = collector();
  const logger = createLogger({ sink, now: () => NOW, base: { request_id: 'REQ-1' } });
  logger.child({ publication_job_id: 'JOB-1' }).info('etape');
  assert.equal(lines[0].request_id, 'REQ-1');
  assert.equal(lines[0].publication_job_id, 'JOB-1');
});

/* ---------------- Duree ---------------- */

test('une operation qui echoue laisse autant de traces qu une qui reussit', async () => {
  const { lines, sink } = collector();
  const logger = createLogger({ sink, now: () => NOW });
  let clock = NOW;
  const tick = () => { clock += 25; return clock; };

  await timed(logger, 'ok_case', { sync_id: 'S1' }, async () => 'ok', { now: tick });
  await assert.rejects(() => timed(logger, 'ko_case', { sync_id: 'S2' }, async () => {
    const error = new Error('boom'); error.code = 'meta_timeout'; throw error;
  }, { now: tick }));

  assert.equal(lines.length, 2);
  assert.equal(lines[0].status, 'ok');
  assert.equal(lines[1].status, 'error');
  assert.equal(lines[1].error_code, 'meta_timeout');
  assert.ok(lines[0].duration_ms >= 0 && lines[1].duration_ms >= 0);
});

/* ---------------- Cockpit technique ---------------- */

test('cockpit vide : inconnu partout, jamais des zeros rassurants', async () => {
  const cockpit = await buildTechnicalCockpit({ VISUALS_BUCKET: new Bucket() }, { now: NOW });
  assert.equal(cockpit.sync.last_run, null);
  assert.equal(cockpit.sync.last_success_at, null);
  assert.equal(cockpit.sync.known_media_count, null, 'un compte inconnu ne vaut pas zero');
  assert.equal(cockpit.instagram.configured, false);
  assert.equal(cockpit.instagram.token_health.status, 'unknown');
  assert.deepEqual(cockpit.recent_errors, []);
});

test('cockpit renseigne : derniere sync, echecs, file et erreurs recentes', async () => {
  const env = { VISUALS_BUCKET: new Bucket(), INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' };
  await env.VISUALS_BUCKET.put('visuals/social-intelligence/v5/sync-runs.json', JSON.stringify([
    { sync_id: 'S3', status: 'partial', finished_at: '2026-07-01T11:00:00.000Z', duration_ms: 900, insight_failures: 2 },
    { sync_id: 'S2', status: 'failed', finished_at: '2026-07-01T05:00:00.000Z' },
    { sync_id: 'S1', status: 'success', finished_at: '2026-06-30T23:00:00.000Z' },
  ]));
  await env.VISUALS_BUCKET.put('visuals/social-intelligence/v5/sync-state.json', JSON.stringify({ known_media_count: 42 }));
  await env.VISUALS_BUCKET.put('visuals/social-intelligence/v5/scheduler-runs.json', JSON.stringify([
    { run_id: 'R2', status: 'completed', finished_at: '2026-07-01T11:30:00.000Z', published: 1, failed: 1, manual_check: 1 },
    { run_id: 'R1', status: 'completed', published: 2, failed: 0, manual_check: 0 },
  ]));
  await env.VISUALS_BUCKET.put('visuals/social-intelligence/v5/error-events.json', JSON.stringify([
    { sync_id: 'S2', error_code: 'meta_permission_denied', detail: `token ${TOKEN}` },
  ]));

  const cockpit = await buildTechnicalCockpit(env, {
    now: NOW,
    tokenHealth: { status: 'valid', checked_at: '2026-07-01T11:59:00.000Z' },
    queue: [{ draft_id: 'D1', due: true }, { draft_id: 'D2', due: false }],
    nextSyncAt: '2026-07-01T17:17:00.000Z',
  });

  assert.equal(cockpit.instagram.configured, true);
  assert.equal(cockpit.instagram.token_health.status, 'valid');
  assert.equal(cockpit.sync.last_run.sync_id, 'S3');
  assert.equal(cockpit.sync.last_run.status, 'partial');
  assert.equal(cockpit.sync.failed_runs, 1);
  assert.equal(cockpit.sync.partial_runs, 1);
  assert.equal(cockpit.sync.last_success_at, '2026-06-30T23:00:00.000Z');
  assert.equal(cockpit.sync.next_run_at, '2026-07-01T17:17:00.000Z');
  assert.equal(cockpit.sync.known_media_count, 42);
  assert.equal(cockpit.publication.queue_size, 2);
  assert.equal(cockpit.publication.due_now, 1);
  assert.equal(cockpit.publication.failed_last_runs, 1);
  assert.equal(cockpit.publication.manual_check_last_runs, 1);
  assert.equal(cockpit.publication.last_run.run_id, 'R2');
  assert.equal(cockpit.recent_errors.length, 1);
  assert.ok(!JSON.stringify(cockpit).includes(TOKEN), 'le cockpit ne doit jamais exposer un token');
});

test('stockage illisible : cockpit degrade mais jamais en erreur', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  await env.VISUALS_BUCKET.put('visuals/social-intelligence/v5/sync-runs.json', 'ceci n est pas du json');
  const cockpit = await buildTechnicalCockpit(env, { now: NOW });
  assert.equal(cockpit.sync.last_run, null);
  assert.equal(cockpit.sync.failed_runs, 0);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 observability: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
