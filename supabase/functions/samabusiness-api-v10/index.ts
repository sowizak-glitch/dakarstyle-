import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type ApiError = Error & { status?: number };
type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const UPSTREAM = `${SUPABASE_URL}/functions/v1/sama-business-api`;
const VERSION = "10.4.0";

function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed) as Record<string, unknown>;
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const candidate of Object.values(parsed)) {
      if (typeof candidate === "string" && candidate.length > 40) return candidate;
    }
  } catch {
    return packed.length > 40 ? packed : "";
  }
  return "";
}

const SERVICE_KEY = serviceKey();
const db = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const encoder = new TextEncoder();

const allowedOrigins = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com",
  "https://sama-cahier-ia.vercel.app",
]);

function allowed(origin: string | null): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+(?:-eminix-s-projects)?\.vercel\.app$/i.test(origin);
}

function cors(origin: string | null): Record<string, string> {
  const safe = origin && allowed(origin) ? origin : "https://samabusiness.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type,apikey,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-samabusiness-api-version": VERSION,
  };
}

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}
function num(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function uuid(value: unknown): string | null {
  const candidate = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}
function fail(message: string, status = 400): never {
  const error = new Error(message) as ApiError;
  error.status = status;
  throw error;
}
function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function accessInfo(account: any) {
  const now = Date.now();
  const role = account.role || "merchant";
  const trialEnd = account.trial_ends_at ? new Date(account.trial_ends_at).getTime() : 0;
  const paidEnd = account.subscription_paid_until ? new Date(account.subscription_paid_until).getTime() : 0;
  const suspended = Boolean(account.suspended_at) || account.subscription_status === "suspended";
  const trialActive = trialEnd > now;
  const paidActive = paidEnd > now && account.subscription_status === "active";
  return {
    role,
    suspended,
    trial_active: trialActive,
    paid_active: paidActive,
    can_write: role === "admin" || (!suspended && (trialActive || paidActive)),
  };
}

async function sessionContext(req: Request, requireWrite = false) {
  if (!db) fail("Backend indisponible.", 503);
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sessionQ = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401);
  const accountQ = await db.from("sama_accounts").select("id,is_active,role,trial_ends_at,subscription_status,subscription_paid_until,suspended_at").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active) fail("Ce compte est désactivé.", 403);
  const merchantQ = await db.from("sama_merchants").select("id,account_id,name,phone,country_code,currency,locale,timezone").eq("account_id", accountQ.data.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  const access = accessInfo(accountQ.data);
  if (requireWrite && !access.can_write) {
    fail(access.suspended ? "Ce compte est suspendu. Contactez l’assistance." : "Votre période gratuite ou votre abonnement est terminé.", 402);
  }
  return { account: accountQ.data, merchant: merchantQ.data, access, session_hash: tokenHash };
}

async function salesWorkspace(req: Request, body: any): Promise<Json> {
  const ctx = await sessionContext(req);
  const limit = Math.min(Math.max(Math.trunc(num(body.limit, 500)), 50), 1000);
  const activityLimit = Math.min(limit, 500);
  const [customers, sales, orders, deliveries, products, expenses, cashMovements] = await Promise.all([
    db!.from("sama_customer_360_v2").select("id,name,phone,whatsapp,normalized_phone,default_address,default_area,purchase_count,total_purchased,total_paid,outstanding_amount,last_purchase_at,open_delivery_count,delivery_today_count,next_delivery_at,last_order_at").eq("merchant_id", ctx.merchant.id).order("last_purchase_at", { ascending: false, nullsFirst: false }).limit(limit),
    db!.from("sama_sales").select("id,client_ref,customer_id,customer_name_snapshot,customer_phone_snapshot,description,total_amount,paid_amount,remaining_amount,source,happened_at,cost_amount,delivery_cost,payment_method,order_id,profit_amount").eq("merchant_id", ctx.merchant.id).is("deleted_at", null).order("happened_at", { ascending: false }).limit(limit),
    db!.from("sama_orders").select("id,client_ref,order_number,source,status,payment_status,delivery_status,customer_id,customer_name,customer_phone,customer_whatsapp,delivery_address,delivery_area,landmark,requested_for,total_amount,paid_amount,delivery_cost,payment_method,sale_id,delivery_id,notes,raw_message,missing_fields,whatsapp_message,checkout_channel,customer_consent_at,sent_to_whatsapp_at,created_at,updated_at,delivered_at,sama_order_items(id,product_id,product_name,variant,quantity,unit_price,unit_cost,line_total,line_cost)").eq("merchant_id", ctx.merchant.id).order("created_at", { ascending: false }).limit(limit),
    db!.from("liv_deliveries").select("id,delivery_number,source_reference,recipient_name,recipient_phone,delivery_address,delivery_area,package_description,package_value,amount_to_collect,payment_received,amount_remaining,payment_status,status,assigned_driver_id,scheduled_for,delivered_at,failed_at,created_at,updated_at").eq("merchant_id", ctx.merchant.id).order("created_at", { ascending: false }).limit(limit),
    db!.from("sama_products").select("id,sku,name,category,sale_price,purchase_cost,stock_quantity,low_stock_threshold,track_stock,active,image_url").eq("merchant_id", ctx.merchant.id).eq("active", true).order("name").limit(1000),
    db!.from("sama_expenses").select("id,client_ref,category,label,amount,payment_method,scope,related_order_id,notes,happened_at,created_at,updated_at").eq("merchant_id", ctx.merchant.id).order("happened_at", { ascending: false }).limit(activityLimit),
    db!.from("sama_cash_movements").select("id,client_ref,movement_type,amount,payment_method,reason,happened_at,created_at").eq("merchant_id", ctx.merchant.id).order("happened_at", { ascending: false }).limit(activityLimit),
  ]);
  for (const query of [customers, sales, orders, deliveries, products, expenses, cashMovements]) if (query.error) throw query.error;
  return {
    ok: true,
    version: VERSION,
    merchant: ctx.merchant,
    access: ctx.access,
    customers: customers.data ?? [],
    sales: sales.data ?? [],
    orders: orders.data ?? [],
    deliveries: deliveries.data ?? [],
    products: products.data ?? [],
    expenses: expenses.data ?? [],
    cash_movements: cashMovements.data ?? [],
    capabilities: { copilot_context: true, whatsapp_inbox_context: true, finance_context: true, low_stock_thresholds: true, guide_v17: true },
  };
}

