import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { TEMPLATES } from "./templates.ts";
export const VERSION = "11.2.2";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!packed) return "";
  try {
    const parsed = JSON.parse(packed);
    const preferred = parsed.default ?? parsed.service_role ?? parsed.serviceRole;
    if (typeof preferred === "string") return preferred;
    for (const value of Object.values(parsed)){
      if (typeof value === "string" && value.length > 40) return value;
    }
  } catch  {
    return packed.length > 40 ? packed : "";
  }
  return "";
}
export const SERVICE_KEY = serviceKey();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SAMA_STUDIO_BACKEND_CONFIG_MISSING");
export const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const encoder = new TextEncoder();
const ALLOWED_ORIGINS = new Set([
  "https://samabusiness.dakarstyle.com",
  "https://samacahier.dakarstyle.com",
  "https://sama-livraison.netlify.app"
]);
export function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.(?:netlify\.app|vercel\.app)$/i.test(origin);
}
export function corsHeaders(origin) {
  const safeOrigin = origin && originAllowed(origin) ? origin : "https://samabusiness.dakarstyle.com";
  return {
    "access-control-allow-origin": safeOrigin,
    "access-control-allow-headers": "content-type,apikey,x-sama-session,x-client-info",
    "access-control-allow-methods": "GET,POST,HEAD,OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION
  };
}
export function json(req, value, status = 200) {
  return Response.json(value, {
    status,
    headers: corsHeaders(req.headers.get("origin"))
  });
}
export function fail(message, status = 400, code = "INVALID_REQUEST") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}
export function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}
export function multiline(value, max = 3000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max);
}
export async function sha256(value, format = "hex") {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  if (format === "hex") return [
    ...bytes
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (const byte of bytes)binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function normalize(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t").replace(/[^a-z0-9\s+.-]/g, " ").replace(/\s+/g, " ");
}
export function moderate(raw) {
  const text = normalize(raw);
  const categories = [];
  const reasons = [];
  const blocked = [
    [
      "minor_sexualization",
      /\b(?:mineur|enfant|adolescent|fillette|garcon|child|minor|teen)\b.{0,60}\b(?:sexe|sexuel|nue?|nudite|porn|erotique|sex|nude|erotic)\b/,
      "Sexualisation de mineur détectée."
    ],
    [
      "sexual_content",
      /\b(?:pornographie|porno|porn|xxx|hentai|nudite sexuelle|acte sexuel|service sexuel|prostitution|escort sexuel|fetichisme|voyeurisme|sex doll|vibrateur|dildo)\b/,
      "Contenu pornographique ou sexuel détecté."
    ],
    [
      "human_exploitation",
      /\b(?:traite des personnes|trafic humain|esclavage|travail force|exploitation sexuelle|human trafficking|forced labor)\b/,
      "Exploitation humaine détectée."
    ],
    [
      "illegal_drugs",
      /\b(?:cocaine|heroine|methamphetamine|ecstasy|mdma|lsd|crack|fentanyl|drogue illicite|stupefiant)\b/,
      "Drogue illicite détectée."
    ],
    [
      "weapons_explosives",
      /\b(?:arme a feu|pistolet|revolver|fusil d assaut|munition|grenade|explosif|bombe artisanale|silencieux|firearm|ammunition)\b/,
      "Arme ou explosif détecté."
    ],
    [
      "fraud_counterfeit",
      /\b(?:contrefacon|produit vole|recel|fausse monnaie|faux document|carte bancaire volee|compte vole|phishing|blanchiment d argent|arnaque|escroquerie|counterfeit|stolen goods)\b/,
      "Fraude ou contrefaçon détectée."
    ],
    [
      "malicious_cyber",
      /\b(?:ransomware|rancongiciel|malware|logiciel malveillant|vol de mot de passe|spyware|phishing kit|service de piratage|attaque ddos)\b/,
      "Service numérique malveillant détecté."
    ],
    [
      "terrorism",
      /\b(?:terrorisme|organisation terroriste|propagande terroriste|financement du terrorisme|recrutement extremiste)\b/,
      "Contenu terroriste détecté."
    ],
    [
      "dangerous_goods",
      /\b(?:produit radioactif|poison interdit|substance chimique interdite|organe humain|ivoire illegal|espece protegee|braconnage)\b/,
      "Produit dangereux ou illégal détecté."
    ]
  ];
  for (const [category, pattern, reason] of blocked){
    if (!pattern.test(text)) continue;
    categories.push(category);
    reasons.push(reason);
  }
  if (categories.length) {
    const critical = categories.some((category)=>[
        "minor_sexualization",
        "human_exploitation",
        "terrorism"
      ].includes(category));
    return {
      status: "blocked",
      riskLevel: critical ? "critical" : "high",
      categories,
      reasons
    };
  }
  const review = [
    [
      "health_pharmacy",
      /\b(?:pharmacie|medicament|clinique|sante|medical|medecin|therapie)\b/,
      "Santé ou pharmacie à vérifier."
    ],
    [
      "finance",
      /\b(?:credit|pret|investissement|placement|assurance|transfert d argent|microfinance|crypto)\b/,
      "Finance ou assurance à vérifier."
    ],
    [
      "legal",
      /\b(?:avocat|notaire|conseil juridique|service juridique)\b/,
      "Service juridique à vérifier."
    ],
    [
      "private_security",
      /\b(?:securite privee|gardiennage|agent de securite)\b/,
      "Sécurité privée à vérifier."
    ],
    [
      "adult_regulated",
      /\b(?:alcool|vin|biere|tabac|cigarette|nicotine|jeu d argent|pari sportif|casino)\b/,
      "Produit réservé aux adultes à vérifier."
    ],
    [
      "donations",
      /\b(?:collecte de dons|don caritatif|association caritative|crowdfunding)\b/,
      "Collecte de fonds à vérifier."
    ]
  ];
  for (const [category, pattern, reason] of review){
    if (!pattern.test(text)) continue;
    categories.push(category);
    reasons.push(reason);
  }
  return categories.length ? {
    status: "requires_review",
    riskLevel: "medium",
    categories,
    reasons
  } : {
    status: "allowed",
    riskLevel: "low",
    categories: [],
    reasons: []
  };
}
export function sectorKey(value) {
  const text = normalize(value);
  if (/mode|vetement|habillement|couture|textile|chaussure/.test(text)) return "mode";
  if (/restaurant|restauration|aliment|repas|traiteur|cuisine|boulanger/.test(text)) return "restauration";
  if (/artisan|menuiser|bijou|creation|decoration|tailleur/.test(text)) return "artisanat";
  if (/immobilier|maison|terrain|appartement|location/.test(text)) return "immobilier";
  if (/ecole|education|formation|cours|academie/.test(text)) return "education";
  if (/agric|elevage|ferme|agro|maraicher/.test(text)) return "agriculture";
  if (/tech|informatique|digital|numerique|logiciel|application|startup/.test(text)) return "technologie";
  if (/beaute|coiffure|salon|esthetique|bien etre|spa/.test(text)) return "beaute";
  if (/commerce|boutique|magasin|vente|produit|ecommerce/.test(text)) return "commerce";
  return "services";
}
export function slugify(value) {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug.length >= 3 ? slug : `site-${crypto.randomUUID().slice(0, 8)}`;
}
export function objective(value) {
  const result = clean(value, 50);
  const allowed = [
    "vendre",
    "recevoir_des_commandes",
    "prendre_rendez_vous",
    "recevoir_des_devis",
    "recevoir_des_contacts",
    "presenter_activite"
  ];
  return allowed.includes(result) ? result : "recevoir_des_contacts";
}
export function language(value) {
  const result = clean(value, 20);
  return result === "wo" || result === "fr_wo" ? result : "fr";
}
export function plan(value) {
  const result = clean(value, 20);
  if (result === "pro" || result === "business") return result;
  return "starter";
}
function ctas(value) {
  const values = {
    vendre: [
      "Voir les produits",
      "Commander maintenant"
    ],
    recevoir_des_commandes: [
      "Voir l’offre",
      "Passer commande"
    ],
    prendre_rendez_vous: [
      "Voir les services",
      "Prendre rendez-vous"
    ],
    recevoir_des_devis: [
      "Découvrir les services",
      "Demander un devis"
    ],
    presenter_activite: [
      "Découvrir l’activité",
      "Nous contacter"
    ]
  };
  return values[value] ?? [
    "Découvrir",
    "Nous contacter"
  ];
}
export function buildConfig(body, context, siteId, decision) {
  const brand = clean(body.brandName || context.merchant.name, 120);
  const key = sectorKey(clean(body.sector || context.merchant.business_type || "Commerce et services", 120));
  const template = TEMPLATES[key] ?? TEMPLATES.services;
  const siteObjective = objective(body.objective);
  const siteLanguage = language(body.language);
  const sitePlan = plan(body.plan || context.account.subscription_plan);
  const [primaryCta, secondaryCta] = ctas(siteObjective);
  const city = clean(body.city || "Sénégal", 80);
  const phone = clean(body.phone || context.merchant.phone, 30) || null;
  const whatsapp = clean(body.whatsapp || phone, 30) || null;
  const email = clean(body.email, 180) || null;
  const now = new Date().toISOString();
  const primaryColor = /^#[0-9a-f]{6}$/i.test(clean(body.primaryColor, 7)) ? clean(body.primaryColor, 7).toUpperCase() : template.primary;
  return {
    generationMode: "site",
    schemaVersion: "1.1",
    generatorVersion: VERSION,
    siteId,
    ownerId: context.account.id,
    adminMetadata: {
      status: "draft",
      createdAt: now,
      updatedAt: now,
      plan: sitePlan,
      sector: template.sector,
      visibleInAdminDashboard: true
    },
    deployment: {
      samaSubdomain: `${siteId}.samabusiness.site`,
      customDomain: null,
      domainStatus: "non_connecte",
      dnsInstructions: {
        subdomain: {
          type: "CNAME",
          host: "www",
          value: `${siteId}.samabusiness.site`
        },
        rootDomain: {
          type: "A",
          host: "@",
          value: "IP_A_INJECTER_PAR_LE_SYSTEME"
        },
        note: "Utilisez le CNAME pour un sous-domaine. Pour le domaine racine, utilisez l’adresse A fournie par Sama Business."
      },
      sslStatus: "en_attente"
    },
    siteMetadata: {
      title: brand,
      description: `${brand} propose ${template.sector.toLowerCase()} à ${city}. Découvrez une offre claire et contactez directement l’entreprise depuis votre téléphone.`.slice(0, 160),
      language: siteLanguage === "wo" ? "wo" : "fr",
      locale: siteLanguage === "wo" ? "wo-SN" : "fr-SN",
      keywords: [
        template.sector.toLowerCase(),
        brand.toLowerCase(),
        city.toLowerCase()
      ]
    },
    theme: {
      primaryColor,
      secondaryColor: template.secondary,
      accentColor: template.accent,
      backgroundColor: template.background,
      surfaceColor: "#FFFFFF",
      textColor: "#10231C",
      mutedTextColor: "#667085",
      fontFamily: template.font,
      borderRadius: "rounded-xl"
    },
    navigation: {
      brandName: brand,
      logoUrl: null,
      links: [
        {
          label: "Accueil",
          anchor: "#hero",
          visual: "🏠"
        },
        {
          label: "Services",
          anchor: "#features",
          visual: template.icon
        },
        {
          label: "À propos",
          anchor: "#about",
          visual: "ℹ️"
        },
        {
          label: "Contact",
          anchor: "#contact",
          visual: "💬"
        }
      ],
      ctaButton: {
        text: secondaryCta,
        link: "#contact"
      }
    },
    sections: [
      {
        type: "hero",
        id: "hero",
        data: {
          badge: "Simple • Local • Mobile",
          visualIcon: template.icon,
          headline: clean(body.headline, 96) || template.headline,
          subheadline: multiline(body.subheadline || body.description, 320) || template.subheadline,
          primaryCta: {
            text: primaryCta,
            link: "#features"
          },
          secondaryCta: {
            text: secondaryCta,
            link: "#contact"
          },
          imageUrl: null,
          imageAlt: `Illustration simple représentant ${template.sector.toLowerCase()}`
        }
      },
      {
        type: "features",
        id: "features",
        data: {
          sectionTitle: key === "commerce" || key === "mode" ? "Ce que vous trouverez" : "Nos solutions",
          sectionSubtitle: "Des informations visuelles, courtes et faciles à utiliser depuis un téléphone.",
          items: template.features.map(([icon, title, description])=>({
              icon,
              title,
              description
            }))
        }
      },
      {
        type: "about",
        id: "about",
        data: {
          sectionTitle: `À propos de ${brand}`,
          headline: "Une activité proche de ses clients",
          description: multiline(body.about, 700) || `Une présence en ligne pensée pour rapprocher ${brand} de ses clients avec un parcours rapide, visuel et adapté au téléphone.`,
          values: [
            {
              title: "Clarté",
              description: "Les informations importantes sont visibles sans longs paragraphes."
            },
            {
              title: "Proximité",
              description: "Le contact se fait directement par téléphone ou WhatsApp."
            },
            {
              title: "Confiance",
              description: "Les prix, délais et conditions sont présentés avant le contact."
            }
          ],
          imageUrl: null,
          imageAlt: `Présentation de ${brand}`
        }
      },
      {
        type: "testimonials",
        id: "testimonials",
        data: {
          sectionTitle: "Expériences clients",
          sectionSubtitle: "Exemples fictifs à remplacer par des avis vérifiés.",
          items: [
            {
              quote: "J’ai trouvé l’information utile et contacté l’entreprise directement.",
              author: "Awa N.",
              role: "Cliente fictive",
              fictional: true
            },
            {
              quote: "Les services et conditions étaient clairs avant mon échange.",
              author: "Moussa D.",
              role: "Client fictif",
              fictional: true
            }
          ]
        }
      },
      {
        type: "contact",
        id: "contact",
        data: {
          sectionTitle: secondaryCta,
          sectionSubtitle: "Choisissez le moyen le plus simple pour vous.",
          methods: [
            {
              type: "phone",
              label: "Appeler",
              value: phone,
              visual: "📞"
            },
            {
              type: "whatsapp",
              label: "WhatsApp",
              value: whatsapp,
              visual: "💬"
            },
            {
              type: "email",
              label: "E-mail",
              value: email,
              visual: "✉️"
            }
          ].filter((method)=>method.value !== null),
          form: {
            enabled: true,
            fields: [
              {
                name: "name",
                label: "Votre nom",
                type: "text",
                required: true,
                visual: "👤"
              },
              {
                name: "phone",
                label: "Votre téléphone",
                type: "tel",
                required: true,
                visual: "📞"
              },
              {
                name: "message",
                label: "Votre besoin",
                type: "textarea",
                required: true,
                visual: "💬"
              }
            ],
            submitText: "Envoyer ma demande"
          }
        }
      },
      {
        type: "ctaBanner",
        id: "cta",
        data: {
          title: "Prêt à avancer ?",
          subtitle: "Un appel ou un message suffit pour commencer.",
          buttonText: secondaryCta,
          buttonLink: "#contact"
        }
      },
      {
        type: "footer",
        id: "footer",
        data: {
          brandName: brand,
          description: `${template.sector} • ${city}`,
          copyright: `© ${new Date().getUTCFullYear()} ${brand}. Tous droits réservés.`,
          socialLinks: [],
          legalLinks: [
            {
              label: "Mentions légales",
              url: "#"
            },
            {
              label: "Politique de confidentialité",
              url: "#"
            }
          ]
        }
      }
    ],
    safetyPolicy: {
      moderationStatus: decision.status === "requires_review" ? "requires_review" : "approved",
      riskLevel: decision.riskLevel,
      requiresHumanReview: decision.status === "requires_review",
      detectedCategories: decision.categories,
      commerceCompliance: {
        illegalProductsBlocked: true,
        regulatedProductsRequireVerification: true,
        counterfeitProductsBlocked: true,
        stolenGoodsBlocked: true,
        fraudulentServicesBlocked: true
      },
      contentSafety: {
        pornographicContentBlocked: true,
        sexualizedContentBlocked: true,
        minorSexualizationBlocked: true,
        sexualServicesBlocked: true,
        violentSexualContentBlocked: true
      },
      imageSafety: {
        generatedImagesMustBeModerated: true,
        uploadedImagesMustBeScanned: true,
        unsafeImagesQuarantined: true,
        automaticPublicationOfFlaggedImages: false
      },
      publicationControls: {
        serverSideValidationRequired: true,
        auditLoggingEnabled: true,
        manualReviewSupported: true,
        policyVersion: "1.0"
      }
    },
    localAccessibility: {
      iconFirstNavigation: true,
      largeTouchTargets: true,
      lowLiteracyMode: true,
      voiceGuidanceReady: true,
      lowBandwidthMode: true,
      languages: siteLanguage === "fr_wo" ? [
        "fr",
        "wo"
      ] : [
        siteLanguage
      ],
      wolofLabels: {
        home: "Dalal jamm",
        services: "Li nu lay jox",
        contact: "Wax ak nun",
        call: "Woote",
        whatsapp: "Bind ci WhatsApp"
      }
    }
  };
}
export async function authenticate(req, requireWrite = false) {
  const token = req.headers.get("x-sama-session")?.trim() ?? "";
  if (!token.startsWith("sama_") || token.length < 40) fail("Connexion requise.", 401, "AUTH_REQUIRED");
  const tokenHash = await sha256(token, "base64url");
  const sessionResult = await db.from("sama_sessions").select("account_id,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (sessionResult.error) throw sessionResult.error;
  const session = sessionResult.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    fail("Session expirée. Reconnectez-vous.", 401, "SESSION_EXPIRED");
  }
  const accountResult = await db.from("sama_accounts").select("id,role,is_active,suspended_at,subscription_status,trial_ends_at,subscription_paid_until,subscription_plan,display_identifier").eq("id", session.account_id).maybeSingle();
  if (accountResult.error) throw accountResult.error;
  const account = accountResult.data;
  if (!account?.is_active || account.suspended_at) fail("Compte désactivé.", 403, "ACCOUNT_DISABLED");
  const merchantResult = await db.from("sama_merchants").select("id,account_id,name,phone,currency,locale,timezone,business_type").eq("account_id", account.id).maybeSingle();
  if (merchantResult.error) throw merchantResult.error;
  if (!merchantResult.data) fail("Commerce introuvable.", 404, "MERCHANT_NOT_FOUND");
  const now = Date.now();
  const isAdmin = account.role === "admin";
  const canWrite = isAdmin || account.subscription_status === "active" && new Date(account.subscription_paid_until || 0).getTime() > now || account.subscription_status === "trialing" && new Date(account.trial_ends_at || 0).getTime() > now;
  if (requireWrite && !canWrite) fail("Votre essai ou abonnement est terminé.", 402, "SUBSCRIPTION_REQUIRED");
  return {
    account,
    merchant: merchantResult.data,
    isAdmin,
    canWrite
  };
}
export async function uniqueSiteId(brand) {
  const base = slugify(brand);
  for(let attempt = 0; attempt < 5; attempt += 1){
    const suffix = attempt === 0 ? "" : `-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    const candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    const result = await db.from("sama_generated_sites").select("id").eq("site_id", candidate).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return candidate;
  }
  return `site-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(SERVICE_KEY), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  let binary = "";
  for (const byte of bytes)binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export async function previewToken(siteId, updatedAt, ttlSeconds = 900) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = await hmac(`${siteId}.${updatedAt}.${expires}`);
  return `${expires}.${signature}`;
}
export async function verifyPreviewToken(siteId, updatedAt, token) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = await hmac(`${siteId}.${updatedAt}.${expires}`);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for(let index = 0; index < expected.length; index += 1)difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return difference === 0;
}
export async function siteSummary(row) {
  const token = await previewToken(row.site_id, row.updated_at);
  return {
    id: row.id,
    siteId: row.site_id,
    brandName: row.brand_name,
    sector: row.sector,
    objective: row.objective,
    language: row.language,
    plan: row.plan,
    status: row.status,
    safetyStatus: row.safety_status,
    riskLevel: row.risk_level,
    samaSubdomain: row.sama_subdomain,
    customDomain: row.custom_domain,
    domainStatus: row.domain_status,
    sslStatus: row.ssl_status,
    generatorVersion: row.generator_version,
    visibleInAdminDashboard: row.visible_in_admin,
    previewUrl: `${SUPABASE_URL}/functions/v1/samabusiness-site-studio?site=${encodeURIComponent(row.site_id)}&preview=${encodeURIComponent(token)}`,
    publicUrl: `${SUPABASE_URL}/functions/v1/samabusiness-site-studio?site=${encodeURIComponent(row.site_id)}`,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
export async function audit(context, action, outcome, siteId, reasonCode, metadata = {}) {
  const result = await db.from("sama_site_audit_logs").insert({
    generated_site_id: siteId,
    account_id: context.account?.id ?? null,
    merchant_id: context.merchant?.id ?? null,
    action,
    outcome,
    reason_code: reasonCode,
    metadata
  });
  if (result.error) console.error("site_audit_write", result.error.message);
}
export async function moderationLog(context, siteId, inputHash, decision) {
  const result = await db.from("sama_site_moderation_events").insert({
    generated_site_id: siteId,
    account_id: context.account?.id ?? null,
    merchant_id: context.merchant?.id ?? null,
    input_hash: inputHash,
    decision: decision.status,
    risk_level: decision.riskLevel,
    categories: decision.categories,
    reasons: decision.reasons
  });
  if (result.error) console.error("site_moderation_write", result.error.message);
}
export function hasUnscannedImages(config) {
  const visit = (value)=>{
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(visit);
    for (const [key, child] of Object.entries(value)){
      if ((key === "imageUrl" || key === "logoUrl") && typeof child === "string" && child.trim()) return true;
      if (visit(child)) return true;
    }
    return false;
  };
  return visit(config);
}
