import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "12.0.1";
const SCRIPT = String.raw`;(function(){
'use strict';
const VERSION='12.0.1';
if(window.__SAMA_STUDIO_LANGUAGE_V12__)return;
window.__SAMA_STUDIO_LANGUAGE_V12__=true;
const originals=new WeakMap();
const attrs=new WeakMap();
let lang=localStorage.getItem('sama-ui-lang')==='wo'?'wo':'fr';
const WO=new Map(Object.entries({
'Créer un site':'Sos sa site','Mes sites':'Sama site yi','Administration':'Saytu site yi','Sama Business — Studio Sites':'Sama Business — Site yi','Créez, publiez et supervisez vos sites':'Sos, siwal te saytu sa site yi','Créez un site qui parle à vos clients':'Sos site buy wax ak sa kiliyaan yi','Une création visuelle, adaptée au téléphone, avec contrôle automatique des activités et contenus interdits.':'Site bu yomb a gis te yomb a jëfandikoo ci telefon, ak saytu kaaraange.','Identité':'Xibaaru liggéey bi','Nom de la marque':'Turu sa liggéey','Que proposez-vous ?':'Lan ngay jaay walla lan ngay def?','Décrivez simplement les produits ou services.':'Waxal ci lu gàtt li ngay jaay walla li ngay def.','Ville':'Dëkk','Langue':'Làkk','Contacts publics':'Jokkoo ak kiliyaan yi','Téléphone':'Telefon','E-mail public':'E-mail bu ñépp gis','L’adresse d’administration n’est jamais publiée sur les sites créés.':'Adresu admin du feeñ ci site yi.','Secteur':'Wàllu liggéey','Objectif':'Li nga bëgg','Boutique':'Bitig','Mode':'Yéré','Restaurant':'Restoraa','Artisanat':'Liggéeyu loxo','Services':'Sarwiis','Immobilier':'Kër ak suuf','Formation':'Njàng','Agriculture':'Bay','Numérique':'Digital','Beauté':'Taar','Vendre':'Jaay','Commandes':'Komànd','Rendez-vous':'Rendez-vous','Devis':'Devis','Contacts':'Jokkoo','Présenter':'Wone','Générer mon site':'Sos sama site','Création…':'Mingi sos…','Aperçu, publication et archivage avec conservation de l’historique.':'Xool, siwal walla denc site bi te aar jaar-jaaram.','Nouveau site':'Site bu bees','Aucun site créé':'Amul site bu ñu sos','Votre premier site apparaîtra ici.':'Sa site bu njëkk dina feeñ fii.','Créer mon premier site':'Sos sama site bu njëkk','Aperçu':'Xool','Publier':'Siwal','Archiver':'Denc','Restaurer':'Delloo','Brouillon':'Waajal','Publié':'Siwal na','Archivé':'Denc na','Suspendu':'Taxawal na','Approuvé':'Nangu nañu ko','À vérifier':'War nañu ko seet','Non connecté':'Jokkoo naagul','Mis à jour':'Yeesal na','Administration multi-sites':'Saytu site yépp','Contrôle des créations, de la sécurité, des domaines et des publications.':'Saytu sos yi, kaaraange, turu domaine ak siwal yi.','Actualiser':'Yeesal','Rechercher un site ou client':'Seet site walla kiliyaan','Tous les états':'Melo yépp','Tous les sites':'Site yépp','Approuver':'Nangu','Suspendre':'Taxawal','Total':'Lépp','Publiés':'Yi ñu siwal','Brouillons':'Yi ñuy waajal','Suspendus':'Yi ñu taxawal','Domaines en erreur':'Domaine yu am jafe-jafe','Aucun site à superviser':'Amul site bu ñuy saytu','Les prochaines créations apparaîtront ici.':'Site yu ñuy sos dinañu feeñ fii.','Prêt à avancer ?':'Ndax pare nga?','Site créé avec succès.':'Sos nañu site bi.','Site créé et placé en vérification.':'Sos nañu site bi te ñu koy seet.','Action appliquée.':'Jëf ji mat na.','Connexion nécessaire':'Danga wara dugg','Connectez-vous à Sama Business pour continuer.':'Duggal ci Sama Business ngir kontine.','Fermer':'Tëj','Aperçu du site':'Xool site bi','Ouvrir':'Ubbi'
}));
function textNodes(root){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue?.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});const out=[];while(walker.nextNode())out.push(walker.currentNode);return out}
function translateNode(node){if(!originals.has(node))originals.set(node,node.nodeValue);const original=originals.get(node);if(lang==='fr'){node.nodeValue=original;return}const raw=String(original);const trimmed=raw.trim();const translated=WO.get(trimmed);if(translated)node.nodeValue=raw.replace(trimmed,translated)}
function translateAttrs(el){if(!attrs.has(el))attrs.set(el,{placeholder:el.getAttribute('placeholder'),title:el.getAttribute('title'),aria:el.getAttribute('aria-label')});const o=attrs.get(el);for(const [name,value] of [['placeholder',o.placeholder],['title',o.title],['aria-label',o.aria]]){if(value==null)continue;el.setAttribute(name,lang==='wo'?(WO.get(value.trim())||value):value)}}
function apply(){const root=document.querySelector('#ss-root');if(!root)return;textNodes(root).forEach(translateNode);root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateAttrs);const button=document.querySelector('#ss-lang-toggle');if(button){button.textContent=lang==='wo'?'FR':'WO';button.title=lang==='wo'?'Afficher en français':'Wone ci Wolof'}const select=document.querySelector('#ss-lang');if(select&&lang==='wo'&&select.value==='fr')select.value='wo'}
function toggle(){lang=lang==='fr'?'wo':'fr';localStorage.setItem('sama-ui-lang',lang);apply();window.dispatchEvent(new CustomEvent('sama-language-change',{detail:{language:lang}}))}
function mountButton(){const head=document.querySelector('#ss-root .ss-head');if(!head||document.querySelector('#ss-lang-toggle'))return;const close=head.querySelector('#ss-close');const button=document.createElement('button');button.id='ss-lang-toggle';button.type='button';button.className='ss-x';button.style.fontSize='13px';button.style.fontWeight='900';button.textContent=lang==='wo'?'FR':'WO';button.addEventListener('click',toggle);head.insertBefore(button,close||null)}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(()=>{mountButton();apply()},40)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('sama-language-change',e=>{const next=e.detail?.language;if(next==='fr'||next==='wo'){lang=next;apply()}});schedule();
window.SAMABUSINESS=Object.assign(window.SAMABUSINESS||{},{studioLanguage:{version:VERSION,get:()=>lang,set:value=>{if(value==='fr'||value==='wo'){lang=value;localStorage.setItem('sama-ui-lang',lang);apply()}}}});
})();`;
Deno.serve((req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  return new Response(req.method === "HEAD" ? null : SCRIPT, {
    headers
  });
});
