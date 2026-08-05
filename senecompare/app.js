(() => {
  'use strict';

  const VERSION = '5.0.0';
  const STORAGE = {
    locale: 'senecompare.v5.locale',
    favorites: 'senecompare.v5.favorites',
    history: 'senecompare.v5.history',
    session: 'senecompare.v5.session',
  };

  const I18N = {
    fr: {
      history: 'Historique', favorites: 'Favoris', install: 'Installer', eyebrow: 'Le moteur local qui ne vous laisse jamais sans piste',
      heroOne: 'Dites ce que vous cherchez.', heroTwo: 'Nous trouvons où continuer.', heroCopy: 'Prix vérifiés quand ils existent, sources sénégalaises utiles dans tous les autres cas. Écrivez ou parlez naturellement.',
      proofLocal: 'Sources locales', proofTrust: 'Confiance expliquée', proofVoice: 'Français et wolof', proofCompare: 'Comparaison côte à côte',
      installTitle: 'L’application dans votre téléphone', installCopy: 'Légère, rapide et accessible depuis l’écran d’accueil.', installNow: 'Installer maintenant',
      searchKicker: 'Recherche hybride locale', searchTitle: 'Que voulez-vous trouver ?', searchHint: 'Exemple : « Frigo neuf moins de 300 000 F à Dakar »',
      location: 'Ma position', voice: 'Parler', filters: 'Filtres', city: 'Ville', category: 'Catégorie', budget: 'Budget maximum (F CFA)', condition: 'État', sort: 'Trier', searchNow: 'Chercher maintenant', clear: 'Effacer',
      explore: 'Explorer', marketTitle: 'Tout le marché sénégalais', marketCopy: 'Produits, services et besoins du quotidien.', resultsKicker: 'Résultats utiles', resultsTitle: 'Ce que nous avons trouvé', listen: 'Écouter', share: 'Partager',
      stepOne: 'Vous demandez naturellement', stepOneCopy: 'En français, en wolof, au clavier ou par message vocal.', stepTwo: 'Le moteur cherche largement', stepTwoCopy: 'Catalogue, marketplaces et sources locales sont classés ensemble.',
      stepThree: 'Vous gardez la preuve', stepThreeCopy: 'Chaque résultat indique sa source, sa fraîcheur et son niveau de confiance.', stepFour: 'Jamais de page vide', stepFourCopy: 'Sans offre exacte, l’application vous conduit vers les meilleures sources pertinentes.',
      selected: 'sélectionnés', compare: 'Comparer', disclaimer: 'SeneCompare n’est pas le vendeur. Confirmez toujours le prix, l’état, le stock et l’identité du vendeur avant tout paiement.',
      searching: 'Recherche des meilleures offres et sources locales…', found: 'résultats pour', allSenegal: 'Tout le Sénégal', exactOffer: 'Offre avec prix', usefulSource: 'Source à explorer', openOffer: 'Voir l’offre', exploreSource: 'Explorer la source',
      noPrice: 'Prix à vérifier sur la source', confidence: 'Confiance', verifiedToday: 'Vérifié aujourd’hui', verifiedDays: 'Vérifié il y a {days} jours', new: 'Neuf', used: 'Occasion', refurbished: 'Reconditionné',
      recording: 'Appuyez pour arrêter', transcribing: 'Transcription…', microphoneDenied: 'Le microphone est bloqué. Autorisez-le dans les réglages du navigateur.', voiceUnavailable: 'La recherche vocale n’est pas disponible sur ce navigateur.',
      transcriptReady: 'Recherche vocale transcrite.', speechUnavailable: 'La voix humaine est indisponible. Utilisation de la voix du téléphone.', installed: 'SeneCompare est installé.', installReady: 'Installation prête.', copied: 'Lien copié.',
      empty: 'Aucun résultat enregistré.', retry: 'Réessayer', compareMinimum: 'Sélectionnez au moins deux éléments.', compareMaximum: 'Vous pouvez comparer trois éléments au maximum.',
      methodologyTitle: 'Comment SeneCompare classe les résultats', privacyTitle: 'Confidentialité', merchantTitle: 'Référencer mon entreprise', installModalTitle: 'Installer SeneCompare',
    },
    wo: {
      history: 'Lu ñu seetoon', favorites: 'Yi nga bëgg', install: 'Installer', eyebrow: 'Moteur bu dëgg ci Senegaal, du la bàyyi nga amul fenn',
      heroOne: 'Waxal li nga soxla.', heroTwo: 'Nu won la fan nga jëm.', heroCopy: 'Bu njëg bi amee nu won la ko. Bu amul, nu jox la sources yu dëgg ci Senegaal. Bind walla wax ni nga ko bëgge.',
      proofLocal: 'Sources yu dëgg', proofTrust: 'Wóolu bu am leeral', proofVoice: 'Faranse ak wolof', proofCompare: 'Méngale wet ak wet',
      installTitle: 'Application bi ci sa telefon', installCopy: 'Dafay gaaw, néew te nekk ci écran d’accueil.', installNow: 'Installer léegi',
      searchKicker: 'Seet bu xarañ ci Senegaal', searchTitle: 'Lan nga bëgg gis ?', searchHint: 'Misaal : « Frigo bu bees lu yées 300 000 F ci Dakar »',
      location: 'Sama bérab', voice: 'Wax', filters: 'Tànneef', city: 'Dëkk', category: 'Wàll', budget: 'Xaalis bi gën a bare (F CFA)', condition: 'Anam', sort: 'Teg ci ni', searchNow: 'Seet léegi', clear: 'Far',
      explore: 'Seet', marketTitle: 'Jaayukaayu Senegaal gépp', marketCopy: 'Yëf, services ak lu nit ñi di soxla bés bu nekk.', resultsKicker: 'Li nga mën a jëfandikoo', resultsTitle: 'Li nu gis', listen: 'Déglu', share: 'Yónnee',
      stepOne: 'Waxal ni nga ko bëgge', stepOneCopy: 'Ci faranse, wolof, bind walla message vocal.', stepTwo: 'Moteur bi seet fu nekk', stepTwoCopy: 'Catalogue, marketplaces ak sources yu dëgg ñoo bokk ci classement bi.',
      stepThree: 'Yaa yor firnde gi', stepThreeCopy: 'Résultat bu nekk am na source, bésu seet ak wóolu.', stepFour: 'Doo gis xët bu neen', stepFourCopy: 'Bu offre bu wóor amul, application bi dina la yóbbu ci sources yi gën.',
      selected: 'tànn nañu', compare: 'Méngale', disclaimer: 'SeneCompare du jaaykat bi. Dëggal njëg, anam, stock ak kan mooy jaaykat bi bala ngay fay.',
      searching: 'Nu ngi seet offres ak sources yi gën…', found: 'résultats ci', allSenegal: 'Senegaal gépp', exactOffer: 'Offre bu am njëg', usefulSource: 'Source bu am solo', openOffer: 'Gis offre bi', exploreSource: 'Ubbi source bi',
      noPrice: 'Dëggal njëg bi ci source', confidence: 'Wóolu', verifiedToday: 'Seet nañu ko tey', verifiedDays: 'Seet nañu ko am na {days} fan', new: 'Bu bees', used: 'Occasion', refurbished: 'Defaraat',
      recording: 'Bësaat ngir taxaw', transcribing: 'Nu ngi déglu…', microphoneDenied: 'Micro bi tëju na. Ubbi ko ci réglage navigateur bi.', voiceUnavailable: 'Navigateur bii mënu koo jëfandikoo ngir vocal.', transcriptReady: 'Vocal bi leer na.',
      speechUnavailable: 'Kàddu IA bi jàppandi na. Nu jëfandikoo kàddu telefon bi.', installed: 'Installer nañu SeneCompare.', installReady: 'Installation bi pare na.', copied: 'Copier nañu lien bi.', empty: 'Amul dara bu ñu denc.', retry: 'Jéemaatal',
      compareMinimum: 'Tànnal ñaari yëf walla lu ëpp.', compareMaximum: 'Mën nga méngale ñetti yëf rekk.', methodologyTitle: 'Naka la SeneCompare di teg résultats yi', privacyTitle: 'Sutura', merchantTitle: 'Dugal sama entreprise', installModalTitle: 'Installer SeneCompare',
    },
  };

  const CATEGORY = {
    telephone: ['phones', '📱'], phones: ['phones', '📱'], informatique: ['computing', '💻'], computing: ['computing', '💻'],
    electromenager: ['appliances', '❄'], appliances: ['appliances', '❄'], voiture: ['cars', '🚗'], cars: ['cars', '🚗'],
    moto: ['motorcycles', '🏍'], motorcycles: ['motorcycles', '🏍'], mode: ['fashion', '👕'], fashion: ['fashion', '👕'],
    beaute: ['fashion', '✨'], maison: ['home', '🛋'], home: ['home', '🛋'], materiel: ['professional', '🧰'], professional: ['professional', '🧰'],
    coiffure: ['professional', '✂'], livraison: ['professional', '📦'], restauration: ['professional', '🍽'], transport: ['professional', '🚕'],
    immobilier: ['home', '🏠'], artisanat: ['professional', '🔧'], sante: ['professional', '✚'], education: ['professional', '🎓'], finance: ['professional', '◈'], voyage: ['professional', '✈'], general: ['professional', '⌕'],
  };

  const CITIES = [
    ['Dakar', 14.7167, -17.4677], ['Thiès', 14.7910, -16.9256], ['Saint-Louis', 16.0179, -16.4896], ['Mbour', 14.42, -16.96],
    ['Touba', 14.85, -15.8833], ['Kaolack', 14.1652, -16.0758], ['Ziguinchor', 12.5833, -16.2719], ['Louga', 15.6144, -16.2286],
  ];

  const state = {
    locale: localStorage.getItem(STORAGE.locale) === 'wo' ? 'wo' : 'fr',
    session: localStorage.getItem(STORAGE.session) || crypto.randomUUID(),
    results: [], suggestions: [], query: '', filters: {}, compare: new Set(),
    favorites: read(STORAGE.favorites, {}), history: read(STORAGE.history, []),
    installPrompt: null, recording: null, audio: null,
  };
  localStorage.setItem(STORAGE.session, state.session);
  const el = {};

  document.addEventListener('DOMContentLoaded', init, { once: true });

  function init() {
    ['networkBanner','historyButton','favoritesButton','favoritesCount','installButton','heroInstallButton','languageSwitch','searchForm','searchInput','voiceButton','voiceStatus','locationButton','locationLabel','quickQueries','filtersPanel','cityFilter','categoryFilter','maxPriceFilter','conditionFilter','sortFilter','filterCount','submitButton','clearButton','categoryGrid','resultsSection','resultCount','resultsSummary','listenButton','shareButton','searchNotice','suggestionStrip','resultsStatus','resultsGrid','compareBar','compareCount','compareNames','compareButton','clearCompareButton','appModal','modalClose','modalKicker','modalTitle','modalBody','toastRegion'].forEach((id) => { el[id] = document.getElementById(id); });
    bind();
    applyLocale();
    updateFavoritesCount();
    updateNetwork();
    registerServiceWorker();
    restoreUrl();
    if (new URL(location.href).searchParams.get('install') === '1') setTimeout(showInstall, 350);
  }

  function bind() {
    el.searchForm.addEventListener('submit', (event) => { event.preventDefault(); runSearch(el.searchInput.value); });
    el.clearButton.addEventListener('click', clearSearch);
    el.voiceButton.addEventListener('click', toggleVoice);
    el.locationButton.addEventListener('click', locate);
    el.languageSwitch.addEventListener('click', toggleLocale);
    el.installButton.addEventListener('click', showInstall);
    el.heroInstallButton.addEventListener('click', showInstall);
    el.historyButton.addEventListener('click', showHistory);
    el.favoritesButton.addEventListener('click', showFavorites);
    el.listenButton.addEventListener('click', listenResults);
    el.shareButton.addEventListener('click', shareSearch);
    el.compareButton.addEventListener('click', showComparison);
    el.clearCompareButton.addEventListener('click', clearCompare);
    el.modalClose.addEventListener('click', closeModal);
    el.appModal.addEventListener('click', (event) => { if (event.target === el.appModal) closeModal(); });
    el.quickQueries.addEventListener('click', queryButton);
    el.suggestionStrip.addEventListener('click', queryButton);
    el.categoryGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-query]');
      if (!button) return;
      el.categoryFilter.value = button.dataset.category || 'all';
      el.searchInput.value = button.dataset.query || '';
      updateFilterCount();
      el.searchForm.requestSubmit();
    });
    ['cityFilter','categoryFilter','maxPriceFilter','conditionFilter','sortFilter'].forEach((id) => {
      el[id].addEventListener('change', updateFilterCount);
      el[id].addEventListener('input', updateFilterCount);
    });
    document.querySelectorAll('[data-info]').forEach((button) => button.addEventListener('click', () => showInfo(button.dataset.info)));
    window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); state.installPrompt = event; toast(t('installReady'), 'success'); });
    window.addEventListener('appinstalled', () => { state.installPrompt = null; hideInstallButtons(); toast(t('installed'), 'success'); });
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
  }

  function t(key) { return I18N[state.locale]?.[key] || I18N.fr[key] || key; }
  function applyLocale() {
    document.documentElement.lang = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';
    document.querySelectorAll('[data-i18n]').forEach((node) => { const value = t(node.dataset.i18n); if (value) node.textContent = value; });
    el.languageSwitch.textContent = state.locale === 'fr' ? 'WO' : 'FR';
    el.languageSwitch.setAttribute('aria-label', state.locale === 'fr' ? 'Passer en wolof' : 'Passer en français');
  }
  function toggleLocale() { state.locale = state.locale === 'fr' ? 'wo' : 'fr'; localStorage.setItem(STORAGE.locale, state.locale); applyLocale(); if (state.results.length) renderResults(); }

  function filters() {
    return { city: el.cityFilter.value, category: el.categoryFilter.value, maxPrice: Number(el.maxPriceFilter.value || 0), condition: el.conditionFilter.value, sort: el.sortFilter.value };
  }

  async function runSearch(query, options = {}) {
    query = String(query || '').trim();
    if (query.length < 2) { el.searchInput.focus(); return; }
    state.query = query;
    state.filters = filters();
    el.resultsSection.hidden = false;
    if (!options.silent) el.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loading(true);
    syncUrl();
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-client-version': `senecompare-web-${VERSION}` },
        body: JSON.stringify({ query, ...state.filters, language: state.locale, session_id: state.session }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.code || 'SEARCH_FAILED');
      state.results = (Array.isArray(payload.results) ? payload.results : []).map(normalizeResult).filter(Boolean);
      state.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions.slice(0, 6) : [];
      state.meta = payload.meta || {};
      addHistory(query, state.filters, state.results.length);
      renderResults();
    } catch (error) {
      console.error('search', error);
      renderError();
    } finally { loading(false); }
  }

  function normalizeResult(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const internalCategory = String(raw.category || 'general');
    const mapped = CATEGORY[internalCategory] || CATEGORY.general;
    const amount = Number(raw.total_fcfa ?? raw.price_fcfa ?? raw.price ?? 0) || 0;
    const resultType = String(raw.result_type || raw.resultType || (amount ? 'offer' : 'source'));
    const confidence = Math.max(0, Math.min(100, Math.round(Number(raw.confidence ?? raw.trust?.score ?? 0) || 0)));
    const verifiedAt = raw.verified_at || raw.verifiedAt || new Date().toISOString();
    const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(verifiedAt)) / 86400000)) || 0;
    return {
      id: String(raw.id || raw.source_url || crypto.randomUUID()), title: String(raw.title || raw.product_name || 'Résultat'),
      seller: String(raw.seller_name || raw.seller || raw.source_name || 'Source locale'), sourceName: String(raw.source_name || raw.sourceName || raw.seller_name || 'Source locale'),
      sourceUrl: safeUrl(raw.source_url || raw.sourceUrl), sourceDomain: String(raw.source_domain || ''), resultType,
      amount, priceLabel: String(raw.price_label || raw.priceLabel || (amount ? money(amount) : t('noPrice'))),
      city: String(raw.location || raw.city || 'Sénégal'), condition: String(raw.condition || ''), description: String(raw.snippet || raw.description || raw.availability || ''),
      category: mapped[0], icon: mapped[1], confidence, ageDays, matchLevel: String(raw.match_level || ''), sourceKind: String(raw.source_kind || ''),
      budgetStatus: String(raw.budget_status || ''), actionLabel: String(raw.action_label || (resultType === 'source' ? t('exploreSource') : t('openOffer'))), raw,
    };
  }

  function renderResults() {
    el.resultCount.textContent = String(state.results.length);
    el.resultsSummary.textContent = `${state.results.length} ${t('found')} « ${state.query} » · ${state.filters.city === 'Sénégal' ? t('allSenegal') : state.filters.city}`;
    el.resultsGrid.innerHTML = '';
    const notice = state.locale === 'wo' ? state.meta?.notice_wo : state.meta?.notice_fr;
    el.searchNotice.hidden = !notice;
    el.searchNotice.textContent = notice || '';
    renderSuggestions();
    if (!state.results.length) {
      el.resultsGrid.innerHTML = `<div class="empty-state"><div style="font-size:34px">⌕</div><h3>${escape(t('empty'))}</h3><button class="primary-button" type="button" id="retryButton">${escape(t('retry'))}</button></div>`;
      document.getElementById('retryButton')?.addEventListener('click', () => runSearch(state.query));
      return;
    }
    const fragment = document.createDocumentFragment();
    state.results.forEach((result) => fragment.appendChild(card(result)));
    el.resultsGrid.appendChild(fragment);
  }

  function card(result) {
    const article = document.createElement('article');
    article.className = `result-card ${result.resultType === 'source' ? 'is-source' : 'is-offer'}`;
    article.dataset.id = result.id;
    const trustClass = result.confidence >= 75 ? 'high' : result.confidence >= 50 ? 'medium' : 'low';
    const favorite = Boolean(state.favorites[result.id]);
    article.innerHTML = `
      <div class="result-top"><span class="result-type">${result.resultType === 'source' ? '⌘ ' + escape(t('usefulSource')) : '✓ ' + escape(t('exactOffer'))}</span><button class="favorite-button ${favorite ? 'is-active' : ''}" type="button" aria-label="Favori">${favorite ? '♥' : '♡'}</button></div>
      <input class="compare-toggle" type="checkbox" aria-label="Comparer" ${state.compare.has(result.id) ? 'checked' : ''}>
      <div class="result-body"><h3>${escape(result.title)}</h3><p class="result-seller">${escape(result.seller)}${result.sourceDomain ? ' · ' + escape(result.sourceDomain) : ''}</p><div class="result-price">${escape(result.priceLabel)}</div><p class="result-description">${escape(result.description)}</p><div class="result-meta"><span>⌖ ${escape(result.city)}</span>${result.condition ? `<span>${escape(conditionLabel(result.condition))}</span>` : ''}${result.budgetStatus === 'within' ? '<span>✓ Budget</span>' : ''}</div><div class="trust-line"><span>${escape(freshness(result.ageDays))}</span><span class="trust-score ${trustClass}">${escape(t('confidence'))} ${result.confidence}/100</span></div></div>
      <div class="result-actions"><a href="${escapeAttr(result.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer">${escape(result.actionLabel)}</a><button class="share-result" type="button" aria-label="Partager">↗</button></div>`;
    article.querySelector('.favorite-button').addEventListener('click', (event) => toggleFavorite(result, event.currentTarget));
    article.querySelector('.compare-toggle').addEventListener('change', (event) => toggleCompare(result, event.currentTarget));
    article.querySelector('.share-result').addEventListener('click', () => shareResult(result));
    if (!result.sourceUrl) article.querySelector('.result-actions a').setAttribute('aria-disabled', 'true');
    return article;
  }

  function renderSuggestions() {
    el.suggestionStrip.innerHTML = '';
    el.suggestionStrip.hidden = !state.suggestions.length;
    state.suggestions.forEach((query) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.query = query; button.textContent = query; el.suggestionStrip.appendChild(button);
    });
  }

  function loading(active) {
    el.submitButton.disabled = active;
    el.resultsStatus.textContent = active ? t('searching') : '';
    if (active) el.resultsGrid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');
  }
  function renderError() { el.resultsGrid.innerHTML = `<div class="error-state"><div style="font-size:34px">!</div><h3>Recherche momentanément indisponible</h3><button class="primary-button" type="button" id="retryButton">${escape(t('retry'))}</button></div>`; document.getElementById('retryButton')?.addEventListener('click', () => runSearch(state.query)); }

  function queryButton(event) { const button = event.target.closest('[data-query]'); if (!button) return; el.searchInput.value = button.dataset.query || ''; el.searchInput.focus(); if (event.currentTarget === el.suggestionStrip) el.searchForm.requestSubmit(); }
  function clearSearch() { el.searchInput.value = ''; el.maxPriceFilter.value = ''; el.categoryFilter.value = 'all'; el.conditionFilter.value = 'all'; el.cityFilter.value = 'Sénégal'; state.results = []; state.query = ''; el.resultsSection.hidden = true; history.replaceState(null, '', location.pathname); updateFilterCount(); el.searchInput.focus(); }
  function updateFilterCount() { const count = [el.cityFilter.value !== 'Sénégal', el.categoryFilter.value !== 'all', Number(el.maxPriceFilter.value) > 0, el.conditionFilter.value !== 'all', el.sortFilter.value !== 'relevance'].filter(Boolean).length; el.filterCount.hidden = count === 0; el.filterCount.textContent = String(count); }

  async function toggleVoice() {
    if (state.recording) { state.recording.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { browserRecognition(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener('stop', async () => {
        stream.getTracks().forEach((track) => track.stop()); state.recording = null; el.voiceButton.classList.remove('is-recording'); el.voiceStatus.textContent = t('transcribing');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        await transcribe(blob);
        el.voiceStatus.textContent = t('voice');
      }, { once: true });
      state.recording = recorder; recorder.start(250); el.voiceButton.classList.add('is-recording'); el.voiceStatus.textContent = t('recording');
      setTimeout(() => { if (state.recording?.state === 'recording') state.recording.stop(); }, 12000);
    } catch (error) { console.error(error); toast(t('microphoneDenied')); }
  }

  async function transcribe(blob) {
    try {
      const form = new FormData(); form.set('audio', blob, blob.type.includes('mp4') ? 'recherche.m4a' : 'recherche.webm'); form.set('language', state.locale);
      const response = await fetch('/api/voice/transcribe', { method: 'POST', headers: { 'x-client-version': `senecompare-web-${VERSION}` }, body: form });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.text) throw new Error(payload.code || 'TRANSCRIPTION_FAILED');
      el.searchInput.value = payload.text; toast(t('transcriptReady'), 'success'); el.searchForm.requestSubmit();
    } catch (error) { console.error(error); browserRecognition(); }
  }

  function browserRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast(t('voiceUnavailable')); return; }
    const recognition = new Recognition(); recognition.lang = state.locale === 'wo' ? 'fr-SN' : 'fr-SN'; recognition.interimResults = false; recognition.maxAlternatives = 3;
    el.voiceButton.classList.add('is-recording'); el.voiceStatus.textContent = t('recording');
    recognition.onresult = (event) => { el.searchInput.value = event.results[0][0].transcript; el.searchForm.requestSubmit(); };
    recognition.onerror = () => toast(t('microphoneDenied'));
    recognition.onend = () => { el.voiceButton.classList.remove('is-recording'); el.voiceStatus.textContent = t('voice'); };
    recognition.start();
  }

  async function listenResults() {
    if (!state.results.length) return;
    const concrete = state.results.filter((result) => result.amount > 0);
    const lowest = concrete.sort((a,b) => a.amount - b.amount)[0];
    const text = state.locale === 'wo'
      ? `${state.results.length} résultats lañu gis ci ${state.query}. ${lowest ? `Njëg bi gën a suuf mooy ${money(lowest.amount)} ci ${lowest.seller}.` : 'Ubbi source yi ngir gis njëg ak disponibilité.'}`
      : `${state.results.length} résultats trouvés pour ${state.query}. ${lowest ? `Le prix le plus bas est ${money(lowest.amount)} chez ${lowest.seller}.` : 'Ouvrez les sources proposées pour vérifier les prix et la disponibilité.'}`;
    try {
      el.listenButton.disabled = true;
      const response = await fetch('/api/voice/speech', { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-version': `senecompare-web-${VERSION}` }, body: JSON.stringify({ text, language: state.locale }) });
      if (!response.ok) throw new Error('SPEECH_FAILED');
      if (state.audio) { state.audio.pause(); URL.revokeObjectURL(state.audio.src); }
      state.audio = new Audio(URL.createObjectURL(await response.blob()));
      await state.audio.play();
    } catch (error) { console.error(error); toast(t('speechUnavailable')); speechFallback(text); }
    finally { el.listenButton.disabled = false; }
  }
  function speechFallback(text) { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'fr-SN'; utterance.rate = .94; speechSynthesis.speak(utterance); }

  async function locate() {
    if (!navigator.geolocation) return;
    el.locationLabel.textContent = '…';
    navigator.geolocation.getCurrentPosition((position) => {
      const nearest = CITIES.map(([name,lat,lon]) => [name, distance(position.coords.latitude, position.coords.longitude, lat, lon)]).sort((a,b) => a[1]-b[1])[0];
      el.cityFilter.value = nearest?.[0] || 'Dakar'; el.locationLabel.textContent = el.cityFilter.value; updateFilterCount();
    }, () => { el.locationLabel.textContent = t('location'); toast(t('microphoneDenied')); }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
  }
  function distance(a,b,c,d) { const R=6371, p=Math.PI/180, x=(c-a)*p, y=(d-b)*p; const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }

  function toggleFavorite(result, button) { if (state.favorites[result.id]) { delete state.favorites[result.id]; button.textContent='♡'; button.classList.remove('is-active'); } else { state.favorites[result.id]=result; button.textContent='♥'; button.classList.add('is-active'); } write(STORAGE.favorites,state.favorites); updateFavoritesCount(); }
  function updateFavoritesCount() { const count=Object.keys(state.favorites).length; el.favoritesCount.hidden=!count; el.favoritesCount.textContent=String(count); }
  function showFavorites() { const values=Object.values(state.favorites); openModal('Favoris', t('favorites'), values.length ? `<div class="favorite-list">${values.map((item)=>`<div class="favorite-item"><span><b>${escape(item.title)}</b><br><small>${escape(item.priceLabel)}</small></span><button data-favorite-open="${escapeAttr(item.id)}">Ouvrir</button></div>`).join('')}</div>` : `<p>${escape(t('empty'))}</p>`); el.modalBody.querySelectorAll('[data-favorite-open]').forEach((button)=>button.addEventListener('click',()=>{const item=state.favorites[button.dataset.favoriteOpen]; if(item?.sourceUrl) window.open(item.sourceUrl,'_blank','noopener');})); }
  function addHistory(query, searchFilters, count) { state.history=state.history.filter((item)=>item.query!==query); state.history.unshift({query,filters:searchFilters,count,at:new Date().toISOString()}); state.history=state.history.slice(0,20); write(STORAGE.history,state.history); }
  function showHistory() { openModal('Historique',t('history'),state.history.length?`<div class="history-list">${state.history.map((item,index)=>`<div class="history-item"><span><b>${escape(item.query)}</b><br><small>${item.count} résultat(s)</small></span><button data-history="${index}">Relancer</button></div>`).join('')}</div>`:`<p>${escape(t('empty'))}</p>`); el.modalBody.querySelectorAll('[data-history]').forEach((button)=>button.addEventListener('click',()=>{const item=state.history[Number(button.dataset.history)]; closeModal(); el.searchInput.value=item.query; Object.assign(state.filters,item.filters||{}); runSearch(item.query);})); }

  function toggleCompare(result, checkbox) { if (checkbox.checked && state.compare.size>=3) { checkbox.checked=false; toast(t('compareMaximum')); return; } checkbox.checked?state.compare.add(result.id):state.compare.delete(result.id); updateCompare(); }
  function updateCompare() { const values=state.results.filter((item)=>state.compare.has(item.id)); el.compareBar.hidden=!values.length; el.compareCount.textContent=String(values.length); el.compareNames.textContent=values.map((item)=>item.title).join(' · '); }
  function clearCompare() { state.compare.clear(); document.querySelectorAll('.compare-toggle').forEach((input)=>{input.checked=false;}); updateCompare(); }
  function showComparison() { const values=state.results.filter((item)=>state.compare.has(item.id)); if(values.length<2){toast(t('compareMinimum'));return;} const rows=[['Prix',...values.map((v)=>v.priceLabel)],['Source',...values.map((v)=>v.sourceName)],['Lieu',...values.map((v)=>v.city)],['Confiance',...values.map((v)=>`${v.confidence}/100`)],['Accès',...values.map((v)=>`<a href="${escapeAttr(v.sourceUrl)}" target="_blank" rel="noopener">Ouvrir</a>`)]]; openModal('Comparaison',t('compare'),`<div class="compare-table" style="--compare-columns:${values.length}">${rows.map((row)=>`<div class="compare-row">${row.map((cell,index)=>index?`<div>${cell}</div>`:`<strong>${cell}</strong>`).join('')}</div>`).join('')}</div>`); }

  async function shareResult(result) { await share({ title: result.title, text: `${result.title}\n${result.priceLabel}\n${result.sourceName}`, url: result.sourceUrl || location.href }); }
  async function shareSearch() { const url=new URL(location.href); url.searchParams.set('q',state.query); await share({title:'SeneCompare AI',text:`${state.query} — ${state.results.length} résultats`,url:url.toString()}); }
  async function share(data) { try { if(navigator.share){await navigator.share(data);return;} await navigator.clipboard.writeText(`${data.text}\n${data.url}`); toast(t('copied'),'success'); } catch(error){ if(error?.name!=='AbortError') window.open(`https://wa.me/?text=${encodeURIComponent(`${data.text}\n${data.url}`)}`,'_blank','noopener'); } }

  async function showInstall() {
    if (isStandalone()) { toast(t('installed'),'success'); return; }
    if (state.installPrompt) { state.installPrompt.prompt(); const choice=await state.installPrompt.userChoice; if(choice.outcome==='accepted') hideInstallButtons(); state.installPrompt=null; return; }
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent); const android=/android/i.test(navigator.userAgent);
    const body=ios
      ? `<p>Sur iPhone ou iPad, ouvrez cette page dans <b>Safari</b>.</p><ol class="install-steps"><li>Appuyez sur le bouton <b>Partager</b> de Safari.</li><li>Choisissez <b>Sur l’écran d’accueil</b>.</li><li>Appuyez sur <b>Ajouter</b>.</li></ol>`
      : android
        ? `<p>Dans Chrome, Samsung Internet, Edge ou Brave :</p><ol class="install-steps"><li>Ouvrez le menu du navigateur.</li><li>Choisissez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</li><li>Confirmez l’installation.</li></ol>`
        : `<p>Ouvrez le menu de votre navigateur et choisissez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</p><ol class="install-steps"><li>Gardez cette page ouverte.</li><li>Ouvrez le menu principal du navigateur.</li><li>Choisissez l’option d’installation.</li></ol>`;
    openModal('Application',t('installModalTitle'),body+`<button class="modal-action" id="copyInstallLink">Copier le lien d’installation</button>`);
    document.getElementById('copyInstallLink')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(`${location.origin}/?install=1`);toast(t('copied'),'success');});
  }
  function isStandalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
  function hideInstallButtons(){el.installButton.hidden=true;el.heroInstallButton.closest('.install-card').hidden=true;}

  function showInfo(type) {
    if(type==='methodology') openModal('Transparence',t('methodologyTitle'),'<p>Le moteur classe d’abord les offres avec prix et source publique, puis les sources sénégalaises les plus pertinentes. La confiance dépend de la qualité de la source, de la fraîcheur, de la correspondance avec la demande et de la présence d’un prix vérifiable.</p><p>Une carte « source à explorer » n’invente jamais de prix : elle vous conduit vers une marketplace, un marchand ou un annuaire pertinent.</p>');
    else if(type==='privacy') openModal('Données',t('privacyTitle'),'<p>Les favoris et l’historique restent dans votre appareil. La géolocalisation n’est demandée qu’après votre action. Les enregistrements vocaux sont envoyés uniquement pour transcription et ne sont pas conservés par SeneCompare.</p>');
    else { openModal('Marchands',t('merchantTitle'),'<form id="merchantForm"><label>Entreprise<input name="businessName" required maxlength="160"></label><label>Téléphone<input name="phone" required inputmode="tel"></label><label>Nom du responsable<input name="contactName" maxlength="160"></label><label>Message<textarea name="message" maxlength="800"></textarea></label><button class="modal-action" type="submit">Envoyer la demande</button></form>'); const form=document.getElementById('merchantForm'); form?.addEventListener('submit',submitMerchant); }
  }
  async function submitMerchant(event){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{const response=await fetch('/api/merchant/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw new Error();closeModal();toast('Demande reçue.','success');}catch{toast('Envoi impossible. Réessayez.');}}

  function openModal(kicker,title,html){el.modalKicker.textContent=kicker;el.modalTitle.textContent=title;el.modalBody.innerHTML=html;if(typeof el.appModal.showModal==='function')el.appModal.showModal();else el.appModal.setAttribute('open','');}
  function closeModal(){if(typeof el.appModal.close==='function')el.appModal.close();else el.appModal.removeAttribute('open');}
  function toast(message,type=''){const node=document.createElement('div');node.className=`toast ${type}`;node.textContent=message;el.toastRegion.appendChild(node);setTimeout(()=>node.remove(),4200);}

  function syncUrl(){const url=new URL(location.href);url.searchParams.set('q',state.query);if(state.filters.category!=='all')url.searchParams.set('category',state.filters.category);else url.searchParams.delete('category');history.replaceState(null,'',url);}
  function restoreUrl(){const url=new URL(location.href);const query=url.searchParams.get('q');const category=url.searchParams.get('category');if(category&&[...el.categoryFilter.options].some((option)=>option.value===category))el.categoryFilter.value=category;if(query){el.searchInput.value=query;runSearch(query,{silent:true});}}
  function updateNetwork(){el.networkBanner.hidden=navigator.onLine;}
  function registerServiceWorker(){if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(`/sw.js?v=${VERSION}`,{scope:'/',updateViaCache:'none'}).then((registration)=>registration.update()).catch(console.error),{once:true});if(isStandalone())hideInstallButtons();}

  function conditionLabel(value){return t(value)||value;}
  function freshness(days){return days<=0?t('verifiedToday'):t('verifiedDays').replace('{days}',String(days));}
  function money(value){return `${new Intl.NumberFormat('fr-FR').format(Number(value)||0)} F CFA`;}
  function safeUrl(value){try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)?url.toString():'';}catch{return '';}}
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch{return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* storage unavailable */}}
  function escape(value){return String(value??'').replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
  function escapeAttr(value){return escape(value);}
})();
