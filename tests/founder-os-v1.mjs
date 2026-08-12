import assert from 'node:assert/strict';
import {
  PILLARS,
  AGENTS,
  SOPS,
  createRuntimeState,
  loadRuntimeState,
  saveRuntimeState,
  reserveFounderOsAction,
  runHealthCycle,
  decide,
  updateAlert,
  snapshot,
} from '../src/founder-os-runtime-v1.js';
import { renderFounderOsDocument } from '../src/founder-os-ui-v1.js';
import { isFounderOsRoute, handleFounderOs } from '../src/founder-os-routes-v1.js';

class FakeObject {
  constructor(body, etag) { this.body = body; this.etag = etag; this.httpEtag = etag; }
  async text() { return this.body; }
}

class FakeBucket {
  constructor() { this.map = new Map(); this.seq = 0; }
  async get(key) { return this.map.get(key) || null; }
  async put(key, body, options = {}) {
    if (options?.onlyIf?.etagDoesNotMatch === '*' && this.map.has(key)) return null;
    const etag = `e${++this.seq}`;
    const object = new FakeObject(String(body), etag);
    this.map.set(key, object);
    return { etag };
  }
}

const okFetch = async (url) => {
  const path = String(url);
  if (path.includes('n8n.sowhatafrica.com')) return new Response('ok', { status: 200 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const partialFetch = async (url) => {
  const path = String(url);
  if (path.includes('n8n.sowhatafrica.com')) return new Response('bad', { status: 503 });
  if (path.includes('senecompare-production')) return new Response('bad', { status: 502 });
  return new Response('ok', { status: 200 });
};

assert.equal(PILLARS.length, 6, 'Founder OS must expose exactly 6 pillars');
assert.equal(AGENTS.length, 8, 'Founder OS must expose exactly 8 agents');
assert.equal(SOPS.length, 8, 'Founder OS must expose exactly 8 SOPs');
assert.deepEqual(PILLARS.map((row) => row.id), ['COMMAND', 'COMMS', 'FINANCE', 'CONTENT', 'KNOWLEDGE', 'AUTOMATIONS']);
assert.ok(AGENTS.every((agent) => PILLARS.some((pillar) => pillar.id === agent.pillar)), 'every agent belongs to a pillar');
assert.ok(SOPS.every((sop) => AGENTS.some((agent) => agent.id === sop.agent)), 'every SOP belongs to an agent');

const state0 = createRuntimeState(Date.UTC(2026, 7, 12, 17, 0, 0));
assert.equal(state0.state_mode, 'private_edge_mirror');
assert.equal(state0.connectors.length, 8);
assert.equal(state0.alerts.length, 1);
assert.equal(state0.alerts[0].details.classification, 'reconciliation_gap_not_confirmed_money_error');
assert.equal(state0.decisions.length, 0, 'no fake approval should be manufactured');

const bucket = new FakeBucket();
const env = {
  VISUALS_BUCKET: bucket,
  SENECOMPARE_SUPABASE_URL: 'https://example.supabase.co',
  SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256: 'a'.repeat(64),
};

const firstLoad = await loadRuntimeState(env);
assert.equal(firstLoad.persisted, true);
assert.ok(bucket.map.size >= 1, 'runtime state is persisted privately');

const reservationA = await reserveFounderOsAction(env, 'same-key', { operation: 'test' });
const reservationB = await reserveFounderOsAction(env, 'same-key', { operation: 'test' });
assert.equal(reservationA.reserved, true, 'first action reserves idempotency key');
assert.equal(reservationB.duplicate, true, 'duplicate action is detected');

const healthy = await runHealthCycle(env, { fetcher: okFetch, origin: 'https://dakarstyle.com' });
assert.equal(healthy.health.status, 'operational');
assert.equal(healthy.health.online, 4);
assert.equal(healthy.runs[0].agent, 'studio-monitor');
assert.equal(healthy.runs[0].status, 'succeeded');
assert.equal(healthy.connectors.find((row) => row.id === 'cloudflare')?.status, 'connected');
assert.equal(healthy.connectors.find((row) => row.id === 'n8n')?.status, 'connected');

const degraded = await runHealthCycle(env, { fetcher: partialFetch, origin: 'https://dakarstyle.com' });
assert.equal(degraded.health.status, 'degraded');
assert.ok(degraded.alerts.some((row) => row.component === 'health:n8n' && row.status === 'open'));
assert.ok(degraded.alerts.some((row) => row.component === 'health:senecompare' && row.status === 'open'));

const mutable = (await loadRuntimeState(env)).state;
mutable.decisions.unshift({
  id: 'decision-test-1',
  title: 'Valider un envoi externe de test',
  risk: 2,
  status: 'pending',
  recommended_action: { connector: 'gmail', action: 'send_draft', payload: { draft_id: 'safe-reference-only' } },
});
await saveRuntimeState(env, mutable);
const approved = await decide(env, 'decision-test-1', 'approve', 'test-owner');
assert.equal(approved.ok, true);
assert.equal(approved.decision.status, 'approved');
const afterDecision = (await loadRuntimeState(env)).state;
assert.equal(afterDecision.outbox[0].status, 'queued_for_verified_executor');
assert.equal(afterDecision.outbox[0].connector, 'gmail');
assert.ok(!('executed_at' in afterDecision.outbox[0]), 'approval must not impersonate external execution');

const financeAlert = afterDecision.alerts.find((row) => row.id === 'bootstrap-payment-reconciliation-gap');
assert.ok(financeAlert);
const acknowledged = await updateAlert(env, financeAlert.id, 'acknowledge', 'test-owner');
assert.equal(acknowledged.alert.status, 'acknowledged');
const resolved = await updateAlert(env, financeAlert.id, 'resolve', 'test-owner');
assert.equal(resolved.alert.status, 'resolved');

const data = await snapshot(env);
assert.equal(data.metrics.pillars, 6);
assert.equal(data.metrics.agents, 8);
assert.equal(data.metrics.sops, 8);
const document = renderFounderOsDocument(data, 'csrf-test-token');
for (const view of ['cockpit', 'decisions', 'pillars', 'agents', 'runs', 'alerts', 'connectors', 'knowledge', 'automations']) {
  assert.ok(document.includes(`data-view="${view}"`), `screen ${view} must exist`);
}
assert.ok(document.includes('SIGNALS → NORMALIZE → CONTEXT → ROUTE → DECIDE → ACT → VERIFY → LOG → LEARN → BRIEF'));
assert.ok(document.includes('min-height:44px'), 'interactive controls must preserve 44px touch targets');
assert.ok(document.includes('viewport-fit=cover'), 'mobile safe areas must be supported');
assert.ok(document.includes('prefers-reduced-motion'), 'reduced motion must be respected');
assert.ok(!document.includes('service_role'), 'server credentials must not be rendered');
assert.ok(!document.includes('sb_secret_'), 'secret Supabase key must not be rendered');
assert.ok(!document.includes('EAA'), 'Meta token patterns must not be rendered');

assert.equal(isFounderOsRoute(new URL('https://dakarstyle.com/founder-os')), true);
assert.equal(isFounderOsRoute(new URL('https://dakarstyle.com/api/founder-os/snapshot')), true);
assert.equal(isFounderOsRoute(new URL('https://dakarstyle.com/social-intelligence/v5')), false);
const healthResponse = await handleFounderOs(new Request('https://dakarstyle.com/api/founder-os/health'), env, null);
assert.equal(healthResponse.status, 200);
assert.equal((await healthResponse.json()).service, 'founder-os');

const unauthorizedPage = await handleFounderOs(new Request('https://dakarstyle.com/founder-os'), env, null);
assert.equal(unauthorizedPage.status, 302, 'browser without owner session is redirected to existing login');
assert.equal(unauthorizedPage.headers.get('location'), '/social-intelligence');

console.log('Founder OS v1 tests: OK');
