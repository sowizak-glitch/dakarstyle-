import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '2.0.0';
const PROJECT_URL = Deno.env.get('SUPABASE_URL') || 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const FUNCTIONS = `${PROJECT_URL}/functions/v1`;
const SECURITY_DOMAIN = 'https://security.dakarstyle.com';
const ALLOWED_ORIGINS = new Set([
  SECURITY_DOMAIN,
  'http://localhost:8787',
  'http://127.0.0.1:8787'
]);
const BUNDLE_URL = `${FUNCTIONS}/sama-livraison-bundle`;
const BUNDLE_SHA256 = '868fc3416c40cfbd62ecb112460c60d6b02a15ed64f8bf730f9f416e0c062362';
const SEVERITY_RANK = {
  info: 0,
  warning: 1,
  high: 2,
  critical: 3
};
function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const db = createClient(PROJECT_URL, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function responseHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Access-Control-Allow-Headers': 'authorization,content-type,x-client-info,x-sowhat-collector-key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-site',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SOWHAT-Security-Control-Version': VERSION,
    Vary: 'Origin'
  };
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function json(req, value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      ...extra
    }
  });
}
function errorResponse(req, status, code) {
  return json(req, {
    ok: false,
    code
  }, status);
}
function nowIso() {
  return new Date().toISOString();
}
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for(let i = 0; i < a.length; i += 1)diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function requireCollector(req) {
  const supplied = req.headers.get('x-sowhat-collector-key') || '';
  const { data, error } = await db.from('security_control_secrets').select('secret').eq('name', 'collector').maybeSingle();
  if (error || !data?.secret || !safeEqual(supplied, String(data.secret))) {
    throw Object.assign(new Error('COLLECTOR_AUTH_REQUIRED'), {
      status: 401
    });
  }
}
async function requireAdmin(req) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || !ANON_KEY) throw Object.assign(new Error('AUTH_REQUIRED'), {
    status: 401
  });
  const token = authorization.slice(7).trim();
  const authClient = createClient(PROJECT_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('AUTH_INVALID'), {
    status: 401
  });
  const { data: admin, error: adminError } = await db.from('security_console_admins').select('role,active').eq('user_id', data.user.id).maybeSingle();
  if (adminError || !admin?.active) throw Object.assign(new Error('ACCESS_DENIED'), {
    status: 403
  });
  return {
    user: {
      id: data.user.id,
      email: data.user.email
    },
    role: String(admin.role)
  };
}
async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [
    ...new Uint8Array(digest)
  ].map((item)=>item.toString(16).padStart(2, '0')).join('');
}
async function fetchBounded(url, init = {}, timeoutMs = 20_000, maxBytes = 500_000) {
  const started = performance.now();
  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json,text/html;q=0.8,*/*;q=0.5',
      'User-Agent': `SOWHAT-Security-Control/${VERSION}`,
      ...init.headers || {}
    }
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let total = 0;
  if (reader) {
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`RESPONSE_TOO_LARGE_${maxBytes}`);
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks){
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    status: response.status,
    headers: response.headers,
    body,
    latencyMs: Math.round(performance.now() - started)
  };
}
function parseJson(body) {
  try {
    const value = JSON.parse(new TextDecoder().decode(body));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch  {
    return {};
  }
}
async function contractCheck(control, name, severity, url, expectedStatus, required, init = {}) {
  try {
    const result = await fetchBounded(url, init);
    const value = parseJson(result.body);
    const mismatches = Object.entries(required).filter(([key, expected])=>value[key] !== expected);
    const ok = result.status === expectedStatus && mismatches.length === 0;
    return {
      control,
      name,
      severity,
      ok,
      detail: ok ? 'Contrat vérifié' : `HTTP ${result.status}; contrat inattendu`,
      latency_ms: result.latencyMs,
      observed: result.status,
      expected: expectedStatus
    };
  } catch (error) {
    return {
      control,
      name,
      severity,
      ok: false,
      detail: String(error?.message || error)
    };
  }
}
async function siteCheck(name, url, allowCloudflareChallenge = false) {
  try {
    const result = await fetchBounded(url, {}, 20_000, 350_000);
    const challenge = allowCloudflareChallenge && result.status === 403 && (result.headers.get('server') || '').toLowerCase() === 'cloudflare' && Boolean(result.headers.get('cf-ray'));
    const ok = result.status >= 200 && result.status < 400 || challenge;
    return {
      control: 'Web public',
      name,
      severity: 'high',
      ok,
      detail: challenge ? 'Challenge Cloudflare actif' : `HTTP ${result.status}`,
      latency_ms: result.latencyMs,
      observed: result.status,
      expected: '2xx/3xx ou challenge Cloudflare'
    };
  } catch (error) {
    return {
      control: 'Web public',
      name,
      severity: 'high',
      ok: false,
      detail: String(error?.message || error)
    };
  }
}
async function securityShellCheck() {
  try {
    const result = await fetchBounded(`${SECURITY_DOMAIN}/`, {}, 20_000, 250_000);
    const body = new TextDecoder().decode(result.body);
    const type = (result.headers.get('content-type') || '').toLowerCase();
    const csp = result.headers.get('content-security-policy') || '';
    const ok = result.status === 200 && type.startsWith('text/html') && body.includes('Security Command Center') && csp.includes("frame-ancestors 'none'") && result.headers.get('x-content-type-options') === 'nosniff';
    return {
      control: 'Security Control',
      name: 'Interface HTML durcie',
      severity: 'critical',
      ok,
      detail: ok ? 'HTML, CSP, anti-framing et nosniff conformes' : `HTTP ${result.status}; type=${type || 'absent'}`,
      latency_ms: result.latencyMs,
      observed: type,
      expected: 'text/html + CSP stricte'
    };
  } catch (error) {
    return {
      control: 'Security Control',
      name: 'Interface HTML durcie',
      severity: 'critical',
      ok: false,
      detail: String(error?.message || error)
    };
  }
}
async function bundleCheck() {
  try {
    const result = await fetchBounded(BUNDLE_URL, {}, 45_000, 2_100_000);
    const actual = await sha256Hex(result.body);
    const ok = result.status === 200 && actual === BUNDLE_SHA256;
    return {
      control: 'SAMA Livraison',
      name: 'Empreinte du bundle de production',
      severity: 'critical',
      ok,
      detail: ok ? 'Empreinte immuable conforme' : 'Dérive du bundle détectée',
      latency_ms: result.latencyMs,
      observed: actual.slice(0, 16),
      expected: BUNDLE_SHA256.slice(0, 16)
    };
  } catch (error) {
    return {
      control: 'SAMA Livraison',
      name: 'Empreinte du bundle de production',
      severity: 'critical',
      ok: false,
      detail: String(error?.message || error)
    };
  }
}
async function collectChecks() {
  const gateway = `${FUNCTIONS}/senecompare-gateway`;
  const engine = `${FUNCTIONS}/senecompare-production`;
  return Promise.all([
    contractCheck('SeneCompare Gateway', 'Santé de la passerelle', 'critical', `${gateway}/health`, 200, {
      ok: true,
      version: '3.0.3',
      engine_version: '3.0.1',
      gateway_security: true
    }),
    contractCheck('SeneCompare Gateway', 'Origine hostile bloquée', 'critical', `${gateway}/health`, 403, {
      ok: false,
      code: 'ORIGIN_FORBIDDEN'
    }, {
      headers: {
        Origin: 'https://attacker.invalid'
      }
    }),
    contractCheck('SeneCompare Gateway', 'Corps non JSON rejeté', 'high', `${gateway}/search`, 415, {
      ok: false,
      code: 'JSON_REQUIRED'
    }, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: 'not-json'
    }),
    contractCheck('SeneCompare Engine', 'Révision de sécurité', 'critical', `${engine}/health`, 200, {
      ok: true,
      version: '3.0.1',
      security_revision: '2026-08-04.2'
    }),
    contractCheck('SeneCompare Engine', 'Énumération .env fermée', 'critical', `${engine}/.env`, 404, {
      ok: false,
      code: 'NOT_FOUND'
    }),
    contractCheck('SeneCompare Engine', 'Origine hostile rejetée', 'critical', `${engine}/health`, 403, {
      ok: false,
      code: 'ORIGIN_FORBIDDEN'
    }, {
      headers: {
        Origin: 'https://attacker.invalid'
      }
    }),
    contractCheck('SAMA Business', 'Santé PWA', 'critical', `${FUNCTIONS}/samabusiness-pwa?mode=health`, 200, {
      ok: true
    }),
    bundleCheck(),
    siteCheck('SeneCompare', 'https://senecompare.dakarstyle.com/__health?security_console=2'),
    siteCheck('SAMA Business', 'https://samabusiness.dakarstyle.com/'),
    siteCheck('DakarStyle', 'https://dakarstyle.com/'),
    siteCheck('Sowhat Africa', 'https://sowhatafrica.com/', true),
    siteCheck('n8n', 'https://n8n.sowhatafrica.com/', true),
    contractCheck('Security Control', 'Contrat de santé du Worker', 'critical', `${SECURITY_DOMAIN}/__health`, 200, {
      ok: true,
      version: '2.0.0',
      same_origin_api: true,
      auth_proxy: true,
      zero_trust: true
    }),
    contractCheck('Security Control', 'API privée sans session', 'critical', `${SECURITY_DOMAIN}/api/dashboard`, 401, {
      ok: false,
      code: 'AUTH_REQUIRED'
    }),
    securityShellCheck()
  ]);
}
async function countRows(table, column, since) {
  const { count, error } = await db.from(table).select('*', {
    count: 'exact',
    head: true
  }).gte(column, since);
  return error ? 0 : Number(count || 0);
}
function countBy(rows, key) {
  const out = {};
  for (const row of rows){
    const value = String(row[key] ?? 'inconnu').slice(0, 80);
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}
function topEntries(value, limit = 6) {
  return Object.entries(value).sort((a, b)=>b[1] - a[1]).slice(0, limit).map(([label, count])=>({
      label,
      count
    }));
}
async function collectMetrics() {
  const now = Date.now();
  const since24 = new Date(now - 24 * 3600_000).toISOString();
  const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();
  const [searches24, searches7d, clicks24, clicks7d, auth24, admin24, automation24, deliveries24, payments24, searchRowsResult, authRowsResult, automationRowsResult, deliveryRowsResult, paymentRowsResult, adminsResult, postureResult] = await Promise.all([
    countRows('sc_searches', 'created_at', since24),
    countRows('sc_searches', 'created_at', since7d),
    countRows('sc_click_events', 'created_at', since24),
    countRows('sc_click_events', 'created_at', since7d),
    countRows('sama_auth_events', 'created_at', since24),
    countRows('sama_admin_audit', 'created_at', since24),
    countRows('sowhat_automation_events', 'created_at', since24),
    countRows('liv_delivery_events', 'created_at', since24),
    countRows('liv_payment_events', 'created_at', since24),
    db.from('sc_searches').select('created_at,result_count,source_count,response_ms,language_mode').gte('created_at', since7d).order('created_at', {
      ascending: false
    }).limit(1500),
    db.from('sama_auth_events').select('event_type,created_at').gte('created_at', since7d).order('created_at', {
      ascending: false
    }).limit(1500),
    db.from('sowhat_automation_events').select('workflow_name,event_type,status,created_at').gte('created_at', since7d).order('created_at', {
      ascending: false
    }).limit(1500),
    db.from('liv_delivery_events').select('event_type,status_to,created_at').gte('created_at', since7d).order('created_at', {
      ascending: false
    }).limit(1500),
    db.from('liv_payment_events').select('method,status,created_at').gte('created_at', since7d).order('created_at', {
      ascending: false
    }).limit(1500),
    db.from('security_console_admins').select('user_id', {
      count: 'exact'
    }).eq('active', true),
    db.rpc('security_control_posture')
  ]);
  const searchRows = searchRowsResult.data || [];
  const authRows = authRowsResult.data || [];
  const automationRows = automationRowsResult.data || [];
  const deliveryRows = deliveryRowsResult.data || [];
  const paymentRows = paymentRowsResult.data || [];
  const avgResponse = searchRows.length ? Math.round(searchRows.reduce((sum, row)=>sum + Number(row.response_ms || 0), 0) / searchRows.length) : 0;
  const zeroResults = searchRows.filter((row)=>Number(row.result_count || 0) === 0).length;
  const automationFailures = automationRows.filter((row)=>![
      'ok',
      'success',
      'completed',
      'done'
    ].includes(String(row.status || '').toLowerCase())).length;
  const authFailures = authRows.filter((row)=>/(fail|block|deny|invalid|reject|error)/i.test(String(row.event_type || ''))).length;
  const paymentFailures = paymentRows.filter((row)=>/(fail|reject|cancel|error|refund)/i.test(String(row.status || ''))).length;
  return {
    generated_at_utc: nowIso(),
    traffic: {
      searches_24h: searches24,
      searches_7d: searches7d,
      clicks_24h: clicks24,
      clicks_7d: clicks7d,
      average_search_response_ms_7d: avgResponse,
      zero_result_rate_7d: searchRows.length ? Math.round(zeroResults / searchRows.length * 1000) / 10 : 0,
      auth_events_24h: auth24,
      admin_actions_24h: admin24,
      automation_events_24h: automation24,
      delivery_events_24h: deliveries24,
      payment_events_24h: payments24
    },
    risk_signals: {
      auth_failures_7d: authFailures,
      automation_failures_7d: automationFailures,
      payment_failures_7d: paymentFailures,
      public_edge_functions: 37,
      jwt_protected_edge_functions: 40,
      total_edge_functions: 77
    },
    distributions: {
      auth_event_types: topEntries(countBy(authRows, 'event_type')),
      automation_workflows: topEntries(countBy(automationRows, 'workflow_name')),
      automation_statuses: topEntries(countBy(automationRows, 'status')),
      delivery_statuses: topEntries(countBy(deliveryRows, 'status_to')),
      payment_statuses: topEntries(countBy(paymentRows, 'status')),
      payment_methods: topEntries(countBy(paymentRows, 'method')),
      search_languages: topEntries(countBy(searchRows, 'language_mode'))
    },
    control_plane: postureResult.data || {},
    authorized_console_users: Number(adminsResult.count || 0),
    privacy: {
      pii_included: false,
      raw_queries_included: false,
      customer_records_included: false,
      payment_references_included: false,
      secrets_included: false
    }
  };
}
function operationalChecks(metrics) {
  const risk = metrics.risk_signals || {};
  const traffic = metrics.traffic || {};
  const authFailures = Number(risk.auth_failures_7d || 0);
  const automationFailures = Number(risk.automation_failures_7d || 0);
  const paymentFailures = Number(risk.payment_failures_7d || 0);
  const zeroRate = Number(traffic.zero_result_rate_7d || 0);
  return [
    {
      control: 'Détection comportementale',
      name: 'Échecs d’authentification',
      severity: 'high',
      ok: authFailures <= 20,
      detail: `${authFailures} échec(s) sur 7 jours`,
      observed: authFailures,
      expected: '≤ 20'
    },
    {
      control: 'Détection comportementale',
      name: 'Anomalies d’automatisation',
      severity: 'high',
      ok: automationFailures <= 10,
      detail: `${automationFailures} anomalie(s) sur 7 jours`,
      observed: automationFailures,
      expected: '≤ 10'
    },
    {
      control: 'Détection comportementale',
      name: 'Anomalies de paiement',
      severity: 'warning',
      ok: paymentFailures <= 5,
      detail: `${paymentFailures} signal(aux) sur 7 jours`,
      observed: paymentFailures,
      expected: '≤ 5'
    },
    {
      control: 'Qualité SeneCompare',
      name: 'Taux de recherche sans résultat',
      severity: 'warning',
      ok: zeroRate <= 35,
      detail: `${zeroRate.toFixed(1)}% sur 7 jours`,
      observed: zeroRate,
      expected: '≤ 35%'
    }
  ];
}
async function updateAlerts(snapshotId, checks) {
  const failed = checks.filter((check)=>!check.ok);
  const active = [];
  for (const check of failed){
    const fingerprint = await sha256Hex(`${check.control}|${check.name}|${check.severity}`);
    active.push(fingerprint);
    const { data: existing } = await db.from('security_control_alerts').select('id,occurrences').eq('fingerprint', fingerprint).maybeSingle();
    const values = {
      severity: check.severity,
      component: check.control,
      title: check.name,
      detail: check.detail.slice(0, 1000),
      status: 'open',
      last_seen_at: nowIso(),
      resolved_at: null,
      last_snapshot_id: snapshotId
    };
    if (existing?.id) await db.from('security_control_alerts').update({
      ...values,
      occurrences: Number(existing.occurrences || 0) + 1
    }).eq('id', existing.id);
    else await db.from('security_control_alerts').insert({
      fingerprint,
      ...values
    });
  }
  if (active.length) await db.from('security_control_alerts').update({
    status: 'resolved',
    resolved_at: nowIso()
  }).eq('status', 'open').not('fingerprint', 'in', `(${active.join(',')})`);
  else await db.from('security_control_alerts').update({
    status: 'resolved',
    resolved_at: nowIso()
  }).eq('status', 'open');
}
async function collectSnapshot(source, minIntervalSeconds = 300) {
  const { data: locked, error: lockError } = await db.rpc('security_control_try_lock', {
    p_interval_seconds: Math.max(60, Math.min(3600, minIntervalSeconds))
  });
  if (lockError) throw new Error('COLLECTOR_LOCK_ERROR');
  if (locked !== true) {
    const { data: latest } = await db.from('security_control_snapshots').select('*').order('generated_at', {
      ascending: false
    }).limit(1).maybeSingle();
    return {
      collected: false,
      snapshot: latest
    };
  }
  try {
    const [baseChecks, metrics] = await Promise.all([
      collectChecks(),
      collectMetrics()
    ]);
    const checks = [
      ...baseChecks,
      ...operationalChecks(metrics)
    ];
    const failed = checks.filter((check)=>!check.ok);
    const actionable = failed.filter((check)=>SEVERITY_RANK[check.severity] >= SEVERITY_RANK.high);
    const status = actionable.length ? 'ALERT' : failed.length ? 'WARNING' : 'HEALTHY';
    const weightedTotal = checks.reduce((sum, check)=>sum + SEVERITY_RANK[check.severity] + 1, 0);
    const weightedPassed = checks.filter((check)=>check.ok).reduce((sum, check)=>sum + SEVERITY_RANK[check.severity] + 1, 0);
    metrics.posture = {
      weighted_score: Math.round(weightedPassed / Math.max(1, weightedTotal) * 100),
      failed_by_severity: {
        critical: failed.filter((c)=>c.severity === 'critical').length,
        high: failed.filter((c)=>c.severity === 'high').length,
        warning: failed.filter((c)=>c.severity === 'warning').length,
        info: failed.filter((c)=>c.severity === 'info').length
      }
    };
    const signature = (await sha256Hex(checks.map((check)=>`${check.control}|${check.name}|${check.ok}|${check.observed ?? ''}`).sort().join('\n'))).slice(0, 40);
    const payload = {
      generated_at: nowIso(),
      source: source.slice(0, 80),
      status,
      signature,
      total_checks: checks.length,
      passed: checks.filter((check)=>check.ok).length,
      failed: failed.length,
      actionable_failed: actionable.length,
      checks,
      metrics
    };
    const { data: snapshot, error } = await db.from('security_control_snapshots').insert(payload).select('*').single();
    if (error || !snapshot) throw new Error('SNAPSHOT_INSERT_FAILED');
    await updateAlerts(Number(snapshot.id), checks);
    await db.rpc('security_control_finish_lock', {
      p_status: status,
      p_signature: signature
    });
    return {
      collected: true,
      snapshot
    };
  } catch (error) {
    await db.rpc('security_control_finish_lock', {
      p_status: 'ERROR',
      p_signature: ''
    });
    throw error;
  }
}
async function dashboardPayload(admin) {
  const [latestResult, historyResult, openAlertsResult, resolvedAlertsResult] = await Promise.all([
    db.from('security_control_snapshots').select('*').order('generated_at', {
      ascending: false
    }).limit(1).maybeSingle(),
    db.from('security_control_snapshots').select('id,generated_at,status,signature,total_checks,passed,failed,actionable_failed').order('generated_at', {
      ascending: false
    }).limit(672),
    db.from('security_control_alerts').select('id,severity,component,title,detail,status,first_seen_at,last_seen_at,occurrences').eq('status', 'open').order('last_seen_at', {
      ascending: false
    }).limit(80),
    db.from('security_control_alerts').select('id,severity,component,title,status,last_seen_at,resolved_at,occurrences').eq('status', 'resolved').order('resolved_at', {
      ascending: false
    }).limit(60)
  ]);
  return {
    ok: true,
    version: VERSION,
    generated_at_utc: nowIso(),
    user: {
      email: admin.user.email || null,
      role: admin.role
    },
    baseline: {
      control_domains: 14,
      edge_functions: 77,
      public_without_jwt: 37,
      jwt_protected: 40
    },
    latest: latestResult.data || null,
    history: historyResult.data || [],
    alerts: {
      open: openAlertsResult.data || [],
      resolved_recent: resolvedAlertsResult.data || []
    }
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, {
      status: 403,
      headers: responseHeaders(req)
    });
    return new Response(null, {
      status: 204,
      headers: responseHeaders(req)
    });
  }
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop() || 'health';
  try {
    if (req.method === 'GET' && (route === 'health' || route === 'security-control-api')) return json(req, {
      ok: true,
      service: 'SOWHAT Security Control API',
      version: VERSION,
      authentication: 'jwt+allowlist',
      scheduler_auth: true,
      privacy: 'aggregated-only',
      timestamp: nowIso()
    });
    if (req.method === 'POST' && route === 'collect') {
      await requireCollector(req);
      const result = await collectSnapshot('scheduled-private-collector', 600);
      return json(req, {
        ok: true,
        collected: result.collected,
        status: result.snapshot?.status || null,
        generated_at: result.snapshot?.generated_at || null
      }, result.collected ? 201 : 202);
    }
    if (req.method === 'GET' && route === 'dashboard') {
      const admin = await requireAdmin(req);
      let payload = await dashboardPayload(admin);
      const age = payload.latest?.generated_at ? Date.now() - new Date(payload.latest.generated_at).getTime() : Number.POSITIVE_INFINITY;
      if (!payload.latest || age > 30 * 60_000) {
        await collectSnapshot(`login:${admin.user.id}`, 600);
        payload = await dashboardPayload(admin);
      }
      return json(req, payload);
    }
    if (req.method === 'POST' && route === 'refresh') {
      const admin = await requireAdmin(req);
      await collectSnapshot(`manual:${admin.user.id}`, 60);
      return json(req, await dashboardPayload(admin));
    }
    if (![
      'GET',
      'POST'
    ].includes(req.method)) return errorResponse(req, 405, 'METHOD_NOT_ALLOWED');
    return errorResponse(req, 404, 'NOT_FOUND');
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || 'INTERNAL_ERROR');
    console.error(JSON.stringify({
      event: 'security_control_error',
      code,
      status
    }));
    if ([
      400,
      401,
      403,
      405,
      413,
      429
    ].includes(status)) return errorResponse(req, status, code);
    return errorResponse(req, 500, 'INTERNAL_ERROR');
  }
});
