const SUPABASE_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NVbWUoS1b6BgfWaRSJlRVw_iU7fuqwO';
const OWNER_EMAIL = 'idrissaminata@gmail.com';
const SESSION_KEY = 'sowhat_founder_os_session_v1';
const CACHE_KEY = 'sowhat_founder_os_cache_v1';
const TZ = 'Africa/Casablanca';

const state = {
  session: null,
  data: null,
  loading: false,
  online: navigator.onLine,
  error: '',
  loginStage: 'email',
  loginMessage: '',
  loginError: false,
  installPrompt: null,
  filters: { knowledgeSearch: '', knowledgeDomain: '', knowledgeStage: '', knowledgeVerified: '' }
};

const TABLES = {
  pillars: ['founder_os_pillars', 'select=*&order=position.asc'],
  agents: ['founder_os_agents', 'select=*&order=pillar_id.asc,display_name.asc'],
  sops: ['founder_os_sops', 'select=*&order=pillar_id.asc,id.asc'],
  alerts: ['founder_os_alerts', 'select=*&order=created_at.desc&limit=100'],
  decisions: ['founder_os_decisions', 'select=*&order=created_at.desc&limit=100'],
  connectors: ['founder_os_connectors', 'select=*&order=id.asc'],
  runs: ['founder_os_agent_runs', 'select=*&order=created_at.desc&limit=100'],
  events: ['founder_os_events', 'select=*&order=occurred_at.desc&limit=100'],
  knowledge: ['founder_os_knowledge_items', 'select=*&order=updated_at.desc&limit=100'],
  edges: ['founder_os_knowledge_edges', 'select=*&limit=300'],
  outbox: ['founder_os_outbox', 'select=*&order=created_at.desc&limit=100'],
  policies: ['founder_os_policies', 'select=*&order=updated_at.desc&limit=100']
};

