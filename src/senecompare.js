const APP_VERSION = '4.0.0';
const APP_NAME = 'SeneCompare AI';
const MAX_QUERY_LENGTH = 180;
const MAX_BODY_BYTES = 12_000;

const ALLOWED_CITIES = new Set([
  'Sénégal', 'Dakar', 'Thiès', 'Saint-Louis', 'Mbour', 'Touba', 'Kaolack', 'Ziguinchor', 'Louga',
]);

const ALLOWED_CATEGORIES = new Set([
  'all', 'phones', 'cars', 'motorcycles', 'appliances', 'computing', 'fashion', 'home', 'professional',
]);

const STARTER_OFFERS = [
  {
    id: 'demo-samsung-a16-dakar', title: 'Samsung Galaxy A16 — neuf', category: 'phones',
    seller: 'Marchand partenaire à confirmer', sellerType: 'merchant', city: 'Dakar', price: 109000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-04T10:00:00.000Z', publishedAt: '2026-08-04T10:00:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.74, imageUrl: '',
    description: 'Offre de démonstration destinée à valider l’interface. Le prix doit être confirmé auprès du vendeur.', status: 'confirm',
  },
  {
    id: 'demo-redmi-note-14-thies', title: 'Xiaomi Redmi Note 14 — neuf', category: 'phones',
    seller: 'Boutique locale à confirmer', sellerType: 'merchant', city: 'Thiès', price: 119500, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-03T15:30:00.000Z', publishedAt: '2026-08-03T15:30:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.71, imageUrl: '',
    description: 'Offre de démonstration. Stock, garantie et accessoires à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-iphone-13-dakar', title: 'iPhone 13 128 Go — occasion', category: 'phones',
    seller: 'Vendeur particulier à confirmer', sellerType: 'individual', city: 'Dakar', price: 285000, currency: 'XOF', condition: 'used',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-02T08:00:00.000Z', publishedAt: '2026-08-02T08:00:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.66, imageUrl: '',
    description: 'Offre de démonstration. Batterie, iCloud, IMEI et état physique à contrôler avant paiement.', status: 'confirm',
  },
  {
    id: 'demo-moto-jakarta-dakar', title: 'Moto Jakarta 125 cc — occasion', category: 'motorcycles',
    seller: 'Vendeur particulier à confirmer', sellerType: 'individual', city: 'Dakar', price: 525000, currency: 'XOF', condition: 'used',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-01T11:45:00.000Z', publishedAt: '2026-08-01T11:45:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.68, imageUrl: '',
    description: 'Offre de démonstration. Carte grise, moteur et châssis à vérifier.', status: 'confirm',
  },
  {
    id: 'demo-scooter-mbour', title: 'Scooter urbain 125 cc — neuf', category: 'motorcycles',
    seller: 'Revendeur à confirmer', sellerType: 'merchant', city: 'Mbour', price: 690000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-04T09:20:00.000Z', publishedAt: '2026-08-04T09:20:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.73, imageUrl: '',
    description: 'Offre de démonstration. Garantie et pièces disponibles à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-toyota-yaris-dakar', title: 'Toyota Yaris 2016 — occasion', category: 'cars',
    seller: 'Parc automobile à confirmer', sellerType: 'merchant', city: 'Dakar', price: 5450000, currency: 'XOF', condition: 'used',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-02T14:00:00.000Z', publishedAt: '2026-08-02T14:00:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.63, imageUrl: '',
    description: 'Offre de démonstration. Expertise mécanique, kilométrage et documents à contrôler.', status: 'confirm',
  },
  {
    id: 'demo-renault-duster-thies', title: 'Renault Duster 2018 — occasion', category: 'cars',
    seller: 'Vendeur à confirmer', sellerType: 'individual', city: 'Thiès', price: 7850000, currency: 'XOF', condition: 'used',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-07-31T17:10:00.000Z', publishedAt: '2026-07-31T17:10:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.61, imageUrl: '',
    description: 'Offre de démonstration. Contrôle technique et historique d’entretien à exiger.', status: 'confirm',
  },
  {
    id: 'demo-frigo-dakar', title: 'Réfrigérateur 300 L — neuf', category: 'appliances',
    seller: 'Magasin à confirmer', sellerType: 'merchant', city: 'Dakar', price: 245000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-04T12:00:00.000Z', publishedAt: '2026-08-04T12:00:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.77, imageUrl: '',
    description: 'Offre de démonstration. Livraison, consommation et garantie à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-congelateur-touba', title: 'Congélateur coffre 250 L — neuf', category: 'appliances',
    seller: 'Distributeur à confirmer', sellerType: 'merchant', city: 'Touba', price: 215000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-01T09:30:00.000Z', publishedAt: '2026-08-01T09:30:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.72, imageUrl: '',
    description: 'Offre de démonstration. Capacité utile et garantie à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-laptop-dakar', title: 'Ordinateur portable Core i5 16 Go — reconditionné', category: 'computing',
    seller: 'Revendeur informatique à confirmer', sellerType: 'merchant', city: 'Dakar', price: 295000, currency: 'XOF', condition: 'refurbished',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-03T10:15:00.000Z', publishedAt: '2026-08-03T10:15:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.75, imageUrl: '',
    description: 'Offre de démonstration. Batterie, clavier, licence et garantie à vérifier.', status: 'confirm',
  },
  {
    id: 'demo-printer-kaolack', title: 'Imprimante multifonction Wi-Fi — neuve', category: 'professional',
    seller: 'Fournisseur pro à confirmer', sellerType: 'merchant', city: 'Kaolack', price: 135000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-02T11:30:00.000Z', publishedAt: '2026-08-02T11:30:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.76, imageUrl: '',
    description: 'Offre de démonstration. Coût des consommables et garantie à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-salon-mbour', title: 'Salon 5 places — fabrication locale', category: 'home',
    seller: 'Artisan à confirmer', sellerType: 'merchant', city: 'Mbour', price: 340000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-03T08:45:00.000Z', publishedAt: '2026-08-03T08:45:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.69, imageUrl: '',
    description: 'Offre de démonstration. Dimensions, tissu, délai et transport à confirmer.', status: 'confirm',
  },
  {
    id: 'demo-machine-coudre-dakar', title: 'Machine à coudre industrielle — occasion', category: 'professional',
    seller: 'Atelier à confirmer', sellerType: 'individual', city: 'Dakar', price: 310000, currency: 'XOF', condition: 'used',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-07-30T16:00:00.000Z', publishedAt: '2026-07-30T16:00:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.64, imageUrl: '',
    description: 'Offre de démonstration. Moteur, pédale, accessoires et disponibilité des pièces à vérifier.', status: 'confirm',
  },
  {
    id: 'demo-boubou-thies', title: 'Grand boubou brodé — sur commande', category: 'fashion',
    seller: 'Atelier de couture à confirmer', sellerType: 'merchant', city: 'Thiès', price: 65000, currency: 'XOF', condition: 'new',
    sourceName: 'Catalogue de démarrage SeneCompare', sourceUrl: '', verifiedAt: '2026-08-04T07:40:00.000Z', publishedAt: '2026-08-04T07:40:00.000Z',
    crossChecks: 1, sellerVerified: false, priceConsistency: 0.79, imageUrl: '',
    description: 'Offre de démonstration. Tissu, broderie, mesures et délai à confirmer.', status: 'confirm',
  },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, ctx, url);
      if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
      return await serveApplicationAsset(request, env, url);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const invalidRequest = ['invalid_json', 'payload_too_large'].includes(detail);
      console.error(JSON.stringify({ event: 'senecompare_request_failed', path: url.pathname, detail }));
      return json({
        ok: false,
        error: invalidRequest ? detail : 'internal_error',
        message: invalidRequest ? 'La requête est invalide.' : 'Une erreur interne est survenue.',
      }, invalidRequest ? 400 : 500);
    }
  },
};

