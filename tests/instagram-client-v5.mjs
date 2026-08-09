/**
 * SOWHAT Control V5 - Tests du client Meta Graph API.
 * Aucun appel reseau reel : fetch, horloge, attente et alea sont injectes.
 */

import assert from 'node:assert/strict';
import {
  META_ERROR,
  MetaApiError,
  classifyMetaError,
  createInstagramClient,
  isInstagramConfigured,
  readAppUsage,
  redactSecrets,
} from '../src/instagram-client-v5.js';

const TOKEN = 'EAAtokentresecretquilnefautjamaisvoirdanslogs';
const ENV = { INSTAGRAM_ACCESS_TOKEN: TOKEN, INSTAGRAM_USER_ID: '17841400000000000' };

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

function makeClient({ responses = [], env = ENV, ...rest } = {}) {
  const calls = [];
  const slept = [];
  const queue = [...responses];
  const fetchImpl = async (url) => {
    calls.push(url);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (typeof next === 'function') return next(url);
    // Un Response ne peut etre lu qu'une fois : on clone pour les rejeux.
    return next.clone();
  };
  const client = createInstagramClient(env, {
    fetchImpl,
    sleep: async (ms) => { slept.push(ms); },
    random: () => 0.5,
    now: () => 1_760_000_000_000,
    ...rest,
  });
  return { client, calls, slept };
}

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const metaError = (code, message, subcode) => ({ error: { code, message, error_subcode: subcode } });

/* ---------------- Configuration ---------------- */

test('client non configure : erreur stable, aucun appel reseau', async () => {
  const { client, calls } = makeClient({ env: {}, responses: [json(200, {})] });
  assert.equal(isInstagramConfigured({}), false);
  assert.equal(client.isConfigured(), false);
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.NOT_CONFIGURED);
  assert.equal(calls.length, 0);
});

test('token seul sans user id : non configure', () => {
  assert.equal(isInstagramConfigured({ INSTAGRAM_ACCESS_TOKEN: TOKEN }), false);
  assert.equal(isInstagramConfigured(ENV), true);
});

/* ---------------- Redaction ---------------- */

test('le token n est jamais restitue en clair', () => {
  assert.ok(!redactSecrets(`https://graph.facebook.com/v21.0/me?access_token=${TOKEN}`).includes(TOKEN));
  assert.ok(!redactSecrets(`{"access_token":"${TOKEN}"}`).includes(TOKEN));
  assert.ok(!redactSecrets(`Bearer ${TOKEN}`).includes(TOKEN));
  assert.ok(!redactSecrets(TOKEN).includes(TOKEN));
});

test('une erreur Meta ne fuit pas le token dans son detail', async () => {
  const { client } = makeClient({
    responses: [json(400, metaError(100, `jeton invalide : ${TOKEN}`))],
  });
  await assert.rejects(() => client.request('me'), (error) => {
    assert.ok(!error.detail.includes(TOKEN), 'le token fuit dans le detail');
    assert.ok(!JSON.stringify(error.toJSON()).includes(TOKEN), 'le token fuit dans le JSON');
    return true;
  });
});

/* ---------------- Classification des erreurs ---------------- */

test('classification des codes Meta', () => {
  assert.equal(classifyMetaError(400, metaError(190, 'expire')).code, META_ERROR.TOKEN_EXPIRED);
  assert.equal(classifyMetaError(400, metaError(100, 'x', 463)).code, META_ERROR.TOKEN_EXPIRED);
  assert.equal(classifyMetaError(401, {}).code, META_ERROR.UNAUTHORIZED);
  assert.equal(classifyMetaError(403, {}).code, META_ERROR.FORBIDDEN);
  assert.equal(classifyMetaError(400, metaError(10, 'permission')).code, META_ERROR.FORBIDDEN);
  assert.equal(classifyMetaError(429, {}).code, META_ERROR.RATE_LIMITED);
  assert.equal(classifyMetaError(400, metaError(4, 'trop d appels')).code, META_ERROR.RATE_LIMITED);
  assert.equal(classifyMetaError(404, {}).code, META_ERROR.NOT_FOUND);
  assert.equal(classifyMetaError(400, {}).code, META_ERROR.BAD_REQUEST);
  assert.equal(classifyMetaError(500, {}).code, META_ERROR.SERVER_ERROR);
  assert.equal(classifyMetaError(503, {}).code, META_ERROR.SERVER_ERROR);
});

test('seules les erreurs transitoires sont rejouables', () => {
  const retryable = [META_ERROR.RATE_LIMITED, META_ERROR.SERVER_ERROR, META_ERROR.TIMEOUT, META_ERROR.NETWORK];
  const fatal = [META_ERROR.UNAUTHORIZED, META_ERROR.TOKEN_EXPIRED, META_ERROR.FORBIDDEN, META_ERROR.BAD_REQUEST, META_ERROR.NOT_FOUND, META_ERROR.NOT_CONFIGURED];
  for (const code of retryable) assert.equal(new MetaApiError(code, {}).retryable, true, code);
  for (const code of fatal) assert.equal(new MetaApiError(code, {}).retryable, false, code);
});

/* ---------------- Rejeu ---------------- */

