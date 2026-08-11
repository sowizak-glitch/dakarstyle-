(() => {
  'use strict';
  if (window.__SAMABUSINESS_COGNITIVE_COPILOT_V19__) return;
  window.__SAMABUSINESS_COGNITIVE_COPILOT_V19__ = true;

  const VERSION = '19.0.0-beta.1';
  const API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-api-v10';
  const CACHE_KEY = 'sama-copilot-workspace-v1';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmt = (v) => `${money.format(Math.max(Number(v || 0), 0))} F`;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  const token = () => { try { if (typeof state !== 'undefined' && state?.token) return state.token; } catch (_) {} return localStorage.getItem('sama-session-v3') || ''; };
  const isWolof = () => { try { return typeof state !== 'undefined' && state?.language === 'wo'; } catch (_) { return false; } };
  const T = (fr, wo) => isWolof() && wo ? wo : fr;
  const todayKey = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Dakar', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  const dayKey = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Dakar', year:'numeric',month:'2-digit',day:'2-digit' }).format(d);
  };

  let workspace = null;
  let loading = null;
  let recognition = null;
  let panelOpen = false;

  const I = {
    spark:'<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    mic:'<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 10a6.5 6.5 0 0 0 13 0M12 16.5V21M9 21h6"/>',
    volume:'<path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    wallet:'<path d="M4 7h15v12H6a2 2 0 0 1-2-2z"/><path d="M4 8a3 3 0 0 1 3-3h10"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
    truck:'<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    box:'<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v9l-9 5-9-5Z"/><path d="M12 13v9"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/>',
    campaign:'<path d="M4 12v4l10 3V5L4 8v4Z"/><path d="M14 9h3a3 3 0 0 1 0 6h-3M6 16l1 5h4"/>',
    simple:'<path d="M5 7h14M5 12h10M5 17h7"/><circle cx="19" cy="17" r="2"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  };
  const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${I[name] || I.spark}</svg>`;

  function styles() {
    if (qs('#sama-copilot-v19-styles')) return;
    const style = document.createElement('style');
    style.id = 'sama-copilot-v19-styles';
    style.textContent = `
      #sama-copilot-fab{position:fixed;z-index:2147483500;right:16px;bottom:88px;height:52px;min-width:82px;border:0;border-radius:18px;padding:0 15px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(145deg,#087253,#07563e);color:#fff;font:900 13px/1 system-ui,-apple-system,sans-serif;box-shadow:0 14px 34px rgba(6,61,45,.25);touch-action:manipulation}
      #sama-copilot-fab svg{width:20px;height:20px}#sama-copilot-fab:active{transform:scale(.97)}
      #sama-copilot-panel{position:fixed;z-index:2147483550;inset:0;background:rgba(15,35,28,.34);backdrop-filter:blur(8px);display:none;align-items:flex-end;justify-content:center;padding:12px}
      #sama-copilot-panel.open{display:flex}
      .sacp-sheet{width:min(720px,100%);max-height:min(88vh,820px);overflow:auto;background:#fbfdfc;border:1px solid #d9e4de;border-radius:24px;box-shadow:0 24px 80px rgba(7,38,27,.26);padding:14px 14px calc(16px + env(safe-area-inset-bottom));color:#10251d}
      .sacp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:-14px;z-index:2;background:rgba(251,253,252,.96);backdrop-filter:blur(16px);padding:10px 2px 11px;border-bottom:1px solid #e6ece8}
      .sacp-title{display:flex;align-items:center;gap:10px}.sacp-logo{width:38px;height:38px;border-radius:13px;background:#e5f4ec;color:#087253;display:grid;place-items:center}.sacp-logo svg{width:21px;height:21px}.sacp-title b{display:block;font-size:17px}.sacp-title small{display:block;color:#65776f;margin-top:2px;font-weight:700}
      .sacp-iconbtn{width:44px;height:44px;border-radius:14px;border:1px solid #dce5e0;background:#fff;color:#40554c;display:grid;place-items:center}.sacp-iconbtn svg{width:19px;height:19px}
      .sacp-brief{margin:14px 0;padding:14px;border:1px solid #d9e6df;border-radius:18px;background:linear-gradient(145deg,#f4faf7,#fff);box-shadow:0 8px 24px rgba(17,50,38,.05)}.sacp-brief strong{font-size:15px}.sacp-brief p{margin:7px 0 0;color:#40554c;font-size:13px;line-height:1.45}
      .sacp-brief-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sacp-mini{height:38px;border-radius:12px;border:1px solid #d8e4de;background:#fff;color:#0a684a;font-weight:850;padding:0 11px;display:inline-flex;align-items:center;gap:7px}.sacp-mini svg{width:16px;height:16px}
      .sacp-search{display:grid;grid-template-columns:1fr 46px;gap:8px;margin:12px 0}.sacp-inputwrap{height:48px;border:1px solid #d8e2dd;border-radius:15px;background:#fff;display:flex;align-items:center;gap:9px;padding:0 12px}.sacp-inputwrap svg{width:18px;height:18px;color:#708178}.sacp-inputwrap input{width:100%;border:0;outline:0;background:transparent;font-size:14px;color:#10251d}.sacp-mic{border:0;border-radius:15px;background:#0a6c4d;color:#fff;display:grid;place-items:center}.sacp-mic svg{width:20px;height:20px}.sacp-mic.listening{background:#a33a42;box-shadow:0 0 0 5px rgba(163,58,66,.10)}
      .sacp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.sacp-action{min-height:88px;border:1px solid #dce6e0;border-radius:17px;background:#fff;text-align:left;padding:11px;color:#162a22;box-shadow:0 5px 16px rgba(17,50,38,.035)}.sacp-action .ico{width:34px;height:34px;border-radius:11px;background:#eaf5ef;color:#0b6b4a;display:grid;place-items:center;margin-bottom:8px}.sacp-action .ico svg{width:18px;height:18px}.sacp-action b{display:block;font-size:12px}.sacp-action small{display:block;margin-top:3px;color:#6d7c75;font-size:10px;line-height:1.25}.sacp-action.warn .ico{background:#fff4db;color:#946300}.sacp-action.danger .ico{background:#fff0f1;color:#a33a42}
      .sacp-results{margin-top:12px}.sacp-result{border:1px solid #dce6e0;border-radius:15px;background:#fff;padding:11px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center}.sacp-result b{font-size:13px}.sacp-result p{margin:3px 0 0;color:#66766f;font-size:11px}.sacp-result button{border:0;background:#eef7f2;color:#087253;border-radius:11px;height:36px;padding:0 10px;font-weight:850;white-space:nowrap}
      .sacp-empty{padding:20px 12px;text-align:center;color:#718078;font-size:12px}
      .sama-now-card{margin:14px 0;padding:14px;border:1px solid #d8e4de;border-radius:19px;background:linear-gradient(150deg,#f7fcf9,#fff);box-shadow:0 8px 24px rgba(17,50,38,.055)}.sama-now-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.sama-now-head b{font-size:14px}.sama-now-head button{border:0;background:#e8f5ee;color:#086548;height:36px;border-radius:12px;padding:0 11px;font-weight:850}.sama-now-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.sama-now-item{padding:10px;border-radius:14px;background:#fff;border:1px solid #e1e9e5;min-width:0}.sama-now-item span{display:block;color:#6a7973;font-size:10px;font-weight:800}.sama-now-item strong{display:block;margin-top:3px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sama-now-item.danger strong{color:#a33a42}.sama-now-item.warn strong{color:#9a6700}.sama-now-advice{margin:10px 0 0;color:#43564d;font-size:12px;line-height:1.4}
      @media(max-width:560px){.sacp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sama-now-list{grid-template-columns:1fr 1fr}.sama-now-item:last-child{grid-column:1/-1}.sacp-sheet{border-radius:22px 22px 14px 14px}.sacp-action{min-height:84px}}
      @media(prefers-reduced-motion:reduce){#sama-copilot-fab,.sacp-mic{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  async function api(action, payload = {}) {
    const session = token();
    if (!session) throw new Error(T('Connectez-vous pour utiliser SAMA.', 'Duggal ngir jëfandikoo SAMA.'));
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type':'application/json', 'x-sama-session':session, 'x-client-info':`sama-copilot/${VERSION}` },
      body: JSON.stringify({ action, ...payload })
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok || result.ok === false) throw new Error(result.error || `Erreur ${response.status}`);
    return result;
  }

  async function loadWorkspace(force = false) {
    if (workspace && !force) return workspace;
    if (loading && !force) return loading;
    loading = (async () => {
      try {
        workspace = await api('sales_ops_workspace', { limit: 1000 });
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at:Date.now(), data:workspace })); } catch (_) {}
        return workspace;
      } catch (error) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
          if (cached?.data) { workspace = cached.data; return workspace; }
        } catch (_) {}
        throw error;
      } finally { loading = null; }
    })();
    return loading;
  }

  function metrics(ws) {
    const today = todayKey();
    const sales = ws?.sales || [];
    const customers = ws?.customers || [];
    const orders = ws?.orders || [];
    const products = ws?.products || [];
    const deliveries = ws?.deliveries || [];
    const todaySales = sales.filter(s => dayKey(s.happened_at) === today);
    const openDeliveryStates = new Set(['pending','unassigned','assigned','picked_up','in_transit','confirmed','preparing','ready','out_for_delivery']);
    const openDeliveries = deliveries.filter(d => openDeliveryStates.has(String(d.status || '').toLowerCase()));
    const due = sales.reduce((a,s) => a + Math.max(Number(s.remaining_amount || 0),0), 0);
    const dueClients = customers.filter(c => Number(c.outstanding_amount || 0) > 0);
    const lowStock = products.filter(p => p.track_stock !== false && Number(p.stock_quantity || 0) <= Math.max(Number(p.low_stock_threshold || 0), 1));
    const todayRevenue = todaySales.reduce((a,s)=>a+Number(s.total_amount||0),0);
    const todayPaid = todaySales.reduce((a,s)=>a+Number(s.paid_amount||0),0);
    const todayProfit = todaySales.reduce((a,s)=>a+Number(s.profit_amount||0),0);
    const deliveriesToday = orders.filter(o => dayKey(o.requested_for) === today && !['delivered','cancelled','failed'].includes(String(o.status || '').toLowerCase()));
    return { todaySales, todayRevenue, todayPaid, todayProfit, openDeliveries, deliveriesToday, due, dueClients, lowStock, customers, orders, products, sales };
  }

  function merchantName(ws) {
    return ws?.merchant?.name || (() => { try { return state?.merchant?.name; } catch (_) { return ''; } })() || 'votre commerce';
  }

  function briefingText(ws) {
    const m = metrics(ws);
    const hour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone:'Africa/Dakar', hour:'2-digit', hour12:false }).format(new Date()));
    const hello = hour < 12 ? T('Bonjour', 'Nanga def') : hour < 18 ? T('Bon après-midi', 'Jàmm nga yendoo') : T('Bonsoir', 'Jàmm nga fanane');
    const parts = [`${hello}.`];
    if (m.todaySales.length) parts.push(T(`Aujourd’hui, ${m.todaySales.length} vente${m.todaySales.length>1?'s':''} pour ${fmt(m.todayRevenue)}.`, `Tey am na ${m.todaySales.length} jaay, ${fmt(m.todayRevenue)}.`));
    else parts.push(T("Aucune vente n’est encore enregistrée aujourd’hui.", 'Jaay bindagul tey.'));
    if (m.deliveriesToday.length) parts.push(T(`${m.deliveriesToday.length} livraison${m.deliveriesToday.length>1?'s':''} prévue${m.deliveriesToday.length>1?'s':''} aujourd’hui.`, `${m.deliveriesToday.length} yónnee lañu war a def tey.`));
    else if (m.openDeliveries.length) parts.push(T(`${m.openDeliveries.length} livraison${m.openDeliveries.length>1?'s':''} reste${m.openDeliveries.length>1?'nt':''} ouverte${m.openDeliveries.length>1?'s':''}.`, `${m.openDeliveries.length} yónnee des na.`));
    if (m.due > 0) parts.push(T(`${fmt(m.due)} restent à encaisser auprès de ${m.dueClients.length} client${m.dueClients.length>1?'s':''}.`, `${fmt(m.due)} lañu la war a fay ci ${m.dueClients.length} kiliyaan.`));
    if (m.lowStock.length) parts.push(T(`${m.lowStock.length} produit${m.lowStock.length>1?'s':''} demande${m.lowStock.length>1?'nt':''} votre attention côté stock.`, `${m.lowStock.length} produit lañu wara seet ci stock.`));
    if (!m.due && !m.openDeliveries.length && !m.lowStock.length && m.todaySales.length) parts.push(T('Aucune urgence opérationnelle détectée.', 'Jafe-jafe bu gaaw amul.'));
    return parts.join(' ');
  }

  function topAdvice(ws) {
    const m = metrics(ws);
    if (m.due > 0) return T(`Priorité : récupérer ${fmt(m.due)} encore dus. SAMA peut préparer les relances.`, `Li gën a gaaw: jot ${fmt(m.due)} yi des. SAMA man na waajal relance yi.`);
    if (m.deliveriesToday.length) return T(`Priorité : sécuriser ${m.deliveriesToday.length} livraison${m.deliveriesToday.length>1?'s':''} prévue${m.deliveriesToday.length>1?'s':''} aujourd’hui.`, `Li gën a gaaw: topp ${m.deliveriesToday.length} yónnee yi tey.`);
    if (m.lowStock.length) return T(`Priorité : vérifier ${m.lowStock.length} produit${m.lowStock.length>1?'s':''} en stock faible.`, `Li gën a gaaw: seet ${m.lowStock.length} produit yi néew.`);
    return T('Tout est calme. Enregistrez la prochaine opération dès qu’elle arrive.', 'Lépp dal na. Bindal jëf bu ci topp bu mu amee.');
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return false;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.92;
      utterance.pitch = 1;
      const voices = speechSynthesis.getVoices?.() || [];
      const preferred = voices.find(v => /^fr([-_]|$)/i.test(v.lang) && /natural|google|microsoft|samsung/i.test(v.name)) || voices.find(v => /^fr([-_]|$)/i.test(v.lang));
      if (preferred) utterance.voice = preferred;
      speechSynthesis.speak(utterance);
      return true;
    } catch (_) { return false; }
  }

  function readVisibleScreen() {
    const nodes = qsa('h1,h2,h3,.kpi-value,.value,.sbso-kpi b,.sama-now-advice').filter(el => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    const unique = [...new Set(nodes.map(n => (n.innerText || n.textContent || '').replace(/\s+/g,' ').trim()).filter(Boolean))].slice(0,14);
    const text = unique.join('. ');
    if (text) speak(text);
    return text;
  }

  function ensureUI() {
    if (!qs('#sama-copilot-fab')) {
      const fab = document.createElement('button');
      fab.id = 'sama-copilot-fab';
      fab.type = 'button';
      fab.setAttribute('aria-label', T('Ouvrir le copilote SAMA', 'Ubbi SAMA'));
      fab.innerHTML = `${icon('spark')}<span>SAMA</span>`;
      fab.onclick = () => openPanel();
      document.body.appendChild(fab);
    }
    if (!qs('#sama-copilot-panel')) {
      const panel = document.createElement('div');
      panel.id = 'sama-copilot-panel';
      panel.setAttribute('aria-hidden','true');
      panel.innerHTML = `<section class="sacp-sheet" role="dialog" aria-modal="true" aria-label="Copilote SAMA">
        <div class="sacp-head"><div class="sacp-title"><span class="sacp-logo">${icon('spark')}</span><div><b>SAMA Copilote</b><small>${T('Votre commerce, expliqué simplement','Sa liggéey, wax ko ci yoon wu yomb')}</small></div></div><button type="button" class="sacp-iconbtn" data-sacp-close aria-label="Fermer">${icon('close')}</button></div>
        <div class="sacp-brief" data-sacp-brief><strong>${T('Je prépare votre situation…','Maa ngi waajal sa xibaar…')}</strong><p></p><div class="sacp-brief-actions"><button class="sacp-mini" type="button" data-sacp-read>${icon('volume')} ${T('Écouter','Déglu')}</button><button class="sacp-mini" type="button" data-sacp-refresh>${icon('spark')} ${T('Actualiser','Yeesal')}</button></div></div>
        <div class="sacp-search"><label class="sacp-inputwrap">${icon('search')}<input data-sacp-input autocomplete="off" placeholder="${T('Ex. Qui me doit de l’argent ?','Kan moo ma war a fay ?')}" aria-label="Question à SAMA"></label><button type="button" class="sacp-mic" data-sacp-mic aria-label="Parler à SAMA">${icon('mic')}</button></div>
        <div class="sacp-grid">
          <button class="sacp-action" type="button" data-sacp-action="brief"><span class="ico">${icon('spark')}</span><b>${T('Mon briefing','Sama xibaar')}</b><small>${T('Ce qui compte maintenant','Li gën a am solo léegi')}</small></button>
          <button class="sacp-action danger" type="button" data-sacp-action="debts"><span class="ico">${icon('wallet')}</span><b>${T('À encaisser','Xaalis bi des')}</b><small>${T('Clients à relancer','Kiliyaan yi ñu wara woo')}</small></button>
          <button class="sacp-action warn" type="button" data-sacp-action="deliveries"><span class="ico">${icon('truck')}</span><b>${T('Livraisons','Yónnee')}</b><small>${T('Aujourd’hui et en retard','Tey ak yi yàgg')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="stock"><span class="ico">${icon('box')}</span><b>${T('Stock faible','Stock bu néew')}</b><small>${T('À recommander bientôt','Li ñu wara jëndaat')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="marketing"><span class="ico">${icon('campaign')}</span><b>${T('Marketing','Marketing')}</b><small>${T('Relances et campagnes','Relance ak campagne')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="capture"><span class="ico">${icon('camera')}</span><b>${T('Photo / cahier','Foto / kaye')}</b><small>${T('Préparer une saisie','Waajal bind bi')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="simple"><span class="ico">${icon('simple')}</span><b>${T('Mode simple','Yoon wu yomb')}</b><small>${T('Plus gros, plus clair','Gën a mag, gën a leer')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="read"><span class="ico">${icon('volume')}</span><b>${T('Lire cet écran','Jàngal écran bi')}</b><small>${T('SAMA vous explique','SAMA dina la ko wax')}</small></button>
          <button class="sacp-action" type="button" data-sacp-action="clients"><span class="ico">${icon('users')}</span><b>${T('Chercher client','Seet kiliyaan')}</b><small>${T('Nom, téléphone, quartier','Tur, telefon, dëkk')}</small></button>
        </div>
        <div class="sacp-results" data-sacp-results></div>
      </section>`;
      panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });
      document.body.appendChild(panel);
      qs('[data-sacp-close]',panel).onclick = closePanel;
      qs('[data-sacp-read]',panel).onclick = () => workspace && speak(briefingText(workspace));
      qs('[data-sacp-refresh]',panel).onclick = () => refreshPanel(true);
      qs('[data-sacp-input]',panel).addEventListener('input', e => handleQuery(e.target.value));
      qs('[data-sacp-input]',panel).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleQuery(e.currentTarget.value, true); } });
      qs('[data-sacp-mic]',panel).onclick = startListening;
      qsa('[data-sacp-action]',panel).forEach(btn => btn.onclick = () => handleAction(btn.dataset.sacpAction));
    }
  }

  async function openPanel() {
    ensureUI();
    panelOpen = true;
    const panel = qs('#sama-copilot-panel');
    panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    await refreshPanel(false);
    setTimeout(()=>qs('[data-sacp-input]',panel)?.focus(),120);
  }
  function closePanel() {
    panelOpen = false;
    const panel = qs('#sama-copilot-panel');
    panel?.classList.remove('open'); panel?.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    try { recognition?.stop(); } catch (_) {}
  }

  async function refreshPanel(force) {
    ensureUI();
    const box = qs('[data-sacp-brief]');
    try {
      const ws = await loadWorkspace(force);
      const p = qs('p',box); qs('strong',box).textContent = T(`Situation de ${merchantName(ws)}`, `Xibaaru ${merchantName(ws)}`); p.textContent = briefingText(ws);
      renderNowCard(ws);
      if (panelOpen && !qs('[data-sacp-input]').value) renderPriority(ws);
    } catch (error) {
      qs('strong',box).textContent = T('SAMA est momentanément hors ligne','SAMA amul connexion léegi');
      qs('p',box).textContent = error.message;
    }
  }

  function renderNowCard(ws) {
    const m = metrics(ws);
    let card = qs('#sama-now-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'sama-now-card'; card.className = 'sama-now-card'; card.setAttribute('aria-label', T('À faire maintenant','Li nga wara def léegi'));
      const headings = qsa('h2,h3').filter(h => /chiffres|attention|maintenant/i.test(fold(h.textContent)));
      const anchor = headings[0]?.closest('section,div') || qs('main')?.firstElementChild || qs('main');
      if (anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else qs('main')?.prepend(card);
    }
    card.innerHTML = `<div class="sama-now-head"><b>SAMA · ${T('À faire maintenant','Li nga wara def léegi')}</b><button type="button" data-sama-now-open>${T('Ouvrir le copilote','Ubbi SAMA')}</button></div>
      <div class="sama-now-list">
        <div class="sama-now-item ${m.due>0?'danger':''}"><span>${T('À encaisser','Xaalis bi des')}</span><strong>${fmt(m.due)}</strong></div>
        <div class="sama-now-item ${m.openDeliveries.length?'warn':''}"><span>${T('Livraisons ouvertes','Yónnee yi des')}</span><strong>${m.openDeliveries.length}</strong></div>
        <div class="sama-now-item ${m.lowStock.length?'warn':''}"><span>${T('Stock à surveiller','Stock bu wara seet')}</span><strong>${m.lowStock.length}</strong></div>
      </div><p class="sama-now-advice">${esc(topAdvice(ws))}</p>`;
    qs('[data-sama-now-open]',card).onclick = openPanel;
  }

  function resultHtml(title, subtitle, actionLabel, data = '') {
    return `<div class="sacp-result"><div><b>${esc(title)}</b><p>${esc(subtitle)}</p></div>${actionLabel?`<button type="button" ${data}>${esc(actionLabel)}</button>`:''}</div>`;
  }
  function setResults(html) {
    const box = qs('[data-sacp-results]'); if (box) box.innerHTML = html || `<div class="sacp-empty">${T('Posez une question ou choisissez une action.','Laajal walla tànn benn jëf.')}</div>`;
    bindResultActions();
  }
  function bindResultActions() {
    qsa('[data-sacp-client-open]').forEach(b => b.onclick = () => openClientSearch(b.dataset.sacpClientOpen));
    qsa('[data-sacp-nav]').forEach(b => b.onclick = () => openSales(b.dataset.sacpNav));
    qsa('[data-sacp-market]').forEach(b => b.onclick = () => window.dispatchEvent(new CustomEvent('sama:open-marketing', { detail:{ segment:b.dataset.sacpMarket } })));
    qsa('[data-sacp-product]').forEach(b => b.onclick = () => openStockSearch(b.dataset.sacpProduct));
  }

  function renderPriority(ws) {
    const m = metrics(ws);
    let html = '';
    if (m.due > 0) html += resultHtml(T('Argent à récupérer','Xaalis bi des'), `${m.dueClients.length} client(s) · ${fmt(m.due)}`, T('Voir','Gis'), 'data-sacp-nav="receivables"');
    if (m.openDeliveries.length) html += resultHtml(T('Livraisons ouvertes','Yónnee yi des'), `${m.openDeliveries.length} livraison(s)`, T('Voir','Gis'), 'data-sacp-nav="deliveries"');
    if (m.lowStock.length) html += resultHtml(T('Stock faible','Stock bu néew'), `${m.lowStock.length} produit(s) à vérifier`, T('Voir','Gis'), `data-sacp-product="${esc(m.lowStock[0]?.name||'')}"`);
    if (!html) html = resultHtml(T('Situation calme','Lépp dal na'), T('Aucune urgence détectée.','Jafe-jafe bu gaaw amul.'), '', '');
    setResults(html);
  }

  function handleQuery(raw, submitted = false) {
    const q = fold(raw);
    if (!workspace) return;
    if (!q) return renderPriority(workspace);
    const m = metrics(workspace);
    if (/doit|doivent|dette|reste|encaisser|fay/.test(q)) {
      const list = m.dueClients.slice(0,12).map(c => resultHtml(c.name || 'Client', `${fmt(c.outstanding_amount)} · ${c.phone||c.whatsapp||''}`, T('Ouvrir','Ubbi'), `data-sacp-client-open="${esc(c.name||c.phone||'')}"`)).join('');
      return setResults(list || resultHtml(T('Aucune dette client','Kiliyaan amul bor'), T('Tous les clients sont à zéro.','Kiliyaan yi yépp amuñu li des.'), '', ''));
    }
    if (/livr|yonnee|commande/.test(q)) return setResults(resultHtml(T('Livraisons','Yónnee'), `${m.openDeliveries.length} ouverte(s) · ${m.deliveriesToday.length} prévue(s) aujourd’hui`, T('Ouvrir','Ubbi'), 'data-sacp-nav="deliveries"'));
    if (/stock|manque|rupture|produit/.test(q)) {
      const list = m.products.filter(p => fold(p.name).includes(q.replace(/stock|manque|rupture|produit/g,'').trim()) || m.lowStock.includes(p)).slice(0,12).map(p => resultHtml(p.name, `${T('Stock','Stock')} ${Number(p.stock_quantity||0)} · ${fmt(p.sale_price)}`, T('Voir stock','Gis stock'), `data-sacp-product="${esc(p.name)}"`)).join('');
      return setResults(list || resultHtml(T('Aucun produit trouvé','Produit gisul'), T('Essayez un autre nom.','Jéem beneen tur.'), '', ''));
    }
    if (/aujourd|vente|vendu|chiffre|benefice|gagne|tey/.test(q)) {
      const text = `${m.todaySales.length} vente(s) · ${fmt(m.todayRevenue)} vendu · ${fmt(m.todayPaid)} encaissé${m.todayProfit ? ` · ${fmt(m.todayProfit)} bénéfice sur ventes` : ''}`;
      setResults(resultHtml(T('Aujourd’hui','Tey'), text, submitted ? T('Écouter','Déglu') : '', submitted ? 'data-sacp-speak="1"' : ''));
      qsa('[data-sacp-speak]').forEach(b=>b.onclick=()=>speak(text));
      if (submitted) speak(text);
      return;
    }
    if (/marketing|campagne|relance|ancien client|dormant/.test(q)) { window.dispatchEvent(new CustomEvent('sama:open-marketing')); return; }
    const clientMatches = m.customers.filter(c => [c.name,c.phone,c.whatsapp,c.default_area,c.default_address].some(v => fold(v).includes(q))).slice(0,12);
    const productMatches = m.products.filter(p => [p.name,p.sku,p.category].some(v => fold(v).includes(q))).slice(0,8);
    let html = clientMatches.map(c => resultHtml(c.name || 'Client', `${c.phone||c.whatsapp||''}${c.default_area?` · ${c.default_area}`:''} · ${T('reste','li des')} ${fmt(c.outstanding_amount)}`, T('Ouvrir','Ubbi'), `data-sacp-client-open="${esc(c.name||c.phone||'')}"`)).join('');
    html += productMatches.map(p => resultHtml(p.name, `${T('Stock','Stock')} ${Number(p.stock_quantity||0)} · ${fmt(p.sale_price)}`, T('Stock','Stock'), `data-sacp-product="${esc(p.name)}"`)).join('');
    setResults(html || resultHtml(T('Aucun résultat','Dara gisul'), T('Essayez un nom, un téléphone, une dette, une livraison ou un produit.','Jéem tur, telefon, bor, yónnee walla produit.'), '', ''));
  }

  async function handleAction(action) {
    if (action === 'simple') { window.SamaDesignSystem?.toggleSimple?.(); return; }
    if (action === 'read') { const text = readVisibleScreen(); if (!text && workspace) speak(briefingText(workspace)); return; }
    if (action === 'marketing') { window.dispatchEvent(new CustomEvent('sama:open-marketing')); return; }
    if (action === 'capture') { window.dispatchEvent(new CustomEvent('sama:open-capture')); return; }
    if (!workspace) { try { await refreshPanel(false); } catch (_) {} }
    if (!workspace) return;
    const m = metrics(workspace);
    if (action === 'brief') { const text = briefingText(workspace); setResults(resultHtml(T('Votre briefing','Sa xibaar'), text, T('Écouter','Déglu'), 'data-sacp-speak="1"')); qsa('[data-sacp-speak]').forEach(b=>b.onclick=()=>speak(text)); return; }
    if (action === 'debts') { qs('[data-sacp-input]').value = T('Qui me doit de l’argent ?','Kan moo ma war a fay ?'); handleQuery(qs('[data-sacp-input]').value); return; }
    if (action === 'deliveries') { setResults(resultHtml(T('Livraisons à suivre','Yónnee yi ñu wara topp'), `${m.openDeliveries.length} ouverte(s), ${m.deliveriesToday.length} prévue(s) aujourd’hui`, T('Ouvrir','Ubbi'), 'data-sacp-nav="deliveries"')); return; }
    if (action === 'stock') { const list=m.lowStock.slice(0,12).map(p=>resultHtml(p.name,`${Number(p.stock_quantity||0)} restant(s) · seuil ${Number(p.low_stock_threshold||0)}`,T('Voir','Gis'),`data-sacp-product="${esc(p.name)}"`)).join(''); setResults(list||resultHtml(T('Stock sous contrôle','Stock baax na'),T('Aucun produit sous le seuil.','Produit amul ci suufu seuil bi.'),'','')); return; }
    if (action === 'clients') { qs('[data-sacp-input]').focus(); qs('[data-sacp-input]').placeholder = T('Tapez le nom ou le téléphone du client','Bind tur walla telefonu kiliyaan bi'); return; }
  }

  function openSales(tab='clients') {
    closePanel();
    const nav = qsa('[data-nav="sales"],.nav-btn').find(b => b.dataset.nav === 'sales' || /ventes|jaay/i.test(b.textContent || ''));
    nav?.click();
    setTimeout(() => qs(`[data-sbso-tab="${tab}"]`)?.click(), 320);
  }
  function openClientSearch(term) {
    closePanel(); openSales('clients');
    setTimeout(() => {
      const input = qs('#sbso-shell .sbso-search input,#sbso-shell input[type="search"]');
      if (!input) return;
      input.value = term; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus();
    }, 520);
  }
  function openStockSearch(term) {
    closePanel();
    const nav = qsa('[data-nav="stock"],.nav-btn').find(b => b.dataset.nav === 'stock' || /stock/i.test(b.textContent || ''));
    nav?.click();
    setTimeout(() => {
      const input = qsa('input').find(i => /produit|stock|recher/i.test(i.placeholder||''));
      if (input) { input.value = term; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); }
    }, 380);
  }

  function startListening() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = qs('[data-sacp-mic]');
    if (!Ctor) {
      setResults(resultHtml(T('Commande vocale indisponible','Wax ak SAMA amul'), T('Votre navigateur ne fournit pas la reconnaissance vocale ici. Vous pouvez toujours taper votre question.','Sa navigateur joxul recognition vocal fii.'), '', ''));
      return;
    }
    try { recognition?.abort(); } catch (_) {}
    recognition = new Ctor(); recognition.lang = 'fr-FR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => button?.classList.add('listening');
    recognition.onend = () => button?.classList.remove('listening');
    recognition.onerror = () => button?.classList.remove('listening');
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const input = qs('[data-sacp-input]'); input.value = transcript; handleQuery(transcript, true);
    };
    recognition.start();
  }

  function boot() {
    styles(); ensureUI();
    if (token()) loadWorkspace(false).then(ws => { renderNowCard(ws); }).catch(()=>{});
    document.documentElement.dataset.samaCopilotVersion = VERSION;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && token()) loadWorkspace(true).then(renderNowCard).catch(()=>{}); });
    window.addEventListener('sama:data-changed', () => loadWorkspace(true).then(ws => { renderNowCard(ws); if(panelOpen) refreshPanel(false); }).catch(()=>{}));
  }

  window.SamaCopilot = Object.freeze({ version:VERSION, open:openPanel, close:closePanel, refresh:()=>loadWorkspace(true), speak, readVisibleScreen, getWorkspace:()=>workspace, briefing:()=>workspace?briefingText(workspace):'' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
