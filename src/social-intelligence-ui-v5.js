/**
 * SOWHAT Control V5 - Cockpit d etat
 *
 * Ce module N AJOUTE QUE les capacites V5. Il ne redefinit aucune couleur,
 * aucune typographie, aucun composant V4 : il importe DESIGN_TOKENS et
 * escapeHtml du socle V4 et s y conforme. Le design valide n est pas retouche.
 *
 * Trois exigences tenues par construction :
 *   - aucun etat n est deguise : « inconnu » s affiche « inconnu », jamais 0 ;
 *   - aucun evenement en ligne, aucun style en ligne : compatible avec une CSP
 *     stricte sans unsafe-inline ;
 *   - aucune donnee n est injectee sans echappement.
 */

import { DESIGN_TOKENS, escapeHtml } from './social-intelligence-ui-v4.js';

/**
 * Entree principale du cockpit. « Publier » est la seule action que
 * l operateur cherche en arrivant : elle est en haut, pleine largeur, et
 * n exige aucune lecture prealable du reste de l ecran.
 */
export const STUDIO_LINK = '/social-intelligence/v5/studio';

/** Etats d affichage possibles du cockpit. */
export const UI_STATE = Object.freeze({
  LOADING: 'loading',
  EMPTY: 'empty',
  PARTIAL: 'partial',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  OFFLINE: 'offline',
  TOKEN_EXPIRED: 'token_expired',
  SYNCING: 'syncing',
  PUBLISHING: 'publishing',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
});

const STATE_LABEL = {
  loading: 'Chargement',
  empty: 'Aucune donnee',
  partial: 'Donnees partielles',
  success: 'A jour',
  warning: 'Attention',
  error: 'Erreur',
  offline: 'Hors ligne',
  token_expired: 'Jeton expire',
  syncing: 'Synchronisation en cours',
  publishing: 'Publication en cours',
  scheduled: 'Programme',
  published: 'Publie',
};

const STATE_TONE = {
  loading: 'neutral', empty: 'neutral', partial: 'warn', success: 'good',
  warning: 'warn', error: 'danger', offline: 'danger', token_expired: 'danger',
  syncing: 'neutral', publishing: 'neutral', scheduled: 'neutral', published: 'good',
};

/**
 * Feuille de style V5. Elle s appuie sur les variables V4 et n en cree aucune
 * nouvelle couleur. Points non negociables :
 *   - cibles tactiles a 44 px minimum ;
 *   - marges de securite (encoches, barres systeme) prises en compte ;
 *   - aucun debordement horizontal, quel que soit le contenu ;
 *   - grille fluide de 360 a 1280 px, sans point de rupture code en dur au
 *     dela de ce que le contenu exige.
 */
