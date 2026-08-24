const ASSET_PATTERN = /^SWA-GDN-[A-Z0-9-]{20,80}$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value, fallback = '—') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function headers(contentType = 'text/html; charset=utf-8') {
  return {
    'content-type': contentType,
    'cache-control': 'public, max-age=60, s-maxage=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
}

function landing() {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOWHAT Guardian — Visual Passport</title><style>${styles()}</style></head><body><main class="shell"><div class="brand">SOWHAT AFRICA <span>×</span> DAKARSTYLE</div><section class="hero"><p class="eyebrow">AI IMAGE GUARDIAN</p><h1>Visual Passport</h1><p>Consultez la preuve d’authenticité d’un actif sécurisé à partir de son Asset ID.</p><form onsubmit="event.preventDefault();const v=this.elements.asset.value.trim().toUpperCase();if(v)location.href='/visuals/'+encodeURIComponent(v)"><input name="asset" autocomplete="off" spellcheck="false" placeholder="SWA-GDN-…" aria-label="Asset ID"><button>Ouvrir le passeport</button></form></section><p class="foot">DWT-DCT · SHA-256 · C2PA · métadonnées légales · preuve HMAC</p></main></body></html>`, { status: 200, headers: headers() });
}

function styles() {
  return `:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#060707;color:#f6f1e6}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 75% 10%,rgba(207,158,54,.18),transparent 30%),linear-gradient(160deg,#070808,#0e0e0d 55%,#060707);color:#f5f1e8}.shell{width:min(1120px,calc(100% - 32px));margin:auto;padding:36px 0 60px}.brand{font-size:12px;letter-spacing:.18em;font-weight:800;color:#d9b962}.brand span{color:#fff6;margin:0 6px}.hero{margin-top:72px;max-width:820px}.eyebrow{font-size:11px;letter-spacing:.2em;color:#d7b45c;font-weight:800}.hero h1{font-size:clamp(42px,8vw,86px);line-height:.92;margin:12px 0 24px;letter-spacing:-.055em}.hero>p{color:#a8a59c;font-size:17px;max-width:680px;line-height:1.6}form{display:flex;gap:10px;margin-top:32px;max-width:760px}input{flex:1;min-width:0;border:1px solid #ffffff20;border-radius:14px;padding:16px;background:#ffffff08;color:#fff;font:inherit}button,.btn{border:0;border-radius:14px;padding:15px 18px;background:#d5ac4b;color:#120e06;font-weight:800;text-decoration:none;cursor:pointer}.foot{margin-top:80px;color:#77746d;font-size:12px}.passport{display:grid;gap:22px;margin-top:44px}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.status{display:inline-flex;align-items:center;gap:8px;border:1px solid #62d79055;background:#62d79012;color:#9ef2bd;padding:8px 11px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.08em}.status:before{content:"";width:7px;height:7px;border-radius:50%;background:#75e69f;box-shadow:0 0 16px #75e69f}.title{font-size:clamp(32px,5vw,58px);line-height:1;margin:10px 0 0;letter-spacing:-.04em}.meta{color:#8d8a83;margin-top:12px}.grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:20px}.card{background:#111211d9;border:1px solid #ffffff12;border-radius:22px;padding:22px;box-shadow:0 20px 50px #0007}.preview{aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:#050505;display:grid;place-items:center}.preview img{width:100%;height:100%;object-fit:contain}.proofs{display:grid;gap:11px}.proof{display:flex;justify-content:space-between;gap:18px;padding:13px 0;border-bottom:1px solid #ffffff0d}.proof:last-child{border-bottom:0}.proof span{color:#85827b;font-size:12px}.proof b{font-size:12px;text-align:right;word-break:break-all}.ok{color:#8fe7af!important}.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.links a{font-size:12px;color:#e4c36f;text-decoration:none;border-bottom:1px solid #e4c36f55}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fact{padding:15px;border:1px solid #ffffff0c;border-radius:14px;background:#ffffff04}.fact span{display:block;color:#7f7c75;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px}.fact strong{font-size:13px;word-break:break-word}@media(max-width:760px){.shell{width:min(100% - 22px,1120px);padding-top:24px}.hero{margin-top:48px}form{flex-direction:column}.grid{grid-template-columns:1fr}.top{flex-direction:column}.facts{grid-template-columns:1fr}.card{padding:16px}}`;
}

async function loadManifest(env, assetId) {
  if (!env.VISUALS_BUCKET) return { error: 'storage_unavailable', status: 503 };
  const object = await env.VISUALS_BUCKET.get(`visuals/manifest/${assetId}.json`);
  if (!object) return { error: 'not_found', status: 404 };
  try {
    return { manifest: JSON.parse(await object.text()), status: 200 };
  } catch {
    return { error: 'manifest_invalid', status: 500 };
  }
}

function renderPassport(manifest) {
  const guardian = manifest.guardian || {};
  const media = safeHttps(manifest.original_media_url || manifest.media_url);
  const manifestUrl = safeHttps(manifest.manifest_url);
  const secured = manifest.status === 'GUARDIAN_VERIFIED'
    && manifest.c2pa_valid === true
    && manifest.watermark_applied === true
    && manifest.metadata_written === true
    && guardian.evidence_verified === true;
  const title = escapeHtml(text(manifest.title, 'SOWHAT Visual Asset'));
  const assetId = escapeHtml(text(manifest.asset_id));
  const preview = media ? `<div class="preview"><img src="${escapeHtml(media)}" alt="${escapeHtml(text(manifest.alt_text, title))}"></div>` : '<div class="preview">Aperçu indisponible</div>';
  const yes = (value) => value === true ? '<b class="ok">VALID</b>' : '<b>NON VALIDÉ</b>';
  const line = (label, value) => `<div class="proof"><span>${label}</span><b>${escapeHtml(text(value))}</b></div>`;
  const fact = (label, value) => `<div class="fact"><span>${label}</span><strong>${escapeHtml(text(value))}</strong></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — SOWHAT Visual Passport</title><style>${styles()}</style></head><body><main class="shell"><div class="brand">SOWHAT AFRICA <span>×</span> DAKARSTYLE</div><article class="passport"><div class="top"><div><p class="eyebrow">VISUAL PASSPORT V2 · C2PA</p><h1 class="title">${title}</h1><p class="meta">${assetId}</p></div><div class="status">${secured ? 'GUARDIAN_VERIFIED' : 'VERIFICATION INCOMPLETE'}</div></div><div class="grid"><section class="card">${preview}<div class="links">${media ? `<a href="${escapeHtml(media)}" target="_blank" rel="noopener noreferrer">Master sécurisé</a>` : ''}${manifestUrl ? `<a href="${escapeHtml(manifestUrl)}" target="_blank" rel="noopener noreferrer">Manifeste JSON</a>` : ''}</div></section><section class="card proofs"><div class="proof"><span>C2PA</span>${yes(manifest.c2pa_valid)}</div><div class="proof"><span>Watermark DWT-DCT</span>${yes(guardian.watermark_valid && manifest.watermark_applied)}</div><div class="proof"><span>Métadonnées EXIF/IPTC/XMP</span>${yes(guardian.metadata_written && manifest.metadata_written)}</div><div class="proof"><span>Preuve HMAC</span>${yes(guardian.evidence_verified)}</div>${line('SHA-256 final', manifest.sha256)}${line('SHA-256 source', guardian.source_sha256)}${line('pHash', guardian.phash)}${line('dHash', guardian.dhash)}</section></div><section class="card facts">${fact('Créateur', manifest.creator)}${fact('Collection', manifest.collection)}${fact('Produit', manifest.product)}${fact('Lieu', manifest.location)}${fact('Scellé le', manifest.sealed_at || manifest.uploaded_at)}${fact('Publication', manifest.publish ? 'PUBLIÉ' : 'MASTER / NON PUBLIÉ')}</section></article><p class="foot">SOWHAT Image Guardian · preuve technique et provenance numérique</p></main></body></html>`;
}

export async function handleGuardianPassport(request, env) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: headers('text/plain; charset=utf-8') });
  const normalized = url.pathname.replace(/\/+$/, '');
  if (normalized === '/visuals') return request.method === 'HEAD' ? new Response(null, { status: 200, headers: headers() }) : landing();
  const raw = decodeURIComponent(normalized.slice('/visuals/'.length)).toUpperCase();
  if (!ASSET_PATTERN.test(raw)) return new Response('Passeport introuvable', { status: 404, headers: headers('text/plain; charset=utf-8') });
  const loaded = await loadManifest(env, raw);
  if (!loaded.manifest) return new Response(loaded.error === 'not_found' ? 'Passeport introuvable' : 'Passeport indisponible', { status: loaded.status, headers: headers('text/plain; charset=utf-8') });
  const body = renderPassport(loaded.manifest);
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: headers() });
}
