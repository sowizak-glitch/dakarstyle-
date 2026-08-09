import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_DIR = resolve(ROOT, 'src');

const LEGACY_FILES = [
  'app-v9-00.b64',
  'app-v9-01.b64',
  'app-v9-02.b64',
  'app-v9-03.b64',
];

// Hashes enforced by the current Supabase `sama-assets` recovery path.
const EXPECTED_PART_SHA256 = [
  '96588464cc74fb60c06846ce193f8c8fdfb87af971e56cdfd0ec4f6890c5e3cc',
  '584ffd6aa887dee6b599e65dccd5bc9318f9b3bc14a336fb93e9cfb6cfd74399',
  '6c96d546476036a2f98eec5b627a57843b1a2b26128c6019f8291358dc876fc1',
  '1671898f81c952791ec5b58fd6faee45c3babd29b3a113ccb150b4ce1baa0e9c',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const rawParts = await Promise.all(
  LEGACY_FILES.map(async (name) => (await readFile(resolve(ROOT, name), 'utf8')).trim()),
);

// Preserve the compatibility correction already present in the production
// `sama-assets` Edge Function. This is intentionally explicit and audited.
const parts = [...rawParts];
const compatibilityPatchApplied = parts[1].includes('D55u859x');
if (compatibilityPatchApplied) {
  parts[1] = parts[1].replace('D55u859x', 'D55b959x');
}

const partHashes = parts.map(sha256);
for (let index = 0; index < EXPECTED_PART_SHA256.length; index += 1) {
  if (partHashes[index] !== EXPECTED_PART_SHA256[index]) {
    throw new Error(
      `Legacy chunk ${index} checksum mismatch: expected ${EXPECTED_PART_SHA256[index]}, got ${partHashes[index]}`,
    );
  }
}

const compressed = Buffer.from(parts.join(''), 'base64');
const html = gunzipSync(compressed).toString('utf8');

const requiredMarkers = [
  '<!doctype html',
  'SAMA BUSINESS IA',
  'sama-business-api',
  'sama-session-v3',
  'parse_whatsapp_order',
  'stock_movement',
  'withdrawable_amount',
];

const lowerHtml = html.toLowerCase();
if (!lowerHtml.includes('<!doctype html')) throw new Error('Decoded bundle is not HTML');
for (const marker of requiredMarkers.slice(1)) {
  if (!html.includes(marker)) throw new Error(`Decoded bundle missing marker: ${marker}`);
}
if (Buffer.byteLength(html, 'utf8') <= 50_000) throw new Error('Decoded bundle is unexpectedly small');

await mkdir(SRC_DIR, { recursive: true });
await writeFile(resolve(SRC_DIR, 'legacy-v9.html'), html, 'utf8');

const metadata = {
  schema: 1,
  source: 'sama-business/app-v9-00..03.b64',
  format: 'gzip+base64',
  compatibilityPatch: compatibilityPatchApplied ? 'D55u859x -> D55b959x in chunk 01' : null,
  sourcePartSha256: partHashes,
  expectedPartSha256: EXPECTED_PART_SHA256,
  compressedBytes: compressed.byteLength,
  htmlBytes: Buffer.byteLength(html, 'utf8'),
  htmlSha256: sha256(html),
};
await writeFile(resolve(SRC_DIR, 'legacy-v9.meta.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log(`SAMABUSINESS readable source extracted: ${metadata.htmlBytes} bytes`);
console.log(`HTML SHA-256: ${metadata.htmlSha256}`);
