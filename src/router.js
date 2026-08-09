import application from './worker-entry-v131.js';
import senecompare from './senecompare-v541.js';
import samabusinessSites from './samabusiness-site-proxy-v131.js';
import samabusinessMedia from './samabusiness-media-review-v133.js';
import samabusinessOwner from './samabusiness-owner-command-v14.js';
import { handleSocialIntelligence, runInstagramSync } from './social-intelligence-v1.js';

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
    || url.pathname === '/social-intelligence/'
    || url.pathname.startsWith('/api/social-intelligence/');
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
      return handleSocialIntelligence(request, env, ctx);
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
