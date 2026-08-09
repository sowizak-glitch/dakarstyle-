# HANDOVER — SOWHAT CONTROL V4 (Lots 0 → 3)

**Branche :** `agent/sowhat-control-v4`
**Base :** `main` @ `23d618a`
**Point de rollback :** tag `rollback/pre-v4-20260809`
**Dépôt :** `github.com/sowizak-glitch/dakarstyle-`

---

## 1. État AVANT / APRÈS

| Sujet | AVANT | APRÈS |
|---|---|---|
| Version cockpit | `3.0.0` | `4.0.0` |
| Rendu UI | `renderDashboard` minifié, **10 524 caractères sur une seule ligne** | Module dédié de ~600 lignes lisibles et diffables |
| Jetons CSS | 2 jeux divergents (login vs cockpit) | 1 seul `DESIGN_TOKENS` partagé |
| CSP | `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'` | Nonce par requête ; plus aucun `unsafe-inline` ; zéro attribut `style=` en ligne |
| Choix du média | URL à taper à la main | Bibliothèque « Mes visuels récents » lue dans le bucket R2 existant |
| Double publication | Bouton désactivé côté client uniquement | Clé d'idempotence + réservation atomique R2 (`onlyIf: etagDoesNotMatch`) |
| États d'historique | `mode` + `accepted: boolean` | `BROUILLON / SAFE VALIDE / EN PUBLICATION / PUBLIE / ECHEC` |
| ID média Instagram | Jamais extrait | Extrait de la réponse du Bridge et stocké |
| Coach → Studio | Aucun lien | Bouton « Créer à partir de cette recommandation » + préremplissage |
| Content Memory | Inexistante | Module persistant (formats, collections, hooks, créneaux) |
| Tests | 1 test statique | Contrat statique **+ 21 scénarios de comportement exécutés** |
| `npm test` | Inexistant | `npm test` = syntaxe + contrat + comportement |
| Code mort | `social-intelligence-v2.js` (51 Ko) + `functions/**` | Supprimés dans la branche |
| Hygiène des assets | `.dev.vars` et `.env` **non exclus** du répertoire d'assets | exclus, avec `node_modules` et `.wrangler` |

---

## 2. Fichiers modifiés

**Ajoutés**

- `src/social-intelligence-ui-v4.js` — rendu complet (HTML, CSS, script client), 1 168 lignes
- `src/social-intelligence-memory-v4.js` — Content Memory persistante, 232 lignes
- `tests/social-intelligence-behaviour.mjs` — 21 scénarios exécutés contre le Worker
- `package.json` — `npm test`, sans aucune dépendance installée localement
- `HANDOVER-V4.md`

**Modifiés**

- `src/social-intelligence-v3.js` — réécrit lisible : routage, session, studio, idempotence, états, bibliothèque R2, CSP à nonce
- `tests/social-intelligence-contract.mjs` — étendu aux nouveaux modules et garanties V4
- `.github/workflows/social-intelligence-quality.yml` — nouveaux chemins, `node --check` étendu, suite de comportement
- `.github/workflows/social-intelligence-deploy.yml` — idem + vérification production `4.0.0`
- `.github/workflows/check-visual-upload-endpoint.yml` — recalé de `functions/` (mort) vers `src/legacy-index.js` (réel)
- `.assetsignore` — exclut `package.json`, `node_modules`, `.wrangler`, `.dev.vars`, `.env`, sorties de build
- `.gitignore` — `node_modules/`, sorties wrangler

**Supprimés (branche uniquement, rollback par le tag)**

- `src/social-intelligence-v2.js`
- `functions/visuals/api/upload.js`, `functions/visuals/media/[[path]].js`, `functions/visuals/manifest/[[path]].js`

---

## 3. Preuve de suppression du code mort

Exigée avant toute suppression, exécutée avant modification :

```
grep -rn "social-intelligence-v2" .        → aucune référence hors du fichier lui-même
git log --all -S"social-intelligence-v2"   → 2 commits de création, aucun consommateur
grep -rn "functions/" (hors supabase)      → 1 seule référence : le path-filter du workflow
grep -rniE "wrangler pages|pages deploy"   → aucune trace de déploiement Cloudflare Pages
grep -n "/visuals/" src/legacy-index.js    → les 3 routes sont servies par le Worker
```

