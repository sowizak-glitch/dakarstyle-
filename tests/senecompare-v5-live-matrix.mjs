import assert from 'node:assert/strict';

const APP_URL = process.env.SENECOMPARE_URL || 'https://senecompare.dakarstyle.com';
const ORIGIN = 'https://senecompare.dakarstyle.com';
const GATEWAY_VERSION = '5.1.0';
const ENGINE_VERSION = '5.0.0';
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

const healthResponse = await request('/api/health', {
  headers: {
    accept: 'application/json',
    origin: ORIGIN,
    'cache-control': 'no-cache',
    'x-client-version': 'senecompare-v5-field-matrix',
  },
}, 20000);
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.version, GATEWAY_VERSION);
assert.equal(health.engine_version, ENGINE_VERSION);
assert.equal(health.data_mode, 'hybrid_local_search');
assert.equal(health.catalog_connected, true);
assert.equal(health.gateway_security, true);
assert.equal(health.intent_priority, true);

const records = [];
for (const [query, expectedCategory] of queries) {
  const started = performance.now();
  const response = await request('/api/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'x-client-version': 'senecompare-v5-field-matrix',
    },
    body: JSON.stringify({ query, language: 'bi', session_id: 'v5-field-matrix' }),
  });
  const duration = Math.round(performance.now() - started);
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `${query}: ${JSON.stringify(payload).slice(0, 1000)}`);
  assert.equal(payload.ok, true, query);
  assert.equal(payload.version, GATEWAY_VERSION, query);
  assert.equal(payload.gateway_version, GATEWAY_VERSION, query);
  assert.equal(payload.engine_version, ENGINE_VERSION, query);
  assert.equal(payload.data_mode, 'hybrid_local_search', query);
  assert.equal(payload.parsed?.category, expectedCategory, `${query}: ${JSON.stringify(payload.parsed)}`);
  assert.ok(Array.isArray(payload.results) && payload.results.length >= 1, `${query}: zero results`);
  const hasConcreteOffer = payload.results.some((item) => item.result_type === 'offer');
  const hasSourceContinuity = payload.meta?.guaranteed_continuity === true && payload.results.some((item) => item.result_type === 'source');
  assert.equal(hasConcreteOffer || hasSourceContinuity, true, `${query}: neither concrete offer nor source continuity`);
  assert.ok(payload.results.every((item) => /^https?:\/\//.test(String(item.source_url || ''))), `${query}: invalid source URL`);
  assert.ok(payload.results.every((item) => ['offer', 'source'].includes(String(item.result_type))), `${query}: invalid result type`);
  assert.ok(payload.results.every((item) => item.result_type !== 'source' || Number(item.total_fcfa || 0) === 0), `${query}: invented source price`);
  records.push({
    query,
    expectedCategory,
    results: payload.results.length,
    offers: payload.meta?.concrete_offer_count || 0,
    sources: payload.meta?.source_entry_count || 0,
    continuity: hasConcreteOffer ? 'concrete_offer' : 'source_fallback',
    duration,
  });
  await new Promise((resolve) => setTimeout(resolve, 1700));
}

const durations = records.map((record) => record.duration).sort((a, b) => a - b);
const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
assert.equal(records.filter((record) => record.results === 0).length, 0);
assert.ok(p95 < 16000, `p95 too high: ${p95}ms`);
console.log(JSON.stringify({
  ok: true,
  frontend_version: '5.0.0',
  gateway_version: GATEWAY_VERSION,
  engine_version: ENGINE_VERSION,
  query_count: records.length,
  zero_result_rate: 0,
  p95_ms: p95,
  records,
}, null, 2));
