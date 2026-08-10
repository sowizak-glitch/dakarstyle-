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
import { issueCsrfToken, MEDIA_KEY_PREFIX } from '../src/security-v5.js';
import { STUDIO_API_PREFIX } from '../src/studio-routes-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); this.meta = new Map(); }
  async get(k) {
    if (!this.s.has(k)) return null;
    const value = this.s.get(k);
    return {
      text: async () => String(value),
      body: value,
      size: String(value).length,
      httpEtag: '"e"',
      httpMetadata: this.meta.get(k)?.httpMetadata || {},
    };
  }
  async put(k, v, o = {}) {
    if (o?.onlyIf?.etagDoesNotMatch === '*' && this.s.has(k)) return null;
    this.s.set(k, typeof v === 'string' ? v : v); this.meta.set(k, o); return { key: k };
  }
  async delete(k) { this.s.delete(k); this.meta.delete(k); }
}

/* Fichiers minimalistes mais authentiques : le serveur lit les octets. */
function padded(head, total = 64) {
  const bytes = new Uint8Array(total);
  bytes.set(head);
  for (let i = head.length; i < total; i += 1) bytes[i] = (i * 7) % 251;
  return bytes;
}
const JPEG_BYTES = padded([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);

function multipart(bytes, name, type) {
  const form = new FormData();
  form.append('file', new File([bytes], name, { type }), name);
  return form;
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

/* ---------------- Studio : ecran et script ---------------- */

test('l espace de noms V5 couvre les medias publics, sans toucher a la V4', () => {
  const v5 = (p) => isSocialIntelligenceV5Route(new URL(`https://dakarstyle.com${p}`));
  assert.equal(v5(`/${MEDIA_KEY_PREFIX}abc.jpg`), true, 'les medias V5 doivent etre routes par la V5');
  assert.equal(v5('/visuals/media/abc.jpg'), false, 'les medias V4 restent a la V4');
  assert.equal(v5('/visuals/manifest/abc.json'), false);
  assert.equal(v5(`${V5_ROUTE_PREFIX}/studio`), true);
  assert.equal(v5(`${STUDIO_API_PREFIX}drafts`), true);
});

test('le media public est servi sans authentification : Meta n en a aucune', async () => {
  const env = makeEnv();
  env.VISUALS_BUCKET.s.set(`${MEDIA_KEY_PREFIX}visuel.jpg`, 'octets');
  env.VISUALS_BUCKET.meta.set(`${MEDIA_KEY_PREFIX}visuel.jpg`, { httpMetadata: { contentType: 'image/jpeg' } });
  const response = await call(env, req(`/${MEDIA_KEY_PREFIX}visuel.jpg`, { auth: false }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
});

test('l ecran Publier se sert avec une CSP qui autorise son script et rien d autre', async () => {
  const response = await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio`));
  assert.equal(response.status, 200);
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp.includes("default-src 'none'"));
  assert.ok(csp.includes("script-src 'self'"), 'le script du Studio doit etre autorise');
  assert.equal(csp.includes("script-src 'self' 'unsafe-inline'"), false, 'aucun script inline');
  assert.equal(csp.includes('unsafe-eval'), false);
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('le script du Studio est servi a part, jamais dans la page', async () => {
  const page = await (await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio`))).text();
  assert.ok(page.includes('/social-intelligence/v5/studio/app.js'));
  assert.equal(/<script(?![^>]*(src=|type="application\/json))/i.test(page), false, 'aucun script inline');

  const script = await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio/app.js`));
  assert.equal(script.status, 200);
  assert.ok(script.headers.get('content-type').includes('text/javascript'));
  assert.ok((await script.text()).includes('media/upload'));
});

test('aucun champ URL, aucune cle de stockage visible dans l ecran', async () => {
  const page = await (await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio`))).text();
  for (const forbidden of ['r2_key', 'SOWHAT_MEDIA_PUBLIC_BASE', 'media_url', 'bucket', 'https://']) {
    assert.equal(page.includes(forbidden), false, `« ${forbidden} » ne doit pas apparaitre a l ecran`);
  }
  assert.equal(/type="url"/i.test(page), false, 'aucun champ de saisie d URL');
  assert.ok(page.includes('type="file"'), 'un vrai selecteur de fichier doit exister');
  assert.ok(page.includes('accept="image/jpeg,image/png,video/mp4"'));
});

test('le cockpit met « Publier » en premier', async () => {
  const page = await (await call(makeEnv(), req(V5_ROUTE_PREFIX))).text();
  const body = page.slice(page.indexOf('<body>'));
  assert.ok(body.includes('/social-intelligence/v5/studio'), 'le lien Publier doit exister');
  assert.ok(body.indexOf('v5-publish') < body.indexOf('v5-grid'), 'l action doit preceder les indicateurs');
  assert.ok(body.includes('Publier une photo ou une video'));
});

/* ---------------- Session navigateur ---------------- */

test('une session cockpit valide ouvre l ecran : un navigateur ne pose pas d en-tete', async () => {
  const env = makeEnv();
  const token = 'jeton-de-session-de-test-suffisamment-long-123456';
  const digest = await (async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  })();
  env.VISUALS_BUCKET.s.set(
    `visuals/social-intelligence/sessions/${digest}.json`,
    JSON.stringify({ expires_at: Date.now() + 3600000, csrf: 'x' }),
  );
  const response = await call(env, req(`${V5_ROUTE_PREFIX}/studio`, {
    auth: false, headers: { cookie: `__Host-sowhat_si=${token}` },
  }));
  assert.equal(response.status, 200);
});

