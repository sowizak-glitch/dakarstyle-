(() => {
  'use strict';

  const VERSION = '5.3.0';
  const STORAGE = {
    visitor: 'senecompare.v53.visitor',
    session: 'senecompare.v53.session',
    impressions: 'senecompare.v53.impressions',
  };
  const FALLBACK_CAMPAIGNS = [
    {
      slug: 'samabusiness-launch', brand: 'SamaBusiness', badge_fr: 'Application partenaire', badge_wo: 'Application partenaire',
      title_fr: 'Votre commerce dans votre téléphone', title_wo: 'Sa bisnis ci sa telefon',
      description_fr: 'Ventes, stock, dettes, dépenses et bénéfices réunis dans une application simple.',
      description_wo: 'Jaay, stock, bor, depaas ak bénéfice lépp ci benn application bu yomb.',
      cta_fr: 'Installer SamaBusiness', cta_wo: 'Tàmbali SamaBusiness',
      destination_url: 'https://samabusiness.dakarstyle.com/?utm_source=senecompare&utm_medium=house_banner&utm_campaign=samabusiness_launch',
      creative: { mark: 'SB', icon: '📒', theme: 'emerald', eyebrow: 'GÉRER · VENDRE · GRANDIR' },
    },
    {
      slug: 'sowhat-africa-culture', brand: 'Sowhat Africa', badge_fr: 'Marque sénégalaise', badge_wo: 'Marque sénégalaise',
      title_fr: 'Wear the Culture. Culture for Winners.', title_wo: 'Solal sa culture. Culture for Winners.',
      description_fr: 'Streetwear, sport et culture contemporaine pensés à Dakar pour le Sénégal et la diaspora.',
      description_wo: 'Streetwear, sport ak culture bu bees, ñu def ko ci Dakar ngir Senegaal ak diaspora.',
      cta_fr: 'Découvrir la collection', cta_wo: 'Gis collection bi',
      destination_url: 'https://sowhatafrica.com/?utm_source=senecompare&utm_medium=house_banner&utm_campaign=culture_for_winners',
      creative: { mark: 'SA', icon: '✦', theme: 'ink', eyebrow: 'DAKAR 221 · CAPSULE 2026' },
    },
    {
      slug: 'advertise-on-senecompare', brand: 'SeneCompare Pro', badge_fr: 'Votre marque ici', badge_wo: 'Sa marque fii',
      title_fr: 'Mettez votre activité devant les bons clients', title_wo: 'Wone sa liggéey ci kanamu clients yi',
      description_fr: 'Bannières sobres, résultats sponsorisés clairement indiqués et statistiques transparentes.',
      description_wo: 'Bannière yu leer, résultats sponsorisés ak statistiques yu wóor.',
      cta_fr: 'Demander une mise en avant', cta_wo: 'Laaj ñu wone sa activité',
      destination_url: 'https://senecompare.dakarstyle.com/?partner=1&utm_source=senecompare&utm_medium=house_banner&utm_campaign=advertise',
      creative: { mark: 'SC', icon: '↗', theme: 'sun', eyebrow: 'ESPACE PROFESSIONNEL' },
    },
  ];

  function uuid() {
    try { return crypto.randomUUID(); }
    catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  }
  function readStorage(storage, key) { try { return storage.getItem(key) || ''; } catch { return ''; } }
  function writeStorage(storage, key, value) { try { storage.setItem(key, value); } catch { /* unavailable */ } }
  function getOrCreate(storage, key) { const existing = readStorage(storage, key); if (existing) return existing; const value = uuid(); writeStorage(storage, key, value); return value; }
  const visitorId = getOrCreate(localStorage, STORAGE.visitor);
  const sessionId = getOrCreate(sessionStorage, STORAGE.session);

  function locale() {
    const saved = readStorage(localStorage, 'senecompare.v5.locale');
    return saved === 'wo' || document.documentElement.lang.toLowerCase().startsWith('wo') ? 'wo' : 'fr';
  }
  function device() {
    const width = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    if (width < 720) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
  }
  function referrerHost() {
    if (!document.referrer) return 'direct';
    try { return new URL(document.referrer).hostname || 'direct'; }
    catch { return 'direct'; }
  }
  function send(path, body, options = {}) {
    return fetch(path, {
      method: options.method || 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Version': `senecompare-web-${VERSION}`, ...(options.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: options.keepalive !== false,
      credentials: 'same-origin',
    });
  }
  function track(eventType, extras = {}) {
    const payload = {
      event_type: eventType,
      visitor_id: visitorId,
      session_id: sessionId,
      path: `${location.pathname}${location.search}`.slice(0, 240),
      referrer_host: referrerHost(),
      locale: locale(),
      device: device(),
      campaign_slug: extras.campaign_slug || '',
      metadata: extras.metadata || {},
    };
    return send('/api/analytics/track', payload).catch(() => null);
  }

  function trackInitialVisit() {
    const key = `senecompare.v53.view:${location.pathname}${location.search}`;
    if (!readStorage(sessionStorage, key)) {
      writeStorage(sessionStorage, key, '1');
      track('page_view');
    }
    const sessionKey = 'senecompare.v53.session_started';
    if (!readStorage(sessionStorage, sessionKey)) {
      writeStorage(sessionStorage, sessionKey, '1');
      track('session_start');
    }
  }

  function buildPartnerDialog() {
    if (document.getElementById('scPartnerDialog')) return document.getElementById('scPartnerDialog');
    const dialog = document.createElement('dialog');
    dialog.id = 'scPartnerDialog';
    dialog.className = 'sc-partner-dialog';
    dialog.setAttribute('aria-labelledby', 'scPartnerTitle');
    dialog.innerHTML = `
      <section class="sc-partner-panel">
        <div class="sc-partner-top">
          <div><small>Régie SeneCompare</small><h2 id="scPartnerTitle">Présentez votre activité</h2><p>Décrivez votre besoin. Les emplacements sponsorisés restent identifiés, sobres et mesurables.</p></div>
          <button class="sc-partner-close" type="button" aria-label="Fermer">×</button>
        </div>
        <form class="sc-partner-form" novalidate>
          <div class="sc-partner-field"><label for="scBusinessName">Entreprise</label><input id="scBusinessName" name="business_name" maxlength="160" required autocomplete="organization"></div>
          <div class="sc-partner-field"><label for="scContactName">Votre nom</label><input id="scContactName" name="contact_name" maxlength="160" required autocomplete="name"></div>
          <div class="sc-partner-field"><label for="scPartnerEmail">Email professionnel</label><input id="scPartnerEmail" name="email" type="email" maxlength="254" required autocomplete="email"></div>
          <div class="sc-partner-field"><label for="scPartnerPhone">Téléphone / WhatsApp</label><input id="scPartnerPhone" name="phone" inputmode="tel" maxlength="20" autocomplete="tel"></div>
          <div class="sc-partner-field full"><label for="scPlacement">Mise en avant souhaitée</label><select id="scPlacement" name="placement"><option value="banner">Bannière discrète</option><option value="sponsored_result">Résultat sponsorisé</option><option value="launch">Lancement de produit</option><option value="partnership">Partenariat de marque</option></select></div>
          <div class="sc-partner-field full"><label for="scPartnerMessage">Projet</label><textarea id="scPartnerMessage" name="message" maxlength="1500" placeholder="Produit, service, zone ciblée, période souhaitée…"></textarea></div>
          <button class="sc-partner-submit" type="submit">Envoyer la demande</button>
          <p class="sc-partner-status" role="status" aria-live="polite"></p>
        </form>
      </section>`;
    document.body.append(dialog);
    const close = () => { if (dialog.open) dialog.close(); };
    dialog.querySelector('.sc-partner-close')?.addEventListener('click', close);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
    dialog.querySelector('form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector('.sc-partner-status');
      const button = form.querySelector('.sc-partner-submit');
      const data = Object.fromEntries(new FormData(form).entries());
      status.textContent = 'Envoi en cours…'; status.dataset.state = ''; button.disabled = true;
      try {
        const response = await send('/api/partners/leads', { ...data, visitor_id: visitorId, source_campaign: 'advertise-on-senecompare' }, { keepalive: false });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok !== true) throw new Error(payload.code || 'SEND_FAILED');
        status.textContent = 'Demande reçue. Vous serez contacté sur les coordonnées indiquées.'; status.dataset.state = 'success';
        form.reset(); track('partner_lead_submitted', { campaign_slug: 'advertise-on-senecompare' });
      } catch {
        status.textContent = 'La demande n’a pas pu être envoyée. Vérifiez les champs puis réessayez.'; status.dataset.state = 'error';
      } finally { button.disabled = false; }
    });
    return dialog;
  }

  function openPartnerDialog() {
    const dialog = buildPartnerDialog();
    track('partner_form_open', { campaign_slug: 'advertise-on-senecompare' });
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function text(campaign, key) {
    return campaign[`${key}_${locale()}`] || campaign[`${key}_fr`] || '';
  }

  function renderCampaign(card, campaign) {
    const creative = campaign.creative || {};
    card.dataset.theme = creative.theme || 'emerald';
    card.dataset.campaign = campaign.slug;
    card.querySelector('.sc-sponsored-mark b').textContent = creative.mark || campaign.brand.slice(0, 2).toUpperCase();
    card.querySelector('.sc-sponsored-mark span').textContent = creative.icon || '↗';
    card.querySelector('.sc-sponsored-eyebrow').textContent = creative.eyebrow || text(campaign, 'badge');
    card.querySelector('h3').textContent = text(campaign, 'title');
    card.querySelector('.sc-sponsored-content p').textContent = text(campaign, 'description');
    const link = card.querySelector('.sc-sponsored-action a');
    link.textContent = text(campaign, 'cta');
    link.href = campaign.destination_url;
    link.dataset.campaign = campaign.slug;
    link.setAttribute('aria-label', `${text(campaign, 'cta')} — ${campaign.brand}`);
    card.querySelector('.sc-sponsored-label').textContent = `${text(campaign, 'badge')} · Sponsorisé`;
  }

  function insertAdvertiserLink() {
    const footerLinks = document.querySelector('.footer-links') || document.querySelector('footer nav') || document.querySelector('footer');
    if (!footerLinks || document.getElementById('scAdvertiserLink')) return;
    const link = document.createElement('a');
    link.id = 'scAdvertiserLink'; link.href = '/?partner=1'; link.className = 'sc-advertiser-link'; link.textContent = 'Annoncer sur SeneCompare';
    link.addEventListener('click', (event) => { event.preventDefault(); openPartnerDialog(); });
    footerLinks.append(link);
  }

  function mountCarousel(campaigns) {
    if (!campaigns.length || document.getElementById('scSponsored')) return;
    const shell = document.createElement('section');
    shell.id = 'scSponsored'; shell.className = 'sc-sponsored-shell'; shell.setAttribute('aria-label', 'Sélection partenaire');
    shell.innerHTML = `
      <header class="sc-sponsored-head"><div><span class="sc-sponsored-kicker">Sélection partenaire</span><h2>Des outils et marques utiles, sans encombrer votre recherche</h2></div><p class="sc-sponsored-note">Les contenus sponsorisés sont toujours identifiés. Les clics servent uniquement à mesurer la performance de la campagne.</p></header>
      <article class="sc-sponsored-card">
        <div class="sc-sponsored-mark" aria-hidden="true"><b></b><span></span></div>
        <div class="sc-sponsored-content"><div class="sc-sponsored-eyebrow"></div><h3></h3><p></p></div>
        <div class="sc-sponsored-action"><a target="_blank" rel="noopener sponsored"></a><small class="sc-sponsored-label"></small></div>
      </article>
      <div class="sc-sponsored-controls" aria-label="Choisir une annonce"></div>`;
    const anchor = document.querySelector('.process-section') || document.querySelector('.how-it-works') || document.querySelector('footer');
    if (anchor) anchor.before(shell); else document.body.append(shell);
    const card = shell.querySelector('.sc-sponsored-card');
    const controls = shell.querySelector('.sc-sponsored-controls');
    let index = 0; let timer = 0; let paused = false;
    const impressions = new Set((readStorage(sessionStorage, STORAGE.impressions) || '').split(',').filter(Boolean));

    function recordImpression(campaign) {
      if (!campaign || impressions.has(campaign.slug)) return;
      impressions.add(campaign.slug); writeStorage(sessionStorage, STORAGE.impressions, [...impressions].join(','));
      track('ad_impression', { campaign_slug: campaign.slug });
    }
    function show(nextIndex, userInitiated = false) {
      index = (nextIndex + campaigns.length) % campaigns.length;
      const campaign = campaigns[index]; renderCampaign(card, campaign);
      controls.querySelectorAll('button').forEach((button, buttonIndex) => button.setAttribute('aria-current', String(buttonIndex === index)));
      if (userInitiated || !('IntersectionObserver' in window)) recordImpression(campaign);
    }
    campaigns.forEach((campaign, buttonIndex) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'sc-sponsored-dot'; button.setAttribute('aria-label', `Afficher ${campaign.brand}`); button.setAttribute('aria-current', String(buttonIndex === 0));
      button.addEventListener('click', () => show(buttonIndex, true)); controls.append(button);
    });
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .45)) recordImpression(campaigns[index]); }, { threshold: [.45] }) : null;
    observer?.observe(card);
    card.querySelector('a')?.addEventListener('click', (event) => {
      const campaign = campaigns[index]; track('ad_click', { campaign_slug: campaign.slug });
      if (campaign.slug === 'advertise-on-senecompare') { event.preventDefault(); openPartnerDialog(); }
    });
    shell.addEventListener('mouseenter', () => { paused = true; }); shell.addEventListener('mouseleave', () => { paused = false; });
    shell.addEventListener('focusin', () => { paused = true; }); shell.addEventListener('focusout', () => { paused = false; });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = window.setInterval(() => { if (!paused && !document.hidden) show(index + 1); }, 9000);
    window.addEventListener('pagehide', () => { if (timer) clearInterval(timer); observer?.disconnect(); }, { once: true });
    show(0);
  }

  async function loadCampaigns() {
    try {
      const response = await fetch('/api/ads', { headers: { Accept: 'application/json', 'X-Client-Version': `senecompare-web-${VERSION}` }, credentials: 'same-origin' });
      const payload = await response.json();
      if (response.ok && payload.ok && Array.isArray(payload.campaigns) && payload.campaigns.length) return payload.campaigns;
    } catch { /* fallback below */ }
    return FALLBACK_CAMPAIGNS;
  }

  function attachProductSignals() {
    document.getElementById('installButton')?.addEventListener('click', () => track('install_click'));
    document.getElementById('heroInstallButton')?.addEventListener('click', () => track('install_click'));
    window.addEventListener('beforeinstallprompt', () => track('install_prompt'), { once: true });
    window.addEventListener('appinstalled', () => track('app_installed'), { once: true });
    document.getElementById('shareButton')?.addEventListener('click', () => track('share'));
    document.getElementById('searchForm')?.addEventListener('submit', () => track('search_submit'));
  }

  async function init() {
    trackInitialVisit(); attachProductSignals(); insertAdvertiserLink(); buildPartnerDialog();
    mountCarousel(await loadCampaigns());
    const params = new URLSearchParams(location.search);
    if (params.get('partner') === '1') setTimeout(openPartnerDialog, 350);
    window.__SENECOMPARE_MONETIZATION__ = Object.freeze({ version: VERSION, visitorId, sessionId, openPartnerDialog, track });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
