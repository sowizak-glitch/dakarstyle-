/**
 * SOWHAT Control V5 - Client Meta Graph API (Instagram)
 *
 * Couche unique d'acces a l'API Meta. Aucun autre module ne doit appeler
 * graph.facebook.com directement.
 *
 * Garanties :
 *   - le token n'est jamais journalise, ni renvoye, ni present dans un message
 *     d'erreur : `redactSecrets` nettoie toute chaine avant sortie ;
 *   - toute erreur Meta est traduite en code stable et explicitement marquee
 *     rejouable ou non ;
 *   - les tentatives sont bornees, avec repli exponentiel et gigue ;
 *   - la pagination est bornee pour ne jamais boucler indefiniment ;
 *   - le temps et le reseau sont injectables, donc entierement testables.
 */

const DEFAULT_GRAPH_BASE = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v21.0';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_MAX_PAGES = 20;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
const APP_USAGE_PAUSE_THRESHOLD = 90;

/** Codes d'erreur stables exposes au reste du systeme. */
export const META_ERROR = Object.freeze({
  NOT_CONFIGURED: 'meta_not_configured',
  UNAUTHORIZED: 'meta_unauthorized',
  TOKEN_EXPIRED: 'meta_token_expired',
  FORBIDDEN: 'meta_permission_denied',
  RATE_LIMITED: 'meta_rate_limited',
  BAD_REQUEST: 'meta_bad_request',
  NOT_FOUND: 'meta_not_found',
  SERVER_ERROR: 'meta_server_error',
  TIMEOUT: 'meta_timeout',
  NETWORK: 'meta_network_error',
  UNKNOWN: 'meta_unknown_error',
});

const RETRYABLE = new Set([
  META_ERROR.RATE_LIMITED,
  META_ERROR.SERVER_ERROR,
  META_ERROR.TIMEOUT,
  META_ERROR.NETWORK,
]);

export class MetaApiError extends Error {
  constructor(code, { status = 0, detail = '', metaCode = null, metaSubcode = null } = {}) {
    super(code);
    this.name = 'MetaApiError';
    this.code = code;
    this.status = status;
    this.detail = redactSecrets(detail).slice(0, 400);
    this.metaCode = metaCode;
    this.metaSubcode = metaSubcode;
    this.retryable = RETRYABLE.has(code);
  }

  toJSON() {
    return {
      code: this.code,
      status: this.status,
      detail: this.detail,
      meta_code: this.metaCode,
      meta_subcode: this.metaSubcode,
      retryable: this.retryable,
    };
  }
}

/** Retire tout secret d'une chaine avant journalisation ou renvoi. */
export function redactSecrets(value) {
  return String(value ?? '')
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[REDACTED]')
    .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"')
    .replace(/EAA[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer [REDACTED]');
}

export function isInstagramConfigured(env) {
  return Boolean(
    String(env?.INSTAGRAM_ACCESS_TOKEN || '').trim()
    && String(env?.INSTAGRAM_USER_ID || '').trim(),
  );
}

function sanitizeApiVersion(value) {
  const version = String(value || '').trim();
  return /^v\d{1,2}\.\d{1,2}$/.test(version) ? version : DEFAULT_API_VERSION;
}

function graphBase(env) {
  const configured = String(env?.INSTAGRAM_GRAPH_BASE || '').trim();
  if (!configured) return DEFAULT_GRAPH_BASE;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? url.origin : DEFAULT_GRAPH_BASE;
  } catch {
    return DEFAULT_GRAPH_BASE;
  }
}

/** Traduit un couple statut/charge utile Meta en erreur stable. */
export function classifyMetaError(status, payload) {
  const error = payload?.error || {};
  const metaCode = Number.isFinite(Number(error.code)) ? Number(error.code) : null;
  const metaSubcode = Number.isFinite(Number(error.error_subcode)) ? Number(error.error_subcode) : null;
  const detail = redactSecrets(error.message || '');
  const options = { status, detail, metaCode, metaSubcode };

  if (metaSubcode === 463 || metaSubcode === 467 || metaCode === 190) {
    return new MetaApiError(META_ERROR.TOKEN_EXPIRED, options);
  }
  if (metaCode === 4 || metaCode === 17 || metaCode === 32 || metaCode === 613 || status === 429) {
    return new MetaApiError(META_ERROR.RATE_LIMITED, options);
  }
  if (metaCode === 10 || metaCode === 200 || metaCode === 803 || status === 403) {
    return new MetaApiError(META_ERROR.FORBIDDEN, options);
  }
  if (status === 401) return new MetaApiError(META_ERROR.UNAUTHORIZED, options);
  if (status === 404) return new MetaApiError(META_ERROR.NOT_FOUND, options);
  if (status >= 500) return new MetaApiError(META_ERROR.SERVER_ERROR, options);
  if (status >= 400) return new MetaApiError(META_ERROR.BAD_REQUEST, options);
  return new MetaApiError(META_ERROR.UNKNOWN, options);
}

/** Lit l'en-tete x-app-usage pour anticiper la limitation de debit. */
export function readAppUsage(headers) {
  const raw = headers?.get?.('x-app-usage') || headers?.get?.('x-business-use-case-usage') || '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed).flat().filter((v) => v && typeof v === 'object');
    const pool = values.length ? values : [parsed];
    const worst = pool.reduce((max, entry) => Math.max(
      max,
      Number(entry?.call_count || 0),
      Number(entry?.total_cputime || 0),
      Number(entry?.total_time || 0),
    ), 0);
    return Number.isFinite(worst) ? worst : null;
  } catch {
    return null;
  }
}

