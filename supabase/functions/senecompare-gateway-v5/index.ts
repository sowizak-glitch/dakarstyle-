import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const VERSION = '5.1.0';
const ENGINE_VERSION = '5.0.0';
const PROJECT_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ENGINE_URL = `${PROJECT_URL}/functions/v1/senecompare-production`;
const PROD = 'https://senecompare.dakarstyle.com';
const ALLOWED_ORIGINS = new Set([PROD, 'https://senecompare-ai.vercel.app', 'http://localhost:5173']);
const MAX_SEARCH_BYTES = 16_384;
const MAX_EVENT_BYTES = 8_192;
const MAX_SPEECH_BYTES = 4_096;
const MAX_AUDIO_BYTES = 8_000_000;

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

function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch { /* fallback */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function openAiKey() {
  return Deno.env.get('OPENAI_API_KEY') || '';
}

function dbClient() {
  const key = serviceKey();
  if (!key) throw Object.assign(new Error('SERVICE_UNAVAILABLE'), { status: 503 });
  return createClient(PROJECT_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SeneCompare-Intent-Router': VERSION,
    'X-SeneCompare-Engine-Version': ENGINE_VERSION,
    'X-SeneCompare-Version': VERSION,
    Vary: 'Origin',
  };
}

function json(request, payload, status = 200, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function route(url) {
  const path = url.pathname;
  if (path.endsWith('/stats')) return 'stats';
  if (path.endsWith('/search')) return 'search';
  if (path.endsWith('/click')) return 'click';
  if (path.endsWith('/feedback')) return 'feedback';
  if (path.endsWith('/alerts')) return 'alerts';
  if (path.endsWith('/merchant/claim') || path.endsWith('/merchant')) return 'merchant';
  if (path.endsWith('/voice/speech') || path.endsWith('/speech')) return 'speech';
  if (path.endsWith('/voice/transcribe') || path.endsWith('/transcribe')) return 'transcribe';
  if (path.endsWith('/health') || path.endsWith('/senecompare-gateway-v5')) return 'health';
  return 'unknown';
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function priorityCategory(query, current) {
  if (current && current !== 'all' && current !== 'general') return current;
  const text = normalize(query);
  for (const [category, pattern] of PRIORITY_INTENTS) if (pattern.test(text)) return category;
  return current || 'all';
}

function clean(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function phone(value) {
  const normalized = String(value ?? '').replace(/[^+\d]/g, '').slice(0, 20);
  return /^\+?\d{8,15}$/.test(normalized) ? normalized : '';
}

function email(value) {
  const normalized = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

async function readBody(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  return text;
}

async function readJson(request, maxBytes) {
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) throw Object.assign(new Error('JSON_REQUIRED'), { status: 415 });
  const text = await readBody(request, maxBytes);
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 });
  }
}

function clientIdentity(request) {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unknown';
}

async function rateAllowed(request, action, limit) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIdentity(request)));
  const key = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  const { data, error } = await dbClient().rpc('sc_take_rate_limit', {
    p_key_hash: key,
    p_action: action,
    p_limit: limit,
    p_window_seconds: 60,
  });
  if (error) throw Object.assign(new Error('RATE_LIMIT_UNAVAILABLE'), { status: 503 });
  return data === true;
}

