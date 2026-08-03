    const info = supplierInfo(product);
      if (!info.phone) continue;
      if (!groups.has(info.phone)) groups.set(info.phone, { name: info.name || 'Fournisseur', phone: info.phone, products: [] });
      groups.get(info.phone).products.push(product);
    }
    return [...groups.values()];
  }

  function reorderMessage(group) {
    const lines = group.products.map((product) => `- ${defaultReorderQuantity(product)} ${product.unit || 'pièce(s)'} de ${product.name} (stock actuel: ${Number(product.stock_quantity || 0)})`);
    return `Bonjour ${group.name},\n\n${merchant().name || 'Notre commerce'} souhaite commander :\n${lines.join('\n')}\n\nMerci de confirmer la disponibilité, le prix et le délai de livraison.`;
  }

  function openReorderGroup(group) {
    const url = `https://wa.me/${group.phone}?text=${encodeURIComponent(reorderMessage(group))}`;
    window.open(url, '_blank', 'noopener');
  }

  function ensureReorderModal() {
    if ($(`${PREFIX}-reorder-modal`)) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="${PREFIX}-reorder-modal" class="${PREFIX}-modal-backdrop" aria-hidden="true"><section class="${PREFIX}-modal"><div class="${PREFIX}-modal-head"><div><h2>Commandes fournisseurs</h2><p class="hint">Ouvrez chaque message WhatsApp préparé.</p></div><button type="button" class="${PREFIX}-mini" data-sbfu-modal-close>✕</button></div><div id="${PREFIX}-reorder-list"></div></section></div>`);
    const modal = $(`${PREFIX}-reorder-modal`);
    qsa('[data-sbfu-modal-close]', modal).forEach((button) => button.addEventListener('click', () => closeModal(modal)));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); });
  }

  function sendReorder(products) {
    const missing = products.find((product) => !supplierInfo(product).phone);
    if (missing) return configureSupplier(missing);
    const groups = reorderGroups(products);
    if (!groups.length) return notify('Fournisseur manquant', 'Ajoutez le WhatsApp du fournisseur.', 'warn');
    if (groups.length === 1) return openReorderGroup(groups[0]);
    ensureReorderModal();
    const list = $(`${PREFIX}-reorder-list`);
    list.innerHTML = groups.map((group, index) => `<div class="${PREFIX}-restock"><div class="copy"><b>${esc(group.name)}</b><span>${group.products.length} produit(s)</span></div><button type="button" class="${PREFIX}-mini fill" data-sbfu-open-group="${index}">Ouvrir WhatsApp</button></div>`).join('');
    qsa('[data-sbfu-open-group]', list).forEach((button) => button.addEventListener('click', () => openReorderGroup(groups[Number(button.dataset.sbfuOpenGroup)])));
    openModal($(`${PREFIX}-reorder-modal`));
    scheduleLanguage($(`${PREFIX}-reorder-modal`));
  }

  function lowStockProducts() {
    return (data().products || []).filter((product) => product.track_stock && Number(product.stock_quantity) <= Number(product.low_stock_threshold));
  }

  function decorateStock() {
    const view = $('view-stock');
    const list = $('productsList');
    if (!view || !list) return;
    const low = lowStockProducts();
    let panel = $(`${PREFIX}-restock`);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = `${PREFIX}-restock`;
      panel.className = `${PREFIX}-restock`;
      const toolbar = qs('.toolbar', view);
      toolbar?.insertAdjacentElement('afterend', panel);
    }
    if (low.length) {
      panel.style.display = 'flex';
      panel.innerHTML = `<div class="copy"><b>Stocks faibles : ${low.length}</b><span>Préparez les messages fournisseurs sans recopier les produits.</span></div><button type="button" class="${PREFIX}-mini fill" data-sbfu-reorder-all>📲 Tout commander</button>`;
      qs('[data-sbfu-reorder-all]', panel).addEventListener('click', () => sendReorder(low));
    } else {
      panel.style.display = 'none';
      panel.innerHTML = '';
    }
    qsa(':scope > .row-card[data-product-edit]', list).forEach((row) => {
      const product = (data().products || []).find((item) => String(item.id) === row.dataset.productEdit);
      if (!product || !product.track_stock || Number(product.stock_quantity) > Number(product.low_stock_threshold)) return;
      if (qs('[data-sbfu-reorder]', row)) return;
      const main = qs('.row-main', row) || row;
      const actions = document.createElement('div');
      actions.className = `${PREFIX}-stock-actions`;
      actions.innerHTML = `<button type="button" class="${PREFIX}-mini fill" data-sbfu-reorder="${esc(product.id)}">📲 Commander sur WhatsApp</button><button type="button" class="${PREFIX}-mini warn" data-sbfu-supplier="${esc(product.id)}">⚙️ Fournisseur</button>`;
      main.appendChild(actions);
    });
  }

  function installStockEvents() {
    document.addEventListener('click', (event) => {
      const reorder = event.target.closest('[data-sbfu-reorder]');
      const supplier = event.target.closest('[data-sbfu-supplier]');
      if (!reorder && !supplier) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const id = reorder?.dataset.sbfuReorder || supplier?.dataset.sbfuSupplier;
      const product = (data().products || []).find((item) => String(item.id) === String(id));
      if (!product) return;
      if (supplier) configureSupplier(product);
      else sendReorder([product]);
    }, true);
  }

  function preprocessVoice(text) {
    let value = String(text || '').trim();
    if (!value) return value;
    const phone = value.match(/(?:\+?221[\s.-]*)?7[05678](?:[\s.-]*\d){7}/)?.[0] || '';
    if (!/(?:f\s*cfa|fcfa|cfa|francs?|\bf\b)/i.test(value)) {
      const numbers = [...value.matchAll(/\b\d[\d\s.]{3,}\b/g)].map((match) => match[0]).filter((number) => number.replace(/\D/g, '') !== phone.replace(/\D/g, ''));
      if (numbers[0]) value = value.replace(numbers[0], `${numbers[0]} F`);
    }
    const lower = value.toLowerCase();
    if (/(^|\s)(achat|acheté|acheter|j[eë]nd|jënd|essence|carburant|loyer|transport|pi[eè]ce|outil)/i.test(lower) && !/d[ée]pense/i.test(lower)) value = `Dépense : ${value}`;
    const customer = value.match(/\b(?:de|pour)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]{1,30})(?=\s+(?:à|a|pour|de|\d)|$)/)?.[1];
    if (customer && !/(?:client|monsieur|madame|pour)\s+/i.test(value)) value += ` pour ${customer}`;
    if (/\b(defar|jàyy|jaay|r[ée]par[ée]|prestation|service)\b/i.test(lower) && !/vente/i.test(lower)) value = `Vente : ${value}`;
    return value;
  }

  function installVoicePreprocessor() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('#sbx-voice-analyse');
      if (!button) return;
      const area = $('sbx-voice-text');
      if (!area) return;
      const original = area.value;
      const enhanced = preprocessVoice(original);
      if (enhanced !== original) {
        area.value = enhanced;
        setTimeout(() => { if (area.value === enhanced) area.value = original; }, 0);
      }
    }, true);
  }

  function enhanceVoi