/**
 * SOWHAT Control V5 - Tests de l interface cockpit.
 * Le rendu est une fonction pure : on peut donc auditer le HTML produit.
 */

import assert from 'node:assert/strict';
import { STUDIO_CLIENT_ROUTE, STUDIO_CSS, STUDIO_ROUTE, renderStudioDocument } from '../src/studio-ui-v5.js';
import { STUDIO_CLIENT_JS } from '../src/studio-client-v5.js';
import { readFileSync } from 'node:fs';
import {
  COCKPIT_CSS, UI_STATE, deriveState, displayValue, renderBadge,
  renderCockpit, renderCockpitDocument, renderValue,
} from '../src/social-intelligence-ui-v5.js';
import { DESIGN_TOKENS } from '../src/social-intelligence-ui-v4.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

function cockpit(overrides = {}) {
  return {
    generated_at: '2026-07-01T12:00:00.000Z',
    instagram: { configured: true, token_health: { status: 'valid', checked_at: '2026-07-01T11:59:00.000Z' } },
    sync: {
      last_run: { sync_id: 'S1', status: 'success', finished_at: '2026-07-01T11:00:00.000Z' },
      last_success_at: '2026-07-01T11:00:00.000Z',
      failed_runs: 0, partial_runs: 0,
      next_run_at: '2026-07-01T17:17:00.000Z',
      known_media_count: 42,
    },
    publication: { queue: [], queue_size: 0, due_now: 0, failed_last_runs: 0, manual_check_last_runs: 0, last_run: null },
    recent_errors: [],
    ...overrides,
  };
}

/* ---------------- Le design V4 est preserve ---------------- */

test('le cockpit reutilise les tokens V4 et n en redefinit aucun', () => {
  const document = renderCockpitDocument(cockpit());
  assert.ok(document.includes(DESIGN_TOKENS), 'les tokens V4 doivent etre inclus tels quels');
  for (const token of ['--gold', '--panel', '--txt', '--danger']) {
    assert.ok(!new RegExp(`${token}\\s*:`).test(COCKPIT_CSS), `le CSS V5 ne doit pas redefinir ${token}`);
    assert.ok(COCKPIT_CSS.includes(`var(${token})`), `le CSS V5 doit consommer ${token}`);
  }
});

test('le fichier V4 n est pas modifie par la V5', () => {
  const v4 = readFileSync(new URL('../src/social-intelligence-ui-v4.js', import.meta.url), 'utf8');
  assert.ok(!v4.includes('v5-cockpit'), 'aucune classe V5 ne doit avoir ete injectee dans la V4');
  assert.ok(!v4.includes('COCKPIT_CSS'));
});

/* ---------------- Etats ---------------- */

test('les douze etats exiges existent', () => {
  for (const state of ['loading', 'empty', 'partial', 'success', 'warning', 'error', 'offline', 'token_expired', 'syncing', 'publishing', 'scheduled', 'published']) {
    assert.ok(Object.values(UI_STATE).includes(state), `etat manquant : ${state}`);
    assert.ok(renderBadge(state).includes(`data-state="${state}"`));
  }
});

test('etat deduit sans optimisme : jeton expire, echec, partiel, attention', () => {
  assert.equal(deriveState(null), UI_STATE.LOADING);
  assert.equal(deriveState(cockpit({ instagram: { configured: false, token_health: {} } })), UI_STATE.EMPTY);
  assert.equal(deriveState(cockpit({ instagram: { configured: true, token_health: { status: 'expired' } } })), UI_STATE.TOKEN_EXPIRED);
  assert.equal(deriveState(cockpit({ instagram: { configured: true, token_health: { status: 'invalid' } } })), UI_STATE.TOKEN_EXPIRED);
  assert.equal(deriveState(cockpit({ instagram: { configured: true, token_health: { status: 'insufficient_permissions' } } })), UI_STATE.ERROR);
  assert.equal(deriveState(cockpit({ sync: { last_run: { status: 'failed' } } })), UI_STATE.ERROR);
  assert.equal(deriveState(cockpit({ sync: { last_run: { status: 'partial' } } })), UI_STATE.PARTIAL);
  assert.equal(deriveState(cockpit({ sync: { last_run: null } })), UI_STATE.EMPTY);
});

