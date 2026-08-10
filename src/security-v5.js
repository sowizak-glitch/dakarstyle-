/**
 * SOWHAT Control V5 - Socle de securite des actions sensibles
 *
 * Tout ce qui peut publier, programmer ou depenser passe par ici. Le principe
 * est unique : fail closed. En cas de doute, de configuration absente ou de
 * signature illisible, l action est refusee. Une action sensible ne s execute
 * jamais « par defaut ».
 */

export const SECURITY_ERROR = Object.freeze({
  SAFE_GATE_CLOSED: 'safe_gate_closed',
  CSRF_INVALID: 'csrf_invalid',
  CSRF_EXPIRED: 'csrf_expired',
  CSRF_NOT_CONFIGURED: 'csrf_not_configured',
  MEDIA_INVALID: 'media_invalid',
  IDEMPOTENCY_UNSUPPORTED: 'idempotency_unsupported',
});

/* ------------------------------------------------------------------ */
/* SAFE gate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Portail SAFE. Deux verrous independants doivent etre ouverts pour qu une
 * publication parte :
 *   1. l environnement autorise explicitement la publication ;
 *   2. l element concerne porte une approbation humaine explicite.
 *
 * Une variable absente, vide ou a une valeur inattendue ferme le portail. Il
 * n existe aucune valeur « par defaut ouverte ».
 */
export function checkSafeGate(env, subject = {}) {
  const flag = String(env?.SOWHAT_PUBLISH_ENABLED ?? '').trim().toLowerCase();
  if (flag !== 'true') {
    return {
      allowed: false,
      code: SECURITY_ERROR.SAFE_GATE_CLOSED,
      reason: 'publication desactivee : SOWHAT_PUBLISH_ENABLED n est pas a true',
    };
  }
  if (subject?.safe_approved !== true) {
    return {
      allowed: false,
      code: SECURITY_ERROR.SAFE_GATE_CLOSED,
      reason: 'approbation humaine absente sur cet element',
    };
  }
  return { allowed: true, code: null, reason: '' };
}

export function assertSafeGate(env, subject) {
  const result = checkSafeGate(env, subject);
  if (!result.allowed) {
    const error = new Error(result.code);
    error.code = result.code;
    error.reason = result.reason;
    throw error;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* CSRF                                                                */
/* ------------------------------------------------------------------ */

const CSRF_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Longueur minimale d un secret CSRF exploitable. */
export const CSRF_SECRET_MIN_LENGTH = 32;

/**
 * Emplacement prive du secret amorce. Il est volontairement HORS du prefixe
 * `MEDIA_KEY_PREFIX` : la route publique des medias ne sert que ce prefixe,
 * ce fichier ne peut donc jamais etre servi a personne.
 */
export const CSRF_SECRET_KEY = 'visuals/social-intelligence/v5/csrf-secret.json';

/** Un secret par bucket, garde en memoire de l isolat pour eviter une lecture par requete. */
const secretCache = new WeakMap();

function csrfNotConfigured(detail) {
  const error = new Error(SECURITY_ERROR.CSRF_NOT_CONFIGURED);
  error.code = SECURITY_ERROR.CSRF_NOT_CONFIGURED;
  error.detail = String(detail || '');
  return error;
}

function randomSecret() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function readStoredSecret(bucket) {
  try {
    const object = await bucket.get(CSRF_SECRET_KEY);
    if (!object) return '';
    const parsed = JSON.parse(await object.text());
    const value = String(parsed?.secret || '');
    return value.length >= CSRF_SECRET_MIN_LENGTH ? value : '';
  } catch {
    return '';
  }
}

/**
 * Secret de signature des jetons CSRF.
 *
 * Ordre, sans repli silencieux :
 *   1. `SOCIAL_INTELLIGENCE_CSRF_SECRET` s il est configure et assez long ;
 *   2. sinon un secret amorce UNE SEULE FOIS cote serveur, tire de
 *      `crypto.getRandomValues` et range dans un objet prive du bucket.
 *
 * L amorcage passe par une ecriture conditionnelle. Deux initialisations
 * simultanees ne peuvent donc pas produire deux secrets differents : la
 * seconde perd la course, relit, et adopte celui de la premiere. Sans bucket,
 * sans ecriture conditionnelle ou sans relecture concordante, on REFUSE :
 * un CSRF signe par un secret qui change a chaque requete ne protege rien.
 */
export async function resolveCsrfSecret(env) {
  const configured = String(env?.SOCIAL_INTELLIGENCE_CSRF_SECRET || '').trim();
  if (configured.length >= CSRF_SECRET_MIN_LENGTH) return configured;

  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.get !== 'function' || typeof bucket.put !== 'function') {
    throw csrfNotConfigured('aucun secret configure et aucun stockage pour en amorcer un');
  }

  const cached = secretCache.get(bucket);
  if (cached) return cached;

  const existing = await readStoredSecret(bucket);
  if (existing) {
    secretCache.set(bucket, existing);
    return existing;
  }

  const candidate = randomSecret();
  try {
    await bucket.put(CSRF_SECRET_KEY, JSON.stringify({
      secret: candidate,
      created_at: new Date().toISOString(),
      origin: 'bootstrap',
    }), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
    });
  } catch {
    // L ecriture a peut-etre echoue parce qu une autre execution a gagne :
    // la relecture ci-dessous tranche.
  }

  // On ne fait jamais confiance au resultat de l ecriture : seul ce qui est
  // REELLEMENT stocke fait foi. C est ce qui rend deux amorcages simultanes
  // inoffenifs, et ce qui detecte un stockage qui n ecrit pas vraiment.
  const stored = await readStoredSecret(bucket);
  if (!stored) throw csrfNotConfigured('secret amorce non relu apres ecriture');

  secretCache.set(bucket, stored);
  return stored;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toBase64Url(new Uint8Array(signature));
}

