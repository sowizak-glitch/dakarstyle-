(() => {
  'use strict';

  const VERSION = '19.0.0-beta.1';
  const MARKER = '__SAMABUSINESS_SALES_RECEIPT_BRIDGE_V19__';
  if (window[MARKER]) return;
  window[MARKER] = true;
  document.documentElement.dataset.samaSalesReceiptBridgeVersion = VERSION;

  let scheduled = false;

  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };

  function decorateCard(card) {
    if (!card || card.querySelector('[data-sbfu-receipt]')) return;
    const source = card.querySelector('[data-sbso-wa-sale]');
    const saleId = String(source?.dataset?.sbsoWaSale || '').trim();
    if (!saleId) return;

    const actions = card.querySelector('.sbso-actions');
    if (!actions) return;

    const receipt = document.createElement('button');
    receipt.type = 'button';
    receipt.className = 'sbso-act primary';
    receipt.dataset.sbfuReceipt = saleId;
    receipt.setAttribute('aria-label', 'Ouvrir le reçu de cette vente');
    receipt.textContent = '🧾 Reçu';
    actions.appendChild(receipt);
  }

  function decorate() {
    scheduled = false;
    document.querySelectorAll('.sbso-card').forEach(decorateCard);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.('[data-action="sale"],[data-nav="sales"],#sbso-refresh');
    if (trigger) setTimeout(schedule, 80);
  }, true);

  window.addEventListener('sama-session-change', schedule);
  window.addEventListener('storage', schedule);
  schedule();

  window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, {
    salesReceiptBridge: {
      version: VERSION,
      refresh: schedule,
      visible,
    },
  });
})();