test('une verification humaine en attente n est jamais affichee comme un succes', () => {
  const state = deriveState(cockpit({
    publication: { queue: [], queue_size: 0, due_now: 0, failed_last_runs: 0, manual_check_last_runs: 1 },
  }));
  assert.equal(state, UI_STATE.WARNING);
});

test('un jeton de sante inconnue ne passe pas pour valide', () => {
  assert.equal(deriveState(cockpit({ instagram: { configured: true, token_health: { status: 'unknown' } } })), UI_STATE.WARNING);
});

test('tout va bien : succes, et seulement dans ce cas', () => {
  assert.equal(deriveState(cockpit()), UI_STATE.SUCCESS);
});

/* ---------------- Inconnu n est pas zero ---------------- */

test('une valeur absente s affiche inconnu, jamais 0', () => {
  assert.deepEqual(displayValue(null), { text: 'inconnu', unknown: true });
  assert.deepEqual(displayValue(undefined), { text: 'inconnu', unknown: true });
  assert.deepEqual(displayValue(''), { text: 'inconnu', unknown: true });
  assert.deepEqual(displayValue(Number.NaN), { text: 'inconnu', unknown: true });
  assert.deepEqual(displayValue(0), { text: '0', unknown: false }, 'un zero mesure reste un zero');
});

test('le rendu marque explicitement les valeurs inconnues', () => {
  const html = renderCockpit(cockpit({
    sync: { last_run: null, failed_runs: null, next_run_at: null, known_media_count: null },
  }));
  assert.ok(html.includes('data-unknown="true"'));
  assert.ok(html.includes('jamais'));
  assert.ok(!/Contenus connus<\/span><span class="v5-value" data-unknown="false">0/.test(html), 'un compte inconnu ne doit pas s afficher 0');
});

/* ---------------- Securite du rendu ---------------- */

test('aucun evenement en ligne ni style en ligne : compatible CSP stricte', () => {
  const html = renderCockpitDocument(cockpit({
    publication: { queue: [{ draft_id: 'D1', state: 'SCHEDULED', scheduled_for: '2026-07-02T10:00:00Z', due: false }], queue_size: 1, due_now: 0 },
    recent_errors: [{ error_code: 'meta_rate_limited', at: '2026-07-01T10:00:00Z', detail: 'quota' }],
  }));
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'aucun gestionnaire d evenement en ligne');
  assert.ok(!/\sstyle\s*=/i.test(html), 'aucun style en ligne');
  assert.ok(!/<script/i.test(html), 'aucun script inline');
});

test('les donnees sont echappees : aucune injection possible', () => {
  const html = renderCockpit(cockpit({
    publication: {
      queue: [{ draft_id: '<img src=x onerror=alert(1)>', state: 'SCHEDULED', scheduled_for: null, due: true }],
      queue_size: 1, due_now: 1,
    },
    recent_errors: [{ error_code: '<script>alert(2)</script>', detail: '"><svg onload=alert(3)>' }],
  }));
  // Le texte hostile peut rester lisible, mais il ne doit plus former de
  // balise ni d attribut : ce sont les chevrons et les guillemets qui font
  // l injection, pas le mot « onerror ».
  assert.ok(!html.includes('<img'), 'aucune balise img reconstituee');
  assert.ok(!html.includes('<svg'), 'aucune balise svg reconstituee');
  assert.ok(!html.includes('<script>alert(2)'), 'aucun script reconstitue');
  assert.ok(!/<[a-z]+[^>]*\son[a-z]+\s*=/i.test(html), 'aucun attribut evenementiel dans une balise');
  assert.ok(html.includes('&lt;img'), 'le contenu hostile doit apparaitre echappe');
  assert.ok(html.includes('&quot;') || html.includes('&#39;'), 'les guillemets doivent etre echappes');
});

/* ---------------- Responsive et accessibilite ---------------- */