/** Comparaison a duree constante : ne renseigne pas l attaquant sur le prefixe correct. */
export function constantTimeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

/**
 * Jeton CSRF lie a la session et horodate. Il n est pas devinable sans le
 * secret, il expire, et il ne vaut que pour la session qui l a demande :
 * le rejouer depuis une autre session ne sert a rien.
 */
export async function issueCsrfToken(env, sessionId, now = Date.now()) {
  const secret = await resolveCsrfSecret(env);
  if (secret.length < 32) throw csrfNotConfigured('secret trop court');
  const issuedAt = String(now);
  const signature = await hmac(secret, `${sessionId}.${issuedAt}`);
  return `${issuedAt}.${signature}`;
}

export async function verifyCsrfToken(env, sessionId, token, now = Date.now(), maxAgeMs = CSRF_MAX_AGE_MS) {
  let secret;
  try {
    secret = await resolveCsrfSecret(env);
  } catch {
    return { valid: false, code: SECURITY_ERROR.CSRF_NOT_CONFIGURED };
  }
  if (secret.length < 32) return { valid: false, code: SECURITY_ERROR.CSRF_NOT_CONFIGURED };

  const raw = String(token ?? '');
  const separator = raw.indexOf('.');
  if (separator <= 0) return { valid: false, code: SECURITY_ERROR.CSRF_INVALID };

  const issuedAt = Number(raw.slice(0, separator));
  const provided = raw.slice(separator + 1);
  if (!Number.isFinite(issuedAt)) return { valid: false, code: SECURITY_ERROR.CSRF_INVALID };

  const expected = await hmac(secret, `${sessionId}.${issuedAt}`);
  if (!constantTimeEqual(provided, expected)) return { valid: false, code: SECURITY_ERROR.CSRF_INVALID };
  // Un jeton date du futur est aussi suspect qu un jeton perime.
  if (issuedAt > now + 60000) return { valid: false, code: SECURITY_ERROR.CSRF_INVALID };
  if (now - issuedAt > maxAgeMs) return { valid: false, code: SECURITY_ERROR.CSRF_EXPIRED };
  return { valid: true, code: null };
}

/* ------------------------------------------------------------------ */
/* Validation des medias                                               */
/* ------------------------------------------------------------------ */

export const ALLOWED_MEDIA_TYPES = Object.freeze({
  'image/jpeg': { kind: 'IMAGE', maxBytes: 8 * 1024 * 1024, extensions: ['jpg', 'jpeg'] },
  'image/png': { kind: 'IMAGE', maxBytes: 8 * 1024 * 1024, extensions: ['png'] },
  'video/mp4': { kind: 'VIDEO', maxBytes: 100 * 1024 * 1024, extensions: ['mp4'] },
});

export const MEDIA_KEY_PREFIX = 'visuals/social-intelligence/v5/media/';

