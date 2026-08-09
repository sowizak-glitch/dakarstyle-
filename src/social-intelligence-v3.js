import {
  handleSocialIntelligence as handleLegacySocialIntelligence,
  runInstagramSync as runLegacyInstagramSync,
} from './social-intelligence-v1.js';

const VERSION = '3.0.0';
const BRAIN_KEY = 'visuals/social-intelligence/brain.json';
const HISTORY_KEY = 'visuals/social-intelligence/history.json';
const PUBLICATION_HISTORY_KEY = 'visuals/social-intelligence/publications.json';
const SESSION_PREFIX = 'visuals/social-intelligence/sessions/';
const AUTH_PREFIX = 'visuals/social-intelligence/auth/';
const COOKIE_NAME = '__Host-sowhat_si';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BRIDGE_URL = 'https://n8n.sowhatafrica.com/webhook/sowhat-visual-factory-v4-instagram-safe';
const ALLOWED_PUBLICATION_TYPES = new Set(['POST IMAGE', 'REEL', 'STORY']);

export const runInstagramSync = runLegacyInstagramSync;

export async function handleSocialIntelligenceV3(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/api/social-intelligence/health') {
    return handleLegacySocialIntelligence(request, env, ctx);
  }
  if (url.pathname === '/api/social-intelligence/refresh') {
    return handleRefresh(request, env, ctx);
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
  if (url.pathname === '/social-intelligence' || url.pathname === '/social-intelligence/') return handleApp(request, env);

  return new Response('Not Found', { status: 404, headers: privateHeaders('text/plain; charset=utf-8') });
}

async function handleApp(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed();
  if (!env.VISUALS_BUCKET) {
    return html(renderSystemMessage('Stockage indisponible', 'Le cockpit reste fermé tant que le stockage privé R2 n’est pas disponible.'), 503, request.method === 'HEAD');
  }

  const url = new URL(request.url);
  const legacyKey = String(url.searchParams.get('k') || '').trim();
  if (legacyKey && await matchesHash(legacyKey, env.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256)) {
    const session = await createSession(env);
    return redirect('/social-intelligence', sessionCookie(session.token));
  }

  const auth = await authenticate(request, env);
  if (!auth.ok) return html(renderLogin({ reason: url.searchParams.get('reason') || '' }), 200, request.method === 'HEAD');

  const [brain, history, publications] = await Promise.all([
    readJson(env, BRAIN_KEY, emptyBrain()),
    readJson(env, HISTORY_KEY, []),
    readJson(env, PUBLICATION_HISTORY_KEY, []),
  ]);

  return html(renderDashboard(brain, history, publications, env, auth.session), 200, request.method === 'HEAD');
}

