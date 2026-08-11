/**
 * SOWHAT Control V5 - Client Meta Graph API (Instagram)
 *
 * Couche unique d'acces a l'API Meta. Aucun autre module ne doit appeler
 * graph.facebook.com ou graph.instagram.com directement.
 *
 * Garanties :
 *   - le transport du credential est DETERMINISTE : il decoule du flux Meta
 *     configure, jamais d'une decouverte empirique a l'execution ;
 *   - le token n'est jamais journalise, ni renvoye, ni present dans un message
 *     d'erreur : `redactSecrets` nettoie toute chaine avant sortie ;
 *   - toute erreur Meta est traduite en code stable et explicitement marquee
 *     rejouable ou non ;
 *   - les tentatives sont bornees, avec repli exponentiel et gigue ;
 *   - une ecriture (POST) n'est JAMAIS rejouee a l'aveugle ;
 *   - la pagination est bornee pour ne jamais boucler indefiniment ;
 *   - le temps et le reseau sont injectables, donc entierement testables.
 */

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
  INVALID_ENDPOINT: 'meta_invalid_endpoint',
  INVALID_FLOW: 'meta_invalid_flow',
  UNSAFE_REDIRECT: 'meta_unsafe_redirect',
  UNKNOWN: 'meta_unknown_error',
});

const RETRYABLE = new Set([
  META_ERROR.RATE_LIMITED,
  META_ERROR.SERVER_ERROR,
  META_ERROR.TIMEOUT,
  META_ERROR.NETWORK,
]);

/**
 * Une ecriture rejetee pour quota n'a PAS ete traitee par Meta : elle peut etre
 * retentee sans risque de doublon. Toute autre erreur rejouable (5xx, timeout,
 * panne reseau) est AMBIGUE sur un POST : la creation a peut-etre abouti cote
 * Meta. On ne rejoue donc jamais, c'est l'idempotence metier qui tranche.
 */
const WRITE_RETRYABLE = new Set([META_ERROR.RATE_LIMITED]);

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
    .replace(/IG[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
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

/**
 * Hotes Meta officiels autorises a recevoir le credential. Toute autre
 * destination est refusee : une variable d'environnement mal configuree ne
 * doit jamais pouvoir exfiltrer le token vers un domaine tiers.
 */
export const META_ALLOWED_HOSTS = Object.freeze([
  'graph.facebook.com',
  'graph.instagram.com',
]);

/**
 * Les deux flux officiels Meta. Le choix du flux determine A LA FOIS l'hote
 * Graph et le transport du credential. Il n'existe aucun autre chemin.
 *
 *   - instagram_login  : Instagram API with Instagram Login.
 *                        graph.instagram.com, credential en en-tete Bearer.
 *   - facebook_login   : Instagram API with Facebook Login.
 *                        graph.facebook.com, credential en parametre
 *                        `access_token` (query en lecture, champ de formulaire
 *                        en ecriture pour ne pas ecrire le token dans une URL).
 *
 * Le flux par defaut est `instagram_login` parce que c'est celui que le socle
 * existant utilise deja : `social-intelligence-v1.js` interroge
 * graph.instagram.com avec un en-tete Bearer et lit des metriques
 * (views, total_interactions, accounts_engaged, media_product_type) propres a
 * ce flux. Ce defaut aligne V5 sur l'architecture reelle, il ne la change pas.
 */
export const META_API_FLOW = Object.freeze({
  INSTAGRAM_LOGIN: 'instagram_login',
  FACEBOOK_LOGIN: 'facebook_login',
});

export const META_FLOW_PROFILE = Object.freeze({
  [META_API_FLOW.INSTAGRAM_LOGIN]: Object.freeze({
    flow: META_API_FLOW.INSTAGRAM_LOGIN,
    host: 'graph.instagram.com',
    origin: 'https://graph.instagram.com',
    transport: 'header',
    label: 'Instagram API with Instagram Login',
  }),
  [META_API_FLOW.FACEBOOK_LOGIN]: Object.freeze({
    flow: META_API_FLOW.FACEBOOK_LOGIN,
    host: 'graph.facebook.com',
    origin: 'https://graph.facebook.com',
    transport: 'query',
    label: 'Instagram API with Facebook Login',
  }),
});

export const DEFAULT_META_API_FLOW = META_API_FLOW.INSTAGRAM_LOGIN;

export function isAllowedMetaOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:'
      && META_ALLOWED_HOSTS.includes(url.hostname)
      && url.port === '';
  } catch {
    return false;
  }
}

