/**
 * SOWHAT Control - Tests de comportement (V4)
 *
 * Ces tests exercent reellement le Worker : session, CSRF, garde SAFE,
 * expiration du preview, modification apres preview, idempotence sous
 * concurrence, etats de publication, capture de l'ID media Instagram et
 * bibliotheque R2.
 *
 * Le Bridge n8n de production n'est JAMAIS appele : `fetch` est remplace par
 * un double de test qui enregistre chaque appel.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleSocialIntelligenceV3 } from '../src/social-intelligence-v3.js';

const ORIGIN = 'https://dakarstyle.com';
const PASSWORD = 'mot-de-passe-de-test';
const PASSWORD_SHA256 = createHash('sha256').update(PASSWORD).digest('hex');
const BRIDGE_URL = 'https://n8n.sowhatafrica.com/webhook/sowhat-visual-factory-v4-instagram-safe';

const results = [];
function check(name, fn) {
  results.push({ name, fn });
}

/* ---------------------------------------------------------------- */
/* Doubles de test                                                    */
/* ---------------------------------------------------------------- */

class MemoryBucket {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    if (!this.store.has(key)) return null;
    const body = this.store.get(key);
    return { text: async () => body };
  }

  async put(key, value, options = {}) {
    if (options?.onlyIf?.etagDoesNotMatch === '*' && this.store.has(key)) return null;
    this.store.set(key, String(value));
    return { key };
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000 } = {}) {
    const objects = [...this.store.keys()]
      .filter((key) => key.startsWith(prefix))
      .slice(0, limit)
      .map((key) => ({ key, uploaded: this.uploadedAt(key) }));
    return { objects, truncated: false };
  }

  uploadedAt(key) {
    return this.uploads?.get(key) || new Date('2026-08-01T10:00:00Z').toISOString();
  }

  seedMedia(name, uploaded) {
    this.uploads = this.uploads || new Map();
    const key = `visuals/media/${name}`;
    this.store.set(key, 'binary');
    this.uploads.set(key, uploaded);
  }

  seedManifest(assetId, payload) {
    this.store.set(`visuals/manifest/${assetId}.json`, JSON.stringify(payload));
  }

  readJson(key) {
    const raw = this.store.get(key);
    return raw ? JSON.parse(raw) : null;
  }
}

function makeEnv(overrides = {}) {
  return {
    VISUALS_BUCKET: new MemoryBucket(),
    SOCIAL_INTELLIGENCE_LOGIN_USER: 'sowhat',
    SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256: PASSWORD_SHA256,
    SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256: 'a'.repeat(64),
    SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256: 'b'.repeat(64),
    SOWHAT_INSTAGRAM_BRIDGE_URL: BRIDGE_URL,
    ...overrides,
  };
}

function installBridge({ status = 200, body = '{"ok":true,"id":"17925103847562901"}' } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(body, { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

/* ---------------------------------------------------------------- */
/* Helpers de requete                                                 */
/* ---------------------------------------------------------------- */

async function login(env) {
  const form = new URLSearchParams({ username: 'sowhat', password: PASSWORD });
  const response = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }), env, {});
  assert.equal(response.status, 303, 'la connexion valide doit rediriger');
  const cookie = response.headers.get('set-cookie') || '';
  const token = cookie.split(';')[0];
  assert.ok(token.startsWith('__Host-sowhat_si='), 'cookie de session __Host- attendu');

  const page = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence`, {
    headers: { cookie: token },
  }), env, {});
  const markup = await page.text();
  const csrf = markup.match(/var CSRF = "([^"]+)"/)?.[1];
  assert.ok(csrf, 'jeton CSRF introuvable dans le cockpit');
  return { cookie: token, csrf, markup, headers: page.headers };
}

function publishRequest(mode, session, payload) {
  return new Request(`${ORIGIN}/api/social-intelligence/publish/${mode}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: session.cookie,
      'X-SOWHAT-CSRF': session.csrf,
    },
    body: JSON.stringify(payload),
  });
}

function validPost(overrides = {}) {
  return {
    publication_type: 'POST IMAGE',
    media_url: 'https://dakarstyle.com/visuals/media/look-01.jpg',
    caption: 'Nouvelle piece de la collection.',
    hashtags: '#SowhatAfrica',
    alt_text: 'Un mannequin porte une chemise SOWHAT.',
    title: 'Look 01',
    collection: 'Summer',
    idempotency_key: 'test-key-0001',
    ...overrides,
  };
}

