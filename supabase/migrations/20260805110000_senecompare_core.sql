-- SeneCompare AI core schema
-- Security model: public read access only for published sources/offers;
-- anonymous writes are limited to intake tables and are never publicly readable.

begin;

create extension if not exists pgcrypto;

create table if not exists public.senecompare_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  base_url text,
  source_type text not null default 'public_web'
    check (source_type in ('public_web', 'merchant_feed', 'partner_api', 'manual_verification')),
  is_active boolean not null default true,
  trust_weight numeric(4,3) not null default 0.500
    check (trust_weight between 0 and 1),
  terms_review_status text not null default 'pending'
    check (terms_review_status in ('pending', 'approved', 'restricted', 'blocked')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.senecompare_offers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.senecompare_sources(id) on delete set null,
  external_id text,
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '' check (char_length(description) <= 1200),
  category text not null
    check (category in ('phones', 'cars', 'motorcycles', 'appliances', 'computing', 'fashion', 'home', 'professional')),
  merchant_name text not null check (char_length(merchant_name) between 2 and 160),
  seller_type text not null default 'merchant'
    check (seller_type in ('merchant', 'individual')),
  city text not null default 'Sénégal'
    check (city in ('Sénégal', 'Dakar', 'Thiès', 'Saint-Louis', 'Mbour', 'Touba', 'Kaolack', 'Ziguinchor', 'Louga')),
  price_xof bigint not null check (price_xof between 1 and 1000000000),
  currency text not null default 'XOF' check (currency = 'XOF'),
  condition text not null default 'new'
    check (condition in ('new', 'used', 'refurbished')),
  source_name text not null check (char_length(source_name) between 2 and 160),
  source_url text,
  image_url text,
  verified_at timestamptz not null,
  published_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  cross_checks smallint not null default 0 check (cross_checks between 0 and 20),
  seller_verified boolean not null default false,
  price_consistency numeric(4,3) not null default 0.500
    check (price_consistency between 0 and 1),
  status text not null default 'confirm'
    check (status in ('verified', 'confirm', 'stale')),
  published boolean not null default false,
  fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.senecompare_price_reports (
  id uuid primary key default gen_random_uuid(),
  offer_id text not null check (char_length(offer_id) between 1 and 100),
  reason text not null
    check (reason in ('price_outdated', 'unavailable', 'wrong_details', 'suspicious', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  page_url text not null default '' check (char_length(page_url) <= 500),
  locale text not null default 'fr' check (locale in ('fr', 'wo')),
  reporter_user_id uuid references auth.users(id) on delete set null,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'rejected', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.senecompare_merchant_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  business_name text not null check (char_length(business_name) between 2 and 160),
  contact_name text not null default '' check (char_length(contact_name) <= 160),
  phone text not null check (phone ~ '^\+?[0-9]{8,15}$'),
  email text not null default '' check (char_length(email) <= 254),
  offer_id text not null default '' check (char_length(offer_id) <= 100),
  message text not null default '' check (char_length(message) <= 800),
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.senecompare_public_alert_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id text not null default '' check (char_length(offer_id) <= 100),
  query text not null default '' check (char_length(query) <= 180),
  target_price bigint not null default 0 check (target_price between 0 and 1000000000),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9]{8,15}$'),
  email text not null default '' check (char_length(email) <= 254),
  locale text not null default 'fr' check (locale in ('fr', 'wo')),
  status text not null default 'active' check (status in ('active', 'verified', 'rejected', 'disabled')),
  created_at timestamptz not null default now(),
  check (offer_id <> '' or query <> ''),
  check (phone <> '' or email <> '')
);

create table if not exists public.senecompare_price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  offer_id uuid references public.senecompare_offers(id) on delete cascade,
  query text not null default '' check (char_length(query) <= 180),
  target_price_xof bigint not null check (target_price_xof between 1 and 1000000000),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  is_active boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (offer_id is not null or query <> '')
);

create table if not exists public.senecompare_search_events (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text not null default '' check (char_length(anonymous_session_id) <= 100),
  query text not null default '' check (char_length(query) <= 180),
  category text not null default 'all' check (char_length(category) <= 40),
  city text not null default 'Sénégal' check (char_length(city) <= 80),
  result_count integer not null default 0 check (result_count between 0 and 10000),
  locale text not null default 'fr' check (locale in ('fr', 'wo')),
  created_at timestamptz not null default now()
);

create index if not exists senecompare_sources_active_idx
  on public.senecompare_sources (is_active, last_reviewed_at desc);

create index if not exists senecompare_offers_public_search_idx
  on public.senecompare_offers (published, category, city, price_xof, verified_at desc);

create index if not exists senecompare_offers_expiry_idx
  on public.senecompare_offers (expires_at)
  where published = true;

create index if not exists senecompare_offers_source_idx
  on public.senecompare_offers (source_id, external_id);

create index if not exists senecompare_price_reports_status_idx
  on public.senecompare_price_reports (review_status, created_at desc);

create index if not exists senecompare_merchant_claims_user_idx
  on public.senecompare_merchant_claims (user_id, created_at desc);

create index if not exists senecompare_public_alert_requests_status_idx
  on public.senecompare_public_alert_requests (status, created_at desc);

create index if not exists senecompare_price_alerts_user_idx
  on public.senecompare_price_alerts (user_id, is_active, created_at desc);

create index if not exists senecompare_search_events_created_idx
  on public.senecompare_search_events (created_at desc);

create or replace function public.senecompare_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.senecompare_set_updated_at() from public, anon, authenticated;
grant execute on function public.senecompare_set_updated_at() to authenticated, service_role;

drop trigger if exists senecompare_sources_set_updated_at on public.senecompare_sources;
create trigger senecompare_sources_set_updated_at
before update on public.senecompare_sources
for each row execute function public.senecompare_set_updated_at();

drop trigger if exists senecompare_offers_set_updated_at on public.senecompare_offers;
create trigger senecompare_offers_set_updated_at
before update on public.senecompare_offers
for each row execute function public.senecompare_set_updated_at();

drop trigger if exists senecompare_merchant_claims_set_updated_at on public.senecompare_merchant_claims;
create trigger senecompare_merchant_claims_set_updated_at
before update on public.senecompare_merchant_claims
for each row execute function public.senecompare_set_updated_at();

drop trigger if exists senecompare_price_alerts_set_updated_at on public.senecompare_price_alerts;
create trigger senecompare_price_alerts_set_updated_at
before update on public.senecompare_price_alerts
for each row execute function public.senecompare_set_updated_at();

alter table public.senecompare_sources enable row level security;
alter table public.senecompare_offers enable row level security;
alter table public.senecompare_price_reports enable row level security;
alter table public.senecompare_merchant_claims enable row level security;
alter table public.senecompare_public_alert_requests enable row level security;
alter table public.senecompare_price_alerts enable row level security;
alter table public.senecompare_search_events enable row level security;

revoke all on table public.senecompare_sources from anon, authenticated;
revoke all on table public.senecompare_offers from anon, authenticated;
revoke all on table public.senecompare_price_reports from anon, authenticated;
revoke all on table public.senecompare_merchant_claims from anon, authenticated;
revoke all on table public.senecompare_public_alert_requests from anon, authenticated;
revoke all on table public.senecompare_price_alerts from anon, authenticated;
revoke all on table public.senecompare_search_events from anon, authenticated;

grant select on table public.senecompare_sources to anon, authenticated;
grant select on table public.senecompare_offers to anon, authenticated;
grant insert on table public.senecompare_price_reports to anon, authenticated;
grant insert on table public.senecompare_merchant_claims to anon;
grant select, insert on table public.senecompare_merchant_claims to authenticated;
grant insert on table public.senecompare_public_alert_requests to anon, authenticated;
grant select, insert, update, delete on table public.senecompare_price_alerts to authenticated;
grant insert on table public.senecompare_search_events to anon, authenticated;

grant select, insert, update, delete on table
  public.senecompare_sources,
  public.senecompare_offers,
  public.senecompare_price_reports,
  public.senecompare_merchant_claims,
  public.senecompare_public_alert_requests,
  public.senecompare_price_alerts,
  public.senecompare_search_events
  to service_role;

grant usage, select on sequence public.senecompare_search_events_id_seq to anon, authenticated, service_role;

drop policy if exists "Public can read approved SeneCompare sources" on public.senecompare_sources;
create policy "Public can read approved SeneCompare sources"
on public.senecompare_sources
for select
to anon, authenticated
using (is_active = true and terms_review_status = 'approved');

drop policy if exists "Public can read current SeneCompare offers" on public.senecompare_offers;
create policy "Public can read current SeneCompare offers"
on public.senecompare_offers
for select
to anon, authenticated
using (published = true and expires_at > now());

drop policy if exists "Anyone can submit a bounded price report" on public.senecompare_price_reports;
create policy "Anyone can submit a bounded price report"
on public.senecompare_price_reports
for insert
to anon, authenticated
with check (
  review_status = 'pending'
  and char_length(offer_id) between 1 and 100
  and char_length(details) <= 500
);

drop policy if exists "Anyone can submit a merchant claim" on public.senecompare_merchant_claims;
create policy "Anyone can submit a merchant claim"
on public.senecompare_merchant_claims
for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(business_name) between 2 and 160
  and phone ~ '^\+?[0-9]{8,15}$'
  and (user_id is null or user_id = (select auth.uid()))
);