async function handleApi(request, env, ctx, url) {
  if (request.method === 'OPTIONS') return preflight();
  if (url.pathname === '/api/health') {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
    return json({
      ok: true, app: APP_NAME, version: APP_VERSION,
      data_mode: hasSupabase(env) ? 'supabase' : hasExternalSearch(env) ? 'external_api' : 'starter_catalog',
      checked_at: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/search') {
    if (!['GET', 'POST'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
    return handleSearch(request, env, url);
  }
  if (url.pathname === '/api/feedback') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return handleFeedback(request, env, ctx);
  }
  if (url.pathname === '/api/merchant/claim') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return handleMerchantClaim(request, env, ctx);
  }
  if (url.pathname === '/api/alerts') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return handleAlert(request, env, ctx);
  }
  return json({ ok: false, error: 'not_found' }, 404);
}

async function handleSearch(request, env, url) {
  const input = request.method === 'POST' ? await readJson(request) : Object.fromEntries(url.searchParams.entries());
  const filters = normalizeFilters(input);
  if (!filters.query && filters.category === 'all') {
    return json({
      ok: true, query: '', filters, results: [], total: 0,
      data_mode: hasSupabase(env) ? 'supabase' : hasExternalSearch(env) ? 'external_api' : 'starter_catalog',
      methodology: methodologySummary(),
    });
  }

  try {
    let source = 'starter_catalog';
    let offers = [];
    if (hasExternalSearch(env)) {
      offers = await queryExternalSearch(env, filters);
      source = 'external_api';
    } else if (hasSupabase(env)) {
      offers = await querySupabase(env, filters);
      source = 'supabase';
    } else {
      offers = STARTER_OFFERS;
    }
    const results = rankOffers(offers, filters).slice(0, 40);
    return json({
      ok: true, query: filters.query, filters, results, total: results.length,
      data_mode: source, generated_at: new Date().toISOString(), methodology: methodologySummary(),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_search_failed', detail: error instanceof Error ? error.message : String(error) }));
    return json({ ok: false, error: 'search_unavailable', message: 'La recherche est temporairement indisponible. Réessayez dans quelques instants.' }, 503);
  }
}

async function handleFeedback(request, env, ctx) {
  const body = await readJson(request);
  const payload = {
    offer_id: cleanText(body.offerId, 100),
    reason: cleanEnum(body.reason, ['price_outdated', 'unavailable', 'wrong_details', 'suspicious', 'other'], 'other'),
    details: cleanText(body.details, 500), page_url: cleanText(body.pageUrl, 500),
    locale: cleanEnum(body.locale, ['fr', 'wo'], 'fr'), created_at: new Date().toISOString(),
  };
  if (!payload.offer_id) return json({ ok: false, error: 'offer_id_required' }, 400);
  if (hasSupabase(env)) {
    ctx.waitUntil(insertSupabase(env, 'senecompare_price_reports', payload).catch((error) => {
      console.error(JSON.stringify({ event: 'senecompare_feedback_insert_failed', detail: String(error) }));
    }));
  }
  return json({ ok: true, accepted: true, message: 'Merci. Le signalement sera vérifié.' }, 202);
}

async function handleMerchantClaim(request, env, ctx) {
  const body = await readJson(request);
  const payload = {
    business_name: cleanText(body.businessName, 160), contact_name: cleanText(body.contactName, 160),
    phone: cleanPhone(body.phone), email: cleanEmail(body.email), offer_id: cleanText(body.offerId, 100),
    message: cleanText(body.message, 800), status: 'pending', created_at: new Date().toISOString(),
  };
  if (!payload.business_name || !payload.phone) return json({ ok: false, error: 'business_name_and_phone_required' }, 400);
  if (hasSupabase(env)) {
    ctx.waitUntil(insertSupabase(env, 'senecompare_merchant_claims', payload).catch((error) => {
      console.error(JSON.stringify({ event: 'senecompare_claim_insert_failed', detail: String(error) }));
    }));
  }
  return json({ ok: true, accepted: true, message: 'Demande reçue. Une vérification manuelle est nécessaire.' }, 202);
}

async function handleAlert(request, env, ctx) {
  const body = await readJson(request);
  const payload = {
    offer_id: cleanText(body.offerId, 100), query: cleanText(body.query, MAX_QUERY_LENGTH),
    target_price: normalizeInteger(body.targetPrice, 0, 1_000_000_000), phone: cleanPhone(body.phone),
    email: cleanEmail(body.email), locale: cleanEnum(body.locale, ['fr', 'wo'], 'fr'),
    status: 'active', created_at: new Date().toISOString(),
  };
  if (!payload.offer_id && !payload.query) return json({ ok: false, error: 'offer_or_query_required' }, 400);
  if (!payload.phone && !payload.email) return json({ ok: false, error: 'contact_required' }, 400);
  if (hasSupabase(env)) {
    ctx.waitUntil(insertSupabase(env, 'senecompare_public_alert_requests', payload).catch((error) => {
      console.error(JSON.stringify({ event: 'senecompare_alert_insert_failed', detail: String(error) }));
    }));
  }
  return json({ ok: true, accepted: true, message: 'Alerte enregistrée. La validation du contact sera ajoutée avant l’envoi automatique.' }, 202);
}

async function serveApplicationAsset(request, env, url) {
  const routeMap = new Map([
    ['/', '/senecompare/index.html'], ['/index.html', '/senecompare/index.html'],
    ['/styles.css', '/senecompare/styles.css'], ['/app.js', '/senecompare/app.js'],
    ['/manifest.webmanifest', '/senecompare/manifest.webmanifest'], ['/sw.js', '/senecompare/sw.js'],
    ['/icon.svg', '/senecompare/icon.svg'], ['/privacy', '/senecompare/index.html'],
    ['/methodology', '/senecompare/index.html'], ['/merchant', '/senecompare/index.html'],
  ]);
  const assetPath = routeMap.get(url.pathname);
  if (!assetPath) return json({ ok: false, error: 'not_found' }, 404);
  const assetUrl = new URL(assetPath, url.origin);
  const upstream = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method, headers: request.headers }));
  const headers = new Headers(upstream.headers);
  headers.delete('set-cookie');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=()');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('x-senecompare-version', APP_VERSION);
  if (assetPath.endsWith('.html')) {
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'no-cache, must-revalidate');
    headers.set('content-security-policy', [
      "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob: https:",
      "connect-src 'self'", "font-src 'self' data:", "manifest-src 'self'", "worker-src 'self' blob:",
      "media-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
      "frame-ancestors 'none'", 'upgrade-insecure-requests',
    ].join('; '));
  } else if (assetPath.endsWith('.js')) {
    headers.set('content-type', 'application/javascript; charset=utf-8');
    headers.set('cache-control', assetPath.endsWith('/sw.js') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=300');
    if (assetPath.endsWith('/sw.js')) headers.set('service-worker-allowed', '/');
  } else if (assetPath.endsWith('.css')) {
    headers.set('content-type', 'text/css; charset=utf-8');
    headers.set('cache-control', 'public, max-age=300');
  } else if (assetPath.endsWith('.webmanifest')) {
    headers.set('content-type', 'application/manifest+json; charset=utf-8');
    headers.set('cache-control', 'no-cache, must-revalidate');
  } else if (assetPath.endsWith('.svg')) {
    headers.set('content-type', 'image/svg+xml; charset=utf-8');
    headers.set('cache-control', 'public, max-age=86400');
  }
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status, statusText: upstream.statusText, headers,
  });
}

