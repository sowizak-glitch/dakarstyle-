/**
 * SOWHAT Control V5 - Televersement binaire des medias
 *
 * L operateur choisit un fichier dans sa galerie, ses fichiers ou son appareil
 * photo. Le navigateur envoie le VRAI fichier en `multipart/form-data`. Aucune
 * URL n est jamais demandee a l utilisateur, et aucune URL ne lui est rendue :
 * le stockage est un detail d implementation qui ne remonte pas a l ecran.
 *
 * Trois regles non negociables :
 *
 *   1. Le client ne choisit pas la cle de stockage. Elle est generee cote
 *      serveur avec `crypto.randomUUID()` sous un prefixe fixe. Un client qui
 *      choisit sa cle peut ecraser le media d une autre publication.
 *
 *   2. Le type declare ne fait pas foi. Un fichier HTML renomme `.jpg` porte
 *      un `Content-Type: image/jpeg` parfaitement credible. Seuls les premiers
 *      octets du fichier decident, et ils doivent concorder avec le type
 *      declare ET avec l extension.
 *
 *   3. Le nom de fichier d origine n est jamais utilise comme chemin. Il est
 *      neutralise et conserve uniquement pour l affichage.
 */

import {
  ALLOWED_MEDIA_TYPES, MEDIA_KEY_PREFIX, SECURITY_ERROR, sanitizeFilename, validateMedia,
} from './security-v5.js';

export const UPLOAD_ERROR = Object.freeze({
  METHOD_NOT_ALLOWED: 'media_method_not_allowed',
  NOT_MULTIPART: 'media_not_multipart',
  MALFORMED_FORM: 'media_malformed_form',
  FILE_MISSING: 'media_file_missing',
  FILE_EMPTY: 'media_file_empty',
  TOO_LARGE: 'media_too_large',
  TYPE_REFUSED: 'media_type_refused',
  EXTENSION_MISMATCH: 'media_extension_mismatch',
  SIGNATURE_MISMATCH: 'media_signature_mismatch',
  HOSTILE_CONTENT: 'media_hostile_content',
  STORAGE_UNAVAILABLE: 'media_storage_unavailable',
  STORAGE_FAILED: 'media_storage_failed',
  INVALID: SECURITY_ERROR.MEDIA_INVALID,
});

/** Nom du champ attendu dans le formulaire. Un seul, explicitement. */
export const UPLOAD_FIELD = 'file';

/** Plafond absolu, avant meme de regarder le type : borne la memoire du Worker. */
export const MAX_REQUEST_BYTES = 110 * 1024 * 1024;

/** Au-dela, le corps est transmis en flux plutot que charge entierement. */
export const STREAM_THRESHOLD_BYTES = 8 * 1024 * 1024;

/** Nombre d octets lus pour l analyse de signature. */
export const SIGNATURE_SAMPLE_BYTES = 4096;

/**
 * Extension imposee par le serveur pour chaque type accepte. Le client ne
 * choisit ni la cle, ni l extension : les deux viennent du type reellement
 * detecte dans les octets.
 */
const SERVER_EXTENSION = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
});

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/**
 * Marques ISO-BMFF acceptees. `qt  ` (QuickTime) est volontairement absent :
 * un .mov renomme .mp4 n est pas un MP4 et Meta le refuserait plus loin, au
 * pire moment.
 */
const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso4', 'iso5', 'iso6', 'iso8',
  'mp41', 'mp42', 'mp71', 'avc1', 'mmp4', 'M4V ', 'M4VP', 'dash', 'cmfc',
]);

