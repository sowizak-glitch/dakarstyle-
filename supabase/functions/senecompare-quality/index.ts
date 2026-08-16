const VERSION = '2.2.2';
const PROD = 'https://senecompare.dakarstyle.com';
const UPSTREAM = `${Deno.env.get('SUPABASE_URL')}/functions/v1/senecompare-search`;
const ORIGINS = new Set([
  PROD,
  'https://senecompare-ai.vercel.app',
  'http://localhost:5173'
]);
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
function category(v) {
  const x = plain(v);
  if (/ordinateur|laptop|macbook|\bpc\b|imprimante|tablette|ipad|elitebook|thinkpad|core\s*i[3579]|ssd|ram/.test(x)) return 'informatique';
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
  const original = clean(raw).slice(0, 300), x = plain(original);
  let budget = null;
  const money = x.match(/(\d{1,3}(?:[ .]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/i);
  if (money) budget = Number(money[1].replace(/\D/g, ''));
  if (!budget) {
    const m = x.match(/(?:budget(?: de)?|moins de|max(?:imum)?|jusqu a|\ba)\s*[:=]?\s*(\d{4,9})\b/);
    if (m) budget = Number(m[1]);
  }
  let product = x.replace(/\b(?:je veux(?: acheter)?|je voudrais(?: acheter)?|j aimerais(?: acheter)?|acheter|je cherche|recherche|trouve moi|trouvez moi|compare|comparer|verifie moi|verifiez moi|verifier|verifiez|regarde moi|montre moi|maangi seet|dama soxla|seetal ma|dama begg jend)\b/g, ' ').replace(/(?:moins de|max(?:imum)?|budget(?: de)?|jusqu a|\ba)?\s*[:=]?\s*(\d{1,3}(?:[ .]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)?/g, (m)=>/^\s*20\d{2}\s*$/.test(m) ? m : ' ').replace(/\b(?:les? )?(?:prix|tarifs?|offres?)\b/g, ' ').replace(/\b(?:sur internet|au senegal|dans le senegal|aujourd hui|svp|s il vous plait)\b/g, ' ').replace(/\s+/g, ' ').trim();
  product = product.replace(/^(?:un|une|des|du|de la|le|la|les)\s+/, '').replace(/\s+[aà]\s*$/, '').trim();
  return {
    original,
    product: product || x,
    normalized: product || x,
    category: category(product || x),
    max_price_fcfa: budget
  };
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
function normalize(p, rows) {
  const [min, max] = limits(p.category), map = new Map();
  for (const raw of rows || []){
    const title = decode(clean(raw.title || raw.product_name)), domain = clean(raw.source_domain), price = Number(raw.total_fcfa || raw.price_fcfa || 0);
    if (!title || !domain || !local(domain) || !matches(p.category, title, p.product) || !Number.isFinite(price) || price < min || price > max) continue;
    const budget = p.max_price_fcfa ? price <= p.max_price_fcfa ? 'within' : 'above' : 'none', url = clean(raw.source_url), key = url || `${plain(title).replace(/[^a-z0-9]/g, '').slice(0, 70)}|${price}|${plain(domain)}`, item = {
      ...raw,
      title,
      product_name: title,
      category: p.category,
      total_fcfa: price,
      price_fcfa: Number(raw.price_fcfa || price),
      budget_status: budget,
      over_budget_fcfa: budget === 'above' ? price - p.max_price_fcfa : 0
    };
    const old = map.get(key);
    if (!old || Number(item.confidence || 0) > Number(old.confidence || 0)) map.set(key, item);
  }
  const out = [
    ...map.values()
  ];
  out.sort((a, b)=>{
    const rank = (x)=>x.budget_status === 'within' ? 0 : x.budget_status === 'none' ? 1 : 2, ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 2 && a.over_budget_fcfa !== b.over_budget_fcfa) return a.over_budget_fcfa - b.over_budget_fcfa;
    return a.total_fcfa - b.total_fcfa;
  });
  return out.slice(0, 8);
}
async function forward(path, req, body) {
  return fetch(UPSTREAM + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-version': VERSION,
      'user-agent': req.headers.get('user-agent') || 'SeneCompareQuality/2.2.2'
    },
    body,
    signal: AbortSignal.timeout(45000)
  });
}
async function search(req) {
  const body = await req.text(), input = JSON.parse(body || '{}'), p = parse(input.query || ''), start = performance.now(), r = await forward('/search', req, body), d = await r.json().catch(()=>({
      results: [],
      meta: {}
    })), results = normalize(p, d.results || []), within = results.filter((x)=>x.budget_status === 'within').length, above = results.filter((x)=>x.budget_status === 'above').length;
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
      budget_match_count: within,
      above_budget_count: above,
      response_ms: Math.round(performance.now() - start),
      notice_fr: within || !p.max_price_fcfa ? 'Prix trouvés sur des pages publiques. Vérifiez le stock, l’état et le prix final chez le vendeur.' : 'Aucune offre vérifiée ne respecte exactement ce budget. Voici les options les plus proches, signalées au-dessus du budget.',
      notice_wo: within || !p.max_price_fcfa ? 'Njëg yi ci pages publiques lañu leen gise. Dëggalal stock, état ak njëg bu mujj.' : 'Amul offre ci budget bi. Lii mooy yi gën a jege, te ñu màndargaal yi ëpp budget bi.'
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
      const r = await forward('/stats', req);
      return new Response(await r.text(), {
        status: r.status,
        headers: {
          ...cors(req),
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-SeneCompare-Version': VERSION
        }
      });
    }
    if (req.method === 'GET') return json(req, {
      ok: true,
      service: 'SeneCompare Quality Search',
      version: VERSION,
      quality_gate: true,
      upstream: '2.2.1',
      timestamp: new Date().toISOString()
    });
    if (req.method === 'POST' && u.pathname.endsWith('/search')) return search(req);
    if (req.method === 'POST' && (u.pathname.endsWith('/click') || u.pathname.endsWith('/feedback'))) {
      const path = u.pathname.endsWith('/click') ? '/click' : '/feedback', body = await req.text(), r = await forward(path, req, body);
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