function normalizeFilters(input) {
  const query = cleanText(input.query ?? input.q, MAX_QUERY_LENGTH);
  const cityCandidate = cleanText(input.city, 80) || 'Sénégal';
  const categoryCandidate = cleanText(input.category, 40).toLowerCase() || 'all';
  return {
    query,
    city: ALLOWED_CITIES.has(cityCandidate) ? cityCandidate : 'Sénégal',
    category: ALLOWED_CATEGORIES.has(categoryCandidate) ? categoryCandidate : 'all',
    condition: cleanEnum(input.condition, ['all', 'new', 'used', 'refurbished'], 'all'),
    sellerType: cleanEnum(input.sellerType, ['all', 'merchant', 'individual'], 'all'),
    maxPrice: normalizeInteger(input.maxPrice, 0, 1_000_000_000),
    sort: cleanEnum(input.sort, ['relevance', 'price_asc', 'price_desc', 'freshness', 'confidence'], 'relevance'),
  };
}

function rankOffers(rawOffers, filters) {
  const terms = tokenize(filters.query);
  const now = Date.now();
  const normalized = rawOffers.map(normalizeOffer).filter(Boolean).map((offer) => {
    const trust = calculateTrust(offer, now);
    const searchable = normalizeSearchText([offer.title, offer.description, offer.seller, offer.city, categoryLabel(offer.category)].join(' '));
    const matchedTerms = terms.filter((term) => searchable.includes(term)).length;
    const relevance = terms.length === 0 ? 1 : matchedTerms / terms.length;
    return { ...offer, trust, relevance };
  }).filter((offer) => {
    if (filters.category !== 'all' && offer.category !== filters.category) return false;
    if (filters.city !== 'Sénégal' && offer.city !== filters.city) return false;
    if (filters.condition !== 'all' && offer.condition !== filters.condition) return false;
    if (filters.sellerType !== 'all' && offer.sellerType !== filters.sellerType) return false;
    if (filters.maxPrice > 0 && offer.price > filters.maxPrice) return false;
    if (terms.length > 0 && offer.relevance <= 0) return false;
    return true;
  });
  const comparators = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    freshness: (a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt),
    confidence: (a, b) => b.trust.score - a.trust.score,
    relevance: (a, b) => (b.relevance - a.relevance) || (b.trust.score - a.trust.score) || (a.price - b.price),
  };
  return normalized.sort(comparators[filters.sort] || comparators.relevance);
}

