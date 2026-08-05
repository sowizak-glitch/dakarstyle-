import domain from './senecompare-domain.js';

const VERSION = '5.0.0';
const PREMIUM_VERSION = '5.1.0';
const FRONTEND_FILES = new Map([
  ['/styles.css', { source: '/senecompare/styles.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/app.js', { source: '/senecompare/app.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
  ['/premium-v51.css', { source: '/senecompare/premium-v51.css', type: 'text/css; charset=utf-8', cache: 'public, max-age=3600, stale-while-revalidate=86400' }],
  ['/premium-v51.js', { source: '/senecompare/premium-v51.js', type: 'application/javascript; charset=utf-8', cache: 'no-cache, must-revalidate' }],
]);
const DOMAIN_PATHS = new Set([
  '/manifest.webmanifest', '/sw.js', '/icon.svg', '/expansion.js', '/__cache_reset', '/__health', '/robots.txt', '/sitemap.xml',
]);

function secureHeaders(contentType, cacheControl) {
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'CDN-Cache-Control': cacheControl,
    'Cloudflare-CDN-Cache-Control': cacheControl,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), geolocation=(self), microphone=(self), payment=(), usb=(), serial=(), bluetooth=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'X-SeneCompare-Version': VERSION,
    'X-SeneCompare-Premium': PREMIUM_VERSION,
    'X-SeneCompare-Frontend': 'cloudflare-local-assets-v5',
  });

  if (contentType.startsWith('text/html')) {
    headers.set('Content-Language', 'fr-SN');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self' data: https:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '));
    headers.set('Link', '<https://senecompare.dakarstyle.com/>; rel="canonical"');
  } else {
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  return headers;
}

function assetRequest(request, sourcePath) {
  const source = new URL(request.url);
  source.pathname = sourcePath;
  source.search = '';
  return new Request(source.toString(), {
    method: 'GET',
    headers: { Accept: request.headers.get('Accept') || '*/*', 'Accept-Language': request.headers.get('Accept-Language') || 'fr-SN,fr;q=0.9' },
  });
}

async function readAsset(request, env, sourcePath) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return null;
  try {
    const response = await env.ASSETS.fetch(assetRequest(request, sourcePath));
    return response.ok ? response : null;
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_local_asset_failed', sourcePath, detail: String(error) }));
    return null;
  }
}

