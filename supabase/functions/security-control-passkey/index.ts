import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from 'npm:@simplewebauthn/server@13.3.2';
const VERSION = '1.0.0';
const PROJECT_URL = Deno.env.get('SUPABASE_URL') || 'https://xmdpmtvieqgoorbxytey.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECURITY_ORIGIN = 'https://security.dakarstyle.com';
const RP_ID = 'security.dakarstyle.com';
const RP_NAME = 'SOWHAT Security Control';
const CHALLENGE_LIMIT = 20;
const MAX_PASSKEYS_PER_USER = 10;
const ALLOWED_TRANSPORTS = new Set([
  'ble',
  'cable',
  'hybrid',
  'internal',
  'nfc',
  'smart-card',
  'usb'
]);
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
function fail(code, status) {
  throw Object.assign(new Error(code), {
    status
  });
}
function responseHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-site',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SOWHAT-Passkey-Version': VERSION,
    Vary: 'Origin'
  };
  if (origin === SECURITY_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function json(req, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders(req),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
async function readJson(req) {
  if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    fail('JSON_REQUIRED', 415);
  }
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > 131072) fail('PAYLOAD_TOO_LARGE', 413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 131072) fail('PAYLOAD_TOO_LARGE', 413);
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch  {
    fail('INVALID_JSON', 400);
  }
}
function routeName(req) {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const functionIndex = parts.lastIndexOf('security-control-passkey');
  return (functionIndex >= 0 ? parts.slice(functionIndex + 1) : parts).join('/') || 'health';
}
function bearerToken(req) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length < 30) fail('AUTH_REQUIRED', 401);
  return authorization.slice(7);
}
async function sessionUser(req) {
  const { data, error } = await admin.auth.getUser(bearerToken(req));
  const user = data?.user;
  if (error || !user?.id || !user.email) fail('AUTH_REQUIRED', 401);
  const { data: allow, error: allowError } = await admin.from('security_console_admins').select('role,active').eq('user_id', user.id).maybeSingle();
  if (allowError || !allow?.active) fail('ACCESS_DENIED', 403);
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    role: String(allow.role || 'viewer')
  };
}
function uuid(value) {
  const result = String(value || '').toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)) {
    fail('INVALID_REQUEST', 400);
  }
  return result;
}
function uuidBytes(value) {
  const hex = value.replaceAll('-', '');
  return Uint8Array.from(hex.match(/.{2}/g) || [], (pair)=>Number.parseInt(pair, 16));
}
function base64url(bytes) {
  let binary = '';
  for (const byte of bytes)binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function bytea(bytes) {
  return `\\x${[
    ...bytes
  ].map((value)=>value.toString(16).padStart(2, '0')).join('')}`;
}
function bytesFromBytea(value) {
  const encoded = String(value || '');
  if (!/^\\x[0-9a-f]+$/i.test(encoded) || (encoded.length - 2) % 2 !== 0) fail('CREDENTIAL_CORRUPT', 500);
  const hex = encoded.slice(2);
  return Uint8Array.from(hex.match(/.{2}/g) || [], (pair)=>Number.parseInt(pair, 16));
}
function transports(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.map(String).filter((item)=>ALLOWED_TRANSPORTS.has(item)))
  ];
}
function deviceName(value) {
  const clean = String(value || 'Appareil sécurisé').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || 'Appareil sécurisé';
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [
    ...new Uint8Array(digest)
  ].map((item)=>item.toString(16).padStart(2, '0')).join('');
}
async function requestHash(req) {
  const forwarded = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const address = req.headers.get('cf-connecting-ip') || forwarded || 'unknown';
  return sha256Hex(`${serviceKey().slice(0, 48)}:${address}`);
}
async function issueChallenge(req, flow, challenge, userId, name) {
  const { data, error } = await admin.rpc('security_control_issue_webauthn_challenge', {
    p_flow: flow,
    p_challenge: challenge,
    p_user_id: userId,
    p_request_hash: await requestHash(req),
    p_device_name: name,
    p_limit: CHALLENGE_LIMIT
  });
  if (error) {
    if (String(error.message || '').includes('RATE_LIMITED')) fail('RATE_LIMITED', 429);
    fail('CHALLENGE_ISSUE_FAILED', 503);
  }
  return uuid(data);
}
async function claimChallenge(ceremonyId, flow) {
  const { data, error } = await admin.rpc('security_control_claim_webauthn_challenge', {
    p_challenge_id: uuid(ceremonyId),
    p_flow: flow
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.challenge) fail('CHALLENGE_INVALID_OR_EXPIRED', 401);
  return {
    user_id: row.user_id ? String(row.user_id) : null,
    challenge: String(row.challenge),
    device_name: row.device_name ? String(row.device_name) : null
  };
}
async function issueSession(userId, email) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email
  });
  const tokenHash = String(link?.properties?.hashed_token || '');
  if (linkError || !tokenHash) fail('SESSION_ISSUE_FAILED', 503);
  const { data: verified, error: verifyError } = await publicAuth.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email'
  });
  if (verifyError || !verified.session || verified.user?.id !== userId) fail('SESSION_ISSUE_FAILED', 503);
  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_in: verified.session.expires_in,
    expires_at: verified.session.expires_at,
    token_type: verified.session.token_type,
    user: {
      id: verified.user.id,
      email: verified.user.email
    },
    passkey: true
  };
}
async function registrationOptions(req, input) {
  const user = await sessionUser(req);
  const { data: existing, error } = await admin.from('security_control_passkeys').select('credential_id,transports').eq('user_id', user.id).is('revoked_at', null).order('created_at', {
    ascending: false
  });
  if (error) fail('PASSKEY_LIST_FAILED', 503);
  if ((existing || []).length >= MAX_PASSKEYS_PER_USER) fail('PASSKEY_LIMIT_REACHED', 409);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.email,
    userID: uuidBytes(user.id),
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials: (existing || []).map((item)=>({
        id: String(item.credential_id),
        transports: transports(item.transports)
      })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required'
    },
    supportedAlgorithmIDs: [
      -7,
      -257
    ],
    preferredAuthenticatorType: 'localDevice'
  });
  const name = deviceName(input.device_name);
  const ceremonyId = await issueChallenge(req, 'registration', options.challenge, user.id, name);
  return json(req, {
    ceremony_id: ceremonyId,
    publicKey: options,
    policy: {
      user_verification: 'required',
      resident_key: 'required',
      attestation: 'none'
    }
  });
}
async function registrationVerify(req, input) {
  const user = await sessionUser(req);
  const claimed = await claimChallenge(input.ceremony_id, 'registration');
  if (claimed.user_id !== user.id) fail('CHALLENGE_USER_MISMATCH', 403);
  const response = input.credential;
  if (!response || typeof response !== 'object') fail('INVALID_REQUEST', 400);
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: claimed.challenge,
      expectedOrigin: SECURITY_ORIGIN,
      expectedRPID: RP_ID,
      requireUserPresence: true,
      requireUserVerification: true,
      supportedAlgorithmIDs: [
        -7,
        -257
      ]
    });
  } catch  {
    fail('PASSKEY_VERIFICATION_FAILED', 401);
  }
  if (!result.verified || !result.registrationInfo?.userVerified) fail('PASSKEY_VERIFICATION_FAILED', 401);
  const info = result.registrationInfo;
  const credential = info.credential;
  const { data: duplicate, error: duplicateError } = await admin.from('security_control_passkeys').select('id,user_id').eq('credential_id', credential.id).maybeSingle();
  if (duplicateError) fail('PASSKEY_SAVE_FAILED', 503);
  if (duplicate && String(duplicate.user_id) !== user.id) fail('PASSKEY_ALREADY_REGISTERED', 409);
  const record = {
    user_id: user.id,
    credential_id: credential.id,
    public_key: bytea(credential.publicKey),
    webauthn_user_id: base64url(uuidBytes(user.id)),
    counter: credential.counter,
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    transports: transports(response.response?.transports),
    friendly_name: deviceName(claimed.device_name),
    aaguid: info.aaguid || null,
    last_used_at: new Date().toISOString(),
    revoked_at: null
  };
  const { data: saved, error: saveError } = await admin.from('security_control_passkeys').upsert(record, {
    onConflict: 'credential_id'
  }).select('id,friendly_name,device_type,backed_up,created_at,last_used_at').single();
  if (saveError || !saved) fail('PASSKEY_SAVE_FAILED', 503);
  await admin.from('security_control_passkey_audit').insert({
    user_id: user.id,
    passkey_id: saved.id,
    event_type: 'registered'
  });
  console.log(JSON.stringify({
    event: 'passkey_registered',
    user_id: user.id,
    passkey_id: saved.id
  }));
  return json(req, {
    ok: true,
    passkey: saved
  }, 201);
}
async function authenticationOptions(req) {
  const { count, error } = await admin.from('security_control_passkeys').select('id', {
    count: 'exact',
    head: true
  }).is('revoked_at', null);
  if (error) fail('PASSKEY_LIST_FAILED', 503);
  if (!count) fail('NO_PASSKEY_REGISTERED', 404);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    timeout: 60000,
    userVerification: 'required'
  });
  const ceremonyId = await issueChallenge(req, 'authentication', options.challenge, null, null);
  return json(req, {
    ceremony_id: ceremonyId,
    publicKey: options,
    policy: {
      discoverable: true,
      user_verification: 'required'
    }
  });
}
async function authenticationVerify(req, input) {
  const claimed = await claimChallenge(input.ceremony_id, 'authentication');
  const response = input.credential;
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') fail('INVALID_REQUEST', 400);
  const { data: stored, error: storedError } = await admin.from('security_control_passkeys').select('id,user_id,credential_id,public_key,webauthn_user_id,counter,transports').eq('credential_id', response.id).is('revoked_at', null).maybeSingle();
  if (storedError || !stored) fail('PASSKEY_NOT_RECOGNIZED', 401);
  if (String(response.response?.userHandle || '') !== String(stored.webauthn_user_id)) {
    fail('PASSKEY_USER_MISMATCH', 401);
  }
  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(String(stored.user_id));
  const authUser = userResult?.user;
  if (userError || !authUser?.email) fail('ACCESS_DENIED', 403);
  const { data: allow, error: allowError } = await admin.from('security_console_admins').select('role,active').eq('user_id', stored.user_id).maybeSingle();
  if (allowError || !allow?.active) fail('ACCESS_DENIED', 403);
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: claimed.challenge,
      expectedOrigin: SECURITY_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: String(stored.credential_id),
        publicKey: bytesFromBytea(stored.public_key),
        counter: Number(stored.counter || 0),
        transports: transports(stored.transports)
      },
      requireUserVerification: true,
      advancedFIDOConfig: {
        userVerification: 'required'
      }
    });
  } catch  {
    fail('PASSKEY_VERIFICATION_FAILED', 401);
  }
  if (!result.verified || !result.authenticationInfo.userVerified) fail('PASSKEY_VERIFICATION_FAILED', 401);
  const usedAt = new Date().toISOString();
  const { error: updateError } = await admin.from('security_control_passkeys').update({
    counter: result.authenticationInfo.newCounter,
    device_type: result.authenticationInfo.credentialDeviceType,
    backed_up: result.authenticationInfo.credentialBackedUp,
    last_used_at: usedAt
  }).eq('id', stored.id).eq('user_id', stored.user_id).is('revoked_at', null);
  if (updateError) fail('PASSKEY_UPDATE_FAILED', 503);
  await admin.from('security_control_passkey_audit').insert({
    user_id: stored.user_id,
    passkey_id: stored.id,
    event_type: 'authenticated'
  });
  const session = await issueSession(String(stored.user_id), authUser.email.toLowerCase());
  console.log(JSON.stringify({
    event: 'passkey_login_success',
    user_id: stored.user_id,
    passkey_id: stored.id
  }));
  return json(req, session);
}
async function listPasskeys(req) {
  const user = await sessionUser(req);
  const { data, error } = await admin.from('security_control_passkeys').select('id,friendly_name,device_type,backed_up,transports,created_at,last_used_at').eq('user_id', user.id).is('revoked_at', null).order('created_at', {
    ascending: false
  });
  if (error) fail('PASSKEY_LIST_FAILED', 503);
  return json(req, {
    passkeys: data || [],
    limit: MAX_PASSKEYS_PER_USER
  });
}
async function revokePasskey(req, input) {
  const user = await sessionUser(req);
  const passkeyId = uuid(input.passkey_id);
  const { data, error } = await admin.from('security_control_passkeys').update({
    revoked_at: new Date().toISOString()
  }).eq('id', passkeyId).eq('user_id', user.id).is('revoked_at', null).select('id').maybeSingle();
  if (error) fail('PASSKEY_REVOKE_FAILED', 503);
  if (!data) fail('PASSKEY_NOT_FOUND', 404);
  await admin.from('security_control_passkey_audit').insert({
    user_id: user.id,
    passkey_id: passkeyId,
    event_type: 'revoked'
  });
  console.log(JSON.stringify({
    event: 'passkey_revoked',
    user_id: user.id,
    passkey_id: passkeyId
  }));
  return json(req, {
    ok: true
  });
}
Deno.serve(async (req)=>{
  const origin = req.headers.get('origin') || '';
  if (origin && origin !== SECURITY_ORIGIN) return json(req, {
    ok: false,
    code: 'ORIGIN_DENIED'
  }, 403);
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: responseHeaders(req)
  });
  const route = routeName(req);
  try {
    if (req.method === 'GET' && route === 'health') {
      return json(req, {
        ok: true,
        service: RP_NAME,
        version: VERSION,
        rp_id: RP_ID,
        user_verification: 'required',
        resident_key: 'required',
        biometric_data_stored: false
      });
    }
    if (req.method === 'GET' && route === 'passkeys') return await listPasskeys(req);
    if (req.method !== 'POST') return json(req, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED'
    }, 405);
    const input = await readJson(req);
    if (route === 'registration/options') return await registrationOptions(req, input);
    if (route === 'registration/verify') return await registrationVerify(req, input);
    if (route === 'authentication/options') return await authenticationOptions(req);
    if (route === 'authentication/verify') return await authenticationVerify(req, input);
    if (route === 'revoke') return await revokePasskey(req, input);
    return json(req, {
      ok: false,
      code: 'NOT_FOUND'
    }, 404);
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || 'INTERNAL_ERROR');
    const safeStatus = [
      400,
      401,
      403,
      404,
      409,
      413,
      415,
      429,
      503
    ].includes(status) ? status : 500;
    const safeCode = safeStatus === 500 ? 'INTERNAL_ERROR' : code;
    console.error(JSON.stringify({
      event: 'passkey_error',
      route,
      code: safeCode,
      status: safeStatus
    }));
    return json(req, {
      ok: false,
      code: safeCode
    }, safeStatus);
  }
});
