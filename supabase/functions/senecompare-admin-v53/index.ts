import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const VERSION = '5.3.0';
const PROJECT_URL = 'https://xmdpmtvieqgoorbxytey.supabase.co';
const PROD = 'https://senecompare.dakarstyle.com';
const OWNER_EMAIL = 'idrissaminata@gmail.com';
const ALLOWED_ORIGINS = new Set([PROD, 'http://localhost:5173', 'http://localhost:8787']);
const PUBLIC_EVENTS = new Set([
  'page_view','session_start','search_submit','install_prompt','install_click','app_installed',
  'share','ad_impression','ad_click','partner_form_open','partner_lead_submitted',
]);
const LEAD_STATUSES = new Set(['new','contacted','qualified','won','closed']);

function serviceKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed.default || Object.values(parsed)[0];
      if (typeof value === 'string' && value.length > 20) return value;
    } catch { /* fallback */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function anonKey() {
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}

function serviceClient() {
  const key = serviceKey();
  if (!key) throw Object.assign(new Error('SERVICE_UNAVAILABLE'), { status: 503 });
  return createClient(PROJECT_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function authClient(token = '') {
  const key = anonKey();
  if (!key) throw Object.assign(new Error('AUTH_UNAVAILABLE'), { status: 503 });
  return createClient(PROJECT_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

function originAllowed(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : PROD,
    'Access-Control-Allow-Headers': 'authorization,content-type,x-client-version',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-SeneCompare-Admin-Version': VERSION,
    Vary: 'Origin',
  };
}

function json(request: Request, payload: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validEmail(value: unknown) {
  const normalized = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function validPhone(value: unknown) {
  const normalized = String(value ?? '').replace(/[^+\d]/g, '').slice(0, 20);
  return !normalized || /^\+?\d{8,15}$/.test(normalized) ? normalized : '';
}

async function readJson(request: Request, maxBytes = 16_384) {
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('JSON_REQUIRED'), { status: 415 });
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  try {
    const data = JSON.parse(text || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 });
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

function clientIdentity(request: Request) {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unknown';
}

async function rateAllowed(request: Request, action: string, limit: number) {
  const keyHash = await sha256(`${action}:${clientIdentity(request)}`);
  const { data, error } = await serviceClient().rpc('sc_take_rate_limit', {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: 60,
  });
  return !error && data === true;
}

function route(url: URL) {
  const path = url.pathname.replace(/^.*\/senecompare-admin-v53/, '') || '/health';
  if (path === '/health') return 'health';
  if (path === '/ads') return 'ads';
  if (path === '/track') return 'track';
  if (path === '/partners/leads') return 'lead';
  if (path === '/admin/auth/request') return 'auth-request';
  if (path === '/admin/overview') return 'overview';
  if (path === '/admin/campaigns') return 'campaigns';
  if (path === '/admin/leads') return 'leads';
  if (path === '/admin/export') return 'export';
  return 'unknown';
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  const { data, error } = await authClient(token).auth.getUser(token);
  if (error || !data.user?.id || !data.user.email) throw Object.assign(new Error('AUTH_INVALID'), { status: 401 });
  const { data: admin, error: adminError } = await serviceClient()
    .from('senecompare_admin_users')
    .select('user_id,email,role,active')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .maybeSingle();
  if (adminError || !admin || admin.email !== data.user.email.toLowerCase()) {
    throw Object.assign(new Error('ADMIN_FORBIDDEN'), { status: 403 });
  }
  return admin;
}

async function publicAds(request: Request) {
  const now = new Date().toISOString();
  const { data, error } = await serviceClient()
    .from('senecompare_ad_campaigns')
    .select('id,slug,brand,badge_fr,badge_wo,title_fr,title_wo,description_fr,description_wo,cta_fr,cta_wo,destination_url,image_url,creative,priority')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('priority', { ascending: false })
    .limit(8);
  if (error) throw Object.assign(new Error('ADS_UNAVAILABLE'), { status: 503 });
  return json(request, { ok: true, version: VERSION, campaigns: data || [] });
}

async function trackEvent(request: Request) {
  if (!await rateAllowed(request, 'senecompare_analytics_v53', 360)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
  const input = await readJson(request, 8_192);
  const eventType = clean(input.event_type, 40);
  if (!PUBLIC_EVENTS.has(eventType)) return json(request, { ok: false, code: 'EVENT_INVALID' }, 400);
  const visitorId = clean(input.visitor_id, 120);
  const sessionId = clean(input.session_id, 120);
  if (visitorId.length < 8 || sessionId.length < 8) return json(request, { ok: false, code: 'IDENTITY_REQUIRED' }, 400);
  const campaignSlug = clean(input.campaign_slug, 64);
  let campaignId: string | null = null;
  if (campaignSlug) {
    const { data } = await serviceClient().from('senecompare_ad_campaigns').select('id').eq('slug', campaignSlug).maybeSingle();
    campaignId = data?.id || null;
  }
  const localeRaw = clean(input.locale, 8).toLowerCase();
  const locale = localeRaw === 'wo' ? 'wo' : localeRaw === 'fr' ? 'fr' : 'other';
  const deviceRaw = clean(input.device, 12).toLowerCase();
  const device = ['mobile','tablet','desktop'].includes(deviceRaw) ? deviceRaw : 'other';
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {};
  const { error } = await serviceClient().from('senecompare_analytics_events').insert({
    event_type: eventType,
    visitor_hash: await sha256(`visitor:${visitorId}`),
    session_hash: await sha256(`session:${sessionId}`),
    path: clean(input.path, 240) || '/',
    referrer_host: clean(input.referrer_host, 180) || 'direct',
    locale,
    device,
    campaign_id: campaignId,
    metadata,
  });
  if (error) throw Object.assign(new Error('TRACK_FAILED'), { status: 503 });
  return json(request, { ok: true }, 202);
}

async function createLead(request: Request) {
  if (!await rateAllowed(request, 'senecompare_partner_lead_v53', 8)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
  const input = await readJson(request, 12_288);
  const businessName = clean(input.business_name, 160);
  const contactName = clean(input.contact_name, 160);
  const email = validEmail(input.email);
  const phone = validPhone(input.phone);
  const visitorId = clean(input.visitor_id, 120);
  if (businessName.length < 2 || contactName.length < 2 || !email || visitorId.length < 8) {
    return json(request, { ok: false, code: 'LEAD_FIELDS_REQUIRED' }, 400);
  }
  const { data, error } = await serviceClient().from('senecompare_partner_leads').insert({
    business_name: businessName,
    contact_name: contactName,
    email,
    phone,
    placement: clean(input.placement, 80) || 'banner',
    message: clean(input.message, 1500),
    source_campaign: clean(input.source_campaign, 64) || 'advertise-on-senecompare',
    visitor_hash: await sha256(`visitor:${visitorId}`),
  }).select('id').single();
  if (error) throw Object.assign(new Error('LEAD_WRITE_FAILED'), { status: 503 });
  return json(request, { ok: true, id: data.id, message: 'Demande reçue. SeneCompare vous contactera.' }, 201);
}

async function requestAdminLogin(request: Request) {
  if (!await rateAllowed(request, 'senecompare_admin_login_v53', 5)) return json(request, { ok: false, code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
  const input = await readJson(request, 2_048);
  const email = validEmail(input.email);
  const { data: admin } = await serviceClient().from('senecompare_admin_users').select('active').eq('email', email).eq('active', true).maybeSingle();
  if (!email || email !== OWNER_EMAIL || !admin) return json(request, { ok: true, message: 'Si cette adresse est autorisée, un lien a été envoyé.' });
  const { error } = await authClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${PROD}/admin` },
  });
  if (error) throw Object.assign(new Error('LOGIN_EMAIL_FAILED'), { status: 503 });
  return json(request, { ok: true, message: 'Lien sécurisé envoyé à votre adresse.' });
}

async function adminOverview(request: Request, url: URL) {
  const admin = await requireAdmin(request);
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 30), 365));
  const { data, error } = await serviceClient().rpc('senecompare_admin_overview', { p_days: days });
  if (error) throw Object.assign(new Error('OVERVIEW_FAILED'), { status: 503 });
  return json(request, { ok: true, version: VERSION, admin: { email: admin.email, role: admin.role }, overview: data });
}

async function updateCampaign(request: Request) {
  await requireAdmin(request);
  const input = await readJson(request, 16_384);
  const slug = clean(input.slug, 64);
  if (!slug) return json(request, { ok: false, code: 'SLUG_REQUIRED' }, 400);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.active === 'boolean') update.active = input.active;
  if (Number.isFinite(Number(input.priority))) update.priority = Math.max(0, Math.min(Number(input.priority), 1000));
  for (const field of ['title_fr','title_wo','description_fr','description_wo','cta_fr','cta_wo','brand']) {
    if (typeof input[field] === 'string') update[field] = clean(input[field], field.startsWith('description') ? 600 : 180);
  }
  if (typeof input.destination_url === 'string' && /^https:\/\//i.test(input.destination_url)) update.destination_url = clean(input.destination_url, 600);
  const { data, error } = await serviceClient().from('senecompare_ad_campaigns').update(update).eq('slug', slug).select('slug,active,priority,updated_at').single();
  if (error) throw Object.assign(new Error('CAMPAIGN_UPDATE_FAILED'), { status: 503 });
  return json(request, { ok: true, campaign: data });
}

async function updateLead(request: Request) {
  await requireAdmin(request);
  const input = await readJson(request, 4_096);
  const id = clean(input.id, 64);
  const status = clean(input.status, 24);
  if (!id || !LEAD_STATUSES.has(status)) return json(request, { ok: false, code: 'LEAD_UPDATE_INVALID' }, 400);
  const { data, error } = await serviceClient().from('senecompare_partner_leads')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id).select('id,status,updated_at').single();
  if (error) throw Object.assign(new Error('LEAD_UPDATE_FAILED'), { status: 503 });
  return json(request, { ok: true, lead: data });
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function exportLeads(request: Request) {
  await requireAdmin(request);
  const { data, error } = await serviceClient().from('senecompare_partner_leads')
    .select('created_at,business_name,contact_name,email,phone,placement,status,message').order('created_at', { ascending: false }).limit(5000);
  if (error) throw Object.assign(new Error('EXPORT_FAILED'), { status: 503 });
  const rows = [['Date','Entreprise','Contact','Email','Téléphone','Placement','Statut','Message'], ...(data || []).map((item) => [item.created_at,item.business_name,item.contact_name,item.email,item.phone,item.placement,item.status,item.message])];
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  return new Response(`\ufeff${body}`, {
    status: 200,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="senecompare-partenaires.csv"',
    },
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const currentRoute = route(url);
  if (request.method === 'OPTIONS') {
    if (!originAllowed(request)) return new Response(null, { status: 403, headers: corsHeaders(request) });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (!originAllowed(request)) return json(request, { ok: false, code: 'ORIGIN_FORBIDDEN' }, 403);

  try {
    if (currentRoute === 'health' && request.method === 'GET') return json(request, { ok: true, service: 'SeneCompare Admin & Ads', version: VERSION, owner_configured: true, privacy_mode: 'no_raw_ip' });
    if (currentRoute === 'ads' && request.method === 'GET') return publicAds(request);
    if (currentRoute === 'track' && request.method === 'POST') return trackEvent(request);
    if (currentRoute === 'lead' && request.method === 'POST') return createLead(request);
    if (currentRoute === 'auth-request' && request.method === 'POST') return requestAdminLogin(request);
    if (currentRoute === 'overview' && request.method === 'GET') return adminOverview(request, url);
    if (currentRoute === 'campaigns' && request.method === 'PATCH') return updateCampaign(request);
    if (currentRoute === 'leads' && request.method === 'PATCH') return updateLead(request);
    if (currentRoute === 'export' && request.method === 'GET') return exportLeads(request);
    return json(request, { ok: false, code: 'NOT_FOUND' }, 404);
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    const code = clean((error as Error)?.message || 'INTERNAL_ERROR', 80);
    console.error(JSON.stringify({ event: 'senecompare_admin_v53_error', route: currentRoute, code, status }));
    return json(request, { ok: false, code: status >= 500 ? 'SERVICE_UNAVAILABLE' : code }, status);
  }
});