test('session expiree ou inconnue : refus, comme une absence de session', async () => {
  const env = makeEnv();
  const expired = 'jeton-perime-mais-de-longueur-suffisante-1234567';
  const digest = await (async () => {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expired));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  })();
  env.VISUALS_BUCKET.s.set(
    `visuals/social-intelligence/sessions/${digest}.json`,
    JSON.stringify({ expires_at: Date.now() - 1000, csrf: 'x' }),
  );
  for (const cookie of [`__Host-sowhat_si=${expired}`, '__Host-sowhat_si=inconnu', 'autre=1']) {
    const response = await call(env, req(`${V5_ROUTE_PREFIX}/studio`, { auth: false, headers: { cookie } }));
    assert.equal(response.status, 401, cookie);
  }
});

/* ---------------- Jeton CSRF ---------------- */

test('le jeton CSRF est emis pour le porteur, pas pour une session choisie par l appelant', async () => {
  const env = makeEnv();
  const body = await (await call(env, req(`${V5_API_PREFIX}csrf`))).json();
  assert.ok(body.csrf_token);

  // Un appelant qui se declare une autre session n obtient rien d exploitable.
  const forged = await issueCsrfToken(env, 'session-que-je-choisis', NOW);
  const refused = await call(env, req(`${V5_API_PREFIX}sync`, {
    method: 'POST', headers: { 'x-sowhat-csrf': forged, 'x-sowhat-session': 'session-que-je-choisis' },
  }));
  assert.equal(refused.status, 403);
});

test('le jeton emis par la route CSRF ouvre bien les ecritures', async () => {
  const env = makeEnv();
  const { csrf_token: token } = await (await call(env, req(`${V5_API_PREFIX}csrf`))).json();
  const response = await call(env, req(`${STUDIO_API_PREFIX}drafts`, {
    method: 'POST', headers: { 'x-sowhat-csrf': token, 'content-type': 'application/json' },
  }));
  assert.equal(response.status, 201);
});

/* ---------------- Televersement ---------------- */

function uploadRequest(form, token) {
  const headers = new Headers({ 'x-sowhat-admin-key': ADMIN_KEY });
  if (token) headers.set('x-sowhat-csrf', token);
  return new Request(`https://dakarstyle.com${V5_API_PREFIX}media/upload`, {
    method: 'POST', headers, body: form,
  });
}