/** Nom de fichier neutralise : pas de chemin, pas de caractere de controle. */
export function sanitizeFilename(value) {
  const base = String(value ?? '').split(/[\\/]/).pop() || '';
  return base
    .replace(new RegExp('[\\u0000-\\u001F\\u007F]', 'g'), '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 120);
}

/**
 * Valide un media avant toute utilisation. Le type declare doit etre dans
 * l allowlist, la taille doit tenir dans la borne du type, l extension doit
 * correspondre au type declare, et la cle R2 doit rester dans le prefixe V5 :
 * un chemin remontant ailleurs dans le bucket est refuse.
 */
export function validateMedia(media) {
  const errors = [];
  const contentType = String(media?.content_type ?? '').trim().toLowerCase();
  const spec = ALLOWED_MEDIA_TYPES[contentType];
  if (!spec) errors.push(`type de media refuse : ${contentType || 'absent'}`);

  const size = Number(media?.size_bytes);
  if (!Number.isFinite(size) || size <= 0) errors.push('taille de media absente ou invalide');
  else if (spec && size > spec.maxBytes) errors.push(`media trop volumineux : ${size} octets, maximum ${spec.maxBytes}`);

  const filename = sanitizeFilename(media?.filename);
  if (!filename) errors.push('nom de fichier absent ou entierement invalide');
  else if (spec) {
    const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (!spec.extensions.includes(extension)) {
      errors.push(`extension ${extension || 'absente'} incoherente avec le type ${contentType}`);
    }
  }

  const key = String(media?.r2_key ?? '');
  if (!key.startsWith(MEDIA_KEY_PREFIX)) errors.push('cle R2 hors du prefixe autorise');
  else if (key.includes('..') || key.includes('//')) errors.push('cle R2 contenant une remontee de chemin');

  return {
    valid: errors.length === 0,
    code: errors.length ? SECURITY_ERROR.MEDIA_INVALID : null,
    errors,
    normalized: errors.length ? null : { r2_key: key, content_type: contentType, size_bytes: size, filename, kind: spec.kind },
  };
}

/* ------------------------------------------------------------------ */
/* Idempotence                                                         */
/* ------------------------------------------------------------------ */

export const IDEMPOTENCY_PREFIX = 'visuals/social-intelligence/v5/idempotency/';

/**
 * Cle d idempotence METIER : elle depend de ce qui est publie, pas du transport.
 * Deux clics, deux executions de scheduler ou deux rejeux reseau produisent la
 * meme cle et ne peuvent donc pas publier deux fois. Changer reellement le
 * contenu change la cle, ce qui est le comportement attendu.
 */
export async function businessIdempotencyKey(parts) {
  const material = [
    String(parts?.draft_id ?? ''),
    String(parts?.instagram_user_id ?? ''),
    String(parts?.scheduled_for ?? ''),
    String(parts?.media_key ?? ''),
    String(parts?.caption ?? ''),
  ].join(' ');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

/**
 * Reservation atomique d une cle d idempotence.
 *
 * S appuie sur l ecriture conditionnelle de R2 (`onlyIf.etagDoesNotMatch: '*'`),
 * qui echoue si l objet existe deja. Si le binding ne supporte pas l ecriture
 * conditionnelle, on REFUSE l action au lieu de retomber sur un
 * lire-puis-ecrire qui laisserait passer deux publications simultanees.
 */
export async function reserveIdempotencyKey(env, key, payload = {}) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.put !== 'function') {
    return { reserved: false, duplicate: false, code: SECURITY_ERROR.IDEMPOTENCY_UNSUPPORTED, existing: null };
  }
  const objectKey = `${IDEMPOTENCY_PREFIX}${key}.json`;
  const body = JSON.stringify({ key, reserved_at: new Date().toISOString(), ...payload });

  let result;
  try {
    result = await bucket.put(objectKey, body, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
    });
  } catch {
    result = null;
  }

  if (!result) {
    const existing = await readIdempotencyRecord(env, key);
    if (existing) return { reserved: false, duplicate: true, code: null, existing };
    // Ecriture refusee sans objet existant : etat incoherent. Fail closed.
    return { reserved: false, duplicate: false, code: SECURITY_ERROR.IDEMPOTENCY_UNSUPPORTED, existing: null };
  }

  // L ecriture a reussi. Reste a verifier qu elle a reussi POUR LA BONNE
  // RAISON. Un stockage qui ignore `onlyIf` accepterait aussi la seconde
  // ecriture, et deux executions simultanees se croiraient toutes deux
  // gagnantes. On rejoue donc la meme ecriture conditionnelle : si elle passe
  // encore, la condition n est pas honoree et on refuse l action.
  let probe;
  try {
    probe = await bucket.put(objectKey, body, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
    });
  } catch {
    probe = null;
  }
  if (probe) {
    return {
      reserved: false,
      duplicate: false,
      code: SECURITY_ERROR.IDEMPOTENCY_UNSUPPORTED,
      existing: null,
      detail: 'le stockage n honore pas les ecritures conditionnelles : exclusion mutuelle impossible',
    };
  }

  return { reserved: true, duplicate: false, code: null, existing: null };
}

export async function readIdempotencyRecord(env, key) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return null;
  try {
    const object = await bucket.get(`${IDEMPOTENCY_PREFIX}${key}.json`);
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

/** Consigne le resultat definitif associe a une cle deja reservee. */
export async function completeIdempotencyKey(env, key, result) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket) return;
  const existing = (await readIdempotencyRecord(env, key)) || { key };
  await bucket.put(`${IDEMPOTENCY_PREFIX}${key}.json`, JSON.stringify({
    ...existing,
    completed_at: new Date().toISOString(),
    result,
  }), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' } });
}
