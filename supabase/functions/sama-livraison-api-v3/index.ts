import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const U = Deno.env.get("SUPABASE_URL");
const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const K = rawKeys ? JSON.parse(rawKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(U, K, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const V2 = `${U}/functions/v1/sama-livraison-api-v2`;
const SUPPORT = `${U}/functions/v1/sama-support-api`;
const PUBLIC_APP = "https://samalivraison.dakarstyle.com/";
const enc = new TextEncoder();
const allowedOrigins = new Set([
  "https://samalivraison.dakarstyle.com",
  "https://sama-livraison.vercel.app",
  "https://sama-livraison-eminix-s-projects.vercel.app",
  `https://${new URL(U).host}`
]);
function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-livraison-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && originAllowed(origin) ? origin : PUBLIC_APP.slice(0, -1);
  return {
    "Access-Control-Allow-Origin": safe,
    "Access-Control-Allow-Headers": "content-type,apikey,x-sama-session,x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function reply(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req.headers.get("origin")),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  });
}
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}
function uuid(value) {
  const s = clean(value, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) fail("Référence invalide.");
  return s;
}
function int(value, min = 0, max = 1_000_000_000) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) fail("Valeur invalide.");
  return n;
}
function randomPin() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(10_000_000 + bytes[0] % 90_000_000);
}
function b64(bytes) {
  let s = "";
  for (const b of bytes)s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha(value) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}
