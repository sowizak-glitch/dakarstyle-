export const FOUNDER_OS_VERSION = '1.0.0';
export const FOUNDER_OS_STATE_KEY = 'visuals/founder-os/v1/runtime.json';
export const FOUNDER_OS_IDEMPOTENCY_PREFIX = 'visuals/founder-os/v1/idempotency/';

const MAX_RUNS = 80;
const MAX_OUTBOX = 80;

export const PILLARS = Object.freeze([
  { id: 'COMMAND', name: 'COMMAND', purpose: 'Contexte, priorites, decisions et supervision centrale', position: 1 },
  { id: 'COMMS', name: 'COMMS', purpose: 'Inbox et intelligence des communications', position: 2 },
  { id: 'FINANCE', name: 'FINANCE', purpose: 'CRM, revenus, paiements et reconciliation', position: 3 },
  { id: 'CONTENT', name: 'CONTENT', purpose: 'Operations de contenu multicanal', position: 4 },
  { id: 'KNOWLEDGE', name: 'KNOWLEDGE', purpose: 'Documentation verifiee et memoire', position: 5 },
  { id: 'AUTOMATIONS', name: 'AUTOMATIONS', purpose: 'Continuite des workflows, webhooks et infrastructure', position: 6 },
]);

export const AGENTS = Object.freeze([
  { id: 'brain-librarian', pillar: 'COMMAND', name: 'Brain Librarian', autonomy: 4, maxRisk: 1, mission: 'Organiser le contexte, les decisions et la connaissance gouvernee.' },
  { id: 'inbox-triage', pillar: 'COMMS', name: 'Inbox Triage', autonomy: 2, maxRisk: 2, mission: 'Classifier les messages et preparer les reponses completes.' },
  { id: 'slack-scout', pillar: 'COMMS', name: 'Communication Scout', autonomy: 5, maxRisk: 1, mission: 'Extraire decisions, blocages et engagements des communications.' },
  { id: 'crm-pulse', pillar: 'FINANCE', name: 'CRM Pulse', autonomy: 4, maxRisk: 1, mission: 'Qualifier les opportunites et maintenir le pipeline.' },
  { id: 'payment-pulse', pillar: 'FINANCE', name: 'Payment Pulse', autonomy: 4, maxRisk: 1, mission: 'Reconciler commandes, ventes et preuves de paiement sans mouvement de fonds.' },
  { id: 'social-pulse', pillar: 'CONTENT', name: 'Social Pulse', autonomy: 2, maxRisk: 2, mission: 'Transformer les signaux business en contenus multicanaux prets a valider.' },
  { id: 'notion-sync', pillar: 'KNOWLEDGE', name: 'Notion Sync', autonomy: 4, maxRisk: 1, mission: 'Synchroniser les faits verifies, releases et liens de connaissance.' },
  { id: 'studio-monitor', pillar: 'AUTOMATIONS', name: 'Studio Monitor', autonomy: 5, maxRisk: 1, mission: 'Surveiller les workflows et reparer seulement les incidents reversibles connus.' },
]);

export const SOPS = Object.freeze([
  { id: 'daily-command-brief', pillar: 'COMMAND', agent: 'brain-librarian', risk: 0, approval: false, label: 'Daily Command Brief' },
  { id: 'inbox-triage-and-draft', pillar: 'COMMS', agent: 'inbox-triage', risk: 2, approval: true, label: 'Inbox Triage & Draft' },
  { id: 'communications-scout', pillar: 'COMMS', agent: 'slack-scout', risk: 0, approval: false, label: 'Communication Scout' },
  { id: 'lead-and-crm-pulse', pillar: 'FINANCE', agent: 'crm-pulse', risk: 1, approval: false, label: 'Lead & CRM Pulse' },
  { id: 'payment-reconciliation', pillar: 'FINANCE', agent: 'payment-pulse', risk: 1, approval: false, label: 'Payment Reconciliation' },
  { id: 'content-multichannel-pack', pillar: 'CONTENT', agent: 'social-pulse', risk: 2, approval: true, label: 'Content Multichannel Pack' },
  { id: 'verified-knowledge-sync', pillar: 'KNOWLEDGE', agent: 'notion-sync', risk: 1, approval: false, label: 'Verified Knowledge Sync' },
  { id: 'automation-health-watch', pillar: 'AUTOMATIONS', agent: 'studio-monitor', risk: 1, approval: false, label: 'Automation Health Watch' },
]);

