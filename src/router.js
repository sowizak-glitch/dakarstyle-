import application from './worker-entry.js';
import senecompare from './senecompare-v541.js';
import samabusinessSites from './samabusiness-site-proxy.js';

const SENECOMPARE_HOSTS = new Set([
  'senecompare.dakarstyle.com',
]);

const SAMABUSINESS_HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

function isSamabusinessSiteRoute(url) {
  return url.pathname === '/api/site-platform'
    || url.pathname === '/site-preview'
    || url.pathname === '/site-platform-health'
    || url.pathname.startsWith('/sites/');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (SENECOMPARE_HOSTS.has(url.hostname)) {
      return senecompare.fetch(request, env, ctx);
    }
    if (SAMABUSINESS_HOSTS.has(url.hostname) && isSamabusinessSiteRoute(url)) {
      return samabusinessSites.fetch(request, env, ctx);
    }
    return application.fetch(request, env, ctx);
  },
};
