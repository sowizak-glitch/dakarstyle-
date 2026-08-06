const VERSION = '14.0.0';
const DEFAULT_SUPABASE_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ALLOWED_ORIGINS = new Set([
  'https://samabusiness.dakarstyle.com',
  'https://samacahier.dakarstyle.com',
]);

function corsHeaders(request) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    pragma: 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
    'x-frame-options': 'DENY',
    'x-samabusiness-owner-command': VERSION,
  });
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  return headers;
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function base64Url(bytes) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return base64Url(bytes);
}

function rawSession(request) {
  const token = String(request.headers.get('x-sama-session') || '').trim();
  return /^sama_[A-Za-z0-9_-]{30,500}$/.test(token) ? token : '';
}

function deviceName(userAgent) {
  const ua = String(userAgent || '');
  if (/SamsungBrowser/i.test(ua)) return 'Samsung · navigateur';
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Téléphone Android';
  if (/Android/i.test(ua)) return 'Tablette Android';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Edg\//i.test(ua)) return 'Ordinateur · Edge';
  if (/Chrome\//i.test(ua)) return 'Ordinateur · Chrome';
  if (/Firefox\//i.test(ua)) return 'Ordinateur · Firefox';
  if (/Safari\//i.test(ua)) return 'Ordinateur · Safari';
  return 'Appareil connecté';
}

function statusForCode(code) {
  const value = String(code || '');
  if (['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(value)) return 401;
  if (['OWNER_ACCESS_REQUIRED', 'RECOVERY_READ_ONLY', 'ACCOUNT_DISABLED'].includes(value)) return 403;
  if (['CURRENT_SESSION_PROTECTED', 'PROTECTED_IDENTITY', 'PAYMENT_ALREADY_REVIEWED'].includes(value)) return 409;
  if (['STRONG_CONFIRMATION_REQUIRED', 'INVALID_TARGET', 'SESSION_REQUIRED', 'ACCOUNT_REQUIRED', 'PAYMENT_REQUIRED', 'INCIDENT_REQUIRED'].includes(value)) return 422;
  if (value.endsWith('_NOT_FOUND')) return 404;
  return 400;
}

function normalizeRpcError(payload, fallbackStatus = 503) {
  const message = String(payload?.message || payload?.error || '');
  const codes = [
    'AUTH_REQUIRED', 'SESSION_EXPIRED', 'ACCOUNT_DISABLED', 'OWNER_ACCESS_REQUIRED',
    'RECOVERY_READ_ONLY', 'STRONG_CONFIRMATION_REQUIRED', 'CURRENT_SESSION_PROTECTED',
    'PROTECTED_IDENTITY', 'PAYMENT_ALREADY_REVIEWED', 'INVALID_TARGET',
    'SESSION_REQUIRED', 'ACCOUNT_REQUIRED', 'PAYMENT_REQUIRED', 'INCIDENT_REQUIRED',
    'SESSION_NOT_FOUND', 'ACCOUNT_NOT_FOUND', 'PAYMENT_NOT_FOUND', 'INCIDENT_NOT_FOUND',
  ];
  const code = codes.find((candidate) => message.includes(candidate)) || 'OWNER_COMMAND_FAILED';
  const messages = {
    AUTH_REQUIRED: 'Connexion requise.',
    SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
    ACCOUNT_DISABLED: 'Ce compte est désactivé.',
    OWNER_ACCESS_REQUIRED: 'Accès réservé au propriétaire.',
    RECOVERY_READ_ONLY: 'L’accès de récupération est limité à la consultation.',
    STRONG_CONFIRMATION_REQUIRED: 'La confirmation demandée est obligatoire.',
    CURRENT_SESSION_PROTECTED: 'La session utilisée actuellement est protégée.',
    PROTECTED_IDENTITY: 'Cette identité propriétaire est protégée.',
    PAYMENT_ALREADY_REVIEWED: 'Ce paiement a déjà été traité.',
    INVALID_TARGET: 'La cible de cette action est invalide.',
    SESSION_NOT_FOUND: 'Session introuvable.',
    ACCOUNT_NOT_FOUND: 'Compte introuvable.',
    PAYMENT_NOT_FOUND: 'Paiement introuvable.',
    INCIDENT_NOT_FOUND: 'Incident introuvable.',
    OWNER_COMMAND_FAILED: 'Le Centre de commandement est momentanément indisponible.',
  };
  return { code, error: messages[code], status: code === 'OWNER_COMMAND_FAILED' ? fallbackStatus : statusForCode(code) };
}

async function timedProbe(name, icon, url, timeoutMs = 2800) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
      headers: { 'x-client-info': `samabusiness-owner-health/${VERSION}` },
    });
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, icon,
      status: response.ok ? 'online' : 'degraded', httpStatus: response.status,
      latencyMs: Date.now() - started,
    };
  } catch (_) {
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, icon,
      status: 'offline', httpStatus: 0, latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function liveHealth(baseUrl) {
  const endpoints = [
    ['Application', '🏪', `${baseUrl}/functions/v1/samabusiness-pwa?mode=health`],
    ['Créateur de sites', '🌐', `${baseUrl}/functions/v1/samabusiness-site-studio-ui?v=${VERSION}`],
    ['Commerce', '🛒', `${baseUrl}/functions/v1/samabusiness-site-commerce-v13?v=${VERSION}`],
    ['Livraison', '🛵', `${baseUrl}/functions/v1/sama-livraison-bundle`],
    ['SeneCompare', '⚖️', `${baseUrl}/functions/v1/senecompare-production/health`],
  ];
  const modules = await Promise.all(endpoints.map(([name, icon, url]) => timedProbe(name, icon, url)));
  const online = modules.filter((item) => item.status === 'online').length;
  return {
    status: online === modules.length ? 'operational' : online >= Math.ceil(modules.length / 2) ? 'degraded' : 'critical',
    online, total: modules.length, checkedAt: new Date().toISOString(), modules,
  };
}

async function handleCommand(request, env) {
  const token = rawSession(request);
  if (!token) return json(request, { ok: false, code: 'AUTH_REQUIRED', error: 'Connexion requise.' }, 401);

  let body = {};
  try { body = await request.json(); }
  catch (_) { return json(request, { ok: false, code: 'INVALID_JSON', error: 'Demande invalide.' }, 400); }

  const action = String(body?.action || 'snapshot').trim().toLowerCase().slice(0, 80);
  const suppliedPayload = body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {};
  const baseUrl = String(env.SENECOMPARE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = String(env.SENECOMPARE_SUPABASE_ANON_KEY || '');
  if (!anonKey) return json(request, { ok: false, code: 'CONFIG_MISSING', error: 'Configuration du Centre de commandement indisponible.' }, 503);

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const requestId = crypto.randomUUID();
  const payload = {
    ...suppliedPayload,
    requestId,
    context: {
      ipHash: await sha256(`${ip}|${day}|samabusiness-owner-v14`),
      userAgentHash: await sha256(`${ua}|samabusiness-owner-v14`),
      deviceName: deviceName(ua),
      country: String(request.cf?.country || request.headers.get('cf-ipcountry') || '').slice(0, 8),
    },
  };

  const rpcResponse = await fetch(`${baseUrl}/rest/v1/rpc/sama_owner_command_v14`, {
    method: 'POST', cache: 'no-store',
    headers: {
      apikey: anonKey, authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
      'x-client-info': `samabusiness-owner-command/${VERSION}`,
    },
    body: JSON.stringify({
      p_session_hash: await sha256(token), p_action: action, p_payload: payload,
    }),
  });

  const result = await rpcResponse.json().catch(() => null);
  if (!rpcResponse.ok || !result) {
    const normalized = normalizeRpcError(result, rpcResponse.status >= 500 ? 503 : rpcResponse.status);
    return json(request, { ok: false, code: normalized.code, error: normalized.error, requestId }, normalized.status);
  }
  if (result.ok === false) return json(request, { ...result, requestId }, statusForCode(result.code));
  if (action === 'snapshot' || action === 'refresh') result.health = await liveHealth(baseUrl);
  result.requestId = requestId;
  result.version = VERSION;
  return json(request, result, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      const headers = corsHeaders(request);
      headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
      headers.set('access-control-allow-headers', 'content-type,x-sama-session,x-client-info');
      headers.set('access-control-max-age', '86400');
      return new Response(null, { status: 204, headers });
    }
    if (request.method === 'GET' && url.searchParams.get('health') === '1') {
      return json(request, { ok: true, service: 'samabusiness-owner-command', version: VERSION, authentication: 'required-for-data' });
    }
    if (request.method !== 'POST') return json(request, { ok: false, error: 'Method Not Allowed' }, 405);
    try { return await handleCommand(request, env); }
    catch (error) {
      console.error('samabusiness-owner-command-v14', error?.name || 'Error');
      return json(request, { ok: false, code: 'OWNER_COMMAND_FAILED', error: 'Le Centre de commandement est momentanément indisponible.' }, 503);
    }
  },
};
