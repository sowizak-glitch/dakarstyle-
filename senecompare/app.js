(() => {
  'use strict';

  const VERSION = '4.0.0';
  const STORAGE = {
    locale: 'senecompare.locale',
    favorites: 'senecompare.favorites.v1',
    history: 'senecompare.history.v1',
    alerts: 'senecompare.alerts.v1',
  };

  const CITY_COORDINATES = [
    { name: 'Dakar', lat: 14.7167, lon: -17.4677 },
    { name: 'Thiès', lat: 14.7910, lon: -16.9256 },
    { name: 'Saint-Louis', lat: 16.0179, lon: -16.4896 },
    { name: 'Mbour', lat: 14.4200, lon: -16.9600 },
    { name: 'Touba', lat: 14.8500, lon: -15.8833 },
    { name: 'Kaolack', lat: 14.1652, lon: -16.0758 },
    { name: 'Ziguinchor', lat: 12.5833, lon: -16.2719 },
    { name: 'Louga', lat: 15.6144, lon: -16.2286 },
  ];

  const CATEGORY_META = {
    phones: { icon: '📱', fr: 'Téléphones', wo: 'Telefon' },
    cars: { icon: '🚗', fr: 'Voitures', wo: 'Woto' },
    motorcycles: { icon: '🏍️', fr: 'Motos', wo: 'Moto' },
    appliances: { icon: '🧊', fr: 'Électroménager', wo: 'Jumtukaay kër' },
    computing: { icon: '💻', fr: 'Informatique', wo: 'Ordinateur' },
    fashion: { icon: '👕', fr: 'Mode', wo: 'Yére' },
    home: { icon: '🛋️', fr: 'Maison', wo: 'Kër' },
    professional: { icon: '🧰', fr: 'Matériel pro', wo: 'Jumtukaay liggéey' },
  };

  const TRANSLATIONS = {
    fr: {
      brandTagline: 'Waxal · Méngale · Tànn', history: 'Historique', favorites: 'Favoris', eyebrow: 'Comparateur local intelligent',
      heroTitleOne: 'Dites ce que vous cherchez.', heroTitleTwo: 'Nous comparons pour vous.',
      heroCopy: 'Produit, budget, état ou ville : écrivez comme vous parlez. Les sources, la fraîcheur et la confiance restent visibles.',
      proofFree: 'Gratuit', proofSources: 'Sources visibles', proofVoice: 'Texte ou vocal', proofCompare: 'Comparaison côte à côte',
      searchKicker: 'Recherche intelligente', searchTitle: 'Que voulez-vous comparer ?', searchHint: 'Exemple : « Samsung moins de 150 000 F à Dakar »',
      location: 'Ma position', searchLabel: 'Votre recherche', voice: 'Vocal', filters: 'Filtres', city: 'Ville', category: 'Catégorie',
      budget: 'Budget maximum (F CFA)', condition: 'État', sellerType: 'Vendeur', sort: 'Trier par', compareNow: 'Comparer maintenant', clear: 'Effacer',
      exploreKicker: 'Explorer', categoriesTitle: 'Le marché sénégalais', categoriesCopy: 'Choisissez une famille pour lancer une recherche rapide.',
      phones: 'Téléphones', cars: 'Voitures', motorcycles: 'Motos', appliances: 'Électroménager', computing: 'Informatique', fashion: 'Mode', home: 'Maison', professional: 'Matériel pro',
      resultsKicker: 'Résultats comparés', offersFound: 'Offres trouvées', listen: 'Écouter', share: 'Partager',
      demoTitle: 'Catalogue de démarrage', demoCopy: 'Ces offres servent à tester le comparateur. Les prix doivent être confirmés. Connectez Supabase ou le moteur de recherche pour les données en direct.',
      howKicker: 'Simple et transparent', howTitle: 'Vous gardez le contrôle', stepOneTitle: 'Vous demandez', stepOneCopy: 'En français, en wolof, par écrit ou par voix.',
      stepTwoTitle: 'L’agent compare', stepTwoCopy: 'Prix, ville, état, sources et date de vérification.', stepThreeTitle: 'Vous vérifiez', stepThreeCopy: 'La confiance est expliquée, pas inventée.',
      stepFourTitle: 'Vous décidez', stepFourCopy: 'Comparez jusqu’à trois offres et partagez sur WhatsApp.',
      trustKicker: 'Méthode de confiance', trustTitle: 'Chaque score doit pouvoir être expliqué.', trustCopy: 'Nous combinons la fraîcheur, le nombre de recoupements, l’identité du vendeur et la cohérence du prix. Une offre faible reste visible, mais clairement signalée.',
      methodologyLink: 'Voir la méthodologie complète', exampleTrust: 'Exemple de confiance', freshness: 'Fraîcheur', crossChecks: 'Recoupements', sellerIdentity: 'Identité vendeur', consistency: 'Cohérence du prix',
      merchantKicker: 'Espace marchand', merchantTitle: 'Votre entreprise apparaît dans les résultats ?', merchantCopy: 'Revendiquez votre fiche, corrigez vos informations et faites vérifier vos offres.', claimListing: 'Revendiquer une fiche',
      selected: 'sélectionnées', compareSelection: 'Comparer la sélection', footerTagline: 'Comparez mieux. Décidez librement.', methodology: 'Méthodologie', privacy: 'Confidentialité', merchantArea: 'Espace marchand',
      disclaimer: 'SeneCompare n’est pas le vendeur. Confirmez toujours le prix, l’état, la garantie, le stock et l’identité du vendeur avant tout paiement.',
      compare: 'Comparer', source: 'Source', viewSource: 'Voir la source', reportPrice: 'Prix incorrect ?', priceAlert: 'Suivre le prix',
      new: 'Neuf', used: 'Occasion', refurbished: 'Reconditionné', merchant: 'Professionnel', individual: 'Particulier',
      high: 'Élevée', medium: 'Moyenne', low: 'Faible', confidence: 'Confiance', confirm: 'Prix à confirmer', verified: 'Offre vérifiée', stale: 'Offre ancienne',
      searching: 'Recherche et classement des offres…', noResultsTitle: 'Aucune offre correspondante', noResultsCopy: 'Élargissez votre ville, votre budget ou essayez une formulation plus simple.',
      errorTitle: 'Recherche indisponible', errorCopy: 'Une erreur temporaire empêche d’afficher les résultats. Réessayez.',
      resultsFor: 'résultats pour', allSenegal: 'Tout le Sénégal', listening: 'Je vous écoute…', voiceUnsupported: 'La reconnaissance vocale n’est pas disponible dans ce navigateur.',
      voiceDenied: 'Le microphone est bloqué. Autorisez-le dans les réglages du navigateur.', locationSearching: 'Localisation…', locationDenied: 'La position n’a pas été autorisée.',
      locationFound: 'Ville détectée', verifiedToday: 'Vérifié aujourd’hui', verifiedYesterday: 'Vérifié hier', verifiedDays: 'Vérifié il y a {days} jours',
      budgetWithin: 'Dans votre budget', budgetOver: '+{amount} F au-dessus', addedFavorite: 'Ajouté aux favoris', removedFavorite: 'Retiré des favoris',
      compareLimit: 'Vous pouvez comparer trois offres au maximum.', chooseTwo: 'Sélectionnez au moins deux offres.', copied: 'Lien copié.', shareTitle: 'Comparaison SeneCompare',
      reportTitle: 'Signaler une offre', reportKicker: 'Qualité des données', reportIntro: 'Votre signalement aide à retirer les prix faux ou obsolètes.',
      reportReason: 'Motif', reportDetails: 'Détails facultatifs', sendReport: 'Envoyer le signalement', reportSent: 'Merci. Le signalement sera vérifié.',
      alertTitle: 'Suivre le prix', alertKicker: 'Alerte prix', targetPrice: 'Prix cible (F CFA)', phone: 'Téléphone', email: 'E-mail', saveAlert: 'Enregistrer l’alerte', alertSaved: 'Alerte enregistrée.',
      merchantFormTitle: 'Revendiquer une fiche marchand', merchantFormKicker: 'Vérification entreprise', businessName: 'Nom de l’entreprise', contactName: 'Nom du responsable', message: 'Précisions', submitClaim: 'Envoyer la demande', claimSent: 'Demande reçue. Une vérification manuelle sera effectuée.',
      methodologyTitle: 'Méthodologie de confiance', methodologyKicker: 'Transparence', privacyTitle: 'Politique de confidentialité', privacyKicker: 'Données personnelles',
      favoritesTitle: 'Vos favoris', favoritesKicker: 'Sauvegardés sur cet appareil', historyTitle: 'Historique de recherche', historyKicker: 'Recherches récentes', emptyFavorites: 'Aucun favori pour le moment.', emptyHistory: 'Aucune recherche enregistrée.',
      clearHistory: 'Effacer l’historique', openSearch: 'Relancer', remove: 'Supprimer', compareTitle: 'Comparaison côte à côte', compareKicker: 'Aide à la décision',
      price: 'Prix', seller: 'Vendeur', trust: 'Confiance', status: 'Statut', description: 'Détails', dataSource: 'Source de données',
      dataLive: 'Données connectées', dataDemo: 'Catalogue de démarrage', localAlertNote: 'Vos préférences sont aussi conservées localement sur cet appareil. Les notifications automatiques nécessitent la connexion du service d’envoi.',
      requiredFields: 'Remplissez les champs obligatoires.', invalidContact: 'Ajoutez un téléphone ou un e-mail valide.', sendFailed: 'L’envoi a échoué. Réessayez.',
      speechSummary: '{count} offres trouvées. Le prix le plus bas est {price}.', installReady: 'SeneCompare peut être installé depuis le menu du navigateur.',
    },
    wo: {
      brandTagline: 'Waxal · Méngale · Tànn', history: 'Lu ñu seetoon', favorites: 'Yi nga bëgg', eyebrow: 'Jumtukaay méngale njëg ci Senegaal',
      heroTitleOne: 'Waxal li nga soxla.', heroTitleTwo: 'Nu méngale ko ngir yaw.',
      heroCopy: 'Waxal jumtukaay bi, sa xaalis, anam wi walla dëkk bi. Nu won la njëg, bésu seet bi ak wóolu gi.',
      proofFree: 'Dara du fay', proofSources: 'Gis fan la jóge', proofVoice: 'Bind walla wax', proofCompare: 'Méngale wet ak wet',
      searchKicker: 'Seet bu xarañ', searchTitle: 'Lan nga bëgg méngale ?', searchHint: 'Misaal : « Samsung lu yées 150 000 F ci Dakar »',
      location: 'Sama bérab', searchLabel: 'Li nga seet', voice: 'Wax', filters: 'Tànneef', city: 'Dëkk', category: 'Wàll',
      budget: 'Xaalis bi gën a bare (F CFA)', condition: 'Anam', sellerType: 'Jaaykat', sort: 'Teg ci ni', compareNow: 'Méngale léegi', clear: 'Far',
      exploreKicker: 'Seet', categoriesTitle: 'Jaayukaayu Senegaal', categoriesCopy: 'Tànnal wàll ngir tàmbali seet bi.',
      phones: 'Telefon', cars: 'Woto', motorcycles: 'Moto', appliances: 'Jumtukaay kër', computing: 'Ordinateur', fashion: 'Yére', home: 'Kër', professional: 'Jumtukaay liggéey',
      resultsKicker: 'Li ñu méngale', offersFound: 'Li ñu gis', listen: 'Déglu', share: 'Yónnee',
      demoTitle: 'Catalogue bu njëkk', demoCopy: 'Yii ay misaal lañu ngir jéem jumtukaay bi. War nga dëggal njëg yi. Jokkoo ak Supabase walla moteur bi ngir ay xibaar yu bees.',
      howKicker: 'Yomb te leer', howTitle: 'Yaw yaa yor dogal bi', stepOneTitle: 'Yaa laaj', stepOneCopy: 'Ci faranse, wolof, bind walla wax.',
      stepTwoTitle: 'Agent bi méngale', stepTwoCopy: 'Njëg, dëkk, anam, fan la jóge ak bésu seet bi.', stepThreeTitle: 'Yaa seet', stepThreeCopy: 'Wóolu gi am na leeral, du lim bu ñu sos.',
      stepFourTitle: 'Yaa tànn', stepFourCopy: 'Méngale ñetti yëf te yónnee ko ci WhatsApp.',
      trustKicker: 'Naka la wóolu gi juddoo', trustTitle: 'Lim bu nekk war na am leeral.', trustCopy: 'Nu boole bésu seet bi, ñaata yoon lañu ko dëggal, kan mooy jaaykat bi ak ndax njëg bi méngoo na ak yeneen.',
      methodologyLink: 'Gis leeral bi yépp', exampleTrust: 'Misaalu wóolu', freshness: 'Bees gi', crossChecks: 'Dëggal yi', sellerIdentity: 'Kan mooy jaaykat bi', consistency: 'Njëg bi méngoo na',
      merchantKicker: 'Jaaykat yi', merchantTitle: 'Sa entreprise nekk na ci li ñu gis ?', merchantCopy: 'Jëlal sa xët, jubanti xibaar yi te wut dëggal.', claimListing: 'Jël sama xët',
      selected: 'tànn nañu', compareSelection: 'Méngale yi ñu tànn', footerTagline: 'Méngale bu baax. Tànn sa bopp.', methodology: 'Naka lañu xayma', privacy: 'Sutura', merchantArea: 'Jaaykat yi',
      disclaimer: 'SeneCompare du jaaykat bi. Dëggal njëg, anam, garantie, stock ak kan mooy jaaykat bi bala ngay fay.',
      compare: 'Méngale', source: 'Fan la jóge', viewSource: 'Gis source bi', reportPrice: 'Njëg bi baaxul ?', priceAlert: 'Topp njëg bi',
      new: 'Ku bees', used: 'Occasion', refurbished: 'Defaraat', merchant: 'Professionnel', individual: 'Nit',
      high: 'Kawe', medium: 'Digg', low: 'Suuf', confidence: 'Wóolu', confirm: 'Dëggal njëg bi', verified: 'Dëggal nañu ko', stale: 'Xibaar yi yàgg nañu',
      searching: 'Nu ngi seet te teg yi gën…', noResultsTitle: 'Dara méngoo ak li nga laaj', noResultsCopy: 'Yaatal dëkk bi, xaalis bi walla wax ko bu gën a yomb.',
      errorTitle: 'Seet bi jàppandi na', errorCopy: 'Am na njuumte bu néew. Jéemaatal.',
      resultsFor: 'li ñu gis ci', allSenegal: 'Senegaal gépp', listening: 'Maa ngi lay déglu…', voiceUnsupported: 'Navigateur bii mënu koo déglu.',
      voiceDenied: 'Micro bi tëju na. Ubbi ko ci réglage navigateur bi.', locationSearching: 'Nu ngi seet sa bérab…', locationDenied: 'Joxuloo ndigal ngir gis bérab bi.',
      locationFound: 'Dëkk bi ñu gis', verifiedToday: 'Seet nañu ko tey', verifiedYesterday: 'Seet nañu ko démb', verifiedDays: 'Seet nañu ko am na {days} fan',
      budgetWithin: 'Nekk na ci sa xaalis', budgetOver: '+{amount} F ci kaw', addedFavorite: 'Dugal nañu ko ci yi nga bëgg', removedFavorite: 'Far nañu ko ci yi nga bëgg',
      compareLimit: 'Mën nga méngale ñetti yëf rekk.', chooseTwo: 'Tànnal ñaari yëf walla lu ëpp.', copied: 'Copier nañu lien bi.', shareTitle: 'Méngale SeneCompare',
      reportTitle: 'Wax ne offre bi am na njuumte', reportKicker: 'Baaxaayu xibaar', reportIntro: 'Li ngay wax dina dimbali nu far njëg yu bon walla yu yàgg.',
      reportReason: 'Lu tax', reportDetails: 'Yeneen leeral', sendReport: 'Yónnee', reportSent: 'Jërëjëf. Dinañu ko seet.',
      alertTitle: 'Topp njëg bi', alertKicker: 'Alerte njëg', targetPrice: 'Njëg bi nga bëgg (F CFA)', phone: 'Telefon', email: 'E-mail', saveAlert: 'Denc alerte bi', alertSaved: 'Denc nañu alerte bi.',
      merchantFormTitle: 'Jël sa xëtu jaaykat', merchantFormKicker: 'Dëggal entreprise bi', businessName: 'Turu entreprise bi', contactName: 'Turu kilifa gi', message: 'Leeral', submitClaim: 'Yónnee laaj bi', claimSent: 'Jot nañu laaj bi. Dinañu ko seet ak loxo.',
      methodologyTitle: 'Naka lañu xayma wóolu gi', methodologyKicker: 'Leeral', privacyTitle: 'Sàmm xibaar yu kenn', privacyKicker: 'Sutura',
      favoritesTitle: 'Yi nga bëgg', favoritesKicker: 'Denc nañu ko ci telefon bii', historyTitle: 'Li nga seetoon', historyKicker: 'Seet yu mujj', emptyFavorites: 'Amul dara fii léegi.', emptyHistory: 'Amul seet bu ñu denc.',
      clearHistory: 'Far lépp', openSearch: 'Seetaat', remove: 'Far', compareTitle: 'Méngale wet ak wet', compareKicker: 'Dimbali ngir tànn',
      price: 'Njëg', seller: 'Jaaykat', trust: 'Wóolu', status: 'Naka la nekk', description: 'Leeral', dataSource: 'Fan la xibaar yi jóge',
      dataLive: 'Xibaar yi jokkoo nañu', dataDemo: 'Catalogue bu njëkk', localAlertNote: 'Denc nañu sa tànneef ci telefon bii. Notification yi soxlañu service bu yónnee xibaar.',
      requiredFields: 'Fësal barab yi war.', invalidContact: 'Dugal telefon walla e-mail bu baax.', sendFailed: 'Yónnee bi antuwul. Jéemaatal.',
      speechSummary: '{count} offres lañu gis. Njëg bi gën a suuf mooy {price}.', installReady: 'Mën nga installer SeneCompare ci menu navigateur bi.',
    },
  };

  const state = {
    locale: localStorage.getItem(STORAGE.locale) === 'wo' ? 'wo' : 'fr',
    results: [],
    query: '',
    filters: {},
    dataMode: '',
    favorites: new Set(readStorage(STORAGE.favorites, [])),
    history: readStorage(STORAGE.history, []),
    alerts: readStorage(STORAGE.alerts, []),
    compare: new Set(),
    recognition: null,
    listening: false,
    lastFocused: null,
  };

  const elements = {};

  document.addEventListener('DOMContentLoaded', init, { once: true });

  function init() {
    cacheElements();
    bindEvents();
    applyLocale();
    updateFavoriteCounter();
    registerServiceWorker();
    handleInitialRoute();
    restoreQueryFromUrl();
  }

  function cacheElements() {
    const ids = [
      'searchForm', 'searchInput', 'voiceButton', 'voiceStatus', 'locationButton', 'locationLabel', 'cityFilter', 'categoryFilter',
      'maxPriceFilter', 'conditionFilter', 'sellerFilter', 'sortFilter', 'filtersPanel', 'activeFilterCount', 'submitButton', 'clearButton',
      'categoryGrid', 'suggestionRow', 'resultsSection', 'resultCount', 'resultsSummary', 'resultsGrid', 'resultsStatus', 'dataModeBanner',
      'listenResultsButton', 'shareSearchButton', 'compareBar', 'compareCount', 'compareNames', 'openCompareButton', 'clearCompareButton',
      'favoritesButton', 'favoritesCount', 'historyButton', 'languageSwitch', 'merchantClaimButton', 'footerMerchantButton',
      'appModal', 'modalKicker', 'modalTitle', 'modalBody', 'modalClose', 'toastRegion', 'offerCardTemplate',
    ];
    ids.forEach((id) => { elements[id] = document.getElementById(id); });
  }

  function bindEvents() {
    elements.searchForm.addEventListener('submit', onSearchSubmit);
    elements.clearButton.addEventListener('click', clearSearch);
    elements.voiceButton.addEventListener('click', toggleVoiceSearch);
    elements.locationButton.addEventListener('click', locateUser);
    elements.languageSwitch.addEventListener('click', toggleLocale);
    elements.favoritesButton.addEventListener('click', showFavorites);
    elements.historyButton.addEventListener('click', showHistory);
    elements.listenResultsButton.addEventListener('click', listenToResults);
    elements.shareSearchButton.addEventListener('click', shareCurrentSearch);
    elements.openCompareButton.addEventListener('click', showComparison);
    elements.clearCompareButton.addEventListener('click', clearComparison);
    elements.merchantClaimButton.addEventListener('click', () => showMerchantForm());
    elements.footerMerchantButton.addEventListener('click', () => showMerchantForm());
    elements.modalClose.addEventListener('click', closeModal);
    elements.appModal.addEventListener('click', (event) => {
      if (event.target === elements.appModal) closeModal();
    });
    elements.suggestionRow.addEventListener('click', (event) => {
      const button = event.target.closest('[data-query]');
      if (!button) return;
      elements.searchInput.value = button.dataset.query || '';
      elements.searchInput.focus();
    });
    elements.categoryGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      elements.categoryFilter.value = button.dataset.category || 'all';
      elements.searchInput.value = t(button.dataset.category || 'professional');
      updateFilterCount();
      elements.searchForm.requestSubmit();
    });
    ['cityFilter', 'categoryFilter', 'maxPriceFilter', 'conditionFilter', 'sellerFilter', 'sortFilter'].forEach((key) => {
      elements[key].addEventListener('change', updateFilterCount);
      elements[key].addEventListener('input', updateFilterCount);
    });
    document.querySelectorAll('[data-route]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openInformationalRoute(link.dataset.route);
      });
    });
    window.addEventListener('popstate', handleInitialRoute);
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      window.__SENECOMPARE_INSTALL_PROMPT__ = event;
      toast(t('installReady'));
    });
  }

  async function onSearchSubmit(event) {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    const inferred = inferFiltersFromQuery(query);
    if (inferred.city && elements.cityFilter.value === 'Sénégal') elements.cityFilter.value = inferred.city;
    if (inferred.maxPrice && !elements.maxPriceFilter.value) elements.maxPriceFilter.value = String(inferred.maxPrice);
    if (inferred.category && elements.categoryFilter.value === 'all') elements.categoryFilter.value = inferred.category;
    updateFilterCount();
    await search(query);
  }

  async function search(query, options = {}) {
    state.query = query.trim();
    state.filters = collectFilters();
    elements.resultsSection.hidden = false;
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setLoading(true);
    syncUrl();

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query: state.query, ...state.filters }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || 'search_failed');

      state.results = Array.isArray(payload.results) ? payload.results : [];
      state.dataMode = payload.data_mode || '';
      addHistory(state.query, state.filters, state.results.length);
      renderResults();
      if (!options.silent) announceResults();
    } catch (error) {
      console.error('SeneCompare search failed', error);
      renderError();
    } finally {
      setLoading(false);
    }
  }

  function collectFilters() {
    return {
      city: elements.cityFilter.value,
      category: elements.categoryFilter.value,
      maxPrice: Number(elements.maxPriceFilter.value || 0),
      condition: elements.conditionFilter.value,
      sellerType: elements.sellerFilter.value,
      sort: elements.sortFilter.value,
    };
  }

  function inferFiltersFromQuery(query) {
    const normalized = normalize(query);
    const city = CITY_COORDINATES.find((item) => normalized.includes(normalize(item.name)))?.name || '';
    const moneyMatch = normalized.match(/(?:moins de|inferieur a|budget|sous|yées|lu yées)?\s*(\d{2,3}(?:[ .]?\d{3})+|\d{4,9})\s*(?:f|fcfa|cfa)?/i);
    const maxPrice = moneyMatch ? Number(moneyMatch[1].replace(/[ .]/g, '')) : 0;
    let category = '';
    const mappings = [
      ['phones', ['telephone', 'smartphone', 'samsung', 'iphone', 'xiaomi', 'redmi', 'telefon']],
      ['cars', ['voiture', 'auto', 'vehicule', 'toyota', 'renault', 'woto']],
      ['motorcycles', ['moto', 'jakarta', 'scooter']],
      ['appliances', ['frigo', 'refrigerateur', 'congelateur', 'television', 'climatiseur']],
      ['computing', ['ordinateur', 'laptop', 'pc', 'imprimante']],
      ['fashion', ['boubou', 'vetement', 'sneakers', 'tissu', 'yere']],
      ['home', ['salon', 'meuble', 'maison', 'canape', 'ker']],
      ['professional', ['machine a coudre', 'materiel', 'equipement', 'professionnel']],
    ];
    for (const [key, terms] of mappings) {
      if (terms.some((term) => normalized.includes(term))) { category = key; break; }
    }
    return { city, maxPrice, category };
  }

  function setLoading(loading) {
    elements.submitButton.disabled = loading;
    elements.resultsStatus.textContent = loading ? t('searching') : '';
    if (loading) {
      elements.resultsGrid.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton-card" aria-hidden="true"></div>').join('');
    }
  }

  function renderResults() {
    elements.resultCount.textContent = String(state.results.length);
    elements.resultsSummary.textContent = state.query
      ? `${state.results.length} ${t('resultsFor')} « ${state.query} » · ${state.filters.city === 'Sénégal' ? t('allSenegal') : state.filters.city}`
      : `${state.results.length} ${t('offersFound').toLowerCase()}`;
    elements.dataModeBanner.hidden = state.dataMode !== 'starter_catalog';
    elements.resultsGrid.innerHTML = '';

    if (state.results.length === 0) {
      elements.resultsGrid.innerHTML = `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>${escapeHtml(t('noResultsTitle'))}</h3><p>${escapeHtml(t('noResultsCopy'))}</p></div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    state.results.forEach((offer) => fragment.appendChild(createOfferCard(offer)));
    elements.resultsGrid.appendChild(fragment);
    applyTranslations(elements.resultsGrid);
  }

  function createOfferCard(offer) {
    const node = elements.offerCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.offerId = offer.id;
    const category = CATEGORY_META[offer.category] || CATEGORY_META.professional;
    const maxPrice = Number(state.filters.maxPrice || 0);
    const overBudget = maxPrice > 0 && offer.price > maxPrice;
    const budgetDiff = overBudget ? offer.price - maxPrice : 0;

    node.querySelector('.offer-category').textContent = category[state.locale] || category.fr;
    node.querySelector('.offer-visual span').textContent = category.icon;
    node.querySelector('.offer-title').textContent = offer.title;
    node.querySelector('.offer-seller').textContent = `${offer.seller} · ${t(offer.sellerType)}`;
    node.querySelector('.offer-price').textContent = formatMoney(offer.price, offer.currency);
    const budget = node.querySelector('.offer-budget');
    if (maxPrice > 0) budget.textContent = overBudget ? interpolate('budgetOver', { amount: formatNumber(budgetDiff) }) : t('budgetWithin');
    node.querySelector('.offer-city').textContent = `⌖ ${offer.city}`;
    node.querySelector('.offer-condition').textContent = t(offer.condition);
    node.querySelector('.offer-freshness').textContent = freshnessLabel(offer.trust?.ageDays ?? 999);
    node.querySelector('.offer-description').textContent = offer.description || '';

    const trustButton = node.querySelector('.trust-badge');
    const trustLabel = offer.trust?.label || 'low';
    trustButton.classList.add(trustLabel);
    trustButton.textContent = `${t('confidence')} ${t(trustLabel)} · ${offer.trust?.score ?? 0}/100`;
    trustButton.addEventListener('click', () => showTrustDetails(offer));

    node.querySelector('.offer-status').textContent = t(offer.status || 'confirm');
    node.querySelector('.offer-source').textContent = offer.sourceName || t('source');
    const sourceLink = node.querySelector('.source-link');
    if (offer.sourceUrl) {
      sourceLink.href = offer.sourceUrl;
      sourceLink.hidden = false;
    }

    const favoriteButton = node.querySelector('.favorite-toggle');
    favoriteButton.classList.toggle('is-active', state.favorites.has(offer.id));
    favoriteButton.textContent = state.favorites.has(offer.id) ? '♥' : '♡';
    favoriteButton.addEventListener('click', () => toggleFavorite(offer, favoriteButton));

    const checkbox = node.querySelector('.compare-check input');
    checkbox.checked = state.compare.has(offer.id);
    node.classList.toggle('is-selected', checkbox.checked);
    checkbox.addEventListener('change', () => toggleCompare(offer, checkbox, node));

    node.querySelector('.report-button').addEventListener('click', () => showReportForm(offer));
    node.querySelector('.alert-button').addEventListener('click', () => showAlertForm(offer));
    node.querySelector('.share-button').addEventListener('click', () => shareOffer(offer));
    return node;
  }

  function renderError() {
    state.results = [];
    elements.resultCount.textContent = '0';
    elements.resultsSummary.textContent = '';
    elements.dataModeBanner.hidden = true;
    elements.resultsGrid.innerHTML = `<div class="error-state"><span aria-hidden="true">!</span><h3>${escapeHtml(t('errorTitle'))}</h3><p>${escapeHtml(t('errorCopy'))}</p><button class="primary-button" id="retrySearch" type="button">${escapeHtml(t('compareNow'))}</button></div>`;
    document.getElementById('retrySearch')?.addEventListener('click', () => search(state.query));
  }

  function toggleFavorite(offer, button) {
    if (state.favorites.has(offer.id)) {
      state.favorites.delete(offer.id);
      button.classList.remove('is-active');
      button.textContent = '♡';
      toast(t('removedFavorite'));
    } else {
      state.favorites.add(offer.id);
      button.classList.add('is-active');
      button.textContent = '♥';
      toast(t('addedFavorite'), 'success');
    }
    writeStorage(STORAGE.favorites, [...state.favorites]);
    writeFavoriteSnapshot(offer);
    updateFavoriteCounter();
  }

  function writeFavoriteSnapshot(offer) {
    const key = `${STORAGE.favorites}.offers`;
    const current = readStorage(key, {});
    current[offer.id] = offer;
    const keep = Object.fromEntries(Object.entries(current).filter(([id]) => state.favorites.has(id)));
    writeStorage(key, keep);
  }

  function updateFavoriteCounter() {
    const count = state.favorites.size;
    elements.favoritesCount.textContent = String(count);
    elements.favoritesCount.hidden = count === 0;
  }

  function toggleCompare(offer, checkbox, card) {
    if (checkbox.checked && state.compare.size >= 3) {
      checkbox.checked = false;
      toast(t('compareLimit'), 'error');
      return;
    }
    if (checkbox.checked) state.compare.add(offer.id);
    else state.compare.delete(offer.id);
    card.classList.toggle('is-selected', checkbox.checked);
    updateCompareBar();
  }

  function updateCompareBar() {
    const selected = state.results.filter((offer) => state.compare.has(offer.id));
    elements.compareBar.hidden = selected.length === 0;
    elements.compareCount.textContent = String(selected.length);
    elements.compareNames.textContent = selected.map((offer) => offer.title).join(' · ');
    elements.openCompareButton.disabled = selected.length < 2;
  }

  function clearComparison() {
    state.compare.clear();
    document.querySelectorAll('.compare-check input').forEach((input) => { input.checked = false; });
    document.querySelectorAll('.offer-card').forEach((card) => card.classList.remove('is-selected'));
    updateCompareBar();
  }

  function showComparison() {
    const selected = state.results.filter((offer) => state.compare.has(offer.id));
    if (selected.length < 2) { toast(t('chooseTwo'), 'error'); return; }
    const rows = [
      [t('price'), ...selected.map((offer) => formatMoney(offer.price, offer.currency))],
      [t('city'), ...selected.map((offer) => offer.city)],
      [t('condition'), ...selected.map((offer) => t(offer.condition))],
      [t('seller'), ...selected.map((offer) => offer.seller)],
      [t('trust'), ...selected.map((offer) => `${t(offer.trust.label)} · ${offer.trust.score}/100`)],
      [t('status'), ...selected.map((offer) => t(offer.status || 'confirm'))],
      [t('freshness'), ...selected.map((offer) => freshnessLabel(offer.trust.ageDays))],
      [t('source'), ...selected.map((offer) => offer.sourceName)],
      [t('description'), ...selected.map((offer) => offer.description || '—')],
    ];
    const table = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th></th>${selected.map((offer) => `<th>${escapeHtml(offer.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, ...values]) => `<tr><th>${escapeHtml(label)}</th>${values.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    openModal(t('compareKicker'), t('compareTitle'), table);
  }

  function showTrustDetails(offer) {
    const components = offer.trust?.components || {};
    const rows = [
      [t('freshness'), components.freshness || 0, 40],
      [t('crossChecks'), components.corroboration || 0, 25],
      [t('sellerIdentity'), components.seller || 0, 20],
      [t('consistency'), components.consistency || 0, 15],
    ];
    const html = `<p><strong>${escapeHtml(offer.title)}</strong></p><div class="trust-detail">${rows.map(([label, value, max]) => `<div class="trust-detail-row"><span>${escapeHtml(label)}</span><progress max="${max}" value="${value}" aria-label="${escapeHtml(label)}"></progress><strong>${value}/${max}</strong></div>`).join('')}</div><p>${escapeHtml(t('trustCopy'))}</p><button class="secondary-button" type="button" data-open-methodology>${escapeHtml(t('methodologyLink'))}</button>`;
    openModal(t('trustKicker'), `${t('confidence')} ${t(offer.trust.label)} · ${offer.trust.score}/100`, html);
    elements.modalBody.querySelector('[data-open-methodology]')?.addEventListener('click', () => showMethodology(false));
  }

  function showReportForm(offer) {
    const html = `<p>${escapeHtml(t('reportIntro'))}</p><form id="reportForm"><label>${escapeHtml(t('reportReason'))}<select name="reason"><option value="price_outdated">Prix obsolète</option><option value="unavailable">Offre indisponible</option><option value="wrong_details">Informations incorrectes</option><option value="suspicious">Offre suspecte</option><option value="other">Autre</option></select></label><label>${escapeHtml(t('reportDetails'))}<textarea name="details" maxlength="500" placeholder="${escapeHtml(offer.title)}"></textarea></label><button class="primary-button" type="submit">${escapeHtml(t('sendReport'))}</button></form>`;
    openModal(t('reportKicker'), t('reportTitle'), html);
    document.getElementById('reportForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const ok = await postJson('/api/feedback', { offerId: offer.id, reason: form.get('reason'), details: form.get('details'), pageUrl: location.href, locale: state.locale });
      if (ok) { closeModal(); toast(t('reportSent'), 'success'); }
    });
  }

  function showAlertForm(offer) {
    const html = `<p>${escapeHtml(t('localAlertNote'))}</p><form id="alertForm"><label>${escapeHtml(t('targetPrice'))}<input name="targetPrice" type="number" min="0" max="1000000000" step="5000" value="${Math.max(0, Math.floor(offer.price * .9))}" required></label><div class="form-row"><label>${escapeHtml(t('phone'))}<input name="phone" type="tel" inputmode="tel" placeholder="+221…"></label><label>${escapeHtml(t('email'))}<input name="email" type="email" inputmode="email" placeholder="vous@exemple.com"></label></div><button class="primary-button" type="submit">${escapeHtml(t('saveAlert'))}</button></form>`;
    openModal(t('alertKicker'), t('alertTitle'), html);
    document.getElementById('alertForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const phone = String(form.get('phone') || '').trim();
      const email = String(form.get('email') || '').trim();
      if (!phone && !email) { toast(t('invalidContact'), 'error'); return; }
      const alert = { id: crypto.randomUUID(), offerId: offer.id, query: state.query, targetPrice: Number(form.get('targetPrice') || 0), phone, email, locale: state.locale, createdAt: new Date().toISOString(), title: offer.title };
      state.alerts.unshift(alert);
      state.alerts = state.alerts.slice(0, 30);
      writeStorage(STORAGE.alerts, state.alerts);
      await postJson('/api/alerts', alert, { quiet: true });
      closeModal();
      toast(t('alertSaved'), 'success');
    });
  }

  function showMerchantForm(offerId = '') {
    const html = `<form id="merchantForm"><label>${escapeHtml(t('businessName'))}<input name="businessName" maxlength="160" required></label><div class="form-row"><label>${escapeHtml(t('contactName'))}<input name="contactName" maxlength="160"></label><label>${escapeHtml(t('phone'))}<input name="phone" type="tel" inputmode="tel" placeholder="+221…" required></label></div><label>${escapeHtml(t('email'))}<input name="email" type="email"></label><label>${escapeHtml(t('message'))}<textarea name="message" maxlength="800"></textarea></label><input name="offerId" type="hidden" value="${escapeHtml(offerId)}"><button class="primary-button" type="submit">${escapeHtml(t('submitClaim'))}</button></form>`;
    openModal(t('merchantFormKicker'), t('merchantFormTitle'), html);
    document.getElementById('merchantForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      if (!payload.businessName || !payload.phone) { toast(t('requiredFields'), 'error'); return; }
      const ok = await postJson('/api/merchant/claim', payload);
      if (ok) { closeModal(); toast(t('claimSent'), 'success'); }
    });
  }

  async function postJson(url, payload, options = {}) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`request_${response.status}`);
      return true;
    } catch (error) {
      console.error(error);
      if (!options.quiet) toast(t('sendFailed'), 'error');
      return false;
    }
  }

  function showFavorites() {
    const snapshots = readStorage(`${STORAGE.favorites}.offers`, {});
    const offers = [...state.favorites].map((id) => state.results.find((item) => item.id === id) || snapshots[id]).filter(Boolean);
    const html = offers.length
      ? offers.map((offer) => listCardHtml(offer.title, `${formatMoney(offer.price, offer.currency)} · ${offer.city}`, `<button class="secondary-button" type="button" data-favorite-search="${escapeAttribute(offer.id)}">${escapeHtml(t('openSearch'))}</button><button class="secondary-button" type="button" data-favorite-remove="${escapeAttribute(offer.id)}">${escapeHtml(t('remove'))}</button>`)).join('')
      : `<div class="empty-state"><span>♡</span><h3>${escapeHtml(t('emptyFavorites'))}</h3></div>`;
    openModal(t('favoritesKicker'), t('favoritesTitle'), html);
    elements.modalBody.querySelectorAll('[data-favorite-search]').forEach((button) => button.addEventListener('click', () => {
      const offer = offers.find((item) => item.id === button.dataset.favoriteSearch);
      if (!offer) return;
      closeModal();
      elements.searchInput.value = offer.title;
      elements.categoryFilter.value = offer.category;
      elements.searchForm.requestSubmit();
    }));
    elements.modalBody.querySelectorAll('[data-favorite-remove]').forEach((button) => button.addEventListener('click', () => {
      state.favorites.delete(button.dataset.favoriteRemove);
      writeStorage(STORAGE.favorites, [...state.favorites]);
      updateFavoriteCounter();
      showFavorites();
    }));
  }

  function showHistory() {
    const html = state.history.length
      ? `${state.history.map((item, index) => listCardHtml(item.query || t(item.filters?.category || 'professional'), `${item.resultCount} ${t('offersFound').toLowerCase()} · ${new Date(item.createdAt).toLocaleString(state.locale === 'wo' ? 'wo-SN' : 'fr-SN')}`, `<button class="secondary-button" type="button" data-history-index="${index}">${escapeHtml(t('openSearch'))}</button>`)).join('')}<button class="secondary-button" id="clearHistoryModal" type="button">${escapeHtml(t('clearHistory'))}</button>`
      : `<div class="empty-state"><span>↺</span><h3>${escapeHtml(t('emptyHistory'))}</h3></div>`;
    openModal(t('historyKicker'), t('historyTitle'), html);
    elements.modalBody.querySelectorAll('[data-history-index]').forEach((button) => button.addEventListener('click', () => {
      const item = state.history[Number(button.dataset.historyIndex)];
      if (!item) return;
      restoreFilters(item.filters || {});
      elements.searchInput.value = item.query || '';
      closeModal();
      elements.searchForm.requestSubmit();
    }));
    document.getElementById('clearHistoryModal')?.addEventListener('click', () => {
      state.history = [];
      writeStorage(STORAGE.history, []);
      showHistory();
    });
  }

  function listCardHtml(title, subtitle, actions) {
    return `<div class="list-card"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div><div class="list-card-actions">${actions}</div></div>`;
  }

  function addHistory(query, filters, resultCount) {
    if (!query && filters.category === 'all') return;
    const signature = JSON.stringify([query, filters]);
    state.history = [{ query, filters, resultCount, createdAt: new Date().toISOString(), signature }, ...state.history.filter((item) => item.signature !== signature)].slice(0, 20);
    writeStorage(STORAGE.history, state.history);
  }

  function showMethodology(push = true) {
    const html = `<p>${escapeHtml(t('trustCopy'))}</p><h3>1. ${escapeHtml(t('freshness'))} — 40 points</h3><p>Une vérification récente reçoit davantage de points. Le score diminue progressivement après 2, 7, 14 et 30 jours.</p><h3>2. ${escapeHtml(t('crossChecks'))} — 25 points</h3><p>Une offre recoupée avec plusieurs sources indépendantes est mieux classée.</p><h3>3. ${escapeHtml(t('sellerIdentity'))} — 20 points</h3><p>Les entreprises et vendeurs dont l’identité a été contrôlée reçoivent davantage de points.</p><h3>4. ${escapeHtml(t('consistency'))} — 15 points</h3><p>Le prix est comparé à la distribution observée pour repérer les anomalies ou offres trop belles pour être vraies.</p><h3>Lecture</h3><p><strong>${escapeHtml(t('high'))}</strong> : 75 à 100 · <strong>${escapeHtml(t('medium'))}</strong> : 50 à 74 · <strong>${escapeHtml(t('low'))}</strong> : moins de 50.</p><p>Aucun score ne remplace la vérification du vendeur, du produit, des documents, de la garantie ou du stock.</p>`;
    openModal(t('methodologyKicker'), t('methodologyTitle'), html);
    if (push) history.pushState({ route: 'methodology' }, '', '/methodology');
  }

  function showPrivacy(push = true) {
    const html = `<h3>Données traitées</h3><p>La recherche, les filtres, les favoris et l’historique peuvent être conservés localement sur votre appareil. La géolocalisation n’est utilisée qu’après votre autorisation pour proposer la ville la plus proche.</p><h3>Microphone</h3><p>La reconnaissance vocale dépend des fonctions du navigateur. SeneCompare ne demande le microphone qu’après une action explicite.</p><h3>Signalements et demandes marchands</h3><p>Les informations envoyées dans ces formulaires servent uniquement à vérifier une offre, traiter une demande ou préparer une alerte. Ne transmettez jamais de mot de passe, code OTP ou information bancaire.</p><h3>Partage</h3><p>Lorsque vous utilisez le partage WhatsApp ou le partage natif, le contenu est transmis à l’application que vous choisissez.</p><h3>Vos choix</h3><p>Vous pouvez effacer l’historique et les favoris depuis l’interface ou supprimer les données du site dans les réglages de votre navigateur.</p><h3>Contact</h3><p>Responsable du service : DakarStyle / SeneCompare AI. Un canal de contact juridique dédié doit être ajouté avant la commercialisation complète.</p>`;
    openModal(t('privacyKicker'), t('privacyTitle'), html);
    if (push) history.pushState({ route: 'privacy' }, '', '/privacy');
  }

  function openInformationalRoute(route) {
    if (route === 'privacy') showPrivacy();
    else if (route === 'methodology') showMethodology();
    else if (route === 'merchant') { history.pushState({ route: 'merchant' }, '', '/merchant'); showMerchantForm(); }
  }

  function handleInitialRoute() {
    const path = location.pathname;
    if (path === '/privacy') showPrivacy(false);
    else if (path === '/methodology') showMethodology(false);
    else if (path === '/merchant') showMerchantForm();
    else if (elements.appModal?.open) closeModal(false);
  }

  function openModal(kicker, title, html) {
    state.lastFocused = document.activeElement;
    elements.modalKicker.textContent = kicker;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = html;
    if (!elements.appModal.open) elements.appModal.showModal();
    elements.modalClose.focus();
  }

  function closeModal(updateUrl = true) {
    if (elements.appModal.open) elements.appModal.close();
    elements.modalBody.innerHTML = '';
    if (updateUrl && location.pathname !== '/') history.pushState({}, '', `/${location.search}`);
    if (state.lastFocused instanceof HTMLElement) state.lastFocused.focus();
  }

  function toggleLocale() {
    state.locale = state.locale === 'fr' ? 'wo' : 'fr';
    localStorage.setItem(STORAGE.locale, state.locale);
    applyLocale();
    if (state.results.length) renderResults();
  }

  function applyLocale() {
    document.documentElement.lang = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';
    elements.languageSwitch.textContent = state.locale === 'fr' ? 'WO' : 'FR';
    elements.languageSwitch.setAttribute('aria-label', state.locale === 'fr' ? 'Passer en wolof' : 'Passer en français');
    applyTranslations(document);
    elements.searchInput.placeholder = state.locale === 'fr' ? 'Téléphone Samsung, moto, frigo, ordinateur…' : 'Telefon Samsung, moto, frigo, ordinateur…';
  }

  function applyTranslations(root) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = t(element.dataset.i18n);
      if (value) element.textContent = value;
    });
  }

  function toggleVoiceSearch() {
    if (state.listening && state.recognition) { state.recognition.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast(t('voiceUnsupported'), 'error'); return; }
    const recognition = new Recognition();
    recognition.lang = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    state.recognition = recognition;
    recognition.addEventListener('start', () => setListening(true));
    recognition.addEventListener('result', (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
      if (transcript) elements.searchInput.value = transcript;
      if (event.results[event.results.length - 1]?.isFinal) setTimeout(() => elements.searchForm.requestSubmit(), 150);
    });
    recognition.addEventListener('error', (event) => {
      setListening(false);
      toast(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? t('voiceDenied') : t('voiceUnsupported'), 'error');
    });
    recognition.addEventListener('end', () => setListening(false));
    recognition.start();
  }

  function setListening(active) {
    state.listening = active;
    elements.voiceButton.classList.toggle('is-listening', active);
    elements.voiceButton.setAttribute('aria-pressed', String(active));
    elements.voiceStatus.textContent = active ? t('listening') : t('voice');
  }

  function locateUser() {
    if (!navigator.geolocation) { toast(t('locationDenied'), 'error'); return; }
    elements.locationLabel.textContent = t('locationSearching');
    elements.locationButton.disabled = true;
    navigator.geolocation.getCurrentPosition((position) => {
      const nearest = nearestCity(position.coords.latitude, position.coords.longitude);
      elements.cityFilter.value = nearest.name;
      elements.locationLabel.textContent = `${nearest.name} · ${Math.round(nearest.distance)} km`;
      elements.locationButton.classList.add('is-active');
      elements.locationButton.disabled = false;
      updateFilterCount();
      toast(`${t('locationFound')} : ${nearest.name}`, 'success');
    }, () => {
      elements.locationLabel.textContent = t('location');
      elements.locationButton.disabled = false;
      toast(t('locationDenied'), 'error');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 900000 });
  }

  function nearestCity(lat, lon) {
    return CITY_COORDINATES.map((city) => ({ ...city, distance: haversine(lat, lon, city.lat, city.lon) })).sort((a, b) => a.distance - b.distance)[0];
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const radius = 6371;
    const toRad = (value) => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function listenToResults() {
    if (!('speechSynthesis' in window) || state.results.length === 0) return;
    speechSynthesis.cancel();
    const lowest = [...state.results].sort((a, b) => a.price - b.price)[0];
    const utterance = new SpeechSynthesisUtterance(interpolate('speechSummary', { count: state.results.length, price: formatMoney(lowest.price, lowest.currency) }));
    utterance.lang = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';
    utterance.rate = .95;
    speechSynthesis.speak(utterance);
  }

  async function shareCurrentSearch() {
    const text = `${t('shareTitle')}\n${state.query || t(state.filters.category)}\n${state.results.length} ${t('offersFound').toLowerCase()}\n${location.href}`;
    await shareText(text, t('shareTitle'));
  }

  async function shareOffer(offer) {
    const text = `${offer.title}\n${formatMoney(offer.price, offer.currency)} · ${offer.city}\n${t('confidence')} ${t(offer.trust.label)} ${offer.trust.score}/100\n${offer.sourceUrl || location.href}\n\n${t('disclaimer')}`;
    await shareText(text, offer.title);
  }

  async function shareText(text, title) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: location.href });
      } else {
        const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
        const popup = window.open(whatsapp, '_blank', 'noopener,noreferrer');
        if (!popup) {
          await navigator.clipboard.writeText(text);
          toast(t('copied'), 'success');
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(text); toast(t('copied'), 'success'); } catch { /* no-op */ }
      }
    }
  }

  function clearSearch() {
    elements.searchForm.reset();
    elements.cityFilter.value = 'Sénégal';
    elements.categoryFilter.value = 'all';
    elements.conditionFilter.value = 'all';
    elements.sellerFilter.value = 'all';
    elements.sortFilter.value = 'relevance';
    elements.locationButton.classList.remove('is-active');
    elements.locationLabel.textContent = t('location');
    elements.resultsSection.hidden = true;
    state.results = [];
    state.query = '';
    clearComparison();
    updateFilterCount();
    history.replaceState({}, '', '/');
    elements.searchInput.focus();
  }

  function updateFilterCount() {
    const filters = collectFilters();
    const count = [filters.city !== 'Sénégal', filters.category !== 'all', filters.maxPrice > 0, filters.condition !== 'all', filters.sellerType !== 'all', filters.sort !== 'relevance'].filter(Boolean).length;
    elements.activeFilterCount.textContent = String(count);
    elements.activeFilterCount.hidden = count === 0;
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.pathname = '/';
    if (state.query) url.searchParams.set('q', state.query); else url.searchParams.delete('q');
    Object.entries(state.filters).forEach(([key, value]) => {
      const defaults = { city: 'Sénégal', category: 'all', maxPrice: 0, condition: 'all', sellerType: 'all', sort: 'relevance' };
      if (String(value) !== String(defaults[key])) url.searchParams.set(key, String(value)); else url.searchParams.delete(key);
    });
    history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  function restoreQueryFromUrl() {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    if (!query && !params.get('category')) return;
    elements.searchInput.value = query;
    restoreFilters({
      city: params.get('city') || 'Sénégal',
      category: params.get('category') || 'all',
      maxPrice: Number(params.get('maxPrice') || 0),
      condition: params.get('condition') || 'all',
      sellerType: params.get('sellerType') || 'all',
      sort: params.get('sort') || 'relevance',
    });
    search(query, { silent: true });
  }

  function restoreFilters(filters) {
    elements.cityFilter.value = filters.city || 'Sénégal';
    elements.categoryFilter.value = filters.category || 'all';
    elements.maxPriceFilter.value = filters.maxPrice || '';
    elements.conditionFilter.value = filters.condition || 'all';
    elements.sellerFilter.value = filters.sellerType || 'all';
    elements.sortFilter.value = filters.sort || 'relevance';
    updateFilterCount();
  }

  function announceResults() {
    if (!elements.resultsStatus) return;
    elements.resultsStatus.textContent = state.results.length ? `${state.results.length} ${t('offersFound').toLowerCase()}` : t('noResultsTitle');
    setTimeout(() => { elements.resultsStatus.textContent = ''; }, 2500);
  }

  function freshnessLabel(days) {
    if (days <= 0) return t('verifiedToday');
    if (days === 1) return t('verifiedYesterday');
    return interpolate('verifiedDays', { days });
  }

  function formatMoney(value, currency = 'XOF') {
    const locale = state.locale === 'wo' ? 'wo-SN' : 'fr-SN';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
    catch { return `${formatNumber(value)} F CFA`; }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(state.locale === 'wo' ? 'wo-SN' : 'fr-SN', { maximumFractionDigits: 0 }).format(value);
  }

  function t(key) {
    return TRANSLATIONS[state.locale]?.[key] || TRANSLATIONS.fr[key] || key;
  }

  function interpolate(key, values) {
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function toast(message, type = '') {
    const element = document.createElement('div');
    element.className = `toast ${type}`.trim();
    element.textContent = message;
    elements.toastRegion.appendChild(element);
    setTimeout(() => element.remove(), 4200);
  }

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`/sw.js?v=${VERSION}`, { scope: '/', updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => {}))
        .catch((error) => console.warn('Service worker registration failed', error));
    }, { once: true });
  }
})();
