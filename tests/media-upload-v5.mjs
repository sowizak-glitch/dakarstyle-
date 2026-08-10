/**
 * SOWHAT Control V5 - Tests du televersement binaire.
 *
 * Le fil conducteur : un fichier n est jamais ce que son nom ou son en-tete
 * pretend qu il est. Chaque scenario hostile ici a deja ete vu ailleurs en
 * production — HTML renomme .jpg, SVG renomme .png, remontee de chemin dans
 * le nom, taille annoncee mensongere.
 */

import assert from 'node:assert/strict';
import {
  MAX_REQUEST_BYTES, STREAM_THRESHOLD_BYTES, UPLOAD_ERROR, UPLOAD_FIELD,
  V5_PUBLIC_MEDIA_PREFIX, detectContentType, detectHostileContent, displayFilename,
  handleMediaUpload, isV5PublicMediaPath, newMediaKey, serveV5Media,
} from '../src/media-upload-v5.js';
import { MEDIA_KEY_PREFIX, validateMedia } from '../src/security-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

/* ---------------- Doubles ---------------- */

class Bucket {
  constructor(options = {}) {
    this.store = new Map();
    this.puts = [];
    this.failPut = options.failPut === true;
  }

  async put(key, body, meta = {}) {
    if (this.failPut) throw new Error('r2 indisponible');
    this.puts.push({ key, body, meta });
    this.store.set(key, { body, meta });
    return { key };
  }

  async get(key) {
    if (!this.store.has(key)) return null;
    const entry = this.store.get(key);
    const bytes = entry.body instanceof ArrayBuffer ? new Uint8Array(entry.body) : entry.body;
    return {
      body: bytes,
      size: bytes?.byteLength ?? bytes?.length ?? 0,
      httpEtag: '"etag-de-test"',
      httpMetadata: entry.meta?.httpMetadata || {},
      text: async () => String(bytes),
    };
  }
}

const makeEnv = (bucket = new Bucket()) => ({ VISUALS_BUCKET: bucket });

/* ---------------- Fabriques de fichiers ---------------- */

function pad(head, total = 64) {
  const bytes = new Uint8Array(total);
  bytes.set(head.slice(0, total));
  for (let i = head.length; i < total; i += 1) bytes[i] = (i * 7) % 251;
  return bytes;
}

