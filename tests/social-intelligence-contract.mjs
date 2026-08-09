/**
 * SOWHAT Control - Test de contrat (V4)
 *
 * Verifie statiquement que les garanties structurelles du systeme sont
 * toujours presentes dans le source : routes, garde SAFE, securite, mobile,
 * PWA et absence de secret commite.
 *
 * Le comportement reel (garde SAFE executee, idempotence, etats, CSRF) est
 * couvert par tests/social-intelligence-behaviour.mjs.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [engineSource, shellSource, uiSource, memorySource, routerSource, wranglerSource] = await Promise.all([
  readFile(new URL('../src/social-intelligence-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/social-intelligence-v3.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/social-intelligence-ui-v4.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/social-intelligence-memory-v4.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/router.js', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
]);

/* -- Moteur de mesure : routes historiques preservees --------------- */

const legacyRoutes = [
  '/api/social-intelligence/health',
  '/api/social-intelligence/data',
  '/api/social-intelligence/snapshot',
  '/api/social-intelligence/sync-instagram',
];
for (const route of legacyRoutes) {
  assert.ok(engineSource.includes(route), `route moteur manquante : ${route}`);
}

assert.ok(engineSource.includes('INSTAGRAM_ACCESS_TOKEN'), 'binding token Instagram manquant');
assert.ok(engineSource.includes('INSTAGRAM_USER_ID'), 'binding utilisateur Instagram manquant');
assert.ok(engineSource.includes('median('), 'mediane personnelle manquante');
assert.ok(engineSource.includes('buildWeeklyPlan'), 'moteur de plan hebdomadaire manquant');
assert.ok(engineSource.includes('buildRecommendations'), 'moteur de recommandations manquant');
assert.ok(engineSource.includes('mapWithConcurrency'), 'concurrence bornee des insights manquante');

/* -- Coquille : routes V4 ------------------------------------------- */

const shellRoutes = [
  '/social-intelligence',
  '/social-intelligence/login',
  '/social-intelligence/logout',
  '/social-intelligence/manifest.webmanifest',
  '/social-intelligence/sw.js',
  '/social-intelligence/icon.svg',
  '/api/social-intelligence/refresh',
  '/api/social-intelligence/visuals',
  '/api/social-intelligence/publish/preview',
  '/api/social-intelligence/publish/commit',
];
for (const route of shellRoutes) {
  assert.ok(shellSource.includes(route), `route cockpit manquante : ${route}`);
}

/* -- Garde SAFE et contrat Bridge (non-regression absolue) ---------- */

assert.ok(shellSource.includes("const VERSION = '4.0.0'"), 'marqueur de version v4 manquant');
assert.ok(shellSource.includes('DEFAULT_BRIDGE_URL'), 'endpoint Bridge Instagram non cable');
assert.ok(shellSource.includes('sowhat-visual-factory-v4-instagram-safe'), 'chemin du Bridge SAFE valide manquant');
assert.ok(shellSource.includes("source_workflow: 'SOWHAT — Visual Factory V4'"), 'contrat source Visual Factory manquant');
assert.ok(shellSource.includes("ALLOWED_PUBLICATION_TYPES = new Set(['POST IMAGE', 'REEL', 'STORY'])"), 'contrat POST/REEL/STORY manquant');
assert.ok(shellSource.includes("dry_run: mode === 'preview'"), 'garde dry-run SAFE manquante');
assert.ok(shellSource.includes("approved: mode === 'commit'"), 'garde d approbation manquante');
assert.ok(shellSource.includes('PREVIEW_TTL_MS'), 'expiration du preview manquante');
assert.ok(shellSource.includes('explicit_confirmation_required'), 'confirmation finale explicite manquante');
assert.ok(shellSource.includes('PUBLICATION_HISTORY_KEY'), 'historique de publication manquant');

/* -- Idempotence et etats (V4) -------------------------------------- */

assert.ok(shellSource.includes('IDEMPOTENCY_PREFIX'), 'espace de cles d idempotence manquant');
assert.ok(shellSource.includes('claimIdempotency'), 'reservation d idempotence manquante');
assert.ok(shellSource.includes("etagDoesNotMatch: '*'"), 'ecriture conditionnelle anti-concurrence manquante');
assert.ok(shellSource.includes('publication_already_in_flight'), 'refus des publications concurrentes manquant');
assert.ok(shellSource.includes('extractInstagramMediaId'), 'capture de l ID media Instagram manquante');
assert.ok(shellSource.includes('updatePublicationHistory'), 'mise a jour des etats d historique manquante');

for (const state of ['BROUILLON', 'SAFE VALIDE', 'EN PUBLICATION', 'PUBLIE', 'ECHEC']) {
  assert.ok(uiSource.includes(`'${state}'`), `etat de publication manquant : ${state}`);
}

/* -- Bibliotheque R2 ------------------------------------------------ */

