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
const LEGACY_API = `${SUPABASE_URL}/functions/v1/sama-api-v4`;
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
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
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
    amount_xof: Number(account.subscription_amount_xof || 4000),
    trial_started_at: account.trial_started_at,
    trial_ends_at: account.trial_ends_at,
    subscription_paid_until: account.subscription_paid_until,
    trial_active: trialActive,
    paid_active: paidActive,
    suspended,
    can_write: role === "admin" || !suspended && (trialActive || paidActive)
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
  const sessionQ = await db.from("sama_sessions").select("id, account_id, expires_at, revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401);
  const account = await accountById(session.account_id);
  if (!account?.is_active) fail("Ce compte est désactivé.", 403);
  const merchantQ = await db.from("sama_merchants").select("id, account_id, name, business_type, phone, country_code, currency, locale, timezone").eq("account_id", account.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  const access = accessInfo(account);
  if (requireWrite && !access.can_write) fail(access.suspended ? "Ce compte est suspendu. Contactez l’assistance." : "Votre mois gratuit ou votre abonnement est terminé. Renouvelez pour continuer.", 402);
  return {
    account,
    merchant: merchantQ.data,
    access
  };
}
function assertAdmin(ctx) {
  if ((ctx.account.role || "merchant") !== "admin") fail("Accès administrateur requis.", 403);
}
function uuidOrNull(value) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}
async function proxy(req, body) {
  const headers = {
    "content-type": "application/json"
  };
  for (const key of [
    "apikey",
    "x-sama-session",
    "x-client-info"
  ]){
    const value = req.headers.get(key);
    if (value) headers[key] = value;
  }
  const upstream = await fetch(LEGACY_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  let data = {};
  try {
    data = await upstream.json();
  } catch (_) {
    data = {
      ok: false,
      error: "Réponse serveur invalide."
    };
  }
  return response(req, data, upstream.status);
}
async function resolveSale(merchantId, saleId, saleClientRef) {
  let query = db.from("sama_sales").select("id, client_ref, deleted_at").eq("merchant_id", merchantId);
  if (saleId) query = query.eq("id", saleId);
  else if (saleClientRef) query = query.eq("client_ref", saleClientRef);
  else return null;
  const q = await query.maybeSingle();
  if (q.error) throw q.error;
  return q.data;
}
async function handleSyncOperations(req, body) {
  const ctx = await sessionContext(req, true);
  const operations = Array.isArray(body.operations) ? body.operations.slice(0, 200) : [];
  if (!operations.length) return response(req, {
    ok: true,
    results: [],
    failed: []
  });
  const results = [];
  const failed = [];
  for (const raw of operations){
    const opId = uuidOrNull(raw?.id);
    const type = String(raw?.type || "");
    if (!opId || ![
      "payment",
      "delete"
    ].includes(type)) {
      failed.push({
        id: raw?.id || null,
        error: "Opération invalide."
      });
      continue;
    }
    try {
      const saleId = uuidOrNull(raw.sale_id);
      const saleClientRef = uuidOrNull(raw.sale_client_ref);
      if (type === "payment") {
        const amount = Number(raw.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");
        const rpc = await db.rpc("sama_apply_offline_payment", {
          p_merchant_id: ctx.merchant.id,
          p_sale_id: saleId,
          p_sale_client_ref: saleClientRef,
          p_payment_client_ref: opId,
          p_amount: amount,
          p_method: String(raw.method || "cash"),
          p_paid_at: raw.occurred_at || new Date().toISOString()
        });
        if (rpc.error) throw rpc.error;
        results.push({
          id: opId,
          type,
          sale: Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
        });
      } else {
        const sale = await resolveSale(ctx.merchant.id, saleId, saleClientRef);
        if (!sale) throw new Error("Vente introuvable.");
        if (!sale.deleted_at) {
          const q = await db.from("sama_sales").update({
            deleted_at: raw.occurred_at || new Date().toISOString(),
            deleted_reason: String(raw.reason || "Suppression hors ligne").slice(0, 300),
            deleted_by_account_id: ctx.account.id,
            updated_at: new Date().toISOString()
          }).eq("id", sale.id).eq("merchant_id", ctx.merchant.id);
          if (q.error) throw q.error;
        }
        results.push({
          id: opId,
          type,
          deletedId: sale.id
        });
      }
    } catch (error) {
      const message = String(error?.message || "Échec de synchronisation.").replace(/invalid_offline_payment_reference/g, "Référence de paiement invalide.").replace(/invalid_payment_amount/g, "Montant invalide.").replace(/sale_not_found/g, "Vente introuvable.").replace(/payment_exceeds_remaining/g, "Le paiement dépasse le reste dû.");
      failed.push({
        id: opId,
        type,
        error: message.slice(0, 240)
      });
    }
  }
  return response(req, {
    ok: true,
    results,
    failed
  });
}
async function handleAdminDashboard(req) {
  const ctx = await sessionContext(req, false);
  assertAdmin(ctx);
  const now = Date.now();
  const activeCutoff = new Date(now - 7 * 86400000).toISOString();
  const [accountsQ, merchantsQ, salesQ, paymentsQ, sessionsQ] = await Promise.all([
    db.from("sama_accounts").select("id, display_identifier, identifier_type, is_active, role, created_at, last_login_at, last_seen_at, trial_started_at, trial_ends_at, subscription_status, subscription_plan, subscription_amount_xof, subscription_paid_until, suspended_at, suspension_reason").order("created_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_merchants").select("id, account_id, name, phone, business_type, created_at"),
    db.from("sama_sales").select("id, merchant_id, total_amount, paid_amount, remaining_amount, happened_at, deleted_at"),
    db.from("sama_subscription_payments").select("id, account_id, merchant_id, amount, currency, method, transaction_ref, status, requested_months, submitted_at, reviewed_at, review_note").order("submitted_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_sessions").select("account_id, expires_at, revoked_at, last_seen_at")
  ]);
  for (const q of [
    accountsQ,
    merchantsQ,
    salesQ,
    paymentsQ,
    sessionsQ
  ])if (q.error) throw q.error;
  const merchants = new Map((merchantsQ.data ?? []).map((m)=>[
      m.account_id,
      m
    ]));
  const merchantById = new Map((merchantsQ.data ?? []).map((m)=>[
      m.id,
      m
    ]));
  const stats = new Map();
  let gross = 0, collected = 0, outstanding = 0, activeSales = 0;
  for (const sale of salesQ.data ?? []){
    if (sale.deleted_at) continue;
    const total = Number(sale.total_amount || 0);
    const paid = Number(sale.paid_amount || 0);
    const remaining = Number(sale.remaining_amount ?? Math.max(total - paid, 0));
    gross += total;
    collected += paid;
    outstanding += remaining;
    activeSales += 1;
    const s = stats.get(sale.merchant_id) || {
      count: 0,
      total: 0,
      paid: 0,
      outstanding: 0,
      lastSaleAt: null
    };
    s.count += 1;
    s.total += total;
    s.paid += paid;
    s.outstanding += remaining;
    if (!s.lastSaleAt || new Date(sale.happened_at).getTime() > new Date(s.lastSaleAt).getTime()) s.lastSaleAt = sale.happened_at;
    stats.set(sale.merchant_id, s);
  }
  const sessionStats = new Map();
  for (const session of sessionsQ.data ?? []){
    const active = !session.revoked_at && new Date(session.expires_at).getTime() > now;
    const s = sessionStats.get(session.account_id) || {
      active: 0,
      lastSeenAt: null
    };
    if (active) s.active += 1;
    if (!s.lastSeenAt || new Date(session.last_seen_at).getTime() > new Date(s.lastSeenAt).getTime()) s.lastSeenAt = session.last_seen_at;
    sessionStats.set(session.account_id, s);
  }
  const users = (accountsQ.data ?? []).map((a)=>{
    const merchant = merchants.get(a.id) || null;
    const access = accessInfo(a);
    const sessions = sessionStats.get(a.id) || {
      active: 0,
      lastSeenAt: null
    };
    return {
      ...a,
      access,
      merchant,
      stats: merchant ? stats.get(merchant.id) || {
        count: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
        lastSaleAt: null
      } : {
        count: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
        lastSaleAt: null
      },
      active_sessions: sessions.active,
      effective_last_seen_at: a.last_seen_at || sessions.lastSeenAt || a.last_login_at
    };
  });
  const payments = (paymentsQ.data ?? []).map((p)=>({
      ...p,
      merchant_name: merchantById.get(p.merchant_id)?.name || "Commerce",
      identifier: users.find((u)=>u.id === p.account_id)?.display_identifier || ""
    }));
  const pending = payments.filter((p)=>p.status === "pending");
  const metrics = {
    users: users.length,
    activeUsers: users.filter((u)=>u.access.can_write).length,
    active7d: users.filter((u)=>u.effective_last_seen_at && u.effective_last_seen_at >= activeCutoff).length,
    trialing: users.filter((u)=>u.access.trial_active).length,
    expired: users.filter((u)=>!u.access.can_write && !u.access.suspended).length,
    suspended: users.filter((u)=>u.access.suspended).length,
    pendingPayments: pending.length,
    pendingAmount: pending.reduce((sum, p)=>sum + Number(p.amount || 0), 0),
    sales: activeSales,
    gross,
    collected,
    outstanding
  };
  return response(req, {
    ok: true,
    metrics,
    users,
    payments
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
      service: "sama-api-v5",
      version: "5.0.0",
      offline_operations: true,
      admin_dashboard: "enhanced"
    });
    if (req.method !== "POST") fail("Méthode non autorisée.", 405);
    if (!(req.headers.get("content-type") || "").includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "sync_operations") return await handleSyncOperations(req, body);
    if (action === "admin_dashboard") return await handleAdminDashboard(req);
    return await proxy(req, body);
  } catch (unknownError) {
    const error = unknownError;
    console.error("sama-api-v5", {
      status: error.status || 500,
      message: error.status && error.status < 500 ? "handled" : error.message
    });
    return response(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez."
    }, error.status || 500);
  }
});
