/**
 * SOWHAT Control V5 - Interface « Publier »
 *
 * Un seul objectif : que quelqu un qui ne sait pas ce qu est un bucket, une
 * cle R2 ou un conteneur Meta puisse publier sur Instagram sans jamais
 * rencontrer ces mots.
 *
 * Le parcours est lineaire et tient sur un pouce :
 *
 *   Ajouter une photo ou une video -> Apercu -> Legende -> Hashtags ->
 *   Apercu Instagram -> Publier maintenant ou Programmer
 *
 * Contraintes de rendu tenues par construction :
 *   - aucun gestionnaire d evenement en ligne, aucun style en ligne, aucun
 *     script inline : la page reste compatible avec une CSP sans unsafe-inline,
 *     le comportement vit dans un fichier servi a part ;
 *   - toute donnee dynamique passe par escapeHtml ;
 *   - aucun champ ne demande ni n affiche d URL : le stockage est invisible ;
 *   - pense pour un ecran de 360 px d abord, elargi ensuite.
 */

import { DESIGN_TOKENS, escapeHtml } from './social-intelligence-ui-v4.js';
import { MAX_CAPTION_LENGTH, MAX_HASHTAGS } from './studio-v5.js';

export const STUDIO_ROUTE = '/social-intelligence/v5/studio';
export const STUDIO_CLIENT_ROUTE = '/social-intelligence/v5/studio/app.js';

/**
 * Feuille de style du Studio. Elle consomme les variables V4 et n en redefinit
 * aucune : le design valide n est pas retouche, il est reutilise.
 */
