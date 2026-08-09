(() => {
  "use strict";

  function loadBase() {
    const script = document.createElement("script");
    script.src = "assets/js/dakarstyle-base-2026.js";
    script.async = false;
    script.onload = enhanceMarketUi;
    script.onerror = () => document.documentElement.classList.add("market-base-load-failed");
    document.head.append(script);
  }

  function enhanceMarketUi() {
    document.documentElement.classList.add("market-ui-v2");

    document.querySelectorAll(".size-picker select").forEach(select => {
      const label = select.closest(".size-picker");
      if (!label || label.classList.contains("is-upgraded")) return;

      const options = Array.from(select.options).filter(option => option.value.trim());
      if (!options.length) return;

      const group = document.createElement("div");
      group.className = "size-keys";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", select.getAttribute("aria-label") || "Choisir une taille");

      const sync = () => {
        group.querySelectorAll(".size-key").forEach(button => {
          button.setAttribute("aria-pressed", button.dataset.value === select.value ? "true" : "false");
        });
      };

      options.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "size-key";
        button.dataset.value = option.value;
        button.textContent = option.textContent.trim();
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          sync();
        });
        group.append(button);
      });

      if (options.length === 1 && !select.value) select.value = options[0].value;
      label.classList.add("is-upgraded");
      label.append(group);
      select.addEventListener("change", sync);
      sync();
    });

    const productSection = document.querySelector("#products .container");
    const toolbar = document.querySelector("#products .toolbar");
    if (productSection && toolbar && !document.querySelector(".market-trust")) {
      const trust = document.createElement("aside");
      trust.className = "market-trust";
      trust.setAttribute("aria-label", "Garanties avant commande");
      trust.innerHTML = `
        <div class="trust-pay"><b>Aucun paiement avant confirmation</b><small>Votre commande est d'abord vérifiée avec vous.</small></div>
        <div><b>Commande confirmée sur WhatsApp</b><small>Tailles, quantité, disponibilité et livraison sont validées avant règlement.</small></div>
        <div><b>Prix affichés en FCFA</b><small>Le montant du panier reste visible jusqu'à l'envoi.</small></div>
      `;
      toolbar.insertAdjacentElement("afterend", trust);
    }

    if (!document.querySelector(".market-order-bar")) {
      const bar = document.createElement("div");
      bar.className = "market-order-bar";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Commande rapide");
      bar.innerHTML = `
        <div class="market-order-summary" aria-live="polite">
          <b id="marketOrderTotal">0 FCFA</b>
          <small id="marketOrderCount">Panier vide · aucun paiement maintenant</small>
        </div>
        <button type="button" data-action="open-checkout">Commander</button>
      `;
      document.body.append(bar);
    }

    const cartCount = document.getElementById("cartCount");
    const cartTotal = document.getElementById("cartTotal");
    const totalMirror = document.getElementById("marketOrderTotal");
    const countMirror = document.getElementById("marketOrderCount");

    const syncOrderBar = () => {
      const count = Math.max(0, Number.parseInt(cartCount?.textContent || "0", 10) || 0);
      const total = (cartTotal?.textContent || "0 FCFA").trim();
      if (totalMirror) totalMirror.textContent = total;
      if (countMirror) {
        countMirror.textContent = count
          ? `${count} pièce${count > 1 ? "s" : ""} · confirmation WhatsApp avant paiement`
          : "Panier vide · aucun paiement maintenant";
      }
    };

    syncOrderBar();
    if ("MutationObserver" in window) {
      const observer = new MutationObserver(syncOrderBar);
      if (cartCount) observer.observe(cartCount, { childList: true, characterData: true, subtree: true });
      if (cartTotal) observer.observe(cartTotal, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadBase, { once: true });
  else loadBase();
})();
