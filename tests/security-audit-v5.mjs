/**
 * SOWHAT Control V5 - Audit de securite outille
 *
 * Cet audit lit le code source V5 et verifie que les garanties tenues par les
 * tests unitaires ne peuvent pas etre annulees par une modification future.
 * Un test unitaire prouve qu un comportement est correct aujourd hui ; cet
 * audit empeche qu on le retire demain sans s en apercevoir.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const SRC = new URL('../src/', import.meta.url);
const V5_FILES = [
  'instagram-client-v5.js', 'instagram-sync-v5.js', 'sowhat-score-v5.js',
  'content-memory-v5.js', 'coach-v5.js', 'plan-v5.js', 'security-v5.js',
  'studio-v5.js', 'publishing-v5.js', 'scheduler-v5.js', 'learning-v5.js',
  'observability-v5.js', 'social-intelligence-ui-v5.js',
];

const read = (file) => readFileSync(new URL(file, SRC), 'utf8');
const sources = Object.fromEntries(V5_FILES.map((file) => [file, read(file)]));
const allSource = Object.values(sources).join('\n');

/* ---------------- Secrets ---------------- */

test('aucun secret en dur dans les sources V5', () => {
  const patterns = [
    /INSTAGRAM_ACCESS_TOKEN\s*[:=]\s*['"][^'"]{8,}/,
    /SOCIAL_INTELLIGENCE_CSRF_SECRET\s*[:=]\s*['"][^'"]{8,}/,
    /\bEAA[A-Za-z0-9_-]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsb_secret_[A-Za-z0-9_-]{8,}/,
  ];
  for (const [file, source] of Object.entries(sources)) {
    for (const pattern of patterns) {
      assert.equal(pattern.test(source), false, `${file} : secret potentiel (${pattern})`);
    }
  }
});

test('tous les credentials viennent de l environnement', () => {
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes("env?.INSTAGRAM_ACCESS_TOKEN"), 'le token doit venir de env');
  assert.ok(client.includes("env?.INSTAGRAM_USER_ID"));
});

/* ---------------- Transport et allowlist ---------------- */

test('aucune decouverte du transport d authentification', () => {
  for (const forbidden of ['transport_fallback', 'transportConfirmed', 'bascule']) {
    assert.equal(allSource.includes(forbidden), false, `motif de decouverte residuel : ${forbidden}`);
  }
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes('const transport = resolveTokenTransport'), 'le transport doit etre fige a la construction');
  assert.equal(/state\.transport\s*=/.test(client), false, 'le transport ne doit jamais etre reaffecte');
});

test('allowlist d hotes Meta stricte et https obligatoire', () => {
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes("'graph.facebook.com'") && client.includes("'graph.instagram.com'"));
  assert.ok(client.includes("url.protocol === 'https:'"), 'https obligatoire');
  assert.ok(client.includes("url.port === ''"), 'aucun port arbitraire');
});

test('aucune redirection suivie automatiquement', () => {
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes("redirect: 'manual'"), 'les redirections doivent etre refusees, pas suivies');
  assert.ok(client.includes('UNSAFE_REDIRECT'));
});

test('aucun appel reseau hors du client Meta', () => {
  for (const [file, source] of Object.entries(sources)) {
    if (file === 'instagram-client-v5.js') continue;
    assert.equal(/\bfetch\s*\(/.test(source), false, `${file} : appel fetch direct interdit`);
    assert.equal(/XMLHttpRequest/.test(source), false, `${file} : XHR interdit`);
  }
});

/* ---------------- Redaction ---------------- */

test('la redaction couvre en-tete, parametre de requete et JSON', () => {
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes('access_token=[^&'), 'parametre de requete');
  assert.ok(client.includes('"access_token"'), 'charge JSON');
  assert.ok(client.includes('Bearer'), 'en-tete');
});

test('le journal supprime tout champ nomme comme un secret', () => {
  const observability = sources['observability-v5.js'];
  assert.ok(/token|secret|password/.test(observability));
  assert.ok(observability.includes('[REDACTED]'));
  assert.ok(observability.includes('redactSecrets'), 'la redaction du client Meta est reutilisee');
});

/* ---------------- Fail closed ---------------- */

test('le portail SAFE est ferme par defaut', () => {
  const security = sources['security-v5.js'];
  assert.ok(security.includes("flag !== 'true'"), 'seule la valeur true ouvre le portail');
  assert.ok(security.includes('subject?.safe_approved !== true'), 'l approbation doit etre un booleen strict');
});

test('CSRF exige un secret suffisant, sans mode degrade', () => {
  const security = sources['security-v5.js'];
  assert.ok(security.includes('secret.length < 32'));
  assert.ok(security.includes('CSRF_NOT_CONFIGURED'));
  assert.ok(security.includes('constantTimeEqual'), 'comparaison a duree constante obligatoire');
});

