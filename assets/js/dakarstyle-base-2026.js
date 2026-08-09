(() => {
  "use strict";

  const WHATSAPP = "221773374762";
  const CART_KEY = "ds_cart_sized_v2";
  const LEGACY_CART_KEY = "ds_cart_sized_v1";
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
  let cartPreviousFocus = null;
  let zoomMoveFrame = 0;
  let scrollFrame = 0;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const fmt = value => `${moneyFormatter.format(Number(value || 0))} FCFA`;

  function loadSavedCart() {
    try {
      const current = localStorage.getItem(CART_KEY);
      const legacy = localStorage.getItem(LEGACY_CART_KEY);
      const saved = JSON.parse(current || legacy || "[]");
      if (Array.isArray(saved)) cart = saved;
      if (!current && legacy) localStorage.setItem(CART_KEY, JSON.stringify(saved));
    } catch {
      localStorage.removeItem(CART_KEY);
    }
  }

  function ensureUiEnhancements() {
    if (!$(".site-progress")) {
      const progress = document.createElement("div");
      progress.className = "site-progress";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = "<span></span>";
      document.body.prepend(progress);
    }

    if (!$(".toast-stack")) {
      const stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "true");
      document.body.append(stack);
    }

    const toolbar = $(".toolbar");
    if (toolbar && !$(".results-status")) {
      const status = document.createElement("p");
      status.className = "results-status";
      status.setAttribute("aria-live", "polite");
      toolbar.insertAdjacentElement("afterend", status);
    }

    if (!$(".mobile-dock")) {
      const dock = document.createElement("nav");
      dock.className = "mobile-dock";
      dock.setAttribute("aria-label", "Navigation rapide");
      dock.innerHTML = `
        <a class="dock-shop" href="#products">Boutique</a>
        <a class="dock-look" href="#lookbook">Campagne</a>
        <button class="dock-cart" type="button" data-action="open-cart">Panier</button>
        <a class="dock-wa" href="https://wa.me/${WHATSAPP}?text=Bonjour%20DakarStyle%2C%20je%20veux%20commander%20Sowhat%20Africa" target="_blank" rel="noopener">WhatsApp</a>
      `;
      document.body.append(dock);
    }

    if (!$(".back-top")) {
      const button = document.createElement("button");
      button.className = "back-top";
      button.type = "button";
      button.setAttribute("aria-label", "Retour en haut");
      button.textContent = "↑";
      button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      document.body.append(button);
    }

    const drawer = $("#cartDrawer");
    if (drawer) {
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-modal", "true");
      drawer.setAttribute("aria-hidden", "true");
    }
    $("#cartCount")?.setAttribute("aria-live", "polite");
  }

  function toast(message, accent = "") {
    const stack = $(".toast-stack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = accent ? `<strong>${accent}</strong> ${message}` : message;
    stack.append(node);
    requestAnimationFrame(() => node.classList.add("show"));
    window.setTimeout(() => {
      node.classList.remove("show");
      window.setTimeout(() => node.remove(), 220);
    }, 2600);
  }

  function syncBodyLock() {
    const locked = $("#cartDrawer")?.classList.contains("open") || $("#checkoutModal")?.classList.contains("open") || $("#zoomModal")?.classList.contains("open");
    document.body.classList.toggle("modal-lock", Boolean(locked));
  }

  function reconcileCart() {
    cart = cart.map(item => {
      const product = productMap.get(Number(item.id));
      if (!product) return null;
      return {
        id: Number(product.id),
        name: product.name,
        price: Number(product.price || 0),
        img: product.img,
        availability: product.availability || "Disponible",
        size: item.size,
        qty: Math.max(1, Number(item.qty || 1))
      };
    }).filter(Boolean);
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const node = $("#cartCount");
    if (node) {
      node.textContent = String(count);
      node.classList.remove("bump");
      requestAnimationFrame(() => node.classList.add("bump"));
      window.setTimeout(() => node.classList.remove("bump"), 240);
    }
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function renderCart() {
    saveCart();
    const body = $("#cartBody");
    const total = $("#cartTotal");
    if (!body || !total) return;
    total.textContent = fmt(cartTotal());
    if (!cart.length) {
      body.innerHTML = "<p>Votre panier est vide. Explorez le drop et choisissez votre taille.</p>";
      return;
    }
    body.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.img}" alt="" loading="lazy" decoding="async">
        <div>
          <h4>${item.name}</h4>
          <p>Taille : ${item.size} · ${fmt(item.price)} chacun</p>
          ${item.availability && item.availability !== "Disponible" ? `<p>${item.availability}</p>` : ""}
          <div class="qty" data-cart-id="${item.id}" data-cart-size="${encodeURIComponent(item.size)}">
            <button type="button" data-action="qty-minus" aria-label="Retirer une unité">−</button>
            <span>${item.qty}</span>
            <button type="button" data-action="qty-plus" aria-label="Ajouter une unité">+</button>
          </div>
        </div>
        <strong>${fmt(item.price * item.qty)}</strong>
      </div>
    `).join("");
  }

  function openCart() {
    cartPreviousFocus = document.activeElement;
    $("#cartDrawer")?.classList.add("open");
    $("#cartDrawer")?.setAttribute("aria-hidden", "false");
    $("#overlay")?.classList.add("open");
    syncBodyLock();
    window.setTimeout(() => $("#cartDrawer .icon-btn")?.focus(), 40);
  }

  function closeCart({ restoreFocus = true } = {}) {
    $("#cartDrawer")?.classList.remove("open");
    $("#cartDrawer")?.setAttribute("aria-hidden", "true");
    $("#overlay")?.classList.remove("open");
    syncBodyLock();
    if (restoreFocus) cartPreviousFocus?.focus?.();
  }

  function addToCart(id) {
    const product = productMap.get(Number(id));
    if (!product) return;
    const select = document.getElementById(`size-${id}`);
    const size = select?.value.trim() || "";
    if (!size) {
      select?.focus();
      toast("Choisissez d’abord une taille.", "Taille requise ·");
      return;
    }
    const current = cart.find(item => Number(item.id) === Number(id) && item.size === size);
    if (current) current.qty += 1;
    else cart.push({
      id: Number(product.id),
      name: product.name,
      price: Number(product.price || 0),
      img: product.img,
      availability: product.availability || "Disponible",
      size,
      qty: 1
    });
    renderCart();
    toast(`${product.name} · taille ${size}`, "Ajouté au panier ·");
    openCart();
  }

  function changeQty(id, encodedSize, delta) {
    const size = decodeURIComponent(encodedSize || "");
    const item = cart.find(entry => Number(entry.id) === Number(id) && entry.size === size);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(entry => !(Number(entry.id) === Number(id) && entry.size === size));
    renderCart();
  }

  function updateResultsStatus() {
    const cards = $$(".product[data-product-id]");
    const visible = cards.filter(card => !card.hidden).length;
    const status = $(".results-status");
    if (!status) return;
    const qualifier = searchText ? ` pour « ${searchText} »` : activeFilter !== "all" ? ` dans cette catégorie` : "";
    status.textContent = `${visible} pièce${visible > 1 ? "s" : ""}${qualifier}`;
  }

  function applyProductFilter() {
    $$(".product[data-product-id]").forEach(card => {
      const matchesType = activeFilter === "all" || card.dataset.type === activeFilter;
      const matchesSearch = !searchText || (card.dataset.search || "").includes(searchText);
      card.hidden = !(matchesType && matchesSearch);
    });
    updateResultsStatus();
  }

  function setFilter(key) {
    activeFilter = key;
    $$(".chip[data-filter]").forEach(button => {
      const active = button.dataset.filter === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    applyProductFilter();
  }

  function scheduleSearch(value) {
    window.clearTimeout(searchTimer);
    const next = value.trim().toLowerCase();
    searchTimer = window.setTimeout(() => {
      searchText = next;
      applyProductFilter();
    }, 90);
  }

  function openCheckout() {
    if (!cart.length) {
      openCart();
      toast("Ajoutez au moins une pièce avant de commander.", "Panier vide ·");
      return;
    }
    closeCart({ restoreFocus: false });
    $("#checkoutModal")?.classList.add("open");
    syncBodyLock();
    window.setTimeout(() => $("#clientName")?.focus(), 40);
  }

  function closeCheckout() {
    $("#checkoutModal")?.classList.remove("open");
    syncBodyLock();
  }

  function sendOrder() {
    const name = $("#clientName")?.value.trim() || "";
    const phone = $("#clientPhone")?.value.trim() || "";
    const address = $("#clientAddress")?.value.trim() || "";
    if (!name || !phone || !address) {
      const target = !name ? $("#clientName") : !phone ? $("#clientPhone") : $("#clientAddress");
      target?.focus();
      toast("Complétez les informations de livraison.", "Commande ·");
      return;
    }
    const lines = cart.map(item => {
      const status = item.availability && item.availability !== "Disponible" ? ` | Statut : ${item.availability}` : "";
      return `- ${item.name} | Taille : ${item.size} | Qté : ${item.qty} | ${fmt(item.price * item.qty)}${status}`;
    }).join("\n");
    const message = `NOUVELLE COMMANDE — DakarStyle x Sowhat Africa\n\nClient : ${name}\nTéléphone : ${phone}\nLocalité / adresse : ${address}\n\nProduits :\n${lines}\n\nTOTAL : ${fmt(cartTotal())}\n\nMerci.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    closeCheckout();
  }

  function openProductZoom(id) {
    const product = productMap.get(Number(id));
    if (!product) return;
    zoomProductId = Number(id);
    zoomPreviousFocus = document.activeElement;
    const modal = $("#zoomModal");
    const stage = $("#zoomStage");
    const image = $("#zoomImage");
    const availability = $("#zoomAvailability");
    if (!modal || !stage || !image || !availability) return;
    stage.classList.remove("zoomed");
    image.style.transformOrigin = "50% 50%";
    image.src = product.img;
    image.alt = product.name;
    image.loading = "eager";
    $("#zoomTag").textContent = product.tag || "Sowhat Africa";
    $("#zoomTitle").textContent = product.name;
    $("#zoomDescription").textContent = product.desc;
    $("#zoomPrice").textContent = fmt(product.price);
    $("#zoomSizes").textContent = `Tailles : ${product.sizes}`;
    availability.className = `availability ${product.status === "preorder" ? "preorder" : product.status === "order" ? "order" : ""}`.trim();
    availability.textContent = product.availability || "Disponible";
    $("#zoomHint").textContent = "Cliquer pour zoomer";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();
    $("#zoomClose")?.focus();
  }

  function closeProductZoom() {
    const modal = $("#zoomModal");
    if (!modal?.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    $("#zoomStage")?.classList.remove("zoomed");
    syncBodyLock();
    zoomPreviousFocus?.focus?.();
  }

  function toggleProductZoom(event) {
    const stage = $("#zoomStage");
    const image = $("#zoomImage");
    if (!stage || !image) return;
    const rect = stage.getBoundingClientRect();
    const pointer = event.clientX > 0 || event.clientY > 0;
    const x = pointer ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
    const y = pointer ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
    image.style.transformOrigin = `${x}% ${y}%`;
    stage.classList.toggle("zoomed");
    const zoomed = stage.classList.contains("zoomed");
    $("#zoomHint").textContent = zoomed ? "Cliquer pour réduire" : "Cliquer pour zoomer";
    stage.setAttribute("aria-label", zoomed ? "Réduire l’image" : "Agrandir davantage l’image");
  }

  function moveProductZoom(event) {
    const stage = $("#zoomStage");
    if (!stage?.classList.contains("zoomed") || zoomMoveFrame) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    zoomMoveFrame = requestAnimationFrame(() => {
      zoomMoveFrame = 0;
      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      const image = $("#zoomImage");
      if (image) image.style.transformOrigin = `${x}% ${y}%`;
    });
  }

  function goToProductCard() {
    const id = zoomProductId;
    closeProductZoom();
    const card = document.getElementById(`product-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => document.getElementById(`size-${id}`)?.focus(), 350);
  }

  function toggleMenu(force) {
    const panel = $("#mobilePanel");
    const button = $("[data-action='toggle-menu']");
    if (!panel) return;
    if (typeof force === "boolean") panel.classList.toggle("open", force);
    else panel.classList.toggle("open");
    const open = panel.classList.contains("open");
    button?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function observeReveals() {
    const elements = $$("[data-reveal]");
    elements.forEach(el => el.classList.add("reveal"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach(el => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: "0px 0px -24px" });
    elements.forEach(el => observer.observe(el));
  }

  function observeSections() {
    if (!("IntersectionObserver" in window)) return;
    const sections = ["products", "lookbook", "commande", "contact"].map(id => document.getElementById(id)).filter(Boolean);
    const links = $$('a[href^="#"]');
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      links.forEach(link => link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`));
    }, { rootMargin: "-22% 0px -62% 0px", threshold: [0, .05, .2] });
    sections.forEach(section => observer.observe(section));
  }

  function updateScrollUi() {
    scrollFrame = 0;
    const root = document.documentElement;
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    const progress = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
    const bar = $(".site-progress>span");
    if (bar) bar.style.setProperty("--progress", `${progress}%`);
    $(".header")?.classList.toggle("scrolled", window.scrollY > 12);
    $(".back-top")?.classList.toggle("show", window.scrollY > Math.max(700, window.innerHeight));
  }

  function scheduleScrollUi() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateScrollUi);
  }

  function handleDocumentClick(event) {
    const node = event.target.closest("[data-action]");
    if (!node) return;
    const action = node.dataset.action;
    if (action === "open-cart") openCart();
    else if (action === "close-cart") closeCart();
    else if (action === "toggle-menu") toggleMenu();
    else if (action === "close-menu") toggleMenu(false);
    else if (action === "add") addToCart(node.dataset.productId);
    else if (action === "zoom") openProductZoom(node.dataset.productId);
    else if (action === "open-checkout") openCheckout();
    else if (action === "close-checkout") closeCheckout();
    else if (action === "send-order") sendOrder();
    else if (action === "close-zoom") closeProductZoom();
    else if (action === "toggle-zoom") toggleProductZoom(event);
    else if (action === "goto-product") goToProductCard();
    else if (action === "qty-minus" || action === "qty-plus") {
      const holder = node.closest("[data-cart-id]");
      if (holder) changeQty(holder.dataset.cartId, holder.dataset.cartSize, action === "qty-plus" ? 1 : -1);
    }
  }

  function init() {
    document.documentElement.classList.add("js");
    loadSavedCart();
    ensureUiEnhancements();
    reconcileCart();
    renderCart();
    observeReveals();
    observeSections();
    applyProductFilter();

    $("#searchInput")?.addEventListener("input", event => scheduleSearch(event.currentTarget.value));
    $$(".chip[data-filter]").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter || "all")));
    document.addEventListener("click", handleDocumentClick);
    $("#overlay")?.addEventListener("click", () => closeCart());
    $("#zoomModal")?.addEventListener("click", event => { if (event.target === event.currentTarget) closeProductZoom(); });
    $("#checkoutModal")?.addEventListener("click", event => { if (event.target === event.currentTarget) closeCheckout(); });
    $("#zoomStage")?.addEventListener("pointermove", moveProductZoom, { passive: true });
    $$("a[href^='#']").forEach(link => link.addEventListener("click", () => toggleMenu(false), { passive: true }));

    const menuButton = $("[data-action='toggle-menu']");
    menuButton?.setAttribute("aria-expanded", "false");

    document.addEventListener("keydown", event => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        $("#searchInput")?.focus();
      }
      if (event.key !== "Escape") return;
      closeCart();
      closeCheckout();
      closeProductZoom();
      toggleMenu(false);
    });

    window.addEventListener("scroll", scheduleScrollUi, { passive: true });
    window.addEventListener("resize", scheduleScrollUi, { passive: true });
    updateScrollUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();