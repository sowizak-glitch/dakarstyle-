import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '5.0.0';
const ENGINE_VERSION = '5.0.0';
const PROJECT_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const PROD = 'https://senecompare.dakarstyle.com';
const ALLOWED_ORIGINS = new Set([
  PROD,
  'https://senecompare-ai.vercel.app'
]);
const MAX_SEARCH_BODY_BYTES = 16_384;
const MAX_EVENT_BODY_BYTES = 8_192;
const MAX_SPEECH_TEXT_BYTES = 4_096;
const MAX_AUDIO_BYTES = 8_000_000;
const SEARCH_LIMIT_PER_MINUTE = 40;
const EVENT_LIMIT_PER_MINUTE = 60;
function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
function openAiKey() {
  return Deno.env.get('OPENAI_API_KEY') || '';
}
function dbClient() {
  const secret = serviceKey();
  if (!secret) throw Object.assign(new Error('SERVICE_UNAVAILABLE'), {
    status: 503
  });
  return createClient(PROJECT_URL, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
function originAllowed(req) {
  const origin = req.headers.get('origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}
function responseHeaders(req) {
  const origin = req.headers.get('origin') || '';
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
    'X-SeneCompare-Engine-Version': ENGINE_VERSION,
    'X-SeneCompare-Version': VERSION,
    Vary: 'Origin'
  };
}
function json(req, value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      ...extra
    }
  });
}
function route(url) {
  if (url.pathname.endsWith('/stats')) return 'stats';
  if (url.pathname.endsWith('/search')) return 'search';
  if (url.pathname.endsWith('/click')) return 'click';
  if (url.pathname.endsWith('/feedback')) return 'feedback';
  if (url.pathname.endsWith('/alerts')) return 'alerts';
  if (url.pathname.endsWith('/merchant/claim') || url.pathname.endsWith('/merchant')) return 'merchant';
  if (url.pathname.endsWith('/voice/speech') || url.pathname.endsWith('/speech')) return 'speech';
  if (url.pathname.endsWith('/voice/transcribe') || url.pathname.endsWith('/transcribe')) return 'transcribe';
  if (url.pathname.endsWith('/health') || url.pathname.endsWith('/senecompare-gateway')) return 'health';
  return 'unknown';
}
async function readBody(req, maxBytes) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  return text;
}
async function readJson(req, maxBytes) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) throw Object.assign(new Error('JSON_REQUIRED'), {
    status: 415
  });
  const text = await readBody(req, maxBytes);
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch  {
    throw Object.assign(new Error('INVALID_JSON'), {
      status: 400
    });
  }
}
const clean = (value, max = 500)=>String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function phone(value) {
  const normalized = String(value ?? '').replace(/[^+\d]/g, '').slice(0, 20);
  return /^\+?\d{8,15}$/.test(normalized) ? normalized : '';
}
function email(value) {
  const normalized = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}
