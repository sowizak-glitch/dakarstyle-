const RELEASE = 'aether-seo-2027.1';
const LASTMOD = '2026-08-12';

const HOSTS = Object.freeze({
  dakar: 'dakarstyle.com',
  dakarWww: 'www.dakarstyle.com',
  sene: 'senecompare.dakarstyle.com',
  sama: 'samabusiness.dakarstyle.com',
  samaLegacy: 'samacahier.dakarstyle.com',
});

const DAKAR_PRODUCT_URLS = [
  '/products/ensemble-senegal/',
  '/products/ensemble-dakar/',
  '/products/s0special-221/',
  '/products/sneakers-sowhat-africa/',
  '/products/maillot-senegal-2026/',
  '/products/debardeur-senegal/',
  '/products/wear-the-culture/',
  '/products/tshirt-numero-10/',
  '/products/casquette-sowhat-africa/',
  '/products/lunettes-soleil-urban/',
  '/products/nomad-spirit/',
];

const GUIDE_PAGES = {
  [HOSTS.dakar]: {
    '/ecosysteme/': {
      type: 'CollectionPage',
      title: 'Écosystème DakarStyle | Mode, comparaison & commerce au Sénégal',
      description: 'Découvrez l’écosystème DakarStyle : streetwear sénégalais, SeneCompare, Sama Business et les outils qui relient culture, commerce et innovation.',
      eyebrow: 'DakarStyle Network',
      h1: 'Un écosystème sénégalais construit pour être trouvé, compris et utilisé.',
      intro: 'DakarStyle réunit des expériences qui répondent à des besoins différents mais complémentaires : découvrir une culture vestimentaire contemporaine, comparer avant d’acheter et piloter un commerce depuis son téléphone. Cette page sert de point d’entrée clair entre ces univers, avec une architecture qui donne à chaque produit sa propre identité tout en renforçant l’autorité de l’ensemble.',
      sections: [
        ['Culture et streetwear', 'La partie mode met en avant une lecture contemporaine du Sénégal : maillots, ensembles, pièces urbaines, détails graphiques et collections Sowhat Africa. Le rôle de DakarStyle n’est pas de produire une accumulation de mots-clés, mais de créer des pages utiles où les produits, les guides de tailles, la culture et les usages sont reliés de manière naturelle. Cette organisation aide aussi les moteurs de recherche à distinguer une fiche produit, un guide et une page éditoriale.'],
        ['Comparer avant d’acheter', 'SeneCompare apporte une autre couche : aider un utilisateur à chercher un produit ou un service, comprendre les résultats et identifier des sources. Son référencement est volontairement séparé de la boutique afin de ne pas mélanger l’intention “acheter un vêtement” avec l’intention “comparer des prix”. Les liens entre les deux restent contextuels, ce qui permet de construire un réseau éditorial sans fabriquer de pages dupliquées.'],
        ['Gérer le commerce local', 'Sama Business est pensé pour les commerçants qui ont besoin de suivre ventes, stock, dettes, livraisons et commandes WhatsApp. Les pages publiques expliquent ces usages en langage simple ; les écrans privés et les états de compte restent hors index. Cette séparation est essentielle : une bonne stratégie SEO augmente la visibilité de ce qui doit être public sans exposer des routes applicatives inutiles ou sensibles.'],
        ['Une autorité, plusieurs intentions', 'Le principe commun est simple : une URL canonique par sujet, des sitemaps propres, des données structurées cohérentes et des liens éditoriaux compréhensibles. DakarStyle peut ainsi devenir une porte d’entrée culturelle et commerciale, tandis que SeneCompare et Sama Business développent leurs propres champs sémantiques. L’objectif est une présence durable au Sénégal et auprès de la diaspora, pas une indexation massive de pages sans valeur.'],
      ],
      related: [
        ['Streetwear Sénégal', '/journal/streetwear-senegal-2026/'],
        ['SeneCompare', 'https://senecompare.dakarstyle.com/'],
        ['Sama Business', 'https://samabusiness.dakarstyle.com/'],
        ['Sowhat Africa', 'https://sowhatafrica.com/'],
      ],
    },
    '/journal/streetwear-senegal-2026/': {
      type: 'Article',
      title: 'Streetwear Sénégal 2026 | Guide DakarStyle',
      description: 'Comprendre le streetwear sénégalais en 2026 : identité, coupes, matières, références culturelles et nouvelles marques de Dakar.',
      eyebrow: 'Journal DakarStyle',
      h1: 'Streetwear Sénégal 2026 : construire un style local avec des standards globaux.',
      intro: 'Le streetwear sénégalais ne se résume plus à reprendre des codes venus d’ailleurs. À Dakar, la silhouette urbaine se nourrit du sport, de la musique, des quartiers, de la diaspora et d’un rapport très direct à la couleur. Les meilleures pièces sont celles qui savent rester portables tout en portant une identité immédiatement reconnaissable.',
      sections: [
        ['Une silhouette pensée pour la ville', 'Le climat et les usages imposent une vraie discipline de coupe. Un t-shirt oversize doit offrir du volume sans donner l’impression d’être simplement trop grand. Un maillot doit respirer, accompagner le mouvement et fonctionner aussi bien dans la rue qu’autour d’un terrain. Les shorts, ensembles et accessoires doivent garder une cohérence de proportions. Cette exigence transforme une référence culturelle en vêtement quotidien plutôt qu’en simple souvenir.'],
        ['La culture dans le détail', 'Les couleurs nationales, les références à Dakar, aux Lions ou aux territoires du Sénégal gagnent en force lorsqu’elles sont intégrées avec retenue. Broderie, patch, texture, typographie ou placement peuvent raconter davantage qu’une impression massive. Une marque sénégalaise crédible travaille donc la finition autant que le symbole : qualité des cols, régularité des coutures, toucher du tissu, solidité des marquages et équilibre du graphisme.'],
        ['Du Sénégal à la diaspora', 'La diaspora recherche souvent deux choses à la fois : un lien culturel réel et un niveau de finition comparable aux marques internationales qu’elle connaît déjà. Les descriptions doivent donc préciser les coupes, les tailles et les matières plutôt que s’appuyer uniquement sur l’émotion. Pour une commande à distance, il faut vérifier la disponibilité, la taille et les modalités de livraison avant paiement. Cette transparence renforce la confiance et limite les retours.'],
        ['Comment choisir sa pièce', 'Commencez par l’usage : tenue complète, maillot, t-shirt ou accessoire. Vérifiez ensuite la coupe souhaitée, les mensurations et la saison. Pour un rendu oversize, ne choisissez pas automatiquement deux tailles au-dessus : une pièce réellement conçue oversize possède déjà ses propres proportions. Enfin, regardez les détails du produit en grand format. La qualité perçue vient souvent des zones que l’on voit le moins sur une photo rapide.'],
      ],
      related: [['Guide oversize Dakar', '/journal/oversize-dakar-guide-tailles/'], ['Marque sénégalaise', '/journal/marque-senegalaise-streetwear/'], ['Collection', '/#products']],
    },
    '/journal/maillot-senegal-2026-guide/': {
      type: 'Article',
      title: 'Maillot Sénégal 2026 | Guide style & tailles DakarStyle',
      description: 'Guide du maillot Sénégal 2026 Sowhat Africa : coupe, détails, tailles, style urbain et conseils avant commande à Dakar ou depuis la diaspora.',
      eyebrow: 'Guide produit',
      h1: 'Maillot Sénégal 2026 : du terrain à la rue, sans perdre l’identité.',
      intro: 'Un maillot Sénégal peut être un vêtement de sport, un marqueur culturel et une pièce de streetwear. Pour bien le choisir, il faut regarder au-delà du visuel frontal : construction du col, matière, respiration, longueur, emplacement des détails et cohérence de la coupe avec le reste de la tenue.',
      sections: [
        ['Lire la construction du maillot', 'Un bon maillot destiné à un usage urbain doit rester léger tout en gardant une tenue visuelle nette. Le col et les emmanchures sont particulièrement importants : ils encadrent la silhouette et subissent beaucoup de tension. Les éléments décoratifs doivent rester stables après usage et entretien. Sur la version Sowhat Africa, les références au Sénégal sont intégrées comme des éléments de design ; la fiche produit reste la source à consulter pour le prix et la disponibilité du moment.'],
        ['Choisir la bonne taille', 'Ne partez pas uniquement de la lettre S, M, L ou XL portée sur une autre marque. Comparez une pièce qui vous va bien avec les mesures disponibles, surtout la largeur poitrine et la longueur. Si vous souhaitez un porté plus ample, cherchez d’abord si la coupe est déjà prévue pour cela. Une taille trop grande peut déplacer les épaules, le col et les motifs, alors qu’un vrai volume streetwear conserve une architecture précise.'],
        ['Composer une tenue Dakar', 'Le maillot fonctionne avec un short coordonné, un pantalon ample ou un denim simple. Lorsque la pièce possède déjà des couleurs fortes, les chaussures et accessoires peuvent rester plus sobres. À l’inverse, une base blanche permet de reprendre subtilement le vert, le jaune ou le rouge dans un détail. Le but n’est pas de multiplier les références, mais de créer une silhouette lisible qui garde le maillot comme point focal.'],
        ['Commander depuis la diaspora', 'Pour une commande hors Sénégal, demandez une confirmation de taille, de stock et de modalité d’envoi avant de finaliser. Conservez le nom exact du produit et la taille choisie dans le message de commande. Cette méthode réduit les erreurs lorsque plusieurs versions ou collections circulent en même temps. Une page produit canonique et un guide de taille partagé sont également plus fiables qu’une ancienne capture d’écran dont le prix ou le stock peuvent avoir changé.'],
      ],
      related: [['Voir le maillot', '/products/maillot-senegal-2026/'], ['Streetwear Sénégal', '/journal/streetwear-senegal-2026/'], ['Écosystème', '/ecosysteme/']],
    },
    '/journal/marque-senegalaise-streetwear/': {
      type: 'Article',
      title: 'Marque sénégalaise streetwear | Culture & création Dakar',
      description: 'Ce qui distingue une marque sénégalaise de streetwear : identité, qualité, storytelling, production et relation avec la diaspora.',
      eyebrow: 'Culture & création',
      h1: 'Une marque sénégalaise forte ne vend pas seulement un motif : elle construit un langage.',
      intro: 'La nouvelle génération de marques sénégalaises évolue entre une culture locale très forte et des attentes internationales élevées. Cette tension est productive : elle oblige à travailler le produit, le récit et l’expérience avec la même précision. Le résultat peut être profondément sénégalais sans être enfermé dans une esthétique folklorique.',
      sections: [
        ['Identité avant décoration', 'Une identité de marque cohérente se reconnaît même lorsque le drapeau, le nom du pays ou un symbole évident n’apparaît pas. Elle passe par une palette, une coupe, une manière de photographier, une typographie et une façon de parler au public. Les références culturelles deviennent alors une matière créative parmi d’autres. Cette cohérence facilite également le référencement : les moteurs comprennent mieux une marque lorsque ses pages utilisent des noms, descriptions et relations stables.'],
        ['Le produit comme preuve', 'Le discours ne remplace jamais la qualité du vêtement. Grammage, maille, broderie, coutures, étiquettes, tolérances de taille et contrôle final sont autant de preuves. Sur un marché où une grande partie de la découverte passe par Instagram ou WhatsApp, la fiche produit doit apporter les informations que la vidéo ne donne pas : taille, disponibilité, entretien, détails et point de contact. La confiance se construit dans cette continuité entre image et réalité.'],
        ['Photographier sans perdre la matière', 'Une campagne premium doit donner envie tout en restant fidèle au produit. La lumière, la peau, le décor et le mouvement peuvent être spectaculaires, mais les couleurs et les proportions du vêtement ne doivent pas être déformées. Les vues de détail sont essentielles pour la texture, les broderies et les finitions. Pour Google Images comme pour un client, un fichier bien nommé et un texte alternatif descriptif valent mieux qu’une image générique sans contexte.'],
        ['Créer une relation avec la diaspora', 'La diaspora apporte une visibilité internationale mais demande une expérience rassurante : pages accessibles rapidement sur mobile, informations claires, taille compréhensible, contact direct et contenu culturel de fond. Les articles ne doivent pas être des pages artificielles répétant “marque africaine” à chaque phrase. Ils doivent répondre à des questions concrètes et montrer pourquoi le produit existe, comment il se porte et comment il s’inscrit dans une scène créative réelle.'],
      ],
      related: [['Mode africaine & diaspora', '/journal/mode-africaine-diaspora/'], ['Streetwear Sénégal', '/journal/streetwear-senegal-2026/'], ['Sowhat Africa', 'https://sowhatafrica.com/']],
    },
    '/journal/oversize-dakar-guide-tailles/': {
      type: 'Article',
      title: 'Oversize Dakar | Guide des tailles streetwear Sénégal',
      description: 'Comment choisir une coupe oversize à Dakar : épaules, longueur, largeur, tailles et conseils pour t-shirts, maillots et ensembles.',
      eyebrow: 'Guide des tailles',
      h1: 'Oversize à Dakar : plus de volume, mais surtout de meilleures proportions.',
      intro: '“Oversize” ne signifie pas simplement acheter trop grand. Une coupe streetwear réussie déplace volontairement les proportions : épaules, largeur du buste, longueur de manche et parfois longueur totale. Comprendre ces paramètres permet de choisir une silhouette ample sans perdre la structure du vêtement.',
      sections: [
        ['Épaules et largeur', 'La couture d’épaule peut descendre au-delà de l’épaule naturelle, mais elle doit le faire de façon équilibrée. La largeur poitrine apporte le volume principal. Sur une pièce bien dessinée, ces deux mesures fonctionnent ensemble : augmenter seulement la taille peut allonger excessivement le vêtement sans créer le bon tombé. Pour comparer, posez à plat un t-shirt que vous aimez et mesurez-le plutôt que de vous fier à une impression.'],
        ['Longueur et silhouette', 'À Dakar, une coupe ample doit aussi rester pratique avec la chaleur et le mouvement. Une longueur trop importante peut alourdir la silhouette, surtout avec un short large. L’équilibre dépend de votre taille, de vos chaussures et du bas choisi. Pour un ensemble, regardez la tenue complète : le haut et le short doivent partager le même langage de proportions sans donner l’impression d’avoir été choisis séparément.'],
        ['Entre deux tailles', 'Si vous hésitez entre deux tailles, définissez d’abord le résultat recherché. Pour un porté net et légèrement ample, restez souvent proche de votre taille habituelle lorsque le modèle est déjà oversize. Pour davantage de volume, montez seulement si les mesures le justifient. En cas de commande WhatsApp, indiquez votre taille habituelle et demandez les mesures de la pièce concernée : c’est plus précis qu’une recommandation générique.'],
        ['Entretien et stabilité', 'Les dimensions peuvent évoluer selon la matière et l’entretien. Respectez les indications de lavage, évitez les températures excessives et ne présumez pas qu’un coton épais se comporte comme une maille sportive. Un guide de taille est utile uniquement s’il reste relié à la fiche produit exacte. C’est pourquoi DakarStyle distingue les conseils généraux des informations propres à chaque référence et évite de présenter une mesure universelle pour toute la collection.'],
      ],
      related: [['Collection DakarStyle', '/#products'], ['Maillot Sénégal 2026', '/journal/maillot-senegal-2026-guide/'], ['Streetwear Sénégal', '/journal/streetwear-senegal-2026/']],
    },
    '/journal/mode-africaine-diaspora/': {
      type: 'Article',
      title: 'Mode africaine & diaspora | Streetwear sénégalais DakarStyle',
      description: 'Mode africaine contemporaine et diaspora : comment choisir des pièces sénégalaises, vérifier tailles, qualité et identité avant commande.',
      eyebrow: 'Dakar ↔ diaspora',
      h1: 'Mode africaine et diaspora : porter une origine sans figer son style.',
      intro: 'Pour beaucoup de personnes de la diaspora, un vêtement lié au Sénégal est à la fois un objet de style et une manière de maintenir une relation avec une culture. Les collections les plus intéressantes ne demandent pas de choisir entre identité et modernité : elles permettent aux deux de coexister dans une pièce suffisamment forte pour être portée partout.',
      sections: [
        ['Éviter l’esthétique souvenir', 'Une pièce contemporaine peut utiliser un symbole, une couleur ou une référence historique sans devenir un objet touristique. Le choix de la coupe, de la matière et de la photographie fait toute la différence. Une marque doit expliquer ses références quand cela apporte du sens, mais laisser aussi le vêtement exister comme produit de mode. Cette approche rend les collections plus faciles à intégrer dans un vestiaire quotidien à Paris, Montréal, Bruxelles, New York ou ailleurs.'],
        ['Vérifier avant une commande à distance', 'Avant tout paiement à distance, confirmez le produit exact, la taille, la disponibilité et les modalités d’expédition. Utilisez la page canonique actuelle plutôt qu’un ancien post social. Pour les tailles, comparez des mesures et non uniquement des lettres. Pour les couleurs, gardez en tête que l’écran et la lumière peuvent créer de petites différences ; les photos de détail et descriptions de matière donnent une lecture plus fiable du produit.'],
        ['Construire un vestiaire hybride', 'Un maillot ou un t-shirt graphique n’a pas besoin d’être porté avec une tenue entièrement thématique. Il peut fonctionner avec un pantalon neutre, une veste simple ou une paire de sneakers sobre. À l’inverse, un ensemble coordonné crée immédiatement une présence plus forte. Le choix dépend du contexte, mais une règle reste utile : si la pièce raconte déjà beaucoup, laissez de l’espace autour d’elle au lieu d’empiler les messages.'],
        ['Une présence numérique cohérente', 'Pour une marque sénégalaise, la diaspora découvre souvent les produits via plusieurs chemins : recherche Google, Instagram, recommandation, média ou WhatsApp. Les noms de produits, visuels et informations doivent rester cohérents entre ces points de contact. Un bon référencement ne remplace pas la marque ; il évite simplement que cette marque devienne invisible lorsque quelqu’un cherche précisément ce qu’elle propose.'],
      ],
      related: [['Marque sénégalaise streetwear', '/journal/marque-senegalaise-streetwear/'], ['Écosystème DakarStyle', '/ecosysteme/'], ['Sowhat Africa', 'https://sowhatafrica.com/']],
    },
  },
  [HOSTS.sene]: {
    '/guides/comparer-prix-senegal/': {
      type: 'Article',
      title: 'Comparer les prix au Sénégal | Guide SeneCompare',
      description: 'Méthode simple pour comparer les prix au Sénégal : produit exact, ville, état, livraison, source et date avant de choisir une offre.',
      eyebrow: 'Guide SeneCompare',
      h1: 'Comparer les prix au Sénégal : regarder le prix, mais aussi ce qu’il contient.',
      intro: 'Deux annonces avec le même nom de produit ne sont pas forcément comparables. Ville, état neuf ou occasion, capacité, accessoires, garantie, livraison et date de publication peuvent changer la valeur réelle d’une offre. Une bonne comparaison commence donc par définir précisément le besoin avant d’ordonner les résultats.',
      sections: [
        ['Décrire le produit avec précision', 'Pour un téléphone, indiquez le modèle, la capacité de stockage et si vous cherchez du neuf ou de l’occasion. Pour un service, précisez la ville et le type de prestation. Pour un appareil, ajoutez la référence lorsqu’elle existe. Plus la demande est claire, moins le moteur doit rapprocher des produits qui se ressemblent seulement par leur nom. Cette discipline améliore aussi la lecture humaine des résultats.'],
        ['Vérifier la source et la date', 'Le prix le plus bas n’est utile que s’il correspond à une offre encore réelle. Ouvrez la source lorsque celle-ci est disponible, vérifiez la date, la localisation et les conditions annoncées. Un comparateur doit aider à réduire le temps de recherche, pas remplacer les vérifications finales auprès du vendeur. Pour une dépense importante, confirmez directement stock, état, garantie et coût de livraison avant de vous déplacer ou de payer.'],
        ['Comparer le coût total', 'Une offre affichée moins chère peut devenir plus coûteuse si elle nécessite un long déplacement, une livraison supplémentaire ou l’achat d’accessoires manquants. À l’inverse, un vendeur légèrement plus cher mais proche, disponible et transparent peut représenter une meilleure option. SeneCompare structure la recherche ; la décision finale doit intégrer le contexte réel de l’utilisateur et non un classement basé uniquement sur un nombre.'],
        ['Garder une trace de la recherche', 'Lorsque vous comparez plusieurs offres, notez le nom exact, le prix observé, la source et la date. Cela évite de confondre des résultats après plusieurs recherches. Les prix évoluent rapidement selon les catégories ; une capture ancienne ne doit pas être considérée comme une référence permanente. Relancer la même recherche juste avant l’achat donne une image plus fiable du marché au moment où la décision est prise.'],
      ],
      related: [['Ouvrir SeneCompare', '/'], ['Prix téléphone Sénégal', '/guides/prix-telephone-senegal/'], ['Services à Dakar', '/guides/services-dakar/']],
    },
    '/guides/prix-telephone-senegal/': {
      type: 'Article',
      title: 'Prix téléphone Sénégal | Comparer avant achat',
      description: 'Comparer le prix d’un téléphone au Sénégal : modèle, stockage, état, batterie, garantie, accessoires et source à vérifier.',
      eyebrow: 'Téléphones',
      h1: 'Prix des téléphones au Sénégal : comparer le même appareil, pas seulement le même nom.',
      intro: 'Le marché du téléphone rassemble appareils neufs, reconditionnés et d’occasion, avec des capacités et états très différents. Une différence de prix peut être normale si les produits ne sont pas équivalents. Pour éviter une fausse bonne affaire, la comparaison doit être structurée autour de critères simples et vérifiables.',
      sections: [
        ['Modèle et capacité', 'Commencez par le modèle complet et la capacité de stockage. Une variante 128 Go ne doit pas être mise au même niveau qu’une 256 Go sans que la différence soit visible. Certaines gammes possèdent aussi plusieurs tailles ou versions réseau. Si le nom de l’annonce est incomplet, ouvrez la source ou demandez la référence exacte au vendeur avant de considérer le prix comme comparable.'],
        ['Neuf, occasion ou reconditionné', 'Ces états correspondent à des risques et garanties différents. Pour l’occasion, vérifiez l’écran, les caméras, les boutons, la charge, le réseau, les haut-parleurs et l’état de la batterie lorsque l’information est accessible. Pour un appareil reconditionné, demandez ce qui a été remplacé et quelle garantie est réellement fournie. Un prix très bas sans information d’état n’est pas automatiquement une meilleure offre.'],
        ['Accessoires et garantie', 'Chargeur, boîte, écouteurs, coque ou facture peuvent influencer la valeur d’un lot, mais ne doivent jamais masquer l’état du téléphone lui-même. La garantie mérite aussi d’être précisée : durée, vendeur qui la porte et conditions. Pour une dépense importante, privilégiez une vérification en personne ou un vendeur qui fournit des informations traçables avant paiement.'],
        ['Comparer au bon moment', 'Les prix peuvent bouger après une sortie de modèle, une période de forte demande ou l’arrivée de nouveaux stocks. Utilisez donc les résultats comme une photographie du marché, puis confirmez l’offre au moment de l’achat. SeneCompare aide à repérer et rapprocher les sources ; il ne transforme pas une ancienne annonce en disponibilité garantie. Cette distinction protège l’utilisateur et garde la comparaison crédible.'],
      ],
      related: [['Comparer maintenant', '/?q=telephone%20smartphone&category=phones'], ['Guide comparaison', '/guides/comparer-prix-senegal/'], ['DakarStyle', 'https://dakarstyle.com/']],
    },
    '/guides/services-dakar/': {
      type: 'Article',
      title: 'Comparer des services à Dakar | Guide SeneCompare',
      description: 'Trouver et comparer un service à Dakar : besoin, quartier, délai, prix, preuves, disponibilité et questions à poser avant de choisir.',
      eyebrow: 'Services Dakar',
      h1: 'Comparer un service à Dakar : transformer une demande vague en critères utiles.',
      intro: 'Pour un service, le prix seul explique encore moins la qualité qu’un produit. Déplacement, délai, matériel inclus, niveau d’expérience et zone couverte peuvent modifier fortement l’offre. La meilleure recherche commence par une description courte mais précise du résultat attendu.',
      sections: [
        ['Définir le besoin', 'Écrivez ce qui doit être fait, pour quand et dans quelle zone. “Réparation téléphone à Dakar” est un début ; ajouter le modèle, la panne et le quartier réduit les réponses hors sujet. Pour une livraison, précisez le type de colis, les points de départ et d’arrivée et le délai souhaité. Un moteur de comparaison peut alors rapprocher des services qui répondent réellement au même besoin.'],
        ['Comparer le périmètre inclus', 'Demandez ce que le prix couvre. Un tarif peut inclure le déplacement, les pièces ou une intervention complémentaire alors qu’un autre ne couvre que la main-d’œuvre. Pour les prestations créatives ou numériques, le nombre de livrables et de modifications compte également. Comparer des périmètres différents crée un classement trompeur même lorsque les montants sont exacts.'],
        ['Vérifier les preuves', 'Avis, exemples de travaux, identité du prestataire, adresse, numéro joignable et historique visible peuvent aider à évaluer une offre. Aucun signal isolé ne garantit la qualité. Pour un service sensible ou coûteux, privilégiez un échange direct et demandez une confirmation écrite du prix et du périmètre avant de commencer. SeneCompare peut faciliter la découverte, mais la relation contractuelle reste entre le client et le prestataire.'],
        ['Privilégier la proximité utile', 'Le prestataire le plus proche n’est pas toujours le meilleur, mais la distance peut peser sur le coût, la rapidité et le suivi. À Dakar, le temps de déplacement doit faire partie de la comparaison lorsque l’intervention est urgente. Une recherche géographiquement précise permet de réduire les résultats inutiles et d’obtenir une sélection plus adaptée au contexte quotidien.'],
      ],
      related: [['Chercher un service', '/?q=services%20professionnels%20Dakar'], ['Comparer les prix', '/guides/comparer-prix-senegal/'], ['Sama Business', 'https://samabusiness.dakarstyle.com/']],
    },
  },
  [HOSTS.sama]: {
    '/guides/gestion-commerce-senegal/': {
      type: 'Article',
      title: 'Gestion commerce Sénégal | Guide Sama Business',
      description: 'Organiser un commerce au Sénégal depuis le téléphone : ventes, stock, dettes, dépenses, bénéfice et commandes WhatsApp.',
      eyebrow: 'Guide Sama Business',
      h1: 'Gestion de commerce au Sénégal : garder une vue simple sur ce qui entre, sort et reste.',
      intro: 'Un petit commerce peut fonctionner avec beaucoup de ventes sans savoir exactement ce qu’il gagne. Lorsque ventes, dettes, dépenses et stock sont suivis dans des endroits différents, les décisions deviennent difficiles. L’objectif d’un outil de gestion n’est pas d’ajouter de l’administration : il doit réduire les oublis et rendre les chiffres lisibles sur téléphone.',
      sections: [
        ['Commencer par les mouvements essentiels', 'Enregistrez chaque vente avec le montant, le produit et le paiement réellement reçu. Ajoutez les dépenses au moment où elles ont lieu, même lorsqu’elles semblent petites. Séparez une vente payée d’une vente à crédit. Cette base permet ensuite de comprendre le cash disponible, le chiffre d’affaires et les sommes encore dues. Sans cette distinction, un total de ventes peut donner une impression de trésorerie qui n’existe pas réellement.'],
        ['Relier les ventes au stock', 'Lorsqu’un produit est vendu, son stock doit diminuer dans le même système. Cela évite de découvrir trop tard qu’une référence annoncée disponible ne l’est plus. Pour un commerce avec variantes, notez taille, couleur ou format lorsque c’est utile. Un stock simple mais à jour vaut mieux qu’un inventaire très détaillé qui n’est jamais maintenu. Les alertes doivent servir à agir, pas à remplir l’écran de notifications.'],
        ['Suivre les dettes sans gêner la relation client', 'Un cahier de dettes utile garde la date, le client, le montant initial, les paiements partiels et le reste. Une relance WhatsApp doit rester claire et respectueuse, avec les informations nécessaires pour éviter les malentendus. L’historique permet de répondre rapidement lorsqu’un client demande ce qu’il reste à payer. Les données privées de dette ne doivent évidemment pas être indexées ni exposées sur des pages publiques.'],
        ['Regarder le bénéfice, pas uniquement les ventes', 'Pour piloter un commerce, le volume de ventes ne suffit pas. Il faut tenir compte du coût d’achat, des dépenses de livraison, du transport, des commissions et des autres charges liées aux opérations. Un tableau de bord doit donc distinguer ce qui a été vendu, ce qui a été encaissé et ce qu’il reste réellement après dépenses. C’est cette lecture qui aide à décider quoi recommander et à quel prix.'],
      ],
      related: [['Ouvrir Sama Business', '/'], ['Cahier de dettes digital', '/guides/cahier-dettes-digital/'], ['Gestion du stock', '/guides/gestion-stock-dakar/']],
    },
    '/guides/cahier-dettes-digital/': {
      type: 'Article',
      title: 'Cahier de dettes digital Sénégal | Sama Business',
      description: 'Passer du cahier papier à un suivi digital des dettes : clients, acomptes, restes, relances WhatsApp et historique sur téléphone.',
      eyebrow: 'Dettes & acomptes',
      h1: 'Cahier de dettes digital : savoir qui doit quoi, sans feuille perdue ni calcul refait.',
      intro: 'Le crédit client fait partie du fonctionnement de nombreux commerces. Le problème apparaît lorsque les paiements partiels, dates et restes sont dispersés entre cahier, mémoire et messages WhatsApp. Un suivi digital doit conserver la simplicité du cahier tout en calculant automatiquement ce qui reste.',
      sections: [
        ['Une dette = un historique', 'Enregistrez le montant initial et chaque versement séparément plutôt que de remplacer le total à la main. L’historique permet de comprendre comment le reste a été calculé et d’éviter les discussions fondées sur des souvenirs différents. Ajoutez une note seulement si elle apporte une information utile, par exemple la commande concernée ou une date convenue. Le système doit rester rapide à consulter devant le client.'],
        ['Acompte et reste à payer', 'Un acompte n’est pas une vente entièrement encaissée. Le tableau de bord doit donc distinguer le montant de la commande, la somme déjà reçue et le reste. Cette séparation est particulièrement importante lorsque le commerçant doit engager une dépense de production ou de livraison avant de recevoir le solde. Elle évite de confondre chiffre d’affaires et argent réellement disponible.'],
        ['Relancer avec le bon contexte', 'Une bonne relance mentionne le nom, le montant restant et, si nécessaire, la commande. Elle évite le ton agressif et ne partage pas d’informations inutiles. Le bouton WhatsApp peut préparer le message, mais le commerçant doit garder le contrôle avant l’envoi. Pour la confidentialité, ces informations appartiennent à l’espace utilisateur ; les moteurs de recherche ne doivent jamais pouvoir parcourir une liste de clients ou de dettes.'],
        ['Sauvegarde et continuité', 'Le principal avantage du numérique est de retrouver l’information même lorsque le téléphone change ou qu’un cahier physique est perdu, à condition que l’application utilise un compte et une synchronisation correctement sécurisés. Exporter ou produire un reçu peut aussi servir de preuve commune. La technologie doit cependant rester compréhensible : si une opération importante échoue, l’application doit l’indiquer clairement au lieu de masquer l’erreur.'],
      ],
      related: [['Gestion commerce Sénégal', '/guides/gestion-commerce-senegal/'], ['Commandes WhatsApp', '/guides/commandes-whatsapp-commerce/'], ['SeneCompare', 'https://senecompare.dakarstyle.com/']],
    },
    '/guides/gestion-stock-dakar/': {
      type: 'Article',
      title: 'Gestion stock Dakar | Suivi simple pour boutique',
      description: 'Méthode de gestion de stock pour une boutique à Dakar : entrées, ventes, variantes, seuils et inventaire depuis le téléphone.',
      eyebrow: 'Stock & produits',
      h1: 'Gestion de stock à Dakar : connaître le disponible avant de promettre une vente.',
      intro: 'Le stock devient difficile à suivre dès qu’une boutique possède plusieurs tailles, couleurs ou références et vend à la fois sur place et par WhatsApp. Une gestion efficace doit enregistrer les mouvements au moment où ils se produisent et signaler les écarts assez tôt pour pouvoir agir.',
      sections: [
        ['Créer des produits identifiables', 'Donnez à chaque produit un nom stable et ajoutez les variantes qui changent réellement la disponibilité : taille, couleur, capacité ou format selon l’activité. Évitez de créer plusieurs fiches presque identiques lorsque le seul changement peut être représenté comme une variante. Cette structure rend les recherches plus rapides et limite les erreurs lors d’une vente ou d’un inventaire.'],
        ['Enregistrer entrées et sorties', 'Une réception fournisseur augmente le stock ; une vente confirmée le diminue. Les retours, pertes ou corrections doivent être identifiés séparément pour conserver une trace. Lorsque les mouvements sont saisis sans motif, un écart devient impossible à expliquer. Le but n’est pas de compliquer la vente, mais de disposer d’un historique minimal lorsque le stock affiché ne correspond pas au stock physique.'],
        ['Faire des contrôles courts', 'Un inventaire complet occasionnel reste utile, mais de petits contrôles réguliers sur les produits les plus vendus permettent de détecter plus vite les problèmes. Comparez la quantité physique à celle de l’application et corrigez avec une raison. Pour une activité mobile ou un marché, un écran conçu pour le téléphone est plus réaliste qu’un tableau complexe qui exige un ordinateur.'],
        ['Relier stock et décision d’achat', 'Le stock n’a de valeur que s’il aide à décider. Repérez les références qui tournent vite, celles qui immobilisent du cash et celles qui manquent souvent. Avant de recommander, regardez aussi la marge et les délais fournisseur. Une alerte de seuil est utile lorsqu’elle conduit à une action concrète ; trop d’alertes non prioritaires finissent au contraire par être ignorées.'],
      ],
      related: [['Ouvrir Sama Business', '/'], ['Gestion commerce', '/guides/gestion-commerce-senegal/'], ['Commandes WhatsApp', '/guides/commandes-whatsapp-commerce/']],
    },
    '/guides/commandes-whatsapp-commerce/': {
      type: 'Article',
      title: 'Commandes WhatsApp commerce Sénégal | Organisation simple',
      description: 'Organiser les commandes WhatsApp d’un commerce : client, produit, taille, acompte, livraison et statut sans perdre les messages.',
      eyebrow: 'WhatsApp commerce',
      h1: 'Commandes WhatsApp : transformer une conversation en commande suivie.',
      intro: 'WhatsApp est pratique pour vendre parce que le client l’utilise déjà. Mais une conversation n’est pas un système de gestion : une taille peut être oubliée, un acompte mal noté ou une adresse rester dans un ancien message. Le bon workflow conserve WhatsApp comme canal tout en transformant les informations essentielles en données structurées.',
      sections: [
        ['Capturer les informations essentielles', 'Pour chaque commande, gardez au minimum le client, le téléphone, le produit, la variante, la quantité, le montant, le paiement reçu et la zone de livraison. Une note libre peut compléter, mais elle ne doit pas remplacer les champs importants. Lorsque ces informations sont structurées, il devient possible de filtrer les commandes à livrer, celles en attente de solde ou celles qui nécessitent une préparation.'],
        ['Confirmer avant de produire ou livrer', 'Envoyez un récapitulatif lisible au client : produit, taille ou variante, quantité, prix, acompte et reste éventuel. Cette étape réduit les erreurs et crée une référence commune. Pour les produits personnalisés, ajoutez les informations comme le flocage dans un champ dédié et faites-les confirmer. Le message final doit être compréhensible sans que le client ait besoin de relire toute la conversation.'],
        ['Suivre un statut simple', 'Des statuts trop nombreux deviennent difficiles à maintenir. Quelques étapes suffisent souvent : nouvelle, confirmée, en préparation, prête, en livraison, livrée ou annulée. Le paiement peut être suivi séparément afin de ne pas confondre “livrée” et “payée”. Cette distinction est utile pour les acomptes et le paiement à la livraison. Le tableau de bord doit montrer immédiatement ce qui demande une action.'],
        ['Garder l’humain dans la boucle', 'L’automatisation peut préparer un récapitulatif, calculer un reste et ouvrir WhatsApp avec un message prêt. Elle ne doit pas envoyer aveuglément une relance ou modifier une commande ambiguë. Pour les opérations sensibles, une validation humaine est préférable. Le système devient alors un assistant qui réduit les tâches répétitives sans retirer au commerçant le contrôle de la relation client.'],
      ],
      related: [['Gestion commerce Sénégal', '/guides/gestion-commerce-senegal/'], ['Cahier de dettes', '/guides/cahier-dettes-digital/'], ['SeneCompare', 'https://senecompare.dakarstyle.com/']],
    },
  },
};