export const COCKPIT_CSS = `
.v5-cockpit{
  box-sizing:border-box;
  width:100%;
  max-width:100%;
  overflow-x:hidden;
  padding:16px;
  padding-left:calc(16px + env(safe-area-inset-left));
  padding-right:calc(16px + env(safe-area-inset-right));
  padding-bottom:calc(16px + env(safe-area-inset-bottom));
  color:var(--txt);
}
.v5-cockpit *,.v5-cockpit *::before,.v5-cockpit *::after{box-sizing:inherit}
.v5-grid{display:grid;grid-template-columns:1fr;gap:12px}
.v5-card{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:14px;
  padding:14px;
  min-width:0;
}
.v5-card h3{margin:0 0 8px;font-size:14px;letter-spacing:.04em;color:var(--soft);text-transform:uppercase}
.v5-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;min-width:0}
.v5-label{color:var(--muted);font-size:13px;min-width:0}
.v5-value{
  color:var(--txt);font-size:15px;font-variant-numeric:tabular-nums;
  min-width:0;overflow-wrap:anywhere;word-break:break-word;
}
.v5-value[data-unknown="true"]{color:var(--muted);font-style:italic}
.v5-badge{
  display:inline-flex;align-items:center;gap:6px;
  min-height:28px;padding:4px 10px;border-radius:999px;
  border:1px solid var(--line2);font-size:12px;letter-spacing:.03em;
  background:var(--panel2);color:var(--soft);
}
.v5-badge[data-tone="good"]{color:var(--good);border-color:var(--good)}
.v5-badge[data-tone="warn"]{color:var(--warn);border-color:var(--warn)}
.v5-badge[data-tone="danger"]{color:var(--danger);border-color:var(--danger)}
.v5-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 auto}
.v5-action{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:44px;min-width:44px;padding:10px 16px;
  border-radius:12px;border:1px solid var(--line2);
  background:var(--panel2);color:var(--txt);
  font-size:14px;cursor:pointer;touch-action:manipulation;
}
.v5-action:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.v5-action[disabled]{opacity:.5;cursor:not-allowed}
.v5-queue{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.v5-queue li{
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;
  padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);
  min-height:44px;min-width:0;
}
.v5-errors{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.v5-errors li{
  font-size:13px;color:var(--soft);padding:8px 10px;
  border-left:2px solid var(--danger);background:var(--panel2);border-radius:0 10px 10px 0;
  overflow-wrap:anywhere;
}
.v5-empty{color:var(--muted);font-size:13px;font-style:italic}
.v5-publish{
  display:flex;align-items:center;justify-content:center;gap:10px;
  min-height:56px;width:100%;margin:0 0 14px;padding:14px 18px;
  border-radius:16px;border:1px solid var(--gold);
  background:var(--gold);color:#1a1408;
  font-size:17px;font-weight:600;letter-spacing:.02em;
  text-decoration:none;text-align:center;touch-action:manipulation;
}
.v5-publish:focus-visible{outline:2px solid var(--gold2);outline-offset:3px}
.v5-publish-note{margin:-8px 0 14px;color:var(--muted);font-size:13px;text-align:center}
.v5-skeleton{height:14px;border-radius:6px;background:var(--panel2);border:1px solid var(--line)}
@media(min-width:412px){
  .v5-cockpit{padding:20px;padding-left:calc(20px + env(safe-area-inset-left));padding-right:calc(20px + env(safe-area-inset-right))}
}
@media(min-width:768px){
  .v5-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(min-width:1280px){
  .v5-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .v5-cockpit{padding:24px}
}
@media(prefers-reduced-motion:reduce){
  .v5-cockpit *{animation:none!important;transition:none!important}
}
`;

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

/** Valeur affichable : ce qui est inconnu est ecrit « inconnu », pas 0. */
export function displayValue(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return { text: options.unknownLabel || 'inconnu', unknown: true };
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { text: options.unknownLabel || 'inconnu', unknown: true };
  }
  return { text: String(value), unknown: false };
}

export function renderValue(label, value, options = {}) {
  const shown = displayValue(value, options);
  return `<div class="v5-row"><span class="v5-label">${escapeHtml(label)}</span>`
    + `<span class="v5-value" data-unknown="${shown.unknown}">${escapeHtml(shown.text)}</span></div>`;
}

export function renderBadge(state, labelOverride) {
  const key = Object.values(UI_STATE).includes(state) ? state : UI_STATE.EMPTY;
  const label = labelOverride || STATE_LABEL[key];
  return `<span class="v5-badge" data-tone="${STATE_TONE[key]}" data-state="${key}">`
    + `<span class="v5-dot"></span>${escapeHtml(label)}</span>`;
}

/** Etat global deduit du cockpit technique. Aucune supposition optimiste. */
export function deriveState(cockpit) {
  if (!cockpit) return UI_STATE.LOADING;
  if (!cockpit.instagram?.configured) return UI_STATE.EMPTY;

  const tokenStatus = cockpit.instagram?.token_health?.status;
  if (tokenStatus === 'expired' || tokenStatus === 'invalid') return UI_STATE.TOKEN_EXPIRED;
  if (tokenStatus === 'insufficient_permissions') return UI_STATE.ERROR;

  const last = cockpit.sync?.last_run;
  if (!last) return UI_STATE.EMPTY;
  if (last.status === 'failed') return UI_STATE.ERROR;
  if (last.status === 'partial') return UI_STATE.PARTIAL;

  if ((cockpit.publication?.failed_last_runs ?? 0) > 0
    || (cockpit.publication?.manual_check_last_runs ?? 0) > 0) return UI_STATE.WARNING;
  if ((cockpit.publication?.due_now ?? 0) > 0) return UI_STATE.SCHEDULED;
  if (tokenStatus === 'unknown') return UI_STATE.WARNING;
  return UI_STATE.SUCCESS;
}

function renderQueue(queue) {
  const rows = Array.isArray(queue) ? queue : [];
  if (!rows.length) return '<p class="v5-empty">Aucune publication en attente.</p>';
  return `<ul class="v5-queue">${rows.slice(0, 10).map((row) => {
    const state = row.state === 'PUBLISHING' ? UI_STATE.PUBLISHING : UI_STATE.SCHEDULED;
    const when = displayValue(row.scheduled_for, { unknownLabel: 'date inconnue' });
    return `<li><span class="v5-value">${escapeHtml(String(row.draft_id || 'sans identifiant'))}</span>`
      + `<span class="v5-label">${escapeHtml(when.text)}</span>`
      + `${renderBadge(state, row.due ? 'Echeance atteinte' : STATE_LABEL[state])}</li>`;
  }).join('')}</ul>`;
}

