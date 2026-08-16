const VERSION = '2.2.1';
const PROD = 'https://senecompare.dakarstyle.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const CORE = `${SUPABASE_URL}/functions/v1/senecompare-api`;
const UA = `SeneCompareQuality/${VERSION} (+${PROD})`;
const ORIGINS = new Set([
  PROD,
  'https://senecompare-ai.vercel.app',
  'http://localhost:5173'
]);
const clean = (v)=>String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const plain = (v)=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
function category(v) {
  const x = plain(v);
  if (/ordinateur|laptop|macbook|\bpc\b|imprimante|tablette|ipad|elitebook|thinkpad|core\s+i[3579]|ssd|ram/.test(x)) return 'informatique';
  if (/iphone|samsung|telephone|smartphone|xiaomi|tecno|infinix|oppo|pixel|galaxy/.test(x)) return 'telephone';
  if (/frigo|refrigerateur|congelateur|climatiseur|machine a laver|cuisiniere|television|\btv\b|micro.?onde/.test(x)) return 'electromenager';
  if (/voiture|automobile|vehicule|4x4|suv|berline|camion|pickup|minibus/.test(x)) return 'voiture';
  if (/moto|scooter|jakarta|vespa|tricycle|quad/.test(x)) return 'moto';
  if (/chaussure|sneaker|basket|maillot|t-?shirt|robe|sac|vetement|tissu|wax|boubou/.test(x)) return 'mode';
  if (/parfum|perruque|meche|beaute|cosmetique|maquillage/.test(x)) return 'beaute';
  if (/canape|matelas|armoire|meuble|chaise|table a manger|salon/.test(x)) return 'maison';
  if (/outil|perceuse|materiel|groupe electrogene|pompe|solaire/.test(x)) return 'materiel';
  return 'autre';
}
function parse(raw) {
  const original = clean(raw).slice(0, 300), normalized = plain(original);
  let budget = null;
  const money = original.match(/(\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/i);
  if (money) budget = Number(money[1].replace(/\D/g, ''));
  if (!budget) {
    const m = normalized.match(/(?:budget(?: de)?|moins de|max(?:imum)?|jusqu a|\ba)\s*[:=]?\s*(\d{4,9})\b/);
    if (m) budget = Number(m[1]);
  }
  let product = plain(original).replace(/\b(?:je veux(?: acheter)?|je voudrais(?: acheter)?|j aimerais(?: acheter)?|acheter|je cherche|recherche|trouve moi|trouvez moi|compare|comparer|verifie moi|verifiez moi|verifier|verifiez|regarde moi|montre moi|maangi seet|dama soxla|seetal ma|dama begg jend)\b/g, ' ').replace(/(?:moins de|max(?:imum)?|budget(?: de)?|jusqu a|\ba)?\s*[:=]?\s*(\d{1,3}(?:[ .]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)?/g, (m)=>/^\s*20\d{2}\s*$/.test(m) ? m : ' ').replace(/\b(?:les? )?(?:prix|tarifs?|offres?)\b/g, ' ').replace(/\b(?:sur internet|au senegal|dans le senegal|aujourd hui|svp|s il vous plait)\b/g, ' ').replace(/\s+/g, ' ').replace(/^(?:un|une|des|du|de la|le|la|les)\s+/, '').replace(/\s+[aà]\s*$/, '').trim();
  if (!product) product = plain(original);
  return {
    original,
    product,
    normalized: product,
    category: category(product),
    max_price_fcfa: budget
  };
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
const LOCAL = [
  'expat-dakar.com',
  'jumia.sn',
  'dakarstyle.com',
  'sowhatafrica.com',
  'sn.coinafrique.com',
  'coin-afrique.com'
];
function localDomain(d) {
  const x = plain(d).replace(/^www\./, '');
  return x.endsWith('.sn') || LOCAL.some((y)=>x === y || x.endsWith('.' + y));
}
function categoryMatch(cat, title, query) {
  const x = plain(title), q = plain(query);
  if (cat === 'informatique') return /ordinateur|\bpc\b|laptop|macbook|elitebook|thinkpad|core\s*i[3579]|ssd|ram/.test(x);
  if (cat === 'telephone') return /iphone|telephone|smartphone|samsung|galaxy|xiaomi|tecno|infinix|oppo|pixel/.test(x);
  if (cat === 'moto') return /moto|scooter|jakarta|vespa|tricycle|yamaha|honda|bmw|kawasaki|suzuki|bajaj|piaggio|ktm|lifan|zongshen|zhongyu/.test(x);
  if (cat === 'voiture') return /voiture|renault|peugeot|toyota|ford|mercedes|bmw|hyundai|kia|citroen|nissan|volkswagen|golf|suv|4x4|pickup|range rover|dacia|chevrolet|mazda/.test(x);
  if (cat === 'electromenager' && /frigo|refrigerateur/.test(q)) return /frigo|refrigerateur|congelateur|side by side/.test(x);
  if (cat === 'electromenager' && /climatiseur/.test(q)) return /climatiseur|split|clim/.test(x);
  if (cat === 'electromenager') return /frigo|refrigerateur|congelateur|climatiseur|machine a laver|cuisiniere|television|micro onde|seche linge|lave linge/.test(x);
  if (cat === 'mode' && /maillot/.test(q)) return /maillot/.test(x);
  if (cat === 'mode') return overlap(q, x) >= .24 || /chaussure|sneaker|basket|maillot|t-shirt|robe|sac|vetement|tissu|wax|boubou/.test(x);
  if (cat === 'beaute') return /parfum|perruque|meche|beaute|cosmetique|maquillage/.test(x);
  if (cat === 'maison') return /canape|matelas|armoire|meuble|chaise|table|salon/.test(x);
  if (cat === 'materiel') return /outil|perceuse|materiel|groupe electrogene|pompe|solaire/.test(x);
  return overlap(q, x) >= .2;
}
function minPrice(cat) {
  return cat === 'voiture' ? 300000 : cat === 'moto' ? 50000 : cat === 'mode' || cat === 'beaute' ? 1000 : 5000;
}
function priceCandidates(text, cat) {
  const s = clean(text).replace(/[\u00a0\u202f]/g, ' '), vals = [];
  const re = /(?<![:\d])(\d{1,3}(?: \d{3}){1,2}|\d{4,9})\s*(?:F\s*Cfa|FCFA|CFA|XOF|francs?)/gi;
  for (const m of s.matchAll(re)){
    const n = Number(m[1].replace(/\D/g, ''));
    if (n >= minPrice(cat) && n <= 100000000) vals.push(n);
  }
  return [
    ...new Set(vals)
  ].sort((a, b)=>a - b);
}
const decode = (v)=>v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const strip = (v)=>clean(decode(v).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
function expatPage(cat) {
  if (cat === 'moto') return 'https://www.expat-dakar.com/motos-scooters';
  if (cat === 'voiture') return 'https://www.expat-dakar.com/voitures';
  if (cat === 'informatique' || cat === 'telephone') return 'https://www.expat-dakar.com/multimedia';
  if (cat === 'mode' || cat === 'beaute') return 'https://www.expat-dakar.com/mode-beaute';
  if (cat === 'electromenager' || cat === 'maison') return 'https://www.expat-dakar.com/maison';
  if (cat === 'materiel') return 'https://www.expat-dakar.com/materiaux-outils-equipements';
  return 'https://www.expat-dakar.com/annonces';
}
async function expatOffers(p) {
  const page = expatPage(p.category);
  try {
    const r = await fetch(page, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'fr-SN,fr;q=.9'
      },
      signal: AbortSignal.timeout(7500)
    });
    if (!r.ok) return [];
    const html = await r.text(), out = [], seen = new Set();
    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']*\/annonce\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      const href = decode(m[1]), text = strip(m[2]);
      if (!text || !categoryMatch(p.category, text, p.product)) continue;
      const prices = priceCandidates(text, p.category);
      if (!prices.length) continue;
      const url = href.startsWith('http') ? href : `https://www.expat-dakar.com${href}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const chosen = prices[0], priceToken = new RegExp(`(?<![:\\d])${String(chosen).replace(/(?=(\d{3})+$)/g, '[ \\u00a0\\u202f]?')}\\s*(?:F\\s*Cfa|FCFA|CFA|XOF)`, 'i');
      let title = clean(text.split(priceToken)[0]).replace(/\b(?:Aujourd'hui|Hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche).*$/i, '').trim();
      if (title.length < 3) title = p.product;
      const rel = overlap(p.product, title);
      if (words(p.product).length > 1 && rel < .18 && !(p.category === 'moto' || p.category === 'voiture')) continue;
      const loc = text.match(/\b([A-Za-zÀ-ÿ' -]{2,30}),\s*(Dakar|Thiès|Thies|Saint-Louis|Mbour|Saly|Kaolack|Ziguinchor)\b/i);
      out.push({
        id: null,
        product_name: title,
        category: p.category,
        title,
        seller_name: 'Annonce Expat-Dakar',
        price_fcfa: chosen,
        shipping_fcfa: null,
        total_fcfa: chosen,
        condition: text.match(/\b(Neuf|Venant|D['’]occasion|Réconditionné)\b/i)?.[1] || null,
        location: loc ? `${clean(loc[1])}, ${loc[2]}` : null,
        availability: 'Annonce publique',
        image_url: null,
        source_name: 'Expat-Dakar',
        source_domain: 'expat-dakar.com',
        source_url: url,
        confidence: 86,
        verified_at: new Date().toISOString(),
        live: true,
        relevance: rel
      });
    }
    return out;
  } catch  {
    return [];
  }
}
function quality(p, r) {
  const title = clean(r.title || r.product_name), domain = clean(r.source_domain);
  if (!title || !domain || !localDomain(domain)) return false;
  if (!categoryMatch(p.category, title, p.product)) return false;
  const price = Number(r.total_fcfa || r.price_fcfa || 0);
  if (!Number.isFinite(price) || price < minPrice(p.category) || price > 100000000) return false;
  if (words(p.product).length > 1 && overlap(p.product, title) < .16 && p.category !== 'moto' && p.category !== 'voiture') return false;
  return true;
}
function merge(p, core, extra) {
  const map = new Map();
  for (const r of [
    ...extra,
    ...core
  ]){
    if (!quality(p, r)) continue;
    const price = Number(r.total_fcfa || r.price_fcfa), rel = Number(r.relevance ?? overlap(p.product, r.title || '')), budget = p.max_price_fcfa ? price <= p.max_price_fcfa ? 'within' : 'above' : 'none', item = {
      ...r,
      category: p.category,
      total_fcfa: price,
      price_fcfa: Number(r.price_fcfa || price),
      relevance: rel,
      budget_status: budget,
      over_budget_fcfa: budget === 'above' ? price - p.max_price_fcfa : 0
    };
    const key = `${plain(item.title).slice(0, 70)}|${price}|${plain(item.source_domain)}`, old = map.get(key);
    if (!old || Number(item.confidence) > Number(old.confidence)) map.set(key, item);
  }
  const arr = [
    ...map.values()
  ];
  arr.sort((a, b)=>{
    const ab = a.budget_status === 'within' ? 0 : a.budget_status === 'none' ? 1 : 2, bb = b.budget_status === 'within' ? 0 : b.budget_status === 'none' ? 1 : 2;
    if (ab !== bb) return ab - bb;
    if ((b.relevance || 0) !== (a.relevance || 0)) return (b.relevance || 0) - (a.relevance || 0);
    if (a.budget_status === 'above' && b.budget_status === 'above') return a.over_budget_fcfa - b.over_budget_fcfa;
    return a.total_fcfa - b.total_fcfa;
  });
  return arr.slice(0, 8);
}
async function coreRequest(path, req, body) {
  return fetch(CORE + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      'x-client-version': VERSION,
      'user-agent': req.headers.get('user-agent') || UA,
      'x-forwarded-for': req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || ''
    },
    body,
    signal: AbortSignal.timeout(40000)
  });
}
async function search(req) {
  const raw = await req.text(), input = JSON.parse(raw || '{}'), p = parse(input.query || ''), start = performance.now();
  if (p.product.length < 2) return json(req, {
    ok: false,
    code: 'QUERY_REQUIRED',
    message: 'Écrivez ou dites le produit recherché.'
  }, 400);
  const [coreRes, extra] = await Promise.all([
    coreRequest('/search', req, JSON.stringify({
      ...input,
      query: p.original
    })).then((r)=>r.json()).catch(()=>({
        ok: false,
        results: [],
        meta: {}
      })),
    expatOffers(p)
  ]), results = merge(p, Array.isArray(coreRes.results) ? coreRes.results : [], extra), within = results.filter((x)=>x.budget_status === 'within').length, above = results.filter((x)=>x.budget_status === 'above').length;
  return json(req, {
    ok: true,
    version: VERSION,
    search_id: coreRes.search_id || null,
    parsed: p,
    results,
    meta: {
      ...coreRes.meta || {},
      result_count: results.length,
      source_count: new Set(results.map((x)=>x.source_domain)).size,
      quality_filtered: true,
      budget_match_count: within,
      above_budget_count: above,
      response_ms: Math.round(performance.now() - start),
      notice_fr: within || !p.max_price_fcfa ? 'Prix trouvés sur des pages publiques. Vérifiez le stock, l’état et le prix final chez le vendeur.' : 'Aucune offre vérifiée ne respecte exactement ce budget. Voici les options publiques les plus proches, clairement signalées au-dessus du budget.',
      notice_wo: within || !p.max_price_fcfa ? 'Njëg yi ci pages publiques lañu leen gise. Dëggalal stock, état ak njëg bu mujj.' : 'Amul offre bu dëggu ci budget bi. Lii mooy offre yi gën a jege, te ñu màndargaal yi ëpp budget bi.'
    }
  });
}
async function stats(req) {
  const r = await coreRequest('/stats', req), d = await r.json().catch(()=>({
      popular: []
    })), seen = new Set(), popular = [];
  for (const x of d.popular || []){
    const label = clean(x.label), key = plain(label);
    if (label.length < 2 || seen.has(key) || /verifi|tarif|acheter/.test(key)) continue;
    seen.add(key);
    popular.push({
      ...x,
      label
    });
    if (popular.length >= 8) break;
  }
  const defaults = [
    'Téléphone Samsung',
    'Moto Jakarta',
    'Voiture occasion',
    'Frigo',
    'PC portable',
    'Maillot Sénégal',
    'Canapé salon',
    'Climatiseur'
  ];
  for (const label of defaults){
    const key = plain(label);
    if (!seen.has(key) && popular.length < 10) {
      seen.add(key);
      popular.push({
        label,
        count: 0,
        success: 0,
        default: true
      });
    }
  }
  return json(req, {
    ok: true,
    version: VERSION,
    period_days: 30,
    popular,
    categories: [
      {
        label: 'Téléphones',
        query: 'téléphone smartphone'
      },
      {
        label: 'Voitures',
        query: 'voiture occasion'
      },
      {
        label: 'Motos',
        query: 'moto scooter Jakarta'
      },
      {
        label: 'Électroménager',
        query: 'frigo électroménager'
      },
      {
        label: 'Informatique',
        query: 'ordinateur portable'
      },
      {
        label: 'Mode',
        query: 'vêtement maillot chaussures'
      },
      {
        label: 'Maison',
        query: 'canapé salon meuble'
      },
      {
        label: 'Matériel pro',
        query: 'matériel professionnel'
      }
    ]
  });
}
Deno.serve(async (req)=>{
  const u = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors(req)
  });
  try {
    if (req.method === 'GET' && u.pathname.endsWith('/stats')) return stats(req);
    if (req.method === 'GET') return json(req, {
      ok: true,
      service: 'SeneCompare Search',
      'version': VERSION,
      core: '2.2.0',
      quality_gate: true,
      timestamp: new Date().toISOString()
    });
    if (req.method === 'POST' && u.pathname.endsWith('/search')) return search(req);
    if (req.method === 'POST' && (u.pathname.endsWith('/click') || u.pathname.endsWith('/feedback'))) {
      const path = u.pathname.endsWith('/click') ? '/click' : '/feedback', body = await req.text(), r = await coreRequest(path, req, body);
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
