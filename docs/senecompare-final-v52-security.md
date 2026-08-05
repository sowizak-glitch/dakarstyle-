# Sécurité de la livraison finale

La version 5.2 conserve les protections de la façade Cloudflare : CSP restrictive, HSTS, anti-framing, nosniff, politique de permissions, API même origine et absence de clés serveur dans le navigateur. Les nouvelles images sont servies par le même domaine avec cache immuable et `Cross-Origin-Resource-Policy: same-origin`.
