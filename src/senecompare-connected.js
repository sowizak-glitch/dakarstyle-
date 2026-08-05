import baseApplication from './senecompare.js';

const APP_NAME = 'SeneCompare AI';
const APP_VERSION = '4.1.0';
const APP_ORIGIN = 'https://senecompare.dakarstyle.com';
const MAX_BODY_BYTES = 12_000;
const RATE_BUCKETS = new Map();
let rateSweepCounter = 0;

const ALLOWED_CITIES = new Set([
  'Sénégal', 'Dakar', 'Thiès', 'Saint-Louis', 'Mbour', 'Touba', 'Kaolack', 'Ziguinchor', 'Louga',
]);
const ALLOWED_CATEGORIES = new Set([
  'all', 'phones', 'cars', 'motorcycles', 'appliances', 'computing', 'fashion', 'home', 'professional',
]);
const STOP_WORDS = new Set([
  'acheter', 'achat', 'cherche', 'chercher', 'compare', 'comparer', 'prix', 'budget', 'moins', 'plus', 'sous',
  'avec', 'pour', 'dans', 'neuf', 'neuve', 'occasion', 'reconditionne', 'reconditionnee', 'venant', 'senegal',
  'dakar', 'thies', 'mbour', 'touba', 'kaolack', 'ziguinchor', 'louga', 'saint', 'louis', 'fcfa', 'cfa',
  'telephone', 'smartphone', 'voiture', 'moto', 'ordinateur', 'frigo', 'refrigerateur', 'maison', 'materiel',
  'waxal', 'mendale', 'tann', 'yées', 'lu', 'ci', 'ak', 'ngir',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return baseApplication.fetch(request, env, ctx);
    }

    if (request.method === 'OPTIONS') return preflight(request);

    const isSearch = url.pathname === '/api/search';
    const allowed = consumeRateLimit(request, isSearch ? 'search' : 'write', isSearch ? 90 : 24, isSearch ? 60_000 : 600_000);
    if (!allowed) {
      return json({ ok: false, error: 'rate_limited', message: 'Trop de requêtes. Réessayez dans quelques instants.' }, 429, request);
    }

    if (url.pathname === '/api/health') return handleHealth(request, env);
    if (url.pathname === '/api/search') return handleSearch(request, env, ctx, url);

    if (!isTrustedOrigin(request)) {
      return json({ ok: false, error: 'origin_not_allowed', message: 'Origine non autorisée.' }, 403, request);
    }

    if (url.pathname === '/api/feedback') return handleFeedback(request, env);
    if (url.pathname === '/api/alerts') return handleAlert(request, env);
    if (url.pathname === '/api/merchant/claim') return handleMerchantClaim(request, env);

    return baseApplication.fetch(request, env, ctx);
  },
};

async function handleHealth(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  let catalogConnected = false;
  let catalogSampleCount = 0;
  if (hasSupabase(env)) {
    try {
      const rows = await callCatalogRpc(env, {
        query: '', city: 'Sénégal', category: 'all', maxPrice: 0, condition: 'all', sellerType: 'all', limit: 1,
      });
      catalogConnected = true;
      catalogSampleCount = rows.length;
    } catch (error) {
      console.error(JSON.stringify({ event: 'senecompare_health_catalog_failed', detail: errorMessage(error) }));
    }
  }
  return json({
    ok: true,
    app: APP_NAME,
    version: APP_VERSION,
    data_mode: catalogConnected ? 'supabase_catalog' : 'starter_catalog',
    catalog_connected: catalogConnected,
    catalog_sample_count: catalogSampleCount,
    checked_at: new Date().toISOString(),
  }, 200, request);
}

