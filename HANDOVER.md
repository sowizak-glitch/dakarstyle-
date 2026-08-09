# HANDOVER — SAMABUSINESS SOURCE OF TRUTH

Status: source-of-truth identification in progress. This file intentionally contains only verified infrastructure facts.

## Verified

- Repository: `sowizak-glitch/dakarstyle-`
- Production base bundle path: `sama-business/app-v9-00.b64` through `app-v9-03.b64`
- Supabase project: `xmdpmtvieqgoorbxytey`
- Canonical HTML assembler: Edge Function `sama-assets`
- Runtime version observed: `11.2.2`
- Production PWA function: `samabusiness-pwa`
- API referenced by canonical HTML: `samabusiness-api-v10`
- Runtime addon is loaded from database asset `addon-v1122-script`
- Site Studio runtime is loaded from database asset `site-studio-v1122-script`

## Safety rule

The GitHub four-part bundle is not the whole current application. Production is assembled by Supabase from the base bundle plus database-backed scripts. Preserve all sources before any refactor.