function normalizeOffer(value) {
  if (!value || typeof value !== 'object') return null;
  const price = normalizeInteger(value.price ?? value.price_xof, 0, 1_000_000_000);
  const title = cleanText(value.title, 180);
  if (!title || price <= 0) return null;
  const category = cleanText(value.category, 40).toLowerCase();
  return {
    id: cleanText(value.id, 100) || crypto.randomUUID(), title,
    category: ALLOWED_CATEGORIES.has(category) && category !== 'all' ? category : 'professional',
    seller: cleanText(value.seller ?? value.merchant_name, 160) || 'Vendeur à confirmer',
    sellerType: cleanEnum(value.sellerType ?? value.seller_type, ['merchant', 'individual'], 'merchant'),
    city: ALLOWED_CITIES.has(value.city) ? value.city : 'Sénégal', price,
    currency: cleanText(value.currency, 8) || 'XOF', condition: cleanEnum(value.condition, ['new', 'used', 'refurbished'], 'new'),
    sourceName: cleanText(value.sourceName ?? value.source_name, 160) || 'Source publique',
    sourceUrl: safeHttpUrl(value.sourceUrl ?? value.source_url), verifiedAt: normalizeDate(value.verifiedAt ?? value.verified_at),
    publishedAt: normalizeDate(value.publishedAt ?? value.published_at),
    crossChecks: normalizeInteger(value.crossChecks ?? value.cross_checks, 0, 20),
    sellerVerified: Boolean(value.sellerVerified ?? value.seller_verified),
    priceConsistency: normalizeRatio(value.priceConsistency ?? value.price_consistency),
    imageUrl: safeHttpUrl(value.imageUrl ?? value.image_url), description: cleanText(value.description, 600),
    status: cleanEnum(value.status, ['verified', 'confirm', 'stale'], 'confirm'),
  };
}

