import {
  handleSocialIntelligence as handleLegacySocialIntelligence,
  runInstagramSync as runLegacyInstagramSync,
} from './social-intelligence-v1.js';

const VERSION = '2.0.0';
const BRAIN_KEY = 'visuals/social-intelligence/brain.json';
const HISTORY_KEY = 'visuals/social-intelligence/history.json';
const SESSION_PREFIX = 'visuals/social-intelligence/sessions/';
const AUTH_PREFIX = 'visuals/social-intelligence/auth/';
const COOKIE_NAME = '__Host-sowhat_si';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;

export const runInstagramSync = runLegacyInstagramSync;

export async function handleSocialIntelligenceV2(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/api/social-intelligence/health') {
    return handleLegacySocialIntelligence(request, env, ctx);
  }

  if (url.pathname === '/api/social-intelligence/refresh') {
    return handleRefresh(request, env, ctx);
  }

  if (url.pathname.startsWith('/api/social-intelligence/')) {
    return handleLegacySocialIntelligence(request, env, ctx);
  }

  if (url.pathname === '/social-intelligence/manifest.webmanifest') {
    return manifestResponse();
  }

  if (url.pathname === '/social-intelligence/sw.js') {
    return serviceWorkerResponse();
  }

  if (url.pathname === '/social-intelligence/icon.svg') {
    return iconResponse();
  }

  if (url.pathname === '/social-intelligence/login') {
    return handleLogin(request, env);
  }

  if (url.pathname === '/social-intelligence/logout') {
    return handleLogout(request, env);
  }

  if (url.pathname === '/social-intelligence' || url.pathname === '/social-intelligence/') {
    return handleApp(request, env);
  }

  return new Response('Not Found', { status: 404, headers: privateHeaders('text/plain; charset=utf-8') });
}

async function handleApp(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405, headers: privateHeaders('text/plain; charset=utf-8') });
  }

  if (!env.VISUALS_BUCKET) {
    return html(renderSystemMessage('Stockage indisponible', 'Le tableau de bord reste fermé tant que le stockage privé R2 n’est pas disponible.'), 503, request.method === 'HEAD');
  }

  const url = new URL(request.url);
  const legacyKey = String(url.searchParams.get('k') || '').trim();
  if (legacyKey && await matchesHash(legacyKey, env.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256)) {
    const session = await createSession(env);
    return redirect('/social-intelligence', sessionCookie(session.token));
  }

  const auth = await authenticate(request, env);
  if (!auth.ok) {
    return html(renderLogin({ reason: url.searchParams.get('reason') || '' }), 200, request.method === 'HEAD');
  }

  const [brain, history] = await Promise.all([
    readJson(env, BRAIN_KEY, emptyBrain()),
    readJson(env, HISTORY_KEY, []),
  ]);

  return html(renderDashboard(brain, history, env, auth.session), 200, request.method === 'HEAD');
}