drop policy if exists "Authenticated users can read their own merchant claims" on public.senecompare_merchant_claims;
create policy "Authenticated users can read their own merchant claims"
on public.senecompare_merchant_claims
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Anyone can request a bounded public price alert" on public.senecompare_public_alert_requests;
create policy "Anyone can request a bounded public price alert"
on public.senecompare_public_alert_requests
for insert
to anon, authenticated
with check (
  status = 'active'
  and (offer_id <> '' or query <> '')
  and (phone <> '' or email <> '')
);

drop policy if exists "Users can read their own price alerts" on public.senecompare_price_alerts;
create policy "Users can read their own price alerts"
on public.senecompare_price_alerts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own price alerts" on public.senecompare_price_alerts;
create policy "Users can create their own price alerts"
on public.senecompare_price_alerts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own price alerts" on public.senecompare_price_alerts;
create policy "Users can update their own price alerts"
on public.senecompare_price_alerts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own price alerts" on public.senecompare_price_alerts;
create policy "Users can delete their own price alerts"
on public.senecompare_price_alerts
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can submit bounded search telemetry" on public.senecompare_search_events;
create policy "Anyone can submit bounded search telemetry"
on public.senecompare_search_events
for insert
to anon, authenticated
with check (
  result_count between 0 and 10000
  and char_length(query) <= 180
  and (user_id is null or user_id = (select auth.uid()))
);

comment on table public.senecompare_offers is 'Public SeneCompare offers. Only rows published=true and not expired are readable through the Data API.';
comment on table public.senecompare_price_reports is 'Private intake table for inaccurate or stale price reports. No anonymous SELECT grant.';
comment on table public.senecompare_merchant_claims is 'Private merchant verification requests. Anonymous submissions are allowed; public reads are denied.';
comment on table public.senecompare_public_alert_requests is 'Private intake for pre-auth price alerts. Validate contact ownership before sending notifications.';

commit;