test('cibles tactiles a 44 px au minimum', () => {
  const actions = COCKPIT_CSS.match(/\.v5-action\{[^}]+\}/)[0];
  assert.ok(actions.includes('min-height:44px'));
  assert.ok(actions.includes('min-width:44px'));
  assert.ok(COCKPIT_CSS.includes('.v5-queue li') && /\.v5-queue li\{[^}]*min-height:44px/.test(COCKPIT_CSS));
});

test('marges de securite prises en compte', () => {
  for (const inset of ['safe-area-inset-left', 'safe-area-inset-right', 'safe-area-inset-bottom']) {
    assert.ok(COCKPIT_CSS.includes(`env(${inset})`), `marge ${inset} absente`);
  }
  assert.ok(renderCockpitDocument(cockpit()).includes('viewport-fit=cover'), 'sans viewport-fit, les marges de securite ne s appliquent pas');
});

test('aucun debordement horizontal possible', () => {
  assert.ok(COCKPIT_CSS.includes('overflow-x:hidden'));
  assert.ok(COCKPIT_CSS.includes('max-width:100%'));
  assert.ok(COCKPIT_CSS.includes('overflow-wrap:anywhere'), 'un identifiant tres long doit se couper');
  assert.ok(COCKPIT_CSS.includes('minmax(0,1fr)'), 'sans minmax(0,...) une grille CSS deborde');
  assert.ok(COCKPIT_CSS.includes('min-width:0'));
});

test('grille fluide de 360 a 1280 px', () => {
  assert.ok(COCKPIT_CSS.includes('grid-template-columns:1fr'), 'une seule colonne sur les petits ecrans');
  assert.ok(COCKPIT_CSS.includes('@media(min-width:768px)'));
  assert.ok(COCKPIT_CSS.includes('@media(min-width:1280px)'));
  assert.ok(COCKPIT_CSS.includes('flex-wrap:wrap'), 'les lignes doivent pouvoir passer a la ligne a 360 px');
});

test('mouvement reduit respecte et focus visible', () => {
  assert.ok(COCKPIT_CSS.includes('prefers-reduced-motion'));
  assert.ok(COCKPIT_CSS.includes(':focus-visible'));
});

test('le chargement est annonce, pas devine', () => {
  const html = renderCockpit(null);
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes(`data-state="${UI_STATE.LOADING}"`));
  assert.ok(html.includes('v5-skeleton'));
});

test('files et erreurs vides : message explicite, pas un vide ambigu', () => {
  const html = renderCockpit(cockpit());
  assert.ok(html.includes('Aucune publication en attente'));
  assert.ok(html.includes('Aucune erreur recente'));
});

test('renderValue produit une paire libelle/valeur echappee', () => {
  const html = renderValue('Compte & statut', '<b>x</b>');
  assert.ok(html.includes('Compte &amp; statut'));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
});

/* ---------------- Ecran Publier : structure ---------------- */

test('le Studio reutilise les tokens V4 et n en redefinit aucun', () => {
  const document = renderStudioDocument();
  assert.ok(document.includes(DESIGN_TOKENS), 'les tokens V4 doivent etre inclus tels quels');
  for (const token of ['--gold', '--panel', '--txt', '--danger', '--muted']) {
    assert.ok(!new RegExp(`${token}\\s*:`).test(STUDIO_CSS), `le CSS du Studio ne doit pas redefinir ${token}`);
    assert.ok(STUDIO_CSS.includes(`var(${token})`), `le CSS du Studio doit consommer ${token}`);
  }
});

test('le parcours attendu est present, dans l ordre', () => {
  const full = renderStudioDocument();
  // Seul le corps compte : la feuille de style contient les memes mots.
  const document = full.slice(full.indexOf('<body'));
  const steps = [
    'Ajouter une photo ou une video',
    'Format',
    'Legende',
    'Hashtags',
    'Apercu Instagram',
    'Publier maintenant',
  ];
  let cursor = -1;
  for (const step of steps) {
    const at = document.indexOf(step);
    assert.ok(at > cursor, `etape hors sequence ou absente : ${step}`);
    cursor = at;
  }
});

