(() => {
  "use strict";
  const WHATSAPP = "221773374762";
  const CART_KEY = "ds_cart_sized_v2";
  const productDataNode = document.getElementById("productData");
  const PRODUCTS = productDataNode ? JSON.parse(productDataNode.textContent || "[]") : [];
  const productMap = new Map(PRODUCTS.map(product => [Number(product.id), product]));
  const moneyFormatter = new Intl.NumberFormat("fr-FR");
  let cart = [];
  let activeFilter = "all";
  let searchText = "";
  let searchTimer = 0;
  let zoomProductId = null;
  let zoomPreviousFocus = null;
  let zoomMoveFrame = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (Array.isArray(saved)) cart = saved;
  } catch {
    localStorage.removeItem(CART_KEY);
  }
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const fmt = value => `${moneyFormatter.format(Number(value || 0))} FCFA`;
  function reconcileCart() {
    cart = cart.map(item => {
      const product = productMap.get(Number(item.id));
      if (!product) return null;
      return {id:Number(product.id),name:product.name,price:Number(product.price||0),img:product.img,availability:product.availability||"Disponible",size:item.size,qty:Math.max(1,Number(item.qty||1))};
    }).filter(Boolean);
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
    const count = cart.reduce((sum,item)=>sum+item.qty,0);
    const node = $("#cartCount");
    if (node) node.textContent = String(count);
  }
  function cartTotal(){return cart.reduce((sum,item)=>sum+item.price*item.qty,0)}
  function renderCart(){
    saveCart();
    const body=$("#cartBody"), total=$("#cartTotal");
    if(!body||!total)return;
    total.textContent=fmt(cartTotal());
    if(!cart.length){body.innerHTML="<p>Votre panier est vide.</p>";return}
    body.innerHTML=cart.map(item=>`<div class="cart-item"><img src="${item.img}" alt="" loading="lazy" decoding="async"><div><h4>${item.name}</h4><p>Taille : ${item.size} · ${fmt(item.price)} chacun</p>${item.availability&&item.availability!=="Disponible"?`<p>${item.availability}</p>`:""}<div class="qty" data-cart-id="${item.id}" data-cart-size="${encodeURIComponent(item.size)}"><button type="button" data-action="qty-minus" aria-label="Retirer">−</button><span>${item.qty}</span><button type="button" data-action="qty-plus" aria-label="Ajouter">+</button></div></div><strong>${fmt(item.price*item.qty)}</strong></div>`).join("");
  }
  function openCart(){$("#cartDrawer")?.classList.add("open");$("#overlay")?.classList.add("open")}
  function closeCart(){$("#cartDrawer")?.classList.remove("open");$("#overlay")?.classList.remove("open")}
  function addToCart(id){
    const product=productMap.get(Number(id));if(!product)return;
    const select=document.getElementById(`size-${id}`);const size=select?.value.trim()||"";
    if(!size){select?.focus();return}
    const current=cart.find(item=>Number(item.id)===Number(id)&&item.size===size);
    if(current)current.qty+=1;else cart.push({id:Number(product.id),name:product.name,price:Number(product.price||0),img:product.img,availability:product.availability||"Disponible",size,qty:1});
    renderCart();openCart();
  }
  function changeQty(id,encodedSize,delta){
    const size=decodeURIComponent(encodedSize||"");const item=cart.find(entry=>Number(entry.id)===Number(id)&&entry.size===size);if(!item)return;
    item.qty+=delta;if(item.qty<=0)cart=cart.filter(entry=>!(Number(entry.id)===Number(id)&&entry.size===size));renderCart();
  }
  function applyProductFilter(){
    $$(".product[data-product-id]").forEach(card=>{const matchesType=activeFilter==="all"||card.dataset.type===activeFilter;const matchesSearch=!searchText||(card.dataset.search||"").includes(searchText);card.hidden=!(matchesType&&matchesSearch)});
  }
  function setFilter(key){activeFilter=key;$$('.chip[data-filter]').forEach(button=>{const active=button.dataset.filter===key;button.classList.toggle("active",active);button.setAttribute("aria-pressed",active?"true":"false")});applyProductFilter()}
  function scheduleSearch(value){window.clearTimeout(searchTimer);const next=value.trim().toLowerCase();searchTimer=window.setTimeout(()=>{searchText=next;applyProductFilter()},100)}
  function openCheckout(){if(!cart.length){openCart();return}$("#checkoutModal")?.classList.add("open");document.body.classList.add("modal-lock");window.setTimeout(()=>$("#clientName")?.focus(),0)}
  function closeCheckout(){$("#checkoutModal")?.classList.remove("open");if(!$("#zoomModal")?.classList.contains("open"))document.body.classList.remove("modal-lock")}
  function sendOrder(){
    const name=$("#clientName")?.value.trim()||"",phone=$("#clientPhone")?.value.trim()||"",address=$("#clientAddress")?.value.trim()||"";
    if(!name||!phone||!address){(!name?$("#clientName"):!phone?$("#clientPhone"):$("#clientAddress"))?.focus();return}
    const lines=cart.map(item=>{const status=item.availability&&item.availability!=="Disponible"?` | Statut : ${item.availability}`:"";return `- ${item.name} | Taille : ${item.size} | Qté : ${item.qty} | ${fmt(item.price*item.qty)}${status}`}).join("\n");
    const message=`NOUVELLE COMMANDE — DakarStyle x Sowhat Africa\n\nClient : ${name}\nTéléphone : ${phone}\nLocalité / adresse : ${address}\n\nProduits :\n${lines}\n\nTOTAL : ${fmt(cartTotal())}\n\nMerci.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`,"_blank","noopener");closeCheckout();closeCart();
  }
  function openProductZoom(id){
    const product=productMap.get(Number(id));if(!product)return;zoomProductId=Number(id);zoomPreviousFocus=document.activeElement;
    const modal=$("#zoomModal"),stage=$("#zoomStage"),image=$("#zoomImage"),availability=$("#zoomAvailability");if(!modal||!stage||!image||!availability)return;
    stage.classList.remove("zoomed");image.style.transformOrigin="50% 50%";image.src=product.img;image.alt=product.name;image.loading="eager";
    $("#zoomTag").textContent=product.tag||"Sowhat Africa";$("#zoomTitle").textContent=product.name;$("#zoomDescription").textContent=product.desc;$("#zoomPrice").textContent=fmt(product.price);$("#zoomSizes").textContent=`Tailles : ${product.sizes}`;
    availability.className=`availability ${product.status==="preorder"?"preorder":product.status==="order"?"order":""}`.trim();availability.textContent=product.availability||"Disponible";$("#zoomHint").textContent="Cliquer pour zoomer";
    modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.classList.add("modal-lock");$("#zoomClose")?.focus();
  }
  function closeProductZoom(){const modal=$("#zoomModal");if(!modal?.classList.contains("open"))return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");$("#zoomStage")?.classList.remove("zoomed");if(!$("#checkoutModal")?.classList.contains("open"))document.body.classList.remove("modal-lock");zoomPreviousFocus?.focus?.()}
  function toggleProductZoom(event){const stage=$("#zoomStage"),image=$("#zoomImage");if(!stage||!image)return;const rect=stage.getBoundingClientRect();const pointer=event.clientX>0||event.clientY>0;const x=pointer?((event.clientX-rect.left)/rect.width)*100:50;const y=pointer?((event.clientY-rect.top)/rect.height)*100:50;image.style.transformOrigin=`${x}% ${y}%`;stage.classList.toggle("zoomed");const zoomed=stage.classList.contains("zoomed");$("#zoomHint").textContent=zoomed?"Cliquer pour réduire":"Cliquer pour zoomer";stage.setAttribute("aria-label",zoomed?"Réduire l’image":"Agrandir davantage l’image")}
  function moveProductZoom(event){const stage=$("#zoomStage");if(!stage?.classList.contains("zoomed")||zoomMoveFrame)return;const clientX=event.clientX,clientY=event.clientY;zoomMoveFrame=requestAnimationFrame(()=>{zoomMoveFrame=0;const rect=stage.getBoundingClientRect();const x=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));const y=Math.max(0,Math.min(100,((clientY-rect.top)/rect.height)*100));const image=$("#zoomImage");if(image)image.style.transformOrigin=`${x}% ${y}%`})}
  function goToProductCard(){const id=zoomProductId;closeProductZoom();const card=document.getElementById(`product-${id}`);if(!card)return;card.scrollIntoView({behavior:"smooth",block:"center"});window.setTimeout(()=>document.getElementById(`size-${id}`)?.focus(),350)}
  function toggleMenu(force){const panel=$("#mobilePanel");if(!panel)return;if(typeof force==="boolean")panel.classList.toggle("open",force);else panel.classList.toggle("open")}
  function observeReveals(){const elements=$$("[data-reveal]");elements.forEach(el=>el.classList.add("reveal"));if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window)){elements.forEach(el=>el.classList.add("is-visible"));return}const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add("is-visible");observer.unobserve(entry.target)})},{threshold:.08,rootMargin:"0px 0px -24px"});elements.forEach(el=>observer.observe(el))}
  function handleDocumentClick(event){const node=event.target.closest("[data-action]");if(!node)return;const action=node.dataset.action;if(action==="open-cart")openCart();else if(action==="close-cart")closeCart();else if(action==="toggle-menu")toggleMenu();else if(action==="close-menu")toggleMenu(false);else if(action==="add")addToCart(node.dataset.productId);else if(action==="zoom")openProductZoom(node.dataset.productId);else if(action==="open-checkout")openCheckout();else if(action==="close-checkout")closeCheckout();else if(action==="send-order")sendOrder();else if(action==="close-zoom")closeProductZoom();else if(action==="toggle-zoom")toggleProductZoom(event);else if(action==="goto-product")goToProductCard();else if(action==="qty-minus"||action==="qty-plus"){const holder=node.closest("[data-cart-id]");if(holder)changeQty(holder.dataset.cartId,holder.dataset.cartSize,action==="qty-plus"?1:-1)}}
  function init(){
    reconcileCart();renderCart();observeReveals();
    $("#searchInput")?.addEventListener("input",event=>scheduleSearch(event.currentTarget.value));$$('.chip[data-filter]').forEach(button=>button.addEventListener("click",()=>setFilter(button.dataset.filter||"all")));
    document.addEventListener("click",handleDocumentClick);$("#overlay")?.addEventListener("click",closeCart);$("#zoomModal")?.addEventListener("click",event=>{if(event.target===event.currentTarget)closeProductZoom()});$("#zoomStage")?.addEventListener("pointermove",moveProductZoom,{passive:true});
    $$('a[href^="#"]').forEach(link=>link.addEventListener("click",()=>toggleMenu(false),{passive:true}));document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;closeCart();closeCheckout();closeProductZoom();toggleMenu(false)});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
