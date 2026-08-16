import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const secretBundle = Deno.env.get("SUPABASE_SECRET_KEYS");
const SECRET_KEY = secretBundle ? JSON.parse(secretBundle)["default"] : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SECRET_KEY) {
  throw new Error("Missing Supabase backend configuration");
}
const db = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const PIN_ITERATIONS = 600_000;
const SESSION_DAYS = 90;
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
  const safeOrigin = origin && isAllowedOrigin(origin) ? origin : "https://sama-cahier-ia.vercel.app";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
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
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
function fail(message, status = 400, retryAfter) {
  const err = new Error(message);
  err.status = status;
  err.retryAfter = retryAfter;
  throw err;
}
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
function base64Url(bytes) {
  let binary = "";
  for(let i = 0; i < bytes.length; i += 1)binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i += 1)bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
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
  return `pbkdf2-sha256$${PIN_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}
async function verifyPin(pin, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_500_000) return false;
  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations
  }, key, expected.length * 8));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for(let i = 0; i < bits.length; i += 1)diff |= bits[i] ^ expected[i];
  return diff === 0;
}
function normalizeIdentifier(type, raw) {
  const identifierType = String(type ?? "").toLowerCase();
  const value = String(raw ?? "").trim();
  if (identifierType === "email") {
    const normalized = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) || normalized.length > 180) {
      fail("Adresse e-mail invalide.");
    }
    return {
      type: "email",
      normalized,
      display: normalized
    };
  }
  if (identifierType === "phone") {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 9 && digits.startsWith("7")) digits = `221${digits}`;
    if (digits.length < 10 || digits.length > 15) fail("Numéro de téléphone invalide.");
    return {
      type: "phone",
      normalized: digits,
      display: `+${digits}`
    };
  }
  fail("Choisissez e-mail ou téléphone.");
}
function validatePin(raw) {
  const pin = String(raw ?? "").trim();
  if (!/^\d{6,10}$/.test(pin)) fail("Le PIN doit contenir entre 6 et 10 chiffres.");
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
function safeBusinessName(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) fail("Indiquez le nom du commerce.");
  return name;
}
function requestIp(req) {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}
async function fingerprint(req) {
  return sha256(`${SECRET_KEY.slice(-24)}|${requestIp(req)}`);
}
async function addAuthEvent(fingerprintHash, eventType, accountId) {
  const { error } = await db.from("sama_auth_events").insert({
    fingerprint_hash: fingerprintHash,
    event_type: eventType,
    account_id: accountId ?? null
  });
  if (error) throw error;
}
async function enforceRateLimit(fingerprintHash, eventTypes, windowMinutes, max) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db.from("sama_auth_events").select("id", {
    count: "exact",
    head: true
  }).eq("fingerprint_hash", fingerprintHash).in("event_type", eventTypes).gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= max) fail("Trop de tentatives. Réessayez un peu plus tard.", 429, windowMinutes * 60);
}
async function createSession(accountId) {
  const token = `sama_${base64Url(randomBytes(48))}`;
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const { error } = await db.from("sama_sessions").insert({
    account_id: accountId,
    token_hash: tokenHash,
    expires_at: expiresAt
  });
  if (error) throw error;
  return {
    token,
    expiresAt
  };
}
async function sessionContext(req) {
  const rawToken = req.headers.get("x-sama-session")?.trim() ?? "";
  if (!rawToken.startsWith("sama_") || rawToken.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(rawToken);
  const { data: session, error: sessionError } = await db.from("sama_sessions").select("id, account_id, expires_at, revoked_at, last_seen_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401);
  const { data: account, error: accountError } = await db.from("sama_accounts").select("id, identifier_type, display_identifier, is_active").eq("id", session.account_id).maybeSingle();
  if (accountError) throw accountError;
  if (!account?.is_active) fail("Ce compte est désactivé.", 403);
  let { data: merchant, error: merchantError } = await db.from("sama_merchants").select("id, name, business_type, phone, country_code, currency, locale, timezone").eq("account_id", account.id).maybeSingle();
  if (merchantError) throw merchantError;
  if (!merchant) {
    const created = await db.from("sama_merchants").insert({
      account_id: account.id,
      name: "Mon commerce"
    }).select("id, name, business_type, phone, country_code, currency, locale, timezone").single();
    if (created.error) throw created.error;
    merchant = created.data;
  }
  if (Date.now() - new Date(session.last_seen_at).getTime() > 3_600_000) {
    await db.from("sama_sessions").update({
      last_seen_at: new Date().toISOString()
    }).eq("id", session.id);
  }
  return {
    sessionId: session.id,
    account,
    merchant
  };
}
function validateSale(raw, merchantId) {
  const total = Number(raw?.total_amount ?? raw?.total ?? 0);
  const paid = Number(raw?.paid_amount ?? raw?.paid ?? 0);
  const description = String(raw?.description ?? "Vente").trim().slice(0, 240);
  if (!Number.isFinite(total) || total < 0 || total > 999_999_999_999) fail("Montant total invalide.");
  if (!Number.isFinite(paid) || paid < 0 || paid > total) fail("Montant payé invalide.");
  const clientRef = String(raw?.client_ref ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRef)) fail("Référence locale invalide.");
  return {
    merchant_id: merchantId,
    client_ref: clientRef,
    customer_name_snapshot: String(raw?.customer_name_snapshot ?? raw?.customer ?? "Client").trim().slice(0, 160) || "Client",
    customer_phone_snapshot: String(raw?.customer_phone_snapshot ?? raw?.phone ?? "").trim().slice(0, 32) || null,
    description: description || "Vente",
    total_amount: Math.round(total),
    paid_amount: Math.round(paid),
    due_date: raw?.due_date || null,
    source: [
      "manual",
      "voice",
      "text",
      "image",
      "whatsapp",
      "import"
    ].includes(raw?.source) ? raw.source : "manual",
    notes: String(raw?.notes ?? "").trim().slice(0, 1000) || null,
    happened_at: raw?.happened_at && !Number.isNaN(Date.parse(raw.happened_at)) ? new Date(raw.happened_at).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
async function handleRegister(req, body) {
  const fp = await fingerprint(req);
  await enforceRateLimit(fp, [
    "register_attempt",
    "register_success"
  ], 60, 5);
  await addAuthEvent(fp, "register_attempt");
  const identifier = normalizeIdentifier(body.identifierType, body.identifier);
  const pin = validatePin(body.pin);
  const businessName = safeBusinessName(body.businessName);
  const existing = await db.from("sama_accounts").select("id").eq("identifier_normalized", identifier.normalized).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) fail("Un accès existe déjà avec cet identifiant. Utilisez Ouvrir mon cahier.", 409);
  const pinHash = await hashPin(pin);
  const accountInsert = await db.from("sama_accounts").insert({
    identifier_type: identifier.type,
    identifier_normalized: identifier.normalized,
    display_identifier: identifier.display,
    pin_hash: pinHash
  }).select("id, identifier_type, display_identifier").single();
  if (accountInsert.error) {
    if (accountInsert.error.code === "23505") fail("Un accès existe déjà avec cet identifiant.", 409);
    throw accountInsert.error;
  }
  const account = accountInsert.data;
  const merchantInsert = await db.from("sama_merchants").insert({
    account_id: account.id,
    name: businessName,
    phone: identifier.type === "phone" ? identifier.display : null
  }).select("id, name, business_type, phone, country_code, currency, locale, timezone").single();
  if (merchantInsert.error) {
    await db.from("sama_accounts").delete().eq("id", account.id);
    throw merchantInsert.error;
  }
  const session = await createSession(account.id);
  await addAuthEvent(fp, "register_success", account.id);
  return response(req, {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    account,
    merchant: merchantInsert.data
  });
}
async function handleLogin(req, body) {
  const fp = await fingerprint(req);
  await enforceRateLimit(fp, [
    "login_attempt",
    "login_failure"
  ], 15, 30);
  await addAuthEvent(fp, "login_attempt");
  const identifier = normalizeIdentifier(body.identifierType, body.identifier);
  const pin = String(body.pin ?? "").trim();
  if (!/^\d{6,10}$/.test(pin)) fail("Identifiant ou PIN incorrect.", 401);
  const { data: account, error } = await db.from("sama_accounts").select("id, identifier_type, display_identifier, pin_hash, failed_attempts, locked_until, is_active").eq("identifier_normalized", identifier.normalized).maybeSingle();
  if (error) throw error;
  if (!account || !account.is_active) {
    await addAuthEvent(fp, "login_failure");
    fail("Identifiant ou PIN incorrect.", 401);
  }
  if (account.locked_until && new Date(account.locked_until).getTime() > Date.now()) {
    const seconds = Math.max(60, Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 1000));
    fail("Accès temporairement verrouillé après plusieurs essais. Réessayez plus tard.", 429, seconds);
  }
  const valid = await verifyPin(pin, account.pin_hash);
  if (!valid) {
    const attempts = Number(account.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await db.from("sama_accounts").update({
      failed_attempts: attempts,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString()
    }).eq("id", account.id);
    await addAuthEvent(fp, "login_failure", account.id);
    fail(attempts >= 5 ? "Accès verrouillé pendant 15 minutes après plusieurs essais." : "Identifiant ou PIN incorrect.", attempts >= 5 ? 429 : 401, attempts >= 5 ? 900 : undefined);
  }
  await db.from("sama_accounts").update({
    failed_attempts: 0,
    locked_until: null,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", account.id);
  const session = await createSession(account.id);
  const merchantQuery = await db.from("sama_merchants").select("id, name, business_type, phone, country_code, currency, locale, timezone").eq("account_id", account.id).single();
  if (merchantQuery.error) throw merchantQuery.error;
  await addAuthEvent(fp, "login_success", account.id);
  return response(req, {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    account: {
      id: account.id,
      identifier_type: account.identifier_type,
      display_identifier: account.display_identifier
    },
    merchant: merchantQuery.data
  });
}
async function handleBootstrap(req) {
  const ctx = await sessionContext(req);
  const { data: sales, error } = await db.from("sama_sales").select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at").eq("merchant_id", ctx.merchant.id).order("happened_at", {
    ascending: false
  }).limit(1000);
  if (error) throw error;
  return response(req, {
    ok: true,
    account: ctx.account,
    merchant: ctx.merchant,
    sales: sales ?? []
  });
}
async function handleSyncSales(req, body) {
  const ctx = await sessionContext(req);
  const incoming = Array.isArray(body.sales) ? body.sales : [];
  if (incoming.length > 200) fail("Trop d'opérations dans une seule synchronisation.", 413);
  if (incoming.length === 0) return response(req, {
    ok: true,
    sales: []
  });
  const rows = incoming.map((sale)=>validateSale(sale, ctx.merchant.id));
  const { data, error } = await db.from("sama_sales").upsert(rows, {
    onConflict: "merchant_id,client_ref"
  }).select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at");
  if (error) throw error;
  return response(req, {
    ok: true,
    sales: data ?? []
  });
}
async function handleCreateSale(req, body) {
  const ctx = await sessionContext(req);
  const row = validateSale(body.sale ?? body, ctx.merchant.id);
  const { data, error } = await db.from("sama_sales").upsert(row, {
    onConflict: "merchant_id,client_ref"
  }).select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at").single();
  if (error) throw error;
  return response(req, {
    ok: true,
    sale: data
  });
}
async function handlePayment(req, body) {
  const ctx = await sessionContext(req);
  const saleId = String(body.saleId ?? "");
  const amount = Math.round(Number(body.amount ?? 0));
  const method = [
    "cash",
    "wave",
    "orange_money",
    "bank",
    "other"
  ].includes(body.method) ? body.method : "cash";
  if (!/^[0-9a-f-]{36}$/i.test(saleId) || !Number.isFinite(amount) || amount <= 0) fail("Paiement invalide.");
  const current = await db.from("sama_sales").select("id, total_amount, paid_amount").eq("id", saleId).eq("merchant_id", ctx.merchant.id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) fail("Vente introuvable.", 404);
  const remaining = Number(current.data.total_amount) - Number(current.data.paid_amount);
  if (amount > remaining) fail("Le paiement dépasse le solde restant.");
  const newPaid = Number(current.data.paid_amount) + amount;
  const updated = await db.from("sama_sales").update({
    paid_amount: newPaid,
    updated_at: new Date().toISOString()
  }).eq("id", saleId).eq("merchant_id", ctx.merchant.id).select("id, client_ref, customer_name_snapshot, customer_phone_snapshot, description, total_amount, paid_amount, remaining_amount, due_date, source, notes, happened_at, created_at, updated_at").single();
  if (updated.error) throw updated.error;
  const payment = await db.from("sama_payments").insert({
    merchant_id: ctx.merchant.id,
    sale_id: saleId,
    amount,
    method
  }).select("id, amount, method, paid_at").single();
  if (payment.error) throw payment.error;
  return response(req, {
    ok: true,
    sale: updated.data,
    payment: payment.data
  });
}
async function handleLogout(req) {
  const ctx = await sessionContext(req);
  await db.from("sama_sessions").update({
    revoked_at: new Date().toISOString()
  }).eq("id", ctx.sessionId);
  await addAuthEvent(await fingerprint(req), "logout", ctx.account.id);
  return response(req, {
    ok: true
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
      service: "sama-api",
      version: "3.0.0"
    });
    if (req.method !== "POST") return response(req, {
      ok: false,
      error: "Méthode non autorisée."
    }, 405);
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    const action = String(body?.action ?? "");
    if (action === "register") return await handleRegister(req, body);
    if (action === "login") return await handleLogin(req, body);
    if (action === "bootstrap") return await handleBootstrap(req);
    if (action === "sync_sales") return await handleSyncSales(req, body);
    if (action === "create_sale") return await handleCreateSale(req, body);
    if (action === "payment") return await handlePayment(req, body);
    if (action === "logout") return await handleLogout(req);
    fail("Action inconnue.", 404);
  } catch (unknownError) {
    const error = unknownError;
    console.error("sama-api", {
      status: error.status ?? 500,
      name: error.name,
      message: error.status && error.status < 500 ? "handled" : error.message
    });
    const res = response(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez."
    }, error.status ?? 500);
    if (error.retryAfter) res.headers.set("Retry-After", String(error.retryAfter));
    return res;
  }
});
