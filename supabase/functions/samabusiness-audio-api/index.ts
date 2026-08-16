import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const VERSION = "10.6.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const candidate of Object.values(parsed)){
      if (typeof candidate === "string" && candidate.length > 40) return candidate;
    }
  } catch  {
    return packed.length > 40 ? packed : "";
  }
  return "";
}
const SERVICE_KEY = serviceKey();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing backend configuration");
const XAI_KEY = Deno.env.get("XAI_API_KEY") ?? Deno.env.get("GROK_API_KEY") ?? "";
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("OPENROUTER_KEY") ?? Deno.env.get("OPENROUTER_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY_SAMABUSINESS") ?? Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_STT_MODEL") ?? "openai/gpt-4o-transcribe";
const TTS_VOICE = Deno.env.get("XAI_TTS_VOICE") ?? "eve";
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_STT_HOUR = 20;
const MAX_TTS_HOUR = 120;
const origins = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://www.samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com"
]);
const exts = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
  "opus",
  "aac"
]);
const safeServerCodes = new Set([
  "transcription_unconfigured",
  "tts_unconfigured",
  "rate_limited",
  "file_too_large",
  "unsupported_audio",
  "audio_required",
  "empty_transcript",
  "subscription_required",
  "session_required",
  "session_expired",
  "account_blocked",
  "merchant_missing"
]);
function originAllowed(origin) {
  return !origin || origins.has(origin);
}
function cors(origin, content = "application/json; charset=utf-8") {
  const safe = origin && originAllowed(origin) ? origin : "https://samabusiness.dakarstyle.com";
  return {
    "access-control-allow-origin": safe,
    "access-control-allow-headers": "content-type,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    "content-type": content,
    "vary": "Origin",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-samabusiness-version": VERSION
  };
}
function reply(req, body, status = 200) {
  return Response.json(body, {
    status,
    headers: cors(req.headers.get("origin"))
  });
}
function fail(message, status = 400, code = "invalid_request") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}
function b64url(bytes) {
  let raw = "";
  for (const b of bytes)raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function clean(value, max = 300) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}
