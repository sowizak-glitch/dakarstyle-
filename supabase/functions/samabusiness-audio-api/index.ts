import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type ApiError = Error & { status?: number; code?: string };

const VERSION = "10.3.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const SERVICE_KEY = rawKeys ? JSON.parse(rawKeys).default : (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_SAMABUSINESS") ?? Deno.env.get("OPENAI_API_KEY") ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const encoder = new TextEncoder();
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REQUESTS_PER_HOUR = 10;
const allowedOrigins = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com",
]);
const allowedExtensions = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm", "opus", "aac"]);

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return allowedOrigins.has(origin);
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
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-samabusiness-version": VERSION,
  };
}

function reply(req: Request, body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: cors(req.headers.get("origin")) });
}

function fail(message: string, status = 400, code = "invalid_request"): never {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
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

function clean(value: unknown, max = 300): string {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function extension(name: string): string {
  const match = clean(name, 180).toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  return match?.[1] || "";
}

async function sessionContext(req: Request): Promise<{ accountId: string; merchantId: string }> {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Connexion requise.", 401, "session_required");
  const sessionQ = await db.from("sama_sessions")
    .select("account_id,expires_at,revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Votre session a expiré. Reconnectez-vous.", 401, "session_expired");
  }
  const accountQ = await db.from("sama_accounts")
    .select("id,is_active,suspended_at,subscription_status")
    .eq("id", session.account_id)
    .maybeSingle();
  if (accountQ.error) throw accountQ.error;
  if (!accountQ.data?.is_active || accountQ.data.suspended_at || accountQ.data.subscription_status === "suspended") {
    fail("Ce compte n'est pas autorisé.", 403, "account_blocked");
  }
  const merchantQ = await db.from("sama_merchants").select("id").eq("account_id", accountQ.data.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404, "merchant_missing");
  return { accountId: accountQ.data.id, merchantId: merchantQ.data.id };
}

async function enforceRateLimit(accountId: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const q = await db.from("sama_audio_transcriptions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .gte("created_at", since);
  if (q.error) throw q.error;
  if ((q.count || 0) >= MAX_REQUESTS_PER_HOUR) {
    fail("Limite temporaire atteinte. Réessayez dans quelques minutes.", 429, "rate_limited");
  }
}

function looksLikeAudio(file: File): boolean {
  const ext = extension(file.name || "");
  const mime = String(file.type || "").toLowerCase();
  return mime.startsWith("audio/") || mime === "video/mp4" || mime === "application/ogg" || allowedExtensions.has(ext);
}

async function logAttempt(ctx: { accountId: string; merchantId: string }, file: File, language: string, status: string): Promise<string | null> {
  const q = await db.from("sama_audio_transcriptions").insert({
    account_id: ctx.accountId,
    merchant_id: ctx.merchantId,
    file_size_bytes: file.size,
    mime_type: clean(file.type || "application/octet-stream", 100),
    language_hint: language,
    status,
  }).select("id").single();
  if (q.error) {
    console.error("samabusiness-audio-api audit insert", q.error.message);
    return null;
  }
  return q.data.id;
}

async function updateAttempt(id: string | null, status: string): Promise<void> {
  if (!id) return;
  const q = await db.from("sama_audio_transcriptions").update({ status, completed_at: new Date().toISOString() }).eq("id", id);
  if (q.error) console.error("samabusiness-audio-api audit update", q.error.message);
}

async function transcribe(req: Request): Promise<Response> {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_BYTES + 1_000_000) fail("Le fichier dépasse 15 Mo.", 413, "file_too_large");
  const ctx = await sessionContext(req);
  await enforceRateLimit(ctx.accountId);

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) fail("Un fichier audio est requis.", 415, "multipart_required");
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size <= 0) fail("Message vocal introuvable.", 400, "audio_required");
  if (file.size > MAX_BYTES) fail("Le fichier dépasse 15 Mo.", 413, "file_too_large");
  if (!looksLikeAudio(file)) fail("Format audio non reconnu.", 415, "unsupported_audio");

  const requestedLanguage = clean(form.get("language"), 10).toLowerCase();
  const language = requestedLanguage === "wo" || requestedLanguage === "fr" ? requestedLanguage : "auto";
  const auditId = await logAttempt(ctx, file, language, "received");

  if (!OPENAI_API_KEY) {
    await updateAttempt(auditId, "unconfigured");
    fail("La transcription automatique n'est pas encore disponible sur ce serveur.", 503, "transcription_unconfigured");
  }

  const safeExt = allowedExtensions.has(extension(file.name || "")) ? extension(file.name || "") : "webm";
  const openaiForm = new FormData();
  openaiForm.append("file", file, `vocal-samabusiness.${safeExt}`);
  openaiForm.append("model", "gpt-4o-mini-transcribe");
  openaiForm.append("response_format", "json");
  openaiForm.append("prompt", "Message commercial au Sénégal, souvent en wolof, français ou mélange des deux. Conserver exactement les noms de personnes, produits, quantités, numéros et montants en francs CFA.");
  if (language !== "auto") openaiForm.append("language", language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "authorization": `Bearer ${OPENAI_API_KEY}` },
      body: openaiForm,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("samabusiness-audio-api upstream", { status: response.status, code: payload?.error?.code || "unknown" });
      await updateAttempt(auditId, "failed");
      fail("Le vocal n'a pas pu être transcrit. Réessayez.", 502, "transcription_failed");
    }
    const text = clean(payload?.text, 12_000);
    if (!text) {
      await updateAttempt(auditId, "empty");
      fail("Aucune parole n'a été reconnue dans ce vocal.", 422, "empty_transcript");
    }
    await updateAttempt(auditId, "completed");
    return reply(req, { ok: true, text, language, model: "gpt-4o-mini-transcribe", stored_audio: false });
  } catch (unknownError) {
    await updateAttempt(auditId, "failed");
    if (unknownError instanceof DOMException && unknownError.name === "AbortError") {
      fail("La transcription a pris trop de temps. Réessayez avec un vocal plus court.", 504, "transcription_timeout");
    }
    throw unknownError;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Forbidden", { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (!originAllowed(origin)) return reply(req, { ok: false, error: "Origine non autorisée." }, 403);
  if (req.method === "GET") {
    return reply(req, {
      ok: true,
      service: "samabusiness-audio-api",
      version: VERSION,
      configured: Boolean(OPENAI_API_KEY),
      max_file_mb: 15,
      audio_retained: false,
    });
  }
  if (req.method !== "POST") return reply(req, { ok: false, error: "Méthode non autorisée." }, 405);

  try {
    return await transcribe(req);
  } catch (unknownError) {
    const error = unknownError as ApiError;
    console.error("samabusiness-audio-api", {
      status: error.status || 500,
      code: error.code || "internal_error",
      message: error.status && error.status < 500 ? "handled" : error.message,
    });
    return reply(req, {
      ok: false,
      error: error.status && error.status < 500 ? error.message : "Une erreur technique est survenue. Réessayez.",
      code: error.code || "internal_error",
    }, error.status || 500);
  }
});