function tokenOf(req) {
  return req.headers.get("x-sama-session")?.trim() || "";
}
async function proxy(url, req, body) {
  const headers = {
    "Content-Type": "application/json"
  };
  const token = tokenOf(req);
  if (token) headers["x-sama-session"] = token;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  let j;
  try {
    j = await r.json();
  } catch  {
    j = {
      ok: false,
      error: "Réponse technique invalide."
    };
  }
  if (!r.ok || j?.ok === false) fail(j?.error || "Action impossible.", r.status || 500);
  return j;
}
async function sessionContext(req) {
  const token = tokenOf(req);
  if (token.startsWith("sama_")) {
    const hash = await sha(token);
    const sq = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at").eq("token_hash", hash).maybeSingle();
    if (sq.error) throw sq.error;
    if (!sq.data || sq.data.revoked_at || new Date(sq.data.expires_at).getTime() <= Date.now()) fail("Session expirée.", 401);
    const aq = await db.from("sama_accounts").select("id,role,display_identifier,identifier_type,identifier_normalized,is_active,suspended_at,failed_attempts,locked_until").eq("id", sq.data.account_id).single();
    if (aq.error) throw aq.error;
    if (!aq.data.is_active || aq.data.suspended_at) fail("Compte désactivé.", 403);
    const mq = await db.from("sama_merchants").select("id,account_id,name,phone,currency,locale,timezone,delivery_workspace_code").eq("account_id", aq.data.id).maybeSingle();
    if (mq.error) throw mq.error;
    return {
      kind: "manager",
      sid: sq.data.id,
      account: aq.data,
      merchant: mq.data
    };
  }
  if (token.startsWith("livd_")) {
    const hash = await sha(token);
    const sq = await db.from("liv_driver_sessions").select("id,driver_id,expires_at,revoked_at").eq("token_hash", hash).maybeSingle();
    if (sq.error) throw sq.error;
    if (!sq.data || sq.data.revoked_at || new Date(sq.data.expires_at).getTime() <= Date.now()) fail("Session livreur expirée.", 401);
    const dq = await db.from("liv_drivers").select("id,merchant_id,name,display_phone,is_active,must_change_pin,availability_status").eq("id", sq.data.driver_id).single();
    if (dq.error) throw dq.error;
    if (!dq.data.is_active) fail("Accès livreur désactivé.", 403);
    const mq = await db.from("sama_merchants").select("id,name,delivery_workspace_code").eq("id", dq.data.merchant_id).single();
    if (mq.error) throw mq.error;
    return {
      kind: "driver",
      sid: sq.data.id,
      driver: dq.data,
      merchant: mq.data
    };
  }
  fail("Connexion requise.", 401);
}
function assertGlobalAdmin(ctx) {
  if (ctx.kind !== "manager" || ctx.account?.role !== "admin") fail("Accès administrateur général requis.", 403);
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
async function enrichedBootstrap(req) {
  const base = await proxy(V2, req, {
    action: "bootstrap"
  });
  const ctx = await sessionContext(req);
  if (ctx.kind === "manager") {
    const [billingQ, pricingQ] = await Promise.all([
      db.from("liv_merchant_billing").select("*").eq("merchant_id", ctx.merchant.id).maybeSingle(),
      db.from("liv_platform_pricing").select("*").eq("id", 1).single()
    ]);
    if (billingQ.error) throw billingQ.error;
    if (pricingQ.error) throw pricingQ.error;
    base.account = {
      ...base.account || {},
      role: ctx.account.role
    };
    base.isSuperAdmin = ctx.account.role === "admin";
    base.billing = billingQ.data;
    base.platformPricing = pricingQ.data;
    base.publicApp = PUBLIC_APP;
  } else {
    base.driver = {
      ...base.driver || {},
      must_change_pin: !!ctx.driver.must_change_pin
    };
  }
  return reply(req, base);
}
async function platformDashboard(req, ctx) {
  assertGlobalAdmin(ctx);
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [accountsQ, merchantsQ, driversQ, billingQ, deliveriesQ, chargesQ, paymentsQ, recoveriesQ, auditQ, pricingQ] = await Promise.all([
    db.from("sama_accounts").select("id,role,identifier_type,display_identifier,is_active,suspended_at,suspension_reason,failed_attempts,locked_until,last_login_at,last_seen_at,created_at,admin_notes,subscription_status,subscription_plan").order("created_at", {
      ascending: false
    }).limit(3000),
    db.from("sama_merchants").select("id,account_id,name,phone,currency,delivery_workspace_code,created_at").order("created_at", {
      ascending: false
    }).limit(3000),
    db.from("liv_drivers").select("id,merchant_id,name,display_phone,vehicle_type,availability_status,is_active,must_change_pin,last_pin_reset_at,suspended_reason,last_location_at,created_at").order("created_at", {
      ascending: false
    }).limit(5000),
    db.from("liv_merchant_billing").select("*").order("updated_at", {
      ascending: false
    }).limit(3000),
    db.from("liv_deliveries").select("id,merchant_id,status,platform_fee_xof,platform_charge_status,created_at,delivered_at").gte("created_at", since).limit(10000),
    db.from("liv_usage_charges").select("id,merchant_id,delivery_id,unit_fee_xof,amount_xof,status,pricing_tier,charged_at,paid_at,note").order("charged_at", {
      ascending: false
    }).limit(1000),
    db.from("liv_billing_payments").select("id,merchant_id,amount_xof,method,reference,status,confirmed_at,created_at").order("created_at", {
      ascending: false
    }).limit(500),
    db.from("sama_access_recovery").select("id,account_id,expires_at,used_at,revoked_at,created_at").is("used_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).limit(500),
    db.from("sama_admin_audit").select("id,admin_account_id,target_account_id,action,metadata,created_at").order("created_at", {
      ascending: false
    }).limit(300),
    db.from("liv_platform_pricing").select("*").eq("id", 1).single()
  ]);
  for (const q of [
    accountsQ,
    merchantsQ,
    driversQ,
    billingQ,
    deliveriesQ,
    chargesQ,
    paymentsQ,
    recoveriesQ,
    auditQ,
    pricingQ
  ])if (q.error) throw q.error;
  const accounts = accountsQ.data || [], merchants = merchantsQ.data || [], drivers = driversQ.data || [], billing = billingQ.data || [], deliveries = deliveriesQ.data || [];
  const accountById = new Map(accounts.map((x)=>[
      x.id,
      x
    ]));
  const billingByMerchant = new Map(billing.map((x)=>[
      x.merchant_id,
      x
    ]));
  const recoveries = recoveriesQ.data || [];
  const businesses = merchants.map((m)=>{
    const ds = deliveries.filter((d)=>d.merchant_id === m.id);
    const dr = drivers.filter((d)=>d.merchant_id === m.id);
    return {
      ...m,
      account: accountById.get(m.account_id) || null,
      billing: billingByMerchant.get(m.id) || null,
      activeDrivers: dr.filter((d)=>d.is_active).length,
      drivers: dr.length,
      deliveries90d: ds.length,
      delivered90d: ds.filter((d)=>d.status === "delivered").length,
      recoveryActive: recoveries.some((r)=>r.account_id === m.account_id)
    };
  });
  const metrics = {
    accounts: accounts.length,
    businesses: merchants.length,
    activeBusinesses: businesses.filter((x)=>x.account?.is_active && !x.account?.suspended_at).length,
    drivers: drivers.length,
    activeDrivers: drivers.filter((x)=>x.is_active).length,
    deliveries90d: deliveries.length,
    delivered90d: deliveries.filter((x)=>x.status === "delivered").length,
    currentDueXof: billing.reduce((a, x)=>a + Number(x.current_due_xof || 0), 0),
    totalChargedXof: billing.reduce((a, x)=>a + Number(x.total_charged_xof || 0), 0),
    totalPaidXof: billing.reduce((a, x)=>a + Number(x.total_paid_xof || 0), 0),
    lockedAccounts: accounts.filter((x)=>x.locked_until && new Date(x.locked_until).getTime() > Date.now()).length,
    suspendedAccounts: accounts.filter((x)=>!x.is_active || x.suspended_at).length
  };
  return reply(req, {
    ok: true,
    metrics,
    businesses,
    accounts,
    drivers,
    billing,
    charges: chargesQ.data || [],
    billingPayments: paymentsQ.data || [],
    auditEvents: auditQ.data || [],
    pricing: pricingQ.data
  });
}
async function accountToggle(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const targetId = uuid(body.accountId);
  if (targetId === ctx.account.id) fail("Vous ne pouvez pas suspendre votre propre compte.", 409);
  const aq = await db.from("sama_accounts").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (aq.error) throw aq.error;
  if (!aq.data) fail("Compte introuvable.", 404);
  if (aq.data.role === "admin") fail("La suspension d’un autre administrateur est bloquée.", 403);
  const active = body.active !== false;
  const now = new Date().toISOString();
  const q = await db.from("sama_accounts").update({
    is_active: active,
    suspended_at: active ? null : now,
    suspension_reason: active ? null : clean(body.reason, 500) || "Suspension administrateur",
    updated_at: now
  }).eq("id", targetId).select("id,is_active,suspended_at,suspension_reason").single();
  if (q.error) throw q.error;
  if (!active) await db.from("sama_sessions").update({
    revoked_at: now
  }).eq("account_id", targetId).is("revoked_at", null);
  await audit(ctx.account.id, targetId, active ? "reactivate_livraison_account" : "suspend_livraison_account", {
    reason: clean(body.reason, 500) || null
  });
  return reply(req, {
    ok: true,
    account: q.data
  });
}
async function unlockAccount(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const targetId = uuid(body.accountId);
  const q = await db.from("sama_accounts").update({
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString()
  }).eq("id", targetId).select("id,failed_attempts,locked_until").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Compte introuvable.", 404);
  await audit(ctx.account.id, targetId, "unlock_livraison_account");
  return reply(req, {
    ok: true,
    account: q.data
  });
}
async function revokeSessions(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const targetId = uuid(body.accountId);
  const q = await db.from("sama_sessions").update({
    revoked_at: new Date().toISOString()
  }).eq("account_id", targetId).is("revoked_at", null);
  if (q.error) throw q.error;
  await audit(ctx.account.id, targetId, "revoke_livraison_sessions");
  return reply(req, {
    ok: true
  });
}
async function generateRecovery(req, body, ctx) {
  assertGlobalAdmin(ctx);
  return reply(req, await proxy(SUPPORT, req, {
    action: "admin_generate_recovery",
    targetAccountId: uuid(body.accountId),
    note: clean(body.note, 300) || "Dépannage SAMA Livraison"
  }));
}
async function resetDriverPin(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const driverId = uuid(body.driverId);
  const pin = /^\d{6,10}$/.test(String(body.pin || "")) ? String(body.pin) : randomPin();
  const q = await db.rpc("liv_admin_reset_driver_pin", {
    p_driver_id: driverId,
    p_pin: pin,
    p_admin_id: ctx.account.id
  });
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    temporaryPin: pin,
    driver: {
      id: q.data.id,
      name: q.data.name,
      display_phone: q.data.display_phone,
      must_change_pin: true
    }
  });
}
async function driverToggle(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const driverId = uuid(body.driverId), active = body.active !== false, now = new Date().toISOString();
  const q = await db.from("liv_drivers").update({
    is_active: active,
    suspended_reason: active ? null : clean(body.reason, 500) || "Suspension administrateur",
    availability_status: active ? "offline" : "paused",
    updated_at: now
  }).eq("id", driverId).select("id,name,is_active,suspended_reason,availability_status").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Livreur introuvable.", 404);
  if (!active) await db.from("liv_driver_sessions").update({
    revoked_at: now
  }).eq("driver_id", driverId).is("revoked_at", null);
  await audit(ctx.account.id, null, active ? "reactivate_livraison_driver" : "suspend_livraison_driver", {
    driver_id: driverId,
    reason: clean(body.reason, 500) || null
  });
  return reply(req, {
    ok: true,
    driver: q.data
  });
}
async function updatePricing(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const row = {
    id: 1,
    free_deliveries_new_account: int(body.free_deliveries_new_account, 0, 10000),
    standard_fee_xof: int(body.standard_fee_xof, 0, 10000),
    volume_threshold: int(body.volume_threshold, 1, 1000000),
    volume_fee_xof: int(body.volume_fee_xof, 0, 10000),
    high_volume_threshold: int(body.high_volume_threshold, 1, 1000000),
    high_volume_fee_xof: int(body.high_volume_fee_xof, 0, 10000),
    charge_only_success: true,
    updated_by: ctx.account.id,
    updated_at: new Date().toISOString()
  };
  if (row.high_volume_threshold <= row.volume_threshold) fail("Le seuil grand volume doit dépasser le seuil volume.");
  const q = await db.from("liv_platform_pricing").upsert(row).select().single();
  if (q.error) throw q.error;
  await audit(ctx.account.id, null, "update_livraison_pricing", row);
  return reply(req, {
    ok: true,
    pricing: q.data
  });
}
async function setMerchantBilling(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const merchantId = uuid(body.merchantId);
  const status = [
    "trial",
    "active",
    "paused",
    "exempt"
  ].includes(body.billing_status) ? body.billing_status : "active";
  const override = body.unit_fee_override_xof === "" || body.unit_fee_override_xof == null ? null : int(body.unit_fee_override_xof, 0, 10000);
  const q = await db.from("liv_merchant_billing").update({
    billing_status: status,
    unit_fee_override_xof: override,
    billing_phone: clean(body.billing_phone, 32) || null,
    notes: clean(body.notes, 1000) || null,
    updated_at: new Date().toISOString()
  }).eq("merchant_id", merchantId).select().single();
  if (q.error) throw q.error;
  await audit(ctx.account.id, null, "update_livraison_merchant_billing", {
    merchant_id: merchantId,
    billing_status: status,
    unit_fee_override_xof: override
  });
  return reply(req, {
    ok: true,
    billing: q.data
  });
}
async function recordBillingPayment(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const q = await db.rpc("liv_apply_billing_payment", {
    p_merchant_id: uuid(body.merchantId),
    p_amount: int(body.amount_xof, 1),
    p_method: [
      "cash",
      "wave",
      "orange_money",
      "free_money",
      "bank",
      "other"
    ].includes(body.method) ? body.method : "other",
    p_reference: clean(body.reference, 160),
    p_admin_id: ctx.account.id
  });
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    payment: q.data
  });
}
async function waiveCharge(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const q = await db.rpc("liv_waive_usage_charge", {
    p_charge_id: uuid(body.chargeId),
    p_admin_id: ctx.account.id,
    p_note: clean(body.note, 500)
  });
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    result: q.data
  });
}
async function addFreeCredits(req, body, ctx) {
  assertGlobalAdmin(ctx);
  const q = await db.rpc("liv_add_free_deliveries", {
    p_merchant_id: uuid(body.merchantId),
    p_quantity: int(body.quantity, 1, 100000),
    p_admin_id: ctx.account.id,
    p_note: clean(body.note, 500)
  });
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    billing: q.data
  });
}
async function changeDriverPin(req, body, ctx) {
  if (ctx.kind !== "driver") fail("Accès livreur requis.", 403);
  const currentPin = String(body.currentPin || ""), newPin = String(body.newPin || "");
  if (!/^\d{6,10}$/.test(currentPin) || !/^\d{6,10}$/.test(newPin)) fail("PIN de 6 à 10 chiffres requis.");
  const q = await db.rpc("liv_driver_change_pin", {
    p_driver_id: ctx.driver.id,
    p_current_pin: currentPin,
    p_new_pin: newPin
  });
  if (q.error) throw q.error;
  if (!q.data) fail("PIN actuel incorrect.", 401);
  return reply(req, {
    ok: true,
    message: "Votre nouveau PIN est actif."
  });
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: cors(origin)
  });
  if (!originAllowed(origin)) return reply(req, {
    ok: false,
    error: "Origin non autorisée."
  }, 403);
  try {
    if (req.method === "GET") return reply(req, {
      ok: true,
      service: "sama-livraison-api-v3",
      version: "3.0.0",
      pricing: "pay-per-successful-delivery",
      publicApp: PUBLIC_APP
    });
    if (req.method !== "POST") fail("Méthode non autorisée.", 405);
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "recover_access") return reply(req, await proxy(SUPPORT, req, body));
    if ([
      "manager_register",
      "manager_login",
      "driver_login",
      "track"
    ].includes(action)) {
      const j = await proxy(V2, req, body);
      if (action === "driver_login" && j?.driver?.id) {
        const d = await db.from("liv_drivers").select("must_change_pin").eq("id", j.driver.id).maybeSingle();
        j.driver.must_change_pin = !!d.data?.must_change_pin;
      }
      return reply(req, j);
    }
    if (action === "bootstrap") return enrichedBootstrap(req);
    const ctx = await sessionContext(req);
    if (action === "platform_dashboard") return platformDashboard(req, ctx);
    if (action === "platform_account_toggle") return accountToggle(req, body, ctx);
    if (action === "platform_unlock_account") return unlockAccount(req, body, ctx);
    if (action === "platform_revoke_sessions") return revokeSessions(req, body, ctx);
    if (action === "platform_generate_recovery") return generateRecovery(req, body, ctx);
    if (action === "platform_reset_driver_pin") return resetDriverPin(req, body, ctx);
    if (action === "platform_driver_toggle") return driverToggle(req, body, ctx);
    if (action === "platform_update_pricing") return updatePricing(req, body, ctx);
    if (action === "platform_set_merchant_billing") return setMerchantBilling(req, body, ctx);
    if (action === "platform_record_billing_payment") return recordBillingPayment(req, body, ctx);
    if (action === "platform_waive_charge") return waiveCharge(req, body, ctx);
    if (action === "platform_add_free_credits") return addFreeCredits(req, body, ctx);
    if (action === "driver_change_pin") return changeDriverPin(req, body, ctx);
    const j = await proxy(V2, req, body);
    if (j?.delivery?.public_token) j.trackingUrl = `${PUBLIC_APP}?track=${j.delivery.public_token}`;
    return reply(req, j);
  } catch (unknownError) {
    const e = unknownError;
    console.error("sama-livraison-v3", {
      status: e.status || 500,
      message: e.status && e.status < 500 ? "handled" : e.message
    });
    return reply(req, {
      ok: false,
      error: e.status && e.status < 500 ? e.message : "Une erreur technique est survenue. Réessayez."
    }, e.status || 500);
  }
});
