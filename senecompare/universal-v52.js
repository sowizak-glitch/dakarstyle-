(()=>{
'use strict';
const V='5.2.0';
const state={taxonomy:null,picture:false};
const $=(s,r=document)=>r.querySelector(s);
const wolof=()=>{const lang=(document.documentElement.lang||'').toLowerCase();const body=(document.body?.innerText||'').slice(0,1000);return lang.startsWith('wo')||/Waxal li nga soxla|Lu ñu seetoon|Yi nga bëgg/.test(body)};
const t=(fr,wo)=>wolof()?wo:fr;
function toast(message){let el=$('.sc52-toast');if(!el){el=document.createElement('div');el.className='sc52-toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2400)}
function normalizeBrand(){
  document.title=document.title.replace(/SeneCompare\s+AI/gi,'SeneCompare');
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{if(/SeneCompare\s+AI/i.test(n.nodeValue||''))n.nodeValue=n.nodeValue.replace(/SeneCompare\s+AI/gi,'SeneCompare')});
  const brand=$('header a, header [class*="brand"], [class*="brand"]');
  if(brand&&!brand.querySelector('img[data-sc52-profile]')){
    const icon=brand.querySelector('svg,.logo,[class*="logo"]');
    if(!icon){const img=document.createElement('img');img.src='/icon-192.png?v='+V;img.alt='SeneCompare';img.width=56;img.height=56;img.dataset.sc52Profile='1';img.style.cssText='border-radius:18px;object-fit:cover;box-shadow:0 8px 22px rgba(8,34,53,.18);margin-right:12px';brand.prepend(img)}
  }
}
function findSearch(){
  const input=$('input[type="search"],input[name="q"],input[name="query"],#search-input,#query,[data-search-input]');
  if(!input)return null;
  return {input,form:input.closest('form'),button:input.closest('form')?.querySelector('button[type="submit"],input[type="submit"]')||$('[data-search-submit],#search-button')};
}
function runSearch(query){
  const found=findSearch();
  if(!found){location.href='/?q='+encodeURIComponent(query);return}
  found.input.value=query;found.input.dispatchEvent(new Event('input',{bubbles:true}));found.input.dispatchEvent(new Event('change',{bubbles:true}));
  found.input.focus({preventScroll:true});
  if(found.form){if(typeof found.form.requestSubmit==='function')found.form.requestSubmit();else found.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}
  else if(found.button)found.button.click();
  else found.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
  history.replaceState(null,'','/?q='+encodeURIComponent(query));
  toast(t('Recherche lancée','Seet bi tàmbali na'));
  setTimeout(()=>found.input.scrollIntoView({behavior:'smooth',block:'center'}),120);
}
function card(item){
  const button=document.createElement('button');button.type='button';button.className='sc52-card';button.dataset.category=item.id;button.setAttribute('aria-label',t('Comparer '+item.fr,'Méngale '+item.wo));
  button.innerHTML=`<span class="sc52-icon" aria-hidden="true">${item.icon}</span><span class="sc52-label">${t(item.fr,item.wo)}<small class="sc52-secondary">${t(item.wo,item.fr)}</small></span>`;
  button.addEventListener('click',()=>runSearch(item.query));return button;
}
function render(data){
  if($('#sc52-hub'))return;
  const host=document.createElement('section');host.id='sc52-hub';host.className='sc52-hub';host.setAttribute('aria-labelledby','sc52-title');
  host.innerHTML=`<div class="sc52-head"><div><p class="sc52-eyebrow">${t('Tout comparer au Sénégal','Méngale lépp ci Senegaal')}</p><h2 class="sc52-title" id="sc52-title">${t('Touchez une image. Comparez sans vous compliquer.','Bësal nataal. Méngale te bul sonal sa bopp.')}</h2><p class="sc52-sub">${t('Produits, services, artisans et matériel professionnel. Vous pouvez aussi parler au micro.','Mëbël, ndimbal, liggéeykat ak jumtukaayi liggéey. Mën nga itam wax ci mikro bi.')}</p></div><div class="sc52-actions"><button class="sc52-action" id="sc52-picture" type="button">🖼️ ${t('Mode images','Nataal yu mag')}</button><button class="sc52-action primary" id="sc52-speak" type="button">🎙️ ${t('Parler','Wax')}</button></div></div>`;
  data.groups.forEach(group=>{const section=document.createElement('section');section.className='sc52-group';section.innerHTML=`<div class="sc52-group-head"><h3 class="sc52-group-title">${t(group.title_fr,group.title_wo)}</h3><span aria-hidden="true">→</span></div><div class="sc52-scroll" role="list"></div>`;const rail=$('.sc52-scroll',section);group.items.forEach(item=>rail.append(card(item)));host.append(section)});
  const anchor=$('#results,[data-results],main section:nth-of-type(2),main')||document.body;
  if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor);else document.body.append(host);
  $('#sc52-picture',host).addEventListener('click',()=>{state.picture=!state.picture;host.classList.toggle('sc52-picture-mode',state.picture);$('#sc52-picture',host).textContent=state.picture?'↙️ '+t('Taille normale','Dellu ci ndaw'):'🖼️ '+t('Mode images','Nataal yu mag')});
  $('#sc52-speak',host).addEventListener('click',()=>{const mic=$('[data-voice],#voice-button,#mic-button,button[aria-label*="vocal" i],button[aria-label*="micro" i],button[title*="vocal" i]');if(mic)mic.click();else{const found=findSearch();found?.input?.focus();toast(t('Touchez le micro près de la recherche','Bësal mikro bi ci wetu seet bi'))}});
}
function installHelp(){
  const standalone=matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;if(standalone)return;
  const wrap=document.createElement('div');wrap.className='sc52-install-help visible';wrap.innerHTML=`<div class="sc52-install-box"><span style="font-size:1.8rem" aria-hidden="true">📲</span><div><strong>${t('Gardez SeneCompare sur votre téléphone','Dencal SeneCompare ci sa telefon')}</strong><span>${/iphone|ipad|ipod/i.test(navigator.userAgent)?t('Safari : Partager puis Sur l’écran d’accueil.','Safari: Bokkale, topp ci Sur l’écran d’accueil.'):t('Appuyez sur Installer en haut de la page.','Bësal Installer ci kaw.')}</span></div></div>`;
  const hub=$('#sc52-hub');hub?.before(wrap);
}
function deepLink(){const q=new URLSearchParams(location.search).get('q');if(!q)return;const found=findSearch();if(!found)return;if(!found.input.value)found.input.value=q;const key='sc52:q:'+q;let done=false;try{done=sessionStorage.getItem(key);if(!done)sessionStorage.setItem(key,'1')}catch(_){}if(!done)setTimeout(()=>runSearch(q),650)}
async function init(){
  normalizeBrand();
  try{const r=await fetch('/__sc/taxonomy.json?v='+V,{cache:'no-store'});if(!r.ok)throw new Error('taxonomy');state.taxonomy=await r.json();render(state.taxonomy)}catch(e){console.warn('[SeneCompare] taxonomy unavailable',e)}
  installHelp();deepLink();
  document.addEventListener('click',e=>{if(e.target.closest('[data-lang],button'))setTimeout(()=>{normalizeBrand();if(state.taxonomy){$('#sc52-hub')?.remove();render(state.taxonomy)}},180)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
