# SAMABUSINESS — source pipeline

Ce dossier contient la base historique de l'application SAMABUSINESS et le pipeline de migration vers une source lisible et vérifiable.

## Règle de sécurité

Les fichiers `app-v9-00.b64` à `app-v9-03.b64` sont des artefacts historiques utilisés comme source de récupération par l'Edge Function Supabase `sama-assets`. Ils ne doivent pas être modifiés directement pour une refonte.

La production actuelle lit d'abord les copies vérifiées stockées dans `public.sama_app_assets`. GitHub sert de récupération si ces copies sont absentes ou invalides. Un changement sur cette branche de refactor ne publie donc rien en production.

## Pipeline

- `tools/extract-source.mjs` : vérifie les quatre checksums historiques, applique la correction de compatibilité déjà présente dans `sama-assets`, décompresse le bundle et matérialise la source dans `src/legacy-v9.html`.
- `tools/verify-source.mjs` : valide les marqueurs fonctionnels, le hash de la source et l'absence de plusieurs formes de secrets critiques.
- `tools/build-source.mjs` : reconstruit un artefact gzip+base64 déterministe dans `dist/`, avec un manifeste de release. Le contenu de `dist/` est explicitement **preview-only** et ignoré par Git.

## Commandes

```bash
node tools/extract-source.mjs
node tools/verify-source.mjs
node tools/build-source.mjs
```

Le CI GitHub exécute ces contrôles avec Node 22 et matérialise automatiquement la source lisible sur la branche de refactor.

## Publication

Aucune publication de production ne doit être implicite. La future chaîne cible est :

`source lisible -> build -> tests -> artefact versionné -> preview -> validation -> promotion explicite Supabase/Cloudflare`.

Jusqu'à la mise en place de cette promotion explicite, les scripts de ce dossier ne modifient ni Supabase, ni Cloudflare, ni les données utilisateurs.
