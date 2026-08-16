import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = rawKeys ? JSON.parse(rawKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const allowedOrigins = new Set([
  "https://samacahier.dakarstyle.com",
  "https://samabusiness.dakarstyle.com",
  "https://sama-cahier-ia.vercel.app"
]);
function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && originAllowed(origin) ? origin : "https://samacahier.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type,apikey,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  };
}
function reply(req, body, status = 200) {
  return Response.json(body, {
    status,
    headers: cors(req.headers.get("origin"))
  });
}
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}
function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function uuid(value) {
  const v = clean(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null;
}
function b64url(bytes) {
  let raw = "";
  for (const byte of bytes)raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function context(req, requireWrite = false) {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Connexion requise.", 401);
  const sessionQ = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at").eq("token_hash", await sha256(token)).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Session expirée. Reconnectez-vous.", 401);
  const accountQ = await db.from("sama_accounts").select("id,role,is_active,suspended_at,subscription_status,trial_ends_at,subscription_paid_until").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active || accountQ.data.suspended_at) fail("Compte désactivé.", 403);
  const merchantQ = await db.from("sama_merchants").select("id,account_id,name,phone,currency,locale,timezone").eq("account_id", accountQ.data.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  const now = Date.now();
  const canWrite = accountQ.data.role === "admin" || accountQ.data.subscription_status === "active" && new Date(accountQ.data.subscription_paid_until || 0).getTime() > now || accountQ.data.subscription_status === "trialing" && new Date(accountQ.data.trial_ends_at || 0).getTime() > now;
  if (requireWrite && !canWrite) fail("Votre essai ou abonnement est terminé.", 402);
  return {
    account: accountQ.data,
    merchant: merchantQ.data,
    canWrite
  };
}
function normalizePhone(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("7")) digits = `221${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
function whatsappUrl(phone, message) {
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
function defaultReminderMessage(sale, merchantName) {
  const amount = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(Number(sale.remaining_amount || 0));
  const name = clean(sale.customer_name_snapshot, 80) || "Bonjour";
  return `${name}, petit rappel de ${merchantName} : il reste ${amount} F CFA à régler pour ${clean(sale.description, 120) || "votre achat"}. Merci.`;
}
async function workspaceBootstrap(req) {
  const ctx = await context(req, false);
  const [debtsQ, customersQ, remindersQ] = await Promise.all([
    db.from("sama_sales").select("id,customer_id,customer_name_snapshot,customer_phone_snapshot,description,total_amount,paid_amount,remaining_amount,due_date,source,notes,happened_at,created_at,updated_at").eq("merchant_id", ctx.merchant.id).is("deleted_at", null).gt("remaining_amount", 0).order("due_date", {
      ascending: true,
      nullsFirst: false
    }).order("happened_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_customers").select("id,name,phone,whatsapp,notes,created_at,updated_at").eq("merchant_id", ctx.merchant.id).order("updated_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_reminders").select("id,sale_id,scheduled_for,channel,status,message,sent_at,created_at").eq("merchant_id", ctx.merchant.id).order("scheduled_for", {
      ascending: true
    }).limit(1000)
  ]);
  for (const q of [
    debtsQ,
    customersQ,
    remindersQ
  ])if (q.error) throw q.error;
  const debts = debtsQ.data ?? [];
  const reminders = (remindersQ.data ?? []).map((reminder)=>({
      ...reminder,
      sale: debts.find((sale)=>sale.id === reminder.sale_id) || null
    }));
  const now = new Date();
  const overdue = debts.filter((sale)=>sale.due_date && new Date(`${sale.due_date}T23:59:59`).getTime() < now.getTime());
  const totalOutstanding = debts.reduce((sum, sale)=>sum + Number(sale.remaining_amount || 0), 0);
  return reply(req, {
    ok: true,
    version: "10.0.0",
    merchant: ctx.merchant,
    role: ctx.account.role,
    metrics: {
      debts: debts.length,
      overdue: overdue.length,
      outstanding: totalOutstanding,
      remindersPending: reminders.filter((r)=>r.status === "pending").length
    },
    debts,
    customers: customersQ.data ?? [],
    reminders
  });
}
async function createSimpleSale(req, body) {
  const ctx = await context(req, true);
  const total = Math.round(numberValue(body.totalAmount));
  const paid = Math.round(numberValue(body.paidAmount));
  if (total <= 0 || total > 999_999_999_999) fail("Montant total invalide.");
  if (paid < 0 || paid > total) fail("Montant payé invalide.");
  const customerName = clean(body.customerName, 160) || "Client";
  const phone = normalizePhone(body.customerPhone);
  let customerId = null;
  if (phone) {
    const existing = await db.from("sama_customers").select("id").eq("merchant_id", ctx.merchant.id).or(`phone.eq.${phone},whatsapp.eq.${phone}`).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      customerId = existing.data.id;
      const update = await db.from("sama_customers").update({
        name: customerName,
        phone,
        whatsapp: phone,
        updated_at: new Date().toISOString()
      }).eq("id", customerId).eq("merchant_id", ctx.merchant.id);
      if (update.error) throw update.error;
    } else {
      const inserted = await db.from("sama_customers").insert({
        merchant_id: ctx.merchant.id,
        name: customerName,
        phone,
        whatsapp: phone,
        notes: clean(body.customerNotes, 500) || null
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      customerId = inserted.data.id;
    }
  }
  const dueDate = body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate)) ? String(body.dueDate) : null;
  const source = [
    "manual",
    "voice",
    "text",
    "whatsapp",
    "import"
  ].includes(body.source) ? body.source : "manual";
  const insert = await db.from("sama_sales").insert({
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    customer_id: customerId,
    customer_name_snapshot: customerName,
    customer_phone_snapshot: phone,
    description: clean(body.description, 240) || (paid < total ? "Dette client" : "Vente"),
    total_amount: total,
    paid_amount: paid,
    due_date: dueDate,
    source,
    notes: clean(body.notes, 1000) || null,
    happened_at: body.happenedAt || new Date().toISOString(),
    cost_amount: Math.max(numberValue(body.costAmount), 0),
    delivery_cost: Math.max(numberValue(body.deliveryCost), 0),
    payment_method: paid < total ? "credit" : clean(body.paymentMethod, 40) || "cash"
  }).select("id,customer_id,customer_name_snapshot,customer_phone_snapshot,description,total_amount,paid_amount,remaining_amount,due_date,source,notes,happened_at,created_at,updated_at").single();
  if (insert.error) throw insert.error;
  if (paid > 0) {
    const payment = await db.from("sama_payments").insert({
      merchant_id: ctx.merchant.id,
      sale_id: insert.data.id,
      amount: paid,
      method: clean(body.paymentMethod, 40) || "cash",
      notes: source === "voice" ? "Commande vocale SAMABUSINESS" : "SAMABUSINESS"
    });
    if (payment.error) throw payment.error;
  }
  let reminder = null;
  if (Number(insert.data.remaining_amount || 0) > 0 && body.createReminder !== false) {
    const scheduled = body.reminderAt || (dueDate ? `${dueDate}T09:00:00+00:00` : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const message = clean(body.reminderMessage, 1000) || defaultReminderMessage(insert.data, ctx.merchant.name);
    const reminderQ = await db.from("sama_reminders").insert({
      merchant_id: ctx.merchant.id,
      sale_id: insert.data.id,
      scheduled_for: scheduled,
      channel: "whatsapp",
      status: "pending",
      message
    }).select("*").single();
    if (reminderQ.error) throw reminderQ.error;
    reminder = {
      ...reminderQ.data,
      whatsappUrl: whatsappUrl(phone, message)
    };
  }
  return reply(req, {
    ok: true,
    sale: insert.data,
    reminder
  });
}
async function scheduleReminder(req, body) {
  const ctx = await context(req, true);
  const saleId = uuid(body.saleId);
  if (!saleId) fail("Dette invalide.");
  const saleQ = await db.from("sama_sales").select("id,customer_name_snapshot,customer_phone_snapshot,description,remaining_amount").eq("id", saleId).eq("merchant_id", ctx.merchant.id).is("deleted_at", null).maybeSingle();
  if (saleQ.error) throw saleQ.error;
  if (!saleQ.data || Number(saleQ.data.remaining_amount || 0) <= 0) fail("Cette dette est déjà réglée ou introuvable.", 404);
  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(scheduledFor.getTime())) fail("Date de relance invalide.");
  const message = clean(body.message, 1000) || defaultReminderMessage(saleQ.data, ctx.merchant.name);
  const reminderQ = await db.from("sama_reminders").insert({
    merchant_id: ctx.merchant.id,
    sale_id: saleId,
    scheduled_for: scheduledFor.toISOString(),
    channel: "whatsapp",
    status: "pending",
    message
  }).select("*").single();
  if (reminderQ.error) throw reminderQ.error;
  return reply(req, {
    ok: true,
    reminder: reminderQ.data,
    whatsappUrl: whatsappUrl(normalizePhone(saleQ.data.customer_phone_snapshot), message)
  });
}
async function updateReminder(req, body) {
  const ctx = await context(req, true);
  const reminderId = uuid(body.reminderId);
  if (!reminderId) fail("Relance invalide.");
  const status = [
    "pending",
    "sent",
    "cancelled",
    "failed"
  ].includes(body.status) ? body.status : "sent";
  const patch = {
    status
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  const q = await db.from("sama_reminders").update(patch).eq("id", reminderId).eq("merchant_id", ctx.merchant.id).select("*").maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) fail("Relance introuvable.", 404);
  return reply(req, {
    ok: true,
    reminder: q.data
  });
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Forbidden", {
      status: 403
    });
    return new Response("ok", {
      headers: cors(origin)
    });
  }
  if (!originAllowed(origin)) return reply(req, {
    ok: false,
    error: "Origin non autorisée."
  }, 403);
  if (req.method === "GET") return reply(req, {
    ok: true,
    service: "samabusiness-control-api",
    version: "10.0.0",
    modules: [
      "debts",
      "reminders",
      "voice"
    ]
  });
  if (req.method !== "POST") return reply(req, {
    ok: false,
    error: "Méthode non autorisée."
  }, 405);
  try {
    const body = await req.json();
    const action = clean(body.action, 80);
    if (action === "workspace_bootstrap") return await workspaceBootstrap(req);
    if (action === "create_simple_sale") return await createSimpleSale(req, body);
    if (action === "schedule_reminder") return await scheduleReminder(req, body);
    if (action === "update_reminder") return await updateReminder(req, body);
    fail("Action inconnue.", 404);
  } catch (unknownError) {
    const error = unknownError;
    console.error("samabusiness-control-api", {
      status: error.status || 500,
      message: error.status && error.status < 500 ? "handled" : error.message
    });
    return reply(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez."
    }, error.status || 500);
  }
});
