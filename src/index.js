import application from './samabusiness-final.js';
import senecompare from './senecompare-v5-router.js';

const SENECOMPARE_HOSTS = new Set([
  'senecompare.dakarstyle.com',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (SENECOMPARE_HOSTS.has(url.hostname)) {
      return senecompare.fetch(request, env, ctx);
    }
    return application.fetch(request, env, ctx);
  },
};
