const SOWHAT_UPLOAD_KEY_SHA256 = 'ed51c5e5e73785e254d4ee5974193b22cecbb29b667c5651641d838e5bbcde35';
const DASHBOARD_KEY_SHA256 = 'dbdaa2a66dfdba3f092a4d517404254bb4f12fda33491c0a86ec8dc118478cd6';
const BRAIN_KEY = 'visuals/performance/brain.json';

export async function handlePerformanceSnapshot(request, env) {
  const cors = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
  if (!env.VISUALS_BUCKET) return json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, 500, cors);

  const apiKey = request.headers.get('X-SOWHAT-KEY') || '';
  const apiKeyHash = await sha256Text(apiKey);
  if (!apiKey || apiKeyHash !== SOWHAT_UPLOAD_KEY_SHA256) {
    return json({ ok: false, error: 'unauthorized' }, 401, cors);
  }

  try {
    const brain = await request.json();
    if (!brain || typeof brain !== 'object' || Array.isArray(brain)) {
      return json({ ok: false, error: 'invalid_brain_payload' }, 400, cors);
    }
    const savedAt = new Date().toISOString();
    const snapshot = { ...brain, dashboard_saved_at: savedAt };
    await env.VISUALS_BUCKET.put(BRAIN_KEY, JSON.stringify(snapshot, null, 2), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'no-store',
      },
      customMetadata: {
        source: 'sowhat_instagram_performance_brain',
        saved_at: savedAt,
      },
    });
    return json({ ok: true, saved_at: savedAt, sample_count: Number(brain.sample_count || 0) }, 200, cors);
  } catch (error) {
    return json({ ok: false, error: 'performance_snapshot_failed', detail: error instanceof Error ? error.message : String(error) }, 500, cors);
  }
}

export async function handlePerformanceDashboard(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const provided = String(url.searchParams.get('k') || '');
  const providedHash = await sha256Text(provided);
  if (!provided || providedHash !== DASHBOARD_KEY_SHA256) {
    return htmlResponse(accessDeniedHtml(), 403, request.method === 'HEAD');
  }

  let brain = null;
  if (env.VISUALS_BUCKET) {
    const object = await env.VISUALS_BUCKET.get(BRAIN_KEY);
    if (object) {
      try {
        brain = JSON.parse(await object.text());
      } catch {
        brain = null;
      }
    }
  }
  const page = renderDashboard(brain);
  return htmlResponse(page, 200, request.method === 'HEAD');
}