test('televersement sans jeton CSRF : refus avant toute lecture du fichier', async () => {
  const env = makeEnv();
  const response = await call(env, uploadRequest(multipart(JPEG_BYTES, 'a.jpg', 'image/jpeg')));
  assert.equal(response.status, 403);
  assert.equal(env.VISUALS_BUCKET.s.size, 0, 'rien ne doit avoir ete ecrit');
});

test('televersement sans authentification : refus', async () => {
  const request = new Request(`https://dakarstyle.com${V5_API_PREFIX}media/upload`, {
    method: 'POST', body: multipart(JPEG_BYTES, 'a.jpg', 'image/jpeg'),
  });
  assert.equal((await call(makeEnv(), request)).status, 401);
});

test('televersement complet : le fichier arrive dans R2 et l operateur ne voit aucune URL', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const response = await call(env, uploadRequest(multipart(JPEG_BYTES, 'look.jpg', 'image/jpeg'), token));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.media.r2_key.startsWith(MEDIA_KEY_PREFIX));
  assert.equal(body.media.kind, 'IMAGE');
  assert.ok(!JSON.stringify(body).includes('https://'));
  assert.ok(env.VISUALS_BUCKET.s.has(body.media.r2_key));
});

/* ---------------- API du Studio ---------------- */

async function seedDraft(env, token, overrides = {}) {
  const upload = await (await call(env, uploadRequest(multipart(JPEG_BYTES, 'a.jpg', 'image/jpeg'), token))).json();
  const created = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts`, token, 'POST', {
    format: 'IMAGE', caption: 'Nouvelle collection a Dakar.', media: upload.media, ...overrides,
  }))).json();
  return created.draft;
}

function jsonReq(path, token, method, body) {
  const headers = new Headers({ 'x-sowhat-admin-key': ADMIN_KEY, 'content-type': 'application/json' });
  if (token) headers.set('x-sowhat-csrf', token);
  return new Request(`https://dakarstyle.com${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('cycle complet d un brouillon : creation, lecture, liste, modification', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  assert.equal(draft.state, 'DRAFT');
  assert.equal(draft.safe_approved, false, 'un brouillon ne nait jamais approuve');

  const read = await (await call(env, req(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}`))).json();
  assert.equal(read.draft.draft_id, draft.draft_id);
  assert.equal(read.preview.publishable, true);

  const list = await (await call(env, req(`${STUDIO_API_PREFIX}drafts`))).json();
  assert.equal(list.drafts.length, 1);

  const patched = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}`, token, 'PATCH', {
    caption: 'Legende revue', hashtags: '#dakarstyle #sowhat',
  }))).json();
  assert.equal(patched.draft.caption, 'Legende revue');
  assert.deepEqual(patched.draft.hashtags, ['#dakarstyle', '#sowhat']);
});

test('approbation puis validation : l etat suit la machine du Studio', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);

  const approved = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'))).json();
  assert.equal(approved.draft.safe_approved, true);

  const ready = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'))).json();
  assert.equal(ready.draft.state, 'READY');
});

