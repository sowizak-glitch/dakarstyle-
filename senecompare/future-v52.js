(() => {
  'use strict';

  const VERSION = '5.2.0';
  const LOCALE_KEY = 'senecompare.v5.locale';
  const SIMPLE_KEY = 'senecompare.v52.simple';
  const groups = [
    {
      id: 'popular',
      fr: 'Les plus recherchés',
      wo: 'Yi ñuy seet lu ëpp',
      items: [
        ['phones','📱','Téléphones','Telefon','Samsung · iPhone · Tecno','Comparer téléphone smartphone Samsung iPhone Tecno au Sénégal','phones'],
        ['cars','🚗','Voitures','Oto','Occasion · Import · Location','Comparer voiture occasion import location au Sénégal','cars'],
        ['rent','🏠','Maisons & terrains','Kër ak suuf','Location · Vente · Terrain','Comparer maison appartement terrain location vente au Sénégal','home'],
        ['appliances','🧊','Électroménager','Jumtukaayu kër','Frigo · TV · Climatiseur','Comparer frigo télévision climatiseur électroménager au Sénégal','appliances'],
        ['computing','💻','Informatique','Informatik','PC · Imprimante · Tablette','Comparer ordinateur imprimante tablette informatique au Sénégal','computing'],
        ['fashion','👕','Mode & beauté','Yére ak taar','Wax · Boubou · Coiffure','Comparer vêtements wax boubou chaussures coiffure beauté au Sénégal','fashion'],
      ],
    },
    {
      id: 'services',
      fr: 'Services du quotidien',
      wo: 'Services yu bés bu nekk',
      items: [
        ['carpool','🚘','Covoiturage','Bokk oto','Trajets · Régions · Dakar','Comparer covoiturage trajet Dakar régions Sénégal','professional'],
        ['tutoring','📚','Cours particuliers','Jàngalekat','École · Langues · Soutien','Comparer cours particuliers soutien scolaire langues au Sénégal','professional'],
        ['babysitting','👶','Babysitting & nounou','Noppalu xale','Nounou · Garde · Aide','Comparer nounou babysitting garde enfant au Sénégal','professional'],
        ['housework','🧹','Ménage & cuisine','Setal ak togg','Nettoyage · Cuisine · Repassage','Comparer service ménage cuisine nettoyage repassage au Sénégal','professional'],
        ['errands','📦','Courses & livraison','Yónnee ak jënd','Colis · Déménagement · Courses','Comparer livraison colis courses déménagement au Sénégal','professional'],
        ['construction','🛠️','Travaux & jardinage','Tabax ak tool','Plomberie · Électricité · Bricolage','Comparer plombier électricien bricolage jardinage au Sénégal','professional'],
        ['creative','🖥️','Web, design & photo','Web ak nataal','Site · Logo · Photo · Vidéo','Comparer services web design photo vidéo au Sénégal','professional'],
        ['wellness','💇🏾','Mode & bien-être','Taar ak wér-gu-yaram','Couture · Coiffure · Massage','Comparer couture coiffure beauté bien-être au Sénégal','fashion'],
        ['other-services','🤝','Autres services','Yeneen services','Aide locale · Prestataires','Comparer prestataires et services locaux au Sénégal','professional'],
      ],
    },
    {
      id: 'professional',
      fr: 'Matériel professionnel',
      wo: 'Jumtukaayu liggéey',
      items: [
        ['agriculture','🚜','Matériel agricole','Jumtukaayu mbay','Motoculteur · Irrigation · Élevage','Comparer matériel agricole irrigation élevage au Sénégal','professional'],
        ['handling','🏗️','Transport & manutention','Yëngu-yëngu','Chariot · Levage · Camion','Comparer matériel transport manutention levage au Sénégal','professional'],
        ['btp','🧱','BTP & outillage','Tabax ak jumtukaay','Bétonnière · Perceuse · Échafaudage','Comparer matériaux construction BTP outillage au Sénégal','professional'],
        ['office','🪑','Bureau & mobilier','Biro ak mbooloo','Chaise · Bureau · Rangement','Comparer fournitures mobilier de bureau au Sénégal','professional'],
        ['shop','🧾','Marchés & commerces','Jaayukaay','Caisse · Rayon · Balance','Comparer matériel marché commerce caisse balance au Sénégal','professional'],
        ['medical','🩺','Matériel médical','Jumtukaayu faj','Clinique · Pharmacie · Labo','Comparer matériel médical clinique pharmacie laboratoire au Sénégal','professional'],
        ['energy','🔋','Énergie & solaire','Kuraŋ ak jant','Groupe · Batterie · Panneau','Comparer groupe électrogène batterie panneau solaire au Sénégal','professional'],
        ['security','📹','Caméras & sécurité','Kamera ak kaarange','CCTV · Alarme · Contrôle','Comparer caméra surveillance alarme sécurité au Sénégal','professional'],
        ['other-pro','🧰','Autre matériel pro','Yeneen jumtukaay','Atelier · Commerce · Industrie','Comparer autre matériel professionnel atelier industrie au Sénégal','professional'],
      ],
    },
    {
      id: 'life',
      fr: 'Vie, santé et projets',
      wo: 'Dund, wér-gu-yaram ak pexe',
      items: [
        ['health','✚','Santé','Wér-gu-yaram','Pharmacie · Clinique · Dentiste','Comparer pharmacie clinique dentiste laboratoire au Sénégal','professional'],
        ['education','🎓','Formation','Njàng','École · Institut · Certification','Comparer formation institut certification au Sénégal','professional'],
        ['jobs','💼','Emploi & missions','Liggéey','Offres · Freelance · Stage','Comparer offres emploi missions freelance stage au Sénégal','professional'],
        ['finance','💳','Finance & assurance','Xaalis ak kaarange','Crédit · Assurance · Paiement','Comparer crédit assurance paiement services financiers au Sénégal','professional'],
        ['travel','✈️','Voyage & transport','Tukki','Billet · Hôtel · Taxi','Comparer billet voyage hôtel taxi transport au Sénégal','professional'],
        ['food','🍲','Restaurants & alimentation','Lekkat ak lekk','Restaurant · Traiteur · Produits','Comparer restaurant traiteur alimentation au Sénégal','professional'],
      ],
    },
  ];

  function locale() {
    try { return localStorage.getItem(LOCALE_KEY) === 'wo' ? 'wo' : 'fr'; } catch { return 'fr'; }
  }

  function isSimple() {
    try { return localStorage.getItem(SIMPLE_KEY) === '1'; } catch { return false; }
  }

  function setSimple(value) {
    try { localStorage.setItem(SIMPLE_KEY, value ? '1' : '0'); } catch {}
    document.documentElement.dataset.simple = value ? '1' : '0';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }

  function brand() {
    document.querySelectorAll('.brand-mark').forEach((mark) => {
      if (mark.querySelector('img')) return;
      mark.textContent = '';
      const image = document.createElement('img');
      image.src = `/profile-256.png?v=${VERSION}`;
      image.alt = '';
      image.width = 56;
      image.height = 56;
      image.decoding = 'async';
      image.fetchPriority = 'high';
      mark.append(image);
      mark.classList.add('brand-mark-image');
    });

    const installCard = document.querySelector('.install-card');
    if (installCard && !installCard.querySelector('.future-app-profile')) {
      const image = document.createElement('img');
      image.className = 'future-app-profile';
      image.src = `/profile-256.png?v=${VERSION}`;
      image.alt = 'Icône officielle SeneCompare';
      image.width = 76;
      image.height = 76;
      installCard.prepend(image);
      installCard.querySelector('.install-card-icon')?.remove();
    }
  }

  function ensureHead() {
    const head = document.head;
    const links = [
      ['icon', '/icon-192.png?v=' + VERSION, '192x192'],
      ['apple-touch-icon', '/apple-touch-icon.png?v=' + VERSION, '180x180'],
    ];
    links.forEach(([rel, href, sizes]) => {
      let link = head.querySelector(`link[rel="${rel}"][data-v52]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        link.dataset.v52 = VERSION;
        head.append(link);
      }
      link.href = href;
      link.sizes = sizes;
      link.type = 'image/png';
    });
    let og = head.querySelector('meta[property="og:image"]');
    if (!og) {
      og = document.createElement('meta');
      og.setAttribute('property', 'og:image');
      head.append(og);
    }
    og.content = `${location.origin}/og-image.png?v=${VERSION}`;
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = locale() === 'wo' ? 'wo-SN' : 'fr-SN';
    const voices = speechSynthesis.getVoices?.() || [];
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(locale() === 'wo' ? 'wo' : 'fr'))
      || null;
    utterance.lang = lang;
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
  }

  function activateItem(item) {
    const input = document.getElementById('searchInput');
    const form = document.getElementById('searchForm');
    const filter = document.getElementById('categoryFilter');
    if (!input || !form) return;
    input.value = item[5];
    if (filter && [...filter.options].some((option) => option.value === item[6])) {
      filter.value = item[6];
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    }
    input.focus({ preventScroll: true });
    form.requestSubmit();
  }

  function groupMarkup(group, lang) {
    const title = lang === 'wo' ? group.wo : group.fr;
    return `<section class="future-group" data-group="${group.id}">
      <div class="future-group-head">
        <h3>${escapeHtml(title)}</h3>
        <span>${group.items.length}</span>
      </div>
      <div class="future-cards">
        ${group.items.map((item) => {
          const itemTitle = lang === 'wo' ? item[3] : item[2];
          const examples = item[4];
          return `<button type="button" class="future-card" data-taxonomy="${item[0]}" aria-label="${escapeHtml(itemTitle + ' — ' + examples)}">
            <span class="future-icon" aria-hidden="true">${item[1]}</span>
            <span class="future-card-copy"><strong>${escapeHtml(itemTitle)}</strong><small>${escapeHtml(examples)}</small></span>
            <span class="future-arrow" aria-hidden="true">›</span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }

  function renderExplorer() {
    const categorySection = document.querySelector('.category-section');
    const oldGrid = document.getElementById('categoryGrid');
    if (!categorySection || (!oldGrid && !document.getElementById('futureExplorer'))) return;

    let explorer = document.getElementById('futureExplorer');
    if (!explorer) {
      explorer = document.createElement('div');
      explorer.id = 'futureExplorer';
      explorer.className = 'future-explorer';
      oldGrid.replaceWith(explorer);
    }

    const lang = locale();
    explorer.innerHTML = `
      <div class="future-controls">
        <div>
          <strong>${lang === 'wo' ? 'Bësal nataal bi nga bëgg' : 'Touchez simplement ce que vous cherchez'}</strong>
          <small>${lang === 'wo' ? 'Bindu bari soxlawul. Mën nga wax itam.' : 'Peu de texte, des images claires et la recherche vocale.'}</small>
        </div>
        <div class="future-control-actions">
          <button type="button" id="futureListenHelp" class="future-help">🔊 ${lang === 'wo' ? 'Déglu ndimbal' : 'Écouter l’aide'}</button>
          <button type="button" id="futureSimpleMode" class="future-help" aria-pressed="${isSimple()}">◉ ${lang === 'wo' ? 'Mode yomb' : 'Mode simple'}</button>
        </div>
      </div>
      <nav class="future-tabs" aria-label="${lang === 'wo' ? 'Wàll yi' : 'Univers de comparaison'}">
        ${groups.map((group, index) => `<button type="button" data-tab="${group.id}" aria-current="${index === 0 ? 'true' : 'false'}">${group.items[0][1]} ${escapeHtml(lang === 'wo' ? group.wo : group.fr)}</button>`).join('')}
      </nav>
      <div class="future-groups">${groups.map((group) => groupMarkup(group, lang)).join('')}</div>
      <div class="future-universal">
        <span aria-hidden="true">⌕</span>
        <div><strong>${lang === 'wo' ? 'Amul ci list bi ?' : 'Vous ne voyez pas votre besoin ?'}</strong><small>${lang === 'wo' ? 'Bind ko walla wax ko. SeneCompare dina seet.' : 'Écrivez-le ou dites-le : SeneCompare cherchera dans toutes les catégories.'}</small></div>
        <button type="button" id="futureFocusSearch">${lang === 'wo' ? 'Waxal li nga soxla' : 'Décrire mon besoin'}</button>
      </div>`;

    explorer.querySelectorAll('[data-taxonomy]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = groups.flatMap((group) => group.items).find((entry) => entry[0] === button.dataset.taxonomy);
        if (item) activateItem(item);
      });
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const item = groups.flatMap((group) => group.items).find((entry) => entry[0] === button.dataset.taxonomy);
        if (item) speak(`${lang === 'wo' ? item[3] : item[2]}. ${item[4]}`);
      });
    });

    explorer.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        explorer.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-current', String(tab === button)));
        explorer.querySelector(`[data-group="${button.dataset.tab}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      });
    });

    document.getElementById('futureListenHelp')?.addEventListener('click', () => speak(
      lang === 'wo'
        ? 'Bësal nataal bi nga bëgg, walla bës micro bi ngir wax li nga soxla.'
        : 'Touchez une image, ou appuyez sur le microphone pour dire ce que vous cherchez.',
    ));
    document.getElementById('futureSimpleMode')?.addEventListener('click', (event) => {
      const next = !isSimple();
      setSimple(next);
      event.currentTarget.setAttribute('aria-pressed', String(next));
    });
    document.getElementById('futureFocusSearch')?.addEventListener('click', () => {
      document.getElementById('searchInput')?.focus({ preventScroll: false });
      document.querySelector('.search-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function enrichFilters() {
    const select = document.getElementById('categoryFilter');
    if (!select || select.dataset.v52) return;
    select.dataset.v52 = VERSION;
    const extra = [
      ['services','Services du quotidien'], ['health','Santé'], ['education','Formation'],
      ['jobs','Emploi'], ['agriculture','Agriculture'], ['energy','Énergie & solaire'],
      ['security','Sécurité'], ['food','Restauration'], ['travel','Voyage & transport'],
    ];
    extra.forEach(([value, label]) => {
      if ([...select.options].some((option) => option.dataset.intent === value)) return;
      const option = document.createElement('option');
      option.value = 'professional';
      option.textContent = label;
      option.dataset.intent = value;
      select.append(option);
    });
  }

  function updateInstallCopy() {
    const card = document.querySelector('.install-card');
    if (!card || card.querySelector('.future-install-note')) return;
    const note = document.createElement('p');
    note.className = 'future-install-note';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    note.textContent = ios
      ? 'iPhone : Safari → Partager → Sur l’écran d’accueil.'
      : 'Android : appuyez sur Installer. Aucun Play Store nécessaire.';
    card.append(note);
  }

  function observeLocale() {
    const switcher = document.getElementById('languageSwitch');
    if (!switcher) return;
    const observer = new MutationObserver(() => window.setTimeout(renderExplorer, 0));
    observer.observe(switcher, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    document.documentElement.dataset.future = VERSION;
    setSimple(isSimple());
    ensureHead();
    brand();
    enrichFilters();
    renderExplorer();
    updateInstallCopy();
    observeLocale();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
