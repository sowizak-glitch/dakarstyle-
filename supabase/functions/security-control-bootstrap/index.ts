import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
const VERSION = '1.0.0';
const PROJECT_URL = Deno.env.get('SUPABASE_URL') || 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECURITY_ORIGIN = 'https://security.dakarstyle.com';
const MAX_ATTEMPTS = 5;
function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch  {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const admin = createClient(PROJECT_URL, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const publicAuth = createClient(PROJECT_URL, ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function headers(req) {
  const origin = req.headers.get('origin') || '';
  const out = {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-site',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SOWHAT-Bootstrap-Version': VERSION,
    Vary: 'Origin'
  };
  if (origin === SECURITY_ORIGIN) out['Access-Control-Allow-Origin'] = origin;
  return out;
}
function json(req, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers(req),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
async function readJson(req) {
  const type = req.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw Object.assign(new Error('JSON_REQUIRED'), {
    status: 415
  });
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > 4096) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > 4096) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), {
    status: 413
  });
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch  {
    throw Object.assign(new Error('INVALID_JSON'), {
      status: 400
    });
  }
}
function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : '';
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [
    ...new Uint8Array(digest)
  ].map((item)=>item.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    if (origin && origin !== SECURITY_ORIGIN) return new Response(null, {
      status: 403,
      headers: headers(req)
    });
    return new Response(null, {
      status: 204,
      headers: headers(req)
    });
  }
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() || 'health';
  try {
    if (req.method === 'GET' && (route === 'health' || route === 'security-control-bootstrap')) {
      return json(req, {
        ok: true,
        service: 'SOWHAT Security Bootstrap',
        version: VERSION,
        one_time: true,
        max_attempts: MAX_ATTEMPTS
      });
    }
    if (req.method !== 'POST' || route !== 'verify') return json(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
    const input = await readJson(req);
    const email = normalizeEmail(input.email);
    const code = String(input.code || input.token || '').replace(/\D/g, '');
    if (!email || !/^\d{8}$/.test(code)) return json(req, {
      ok: false,
      code: 'INVALID_CREDENTIALS'
    }, 400);
    const emailHash = await sha256Hex(email);
    const { data: row, error: rowError } = await admin.from('security_control_access_codes').select('id,user_id,salt,expires_at,attempts').eq('email_hash', emailHash).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (rowError || !row) return json(req, {
      ok: false,
      code: 'CODE_INVALID_OR_EXPIRED'
    }, 401);
    if (Number(row.attempts || 0) >= MAX_ATTEMPTS) return json(req, {
      ok: false,
      code: 'CODE_LOCKED'
    }, 429);
    const codeHash = await sha256Hex(`${row.salt}:${code}`);
    const { data: redeemed, error: redeemError } = await admin.rpc('security_control_redeem_code', {
      p_code_id: row.id,
      p_code_hash: codeHash
    });
    const result = Array.isArray(redeemed) ? redeemed[0] : redeemed;
    if (redeemError || !result?.ok) {
      const reason = String(result?.reason || 'INVALID');
      return json(req, {
        ok: false,
        code: reason === 'LOCKED' ? 'CODE_LOCKED' : 'CODE_INVALID_OR_EXPIRED'
      }, reason === 'LOCKED' ? 429 : 401);
    }
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(String(result.user_id));
    const userEmail = String(userResult?.user?.email || '').toLowerCase();
    if (userError || userEmail !== email) return json(req, {
      ok: false,
      code: 'ACCESS_DENIED'
    }, 403);
    const { data: allow, error: allowError } = await admin.from('security_console_admins').select('role,active').eq('user_id', result.user_id).maybeSingle();
    if (allowError || !allow?.active) return json(req, {
      ok: false,
      code: 'ACCESS_DENIED'
    }, 403);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email
    });
    const tokenHash = String(link?.properties?.hashed_token || '');
    if (linkError || !tokenHash) return json(req, {
      ok: false,
      code: 'SESSION_ISSUE_FAILED'
    }, 503);
    const { data: verified, error: verifyError } = await publicAuth.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email'
    });
    if (verifyError || !verified.session) return json(req, {
      ok: false,
      code: 'SESSION_ISSUE_FAILED'
    }, 503);
    console.log(JSON.stringify({
      event: 'bootstrap_login_success',
      user_id: result.user_id,
      role: allow.role
    }));
    return json(req, {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_in: verified.session.expires_in,
      expires_at: verified.session.expires_at,
      token_type: verified.session.token_type,
      user: {
        id: verified.user?.id,
        email: verified.user?.email
      },
      bootstrap: true
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || 'INTERNAL_ERROR');
    console.error(JSON.stringify({
      event: 'bootstrap_error',
      code,
      status
    }));
    return json(req, {
      ok: false,
      code: [
        400,
        401,
        403,
        413,
        415,
        429
      ].includes(status) ? code : 'INTERNAL_ERROR'
    }, [
      400,
      401,
      403,
      413,
      415,
      429
    ].includes(status) ? status : 500);
  }
});