const CONNECTOR_SEED = Object.freeze([
  { id: 'gmail', provider: 'Google', status: 'connected', via: 'chatgpt_connector', capabilities: ['read', 'draft', 'send'] },
  { id: 'github', provider: 'GitHub', status: 'connected', via: 'chatgpt_connector', capabilities: ['read', 'branch', 'commit', 'pr'] },
  { id: 'notion', provider: 'Notion', status: 'connected', via: 'chatgpt_connector', capabilities: ['read', 'write'] },
  { id: 'supabase', provider: 'Supabase', status: 'connected', via: 'chatgpt_connector', capabilities: ['read', 'write', 'health'] },
  { id: 'whatsapp', provider: 'Meta', status: 'not_configured', via: 'founder_os_adapter', capabilities: ['read', 'send', 'template'] },
  { id: 'meta-social', provider: 'Meta', status: 'not_configured', via: 'founder_os_adapter', capabilities: ['read_metrics', 'publish'] },
  { id: 'n8n', provider: 'n8n', status: 'not_configured', via: 'founder_os_adapter', capabilities: ['trigger', 'inspect', 'retry'] },
  { id: 'cloudflare', provider: 'Cloudflare', status: 'not_configured', via: 'founder_os_adapter', capabilities: ['runtime', 'logs', 'deploy'] },
]);

function iso(now = Date.now()) {
  return new Date(now).toISOString();
}

function newId(prefix = 'fos') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialAlert(now) {
  return {
    id: 'bootstrap-payment-reconciliation-gap',
    severity: 'warning',
    pillar: 'FINANCE',
    component: 'payment-pulse',
    status: 'open',
    summary: 'Verifier la propagation entre paiements, ventes et commandes Sama Business.',
    details: {
      classification: 'reconciliation_gap_not_confirmed_money_error',
      evidence: { orders_total: 93500, sales_total: 93000, payment_records_total: 63000, order_paid_amount_total: 0 },
      safe_next_action: 'Verifier les liens entre les enregistrements avant toute modification financiere.',
    },
    created_at: iso(now),
  };
}

export function createRuntimeState(now = Date.now()) {
  return {
    version: FOUNDER_OS_VERSION,
    state_mode: 'private_edge_mirror',
    generated_at: iso(now),
    storage_status: 'ready',
    connectors: clone(CONNECTOR_SEED),
    alerts: [initialAlert(now)],
    decisions: [],
    runs: [],
    outbox: [],
    knowledge: {
      stages: { source: 0, signal: 0, claim: 0, fact: 0, memory: 0 },
      note: 'La connaissance durable reste gouvernee dans Supabase/Notion/GitHub. Le runtime Edge ne conserve qu un miroir operationnel minimal.',
    },
    health: { status: 'unknown', checked_at: null, probes: [] },
    last_command_brief_at: null,
  };
}

async function readJsonObject(bucket, key) {
  try {
    const object = await bucket.get(key);
    if (!object) return { value: null, etag: null };
    const value = JSON.parse(await object.text());
    return { value, etag: object.httpEtag || object.etag || null };
  } catch {
    return { value: null, etag: null };
  }
}

export async function loadRuntimeState(env, now = Date.now()) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.get !== 'function') {
    const state = createRuntimeState(now);
    state.storage_status = 'unavailable';
    return { state, etag: null, persisted: false };
  }
  const stored = await readJsonObject(bucket, FOUNDER_OS_STATE_KEY);
  if (stored.value && stored.value.version === FOUNDER_OS_VERSION) {
    return { state: stored.value, etag: stored.etag, persisted: true };
  }
  const state = createRuntimeState(now);
  await saveRuntimeState(env, state);
  return { state, etag: null, persisted: true };
}

export async function saveRuntimeState(env, state) {
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.put !== 'function') return false;
  const clean = {
    ...state,
    generated_at: iso(),
    runs: (Array.isArray(state.runs) ? state.runs : []).slice(0, MAX_RUNS),
    outbox: (Array.isArray(state.outbox) ? state.outbox : []).slice(0, MAX_OUTBOX),
  };
  await bucket.put(FOUNDER_OS_STATE_KEY, JSON.stringify(clean), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
  return true;
}

export async function reserveFounderOsAction(env, key, payload = {}) {
  const safeKey = String(key || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 160);
  if (!safeKey) return { reserved: false, duplicate: false, error: 'invalid_idempotency_key' };
  const bucket = env?.VISUALS_BUCKET;
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function') {
    return { reserved: false, duplicate: false, error: 'storage_unavailable' };
  }
  const objectKey = `${FOUNDER_OS_IDEMPOTENCY_PREFIX}${safeKey}.json`;
  try {
    const result = await bucket.put(objectKey, JSON.stringify({ key: safeKey, payload, at: iso() }), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
    });
    if (result) return { reserved: true, duplicate: false, error: null };
  } catch {
    // A concurrent request may have won. Re-read to distinguish duplicate from storage failure.
  }
  const existing = await bucket.get(objectKey).catch(() => null);
  return existing
    ? { reserved: false, duplicate: true, error: null }
    : { reserved: false, duplicate: false, error: 'idempotency_unavailable' };
}