const AETHER_CSS = String.raw`
:root{color-scheme:dark;--ink:#f6f0df;--muted:#b8b6aa;--void:#06110e;--panel:rgba(16,37,30,.64);--line:rgba(244,239,216,.14);--gold:#d4a62a;--green:#0d7a4a;--red:#e2533d;--radius:26px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:radial-gradient(circle at 15% 0%,rgba(13,122,74,.22),transparent 32rem),radial-gradient(circle at 100% 25%,rgba(212,166,42,.14),transparent 27rem),linear-gradient(150deg,#06110e 0%,#081712 45%,#040907 100%);font:16px/1.72 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;overflow-x:hidden}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.35;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 86%)}a{color:inherit}.aether-orb{position:fixed;width:34rem;height:34rem;border-radius:50%;filter:blur(90px);opacity:.13;pointer-events:none;animation:float 14s ease-in-out infinite}.aether-orb.one{background:#0d7a4a;left:-14rem;top:25vh}.aether-orb.two{background:#d4a62a;right:-18rem;top:6vh;animation-delay:-6s}.shell{width:min(1160px,calc(100% - 36px));margin:auto}.nav{position:sticky;top:14px;z-index:20;margin:14px auto 0;padding:10px 12px 10px 18px;display:flex;align-items:center;gap:18px;justify-content:space-between;border:1px solid var(--line);border-radius:18px;background:rgba(6,17,14,.72);backdrop-filter:blur(20px) saturate(145%);box-shadow:0 20px 70px rgba(0,0,0,.22)}.brand{text-decoration:none;font-weight:900;letter-spacing:-.035em}.brand span{color:var(--gold)}.navlinks{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.navlinks a{padding:9px 12px;border-radius:12px;text-decoration:none;color:var(--muted);font-size:.86rem;font-weight:750}.navlinks a:hover,.navlinks a:focus-visible{background:rgba(255,255,255,.07);color:#fff;outline:none}.hero{padding:clamp(72px,11vw,154px) 0 70px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:clamp(34px,7vw,90px);align-items:end}.eyebrow{display:inline-flex;align-items:center;gap:10px;color:#f0ce6d;font-size:.76rem;letter-spacing:.17em;text-transform:uppercase;font-weight:900}.eyebrow:before{content:"";width:34px;height:1px;background:currentColor}.hero h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.25rem,8.3vw,7.7rem);font-weight:500;line-height:.88;letter-spacing:-.065em;margin:20px 0 26px;max-width:980px;text-wrap:balance}.hero .lead{max-width:780px;color:#d4d1c6;font-size:clamp(1.02rem,1.6vw,1.25rem)}.signal{border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));padding:24px;box-shadow:inset 0 1px rgba(255,255,255,.08),0 28px 70px rgba(0,0,0,.22);transform:perspective(900px) rotateY(-3deg)}.signal strong{display:block;font:500 clamp(2.4rem,5vw,4.5rem)/.95 Georgia,serif;color:#f4d26e}.signal p{color:var(--muted);margin:12px 0 0}.content{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:60px;padding:20px 0 90px}.article{min-width:0}.section{padding:36px 0;border-top:1px solid var(--line)}.section h2{font:500 clamp(1.75rem,3.3vw,3rem)/1.06 Georgia,serif;letter-spacing:-.035em;margin:0 0 17px;text-wrap:balance}.section p{margin:0;color:#c7c5bb;font-size:1.02rem}.aside{position:sticky;top:98px;height:max-content;border-left:1px solid var(--line);padding-left:22px}.aside h2{font-size:.75rem;letter-spacing:.13em;text-transform:uppercase;color:#8e958d;margin:0 0 14px}.related{display:grid;gap:8px}.related a{display:block;text-decoration:none;padding:12px 0;border-bottom:1px solid var(--line);font-weight:760}.related a:after{content:" ↗";color:var(--gold)}.related a:hover{color:#f0ce6d}.footer{border-top:1px solid var(--line);padding:30px 0 52px;color:#8e958d;font-size:.85rem}.footer .shell{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.network{margin:25px 0 90px;padding:clamp(24px,4vw,46px);border:1px solid var(--line);border-radius:32px;background:linear-gradient(135deg,rgba(13,122,74,.13),rgba(212,166,42,.08) 54%,rgba(226,83,61,.06));box-shadow:0 30px 90px rgba(0,0,0,.2)}.network h2{font:500 clamp(2rem,4.6vw,4.4rem)/.95 Georgia,serif;letter-spacing:-.05em;margin:0 0 24px}.network-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.network-card{min-height:175px;padding:22px;border:1px solid var(--line);border-radius:22px;background:rgba(5,14,11,.48);text-decoration:none;display:flex;flex-direction:column;justify-content:space-between;transition:transform .3s ease,border-color .3s ease,background .3s ease}.network-card:hover,.network-card:focus-visible{transform:translateY(-5px) perspective(800px) rotateX(1deg);border-color:rgba(212,166,42,.42);background:rgba(18,45,35,.68);outline:none}.network-card small{color:var(--gold);font-weight:850;letter-spacing:.08em;text-transform:uppercase}.network-card strong{font:500 1.55rem/1.05 Georgia,serif}.network-card span{color:#989c94;font-size:.84rem}@keyframes float{50%{transform:translate3d(2rem,-2rem,0) scale(1.08)}}@media(max-width:820px){.hero{grid-template-columns:1fr}.signal{transform:none;max-width:520px}.content{grid-template-columns:1fr}.aside{position:static;border-left:0;border-top:1px solid var(--line);padding:24px 0 0}.network-grid{grid-template-columns:1fr}.navlinks a:nth-child(n+3){display:none}}@media(max-width:540px){.shell{width:min(100% - 24px,1160px)}.hero{padding-top:64px}.hero h1{font-size:clamp(3rem,16vw,5.1rem)}.nav{top:8px;margin-top:8px}.navlinks a{padding:8px}.network{border-radius:24px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.aether-orb{animation:none}.network-card{transition:none}}`;