async function handleLogin(request, env) {
  if (request.method === 'GET') return redirect('/social-intelligence');
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: privateHeaders('text/plain; charset=utf-8') });
  }
  if (!env.VISUALS_BUCKET) return html(renderLogin({ error: 'Stockage privé indisponible.' }), 503);

  const limiter = await authLimiter(request, env);
  if (!limiter.allowed) {
    return html(renderLogin({ error: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil((limiter.retryAt - Date.now()) / 60000))} min.` }), 429);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return html(renderLogin({ error: 'Requête invalide.' }), 400);
  }

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
    try {
      const form = await request.formData();
      csrf = String(form.get('csrf') || '');
    } catch {}
    if (timingSafeEqual(csrf, String(auth.session.csrf || ''))) {
      await env.VISUALS_BUCKET.delete(auth.key);
    }
  }
  return redirect('/social-intelligence?reason=logout', clearSessionCookie());
}

async function handleRefresh(request, env, ctx) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  const csrf = String(request.headers.get('X-SOWHAT-CSRF') || '');
  if (!csrf || !timingSafeEqual(csrf, String(auth.session.csrf || ''))) {
    return json({ ok: false, error: 'csrf_rejected' }, 403);
  }
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    return json({ ok: false, error: 'instagram_not_configured' }, 503);
  }
  try {
    const result = await runLegacyInstagramSync(env, ctx);
    return json(result, result.ok ? 200 : 503);
  } catch (error) {
    return json({ ok: false, error: 'instagram_sync_failed', detail: errorMessage(error) }, 502);
  }
}

async function authenticate(request, env) {
  if (!env.VISUALS_BUCKET) return { ok: false };
  const token = getCookie(request.headers.get('cookie') || '', COOKIE_NAME);
  if (!token || token.length < 32) return { ok: false };
  const tokenHash = await sha256Text(token);
  const key = `${SESSION_PREFIX}${tokenHash}.json`;
  const session = await readJson(env, key, null);
  if (!session || session.expires_at <= Date.now()) {
    if (session) await env.VISUALS_BUCKET.delete(key);
    return { ok: false };
  }
  return { ok: true, session, key };
}

async function createSession(env) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const now = Date.now();
  const session = {
    version: VERSION,
    created_at: now,
    expires_at: now + SESSION_TTL_SECONDS * 1000,
    csrf,
  };
  const key = `${SESSION_PREFIX}${await sha256Text(token)}.json`;
  await env.VISUALS_BUCKET.put(key, JSON.stringify(session), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  return { token, session };
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
  const state = {
    count: Number(limiter.count || 0) + 1,
    window_started_at: Number(limiter.window_started_at || Date.now()),
  };
  await env.VISUALS_BUCKET.put(limiter.key, JSON.stringify(state), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
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
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function matchesHash(value, expectedHash) {
  const expected = String(expectedHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  const actual = await sha256Text(String(value || ''));
  return timingSafeEqual(actual, expected);
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
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
  } catch {
    return fallback;
  }
}

function renderLogin({ error = '', reason = '' } = {}) {
  const status = reason === 'logout' ? 'Session fermée en sécurité.' : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#050810">
<link rel="manifest" href="/social-intelligence/manifest.webmanifest">
<link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml">
<title>SOWHAT Intelligence · Accès privé</title>
<style>
:root{color-scheme:dark;--bg:#050810;--panel:#0b1320;--panel2:#0f1b2b;--line:#1d2b3c;--txt:#f7f9fc;--muted:#8ea0b6;--accent:#70dcff;--accent2:#9d8cff;--good:#65e1b7;--danger:#ff8c9b}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}body{min-height:100dvh;display:grid;place-items:center;padding:22px;overflow-x:hidden;background:radial-gradient(circle at 85% 0,rgba(85,146,255,.22),transparent 34%),radial-gradient(circle at 10% 22%,rgba(112,220,255,.11),transparent 28%),linear-gradient(180deg,#07101c,#050810 55%)}.login{width:min(440px,100%)}.mark{width:62px;height:62px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(145deg,var(--accent),var(--accent2));color:#04101a;font-weight:950;font-size:20px;box-shadow:0 18px 45px rgba(83,190,255,.22)}.eyebrow{margin-top:22px;color:var(--accent);font-weight:850;letter-spacing:.15em;text-transform:uppercase;font-size:11px}.login h1{font-size:clamp(34px,9vw,48px);line-height:.98;letter-spacing:-.05em;margin:10px 0 12px}.lead{color:var(--muted);font-size:15px;line-height:1.55;margin:0 0 22px}.card{padding:20px;border-radius:24px;border:1px solid rgba(130,173,214,.16);background:linear-gradient(180deg,rgba(15,29,47,.94),rgba(8,16,28,.96));box-shadow:0 22px 70px rgba(0,0,0,.38)}label{display:block;color:#bdc9d6;font-size:12px;font-weight:760;margin:14px 0 7px}.input{width:100%;height:54px;border-radius:15px;border:1px solid rgba(129,171,212,.22);background:#08111e;color:var(--txt);padding:0 15px;font-size:16px;outline:none}.input:focus{border-color:rgba(112,220,255,.65);box-shadow:0 0 0 4px rgba(112,220,255,.08)}.submit{width:100%;height:56px;border:0;border-radius:16px;margin-top:18px;background:linear-gradient(135deg,var(--accent),#76a8ff 55%,var(--accent2));color:#031019;font-weight:950;font-size:15px;cursor:pointer}.notice{padding:11px 13px;border-radius:13px;margin:0 0 12px;font-size:13px;line-height:1.4}.error{background:rgba(255,140,155,.08);border:1px solid rgba(255,140,155,.2);color:#ffc2ca}.ok{background:rgba(101,225,183,.08);border:1px solid rgba(101,225,183,.2);color:#b7f7df}.private{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:16px}.private i{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 0 5px rgba(101,225,183,.08)}@media(max-width:420px){body{padding:18px}.card{padding:18px;border-radius:22px}.login h1{font-size:38px}.input,.submit{height:56px}}
</style>
</head>
<body><main class="login">
<div class="mark">SI</div>
<div class="eyebrow">SOWHAT · espace personnel</div>
<h1>Ton cockpit<br>de contenu.</h1>
<p class="lead">Accès privé à l’analyse Instagram, au coach et au plan de publication. L’interface est optimisée pour un usage mobile quotidien.</p>
<div class="card">
${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
${status ? `<div class="notice ok">${escapeHtml(status)}</div>` : ''}
<form method="post" action="/social-intelligence/login" autocomplete="on">
<label for="username">Identifiant</label>
<input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
<label for="password">Mot de passe</label>
<input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
<button class="submit" type="submit">Entrer dans SOWHAT Intelligence</button>
</form>
</div>
<div class="private"><i></i><span>Session privée · 30 jours · aucune donnée sensible mise en cache</span></div>
</main>
<script>if('serviceWorker'in navigator){navigator.serviceWorker.register('/social-intelligence/sw.js').catch(()=>{});}</script>
</body></html>`;
}

function renderDashboard(brainValue, historyValue, env, session) {
  const brain = brainValue && typeof brainValue === 'object' ? brainValue : emptyBrain();
  const history = Array.isArray(historyValue) ? historyValue : [];
  const score = clamp(Math.round(finite(brain.score)), 0, 100);
  const delta = Number(brain.score_delta || 0);
  const pillars = brain.pillars || {};
  const topMedia = Array.isArray(brain.top_media) ? brain.top_media : [];
  const recentMedia = Array.isArray(brain.recent_media) ? brain.recent_media : [];
  const formats = Array.isArray(brain.rankings?.formats) ? brain.rankings.formats : [];
  const plan = Array.isArray(brain.weekly_plan) ? brain.weekly_plan : [];
  const rec = brain.recommendations || emptyBrain().recommendations;
  const configured = Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID);
  const username = cleanText(brain.profile?.username || 'sowhatafrika', 80);
  const followers = finite(brain.profile?.followers_count);
  const samples = finite(brain.sample_count);
  const totalViews = sum(recentMedia, 'views');
  const totalReach = sum(recentMedia, 'reach');
  const totalInteractions = sum(recentMedia, 'total_interactions');
  const scoreSeries = history.slice(0, 16).reverse().map((x) => clamp(finite(x.score), 0, 100));
  const csrf = String(session?.csrf || '');
  const lastSync = brain.updated_at ? dateRelative(brain.updated_at) : 'jamais';
  const maturity = cleanText(brain.maturity || 'EARLY', 24);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#050810">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/social-intelligence/manifest.webmanifest">
<link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml">
<title>SOWHAT Social Intelligence</title>
<style>
:root{color-scheme:dark;--bg:#050810;--bg2:#07101c;--panel:#0a1422;--panel2:#0e1b2d;--line:rgba(137,174,211,.15);--line2:rgba(137,174,211,.24);--txt:#f8fafc;--soft:#cad5e1;--muted:#8799ae;--accent:#6edcff;--accent2:#8f94ff;--good:#62dfb3;--warn:#ffd36d;--danger:#ff8798;--shadow:0 20px 70px rgba(0,0,0,.30)}
*{box-sizing:border-box}html{background:var(--bg);-webkit-text-size-adjust:100%}body{margin:0;min-height:100dvh;overflow-x:hidden;color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 90% -10%,rgba(95,146,255,.20),transparent 32%),radial-gradient(circle at 6% 8%,rgba(110,220,255,.10),transparent 26%),linear-gradient(180deg,var(--bg2),var(--bg) 48%)}button,a,input{font:inherit}button{touch-action:manipulation}.app{width:min(1540px,100%);margin:0 auto;min-height:100dvh;display:grid;grid-template-columns:258px minmax(0,1fr)}.side{position:sticky;top:0;height:100dvh;border-right:1px solid var(--line);padding:24px 18px;background:rgba(5,10,18,.76);backdrop-filter:blur(26px);z-index:50}.brand{display:flex;align-items:center;gap:12px;padding:4px 7px 24px}.brandmark{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,var(--accent),var(--accent2));color:#031018;font-weight:950}.brand strong{display:block;font-size:15px}.brand small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.nav{display:grid;gap:7px}.navbtn{border:0;background:transparent;color:var(--muted);width:100%;min-height:48px;border-radius:15px;padding:9px 11px;display:flex;align-items:center;gap:11px;text-align:left;font-weight:760;cursor:pointer}.navbtn[aria-selected="true"],.navbtn:hover{color:var(--txt);background:rgba(110,220,255,.08);box-shadow:inset 0 0 0 1px rgba(110,220,255,.17)}.ico{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.045);font-size:14px}.sideStatus{position:absolute;left:18px;right:18px;bottom:22px;padding:14px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}.stateLine{display:flex;gap:9px;align-items:center;color:var(--soft);font-size:12px;font-weight:750}.dot{width:8px;height:8px;border-radius:50%;background:${configured ? 'var(--good)' : 'var(--warn)'};box-shadow:0 0 0 5px ${configured ? 'rgba(98,223,179,.07)' : 'rgba(255,211,109,.07)'}.sideStatus small{display:block;color:var(--muted);font-size:11px;line-height:1.45;margin-top:8px}.main{min-width:0;width:100%;padding:18px clamp(18px,3.3vw,52px) 84px}.topbar{position:sticky;top:0;z-index:35;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 16px;background:linear-gradient(180deg,rgba(7,16,28,.96) 0%,rgba(7,16,28,.78) 72%,transparent 100%);backdrop-filter:blur(10px)}.account{display:flex;align-items:center;gap:10px;min-width:0}.avatar{width:42px;height:42px;flex:0 0 42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#17334e,#102339);border:1px solid rgba(110,220,255,.22);font-weight:950}.accountText{min-width:0}.accountText strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.accountText small{display:block;color:var(--muted);font-size:11px;margin-top:2px;white-space:nowrap}.topActions{display:flex;align-items:center;gap:8px}.pillBtn{min-height:42px;border-radius:13px;border:1px solid var(--line);background:rgba(255,255,255,.025);color:var(--soft);padding:0 12px;font-size:12px;font-weight:800;cursor:pointer}.pillBtn.primary{border-color:rgba(110,220,255,.22);background:rgba(110,220,255,.08);color:var(--accent)}.logout{margin:0}.logout button{min-height:42px;border-radius:13px;border:1px solid var(--line);background:transparent;color:var(--muted);padding:0 12px;cursor:pointer}.view{display:none;min-width:0}.view.active{display:block}.hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(270px,.65fr);gap:14px}.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(14,28,47,.92),rgba(8,16,28,.94));border-radius:24px;box-shadow:var(--shadow)}.heroMain{padding:clamp(22px,3.5vw,38px);min-height:292px;position:relative;overflow:hidden}.heroMain:after{content:"";position:absolute;right:-100px;top:-110px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(110,220,255,.19),transparent 68%)}.eyebrow{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.heroMain h1{font-size:clamp(34px,5vw,64px);line-height:.96;letter-spacing:-.055em;margin:12px 0 14px;max-width:820px}.heroMain p{color:var(--muted);max-width:720px;line-height:1.55;margin:0;font-size:15px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:19px}.chip{border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--soft);border-radius:999px;padding:8px 10px;font-size:11px;font-weight:760}.scoreCard{padding:22px;display:grid;place-items:center;text-align:center;min-height:292px}.ring{--score:${score};width:164px;height:164px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--accent) calc(var(--score)*1%),rgba(110,220,255,.08) 0)}.ring:before{content:"";position:absolute;inset:12px;border-radius:50%;background:#091524;border:1px solid rgba(110,220,255,.12)}.ringIn{position:relative}.ringIn strong{display:block;font-size:50px;line-height:1;letter-spacing:-.06em}.ringIn span{display:block;color:var(--muted);font-size:11px;margin-top:5px}.delta{margin-top:13px;color:${delta >= 0 ? 'var(--good)' : 'var(--danger)'};font-size:12px;font-weight:850}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-top:12px}.stat{padding:16px;border:1px solid var(--line);border-radius:19px;background:rgba(9,19,32,.72)}.stat label{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800}.stat strong{display:block;margin-top:8px;font-size:26px;letter-spacing:-.04em}.stat small{display:block;color:var(--muted);font-size:10px;margin-top:4px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.panel{padding:19px;border:1px solid var(--line);border-radius:22px;background:rgba(10,21,35,.76)}.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}.panelHead h2{font-size:17px;margin:0;letter-spacing:-.02em}.panelHead small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.spark{height:38px;display:flex;align-items:flex-end;gap:3px;min-width:90px}.spark i{display:block;flex:1;min-width:3px;border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,var(--accent),rgba(110,220,255,.17))}.pillars{display:grid;gap:13px}.prow{display:grid;grid-template-columns:110px minmax(0,1fr) 38px;gap:10px;align-items:center}.pname{font-size:12px;color:var(--soft)}.track{height:9px;background:rgba(255,255,255,.05);border-radius:999px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:999px}.pval{text-align:right;font-size:12px;font-weight:900}.coachLead{padding:16px;border-radius:17px;border:1px solid rgba(110,220,255,.18);background:linear-gradient(145deg,rgba(110,220,255,.08),rgba(143,148,255,.05))}.coachLead strong{display:block;font-size:17px;line-height:1.3}.coachLead p{color:var(--soft);font-size:12px;line-height:1.55;margin:8px 0 0}.actions{display:grid;gap:8px;margin-top:11px}.action{display:flex;gap:9px;padding:10px 11px;border:1px solid var(--line);border-radius:13px;background:rgba(4,10,18,.40);color:var(--soft);font-size:12px;line-height:1.45}.num{flex:0 0 23px;height:23px;border-radius:8px;display:grid;place-items:center;background:rgba(110,220,255,.10);color:var(--accent);font-size:10px;font-weight:900}.sectionTitle{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:8px 0 14px}.sectionTitle h1{font-size:clamp(26px,4vw,38px);letter-spacing:-.04em;margin:0}.sectionTitle p{color:var(--muted);font-size:12px;margin:5px 0 0}.mediaGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.mediaCard{padding:16px;border:1px solid var(--line);border-radius:19px;background:linear-gradient(180deg,rgba(14,27,45,.82),rgba(8,16,28,.82));min-width:0}.mediaTop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mediaType{display:inline-flex;border-radius:999px;padding:5px 8px;border:1px solid var(--line);color:var(--muted);font-size:10px;font-weight:800}.scoreBadge{min-width:44px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(110,220,255,.09);border:1px solid rgba(110,220,255,.18);color:var(--accent);font-weight:950;font-size:12px}.hook{font-size:14px;font-weight:800;line-height:1.35;margin:12px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.metricsRow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.mini{padding:8px;border-radius:11px;background:rgba(255,255,255,.025);min-width:0}.mini b{display:block;font-size:13px}.mini small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.open{display:inline-flex;margin-top:11px;color:var(--accent);font-size:11px;text-decoration:none;font-weight:800}.empty{padding:34px 18px;border:1px dashed var(--line2);border-radius:20px;text-align:center;color:var(--muted);line-height:1.55}.coachGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.coachBox{padding:18px;border:1px solid var(--line);border-radius:20px;background:rgba(10,21,35,.74)}.coachBox h3{margin:0 0 10px;font-size:15px}.coachBox ul{margin:0;padding-left:17px;color:var(--soft)}.coachBox li{margin:8px 0;font-size:12px;line-height:1.5}.planGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.planCard{padding:16px;border:1px solid var(--line);border-radius:19px;background:linear-gradient(180deg,rgba(14,27,45,.82),rgba(8,16,28,.82))}.day{color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.ptype{font-size:18px;font-weight:950;margin-top:9px}.objective{font-size:12px;color:var(--soft);margin-top:7px}.planAction{font-size:11px;color:var(--muted);line-height:1.5;margin-top:8px}.connectionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.connectionCard{padding:19px;border:1px solid var(--line);border-radius:21px;background:rgba(10,21,35,.76)}.connectionCard h3{margin:0;font-size:16px}.connectionStatus{display:inline-flex;align-items:center;gap:8px;margin-top:9px;color:${configured ? 'var(--good)' : 'var(--warn)'};font-size:12px;font-weight:850}.connectionCard p{color:var(--muted);font-size:12px;line-height:1.55}.cta{min-height:48px;border:0;border-radius:14px;padding:0 15px;background:linear-gradient(135deg,var(--accent),#79aaff);color:#031019;font-weight:950;cursor:pointer}.cta:disabled{opacity:.45;cursor:not-allowed}.mobileNav{display:none}.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:92px;z-index:90;max-width:min(92vw,520px);padding:11px 14px;border-radius:13px;background:#111d2c;border:1px solid var(--line2);color:var(--soft);font-size:12px;box-shadow:0 16px 48px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.2s}.toast.show{opacity:1}.install{display:none}
@media(max-width:1180px){.app{grid-template-columns:220px minmax(0,1fr)}.hero{grid-template-columns:1fr}.scoreCard{grid-template-columns:140px 1fr;place-items:center start;text-align:left;min-height:180px}.ring{width:136px;height:136px}.ringIn strong{font-size:42px}.planGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:960px){body{padding-bottom:calc(82px + env(safe-area-inset-bottom));}.app{display:block;max-width:100%;}.side{display:none}.main{padding:12px 14px 28px;max-width:100%;overflow:hidden}.topbar{padding:8px 0 12px}.accountText small{max-width:190px;overflow:hidden;text-overflow:ellipsis}.logout{display:none}.hero{display:block}.heroMain,.scoreCard,.panel,.card{border-radius:20px}.heroMain{min-height:auto;padding:22px 18px}.heroMain h1{font-size:clamp(34px,10vw,46px);max-width:100%;overflow-wrap:anywhere}.heroMain p{font-size:14px}.scoreCard{margin-top:10px;display:flex;align-items:center;justify-content:flex-start;gap:18px;min-height:auto;padding:18px;text-align:left}.ring{flex:0 0 116px;width:116px;height:116px}.ring:before{inset:9px}.ringIn strong{font-size:36px}.stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.stat{padding:13px;border-radius:16px}.stat strong{font-size:23px}.grid2,.coachGrid,.connectionGrid{grid-template-columns:1fr;gap:9px}.panel{padding:16px}.mediaGrid{grid-template-columns:1fr}.planGrid{grid-template-columns:1fr}.mobileNav{position:fixed;z-index:80;display:grid;grid-template-columns:repeat(5,1fr);left:10px;right:10px;bottom:calc(9px + env(safe-area-inset-bottom));padding:6px;border:1px solid rgba(136,174,211,.18);border-radius:21px;background:rgba(7,15,25,.94);backdrop-filter:blur(24px);box-shadow:0 18px 55px rgba(0,0,0,.48)}.mobileNav button{border:0;background:transparent;color:var(--muted);min-width:0;min-height:54px;border-radius:15px;display:grid;place-items:center;align-content:center;gap:3px;padding:5px 2px;font-size:9px;font-weight:780}.mobileNav button .micon{font-size:16px;line-height:1}.mobileNav button[aria-selected="true"]{background:rgba(110,220,255,.10);color:var(--accent)}.topActions .pillBtn:not(.primary){display:none}.sectionTitle{margin-top:4px}.metricsRow{grid-template-columns:repeat(4,minmax(0,1fr))}.mini{padding:7px 5px;text-align:center}.mini b{font-size:12px}.mini small{font-size:8px}.toast{bottom:calc(82px + env(safe-area-inset-bottom))}}
@media(max-width:430px){.main{padding-left:12px;padding-right:12px}.account{gap:8px}.avatar{width:38px;height:38px;flex-basis:38px;border-radius:12px}.accountText strong{font-size:13px}.accountText small{font-size:10px;max-width:150px}.pillBtn{padding:0 10px;min-height:40px}.heroMain h1{font-size:38px}.chips{gap:6px}.chip{font-size:10px;padding:7px 9px}.scoreCard{gap:14px}.ring{width:104px;height:104px;flex-basis:104px}.ringIn strong{font-size:32px}.stat strong{font-size:21px}.prow{grid-template-columns:92px minmax(0,1fr) 32px;gap:8px}.pname{font-size:11px}.mobileNav{left:8px;right:8px}.mobileNav button{min-height:52px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<div class="app">
<aside class="side">
  <div class="brand"><div class="brandmark">SI</div><div><strong>SOWHAT</strong><small>Social Intelligence 2.0</small></div></div>
  <nav class="nav" aria-label="Navigation">
    ${navButton('overview','⌁','Vue d’ensemble',true)}
    ${navButton('contents','▤','Contenus')}
    ${navButton('coach','✦','Coach')}
    ${navButton('plan','▦','Plan 7 jours')}
    ${navButton('connections','⊙','Connexions')}
  </nav>
  <div class="sideStatus"><div class="stateLine"><span class="dot"></span><span>${configured ? 'Instagram connecté' : 'Connexion à finaliser'}</span></div><small>Cycle automatique toutes les 6 h. Dernière analyse : ${escapeHtml(lastSync)}.</small></div>
</aside>
<main class="main">
<header class="topbar">
  <div class="account"><div class="avatar">SA</div><div class="accountText"><strong>SOWHAT AFRICA</strong><small>@${escapeHtml(username)} · ${formatNumber(followers)} abonnés · ${formatNumber(samples)} contenus analysés</small></div></div>
  <div class="topActions">
    <button class="pillBtn install" id="installBtn" type="button">Installer</button>
    <button class="pillBtn primary" id="quickRefresh" type="button" ${configured ? '' : 'disabled'}>Actualiser</button>
    <form class="logout" method="post" action="/social-intelligence/logout"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button type="submit">Sortir</button></form>
  </div>
</header>

<section class="view active" data-view="overview">
  <div class="hero">
    <article class="card heroMain">
      <div class="eyebrow">${samples ? 'Intelligence de contenu · Instagram' : 'En attente de données réelles'}</div>
      <h1>Créer moins au hasard.<br>Publier avec une mémoire.</h1>
      <p>${samples ? 'Chaque publication est comparée à ta propre médiane. Le système transforme les résultats en décisions concrètes pour la prochaine création.' : 'Le moteur est prêt. Dès que la connexion Instagram serveur est disponible, les vrais contenus alimentent automatiquement le score, le coach et le plan.'}</p>
      <div class="chips"><span class="chip">${escapeHtml(maturity)}</span><span class="chip">Médiane personnelle</span><span class="chip">Reels · Posts · Stories</span><span class="chip">Cycle 6 h</span></div>
    </article>
    <article class="card scoreCard">
      <div class="ring"><div class="ringIn"><strong>${score}</strong><span>/100</span></div></div>
      <div><div class="eyebrow">Score SOWHAT</div><div class="delta">${delta >= 0 ? '+' : ''}${Math.round(delta)} depuis le cycle précédent</div><div style="color:var(--muted);font-size:11px;margin-top:6px;line-height:1.45">Relatif à tes propres performances, pas à un chiffre générique.</div></div>
    </article>
  </div>
  <div class="stats">
    ${stat('Vues suivies', totalViews, 'sur les contenus récents')}
    ${stat('Portée suivie', totalReach, 'audience atteinte')}
    ${stat('Interactions', totalInteractions, 'likes, commentaires, partages, saves')}
    ${stat('Cadence', brain.cadence?.posts_per_week || 0, 'publications / semaine')}
  </div>
  <div class="grid2">
    <section class="panel"><div class="panelHead"><div><h2>Les 4 leviers</h2><small>Lecture relative à ta médiane</small></div>${spark(scoreSeries)}</div><div class="pillars">${pillar('Attraction',pillars.attraction)}${pillar('Engagement',pillars.engagement)}${pillar('Partages',pillars.advocacy)}${pillar('Régularité',pillars.regularity)}</div></section>
    <section class="panel"><div class="panelHead"><div><h2>Décision du coach</h2><small>Priorité actuelle</small></div></div><div class="coachLead"><strong>${escapeHtml(rec.headline || 'Le moteur attend les premières données.')}</strong><p>${escapeHtml(rec.summary || '')}</p></div><div class="actions">${actionsHtml(rec.next_actions)}</div></section>
  </div>
</section>

<section class="view" data-view="contents">
  <div class="sectionTitle"><div><h1>Contenus</h1><p>Les performances publication par publication.</p></div></div>
  ${topMedia.length ? `<div class="mediaGrid">${topMedia.map(mediaCard).join('')}</div>` : emptyState('Aucun contenu analysé pour le moment.', 'La grille se remplira dès la première synchronisation Instagram réussie.')}
</section>

<section class="view" data-view="coach">
  <div class="sectionTitle"><div><h1>Coach SOWHAT</h1><p>Ce qu’il faut garder, corriger et tester ensuite.</p></div></div>
  <div class="coachLead" style="margin-bottom:12px"><strong>${escapeHtml(rec.headline || 'Apprentissage en attente')}</strong><p>${escapeHtml(rec.summary || '')}</p></div>
  <div class="coachGrid">
    ${coachBox('Ce qui fonctionne', rec.wins, 'Les signaux gagnants apparaîtront ici.')}
    ${coachBox('À corriger', rec.fixes, 'Les points de friction apparaîtront ici.')}
    ${coachBox('3 actions prioritaires', rec.next_actions, 'Les prochaines actions seront calculées ici.')}
    ${coachBox('Formats', formats.map(x=>`${x.key}: ${x.avg_score}/100 sur ${x.n} contenu${x.n>1?'s':''}`), 'Pas encore assez de données pour classer les formats.')}
  </div>
</section>

<section class="view" data-view="plan">
  <div class="sectionTitle"><div><h1>Plan 7 jours</h1><p>Un plan court, réaliste et directement exploitable.</p></div></div>
  ${plan.length ? `<div class="planGrid">${plan.map(planCard).join('')}</div>` : emptyState('Le plan se construit après l’analyse.', 'Dès que le moteur possède assez de signaux, il transforme les meilleurs patterns en calendrier d’action.')}
</section>

<section class="view" data-view="connections">
  <div class="sectionTitle"><div><h1>Connexions</h1><p>État des briques qui alimentent ton cockpit.</p></div></div>
  <div class="connectionGrid">
    <article class="connectionCard"><h3>Instagram Professional</h3><div class="connectionStatus"><span class="dot"></span>${configured ? 'Connecté côté serveur' : 'Configuration serveur à finaliser'}</div><p>${configured ? `Dernière analyse : ${escapeHtml(lastSync)}. Le prochain cycle automatique intervient dans la fenêtre des 6 heures.` : 'Le tableau reste volontairement vide tant que les identifiants Instagram serveur ne sont pas présents. Aucune statistique n’est inventée.'}</p><button class="cta" id="refreshBtn" type="button" ${configured ? '' : 'disabled'}>${configured ? 'Synchroniser maintenant' : 'Connexion requise'}</button></article>
    <article class="connectionCard"><h3>Visual Factory</h3><div class="connectionStatus" style="color:var(--good)"><span class="dot" style="background:var(--good)"></span>Prêt pour la boucle créative</div><p>Les recommandations servent de mémoire pour guider la prochaine création sans remplacer la validation avant publication.</p></article>
    <article class="connectionCard"><h3>Mode personnel</h3><div class="connectionStatus" style="color:var(--good)"><span class="dot" style="background:var(--good)"></span>Privé</div><p>Connexion par identifiant + mot de passe, session sécurisée 30 jours, cookie HttpOnly, limitation des tentatives et aucune donnée analytique mise en cache.</p></article>
    <article class="connectionCard"><h3>Mobile / Galaxy A73</h3><div class="connectionStatus" style="color:var(--good)"><span class="dot" style="background:var(--good)"></span>Interface adaptative</div><p>Navigation basse tactile, largeur 100 %, safe-area Android, cartes mono-colonne et zéro sidebar sur petit écran.</p></article>
  </div>
</section>
</main>
</div>

<nav class="mobileNav" aria-label="Navigation mobile">
  ${mobileButton('overview','⌁','Vue',true)}
  ${mobileButton('contents','▤','Contenus')}
  ${mobileButton('coach','✦','Coach')}
  ${mobileButton('plan','▦','Plan')}
  ${mobileButton('connections','⊙','Liens')}
</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
const csrf=${JSON.stringify(csrf)};
const views=[...document.querySelectorAll('[data-view]')];
const navs=[...document.querySelectorAll('[data-target]')];
function switchView(name){
  views.forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  navs.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.target===name)));
  window.scrollTo({top:0,behavior:'smooth'});
}
navs.forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.target)));
const toast=document.getElementById('toast');
let toastTimer;
function say(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
async function refresh(){
  const buttons=[document.getElementById('refreshBtn'),document.getElementById('quickRefresh')].filter(Boolean);
  buttons.forEach(b=>{b.disabled=true;b.textContent='Synchronisation…'});
  try{
    const r=await fetch('/api/social-intelligence/refresh',{method:'POST',headers:{'X-SOWHAT-CSRF':csrf,'Accept':'application/json'},credentials:'same-origin'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'sync_failed');
    say('Synchronisation terminée');
    setTimeout(()=>location.reload(),700);
  }catch(e){say(e.message==='instagram_not_configured'?'Connexion Instagram à finaliser':'Synchronisation impossible pour le moment');buttons.forEach(b=>{b.disabled=false})}
}
['refreshBtn','quickRefresh'].forEach(id=>{const b=document.getElementById(id);if(b)b.addEventListener('click',refresh)});
let deferredPrompt=null;
const install=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;install.style.display='inline-flex'});
install?.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;install.style.display='none'});
if('serviceWorker'in navigator){navigator.serviceWorker.register('/social-intelligence/sw.js').catch(()=>{})}
</script>
</body></html>`;
}

function navButton(target, icon, label, selected=false) {
  return `<button class="navbtn" type="button" data-target="${target}" aria-selected="${selected}"><span class="ico">${icon}</span><span>${escapeHtml(label)}</span></button>`;
}
function mobileButton(target, icon, label, selected=false) {
  return `<button type="button" data-target="${target}" aria-selected="${selected}"><span class="micon">${icon}</span><span>${escapeHtml(label)}</span></button>`;
}
function stat(label, value, sub) {
  return `<article class="stat"><label>${escapeHtml(label)}</label><strong>${formatNumber(value)}</strong><small>${escapeHtml(sub)}</small></article>`;
}
function pillar(label, value) {
  const v = clamp(Math.round(finite(value)), 0, 100);
  return `<div class="prow"><span class="pname">${escapeHtml(label)}</span><div class="track"><div class="fill" style="width:${v}%"></div></div><span class="pval">${v}</span></div>`;
}
function spark(series) {
  const rows = Array.isArray(series) && series.length ? series : [8,12,9,18,14,20,17,24];
  const max = Math.max(1, ...rows);
  return `<div class="spark" aria-label="Évolution du score">${rows.map(v=>`<i style="height:${Math.max(10,Math.round((v/max)*100))}%"></i>`).join('')}</div>`;
}
function actionsHtml(items) {
  const rows = Array.isArray(items) ? items.slice(0,3) : [];
  if (!rows.length) return `<div class="action"><span class="num">1</span><span>Le moteur attend encore ses premières données réelles.</span></div>`;
  return rows.map((x,i)=>`<div class="action"><span class="num">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('');
}
function mediaCard(item) {
  const hook = cleanText(item.hook || item.caption || 'Publication', 130);
  const link = safeInstagramPermalink(item.permalink);
  return `<article class="mediaCard"><div class="mediaTop"><span class="mediaType">${escapeHtml(item.media_type || 'POST')}</span><span class="scoreBadge">${clamp(Math.round(finite(item.score)),0,100)}</span></div><div class="hook">${escapeHtml(hook)}</div><div class="metricsRow">${mini('Vues',item.views)}${mini('Reach',item.reach)}${mini('Partages',item.shares)}${mini('Saves',item.saves)}</div>${link?`<a class="open" href="${escapeHtml(link)}" target="_blank" rel="noopener">Ouvrir sur Instagram ↗</a>`:''}</article>`;
}
function mini(label, value) {
  return `<div class="mini"><b>${formatNumber(value)}</b><small>${escapeHtml(label)}</small></div>`;
}
function coachBox(title, items, emptyText) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0,5) : [];
  return `<article class="coachBox"><h3>${escapeHtml(title)}</h3>${rows.length?`<ul>${rows.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:`<div style="color:var(--muted);font-size:12px;line-height:1.5">${escapeHtml(emptyText)}</div>`}</article>`;
}
function planCard(item) {
  return `<article class="planCard"><div class="day">${escapeHtml(item.day||'Jour')}</div><div class="ptype">${escapeHtml(item.type||'CONTENU')}</div><div class="objective">${escapeHtml(item.objective||'Objectif')}</div><div class="planAction">${escapeHtml(item.action||'')}</div></article>`;
}
function emptyState(title, text) {
  return `<div class="empty"><strong style="display:block;color:var(--soft);margin-bottom:6px">${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function renderSystemMessage(title, body) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SOWHAT Intelligence</title><body style="margin:0;background:#050810;color:#f8fafc;font-family:system-ui;display:grid;place-items:center;min-height:100dvh;padding:24px"><main style="max-width:520px"><h1>${escapeHtml(title)}</h1><p style="color:#8ea0b6;line-height:1.6">${escapeHtml(body)}</p></main></body></html>`;
}

function manifestResponse() {
  return new Response(JSON.stringify({
    name: 'SOWHAT Social Intelligence',
    short_name: 'SOWHAT SI',
    start_url: '/social-intelligence',
    scope: '/social-intelligence',
    display: 'standalone',
    background_color: '#050810',
    theme_color: '#050810',
    description: 'Cockpit privé SOWHAT pour analyser Instagram et guider les prochaines publications.',
    icons: [
      { src: '/social-intelligence/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  }), { status: 200, headers: publicAssetHeaders('application/manifest+json; charset=utf-8', 'public, max-age=300') });
}

function serviceWorkerResponse() {
  const body = `self.addEventListener('install',event=>{self.skipWaiting()});self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin===location.origin&&u.pathname.startsWith('/social-intelligence')){event.respondWith(fetch(event.request))}});`;
  return new Response(body, { status: 200, headers: publicAssetHeaders('application/javascript; charset=utf-8', 'no-cache') });
}

function iconResponse() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#70dcff"/><stop offset="1" stop-color="#8f94ff"/></linearGradient></defs><rect width="512" height="512" rx="128" fill="#07101c"/><rect x="68" y="68" width="376" height="376" rx="104" fill="url(#g)"/><text x="256" y="305" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="154" fill="#041019">SI</text></svg>`;
  return new Response(svg, { status: 200, headers: publicAssetHeaders('image/svg+xml; charset=utf-8', 'public, max-age=86400') });
}

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

function html(body, status=200, headOnly=false) {
  return new Response(headOnly ? null : body, { status, headers: privateHeaders('text/html; charset=utf-8') });
}
function json(value, status=200) {
  return new Response(JSON.stringify(value), { status, headers: privateHeaders('application/json; charset=utf-8') });
}
function privateHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store, no-cache, must-revalidate',
    'pragma': 'no-cache',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https://*.cdninstagram.com https://*.fbcdn.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
      next_actions: ['Finaliser la connexion Instagram', 'Lancer une première synchronisation', 'Laisser le moteur établir une médiane personnelle'],
    },
    weekly_plan: [],
  };
}

function cleanText(value, max=500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
function sum(rows, key) {
  return (Array.isArray(rows) ? rows : []).reduce((n, x) => n + finite(x?.[key]), 0);
}
function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR', { notation: Math.abs(Number(value) || 0) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(value) || 0);
}
function dateRelative(value) {
  if (!value) return 'jamais';
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return 'récemment';
  const min = Math.max(0, Math.floor(delta / 60000));
  if (min < 2) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
function safeInstagramPermalink(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && ['instagram.com','www.instagram.com'].includes(url.hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'unknown_error');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
