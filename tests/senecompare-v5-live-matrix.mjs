import assert from 'node:assert/strict';

const APP_URL = process.env.SENECOMPARE_URL || 'https://senecompare.dakarstyle.com';
const queries = [
  ['Téléphones', 'telephone'],
  ['Téléphone Samsung moins de 150000 F à Dakar', 'telephone'],
  ['iPhone 13 128 Go moins de 250000 F à Dakar', 'telephone'],
  ['ordinateur portable HP Core i5 à Dakar', 'informatique'],
  ['Électroménager', 'electromenager'],
  ['Frigo neuf moins de 300000 F', 'electromenager'],
  ['Maison', 'maison'],
  ['Canapé salon à Dakar', 'maison'],
  ['Voiture occasion moins de 5000000 F', 'voiture'],
  ['Moto Jakarta occasion à Dakar', 'moto'],
  ['tissus wax gesner', 'mode'],
  ['Débardeur Sénégal 2026', 'mode'],
  ['Pharmacie à Dakar', 'sante'],
  ['clinique pharmacie dentiste Dakar', 'sante'],
  ['formation cours certification Sénégal', 'education'],
  ['plombier électricien meuble Dakar', 'artisanat'],
  ['service de livraison colis Dakar', 'livraison'],
  ['transport taxi VTC Dakar', 'transport'],
  ['pizza Dakar', 'restauration'],
  ['salon de coiffure à Dakar', 'coiffure'],
  ['appartement à louer Dakar', 'immobilier'],
  ['assurance auto Sénégal', 'finance'],
  ['hotel à Saly', 'voyage'],
  ['dama soxla telefon Samsung ci Dakar', 'telephone'],
  ['jumtukaay kër frigo ci Dakar', 'electromenager'],
  ['yobbu colis Dakar', 'livraison'],
  ['woto occasion Dakar', 'voiture'],
  ['yére wax getzner', 'mode'],
];

async function request(path, options = {}, timeout = 70000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(`${APP_URL}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const healthResponse = await request('/api/health', { headers: { 'cache-control': 'no-cache' } }, 20000);
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.version, '5.0.0');
assert.equal(health.engine_version, '5.0.0');
assert.equal(health.data_mode, 'hybrid_local_search');
assert.equal(health.catalog_connected, true);
assert.equal(health.gateway_security, true);

const records = [];
for (const [query, expectedCategory] of queries) {
  const started = performance.now();
  const response = await request('/api/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://senecompare.dakarstyle.com',
      'x-client-version': 'senecompare-v5-field-matrix',
    },
    body: JSON.stringify({ query, language: 'bi', session_id: 'v5-field-matrix' }),
  });
  const duration = Math.round(performance.now() - started);
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `${query}: ${JSON.stringify(payload).slice(0, 1000)}`);
  assert.equal(payload.ok, true, query);
  assert.equal(payload.version, '5.0.0', query);
  assert.equal(payload.engine_version, '5.0.0', query);
  assert.equal(payload.data_mode, 'hybrid_local_search', query);
  assert.equal(payload.parsed?.category, expectedCategory, `${query}: ${JSON.stringify(payload.parsed)}`);
  assert.ok(Array.isArray(payload.results) && payload.results.length >= 1, `${query}: zero results`);
  assert.equal(payload.meta?.guaranteed_continuity, true, query);
  assert.ok(payload.results.every((item) => /^https?:\/\//.test(String(item.source_url || ''))), `${query}: invalid source URL`);
  assert.ok(payload.results.every((item) => ['offer', 'source'].includes(String(item.result_type))), `${query}: invalid result type`);
  assert.ok(payload.results.every((item) => item.result_type !== 'source' || Number(item.total_fcfa || 0) === 0), `${query}: invented source price`);
  records.push({ query, expectedCategory, results: payload.results.length, offers: payload.meta?.concrete_offer_count || 0, sources: payload.meta?.source_entry_count || 0, duration });
  await new Promise((resolve) => setTimeout(resolve, 1700));
}

const durations = records.map((record) => record.duration).sort((a, b) => a - b);
const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
assert.equal(records.filter((record) => record.results === 0).length, 0);
assert.ok(p95 < 16000, `p95 too high: ${p95}ms`);
console.log(JSON.stringify({ ok: true, version: '5.0.0', query_count: records.length, zero_result_rate: 0, p95_ms: p95, records }, null, 2));
