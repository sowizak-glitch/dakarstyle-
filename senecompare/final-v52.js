(() => {
  'use strict';

  const RELEASE = '5.2.0';
  const STORAGE_KEY = 'senecompare.v5.locale';
  const CORE_CATEGORIES = new Set(['phones', 'cars', 'motorcycles', 'appliances', 'computing', 'fashion', 'home', 'professional']);
  const CATEGORIES = [
    { icon: '📱', fr: 'Téléphones', wo: 'Telefon', hintFr: 'Samsung · iPhone · Tecno', hintWo: 'Samsung · iPhone · Tecno', queryFr: 'Téléphone smartphone au Sénégal', queryWo: 'Telefon smartphone ci Senegaal', category: 'phones' },
    { icon: '🚗', fr: 'Voitures', wo: 'Oto', hintFr: 'Occasion · Neuf · Pièces', hintWo: 'Occasion · Bu bees · Pièces', queryFr: 'Voiture occasion neuve pièces automobiles Sénégal', queryWo: 'Oto occasion bu bees ak pièces ci Senegaal', category: 'cars' },
    { icon: '🏍️', fr: 'Motos', wo: 'Moto', hintFr: 'Jakarta · Scooter · Pièces', hintWo: 'Jakarta · Scooter · Pièces', queryFr: 'Moto Jakarta scooter pièces Sénégal', queryWo: 'Moto Jakarta scooter ak pièces ci Senegaal', category: 'motorcycles' },
    { icon: '🧊', fr: 'Électroménager', wo: 'Jumtukaayu kër', hintFr: 'Frigo · TV · Climatiseur', hintWo: 'Frigo · TV · Climatiseur', queryFr: 'Électroménager frigo téléviseur climatiseur Sénégal', queryWo: 'Frigo téléviseur climatiseur ci Senegaal', category: 'appliances' },
    { icon: '💻', fr: 'Informatique', wo: 'Informatique', hintFr: 'PC · Imprimante · Tablette', hintWo: 'PC · Imprimante · Tablette', queryFr: 'Ordinateur imprimante tablette Sénégal', queryWo: 'Ordinateur imprimante tablette ci Senegaal', category: 'computing' },
    { icon: '🏠', fr: 'Maison', wo: 'Kër', hintFr: 'Meubles · Matelas · Cuisine', hintWo: 'Meuble · Matelas · Waañ', queryFr: 'Maison meubles matelas cuisine Sénégal', queryWo: 'Meuble matelas ak waañ ci Senegaal', category: 'home' },
    { icon: '👗', fr: 'Mode & beauté', wo: 'Mode ak taar', hintFr: 'Vêtements · Wax · Bien-être', hintWo: 'Yére · Wax · Taar', queryFr: 'Mode vêtements wax beauté bien-être Sénégal', queryWo: 'Yére wax taar ak bien-être ci Senegaal', category: 'fashion' },
    { icon: '🧰', fr: 'Matériel pro', wo: 'Jumtukaayu liggéey', hintFr: 'Commerce · Atelier · Bureau', hintWo: 'Jaayukaay · Atelier · Bureau', queryFr: 'Matériel professionnel commerce atelier bureau Sénégal', queryWo: 'Jumtukaayu liggéey commerce atelier bureau ci Senegaal', category: 'professional' },
    { icon: '🚕', fr: 'Transport', wo: 'Transport', hintFr: 'Covoiturage · Taxi · Location', hintWo: 'Covoiturage · Taxi · Location', queryFr: 'Transport covoiturage taxi location voiture Sénégal', queryWo: 'Transport covoiturage taxi location ci Senegaal' },
    { icon: '📦', fr: 'Livraison', wo: 'Yóbbu', hintFr: 'Colis · Courses · Déménagement', hintWo: 'Colis · Courses · Déménagement', queryFr: 'Livraison colis courses déménagement Sénégal', queryWo: 'Yóbbu colis courses déménagement ci Senegaal' },
    { icon: '🔧', fr: 'Travaux & artisans', wo: 'Artisan ak liggéey', hintFr: 'Plombier · Électricien · BTP', hintWo: 'Plombier · Électricien · BTP', queryFr: 'Plombier électricien menuisier travaux BTP Sénégal', queryWo: 'Plombier électricien menuisier ak travaux BTP ci Senegaal' },
    { icon: '🧹', fr: 'Ménage & cuisine', wo: 'Setal ak waañ', hintFr: 'Maison · Cuisine · Entretien', hintWo: 'Kër · Waañ · Setal', queryFr: 'Service ménage cuisine entretien maison Sénégal', queryWo: 'Service setal waañ ak entretien kër ci Senegaal' },
    { icon: '👶', fr: 'Garde d’enfants', wo: 'Sàmm xale', hintFr: 'Nounou · Babysitting · Crèche', hintWo: 'Nounou · Babysitting · Crèche', queryFr: 'Nounou babysitting crèche garde enfant Sénégal', queryWo: 'Nounou babysitting crèche sàmm xale ci Senegaal' },
    { icon: '🎓', fr: 'Cours & formation', wo: 'Jàng ak formation', hintFr: 'Cours · Institut · Certification', hintWo: 'Cours · Institut · Certification', queryFr: 'Cours particuliers formation certification Sénégal', queryWo: 'Cours particuliers formation certification ci Senegaal' },
    { icon: '🩺', fr: 'Santé', wo: 'Wér-gu-yaram', hintFr: 'Pharmacie · Clinique · Matériel', hintWo: 'Pharmacie · Clinique · Matériel', queryFr: 'Pharmacie clinique laboratoire matériel médical Sénégal', queryWo: 'Pharmacie clinique laboratoire matériel médical ci Senegaal' },
    { icon: '🏢', fr: 'Immobilier', wo: 'Kër ak suuf', hintFr: 'Location · Vente · Terrain', hintWo: 'Location · Jaay · Suuf', queryFr: 'Immobilier maison appartement terrain location Sénégal', queryWo: 'Kër appartement suuf location ci Senegaal' },
    { icon: '🍽️', fr: 'Alimentation', wo: 'Lekk', hintFr: 'Restaurant · Marché · Traiteur', hintWo: 'Restaurant · Marché · Traiteur', queryFr: 'Restaurant alimentation marché traiteur Sénégal', queryWo: 'Restaurant lekk marché traiteur ci Senegaal' },
    { icon: '🌾', fr: 'Agriculture', wo: 'Bay ak jur', hintFr: 'Matériel · Semences · Élevage', hintWo: 'Matériel · Jiwu · Jur', queryFr: 'Matériel agricole semences élevage Sénégal', queryWo: 'Matériel agricole jiwu ak jur ci Senegaal' },
    { icon: '🏗️', fr: 'Construction', wo: 'Tabax', hintFr: 'Matériaux · BTP · Outillage', hintWo: 'Matériaux · BTP · Outillage', queryFr: 'Matériaux construction BTP outillage Sénégal', queryWo: 'Matériaux tabax BTP outillage ci Senegaal' },
    { icon: '☀️', fr: 'Énergie & solaire', wo: 'Energie ak solaire', hintFr: 'Panneaux · Groupe · Batterie', hintWo: 'Panneaux · Groupe · Batterie', queryFr: 'Panneaux solaires groupe électrogène batterie Sénégal', queryWo: 'Panneaux solaires groupe électrogène batterie ci Senegaal' },
    { icon: '📹', fr: 'Sécurité', wo: 'Kaarange', hintFr: 'Caméras · Alarme · Surveillance', hintWo: 'Caméras · Alarme · Surveillance', queryFr: 'Caméra surveillance alarme sécurité Sénégal', queryWo: 'Caméra surveillance alarme kaarange ci Senegaal' },
    { icon: '🎨', fr: 'Web & création', wo: 'Web ak création', hintFr: 'Site · Design · Photo', hintWo: 'Site · Design · Photo', queryFr: 'Création site web design photo vidéo Sénégal', queryWo: 'Création site web design photo vidéo ci Senegaal' },
    { icon: '💳', fr: 'Finance & assurance', wo: 'Xaalis ak assurance', hintFr: 'Crédit · Assurance · Paiement', hintWo: 'Crédit · Assurance · Fay', queryFr: 'Finance crédit assurance paiement mobile money Sénégal', queryWo: 'Finance crédit assurance paiement mobile money ci Senegaal' },
    { icon: '✈️', fr: 'Voyages', wo: 'Tukki', hintFr: 'Billet · Hôtel · Séjour', hintWo: 'Billet · Hôtel · Séjour', queryFr: 'Voyage billet avion hôtel séjour Sénégal', queryWo: 'Tukki billet avion hôtel séjour ci Senegaal' },
    { icon: '🤝', fr: 'Autres services', wo: 'Yeneen services', hintFr: 'Tous les besoins', hintWo: 'Lépp lu ñu soxla', queryFr: 'Services professionnels et particuliers Sénégal', queryWo: 'Services professionnels ak particuliers ci Senegaal' },
  ];

  function locale() {
    try { return localStorage.getItem(STORAGE_KEY) === 'wo' || document.documentElement.lang.startsWith('wo') ? 'wo' : 'fr'; }
    catch { return document.documentElement.lang.startsWith('wo') ? 'wo' : 'fr'; }
  }

  function replaceBrandMarks() {
    document.querySelectorAll('.brand-mark').forEach((mark) => {
      if (mark.querySelector('img')) return;
      mark.textContent = '';
      const image = document.createElement('img');
      image.src = '/profile.webp?v=520';
      image.alt = '';
      image.width = 58;
      image.height = 58;
      image.decoding = 'async';
      image.fetchPriority = 'high';
      mark.append(image);
    });
    document.querySelectorAll('.brand-copy strong').forEach((node) => { node.innerHTML = 'SeneCompare <em>Sénégal</em>'; });
    const installIcon = document.querySelector('.install-card-icon');
    if (installIcon && !installIcon.querySelector('img')) {
      installIcon.textContent = '';
      const image = document.createElement('img');
      image.src = '/profile.webp?v=520';
      image.alt = '';
      image.width = 64;
      image.height = 64;
      installIcon.append(image);
    }
  }

  function buildVisualGuide() {
    const panel = document.querySelector('.search-panel');
    if (!panel || document.getElementById('scVisualGuide')) return;
    const guide = document.createElement('div');
    guide.id = 'scVisualGuide';
    guide.className = 'sc-visual-guide';
    guide.innerHTML = '<button type="button" data-focus-search><span>⌨️</span><b data-fr="Écrire" data-wo="Bind">Écrire</b><small data-fr="Tapez votre besoin" data-wo="Bind li nga soxla">Tapez votre besoin</small></button><button type="button" data-start-voice><span>🎙️</span><b data-fr="Parler" data-wo="Wax">Parler</b><small data-fr="Dites votre besoin" data-wo="Wax li nga soxla">Dites votre besoin</small></button><button type="button" data-use-location><span>📍</span><b data-fr="Près de moi" data-wo="Ci sama wet">Près de moi</b><small data-fr="Chercher dans votre ville" data-wo="Seet ci sa dëkk">Chercher dans votre ville</small></button>';
    const heading = panel.querySelector('.search-heading');
    if (heading) heading.after(guide); else panel.prepend(guide);
    guide.querySelector('[data-focus-search]')?.addEventListener('click', () => document.getElementById('searchInput')?.focus());
    guide.querySelector('[data-start-voice]')?.addEventListener('click', () => document.getElementById('voiceButton')?.click());
    guide.querySelector('[data-use-location]')?.addEventListener('click', () => document.getElementById('locationButton')?.click());
  }

  function buildCategories() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    const lang = locale();
    const expanded = grid.dataset.expanded === 'true';
    grid.innerHTML = '';
    CATEGORIES.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sc-universe-card';
      button.dataset.query = lang === 'wo' ? item.queryWo : item.queryFr;
      if (item.category && CORE_CATEGORIES.has(item.category)) button.dataset.category = item.category;
      if (index >= 8 && !expanded) button.hidden = true;
      button.innerHTML = `<span class="sc-universe-icon" aria-hidden="true">${item.icon}</span><strong>${lang === 'wo' ? item.wo : item.fr}</strong><small>${lang === 'wo' ? item.hintWo : item.hintFr}</small><i aria-hidden="true">→</i>`;
      button.setAttribute('aria-label', `${lang === 'wo' ? item.wo : item.fr} — ${lang === 'wo' ? item.hintWo : item.hintFr}`);
      grid.append(button);
    });
    let toggle = document.getElementById('scCategoryToggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'scCategoryToggle';
      toggle.type = 'button';
      toggle.className = 'sc-category-toggle';
      grid.after(toggle);
      toggle.addEventListener('click', () => {
        grid.dataset.expanded = grid.dataset.expanded === 'true' ? 'false' : 'true';
        buildCategories();
      });
    }
    toggle.textContent = expanded ? (lang === 'wo' ? 'Waññi catégories yi' : 'Voir moins de catégories') : (lang === 'wo' ? 'Gis catégories yépp' : 'Voir toutes les catégories');
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  function updateFinalText() {
    const lang = locale();
    document.querySelectorAll('[data-fr][data-wo]').forEach((node) => { node.textContent = node.dataset[lang] || node.dataset.fr; });
    const version = document.querySelector('.version-line');
    if (version) version.textContent = `Version finale ${RELEASE} · Recherche générale · Français & wolof · Sénégal`;
    document.documentElement.dataset.senecompareRelease = RELEASE;
  }

  function improveFilters() {
    const select = document.getElementById('categoryFilter');
    if (!select || select.dataset.finalized) return;
    select.dataset.finalized = 'true';
    const additions = [
      ['services', 'Services'], ['health', 'Santé'], ['education', 'Formation'], ['real_estate', 'Immobilier'],
      ['transport', 'Transport'], ['agriculture', 'Agriculture'], ['construction', 'Construction'], ['energy', 'Énergie'],
    ];
    additions.forEach(([value, label]) => {
      if ([...select.options].some((option) => option.value === value)) return;
      const option = document.createElement('option');
      option.value = 'all';
      option.textContent = label;
      option.disabled = true;
      select.append(option);
    });
  }

  function init() {
    replaceBrandMarks();
    buildVisualGuide();
    buildCategories();
    improveFilters();
    updateFinalText();
    const languageSwitch = document.getElementById('languageSwitch');
    languageSwitch?.addEventListener('click', () => setTimeout(() => { buildCategories(); updateFinalText(); }, 30));
    new MutationObserver(() => { buildCategories(); updateFinalText(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    window.__SENECOMPARE_FINAL__ = Object.freeze({ release: RELEASE, universes: CATEGORIES.length, officialBrand: true, generalizedSearch: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