const HOME_AETHER_CSS = String.raw`
.aether-network-2027{position:relative;margin:clamp(46px,7vw,92px) auto;overflow:hidden;border-radius:32px;border:1px solid rgba(214,174,63,.24);background:radial-gradient(circle at 8% 0%,rgba(13,122,74,.2),transparent 38%),radial-gradient(circle at 95% 90%,rgba(212,166,42,.14),transparent 36%),#09130f;color:#f7f1df;box-shadow:0 32px 90px rgba(4,13,9,.2)}.aether-network-2027:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(to bottom,#000,transparent)}.aether-network-inner{position:relative;padding:clamp(26px,5vw,62px)}.aether-network-top{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(220px,.75fr);gap:30px;align-items:end;margin-bottom:30px}.aether-network-top small{display:block;color:#e4bd55;text-transform:uppercase;letter-spacing:.16em;font-weight:900;margin-bottom:12px}.aether-network-top h2{margin:0;color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.5rem,5vw,5.4rem);line-height:.91;letter-spacing:-.055em;font-weight:500}.aether-network-top p{color:#bfc7bf;margin:0;max-width:520px}.aether-network-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.aether-network-card{min-height:190px;display:flex;flex-direction:column;justify-content:space-between;padding:21px;border:1px solid rgba(255,255,255,.11);border-radius:21px;background:rgba(255,255,255,.045);color:inherit;text-decoration:none;backdrop-filter:blur(10px);transition:transform .28s ease,border-color .28s ease,background .28s ease}.aether-network-card:hover,.aether-network-card:focus-visible{transform:translateY(-5px);border-color:rgba(228,189,85,.52);background:rgba(255,255,255,.075);outline:none}.aether-network-card span{color:#e4bd55;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:900}.aether-network-card strong{font-family:Georgia,"Times New Roman",serif;font-size:1.45rem;line-height:1.04;font-weight:500}.aether-network-card em{font-style:normal;color:#9ea89f;font-size:.82rem}@media(max-width:900px){.aether-network-top{grid-template-columns:1fr}.aether-network-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.aether-network-2027{border-radius:24px}.aether-network-grid{grid-template-columns:1fr}.aether-network-card{min-height:150px}}@media(prefers-reduced-motion:reduce){.aether-network-card{transition:none}}`;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function absoluteUrl(origin, href) {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, `${origin}/`).toString();
}

