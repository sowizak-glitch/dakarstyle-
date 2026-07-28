const ACCESS_KEY = 'k0QX6N5C-Krbfotgk1BVBXuqRtNNaQsT';
const BRAIN_KEY = 'visuals/performance/brain.json';

export async function handlePerformanceSnapshot(request, env) {
  const cors = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
  if (!env.VISUALS_BUCKET) return json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, 500, cors);
  if (String(request.headers.get('X-SOWHAT-DASHBOARD-KEY') || '') !== ACCESS_KEY) {
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
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
      customMetadata: { source: 'sowhat_instagram_performance_brain', saved_at: savedAt },
    });
    return json({ ok: true, saved_at: savedAt, sample_count: Number(brain.sample_count || 0) }, 200, cors);
  } catch (error) {
    return json({ ok: false, error: 'performance_snapshot_failed', detail: error instanceof Error ? error.message : String(error) }, 500, cors);
  }
}

export async function handlePerformanceDashboard(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
  const url = new URL(request.url);
  if (String(url.searchParams.get('k') || '') !== ACCESS_KEY) {
    return htmlResponse(accessDeniedHtml(), 403, request.method === 'HEAD');
  }
  try {
    let brain = null;
    if (env.VISUALS_BUCKET) {
      const object = await env.VISUALS_BUCKET.get(BRAIN_KEY);
      if (object) brain = JSON.parse(await object.text());
    }
    return htmlResponse(renderDashboard(brain), 200, request.method === 'HEAD');
  } catch (error) {
    return htmlResponse(errorHtml(error instanceof Error ? error.message : String(error)), 500, request.method === 'HEAD');
  }
}