const JPEG = pad([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const PNG = pad([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
const MP4 = pad([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
  0x00, 0x00, 0x02, 0x00,
]);
const ascii = (text, total = 96) => pad([...text].map((c) => c.charCodeAt(0)), total);

const HTML = ascii('<!DOCTYPE html><html><body>bonjour</body></html>');
const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
const EXE = pad([0x4D, 0x5A, 0x90, 0x00, 0x03]);
const ELF = pad([0x7F, 0x45, 0x4C, 0x46, 0x02]);
const ZIP = pad([0x50, 0x4B, 0x03, 0x04]);
const SHEBANG = ascii('#!/bin/sh\nls\n');
const MOV = pad([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);

/** Requete multipart reelle : le parseur de la plateforme est traverse. */
function realRequest(bytes, { name, type }) {
  const form = new FormData();
  form.append(UPLOAD_FIELD, new File([bytes], name, { type }), name);
  return new Request('https://dakarstyle.com/api/social-intelligence/v5/media/upload', {
    method: 'POST',
    body: form,
  });
}

/** Requete synthetique : permet d annoncer une taille sans l allouer. */
function syntheticRequest(file, headers = {}) {
  const form = new Map([[UPLOAD_FIELD, file]]);
  return {
    method: 'POST',
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=x', ...headers }),
    formData: async () => form,
  };
}

function fakeFile({ name, type, size, bytes = JPEG }) {
  const buffer = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    name,
    type,
    size,
    slice: () => ({ arrayBuffer: async () => buffer() }),
    arrayBuffer: async () => buffer(),
    stream: () => 'flux',
  };
}

const upload = (env, request, options = {}) => handleMediaUpload(request, env, { now: 1750000000000, ...options });

/* ------------------------------------------------------------------ */
/* Detection de signature                                              */
/* ------------------------------------------------------------------ */

test('signature reconnue pour les trois formats acceptes', () => {
  assert.equal(detectContentType(JPEG), 'image/jpeg');
  assert.equal(detectContentType(PNG), 'image/png');
  assert.equal(detectContentType(MP4), 'video/mp4');
});

test('signature inconnue : rien n est suppose', () => {
  assert.equal(detectContentType(HTML), null);
  assert.equal(detectContentType(SVG), null);
  assert.equal(detectContentType(EXE), null);
  assert.equal(detectContentType(new Uint8Array([])), null);
  assert.equal(detectContentType(MOV), null, 'un .mov n est pas un mp4');
});

test('contenus hostiles nommes explicitement', () => {
  assert.equal(detectHostileContent(HTML), 'html');
  assert.equal(detectHostileContent(SVG), 'svg');
  assert.equal(detectHostileContent(EXE), 'executable');
  assert.equal(detectHostileContent(ELF), 'executable');
  assert.equal(detectHostileContent(ZIP), 'archive');
  assert.equal(detectHostileContent(SHEBANG), 'script');
  assert.equal(detectHostileContent(JPEG), null);
});

/* ------------------------------------------------------------------ */
/* Cle de stockage                                                     */
/* ------------------------------------------------------------------ */

test('la cle vient du serveur : prefixe fixe, identifiant aleatoire', () => {
  const key = newMediaKey('image/jpeg');
  assert.ok(key.startsWith(MEDIA_KEY_PREFIX));
  assert.ok(key.endsWith('.jpg'));
  assert.notEqual(key, newMediaKey('image/jpeg'), 'deux appels ne donnent jamais la meme cle');
});

test('l extension de la cle vient du type reel, pas du nom fourni', () => {
  assert.ok(newMediaKey('image/png').endsWith('.png'));
  assert.ok(newMediaKey('video/mp4').endsWith('.mp4'));
  assert.throws(() => newMediaKey('image/gif'), (error) => error.code === UPLOAD_ERROR.TYPE_REFUSED);
});

test('un identifiant aleatoire trop court fait echouer plutot que produire une cle faible', () => {
  assert.throws(() => newMediaKey('image/jpeg', () => 'court'), (error) => error.code === UPLOAD_ERROR.STORAGE_FAILED);
});

test('le nom affiche est neutralise et porte l extension reelle', () => {
  assert.equal(displayFilename('../../etc/passwd', 'image/jpeg'), 'passwd.jpg');
  assert.equal(displayFilename('photo.html', 'image/png'), 'photo.png');
  assert.equal(displayFilename('', 'video/mp4'), 'media.mp4');
});

/* ------------------------------------------------------------------ */
/* Chemin nominal                                                      */
/* ------------------------------------------------------------------ */

test('JPEG valide : accepte, ecrit, metadonnees exactes', async () => {
  const bucket = new Bucket();
  const result = await upload(makeEnv(bucket), realRequest(JPEG, { name: 'look-01.jpg', type: 'image/jpeg' }));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.status, 201);
  assert.equal(result.media.content_type, 'image/jpeg');
  assert.equal(result.media.kind, 'IMAGE');
  assert.equal(result.media.size_bytes, JPEG.length);
  assert.equal(result.media.filename, 'look-01.jpg');
  assert.ok(result.media.r2_key.startsWith(MEDIA_KEY_PREFIX));
  assert.equal(bucket.puts.length, 1);
  assert.equal(bucket.puts[0].meta.httpMetadata.contentType, 'image/jpeg');
});

test('PNG valide : accepte', async () => {
  const result = await upload(makeEnv(), realRequest(PNG, { name: 'visuel.png', type: 'image/png' }));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.media.kind, 'IMAGE');
});

test('MP4 valide : accepte et classe VIDEO', async () => {
  const result = await upload(makeEnv(), realRequest(MP4, { name: 'reel-02.mp4', type: 'video/mp4' }));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.media.kind, 'VIDEO');
  assert.equal(result.media.content_type, 'video/mp4');
});

test('le media renvoye passe la validation utilisee par la publication', async () => {
  const result = await upload(makeEnv(), realRequest(JPEG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(validateMedia(result.media).valid, true);
});

test('aucune URL n est renvoyee : rien a copier pour l operateur', async () => {
  const result = await upload(makeEnv(), realRequest(JPEG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.ok(!/https?:\/\//.test(JSON.stringify(result)), 'aucune URL dans la reponse');
  assert.deepEqual(
    Object.keys(result.media).sort(),
    ['content_type', 'filename', 'kind', 'r2_key', 'size_bytes'],
  );
});

test('le client ne choisit pas la cle : un champ r2_key fourni est ignore', async () => {
  const form = new FormData();
  form.append(UPLOAD_FIELD, new File([JPEG], 'a.jpg', { type: 'image/jpeg' }), 'a.jpg');
  form.append('r2_key', 'visuals/media/ecrase-moi.jpg');
  const request = new Request('https://dakarstyle.com/x', { method: 'POST', body: form });
  const result = await upload(makeEnv(), request);
  assert.equal(result.ok, true);
  assert.notEqual(result.media.r2_key, 'visuals/media/ecrase-moi.jpg');
  assert.ok(result.media.r2_key.startsWith(MEDIA_KEY_PREFIX));
});

test('au-dela du seuil, le corps part en flux et non en memoire', async () => {
  const bucket = new Bucket();
  const file = fakeFile({ name: 'gros.mp4', type: 'video/mp4', size: STREAM_THRESHOLD_BYTES + 1, bytes: MP4 });
  const result = await upload(makeEnv(bucket), syntheticRequest(file));
  assert.equal(result.ok, true, result.error);
  assert.equal(bucket.puts[0].body, 'flux');
});

/* ------------------------------------------------------------------ */
/* Refus                                                               */
/* ------------------------------------------------------------------ */

test('methode autre que POST refusee', async () => {
  const result = await handleMediaUpload({ method: 'GET', headers: new Headers() }, makeEnv());
  assert.equal(result.status, 405);
  assert.equal(result.error, UPLOAD_ERROR.METHOD_NOT_ALLOWED);
});

test('corps JSON au lieu d un fichier : refus explicite', async () => {
  const request = new Request('https://dakarstyle.com/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"media_url":"https://exemple/a.jpg"}',
  });
  const result = await upload(makeEnv(), request);
  assert.equal(result.status, 415);
  assert.equal(result.error, UPLOAD_ERROR.NOT_MULTIPART);
});

test('champ fichier absent', async () => {
  const form = new FormData();
  form.append('autre', 'valeur');
  const request = new Request('https://dakarstyle.com/x', { method: 'POST', body: form });
  const result = await upload(makeEnv(), request);
  assert.equal(result.status, 400);
  assert.equal(result.error, UPLOAD_ERROR.FILE_MISSING);
});

test('fichier vide refuse', async () => {
  const result = await upload(makeEnv(), realRequest(new Uint8Array([]), { name: 'vide.jpg', type: 'image/jpeg' }));
  assert.equal(result.status, 400);
  assert.equal(result.error, UPLOAD_ERROR.FILE_EMPTY);
});

test('fichier trop volumineux : refus par type, sans allouer la taille annoncee', async () => {
  const image = fakeFile({ name: 'enorme.jpg', type: 'image/jpeg', size: 9 * 1024 * 1024 });
  const first = await upload(makeEnv(), syntheticRequest(image));
  assert.equal(first.status, 413);
  assert.equal(first.error, UPLOAD_ERROR.TOO_LARGE);

  const video = fakeFile({ name: 'enorme.mp4', type: 'video/mp4', size: 101 * 1024 * 1024, bytes: MP4 });
  assert.equal((await upload(makeEnv(), syntheticRequest(video))).status, 413);
});

test('taille annoncee au-dela du plafond absolu : refus sans lire le corps', async () => {
  let parsed = false;
  const request = {
    method: 'POST',
    headers: new Headers({
      'content-type': 'multipart/form-data; boundary=x',
      'content-length': String(MAX_REQUEST_BYTES + 1),
    }),
    formData: async () => { parsed = true; return new Map(); },
  };
  const result = await upload(makeEnv(), request);
  assert.equal(result.status, 413);
  assert.equal(parsed, false, 'le corps ne doit pas etre parse');
});

test('type MIME hors allowlist refuse', async () => {
  for (const type of ['image/gif', 'image/svg+xml', 'text/html', 'application/pdf', 'video/quicktime', '']) {
    const result = await upload(makeEnv(), syntheticRequest(fakeFile({ name: 'a.jpg', type, size: 64 })));
    assert.equal(result.error, UPLOAD_ERROR.TYPE_REFUSED, type);
  }
});

test('extension incoherente avec le type declare refusee', async () => {
  const result = await upload(makeEnv(), realRequest(JPEG, { name: 'photo.png', type: 'image/jpeg' }));
  assert.equal(result.status, 415);
  assert.equal(result.error, UPLOAD_ERROR.EXTENSION_MISMATCH);
});

test('extension absente refusee', async () => {
  const result = await upload(makeEnv(), realRequest(JPEG, { name: 'photo', type: 'image/jpeg' }));
  assert.equal(result.error, UPLOAD_ERROR.EXTENSION_MISMATCH);
});

test('HTML renomme en .jpg : refuse par les octets, pas par le nom', async () => {
  const bucket = new Bucket();
  const result = await upload(makeEnv(bucket), realRequest(HTML, { name: 'innocent.jpg', type: 'image/jpeg' }));
  assert.equal(result.status, 415);
  assert.equal(result.error, UPLOAD_ERROR.HOSTILE_CONTENT);
  assert.equal(result.detail, 'html');
  assert.equal(bucket.puts.length, 0, 'rien ne doit etre ecrit');
});

test('SVG renomme en .png : refuse', async () => {
  const result = await upload(makeEnv(), realRequest(SVG, { name: 'logo.png', type: 'image/png' }));
  assert.equal(result.error, UPLOAD_ERROR.HOSTILE_CONTENT);
  assert.equal(result.detail, 'svg');
});

test('executable ou archive renomme en media : refuse', async () => {
  for (const [bytes, name, type] of [[EXE, 'a.jpg', 'image/jpeg'], [ELF, 'a.png', 'image/png'], [ZIP, 'a.mp4', 'video/mp4']]) {
    const result = await upload(makeEnv(), realRequest(bytes, { name, type }));
    assert.equal(result.error, UPLOAD_ERROR.HOSTILE_CONTENT, name);
  }
});

test('script shell renomme en photo : refuse', async () => {
  const result = await upload(makeEnv(), realRequest(SHEBANG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(result.error, UPLOAD_ERROR.HOSTILE_CONTENT);
});

test('magic bytes incorrects mais inoffensifs : refus quand meme', async () => {
  const noise = pad([0x01, 0x02, 0x03, 0x04, 0x05]);
  const result = await upload(makeEnv(), realRequest(noise, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(result.status, 415);
  assert.equal(result.error, UPLOAD_ERROR.SIGNATURE_MISMATCH);
});

test('PNG reel annonce en JPEG : incoherence detectee', async () => {
  const result = await upload(makeEnv(), realRequest(PNG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(result.error, UPLOAD_ERROR.SIGNATURE_MISMATCH);
  assert.ok(result.detail.includes('image/png'));
});

test('nom de fichier malveillant : ni chemin, ni remontee dans la cle', async () => {
  const result = await upload(makeEnv(), realRequest(JPEG, { name: '../../../etc/passwd.jpg', type: 'image/jpeg' }));
  assert.equal(result.ok, true);
  assert.ok(!result.media.filename.includes('/'));
  assert.ok(!result.media.filename.includes('..'));
  assert.ok(!result.media.r2_key.includes('..'));
  assert.ok(result.media.r2_key.startsWith(MEDIA_KEY_PREFIX));
});

test('VISUALS_BUCKET absent : refus propre, pas de plantage', async () => {
  const result = await upload({}, realRequest(JPEG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(result.status, 503);
  assert.equal(result.error, UPLOAD_ERROR.STORAGE_UNAVAILABLE);
});

test('erreur R2 : rapportee comme un echec d envoi', async () => {
  const result = await upload(makeEnv(new Bucket({ failPut: true })), realRequest(JPEG, { name: 'a.jpg', type: 'image/jpeg' }));
  assert.equal(result.status, 502);
  assert.equal(result.error, UPLOAD_ERROR.STORAGE_FAILED);
});

test('formulaire illisible : refus sans exception', async () => {
  const request = {
    method: 'POST',
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=x' }),
    formData: async () => { throw new Error('limite atteinte'); },
  };
  const result = await upload(makeEnv(), request);
  assert.equal(result.status, 400);
  assert.equal(result.error, UPLOAD_ERROR.MALFORMED_FORM);
});

/* ------------------------------------------------------------------ */
/* Lecture publique                                                    */
/* ------------------------------------------------------------------ */

test('le chemin public correspond exactement a la cle R2', () => {
  assert.equal(V5_PUBLIC_MEDIA_PREFIX, `/${MEDIA_KEY_PREFIX}`);
  assert.equal(isV5PublicMediaPath(`/${MEDIA_KEY_PREFIX}abc.jpg`), true);
  assert.equal(isV5PublicMediaPath('/visuals/media/autre.jpg'), false, 'la V4 garde son prefixe');
  assert.equal(isV5PublicMediaPath('/visuals/manifest/a.json'), false);
});

test('media servi avec le bon type, sans sniffing, en lecture seule', async () => {
  const bucket = new Bucket();
  const uploaded = await upload(makeEnv(bucket), realRequest(JPEG, { name: 'a.jpg', type: 'image/jpeg' }));
  const response = await serveV5Media(
    new Request(`https://dakarstyle.com/${uploaded.media.r2_key}`), makeEnv(bucket),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('content-security-policy').includes("default-src 'none'"));
  assert.ok(response.headers.get('x-robots-tag').includes('noindex'));
});

test('ecriture interdite sur le chemin public', async () => {
  const response = await serveV5Media(
    new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}a.jpg`, { method: 'DELETE' }), makeEnv(),
  );
  assert.equal(response.status, 405);
});

test('remontee de chemin et prefixe etranger refuses', async () => {
  const bucket = new Bucket();
  await bucket.put('visuals/media/secret.jpg', JPEG, { httpMetadata: { contentType: 'image/jpeg' } });
  for (const path of [
    `/${MEDIA_KEY_PREFIX}sous/../../../media/secret.jpg`,
    '/visuals/media/secret.jpg',
    `/${MEDIA_KEY_PREFIX}sous//dossier.jpg`,
  ]) {
    const response = await serveV5Media(new Request(`https://dakarstyle.com${path}`), makeEnv(bucket));
    assert.equal(response.status, 404, path);
  }
});

test('objet au type non autorise : non servi, meme sous le bon prefixe', async () => {
  const bucket = new Bucket();
  await bucket.put(`${MEDIA_KEY_PREFIX}piege.jpg`, HTML, { httpMetadata: { contentType: 'text/html' } });
  const response = await serveV5Media(
    new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}piege.jpg`), makeEnv(bucket),
  );
  assert.equal(response.status, 404);
});

test('media inexistant : 404 sans mise en cache', async () => {
  const response = await serveV5Media(
    new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}inconnu.jpg`), makeEnv(),
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 media upload: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
