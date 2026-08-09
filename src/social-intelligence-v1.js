const VERSION = '1.0.0';
const BRAIN_KEY = 'visuals/social-intelligence/brain.json';
const HISTORY_KEY = 'visuals/social-intelligence/history.json';
const DEFAULT_DASHBOARD_KEY_SHA256 = 'dbdaa2a66dfdba3f092a4d517404254bb4f12fda33491c0a86ec8dc118478cd6';
const DEFAULT_WRITE_KEY_SHA256 = 'ed51c5e5e73785e254d4ee5974193b22cecbb29b667c5651641d838e5bbcde35';
const MAX_MEDIA = 50;
const MAX_HISTORY = 120;

export async function handleSocialIntelligence(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/social-intelligence' || url.pathname === '/social-intelligence/') {
    return handleDashboard(request, env);
  }

  if (url.pathname === '/api/social-intelligence/health') {
    return handleHealth(request, env);
  }

  if (url.pathname === '/api/social-intelligence/data') {
    return handleData(request, env);
  }

  if (url.pathname === '/api/social-intelligence/snapshot') {
    return handleSnapshot(request, env);
  }

  if (url.pathname === '/api/social-intelligence/sync-instagram') {
    return handleInstagramSyncRequest(request, env, ctx);
  }

  return new Response('Not Found', { status: 404 });
}

export async function runInstagramSync(env, ctx) {
  if (!hasInstagramConfig(env)) {
    return { ok: false, skipped: true, error: 'instagram_not_configured' };
  }

  const startedAt = Date.now();
  const profile = await fetchInstagramProfile(env);
  const accountInsights = await fetchAccountInsights(env).catch(() => ({}));
  const media = await fetchInstagramMedia(env);
  const enriched = await mapWithConcurrency(media.slice(0, MAX_MEDIA), 5, async (item) => {
    const insights = await fetchMediaInsights(env, item).catch(() => ({}));
    return normalizeMedia(item, insights);
  });

  const previous = await readJson(env, BRAIN_KEY, null);
  const brain = buildBrain(enriched, profile, accountInsights, previous);
  brain.sync = {
    source: 'instagram_graph_api',
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
    graph_host: graphBase(env),
    api_version: String(env.INSTAGRAM_API_VERSION || 'default'),
  };

  await saveBrain(env, brain);
  await appendHistory(env, brain);

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(Promise.resolve());
  }

  return {
    ok: true,
    version: VERSION,
    sample_count: brain.sample_count,
    score: brain.score,
    synced_at: brain.updated_at,
  };
}

async function handleDashboard(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405, headers: securityHeaders('text/plain; charset=utf-8') });
  }

  const authorized = await isDashboardAuthorized(request, env);
  if (!authorized) {
    return htmlResponse(renderAccessDenied(), 403, request.method === 'HEAD');
  }

  const brain = await readJson(env, BRAIN_KEY, emptyBrain());
  const history = await readJson(env, HISTORY_KEY, []);
  return htmlResponse(renderDashboard(brain, history, env), 200, request.method === 'HEAD');
}

async function handleHealth(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const brain = await readJson(env, BRAIN_KEY, null);
  return json({
    ok: true,
    app: 'SOWHAT Social Intelligence',
    version: VERSION,
    instagram_configured: hasInstagramConfig(env),
    storage_configured: Boolean(env.VISUALS_BUCKET),
    has_data: Boolean(brain && Number(brain.sample_count || 0) > 0),
    sample_count: Number(brain?.sample_count || 0),
    updated_at: brain?.updated_at || null,
  }, 200, securityHeaders('application/json; charset=utf-8'));
}

async function handleData(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }
  if (!(await isDashboardAuthorized(request, env))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  const brain = await readJson(env, BRAIN_KEY, emptyBrain());
  return json(brain, 200, securityHeaders('application/json; charset=utf-8'));
}

async function handleSnapshot(request, env) {
  const cors = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
  if (!(await isWriteAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.VISUALS_BUCKET) return json({ ok: false, error: 'missing_r2_binding_VISUALS_BUCKET' }, 500, cors);

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ ok: false, error: 'invalid_payload' }, 400, cors);
    }

    const brain = normalizeExternalBrain(payload);
    await saveBrain(env, brain);
    await appendHistory(env, brain);
    return json({ ok: true, version: VERSION, sample_count: brain.sample_count, score: brain.score, saved_at: brain.updated_at }, 200, cors);
  } catch (error) {
    return json({ ok: false, error: 'snapshot_failed', detail: errorMessage(error) }, 500, cors);
  }
}

async function handleInstagramSyncRequest(request, env, ctx) {
  const cors = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
  if (!(await isWriteAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401, cors);

  try {
    const result = await runInstagramSync(env, ctx);
    return json(result, result.ok ? 200 : 503, cors);
  } catch (error) {
    return json({ ok: false, error: 'instagram_sync_failed', detail: errorMessage(error) }, 502, cors);
  }
}

function hasInstagramConfig(env) {
  return Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID);
}

async function fetchInstagramProfile(env) {
  const data = await instagramFetch(env, `/${encodeURIComponent(env.INSTAGRAM_USER_ID)}`, {
    fields: 'id,username,name,followers_count,media_count,profile_picture_url',
  });
  return {
    id: String(data.id || env.INSTAGRAM_USER_ID || ''),
    username: String(data.username || ''),
    name: String(data.name || ''),
    followers_count: finite(data.followers_count),
    media_count: finite(data.media_count),
    profile_picture_url: safeHttps(data.profile_picture_url),
  };
}

async function fetchInstagramMedia(env) {
  const data = await instagramFetch(env, `/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/media`, {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url',
    limit: String(MAX_MEDIA),
  });
  return Array.isArray(data.data) ? data.data : [];
}

async function fetchAccountInsights(env) {
  const groups = [
    ['reach', 'profile_views', 'accounts_engaged', 'total_interactions', 'views'],
    ['reach', 'profile_views', 'total_interactions'],
  ];

  for (const metrics of groups) {
    try {
      const data = await instagramFetch(env, `/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/insights`, {
        metric: metrics.join(','),
        period: 'day',
      });
      return flattenInsights(data);
    } catch (_) {
      // Try a smaller metric set because Meta availability varies by account and API version.
    }
  }
  return {};
}

async function fetchMediaInsights(env, media) {
  const id = encodeURIComponent(String(media.id || ''));
  if (!id) return {};

  const commonGroups = [
    ['views', 'reach', 'shares', 'saved', 'total_interactions'],
    ['reach', 'shares', 'saved', 'total_interactions'],
    ['reach', 'shares', 'saved'],
  ];

  let base = {};
  for (const metrics of commonGroups) {
    try {
      const data = await instagramFetch(env, `/${id}/insights`, { metric: metrics.join(',') });
      base = flattenInsights(data);
      break;
    } catch (_) {
      // Metric availability differs for Reels, feed posts, carousels and Stories.
    }
  }

  const isReel = String(media.media_product_type || media.media_type || '').toUpperCase().includes('REEL');
  if (!isReel) return base;

  try {
    const reel = await instagramFetch(env, `/${id}/insights`, {
      metric: 'ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate',
    });
    return { ...base, ...flattenInsights(reel) };
  } catch (_) {
    return base;
  }
}

