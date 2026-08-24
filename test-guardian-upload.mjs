import assert from 'node:assert/strict';
import worker from './src/legacy-index.js';

if (typeof crypto.subtle.timingSafeEqual !== 'function') {
  Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
    value(left, right) {
      if (left.byteLength !== right.byteLength) return false;
      let difference = 0;
      for (let index = 0; index < left.byteLength; index += 1) {
        difference |= left[index] ^ right[index];
      }
      return difference === 0;
    },
  });
}

class MemoryR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    this.objects.set(key, { value, options });
  }

  async head(key) {
    return this.objects.has(key) ? { key } : null;
  }

  async get(key) {
    const item = this.objects.get(key);
    if (!item) return null;
    return {
      async text() {
        if (typeof item.value === 'string') return item.value;
        return new TextDecoder().decode(item.value);
      },
    };
  }

  async delete(key) {
    this.objects.delete(key);
  }
}

const uploadKey = 'upload-key-for-tests-with-strong-diversity-93A!';
const evidenceKey = 'evidence-key-for-tests-with-strong-diversity-71Z!';
const env = {
  SOWHAT_UPLOAD_KEY: uploadKey,
  GUARDIAN_EVIDENCE_KEY: evidenceKey,
  VISUALS_BUCKET: new MemoryR2(),
  ASSETS: { fetch: () => new Response('fallback', { status: 404 }) },
};
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(evidenceKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function evidenceFields(bytes = png) {
  const digest = await sha256Hex(bytes);
  const values = [
    'sowhat-guardian-evidence-v1',
    '7a74b445-f96d-4461-b2ad-bef22337d817',
    'a'.repeat(64),
    digest,
    '0123456789abcdef',
    'fedcba9876543210',
    'true',
    'true',
    'true',
    'true',
    'b'.repeat(64),
  ];
  const names = [
    'guardian_evidence_schema',
    'guardian_asset_id',
    'guardian_source_sha256',
    'guardian_secured_sha256',
    'guardian_phash',
    'guardian_dhash',
    'guardian_watermark_valid',
    'guardian_c2pa_signed',
    'guardian_c2pa_valid',
    'guardian_metadata_written',
    'guardian_report_sha256',
  ];
  const fields = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  fields.guardian_evidence_signature = await sign(values.join('\n'));
  return fields;
}

async function upload(fields, bytes = png, key = uploadKey, route = 'upload-secured') {
  const form = new FormData();
  form.append('file', new File([bytes], 'sample.png', { type: 'image/png' }));
  form.append('media_kind', 'IMAGE');
  form.append('publication_type', 'POST IMAGE');
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return worker.fetch(new Request(`https://unit.test/visuals/api/${route}`, {
    method: 'POST',
    headers: { 'X-SOWHAT-KEY': key },
    body: form,
  }), env);
}

let response = await upload(await evidenceFields(), png, 'wrong-key');
assert.equal(response.status, 401);

const forged = await evidenceFields();
forged.guardian_evidence_signature = '0'.repeat(64);
response = await upload(forged);
assert.equal(response.status, 422);
assert.equal((await response.json()).error, 'guardian_evidence_invalid');

const valid = await evidenceFields();
response = await upload(valid);
assert.equal(response.status, 201);
const manifest = await response.json();
assert.equal(manifest.status, 'GUARDIAN_VERIFIED');
assert.equal(manifest.guardian.evidence_verified, true);
assert.equal(manifest.guardian.c2pa_valid, true);
assert.equal(manifest.sha256, valid.guardian_secured_sha256);
assert.equal(env.VISUALS_BUCKET.objects.size, 3);

const altered = Uint8Array.from([...png, 5]);
response = await upload(valid, altered);
assert.equal(response.status, 422);
assert.equal((await response.json()).error, 'guardian_hash_mismatch');

response = await upload({ asset_id: 'SWA-20260824-LEGACY01' }, png, uploadKey, 'upload');
assert.equal(response.status, 200);
const legacy = await response.json();
assert.equal(legacy.status, 'LEGACY_UNVERIFIED');
assert.equal(legacy.guardian, null);

console.log('guardian upload tests passed');