async function handleLogin(request, env) {
  if (request.method === 'GET') return redirect('/social-intelligence');
  if (request.method !== 'POST') return methodNotAllowed();
  if (!env.VISUALS_BUCKET) return html(renderLogin({ error: 'Stockage privé indisponible.' }), 503);

  const limiter = await authLimiter(request, env);
  if (!limiter.allowed) {
    return html(renderLogin({ error: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil((limiter.retryAt - Date.now()) / 60000))} min.` }), 429);
  }

  let form;
  try { form = await request.formData(); }
  catch { return html(renderLogin({ error: 'Requête invalide.' }), 400); }

  const username = cleanText(form.get('username'), 80).toLowerCase();
  const password = String(form.get('password') || '');
  const expectedUser = cleanText(env.SOCIAL_INTELLIGENCE_LOGIN_USER || 'sowhat', 80).toLowerCase();
  const expectedHash = String(env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256 || '').trim().toLowerCase();
  const validUser = username === expectedUser;
  const validPassword = /^[a-f0-9]{64}$/i.test(expectedHash) && await matchesHash(password, expectedHash);

  if (!validUser || !validPassword) {
    await registerAuthFailure(limiter, env);
    return html(renderLogin({ error: 'Identifiant ou mot de passe incorrect.' }), 401);
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
    try { const form = await request.formData(); csrf = String(form.get('csrf') || ''); } catch {}
    if (timingSafeEqual(csrf, String(auth.session.csrf || ''))) await env.VISUALS_BUCKET.delete(auth.key);
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

async function handlePublish(request, env, mode) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!validCsrf(request, auth.session)) return json({ ok: false, error: 'csrf_rejected' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const normalized = normalizePublication(body);
  if (!normalized.ok) return json({ ok: false, error: normalized.error }, 400);
  const data = normalized.data;
  const fingerprint = await publicationFingerprint(data);

  if (mode === 'commit') {
    const previewFresh = auth.session.last_preview_hash === fingerprint
      && Number(auth.session.last_preview_at || 0) > Date.now() - PREVIEW_TTL_MS;
    if (!previewFresh) return json({ ok: false, error: 'preview_required_or_expired' }, 409);
    if (body.confirmed !== true) return json({ ok: false, error: 'explicit_confirmation_required' }, 409);
  }

  const bridgeUrl = safeHttps(env.SOWHAT_INSTAGRAM_BRIDGE_URL) || DEFAULT_BRIDGE_URL;
  const bridgePayload = {
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

  let bridgeStatus = 0;
  let bridgeText = '';
  try {
    const response = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json,text/plain,*/*' },
      body: JSON.stringify(bridgePayload),
      redirect: 'follow',
    });
    bridgeStatus = response.status;
    bridgeText = cleanText(await response.text(), 1500);
    if (!response.ok) {
      await appendPublicationHistory(env, publicationHistoryRow(data, mode, false, bridgeStatus, bridgeText));
      return json({ ok: false, error: 'bridge_rejected', status: bridgeStatus, detail: bridgeText }, 502);
    }
  } catch (error) {
    await appendPublicationHistory(env, publicationHistoryRow(data, mode, false, 0, errorMessage(error)));
    return json({ ok: false, error: 'bridge_unreachable', detail: errorMessage(error) }, 502);
  }

  if (mode === 'preview') {
    auth.session.last_preview_hash = fingerprint;
    auth.session.last_preview_at = Date.now();
    await saveSession(env, auth.key, auth.session);
  } else {
    auth.session.last_preview_hash = '';
    auth.session.last_preview_at = 0;
    await saveSession(env, auth.key, auth.session);
  }

  await appendPublicationHistory(env, publicationHistoryRow(data, mode, true, bridgeStatus, bridgeText));
  return json({
    ok: true,
    mode,
    bridge_status: bridgeStatus,
    target: '@sowhatafrika',
    publication_type: data.publication_type,
    message: mode === 'preview'
      ? 'Brouillon SAFE accepté. Aucun média n’a été publié.'
      : 'Demande de publication transmise au Bridge SAFE existant.',
  });
}

function normalizePublication(body) {
  const publicationType = cleanText(body?.publication_type || 'POST IMAGE', 30).toUpperCase();
  const mediaUrl = safeHttps(body?.media_url);
  const caption = cleanText(body?.caption, 2000);
  const hashtags = cleanText(body?.hashtags || '#SowhatAfrica #WearTheCulture #Dakar #Senegal', 500);
  const altText = cleanText(body?.alt_text || 'Publication SOWHAT AFRICA.', 400);
  const title = cleanText(body?.title || 'SOWHAT AFRICA', 160);
  const collection = cleanText(body?.collection || '', 120);
  const assetId = cleanText(body?.asset_id || '', 100);

  if (!ALLOWED_PUBLICATION_TYPES.has(publicationType)) return { ok: false, error: 'unsupported_publication_type' };
  if (!mediaUrl) return { ok: false, error: 'public_https_media_url_required' };
  if (!caption) return { ok: false, error: 'caption_required' };
  if (caption.length + (hashtags ? hashtags.length + 1 : 0) > 2200) return { ok: false, error: 'caption_too_long' };
  if (publicationType === 'REEL' && !/\.(mp4|mov)(?:\?|#|$)/i.test(mediaUrl)) return { ok: false, error: 'reel_requires_public_mp4_or_mov' };
  if ((publicationType === 'POST IMAGE' || publicationType === 'STORY') && !/\.(jpe?g|png|webp)(?:\?|#|$)/i.test(mediaUrl)) return { ok: false, error: 'image_publication_requires_image_url' };
  if (/example\.com|replace-with/i.test(mediaUrl)) return { ok: false, error: 'test_media_url_rejected' };

  return { ok: true, data: {
    publication_type: publicationType,
    media_url: mediaUrl,
    caption,
    hashtags,
    alt_text: altText,
    title,
    collection,
    asset_id: assetId,
  } };
}

async function publicationFingerprint(data) {
  return sha256Text([
    data.publication_type, data.media_url, data.caption, data.hashtags,
    data.alt_text, data.title, data.collection, data.asset_id,
  ].join('\n'));
}

function publicationHistoryRow(data, mode, accepted, status, detail) {
  return {
    id: `PUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    requested_at: new Date().toISOString(),
    mode,
    accepted,
    bridge_status: Number(status || 0),
    publication_type: data.publication_type,
    media_url: data.media_url,
    title: data.title,
    collection: data.collection,
    caption: data.caption,
    detail: cleanText(detail, 500),
  };
}

async function appendPublicationHistory(env, row) {
  if (!env.VISUALS_BUCKET) return;
  const current = await readJson(env, PUBLICATION_HISTORY_KEY, []);
  const rows = Array.isArray(current) ? current : [];
  rows.unshift(row);
  await env.VISUALS_BUCKET.put(PUBLICATION_HISTORY_KEY, JSON.stringify(rows.slice(0, 40), null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

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
  await env.VISUALS_BUCKET.put(key, JSON.stringify(session), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

function validCsrf(request, session) {
  const provided = String(request.headers.get('X-SOWHAT-CSRF') || '');
  return Boolean(provided) && timingSafeEqual(provided, String(session?.csrf || ''));
}

async function authLimiter(request, env) {
  const ip = String(request.headers.get('cf-connecting-ip') || 'unknown');
  const ua = String(request.headers.get('user-agent') || '').slice(0, 120);
  const fingerprint = await sha256Text(`${ip}|${ua}`);
  const key = `${AUTH_PREFIX}${fingerprint}.json`;
  const state = await readJson(env, key, { count: 0, window_started_at: Date.now() });
  const now = Date.now();
  if (now - Number(state.window_started_at || 0) > AUTH_WINDOW_MS) {
    return { allowed: true, count: 0, window_started_at: now, retryAt: now + AUTH_WINDOW_MS, key };
  }
  return {
    allowed: Number(state.count || 0) < AUTH_MAX_ATTEMPTS,
    count: Number(state.count || 0),
    window_started_at: Number(state.window_started_at || now),
    retryAt: Number(state.window_started_at || now) + AUTH_WINDOW_MS,
    key,
  };
}

async function registerAuthFailure(limiter, env) {
  await env.VISUALS_BUCKET.put(limiter.key, JSON.stringify({
    count: Number(limiter.count || 0) + 1,
    window_started_at: Number(limiter.window_started_at || Date.now()),
  }), { httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' } });
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
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function matchesHash(value, expectedHash) {
  const expected = String(expectedHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(await sha256Text(String(value || '')), expected);
}
async function sha256Text(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function readJson(env, key, fallback) {
  if (!env.VISUALS_BUCKET) return fallback;
  try {
    const object = await env.VISUALS_BUCKET.get(key);
    if (!object) return fallback;
    return JSON.parse(await object.text());
  } catch { return fallback; }
}

function renderLogin({ error = '', reason = '' } = {}) {
  const status = reason === 'logout' ? 'Session fermée en sécurité.' : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#0a0a0d"><link rel="manifest" href="/social-intelligence/manifest.webmanifest"><link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml"><title>SOWHAT Control · Accès privé</title><style>
:root{color-scheme:dark;--bg:#08080a;--panel:#111116;--line:#2b2923;--txt:#f7f4ec;--muted:#9d9a91;--gold:#d5b56a;--petrol:#3f8f8a;--danger:#ff9a9a;--good:#7dd8b2}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}body{min-height:100dvh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 80% -5%,rgba(213,181,106,.16),transparent 32%),radial-gradient(circle at 10% 20%,rgba(63,143,138,.12),transparent 30%),#08080a}.login{width:min(440px,100%)}.mark{width:64px;height:64px;border-radius:21px;display:grid;place-items:center;background:linear-gradient(145deg,#e2c77e,#b8903f);color:#17130b;font-weight:950;font-size:20px;box-shadow:0 18px 50px rgba(213,181,106,.18)}.eyebrow{margin-top:22px;color:var(--gold);font-weight:850;letter-spacing:.15em;text-transform:uppercase;font-size:11px}.login h1{font-size:clamp(34px,9vw,50px);line-height:.98;letter-spacing:-.05em;margin:10px 0 12px}.lead{color:var(--muted);font-size:15px;line-height:1.55;margin:0 0 22px}.card{padding:20px;border-radius:24px;border:1px solid var(--line);background:linear-gradient(180deg,#15151b,#0f0f14);box-shadow:0 26px 80px rgba(0,0,0,.42)}label{display:block;color:#d4d0c6;font-size:12px;font-weight:760;margin:14px 0 7px}.input{width:100%;height:54px;border-radius:15px;border:1px solid #333128;background:#0b0b0e;color:var(--txt);padding:0 15px;font-size:16px;outline:none}.input:focus{border-color:rgba(213,181,106,.7);box-shadow:0 0 0 4px rgba(213,181,106,.08)}.submit{width:100%;height:56px;border:0;border-radius:16px;margin-top:18px;background:linear-gradient(135deg,#e4ca82,#c29b49);color:#18130a;font-weight:950;font-size:15px;cursor:pointer}.notice{padding:11px 13px;border-radius:13px;margin:0 0 12px;font-size:13px;line-height:1.4}.error{background:rgba(255,154,154,.08);border:1px solid rgba(255,154,154,.2);color:#ffc9c9}.ok{background:rgba(125,216,178,.08);border:1px solid rgba(125,216,178,.2);color:#c8f7e2}.private{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:16px}.private i{width:8px;height:8px;border-radius:50%;background:var(--good)}
</style></head><body><main class="login"><div class="mark">SC</div><div class="eyebrow">SOWHAT · CONTROL</div><h1>Créer. Publier.<br>Mesurer.</h1><p class="lead">Un seul cockpit privé pour piloter la création, la publication Instagram et l’intelligence de contenu.</p><div class="card">${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}${status ? `<div class="notice ok">${escapeHtml(status)}</div>` : ''}<form method="post" action="/social-intelligence/login" autocomplete="on"><label for="username">Identifiant</label><input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="password">Mot de passe</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required><button class="submit" type="submit">Entrer dans le cockpit</button></form></div><div class="private"><i></i><span>Session privée · 30 jours · données non mises en cache</span></div></main><script>if('serviceWorker'in navigator){navigator.serviceWorker.register('/social-intelligence/sw.js').catch(()=>{});}</script></body></html>`;
}

function renderDashboard(brainValue, historyValue, publicationValue, env, session) {
  const brain = brainValue && typeof brainValue === 'object' ? brainValue : emptyBrain();
  const history = Array.isArray(historyValue) ? historyValue : [];
  const publications = Array.isArray(publicationValue) ? publicationValue.slice(0, 12) : [];
  const score = clamp(Math.round(finite(brain.score)), 0, 100);
  const delta = Number(brain.score_delta || 0);
  const pillars = brain.pillars || {};
  const topMedia = Array.isArray(brain.top_media) ? brain.top_media : [];
  const formats = Array.isArray(brain.rankings?.formats) ? brain.rankings.formats : [];
  const plan = Array.isArray(brain.weekly_plan) ? brain.weekly_plan : [];
  const rec = brain.recommendations || emptyBrain().recommendations;
  const insightsConfigured = Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID);
  const bridgeConfigured = Boolean(safeHttps(env.SOWHAT_INSTAGRAM_BRIDGE_URL) || DEFAULT_BRIDGE_URL);
  const username = cleanText(brain.profile?.username || 'sowhatafrika', 80);
  const followers = finite(brain.profile?.followers_count);
  const samples = finite(brain.sample_count);
  const recent = Array.isArray(brain.recent_media) ? brain.recent_media : [];
  const csrf = String(session?.csrf || '');
  const lastSync = brain.updated_at ? dateRelative(brain.updated_at) : 'jamais';
  const scoreSeries = history.slice(0, 16).reverse().map((x) => clamp(finite(x.score), 0, 100));
  const visualFactoryUrl = safeHttps(env.VISUAL_FACTORY_URL);

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#0a0a0d"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/social-intelligence/manifest.webmanifest"><link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml"><title>SOWHAT Control</title><style>
:root{color-scheme:dark;--bg:#08080a;--bg2:#0d0d11;--panel:#121217;--panel2:#17171d;--line:#2d2a23;--line2:#3b372c;--txt:#f6f2e9;--soft:#d6d1c5;--muted:#96938b;--gold:#d5b56a;--gold2:#f0d58d;--petrol:#4b9f99;--good:#76d8ad;--warn:#efc86d;--danger:#ff9b9b;--shadow:0 22px 70px rgba(0,0,0,.34)}*{box-sizing:border-box}html{background:var(--bg);-webkit-text-size-adjust:100%;scroll-behavior:smooth}body{margin:0;min-height:100dvh;overflow-x:hidden;color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 90% -8%,rgba(213,181,106,.14),transparent 29%),radial-gradient(circle at 4% 16%,rgba(75,159,153,.10),transparent 26%),linear-gradient(180deg,#0b0b0e,#08080a 55%)}button,a,input,textarea,select{font:inherit}button{touch-action:manipulation}.app{width:min(1500px,100%);margin:0 auto;min-height:100dvh}.rail{display:none}.main{width:100%;min-width:0;padding:12px 12px calc(94px + env(safe-area-inset-bottom))}.topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0 11px;background:linear-gradient(180deg,rgba(8,8,10,.98),rgba(8,8,10,.88) 70%,transparent);backdrop-filter:blur(18px)}.identity{display:flex;align-items:center;gap:9px;min-width:0}.avatar{width:40px;height:40px;flex:0 0 40px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#e0c47a,#b88f3f);color:#171208;font-weight:950}.identityText{min-width:0}.identityText strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.identityText small{display:block;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}.topActions{display:flex;align-items:center;gap:7px}.topBtn{min-height:40px;border-radius:13px;border:1px solid var(--line);background:#121217;color:var(--soft);padding:0 11px;font-size:11px;font-weight:850;cursor:pointer}.topBtn.gold{background:linear-gradient(135deg,#e2c77e,#c19a49);border:0;color:#18130a}.topBtn:disabled{opacity:.5;cursor:not-allowed}.desktopLogout{display:none}.statusStrip{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding:2px 0 11px}.statusStrip::-webkit-scrollbar{display:none}.statusChip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:rgba(18,18,23,.86);color:var(--soft);font-size:10px;font-weight:780}.sdot{width:7px;height:7px;border-radius:50%;background:var(--good)}.sdot.warn{background:var(--warn)}.view{display:none;min-width:0}.view.active{display:block}.hero{padding:22px 18px;border:1px solid var(--line);border-radius:23px;background:linear-gradient(155deg,#18181e,#0f0f14 70%);position:relative;overflow:hidden;box-shadow:var(--shadow)}.hero:after{content:"";position:absolute;right:-85px;top:-105px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(213,181,106,.18),transparent 68%)}.eyebrow{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero h1{font-size:clamp(34px,10vw,48px);line-height:.98;letter-spacing:-.055em;margin:12px 0 12px;max-width:760px}.hero p{color:var(--muted);font-size:14px;line-height:1.55;margin:0;max-width:700px}.heroActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.cta{min-height:48px;border-radius:14px;border:1px solid var(--line);padding:0 15px;background:#15151b;color:var(--soft);font-weight:900;cursor:pointer}.cta.gold{border:0;background:linear-gradient(135deg,#e3ca84,#bd9341);color:#181208}.cta.petrol{border-color:rgba(75,159,153,.35);background:rgba(75,159,153,.11);color:#a8e1dd}.scoreRow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;margin-top:11px}.scoreBox,.metric,.panel,.publishPanel,.historyCard,.connectionCard{border:1px solid var(--line);background:linear-gradient(180deg,#141419,#0f0f14);border-radius:19px}.scoreBox{padding:15px;display:grid;place-items:center}.ring{--score:${score};width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--gold) calc(var(--score)*1%),#25231d 0);position:relative}.ring:before{content:"";position:absolute;inset:7px;border-radius:50%;background:#0c0c10}.ring strong{position:relative;font-size:26px;letter-spacing:-.05em}.scoreInfo{padding:15px}.scoreInfo strong{font-size:15px}.scoreInfo p{color:var(--muted);font-size:11px;line-height:1.5;margin:6px 0 0}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.metric{padding:13px}.metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em}.metric b{display:block;font-size:21px;margin-top:6px}.grid2{display:grid;grid-template-columns:1fr;gap:9px;margin-top:9px}.panel{padding:16px}.panel h2{margin:0;font-size:16px}.panelSub{color:var(--muted);font-size:10px;margin-top:3px}.pillars{display:grid;gap:12px;margin-top:14px}.prow{display:grid;grid-template-columns:88px minmax(0,1fr) 32px;gap:8px;align-items:center}.prow span{font-size:11px}.track{height:8px;border-radius:99px;background:#25231d;overflow:hidden}.fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--petrol),var(--gold))}.coachLead{margin-top:12px;padding:14px;border:1px solid rgba(213,181,106,.22);border-radius:15px;background:rgba(213,181,106,.055)}.coachLead strong{font-size:14px}.coachLead p{color:var(--muted);font-size:11px;line-height:1.5}.sectionHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:6px 0 13px}.sectionHead h1{margin:0;font-size:30px;letter-spacing:-.04em}.sectionHead p{margin:4px 0 0;color:var(--muted);font-size:11px}.mediaGrid,.coachGrid,.planGrid,.connectionGrid,.historyGrid{display:grid;grid-template-columns:1fr;gap:9px}.mediaCard,.coachBox,.planCard{padding:15px;border:1px solid var(--line);border-radius:18px;background:#121217}.mediaTop{display:flex;justify-content:space-between;gap:10px}.badge{display:inline-flex;align-items:center;min-height:27px;padding:0 9px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:9px;font-weight:850}.badge.score{color:var(--gold);border-color:rgba(213,181,106,.24)}.hook{font-weight:850;font-size:13px;margin:10px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.miniMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.mini{padding:7px 4px;text-align:center;border-radius:10px;background:#0c0c10}.mini b{display:block;font-size:11px}.mini small{font-size:8px;color:var(--muted)}.openLink{display:inline-flex;margin-top:10px;color:var(--gold2);font-size:10px;text-decoration:none;font-weight:850}.empty{padding:30px 16px;border:1px dashed var(--line2);border-radius:18px;text-align:center;color:var(--muted);font-size:12px;line-height:1.55}.coachBox h3,.connectionCard h3,.publishPanel h2{margin:0;font-size:15px}.coachBox ul{margin:10px 0 0;padding-left:17px;color:var(--soft)}.coachBox li{font-size:11px;line-height:1.5;margin:7px 0}.planCard .day{color:var(--gold);font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.planCard .ptype{font-size:17px;font-weight:950;margin-top:7px}.planCard p{color:var(--muted);font-size:11px;line-height:1.5}.publishLayout{display:grid;grid-template-columns:1fr;gap:10px}.publishPanel{padding:17px}.formatPicker{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.formatBtn{min-height:62px;border:1px solid var(--line);border-radius:14px;background:#0d0d11;color:var(--muted);font-size:10px;font-weight:850;cursor:pointer}.formatBtn[aria-pressed="true"]{border-color:rgba(213,181,106,.55);background:rgba(213,181,106,.09);color:var(--gold2)}.field{margin-top:12px}.field label{display:flex;justify-content:space-between;gap:8px;color:var(--soft);font-size:10px;font-weight:800;margin-bottom:6px}.field input,.field textarea{width:100%;border:1px solid var(--line);border-radius:13px;background:#0b0b0e;color:var(--txt);padding:12px;outline:none}.field input{height:47px}.field textarea{min-height:96px;resize:vertical;line-height:1.45}.field input:focus,.field textarea:focus{border-color:rgba(213,181,106,.55);box-shadow:0 0 0 3px rgba(213,181,106,.06)}.counter{color:var(--muted);font-weight:650}.publishActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.publishBtn{min-height:50px;border-radius:14px;border:1px solid var(--line);background:#15151b;color:var(--soft);font-weight:900;cursor:pointer}.publishBtn.preview{border-color:rgba(75,159,153,.35);color:#a8e1dd}.publishBtn.commit{border:0;background:linear-gradient(135deg,#e3ca84,#bd9341);color:#181208}.publishBtn:disabled{opacity:.45;cursor:not-allowed}.publishNotice{margin-top:12px;padding:11px;border-radius:13px;border:1px solid var(--line);background:#0d0d11;color:var(--muted);font-size:10px;line-height:1.5}.historyCard{padding:14px}.historyTop{display:flex;justify-content:space-between;gap:8px}.historyCard strong{font-size:12px}.historyCard p{font-size:10px;color:var(--muted);line-height:1.45;margin:7px 0}.historyState{font-size:9px;font-weight:850;color:var(--good)}.historyState.warn{color:var(--warn)}.connectionCard{padding:16px}.connectionCard p{color:var(--muted);font-size:11px;line-height:1.5}.connState{display:inline-flex;align-items:center;gap:7px;margin-top:8px;font-size:10px;font-weight:850;color:var(--good)}.connState.warn{color:var(--warn)}.bottomNav{position:fixed;z-index:80;display:grid;grid-template-columns:repeat(6,1fr);left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:6px;border:1px solid var(--line);border-radius:20px;background:rgba(13,13,17,.96);backdrop-filter:blur(24px);box-shadow:0 18px 58px rgba(0,0,0,.52)}.bottomNav button{border:0;background:transparent;color:var(--muted);min-height:54px;border-radius:14px;padding:5px 2px;font-size:8px;font-weight:800;cursor:pointer}.bottomNav button span{display:block;font-size:15px;line-height:1.15;margin-bottom:3px}.bottomNav button[aria-selected="true"]{background:rgba(213,181,106,.09);color:var(--gold2)}.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(86px + env(safe-area-inset-bottom));z-index:100;width:min(92vw,520px);padding:11px 14px;border-radius:13px;background:#17171d;border:1px solid var(--line2);color:var(--soft);font-size:11px;box-shadow:0 18px 50px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.2s}.toast.show{opacity:1}.install{display:none}
@media(min-width:700px){.main{padding:18px 20px 100px}.hero{padding:28px}.metrics{grid-template-columns:repeat(4,1fr)}.grid2,.publishLayout{grid-template-columns:1fr 1fr}.mediaGrid,.coachGrid,.connectionGrid,.historyGrid{grid-template-columns:repeat(2,1fr)}.planGrid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1200px) and (hover:hover) and (pointer:fine){.app{display:grid;grid-template-columns:238px minmax(0,1fr)}.rail{display:block;position:sticky;top:0;height:100dvh;padding:24px 17px;border-right:1px solid var(--line);background:rgba(8,8,10,.78);backdrop-filter:blur(24px)}.railBrand{display:flex;align-items:center;gap:10px;margin-bottom:24px}.railBrand i{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-style:normal;font-weight:950;background:linear-gradient(145deg,#e2c77e,#b8903f);color:#17130b}.railBrand small{display:block;color:var(--muted);font-size:10px}.railNav{display:grid;gap:7px}.railNav button{min-height:46px;border:0;border-radius:14px;background:transparent;color:var(--muted);text-align:left;padding:0 12px;font-weight:800;cursor:pointer}.railNav button[aria-selected="true"]{background:rgba(213,181,106,.09);color:var(--gold2)}.railFoot{position:absolute;bottom:22px;left:17px;right:17px;padding:13px;border:1px solid var(--line);border-radius:15px;color:var(--muted);font-size:10px;line-height:1.5}.main{padding:22px 36px 60px}.bottomNav{display:none}.desktopLogout{display:block}.hero h1{font-size:60px}.mediaGrid{grid-template-columns:repeat(3,1fr)}.planGrid{grid-template-columns:repeat(4,1fr)}.historyGrid{grid-template-columns:repeat(3,1fr)}}
@media(hover:none) and (pointer:coarse){.rail{display:none!important}.app{display:block!important}.main{padding-left:12px!important;padding-right:12px!important}.bottomNav{display:grid!important}}
@media(max-width:480px){.topActions .topBtn:not(.gold){display:none}.hero h1{font-size:39px}.scoreRow{grid-template-columns:104px minmax(0,1fr)}.formatPicker{gap:5px}.formatBtn{font-size:9px}.bottomNav button{font-size:7.5px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style></head><body><div class="app"><aside class="rail"><div class="railBrand"><i>SC</i><div><strong>SOWHAT</strong><small>CONTROL 3.0</small></div></div><nav class="railNav" aria-label="Navigation bureau">${desktopNav('overview','Vue d’ensemble',true)}${desktopNav('publish','Publier')}${desktopNav('contents','Contenus')}${desktopNav('coach','Coach')}${desktopNav('plan','Plan 7 jours')}${desktopNav('connections','Connexions')}</nav><div class="railFoot">Publication via Bridge SAFE existant.<br>Analytics : ${insightsConfigured ? 'connecté' : 'en attente de token serveur'}.</div></aside><main class="main"><header class="topbar"><div class="identity"><div class="avatar">SA</div><div class="identityText"><strong>SOWHAT AFRICA</strong><small>@${escapeHtml(username)} · ${formatNumber(followers)} abonnés · ${formatNumber(samples)} analysés</small></div></div><div class="topActions"><button class="topBtn install" id="installBtn" type="button">Installer</button><button class="topBtn gold" type="button" data-target="publish">Publier</button><form class="desktopLogout" method="post" action="/social-intelligence/logout"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button class="topBtn" type="submit">Sortir</button></form></div></header><div class="statusStrip"><span class="statusChip"><i class="sdot"></i>Bridge SAFE connecté</span><span class="statusChip"><i class="sdot ${insightsConfigured ? '' : 'warn'}"></i>Insights ${insightsConfigured ? 'actifs' : 'à finaliser'}</span><span class="statusChip"><i class="sdot"></i>Session privée</span><span class="statusChip"><i class="sdot"></i>Mobile optimisé</span></div>
<section class="view active" data-view="overview"><article class="hero"><div class="eyebrow">SOWHAT CONTROL · 2026</div><h1>Créer. Publier.<br>Mesurer. Recommencer.</h1><p>Le cockpit unifie désormais la publication Instagram, le suivi des performances, le coach et le plan d’action. Le Bridge SAFE déjà installé reste inchangé : cette interface vient se brancher dessus sans casser les autres usages.</p><div class="heroActions"><button class="cta gold" type="button" data-target="publish">Créer une publication</button><button class="cta petrol" type="button" data-target="contents">Voir les performances</button>${visualFactoryUrl ? `<a class="cta" href="${escapeHtml(visualFactoryUrl)}" target="_blank" rel="noopener">Ouvrir Visual Factory ↗</a>` : ''}</div></article><div class="scoreRow"><div class="scoreBox"><div class="ring"><strong>${score}</strong></div></div><div class="scoreInfo"><div class="eyebrow">Score SOWHAT</div><strong>${score}/100 · ${delta >= 0 ? '+' : ''}${Math.round(delta)} au dernier cycle</strong><p>Calculé par rapport aux performances propres du compte. Dernière analyse : ${escapeHtml(lastSync)}.</p></div></div><div class="metrics">${metric('Vues suivies',sum(recent,'views'))}${metric('Portée',sum(recent,'reach'))}${metric('Interactions',sum(recent,'total_interactions'))}${metric('Cadence',brain.cadence?.posts_per_week||0)}</div><div class="grid2"><article class="panel"><h2>Les 4 leviers</h2><div class="panelSub">Attraction, engagement, partages et régularité</div><div class="pillars">${pillar('Attraction',pillars.attraction)}${pillar('Engagement',pillars.engagement)}${pillar('Partages',pillars.advocacy)}${pillar('Régularité',pillars.regularity)}</div></article><article class="panel"><h2>Décision du coach</h2><div class="coachLead"><strong>${escapeHtml(rec.headline || 'Le moteur attend les premières données.')}</strong><p>${escapeHtml(rec.summary || '')}</p></div></article></div></section>
<section class="view" data-view="publish"><div class="sectionHead"><div><h1>Studio de publication</h1><p>POST · REEL · STORY via le Bridge SAFE existant.</p></div></div><div class="publishLayout"><article class="publishPanel"><h2>1. Préparer le contenu</h2><div class="formatPicker">${formatButton('POST IMAGE','Post',true)}${formatButton('REEL','Reel')}${formatButton('STORY','Story')}</div><div class="field"><label for="mediaUrl"><span>URL média publique HTTPS</span><span class="counter" id="mediaHint">JPG/PNG/WebP</span></label><input id="mediaUrl" inputmode="url" autocomplete="off" placeholder="https://.../visuel.jpg"></div><div class="field"><label for="caption"><span>Légende</span><span class="counter" id="captionCount">0/2000</span></label><textarea id="caption" placeholder="Message principal de la publication"></textarea></div><div class="field"><label for="hashtags"><span>Hashtags</span><span class="counter">optionnel</span></label><input id="hashtags" value="#SowhatAfrica #WearTheCulture #Dakar #Senegal"></div><div class="field"><label for="altText"><span>Texte alternatif</span><span class="counter">accessibilité</span></label><input id="altText" value="Publication SOWHAT AFRICA."></div><div class="field"><label for="pubTitle"><span>Titre interne</span><span class="counter">cockpit</span></label><input id="pubTitle" value="SOWHAT AFRICA"></div><div class="field"><label for="collection"><span>Collection</span><span class="counter">optionnel</span></label><input id="collection" placeholder="Ex. Summer Winners"></div><div class="publishActions"><button class="publishBtn preview" id="previewBtn" type="button">Tester en SAFE</button><button class="publishBtn commit" id="publishBtn" type="button" disabled>Publier maintenant</button></div><div class="publishNotice" id="publishNotice">Sécurité : un test SAFE est obligatoire avant chaque publication réelle. Le test envoie <b>dry_run=true / approved=false</b>. Le bouton Publier s’ouvre seulement après ce test, puis envoie <b>dry_run=false / approved=true</b>.</div></article><article class="publishPanel"><h2>2. Contrôle & historique</h2><div class="panelSub">La connexion existante reste inchangée.</div><div style="margin-top:14px" class="connectionCard"><h3>Instagram Bridge V2</h3><div class="connState"><span class="sdot"></span>@sowhatafrika · POST / REEL / STORY</div><p>Source imposée : <b>SOWHAT — Visual Factory V4</b>. L’URL privée de preview n’est jamais utilisée. Les contrôles du workflow n8n existant restent actifs.</p></div><div style="margin-top:9px" class="connectionCard"><h3>Suivi</h3><div class="connState ${insightsConfigured ? '' : 'warn'}"><span class="sdot ${insightsConfigured ? '' : 'warn'}"></span>${insightsConfigured ? 'Insights Instagram actifs' : 'Publication active · insights Cloudflare à finaliser'}</div><p>${insightsConfigured ? 'Après publication, utilise Actualiser dans Connexions pour récupérer les nouvelles performances.' : 'Le pipeline de publication peut fonctionner via n8n même si le collecteur Insights du Worker n’a pas encore son token Instagram serveur.'}</p></div><div class="historyGrid" style="margin-top:10px">${publications.length ? publications.slice(0,6).map(historyCard).join('') : '<div class="empty">Aucune action de publication enregistrée depuis ce cockpit.</div>'}</div></article></div></section>
<section class="view" data-view="contents"><div class="sectionHead"><div><h1>Contenus</h1><p>Performance publication par publication.</p></div></div>${topMedia.length ? `<div class="mediaGrid">${topMedia.map(mediaCard).join('')}</div>` : emptyState('Aucun contenu analysé pour le moment.','La grille se remplira dès qu’une synchronisation Insights réussira.')}</section>
<section class="view" data-view="coach"><div class="sectionHead"><div><h1>Coach SOWHAT</h1><p>Ce qui fonctionne, ce qui doit être corrigé et ce qu’il faut tester.</p></div></div><div class="coachGrid">${coachBox('Priorité', [rec.headline, rec.summary], 'Analyse en attente.')}${coachBox('Ce qui fonctionne', rec.wins, 'Les signaux gagnants apparaîtront ici.')}${coachBox('À corriger', rec.fixes, 'Les points de friction apparaîtront ici.')}${coachBox('Actions prioritaires', rec.next_actions, 'Les prochaines actions seront calculées ici.')}${coachBox('Formats', formats.map(x=>`${x.key}: ${x.avg_score}/100 sur ${x.n} contenu${x.n>1?'s':''}`), 'Pas encore assez de données.')}</div></section>
<section class="view" data-view="plan"><div class="sectionHead"><div><h1>Plan 7 jours</h1><p>Un plan court et directement exploitable.</p></div></div>${plan.length ? `<div class="planGrid">${plan.map(planCard).join('')}</div>` : emptyState('Le plan se construit après l’analyse.','Le moteur transformera les meilleurs signaux en calendrier d’action.')}</section>
<section class="view" data-view="connections"><div class="sectionHead"><div><h1>Connexions</h1><p>État réel de chaque brique du système.</p></div></div><div class="connectionGrid"><article class="connectionCard"><h3>Publication Instagram</h3><div class="connState"><span class="sdot"></span>${bridgeConfigured ? 'Bridge SAFE disponible' : 'Bridge indisponible'}</div><p>Le cockpit appelle le workflow existant sans le remplacer. POST IMAGE, REEL et STORY restent protégés par dry_run / approved.</p><button class="cta gold" type="button" data-target="publish">Ouvrir le studio</button></article><article class="connectionCard"><h3>Insights Instagram</h3><div class="connState ${insightsConfigured ? '' : 'warn'}"><span class="sdot ${insightsConfigured ? '' : 'warn'}"></span>${insightsConfigured ? 'Connecté côté Worker' : 'Token serveur non présent'}</div><p>${insightsConfigured ? `Dernière analyse : ${escapeHtml(lastSync)}.` : 'Le cockpit n’invente aucune donnée. Les statistiques restent à zéro tant que le token Insights n’est pas disponible dans le runtime Cloudflare.'}</p>${insightsConfigured ? '<button class="cta petrol" id="refreshBtn" type="button">Actualiser les statistiques</button>' : ''}</article><article class="connectionCard"><h3>Visual Factory V4</h3><div class="connState"><span class="sdot"></span>Branchement préservé</div><p>Le système continue d’utiliser la source attendue « SOWHAT — Visual Factory V4 ». Aucun workflow n8n existant n’a été modifié.</p>${visualFactoryUrl ? `<a class="cta" href="${escapeHtml(visualFactoryUrl)}" target="_blank" rel="noopener">Ouvrir Visual Factory ↗</a>` : ''}</article><article class="connectionCard"><h3>Mobile</h3><div class="connState"><span class="sdot"></span>Touch-first</div><p>Le layout mobile est désormais prioritaire. La sidebar bureau ne s’affiche que sur un grand écran avec souris ; même le mode « site pour ordinateur » d’un téléphone conserve la navigation mobile.</p></article></div><div class="historyGrid" style="margin-top:10px">${publications.length ? publications.map(historyCard).join('') : ''}</div></section>
</main></div><nav class="bottomNav" aria-label="Navigation mobile">${mobileNav('overview','⌂','Vue',true)}${mobileNav('publish','＋','Publier')}${mobileNav('contents','▤','Contenus')}${mobileNav('coach','✦','Coach')}${mobileNav('plan','▦','Plan')}${mobileNav('connections','◉','Liens')}</nav><div class="toast" id="toast" role="status" aria-live="polite"></div><script>
const csrf=${JSON.stringify(csrf)};const views=[...document.querySelectorAll('[data-view]')];const navs=[...document.querySelectorAll('[data-target]')];function switchView(name){views.forEach(v=>v.classList.toggle('active',v.dataset.view===name));navs.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.target===name)));history.replaceState(null,'','#'+name);window.scrollTo({top:0,behavior:'smooth'})}navs.forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.target)));const initial=location.hash.slice(1);if(views.some(v=>v.dataset.view===initial))switchView(initial);window.addEventListener('hashchange',()=>{const n=location.hash.slice(1);if(views.some(v=>v.dataset.view===n))switchView(n)});
const toast=document.getElementById('toast');let tt;function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),3200)}
let pubType='POST IMAGE';let previewReady=false;const formatBtns=[...document.querySelectorAll('.formatBtn')];const mediaHint=document.getElementById('mediaHint');formatBtns.forEach(b=>b.addEventListener('click',()=>{pubType=b.dataset.type;formatBtns.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));mediaHint.textContent=pubType==='REEL'?'MP4/MOV':'JPG/PNG/WebP';invalidatePreview()}));
const ids=['mediaUrl','caption','hashtags','altText','pubTitle','collection'];ids.forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{if(id==='caption')document.getElementById('captionCount').textContent=document.getElementById('caption').value.length+'/2000';invalidatePreview()}));function invalidatePreview(){previewReady=false;const b=document.getElementById('publishBtn');if(b)b.disabled=true}
function pubPayload(){return{publication_type:pubType,media_url:document.getElementById('mediaUrl').value.trim(),caption:document.getElementById('caption').value.trim(),hashtags:document.getElementById('hashtags').value.trim(),alt_text:document.getElementById('altText').value.trim(),title:document.getElementById('pubTitle').value.trim(),collection:document.getElementById('collection').value.trim()}}
async function callPublish(mode){const preview=document.getElementById('previewBtn');const commit=document.getElementById('publishBtn');preview.disabled=true;commit.disabled=true;try{const payload=pubPayload();if(mode==='commit')payload.confirmed=true;const r=await fetch('/api/social-intelligence/publish/'+mode,{method:'POST',headers:{'content-type':'application/json','X-SOWHAT-CSRF':csrf,'accept':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'request_failed');if(mode==='preview'){previewReady=true;commit.disabled=false;say('Test SAFE validé : publication réelle déverrouillée')}else{previewReady=false;commit.disabled=true;say('Demande de publication envoyée au Bridge SAFE');setTimeout(()=>location.reload(),900)}}catch(e){const map={public_https_media_url_required:'Ajoutez une URL média HTTPS publique',caption_required:'Ajoutez une légende',caption_too_long:'Légende trop longue',reel_requires_public_mp4_or_mov:'Un Reel doit utiliser une vidéo MP4/MOV publique',image_publication_requires_image_url:'Post/Story : URL image JPG/PNG/WebP requise',preview_required_or_expired:'Refaites le test SAFE avant de publier',bridge_rejected:'Le Bridge SAFE a refusé la demande',bridge_unreachable:'Bridge SAFE inaccessible'};say(map[e.message]||'Action impossible : '+e.message)}finally{preview.disabled=false;if(mode==='preview'&&previewReady)commit.disabled=false}}
document.getElementById('previewBtn')?.addEventListener('click',()=>callPublish('preview'));document.getElementById('publishBtn')?.addEventListener('click',()=>{if(!previewReady)return say('Test SAFE obligatoire avant publication');if(confirm('Publier réellement ce contenu sur @sowhatafrika ?'))callPublish('commit')});
async function refresh(){const b=document.getElementById('refreshBtn');if(b)b.disabled=true;try{const r=await fetch('/api/social-intelligence/refresh',{method:'POST',headers:{'X-SOWHAT-CSRF':csrf,'accept':'application/json'},credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'sync_failed');say('Statistiques synchronisées');setTimeout(()=>location.reload(),700)}catch(e){say(e.message==='instagram_insights_not_configured'?'Token Insights serveur non configuré':'Synchronisation impossible')}finally{if(b)b.disabled=false}}document.getElementById('refreshBtn')?.addEventListener('click',refresh);
let deferredPrompt=null;const install=document.getElementById('installBtn');window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;install.style.display='inline-flex'});install?.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;install.style.display='none'});if('serviceWorker'in navigator){navigator.serviceWorker.register('/social-intelligence/sw.js?v=3').catch(()=>{})}
</script></body></html>`;
}

function desktopNav(target,label,selected=false){return `<button type="button" data-target="${target}" aria-selected="${selected}">${escapeHtml(label)}</button>`}
function mobileNav(target,icon,label,selected=false){return `<button type="button" data-target="${target}" aria-selected="${selected}"><span>${icon}</span>${escapeHtml(label)}</button>`}
function formatButton(type,label,selected=false){return `<button class="formatBtn" type="button" data-type="${type}" aria-pressed="${selected}">${escapeHtml(label)}</button>`}
function metric(label,value){return `<article class="metric"><small>${escapeHtml(label)}</small><b>${formatNumber(value)}</b></article>`}
function pillar(label,value){const v=clamp(Math.round(finite(value)),0,100);return `<div class="prow"><span>${escapeHtml(label)}</span><div class="track"><div class="fill" style="width:${v}%"></div></div><span>${v}</span></div>`}
function mediaCard(item){const link=safeInstagramPermalink(item.permalink);return `<article class="mediaCard"><div class="mediaTop"><span class="badge">${escapeHtml(item.media_type||'POST')}</span><span class="badge score">${clamp(Math.round(finite(item.score)),0,100)}/100</span></div><div class="hook">${escapeHtml(cleanText(item.hook||item.caption||'Publication',130))}</div><div class="miniMetrics">${mini('Vues',item.views)}${mini('Reach',item.reach)}${mini('Partages',item.shares)}${mini('Saves',item.saves)}</div>${link?`<a class="openLink" href="${escapeHtml(link)}" target="_blank" rel="noopener">Ouvrir sur Instagram ↗</a>`:''}</article>`}
function mini(label,value){return `<div class="mini"><b>${formatNumber(value)}</b><small>${escapeHtml(label)}</small></div>`}
function coachBox(title,items,emptyText){const rows=Array.isArray(items)?items.filter(Boolean).slice(0,5):[];return `<article class="coachBox"><h3>${escapeHtml(title)}</h3>${rows.length?`<ul>${rows.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:`<div class="panelSub">${escapeHtml(emptyText)}</div>`}</article>`}
function planCard(item){return `<article class="planCard"><div class="day">${escapeHtml(item.day||'Jour')}</div><div class="ptype">${escapeHtml(item.type||'CONTENU')}</div><p><b>${escapeHtml(item.objective||'Objectif')}</b><br>${escapeHtml(item.action||'')}</p></article>`}
function historyCard(item){const ok=item.accepted===true;const mode=item.mode==='preview'?'TEST SAFE':'PUBLICATION';return `<article class="historyCard"><div class="historyTop"><strong>${escapeHtml(mode)} · ${escapeHtml(item.publication_type||'')}</strong><span class="historyState ${ok?'':'warn'}">${ok?'Accepté':'Erreur'}</span></div><p>${escapeHtml(item.title||'SOWHAT AFRICA')} · ${escapeHtml(dateShort(item.requested_at))}<br>${escapeHtml(cleanText(item.caption||'',120))}</p></article>`}
function emptyState(title,text){return `<div class="empty"><b style="display:block;color:var(--soft);margin-bottom:5px">${escapeHtml(title)}</b>${escapeHtml(text)}</div>`}

function renderSystemMessage(title, body) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SOWHAT Control</title><body style="margin:0;background:#08080a;color:#f6f2e9;font-family:system-ui;display:grid;place-items:center;min-height:100dvh;padding:24px"><main style="max-width:520px"><h1>${escapeHtml(title)}</h1><p style="color:#96938b;line-height:1.6">${escapeHtml(body)}</p></main></body></html>`;
}

function manifestResponse() {
  return new Response(JSON.stringify({
    name: 'SOWHAT Control', short_name: 'SOWHAT', start_url: '/social-intelligence', scope: '/social-intelligence',
    display: 'standalone', background_color: '#08080a', theme_color: '#0a0a0d',
    description: 'Cockpit privé SOWHAT pour créer, publier et mesurer les contenus Instagram.',
    icons: [{ src: '/social-intelligence/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }), { status: 200, headers: publicAssetHeaders('application/manifest+json; charset=utf-8', 'public, max-age=300') });
}
function serviceWorkerResponse() {
  const body = `self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin===location.origin&&u.pathname.startsWith('/social-intelligence'))e.respondWith(fetch(e.request,{cache:'no-store'}))});`;
  return new Response(body, { status: 200, headers: publicAssetHeaders('application/javascript; charset=utf-8', 'no-store') });
}
function iconResponse() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0d58d"/><stop offset="1" stop-color="#b88f3f"/></linearGradient></defs><rect width="512" height="512" rx="128" fill="#0a0a0d"/><rect x="68" y="68" width="376" height="376" rx="104" fill="url(#g)"/><text x="256" y="305" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="154" fill="#171208">SC</text></svg>`;
  return new Response(svg, { status: 200, headers: publicAssetHeaders('image/svg+xml; charset=utf-8', 'public, max-age=86400') });
}
function redirect(location,setCookie=''){const headers=new Headers({location,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});if(setCookie)headers.set('set-cookie',setCookie);return new Response(null,{status:303,headers})}
function html(body,status=200,headOnly=false){return new Response(headOnly?null:body,{status,headers:privateHeaders('text/html; charset=utf-8')})}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:privateHeaders('application/json; charset=utf-8')})}
function methodNotAllowed(){return new Response('Method Not Allowed',{status:405,headers:privateHeaders('text/plain; charset=utf-8')})}
function privateHeaders(contentType){return {'content-type':contentType,'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','strict-transport-security':'max-age=63072000; includeSubDomains; preload','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https://*.cdninstagram.com https://*.fbcdn.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'x-robots-tag':'noindex, nofollow, noarchive','x-sowhat-social-intelligence-version':VERSION}}
function publicAssetHeaders(contentType,cacheControl){return {'content-type':contentType,'cache-control':cacheControl,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow, noarchive'}}

function emptyBrain(){return {version:VERSION,updated_at:null,sample_count:0,maturity:'EARLY',score:0,score_delta:0,profile:{username:'sowhatafrika',followers_count:0},account:{},pillars:{attraction:0,engagement:0,advocacy:0,regularity:0},cadence:{posts_per_week:0},rankings:{formats:[]},top_media:[],recent_media:[],recommendations:{headline:'Le moteur attend les premières données réelles.',summary:'Aucun score artificiel ne sera affiché avant la première synchronisation.',wins:[],fixes:[],next_actions:['Publier via le Studio SAFE','Connecter le collecteur Insights','Laisser le moteur établir une médiane personnelle']},weekly_plan:[]}}
function cleanText(value,max=500){return String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function finite(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0}
function clamp(value,min,max){return Math.min(max,Math.max(min,Number(value)||0))}
function sum(rows,key){return (Array.isArray(rows)?rows:[]).reduce((n,x)=>n+finite(x?.[key]),0)}
function formatNumber(value){return new Intl.NumberFormat('fr-FR',{notation:Math.abs(Number(value)||0)>=100000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)||0)}
function dateRelative(value){if(!value)return'jamais';const delta=Date.now()-Date.parse(value);if(!Number.isFinite(delta))return'récemment';const min=Math.max(0,Math.floor(delta/60000));if(min<2)return'à l’instant';if(min<60)return`il y a ${min} min`;const h=Math.floor(min/60);if(h<24)return`il y a ${h} h`;return`il y a ${Math.floor(h/24)} j`}
function dateShort(value){try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Dakar'}).format(new Date(value))}catch{return'—'}}
function safeHttps(value){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.toString():''}catch{return''}}
function safeInstagramPermalink(value){try{const url=new URL(String(value||''));return url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)?url.toString():''}catch{return''}}
function errorMessage(error){return error instanceof Error?error.message:String(error||'unknown_error')}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
