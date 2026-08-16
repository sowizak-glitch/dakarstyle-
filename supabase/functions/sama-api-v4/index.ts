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
const PLAN_PRICE_XOF = 4000;
const LEGACY_API = `${SUPABASE_URL}/functions/v1/sama-api`;
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
      "x-content-type-options": "nosniff"
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
async function sha256(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function accessInfo(account) {
  const now = Date.now();
  const role = account.role || "merchant";
  const trialEnd = account.trial_ends_at ? new Date(account.trial_ends_at).getTime() : 0;
  const paidEnd = account.subscription_paid_until ? new Date(account.subscription_paid_until).getTime() : 0;
  const suspended = Boolean(account.suspended_at) || account.subscription_status === "suspended";
  const trialActive = trialEnd > now;
  const paidActive = paidEnd > now && account.subscription_status === "active";
  return {
    role,
    status: account.subscription_status || "trialing",
    plan: account.subscription_plan || "essential",
    amount_xof: Number(account.subscription_amount_xof || PLAN_PRICE_XOF),
    trial_started_at: account.trial_started_at,
    trial_ends_at: account.trial_ends_at,
    subscription_paid_until: account.subscription_paid_until,
    trial_active: trialActive,
    paid_active: paidActive,
    suspended,
    can_write: role === "admin" || !suspended && (trialActive || paidActive)
  };
}
function publicAccount(account) {
  return {
    id: account.id,
    identifier_type: account.identifier_type,
    display_identifier: account.display_identifier,
    is_active: account.is_active,
    role: account.role || "merchant",
    access: accessInfo(account)
  };
}
async function accountById(id) {
  const q = await db.from("sama_accounts").select("id, identifier_type, display_identifier, is_active, role, trial_started_at, trial_ends_at, subscription_status, subscription_plan, subscription_amount_xof, subscription_paid_until, last_seen_at, suspended_at, suspension_reason").eq("id", id).maybeSingle();
  if (q.error) throw q.error;
  return q.data;
}
async function sessionContext(req, requireWrite = false) {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sessionQ = await db.from("sama_sessions").select("id, account_id, expires_at, revoked_at, last_seen_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401);
  const account = await accountById(session.account_id);
  if (!account?.is_active) fail("Ce compte est désactivé.", 403);
  const merchantQ = await db.from("sama_merchants").select("id, name, business_type, phone, country_code, currency, locale, timezone").eq("account_id", account.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  const access = accessInfo(account);
  if (requireWrite && !access.can_write) fail(access.suspended ? "Ce compte est suspendu. Contactez l’assistance." : "Votre mois gratuit ou votre abonnement est terminé. Renouvelez pour continuer.", 402);
  if (Date.now() - new Date(session.last_seen_at).getTime() > 30 * 60_000) {
    const now = new Date().toISOString();
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
    sessionId: session.id,
    account,
    merchant: merchantQ.data,
    access
  };
}
function assertAdmin(ctx) {
  if ((ctx.account.role || "merchant") !== "admin") fail("Accès administrateur requis.", 403);
}
async function legacy(req, body) {
  const headers = {
    "content-type": "application/json"
  };
  const apiKey = req.headers.get("apikey");
  const session = req.headers.get("x-sama-session");
  const clientInfo = req.headers.get("x-client-info");
  if (apiKey) headers.apikey = apiKey;
  if (session) headers["x-sama-session"] = session;
  if (clientInfo) headers["x-client-info"] = clientInfo;
  const res = await fetch(LEGACY_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  return {
    status: res.status,
    data,
    headers: res.headers
  };
}
async function proxyLegacy(req, body, requireWrite = false) {
  if (requireWrite) await sessionContext(req, true);
  const old = await legacy(req, body);
  return response(req, old.data, old.status);
}
async function handleAuthProxy(req, body) {
  const old = await legacy(req, body);
  if (!old.data?.ok || !old.data?.account?.id) return response(req, old.data, old.status);
  const account = await accountById(old.data.account.id);
  return response(req, {
    ...old.data,
    account: publicAccount(account),
    access: accessInfo(account)
  }, old.status);
}
async function handleBootstrap(req) {
  const ctx = await sessionContext(req, false);
  const [salesQ, paymentsQ] = await Promise.all([
    db.from("sama_sales").select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at").eq("merchant_id", ctx.merchant.id).is("deleted_at", null).order("happened_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_subscription_payments").select("id, amount, currency, method, transaction_ref, status, requested_months, submitted_at, reviewed_at, review_note").eq("account_id", ctx.account.id).order("submitted_at", {
      ascending: false
    }).limit(10)
  ]);
  if (salesQ.error) throw salesQ.error;
  if (paymentsQ.error) throw paymentsQ.error;
  return response(req, {
    ok: true,
    account: publicAccount(ctx.account),
    merchant: ctx.merchant,
    access: ctx.access,
    subscriptionPayments: paymentsQ.data ?? [],
    sales: salesQ.data ?? []
  });
}
async function handleDelete(req, body, restore = false) {
  const ctx = await sessionContext(req, false);
  const saleId = String(body.saleId || "");
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) fail("Vente invalide.");
  const patch = restore ? {
    deleted_at: null,
    deleted_reason: null,
    deleted_by_account_id: null,
    updated_at: new Date().toISOString()
  } : {
    deleted_at: new Date().toISOString(),
    deleted_reason: String(body.reason || "Supprimée par l’utilisateur").slice(0, 300),
    deleted_by_account_id: ctx.account.id,
    updated_at: new Date().toISOString()
  };
  let q = db.from("sama_sales").update(patch).eq("id", saleId).eq("merchant_id", ctx.merchant.id);
  if (!restore) q = q.is("deleted_at", null);
  const done = await q.select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at").maybeSingle();
  if (done.error) throw done.error;
  if (!done.data) fail("Vente introuvable.", 404);
  return response(req, restore ? {
    ok: true,
    sale: done.data
  } : {
    ok: true,
    deletedId: done.data.id
  });
}
async function handleSubmitSubscription(req, body) {
  const ctx = await sessionContext(req, false);
  const method = [
    "wave",
    "orange_money",
    "cash",
    "bank",
    "other"
  ].includes(body.method) ? body.method : "wave";
  const months = Math.max(1, Math.min(24, Math.round(Number(body.months || 1))));
  const annualBlocks = Math.floor(months / 12);
  const expected = annualBlocks * 40_000 + months % 12 * PLAN_PRICE_XOF;
  const amount = Math.round(Number(body.amount || expected));
  const transactionRef = String(body.transactionRef || "").trim().slice(0, 120) || null;
  if (!Number.isFinite(amount) || amount < expected) fail("Montant d’abonnement invalide.");
  if ([
    "wave",
    "orange_money",
    "bank"
  ].includes(method) && !transactionRef) fail("Ajoutez la référence de la transaction.");
  const q = await db.from("sama_subscription_payments").insert({
    account_id: ctx.account.id,
    merchant_id: ctx.merchant.id,
    amount,
    method,
    transaction_ref: transactionRef,
    requested_months: months,
    status: "pending"
  }).select("id, amount, currency, method, transaction_ref, status, requested_months, submitted_at").single();
  if (q.error) {
    if (q.error.code === "23505") fail("Cette référence de paiement a déjà été enregistrée.", 409);
    throw q.error;
  }
  return response(req, {
    ok: true,
    payment: q.data,
    message: "Paiement envoyé pour validation."
  });
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
async function handleAdminDashboard(req) {
  const ctx = await sessionContext(req, false);
  assertAdmin(ctx);
  const [accountsQ, merchantsQ, salesQ, paymentsQ] = await Promise.all([
    db.from("sama_accounts").select("id, display_identifier, identifier_type, is_active, role, created_at, last_login_at, last_seen_at, trial_started_at, trial_ends_at, subscription_status, subscription_plan, subscription_amount_xof, subscription_paid_until, suspended_at, suspension_reason").order("created_at", {
      ascending: false
    }).limit(500),
    db.from("sama_merchants").select("id, account_id, name, phone, business_type, created_at"),
    db.from("sama_sales").select("id, merchant_id, total_amount, paid_amount, deleted_at"),
    db.from("sama_subscription_payments").select("id, account_id, merchant_id, amount, currency, method, transaction_ref, status, requested_months, submitted_at, reviewed_at, review_note").order("submitted_at", {
      ascending: false
    }).limit(500)
  ]);
  for (const q of [
    accountsQ,
    merchantsQ,
    salesQ,
    paymentsQ
  ])if (q.error) throw q.error;
  const merchants = new Map((merchantsQ.data ?? []).map((m)=>[
      m.account_id,
      m
    ]));
  const stats = new Map();
  for (const sale of salesQ.data ?? []){
    if (sale.deleted_at) continue;
    const s = stats.get(sale.merchant_id) || {
      count: 0,
      total: 0,
      paid: 0
    };
    s.count += 1;
    s.total += Number(sale.total_amount || 0);
    s.paid += Number(sale.paid_amount || 0);
    stats.set(sale.merchant_id, s);
  }
  const users = (accountsQ.data ?? []).map((a)=>{
    const merchant = merchants.get(a.id) || null;
    return {
      ...a,
      access: accessInfo(a),
      merchant,
      stats: merchant ? stats.get(merchant.id) || {
        count: 0,
        total: 0,
        paid: 0
      } : {
        count: 0,
        total: 0,
        paid: 0
      }
    };
  });
  const payments = paymentsQ.data ?? [];
  return response(req, {
    ok: true,
    metrics: {
      users: users.length,
      activeUsers: users.filter((u)=>u.access.can_write).length,
      pendingPayments: payments.filter((p)=>p.status === "pending").length,
      sales: (salesQ.data ?? []).filter((s)=>!s.deleted_at).length
    },
    users,
    payments
  });
}
async function handleAdminAccount(req, body) {
  const ctx = await sessionContext(req, false);
  assertAdmin(ctx);
  const targetId = String(body.targetAccountId || "");
  const operation = String(body.operation || "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) fail("Compte cible invalide.");
  if (targetId === ctx.account.id && [
    "suspend",
    "deactivate"
  ].includes(operation)) fail("Vous ne pouvez pas bloquer votre propre compte administrateur.");
  const now = new Date();
  let patch = {
    updated_at: now.toISOString()
  };
  if (operation === "extend_trial") {
    const days = Math.max(1, Math.min(365, Math.round(Number(body.days || 30))));
    const q = await db.from("sama_accounts").select("trial_ends_at").eq("id", targetId).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) fail("Compte introuvable.", 404);
    const base = Math.max(now.getTime(), new Date(q.data.trial_ends_at || now).getTime());
    patch = {
      ...patch,
      trial_ends_at: new Date(base + days * 86400000).toISOString(),
      subscription_status: "trialing",
      suspended_at: null,
      suspension_reason: null,
      is_active: true
    };
  } else if (operation === "activate") {
    const months = Math.max(1, Math.min(24, Math.round(Number(body.months || 1))));
    const q = await db.from("sama_accounts").select("subscription_paid_until").eq("id", targetId).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) fail("Compte introuvable.", 404);
    const paidUntil = new Date(Math.max(now.getTime(), new Date(q.data.subscription_paid_until || now).getTime()));
    paidUntil.setUTCMonth(paidUntil.getUTCMonth() + months);
    patch = {
      ...patch,
      subscription_status: "active",
      subscription_paid_until: paidUntil.toISOString(),
      suspended_at: null,
      suspension_reason: null,
      is_active: true
    };
  } else if (operation === "suspend") patch = {
    ...patch,
    subscription_status: "suspended",
    suspended_at: now.toISOString(),
    suspension_reason: String(body.reason || "Suspendu par l’administrateur").slice(0, 300)
  };
  else if (operation === "unsuspend") patch = {
    ...patch,
    subscription_status: "trialing",
    suspended_at: null,
    suspension_reason: null,
    is_active: true
  };
  else if (operation === "deactivate") patch = {
    ...patch,
    is_active: false,
    suspended_at: now.toISOString(),
    suspension_reason: String(body.reason || "Compte désactivé").slice(0, 300)
  };
  else if (operation === "reactivate") patch = {
    ...patch,
    is_active: true,
    suspended_at: null,
    suspension_reason: null
  };
  else if (operation === "revoke_sessions") {
    const q = await db.from("sama_sessions").update({
      revoked_at: now.toISOString()
    }).eq("account_id", targetId).is("revoked_at", null);
    if (q.error) throw q.error;
    await audit(ctx.account.id, targetId, operation);
    return response(req, {
      ok: true
    });
  } else fail("Opération administrateur inconnue.");
  const q = await db.from("sama_accounts").update(patch).eq("id", targetId).select("id, display_identifier, is_active, role, trial_ends_at, subscription_status, subscription_paid_until, suspended_at, suspension_reason").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Compte introuvable.", 404);
  await audit(ctx.account.id, targetId, operation, {
    days: body.days ?? null,
    months: body.months ?? null
  });
  return response(req, {
    ok: true,
    account: {
      ...q.data,
      access: accessInfo(q.data)
    }
  });
}
async function handleAdminReview(req, body) {
  const ctx = await sessionContext(req, false);
  assertAdmin(ctx);
  const paymentId = String(body.paymentId || "");
  const decision = String(body.decision || "");
  if (!/^[0-9a-f-]{36}$/i.test(paymentId) || ![
    "approved",
    "rejected"
  ].includes(decision)) fail("Décision de paiement invalide.");
  const pq = await db.from("sama_subscription_payments").select("id, account_id, amount, requested_months, status").eq("id", paymentId).maybeSingle();
  if (pq.error) throw pq.error;
  if (!pq.data) fail("Paiement introuvable.", 404);
  if (pq.data.status !== "pending") fail("Ce paiement a déjà été traité.", 409);
  const now = new Date();
  if (decision === "approved") {
    const aq = await db.from("sama_accounts").select("subscription_paid_until").eq("id", pq.data.account_id).maybeSingle();
    if (aq.error) throw aq.error;
    const paidUntil = new Date(Math.max(now.getTime(), new Date(aq.data?.subscription_paid_until || now).getTime()));
    paidUntil.setUTCMonth(paidUntil.getUTCMonth() + Number(pq.data.requested_months || 1));
    const up = await db.from("sama_accounts").update({
      subscription_status: "active",
      subscription_paid_until: paidUntil.toISOString(),
      suspended_at: null,
      suspension_reason: null,
      is_active: true,
      updated_at: now.toISOString()
    }).eq("id", pq.data.account_id);
    if (up.error) throw up.error;
  }
  const reviewed = await db.from("sama_subscription_payments").update({
    status: decision,
    reviewed_at: now.toISOString(),
    reviewed_by_account_id: ctx.account.id,
    review_note: String(body.note || "").slice(0, 500) || null,
    updated_at: now.toISOString()
  }).eq("id", paymentId).select("id, account_id, amount, status, requested_months, reviewed_at, review_note").single();
  if (reviewed.error) throw reviewed.error;
  await audit(ctx.account.id, pq.data.account_id, `payment_${decision}`, {
    paymentId,
    amount: pq.data.amount
  });
  return response(req, {
    ok: true,
    payment: reviewed.data
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
      service: "sama-api-v4",
      version: "4.1.0",
      plan_price_xof: PLAN_PRICE_XOF,
      trial_days: 30
    });
    if (req.method !== "POST") fail("Méthode non autorisée.", 405);
    if (!(req.headers.get("content-type") || "").includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    const action = String(body?.action || "");
    if ([
      "register",
      "login"
    ].includes(action)) return await handleAuthProxy(req, body);
    if (action === "bootstrap") return await handleBootstrap(req);
    if ([
      "sync_sales",
      "create_sale",
      "payment"
    ].includes(action)) return await proxyLegacy(req, body, true);
    if (action === "logout") return await proxyLegacy(req, body, false);
    if (action === "delete_sale") return await handleDelete(req, body, false);
    if (action === "restore_sale") return await handleDelete(req, body, true);
    if (action === "submit_subscription_payment") return await handleSubmitSubscription(req, body);
    if (action === "admin_dashboard") return await handleAdminDashboard(req);
    if (action === "admin_account") return await handleAdminAccount(req, body);
    if (action === "admin_review_payment") return await handleAdminReview(req, body);
    fail("Action inconnue.", 404);
  } catch (unknownError) {
    const error = unknownError;
    console.error("sama-api-v4", {
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