async function copilotGuide(req: Request, body: any, action: "snapshot" | "interpret_text" | "save_settings"): Promise<Json> {
  const ctx = await sessionContext(req, action === "save_settings");
  const payload = action === "interpret_text"
    ? { text: text(body.text ?? body.query, 1200) }
    : action === "save_settings"
      ? {
          guideEnabled: body.guideEnabled,
          marketMode: body.marketMode,
          helpStyle: text(body.helpStyle, 20) || "mixed",
          literacyMode: text(body.literacyMode, 20) || "simple",
          language: text(body.language, 10) || "fr",
          audioExplanations: body.audioExplanations,
          simplifiedMode: body.simplifiedMode,
        }
      : {};
  if (action === "interpret_text" && !payload.text) fail("Dites ou écrivez ce que vous voulez faire.");
  const query = await db!.rpc("sama_guide_gateway_v17", {
    p_session_hash: ctx.session_hash,
    p_action: action,
    p_payload: payload,
  });
  if (query.error) throw query.error;
  const result = query.data as any;
  if (result?.ok === false) {
    const code = String(result.code || "");
    const status = code === "AUTH_REQUIRED" || code === "SESSION_EXPIRED" ? 401 : code === "RATE_LIMITED" ? 429 : 400;
    fail(text(result.error, 300) || "Le guide est momentanément indisponible.", status);
  }
  return { ok: true, version: VERSION, guide: result };
}

async function createSaleV2(req: Request, body: any): Promise<Json> {
  const ctx = await sessionContext(req, true);
  const items = Array.isArray(body.items)
    ? body.items.slice(0, 50).map((item: any) => ({
        product_id: uuid(item.productId), product_name: text(item.productName, 160) || "Article",
        variant: text(item.variant, 100) || null, quantity: Math.max(num(item.quantity, 1), 0.001),
        unit_price: Math.max(num(item.unitPrice), 0), unit_cost: Math.max(num(item.unitCost), 0),
      }))
    : [];
  if (!items.length) fail("Ajoutez au moins un article.");
  const deliveryRequired = body.deliveryRequired === true;
  const customerName = text(body.customerName, 160);
  const customerPhone = text(body.customerPhone, 40);
  const deliveryAddress = text(body.deliveryAddress, 500);
  if (deliveryRequired && !customerPhone) fail("Le téléphone est requis pour une livraison.");
  if (deliveryRequired && !deliveryAddress) fail("L’adresse est requise pour une livraison.");
  let scheduledFor: string | null = null;
  if (deliveryRequired && body.scheduledFor) {
    const date = new Date(String(body.scheduledFor));
    if (Number.isNaN(date.getTime())) fail("Date de livraison invalide.");
    scheduledFor = date.toISOString();
  }
  const clientRef = uuid(body.clientRef) || crypto.randomUUID();
  const query = await db!.rpc("sama_sales_ops_create_sale", {
    p_merchant_id: ctx.merchant.id,
    p_client_ref: clientRef,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_address: deliveryAddress,
    p_customer_area: text(body.deliveryArea, 120),
    p_items: items,
    p_paid_amount: Math.max(num(body.paidAmount), 0),
    p_payment_method: ["cash", "wave", "orange_money", "bank", "other"].includes(body.paymentMethod) ? body.paymentMethod : "cash",
    p_delivery_required: deliveryRequired,
    p_scheduled_for: scheduledFor,
    p_delivery_cost: Math.max(num(body.deliveryCost), 0),
    p_source: ["manual", "whatsapp", "voice", "photo", "web", "import"].includes(body.source) ? body.source : "manual",
    p_notes: text(body.notes, 1000),
  });
  if (query.error) {
    const message = String(query.error.message || "");
    if (message.includes("insufficient_stock")) fail("Stock insuffisant pour un article.", 409);
    if (message.includes("product_not_found")) fail("Un produit est introuvable.", 404);
    if (message.includes("delivery_phone_required")) fail("Téléphone requis pour la livraison.");
    if (message.includes("delivery_address_required")) fail("Adresse requise pour la livraison.");
    throw query.error;
  }
  return { ok: true, result: query.data, clientRef };
}