`functions/**` est un répertoire **Cloudflare Pages Functions** dans un déploiement **Worker** :
il n'a jamais été exécuté. Les mêmes routes sont réellement servies par `src/legacy-index.js`.
La version morte exposait `Access-Control-Allow-Origin: *`, ce qui pouvait faire croire à une faille inexistante.
Le path-filter du workflow qui la surveillait a été recalé sur l'implémentation réelle plutôt que supprimé.

---

## 4. Tests exécutés et résultats

```
node --check  src/router.js                            OK
node --check  src/social-intelligence-v1.js            OK
node --check  src/social-intelligence-v3.js            OK
node --check  src/social-intelligence-ui-v4.js         OK
node --check  src/social-intelligence-memory-v4.js     OK
node --check  tests/social-intelligence-contract.mjs   OK
node --check  tests/social-intelligence-behaviour.mjs  OK

node tests/social-intelligence-contract.mjs            PASS
node tests/social-intelligence-behaviour.mjs           PASS (21/21)
npm test                                               PASS
wrangler deploy --dry-run                              OK — 349 fichiers, 351,44 Kio (101,90 Kio gzip)
```

Les 21 scénarios de comportement, tous verts :

| # | Scénario | Vérifie |
|---|---|---|
| 1 | Session privée, CSRF, en-têtes | nonce présent dans la CSP **et** sur le `<script>`, aucun `unsafe-inline`, aucun `style=` |
| 2 | Accès sans session | 401 |
| 3 | CSRF invalide | 403 |
| 4 | URL média `http://` | 400, **Bridge jamais appelé** |
| 5 | Contrat SAFE du preview | `dry_run=true`, `approved=false`, `source_workflow` exact, URL n8n inchangée |
| 6 | Publication sans preview | 409, Bridge jamais appelé |
| 7 | `confirmed` absent | 409 |
| 8 | Légende modifiée après preview | 409 — l'empreinte invalide le preview |
| 9 | Média changé après preview | 409 |
| 10 | Preview vieux de 31 min | 409 |
| 11 | Publication réelle | état `PUBLIE`, ID Instagram `17925103847562901` extrait et stocké |
| 12 | Rejeu de la même clé | `duplicate: true`, **aucune seconde publication** |
| 13 | **Deux commits concurrents** | **exactement 1 appel Bridge**, l'autre reçoit `publication_already_in_flight` |
| 14 | Bridge en erreur 500 | état `ECHEC`, réservation libérée, nouvelle tentative possible |
| 15 | Validation refusée en commit | ligne `BROUILLON` tracée, Bridge non appelé |
| 16 | Reel avec une image | 400 |
| 17 | Bibliothèque R2 | tri par date, manifest lu, `.txt` ignoré, **aucun fichier créé** |
| 18 | Bibliothèque sans CSRF | 403 |
| 19 | Moteur sans données | « en attente », aucun chiffre inventé, pas de bouton de sync |
| 20 | Navigation | les 6 sections **et** les 6 boutons existent réellement |
| 21 | Boucle Coach/Plan → Studio | boutons de préremplissage présents |

Le Bridge n8n de production n'a **jamais** été appelé : `fetch` est remplacé par un double de test.

---

## 5. Non-régressions vérifiées

| Élément | Vérification |
|---|---|
| `source_workflow = "SOWHAT — Visual Factory V4"` | assertion de contrat + scénarios 5 et 11 |
| `dry_run=true / approved=false` en preview | scénario 5 |
| `dry_run=false / approved=true` en publication | scénario 11 |
| URL webhook n8n inchangée | scénario 5 compare l'URL exacte |
| Routes legacy `/health /data /snapshot /sync-instagram` | déléguées telles quelles à `social-intelligence-v1.js` |
| Moteur `social-intelligence-v1.js` | **aucune modification** |
| SeneCompare, Sama Business, storefronts | `src/router.js` **non modifié** + assertions de contrat |
| `/visuals/*` | servis par `src/legacy-index.js`, **non modifié** |
| Fail-closed du routeur | inchangé |
| Cookie `__Host-`, HttpOnly, Secure, SameSite=Strict | inchangés, testés |
| PWA manifest / service worker / no-store | inchangés |

### Risques restants

