# SAMABUSINESS — Globalization Audit (2026-08-16)

Concise, factual record of what was actually found before any code was written, and what
was actually verified afterward. Full narrative context is in [HANDOVER.md](../HANDOVER.md).

## 1. Source of truth (confirmed by direct inspection, not assumption)

| Layer | Location | Notes |
|---|---|---|
| Canonical HTML | Edge Function `sama-assets` | Assembles + patches the base bundle at request time; not a static file |
| Base bundle | DB `sama_app_assets` rows `business-v9-00..03` | gzip+base64, SHA-256-validated against hardcoded hashes |
| GitHub `.b64` copies | `sama-business/app-v9-0X.b64` | **Recovery fallback only** — was corrupted, fixed this session (see below) |
| Main addon | DB asset `addon-v1122-script` via `samabusiness-addon` | 74.7 KB, hand-assembled, checksum-gated |
| Field UX | Edge Function `samabusiness-field-ux` | |
| Final UI layer | DB asset `final-v19-base-script` via `sama-config-check` | 38.3 KB |
| Site Studio | DB asset `site-studio-v1122-script` via `samabusiness-site-studio*` | 213.8 KB; several versioned variants exist (`-v122`, `-v13`) |
| Main API | `samabusiness-api-v10` | Custom session model: `x-sama-session` header → `sama_sessions.token_hash` → `sama_accounts` → `sama_merchants` |
| DB | Supabase project `xmdpmtvieqgoorbxytey`, ~140 tables in `public` | RLS enabled and scoped by `owner_user_id`/`merchant_id` on every table checked |

## 2. Corrupted bundle, found and fixed

`sama-business/app-v9-01.b64` (and, transitively, the 4-part concatenation) failed to
gunzip (`incorrect data check`). The DB-verified copy of the same 4 parts (whose SHA-256
values are hardcoded as `EXPECTED` in `sama-assets` and checked before every use) decodes
cleanly to a 71,144-byte HTML document. The 4 local files were overwritten with the exact
DB-verified bytes; all 4 now hash-match `EXPECTED` and reconstruct the original HTML
byte-for-byte. Production was never affected — `sama-assets` always reads the DB copy
first and only falls back to GitHub if the DB rows are missing.

## 3. Existing i18n groundwork found (not built by this mission)

- `sama_merchants` already had `country_code`, `currency`, `locale`, `timezone` columns.
  All 19 existing merchants are `SN / XOF / fr-SN / Africa/Dakar`.
- A working FR/WO toggle already exists in three independent places, each with its own
  `localStorage` key: the base app (`sama-language-v1`), the addon/final-UI layer and
  `samabusiness-studio-language-v12` (`sama-ui-lang`, with a hand-written ~90-string
  Wolof dictionary for Site Studio only). Global Core keeps writing to both legacy keys
  on every save so nothing that already reads them regresses.
- Money formatting is hardcoded in three places with three slightly different outputs:
  `business.html` (`Intl.NumberFormat('fr-FR',{maximumFractionDigits:0})` + `" F"`),
  `addon.js` (same pattern), `final.js` (`Math.round(v).toLocaleString('fr-FR')+' FCFA'`).
  None of these read `merchant.currency`, even though the API already returns it.

## 4. What this mission added (see [SAMABUSINESS-GLOBAL-ARCHITECTURE.md](SAMABUSINESS-GLOBAL-ARCHITECTURE.md))

Country Registry, Locale Engine, Currency Engine, Timezone Engine, Phone Engine, RTL — all
in `src/global-core/`, zero new runtime dependencies, built and unit-tested
(`npm run test:global-core`). New additive DB migration for the remaining Global Config
fields. New `samabusiness-global-settings` API and `samabusiness-global-core` script
server (source written, **not yet deployed** — see §6). `sama-assets` already references
the new script as a 4th, independently-versioned `<script defer>` tag, following the exact
pattern already used for the other three.

## 5. Legacy-currency-formatting patch — documented, not applied

Making every existing amount render through the new Currency Engine means editing 3
closures (`money`/`fmt` in `business.html`, `addon.js`, `final.js`) that are not reachable
from outside their own IIFEs (this is why a separately-injected script cannot monkey-patch
them). The exact, minimal, byte-verified patch for each is documented in
[SAMABUSINESS-GLOBAL-ARCHITECTURE.md §7](SAMABUSINESS-GLOBAL-ARCHITECTURE.md#7-legacy-currency-formatting-patch-ready-to-apply)
rather than applied blindly this session: these three files are live production code this
session did not author, there is no authenticated browser session available to visually
verify the change, and — see §6 — none of it can be deployed from this session anyway.
The patch is written so that XOF output is **byte-identical** to today's for every existing
Senegalese merchant; it only changes output for a merchant who has explicitly chosen a
non-XOF currency.

## 6. Deployment — what's left

Nothing in this mission was pushed to production. Two independent constraints, both
external to this session:

1. **DB schema writes are blocked by this sandbox's permission classifier.** The additive
   migration (`supabase/migrations/20260816090000_samabusiness_global_config_columns.sql`)
   is written, reviewed, and safe (verified: 19/19 existing merchants already match the
   backfilled defaults, so it is a no-op for current behaviour) but was not applied. Apply
   it with either:
   ```bash
   supabase db query --linked --project-ref xmdpmtvieqgoorbxytey -f supabase/migrations/20260816090000_samabusiness_global_config_columns.sql
   ```
   or paste the file into the Supabase SQL editor.
2. **The project is at its 100-Edge-Function ceiling.** Deploying new functions is not
   blocked by the classifier (it reaches Supabase's real API and gets a real `402 Max
   number of functions reached`), but there is no room left. ~44 functions have zero
   references anywhere in this repository and are near-certainly dead (grep-verified, same
   method as the prior `HANDOVER-V4.md` dead-code removal):
   `sama-hotfix-v801/802/803/811`, `sama-v8-validator`, `sama-v8-e2e`, `sama-upgrade-v81/82/83/831/84`,
   `sama-v81/811/82/831/84-validator`, `sama-v82-fragment-validator`, `sama-v83/84-inspect`,
   `sama-business-v9-e2e`, `sama-business-bundle-check`, `sama-business-api-v2-check`,
   `samabusiness-v10-e2e`, `sama-support-e2e`, `sama-livraison-smoke/v2-smoke/v2-certify/v3-e2e/chunk-debug`,
   `tijane-update-part-0..5`, `tijane-updates`. Delete a handful of these (dashboard or
   `supabase functions delete <slug> --project-ref xmdpmtvieqgoorbxytey`) to free room, then:
   ```bash
   node scripts/build-global-core.mjs
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/deploy-global-core.mjs
   supabase functions deploy samabusiness-global-core --project-ref xmdpmtvieqgoorbxytey
   supabase functions deploy samabusiness-global-settings --project-ref xmdpmtvieqgoorbxytey
   supabase functions deploy sama-assets --project-ref xmdpmtvieqgoorbxytey
   ```

## 7. Explicitly not done, per mission scope

- No bulk translation of the app's thousands of existing UI strings — only the 8
  representative locale packs' critical/onboarding/settings strings, per the mission's own
  stated priority (architecture > critical strings > fallback > extensibility).
- No payment-provider integration work — `PaymentProviderRegistry` is architecture-only in
  this pass (see architecture doc), no PSPs were touched.
- No tax-rate data invented — no `TaxProfile` values were fabricated.