async function saveCustomer(req: Request, body: any): Promise<Json> {
  const ctx = await sessionContext(req, true);
  const id = uuid(body.customerId);
  if (!id) fail("Client invalide.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) { const name = text(body.name, 160); if (!name) fail("Indiquez le nom du client."); patch.name = name; }
  if (body.phone !== undefined) patch.phone = text(body.phone, 40) || null;
  if (body.whatsapp !== undefined) patch.whatsapp = text(body.whatsapp, 40) || null;
  if (body.defaultAddress !== undefined) patch.default_address = text(body.defaultAddress, 500) || null;
  if (body.defaultArea !== undefined) patch.default_area = text(body.defaultArea, 120) || null;
  if (body.notes !== undefined) patch.notes = text(body.notes, 1000) || null;
  const query = await db!.from("sama_customers").update(patch).eq("id", id).eq("merchant_id", ctx.merchant.id).select("*").maybeSingle();
  if (query.error) {
    if (query.error.code === "23505") fail("Ce numéro est déjà rattaché à un autre client.", 409);
    throw query.error;
  }
  if (!query.data) fail("Client introuvable.", 404);
  return { ok: true, customer: query.data };
}

async function customerDetail(req: Request, body: any): Promise<Json> {
  const ctx = await sessionContext(req);
  const customerId = uuid(body.customerId);
  if (!customerId) fail("Client invalide.");
  const [customer, sales, orders] = await Promise.all([
    db!.from("sama_customer_360_v2").select("*").eq("id", customerId).eq("merchant_id", ctx.merchant.id).maybeSingle(),
    db!.from("sama_sales").select("id,description,total_amount,paid_amount,remaining_amount,source,happened_at,payment_method,order_id").eq("merchant_id", ctx.merchant.id).eq("customer_id", customerId).is("deleted_at", null).order("happened_at", { ascending: false }).limit(200),
    db!.from("sama_orders").select("id,order_number,status,payment_status,delivery_status,delivery_address,delivery_area,requested_for,total_amount,paid_amount,delivery_id,created_at,sama_order_items(product_name,variant,quantity,unit_price,line_total)").eq("merchant_id", ctx.merchant.id).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200),
  ]);
  for (const query of [customer, sales, orders]) if (query.error) throw query.error;
  if (!customer.data) fail("Client introuvable.", 404);
  return { ok: true, customer: customer.data, sales: sales.data ?? [], orders: orders.data ?? [] };
}

