(() => {
  'use strict';
  if (window.__SAMABUSINESS_ICON_POLISH_V2026__) return;
  window.__SAMABUSINESS_ICON_POLISH_V2026__ = true;

  const VERSION = '1.0.0';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const ICONS = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  };

  function icon(name, cls = 'sbix-icon') {
    const body = ICONS[name] || ICONS.receipt;
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  function setIcon(host, name) {
    if (!host) return;
    if (host.dataset.sbixPolishIcon === name && qs(':scope > svg.sbix-icon', host)) return;
    host.innerHTML = icon(name);
    host.dataset.sbixPolishIcon = name;
  }

  function installStyles() {
    if (qs('#sbix-2026-polish-styles')) return;
    const style = document.createElement('style');
    style.id = 'sbix-2026-polish-styles';
    style.textContent = `
      .sbix-suppressed-duplicate{display:none!important}
      .quick .emoji{width:34px!important;height:34px!important;border-radius:11px!important;margin:0!important}
      .quick .emoji .sbix-icon{width:18px!important;height:18px!important}
      .more-card .emoji{width:40px!important;height:40px!important;border-radius:13px!important}
      .more-card .emoji .sbix-icon{width:20px!important;height:20px!important}
      .sbso-iconbtn[data-sbso-overlay-close]{font-size:0!important;color:#42584f!important}
      .sbso-iconbtn[data-sbso-overlay-close]>.sbix-icon{width:18px!important;height:18px!important}
      .sbso-empty::before{display:none!important;content:none!important}
      .sbix-empty-glyph{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#edf5f1;color:#0b6549;margin:0 auto 9px;box-shadow:inset 0 0 0 1px rgba(11,101,73,.06)}
      .sbix-empty-glyph>.sbix-icon{width:18px;height:18px}
      @media(max-width:620px){.quick .emoji{width:32px!important;height:32px!important}.quick .emoji .sbix-icon{width:17px!important;height:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function suppressDuplicateIcons(button) {
    const slots = qsa('.emoji', button);
    if (!slots.length) return;

    const outsideSvg = qsa('svg', button).find((svg) => !slots.some((slot) => slot.contains(svg)));
    if (outsideSvg) {
      // A newer shell already provides its own leading icon: keep that one and
      // suppress the legacy emoji slot to avoid the double-icon effect seen on Samsung.
      slots.forEach((slot) => slot.classList.add('sbix-suppressed-duplicate'));
      return;
    }

    slots.forEach((slot, index) => {
      slot.classList.toggle('sbix-suppressed-duplicate', index > 0);
    });
  }

  function decorateOverlayClosers() {
    qsa('[data-sbso-overlay-close]').forEach((button) => setIcon(button, 'close'));
  }

  function decorateEmptyStates() {
    qsa('.sbso-empty').forEach((empty) => {
      if (qs(':scope > .sbix-empty-glyph', empty)) return;
      const glyph = document.createElement('span');
      glyph.className = 'sbix-empty-glyph';
      glyph.innerHTML = icon('receipt');
      empty.prepend(glyph);
    });
  }

  function polish() {
    qsa('.quick,.more-card').forEach(suppressDuplicateIcons);
    decorateOverlayClosers();
    decorateEmptyStates();
    document.documentElement.dataset.sbixPolishVersion = VERSION;
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      polish();
    });
  }

  installStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });
})();