async function handleSearch(request, env, ctx, url) {
  if (!['GET', 'POST'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  const fallbackRequest = request.clone();
  const input = request.method === 'POST' ? await readJson(request) : Object.fromEntries(url.searchParams.entries());
  const filters = normalizeFilters(input);

  if (!filters.query && filters.category === 'all') {
    return json({
      ok: true, query: '', filters, results: [], total: 0,
      data_mode: hasSupabase(env) ? 'supabase_catalog' : 'starter_catalog',
      methodology: methodologySummary(),
    }, 200, request);
  }

  if (!hasSupabase(env)) return starterFallback(fallbackRequest, env, ctx);

  try {
    const rpcFilters = {
      ...filters,
      query: extractCatalogTerm(filters.query),
      limit: 100,
    };
    const rows = await callCatalogRpc(env, rpcFilters);
    if (!rows.length) return starterFallback(fallbackRequest, env, ctx);

    const results = rows.map(normalizeRpcOffer).filter(Boolean);
    sortOffers(results, filters.sort);
    return json({
      ok: true,
      query: filters.query,
      filters,
      results: results.slice(0, 40),
      total: Math.min(results.length, 40),
      data_mode: 'supabase_catalog',
      generated_at: new Date().toISOString(),
      methodology: methodologySummary(),
    }, 200, request);
  } catch (error) {
    console.error(JSON.stringify({ event: 'senecompare_connected_search_failed', detail: errorMessage(error) }));
    return starterFallback(fallbackRequest, env, ctx);
  }
}

async function starterFallback(request, env, ctx) {
  const fallbackEnv = {
    ...env,
    SENECOMPARE_SUPABASE_URL: undefined,
    SENECOMPARE_SUPABASE_ANON_KEY: undefined,
    SENECOMPARE_SEARCH_API_URL: undefined,
    SENECOMPARE_SEARCH_API_TOKEN: undefined,
  };
  return baseApplication.fetch(request, fallbackEnv, ctx);
}

async function handleFeedback(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  const body = await readJson(request);
  if (isBotPayload(body)) return json({ ok: true, accepted: true }, 202, request);
  const payload = {
    offer_id: cleanText(body.offerId, 100),
    reason: cleanEnum(body.reason, ['price_outdated', 'unavailable', 'wrong_details', 'suspicious', 'other'], 'other'),
    details: cleanText(body.details, 500),
    page_url: cleanText(body.pageUrl, 500),
    locale: cleanEnum(body.locale, ['fr', 'wo'], 'fr'),
    review_status: 'pending',
    created_at: new Date().toISOString(),
  };
  if (!payload.offer_id) return json({ ok: false, error: 'offer_id_required' }, 400, request);
  await insertPublicRow(env, 'senecompare_price_reports', payload);
  return json({ ok: true, accepted: true, message: 'Merci. Le signalement sera vérifié.' }, 202, request);
}

async function handleAlert(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  const body = await readJson(request);
  if (isBotPayload(body)) return json({ ok: true, accepted: true }, 202, request);
  const payload = {
    offer_id: cleanText(body.offerId, 100),
    query: cleanText(body.query, 180),
    target_price: normalizeInteger(body.targetPrice, 0, 1_000_000_000),
    phone: cleanPhone(body.phone),
    email: cleanEmail(body.email),
    locale: cleanEnum(body.locale, ['fr', 'wo'], 'fr'),
    status: 'active',
    created_at: new Date().toISOString(),
  };
  if (!payload.offer_id && !payload.query) return json({ ok: false, error: 'offer_or_query_required' }, 400, request);
  if (!payload.phone && !payload.email) return json({ ok: false, error: 'contact_required' }, 400, request);
  await insertPublicRow(env, 'senecompare_public_alert_requests', payload);
  return json({ ok: true, accepted: true, message: 'Alerte enregistrée. Le contact devra être vérifié avant tout envoi.' }, 202, request);
}

async function handleMerchantClaim(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  const body = await readJson(request);
  if (isBotPayload(body)) return json({ ok: true, accepted: true }, 202, request);
  const payload = {
    business_name: cleanText(body.businessName, 160),
    contact_name: cleanText(body.contactName, 160),
    phone: cleanPhone(body.phone),
    email: cleanEmail(body.email),
    offer_id: cleanText(body.offerId, 100),
    message: cleanText(body.message, 800),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  if (!payload.business_name || !payload.phone) {
    return json({ ok: false, error: 'business_name_and_phone_required' }, 400, request);
  }
  await insertPublicRow(env, 'senecompare_merchant_claims', payload);
  return json({ ok: true, accepted: true, message: 'Demande reçue. Une vérification manuelle sera effectuée.' }, 202, request);
}

async function callCatalogRpc(env, filters) {
  const endpoint = new URL('/rest/v1/rpc/senecompare_search_catalog', env.SENECOMPARE_SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_query: cleanText(filters.query, 100),
      p_category: filters.category,
      p_city: filters.city,
      p_max_price: filters.maxPrice,
      p_condition: filters.condition,
      p_seller_type: filters.sellerType,
      p_limit: normalizeInteger(filters.limit ?? 100, 1, 100),
    }),
  });
  if (!response.ok) {
    const detail = cleanText(await response.text(), 500);
    throw new Error(`catalog_rpc_${response.status}:${detail}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function insertPublicRow(env, table, payload) {
  if (!hasSupabase(env)) throw new Error('supabase_not_configured');
  const endpoint = new URL(`/rest/v1/${table}`, env.SENECOMPARE_SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...supabaseHeaders(env), prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = cleanText(await response.text(), 500);
    throw new Error(`supabase_insert_${table}_${response.status}:${detail}`);
  }
}

function supabaseHeaders(env) {
  return {
    apikey: env.SENECOMPARE_SUPABASE_ANON_KEY,
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

function normalizeRpcOffer(row) {
  if (!row || typeof row !== 'object') return null;
  const price = normalizeInteger(row.price, 1, 1_000_000_000);
  const title = cleanText(row.title, 180);
  if (!title || !price) return null;
  const verifiedAt = normalizeDate(row.verified_at);
  const crossChecks = normalizeInteger(row.cross_checks, 0, 20);
  const sellerVerified = Boolean(row.seller_verified);
  const priceConsistency = normalizeRatio(row.price_consistency);
  const trust = calculateTrust({ verifiedAt, crossChecks, sellerVerified, priceConsistency });
  return {
    id: cleanText(row.id, 100) || crypto.randomUUID(),
    title,
    category: cleanEnum(row.category, [...ALLOWED_CATEGORIES].filter((item) => item !== 'all'), 'professional'),
    seller: cleanText(row.seller, 160) || 'Vendeur à confirmer',
    sellerType: cleanEnum(row.seller_type, ['merchant', 'individual'], 'individual'),
    city: ALLOWED_CITIES.has(row.city) ? row.city : 'Sénégal',
    price,
    currency: 'XOF',
    condition: cleanEnum(row.condition, ['new', 'used', 'refurbished'], 'used'),
    sourceName: cleanText(row.source_name, 160) || 'Source publique',
    sourceUrl: safeHttpUrl(row.source_url),
    verifiedAt,
    publishedAt: normalizeDate(row.published_at),
    crossChecks,
    sellerVerified,
    priceConsistency,
    imageUrl: safeHttpUrl(row.image_url),
    description: cleanText(row.description, 600),
    status: cleanEnum(row.status, ['verified', 'confirm', 'stale'], 'confirm'),
    trust,
    relevance: 1,
  };
}

function calculateTrust(offer, now = Date.now()) {
  const verified = Date.parse(offer.verifiedAt);
  const ageDays = Number.isFinite(verified) ? Math.max(0, (now - verified) / 86_400_000) : 365;
  const freshness = ageDays <= 2 ? 40 : ageDays <= 7 ? 32 : ageDays <= 14 ? 22 : ageDays <= 30 ? 12 : 4;
  const corroboration = Math.min(25, Math.max(0, offer.crossChecks) * 8);
  const seller = offer.sellerVerified ? 20 : 8;
  const consistency = Math.round(15 * normalizeRatio(offer.priceConsistency));
  const score = Math.min(100, freshness + corroboration + seller + consistency);
  return {
    score,
    label: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low',
    components: { freshness, corroboration, seller, consistency },
    ageDays: Math.floor(ageDays),
  };
}

function sortOffers(offers, sort) {
  const comparators = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    freshness: (a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt),
    confidence: (a, b) => b.trust.score - a.trust.score,
    relevance: (a, b) => (b.trust.score - a.trust.score) || (Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt)) || (a.price - b.price),
  };
  offers.sort(comparators[sort] || comparators.relevance);
}

function normalizeFilters(input) {
  const query = cleanText(input.query ?? input.q, 180);
  const inferred = inferFromQuery(query);
  const cityCandidate = cleanText(input.city, 80) || inferred.city || 'Sénégal';
  const categoryCandidate = (cleanText(input.category, 40).toLowerCase() || inferred.category || 'all');
  return {
    query,
    city: ALLOWED_CITIES.has(cityCandidate) ? cityCandidate : 'Sénégal',
    category: ALLOWED_CATEGORIES.has(categoryCandidate) ? categoryCandidate : 'all',
    condition: cleanEnum(input.condition, ['all', 'new', 'used', 'refurbished'], 'all'),
    sellerType: cleanEnum(input.sellerType, ['all', 'merchant', 'individual'], 'all'),
    maxPrice: normalizeInteger(input.maxPrice || inferred.maxPrice, 0, 1_000_000_000),
    sort: cleanEnum(input.sort, ['relevance', 'price_asc', 'price_desc', 'freshness', 'confidence'], 'relevance'),
  };
}

function inferFromQuery(query) {
  const normalized = normalizeSearchText(query);
  const city = [...ALLOWED_CITIES].find((candidate) => candidate !== 'Sénégal' && normalized.includes(normalizeSearchText(candidate))) || '';
  const moneyMatch = normalized.match(/(\d{2,3}(?:[ .]?\d{3})+|\d{4,9})/);
  const maxPrice = moneyMatch ? normalizeInteger(moneyMatch[1].replace(/[ .]/g, ''), 0, 1_000_000_000) : 0;
  let category = '';
  const mappings = [
    ['phones', ['telephone', 'smartphone', 'samsung', 'iphone', 'xiaomi', 'redmi']],
    ['cars', ['voiture', 'auto', 'vehicule', 'toyota', 'renault', 'ford']],
    ['motorcycles', ['moto', 'jakarta', 'scooter', 'ktm', 'honda forza']],
    ['appliances', ['frigo', 'refrigerateur', 'congelateur', 'television', 'climatiseur']],
    ['computing', ['ordinateur', 'laptop', 'pc', 'imprimante', 'elitebook']],
    ['fashion', ['boubou', 'vetement', 'sneakers', 'tissu', 'maillot']],
    ['home', ['salon', 'meuble', 'maison', 'canape']],
    ['professional', ['machine a coudre', 'materiel', 'equipement', 'professionnel']],
  ];
  for (const [key, terms] of mappings) {
    if (terms.some((term) => normalized.includes(term))) { category = key; break; }
  }
  return { city, maxPrice, category };
}

function extractCatalogTerm(query) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const meaningful = tokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
  if (meaningful.length) return meaningful.sort((a, b) => b.length - a.length)[0];
  const productFallback = tokens.find((token) => ['iphone', 'samsung', 'jakarta', 'elitebook', 'maillot', 'frigo'].includes(token));
  return productFallback || '';
}

function consumeRateLimit(request, bucket, maxRequests, windowMs) {
  const ip = cleanText(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown', 80);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = RATE_BUCKETS.get(key);
  if (!current || current.resetAt <= now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    sweepRateBuckets(now);
    return true;
  }
  if (current.count >= maxRequests) return false;
  current.count += 1;
  RATE_BUCKETS.set(key, current);
  sweepRateBuckets(now);
  return true;
}

function sweepRateBuckets(now) {
  rateSweepCounter += 1;
  if (rateSweepCounter % 100 !== 0 && RATE_BUCKETS.size < 5000) return;
  for (const [key, value] of RATE_BUCKETS) {
    if (value.resetAt <= now) RATE_BUCKETS.delete(key);
  }
  if (RATE_BUCKETS.size > 5000) {
    const overflow = RATE_BUCKETS.size - 5000;
    let removed = 0;
    for (const key of RATE_BUCKETS.keys()) {
      RATE_BUCKETS.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

function isTrustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === APP_ORIGIN;
}

function isBotPayload(body) {
  return Boolean(cleanText(body.website || body.companyWebsite || body.fax, 200));
}

function hasSupabase(env) {
  return Boolean(env?.SENECOMPARE_SUPABASE_URL && env?.SENECOMPARE_SUPABASE_ANON_KEY);
}

function methodologySummary() {
  return {
    version: 1,
    label: 'Confiance calculée',
    components: { freshness: 40, corroboration: 25, seller_identity: 20, price_consistency: 15 },
    thresholds: { high: 75, medium: 50, low: 0 },
  };
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

function preflight(request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = origin === APP_ORIGIN ? origin : APP_ORIGIN;
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  });
}

function json(value, status = 200, request = null) {
  const origin = request?.headers?.get('origin');
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-senecompare-version': APP_VERSION,
    vary: 'Origin',
  };
  if (!origin || origin === APP_ORIGIN) headers['access-control-allow-origin'] = origin || APP_ORIGIN;
  return new Response(JSON.stringify(value), { status, headers });
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
  } catch {
    return '';
  }
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
function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