async function instagramFetch(env, path, params = {}) {
  if (!hasInstagramConfig(env)) throw new Error('instagram_not_configured');
  const version = sanitizeApiVersion(env.INSTAGRAM_API_VERSION);
  const root = graphBase(env).replace(/\/$/, '');
  const url = new URL(`${root}${version ? `/${version}` : ''}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`,
      accept: 'application/json',
      'user-agent': `SOWHAT-Social-Intelligence/${VERSION}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `instagram_http_${response.status}`;
    throw new Error(message);
  }
  return data;
}

function graphBase(env) {
  const configured = String(env.INSTAGRAM_GRAPH_BASE || '').trim();
  if (configured === 'https://graph.facebook.com' || configured === 'https://graph.instagram.com') return configured;
  return 'https://graph.instagram.com';
}

function sanitizeApiVersion(value) {
  const raw = String(value || '').trim();
  return /^v\d+\.\d+$/.test(raw) ? raw : '';
}

function flattenInsights(payload) {
  const result = {};
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  for (const row of rows) {
    const name = String(row?.name || '').trim();
    if (!name) continue;
    let value = row?.total_value?.value;
    if (value === undefined && Array.isArray(row?.values) && row.values.length) value = row.values[row.values.length - 1]?.value;
    if (value === undefined) value = row?.value;
    result[name] = finite(value);
  }
  return result;
}

function normalizeMedia(item, insights) {
  const views = finite(insights.views || insights.plays || insights.ig_reels_aggregated_all_plays_count);
  const reach = finite(insights.reach || views);
  const likes = finite(item.like_count || insights.likes);
  const comments = finite(item.comments_count || insights.comments);
  const shares = finite(insights.shares);
  const saves = finite(insights.saved);
  const totalInteractions = finite(insights.total_interactions || likes + comments + shares + saves);
  const denominator = Math.max(1, reach || views);

  return {
    id: String(item.id || ''),
    caption: cleanText(item.caption, 700),
    hook: extractHook(item.caption),
    media_type: normalizeMediaType(item),
    permalink: safeInstagramPermalink(item.permalink),
    timestamp: normalizeIso(item.timestamp),
    views,
    reach,
    likes,
    comments,
    shares,
    saves,
    total_interactions: totalInteractions,
    engagement_rate: round4(totalInteractions / denominator),
    share_rate: round4(shares / denominator),
    save_rate: round4(saves / denominator),
    comment_rate: round4(comments / denominator),
    avg_watch_time_ms: finite(insights.ig_reels_avg_watch_time),
    total_watch_time_ms: finite(insights.ig_reels_video_view_total_time),
    skip_rate: normalizeRate(insights.reels_skip_rate),
  };
}

function buildBrain(media, profile, accountInsights, previous) {
  const rows = media.filter((item) => item.id);
  const baselines = {
    views: median(rows.map((x) => x.views)),
    reach: median(rows.map((x) => x.reach)),
    engagement_rate: median(rows.map((x) => x.engagement_rate)),
    share_rate: median(rows.map((x) => x.share_rate)),
    save_rate: median(rows.map((x) => x.save_rate)),
    comment_rate: median(rows.map((x) => x.comment_rate)),
  };

  const scored = rows.map((item) => scoreMedia(item, baselines)).sort((a, b) => b.score - a.score);
  const pillars = scorePillars(scored);
  const score = Math.round(avg(Object.values(pillars)));
  const recommendations = buildRecommendations(scored, baselines, pillars);
  const formats = rankFormats(scored);
  const cadence = cadenceSummary(scored);
  const maturity = scored.length >= 30 ? 'MATURE' : scored.length >= 12 ? 'LEARNING' : 'EARLY';
  const previousScore = finite(previous?.score);
  const delta = previousScore ? score - previousScore : 0;

  return {
    version: VERSION,
    source: 'instagram_graph_api',
    updated_at: new Date().toISOString(),
    sample_count: scored.length,
    maturity,
    score,
    score_delta: delta,
    profile: {
      id: String(profile?.id || ''),
      username: String(profile?.username || ''),
      name: String(profile?.name || ''),
      followers_count: finite(profile?.followers_count),
      media_count: finite(profile?.media_count),
      profile_picture_url: safeHttps(profile?.profile_picture_url),
    },
    account: {
      reach: finite(accountInsights.reach),
      profile_views: finite(accountInsights.profile_views),
      accounts_engaged: finite(accountInsights.accounts_engaged),
      total_interactions: finite(accountInsights.total_interactions),
      views: finite(accountInsights.views),
    },
    pillars,
    baselines,
    cadence,
    rankings: { formats },
    top_media: scored.slice(0, 12),
    recent_media: [...scored].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 20),
    recommendations,
    weekly_plan: buildWeeklyPlan(scored, recommendations),
    connection: {
      instagram: true,
      visual_factory: true,
      automatic_cycle_hours: 6,
    },
  };
}

function scoreMedia(item, baseline) {
  const attraction = weightedAverage([
    [ratioScore(item.views, baseline.views), 0.58],
    [ratioScore(item.reach, baseline.reach), 0.42],
  ]);
  const engagement = ratioScore(item.engagement_rate, baseline.engagement_rate);
  const advocacy = weightedAverage([
    [ratioScore(item.share_rate, baseline.share_rate), 0.55],
    [ratioScore(item.save_rate, baseline.save_rate), 0.45],
  ]);
  const conversation = ratioScore(item.comment_rate, baseline.comment_rate);
  const retention = item.avg_watch_time_ms > 0
    ? clamp(50 + Math.log2(Math.max(0.25, item.avg_watch_time_ms / 5000)) * 18, 0, 100)
    : 50;
  const score = Math.round(weightedAverage([
    [attraction, 0.34],
    [engagement, 0.27],
    [advocacy, 0.22],
    [conversation, 0.10],
    [retention, 0.07],
  ]));

  return {
    ...item,
    score,
    score_components: {
      attraction: Math.round(attraction),
      engagement: Math.round(engagement),
      advocacy: Math.round(advocacy),
      conversation: Math.round(conversation),
      retention: Math.round(retention),
    },
  };
}

function scorePillars(rows) {
  if (!rows.length) return { attraction: 0, engagement: 0, advocacy: 0, regularity: 0 };
  return {
    attraction: Math.round(avg(rows.map((x) => x.score_components.attraction))),
    engagement: Math.round(avg(rows.map((x) => x.score_components.engagement))),
    advocacy: Math.round(avg(rows.map((x) => x.score_components.advocacy))),
    regularity: Math.round(regularityScore(rows)),
  };
}

function regularityScore(rows) {
  const dates = rows.map((x) => Date.parse(x.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
  if (dates.length < 4) return 50;
  const gaps = [];
  for (let i = 1; i < dates.length; i += 1) gaps.push((dates[i] - dates[i - 1]) / 86400000);
  const mean = avg(gaps);
  if (!mean) return 50;
  const variance = avg(gaps.map((x) => (x - mean) ** 2));
  const cv = Math.sqrt(variance) / mean;
  const consistency = clamp(100 - cv * 60, 20, 100);
  const frequency = clamp(35 + (7 / Math.max(0.75, mean)) * 9, 25, 100);
  return weightedAverage([[consistency, 0.65], [frequency, 0.35]]);
}

function rankFormats(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.media_type || 'POST';
    const current = map.get(key) || { key, n: 0, score: 0, views: 0, reach: 0, interactions: 0 };
    current.n += 1;
    current.score += row.score;
    current.views += row.views;
    current.reach += row.reach;
    current.interactions += row.total_interactions;
    map.set(key, current);
  }
  return [...map.values()].map((x) => ({
    key: x.key,
    n: x.n,
    avg_score: Math.round(x.score / Math.max(1, x.n)),
    views: x.views,
    reach: x.reach,
    interactions: x.interactions,
  })).sort((a, b) => b.avg_score - a.avg_score);
}

function cadenceSummary(rows) {
  const sorted = [...rows].filter((x) => x.timestamp).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  if (sorted.length < 2) return { posts_per_week: 0, median_gap_days: 0, consistency: 'insufficient_data' };
  const timestamps = sorted.map((x) => Date.parse(x.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < timestamps.length; i += 1) gaps.push((timestamps[i] - timestamps[i - 1]) / 86400000);
  const gap = median(gaps);
  return {
    posts_per_week: round2(7 / Math.max(0.5, gap || 7)),
    median_gap_days: round2(gap),
    consistency: gap <= 2.5 ? 'high' : gap <= 4.5 ? 'medium' : 'low',
  };
}

function buildRecommendations(rows, baseline, pillars) {
  if (!rows.length) {
    return {
      headline: 'Connecte Instagram pour démarrer l’apprentissage réel.',
      summary: 'Le moteur attend les premières statistiques. Aucun score fictif ne sera inventé.',
      wins: [],
      fixes: [],
      next_actions: ['Configurer la connexion Instagram professionnelle', 'Lancer une première synchronisation', 'Analyser au moins 12 contenus pour stabiliser les tendances'],
    };
  }

  const best = rows[0];
  const weakestPillar = Object.entries(pillars).sort((a, b) => a[1] - b[1])[0];
  const bestFormat = rankFormats(rows)[0];
  const avgShare = avg(rows.map((x) => x.share_rate));
  const avgSave = avg(rows.map((x) => x.save_rate));
  const avgComment = avg(rows.map((x) => x.comment_rate));
  const wins = [];
  const fixes = [];

  wins.push(`${bestFormat?.key || best.media_type} est actuellement le format le plus solide avec un score moyen de ${bestFormat?.avg_score || best.score}/100.`);
  if (best.hook) wins.push(`Ton meilleur contenu ouvre avec « ${best.hook} ». Cette structure mérite une variation contrôlée.`);
  if (best.views > baseline.views * 1.5) wins.push(`Le meilleur contenu réalise ${formatRatio(best.views / Math.max(1, baseline.views))}× la médiane de vues du compte.`);

  if (weakestPillar?.[0] === 'engagement') fixes.push('L’audience regarde davantage qu’elle n’interagit : renforcer la question, le CTA et la prise de position dans la légende.');
  if (weakestPillar?.[0] === 'advocacy') fixes.push('Les partages et enregistrements sont le point le plus faible : produire davantage de contenu utile à conserver ou envoyer à quelqu’un.');
  if (weakestPillar?.[0] === 'regularity') fixes.push('La cadence est irrégulière : verrouiller des créneaux récurrents avant d’augmenter le volume.');
  if (weakestPillar?.[0] === 'attraction') fixes.push('La portée est le point de friction : retravailler la première seconde, la couverture et le sujet avant de toucher au reste.');
  if (avgComment < Math.max(0.001, baseline.comment_rate * 0.8)) fixes.push('Les commentaires restent sous le signal attendu : terminer les contenus par une vraie question qui appelle une réponse personnelle.');
  if (avgShare > avgSave * 1.8) wins.push('Le contenu est davantage partagé qu’enregistré : ton audience réagit bien aux formats transmissibles et conversationnels.');

  return {
    headline: `Score ${Math.round(avg(rows.map((x) => x.score)))}/100 · priorité : ${pillarLabel(weakestPillar?.[0])}.`,
    summary: `Le moteur compare chaque contenu à ta propre médiane, pas à un seuil générique. ${best.media_type} domine actuellement et le prochain cycle doit tester une variation du meilleur schéma plutôt qu’un changement complet de direction.`,
    wins: wins.slice(0, 4),
    fixes: fixes.slice(0, 4),
    next_actions: [
      `Reproduire la structure du contenu #1 en changeant uniquement le sujet ou le produit.`,
      `Créer un ${bestFormat?.key || best.media_type} orienté ${weakestPillar?.[0] === 'advocacy' ? 'partage/enregistrement' : weakestPillar?.[0] === 'engagement' ? 'commentaire' : 'rétention'} dans les 72 h.`,
      'Après publication, comparer à la médiane du compte avant de modifier la stratégie suivante.',
    ],
  };
}

