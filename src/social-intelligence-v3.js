/**
 * SOWHAT Control - Coquille applicative (V4)
 *
 * Ce module reste le point d'entree historique importe par src/router.js.
 * Son nom de fichier est volontairement conserve : le routeur, les tests de
 * contrat et les workflows CI le referencent, et le brief impose la
 * non-regression du branchement existant.
 *
 * Responsabilites :
 *   - routage des chemins /social-intelligence et /api/social-intelligence
 *   - session privee, CSRF, limitation des tentatives de connexion
 *   - studio de publication POST IMAGE / REEL / STORY via le Bridge SAFE
 *   - garde SAFE : preview obligatoire, empreinte, expiration, idempotence
 *   - bibliotheque de visuels lue directement dans le bucket R2 existant
 *
 * Ce module ne fabrique jamais de statistique. Le moteur de mesure reste
 * social-intelligence-v1.js et n'est jamais court-circuite.
 */

import {
  handleSocialIntelligence as handleLegacySocialIntelligence,
  runInstagramSync as runLegacyInstagramSync,
} from './social-intelligence-v1.js';

import {
  PUBLICATION_STATES,
  cleanText,
  renderDashboard,
  renderLogin,
  renderSystemMessage,
} from './social-intelligence-ui-v4.js';

import {
  MEMORY_KEY,
  emptyMemory,
  rememberPublication,
  summarizeMemory,
} from './social-intelligence-memory-v4.js';

