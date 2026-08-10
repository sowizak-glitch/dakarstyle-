/**
 * SOWHAT Control V5 - Tests de la publication Instagram.
 * Le client Meta est un double injecte : aucun appel reseau, aucun credential.
 */

import assert from 'node:assert/strict';
import { handleMediaUpload, isV5PublicMediaPath, newMediaKey, serveV5Media } from '../src/media-upload-v5.js';
import { META_ERROR, MetaApiError } from '../src/instagram-client-v5.js';
import { MEDIA_KEY_PREFIX, readIdempotencyRecord } from '../src/security-v5.js';
import {
  PUBLISH_ERROR, PUBLISH_STAGE, PUBLISH_STATUS,
  containerFieldsFor, mediaUrlFor, publishDraft, requiresContainerProcessing, waitForContainer,
} from '../src/publishing-v5.js';
import {
  STUDIO_STATE, approveDraft, beginPublishing, createDraft, markFailed, markPublished, markReady,
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
}

const NOW = Date.parse('2026-07-01T10:00:00.000Z');
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

function readyDraft(overrides = {}) {
  const draft = createDraft({
    draft_id: 'DRAFT-TEST',
    caption: 'Nouvelle collection.',
    hashtags: ['#dakar'],
    format: 'IMAGE',
    media: {
      r2_key: `${MEDIA_KEY_PREFIX}2026/07/visuel.jpg`,
      content_type: 'image/jpeg',
      size_bytes: 400000,
      filename: 'visuel.jpg',
    },
    ...overrides,
  }, { now: NOW });
  return markReady(approveDraft(draft, { now: NOW }), { now: NOW });
}

function readyVideoDraft(overrides = {}) {
  return readyDraft({
    format: 'REEL',
    media: {
      r2_key: `${MEDIA_KEY_PREFIX}2026/07/visuel.mp4`,
      content_type: 'video/mp4',
      size_bytes: 900000,
      filename: 'visuel.mp4',
      kind: 'VIDEO',
    },
    ...overrides,
  });
}

/**
 * Client Meta double. `script` decrit ce que fait chaque etape.
 * Chaque appel est enregistre pour verifier qu aucune etape n est rejouee.
 */
function makeClient(script = {}) {
  const calls = [];
  let statusCalls = 0;
  return {
    calls,
    isConfigured: () => script.configured !== false,
    async mutate(path, fields) {
      calls.push({ kind: 'POST', path, fields });
      if (path.endsWith('/media')) {
        if (script.containerError) throw script.containerError;
        return { id: script.creationId ?? 'CONTAINER-1' };
      }
      if (path.endsWith('/media_publish')) {
        if (script.publishError) throw script.publishError;
        return { id: script.mediaId === null ? '' : (script.mediaId ?? '17999') };
      }
      throw new Error(`chemin inattendu : ${path}`);
    },
    async request(path, params) {
      calls.push({ kind: 'GET', path, params });
      if (String(params?.fields || '').includes('status_code')) {
        statusCalls += 1;
        const sequence = script.statusSequence || ['FINISHED'];
        return { status_code: sequence[Math.min(statusCalls - 1, sequence.length - 1)], status: 'detail' };
      }
      if (script.confirmationError) throw script.confirmationError;
      if (script.confirmation === null) return {};
      return script.confirmation || { id: script.mediaId ?? '17999', permalink: 'https://www.instagram.com/p/abc/', timestamp: '2026-07-01T10:00:05+0000' };
    },
  };
}

const noSleep = { containerPolling: { delayMs: 0, sleep: async () => {} } };

/* ---------------- URL publique du media ---------------- */

test('URL de media : https obligatoire, base configuree obligatoire', () => {
  assert.equal(mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://visuals.dakarstyle.com' }, 'a/b.jpg'), 'https://visuals.dakarstyle.com/a/b.jpg');
  for (const base of ['', 'http://visuals.dakarstyle.com', 'https://visuals.dakarstyle.com:8443', 'pas-une-url']) {
    assert.throws(() => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: base }, 'a.jpg'), (e) => e.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, base);
  }
  assert.throws(() => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://x.com' }, ''), (e) => e.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED);
});