function buildWeeklyPlan(rows, recommendations) {
  const best = rows[0];
  const bestFormat = rankFormats(rows)[0]?.key || best?.media_type || 'REEL';
  return [
    { day: 'Lundi', type: bestFormat, objective: 'Reproduire le pattern gagnant', action: best?.hook ? `Variation du hook « ${best.hook} »` : 'Variation contrôlée du meilleur contenu' },
    { day: 'Mercredi', type: 'STORY', objective: 'Conversation', action: 'Question courte + sondage + renvoi vers le produit ou le Reel principal' },
    { day: 'Vendredi', type: bestFormat, objective: 'Partage / enregistrement', action: recommendations.next_actions?.[1] || 'Contenu utile, transmissible et immédiatement compréhensible' },
    { day: 'Dimanche', type: 'REVIEW', objective: 'Apprentissage', action: 'Comparer les scores, conserver un seul changement gagnant pour la semaine suivante' },
  ];
}

function normalizeExternalBrain(payload) {
  const now = new Date().toISOString();
  const recent = Array.isArray(payload.top_media) ? payload.top_media : Array.isArray(payload.recent_top) ? payload.recent_top : [];
  const rows = recent.map((item) => ({
    id: String(item.id || item.asset_id || ''),
    caption: cleanText(item.caption || item.title, 700),
    hook: extractHook(item.caption || item.title),
    media_type: String(item.media_type || item.format || 'POST').toUpperCase(),
    permalink: safeInstagramPermalink(item.permalink),
    timestamp: normalizeIso(item.timestamp || item.published_at || now),
    views: finite(item.views),
    reach: finite(item.reach),
    likes: finite(item.likes),
    comments: finite(item.comments),
    shares: finite(item.shares),
    saves: finite(item.saves),
    total_interactions: finite(item.total_interactions || finite(item.likes) + finite(item.comments) + finite(item.shares) + finite(item.saves)),
    engagement_rate: finite(item.engagement_rate),
    share_rate: finite(item.share_rate),
    save_rate: finite(item.save_rate),
    comment_rate: finite(item.comment_rate),
    avg_watch_time_ms: finite(item.avg_watch_time_ms),
    total_watch_time_ms: finite(item.total_watch_time_ms),
    skip_rate: normalizeRate(item.skip_rate),
    score: clamp(Math.round(finite(item.score)), 0, 100),
    score_components: item.score_components && typeof item.score_components === 'object' ? item.score_components : {},
  }));

  if (rows.length && rows.some((x) => !x.score)) {
    const rebuilt = buildBrain(rows, payload.profile || {}, payload.account || {}, null);
    return { ...rebuilt, source: cleanText(payload.source || 'external_snapshot', 80), updated_at: now };
  }

  return {
    ...emptyBrain(),
    ...payload,
    version: VERSION,
    source: cleanText(payload.source || 'external_snapshot', 80),
    updated_at: now,
    sample_count: Math.max(finite(payload.sample_count), rows.length),
    score: clamp(Math.round(finite(payload.score || avg(rows.map((x) => x.score)))), 0, 100),
    top_media: rows.slice(0, 12),
    recent_media: rows.slice(0, 20),
  };
}

