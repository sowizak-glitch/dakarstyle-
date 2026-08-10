import application from './worker-entry-v131.js';
import senecompare from './senecompare-v541.js';
import samabusinessSites from './samabusiness-site-proxy-v131.js';
import samabusinessMedia from './samabusiness-media-review-v133.js';
import samabusinessOwner from './samabusiness-owner-command-v14.js';
import { handleSocialIntelligenceV3, runInstagramSync } from './social-intelligence-v3.js';
import { authorizeV5, handleSocialIntelligenceV5, isSocialIntelligenceV5Route } from './social-intelligence-v5-routes.js';

const SENECOMPARE_HOSTS = new Set([
  'senecompare.dakarstyle.com',
]);

const SAMABUSINESS_HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

const SOCIAL_INTELLIGENCE_HOSTS = new Set([
  'dakarstyle.com',
  'www.dakarstyle.com',
]);

const CORE_HOSTS = new Set([
  'dakarstyle.com',
  'www.dakarstyle.com',
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
  'senecompare.dakarstyle.com',
]);

function isSocialIntelligenceRoute(url) {
  return url.pathname === '/social-intelligence'
    || url.pathname.startsWith('/social-intelligence/')
    || url.pathname.startsWith('/api/social-intelligence/');
}

function isV5BrowserPage(request, url) {
  return ['GET', 'HEAD'].includes(request.method)
    && (url.pathname === '/social-intelligence/v5'
      || url.pathname === '/social-intelligence/v5/'
      || url.pathname === '/social-intelligence/v5/studio');
}

function v5LoginRedirect() {
  return new Response(null, {
    status: 302,
    headers: {
      location: '/social-intelligence',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}

function hasSha256Binding(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function socialIntelligenceSecurityReady(url, env) {
  if (url.pathname === '/api/social-intelligence/health') return true;
  if (url.pathname === '/api/social-intelligence/snapshot' || url.pathname === '/api/social-intelligence/sync-instagram') {
    return hasSha256Binding(env.SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256);
  }
  return hasSha256Binding(env.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256)
    && hasSha256Binding(env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256);
}

function socialIntelligenceNotConfigured(url) {
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive',
  };
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: 'social_intelligence_security_not_configured' }), {
      status: 503,
      headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SOWHAT Control</title><body style="margin:0;background:#08080a;color:#f6f2e9;font-family:system-ui;display:grid;place-items:center;min-height:100vh;padding:24px"><main><h1>Configuration sécurisée en cours</h1><p style="color:#96938b">Le cockpit reste fermé tant que ses identifiants privés ne sont pas configurés.</p></main></body></html>', {
    status: 503,
    headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
  });
}

function isSamabusinessOwnerRoute(url) {
  return url.pathname === '/api/owner-command-center';
}

function isSamabusinessCommerceRoute(url) {
  return url.pathname === '/api/site-commerce'
    || url.pathname === '/api/site-media-preview';
}

function isSamabusinessSiteRoute(url) {
  return url.pathname === '/api/site-platform'
    || url.pathname === '/site-preview'
    || url.pathname === '/site-platform-health'
    || url.pathname.startsWith('/sites/');
}

function isCustomStorefront(url) {
  return !CORE_HOSTS.has(url.hostname)
    && (url.pathname === '/' || url.pathname === '/index.html');
}

function directUploadPublishSection() {
  return `<section class="view" data-view="publish">`
    + `<div class="sectionHead"><div><h1>Publier</h1><p>Photo ou vidéo directe depuis votre téléphone ou ordinateur.</p></div></div>`
    + `<div class="publishLayout">`
    + `<article class="publishPanel"><h2>Nouveau Studio V5</h2>`
    + `<div class="publishNotice"><b>Plus besoin de coller une URL.</b><br>`
    + `Choisissez directement une photo JPEG/PNG ou une vidéo MP4 depuis votre galerie, vos fichiers ou votre ordinateur. `
    + `Le stockage R2 et l’adresse technique nécessaire à Instagram sont gérés automatiquement en arrière-plan.</div>`
    + `<a class="cta gold mt14" href="/social-intelligence/v5/studio">Ajouter une photo ou une vidéo</a>`
    + `</article>`
    + `<article class="publishPanel"><h2>Parcours simplifié</h2>`
    + `<div class="connectionCard mt14"><h3>1 · Choisir le média</h3><p>Galerie, appareil photo ou fichier local.</p></div>`
    + `<div class="connectionCard mt9"><h3>2 · Préparer</h3><p>Aperçu, légende, hashtags et programmation.</p></div>`
    + `<div class="connectionCard mt9"><h3>3 · Publier</h3><p>Le Studio V5 conserve les contrôles SAFE et l’idempotence avant tout envoi réel.</p></div>`
    + `</article>`
    + `</div></section>`;
}

