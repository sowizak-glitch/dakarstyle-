#!/usr/bin/env node
// One-time / repeatable publish of the built Global Core bundle into
// sama_app_assets (the same DB-backed asset store addon-v1122-script and
// site-studio-v1122-script already use). Zero new dependencies: talks to
// PostgREST directly with fetch(), the same way every other piece of this
// repo avoids adding a Supabase SDK dependency on the client side.
//
// Requires two environment variables (never hardcode secrets in the repo):
//   SUPABASE_URL                 e.g. https://xmdpmtvieqgoorbxytey.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service role key (Project Settings > API)
//
// Usage:
//   node scripts/build-global-core.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/deploy-global-core.mjs
//
// This script is intentionally NOT run automatically by `npm test` or CI —
// publishing a new production asset is a deliberate, reviewed action.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(here, '..', 'dist', 'global-core-v1.js');
const shaPath = path.join(here, '..', 'dist', 'global-core-v1.sha256');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Nothing was sent.');
  process.exit(1);
}

const content = readFileSync(bundlePath, 'utf8');
const sha256 = readFileSync(shaPath, 'utf8').trim();

const response = await fetch(`${SUPABASE_URL}/rest/v1/sama_app_assets`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify([{ path: 'global-core-v1-script', content, sha256, updated_at: new Date().toISOString() }]),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Publish failed: HTTP ${response.status}`);
  console.error(body);
  process.exit(1);
}
console.log(`Published global-core-v1-script (${content.length} bytes, sha256=${sha256})`);
console.log('Next: deploy the samabusiness-global-core and samabusiness-global-settings functions,');
console.log('then deploy sama-assets (already wired to reference samabusiness-global-core), e.g.:');
console.log('  supabase functions deploy samabusiness-global-core --project-ref xmdpmtvieqgoorbxytey');
console.log('  supabase functions deploy samabusiness-global-settings --project-ref xmdpmtvieqgoorbxytey');
console.log('  supabase functions deploy sama-assets --project-ref xmdpmtvieqgoorbxytey');