function calculateTrust(offer, now = Date.now()) {
  const verifiedAt = Date.parse(offer.verifiedAt);
  const ageDays = Number.isFinite(verifiedAt) ? Math.max(0, (now - verifiedAt) / 86_400_000) : 365;
  const freshness = ageDays <= 2 ? 40 : ageDays <= 7 ? 32 : ageDays <= 14 ? 22 : ageDays <= 30 ? 12 : 4;
  const corroboration = Math.min(25, Math.max(0, offer.crossChecks) * 8);
  const seller = offer.sellerVerified ? 20 : offer.sellerType === 'merchant' ? 10 : 5;
  const consistency = Math.round(15 * normalizeRatio(offer.priceConsistency));
  const score = Math.min(100, freshness + corroboration + seller + consistency);
  return {
    score, label: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low',
    components: { freshness, corroboration, seller, consistency }, ageDays: Math.floor(ageDays),
  };
}

async function querySupabase(env, filters) {
  const endpoint = new URL('/rest/v1/senecompare_offers', env.SENECOMPARE_SUPABASE_URL);
  endpoint.searchParams.set('select', 'id,title,category,seller:merchant_name,seller_type,city,price:price_xof,currency,condition,source_name,source_url,verified_at,published_at,cross_checks,seller_verified,price_consistency,image_url,description,status');
  endpoint.searchParams.set('published', 'eq.true');
  endpoint.searchParams.set('order', 'verified_at.desc');
  endpoint.searchParams.set('limit', '100');
  if (filters.category !== 'all') endpoint.searchParams.set('category', `eq.${filters.category}`);
  if (filters.city !== 'Sénégal') endpoint.searchParams.set('city', `eq.${filters.city}`);
  if (filters.condition !== 'all') endpoint.searchParams.set('condition', `eq.${filters.condition}`);
  if (filters.maxPrice > 0) endpoint.searchParams.set('price_xof', `lte.${filters.maxPrice}`);
  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SENECOMPARE_SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SENECOMPARE_SUPABASE_ANON_KEY}`,
      accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`supabase_search_${response.status}`);
  const values = await response.json();
  return Array.isArray(values) ? values : [];
}

async function queryExternalSearch(env, filters) {
  const response = await fetch(env.SENECOMPARE_SEARCH_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', accept: 'application/json',
      ...(env.SENECOMPARE_SEARCH_API_TOKEN ? { authorization: `Bearer ${env.SENECOMPARE_SEARCH_API_TOKEN}` } : {}),
    },
    body: JSON.stringify({ ...filters, locale: 'fr-SN', limit: 100 }),
  });
  if (!response.ok) throw new Error(`external_search_${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.results) ? payload.results : [];
}

