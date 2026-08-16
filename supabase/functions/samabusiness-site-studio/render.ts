function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char)=>({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char] ?? char);
}
export function renderSite(config) {
  const section = (type)=>config.sections?.find((item)=>item.type === type)?.data ?? {};
  const hero = section("hero");
  const features = section("features");
  const about = section("about");
  const contact = section("contact");
  const footer = section("footer");
  const theme = config.theme ?? {};
  const methods = Array.isArray(contact.methods) ? contact.methods : [];
  const primary = /^#[0-9a-f]{6}$/i.test(theme.primaryColor) ? theme.primaryColor : "#087A45";
  const secondary = /^#[0-9a-f]{6}$/i.test(theme.secondaryColor) ? theme.secondaryColor : "#071A32";
  const accent = /^#[0-9a-f]{6}$/i.test(theme.accentColor) ? theme.accentColor : "#F4C430";
  const background = /^#[0-9a-f]{6}$/i.test(theme.backgroundColor) ? theme.backgroundColor : "#F7FAF8";
  const title = escapeHtml(config.siteMetadata?.title || config.navigation?.brandName || "Site Sama Business");
  const phone = methods.find((item)=>item.type === "phone")?.value ?? "";
  const whatsapp = methods.find((item)=>item.type === "whatsapp")?.value ?? "";
  const featureCards = (features.items ?? []).map((item)=>`
    <article class="card">
      <div class="card-icon">✅</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
    </article>`).join("");
  const contactCards = methods.map((item)=>{
    const href = item.type === "phone" ? `tel:${String(item.value).replace(/[^+0-9]/g, "")}` : item.type === "whatsapp" ? `https://wa.me/${String(item.value).replace(/\D/g, "")}` : `mailto:${escapeHtml(item.value)}`;
    return `<a class="contact-card" href="${href}"><span>${escapeHtml(item.visual || "💬")}</span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.value)}</small></a>`;
  }).join("");
  return `<!doctype html>
<html lang="${escapeHtml(config.siteMetadata?.language || "fr")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="${primary}">
  <meta name="description" content="${escapeHtml(config.siteMetadata?.description || "")}">
  <title>${title}</title>
  <style>
    :root{--p:${primary};--s:${secondary};--a:${accent};--bg:${background};--text:#10231c;--muted:#667085;--surface:#fff}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:500 16px/1.5 Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif}a{text-decoration:none;color:inherit}.wrap{max-width:1160px;margin:auto;padding-left:18px;padding-right:18px}.nav{position:sticky;top:0;z-index:5;background:#ffffffeb;backdrop-filter:blur(18px);border-bottom:1px solid #10231c14}.nav-inner{min-height:72px;display:flex;align-items:center;gap:12px;font-weight:900}.brand-mark{width:48px;height:48px;border-radius:17px;background:linear-gradient(135deg,var(--s),var(--p));display:grid;place-items:center;font-size:25px}.hero{padding:76px 0;background:radial-gradient(circle at 86% 8%,#f4c43066,transparent 27%),linear-gradient(135deg,var(--s),var(--p));color:#fff}.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#ffffff20;font-weight:850}.hero h1{max-width:930px;margin:20px 0;font-size:clamp(42px,8vw,88px);line-height:.96;letter-spacing:-.065em}.hero p{max-width:730px;font-size:clamp(18px,2.3vw,23px);color:#ffffffcc}.button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;padding:13px 18px;margin:10px 8px 0 0;border-radius:16px;background:var(--a);color:#111;font-weight:900}.section{padding:66px 0}.section h2{font-size:clamp(30px,5vw,48px);letter-spacing:-.045em}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.card{background:var(--surface);border:1px solid #10231c12;border-radius:24px;padding:22px;box-shadow:0 12px 35px #10231c0d}.card-icon{font-size:34px}.about{background:var(--s);color:#fff}.contacts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.contact-card{min-height:92px;background:#fff;border-radius:20px;padding:16px;display:grid;grid-template-columns:auto 1fr;gap:3px 11px;align-items:center}.contact-card span{grid-row:1/3;font-size:30px}.contact-card small{color:var(--muted)}footer{padding:36px 0 110px;color:var(--muted)}.mobile-actions{display:none}@media(max-width:760px){.grid,.contacts{grid-template-columns:1fr}.hero{padding:54px 0}.mobile-actions{position:fixed;z-index:7;left:9px;right:9px;bottom:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;border-radius:21px;background:#ffffffed;box-shadow:0 15px 40px #0003}.mobile-actions .button{margin:0}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body>
  <nav class="nav"><div class="wrap nav-inner"><span class="brand-mark">${escapeHtml(hero.visualIcon || "🌐")}</span>${title}</div></nav>
  <main>
    <section id="hero" class="hero"><div class="wrap"><span class="badge">${escapeHtml(hero.badge || "")}</span><h1>${escapeHtml(hero.headline || title)}</h1><p>${escapeHtml(hero.subheadline || "")}</p><a class="button" href="#features">➡️ ${escapeHtml(hero.primaryCta?.text || "Découvrir")}</a><a class="button" href="#contact">💬 ${escapeHtml(hero.secondaryCta?.text || "Contact")}</a></div></section>
    <section id="features" class="section"><div class="wrap"><h2>${escapeHtml(features.sectionTitle || "Nos solutions")}</h2><p>${escapeHtml(features.sectionSubtitle || "")}</p><div class="grid">${featureCards}</div></div></section>
    <section id="about" class="section about"><div class="wrap"><h2>${escapeHtml(about.sectionTitle || "À propos")}</h2><p>${escapeHtml(about.description || "")}</p></div></section>
    <section id="contact" class="section"><div class="wrap"><h2>${escapeHtml(contact.sectionTitle || "Contact")}</h2><p>${escapeHtml(contact.sectionSubtitle || "")}</p><div class="contacts">${contactCards}</div></div></section>
  </main>
  <footer><div class="wrap">${escapeHtml(footer.copyright || "")}</div></footer>
  <div class="mobile-actions"><a class="button" href="tel:${String(phone).replace(/[^+0-9]/g, "")}">📞 Appeler</a><a class="button" href="https://wa.me/${String(whatsapp).replace(/\D/g, "")}">💬 WhatsApp</a></div>
</body>
</html>`;
}