async function saveBrain(env, brain) {
  if (!env.VISUALS_BUCKET) throw new Error('missing_r2_binding_VISUALS_BUCKET');
  await env.VISUALS_BUCKET.put(BRAIN_KEY, JSON.stringify(brain, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
    customMetadata: { app: 'sowhat_social_intelligence', version: VERSION, saved_at: brain.updated_at || new Date().toISOString() },
  });
}

async function appendHistory(env, brain) {
  if (!env.VISUALS_BUCKET) return;
  const history = await readJson(env, HISTORY_KEY, []);
  const rows = Array.isArray(history) ? history : [];
  rows.unshift({
    updated_at: brain.updated_at,
    score: finite(brain.score),
    sample_count: finite(brain.sample_count),
    pillars: brain.pillars || {},
    profile_followers: finite(brain.profile?.followers_count),
  });
  await env.VISUALS_BUCKET.put(HISTORY_KEY, JSON.stringify(rows.slice(0, MAX_HISTORY), null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' },
  });
}

async function readJson(env, key, fallback) {
  if (!env.VISUALS_BUCKET) return fallback;
  try {
    const object = await env.VISUALS_BUCKET.get(key);
    if (!object) return fallback;
    return JSON.parse(await object.text());
  } catch (_) {
    return fallback;
  }
}

async function isDashboardAuthorized(request, env) {
  const url = new URL(request.url);
  const provided = String(request.headers.get('X-SOWHAT-DASHBOARD-KEY') || url.searchParams.get('k') || '').trim();
  if (!provided) return false;
  const expected = String(env.SOCIAL_INTELLIGENCE_ADMIN_KEY_SHA256 || DEFAULT_DASHBOARD_KEY_SHA256).trim().toLowerCase();
  const actual = await sha256Text(provided);
  return timingSafeEqual(actual, expected);
}

