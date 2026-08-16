import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const U = Deno.env.get("SUPABASE_URL"), B = Deno.env.get("SUPABASE_SECRET_KEYS"), K = B ? JSON.parse(B).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(U, K, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}), enc = new TextEncoder(), BUCKET = "sama-livraison-proofs";
const ORIGINS = new Set([
  `https://${new URL(U).host}`,
  "https://sama-cahier-ia.vercel.app",
  "https://sama-livraison.vercel.app"
]);
const allowed = (o)=>!o || ORIGINS.has(o) || /^https:\/\/sama-(livraison|delivery)-[a-z0-9-]+\.vercel\.app$/i.test(o);
const cors = (o)=>({
    "Access-Control-Allow-Origin": o && allowed(o) ? o : `https://${new URL(U).host}`,
    "Access-Control-Allow-Headers": "content-type,apikey,x-sama-session",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  });
const out = (r, b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...cors(r.headers.get("origin")),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
const bad = (m, s = 400)=>{
  const e = new Error(m);
  e.status = s;
  throw e;
};
const b64 = (a)=>{
  let x = "";
  for (const n of a)x += String.fromCharCode(n);
  return btoa(x).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const rnd = (n)=>{
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
};
const sha = async (s)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
const clean = (v, n = 240)=>String(v ?? "").trim().replace(/\s+/g, " ").slice(0, n);
const cash = (v, n = "Montant")=>{
  const x = Math.round(Number(v ?? 0));
  if (!Number.isFinite(x) || x < 0 || x > 999999999999) bad(`${n} invalide.`);
  return x;
};
const phone = (v)=>{
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("7")) d = "221" + d;
  if (d.length < 10 || d.length > 15) bad("Numéro invalide.");
  return {
    n: d,
    d: "+" + d
  };
};
const code = ()=>{
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = rnd(6);
  return [
    ...r
  ].map((x)=>a[x % a.length]).join("");
};
async function ensureCode(m) {
  if (m.delivery_workspace_code) return m;
  for(let i = 0; i < 8; i++){
    const c = code(), q = await db.from("sama_merchants").update({
      delivery_workspace_code: c,
      updated_at: new Date().toISOString()
    }).eq("id", m.id).is("delivery_workspace_code", null).select("id,name,phone,currency,locale,timezone,delivery_workspace_code").maybeSingle();
    if (!q.error && q.data) return q.data;
    if (q.error && q.error.code !== "23505") throw q.error;
    const z = await db.from("sama_merchants").select("id,name,phone,currency,locale,timezone,delivery_workspace_code").eq("id", m.id).single();
    if (z.data?.delivery_workspace_code) return z.data;
  }
  bad("Code équipe indisponible.", 500);
}
async function proxyAuth(action, body) {
  const r = await fetch(`${U}/functions/v1/sama-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...body,
      action
    })
  });
  const j = await r.json();
  if (!r.ok) bad(j.error || "Connexion impossible.", r.status);
  j.merchant = await ensureCode(j.merchant);
  return j;
}
async function ctx(req) {
  const t = req.headers.get("x-sama-session") || "";
  if (t.startsWith("sama_")) {
    const h = await sha(t), s = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at").eq("token_hash", h).maybeSingle();
    if (s.error) throw s.error;
    if (!s.data || s.data.revoked_at || new Date(s.data.expires_at) < new Date()) bad("Session expirée.", 401);
    const a = await db.from("sama_accounts").select("id,display_identifier,is_active,suspended_at").eq("id", s.data.account_id).single();
    if (a.error) throw a.error;
    if (!a.data.is_active || a.data.suspended_at) bad("Compte désactivé.", 403);
    const m = await db.from("sama_merchants").select("id,name,phone,currency,locale,timezone,delivery_workspace_code").eq("account_id", a.data.id).single();
    if (m.error) throw m.error;
    return {
      kind: "manager",
      sid: s.data.id,
      account: a.data,
      merchant: await ensureCode(m.data)
    };
  }
  if (t.startsWith("livd_")) {
    const h = await sha(t), s = await db.from("liv_driver_sessions").select("id,driver_id,expires_at,revoked_at").eq("token_hash", h).maybeSingle();
    if (s.error) throw s.error;
    if (!s.data || s.data.revoked_at || new Date(s.data.expires_at) < new Date()) bad("Session livreur expirée.", 401);
    const d = await db.from("liv_drivers").select("id,merchant_id,name,display_phone,vehicle_type,vehicle_plate,availability_status,is_active,current_lat,current_lng,last_location_at,cash_on_hand,language_preference").eq("id", s.data.driver_id).single();
    if (d.error) throw d.error;
    if (!d.data.is_active) bad("Accès livreur désactivé.", 403);
    const m = await db.from("sama_merchants").select("id,name,phone,currency,locale,timezone,delivery_workspace_code").eq("id", d.data.merchant_id).single();
    if (m.error) throw m.error;
    return {
      kind: "driver",
      sid: s.data.id,
      driver: d.data,
      merchant: m.data
    };
  }
  bad("Connexion requise.", 401);
}
const manager = (c)=>{
  if (c.kind !== "manager") bad("Action réservée au gestionnaire.", 403);
};
async function driverLogin(r, b) {
  const p = phone(b.phone), v = await db.rpc("liv_verify_driver", {
    p_workspace_code: clean(b.workspaceCode, 12).toUpperCase(),
    p_phone: p.n,
    p_pin: String(b.pin || "")
  });
  if (v.error) throw v.error;
  if (!v.data?.length) bad("Code équipe, téléphone ou PIN incorrect.", 401);
  const d = v.data[0], raw = "livd_" + b64(rnd(48)), h = await sha(raw), exp = new Date(Date.now() + 30 * 86400000).toISOString();
  const s = await db.from("liv_driver_sessions").insert({
    driver_id: d.driver_id,
    token_hash: h,
    expires_at: exp
  });
  if (s.error) throw s.error;
  await db.from("liv_drivers").update({
    availability_status: d.availability_status === "offline" ? "available" : d.availability_status,
    updated_at: new Date().toISOString()
  }).eq("id", d.driver_id);
  return out(r, {
    ok: true,
    token: raw,
    expiresAt: exp,
    driver: {
      id: d.driver_id,
      name: d.driver_name,
      display_phone: d.display_phone,
      vehicle_type: d.vehicle_type,
      availability_status: d.availability_status === "offline" ? "available" : d.availability_status
    },
    merchant: {
      id: d.merchant_id,
      name: d.merchant_name,
      delivery_workspace_code: d.workspace_code
    }
  });
}
const sel = "id,merchant_id,client_ref,delivery_number,recipient_name,recipient_phone,delivery_address,delivery_area,landmark,delivery_lat,delivery_lng,pickup_address,pickup_area,pickup_lat,pickup_lng,package_description,package_value,amount_to_collect,payment_received,amount_remaining,delivery_fee,payment_expected,payment_status,provider,external_reference,status,priority,assigned_driver_id,delivery_code,public_token,scheduled_for,picked_up_at,delivered_at,failed_at,recipient_notes,failure_reason,exception_flag,exception_code,created_at,updated_at";
async function bootstrap(r, c) {
  if (c.kind === "manager") {
    const since = new Date(Date.now() - 90 * 86400000).toISOString(), [d, l, s, p] = await Promise.all([
      db.from("liv_drivers").select("id,name,display_phone,vehicle_type,vehicle_plate,availability_status,is_active,current_lat,current_lng,last_location_at,cash_on_hand,language_preference,created_at").eq("merchant_id", c.merchant.id).order("name"),
      db.from("liv_deliveries").select(sel).eq("merchant_id", c.merchant.id).gte("created_at", since).order("created_at", {
        ascending: false
      }).limit(1000),
      db.from("liv_cash_shifts").select("*").eq("merchant_id", c.merchant.id).order("opened_at", {
        ascending: false
      }).limit(200),
      db.from("liv_payment_events").select("id,delivery_id,driver_id,amount,method,reference,status,collected_at,reconciled_at").eq("merchant_id", c.merchant.id).order("collected_at", {
        ascending: false
      }).limit(1000)
    ]);
    for (const x of [
      d,
      l,
      s,
      p
    ])if (x.error) throw x.error;
    return out(r, {
      ok: true,
      mode: "manager",
      merchant: c.merchant,
      account: c.account,
      drivers: d.data || [],
      deliveries: l.data || [],
      shifts: s.data || [],
      payments: p.data || []
    });
  }
  const since = new Date(Date.now() - 14 * 86400000).toISOString(), [l, s, p] = await Promise.all([
    db.from("liv_deliveries").select(sel).eq("merchant_id", c.merchant.id).eq("assigned_driver_id", c.driver.id).gte("created_at", since).order("created_at", {
      ascending: false
    }).limit(300),
    db.from("liv_cash_shifts").select("*").eq("driver_id", c.driver.id).eq("status", "open").maybeSingle(),
    db.from("liv_payment_events").select("id,delivery_id,amount,method,reference,status,collected_at,reconciled_at").eq("driver_id", c.driver.id).order("collected_at", {
      ascending: false
    }).limit(300)
  ]);
  for (const x of [
    l,
    s,
    p
  ])if (x.error) throw x.error;
  return out(r, {
    ok: true,
    mode: "driver",
    merchant: c.merchant,
    driver: c.driver,
    deliveries: l.data || [],
    shift: s.data || null,
    payments: p.data || []
  });
}
async function createDriver(r, b, c) {
  manager(c);
  const p = phone(b.phone), pin = String(b.pin || "");
  if (!/^\d{6,10}$/.test(pin)) bad("PIN de 6 à 10 chiffres requis.");
  const q = await db.rpc("liv_create_driver", {
    p_merchant_id: c.merchant.id,
    p_name: clean(b.name, 120),
    p_phone_normalized: p.n,
    p_display_phone: p.d,
    p_pin: pin,
    p_vehicle_type: [
      "motorcycle",
      "car",
      "bicycle",
      "foot",
      "cargo",
      "yango",
      "other"
    ].includes(b.vehicleType) ? b.vehicleType : "motorcycle",
    p_vehicle_plate: clean(b.vehiclePlate, 40) || null,
    p_language: [
      "fr",
      "wo",
      "both"
    ].includes(b.languagePreference) ? b.languagePreference : "both"
  });
  if (q.error) {
    if (q.error.code === "23505") bad("Ce téléphone est déjà utilisé.", 409);
    throw q.error;
  }
  const d = q.data;
  delete d.pin_hash;
  return out(r, {
    ok: true,
    driver: d
  });
}
async function createDelivery(r, b, c) {
  manager(c);
  const x = b.delivery || b, p = phone(x.recipientPhone), payload = {
    client_ref: x.clientRef || crypto.randomUUID(),
    source_type: x.sourceType || "manual",
    source_reference: clean(x.sourceReference, 120) || null,
    sender_name: clean(x.senderName, 160) || c.merchant.name,
    sender_phone: clean(x.senderPhone, 32) || c.merchant.phone || null,
    pickup_address: clean(x.pickupAddress, 360) || null,
    pickup_area: clean(x.pickupArea, 120) || null,
    pickup_lat: x.pickupLat ?? null,
    pickup_lng: x.pickupLng ?? null,
    recipient_name: clean(x.recipientName, 160),
    recipient_phone: p.d,
    delivery_address: clean(x.deliveryAddress, 360),
    delivery_area: clean(x.deliveryArea, 120) || null,
    landmark: clean(x.landmark, 240) || null,
    delivery_lat: x.deliveryLat ?? null,
    delivery_lng: x.deliveryLng ?? null,
    package_description: clean(x.packageDescription, 240) || "Colis",
    package_value: cash(x.packageValue, "Valeur du colis"),
    amount_to_collect: cash(x.amountToCollect, "Montant à encaisser"),
    payment_received: cash(x.paymentReceived, "Montant payé"),
    delivery_fee: cash(x.deliveryFee, "Frais de livraison"),
    payment_expected: [
      "cash",
      "wave",
      "orange_money",
      "prepaid",
      "mixed",
      "other"
    ].includes(x.paymentExpected) ? x.paymentExpected : "cash",
    payment_reference: clean(x.paymentReference, 160) || null,
    provider: [
      "own_fleet",
      "yango",
      "external"
    ].includes(x.provider) ? x.provider : "own_fleet",
    external_reference: clean(x.externalReference, 160) || null,
    priority: x.priority === "urgent" ? "urgent" : "normal",
    assigned_driver_id: clean(x.assignedDriverId, 50) || null,
    scheduled_for: x.scheduledFor || null,
    recipient_notes: clean(x.recipientNotes, 1000) || null
  };
  if (!payload.recipient_name || !payload.delivery_address) bad("Nom et adresse requis.");
  const q = await db.rpc("liv_create_delivery", {
    p_merchant_id: c.merchant.id,
    p_account_id: c.account.id,
    p_payload: payload
  });
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    delivery: q.data,
    trackingUrl: `${U}/functions/v1/sama-livraison-app?track=${q.data.public_token}`
  });
}
const hav = (a, b, c, d)=>{
  const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, z = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(z));
};
async function assign(r, b, c, auto = false) {
  manager(c);
  let did = String(b.driverId || "");
  if (auto) {
    const l = await db.from("liv_deliveries").select("pickup_lat,pickup_lng").eq("id", b.deliveryId).eq("merchant_id", c.merchant.id).single(), d = await db.from("liv_drivers").select("id,current_lat,current_lng,last_location_at").eq("merchant_id", c.merchant.id).eq("is_active", true).in("availability_status", [
      "available",
      "offline"
    ]);
    if (l.error) throw l.error;
    if (d.error) throw d.error;
    if (!d.data?.length) bad("Aucun livreur disponible.", 409);
    d.data.sort((x, y)=>{
      const dx = l.data.pickup_lat != null && x.current_lat != null ? hav(x.current_lat, x.current_lng, l.data.pickup_lat, l.data.pickup_lng) : 999999, dy = l.data.pickup_lat != null && y.current_lat != null ? hav(y.current_lat, y.current_lng, l.data.pickup_lat, l.data.pickup_lng) : 999999;
      return dx - dy;
    });
    did = d.data[0].id;
  }
  const q = await db.rpc("liv_assign_delivery", {
    p_merchant_id: c.merchant.id,
    p_delivery_id: b.deliveryId,
    p_driver_id: did
  });
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    delivery: q.data,
    driverId: did
  });
}
async function status(r, b, c) {
  const id = String(b.deliveryId || ""), s = String(b.status || ""), allowed = [
    "assigned",
    "picked_up",
    "in_transit",
    "arrived",
    "delivered",
    "failed",
    "returned",
    "cancelled"
  ];
  if (!allowed.includes(s)) bad("Statut invalide.");
  if (c.kind === "driver") {
    const z = await db.from("liv_deliveries").select("assigned_driver_id,delivery_code").eq("id", id).eq("merchant_id", c.merchant.id).single();
    if (z.error) throw z.error;
    if (z.data.assigned_driver_id !== c.driver.id) bad("Livraison non affectée.", 403);
    if (s === "delivered" && clean(b.code, 10) !== z.data.delivery_code) {
      const pc = await db.from("liv_proofs").select("id", {
        count: "exact",
        head: true
      }).eq("delivery_id", id);
      if (!pc.count) bad("Ajoutez une photo ou le code client.", 409);
    }
  }
  const q = await db.rpc("liv_change_status", {
    p_merchant_id: c.merchant.id,
    p_delivery_id: id,
    p_driver_id: c.kind === "driver" ? c.driver.id : null,
    p_status: s,
    p_note: clean(b.note || b.reason, 500) || null,
    p_lat: b.lat ?? null,
    p_lng: b.lng ?? null
  });
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    delivery: q.data
  });
}
async function payment(r, b, c) {
  const id = String(b.deliveryId || ""), a = cash(b.amount, "Montant reçu"), m = [
    "cash",
    "wave",
    "orange_money",
    "prepaid",
    "other"
  ].includes(b.method) ? b.method : "cash";
  if (a <= 0) bad("Montant invalide.");
  const q = await db.rpc("liv_record_payment", {
    p_merchant_id: c.merchant.id,
    p_delivery_id: id,
    p_driver_id: c.kind === "driver" ? c.driver.id : b.driverId || null,
    p_amount: a,
    p_method: m,
    p_reference: clean(b.reference, 160) || null
  });
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    delivery: q.data
  });
}
async function location(r, b, c) {
  if (c.kind !== "driver") bad("Accès livreur requis.", 403);
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) bad("GPS invalide.");
  const q = await db.from("liv_drivers").update({
    current_lat: lat,
    current_lng: lng,
    current_accuracy_m: Number(b.accuracy) || null,
    last_location_at: new Date().toISOString(),
    availability_status: c.driver.availability_status === "offline" ? "available" : c.driver.availability_status,
    updated_at: new Date().toISOString()
  }).eq("id", c.driver.id).select("id,current_lat,current_lng,last_location_at,availability_status").single();
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    location: q.data
  });
}
async function proof(r, b, c) {
  const id = String(b.deliveryId || ""), raw = String(b.data || b.dataUrl || ""), base = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!base || base.length > 4500000) bad("Photo trop volumineuse.", 413);
  let bin = "";
  try {
    bin = atob(base);
  } catch  {
    bad("Photo invalide.");
  }
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++)bytes[i] = bin.charCodeAt(i);
  const mime = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ].includes(b.mime) ? b.mime : "image/jpeg", ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg", path = `${c.merchant.id}/${id}/${Date.now()}-${b64(rnd(6))}.${ext}`;
  const up = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false
  });
  if (up.error) throw up.error;
  const q = await db.from("liv_proofs").insert({
    merchant_id: c.merchant.id,
    delivery_id: id,
    driver_id: c.kind === "driver" ? c.driver.id : null,
    proof_type: [
      "photo",
      "signature",
      "payment"
    ].includes(b.proofType) ? b.proofType : "photo",
    storage_path: path,
    note: clean(b.note, 500) || null,
    metadata: {
      mime,
      bytes: bytes.length
    }
  }).select("id,proof_type,storage_path,note,created_at").single();
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    proof: q.data
  });
}
async function closeShift(r, b, c) {
  if (c.kind !== "driver") bad("Accès livreur requis.", 403);
  const q = await db.rpc("liv_close_shift", {
    p_merchant_id: c.merchant.id,
    p_driver_id: c.driver.id,
    p_declared: cash(b.declaredCash, "Montant remis"),
    p_notes: clean(b.notes, 500) || null
  });
  if (q.error) throw q.error;
  return out(r, {
    ok: true,
    shift: q.data
  });
}
async function track(r, b) {
  const t = clean(b.token, 100), d = await db.from("liv_deliveries").select("id,delivery_number,recipient_name,delivery_area,package_description,amount_remaining,payment_expected,payment_status,provider,status,scheduled_for,assigned_driver_id,updated_at").eq("public_token", t).maybeSingle();
  if (d.error) throw d.error;
  if (!d.data) bad("Livraison introuvable.", 404);
  let dr = null;
  if (d.data.assigned_driver_id) {
    const x = await db.from("liv_drivers").select("name,vehicle_type,display_phone,last_location_at").eq("id", d.data.assigned_driver_id).maybeSingle();
    if (x.data) dr = {
      name: x.data.name.split(" ")[0],
      vehicleType: x.data.vehicle_type,
      phone: [
        "arrived",
        "delivered"
      ].includes(d.data.status) ? x.data.display_phone : null,
      lastLocationAt: x.data.last_location_at
    };
  }
  const e = await db.from("liv_delivery_events").select("event_type,status_to,note,created_at").eq("delivery_id", d.data.id).order("created_at").limit(30);
  return out(r, {
    ok: true,
    delivery: {
      deliveryNumber: d.data.delivery_number,
      recipientName: d.data.recipient_name.split(" ")[0],
      area: d.data.delivery_area,
      packageDescription: d.data.package_description,
      amountRemaining: d.data.amount_remaining,
      paymentExpected: d.data.payment_expected,
      paymentStatus: d.data.payment_status,
      provider: d.data.provider,
      status: d.data.status,
      scheduledFor: d.data.scheduled_for,
      updatedAt: d.data.updated_at
    },
    driver: dr,
    events: e.data || []
  });
}
async function logout(r, c) {
  if (c.kind === "manager") await db.from("sama_sessions").update({
    revoked_at: new Date().toISOString()
  }).eq("id", c.sid);
  else {
    await db.from("liv_driver_sessions").update({
      revoked_at: new Date().toISOString()
    }).eq("id", c.sid);
    await db.from("liv_drivers").update({
      availability_status: "offline",
      updated_at: new Date().toISOString()
    }).eq("id", c.driver.id);
  }
  return out(r, {
    ok: true
  });
}
Deno.serve(async (r)=>{
  const o = r.headers.get("origin");
  if (r.method === "OPTIONS") return new Response("ok", {
    headers: cors(o)
  });
  if (!allowed(o)) return out(r, {
    ok: false,
    error: "Origin not allowed"
  }, 403);
  try {
    if (r.method === "GET") return out(r, {
      ok: true,
      service: "sama-livraison-api",
      version: "1.0.0"
    });
    const b = await r.json(), a = String(b.action || "");
    if (a === "manager_register") return out(r, await proxyAuth("register", b));
    if (a === "manager_login") return out(r, await proxyAuth("login", b));
    if (a === "driver_login") return driverLogin(r, b);
    if (a === "track") return track(r, b);
    const c = await ctx(r);
    if (a === "bootstrap") return bootstrap(r, c);
    if (a === "create_driver") return createDriver(r, b, c);
    if (a === "create_delivery") return createDelivery(r, b, c);
    if (a === "assign_delivery") return assign(r, b, c, false);
    if (a === "auto_assign") return assign(r, b, c, true);
    if (a === "change_status") return status(r, b, c);
    if (a === "record_payment") return payment(r, b, c);
    if (a === "update_location") return location(r, b, c);
    if (a === "upload_proof") return proof(r, b, c);
    if (a === "close_shift") return closeShift(r, b, c);
    if (a === "logout") return logout(r, c);
    bad("Action inconnue.", 404);
  } catch (x) {
    const e = x;
    console.error("sama-livraison", e.message);
    return out(r, {
      ok: false,
      error: e.status && e.status < 500 ? e.message : "Une erreur technique est survenue."
    }, e.status || 500);
  }
});