async function insertSupabase(env, table, payload) {
  const endpoint = new URL(`/rest/v1/${table}`, env.SENECOMPARE_SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: env.SENECOMPARE_SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SENECOMPARE_SUPABASE_ANON_KEY}`,
      'content-type': 'application/json', prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`supabase_insert_${table}_${response.status}`);
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('payload_too_large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('payload_too_large');
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    throw new Error('invalid_json');
  }
}

function hasSupabase(env) {
  return Boolean(env?.SENECOMPARE_SUPABASE_URL && env?.SENECOMPARE_SUPABASE_ANON_KEY);
}
function hasExternalSearch(env) { return Boolean(env?.SENECOMPARE_SEARCH_API_URL); }
function methodologySummary() {
  return {
    version: 1, label: 'Confiance calculée',
    components: { freshness: 40, corroboration: 25, seller_identity: 20, price_consistency: 15 },
    thresholds: { high: 75, medium: 50, low: 0 },
  };
}
function categoryLabel(category) {
  return ({
    phones: 'téléphone smartphone mobile', cars: 'voiture automobile véhicule',
    motorcycles: 'moto scooter Jakarta', appliances: 'électroménager frigo congélateur',
    computing: 'ordinateur informatique laptop', fashion: 'mode vêtement boubou',
    home: 'maison meuble salon', professional: 'matériel professionnel équipement',
  })[category] || category;
}
function tokenize(value) { return normalizeSearchText(value).split(/\s+/).filter((term) => term.length >= 2).slice(0, 12); }
function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function cleanText(value, maxLength = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function cleanEnum(value, allowed, fallback) {
  const normalized = cleanText(value, 40).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}
function cleanPhone(value) {
  const normalized = String(value ?? '').replace(/[^+\d]/g, '').slice(0, 20);
  return /^\+?\d{8,15}$/.test(normalized) ? normalized : '';
}
function cleanEmail(value) {
  const normalized = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}
function safeHttpUrl(value) {
  const candidate = cleanText(value, 500);
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch { return ''; }
}
function normalizeInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, Math.round(number)));
}
function normalizeRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}
function normalizeDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}
function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400',
    },
  });
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer', 'x-senecompare-version': APP_VERSION,
    },
  });
}