test('429 puis succes : rejeu avec repli exponentiel', async () => {
  const { client, calls, slept } = makeClient({
    responses: [json(429, metaError(4, 'limite')), json(429, metaError(4, 'limite')), json(200, { id: '42' })],
  });
  const payload = await client.request('me');
  assert.equal(payload.id, '42');
  assert.equal(calls.length, 3);
  assert.deepEqual(slept, [375, 750], 'le repli doit croitre exponentiellement');
});

test('500 rejoue puis abandonne apres le nombre maximal de tentatives', async () => {
  const { client, calls } = makeClient({ responses: [json(500, metaError(1, 'oops'))], maxAttempts: 3 });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.SERVER_ERROR);
  assert.equal(calls.length, 3);
});

test('403 n est jamais rejoue', async () => {
  const { client, calls } = makeClient({ responses: [json(403, metaError(10, 'permission'))] });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.FORBIDDEN);
  assert.equal(calls.length, 1, 'une erreur de permission ne doit pas etre rejouee');
});

test('401 n est jamais rejoue', async () => {
  const { client, calls } = makeClient({ responses: [json(401, {})] });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.UNAUTHORIZED);
  assert.equal(calls.length, 1);
});

test('timeout : classe en depassement et rejoue', async () => {
  const abort = () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  const { client, calls } = makeClient({ responses: [abort], maxAttempts: 2 });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.TIMEOUT);
  assert.equal(calls.length, 2);
});

test('panne reseau : classee et rejouee', async () => {
  const fail = () => { throw new TypeError('fetch failed'); };
  const { client, calls } = makeClient({ responses: [fail], maxAttempts: 2 });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.NETWORK);
  assert.equal(calls.length, 2);
});

/* ---------------- Limitation de debit ---------------- */

test('x-app-usage lu et respecte', () => {
  const headers = new Headers({ 'x-app-usage': '{"call_count":95,"total_cputime":12,"total_time":30}' });
  assert.equal(readAppUsage(headers), 95);
  assert.equal(readAppUsage(new Headers({})), null);
  assert.equal(readAppUsage(new Headers({ 'x-app-usage': 'pas-du-json' })), null);
});

test('usage eleve : pause avant l appel suivant', async () => {
  const { client, slept } = makeClient({
    responses: [json(200, { id: '1' }, { 'x-app-usage': '{"call_count":97}' })],
  });
  await client.request('me');
  assert.equal(client.stats().last_app_usage, 97);
  await client.request('me');
  assert.ok(slept.length >= 1, 'une pause doit precede l appel suivant quand le quota est presque atteint');
});

/* ---------------- Pagination ---------------- */

test('pagination bornee et complete', async () => {
  let page = 0;
  const { client } = makeClient({
    responses: [() => {
      page += 1;
      if (page < 3) return json(200, { data: [{ id: `m${page}` }], paging: { cursors: { after: `cur${page}` } } });
      return json(200, { data: [{ id: 'm3' }], paging: {} });
    }],
  });
  const result = await client.paginate('media', {}, { maxPages: 10, limit: 1 });
  assert.equal(result.items.length, 3);
  assert.equal(result.pages, 3);
  assert.equal(result.truncated, false);
});

test('pagination : plafond de pages respecte', async () => {
  const { client } = makeClient({
    responses: [json(200, { data: [{ id: 'x' }], paging: { cursors: { after: 'toujours' } } })],
  });
  const result = await client.paginate('media', {}, { maxPages: 2, limit: 1 });
  assert.equal(result.pages, 2, 'la pagination ne doit jamais depasser le plafond');
  assert.equal(result.truncated, true);
});

/* ---------------- Etat du jeton ---------------- */

test('etat du jeton : valide', async () => {
  const { client } = makeClient({ responses: [json(200, { id: '178414', username: 'sowhatafrika' })] });
  const health = await client.checkTokenHealth();
  assert.equal(health.status, 'valid');
  assert.equal(health.username, 'sowhatafrika');
});

test('etat du jeton : expire, invalide, permissions, non configure', async () => {
  const expired = await makeClient({ responses: [json(400, metaError(190, 'expire'))] }).client.checkTokenHealth();
  assert.equal(expired.status, 'expired');
  const invalid = await makeClient({ responses: [json(401, {})] }).client.checkTokenHealth();
  assert.equal(invalid.status, 'invalid');
  const denied = await makeClient({ responses: [json(403, {})] }).client.checkTokenHealth();
  assert.equal(denied.status, 'insufficient_permissions');
  const absent = await makeClient({ env: {}, responses: [json(200, {})] }).client.checkTokenHealth();
  assert.equal(absent.status, 'not_configured');
});

test('etat du jeton : indetermine plutot que devine', async () => {
  const { client } = makeClient({ responses: [json(500, {})], maxAttempts: 1 });
  const health = await client.checkTokenHealth();
  assert.equal(health.status, 'unknown', 'une panne serveur ne prouve pas que le jeton est invalide');
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL  ${name}\n        ${error.message}`);
  }
}
if (failures) {
  console.error(`\nSOWHAT V5 Meta client: ${failures} echec(s) sur ${cases.length}`);
  process.exit(1);
}
console.log(`\nSOWHAT V5 Meta client: PASS (${cases.length} scenarios)`);
