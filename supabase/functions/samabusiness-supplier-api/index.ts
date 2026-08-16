import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type ApiError = Error & { status?: number };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = rawKeys
  ? JSON.parse(rawKeys).default
  : (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const VERSION = "10.2.0";
const encoder = new TextEncoder();
const allowedOrigins = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com",
]);

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/sama-(?:cahier|business)-[a-z0-9-]+-eminix-s-projects\.vercel\.app$/i.test(origin);
}

function cors(origin: string | null): HeadersInit {
  const safe = origin && originAllowed(origin) ? origin : "https://samabusiness.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type, x-sama-session, x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION,
  };
}

function reply(req: Request, body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: cors(req.headers.get("origin")) });
}

function fail(message: string, status = 400): never {
  const error = new Error(message) as ApiError;
  error.status = status;
  throw error;
}

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function uuid(value: unknown): string | null {
  const candidate = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function sessionMerchant(req: Request): Promise<{ merchantId: string }> {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Session requise.", 401);
  const tokenHash = await sha256(token);
  const sessionQ = await db.from("sama_sessions")
    .select("account_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Votre session a expiré. Reconnectez-vous.", 401);
  }
  const accountQ = await db.from("sama_accounts")
    .select("id,is_active,subscription_status,suspended_at")
    .eq("id", session.account_id)
    .maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active || accountQ.data.suspended_at || accountQ.data.subscription_status === "suspended") {
    fail("Ce compte n'est pas autorisé.", 403);
  }
  const merchantQ = await db.from("sama_merchants")
    .select("id")
    .eq("account_id", accountQ.data.id)
    .maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404);
  return { merchantId: merchantQ.data.id };
}

async function saveSupplier(req: Request, body: Record<string, unknown>): Promise<Response> {
  const ctx = await sessionMerchant(req);
  const productId = uuid(body.productId);
  if (!productId) fail("Produit invalide.");
  const productQ = await db.from("sama_products")
    .select("id,name,metadata")
    .eq("id", productId)
    .eq("merchant_id", ctx.merchantId)
    .maybeSingle();
  if (productQ.error) throw productQ.error;
  if (!productQ.data) fail("Produit introuvable.", 404);

  const supplierName = text(body.supplierName ?? body.name, 120);
  const supplierPhone = text(body.supplierPhone ?? body.phone, 40).replace(/[^\d+]/g, "");
  const parsedQuantity = Number(body.reorderQuantity);
  const reorderQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0
    ? Math.min(Math.round(parsedQuantity * 100) / 100, 100000)
    : 1;
  const metadata = productQ.data.metadata && typeof productQ.data.metadata === "object" && !Array.isArray(productQ.data.metadata)
    ? { ...productQ.data.metadata }
    : {};
  metadata.supplier = {
    name: supplierName,
    phone: supplierPhone,
    reorder_quantity: reorderQuantity,
    updated_at: new Date().toISOString(),
  };

  const updateQ = await db.from("sama_products")
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("merchant_id", ctx.merchantId)
    .select("id,name,metadata")
    .single();
  if (updateQ.error) throw updateQ.error;
  return reply(req, { ok: true, product: updateQ.data });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Forbidden", { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!originAllowed(origin)) return reply(req, { ok: false, error: "Origin not allowed" }, 403);
  if (req.method === "GET") return reply(req, { ok: true, service: "samabusiness-supplier-api", version: VERSION });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Méthode non autorisée." }, 405);
  try {
    if (!(req.headers.get("content-type") || "").includes("application/json")) fail("Corps JSON requis.", 415);
    const body = await req.json();
    if (text(body.action, 80) !== "save_supplier") fail("Action inconnue.", 404);
    return await saveSupplier(req, body);
  } catch (unknownError) {
    const error = unknownError as ApiError;
    console.error("samabusiness-supplier-api", {
      status: error.status || 500,
      message: error.status && error.status < 500 ? "handled" : error.message,
    });
    return reply(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez.",
    }, error.status || 500);
  }
});
