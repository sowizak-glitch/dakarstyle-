import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const secretBundle = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = secretBundle ? JSON.parse(secretBundle)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const PIN_ITERATIONS = 600_000;
const RECOVERY_MINUTES = 15;
const allowedExactOrigins = new Set([
  "https://sama-cahier-ia.vercel.app",
  "https://sama-cahier-ia-eminix-s-projects.vercel.app",
  "https://sama-cahier-ia-idrissaminata-8568-eminix-s-projects.vercel.app"
]);
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedExactOrigins.has(origin)) return true;
  return /^https:\/\/sama-cahier-[a-z0-9-]+-eminix-s-projects\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && isAllowedOrigin(origin) ? origin : "https://sama-cahier-ia.vercel.app";
  return {
    "Access-Control-Allow-Origin": safe,
    "Access-Control-Allow-Headers": "content-type, apikey, x-sama-session, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function response(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req.headers.get("origin")),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "cross-origin"
    }
  });
}
function fail(message, status = 400, retryAfter) {
  const error = new Error(message);
  error.status = status;
  error.retryAfter = retryAfter;
  throw error;
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes)s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i += 1)bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function sha256(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
async function hashPin(pin) {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: PIN_ITERATIONS
  }, key, 256);
  return `pbkdf2-sha256$${PIN_ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}
function validatePin(raw) {
  const pin = String(raw ?? "").trim();
  if (!/^\d{6,10}$/.test(pin)) fail("Le nouveau PIN doit contenir entre 6 et 10 chiffres.");
  const weak = new Set([
    "000000",
    "111111",
    "222222",
    "333333",
    "444444",
    "555555",
    "666666",
    "777777",
    "888888",
    "999999",
    "123456",
    "654321",
    "12345678",
    "87654321"
  ]);
  if (weak.has(pin) || /^(\d)\1+$/.test(pin)) fail("Choisissez un PIN moins facile à deviner.");
  return pin;
}
function normalizeIdentifier(type, raw) {
  const kind = String(type ?? "").toLowerCase();
  const value = String(raw ?? "").trim();
  if (kind === "email") {
    const normalized = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) || normalized.length > 180) fail("Informations de récupération invalides.", 400);
    return {
      type: "email",
      normalized
    };
  }
  if (kind === "phone") {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 9 && digits.startsWith("7")) digits = `221${digits}`;
    if (digits.length < 10 || digits.length > 15) fail("Informations de récupération invalides.", 400);
    return {
      type: "phone",
      normalized: digits
    };
  }
  fail("Informations de récupération invalides.", 400);
}
function requestIp(req) {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}
async function fingerprint(req) {
  return sha256(`${SERVICE_KEY.slice(-24)}|${requestIp(req)}`);
}
async function addAuthEvent(fp, eventType, accountId) {
  const q = await db.from("sama_auth_events").insert({
    fingerprint_hash: fp,
    event_type: eventType,
    account_id: accountId ?? null
  });
  if (q.error) throw q.error;
}
async function enforceRateLimit(fp, windowMinutes, max) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const q = await db.from("sama_auth_events").select("id", {
    count: "exact",
    head: true
  }).eq("fingerprint_hash", fp).in("event_type", [
    "recovery_attempt",
    "recovery_failure"
  ]).gte("created_at", since);
  if (q.error) throw q.error;
  if ((q.count ?? 0) >= max) fail("Trop de tentatives. Réessayez plus tard.", 429, windowMinutes * 60);
}
async function accountById(id) {
  const q = await db.from("sama_accounts").select("id, identifier_type, identifier_normalized, display_identifier, is_active, role, failed_attempts, locked_until, admin_notes").eq("id", id).maybeSingle();
  if (q.error) throw q.error;
  return q.data;
}
async function sessionContext(req) {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sq = await db.from("sama_sessions").select("id, account_id, expires_at, revoked_at, last_seen_at").eq("token_hash", tokenHash).maybeSingle();
  if (sq.error) throw sq.error;
  const session = sq.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401);
  const account = await accountById(session.account_id);
  if (!account?.is_active) fail("Ce compte est désactivé.", 403);
  const mq = await db.from("sama_merchants").select("id, account_id, name, phone").eq("account_id", account.id).maybeSingle();
  if (mq.error) throw mq.error;
  if (!mq.data) fail("Commerce introuvable.", 404);
  const now = new Date().toISOString();
  if (!session.last_seen_at || Date.now() - new Date(session.last_seen_at).getTime() > 30 * 60_000) {
    await Promise.all([
      db.from("sama_sessions").update({
        last_seen_at: now
      }).eq("id", session.id),
      db.from("sama_accounts").update({
        last_seen_at: now,
        updated_at: now
      }).eq("id", account.id)
    ]);
  }
  return {
    account,
    merchant: mq.data,
    sessionId: session.id
  };
}
function assertAdmin(ctx) {
  if ((ctx.account.role || "merchant") !== "admin") fail("Accès administrateur requis.", 403);
}
function uuid(value) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) fail("Référence invalide.");
  return text;
}
function clean(value, max) {
  const text = String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
  return text || null;
}
async function audit(adminId, targetId, action, metadata = {}) {
  const q = await db.from("sama_admin_audit").insert({
    admin_account_id: adminId,
    target_account_id: targetId,
    action,
    metadata
  });
  if (q.error) throw q.error;
}
async function handleHeartbeat(req, body) {
  const ctx = await sessionContext(req);
  const deviceId = uuid(body.deviceId);
  const now = new Date().toISOString();
  const row = {
    account_id: ctx.account.id,
    merchant_id: ctx.merchant.id,
    device_id: deviceId,
    app_version: clean(body.appVersion, 40) || "unknown",
    user_agent: clean(body.userAgent, 320),
    platform: clean(body.platform, 80),
    viewport: clean(body.viewport, 40),
    display_mode: clean(body.displayMode, 40),
    storage_mode: clean(body.storageMode, 40),
    online: Boolean(body.online),
    installed: Boolean(body.installed),
    pending_sales: Math.max(0, Math.min(100000, Math.round(Number(body.pendingSales || 0)))),
    pending_ops: Math.max(0, Math.min(100000, Math.round(Number(body.pendingOps || 0)))),
    sync_status: clean(body.syncStatus, 60),
    last_sync_at: body.lastSyncAt && !Number.isNaN(Date.parse(body.lastSyncAt)) ? new Date(body.lastSyncAt).toISOString() : null,
    last_error_code: clean(body.lastErrorCode, 80),
    last_error_context: clean(body.lastErrorContext, 240),
    last_error_at: body.lastErrorAt && !Number.isNaN(Date.parse(body.lastErrorAt)) ? new Date(body.lastErrorAt).toISOString() : null,
    last_seen_at: now,
    updated_at: now
  };
  const q = await db.from("sama_client_health").upsert(row, {
    onConflict: "account_id,device_id"
  });
  if (q.error) throw q.error;
  return response(req, {
    ok: true,
    receivedAt: now
  });
}
async function handleAdminDashboard(req) {
  const ctx = await sessionContext(req);
  assertAdmin(ctx);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [accountsQ, healthQ, authQ, auditQ, recoveryQ] = await Promise.all([
    db.from("sama_accounts").select("id, display_identifier, failed_attempts, locked_until, admin_notes").order("created_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_client_health").select("account_id,device_id,app_version,user_agent,platform,viewport,display_mode,storage_mode,online,installed,pending_sales,pending_ops,sync_status,last_sync_at,last_error_code,last_error_context,last_error_at,last_seen_at").order("last_seen_at", {
      ascending: false
    }).limit(3000),
    db.from("sama_auth_events").select("id,account_id,event_type,created_at").gte("created_at", since).order("created_at", {
      ascending: false
    }).limit(300),
    db.from("sama_admin_audit").select("id,admin_account_id,target_account_id,action,metadata,created_at").order("created_at", {
      ascending: false
    }).limit(300),
    db.from("sama_access_recovery").select("id,account_id,attempts,expires_at,used_at,revoked_at,created_by_admin_id,created_at").is("used_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", {
      ascending: false
    }).limit(100)
  ]);
  for (const q of [
    accountsQ,
    healthQ,
    authQ,
    auditQ,
    recoveryQ
  ])if (q.error) throw q.error;
  const accounts = accountsQ.data ?? [];
  const health = healthQ.data ?? [];
  const latest = new Map();
  for (const h of health)if (!latest.has(h.account_id)) latest.set(h.account_id, h);
  const users = accounts.map((a)=>({
      ...a,
      health: latest.get(a.id) || null,
      active_recovery: (recoveryQ.data ?? []).find((r)=>r.account_id === a.id) || null
    }));
  const metrics = {
    locked: users.filter((u)=>u.locked_until && new Date(u.locked_until).getTime() > Date.now()).length,
    syncAttention: health.filter((h)=>Number(h.pending_ops || 0) > 0 || Number(h.pending_sales || 0) > 0 || h.last_error_at).length,
    outdated: health.filter((h)=>h.app_version && h.app_version !== "8.2.0").length,
    recoveryActive: (recoveryQ.data ?? []).length,
    loginFailures30d: (authQ.data ?? []).filter((e)=>e.event_type === "login_failure").length
  };
  return response(req, {
    ok: true,
    metrics,
    users,
    health,
    authEvents: authQ.data ?? [],
    auditEvents: auditQ.data ?? [],
    recoveries: recoveryQ.data ?? []
  });
}
async function handleAdminUnlock(req, body) {
  const ctx = await sessionContext(req);
  assertAdmin(ctx);
  const targetId = uuid(body.targetAccountId);
  const q = await db.from("sama_accounts").update({
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString()
  }).eq("id", targetId).select("id,failed_attempts,locked_until").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Compte introuvable.", 404);
  await Promise.all([
    audit(ctx.account.id, targetId, "unlock_access"),
    addAuthEvent(await fingerprint(req), "admin_unlock", targetId)
  ]);
  return response(req, {
    ok: true,
    account: q.data
  });
}
async function handleAdminGenerateRecovery(req, body) {
  const ctx = await sessionContext(req);
  assertAdmin(ctx);
  const targetId = uuid(body.targetAccountId);
  const account = await accountById(targetId);
  if (!account) fail("Compte introuvable.", 404);
  if (account.role === "admin" && targetId !== ctx.account.id) fail("La récupération d’un autre administrateur est bloquée.", 403);
  const bytes = randomBytes(4);
  const number = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  const code = String(number % 100000000).padStart(8, "0");
  const codeHash = await sha256(`${SERVICE_KEY.slice(-32)}|${targetId}|${code}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RECOVERY_MINUTES * 60_000).toISOString();
  await db.from("sama_access_recovery").update({
    revoked_at: now.toISOString()
  }).eq("account_id", targetId).is("used_at", null).is("revoked_at", null);
  const q = await db.from("sama_access_recovery").insert({
    account_id: targetId,
    code_hash: codeHash,
    expires_at: expiresAt,
    created_by_admin_id: ctx.account.id,
    note: clean(body.note, 300)
  }).select("id,expires_at").single();
  if (q.error) throw q.error;
  await audit(ctx.account.id, targetId, "generate_recovery_code", {
    recovery_id: q.data.id,
    expires_at: expiresAt
  });
  return response(req, {
    ok: true,
    recoveryCode: code,
    expiresAt,
    minutes: RECOVERY_MINUTES
  });
}
async function handleAdminNote(req, body) {
  const ctx = await sessionContext(req);
  assertAdmin(ctx);
  const targetId = uuid(body.targetAccountId);
  const note = clean(body.note, 1000);
  const q = await db.from("sama_accounts").update({
    admin_notes: note,
    updated_at: new Date().toISOString()
  }).eq("id", targetId).select("id,admin_notes").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Compte introuvable.", 404);
  await audit(ctx.account.id, targetId, "update_admin_note", {
    has_note: Boolean(note)
  });
  return response(req, {
    ok: true,
    account: q.data
  });
}
async function handleRecoverAccess(req, body) {
  const fp = await fingerprint(req);
  await enforceRateLimit(fp, 15, 15);
  await addAuthEvent(fp, "recovery_attempt");
  const identifier = normalizeIdentifier(body.identifierType, body.identifier);
  const code = String(body.recoveryCode ?? "").replace(/\D/g, "");
  const newPin = validatePin(body.newPin);
  if (!/^\d{8}$/.test(code)) fail("Code de récupération ou informations incorrectes.", 401);
  const aq = await db.from("sama_accounts").select("id,is_active").eq("identifier_normalized", identifier.normalized).maybeSingle();
  if (aq.error) throw aq.error;
  const account = aq.data;
  if (!account?.is_active) {
    await addAuthEvent(fp, "recovery_failure");
    fail("Code de récupération ou informations incorrectes.", 401);
  }
  const rq = await db.from("sama_access_recovery").select("id,code_hash,attempts,expires_at,used_at,revoked_at,created_by_admin_id").eq("account_id", account.id).is("used_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (rq.error) throw rq.error;
  const recovery = rq.data;
  const candidate = await sha256(`${SERVICE_KEY.slice(-32)}|${account.id}|${code}`);
  if (!recovery || recovery.code_hash !== candidate) {
    if (recovery) {
      const attempts = Number(recovery.attempts || 0) + 1;
      await db.from("sama_access_recovery").update({
        attempts,
        revoked_at: attempts >= 5 ? new Date().toISOString() : null
      }).eq("id", recovery.id);
    }
    await addAuthEvent(fp, "recovery_failure", account.id);
    fail("Code de récupération ou informations incorrectes.", 401);
  }
  const pinHash = await hashPin(newPin);
  const now = new Date().toISOString();
  const [upAccount, upRecovery, revokeSessions] = await Promise.all([
    db.from("sama_accounts").update({
      pin_hash: pinHash,
      failed_attempts: 0,
      locked_until: null,
      updated_at: now
    }).eq("id", account.id),
    db.from("sama_access_recovery").update({
      used_at: now
    }).eq("id", recovery.id),
    db.from("sama_sessions").update({
      revoked_at: now
    }).eq("account_id", account.id).is("revoked_at", null)
  ]);
  for (const q of [
    upAccount,
    upRecovery,
    revokeSessions
  ])if (q.error) throw q.error;
  await Promise.all([
    addAuthEvent(fp, "recovery_success", account.id),
    audit(recovery.created_by_admin_id, account.id, "recovery_completed", {
      recovery_id: recovery.id
    })
  ]);
  return response(req, {
    ok: true,
    message: "PIN modifié. Vous pouvez maintenant vous reconnecter."
  });
}
async function handleCleanup(req) {
  const ctx = await sessionContext(req);
  assertAdmin(ctx);
  const q = await db.rpc("sama_cleanup_security_data");
  if (q.error) throw q.error;
  await audit(ctx.account.id, null, "security_cleanup", q.data || {});
  return response(req, {
    ok: true,
    cleanup: q.data || {}
  });
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return new Response("Forbidden", {
      status: 403
    });
    return new Response("ok", {
      headers: cors(origin)
    });
  }
  if (!isAllowedOrigin(origin)) return response(req, {
    ok: false,
    error: "Origin not allowed"
  }, 403);
  try {
    if (req.method === "GET") return response(req, {
      ok: true,
      service: "sama-support-api",
      version: "1.0.0",
      recovery: true,
      telemetry: "minimal"
    });
    if (req.method !== "POST") fail("Méthode non autorisée.", 405);
    if (!(req.headers.get("content-type") || "").includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "heartbeat") return await handleHeartbeat(req, body);
    if (action === "admin_support_dashboard") return await handleAdminDashboard(req);
    if (action === "admin_unlock") return await handleAdminUnlock(req, body);
    if (action === "admin_generate_recovery") return await handleAdminGenerateRecovery(req, body);
    if (action === "admin_note") return await handleAdminNote(req, body);
    if (action === "recover_access") return await handleRecoverAccess(req, body);
    if (action === "admin_cleanup") return await handleCleanup(req);
    fail("Action inconnue.", 404);
  } catch (unknownError) {
    const error = unknownError;
    console.error("sama-support-api", {
      status: error.status || 500,
      message: error.status && error.status < 500 ? "handled" : error.message
    });
    const res = response(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez."
    }, error.status || 500);
    if (error.retryAfter) res.headers.set("retry-after", String(error.retryAfter));
    return res;
  }
});