test('seules les videos exigent un polling de traitement Meta', () => {
  assert.equal(requiresContainerProcessing(readyDraft()), false);
  assert.equal(requiresContainerProcessing(readyDraft({ format: 'STORY' })), false);
  assert.equal(requiresContainerProcessing(readyVideoDraft()), true);
  assert.equal(requiresContainerProcessing(readyVideoDraft({ format: 'STORY' })), true);
});

test('champs du conteneur selon le format reel', () => {
  assert.deepEqual(containerFieldsFor({ format: 'REEL' }, 'https://x/y.mp4', 'texte'), { media_type: 'REELS', video_url: 'https://x/y.mp4', caption: 'texte' });
  assert.deepEqual(containerFieldsFor({ format: 'IMAGE' }, 'https://x/y.jpg', 'texte'), { image_url: 'https://x/y.jpg', caption: 'texte' });
  assert.deepEqual(containerFieldsFor({ format: 'STORY', media: { kind: 'IMAGE' } }, 'https://x/y.jpg', 'texte'), { media_type: 'STORIES', image_url: 'https://x/y.jpg' });
  assert.deepEqual(containerFieldsFor({ format: 'STORY', media: { kind: 'VIDEO' } }, 'https://x/y.mp4', 'texte'), { media_type: 'STORIES', video_url: 'https://x/y.mp4' });
  assert.equal(containerFieldsFor({ format: 'CAROUSEL' }, 'https://x/y.jpg', 't').image_url, 'https://x/y.jpg');
});

/* ---------------- Suivi du conteneur ---------------- */