async function callEngine(path, method, body) {
  return fetch(`${ENGINE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Version': `senecompare-gateway-${VERSION}`,
      'User-Agent': `SeneCompareGateway/${VERSION}`,
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(path === '/search' ? 55_000 : 15_000),
  });
}

async function objectBody(response) {
  const text = await response.text();
  try {
    const value = JSON.parse(text || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return { ok: false, code: 'INVALID_ENGINE_RESPONSE' };
  }
}

async function insert(table, payload) {
  const { error } = await dbClient().from(table).insert(payload);
  if (error) throw Object.assign(new Error('WRITE_FAILED'), { status: 503 });
}

async function synthesizeSpeech(request) {
  if (!openAiKey()) return json(request, { ok: false, code: 'VOICE_UNAVAILABLE' }, 503, { 'Retry-After': '60' });
  if (!await rateAllowed(request, 'senecompare_speech_v51', 20)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
  const input = await readJson(request, MAX_SPEECH_BYTES);
  const text = clean(input.text, 1200);
  const language = clean(input.language, 8).toLowerCase() === 'wo' ? 'wo' : 'fr';
  if (text.length < 2) return json(request, { ok: false, code: 'TEXT_REQUIRED' }, 400);
  const instructions = language === 'wo'
    ? 'Parle avec une voix humaine, chaleureuse et claire. Prononce naturellement le wolof sénégalais, sans exagérer l’accent, à un rythme accessible.'
    : 'Parle avec une voix humaine, chaleureuse et claire, adaptée au public sénégalais. Rythme calme et naturel, sans ton publicitaire.';
  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'marin', input: text, instructions, response_format: 'mp3' }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!upstream.ok) return json(request, { ok: false, code: 'VOICE_TEMPORARILY_UNAVAILABLE' }, 503, { 'Retry-After': '30' });
  const headers = new Headers(corsHeaders(request));
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Content-Disposition', 'inline; filename="senecompare-voice.mp3"');
  headers.set('X-SeneCompare-Voice', 'gpt-4o-mini-tts:marin');
  return new Response(upstream.body, { status: 200, headers });
}

async function transcribeAudio(request) {
  if (!openAiKey()) return json(request, { ok: false, code: 'TRANSCRIPTION_UNAVAILABLE' }, 503, { 'Retry-After': '60' });
  if (!await rateAllowed(request, 'senecompare_transcribe_v51', 20)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_AUDIO_BYTES + 200_000) return json(request, { ok: false, code: 'AUDIO_TOO_LARGE' }, 413);
  const form = await request.formData();
  const audio = form.get('audio') || form.get('file');
  if (!(audio instanceof File) || audio.size < 100 || audio.size > MAX_AUDIO_BYTES) return json(request, { ok: false, code: 'AUDIO_REQUIRED' }, 400);
  const language = clean(form.get('language'), 8).toLowerCase();
  const upstreamForm = new FormData();
  upstreamForm.set('file', audio, audio.name || 'recherche.webm');
  upstreamForm.set('model', 'gpt-4o-mini-transcribe');
  upstreamForm.set('response_format', 'json');
  upstreamForm.set('prompt', language === 'wo'
    ? 'Transcris fidèlement cette recherche en wolof sénégalais ou en français. Garde les marques, modèles, nombres, capacités, villes et budgets.'
    : 'Transcris fidèlement cette recherche en français ou wolof sénégalais. Garde les marques, modèles, nombres, capacités, villes et budgets.');
  const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey()}` },
    body: upstreamForm,
    signal: AbortSignal.timeout(60_000),
  });
  if (!upstream.ok) return json(request, { ok: false, code: 'TRANSCRIPTION_TEMPORARILY_UNAVAILABLE' }, 503, { 'Retry-After': '30' });
  const payload = await objectBody(upstream);
  const text = clean(payload.text, 320);
  if (!text) return json(request, { ok: false, code: 'TRANSCRIPTION_EMPTY' }, 422);
  return json(request, { ok: true, text, language: language || 'auto', model: 'gpt-4o-mini-transcribe' });
}

