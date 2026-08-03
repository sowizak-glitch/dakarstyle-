ing:18px">${esc(error.message)}</div>`;
    }
  }

  async function shareReceipt(sale) {
    if (!sale) return;
    try {
      const files = await receiptFiles(sale);
      const file = new File([files.png], files.pngName, { type: 'image/png' });
      const model = receiptModel(sale);
      const text = `${model.commerce} — reçu ${model.reference}\nTotal: ${xof(model.total)}\n${model.status}${model.remaining ? `: ${xof(model.remaining)}` : ''}`;
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Reçu ${model.commerce}`, text, files: [file] });
        return;
      }
      downloadBlob(files.png, files.pngName);
      const phone = normalizePhone(model.customerPhone);
      const url = `https://wa.me/${phone || ''}?text=${encodeURIComponent(`${text}\n\nLe reçu image vient d’être téléchargé. Joignez-le à ce message.`)}`;
      window.open(url, '_blank', 'noopener');
      notify('WhatsApp ouvert', 'Joignez l’image du reçu téléchargée au message.', 'warn');
    } catch (error) {
      if (error?.name !== 'AbortError') notify('Partage impossible', error.message || 'Réessayez.', 'error');
    }
  }

  function installReceiptEvents() {
    document.addEventListener('click', (event) => {
      const receipt = event.target.closest('[data-sbfu-receipt]');
      if (receipt) {
        event.preventDefault();
        event.stopPropagation();
        openReceipt(saleById(receipt.dataset.sbfuReceipt));
        return;
      }
      const share = event.target.closest('[data-sbfu-receipt-share]');
      if (share) {
        event.preventDefault();
        event.stopPropagation();
        shareReceipt(saleById(share.dataset.sbfuReceiptShare));
      }
    }, true);
  }

  function wrapSaleButtons() {
    const button = $('saveSaleBtn');
    if (button && !button.dataset.sbfuReceiptWrap && typeof button.onclick === 'function') {
      button.dataset.sbfuReceiptWrap = '1';
      const original = button.onclick;
      button.onclick = async function(event) {
        const before = new Set((data().sales || []).map((sale) => sale.id));
        await original.call(this, event);
        const created = (data().sales || []).find((sale) => !before.has(sale.id));
        if (created) setTimeout(() => openReceipt(created), 120);
      };
    }
    const orderButton = $('orderCreateSaleBtn');
    if (orderButton && !orderButton.dataset.sbfuReceiptWrap && typeof orderButton.onclick === 'function') {
      orderButton.dataset.sbfuReceiptWrap = '1';
      const original = orderButton.onclick;
      orderButton.onclick = async function(event) {
        const before = new Set((data().sales || []).map((sale) => sale.id));
        await original.call(this, event);
        const created = (data().sales || []).find((sale) => !before.has(sale.id));
        if (created) setTimeout(() => openReceipt(created), 120);
      };
    }
  }

  function supplierInfo(product) {
    const value = product?.metadata?.supplier || {};
    return {
      name: String(value.name || ''),
      phone: normalizePhone(value.phone || ''),
      reorderQuantity: Math.max(Number(value.reorder_quantity || 0), 0)
    };
  }

  function defaultReorderQuantity(product) {
    const supplier = supplierInfo(product);
    if (supplier.reorderQuantity > 0) return supplier.reorderQuantity;
    const threshold = Math.max(Number(product.low_stock_threshold || 0), 1);
    const stock = Number(product.stock_quantity || 0);
    return Math.max(Math.ceil(threshold * 2 - stock), 1);
  }

  async function supplierApi(action, payload = {}) {
    const response = await fetch(SUPPLIER_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sama-session': token(), 'x-client-info': `samabusiness-field-ux/${VERSION}` },
      body: JSON.stringify({ action, ...payload })
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok || result.ok === false) throw new Error(result.error || `Action impossible (${response.status})`);
    return result;
  }

  function ensureSupplierModal() {
    if ($(`${PREFIX}-supplier-modal`)) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="${PREFIX}-supplier-modal" class="${PREFIX}-modal-backdrop" aria-hidden="true"><section class="${PREFIX}-modal" role="dialog" aria-modal="true"><div class="${PREFIX}-modal-head"><div><h2>Fournisseur</h2><p class="hint">Enregistrez son WhatsApp une seule fois.</p></div><button type="button" class="${PREFIX}-mini" data-sbfu-modal-close>✕</button></div><form id="${PREFIX}-supplier-form" class="${PREFIX}-form"><input type="hidden" name="productId"><div class="${PREFIX}-field"><label>Nom du fournisseur</label><input name="name" placeholder="Ex. Dépôt Ndiaye"></div><div class="${PREFIX}-field"><label>WhatsApp du fournisseur</label><input name="phone" inputmode="tel" required placeholder="77 000 00 00"></div><div class="${PREFIX}-field full"><label>Quantité à commander par défaut</label><input name="reorderQuantity" inputmode="numeric" min="1" value="1"></div><div class="${PREFIX}-field full"><button class="${PREFIX}-mini fill" type="submit">Enregistrer et commander</button></div></form></section></div>`);
    const modal = $(`${PREFIX}-supplier-modal`);
    qsa('[data-sbfu-modal-close]', modal).forEach((button) => button.addEventListener('click', () => closeModal(modal)));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); });
    $(`${PREFIX}-supplier-form`).addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const product = (data().products || []).find((item) => item.id === form.get('productId'));
      if (!product) return;
      try {
        await supplierApi('save_supplier', {
          productId: product.id,
          name: form.get('name'),
          phone: form.get('phone'),
          reorderQuantity: form.get('reorderQuantity')
        });
        closeModal(modal);
        await refreshData(false);
        notify('Fournisseur enregistré', 'Le message WhatsApp est prêt.');
        const fresh = (data().products || []).find((item) => item.id === product.id) || product;
        sendReorder([fresh]);
      } catch (error) { notify('Fournisseur non enregistré', error.message, 'error'); }
    });
  }

  function configureSupplier(product) {
    ensureSupplierModal();
    const info = supplierInfo(product);
    const form = $(`${PREFIX}-supplier-form`);
    form.elements.productId.value = product.id;
    form.elements.name.value = info.name;
    form.elements.phone.value = info.phone.replace(/^221/, '');
    form.elements.reorderQuantity.value = defaultReorderQuantity(product);
    openModal($(`${PREFIX}-supplier-modal`));
    scheduleLanguage($(`${PREFIX}-supplier-modal`));
  }

  function reorderGroups(products) {
    const groups = new Map();
    for (const product of products) {
   