export const STUDIO_CSS = `
.st-page{
  box-sizing:border-box;width:100%;max-width:100%;overflow-x:hidden;
  color:var(--txt);background:var(--bg);
  min-height:100vh;min-height:100dvh;
  padding:0 0 calc(96px + env(safe-area-inset-bottom));
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-text-size-adjust:100%;
}
.st-page *,.st-page *::before,.st-page *::after{box-sizing:inherit}
.st-page img,.st-page video{max-width:100%;height:auto;display:block}

.st-top{
  position:sticky;top:0;z-index:30;
  display:flex;align-items:center;gap:12px;
  padding:12px 16px;
  padding-top:calc(12px + env(safe-area-inset-top));
  padding-left:calc(16px + env(safe-area-inset-left));
  padding-right:calc(16px + env(safe-area-inset-right));
  background:var(--bg2);border-bottom:1px solid var(--line);
}
.st-top h1{margin:0;font-size:17px;letter-spacing:.02em;font-weight:600;flex:1;min-width:0}
.st-back{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:44px;min-height:44px;padding:0 12px;
  border-radius:12px;border:1px solid var(--line2);
  background:var(--panel2);color:var(--soft);text-decoration:none;font-size:14px;
}
.st-back:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

.st-main{
  display:grid;gap:14px;
  padding:16px;
  padding-left:calc(16px + env(safe-area-inset-left));
  padding-right:calc(16px + env(safe-area-inset-right));
  max-width:1180px;margin:0 auto;
}
.st-card{
  background:var(--panel);border:1px solid var(--line);border-radius:18px;
  padding:16px;min-width:0;
}
.st-card>h2{
  margin:0 0 4px;font-size:15px;font-weight:600;letter-spacing:.01em;
  display:flex;align-items:center;gap:10px;min-width:0;
}
.st-step{
  display:inline-flex;align-items:center;justify-content:center;
  width:26px;height:26px;flex:0 0 auto;border-radius:50%;
  background:var(--panel2);border:1px solid var(--line2);
  color:var(--gold);font-size:13px;font-variant-numeric:tabular-nums;
}
.st-hint{margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.5}

/* --- Zone de depot du media --- */
.st-drop{
  position:relative;display:grid;place-items:center;gap:10px;
  padding:28px 16px;text-align:center;
  border:2px dashed var(--line2);border-radius:16px;
  background:var(--panel2);
  min-height:180px;cursor:pointer;touch-action:manipulation;
}
.st-drop[data-dragging="true"]{border-color:var(--gold);background:var(--panel)}
.st-drop:focus-within{outline:2px solid var(--gold);outline-offset:2px}
.st-drop-plus{
  display:grid;place-items:center;width:56px;height:56px;border-radius:50%;
  background:var(--panel);border:1px solid var(--line2);color:var(--gold);font-size:26px;line-height:1;
}
.st-drop-title{font-size:16px;font-weight:600;color:var(--txt)}
.st-drop-text{font-size:13px;color:var(--muted);line-height:1.5;max-width:34ch}
.st-drop-formats{font-size:12px;color:var(--muted)}
.st-file{
  position:absolute;inset:0;width:100%;height:100%;
  opacity:0;cursor:pointer;
}

/* --- Apercu du fichier choisi --- */
.st-media[hidden]{display:none}
.st-media-frame{
  border-radius:14px;overflow:hidden;background:var(--bg2);
  border:1px solid var(--line);display:grid;place-items:center;
  max-height:60vh;
}
.st-media-frame img,.st-media-frame video{width:100%;max-height:60vh;object-fit:contain;background:#000}
.st-meta{display:grid;gap:4px;margin:12px 0 0;min-width:0}
.st-meta-name{
  font-size:14px;color:var(--soft);overflow-wrap:anywhere;word-break:break-word;
}
.st-meta-line{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.st-media-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}

/* --- Progression --- */
.st-progress[hidden]{display:none}
.st-progress{margin-top:12px}
.st-bar{
  height:8px;border-radius:999px;background:var(--panel2);
  border:1px solid var(--line);overflow:hidden;
}
.st-bar-fill{height:100%;width:0;background:var(--gold);transition:width .2s linear}
@media(prefers-reduced-motion:reduce){.st-bar-fill{transition:none}}
.st-progress-text{margin:6px 0 0;font-size:12px;color:var(--muted)}

/* --- Etat du media --- */
.st-state{
  display:inline-flex;align-items:center;gap:8px;margin-top:12px;
  min-height:32px;padding:4px 12px;border-radius:999px;
  border:1px solid var(--line2);background:var(--panel2);
  font-size:13px;color:var(--soft);
}
.st-state[data-tone="good"]{color:var(--good);border-color:var(--good)}
.st-state[data-tone="warn"]{color:var(--warn);border-color:var(--warn)}
.st-state[data-tone="danger"]{color:var(--danger);border-color:var(--danger)}
.st-state[hidden]{display:none}

/* --- Champs --- */
.st-field{display:grid;gap:6px;margin-bottom:14px;min-width:0}
.st-field:last-child{margin-bottom:0}
.st-field label{font-size:13px;color:var(--soft)}
.st-input,.st-textarea,.st-select{
  width:100%;min-width:0;min-height:44px;
  padding:11px 13px;border-radius:12px;
  border:1px solid var(--line2);background:var(--panel2);color:var(--txt);
  font-size:16px;font-family:inherit;
}
.st-textarea{min-height:132px;resize:vertical;line-height:1.55}
.st-input:focus,.st-textarea:focus,.st-select:focus{outline:2px solid var(--gold);outline-offset:1px}
.st-counter{font-size:12px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
.st-counter[data-over="true"]{color:var(--danger)}
.st-optional{border:0;padding:0;margin:14px 0 0}
.st-optional summary{
  cursor:pointer;min-height:44px;display:flex;align-items:center;
  font-size:14px;color:var(--soft);
}
.st-optional summary:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.st-optional-body{padding-top:12px}
.st-two{display:grid;gap:12px}

/* --- Choix du format --- */
.st-formats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.st-format{position:relative;min-width:0}
.st-format input{position:absolute;opacity:0;width:1px;height:1px}
.st-format span{
  display:grid;gap:2px;min-height:64px;align-content:center;
  padding:10px 14px;border-radius:14px;
  border:1px solid var(--line2);background:var(--panel2);
  color:var(--soft);font-size:14px;cursor:pointer;
}
.st-format span small{color:var(--muted);font-size:12px}
.st-format input:checked+span{border-color:var(--gold);color:var(--txt);background:var(--panel)}
.st-format input:focus-visible+span{outline:2px solid var(--gold);outline-offset:2px}

/* --- Apercu Instagram --- */
.st-preview{max-width:420px;margin:0 auto;width:100%}
.st-ig{
  border:1px solid var(--line);border-radius:16px;overflow:hidden;
  background:var(--panel2);
}
.st-ig-head{display:flex;align-items:center;gap:10px;padding:10px 12px;min-width:0}
.st-ig-avatar{
  width:34px;height:34px;flex:0 0 auto;border-radius:50%;
  background:var(--panel);border:1px solid var(--gold);
  display:grid;place-items:center;color:var(--gold);font-size:12px;font-weight:600;
}
.st-ig-name{font-size:14px;font-weight:600;min-width:0;overflow-wrap:anywhere}
.st-ig-media{
  background:#000;display:grid;place-items:center;
  aspect-ratio:1/1;overflow:hidden;
}
.st-ig[data-format="REEL"] .st-ig-media{aspect-ratio:9/16}
.st-ig-media img,.st-ig-media video{width:100%;height:100%;object-fit:cover}
.st-ig-empty{color:var(--muted);font-size:13px;padding:24px;text-align:center}
.st-ig-icons{display:flex;gap:14px;padding:10px 12px 4px;color:var(--soft);font-size:18px}
.st-ig-body{padding:0 12px 14px;min-width:0}
.st-ig-caption{
  margin:0;font-size:14px;line-height:1.5;color:var(--txt);
  white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;
}
.st-ig-tags{margin:8px 0 0;font-size:14px;line-height:1.5;color:var(--petrol);overflow-wrap:anywhere}
.st-ig-cta{margin:8px 0 0;font-size:14px;color:var(--gold)}

/* --- Messages --- */
.st-msg{
  margin:0 0 12px;padding:12px 14px;border-radius:14px;font-size:14px;line-height:1.5;
  border:1px solid var(--line2);background:var(--panel2);color:var(--soft);
  overflow-wrap:anywhere;
}
.st-msg[hidden]{display:none}
.st-msg[data-tone="good"]{border-color:var(--good);color:var(--good)}
.st-msg[data-tone="warn"]{border-color:var(--warn);color:var(--warn)}
.st-msg[data-tone="danger"]{border-color:var(--danger);color:var(--danger)}
.st-blockers{margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--muted)}
.st-blockers li{margin:2px 0}

/* --- Barre d actions --- */
.st-actions{
  position:fixed;left:0;right:0;bottom:0;z-index:40;
  display:grid;gap:8px;
  padding:10px 16px;
  padding-left:calc(16px + env(safe-area-inset-left));
  padding-right:calc(16px + env(safe-area-inset-right));
  padding-bottom:calc(10px + env(safe-area-inset-bottom));
  background:var(--bg2);border-top:1px solid var(--line);
}
.st-actions-row{display:flex;gap:8px}
.st-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:48px;min-width:44px;padding:12px 16px;flex:1 1 0;
  border-radius:14px;border:1px solid var(--line2);
  background:var(--panel2);color:var(--txt);
  font-size:15px;font-family:inherit;font-weight:500;
  cursor:pointer;touch-action:manipulation;text-align:center;
}
.st-btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.st-btn[disabled]{opacity:.45;cursor:not-allowed}
.st-btn[data-variant="primary"]{
  background:var(--gold);border-color:var(--gold);color:#1a1408;font-weight:600;
}
.st-btn[data-variant="ghost"]{background:transparent;color:var(--soft)}
.st-busy[hidden]{display:none}

@media(min-width:412px){
  .st-main{padding:20px;gap:16px}
  .st-actions{padding-left:calc(20px + env(safe-area-inset-left));padding-right:calc(20px + env(safe-area-inset-right))}
}
@media(min-width:768px){
  .st-two{grid-template-columns:repeat(2,minmax(0,1fr))}
  .st-actions-row{max-width:1180px;margin:0 auto;width:100%}
}
@media(min-width:1280px){
  .st-main{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:start}
  .st-col-preview{position:sticky;top:84px}
}
@media(prefers-reduced-motion:reduce){
  .st-page *{animation:none!important;transition:none!important}
}
`;

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

