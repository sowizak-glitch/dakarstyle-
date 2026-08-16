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
const LEGACY_API = `${SUPABASE_URL}/functions/v1/sama-api-v6`;
const encoder = new TextEncoder();
const exactOrigins = new Set([
  "https://samacahier.dakarstyle.com",
  "https://sama-cahier-ia.vercel.app",
  "https://sama-cahier-ia-eminix-s-projects.vercel.app",
  "https://sama-cahier-ia-idrissaminata-8568-eminix-s-projects.vercel.app"
]);
const orderStatuses = new Set([
  "draft",
  "needs_info",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "failed"
]);
const sourceTypes = new Set([
  "manual",
  "whatsapp",
  "voice",
  "photo",
  "web",
  "import"
]);
const paymentMethods = new Set([
  "cash",
  "wave",
  "orange_money",
  "bank",
  "other"
]);
function originAllowed(origin) {
  if (!origin) return true;
  if (exactOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+-eminix-s-projects\.vercel\.app$/i.test(origin);
}
function cors(origin) {
  const safe = origin && originAllowed(origin) ? origin : "https://samacahier.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type, apikey, x-sama-session, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin"
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
function text(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function num(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function uuid(value) {
  const candidate = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}
function b64url(bytes) {
  let raw = "";
  for (const byte of bytes)raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
async function sessionContext(req, requireWrite = false) {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sessionQ = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at,last_seen_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Votre session a expiré. Reconnectez-vous.", 401);
  }
  const accountQ = await db.from("sama_accounts").select("id,identifier_type,display_identifier,is_active,role,trial_started_at,trial_ends_at,subscription_status,subscription_plan,subscription_amount_xof,subscription_paid_until,last_seen_at,suspended_at,suspension_reason").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active) fail("Ce compte est désactivé.", 403);
  const merchantQ = await db.from("sama_merchants").select("id,account_id,name,business_type,phone,country_code,currency,locale,timezone,delivery_workspace_code").eq("account_id", accountQ.data.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  const access = accessInfo(accountQ.data);
  if (requireWrite && !access.can_write) {
    fail(access.suspended ? "Ce compte est suspendu. Contactez l’assistance." : "Votre période gratuite ou votre abonnement est terminé.", 402);
  }
  return {
    account: accountQ.data,
    merchant: merchantQ.data,
    access
  };
}
async function proxyLegacy(req, body) {
  const headers = new Headers({
    "content-type": "application/json"
  });
  for (const name of [
    "apikey",
    "x-sama-session",
    "x-client-info"
  ]){
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(LEGACY_API, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const bytes = await upstream.arrayBuffer();
  const responseHeaders = new Headers(cors(req.headers.get("origin")));
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  return new Response(bytes, {
    status: upstream.status,
    headers: responseHeaders
  });
}
async function bootstrap(req) {
  const ctx = await sessionContext(req);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const [sales, products, expenses, cash, orders, summary, deliveries, subscriptions] = await Promise.all([
    db.from("sama_sales").select("id,client_ref,customer_name_snapshot,customer_phone_snapshot,description,total_amount,paid_amount,remaining_amount,due_date,source,notes,happened_at,created_at,updated_at,cost_amount,delivery_cost,payment_method,order_id,profit_amount").eq("merchant_id", ctx.merchant.id).is("deleted_at", null).order("happened_at", {
      ascending: false
    }).limit(1000),
    db.from("sama_products").select("id,client_ref,sku,name,category,unit,sale_price,purchase_cost,stock_quantity,low_stock_threshold,track_stock,active,image_url,notes,metadata,created_at,updated_at").eq("merchant_id", ctx.merchant.id).eq("active", true).order("name").limit(1000),
    db.from("sama_expenses").select("id,client_ref,category,label,amount,payment_method,scope,related_order_id,receipt_url,notes,happened_at,created_at,updated_at").eq("merchant_id", ctx.merchant.id).order("happened_at", {
      ascending: false
    }).limit(500),
    db.from("sama_cash_movements").select("id,client_ref,movement_type,amount,payment_method,reason,happened_at,created_at").eq("merchant_id", ctx.merchant.id).order("happened_at", {
      ascending: false
    }).limit(500),
    db.from("sama_orders").select("id,client_ref,order_number,source,status,payment_status,delivery_status,customer_name,customer_phone,customer_whatsapp,delivery_address,delivery_area,landmark,requested_for,subtotal,delivery_fee,delivery_cost,discount_amount,total_amount,paid_amount,cost_amount,payment_method,payment_reference,raw_message,missing_fields,sale_id,delivery_id,notes,metadata,created_at,updated_at,confirmed_at,delivered_at,sama_order_items(id,product_id,product_name,variant,quantity,unit_price,unit_cost,line_total,line_cost,notes)").eq("merchant_id", ctx.merchant.id).order("created_at", {
      ascending: false
    }).limit(300),
    db.from("sama_business_daily_summary").select("*").eq("merchant_id", ctx.merchant.id).eq("business_date", today).maybeSingle(),
    db.from("liv_deliveries").select("id,delivery_number,source_type,source_reference,recipient_name,recipient_phone,delivery_address,delivery_area,amount_to_collect,payment_received,amount_remaining,delivery_fee,payment_status,status,assigned_driver_id,scheduled_for,created_at,updated_at,public_token").eq("merchant_id", ctx.merchant.id).order("created_at", {
      ascending: false
    }).limit(200),
    db.from("sama_subscription_payments").select("id,amount,currency,method,transaction_ref,status,requested_months,submitted_at,reviewed_at,review_note").eq("account_id", ctx.account.id).order("submitted_at", {
      ascending: false
    }).limit(10)
  ]);
  for (const query of [
    sales,
    products,
    expenses,
    cash,
    orders,
    summary,
    deliveries,
    subscriptions
  ]){
    if (query.error) throw query.error;
  }
  const zeroSummary = {
    merchant_id: ctx.merchant.id,
    business_date: today,
    sales_total: 0,
    collected_total: 0,
    outstanding_total: 0,
    cogs_total: 0,
    delivery_cost_total: 0,
    business_expenses: 0,
    personal_expenses: 0,
    owner_withdrawals: 0,
    owner_deposits: 0,
    sales_count: 0,
    real_profit: 0,
    withdrawable_amount: 0
  };
  const productRows = products.data ?? [];
  const orderRows = orders.data ?? [];
  return reply(req, {
    ok: true,
    version: "9.0.1",
    account: {
      ...ctx.account,
      access: ctx.access
    },
    merchant: ctx.merchant,
    access: ctx.access,
    summary: summary.data || zeroSummary,
    sales: sales.data ?? [],
    products: productRows,
    expenses: expenses.data ?? [],
    cashMovements: cash.data ?? [],
    orders: orderRows,
    deliveries: deliveries.data ?? [],
    subscriptionPayments: subscriptions.data ?? [],
    alerts: {
      lowStock: productRows.filter((p)=>p.track_stock && Number(p.stock_quantity) <= Number(p.low_stock_threshold)),
      missingCosts: (sales.data ?? []).filter((s)=>Number(s.cost_amount) === 0).slice(0, 20),
      unpaidOrders: orderRows.filter((o)=>o.payment_status !== "paid" && ![
          "cancelled",
          "failed"
        ].includes(o.status)).slice(0, 20)
    }
  });
}
async function saveProduct(req, body) {
  const ctx = await sessionContext(req, true);
  const id = uuid(body.id);
  const payload = {
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    sku: text(body.sku, 80) || null,
    name: text(body.name, 160),
    category: text(body.category, 100) || null,
    unit: text(body.unit, 30) || "pièce",
    sale_price: Math.max(num(body.salePrice), 0),
    purchase_cost: Math.max(num(body.purchaseCost), 0),
    stock_quantity: num(body.stockQuantity),
    low_stock_threshold: Math.max(num(body.lowStockThreshold, 3), 0),
    track_stock: body.trackStock !== false,
    active: body.active !== false,
    image_url: text(body.imageUrl, 1000) || null,
    notes: text(body.notes, 1000) || null,
    updated_at: new Date().toISOString()
  };
  if (!payload.name) fail("Indiquez le nom du produit.");
  const result = id ? await db.from("sama_products").update(payload).eq("id", id).eq("merchant_id", ctx.merchant.id).select("*").maybeSingle() : await db.from("sama_products").insert(payload).select("*").single();
  if (result.error) {
    if (result.error.code === "23505") fail("Ce code produit existe déjà.", 409);
    throw result.error;
  }
  if (!result.data) fail("Produit introuvable.", 404);
  return reply(req, {
    ok: true,
    product: result.data
  });
}
async function stockMovement(req, body) {
  const ctx = await sessionContext(req, true);
  const productId = uuid(body.productId);
  if (!productId) fail("Produit invalide.");
  const movementType = text(body.movementType, 40);
  const allowed = new Set([
    "opening",
    "purchase",
    "return_in",
    "return_out",
    "loss",
    "damage",
    "adjustment",
    "transfer"
  ]);
  if (!allowed.has(movementType)) fail("Type de mouvement invalide.");
  let delta = num(body.quantityDelta);
  if (!delta) fail("Indiquez une quantité différente de zéro.");
  if ([
    "loss",
    "damage",
    "return_out"
  ].includes(movementType) && delta > 0) delta = -delta;
  if ([
    "opening",
    "purchase",
    "return_in"
  ].includes(movementType) && delta < 0) delta = Math.abs(delta);
  const productQ = await db.from("sama_products").select("id,stock_quantity,purchase_cost,name").eq("id", productId).eq("merchant_id", ctx.merchant.id).maybeSingle();
  if (productQ.error) throw productQ.error;
  if (!productQ.data) fail("Produit introuvable.", 404);
  const next = Number(productQ.data.stock_quantity || 0) + delta;
  if (next < 0) fail("Le stock ne peut pas devenir négatif.");
  const unitCost = Math.max(num(body.unitCost, Number(productQ.data.purchase_cost || 0)), 0);
  const moveQ = await db.from("sama_stock_movements").insert({
    merchant_id: ctx.merchant.id,
    product_id: productId,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    movement_type: movementType,
    quantity_delta: delta,
    unit_cost: unitCost,
    notes: text(body.notes, 600) || null,
    happened_at: body.happenedAt || new Date().toISOString()
  }).select("*").single();
  if (moveQ.error) throw moveQ.error;
  const update = {
    stock_quantity: next,
    updated_at: new Date().toISOString()
  };
  if (movementType === "purchase" && unitCost > 0) update.purchase_cost = unitCost;
  const productUpdate = await db.from("sama_products").update(update).eq("id", productId).eq("merchant_id", ctx.merchant.id).select("*").single();
  if (productUpdate.error) throw productUpdate.error;
  return reply(req, {
    ok: true,
    movement: moveQ.data,
    product: productUpdate.data
  });
}
async function recordExpense(req, body) {
  const ctx = await sessionContext(req, true);
  const amount = num(body.amount);
  if (amount <= 0) fail("Indiquez un montant valide.");
  const label = text(body.label, 200);
  if (!label) fail("Indiquez la dépense.");
  const query = await db.from("sama_expenses").insert({
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    category: text(body.category, 80) || "autre",
    label,
    amount,
    payment_method: paymentMethods.has(body.paymentMethod) ? body.paymentMethod : "cash",
    scope: body.scope === "personal" ? "personal" : "business",
    related_order_id: uuid(body.orderId),
    notes: text(body.notes, 1000) || null,
    happened_at: body.happenedAt || new Date().toISOString()
  }).select("*").single();
  if (query.error) throw query.error;
  return reply(req, {
    ok: true,
    expense: query.data
  });
}
async function recordCash(req, body) {
  const ctx = await sessionContext(req, true);
  const amount = num(body.amount);
  if (amount <= 0) fail("Indiquez un montant valide.");
  const movementType = [
    "owner_withdrawal",
    "owner_deposit",
    "cash_adjustment"
  ].includes(body.movementType) ? body.movementType : "owner_withdrawal";
  const query = await db.from("sama_cash_movements").insert({
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    movement_type: movementType,
    amount,
    payment_method: paymentMethods.has(body.paymentMethod) ? body.paymentMethod : "cash",
    reason: text(body.reason, 500) || null,
    happened_at: body.happenedAt || new Date().toISOString()
  }).select("*").single();
  if (query.error) throw query.error;
  return reply(req, {
    ok: true,
    movement: query.data
  });
}
async function createSale(req, body) {
  const ctx = await sessionContext(req, true);
  const items = Array.isArray(body.items) ? body.items.slice(0, 100).map((item)=>({
      product_id: uuid(item.productId),
      product_name: text(item.productName, 160) || "Article",
      variant: text(item.variant, 100) || null,
      quantity: Math.max(num(item.quantity, 1), 0.001),
      unit_price: Math.max(num(item.unitPrice), 0),
      unit_cost: Math.max(num(item.unitCost), 0)
    })) : [];
  if (!items.length) fail("Ajoutez au moins un article.");
  const result = await db.rpc("sama_business_create_sale", {
    p_merchant_id: ctx.merchant.id,
    p_client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    p_customer_name: text(body.customerName, 160),
    p_customer_phone: text(body.customerPhone, 40),
    p_description: text(body.description, 300) || items.map((i)=>i.product_name).join(", ").slice(0, 300),
    p_items: items,
    p_paid_amount: Math.max(num(body.paidAmount), 0),
    p_payment_method: paymentMethods.has(body.paymentMethod) ? body.paymentMethod : "cash",
    p_delivery_cost: Math.max(num(body.deliveryCost), 0),
    p_happened_at: body.happenedAt || new Date().toISOString(),
    p_source: [
      "manual",
      "voice",
      "text",
      "image",
      "whatsapp",
      "import"
    ].includes(body.source) ? body.source : "manual",
    p_order_id: uuid(body.orderId)
  });
  if (result.error) {
    const message = String(result.error.message || "");
    if (message.includes("insufficient_stock")) fail("Stock insuffisant pour un article.", 409);
    if (message.includes("product_not_found")) fail("Un produit est introuvable.", 404);
    throw result.error;
  }
  return reply(req, {
    ok: true,
    sale: result.data
  });
}
function normalized(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function parsePhone(raw) {
  const patterns = [
    /(?:\+?221[\s.\-]*)?(7[05678])[\s.\-]*(\d{3})[\s.\-]*(\d{2})[\s.\-]*(\d{2})/,
    /(?:\+?221)?(7[05678]\d{7})/
  ];
  for (const pattern of patterns){
    const match = raw.match(pattern);
    if (match) {
      const local = match.length >= 5 ? `${match[1]}${match[2]}${match[3]}${match[4]}` : match[1];
      return local.startsWith("221") ? local : `221${local}`;
    }
  }
  return "";
}
function parseWhatsapp(input) {
  const raw = text(input, 6000);
  const plain = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = plain.toLowerCase();
  const phone = parsePhone(plain);
  const amountMatches = [
    ...plain.matchAll(/(\d[\d\s.]{2,})\s*(?:f\s*cfa|fcfa|cfa|francs?|f)\b/gi)
  ].map((m)=>Number(m[1].replace(/\D/g, ""))).filter((value)=>value > 0);
  const quantityMatch = lower.match(/\b(\d{1,3})\s*(?:x|pieces?|articles?|maillots?|t-?shirts?|ensembles?|paires?|produits?)\b/);
  const wolofQuantities = {
    benn: 1,
    naar: 2,
    ñaar: 2,
    nyett: 3,
    ñett: 3,
    nent: 4,
    ñeent: 4
  };
  const wolofQuantity = Object.entries(wolofQuantities).find(([word])=>lower.includes(word));
  const sizes = [
    ...new Set((plain.match(/\b(?:XXXL|XXL|XL|XS|S|M|L|3XL|2XL|3[6-9]|4[0-8])\b/gi) || []).map((v)=>v.toUpperCase()))
  ];
  const colorWords = [
    "noir",
    "blanc",
    "vert",
    "rouge",
    "jaune",
    "bleu",
    "beige",
    "rose",
    "gris",
    "marron",
    "orange",
    "violet",
    "kaki",
    "dore",
    "doré"
  ];
  const colors = colorWords.filter((color)=>lower.includes(normalized(color))).map((color)=>color === "dore" ? "doré" : color);
  const areas = [
    [
      [
        "parcelles assainies",
        "aux parcelles",
        "les parcelles",
        "parcelles"
      ],
      "Parcelles Assainies"
    ],
    [
      [
        "keur massar"
      ],
      "Keur Massar"
    ],
    [
      [
        "guediawaye"
      ],
      "Guédiawaye"
    ],
    [
      [
        "pikine"
      ],
      "Pikine"
    ],
    [
      [
        "rufisque"
      ],
      "Rufisque"
    ],
    [
      [
        "dakar plateau",
        "plateau"
      ],
      "Dakar Plateau"
    ],
    [
      [
        "grand yoff"
      ],
      "Grand Yoff"
    ],
    [
      [
        "sacre coeur"
      ],
      "Sacré-Cœur"
    ],
    [
      [
        "patte d'oie",
        "patte doie"
      ],
      "Patte d'Oie"
    ],
    [
      [
        "medina"
      ],
      "Médina"
    ],
    [
      [
        "yoff"
      ],
      "Yoff"
    ],
    [
      [
        "ouakam"
      ],
      "Ouakam"
    ],
    [
      [
        "almadies"
      ],
      "Almadies"
    ],
    [
      [
        "mermoz"
      ],
      "Mermoz"
    ],
    [
      [
        "liberte"
      ],
      "Liberté"
    ],
    [
      [
        "colobane"
      ],
      "Colobane"
    ],
    [
      [
        "hann"
      ],
      "Hann"
    ],
    [
      [
        "fann"
      ],
      "Fann"
    ],
    [
      [
        "camberene"
      ],
      "Cambérène"
    ],
    [
      [
        "thies"
      ],
      "Thiès"
    ],
    [
      [
        "mbour"
      ],
      "Mbour"
    ],
    [
      [
        "saint louis",
        "saint-louis"
      ],
      "Saint-Louis"
    ],
    [
      [
        "kaolack"
      ],
      "Kaolack"
    ],
    [
      [
        "touba"
      ],
      "Touba"
    ]
  ];
  let area = "";
  for (const [aliases, official] of areas){
    if (aliases.some((alias)=>lower.includes(alias))) {
      area = official;
      break;
    }
  }
  const paymentMethod = lower.includes("wave") ? "wave" : lower.includes("orange money") || lower.includes("orange") ? "orange_money" : lower.includes("cash") || lower.includes("espece") ? "cash" : "";
  const nameMatch = raw.match(/(?:je m['’]?appelle|mon nom est|client\s*[:=-])\s*([A-Za-zÀ-ÿ'’ -]{2,60})/i);
  const productMatch = raw.match(/(?:je veux|je prends|commande|produit\s*[:=-])\s+([^\n,.]{2,140})/i);
  const addressMatch = raw.match(/(?:livr(?:er|aison)?\s+(?:a|à|au|aux)|adresse\s*[:=-])\s*([^\n,.]{2,180})/i);
  const result = {
    raw_message: raw,
    customer_name: nameMatch?.[1]?.trim() || "",
    customer_phone: phone,
    product_text: productMatch?.[1]?.trim() || raw.split(/\n|\./)[0].slice(0, 140),
    quantity: quantityMatch ? Number(quantityMatch[1]) : wolofQuantity?.[1] || 1,
    sizes,
    colors: [
      ...new Set(colors)
    ],
    delivery_area: area,
    delivery_address: addressMatch?.[1]?.trim() || area,
    payment_method: paymentMethod,
    detected_amount: amountMatches.length ? Math.max(...amountMatches) : 0
  };
  const missing = [];
  if (!result.product_text) missing.push("produit");
  if (!result.customer_phone) missing.push("téléphone");
  if (!result.delivery_address) missing.push("adresse");
  if (!result.payment_method) missing.push("paiement");
  return {
    ...result,
    missing_fields: missing,
    confidence: Math.max(0.35, Math.min(0.98, 1 - missing.length * 0.14))
  };
}
async function saveOrder(req, body) {
  const ctx = await sessionContext(req, true);
  const id = uuid(body.id);
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  let orderNumber = text(body.orderNumber, 40);
  if (!orderNumber) {
    const numberQ = await db.rpc("sama_business_order_number", {
      p_merchant_id: ctx.merchant.id
    });
    if (numberQ.error) throw numberQ.error;
    orderNumber = String(numberQ.data);
  }
  const subtotal = items.reduce((sum, item)=>sum + Math.max(num(item.quantity, 1), 0.001) * Math.max(num(item.unitPrice), 0), 0);
  const cogs = items.reduce((sum, item)=>sum + Math.max(num(item.quantity, 1), 0.001) * Math.max(num(item.unitCost), 0), 0);
  const deliveryFee = Math.max(num(body.deliveryFee), 0);
  const discount = Math.max(num(body.discountAmount), 0);
  const total = Math.max(subtotal + deliveryFee - discount, 0);
  const paid = Math.min(Math.max(num(body.paidAmount), 0), total);
  const status = orderStatuses.has(body.status) ? body.status : "draft";
  const payload = {
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    order_number: orderNumber,
    source: sourceTypes.has(body.source) ? body.source : "manual",
    status,
    payment_status: paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
    delivery_status: body.deliveryRequired === false ? "not_required" : [
      "pending",
      "assigned",
      "picked_up",
      "delivered",
      "failed",
      "returned"
    ].includes(body.deliveryStatus) ? body.deliveryStatus : "pending",
    customer_name: text(body.customerName, 160) || null,
    customer_phone: text(body.customerPhone, 40) || null,
    customer_whatsapp: text(body.customerWhatsapp || body.customerPhone, 40) || null,
    delivery_address: text(body.deliveryAddress, 500) || null,
    delivery_area: text(body.deliveryArea, 120) || null,
    landmark: text(body.landmark, 300) || null,
    requested_for: body.requestedFor || null,
    subtotal,
    delivery_fee: deliveryFee,
    delivery_cost: Math.max(num(body.deliveryCost), 0),
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    cost_amount: cogs,
    payment_method: paymentMethods.has(body.paymentMethod) ? body.paymentMethod : "cash",
    payment_reference: text(body.paymentReference, 150) || null,
    raw_message: text(body.rawMessage, 6000) || null,
    missing_fields: Array.isArray(body.missingFields) ? body.missingFields.slice(0, 20).map((v)=>text(v, 80)) : [],
    notes: text(body.notes, 1000) || null,
    updated_at: new Date().toISOString()
  };
  const orderQ = id ? await db.from("sama_orders").update(payload).eq("id", id).eq("merchant_id", ctx.merchant.id).select("*").maybeSingle() : await db.from("sama_orders").insert(payload).select("*").single();
  if (orderQ.error) throw orderQ.error;
  if (!orderQ.data) fail("Commande introuvable.", 404);
  if (items.length || body.replaceItems === true) {
    const deleteQ = await db.from("sama_order_items").delete().eq("order_id", orderQ.data.id).eq("merchant_id", ctx.merchant.id);
    if (deleteQ.error) throw deleteQ.error;
    if (items.length) {
      const rows = items.map((item)=>({
          merchant_id: ctx.merchant.id,
          order_id: orderQ.data.id,
          product_id: uuid(item.productId),
          product_name: text(item.productName, 160) || "Article",
          variant: text(item.variant, 100) || null,
          quantity: Math.max(num(item.quantity, 1), 0.001),
          unit_price: Math.max(num(item.unitPrice), 0),
          unit_cost: Math.max(num(item.unitCost), 0),
          notes: text(item.notes, 500) || null
        }));
      const itemQ = await db.from("sama_order_items").insert(rows);
      if (itemQ.error) throw itemQ.error;
    }
  }
  const fresh = await db.from("sama_orders").select("*,sama_order_items(*)").eq("id", orderQ.data.id).single();
  if (fresh.error) throw fresh.error;
  return reply(req, {
    ok: true,
    order: fresh.data
  });
}
async function createDelivery(req, body) {
  const ctx = await sessionContext(req, true);
  const orderId = uuid(body.orderId);
  let order = null;
  if (orderId) {
    const orderQ = await db.from("sama_orders").select("*").eq("id", orderId).eq("merchant_id", ctx.merchant.id).maybeSingle();
    if (orderQ.error) throw orderQ.error;
    order = orderQ.data;
  }
  const recipientName = text(body.recipientName || order?.customer_name, 160);
  const recipientPhone = text(body.recipientPhone || order?.customer_phone, 40);
  const address = text(body.deliveryAddress || order?.delivery_address, 500);
  if (!recipientName || !recipientPhone || !address) fail("Nom, téléphone et adresse de livraison sont requis.");
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date()).replace(/\D/g, "");
  const deliveryNumber = `LIV-${stamp}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const publicToken = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const amountToCollect = Math.max(num(body.amountToCollect, order ? Number(order.total_amount || 0) - Number(order.paid_amount || 0) : 0), 0);
  let paymentExpected = text(body.paymentExpected || order?.payment_method, 40) || "cash";
  if (![
    "cash",
    "wave",
    "orange_money",
    "free_money",
    "prepaid",
    "mixed",
    "other"
  ].includes(paymentExpected)) paymentExpected = "other";
  const insertQ = await db.from("liv_deliveries").insert({
    merchant_id: ctx.merchant.id,
    client_ref: uuid(body.clientRef) || crypto.randomUUID(),
    delivery_number: deliveryNumber,
    source_type: orderId ? "sama_business_order" : "manual",
    source_reference: orderId,
    sender_name: ctx.merchant.name,
    sender_phone: ctx.merchant.phone,
    pickup_address: text(body.pickupAddress, 500) || ctx.merchant.name,
    pickup_area: text(body.pickupArea, 120) || null,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    delivery_address: address,
    delivery_area: text(body.deliveryArea || order?.delivery_area, 120) || null,
    landmark: text(body.landmark || order?.landmark, 300) || null,
    package_description: text(body.packageDescription, 300) || (order ? `Commande ${order.order_number}` : "Colis"),
    package_value: Math.max(num(body.packageValue, order?.total_amount || 0), 0),
    amount_to_collect: amountToCollect,
    payment_received: 0,
    delivery_fee: Math.max(num(body.deliveryFee, order?.delivery_fee || 0), 0),
    payment_expected: paymentExpected,
    payment_status: amountToCollect > 0 ? "unpaid" : "paid",
    status: "unassigned",
    delivery_code: code,
    public_token: publicToken,
    scheduled_for: body.scheduledFor || order?.requested_for || null,
    recipient_notes: text(body.notes, 1000) || null,
    created_by_account_id: ctx.account.id
  }).select("*").single();
  if (insertQ.error) throw insertQ.error;
  if (orderId) {
    const updateQ = await db.from("sama_orders").update({
      delivery_id: insertQ.data.id,
      delivery_status: "pending",
      status: order?.status === "draft" ? "confirmed" : order?.status,
      updated_at: new Date().toISOString()
    }).eq("id", orderId).eq("merchant_id", ctx.merchant.id);
    if (updateQ.error) throw updateQ.error;
  }
  return reply(req, {
    ok: true,
    delivery: insertQ.data
  });
}
async function updateOrderStatus(req, body) {
  const ctx = await sessionContext(req, true);
  const orderId = uuid(body.orderId);
  if (!orderId) fail("Commande invalide.");
  const status = text(body.status, 30);
  if (!orderStatuses.has(status)) fail("Statut invalide.");
  const patch = {
    status,
    updated_at: new Date().toISOString()
  };
  if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  const query = await db.from("sama_orders").update(patch).eq("id", orderId).eq("merchant_id", ctx.merchant.id).select("*").maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) fail("Commande introuvable.", 404);
  return reply(req, {
    ok: true,
    order: query.data
  });
}
const businessActions = new Set([
  "business_bootstrap",
  "save_product",
  "stock_movement",
  "record_expense",
  "record_cash_movement",
  "create_business_sale",
  "parse_whatsapp_order",
  "save_order",
  "create_delivery",
  "update_order_status"
]);
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
    error: "Origin not allowed"
  }, 403);
  if (req.method === "GET") return reply(req, {
    ok: true,
    service: "sama-business-api",
    version: "9.0.1",
    compatibility: "SAMA Cahier 8.x + SAMA Livraison"
  });
  if (req.method !== "POST") return reply(req, {
    ok: false,
    error: "Méthode non autorisée."
  }, 405);
  try {
    if (!(req.headers.get("content-type") || "").includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    const action = text(body?.action, 80);
    if (!businessActions.has(action)) return await proxyLegacy(req, body);
    if (action === "business_bootstrap") return await bootstrap(req);
    if (action === "save_product") return await saveProduct(req, body);
    if (action === "stock_movement") return await stockMovement(req, body);
    if (action === "record_expense") return await recordExpense(req, body);
    if (action === "record_cash_movement") return await recordCash(req, body);
    if (action === "create_business_sale") return await createSale(req, body);
    if (action === "parse_whatsapp_order") {
      await sessionContext(req);
      return reply(req, {
        ok: true,
        parsed: parseWhatsapp(body.text)
      });
    }
    if (action === "save_order") return await saveOrder(req, body);
    if (action === "create_delivery") return await createDelivery(req, body);
    if (action === "update_order_status") return await updateOrderStatus(req, body);
    fail("Action inconnue.", 404);
  } catch (unknownError) {
    const error = unknownError;
    console.error("sama-business-api", {
      status: error.status || 500,
      message: error.status && error.status < 500 ? "handled" : error.message
    });
    return reply(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez."
    }, error.status || 500);
  }
});
