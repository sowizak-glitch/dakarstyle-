/**
 * SOWHAT Control - Couche de rendu (V4)
 *
 * Ce module contient tout le HTML, le CSS et le script client du cockpit.
 * Il a ete extrait de social-intelligence-v3.js, ou il tenait sur quelques
 * lignes minifiees illisibles et non diffables.
 *
 * Deux regles structurent ce fichier :
 *   1. Aucune statistique n'est fabriquee ici. Le rendu affiche ce que le
 *      moteur fournit, et affiche explicitement l'attente quand il n'y a rien.
 *   2. Aucun attribut style="" en ligne. La CSP fonctionne par nonce, et un
 *      nonce ne couvre pas les attributs de style : tout passe par des classes.
 */

const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** Jeu de jetons unique, partage par l'ecran de connexion et le cockpit. */
export const DESIGN_TOKENS = `
:root{
  color-scheme:dark;
  --bg:#08080a; --bg2:#0d0d11; --panel:#121217; --panel2:#17171d;
  --line:#2d2a23; --line2:#3b372c;
  --txt:#f6f2e9; --soft:#d6d1c5; --muted:#96938b;
  --gold:#d5b56a; --gold2:#f0d58d; --petrol:#4b9f99;
  --good:#76d8ad; --warn:#efc86d; --danger:#ff9b9b;
  --shadow:0 22px 70px rgba(0,0,0,.34);
}`;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function cleanText(value, max = 500) {
  return String(value ?? '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function sum(rows, key) {
  return (Array.isArray(rows) ? rows : []).reduce((total, row) => total + finite(row?.[key]), 0);
}

export function formatNumber(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('fr-FR', {
    notation: Math.abs(n) >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n);
}

export function dateRelative(value) {
  if (!value) return 'jamais';
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return 'recemment';
  const minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 2) return 'a l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function dateShort(value) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

export function safeInstagramPermalink(value) {
  try {
    const url = new URL(String(value || ''));
    const allowed = ['instagram.com', 'www.instagram.com'];
    return url.protocol === 'https:' && allowed.includes(url.hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Feuilles de style                                                   */
/* ------------------------------------------------------------------ */

const LOGIN_CSS = `${DESIGN_TOKENS}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
body{min-height:100dvh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 80% -5%,rgba(213,181,106,.16),transparent 32%),radial-gradient(circle at 10% 20%,rgba(75,159,153,.12),transparent 30%),var(--bg)}
.login{width:min(440px,100%)}
.mark{width:64px;height:64px;border-radius:21px;display:grid;place-items:center;background:linear-gradient(145deg,#e2c77e,#b8903f);color:#17130b;font-weight:950;font-size:20px;box-shadow:0 18px 50px rgba(213,181,106,.18)}
.eyebrow{margin-top:22px;color:var(--gold);font-weight:850;letter-spacing:.15em;text-transform:uppercase;font-size:11px}
.login h1{font-size:clamp(34px,9vw,50px);line-height:.98;letter-spacing:-.05em;margin:10px 0 12px}
.lead{color:var(--muted);font-size:15px;line-height:1.55;margin:0 0 22px}
.card{padding:20px;border-radius:24px;border:1px solid var(--line);background:linear-gradient(180deg,#15151b,#0f0f14);box-shadow:0 26px 80px rgba(0,0,0,.42)}
label{display:block;color:var(--soft);font-size:12px;font-weight:760;margin:14px 0 7px}
.input{width:100%;height:54px;border-radius:15px;border:1px solid #333128;background:#0b0b0e;color:var(--txt);padding:0 15px;font-size:16px;outline:none}
.input:focus{border-color:rgba(213,181,106,.7);box-shadow:0 0 0 4px rgba(213,181,106,.08)}
.submit{width:100%;height:56px;border:0;border-radius:16px;margin-top:18px;background:linear-gradient(135deg,#e4ca82,#c29b49);color:#18130a;font-weight:950;font-size:15px;cursor:pointer}
.notice{padding:11px 13px;border-radius:13px;margin:0 0 12px;font-size:13px;line-height:1.4}
.error{background:rgba(255,155,155,.08);border:1px solid rgba(255,155,155,.2);color:#ffc9c9}
.ok{background:rgba(118,216,173,.08);border:1px solid rgba(118,216,173,.2);color:#c8f7e2}
.private{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:16px}
.private i{width:8px;height:8px;border-radius:50%;background:var(--good)}
:focus-visible{outline:2px solid var(--gold2);outline-offset:2px}
`;

const SYSTEM_CSS = `${DESIGN_TOKENS}
body{margin:0;background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100dvh;padding:24px}
main{max-width:520px}
p{color:var(--muted);line-height:1.6}
`;

const APP_CSS_BASE = `${DESIGN_TOKENS}
*{box-sizing:border-box}
html{background:var(--bg);-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;min-height:100dvh;overflow-x:hidden;color:var(--txt);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 90% -8%,rgba(213,181,106,.14),transparent 29%),radial-gradient(circle at 4% 16%,rgba(75,159,153,.10),transparent 26%),linear-gradient(180deg,#0b0b0e,var(--bg) 55%)}
button,a,input,textarea,select{font:inherit}
button{touch-action:manipulation}
:focus-visible{outline:2px solid var(--gold2);outline-offset:2px}
.app{width:min(1500px,100%);margin:0 auto;min-height:100dvh}
.rail{display:none}
.main{width:100%;min-width:0;padding:12px 12px calc(94px + env(safe-area-inset-bottom))}
.mt9{margin-top:9px}
.mt10{margin-top:10px}
.mt14{margin-top:14px}
.topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0 11px;background:linear-gradient(180deg,rgba(8,8,10,.98),rgba(8,8,10,.88) 70%,transparent);backdrop-filter:blur(18px)}
.identity{display:flex;align-items:center;gap:9px;min-width:0}
.avatar{width:40px;height:40px;flex:0 0 40px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#e0c47a,#b88f3f);color:#171208;font-weight:950}
.identityText{min-width:0}
.identityText strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.identityText small{display:block;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.topActions{display:flex;align-items:center;gap:7px}
.topBtn{min-height:40px;border-radius:13px;border:1px solid var(--line);background:var(--panel);color:var(--soft);padding:0 11px;font-size:11px;font-weight:850;cursor:pointer}
.topBtn.gold{background:linear-gradient(135deg,#e2c77e,#c19a49);border:0;color:#18130a}
.topBtn:disabled{opacity:.5;cursor:not-allowed}
.desktopLogout{display:none}
.statusStrip{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding:2px 0 11px}
.statusStrip::-webkit-scrollbar{display:none}
.statusChip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:rgba(18,18,23,.86);color:var(--soft);font-size:10px;font-weight:780}
.sdot{width:7px;height:7px;border-radius:50%;background:var(--good)}
.sdot.warn{background:var(--warn)}
.view{display:none;min-width:0}
.view.active{display:block}
.hero{padding:22px 18px;border:1px solid var(--line);border-radius:23px;background:linear-gradient(155deg,#18181e,#0f0f14 70%);position:relative;overflow:hidden;box-shadow:var(--shadow)}
.hero:after{content:"";position:absolute;right:-85px;top:-105px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(213,181,106,.18),transparent 68%)}
.eyebrow{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
.hero h1{font-size:clamp(34px,10vw,48px);line-height:.98;letter-spacing:-.055em;margin:12px 0 12px;max-width:760px}
.hero p{color:var(--muted);font-size:14px;line-height:1.55;margin:0;max-width:700px}
.heroActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.cta{min-height:48px;border-radius:14px;border:1px solid var(--line);padding:0 15px;background:#15151b;color:var(--soft);font-weight:900;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
.cta.gold{border:0;background:linear-gradient(135deg,#e3ca84,#bd9341);color:#181208}
.cta.petrol{border-color:rgba(75,159,153,.35);background:rgba(75,159,153,.11);color:#a8e1dd}
.scoreRow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;margin-top:11px}
.scoreBox,.metric,.panel,.publishPanel,.historyCard,.connectionCard{border:1px solid var(--line);background:linear-gradient(180deg,#141419,#0f0f14);border-radius:19px}
.scoreBox{padding:15px;display:grid;place-items:center}
.ring{width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--gold) calc(var(--score,0)*1%),#25231d 0);position:relative}
.ring:before{content:"";position:absolute;inset:7px;border-radius:50%;background:#0c0c10}
.ring strong{position:relative;font-size:26px;letter-spacing:-.05em}
.scoreInfo{padding:15px}
.scoreInfo strong{font-size:15px}
.scoreInfo p{color:var(--muted);font-size:11px;line-height:1.5;margin:6px 0 0}
.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}
.metric{padding:13px}
.metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em}
.metric b{display:block;font-size:21px;margin-top:6px}
.grid2{display:grid;grid-template-columns:1fr;gap:9px;margin-top:9px}
.panel{padding:16px}
.panel h2{margin:0;font-size:16px}
.panelSub{color:var(--muted);font-size:10px;margin-top:3px}
.pillars{display:grid;gap:12px;margin-top:14px}
.prow{display:grid;grid-template-columns:88px minmax(0,1fr) 32px;gap:8px;align-items:center}
.prow span{font-size:11px}
.track{height:8px;border-radius:99px;background:#25231d;overflow:hidden}
.fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--petrol),var(--gold))}
.fill.w0{width:0}
.coachLead{margin-top:12px;padding:14px;border:1px solid rgba(213,181,106,.22);border-radius:15px;background:rgba(213,181,106,.055)}
.coachLead strong{font-size:14px}
.coachLead p{color:var(--muted);font-size:11px;line-height:1.5}
.sectionHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:6px 0 13px}
.sectionHead h1{margin:0;font-size:30px;letter-spacing:-.04em}
.sectionHead p{margin:4px 0 0;color:var(--muted);font-size:11px}
`;

const APP_CSS_COMPONENTS = `
.mediaGrid,.coachGrid,.planGrid,.connectionGrid,.historyGrid,.memoryGrid{display:grid;grid-template-columns:1fr;gap:9px}
.mediaCard,.coachBox,.planCard,.memoryCard{padding:15px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}
.mediaTop{display:flex;justify-content:space-between;gap:10px}
.badge{display:inline-flex;align-items:center;min-height:27px;padding:0 9px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:9px;font-weight:850}
.badge.score{color:var(--gold);border-color:rgba(213,181,106,.24)}
.hook{font-weight:850;font-size:13px;margin:10px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.miniMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.mini{padding:7px 4px;text-align:center;border-radius:10px;background:#0c0c10}
.mini b{display:block;font-size:11px}
.mini small{font-size:8px;color:var(--muted)}
.openLink{display:inline-flex;margin-top:10px;color:var(--gold2);font-size:10px;text-decoration:none;font-weight:850}
.empty{padding:30px 16px;border:1px dashed var(--line2);border-radius:18px;text-align:center;color:var(--muted);font-size:12px;line-height:1.55}
.empty b{display:block;color:var(--soft);margin-bottom:5px}
.coachBox h3,.connectionCard h3,.publishPanel h2,.memoryCard h3{margin:0;font-size:15px}
.coachBox ul{margin:10px 0 0;padding-left:17px;color:var(--soft)}
.coachBox li{font-size:11px;line-height:1.5;margin:7px 0}
.coachAction{margin-top:12px;width:100%;min-height:46px;border-radius:13px;border:1px solid rgba(213,181,106,.4);background:rgba(213,181,106,.09);color:var(--gold2);font-weight:900;font-size:11px;cursor:pointer}
.planCard .day{color:var(--gold);font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}
.planCard .ptype{font-size:17px;font-weight:950;margin-top:7px}
.planCard p{color:var(--muted);font-size:11px;line-height:1.5}
.memoryCard ul{margin:9px 0 0;padding-left:16px;color:var(--soft)}
.memoryCard li{font-size:11px;line-height:1.55;margin:6px 0}
.memoryCard .pending{color:var(--muted);font-size:11px;line-height:1.5;margin:9px 0 0}
.publishLayout{display:grid;grid-template-columns:1fr;gap:10px}
.publishPanel{padding:17px}
.formatPicker{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}
.formatBtn{min-height:62px;border:1px solid var(--line);border-radius:14px;background:var(--bg2);color:var(--muted);font-size:10px;font-weight:850;cursor:pointer}
.formatBtn[aria-pressed="true"]{border-color:rgba(213,181,106,.55);background:rgba(213,181,106,.09);color:var(--gold2)}
.field{margin-top:12px}
.field label{display:flex;justify-content:space-between;gap:8px;color:var(--soft);font-size:10px;font-weight:800;margin-bottom:6px}
.field input,.field textarea{width:100%;border:1px solid var(--line);border-radius:13px;background:#0b0b0e;color:var(--txt);padding:12px;outline:none}
.field input{height:47px}
.field textarea{min-height:96px;resize:vertical;line-height:1.45}
.field input:focus,.field textarea:focus{border-color:rgba(213,181,106,.55);box-shadow:0 0 0 3px rgba(213,181,106,.06)}
.counter{color:var(--muted);font-weight:650}
.publishActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.publishBtn{min-height:50px;border-radius:14px;border:1px solid var(--line);background:#15151b;color:var(--soft);font-weight:900;cursor:pointer}
.publishBtn.preview{border-color:rgba(75,159,153,.35);color:#a8e1dd}
.publishBtn.commit{border:0;background:linear-gradient(135deg,#e3ca84,#bd9341);color:#181208}
.publishBtn:disabled{opacity:.45;cursor:not-allowed}
.publishNotice{margin-top:12px;padding:11px;border-radius:13px;border:1px solid var(--line);background:var(--bg2);color:var(--muted);font-size:10px;line-height:1.5}
.libraryHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}
.libraryHead h3{margin:0;font-size:13px}
.libraryBtn{min-height:38px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--soft);padding:0 11px;font-size:10px;font-weight:850;cursor:pointer}
.libraryBtn:disabled{opacity:.5;cursor:not-allowed}
.library{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
.visualCard{position:relative;padding:0;border:1px solid var(--line);border-radius:14px;background:#0c0c10;overflow:hidden;cursor:pointer;text-align:left}
.visualCard img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#0c0c10}
.visualCard .vmeta{display:block;padding:7px 8px 8px;color:var(--muted);font-size:9px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.visualCard[aria-pressed="true"]{border-color:rgba(213,181,106,.6);box-shadow:0 0 0 2px rgba(213,181,106,.14)}
.visualCard .vtype{position:absolute;top:6px;left:6px;padding:2px 7px;border-radius:999px;background:rgba(8,8,10,.8);color:var(--gold2);font-size:8px;font-weight:900}
.libraryEmpty{margin-top:10px;padding:18px 14px;border:1px dashed var(--line2);border-radius:14px;color:var(--muted);font-size:11px;line-height:1.5;text-align:center}
.historyCard{padding:14px}
.historyTop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.historyCard strong{font-size:12px}
.historyCard p{font-size:10px;color:var(--muted);line-height:1.45;margin:7px 0 0}
.historyCard .igid{display:inline-block;margin-top:7px;padding:3px 8px;border-radius:999px;background:rgba(118,216,173,.09);border:1px solid rgba(118,216,173,.22);color:var(--good);font-size:9px;font-weight:850}
.state{flex:0 0 auto;font-size:8.5px;font-weight:900;letter-spacing:.05em;padding:4px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.state.draft{color:var(--muted)}
.state.safe{color:#a8e1dd;border-color:rgba(75,159,153,.35);background:rgba(75,159,153,.09)}
.state.running{color:var(--warn);border-color:rgba(239,200,109,.32);background:rgba(239,200,109,.08)}
.state.done{color:var(--good);border-color:rgba(118,216,173,.32);background:rgba(118,216,173,.08)}
.state.failed{color:var(--danger);border-color:rgba(255,155,155,.32);background:rgba(255,155,155,.08)}
.connectionCard{padding:16px}
.connectionCard p{color:var(--muted);font-size:11px;line-height:1.5}
.connState{display:inline-flex;align-items:center;gap:7px;margin-top:8px;font-size:10px;font-weight:850;color:var(--good)}
.connState.warn{color:var(--warn)}
.bottomNav{position:fixed;z-index:80;display:grid;grid-template-columns:repeat(6,1fr);left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:6px;border:1px solid var(--line);border-radius:20px;background:rgba(13,13,17,.96);backdrop-filter:blur(24px);box-shadow:0 18px 58px rgba(0,0,0,.52)}
.bottomNav button{border:0;background:transparent;color:var(--muted);min-height:54px;border-radius:14px;padding:5px 2px;font-size:8px;font-weight:800;cursor:pointer}
.bottomNav button span{display:block;font-size:15px;line-height:1.15;margin-bottom:3px}
.bottomNav button[aria-selected="true"]{background:rgba(213,181,106,.09);color:var(--gold2)}
.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(86px + env(safe-area-inset-bottom));z-index:100;width:min(92vw,520px);padding:11px 14px;border-radius:13px;background:var(--panel2);border:1px solid var(--line2);color:var(--soft);font-size:11px;box-shadow:0 18px 50px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.2s}
.toast.show{opacity:1}
.install{display:none}
`;

const APP_CSS_RESPONSIVE = `
@media(min-width:700px){
  .main{padding:18px 20px 100px}
  .hero{padding:28px}
  .metrics{grid-template-columns:repeat(4,1fr)}
  .grid2,.publishLayout{grid-template-columns:1fr 1fr}
  .mediaGrid,.coachGrid,.connectionGrid,.historyGrid,.memoryGrid{grid-template-columns:repeat(2,1fr)}
  .planGrid{grid-template-columns:repeat(2,1fr)}
  .library{grid-template-columns:repeat(4,1fr)}
}
@media(min-width:1200px) and (hover:hover) and (pointer:fine){
  .app{display:grid;grid-template-columns:238px minmax(0,1fr)}
  .rail{display:block;position:sticky;top:0;height:100dvh;padding:24px 17px;border-right:1px solid var(--line);background:rgba(8,8,10,.78);backdrop-filter:blur(24px)}
  .railBrand{display:flex;align-items:center;gap:10px;margin-bottom:24px}
  .railBrand i{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-style:normal;font-weight:950;background:linear-gradient(145deg,#e2c77e,#b8903f);color:#17130b}
  .railBrand small{display:block;color:var(--muted);font-size:10px}
  .railNav{display:grid;gap:7px}
  .railNav button{min-height:46px;border:0;border-radius:14px;background:transparent;color:var(--muted);text-align:left;padding:0 12px;font-weight:800;cursor:pointer}
  .railNav button[aria-selected="true"]{background:rgba(213,181,106,.09);color:var(--gold2)}
  .railFoot{position:absolute;bottom:22px;left:17px;right:17px;padding:13px;border:1px solid var(--line);border-radius:15px;color:var(--muted);font-size:10px;line-height:1.5}
  .main{padding:22px 36px 60px}
  .bottomNav{display:none}
  .desktopLogout{display:block}
  .hero h1{font-size:60px}
  .mediaGrid{grid-template-columns:repeat(3,1fr)}
  .planGrid{grid-template-columns:repeat(4,1fr)}
  .historyGrid{grid-template-columns:repeat(3,1fr)}
  .library{grid-template-columns:repeat(5,1fr)}
}
@media(hover:none) and (pointer:coarse){
  .rail{display:none!important}
  .app{display:block!important}
  .main{padding-left:12px!important;padding-right:12px!important}
  .bottomNav{display:grid!important}
}
@media(max-width:480px){
  .topActions .topBtn:not(.gold){display:none}
  .hero h1{font-size:39px}
  .scoreRow{grid-template-columns:104px minmax(0,1fr)}
  .formatPicker{gap:5px}
  .formatBtn{font-size:9px}
  .bottomNav button{font-size:7.5px}
  .library{grid-template-columns:repeat(3,1fr);gap:6px}
}
@media(prefers-reduced-motion:reduce){
  *{scroll-behavior:auto!important;transition:none!important}
}
`;

const APP_CSS = `${APP_CSS_BASE}${APP_CSS_COMPONENTS}${APP_CSS_RESPONSIVE}`;

/* ------------------------------------------------------------------ */
/* Etats de publication                                                */
/* ------------------------------------------------------------------ */

export const PUBLICATION_STATES = Object.freeze({
  DRAFT: 'BROUILLON',
  SAFE_VALIDATED: 'SAFE VALIDE',
  PUBLISHING: 'EN PUBLICATION',
  PUBLISHED: 'PUBLIE',
  FAILED: 'ECHEC',
});

const STATE_CLASS = Object.freeze({
  [PUBLICATION_STATES.DRAFT]: 'draft',
  [PUBLICATION_STATES.SAFE_VALIDATED]: 'safe',
  [PUBLICATION_STATES.PUBLISHING]: 'running',
  [PUBLICATION_STATES.PUBLISHED]: 'done',
  [PUBLICATION_STATES.FAILED]: 'failed',
});

export function stateClass(state) {
  return STATE_CLASS[state] || 'draft';
}

/* ------------------------------------------------------------------ */
/* Composants                                                          */
/* ------------------------------------------------------------------ */

function desktopNav(target, label, selected = false) {
  return `<button type="button" data-target="${target}" aria-selected="${selected}">${escapeHtml(label)}</button>`;
}

function mobileNav(target, icon, label, selected = false) {
  return `<button type="button" data-target="${target}" aria-selected="${selected}" aria-label="${escapeHtml(label)}"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`;
}

function formatButton(type, label, selected = false) {
  return `<button class="formatBtn" type="button" data-type="${escapeHtml(type)}" aria-pressed="${selected}">${escapeHtml(label)}</button>`;
}

function metric(label, value) {
  return `<article class="metric"><small>${escapeHtml(label)}</small><b>${formatNumber(value)}</b></article>`;
}

function pillar(key, label, value) {
  const percent = clamp(Math.round(finite(value)), 0, 100);
  return `<div class="prow"><span>${escapeHtml(label)}</span>`
    + `<div class="track"><div class="fill w0" data-pillar="${key}"></div></div>`
    + `<span>${percent}</span></div>`;
}

function mini(label, value) {
  return `<div class="mini"><b>${formatNumber(value)}</b><small>${escapeHtml(label)}</small></div>`;
}

function mediaCard(item) {
  const link = safeInstagramPermalink(item.permalink);
  const score = clamp(Math.round(finite(item.score)), 0, 100);
  return `<article class="mediaCard">`
    + `<div class="mediaTop"><span class="badge">${escapeHtml(item.media_type || 'POST')}</span>`
    + `<span class="badge score">${score}/100</span></div>`
    + `<div class="hook">${escapeHtml(cleanText(item.hook || item.caption || 'Publication', 130))}</div>`
    + `<div class="miniMetrics">${mini('Vues', item.views)}${mini('Reach', item.reach)}${mini('Partages', item.shares)}${mini('Saves', item.saves)}</div>`
    + (link ? `<a class="openLink" href="${escapeHtml(link)}" target="_blank" rel="noopener">Ouvrir sur Instagram ↗</a>` : '')
    + `</article>`;
}

function coachBox(title, items, emptyText, seed = null) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 5) : [];
  const body = rows.length
    ? `<ul>${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join('')}</ul>`
    : `<div class="panelSub">${escapeHtml(emptyText)}</div>`;
  const action = seed
    ? `<button class="coachAction" type="button" data-seed="${escapeHtml(JSON.stringify(seed))}">Creer a partir de cette recommandation</button>`
    : '';
  return `<article class="coachBox"><h3>${escapeHtml(title)}</h3>${body}${action}</article>`;
}

function planCard(item) {
  const seed = {
    publication_type: String(item?.type || '').toUpperCase() === 'REEL' ? 'REEL' : 'POST IMAGE',
    caption: cleanText(item?.hook || '', 400),
    title: cleanText(`${item?.day || 'Plan'} · ${item?.objective || ''}`, 160),
  };
  return `<article class="planCard">`
    + `<div class="day">${escapeHtml(item?.day || 'Jour')}</div>`
    + `<div class="ptype">${escapeHtml(item?.type || 'CONTENU')}</div>`
    + `<p><b>${escapeHtml(item?.objective || 'Objectif')}</b><br>${escapeHtml(item?.action || '')}</p>`
    + `<button class="coachAction" type="button" data-seed="${escapeHtml(JSON.stringify(seed))}">Creer a partir de ce jour</button>`
    + `</article>`;
}

function historyCard(item) {
  const state = String(item?.state || (item?.accepted ? PUBLICATION_STATES.SAFE_VALIDATED : PUBLICATION_STATES.FAILED));
  const mediaId = cleanText(item?.instagram_media_id || '', 60);
  return `<article class="historyCard">`
    + `<div class="historyTop"><strong>${escapeHtml(cleanText(item?.publication_type || '', 30))}</strong>`
    + `<span class="state ${stateClass(state)}">${escapeHtml(state)}</span></div>`
    + `<p>${escapeHtml(cleanText(item?.title || 'SOWHAT AFRICA', 80))} · ${escapeHtml(dateShort(item?.requested_at))}`
    + `<br>${escapeHtml(cleanText(item?.caption || '', 120))}</p>`
    + (mediaId ? `<span class="igid">ID Instagram · ${escapeHtml(mediaId)}</span>` : '')
    + `</article>`;
}

function visualCard(item) {
  const label = cleanText(item?.title || item?.name || 'Visuel', 42);
  return `<button class="visualCard" type="button" aria-pressed="false"`
    + ` data-url="${escapeHtml(item.url)}" data-kind="${escapeHtml(item.kind)}"`
    + ` data-title="${escapeHtml(label)}" data-collection="${escapeHtml(cleanText(item?.collection || '', 60))}">`
    + `<span class="vtype">${escapeHtml(item.kind === 'video' ? 'VIDEO' : 'IMAGE')}</span>`
    + (item.kind === 'video'
      ? ''
      : `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" decoding="async">`)
    + `<span class="vmeta">${escapeHtml(label)}</span>`
    + `</button>`;
}

function emptyState(title, text) {
  return `<div class="empty"><b>${escapeHtml(title)}</b>${escapeHtml(text)}</div>`;
}

function memoryList(title, rows, emptyText, renderRow) {
  const items = Array.isArray(rows) ? rows.filter(Boolean).slice(0, 5) : [];
  const body = items.length
    ? `<ul>${items.map((row) => `<li>${escapeHtml(renderRow(row))}</li>`).join('')}</ul>`
    : `<p class="pending">${escapeHtml(emptyText)}</p>`;
  return `<article class="memoryCard"><h3>${escapeHtml(title)}</h3>${body}</article>`;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function renderLogin({ error = '', reason = '', nonce = '' } = {}) {
  const status = reason === 'logout' ? 'Session fermee en securite.' : '';
  const errorBlock = error ? `<div class="notice error">${escapeHtml(error)}</div>` : '';
  const statusBlock = status ? `<div class="notice ok">${escapeHtml(status)}</div>` : '';
  return `<!doctype html><html lang="fr"><head>`
    + `<meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`
    + `<meta name="robots" content="noindex,nofollow,noarchive">`
    + `<meta name="theme-color" content="#0a0a0d">`
    + `<link rel="manifest" href="/social-intelligence/manifest.webmanifest">`
    + `<link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml">`
    + `<title>SOWHAT Control · Accès privé</title>`
    + `<style nonce="${escapeHtml(nonce)}">${LOGIN_CSS}</style>`
    + `</head><body><main class="login">`
    + `<div class="mark">SC</div>`
    + `<div class="eyebrow">SOWHAT · CONTROL</div>`
    + `<h1>Créer. Publier.<br>Mesurer.</h1>`
    + `<p class="lead">Un seul cockpit privé pour piloter la création, la publication Instagram et l’intelligence de contenu.</p>`
    + `<div class="card">${errorBlock}${statusBlock}`
    + `<form method="post" action="/social-intelligence/login" autocomplete="on">`
    + `<label for="username">Identifiant</label>`
    + `<input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>`
    + `<label for="password">Mot de passe</label>`
    + `<input class="input" id="password" name="password" type="password" autocomplete="current-password" required>`
    + `<button class="submit" type="submit">Entrer dans le cockpit</button>`
    + `</form></div>`
    + `<div class="private"><i></i><span>Session privée · 30 jours · données non mises en cache</span></div>`
    + `</main>`
    + `<script nonce="${escapeHtml(nonce)}">if('serviceWorker' in navigator){navigator.serviceWorker.register('/social-intelligence/sw.js').catch(function(){});}</script>`
    + `</body></html>`;
}

export function renderSystemMessage(title, body, nonce = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`
    + `<meta name="robots" content="noindex,nofollow,noarchive">`
    + `<title>SOWHAT Control</title>`
    + `<style nonce="${escapeHtml(nonce)}">${SYSTEM_CSS}</style>`
    + `</head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></main></body></html>`;
}

/**
 * Cockpit complet.
 *
 * @param {object} context
 * @param {object} context.brain         Cerveau produit par le moteur v1.
 * @param {Array}  context.history       Historique des scores.
 * @param {Array}  context.publications  Historique des publications.
 * @param {object} context.memory        Resume de la Content Memory.
 * @param {object} context.flags         Etat reel des connexions.
 * @param {string} context.csrf          Jeton CSRF de session.
 * @param {string} context.nonce         Nonce CSP de la requete.
 */
export function renderDashboard(context) {
  const brain = context.brain && typeof context.brain === 'object' ? context.brain : {};
  const history = Array.isArray(context.history) ? context.history : [];
  const publications = Array.isArray(context.publications) ? context.publications : [];
  const memory = context.memory || { has_measured_data: false };
  const flags = context.flags || {};
  const nonce = String(context.nonce || '');
  const csrf = String(context.csrf || '');

  const score = clamp(Math.round(finite(brain.score)), 0, 100);
  const delta = Math.round(Number(brain.score_delta || 0));
  const pillars = brain.pillars || {};
  const topMedia = Array.isArray(brain.top_media) ? brain.top_media : [];
  const recent = Array.isArray(brain.recent_media) ? brain.recent_media : [];
  const formats = Array.isArray(brain.rankings?.formats) ? brain.rankings.formats : [];
  const plan = Array.isArray(brain.weekly_plan) ? brain.weekly_plan : [];
  const recommendations = brain.recommendations || {};
  const username = cleanText(brain.profile?.username || 'sowhatafrika', 80);
  const followers = finite(brain.profile?.followers_count);
  const samples = finite(brain.sample_count);
  const lastSync = brain.updated_at ? dateRelative(brain.updated_at) : 'jamais';
  const insightsOn = Boolean(flags.insightsConfigured);
  const bridgeOn = Boolean(flags.bridgeConfigured);
  const visualFactoryUrl = String(flags.visualFactoryUrl || '');

  const pillarValues = {
    attraction: clamp(Math.round(finite(pillars.attraction)), 0, 100),
    engagement: clamp(Math.round(finite(pillars.engagement)), 0, 100),
    advocacy: clamp(Math.round(finite(pillars.advocacy)), 0, 100),
    regularity: clamp(Math.round(finite(pillars.regularity)), 0, 100),
  };

  const dynamicCss = `.ring{--score:${score}}`
    + Object.entries(pillarValues)
      .map(([key, value]) => `.fill[data-pillar="${key}"]{width:${value}%}`)
      .join('');

  return `<!doctype html><html lang="fr"><head>`
    + `<meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`
    + `<meta name="robots" content="noindex,nofollow,noarchive">`
    + `<meta name="theme-color" content="#0a0a0d">`
    + `<meta name="mobile-web-app-capable" content="yes">`
    + `<meta name="apple-mobile-web-app-capable" content="yes">`
    + `<link rel="manifest" href="/social-intelligence/manifest.webmanifest">`
    + `<link rel="icon" href="/social-intelligence/icon.svg" type="image/svg+xml">`
    + `<title>SOWHAT Control</title>`
    + `<style nonce="${escapeHtml(nonce)}">${APP_CSS}</style>`
    + `<style nonce="${escapeHtml(nonce)}">${dynamicCss}</style>`
    + `</head><body><div class="app">`
    + renderRail(insightsOn)
    + `<main class="main">`
    + renderTopbar({ username, followers, samples, csrf })
    + renderStatusStrip(insightsOn, bridgeOn)
    + renderOverview({ score, delta, lastSync, recent, brain, pillarValues, recommendations, visualFactoryUrl })
    + renderPublishView({ publications, insightsOn })
    + renderContentsView(topMedia)
    + renderCoachView(recommendations, formats, memory)
    + renderPlanView(plan)
    + renderConnectionsView({ insightsOn, bridgeOn, lastSync, visualFactoryUrl, publications })
    + `</main></div>`
    + renderBottomNav()
    + `<div class="toast" id="toast" role="status" aria-live="polite"></div>`
    + `<script nonce="${escapeHtml(nonce)}">${clientScript(csrf)}</script>`
    + `</body></html>`;
}

function renderRail(insightsOn) {
  return `<aside class="rail"><div class="railBrand"><i>SC</i><div><strong>SOWHAT</strong><small>CONTROL 4.0</small></div></div>`
    + `<nav class="railNav" aria-label="Navigation bureau">`
    + desktopNav('overview', 'Vue d’ensemble', true)
    + desktopNav('publish', 'Publier')
    + desktopNav('contents', 'Contenus')
    + desktopNav('coach', 'Coach')
    + desktopNav('plan', 'Plan 7 jours')
    + desktopNav('connections', 'Connexions')
    + `</nav>`
    + `<div class="railFoot">Publication via Bridge SAFE existant.<br>Analytics : ${insightsOn ? 'connecté' : 'en attente de token serveur'}.</div>`
    + `</aside>`;
}

function renderTopbar({ username, followers, samples, csrf }) {
  return `<header class="topbar"><div class="identity"><div class="avatar">SA</div>`
    + `<div class="identityText"><strong>SOWHAT AFRICA</strong>`
    + `<small>@${escapeHtml(username)} · ${formatNumber(followers)} abonnés · ${formatNumber(samples)} analysés</small></div></div>`
    + `<div class="topActions">`
    + `<button class="topBtn install" id="installBtn" type="button">Installer</button>`
    + `<button class="topBtn gold" type="button" data-target="publish">Publier</button>`
    + `<form class="desktopLogout" method="post" action="/social-intelligence/logout">`
    + `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`
    + `<button class="topBtn" type="submit">Sortir</button></form>`
    + `</div></header>`;
}

function renderStatusStrip(insightsOn, bridgeOn) {
  return `<div class="statusStrip">`
    + `<span class="statusChip"><i class="sdot ${bridgeOn ? '' : 'warn'}"></i>Bridge SAFE ${bridgeOn ? 'connecté' : 'indisponible'}</span>`
    + `<span class="statusChip"><i class="sdot ${insightsOn ? '' : 'warn'}"></i>Insights ${insightsOn ? 'actifs' : 'à finaliser'}</span>`
    + `<span class="statusChip"><i class="sdot"></i>Session privée</span>`
    + `<span class="statusChip"><i class="sdot"></i>Mobile optimisé</span>`
    + `</div>`;
}

function renderOverview({ score, delta, lastSync, recent, brain, pillarValues, recommendations, visualFactoryUrl }) {
  const factoryLink = visualFactoryUrl
    ? `<a class="cta" href="${escapeHtml(visualFactoryUrl)}" target="_blank" rel="noopener">Ouvrir Visual Factory ↗</a>`
    : '';
  return `<section class="view active" data-view="overview">`
    + `<article class="hero"><div class="eyebrow">SOWHAT CONTROL · 2026</div>`
    + `<h1>Créer. Publier.<br>Mesurer. Recommencer.</h1>`
    + `<p>Le cockpit unifie la publication Instagram, le suivi des performances, le coach et le plan d’action. Le Bridge SAFE déjà installé reste inchangé : cette interface vient se brancher dessus sans casser les autres usages.</p>`
    + `<div class="heroActions">`
    + `<button class="cta gold" type="button" data-target="publish">Créer une publication</button>`
    + `<button class="cta petrol" type="button" data-target="contents">Voir les performances</button>`
    + factoryLink
    + `</div></article>`
    + `<div class="scoreRow"><div class="scoreBox"><div class="ring"><strong>${score}</strong></div></div>`
    + `<div class="scoreInfo"><div class="eyebrow">Score SOWHAT</div>`
    + `<strong>${score}/100 · ${delta >= 0 ? '+' : ''}${delta} au dernier cycle</strong>`
    + `<p>Calculé par rapport aux performances propres du compte. Dernière analyse : ${escapeHtml(lastSync)}.</p>`
    + `</div></div>`
    + `<div class="metrics">`
    + metric('Vues suivies', sum(recent, 'views'))
    + metric('Portée', sum(recent, 'reach'))
    + metric('Interactions', sum(recent, 'total_interactions'))
    + metric('Cadence', brain.cadence?.posts_per_week || 0)
    + `</div>`
    + `<div class="grid2">`
    + `<article class="panel"><h2>Les 4 leviers</h2>`
    + `<div class="panelSub">Attraction, engagement, partages et régularité</div>`
    + `<div class="pillars">`
    + pillar('attraction', 'Attraction', pillarValues.attraction)
    + pillar('engagement', 'Engagement', pillarValues.engagement)
    + pillar('advocacy', 'Partages', pillarValues.advocacy)
    + pillar('regularity', 'Régularité', pillarValues.regularity)
    + `</div></article>`
    + `<article class="panel"><h2>Décision du coach</h2><div class="coachLead">`
    + `<strong>${escapeHtml(recommendations.headline || 'Le moteur attend les premières données réelles.')}</strong>`
    + `<p>${escapeHtml(recommendations.summary || 'Aucun score artificiel ne sera affiché avant la première synchronisation.')}</p>`
    + `</div></article>`
    + `</div></section>`;
}

function renderPublishView({ publications, insightsOn }) {
  const recent = publications.slice(0, 6);
  return `<section class="view" data-view="publish">`
    + `<div class="sectionHead"><div><h1>Studio de publication</h1><p>POST · REEL · STORY via le Bridge SAFE existant.</p></div></div>`
    + `<div class="publishLayout">`
    + `<article class="publishPanel"><h2>1. Préparer le contenu</h2>`
    + `<div class="formatPicker">${formatButton('POST IMAGE', 'Post', true)}${formatButton('REEL', 'Reel')}${formatButton('STORY', 'Story')}</div>`
    + `<div class="field"><label for="mediaUrl"><span>URL média publique HTTPS</span><span class="counter" id="mediaHint">JPG/PNG/WebP</span></label>`
    + `<input id="mediaUrl" inputmode="url" autocomplete="off" placeholder="https://.../visuel.jpg"></div>`
    + renderLibrary()
    + `<div class="field"><label for="caption"><span>Légende</span><span class="counter" id="captionCount">0/2000</span></label>`
    + `<textarea id="caption" placeholder="Message principal de la publication"></textarea></div>`
    + `<div class="field"><label for="hashtags"><span>Hashtags</span><span class="counter">optionnel</span></label>`
    + `<input id="hashtags" value="#SowhatAfrica #WearTheCulture #Dakar #Senegal"></div>`
    + `<div class="field"><label for="altText"><span>Texte alternatif</span><span class="counter">accessibilité</span></label>`
    + `<input id="altText" value="Publication SOWHAT AFRICA."></div>`
    + `<div class="field"><label for="pubTitle"><span>Titre interne</span><span class="counter">cockpit</span></label>`
    + `<input id="pubTitle" value="SOWHAT AFRICA"></div>`
    + `<div class="field"><label for="collection"><span>Collection</span><span class="counter">optionnel</span></label>`
    + `<input id="collection" placeholder="Ex. Summer Winners"></div>`
    + `<div class="publishActions">`
    + `<button class="publishBtn preview" id="previewBtn" type="button">Tester en SAFE</button>`
    + `<button class="publishBtn commit" id="publishBtn" type="button" disabled>Publier maintenant</button>`
    + `</div>`
    + `<div class="publishNotice" id="publishNotice">Sécurité : un test SAFE est obligatoire avant chaque publication réelle. Le test envoie <b>dry_run=true / approved=false</b>. Le bouton Publier s’ouvre seulement après ce test, puis envoie <b>dry_run=false / approved=true</b>. Chaque publication porte une clé d’idempotence : un double clic ou un renvoi accidentel ne peut pas produire deux publications.</div>`
    + `</article>`
    + `<article class="publishPanel"><h2>2. Contrôle &amp; historique</h2>`
    + `<div class="panelSub">La connexion existante reste inchangée.</div>`
    + `<div class="connectionCard mt14"><h3>Instagram Bridge V2</h3>`
    + `<div class="connState"><span class="sdot"></span>@sowhatafrika · POST / REEL / STORY</div>`
    + `<p>Source imposée : <b>SOWHAT — Visual Factory V4</b>. Les contrôles du workflow n8n existant restent actifs.</p></div>`
    + `<div class="connectionCard mt9"><h3>Suivi</h3>`
    + `<div class="connState ${insightsOn ? '' : 'warn'}"><span class="sdot ${insightsOn ? '' : 'warn'}"></span>`
    + `${insightsOn ? 'Insights Instagram actifs' : 'Publication active · insights Cloudflare à finaliser'}</div>`
    + `<p>${insightsOn
      ? 'Après publication, utilisez Actualiser dans Connexions pour récupérer les nouvelles performances.'
      : 'Le pipeline de publication fonctionne via n8n même si le collecteur Insights du Worker n’a pas encore son token Instagram serveur.'}</p></div>`
    + `<div class="historyGrid mt10">`
    + (recent.length ? recent.map(historyCard).join('') : '<div class="empty">Aucune action de publication enregistrée depuis ce cockpit.</div>')
    + `</div></article>`
    + `</div></section>`;
}

function renderLibrary() {
  return `<div class="libraryHead"><h3>Mes visuels récents</h3>`
    + `<button class="libraryBtn" id="libraryBtn" type="button">Charger depuis R2</button></div>`
    + `<div class="library" id="library" hidden></div>`
    + `<div class="libraryEmpty" id="libraryEmpty" hidden></div>`;
}

function renderContentsView(topMedia) {
  const body = topMedia.length
    ? `<div class="mediaGrid">${topMedia.map(mediaCard).join('')}</div>`
    : emptyState('Aucun contenu analysé pour le moment.', 'La grille se remplira dès qu’une synchronisation Insights réussira. Aucune valeur n’est estimée en attendant.');
  return `<section class="view" data-view="contents">`
    + `<div class="sectionHead"><div><h1>Contenus</h1><p>Performance publication par publication.</p></div></div>`
    + body
    + `</section>`;
}

function renderCoachView(recommendations, formats, memory) {
  const wins = Array.isArray(recommendations.wins) ? recommendations.wins : [];
  const fixes = Array.isArray(recommendations.fixes) ? recommendations.fixes : [];
  const actions = Array.isArray(recommendations.next_actions) ? recommendations.next_actions : [];
  const bestFormat = Array.isArray(memory.best_formats) && memory.best_formats.length
    ? memory.best_formats[0]
    : null;

  const prioritySeed = recommendations.headline
    ? {
      publication_type: bestFormat && bestFormat.key === 'REEL' ? 'REEL' : 'POST IMAGE',
      caption: cleanText(recommendations.headline, 400),
      title: cleanText('Recommandation du Coach', 160),
    }
    : null;

  return `<section class="view" data-view="coach">`
    + `<div class="sectionHead"><div><h1>Coach SOWHAT</h1><p>Ce qui fonctionne, ce qui doit être corrigé et ce qu’il faut tester.</p></div></div>`
    + `<div class="coachGrid">`
    + coachBox('Priorité', [recommendations.headline, recommendations.summary], 'Analyse en attente de la première synchronisation.', prioritySeed)
    + coachBox('Ce qui fonctionne', wins, 'Les signaux gagnants apparaîtront ici une fois les données réelles disponibles.')
    + coachBox('À corriger', fixes, 'Les points de friction apparaîtront ici une fois les données réelles disponibles.')
    + coachBox('Actions prioritaires', actions, 'Les prochaines actions seront calculées à partir des données réelles.')
    + coachBox(
      'Formats',
      formats.map((row) => `${row.key} : ${row.avg_score}/100 sur ${row.n} contenu${row.n > 1 ? 's' : ''}`),
      'Pas encore assez de données mesurées.',
    )
    + `</div>`
    + renderMemorySection(memory)
    + `</section>`;
}

function renderMemorySection(memory) {
  const pending = 'En attente de synchronisation : la mémoire n’enregistre que des observations réelles.';
  return `<div class="sectionHead mt14"><div><h1>Mémoire de contenu</h1>`
    + `<p>Apprentissage cumulatif${memory.updated_at ? ` · mis à jour ${escapeHtml(dateRelative(memory.updated_at))}` : ''}.</p></div></div>`
    + `<div class="memoryGrid">`
    + memoryList('Formats gagnants', memory.best_formats, pending, (row) => (
      row.avg_score === null
        ? `${row.key} · ${row.published} publication${row.published > 1 ? 's' : ''} · pas encore mesuré`
        : `${row.key} · ${row.avg_score}/100 sur ${row.n} contenu${row.n > 1 ? 's' : ''}`
    ))
    + memoryList('Collections gagnantes', memory.best_collections, pending, (row) => (
      row.avg_score === null
        ? `${row.key} · ${row.published} publication${row.published > 1 ? 's' : ''} · pas encore mesuré`
        : `${row.key} · ${row.avg_score}/100`
    ))
    + memoryList('Hooks qui fonctionnent', memory.best_hooks, pending, (row) => `${row.hook} · ${row.avg_score}/100`)
    + memoryList('Meilleurs créneaux', memory.best_hours, pending, (row) => `${row.label} · ${row.avg_score}/100 sur ${row.n} contenu${row.n > 1 ? 's' : ''}`)
    + `</div>`;
}

function renderPlanView(plan) {
  const body = plan.length
    ? `<div class="planGrid">${plan.map(planCard).join('')}</div>`
    : emptyState('Le plan se construit après l’analyse.', 'Le moteur transformera les meilleurs signaux réels en calendrier d’action. Aucun plan fictif n’est généré.');
  return `<section class="view" data-view="plan">`
    + `<div class="sectionHead"><div><h1>Plan 7 jours</h1><p>Un plan court et directement exploitable.</p></div></div>`
    + body
    + `</section>`;
}

function renderConnectionsView({ insightsOn, bridgeOn, lastSync, visualFactoryUrl, publications }) {
  const factoryLink = visualFactoryUrl
    ? `<a class="cta" href="${escapeHtml(visualFactoryUrl)}" target="_blank" rel="noopener">Ouvrir Visual Factory ↗</a>`
    : '';
  return `<section class="view" data-view="connections">`
    + `<div class="sectionHead"><div><h1>Connexions</h1><p>État réel de chaque brique du système.</p></div></div>`
    + `<div class="connectionGrid">`
    + `<article class="connectionCard"><h3>Publication Instagram</h3>`
    + `<div class="connState ${bridgeOn ? '' : 'warn'}"><span class="sdot ${bridgeOn ? '' : 'warn'}"></span>`
    + `${bridgeOn ? 'Bridge SAFE disponible' : 'Bridge indisponible'}</div>`
    + `<p>Le cockpit appelle le workflow existant sans le remplacer. POST IMAGE, REEL et STORY restent protégés par dry_run / approved.</p>`
    + `<button class="cta gold mt10" type="button" data-target="publish">Ouvrir le studio</button></article>`
    + `<article class="connectionCard"><h3>Insights Instagram</h3>`
    + `<div class="connState ${insightsOn ? '' : 'warn'}"><span class="sdot ${insightsOn ? '' : 'warn'}"></span>`
    + `${insightsOn ? 'Connecté côté Worker' : 'Token serveur non présent'}</div>`
    + `<p>${insightsOn
      ? `Dernière analyse : ${escapeHtml(lastSync)}.`
      : 'Le cockpit n’invente aucune donnée. Les statistiques restent à zéro tant que le token Insights n’est pas disponible dans le runtime Cloudflare.'}</p>`
    + (insightsOn ? '<button class="cta petrol mt10" id="refreshBtn" type="button">Actualiser les statistiques</button>' : '')
    + `</article>`
    + `<article class="connectionCard"><h3>Visual Factory V4</h3>`
    + `<div class="connState"><span class="sdot"></span>Branchement préservé</div>`
    + `<p>Le système continue d’utiliser la source attendue « SOWHAT — Visual Factory V4 ». Aucun workflow n8n existant n’a été modifié.</p>`
    + factoryLink + `</article>`
    + `<article class="connectionCard"><h3>Stockage R2</h3>`
    + `<div class="connState"><span class="sdot"></span>Bucket privé monté</div>`
    + `<p>Les visuels déjà produits sont réutilisés directement depuis le bucket existant. Aucun fichier n’est dupliqué par le cockpit.</p></article>`
    + `<article class="connectionCard"><h3>Mobile</h3>`
    + `<div class="connState"><span class="sdot"></span>Touch-first</div>`
    + `<p>La sidebar bureau ne s’affiche que sur grand écran avec souris ; même le mode « site pour ordinateur » d’un téléphone conserve la navigation mobile.</p></article>`
    + `</div>`
    + `<div class="historyGrid mt10">${publications.map(historyCard).join('')}</div>`
    + `</section>`;
}

function renderBottomNav() {
  return `<nav class="bottomNav" aria-label="Navigation mobile">`
    + mobileNav('overview', '⌂', 'Vue', true)
    + mobileNav('publish', '＋', 'Publier')
    + mobileNav('contents', '▤', 'Contenus')
    + mobileNav('coach', '✦', 'Coach')
    + mobileNav('plan', '▦', 'Plan')
    + mobileNav('connections', '◉', 'Liens')
    + `</nav>`;
}

/* ------------------------------------------------------------------ */
/* Script client                                                       */
/* ------------------------------------------------------------------ */

function clientScriptCore(csrf) {
  return `
"use strict";
var CSRF = ${JSON.stringify(csrf)};
var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
var navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-target]'));
var toast = document.getElementById('toast');
var toastTimer = null;

function say(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3400);
}

function switchView(name) {
  views.forEach(function (view) { view.classList.toggle('active', view.dataset.view === name); });
  navButtons.forEach(function (button) { button.setAttribute('aria-selected', String(button.dataset.target === name)); });
  history.replaceState(null, '', '#' + name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach(function (button) {
  button.addEventListener('click', function () { switchView(button.dataset.target); });
});
var initialView = location.hash.slice(1);
if (views.some(function (view) { return view.dataset.view === initialView; })) switchView(initialView);
window.addEventListener('hashchange', function () {
  var name = location.hash.slice(1);
  if (views.some(function (view) { return view.dataset.view === name; })) switchView(name);
});

/* ---- Studio ---- */

var publicationType = 'POST IMAGE';
var previewReady = false;
var idempotencyKey = newIdempotencyKey();
var formatButtons = Array.prototype.slice.call(document.querySelectorAll('.formatBtn'));
var mediaHint = document.getElementById('mediaHint');
var fieldIds = ['mediaUrl', 'caption', 'hashtags', 'altText', 'pubTitle', 'collection'];

function newIdempotencyKey() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  var bytes = new Uint8Array(16);
  (window.crypto || {}).getRandomValues && window.crypto.getRandomValues(bytes);
  return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

function invalidatePreview() {
  previewReady = false;
  idempotencyKey = newIdempotencyKey();
  var commit = document.getElementById('publishBtn');
  if (commit) commit.disabled = true;
}

formatButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    publicationType = button.dataset.type;
    formatButtons.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
    mediaHint.textContent = publicationType === 'REEL' ? 'MP4/MOV' : 'JPG/PNG/WebP';
    invalidatePreview();
  });
});

fieldIds.forEach(function (id) {
  var field = document.getElementById(id);
  if (!field) return;
  field.addEventListener('input', function () {
    if (id === 'caption') {
      document.getElementById('captionCount').textContent = field.value.length + '/2000';
    }
    invalidatePreview();
  });
});

function value(id) {
  var field = document.getElementById(id);
  return field ? field.value.trim() : '';
}

function payload() {
  return {
    publication_type: publicationType,
    media_url: value('mediaUrl'),
    caption: value('caption'),
    hashtags: value('hashtags'),
    alt_text: value('altText'),
    title: value('pubTitle'),
    collection: value('collection'),
    idempotency_key: idempotencyKey
  };
}

var ERRORS = {
  public_https_media_url_required: 'Ajoutez une URL média HTTPS publique',
  caption_required: 'Ajoutez une légende',
  caption_too_long: 'Légende trop longue',
  reel_requires_public_mp4_or_mov: 'Un Reel doit utiliser une vidéo MP4/MOV publique',
  image_publication_requires_image_url: 'Post/Story : URL image JPG/PNG/WebP requise',
  preview_required_or_expired: 'Refaites le test SAFE avant de publier',
  explicit_confirmation_required: 'Confirmation explicite requise',
  duplicate_publication_rejected: 'Publication déjà envoyée avec cette clé : aucun doublon créé',
  publication_already_in_flight: 'Une publication identique est déjà en cours',
  idempotency_key_required: 'Clé d’idempotence manquante : rechargez la page',
  bridge_rejected: 'Le Bridge SAFE a refusé la demande',
  bridge_unreachable: 'Bridge SAFE inaccessible',
  csrf_rejected: 'Session expirée : rechargez la page',
  unauthorized: 'Session expirée : reconnectez-vous'
};

async function callPublish(mode) {
  var preview = document.getElementById('previewBtn');
  var commit = document.getElementById('publishBtn');
  preview.disabled = true;
  commit.disabled = true;
  try {
    var body = payload();
    if (mode === 'commit') body.confirmed = true;
    var response = await fetch('/api/social-intelligence/publish/' + mode, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-SOWHAT-CSRF': CSRF, accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'request_failed');
    if (mode === 'preview') {
      previewReady = true;
      commit.disabled = false;
      say('Test SAFE validé : publication réelle déverrouillée');
    } else {
      previewReady = false;
      commit.disabled = true;
      say(data.instagram_media_id ? 'Publié · ID Instagram ' + data.instagram_media_id : 'Demande de publication transmise au Bridge SAFE');
      setTimeout(function () { location.reload(); }, 1100);
    }
  } catch (error) {
    say(ERRORS[error.message] || 'Action impossible : ' + error.message);
  } finally {
    preview.disabled = false;
    if (mode === 'preview' && previewReady) commit.disabled = false;
  }
}

document.getElementById('previewBtn') && document.getElementById('previewBtn').addEventListener('click', function () { callPublish('preview'); });
document.getElementById('publishBtn') && document.getElementById('publishBtn').addEventListener('click', function () {
  if (!previewReady) { say('Test SAFE obligatoire avant publication'); return; }
  if (confirm('Publier réellement ce contenu sur @sowhatafrika ?')) callPublish('commit');
});
`;
}

function clientScriptLibrary() {
  return `
/* ---- Bibliotheque de visuels R2 ---- */

var libraryButton = document.getElementById('libraryBtn');
var libraryGrid = document.getElementById('library');
var libraryEmpty = document.getElementById('libraryEmpty');
var libraryLoaded = false;

function showLibraryMessage(message) {
  libraryGrid.hidden = true;
  libraryEmpty.hidden = false;
  libraryEmpty.textContent = message;
}

function selectVisual(card) {
  var mediaField = document.getElementById('mediaUrl');
  mediaField.value = card.dataset.url;
  Array.prototype.forEach.call(libraryGrid.children, function (other) {
    other.setAttribute('aria-pressed', String(other === card));
  });
  var wantedType = card.dataset.kind === 'video' ? 'REEL' : 'POST IMAGE';
  var target = formatButtons.filter(function (button) { return button.dataset.type === wantedType; })[0];
  if (target && publicationType !== wantedType) target.click();
  var titleField = document.getElementById('pubTitle');
  if (card.dataset.title && titleField && titleField.value === 'SOWHAT AFRICA') titleField.value = card.dataset.title;
  var collectionField = document.getElementById('collection');
  if (card.dataset.collection && collectionField && !collectionField.value) collectionField.value = card.dataset.collection;
  invalidatePreview();
  say('Visuel sélectionné depuis R2');
}

async function loadLibrary() {
  libraryButton.disabled = true;
  libraryButton.textContent = 'Chargement…';
  try {
    var response = await fetch('/api/social-intelligence/visuals', {
      headers: { 'X-SOWHAT-CSRF': CSRF, accept: 'application/json' },
      credentials: 'same-origin'
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'library_unavailable');
    var items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      showLibraryMessage('Aucun visuel dans le bucket R2 pour le moment. Produisez un visuel via Visual Factory : il apparaîtra ici.');
      return;
    }
    libraryGrid.innerHTML = '';
    items.forEach(function (item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'visualCard';
      card.setAttribute('aria-pressed', 'false');
      card.dataset.url = item.url;
      card.dataset.kind = item.kind;
      card.dataset.title = item.title || item.name || '';
      card.dataset.collection = item.collection || '';
      var tag = document.createElement('span');
      tag.className = 'vtype';
      tag.textContent = item.kind === 'video' ? 'VIDEO' : 'IMAGE';
      card.appendChild(tag);
      if (item.kind !== 'video') {
        var image = document.createElement('img');
        image.src = item.url;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        card.appendChild(image);
      }
      var meta = document.createElement('span');
      meta.className = 'vmeta';
      meta.textContent = item.title || item.name || 'Visuel';
      card.appendChild(meta);
      card.addEventListener('click', function () { selectVisual(card); });
      libraryGrid.appendChild(card);
    });
    libraryEmpty.hidden = true;
    libraryGrid.hidden = false;
    libraryLoaded = true;
    say(items.length + ' visuel' + (items.length > 1 ? 's' : '') + ' chargé' + (items.length > 1 ? 's' : '') + ' depuis R2');
  } catch (error) {
    showLibraryMessage(error.message === 'storage_unavailable'
      ? 'Stockage R2 indisponible pour ce Worker.'
      : 'Impossible de charger la bibliothèque : ' + error.message);
  } finally {
    libraryButton.disabled = false;
    libraryButton.textContent = libraryLoaded ? 'Rafraîchir' : 'Charger depuis R2';
  }
}

libraryButton && libraryButton.addEventListener('click', loadLibrary);
`;
}

function clientScriptSeeds() {
  return `
/* ---- Boucle Coach/Plan -> Studio ---- */

function applySeed(seed) {
  if (!seed || typeof seed !== 'object') return;
  if (seed.publication_type) {
    var target = formatButtons.filter(function (button) { return button.dataset.type === seed.publication_type; })[0];
    if (target) target.click();
  }
  var captionField = document.getElementById('caption');
  if (seed.caption && captionField) {
    captionField.value = seed.caption;
    document.getElementById('captionCount').textContent = captionField.value.length + '/2000';
  }
  var titleField = document.getElementById('pubTitle');
  if (seed.title && titleField) titleField.value = seed.title;
  var collectionField = document.getElementById('collection');
  if (seed.collection && collectionField) collectionField.value = seed.collection;
  invalidatePreview();
  switchView('publish');
  var mediaField = document.getElementById('mediaUrl');
  if (mediaField && !mediaField.value) {
    say('Studio prérempli. Choisissez un visuel puis testez en SAFE.');
    mediaField.focus({ preventScroll: true });
  } else {
    say('Studio prérempli depuis la recommandation.');
  }
}

Array.prototype.forEach.call(document.querySelectorAll('[data-seed]'), function (button) {
  button.addEventListener('click', function () {
    var seed = null;
    try { seed = JSON.parse(button.dataset.seed); } catch (error) { seed = null; }
    applySeed(seed);
  });
});
`;
}

function clientScriptSystem() {
  return `
/* ---- Synchronisation, PWA ---- */

async function refreshInsights() {
  var button = document.getElementById('refreshBtn');
  if (button) button.disabled = true;
  try {
    var response = await fetch('/api/social-intelligence/refresh', {
      method: 'POST',
      headers: { 'X-SOWHAT-CSRF': CSRF, accept: 'application/json' },
      credentials: 'same-origin'
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'sync_failed');
    say('Statistiques synchronisées');
    setTimeout(function () { location.reload(); }, 800);
  } catch (error) {
    say(error.message === 'instagram_insights_not_configured'
      ? 'Token Insights serveur non configuré'
      : 'Synchronisation impossible');
  } finally {
    if (button) button.disabled = false;
  }
}

var refreshButton = document.getElementById('refreshBtn');
refreshButton && refreshButton.addEventListener('click', refreshInsights);

var deferredPrompt = null;
var installButton = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.style.display = 'inline-flex';
});
installButton && installButton.addEventListener('click', async function () {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/social-intelligence/sw.js?v=4').catch(function () {});
}
`;
}

function clientScript(csrf) {
  return clientScriptCore(csrf) + clientScriptLibrary() + clientScriptSeeds() + clientScriptSystem();
}