function extension(name) {
  return clean(name, 180).toLowerCase().match(/\.([a-z0-9]{2,8})$/)?.[1] || "";
}
function audioLike(file) {
  const ext = extension(file.name || "");
  const mime = String(file.type || "").toLowerCase();
  return mime.startsWith("audio/") || mime === "video/mp4" || mime === "application/ogg" || exts.has(ext);
}
function toB64(bytes) {
  let binary = "";
  for(let i = 0; i < bytes.length; i += 0x8000)binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function sttProvider() {
  if (XAI_KEY) return {
    provider: "xai",
    model: "grok-stt"
  };
  if (OPENROUTER_KEY) return {
    provider: "openrouter",
    model: OPENROUTER_MODEL
  };
  if (OPENAI_KEY) return {
    provider: "openai",
    model: "gpt-4o-mini-transcribe"
  };
  return {
    provider: "none",
    model: null
  };
}
async function context(req) {
  const token = req.headers.get("x-sama-session")?.trim() || "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Connexion requise.", 401, "session_required");
  const sessionQ = await db.from("sama_sessions").select("account_id,expires_at,revoked_at").eq("token_hash", await sha256(token)).maybeSingle();
  if (sessionQ.error) throw sessionQ.error;
  const session = sessionQ.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail("Votre session a expiré. Reconnectez-vous.", 401, "session_expired");
  const accountQ = await db.from("sama_accounts").select("id,is_active,suspended_at,subscription_status,billing_status,is_lifetime,trial_ends_at,subscription_paid_until,role").eq("id", session.account_id).maybeSingle();
  if (accountQ.error) throw accountQ.error;
  const account = accountQ.data;
  if (!account?.is_active || account.suspended_at || account.subscription_status === "suspended") fail("Ce compte n'est pas autorisé.", 403, "account_blocked");
  const now = Date.now();
  const canUse = account.role === "admin" || account.is_lifetime || account.billing_status === "lifetime" || account.subscription_paid_until && new Date(account.subscription_paid_until).getTime() > now || account.trial_ends_at && new Date(account.trial_ends_at).getTime() > now;
  if (!canUse) fail("Votre accès SAMABUSINESS est expiré.", 402, "subscription_required");
  const merchantQ = await db.from("sama_merchants").select("id").eq("account_id", account.id).maybeSingle();
  if (merchantQ.error) throw merchantQ.error;
  if (!merchantQ.data) fail("Commerce introuvable.", 404, "merchant_missing");
  return {
    accountId: account.id,
    merchantId: merchantQ.data.id
  };
}
async function limit(table, accountId, max) {
  const since = new Date(Date.now() - 3600000).toISOString();
  const query = await db.from(table).select("id", {
    count: "exact",
    head: true
  }).eq("account_id", accountId).gte("created_at", since);
  if (query.error) throw query.error;
  if ((query.count || 0) >= max) fail("Limite temporaire atteinte. Réessayez dans quelques minutes.", 429, "rate_limited");
}
async function sttAudit(ctx, file, language, status) {
  const query = await db.from("sama_audio_transcriptions").insert({
    account_id: ctx.accountId,
    merchant_id: ctx.merchantId,
    file_size_bytes: file.size,
    mime_type: clean(file.type || "application/octet-stream", 100),
    language_hint: language,
    status
  }).select("id").single();
  if (query.error) {
    console.error("audio audit insert", query.error.message);
    return null;
  }
  return query.data.id;
}
async function sttUpdate(id, status) {
  if (!id) return;
  const query = await db.from("sama_audio_transcriptions").update({
    status,
    completed_at: new Date().toISOString()
  }).eq("id", id);
  if (query.error) console.error("audio audit update", query.error.message);
}
async function xaiStt(file, language) {
  const form = new FormData();
  // xAI requires optional multipart fields before the file; the file is appended last.
  if (language === "fr") {
    form.append("format", "true");
    form.append("language", "fr");
  }
  form.append("file", file, file.name || "sama-vocal.opus");
  const response = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: {
      authorization: `Bearer ${XAI_KEY}`
    },
    body: form
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) fail("Le vocal n'a pas pu être transcrit. Réessayez.", 502, "transcription_failed");
  const transcript = clean(data?.text, 12000);
  if (!transcript) fail("Aucune parole n'a été reconnue.", 422, "empty_transcript");
  return {
    text: transcript,
    model: "grok-stt"
  };
}
async function openrouterStt(file, language) {
  const ext = exts.has(extension(file.name || "")) ? extension(file.name || "") : "webm";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const payload = {
    model: OPENROUTER_MODEL,
    input_audio: {
      data: toB64(bytes),
      format: ext
    }
  };
  if (language === "fr") payload.language = "fr";
  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENROUTER_KEY}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://samabusiness.dakarstyle.com",
      "X-Title": "SAMABUSINESS"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) fail("Le vocal n'a pas pu être transcrit. Réessayez.", 502, "transcription_failed");
  const transcript = clean(data?.text, 12000);
  if (!transcript) fail("Aucune parole n'a été reconnue.", 422, "empty_transcript");
  return {
    text: transcript,
    model: OPENROUTER_MODEL
  };
}
async function openaiStt(file, language) {
  const ext = exts.has(extension(file.name || "")) ? extension(file.name || "") : "webm";
  const form = new FormData();
  form.append("file", file, `vocal-samabusiness.${ext}`);
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  form.append("prompt", "Message commercial au Sénégal, souvent en wolof, français ou mélange des deux. Conserver noms, produits, quantités, numéros et montants CFA.");
  if (language === "fr") form.append("language", "fr");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENAI_KEY}`
    },
    body: form
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) fail("Le vocal n'a pas pu être transcrit. Réessayez.", 502, "transcription_failed");
  const transcript = clean(data?.text, 12000);
  if (!transcript) fail("Aucune parole n'a été reconnue.", 422, "empty_transcript");
  return {
    text: transcript,
    model: "gpt-4o-mini-transcribe"
  };
}
async function transcribe(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len && len > MAX_BYTES + 1000000) fail("Le fichier dépasse 15 Mo.", 413, "file_too_large");
  const ctx = await context(req);
  await limit("sama_audio_transcriptions", ctx.accountId, MAX_STT_HOUR);
  if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) fail("Un fichier audio est requis.", 415, "multipart_required");
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size <= 0) fail("Message vocal introuvable.", 400, "audio_required");
  if (file.size > MAX_BYTES) fail("Le fichier dépasse 15 Mo.", 413, "file_too_large");
  if (!audioLike(file)) fail("Format audio non reconnu.", 415, "unsupported_audio");
  const requested = clean(form.get("language"), 10).toLowerCase();
  const language = requested === "wo" ? "wo" : requested === "fr" ? "fr" : "auto";
  const provider = sttProvider();
  const auditId = await sttAudit(ctx, file, language, "received");
  if (provider.provider === "none") {
    await sttUpdate(auditId, "unconfigured");
    fail("La transcription serveur attend encore la connexion Grok/xAI. Le vocal n'a pas été conservé.", 503, "transcription_unconfigured");
  }
  try {
    const out = provider.provider === "xai" ? await xaiStt(file, language) : provider.provider === "openrouter" ? await openrouterStt(file, language) : await openaiStt(file, language);
    await sttUpdate(auditId, "completed");
    return reply(req, {
      ok: true,
      text: out.text,
      language,
      provider: provider.provider,
      model: out.model,
      stored_audio: false
    });
  } catch (error) {
    await sttUpdate(auditId, "failed");
    throw error;
  }
}
async function tts(req, body) {
  if (!XAI_KEY) fail("La voix naturelle Grok/xAI attend encore sa clé serveur.", 503, "tts_unconfigured");
  const ctx = await context(req);
  await limit("sama_audio_synthesis", ctx.accountId, MAX_TTS_HOUR);
  const text = clean(body?.text, 6000);
  if (!text) fail("Texte à lire requis.", 400, "text_required");
  const requested = clean(body?.language, 10).toLowerCase();
  const language = requested === "fr" ? "fr" : "auto";
  const requestedVoice = clean(body?.voice, 20);
  const voice = /^[a-z0-9]{3,16}$/i.test(requestedVoice) ? requestedVoice : TTS_VOICE;
  const audit = await db.from("sama_audio_synthesis").insert({
    account_id: ctx.accountId,
    merchant_id: ctx.merchantId,
    character_count: text.length,
    language,
    voice_id: voice,
    provider: "xai",
    status: "received"
  }).select("id").single();
  if (audit.error) throw audit.error;
  try {
    const payload = {
      text,
      voice_id: voice
    };
    if (language === "fr") payload.language = "fr";
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${XAI_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) fail("La lecture vocale est momentanément indisponible.", 502, "tts_failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) fail("La lecture vocale est momentanément indisponible.", 502, "tts_failed");
    await db.from("sama_audio_synthesis").update({
      status: "completed",
      completed_at: new Date().toISOString()
    }).eq("id", audit.data.id);
    return reply(req, {
      ok: true,
      audio: toB64(bytes),
      content_type: response.headers.get("content-type") || "audio/mpeg",
      voice,
      language,
      provider: "xai",
      stored_audio: false
    });
  } catch (error) {
    await db.from("sama_audio_synthesis").update({
      status: "failed",
      completed_at: new Date().toISOString()
    }).eq("id", audit.data.id);
    throw error;
  }
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Forbidden", {
      status: 403
    });
    return new Response(null, {
      status: 204,
      headers: cors(origin)
    });
  }
  if (!originAllowed(origin)) return reply(req, {
    ok: false,
    error: "Origine non autorisée."
  }, 403);
  if (req.method === "GET") {
    const provider = sttProvider();
    return reply(req, {
      ok: true,
      service: "samabusiness-audio-api",
      version: VERSION,
      configured: provider.provider !== "none",
      provider: provider.provider,
      model: provider.model,
      providers: {
        xai_direct: Boolean(XAI_KEY),
        openrouter: Boolean(OPENROUTER_KEY),
        openai_fallback: Boolean(OPENAI_KEY)
      },
      tts: {
        configured: Boolean(XAI_KEY),
        provider: XAI_KEY ? "xai" : "none",
        voice: TTS_VOICE,
        languages: {
          fr: "supported",
          wo: "auto_best_effort"
        }
      },
      formats: [
        ...exts
      ],
      max_file_mb: 15,
      audio_retained: false
    });
  }
  if (req.method !== "POST") return reply(req, {
    ok: false,
    error: "Méthode non autorisée."
  }, 405);
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await req.json().catch(()=>({}));
      if (clean(body?.action, 20) === "speak") return await tts(req, body);
      fail("Action audio inconnue.", 404, "unknown_action");
    }
    return await transcribe(req);
  } catch (unknownError) {
    const error = unknownError;
    const status = error.status || 500;
    const code = error.code || "internal_error";
    const expose = status < 500 || safeServerCodes.has(code);
    console.error("samabusiness-audio-api", {
      status,
      code,
      message: expose ? "handled" : error.message
    });
    return reply(req, {
      ok: false,
      error: expose ? error.message : "Une erreur technique est survenue. Réessayez.",
      code
    }, status);
  }
});
