import application from './worker-entry-v131.js';
import senecompare from './senecompare-v541.js';
import samabusinessSites from './samabusiness-site-proxy-v131.js';
import samabusinessMedia from './samabusiness-media-review-v133.js';

const SENECOMPARE_HOSTS = new Set([
  'senecompare.dakarstyle.com',
]);

const SAMABUSINESS_HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

const CORE_HOSTS = new Set([
  'dakarstyle.com',
  'www.dakarstyle.com',
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
  'senecompare.dakarstyle.com',
]);

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
    if (SENECOMPARE_HOSTS.has(url.hostname)) {
      return senecompare.fetch(request, env, ctx);
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
};
