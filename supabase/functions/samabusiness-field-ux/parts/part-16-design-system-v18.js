(() => {
  'use strict';
  if (window.__SAMABUSINESS_DESIGN_SYSTEM_V18_2__) return;
  window.__SAMABUSINESS_DESIGN_SYSTEM_V18_2__ = true;

  const VERSION = '18.2.0';
  const SIMPLE_KEY = 'sama-simple-mode-v1';
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function installStyles() {
    if (qs('#sama-design-system-v18-2')) return;
    const style = document.createElement('style');
    style.id = 'sama-design-system-v18-2';
    style.textContent = `
      :root{
        --sama-green-950:#063d2d;--sama-green-900:#07543d;--sama-green-800:#086548;--sama-green-700:#0a7654;
        --sama-green-100:#def2e9;--sama-green-50:#f1faf6;--sama-ink:#10251d;--sama-muted:#66766f;
        --sama-surface:#fff;--sama-surface-2:#f8faf9;--sama-line:#dce6e0;--sama-warning:#9a6700;--sama-warning-bg:#fff5dc;
        --sama-danger:#a33a42;--sama-danger-bg:#fff0f1;--sama-info:#265f8f;--sama-info-bg:#edf5fb;--sama-ok:#0b6b4a;
        --sama-shadow:0 10px 28px rgba(17,50,38,.08);--sama-shadow-strong:0 18px 52px rgba(17,50,38,.15);
        --sama-radius-sm:10px;--sama-radius-md:15px;--sama-radius-lg:20px;--sama-tap:48px;
      }
      html.sama-simple{font-size:108%}
      html.sama-simple .hint,html.sama-simple small,html.sama-simple .muted{font-size:max(11px,.82em)!important;color:#4f6259!important}
      html.sama-simple button,html.sama-simple .nav-btn,html.sama-simple .quick,html.sama-simple .more-card{min-height:var(--sama-tap)!important}
      html.sama-simple .sbso-card,html.sama-simple .card{box-shadow:0 8px 24px rgba(17,50,38,.08)!important;border-color:#cfded6!important}
      html.sama-simple .sbso-moneyrow b,html.sama-simple .kpi-value,html.sama-simple .value{font-size:1.08em!important}
      html.sama-simple .quick .hint,html.sama-simple .more-card .hint{display:none!important}
      html.sama-simple .bottom-nav{min-height:68px!important}
      html.sama-simple .nav-btn{font-size:10px!important;font-weight:850!important}

      .sama-semantic-ok{color:var(--sama-ok)!important}.sama-semantic-warn{color:var(--sama-warning)!important}.sama-semantic-danger{color:var(--sama-danger)!important}
      .sama-help-bubble{position:fixed;z-index:2147483605;left:50%;bottom:92px;transform:translateX(-50%);max-width:min(88vw,420px);padding:11px 14px;border-radius:15px;background:#10251df2;color:#fff;font:700 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:var(--sama-shadow-strong);pointer-events:none;opacity:0;transition:opacity .16s ease,transform .16s ease}
      .sama-help-bubble.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
      .sama-touch{min-width:44px;min-height:44px}
      [data-sama-focusable]:focus-visible{outline:3px solid rgba(10,118,84,.28)!important;outline-offset:2px!important}
      .sama-live-region{position:fixed!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(1px,1px,1px,1px)!important;white-space:nowrap!important}
      @media(min-width:760px){:root{--sama-radius-lg:22px}.sbso-grid{gap:14px!important}.sbso-card{padding:15px!important}}
      @media(max-width:480px){html.sama-simple{font-size:112%}.sbso-actions{gap:7px!important}.sbso-act{min-height:44px!important}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  }

  function setSimple(on, announce = true) {
    const enabled = Boolean(on);
    document.documentElement.classList.toggle('sama-simple', enabled);
    try { localStorage.setItem(SIMPLE_KEY, enabled ? '1' : '0'); } catch (_) {}
    if (announce) speakStatus(enabled ? 'Mode simple activé.' : 'Mode normal activé.');
    window.dispatchEvent(new CustomEvent('sama:mode-simple', { detail: { enabled } }));
    return enabled;
  }

  function isSimple() {
    return document.documentElement.classList.contains('sama-simple');
  }

  function speakStatus(text) {
    let live = qs('#sama-live-region');
    if (!live) {
      live = document.createElement('div');
      live.id = 'sama-live-region';
      live.className = 'sama-live-region';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = text; });
  }

  function accessibleName(el) {
    const own = el.getAttribute('aria-label');
    if (own) return own;
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 120);
    const title = el.getAttribute('title');
    return title || '';
  }

  function describe(el) {
    const label = fold(accessibleName(el));
    if (!label) return 'Action disponible.';
    if (label.includes('nouvelle vente')) return 'Nouvelle vente : enregistrez ce que vous venez de vendre. SAMA calcule ensuite le total, le reste et le stock.';
    if (label.includes('depense')) return 'Dépense : notez l’argent sorti du commerce pour connaître le bénéfice réel.';
    if (label.includes('stock')) return 'Stock : voyez ce qu’il reste, ce qui manque et ce qu’il faut recommander.';
    if (label.includes('dette') || label.includes('encaisser')) return 'Dettes : retrouvez l’argent que les clients doivent encore payer et préparez une relance.';
    if (label.includes('livraison') || label.includes('livrer')) return 'Livraison : suivez les commandes à préparer, en route ou déjà livrées.';
    if (label.includes('whatsapp')) return 'WhatsApp : préparez un message pour ce client sans recopier son numéro.';
    if (label.includes('client')) return 'Clients : retrouvez les achats, montants, dettes, adresse et historique de chaque personne.';
    if (label.includes('produit')) return 'Produit : ajoutez ou mettez à jour un article vendu par votre commerce.';
    if (label.includes('retrait')) return 'Retrait patron : enregistrez l’argent pris pour vous sans le confondre avec une dépense du commerce.';
    return `${accessibleName(el)} : appuyez pour ouvrir cette fonction.`;
  }

  let holdTimer = null;
  let holdTarget = null;
  function bubble(text) {
    let node = qs('#sama-help-bubble');
    if (!node) {
      node = document.createElement('div');
      node.id = 'sama-help-bubble';
      node.className = 'sama-help-bubble';
      node.setAttribute('role', 'tooltip');
      document.body.appendChild(node);
    }
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._hideTimer);
    node._hideTimer = setTimeout(() => node.classList.remove('show'), 3400);
  }

  function installLongPressHelp() {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('.quick,.more-card,.nav-btn,.sbso-act,.sbso-tab,[data-sama-explain]');
      if (!target) return;
      holdTarget = target;
      holdTimer = setTimeout(() => {
        if (holdTarget !== target) return;
        const message = target.dataset.samaExplain || describe(target);
        bubble(message);
        speakStatus(message);
        try { navigator.vibrate?.(25); } catch (_) {}
      }, 650);
    }, { passive: true });
    const cancel = () => { clearTimeout(holdTimer); holdTimer = null; holdTarget = null; };
    document.addEventListener('pointerup', cancel, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
    document.addEventListener('pointermove', (event) => {
      if (!holdTarget) return;
      const rect = holdTarget.getBoundingClientRect();
      if (event.clientX < rect.left - 18 || event.clientX > rect.right + 18 || event.clientY < rect.top - 18 || event.clientY > rect.bottom + 18) cancel();
    }, { passive: true });
  }

  function decorateAccessibility() {
    qsa('button,.nav-btn,.quick,.more-card,.sbso-act,.sbso-tab,.sbso-iconbtn').forEach((el) => {
      el.dataset.samaFocusable = '1';
      if (!el.getAttribute('aria-label')) {
        const name = accessibleName(el);
        if (name) el.setAttribute('aria-label', name);
      }
      if (el.matches('.sbso-iconbtn,.close,#refreshBtn')) el.classList.add('sama-touch');
    });
    qsa('.sbso-card').forEach((card) => {
      if (!card.getAttribute('role')) card.setAttribute('role', 'group');
      const name = qs('h3,h4,.sbso-cardtitle b', card)?.textContent?.trim();
      if (name && !card.getAttribute('aria-label')) card.setAttribute('aria-label', `Client ${name}`);
    });
    qsa('.sbfr-balance-due,.due').forEach((el) => el.classList.add('sama-semantic-danger'));
    qsa('.sbfr-balance-ok,.done').forEach((el) => el.classList.add('sama-semantic-ok'));
  }

  function updateVersionBadges() {
    qsa('body *').forEach((el) => {
      if (el.children.length) return;
      const t = (el.textContent || '').trim();
      if (/^Sama Business\s+V18\.1\s+active$/i.test(t)) el.textContent = 'Sama Business V18.2 · Copilote';
    });
  }

  let scheduled = false;
  function decorate() {
    scheduled = false;
    decorateAccessibility();
    updateVersionBadges();
    document.documentElement.dataset.samaDesignVersion = VERSION;
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  installStyles();
  try { setSimple(localStorage.getItem(SIMPLE_KEY) === '1', false); } catch (_) {}
  installLongPressHelp();
  window.SamaDesignSystem = Object.freeze({ version: VERSION, setSimple, toggleSimple: () => setSimple(!isSimple()), isSimple, announce: speakStatus });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true }); else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
