import application from './worker-entry-v131.js';
import senecompare from './senecompare-v541.js';
import samabusinessSites from './samabusiness-site-proxy-v131.js';
import samabusinessMedia from './samabusiness-media-review-v133.js';
import samabusinessOwner from './samabusiness-owner-command-v14.js';
import { handleSocialIntelligenceV3, runInstagramSync } from './social-intelligence-v3.js';

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (SOCIAL_INTELLIGENCE_HOSTS.has(url.hostname) && isSocialIntelligenceRoute(url)) {
      if (!socialIntelligenceSecurityReady(url, env)) return socialIntelligenceNotConfigured(url);
      return handleSocialIntelligenceV3(request, env, ctx);
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