function mediaCard() {
  return `<section class="st-card">
    <h2><span class="st-step" aria-hidden="true">1</span>Votre photo ou votre video</h2>
    <p class="st-hint">Choisissez depuis votre galerie, votre ordinateur ou votre appareil photo.</p>

    <div class="st-drop" id="st-drop" data-dragging="false">
      <span class="st-drop-plus" aria-hidden="true">+</span>
      <span class="st-drop-title">Ajouter une photo ou une video</span>
      <span class="st-drop-text">Touchez ici pour ouvrir votre galerie, vos fichiers ou votre appareil photo. Sur ordinateur, vous pouvez aussi glisser le fichier dans ce cadre.</span>
      <span class="st-drop-formats">Photo JPG ou PNG, video MP4</span>
      <input class="st-file" id="st-file" type="file" accept="image/jpeg,image/png,video/mp4"
             aria-label="Ajouter une photo ou une video">
    </div>

    <div class="st-media" id="st-media" hidden>
      <div class="st-media-frame" id="st-media-frame"></div>
      <dl class="st-meta">
        <dd class="st-meta-name" id="st-media-name"></dd>
        <dd class="st-meta-line" id="st-media-line"></dd>
      </dl>
      <div class="st-media-actions">
        <button class="st-btn" type="button" id="st-replace">Remplacer</button>
        <button class="st-btn" data-variant="ghost" type="button" id="st-remove">Supprimer</button>
      </div>
    </div>

    <div class="st-progress" id="st-progress" hidden>
      <div class="st-bar"><div class="st-bar-fill" id="st-bar"></div></div>
      <p class="st-progress-text" id="st-progress-text">Envoi en cours…</p>
    </div>

    <p class="st-state" id="st-media-state" hidden></p>
  </section>`;
}

