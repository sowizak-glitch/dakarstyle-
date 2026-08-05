create table if not exists public.senecompare_source_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  domain text not null unique,
  base_url text not null,
  categories text[] not null default '{}',
  regions text[] not null default array['Sénégal']::text[],
  category_urls jsonb not null default '{}'::jsonb,
  search_url_template text,
  source_kind text not null default 'marketplace' check (source_kind in ('marketplace','merchant','service','directory','official','comparator')),
  trust_weight numeric(4,3) not null default 0.70 check (trust_weight between 0 and 1),
  supports_prices boolean not null default false,
  supports_direct_search boolean not null default false,
  active boolean not null default true,
  priority smallint not null default 50 check (priority between 0 and 100),
  label_fr text,
  label_wo text,
  last_reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists senecompare_source_directory_categories_gin on public.senecompare_source_directory using gin (categories);
create index if not exists senecompare_source_directory_active_priority_idx on public.senecompare_source_directory (active, priority desc, trust_weight desc);

alter table public.senecompare_source_directory enable row level security;
revoke all on table public.senecompare_source_directory from anon, authenticated;
grant select, insert, update, delete on table public.senecompare_source_directory to service_role;

insert into public.senecompare_source_directory
(name, domain, base_url, categories, regions, category_urls, search_url_template, source_kind, trust_weight, supports_prices, supports_direct_search, priority, label_fr, label_wo)
values
('CoinAfrique Sénégal','sn.coinafrique.com','https://sn.coinafrique.com',array['telephone','informatique','electromenager','voiture','moto','mode','beaute','maison','materiel','immobilier','artisanat','education'],array['Sénégal'],jsonb_build_object('telephone','https://sn.coinafrique.com/categorie/telephones-et-tablettes','informatique','https://sn.coinafrique.com/categorie/ordinateurs','electromenager','https://sn.coinafrique.com/categorie/electromenager','voiture','https://sn.coinafrique.com/categorie/voitures','moto','https://sn.coinafrique.com/categorie/motos-et-scooters','mode','https://sn.coinafrique.com/categorie/mode-et-beaute','maison','https://sn.coinafrique.com/categorie/pour-la-maison','materiel','https://sn.coinafrique.com/categorie/materiel-pro','immobilier','https://sn.coinafrique.com/categorie/immobilier','artisanat','https://sn.coinafrique.com/categorie/services','education','https://sn.coinafrique.com/categorie/cours-particuliers'),null,'marketplace',0.91,true,false,100,'Annonces locales avec prix et contact vendeur','Anons yu dëgg ak njëg'),
('Expat-Dakar','expat-dakar.com','https://www.expat-dakar.com',array['telephone','informatique','electromenager','voiture','moto','mode','maison','materiel','immobilier','artisanat','education','emploi'],array['Sénégal'],jsonb_build_object('general','https://www.expat-dakar.com/annonces','voiture','https://www.expat-dakar.com/voitures','immobilier','https://www.expat-dakar.com/immobilier'),null,'marketplace',0.92,true,false,98,'Grande marketplace sénégalaise','Marketplace bu mag ci Senegaal'),
('Nopalou','nopalou.com','https://nopalou.com',array['telephone','informatique','electromenager','voiture','moto','mode','beaute','maison','materiel','immobilier','artisanat','general'],array['Sénégal'],jsonb_build_object('general','https://nopalou.com/'),null,'comparator',0.82,true,false,90,'Comparateur de prix sénégalais','Jumtukaay méngale njëg'),
('SeneJokko','senejokko.sn','https://www.senejokko.sn',array['telephone','informatique','electromenager','voiture','moto','mode','maison','immobilier','general'],array['Sénégal'],jsonb_build_object('general','https://www.senejokko.sn/'),null,'marketplace',0.78,true,false,80,'Annonces locales par ville','Anons yu dëgg ci dëkk yi'),
('DJARNA','djarna.com','https://www.djarna.com',array['telephone','informatique','electromenager','voiture','moto','mode','beaute','maison','general'],array['Sénégal'],jsonb_build_object('general','https://www.djarna.com/'),null,'marketplace',0.78,true,false,78,'Marketplace mobile pensée au Sénégal','Marketplace bu ñu def ngir Senegaal'),
('Occasion Dakar','occasiondakar.com','https://occasiondakar.com',array['telephone','informatique','electromenager','voiture','moto','mode','maison','immobilier','general'],array['Dakar','Sénégal'],jsonb_build_object('general','https://occasiondakar.com/'),null,'marketplace',0.74,true,false,72,'Petites annonces et occasions à Dakar','Anons occasion ci Dakar'),
('Jumia Sénégal','jumia.sn','https://www.jumia.sn',array['telephone','informatique','electromenager','mode','beaute','maison','materiel'],array['Sénégal'],jsonb_build_object('general','https://www.jumia.sn/catalog/'),'https://www.jumia.sn/catalog/?q={query}','merchant',0.86,true,true,94,'Catalogue e-commerce neuf','Catalogue marchand yu bees'),
('Boutique Sénégal','boutiquesenegal.com','https://www.boutiquesenegal.com',array['mode','beaute','maison'],array['Sénégal'],jsonb_build_object('mode','https://www.boutiquesenegal.com/categorie-produit/tissu'),null,'merchant',0.82,true,false,82,'Wax, bazin et produits locaux','Wax, bazin ak yëf yu dëgg'),
('Sowhat Africa','sowhatafrica.com','https://sowhatafrica.com',array['mode','sport'],array['Sénégal','Dakar'],jsonb_build_object('mode','https://sowhatafrica.com/'),null,'merchant',0.88,true,false,88,'Mode et sportswear africain','Yére ak sportswear Afrig'),
('KSS Textile','ksstextile.com','https://ksstextile.com',array['mode'],array['Dakar','Sénégal'],jsonb_build_object('mode','https://ksstextile.com/'),null,'merchant',0.80,false,false,76,'Tissus en gros et au détail','Tissu ci gros ak détail'),
('Yango Sénégal','yango.com','https://yango.com/fr_sn/rider/',array['transport'],array['Dakar','Sénégal'],jsonb_build_object('transport','https://yango.com/fr_sn/rider/'),null,'service',0.90,false,false,95,'Taxi et mobilité locale','Taxi ak dem-dikk'),
('Yassir Sénégal','yassir.com','https://yassir.com/fr/senegal/ride-hailing',array['transport','livraison','restauration'],array['Dakar','Sénégal'],jsonb_build_object('transport','https://yassir.com/fr/senegal/ride-hailing','livraison','https://yassir.com/fr/senegal/delivery'),null,'service',0.88,false,false,92,'Transport et livraison','Transport ak livraison'),
('Heetch Sénégal','heetch.com','https://www.heetch.com/fr/pays/senegal',array['transport'],array['Dakar','Sénégal'],jsonb_build_object('transport','https://www.heetch.com/fr/pays/senegal'),null,'service',0.86,false,false,88,'VTC au Sénégal','VTC ci Senegaal'),
('Tiak-Tiak','tiaktiak.sn','https://tiaktiak.sn',array['livraison'],array['Dakar','Sénégal'],jsonb_build_object('livraison','https://tiaktiak.sn/'),null,'service',0.88,false,false,92,'Livraison de colis au Sénégal','Yóbbu colis ci Senegaal'),
('DEM','dem.sn','https://www.dem.sn',array['livraison'],array['Dakar','Sénégal'],jsonb_build_object('livraison','https://www.dem.sn/'),null,'service',0.88,false,false,90,'Livraison express locale','Livraison express'),
('La Poste Sénégal','laposte.sn','https://www.laposte.sn',array['livraison'],array['Sénégal'],jsonb_build_object('livraison','https://www.laposte.sn/services/'),null,'official',0.95,false,false,96,'Courrier et colis officiels','Poste ak colis'),
('YUM-YUM','yumyum.sn','https://www.yumyum.sn',array['restauration'],array['Dakar'],jsonb_build_object('restauration','https://www.yumyum.sn/menu/pizzas.html'),null,'merchant',0.84,true,false,86,'Menu et livraison de pizzas','Pizza ak livraison'),
('Go Pizza Dakar','gopizzadakar.com','https://gopizzadakar.com',array['restauration'],array['Dakar'],jsonb_build_object('restauration','https://gopizzadakar.com/'),null,'merchant',0.82,true,false,82,'Pizzeria et commande à Dakar','Pizza ci Dakar'),
('Pizzammore Dakar','pizzammoredakar.com','https://pizzammoredakar.com',array['restauration'],array['Dakar'],jsonb_build_object('restauration','https://pizzammoredakar.com/index.php/menu-pizzammore-dakar/'),null,'merchant',0.82,true,false,80,'Menu de pizzeria à Dakar','Menu pizza ci Dakar'),
('La Coquette Dakar','lacoquettedakar.com','https://www.lacoquettedakar.com',array['coiffure','beaute'],array['Dakar'],jsonb_build_object('coiffure','https://www.lacoquettedakar.com/'),null,'service',0.84,false,false,82,'Coiffure et esthétique','Coiffure ak taar'),
('Michele KA','micheleka.com','https://www.micheleka.com',array['coiffure','beaute'],array['Dakar'],jsonb_build_object('coiffure','https://www.micheleka.com/'),null,'service',0.82,false,false,80,'Salon de coiffure à Dakar','Salon coiffure ci Dakar'),
('DEB Beauté','debbeaute.sn','https://www.debbeaute.sn',array['coiffure','beaute'],array['Dakar'],jsonb_build_object('coiffure','https://www.debbeaute.sn/'),null,'service',0.82,false,false,80,'Beauté et soins à Dakar','Taar ak soins ci Dakar'),
('Go Africa Online Sénégal','goafricaonline.com','https://www.goafricaonline.com/sn',array['artisanat','sante','education','finance','immobilier','coiffure','livraison','restauration','general'],array['Sénégal'],jsonb_build_object('general','https://www.goafricaonline.com/sn/annuaire'),null,'directory',0.76,false,false,74,'Annuaire professionnel du Sénégal','Annuaire liggéeykat yi'),
('SenPages','senpages.com','https://www.senpages.com',array['artisanat','sante','education','finance','immobilier','coiffure','livraison','restauration','general'],array['Sénégal'],jsonb_build_object('general','https://www.senpages.com/'),null,'directory',0.72,false,false,70,'Annuaire d’entreprises et services','Annuaire entreprise ak services')
on conflict (domain) do update set
  name=excluded.name, base_url=excluded.base_url, categories=excluded.categories, regions=excluded.regions,
  category_urls=excluded.category_urls, search_url_template=excluded.search_url_template, source_kind=excluded.source_kind,
  trust_weight=excluded.trust_weight, supports_prices=excluded.supports_prices, supports_direct_search=excluded.supports_direct_search,
  priority=excluded.priority, label_fr=excluded.label_fr, label_wo=excluded.label_wo, active=true, last_reviewed_at=now(), updated_at=now();