test('programmation puis annulation', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));

  const future = new Date(NOW + 3600000).toISOString();
  const scheduled = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: future,
  }))).json();
  assert.equal(scheduled.draft.state, 'SCHEDULED');
  assert.equal(scheduled.draft.scheduled_for, future);

  const cancelled = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/cancel`, token, 'POST'))).json();
  assert.equal(cancelled.draft.state, 'CANCELLED');
  assert.equal(cancelled.draft.scheduled_for, null);
});

test('programmation dans le passe refusee avec un code exploitable par l interface', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: new Date(NOW - 3600000).toISOString(),
  }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, 'studio_schedule_in_past');
});

test('un brouillon sans media ne peut ni etre approuve ni etre valide', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const created = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts`, token, 'POST', {
    caption: 'Sans visuel',
  }))).json();
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${created.draft.draft_id}/approve`, token, 'POST'));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error, 'studio_validation_failed');
  assert.ok(body.errors.some((line) => line.includes('media')));
});

test('media falsifie dans un brouillon : refuse a la validation', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const created = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts`, token, 'POST', {
    caption: 'Legende',
    media: { r2_key: 'visuals/media/ailleurs.jpg', content_type: 'image/jpeg', size_bytes: 10, filename: 'a.jpg' },
  }))).json();
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${created.draft.draft_id}/ready`, token, 'POST'));
  assert.equal(response.status, 422);
});

test('ecriture Studio sans CSRF : refus sur toutes les routes qui modifient', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  const paths = [
    [`${STUDIO_API_PREFIX}drafts`, 'POST'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}`, 'PATCH'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, 'POST'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, 'POST'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, 'POST'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, 'POST'],
    [`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/cancel`, 'POST'],
  ];
  for (const [path, method] of paths) {
    const response = await call(env, jsonReq(path, '', method, {}));
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('brouillon inexistant : 404, jamais 500', async () => {
  const env = makeEnv();
  const response = await call(env, req(`${STUDIO_API_PREFIX}drafts/DRAFT-INEXISTANT`));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'studio_draft_not_found');
});

/* ---------------- Publication ---------------- */

test('portail SAFE ferme : publication refusee et brouillon intact', async () => {
  const env = makeEnv({ INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));

  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'safe_gate_closed');

  const after = await (await call(env, req(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}`))).json();
  assert.equal(after.draft.state, 'READY', 'un portail ferme ne doit pas casser le brouillon');
});

test('publication depuis un brouillon non valide : refusee sans appel Meta', async () => {
  const env = makeEnv({ SOWHAT_PUBLISH_ENABLED: 'true', INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178' });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'studio_invalid_transition');
});

test('Instagram non connecte : refus clair avant toute transition', async () => {
  const env = makeEnv({ SOWHAT_PUBLISH_ENABLED: 'true' });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'meta_not_configured');
});

test('stockage media non configure : message de configuration, pas de publication', async () => {
  const env = makeEnv({
    SOWHAT_PUBLISH_ENABLED: 'true', INSTAGRAM_ACCESS_TOKEN: 'x', INSTAGRAM_USER_ID: '178',
  });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));

  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'), {
    clientOptions: { fetchImpl: async () => new Response('{}', { status: 200 }), testOrigin: 'https://meta.test' },
  });
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.result.reason, 'publish_media_url_not_configured');
});

test('double clic sur Publier : une seule publication part', async () => {
  const env = makeEnv({
    SOWHAT_PUBLISH_ENABLED: 'true',
    INSTAGRAM_ACCESS_TOKEN: 'x',
    INSTAGRAM_USER_ID: '178',
    SOWHAT_MEDIA_PUBLIC_BASE: 'https://dakarstyle.com',
  });
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));

  let publishCalls = 0;
  const clientOptions = {
    testOrigin: 'https://meta.test',
    async fetchImpl(url, init) {
      const target = String(url);
      if (init?.method === 'POST' && target.includes('media_publish')) {
        publishCalls += 1;
        return new Response(JSON.stringify({ id: 'MEDIA-1' }), { status: 200 });
      }
      if (init?.method === 'POST' && target.includes('/media')) {
        return new Response(JSON.stringify({ id: 'CREATION-1' }), { status: 200 });
      }
      if (target.includes('status_code')) {
        return new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'MEDIA-1', permalink: 'https://instagram.com/p/x', timestamp: '2026-07-01T12:00:00+0000' }), { status: 200 });
    },
  };
  const publishOptions = { containerPolling: { delayMs: 0, maxChecks: 2, sleep: async () => {} } };

  const first = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'), { clientOptions, publishOptions });
  const firstBody = await first.json();
  assert.equal(firstBody.ok, true, JSON.stringify(firstBody.result));
  assert.equal(firstBody.draft.state, 'PUBLISHED');
  assert.equal(firstBody.draft.instagram_media_id, 'MEDIA-1');

  const second = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/publish`, token, 'POST'), { clientOptions, publishOptions });
  assert.equal(second.status, 409, 'un contenu publie ne repart pas');
  assert.equal(publishCalls, 1, 'media_publish ne doit avoir ete appele qu une seule fois');
});