function clientIdentity(req) {
  const forwarded = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || forwarded || req.headers.get('x-real-ip') || 'unknown';
}
async function rateAllowed(req, action, limit) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIdentity(req)));
  const key = [
    ...new Uint8Array(digest)
  ].map((value)=>value.toString(16).padStart(2, '0')).join('');
  const { data, error } = await dbClient().rpc('sc_take_rate_limit', {
    p_key_hash: key,
    p_action: action,
    p_limit: limit,
    p_window_seconds: 60
  });
  if (error) throw Object.assign(new Error('RATE_LIMIT_UNAVAILABLE'), {
    status: 503
  });
  return data === true;
}
async function callEngine(req, path, method, body) {
  return fetch(`${PROJECT_URL}/functions/v1/senecompare-production${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Version': `senecompare-gateway-${VERSION}`,
      'X-SeneCompare-Gateway': VERSION,
      'User-Agent': req.headers.get('user-agent') || `SeneCompareGateway/${VERSION}`
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(path === '/search' ? 55_000 : 15_000)
  });
}
async function objectBody(response) {
  const text = await response.text();
  try {
    const value = JSON.parse(text || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch  {
    return {
      ok: false,
      code: 'INVALID_ENGINE_RESPONSE'
    };
  }
}
async function insert(table, payload) {
  const { error } = await dbClient().from(table).insert(payload);
  if (error) throw Object.assign(new Error('WRITE_FAILED'), {
    status: 503
  });
}
async function synthesizeSpeech(req) {
  if (!openAiKey()) return json(req, {
    ok: false,
    code: 'VOICE_UNAVAILABLE'
  }, 503, {
    'Retry-After': '60'
  });
  if (!await rateAllowed(req, 'senecompare_speech_v5', 20)) return json(req, {
    ok: false,
    code: 'RATE_LIMITED'
  }, 429, {
    'Retry-After': '60'
  });
  const input = await readJson(req, MAX_SPEECH_TEXT_BYTES);
  const text = clean(input.text, 1200);
  const language = clean(input.language, 8).toLowerCase() === 'wo' ? 'wo' : 'fr';
  if (text.length < 2) return json(req, {
    ok: false,
    code: 'TEXT_REQUIRED'
  }, 400);
  const instructions = language === 'wo' ? 'Parle avec une voix humaine, chaleureuse et claire. Prononce naturellement le wolof sénégalais, sans exagérer l’accent, à un rythme accessible.' : 'Parle avec une voix humaine, chaleureuse et claire, adaptée au public sénégalais. Rythme calme et naturel, sans ton publicitaire.';
  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: text,
      instructions,
      response_format: 'mp3'
    }),
    signal: AbortSignal.timeout(45_000)
  });
  if (!upstream.ok) {
    console.error('speech_upstream', upstream.status);
    return json(req, {
      ok: false,
      code: 'VOICE_TEMPORARILY_UNAVAILABLE'
    }, 503, {
      'Retry-After': '30'
    });
  }
  const headers = new Headers(responseHeaders(req));
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Content-Disposition', 'inline; filename="senecompare-voice.mp3"');
  headers.set('X-SeneCompare-Voice', 'gpt-4o-mini-tts:marin');
  headers.delete('Content-Length');
  return new Response(upstream.body, {
    status: 200,
    headers
  });
}
async function transcribeAudio(req) {
  if (!openAiKey()) return json(req, {
    ok: false,
    code: 'TRANSCRIPTION_UNAVAILABLE'
  }, 503, {
    'Retry-After': '60'
  });
  if (!await rateAllowed(req, 'senecompare_transcribe_v5', 20)) return json(req, {
    ok: false,
    code: 'RATE_LIMITED'
  }, 429, {
    'Retry-After': '60'
  });
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_AUDIO_BYTES + 200_000) return json(req, {
    ok: false,
    code: 'AUDIO_TOO_LARGE'
  }, 413);
  const form = await req.formData();
  const audio = form.get('audio') || form.get('file');
  if (!(audio instanceof File) || audio.size < 100 || audio.size > MAX_AUDIO_BYTES) return json(req, {
    ok: false,
    code: 'AUDIO_REQUIRED'
  }, 400);
  const language = clean(form.get('language'), 8).toLowerCase();
  const upstreamForm = new FormData();
  upstreamForm.set('file', audio, audio.name || 'recherche.webm');
  upstreamForm.set('model', 'gpt-4o-mini-transcribe');
  upstreamForm.set('response_format', 'json');
  upstreamForm.set('prompt', language === 'wo' ? 'Transcris fidèlement cette recherche en wolof sénégalais ou en français. Garde les marques, modèles, nombres, capacités, villes et budgets.' : 'Transcris fidèlement cette recherche en français ou wolof sénégalais. Garde les marques, modèles, nombres, capacités, villes et budgets.');
  const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey()}`
    },
    body: upstreamForm,
    signal: AbortSignal.timeout(60_000)
  });
  if (!upstream.ok) {
    console.error('transcription_upstream', upstream.status);
    return json(req, {
      ok: false,
      code: 'TRANSCRIPTION_TEMPORARILY_UNAVAILABLE'
    }, 503, {
      'Retry-After': '30'
    });
  }
  const payload = await objectBody(upstream);
  const text = clean(payload.text, 320);
  if (!text) return json(req, {
    ok: false,
    code: 'TRANSCRIPTION_EMPTY'
  }, 422);
  return json(req, {
    ok: true,
    text,
    language: language || 'auto',
    model: 'gpt-4o-mini-transcribe'
  });
}
Deno.serve(async (req)=>{
  const currentRoute = route(new URL(req.url));
  if (req.method === 'OPTIONS') {
    if (!originAllowed(req)) return new Response(null, {
      status: 403,
      headers: responseHeaders(req)
    });
    return new Response(null, {
      status: 204,
      headers: responseHeaders(req)
    });
  }
  if (!originAllowed(req)) return json(req, {
    ok: false,
    code: 'ORIGIN_FORBIDDEN'
  }, 403);
  try {
    if (currentRoute === 'health' && req.method === 'GET') {
      let engineOk = false;
      try {
        const upstream = await callEngine(req, '/health', 'GET');
        const value = await objectBody(upstream);
        engineOk = upstream.ok && value.ok === true && value.version === ENGINE_VERSION;
      } catch  {}
      return json(req, {
        ok: true,
        app: 'SeneCompare AI',
        service: 'SeneCompare Zero Trust Gateway',
        version: VERSION,
        engine_version: ENGINE_VERSION,
        data_mode: 'hybrid_local_search',
        catalog_connected: engineOk,
        gateway_security: true,
        strict_origin: true,
        bounded_payloads: true,
        distributed_rate_limit: true,
        human_voice_available: Boolean(openAiKey()),
        voice_transcription_available: Boolean(openAiKey()),
        timestamp: new Date().toISOString()
      });
    }
    if (currentRoute === 'stats' && req.method === 'GET') {
      const upstream = await callEngine(req, '/stats', 'GET');
      const value = await objectBody(upstream);
      return json(req, {
        ...value,
        version: VERSION,
        gateway_version: VERSION,
        engine_version: String(value.version || ENGINE_VERSION)
      }, upstream.status);
    }
    if (currentRoute === 'search' && req.method === 'POST') {
      const input = await readJson(req, MAX_SEARCH_BODY_BYTES);
      const query = typeof input.query === 'string' ? input.query.trim() : '';
      if (query.length < 2 || query.length > 320) return json(req, {
        ok: false,
        code: 'QUERY_INVALID',
        message: 'La recherche doit contenir entre 2 et 320 caractères.'
      }, 400);
      if (!await rateAllowed(req, 'hybrid_search_gateway_v5', SEARCH_LIMIT_PER_MINUTE)) return json(req, {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Trop de recherches. Réessayez dans une minute.'
      }, 429, {
        'Retry-After': '60'
      });
      input.query = query;
      const upstream = await callEngine(req, '/search', 'POST', JSON.stringify(input));
      const value = await objectBody(upstream);
      const timing = upstream.headers.get('server-timing');
      return json(req, {
        ...value,
        version: VERSION,
        gateway_version: VERSION,
        engine_version: String(value.version || ENGINE_VERSION),
        data_mode: 'hybrid_local_search'
      }, upstream.status, timing ? {
        'Server-Timing': timing
      } : {});
    }
    if (currentRoute === 'speech' && req.method === 'POST') return synthesizeSpeech(req);
    if (currentRoute === 'transcribe' && req.method === 'POST') return transcribeAudio(req);
    if (currentRoute === 'click' && req.method === 'POST') {
      if (!await rateAllowed(req, 'universal_click_gateway', EVENT_LIMIT_PER_MINUTE)) return json(req, {
        ok: false,
        code: 'RATE_LIMITED'
      }, 429, {
        'Retry-After': '60'
      });
      const input = await readJson(req, MAX_EVENT_BODY_BYTES);
      const upstream = await callEngine(req, '/click', 'POST', JSON.stringify(input));
      return json(req, {
        ...await objectBody(upstream),
        gateway_version: VERSION
      }, upstream.status);
    }
    if (currentRoute === 'feedback' && req.method === 'POST') {
      if (!await rateAllowed(req, 'universal_feedback_gateway', EVENT_LIMIT_PER_MINUTE)) return json(req, {
        ok: false,
        code: 'RATE_LIMITED'
      }, 429, {
        'Retry-After': '60'
      });
      const input = await readJson(req, MAX_EVENT_BODY_BYTES);
      const offerId = clean(input.offerId || input.offer_id, 100);
      const reason = clean(input.reason, 40) || 'other';
      if (offerId) {
        await insert('senecompare_price_reports', {
          offer_id: offerId,
          reason: [
            'price_outdated',
            'unavailable',
            'wrong_details',
            'suspicious',
            'other'
          ].includes(reason) ? reason : 'other',
          details: clean(input.details, 500),
          page_url: clean(input.pageUrl || input.page_url, 500),
          locale: [
            'fr',
            'wo'
          ].includes(clean(input.locale, 4)) ? clean(input.locale, 4) : 'fr',
          review_status: 'pending'
        });
        return json(req, {
          ok: true,
          accepted: true,
          gateway_version: VERSION
        }, 202);
      }
      const upstream = await callEngine(req, '/feedback', 'POST', JSON.stringify(input));
      return json(req, {
        ...await objectBody(upstream),
        gateway_version: VERSION
      }, upstream.status);
    }
    if (currentRoute === 'alerts' && req.method === 'POST') {
      if (!await rateAllowed(req, 'universal_alert_gateway', 20)) return json(req, {
        ok: false,
        code: 'RATE_LIMITED'
      }, 429, {
        'Retry-After': '60'
      });
      const input = await readJson(req, MAX_EVENT_BODY_BYTES);
      const payload = {
        offer_id: clean(input.offerId || input.offer_id, 100),
        query: clean(input.query, 180),
        target_price: Math.max(0, Math.min(1_000_000_000, Math.round(Number(input.targetPrice || input.target_price || 0) || 0))),
        phone: phone(input.phone),
        email: email(input.email),
        locale: [
          'fr',
          'wo'
        ].includes(clean(input.locale, 4)) ? clean(input.locale, 4) : 'fr',
        status: 'active'
      };
      if (!payload.offer_id && !payload.query) return json(req, {
        ok: false,
        code: 'OFFER_OR_QUERY_REQUIRED'
      }, 400);
      if (!payload.phone && !payload.email) return json(req, {
        ok: false,
        code: 'CONTACT_REQUIRED'
      }, 400);
      await insert('senecompare_public_alert_requests', payload);
      return json(req, {
        ok: true,
        accepted: true,
        gateway_version: VERSION
      }, 202);
    }
    if (currentRoute === 'merchant' && req.method === 'POST') {
      if (!await rateAllowed(req, 'universal_merchant_gateway', 12)) return json(req, {
        ok: false,
        code: 'RATE_LIMITED'
      }, 429, {
        'Retry-After': '60'
      });
      const input = await readJson(req, MAX_EVENT_BODY_BYTES);
      const payload = {
        business_name: clean(input.businessName || input.business_name, 160),
        contact_name: clean(input.contactName || input.contact_name, 160),
        phone: phone(input.phone),
        email: email(input.email),
        offer_id: clean(input.offerId || input.offer_id, 100),
        message: clean(input.message, 800),
        status: 'pending'
      };
      if (!payload.business_name || !payload.phone) return json(req, {
        ok: false,
        code: 'BUSINESS_AND_PHONE_REQUIRED'
      }, 400);
      await insert('senecompare_merchant_claims', payload);
      return json(req, {
        ok: true,
        accepted: true,
        gateway_version: VERSION
      }, 202);
    }
    if (![
      'GET',
      'POST'
    ].includes(req.method)) return json(req, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED'
    }, 405, {
      Allow: 'GET,POST,OPTIONS'
    });
    return json(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
  } catch (error) {
    const status = Number(error?.status || 500);
    const message = String(error?.message || 'INTERNAL_ERROR');
    if (status === 413) return json(req, {
      ok: false,
      code: 'PAYLOAD_TOO_LARGE'
    }, 413);
    if (status === 415) return json(req, {
      ok: false,
      code: 'JSON_REQUIRED'
    }, 415);
    if (status === 400 && message === 'INVALID_JSON') return json(req, {
      ok: false,
      code: 'INVALID_JSON'
    }, 400);
    if (status === 503) return json(req, {
      ok: false,
      code: 'TEMPORARILY_UNAVAILABLE'
    }, 503, {
      'Retry-After': '30'
    });
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({
      request_id: requestId,
      message
    }));
    return json(req, {
      ok: false,
      code: 'INTERNAL_ERROR',
      request_id: requestId
    }, 500);
  }
});