test('le selecteur de fichier accepte exactement les formats supportes', () => {
  const document = renderStudioDocument();
  assert.ok(document.includes('type="file"'));
  assert.ok(document.includes('accept="image/jpeg,image/png,video/mp4"'));
  assert.equal(/type="url"/i.test(document), false, 'aucun champ URL');
  assert.equal(/coller.{0,20}(lien|url)/i.test(document), false, 'aucune invitation a coller une URL');
});

test('aucune notion technique n apparait a l ecran', () => {
  const document = renderStudioDocument();
  for (const word of ['r2_key', 'R2', 'bucket', 'SOWHAT_MEDIA_PUBLIC_BASE', 'media_url', 'JSON', 'API Meta', 'container']) {
    assert.equal(document.includes(word), false, `« ${word} » ne doit jamais etre montre a l operateur`);
  }
});

test('les trois actions existent, avec une hierarchie visuelle explicite', () => {
  const document = renderStudioDocument();
  assert.ok(document.includes('Enregistrer le brouillon'));
  assert.ok(document.includes('Programmer'));
  assert.ok(document.includes('Publier maintenant'));
  const publish = document.slice(document.indexOf('id="st-publish"') - 120, document.indexOf('id="st-publish"') + 40);
  assert.ok(publish.includes('data-variant="primary"'), 'Publier maintenant est l action principale');
  assert.ok(publish.includes('disabled'), 'elle est fermee tant que rien n est pret');
});

test('les compteurs de legende et de hashtags sont affiches', () => {
  const document = renderStudioDocument();
  assert.ok(document.includes('/ 2200'));
  assert.ok(document.includes('/ 30'));
  assert.ok(document.includes('maxlength="2200"'));
});

test('l apercu Instagram distingue la photo carree du Reel vertical', () => {
  assert.ok(/\.st-ig-media\{[^}]*aspect-ratio:1\/1/.test(STUDIO_CSS), 'photo carree');
  assert.ok(/\[data-format="REEL"\] \.st-ig-media\{aspect-ratio:9\/16\}/.test(STUDIO_CSS), 'Reel vertical');
  assert.ok(renderStudioDocument().includes('data-format="IMAGE"'));
});

/* ---------------- Ecran Publier : securite du rendu ---------------- */

test('aucun evenement en ligne, aucun style en ligne, aucun script inline', () => {
  const document = renderStudioDocument({ prefill: { caption: 'test' } });
  assert.equal(/\son(click|change|error|load|submit|input)\s*=/i.test(document), false);
  assert.equal(/<[a-z]+[^>]*\sstyle\s*=/i.test(document), false, 'aucun style en ligne');
  assert.equal(/<script(?![^>]*(src=|type="application\/json"))/i.test(document), false, 'aucun script executable inline');
  assert.ok(document.includes(`src="${STUDIO_CLIENT_ROUTE}"`), 'le comportement vit dans un fichier a part');
});

test('le preremplissage ne peut pas s echapper de sa balise', () => {
  const document = renderStudioDocument({
    prefill: { caption: '</script><img src=x onerror=alert(1)>', cta: '"><script>alert(2)</script>' },
    draftId: '"><script>alert(3)</script>',
  });
  assert.equal(document.includes('</script><img'), false, 'la balise ne doit pas pouvoir etre fermee');
  assert.equal(/<img[^>]*onerror/i.test(document), false);
  assert.equal(document.includes('<script>alert('), false);
  assert.ok(document.includes('\\u003c'), 'les chevrons du preremplissage sont neutralises');
});

test('la page n est pas indexable et declare son echelle mobile', () => {
  const document = renderStudioDocument();
  assert.ok(document.includes('noindex,nofollow,noarchive'));
  assert.ok(document.includes('viewport-fit=cover'));
  assert.ok(document.includes('width=device-width,initial-scale=1'));
  assert.equal(/maximum-scale|user-scalable=no/.test(document), false, 'le zoom ne doit jamais etre bloque');
});

/* ---------------- Ecran Publier : responsive ---------------- */

test('toutes les cibles tactiles du Studio tiennent 44 px', () => {
  for (const rule of ['.st-btn', '.st-back', '.st-input,.st-textarea,.st-select', '.st-optional summary']) {
    const pattern = new RegExp(`${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*min-height:(4[4-9]|[5-9]\\d)px`);
    assert.ok(pattern.test(STUDIO_CSS), `cible tactile trop petite : ${rule}`);
  }
  assert.ok(/\.st-btn\{[^}]*min-width:44px/.test(STUDIO_CSS));
});