const VERSION = '4.0.0';
const BRAIN_KEY = 'visuals/social-intelligence/brain.json';
const HISTORY_KEY = 'visuals/social-intelligence/history.json';
const PUBLICATION_HISTORY_KEY = 'visuals/social-intelligence/publications.json';
const SESSION_PREFIX = 'visuals/social-intelligence/sessions/';
const AUTH_PREFIX = 'visuals/social-intelligence/auth/';
const IDEMPOTENCY_PREFIX = 'visuals/social-intelligence/idempotency/';
const MEDIA_PREFIX = 'visuals/media/';
const MANIFEST_PREFIX = 'visuals/manifest/';
const COOKIE_NAME = '__Host-sowhat_si';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IN_FLIGHT_TTL_MS = 2 * 60 * 1000;
const PUBLICATION_HISTORY_LIMIT = 60;
const LIBRARY_LIMIT = 24;
const DEFAULT_BRIDGE_URL = 'https://n8n.sowhatafrica.com/webhook/sowhat-visual-factory-v4-instagram-safe';
const ALLOWED_PUBLICATION_TYPES = new Set(['POST IMAGE', 'REEL', 'STORY']);
const IMAGE_EXTENSION = /\.(jpe?g|png|webp)(?:\?|#|$)/i;
const VIDEO_EXTENSION = /\.(mp4|mov)(?:\?|#|$)/i;

export const runInstagramSync = runLegacyInstagramSync;

export async function handleSocialIntelligenceV3(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/api/social-intelligence/health') {
    return handleLegacySocialIntelligence(request, env, ctx);
  }
  if (url.pathname === '/api/social-intelligence/refresh') {
    return handleRefresh(request, env, ctx);
  }
  if (url.pathname === '/api/social-intelligence/visuals') {
    return handleVisualLibrary(request, env);
  }
  if (url.pathname === '/api/social-intelligence/publish/preview') {
    return handlePublish(request, env, 'preview');
  }
  if (url.pathname === '/api/social-intelligence/publish/commit') {
    return handlePublish(request, env, 'commit');
  }
  if (url.pathname.startsWith('/api/social-intelligence/')) {
    return handleLegacySocialIntelligence(request, env, ctx);
  }

  if (url.pathname === '/social-intelligence/manifest.webmanifest') return manifestResponse();
  if (url.pathname === '/social-intelligence/sw.js') return serviceWorkerResponse();
  if (url.pathname === '/social-intelligence/icon.svg') return iconResponse();
  if (url.pathname === '/social-intelligence/login') return handleLogin(request, env);
  if (url.pathname === '/social-intelligence/logout') return handleLogout(request, env);
  if (url.pathname === '/social-intelligence' || url.pathname === '/social-intelligence/') {
    return handleApp(request, env);
  }

  return new Response('Not Found', { status: 404, headers: privateHeaders('text/plain; charset=utf-8', '') });
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

async function handleApp(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed();
  const nonce = randomToken(16);

  if (!env.VISUALS_BUCKET) {
    return html(
      renderSystemMessage(
        'Stockage indisponible',
        'Le cockpit reste fermé tant que le stockage privé R2 n’est pas disponible.',
        nonce,
      ),
      503,
      request.method === 'HEAD',
      nonce,
    );
  }

  const url = new URL(request.url);
  const legacyKey = String(url.searchParams.get('k') || '').trim();
  if (legacyKey && await matchesHash(legacyKey, env.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256)) {
    const session = await createSession(env);
    return redirect('/social-intelligence', sessionCookie(session.token));
  }

  const auth = await authenticate(request, env);
  if (!auth.ok) {
    const login = renderLogin({ reason: url.searchParams.get('reason') || '', nonce });
    return html(login, 200, request.method === 'HEAD', nonce);
  }

  const [brain, history, publications, memory] = await Promise.all([
    readJson(env, BRAIN_KEY, emptyBrain()),
    readJson(env, HISTORY_KEY, []),
    readJson(env, PUBLICATION_HISTORY_KEY, []),
    readJson(env, MEMORY_KEY, emptyMemory()),
  ]);

  const body = renderDashboard({
    brain: brain && typeof brain === 'object' ? brain : emptyBrain(),
    history: Array.isArray(history) ? history : [],
    publications: Array.isArray(publications) ? publications.slice(0, 12) : [],
    memory: summarizeMemory(memory),
    flags: {
      insightsConfigured: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID),
      bridgeConfigured: Boolean(bridgeUrl(env)),
      visualFactoryUrl: safeHttps(env.VISUAL_FACTORY_URL),
    },
    csrf: String(auth.session.csrf || ''),
    nonce,
  });

  return html(body, 200, request.method === 'HEAD', nonce);
}

async function handleLogin(request, env) {
  if (request.method === 'GET') return redirect('/social-intelligence');
  if (request.method !== 'POST') return methodNotAllowed();
  const nonce = randomToken(16);
  if (!env.VISUALS_BUCKET) {
    return html(renderLogin({ error: 'Stockage privé indisponible.', nonce }), 503, false, nonce);
  }

  const limiter = await authLimiter(request, env);
  if (!limiter.allowed) {
    const minutes = Math.max(1, Math.ceil((limiter.retryAt - Date.now()) / 60000));
    return html(renderLogin({ error: `Trop de tentatives. Réessayez dans ${minutes} min.`, nonce }), 429, false, nonce);
  }

  let form;
  try { form = await request.formData(); }
  catch { return html(renderLogin({ error: 'Requête invalide.', nonce }), 400, false, nonce); }

  const username = cleanText(form.get('username'), 80).toLowerCase();
  const password = String(form.get('password') || '');
  const expectedUser = cleanText(env.SOCIAL_INTELLIGENCE_LOGIN_USER || 'sowhat', 80).toLowerCase();
  const expectedHash = String(env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256 || '').trim().toLowerCase();
  const validUser = username === expectedUser;
  const validPassword = /^[a-f0-9]{64}$/i.test(expectedHash) && await matchesHash(password, expectedHash);

  if (!validUser || !validPassword) {
    await registerAuthFailure(limiter, env);
    return html(renderLogin({ error: 'Identifiant ou mot de passe incorrect.', nonce }), 401, false, nonce);
  }

  await clearAuthFailures(limiter, env);
  const session = await createSession(env);
  return redirect('/social-intelligence', sessionCookie(session.token));
}

async function handleLogout(request, env) {
  if (request.method !== 'POST') return redirect('/social-intelligence');
  const auth = await authenticate(request, env);
  if (auth.ok) {
    let csrf = '';
    try {
      const form = await request.formData();
      csrf = String(form.get('csrf') || '');
    } catch { csrf = ''; }
    if (timingSafeEqual(csrf, String(auth.session.csrf || ''))) {
      await env.VISUALS_BUCKET.delete(auth.key);
    }
  }
  return redirect('/social-intelligence?reason=logout', clearSessionCookie());
}

async function handleRefresh(request, env, ctx) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!validCsrf(request, auth.session)) return json({ ok: false, error: 'csrf_rejected' }, 403);
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    return json({ ok: false, error: 'instagram_insights_not_configured' }, 503);
  }
  try {
    const result = await runLegacyInstagramSync(env, ctx);
    return json(result, result.ok ? 200 : 503);
  } catch (error) {
    return json({ ok: false, error: 'instagram_sync_failed', detail: errorMessage(error) }, 502);
  }
}