function e(value='') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function fmtDate(value, withDate=true){
  if(!value) return '—';
  try {
    const opts = withDate
      ? {timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}
      : {timeZone:TZ,hour:'2-digit',minute:'2-digit'};
    return new Intl.DateTimeFormat('fr-FR', opts).format(new Date(value));
  } catch { return '—'; }
}
function durationMs(run){
  if(!run?.started_at || !run?.finished_at) return '—';
  const ms = new Date(run.finished_at)-new Date(run.started_at);
  if(ms<1000) return `${ms} ms`; if(ms<60000) return `${(ms/1000).toFixed(1)} s`; return `${(ms/60000).toFixed(1)} min`;
}
function json(value){ try { return JSON.stringify(value ?? {}, null, 2); } catch { return '{}'; } }
function isPendingDecision(d){ return ['pending','proposed','awaiting_approval','requires_approval'].includes(String(d?.status||'').toLowerCase()); }
function severityRank(s){ return ({critical:5,high:4,warning:3,warn:3,info:1}[String(s||'').toLowerCase()]||2); }
function icon(name){
  const paths={
    command:'<path d="M4 5h16M4 12h10M4 19h16"/>',
    decisions:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    pillars:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    agents:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    automations:'<path d="M8 6h13M3 6h1M16 18H3m18 0h-1M6 12h12"/><circle cx="6" cy="12" r="2"/>',
    knowledge:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',
    activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21H10v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.02V3h4v.08a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/>',
    refresh:'<path d="M20 6v6h-6"/><path d="M4 18v-6h6"/><path d="M18.5 9a7 7 0 0 0-12-2L4 9m16 6-2.5 2a7 7 0 0 1-12-2"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    inbox:'<path d="M4 4h16v16H4z"/><path d="M4 13h5l2 3h2l2-3h5"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.command}</svg>`;
}
function tag(text,type=''){ return `<span class="tag ${type}">${e(text)}</span>`; }
function statusTag(status){
  const s=String(status||'unknown').toLowerCase();
  const type=['connected','success','completed','active','sent','executed'].includes(s)?'ok':['failed','error','critical','degraded'].includes(s)?'danger':['warning','pending','queued','not_configured','unknown','running'].includes(s)?'warn':'info';
  return tag(s.replaceAll('_',' '),type);
}
function riskTag(r){ const n=Number(r??0); return tag(`R${n}`, n>=3?'danger':n===2?'warn':'accent'); }
function autonomyTag(l){ const n=Number(l??0); return tag(`L${n}`, n<=2?'warn':'info'); }

async function authRequest(path, body){
  const res=await fetch(`${SUPABASE_URL}${path}`,{method:'POST',headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(payload?.msg||payload?.message||payload?.error_description||`Auth ${res.status}`);
  return payload;
}
async function sendLogin(email){
  return authRequest('/auth/v1/otp',{email,create_user:false,email_redirect_to:`${location.origin}${location.pathname}`});
}
async function verifyOtp(email,token){ return authRequest('/auth/v1/verify',{email,token,type:'email'}); }
async function refreshSession(refreshToken){ return authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:refreshToken}); }
async function logoutRemote(){
  if(!state.session?.access_token) return;
  try{ await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${state.session.access_token}`}}); }catch{}
}
function saveSession(session){
  if(!session?.access_token) return;
  const expiresAt=session.expires_at || Math.floor(Date.now()/1000)+(Number(session.expires_in)||3600);
  state.session={...session,expires_at:expiresAt};
  localStorage.setItem(SESSION_KEY,JSON.stringify(state.session));
}
function clearSession(){ state.session=null; localStorage.removeItem(SESSION_KEY); }
async function restoreSession(){
  const raw=localStorage.getItem(SESSION_KEY); if(!raw) return;
  try{
    let s=JSON.parse(raw);
    if(Number(s.expires_at||0)*1000 < Date.now()+60000 && s.refresh_token){
      const fresh=await refreshSession(s.refresh_token); s=fresh; saveSession(s);
    } else state.session=s;
  }catch{ clearSession(); }
}
function parseAuthCallback(){
  const raw=location.hash.startsWith('#')?location.hash.slice(1):'';
  if(!raw.includes('access_token=')&&!raw.includes('error_description=')) return false;
  const p=new URLSearchParams(raw);
  if(p.get('access_token')){
    saveSession({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in')||3600),token_type:p.get('token_type')||'bearer'});
    history.replaceState({},'',location.pathname+'#/');
    state.loginMessage='Connexion sécurisée réussie.'; state.loginError=false;
    return true;
  }
  state.loginMessage=decodeURIComponent(p.get('error_description')||'Connexion impossible.'); state.loginError=true;
  history.replaceState({},'',location.pathname+'#/');
  return true;
}

async function dbGet(table,query='select=*'){
  if(!state.session?.access_token) throw new Error('Session absente');
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${state.session.access_token}`,Accept:'application/json'}});
  if(res.status===401){ clearSession(); throw new Error('Session expirée'); }
  if(res.status===403) throw new Error('Accès Founder OS non autorisé');
  const body=await res.json().catch(()=>[]);
  if(!res.ok) throw new Error(body?.message||`Erreur ${res.status}`);
  return body;
}
async function dbPatch(table,id,patch){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)});
  const body=await res.json().catch(()=>[]);
  if(!res.ok) throw new Error(body?.message||`Erreur ${res.status}`);
  return body;
}
async function loadData(force=false){
  if(state.loading) return;
  if(state.data&&!force) return;
  state.loading=true; state.error=''; render();
  try{
    const entries=await Promise.all(Object.entries(TABLES).map(async ([key,[table,q]])=>[key,await dbGet(table,q)]));
    state.data=Object.fromEntries(entries); state.online=true;
    localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:state.data}));
  }catch(err){
    state.error=err.message||'Erreur de synchronisation';
    const cached=localStorage.getItem(CACHE_KEY);
    if(cached){ try{ state.data=JSON.parse(cached).data; }catch{} }
  }finally{ state.loading=false; render(); }
}

function latestRun(agentId){ return state.data?.runs?.find(r=>r.agent_id===agentId)||null; }
function openAlerts(){ return (state.data?.alerts||[]).filter(a=>!['resolved','closed'].includes(String(a.status||'').toLowerCase())); }
function pendingDecisions(){ return (state.data?.decisions||[]).filter(isPendingDecision); }
function systemHealth(){
  const d=state.data;if(!d) return 0;
  const connected=(d.connectors||[]).filter(c=>String(c.status).toLowerCase()==='connected').length;
  const connectorRatio=d.connectors?.length?connected/d.connectors.length:0;
  const active=(d.agents||[]).filter(a=>a.active).length;
  const agentRatio=d.agents?.length?active/d.agents.length:0;
  const recent=(d.runs||[]).slice(0,20);
  const successRatio=recent.length?recent.filter(r=>['success','completed'].includes(String(r.status).toLowerCase())).length/recent.length:.5;
  const penalty=openAlerts().reduce((n,a)=>n+({critical:15,high:10,warning:5,warn:5,info:1}[String(a.severity).toLowerCase()]||2),0)+Math.min(8,pendingDecisions().length*2);
  return clamp(Math.round(connectorRatio*45+agentRatio*35+successRatio*20-penalty),0,100);
}
function healthLabel(h){ return h>=85?'Stable':h>=70?'Sous surveillance':h>=50?'Dégradé':'Critique'; }
function pillarStatus(id){
  const alerts=openAlerts().filter(a=>a.pillar_id===id);
  if(alerts.some(a=>['critical','high'].includes(String(a.severity).toLowerCase()))) return 'danger';
  if(alerts.length) return 'warn';
  return 'ok';
}
function currentRoute(){
  const h=(location.hash||'#/').replace(/^#/,''); return h||'/';
}
const NAV=[
  ['/', 'command','Command'],['/decisions','decisions','Décisions'],['/pillars','pillars','Piliers'],['/agents','agents','Agents'],['/automations','automations','Automations'],['/knowledge','knowledge','Knowledge'],['/activity','activity','Activité'],['/settings','settings','Réglages']
];
function routeMeta(route){
  if(route.startsWith('/pillar/')) return ['Pilier','Vue opérationnelle par domaine'];
  const m={
    '/':['Centre de commandement','Vue exécutive en temps réel'],
    '/decisions':['Décisions','Validation humaine en un clic'],
    '/pillars':['6 piliers','Architecture opérationnelle'],
    '/agents':['8 agents IA','État, risque et historique'],
    '/automations':['Automations','Connecteurs, outbox et exécutions'],
    '/knowledge':['Knowledge','Mémoire durable et sources vérifiées'],
    '/activity':['Activité','Journal chronologique et audit'],
    '/settings':['Réglages','Politiques, sécurité et métadonnées']
  };return m[route]||m['/'];
}
function navMarkup(route,mobile=false){
  return NAV.map(([path,ico,label])=>`<button class="${mobile?'':'nav-btn '}${route===path||(!mobile&&path==='/pillars'&&route.startsWith('/pillar/'))?'active':''}" data-route="${path}" aria-label="${e(label)}">${icon(ico)}<span>${e(label)}</span></button>`).join('');
}
function shell(content){
  const route=currentRoute(); const [title,kicker]=routeMeta(route);
  return `<div class="app-shell">
    <aside class="side-rail">
      <div class="brand"><div class="brand-mark"><span></span></div><div><strong>SOWHAT FOUNDER OS</strong><small>Central Operating System</small></div></div>
      <nav class="nav">${navMarkup(route)}</nav>
      <div class="rail-footer"><span class="live-dot ${state.online?'':'offline'}"></span>${state.online?'Synchronisation active':'Mode hors ligne'}<br>Fuseau · Africa/Casablanca</div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="top-left"><div><div class="page-title">${e(title)}</div><div class="page-kicker">${e(kicker)}</div></div></div>
        <div class="top-actions"><div class="sync-state"><span class="live-dot ${state.online?'':'offline'}"></span>${state.online?'Live':'Cache local'} · <span id="clock">${e(fmtDate(Date.now(),false))}</span></div><button class="icon-btn" data-action="refresh" title="Actualiser">${icon('refresh')}</button><button class="icon-btn" data-action="logout" title="Déconnexion">${icon('logout')}</button></div>
      </header>
      <div class="content">${content}</div>
    </main>
    <nav class="mobile-nav">${navMarkup(route,true)}</nav>
    ${!state.online?'<div class="offline-banner">Mode hors ligne — affichage des dernières données Founder OS mises en cache.</div>':''}
  </div>`;
}
function emptyState(title,text,ico='inbox'){ return `<div class="empty">${icon(ico)}<strong>${e(title)}</strong><span>${e(text)}</span></div>`; }
function loader(){ return `<div class="loading"><div><div class="spinner"></div><div>Synchronisation Founder OS…</div></div></div>`; }

function renderAttention(){
  const items=[];
  openAlerts().forEach(a=>items.push({kind:'Alerte',rank:severityRank(a.severity),created:a.created_at,bar:a.severity,title:a.summary,sub:`${a.pillar_id||'SYSTEM'} · ${a.component||'composant'}`,action:`<button class="btn ghost" data-action="ack-alert" data-id="${e(a.id)}">Accuser réception</button>`}));
  pendingDecisions().forEach(d=>items.push({kind:'Décision',rank:6+Number(d.risk_class||0),created:d.created_at,bar:Number(d.risk_class)>=3?'high':'warning',title:d.title,sub:d.why_now||d.business_impact||'Validation requise',action:`<button class="btn primary" data-route="/decisions">Examiner</button>`}));
  items.sort((a,b)=>b.rank-a.rank||new Date(b.created)-new Date(a.created));
  if(!items.length) return emptyState('Rien à valider','Aucune alerte ouverte ni décision en attente. Founder OS continue de superviser l’écosystème.','decisions');
  return `<div class="attention">${items.slice(0,8).map(x=>`<div class="attention-row"><div class="severity-bar ${e(x.bar)}"></div><div class="attention-type">${e(x.kind)}</div><div class="attention-main"><strong>${e(x.title)}</strong><span>${e(x.sub)}</span></div><div class="attention-action">${x.action}</div></div>`).join('')}</div>`;
}
function renderPillarsRail(){
  const pillars=state.data?.pillars||[];
  if(!pillars.length) return emptyState('Aucun pilier disponible','La table founder_os_pillars ne contient aucun pilier.','pillars');
  return `<div class="pillar-rail">${pillars.map((p,i)=>{
    const agents=(state.data.agents||[]).filter(a=>a.pillar_id===p.id); const alerts=openAlerts().filter(a=>a.pillar_id===p.id); const st=pillarStatus(p.id);
    return `<button class="pillar-card" data-route="/pillar/${encodeURIComponent(p.id)}"><span class="pillar-index">0${i+1}</span><h3>${e(p.display_name||p.id)}</h3><p>${e(p.purpose||'')}</p><div class="pillar-foot"><span><i class="status-dot ${st==='ok'?'':st}"></i>${st==='ok'?'Stable':st==='warn'?'Surveillance':'Attention'}</span><span>${agents.length} agent${agents.length>1?'s':''} · ${alerts.length} alerte${alerts.length>1?'s':''}</span></div></button>`;
  }).join('')}</div>`;
}
function renderAgentTable(limit=8){
  const agents=(state.data?.agents||[]).slice(0,limit);
  if(!agents.length) return emptyState('Aucun agent','La table founder_os_agents est vide.','agents');
  return `<table class="table"><thead><tr><th>Agent</th><th>Statut</th><th>Risque / autonomie</th><th>Dernier run</th><th>Durée</th></tr></thead><tbody>${agents.map(a=>{
    const r=latestRun(a.id);return `<tr data-action="show-run" data-id="${e(r?.id||'')}"><td class="main-cell"><strong>${e(a.display_name)}</strong><span>${e(a.pillar_id)} · ${e(a.mission||'')}</span></td><td>${r?statusTag(r.status):tag(a.active?'actif':'inactif',a.active?'ok':'warn')}</td><td>${riskTag(r?.risk_class??a.max_risk)} ${autonomyTag(r?.autonomy_level??a.default_autonomy)}</td><td>${r?`${e(fmtDate(r.created_at))}<div class="mono">${e(r.correlation_id||'')}</div>`:'—'}</td><td>${e(durationMs(r))}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function renderConnectors(limit){
  let list=state.data?.connectors||[]; if(limit) list=list.slice(0,limit);
  if(!list.length) return emptyState('Aucun connecteur','Aucun connecteur n’est enregistré dans Founder OS.','automations');
  return `<div class="connector-list">${list.map(c=>`<div class="connector-row"><div><strong>${e(c.provider||c.id)}</strong><span>${e((c.capabilities||[]).join(' · ')||'Aucune capacité déclarée')}</span></div><div class="connector-status">${statusTag(c.status)}</div></div>`).join('')}</div>`;
}
function renderTimeline(limit=10){
  const events=(state.data?.events||[]).slice(0,limit);
  if(!events.length) return emptyState('Aucune activité récente','Les prochains événements Founder OS apparaîtront ici.','activity');
  return `<div class="timeline">${events.map(ev=>`<div class="timeline-row"><div class="timeline-time">${e(fmtDate(ev.occurred_at))}</div><div class="timeline-content"><strong>${e(ev.event_type||'Événement')}</strong><span>${e(ev.source||'source')}${ev.entity_type?` · ${e(ev.entity_type)}`:''}${ev.entity_id?` · ${e(ev.entity_id)}`:''}</span></div></div>`).join('')}</div>`;
}
function commandPage(){
  const h=systemHealth(); const alerts=openAlerts(); const pending=pendingDecisions(); const active=(state.data.agents||[]).filter(a=>a.active).length; const connected=(state.data.connectors||[]).filter(c=>String(c.status).toLowerCase()==='connected').length;
  return `<section class="summary-strip"><div class="summary-cell"><div class="summary-label">Santé système</div><div class="health-wrap"><div class="health-ring" style="--p:${h}"><span>${h}%</span></div><div class="health-meta"><strong>${e(healthLabel(h))}</strong><span>Calculé sur les signaux Founder OS disponibles</span></div></div></div><div class="summary-cell"><span class="summary-label">Alertes ouvertes</span><span class="summary-value">${alerts.length}</span></div><div class="summary-cell"><span class="summary-label">Décisions en attente</span><span class="summary-value">${pending.length}</span></div><div class="summary-cell"><span class="summary-label">Agents actifs</span><span class="summary-value">${active}<small>/ ${(state.data.agents||[]).length}</small></span></div><div class="summary-cell"><span class="summary-label">Connecteurs connectés</span><span class="summary-value">${connected}<small>/ ${(state.data.connectors||[]).length}</small></span></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">Priorité dirigeant</div><div class="section-title">À traiter maintenant</div></div><div class="section-note">Trié par risque et récence</div></div>${renderAttention()}</section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">Architecture</div><div class="section-title">6 piliers opérationnels</div></div><div class="section-note">État live du control plane</div></div>${renderPillarsRail()}</section>
  <section class="section two-col"><div class="panel"><div class="panel-head"><strong>Agent pulse</strong><button class="btn ghost" data-route="/agents">Voir les 8 agents</button></div><div class="panel-body">${renderAgentTable()}</div></div><div class="panel"><div class="panel-head"><strong>Santé connecteurs</strong><button class="btn ghost" data-route="/automations">Détails</button></div><div class="panel-body">${renderConnectors(8)}</div></div></section>
  <section class="section panel"><div class="panel-head"><strong>Activité récente</strong><button class="btn ghost" data-route="/activity">Journal complet</button></div><div class="panel-body">${renderTimeline(12)}</div></section>`;
}
function decisionsPage(){
  const pending=pendingDecisions(); const history=(state.data?.decisions||[]).filter(d=>!isPendingDecision(d));
  const cards=(arr,pendingMode)=>arr.map(d=>`<article class="decision-card"><div class="decision-top"><div><h3>${e(d.title)}</h3><div class="reason">${e(d.why_now||'Aucun motif supplémentaire fourni.')}</div></div><div>${riskTag(d.risk_class)} ${autonomyTag(d.autonomy_level)}</div></div><div class="decision-meta">${statusTag(d.status)}${d.requires_human?tag('validation humaine','warn'):tag('autonome','ok')}${d.expires_at?tag(`expire ${fmtDate(d.expires_at)}`,''):''}</div>${d.business_impact?`<div class="decision-impact"><strong>Impact business</strong><br>${e(d.business_impact)}</div>`:''}<div class="kv"><label>Action recommandée</label><div class="mono">${e(json(d.recommended_action))}</div></div><div class="kv"><label>Preuve</label><div class="mono">${e(json(d.evidence))}</div></div>${pendingMode?`<div class="decision-actions"><button class="btn danger" data-action="decision-reject" data-id="${e(d.id)}">Refuser</button><button class="btn primary" data-action="decision-approve" data-id="${e(d.id)}">Approuver</button></div>`:''}</article>`).join('');
  return `<section class="section"><div class="section-head"><div><div class="eyebrow">Human-in-the-loop</div><div class="section-title">Validation requise</div></div><div class="section-note">Aucune action externe n’est exécutée depuis cet écran</div></div>${pending.length?cards(pending,true):emptyState('Aucune décision en attente','Les décisions R2–R4 nécessitant votre validation apparaîtront ici.','decisions')}</section><section class="section"><div class="section-head"><div><div class="eyebrow">Historique</div><div class="section-title">Décisions clôturées</div></div></div>${history.length?cards(history.slice(0,30),false):emptyState('Aucun historique','Aucune décision clôturée n’est encore disponible.','activity')}</section>`;
}
function pillarsPage(){
  return `<section class="section"><div class="section-head"><div><div class="eyebrow">Operating model</div><div class="section-title">Les 6 piliers</div></div><div class="section-note">COMMAND · COMMS · FINANCE · CONTENT · KNOWLEDGE · AUTOMATIONS</div></div>${renderPillarsRail()}</section><section class="panel"><div class="panel-head"><strong>SOPs actifs</strong></div><div class="panel-body"><table class="table"><thead><tr><th>SOP</th><th>Pilier</th><th>Agent</th><th>Risque / autonomie</th><th>Validation</th></tr></thead><tbody>${(state.data.sops||[]).map(s=>`<tr><td class="main-cell"><strong>${e(s.id)}</strong><span>${e(s.objective)}</span></td><td>${e(s.pillar_id)}</td><td>${e(s.owner_agent_id)}</td><td>${riskTag(s.risk_class)} ${autonomyTag(s.default_autonomy)}</td><td>${s.approval_required?tag('requise','warn'):tag('non','ok')}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function pillarPage(id){
  const p=(state.data.pillars||[]).find(x=>x.id===id); if(!p) return emptyState('Pilier introuvable','Ce pilier n’existe pas dans le control plane.','pillars');
  const agents=(state.data.agents||[]).filter(a=>a.pillar_id===id); const sops=(state.data.sops||[]).filter(s=>s.pillar_id===id); const alerts=openAlerts().filter(a=>a.pillar_id===id); const runs=(state.data.runs||[]).filter(r=>agents.some(a=>a.id===r.agent_id)).slice(0,20);
  return `<section class="page-grid"><div class="detail-stack"><div class="detail-card"><div class="eyebrow">${e(id)}</div><h2>${e(p.display_name||id)}</h2><p>${e(p.purpose)}</p><div class="decision-meta">${tag(p.active?'actif':'inactif',p.active?'ok':'warn')} ${tag(`${agents.length} agent${agents.length>1?'s':''}`)} ${tag(`${sops.length} SOP${sops.length>1?'s':''}`)} ${tag(`${alerts.length} alerte${alerts.length>1?'s':''}`,alerts.length?'warn':'ok')}</div></div><div class="panel"><div class="panel-head"><strong>Agents du pilier</strong></div><div class="panel-body">${agents.length?`<table class="table"><thead><tr><th>Agent</th><th>Statut</th><th>Autonomie</th></tr></thead><tbody>${agents.map(a=>{const r=latestRun(a.id);return `<tr><td class="main-cell"><strong>${e(a.display_name)}</strong><span>${e(a.mission)}</span></td><td>${r?statusTag(r.status):tag(a.active?'actif':'inactif',a.active?'ok':'warn')}</td><td>${autonomyTag(a.default_autonomy)} ${riskTag(a.max_risk)}</td></tr>`}).join('')}</tbody></table>`:emptyState('Aucun agent','Ce pilier n’a aucun agent associé.','agents')}</div></div><div class="panel"><div class="panel-head"><strong>Exécutions récentes</strong></div><div class="panel-body">${runs.length?`<table class="table"><thead><tr><th>Agent</th><th>Statut</th><th>Créé</th><th>Corrélation</th></tr></thead><tbody>${runs.map(r=>`<tr data-action="show-run" data-id="${e(r.id)}"><td>${e(r.agent_id)}</td><td>${statusTag(r.status)}</td><td>${e(fmtDate(r.created_at))}</td><td class="mono">${e(r.correlation_id)}</td></tr>`).join('')}</tbody></table>`:emptyState('Aucun run','Aucune exécution récente pour ce pilier.','activity')}</div></div></div><aside class="detail-stack"><div class="panel"><div class="panel-head"><strong>Alertes ouvertes</strong></div><div class="panel-body">${alerts.length?alerts.map(a=>`<div class="connector-row"><div><strong>${e(a.summary)}</strong><span>${e(a.component)} · ${e(fmtDate(a.created_at))}</span></div>${statusTag(a.severity)}</div>`).join(''):emptyState('Aucune alerte','Ce pilier ne présente aucune alerte ouverte.','decisions')}</div></div><div class="panel"><div class="panel-head"><strong>SOPs</strong></div><div class="panel-body">${sops.length?sops.map(s=>`<div class="connector-row"><div><strong>${e(s.id)}</strong><span>${e(s.objective)}</span></div><div>${riskTag(s.risk_class)}</div></div>`).join(''):emptyState('Aucune SOP','Aucune procédure n’est rattachée.','knowledge')}</div></div></aside></section>`;
}
function agentsPage(){
  return `<section class="panel"><div class="panel-head"><strong>Registre des 8 agents</strong><span class="section-note">Cliquez un run pour inspecter preuves et sortie</span></div><div class="panel-body">${renderAgentTable(100)}</div></section><section class="section" style="margin-top:22px"><div class="section-head"><div><div class="eyebrow">Exécutions</div><div class="section-title">Historique récent</div></div></div><div class="panel"><div class="panel-body">${(state.data.runs||[]).length?`<table class="table"><thead><tr><th>Agent</th><th>Statut</th><th>Risque / autonomie</th><th>Créé</th><th>Corrélation</th></tr></thead><tbody>${state.data.runs.slice(0,50).map(r=>`<tr data-action="show-run" data-id="${e(r.id)}"><td>${e(r.agent_id)}</td><td>${statusTag(r.status)}</td><td>${riskTag(r.risk_class)} ${autonomyTag(r.autonomy_level)}</td><td>${e(fmtDate(r.created_at))}</td><td class="mono">${e(r.correlation_id)}</td></tr>`).join('')}</tbody></table>`:emptyState('Aucune exécution','Les futurs runs seront listés ici.','activity')}</div></div></section>`;
}
function automationsPage(){
  const out=state.data.outbox||[];
  return `<section class="section two-col"><div class="panel"><div class="panel-head"><strong>Matrice des connecteurs</strong><span class="section-note">État déclaré par le control plane</span></div><div class="panel-body">${renderConnectors()}</div></div><div class="panel"><div class="panel-head"><strong>Résumé runtime</strong></div><div class="panel-body"><div class="kv"><label>Connectés</label><strong>${(state.data.connectors||[]).filter(c=>c.status==='connected').length} / ${(state.data.connectors||[]).length}</strong></div><div class="kv"><label>Outbox en attente</label><strong>${out.filter(o=>['pending','queued','retrying'].includes(String(o.status).toLowerCase())).length}</strong></div><div class="kv"><label>Runs récents</label><strong>${(state.data.runs||[]).length}</strong></div><div class="kv"><label>Runs en erreur</label><strong>${(state.data.runs||[]).filter(r=>['failed','error','unknown'].includes(String(r.status).toLowerCase())).length}</strong></div></div></div></section><section class="panel"><div class="panel-head"><strong>Outbox idempotente</strong><span class="section-note">Lecture seule — aucun retry aveugle</span></div><div class="panel-body">${out.length?`<table class="table"><thead><tr><th>Action</th><th>Connecteur</th><th>Statut</th><th>Tentatives</th><th>Prochaine tentative</th></tr></thead><tbody>${out.slice(0,50).map(o=>`<tr><td class="main-cell"><strong>${e(o.action)}</strong><span class="mono">${e(o.idempotency_key)}</span></td><td>${e(o.connector_id)}</td><td>${statusTag(o.status)}</td><td>${e(o.attempt_count)} / ${e(o.max_attempts)}</td><td>${e(fmtDate(o.next_attempt_at))}</td></tr>`).join('')}</tbody></table>`:emptyState('Outbox vide','Aucune action externe n’est actuellement en file.','automations')}</div></section>`;
}
function knowledgePage(){
  let items=state.data.knowledge||[]; const f=state.filters;
  if(f.knowledgeSearch){ const q=f.knowledgeSearch.toLowerCase(); items=items.filter(x=>`${x.subject} ${x.content} ${x.domain}`.toLowerCase().includes(q)); }
  if(f.knowledgeDomain) items=items.filter(x=>x.domain===f.knowledgeDomain);
  if(f.knowledgeStage) items=items.filter(x=>x.stage===f.knowledgeStage);
  if(f.knowledgeVerified) items=items.filter(x=>String(x.verified)===f.knowledgeVerified);
  const domains=[...new Set((state.data.knowledge||[]).map(x=>x.domain).filter(Boolean))].sort(); const stages=[...new Set((state.data.knowledge||[]).map(x=>x.stage).filter(Boolean))].sort();
  return `<section class="section"><div class="filter-bar"><input class="search" id="knowledgeSearch" placeholder="Rechercher dans la mémoire…" value="${e(f.knowledgeSearch)}"><select class="search" id="knowledgeDomain"><option value="">Tous les domaines</option>${domains.map(v=>`<option ${f.knowledgeDomain===v?'selected':''}>${e(v)}</option>`).join('')}</select><select class="search" id="knowledgeStage"><option value="">Tous les stades</option>${stages.map(v=>`<option ${f.knowledgeStage===v?'selected':''}>${e(v)}</option>`).join('')}</select><select class="search" id="knowledgeVerified"><option value="">Vérifié + non vérifié</option><option value="true" ${f.knowledgeVerified==='true'?'selected':''}>Vérifié</option><option value="false" ${f.knowledgeVerified==='false'?'selected':''}>Non vérifié</option></select></div><div class="panel"><div class="panel-head"><strong>${items.length} élément${items.length>1?'s':''} de connaissance</strong><span class="section-note">Source → Signal → Claim → Fact → Memory</span></div><div class="panel-body">${items.length?`<table class="table"><thead><tr><th>Sujet</th><th>Domaine</th><th>Stade</th><th>Confiance</th><th>Vérifié</th></tr></thead><tbody>${items.map(k=>`<tr data-action="show-knowledge" data-id="${e(k.id)}"><td class="main-cell"><strong>${e(k.subject)}</strong><span>${e((k.content||'').slice(0,95))}${(k.content||'').length>95?'…':''}</span></td><td>${e(k.domain)}</td><td>${tag(k.stage||'—','info')}</td><td>${e(Math.round(Number(k.confidence||0)*100))}%</td><td>${k.verified?tag('oui','ok'):tag('non','warn')}</td></tr>`).join('')}</tbody></table>`:emptyState('Aucun résultat','Modifiez les filtres ou attendez la prochaine promotion de connaissance vérifiée.','search')}</div></div></section>`;
}
function activityPage(){
  const all=(state.data.events||[]);
  return `<section class="panel"><div class="panel-head"><strong>Journal chronologique</strong><span class="section-note">${all.length} événements chargés</span></div><div class="panel-body">${all.length?`<div class="timeline">${all.map(ev=>`<div class="timeline-row"><div class="timeline-time">${e(fmtDate(ev.occurred_at))}</div><div class="timeline-content"><strong>${e(ev.event_type||'Événement')}</strong><span>${e(ev.source||'source')} · ${e(ev.entity_type||'système')} ${ev.entity_id?`· ${e(ev.entity_id)}`:''} · confiance ${e(Math.round(Number(ev.confidence||0)*100))}%</span></div></div>`).join('')}</div>`:emptyState('Journal vide','Aucun événement n’a encore été enregistré.','activity')}</div></section>`;
}
function settingsPage(){
  return `<section class="page-grid"><div class="detail-stack"><div class="detail-card"><h2>Sécurité propriétaire</h2><p>Founder OS est protégé par Supabase Auth + RLS. L’interface ne dispose pas d’une clé privilégiée et n’expose aucun contrôle de production destructif.</p><div class="kv"><label>Compte autorisé</label><strong>${e(OWNER_EMAIL)}</strong></div><div class="kv"><label>Projet data</label><span class="mono">xmdpmtvieqgoorbxytey</span></div><div class="kv"><label>Fuseau</label><strong>${e(TZ)}</strong></div><div class="kv"><label>Session</label><span>${state.session?'Authentifiée':'Non authentifiée'}</span></div></div><div class="panel"><div class="panel-head"><strong>Politiques Founder OS</strong></div><div class="panel-body">${(state.data.policies||[]).length?`<table class="table"><thead><tr><th>Clé</th><th>Scope</th><th>Actif</th><th>Valeur</th></tr></thead><tbody>${state.data.policies.map(p=>`<tr><td>${e(p.policy_key)}</td><td>${e(p.scope_type)} ${e(p.scope_id||'')}</td><td>${p.active?tag('oui','ok'):tag('non','warn')}</td><td class="mono">${e(json(p.policy_value)).slice(0,180)}</td></tr>`).join('')}</tbody></table>`:emptyState('Aucune politique','Aucune politique n’est exposée à cette session.','settings')}</div></div></div><aside class="detail-stack"><div class="detail-card"><h3>Modèle d’autonomie</h3><p>R0 lecture/synthèse → autonome. R1 action interne réversible → autonome. R2 communication externe → préparation et validation. R3 financier/juridique → validation obligatoire. R4 sécurité, secrets, suppression et production → jamais autonome.</p></div><div class="detail-card"><h3>Application</h3><p>Version statique sécurisée, installable en PWA, optimisée Samsung/Android et desktop.</p>${state.installPrompt?'<button class="btn primary" style="margin-top:14px" data-action="install">Installer l’application</button>':'<div class="section-note" style="margin-top:12px">Installation proposée automatiquement par le navigateur quand elle est disponible.</div>'}</div></aside></section>`;
}

function renderPage(){
  const route=currentRoute();
  if(route==='/') return commandPage(); if(route==='/decisions') return decisionsPage(); if(route==='/pillars') return pillarsPage(); if(route.startsWith('/pillar/')) return pillarPage(decodeURIComponent(route.slice('/pillar/'.length))); if(route==='/agents') return agentsPage(); if(route==='/automations') return automationsPage(); if(route==='/knowledge') return knowledgePage(); if(route==='/activity') return activityPage(); if(route==='/settings') return settingsPage(); return commandPage();
}
function loginPage(){
  return `<div class="login-shell"><section class="login-visual"><div class="brand"><div class="brand-mark"><span></span></div><div><strong>SOWHAT FOUNDER OS</strong><small>Central Operating System</small></div></div><div class="login-copy"><h1>Diriger l’écosystème.<br><span>Voir l’essentiel.</span></h1><p>Un cockpit unique pour superviser les 6 piliers, 8 agents IA, décisions, alertes, paiements, mémoire et automatisations — avec validation humaine uniquement quand elle est réellement nécessaire.</p></div><div class="login-micro">Private executive access · Africa/Casablanca</div></section><section class="login-form-wrap"><div class="login-card"><h2>Accès dirigeant</h2><p>Connexion passwordless via Supabase Auth. Seul le compte propriétaire autorisé par le control plane peut lire Founder OS.</p><form id="loginForm"><div class="field"><label>Email propriétaire</label><input id="email" type="email" autocomplete="email" readonly value="${e(OWNER_EMAIL)}"></div><button class="btn primary" type="submit">Recevoir le lien sécurisé</button></form>${state.loginStage==='sent'?`<div class="login-status ok">Email envoyé. Ouvrez le lien sécurisé reçu. Si votre template Supabase contient un code à 6 chiffres, vous pouvez aussi le saisir ci-dessous.<div class="otp-row"><input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="000000"><button class="btn" data-action="verify-otp">Valider</button></div></div>`:''}${state.loginMessage?`<div class="login-status ${state.loginError?'error':'ok'}">${e(state.loginMessage)}</div>`:''}<div class="login-status">Aucune clé administrateur n’est stockée dans cette application. Les droits sont appliqués côté base par RLS.</div></div></section></div>`;
}
function render(){
  const root=document.getElementById('app'); if(!root) return;
  if(!state.session){ root.innerHTML=loginPage(); return; }
  if(state.loading&&!state.data){ root.innerHTML=shell(loader()); return; }
  if(!state.data){ root.innerHTML=shell(`<div class="detail-card"><h2>Impossible de charger Founder OS</h2><p>${e(state.error||'Aucune donnée disponible.')}</p><button class="btn primary" style="margin-top:14px" data-action="refresh">Réessayer</button></div>`); return; }
  root.innerHTML=shell(renderPage());
  if(state.error) toast(state.error,'error');
}

function toast(message,type=''){
  let stack=document.querySelector('.toast-stack'); if(!stack){stack=document.createElement('div');stack.className='toast-stack';document.body.appendChild(stack);} const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;stack.appendChild(el);setTimeout(()=>el.remove(),4200);
}
function modal(title,body,actions=''){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${e(title)}</h3></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn ghost" data-action="close-modal">Annuler</button>${actions}</div></div>`;document.body.appendChild(wrap);return wrap;
}
function closeModal(){ document.querySelector('.modal-backdrop')?.remove(); }
async function confirmDecision(id,decision){
  const d=(state.data.decisions||[]).find(x=>x.id===id); if(!d) return;
  const approve=decision==='approved'; const high=approve&&Number(d.risk_class)>=3;
  const body=`<p>${approve?'Vous confirmez l’approbation de':'Vous confirmez le refus de'} <strong>${e(d.title)}</strong>.</p><p>Cette interface ne lance pas l’action externe : elle enregistre uniquement votre décision dans Founder OS.</p>${high?`<label class="safety-check"><input type="checkbox" id="riskAck"><span>Je confirme avoir examiné le risque ${e(`R${d.risk_class}`)} et les preuves avant approbation.</span></label>`:''}`;
  modal(approve?'Approuver la décision':'Refuser la décision',body,`<button class="btn ${approve?'primary':'danger'}" data-action="confirm-decision" data-id="${e(id)}" data-decision="${e(decision)}" ${high?'data-requires-ack="true"':''}>${approve?'Confirmer l’approbation':'Confirmer le refus'}</button>`);
}
async function applyDecision(id,decision,requiresAck){
  if(requiresAck&&!document.getElementById('riskAck')?.checked){ toast('Confirmez le contrôle de risque avant approbation.','error'); return; }
  const actor=state.session?.user?.email||OWNER_EMAIL;
  try{ await dbPatch('founder_os_decisions',id,{status:decision,decided_by_actor:actor,decided_at:new Date().toISOString()});closeModal();toast(decision==='approved'?'Décision approuvée.':'Décision refusée.','ok');await loadData(true);}catch(err){toast(err.message,'error');}
}
async function acknowledgeAlert(id){
  const a=(state.data.alerts||[]).find(x=>x.id===id);if(!a)return;
  modal('Accuser réception',`<p>Vous confirmez avoir pris connaissance de l’alerte <strong>${e(a.summary)}</strong>.</p><p>Cette action ne marque pas l’incident comme résolu.</p>`,`<button class="btn primary" data-action="confirm-ack" data-id="${e(id)}">Confirmer</button>`);
}
async function applyAck(id){
  const actor=state.session?.user?.email||OWNER_EMAIL;
  try{ await dbPatch('founder_os_alerts',id,{acknowledged_by_actor:actor,acknowledged_at:new Date().toISOString()});closeModal();toast('Alerte prise en compte.','ok');await loadData(true);}catch(err){toast(err.message,'error');}
}
function showRun(id){
  if(!id) return; const r=(state.data.runs||[]).find(x=>x.id===id);if(!r)return;
  modal(`${r.agent_id} · ${r.status}`,`<div class="kv"><label>Corrélation</label><span class="mono">${e(r.correlation_id)}</span></div><div class="kv"><label>Risque</label><div>${riskTag(r.risk_class)} ${autonomyTag(r.autonomy_level)}</div></div><h4>Entrée</h4><pre class="json">${e(json(r.input))}</pre><h4>Sortie</h4><pre class="json">${e(json(r.output))}</pre><h4>Preuves</h4><pre class="json">${e(json(r.evidence))}</pre>${r.error?`<h4>Erreur</h4><pre class="json">${e(json(r.error))}</pre>`:''}`,'');
}
function showKnowledge(id){
  const k=(state.data.knowledge||[]).find(x=>x.id===id);if(!k)return; const edges=(state.data.edges||[]).filter(x=>x.from_id===id||x.to_id===id);
  modal(k.subject,`<div class="decision-meta">${tag(k.domain||'—','info')} ${tag(k.stage||'—','accent')} ${k.verified?tag('vérifié','ok'):tag('non vérifié','warn')} ${tag(`${Math.round(Number(k.confidence||0)*100)}% confiance`)}</div><p>${e(k.content)}</p><div class="kv"><label>Source</label><span>${e(k.source_type||'—')} · ${e(k.source_ref||'—')}</span></div><div class="kv"><label>Relations</label><span>${edges.length}</span></div><h4>Métadonnées</h4><pre class="json">${e(json(k.metadata))}</pre>`,'');
}

async function handleAction(action,el){
  if(action==='refresh'){await loadData(true);return;} if(action==='logout'){await logoutRemote();clearSession();state.data=null;render();return;} if(action==='ack-alert'){acknowledgeAlert(el.dataset.id);return;} if(action==='confirm-ack'){applyAck(el.dataset.id);return;} if(action==='decision-approve'){confirmDecision(el.dataset.id,'approved');return;} if(action==='decision-reject'){confirmDecision(el.dataset.id,'rejected');return;} if(action==='confirm-decision'){applyDecision(el.dataset.id,el.dataset.decision,el.dataset.requiresAck==='true');return;} if(action==='show-run'){showRun(el.dataset.id);return;} if(action==='show-knowledge'){showKnowledge(el.dataset.id);return;} if(action==='close-modal'){closeModal();return;} if(action==='verify-otp'){
    const token=document.getElementById('otp')?.value?.trim();if(!token){toast('Saisissez le code reçu.','error');return;} try{const s=await verifyOtp(OWNER_EMAIL,token);saveSession(s);state.loginMessage='Connexion réussie.';state.loginError=false;state.data=null;await loadData(true);}catch(err){state.loginMessage=err.message;state.loginError=true;render();} return;
  }
  if(action==='install'&&state.installPrompt){state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;render();}
}

document.addEventListener('click',ev=>{
  const routeEl=ev.target.closest('[data-route]');if(routeEl){const p=routeEl.dataset.route;if(p){location.hash=`#${p}`;}return;}
  const act=ev.target.closest('[data-action]');if(act){ev.preventDefault();handleAction(act.dataset.action,act);}
});
document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='loginForm') return;ev.preventDefault();state.loginMessage='Envoi du lien sécurisé…';state.loginError=false;render();
  try{await sendLogin(OWNER_EMAIL);state.loginStage='sent';state.loginMessage='Lien de connexion envoyé à votre adresse propriétaire.';state.loginError=false;}catch(err){state.loginMessage=err.message;state.loginError=true;}render();
});
document.addEventListener('input',ev=>{
  if(ev.target.id==='knowledgeSearch'){state.filters.knowledgeSearch=ev.target.value;render();document.getElementById('knowledgeSearch')?.focus();}
});
document.addEventListener('change',ev=>{
  const map={knowledgeDomain:'knowledgeDomain',knowledgeStage:'knowledgeStage',knowledgeVerified:'knowledgeVerified'};if(map[ev.target.id]){state.filters[map[ev.target.id]]=ev.target.value;render();}
});
window.addEventListener('hashchange',()=>render());
window.addEventListener('online',()=>{state.online=true;loadData(true)});window.addEventListener('offline',()=>{state.online=false;render()});
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();state.installPrompt=ev;render()});
setInterval(()=>{const c=document.getElementById('clock');if(c)c.textContent=fmtDate(Date.now(),false)},30000);

async function init(){
  parseAuthCallback(); await restoreSession(); render(); if(state.session) await loadData(true);
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
}
init();
