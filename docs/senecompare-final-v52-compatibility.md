# Compatibilité SeneCompare 5.2

La couche finale est additive. Elle ne modifie ni le schéma Supabase, ni le moteur hybride, ni la passerelle Zero Trust, ni les formats de résultats. Les routes `/api/*`, les favoris, l’historique, la comparaison, les alertes, les signalements, la géolocalisation, la transcription et le secours vocal restent inchangés.

Le routeur conserve `X-SeneCompare-Version: 5.0.0` pour les contrats existants et ajoute `X-SeneCompare-Release: 5.2.0` pour identifier la livraison finale. Le manifeste conserve le même `id`, le même scope et le même start URL afin que les installations existantes soient mises à jour plutôt que dupliquées.