function ascii(bytes, start, end) {
  let out = '';
  for (let i = start; i < end && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/**
 * Type reel deduit des premiers octets. Renvoie `null` quand rien de connu
 * n est reconnu : l inconnu est refuse, jamais suppose inoffensif.
 */
export function detectContentType(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (view.length >= 3 && view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) return 'image/jpeg';
  if (view.length >= 8 && PNG_MAGIC.every((value, index) => view[index] === value)) return 'image/png';
  if (view.length >= 12 && ascii(view, 4, 8) === 'ftyp') {
    const brand = ascii(view, 8, 12);
    if (MP4_BRANDS.has(brand)) return 'video/mp4';
  }
  return null;
}

/**
 * Nature hostile reconnue explicitement. Ces formats seraient de toute facon
 * refuses faute de signature valide ; les nommer permet de refuser avec une
 * raison exacte plutot qu avec un « format inconnu » vague.
 */
export function detectHostileContent(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const head = ascii(view, 0, Math.min(view.length, 1024)).replace(/^[\s﻿]+/, '').toLowerCase();

  if (view.length >= 2 && view[0] === 0x4D && view[1] === 0x5A) return 'executable';
  if (view.length >= 4 && view[0] === 0x7F && ascii(view, 1, 4) === 'ELF') return 'executable';
  if (view.length >= 4 && view[0] === 0xCA && view[1] === 0xFE && view[2] === 0xBA && view[3] === 0xBE) return 'executable';
  if (view.length >= 2 && view[0] === 0x50 && view[1] === 0x4B) return 'archive';
  if (head.startsWith('#!')) return 'script';
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head')
    || head.startsWith('<body') || head.includes('<script')) return 'html';
  return null;
}

/** Cle de stockage : prefixe fige, identifiant aleatoire, extension serveur. */
export function newMediaKey(contentType, randomUuid) {
  const extension = SERVER_EXTENSION[String(contentType || '').toLowerCase()];
  if (!extension) {
    const error = new Error(UPLOAD_ERROR.TYPE_REFUSED);
    error.code = UPLOAD_ERROR.TYPE_REFUSED;
    throw error;
  }
  const uuid = String(typeof randomUuid === 'function' ? randomUuid() : crypto.randomUUID())
    .replace(/[^A-Za-z0-9-]/g, '')
    .slice(0, 36);
  if (uuid.length < 16) {
    const error = new Error(UPLOAD_ERROR.STORAGE_FAILED);
    error.code = UPLOAD_ERROR.STORAGE_FAILED;
    throw error;
  }
  return `${MEDIA_KEY_PREFIX}${uuid}.${extension}`;
}

/** Nom affichable. Sans extension coherente, on lui en donne une : l affichage
 * ne doit pas suggerer un type different de celui reellement stocke. */
export function displayFilename(rawName, contentType) {
  const extension = SERVER_EXTENSION[contentType];
  const clean = sanitizeFilename(rawName);
  const base = (clean.includes('.') ? clean.slice(0, clean.lastIndexOf('.')) : clean).slice(0, 80);
  const safeBase = base || 'media';
  return `${safeBase}.${extension}`;
}

function fail(status, code, detail = '') {
  return { ok: false, status, error: code, detail: String(detail).slice(0, 200) };
}

/* ------------------------------------------------------------------ */
/* Televersement                                                       */
/* ------------------------------------------------------------------ */

/**
 * Traite un televersement. Renvoie un objet neutre `{ ok, status, ... }` :
 * la couche de routage en fait une Response. L autorisation et le CSRF sont
 * verifies AVANT l appel, par le routeur ; cette fonction ne les remplace pas.
 *
 * Rien n est ecrit dans R2 avant que toutes les verifications soient passees.
 */
export async function handleMediaUpload(request, env, options = {}) {
  if (request.method !== 'POST') return fail(405, UPLOAD_ERROR.METHOD_NOT_ALLOWED);

  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.put !== 'function') {
    return fail(503, UPLOAD_ERROR.STORAGE_UNAVAILABLE, 'VISUALS_BUCKET absent');
  }

  const contentTypeHeader = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentTypeHeader.includes('multipart/form-data')) {
    return fail(415, UPLOAD_ERROR.NOT_MULTIPART, 'un fichier binaire est attendu, pas du JSON');
  }

  // Refus avant lecture : ne pas charger 500 Mo pour decouvrir qu ils sont de trop.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return fail(413, UPLOAD_ERROR.TOO_LARGE, `${declaredLength} octets annonces`);
  }

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    return fail(400, UPLOAD_ERROR.MALFORMED_FORM, error?.message || 'formulaire illisible');
  }

  const file = form.get(UPLOAD_FIELD);
  if (!file || typeof file.arrayBuffer !== 'function') {
    return fail(400, UPLOAD_ERROR.FILE_MISSING, `champ « ${UPLOAD_FIELD} » absent`);
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) return fail(400, UPLOAD_ERROR.FILE_EMPTY);
  if (size > MAX_REQUEST_BYTES) return fail(413, UPLOAD_ERROR.TOO_LARGE, `${size} octets`);

  const declaredType = String(file.type || '').split(';')[0].trim().toLowerCase();
  const spec = ALLOWED_MEDIA_TYPES[declaredType];
  if (!spec) return fail(415, UPLOAD_ERROR.TYPE_REFUSED, declaredType || 'type absent');
  if (size > spec.maxBytes) return fail(413, UPLOAD_ERROR.TOO_LARGE, `${size} octets pour ${declaredType}`);

  // Extension du nom d origine : elle doit deja concorder avec le type declare.
  const originalName = sanitizeFilename(file.name);
  const originalExtension = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
  if (!spec.extensions.includes(originalExtension)) {
    return fail(415, UPLOAD_ERROR.EXTENSION_MISMATCH, `extension « ${originalExtension || 'absente'} » incoherente avec ${declaredType}`);
  }

  // --- Signature reelle : c est ici que le faux JPG tombe ---
  let sample;
  try {
    const slice = typeof file.slice === 'function' ? file.slice(0, SIGNATURE_SAMPLE_BYTES) : file;
    sample = new Uint8Array(await slice.arrayBuffer());
  } catch (error) {
    return fail(400, UPLOAD_ERROR.MALFORMED_FORM, error?.message || 'fichier illisible');
  }
  if (!sample.length) return fail(400, UPLOAD_ERROR.FILE_EMPTY);

  const hostile = detectHostileContent(sample);
  if (hostile) return fail(415, UPLOAD_ERROR.HOSTILE_CONTENT, hostile);

  const realType = detectContentType(sample);
  if (!realType) return fail(415, UPLOAD_ERROR.SIGNATURE_MISMATCH, 'signature de fichier non reconnue');
  if (realType !== declaredType) {
    return fail(415, UPLOAD_ERROR.SIGNATURE_MISMATCH, `contenu reel ${realType}, annonce ${declaredType}`);
  }

  // --- Cle serveur. Le client n a jamais eu voix au chapitre. ---
  let key;
  try {
    key = newMediaKey(realType, options.randomUuid);
  } catch (error) {
    return fail(500, error.code || UPLOAD_ERROR.STORAGE_FAILED, 'generation de cle impossible');
  }

  const media = {
    r2_key: key,
    filename: displayFilename(file.name, realType),
    content_type: realType,
    size_bytes: size,
    kind: spec.kind,
  };

  // Derniere barriere : le media doit passer la validation commune, celle-la
  // meme que la publication rejouera juste avant l envoi a Meta.
  const validation = validateMedia(media);
  if (!validation.valid) {
    return fail(400, UPLOAD_ERROR.INVALID, validation.errors.join(' ; '));
  }

  // --- Ecriture. Flux au-dela du seuil : un Reel ne tient pas en memoire. ---
  try {
    const body = size > STREAM_THRESHOLD_BYTES && typeof file.stream === 'function'
      ? file.stream()
      : await file.arrayBuffer();
    await bucket.put(key, body, {
      httpMetadata: {
        contentType: realType,
        cacheControl: 'public, max-age=31536000, immutable',
        contentDisposition: 'inline',
      },
      customMetadata: {
        uploaded_at: new Date(Number(options.now) || Date.now()).toISOString(),
        original_filename: media.filename,
        origin: 'sowhat-control-v5-studio',
      },
    });
  } catch (error) {
    return fail(502, UPLOAD_ERROR.STORAGE_FAILED, error?.message || 'ecriture R2 refusee');
  }

  // La reponse ne contient aucune URL : l operateur n a rien a copier.
  return { ok: true, status: 201, media: validation.normalized };
}