test('conteneur : seul status_code fait foi, IN_PROGRESS est attendu', async () => {
  const client = makeClient({ statusSequence: ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'] });
  const result = await waitForContainer(client, 'C1', { delayMs: 0, sleep: async () => {} });
  assert.equal(result.ready, true);
  assert.equal(result.checks, 3);
});

test('conteneur en ERROR ou EXPIRED : echec immediat, aucune publication', async () => {
  for (const [status, code] of [['ERROR', PUBLISH_ERROR.CONTAINER_ERROR], ['EXPIRED', PUBLISH_ERROR.CONTAINER_EXPIRED]]) {
    const client = makeClient({ statusSequence: [status] });
    await assert.rejects(
      () => waitForContainer(client, 'C1', { delayMs: 0, sleep: async () => {} }),
      (e) => e.code === code,
      status,
    );
  }
});

test('conteneur toujours en traitement : abandon borne, jamais de boucle infinie', async () => {
  const client = makeClient({ statusSequence: ['IN_PROGRESS'] });
  await assert.rejects(
    () => waitForContainer(client, 'C1', { maxChecks: 4, delayMs: 0, sleep: async () => {} }),
    (e) => e.code === PUBLISH_ERROR.CONTAINER_TIMEOUT,
  );
  assert.equal(client.calls.length, 4, 'le nombre de verifications est borne');
});

/* ---------------- Pipeline complet ---------------- */

test('publication reussie : les quatre etapes, dans l ordre, une seule fois', async () => {
  const env = makeEnv();
  const client = makeClient({});
  const result = await publishDraft(env, client, readyDraft(), { ...noSleep, now: () => NOW });

  assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(result.instagram_media_id, '17999');
  assert.equal(result.permalink, 'https://www.instagram.com/p/abc/');

  const kinds = client.calls.map((c) => `${c.kind} ${c.path}`);
  assert.deepEqual(kinds, [
    `POST ${USER}/media`,
    `POST ${USER}/media_publish`,
    'GET 17999',
  ]);
  assert.equal(client.calls.some((c) => c.kind === 'GET' && c.path === 'CONTAINER-1'), false, 'une photo ne doit pas attendre status_code');
  assert.equal(client.calls.filter((c) => c.path.endsWith('media_publish')).length, 1, 'une seule publication');
});

test('Reel video : attend FINISHED avant media_publish', async () => {
  const env = makeEnv();
  const client = makeClient({ statusSequence: ['IN_PROGRESS', 'FINISHED'] });
  const result = await publishDraft(env, client, readyVideoDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
  const kinds = client.calls.map((c) => `${c.kind} ${c.path}`);
  assert.deepEqual(kinds.slice(0, 4), [
    `POST ${USER}/media`,
    'GET CONTAINER-1',
    'GET CONTAINER-1',
    `POST ${USER}/media_publish`,
  ]);
});

test('Story image : conteneur STORIES et confirmation adaptee', async () => {
  const env = makeEnv();
  const client = makeClient({});
  const result = await publishDraft(env, client, readyDraft({ format: 'STORY' }), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
  const creation = client.calls.find((call) => call.kind === 'POST' && call.path.endsWith('/media'));
  assert.deepEqual(creation.fields, { media_type: 'STORIES', image_url: 'https://visuals.dakarstyle.com/visuals/social-intelligence/v5/media/2026/07/visuel.jpg' });
  const confirmation = client.calls.find((call) => call.kind === 'GET' && call.path === '17999');
  assert.equal(confirmation.params.fields, 'id,timestamp,media_product_type');
});

test('HTTP 200 a la creation du conteneur ne vaut pas publication', async () => {
  const env = makeEnv();
  const client = makeClient({ statusSequence: ['ERROR'] });
  const result = await publishDraft(env, client, readyVideoDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.FAILED);
  assert.equal(result.stage, PUBLISH_STAGE.PROCESSING);
  assert.equal(result.instagram_media_id, undefined, 'aucun identifiant : rien n a ete publie');
  assert.equal(client.calls.some((c) => c.path.endsWith('media_publish')), false, 'media_publish ne doit jamais etre appele');
});

test('PUBLISHED exige la confirmation finale, pas seulement media_publish', async () => {
  const env = makeEnv();
  const client = makeClient({ confirmationError: new MetaApiError(META_ERROR.SERVER_ERROR, { status: 500 }) });
  const result = await publishDraft(env, client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.REQUIRES_MANUAL_CHECK);
  assert.equal(result.error_code, PUBLISH_ERROR.NOT_CONFIRMED);
  assert.equal(result.stage, PUBLISH_STAGE.CONFIRMATION);
});

test('confirmation incoherente : jamais marque publie', async () => {
  const env = makeEnv();
  const client = makeClient({ confirmation: { id: 'UN-AUTRE-ID' } });
  const result = await publishDraft(env, client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.REQUIRES_MANUAL_CHECK);
  assert.equal(result.error_code, PUBLISH_ERROR.NOT_CONFIRMED);
});

/* ---------------- Aucun double publish ---------------- */

test('deuxieme appel identique : aucune republication, resultat existant renvoye', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  const first = await publishDraft(env, makeClient({}), draft, { ...noSleep, now: () => NOW });
  assert.equal(first.status, PUBLISH_STATUS.PUBLISHED);

  const secondClient = makeClient({});
  const second = await publishDraft(env, secondClient, draft, { ...noSleep, now: () => NOW });
  assert.equal(second.status, PUBLISH_STATUS.ALREADY_PUBLISHED);
  assert.equal(second.instagram_media_id, first.instagram_media_id);
  assert.equal(secondClient.calls.length, 0, 'aucun appel Meta lors du doublon');
});

test('double clic simultane : une seule publication part', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  const clientA = makeClient({});
  const clientB = makeClient({});
  const [a, b] = await Promise.all([
    publishDraft(env, clientA, draft, { ...noSleep, now: () => NOW }),
    publishDraft(env, clientB, draft, { ...noSleep, now: () => NOW }),
  ]);
  const publishCalls = [...clientA.calls, ...clientB.calls].filter((c) => c.path.endsWith('media_publish'));
  assert.equal(publishCalls.length, 1, 'media_publish ne doit partir qu une fois');
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [PUBLISH_STATUS.ALREADY_PUBLISHED, PUBLISH_STATUS.PUBLISHED].sort());
});

test('media_publish au resultat inconnu : verification humaine, jamais de rejeu', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  const client = makeClient({ publishError: new MetaApiError(META_ERROR.TIMEOUT, { status: 0 }) });
  const first = await publishDraft(env, client, draft, { ...noSleep, now: () => NOW });
  assert.equal(first.status, PUBLISH_STATUS.REQUIRES_MANUAL_CHECK);
  assert.equal(first.error_code, PUBLISH_ERROR.RESULT_UNKNOWN);

  // La reprise ne doit surtout pas republier.
  const retryClient = makeClient({});
  const retry = await publishDraft(env, retryClient, draft, { ...noSleep, now: () => NOW });
  assert.equal(retry.status, PUBLISH_STATUS.REQUIRES_MANUAL_CHECK);
  assert.equal(retryClient.calls.some((c) => c.path.endsWith('media_publish')), false);
});

