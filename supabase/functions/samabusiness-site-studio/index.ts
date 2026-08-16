import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { VERSION, audit, authenticate, buildConfig, clean, corsHeaders, db, fail, hasUnscannedImages, json, language, moderate, moderationLog, multiline, objective, originAllowed, plan, sha256, siteSummary, uniqueSiteId, verifyPreviewToken } from "./core.ts";
import { renderSite } from "./render.ts";
async function ownedSite(context, value) {
  const siteId = clean(value, 80);
  if (!siteId) fail("Site introuvable.", 404, "SITE_NOT_FOUND");
  let query = db.from("sama_generated_sites").select("*").eq("site_id", siteId);
  if (!context.isAdmin) query = query.eq("account_id", context.account.id);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) fail("Site introuvable.", 404, "SITE_NOT_FOUND");
  return result.data;
}
async function bootstrap(req) {
  const context = await authenticate(req);
  const result = await db.from("sama_generated_sites").select("*").eq("account_id", context.account.id).order("updated_at", {
    ascending: false
  }).limit(100);
  if (result.error) throw result.error;
  const sites = await Promise.all((result.data ?? []).map(siteSummary));
  let adminSummary = null;
  if (context.isAdmin) {
    const all = await db.from("sama_generated_sites").select("status,safety_status,domain_status").eq("visible_in_admin", true);
    if (all.error) throw all.error;
    const rows = all.data ?? [];
    adminSummary = {
      totalSites: rows.length,
      draft: rows.filter((row)=>row.status === "draft").length,
      published: rows.filter((row)=>row.status === "published").length,
      suspended: rows.filter((row)=>row.status === "suspended").length,
      requiresReview: rows.filter((row)=>row.safety_status === "requires_review").length,
      domainsInError: rows.filter((row)=>row.domain_status === "erreur").length
    };
  }
  return json(req, {
    ok: true,
    version: VERSION,
    merchant: context.merchant,
    role: context.account.role,
    canWrite: context.canWrite,
    isAdmin: context.isAdmin,
    sites,
    adminSummary,
    safety: {
      policyVersion: "1.0",
      illegalCommerceBlocked: true,
      pornographicContentBlocked: true,
      regulatedActivitiesRequireReview: true,
      serverSideEnforcement: true,
      unscannedImagesBlocked: true
    }
  });
}
function moderationPayload(body) {
  return JSON.stringify({
    brandName: clean(body.brandName, 120),
    sector: clean(body.sector, 120),
    description: multiline(body.description, 1200),
    headline: clean(body.headline, 120),
    subheadline: multiline(body.subheadline, 500),
    about: multiline(body.about, 900),
    products: Array.isArray(body.products) ? body.products.slice(0, 30).map((item)=>multiline(item, 250)) : []
  });
}
async function generate(req, body) {
  const context = await authenticate(req, true);
  const brand = clean(body.brandName || context.merchant.name, 120);
  if (brand.length < 2) fail("Le nom de l’activité est requis.", 400, "BRAND_REQUIRED");
  const input = moderationPayload(body);
  const decision = moderate(input);
  const inputHash = await sha256(input);
  if (decision.status === "blocked") {
    await moderationLog(context, null, inputHash, decision);
    await audit(context, "site_generate", "blocked", null, "PROHIBITED_CONTENT", {
      categories: decision.categories
    });
    return json(req, {
      ok: false,
      generationMode: "rejected",
      schemaVersion: "1.1",
      error: "Cette demande concerne un contenu ou une activité interdite par les règles de sécurité de Sama Business.",
      code: "PROHIBITED_CONTENT",
      safetyDecision: {
        status: "blocked",
        reasonCode: "PROHIBITED_CONTENT",
        category: decision.categories.join(", "),
        requiresHumanReview: false
      }
    }, 422);
  }
  const siteId = await uniqueSiteId(brand);
  const config = buildConfig(body, context, siteId, decision);
  const safetyStatus = decision.status === "requires_review" ? "requires_review" : "approved";
  const insert = await db.from("sama_generated_sites").insert({
    site_id: siteId,
    account_id: context.account.id,
    merchant_id: context.merchant.id,
    brand_name: brand,
    sector: config.adminMetadata.sector,
    objective: objective(body.objective),
    language: language(body.language),
    plan: plan(body.plan || context.account.subscription_plan),
    status: "draft",
    safety_status: safetyStatus,
    risk_level: decision.riskLevel,
    sama_subdomain: `${siteId}.samabusiness.site`,
    custom_domain: null,
    domain_status: "non_connecte",
    ssl_status: "en_attente",
    site_config: config,
    generator_version: VERSION,
    visible_in_admin: true
  }).select("*").single();
  if (insert.error) throw insert.error;
  const version = await db.from("sama_site_versions").insert({
    generated_site_id: insert.data.id,
    version_number: 1,
    site_config: config,
    safety_status: safetyStatus,
    created_by_account_id: context.account.id
  });
  if (version.error) throw version.error;
  await moderationLog(context, insert.data.id, inputHash, decision);
  await audit(context, "site_generate", decision.status === "requires_review" ? "review" : "success", insert.data.id, decision.status === "requires_review" ? "REGULATED_ACTIVITY" : null, {
    siteId
  });
  return json(req, {
    ok: true,
    version: VERSION,
    site: await siteSummary(insert.data),
    siteConfig: config,
    safetyDecision: {
      status: decision.status,
      riskLevel: decision.riskLevel,
      categories: decision.categories,
      reasons: decision.reasons,
      requiresHumanReview: decision.status === "requires_review"
    }
  }, 201);
}
async function getSite(req, body) {
  const context = await authenticate(req);
  const site = await ownedSite(context, body.siteId);
  const versions = await db.from("sama_site_versions").select("version_number,safety_status,created_at").eq("generated_site_id", site.id).order("version_number", {
    ascending: false
  }).limit(20);
  if (versions.error) throw versions.error;
  return json(req, {
    ok: true,
    site: await siteSummary(site),
    siteConfig: site.site_config,
    versions: versions.data ?? []
  });
}
async function updateSite(req, body) {
  const context = await authenticate(req, true);
  const site = await ownedSite(context, body.siteId);
  if (site.status === "suspended" && !context.isAdmin) fail("Ce site est suspendu.", 403, "SITE_SUSPENDED");
  const incoming = body.siteConfig && typeof body.siteConfig === "object" ? body.siteConfig : site.site_config;
  const serialized = JSON.stringify(incoming);
  if (serialized.length > 100_000) fail("Configuration trop volumineuse.", 413, "PAYLOAD_TOO_LARGE");
  if (hasUnscannedImages(incoming)) fail("Les images doivent être analysées avant publication.", 422, "IMAGE_UPLOAD_REQUIRES_SCAN");
  const decision = moderate(serialized);
  const inputHash = await sha256(serialized);
  if (decision.status === "blocked") {
    await moderationLog(context, site.id, inputHash, decision);
    await audit(context, "site_update", "blocked", site.id, "PROHIBITED_CONTENT", {
      categories: decision.categories
    });
    fail("La modification contient un produit ou contenu interdit.", 422, "PROHIBITED_CONTENT");
  }
  const config = structuredClone(incoming);
  config.generatorVersion = VERSION;
  config.adminMetadata = {
    ...config.adminMetadata ?? {},
    updatedAt: new Date().toISOString(),
    status: "draft"
  };
  config.deployment = {
    ...config.deployment ?? {},
    samaSubdomain: site.sama_subdomain,
    customDomain: site.custom_domain,
    domainStatus: site.domain_status,
    sslStatus: site.ssl_status
  };
  config.safetyPolicy = {
    ...config.safetyPolicy ?? {},
    moderationStatus: decision.status === "requires_review" ? "requires_review" : "approved",
    riskLevel: decision.riskLevel,
    requiresHumanReview: decision.status === "requires_review",
    detectedCategories: decision.categories
  };
  const latest = await db.from("sama_site_versions").select("version_number").eq("generated_site_id", site.id).order("version_number", {
    ascending: false
  }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  const versionNumber = Number(latest.data?.version_number ?? 0) + 1;
  const safetyStatus = decision.status === "requires_review" ? "requires_review" : "approved";
  const update = await db.from("sama_generated_sites").update({
    site_config: config,
    status: "draft",
    safety_status: safetyStatus,
    risk_level: decision.riskLevel,
    generator_version: VERSION,
    published_at: null
  }).eq("id", site.id).select("*").single();
  if (update.error) throw update.error;
  const version = await db.from("sama_site_versions").insert({
    generated_site_id: site.id,
    version_number: versionNumber,
    site_config: config,
    safety_status: safetyStatus,
    created_by_account_id: context.account.id
  });
  if (version.error) throw version.error;
  await moderationLog(context, site.id, inputHash, decision);
  await audit(context, "site_update", decision.status === "requires_review" ? "review" : "success", site.id, null, {
    version: versionNumber
  });
  return json(req, {
    ok: true,
    site: await siteSummary(update.data),
    siteConfig: config,
    versionNumber,
    safetyDecision: decision
  });
}
async function changeStatus(req, body) {
  const context = await authenticate(req, true);
  const site = await ownedSite(context, body.siteId);
  const action = clean(body.action, 40);
  let status = site.status;
  let publishedAt = site.published_at;
  const patch = {};
  if (action === "publish_site") {
    if (site.safety_status !== "approved") fail("Une validation est requise avant publication.", 409, "SAFETY_REVIEW_REQUIRED");
    status = "published";
    publishedAt = new Date().toISOString();
  } else if (action === "archive_site") {
    status = "archived";
    publishedAt = null;
  } else if (action === "restore_site") {
    if (site.status === "suspended" && !context.isAdmin) fail("Ce site a été suspendu par l’administration.", 403, "ADMIN_REQUIRED");
    status = "draft";
    publishedAt = null;
  } else if (action === "suspend_site") {
    if (!context.isAdmin) fail("Accès administrateur requis.", 403, "ADMIN_REQUIRED");
    status = "suspended";
    publishedAt = null;
  } else if (action === "approve_site") {
    if (!context.isAdmin) fail("Accès administrateur requis.", 403, "ADMIN_REQUIRED");
    status = "draft";
    publishedAt = null;
    patch.safety_status = "approved";
    patch.risk_level = "low";
  } else {
    fail("Action inconnue.", 404, "UNKNOWN_ACTION");
  }
  const update = await db.from("sama_generated_sites").update({
    ...patch,
    status,
    published_at: publishedAt
  }).eq("id", site.id).select("*").single();
  if (update.error) throw update.error;
  await audit(context, action, "success", site.id, null, {
    previousStatus: site.status,
    status
  });
  return json(req, {
    ok: true,
    site: await siteSummary(update.data)
  });
}
async function adminList(req, body) {
  const context = await authenticate(req);
  if (!context.isAdmin) fail("Accès administrateur requis.", 403, "ADMIN_REQUIRED");
  const status = clean(body.status, 30);
  const safetyStatus = clean(body.safetyStatus, 30);
  const term = clean(body.query, 120).toLowerCase();
  let query = db.from("sama_generated_sites").select("*").eq("visible_in_admin", true);
  if ([
    "draft",
    "published",
    "archived",
    "suspended"
  ].includes(status)) query = query.eq("status", status);
  if ([
    "approved",
    "requires_review",
    "blocked"
  ].includes(safetyStatus)) query = query.eq("safety_status", safetyStatus);
  const result = await query.order("updated_at", {
    ascending: false
  }).limit(500);
  if (result.error) throw result.error;
  const rows = result.data ?? [];
  const accountIds = [
    ...new Set(rows.map((row)=>row.account_id))
  ];
  const merchantIds = [
    ...new Set(rows.map((row)=>row.merchant_id))
  ];
  const accounts = accountIds.length ? await db.from("sama_accounts").select("id,display_identifier").in("id", accountIds) : {
    data: [],
    error: null
  };
  const merchants = merchantIds.length ? await db.from("sama_merchants").select("id,name").in("id", merchantIds) : {
    data: [],
    error: null
  };
  if (accounts.error) throw accounts.error;
  if (merchants.error) throw merchants.error;
  const accountMap = new Map((accounts.data ?? []).map((row)=>[
      row.id,
      row.display_identifier
    ]));
  const merchantMap = new Map((merchants.data ?? []).map((row)=>[
      row.id,
      row.name
    ]));
  const filtered = rows.filter((row)=>{
    if (!term) return true;
    return [
      row.site_id,
      row.brand_name,
      row.sector,
      accountMap.get(row.account_id),
      merchantMap.get(row.merchant_id)
    ].some((value)=>String(value ?? "").toLowerCase().includes(term));
  });
  const summaries = await Promise.all(filtered.map(async (row)=>({
      ...await siteSummary(row),
      ownerIdentifier: accountMap.get(row.account_id) ?? null,
      merchantName: merchantMap.get(row.merchant_id) ?? null
    })));
  const dashboard = {
    totalSites: filtered.length,
    draft: filtered.filter((row)=>row.status === "draft").length,
    published: filtered.filter((row)=>row.status === "published").length,
    archived: filtered.filter((row)=>row.status === "archived").length,
    suspended: filtered.filter((row)=>row.status === "suspended").length,
    requiresReview: filtered.filter((row)=>row.safety_status === "requires_review").length,
    domainsInError: filtered.filter((row)=>row.domain_status === "erreur").length,
    sites: summaries
  };
  return json(req, {
    ok: true,
    generationMode: "adminDashboard",
    schemaVersion: "1.1",
    adminDashboard: dashboard
  });
}
async function publicSite(req, url) {
  const siteId = clean(url.searchParams.get("site"), 80);
  if (!siteId) return json(req, {
    ok: true,
    service: "samabusiness-site-studio",
    version: VERSION
  });
  const result = await db.from("sama_generated_sites").select("site_id,status,safety_status,site_config,updated_at").eq("site_id", siteId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return new Response("Site indisponible", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
  const previewAllowed = await verifyPreviewToken(siteId, result.data.updated_at, url.searchParams.get("preview"));
  const publicAllowed = result.data.status === "published" && result.data.safety_status === "approved";
  if (!previewAllowed && !publicAllowed) return new Response("Site indisponible", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
  const html = renderSite(result.data.site_config);
  return new Response(req.method === "HEAD" ? null : html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": previewAllowed ? "private,no-store" : "public,max-age=60,stale-while-revalidate=300",
      "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://samabusiness.dakarstyle.com",
      "permissions-policy": "camera=(),microphone=(),geolocation=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "x-samabusiness-version": VERSION
    }
  });
}
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Forbidden", {
      status: 403
    });
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin)
    });
  }
  if (!originAllowed(origin)) return json(req, {
    ok: false,
    error: "Origin non autorisée."
  }, 403);
  const url = new URL(req.url);
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      return await publicSite(req, url);
    } catch (error) {
      console.error("site_studio_public", error);
      return new Response("Service indisponible", {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }
  }
  if (req.method !== "POST") return json(req, {
    ok: false,
    error: "Méthode non autorisée."
  }, 405);
  try {
    const body = await req.json();
    const action = clean(body.action, 80);
    if (action === "bootstrap") return await bootstrap(req);
    if (action === "generate_site") return await generate(req, body);
    if (action === "get_site") return await getSite(req, body);
    if (action === "update_site") return await updateSite(req, body);
    if ([
      "publish_site",
      "archive_site",
      "restore_site",
      "suspend_site",
      "approve_site"
    ].includes(action)) return await changeStatus(req, body);
    if (action === "admin_list_sites") return await adminList(req, body);
    fail("Action inconnue.", 404, "UNKNOWN_ACTION");
  } catch (unknownError) {
    const error = unknownError;
    const status = error.status ?? 500;
    console.error("site_studio_api", {
      status,
      code: error.code ?? "INTERNAL",
      message: status < 500 ? "handled" : error.message
    });
    return json(req, {
      ok: false,
      error: status < 500 ? error.message : "Une erreur technique est survenue. Réessayez.",
      code: error.code ?? "INTERNAL_ERROR"
    }, status);
  }
});
