# SAMABUSINESS — Global Core Architecture

`ONE GLOBAL CORE → ANY COUNTRY → ANY LOCALE → ANY CURRENCY → LOCAL CAPABILITIES`,
without rewriting the app, without breaking Senegal, without per-country business logic.

## 1. Principle

Every business fact that used to be an implicit Senegal constant is now a field on the
tenant (`sama_merchants`), and every engine that renders that fact is data-driven. Adding a
country, currency or language is a data change (`src/global-core/data/*.json` or a new
`src/global-core/locale-packs/*.json` file) — the engine code in
`src/global-core/*.mjs` never changes.

```
sama_merchants
  country_code | currency | locale | timezone | phone_region | measurement_system | week_start
        ↓            ↓          ↓         ↓            ↓                ↓                ↓
  Country Registry  Currency   Locale   Timezone    Phone Engine    (formatting)      (calendar)
                     Engine    Engine    Engine
```

## 2. Global Config (mission §4)

Already on `sama_merchants` before this mission: `country_code`, `currency`, `locale`,
`timezone`. Added by `supabase/migrations/20260816090000_samabusiness_global_config_columns.sql`
(additive, backfilled to match every existing row's current de-facto values — a no-op for
today's 19 Senegal merchants): `phone_region`, `measurement_system`, `week_start`.

## 3. Country Registry (`src/global-core/country-registry.mjs`)

Country/currency/timezone *existence* and display names come from `Intl` at runtime
(`Intl.supportedValuesOf('region'|'currency'|'timeZone')`, `Intl.DisplayNames`) — zero
maintenance, always matches the platform's own ICU data, no 200-row hand-typed table. A
curated `data/countries.json` (~65 countries spanning every continent, every currency in
the mission's test matrix, and every RTL market listed) supplies only what `Intl` cannot
derive: default currency, calling code, default locale, week start, measurement system,
address schema. A country **not** in the curated table still resolves (via `Intl`) with
sane generic defaults instead of failing — "any country" holds even before someone curates
it.

## 4. Locale Engine (`src/global-core/locale-engine.mjs`)

BCP 47 resolution with fallback chain (`ar-MA → ar → fr-SN → fr`), `{var}` interpolation,
`Intl.PluralRules`-based pluralization (`key.one`/`key.other` convention), lazy pack
loading through an injected `loadPack(tag)`, offline cache through an injected storage
adapter. Never throws and never renders `"undefined"` — an unresolved key renders as the
key itself. 8 launch locale packs ship in `src/global-core/locale-packs/`: `fr-SN`, `wo-SN`
(preserved, both already-legacy `localStorage` keys stay in sync — see §8), `fr-MA`,
`ar-MA` (RTL), `en-US`, `en-GB`, `fr-FR`, `pt-BR`. Only onboarding/settings/nav strings are
translated in this pass, per the mission's own priority order (architecture > critical
strings > fallback > extensibility) — not a bulk re-translation of the whole app.

## 5. Currency Engine (`src/global-core/currency-engine.mjs`)

`Money = {amount, currency}`. `amount` stays a **major-unit decimal**, matching every
existing `numeric` column in `sama_sales`/`sama_orders`/`sama_expenses`/`sama_products`
exactly as-is — this is a deliberate choice, not an oversight: those columns are `numeric`,
not integer minor-units, and XOF has zero decimal places, so **no value migration is
required**; a legacy row is already "amount in XOF major units". Precision-sensitive math
(add/subtract) is done in minor units internally (`toMinor`/`fromMinor`, using an ISO 4217
exponent table with the standard zero- and three-decimal exceptions) to avoid float drift,
then converted back. `format()` uses `Intl.NumberFormat(locale, {style:'currency', currency})`
and never throws, even for an unrecognized code.

## 6. Timezone / Phone / RTL

- **Timezone** (`timezone-engine.mjs`): every render goes through
  `Intl.DateTimeFormat(locale, {timeZone})` — never a raw GMT offset. `startOfWeek()`
  respects the merchant's `week_start` in their actual IANA zone, not device-local time.
- **Phone** (`phone-engine.mjs`): E.164 normalize/validate/format, metadata-driven
  (`data/phone-metadata.json`: calling code, valid NSN lengths, trunk prefix per region).
  Not a full libphonenumber replacement (no bundler in this Worker to ship its data
  tables) — deliberately shaped so a real `libphonenumber-js` integration could later
  replace `normalize()`/`isValid()` without touching a single call site. Legacy Senegal
  numbers (`"77 123 45 67"`, `"771234567"`, `"+221771234567"`) all normalize identically.
- **RTL** (`rtl.mjs`): direction from `Intl.Locale.getTextInfo()` where available, curated
  subtag fallback (`ar, he, fa, ur, ps, sd, yi, ug, dv`) otherwise. `applyDirection()` sets
  `lang`/`dir` on `<html>` and toggles one class; `styles.mjs` uses only CSS logical
  properties (`margin-inline`, `padding-inline`, `inset-inline`) so there is one UI, not two.

## 7. Legacy currency-formatting patch (ready to apply)

Money is currently formatted by 3 independent closures the Global Core script cannot reach
from outside (classic, non-module `<script>`s — no `window.` export). Each patch below
preserves **byte-identical output for XOF** (every existing Senegalese merchant sees zero
visual change) and only diverges when a merchant has explicitly configured a different
currency. Not applied in this session (see audit doc §5/§6 for why) — this is the exact,
minimal diff for whoever applies it next, against the DB-verified source in
`sama_app_assets` (`business-v9-00..03` reassembled, `addon-v1122-script`, `final-v19-base-script`).

**`business.html`** (assembled from `business-v9-*`), replaces the 2-line `money`/`fmt` definition:
```js
// before
const money=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
const fmt=n=>`${money.format(Number(n||0))} F`;
// after
const money=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
const moneyFormatters={};
function moneyFormatter(currency){const k=currency||'XOF';if(!moneyFormatters[k])moneyFormatters[k]=new Intl.NumberFormat(state.merchant?.locale||'fr-FR',{style:'currency',currency:k});return moneyFormatters[k]}
const fmt=n=>{const c=state.merchant?.currency;if(!c||c==='XOF')return `${money.format(Number(n||0))} F`;try{return moneyFormatter(c).format(Number(n||0))}catch{return `${money.format(Number(n||0))} F`}};
```

**`addon-v1122-script`** — identical pattern, `state` there is reached via `currentState()`;
same guard (`!currency || currency==='XOF'` → unchanged output).

**`final-v19-base-script`** — replaces:
```js
// before
const money = (v)=>`${Math.round(Number(v) || 0).toLocaleString('fr-FR')} FCFA`;
// after
const money = (v)=>{const c=(state.admin?.merchant?.currency)||'XOF';if(c==='XOF')return `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} FCFA`;try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(v)||0)}catch{return `${Math.round(Number(v) || 0).toLocaleString('fr-FR')} FCFA`}};
```