function renderDashboard(brain) {
  const b = brain || { version: '1.0', sample_count: 0, maturity: 'EARLY', updated_at: null, best: {}, rankings: {}, recent_top: [], recommendation_text: 'Le Performance Brain attend encore son premier snapshot.' };
  const recent = Array.isArray(b.recent_top) ? b.recent_top : [];
  const totals = recent.reduce((a, r) => ({ views: a.views + Number(r.views || 0), reach: a.reach + Number(r.reach || 0), likes: a.likes + Number(r.likes || 0), comments: a.comments + Number(r.comments || 0), shares: a.shares + Number(r.shares || 0) }), { views: 0, reach: 0, likes: 0, comments: 0, shares: 0 });
  const best = b.best || {};
  const maturityText = b.maturity === 'MATURE' ? 'Base solide : les recommandations peuvent être fortement pondérées.' : b.maturity === 'LEARNING' ? 'Les tendances commencent à devenir exploitables, mais restent à confirmer.' : 'Phase initiale : le système affiche les signaux sans surinterpréter un petit échantillon.';
  const nextMs = b.updated_at ? new Date(b.updated_at).getTime() + 6 * 3600 * 1000 : null;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>SOWHAT PERFORMANCE DASHBOARD</title><style>
:root{--bg:#090a0d;--card:#12151b;--line:#292e38;--txt:#f7f7f8;--muted:#98a1b0;--accent:#f4d35e;--good:#72e2a5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 82% -10%,#252d3a 0,transparent 32%),var(--bg);color:var(--txt);font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}.wrap{width:min(1380px,94vw);margin:auto;padding:32px 0 60px}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:22px}.eyebrow{font-size:12px;letter-spacing:.2em;color:var(--accent);font-weight:900}.title{font-size:clamp(34px,5vw,64px);line-height:.95;margin:10px 0 12px;font-weight:950;letter-spacing:-.04em}.sub{color:var(--muted);max-width:760px;line-height:1.55}.status,.card{background:linear-gradient(180deg,#151921,var(--card));border:1px solid var(--line);border-radius:22px}.status{padding:15px 17px;min-width:260px}.dot{display:inline-block;width:9px;height:9px;background:var(--good);border-radius:50%;margin-right:8px}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px}.card{padding:20px}.kpi{grid-column:span 2;min-height:126px}.label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.kpi strong{display:block;font-size:32px;margin-top:15px}.hero{grid-column:span 12;display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.brain{font-size:19px;line-height:1.55}.note{background:#0d1015;border:1px solid var(--line);border-radius:16px;padding:16px;color:#c8ced8}.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.badge{padding:7px 10px;border-radius:999px;border:1px solid #353b47;background:#171a21;font-size:12px;font-weight:850}.chart{grid-column:span 4}.bar{margin:15px 0}.barh{display:flex;justify-content:space-between;font-size:13px}.track{height:8px;background:#272b33;border-radius:999px;overflow:hidden;margin:7px 0}.fill{height:100%;background:linear-gradient(90deg,var(--accent),#fff0aa)}.tiny{font-size:11px;color:#7b8594}.wide{grid-column:span 12}.media{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #242832}.media:last-child{border-bottom:0}.rank{width:38px;color:var(--accent);font-weight:950}.media-main{flex:1}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}.metrics{display:grid;grid-template-columns:repeat(6,minmax(55px,1fr));gap:7px}.metrics span{background:#0c0e12;border:1px solid #22262d;border-radius:11px;padding:8px}.metrics b{display:block}.metrics small{color:#818a98;font-size:10px}.open{color:#fff;text-decoration:none;border:1px solid #3b414c;padding:9px 12px;border-radius:10px;font-size:12px}.foot{display:flex;justify-content:space-between;color:#747d8a;font-size:12px;margin-top:18px}.refresh{border:1px solid #3b414c;background:#151820;color:#fff;border-radius:12px;padding:10px 14px;cursor:pointer}@media(max-width:1000px){.kpi{grid-column:span 4}.chart{grid-column:span 6}.hero{grid-template-columns:1fr}.top{flex-direction:column}.status{width:100%}}@media(max-width:650px){.kpi{grid-column:span 6}.chart{grid-column:span 12}.metrics{grid-template-columns:repeat(3,1fr)}.media{flex-wrap:wrap}.open{margin-left:52px}.title{font-size:38px}.foot{flex-direction:column;gap:8px}}
</style></head><body><main class="wrap"><section class="top"><div><div class="eyebrow">SOWHAT AFRICA · INTELLIGENCE</div><h1 class="title">PERFORMANCE<br>DASHBOARD</h1><div class="sub">Instagram Insights → apprentissage Sénégal/Dakar → recommandations injectées dans SOWHAT Creative OS.</div></div><div class="status"><div><span class="dot"></span><strong>Performance Brain actif</strong></div><div class="tiny" style="margin-top:8px">Dernière analyse : ${dateFr(b.updated_at)}</div><div class="tiny" style="margin-top:4px">Prochain cycle : <span id="countdown">calcul…</span></div></div></section><section class="grid">
${kpi('Médias analysés', b.sample_count)}${kpi('Maturité', b.maturity, true)}${kpi('Vues suivies', totals.views)}${kpi('Reach suivi', totals.reach)}${kpi('Likes suivis', totals.likes)}${kpi('Partages suivis', totals.shares)}
<div class="card hero"><div><div class="label">Biais créatif gagnant actuel</div><div class="badges">${badge(best.format)}${badge(best.location)}${badge(best.theme)}${badge(best.language)}${badge(best.audience)}</div><p class="brain">${esc(b.recommendation_text)}</p></div><div class="note"><div class="label">Niveau de confiance</div><p>${esc(maturityText)}</p><button class="refresh" onclick="location.reload()">Actualiser la page</button></div></div>
${chart('Formats',b.rankings?.formats)}${chart('Zones',b.rankings?.locations)}${chart('Thèmes',b.rankings?.themes)}${chart('Langues',b.rankings?.languages)}${chart('Audiences déclarées',b.rankings?.audiences)}${chart('Combinaisons gagnantes',b.rankings?.combinations)}
<div class="card wide"><div class="label">Meilleurs contenus observés</div>${topCards(recent)}</div></section><div class="foot"><span>SOWHAT AFRICA · Performance Brain v${esc(b.version||'1.0')} · analyse automatique toutes les 6 h</span><span>Page privée · noindex</span></div></main><script>const next=${nextMs ? String(nextMs) : 'null'};function tick(){const e=document.getElementById('countdown');if(!next){e.textContent='après le prochain cycle';return;}const d=next-Date.now();if(d<=0){e.textContent='cycle attendu';return;}e.textContent=Math.floor(d/3600000)+' h '+Math.floor((d%3600000)/60000)+' min';}tick();setInterval(tick,60000);</script></body></html>`;
}

function kpi(label,value,text=false){return `<div class="card kpi"><div class="label">${esc(label)}</div><strong${text?' style="font-size:24px"':''}>${text?esc(value):num(value)}</strong></div>`;}
function chart(title,items){return `<div class="card chart"><div class="label">${esc(title)}</div>${bars(items)}</div>`;}
function bars(items){const rows=Array.isArray(items)?items:[];if(!rows.length)return '<div class="tiny" style="padding:18px 0">Pas encore assez de données.</div>';const max=Math.max(1,...rows.map(x=>Number(x.avg_score||0)));return rows.slice(0,6).map((x,i)=>{const w=Math.max(4,Math.round(Number(x.avg_score||0)/max*100));return `<div class="bar"><div class="barh"><span>${i+1}. ${esc(x.key)}</span><strong>${num(x.avg_score)}</strong></div><div class="track"><div class="fill" style="width:${w}%"></div></div><div class="tiny">${num(x.n)} média${Number(x.n||0)>1?'s':''} · ${num(x.views)} vues · ${num(x.shares)} partages</div></div>`;}).join('');}
function topCards(items){const rows=Array.isArray(items)?items:[];if(!rows.length)return '<div class="tiny" style="padding:18px 0">Le classement se remplira automatiquement.</div>';return rows.slice(0,8).map((r,i)=>`<article class="media"><div class="rank">#${i+1}</div><div class="media-main"><div class="tags">${badge(r.format)} ${badge(r.location)} ${badge(r.theme)} ${badge(r.language)}</div><div class="metrics"><span><b>${num(r.views)}</b><small>Vues</small></span><span><b>${num(r.reach)}</b><small>Reach</small></span><span><b>${num(r.likes)}</b><small>Likes</small></span><span><b>${num(r.comments)}</b><small>Com.</small></span><span><b>${num(r.shares)}</b><small>Partages</small></span><span><b>${num(r.score)}</b><small>Score</small></span></div></div>${r.permalink?`<a class="open" href="${esc(r.permalink)}" target="_blank" rel="noopener">Ouvrir ↗</a>`:''}</article>`).join('');}
function badge(v){return `<span class="badge">${esc(v||'—')}</span>`;}function num(v){return new Intl.NumberFormat('fr-FR').format(Number(v||0));}function dateFr(v){if(!v)return '—';try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Dakar'}).format(new Date(v));}catch{return esc(v);}}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function accessDeniedHtml(){return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOWHAT Performance</title><style>body{margin:0;background:#090b0e;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:560px;padding:36px;border:1px solid #262a31;border-radius:24px;background:#11141a}p{color:#aeb5c2}</style></head><body><div class="box"><h1>Accès privé</h1><p>Utilisez le lien sécurisé complet du dashboard SOWHAT AFRICA.</p></div></body></html>';}
function errorHtml(msg){return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>SOWHAT Performance</title></head><body style="background:#090b0e;color:white;font-family:Arial;padding:40px"><h1>Dashboard temporairement indisponible</h1><pre>${esc(msg)}</pre></body></html>`;}
function htmlResponse(body,status=200,headOnly=false){return new Response(headOnly?null:body,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'}});}function corsHeaders(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-SOWHAT-DASHBOARD-KEY','Content-Type':'application/json; charset=utf-8'};}function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});}