function backoffDelay(attempt, random) {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** (attempt - 1)));
  return Math.round(exponential * (0.5 + random() * 0.5));
}

/**
 * Construit un client Meta. Toutes les dependances externes sont injectables
 * pour que la totalite des chemins d'erreur soit testable sans reseau.
 */
export function createInstagramClient(env, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random || Math.random;
  const now = options.now || (() => Date.now());
  const maxAttempts = Number(options.maxAttempts) > 0 ? Number(options.maxAttempts) : DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};

  const version = sanitizeApiVersion(env?.INSTAGRAM_API_VERSION);
  const base = graphBase(env);
  const token = String(env?.INSTAGRAM_ACCESS_TOKEN || '').trim();
  const userId = String(env?.INSTAGRAM_USER_ID || '').trim();

  const state = { lastAppUsage: null, throttledUntil: 0, calls: 0 };

  function requireConfigured() {
    if (!token || !userId) throw new MetaApiError(META_ERROR.NOT_CONFIGURED, { detail: 'INSTAGRAM_ACCESS_TOKEN ou INSTAGRAM_USER_ID absent' });
  }

  function buildUrl(path, params) {
    const clean = String(path || '').replace(/^\/+/, '');
    const url = new URL(`${base}/${version}/${clean}`);
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    url.searchParams.set('access_token', token);
    return url;
  }

  /** Chemin appelable, sans jamais exposer le token. */
  function safeLabel(path) {
    return redactSecrets(String(path || '')).slice(0, 120);
  }

  async function requestOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: redactSecrets(text).slice(0, 300) }; }
      return { response, payload };
    } catch (error) {
      const name = String(error?.name || '');
      if (name === 'AbortError' || name === 'TimeoutError') {
        throw new MetaApiError(META_ERROR.TIMEOUT, { detail: `depassement de ${timeoutMs} ms` });
      }
      throw new MetaApiError(META_ERROR.NETWORK, { detail: redactSecrets(error?.message || 'echec reseau') });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Requete avec repli exponentiel borne sur les erreurs rejouables. */
  async function request(path, params = {}) {
    requireConfigured();
    const url = buildUrl(path, params);
    const label = safeLabel(path);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const wait = state.throttledUntil - now();
      if (wait > 0) await sleep(Math.min(wait, MAX_BACKOFF_MS));

      try {
        state.calls += 1;
        const { response, payload } = await requestOnce(url);
        const usage = readAppUsage(response.headers);
        if (usage !== null) {
          state.lastAppUsage = usage;
          if (usage >= APP_USAGE_PAUSE_THRESHOLD) state.throttledUntil = now() + MAX_BACKOFF_MS;
        }

        if (response.ok) {
          onEvent({ type: 'meta_call', path: label, attempt, status: response.status, app_usage: usage });
          return payload;
        }
        lastError = classifyMetaError(response.status, payload);
      } catch (error) {
        lastError = error instanceof MetaApiError
          ? error
          : new MetaApiError(META_ERROR.UNKNOWN, { detail: redactSecrets(error?.message || '') });
      }

      onEvent({ type: 'meta_error', path: label, attempt, code: lastError.code, retryable: lastError.retryable });
      if (!lastError.retryable || attempt === maxAttempts) break;
      await sleep(backoffDelay(attempt, random));
    }

    throw lastError || new MetaApiError(META_ERROR.UNKNOWN, {});
  }

  /** Pagination bornee. Ne suit jamais plus de `maxPages` pages. */
  async function paginate(path, params = {}, { maxPages = DEFAULT_MAX_PAGES, limit = 25 } = {}) {
    const collected = [];
    let payload = await request(path, { ...params, limit });
    let pages = 1;

    while (true) {
      if (Array.isArray(payload?.data)) collected.push(...payload.data);
      const next = payload?.paging?.cursors?.after;
      if (!next || pages >= maxPages) break;
      payload = await request(path, { ...params, limit, after: next });
      pages += 1;
    }

    return { items: collected, pages, truncated: Boolean(payload?.paging?.cursors?.after) && pages >= maxPages };
  }

  /**
   * Etat du jeton. Ne renvoie jamais le jeton, uniquement un diagnostic.
   * `unknown` est un resultat legitime : on ne devine pas.
   */
  async function checkTokenHealth() {
    if (!token || !userId) return { status: 'not_configured', checked_at: new Date(now()).toISOString(), detail: '' };
    try {
      const payload = await request(userId, { fields: 'id,username' });
      return {
        status: payload?.id ? 'valid' : 'unknown',
        checked_at: new Date(now()).toISOString(),
        username: String(payload?.username || ''),
        detail: '',
      };
    } catch (error) {
      const code = error instanceof MetaApiError ? error.code : META_ERROR.UNKNOWN;
      const map = {
        [META_ERROR.TOKEN_EXPIRED]: 'expired',
        [META_ERROR.UNAUTHORIZED]: 'invalid',
        [META_ERROR.FORBIDDEN]: 'insufficient_permissions',
        [META_ERROR.RATE_LIMITED]: 'unknown',
        [META_ERROR.TIMEOUT]: 'unknown',
        [META_ERROR.NETWORK]: 'unknown',
      };
      return {
        status: map[code] || 'unknown',
        checked_at: new Date(now()).toISOString(),
        detail: error instanceof MetaApiError ? error.detail : '',
        error_code: code,
      };
    }
  }

  return {
    version,
    isConfigured: () => Boolean(token && userId),
    request,
    paginate,
    checkTokenHealth,
    stats: () => ({ calls: state.calls, last_app_usage: state.lastAppUsage }),
  };
}
