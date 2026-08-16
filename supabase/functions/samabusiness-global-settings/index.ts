// SAMABUSINESS — Global Core settings API
//
// Standalone, additive endpoint: reads and writes the tenant-level Global
// Config fields on sama_merchants (country_code, currency, locale,
// timezone, phone_region, measurement_system, week_start). Deliberately
// isolated from samabusiness-api-v10 so shipping it carries zero risk to
// the existing sales/stock/debts/orders surface — it touches no table and
// no code path that function already owns.
//
// Auth follows the exact same session contract as samabusiness-api-v10
// (x-sama-session header -> sama_sessions.token_hash -> sama_accounts ->
// sama_merchants), so a merchant can only ever read or write their own
// row: RLS on sama_merchants additionally enforces owner_user_id = auth.uid()
// even though this function uses the service role, because every query is
// scoped to the merchant resolved from the caller's own validated session.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const VERSION = "1.0.0";

function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
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
function allowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+(?:-eminix-s-projects)?\.vercel\.app$/i.test(origin);
}
function cors(origin) {
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
    "x-samabusiness-global-settings-version": VERSION,
  };
}

function text(value, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function b64url(bytes) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function sessionContext(req) {
  if (!db) fail("Backend indisponible.", 503);
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sessionQ = await db.from("sama_sessions").select("id,account_id,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Votre session a expiré. Reconnectez-vous.", 401);
  }
  const accountQ = await db.from("sama_accounts").select("id,is_active").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active) fail("Ce compte est désactivé.", 403);
  const merchantQ = await db.from("sama_merchants")
    .select("id,account_id,country_code,currency,locale,timezone,phone_region,measurement_system,week_start")
    .eq("account_id", accountQ.data.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  return { merchant: merchantQ.data };
}

// Conservative server-side validation. The client (Global Core Country
// Registry) is the primary UX guard; this is the trust boundary.
const BCP47_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,3}$/;
const ISO_ALPHA2_RE = /^[A-Za-z]{2}$/;
const ISO_4217_RE = /^[A-Za-z]{3}$/;

function validatePatch(body) {
  const patch = {};
  if (body.countryCode !== undefined) {
    const v = text(body.countryCode, 2).toUpperCase();
    if (!ISO_ALPHA2_RE.test(v)) fail("Pays invalide (ISO 3166-1 alpha-2 attendu).");
    patch.country_code = v;
  }
  if (body.currency !== undefined) {
    const v = text(body.currency, 3).toUpperCase();
    if (!ISO_4217_RE.test(v)) fail("Devise invalide (ISO 4217 attendu).");
    patch.currency = v;
  }
  if (body.locale !== undefined) {
    const v = text(body.locale, 20);
    if (!BCP47_RE.test(v)) fail("Langue invalide (BCP 47 attendu).");
    patch.locale = v;
  }
  if (body.timezone !== undefined) {
    const v = text(body.timezone, 60);
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
    } catch {
      fail("Fuseau horaire invalide (nom IANA attendu).");
    }
    patch.timezone = v;
  }
  if (body.phoneRegion !== undefined) {
    const v = text(body.phoneRegion, 2).toUpperCase();
    if (!ISO_ALPHA2_RE.test(v)) fail("Indicatif téléphonique invalide.");
    patch.phone_region = v;
  }
  if (body.measurementSystem !== undefined) {
    const v = text(body.measurementSystem, 10);
    if (v !== "metric" && v !== "imperial") fail("Système de mesure invalide.");
    patch.measurement_system = v;
  }
  if (body.weekStart !== undefined) {
    const v = Math.trunc(Number(body.weekStart));
    if (!Number.isFinite(v) || v < 0 || v > 6) fail("Premier jour de semaine invalide.");
    patch.week_start = v;
  }
  if (Object.keys(patch).length === 0) fail("Aucun champ à mettre à jour.");
  return patch;
}

function toClientShape(merchant) {
  return {
    countryCode: merchant.country_code,
    currency: merchant.currency,
    locale: merchant.locale,
    timezone: merchant.timezone,
    phoneRegion: merchant.phone_region,
    measurementSystem: merchant.measurement_system,
    weekStart: merchant.week_start,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ ok: false, error: "Méthode non autorisée." }, { status: 405, headers: cors(origin) });
  }
  try {
    if (req.method === "GET") {
      const ctx = await sessionContext(req);
      return Response.json({ ok: true, settings: toClientShape(ctx.merchant) }, { headers: cors(origin) });
    }
    const body = await req.json().catch(() => ({}));
    const action = text(body?.action, 40) || "save_settings";
    if (action === "get_settings") {
      const ctx = await sessionContext(req);
      return Response.json({ ok: true, settings: toClientShape(ctx.merchant) }, { headers: cors(origin) });
    }
    if (action === "save_settings") {
      const ctx = await sessionContext(req);
      const patch = validatePatch(body || {});
      const updated = await db.from("sama_merchants")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", ctx.merchant.id)
        .select("id,country_code,currency,locale,timezone,phone_region,measurement_system,week_start")
        .maybeSingle();
      if (updated.error) throw updated.error;
      return Response.json({ ok: true, settings: toClientShape(updated.data) }, { headers: cors(origin) });
    }
    fail(`Action inconnue: ${action}`, 400);
  } catch (unknownError) {
    const error = unknownError;
    console.error("samabusiness-global-settings", { status: error.status || 500, message: error.status && error.status < 500 ? "handled" : error.message });
    return Response.json({
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez.",
    }, { status: error.status || 500, headers: cors(origin) });
  }
});
