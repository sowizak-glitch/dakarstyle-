import assert from 'node:assert/strict';
import { handleGuardianPassport } from '../src/guardian-passport.js';

const assetId = 'SWA-GDN-11111111-2222-4333-8444-555555555555';
const manifest = {
  ok: true,
  status: 'GUARDIAN_VERIFIED',
  asset_id: assetId,
  title: 'SOWHAT MAX — Sénégal <script>alert(1)</script>',
  collection: 'AETHER SOWHAT MAX',
  product: 'Débardeur Sénégal 2026',
  location: 'Dakar — Sénégal',
  creator: 'SOWHAT AFRICA',
  publish: false,
  sha256: 'a'.repeat(64),
  c2pa_valid: true,
  watermark_applied: true,
  metadata_written: true,
  original_media_url: 'https://dakarstyle-visual-upload.idrissaminata.workers.dev/visuals/media/test.png',
  manifest_url: 'https://dakarstyle-visual-upload.idrissaminata.workers.dev/visuals/manifest/test.json',
  sealed_at: '2026-08-24T13:00:00Z',
  guardian: {
    evidence_verified: true,
    c2pa_valid: true,
    watermark_valid: true,
    metadata_written: true,
    source_sha256: 'b'.repeat(64),
    phash: '0123456789abcdef',
    dhash: 'fedcba9876543210',
  },
};

const env = {
  VISUALS_BUCKET: {
    async get(key) {
      if (key !== `visuals/manifest/${assetId}.json`) return null;
      return { async text() { return JSON.stringify(manifest); } };
    },
  },
};

{
  const response = await handleGuardianPassport(new Request('https://dakarstyle.com/visuals/'), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Visual Passport/);
  assert.match(html, /SWA-GDN/);
}

{
  const response = await handleGuardianPassport(new Request(`https://dakarstyle.com/visuals/${assetId}`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /GUARDIAN_VERIFIED/);
  assert.match(html, /C2PA/);
  assert.match(html, /Watermark DWT-DCT/);
  assert.match(html, /Métadonnées EXIF\/IPTC\/XMP/);
  assert.match(html, /Preuve HMAC/);
  assert.match(html, /Dakar — Sénégal/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
}

{
  const response = await handleGuardianPassport(new Request('https://dakarstyle.com/visuals/SWA-GDN-NOT-VALID'), env);
  assert.equal(response.status, 404);
}

{
  const response = await handleGuardianPassport(new Request(`https://dakarstyle.com/visuals/${assetId}`, { method: 'POST' }), env);
  assert.equal(response.status, 405);
}

console.log('Guardian Visual Passport: OK');
