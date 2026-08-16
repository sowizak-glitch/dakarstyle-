import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '5.0.0';
const BASE = Deno.env.get('SUPABASE_URL') || '';
const LEGACY = `${BASE}/functions/v1/senecompare-final`;
const USER_AGENT = `SeneCompareHybrid/${VERSION} (+https://senecompare.dakarstyle.com)`;
function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string') return value;
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const db = createClient(BASE, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
export const capabilities = [
  'products',
  'services',
  'food',
  'mobility',
  'delivery',
  'housing',
  'health',
  'education',
  'finance',
  'travel',
  'local_directories',
  'marketplace_handoff',
  'wolof_aliases',
  'voice_ready'
];
const clean = (value, max = 1000)=>String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const plain = (value)=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const CITY_PATTERN = /(Dakar|Plateau|Almadies|Mermoz|Ouakam|Yoff|Ngor|VDN|Liberté|Parcelles(?: Assainies)?|Pikine|Guédiawaye|Rufisque|Keur Massar|Diamniadio|Thiès|Thies|Saint-Louis|Mbour|Saly|Touba|Kaolack|Ziguinchor|Louga|Fatick|Kolda|Tambacounda|Sénégal|Senegal)/i;
const CATEGORY_RULES = [
  [
    'informatique',
    /ordinateur|ordinateurs|laptop|macbook|\bpc\b|elitebook|thinkpad|core\s*i[3579]|ssd|ram|imprimante|tablette|ipad|informatique|ordinateur portable/,
    'product'
  ],
  [
    'telephone',
    /iphone|telephone|telephones|smartphone|smartphones|portable|samsung|galaxy|xiaomi|tecno|infinix|oppo|pixel|itel|telefon/,
    'product'
  ],
  [
    'electromenager',
    /electromenager|jumtukaay\s*ker|frigo|refrigerateur|congelateur|climatiseur|machine a laver|cuisiniere|television|micro.?onde|ventilateur/,
    'product'
  ],
  [
    'voiture',
    /voiture|voitures|automobile|vehicule|woto|4x4|suv|berline|camion|pickup|minibus|toyota|renault|peugeot|hyundai|kia|nissan|mercedes|bmw/,
    'product'
  ],
  [
    'moto',
    /moto|motos|scooter|jakarta|vespa|tricycle|quad|bajaj|tvs/,
    'product'
  ],
  [
    'mode',
    /mode|vetement|vetements|yere|chaussure|sneaker|basket|maillot|t-?shirt|robe|sac|tissu|wax|bazin|bogolan|boubou|getzner|gesner|debardeur/,
    'product'
  ],
  [
    'beaute',
    /beaute|parfum|perruque|meche|cosmetique|maquillage/,
    'product'
  ],
  [
    'maison',
    /maison|\bker\b|canape|matelas|armoire|meuble|mobilier|chaise|table a manger|decoration|cuisine/,
    'product'
  ],
  [
    'materiel',
    /materiel|outil|outillage|perceuse|groupe electrogene|pompe|solaire|btp|agricole|commerce/,
    'product'
  ],
  [
    'coiffure',
    /coiff|salon de beaut|barber|barbier|tresse|natte|manucure|pedicure|onglerie|spa/,
    'service'
  ],
  [
    'livraison',
    /livraison|livrer|coursier|colis|expedition|messagerie|logistique|demenagement|yobbu|yobbante/,
    'service'
  ],
  [
    'restauration',
    /pizza|restaurant|repas|fast[ -]?food|burger|sandwich|grill|traiteur|menu|thieb|ceebu|yassa|cafe|patisserie|boulangerie|nourriture|manger|lekk/,
    'food'
  ],
  [
    'transport',
    /transport|taxi|vtc|bus|car rapide|clando|chauffeur|navette|trajet|transfert aeroport|dem dikk/,
    'mobility'
  ],
  [
    'voyage',
    /hotel|auberge|hebergement|voyage|billet d avion|\bvol\b|agence de voyage|sejour/,
    'service'
  ],
  [
    'immobilier',
    /appartement|studio|villa|terrain|immobilier|location maison|location bureau|chambre a louer|logement/,
    'service'
  ],
  [
    'artisanat',
    /plombier|electricien|mecanicien|menuisier|peintre|macon|reparation|nettoyage|lavage|artisan|couturier|tailleur|broderie|imprimerie/,
    'service'
  ],
  [
    'sante',
    /clinique|medecin|pharmacie|dentiste|laboratoire|sante|opticien|radiologie|consultation/,
    'service'
  ],
  [
    'finance',
    /assurance|mutuelle|credit|banque|pret|transfert d argent|change devise|microfinance/,
    'service'
  ],
  [
    'education',
    /ecole|formation|cours|certification|universite|institut|apprentissage|enseignant/,
    'service'
  ]
];
const CATEGORY_OVERRIDE = {
  phones: 'telephone',
  cars: 'voiture',
  motorcycles: 'moto',
  appliances: 'electromenager',
  computing: 'informatique',
  fashion: 'mode',
  home: 'maison',
  professional: 'materiel',
  all: 'general'
};
const STOP = new Set([
  'je',
  'veux',
  'voudrais',
  'cherche',
  'recherche',
  'trouve',
  'compare',
  'moi',
  'prix',
  'tarif',
  'tarifs',
  'offre',
  'offres',
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
  'aux',
  'dans',
  'sur',
  'pour',
  'avec',
  'sans',
  'senegal',
  'dakar',
  'prendre',
  'acheter',
  'reserver',
  'faire',
  'me',
  'mon',
  'ma',
  'mes',
  'ce',
  'cette',
  '2025',
  '2026',
  'f',
  'cfa',
  'fcfa',
  'xof'
]);
function tokens(value) {
  return [
    ...new Set(plain(value).replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((x)=>x.length > 1 && !STOP.has(x)))
  ];
}
function classify(value, requestedCategory = '') {
  const override = CATEGORY_OVERRIDE[requestedCategory] || requestedCategory;
  if (override && override !== 'general') {
    const rule = CATEGORY_RULES.find(([category])=>category === override);
    return [
      override,
      rule?.[2] || 'product'
    ];
  }
  const normalized = plain(value);
  for (const [category, pattern, intent] of CATEGORY_RULES)if (pattern.test(normalized)) return [
    category,
    intent
  ];
  return [
    'general',
    'general'
  ];
}
export function parseQuery(raw, requestedCategory = '') {
  const original = clean(raw, 320);
  const normalizedOriginal = plain(original);
  const [category, intent_type] = classify(normalizedOriginal, requestedCategory);
  const location = original.match(CITY_PATTERN)?.[1] || null;
  const condition = /reconditionn|refurb/.test(normalizedOriginal) ? 'refurbished' : /occasion|utilise|seconde main/.test(normalizedOriginal) ? 'used' : /\bneuf|neuve|scelle/.test(normalizedOriginal) ? 'new' : null;
  let max_price_fcfa = null;
  const money = original.match(/(?:moins\s+de|max(?:imum)?|budget(?:\s+de)?|jusqu['’]?\s*[aà]|[aà])\s*[:=]?\s*(\d{1,3}(?:[\s.,\u00a0\u202f]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?|f)?/i) || original.match(/(\d{1,3}(?:[\s.,\u00a0\u202f]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/i);
  if (money) {
    const amount = Number(money[1].replace(/\D/g, ''));
    if (amount >= 100 && amount <= 1_000_000_000) max_price_fcfa = amount;
  }
  let product = original.replace(/(?:moins\s+de|max(?:imum)?|budget(?:\s+de)?|jusqu['’]?\s*[aà])\s*[:=]?\s*(\d{1,3}(?:[\s.,\u00a0\u202f]\d{3})+|\d{4,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?|f)?/gi, ' ').replace(/\b(?:au|à|a|dans)\s+(?:Dakar|Plateau|Almadies|Mermoz|Ouakam|Yoff|Ngor|VDN|Liberté|Parcelles(?: Assainies)?|Pikine|Guédiawaye|Rufisque|Keur Massar|Diamniadio|Thiès|Thies|Saint-Louis|Mbour|Saly|Touba|Kaolack|Ziguinchor|Louga|Fatick|Kolda|Tambacounda|Sénégal|Senegal)\b/gi, ' ').replace(/^\s*(?:je veux me coiffer|je veux comparer|je veux acheter|je veux prendre|je veux reserver|je voudrais acheter|je voudrais prendre|j aimerais acheter|j ai besoin de|je souhaite|je recherche|je cherche|trouve moi|trouvez moi|montre moi|compare moi|je veux|je voudrais|j aimerais|dama soxla|damay seet|waxal ma)\s+/i, ' ').replace(/\b(?:verifiez? moi|verifier moi|sur internet|au senegal|dans le senegal|aujourd hui)\b/gi, ' ').replace(/\b(?:les? )?(?:prix|tarifs?|offres?)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  product = product.replace(/^(?:un|une|des|du|de la|de l|le|la|les)\s+/i, '').trim();
  const broadLabels = {
    telephone: 'téléphone smartphone',
    informatique: 'ordinateur informatique',
    electromenager: 'électroménager',
    voiture: 'voiture',
    moto: 'moto',
    mode: 'mode vêtements',
    beaute: 'beauté',
    maison: 'maison mobilier',
    materiel: 'matériel professionnel',
    coiffure: 'salon de coiffure',
    livraison: 'service de livraison colis',
    restauration: 'restaurant repas',
    transport: 'transport taxi VTC',
    immobilier: 'immobilier',
    artisanat: 'artisan dépannage',
    sante: 'santé pharmacie clinique',
    finance: 'finance assurance crédit',
    education: 'formation cours',
    voyage: 'voyage hôtel'
  };
  const categoryWords = new Set([
    'telephone',
    'telephones',
    'smartphone',
    'smartphones',
    'informatique',
    'ordinateur',
    'ordinateurs',
    'electromenager',
    'voiture',
    'voitures',
    'moto',
    'motos',
    'mode',
    'vetement',
    'vetements',
    'beaute',
    'maison',
    'materiel',
    'coiffure',
    'livraison',
    'restaurant',
    'restauration',
    'transport',
    'immobilier',
    'artisanat',
    'sante',
    'pharmacie',
    'finance',
    'education',
    'formation',
    'voyage'
  ]);
  const productTokens = tokens(product);
  const broad_category = productTokens.length <= 2 && productTokens.every((item)=>categoryWords.has(item));
  if (!product || broad_category) product = broadLabels[category] || product || original;
  if (category === 'coiffure' && !/tresse|natte|barber|manucure|pedicure|spa/i.test(product)) product = 'salon de coiffure';
  return {
    original,
    product: clean(product, 180),
    normalized: plain(product),
    category,
    intent_type,
    comparison: /compar|moins cher|meilleur|plus proche|plus rapide|tarif|mendale/.test(normalizedOriginal),
    location,
    max_price_fcfa,
    condition,
    broad_category,
    tokens: tokens(product)
  };
}
function relevance(query, text) {
  const queryWords = tokens(query);
  if (!queryWords.length) return 0.5;
  const normalized = plain(text);
  let matched = 0;
  const candidates = tokens(normalized);
  for (const word of queryWords){
    if (normalized.includes(word)) matched += 1;
    else if (word.length >= 5 && candidates.some((candidate)=>candidate.startsWith(word.slice(0, 4)) || word.startsWith(candidate.slice(0, 4)))) matched += 0.6;
  }
  return Math.min(1, matched / queryWords.length);
}
function safeUrl(value) {
  try {
    const url = new URL(String(value));
    if (![
      'http:',
      'https:'
    ].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    return url;
  } catch  {
    return null;
  }
}
function priceInfo(value) {
  const text = clean(value).replace(/[\u00a0\u202f]/g, ' ');
  const from = text.match(/(?:a partir de|à partir de|des|dès|minimum)\s*[:\-]?\s*(\d{1,3}(?:[ .]\d{3})+|\d{3,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/i);
  const exact = text.match(/(\d{1,3}(?:[ .]\d{3})+|\d{3,9})\s*(?:f\s*cfa|fcfa|cfa|xof|francs?)/i);
  const match = from || exact;
  if (match) {
    const amount = Number(match[1].replace(/\D/g, ''));
    if (amount >= 100 && amount <= 1_000_000_000) return {
      value: amount,
      status: from ? 'from' : 'exact',
      label: `${from ? 'À partir de ' : ''}${amount.toLocaleString('fr-FR')} F CFA`
    };
  }
  return {
    value: null,
    status: 'quote',
    label: 'Prix à vérifier sur la source'
  };
}
function budgetStatus(parsed, amount) {
  if (!amount) return {
    status: 'unknown',
    over: 0
  };
  if (!parsed.max_price_fcfa) return {
    status: 'none',
    over: 0
  };
  return amount <= parsed.max_price_fcfa ? {
    status: 'within',
    over: 0
  } : {
    status: 'above',
    over: amount - parsed.max_price_fcfa
  };
}
async function directory(parsed) {
  const { data, error } = await db.from('senecompare_source_directory').select('name,domain,base_url,categories,regions,category_urls,search_url_template,source_kind,trust_weight,supports_prices,supports_direct_search,priority,label_fr,label_wo,last_reviewed_at').eq('active', true).order('priority', {
    ascending: false
  }).limit(80);
  if (error) return [];
  return (data || []).filter((row)=>row.categories.includes(parsed.category) || row.categories.includes('general'));
}
function sourceUrl(row, parsed) {
  const encoded = encodeURIComponent(parsed.product);
  if (row.supports_direct_search && row.search_url_template) return row.search_url_template.replaceAll('{query}', encoded);
  return row.category_urls?.[parsed.category] || row.category_urls?.general || row.base_url;
}
function sourceCards(rows, parsed) {
  return rows.slice(0, 8).map((row, index)=>{
    const confidence = Math.round(Math.min(0.96, Number(row.trust_weight || 0.7)) * 100);
    return {
      id: `source:${row.domain}:${parsed.category}`,
      product_name: parsed.product,
      title: `Chercher « ${parsed.product} » sur ${row.name}`,
      seller_name: row.name,
      source_name: row.name,
      source_domain: row.domain,
      source_url: sourceUrl(row, parsed),
      category: parsed.category,
      intent_type: parsed.intent_type,
      price_fcfa: null,
      shipping_fcfa: null,
      total_fcfa: null,
      price_status: 'source',
      price_label: row.supports_prices ? 'Prix affichés sur la source' : 'Tarif ou devis sur la source',
      condition: parsed.condition,
      location: parsed.location || row.regions?.[0] || 'Sénégal',
      availability: 'Ouvrir la source pour voir les offres disponibles',
      image_url: null,
      confidence,
      verified_at: row.last_reviewed_at || new Date().toISOString(),
      live: true,
      relevance: Math.max(0.55, 0.9 - index * 0.04),
      budget_status: 'unknown',
      over_budget_fcfa: 0,
      continuity_cache: false,
      verification_mode: 'source_directory',
      match_level: 'source',
      snippet: row.label_fr || `Source locale pertinente pour ${parsed.product}.`,
      provider: 'senecompare_directory',
      source_kind: row.source_kind,
      result_type: 'source',
      action_label: row.supports_direct_search ? 'Voir les résultats' : 'Explorer la source'
    };
  });
}
function normalizeLegacy(raw, parsed) {
  const title = clean(raw.title || raw.product_name, 200);
  const amount = Number(raw.total_fcfa || raw.price_fcfa || 0);
  const url = safeUrl(raw.source_url);
  if (!title || !url || !Number.isFinite(amount) || amount <= 0) return null;
  const score = relevance(parsed.product, `${title} ${raw.seller_name || ''}`);
  if (score < 0.12 && !parsed.broad_category) return null;
  const budget = budgetStatus(parsed, amount);
  return {
    ...raw,
    id: clean(raw.id || raw.offer_id) || crypto.randomUUID(),
    title,
    product_name: clean(raw.product_name || title),
    category: parsed.category,
    intent_type: parsed.intent_type,
    price_fcfa: Number(raw.price_fcfa || amount),
    total_fcfa: amount,
    price_status: 'exact',
    price_label: `${amount.toLocaleString('fr-FR')} F CFA`,
    source_url: url.toString(),
    source_domain: url.hostname.replace(/^www\./, ''),
    source_name: clean(raw.source_name || raw.seller_name || url.hostname),
    seller_name: clean(raw.seller_name || raw.source_name || url.hostname),
    confidence: Math.round(Number(raw.confidence || 0.75) * (Number(raw.confidence || 0.75) <= 1 ? 100 : 1)),
    relevance: score,
    budget_status: budget.status,
    over_budget_fcfa: budget.over,
    continuity_cache: Boolean(raw.continuity_cache) || raw.live === false,
    verification_mode: raw.live === false ? 'recently_verified' : 'direct_marketplace',
    match_level: score >= 0.55 ? 'exact' : 'proche',
    source_kind: 'marketplace',
    result_type: 'offer'
  };
}
async function legacySearch(req, input, parsed) {
  if (![
    'telephone',
    'informatique',
    'electromenager',
    'voiture',
    'moto',
    'mode',
    'beaute',
    'maison',
    'materiel'
  ].includes(parsed.category)) return [];
  try {
    const response = await proxyLegacy('/search', req, JSON.stringify({
      ...input,
      query: parsed.original
    }));
    if (!response.ok) return [];
    const payload = await response.json();
    return (Array.isArray(payload.results) ? payload.results : []).map((row)=>normalizeLegacy(row, parsed)).filter(Boolean);
  } catch  {
    return [];
  }
}
function decodeHtml(value) {
  return String(value ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'");
}
function stripTags(value) {
  return clean(decodeHtml(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '), 1000);
}
async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/rss+xml',
      'Accept-Language': 'fr-SN,fr;q=.9',
      'User-Agent': USER_AGENT
    },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > 2_000_000) throw new Error('BODY_TOO_LARGE');
  return (await response.text()).slice(0, 2_000_000);
}
function jsonLdObjects(value, output = []) {
  if (Array.isArray(value)) for (const item of value)jsonLdObjects(item, output);
  else if (value && typeof value === 'object') {
    output.push(value);
    for (const child of Object.values(value))jsonLdObjects(child, output);
  }
  return output;
}
function parsedListing(titleValue, urlValue, priceValue, source, parsed, snippet = '') {
  const title = clean(titleValue, 200);
  let absolute = null;
  try {
    absolute = safeUrl(new URL(String(urlValue || sourceUrl(source, parsed)), source.base_url).toString());
  } catch  {
    absolute = null;
  }
  if (!title || !absolute) return null;
  const score = relevance(parsed.product, `${title} ${snippet}`);
  if (score < 0.12 && !parsed.broad_category) return null;
  const info = priceInfo(`${priceValue || ''} ${title} ${snippet}`);
  const budget = budgetStatus(parsed, info.value);
  return {
    id: `web:${crypto.randomUUID()}`,
    product_name: title,
    title,
    seller_name: source.name,
    source_name: source.name,
    source_domain: source.domain,
    source_url: absolute.toString(),
    category: parsed.category,
    intent_type: parsed.intent_type,
    price_fcfa: info.value,
    shipping_fcfa: null,
    total_fcfa: info.value,
    price_status: info.status,
    price_label: info.label,
    condition: parsed.condition,
    location: parsed.location || source.regions?.[0] || 'Sénégal',
    availability: 'À confirmer sur la source',
    image_url: null,
    confidence: info.value ? 82 : 70,
    verified_at: new Date().toISOString(),
    live: true,
    relevance: score,
    budget_status: budget.status,
    over_budget_fcfa: budget.over,
    continuity_cache: false,
    verification_mode: 'public_page',
    match_level: score >= 0.5 ? 'exact' : 'proche',
    snippet: clean(snippet, 500),
    provider: source.domain,
    source_kind: source.source_kind,
    result_type: 'offer'
  };
}
function parsePage(html, source, parsed) {
  const results = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try {
      const value = JSON.parse(decodeHtml(match[1]));
      for (const item of jsonLdObjects(value)){
        const type = String(item['@type'] || '').toLowerCase();
        if (![
          'product',
          'offer',
          'listitem'
        ].includes(type)) continue;
        const nested = item.item && typeof item.item === 'object' ? item.item : item;
        const offers = nested.offers && typeof nested.offers === 'object' ? nested.offers : item;
        const row = parsedListing(nested.name || item.name, nested.url || item.url, offers.price || offers.lowPrice, source, parsed, clean(nested.description || item.description));
        if (row) results.push(row);
      }
    } catch  {}
  }
  if (results.length < 4) {
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{1,500}?)<\/a>/gi)){
      const title = stripTags(match[2]);
      if (title.length < 5 || title.length > 180) continue;
      const start = Math.max(0, (match.index || 0) - 300);
      const context = stripTags(html.slice(start, (match.index || 0) + match[0].length + 300));
      if (!/(?:\d[\d .]{2,}\s*(?:cfa|fcfa|f\b|xof))|prix|annonce/i.test(context)) continue;
      const row = parsedListing(title, match[1], context, source, parsed, context);
      if (row) results.push(row);
      if (results.length >= 12) break;
    }
  }
  const unique = new Map();
  for (const item of results)if (!unique.has(item.source_url)) unique.set(item.source_url, item);
  return [
    ...unique.values()
  ].slice(0, 8);
}
async function crawlSources(rows, parsed) {
  const selected = rows.filter((row)=>row.supports_prices).slice(0, 4);
  const batches = await Promise.all(selected.map(async (row)=>{
    try {
      return parsePage(await fetchText(sourceUrl(row, parsed)), row, parsed);
    } catch  {
      return [];
    }
  }));
  return batches.flat();
}
function merge(concrete, sources) {
  const map = new Map();
  for (const item of [
    ...concrete,
    ...sources
  ]){
    if (!item.title || !safeUrl(item.source_url)) continue;
    const key = `${item.result_type}:${item.source_url.replace(/[#].*$/, '')}`;
    const previous = map.get(key);
    const score = Number(item.relevance || 0) + Number(item.confidence || 0) / 100 + (item.total_fcfa ? 0.35 : 0) + (item.result_type === 'offer' ? 0.5 : 0);
    const oldScore = previous ? Number(previous.relevance || 0) + Number(previous.confidence || 0) / 100 + (previous.total_fcfa ? 0.35 : 0) + (previous.result_type === 'offer' ? 0.5 : 0) : -1;
    if (!previous || score > oldScore) map.set(key, item);
  }
  const budgetRank = (item)=>item.budget_status === 'within' ? 0 : item.budget_status === 'none' ? 1 : item.budget_status === 'unknown' ? 2 : 3;
  const sorted = [
    ...map.values()
  ].sort((a, b)=>Number(b.result_type === 'offer') - Number(a.result_type === 'offer') || budgetRank(a) - budgetRank(b) || Number(Boolean(b.total_fcfa)) - Number(Boolean(a.total_fcfa)) || Number(b.relevance) - Number(a.relevance) || Number(b.confidence) - Number(a.confidence));
  const domainCounts = new Map();
  const output = [];
  for (const item of sorted){
    const limit = item.result_type === 'offer' ? 4 : 1;
    const count = domainCounts.get(`${item.result_type}:${item.source_domain}`) || 0;
    if (count >= limit) continue;
    domainCounts.set(`${item.result_type}:${item.source_domain}`, count + 1);
    output.push(item);
    if (output.length >= 14) break;
  }
  return output;
}
async function rateAllowed(req) {
  try {
    const identity = `${req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'}|${(req.headers.get('user-agent') || '').slice(0, 120)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const key = [
      ...new Uint8Array(digest)
    ].map((value)=>value.toString(16).padStart(2, '0')).join('');
    const { data, error } = await db.rpc('sc_take_rate_limit', {
      p_key_hash: key,
      p_action: 'hybrid_search_v5',
      p_limit: 40,
      p_window_seconds: 60
    });
    return error ? true : data === true;
  } catch  {
    return true;
  }
}
async function recordSearch(input, parsed, results, diagnostics, response_ms) {
  try {
    const { data } = await db.from('sc_searches').insert({
      session_id: typeof input.session_id === 'string' ? input.session_id.slice(0, 120) : crypto.randomUUID(),
      query_text: parsed.original,
      language_mode: [
        'bi',
        'fr',
        'wo'
      ].includes(String(input.language)) ? input.language : 'bi',
      parsed_query: {
        ...parsed,
        diagnostics
      },
      result_count: results.length,
      source_count: new Set(results.map((item)=>item.source_domain)).size,
      discovery_used: true,
      response_ms
    }).select('id').single();
    return data?.id || null;
  } catch  {
    return null;
  }
}
function suggestions(parsed) {
  const location = parsed.location || 'Dakar';
  const values = {
    telephone: [
      `Samsung moins de 150000 F à ${location}`,
      `iPhone 13 128 Go à ${location}`,
      'Téléphone Tecno neuf'
    ],
    informatique: [
      `Ordinateur portable Core i5 à ${location}`,
      'PC HP EliteBook occasion',
      'Imprimante bureau'
    ],
    electromenager: [
      `Frigo moins de 300000 F à ${location}`,
      'Climatiseur inverter',
      'Machine à laver neuve'
    ],
    voiture: [
      `Voiture occasion moins de 5000000 F à ${location}`,
      'Toyota automatique',
      'SUV occasion'
    ],
    moto: [
      `Moto Jakarta moins de 400000 F à ${location}`,
      'Scooter occasion',
      'Moto livraison'
    ],
    mode: [
      'Tissu wax Getzner',
      'Maillot Sénégal',
      'Boubou homme'
    ],
    maison: [
      'Canapé salon à Dakar',
      'Matelas deux places',
      'Meuble cuisine'
    ],
    artisanat: [
      `Plombier à ${location}`,
      `Électricien à ${location}`,
      'Menuisier devis'
    ],
    sante: [
      `Pharmacie à ${location}`,
      `Dentiste à ${location}`,
      'Laboratoire analyses'
    ],
    education: [
      `Formation informatique à ${location}`,
      'Cours anglais',
      'Certification cybersécurité'
    ]
  };
  return values[parsed.category] || [
    `${parsed.product} à ${location}`,
    `${parsed.product} prix Sénégal`
  ];
}
export async function findResults(req, input, parsed) {
  if (!await rateAllowed(req)) {
    return {
      results: [],
      suggestions: suggestions(parsed),
      search_id: null,
      meta: {
        result_count: 0,
        source_count: 0,
        rate_limited: true,
        response_ms: 0,
        notice_fr: 'Trop de recherches en une minute. Réessayez dans quelques instants.',
        notice_wo: 'Recherche yi bari nañu. Jéemaatal ci kanam tuuti.'
      }
    };
  }
  const start = performance.now();
  const directoryRows = await directory(parsed);
  const [legacyRows, crawledRows] = await Promise.all([
    legacySearch(req, input, parsed),
    crawlSources(directoryRows, parsed)
  ]);
  const directoryCards = sourceCards(directoryRows, parsed);
  const results = merge([
    ...legacyRows,
    ...crawledRows
  ], directoryCards);
  const response_ms = Math.round(performance.now() - start);
  const concrete = results.filter((item)=>item.result_type === 'offer');
  const sourceEntries = results.filter((item)=>item.result_type === 'source');
  const search_id = await recordSearch(input, parsed, results, {
    engine_version: VERSION,
    directory_count: directoryRows.length,
    legacy_offer_count: legacyRows.length,
    crawled_offer_count: crawledRows.length,
    source_entry_count: sourceEntries.length,
    guaranteed_continuity: sourceEntries.length > 0
  }, response_ms);
  const knownPrices = concrete.filter((item)=>Number(item.total_fcfa) > 0);
  const notice_fr = concrete.length ? 'Les offres exactes sont classées en premier. Les autres cartes ouvrent directement des sources sénégalaises pertinentes pour continuer la recherche.' : 'Aucune offre exacte vérifiable n’a été trouvée immédiatement. SeneCompare vous propose des sources sénégalaises pertinentes et directement utilisables au lieu d’afficher une page vide.';
  const notice_wo = concrete.length ? 'Offre yu am njëg ñoo jiitu. Yeneen cartes yi dañuy ubbi sources yu dëgg ci Senegaal.' : 'Offre bu wóor gisagul léegi. SeneCompare daf lay jox sources yu dëgg ngir nga kontine seet bi.';
  return {
    results,
    suggestions: suggestions(parsed),
    search_id,
    meta: {
      result_count: results.length,
      concrete_offer_count: concrete.length,
      source_entry_count: sourceEntries.length,
      known_price_count: knownPrices.length,
      source_count: new Set(results.map((item)=>item.source_domain)).size,
      quality_filtered: true,
      quality_version: VERSION,
      hybrid_search: true,
      guaranteed_continuity: sourceEntries.length > 0,
      zero_result_prevented: results.length > 0 && concrete.length === 0,
      intent_router: true,
      typo_tolerance: true,
      wolof_aliases: true,
      category: parsed.category,
      intent_type: parsed.intent_type,
      budget_match_count: results.filter((item)=>item.budget_status === 'within').length,
      response_ms,
      notice_fr,
      notice_wo
    }
  };
}
export async function proxyLegacy(path, req, body) {
  return fetch(`${LEGACY}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-version': VERSION,
      'user-agent': req.headers.get('user-agent') || USER_AGENT
    },
    body,
    signal: AbortSignal.timeout(13000)
  });
}
let statsCache = null;
let statsAt = 0;
export async function getStats(req) {
  if (statsCache && Date.now() - statsAt < 300_000) return statsCache;
  let popular = [];
  try {
    const response = await proxyLegacy('/stats', req);
    popular = (await response.json()).popular || [];
  } catch  {}
  const defaults = [
    'Téléphone Samsung',
    'Moto Jakarta',
    'Voiture occasion',
    'Frigo',
    'PC portable',
    'Salon de coiffure Dakar',
    'Pizza Dakar',
    'Service de livraison',
    'Transport taxi VTC',
    'Tissu wax Getzner Sénégal',
    'Pharmacie Dakar',
    'Formation informatique'
  ];
  const seen = new Set(popular.map((item)=>plain(item.label)));
  for (const label of defaults)if (!seen.has(plain(label))) popular.push({
    label,
    count: 0,
    default: true
  });
  statsCache = {
    ok: true,
    version: VERSION,
    period_days: 30,
    popular: popular.slice(0, 12),
    categories: [
      {
        label: 'Téléphones',
        query: 'téléphone smartphone',
        category: 'phones'
      },
      {
        label: 'Voitures',
        query: 'voiture occasion',
        category: 'cars'
      },
      {
        label: 'Motos',
        query: 'moto scooter Jakarta',
        category: 'motorcycles'
      },
      {
        label: 'Électroménager',
        query: 'électroménager',
        category: 'appliances'
      },
      {
        label: 'Informatique',
        query: 'ordinateur portable',
        category: 'computing'
      },
      {
        label: 'Mode & tissus',
        query: 'mode vêtements tissu wax',
        category: 'fashion'
      },
      {
        label: 'Maison',
        query: 'maison mobilier',
        category: 'home'
      },
      {
        label: 'Matériel pro',
        query: 'matériel professionnel',
        category: 'professional'
      },
      {
        label: 'Coiffure & beauté',
        query: 'salon de coiffure Dakar'
      },
      {
        label: 'Restaurants & repas',
        query: 'restaurant pizza Dakar'
      },
      {
        label: 'Transport',
        query: 'transport taxi VTC Dakar'
      },
      {
        label: 'Livraison & colis',
        query: 'service de livraison colis Dakar'
      },
      {
        label: 'Immobilier',
        query: 'appartement location Dakar'
      },
      {
        label: 'Santé',
        query: 'pharmacie clinique dentiste Dakar'
      },
      {
        label: 'Formation',
        query: 'formation cours certification Sénégal'
      }
    ],
    capabilities,
    guaranteed_continuity: true,
    generated_at: new Date().toISOString()
  };
  statsAt = Date.now();
  return statsCache;
}