function normalizeVersion(content) {
  let normalized = content
    .replaceAll('4.0.0', VERSION)
    .replaceAll('4.1.0', VERSION)
    .replaceAll('v=400', 'v=500')
    .replaceAll('v=410', 'v=500');

  normalized = normalized.replace(
    "recognition.lang = state.locale === 'wo' ? 'fr-SN' : 'fr-SN';",
    "recognition.lang = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';",
  );
  normalized = normalized.replace(
    "}, () => { el.locationLabel.textContent = t('location'); toast(t('microphoneDenied')); }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });",
    "}, () => { el.locationLabel.textContent = t('location'); toast(state.locale === 'wo' ? 'Mënul jot ci sa bérab. Tànnal dëkk bi ci tànneef yi.' : 'Position indisponible. Choisissez votre ville dans les filtres.'); }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });",
  );
  normalized = normalized.replace(
    "const item=state.history[Number(button.dataset.history)]; closeModal(); el.searchInput.value=item.query; Object.assign(state.filters,item.filters||{}); runSearch(item.query);",
    "const item=state.history[Number(button.dataset.history)]; closeModal(); el.searchInput.value=item.query; if(item.filters){el.cityFilter.value=item.filters.city||'Sénégal';el.categoryFilter.value=item.filters.category||'all';el.maxPriceFilter.value=item.filters.maxPrice||'';el.conditionFilter.value=item.filters.condition||'all';el.sortFilter.value=item.filters.sort||'relevance';} updateFilterCount(); runSearch(item.query);",
  );
  normalized = normalized.replace(
    "if (!result.sourceUrl) article.querySelector('.result-actions a').setAttribute('aria-disabled', 'true');",
    "if (!result.sourceUrl) { const sourceLink=article.querySelector('.result-actions a'); sourceLink.removeAttribute('href'); sourceLink.setAttribute('aria-disabled','true'); sourceLink.tabIndex=-1; }",
  );
  normalized = normalized.replace(
    "locale: localStorage.getItem(STORAGE.locale) === 'wo' ? 'wo' : 'fr',",
    "locale: readString(STORAGE.locale) === 'wo' ? 'wo' : 'fr',",
  );
  normalized = normalized.replace(
    "session: localStorage.getItem(STORAGE.session) || crypto.randomUUID(),",
    "session: readString(STORAGE.session) || crypto.randomUUID(),",
  );
  normalized = normalized.replace(
    'localStorage.setItem(STORAGE.session, state.session);',
    'writeString(STORAGE.session, state.session);',
  );
  normalized = normalized.replace(
    "function toggleLocale() { state.locale = state.locale === 'fr' ? 'wo' : 'fr'; localStorage.setItem(STORAGE.locale, state.locale); applyLocale(); if (state.results.length) renderResults(); }",
    "function toggleLocale() { state.locale = state.locale === 'fr' ? 'wo' : 'fr'; writeString(STORAGE.locale, state.locale); applyLocale(); if (state.results.length) renderResults(); }",
  );
  normalized = normalized.replace(
    'function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||\'\')||fallback;}catch{return fallback;}}',
    "function readString(key){try{return localStorage.getItem(key)||'';}catch{return '';}}\n  function writeString(key,value){try{localStorage.setItem(key,String(value));}catch{/* storage unavailable */}}\n  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch{return fallback;}}",
  );
  return normalized;
}

function injectPremium(html) {
  let output = html;
  if (!output.includes('/premium-v51.css')) {
    const link = `<link rel="stylesheet" href="/premium-v51.css?v=${PREMIUM_VERSION}">`;
    output = output.includes('</head>') ? output.replace('</head>', `${link}</head>`) : `${link}${output}`;
  }
  if (!output.includes('/premium-v51.js')) {
    const script = `<script src="/premium-v51.js?v=${PREMIUM_VERSION}" defer></script>`;
    output = output.includes('</body>') ? output.replace('</body>', `${script}</body>`) : `${output}${script}`;
  }
  return output;
}

async function serveFrontendFile(request, env, descriptor) {
  const asset = await readAsset(request, env, descriptor.source);
  if (!asset) return null;
  const body = normalizeVersion(await asset.text());
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: secureHeaders(descriptor.type, descriptor.cache) });
}

async function serveLocalApplication(request, env) {
  const asset = await readAsset(request, env, '/senecompare/index.html');
  if (!asset) return null;
  let html = injectPremium(normalizeVersion(await asset.text()));
  const marker = `<span hidden data-senecompare-version="${VERSION}" data-senecompare-premium="${PREMIUM_VERSION}">Version ${VERSION}</span>`;
  html = html.includes('</body>') ? html.replace('</body>', `${marker}</body>`) : `${html}${marker}`;
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: secureHeaders('text/html; charset=utf-8', 'no-cache, no-store, must-revalidate'),
  });
}

function shouldUseDomain(url) {
  return url.pathname.startsWith('/api/') || DOMAIN_PATHS.has(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (shouldUseDomain(url)) return domain.fetch(request, env, ctx);
    const descriptor = FRONTEND_FILES.get(url.pathname);
    if (descriptor && ['GET', 'HEAD'].includes(request.method)) {
      const local = await serveFrontendFile(request, env, descriptor);
      if (local) return local;
      return domain.fetch(request, env, ctx);
    }
    if (['GET', 'HEAD'].includes(request.method)) {
      const local = await serveLocalApplication(request, env);
      if (local) return local;
    }
    return domain.fetch(request, env, ctx);
  },
};
