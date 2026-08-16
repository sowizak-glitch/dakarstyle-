import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "13.0.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = (()=>{
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    return String(parsed.default ?? parsed.service_role ?? parsed.serviceRole ?? "");
  } catch  {
    return packed;
  }
})();
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SITE_COMMERCE_CONFIG_MISSING");
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const PUBLIC_ORIGINS = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://www.samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com"
]);
const QUARANTINE_BUCKET = "sama-site-media-quarantine";
const PUBLIC_BUCKET = "sama-site-media-public";
const PUBLIC_BASE = "https://samabusiness.dakarstyle.com";
const CF_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const CF_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID") ?? "";
const CF_SAAS_TARGET = Deno.env.get("CLOUDFLARE_SAAS_TARGET") ?? "samabusiness.dakarstyle.com";
const WAVE_API_KEY = Deno.env.get("WAVE_API_KEY") ?? "";
function clean(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function digits(value) {
  const d = clean(value, 40).replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9 && d.startsWith("7")) return `221${d}`;
  if (d.length === 12 && d.startsWith("221")) return d;
  return d;
}
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}
function qty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(99, Math.floor(n))) : 1;
}
function slugify(value) {
  return clean(value, 160).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `produit-${crypto.randomUUID().slice(0, 8)}`;
}
function b64url(bytes) {
  let raw = "";
  for (const byte of bytes)raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
function randomToken(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(data);
}
function json(data, status = 200, origin) {
  const headers = cors(origin);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-samabusiness-site-commerce", VERSION);
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
function cors(origin) {
  const headers = new Headers({
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-sama-session,x-client-info",
    "access-control-max-age": "86400",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin"
  });
  if (origin && (PUBLIC_ORIGINS.has(origin) || /^https:\/\/[a-z0-9.-]+$/i.test(origin))) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return headers;
}
function fail(message, code = "BAD_REQUEST", status = 400) {
  throw Object.assign(new Error(message), {
    code,
    status
  });
}
const BLOCKED_PATTERNS = [
  /porn|porno|sexuel explicite|escort|prostitution|nudite sexuelle|mineur.*sex/i,
  /cocaine|heroine|methamphetamine|drogue illegale|cannabis.*vente/i,
  /arme a feu|munition|explosif|grenade|pistolet|fusil/i,
  /phishing|malware|spyware|rancongiciel|donnees volees/i,
  /contrefacon|faux document|carte bancaire volee|blanchiment/i,
  /trafic humain|exploitation sexuelle|terroriste|extremiste/i
];
function assertSafeText(...values) {
  const text = values.map((v)=>clean(v, 4000)).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (BLOCKED_PATTERNS.some((pattern)=>pattern.test(text))) fail("Contenu interdit par la politique de sécurité.", "PROHIBITED_CONTENT", 422);
}
async function authenticate(req) {
  const token = clean(req.headers.get("x-sama-session"), 500);
  if (!token.startsWith("sama_") || token.length < 40) fail("Connexion requise.", "AUTH_REQUIRED", 401);
  const tokenHash = await sha256(token);
  const { data: session, error: sessionError } = await db.from("sama_sessions").select("account_id,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Session expirée. Reconnectez-vous.", "SESSION_EXPIRED", 401);
  }
  const { data: account, error: accountError } = await db.from("sama_accounts").select("id,role,is_active,suspended_at").eq("id", session.account_id).maybeSingle();
  if (accountError) throw accountError;
  if (!account?.is_active || account.suspended_at) fail("Compte désactivé.", "ACCOUNT_DISABLED", 403);
  const { data: merchant } = await db.from("sama_merchants").select("id").eq("account_id", account.id).maybeSingle();
  return {
    id: account.id,
    role: account.role,
    merchantId: merchant?.id
  };
}
async function requireAdmin(req) {
  const actor = await authenticate(req);
  if (actor.role !== "admin") fail("Accès administrateur requis.", "ADMIN_REQUIRED", 403);
  return actor;
}
async function siteForActor(siteId, actor) {
  const { data: site, error } = await db.from("sama_generated_sites").select("*").eq("site_id", siteId).maybeSingle();
  if (error) throw error;
  if (!site) fail("Site introuvable.", "SITE_NOT_FOUND", 404);
  if (actor.role !== "admin" && site.account_id !== actor.id) fail("Accès refusé.", "FORBIDDEN", 403);
  return site;
}
function subscriptionUsable(site) {
  if (site.site_subscription_status === "active") return true;
  if (site.site_subscription_status === "trialing") return new Date(site.site_trial_ends_at).getTime() > Date.now();
  return false;
}
async function publicSite(siteId, host) {
  let site = null;
  if (siteId) {
    const q = await db.from("sama_generated_sites").select("*").eq("site_id", siteId).maybeSingle();
    if (q.error) throw q.error;
    site = q.data;
  } else if (host) {
    const normalized = clean(host, 253).toLowerCase().replace(/^www\./, "");
    const domain = await db.from("sama_site_domains").select("generated_site_id").eq("domain_name", normalized).eq("status", "active").maybeSingle();
    if (domain.error) throw domain.error;
    if (domain.data) {
      const q = await db.from("sama_generated_sites").select("*").eq("id", domain.data.generated_site_id).maybeSingle();
      if (q.error) throw q.error;
      site = q.data;
    }
  }
  if (!site || site.status !== "published" || site.safety_status !== "approved" || site.publication_review_status !== "approved" || !subscriptionUsable(site)) {
    fail("Boutique indisponible.", "STORE_UNAVAILABLE", 404);
  }
  return site;
}
async function audit(site, actor, action, outcome, metadata = {}, reasonCode) {
  await db.from("sama_site_audit_logs").insert({
    generated_site_id: site?.id ?? null,
    account_id: actor?.id ?? null,
    merchant_id: site?.merchant_id ?? actor?.merchantId ?? null,
    action,
    outcome,
    reason_code: reasonCode ?? null,
    metadata
  });
}
async function publicRateLimit(req, site, action, limit) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const ipHash = await sha256(`site-v13:${ip}`);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("sama_site_public_request_log").select("id", {
    count: "exact",
    head: true
  }).eq("ip_hash", ipHash).eq("action", action).gte("created_at", since);
  if ((count ?? 0) >= limit) fail("Trop de demandes. Réessayez dans une minute.", "RATE_LIMITED", 429);
  await db.from("sama_site_public_request_log").insert({
    generated_site_id: site?.id ?? null,
    action,
    ip_hash: ipHash,
    user_agent_hash: await sha256(ua),
    outcome: "success"
  });
}
async function getCatalog(site) {
  const { data: rows, error } = await db.from("sama_site_products").select("id,product_id,slug,display_name,short_description,long_description,category,display_price,compare_at_price,currency,featured,sort_order,whatsapp_enabled,metadata").eq("generated_site_id", site.id).eq("publish_status", "approved").eq("safety_status", "approved").order("featured", {
    ascending: false
  }).order("sort_order", {
    ascending: true
  }).order("created_at", {
    ascending: false
  });
  if (error) throw error;
  const ids = (rows ?? []).map((r)=>r.id);
  const productIds = (rows ?? []).map((r)=>r.product_id);
  const [mediaQ, variantsQ, stockQ, methodsQ] = await Promise.all([
    ids.length ? db.from("sama_site_product_media").select("id,site_product_id,public_url,alt_text,is_primary,sort_order").in("site_product_id", ids).eq("moderation_status", "approved").order("is_primary", {
      ascending: false
    }).order("sort_order") : Promise.resolve({
      data: [],
      error: null
    }),
    ids.length ? db.from("sama_site_product_variants").select("id,site_product_id,name,option_values,price_delta,stock_quantity,active,sort_order").in("site_product_id", ids).eq("active", true).order("sort_order") : Promise.resolve({
      data: [],
      error: null
    }),
    productIds.length ? db.from("sama_products").select("id,stock_quantity,track_stock,active,unit").in("id", productIds) : Promise.resolve({
      data: [],
      error: null
    }),
    db.from("sama_site_payment_methods").select("method,enabled,public_identifier,provider,verification_status,config_public").eq("generated_site_id", site.id)
  ]);
  if (mediaQ.error || variantsQ.error || stockQ.error || methodsQ.error) throw mediaQ.error || variantsQ.error || stockQ.error || methodsQ.error;
  const mediaBy = new Map();
  for (const item of mediaQ.data ?? [])mediaBy.set(item.site_product_id, [
    ...mediaBy.get(item.site_product_id) ?? [],
    item
  ]);
  const variantsBy = new Map();
  for (const item of variantsQ.data ?? [])variantsBy.set(item.site_product_id, [
    ...variantsBy.get(item.site_product_id) ?? [],
    item
  ]);
  const stockBy = new Map((stockQ.data ?? []).map((item)=>[
      item.id,
      item
    ]));
  return {
    site: {
      siteId: site.site_id,
      brandName: site.brand_name,
      sector: site.sector,
      language: site.language,
      whatsappNumber: digits(site.whatsapp_number),
      publicPhone: digits(site.public_phone),
      siteConfig: site.site_config
    },
    products: (rows ?? []).map((row)=>({
        ...row,
        media: mediaBy.get(row.id) ?? [],
        variants: variantsBy.get(row.id) ?? [],
        stock: stockBy.get(row.product_id) ?? null
      })),
    paymentMethods: methodsQ.data ?? []
  };
}
function orderMessage(site, orderNumber, items, customer, total) {
  const lines = items.map((item)=>`• ${item.quantity} × ${item.name}${item.variant ? ` (${item.variant})` : ""} — ${item.lineTotal.toLocaleString("fr-FR")} F CFA`);
  const address = [
    clean(customer.area, 100),
    clean(customer.address, 180),
    clean(customer.landmark, 120)
  ].filter(Boolean).join(" · ");
  return [
    `Bonjour ${site.brand_name}, je souhaite confirmer la commande ${orderNumber}.`,
    "",
    ...lines,
    "",
    `Total : ${total.toLocaleString("fr-FR")} F CFA`,
    `Client : ${clean(customer.name, 120) || "Non renseigné"}`,
    `Téléphone : ${digits(customer.phone) || "Non renseigné"}`,
    address ? `Livraison : ${address}` : "Retrait / livraison à confirmer",
    `Boutique : ${PUBLIC_BASE}/sites/${site.site_id}`
  ].join("\n");
}
async function createPublicOrder(req, payload) {
  const site = await publicSite(clean(payload.siteId, 80));
  await publicRateLimit(req, site, "create_order", 6);
  const requested = Array.isArray(payload.items) ? payload.items.slice(0, 20) : [];
  if (!requested.length) fail("Ajoutez au moins un produit.", "EMPTY_ORDER", 422);
  const ids = requested.map((item)=>clean(item.siteProductId, 80));
  const { data: products, error } = await db.from("sama_site_products").select("id,product_id,display_name,display_price,whatsapp_enabled,publish_status,safety_status").eq("generated_site_id", site.id).in("id", ids);
  if (error) throw error;
  const map = new Map((products ?? []).map((p)=>[
      p.id,
      p
    ]));
  const orderItems = [];
  let total = 0;
  for (const wanted of requested){
    const product = map.get(clean(wanted.siteProductId, 80));
    if (!product || product.publish_status !== "approved" || product.safety_status !== "approved" || !product.whatsapp_enabled) fail("Un produit n’est plus disponible.", "PRODUCT_UNAVAILABLE", 409);
    const quantity = qty(wanted.quantity);
    let variantName = "";
    let price = Number(product.display_price);
    if (wanted.variantId) {
      const { data: variant } = await db.from("sama_site_product_variants").select("id,name,price_delta,active,site_product_id").eq("id", clean(wanted.variantId, 80)).maybeSingle();
      if (!variant?.active || variant.site_product_id !== product.id) fail("Variante indisponible.", "VARIANT_UNAVAILABLE", 409);
      variantName = variant.name;
      price += Number(variant.price_delta || 0);
    }
    const lineTotal = Math.max(0, price) * quantity;
    total += lineTotal;
    orderItems.push({
      siteProductId: product.id,
      productId: product.product_id,
      name: product.display_name,
      variant: variantName,
      quantity,
      unitPrice: price,
      lineTotal
    });
  }
  const customer = payload.customer ?? {};
  const phone = digits(customer.phone);
  if (!clean(customer.name, 120) || phone.length < 9) fail("Nom et téléphone client requis.", "CUSTOMER_REQUIRED", 422);
  const orderNumber = `WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const publicToken = randomToken(24);
  const message = orderMessage(site, orderNumber, orderItems, customer, total);
  const { data: order, error: orderError } = await db.from("sama_orders").insert({
    merchant_id: site.merchant_id,
    generated_site_id: site.id,
    order_number: orderNumber,
    source: "web",
    status: "needs_info",
    payment_status: "unpaid",
    delivery_status: payload.deliveryRequired === false ? "not_required" : "pending",
    customer_name: clean(customer.name, 120),
    customer_phone: phone,
    customer_whatsapp: digits(customer.whatsapp || phone),
    delivery_address: clean(customer.address, 300) || null,
    delivery_area: clean(customer.area, 120) || null,
    landmark: clean(customer.landmark, 160) || null,
    subtotal: total,
    total_amount: total,
    payment_method: clean(payload.paymentMethod, 40) || "cash",
    public_order_token: publicToken,
    whatsapp_message: message,
    checkout_channel: "whatsapp",
    customer_consent_at: new Date().toISOString(),
    metadata: {
      siteId: site.site_id,
      siteProductIds: ids
    }
  }).select("id,order_number").single();
  if (orderError) throw orderError;
  const itemRows = orderItems.map((item)=>({
      merchant_id: site.merchant_id,
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      variant: item.variant || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      unit_cost: 0,
      line_total: item.lineTotal,
      notes: `site_product:${item.siteProductId}`
    }));
  const insertItems = await db.from("sama_order_items").insert(itemRows);
  if (insertItems.error) throw insertItems.error;
  const wa = digits(site.whatsapp_number);
  await audit(site, null, "public_order_created", "success", {
    orderId: order.id,
    orderNumber,
    total
  });
  return {
    ok: true,
    order: {
      id: order.id,
      orderNumber,
      total,
      token: publicToken
    },
    whatsappUrl: `https://wa.me/${wa}?text=${encodeURIComponent(message)}`,
    message
  };
}
function suggestedProducts(sector, description) {
  const s = `${sector} ${description}`.toLowerCase();
  if (/mode|habit|vetement|boutique|textile/.test(s)) return [
    {
      name: "Produit vedette",
      category: "Collection",
      description: "Votre article principal, présenté avec prix, tailles et couleurs."
    },
    {
      name: "Nouveauté",
      category: "Nouveautés",
      description: "Une nouveauté à mettre en avant auprès de vos clients."
    },
    {
      name: "Offre spéciale",
      category: "Promotions",
      description: "Une offre simple à partager sur WhatsApp et les réseaux sociaux."
    }
  ];
  if (/restaurant|repas|plat|food|traiteur/.test(s)) return [
    {
      name: "Plat du jour",
      category: "Menus",
      description: "Le plat principal disponible aujourd’hui."
    },
    {
      name: "Menu complet",
      category: "Menus",
      description: "Une formule claire avec accompagnement et boisson."
    },
    {
      name: "Commande groupe",
      category: "Offres",
      description: "Une offre adaptée aux familles, bureaux ou événements."
    }
  ];
  if (/beaute|coiff|cosmet|maquillage/.test(s)) return [
    {
      name: "Service essentiel",
      category: "Services",
      description: "Votre prestation la plus demandée."
    },
    {
      name: "Formule premium",
      category: "Formules",
      description: "Une prestation complète avec options."
    },
    {
      name: "Produit conseil",
      category: "Produits",
      description: "Un produit recommandé à vos clients."
    }
  ];
  return [
    {
      name: "Offre principale",
      category: "Produits et services",
      description: "Ce que vos clients demandent le plus souvent."
    },
    {
      name: "Offre rapide",
      category: "Produits et services",
      description: "Une solution simple disponible rapidement."
    },
    {
      name: "Offre complète",
      category: "Produits et services",
      description: "Une formule plus complète adaptée aux besoins importants."
    }
  ];
}
async function createProduct(site, actor, input, aiGenerated = false) {
  const name = clean(input.name, 160);
  const description = clean(input.description, 1200);
  assertSafeText(name, description, input.category);
  if (name.length < 2) fail("Nom du produit requis.", "PRODUCT_NAME_REQUIRED", 422);
  const price = money(input.price);
  const stock = Number.isFinite(Number(input.stock)) ? Math.max(0, Number(input.stock)) : 0;
  const sku = clean(input.sku, 80) || null;
  const productInsert = await db.from("sama_products").insert({
    merchant_id: site.merchant_id,
    name,
    category: clean(input.category, 120) || null,
    sale_price: price,
    purchase_cost: money(input.purchaseCost),
    stock_quantity: stock,
    track_stock: input.trackStock !== false,
    active: true,
    notes: description || null,
    metadata: {
      createdFrom: "site_studio",
      aiGenerated
    },
    sku
  }).select("id").single();
  if (productInsert.error) throw productInsert.error;
  let slug = slugify(name);
  const existing = await db.from("sama_site_products").select("id", {
    count: "exact",
    head: true
  }).eq("generated_site_id", site.id).eq("slug", slug);
  if ((existing.count ?? 0) > 0) slug = `${slug}-${crypto.randomUUID().slice(0, 5)}`;
  const link = await db.from("sama_site_products").insert({
    generated_site_id: site.id,
    merchant_id: site.merchant_id,
    product_id: productInsert.data.id,
    slug,
    display_name: name,
    short_description: description.slice(0, 260) || null,
    long_description: description || null,
    category: clean(input.category, 120) || null,
    display_price: price,
    publish_status: "draft",
    safety_status: "pending_review",
    ai_generated: aiGenerated,
    metadata: {
      needsPhoto: true,
      ownerMustConfirmPrice: price === 0
    }
  }).select("*").single();
  if (link.error) throw link.error;
  await audit(site, actor, aiGenerated ? "ai_product_draft_created" : "product_created", "success", {
    siteProductId: link.data.id
  });
  return link.data;
}
function fileMime(bytes, declared) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if ([
    "image/jpeg",
    "image/png",
    "image/webp"
  ].includes(declared)) fail("Le contenu du fichier ne correspond pas à son format.", "INVALID_IMAGE_SIGNATURE", 422);
  fail("Format d’image non autorisé.", "INVALID_IMAGE_TYPE", 422);
}
async function uploadProductImage(req, form) {
  const actor = await authenticate(req);
  const site = await siteForActor(clean(form.get("siteId"), 80), actor);
  const siteProductId = clean(form.get("siteProductId"), 80);
  const { data: siteProduct, error } = await db.from("sama_site_products").select("id,generated_site_id").eq("id", siteProductId).maybeSingle();
  if (error) throw error;
  if (!siteProduct || siteProduct.generated_site_id !== site.id) fail("Produit introuvable.", "PRODUCT_NOT_FOUND", 404);
  const file = form.get("file");
  if (!(file instanceof File)) fail("Photo requise.", "FILE_REQUIRED", 422);
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) fail("La photo doit faire moins de 10 Mo.", "FILE_TOO_LARGE", 422);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = fileMime(bytes, file.type);
  const hash = await sha256(bytes);
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${site.merchant_id}/${site.site_id}/${siteProductId}/${crypto.randomUUID()}.${ext}`;
  const upload = await db.storage.from(QUARANTINE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: "0"
  });
  if (upload.error) throw upload.error;
  const row = await db.from("sama_site_product_media").insert({
    site_product_id: siteProductId,
    generated_site_id: site.id,
    merchant_id: site.merchant_id,
    source: clean(form.get("source"), 30) || "upload",
    private_path: path,
    original_filename: clean(file.name, 180),
    mime_type: mime,
    file_size_bytes: file.size,
    sha256: hash,
    alt_text: clean(form.get("altText"), 240) || null,
    is_primary: clean(form.get("isPrimary"), 10) === "true",
    moderation_status: "pending_review"
  }).select("*").single();
  if (row.error) throw row.error;
  await audit(site, actor, "product_image_uploaded", "success", {
    mediaId: row.data.id,
    size: file.size,
    mime
  });
  return {
    ok: true,
    media: row.data,
    message: "Photo reçue. Elle sera vérifiée avant publication."
  };
}
async function uploadPaymentProof(req, form) {
  const actor = await authenticate(req);
  const site = await siteForActor(clean(form.get("siteId"), 80), actor);
  const file = form.get("file");
  if (!(file instanceof File)) fail("Preuve de paiement requise.", "FILE_REQUIRED", 422);
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) fail("Le fichier doit faire moins de 10 Mo.", "FILE_TOO_LARGE", 422);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = fileMime(bytes, file.type);
  const hash = await sha256(bytes);
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const purpose = clean(form.get("purpose"), 30);
  if (![
    "subscription",
    "domain",
    "order"
  ].includes(purpose)) fail("Objet de paiement invalide.", "INVALID_PURPOSE", 422);
  const path = `${site.merchant_id}/${site.site_id}/payments/${crypto.randomUUID()}.${ext}`;
  const upload = await db.storage.from(QUARANTINE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: "0"
  });
  if (upload.error) throw upload.error;
  const proof = await db.from("sama_site_payment_proofs").insert({
    generated_site_id: site.id,
    account_id: actor.id,
    merchant_id: site.merchant_id,
    purpose,
    related_id: clean(form.get("relatedId"), 80) || null,
    private_path: path,
    mime_type: mime,
    file_size_bytes: file.size,
    sha256: hash
  }).select("id,status").single();
  if (proof.error) throw proof.error;
  return {
    ok: true,
    proof: proof.data
  };
}
async function adminReviewMedia(req, payload) {
  const actor = await requireAdmin(req);
  const mediaId = clean(payload.mediaId, 80);
  const decision = clean(payload.decision, 30);
  if (![
    "approved",
    "rejected",
    "quarantined"
  ].includes(decision)) fail("Décision invalide.", "INVALID_DECISION", 422);
  const { data: media, error } = await db.from("sama_site_product_media").select("*").eq("id", mediaId).maybeSingle();
  if (error) throw error;
  if (!media) fail("Photo introuvable.", "MEDIA_NOT_FOUND", 404);
  let publicUrl = null;
  let publicPath = null;
  if (decision === "approved") {
    if (!media.private_path) fail("Fichier privé introuvable.", "PRIVATE_FILE_MISSING", 409);
    const downloaded = await db.storage.from(QUARANTINE_BUCKET).download(media.private_path);
    if (downloaded.error) throw downloaded.error;
    publicPath = media.private_path.replace(/\.[^.]+$/, `-${media.id.slice(0, 8)}.${media.mime_type === "image/png" ? "png" : media.mime_type === "image/webp" ? "webp" : "jpg"}`);
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const uploaded = await db.storage.from(PUBLIC_BUCKET).upload(publicPath, bytes, {
      contentType: media.mime_type,
      upsert: true,
      cacheControl: "31536000"
    });
    if (uploaded.error) throw uploaded.error;
    publicUrl = db.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath).data.publicUrl;
  }
  const updated = await db.from("sama_site_product_media").update({
    moderation_status: decision,
    moderation_reason: clean(payload.reason, 500) || null,
    reviewed_by_account_id: actor.id,
    reviewed_at: new Date().toISOString(),
    public_path: publicPath,
    public_url: publicUrl
  }).eq("id", media.id).select("*").single();
  if (updated.error) throw updated.error;
  if (decision === "approved") {
    await db.from("sama_site_products").update({
      safety_status: "approved",
      publish_status: "pending_review"
    }).eq("id", media.site_product_id);
  } else {
    await db.from("sama_site_products").update({
      safety_status: decision === "rejected" ? "rejected" : "quarantined",
      publish_status: "rejected"
    }).eq("id", media.site_product_id);
  }
  const { data: site } = await db.from("sama_generated_sites").select("*").eq("id", media.generated_site_id).maybeSingle();
  await audit(site, actor, "admin_media_review", "success", {
    mediaId,
    decision
  });
  return {
    ok: true,
    media: updated.data
  };
}
async function adminReviewSite(req, payload) {
  const actor = await requireAdmin(req);
  const siteId = clean(payload.siteId, 80);
  const site = await siteForActor(siteId, actor);
  const decision = clean(payload.decision, 30);
  if (![
    "approved",
    "changes_requested",
    "rejected"
  ].includes(decision)) fail("Décision invalide.", "INVALID_DECISION", 422);
  const { count: pendingMedia } = await db.from("sama_site_product_media").select("id", {
    count: "exact",
    head: true
  }).eq("generated_site_id", site.id).in("moderation_status", [
    "pending_scan",
    "pending_review",
    "quarantined"
  ]);
  const { count: products } = await db.from("sama_site_products").select("id", {
    count: "exact",
    head: true
  }).eq("generated_site_id", site.id).neq("publish_status", "archived");
  const { count: approvedProducts } = await db.from("sama_site_products").select("id", {
    count: "exact",
    head: true
  }).eq("generated_site_id", site.id).eq("safety_status", "approved");
  if (decision === "approved" && (pendingMedia ?? 0) > 0) fail("Des photos attendent encore une validation.", "MEDIA_REVIEW_PENDING", 409);
  if (decision === "approved" && [
    "vendre",
    "recevoir_des_commandes"
  ].includes(site.objective) && (products ?? 0) > 0 && (approvedProducts ?? 0) < (products ?? 0)) {
    fail("Tous les produits doivent être validés.", "PRODUCT_REVIEW_PENDING", 409);
  }
  const review = await db.from("sama_site_publication_reviews").select("id").eq("generated_site_id", site.id).eq("status", "pending").order("requested_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (review.data) await db.from("sama_site_publication_reviews").update({
    status: decision,
    admin_notes: clean(payload.notes, 1200) || null,
    reviewed_by_account_id: actor.id,
    reviewed_at: new Date().toISOString()
  }).eq("id", review.data.id);
  if (decision === "approved") {
    await db.from("sama_site_products").update({
      publish_status: "approved"
    }).eq("generated_site_id", site.id).eq("safety_status", "approved").neq("publish_status", "archived");
    const update = {
      publication_review_status: "approved",
      publication_approved_at: new Date().toISOString(),
      publication_approved_by_account_id: actor.id,
      publication_notes: clean(payload.notes, 1200) || null
    };
    if (payload.publishNow !== false) {
      update.status = "published";
      update.published_at = new Date().toISOString();
    }
    const q = await db.from("sama_generated_sites").update(update).eq("id", site.id).select("*").single();
    if (q.error) throw q.error;
    await audit(q.data, actor, "admin_site_approved", "success", {
      publishNow: payload.publishNow !== false
    });
    return {
      ok: true,
      site: q.data
    };
  }
  const q = await db.from("sama_generated_sites").update({
    publication_review_status: decision,
    publication_notes: clean(payload.notes, 1200) || null,
    status: "draft",
    published_at: null
  }).eq("id", site.id).select("*").single();
  if (q.error) throw q.error;
  await audit(q.data, actor, "admin_site_review", "success", {
    decision
  });
  return {
    ok: true,
    site: q.data
  };
}
async function adminDashboard(req) {
  const actor = await requireAdmin(req);
  const [overview, media, reviews, domains, payments, proofs] = await Promise.all([
    db.from("sama_site_admin_overview_v13").select("*").order("updated_at", {
      ascending: false
    }).limit(200),
    db.from("sama_site_product_media").select("id,generated_site_id,site_product_id,original_filename,mime_type,file_size_bytes,moderation_status,created_at,private_path").in("moderation_status", [
      "pending_scan",
      "pending_review",
      "quarantined"
    ]).order("created_at").limit(100),
    db.from("sama_site_publication_reviews").select("id,generated_site_id,status,owner_message,requested_at").eq("status", "pending").order("requested_at").limit(100),
    db.from("sama_site_domains").select("*").not("status", "in", "(active,cancelled)").order("requested_at").limit(100),
    db.from("sama_site_subscription_payments").select("*").eq("status", "pending").order("submitted_at").limit(100),
    db.from("sama_site_payment_proofs").select("*").eq("status", "pending").order("created_at").limit(100)
  ]);
  for (const result of [
    overview,
    media,
    reviews,
    domains,
    payments,
    proofs
  ])if (result.error) throw result.error;
  return {
    ok: true,
    actor: {
      id: actor.id,
      role: actor.role
    },
    counts: {
      sites: overview.data?.length ?? 0,
      mediaPending: media.data?.length ?? 0,
      reviewsPending: reviews.data?.length ?? 0,
      domainsPending: domains.data?.length ?? 0,
      paymentsPending: payments.data?.length ?? 0,
      proofsPending: proofs.data?.length ?? 0
    },
    sites: overview.data ?? [],
    media: media.data ?? [],
    reviews: reviews.data ?? [],
    domains: domains.data ?? [],
    payments: payments.data ?? [],
    proofs: proofs.data ?? []
  };
}
async function ownerBootstrap(req) {
  const actor = await authenticate(req);
  let query = db.from("sama_generated_sites").select("id,site_id,brand_name,sector,objective,status,safety_status,publication_review_status,whatsapp_number,public_phone,site_trial_ends_at,site_subscription_status,site_subscription_amount_xof,custom_domain,domain_status,updated_at").order("updated_at", {
    ascending: false
  });
  if (actor.role !== "admin") query = query.eq("account_id", actor.id);
  const { data: sites, error } = await query;
  if (error) throw error;
  const siteIds = (sites ?? []).map((s)=>s.id);
  const [productsQ, mediaQ, methodsQ, domainsQ, subscriptionsQ, ordersQ] = await Promise.all([
    siteIds.length ? db.from("sama_site_products").select("*").in("generated_site_id", siteIds).order("created_at", {
      ascending: false
    }) : Promise.resolve({
      data: [],
      error: null
    }),
    siteIds.length ? db.from("sama_site_product_media").select("id,site_product_id,generated_site_id,public_url,original_filename,moderation_status,moderation_reason,is_primary,created_at").in("generated_site_id", siteIds).order("created_at", {
      ascending: false
    }) : Promise.resolve({
      data: [],
      error: null
    }),
    siteIds.length ? db.from("sama_site_payment_methods").select("*").in("generated_site_id", siteIds) : Promise.resolve({
      data: [],
      error: null
    }),
    siteIds.length ? db.from("sama_site_domains").select("*").in("generated_site_id", siteIds).order("requested_at", {
      ascending: false
    }) : Promise.resolve({
      data: [],
      error: null
    }),
    siteIds.length ? db.from("sama_site_subscriptions").select("*").in("generated_site_id", siteIds) : Promise.resolve({
      data: [],
      error: null
    }),
    siteIds.length ? db.from("sama_orders").select("id,generated_site_id,order_number,status,payment_status,delivery_status,customer_name,customer_phone,total_amount,created_at").in("generated_site_id", siteIds).order("created_at", {
      ascending: false
    }).limit(100) : Promise.resolve({
      data: [],
      error: null
    })
  ]);
  for (const result of [
    productsQ,
    mediaQ,
    methodsQ,
    domainsQ,
    subscriptionsQ,
    ordersQ
  ])if (result.error) throw result.error;
  const settings = await db.from("sama_site_platform_settings").select("trial_days,monthly_price_xof,wave_number,orange_money_number,card_enabled,domain_sales_enabled,default_domain_target").eq("singleton", true).single();
  if (settings.error) throw settings.error;
  return {
    ok: true,
    actor,
    settings: settings.data,
    sites: sites ?? [],
    products: productsQ.data ?? [],
    media: mediaQ.data ?? [],
    paymentMethods: methodsQ.data ?? [],
    domains: domainsQ.data ?? [],
    subscriptions: subscriptionsQ.data ?? [],
    orders: ordersQ.data ?? []
  };
}
async function createWaveSubscriptionCheckout(site, actor, months) {
  const settings = await db.from("sama_site_platform_settings").select("monthly_price_xof,wave_number").eq("singleton", true).single();
  if (settings.error) throw settings.error;
  const amount = settings.data.monthly_price_xof * months;
  if (!WAVE_API_KEY) return {
    ok: true,
    mode: "manual",
    amount,
    recipientNumber: settings.data.wave_number,
    instructions: `Envoyez ${amount.toLocaleString("fr-FR")} F CFA au ${settings.data.wave_number}, puis ajoutez la preuve de paiement.`
  };
  const clientReference = `SAMA-SITE-${site.site_id}-${Date.now()}`;
  const response = await fetch("https://api.wave.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${WAVE_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      amount: String(amount),
      currency: "XOF",
      client_reference: clientReference,
      success_url: `${PUBLIC_BASE}/?sitePayment=success&site=${encodeURIComponent(site.site_id)}`,
      error_url: `${PUBLIC_BASE}/?sitePayment=error&site=${encodeURIComponent(site.site_id)}`
    })
  });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) fail("Le paiement Wave automatique est momentanément indisponible.", "WAVE_CHECKOUT_FAILED", 503);
  const sub = await db.from("sama_site_subscriptions").select("id").eq("generated_site_id", site.id).single();
  if (sub.error) throw sub.error;
  await db.from("sama_site_subscription_payments").insert({
    site_subscription_id: sub.data.id,
    generated_site_id: site.id,
    account_id: actor.id,
    merchant_id: site.merchant_id,
    amount_xof: amount,
    requested_months: months,
    provider: "wave",
    transaction_reference: clientReference,
    status: "pending"
  });
  return {
    ok: true,
    mode: "wave_checkout",
    amount,
    checkoutId: payload.id,
    launchUrl: payload.wave_launch_url,
    clientReference
  };
}
async function handleJson(req, body) {
  const action = clean(body?.action, 80);
  const payload = body?.payload ?? body ?? {};
  if (action === "public_catalog") {
    const site = await publicSite(clean(payload.siteId, 80), clean(payload.host, 253));
    await publicRateLimit(req, site, "catalog", 60);
    return {
      ok: true,
      ...await getCatalog(site)
    };
  }
  if (action === "resolve_domain") {
    const site = await publicSite(undefined, clean(payload.host, 253));
    return {
      ok: true,
      siteId: site.site_id
    };
  }
  if (action === "create_public_order") return await createPublicOrder(req, payload);
  if (action === "bootstrap") return await ownerBootstrap(req);
  if (action === "admin_dashboard") return await adminDashboard(req);
  if (action === "admin_review_media") return await adminReviewMedia(req, payload);
  if (action === "admin_review_site") return await adminReviewSite(req, payload);
  const actor = await authenticate(req);
  const site = await siteForActor(clean(payload.siteId, 80), actor);
  if (action === "save_site_profile") {
    const whatsapp = digits(payload.whatsappNumber);
    if ([
      "vendre",
      "recevoir_des_commandes"
    ].includes(site.objective) && whatsapp.length < 9) fail("Un numéro WhatsApp valide est obligatoire pour recevoir les commandes.", "WHATSAPP_REQUIRED", 422);
    const updated = await db.from("sama_generated_sites").update({
      whatsapp_number: whatsapp ? `+${whatsapp}` : null,
      public_phone: digits(payload.publicPhone) ? `+${digits(payload.publicPhone)}` : null,
      checkout_enabled: payload.checkoutEnabled !== false,
      catalog_enabled: payload.catalogEnabled !== false
    }).eq("id", site.id).select("*").single();
    if (updated.error) throw updated.error;
    await db.from("sama_site_payment_methods").update({
      enabled: true,
      public_identifier: whatsapp ? `+${whatsapp}` : null,
      verification_status: whatsapp ? "verified" : "unverified"
    }).eq("generated_site_id", site.id).eq("method", "whatsapp_order");
    return {
      ok: true,
      site: updated.data
    };
  }
  if (action === "create_product") return {
    ok: true,
    product: await createProduct(site, actor, payload)
  };
  if (action === "generate_product_drafts") {
    const description = clean(payload.description || site.site_config?.siteMetadata?.description, 1200);
    assertSafeText(description, site.sector);
    const suggestions = suggestedProducts(site.sector, description).slice(0, Math.max(1, Math.min(6, Number(payload.count) || 3)));
    const created = [];
    for (const suggestion of suggestions)created.push(await createProduct(site, actor, {
      ...suggestion,
      price: 0,
      stock: 0,
      trackStock: false
    }, true));
    await db.from("sama_site_ai_jobs").insert({
      generated_site_id: site.id,
      account_id: actor.id,
      merchant_id: site.merchant_id,
      job_type: "product_suggestions",
      status: "completed",
      provider: "samabusiness_rules_v13",
      prompt: description || site.sector,
      input_data: {
        sector: site.sector
      },
      output_data: {
        siteProductIds: created.map((p)=>p.id)
      },
      safety_status: "approved",
      completed_at: new Date().toISOString()
    });
    return {
      ok: true,
      products: created,
      message: "Idées produit créées en brouillon. Ajoutez les prix et les photos avant validation."
    };
  }
  if (action === "update_product") {
    const siteProductId = clean(payload.siteProductId, 80);
    const { data: link } = await db.from("sama_site_products").select("*").eq("id", siteProductId).eq("generated_site_id", site.id).maybeSingle();
    if (!link) fail("Produit introuvable.", "PRODUCT_NOT_FOUND", 404);
    assertSafeText(payload.name, payload.description, payload.category);
    const productUpdate = await db.from("sama_products").update({
      name: clean(payload.name, 160) || link.display_name,
      category: clean(payload.category, 120) || null,
      sale_price: money(payload.price),
      stock_quantity: Number.isFinite(Number(payload.stock)) ? Math.max(0, Number(payload.stock)) : 0,
      track_stock: payload.trackStock !== false,
      notes: clean(payload.description, 1200) || null
    }).eq("id", link.product_id);
    if (productUpdate.error) throw productUpdate.error;
    const update = await db.from("sama_site_products").update({
      display_name: clean(payload.name, 160) || link.display_name,
      short_description: clean(payload.description, 260) || null,
      long_description: clean(payload.description, 1200) || null,
      category: clean(payload.category, 120) || null,
      display_price: money(payload.price),
      publish_status: "draft",
      safety_status: "pending_review"
    }).eq("id", link.id).select("*").single();
    if (update.error) throw update.error;
    return {
      ok: true,
      product: update.data
    };
  }
  if (action === "submit_site_review") {
    const { count: productCount } = await db.from("sama_site_products").select("id", {
      count: "exact",
      head: true
    }).eq("generated_site_id", site.id).neq("publish_status", "archived");
    const { count: mediaCount } = await db.from("sama_site_product_media").select("id", {
      count: "exact",
      head: true
    }).eq("generated_site_id", site.id).in("moderation_status", [
      "pending_scan",
      "pending_review",
      "approved"
    ]);
    if ([
      "vendre",
      "recevoir_des_commandes"
    ].includes(site.objective) && digits(site.whatsapp_number).length < 9) fail("Ajoutez votre numéro WhatsApp avant d’envoyer le site.", "WHATSAPP_REQUIRED", 422);
    if ([
      "vendre",
      "recevoir_des_commandes"
    ].includes(site.objective) && (productCount ?? 0) < 1) fail("Ajoutez au moins un produit.", "PRODUCT_REQUIRED", 422);
    if ((productCount ?? 0) > 0 && (mediaCount ?? 0) < 1) fail("Ajoutez au moins une photo produit.", "PRODUCT_IMAGE_REQUIRED", 422);
    await db.from("sama_site_products").update({
      publish_status: "pending_review"
    }).eq("generated_site_id", site.id).eq("publish_status", "draft");
    const review = await db.from("sama_site_publication_reviews").insert({
      generated_site_id: site.id,
      requested_by_account_id: actor.id,
      status: "pending",
      owner_message: clean(payload.message, 1200) || null,
      checklist: {
        whatsapp: true,
        productCount: productCount ?? 0,
        mediaCount: mediaCount ?? 0,
        safety: site.safety_status
      }
    }).select("*").single();
    if (review.error) throw review.error;
    const updated = await db.from("sama_generated_sites").update({
      publication_review_status: "pending",
      submission_requested_at: new Date().toISOString(),
      status: "draft",
      published_at: null
    }).eq("id", site.id).select("*").single();
    if (updated.error) throw updated.error;
    await audit(updated.data, actor, "site_review_requested", "success", {
      reviewId: review.data.id
    });
    return {
      ok: true,
      review: review.data,
      site: updated.data,
      message: "Site envoyé pour validation. Vous pouvez continuer à l’apercevoir en privé."
    };
  }
  if (action === "request_domain") {
    const domainName = clean(payload.domainName, 253).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9][a-z0-9.-]{2,252}$/.test(domainName) || !domainName.includes(".")) fail("Nom de domaine invalide.", "INVALID_DOMAIN", 422);
    const row = await db.from("sama_site_domains").insert({
      generated_site_id: site.id,
      domain_name: domainName,
      ownership_mode: payload.ownershipMode === "external" ? "external" : "platform_resold",
      status: "requested",
      registration_years: Math.max(1, Math.min(10, Number(payload.registrationYears) || 1)),
      requested_by_account_id: actor.id,
      dns_target: CF_SAAS_TARGET
    }).select("*").single();
    if (row.error) {
      if (row.error.code === "23505") fail("Ce domaine est déjà demandé.", "DOMAIN_ALREADY_EXISTS", 409);
      throw row.error;
    }
    return {
      ok: true,
      domain: row.data
    };
  }
  if (action === "save_payment_method") {
    const method = clean(payload.method, 40);
    if (![
      "whatsapp_order",
      "wave",
      "orange_money",
      "free_money",
      "card",
      "cash_on_delivery"
    ].includes(method)) fail("Moyen de paiement invalide.", "INVALID_PAYMENT_METHOD", 422);
    const identifier = clean(payload.publicIdentifier, 120) || null;
    const update = await db.from("sama_site_payment_methods").upsert({
      generated_site_id: site.id,
      method,
      enabled: Boolean(payload.enabled),
      public_identifier: identifier,
      provider: clean(payload.provider, 80) || method,
      verification_status: method === "whatsapp_order" || method === "cash_on_delivery" ? "verified" : "pending",
      config_public: typeof payload.configPublic === "object" && payload.configPublic ? payload.configPublic : {}
    }, {
      onConflict: "generated_site_id,method"
    }).select("*").single();
    if (update.error) throw update.error;
    return {
      ok: true,
      paymentMethod: update.data
    };
  }
  if (action === "create_subscription_checkout") return await createWaveSubscriptionCheckout(site, actor, Math.max(1, Math.min(24, Number(payload.months) || 1)));
  if (action === "submit_manual_subscription_payment") {
    const settings = await db.from("sama_site_platform_settings").select("monthly_price_xof,wave_number,orange_money_number").eq("singleton", true).single();
    if (settings.error) throw settings.error;
    const months = Math.max(1, Math.min(24, Number(payload.months) || 1));
    const provider = [
      "wave",
      "orange_money",
      "card",
      "cash",
      "other"
    ].includes(clean(payload.provider, 30)) ? clean(payload.provider, 30) : "wave";
    const subscription = await db.from("sama_site_subscriptions").select("id").eq("generated_site_id", site.id).single();
    if (subscription.error) throw subscription.error;
    const payment = await db.from("sama_site_subscription_payments").insert({
      site_subscription_id: subscription.data.id,
      generated_site_id: site.id,
      account_id: actor.id,
      merchant_id: site.merchant_id,
      amount_xof: settings.data.monthly_price_xof * months,
      requested_months: months,
      provider,
      recipient_number: provider === "orange_money" ? settings.data.orange_money_number : settings.data.wave_number,
      transaction_reference: clean(payload.transactionReference, 160) || null,
      status: "pending"
    }).select("*").single();
    if (payment.error) throw payment.error;
    return {
      ok: true,
      payment: payment.data
    };
  }
  if (action === "admin_review_subscription_payment") {
    if (actor.role !== "admin") fail("Accès administrateur requis.", "ADMIN_REQUIRED", 403);
    const paymentId = clean(payload.paymentId, 80);
    const decision = clean(payload.decision, 30);
    const paymentQ = await db.from("sama_site_subscription_payments").select("*").eq("id", paymentId).single();
    if (paymentQ.error) throw paymentQ.error;
    const payment = paymentQ.data;
    const updatePayment = await db.from("sama_site_subscription_payments").update({
      status: decision === "approved" ? "approved" : "rejected",
      reviewed_by_account_id: actor.id,
      review_note: clean(payload.notes, 800) || null,
      reviewed_at: new Date().toISOString()
    }).eq("id", payment.id);
    if (updatePayment.error) throw updatePayment.error;
    if (decision === "approved") {
      const subQ = await db.from("sama_site_subscriptions").select("*").eq("id", payment.site_subscription_id).single();
      if (subQ.error) throw subQ.error;
      const base = subQ.data.current_period_end && new Date(subQ.data.current_period_end).getTime() > Date.now() ? new Date(subQ.data.current_period_end) : new Date();
      base.setUTCMonth(base.getUTCMonth() + payment.requested_months);
      const subUpdate = await db.from("sama_site_subscriptions").update({
        status: "active",
        plan: "site_pro",
        current_period_start: new Date().toISOString(),
        current_period_end: base.toISOString(),
        grace_ends_at: new Date(base.getTime() + 3 * 86400000).toISOString()
      }).eq("id", payment.site_subscription_id).select("*").single();
      if (subUpdate.error) throw subUpdate.error;
      return {
        ok: true,
        paymentStatus: "approved",
        subscription: subUpdate.data
      };
    }
    return {
      ok: true,
      paymentStatus: "rejected"
    };
  }
  if (action === "admin_domain_quote") {
    if (actor.role !== "admin") fail("Accès administrateur requis.", "ADMIN_REQUIRED", 403);
    const q = await db.from("sama_site_domains").update({
      status: "quoted",
      quoted_price_xof: money(payload.priceXof),
      admin_notes: clean(payload.notes, 1000) || null,
      approved_by_account_id: actor.id
    }).eq("id", clean(payload.domainId, 80)).select("*").single();
    if (q.error) throw q.error;
    return {
      ok: true,
      domain: q.data
    };
  }
  if (action === "admin_provision_domain") {
    if (actor.role !== "admin") fail("Accès administrateur requis.", "ADMIN_REQUIRED", 403);
    if (!CF_API_TOKEN || !CF_ZONE_ID) fail("Les secrets Cloudflare for SaaS ne sont pas encore configurés.", "CLOUDFLARE_NOT_CONFIGURED", 409);
    const domainQ = await db.from("sama_site_domains").select("*").eq("id", clean(payload.domainId, 80)).single();
    if (domainQ.error) throw domainQ.error;
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${CF_API_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        hostname: domainQ.data.domain_name,
        ssl: {
          method: "txt",
          type: "dv"
        },
        custom_metadata: {
          site_id: site.site_id
        }
      })
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result?.success) fail("Cloudflare n’a pas pu créer ce domaine.", "CLOUDFLARE_PROVISION_FAILED", 502);
    const item = result.result;
    const updated = await db.from("sama_site_domains").update({
      status: item.status === "active" && item.ssl?.status === "active" ? "active" : "dns_verification",
      cloudflare_zone_id: CF_ZONE_ID,
      cloudflare_custom_hostname_id: item.id,
      dns_target: CF_SAAS_TARGET,
      ownership_verification: {
        ownership: item.ownership_verification,
        ssl: item.ssl?.validation_records ?? []
      },
      ssl_status: item.ssl?.status === "active" ? "active" : "validating",
      activated_at: item.status === "active" && item.ssl?.status === "active" ? new Date().toISOString() : null
    }).eq("id", domainQ.data.id).select("*").single();
    if (updated.error) throw updated.error;
    if (updated.data.status === "active") await db.from("sama_generated_sites").update({
      custom_domain: updated.data.domain_name,
      domain_status: "actif",
      ssl_status: "actif"
    }).eq("id", domainQ.data.generated_site_id);
    return {
      ok: true,
      domain: updated.data
    };
  }
  fail("Action inconnue.", "UNKNOWN_ACTION", 404);
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: cors(origin)
  });
  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      if (url.pathname.endsWith("/health") || !url.searchParams.get("action")) {
        return json({
          ok: true,
          service: "samabusiness-site-commerce-v13",
          version: VERSION,
          features: [
            "catalog",
            "moderated-media",
            "whatsapp-orders",
            "subscriptions",
            "domains",
            "admin-review"
          ]
        }, 200, origin);
      }
      const action = url.searchParams.get("action");
      const payload = Object.fromEntries(url.searchParams.entries());
      return json(await handleJson(req, {
        action,
        payload
      }), 200, origin);
    }
    if (req.method !== "POST") return json({
      ok: false,
      error: "Method Not Allowed"
    }, 405, origin);
    const type = (req.headers.get("content-type") || "").toLowerCase();
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = clean(form.get("action"), 80);
      if (action === "upload_product_image") return json(await uploadProductImage(req, form), 200, origin);
      if (action === "upload_payment_proof") return json(await uploadPaymentProof(req, form), 200, origin);
      fail("Action d’upload inconnue.", "UNKNOWN_UPLOAD_ACTION", 404);
    }
    const body = await req.json().catch(()=>({}));
    return json(await handleJson(req, body), 200, origin);
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = clean(error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"), 80);
    const message = status >= 500 ? "Service momentanément indisponible." : clean(error?.message || "Demande invalide.", 500);
    console.error("samabusiness-site-commerce-v13", status, code, status >= 500 ? error?.message : message);
    return json({
      ok: false,
      error: message,
      code
    }, status, origin);
  }
});