/**
 * Resout le flux Meta. Fail closed : une valeur inconnue ne retombe pas sur le
 * defaut, elle fait echouer la construction du client. On ne devine jamais le
 * mecanisme d'authentification.
 */
export function resolveApiFlow(env) {
  const configured = String(env?.INSTAGRAM_API_FLOW || '').trim().toLowerCase();
  if (!configured) return DEFAULT_META_API_FLOW;
  if (!Object.prototype.hasOwnProperty.call(META_FLOW_PROFILE, configured)) {
    throw new MetaApiError(META_ERROR.INVALID_FLOW, {
      detail: `flux Meta inconnu : valeurs acceptees ${Object.values(META_API_FLOW).join(', ')}`,
    });
  }
  return configured;
}

/**
 * Transport du credential. Il decoule du flux. Une surcharge explicite reste
 * possible pour couvrir un cas documente par Meta, mais elle doit etre ecrite
 * dans la configuration : jamais decouverte a l'execution, jamais modifiee
 * apres un 401.
 */
export function resolveTokenTransport(env, flow = resolveApiFlow(env)) {
  const override = String(env?.INSTAGRAM_TOKEN_TRANSPORT || '').trim().toLowerCase();
  if (!override) return META_FLOW_PROFILE[flow].transport;
  if (override !== 'header' && override !== 'query') {
    throw new MetaApiError(META_ERROR.INVALID_FLOW, {
      detail: 'transport du credential invalide : header ou query uniquement',
    });
  }
  return override;
}

/**
 * Resout l'origine Graph. Fail closed a deux titres : une origine non
 * autorisee est refusee, et une origine autorisee mais incoherente avec le
 * flux configure est refusee aussi. Une incoherence de configuration doit
 * etre bruyante, pas discrete.
 */
export function resolveGraphOrigin(env, flow = resolveApiFlow(env)) {
  const expected = META_FLOW_PROFILE[flow].origin;
  const configured = String(env?.INSTAGRAM_GRAPH_BASE || '').trim();
  if (!configured) return expected;
  if (!isAllowedMetaOrigin(configured)) {
    throw new MetaApiError(META_ERROR.INVALID_ENDPOINT, {
      detail: `origine Graph refusee : seuls ${META_ALLOWED_HOSTS.join(', ')} en https sans port sont autorises`,
    });
  }
  const origin = new URL(configured).origin;
  if (origin !== expected) {
    throw new MetaApiError(META_ERROR.INVALID_ENDPOINT, {
      detail: `origine Graph incoherente avec le flux ${flow} : ${expected} attendu`,
    });
  }
  return origin;
}