/* ------------------------------------------------------------------ */
/* Bibliotheque de visuels (bucket R2 existant, aucune duplication)    */
/* ------------------------------------------------------------------ */

/**
 * Liste les visuels deja produits par Visual Factory dans le bucket R2.
 * Aucun fichier n'est copie ni re-uploade : le cockpit se contente de
 * reutiliser les URL publiques deja servies par /visuals/media/.
 */
async function handleVisualLibrary(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!validCsrf(request, auth.session)) return json({ ok: false, error: 'csrf_rejected' }, 403);
  if (!env.VISUALS_BUCKET || typeof env.VISUALS_BUCKET.list !== 'function') {
    return json({ ok: false, error: 'storage_unavailable' }, 503);
  }

  const origin = new URL(request.url).origin;
  if (!origin.startsWith('https://')) return json({ ok: false, error: 'insecure_origin' }, 400);

  let listing;
  try {
    listing = await env.VISUALS_BUCKET.list({ prefix: MEDIA_PREFIX, limit: 300 });
  } catch (error) {
    return json({ ok: false, error: 'library_listing_failed', detail: errorMessage(error) }, 502);
  }

  const objects = Array.isArray(listing?.objects) ? listing.objects : [];
  const candidates = objects
    .map((object) => describeVisual(object, origin))
    .filter(Boolean)
    .sort((a, b) => b.uploaded_at - a.uploaded_at)
    .slice(0, LIBRARY_LIMIT);

  const items = await withManifestMetadata(env, candidates);

  return json({
    ok: true,
    count: items.length,
    items: items.map((item) => ({
      name: item.name,
      url: item.url,
      kind: item.kind,
      title: item.title,
      collection: item.collection,
      uploaded_at: new Date(item.uploaded_at).toISOString(),
    })),
  });
}

function describeVisual(object, origin) {
  const key = String(object?.key || '');
  if (!key.startsWith(MEDIA_PREFIX)) return null;
  const name = key.slice(MEDIA_PREFIX.length);
  if (!name || name.includes('/') || name.includes('..')) return null;

  const isImage = IMAGE_EXTENSION.test(name);
  const isVideo = VIDEO_EXTENSION.test(name);
  if (!isImage && !isVideo) return null;

  const uploaded = Date.parse(String(object?.uploaded || ''));
  return {
    name,
    assetId: name.replace(/\.[^.]+$/, ''),
    url: `${origin}/visuals/media/${encodeURIComponent(name)}`,
    kind: isVideo ? 'video' : 'image',
    title: '',
    collection: '',
    uploaded_at: Number.isFinite(uploaded) ? uploaded : 0,
  };
}

/**
 * Complete les visuels avec le titre/collection du manifest SOWHAT Passport
 * lorsqu'il existe. L'absence de manifest n'est pas une erreur.
 */
