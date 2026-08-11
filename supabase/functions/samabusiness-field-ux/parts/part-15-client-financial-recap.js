(() => {
  'use strict';
  if (window.__SAMABUSINESS_CLIENT_FINANCIAL_RECAP_V2026__) return;
  window.__SAMABUSINESS_CLIENT_FINANCIAL_RECAP_V2026__ = true;

  const VERSION = '1.0.1';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  function parseMoney(text = '') {
    const normalized = String(text).replace(/[^0-9-]/g, '');
    const value = Number(normalized || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function fmt(value) {
    return `${money.format(Math.max(Number(value || 0), 0))} F`;
  }

  function installStyles() {
    if (qs('#sbfr-2026-styles')) return;
    const style = document.createElement('style');
    style.id = 'sbfr-2026-styles';
    style.textContent = `
      .sbfr-client-card .sbso-moneyrow{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important}
      .sbfr-client-card .sbso-moneyrow>div{min-width:0}
      .sbfr-client-card .sbso-moneyrow small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sbfr-client-card .sbfr-paid b{color:#0b6b4a}
      .sbfr-client-card .sbfr-average{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 8px;border-radius:999px;background:#f3f7f5;color:#50645b;font-size:10px;font-weight:800;border:1px solid #e1e9e5}
      .sbfr-client-card .sbfr-average strong{color:#1c3b30;font-weight:950}
      .sbfr-client-card .sbfr-balance-ok b{color:#0b6b4a}
      .sbfr-client-card .sbfr-balance-due b{color:#a33b3b}
      @media(max-width:480px){.sbfr-client-card .sbso-moneyrow{grid-template-columns:repeat(2,minmax(0,1fr))!important}.sbfr-client-card .sbso-moneyrow>div{padding:3px 0}}
    `;
    document.head.appendChild(style);
  }

  function decorateCard(card) {
    if (!qs('[data-sbso-client]', card)) return;
    card.classList.add('sbfr-client-card');

    const row = qs('.sbso-moneyrow', card);
    if (!row) return;
    const cells = [...row.children].filter((node) => !node.classList.contains('sbfr-paid'));
    if (cells.length < 3) return;

    const purchaseCount = Math.max(parseMoney(qs('b', cells[0])?.textContent || '0'), 0);
    const total = Math.max(parseMoney(qs('b', cells[1])?.textContent || '0'), 0);
    const rest = Math.max(parseMoney(qs('b', cells[2])?.textContent || '0'), 0);
    const paid = Math.max(total - rest, 0);
    const average = purchaseCount > 0 ? Math.round(total / purchaseCount) : 0;
    const signature = `${purchaseCount}|${total}|${rest}`;

    if (card.dataset.sbfrSignature === signature && qs(':scope .sbfr-paid', card) && qs(':scope .sbfr-average', card)) return;

    let paidCell = qs(':scope > .sbfr-paid', row);
    if (!paidCell) {
      paidCell = document.createElement('div');
      paidCell.className = 'sbfr-paid';
      paidCell.innerHTML = '<small>ENCAISSÉ</small><b>0 F</b>';
      row.insertBefore(paidCell, cells[2]);
    }
    const paidValue = qs('b', paidCell);
    if (paidValue && paidValue.textContent !== fmt(paid)) paidValue.textContent = fmt(paid);

    cells[2].classList.toggle('sbfr-balance-ok', rest === 0 && total > 0);
    cells[2].classList.toggle('sbfr-balance-due', rest > 0);

    let averageChip = qs('.sbfr-average', card);
    const meta = qsa('.sbso-meta', card).find((node) => !node.closest('.sbso-cardtitle'));
    if (!averageChip) {
      averageChip = document.createElement('span');
      averageChip.className = 'sbfr-average';
      (meta || row).insertAdjacentElement('afterend', averageChip);
    }
    const averageHtml = purchaseCount > 0
      ? `Panier moyen <strong>${fmt(average)}</strong>`
      : `Résumé financier <strong>aucun achat</strong>`;
    if (averageChip.innerHTML !== averageHtml) averageChip.innerHTML = averageHtml;

    card.dataset.sbfrSignature = signature;
    card.dataset.sbfrVersion = VERSION;
  }

  function decorate() {
    qsa('.sbso-card').forEach(decorateCard);
    document.documentElement.dataset.sbfrVersion = VERSION;
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate();
    });
  }

  installStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
