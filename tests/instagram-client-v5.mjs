/**
 * SOWHAT Control V5 - Tests du client Meta Graph API.
 * Aucun appel reseau reel : fetch, horloge, attente et alea sont injectes.
 */

import assert from 'node:assert/strict';
import {
  META_ALLOWED_HOSTS,
  META_ERROR,
  MetaApiError,
  classifyMetaError,
  createInstagramClient,
  isAllowedMetaOrigin,
  isInstagramConfigured,
  readAppUsage,
  resolveGraphOrigin,
  resolveApiFlow,
  resolveTokenTransport,
  redactSecrets,
  META_API_FLOW,
  META_FLOW_PROFILE,
  DEFAULT_META_API_FLOW,
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

test('401 : erreur d authentification reelle, aucun rejeu, aucune bascule', async () => {
  const { client, calls, slept } = makeClient({ responses: [json(401, {})] });
  await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.UNAUTHORIZED);
  assert.equal(calls.length, 1, 'un 401 est definitif : le transport ne se decouvre pas a l execution');
  assert.ok(!calls[0].includes('access_token='), 'flux instagram_login : le token reste dans l en-tete');
  assert.deepEqual(slept, [], 'aucune attente : rien n est rejoue');
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

/* ---------------- Transport du credential : deterministe ---------------- */

test('flux par defaut : Instagram Login, en-tete Bearer, graph.instagram.com', () => {
  assert.equal(DEFAULT_META_API_FLOW, META_API_FLOW.INSTAGRAM_LOGIN);
  assert.equal(resolveApiFlow({}), META_API_FLOW.INSTAGRAM_LOGIN);
  assert.equal(resolveTokenTransport({}), 'header');
  assert.equal(resolveGraphOrigin({}), 'https://graph.instagram.com');
  assert.equal(META_FLOW_PROFILE[META_API_FLOW.FACEBOOK_LOGIN].transport, 'query');
  assert.equal(META_FLOW_PROFILE[META_API_FLOW.FACEBOOK_LOGIN].origin, 'https://graph.facebook.com');
});

test('flux Instagram Login : le token voyage en en-tete, jamais dans l URL', async () => {
  const captured = [];
  const client = createInstagramClient(ENV, {
    fetchImpl: async (url, init) => { captured.push({ url, init }); return json(200, { id: '1' }); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  await client.request('me');
  assert.equal(captured.length, 1);
  assert.ok(!captured[0].url.includes('access_token='), 'le token ne doit pas figurer dans l URL');
  assert.ok(!captured[0].url.includes(TOKEN), 'le token ne doit apparaitre nulle part dans l URL');
  assert.equal(captured[0].init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(client.stats().transport, 'header');
  assert.equal(client.stats().flow, META_API_FLOW.INSTAGRAM_LOGIN);
});

test('flux Facebook Login : le token voyage en parametre de requete, sans en-tete', async () => {
  const captured = [];
  const env = { ...ENV, INSTAGRAM_API_FLOW: 'facebook_login' };
  const client = createInstagramClient(env, {
    fetchImpl: async (url, init) => { captured.push({ url, init }); return json(200, { id: '1' }); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  await client.request('me');
  assert.ok(captured[0].url.startsWith('https://graph.facebook.com/'), 'hote conforme au flux');
  assert.ok(captured[0].url.includes('access_token='), 'flux documente avec access_token en query');
  assert.equal(captured[0].init.headers.authorization, undefined, 'pas de double transport');
  assert.equal(client.stats().transport, 'query');
});

test('un 401 ne fait jamais changer de transport, quel que soit le flux', async () => {
  for (const flow of [META_API_FLOW.INSTAGRAM_LOGIN, META_API_FLOW.FACEBOOK_LOGIN]) {
    const urls = [];
    const client = createInstagramClient({ ...ENV, INSTAGRAM_API_FLOW: flow }, {
      fetchImpl: async (url) => { urls.push(url); return json(401, metaError(190, 'jeton refuse')); },
      sleep: async () => {}, random: () => 0.5, now: () => 0,
    });
    await assert.rejects(() => client.request('me'), (e) => e.code === META_ERROR.TOKEN_EXPIRED);
    assert.equal(urls.length, 1, `${flow} : un seul appel, aucune tentative d autre transport`);
    const withToken = urls[0].includes('access_token=');
    assert.equal(withToken, flow === META_API_FLOW.FACEBOOK_LOGIN, `${flow} : transport inchange`);
    assert.equal(client.stats().transport, META_FLOW_PROFILE[flow].transport);
  }
});

test('surcharge explicite du transport : possible par configuration, jamais par decouverte', async () => {
  const captured = [];
  const client = createInstagramClient({ ...ENV, INSTAGRAM_TOKEN_TRANSPORT: 'query' }, {
    fetchImpl: async (url, init) => { captured.push({ url, init }); return json(200, { id: '1' }); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  await client.request('me');
  assert.ok(captured[0].url.includes('access_token='));
  assert.equal(captured[0].init.headers.authorization, undefined);
  assert.equal(resolveTokenTransport({ INSTAGRAM_TOKEN_TRANSPORT: 'header', INSTAGRAM_API_FLOW: 'facebook_login' }), 'header');
});

test('flux ou transport invalide : le client refuse de se construire', () => {
  assert.throws(() => resolveApiFlow({ INSTAGRAM_API_FLOW: 'devine' }), (e) => e.code === META_ERROR.INVALID_FLOW);
  assert.throws(() => resolveTokenTransport({ INSTAGRAM_TOKEN_TRANSPORT: 'cookie' }), (e) => e.code === META_ERROR.INVALID_FLOW);
  assert.throws(
    () => createInstagramClient({ ...ENV, INSTAGRAM_API_FLOW: 'auto' }, { fetchImpl: async () => json(200, {}) }),
    (e) => e.code === META_ERROR.INVALID_FLOW,
  );
});

test('hote incoherent avec le flux : refuse', () => {
  assert.throws(
    () => resolveGraphOrigin({ INSTAGRAM_GRAPH_BASE: 'https://graph.facebook.com' }, META_API_FLOW.INSTAGRAM_LOGIN),
    (e) => e.code === META_ERROR.INVALID_ENDPOINT,
  );
  assert.equal(
    resolveGraphOrigin({ INSTAGRAM_GRAPH_BASE: 'https://graph.facebook.com' }, META_API_FLOW.FACEBOOK_LOGIN),
    'https://graph.facebook.com',
  );
});

/* ---------------- Ecritures : aucun rejeu aveugle ---------------- */

test('ecriture : le credential ne circule jamais dans l URL', async () => {
  for (const flow of [META_API_FLOW.INSTAGRAM_LOGIN, META_API_FLOW.FACEBOOK_LOGIN]) {
    const captured = [];
    const client = createInstagramClient({ ...ENV, INSTAGRAM_API_FLOW: flow }, {
      fetchImpl: async (url, init) => { captured.push({ url, init }); return json(200, { id: 'container_1' }); },
      sleep: async () => {}, random: () => 0.5, now: () => 0,
    });
    const out = await client.mutate('17841400000000000/media', { caption: 'test' });
    assert.equal(out.id, 'container_1');
    assert.equal(captured[0].init.method, 'POST');
    assert.ok(!captured[0].url.includes('access_token='), `${flow} : pas de token dans l URL d une ecriture`);
    assert.ok(!captured[0].url.includes(TOKEN), `${flow} : pas de token dans l URL`);
    assert.ok(captured[0].init.body.includes('caption=test'));
    if (flow === META_API_FLOW.FACEBOOK_LOGIN) {
      assert.ok(captured[0].init.body.includes('access_token='), 'flux query : credential dans le corps');
    } else {
      assert.equal(captured[0].init.headers.authorization, `Bearer ${TOKEN}`);
      assert.ok(!captured[0].init.body.includes('access_token='));
    }
  }
});

test('ecriture : un 500 n est jamais rejoue (creation potentiellement aboutie)', async () => {
  let calls = 0;
  const client = createInstagramClient(ENV, {
    fetchImpl: async () => { calls += 1; return json(500, metaError(1, 'boom')); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  await assert.rejects(() => client.mutate('me/media', { caption: 'x' }), (e) => e.code === META_ERROR.SERVER_ERROR);
  assert.equal(calls, 1, 'un POST ambigu ne doit jamais etre rejoue a l aveugle');
});

test('ecriture : un timeout et une panne reseau ne sont jamais rejoues', async () => {
  for (const failure of [
    () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; },
    () => { throw new Error('connexion perdue'); },
  ]) {
    let calls = 0;
    const client = createInstagramClient(ENV, {
      fetchImpl: async () => { calls += 1; return failure(); },
      sleep: async () => {}, random: () => 0.5, now: () => 0,
    });
    await assert.rejects(() => client.mutate('me/media', { caption: 'x' }));
    assert.equal(calls, 1, 'aucun rejeu sur une ecriture au resultat inconnu');
  }
});

test('ecriture : un 429 est rejouable car Meta a rejete sans traiter', async () => {
  let calls = 0;
  const client = createInstagramClient(ENV, {
    fetchImpl: async () => { calls += 1; return calls === 1 ? json(429, metaError(4, 'quota')) : json(200, { id: 'ok' }); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  const out = await client.mutate('me/media', { caption: 'x' });
  assert.equal(out.id, 'ok');
  assert.equal(calls, 2);
});

test('ecriture : un 401 est definitif', async () => {
  let calls = 0;
  const client = createInstagramClient(ENV, {
    fetchImpl: async () => { calls += 1; return json(401, {}); },
    sleep: async () => {}, random: () => 0.5, now: () => 0,
  });
  await assert.rejects(() => client.mutate('me/media', {}), (e) => e.code === META_ERROR.UNAUTHORIZED);
  assert.equal(calls, 1);
});

/* ---------------- Durcissement : allowlist d hotes ---------------- */

test('hotes Meta officiels acceptes', () => {
  assert.deepEqual([...META_ALLOWED_HOSTS], ['graph.facebook.com', 'graph.instagram.com']);
  assert.equal(isAllowedMetaOrigin('https://graph.facebook.com'), true);
  assert.equal(isAllowedMetaOrigin('https://graph.instagram.com'), true);
  assert.equal(resolveGraphOrigin({ INSTAGRAM_GRAPH_BASE: 'https://graph.instagram.com' }), 'https://graph.instagram.com');
  assert.equal(resolveGraphOrigin({}), 'https://graph.instagram.com');
});

test('hote arbitraire refuse : fail closed, pas de repli silencieux', () => {
  for (const origin of [
    'https://evil.example.com',
    'https://graph.facebook.com.evil.example.com',
    'https://evilgraph.facebook.com.attacker.net',
    'https://graph.facebook.com:8443',
  ]) {
    assert.equal(isAllowedMetaOrigin(origin), false, origin);
    assert.throws(
      () => resolveGraphOrigin({ INSTAGRAM_GRAPH_BASE: origin }),
      (e) => e.code === META_ERROR.INVALID_ENDPOINT,
      `${origin} aurait du etre refuse`,
    );
  }
});

test('http en clair refuse', () => {
  assert.equal(isAllowedMetaOrigin('http://graph.instagram.com'), false);
  assert.throws(
    () => resolveGraphOrigin({ INSTAGRAM_GRAPH_BASE: 'http://graph.instagram.com' }),
    (e) => e.code === META_ERROR.INVALID_ENDPOINT,
  );
});

test('mauvaise configuration : le client refuse de se construire', () => {
  assert.throws(
    () => createInstagramClient({ ...ENV, INSTAGRAM_GRAPH_BASE: 'https://exfiltration.example.com' }, {
      fetchImpl: async () => json(200, {}),
    }),
    (e) => e.code === META_ERROR.INVALID_ENDPOINT,
    'un mauvais parametrage doit etre bruyant, pas discret',
  );
});

test('une origine de test ne peut pas etre ouverte par l environnement', () => {
  // testOrigin exige un fetch injecte : la production, qui utilise le fetch
  // global, ne peut pas l activer, meme si la variable existait.
  const production = createInstagramClient(ENV, { testOrigin: 'https://localhost:9999' });
  assert.equal(production.graphOrigin, 'https://graph.instagram.com');
  const underTest = createInstagramClient(ENV, {
    testOrigin: 'https://localhost:9999',
    fetchImpl: async () => json(200, {}),
  });
  assert.equal(underTest.graphOrigin, 'https://localhost:9999');
});

/* ---------------- Durcissement : redirections ---------------- */

test('redirection refusee : le credential n est jamais reenvoye ailleurs', async () => {
  const inits = [];
  const client = createInstagramClient(ENV, {
    fetchImpl: async (url, init) => {
      inits.push(init);
      return new Response('', { status: 302, headers: { location: 'https://evil.example.com/steal' } });
    },
    sleep: async () => {}, random: () => 0.5, now: () => 0, maxAttempts: 1,
  });
  await assert.rejects(() => client.request('me'), (error) => {
    assert.equal(error.code, META_ERROR.UNSAFE_REDIRECT);
    assert.ok(!error.detail.includes(TOKEN));
    return true;
  });
  assert.equal(inits[0].redirect, 'manual', 'les redirections ne doivent jamais etre suivies automatiquement');
});

/* ---------------- Durcissement : aucune fuite dans les evenements ---------------- */

test('aucun evenement d instrumentation ne contient le token', async () => {
  const events = [];
  const client = createInstagramClient(ENV, {
    fetchImpl: async () => json(429, metaError(4, `quota depasse pour ${TOKEN}`)),
    sleep: async () => {}, random: () => 0.5, now: () => 0, maxAttempts: 2,
    onEvent: (event) => events.push(event),
  });
  await assert.rejects(() => client.request('me'));
  assert.ok(events.length > 0, 'des evenements doivent etre emis');
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes(TOKEN), 'le token fuit dans les evenements');
  assert.ok(!serialized.includes('access_token='), 'un parametre de token fuit dans les evenements');
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