async function withManifestMetadata(env, candidates) {
  const concurrency = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const item = candidates[index];
      const manifest = await readJson(env, `${MANIFEST_PREFIX}${item.assetId}.json`, null);
      if (manifest && typeof manifest === 'object') {
        item.title = cleanText(manifest.title || '', 80);
        item.collection = cleanText(manifest.collection || '', 60);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
  return candidates;
}

/* ------------------------------------------------------------------ */
/* Studio de publication                                               */
/* ------------------------------------------------------------------ */

async function handlePublish(request, env, mode) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!validCsrf(request, auth.session)) return json({ ok: false, error: 'csrf_rejected' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const normalized = normalizePublication(body);
  if (!normalized.ok) {
    if (mode === 'commit') {
      await appendPublicationHistory(env, publicationHistoryRow({
        data: normalized.partial,
        mode,
        state: PUBLICATION_STATES.DRAFT,
        status: 0,
        detail: normalized.error,
      }));
    }
    return json({ ok: false, error: normalized.error }, 400);
  }

  const data = normalized.data;
  const fingerprint = await publicationFingerprint(data);

  if (mode === 'commit') {
    const previewFresh = auth.session.last_preview_hash === fingerprint
      && Number(auth.session.last_preview_at || 0) > Date.now() - PREVIEW_TTL_MS;
    if (!previewFresh) return json({ ok: false, error: 'preview_required_or_expired' }, 409);
    if (body.confirmed !== true) return json({ ok: false, error: 'explicit_confirmation_required' }, 409);
    if (!data.idempotency_key) return json({ ok: false, error: 'idempotency_key_required' }, 400);
    return commitPublication(request, env, auth, data, fingerprint);
  }

  return previewPublication(env, auth, data, fingerprint);
}

/** Test SAFE : dry_run=true / approved=false. Aucun media ne peut partir. */
async function previewPublication(env, auth, data, fingerprint) {
  const outcome = await callBridge(env, data, 'preview');

  if (!outcome.ok) {
    await appendPublicationHistory(env, publicationHistoryRow({
      data,
      mode: 'preview',
      state: PUBLICATION_STATES.FAILED,
      status: outcome.status,
      detail: outcome.detail,
    }));
    return json({ ok: false, error: outcome.error, status: outcome.status, detail: outcome.detail }, 502);
  }

  auth.session.last_preview_hash = fingerprint;
  auth.session.last_preview_at = Date.now();
  await saveSession(env, auth.key, auth.session);

  await appendPublicationHistory(env, publicationHistoryRow({
    data,
    mode: 'preview',
    state: PUBLICATION_STATES.SAFE_VALIDATED,
    status: outcome.status,
    detail: outcome.detail,
  }));

  return json({
    ok: true,
    mode: 'preview',
    state: PUBLICATION_STATES.SAFE_VALIDATED,
    bridge_status: outcome.status,
    target: '@sowhatafrika',
    publication_type: data.publication_type,
    message: 'Brouillon SAFE accepté. Aucun média n’a été publié.',
  });
}

/** Publication reelle : dry_run=false / approved=true, sous cle d'idempotence. */
async function commitPublication(request, env, auth, data, fingerprint) {
  const claim = await claimIdempotency(env, data.idempotency_key, fingerprint);

  if (claim.state === 'completed') {
    return json({
      ok: true,
      mode: 'commit',
      duplicate: true,
      state: PUBLICATION_STATES.PUBLISHED,
      instagram_media_id: claim.record.instagram_media_id || '',
      publication_type: data.publication_type,
      message: 'Publication déjà transmise avec cette clé. Aucun doublon n’a été créé.',
    });
  }
  if (claim.state === 'in_flight') {
    return json({ ok: false, error: 'publication_already_in_flight' }, 409);
  }
  if (claim.state === 'conflict') {
    return json({ ok: false, error: 'duplicate_publication_rejected' }, 409);
  }

  const pending = publicationHistoryRow({
    data,
    mode: 'commit',
    state: PUBLICATION_STATES.PUBLISHING,
    status: 0,
    detail: 'Demande transmise au Bridge SAFE.',
  });
  await appendPublicationHistory(env, pending);

  const outcome = await callBridge(env, data, 'commit');

  if (!outcome.ok) {
    await updatePublicationHistory(env, pending.id, {
      state: PUBLICATION_STATES.FAILED,
      bridge_status: outcome.status,
      detail: outcome.detail,
      completed_at: new Date().toISOString(),
    });
    await releaseIdempotency(env, data.idempotency_key);
    return json({ ok: false, error: outcome.error, status: outcome.status, detail: outcome.detail }, 502);
  }

  const mediaId = extractInstagramMediaId(outcome.detail);

  await updatePublicationHistory(env, pending.id, {
    state: PUBLICATION_STATES.PUBLISHED,
    bridge_status: outcome.status,
    detail: outcome.detail,
    instagram_media_id: mediaId,
    completed_at: new Date().toISOString(),
  });

  await completeIdempotency(env, data.idempotency_key, fingerprint, mediaId);

  auth.session.last_preview_hash = '';
  auth.session.last_preview_at = 0;
  await saveSession(env, auth.key, auth.session);

  await rememberPublicationInMemory(env, data);

  return json({
    ok: true,
    mode: 'commit',
    state: PUBLICATION_STATES.PUBLISHED,
    bridge_status: outcome.status,
    target: '@sowhatafrika',
    publication_type: data.publication_type,
    instagram_media_id: mediaId,
    message: 'Demande de publication transmise au Bridge SAFE existant.',
  });
}

/** Appel du Bridge SAFE existant. Le contrat de payload est inchange. */
async function callBridge(env, data, mode) {
  const payload = {
    source_workflow: 'SOWHAT — Visual Factory V4',
    asset_id: data.asset_id || `SI-${Date.now().toString(36).toUpperCase()}`,
    asset_url: data.media_url,
    media_url: data.media_url,
    canonical_url: '',
    sha256: '',
    manifest_url: '',
    watermark_applied: null,
    title: data.title,
    collection: data.collection,
    publication_type: data.publication_type,
    caption_hint: data.caption,
    hashtags: data.hashtags,
    alt_text: data.alt_text,
    dry_run: mode === 'preview',
    approved: mode === 'commit',
  };

  try {
    const response = await fetch(bridgeUrl(env), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json,text/plain,*/*' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const detail = cleanText(await response.text(), 1500);
    if (!response.ok) {
      return { ok: false, error: 'bridge_rejected', status: response.status, detail };
    }
    return { ok: true, status: response.status, detail };
  } catch (error) {
    return { ok: false, error: 'bridge_unreachable', status: 0, detail: errorMessage(error) };
  }
}

function bridgeUrl(env) {
  return safeHttps(env.SOWHAT_INSTAGRAM_BRIDGE_URL) || DEFAULT_BRIDGE_URL;
}

/**
 * Extrait l'identifiant media Instagram de la reponse du Bridge.
 * Retourne une chaine vide si aucun identifiant credible n'est present :
 * un identifiant n'est jamais invente.
 */
export function extractInstagramMediaId(detail) {
  const text = String(detail || '').trim();
  if (!text) return '';

  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  if (parsed) {
    const found = searchMediaId(parsed, 0);
    if (found) return found;
  }

  const match = text.match(/"(?:instagram_media_id|ig_media_id|media_id)"\s*:\s*"?(\d{5,30})"?/i);
  return match ? match[1] : '';
}

function searchMediaId(value, depth) {
  if (depth > 4 || !value || typeof value !== 'object') return '';
  const keys = ['instagram_media_id', 'ig_media_id', 'media_id', 'id'];
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && /^\d{5,30}$/.test(candidate)) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate) && String(candidate).length >= 5) {
      return String(candidate);
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      const found = searchMediaId(Array.isArray(nested) ? nested[0] : nested, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

export function normalizePublication(body) {
  const publicationType = cleanText(body?.publication_type || 'POST IMAGE', 30).toUpperCase();
  const mediaUrl = safeHttps(body?.media_url);
  const caption = cleanText(body?.caption, 2000);
  const hashtags = cleanText(body?.hashtags || '#SowhatAfrica #WearTheCulture #Dakar #Senegal', 500);
  const altText = cleanText(body?.alt_text || 'Publication SOWHAT AFRICA.', 400);
  const title = cleanText(body?.title || 'SOWHAT AFRICA', 160);
  const collection = cleanText(body?.collection || '', 120);
  const assetId = cleanText(body?.asset_id || '', 100);
  const idempotencyKey = cleanText(body?.idempotency_key || '', 100).replace(/[^A-Za-z0-9_-]/g, '');

  const partial = { publication_type: publicationType, media_url: mediaUrl, caption, title, collection };

  if (!ALLOWED_PUBLICATION_TYPES.has(publicationType)) {
    return { ok: false, error: 'unsupported_publication_type', partial };
  }
  if (!mediaUrl) return { ok: false, error: 'public_https_media_url_required', partial };
  if (!caption) return { ok: false, error: 'caption_required', partial };
  if (caption.length + (hashtags ? hashtags.length + 1 : 0) > 2200) {
    return { ok: false, error: 'caption_too_long', partial };
  }
  if (publicationType === 'REEL' && !VIDEO_EXTENSION.test(mediaUrl)) {
    return { ok: false, error: 'reel_requires_public_mp4_or_mov', partial };
  }
  if ((publicationType === 'POST IMAGE' || publicationType === 'STORY') && !IMAGE_EXTENSION.test(mediaUrl)) {
    return { ok: false, error: 'image_publication_requires_image_url', partial };
  }
  if (/example\.com|replace-with/i.test(mediaUrl)) {
    return { ok: false, error: 'test_media_url_rejected', partial };
  }

  return {
    ok: true,
    data: {
      publication_type: publicationType,
      media_url: mediaUrl,
      caption,
      hashtags,
      alt_text: altText,
      title,
      collection,
      asset_id: assetId,
      idempotency_key: idempotencyKey,
    },
  };
}

/**
 * L'empreinte ne couvre volontairement PAS la cle d'idempotence : modifier le
 * contenu doit invalider le preview, changer de cle ne doit pas le faire.
 */
async function publicationFingerprint(data) {
  return sha256Text([
    data.publication_type, data.media_url, data.caption, data.hashtags,
    data.alt_text, data.title, data.collection, data.asset_id,
  ].join('\n'));
}

/* ------------------------------------------------------------------ */
/* Idempotence                                                         */
/* ------------------------------------------------------------------ */

/**
 * Reserve une cle d'idempotence AVANT tout appel au Bridge.
 *
 * La reservation utilise une ecriture conditionnelle R2 (`onlyIf`) pour que
 * deux requetes concurrentes ne puissent pas reserver la meme cle. Si le
 * binding ne supporte pas la condition, la lecture prealable reste un garde-fou.
 */
async function claimIdempotency(env, key, fingerprint) {
  if (!env.VISUALS_BUCKET) return { state: 'claimed' };
  const storageKey = await idempotencyKeyPath(key);
  const existing = await readJson(env, storageKey, null);
  const now = Date.now();

  if (existing && typeof existing === 'object') {
    const age = now - Number(existing.started_at || 0);
    if (existing.status === 'completed' && age < IDEMPOTENCY_TTL_MS) {
      if (existing.fingerprint && existing.fingerprint !== fingerprint) {
        return { state: 'conflict', record: existing };
      }
      return { state: 'completed', record: existing };
    }
    if (existing.status === 'in_flight' && age < IN_FLIGHT_TTL_MS) {
      return { state: 'in_flight', record: existing };
    }
  }

  const record = { status: 'in_flight', fingerprint, started_at: now, instagram_media_id: '' };
  const written = await putJsonIfAbsent(env, storageKey, record, Boolean(existing));
  if (!written) return { state: 'in_flight', record };
  return { state: 'claimed', record };
}

async function completeIdempotency(env, key, fingerprint, mediaId) {
  if (!env.VISUALS_BUCKET) return;
  const storageKey = await idempotencyKeyPath(key);
  await putJson(env, storageKey, {
    status: 'completed',
    fingerprint,
    started_at: Date.now(),
    instagram_media_id: String(mediaId || ''),
  });
}

async function releaseIdempotency(env, key) {
  if (!env.VISUALS_BUCKET) return;
  try { await env.VISUALS_BUCKET.delete(await idempotencyKeyPath(key)); } catch { /* best effort */ }
}

async function idempotencyKeyPath(key) {
  return `${IDEMPOTENCY_PREFIX}${await sha256Text(String(key || ''))}.json`;
}

/**
 * Ecriture "creer si absent". Renvoie false quand une autre requete a gagne
 * la course. `allowOverwrite` sert au remplacement d'une reservation perimee.
 */
async function putJsonIfAbsent(env, key, value, allowOverwrite) {
  const options = {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  };
  if (!allowOverwrite) options.onlyIf = { etagDoesNotMatch: '*' };
  try {
    const result = await env.VISUALS_BUCKET.put(key, JSON.stringify(value), options);
    return result !== null;
  } catch {
    return false;
  }
}

async function putJson(env, key, value) {
  await env.VISUALS_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

/* ------------------------------------------------------------------ */
/* Historique de publication                                           */
/* ------------------------------------------------------------------ */

function publicationHistoryRow({ data, mode, state, status, detail }) {
  return {
    id: `PUB-${Date.now().toString(36).toUpperCase()}-${randomToken(4)}`,
    requested_at: new Date().toISOString(),
    completed_at: null,
    mode,
    state,
    accepted: state === PUBLICATION_STATES.SAFE_VALIDATED || state === PUBLICATION_STATES.PUBLISHED,
    bridge_status: Number(status || 0),
    publication_type: data?.publication_type || '',
    media_url: data?.media_url || '',
    title: data?.title || '',
    collection: data?.collection || '',
    caption: data?.caption || '',
    instagram_media_id: '',
    detail: cleanText(detail, 500),
  };
}

async function appendPublicationHistory(env, row) {
  if (!env.VISUALS_BUCKET) return;
  const current = await readJson(env, PUBLICATION_HISTORY_KEY, []);
  const rows = Array.isArray(current) ? current : [];
  rows.unshift(row);
  await putJson(env, PUBLICATION_HISTORY_KEY, rows.slice(0, PUBLICATION_HISTORY_LIMIT));
}

async function updatePublicationHistory(env, id, patch) {
  if (!env.VISUALS_BUCKET) return;
  const current = await readJson(env, PUBLICATION_HISTORY_KEY, []);
  const rows = Array.isArray(current) ? current : [];
  const index = rows.findIndex((row) => row?.id === id);
  if (index < 0) return;
  const merged = { ...rows[index], ...patch };
  merged.accepted = merged.state === PUBLICATION_STATES.SAFE_VALIDATED
    || merged.state === PUBLICATION_STATES.PUBLISHED;
  merged.detail = cleanText(merged.detail, 500);
  rows[index] = merged;
  await putJson(env, PUBLICATION_HISTORY_KEY, rows.slice(0, PUBLICATION_HISTORY_LIMIT));
}

async function rememberPublicationInMemory(env, data) {
  if (!env.VISUALS_BUCKET) return;
  try {
    const current = await readJson(env, MEMORY_KEY, emptyMemory());
    await putJson(env, MEMORY_KEY, rememberPublication(current, data));
  } catch { /* la memoire ne doit jamais faire echouer une publication */ }
}

/* ------------------------------------------------------------------ */
/* Session, authentification, cryptographie                            */
/* ------------------------------------------------------------------ */

async function authenticate(request, env) {
  if (!env.VISUALS_BUCKET) return { ok: false };
  const token = getCookie(request.headers.get('cookie') || '', COOKIE_NAME);
  if (!token || token.length < 32) return { ok: false };
  const key = `${SESSION_PREFIX}${await sha256Text(token)}.json`;
  const session = await readJson(env, key, null);
  if (!session || Number(session.expires_at || 0) <= Date.now()) {
    if (session) await env.VISUALS_BUCKET.delete(key);
    return { ok: false };
  }
  return { ok: true, session, key };
}

async function createSession(env) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const now = Date.now();
  const session = { version: VERSION, created_at: now, expires_at: now + SESSION_TTL_SECONDS * 1000, csrf };
  const key = `${SESSION_PREFIX}${await sha256Text(token)}.json`;
  await saveSession(env, key, session);
  return { token, session };
}

async function saveSession(env, key, session) {
  await putJson(env, key, session);
}

function validCsrf(request, session) {
  const provided = String(request.headers.get('X-SOWHAT-CSRF') || '');
  return Boolean(provided) && timingSafeEqual(provided, String(session?.csrf || ''));
}

async function authLimiter(request, env) {
  const ip = String(request.headers.get('cf-connecting-ip') || 'unknown');
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 120);
  const fingerprint = await sha256Text(`${ip}|${userAgent}`);
  const key = `${AUTH_PREFIX}${fingerprint}.json`;
  const state = await readJson(env, key, { count: 0, window_started_at: Date.now() });
  const now = Date.now();
  if (now - Number(state.window_started_at || 0) > AUTH_WINDOW_MS) {
    return { allowed: true, count: 0, window_started_at: now, retryAt: now + AUTH_WINDOW_MS, key };
  }
  const windowStart = Number(state.window_started_at || now);
  return {
    allowed: Number(state.count || 0) < AUTH_MAX_ATTEMPTS,
    count: Number(state.count || 0),
    window_started_at: windowStart,
    retryAt: windowStart + AUTH_WINDOW_MS,
    key,
  };
}

async function registerAuthFailure(limiter, env) {
  await putJson(env, limiter.key, {
    count: Number(limiter.count || 0) + 1,
    window_started_at: Number(limiter.window_started_at || Date.now()),
  });
}

async function clearAuthFailures(limiter, env) {
  if (limiter?.key) await env.VISUALS_BUCKET.delete(limiter.key);
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}
function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
function getCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}
function randomToken(bytes) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = '';
  for (const value of data) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function matchesHash(value, expectedHash) {
  const expected = String(expectedHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(await sha256Text(String(value || '')), expected);
}
async function sha256Text(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function readJson(env, key, fallback) {
  if (!env.VISUALS_BUCKET) return fallback;
  try {
    const object = await env.VISUALS_BUCKET.get(key);
    if (!object) return fallback;
    return JSON.parse(await object.text());
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Ressources PWA                                                      */
/* ------------------------------------------------------------------ */

function manifestResponse() {
  return new Response(JSON.stringify({
    name: 'SOWHAT Control',
    short_name: 'SOWHAT',
    start_url: '/social-intelligence',
    scope: '/social-intelligence',
    display: 'standalone',
    background_color: '#08080a',
    theme_color: '#0a0a0d',
    description: 'Cockpit privé SOWHAT pour créer, publier et mesurer les contenus Instagram.',
    icons: [{ src: '/social-intelligence/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }), { status: 200, headers: publicAssetHeaders('application/manifest+json; charset=utf-8', 'public, max-age=300') });
}

/**
 * Service worker volontairement minimal : il ne met JAMAIS en cache une
 * reponse du cockpit. Les donnees privees ne doivent pas survivre dans un
 * cache navigateur.
 */
function serviceWorkerResponse() {
  const body = "self.addEventListener('install',function(e){self.skipWaiting()});"
    + "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});"
    + "self.addEventListener('fetch',function(e){var u=new URL(e.request.url);"
    + "if(u.origin===location.origin&&u.pathname.startsWith('/social-intelligence'))"
    + "e.respondWith(fetch(e.request,{cache:'no-store'}))});";
  return new Response(body, { status: 200, headers: publicAssetHeaders('application/javascript; charset=utf-8', 'no-store') });
}

function iconResponse() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop stop-color="#f0d58d"/><stop offset="1" stop-color="#b88f3f"/></linearGradient></defs>'
    + '<rect width="512" height="512" rx="128" fill="#0a0a0d"/>'
    + '<rect x="68" y="68" width="376" height="376" rx="104" fill="url(#g)"/>'
    + '<text x="256" y="305" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="154" fill="#171208">SC</text>'
    + '</svg>';
  return new Response(svg, { status: 200, headers: publicAssetHeaders('image/svg+xml; charset=utf-8', 'public, max-age=86400') });
}

/* ------------------------------------------------------------------ */
/* Reponses et en-tetes                                                */
/* ------------------------------------------------------------------ */

function redirect(location, setCookie = '') {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  if (setCookie) headers.set('set-cookie', setCookie);
  return new Response(null, { status: 303, headers });
}

function html(body, status = 200, headOnly = false, nonce = '') {
  return new Response(headOnly ? null : body, {
    status,
    headers: privateHeaders('text/html; charset=utf-8', nonce),
  });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: privateHeaders('application/json; charset=utf-8', ''),
  });
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: privateHeaders('text/plain; charset=utf-8', ''),
  });
}

/**
 * CSP a nonce. Un document HTML autorise uniquement les scripts et styles
 * portant le nonce de la requete courante ; toute autre reponse interdit
 * completement scripts et styles.
 */
function contentSecurityPolicy(nonce) {
  const scriptSource = nonce ? `'nonce-${nonce}'` : "'none'";
  const styleSource = nonce ? `'nonce-${nonce}'` : "'none'";
  return [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    `style-src ${styleSource}`,
    "img-src 'self' data: https://*.cdninstagram.com https://*.fbcdn.net",
    "media-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

function privateHeaders(contentType, nonce = '') {
  return {
    'content-type': contentType,
    'cache-control': 'no-store, no-cache, must-revalidate',
    pragma: 'no-cache',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': contentSecurityPolicy(nonce),
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'x-sowhat-social-intelligence-version': VERSION,
  };
}

function publicAssetHeaders(contentType, cacheControl) {
  return {
    'content-type': contentType,
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-robots-tag': 'noindex, nofollow, noarchive',
  };
}

/* ------------------------------------------------------------------ */
/* Etat vide                                                           */
/* ------------------------------------------------------------------ */

/**
 * Etat par defaut du cerveau. Toutes les valeurs sont a zero et le message
 * l'assume : aucun score n'est fabrique avant la premiere synchronisation.
 */
function emptyBrain() {
  return {
    version: VERSION,
    updated_at: null,
    sample_count: 0,
    maturity: 'EARLY',
    score: 0,
    score_delta: 0,
    profile: { username: 'sowhatafrika', followers_count: 0 },
    account: {},
    pillars: { attraction: 0, engagement: 0, advocacy: 0, regularity: 0 },
    cadence: { posts_per_week: 0 },
    rankings: { formats: [] },
    top_media: [],
    recent_media: [],
    recommendations: {
      headline: 'Le moteur attend les premières données réelles.',
      summary: 'Aucun score artificiel ne sera affiché avant la première synchronisation.',
      wins: [],
      fixes: [],
      next_actions: [
        'Publier via le Studio SAFE',
        'Connecter le collecteur Insights',
        'Laisser le moteur établir une médiane personnelle',
      ],
    },
    weekly_plan: [],
  };
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'unknown_error');
}