test('marges de securite prises en compte sur les quatre bords utiles', () => {
  for (const inset of ['safe-area-inset-top', 'safe-area-inset-bottom', 'safe-area-inset-left', 'safe-area-inset-right']) {
    assert.ok(STUDIO_CSS.includes(`env(${inset})`), `marge de securite absente : ${inset}`);
  }
  assert.ok(/\.st-actions\{[^}]*padding-bottom:calc\(10px \+ env\(safe-area-inset-bottom\)\)/.test(STUDIO_CSS),
    'la barre d actions doit rester au-dessus de la barre systeme');
});

test('aucun debordement horizontal, quelle que soit la longueur du contenu', () => {
  assert.ok(/\.st-page\{[^}]*overflow-x:hidden/.test(STUDIO_CSS));
  assert.ok(/\.st-page\{[^}]*max-width:100%/.test(STUDIO_CSS));
  assert.ok(STUDIO_CSS.includes('overflow-wrap:anywhere'), 'une legende sans espace ne doit pas elargir la page');
  assert.ok(STUDIO_CSS.includes('word-break:break-word'));
  assert.ok(STUDIO_CSS.includes('min-width:0'), 'les grilles doivent pouvoir se retrecir');
  assert.ok(/\.st-page img,\.st-page video\{max-width:100%/.test(STUDIO_CSS));
});

test('grille fluide de 360 a 1280 px, sans point de rupture inutile', () => {
  for (const breakpoint of ['412px', '768px', '1280px']) {
    assert.ok(STUDIO_CSS.includes(`@media(min-width:${breakpoint})`), `point de rupture manquant : ${breakpoint}`);
  }
  // 360, 390 et 430 px sont couverts par la mise en page de base : une seule
  // colonne fluide, sans largeur fixe.
  // Les bornes `min-width` (points de rupture) et `max-width` (confort de
  // lecture) sont legitimes ; une largeur fixe ne l est jamais.
  assert.equal(/[^-]width:\s*\d{3,}px/.test(STUDIO_CSS), false, 'aucune largeur fixe en pixels');
});

test('mouvement reduit respecte et focus toujours visible', () => {
  assert.ok(STUDIO_CSS.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(STUDIO_CSS.includes(':focus-visible'));
  assert.ok(STUDIO_CSS.includes('touch-action:manipulation'), 'pas de double-tap zoom sur les boutons');
});

test('la saisie ne declenche pas le zoom automatique sur mobile', () => {
  assert.ok(/\.st-input,\.st-textarea,\.st-select\{[^}]*font-size:16px/.test(STUDIO_CSS),
    'un champ sous 16 px provoque un zoom force sur iOS et un rendu tasse sur Android');
});

/* ---------------- Comportement client ---------------- */

test('le script client n execute aucun code construit dynamiquement', () => {
  assert.equal(/\beval\s*\(/.test(STUDIO_CLIENT_JS), false);
  assert.equal(/new Function\s*\(/.test(STUDIO_CLIENT_JS), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(STUDIO_CLIENT_JS), false,
    'le DOM est construit, jamais ecrit en HTML');
  assert.ok(STUDIO_CLIENT_JS.includes('textContent'), 'les donnees passent par textContent');
});

test('le script client ne parle qu a sa propre origine', () => {
  assert.equal(/https?:\/\//.test(STUDIO_CLIENT_JS), false, 'aucune origine externe');
  assert.ok(STUDIO_CLIENT_JS.includes("var API = '/api/social-intelligence/v5/'"), 'chemins relatifs uniquement');
  assert.ok(STUDIO_CLIENT_JS.includes("credentials: 'same-origin'"));
  assert.ok(STUDIO_CLIENT_JS.includes("x-sowhat-csrf"), 'toute ecriture porte le jeton CSRF');
});

test('chaque erreur technique connue a une traduction lisible', () => {
  const codes = [
    'media_invalid', 'media_too_large', 'media_signature_mismatch', 'media_storage_failed',
    'csrf_invalid', 'csrf_expired', 'unauthorized',
    'meta_not_configured', 'meta_token_expired',
    'safe_gate_closed', 'publish_media_url_not_configured',
    'studio_schedule_in_past', 'studio_validation_failed', 'network',
  ];
  for (const code of codes) {
    assert.ok(new RegExp(`${code}:\\s*'`).test(STUDIO_CLIENT_JS), `code sans traduction : ${code}`);
  }
  assert.ok(STUDIO_CLIENT_JS.includes('La session a expire. Rechargez la page.'));
  assert.ok(STUDIO_CLIENT_JS.includes('Instagram n est pas encore connecte.'));
  assert.ok(STUDIO_CLIENT_JS.includes('Le stockage media n est pas encore configure pour la publication.'));
  assert.ok(STUDIO_CLIENT_JS.includes('La connexion Instagram doit etre renouvelee.'));
});

test('aucun code technique ni trace d exception n atteint l ecran', () => {
  assert.equal(/\.stack\b/.test(STUDIO_CLIENT_JS), false, 'aucune pile d appel affichee');
  // Les messages affiches passent tous par humanError, qui retombe sur une
  // phrase generique plutot que sur un code brut.
  assert.ok(STUDIO_CLIENT_JS.includes('function humanError'));
  assert.ok(STUDIO_CLIENT_JS.includes('return MESSAGES.unknown'));
});

test('publier est impossible tant que le media n est pas pret', () => {
  assert.ok(STUDIO_CLIENT_JS.includes('Boolean(state.media)'));
  assert.ok(STUDIO_CLIENT_JS.includes('!state.uploading'));
  assert.ok(STUDIO_CLIENT_JS.includes('!state.busy'), 'un second clic ne peut pas partir pendant le premier');
  assert.ok(STUDIO_CLIENT_JS.includes('nodes.publish.disabled = !ready'));
});

test('l apercu du fichier reste local tant qu il n est pas envoye', () => {
  assert.ok(STUDIO_CLIENT_JS.includes('URL.createObjectURL'));
  assert.ok(STUDIO_CLIENT_JS.includes('URL.revokeObjectURL'), 'la memoire est rendue au navigateur');
});

test('la progression affichee est mesuree, jamais simulee', () => {
  assert.ok(STUDIO_CLIENT_JS.includes('request.upload.onprogress'));
  assert.ok(STUDIO_CLIENT_JS.includes('event.lengthComputable'));
  assert.equal(/setInterval|setTimeout\s*\([^)]*progress/i.test(STUDIO_CLIENT_JS), false,
    'aucune barre qui avance toute seule');
});

test('un fichier depose n est jamais envoye deux fois', () => {
  assert.ok(STUDIO_CLIENT_JS.includes('if (event.target === nodes.file) return;'),
    'le depot natif sur le champ fichier declenche deja « change »');
});

test('apres publication, plus rien n est modifiable depuis l ecran', () => {
  assert.ok(STUDIO_CLIENT_JS.includes('state.published = true'));
  assert.ok(STUDIO_CLIENT_JS.includes('&& !state.published'));
  assert.ok(STUDIO_CLIENT_JS.includes('state.busy || state.uploading || state.published'));
});

test('les colonnes espacent leurs cartes a toutes les tailles', () => {
  assert.ok(/\.st-col\{[^}]*display:grid[^}]*gap:14px/.test(STUDIO_CSS), 'espacement de base');
  assert.ok(/@media\(min-width:412px\)\{[^@]*\.st-col\{gap:16px\}/.test(STUDIO_CSS), 'espacement elargi');
  assert.ok(/@media\(min-width:1280px\)\{[^@]*\.st-col-preview\{position:sticky/.test(STUDIO_CSS),
    'l apercu ne devient collant qu en bureau');
});

test('le chemin du script et celui de l ecran sont coherents', () => {
  assert.equal(STUDIO_ROUTE, '/social-intelligence/v5/studio');
  assert.equal(STUDIO_CLIENT_ROUTE, '/social-intelligence/v5/studio/app.js');
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 ui: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
