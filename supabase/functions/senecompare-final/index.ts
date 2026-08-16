import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '2.3.0';
const PROD = 'https://senecompare.dakarstyle.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const UPSTREAM = `${SUPABASE_URL}/functions/v1/senecompare-quality`;
const ORIGINS = new Set([
  PROD,
  'https://senecompare-ai.vercel.app',
  'http://localhost:5173'
]);
function serviceKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    try {
      const p = JSON.parse(modern);
      return p.default || Object.values(p)[0];
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}
const db = createClient(SUPABASE_URL, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const clean = (v)=>String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const decode = (v)=>v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'");
const plain = (v)=>decode(clean(v)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function cors(req) {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(o) ? o : PROD,
    'Access-Control-Allow-Headers': 'content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-SeneCompare-Version': VERSION
    }
  });
}
const STOP = new Set([
  'je',
  'veux',
  'acheter',
  'cherche',
  'trouve',
  'verifie',
  'moi',
  'prix',
  'tarif',
  'tarifs',
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'a',
  'au',
  'senegal',
  'dakar',
  'pour',
  'avec',
  '2025',
  '2026'
]);
function words(v) {
  return plain(v).replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((x)=>x.length > 1 && !STOP.has(x));
}
function overlap(q, t) {
  const a = [
    ...new Set(words(q))
  ], b = new Set(words(t));
  if (!a.length) return .5;
  return a.filter((x)=>b.has(x)).length / a.length;
}
function matches(cat, title, q) {
  const x = plain(title), p = plain(q);
  if (cat === 'informatique') return /ordinateur|\bpc\b|laptop|macbook|elitebook|thinkpad|core\s*i[3579]|ssd|ram/.test(x) && !/iphone|smartphone/.test(x);
  if (cat === 'telephone') return /iphone|telephone|smartphone|samsung|galaxy|xiaomi|tecno|infinix|oppo|pixel/.test(x);
  if (cat === 'moto') return /moto|scooter|jakarta|vespa|tricycle|yamaha|honda|bmw|kawasaki|suzuki|bajaj|piaggio|ktm|lifan|voge|tvs|africa twin|black max/.test(x);
  if (cat === 'voiture') return /voiture|renault|peugeot|toyota|ford|mercedes|bmw|hyundai|kia|citroen|nissan|volkswagen|golf|suv|4x4|pickup|range rover|dacia|chevrolet|mazda/.test(x);
  if (cat === 'electromenager' && /frigo|refrigerateur/.test(p)) return /frigo|refrigerateur|congelateur|side by side/.test(x);
  if (cat === 'electromenager' && /climatiseur/.test(p)) return /climatiseur|split|clim/.test(x);
  if (cat === 'electromenager') return /frigo|refrigerateur|congelateur|climatiseur|machine a laver|cuisiniere|television|micro onde|seche linge|lave linge/.test(x);
  if (cat === 'mode' && /maillot/.test(p)) return /maillot/.test(x);
  if (cat === 'mode') return /chaussure|sneaker|basket|maillot|t-shirt|robe|sac|vetement|tissu|wax|boubou/.test(x);
  if (cat === 'beaute') return /parfum|perruque|meche|beaute|cosmetique|maquillage/.test(x);
  if (cat === 'maison') return /canape|matelas|armoire|meuble|chaise|table|salon/.test(x);
  if (cat === 'materiel') return /outil|perceuse|materiel|groupe electrogene|pompe|solaire/.test(x);
  return true;
}
function limits(cat) {
  if (cat === 'voiture') return [
    300000,
    100000000
  ];
  if (cat === 'moto') return [
    50000,
    50000000
  ];
  if (cat === 'electromenager') return [
    5000,
    5000000
  ];
  if (cat === 'informatique' || cat === 'telephone') return [
    5000,
    10000000
  ];
  if (cat === 'mode' || cat === 'beaute') return [
    500,
    2000000
  ];
  if (cat === 'maison') return [
    1000,
    10000000
  ];
  return [
    500,
    100000000
  ];
}
function local(domain) {
  const d = plain(domain).replace(/^www\./, '');
  return d.endsWith('.sn') || [
    'expat-dakar.com',
    'jumia.sn',
    'dakarstyle.com',
    'sowhatafrica.com',
    'sn.coinafrique.com'
  ].some((x)=>d === x || d.endsWith('.' + x));
}
function transformCached(row, p) {
  const title = decode(clean(row.title || row.product_name)), price = Number(row.total_fcfa || row.price_fcfa || 0), rel = Number(row.relevance || overlap(p.product, title)), budget = p.max_price_fcfa ? price <= p.max_price_fcfa ? 'within' : 'above' : 'none', exact = overlap(p.product, title) >= .66;
  return {
    id: row.offer_id || null,
    product_name: clean(row.product_name || title),
    category: row.category || p.category,
    title,
    seller_name: row.seller_name || row.source_name,
    price_fcfa: Number(row.price_fcfa || price),
    shipping_fcfa: row.shipping_fcfa == null ? null : Number(row.shipping_fcfa),
    total_fcfa: price,
    condition: row.condition || null,
    location: row.location || null,
    availability: row.availability || 'À confirmer sur la page source',
    image_url: row.image_url || null,
    source_name: row.source_name,
    source_domain: row.source_domain,
    source_url: row.source_url,
    confidence: Math.round(Number(row.confidence || .7) * 100),
    verified_at: row.fetched_at,
    live: false,
    relevance: rel,
    budget_status: budget,
    over_budget_fcfa: budget === 'above' ? price - p.max_price_fcfa : 0,
    continuity_cache: true,
    match_level: exact ? 'exact' : 'proche'
  };
}
function normalizeExisting(row, p) {
  const title = decode(clean(row.title || row.product_name)), price = Number(row.total_fcfa || row.price_fcfa || 0), budget = p.max_price_fcfa ? price <= p.max_price_fcfa ? 'within' : 'above' : 'none', exact = overlap(p.product, title) >= .66;
  return {
    ...row,
    title,
    product_name: decode(clean(row.product_name || title)),
    total_fcfa: price,
    price_fcfa: Number(row.price_fcfa || price),
    budget_status: budget,
    over_budget_fcfa: budget === 'above' ? price - p.max_price_fcfa : 0,
    continuity_cache: Boolean(row.continuity_cache),
    match_level: row.match_level || (exact ? 'exact' : 'proche')
  };
}
function merge(p, live, cached) {
  const [min, max] = limits(p.category), map = new Map();
  for (const raw of [
    ...live.map((x)=>normalizeExisting(x, p)),
    ...cached.map((x)=>transformCached(x, p))
  ]){
    const title = clean(raw.title), domain = clean(raw.source_domain), price = Number(raw.total_fcfa || 0);
    if (!title || !domain || !local(domain) || !matches(p.category, title, p.product) || !Number.isFinite(price) || price < min || price > max) continue;
    const key = clean(raw.source_url) || `${plain(title).replace(/[^a-z0-9]/g, '').slice(0, 70)}|${price}|${plain(domain)}`, old = map.get(key);
    if (!old || Number(raw.confidence || 0) > Number(old.confidence || 0) || !raw.continuity_cache && old.continuity_cache) map.set(key, raw);
  }
  const out = [
    ...map.values()
  ];
  out.sort((a, b)=>{
    const rank = (x)=>x.budget_status === 'within' ? 0 : x.budget_status === 'none' ? 1 : 2, ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.match_level !== b.match_level) return a.match_level === 'exact' ? -1 : 1;
    if (ra === 2 && a.over_budget_fcfa !== b.over_budget_fcfa) return a.over_budget_fcfa - b.over_budget_fcfa;
    if (Boolean(a.continuity_cache) !== Boolean(b.continuity_cache)) return a.continuity_cache ? 1 : -1;
    return a.total_fcfa - b.total_fcfa;
  });
  return out.slice(0, 8);
}
async function upstream(path, req, body) {
  return fetch(UPSTREAM + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-version': VERSION,
      'user-agent': req.headers.get('user-agent') || 'SeneCompareFinal/2.3.0'
    },
    body,
    signal: AbortSignal.timeout(50000)
  });
}
async function cached(p) {
  const { data, error } = await db.rpc('sc_find_offers', {
    p_query: p.product,
    p_limit: 16
  });
  if (error) {
    console.error('cache_rpc', error.message);
    return [];
  }
  return data || [];
}
async function search(req) {
  const body = await req.text(), input = JSON.parse(body || '{}'), start = performance.now(), r = await upstream('/search', req, body), d = await r.json().catch(()=>({
      ok: false,
      results: [],
      meta: {},
      parsed: {}
    })), p = d.parsed || {
    original: clean(input.query),
    product: plain(input.query),
    normalized: plain(input.query),
    category: 'autre',
    max_price_fcfa: null
  }, cacheRows = await cached(p), results = merge(p, Array.isArray(d.results) ? d.results : [], cacheRows), within = results.filter((x)=>x.budget_status === 'within').length, above = results.filter((x)=>x.budget_status === 'above').length, cacheCount = results.filter((x)=>x.continuity_cache).length;
  return json(req, {
    ok: true,
    version: VERSION,
    search_id: d.search_id || null,
    parsed: p,
    results,
    meta: {
      ...d.meta || {},
      result_count: results.length,
      source_count: new Set(results.map((x)=>x.source_domain)).size,
      quality_filtered: true,
      quality_version: VERSION,
      continuity_cache_used: cacheCount > 0,
      continuity_result_count: cacheCount,
      budget_match_count: within,
      above_budget_count: above,
      response_ms: Math.round(performance.now() - start),
      notice_fr: within || !p.max_price_fcfa ? 'Résultats publics vérifiés ou récemment vérifiés. Confirmez le stock, l’état et le prix final chez le vendeur.' : 'Aucune offre vérifiée ne respecte exactement ce budget. Voici les options les plus proches, clairement signalées au-dessus du budget.',
      notice_wo: within || !p.max_price_fcfa ? 'Résultats publiques yu ñu dëggal walla yu ñu dëggal lu yàggul. Dëggalal stock, état ak njëg bu mujj.' : 'Amul offre ci budget bi. Lii mooy yi gën a jege, te ñu màndargaal yi ëpp budget bi.'
    }
  });
}
Deno.serve(async (req)=>{
  const u = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors(req)
  });
  try {
    if (req.method === 'GET' && u.pathname.endsWith('/stats')) {
      const r = await upstream('/stats', req);
      const d = await r.json().catch(()=>({
          ok: true,
          popular: [],
          categories: []
        }));
      return json(req, {
        ...d,
        version: VERSION,
        continuity: true
      });
    }
    if (req.method === 'GET') return json(req, {
      ok: true,
      service: 'SeneCompare Final Search',
      version: VERSION,
      quality_gate: true,
      continuity_cache: true,
      upstream: '2.2.2',
      timestamp: new Date().toISOString()
    });
    if (req.method === 'POST' && u.pathname.endsWith('/search')) return search(req);
    if (req.method === 'POST' && (u.pathname.endsWith('/click') || u.pathname.endsWith('/feedback'))) {
      const path = u.pathname.endsWith('/click') ? '/click' : '/feedback', body = await req.text(), r = await upstream(path, req, body);
      return new Response(await r.text(), {
        status: r.status,
        headers: {
          ...cors(req),
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }
    return json(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
  } catch (e) {
    const id = crypto.randomUUID();
    console.error(id, String(e));
    return json(req, {
      ok: false,
      code: 'INTERNAL_ERROR',
      request_id: id,
      message: 'La recherche a rencontré un problème temporaire.'
    }, 500);
  }
});
