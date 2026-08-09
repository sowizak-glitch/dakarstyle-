# SOWHAT SOCIAL INTELLIGENCE v1.0

## Objectif

Transformer la boucle de publication SOWHAT en système d'apprentissage continu :

`Créer -> Publier -> Mesurer -> Comparer -> Recommander -> Recréer`

Le module ne remplace pas Visual Factory ni les routes de publication existantes. Il s'ajoute au Worker actuel et réutilise le bucket R2 `VISUALS_BUCKET`.

## Surface produit

Dashboard privé :

- `/social-intelligence?k=<ADMIN_KEY>`

API :

- `GET /api/social-intelligence/health`
- `GET /api/social-intelligence/data?k=<ADMIN_KEY>`
- `POST /api/social-intelligence/snapshot`
- `POST /api/social-intelligence/sync-instagram`

Les endpoints d'écriture exigent `X-SOWHAT-KEY`.

## Données et scoring

Le moteur ingère jusqu'à 50 médias par cycle et calcule des scores relatifs à la médiane propre du compte.

Piliers :

1. Attraction : vues et portée.
2. Engagement : interactions rapportées à l'audience atteinte.
3. Advocacy : partages et sauvegardes.
4. Régularité : cadence et constance de publication.

Le score d'un média est calculé à partir de l'attraction, de l'engagement, des signaux de partage/sauvegarde, de la conversation et, lorsque disponible, de la rétention vidéo.

Aucun score fictif n'est généré lorsqu'Instagram n'est pas connecté ou lorsque les données sont absentes.

## Stockage

R2 :

- `visuals/social-intelligence/brain.json` : état analytique courant.
- `visuals/social-intelligence/history.json` : historique compact, 120 cycles maximum.

Aucune nouvelle base de données n'est requise pour v1.

## Variables serveur

Obligatoires pour ouvrir les surfaces privées :

- `SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256`
- `SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256`

Obligatoires pour la synchronisation Instagram réelle :

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`

Optionnelles :

- `INSTAGRAM_API_VERSION` : format `vXX.X`.
- `INSTAGRAM_GRAPH_BASE` : uniquement `https://graph.instagram.com` ou `https://graph.facebook.com`.
- `VISUAL_FACTORY_URL` : destination du bouton de création depuis le Coach.

Le routeur applique un mode fail-closed : le dashboard et les API privées restent fermés si leurs hashes serveur dédiés ne sont pas configurés. Les tokens et clés brutes ne doivent jamais être commis dans GitHub.

## Automatisation

Le Worker possède un cron :

`17 */6 * * *`

Toutes les six heures, le routeur lance la synchronisation uniquement si `INSTAGRAM_ACCESS_TOKEN` et `INSTAGRAM_USER_ID` sont présents. Sans configuration Instagram, le cron sort sans erreur et sans inventer de données.

## Sécurité

- Token Instagram exclusivement côté serveur.
- Hashes d'administration et d'écriture obligatoires au niveau du routeur.
- Dashboard privé avec comparaison SHA-256 constante.
- CSP restrictive.
- `frame-ancestors 'none'` et `X-Frame-Options: DENY`.
- HSTS.
- `Cache-Control: no-store` sur analytics et administration.
- `noindex, nofollow, noarchive`.
- Permissions navigateur sensibles désactivées sur le dashboard.
- CORS d'écriture restreint au domaine principal.
- Aucune donnée sensible injectée dans le HTML.

## Non-régression

Le module est routé uniquement sur `dakarstyle.com` et `www.dakarstyle.com` pour les chemins `/social-intelligence` et `/api/social-intelligence/*`.

Les routes SeneCompare, Sama Business, les vitrines personnalisées et les routes Visual Factory existantes restent inchangées.

## Validation

- `node --check src/social-intelligence-v1.js`
- `node --check src/router.js`
- `node tests/social-intelligence-contract.mjs`

Le workflow GitHub Actions `Social Intelligence Quality` exécute automatiquement ces contrôles sur la pull request et sur `main`.