async function probe(fetcher, id, label, url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetcher(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'x-client-info': `founder-os/${FOUNDER_OS_VERSION}` },
    });
    return {
      id, label, ok: response.ok, status: response.ok ? 'online' : 'degraded',
      http_status: response.status, latency_ms: Date.now() - started, checked_at: iso(),
    };
  } catch (error) {
    return {
      id, label, ok: false, status: 'offline', http_status: 0,
      latency_ms: Date.now() - started, checked_at: iso(), error: String(error?.name || 'probe_failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

function upsertConnector(state, connector) {
  const index = state.connectors.findIndex((row) => row.id === connector.id);
  if (index >= 0) state.connectors[index] = { ...state.connectors[index], ...connector };
  else state.connectors.push(connector);
}

function openOrRefreshAlert(state, alert) {
  const existing = state.alerts.find((row) => row.component === alert.component && row.status === 'open');
  if (existing) {
    Object.assign(existing, alert, { id: existing.id, created_at: existing.created_at, updated_at: iso() });
    return existing;
  }
  const created = { id: newId('alert'), status: 'open', created_at: iso(), ...alert };
  state.alerts.unshift(created);
  return created;
}

function resolveComponentAlerts(state, component) {
  for (const alert of state.alerts) {
    if (alert.component === component && alert.status === 'open') {
      alert.status = 'resolved';
      alert.resolved_at = iso();
    }
  }
}

export async function runHealthCycle(env, options = {}) {
  const now = Number(options.now) || Date.now();
  const fetcher = options.fetcher || fetch;
  const origin = String(options.origin || 'https://dakarstyle.com').replace(/\/$/, '');
  const supabase = String(env?.SENECOMPARE_SUPABASE_URL || 'https://xmdpmtvieqgoorbxytey.supabase.co').replace(/\/$/, '');
  const { state } = await loadRuntimeState(env, now);
  const startedAt = iso(now);

  const probes = await Promise.all([
    probe(fetcher, 'control', 'SOWHAT Control', `${origin}/api/social-intelligence/health`),
    probe(fetcher, 'samabusiness', 'Sama Business', `${supabase}/functions/v1/samabusiness-pwa?mode=health`),
    probe(fetcher, 'senecompare', 'SeneCompare', `${supabase}/functions/v1/senecompare-production/health`),
    probe(fetcher, 'n8n', 'n8n', 'https://n8n.sowhatafrica.com/healthz'),
  ]);

  const online = probes.filter((row) => row.ok).length;
  state.health = {
    status: online === probes.length ? 'operational' : online >= 2 ? 'degraded' : 'critical',
    checked_at: iso(),
    online,
    total: probes.length,
    probes,
  };

  upsertConnector(state, {
    id: 'cloudflare', provider: 'Cloudflare', status: 'connected', via: 'worker_runtime',
    capabilities: ['runtime', 'health'], last_probe_at: iso(), last_success_at: iso(), last_error: null,
  });

  const supabaseOk = probes.some((row) => ['samabusiness', 'senecompare'].includes(row.id) && row.ok);
  upsertConnector(state, {
    id: 'supabase', provider: 'Supabase', status: supabaseOk ? 'connected' : 'degraded', via: 'edge_health_probe',
    capabilities: ['read', 'write', 'health'], last_probe_at: iso(),
    last_success_at: supabaseOk ? iso() : state.connectors.find((row) => row.id === 'supabase')?.last_success_at || null,
    last_error: supabaseOk ? null : 'health_probe_failed',
  });

  const n8nProbe = probes.find((row) => row.id === 'n8n');
  upsertConnector(state, {
    id: 'n8n', provider: 'n8n', status: n8nProbe?.ok ? 'connected' : 'degraded', via: 'health_probe',
    capabilities: ['health'], last_probe_at: iso(),
    last_success_at: n8nProbe?.ok ? iso() : state.connectors.find((row) => row.id === 'n8n')?.last_success_at || null,
    last_error: n8nProbe?.ok ? null : 'health_probe_failed',
  });

  for (const row of probes) {
    const component = `health:${row.id}`;
    if (row.ok) resolveComponentAlerts(state, component);
    else openOrRefreshAlert(state, {
      severity: state.health.status === 'critical' ? 'critical' : 'warning',
      pillar: 'AUTOMATIONS', component,
      summary: `${row.label} ne repond pas normalement au controle Founder OS.`,
      details: { status: row.status, http_status: row.http_status, latency_ms: row.latency_ms },
    });
  }

  state.runs.unshift({
    id: newId('run'), correlation_id: newId('health'), agent: 'studio-monitor', sop: 'automation-health-watch',
    status: 'succeeded', risk: 1, autonomy: 5, started_at: startedAt, finished_at: iso(),
    output: { health_status: state.health.status, online, total: probes.length },
    evidence: probes.map(({ id, status, http_status, checked_at }) => ({ id, status, http_status, checked_at })),
  });

  await saveRuntimeState(env, state);
  return state;
}

export async function decide(env, decisionId, action, actor = 'founder') {
  const { state } = await loadRuntimeState(env);
  const decision = state.decisions.find((row) => row.id === decisionId);
  if (!decision) return { ok: false, status: 404, error: 'decision_not_found' };
  if (decision.status !== 'pending') return { ok: false, status: 409, error: 'decision_already_processed', decision };
  if (!['approve', 'reject'].includes(action)) return { ok: false, status: 400, error: 'invalid_decision_action' };

  decision.status = action === 'approve' ? 'approved' : 'rejected';
  decision.decided_by_actor = actor;
  decision.decided_at = iso();

  if (decision.status === 'approved' && decision.recommended_action?.connector && decision.recommended_action?.action) {
    state.outbox.unshift({
      id: newId('outbox'), decision_id: decision.id,
      connector: String(decision.recommended_action.connector), action: String(decision.recommended_action.action),
      payload: decision.recommended_action.payload || {}, status: 'queued_for_verified_executor',
      risk: Number(decision.risk || 0), created_at: iso(),
      note: 'L approbation ne declenche jamais directement une action externe depuis le navigateur.',
    });
  }
  await saveRuntimeState(env, state);
  return { ok: true, status: 200, decision, outbox_queued: decision.status === 'approved' };
}

export async function updateAlert(env, alertId, action, actor = 'founder') {
  const { state } = await loadRuntimeState(env);
  const alert = state.alerts.find((row) => row.id === alertId);
  if (!alert) return { ok: false, status: 404, error: 'alert_not_found' };
  if (!['acknowledge', 'resolve'].includes(action)) return { ok: false, status: 400, error: 'invalid_alert_action' };
  if (action === 'acknowledge') {
    alert.status = 'acknowledged'; alert.acknowledged_by_actor = actor; alert.acknowledged_at = iso();
  } else {
    alert.status = 'resolved'; alert.resolved_by_actor = actor; alert.resolved_at = iso();
  }
  await saveRuntimeState(env, state);
  return { ok: true, status: 200, alert };
}

export function buildCommandBrief(state) {
  const alerts = Array.isArray(state?.alerts) ? state.alerts.filter((row) => row.status === 'open') : [];
  const pending = Array.isArray(state?.decisions) ? state.decisions.filter((row) => row.status === 'pending') : [];
  const failedRuns = Array.isArray(state?.runs) ? state.runs.filter((row) => ['failed', 'unknown_result'].includes(row.status)) : [];
  return {
    generated_at: iso(),
    headline: pending.length
      ? `${pending.length} decision${pending.length > 1 ? 's' : ''} a valider.`
      : alerts.length
        ? `${alerts.length} exception${alerts.length > 1 ? 's' : ''} ouverte${alerts.length > 1 ? 's' : ''}.`
        : 'Aucune exception prioritaire.',
    top_decisions: pending.slice(0, 5),
    exceptions: alerts.slice(0, 8),
    automation_health: state?.health || { status: 'unknown' },
    failed_runs: failedRuns.slice(0, 5),
    today_focus: pending[0]?.title || alerts[0]?.summary || 'Maintenir les flux stables et surveiller les signaux business.',
  };
}

export async function snapshot(env, options = {}) {
  const { state, persisted } = await loadRuntimeState(env, options.now);
  const openAlerts = state.alerts.filter((row) => row.status === 'open');
  const pendingDecisions = state.decisions.filter((row) => row.status === 'pending');
  const connected = state.connectors.filter((row) => row.status === 'connected').length;
  return {
    version: FOUNDER_OS_VERSION,
    persisted,
    registry: { pillars: PILLARS, agents: AGENTS, sops: SOPS },
    state,
    brief: buildCommandBrief(state),
    metrics: {
      pillars: PILLARS.length,
      agents: AGENTS.length,
      sops: SOPS.length,
      connected_connectors: connected,
      total_connectors: state.connectors.length,
      open_alerts: openAlerts.length,
      critical_alerts: openAlerts.filter((row) => row.severity === 'critical').length,
      pending_decisions: pendingDecisions.length,
      recent_runs: state.runs.length,
      outbox_waiting: state.outbox.filter((row) => row.status === 'queued_for_verified_executor').length,
    },
  };
}
