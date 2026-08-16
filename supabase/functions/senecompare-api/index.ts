import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '2.2.0';
const PROD = 'https://senecompare.dakarstyle.com';
const UA = `SeneCompareBot/${VERSION} (+${PROD}/a-propos)`;
const allowedOrigins = new Set([
  PROD,
  'https://senecompare-ai.vercel.app',
  'http://localhost:8787',
  'http://localhost:5173'
]);
const supabaseUrl = Deno.env.get('SUPABASE_URL');
function serviceKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      return parsed.default || Object.values(parsed)[0];
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}
const db = createClient(supabaseUrl, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function cors(req) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : PROD,
    'Access-Control-Allow-Headers': 'content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function out(req, body, status = 200) {
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
const clean = (v)=>v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const plain = (v)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const decodeHtml = (v)=>v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n)=>String.fromCharCode(Number(n)));
const stripTags = (v)=>clean(decodeHtml(v).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
async function hash(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [
    ...new Uint8Array(d)
  ].map((x)=>x.toString(16).padStart(2, '0')).join('');
}
async function rate(req, action, limit) {
  const key = await hash(`${req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'}|${(req.headers.get('user-agent') || '').slice(0, 120)}`);
  const { data, error } = await db.rpc('sc_take_rate_limit', {
    p_key_hash: key,
    p_action: action,
    p_limit: limit,
    p_window_seconds: 60
  });
  return error ? true : data === true;
}
function category(v) {
  const x = plain(v);
  if (/iphone|samsung|telephone|smartphone|xiaomi|tecno|infinix|oppo|pixel|portable/.test(x)) return 'telephone';
  if (/ordinateur|laptop|macbook|pc\b|imprimante|tablette|ipad|ecran|clavier/.test(x)) return 'informatique';
  if (/frigo|refrigerateur|climatiseur|machine a laver|cuisiniere|television|tv\b|congelateur|micro.?onde/.test(x)) return 'electromenager';
  if (/voiture|auto\b|vehicule|4x4|suv|berline|camion|bus|minibus/.test(x)) return 'voiture';
  if (/moto|scooter|jakarta|vespa|tricycle|quad/.test(x)) return 'moto';
  if (/chaussure|sneaker|basket|maillot|t-?shirt|robe|sac|vetement|tissu|wax|boubou|mode/.test(x)) return 'mode';
  if (/maquillage|parfum|perruque|meche|beaute|cosmetique/.test(x)) return 'beaute';
  if (/canape|lit\b|matelas|table\b|chaise|armoire|meuble|maison/.test(x)) return 'maison';
  if (/outil|perceuse|machine|materiel|groupe electrogene|pompe|solaire/.test(x)) return 'materiel';
  return 'autre';
}
const STOP = new Set([
  'je',
  'veux',
  'voudrais',
  'acheter',
  'achete',
  'cherche',
  'recherche',
  'trouve',
  'trouver',
  'verifie',
  'verifiez',
  'moi',
  'les',
  'le',
  'la',
  'un',
  'une',
  'des',
  'du',
  'de',
  'pour',
  'avec',
  'sans',
  'prix',
  'tarif',
  'tarifs',
  'senegal',
  'senegalais',
  'dakar',
  'dans',
  'sur',
  'internet',
  'aujourd',
  'hui',
  'svp',
  'bokk',
  'maangi',
  'dama',
  'soxla',
  'seet',
  'seetal',
  'begg',
  'jend'
]);
function tokens(v) {
  return plain(v).replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((x)=>x.length > 1 && !STOP.has(x));
}
function overlap(query, text) {
  const q = [
    ...new Set(tokens(query))
  ];
  if (!q.length) return .5;
  const t = new Set(tokens(text));
  return q.filter((x)=>t.has(x)).length / q.length;
}
function parse(raw) {
  const original = clean(raw).slice(0, 300), x = plain(original);
  let maxPrice = null;
  const currency = [
    ...original.matchAll(/(\d{1,3}(?:[\s.,]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/gi)
  ].map((m)=>Number(m[1].replace(/\D/g, ''))).find((n)=>n >= 1000 && n <= 100000000);
  if (currency) maxPrice = currency;
  if (!maxPrice) {
    const contextual = original.match(/(?:budget(?:\s+de)?|moins\s+de|max(?:imum)?|jusqu['’]?\s*a|jusqu['’]?\s*à|a|à)\s*[:=]?\s*(\d{4,9})\b/i), n = contextual ? Number(contextual[1]) : 0;
    if (n >= 5000 && n <= 100000000) maxPrice = n;
  }
  const condition = /\b(neuf|neuve|scelle|scellee|nouveau|nouvelle)\b/.test(x) ? 'neuf' : /\b(venant|occasion|d'occasion|reconditionne|utilise)\b/.test(x) ? 'occasion' : null;
  const lm = original.match(/(?:\b(?:a|à|vers|sur|pres de|près de|dans)\s+)(Dakar|Sandaga|Colobane|Mermoz|VDN|Parcelles(?: Assainies)?|Pikine|Guediawaye|Guédiawaye|Rufisque|Thies|Thiès|Saint-Louis|Kaolack|Ziguinchor|Touba|Mbour|Saly|Keur Massar)\b/i);
  let product = original.replace(/(?:moins\s+de|max(?:imum)?|budget(?:\s+de)?|jusqu['’]?\s*[aà])?\s*[:=]?\s*(\d{1,3}(?:[\s.,]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)?/gi, (m)=>/\b20\d{2}\b/.test(m.trim()) ? m : ' ').replace(/\b(?:je\s+veux(?:\s+acheter)?|je\s+voudrais(?:\s+acheter)?|j'aimerais(?:\s+acheter)?|acheter|achete|je\s+cherche|recherche|trouve[- ]?moi|trouvez[- ]?moi|compare|comparer|verifie[- ]?moi|verifiez[- ]?moi|regarde[- ]?moi|montre[- ]?moi|maangi\s+seet|dama\s+soxla|seetal\s+ma|dama\s+begg\s+jend)\b/gi, ' ').replace(/\b(?:les?\s+)?(?:prix|tarifs?|offres?)\b/gi, ' ').replace(/\b(?:sur\s+internet|au\s+senegal|dans\s+le\s+senegal|aujourd['’]?hui|svp|s'il\s+vous\s+plait)\b/gi, ' ');
  if (lm) product = product.replace(lm[0], ' ');
  product = clean(product).replace(/^(?:un|une|des|du|de la|le|la|les)\s+/i, '') || original;
  return {
    original,
    product,
    normalized: plain(product),
    category: category(product),
    condition,
    location: lm?.[1] || null,
    max_price_fcfa: maxPrice
  };
}
function safeUrl(v) {
  try {
    const u = new URL(v);
    if (![
      'http:',
      'https:'
    ].includes(u.protocol)) return null;
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
    if ([
      'facebook.com',
      'instagram.com',
      'tiktok.com',
      'youtube.com',
      'youtu.be',
      'pinterest.com',
      'x.com',
      'twitter.com',
      'wa.me',
      'whatsapp.com'
    ].some((b)=>h === b || h.endsWith('.' + b))) return null;
    return u;
  } catch  {
    return null;
  }
}
function extractPrice(v) {
  for (const m of v.matchAll(/(\d{1,3}(?:[\s.,\u202f]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/gi)){
    const n = Number(m[1].replace(/\D/g, ''));
    if (n >= 1000 && n <= 100000000) return n;
  }
  return null;
}
async function fetchText(url, timeout = 7500) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-SN,fr;q=.9,en;q=.5',
      'User-Agent': UA
    },
    signal: AbortSignal.timeout(timeout)
  });
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return {
    text: await r.text(),
    url: r.url,
    contentType: r.headers.get('content-type') || ''
  };
}
function robotsAllows(txt, path) {
  let active = false, specific = false;
  const allow = [], deny = [];
  for (const raw of txt.split(/\r?\n/)){
    const line = raw.replace(/#.*$/, '').trim(), i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === 'user-agent') {
      const s = v.toLowerCase().includes('senecomparebot');
      if (s) specific = true;
      active = s || !specific && v === '*';
      continue;
    }
    if (active && v) {
      if (k === 'allow') allow.push(v);
      if (k === 'disallow') deny.push(v);
    }
  }
  const a = Math.max(0, ...allow.filter((x)=>path.startsWith(x)).map((x)=>x.length)), d = Math.max(0, ...deny.filter((x)=>path.startsWith(x)).map((x)=>x.length));
  return d === 0 || a >= d;
}
async function canFetch(u) {
  try {
    const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, {
      headers: {
        'User-Agent': UA
      },
      signal: AbortSignal.timeout(3500)
    });
    if (r.status === 404) return true;
    if (!r.ok) return false;
    return robotsAllows((await r.text()).slice(0, 250000), u.pathname + u.search);
  } catch  {
    return false;
  }
}
function offerFromJsonLd(html, hitTitle, u) {
  const objs = [];
  const walk = (v)=>{
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      objs.push(v);
      if (v['@graph']) walk(v['@graph']);
      if (v.itemListElement) walk(v.itemListElement);
      if (v.item) walk(v.item);
    }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try {
      walk(JSON.parse(decodeHtml(m[1].trim().replace(/^<!--|-->$/g, ''))));
    } catch  {}
  }
  const found = [];
  for (const p of objs){
    const t = (Array.isArray(p['@type']) ? p['@type'] : [
      p['@type']
    ]).map((x)=>String(x).toLowerCase());
    if (!t.includes('product')) continue;
    for (const o of (Array.isArray(p.offers) ? p.offers : [
      p.offers
    ]).filter(Boolean)){
      const cur = String(o.priceCurrency || 'XOF').toUpperCase().replace(/FCFA|CFA/, 'XOF');
      if (cur !== 'XOF') continue;
      const n = Number(String(o.price ?? o.lowPrice ?? '').replace(/[^0-9.]/g, ''));
      if (!(n >= 1000 && n <= 100000000)) continue;
      const seller = typeof o.seller === 'object' ? o.seller?.name : null, img = Array.isArray(p.image) ? p.image[0] : typeof p.image === 'object' ? p.image?.url : p.image, link = safeUrl(String(o.url || p.url || u.toString())) || u;
      found.push({
        source_url: link.toString(),
        source_domain: link.hostname.replace(/^www\./, ''),
        source_name: seller || link.hostname.replace(/^www\./, ''),
        title: clean(String(p.name || hitTitle)),
        seller_name: seller || null,
        price_fcfa: Math.round(n),
        shipping_fcfa: null,
        condition: String(o.itemCondition || '').split('/').pop() || null,
        location: null,
        availability: String(o.availability || '').split('/').pop() || null,
        image_url: typeof img === 'string' ? img : null,
        confidence: .94,
        extraction_method: 'jsonld',
        raw_payload: {
          product: p,
          offer: o
        }
      });
    }
  }
  return found;
}
function parseJumia(html, query) {
  const base = 'https://www.jumia.sn', offers = [];
  for (const m of html.matchAll(/<article\b[^>]*class=["'][^"']*\bprd\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)){
    const block = m[1], href = decodeHtml(block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bcore\b/i)?.[1] || block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || ''), title = stripTags(block.match(/<h3\b[^>]*class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] || ''), priceText = stripTags(block.match(/<(?:div|span)\b[^>]*class=["'][^"']*\bprc\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i)?.[1] || ''), n = extractPrice(priceText);
    if (!href || !title || !n) continue;
    const score = overlap(query, title);
    if (score < .15 && tokens(query).length > 1) continue;
    const link = safeUrl(href.startsWith('http') ? href : base + href);
    if (!link) continue;
    const image = decodeHtml(block.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1] || '');
    offers.push({
      source_url: link.toString(),
      source_domain: 'jumia.sn',
      source_name: 'Jumia Sénégal',
      title,
      seller_name: null,
      price_fcfa: n,
      shipping_fcfa: null,
      condition: 'Neuf',
      location: 'Sénégal',
      availability: 'À vérifier',
      image_url: image.startsWith('http') ? image : null,
      confidence: .90,
      extraction_method: 'jumia_catalog',
      raw_payload: {
        price_text: priceText
      },
      relevance: score
    });
  }
  return offers;
}
function parseWoo(html, query, siteUrl, siteName) {
  const offers = [], domain = new URL(siteUrl).hostname.replace(/^www\./, ''), re = /<(?:li|article)\b[^>]*class=["'][^"']*(?:product|type-product)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|article)>/gi;
  for (const m of html.matchAll(re)){
    const block = m[1], href = decodeHtml(block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || ''), title = stripTags(block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || block.match(/class=["'][^"']*(?:woocommerce-loop-product__title|product-title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || ''), priceText = stripTags(block.match(/class=["'][^"']*(?:price|amount)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i)?.[1] || ''), n = extractPrice(priceText || stripTags(block)), link = safeUrl(href);
    if (!link || !title || !n) continue;
    const score = overlap(query, title);
    if (score < .15 && tokens(query).length > 1) continue;
    const img = decodeHtml(block.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1] || '');
    offers.push({
      source_url: link.toString(),
      source_domain: domain,
      source_name: siteName,
      title,
      seller_name: siteName,
      price_fcfa: n,
      shipping_fcfa: null,
      condition: 'Neuf',
      location: 'Sénégal',
      availability: 'À vérifier',
      image_url: img.startsWith('http') ? img : null,
      confidence: .91,
      extraction_method: 'woocommerce_catalog',
      raw_payload: {
        price_text: priceText
      },
      relevance: score
    });
  }
  return offers;
}
function parseExpat(html, query, pageUrl) {
  const base = 'https://www.expat-dakar.com', offers = [], seen = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']*\/annonce\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const href = decodeHtml(m[1]), text = stripTags(m[2]);
    if (!text || text.length < 8) continue;
    const n = extractPrice(text);
    if (!n || n < 5000) continue;
    const link = safeUrl(href.startsWith('http') ? href : base + href);
    if (!link || seen.has(link.toString())) continue;
    seen.add(link.toString());
    const cm = text.match(/\b(Neuf|Venant|D['’]occasion|Réconditionné)\b/i);
    let title = clean(cm ? text.slice(0, cm.index) : text.replace(/\d[\d\s\u202f.,]*\s*F\s*Cfa[\s\S]*$/i, ' '));
    if (title.length < 3) title = query;
    const score = overlap(query, title + ' ' + text);
    if (score < .12 && tokens(query).length > 1) continue;
    const loc = text.match(/\b([A-Za-zÀ-ÿ' -]{2,30}),\s*(Dakar|Thiès|Thies|Saint-Louis|Mbour|Saly|Kaolack|Ziguinchor)\b/i);
    offers.push({
      source_url: link.toString(),
      source_domain: 'expat-dakar.com',
      source_name: 'Expat-Dakar',
      title,
      seller_name: null,
      price_fcfa: n,
      shipping_fcfa: null,
      condition: cm?.[1] || null,
      location: loc ? `${clean(loc[1])}, ${loc[2]}` : null,
      availability: 'Annonce publique',
      image_url: null,
      confidence: .84,
      extraction_method: 'expat_listing',
      raw_payload: {
        listing_text: text,
        category_page: pageUrl
      },
      relevance: score
    });
  }
  return offers;
}
function expatPages(p) {
  const x = plain(p.product);
  if (p.category === 'moto') return [
    'https://www.expat-dakar.com/motos-scooters'
  ];
  if (p.category === 'voiture') return [
    'https://www.expat-dakar.com/voitures'
  ];
  if (p.category === 'telephone' || p.category === 'informatique') return [
    'https://www.expat-dakar.com/multimedia'
  ];
  if (p.category === 'mode' || p.category === 'beaute') return [
    'https://www.expat-dakar.com/mode-beaute'
  ];
  if (p.category === 'maison' || p.category === 'electromenager') return [
    'https://www.expat-dakar.com/maison'
  ];
  if (/sport|velo|fitness|football|basket/.test(x)) return [
    'https://www.expat-dakar.com/sport-loisirs-voyages'
  ];
  if (p.category === 'materiel') return [
    'https://www.expat-dakar.com/materiaux-outils-equipements'
  ];
  return [
    'https://www.expat-dakar.com/annonces'
  ];
}
async function directMarketplaces(p) {
  const jobs = [], jumiaUrl = `https://www.jumia.sn/catalog/?q=${encodeURIComponent(p.product)}`;
  jobs.push((async ()=>{
    const u = new URL(jumiaUrl);
    if (!await canFetch(u)) return [];
    const r = await fetchText(jumiaUrl, 8000);
    return [
      ...offerFromJsonLd(r.text, p.product, new URL(r.url)),
      ...parseJumia(r.text, p.product)
    ];
  })().catch(()=>[]));
  for (const url of expatPages(p))jobs.push((async ()=>{
    const u = new URL(url);
    if (!await canFetch(u)) return [];
    const r = await fetchText(url, 8000);
    return parseExpat(r.text, p.product, url);
  })().catch(()=>[]));
  for (const site of [
    {
      url: `https://dakarstyle.com/?s=${encodeURIComponent(p.product)}&post_type=product`,
      name: 'DakarStyle'
    },
    {
      url: `https://sowhatafrica.com/?s=${encodeURIComponent(p.product)}&post_type=product`,
      name: 'Sowhat Africa'
    }
  ])jobs.push((async ()=>{
    const u = new URL(site.url);
    if (!await canFetch(u)) return [];
    const r = await fetchText(site.url, 8000);
    return [
      ...offerFromJsonLd(r.text, p.product, new URL(r.url)),
      ...parseWoo(r.text, p.product, site.url, site.name)
    ];
  })().catch(()=>[]));
  return (await Promise.all(jobs)).flat();
}
function ddgTarget(href) {
  const decoded = decodeHtml(href);
  try {
    const u = new URL(decoded.startsWith('//') ? 'https:' + decoded : decoded, 'https://html.duckduckgo.com');
    if (u.hostname.includes('duckduckgo.com') && u.searchParams.get('uddg')) return decodeURIComponent(u.searchParams.get('uddg'));
    return u.toString();
  } catch  {
    return decoded;
  }
}
async function searchDuck(q) {
  try {
    const r = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 7000), hits = [];
    for (const m of r.text.matchAll(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      const url = ddgTarget(m[1]), title = stripTags(m[2]);
      if (!title || !safeUrl(url)) continue;
      const tail = r.text.slice(m.index || 0, (m.index || 0) + 2500), snippet = stripTags(tail.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || '');
      hits.push({
        title,
        url,
        snippet
      });
      if (hits.length >= 8) break;
    }
    return hits;
  } catch  {
    return [];
  }
}
async function searchBing(q) {
  try {
    const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&setlang=fr`, {
      headers: {
        Accept: 'application/rss+xml',
        'User-Agent': UA
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!r.ok) return [];
    const xml = await r.text(), hits = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
      const i = m[1], title = stripTags(i.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), url = decodeHtml(i.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim(), snippet = stripTags(i.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
      if (title && safeUrl(url)) hits.push({
        title,
        url,
        snippet
      });
      if (hits.length >= 8) break;
    }
    return hits;
  } catch  {
    return [];
  }
}
async function searchSearx(q) {
  const searx = Deno.env.get('SENECOMPARE_SEARXNG_URL')?.replace(/\/$/, '');
  if (!searx) return [];
  try {
    const r = await fetch(`${searx}/search?q=${encodeURIComponent(q)}&format=json&language=fr-FR&safesearch=1`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': UA
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).map((x)=>({
        title: clean(String(x.title || '')),
        url: String(x.url || ''),
        snippet: stripTags(String(x.content || ''))
      })).filter((x)=>x.title && safeUrl(x.url)).slice(0, 8);
  } catch  {
    return [];
  }
}
async function inspectHit(hit) {
  const u = safeUrl(hit.url);
  if (!u) return [];
  if (await canFetch(u)) {
    try {
      const r = await fetchText(u.toString(), 6500);
      if (r.contentType.includes('text/html')) {
        const html = r.text.slice(0, 1800000), found = offerFromJsonLd(html, hit.title, new URL(r.url));
        if (found.length) return found;
        const n = extractPrice(stripTags(html.slice(0, 350000)));
        if (n) return [
          {
            source_url: r.url,
            source_domain: new URL(r.url).hostname.replace(/^www\./, ''),
            source_name: new URL(r.url).hostname.replace(/^www\./, ''),
            title: hit.title,
            seller_name: null,
            price_fcfa: n,
            shipping_fcfa: null,
            condition: null,
            location: null,
            availability: 'À vérifier',
            image_url: null,
            confidence: .62,
            extraction_method: 'page_text',
            raw_payload: {
              snippet: hit.snippet
            }
          }
        ];
      }
    } catch  {}
  }
  const n = extractPrice(`${hit.title} ${hit.snippet}`);
  return n ? [
    {
      source_url: u.toString(),
      source_domain: u.hostname.replace(/^www\./, ''),
      source_name: u.hostname.replace(/^www\./, ''),
      title: hit.title,
      seller_name: null,
      price_fcfa: n,
      shipping_fcfa: null,
      condition: null,
      location: null,
      availability: 'À vérifier',
      image_url: null,
      confidence: .52,
      extraction_method: 'search_snippet',
      raw_payload: {
        snippet: hit.snippet
      }
    }
  ] : [];
}
async function webDiscovery(p) {
  const qs = [
    `${p.product} prix Sénégal FCFA`,
    `${p.product} Dakar prix`,
    `site:jumia.sn OR site:expat-dakar.com OR site:sn.coinafrique.com ${p.product} prix`
  ], searches = await Promise.all(qs.flatMap((q)=>[
      searchSearx(q),
      searchDuck(q),
      searchBing(q)
    ])), hitMap = new Map();
  for (const hit of searches.flat()){
    const u = safeUrl(hit.url);
    if (u && !hitMap.has(u.toString())) hitMap.set(u.toString(), hit);
    if (hitMap.size >= 14) break;
  }
  return (await Promise.all([
    ...hitMap.values()
  ].slice(0, 10).map((h)=>inspectHit(h).catch(()=>[])))).flat();
}
function rankOffers(p, offers) {
  const map = new Map();
  for (const o of offers){
    if (!o.price_fcfa || o.price_fcfa < 1000) continue;
    if (p.max_price_fcfa && o.price_fcfa > p.max_price_fcfa * 1.20) continue;
    const rel = o.relevance ?? overlap(p.product, `${o.title} ${o.source_name}`);
    if (rel < .08 && tokens(p.product).length > 1) continue;
    o.relevance = rel;
    const key = `${plain(o.title).slice(0, 80)}|${o.price_fcfa}|${o.source_domain}`, old = map.get(key);
    if (!old || o.confidence + rel > old.confidence + (old.relevance || 0)) map.set(key, o);
  }
  return [
    ...map.values()
  ].sort((a, b)=>(b.relevance || 0) - (a.relevance || 0) || b.confidence - a.confidence || a.price_fcfa - b.price_fcfa).slice(0, 8);
}
async function discover(p) {
  const start = performance.now(), [direct, web] = await Promise.all([
    directMarketplaces(p),
    webDiscovery(p)
  ]), offers = rankOffers(p, [
    ...direct,
    ...web
  ]);
  return {
    offers,
    diagnostics: {
      direct_count: direct.length,
      web_count: web.length,
      live_ms: Math.round(performance.now() - start)
    }
  };
}
async function persist(p, offers) {
  if (!offers.length) return;
  const fingerprint = 'sc2_' + (await hash(`${p.normalized}|${p.category}|${p.condition || ''}`)).slice(0, 32), { data: prod, error } = await db.from('sc_products').upsert({
    fingerprint,
    canonical_name: p.product,
    category: p.category,
    attributes: {
      condition: p.condition,
      location: p.location
    },
    search_text: clean(`${p.product} ${offers.map((o)=>o.title).join(' ')}`).slice(0, 6000)
  }, {
    onConflict: 'fingerprint'
  }).select('id').single();
  if (error || !prod) return;
  for (const o of offers){
    const { data: src } = await db.from('sc_sources').upsert({
      domain: o.source_domain,
      name: o.source_name,
      base_url: `https://${o.source_domain}`,
      status: 'active',
      reliability_score: o.confidence,
      robots_status: 'allowed',
      robots_checked_at: new Date().toISOString(),
      last_success_at: new Date().toISOString()
    }, {
      onConflict: 'domain'
    }).select('id').single();
    if (!src) continue;
    await db.from('sc_offers').upsert({
      ...o,
      product_id: prod.id,
      source_id: src.id,
      original_price: o.price_fcfa,
      original_currency: 'XOF',
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString()
    }, {
      onConflict: 'source_url'
    });
  }
}
async function cached(p) {
  const { data, error } = await db.rpc('sc_find_offers', {
    p_query: p.product,
    p_limit: 10
  });
  if (error) return [];
  let rows = data || [];
  if (p.max_price_fcfa) rows = rows.filter((o)=>Number(o.total_fcfa || o.price_fcfa) <= p.max_price_fcfa * 1.05);
  return rows.slice(0, 8);
}
const pubCached = (o)=>({
    id: o.offer_id,
    product_name: o.product_name,
    category: o.category,
    title: o.title,
    seller_name: o.seller_name || o.source_name,
    price_fcfa: Number(o.price_fcfa),
    shipping_fcfa: o.shipping_fcfa == null ? null : Number(o.shipping_fcfa),
    total_fcfa: Number(o.total_fcfa || o.price_fcfa),
    condition: o.condition,
    location: o.location,
    availability: o.availability,
    image_url: o.image_url,
    source_name: o.source_name,
    source_domain: o.source_domain,
    source_url: o.source_url,
    confidence: Math.round(Number(o.confidence || .5) * 100),
    verified_at: o.fetched_at,
    live: false,
    relevance: Number(o.relevance || 0)
  });
const pubLive = (o)=>({
    id: null,
    product_name: o.title,
    category: null,
    title: o.title,
    seller_name: o.seller_name || o.source_name,
    price_fcfa: o.price_fcfa,
    shipping_fcfa: o.shipping_fcfa,
    total_fcfa: o.price_fcfa + (o.shipping_fcfa || 0),
    condition: o.condition,
    location: o.location,
    availability: o.availability,
    image_url: o.image_url,
    source_name: o.source_name,
    source_domain: o.source_domain,
    source_url: o.source_url,
    confidence: Math.round(o.confidence * 100),
    verified_at: new Date().toISOString(),
    live: true,
    relevance: o.relevance || 0
  });
function mergePublic(cachedRows, live) {
  const m = new Map();
  for (const x of [
    ...live.map(pubLive),
    ...cachedRows.map(pubCached)
  ]){
    const key = `${plain(x.title).slice(0, 80)}|${x.total_fcfa}|${x.source_domain}`, old = m.get(key);
    if (!old || (x.live ? 1 : 0) + x.confidence / 100 > (old.live ? 1 : 0) + old.confidence / 100) m.set(key, x);
  }
  return [
    ...m.values()
  ].sort((a, b)=>b.relevance - a.relevance || b.live - a.live || b.confidence - a.confidence || a.total_fcfa - b.total_fcfa).slice(0, 8);
}
async function getStats(req) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString(), { data } = await db.from('sc_searches').select('parsed_query,result_count,created_at').gte('created_at', since).order('created_at', {
    ascending: false
  }).limit(1200), map = new Map();
  for (const row of data || []){
    const label = clean(String(row.parsed_query?.product || '')), key = plain(label);
    if (label.length < 2 || key.length < 2) continue;
    const v = map.get(key) || {
      label,
      count: 0,
      success: 0
    };
    v.count++;
    if (Number(row.result_count) > 0) v.success++;
    map.set(key, v);
  }
  const popular = [
    ...map.values()
  ].sort((a, b)=>b.count - a.count || b.success - a.success).slice(0, 10);
  return out(req, {
    ok: true,
    version: VERSION,
    period_days: 30,
    popular
  });
}
async function doSearch(req) {
  if (!await rate(req, 'search', 16)) return out(req, {
    ok: false,
    code: 'RATE_LIMIT',
    message: 'Trop de recherches. Réessayez dans une minute.'
  }, 429);
  const start = performance.now(), body = await req.json().catch(()=>null), q = typeof body?.query === 'string' ? body.query : '', lang = [
    'bi',
    'fr',
    'wo'
  ].includes(body?.language) ? body.language : 'bi', session = typeof body?.session_id === 'string' ? body.session_id.slice(0, 120) : crypto.randomUUID(), p = parse(q);
  if (p.original.length < 2) return out(req, {
    ok: false,
    code: 'QUERY_REQUIRED',
    message: 'Écrivez ou dites le produit recherché.'
  }, 400);
  const cachedRows = await cached(p), freshEnough = cachedRows.length >= 5 && cachedRows.every((x)=>Date.now() - new Date(x.fetched_at).getTime() < 6 * 3600000);
  let live = [], diagnostics = {
    direct_count: 0,
    web_count: 0,
    live_ms: 0
  };
  if (!freshEnough) {
    const d = await discover(p);
    live = d.offers;
    diagnostics = d.diagnostics;
    await persist(p, live);
  }
  const results = mergePublic(cachedRows, live).filter((x)=>!p.max_price_fcfa || x.total_fcfa <= p.max_price_fcfa * 1.10).slice(0, 8), ms = Math.round(performance.now() - start), sources = new Set(results.map((x)=>x.source_domain)).size, { data: s } = await db.from('sc_searches').insert({
    session_id: session,
    query_text: p.original,
    language_mode: lang,
    parsed_query: {
      ...p,
      diagnostics
    },
    result_count: results.length,
    source_count: sources,
    discovery_used: !freshEnough,
    response_ms: ms
  }).select('id').single();
  return out(req, {
    ok: true,
    version: VERSION,
    search_id: s?.id || null,
    parsed: p,
    results,
    meta: {
      result_count: results.length,
      source_count: sources,
      discovery_used: !freshEnough,
      live_count: live.length,
      cached_count: cachedRows.length,
      providers: diagnostics,
      response_ms: ms,
      searched_at: new Date().toISOString(),
      notice_fr: 'Prix trouvés sur des pages publiques. Vérifiez le stock, l’état et le prix final sur le site vendeur.',
      notice_wo: 'Njëg yi ci pages publiques lañu leen gise. Dëggalal stock, état ak njëg bu mujj ci vendeur bi.'
    }
  });
}
async function event(req, type) {
  if (!await rate(req, type, 60)) return out(req, {
    ok: false
  }, 429);
  const b = await req.json().catch(()=>({})), session = typeof b.session_id === 'string' ? b.session_id.slice(0, 120) : 'anonymous';
  if (type === 'click') await db.from('sc_click_events').insert({
    search_id: b.search_id || null,
    offer_id: b.offer_id || null,
    session_id: session,
    action: [
      'open_offer',
      'listen_results',
      'new_search',
      'install_pwa'
    ].includes(b.action) ? b.action : 'open_offer'
  });
  else await db.from('sc_feedback').insert({
    search_id: b.search_id || null,
    session_id: session,
    helpful: typeof b.helpful === 'boolean' ? b.helpful : null,
    reason: typeof b.reason === 'string' ? b.reason.slice(0, 500) : null
  });
  return out(req, {
    ok: true
  });
}
Deno.serve(async (req)=>{
  const u = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors(req)
  });
  if (req.method === 'GET') {
    if (u.pathname.endsWith('/stats')) return getStats(req);
    return out(req, {
      ok: true,
      service: 'SeneCompare API',
      version: VERSION,
      search_provider: 'multi-source-public-discovery',
      timestamp: new Date().toISOString()
    });
  }
  if (req.method !== 'POST') return out(req, {
    ok: false,
    code: 'METHOD_NOT_ALLOWED'
  }, 405);
  try {
    if (u.pathname.endsWith('/search')) return await doSearch(req);
    if (u.pathname.endsWith('/click')) return await event(req, 'click');
    if (u.pathname.endsWith('/feedback')) return await event(req, 'feedback');
    return out(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
  } catch (e) {
    const id = crypto.randomUUID();
    console.error(JSON.stringify({
      event: 'error',
      id,
      message: String(e),
      stack: e instanceof Error ? e.stack : null
    }));
    return out(req, {
      ok: false,
      code: 'INTERNAL_ERROR',
      request_id: id,
      message: 'La recherche a rencontré un problème temporaire. Réessayez.'
    }, 500);
  }
});