/** Traduit un couple statut/charge utile Meta en erreur stable. */
export function classifyMetaError(status, payload) {
  const error = payload?.error || {};
  const metaCode = Number.isFinite(Number(error.code)) ? Number(error.code) : null;
  const metaSubcode = Number.isFinite(Number(error.error_subcode)) ? Number(error.error_subcode) : null;
  const detail = redactSecrets([
    error.message || '',
    error.error_user_msg || '',
  ].filter(Boolean).join(' — '));
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

  // Flux et transport sont figes ici, une fois pour toutes, avant tout appel.
  const flow = resolveApiFlow(env);
  const transport = resolveTokenTransport(env, flow);

  // Une origine de test ne peut venir QUE du code appelant (tests), jamais de
  // l'environnement, et jamais sans fetch injecte : la production ne peut donc
  // pas ouvrir cette porte par configuration.
  const testOrigin = options.testOrigin && options.fetchImpl && options.fetchImpl !== globalThis.fetch
    ? String(options.testOrigin)
    : '';
  const base = testOrigin || resolveGraphOrigin(env, flow);
  const token = String(env?.INSTAGRAM_ACCESS_TOKEN || '').trim();
  const userId = String(env?.INSTAGRAM_USER_ID || '').trim();

  const state = {
    lastAppUsage: null,
    throttledUntil: 0,
    calls: 0,
    writes: 0,
  };

  function requireConfigured() {
    if (!token || !userId) throw new MetaApiError(META_ERROR.NOT_CONFIGURED, { detail: 'INSTAGRAM_ACCESS_TOKEN ou INSTAGRAM_USER_ID absent' });
  }

  function buildUrl(path, params, { withCredential }) {
    const clean = String(path || '').replace(/^\/+/, '');
    const url = new URL(`${base}/${version}/${clean}`);
    if (!isAllowedMetaOrigin(url.origin) && !testOrigin) {
      throw new MetaApiError(META_ERROR.INVALID_ENDPOINT, { detail: 'origine de requete non autorisee' });
    }
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    if (withCredential && transport === 'query') url.searchParams.set('access_token', token);
    return url;
  }

  function buildHeaders(extra = {}) {
    const headers = { accept: 'application/json', ...extra };
    if (transport === 'header') headers.authorization = `Bearer ${token}`;
    return headers;
  }

  /** Chemin appelable, sans jamais exposer le token. */
  function safeLabel(path) {
    return redactSecrets(String(path || '')).slice(0, 120);
  }

  async function requestOnce(url, { method = 'GET', body = null, extraHeaders = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init = {
        method,
        // Pour FormData, ne jamais poser Content-Type a la main : fetch ajoute
        // la boundary multipart. Les autres transports peuvent fournir un
        // en-tete explicite via extraHeaders.
        headers: buildHeaders(extraHeaders),
        // Jamais de suivi automatique : un 3xx pourrait renvoyer le credential
        // vers un hote non autorise. On refuse, on ne suit pas.
        redirect: 'manual',
        signal: controller.signal,
      };
      if (body) init.body = body;
      const response = await fetchImpl(url.toString(), init);
      if (response.status >= 300 && response.status < 400) {
        const target = response.headers?.get?.('location') || '';
        throw new MetaApiError(META_ERROR.UNSAFE_REDIRECT, {
          status: response.status,
          detail: `redirection refusee vers ${redactSecrets(target).slice(0, 120)}`,
        });
      }
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: redactSecrets(text).slice(0, 300) }; }
      return { response, payload };
    } catch (error) {
      // Une erreur deja classee (redirection refusee, endpoint interdit) ne
      // doit pas etre requalifiee en panne reseau.
      if (error instanceof MetaApiError) throw error;
      const name = String(error?.name || '');
      if (name === 'AbortError' || name === 'TimeoutError') {
        throw new MetaApiError(META_ERROR.TIMEOUT, { detail: `depassement de ${timeoutMs} ms` });
      }
      throw new MetaApiError(META_ERROR.NETWORK, { detail: redactSecrets(error?.message || 'echec reseau') });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Requete de lecture, avec repli exponentiel borne sur les erreurs rejouables. */
  async function request(path, params = {}) {
    requireConfigured();
    const label = safeLabel(path);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const wait = state.throttledUntil - now();
      if (wait > 0) await sleep(Math.min(wait, MAX_BACKOFF_MS));

      const url = buildUrl(path, params, { withCredential: true });
      try {
        state.calls += 1;
        const { response, payload } = await requestOnce(url, { method: 'GET' });
        const usage = readAppUsage(response.headers);
        if (usage !== null) {
          state.lastAppUsage = usage;
          if (usage >= APP_USAGE_PAUSE_THRESHOLD) state.throttledUntil = now() + MAX_BACKOFF_MS;
        }

        if (response.ok) {
          onEvent({ type: 'meta_call', path: label, attempt, status: response.status, app_usage: usage, flow, transport });
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

  /**
   * Ecriture Meta (POST). Deux regles non negociables :
   *   1. le credential ne circule jamais dans l'URL d'une ecriture : en flux
   *      query il part dans le corps de formulaire ;
   *   2. une ecriture n'est rejouee que si Meta l'a explicitement REJETEE sans
   *      la traiter (quota). 5xx, timeout et panne reseau sont ambigus : on
   *      remonte l'erreur, c'est a l'idempotence metier de decider.
   */
  async function mutate(path, fields = {}) {
    requireConfigured();
    const label = safeLabel(path);
    const maxWriteAttempts = Number(options.maxWriteAttempts) > 0 ? Number(options.maxWriteAttempts) : 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxWriteAttempts; attempt += 1) {
      const wait = state.throttledUntil - now();
      if (wait > 0) await sleep(Math.min(wait, MAX_BACKOFF_MS));

      const url = buildUrl(path, {}, { withCredential: false });
      let body;
      let extraHeaders = {};

      if (flow === META_API_FLOW.INSTAGRAM_LOGIN) {
        // La collection officielle Meta pour Instagram Login envoie les
        // champs de creation/publication en multipart/form-data. On s aligne
        // exactement sur ce contrat ; le token reste en Bearer.
        const form = new FormData();
        for (const [key, value] of Object.entries(fields || {})) {
          if (value === undefined || value === null || value === '') continue;
          form.set(key, String(value));
        }
        body = form;
      } else {
        // Facebook Login conserve le transport historique en formulaire URL
        // encode, avec le token dans le corps et jamais dans l URL d ecriture.
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(fields || {})) {
          if (value === undefined || value === null || value === '') continue;
          form.set(key, String(value));
        }
        if (transport === 'query') form.set('access_token', token);
        body = form.toString();
        extraHeaders = { 'content-type': 'application/x-www-form-urlencoded' };
      }

      try {
        state.calls += 1;
        state.writes += 1;
        const { response, payload } = await requestOnce(url, { method: 'POST', body, extraHeaders });
        const usage = readAppUsage(response.headers);
        if (usage !== null) {
          state.lastAppUsage = usage;
          if (usage >= APP_USAGE_PAUSE_THRESHOLD) state.throttledUntil = now() + MAX_BACKOFF_MS;
        }
        if (response.ok) {
          onEvent({ type: 'meta_write', path: label, attempt, status: response.status, app_usage: usage, flow, transport });
          return payload;
        }
        lastError = classifyMetaError(response.status, payload);
      } catch (error) {
        lastError = error instanceof MetaApiError
          ? error
          : new MetaApiError(META_ERROR.UNKNOWN, { detail: redactSecrets(error?.message || '') });
      }

      const replayable = WRITE_RETRYABLE.has(lastError.code);
      onEvent({
        type: 'meta_write_error',
        path: label,
        attempt,
        code: lastError.code,
        retryable: replayable,
        ambiguous: lastError.retryable && !replayable,
      });
      if (!replayable || attempt === maxWriteAttempts) break;
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
   * `unknown` est un resultat legitime : on ne devine pas. Un 401 est une vraie
   * erreur d'authentification, plus jamais un signal de mauvais transport.
   */
  async function checkTokenHealth() {
    if (!token || !userId) return { status: 'not_configured', checked_at: new Date(now()).toISOString(), detail: '', flow };
    try {
      const payload = await request(userId, { fields: 'id,username' });
      return {
        status: payload?.id ? 'valid' : 'unknown',
        checked_at: new Date(now()).toISOString(),
        username: String(payload?.username || ''),
        detail: '',
        flow,
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
        flow,
      };
    }
  }

  return {
    version,
    flow,
    transport,
    isConfigured: () => Boolean(token && userId),
    request,
    mutate,
    paginate,
    checkTokenHealth,
    stats: () => ({
      calls: state.calls,
      writes: state.writes,
      last_app_usage: state.lastAppUsage,
      flow,
      transport,
    }),
    graphOrigin: base,
  };
}