Deno.serve(async (request) => {
  const currentRoute = route(new URL(request.url));
  if (request.method === 'OPTIONS') {
    if (!originAllowed(request)) return new Response(null, { status: 403, headers: corsHeaders(request) });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (!originAllowed(request)) return json(request, { ok: false, code: 'ORIGIN_FORBIDDEN' }, 403);

  try {
    if (currentRoute === 'health' && request.method === 'GET') {
      let engineOk = false;
      try {
        const upstream = await callEngine('/health', 'GET');
        const value = await objectBody(upstream);
        engineOk = upstream.ok && value.ok === true && value.version === ENGINE_VERSION;
      } catch { /* reflected below */ }
      return json(request, {
        ok: true,
        app: 'SeneCompare AI',
        service: 'SeneCompare Autonomous Zero Trust Gateway',
        version: VERSION,
        engine_version: ENGINE_VERSION,
        data_mode: 'hybrid_local_search',
        catalog_connected: engineOk,
        gateway_security: true,
        intent_priority: true,
        strict_origin: true,
        bounded_payloads: true,
        distributed_rate_limit: true,
        human_voice_available: Boolean(openAiKey()),
        voice_transcription_available: Boolean(openAiKey()),
        timestamp: new Date().toISOString(),
      });
    }

    if (currentRoute === 'stats' && request.method === 'GET') {
      const upstream = await callEngine('/stats', 'GET');
      const value = await objectBody(upstream);
      return json(request, { ...value, version: VERSION, gateway_version: VERSION, engine_version: String(value.version || ENGINE_VERSION) }, upstream.status);
    }

    if (currentRoute === 'search' && request.method === 'POST') {
      const input = await readJson(request, MAX_SEARCH_BYTES);
      const query = typeof input.query === 'string' ? input.query.trim() : '';
      if (query.length < 2 || query.length > 320) return json(request, { ok: false, code: 'QUERY_INVALID' }, 400);
      if (!await rateAllowed(request, 'hybrid_search_gateway_v51', 40)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
      input.query = query;
      input.category = priorityCategory(query, input.category);
      const upstream = await callEngine('/search', 'POST', JSON.stringify(input));
      const value = await objectBody(upstream);
      const timing = upstream.headers.get('server-timing');
      return json(request, { ...value, version: VERSION, gateway_version: VERSION, engine_version: String(value.version || ENGINE_VERSION), data_mode: 'hybrid_local_search' }, upstream.status, timing ? { 'Server-Timing': timing } : {});
    }

    if (currentRoute === 'speech' && request.method === 'POST') return synthesizeSpeech(request);
    if (currentRoute === 'transcribe' && request.method === 'POST') return transcribeAudio(request);

    if (currentRoute === 'click' && request.method === 'POST') {
      const input = await readJson(request, MAX_EVENT_BYTES);
      const upstream = await callEngine('/click', 'POST', JSON.stringify(input));
      return json(request, { ...(await objectBody(upstream)), gateway_version: VERSION }, upstream.status);
    }

    if (currentRoute === 'feedback' && request.method === 'POST') {
      if (!await rateAllowed(request, 'feedback_gateway_v51', 60)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429);
      const input = await readJson(request, MAX_EVENT_BYTES);
      const offerId = clean(input.offerId || input.offer_id, 100);
      if (offerId) {
        const reason = clean(input.reason, 40) || 'other';
        await insert('senecompare_price_reports', {
          offer_id: offerId,
          reason: ['price_outdated', 'unavailable', 'wrong_details', 'suspicious', 'other'].includes(reason) ? reason : 'other',
          details: clean(input.details, 500),
          page_url: clean(input.pageUrl || input.page_url, 500),
          locale: ['fr', 'wo'].includes(clean(input.locale, 4)) ? clean(input.locale, 4) : 'fr',
          review_status: 'pending',
        });
        return json(request, { ok: true, accepted: true, gateway_version: VERSION }, 202);
      }
      const upstream = await callEngine('/feedback', 'POST', JSON.stringify(input));
      return json(request, { ...(await objectBody(upstream)), gateway_version: VERSION }, upstream.status);
    }

    if (currentRoute === 'alerts' && request.method === 'POST') {
      if (!await rateAllowed(request, 'alert_gateway_v51', 20)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429);
      const input = await readJson(request, MAX_EVENT_BYTES);
      const payload = {
        offer_id: clean(input.offerId || input.offer_id, 100),
        query: clean(input.query, 180),
        target_price: Math.max(0, Math.min(1_000_000_000, Math.round(Number(input.targetPrice || input.target_price || 0) || 0))),
        phone: phone(input.phone),
        email: email(input.email),
        locale: ['fr', 'wo'].includes(clean(input.locale, 4)) ? clean(input.locale, 4) : 'fr',
        status: 'active',
      };
      if (!payload.offer_id && !payload.query) return json(request, { ok: false, code: 'OFFER_OR_QUERY_REQUIRED' }, 400);
      if (!payload.phone && !payload.email) return json(request, { ok: false, code: 'CONTACT_REQUIRED' }, 400);
      await insert('senecompare_public_alert_requests', payload);
      return json(request, { ok: true, accepted: true, gateway_version: VERSION }, 202);
    }

    if (currentRoute === 'merchant' && request.method === 'POST') {
      if (!await rateAllowed(request, 'merchant_gateway_v51', 12)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429);
      const input = await readJson(request, MAX_EVENT_BYTES);
      const payload = {
        business_name: clean(input.businessName || input.business_name, 160),
        contact_name: clean(input.contactName || input.contact_name, 160),
        phone: phone(input.phone),
        email: email(input.email),
        offer_id: clean(input.offerId || input.offer_id, 100),
        message: clean(input.message, 800),
        status: 'pending',
      };
      if (!payload.business_name || !payload.phone) return json(request, { ok: false, code: 'BUSINESS_AND_PHONE_REQUIRED' }, 400);
      await insert('senecompare_merchant_claims', payload);
      return json(request, { ok: true, accepted: true, gateway_version: VERSION }, 202);
    }

    if (!['GET', 'POST'].includes(request.method)) return json(request, { ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    return json(request, { ok: false, code: 'NOT_FOUND' }, 404);
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || 'INTERNAL_ERROR');
    if ([400, 413, 415].includes(status)) return json(request, { ok: false, code }, status);
    if (status === 503) return json(request, { ok: false, code: 'TEMPORARILY_UNAVAILABLE' }, 503, { 'Retry-After': '30' });
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({ request_id: requestId, code }));
    return json(request, { ok: false, code: 'INTERNAL_ERROR', request_id: requestId }, 500);
  }
});
