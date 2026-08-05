(() => {
  'use strict';

  const VERSION = '5.1.0';
  const SELECTORS = {
    results: '#resultsGrid',
    searchSection: '.search-section',
    resultCard: '.result-card',
  };

  const COPY = {
    fr: {
      quality: 'Contrôle qualité',
      qualityCopy: 'Sources visibles, fraîcheur expliquée et contact humain avant paiement.',
      details: 'Voir les garanties',
      serviceChecking: 'Service en vérification',
      serviceReady: 'Service disponible',
      catalogueReady: 'Catalogue local connecté',
      continuityReady: 'Sources de continuité actives',
      protectionReady: 'Protection active',
      protectionChecking: 'Protection en vérification',
      voiceReady: 'Recherche vocale disponible',
      voiceLimited: 'Vocal selon le téléphone',
      qualityTitle: 'Ce que SeneCompare garantit',
      qualityIntro: 'SeneCompare ne remplace pas le vendeur. Il organise les preuves utiles pour vous aider à décider sans inventer un prix.',
      sourceVisible: 'Source publique visible',
      sourceProof: 'La source peut être ouverte et vérifiée avant toute décision.',
      freshnessProof: 'La date de vérification est affichée quand elle est disponible.',
      confidenceProof: 'Le niveau de confiance résume la qualité, la fraîcheur et la correspondance.',
      humanProof: 'Le prix, le stock et l’identité du vendeur doivent être confirmés avant paiement.',
      explain: 'Pourquoi ce résultat ?',
      alert: 'Alerte prix',
      report: 'Signaler',
      whatsapp: 'Envoyer sur WhatsApp',
      explainTitle: 'Pourquoi ce résultat est affiché',
      explainIntro: 'Voici les éléments visibles utilisés pour comprendre ce résultat. SeneCompare sépare une offre tarifée d’une simple source à explorer.',
      offerProof: 'Une offre avec prix a été identifiée.',
      sourceOnlyProof: 'Cette carte est une source utile à explorer ; aucun prix n’est inventé.',
      confidenceLabel: 'Niveau de confiance affiché',
      locationLabel: 'Localisation affichée',
      priceLabel: 'Prix ou statut du prix affiché',
      openSourceLabel: 'Lien vers la source disponible',
      alertTitle: 'Créer une alerte de prix',
      alertIntro: 'Indiquez votre contact. La demande sera enregistrée pour cette recherche ou cette offre.',
      phone: 'Téléphone',
      email: 'E-mail',
      targetPrice: 'Prix souhaité maximum (F CFA)',
      contactHint: 'Renseignez au moins un téléphone ou un e-mail. Aucun paiement n’est demandé.',
      activateAlert: 'Activer l’alerte',
      sending: 'Envoi en cours…',
      alertSuccess: 'Alerte enregistrée.',
      contactRequired: 'Ajoutez un téléphone valide ou un e-mail valide.',
      requestFailed: 'La demande n’a pas pu être enregistrée. Réessayez.',
      reportTitle: 'Signaler un problème',
      reportIntro: 'Votre signalement aide à retirer les prix périmés, offres indisponibles ou contenus suspects.',
      reason: 'Motif',
      reasonPrice: 'Prix périmé',
      reasonUnavailable: 'Offre indisponible',
      reasonDetails: 'Informations incorrectes',
      reasonSuspicious: 'Annonce suspecte',
      reasonOther: 'Autre',
      detailsLabel: 'Détails utiles',
      detailsPlaceholder: 'Expliquez brièvement ce qui doit être vérifié…',
      sendReport: 'Envoyer le signalement',
      reportSuccess: 'Signalement reçu. Merci.',
      close: 'Fermer',
      trustedSource: 'Source vérifiable',
      linkUnavailable: 'Le lien de cette source est indisponible.',
      shared: 'Ouverture de WhatsApp…',
    },
    wo: {
      quality: 'Seetlu ngir wóolu',
      qualityCopy: 'Source bu leer, bésu seet bu leer, te dëggal ak jaaykat bi bala fay.',
      details: 'Gis li ñu wóorlu',
      serviceChecking: 'Nu ngi seet service bi',
      serviceReady: 'Service bi jàppandi na',
      catalogueReady: 'Catalogue bu Senegaal jokkoo na',
      continuityReady: 'Sources yi jàppandi nañu',
      protectionReady: 'Kaarange gi liggéey na',
      protectionChecking: 'Nu ngi seet kaarange gi',
      voiceReady: 'Seet ci kàddu jàppandi na',
      voiceLimited: 'Vocal bi aju na ci telefon bi',
      qualityTitle: 'Li SeneCompare di wóorlu',
      qualityIntro: 'SeneCompare du jaaykat bi. Dafa tëral firnde yi ngir nga mën a tànn te du sos njëg.',
      sourceVisible: 'Source bi leer na',
      sourceProof: 'Mën nga ubbi source bi te seet ko bala ngay tànn.',
      freshnessProof: 'Bés bi ñu ko mujjee seet dafay feeñ bu amee.',
      confidenceProof: 'Wóolu gi dafay boole source, bésu seet ak ni mu méngoo ak sa laaj.',
      humanProof: 'Dëggal njëg, stock ak jaaykat bi bala ngay fay.',
      explain: 'Lu tax résultat bii ?',
      alert: 'Xaar njëg',
      report: 'Wax jafe-jafe',
      whatsapp: 'Yónnee ci WhatsApp',
      explainTitle: 'Lu tax résultat bii feeñ',
      explainIntro: 'Yii ñooy firnde yi feeñ. SeneCompare dafay séddale offre bu am njëg ak source bu ñu wara seet.',
      offerProof: 'Gis nañu offre bu am njëg.',
      sourceOnlyProof: 'Lii source bu am solo la; SeneCompare sosul benn njëg.',
      confidenceLabel: 'Wóolu gi feeñ na',
      locationLabel: 'Bérab bi feeñ na',
      priceLabel: 'Njëg walla anam-u-njëg bi feeñ na',
      openSourceLabel: 'Lien source bi jàppandi na',
      alertTitle: 'Sos xaaru njëg',
      alertIntro: 'Bindal sa contact. Nu denc laaj bi ngir offre walla seet bii.',
      phone: 'Telefon',
      email: 'E-mail',
      targetPrice: 'Njëg bi nga bëgg mu yem (F CFA)',
      contactHint: 'Bind telefon walla e-mail. Duñu la laaj fay.',
      activateAlert: 'Tàmbali xaar bi',
      sending: 'Nu ngi yónnee…',
      alertSuccess: 'Denc nañu xaaru njëg bi.',
      contactRequired: 'Bind telefon bu baax walla e-mail bu baax.',
      requestFailed: 'Mënuñu denc laaj bi. Jéemaatal.',
      reportTitle: 'Wax jafe-jafe',
      reportIntro: 'Sa wax dina dimbali nu far njëg bu yàgg, offre bu jeex walla annonce bu ñàkk wóolu.',
      reason: 'Lu am',
      reasonPrice: 'Njëg bi yàgg na',
      reasonUnavailable: 'Offre bi amul',
      reasonDetails: 'Leeral bi baaxul',
      reasonSuspicious: 'Annonce bi am na sikki-sakka',
      reasonOther: 'Leneen',
      detailsLabel: 'Leeral',
      detailsPlaceholder: 'Waxal lu ñu wara seet…',
      sendReport: 'Yónnee',
      reportSuccess: 'Jot nañu sa wax. Jërëjëf.',
      close: 'Tëj',
      trustedSource: 'Source bu mën a seet',
      linkUnavailable: 'Lien source bii jàppandul.',
      shared: 'Nu ngi ubbi WhatsApp…',
    },
  };

  const state = {
    dialog: null,
    dialogBody: null,
    dialogTitle: null,
    toastRegion: null,
    schemaTimer: 0,
  };

  function locale() {
    return document.documentElement.lang.toLowerCase().startsWith('wo') ? 'wo' : 'fr';
  }

  function t(key) {
    return COPY[locale()][key] || COPY.fr[key] || key;
  }

  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  ready(init);

  function init() {
    document.documentElement.dataset.senecomparePremium = VERSION;
    installDialog();
    installToastRegion();
    installApplicationSchema();
    installTrustPanel();
    bindDelegatedActions();
    observeResults();
    enhanceAllCards();
  }

  function installDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'premium-dialog';
    dialog.id = 'premiumDialog';
    dialog.setAttribute('aria-labelledby', 'premiumDialogTitle');

    const shell = document.createElement('div');
    shell.className = 'premium-dialog__shell';

    const header = document.createElement('header');
    header.className = 'premium-dialog__header';
    const heading = document.createElement('div');
    const kicker = document.createElement('p');
    kicker.textContent = 'SeneCompare';
    const title = document.createElement('h2');
    title.id = 'premiumDialogTitle';
    heading.append(kicker, title);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'premium-dialog__close';
    close.setAttribute('aria-label', t('close'));
    close.textContent = '×';
    close.addEventListener('click', closeDialog);

    const body = document.createElement('div');
    body.className = 'premium-dialog__body';
    header.append(heading, close);
    shell.append(header, body);
    dialog.append(shell);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
    document.body.append(dialog);

    state.dialog = dialog;
    state.dialogBody = body;
    state.dialogTitle = title;
  }

  function installToastRegion() {
    const region = document.createElement('div');
    region.className = 'premium-toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.append(region);
    state.toastRegion = region;
  }

  function installTrustPanel() {
    const searchSection = document.querySelector(SELECTORS.searchSection);
    if (!searchSection || document.getElementById('premiumTrust')) return;

    const panel = document.createElement('section');
    panel.className = 'premium-trust';
    panel.id = 'premiumTrust';
    panel.setAttribute('aria-label', t('quality'));

    const heading = document.createElement('div');
    heading.className = 'premium-trust__heading';
    const mark = document.createElement('span');
    mark.className = 'premium-trust__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✓';
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = t('quality');
    const small = document.createElement('small');
    small.textContent = t('qualityCopy');
    copy.append(strong, small);
    heading.append(mark, copy);

    const signals = document.createElement('div');
    signals.className = 'premium-trust__signals';
    signals.setAttribute('aria-live', 'polite');
    signals.append(
      signal('service', t('serviceChecking')),
      signal('catalogue', t('serviceChecking')),
      signal('security', t('protectionChecking')),
      signal('voice', t('voiceLimited')),
    );

    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'premium-trust__button';
    details.dataset.premiumAction = 'quality';
    details.textContent = t('details');

    panel.append(heading, signals, details);
    searchSection.insertAdjacentElement('afterend', panel);
    refreshHealth(panel);
  }

  function signal(name, label) {
    const node = document.createElement('span');
    node.className = 'premium-signal';
    node.dataset.signal = name;
    node.dataset.state = 'pending';
    node.textContent = label;
    return node;
  }

  async function refreshHealth(panel) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Client-Version': `senecompare-premium-${VERSION}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      const health = await response.json();
      if (!response.ok || health.ok !== true) throw new Error('HEALTH_UNAVAILABLE');
      setSignal(panel, 'service', t('serviceReady'), 'ok');
      setSignal(panel, 'catalogue', health.catalog_connected ? t('catalogueReady') : t('continuityReady'), health.catalog_connected ? 'ok' : 'warn');
      const protectedGateway = health.gateway_security === true && health.strict_origin === true && health.distributed_rate_limit === true;
      setSignal(panel, 'security', protectedGateway ? t('protectionReady') : t('protectionChecking'), protectedGateway ? 'ok' : 'warn');
      const voiceReady = health.voice_transcription_available === true;
      setSignal(panel, 'voice', voiceReady ? t('voiceReady') : t('voiceLimited'), voiceReady ? 'ok' : 'warn');
    } catch {
      setSignal(panel, 'service', t('serviceChecking'), 'warn');
      setSignal(panel, 'catalogue', t('continuityReady'), 'warn');
      setSignal(panel, 'security', t('protectionChecking'), 'warn');
      setSignal(panel, 'voice', t('voiceLimited'), 'warn');
    } finally {
      clearTimeout(timeout);
    }
  }

  function setSignal(panel, name, label, status) {
    const node = panel.querySelector(`[data-signal="${name}"]`);
    if (!node) return;
    node.textContent = label;
    node.dataset.state = status;
  }

  function bindDelegatedActions() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-premium-action]');
      if (!button) return;
      const action = button.dataset.premiumAction;
      if (action === 'quality') return openQuality();
      const card = button.closest(SELECTORS.resultCard);
      if (!card) return;
      const item = readCard(card);
      if (action === 'explain') openExplanation(item, card);
      else if (action === 'alert') openAlert(item, card);
      else if (action === 'report') openReport(item, card);
      else if (action === 'whatsapp') shareWhatsApp(item);
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest(`${SELECTORS.resultCard} .result-actions a`);
      if (!link) return;
      if (!link.href || link.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        toast(t('linkUnavailable'), 'error');
        return;
      }
      const card = link.closest(SELECTORS.resultCard);
      if (card) trackClick(readCard(card), 'open_source');
    }, { capture: true });
  }

  function observeResults() {
    const grid = document.querySelector(SELECTORS.results);
    if (!grid) return;
    const observer = new MutationObserver(() => {
      enhanceAllCards();
      scheduleItemListSchema();
    });
    observer.observe(grid, { childList: true, subtree: true });
  }

  function enhanceAllCards() {
    document.querySelectorAll(SELECTORS.resultCard).forEach(enhanceCard);
    scheduleItemListSchema();
  }

  function enhanceCard(card) {
    if (card.dataset.premiumEnhanced === VERSION) return;
    card.dataset.premiumEnhanced = VERSION;

    const sourceLink = card.querySelector('.result-actions a');
    if (sourceLink) {
      sourceLink.referrerPolicy = 'no-referrer';
      if (!sourceLink.href || sourceLink.getAttribute('href') === '#' || sourceLink.getAttribute('aria-disabled') === 'true') {
        sourceLink.removeAttribute('href');
        sourceLink.setAttribute('aria-disabled', 'true');
        sourceLink.tabIndex = -1;
      } else {
        const proof = document.createElement('div');
        proof.className = 'premium-source-proof';
        proof.textContent = t('trustedSource');
        const actions = card.querySelector('.result-actions');
        if (actions) actions.insertAdjacentElement('beforebegin', proof);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'premium-card-actions';
    actions.setAttribute('aria-label', locale() === 'wo' ? 'Jëf yi am solo' : 'Actions utiles');
    actions.append(
      actionButton('explain', 'ⓘ', t('explain')),
      actionButton('alert', '♢', t('alert')),
      actionButton('report', '!', t('report')),
      actionButton('whatsapp', '↗', t('whatsapp')),
    );
    card.append(actions);
  }

  function actionButton(action, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'premium-card-action';
    button.dataset.premiumAction = action;
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = icon;
    const text = document.createElement('span');
    text.textContent = label;
    button.append(mark, text);
    return button;
  }

  function readCard(card) {
    const sourceLink = card.querySelector('.result-actions a[href]');
    return {
      id: card.dataset.id || '',
      isOffer: card.classList.contains('is-offer'),
      title: textOf(card, 'h3') || 'Résultat SeneCompare',
      seller: textOf(card, '.result-seller'),
      price: textOf(card, '.result-price'),
      location: textOf(card, '.result-meta span'),
      freshness: textOf(card, '.trust-line span:first-child'),
      confidence: textOf(card, '.trust-score'),
      type: textOf(card, '.result-type'),
      sourceUrl: sourceLink ? sourceLink.href : '',
    };
  }

  function textOf(root, selector) {
    return (root.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function openQuality() {
    const facts = [
      ['1', t('sourceProof')],
      ['2', t('freshnessProof')],
      ['3', t('confidenceProof')],
      ['4', t('humanProof')],
    ];
    openFactsDialog(t('qualityTitle'), t('qualityIntro'), facts);
  }

  function openExplanation(item, card) {
    const facts = [
      ['1', item.isOffer ? t('offerProof') : t('sourceOnlyProof')],
      ['2', `${t('priceLabel')} : ${item.price || '—'}`],
      ['3', `${t('locationLabel')} : ${item.location || 'Sénégal'}`],
      ['4', `${t('confidenceLabel')} : ${item.confidence || '—'}`],
      ['5', `${t('openSourceLabel')} : ${item.sourceUrl ? item.seller || t('sourceVisible') : t('linkUnavailable')}`],
    ];
    if (item.freshness) facts.splice(3, 0, ['✓', item.freshness]);
    openFactsDialog(t('explainTitle'), t('explainIntro'), facts);
    card.setAttribute('aria-label', `${item.title}. ${item.price}. ${item.confidence}`);
  }

  function openFactsDialog(title, intro, facts) {
    const content = document.createDocumentFragment();
    const paragraph = document.createElement('p');
    paragraph.className = 'premium-dialog__intro';
    paragraph.textContent = intro;
    const list = document.createElement('ul');
    list.className = 'premium-dialog__facts';
    facts.forEach(([number, text]) => {
      const item = document.createElement('li');
      const mark = document.createElement('span');
      mark.textContent = number;
      const copy = document.createElement('span');
      copy.textContent = text;
      item.append(mark, copy);
      list.append(item);
    });
    content.append(paragraph, list);
    openDialog(title, content);
  }

  function openAlert(item) {
    const fragment = document.createDocumentFragment();
    const intro = document.createElement('p');
    intro.className = 'premium-dialog__intro';
    intro.textContent = t('alertIntro');
    const form = document.createElement('form');
    form.className = 'premium-form';
    form.noValidate = true;

    const grid = document.createElement('div');
    grid.className = 'premium-form__grid';
    const phoneField = field(t('phone'), 'tel', 'phone', '+221', { inputmode: 'tel', autocomplete: 'tel', maxlength: '20' });
    const emailField = field(t('email'), 'email', 'email', 'nom@exemple.com', { autocomplete: 'email', maxlength: '254' });
    grid.append(phoneField.label, emailField.label);

    const target = field(t('targetPrice'), 'number', 'targetPrice', numericPrice(item.price) || '', { inputmode: 'numeric', min: '0', max: '1000000000', step: '5000' });
    const hint = document.createElement('p');
    hint.className = 'premium-form__hint';
    hint.textContent = t('contactHint');
    const status = formStatus();
    const submit = submitButton(t('activateAlert'));

    form.append(grid, target.label, hint, status, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const phone = phoneField.input.value.trim();
      const email = emailField.input.value.trim();
      if (!validPhone(phone) && !validEmail(email)) {
        setFormStatus(status, t('contactRequired'), 'error');
        return;
      }
      setBusy(submit, status, true);
      try {
        await postJson('/api/alerts', {
          offerId: item.isOffer ? item.id : '',
          query: item.title,
          targetPrice: Number(target.input.value || 0),
          phone: validPhone(phone) ? phone : '',
          email: validEmail(email) ? email : '',
          locale: locale(),
        });
        setFormStatus(status, t('alertSuccess'), 'success');
        toast(t('alertSuccess'), 'success');
        setTimeout(closeDialog, 900);
      } catch {
        setFormStatus(status, t('requestFailed'), 'error');
      } finally {
        setBusy(submit, status, false);
      }
    });
    fragment.append(intro, form);
    openDialog(t('alertTitle'), fragment);
    phoneField.input.focus();
  }

  function openReport(item) {
    const fragment = document.createDocumentFragment();
    const intro = document.createElement('p');
    intro.className = 'premium-dialog__intro';
    intro.textContent = t('reportIntro');
    const form = document.createElement('form');
    form.className = 'premium-form';

    const reasonLabel = document.createElement('label');
    reasonLabel.textContent = t('reason');
    const reason = document.createElement('select');
    [
      ['price_outdated', t('reasonPrice')],
      ['unavailable', t('reasonUnavailable')],
      ['wrong_details', t('reasonDetails')],
      ['suspicious', t('reasonSuspicious')],
      ['other', t('reasonOther')],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      reason.append(option);
    });
    reasonLabel.append(reason);

    const detailsLabel = document.createElement('label');
    detailsLabel.textContent = t('detailsLabel');
    const details = document.createElement('textarea');
    details.name = 'details';
    details.maxLength = 500;
    details.placeholder = t('detailsPlaceholder');
    detailsLabel.append(details);

    const status = formStatus();
    const submit = submitButton(t('sendReport'));
    form.append(reasonLabel, detailsLabel, status, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setBusy(submit, status, true);
      try {
        const payload = {
          reason: reason.value,
          details: details.value.trim(),
          pageUrl: item.sourceUrl || location.href,
          locale: locale(),
          query: item.title,
        };
        if (item.isOffer && item.id) payload.offerId = item.id;
        await postJson('/api/feedback', payload);
        setFormStatus(status, t('reportSuccess'), 'success');
        toast(t('reportSuccess'), 'success');
        setTimeout(closeDialog, 900);
      } catch {
        setFormStatus(status, t('requestFailed'), 'error');
      } finally {
        setBusy(submit, status, false);
      }
    });
    fragment.append(intro, form);
    openDialog(t('reportTitle'), fragment);
    reason.focus();
  }

  function field(labelText, type, name, placeholder, attributes = {}) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.placeholder = String(placeholder || '');
    Object.entries(attributes).forEach(([key, value]) => input.setAttribute(key, value));
    label.append(input);
    return { label, input };
  }

  function formStatus() {
    const status = document.createElement('p');
    status.className = 'premium-form__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    return status;
  }

  function submitButton(label) {
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'premium-form__submit';
    button.textContent = label;
    button.dataset.label = label;
    return button;
  }

  function setBusy(button, status, busy) {
    button.disabled = busy;
    button.textContent = busy ? t('sending') : button.dataset.label;
    if (busy) setFormStatus(status, t('sending'), '');
  }

  function setFormStatus(status, message, kind) {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function validPhone(value) {
    if (!value) return false;
    const normalized = value.replace(/[^+\d]/g, '');
    return /^\+?\d{8,15}$/.test(normalized);
  }

  function validEmail(value) {
    return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  }

  function numericPrice(label) {
    const digits = String(label || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  async function postJson(url, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Client-Version': `senecompare-premium-${VERSION}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || value.ok !== true) throw new Error(value.code || 'REQUEST_FAILED');
      return value;
    } finally {
      clearTimeout(timeout);
    }
  }

  function shareWhatsApp(item) {
    const lines = [item.title, item.price, item.seller, item.sourceUrl || location.href].filter(Boolean);
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast(t('shared'));
  }

  function trackClick(item, action) {
    const payload = {
      offerId: item.id,
      action,
      pageUrl: location.href,
      sourceUrl: item.sourceUrl,
      locale: locale(),
    };
    fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Version': `senecompare-premium-${VERSION}` },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  function openDialog(title, content) {
    state.dialogTitle.textContent = title;
    state.dialogBody.replaceChildren(content);
    if (typeof state.dialog.showModal === 'function') state.dialog.showModal();
    else state.dialog.setAttribute('open', '');
  }

  function closeDialog() {
    if (!state.dialog) return;
    if (typeof state.dialog.close === 'function' && state.dialog.open) state.dialog.close();
    else state.dialog.removeAttribute('open');
  }

  function toast(message, kind = '') {
    const node = document.createElement('div');
    node.className = 'premium-toast';
    node.dataset.kind = kind;
    node.textContent = message;
    state.toastRegion.append(node);
    setTimeout(() => node.remove(), 4200);
  }

  function installApplicationSchema() {
    const existing = document.getElementById('senecompareApplicationSchema');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = 'senecompareApplicationSchema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SeneCompare',
      alternateName: 'SeneCompare AI',
      applicationCategory: 'ShoppingApplication',
      operatingSystem: 'Android, iOS, Web',
      inLanguage: ['fr-SN', 'wo-SN'],
      url: 'https://senecompare.dakarstyle.com/',
      description: 'Moteur local de recherche et comparaison de produits et services au Sénégal avec sources visibles.',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://senecompare.dakarstyle.com/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    });
    document.head.append(script);
  }

  function scheduleItemListSchema() {
    clearTimeout(state.schemaTimer);
    state.schemaTimer = setTimeout(refreshItemListSchema, 120);
  }

  function refreshItemListSchema() {
    document.getElementById('senecompareResultsSchema')?.remove();
    const cards = [...document.querySelectorAll(SELECTORS.resultCard)].slice(0, 20);
    if (!cards.length) return;
    const items = cards.map((card, index) => {
      const item = readCard(card);
      const product = {
        '@type': item.isOffer ? 'Product' : 'Thing',
        name: item.title,
        url: item.sourceUrl || location.href,
      };
      const price = numericPrice(item.price);
      if (item.isOffer && price > 0) {
        product.offers = {
          '@type': 'Offer',
          price,
          priceCurrency: 'XOF',
          url: item.sourceUrl || location.href,
          availability: 'https://schema.org/LimitedAvailability',
        };
      }
      return { '@type': 'ListItem', position: index + 1, item: product };
    });
    const script = document.createElement('script');
    script.id = 'senecompareResultsSchema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items });
    document.head.append(script);
  }
})();
