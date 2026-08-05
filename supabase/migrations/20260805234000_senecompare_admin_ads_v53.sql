begin;

create extension if not exists pgcrypto;

create table if not exists public.senecompare_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'owner' check (role in ('owner','admin','analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);

insert into public.senecompare_admin_users (user_id, email, role, active)
select id, lower(email), 'owner', true
from auth.users
where lower(email) = 'idrissaminata@gmail.com'
on conflict (user_id) do update
set email = excluded.email,
    role = 'owner',
    active = true,
    updated_at = now();

create table if not exists public.senecompare_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  brand text not null,
  badge_fr text not null default 'Partenaire',
  badge_wo text not null default 'Partenaire',
  title_fr text not null,
  title_wo text not null,
  description_fr text not null,
  description_wo text not null,
  cta_fr text not null,
  cta_wo text not null,
  destination_url text not null check (destination_url ~ '^https://'),
  image_url text,
  creative jsonb not null default '{}'::jsonb,
  priority integer not null default 50 check (priority between 0 and 1000),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (image_url is null or image_url ~ '^https://'),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

insert into public.senecompare_ad_campaigns (
  slug, brand, badge_fr, badge_wo, title_fr, title_wo,
  description_fr, description_wo, cta_fr, cta_wo,
  destination_url, creative, priority, active
) values
(
  'samabusiness-launch',
  'SamaBusiness',
  'Application partenaire',
  'Application partenaire',
  'Votre commerce dans votre téléphone',
  'Sa bisnis ci sa telefon',
  'Ventes, stock, dettes, dépenses et bénéfices réunis dans une application simple.',
  'Jaay, stock, bor, depaas ak bénéfice lépp ci benn application bu yomb.',
  'Installer SamaBusiness',
  'Tàmbali SamaBusiness',
  'https://samabusiness.dakarstyle.com/?utm_source=senecompare&utm_medium=house_banner&utm_campaign=samabusiness_launch',
  '{"mark":"SB","icon":"📒","theme":"emerald","eyebrow":"GÉRER · VENDRE · GRANDIR"}'::jsonb,
  100,
  true
),
(
  'sowhat-africa-culture',
  'Sowhat Africa',
  'Marque sénégalaise',
  'Marque sénégalaise',
  'Wear the Culture. Culture for Winners.',
  'Solal sa culture. Culture for Winners.',
  'Streetwear, sport et culture contemporaine pensés à Dakar pour le Sénégal et la diaspora.',
  'Streetwear, sport ak culture bu bees, ñu def ko ci Dakar ngir Senegaal ak diaspora.',
  'Découvrir la collection',
  'Gis collection bi',
  'https://sowhatafrica.com/?utm_source=senecompare&utm_medium=house_banner&utm_campaign=culture_for_winners',
  '{"mark":"SA","icon":"✦","theme":"ink","eyebrow":"DAKAR 221 · CAPSULE 2026"}'::jsonb,
  90,
  true
),
(
  'advertise-on-senecompare',
  'SeneCompare Pro',
  'Votre marque ici',
  'Sa marque fii',
  'Mettez votre activité devant les bons clients',
  'Wone sa liggéey ci kanamu clients yi',
  'Bannières sobres, résultats sponsorisés clairement indiqués et statistiques transparentes.',
  'Bannière yu leer, résultats sponsorisés ak statistiques yu wóor.',
  'Demander une mise en avant',
  'Laaj ñu wone sa activité',
  'https://senecompare.dakarstyle.com/?partner=1&utm_source=senecompare&utm_medium=house_banner&utm_campaign=advertise',
  '{"mark":"SC","icon":"↗","theme":"sun","eyebrow":"ESPACE PROFESSIONNEL"}'::jsonb,
  80,
  true
)
on conflict (slug) do update
set brand = excluded.brand,
    badge_fr = excluded.badge_fr,
    badge_wo = excluded.badge_wo,
    title_fr = excluded.title_fr,
    title_wo = excluded.title_wo,
    description_fr = excluded.description_fr,
    description_wo = excluded.description_wo,
    cta_fr = excluded.cta_fr,
    cta_wo = excluded.cta_wo,
    destination_url = excluded.destination_url,
    creative = excluded.creative,
    priority = excluded.priority,
    active = excluded.active,
    updated_at = now();

create table if not exists public.senecompare_analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'page_view','session_start','search_submit','install_prompt','install_click','app_installed',
    'share','ad_impression','ad_click','partner_form_open','partner_lead_submitted'
  )),
  visitor_hash text not null check (length(visitor_hash) = 64),
  session_hash text not null check (length(session_hash) = 64),
  path text not null default '/',
  referrer_host text not null default 'direct',
  locale text not null default 'fr' check (locale in ('fr','wo','other')),
  device text not null default 'desktop' check (device in ('mobile','tablet','desktop','other')),
  campaign_id uuid references public.senecompare_ad_campaigns(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.senecompare_partner_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  placement text not null default 'banner',
  message text not null default '',
  status text not null default 'new' check (status in ('new','contacted','qualified','won','closed')),
  source_campaign text not null default 'advertise-on-senecompare',
  visitor_hash text not null check (length(visitor_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists senecompare_analytics_events_created_at_idx
  on public.senecompare_analytics_events (created_at desc);
create index if not exists senecompare_analytics_events_type_created_idx
  on public.senecompare_analytics_events (event_type, created_at desc);
create index if not exists senecompare_analytics_events_visitor_created_idx
  on public.senecompare_analytics_events (visitor_hash, created_at desc);
create index if not exists senecompare_analytics_events_campaign_created_idx
  on public.senecompare_analytics_events (campaign_id, created_at desc)
  where campaign_id is not null;
create index if not exists senecompare_partner_leads_status_created_idx
  on public.senecompare_partner_leads (status, created_at desc);
create index if not exists senecompare_ad_campaigns_public_idx
  on public.senecompare_ad_campaigns (active, priority desc, created_at desc);

alter table public.senecompare_admin_users enable row level security;
alter table public.senecompare_ad_campaigns enable row level security;
alter table public.senecompare_analytics_events enable row level security;
alter table public.senecompare_partner_leads enable row level security;

revoke all on table public.senecompare_admin_users from anon, authenticated;
revoke all on table public.senecompare_ad_campaigns from anon, authenticated;
revoke all on table public.senecompare_analytics_events from anon, authenticated;
revoke all on table public.senecompare_partner_leads from anon, authenticated;

create or replace function public.senecompare_admin_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_today timestamptz := date_trunc('day', timezone('Africa/Dakar', now())) at time zone 'Africa/Dakar';
  v_result jsonb;
begin
  select jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'owner_email', 'idrissaminata@gmail.com',
    'summary', jsonb_build_object(
      'visitors', (select count(distinct visitor_hash) from public.senecompare_analytics_events where event_type = 'page_view' and created_at >= v_since),
      'sessions', (select count(distinct session_hash) from public.senecompare_analytics_events where created_at >= v_since),
      'page_views', (select count(*) from public.senecompare_analytics_events where event_type = 'page_view' and created_at >= v_since),
      'searches', (select count(*) from public.senecompare_search_events where created_at >= v_since),
      'ad_impressions', (select count(*) from public.senecompare_analytics_events where event_type = 'ad_impression' and created_at >= v_since),
      'ad_clicks', (select count(*) from public.senecompare_analytics_events where event_type = 'ad_click' and created_at >= v_since),
      'ctr', (select coalesce(round(100.0 * count(*) filter (where event_type = 'ad_click') / nullif(count(*) filter (where event_type = 'ad_impression'), 0), 2), 0) from public.senecompare_analytics_events where created_at >= v_since),
      'installs', (select count(*) from public.senecompare_analytics_events where event_type in ('install_click','app_installed') and created_at >= v_since),
      'leads', (select count(*) from public.senecompare_partner_leads where created_at >= v_since)
    ),
    'today', jsonb_build_object(
      'visitors', (select count(distinct visitor_hash) from public.senecompare_analytics_events where event_type = 'page_view' and created_at >= v_today),
      'page_views', (select count(*) from public.senecompare_analytics_events where event_type = 'page_view' and created_at >= v_today),
      'searches', (select count(*) from public.senecompare_search_events where created_at >= v_today),
      'ad_clicks', (select count(*) from public.senecompare_analytics_events where event_type = 'ad_click' and created_at >= v_today),
      'leads', (select count(*) from public.senecompare_partner_leads where created_at >= v_today)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day,
        'visitors', coalesce(a.visitors, 0),
        'page_views', coalesce(a.page_views, 0),
        'ad_impressions', coalesce(a.ad_impressions, 0),
        'ad_clicks', coalesce(a.ad_clicks, 0),
        'searches', coalesce(s.searches, 0)
      ) order by d.day)
      from (
        select generate_series(
          (timezone('Africa/Dakar', now())::date - (v_days - 1)),
          timezone('Africa/Dakar', now())::date,
          interval '1 day'
        )::date as day
      ) d
      left join (
        select timezone('Africa/Dakar', created_at)::date as day,
               count(distinct visitor_hash) filter (where event_type = 'page_view') as visitors,
               count(*) filter (where event_type = 'page_view') as page_views,
               count(*) filter (where event_type = 'ad_impression') as ad_impressions,
               count(*) filter (where event_type = 'ad_click') as ad_clicks
        from public.senecompare_analytics_events
        where created_at >= v_since
        group by 1
      ) a using (day)
      left join (
        select timezone('Africa/Dakar', created_at)::date as day, count(*) as searches
        from public.senecompare_search_events
        where created_at >= v_since
        group by 1
      ) s using (day)
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'slug', c.slug,
        'brand', c.brand,
        'title', c.title_fr,
        'active', c.active,
        'priority', c.priority,
        'destination_url', c.destination_url,
        'impressions', coalesce(m.impressions, 0),
        'clicks', coalesce(m.clicks, 0),
        'ctr', coalesce(round(100.0 * m.clicks / nullif(m.impressions, 0), 2), 0)
      ) order by c.priority desc, c.created_at)
      from public.senecompare_ad_campaigns c
      left join lateral (
        select count(*) filter (where e.event_type = 'ad_impression') as impressions,
               count(*) filter (where e.event_type = 'ad_click') as clicks
        from public.senecompare_analytics_events e
        where e.campaign_id = c.id and e.created_at >= v_since
      ) m on true
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.views desc)
      from (
        select path, count(*) as views, count(distinct visitor_hash) as visitors
        from public.senecompare_analytics_events
        where event_type = 'page_view' and created_at >= v_since
        group by path
        order by views desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'top_referrers', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.visits desc)
      from (
        select referrer_host, count(*) as visits
        from public.senecompare_analytics_events
        where event_type = 'page_view' and created_at >= v_since
        group by referrer_host
        order by visits desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.visits desc)
      from (
        select device, count(*) as visits
        from public.senecompare_analytics_events
        where event_type = 'page_view' and created_at >= v_since
        group by device
        order by visits desc
      ) x
    ), '[]'::jsonb),
    'top_queries', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.searches desc)
      from (
        select query, count(*) as searches
        from public.senecompare_search_events
        where created_at >= v_since
        group by query
        order by searches desc
        limit 12
      ) x
    ), '[]'::jsonb),
    'top_categories', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.searches desc)
      from (
        select category, count(*) as searches
        from public.senecompare_search_events
        where created_at >= v_since
        group by category
        order by searches desc
        limit 12
      ) x
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id, business_name, contact_name, email, phone, placement, message, status, created_at
        from public.senecompare_partner_leads
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.senecompare_admin_overview(integer) from public, anon, authenticated;
grant execute on function public.senecompare_admin_overview(integer) to service_role;

commit;