async function setOrderState(req: Request, body: any): Promise<Json> {
  const ctx = await sessionContext(req, true);
  const orderId = uuid(body.orderId);
  const requested = text(body.state, 40);
  const allowedStates = new Set(["preparing", "ready", "out_for_delivery", "delivered", "failed", "cancelled"]);
  if (!orderId || !allowedStates.has(requested)) fail("Statut invalide.");
  const orderQ = await db!.from("sama_orders").select("id,status,delivery_status,delivery_id").eq("id", orderId).eq("merchant_id", ctx.merchant.id).maybeSingle();
  if (orderQ.error) throw orderQ.error;
  if (!orderQ.data) fail("Commande introuvable.", 404);
  const now = new Date().toISOString();
  const orderPatch: Record<string, unknown> = { status: requested, updated_at: now };
  if (requested === "out_for_delivery") orderPatch.delivery_status = "picked_up";
  if (requested === "delivered") { orderPatch.delivery_status = "delivered"; orderPatch.delivered_at = now; }
  if (requested === "failed") orderPatch.delivery_status = "failed";
  if (requested === "cancelled") orderPatch.delivery_status = "returned";
  const updateOrder = await db!.from("sama_orders").update(orderPatch).eq("id", orderId).eq("merchant_id", ctx.merchant.id).select("*").single();
  if (updateOrder.error) throw updateOrder.error;
  const deliveryId = uuid(orderQ.data.delivery_id);
  let delivery: any = null;
  if (deliveryId) {
    const deliveryStatus = requested === "out_for_delivery" ? "in_transit" : requested === "delivered" ? "delivered" : requested === "failed" ? "failed" : requested === "cancelled" ? "returned" : null;
    if (deliveryStatus) {
      const deliveryPatch: Record<string, unknown> = { status: deliveryStatus, updated_at: now };
      if (deliveryStatus === "delivered") deliveryPatch.delivered_at = now;
      if (deliveryStatus === "failed") deliveryPatch.failed_at = now;
      const deliveryQ = await db!.from("liv_deliveries").update(deliveryPatch).eq("id", deliveryId).eq("merchant_id", ctx.merchant.id).select("*").single();
      if (deliveryQ.error) throw deliveryQ.error;
      delivery = deliveryQ.data;
      const eventQ = await db!.from("liv_delivery_events").insert({
        merchant_id: ctx.merchant.id,
        delivery_id: deliveryId,
        event_type: "status_change",
        status_from: null,
        status_to: deliveryStatus,
        note: "Mise à jour depuis SAMABUSINESS Ventes",
      });
      if (eventQ.error) console.error("sales_ops_event", eventQ.error.message);
    }
  }
  return { ok: true, order: updateOrder.data, delivery };
}

const localActions = new Set([
  "sales_ops_workspace",
  "sales_ops_create_sale",
  "sales_ops_save_customer",
  "sales_ops_customer_detail",
  "sales_ops_set_order_state",
  "copilot_snapshot",
  "copilot_interpret",
  "copilot_save_settings",
]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!allowed(origin)) return new Response("Forbidden", { status: 403, headers: cors(origin) });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!allowed(origin)) return Response.json({ ok: false, error: "Origin non autorisée." }, { status: 403, headers: cors(origin) });
  if (!SUPABASE_URL) return Response.json({ ok: false, error: "Backend indisponible." }, { status: 503, headers: cors(origin) });
  if (req.method === "GET") return Response.json({ ok: true, service: "samabusiness-api-v10", version: VERSION, upstream: "sama-business-api", sales_ops: true, copilot_context: true, guide_v17: true }, { headers: cors(origin) });
  if (req.method !== "POST") return Response.json({ ok: false, error: "Méthode non autorisée." }, { status: 405, headers: cors(origin) });

  const raw = await req.arrayBuffer();
  let body: any = null;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { /* upstream may handle its own validation */ }
  const action = text(body?.action, 80);

  if (localActions.has(action)) {
    try {
      const result = action === "sales_ops_workspace" ? await salesWorkspace(req, body)
        : action === "sales_ops_create_sale" ? await createSaleV2(req, body)
        : action === "sales_ops_save_customer" ? await saveCustomer(req, body)
        : action === "sales_ops_customer_detail" ? await customerDetail(req, body)
        : action === "sales_ops_set_order_state" ? await setOrderState(req, body)
        : action === "copilot_snapshot" ? await copilotGuide(req, body, "snapshot")
        : action === "copilot_interpret" ? await copilotGuide(req, body, "interpret_text")
        : await copilotGuide(req, body, "save_settings");
      return Response.json(result, { headers: cors(origin) });
    } catch (unknownError) {
      const error = unknownError as ApiError;
      console.error("samabusiness-api-v10-sales-ops", { status: error.status || 500, message: error.status && error.status < 500 ? "handled" : error.message });
      return Response.json({ ok: false, error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez." }, { status: error.status || 500, headers: cors(origin) });
    }
  }

  const headers = new Headers({ "content-type": req.headers.get("content-type") || "application/json" });
  for (const name of ["x-sama-session", "apikey", "x-client-info"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(UPSTREAM, { method: "POST", headers, body: raw });
    const bytes = await upstream.arrayBuffer();
    const responseHeaders = new Headers(cors(origin));
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    const retry = upstream.headers.get("retry-after");
    if (retry) responseHeaders.set("retry-after", retry);
    return new Response(bytes, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("samabusiness-api-v10", error);
    return Response.json({ ok: false, error: "Connexion momentanément indisponible. Réessayez." }, { status: 503, headers: cors(origin) });
  }
});