function formatCard() {
  return `<section class="st-card">
    <h2><span class="st-step" aria-hidden="true">2</span>Format</h2>
    <p class="st-hint">Le format doit correspondre a votre fichier : une photo pour une publication classique, une video pour un Reel.</p>
    <div class="st-formats" role="radiogroup" aria-label="Format de publication">
      <label class="st-format">
        <input type="radio" name="st-format" value="IMAGE" id="st-format-image" checked>
        <span>Photo<small>Publication carree</small></span>
      </label>
      <label class="st-format">
        <input type="radio" name="st-format" value="REEL" id="st-format-reel">
        <span>Reel / Video<small>Format vertical</small></span>
      </label>
    </div>
  </section>`;
}

function textCard() {
  return `<section class="st-card">
    <h2><span class="st-step" aria-hidden="true">3</span>Legende et hashtags</h2>
    <p class="st-hint">Ecrivez comme vous parlez a vos clients. Vous pourrez encore modifier avant de publier.</p>

    <div class="st-field">
      <label for="st-caption">Legende</label>
      <textarea class="st-textarea" id="st-caption" name="caption" rows="6"
        placeholder="Racontez ce que l on voit, pourquoi c est interessant, ce qu il faut faire ensuite."
        maxlength="${MAX_CAPTION_LENGTH}"></textarea>
      <span class="st-counter" id="st-caption-count">0 / ${MAX_CAPTION_LENGTH}</span>
    </div>

    <div class="st-field">
      <label for="st-hashtags">Hashtags</label>
      <input class="st-input" id="st-hashtags" name="hashtags" type="text" inputmode="text"
        placeholder="#dakarstyle #sowhatafrica" autocomplete="off">
      <span class="st-counter" id="st-hashtags-count">0 / ${MAX_HASHTAGS}</span>
    </div>

    <div class="st-field">
      <label for="st-cta">Appel a l action (facultatif)</label>
      <input class="st-input" id="st-cta" name="cta" type="text"
        placeholder="Commandez en message prive" autocomplete="off" maxlength="60">
    </div>

    <details class="st-optional">
      <summary>Details facultatifs : produit, collection, campagne</summary>
      <div class="st-optional-body">
        <div class="st-two">
          <div class="st-field">
            <label for="st-product">Produit</label>
            <input class="st-input" id="st-product" name="product" type="text" autocomplete="off" maxlength="60">
          </div>
          <div class="st-field">
            <label for="st-collection">Collection</label>
            <input class="st-input" id="st-collection" name="collection" type="text" autocomplete="off" maxlength="60">
          </div>
        </div>
        <div class="st-field">
          <label for="st-campaign">Campagne</label>
          <input class="st-input" id="st-campaign" name="campaign" type="text" autocomplete="off" maxlength="60">
        </div>
      </div>
    </details>
  </section>`;
}