1. **CSP à nonce** — le durcissement le plus intrusif. Un `<style>` ou `<script>` sans nonce serait désormais bloqué. Le scénario 1 vérifie la correspondance nonce/balise, mais **un rendu navigateur réel n'a pas été observé**.
2. **Version 4.0.0** — la vérification de production du workflow de déploiement attend maintenant `4.0.0`. Si la V3 reste en ligne, le workflow échouera : c'est voulu.
3. **`onlyIf: etagDoesNotMatch`** — supporté par R2 en production, simulé fidèlement dans les tests. Si le binding l'ignorait, la lecture préalable resterait un garde-fou dégradé.
4. **Hygiène du répertoire d'assets** — `assets.directory` vaut `"."` : la racine du dépôt est aussi la racine des fichiers publics. `.dev.vars`, `.env`, `.wrangler` et `node_modules` n'y étaient pas tous exclus ; ils le sont maintenant.

   **Correction d'une affirmation antérieure** : j'avais écrit que `node_modules` était publié (2 251 fichiers contre 349). C'était faux. Le compteur « Read N files » de wrangler est **pré-filtrage** — vérifié en retirant `tests/` (23 fichiers) de `.assetsignore` : le compteur n'a pas bougé. Aucune conclusion ne peut être tirée de ce nombre. L'exclusion de `.dev.vars` reste une amélioration réelle (elle était absente), mais elle relève de la défense en profondeur, pas d'une fuite prouvée.

---

## 6. Blocages nécessitant votre intervention

### B1 — Push GitHub et Pull Request : BLOQUÉ

Aucun accès GitHub authentifié n'a été fourni à la session. Le dépôt a pu être **cloné en lecture**
(`sowizak-glitch/dakarstyle-` est public) mais **pas poussé**.

Le travail est intégralement committé sur la branche locale `agent/sowhat-control-v4`.
Un patch et un bundle Git sont fournis pour reprise sans perte.

```bash
# Option A — appliquer le bundle (recommandé, conserve l'historique et le tag de rollback)
git clone https://github.com/sowizak-glitch/dakarstyle-.git
cd dakarstyle-
git bundle verify /chemin/vers/sowhat-control-v4.bundle
git fetch /chemin/vers/sowhat-control-v4.bundle agent/sowhat-control-v4:agent/sowhat-control-v4
git push -u origin agent/sowhat-control-v4
gh pr create --base main --head agent/sowhat-control-v4 --title "SOWHAT Control V4 — Lots 0 a 3" --body-file HANDOVER-V4.md

# Option B — appliquer le patch
git checkout -b agent/sowhat-control-v4
git am /chemin/vers/sowhat-control-v4.patch
```

**Ne mergez pas avant** : CI verte, `wrangler deploy --dry-run` OK, et relecture de la CSP.

### B2 — Instagram Insights : BLOQUÉ (inchangé depuis le diagnostic)

```
https://dakarstyle.com/api/social-intelligence/health
→ "instagram_configured": false, "has_data": false, "sample_count": 0
```

Le système V4 est **entièrement préparé** mais aucune statistique n'a été simulée.
Score, analyse par contenu, Coach, Plan 7 jours et Content Memory restent vides **par conception**.

```bash
wrangler secret put INSTAGRAM_ACCESS_TOKEN
wrangler secret put INSTAGRAM_USER_ID
# facultatif : wrangler secret put VISUAL_FACTORY_URL   (active le lien direct vers Visual Factory)
```

Après pose des secrets : le cron `17 */6 * * *` alimentera `brain.json`, et le bouton
« Actualiser les statistiques » apparaîtra dans Connexions.

---

## 7. Reste exact à faire

