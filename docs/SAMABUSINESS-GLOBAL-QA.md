# SAMABUSINESS — Global Core QA (2026-08-16)

## What actually ran, and passed

```bash
npm test
```
runs the full pre-existing suite (router/social-intelligence/instagram/score/memory/coach —
145 `PASS` lines, unaffected, 0 regressions) **plus** the new
`npm run test:global-core`, which itself runs:

1. `node scripts/build-global-core.mjs` — builds `dist/global-core-v1.js` from
   `src/global-core/*.mjs` (no dependency, ~79 KB output) and `node --check`s it.
2. `node tests/global-core-engines.mjs` — **36 assertions**, all green:

| Area | Covered |
|---|---|
| Country resolver | curated lookup, case-insensitivity, RTL flag, unknown-but-ISO graceful fallback, garbage input never throws, `listCountries` sorted/complete, environment guess (device locale → country, empty env → SN default) |
| Currency formatter | XOF zero-decimal, EUR two-decimal, `format()` never throws on a bogus code, renders a recognizable XOF amount |
| Minor units | exact round-trip for zero-decimal (XOF) and two-decimal (USD) currencies — the legacy-compatibility guarantee |
| Timezone | valid/invalid IANA zone detection, `formatDateTime` differs correctly across zones and never throws on an invalid one (falls back to Africa/Dakar), `startOfWeek` respects `week_start=1` |
| Phone normalization | legacy Senegal local formats → E.164, already-E.164 passthrough, `00` international prefix, NSN-length validation, unknown region returns `null` (never a wrong guess), region detection from E.164 |
| RTL | `ar-MA` → RTL, `fr-SN`/`wo-SN`/`pt-BR` → LTR |
| Locale/translation fallback | `fr-XX → fr → fr-SN` chain, unresolved key renders as itself (never `"undefined"`), `{var}` interpolation, lazy `loadPack` invoked once per tag then cached |
| Settings persistence | legacy merchant (no Global Core cache) defaults to `SN/XOF/fr-SN/Africa/Dakar`, `sama_merchants` values take precedence over cache, fully-offline save, **legacy `sama-language-v1`/`sama-ui-lang` keys stay in sync on every save**, one-shot onboarding flag |

3. `node tests/global-core-bundle-smoke.mjs` — evaluates the actual built bundle against a
   stubbed browser environment (no jsdom dependency added): proves the bundle parses,
   its top-level IIFE never throws, and `window.SAMABUSINESS.global` is installed even
   with a minimal/degraded DOM — the exact failure mode that would otherwise be able to
   take the host page down.

## Test-matrix mapping (mission §22)

| Representative | Locale/currency | Engine coverage |
|---|---|---|
| Sénégal (baseline) | `fr-SN` / XOF | ✅ zero-decimal formatting, legacy round-trip, RTL=false, week starts Monday |
| Wolof Sénégal | `wo-SN` | ✅ locale pack present, RTL=false, legacy `sama-ui-lang`/`sama-language-v1` sync verified |
| Maroc (RTL) | `fr-MA` / `ar-MA` / MAD | ✅ `ar-MA` RTL=true verified; MAD is a standard 2-decimal ISO 4217 currency (no exception entry needed) |
| Afrique anglophone | `en-NG` / NGN | ✅ via curated `NG` entry + generic 2-decimal currency path (no dedicated unit test beyond the generic currency-formatter tests; NGN is not currently a locale-pack language) |
| Europe | `fr-FR` / EUR, `en-GB` / GBP | ✅ both locale packs present; EUR/GBP both 2-decimal, covered by the generic currency tests |
| Amérique | `en-US` / USD, `pt-BR` / BRL | ✅ both locale packs present; USD covered directly by the minor-units round-trip test |
| Asie | `hi-IN` / INR, `ja-JP` / JPY | ✅ curated `IN`/`JP` entries; JPY is in the zero-decimal exception table (same code path as XOF, exercised by the XOF unit test) |

Format/decimals/dates/timezone/phone/RTL/locale-switch/persistence: unit-tested as above.
Reload/PWA/offline: architecture-level (localStorage-first save, single-file bundle, no
network dependency for translation), **not** end-to-end browser-tested this session — see
"Not tested" below.

## Also verified this session (read-only, against live production)

- `supabase db query` against the linked project: RLS on `sama_merchants` confirmed enabled
  and scoped to `owner_user_id = auth.uid()` on SELECT/INSERT/UPDATE/DELETE.
- All 19 existing `sama_merchants` rows confirmed `SN/XOF/fr-SN/Africa/Dakar` before any
  migration — the additive migration's backfill is a verified no-op for them.
- Loaded `https://samabusiness.dakarstyle.com` read-only in a sandboxed browser (no login,
  no interaction) to sanity-check the DOM structure this mission's UI code targets
  (`#view-more .more-grid`, `.more-card`, `.modal-backdrop`) against the live page — an
  exact match to what was found by decoding the DB-verified bundle. Pre-existing, unrelated
  console errors were observed (blob: script CSP violations for "Sama Domain V15" /
  "Sama Business Commerce V16" / "Sama Guide V17" / "Sama Business Quality V17.1") — these
  predate this session and this mission did not touch anything related to them; noted here
  only so they are not later misattributed to this branch.

## Not tested (and why)

- **No authenticated browser run of the onboarding/settings UI.** No test merchant
  credentials were available, and creating one requires phone/WhatsApp OTP this session
  cannot complete. The DOM injection points (`#view-more .more-grid`, `openModal`/
  `closeModal` reachability, exact modal markup) were verified by decoding the live,
  DB-verified `business-v9-*` bundle and cross-checked against the live page's rendered
  text (see above) — high confidence, but not a substitute for a real click-through.
- **Nothing was deployed**, so there is no "after" state to smoke-test against production
  yet (see `SAMABUSINESS-GLOBALIZATION-AUDIT.md` §6 for the exact blockers and commands).
  Every claim above is about the code in this branch, run locally/in-process.
- Legacy currency-formatting patch (audit doc §5): written and reviewed, not applied to the
  live minified sources this session, so not exercised by any test.

## RLS / tenant isolation

`sama_merchants` RLS verified (see above). The new `samabusiness-global-settings` function
adds no new table and reuses the existing `sama_sessions` → `sama_accounts` →
`sama_merchants` resolution chain used by `samabusiness-api-v10`, so a caller can only ever
read/write the merchant row resolved from their own validated session — never an
`id`/`merchant_id` supplied by the client. Server-side field validation (ISO 3166-1 alpha-2,
ISO 4217, BCP 47, `Intl`-checked IANA timezone name, `metric|imperial`, `0..6`) rejects
malformed input before any write.

## Performance

Built bundle: **~79 KB**, zero runtime dependencies, single file, injected as one more
`defer`red script (parses off the critical rendering path, same as the 3 scripts already
there). All 8 launch locale packs are inlined rather than fetched separately — at this
catalog size that is fewer round-trips, not more weight (~12 KB combined for all 8 packs).
No fonts, no per-country data beyond the curated ~65-row table. Not measured against a real
network/device this session (see "Not tested").
