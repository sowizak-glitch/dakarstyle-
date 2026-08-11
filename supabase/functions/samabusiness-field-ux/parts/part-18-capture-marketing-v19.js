(() => {
  'use strict';
  if (window.__SAMABUSINESS_CAPTURE_MARKETING_V19__) return;
  window.__SAMABUSINESS_CAPTURE_MARKETING_V19__ = true;

  const VERSION = '19.0.0-beta.1';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]);
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmt = (v) => `${money.format(Math.max(Number(v || 0),0))} F`;
  const isWolof = () => { try { return typeof state !== 'undefined' && state?.language === 'wo'; } catch (_) { return false; } };
  const T = (fr, wo) => isWolof() && wo ? wo : fr;

  const I = {
    close:'<path d="m6 6 12 12M18 6 6 18"/>',camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/>',
    mic:'<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 10a6.5 6.5 0 0 0 13 0M12 16.5V21M9 21h6"/>',
    wand:'<path d="m15 4 5 5L9 20l-5-5L15 4Z"/><path d="M5 5h4M7 3v4M17 15h4M19 13v4"/>',
    message:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15Z"/><path d="M8 11h8M8 15h5"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    wallet:'<path d="M4 7h15v12H6a2 2 0 0 1-2-2z"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${I[name]||I.wand}</svg>`;

  function styles() {
    if (qs('#sama-capture-marketing-styles')) return;
    const style = document.createElement('style');
    style.id = 'sama-capture-marketing-styles';
    style.textContent = `
      .sacm-overlay{position:fixed;z-index:2147483560;inset:0;background:rgba(15,35,28,.4);backdrop-filter:blur(8px);display:none;align-items:flex-end;justify-content:center;padding:12px}.sacm-overlay.open{display:flex}
      .sacm-sheet{width:min(720px,100%);max-height:min(90vh,850px);overflow:auto;background:#fbfdfc;border:1px solid #d9e4de;border-radius:24px;padding:14px 14px calc(16px + env(safe-area-inset-bottom));box-shadow:0 24px 80px rgba(7,38,27,.28);color:#10251d}
      .sacm-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:11px;border-bottom:1px solid #e2e9e5;position:sticky;top:-14px;background:rgba(251,253,252,.96);backdrop-filter:blur(15px);z-index:2}.sacm-head b{font-size:17px}.sacm-head small{display:block;color:#6a7973;margin-top:2px}.sacm-close{width:44px;height:44px;border:1px solid #dce5e0;background:#fff;border-radius:14px;color:#42584f;display:grid;place-items:center}.sacm-close svg{width:18px;height:18px}
      .sacm-section{margin-top:14px}.sacm-section h3{font-size:14px;margin:0 0 8px}.sacm-section p{font-size:12px;color:#61736a;line-height:1.45;margin:5px 0}
      .sacm-drop{display:block;border:1.5px dashed #bad4c8;border-radius:18px;background:#f4faf7;padding:15px;text-align:center;cursor:pointer}.sacm-drop .ico{width:42px;height:42px;border-radius:14px;background:#e4f3eb;color:#087153;display:grid;place-items:center;margin:0 auto 8px}.sacm-drop svg{width:21px;height:21px}.sacm-drop b{display:block;font-size:13px}.sacm-drop input{display:none}
      .sacm-preview{display:none;margin-top:10px;border-radius:16px;overflow:hidden;border:1px solid #dce5e0;background:#fff}.sacm-preview.show{display:grid;grid-template-columns:130px 1fr}.sacm-preview img{width:100%;height:100%;min-height:130px;object-fit:cover;background:#edf2ef}.sacm-preview>div{padding:10px;min-width:0}.sacm-preview textarea{width:100%;min-height:110px;border:1px solid #dbe4df;border-radius:12px;padding:9px;resize:vertical;font:500 12px/1.4 system-ui;background:#fff;color:#172a22}.sacm-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.sacm-btn{height:42px;border-radius:13px;border:1px solid #d7e3dd;background:#fff;color:#0a684a;font-weight:850;padding:0 12px;display:inline-flex;align-items:center;gap:7px}.sacm-btn svg{width:16px;height:16px}.sacm-btn.primary{background:#087153;color:#fff;border-color:#087153}.sacm-note{font-size:10px!important;color:#78877f!important}
      .sacm-segments{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.sacm-segment{border:1px solid #dce6e0;border-radius:17px;background:#fff;padding:11px;text-align:left;min-height:105px}.sacm-segment .ico{width:34px;height:34px;border-radius:11px;background:#eaf5ef;color:#087153;display:grid;place-items:center;margin-bottom:8px}.sacm-segment .ico svg{width:18px;height:18px}.sacm-segment.due .ico{background:#fff0f1;color:#a33a42}.sacm-segment.dormant .ico{background:#fff5dd;color:#936300}.sacm-segment b{font-size:12px;display:block}.sacm-segment strong{font-size:18px;display:block;margin-top:3px}.sacm-segment small{font-size:10px;color:#718078;display:block;margin-top:3px}
      .sacm-campaign{margin-top:12px;border:1px solid #dce6e0;border-radius:17px;background:#fff;padding:12px}.sacm-campaign label{display:block;font-size:10px;font-weight:900;color:#62736b;margin:9px 0 5px;text-transform:uppercase;letter-spacing:.04em}.sacm-campaign textarea{width:100%;min-height:110px;border:1px solid #dce5e0;border-radius:13px;padding:10px;font:500 12px/1.45 system-ui}.sacm-channels{display:flex;gap:7px;flex-wrap:wrap}.sacm-chip{padding:7px 9px;border-radius:999px;background:#f1f6f3;border:1px solid #dce5e0;color:#496057;font-size:10px;font-weight:850}
      .sacm-list{margin-top:10px;max-height:250px;overflow:auto}.sacm-person{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 3px;border-bottom:1px solid #edf1ef}.sacm-person b{font-size:12px}.sacm-person p{margin:2px 0 0;font-size:10px}.sacm-person button{height:36px;border:1px solid #cfe0d7;background:#f3faf6;color:#087153;border-radius:11px;padding:0 10px;font-weight:850}
      @media(max-width:560px){.sacm-segments{grid-template-columns:1fr}.sacm-segment{min-height:82px}.sacm-preview.show{grid-template-columns:92px 1fr}.sacm-sheet{border-radius:22px 22px 14px 14px}}
    `;
    document.head.appendChild(style);
  }

  function ensureCapture() {
    let overlay = qs('#sama-capture-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div'); overlay.id='sama-capture-overlay'; overlay.className='sacm-overlay'; overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `<section class="sacm-sheet" role="dialog" aria-modal="true" aria-label="Photo cahier ou reçu"><div class="sacm-head"><div><b>${T('Photo / cahier — Bêta','Foto / kaye — Beta')}</b><small>${T('Prépare une saisie, sans enregistrer automatiquement','Waajal bind bi, du ko bind boppam')}</small></div><button class="sacm-close" type="button" aria-label="Fermer">${icon('close')}</button></div>
      <div class="sacm-section"><label class="sacm-drop"><span class="ico">${icon('camera')}</span><b>${T('Photographier un cahier, ticket ou reçu','Jël foto kaye, tiket walla reçu')}</b><p>${T('SAMA essaie de lire localement le texte quand le téléphone le permet.','SAMA dina jéem jàng mbind mi ci telefon bi su ko mënée.')}</p><input data-sacm-file type="file" accept="image/*" capture="environment"></label>
      <div class="sacm-preview" data-sacm-preview><img alt="Aperçu de la photo"><div><textarea data-sacm-text placeholder="${T('Texte détecté ou dicté…','Mbind mi ñu gis walla wax…')}"></textarea><div class="sacm-tools"><button class="sacm-btn" type="button" data-sacm-dictate>${icon('mic')} ${T('Dicter','Wax')}</button><button class="sacm-btn primary" type="button" data-sacm-prepare>${icon('wand')} ${T('Préparer une vente','Waajal jaay')}</button></div><p class="sacm-note" data-sacm-status>${T('Aucune donnée n’est enregistrée avant votre confirmation dans Nouvelle vente.','Dara duñu bind bala nga dëggal ci Jaay bu bees.')}</p></div></div></div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay(overlay)}); qs('.sacm-close',overlay).onclick=()=>closeOverlay(overlay);
    qs('[data-sacm-file]',overlay).onchange=e=>handlePhoto(e.target.files?.[0],overlay);
    qs('[data-sacm-dictate]',overlay).onclick=()=>dictateTo(qs('[data-sacm-text]',overlay));
    qs('[data-sacm-prepare]',overlay).onclick=()=>prepareSale(qs('[data-sacm-text]',overlay).value,overlay);
    return overlay;
  }

  function ensureMarketing() {
    let overlay=qs('#sama-marketing-overlay'); if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='sama-marketing-overlay';overlay.className='sacm-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<section class="sacm-sheet" role="dialog" aria-modal="true" aria-label="SAMA Marketing Copilot"><div class="sacm-head"><div><b>SAMA Marketing Copilot · Bêta</b><small>${T('Prépare les campagnes. Vous gardez toujours la validation finale.','Waajal campagne yi. Yaw rekk nga koy dëggal.')}</small></div><button class="sacm-close" type="button" aria-label="Fermer">${icon('close')}</button></div><div class="sacm-section"><h3>${T('Qui contacter maintenant ?','Kan lañu wara jokkoo ak moom ?')}</h3><div class="sacm-segments" data-sacm-segments></div><div data-sacm-campaign></div></div></section>`;
    document.body.appendChild(overlay);overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay(overlay)});qs('.sacm-close',overlay).onclick=()=>closeOverlay(overlay);return overlay;
  }
  function openOverlay(overlay){overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
  function closeOverlay(overlay){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''}

  async function handlePhoto(file, overlay){
    if(!file)return;const preview=qs('[data-sacm-preview]',overlay),img=qs('img',preview),area=qs('[data-sacm-text]',preview),status=qs('[data-sacm-status]',preview);preview.classList.add('show');img.src=URL.createObjectURL(file);area.value='';status.textContent=T('Analyse locale en cours…','Maa ngi jéem jàng ko ci telefon bi…');
    let detected='';
    try{
      if('TextDetector'in window){const detector=new window.TextDetector();const bitmap=await createImageBitmap(file);const blocks=await detector.detect(bitmap);detected=(blocks||[]).map(b=>b.rawValue||b.text||'').filter(Boolean).join('\n');bitmap.close?.();}
    }catch(_){detected='';}
    if(detected){area.value=detected;status.textContent=T('Texte détecté localement. Vérifiez puis préparez la vente.','Mbind mi gis nañu ko. Seetal ko, waajal jaay bi.');}
    else{status.textContent=T('Lecture automatique non disponible sur ce téléphone. Gardez la photo à l’écran et dictez les informations : SAMA préparera la saisie.','Jàng boppam amul ci telefon bii. Bayyi foto bi te wax li ci nekk; SAMA dina waajal bind bi.');}
  }

  function dictateTo(textarea){
    const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Ctor){textarea.focus();return;}
    const r=new Ctor();r.lang='fr-FR';r.interimResults=false;r.maxAlternatives=1;r.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';textarea.value=[textarea.value,t].filter(Boolean).join('\n');};r.start();
  }

  function parseDraft(text){
    const raw=String(text||'').replace(/\s+/g,' ').trim();
    const phone=(raw.match(/(?:\+?221|00221)?\s*7[05678](?:[\s.-]*\d){7}/)||[])[0]||'';
    const amounts=[...raw.matchAll(/\b(\d{1,3}(?:[ .]\d{3})+|\d{4,7})\s*(?:f|fcfa|cfa)?\b/gi)].map(m=>Number(m[1].replace(/[ .]/g,''))).filter(n=>n>=500&&n<=100000000);
    const price=amounts.length?Math.max(...amounts):0;
    const qtyMatch=raw.match(/(?:qte|quantite|qté|x)\s*[:x-]?\s*(\d{1,3})|\b(\d{1,3})\s*x\b/i);const quantity=Number(qtyMatch?.[1]||qtyMatch?.[2]||1)||1;
    const client=(raw.match(/(?:client|nom)\s*[:\-]\s*([a-zà-ÿ' -]{2,40})/i)||[])[1]?.trim()||'';
    let product=(raw.match(/(?:produit|article)\s*[:\-]\s*([^,;]{2,60})/i)||[])[1]?.trim()||'';
    if(!product){product=raw.split(/[.;]/)[0].replace(/\b(client|nom|tel|telephone|montant|total|prix|qte|quantite)\b.*$/i,'').trim().slice(0,60);}
    return{customerName:client,customerPhone:phone.replace(/\D/g,''),productName:product||'Article photo',quantity,unitPrice:price};
  }

  function prepareSale(text,overlay){
    const draft=parseDraft(text);closeOverlay(overlay);
    const salesNav=qsa('[data-nav="sales"],.nav-btn').find(b=>b.dataset.nav==='sales'||/ventes|jaay/i.test(b.textContent||''));salesNav?.click();
    setTimeout(()=>{qs('[data-sbso-new]')?.click();setTimeout(()=>fillSaleForm(draft),260);},350);
  }
  function fillSaleForm(draft){
    const form=qs('#sbso-sale-overlay form,.sbso-overlay.open form');if(!form)return;
    const set=(el,v)=>{if(!el||v===undefined||v===null||v==='')return;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    set(form.elements?.customerName,draft.customerName);set(form.elements?.customerPhone,draft.customerPhone);
    set(qs('[data-line-name]',form),draft.productName);set(qs('[data-line-qty]',form),draft.quantity);set(qs('[data-line-price]',form),draft.unitPrice);
    const source=form.elements?.source;if(source){source.value='photo';source.dispatchEvent(new Event('change',{bubbles:true}));}
    form.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function workspace(){return window.SamaCopilot?.getWorkspace?.()||null}
  function segments(ws){
    const now=Date.now(),days=d=>d?Math.floor((now-new Date(d).getTime())/86400000):9999,customers=ws?.customers||[];
    const due=customers.filter(c=>Number(c.outstanding_amount||0)>0);
    const dormant=customers.filter(c=>Number(c.purchase_count||0)>0&&days(c.last_purchase_at)>=30&&Number(c.outstanding_amount||0)<=0);
    const loyal=customers.filter(c=>Number(c.purchase_count||0)>=2&&Number(c.outstanding_amount||0)<=0&&days(c.last_purchase_at)<90);
    return{due,dormant,loyal};
  }
  function messageFor(type,customer){
    const name=(customer?.name||'').split(' ')[0]||T('client','kiliyaan');
    if(isWolof()){
      if(type==='due')return `Nanga def ${name}, SAMA fàttali la ne ${fmt(customer.outstanding_amount)} des na ci sa paiement. Mën nga nu wax kan nga koy fay. Jërëjëf.`;
      if(type==='dormant')return `Nanga def ${name}, yàgg nañu la gis. Am nañu ay nouveauté ci sunu commerce. Boo bëggee, dinañu la yónnee li bees yi ci WhatsApp.`;
      return `Nanga def ${name}, jërëjëf ci sa kóllëre ak nun. Am nañu ay nouveauté yu mën la neex. Mën nañu la yónnee choix bi ci WhatsApp.`;
    }
    if(type==='due')return `Bonjour ${name}, petit rappel : il reste ${fmt(customer.outstanding_amount)} à régler sur vos achats. Dites-nous simplement quand vous souhaitez finaliser le paiement. Merci.`;
    if(type==='dormant')return `Bonjour ${name}, cela fait un moment. Nous avons de nouvelles arrivées qui pourraient vous intéresser. Souhaitez-vous que nous vous envoyions une sélection ici sur WhatsApp ?`;
    return `Bonjour ${name}, merci pour votre fidélité. Nous avons préparé de nouvelles pièces qui pourraient vous plaire. Souhaitez-vous recevoir une sélection sur WhatsApp ?`;
  }
  function genericMessage(type){return messageFor(type,{name:T('client','kiliyaan'),outstanding_amount:0})}

  async function renderMarketing(preferred){
    const overlay=ensureMarketing();openOverlay(overlay);let ws=workspace();if(!ws){try{ws=await window.SamaCopilot?.refresh?.();}catch(_){}}ws=workspace()||ws;
    if(!ws){qs('[data-sacm-segments]',overlay).innerHTML=`<p>${T('Données indisponibles pour le moment.','Donnée yi amuñu léegi.')}</p>`;return;}
    const s=segments(ws),box=qs('[data-sacm-segments]',overlay);box.innerHTML=`
      <button class="sacm-segment due" type="button" data-segment="due"><span class="ico">${icon('wallet')}</span><b>${T('Paiements à relancer','Paiement yi ñu wara fàttali')}</b><strong>${s.due.length}</strong><small>${fmt(s.due.reduce((a,c)=>a+Number(c.outstanding_amount||0),0))}</small></button>
      <button class="sacm-segment dormant" type="button" data-segment="dormant"><span class="ico">${icon('users')}</span><b>${T('Clients à réveiller','Kiliyaan yu yàgg')}</b><strong>${s.dormant.length}</strong><small>${T('30 jours sans achat','30 fan jaay amul')}</small></button>
      <button class="sacm-segment" type="button" data-segment="loyal"><span class="ico">${icon('heart')}</span><b>${T('Clients fidèles','Kiliyaan yu dëggu')}</b><strong>${s.loyal.length}</strong><small>${T('À remercier / réactiver','Jërëjëf / relance')}</small></button>`;
    qsa('[data-segment]',box).forEach(b=>b.onclick=()=>renderCampaign(b.dataset.segment,s[b.dataset.segment]||[],overlay));
    renderCampaign(preferred&&s[preferred]?preferred:(s.due.length?'due':s.dormant.length?'dormant':'loyal'),s[preferred]||s.due.length&&s.due||s.dormant.length&&s.dormant||s.loyal,overlay);
  }

  function renderCampaign(type,list,overlay){
    list=Array.isArray(list)?list:[];const area=qs('[data-sacm-campaign]',overlay);const first=list[0]||{};const template=messageFor(type,first);
    const title=type==='due'?T('Relance paiement','Fàttali paiement'):type==='dormant'?T('Réactivation client','Relance kiliyaan'):T('Fidélité','Kóllëre');
    area.innerHTML=`<div class="sacm-campaign"><h3>${esc(title)}</h3><div class="sacm-channels"><span class="sacm-chip">WhatsApp</span><span class="sacm-chip">Instagram · ${T('texte prêt','mbind pare')}</span><span class="sacm-chip">Facebook · ${T('texte prêt','mbind pare')}</span></div><label>${T('Message proposé','Mbind mi SAMA waajal')}</label><textarea data-campaign-text>${esc(template)}</textarea><div class="sacm-tools"><button class="sacm-btn" type="button" data-copy-campaign>${icon('copy')} ${T('Copier','Copie')}</button></div><div class="sacm-list">${list.slice(0,30).map(c=>`<div class="sacm-person"><div><b>${esc(c.name||'Client')}</b><p>${esc(c.phone||c.whatsapp||'')}${Number(c.outstanding_amount||0)>0?` · ${fmt(c.outstanding_amount)}`:''}</p></div><button type="button" data-market-wa="${esc(c.phone||c.whatsapp||'')}" data-market-name="${esc(c.name||'Client')}">WhatsApp</button></div>`).join('')||`<p>${T('Aucun client dans ce segment.','Kiliyaan amul fii.')}</p>`}</div><p class="sacm-note">${T('SAMA ne fait aucun envoi de masse sans votre action. Chaque message reste sous votre contrôle.','SAMA du yónnee dara boppam. Yaw nga koy dëggal.')}</p></div>`;
    qs('[data-copy-campaign]',area).onclick=async()=>{try{await navigator.clipboard.writeText(qs('[data-campaign-text]',area).value);}catch(_){qs('[data-campaign-text]',area).select();document.execCommand?.('copy');}};
    qsa('[data-market-wa]',area).forEach(b=>b.onclick=()=>{const c=list.find(x=>(x.phone||x.whatsapp||'')===b.dataset.marketWa)||first;openWhatsapp(b.dataset.marketWa,messageFor(type,c));});
  }
  function openWhatsapp(phone,message){let p=String(phone||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===9&&p.startsWith('7'))p=`221${p}`;if(!p)return;window.open(`https://wa.me/${p}?text=${encodeURIComponent(message)}`,'_blank','noopener');}

  function boot(){styles();ensureCapture();ensureMarketing();window.addEventListener('sama:open-capture',()=>openOverlay(ensureCapture()));window.addEventListener('sama:open-marketing',e=>renderMarketing(e.detail?.segment));document.documentElement.dataset.samaCaptureMarketingVersion=VERSION;}
  window.SamaCaptureMarketing=Object.freeze({version:VERSION,openCapture:()=>openOverlay(ensureCapture()),openMarketing:renderMarketing,parseDraft});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
