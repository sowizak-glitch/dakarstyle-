(() => {
  'use strict';
  if (window.__SAMABUSINESS_OPERATIONAL_INTELLIGENCE_V19__) return;
  window.__SAMABUSINESS_OPERATIONAL_INTELLIGENCE_V19__ = true;

  const VERSION = '19.0.0-beta.2';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmt = v => `${money.format(Math.max(Number(v || 0), 0))} F`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const isWolof = () => { try { return typeof state !== 'undefined' && state?.language === 'wo'; } catch (_) { return false; } };
  const T = (fr, wo) => isWolof() && wo ? wo : fr;
  const dayKey = value => {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-CA', { timeZone:'Africa/Dakar', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
  };
  const todayKey = () => dayKey(new Date());

  const I = {
    message:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15Z"/><path d="M8 11h8M8 15h5"/>',
    robot:'<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/><circle cx="12" cy="3" r="1"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    alert:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
    box:'<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v9l-9 5-9-5Z"/>',
    truck:'<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    wallet:'<path d="M4 7h15v12H6a2 2 0 0 1-2-2z"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${I[name] || I.robot}</svg>`;

  function installStyles() {
    if (qs('#sama-operational-intelligence-styles')) return;
    const style = document.createElement('style');
    style.id = 'sama-operational-intelligence-styles';
    style.textContent = `
      .saoi-finance{margin-top:10px;border-radius:15px;padding:11px;background:#f2f8f5;border:1px solid #d7e7df;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.saoi-finance span{font-size:9px;font-weight:850;color:#6a7973;display:block}.saoi-finance strong{font-size:13px;display:block;margin-top:3px}.saoi-finance .real strong{color:#087153}.saoi-finance .negative strong{color:#a33a42}
      .saoi-plan{border:1px solid #dbe6e0;border-radius:17px;background:#fff;padding:12px;margin-bottom:9px}.saoi-plan-head{display:flex;gap:9px;align-items:flex-start}.saoi-plan-head .ico{width:34px;height:34px;border-radius:11px;background:#eaf5ef;color:#087153;display:grid;place-items:center;flex:none}.saoi-plan-head .ico svg{width:18px;height:18px}.saoi-plan-head b{font-size:13px}.saoi-plan-head p{font-size:11px;color:#65766e;line-height:1.4;margin:3px 0 0}.saoi-plan-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.saoi-plan-actions button{height:38px;border-radius:12px;border:1px solid #cfe0d7;background:#f4faf7;color:#087153;font-weight:850;padding:0 11px}.saoi-plan-actions button.primary{background:#087153;color:#fff;border-color:#087153}
      .saoi-inbox{border:1px solid #dce6e0;border-radius:15px;background:#fff;padding:10px;margin-bottom:8px}.saoi-inbox b{font-size:12px}.saoi-inbox p{font-size:10px;line-height:1.35;color:#6a7973;margin:3px 0}.saoi-inbox .missing{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.saoi-inbox .missing span{font-size:9px;font-weight:800;padding:5px 7px;border-radius:999px;background:#fff4dc;color:#8c6100;border:1px solid #f1dfb7}.saoi-inbox button{margin-top:8px;height:36px;border:0;border-radius:11px;background:#edf7f2;color:#087153;font-weight:850;padding:0 10px}
      #sama-now-card .sama-now-list.saoi-four{grid-template-columns:repeat(4,minmax(0,1fr))}.sama-now-item.profit strong{color:#087153}.sama-now-item.loss strong{color:#a33a42}
      @media(max-width:620px){#sama-now-card .sama-now-list.saoi-four{grid-template-columns:1fr 1fr}.saoi-finance{grid-template-columns:1fr 1fr}.saoi-finance>div:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function ws() { return window.SamaCopilot?.getWorkspace?.() || null; }
  function intelligence(data) {
    const today = todayKey();
    const sales = data?.sales || [], expenses = data?.expenses || [], orders = data?.orders || [], products = data?.products || [], customers = data?.customers || [];
    const todaySales = sales.filter(s => dayKey(s.happened_at) === today);
    const saleProfit = todaySales.reduce((a,s) => a + Number(s.profit_amount || 0), 0);
    const todayExpenses = expenses.filter(e => dayKey(e.happened_at) === today && String(e.scope || 'business') !== 'personal');
    const expensesTotal = todayExpenses.reduce((a,e) => a + Number(e.amount || 0), 0);
    const realProfit = saleProfit - expensesTotal;
    const dueTotal = sales.reduce((a,s) => a + Math.max(Number(s.remaining_amount || 0),0), 0);
    const openDelivery = orders.filter(o => !['delivered','cancelled','failed'].includes(String(o.status || '').toLowerCase()) && (o.delivery_id || o.delivery_status && o.delivery_status !== 'none'));
    const lowStock = products.filter(p => p.track_stock !== false && Number(p.stock_quantity || 0) <= Math.max(Number(p.low_stock_threshold || 0),1));
    const inbox = orders.filter(o => {
      const source = fold(`${o.source || ''} ${o.checkout_channel || ''}`);
      const missing = Array.isArray(o.missing_fields) ? o.missing_fields.filter(Boolean) : [];
      const hasMessage = Boolean(String(o.raw_message || o.whatsapp_message || '').trim());
      return (source.includes('whatsapp') || hasMessage) && (missing.length > 0 || ['draft','pending','new'].includes(String(o.status || '').toLowerCase()));
    });
    const dueClients = customers.filter(c => Number(c.outstanding_amount || 0) > 0);
    return { todaySales, saleProfit, expensesTotal, realProfit, dueTotal, openDelivery, lowStock, inbox, dueClients };
  }

  function decorateBrief() {
    const data = ws(); if (!data) return;
    const brief = qs('#sama-copilot-panel [data-sacp-brief]'); if (!brief) return;
    const m = intelligence(data);
    let finance = qs('.saoi-finance', brief);
    if (!finance) { finance = document.createElement('div'); finance.className='saoi-finance'; brief.appendChild(finance); }
    finance.innerHTML = `<div><span>${T('MARGE DES VENTES','NJARIÑ CI JAAY')}</span><strong>${fmt(m.saleProfit)}</strong></div><div><span>${T('DÉPENSES DU JOUR','Xaalis bu génn tey')}</span><strong>${fmt(m.expensesTotal)}</strong></div><div class="real ${m.realProfit<0?'negative':''}"><span>${T('BÉNÉFICE RÉEL ESTIMÉ','NJARIÑ DËGG')}</span><strong>${m.realProfit<0?'-':''}${fmt(Math.abs(m.realProfit))}</strong></div>`;
  }

  function decorateHome() {
    const data=ws(), card=qs('#sama-now-card'); if(!data || !card) return;
    const m=intelligence(data), list=qs('.sama-now-list',card); if(!list) return;
    list.classList.add('saoi-four');
    let profit=qs('.sama-now-item[data-saoi-profit]',list);
    if(!profit){profit=document.createElement('div');profit.className='sama-now-item';profit.dataset.saoiProfit='1';list.appendChild(profit);}
    profit.className=`sama-now-item ${m.realProfit<0?'loss':'profit'}`;
    profit.innerHTML=`<span>${T('Bénéfice réel estimé','Njariñ dëgg')}</span><strong>${m.realProfit<0?'-':''}${fmt(Math.abs(m.realProfit))}</strong>`;
  }

  function addCopilotActions() {
    const panel=qs('#sama-copilot-panel'), grid=qs('.sacp-grid',panel); if(!grid) return;
    const extras=[
      ['inbox','message',T('WhatsApp à traiter','WhatsApp yi des'),T('Commandes incomplètes','Komànd yu matul')],
      ['agent','robot',T('Agent Bêta','Agent Beta'),T('Prépare les prochaines actions','Waajal jëf yi ci topp')],
      ['profit','chart',T('Bénéfice réel','Njariñ dëgg'),T('Ventes moins dépenses','Jaay waññi dépenses')],
    ];
    extras.forEach(([action,ico,title,hint])=>{
      if(qs(`[data-saoi-action="${action}"]`,grid))return;
      const button=document.createElement('button');button.type='button';button.className='sacp-action';button.dataset.saoiAction=action;button.innerHTML=`<span class="ico">${icon(ico)}</span><b>${esc(title)}</b><small>${esc(hint)}</small>`;button.onclick=()=>handle(action);grid.appendChild(button);
    });
  }

  function results(html){const box=qs('#sama-copilot-panel [data-sacp-results]');if(box)box.innerHTML=html;bind();}
  function bind(){
    qsa('[data-saoi-nav]').forEach(b=>b.onclick=()=>navigateSales(b.dataset.saoiNav));
    qsa('[data-saoi-market]').forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent('sama:open-marketing',{detail:{segment:b.dataset.saoiMarket}})));
    qsa('[data-saoi-stock]').forEach(b=>b.onclick=()=>navigateStock(b.dataset.saoiStock));
    qsa('[data-saoi-client]').forEach(b=>b.onclick=()=>navigateClient(b.dataset.saoiClient));
  }

  function handle(action){const data=ws();if(!data)return;const m=intelligence(data);
    if(action==='profit'){
      const tone=m.realProfit>=0?T('Votre commerce est positif aujourd’hui selon les données enregistrées.','Sa commerce am na njariñ tey ci li bind nañu.'):T('Les dépenses enregistrées dépassent la marge des ventes aujourd’hui.','Dépenses yi ëpp nañu njariñu jaay tey.');
      return results(`<div class="saoi-plan"><div class="saoi-plan-head"><span class="ico">${icon('chart')}</span><div><b>${T('Bénéfice réel estimé','Njariñ dëgg')}</b><p>${esc(tone)}</p></div></div><div class="saoi-finance"><div><span>${T('Marge ventes','Njariñ jaay')}</span><strong>${fmt(m.saleProfit)}</strong></div><div><span>${T('Dépenses','Dépenses')}</span><strong>${fmt(m.expensesTotal)}</strong></div><div class="real ${m.realProfit<0?'negative':''}"><span>${T('Reste réel','Li des')}</span><strong>${m.realProfit<0?'-':''}${fmt(Math.abs(m.realProfit))}</strong></div></div></div>`);
    }
    if(action==='inbox')return renderInbox(m);
    if(action==='agent')return renderPlan(m);
  }

  function renderInbox(m){
    if(!m.inbox.length)return results(`<div class="saoi-plan"><div class="saoi-plan-head"><span class="ico">${icon('check')}</span><div><b>${T('WhatsApp est à jour','WhatsApp baax na')}</b><p>${T('Aucune commande WhatsApp incomplète détectée dans les données disponibles.','Komànd WhatsApp bu matul gisul.')}</p></div></div></div>`);
    const html=m.inbox.slice(0,20).map(o=>{const missing=Array.isArray(o.missing_fields)?o.missing_fields.filter(Boolean):[];const label=o.customer_name||o.customer_phone||o.order_number||T('Commande WhatsApp','Komànd WhatsApp');return `<div class="saoi-inbox"><b>${esc(label)}</b><p>${esc(o.order_number||'')} ${o.raw_message?`· ${esc(String(o.raw_message).slice(0,100))}`:''}</p>${missing.length?`<div class="missing">${missing.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<button type="button" data-saoi-nav="today">${T('Ouvrir les ventes','Ubbi jaay yi')}</button></div>`;}).join('');results(html);
  }

  function renderPlan(m){
    const steps=[];
    if(m.inbox.length)steps.push({ico:'message',title:T('Compléter les commandes WhatsApp','Matale komànd WhatsApp yi'),text:`${m.inbox.length} ${T('commande(s) demandent encore une information.','komànd matul.')}`,action:`<button data-saoi-nav="today">${T('Voir','Gis')}</button>`});
    if(m.dueTotal>0)steps.push({ico:'wallet',title:T('Préparer les relances paiement','Waajal relance paiement'),text:`${fmt(m.dueTotal)} · ${m.dueClients.length} client(s)`,action:`<button class="primary" data-saoi-market="due">${T('Préparer','Waajal')}</button>`});
    if(m.openDelivery.length)steps.push({ico:'truck',title:T('Sécuriser les livraisons ouvertes','Topp yónnee yi'),text:`${m.openDelivery.length} ${T('livraison(s) à suivre.','yónnee lañu wara topp.')}`,action:`<button data-saoi-nav="deliveries">${T('Voir','Gis')}</button>`});
    if(m.lowStock.length)steps.push({ico:'box',title:T('Réapprovisionner le stock faible','Yokk stock bu néew'),text:`${m.lowStock.length} ${T('produit(s) sous leur seuil.','produit néew nañu.')}`,action:`<button data-saoi-stock="${esc(m.lowStock[0]?.name||'')}">${T('Voir le stock','Gis stock')}</button>`});
    if(!steps.length)steps.push({ico:'check',title:T('Aucune action urgente','Jëf bu gaaw amul'),text:T('SAMA ne détecte pas de priorité opérationnelle immédiate.','SAMA gisul lu gaaw ngay def.'),action:''});
    results(steps.map((s,i)=>`<div class="saoi-plan"><div class="saoi-plan-head"><span class="ico">${icon(s.ico)}</span><div><b>${i+1}. ${esc(s.title)}</b><p>${esc(s.text)}</p></div></div>${s.action?`<div class="saoi-plan-actions">${s.action}</div>`:''}</div>`).join('')+`<p style="font-size:10px;color:#718078;padding:3px 5px">${T('Agent Bêta prépare et oriente. Il ne valide jamais une vente, un paiement ou un envoi de masse à votre place.','Agent Beta dafay waajal rekk. Du dëggal jaay, paiement walla yónnee ci sa tur.')}</p>`);
  }

  function navigateSales(tab){
    window.SamaCopilot?.close?.();const nav=qsa('[data-nav="sales"],.nav-btn').find(b=>b.dataset.nav==='sales'||/ventes|jaay/i.test(b.textContent||''));nav?.click();setTimeout(()=>qs(`[data-sbso-tab="${tab}"]`)?.click(),330);
  }
  function navigateStock(term){window.SamaCopilot?.close?.();const nav=qsa('[data-nav="stock"],.nav-btn').find(b=>b.dataset.nav==='stock'||/stock/i.test(b.textContent||''));nav?.click();setTimeout(()=>{const input=qsa('input').find(i=>/produit|stock|recher/i.test(i.placeholder||''));if(input&&term){input.value=term;input.dispatchEvent(new Event('input',{bubbles:true}));}},350);}
  function navigateClient(term){window.SamaCopilot?.close?.();navigateSales('clients');setTimeout(()=>{const input=qs('#sbso-shell .sbso-search input,#sbso-shell input[type="search"]');if(input){input.value=term;input.dispatchEvent(new Event('input',{bubbles:true}));}},500);}

  let scheduled=false;
  function decorate(){scheduled=false;installStyles();addCopilotActions();decorateBrief();decorateHome();document.documentElement.dataset.samaOperationalIntelligenceVersion=VERSION;}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('sama:data-changed',schedule);
})();
