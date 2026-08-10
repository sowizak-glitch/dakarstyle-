/**
 * SOWHAT Control V5 - Tests du routage.
 * Aucun serveur reel : le handler est appele directement avec des Request.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  V5_API_PREFIX, V5_ROUTE_PREFIX, authorizeV5,
  handleSocialIntelligenceV5, isSocialIntelligenceV5Route,
} from '../src/social-intelligence-v5-routes.js';
import { issueCsrfToken } from '../src/security-v5.js';

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
}

const NOW = Date.parse('2026-07-01T12:00:00.000Z');
const ADMIN_KEY = 'cle-admin-de-test';
// sha256("cle-admin-de-test")
const ADMIN_HASH = await (async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ADMIN_KEY));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
})();
const CSRF_SECRET = 'un-secret-csrf-de-plus-de-trente-deux-caracteres';

function makeEnv(overrides = {}) {
  return {
    VISUALS_BUCKET: new Bucket(),
    SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256: ADMIN_HASH,
    SOCIAL_INTELLIGENCE_CSRF_SECRET: CSRF_SECRET,
    ...overrides,
  };
}

function req(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.auth !== false) headers.set('x-sowhat-admin-key', options.key ?? ADMIN_KEY);
  return new Request(`https://dakarstyle.com${path}`, { method: options.method || 'GET', headers });
}

const call = (env, request, options = {}) => handleSocialIntelligenceV5(request, env, null, { now: NOW, sink: () => {}, ...options });

/* ---------------- Espace de noms ---------------- */

test('la V5 ne capte que son propre espace de noms', () => {
  const v5 = (p) => isSocialIntelligenceV5Route(new URL(`https://dakarstyle.com${p}`));
  assert.equal(v5(V5_ROUTE_PREFIX), true);
  assert.equal(v5(`${V5_ROUTE_PREFIX}/quoi-que-ce-soit`), true);
  assert.equal(v5(`${V5_API_PREFIX}cockpit`), true);
  assert.equal(v5('/social-intelligence'), false, 'la V4 ne doit pas etre captee');
  assert.equal(v5('/api/social-intelligence/health'), false);
  assert.equal(v5('/api/social-intelligence/publish/commit'), false);
  assert.equal(v5('/visuals/quelque-chose.jpg'), false);
});

test('le routeur place la V5 avant la V4 sans modifier ses routes', () => {
  const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
  assert.ok(router.indexOf('isSocialIntelligenceV5Route') < router.indexOf('isSocialIntelligenceRoute(url)'));
  assert.ok(router.includes('handleSocialIntelligenceV3'), 'la V4 reste routee');
  assert.ok(router.includes('socialIntelligenceSecurityReady'), 'la V5 passe par la meme garde de configuration');
});

/* ---------------- Autorisation ---------------- */

test('sans cle : refus, aucune donnee', async () => {
  const response = await call(makeEnv(), req(`${V5_API_PREFIX}cockpit`, { auth: false }));
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.cockpit, undefined);
});

test('mauvaise cle : refus', async () => {
  const response = await call(makeEnv(), req(`${V5_API_PREFIX}cockpit`, { key: 'mauvaise-cle' }));
  assert.equal(response.status, 401);
});

test('condensat non configure : fail closed, pas de mode ouvert', async () => {
  for (const value of [undefined, '', 'pas-un-condensat', 'ABC']) {
    const env = makeEnv({ SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256: value });
    const result = await authorizeV5(req(`${V5_API_PREFIX}cockpit`), env);
    assert.equal(result.ok, false, String(value));
    assert.equal(result.status, 503, String(value));
  }
});

/* ---------------- CSRF sur les ecritures ---------------- */

test('ecriture sans jeton CSRF : refus', async () => {
  const env = makeEnv({ INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' });
  for (const path of [`${V5_API_PREFIX}sync`, `${V5_API_PREFIX}scheduler/run`]) {
    const response = await call(env, req(path, { method: 'POST' }));
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).error, 'csrf_invalid', path);
  }
});