function renderErrors(errors) {
  const rows = Array.isArray(errors) ? errors : [];
  if (!rows.length) return '<p class="v5-empty">Aucune erreur recente.</p>';
  return `<ul class="v5-errors">${rows.slice(0, 5).map((error) => {
    const code = escapeHtml(String(error?.error_code || 'erreur inconnue'));
    const at = escapeHtml(String(error?.at || ''));
    const detail = escapeHtml(String(error?.detail || '').slice(0, 160));
    return `<li><strong>${code}</strong>${at ? ` — ${at}` : ''}${detail ? `<br>${detail}` : ''}</li>`;
  }).join('')}</ul>`;
}

function renderLoading() {
  return `<div class="v5-card"><h3>Etat Instagram</h3>
    <div class="v5-skeleton"></div><div class="v5-skeleton"></div><div class="v5-skeleton"></div></div>`;
}

/**
 * Rend le cockpit V5. `cockpit` peut etre `null` : l interface affiche alors un
 * etat de chargement explicite plutot qu une page vide ambigue.
 */
export function renderCockpit(cockpit, options = {}) {
  const state = options.state || deriveState(cockpit);

  if (!cockpit) {
    return `<section class="v5-cockpit" data-state="${UI_STATE.LOADING}" aria-busy="true">
      <div class="v5-row"><h2>SOWHAT Control V5</h2>${renderBadge(UI_STATE.LOADING)}</div>
      <div class="v5-grid">${renderLoading()}</div>
    </section>`;
  }

  const connected = cockpit.instagram?.configured;
  const token = cockpit.instagram?.token_health || {};
  const sync = cockpit.sync || {};
  const publication = cockpit.publication || {};

  return `<section class="v5-cockpit" data-state="${state}">
  <div class="v5-row">
    <h2>SOWHAT Control V5</h2>
    ${renderBadge(state)}
  </div>
  <a class="v5-publish" href="${escapeHtml(STUDIO_LINK)}">Publier une photo ou une video</a>
  <p class="v5-publish-note">Choisissez un fichier, ecrivez la legende, publiez ou programmez.</p>
  <div class="v5-grid">
    <article class="v5-card">
      <h3>Instagram</h3>
      ${renderValue('Compte', connected ? 'connecte' : 'non connecte')}
      ${renderValue('Sante du jeton', token.status === 'valid' ? 'valide' : (token.status || null), { unknownLabel: 'inconnue' })}
      ${renderValue('Verifie le', token.checked_at, { unknownLabel: 'jamais verifie' })}
    </article>
    <article class="v5-card">
      <h3>Synchronisation</h3>
      ${renderValue('Derniere sync', sync.last_run?.finished_at, { unknownLabel: 'jamais' })}
      ${renderValue('Statut', sync.last_run?.status, { unknownLabel: 'inconnu' })}
      ${renderValue('Prochaine sync', sync.next_run_at, { unknownLabel: 'inconnue' })}
      ${renderValue('Contenus connus', sync.known_media_count, { unknownLabel: 'inconnu' })}
      ${renderValue('Syncs en echec', sync.failed_runs, { unknownLabel: 'inconnu' })}
    </article>
    <article class="v5-card">
      <h3>File de publication</h3>
      ${renderValue('En attente', publication.queue_size, { unknownLabel: 'inconnue' })}
      ${renderValue('Echeances atteintes', publication.due_now, { unknownLabel: 'inconnu' })}
      ${renderValue('Verifications humaines', publication.manual_check_last_runs, { unknownLabel: 'inconnu' })}
      ${renderQueue(publication.queue)}
    </article>
    <article class="v5-card">
      <h3>Erreurs recentes</h3>
      ${renderErrors(cockpit.recent_errors)}
    </article>
  </div>
</section>`;
}

/** Page autonome du cockpit, utilisable telle quelle ou integree a la V4. */
export function renderCockpitDocument(cockpit, options = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>SOWHAT Control V5</title>
<style>${DESIGN_TOKENS}${COCKPIT_CSS}</style>
</head>
<body>
${renderCockpit(cockpit, options)}
</body>
</html>`;
}