test('echec avant media_publish : la reprise est autorisee car rien n a ete publie', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  const failing = makeClient({ containerError: new MetaApiError(META_ERROR.SERVER_ERROR, { status: 500 }) });
  const first = await publishDraft(env, failing, draft, { ...noSleep, now: () => NOW });
  assert.equal(first.status, PUBLISH_STATUS.FAILED);
  assert.equal(first.stage, PUBLISH_STAGE.CONTAINER);

  const retry = await publishDraft(env, makeClient({}), draft, { ...noSleep, now: () => NOW });
  assert.equal(retry.status, PUBLISH_STATUS.PUBLISHED, 'aucun risque de doublon : rien n avait ete publie');
});

test('la trace de tentative est ecrite AVANT media_publish', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  let recordAtPublish = null;
  const client = makeClient({});
  const wrapped = {
    ...client,
    isConfigured: () => true,
    request: client.request,
    async mutate(path, fields) {
      if (path.endsWith('/media_publish')) {
        const keys = [...env.VISUALS_BUCKET.s.keys()].filter((k) => k.includes('/idempotency/'));
        recordAtPublish = JSON.parse(env.VISUALS_BUCKET.s.get(keys[0]));
      }
      return client.mutate(path, fields);
    },
  };
  await publishDraft(env, wrapped, draft, { ...noSleep, now: () => NOW });
  assert.ok(recordAtPublish, 'une trace doit exister au moment de publier');
  assert.ok(recordAtPublish.result.publish_attempted_at, 'la tentative doit etre tracee avant l appel');
  assert.equal(recordAtPublish.result.creation_id, 'CONTAINER-1');
});

/* ---------------- Verrous amont ---------------- */

test('portail SAFE ferme : aucun appel Meta', async () => {
  const client = makeClient({});
  const result = await publishDraft(makeEnv({ SOWHAT_PUBLISH_ENABLED: 'false' }), client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.FAILED);
  assert.equal(result.stage, PUBLISH_STAGE.PREFLIGHT);
  assert.equal(client.calls.length, 0);
});

test('base publique de media absente : aucun appel Meta', async () => {
  const client = makeClient({});
  const result = await publishDraft(makeEnv({ SOWHAT_MEDIA_PUBLIC_BASE: '' }), client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.error_code, PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED);
  assert.equal(client.calls.length, 0);
});

test('client Meta non configure : echec propre en pre-vol', async () => {
  const result = await publishDraft(makeEnv(), makeClient({ configured: false }), readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.FAILED);
  assert.equal(result.error_code, META_ERROR.NOT_CONFIGURED);
});

test('sans exclusion mutuelle disponible : refus, jamais de publication a l aveugle', async () => {
  const env = makeEnv({ VISUALS_BUCKET: undefined });
  const client = makeClient({});
  const result = await publishDraft(env, client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.error_code, PUBLISH_ERROR.IDEMPOTENCY_UNAVAILABLE);
  assert.equal(client.calls.length, 0);
});

test('media_publish sans identifiant : echec, jamais PUBLISHED', async () => {
  const env = makeEnv();
  const client = makeClient({ mediaId: null });
  const result = await publishDraft(env, client, readyDraft(), { ...noSleep, now: () => NOW });
  assert.equal(result.status, PUBLISH_STATUS.FAILED);
  assert.equal(result.error_code, PUBLISH_ERROR.NO_MEDIA_ID);
});