async function body(response) {
  return response.json();
}

/* ---------------------------------------------------------------- */
/* Tests                                                              */
/* ---------------------------------------------------------------- */

check('session privee, CSRF et en-tetes de securite', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);

  const csp = session.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'nonce-[A-Za-z0-9_-]{8,}'/, 'CSP a nonce attendue sur le script');
  assert.match(csp, /style-src 'nonce-[A-Za-z0-9_-]{8,}'/, 'CSP a nonce attendue sur le style');
  assert.ok(!csp.includes('unsafe-inline'), "la CSP ne doit plus contenir 'unsafe-inline'");
  assert.equal(session.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
  assert.equal(session.headers.get('x-frame-options'), 'DENY');

  const nonce = csp.match(/script-src 'nonce-([A-Za-z0-9_-]+)'/)[1];
  assert.ok(session.markup.includes(`<script nonce="${nonce}">`), 'le script doit porter le nonce de la reponse');
  assert.ok(!/ style="/.test(session.markup), 'aucun attribut style= en ligne ne doit subsister');
});

check('mot de passe de recuperation devient persistant', async () => {
  const recoveryPassword = 'recuperation-test-seulement';
  const recoveryHash = createHash('sha256').update(recoveryPassword).digest('hex');
  const env = makeEnv({ SOCIAL_INTELLIGENCE_RECOVERY_PASSWORD_SHA256: recoveryHash });
  installBridge();
  const form = new URLSearchParams({ username: 'sowhat', password: recoveryPassword });
  const first = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/login`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }), env, {});
  assert.equal(first.status, 303);
  const stored = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/auth/login-password.json');
  assert.equal(stored.password_sha256, recoveryHash);
  delete env.SOCIAL_INTELLIGENCE_RECOVERY_PASSWORD_SHA256;
  env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256 = '0'.repeat(64);
  const second = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/login`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }), env, {});
  assert.equal(second.status, 303);
});

check('acces refuse sans session', async () => {
  const env = makeEnv();
  installBridge();
  const response = await handleSocialIntelligenceV3(
    publishRequest('preview', { cookie: '', csrf: 'x' }, validPost()),
    env, {},
  );
  assert.equal(response.status, 401);
  assert.equal((await body(response)).error, 'unauthorized');
});

check('CSRF obligatoire sur la publication', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(
    publishRequest('preview', { cookie: session.cookie, csrf: 'jeton-invalide' }, validPost()),
    env, {},
  );
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error, 'csrf_rejected');
});

check('URL media non HTTPS refusee', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(
    publishRequest('preview', session, validPost({ media_url: 'http://dakarstyle.com/visuals/media/look-01.jpg' })),
    env, {},
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, 'public_https_media_url_required');
  assert.equal(calls.length, 0, 'le Bridge ne doit jamais etre appele sur une URL invalide');
});

check('contrat SAFE du preview : dry_run=true / approved=false', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});
  assert.equal(response.status, 200);

  const payload = await body(response);
  assert.equal(payload.state, 'SAFE VALIDE');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BRIDGE_URL, "l'URL du webhook n8n ne doit pas changer");
  assert.equal(calls[0].body.source_workflow, 'SOWHAT — Visual Factory V4');
  assert.equal(calls[0].body.dry_run, true);
  assert.equal(calls[0].body.approved, false);

  const history = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/publications.json');
  assert.equal(history[0].state, 'SAFE VALIDE');
});

check('publication refusee sans test SAFE prealable', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, 'preview_required_or_expired');
  assert.equal(calls.length, 0, 'aucune publication reelle ne doit partir sans preview');
});

check('confirmation explicite obligatoire', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});
  const response = await handleSocialIntelligenceV3(
    publishRequest('commit', session, validPost()),
    env, {},
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, 'explicit_confirmation_required');
});

check('modification du contenu apres le preview : publication bloquee', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  const modified = { ...validPost({ caption: 'Legende modifiee apres le test SAFE.' }), confirmed: true };
  const response = await handleSocialIntelligenceV3(publishRequest('commit', session, modified), env, {});
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, 'preview_required_or_expired');
  assert.equal(calls.length, 1, 'seul le preview initial a atteint le Bridge');
});

