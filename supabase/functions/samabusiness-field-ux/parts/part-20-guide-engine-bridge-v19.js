(() => {
  'use strict';
  if (window.__SAMABUSINESS_GUIDE_ENGINE_BRIDGE_V19__) return;
  window.__SAMABUSINESS_GUIDE_ENGINE_BRIDGE_V19__ = true;

  const VERSION = '19.0.0-beta.3';
  const API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-api-v10';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const token = () => { try { if (typeof state !== 'undefined' && state?.token) return state.token; } catch (_) {} return localStorage.getItem('sama-session-v3') || ''; };
  const isWolof = () => { try { return typeof state !== 'undefined' && state?.language === 'wo'; } catch (_) { return false; } };
  const T = (fr, wo) => isWolof() && wo ? wo : fr;

  const ICONS = {
    brain:'<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.5A3.5 3.5 0 0 0 4 15a3 3 0 0 0 3 3h2.5"/><path d="M14.5 4.5A3.5 3.5 0 0 1 18 8v.5a3.5 3.5 0 0 1 2 6.5 3 3 0 0 1-3 3h-2.5"/><path d="M12 3v18M8 10h4M12 14h4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.05V3h4v.05a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    volume:'<path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.brain}</svg>`;

  function installStyles() {
    if (qs('#sama-guide-engine-bridge-styles')) return;
    const style = document.createElement('style');
    style.id = 'sama-guide-engine-bridge-styles';
    style.textContent = `
      #sama-copilot-panel .sacp-search.sagb-search{grid-template-columns:1fr 46px 46px!important}
      .sagb-understand{border:1px solid #cfe0d7;border-radius:15px;background:#edf8f3;color:#087153;display:grid;place-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}.sagb-understand svg{width:20px;height:20px}.sagb-understand.loading{opacity:.65;pointer-events:none}.sagb-understand:active{transform:scale(.97)}
      .sagb-answer{border:1px solid #d7e6de;border-radius:17px;background:linear-gradient(145deg,#f2faf6,#fff);padding:12px;margin-bottom:9px}.sagb-answer-head{display:flex;align-items:flex-start;gap:9px}.sagb-answer .ico{width:35px;height:35px;border-radius:12px;background:#e3f3ea;color:#087153;display:grid;place-items:center;flex:none}.sagb-answer .ico svg{width:19px;height:19px}.sagb-answer b{font-size:13px}.sagb-answer p{font-size:12px;color:#4f6259;line-height:1.5;margin:4px 0 0}.sagb-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.sagb-meta span{font-size:9px;font-weight:850;padding:5px 7px;border-radius:999px;background:#fff;border:1px solid #dce5e0;color:#607269}.sagb-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.sagb-actions button{height:38px;border:1px solid #cfe0d7;border-radius:12px;background:#f3faf6;color:#087153;font-weight:850;padding:0 11px;display:inline-flex;align-items:center;gap:6px}.sagb-actions button.primary{background:#087153;color:#fff;border-color:#087153}.sagb-actions svg{width:15px;height:15px}
      .sagb-settings{border:1px solid #dce6e0;border-radius:17px;background:#fff;padding:12px;margin-bottom:8px}.sagb-settings h3{font-size:13px;margin:0 0 4px}.sagb-settings>p{font-size:10px;color:#6c7a73;margin:0 0 11px}.sagb-setting{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #eef2f0}.sagb-setting:first-of-type{border-top:0}.sagb-setting b{font-size:11px}.sagb-setting small{display:block;font-size:9px;color:#718078;margin-top:2px}.sagb-switch{width:48px;height:28px;border:0;border-radius:999px;background:#cfdad4;position:relative}.sagb-switch::after{content:'';position:absolute;width:22px;height:22px;border-radius:50%;background:#fff;top:3px;left:3px;box-shadow:0 2px 7px rgba(0,0,0,.15);transition:left .15s ease}.sagb-switch.on{background:#087153}.sagb-switch.on::after{left:23px}.sagb-select{height:38px;border:1px solid #d8e3dd;border-radius:11px;background:#fff;color:#1e352b;padding:0 9px;font-weight:750}.sagb-save{width:100%;height:43px;border:0;border-radius:13px;background:#087153;color:#fff;font-weight:900;margin-top:10px}.sagb-status{font-size:10px;color:#66766f;margin-top:7px;min-height:14px}
      @media(max-width:420px){#sama-copilot-panel .sacp-search.sagb-search{grid-template-columns:1fr 44px 44px!important}.sagb-understand{border-radius:14px}}
    `;
    document.head.appendChild(style);
  }

  async function api(action, payload = {}) {
    const session = token();
    if (!session) throw new Error(T('Session requise.', 'Duggal sa compte.'));
    const response = await fetch(API, {
      method:'POST',
      headers:{'content-type':'application/json','x-sama-session':session,'x-client-info':`sama-guide-bridge/${VERSION}`},
      body:JSON.stringify({action,...payload}),
    });
    let body={}; try{body=await response.json();}catch(_){ }
    if(!response.ok||body.ok===false)throw new Error(body.error||`Erreur ${response.status}`);
    return body;
  }

  function ensureButton() {
    const panel=qs('#sama-copilot-panel'); if(!panel)return;
    const search=qs('.sacp-search',panel); if(!search)return;
    search.classList.add('sagb-search');
    if(!qs('[data-sagb-understand]',search)){
      const button=document.createElement('button');button.type='button';button.className='sagb-understand';button.dataset.sagbUnderstand='1';button.setAttribute('aria-label',T('Comprendre ma demande','Dégg sama laaj'));button.title=T('Comprendre ma demande','Dégg sama laaj');button.innerHTML=icon('brain');button.onclick=()=>interpretCurrent();search.appendChild(button);
    }
    const input=qs('[data-sacp-input]',panel);
    if(input&&!input.dataset.sagbEnter){
      input.dataset.sagbEnter='1';
      input.addEventListener('keydown',event=>{
        if(event.key!=='Enter'||event.shiftKey)return;
        const raw=input.value.trim();
        if(!raw)return;
        event.preventDefault();event.stopImmediatePropagation();interpret(raw,{speakAnswer:false});
      },true);
    }
  }

  function ensureSettingsAction() {
    const grid=qs('#sama-copilot-panel .sacp-grid');if(!grid||qs('[data-sagb-settings]',grid))return;
    const button=document.createElement('button');button.type='button';button.className='sacp-action';button.dataset.sagbSettings='1';button.innerHTML=`<span class="ico">${icon('settings')}</span><b>${T('Préférences','Tànneef')}</b><small>${T('Mode simple, voix, aide','Yoon wu yomb, baat, ndimbal')}</small>`;button.onclick=renderSettings;grid.appendChild(button);
  }

  async function interpretCurrent(){const input=qs('#sama-copilot-panel [data-sacp-input]');const raw=input?.value.trim()||'';if(!raw){input?.focus();return;}await interpret(raw,{speakAnswer:false});}

  async function interpret(raw,{speakAnswer=false}={}){
    const button=qs('[data-sagb-understand]');button?.classList.add('loading');
    try{
      const result=await api('copilot_interpret',{text:raw});
      const guide=result.guide||{};
      renderAnswer(guide,raw);
      if(speakAnswer&&guide.answer)window.SamaCopilot?.speak?.(guide.answer);
    }catch(error){renderError(error.message);}
    finally{button?.classList.remove('loading');}
  }

  function resultBox(){return qs('#sama-copilot-panel [data-sacp-results]');}
  function renderError(message){const box=resultBox();if(box)box.innerHTML=`<div class="sagb-answer"><div class="sagb-answer-head"><span class="ico">${icon('brain')}</span><div><b>${T('SAMA n’a pas pu comprendre maintenant','SAMA mënul dégg léegi')}</b><p>${esc(message)}</p></div></div></div>`;}

  function actionLabel(action){
    return ({create_sale:T('Préparer la vente','Waajal jaay'),create_expense:T('Ouvrir dépense','Ubbi dépense'),create_debt:T('Ouvrir dettes','Ubbi bor'),open_debts:T('Ouvrir dettes','Ubbi bor'),open_stock:T('Ouvrir stock','Ubbi stock'),open_delivery:T('Ouvrir livraisons','Ubbi yónnee'),open_site_studio:T('Ouvrir Studio Sites','Ubbi Studio'),open_dashboard:T('Retour accueil','Dem accueil')})[action]||'';
  }

  function renderAnswer(guide,raw){
    const box=resultBox();if(!box)return;
    const action=String(guide.action||'');const entities=guide.entities||{};const confidence=Math.round(Number(guide.confidence||0)*100);const amount=Number(entities.amount||0);const method=String(entities.paymentMethod||'');
    const chips=[confidence?`${confidence}% ${T('compris','dégg')}`:'',amount?fmt(amount):'',method&&method!=='cash'?method.replace('_',' '):''].filter(Boolean);
    box.innerHTML=`<div class="sagb-answer"><div class="sagb-answer-head"><span class="ico">${icon('brain')}</span><div><b>${T('SAMA a compris','SAMA dégg na')}</b><p>${esc(guide.answer||T('Demande comprise.','Dégg na laaj bi.'))}</p></div></div>${chips.length?`<div class="sagb-meta">${chips.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="sagb-actions"><button type="button" data-sagb-speak>${icon('volume')} ${T('Écouter','Déglu')}</button>${actionLabel(action)?`<button type="button" class="primary" data-sagb-act="${esc(action)}">${icon('arrow')} ${esc(actionLabel(action))}</button>`:''}</div></div>`;
    qs('[data-sagb-speak]',box).onclick=()=>window.SamaCopilot?.speak?.(guide.answer||raw);
    const act=qs('[data-sagb-act]',box);if(act)act.onclick=()=>runAction(action,entities,raw);
  }

  function clickNav(name,regex){const button=qsa('.nav-btn,[data-nav]').find(b=>b.dataset.nav===name||(regex&&regex.test(fold(b.textContent||''))));button?.click();return Boolean(button);}
  function openSales(tab){window.SamaCopilot?.close?.();clickNav('sales',/vent|jaay/);setTimeout(()=>qs(`[data-sbso-tab="${tab}"]`)?.click(),330);}
  function openNewSale(entities,raw){window.SamaCopilot?.close?.();clickNav('sales',/vent|jaay/);setTimeout(()=>{qs('[data-sbso-new]')?.click();setTimeout(()=>{const form=qs('#sbso-sale-overlay form,.sbso-overlay.open form');if(!form)return;const amount=Number(entities.amount||0);if(amount){const price=qs('[data-line-price]',form);if(price){price.value=amount;price.dispatchEvent(new Event('input',{bubbles:true}));}}const method=String(entities.paymentMethod||'');if(form.elements?.paymentMethod&&['cash','wave','orange_money','bank','other'].includes(method)){form.elements.paymentMethod.value=method;form.elements.paymentMethod.dispatchEvent(new Event('change',{bubbles:true}));}if(form.elements?.notes&&!form.elements.notes.value)form.elements.notes.value=`SAMA : ${raw}`;},230);},350);}
  function runAction(action,entities,raw){
    if(action==='create_sale')return openNewSale(entities,raw);
    if(action==='create_expense'){window.SamaCopilot?.close?.();const b=qsa('[data-open],.quick,.more-card').find(x=>x.dataset.open==='expenseModal'||/depense/i.test(fold(x.textContent||'')));b?.click();return;}
    if(action==='create_debt'||action==='open_debts'){window.SamaCopilot?.close?.();clickNav('orders',/dette|bor/);return;}
    if(action==='open_stock'){window.SamaCopilot?.close?.();clickNav('stock',/stock/);return;}
    if(action==='open_delivery')return openSales('deliveries');
    if(action==='open_dashboard'){window.SamaCopilot?.close?.();clickNav('home',/accueil/);return;}
    if(action==='open_site_studio'){window.SamaCopilot?.close?.();const b=qsa('button,.more-card,.quick,[role="button"]').find(x=>/studio sites|site studio|boutique en ligne/i.test(fold(x.textContent||'')));b?.click();return;}
  }

  function switchHtml(name,on,title,hint){return `<div class="sagb-setting"><div><b>${esc(title)}</b><small>${esc(hint)}</small></div><button type="button" class="sagb-switch ${on?'on':''}" data-sagb-switch="${name}" aria-pressed="${on?'true':'false'}" aria-label="${esc(title)}"></button></div>`;}
  function renderSettings(){
    const box=resultBox();if(!box)return;const simple=Boolean(window.SamaDesignSystem?.isSimple?.());
    box.innerHTML=`<div class="sagb-settings"><h3>${T('Préférences SAMA','Tànneefi SAMA')}</h3><p>${T('Ces réglages rendent l’application plus simple sans changer vos données.','Tànneef yii dañuy yombal app bi, duñu soppi sa donnée.')}</p>${switchHtml('simple',simple,T('Mode simple','Yoon wu yomb'),T('Textes et zones tactiles plus grands','Mbind ak bouton gën a mag'))}${switchHtml('audio',true,T('Explications audio','Ndimbal ci baat'),T('SAMA peut lire les résumés à voix haute','SAMA man na la jàngal résumé yi'))}<div class="sagb-setting"><div><b>${T('Style d’aide','Melo ndimbal')}</b><small>${T('Choisissez comment SAMA vous guide','Tànnal naka la SAMA di dimbali')}</small></div><select class="sagb-select" data-sagb-style><option value="mixed">${T('Mixte','Baat + gis')}</option><option value="visual">${T('Visuel','Gis')}</option><option value="voice">${T('Voix','Baat')}</option><option value="text">${T('Texte','Mbind')}</option></select></div><button type="button" class="sagb-save" data-sagb-save>${T('Enregistrer mes préférences','Bind sama tànneef')}</button><div class="sagb-status" data-sagb-status></div></div>`;
    qsa('[data-sagb-switch]',box).forEach(b=>b.onclick=()=>{b.classList.toggle('on');b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false');if(b.dataset.sagbSwitch==='simple')window.SamaDesignSystem?.setSimple?.(b.classList.contains('on'));});
    qs('[data-sagb-save]',box).onclick=saveSettings;
  }

  async function saveSettings(){const box=resultBox(),status=qs('[data-sagb-status]',box),simple=qs('[data-sagb-switch="simple"]',box)?.classList.contains('on')??false,audio=qs('[data-sagb-switch="audio"]',box)?.classList.contains('on')??true,helpStyle=qs('[data-sagb-style]',box)?.value||'mixed';if(status)status.textContent=T('Enregistrement…','Maa ngi bind…');try{await api('copilot_save_settings',{guideEnabled:true,marketMode:simple,helpStyle,literacyMode:simple?'simple':'standard',language:isWolof()?'wo':'fr',audioExplanations:audio,simplifiedMode:simple});if(status)status.textContent=T('Préférences enregistrées.','Tànneef yi bind nañu.');window.SamaDesignSystem?.setSimple?.(simple,false);}catch(error){if(status)status.textContent=error.message;}}

  async function loadSnapshotOnce(){if(document.documentElement.dataset.sagbSnapshot==='1'||!token())return;document.documentElement.dataset.sagbSnapshot='1';try{const r=await api('copilot_snapshot');const g=r.guide||{};const pref=g.preferences||g.preference||g.settings||{};const simple=Boolean(pref.simplifiedMode??pref.simplified_mode??pref.marketMode??pref.market_mode);if(simple)window.SamaDesignSystem?.setSimple?.(true,false);}catch(_){document.documentElement.dataset.sagbSnapshot='0';}}

  let scheduled=false;
  function decorate(){scheduled=false;installStyles();ensureButton();ensureSettingsAction();loadSnapshotOnce();document.documentElement.dataset.samaGuideBridgeVersion=VERSION;}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.SamaGuideBridge=Object.freeze({version:VERSION,interpret,settings:renderSettings});
})();