assert.ok(shellSource.includes('handleVisualLibrary'), 'bibliotheque de visuels R2 manquante');
assert.ok(shellSource.includes("MEDIA_PREFIX = 'visuals/media/'"), 'prefixe media R2 existant non reutilise');
assert.ok(shellSource.includes('VISUALS_BUCKET.list'), 'listing R2 manquant');
assert.equal(/VISUALS_BUCKET\.put\(\s*`?\$?\{?MEDIA_PREFIX/.test(shellSource), false, 'le cockpit ne doit jamais ecrire dans visuals/media/');

/* -- Content Memory ------------------------------------------------- */

assert.ok(memorySource.includes('rememberMeasuredContent'), 'memoire des contenus mesures manquante');
assert.ok(memorySource.includes('rememberPublication'), 'memoire des publications manquante');
assert.ok(memorySource.includes('has_measured_data'), 'distinction mesure/non mesure manquante');
assert.ok(shellSource.includes('rememberPublicationInMemory'), 'memoire non alimentee a la publication');

/* -- Securite ------------------------------------------------------- */

assert.ok(shellSource.includes("const COOKIE_NAME = '__Host-sowhat_si'"), 'cookie __Host- manquant');
assert.ok(shellSource.includes('HttpOnly; Secure; SameSite=Strict'), 'attributs de cookie securises manquants');
assert.ok(shellSource.includes('AUTH_MAX_ATTEMPTS = 5'), 'limiteur de force brute manquant');
assert.ok(shellSource.includes('X-SOWHAT-CSRF'), 'protection CSRF manquante');
assert.ok(shellSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'binding de hachage du mot de passe manquant');
assert.ok(shellSource.includes("form-action 'self'"), 'restriction CSP des formulaires manquante');
assert.ok(shellSource.includes('no-store, no-cache, must-revalidate'), 'interdiction de cache prive manquante');
assert.ok(shellSource.includes("script-src ${scriptSource}"), 'CSP a nonce manquante');
assert.equal(shellSource.includes("'unsafe-inline'"), false, "la CSP ne doit plus autoriser 'unsafe-inline'");
const uiWithoutComments = uiSource.replace(/\/\*[\s\S]*?\*\//g, '');
assert.equal(/ style="/.test(uiWithoutComments), false, 'aucun attribut style= en ligne ne doit subsister dans le rendu');

/* -- Mobile et PWA -------------------------------------------------- */

assert.ok(uiSource.includes('@media(hover:none) and (pointer:coarse)'), 'surcharge tactile mobile manquante');
assert.ok(uiSource.includes('.rail{display:none!important}'), 'la sidebar bureau doit rester masquee sur tactile');
assert.ok(uiSource.includes('grid-template-columns:repeat(6,1fr)'), 'navigation mobile a six actions manquante');
assert.ok(uiSource.includes('viewport-fit=cover'), 'support safe-area manquant');
assert.ok(uiSource.includes('env(safe-area-inset-bottom)'), 'marge safe-area basse manquante');
assert.ok(uiSource.includes('@media(prefers-reduced-motion:reduce)'), 'respect de prefers-reduced-motion manquant');
assert.ok(shellSource.includes('manifest.webmanifest'), 'manifest PWA manquant');
assert.ok(uiSource.includes('serviceWorker'), 'enregistrement du service worker manquant');

/* -- Routeur -------------------------------------------------------- */

assert.ok(routerSource.includes("from './social-intelligence-v3.js'"), 'le routeur n importe pas la coquille');
assert.ok(routerSource.includes('handleSocialIntelligenceV3(request, env, ctx)'), 'le routeur ne route pas la coquille');
assert.ok(routerSource.includes("url.pathname.startsWith('/social-intelligence/')"), 'routes filles non routees');
assert.ok(routerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'fail-closed du routeur manquant');
assert.ok(routerSource.includes('runInstagramSync(env, null)'), 'apprentissage planifie non cable');
assert.ok(routerSource.includes("'senecompare.dakarstyle.com'"), 'routage SeneCompare casse');
assert.ok(routerSource.includes("'samabusiness.dakarstyle.com'"), 'routage Sama Business casse');
assert.ok(routerSource.includes('isCustomStorefront'), 'routage des storefronts personnalises casse');

/* -- Configuration -------------------------------------------------- */

assert.ok(wranglerSource.includes('17 */6 * * *'), 'cron six heures manquant');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_USER'), 'binding utilisateur manquant');
assert.ok(wranglerSource.includes('SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256'), 'binding hachage mot de passe manquant');
assert.ok(wranglerSource.includes('dakarstyle-visuals'), 'bucket R2 existant manquant');

/* -- Hygiene des secrets -------------------------------------------- */

assert.equal(/"SOCIAL_INTELLIGENCE_LOGIN_PASSWORD"\s*:/.test(wranglerSource), false, 'mot de passe en clair interdit');
assert.equal(/INSTAGRAM_ACCESS_TOKEN\s*=\s*['"][^'"]+['"]/.test(engineSource), false, 'credential Instagram en clair detecte');
assert.equal(/Bearer\s+[A-Za-z0-9_-]{24,}/.test(engineSource), false, 'bearer en clair detecte');
assert.equal(/Bearer\s+[A-Za-z0-9_-]{24,}/.test(shellSource), false, 'bearer en clair detecte dans la coquille');

console.log('SOWHAT Social Intelligence v4 contract: PASS');
