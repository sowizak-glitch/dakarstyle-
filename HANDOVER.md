# HANDOVER — SAMABUSINESS SOURCE OF TRUTH

Status: source-of-truth confirmed by direct, read-verified inspection of the
linked Supabase project on 2026-08-16 (session: `feat/samabusiness-global-core-20260816`).

## Verified

- Repository: `sowizak-glitch/dakarstyle-`
- Supabase project: `xmdpmtvieqgoorbxytey` (`supabase link` succeeds; CLI has stored auth)
- Canonical HTML assembler: Edge Function `sama-assets` (reads DB, patches, serves; **not** a static file)
- Production base bundle: DB rows `sama_app_assets.path in ('business-v9-00'..'business-v9-03')`,
  gzip+base64, validated against hardcoded SHA-256 in `sama-assets`'s `EXPECTED` array.
  The GitHub copies at `sama-business/app-v9-0X.b64` are a **recovery fallback only**
  (`fetchAndPersistBusinessParts()` pulls them via `raw.githubusercontent.com` if the DB
  rows are ever missing) — **they were corrupted** (byte-different from the DB-verified,
  checksum-passing copy; `gunzip` failed with `incorrect data check`). Fixed in this
  session by overwriting the 4 files with the DB-verified, checksum-matching content
  (verified byte-identical after the fix — see git history on this branch).
- Runtime addon: DB asset `addon-v1122-script` (74.7 KB, served by Edge Function `samabusiness-addon`)
- Field UX layer: Edge Function `samabusiness-field-ux`
- Final UI layer: DB asset `final-v19-base-script` (38.3 KB), served by Edge Function `sama-config-check`
- Site Studio runtime: DB asset `site-studio-v1122-script` (213.8 KB), served by `samabusiness-site-studio*` functions
  (current active one appears to be `samabusiness-site-experience-v122` / `samabusiness-site-commerce-v13`
  based on naming/version alignment — not fully traced end-to-end this session)
- Production PWA function: `samabusiness-pwa` (manifest/icon/service-worker for the `samabusiness.dakarstyle.com` origin)
- Main API: `samabusiness-api-v10` (session auth via `x-sama-session` header → `sama_sessions.token_hash` → `sama_accounts` → `sama_merchants`)
- Canonical runtime version observed in `sama-assets`: `VERSION="11.2.4"`, `FIELD_UX_VERSION="11.8.8"`, `FINAL_UI_VERSION="19.3.0"`
- `sama-assets` now also injects a 4th, independently-versioned script:
  `samabusiness-global-core` (this mission — see `docs/SAMABUSINESS-GLOBAL-ARCHITECTURE.md`)

## Database

- 19 `sama_merchants` rows exist today, **all** `SN / XOF / fr-SN / Africa/Dakar`.
- `sama_merchants` already had `country_code, currency, locale, timezone` columns before this
  mission (an earlier iteration laid this groundwork). This mission adds `phone_region`,
  `measurement_system`, `week_start` (additive migration, see `supabase/migrations/20260816090000_*.sql`).
- RLS on `sama_merchants`: `owner_user_id = auth.uid()` on SELECT/INSERT/UPDATE/DELETE — verified present and enabled.
- **Remote migration history is desynced from git**: ~150 migrations are applied on the live
  database (`supabase migration list`) that have no corresponding file in `supabase/migrations/`
  (applied through some other path over the project's history, never committed). Local-only files
  that predate this mission (9 of them) are similarly not recorded as applied remotely even though
  their tables exist. This is a pre-existing condition, not something this session introduced;
  repairing it fully (`supabase migration repair ...`, ~150 IDs) is a separate, lower-urgency task.
- 100 Edge Functions are deployed on this project (Supabase's function-count ceiling for the plan);
  ~44 have zero references anywhere in this repository and are almost certainly dead
  (`sama-hotfix-v8xx`, `sama-v8x-validator`, `sama-v8x-e2e`, `sama-upgrade-v8x`, `tijane-update-part-*`,
  `sama-livraison-*-smoke/certify/e2e`, etc. — see `docs/SAMABUSINESS-GLOBALIZATION-AUDIT.md`).

## Safety rule (unchanged)

The GitHub bundle chunks are a **fallback copy**, not the source of truth — the live
`sama_app_assets` table plus the deployed Edge Functions are. Preserve all sources before any
refactor. This session made **zero destructive changes**: no table dropped/renamed, no function
deleted, no existing script tag removed, no merchant data touched.

## What could not be done in this session (needs explicit action)

The sandbox's own permission classifier blocks direct production writes from this session
(`supabase db query -f ...` for the schema migration, `supabase functions delete ...` for
dead-function cleanup) even though the Supabase CLI itself is authenticated and reachable.
Deploying **new** Edge Functions is not blocked by the classifier, but the project is at its
100-function ceiling, so new functions can't be created until a few dead ones are deleted (by
you, via the Supabase dashboard or CLI) or the plan's limit is raised. See
`docs/SAMABUSINESS-GLOBALIZATION-AUDIT.md` §"Deployment — what's left" for the exact commands.