test('ecriture avec jeton CSRF valide : acceptee', async () => {
  const env = makeEnv({ INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const response = await call(env, req(`${V5_API_PREFIX}scheduler/run`, {
    method: 'POST', headers: { 'x-sowhat-csrf': token, 'x-sowhat-session': 'v5-admin' },
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.run.run_id);
});

test('un jeton CSRF d une autre session ne passe pas', async () => {
  const env = makeEnv({ INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' });
  const token = await issueCsrfToken(env, 'une-autre-session', NOW);
  const response = await call(env, req(`${V5_API_PREFIX}sync`, {
    method: 'POST', headers: { 'x-sowhat-csrf': token, 'x-sowhat-session': 'v5-admin' },
  }));
  assert.equal(response.status, 403);
});

test('methode inadaptee refusee', async () => {
  const env = makeEnv();
  assert.equal((await call(env, req(`${V5_API_PREFIX}cockpit`, { method: 'POST' }))).status, 405);
  assert.equal((await call(env, req(`${V5_API_PREFIX}sync`, { method: 'GET' }))).status, 405);
});

/* ---------------- Reponses ---------------- */

test('cockpit HTML : en-tetes de securite et CSP stricte', async () => {
  const response = await call(makeEnv(), req(V5_ROUTE_PREFIX));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('x-robots-tag').includes('noindex'));
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp.includes("default-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(!csp.includes('script-src'), 'aucun script n est autorise du tout');
  const body = await response.text();
  assert.ok(body.includes('SOWHAT Control V5'));
  assert.ok(!/<script/i.test(body));
});

test('cockpit vide : etat honnete, aucune valeur inventee', async () => {
  const response = await call(makeEnv(), req(`${V5_API_PREFIX}cockpit`));
  const { cockpit } = await response.json();
  assert.equal(cockpit.instagram.configured, false);
  assert.equal(cockpit.sync.last_run, null);
  assert.equal(cockpit.sync.known_media_count, null);
  assert.equal(cockpit.publication.queue_size, 0);
});

test('intelligence et plan : reponses coherentes sur corpus vide', async () => {
  const env = makeEnv();
  const intelligence = await (await call(env, req(`${V5_API_PREFIX}intelligence`))).json();
  assert.equal(intelligence.records_count, 0);
  assert.equal(intelligence.briefing.status, 'insufficient_data');
  assert.deepEqual(intelligence.correlations, []);

  const plan = await (await call(env, req(`${V5_API_PREFIX}plan`))).json();
  assert.equal(plan.plan.status, 'no_evidence');
  assert.equal(plan.plan.days.length, 7);
});

test('file de publication et historique de compte exposes', async () => {
  const env = makeEnv();
  const queue = await (await call(env, req(`${V5_API_PREFIX}queue`))).json();
  assert.deepEqual(queue.queue, []);
  const history = await (await call(env, req(`${V5_API_PREFIX}account-history`))).json();
  assert.deepEqual(history.history, []);
});

test('Instagram non configure : ecriture refusee proprement', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const response = await call(env, req(`${V5_API_PREFIX}sync`, {
    method: 'POST', headers: { 'x-sowhat-csrf': token },
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'meta_not_configured');
});

test('chemin inconnu dans l espace V5 : 404 avec identifiant de requete', async () => {
  const response = await call(makeEnv(), req(`${V5_API_PREFIX}inexistant`));
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.ok(body.request_id.startsWith('REQ-'));
});

test('toute reponse porte un identifiant de correlation', async () => {
  for (const path of [`${V5_API_PREFIX}cockpit`, `${V5_API_PREFIX}queue`, `${V5_API_PREFIX}plan`]) {
    const body = await (await call(makeEnv(), req(path))).json();
    assert.ok(body.request_id, path);
  }
});

test('aucun secret dans les reponses', async () => {
  const env = makeEnv({ INSTAGRAM_ACCESS_TOKEN: 'EAAtokentresecretquilnefautjamaisvoir', INSTAGRAM_USER_ID: '178' });
  for (const path of [`${V5_API_PREFIX}cockpit`, `${V5_API_PREFIX}intelligence`, `${V5_API_PREFIX}plan`]) {
    const text = await (await call(env, req(path))).text();
    assert.ok(!text.includes('EAAtokentresecret'), path);
    assert.ok(!text.includes(ADMIN_HASH), path);
  }
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 routes: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