/* ------------------------------------------------------------------ */
/* Lecture publique : le seul consommateur est Meta                    */
/* ------------------------------------------------------------------ */

/**
 * Chemin public des medias V5. Meta doit pouvoir telecharger le fichier en
 * HTTPS sans authentification : c est une contrainte de l API Graph, pas un
 * choix. Le chemin correspond exactement a la cle R2, ce qui permet a
 * `mediaUrlFor()` de composer l URL sans table de correspondance.
 */
export const V5_PUBLIC_MEDIA_PREFIX = '/sowhat-media/v5/';

export function publicMediaPathForKey(r2Key) {
  const key = String(r2Key || '');
  if (!key.startsWith(MEDIA_KEY_PREFIX)) return '';
  const suffix = key.slice(MEDIA_KEY_PREFIX.length);
  if (!suffix || suffix.includes('..') || suffix.includes('//') || suffix.includes('\\')) return '';
  return `${V5_PUBLIC_MEDIA_PREFIX}${suffix.split('/').map(encodeURIComponent).join('/')}`;
}

export function isV5PublicMediaPath(pathname) {
  return String(pathname || '').startsWith(V5_PUBLIC_MEDIA_PREFIX);
}

/**
 * Sert un media V5 depuis R2. Lecture seule, types verrouilles, aucun sniffing.
 * Un objet dont le type stocke sort de l allowlist n est pas servi : le bucket
 * contient d autres prefixes, et un jour quelqu un y deposera autre chose.
 */
export async function serveV5Media(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { 'cache-control': 'no-store' } });
  }
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.get !== 'function') {
    return new Response('Storage unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }

  const url = new URL(request.url);
  let suffix;
  try {
    suffix = decodeURIComponent(url.pathname.slice(V5_PUBLIC_MEDIA_PREFIX.length));
  } catch {
    return new Response('Bad Request', { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  if (!suffix || suffix.startsWith('/') || suffix.includes('..') || suffix.includes('//') || suffix.includes('\\')) {
    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  const key = `${MEDIA_KEY_PREFIX}${suffix}`;
  if (!key.startsWith(MEDIA_KEY_PREFIX) || key.includes('..') || key.includes('//') || key.includes('\\')) {
    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const object = await bucket.get(key);
  if (!object) return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });

  const storedType = String(object?.httpMetadata?.contentType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MEDIA_TYPES[storedType]) {
    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const headers = new Headers({
    'content-type': storedType,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
    'content-security-policy': "default-src 'none'; sandbox",
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'access-control-allow-origin': '*',
  });
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  if (Number.isFinite(Number(object.size))) headers.set('content-length', String(object.size));

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}
