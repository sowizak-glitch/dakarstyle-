-- SAMABUSINESS Global Core — Phase B (Global Config)
-- Purely additive: adds the remaining tenant-level global-config fields that
-- did not yet exist on sama_merchants (country_code, currency, locale and
-- timezone were already present from an earlier iteration and are left
-- untouched). No existing column is renamed, retyped or dropped.
--
-- Backfill matches the values every existing merchant already has today
-- (verified: 19/19 rows are SN / XOF / fr-SN / Africa/Dakar before this
-- migration runs), so this is a no-op for current behaviour and only
-- unlocks new capability going forward.

alter table public.sama_merchants
  add column if not exists phone_region text,
  add column if not exists measurement_system text,
  add column if not exists week_start smallint;

update public.sama_merchants
  set phone_region = coalesce(phone_region, nullif(country_code, ''), 'SN')
  where phone_region is null;

update public.sama_merchants
  set measurement_system = coalesce(measurement_system, 'metric')
  where measurement_system is null;

update public.sama_merchants
  set week_start = coalesce(week_start, 1) -- ISO-8601: 1 = Monday
  where week_start is null;

alter table public.sama_merchants
  alter column phone_region set default 'SN',
  alter column measurement_system set default 'metric',
  alter column week_start set default 1;

alter table public.sama_merchants
  add constraint sama_merchants_measurement_system_check
    check (measurement_system in ('metric', 'imperial')) not valid;
alter table public.sama_merchants
  validate constraint sama_merchants_measurement_system_check;

alter table public.sama_merchants
  add constraint sama_merchants_week_start_check
    check (week_start between 0 and 6) not valid;
alter table public.sama_merchants
  validate constraint sama_merchants_week_start_check;

comment on column public.sama_merchants.country_code is
  'ISO 3166-1 alpha-2. Business/tenant setting, not a global constant. Default SN preserved for legacy rows.';
comment on column public.sama_merchants.currency is
  'ISO 4217 alpha code. Amount columns across sama_sales/sama_orders/sama_expenses/sama_products stay bare numeric (major units) and are formatted using this currency at read time — no value migration required for zero-decimal XOF.';
comment on column public.sama_merchants.locale is
  'BCP 47 locale tag (e.g. fr-SN, wo-SN, ar-MA). Drives Global Core locale engine and RTL detection.';
comment on column public.sama_merchants.timezone is
  'IANA time zone database name (e.g. Africa/Dakar). Used for all date/time rendering via Intl, never a raw GMT offset.';
comment on column public.sama_merchants.phone_region is
  'ISO 3166-1 alpha-2 used as the default region for phone number parsing/formatting (E.164). Independent from country_code so a merchant can operate with a foreign-issued line.';
comment on column public.sama_merchants.measurement_system is
  'metric or imperial. Drives unit formatting in Global Core (weights, distances) where relevant to stock/delivery.';
comment on column public.sama_merchants.week_start is
  '0 (Sunday) through 6 (Saturday), ISO-8601-compatible. Drives calendar/report week boundaries in the Global Core locale engine.';

-- Global Core i18n asset registry: tracks which locale/country packs have
-- been published to sama_app_assets so the addon can lazy-load only what a
-- merchant needs (mission requirement: no bundle bloat, no language/country
-- data shipped upfront in the initial payload).
create table if not exists public.sama_global_packs (
  id uuid primary key default gen_random_uuid(),
  pack_type text not null check (pack_type in ('locale', 'country')),
  pack_key text not null, -- BCP47 tag for locale packs, ISO 3166-1 alpha-2 for country packs
  asset_path text not null references public.sama_app_assets(path) on delete restrict,
  version text not null,
  status text not null default 'active' check (status in ('active', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pack_type, pack_key)
);

create index if not exists sama_global_packs_type_idx on public.sama_global_packs(pack_type, status);

alter table public.sama_global_packs enable row level security;
revoke all on table public.sama_global_packs from public, anon, authenticated;
grant all on table public.sama_global_packs to service_role;

comment on table public.sama_global_packs is
  'Registry of Global Core locale/country packs published as sama_app_assets rows, enabling lazy loading per merchant instead of bundling every language/country upfront.';