function renderDashboard(brain) {
  const b = brain || {
    version: '1.0',
    sample_count: 0,
    maturity: 'EARLY',
    updated_at: null,
    best: {},
    rankings: {},
    recent_top: [],
    recommendation_text: 'Le Performance Brain attend encore son premier snapshot.',
  };

  const recent = Array.isArray(b.recent_top) ? b.recent_top : [];
  const totals = recent.reduce((a, r) => ({
    views: a.views + Number(r.views || 0),
    reach: a.reach + Number(r.reach || 0),
    likes: a.likes + Number(r.likes || 0),
    comments: a.comments + Number(r.comments || 0),
    shares: a.shares + Number(r.shares || 0),
  }), { views: 0, reach: 0, likes: 0, comments: 0, shares: 0 });

  const best = b.best || {};
  const maturityCopy = b.maturity === 'MATURE'
    ? 'Base solide : le moteur dispose d’un historique suffisant pour pondérer fortement ses recommandations.'
    : b.maturity === 'LEARNING'
      ? 'Le moteur apprend : les tendances commencent à devenir exploitables, mais restent à confirmer.'
      : 'Phase initiale : les premiers signaux sont visibles, mais le système évite volontairement de surinterpréter un petit échantillon.';

  const nextMs = b.updated_at ? new Date(b.updated_at).getTime() + 6 * 3600 * 1000 : null;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>SOWHAT PERFORMANCE DASHBOARD</title>
<style>
:root{--bg:#090a0d;--card:#111318;--card2:#151820;--line:#272b35;--txt:#f6f7f9;--muted:#9aa3b2;--accent:#f4d35e;--good:#72e2a5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 82% -10%,#242b36 0,transparent 32%),var(--bg);color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}.wrap{width:min(1380px,94vw);margin:0 auto;padding:32px 0 60px}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:800}.title{font-size:clamp(30px,5vw,64px);line-height:.95;margin:10px 0 12px;font-weight:900;letter-spacing:-.04em}.subtitle{color:var(--muted);max-width:760px;line-height:1.6}.status{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px;min-width:250px}.dot{display:inline-block;width:9px;height:9px;background:var(--good);border-radius:99px;margin-right:8px}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px}.card{background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:22px;padding:20px}.kpi{grid-column:span 2;min-height:132px}.kpi label,.section-label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:700}.kpi strong{display:block;font-size:32px;margin-top:16px;letter-spacing:-.04em}.hero{grid-column:span 12;display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.brain{font-size:20px;line-height:1.55;margin:10px 0 0}.maturity{padding:16px;border-radius:16px;background:#0d1015;border:1px solid var(--line);color:#c8ced8;line-height:1.55}.best{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.badge{display:inline-flex;padding:7px 10px;border-radius:999px;border:1px solid #343a46;background:#171a21;color:#e9ebef;font-size:12px;font-weight:800}.chart{grid-column:span 4}.barrow{margin:16px 0}.barhead{display:flex;justify-content:space-between;gap:10px;font-size:13px}.track{height:8px;background:#262a32;border-radius:999px;overflow:hidden;margin:7px 0}.fill{height:100%;background:linear-gradient(90deg,var(--accent),#fff0a6);border-radius:999px}.sub{font-size:11px;color:#778191}.wide{grid-column:span 12}.media{display:flex;align-items:center;gap:14px;padding:15px 0;border-bottom:1px solid #242832}.media:last-child{border-bottom:0}.rank{font-weight:900;color:var(--accent);width:38px}.media-main{flex:1}.media-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.metrics{display:grid;grid-template-columns:repeat(6,minmax(60px,1fr));gap:8px}.metrics span{background:#0c0e12;border:1px solid #22262d;border-radius:12px;padding:9px}.metrics b{display:block;font-size:16px}.metrics small{color:#818a98;font-size:10px}.open{color:#fff;text-decoration:none;border:1px solid #3b414c;padding:9px 12px;border-radius:10px;font-size:12px}.foot{display:flex;justify-content:space-between;gap:18px;color:#747d8a;font-size:12px;margin-top:18px}.empty{color:#818b99;padding:18px 0}.refresh{border:1px solid #3b414c;background:#151820;color:#fff;border-radius:12px;padding:10px 14px;cursor:pointer}.refresh:hover{border-color:#747d8a}@media(max-width:1000px){.kpi{grid-column:span 4}.chart{grid-column:span 6}.hero{grid-template-columns:1fr}.top{flex-direction:column}.status{width:100%}}@media(max-width:650px){.wrap{width:min(94vw,620px);padding-top:20px}.kpi{grid-column:span 6}.chart{grid-column:span 12}.metrics{grid-template-columns:repeat(3,1fr)}.media{align-items:flex-start;flex-wrap:wrap}.open{margin-left:52px}.foot{flex-direction:column}.title{font-size:38px}}
</style>
</head>
<body><main class="wrap">
<section class="top"><div><div class="eyebrow">SOWHAT AFRICA · INTELLIGENCE</div><h1 class="title">PERFORMANCE<br>DASHBOARD</h1><div class="subtitle">Le cerveau mesure Instagram, apprend les signaux qui surperforment au Sénégal et injecte progressivement ces enseignements dans SOWHAT Creative OS.</div></div><div class="status"><div><span class="dot"></span><strong>Performance Brain actif</strong></div><div style="color:var(--muted);font-size:12px;margin-top:8px">Dernière analyse : ${dateFr(b.updated_at)}</div><div style="color:var(--muted);font-size:12px;margin-top:4px">Prochain cycle : <span id="countdown">calcul…</span></div></div></section>
<section class="grid">
<div class="card kpi"><label>Médias analysés</label><strong>${num(b.sample_count)}</strong></div>
<div class="card kpi"><label>Maturité</label><strong style="font-size:24px">${escapeHtml(b.maturity)}</strong></div>
<div class="card kpi"><label>Vues suivies</label><strong>${num(totals.views)}</strong></div>
<div class="card kpi"><label>Reach suivi</label><strong>${num(totals.reach)}</strong></div>
<div class="card kpi"><label>Likes suivis</label><strong>${num(totals.likes)}</strong></div>
<div class="card kpi"><label>Partages suivis</label><strong>${num(totals.shares)}</strong></div>
<div class="card hero"><div><div class="section-label">Biais créatif gagnant actuel</div><div class="best">${badge(best.format)}${badge(best.location)}${badge(best.theme)}${badge(best.language)}${badge(best.audience)}</div><p class="brain">${escapeHtml(b.recommendation_text)}</p></div><div class="maturity"><div class="section-label">Niveau de confiance</div><p>${escapeHtml(maturityCopy)}</p><button class="refresh" onclick="location.reload()">Actualiser la page</button></div></div>
<div class="card chart"><div class="section-label">Formats</div>${bars(b.rankings?.formats)}</div>
<div class="card chart"><div class="section-label">Zones</div>${bars(b.rankings?.locations)}</div>
<div class="card chart"><div class="section-label">Thèmes</div>${bars(b.rankings?.themes)}</div>
<div class="card chart"><div class="section-label">Langues</div>${bars(b.rankings?.languages)}</div>
<div class="card chart"><div class="section-label">Audiences déclarées</div>${bars(b.rankings?.audiences)}</div>
<div class="card chart"><div class="section-label">Combinaisons gagnantes</div>${bars(b.rankings?.combinations)}</div>
<div class="card wide"><div class="section-label">Meilleurs contenus observés</div>${topCards(recent)}</div>
</section>
<div class="foot"><span>SOWHAT AFRICA · Performance Brain v${escapeHtml(b.version || '1.0')} · analyse automatique toutes les 6 h</span><span>Page privée · noindex</span></div>
</main>
<script>const next=${nextMs ? String(nextMs) : 'null'};function tick(){const e=document.getElementById('countdown');if(!next){e.textContent='après le prochain apprentissage';return;}const d=next-Date.now();if(d<=0){e.textContent='cycle attendu';return;}const h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000);e.textContent=h+' h '+m+' min';}tick();setInterval(tick,60000);</script>
</body></html>`;
}

function bars(items) {
  const rows = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...rows.map((x) => Number(x.avg_score || 0)));
  if (!rows.length) return '<div class="empty">Pas encore assez de données.</div>';
  return rows.slice(0, 6).map((x, i) => {
    const width = Math.max(4, Math.round((Number(x.avg_score || 0) / max) * 100));
    return `<div class="barrow"><div class="barhead"><span>${i + 1}. ${escapeHtml(x.key)}</span><strong>${num(x.avg_score)}</strong></div><div class="track"><div class="fill" style="width:${width}%"></div></div><div class="sub">${num(x.n)} média${Number(x.n || 0) > 1 ? 's' : ''} · ${num(x.views)} vues · ${num(x.shares)} partages</div></div>`;
  }).join('');
}

function topCards(items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '<div class="empty">Le classement se remplira automatiquement après les prochains cycles.</div>';
  return rows.slice(0, 8).map((r, i) => `<article class="media"><div class="rank">#${i + 1}</div><div class="media-main"><div class="media-tags">${badge(r.format)} ${badge(r.location)} ${badge(r.theme)} ${badge(r.language)}</div><div class="metrics"><span><b>${num(r.views)}</b><small>Vues</small></span><span><b>${num(r.reach)}</b><small>Reach</small></span><span><b>${num(r.likes)}</b><small>Likes</small></span><span><b>${num(r.comments)}</b><small>Com.</small></span><span><b>${num(r.shares)}</b><small>Partages</small></span><span><b>${num(r.score)}</b><small>Score</small></span></div></div>${r.permalink ? `<a class="open" href="${escapeHtml(r.permalink)}" target="_blank" rel="noopener">Ouvrir ↗</a>` : ''}</article>`).join('');
}

function badge(value) {
  return `<span class="badge">${escapeHtml(value || '—')}</span>`;
}

function num(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value || 0));
}

function dateFr(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dakar' }).format(new Date(value));
  } catch {
    return escapeHtml(value);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function accessDeniedHtml() {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOWHAT Performance</title><style>body{margin:0;background:#090b0e;color:#fff;font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:560px;padding:36px;border:1px solid #262a31;border-radius:24px;background:#11141a}h1{margin:0 0 12px;font-size:28px}p{color:#aeb5c2;line-height:1.6}</style></head><body><div class="box"><h1>Accès privé</h1><p>Utilisez le lien sécurisé complet du dashboard SOWHAT AFRICA.</p></div></body></html>';
}

function htmlResponse(body, status = 200, headOnly = false) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
  };
  return new Response(headOnly ? null : body, { status, headers });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-SOWHAT-KEY',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
