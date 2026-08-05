const VERSION = '5.0.1';
const UPSTREAM = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/senecompare-gateway';
const PROD = 'https://senecompare.dakarstyle.com';
const ALLOWED_ORIGINS = new Set([PROD, 'https://senecompare-ai.vercel.app', 'http://localhost:5173']);
const MAX_SEARCH_BYTES = 16_384;

const PRIORITY_INTENTS = [
  ['artisanat', /plombier|electricien|mecanicien|menuisier|peintre|macon|reparation|depannage|nettoyage|lavage|artisan|couturier|tailleur|broderie|imprimerie/i],
  ['sante', /clinique|medecin|pharmacie|dentiste|laboratoire|sante|opticien|radiologie|consultation/i],
  ['education', /ecole|formation|cours|certification|universite|institut|apprentissage|enseignant/i],
  ['finance', /assurance|mutuelle|credit|banque|pret|transfert d argent|change devise|microfinance/i],
  ['livraison', /livraison|livrer|coursier|colis|expedition|messagerie|logistique|demenagement|yobbu|yobbante/i],
  ['transport', /transport|taxi|vtc|bus|car rapide|clando|chauffeur|navette|trajet|transfert aeroport|dem dikk/i],
  ['restauration', /pizza|restaurant|repas|fast[ -]?food|burger|sandwich|grill|traiteur|menu|thieb|ceebu|yassa|cafe|patisserie|boulangerie|nourriture|manger|lekk/i],
  ['coiffure', /coiff|salon de beaut|barber|barbier|tresse|natte|manucure|pedicure|onglerie|spa/i],
  ['immobilier', /appartement|studio|villa|terrain|immobilier|location maison|location bureau|chambre a louer|logement/i],
  ['voyage', /hotel|auberge|hebergement|voyage|billet d avion|\bvol\b|agence de voyage|sejour/i],
];

function originAllowed(request) {
  const origin = request.headers.get('origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : PROD,
    'Access-Control-Allow-Headers': 'content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SeneCompare-Intent-Router': VERSION,
    Vary: 'Origin',
  };
}

function json(request, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function priorityCategory(query, current) {
  if (current && current !== 'all' && current !== 'general') return current;
  const normalized = normalize(query);
  for (const [category, pattern] of PRIORITY_INTENTS) if (pattern.test(normalized)) return category;
  return current || 'all';
}

function upstreamPath(url) {
  const marker = '/senecompare-gateway-v5';
  const index = url.pathname.indexOf(marker);
  const suffix = index >= 0 ? url.pathname.slice(index + marker.length) : url.pathname;
  return suffix || '/health';
}

async function proxy(request) {
  const url = new URL(request.url);
  const target = new URL(`${UPSTREAM}${upstreamPath(url)}${url.search}`);
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'x-client-version', 'user-agent', 'origin', 'x-forwarded-for', 'cf-connecting-ip']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-senecompare-intent-router', VERSION);

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (target.pathname.endsWith('/search')) {
      const declared = Number(request.headers.get('content-length') || 0);
      if (declared > MAX_SEARCH_BYTES) return json(request, { ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_SEARCH_BYTES) return json(request, { ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
      let input;
      try { input = JSON.parse(text || '{}'); } catch { return json(request, { ok: false, code: 'INVALID_JSON' }, 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(request, { ok: false, code: 'INVALID_JSON' }, 400);
      input.category = priorityCategory(input.query, input.category);
      body = JSON.stringify(input);
      headers.set('content-type', 'application/json');
    } else {
      body = request.body;
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(target.pathname.includes('/voice/') ? 65_000 : target.pathname.endsWith('/search') ? 58_000 : 25_000),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'intent_router_upstream_failed', detail: String(error) }));
    return json(request, { ok: false, code: 'UPSTREAM_UNAVAILABLE' }, 503);
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) responseHeaders.set(key, value);
  responseHeaders.set('X-SeneCompare-Intent-Router', VERSION);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    if (!originAllowed(request)) return new Response(null, { status: 403, headers: corsHeaders(request) });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (!originAllowed(request)) return json(request, { ok: false, code: 'ORIGIN_FORBIDDEN' }, 403);
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return json(request, { ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  return proxy(request);
});