/* ---------------- Raccord avec la machine a etats ---------------- */

test('le resultat s applique au Studio : PUBLISHED avec identifiant, FAILED avec cause', async () => {
  const env = makeEnv();
  const draft = readyDraft();
  const publishing = beginPublishing(env, draft, { now: NOW, jobId: 'JOB1' });
  assert.equal(publishing.state, STUDIO_STATE.PUBLISHING);

  const result = await publishDraft(env, makeClient({}), draft, { ...noSleep, now: () => NOW });
  const published = markPublished(publishing, result.instagram_media_id, { now: NOW });
  assert.equal(published.state, STUDIO_STATE.PUBLISHED);
  assert.equal(published.instagram_media_id, '17999');

  const failed = markFailed(publishing, { code: PUBLISH_ERROR.CONTAINER_ERROR, detail: 'x', stage: PUBLISH_STAGE.PROCESSING }, { now: NOW });
  assert.equal(failed.state, STUDIO_STATE.FAILED);
  assert.equal(failed.failure.stage, PUBLISH_STAGE.PROCESSING);
});

test('la cle d idempotence consigne l identifiant Meta confirme', async () => {
  const env = makeEnv();
  const result = await publishDraft(env, makeClient({}), readyDraft(), { ...noSleep, now: () => NOW });
  const record = await readIdempotencyRecord(env, result.idempotency_key);
  assert.equal(record.result.instagram_media_id, '17999');
  assert.equal(record.result.stage, PUBLISH_STAGE.CONFIRMATION);
});

/* ---------------- Le media televerse est bien celui que Meta ira chercher ---------------- */

test('la cle produite par le televersement compose une URL Meta valide', () => {
  const key = newMediaKey('image/jpeg');
  const url = mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://dakarstyle.com' }, key);
  assert.equal(url, `https://dakarstyle.com/${key}`);
  assert.ok(url.startsWith('https://'), 'Meta exige https');
  assert.ok(isV5PublicMediaPath(new URL(url).pathname), 'l URL doit tomber sur la route publique V5');
});

test('le chemin public sert reellement l objet que le televersement a ecrit', async () => {
  const store = new Map();
  const bucket = {
    async put(key, body, meta) { store.set(key, { body, meta }); return { key }; },
    async get(key) {
      if (!store.has(key)) return null;
      const entry = store.get(key);
      return { body: entry.body, size: 64, httpEtag: '"e"', httpMetadata: entry.meta?.httpMetadata || {} };
    },
  };
  const bytes = new Uint8Array(64);
  bytes.set([0xFF, 0xD8, 0xFF, 0xE0]);
  const form = new FormData();
  form.append('file', new File([bytes], 'a.jpg', { type: 'image/jpeg' }), 'a.jpg');
  const uploaded = await handleMediaUpload(
    new Request('https://dakarstyle.com/x', { method: 'POST', body: form }),
    { VISUALS_BUCKET: bucket },
  );
  assert.equal(uploaded.ok, true, uploaded.error);

  const url = mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://dakarstyle.com' }, uploaded.media.r2_key);
  const served = await serveV5Media(new Request(url), { VISUALS_BUCKET: bucket });
  assert.equal(served.status, 200, 'Meta doit pouvoir telecharger le fichier');
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
});

test('base media absente : refus en pre-vol, avant tout appel Meta', () => {
  for (const base of [undefined, '', '   ']) {
    assert.throws(
      () => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: base }, `${MEDIA_KEY_PREFIX}a.jpg`),
      (error) => error.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED,
      String(base),
    );
  }
});

test('base media non https ou avec port : refusee', () => {
  for (const base of ['http://dakarstyle.com', 'https://dakarstyle.com:8443', 'pas-une-url']) {
    assert.throws(
      () => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: base }, `${MEDIA_KEY_PREFIX}a.jpg`),
      (error) => error.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED,
      base,
    );
  }
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 publishing: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
