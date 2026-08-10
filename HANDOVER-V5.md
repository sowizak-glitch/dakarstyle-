# HANDOVER — SOWHAT CONTROL V5

Document de reprise. Il decrit l'etat **reel et verifie** de la branche
`agent/sowhat-control-v5-instagram-engine`, pas un etat souhaite.

Regle de lecture : ce qui n'est pas ecrit ici comme verifie ne l'est pas.

---

## 1. Reperes

| Element | Valeur |
|---|---|
| Depot | `sowizak-glitch/dakarstyle-` |
| Branche | `agent/sowhat-control-v5-instagram-engine` |
| Base | `da65da8f829c0e26d82f071a80622e399fb5366e` |
| Commits V5 | 10 (3 repris de la session precedente, 7 ajoutes) |
| Modules V5 | 14 fichiers `src/*-v5*.js` |
| Suites de tests | 14 suites, 311 scenarios, tous verts |
| Dry-run Cloudflare | OK — 491,74 KiB / gzip 136,66 KiB |
| Fichiers V4 modifies | `src/router.js` uniquement (3 lignes ajoutees) |
| Deploiement | Aucun. La branche V5 n'est deployee par aucun workflow. |

---

## 2. Decision architecturale majeure : le transport du credential Meta

**Ce qui a ete supprime.** La V5 contenait une decouverte empirique du
transport : en-tete Bearer, puis en cas de 401, bascule automatique vers
`access_token` en parametre de requete. Ce mecanisme est **entierement retire**.
Un test d'audit statique (`tests/security-audit-v5.mjs`) empeche sa reintroduction.

**Ce qui le remplace.** Deux flux Meta officiels, explicites, figes a la
construction du client :

| Flux | Hote | Transport |
|---|---|---|
| `instagram_login` (defaut) | `graph.instagram.com` | en-tete `Authorization: Bearer` |
| `facebook_login` | `graph.facebook.com` | parametre `access_token` |

**Pourquoi `instagram_login` par defaut.** Ce n'est pas un choix arbitraire : le
socle existant l'utilise deja. `src/social-intelligence-v1.js` interroge
`graph.instagram.com` avec un en-tete Bearer et lit des metriques propres a ce
flux (`views`, `total_interactions`, `accounts_engaged`, `media_product_type`).
La V5 s'aligne sur l'architecture reelle ; elle ne la change pas.

**Consequences tenues.**
- Un 401 est une vraie erreur d'authentification. Il ne declenche aucune
  seconde tentative, dans aucun flux.
- Aucun POST de creation ou de publication n'est rejoue pour essayer un autre
  mode d'authentification.
- `INSTAGRAM_TOKEN_TRANSPORT` permet une surcharge explicite **par
  configuration**. Une valeur inconnue fait echouer la construction du client.
- Un hote incoherent avec le flux configure est refuse (fail closed).

**Action humaine requise si le flux reel est Facebook Login :** poser
`INSTAGRAM_API_FLOW=facebook_login`. Rien d'autre a changer. Ce choix n'a pas pu
etre confirme sans credential ; c'est pourquoi les deux modes sont supportes
explicitement, sans auto-detection.

---

## 3. Modules livres

| Module | Role | Suite | Scenarios |
|---|---|---|---|
| `instagram-client-v5.js` | acces unique a Meta, transport deterministe, ecritures non rejouees | `instagram-client-v5.mjs` | 38 |
| `instagram-sync-v5.js` | synchronisation incrementale, modele canonique, historique d'abonnes | `instagram-sync-v5.mjs` | 19 |
| `sowhat-score-v5.js` | sept sous-scores explicables | `sowhat-score-v5.mjs` | 26 |
| `content-memory-v5.js` | onze dimensions, observation / correlation | `content-memory-v5.mjs` | 20 |
| `coach-v5.js` | recommandations adossees aux correlations | `coach-v5.mjs` | 13 |
| `plan-v5.js` | plan 7 jours et prefill Studio | `plan-v5.mjs` | 15 |
| `security-v5.js` | SAFE, CSRF, medias, idempotence | *(couvert par studio)* | — |
| `studio-v5.js` | machine a etats des publications | `studio-v5.mjs` | 34 |
| `publishing-v5.js` | pipeline Meta en quatre etapes | `publishing-v5.mjs` | 21 |
| `scheduler-v5.js` | verrou, concurrence, sante du jeton | `scheduler-v5.mjs` | 17 |
| `learning-v5.js` | checkpoints T+1h/6h/24h/72h | `learning-v5.mjs` | 17 |
| `observability-v5.js` | journal structure, cockpit technique | `observability-v5.mjs` | 13 |
| `social-intelligence-ui-v5.js` | cockpit, douze etats, responsive | `ui-v5.mjs` | 19 |
| `social-intelligence-v5-routes.js` | espace de noms V5, autorisation, CSRF | `routes-v5.mjs` | 17 |
| *(audit transverse)* | garanties non retirables | `security-audit-v5.mjs` | 21 |
| *(socle V4)* | non-regression | `social-intelligence-*.mjs` | 21 + contrat |

---

## 4. Regles structurantes, et pourquoi elles existent

**Une absence de donnee n'est jamais un zero.** Un sous-score sans matiere vaut
`null` avec un statut (`not_available` ou `insufficient_sample`) et une raison
lisible. Les poids des sous-scores absents sortent du denominateur au lieu
d'etre comptes zero. Un cockpit qui affiche 0 quand il ne sait pas est plus
dangereux qu'un cockpit qui affiche « inconnu ».