/* ---------------- Prefill Plan et Coach ---------------- */

test('« Creer a partir de ce jour » ouvre le Studio deja rempli', async () => {
  const response = await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio?source=plan&day=1`));
  assert.equal(response.status, 200);
  const page = await response.text();
  const payload = page.slice(page.indexOf('id="st-prefill">') + 16, page.indexOf('</script>', page.indexOf('id="st-prefill">')));
  const prefill = JSON.parse(payload);
  assert.equal(prefill.state, 'DRAFT');
  assert.equal(prefill.safe_approved, false, 'un plan ne peut jamais approuver a la place de l humain');
  assert.equal(prefill.media, null, 'le visuel reste un choix humain');
  assert.equal(prefill.source.origin, 'plan_7_jours');
  assert.ok(prefill.caption.length > 0);
});

test('l API de prefill sert les memes donnees, sans rien persister', async () => {
  const env = makeEnv();
  const body = await (await call(env, req(`${STUDIO_API_PREFIX}prefill?source=plan&day=2`))).json();
  assert.equal(body.ok, true);
  assert.equal(body.persisted, false);
  assert.equal(body.draft.source.day_index, 2);
  const list = await (await call(env, req(`${STUDIO_API_PREFIX}drafts`))).json();
  assert.deepEqual(list.drafts, [], 'un apercu de prefill ne cree aucun brouillon');
});

test('jour de plan inexistant : 404 plutot qu un ecran vide sans explication', async () => {
  const response = await call(makeEnv(), req(`${STUDIO_API_PREFIX}prefill?source=plan&day=99`));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'plan_day_not_found');
});

test('source de prefill inconnue refusee', async () => {
  const response = await call(makeEnv(), req(`${STUDIO_API_PREFIX}prefill?source=n-importe-quoi`));
  assert.equal(response.status, 400);
});

test('un prefill impossible n empeche pas d ouvrir l ecran', async () => {
  const response = await call(makeEnv(), req(`${V5_ROUTE_PREFIX}/studio?source=coach&recommendation=RECO-INEXISTANTE`));
  assert.equal(response.status, 200, 'l ecran doit s ouvrir malgre tout');
  const page = await response.text();
  assert.ok(page.includes('Ajouter une photo ou une video'));
});

test('corriger une date puis reprogrammer : la reprise ne casse pas le brouillon', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));

  // Erreur de saisie : date passee.
  const refused = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: new Date(NOW - 1000).toISOString(),
  }));
  assert.equal(refused.status, 422);

  // L operateur corrige et recommence le parcours complet.
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  const again = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  assert.equal(again.status, 200, 'un brouillon deja valide reste valide');

  const scheduled = await (await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: new Date(NOW + 7200000).toISOString(),
  }))).json();
  assert.equal(scheduled.draft.state, 'SCHEDULED');
});

test('changer d avis sur l heure : reprogrammation acceptee', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: new Date(NOW + 3600000).toISOString(),
  }));

  const later = new Date(NOW + 10800000).toISOString();
  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/schedule`, token, 'POST', {
    scheduled_for: later,
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.draft.state, 'SCHEDULED');
  assert.equal(body.draft.scheduled_for, later);
  assert.ok(body.draft.history.some((entry) => entry.reason === 'reprogrammation'),
    'la reprogrammation passe par une transition declaree, et reste tracee');
});

test('un brouillon valide dont le media est retire ne reste pas « pret »', async () => {
  const env = makeEnv();
  const token = await issueCsrfToken(env, 'v5-admin', NOW);
  const draft = await seedDraft(env, token);
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/approve`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}`, token, 'PATCH', { media: null }));

  const response = await call(env, jsonReq(`${STUDIO_API_PREFIX}drafts/${draft.draft_id}/ready`, token, 'POST'));
  assert.equal(response.status, 422, 'un contenu sans media ne peut plus etre declare pret');
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 routes: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
