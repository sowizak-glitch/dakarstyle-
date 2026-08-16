import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "19.1.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const APP_URL = "https://samabusiness.dakarstyle.com";
const WAVE_API_KEY = Deno.env.get("WAVE_API_KEY") ?? "";
const WAVE_API_SIGNING_SECRET = Deno.env.get("WAVE_API_SIGNING_SECRET") ?? Deno.env.get("WAVE_SIGNING_SECRET") ?? "";
const WAVE_WEBHOOK_SECRET = Deno.env.get("WAVE_WEBHOOK_SECRET") ?? "";
function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const value of Object.values(parsed))if (typeof value === "string" && value.length > 40) return value;
  } catch  {
    if (packed.length > 40) return packed;
  }
  return "";
}
const SERVICE_KEY = serviceKey();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("BILLING_V19_CONFIG_MISSING");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}), encoder = new TextEncoder();
const allowedOrigins = new Set([
  APP_URL,
  "https://www.samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com"
]);
function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+(?:-eminix-s-projects)?\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const h = new Headers({
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-sama-session,x-client-info,wave-signature",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-samabusiness-billing-version": VERSION
  });
  h.set("access-control-allow-origin", origin && originAllowed(origin) ? origin : APP_URL);
  h.set("vary", "Origin");
  return h;
}
function json(body, status = 200, origin = null) {
  const h = cors(origin);
  h.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    status,
    headers: h
  });
}
function text(v, max = 500) {
  return String(v ?? "").trim().slice(0, max);
}
function uuid(v) {
  const s = text(v, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function b64url(bytes) {
  let raw = "";
  for (const b of bytes)raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(v) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(v))));
}
function hex(bytes) {
  return [
    ...new Uint8Array(bytes)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for(let i = 0; i < a.length; i++)x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function pricing() {
  const [s, seats] = await Promise.all([
    db.from("sama_billing_settings").select("monthly_price_xof,lifetime_list_price_xof,lifetime_launch_price_xof,lifetime_seat_limit,lifetime_offer_enabled,external_usage_note_fr,external_usage_note_wo").eq("singleton", true).single(),
    db.from("sama_subscription_payments").select("id", {
      count: "exact",
      head: true
    }).eq("plan_type", "lifetime").in("status", [
      "pending",
      "approved"
    ])
  ]);
  if (s.error) throw s.error;
  if (seats.error) throw seats.error;
  const c = s.data, used = seats.count ?? 0;
  return {
    monthly: {
      price_xof: c.monthly_price_xof,
      interval: "month",
      cancel_anytime: true
    },
    lifetime: {
      list_price_xof: c.lifetime_list_price_xof,
      launch_price_xof: c.lifetime_launch_price_xof,
      interval: "one_time",
      seat_limit: c.lifetime_seat_limit,
      seats_used: used,
      seats_remaining: Math.max(0, c.lifetime_seat_limit - used),
      enabled: Boolean(c.lifetime_offer_enabled) && used < c.lifetime_seat_limit,
      savings_percent: Math.round((1 - c.lifetime_launch_price_xof / c.lifetime_list_price_xof) * 100)
    },
    external_usage_note_fr: c.external_usage_note_fr,
    external_usage_note_wo: c.external_usage_note_wo
  };
}
async function session(req, adminOnly = false) {
  const tk = req.headers.get("x-sama-session")?.trim() || "";
  if (!tk.startsWith("sama_") || tk.length < 40) fail("Session requise.", 401);
  const sq = await db.from("sama_sessions").select("account_id,expires_at,revoked_at").eq("token_hash", await sha256(tk)).maybeSingle();
  if (sq.error) throw sq.error;
  const s = sq.data;
  if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) fail("Session expirée. Reconnectez-vous.", 401);
  const aq = await db.from("sama_accounts").select("id,display_identifier,is_active,role,trial_ends_at,subscription_status,subscription_plan,subscription_amount_xof,subscription_paid_until,suspended_at,plan_type,billing_interval,is_lifetime,billing_status,lifetime_activated_at,lifetime_source").eq("id", s.account_id).maybeSingle();
  if (aq.error) throw aq.error;
  if (!aq.data?.is_active) fail("Compte désactivé.", 403);
  if (adminOnly && aq.data.role !== "admin") fail("Accès administrateur requis.", 403);
  const mq = await db.from("sama_merchants").select("id,name,phone,locale,timezone").eq("account_id", s.account_id).maybeSingle();
  if (mq.error) throw mq.error;
  if (!mq.data) fail("Commerce introuvable.", 404);
  return {
    account: aq.data,
    merchant: mq.data
  };
}
function effectiveBilling(a) {
  const now = Date.now(), suspended = Boolean(a.suspended_at) || a.subscription_status === "suspended", trial = a.trial_ends_at && new Date(a.trial_ends_at).getTime() > now, paid = a.subscription_paid_until && new Date(a.subscription_paid_until).getTime() > now, lifetime = Boolean(a.is_lifetime) || a.billing_status === "lifetime", effective = lifetime ? "lifetime" : paid ? "active_monthly" : trial ? "trialing" : "expired";
  return {
    effective_status: effective,
    can_write: a.role === "admin" || !suspended && (lifetime || paid || trial),
    suspended
  };
}
async function dashboard(req) {
  const c = await session(req);
  const [p, pay, f, sites] = await Promise.all([
    pricing(),
    db.from("sama_subscription_payments").select("id,amount,currency,method,transaction_ref,status,requested_months,plan_type,billing_interval,is_lifetime,early_bird_slot,provider_checkout_id,provider_status,submitted_at,reviewed_at,review_note").eq("account_id", c.account.id).order("submitted_at", {
      ascending: false
    }).limit(30),
    db.from("sama_site_followups").select("id,generated_site_id,kind,due_at,status,title_fr,title_wo,body_fr,body_wo,calendar_uid").eq("account_id", c.account.id).eq("status", "pending").order("due_at", {
      ascending: true
    }).limit(30),
    db.from("sama_generated_sites").select("id,site_id,brand_name,sama_subdomain,custom_domain,domain_status,status,updated_at").eq("account_id", c.account.id).order("updated_at", {
      ascending: false
    }).limit(30)
  ]);
  for (const x of [
    pay,
    f,
    sites
  ])if (x.error) throw x.error;
  return {
    ok: true,
    version: VERSION,
    account: {
      ...c.account,
      ...effectiveBilling(c.account)
    },
    merchant: c.merchant,
    pricing: p,
    payments: pay.data ?? [],
    followups: f.data ?? [],
    sites: sites.data ?? []
  };
}
async function signWaveRequest(body) {
  if (!WAVE_API_SIGNING_SECRET) return null;
  const t = Math.floor(Date.now() / 1000).toString(), sig = await hmacHex(WAVE_API_SIGNING_SECRET, t + body);
  return `t=${t},v1=${sig}`;
}
async function createWaveCheckout(payment) {
  if (!WAVE_API_KEY) return null;
  const payload = {
    amount: String(Math.round(Number(payment.amount))),
    currency: "XOF",
    client_reference: `sama-sub:${payment.id}`,
    success_url: `${APP_URL}/?payment=success`,
    error_url: `${APP_URL}/?payment=error`
  };
  const raw = JSON.stringify(payload), headers = {
    authorization: `Bearer ${WAVE_API_KEY}`,
    "content-type": "application/json"
  };
  const signature = await signWaveRequest(raw);
  if (signature) headers["Wave-Signature"] = signature;
  const r = await fetch("https://api.wave.com/v1/checkout/sessions", {
    method: "POST",
    headers,
    body: raw
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw Object.assign(new Error("Wave Checkout est momentanément indisponible."), {
    status: 502
  });
  const checkoutId = text(j.id, 80), launchUrl = text(j.wave_launch_url, 1000);
  if (!checkoutId || !launchUrl) throw Object.assign(new Error("Réponse Wave incomplète."), {
    status: 502
  });
  const u = await db.from("sama_subscription_payments").update({
    provider_checkout_id: checkoutId,
    provider_status: text(j.payment_status, 40) || "processing",
    transaction_ref: checkoutId,
    updated_at: new Date().toISOString()
  }).eq("id", payment.id);
  if (u.error) throw u.error;
  return {
    checkout_id: checkoutId,
    launch_url: launchUrl,
    payment_status: j.payment_status || "processing"
  };
}
async function submitSubscription(req, body) {
  const c = await session(req);
  if (c.account.suspended_at) fail("Ce compte est suspendu.", 403);
  const plan = text(body.planType, 20);
  if (![
    "monthly",
    "lifetime"
  ].includes(plan)) fail("Formule invalide.");
  const method = text(body.method, 30);
  if (![
    "wave",
    "orange_money",
    "cash",
    "bank",
    "other"
  ].includes(method)) fail("Moyen de paiement invalide.");
  const rpc = await db.rpc("sama_create_subscription_payment_request", {
    p_account_id: c.account.id,
    p_merchant_id: c.merchant.id,
    p_plan_type: plan,
    p_method: method,
    p_transaction_ref: text(body.transactionRef, 180) || null
  });
  if (rpc.error) {
    const m = String(rpc.error.message || "");
    if (m.includes("already_lifetime")) fail("Votre compte possède déjà une licence à vie.", 409);
    if (m.includes("lifetime_offer_sold_out")) fail("L’offre de lancement à vie est complète.", 409);
    if (m.includes("lifetime_offer_closed")) fail("L’offre à vie est momentanément fermée.", 409);
    if (m.includes("lifetime_payment_already_pending")) fail("Une demande de licence à vie est déjà en attente.", 409);
    throw rpc.error;
  }
  const payment = rpc.data;
  let checkout = null;
  if (method === "wave" && WAVE_API_KEY) {
    try {
      checkout = await createWaveCheckout(payment);
    } catch (e) {
      await db.from("sama_subscription_payments").update({
        provider_status: "checkout_failed",
        updated_at: new Date().toISOString()
      }).eq("id", payment.id);
      throw e;
    }
  }
  return {
    ok: true,
    payment,
    checkout,
    pricing: await pricing(),
    validation: checkout ? "wave_webhook" : "admin",
    message: checkout ? "Ouvrez Wave pour terminer le paiement. L’accès sera activé après confirmation signée de Wave." : "Paiement enregistré. La licence sera activée après validation sécurisée."
  };
}
async function adminDashboard(req) {
  const c = await session(req, true);
  const [p, pays, accounts, merchants] = await Promise.all([
    pricing(),
    db.from("sama_subscription_payments").select("id,account_id,merchant_id,amount,currency,method,transaction_ref,status,requested_months,plan_type,billing_interval,is_lifetime,early_bird_slot,provider_checkout_id,provider_status,submitted_at").eq("status", "pending").order("submitted_at", {
      ascending: true
    }).limit(300),
    db.from("sama_accounts").select("id,display_identifier,is_active,role,trial_ends_at,subscription_status,subscription_plan,subscription_paid_until,suspended_at,plan_type,billing_interval,is_lifetime,billing_status,lifetime_activated_at,lifetime_source").order("created_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_merchants").select("id,account_id,name,phone").limit(1000)
  ]);
  for (const x of [
    pays,
    accounts,
    merchants
  ])if (x.error) throw x.error;
  const mm = new Map((merchants.data ?? []).map((m)=>[
      m.account_id,
      m
    ]));
  return {
    ok: true,
    version: VERSION,
    actor: {
      id: c.account.id,
      role: c.account.role
    },
    pricing: p,
    pending_payments: (pays.data ?? []).map((x)=>({
        ...x,
        merchant: mm.get(x.account_id) ?? null
      })),
    users: (accounts.data ?? []).map((a)=>({
        ...a,
        ...effectiveBilling(a),
        merchant: mm.get(a.id) ?? null
      }))
  };
}
async function reviewPayment(req, body) {
  const c = await session(req, true), id = uuid(body.paymentId);
  if (!id) fail("Paiement invalide.");
  const decision = text(body.decision, 20);
  if (![
    "approved",
    "rejected"
  ].includes(decision)) fail("Décision invalide.");
  const r = await db.rpc("sama_review_subscription_payment_v19", {
    p_admin_account_id: c.account.id,
    p_payment_id: id,
    p_decision: decision,
    p_note: text(body.note, 800) || null
  });
  if (r.error) throw r.error;
  return {
    ok: true,
    result: r.data
  };
}
async function grantLifetime(req, body) {
  const c = await session(req, true), target = uuid(body.accountId);
  if (!target) fail("Compte invalide.");
  const r = await db.rpc("sama_admin_grant_lifetime_v19", {
    p_admin_account_id: c.account.id,
    p_target_account_id: target,
    p_note: text(body.note, 800) || "Licence offerte par l’administrateur"
  });
  if (r.error) throw r.error;
  return {
    ok: true,
    result: r.data
  };
}
async function completeFollowup(req, body) {
  const c = await session(req), id = uuid(body.followupId);
  if (!id) fail("Rappel invalide.");
  const r = await db.from("sama_site_followups").update({
    status: "done",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", id).eq("account_id", c.account.id).select("id,status").maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) fail("Rappel introuvable.", 404);
  return {
    ok: true,
    followup: r.data
  };
}
async function verifyWaveSignature(raw, header) {
  if (!WAVE_WEBHOOK_SECRET) return false;
  const parts = header.split(","), tp = parts.find((x)=>x.startsWith("t=")), sigs = parts.filter((x)=>x.startsWith("v1=")).map((x)=>x.slice(3));
  if (!tp || !sigs.length) return false;
  const ts = Number(tp.slice(2)), now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || ts < now - 300 || ts > now + 30) return false;
  const expected = await hmacHex(WAVE_WEBHOOK_SECRET, String(ts) + raw);
  return sigs.some((s)=>safeEqual(s, expected));
}
async function waveWebhook(req, raw) {
  const signature = req.headers.get("Wave-Signature") || "";
  if (!await verifyWaveSignature(raw, signature)) return json({
    ok: false,
    error: "Signature Wave invalide."
  }, 401, null);
  let event;
  try {
    event = JSON.parse(raw);
  } catch  {
    return json({
      ok: false,
      error: "Payload invalide."
    }, 400, null);
  }
  const eventId = text(event?.id, 160), type = text(event?.type, 100), data = event?.data || {};
  if (type !== "checkout.session.completed") return json({
    ok: true,
    ignored: true
  }, 200, null);
  if (data.payment_status !== "succeeded" || data.checkout_status !== "complete" || data.currency !== "XOF") return json({
    ok: true,
    ignored: true
  }, 200, null);
  const ref = text(data.client_reference, 120), match = ref.match(/^sama-sub:([0-9a-f-]{36})$/i);
  if (!match) return json({
    ok: true,
    ignored: true
  }, 200, null);
  const paymentId = uuid(match[1]);
  if (!paymentId) return json({
    ok: true,
    ignored: true
  }, 200, null);
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return json({
    ok: false,
    error: "Montant Wave invalide."
  }, 400, null);
  const r = await db.rpc("sama_provider_confirm_subscription_payment_v19", {
    p_payment_id: paymentId,
    p_provider_event_id: eventId,
    p_provider_transaction_ref: text(data.transaction_id, 160),
    p_amount: amount,
    p_provider_checkout_id: text(data.id, 80)
  });
  if (r.error) {
    console.error("wave webhook rpc", r.error.message);
    return json({
      ok: false,
      error: "Confirmation impossible."
    }, 409, null);
  }
  return json({
    ok: true,
    confirmed: true
  }, 200, null);
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "POST" && req.headers.has("Wave-Signature")) {
    const raw = await req.text();
    try {
      return await waveWebhook(req, raw);
    } catch (e) {
      console.error("wave webhook", e);
      return json({
        ok: false,
        error: "Erreur webhook."
      }, 500, null);
    }
  }
  if (!originAllowed(origin)) return json({
    ok: false,
    error: "Origin non autorisée."
  }, 403, origin);
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: cors(origin)
  });
  try {
    if (req.method === "GET") return json({
      ok: true,
      service: "samabusiness-billing-v19",
      version: VERSION,
      pricing: await pricing(),
      payments: {
        wave_checkout_configured: Boolean(WAVE_API_KEY),
        wave_request_signing: Boolean(WAVE_API_SIGNING_SECRET),
        wave_webhook_configured: Boolean(WAVE_WEBHOOK_SECRET),
        orange_money_mode: "manual_until_merchant_credentials"
      }
    }, 200, origin);
    if (req.method !== "POST") return json({
      ok: false,
      error: "Méthode non autorisée."
    }, 405, origin);
    const body = await req.json().catch(()=>({})), action = text(body?.action, 60);
    const result = action === "dashboard" ? await dashboard(req) : action === "submit_subscription" ? await submitSubscription(req, body) : action === "admin_dashboard" ? await adminDashboard(req) : action === "admin_review_payment" ? await reviewPayment(req, body) : action === "admin_grant_lifetime" ? await grantLifetime(req, body) : action === "complete_followup" ? await completeFollowup(req, body) : fail("Action inconnue.", 404);
    return json(result, 200, origin);
  } catch (unknownError) {
    const e = unknownError;
    console.error("samabusiness-billing-v19", e.status || 500, e.status && e.status < 500 ? "handled" : e.message);
    return json({
      ok: false,
      error: e.status && e.status < 500 ? e.message : "Service momentanément indisponible."
    }, e.status || 500, origin);
  }
});
