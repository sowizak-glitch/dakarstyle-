(() => {
  'use strict';
  if (window.__SAMABUSINESS_ICON_SYSTEM_V2026__) return;
  window.__SAMABUSINESS_ICON_SYSTEM_V2026__ = true;

  const VERSION = '1.0.0';
  const NS = 'http://www.w3.org/2000/svg';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const ICONS = {
    back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8h15"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/><circle cx="17" cy="13.5" r=".7" fill="currentColor" stroke="none"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15Z"/><path d="M8 11h8M8 15h5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    route: '<path d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M8.5 15.5c3.5-1 2.5-6 6.5-7"/><path d="m13 8 2-1 1 2"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    box: '<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v9l-9 5-9-5Z"/><path d="M12 13v9"/>',
    more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M9 22h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  };

  function icon(name, cls = 'sbix-icon') {
    const body = ICONS[name] || ICONS.more;
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  function iconNode(name, cls = 'sbix-icon') {
    const holder = document.createElement('span');
    holder.innerHTML = icon(name, cls);
    return holder.firstElementChild;
  }

  function installStyles() {
    if (qs('#sbix-2026-styles')) return;
    const style = document.createElement('style');
    style.id = 'sbix-2026-styles';
    style.textContent = `
      :root{--sbix-green:#0b6549;--sbix-green-strong:#07563e;--sbix-green-soft:#e8f4ee;--sbix-ink:#13261f;--sbix-muted:#6b7d75;--sbix-line:#dce6e0;--sbix-shadow:0 12px 32px rgba(18,55,42,.08)}
      .sbix-icon{width:18px;height:18px;display:block;flex:none;pointer-events:none}.sbix-icon.sm{width:15px;height:15px}.sbix-icon.lg{width:21px;height:21px}
      button,.nav-btn,.quick,.more-card{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .nav-btn,.quick,.more-card,.sbso-act,.sbso-tab,.sbso-iconbtn,.sbso-new,.sbso-refresh{transition:transform .16s ease,box-shadow .18s ease,background-color .18s ease,border-color .18s ease,color .18s ease}
      .sbix-pressing{transform:scale(.965)!important}
      .nav-btn:focus-visible,.quick:focus-visible,.more-card:focus-visible,.sbso-act:focus-visible,.sbso-tab:focus-visible,.sbso-iconbtn:focus-visible,.sbso-new:focus-visible,.sbso-refresh:focus-visible{outline:3px solid rgba(11,101,73,.22)!important;outline-offset:2px}

      .bottom-nav{background:rgba(255,255,255,.965)!important;border:1px solid rgba(217,229,223,.96)!important;box-shadow:0 16px 42px rgba(17,48,37,.14)!important;padding:6px!important;backdrop-filter:blur(20px) saturate(1.08)!important}
      .nav-btn{color:#6a7973!important;min-height:54px!important;gap:3px!important;background:transparent!important;font-size:9px!important}
      .nav-btn .ico{width:36px;height:30px;display:grid!important;place-items:center;border-radius:11px;color:#64766f;font-size:0!important;transition:inherit}
      .nav-btn .ico .sbix-icon{width:20px;height:20px}
      .nav-btn.active{color:var(--sbix-green)!important;background:transparent!important}
      .nav-btn.active .ico{color:var(--sbix-green)!important;background:var(--sbix-green-soft)!important;box-shadow:inset 0 0 0 1px rgba(11,101,73,.08),0 5px 14px rgba(11,101,73,.09)}
      .nav-btn.active>span:last-child{font-weight:950!important}
      .nav-btn:active .ico{transform:translateY(1px) scale(.96)}

      .quick .emoji,.more-card .emoji{font-size:0!important;display:grid!important;place-items:center!important;color:var(--sbix-green)!important;background:linear-gradient(145deg,#edf7f2,#e3f0e9)!important;border:1px solid rgba(11,101,73,.08)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)}
      .quick .emoji{width:42px!important;height:42px!important;border-radius:14px!important;margin-inline:auto!important}
      .more-card .emoji{width:46px!important;height:46px!important;border-radius:15px!important}
      .quick .emoji .sbix-icon,.more-card .emoji .sbix-icon{width:22px;height:22px}
      .quick:hover,.more-card:hover{border-color:#cbded5!important;box-shadow:var(--sbix-shadow)!important;transform:translateY(-1px)}
      .quick:active,.more-card:active{transform:scale(.975)!important}
      .more-card{overflow:hidden;position:relative}.more-card::after{content:'';position:absolute;inset:auto -20% -55% auto;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(11,101,73,.055),transparent 70%);pointer-events:none}
      .mic{font-size:0!important;display:grid!important;place-items:center!important;color:var(--sbix-green)!important}.mic .sbix-icon{width:18px;height:18px}.mic.listening{color:#a42f2f!important}
      .close{font-size:0!important;display:grid!important;place-items:center!important;color:#42584f!important}.close .sbix-icon{width:18px;height:18px}
      #refreshBtn{font-size:0!important;display:grid!important;place-items:center!important}#refreshBtn .sbix-icon{width:19px;height:19px}
      .sbix-inline-plus{display:inline-flex;align-items:center;gap:7px}.sbix-inline-plus .sbix-icon{width:16px;height:16px}

      .sbso-iconbtn,.sbso-refresh{font-size:0!important}.sbso-iconbtn .sbix-icon,.sbso-refresh .sbix-icon{width:20px;height:20px}
      .sbso-new{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important}.sbso-new>.sbix-icon{width:18px;height:18px}
      .sbso-search>span{width:20px;height:20px;display:grid;place-items:center;color:#64766f;top:14px!important}.sbso-search>span .sbix-icon{width:18px;height:18px}
      .sbso-kpi{position:relative;padding-left:54px!important;min-height:72px;display:flex;flex-direction:column;justify-content:center}
      .sbix-kpi-glyph{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:#eaf5ef;color:var(--sbix-green);box-shadow:inset 0 0 0 1px rgba(11,101,73,.06)}
      .sbso-kpi.warn .sbix-kpi-glyph{background:#fff4dc;color:#9d6700}.sbso-kpi.danger .sbix-kpi-glyph{background:#fff0f0;color:#a43e3e}.sbix-kpi-glyph .sbix-icon{width:18px;height:18px}
      .sbso-tab{display:inline-flex!important;align-items:center!important;gap:7px!important;padding:9px 12px!important}.sbso-tab .sbix-icon{width:15px;height:15px;opacity:.9}.sbso-tab.active{box-shadow:0 6px 16px rgba(12,91,67,.16)!important}
      .sbso-card{transition:transform .18s ease,box-shadow .2s ease,border-color .2s ease}.sbso-card:hover{border-color:#cbded5!important;box-shadow:0 12px 32px rgba(22,48,38,.07)!important}
      .sbix-avatar{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:#eaf5ef;color:var(--sbix-green);flex:none;box-shadow:inset 0 0 0 1px rgba(11,101,73,.06)}.sbix-avatar .sbix-icon{width:18px;height:18px}
      .sbso-cardhead{align-items:flex-start!important}.sbso-meta span.sbix-meta{display:inline-flex;align-items:center;gap:4px}.sbso-meta span.sbix-meta .sbix-icon{width:13px;height:13px;opacity:.8}
      .sbso-badge{display:inline-flex!important;align-items:center!important;gap:4px!important}.sbso-badge>.sbix-icon{width:13px;height:13px}
      .sbso-act{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding-inline:11px!important}.sbso-act>.sbix-icon{width:15px;height:15px}.sbso-act.primary{box-shadow:0 6px 15px rgba(12,91,67,.12)}
      .sbso-act:active,.sbso-tab:active,.sbso-iconbtn:active,.sbso-refresh:active,.sbso-new:active{transform:scale(.97)}
      .sbso-act[data-sbso-wa-client],.sbso-act[data-sbso-wa-sale]{color:#0a6848;border-color:#c9dfd5;background:#f5fbf8}.sbso-act[data-sbso-wa-client]:hover,.sbso-act[data-sbso-wa-sale]:hover{background:#eaf7f1}
      .sbso-empty{position:relative;overflow:hidden}.sbso-empty::before{content:'';display:block;width:42px;height:42px;border-radius:14px;background:#edf5f1;margin:0 auto 10px;box-shadow:inset 0 0 0 1px rgba(11,101,73,.06)}
      @media(max-width:620px){.sbso-kpi{padding-left:50px!important}.sbix-kpi-glyph{left:10px}.nav-btn{min-height:52px!important}.nav-btn .ico{width:34px;height:28px}}
      @media(prefers-reduced-motion:reduce){.nav-btn,.quick,.more-card,.sbso-card,.sbso-act,.sbso-tab,.sbso-iconbtn,.sbso-new,.sbso-refresh{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function setIcon(host, name, cls = 'sbix-icon') {
    if (!host) return;
    if (host.dataset.sbixIcon === name && qs('svg.sbix-icon', host)) return;
    host.innerHTML = icon(name, cls);
    host.dataset.sbixIcon = name;
  }

  function decorateBottomNav() {
    qsa('.bottom-nav .nav-btn').forEach((btn) => {
      const nav = btn.dataset.nav || '';
      const label = fold(btn.textContent);
      let name = ({home:'home',sales:'receipt',stock:'box',more:'more'})[nav] || 'message';
      if (nav === 'orders') name = label.includes('dette') || label.includes('bor') ? 'wallet' : 'message';
      const ico = qs('.ico', btn);
      if (ico) setIcon(ico, name);
    });
  }

  function quickIcon(button) {
    const open = button.dataset.open || '';
    const nav = button.dataset.nav || '';
    if (open === 'saleModal') return 'receipt';
    if (open === 'expenseModal') return 'coins';
    if (open === 'productModal') return 'box';
    if (open === 'stockModal') return 'refresh';
    if (open === 'whatsappModal') return 'message';
    if (open === 'withdrawModal') return 'user';
    if (nav === 'deliveries') return 'truck';
    if (button.id === 'exportBtn') return 'download';
    if (button.id === 'logoutBtn') return 'lock';
    return 'more';
  }

  function decorateEcosystemCards() {
    qsa('.quick,.more-card').forEach((button) => {
      const slot = qs('.emoji', button);
      if (slot) setIcon(slot, quickIcon(button));
    });
    qsa('.mic').forEach((button) => setIcon(button, 'mic'));
    qsa('.close').forEach((button) => setIcon(button, 'close'));
    const refresh = qs('#refreshBtn');
    if (refresh) setIcon(refresh, 'refresh');

    qsa('.section-title button.primary,#addSaleItem').forEach((button) => {
      if (button.dataset.sbixPlus === '1') return;
      const text = button.textContent.trim();
      if (!text.startsWith('+')) return;
      button.textContent = text.replace(/^\+\s*/, '');
      button.insertAdjacentHTML('afterbegin', icon('plus', 'sbix-icon sm'));
      button.classList.add('sbix-inline-plus');
      button.dataset.sbixPlus = '1';
    });
  }

  function decorateSalesTop(root) {
    const close = qs('[data-sbso-close]', root); if (close) setIcon(close, 'back');
    const refresh = qs('[data-sbso-refresh]', root); if (refresh) setIcon(refresh, 'refresh');
    const searchSlot = qs('.sbso-search>span', root); if (searchSlot) setIcon(searchSlot, 'search');
    const newButton = qs('[data-sbso-new]', root);
    if (newButton && newButton.dataset.sbixNew !== '1') {
      [...newButton.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach((n) => n.remove());
      newButton.insertAdjacentHTML('afterbegin', icon('plus'));
      newButton.dataset.sbixNew = '1';
    }
  }

  function decorateKpis(root) {
    const names = ['receipt','truck','wallet'];
    qsa('.sbso-kpi', root).forEach((kpi, i) => {
      let slot = qs(':scope > .sbix-kpi-glyph', kpi);
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'sbix-kpi-glyph';
        kpi.prepend(slot);
      }
      setIcon(slot, names[i] || 'receipt');
    });
  }

  function decorateTabs(root) {
    const names = {today:'calendar',deliveries:'truck',receivables:'wallet',clients:'users'};
    qsa('[data-sbso-tab]', root).forEach((button) => {
      const name = names[button.dataset.sbsoTab] || 'more';
      if (button.dataset.sbixIconDone === name && qs(':scope > svg.sbix-icon', button)) return;
      qsa(':scope > svg.sbix-icon', button).forEach((n) => n.remove());
      button.insertAdjacentHTML('afterbegin', icon(name, 'sbix-icon sm'));
      button.dataset.sbixIconDone = name;
    });
  }

  function stripLeadingEmoji(button) {
    const nodes = [...button.childNodes];
    for (const node of nodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      node.textContent = node.textContent.replace(/^\s*(📞|✓|🛵|💰|↻|＋|\+)\s*/u, '');
      break;
    }
  }

  function actionIcon(button) {
    if (button.hasAttribute('data-sbso-wa-client') || button.hasAttribute('data-sbso-wa-sale')) return 'message';
    if (button.hasAttribute('data-sbso-call')) return 'phone';
    if (button.hasAttribute('data-sbso-client')) return 'file';
    if (button.hasAttribute('data-sbso-remind')) return 'coins';
    if (button.hasAttribute('data-sbso-state')) {
      const state = String(button.dataset.sbsoState || '').split(':')[1] || '';
      if (state === 'out_for_delivery') return 'route';
      return 'check';
    }
    return 'more';
  }

  function decorateActions(root) {
    qsa('.sbso-act', root).forEach((button) => {
      const name = actionIcon(button);
      if (button.dataset.sbixAction === name && qs(':scope > svg.sbix-icon', button)) return;
      stripLeadingEmoji(button);
      qsa(':scope > svg.sbix-icon', button).forEach((n) => n.remove());
      button.insertAdjacentHTML('afterbegin', icon(name, 'sbix-icon sm'));
      button.dataset.sbixAction = name;
    });
  }

  function decorateCardMeta(root) {
    qsa('.sbso-cardhead', root).forEach((head) => {
      if (!qs(':scope > .sbix-avatar', head)) {
        const avatar = document.createElement('span');
        avatar.className = 'sbix-avatar';
        avatar.innerHTML = icon('user');
        head.prepend(avatar);
      }
    });

    qsa('.sbso-meta span', root).forEach((span) => {
      if (span.dataset.sbixMeta === '1') return;
      const text = span.textContent || '';
      let name = '';
      if (/^\s*📍/u.test(text)) name = 'pin';
      else if (/^\s*🕐/u.test(text)) name = 'clock';
      if (!name) return;
      span.textContent = text.replace(/^\s*(📍|🕐)\s*/u, '');
      span.prepend(iconNode(name, 'sbix-icon sm'));
      span.classList.add('sbix-meta');
      span.dataset.sbixMeta = '1';
    });

    qsa('.sbso-badge', root).forEach((badge) => {
      if (badge.dataset.sbixBadge === '1') return;
      let name = 'truck';
      if (badge.classList.contains('done')) name = 'check';
      else if (badge.classList.contains('route')) name = 'route';
      else if (badge.classList.contains('due')) name = 'alert';
      badge.insertAdjacentHTML('afterbegin', icon(name, 'sbix-icon sm'));
      badge.dataset.sbixBadge = '1';
    });
  }

  function decorateSalesOps() {
    const root = qs('#sbso-shell');
    if (!root) return;
    decorateSalesTop(root);
    decorateKpis(root);
    decorateTabs(root);
    decorateActions(root);
    decorateCardMeta(root);
  }

  let scheduled = false;
  function decorate() {
    scheduled = false;
    decorateBottomNav();
    decorateEcosystemCards();
    decorateSalesOps();
    document.documentElement.dataset.sbixVersion = VERSION;
  }
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('.nav-btn,.quick,.more-card,.sbso-act,.sbso-tab,.sbso-iconbtn,.sbso-new,.sbso-refresh');
    if (!target) return;
    target.classList.add('sbix-pressing');
  }, { passive:true });
  const release = () => qsa('.sbix-pressing').forEach((node) => node.classList.remove('sbix-pressing'));
  document.addEventListener('pointerup', release, { passive:true });
  document.addEventListener('pointercancel', release, { passive:true });

  installStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleDecorate, { once:true });
  else scheduleDecorate();

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
})();
