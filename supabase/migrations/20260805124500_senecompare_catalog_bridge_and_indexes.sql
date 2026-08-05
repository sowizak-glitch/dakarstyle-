begin;

create index if not exists senecompare_price_alerts_offer_idx
  on public.senecompare_price_alerts (offer_id);

create index if not exists senecompare_price_reports_reporter_idx
  on public.senecompare_price_reports (reporter_user_id);

create index if not exists senecompare_search_events_user_idx
  on public.senecompare_search_events (user_id);

create or replace function public.senecompare_search_catalog(
  p_query text default '',
  p_category text default 'all',
  p_city text default 'Sénégal',
  p_max_price bigint default 0,
  p_condition text default 'all',
  p_seller_type text default 'all',
  p_limit integer default 100
)
returns table (
  id text,
  title text,
  category text,
  seller text,
  seller_type text,
  city text,
  price bigint,
  currency text,
  condition text,
  source_name text,
  source_url text,
  verified_at timestamptz,
  published_at timestamptz,
  cross_checks integer,
  seller_verified boolean,
  price_consistency numeric,
  image_url text,
  description text,
  status text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with normalized as (
    select
      o.id::text as id,
      left(o.title, 180) as title,
      case lower(p.category)
        when 'telephone' then 'phones'
        when 'voiture' then 'cars'
        when 'moto' then 'motorcycles'
        when 'electromenager' then 'appliances'
        when 'informatique' then 'computing'
        when 'mode' then 'fashion'
        when 'maison' then 'home'
        else 'professional'
      end as category,
      left(coalesce(nullif(o.seller_name, ''), s.name, 'Vendeur à confirmer'), 160) as seller,
      case
        when coalesce(o.seller_name, '') ~* '(boutique|officielle|technologie|business|astech|store|shop|sarl|sa$)' then 'merchant'
        else 'individual'
      end as seller_type,
      case
        when coalesce(o.location, '') ilike '%Dakar%' then 'Dakar'
        when coalesce(o.location, '') ilike '%Thiès%' or coalesce(o.location, '') ilike '%Thies%' then 'Thiès'
        when coalesce(o.location, '') ilike '%Saint-Louis%' then 'Saint-Louis'
        when coalesce(o.location, '') ilike '%Mbour%' or coalesce(o.location, '') ilike '%Saly%' then 'Mbour'
        when coalesce(o.location, '') ilike '%Touba%' then 'Touba'
        when coalesce(o.location, '') ilike '%Kaolack%' then 'Kaolack'
        when coalesce(o.location, '') ilike '%Ziguinchor%' then 'Ziguinchor'
        when coalesce(o.location, '') ilike '%Louga%' then 'Louga'
        else 'Sénégal'
      end as city,
      o.price_fcfa::bigint as price,
      'XOF'::text as currency,
      case
        when coalesce(o.condition, '') ilike 'recondition%' then 'refurbished'
        when coalesce(o.condition, '') ilike 'neuf%' then 'new'
        when coalesce(o.condition, '') ilike 'nouveau%' then 'new'
        else 'used'
      end as condition,
      left(s.name, 160) as source_name,
      o.source_url,
      o.fetched_at as verified_at,
      o.created_at as published_at,
      1::integer as cross_checks,
      (s.reliability_score >= 0.90 and coalesce(o.seller_name, '') ~* '(boutique|officielle|sarl|sa$)') as seller_verified,
      least(1::numeric, greatest(0::numeric, coalesce(o.confidence, 0.5))) as price_consistency,
      o.image_url,
      left(concat_ws(' · ', nullif(p.canonical_name, ''), nullif(o.availability, ''), nullif(o.location, '')), 600) as description,
      case
        when o.expires_at <= now() then 'stale'
        when s.reliability_score >= 0.90 and o.confidence >= 0.90 then 'verified'
        else 'confirm'
      end as status,
      p.search_text,
      p.canonical_name
    from public.sc_offers o
    join public.sc_products p on p.id = o.product_id
    join public.sc_sources s on s.id = o.source_id
    where s.status = 'active'
      and s.robots_status = 'allowed'
      and o.price_fcfa > 0
      and o.fetched_at > now() - interval '14 days'
  )
  select
    n.id, n.title, n.category, n.seller, n.seller_type, n.city,
    n.price, n.currency, n.condition, n.source_name, n.source_url,
    n.verified_at, n.published_at, n.cross_checks, n.seller_verified,
    n.price_consistency, n.image_url, n.description, n.status
  from normalized n
  where
    (coalesce(trim(p_query), '') = ''
      or n.search_text ilike '%' || trim(p_query) || '%'
      or n.canonical_name ilike '%' || trim(p_query) || '%'
      or n.title ilike '%' || trim(p_query) || '%')
    and (p_category = 'all' or n.category = p_category)
    and (p_city = 'Sénégal' or n.city = p_city)
    and (coalesce(p_max_price, 0) <= 0 or n.price <= p_max_price)
    and (p_condition = 'all' or n.condition = p_condition)
    and (p_seller_type = 'all' or n.seller_type = p_seller_type)
  order by
    case n.status when 'verified' then 0 when 'confirm' then 1 else 2 end,
    n.verified_at desc,
    n.price asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

revoke all on function public.senecompare_search_catalog(text, text, text, bigint, text, text, integer) from public;
grant execute on function public.senecompare_search_catalog(text, text, text, bigint, text, text, integer) to anon, authenticated, service_role;

comment on function public.senecompare_search_catalog(text, text, text, bigint, text, text, integer)
is 'Read-only bridge exposing a bounded, normalized subset of the service-only SeneCompare catalog.';

commit;
