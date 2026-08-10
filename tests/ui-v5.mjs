/**
 * SOWHAT Control V5 - Tests de l interface cockpit.
 * Le rendu est une fonction pure : on peut donc auditer le HTML produit.
 */

import assert from 'node:assert/strict';
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

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 ui: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
