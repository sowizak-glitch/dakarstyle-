: 'Xaalis bi war a dellusi',
    'Relances WhatsApp': 'Fàttali WhatsApp',
    'Message préparé': 'Bataaxal bi pare na',
    'Relancer WhatsApp': 'Fàttali ci WhatsApp',
    'Enregistrer paiement': 'Bind peymaa',
    'Saisir un versement': 'Bind peymaa',
    'Programmer': 'Waajal bés',
    'Reste dû': 'Xaalis bu des',
    'Relance prévue': 'Fàttali bi pare na',
    'Aucune dette ouverte.': 'Amul bor bu ubbeeku.',
    'Aucune relance programmée.': 'Amul fàttali bu ñu waajal.',
    'Commande vocale intelligente': 'Digal ak baat bu xelu',
    'Dictez naturellement en français ou en wolof, puis confirmez avant l’enregistrement.': 'Waxal ci wolof walla français, gannaaw loolu nangu ko bala ñu bind.',
    'Appuyez puis parlez': 'Bësal te wax',
    'Je vous écoute…': 'Maa ngi la déglu…',
    'Français Sénégal': 'Français Sénégal',
    'Wolof': 'Wolof',
    'Transcription modifiable': 'Mbind mi nga man a soppi',
    'Le texte reconnu apparaîtra ici…': 'Li ñu dégg dina feeñ fii…',
    'Analyser et préremplir': 'Xool te feesal',
    'Effacer': 'Far',
    'Le résumé à confirmer apparaîtra ici.': 'Njàngat bi nga wara nangu dina feeñ fii.',
    'Vérifiez avant d’enregistrer': 'Seetal bala ñu bind',
    'Type': 'Xeet',
    'Vente': 'Jaay',
    'Dette / crédit': 'Bor',
    'Client': 'Kiliyaan',
    'Téléphone': 'Telefon',
    'Quantité': 'Lim',
    'Montant total': 'Xaalis yépp',
    'Déjà payé / montant dépense': 'Li ñu fay / xaalis bu génn',
    'Échéance': 'Bés bi',
    'Description / adresse / détails': 'Mbir mi / adres / leeral',
    'Confirmer cette opération': 'Nangu jëf jii',
    'Règle de sécurité :': 'Sàrtu kaarange:',
    'rien n’est enregistré tant que vous n’appuyez pas sur Confirmer.': 'dara du bind ba nga bës Nangu.',
    'Nouvelle dette / vente à crédit': 'Bor bu bees / jaay ci bor',
    'Produit ou raison *': 'Produit walla lu tax *',
    'Montant total *': 'Xaalis yépp *',
    'Déjà payé': 'Li ñu fay',
    'Date promise': 'Bés bi ñu dig',
    'Première relance': 'Fàttali bu njëkk',
    'Note': 'Leeral',
    'Préparer automatiquement une relance WhatsApp': 'Waajal fàttali WhatsApp ci boppam',
    'Enregistrer la dette': 'Bind bor bi',
    'Fermer': 'Tëj',
    'Réessayer': 'Jéemaat',
    'Reçu': 'Reçu',
    'Partager sur WhatsApp': 'Yónnee ci WhatsApp',
    'Télécharger image': 'Jël nataal bi',
    'Télécharger PDF': 'Jël PDF bi',
    'Payé': 'Fay na',
    'Reste à payer': 'Xaalis bu des',
    'Commander sur WhatsApp': 'Komànde ci WhatsApp',
    'Fournisseur': 'Joxekat',
    'Stocks faibles': 'Stock yi néew',
    'Tout commander': 'Komànde lépp',
    'Parlez, SAMA remplit pour vous': 'Waxal, SAMA dina feesal',
    'Exemple : « J’ai réparé la voiture de Moustapha à 25 000 »': 'Misaal: « Defar naa oto bu Moustapha 25 000 »',
    'Entrées − coûts − dépenses': 'Xaalis bi dugg − njëg − xaalis bu génn'
  }));

  const PLACEHOLDER_WO = new Map(Object.entries({
    'Ex. Boutique Awa': 'Misaal: Boutique Awa',
    '77 000 00 00': '77 000 00 00',
    'Client, produit, téléphone…': 'Kiliyaan, produit, telefon…',
    'Rechercher un produit…': 'Wut produit…',
    'Commande, client, quartier…': 'Komànd, kiliyaan, dëkk…',
    'Client, téléphone, article…': 'Kiliyaan, telefon, produit…',
    'Nom du client': 'Turu kiliyaan',
    'Ex. 2 maillots blancs': 'Misaal: 2 maillot yu weex',
    'Détails utiles': 'Leeral yu am solo',
    'Nom': 'Tur',
    'Le texte reconnu apparaîtra ici…': 'Li ñu dégg dina feeñ fii…'
  }));

  function wolofDynamic(text) {
    const value = String(text || '');
    let match = value.match(/^(\d+) produits? en stock faible$/i);
    if (match) return `${match[1]} produit stock bi dafa néew`;
    match = value.match(/^Reste\s+(.+)$/i);
    if (match) return `Des na ${match[1]}`;
    match = value.match(/^Bénéfice\s+(.+)$/i);
    if (match) return `Njariñ ${match[1]}`;
    match = value.match(/^Échéance\s+(.+)$/i);
    if (match) return `Bés bi ${match[1]}`;
    match = value.match(/^(\d+) ventes?$/i);
    if (match) return `${match[1]} jaay`;
    match = value.match(/^Chargement de (.+)…$/i);
    if (match) return `Yebbi ${match[1]}…`;
    match = value.match(/^sur\s+(.+)$/i);
    if (match) return `ci ${match[1]}`;
    if (value === 'Payée') return 'Fay na';
    if (value === 'En retard') return 'Jéggi na bés';
    if (value === 'Échéance prévue') return 'Bés bi ñu waajal';
    if (value === 'À récupérer') return 'War na dellusi';
    if (value === 'pending') return 'Mungi xaar';
    if (value === 'sent') return 'Yónnee na';
    if (value === 'cancelled') return 'Neenal na';
    return value;
  }

  function translateString(text) {
    const direct = WO.get(text);
    return direct || wolofDynamic(text);
  }

  function rememberAttributes(element) {
    if (originalAttributes.has(element)) return originalAttributes.get(element);
    const saved = {};
    for (const name of ['placeholder', 'aria-label', 'title']) {
      if (element.hasAttribute?.(name)) saved[name] = element.getAttribute(name);
    }
    originalAttributes.set(element, saved);
    return saved;
  }

  function translateTextNode(node, wolof) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
    const source = originalText.get(node);
    if (!wolof) {
      if (node.nodeValue !== source) node.nodeValue = source;
      return;
    }
    const leading = source.match(/^\s*/)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    const core = source.trim();
    if (!core) return;
    const translated = translateString(core);
    if (translated !== core) node.nodeValue = `${leading}${translated}${trailing}`;
  }

  function translateElementAttributes(element, wolof) {
    const saved = rememberAttributes(element);
    for (const [name, source] of Object.entries(saved)) {
      if (!wolof) {
        element.setAttribute(name, source);
        continue;
      }
      const translated = name === 'placeholder'
        ? (PLACEHOLDER_WO.get(source) || translateString(source))
        : translateString(source);
      element.setAttribute(name, translated);
    }
  }

  function applyLanguage(root = document.body) {
    if (!root || translating) return;
    translating = true;
    try {
      const wolof = isWolof();
      document.documentElement.lang = wolof ? 'wo' : 'fr-SN';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION'].includes(parent.tagName)) continue;
        if (parent.closest('[data-sbfu-no-translate]')) continue;
        translateTextNode(node, wolof);
      }
      qsa('[placeholder],[aria-label],[title]', root).forEach((element) => translateElementAttributes(element, wolof));
      updateLanguageButton();
    } finally {
      translating = false;
    }
  }

  function scheduleLanguage(root = document.body) {
    clearTimeout(translateTimer);
    trans