check('changement de media apres le preview : publication bloquee', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  const swapped = { ...validPost({ media_url: 'https://dakarstyle.com/visuals/media/autre.jpg' }), confirmed: true };
  const response = await handleSocialIntelligenceV3(publishRequest('commit', session, swapped), env, {});
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, 'preview_required_or_expired');
});

check('expiration du preview au-dela de 30 minutes', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  const sessionKey = [...env.VISUALS_BUCKET.store.keys()]
    .find((key) => key.startsWith('visuals/social-intelligence/sessions/'));
  const stored = env.VISUALS_BUCKET.readJson(sessionKey);
  stored.last_preview_at = Date.now() - (31 * 60 * 1000);
  env.VISUALS_BUCKET.store.set(sessionKey, JSON.stringify(stored));

  const response = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, 'preview_required_or_expired');
});

check('publication reelle : etat PUBLIE et ID media Instagram capture', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  const response = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );
  assert.equal(response.status, 200);

  const payload = await body(response);
  assert.equal(payload.state, 'PUBLIE');
  assert.equal(payload.instagram_media_id, '17925103847562901');

  const commitCall = calls[1];
  assert.equal(commitCall.body.dry_run, false);
  assert.equal(commitCall.body.approved, true);
  assert.equal(commitCall.body.source_workflow, 'SOWHAT — Visual Factory V4');

  const history = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/publications.json');
  const published = history.find((row) => row.state === 'PUBLIE');
  assert.ok(published, 'une ligne PUBLIE doit exister dans l historique');
  assert.equal(published.instagram_media_id, '17925103847562901');
  assert.ok(published.completed_at, 'la ligne publiee doit porter une date de fin');

  const memory = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/memory.json');
  assert.equal(memory.formats['POST IMAGE'].published, 1);
  assert.equal(memory.formats['POST IMAGE'].avg_score, null, 'aucun score ne doit etre invente a la publication');
});

check('idempotence : rejeu de la meme cle ne republie pas', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});
  await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );
  const bridgeCallsAfterFirst = calls.length;

  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});
  const replay = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );

  const payload = await body(replay);
  assert.equal(replay.status, 200);
  assert.equal(payload.duplicate, true, 'le rejeu doit etre signale comme doublon');
  assert.equal(payload.instagram_media_id, '17925103847562901');
  assert.equal(
    calls.length,
    bridgeCallsAfterFirst + 1,
    'seul le preview du rejeu atteint le Bridge, aucune seconde publication',
  );
});

check('idempotence : deux publications concurrentes, une seule atteint le Bridge', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});
  const previewCalls = calls.length;

  const payload = { ...validPost(), confirmed: true };
  const [first, second] = await Promise.all([
    handleSocialIntelligenceV3(publishRequest('commit', session, payload), env, {}),
    handleSocialIntelligenceV3(publishRequest('commit', session, payload), env, {}),
  ]);

  const commitCalls = calls.length - previewCalls;
  assert.equal(commitCalls, 1, 'un double clic concurrent ne doit produire qu un seul appel de publication');

  const statuses = [first.status, second.status].sort();
  assert.deepEqual(statuses, [200, 409], 'une requete publie, l autre est refusee');

  const rejected = first.status === 409 ? first : second;
  assert.equal((await body(rejected)).error, 'publication_already_in_flight');
});

check('echec du Bridge : etat ECHEC et nouvelle tentative autorisee', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  installBridge({ status: 500, body: 'workflow error' });
  const failed = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost(), confirmed: true }),
    env, {},
  );
  assert.equal(failed.status, 502);
  assert.equal((await body(failed)).error, 'bridge_rejected');

  const history = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/publications.json');
  assert.equal(history[0].state, 'ECHEC');

  const claim = [...env.VISUALS_BUCKET.store.keys()]
    .some((key) => key.startsWith('visuals/social-intelligence/idempotency/'));
  assert.equal(claim, false, 'la reservation doit etre liberee pour permettre une nouvelle tentative');
});

