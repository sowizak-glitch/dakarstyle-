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
  'observability-v5.js', 'social-intelligence-ui-v5.js', 'media-upload-v5.js',
  'studio-routes-v5.js', 'studio-ui-v5.js', 'social-intelligence-v5-routes.js',
];

/**
 * Les gabarits destines au NAVIGATEUR sont audites separement. Ils ont le
 * droit d appeler le reseau — c est meme leur raison d etre — mais seulement
 * leur propre origine, et jamais en construisant du HTML ou du code.
 */
const V5_CLIENT_FILES = ['studio-client-v5.js'];

const read = (file) => readFileSync(new URL(file, SRC), 'utf8');
const sources = Object.fromEntries(V5_FILES.map((file) => [file, read(file)]));
const clientSources = Object.fromEntries(V5_CLIENT_FILES.map((file) => [file, read(file)]));
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
    'observability-v5.mjs', 'ui-v5.mjs', 'media-upload-v5.mjs', 'routes-v5.mjs',
  ];
  for (const file of expected) assert.ok(tests.includes(file), `suite manquante : ${file}`);
});

/* ---------------- Televersement des medias ---------------- */

test('la cle de stockage est generee par le serveur, jamais fournie par le client', () => {
  const upload = sources['media-upload-v5.js'];
  assert.ok(upload.includes('crypto.randomUUID'), 'identifiant aleatoire obligatoire');
  assert.ok(upload.includes('MEDIA_KEY_PREFIX'), 'prefixe fige');
  assert.ok(upload.includes('newMediaKey(realType'), 'la cle derive du type reellement detecte');
  // Aucune lecture d un champ de formulaire qui deciderait du chemin.
  assert.equal(/form\.get\(\s*['"](r2_key|key|path|destination)['"]/.test(upload), false,
    'le client ne doit jamais pouvoir choisir ou ecrire');
});

test('le type declare ne fait pas foi : les octets decident', () => {
  const upload = sources['media-upload-v5.js'];
  assert.ok(upload.includes('detectContentType'), 'signature reelle analysee');
  assert.ok(upload.includes('detectHostileContent'), 'contenus hostiles reconnus');
  assert.ok(upload.includes('realType !== declaredType'), 'incoherence declaree/reelle refusee');
  const preflight = upload.slice(0, upload.indexOf('await bucket.put('));
  for (const guard of ['detectHostileContent', 'detectContentType', 'validateMedia', 'spec.extensions.includes']) {
    assert.ok(preflight.includes(guard), `verification manquante avant ecriture : ${guard}`);
  }
});

test('aucun octet n est ecrit avant que toutes les verifications soient passees', () => {
  const upload = sources['media-upload-v5.js'];
  assert.equal((upload.match(/bucket\.put\(/g) || []).length, 1, 'une seule ecriture, en fin de parcours');
  assert.ok(upload.indexOf('MAX_REQUEST_BYTES') < upload.indexOf('request.formData()'),
    'la taille annoncee est refusee avant de parser le corps');
});

test('la lecture publique des medias est bornee et sans sniffing', () => {
  const upload = sources['media-upload-v5.js'];
  const serve = upload.slice(upload.indexOf('export async function serveV5Media'));
  assert.ok(serve.includes("key.startsWith(MEDIA_KEY_PREFIX)"), 'prefixe verifie');
  assert.ok(serve.includes("key.includes('..')"), 'remontee de chemin refusee');
  assert.ok(serve.includes('ALLOWED_MEDIA_TYPES[storedType]'), 'seuls les types autorises sont servis');
  assert.ok(serve.includes("'x-content-type-options': 'nosniff'"));
  assert.ok(serve.includes("request.method !== 'GET' && request.method !== 'HEAD'"), 'lecture seule');
});

/* ---------------- Studio : une seule machine a etats ---------------- */

test('l API du Studio ne reimplemente aucune transition', () => {
  const routes = sources['studio-routes-v5.js'];
  assert.ok(routes.includes("from './studio-v5.js'"), 'les operations viennent du Studio');
  assert.ok(routes.includes('publishAndPersist'), 'la publication reutilise la sequence du scheduler');
  for (const forbidden of ['STUDIO_STATE.PUBLISHING =', 'state: \'PUBLISHED\'', 'state: \'READY\'', 'ALLOWED_TRANSITIONS']) {
    assert.equal(routes.includes(forbidden), false, `seconde machine a etats detectee : ${forbidden}`);
  }
  const scheduler = sources['scheduler-v5.js'];
  assert.equal((scheduler.match(/beginPublishing\(/g) || []).length, 1,
    'le passage en PUBLISHING n existe qu a un seul endroit');
});

test('la publication depuis le Studio verifie le portail SAFE avant toute transition', () => {
  const routes = sources['studio-routes-v5.js'];
  const publish = routes.slice(routes.indexOf("if (action === 'publish')"));
  assert.ok(publish.indexOf('checkSafeGate') < publish.indexOf('publishAndPersist'),
    'le portail SAFE passe avant tout');
  assert.ok(publish.indexOf('checkSafeGate') < publish.indexOf('STUDIO_STATE.READY'));
  assert.ok(publish.includes('isConfigured'), 'Meta doit etre configure avant de tenter quoi que ce soit');
});

test('toute ecriture du Studio exige le jeton CSRF, sans exception de route', () => {
  const routes = sources['studio-routes-v5.js'];
  const guard = routes.slice(routes.indexOf('export async function handleStudioApi'));
  assert.ok(guard.includes("if (method !== 'GET' && method !== 'HEAD')"), 'la garde porte sur la methode');
  assert.ok(guard.indexOf('context.requireCsrf()') < guard.indexOf("segments[0] !== 'drafts'"),
    'la verification precede toute repartition de route');
});

/* ---------------- Autorisation et CSRF ---------------- */

test('l identifiant de session CSRF vient du porteur, jamais d un en-tete choisi', () => {
  const routes = sources['social-intelligence-v5-routes.js'];
  assert.equal(routes.includes("request.headers.get('x-sowhat-session')"), false,
    'un appelant ne doit pas pouvoir nommer la session contre laquelle il est verifie');
  assert.ok(routes.includes('async function requireCsrf(request, env, now, principal)'));
  assert.ok(routes.includes("verifyCsrfToken(env, principal || 'v5-admin', token, now)"));
});

test('la session navigateur est verifiee dans le stockage, avec expiration', () => {
  const routes = sources['social-intelligence-v5-routes.js'];
  const session = routes.slice(routes.indexOf('async function authorizeBrowserSession'));
  assert.ok(session.includes('Number(session.expires_at || 0) <= Date.now()'), 'une session perimee ne vaut rien');
  assert.ok(session.includes('token.length < 32'), 'un jeton trop court est refuse');
  assert.ok(session.includes('sha256Hex(token)'), 'le jeton n est jamais utilise tel quel comme cle');
  assert.ok(routes.includes("origin !== new URL(request.url).origin"), 'origine croisee refusee sur session cookie');
});

test('le media public est la seule route V5 sans authentification', () => {
  const routes = sources['social-intelligence-v5-routes.js'];
  const before = routes.slice(
    routes.indexOf('export async function handleSocialIntelligenceV5'),
    routes.indexOf('const auth = await authorizeV5'),
  );
  assert.ok(before.includes('isV5PublicMediaPath'), 'le media public passe avant l autorisation');
  const openRoutes = before.match(/return (json|new Response|serveV5Media)/g) || [];
  assert.equal(openRoutes.length, 2, 'seuls OPTIONS et le media public precedent l autorisation');
});

/* ---------------- Interface : rien de technique a l ecran ---------------- */

test('l ecran Publier ne demande ni n affiche aucune URL', () => {
  // Les commentaires expliquent justement pourquoi ces notions restent
  // invisibles : c est le gabarit rendu qui doit en etre exempt, pas la
  // documentation du fichier.
  const ui = sources['studio-ui-v5.js']
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/type="url"/i.test(ui), false);
  for (const word of ['r2_key', 'SOWHAT_MEDIA_PUBLIC_BASE', 'media_url', 'bucket']) {
    assert.equal(ui.includes(word), false, `« ${word} » ne doit pas apparaitre dans le gabarit`);
  }
  assert.ok(ui.includes('accept="image/jpeg,image/png,video/mp4"'));
});

test('l ecran Publier n injecte aucun HTML non echappe et aucun evenement en ligne', () => {
  const ui = sources['studio-ui-v5.js'];
  assert.ok(ui.includes('escapeHtml'));
  assert.equal(/innerHTML/.test(ui), false);
  assert.equal(/\son(click|error|load|submit|change)\s*=/i.test(ui), false);
  assert.ok(ui.includes("replace(/</g, '\\\\u003c')"), 'le preremplissage ne peut pas fermer sa balise');
});

/* ---------------- Gabarit navigateur ---------------- */

test('le script navigateur ne construit ni HTML ni code', () => {
  for (const [file, source] of Object.entries(clientSources)) {
    assert.equal(/\beval\s*\(/.test(source), false, `${file} : eval interdit`);
    assert.equal(/new Function\s*\(/.test(source), false, `${file} : fonction dynamique interdite`);
    assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(source), false,
      `${file} : ecriture HTML directe interdite`);
  }
});

test('le script navigateur ne contacte que sa propre origine', () => {
  for (const [file, source] of Object.entries(clientSources)) {
    assert.equal(/https?:\/\//.test(source), false, `${file} : aucune origine externe`);
    assert.equal(/\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(source.replace(/^\s*\/\/.*$/gm, '')), false,
      `${file} : aucun hote code en dur`);
    assert.ok(source.includes("credentials: 'same-origin'"), `${file} : credentials bornes`);
  }
});

test('aucun code technique n atteint l operateur', () => {
  const client = clientSources['studio-client-v5.js'];
  assert.ok(client.includes('function humanError'), 'toute erreur passe par une traduction');
  assert.equal(/\.stack\b/.test(client), false, 'aucune pile d appel affichee');
  for (const code of ['media_invalid', 'csrf_invalid', 'meta_not_configured', 'publish_media_url_not_configured']) {
    assert.ok(new RegExp(`${code}:\\s*'`).test(client), `code technique sans traduction : ${code}`);
  }
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 security audit: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