function upgradeLegacyPublishHtml(body) {
  const source = String(body || '');
  const marker = '<section class="view" data-view="publish">';
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const end = source.indexOf('</section>', start);
  if (end < 0) return source;
  return source.slice(0, start) + directUploadPublishSection() + source.slice(end + '</section>'.length);
}

async function upgradeLegacySocialIntelligenceResponse(request, url, response) {
  if (url.pathname === '/social-intelligence/manifest.webmanifest' && response.status === 200) {
    try {
      const manifest = await response.json();
      manifest.start_url = '/social-intelligence/v5/studio';
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      headers.delete('content-length');
      return new Response(JSON.stringify(manifest), { status: 200, headers });
    } catch {
      return response;
    }
  }

  if (request.method !== 'GET'
    || (url.pathname !== '/social-intelligence' && url.pathname !== '/social-intelligence/')) {
    return response;
  }
  if (response.status !== 200 || !String(response.headers.get('content-type') || '').includes('text/html')) {
    return response;
  }

  const body = await response.text();
  const upgraded = upgradeLegacyPublishHtml(body);
  if (upgraded === body) return new Response(body, { status: response.status, headers: response.headers });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(upgraded, { status: response.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // La V5 vit dans son propre espace de noms et passe AVANT la V4, sinon la
    // V4 capterait ses chemins. Aucune route V4 n est modifiee pour autant.
    if (SOCIAL_INTELLIGENCE_HOSTS.has(url.hostname) && isSocialIntelligenceV5Route(url)) {
      if (!socialIntelligenceSecurityReady(url, env)) return socialIntelligenceNotConfigured(url);
      // Une page HTML doit conduire l operateur vers l ecran de connexion au
      // lieu d exposer le contrat JSON 401 reserve aux API. La V5 reste fail
      // closed : on utilise exactement authorizeV5, sans contourner la session.
      if (isV5BrowserPage(request, url)) {
        const auth = await authorizeV5(request, env);
        if (!auth.ok) return v5LoginRedirect();
      }
      return handleSocialIntelligenceV5(request, env, ctx);
    }
    if (SOCIAL_INTELLIGENCE_HOSTS.has(url.hostname) && isSocialIntelligenceRoute(url)) {
      if (!socialIntelligenceSecurityReady(url, env)) return socialIntelligenceNotConfigured(url);
      const response = await handleSocialIntelligenceV3(request, env, ctx);
      return upgradeLegacySocialIntelligenceResponse(request, url, response);
    }
    if (SENECOMPARE_HOSTS.has(url.hostname)) {
      return senecompare.fetch(request, env, ctx);
    }
    if (SAMABUSINESS_HOSTS.has(url.hostname) && isSamabusinessOwnerRoute(url)) {
      return samabusinessOwner.fetch(request, env, ctx);
    }
    if (isSamabusinessCommerceRoute(url)) {
      return samabusinessMedia.fetch(request, env, ctx);
    }
    if (SAMABUSINESS_HOSTS.has(url.hostname) && isSamabusinessSiteRoute(url)) {
      return samabusinessSites.fetch(request, env, ctx);
    }
    if (isCustomStorefront(url)) {
      return samabusinessSites.fetch(request, env, ctx);
    }
    return application.fetch(request, env, ctx);
  },

  async scheduled(_controller, env, ctx) {
    if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) return;
    ctx.waitUntil(runInstagramSync(env, null));
  },
};
