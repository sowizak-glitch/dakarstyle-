(() => {
  'use strict';

  const VERSION = '10.2.0';
  const PREFIX = 'sbfu';
  const ROOT = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1';
  const SUPPLIER_API = `${ROOT}/samabusiness-supplier-api`;
  const CONTROL_API = `${ROOT}/samabusiness-control-api`;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let translating = false;
  let translateTimer = null;
  let observer = null;
  let voiceRecognition = null;
  let receiptSale = null;

  const $ = (id) => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const xof = (value) => `${money.format(Number(value || 0))} F CFA`;
  const isWolof = () => typeof state !== 'undefined' && state.language === 'wo';
  const merchant = () => (typeof state !== 'undefined' && state.merchant) ? state.merchant : {};
  const data = () => (typeof state !== 'undefined' && state.data) ? state.data : {};
  const token = () => (typeof state !== 'undefined' && state.token) ? state.token : (localStorage.getItem('sama-session-v3') || '');
  const normalizePhone = (value = '') => {
    let phone = String(value).replace(/\D/g, '');
    if (phone.startsWith('00')) phone = phone.slice(2);
    if (phone.length === 9 && phone.startsWith('7')) phone = `221${phone}`;
    return phone;
  };
  const notify = (title, message = '', kind = '') => {
    try {
      if (typeof toast === 'function') return toast(title, message, kind);
    } catch (_) {}
    console[kind === 'error' ? 'error' : 'log'](title, message);
  };

  const WO = new Map(Object.entries({
    'Se connecter': 'Dugg',
    'Créer un accès': 'Ubbi sa konto',
    'Téléphone': 'Telefon',
    'E-mail': 'E-mail',
    'Numéro de téléphone': 'Nimero telefon',
    'Adresse e-mail': 'Adres e-mail',
    'Nom du commerce': 'Turu sa liggéey',
    'Code PIN (6 à 10 chiffres)': 'Kodu sutura (6 ba 10 lim)',
    'Ouvrir mon commerce': 'Ubbi sama liggéey',
    'Créer mon commerce': 'Sos sama liggéey',
    'Les anciens utilisateurs gardent exactement leurs identifiants et leur historique.': 'Jëfandikukat yu njëkk dañuy denc seen nimero, seen kod ak seen jaar-jaar.',
    'Votre ancien SAMA Cahier devient votre assistant complet : ventes, stock, dépenses, bénéfice réel, WhatsApp et livraison.': 'SAMA Cahier mujj na sa ndimbal bu mat: jaay, stock, xaalis bu génn, njariñ, WhatsApp ak yónnee.',
    'Mon commerce': 'Sama liggéey',
    'Synchronisé': 'Denc na',
    'Actualiser': 'Yeesal',
    'Votre activité aujourd’hui': 'Sa liggéey tey',
    'Bonjour 👋': 'Nanga def 👋',
    'Enregistrez chaque mouvement. SAMA calcule ce que votre commerce gagne vraiment.': 'Bindal bépp xaalis bu dugg walla bu génn. SAMA dina la won sa njariñ dëgg.',
    'Bénéfice réel': 'Njariñ dëgg',
    'Bénéfice réel aujourd’hui': 'Njariñ dëgg tey',
    'Nouvelle vente': 'Jaay bu bees',
    'Dépense': 'Xaalis bu génn',
    'Produit': 'Produit',
    'Stock': 'Stock',
    'Retrait patron': 'Xaalisu boroom bi',
    'Les chiffres à comprendre': 'Lim yi war a xam',
    'Pas de jargon : seulement ce qui entre, sort et reste.': 'Wax yu yomb rekk: li dugg, li génn ak li des.',
    'Ventes du jour': 'Jaay yi tey',
    'Argent encaissé': 'Xaalis bi dugg',
    'Coût marchandises': 'Njëgu jumtukaay yi',
    'Dépenses du commerce': 'Xaalis bu génn ci liggéey bi',
    'Retirable sans danger': 'Li nga man a jël te amul risk',
    'Ce qui demande votre attention': 'Li nga war a xool',
    'SAMA surveille les oublis avant qu’ils coûtent cher.': 'SAMA dafay aar la bala fàtte di la lor.',
    'Derniers mouvements': 'Jëf yu mujj',
    'Tout voir': 'Gis lépp',
    'Accueil': 'Kër gi',
    'Ventes': 'Jaay',
    'Commandes': 'Komànd',
    'Plus': 'Yeneen',
    'Ventes et argent à récupérer': 'Jaay ak xaalis bi war a dellusi',
    'Historique complet de SAMA Cahier conservé.': 'Jaar-jaaru SAMA Cahier yépp denc na.',
    '+ Vente': '+ Jaay',
    'Toutes': 'Yépp',
    'Avec reste à payer': 'Am na xaalis bu des',
    'Payées': 'Fay nañu',
    'Stock et prix rentable': 'Stock ak njëg bu am njariñ',
    'Voyez immédiatement ce qui manque et ce qui rapporte.': 'Gisal ci saa si li néew ak li am njariñ.',
    '+ Produit': '+ Produit',
    'Mouvement de stock': 'Yëngu-yëngu stock',
    'Commandes WhatsApp': 'Komànd WhatsApp',
    'Collez un message : SAMA prépare la fiche et demande seulement ce qui manque.': 'Tàkkal bataaxal bi: SAMA dina waajal komànd bi te laaj li néew rekk.',
    '+ Importer': '+ Dugal',
    'En cours': 'Mungi dox',
    'Informations manquantes': 'Xibaar yi néew',
    'Livrées': 'Yónnee nañu',
    'Outils du commerce': 'Jumtukaay yu liggéey bi',
    'Tout l’écosystème, dans une seule application.': 'Lépp ci benn aplikaasiyoŋ.',
    'Tout l’écosystème, dans une seule application.': 'Lépp ci benn aplikaasiyoŋ.',
    'Cahier & dettes': 'Téere ak bor',
    'Crédit, reste dû et relance': 'Bor, xaalis bu des ak fàttali',
    'Enregistrez les crédits, suivez les échéances et relancez sur WhatsApp.': 'Bindal bor yi, topp bés yi te fàttali ci WhatsApp.',
    'Commande vocale': 'Digal ak baat',
    'Parlez, vérifiez, enregistrez': 'Waxal, seetal, bindal',
    'Dictez une dette, une vente, une dépense, une commande ou une livraison.': 'Waxal bor, jaay, xaalis bu génn, komànd walla yónnee.',
    'Cockpit Livraison': 'Saytu yónnee',
    'Gérez les livreurs, affectations, paiements, preuves et suivi client.': 'Saytul yónnekat yi, xaalis, firnde ak toppandoo kiliyaan.',
    'Livraison': 'Yónnee',
    'Abonnement': 'Abonmaa',
    'Consultez l’essai gratuit, l’échéance et transmettez votre paiement.': 'Xoolal jamono ju amul fay, bés bi ak sa peymaa.',
    'Administration générale': 'Saytu bu mag',
    'Pilotez les comptes, sessions, accès, abonnements et récupérations.': 'Saytul konto yi, duggu yi, abonmaa ak delloosi konto.',
    'Dépenses': 'Xaalis bu génn',
    'Séparez les dépenses du commerce et celles de la maison.': 'Teggal xaalisu liggéey bi ak xaalisu kër gi.',
    'Argent du patron': 'Xaalisu boroom bi',
    'Retirez sans vider la caisse du commerce.': 'Jëlal xaalis te bul wàññi doole liggéey bi.',
    'Exporter': 'Génne',
    'Exportez ventes, dépenses et bénéfices en CSV.': 'Génneal jaay, xaalis bu génn ak njariñ ci CSV.',
    'Cahier, dettes et relances': 'Téere, bor ak fàttali',
    'Le crédit client redevient un parcours principal, pas une option cachée.': 'Borub kiliyaan dafay nekk ci kanam, du lu nëbbu.',
    '+ Nouvelle dette': '+ Bor bu bees',
    'TOTAL À RÉCUPÉRER': 'LÉPP LU WAR A DELLOOSI',
    'CLIENTS / DETTES': 'KILIYAAN / BOR',
    'EN RETARD': 'JÉGGI NA BÉS',
    'RELANCES PRÉVUES': 'FÀTTALI YI ÑUY WAJAL',
    'Argent à récupérer'