function seoHeaders(contentType = 'text/html; charset=utf-8', robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1') {
  return new Headers({
    'content-type': contentType,
    'cache-control': contentType.startsWith('text/html') ? 'public, max-age=300, stale-while-revalidate=86400' : 'public, max-age=3600, stale-while-revalidate=86400',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'x-robots-tag': robots,
    'x-aether-seo-release': RELEASE,
  });
}

function structuredData(page, canonical, origin) {
  const orgName = origin.includes('senecompare') ? 'SeneCompare Sénégal' : origin.includes('samabusiness') ? 'Sama Business' : 'DakarStyle';
  const graph = [
    {
      '@type': page.type === 'Article' ? 'Article' : 'CollectionPage',
      '@id': `${canonical}#page`,
      url: canonical,
      headline: page.h1,
      name: page.title,
      description: page.description,
      inLanguage: 'fr-SN',
      datePublished: LASTMOD,
      dateModified: LASTMOD,
      author: { '@type': 'Organization', name: orgName, url: `${origin}/` },
      publisher: { '@type': 'Organization', name: orgName, url: `${origin}/` },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: orgName, item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: canonical },
      ],
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function renderGuide(page, url) {
  const origin = url.origin;
  const canonical = `${origin}${url.pathname}`;
  const related = (page.related || []).map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('');
  const sections = page.sections.map(([heading, body]) => `<section class="section"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join('');
  const siteLabel = url.hostname === HOSTS.sene ? 'SeneCompare' : url.hostname === HOSTS.sama ? 'Sama Business' : 'DakarStyle';
  const homeLabel = url.hostname === HOSTS.dakar ? 'Collection' : 'Application';
  return `<!doctype html><html lang="fr-SN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title><meta name="description" content="${escapeHtml(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="article"><meta property="og:site_name" content="${escapeHtml(siteLabel)}"><meta property="og:title" content="${escapeHtml(page.title)}"><meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#06110e"><style>${AETHER_CSS}</style><script type="application/ld+json">${structuredData(page, canonical, origin)}</script></head><body><div class="aether-orb one"></div><div class="aether-orb two"></div><header class="nav shell"><a class="brand" href="${origin}/">${escapeHtml(siteLabel)} <span>2027</span></a><nav class="navlinks" aria-label="Navigation"><a href="${origin}/">${homeLabel}</a><a href="https://dakarstyle.com/ecosysteme/">Écosystème</a><a href="https://senecompare.dakarstyle.com/">Comparer</a><a href="https://samabusiness.dakarstyle.com/">Gérer</a></nav></header><main class="shell"><section class="hero"><div><div class="eyebrow">${escapeHtml(page.eyebrow)}</div><h1>${escapeHtml(page.h1)}</h1><p class="lead">${escapeHtml(page.intro)}</p></div><aside class="signal" aria-label="Repère éditorial"><strong>01</strong><p>Une page canonique, un sujet précis, des sources et des actions compréhensibles.</p></aside></section><div class="content"><article class="article">${sections}</article><aside class="aside"><h2>Continuer</h2><div class="related">${related}</div></aside></div></main><footer class="footer"><div class="shell"><span>${escapeHtml(siteLabel)} · Sénégal · ${LASTMOD}</span><span>Architecture AETHER · ${RELEASE}</span></div></footer></body></html>`;
}

function sitemap(origin, paths) {
  const urls = paths.map((path) => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc><lastmod>${LASTMOD}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsFor(host) {
  if (host === HOSTS.dakar) return `User-agent: *\nAllow: /\nDisallow: /social-intelligence/\nDisallow: /api/social-intelligence/\nDisallow: /admin.html\n\nSitemap: https://${HOSTS.dakar}/sitemap.xml\n`;
  if (host === HOSTS.sene) return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /__/\n\nSitemap: https://${HOSTS.sene}/sitemap.xml\n`;
  if (host === HOSTS.sama) return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /sites/\nDisallow: /site-preview\n\nSitemap: https://${HOSTS.sama}/sitemap.xml\n`;
  return `User-agent: *\nAllow: /\n\n# Alias historique : les pages publiques canoniques vivent sur https://${HOSTS.sama}/\n`;
}

function llmsFor(host) {
  if (host === HOSTS.dakar) return `# DakarStyle\n\nDakarStyle est un hub sénégalais de mode urbaine, culture et commerce numérique.\n\n## Canonical\nhttps://${HOSTS.dakar}/\n\n## Public surfaces\n- https://${HOSTS.dakar}/ecosysteme/\n- https://${HOSTS.dakar}/journal/streetwear-senegal-2026/\n- https://${HOSTS.dakar}/journal/maillot-senegal-2026-guide/\n- https://${HOSTS.sene}/\n- https://${HOSTS.sama}/\n- https://sowhatafrica.com/\n\nPrivate/admin routes are not public knowledge surfaces.\n`;
  if (host === HOSTS.sene) return `# SeneCompare Sénégal\n\nComparateur de produits, prix et services au Sénégal, avec expérience en français et wolof.\nCanonical: https://${HOSTS.sene}/\nGuides: https://${HOSTS.sene}/guides/comparer-prix-senegal/\n`;
  return `# Sama Business Sénégal\n\nApplication de gestion pour ventes, stock, dettes, dépenses, livraisons et commandes WhatsApp.\nCanonical: https://${HOSTS.sama}/\nGuides: https://${HOSTS.sama}/guides/gestion-commerce-senegal/\nPrivate user data and application state are excluded from indexing.\n`;
}

function pathListFor(host) {
  const guidePaths = Object.keys(GUIDE_PAGES[host] || {});
  if (host === HOSTS.dakar) return ['/', ...DAKAR_PRODUCT_URLS, ...guidePaths];
  if (host === HOSTS.sene || host === HOSTS.sama) return ['/', ...guidePaths];
  return [];
}

function withHeadValue(html, regex, value, fallback) {
  if (regex.test(html)) return html.replace(regex, value);
  return html.replace(/<\/head>/i, `${fallback}</head>`);
}

function upsertCanonical(html, canonical) {
  const tag = `<link rel="canonical" href="${canonical}">`;
  return withHeadValue(html, /<link\s+rel=["']canonical["'][^>]*>/i, tag, tag);
}

function upsertMetaName(html, name, content) {
  const safe = escapeHtml(content);
  const tag = `<meta name="${name}" content="${safe}">`;
  const pattern = new RegExp(`<meta\\s+name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  return withHeadValue(html, pattern, tag, tag);
}

function upsertMetaProperty(html, property, content) {
  const safe = escapeHtml(content);
  const tag = `<meta property="${property}" content="${safe}">`;
  const pattern = new RegExp(`<meta\\s+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  return withHeadValue(html, pattern, tag, tag);
}

function upsertTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`;
  return /<title[^>]*>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, tag) : html.replace(/<\/head>/i, `${tag}</head>`);
}

function addJsonLd(html, id, data) {
  if (html.includes(`data-aether-schema="${id}"`)) return html;
  const tag = `<script type="application/ld+json" data-aether-schema="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  return html.replace(/<\/head>/i, `${tag}</head>`);
}

function injectDakarHome(html) {
  let output = upsertTitle(html, 'DakarStyle Sénégal | Streetwear & Sowhat Africa à Dakar');
  output = upsertMetaName(output, 'description', 'DakarStyle : streetwear sénégalais, collections Sowhat Africa, guides culture & tailles, SeneCompare et outils commerce depuis Dakar.');
  output = upsertMetaName(output, 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  output = upsertCanonical(output, `https://${HOSTS.dakar}/`);
  output = upsertMetaProperty(output, 'og:title', 'DakarStyle Sénégal | Streetwear, culture & innovation');
  output = upsertMetaProperty(output, 'og:description', 'Mode urbaine sénégalaise, Sowhat Africa et un écosystème digital construit depuis Dakar.');
  output = upsertMetaProperty(output, 'og:url', `https://${HOSTS.dakar}/`);
  output = addJsonLd(output, 'dakarstyle-root', {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `https://${HOSTS.dakar}/#organization`, name: 'DakarStyle', url: `https://${HOSTS.dakar}/`, sameAs: ['https://www.instagram.com/dakarstyle_sn/'], areaServed: { '@type': 'Country', name: 'Sénégal' } },
      { '@type': 'WebSite', '@id': `https://${HOSTS.dakar}/#website`, url: `https://${HOSTS.dakar}/`, name: 'DakarStyle', publisher: { '@id': `https://${HOSTS.dakar}/#organization` }, inLanguage: 'fr-SN' },
      { '@type': 'Store', '@id': `https://${HOSTS.dakar}/#store`, name: 'DakarStyle x Sowhat Africa', url: `https://${HOSTS.dakar}/`, telephone: '+221773374762', parentOrganization: { '@id': `https://${HOSTS.dakar}/#organization` }, address: { '@type': 'PostalAddress', addressLocality: 'Dakar', addressCountry: 'SN' } },
    ],
  });
  if (!output.includes('data-aether-network="2027"')) {
    const style = `<style data-aether-network-style="2027">${HOME_AETHER_CSS}</style>`;
    output = output.replace(/<\/head>/i, `${style}</head>`);
    const section = `<section class="aether-network-2027 container" data-aether-network="2027" aria-labelledby="aether-network-title"><div class="aether-network-inner"><div class="aether-network-top"><div><small>DakarStyle Intelligence Network</small><h2 id="aether-network-title">Style, prix et commerce. Un seul écosystème.</h2></div><p>Chaque produit garde son identité. Les outils se renforcent entre eux sans mélanger leurs intentions de recherche.</p></div><div class="aether-network-grid"><a class="aether-network-card" href="/ecosysteme/"><span>Journal</span><strong>Culture & guides Dakar</strong><em>Streetwear, tailles, diaspora</em></a><a class="aether-network-card" href="https://${HOSTS.sene}/"><span>Comparer</span><strong>SeneCompare Sénégal</strong><em>Produits, prix et services</em></a><a class="aether-network-card" href="https://${HOSTS.sama}/"><span>Gérer</span><strong>Sama Business</strong><em>Ventes, stock, dettes, WhatsApp</em></a><a class="aether-network-card" href="https://sowhatafrica.com/"><span>Marque</span><strong>Sowhat Africa</strong><em>Culture for Winners</em></a></div></div></section>`;
    output = /<\/main>/i.test(output) ? output.replace(/<\/main>/i, `${section}</main>`) : output.replace(/<\/body>/i, `${section}</body>`);
  }
  return output;
}

function injectSeneRoot(html) {
  let output = upsertTitle(html, 'SeneCompare Sénégal | Comparer prix, produits et services');
  output = upsertMetaName(output, 'description', 'Comparez produits, prix et services au Sénégal en français ou en wolof, avec sources visibles et recherche pensée pour Dakar et les régions.');
  output = upsertMetaName(output, 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  output = upsertCanonical(output, `https://${HOSTS.sene}/`);
  output = upsertMetaProperty(output, 'og:title', 'SeneCompare Sénégal | Comparer avant de choisir');
  output = upsertMetaProperty(output, 'og:description', 'Recherche et comparaison de produits et services au Sénégal, en français et wolof.');
  output = upsertMetaProperty(output, 'og:url', `https://${HOSTS.sene}/`);
  output = addJsonLd(output, 'senecompare-root', {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SeneCompare Sénégal', url: `https://${HOSTS.sene}/`, applicationCategory: 'ShoppingApplication', operatingSystem: 'Web', inLanguage: ['fr-SN', 'wo-SN'], areaServed: { '@type': 'Country', name: 'Sénégal' }, description: 'Comparateur de produits, prix et services au Sénégal avec sources visibles.', publisher: { '@type': 'Organization', name: 'DakarStyle', url: `https://${HOSTS.dakar}/` },
  });
  return output;
}

function injectSamaRoot(html) {
  let output = upsertTitle(html, 'Sama Business Sénégal | Gestion ventes, stock & WhatsApp');
  output = upsertMetaName(output, 'description', 'Gérez ventes, stock, dettes, dépenses, livraisons, commandes WhatsApp et création de site depuis votre téléphone au Sénégal.');
  output = upsertMetaName(output, 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  output = upsertCanonical(output, `https://${HOSTS.sama}/`);
  output = upsertMetaProperty(output, 'og:title', 'Sama Business Sénégal | Votre commerce, simplement');
  output = upsertMetaProperty(output, 'og:description', 'Ventes, stock, dettes, livraisons, WhatsApp et création de site depuis le téléphone.');
  output = upsertMetaProperty(output, 'og:url', `https://${HOSTS.sama}/`);
  output = addJsonLd(output, 'samabusiness-root', {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Sama Business', url: `https://${HOSTS.sama}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', inLanguage: ['fr-SN', 'wo-SN'], areaServed: { '@type': 'Country', name: 'Sénégal' }, description: 'Application de gestion mobile pour ventes, stock, dettes, dépenses, livraisons et commandes WhatsApp.', publisher: { '@type': 'Organization', name: 'DakarStyle', url: `https://${HOSTS.dakar}/` },
  });
  return output;
}

function injectLegacyCanonical(html) {
  let output = upsertMetaName(html, 'robots', 'noindex,follow,noarchive');
  output = upsertCanonical(output, `https://${HOSTS.sama}/`);
  return output;
}

function responseWithBody(request, response, body, headers) {
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(request.method === 'HEAD' ? null : body, { status: response.status, statusText: response.statusText, headers });
}

export function handleEcosystemSeoRequest(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (host === HOSTS.dakarWww) {
    const target = new URL(request.url);
    target.hostname = HOSTS.dakar;
    const headers = new Headers({ location: target.toString(), 'cache-control': 'public, max-age=86400', 'x-aether-seo-release': RELEASE });
    return new Response(null, { status: 308, headers });
  }

  if (![HOSTS.dakar, HOSTS.sene, HOSTS.sama, HOSTS.samaLegacy].includes(host)) return null;

  if (url.pathname === '/robots.txt') {
    return new Response(request.method === 'HEAD' ? null : robotsFor(host), { status: 200, headers: seoHeaders('text/plain; charset=utf-8', 'noindex') });
  }
  if (url.pathname === '/llms.txt') {
    const canonicalHost = host === HOSTS.samaLegacy ? HOSTS.sama : host;
    return new Response(request.method === 'HEAD' ? null : llmsFor(canonicalHost), { status: 200, headers: seoHeaders('text/plain; charset=utf-8', 'noindex') });
  }
  if (url.pathname === '/sitemap.xml') {
    if (host === HOSTS.samaLegacy) return Response.redirect(`https://${HOSTS.sama}/sitemap.xml`, 308);
    const body = sitemap(`https://${host}`, pathListFor(host));
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: seoHeaders('application/xml; charset=utf-8', 'noindex') });
  }

  if (host === HOSTS.samaLegacy && url.pathname.startsWith('/guides/')) {
    const target = new URL(request.url);
    target.hostname = HOSTS.sama;
    return Response.redirect(target.toString(), 308);
  }

  const page = GUIDE_PAGES[host]?.[url.pathname];
  if (page && !url.search) return new Response(request.method === 'HEAD' ? null : renderGuide(page, url), { status: 200, headers: seoHeaders() });
  return null;
}

export async function transformEcosystemSeoResponse(request, response) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (![HOSTS.dakar, HOSTS.sene, HOSTS.sama, HOSTS.samaLegacy].includes(host)) return response;

  const headers = new Headers(response.headers);
  headers.set('x-aether-seo-release', RELEASE);
  const contentType = String(headers.get('content-type') || '').toLowerCase();
  const html = contentType.includes('text/html');
  const rootPath = url.pathname === '/' || url.pathname === '/index.html';
  const cleanRoot = rootPath && !url.search;

  if (host === HOSTS.dakar) {
    if (rootPath) {
      headers.set('link', `<https://${HOSTS.dakar}/>; rel="canonical"`);
      headers.set('x-robots-tag', cleanRoot ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow');
      if (html && request.method !== 'HEAD') return responseWithBody(request, response, injectDakarHome(await response.text()), headers);
    }
    return responseWithBody(request, response, response.body, headers);
  }

  if (host === HOSTS.sene) {
    const publicRoot = cleanRoot && html && response.ok;
    headers.set('link', `<https://${HOSTS.sene}/>; rel="canonical"`);
    headers.set('x-robots-tag', publicRoot ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : headers.get('x-robots-tag') || 'noindex, follow');
    if (publicRoot && request.method !== 'HEAD') return responseWithBody(request, response, injectSeneRoot(await response.text()), headers);
    return responseWithBody(request, response, response.body, headers);
  }

  if (host === HOSTS.sama) {
    const publicRoot = cleanRoot && html && response.ok;
    if (rootPath) headers.set('link', `<https://${HOSTS.sama}/>; rel="canonical"`);
    if (publicRoot) {
      headers.set('x-robots-tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      if (request.method !== 'HEAD') return responseWithBody(request, response, injectSamaRoot(await response.text()), headers);
    }
    return responseWithBody(request, response, response.body, headers);
  }

  headers.set('x-robots-tag', 'noindex, follow, noarchive');
  if (rootPath) headers.set('link', `<https://${HOSTS.sama}/>; rel="canonical"`);
  if (html && rootPath && request.method !== 'HEAD') return responseWithBody(request, response, injectLegacyCanonical(await response.text()), headers);
  return responseWithBody(request, response, response.body, headers);
}

export const __testing = Object.freeze({
  RELEASE,
  LASTMOD,
  HOSTS,
  DAKAR_PRODUCT_URLS,
  GUIDE_PAGES,
  pathListFor,
  robotsFor,
  llmsFor,
  injectDakarHome,
  injectSeneRoot,
  injectSamaRoot,
  injectLegacyCanonical,
});