check('validation refusee en commit : ligne BROUILLON tracee', async () => {
  const env = makeEnv();
  const calls = installBridge();
  const session = await login(env);
  await handleSocialIntelligenceV3(publishRequest('preview', session, validPost()), env, {});

  const response = await handleSocialIntelligenceV3(
    publishRequest('commit', session, { ...validPost({ caption: '' }), confirmed: true }),
    env, {},
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, 'caption_required');
  assert.equal(calls.length, 1, 'aucun appel Bridge supplementaire');

  const history = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/publications.json');
  assert.equal(history[0].state, 'BROUILLON');
});

check('Reel : seule une video MP4/MOV est acceptee', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(
    publishRequest('preview', session, validPost({ publication_type: 'REEL' })),
    env, {},
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, 'reel_requires_public_mp4_or_mov');
});

check('bibliotheque R2 : visuels reels listes, aucun fichier duplique', async () => {
  const env = makeEnv();
  installBridge();
  env.VISUALS_BUCKET.seedMedia('look-01.jpg', '2026-08-05T10:00:00Z');
  env.VISUALS_BUCKET.seedMedia('reel-02.mp4', '2026-08-07T10:00:00Z');
  env.VISUALS_BUCKET.seedMedia('notes.txt', '2026-08-08T10:00:00Z');
  env.VISUALS_BUCKET.seedManifest('look-01', { title: 'Look 01', collection: 'Summer Winners' });

  const session = await login(env);
  const response = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/api/social-intelligence/visuals`, {
    headers: { cookie: session.cookie, 'X-SOWHAT-CSRF': session.csrf },
  }), env, {});
  assert.equal(response.status, 200);

  const payload = await body(response);
  assert.equal(payload.count, 2, 'seuls les medias publiables sont exposes');
  assert.equal(payload.items[0].name, 'reel-02.mp4', 'le plus recent en premier');
  assert.equal(payload.items[0].kind, 'video');
  assert.equal(payload.items[1].kind, 'image');
  assert.equal(payload.items[1].title, 'Look 01');
  assert.equal(payload.items[1].collection, 'Summer Winners');
  assert.equal(payload.items[1].url, `${ORIGIN}/visuals/media/look-01.jpg`);

  const mediaKeys = [...env.VISUALS_BUCKET.store.keys()].filter((key) => key.startsWith('visuals/media/'));
  assert.equal(mediaKeys.length, 3, 'la bibliotheque ne doit creer aucun fichier');
});

check('bibliotheque R2 : CSRF exige', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  const response = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/api/social-intelligence/visuals`, {
    headers: { cookie: session.cookie },
  }), env, {});
  assert.equal(response.status, 403);
});

check('aucune statistique inventee quand le moteur n a pas de donnees', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  assert.ok(session.markup.includes('Le moteur attend les premières données réelles.'));
  assert.ok(session.markup.includes('En attente de synchronisation'));
  assert.ok(session.markup.includes('Token serveur non présent'));
  assert.ok(!session.markup.includes('Actualiser les statistiques'), 'pas de bouton de sync sans token');
});

check('navigation : six sections et six cibles reellement presentes', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  for (const view of ['overview', 'publish', 'contents', 'coach', 'plan', 'connections']) {
    assert.ok(session.markup.includes(`data-view="${view}"`), `section manquante : ${view}`);
    assert.ok(session.markup.includes(`data-target="${view}"`), `bouton de navigation manquant : ${view}`);
  }
});

check('boucle Coach/Plan vers le Studio : boutons de preremplissage presents', async () => {
  const env = makeEnv();
  installBridge();
  const session = await login(env);
  assert.ok(session.markup.includes('data-seed='), 'aucun bouton de preremplissage');
  assert.ok(session.markup.includes('Creer a partir de cette recommandation'));
});

/* ---------------------------------------------------------------- */
/* Execution                                                          */
/* ---------------------------------------------------------------- */

let failures = 0;
for (const { name, fn } of results) {
  const originalFetch = globalThis.fetch;
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${error.message}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

if (failures > 0) {
  console.error(`\nSOWHAT Social Intelligence v4 behaviour: ${failures} echec(s) sur ${results.length}`);
  process.exit(1);
}
console.log(`\nSOWHAT Social Intelligence v4 behaviour: PASS (${results.length} scenarios)`);