async function isWriteAuthorized(request, env) {
  const provided = String(request.headers.get('X-SOWHAT-KEY') || '').trim();
  if (!provided) return false;
  const expected = String(env.SOCIAL_INTELLIGENCE_WRITE_KEY_SHA256 || DEFAULT_WRITE_KEY_SHA256).trim().toLowerCase();
  const actual = await sha256Text(provided);
  return timingSafeEqual(actual, expected);
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function renderDashboard(brainValue, historyValue, env) {
  const brain = brainValue && typeof brainValue === 'object' ? brainValue : emptyBrain();
  const history = Array.isArray(historyValue) ? historyValue : [];
  const score = clamp(Math.round(finite(brain.score)), 0, 100);
  const delta = finite(brain.score_delta);
  const top = Array.isArray(brain.top_media) ? brain.top_media : [];
  const recent = Array.isArray(brain.recent_media) ? brain.recent_media : [];
  const rec = brain.recommendations || emptyBrain().recommendations;
  const plan = Array.isArray(brain.weekly_plan) ? brain.weekly_plan : [];
  const pillars = brain.pillars || {};
  const formats = Array.isArray(brain.rankings?.formats) ? brain.rankings.formats : [];
  const configured = hasInstagramConfig(env);
  const scoreSeries = history.slice(0, 14).reverse().map((x) => clamp(finite(x.score), 0, 100));
  const visualFactoryUrl = safeHttps(env.VISUAL_FACTORY_URL);

  const dataJson = escapeScriptJson(JSON.stringify({
    scoreSeries,
    score,
    pillars,
    formats,
    recent: recent.slice(0, 20),
  }));

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#07111f">
<title>SOWHAT Social Intelligence</title>
<style>
:root{--bg:#050913;--bg2:#08101d;--panel:#0b1524;--panel2:#0f1c2e;--line:#1d3147;--text:#f5f8fc;--muted:#91a5bc;--soft:#c7d4e3;--accent:#67d7ff;--accent2:#8aa5ff;--good:#5fe0b7;--warn:#ffd36a;--danger:#ff8798;--shadow:0 18px 60px rgba(0,0,0,.34)}*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 82% -10%,rgba(80,163,255,.22),transparent 31%),radial-gradient(circle at 15% 5%,rgba(90,215,255,.12),transparent 28%),linear-gradient(180deg,var(--bg2),var(--bg));min-height:100vh}button,a{font:inherit}.shell{width:min(1500px,100%);margin:0 auto;display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}.side{position:sticky;top:0;height:100vh;padding:26px 18px;border-right:1px solid rgba(141,176,211,.15);background:rgba(5,11,20,.76);backdrop-filter:blur(22px);z-index:20}.brand{display:flex;align-items:center;gap:11px;padding:4px 8px 26px}.brand-mark{width:40px;height:40px;border-radius:13px;background:linear-gradient(145deg,var(--accent),var(--accent2));display:grid;place-items:center;color:#05111a;font-weight:950;box-shadow:0 10px 28px rgba(103,215,255,.22)}.brand strong{display:block;letter-spacing:-.02em}.brand small{display:block;color:var(--muted);margin-top:2px}.nav{display:grid;gap:8px}.nav button{width:100%;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;gap:11px;padding:12px 13px;border-radius:14px;text-align:left;cursor:pointer;font-weight:720}.nav button:hover,.nav button[aria-selected="true"]{background:rgba(103,215,255,.10);color:var(--text)}.nav button[aria-selected="true"]{box-shadow:inset 0 0 0 1px rgba(103,215,255,.20)}.nav-icon{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.045);font-size:13px}.side-foot{position:absolute;left:18px;right:18px;bottom:22px;padding:14px;border:1px solid rgba(122,166,209,.16);border-radius:16px;background:rgba(255,255,255,.025)}.connection-row{display:flex;align-items:center;gap:8px;color:var(--soft);font-size:13px}.dot{width:8px;height:8px;border-radius:50%;background:${configured ? 'var(--good)' : 'var(--warn)'};box-shadow:0 0 0 5px ${configured ? 'rgba(95,224,183,.08)' : 'rgba(255,211,106,.08)'}.side-foot small{display:block;color:var(--muted);margin-top:8px;line-height:1.4}.main{min-width:0;padding:24px clamp(18px,3.2vw,48px) 88px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.identity{display:flex;align-items:center;gap:12px}.avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#173250,#0d2239);border:1px solid rgba(103,215,255,.24);font-weight:900}.identity strong{display:block}.identity small{display:block;color:var(--muted);margin-top:2px}.sync-state{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid rgba(136,171,205,.18);background:rgba(255,255,255,.025);border-radius:999px;color:var(--soft);font-size:13px}.view{display:none}.view.active{display:block}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr);gap:16px;margin-bottom:16px}.hero-card,.panel,.metric{border:1px solid rgba(128,169,208,.16);background:linear-gradient(180deg,rgba(14,28,46,.92),rgba(8,18,31,.93));border-radius:24px;box-shadow:var(--shadow)}.hero-card{padding:clamp(22px,4vw,38px);min-height:300px;position:relative;overflow:hidden}.hero-card:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;top:-110px;background:radial-gradient(circle,rgba(103,215,255,.18),transparent 66%);pointer-events:none}.eyebrow{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);font-weight:850}.hero h1{font-size:clamp(32px,5vw,66px);line-height:.96;letter-spacing:-.055em;margin:12px 0 14px;max-width:830px}.hero-copy{max-width:760px;color:var(--muted);font-size:16px;line-height:1.55}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.chip{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:8px 11px;border:1px solid rgba(129,170,209,.18);background:rgba(255,255,255,.035);color:var(--soft);font-size:12px;font-weight:760}.score-card{padding:24px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.score-ring{--score:${score};width:170px;height:170px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--accent) calc(var(--score)*1%),rgba(103,215,255,.09) 0);position:relative}.score-ring:before{content:"";position:absolute;inset:12px;border-radius:50%;background:#091423;border:1px solid rgba(103,215,255,.13)}.score-inner{position:relative;z-index:1}.score-inner strong{display:block;font-size:52px;letter-spacing:-.06em}.score-inner span{color:var(--muted);font-size:12px}.score-delta{margin-top:16px;color:${delta >= 0 ? 'var(--good)' : 'var(--danger)'};font-weight:800}.score-note{color:var(--muted);font-size:12px;margin-top:6px;line-height:1.4}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.metric{padding:18px;box-shadow:none}.metric-label{color:var(--muted);font-size:12px}.metric-value{font-size:30px;letter-spacing:-.04em;font-weight:900;margin-top:8px}.metric-sub{color:var(--muted);font-size:11px;margin-top:5px}.grid2{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}.panel{padding:20px;box-shadow:none}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.panel h2{font-size:19px;margin:0;letter-spacing:-.02em}.panel-sub{color:var(--muted);font-size:12px;margin-top:4px}.pillars{display:grid;gap:14px}.pillar-row{display:grid;grid-template-columns:120px 1fr 42px;gap:12px;align-items:center}.pillar-label{color:var(--soft);font-size:13px}.track{height:10px;background:rgba(255,255,255,.055);border-radius:999px;overflow:hidden}.fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent2),var(--accent))}.pillar-value{text-align:right;font-weight:850;font-size:13px}.recommendation{border:1px solid rgba(103,215,255,.20);background:linear-gradient(145deg,rgba(103,215,255,.085),rgba(138,165,255,.055));border-radius:18px;padding:18px}.recommendation strong{font-size:18px;line-height:1.25;display:block}.recommendation p{color:var(--soft);line-height:1.55;margin:9px 0 0}.actions{display:grid;gap:9px;margin-top:14px}.action{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:13px;background:rgba(4,10,18,.48);border:1px solid rgba(133,173,210,.12);color:var(--soft);font-size:13px;line-height:1.45}.action-num{flex:0 0 24px;height:24px;border-radius:8px;background:rgba(103,215,255,.12);color:var(--accent);display:grid;place-items:center;font-weight:900;font-size:11px}.section{margin-top:16px}.table-wrap{overflow:auto;border-radius:18px;border:1px solid rgba(132,169,207,.13)}table{width:100%;border-collapse:collapse;min-width:760px;background:rgba(7,15,26,.52)}th,td{padding:13px 14px;text-align:left;border-bottom:1px solid rgba(136,170,204,.10);font-size:13px}th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;background:rgba(255,255,255,.018);position:sticky;top:0}td{color:var(--soft)}tr:last-child td{border-bottom:0}.media-title{max-width:360px;color:var(--text);font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.score-badge{display:inline-grid;place-items:center;min-width:42px;height:30px;border-radius:10px;font-weight:900;border:1px solid rgba(103,215,255,.20);background:rgba(103,215,255,.09);color:var(--accent)}.format-badge{display:inline-block;border:1px solid rgba(132,169,207,.16);border-radius:999px;padding:5px 8px;color:var(--muted);font-size:11px}.media-link{color:var(--accent);text-decoration:none}.media-link:hover{text-decoration:underline}.coach-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.coach-card{padding:20px;border-radius:20px;border:1px solid rgba(128,169,208,.16);background:rgba(10,22,37,.76)}.coach-card h3{margin:0 0 12px;font-size:16px}.coach-card ul{margin:0;padding-left:18px;color:var(--soft)}.coach-card li{margin:9px 0;line-height:1.45}.plan{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.plan-card{padding:17px;border-radius:18px;border:1px solid rgba(128,169,208,.16);background:linear-gradient(180deg,rgba(15,29,48,.85),rgba(7,16,28,.85))}.plan-day{color:var(--accent);font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.plan-type{margin-top:10px;font-size:19px;font-weight:900}.plan-objective{color:var(--soft);margin-top:7px;font-size:13px}.plan-action{color:var(--muted);margin-top:9px;font-size:12px;line-height:1.5}.connection-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.connection-card{padding:20px;border-radius:20px;border:1px solid rgba(128,169,208,.16);background:rgba(10,22,37,.76)}.connection-card h3{margin:0;font-size:17px}.connection-status{display:inline-flex;align-items:center;gap:7px;margin-top:10px;color:${configured ? 'var(--good)' : 'var(--warn)'};font-size:13px;font-weight:800}.connection-card p{color:var(--muted);line-height:1.5;font-size:13px}.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:14px;padding:12px 15px;background:linear-gradient(145deg,var(--accent),#79baff);color:#04101b;text-decoration:none;font-weight:900;cursor:pointer}.cta.secondary{background:rgba(103,215,255,.08);border:1px solid rgba(103,215,255,.18);color:var(--accent)}.empty{padding:34px 18px;text-align:center;color:var(--muted)}.mobile-nav{display:none}.spark{height:44px;display:flex;align-items:flex-end;gap:3px}.spark i{display:block;flex:1;min-width:3px;border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,var(--accent),rgba(103,215,255,.18))}.muted{color:var(--muted)}@media(max-width:1100px){.shell{grid-template-columns:210px minmax(0,1fr)}.hero{grid-template-columns:1fr}.score-card{flex-direction:row;gap:28px;justify-content:flex-start;text-align:left}.score-ring{width:140px;height:140px}.score-inner strong{font-size:44px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.plan{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.shell{display:block}.side{display:none}.main{padding:18px 14px 96px}.topbar{margin-bottom:16px}.sync-state{max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hero-card,.panel,.metric{border-radius:20px}.hero-card{padding:22px;min-height:auto}.hero h1{font-size:38px}.score-card{padding:20px;align-items:center}.score-ring{width:126px;height:126px;flex:0 0 126px}.score-inner strong{font-size:40px}.score-note{max-width:220px}.metrics{gap:9px}.metric{padding:15px}.metric-value{font-size:24px}.grid2,.coach-grid,.connection-grid{grid-template-columns:1fr}.pillar-row{grid-template-columns:100px 1fr 38px}.plan{grid-template-columns:1fr 1fr;gap:9px}.mobile-nav{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(5,1fr);z-index:50;padding:7px;border-radius:18px;background:rgba(7,16,28,.92);backdrop-filter:blur(24px);border:1px solid rgba(125,168,209,.20);box-shadow:0 16px 48px rgba(0,0,0,.45)}.mobile-nav button{border:0;background:transparent;color:var(--muted);padding:9px 3px;border-radius:12px;font-size:10px;font-weight:780}.mobile-nav button[aria-selected="true"]{color:var(--accent);background:rgba(103,215,255,.09)}}@media(max-width:430px){.identity small{max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sync-state{font-size:11px;padding:8px 9px}.score-card{gap:16px}.score-ring{width:112px;height:112px;flex-basis:112px}.score-ring:before{inset:9px}.score-inner strong{font-size:36px}.metrics{grid-template-columns:1fr 1fr}.plan{grid-template-columns:1fr}.hero-copy{font-size:14px}}
</style>
</head>
<body>
<div class="shell">
<aside class="side">
  <div class="brand"><div class="brand-mark">SI</div><div><strong>SOWHAT</strong><small>Social Intelligence</small></div></div>
  <nav class="nav" aria-label="Navigation principale">
    ${navButton('overview','◈','Vue d’ensemble',true)}
    ${navButton('content','▤','Contenus')}
    ${navButton('coach','✦','Coach')}
    ${navButton('plan','▦','Plan 7 jours')}
    ${navButton('connections','◎','Connexions')}
  </nav>
  <div class="side-foot"><div class="connection-row"><span class="dot"></span><strong>${configured ? 'Instagram connecté' : 'Connexion à finaliser'}</strong></div><small>Cycle automatique prévu toutes les 6 h. Les scores sont calculés relativement à ton propre historique.</small></div>
</aside>
<main class="main">
  <header class="topbar"><div class="identity"><div class="avatar">SA</div><div><strong>${escapeHtml(brain.profile?.username ? '@'+brain.profile.username : 'SOWHAT AFRICA')}</strong><small>${formatNumber(brain.profile?.followers_count)} abonnés · ${formatNumber(brain.sample_count)} contenus analysés</small></div></div><div class="sync-state"><span class="dot"></span>${brain.updated_at ? `Analyse ${dateRelative(brain.updated_at)}` : 'En attente de données'}</div></header>

  <section class="view active" data-view="overview">
    <div class="hero">
      <article class="hero-card"><div class="eyebrow">Intelligence de contenu · Instagram</div><h1>Créer moins au hasard.<br>Publier avec une mémoire.</h1><p class="hero-copy">Le moteur mesure tes vrais contenus, compare chaque publication à ta propre médiane et transforme les résultats en décisions pour la prochaine création.</p><div class="chips"><span class="chip">${escapeHtml(brain.maturity || 'EARLY')}</span><span class="chip">Médiane personnelle</span><span class="chip">Reels · Posts · Stories</span><span class="chip">Cycle 6 h</span></div></article>
      <article class="hero-card score-card"><div class="score-ring"><div class="score-inner"><strong>${score}</strong><span>sur 100</span></div></div><div><div class="score-delta">${delta === 0 ? 'Score de référence' : `${delta > 0 ? '+' : ''}${Math.round(delta)} depuis le cycle précédent`}</div><div class="score-note">Score SOWHAT relatif à tes propres performances, pas un chiffre arbitraire comparé à des comptes inconnus.</div><div class="spark" aria-label="Évolution récente du score">${sparkBars(scoreSeries)}</div></div></article>
    </div>
    <div class="metrics">
      ${metricCard('Vues suivies',sum(top,'views'),'sur les meilleurs contenus')}
      ${metricCard('Portée suivie',sum(top,'reach'),'comptes atteints')}
      ${metricCard('Interactions',sum(top,'total_interactions'),'likes + commentaires + partages + sauvegardes')}
      ${metricCard('Cadence',brain.cadence?.posts_per_week ? `${brain.cadence.posts_per_week}/sem.` : '—','rythme médian observé')}
    </div>
    <div class="grid2">
      <article class="panel"><div class="panel-head"><div><h2>Les 4 moteurs</h2><div class="panel-sub">Lecture synthétique de ce qui tire le compte vers le haut ou le bas.</div></div></div><div class="pillars">${pillarRows(pillars)}</div></article>
      <article class="panel"><div class="panel-head"><div><h2>Décision prioritaire</h2><div class="panel-sub">Une seule priorité à exécuter avant de modifier le reste.</div></div></div><div class="recommendation"><strong>${escapeHtml(rec.headline)}</strong><p>${escapeHtml(rec.summary)}</p></div><div class="actions">${(rec.next_actions||[]).slice(0,3).map((x,i)=>`<div class="action"><span class="action-num">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('')}</div></article>
    </div>
    <div class="section panel"><div class="panel-head"><div><h2>Top contenus</h2><div class="panel-sub">Les meilleurs signaux observés sur le compte.</div></div></div>${mediaTable(top.slice(0,6))}</div>
  </section>

  <section class="view" data-view="content">
    <article class="panel"><div class="panel-head"><div><h2>Bibliothèque analysée</h2><div class="panel-sub">Classement relatif aux performances habituelles du compte.</div></div></div>${mediaTable(recent.length ? recent : top)}</article>
  </section>

  <section class="view" data-view="coach">
    <div class="panel"><div class="panel-head"><div><h2>SOWHAT Coach</h2><div class="panel-sub">Diagnostic exploitable, sans inventer des causes que les données ne prouvent pas.</div></div></div><div class="recommendation"><strong>${escapeHtml(rec.headline)}</strong><p>${escapeHtml(rec.summary)}</p></div></div>
    <div class="section coach-grid"><article class="coach-card"><h3>Ce qui marche</h3>${bulletList(rec.wins,'Pas encore assez de données pour identifier un motif gagnant fiable.')}</article><article class="coach-card"><h3>À corriger</h3>${bulletList(rec.fixes,'Aucune faiblesse stable détectée pour le moment.')}</article></div>
    <div class="section coach-card"><h3>Prochaines actions</h3>${bulletList(rec.next_actions,'Lancer une première synchronisation Instagram.')}${visualFactoryUrl ? `<p><a class="cta" href="${escapeHtml(visualFactoryUrl)}" rel="noopener">Créer le prochain contenu ↗</a></p>` : '<p class="muted">Visual Factory est prévu comme destination du prochain contenu. Son URL de production peut être injectée via VISUAL_FACTORY_URL sans modifier ce module.</p>'}</div>
  </section>

  <section class="view" data-view="plan">
    <article class="panel"><div class="panel-head"><div><h2>Plan de contenu · 7 jours</h2><div class="panel-sub">Le planning conserve les patterns gagnants et ne change qu’une variable à la fois.</div></div></div><div class="plan">${planCards(plan)}</div></article>
  </section>

  <section class="view" data-view="connections">
    <div class="connection-grid">
      <article class="connection-card"><h3>Instagram Professional</h3><div class="connection-status"><span class="dot"></span>${configured ? 'Prêt pour la synchronisation' : 'Variables serveur manquantes'}</div><p>Lecture des médias et Insights via l’API officielle. Le token reste côté serveur et n’est jamais injecté dans le navigateur.</p><div class="chip">${escapeHtml(graphBase(env))}</div></article>
      <article class="connection-card"><h3>Visual Factory</h3><div class="connection-status"><span class="dot" style="background:var(--good)"></span>Boucle de création prévue</div><p>Le Coach fournit le pattern à reproduire. Visual Factory peut recevoir ensuite le format, le hook, l’objectif et les contraintes de performance.</p>${visualFactoryUrl ? `<a class="cta secondary" href="${escapeHtml(visualFactoryUrl)}" rel="noopener">Ouvrir Visual Factory ↗</a>` : ''}</article>
      <article class="connection-card"><h3>Stockage analytique</h3><div class="connection-status"><span class="dot" style="background:${env.VISUALS_BUCKET ? 'var(--good)' : 'var(--warn)'}"></span>${env.VISUALS_BUCKET ? 'R2 actif' : 'R2 non lié'}</div><p>Snapshots et historique sont stockés dans le bucket existant, sans créer une nouvelle base inutile.</p></article>
      <article class="connection-card"><h3>Sécurité</h3><div class="connection-status"><span class="dot" style="background:var(--good)"></span>Fail-closed</div><p>Dashboard privé, noindex, clés comparées par SHA-256, token Instagram côté serveur, CSP restrictive et aucune donnée sensible dans le HTML.</p></article>
    </div>
  </section>
</main>
</div>
<nav class="mobile-nav" aria-label="Navigation mobile">
  ${mobileButton('overview','Accueil',true)}${mobileButton('content','Contenus')}${mobileButton('coach','Coach')}${mobileButton('plan','Plan')}${mobileButton('connections','Connexions')}
</nav>
<script>const DATA=${dataJson};(()=>{const buttons=[...document.querySelectorAll('[data-target]')];const views=[...document.querySelectorAll('[data-view]')];function activate(name){views.forEach(v=>v.classList.toggle('active',v.dataset.view===name));buttons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.target===name)));history.replaceState(null,'','#'+name);window.scrollTo({top:0,behavior:'smooth'});}buttons.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.target)));const initial=location.hash.replace('#','');if(views.some(v=>v.dataset.view===initial))activate(initial);})();</script>
</body></html>`;
}

function navButton(target, icon, label, selected = false) {
  return `<button type="button" data-target="${target}" aria-selected="${selected}"><span class="nav-icon">${icon}</span><span>${escapeHtml(label)}</span></button>`;
}
function mobileButton(target, label, selected = false) { return `<button type="button" data-target="${target}" aria-selected="${selected}">${escapeHtml(label)}</button>`; }
function metricCard(label, value, sub) { return `<article class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${typeof value==='number'?formatNumber(value):escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></article>`; }
function pillarRows(pillars) {
  const rows = [['Attraction',finite(pillars.attraction)],['Engagement',finite(pillars.engagement)],['Partage & sauvegarde',finite(pillars.advocacy)],['Régularité',finite(pillars.regularity)]];
  return rows.map(([label,value])=>`<div class="pillar-row"><div class="pillar-label">${escapeHtml(label)}</div><div class="track"><div class="fill" style="width:${clamp(value,0,100)}%"></div></div><div class="pillar-value">${Math.round(value)}</div></div>`).join('');
}
function mediaTable(rows) {
  if (!Array.isArray(rows) || !rows.length) return '<div class="empty">Aucun contenu réel analysé pour le moment.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Score</th><th>Contenu</th><th>Format</th><th>Vues</th><th>Portée</th><th>Interactions</th><th>Partages</th><th>Sauvegardes</th><th></th></tr></thead><tbody>${rows.map((r)=>`<tr><td><span class="score-badge">${Math.round(finite(r.score))}</span></td><td><div class="media-title">${escapeHtml(r.hook||r.caption||'Publication Instagram')}</div><div class="muted">${dateShort(r.timestamp)}</div></td><td><span class="format-badge">${escapeHtml(r.media_type||'POST')}</span></td><td>${formatNumber(r.views)}</td><td>${formatNumber(r.reach)}</td><td>${formatNumber(r.total_interactions)}</td><td>${formatNumber(r.shares)}</td><td>${formatNumber(r.saves)}</td><td>${r.permalink?`<a class="media-link" href="${escapeHtml(r.permalink)}" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}
function bulletList(items, emptyText) { const rows=Array.isArray(items)?items.filter(Boolean):[]; return rows.length?`<ul>${rows.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:`<p class="muted">${escapeHtml(emptyText)}</p>`; }
function planCards(plan) { const rows=Array.isArray(plan)?plan:[]; if(!rows.length)return '<div class="empty">Le plan se générera après les premières statistiques.</div>'; return rows.map(x=>`<article class="plan-card"><div class="plan-day">${escapeHtml(x.day)}</div><div class="plan-type">${escapeHtml(x.type)}</div><div class="plan-objective">${escapeHtml(x.objective)}</div><div class="plan-action">${escapeHtml(x.action)}</div></article>`).join(''); }
function sparkBars(values) { const rows=Array.isArray(values)&&values.length?values:[0]; const max=Math.max(1,...rows); return rows.map(v=>`<i style="height:${Math.max(8,Math.round((finite(v)/max)*42))}px"></i>`).join(''); }

function renderAccessDenied() {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SOWHAT Social Intelligence</title><style>body{margin:0;background:#050913;color:#f5f8fc;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}.box{width:min(520px,100%);padding:28px;border:1px solid #1d3147;border-radius:22px;background:#0b1524}p{color:#91a5bc;line-height:1.55}</style></head><body><main class="box"><h1>Accès privé</h1><p>Utilisez le lien sécurisé SOWHAT Social Intelligence ou fournissez la clé d’administration dans l’en-tête prévu.</p></main></body></html>`;
}

function emptyBrain() {
  return {
    version: VERSION,
    source: 'none',
    updated_at: null,
    sample_count: 0,
    maturity: 'EARLY',
    score: 0,
    score_delta: 0,
    profile: { username: '', followers_count: 0, media_count: 0 },
    account: { reach: 0, profile_views: 0, accounts_engaged: 0, total_interactions: 0, views: 0 },
    pillars: { attraction: 0, engagement: 0, advocacy: 0, regularity: 0 },
    baselines: {},
    cadence: { posts_per_week: 0, median_gap_days: 0, consistency: 'insufficient_data' },
    rankings: { formats: [] },
    top_media: [],
    recent_media: [],
    recommendations: {
      headline: 'Le moteur attend les premières données réelles.',
      summary: 'Aucun score artificiel ne sera affiché avant la première synchronisation.',
      wins: [],
      fixes: [],
      next_actions: ['Connecter Instagram Professional', 'Lancer la synchronisation', 'Laisser le moteur établir une médiane personnelle'],
    },
    weekly_plan: [],
    connection: { instagram: false, visual_factory: true, automatic_cycle_hours: 6 },
  };
}

function normalizeMediaType(item) {
  const product = String(item.media_product_type || '').toUpperCase();
  const type = String(item.media_type || '').toUpperCase();
  if (product.includes('REEL')) return 'REEL';
  if (type === 'CAROUSEL_ALBUM') return 'CARROUSEL';
  if (type === 'VIDEO') return 'VIDÉO';
  if (type === 'IMAGE') return 'POST';
  return product || type || 'POST';
}
function extractHook(value) { const text=cleanText(value,220); if(!text)return ''; return text.split(/\n|[.!?](?:\s|$)/)[0].trim().slice(0,110); }
function cleanText(value, max=500) { return String(value||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function normalizeIso(value) { const t=Date.parse(String(value||'')); return Number.isFinite(t)?new Date(t).toISOString():new Date().toISOString(); }
function safeHttps(value) { try{const url=new URL(String(value||'')); return url.protocol==='https:'?url.toString():'';}catch{return '';} }
function safeInstagramPermalink(value) { try{const url=new URL(String(value||'')); return url.protocol==='https:' && ['instagram.com','www.instagram.com'].includes(url.hostname)?url.toString():'';}catch{return '';} }
function finite(value) { const n=Number(value); return Number.isFinite(n)&&n>0?n:0; }
function normalizeRate(value) { const n=Number(value); if(!Number.isFinite(n)||n<0)return 0; return n>1?round4(n/100):round4(n); }
function round2(value){return Math.round(Number(value||0)*100)/100;} function round4(value){return Math.round(Number(value||0)*10000)/10000;}
function clamp(value,min,max){return Math.min(max,Math.max(min,Number(value)||0));}
function avg(values){const rows=(Array.isArray(values)?values:[]).map(Number).filter(Number.isFinite);return rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:0;}
function median(values){const rows=(Array.isArray(values)?values:[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!rows.length)return 0;const mid=Math.floor(rows.length/2);return rows.length%2?rows[mid]:(rows[mid-1]+rows[mid])/2;}
function ratioScore(value, baseline){const x=Number(value)||0;const b=Number(baseline)||0;if(x<=0&&b<=0)return 50;if(b<=0)return x>0?70:50;const ratio=Math.max(0.125,(x+1e-9)/(b+1e-9));return clamp(50+Math.log2(ratio)*24,0,100);}
function weightedAverage(pairs){let total=0,weight=0;for(const [value,w] of pairs){total+=Number(value||0)*Number(w||0);weight+=Number(w||0);}return weight?total/weight:0;}
function sum(rows,key){return (Array.isArray(rows)?rows:[]).reduce((n,x)=>n+finite(x?.[key]),0);}
function formatNumber(value){return new Intl.NumberFormat('fr-FR',{notation:Math.abs(Number(value)||0)>=1000000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)||0);}
function formatRatio(value){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(value)||0);}
function dateShort(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Dakar'}).format(new Date(value));}catch{return '—';}}
function dateRelative(value){if(!value)return 'jamais';const delta=Date.now()-Date.parse(value);if(!Number.isFinite(delta))return 'récemment';const min=Math.max(0,Math.floor(delta/60000));if(min<2)return 'à l’instant';if(min<60)return `il y a ${min} min`;const h=Math.floor(min/60);if(h<24)return `il y a ${h} h`;const d=Math.floor(h/24);return `il y a ${d} j`;}
function pillarLabel(key){return ({attraction:'attraction',engagement:'engagement',advocacy:'partage & sauvegarde',regularity:'régularité'})[key]||'apprentissage';}
function errorMessage(error){return error instanceof Error?error.message:String(error||'unknown_error');}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeScriptJson(value){return String(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}

function htmlResponse(body, status=200, headOnly=false) {
  return new Response(headOnly?null:body,{status,headers:securityHeaders('text/html; charset=utf-8')});
}
function securityHeaders(contentType) {
  return {
    'content-type':contentType,
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'strict-transport-security':'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'no-referrer',
    'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
    'cross-origin-opener-policy':'same-origin',
    'cross-origin-resource-policy':'same-origin',
    'content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https://*.cdninstagram.com https://*.fbcdn.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    'x-robots-tag':'noindex, nofollow, noarchive',
    'x-sowhat-social-intelligence-version':VERSION,
  };
}
function corsHeaders(){return {'access-control-allow-origin':'https://dakarstyle.com','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type, X-SOWHAT-KEY','access-control-max-age':'86400','content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};}
function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});}

async function mapWithConcurrency(items, limit, mapper) {
  const rows = Array.isArray(items) ? items : [];
  const output = new Array(rows.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), rows.length || 1) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= rows.length) return;
      try { output[index] = await mapper(rows[index], index); }
      catch (_) { output[index] = normalizeMedia(rows[index], {}); }
    }
  });
  await Promise.all(workers);
  return output;
}