function scheduleCard() {
  return `<section class="st-card">
    <h2><span class="st-step" aria-hidden="true">5</span>Date de publication</h2>
    <p class="st-hint">Laissez vide pour publier tout de suite. Renseignez une date pour programmer.</p>
    <div class="st-field">
      <label for="st-schedule">Date et heure</label>
      <input class="st-input" id="st-schedule" name="scheduled_for" type="datetime-local">
    </div>
  </section>`;
}

function previewCard() {
  return `<section class="st-card st-col-preview">
    <h2><span class="st-step" aria-hidden="true">4</span>Apercu Instagram</h2>
    <p class="st-hint">Voila exactement ce qui sera publie.</p>
    <div class="st-preview">
      <article class="st-ig" id="st-ig" data-format="IMAGE">
        <header class="st-ig-head">
          <span class="st-ig-avatar" aria-hidden="true">SA</span>
          <span class="st-ig-name">sowhat.africa</span>
        </header>
        <div class="st-ig-media" id="st-ig-media">
          <p class="st-ig-empty" id="st-ig-empty">Votre photo ou votre video apparaitra ici.</p>
        </div>
        <div class="st-ig-icons" aria-hidden="true"><span>&#9825;</span><span>&#9993;</span><span>&#8635;</span></div>
        <div class="st-ig-body">
          <p class="st-ig-caption" id="st-ig-caption"></p>
          <p class="st-ig-cta" id="st-ig-cta"></p>
          <p class="st-ig-tags" id="st-ig-tags"></p>
        </div>
      </article>
    </div>
  </section>`;
}

function actionsBar() {
  return `<div class="st-actions">
    <div class="st-actions-row">
      <button class="st-btn" data-variant="ghost" type="button" id="st-save">Enregistrer le brouillon</button>
      <button class="st-btn" type="button" id="st-schedule-btn">Programmer</button>
    </div>
    <div class="st-actions-row">
      <button class="st-btn" data-variant="primary" type="button" id="st-publish" disabled>Publier maintenant</button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

/**
 * Page complete du Studio. `options.prefill` est serialise dans un
 * `application/json` inerte : le navigateur ne l execute pas, le script le lit.
 * Aucune donnee n est concatenee dans du JavaScript.
 */
export function renderStudioDocument(options = {}) {
  const prefill = options.prefill ? JSON.stringify(options.prefill) : '';
  // `<` est neutralise pour qu aucune chaine ne puisse fermer la balise.
  const payload = prefill.replace(/</g, '\\u003c');
  const draftId = escapeHtml(String(options.draftId || ''));

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="color-scheme" content="dark">
<title>Publier — SOWHAT Control</title>
<style>${DESIGN_TOKENS}${STUDIO_CSS}</style>
</head>
<body class="st-page" data-draft-id="${draftId}">
<header class="st-top">
  <a class="st-back" href="/social-intelligence/v5" aria-label="Retour au cockpit">&#8592;</a>
  <h1>Publier sur Instagram</h1>
</header>

<main class="st-main">
  <div>
    <p class="st-msg" id="st-message" role="status" aria-live="polite" hidden></p>
    ${mediaCard()}
    ${formatCard()}
    ${textCard()}
    ${scheduleCard()}
  </div>
  ${previewCard()}
</main>

${actionsBar()}

<script type="application/json" id="st-prefill">${payload}</script>
<script src="${STUDIO_CLIENT_ROUTE}" defer></script>
</body>
</html>`;
}