## 8. Onboarding & Settings (mission §13/§14)

`src/global-core/onboarding-ui.mjs` and `settings-ui.mjs` share one form
(`region-language-form.mjs`) so the two experiences never drift. Country/language pickers
are always searchable (never an unfilterable 200-row `<select>`). Both are pure DOM
injection matching the base app's own existing patterns exactly (discovered by decoding
the DB-verified `business-v9-*` bundle, not guessed):

- The base app wires `[data-open]`/`[data-close]`/`[data-nav]` **once at boot**, not via
  event delegation — elements injected later (by Global Core) wire their own click
  handlers explicitly, and call `window.openModal`/`window.closeModal` (reachable because
  the base app's `<script>` is a classic script, so its top-level function declarations
  land on `window`), with a manual-class-toggle fallback if those are ever absent.
- Settings panel is added as one more `.more-card` inside the existing
  `#view-more .more-grid` ("Outils du commerce" screen), and a `.modal-backdrop` matching
  `expenseModal`/`withdrawModal`'s exact markup — zero new layout CSS needed.
- Onboarding shows once (`sama-global-onboarded-v1` flag), only **after** the merchant
  reaches the app shell (never before/during auth), pre-filled from device locale/timezone
  via `Intl`, always requiring explicit confirmation before saving.
- `settings-store.mjs` writes through to the new `samabusiness-global-settings` API when a
  session exists, and always writes to `localStorage` first (works fully offline — PWA
  requirement), including keeping both pre-existing legacy language keys
  (`sama-language-v1`, `sama-ui-lang`) in sync so nothing that already reads them regresses.

## 9. Persistence API — `samabusiness-global-settings`

New, standalone Edge Function (isolated from `samabusiness-api-v10` on purpose — shipping
it touches no table and no code path the existing API already owns, zero risk to
sales/stock/debts/orders). Same session contract as every other SAMABUSINESS endpoint:
`x-sama-session` header → `sama_sessions.token_hash` → `sama_accounts` → `sama_merchants`,
so a merchant can only ever read/write their own row (also enforced independently by RLS).
Server-side validates every field (ISO 3166-1 alpha-2, ISO 4217, BCP 47, `Intl`-checked IANA
timezone, `metric|imperial`, `0..6`) before writing — the client-side Country Registry is
the UX guard, this is the trust boundary.

## 10. Delivery shape (PWA / offline / performance, mission §18/§19)

One file, `src/global-core/*.mjs` → `scripts/build-global-core.mjs` (zero npm
dependencies, matches this repo's own "no bundler" constraint) → served by a new
`samabusiness-global-core` Edge Function from a checksum-gated `sama_app_assets` row
(`global-core-v1-script`), exactly like `addon-v1122-script`. Injected as a 4th
`<script defer>` in `sama-assets`'s `patchBusinessHtml()`, independently versioned:
if it 503s, the tag simply fails to execute and the rest of the app (auth, sales, stock,
debts, delivery, voice) is unaffected — remove one constant to fully revert. Built bundle
is ~79 KB (all 8 launch locale packs inlined for offline-robustness and simplicity; a
`sama_global_packs` registry table is included in the migration for when the locale catalog
grows large enough that true per-locale lazy loading from separate DB assets becomes worth
the extra round-trip — not needed yet at 8 packs). Nothing else in the initial bundle:
no per-country data beyond the curated table's ~65 rows (a few KB of JSON), no fonts.

## 11. Payments & Taxes (mission §15/§16) — architecture only, not implemented

Out of scope to implement this pass (mission explicitly says not to integrate PSPs this
session). The shape to build toward, so it drops into this same Global Core without
touching the engine: a `PaymentProviderRegistry` keyed by `countryCode` returning ordered
capability tags (e.g. `SN → ['wave','orange_money','cash']`), and a `TaxProfile`/
`InvoiceProfile` pair on the merchant record populated only from verified data, never
invented defaults.

## 12. Test matrix coverage

See [SAMABUSINESS-GLOBAL-QA.md](SAMABUSINESS-GLOBAL-QA.md).
