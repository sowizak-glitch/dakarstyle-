import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE = resolve(ROOT, 'src', 'legacy-v9.html');
const DIST = resolve(ROOT, 'dist');
const CHUNK_SIZE = 6500;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const html = await readFile(SOURCE, 'utf8');
const sourceBytes = Buffer.from(html, 'utf8');

// Node is pinned in CI. gzip output is generated twice and compared so that
// a non-deterministic toolchain fails before an artifact can be published.
const gzipOptions = { level: 9, mtime: 0 };
const compressedA = gzipSync(sourceBytes, gzipOptions);
const compressedB = gzipSync(sourceBytes, gzipOptions);
if (!compressedA.equals(compressedB)) throw new Error('gzip output is not deterministic');

const roundTrip = gunzipSync(compressedA);
if (!roundTrip.equals(sourceBytes)) throw new Error('gzip round-trip changed the readable source');

const base64 = compressedA.toString('base64');
const chunks = [];
for (let offset = 0; offset < base64.length; offset += CHUNK_SIZE) {
  chunks.push(base64.slice(offset, offset + CHUNK_SIZE));
}
if (chunks.length < 1 || chunks.length > 32) throw new Error(`Unexpected artifact chunk count: ${chunks.length}`);

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
for (let index = 0; index < chunks.length; index += 1) {
  const name = `artifact-${String(index).padStart(2, '0')}.b64`;
  await writeFile(resolve(DIST, name), chunks[index], 'utf8');
}

const manifest = {
  schema: 1,
  status: 'preview-only',
  source: 'src/legacy-v9.html',
  sourceSha256: sha256(sourceBytes),
  format: 'gzip+base64',
  nodeMajor: Number(process.versions.node.split('.')[0]),
  gzipLevel: 9,
  chunkSize: CHUNK_SIZE,
  chunkCount: chunks.length,
  artifactSha256: sha256(compressedA),
  artifactBytes: compressedA.byteLength,
  base64Bytes: base64.length,
  chunks: chunks.map((content, index) => ({
    file: `artifact-${String(index).padStart(2, '0')}.b64`,
    bytes: content.length,
    sha256: sha256(content),
  })),
  productionSafe: false,
  note: 'Generated artifact is not consumed by production until an explicit release step is implemented and approved.',
};
await writeFile(resolve(DIST, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Preview artifact built: ${manifest.chunkCount} chunks, ${manifest.artifactBytes} gzip bytes`);
console.log(`Source SHA-256: ${manifest.sourceSha256}`);
console.log(`Artifact SHA-256: ${manifest.artifactSha256}`);
