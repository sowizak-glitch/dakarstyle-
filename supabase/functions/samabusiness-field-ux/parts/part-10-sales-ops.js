(() => {
  'use strict';
  if (window.__SAMABUSINESS_SALES_OPS_V2__) return;
  window.__SAMABUSINESS_SALES_OPS_V2__ = true;

  const VERSION = '2.0.0';
  const API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-api-v10';
  const PREFIX = 'sbso';
  const CACHE_KEY = 'samabusiness-sales-ops-cache-v2';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmt = (v) => `${money.format(Number(v || 0))} F`;
  const fold = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const token = () => { try { if (typeof state !== 'undefined' && state?.token) return state.token; } catch (_) {} return localStorage.getItem('sama-session-v3') || ''; };
  const wolof = () => { try { return typeof state !== 'undefined' && state?.language === 'wo'; } catch (_) { return false; } };
  const T = (fr, wo) => wolof() && wo ? wo : fr;
  const dayKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Dakar', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value));
  const dateTime = (value) => value ? new Intl.DateTimeFormat('fr-SN', { timeZone:'Africa/Dakar', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : '—';
  const normalizePhone = (value = '') => { let p = String(value).replace(/\D/g,''); if (p.startsWith('00')) p = p.slice(2); if (p.length === 9 && /^[37]/.test(p)) p = `221${p}`; return p; };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;

  let workspace = { customers:[], sales:[], orders:[], deliveries:[], products:[] };
  let activeTab = 'today';
  let query = '';
  let loading = false;

  function notify(title, message = '', kind = '') {
    try { if (typeof toast === 'function') return toast(title, message, kind); } catch (_) {}
    let wrap = qs(`#${PREFIX}-toasts`);
    if (!wrap) { wrap = document.createElement('div'); wrap.id = `${PREFIX}-toasts`; document.body.appendChild(wrap); }
    const n = document.createElement('div'); n.className = `${PREFIX}-toast ${kind}`; n.innerHTML = `<b>${esc(title)}</b>${message ? `<span>${esc(message)}</span>` : ''}`; wrap.appendChild(n); setTimeout(() => n.remove(), 4200);
  }

  async function api(action, payload = {}) {
    const response = await fetch(API, { method:'POST', headers:{'content-type':'application/json','x-sama-session':token(),'x-client-info':`samabusiness-sales-ops/${VERSION}`}, body:JSON.stringify({ action, ...payload }) });
    let result = {}; try { result = await response.json(); } catch (_) {}
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `Action impossible (${response.status})`);
    return result;
  }

  function injectStyles() {
    if (qs(`#${PREFIX}-styles`)) return;
    const style = document.createElement('style'); style.id = `${PREFIX}-styles`;
    style.textContent = `
      :root{--sbso-ink:#10231d;--sbso-green:#0c5b43;--sbso-green2:#0b7350;--sbso-soft:#f3f7f4;--sbso-line:#dce6e0;--sbso-muted:#687a73;--sbso-gold:#e5ae3c;--sbso-warn:#9d6700;--sbso-danger:#a43e3e}
      .${PREFIX}-shell{position:fixed;inset:0;z-index:2450;background:#f7f8f5;color:var(--sbso-ink);display:none;overflow:auto;overscroll-behavior:contain}. ${PREFIX}-shell.open{display:block}
      .${PREFIX}-top{position:sticky;top:0;z-index:4;background:rgba(247,248,245,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--sbso-line);padding:calc(10px + env(safe-area-inset-top)) 14px 10px}
      .${PREFIX}-topline{max-width:1120px;margin:auto;display:flex;align-items:center;gap:10px}. ${PREFIX}-brand{flex:1;min-width:0}. ${PREFIX}-eyebrow{font-size:10px;font-weight:900;letter-spacing:.08em;color:var(--sbso-green2);text-transform:uppercase}. ${PREFIX}-brand h1{font-size:20px;line-height:1.1;margin:2px 0 0}. ${PREFIX}-iconbtn{min-width:46px;height:46px;border:1px solid var(--sbso-line);background:#fff;border-radius:15px;font-weight:900;color:var(--sbso-ink);display:grid;place-items:center;cursor:pointer}. ${PREFIX}-new{border:0;background:linear-gradient(135deg,var(--sbso-green),#117657);color:#fff;border-radius:15px;min-height:46px;padding:0 15px;font-weight:900;box-shadow:0 10px 25px rgba(12,91,67,.18);cursor:pointer}
      .${PREFIX}-main{max-width:1120px;margin:auto;padding:14px 14px 110px}. ${PREFIX}-offline{display:none;background:#fff2d5;border:1px solid #ead08d;color:#704c00;border-radius:14px;padding:10px 12px;font-size:12px;font-weight:800;margin-bottom:10px}. ${PREFIX}-offline.show{display:block}
      .${PREFIX}-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:12px}. ${PREFIX}-kpi{background:#fff;border:1px solid var(--sbso-line);border-radius:18px;padding:12px;box-shadow:0 7px 24px rgba(30,55,45,.04)}. ${PREFIX}-kpi small{display:block;color:var(--sbso-muted);font-size:10px;font-weight:800}. ${PREFIX}-kpi b{display:block;font-size:18px;margin-top:4px}. ${PREFIX}-kpi.warn b{color:var(--sbso-warn)}. ${PREFIX}-kpi.danger b{color:var(--sbso-danger)}
      .${PREFIX}-tools{display:flex;gap:9px;align-items:center;margin-bottom:10px}. ${PREFIX}-search{flex:1;position:relative}. ${PREFIX}-search input{width:100%;min-height:48px;border:1px solid var(--sbso-line);background:#fff;border-radius:15px;padding:0 14px 0 42px;font:inherit;color:var(--sbso-ink);outline:none}. ${PREFIX}-search span{position:absolute;left:14px;top:14px}. ${PREFIX}-search input:focus{border-color:#71a994;box-shadow:0 0 0 3px rgba(11,115,80,.09)}. ${PREFIX}-refresh{min-width:48px;height:48px;border:1px solid var(--sbso-line);background:#fff;border-radius:15px;cursor:pointer}
      .${PREFIX}-tabs{display:flex;gap:7px;overflow:auto;padding:2px 0 10px;scrollbar-width:none}. ${PREFIX}-tabs::-webkit-scrollbar{display:none}. ${PREFIX}-tab{border:1px solid var(--sbso-line);background:#fff;color:#43564f;border-radius:999px;padding:9px 13px;white-space:nowrap;font-size:12px;font-weight:900;cursor:pointer}. ${PREFIX}-tab.active{background:var(--sbso-green);border-color:var(--sbso-green);color:#fff}
      .${PREFIX}-list{display:grid;gap:10px}. ${PREFIX}-card{background:#fff;border:1px solid var(--sbso-line);border-radius:20px;padding:14px;box-shadow:0 8px 28px rgba(22,48,38,.045)}. ${PREFIX}-cardhead{display:flex;gap:8px;align-items:flex-start}. ${PREFIX}-cardtitle{flex:1;min-width:0}. ${PREFIX}-cardtitle b{display:block;font-size:15px}. ${PREFIX}-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;color:var(--sbso-muted);font-size:11px}. ${PREFIX}-badge{border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;background:#edf3ef;color:#3d5d50}. ${PREFIX}-badge.pending{background:#fff3d9;color:#795000}. ${PREFIX}-badge.route{background:#e6f2ff;color:#245d88}. ${PREFIX}-badge.done{background:#e8f6ee;color:#17643f}. ${PREFIX}-badge.due{background:#fff0f0;color:#973a3a}
      .${PREFIX}-items{margin:11px 0;background:var(--sbso-soft);border-radius:14px;padding:9px 10px;display:grid;gap:5px}. ${PREFIX}-item{display:flex;justify-content:space-between;gap:10px;font-size:12px}. ${PREFIX}-moneyrow{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border-top:1px solid #edf1ef;padding-top:10px}. ${PREFIX}-moneyrow small{display:block;color:var(--sbso-muted);font-size:9px;font-weight:800}. ${PREFIX}-moneyrow b{font-size:13px}. ${PREFIX}-moneyrow .due b{color:var(--sbso-danger)}
      .${PREFIX}-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}. ${PREFIX}-act{min-height:43px;border:1px solid var(--sbso-line);background:#fff;color:var(--sbso-ink);border-radius:13px;padding:0 11px;font-size:11px;font-weight:900;cursor:pointer}. ${PREFIX}-act.primary{background:var(--sbso-green);border-color:var(--sbso-green);color:#fff}. ${PREFIX}-act.warn{background:#fff7e6;border-color:#efd59b;color:#704c00}
      .${PREFIX}-empty{text-align:center;background:#fff;border:1px dashed #cbd9d2;border-radius:20px;padding:34px 16px;color:var(--sbso-muted)}. ${PREFIX}-empty b{display:block;color:var(--sbso-ink);font-size:16px;margin-bottom:5px}
      .${PREFIX}-overlay{position:fixed;inset:0;z-index:2600;background:rgba(5,24,17,.55);backdrop-filter:blur(7px);display:none;align-items:flex-end;justify-content:center;padding:10px}. ${PREFIX}-overlay.open{display:flex}. ${PREFIX}-sheet{width:min(680px,100%);max-height:94vh;overflow:auto;background:#fbfcfa;border-radius:24px 24px 18px 18px;box-shadow:0 25px 80px rgba(0,0,0,.28);padding:16px}. ${PREFIX}-sheethead{display:flex;align-items:center;gap:10px;margin-bottom:12px}. ${PREFIX}-sheethead>div{flex:1}. ${PREFIX}-sheethead h2{margin:0;font-size:19px}. ${PREFIX}-sheethead p{margin:3px 0 0;font-size:11px;color:var(--sbso-muted)}
      .${PREFIX}-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}. ${PREFIX}-field{display:flex;flex-direction:column;gap:5px}. ${PREFIX}-field.full{grid-column:1/-1}. ${PREFIX}-field label{font-size:11px;font-weight:900;color:#3e564d}. ${PREFIX}-field input,.${PREFIX}-field select,.${PREFIX}-field textarea{width:100%;min-height:47px;border:1px solid #cad9d2;border-radius:13px;background:#fff;padding:10px 11px;font:inherit;color:var(--sbso-ink);outline:none}. ${PREFIX}-field textarea{min-height:74px;resize:vertical}. ${PREFIX}-field input:focus,.${PREFIX}-field select:focus,.${PREFIX}-field textarea:focus{border-color:#6aa38e;box-shadow:0 0 0 3px rgba(11,115,80,.09)}
      .${PREFIX}-deliverybox{grid-column:1/-1;border:1px solid #d6e2dc;background:#f3f8f5;border-radius:17px;padding:12px}. ${PREFIX}-switch{display:flex;gap:10px;align-items:center;font-weight:900}. ${PREFIX}-switch input{width:22px;height:22px;accent-color:var(--sbso-green)}. ${PREFIX}-deliveryfields{display:none;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}. ${PREFIX}-deliveryfields.open{display:grid}
      .${PREFIX}-lines{grid-column:1/-1;display:grid;gap:8px}. ${PREFIX}-line{display:grid;grid-template-columns:minmax(0,1fr) 70px 110px 42px;gap:7px;align-items:end;background:#f4f7f5;border:1px solid #e1e8e4;border-radius:15px;padding:9px}. ${PREFIX}-line label{font-size:9px;font-weight:900;color:var(--sbso-muted)}. ${PREFIX}-line input,.${PREFIX}-line select{width:100%;min-height:42px;border:1px solid #ccd9d3;border-radius:11px;background:#fff;padding:7px;font:inherit}. ${PREFIX}-remove{width:42px;height:42px;border:1px solid #edd2d2;background:#fff5f5;color:#a33;border-radius:11px;cursor:pointer}. ${PREFIX}-addline{min-height:43px;border:1px dashed #9db9ad;background:#fff;border-radius:12px;color:var(--sbso-green);font-weight:900;cursor:pointer}
      .${PREFIX}-known{grid-column:1/-1;display:none;border:1px solid #b7d7c9;background:#edf8f2;border-radius:14px;padding:10px;font-size:11px}. ${PREFIX}-known.show{display:block}. ${PREFIX}-summary{grid-column:1/-1;display:flex;justify-content:space-between;gap:10px;align-items:center;background:#eaf4ef;border-radius:15px;padding:11px 13px}. ${PREFIX}-summary b{font-size:18px}. ${PREFIX}-submit{grid-column:1/-1;min-height:52px;border:0;border-radius:15px;background:linear-gradient(135deg,var(--sbso-green),#117657);color:#fff;font-weight:950;font-size:14px;cursor:pointer}. ${PREFIX}-submit:disabled{opacity:.55;cursor:wait}
      .${PREFIX}-history{display:grid;gap:8px}. ${PREFIX}-historyrow{border:1px solid var(--sbso-line);background:#fff;border-radius:14px;padding:10px}. ${PREFIX}-historyrow b{font-size:12px}. ${PREFIX}-historyrow p{margin:3px 0 0;color:var(--sbso-muted);font-size:11px}
      #${PREFIX}-toasts{position:fixed;z-index:4000;right:12px;bottom:90px;display:grid;gap:8px;width:min(330px,calc(100vw - 24px))}. ${PREFIX}-toast{background:#10231d;color:#fff;border-radius:15px;padding:11px 13px;box-shadow:0 14px 40px rgba(0,0,0,.25)}. ${PREFIX}-toast b,.${PREFIX}-toast span{display:block}. ${PREFIX}-toast span{font-size:11px;margin-top:2px;color:#dbe5e0}. ${PREFIX}-toast.error{background:#7d2929}
      @media(min-width:760px){.${PREFIX}-overlay{align-items:center}. ${PREFIX}-sheet{border-radius:24px}. ${PREFIX}-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.${PREFIX}-new span{display:none}. ${PREFIX}-kpis{grid-template-columns:1fr 1fr}. ${PREFIX}-kpi:first-child{grid-column:1/-1}. ${PREFIX}-form{grid-template-columns:1fr}. ${PREFIX}-field.full,.${PREFIX}-deliverybox,.${PREFIX}-lines,.${PREFIX}-known,.${PREFIX}-summary,.${PREFIX}-submit{grid-column:1}. ${PREFIX}-deliveryfields,.${PREFIX}-deliveryfields.open{grid-template-columns:1fr}. ${PREFIX}-line{grid-template-columns:minmax(0,1fr) 64px 92px 42px}. ${PREFIX}-moneyrow{grid-template-columns:1fr 1fr}. ${PREFIX}-moneyrow>div:first-child{grid-column:1/-1}}
      @media(prefers-reduced-motion:reduce){.${PREFIX}-shell,.${PREFIX}-overlay,*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `.replace(/\. sbso/g,'.sbso');
    document.head.appendChild(style);
  }

  function shell() {
    let root = qs(`#${PREFIX}-shell`); if (root) return root;
    root = document.createElement('section'); root.id = `${PREFIX}-shell`; root.className = `${PREFIX}-shell`; root.setAttribute('aria-label','Ventes, clients et livraisons');
    root.innerHTML = `<header class="${PREFIX}-top"><div class="${PREFIX}-topline"><button class="${PREFIX}-iconbtn" data-sbso-close aria-label="Fermer">←</button><div class="${PREFIX}-brand"><div class="${PREFIX}-eyebrow">${T('PILOTAGE DU COMMERCE','SAYTU LIGGÉEY BI')}</div><h1>${T('Ventes & livraisons','Jaay ak yónnee')}</h1></div><button class="${PREFIX}-new" data-sbso-new>＋ <span>${T('Nouvelle vente','Jaay bu bees')}</span></button></div></header><main class="${PREFIX}-main"><div class="${PREFIX}-offline" data-sbso-offline>${T('Mode hors ligne : affichage de la dernière synchronisation.','Internet amul: xibaar yi ñu mujj denc lañuy won.')}</div><div class="${PREFIX}-kpis" data-sbso-kpis></div><div class="${PREFIX}-tools"><label class="${PREFIX}-search"><span>⌕</span><input data-sbso-search type="search" placeholder="${T('Client, téléphone, quartier, commande…','Kiliyaan, telefon, dëkk, komànd…')}" aria-label="Rechercher"></label><button class="${PREFIX}-refresh" data-sbso-refresh aria-label="Actualiser">↻</button></div><nav class="${PREFIX}-tabs" data-sbso-tabs></nav><div class="${PREFIX}-list" data-sbso-list aria-live="polite"></div></main>`;
    document.body.appendChild(root);
    root.addEventListener('click', handleShellClick);
    qs('[data-sbso-search]', root).addEventListener('input', (e) => { query = e.target.value; render(); });
    return root;
  }

  function orderForSale(sale) { return workspace.orders.find(o => o.id === sale.order_id || o.sale_id === sale.id) || null; }
  function deliveryForOrder(order) { return order ? workspace.deliveries.find(d => d.id === order.delivery_id || String(d.source_reference||'') === order.id) || null : null; }
  function remaining(sale) { return Math.max(Number(sale.remaining_amount ?? (Number(sale.total_amount||0)-Number(sale.paid_amount||0))),0); }
  function sourceLabel(source) { return ({whatsapp:'WhatsApp',voice:'Vocal',web:'Site',photo:'Photo',import:'Import',manual:'Direct'})[source] || 'Direct'; }
  function statusInfo(order) {
    if (!order) return { label:T('Sans livraison','Yónnee amul'), cls:'' };
    if (order.status === 'delivered' || order.delivery_status === 'delivered') return { label:T('Livré','Yónnee na'), cls:'done' };
    if (order.status === 'out_for_delivery' || order.delivery_status === 'picked_up') return { label:T('En livraison','Mungi yónnee'), cls:'route' };
    if (order.status === 'ready') return { label:T('Prêt','Pare na'), cls:'pending' };
    if (order.status === 'preparing') return { label:T('À préparer','War a waajal'), cls:'pending' };
    if (['failed','cancelled'].includes(order.status) || ['failed','returned'].includes(order.delivery_status)) return { label:T('À revoir','War a xoolaat'), cls:'due' };
    return { label:T('À livrer','War a yónnee'), cls:'pending' };
  }
  function isOpenDelivery(order) { return order && !['delivered','failed','cancelled'].includes(order.status) && !['delivered','failed','returned','not_required'].includes(order.delivery_status); }

  function metrics() {
    const today = dayKey();
    const todaySales = workspace.sales.filter(s => dayKey(s.happened_at) === today);
    return { total:todaySales.reduce((a,s)=>a+Number(s.total_amount||0),0), count:todaySales.length, open:workspace.orders.filter(isOpenDelivery).length, due:workspace.sales.reduce((a,s)=>a+remaining(s),0) };
  }

  function render() {
    const root = shell(); if (!root.classList.contains('open')) return;
    const m = metrics();
    qs('[data-sbso-kpis]', root).innerHTML = `<article class="${PREFIX}-kpi"><small>${T("VENTES AUJOURD'HUI",'JAAY YI TEY')}</small><b>${fmt(m.total)}</b><small>${m.count} ${T('vente(s)','jaay')}</small></article><article class="${PREFIX}-kpi warn"><small>${T('À LIVRER','WAR A YÓNNEE')}</small><b>${m.open}</b><small>${T('commande(s)','komànd')}</small></article><article class="${PREFIX}-kpi danger"><small>${T('À ENCAISSER','WAR A JËL')}</small><b>${fmt(m.due)}</b><small>${T('reste total','xaalis bu des')}</small></article>`;
    const tabs = [ ['today',T("Aujourd’hui",'Tey')], ['deliveries',T('À livrer','War a yónnee')], ['receivables',T('À encaisser','War a jël')], ['clients',T('Clients','Kiliyaan')] ];
    qs('[data-sbso-tabs]', root).innerHTML = tabs.map(([id,label])=>`<button class="${PREFIX}-tab ${activeTab===id?'active':''}" data-sbso-tab="${id}">${esc(label)}</button>`).join('');
    qs('[data-sbso-offline]',root).classList.toggle('show', !navigator.onLine);
    const list = qs('[data-sbso-list]', root);
    if (loading) { list.innerHTML = `<div class="${PREFIX}-empty"><b>${T('Synchronisation…','Denc xibaar yi…')}</b>${T('SAMA rassemble vos ventes, clients et livraisons.','SAMA dafay boole jaay, kiliyaan ak yónnee.')}</div>`; return; }
    if (activeTab === 'clients') renderClients(list); else renderSales(list);
  }

  function searchMatch(parts) { if (!query.trim()) return true; const q=fold(query); return parts.some(v=>fold(v).includes(q)); }
  function renderSales(list) {
    const today = dayKey();
    let sales = workspace.sales.filter((sale) => {
      const order = orderForSale(sale);
      if (!searchMatch([sale.customer_name_snapshot,sale.customer_phone_snapshot,sale.description,order?.order_number,order?.delivery_address,order?.delivery_area,...(order?.sama_order_items||[]).map(i=>i.product_name)])) return false;
      if (activeTab === 'today') return dayKey(sale.happened_at) === today;
      if (activeTab === 'receivables') return remaining(sale) > 0;
      if (activeTab === 'deliveries') return isOpenDelivery(order);
      return true;
    });
    if (activeTab === 'deliveries') sales.sort((a,b)=>new Date(orderForSale(a)?.requested_for||'9999-12-31')-new Date(orderForSale(b)?.requested_for||'9999-12-31'));
    if (!sales.length) { list.innerHTML=`<div class="${PREFIX}-empty"><b>${T('Rien à afficher ici','Dara amul fii')}</b>${activeTab==='deliveries'?T('Les prochaines livraisons apparaîtront automatiquement.','Yónnee yi di ñëw dinañu feeñ fii.'):T('Changez le filtre ou enregistrez une nouvelle vente.','Soppi filtre bi walla bind jaay bu bees.')}</div>`; return; }
    list.innerHTML = sales.map(saleCard).join('');
  }

  function saleCard(sale) {
    const order = orderForSale(sale), st=statusInfo(order), rest=remaining(sale), items=order?.sama_order_items||[], delivery=deliveryForOrder(order);
    const itemHtml = items.length ? items.slice(0,5).map(i=>`<div class="${PREFIX}-item"><span><b>${Number(i.quantity||1)}×</b> ${esc(i.product_name)}${i.variant?` · ${esc(i.variant)}`:''}</span><span>${fmt(Number(i.line_total ?? Number(i.quantity||1)*Number(i.unit_price||0)))}</span></div>`).join('') : `<div class="${PREFIX}-item"><span>${esc(sale.description||'Vente')}</span></div>`;
    const address = order?.delivery_address || delivery?.delivery_address || '';
    return `<article class="${PREFIX}-card"><div class="${PREFIX}-cardhead"><div class="${PREFIX}-cardtitle"><b>${esc(sale.customer_name_snapshot||T('Client non nommé','Kiliyaan'))}</b><div class="${PREFIX}-meta"><span>${esc(sale.customer_phone_snapshot||T('Sans téléphone','Telefon amul'))}</span>${address?`<span>📍 ${esc(address)}</span>`:''}<span>${dateTime(sale.happened_at)}</span></div></div><span class="${PREFIX}-badge ${st.cls}">${esc(st.label)}</span></div><div class="${PREFIX}-items">${itemHtml}</div><div class="${PREFIX}-moneyrow"><div><small>TOTAL</small><b>${fmt(sale.total_amount)}</b></div><div><small>${T('PAYÉ','FAY NA')}</small><b>${fmt(sale.paid_amount)}</b></div><div class="${rest>0?'due':''}"><small>${T('RESTE','LI DES')}</small><b>${fmt(rest)}</b></div></div><div class="${PREFIX}-meta">${order?.requested_for?`<span>🕐 ${T('Prévu','Waajal')}: ${dateTime(order.requested_for)}</span>`:''}<span>${sourceLabel(sale.source)}</span>${order?.order_number?`<span>${esc(order.order_number)}</span>`:''}</div><div class="${PREFIX}-actions"><button class="${PREFIX}-act" data-sbso-wa-sale="${sale.id}">WhatsApp</button>${sale.customer_phone_snapshot?`<button class="${PREFIX}-act" data-sbso-call="${esc(normalizePhone(sale.customer_phone_snapshot))}">📞 ${T('Appeler','Woote')}</button>`:''}${order&&isOpenDelivery(order)?`<button class="${PREFIX}-act warn" data-sbso-state="${order.id}:ready">✓ ${T('Prêt','Pare')}</button><button class="${PREFIX}-act" data-sbso-state="${order.id}:out_for_delivery">🛵 ${T('En route','Mungi dem')}</button><button class="${PREFIX}-act primary" data-sbso-state="${order.id}:delivered">✓ ${T('Livré','Yónnee na')}</button>`:''}${rest>0?`<button class="${PREFIX}-act" data-sbso-remind="${sale.id}">💰 ${T('Relancer','Fàttali')}</button>`:''}</div></article>`;
  }

  function renderClients(list) {
    const clients = workspace.customers.filter(c=>searchMatch([c.name,c.phone,c.whatsapp,c.default_address,c.default_area]));
    if (!clients.length) { list.innerHTML=`<div class="${PREFIX}-empty"><b>${T('Aucun client pour l’instant','Kiliyaan amul ba léegi')}</b>${T('Les clients apparaissent automatiquement après vos ventes.','Kiliyaan yi dinañu feeñ gannaaw jaay yi.')}</div>`; return; }
    list.innerHTML = clients.map(c=>`<article class="${PREFIX}-card"><div class="${PREFIX}-cardhead"><div class="${PREFIX}-cardtitle"><b>${esc(c.name||'Client')}</b><div class="${PREFIX}-meta"><span>${esc(c.phone||c.whatsapp||'—')}</span>${c.default_area?`<span>📍 ${esc(c.default_area)}</span>`:''}</div></div>${Number(c.open_delivery_count||0)>0?`<span class="${PREFIX}-badge pending">${c.open_delivery_count} ${T('à livrer','yónnee')}</span>`:''}</div><div class="${PREFIX}-moneyrow"><div><small>${T('ACHATS','NJAAY')}</small><b>${c.purchase_count||0}</b></div><div><small>${T('TOTAL','LÉPP')}</small><b>${fmt(c.total_purchased)}</b></div><div class="${Number(c.outstanding_amount||0)>0?'due':''}"><small>${T('RESTE','LI DES')}</small><b>${fmt(c.outstanding_amount)}</b></div></div><div class="${PREFIX}-meta"><span>${T('Dernier achat','Jaay bu mujj')}: ${dateTime(c.last_purchase_at)}</span>${c.next_delivery_at?`<span>🕐 ${dateTime(c.next_delivery_at)}</span>`:''}</div><div class="${PREFIX}-actions"><button class="${PREFIX}-act primary" data-sbso-client="${c.id}">${T('Voir la fiche','Gis kiliyaan')}</button>${c.phone?`<button class="${PREFIX}-act" data-sbso-call="${esc(normalizePhone(c.phone))}">📞 ${T('Appeler','Woote')}</button>`:''}${c.phone||c.whatsapp?`<button class="${PREFIX}-act" data-sbso-wa-client="${c.id}">WhatsApp</button>`:''}</div></article>`).join('');
  }

  async function load() {
    if (loading) return; loading = true; render();
    try {
      const result = await api('sales_ops_workspace', { limit: 700 });
      workspace = { customers:result.customers||[],sales:result.sales||[],orders:result.orders||[],deliveries:result.deliveries||[],products:result.products||[] };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at:Date.now(), data:workspace })); } catch (_) {}
    } catch (error) {
      let cached = null; try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null'); } catch (_) {}
      if (cached?.data) { workspace = cached.data; notify(T('Connexion faible','Internet dafa néew'),T('Dernières données synchronisées affichées.','Xibaar yi ñu mujj denc lañuy won.'),'warn'); }
      else notify(T('Chargement impossible','Mënul yebbi'),error.message,'error');
    } finally { loading = false; render(); }
  }

  function open() { const root=shell(); root.classList.add('open'); document.body.style.overflow='hidden'; activeTab='today'; query=''; const search=qs('[data-sbso-search]',root); if(search)search.value=''; load(); setTimeout(()=>qs('[data-sbso-search]',root)?.focus(),80); }
  function close() { qs(`#${PREFIX}-shell`)?.classList.remove('open'); document.body.style.overflow=''; }

  function handleShellClick(event) {
    if(event.target.closest('[data-sbso-close]'))return close();
    if(event.target.closest('[data-sbso-new]'))return openSaleForm();
    if(event.target.closest('[data-sbso-refresh]'))return load();
    const tab=event.target.closest('[data-sbso-tab]'); if(tab){activeTab=tab.dataset.sbsoTab;render();return;}
    const call=event.target.closest('[data-sbso-call]'); if(call){location.href=`tel:+${call.dataset.sbsoCall}`;return;}
    const saleWa=event.target.closest('[data-sbso-wa-sale]'); if(saleWa)return whatsappSale(workspace.sales.find(s=>s.id===saleWa.dataset.sbsoWaSale));
    const clientWa=event.target.closest('[data-sbso-wa-client]'); if(clientWa)return whatsappClient(workspace.customers.find(c=>c.id===clientWa.dataset.sbsoWaClient));
    const remind=event.target.closest('[data-sbso-remind]'); if(remind)return remindSale(workspace.sales.find(s=>s.id===remind.dataset.sbsoRemind));
    const client=event.target.closest('[data-sbso-client]'); if(client)return openClient(client.dataset.sbsoClient);
    const stateBtn=event.target.closest('[data-sbso-state]'); if(stateBtn){const [id,next]=stateBtn.dataset.sbsoState.split(':');return setState(id,next,stateBtn);}
  }

  function whatsappSale(sale) { if(!sale)return; const phone=normalizePhone(sale.customer_phone_snapshot),order=orderForSale(sale),rest=remaining(sale); if(!phone)return notify(T('Téléphone manquant','Telefon amul'),T('Ajoutez le numéro du client.','Dugal nimero kiliyaan bi.'),'error'); const items=(order?.sama_order_items||[]).map(i=>`• ${i.quantity}× ${i.product_name}`).join('\n') || `• ${sale.description||'Commande'}`; const msg=`Bonjour ${sale.customer_name_snapshot||''},\n\nVotre commande est bien enregistrée.\n${items}\n\nTotal : ${fmt(sale.total_amount)}\nPayé : ${fmt(sale.paid_amount)}\nReste : ${fmt(rest)}${order?.requested_for?`\nLivraison prévue : ${dateTime(order.requested_for)}`:''}\n\n— SAMABUSINESS`; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener'); }
  function whatsappClient(c) { if(!c)return; const phone=normalizePhone(c.whatsapp||c.phone); if(!phone)return; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${c.name||''},`)}`,'_blank','noopener'); }
  function remindSale(sale) { if(!sale)return; const phone=normalizePhone(sale.customer_phone_snapshot); if(!phone)return notify(T('Téléphone manquant','Telefon amul'),'','error'); const msg=`Bonjour ${sale.customer_name_snapshot||''},\n\nPetit rappel concernant le reste de ${fmt(remaining(sale))} pour ${sale.description||'votre achat'}. Merci.\n\n— SAMABUSINESS`; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener'); }
  async function setState(orderId,next,button){ if(button)button.disabled=true; try{await api('sales_ops_set_order_state',{orderId,state:next});notify(T('Statut mis à jour','Statut soppi na'));await load();}catch(e){notify(T('Mise à jour impossible','Mënul soppi'),e.message,'error')}finally{if(button)button.disabled=false} }

  function ensureOverlay(id, html) { let o=qs(`#${id}`); if(o)return o; o=document.createElement('div');o.id=id;o.className=`${PREFIX}-overlay`;o.innerHTML=html;document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-sbso-overlay-close]'))o.classList.remove('open')});return o; }
  function productOptions() { return `<option value="">${T('Article libre','Produit bu sa bopp')}</option>${workspace.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${fmt(p.sale_price)}${p.track_stock?` · stock ${Number(p.stock_quantity||0)}`:''}</option>`).join('')}`; }
  function lineHtml() { return `<div class="${PREFIX}-line"><div><label>${T('ARTICLE','PRODUIT')}</label><select data-line-product>${productOptions()}</select><input data-line-name placeholder="${T("Nom de l’article",'Turu produit bi')}" style="margin-top:5px"></div><div><label>${T('QTÉ','LIM')}</label><input data-line-qty type="number" min="0.001" step="1" value="1"></div><div><label>${T('PRIX','NJËG')}</label><input data-line-price type="number" min="0" step="1" value="0"></div><button type="button" class="${PREFIX}-remove" data-line-remove aria-label="Supprimer">×</button></div>`; }

  function openSaleForm() {
    const overlay = ensureOverlay(`${PREFIX}-sale-overlay`, `<section class="${PREFIX}-sheet" role="dialog" aria-modal="true"><div class="${PREFIX}-sheethead"><div><h2>${T('Nouvelle vente','Jaay bu bees')}</h2><p>${T('Une seule saisie : SAMA relie le client et prépare la livraison.','Benn bind rekk: SAMA dafay boole kiliyaan ak yónnee.')}</p></div><button class="${PREFIX}-iconbtn" type="button" data-sbso-overlay-close>×</button></div><form id="${PREFIX}-sale-form" class="${PREFIX}-form"><input type="hidden" name="clientRef"><div class="${PREFIX}-field"><label>${T('Client','Kiliyaan')}</label><input name="customerName" autocomplete="name" placeholder="Moustapha Diop"></div><div class="${PREFIX}-field"><label>${T('Téléphone','Telefon')}</label><input name="customerPhone" inputmode="tel" autocomplete="tel" placeholder="77 000 00 00"></div><div class="${PREFIX}-known" data-known-client></div><div class="${PREFIX}-lines" data-lines></div><div class="${PREFIX}-field"><label>${T('Déjà payé','Li ñu fay')}</label><input name="paidAmount" type="number" min="0" value="0"></div><div class="${PREFIX}-field"><label>${T('Paiement','Peymaa')}</label><select name="paymentMethod"><option value="cash">Espèces</option><option value="wave">Wave</option><option value="orange_money">Orange Money</option><option value="bank">Virement</option><option value="other">Autre</option></select></div><div class="${PREFIX}-field"><label>${T('Canal de vente','Fan la jaay bi jóge')}</label><select name="source"><option value="manual">Direct</option><option value="whatsapp">WhatsApp</option><option value="voice">Vocal</option><option value="web">Site web</option><option value="photo">Photo</option></select></div><div class="${PREFIX}-field"><label>${T('Note','Leeral')}</label><input name="notes" placeholder="${T('Détail utile','Leeral bu am solo')}"></div><div class="${PREFIX}-deliverybox"><label class="${PREFIX}-switch"><input name="deliveryRequired" type="checkbox"><span>🚚 ${T('Ce client doit être livré','Kiliyaan bii war nañu ko yónnee')}</span></label><div class="${PREFIX}-deliveryfields" data-delivery-fields><div class="${PREFIX}-field full"><label>${T('Adresse de livraison','Adres yónnee')}</label><input name="deliveryAddress" placeholder="Sacré-Cœur 3, près de…"></div><div class="${PREFIX}-field"><label>${T('Quartier / zone','Dëkk / zone')}</label><input name="deliveryArea" placeholder="Sacré-Cœur"></div><div class="${PREFIX}-field"><label>${T('Date et heure','Bés ak waxtu')}</label><input name="scheduledFor" type="datetime-local"></div><div class="${PREFIX}-field"><label>${T('Coût livraison pour le commerce','Njëgu yónnee ci commerce bi')}</label><input name="deliveryCost" type="number" min="0" value="0"></div></div></div><div class="${PREFIX}-summary"><span>${T('Total vente','Jaay yépp')}</span><b data-sale-total>0 F</b></div><button class="${PREFIX}-submit" type="submit">✓ ${T('Enregistrer la vente','Bind jaay bi')}</button></form></section>`);
    const form=qs(`#${PREFIX}-sale-form`,overlay); form.reset(); form.elements.clientRef.value=uuid(); qs('[data-lines]',form).innerHTML=`${lineHtml()}<button type="button" class="${PREFIX}-addline" data-line-add>＋ ${T('Ajouter un article','Yokk produit')}</button>`; qs('[data-delivery-fields]',form).classList.remove('open'); qs('[data-known-client]',form).classList.remove('show');
    if(!form.dataset.bound){form.dataset.bound='1';form.addEventListener('input',()=>updateTotal(form));form.addEventListener('change',e=>{if(e.target.name==='deliveryRequired')qs('[data-delivery-fields]',form).classList.toggle('open',e.target.checked);if(e.target.matches('[data-line-product]'))applyProduct(e.target);updateTotal(form)});form.addEventListener('click',e=>{if(e.target.closest('[data-line-add]')){e.preventDefault();e.target.closest('[data-line-add]').insertAdjacentHTML('beforebegin',lineHtml());updateTotal(form)}const rem=e.target.closest('[data-line-remove]');if(rem){e.preventDefault();const lines=qsa(`.${PREFIX}-line`,form);if(lines.length>1)rem.closest(`.${PREFIX}-line`).remove();updateTotal(form)}});form.elements.customerPhone.addEventListener('blur',()=>knownClient(form));form.addEventListener('submit',submitSale)}
    overlay.classList.add('open'); setTimeout(()=>form.elements.customerName.focus(),60); updateTotal(form);
  }
  function applyProduct(select){const line=select.closest(`.${PREFIX}-line`),p=workspace.products.find(x=>x.id===select.value);if(p){qs('[data-line-name]',line).value=p.name;qs('[data-line-price]',line).value=Number(p.sale_price||0)}}
  function updateTotal(form){let total=0;qsa(`.${PREFIX}-line`,form).forEach(line=>{total+=Math.max(Number(qs('[data-line-qty]',line)?.value||0),0)*Math.max(Number(qs('[data-line-price]',line)?.value||0),0)});qs('[data-sale-total]',form).textContent=fmt(total);return total}
  function knownClient(form){const n=normalizePhone(form.elements.customerPhone.value),c=workspace.customers.find(x=>x.normalized_phone===n),box=qs('[data-known-client]',form);if(!c){box.classList.remove('show');box.innerHTML='';return}box.innerHTML=`✓ <b>${esc(c.name)}</b> · ${c.purchase_count||0} ${T('achat(s)','jaay')} · ${T('reste','li des')} ${fmt(c.outstanding_amount)}${c.default_address?`<br>📍 ${esc(c.default_address)}`:''}`;box.classList.add('show');if(!form.elements.customerName.value)form.elements.customerName.value=c.name||'';if(form.elements.deliveryRequired.checked&&!form.elements.deliveryAddress.value)form.elements.deliveryAddress.value=c.default_address||'';if(!form.elements.deliveryArea.value)form.elements.deliveryArea.value=c.default_area||''}
  function saleItems(form){return qsa(`.${PREFIX}-line`,form).map(line=>{const productId=qs('[data-line-product]',line).value,p=workspace.products.find(x=>x.id===productId);return{productId:productId||null,productName:qs('[data-line-name]',line).value||p?.name||'Article',quantity:Number(qs('[data-line-qty]',line).value||1),unitPrice:Number(qs('[data-line-price]',line).value||0),unitCost:Number(p?.purchase_cost||0)}}).filter(i=>i.productName&&i.quantity>0)}
  async function submitSale(event){event.preventDefault();const form=event.currentTarget,button=qs(`.${PREFIX}-submit`,form),delivery=form.elements.deliveryRequired.checked,items=saleItems(form);if(!items.length)return notify(T('Article manquant','Produit amul'),T('Ajoutez au moins un article.','Yokk benn produit.'),'error');if(updateTotal(form)<=0)return notify(T('Montant invalide','Xaalis bi baaxul'),T('Vérifiez le prix de la vente.','Seetal njëg bi.'),'error');let scheduled=null;if(delivery&&form.elements.scheduledFor.value)scheduled=`${form.elements.scheduledFor.value}:00Z`;button.disabled=true;button.textContent=T('Enregistrement…','Mingi bind…');try{const payload={clientRef:form.elements.clientRef.value,customerName:form.elements.customerName.value,customerPhone:form.elements.customerPhone.value,items,paidAmount:Number(form.elements.paidAmount.value||0),paymentMethod:form.elements.paymentMethod.value,source:form.elements.source.value,notes:form.elements.notes.value,deliveryRequired:delivery,deliveryAddress:form.elements.deliveryAddress?.value||'',deliveryArea:form.elements.deliveryArea?.value||'',scheduledFor:scheduled,deliveryCost:Number(form.elements.deliveryCost?.value||0)};const result=await api('sales_ops_create_sale',payload);qs(`#${PREFIX}-sale-overlay`).classList.remove('open');notify(result.result?.replayed?T('Vente déjà enregistrée','Jaay bi bindoon na'):T('Vente enregistrée','Jaay bi bind na'),delivery?T('Client et livraison sont maintenant suivis.','Kiliyaan ak yónnee dañu leen di topp.'):T('Le client a été relié automatiquement.','SAMA boole na kiliyaan bi.'));await load()}catch(e){notify(T('Vente non enregistrée','Jaay bi bindul'),e.message,'error')}finally{button.disabled=false;button.textContent=`✓ ${T('Enregistrer la vente','Bind jaay bi')}`}}

  async function openClient(id){try{const r=await api('sales_ops_customer_detail',{customerId:id}),c=r.customer;const overlay=ensureOverlay(`${PREFIX}-client-overlay`,`<section class="${PREFIX}-sheet" role="dialog" aria-modal="true"><div class="${PREFIX}-sheethead"><div><h2 data-client-title></h2><p data-client-phone></p></div><button class="${PREFIX}-iconbtn" data-sbso-overlay-close>×</button></div><div data-client-body></div></section>`);qs('[data-client-title]',overlay).textContent=c.name||'Client';qs('[data-client-phone]',overlay).textContent=c.phone||c.whatsapp||'—';qs('[data-client-body]',overlay).innerHTML=`<div class="${PREFIX}-moneyrow"><div><small>${T('ACHATS','NJAAY')}</small><b>${c.purchase_count||0}</b></div><div><small>TOTAL</small><b>${fmt(c.total_purchased)}</b></div><div class="${Number(c.outstanding_amount)>0?'due':''}"><small>${T('RESTE','LI DES')}</small><b>${fmt(c.outstanding_amount)}</b></div></div><form class="${PREFIX}-form" data-client-form style="margin-top:12px"><div class="${PREFIX}-field full"><label>${T('Adresse habituelle','Adres bu ko gën di jëfandikoo')}</label><input name="defaultAddress" value="${esc(c.default_address||'')}"></div><div class="${PREFIX}-field"><label>${T('Quartier / zone','Dëkk / zone')}</label><input name="defaultArea" value="${esc(c.default_area||'')}"></div><div class="${PREFIX}-field"><label>${T('Téléphone','Telefon')}</label><input name="phone" value="${esc(c.phone||'')}"></div><button class="${PREFIX}-submit" type="submit">${T('Enregistrer la fiche','Bind kiliyaan bi')}</button></form><h3>${T('Historique','Jaar-jaar')}</h3><div class="${PREFIX}-history">${(r.sales||[]).map(s=>`<div class="${PREFIX}-historyrow"><b>${dateTime(s.happened_at)} · ${fmt(s.total_amount)}</b><p>${esc(s.description||'Vente')} · ${T('reste','li des')} ${fmt(s.remaining_amount)}</p></div>`).join('')||`<div class="${PREFIX}-empty">${T('Aucun achat','Jaay amul')}</div>`}</div>`;const form=qs('[data-client-form]',overlay);form.onsubmit=async(e)=>{e.preventDefault();const btn=qs(`.${PREFIX}-submit`,form);btn.disabled=true;try{await api('sales_ops_save_customer',{customerId:id,defaultAddress:form.elements.defaultAddress.value,defaultArea:form.elements.defaultArea.value,phone:form.elements.phone.value});notify(T('Fiche client mise à jour','Kiliyaan bi yeesal na'));await load()}catch(err){notify(T('Modification impossible','Mënul soppi'),err.message,'error')}finally{btn.disabled=false}};overlay.classList.add('open')}catch(e){notify(T('Fiche indisponible','Kiliyaan bi amul'),e.message,'error')}}

  function interceptSalesNav() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button,[role="button"],a'); if (!button) return;
      const nav = button.dataset?.nav || button.getAttribute('data-route') || button.getAttribute('href') || '';
      const txt = fold(button.textContent).trim();
      const looksSales = nav === 'sales' || nav === 'ventes' || /(^|[#/?])sales\b/.test(nav) || txt === 'ventes' || txt === 'jaay';
      if (!looksSales) return;
      const inBottom = button.closest('nav,.bottom-nav,.nav,.app-nav') || getComputedStyle(button).position === 'fixed';
      if (!inBottom && nav !== 'sales') return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); open();
    }, true);
  }

  function boot() {
    injectStyles(); shell(); interceptSalesNav();
    window.addEventListener('online',()=>{render();if(qs(`#${PREFIX}-shell`)?.classList.contains('open'))load()});
    window.addEventListener('offline',render);
    window.SAMABUSINESS_SALES_OPS = { version:VERSION, open, close, refresh:load };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();