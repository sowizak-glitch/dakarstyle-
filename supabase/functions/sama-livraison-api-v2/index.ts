import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const U = Deno.env.get("SUPABASE_URL");
const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
const K = raw ? JSON.parse(raw).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(U, K, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const OLD = `${U}/functions/v1/sama-livraison-api`;
const PUBLIC_APP = "https://sama-livraison.vercel.app/";
const ORIGINS = new Set([
  `https://${new URL(U).host}`,
  PUBLIC_APP.slice(0, -1),
  "https://livraison.dakarstyle.com",
  "https://dakarstyle.com"
]);
const originOk = (o)=>!o || ORIGINS.has(o) || /^https:\/\/sama-livraison-[a-z0-9-]+\.vercel\.app$/i.test(o);
const cors = (o)=>({
    "Access-Control-Allow-Origin": o && originOk(o) ? o : PUBLIC_APP.slice(0, -1),
    "Access-Control-Allow-Headers": "content-type,apikey,x-sama-session",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  });
const reply = (req, body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req.headers.get("origin")),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
const fail = (message, status = 400)=>{
  const e = new Error(message);
  e.status = status;
  throw e;
};
const clean = (v, n = 500)=>String(v ?? "").trim().replace(/\s+/g, " ").slice(0, n);
const amount = (v)=>{
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n) || n < 0 || n > 999999999999) fail("Montant invalide.");
  return n;
};
const tokenOf = (r)=>r.headers.get("x-sama-session") || "";
async function oldCall(req, body) {
  const headers = {
    "Content-Type": "application/json"
  };
  const token = tokenOf(req);
  if (token) headers["x-sama-session"] = token;
  const r = await fetch(OLD, {
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
  if (!r.ok) fail(j.error || "Action impossible.", r.status);
  return j;
}
async function context(req) {
  const j = await oldCall(req, {
    action: "bootstrap"
  });
  if (!j?.merchant?.id) fail("Session invalide.", 401);
  return j;
}
async function enrichBootstrap(req, j) {
  const mid = j.merchant.id;
  const [settings, zones, notifications] = await Promise.all([
    db.from("liv_settings").select("*").eq("merchant_id", mid).maybeSingle(),
    db.from("liv_zones").select("*").eq("merchant_id", mid).order("active", {
      ascending: false
    }).order("name"),
    j.mode === "driver" ? db.from("liv_notifications").select("*").eq("merchant_id", mid).or(`driver_id.eq.${j.driver.id},audience.eq.all`).order("created_at", {
      ascending: false
    }).limit(80) : db.from("liv_notifications").select("*").eq("merchant_id", mid).in("audience", [
      "manager",
      "all"
    ]).order("created_at", {
      ascending: false
    }).limit(100)
  ]);
  for (const x of [
    settings,
    zones,
    notifications
  ])if (x.error) throw x.error;
  return {
    ...j,
    settings: settings.data || {
      merchant_id: mid,
      default_payment_method: "cash",
      auto_assign: false,
      require_pickup_photo: false,
      require_delivery_photo: true,
      allow_code_confirmation: true,
      notifications_enabled: true,
      notify_unassigned: true,
      notify_exception: true,
      notify_cash_variance: true,
      notify_delivered: true,
      language_mode: "both"
    },
    zones: zones.data || [],
    notifications: notifications.data || []
  };
}
function manager(c) {
  if (c.mode !== "manager") fail("Action réservée au gestionnaire.", 403);
}
async function saveSettings(req, b, c) {
  manager(c);
  const row = {
    merchant_id: c.merchant.id,
    support_phone: clean(b.support_phone, 32) || null,
    default_pickup_address: clean(b.default_pickup_address, 360) || null,
    default_pickup_area: clean(b.default_pickup_area, 120) || null,
    default_payment_method: [
      "cash",
      "wave",
      "orange_money",
      "free_money",
      "prepaid",
      "mixed",
      "other"
    ].includes(b.default_payment_method) ? b.default_payment_method : "cash",
    auto_assign: !!b.auto_assign,
    require_pickup_photo: !!b.require_pickup_photo,
    require_delivery_photo: b.require_delivery_photo !== false,
    allow_code_confirmation: b.allow_code_confirmation !== false,
    notifications_enabled: b.notifications_enabled !== false,
    notify_unassigned: b.notify_unassigned !== false,
    notify_exception: b.notify_exception !== false,
    notify_cash_variance: b.notify_cash_variance !== false,
    notify_delivered: b.notify_delivered !== false,
    language_mode: [
      "fr",
      "wo",
      "both"
    ].includes(b.language_mode) ? b.language_mode : "both",
    updated_at: new Date().toISOString()
  };
  const q = await db.from("liv_settings").upsert(row, {
    onConflict: "merchant_id"
  }).select().single();
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    settings: q.data
  });
}
async function saveZone(req, b, c) {
  manager(c);
  const name = clean(b.name, 100);
  if (name.length < 2) fail("Nom de zone requis.");
  const row = {
    merchant_id: c.merchant.id,
    name,
    aliases: Array.isArray(b.aliases) ? b.aliases.map((x)=>clean(x, 80)).filter(Boolean).slice(0, 20) : clean(b.aliases, 400).split(",").map((x)=>x.trim()).filter(Boolean).slice(0, 20),
    base_fee: amount(b.base_fee),
    eta_min: Math.max(0, Math.min(1440, Math.round(Number(b.eta_min) || 30))),
    eta_max: Math.max(0, Math.min(2880, Math.round(Number(b.eta_max) || 120))),
    active: b.active !== false,
    color: /^#[0-9a-f]{6}$/i.test(String(b.color || "")) ? b.color : "#087a45",
    updated_at: new Date().toISOString()
  };
  if (row.eta_max < row.eta_min) row.eta_max = row.eta_min;
  let q = b.id ? await db.from("liv_zones").update(row).eq("id", b.id).eq("merchant_id", c.merchant.id).select().single() : await db.from("liv_zones").insert(row).select().single();
  if (q.error) {
    if (q.error.code === "23505") fail("Cette zone existe déjà.", 409);
    throw q.error;
  }
  return reply(req, {
    ok: true,
    zone: q.data
  });
}
async function disableZone(req, b, c) {
  manager(c);
  const q = await db.from("liv_zones").update({
    active: false,
    updated_at: new Date().toISOString()
  }).eq("id", b.id).eq("merchant_id", c.merchant.id).select().maybeSingle();
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    zone: q.data
  });
}
async function updateDelivery(req, b, c) {
  manager(c);
  const allowed = [
    "recipient_name",
    "recipient_phone",
    "delivery_address",
    "delivery_area",
    "landmark",
    "pickup_address",
    "pickup_area",
    "package_description",
    "package_size",
    "weight_kg",
    "pieces",
    "amount_to_collect",
    "delivery_fee",
    "payment_expected",
    "priority",
    "assigned_driver_id",
    "scheduled_for",
    "recipient_notes",
    "admin_note",
    "return_required",
    "return_reason",
    "zone_id",
    "proof_pickup_required",
    "proof_delivery_required",
    "provider"
  ];
  const p = {
    updated_at: new Date().toISOString()
  };
  for (const k of allowed)if (Object.prototype.hasOwnProperty.call(b, k)) p[k] = b[k] === "" ? null : b[k];
  if (p.provider) p.provider = p.provider === "external" ? "external" : "own_fleet";
  if (p.payment_expected && ![
    'cash',
    'wave',
    'orange_money',
    'free_money',
    'prepaid',
    'mixed',
    'other'
  ].includes(p.payment_expected)) p.payment_expected = 'cash';
  if (p.package_size && ![
    'document',
    'small',
    'standard',
    'large',
    'fragile'
  ].includes(p.package_size)) p.package_size = 'standard';
  if (p.priority) p.priority = p.priority === 'urgent' ? 'urgent' : 'normal';
  for (const k of [
    'amount_to_collect',
    'delivery_fee'
  ])if (k in p) p[k] = amount(p[k]);
  if ('pieces' in p) p.pieces = Math.max(1, Math.min(999, Math.round(Number(p.pieces) || 1)));
  if ('weight_kg' in p && p.weight_kg !== null) p.weight_kg = Math.max(0, Number(p.weight_kg) || 0);
  const q = await db.from("liv_deliveries").update(p).eq("id", b.id).eq("merchant_id", c.merchant.id).select().single();
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    delivery: q.data
  });
}
async function updateDriver(req, b, c) {
  manager(c);
  const p = {
    updated_at: new Date().toISOString()
  };
  if ('name' in b) p.name = clean(b.name, 120);
  if ('vehicle_type' in b) p.vehicle_type = [
    'motorcycle',
    'car',
    'bicycle',
    'foot',
    'cargo',
    'other'
  ].includes(b.vehicle_type) ? b.vehicle_type : 'other';
  if ('vehicle_plate' in b) p.vehicle_plate = clean(b.vehicle_plate, 40) || null;
  if ('availability_status' in b) p.availability_status = [
    'offline',
    'available',
    'busy',
    'paused'
  ].includes(b.availability_status) ? b.availability_status : 'offline';
  if ('is_active' in b) p.is_active = !!b.is_active;
  if ('language_preference' in b) p.language_preference = [
    'fr',
    'wo',
    'both'
  ].includes(b.language_preference) ? b.language_preference : 'both';
  if ('emergency_contact' in b) p.emergency_contact = clean(b.emergency_contact, 40) || null;
  const q = await db.from("liv_drivers").update(p).eq("id", b.id).eq("merchant_id", c.merchant.id).select("id,name,display_phone,vehicle_type,vehicle_plate,availability_status,is_active,current_lat,current_lng,last_location_at,cash_on_hand,language_preference,emergency_contact").single();
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    driver: q.data
  });
}
async function markRead(req, b, c) {
  let q;
  if (c.mode === "manager") q = await db.from("liv_notifications").update({
    read_at: new Date().toISOString()
  }).eq("merchant_id", c.merchant.id).in("audience", [
    "manager",
    "all"
  ]).is("read_at", null);
  else q = await db.from("liv_notifications").update({
    read_at: new Date().toISOString()
  }).eq("merchant_id", c.merchant.id).or(`driver_id.eq.${c.driver.id},audience.eq.all`).is("read_at", null);
  if (q.error) throw q.error;
  return reply(req, {
    ok: true
  });
}
async function reconcile(req, b, c) {
  manager(c);
  const q = await db.from("liv_payment_events").update({
    reconciled_at: b.reconciled === false ? null : new Date().toISOString()
  }).eq("id", b.id).eq("merchant_id", c.merchant.id).select().single();
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    payment: q.data
  });
}
async function createDelivery(req, b, c) {
  manager(c);
  const d = {
    ...b.delivery || b
  };
  d.provider = d.provider === "external" ? "external" : "own_fleet";
  if (d.paymentExpected === 'free_money') d.paymentExpected = 'other';
  const j = await oldCall(req, {
    ...b,
    action: "create_delivery",
    delivery: d
  });
  const extra = {
    package_size: [
      'document',
      'small',
      'standard',
      'large',
      'fragile'
    ].includes(d.packageSize) ? d.packageSize : 'standard',
    weight_kg: d.weightKg === '' || d.weightKg == null ? null : Math.max(0, Number(d.weightKg) || 0),
    pieces: Math.max(1, Math.min(999, Math.round(Number(d.pieces) || 1))),
    pickup_contact_name: clean(d.pickupContactName, 120) || null,
    pickup_contact_phone: clean(d.pickupContactPhone, 32) || null,
    return_required: !!d.returnRequired,
    zone_id: d.zoneId || null,
    admin_note: clean(d.adminNote, 1000) || null,
    proof_pickup_required: !!d.proofPickupRequired,
    proof_delivery_required: d.proofDeliveryRequired !== false,
    provider: d.provider
  };
  if ((b.delivery || b).paymentExpected === 'free_money') extra["payment_expected"] = 'free_money';
  const q = await db.from("liv_deliveries").update(extra).eq("id", j.delivery.id).eq("merchant_id", c.merchant.id).select().single();
  if (q.error) throw q.error;
  j.delivery = q.data;
  j.trackingUrl = PUBLIC_APP + `?track=${q.data.public_token}`;
  return reply(req, j);
}
async function recordPayment(req, b, c) {
  if (b.method !== "free_money") return reply(req, await oldCall(req, {
    ...b,
    action: "record_payment"
  }));
  const q = await db.rpc("liv_record_payment", {
    p_merchant_id: c.merchant.id,
    p_delivery_id: b.deliveryId,
    p_driver_id: c.mode === "driver" ? c.driver.id : b.driverId || null,
    p_amount: amount(b.amount),
    p_method: "free_money",
    p_reference: clean(b.reference, 160) || null
  });
  if (q.error) throw q.error;
  return reply(req, {
    ok: true,
    delivery: q.data
  });
}
Deno.serve(async (req)=>{
  const o = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: cors(o)
  });
  if (!originOk(o)) return reply(req, {
    ok: false,
    error: "Origin non autorisée."
  }, 403);
  try {
    if (req.method === "GET") return reply(req, {
      ok: true,
      service: "sama-livraison-api-v2",
      version: "2.0.0"
    });
    const b = await req.json();
    const action = String(b.action || "");
    if ([
      "manager_register",
      "manager_login",
      "driver_login",
      "track"
    ].includes(action)) {
      const j = await oldCall(req, b);
      if (action === "track") return reply(req, j);
      return reply(req, j);
    }
    if (action === "bootstrap") {
      const j = await oldCall(req, b);
      return reply(req, await enrichBootstrap(req, j));
    }
    const c = await context(req);
    if (action === "save_settings") return saveSettings(req, b, c);
    if (action === "save_zone") return saveZone(req, b, c);
    if (action === "disable_zone") return disableZone(req, b, c);
    if (action === "update_delivery") return updateDelivery(req, b, c);
    if (action === "update_driver") return updateDriver(req, b, c);
    if (action === "mark_notifications_read") return markRead(req, b, c);
    if (action === "reconcile_payment") return reconcile(req, b, c);
    if (action === "create_delivery") return createDelivery(req, b, c);
    if (action === "record_payment") return recordPayment(req, b, c);
    const safe = {
      ...b,
      action
    };
    if (action === "create_driver" && safe.vehicleType === "yango") safe.vehicleType = "other";
    if (action === "create_delivery" && safe.provider === "yango") safe.provider = "external";
    const j = await oldCall(req, safe);
    if (j?.trackingUrl) j.trackingUrl = PUBLIC_APP + `?track=${j.delivery?.public_token || ""}`;
    return reply(req, j);
  } catch (err) {
    const e = err;
    console.error("livraison-v2", e.message);
    return reply(req, {
      ok: false,
      error: e.status && e.status < 500 ? e.message : "Une erreur technique est survenue."
    }, e.status || 500);
  }
});