**Une correlation faible reste faible.** La confiance exige trois conditions
cumulees : echantillon suffisant, ecart au-dessus du bruit, et regularite du
signe de l'ecart. Un ecart spectaculaire porte par un seul contenu ne devient
jamais une certitude. Le Coach traduit une confiance faible en « piste a
tester », jamais en instruction.

**`media_publish` est la seule etape dangereuse.** Creer un conteneur est sans
consequence et peut etre rejoue ; publier ne l'est pas. Une trace est donc
ecrite **avant** l'appel. Si le resultat reste inconnu (timeout, 5xx, reseau),
la publication n'est jamais rejouee : le systeme demande une verification
humaine (`requires_manual_check`).

**Le verrou du scheduler n'est pas la garantie.** L'idempotence metier l'est. Un
test efface volontairement le verrou et verifie qu'aucune seconde publication ne
part.

**Fail closed partout.** Portail SAFE ferme par defaut, CSRF sans mode degrade,
flux Meta inconnu refuse, hote incoherent refuse, stockage sans ecriture
conditionnelle refuse.

---

## 5. Defauts reels corriges pendant la mission

Ces defauts ont ete trouves par les tests, pas supposes.

1. **Reprise republiante.** Le marqueur `publish_attempted_at` etait ecrit dans
   `result.publish_attempted_at` mais relu au niveau superieur. Une reprise
   apres timeout aurait republie. Le marqueur est desormais cherche aux deux
   niveaux.
2. **Ecarts fabriques par l'arrondi.** Les references etaient arrondies a deux
   decimales *avant* le calcul des ecarts. Sur des taux de l'ordre du millieme,
   0,015 devenait 0,02 et fabriquait un ecart de 25 % sur un corpus
   rigoureusement plat. Les calculs se font maintenant sur les valeurs brutes.
3. **Exclusion mutuelle supposee.** Un stockage ignorant `onlyIf` aurait laisse
   deux executions simultanees se croire toutes deux gagnantes. La capacite
   d'ecriture conditionnelle est maintenant **verifiee** par une sonde.
4. **Legendes ecrasees.** Le Studio traitait les sauts de ligne comme des
   caracteres de controle. Les legendes Instagram sont multilignes.
5. **Modules inaccessibles.** Les modules V5 existaient sans routage : ils
   n'etaient atteignables par personne. Le dry-run est passe de 351 a 491 KiB
   apres branchement, ce qui le confirme.

---

## 6. Configuration attendue

Aucun secret n'est present dans le depot. Ces variables doivent etre posees
cote Cloudflare avant tout usage reel.

| Variable | Statut | Effet si absente |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | **absente** | V5 en lecture seule, aucune sync |
| `INSTAGRAM_USER_ID` | **absente** | idem |
| `INSTAGRAM_API_FLOW` | optionnelle | defaut `instagram_login` |
| `INSTAGRAM_TOKEN_TRANSPORT` | optionnelle | defaut selon le flux |
| `SOCIAL_INTELLIGENCE_CSRF_SECRET` | **absente** | toute ecriture V5 refusee (403) |
| `SOWHAT_PUBLISH_ENABLED` | **absente** | portail SAFE ferme, aucune publication |
| `SOWHAT_MEDIA_PUBLIC_BASE` | **absente** | publication refusee en pre-vol |
| `SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256` | presente | — |
| `VISUALS_BUCKET` | presente | — |

Tant que `SOWHAT_PUBLISH_ENABLED` n'est pas a `true`, **rien ne peut etre
publie**, meme si tout le reste est configure. C'est intentionnel.

---

## 7. Ce qui n'est pas fait

A declarer tel quel, sans arrondi :

- **Aucune verification contre l'API Meta reelle.** Tous les tests utilisent des
  doubles injectes. Le pipeline de publication est conforme a la documentation
  officielle mais n'a jamais parle a Meta.
- **Le flux Meta reel n'est pas confirme.** Le defaut `instagram_login` decoule
  de l'architecture existante, pas d'un credential verifie.
- **Le Studio n'a pas d'interface d'edition.** Le cockpit V5 est en lecture ; la
  creation et la modification de brouillons passent par les modules, pas encore
  par un ecran.
- **Le televersement de media vers R2 n'est pas implemente.** La validation
  existe, le chemin d'upload non.
- **La rotation des jetons Meta n'est pas automatisee.** Un jeton expire bloque
  le scheduler, ce qui est le comportement voulu, mais impose une action
  manuelle.
- **Le responsive n'a pas ete verifie dans un navigateur reel.** Les garanties
  (44 px, marges de securite, absence de debordement, points de rupture) sont
  verifiees par analyse du CSS produit, pas par capture d'ecran.

---

## 8. Reprise

```bash
git checkout agent/sowhat-control-v5-instagram-engine
npm test                     # 311 scenarios, 14 suites
npm run build:dry-run        # dry-run Cloudflare
node tests/security-audit-v5.mjs
```

Ordre suggere pour la suite : upload media R2, puis ecran d'edition Studio, puis
premiere publication reelle sous surveillance avec `SOWHAT_PUBLISH_ENABLED=true`
et un seul contenu approuve.
