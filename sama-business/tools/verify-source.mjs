import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE = resolve(ROOT, 'src', 'legacy-v9.html');
const META = resolve(ROOT, 'src', 'legacy-v9.meta.json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const html = await readFile(SOURCE, 'utf8');
const meta = JSON.parse(await readFile(META, 'utf8'));

const markers = [
  '<!doctype html',
  'SAMA BUSINESS IA',
  'sama-business-api',
  'sama-session-v3',
  'parse_whatsapp_order',
  'stock_movement',
  'withdrawable_amount',
];
for (const marker of markers) {
  const present = marker === '<!doctype html'
    ? html.toLowerCase().includes(marker)
    : html.includes(marker);
  if (!present) throw new Error(`Source integrity marker missing: ${marker}`);
}

const sourceHash = sha256(Buffer.from(html, 'utf8'));
if (sourceHash !== meta.htmlSha256) {
  throw new Error(`Readable source hash mismatch: expected ${meta.htmlSha256}, got ${sourceHash}`);
}

const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
];
for (const pattern of forbiddenPatterns) {
  if (pattern.test(html)) throw new Error(`Potential secret detected by pattern ${pattern}`);
}

if (Buffer.byteLength(html, 'utf8') <= 50_000) throw new Error('Readable source is unexpectedly small');

console.log(`SAMABUSINESS source verified: ${Buffer.byteLength(html, 'utf8')} bytes`);
console.log(`Source SHA-256: ${sourceHash}`);