test('l idempotence refuse plutot que de supposer l exclusion mutuelle', () => {
  const security = sources['security-v5.js'];
  assert.ok(security.includes("etagDoesNotMatch: '*'"), 'ecriture conditionnelle');
  assert.ok(security.includes('IDEMPOTENCY_UNSUPPORTED'));
  assert.ok(/sonde|probe/i.test(security), 'la capacite d ecriture conditionnelle doit etre verifiee');
});

test('la publication verifie SAFE, etat et validite avant tout appel Meta', () => {
  const publishing = sources['publishing-v5.js'];
  const preflight = publishing.slice(0, publishing.indexOf('client.mutate'));
  assert.ok(preflight.includes('assertPublishable'), 'le portail SAFE passe avant l appel');
  assert.ok(preflight.includes('reserveIdempotencyKey'), 'la reservation passe avant l appel');
});

test('media_publish n est jamais rejoue a l aveugle', () => {
  const publishing = sources['publishing-v5.js'];
  assert.ok(publishing.includes('publish_attempted_at'), 'une trace precede la publication');
  assert.ok(publishing.includes('REQUIRES_MANUAL_CHECK'));
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes('WRITE_RETRYABLE'), 'les ecritures ont leur propre politique de rejeu');
  assert.ok(client.includes('META_ERROR.RATE_LIMITED]'), 'seul le quota est rejouable en ecriture');
});

/* ---------------- Validation des entrees ---------------- */

test('validation des medias : type, taille, extension, chemin', () => {
  const security = sources['security-v5.js'];
  assert.ok(security.includes('ALLOWED_MEDIA_TYPES'));
  assert.ok(security.includes('maxBytes'));
  assert.ok(security.includes('MEDIA_KEY_PREFIX'));
  assert.ok(security.includes("key.includes('..')"), 'remontee de chemin refusee');
  assert.ok(security.includes('sanitizeFilename'));
});

test('les identifiants utilises comme cle de stockage sont valides', () => {
  assert.ok(sources['learning-v5.js'].includes('isValidMediaId'));
  assert.ok(sources['studio-v5.js'].includes("replace(/[^A-Za-z0-9._-]/g, '')"), 'cle de brouillon assainie');
});

test('la pagination et les boucles d attente sont bornees', () => {
  assert.ok(sources['instagram-client-v5.js'].includes('maxPages'));
  assert.ok(sources['publishing-v5.js'].includes('maxChecks'));
  assert.ok(sources['scheduler-v5.js'].includes('maxPerRun'));
});

test('limitation de debit respectee : lecture du quota et repli borne', () => {
  const client = sources['instagram-client-v5.js'];
  assert.ok(client.includes('x-app-usage'));
  assert.ok(client.includes('APP_USAGE_PAUSE_THRESHOLD'));
  assert.ok(client.includes('MAX_BACKOFF_MS'));
});

/* ---------------- Rendu ---------------- */

test('aucune construction de HTML sans echappement', () => {
  const ui = sources['social-intelligence-ui-v5.js'];
  assert.ok(ui.includes('escapeHtml'));
  assert.equal(/innerHTML/.test(ui), false, 'aucune ecriture directe dans le DOM');
  assert.equal(/\beval\s*\(/.test(allSource), false, 'aucun eval');
  assert.equal(/new Function\s*\(/.test(allSource), false, 'aucune fonction construite dynamiquement');
});

test('aucun gestionnaire d evenement en ligne dans les gabarits', () => {
  const ui = sources['social-intelligence-ui-v5.js'];
  assert.equal(/\son(click|error|load|submit)\s*=/i.test(ui), false);
  assert.ok(ui.includes('noindex,nofollow,noarchive'), 'le cockpit ne doit pas etre indexe');
});

/* ---------------- Verrous concurrents ---------------- */

test('le verrou du scheduler n est libere que par son proprietaire', () => {
  const scheduler = sources['scheduler-v5.js'];
  assert.ok(scheduler.includes('existing.holder !== holder'));
  assert.ok(scheduler.includes('finally'), 'le verrou doit etre libere meme apres exception');
});

/* ---------------- Couverture ---------------- */

test('chaque module V5 dispose d une suite de tests', () => {
  const tests = readdirSync(new URL('../tests/', import.meta.url));
  const expected = [
    'instagram-client-v5.mjs', 'instagram-sync-v5.mjs', 'sowhat-score-v5.mjs',
    'content-memory-v5.mjs', 'coach-v5.mjs', 'plan-v5.mjs', 'studio-v5.mjs',
    'publishing-v5.mjs', 'scheduler-v5.mjs', 'learning-v5.mjs',
    'observability-v5.mjs', 'ui-v5.mjs',
  ];
  for (const file of expected) assert.ok(tests.includes(file), `suite manquante : ${file}`);
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 security audit: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