| Priorité | Tâche | Bloqué par |
|---|---|---|
| P0 | Pousser la branche, ouvrir la PR, faire passer la CI | **B1** |
| P0 | Poser `INSTAGRAM_ACCESS_TOKEN` et `INSTAGRAM_USER_ID` | **B2** |
| P1 | Test UI réel : Samsung 360/390/412/430 px, tablette, desktop, mode « site pour ordinateur » | rendu navigateur |
| P1 | Vérifier qu'aucune ressource n'est bloquée par la CSP à nonce (console navigateur) | rendu navigateur |
| P1 | Un preview SAFE réel contre le Bridge n8n, fait consciemment avec vous | décision |
| P2 | Alimenter `rememberMeasuredContent` depuis le cycle de synchronisation Insights | **B2** |
| P2 | Purge programmée des réservations d'idempotence de plus de 24 h | — |
| P3 | Décider du sort de `social-intelligence-v2.js` sur `main` (aujourd'hui supprimé en branche seulement) | validation |

**Non fait volontairement** : aucun déploiement, aucun merge, aucun appel au Bridge de production,
aucune donnée Instagram simulée.

---

## 8. Reprise automatique à la session suivante

Première commande à exécuter :

```bash
cd <depot> && git checkout agent/sowhat-control-v4 && npm test
```

Puis, dans l'ordre :

1. Si un accès GitHub est disponible → pousser la branche et ouvrir la PR (§6, B1). Sinon, re-signaler B1.
2. Si `curl -s https://dakarstyle.com/api/social-intelligence/health | grep instagram_configured` renvoie `true`
   → lancer le Lot 4 : brancher `rememberMeasuredContent` sur le cycle de synchronisation, puis vérifier
   score, analyse par contenu et Plan 7 jours **contre des données réelles**.
   Sinon → ne rien simuler, rester sur B2.
3. Test UI réel sur les largeurs Samsung et relecture console pour la CSP.

**État à ne jamais présumer :** ni le déploiement, ni le merge, ni la présence des secrets Instagram
ne sont acquis. Vérifier `/api/social-intelligence/health` et l'en-tête
`x-sowhat-social-intelligence-version` avant toute conclusion.

---

## 9. Validation d'integration (session du 9 aout 2026)

### GitHub : toujours bloque

Verifie sur les trois canaux disponibles, aucun ne repond :

```
env GH_TOKEN / GITHUB_TOKEN        absent
gh CLI                             non installe
git credential.helper              aucun
~/.git-credentials, ~/.netrc, ~/.ssh  absents
git push --dry-run                 fatal: could not read Username for 'https://github.com'
connecteur MCP GitHub              authentification requise, impossible en session non interactive
connecteur MCP GitKraken           "you must sign into your GitKraken account"
```

Aucun developpement n'a ete repris. Le bundle et le patch restent la voie de reprise.

### Validation navigateur : impossible dans cet environnement

- Aucun navigateur present ; le telechargement de Chromium par Playwright est bloque par le reseau.
- `wrangler dev` demarre et ouvre bien le port 8787, mais **workerd reinitialise chaque connexion**
  (`ECONNRESET`) dans ce bac a sable. Le serveur local n'est donc pas exploitable.
- Chaque appel shell s'execute par ailleurs dans son propre espace reseau isole.

**Remplacement effectue** : validation en processus contre le vrai handler, avec objets
`Request`/`Response` reels, bucket R2 simule et reseau sortant coupe. **46 controles, 0 anomalie.**

Couvert : CSP a nonce (correspondance exacte nonce/balise, absence de `on*=`, absence de `style=`,
absence de ressource externe), les 6 sections et leurs declencheurs, absence de bouton mort,
bibliotheque R2 (tri, manifest, types, CSRF), garde SAFE, refus `http://`, CSRF, etats et historique,
non-regression SeneCompare / Sama Business / `/visuals/*` / routes legacy.

**Non couvert, et non revendique** : le rendu graphique reel. Aucun pixel n'a ete observe.

### Audit responsive statique

Analyse des regles CSS appliquees a 360 / 390 / 412 / 430 / 768 / 1280 px et en mode tactile.
11 constats, 0 anomalie apres correction.

| Largeur | Navigation | Bibliotheque |
|---|---|---|
| 360 - 430 px | barre basse 6 actions, 55,3 px par bouton a 360 px | 3 colonnes |
| 768 px | barre basse | 4 colonnes |
| 1280 px + souris | sidebar | 5 colonnes |
| tactile en mode "site pour ordinateur" | `hover:none` + `pointer:coarse` force la barre basse | 3 colonnes |

Garde-fous verifies : `overflow-x:hidden`, `min-width:0`, `minmax(0,1fr)` (5 occurrences),
`env(safe-area-inset-bottom)` (3 occurrences), aucune largeur fixe depassant la zone utile a 360 px.

### Anomalie trouvee et corrigee

`.libraryBtn` (bouton « Charger depuis R2 », introduit dans cette branche) avait une hauteur
tactile de **38 px**, sous le seuil confortable. Portee a **44 px**.

### Verdict

**GO conditionnel** pour le merge : code, tests et non-regressions sont verts, mais le rendu
graphique n'a jamais ete observe. Ouvrir `/social-intelligence` sur un Samsung reel et regarder
la console avant de merger.
