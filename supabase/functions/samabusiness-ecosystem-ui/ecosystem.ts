export default function ecosystem() {
  'use strict';
  if (window.__SAMA_ECOSYSTEM_UI_V1202__) return;
  window.__SAMA_ECOSYSTEM_UI_V1202__ = true;

  const state = { lang: localStorage.getItem('sama-ui-lang') === 'wo' ? 'wo' : 'fr' };
  const groups = [
    { icon:'🛒', fr:'Vendre', wo:'Jaay', items:[
      {id:'sale',icon:'💵',fr:'Nouvelle vente',wo:'Jaay bu bees',find:['nouvelle vente','ajouter une vente'],query:'/?action=sale'},
      {id:'voice',icon:'🎙️',fr:'Commande vocale',wo:'Waxal',find:['commande vocale','vocal'],query:'/?module=voice'},
      {id:'orders',icon:'📦',fr:'Commandes',wo:'Commande yi',find:['commandes whatsapp','commandes','commande client']},
    ]},
    { icon:'📒', fr:'Gérer', wo:'Saytu', items:[
      {id:'debts',icon:'🤝',fr:'Cahier & dettes',wo:'Bor yi',find:['cahier & dettes','cahier et dettes','dettes'],query:'/?module=debts'},
      {id:'stock',icon:'📦',fr:'Stock',wo:'Stock',find:['stock','produits']},
      {id:'expenses',icon:'🧾',fr:'Dépenses',wo:'Xaalis bu génn',find:['dépenses','depenses']},
      {id:'clients',icon:'👥',fr:'Clients',wo:'Jëndkat yi',find:['clients','clientèle']},
    ]},
    { icon:'🚚', fr:'Livrer', wo:'Yónnee', items:[
      {id:'delivery',icon:'🛵',fr:'Livraisons',wo:'Yónnee yi',find:['livraison','livraisons']},
      {id:'tracking',icon:'📍',fr:'Suivi',wo:'Toppandoo',find:['suivi livraison','suivi']},
    ]},
    { icon:'📊', fr:'Piloter', wo:'Xool njaay mi', items:[
      {id:'dashboard',icon:'📈',fr:'Tableau de bord',wo:'Xool liggéey bi',find:['pilotage général','tableau de bord','pilotage']},
      {id:'profit',icon:'💰',fr:'Bénéfice réel',wo:'Waal bi',find:['bénéfice réel','benefice reel','bénéfice']},
      {id:'reports',icon:'📑',fr:'Rapports',wo:'Nettali',find:['rapports','rapport']},
    ]},
    { icon:'🌐', fr:'Développer', wo:'Yokk sa liggéey', items:[
      {id:'site',icon:'✨',fr:'Créer un site',wo:'Sos sa site'},
      {id:'admin',icon:'🛡️',fr:'Administration des sites',wo:'Saytu site yi'},
      {id:'suppliers',icon:'🏭',fr:'Fournisseurs',wo:'Joxkat yi',find:['fournisseurs','fournisseur']},
    ]},
    { icon:'🆘', fr:'Aide', wo:'Ndimbël', items:[
      {id:'help',icon:'💬',fr:'Assistance',wo:'Ndimbël',find:['assistance','support','aide']},
      {id:'settings',icon:'⚙️',fr:'Réglages',wo:'Tànneef',find:['réglages','paramètres','parametres']},
    ]},
  ];

  const css = `
#sama-eco-root{font-family:Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif;color:#10231c}#sama-eco-root *{box-sizing:border-box}
.eco-fab{position:fixed;left:14px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:2147482900;border:0;border-radius:20px;min-height:57px;padding:9px 15px;background:linear-gradient(135deg,#071a32,#087a45);color:#fff;display:flex;align-items:center;gap:10px;font:900 13px inherit;box-shadow:0 18px 44px rgba(7,26,50,.35);cursor:pointer}.eco-fab span:first-child{width:38px;height:38px;border-radius:14px;background:rgba(255,255,255,.15);display:grid;place-items:center;font-size:20px}
.eco-layer{position:fixed;inset:0;z-index:2147483400;background:rgba(3,15,28,.78);backdrop-filter:blur(14px);display:none;padding:10px}.eco-layer.open{display:grid;place-items:center}.eco-shell{width:min(1220px,100%);height:min(940px,100%);background:#f5f8f6;border-radius:30px;overflow:hidden;display:grid;grid-template-rows:auto 1fr;box-shadow:0 30px 90px rgba(0,0,0,.35)}
.eco-head{padding:15px 17px;background:linear-gradient(135deg,#071a32,#0b3154 65%,#087a45);color:#fff;display:flex;align-items:center;gap:12px}.eco-logo{width:50px;height:50px;border-radius:17px;background:linear-gradient(135deg,#e4ae35,#f5d77c);color:#172333;display:grid;place-items:center;font-size:25px;font-weight:950}.eco-head h2{font-size:18px;margin:0}.eco-head p{font-size:11px;opacity:.75;margin:3px 0 0}.eco-tools{margin-left:auto;display:flex;gap:8px}.eco-tool{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;border-radius:14px;min-height:43px;padding:9px 12px;font-weight:900;cursor:pointer}
.eco-main{overflow:auto;padding:clamp(15px,2.5vw,29px)}.eco-welcome{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin-bottom:21px}.eco-welcome h1{margin:0;font-size:clamp(28px,5vw,48px);line-height:1;letter-spacing:-.055em}.eco-welcome p{margin:9px 0 0;color:#667085}.eco-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:19px}.eco-quick button{min-height:80px;border:0;border-radius:19px;background:#fff;padding:12px;display:flex;align-items:center;gap:11px;text-align:left;font:900 13px inherit;box-shadow:0 10px 30px rgba(7,26,50,.07);cursor:pointer}.eco-quick b{font-size:26px}
.eco-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.eco-group{background:#fff;border:1px solid rgba(16,35,28,.1);border-radius:25px;padding:17px}.eco-group-title{display:flex;align-items:center;gap:9px;font-weight:950;margin-bottom:12px}.eco-group-title i{width:39px;height:39px;border-radius:14px;background:#eaf8f1;display:grid;place-items:center;font-style:normal;font-size:20px}.eco-items{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.eco-card{min-height:100px;border:2px solid transparent;border-radius:18px;background:#f4f8f6;padding:11px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;text-align:left;font:850 12px inherit;cursor:pointer;transition:.16s}.eco-card:hover{transform:translateY(-3px);background:#fff;border-color:rgba(8,122,69,.28);box-shadow:0 12px 28px rgba(7,26,50,.09)}.eco-card strong{font-size:27px}.eco-card small{color:#667085}
.eco-card:focus-visible,.eco-fab:focus-visible,.eco-tool:focus-visible{outline:4px solid rgba(228,174,53,.55);outline-offset:2px}.eco-bottom{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));z-index:2147482850;width:min(570px,calc(100% - 18px));display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:7px;background:rgba(255,255,255,.93);backdrop-filter:blur(18px);border:1px solid rgba(16,35,28,.11);border-radius:21px;box-shadow:0 17px 45px rgba(7,26,50,.2)}.eco-bottom button{border:0;background:transparent;border-radius:14px;min-height:50px;font:850 10px inherit;color:#52615b;cursor:pointer}.eco-bottom button b{display:block;font-size:19px;margin-bottom:2px}.eco-bottom button:hover{background:#eaf8f1;color:#087a45}
#sama-eco-root.eco-suspended>.eco-fab,#sama-eco-root.eco-suspended>.eco-bottom{opacity:0;visibility:hidden;pointer-events:none!important;transform:translateY(12px)}#sama-eco-root.eco-suspended>.eco-bottom{transform:translate(-50%,12px)}
@media(max-width:760px){.eco-layer{padding:0}.eco-shell{height:100%;border-radius:0}.eco-main{padding:14px}.eco-groups{grid-template-columns:1fr}.eco-quick{grid-template-columns:repeat(2,1fr)}.eco-welcome{display:block}.eco-fab{bottom:calc(71px + env(safe-area-inset-bottom));left:10px;padding-right:10px}.eco-fab em{display:none}.eco-items{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){#sama-eco-root *{transition:none!important}}
`;

  function tr(obj) { return obj[state.lang] || obj.fr || ''; }
  function isVisible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'; }
  function findAndClick(words) {
    const nodes = [...document.querySelectorAll('button,a,[role=button],.quick,.more-card,.nav-btn,.mini-btn')].filter((n) => !n.closest('#sama-eco-root') && isVisible(n));
    for (const word of words || []) {
      const key = word.toLowerCase();
      const node = nodes.find((n) => (n.textContent || '').trim().toLowerCase().includes(key));
      if (node) { node.click(); return true; }
    }
    return false;
  }
  function externalModalOpen() {
    return [...document.querySelectorAll('[role="dialog"].open,.modal.open,.sheet.open,.drawer.open')]
      .some((el) => !el.closest('#sama-eco-root') && isVisible(el));
  }
  function syncLayering() {
    const root = document.querySelector('#sama-eco-root');
    if (!root) return;
    root.classList.toggle('eco-suspended', externalModalOpen());
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === 'wo' ? 'fr-SN' : 'fr-FR';
    u.rate = .88;
    window.speechSynthesis.speak(u);
  }
  function close() { document.querySelector('#eco-layer')?.classList.remove('open'); document.documentElement.style.overflow = ''; syncLayering(); }
  function open() { render(); document.querySelector('#eco-layer')?.classList.add('open'); document.documentElement.style.overflow = 'hidden'; }
  function action(id) {
    close();
    if (id === 'site') { window.SAMABUSINESS?.siteStudio?.open?.(); return; }
    if (id === 'admin') { window.SAMABUSINESS?.siteStudio?.open?.(); setTimeout(() => document.querySelector('[data-tab="admin"],[data-sama-admin-direct]')?.click(), 650); return; }
    const item = groups.flatMap((g) => g.items).find((x) => x.id === id);
    if (item && findAndClick(item.find)) return;
    if (item?.query) { location.href = item.query; return; }
    setTimeout(open, 180);
  }
  function groupHtml(g) {
    return `<section class="eco-group"><div class="eco-group-title"><i>${g.icon}</i>${tr(g)}</div><div class="eco-items">${g.items.map((i) => `<button class="eco-card" data-eco-action="${i.id}"><strong>${i.icon}</strong><span>${tr(i)}</span><small>${state.lang === 'wo' ? i.fr : i.wo}</small></button>`).join('')}</div></section>`;
  }
  function render() {
    const main = document.querySelector('#eco-main');
    if (!main) return;
    const allItems = groups.flatMap((g) => g.items);
    main.innerHTML = `<div class="eco-welcome"><div><h1>${state.lang === 'wo' ? 'Lan nga bëgg def?' : 'Que voulez-vous faire ?'}</h1><p>${state.lang === 'wo' ? 'Tànnal ikon bi. Du laaj jang lu bari.' : 'Choisissez une icône. Aucun long parcours.'}</p></div></div><div class="eco-quick">${['sale','debts','stock','delivery'].map((id) => { const i = allItems.find((x) => x.id === id); return `<button data-eco-action="${id}"><b>${i.icon}</b><span>${tr(i)}<br><small>${state.lang === 'wo' ? i.fr : i.wo}</small></span></button>`; }).join('')}</div><div class="eco-groups">${groups.map(groupHtml).join('')}</div>`;
    const langButton = document.querySelector('#eco-lang');
    if (langButton) langButton.textContent = state.lang === 'wo' ? 'FR' : 'WO';
  }
  function mount() {
    if (document.querySelector('#sama-eco-root')) return;
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    const root = document.createElement('div'); root.id = 'sama-eco-root';
    root.innerHTML = `<button class="eco-fab" id="eco-open"><span>☰</span><em>Sama Menu</em></button><div class="eco-layer" id="eco-layer" role="dialog" aria-modal="true"><section class="eco-shell"><header class="eco-head"><div class="eco-logo">S</div><div><h2>Sama Business</h2><p>Un seul menu pour tout gérer</p></div><div class="eco-tools"><button class="eco-tool" id="eco-listen">🔊</button><button class="eco-tool" id="eco-lang">WO</button><button class="eco-tool" id="eco-close">✕</button></div></header><main class="eco-main" id="eco-main"></main></section></div><nav class="eco-bottom"><button data-eco-open><b>🏠</b>Accueil</button><button data-eco-action="sale"><b>💵</b>Vente</button><button data-eco-action="debts"><b>🤝</b>Dettes</button><button data-eco-action="stock"><b>📦</b>Stock</button><button data-eco-open><b>☰</b>Plus</button></nav>`;
    document.body.append(root); render(); syncLayering();
    root.addEventListener('click', (event) => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.id === 'eco-open' || button.hasAttribute('data-eco-open')) return open();
      if (button.id === 'eco-close') return close();
      if (button.id === 'eco-lang') { state.lang = state.lang === 'fr' ? 'wo' : 'fr'; localStorage.setItem('sama-ui-lang', state.lang); render(); return; }
      if (button.id === 'eco-listen') { speak(state.lang === 'wo' ? 'Tànnal ikon bi ngir tambali' : 'Choisissez une icône pour commencer'); return; }
      if (button.dataset.ecoAction) return action(button.dataset.ecoAction);
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    new MutationObserver(syncLayering).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
    window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, { ecosystemUI: { version:'12.0.2', open, lang:() => state.lang } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true }); else mount();
}
