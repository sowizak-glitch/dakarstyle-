import application from './worker-entry.js';
import { injectSamabusinessPublicExperience } from './samabusiness-public-experience.js';
import { handleEcosystemSeoRequest, transformEcosystemSeoResponse } from './ecosystem-seo-v1.js';

const VERSION = '13.1.0';
const HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

function isHtml(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

function securityHeaders(source) {
  const headers = new Headers(source);
  headers.set('x-samabusiness-version', VERSION);
  headers.set('x-samabusiness-public-experience', VERSION);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('set-cookie');
  return headers;
}

function augmentManifest(value, origin) {
  const manifest = value && typeof value === 'object' ? value : {};
  const shortcuts = Array.isArray(manifest.shortcuts) ? manifest.shortcuts : [];
  const additions = [
    { name: 'Voir la démo', short_name: 'Démo', url: `${origin}/?demo=1` },
    { name: 'Créer mon site', short_name: 'Mon site', url: `${origin}/?module=site-studio` },
    { name: 'Partager Sama Business', short_name: 'Partager', url: `${origin}/?share=app` },
  ];
  for (const addition of additions) {
    if (!shortcuts.some((item) => item?.url === addition.url)) shortcuts.push(addition);
  }
  manifest.shortcuts = shortcuts.slice(0, 8);
  manifest.description = 'Ventes, stock, dettes, livraisons, commandes WhatsApp et création de sites professionnels depuis le téléphone.';
  manifest.lang = 'fr-SN';
  manifest.categories = ['business', 'finance', 'productivity', 'shopping'];
  return manifest;
}

async function transform(request, response, url) {
  const headers = securityHeaders(response.headers);
  if (request.method === 'HEAD') return new Response(null, { status: response.status, statusText: response.statusText, headers });

  if (url.pathname === '/manifest.webmanifest') {
    const data = await response.json().catch(() => ({}));
    headers.set('content-type', 'application/manifest+json; charset=utf-8');
    headers.set('cache-control', 'no-cache, must-revalidate');
    return new Response(JSON.stringify(augmentManifest(data, url.origin)), { status: response.status, headers });
  }

  if (url.pathname === '/sw.js') {
    const source = await response.text();
    const upgraded = source.replaceAll('10.3.0', VERSION);
    headers.set('content-type', 'application/javascript; charset=utf-8');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    return new Response(upgraded, { status: response.status, headers });
  }

  if (url.pathname === '/health' || url.searchParams.get('mode') === 'health') {
    const data = await response.json().catch(() => ({ ok: response.ok }));
    data.public_experience = VERSION;
    data.demo_video = true;
    data.native_share = true;
    data.install_prompt = true;
    data.site_commerce = '13.0.0';
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    return new Response(JSON.stringify(data), { status: response.status, headers });
  }

  if (isHtml(response)) {
    const html = injectSamabusinessPublicExperience(await response.text(), VERSION);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const seoResponse = handleEcosystemSeoRequest(request);
    if (seoResponse) return seoResponse;

    const response = await application.fetch(request, env, ctx);
    const publicExperienceResponse = HOSTS.has(url.hostname)
      ? await transform(request, response, url)
      : response;
    return transformEcosystemSeoResponse(request, publicExperienceResponse);
  },
};
