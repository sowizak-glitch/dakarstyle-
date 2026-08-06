import storefront from './samabusiness-site-proxy.js';

const VERSION = '13.1.0';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}

function textFrom(html, expression, fallback = '') {
  const match = html.match(expression);
  return match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function publicUrl(url) {
  const clean = new URL(url);
  clean.searchParams.delete('preview');
  clean.searchParams.delete('token');
  clean.hash = '';
  return clean.toString();
}

function socialHead(html, url, preview) {
  const title = textFrom(html, /<title[^>]*>([\s\S]*?)<\/title>/i, 'Boutique en ligne');
  const description = textFrom(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, `Découvrez ${title} et commandez directement sur WhatsApp.`);
  const image = textFrom(html, /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i, '');
  const canonical = publicUrl(url);
  const tags = [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    '<meta property="og:site_name" content="Sama Business">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`);
  }
  if (preview) tags.push('<meta name="robots" content="noindex,nofollow,noarchive">');
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Sama Business', url: 'https://samabusiness.dakarstyle.com/' },
  }).replace(/</g, '\\u003c');
  tags.push(`<script type="application/ld+json">${schema}</script>`);
  return tags.join('');
}

function shareExperience(url, preview) {
  const target = publicUrl(url);
  const label = preview ? 'Aperçu privé' : 'Partager';
  const disabled = preview ? ' disabled aria-disabled="true"' : '';
  return `<style data-sama-storefront-share="${VERSION}">
.sama-store-share{position:fixed;left:16px;bottom:86px;z-index:97;min-height:58px;padding:0 17px;border:0;border-radius:19px;background:#fff;color:#10231c;font-weight:950;box-shadow:0 18px 45px rgba(7,26,50,.2);display:flex;align-items:center;gap:8px}.sama-store-share:not(:disabled):active{transform:scale(.97)}.sama-store-share:disabled{opacity:.72;color:#795a00;background:#fff8df}.sama-store-toast{position:fixed;z-index:160;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(92vw,540px);padding:13px 16px;border-radius:15px;background:#10231c;color:#fff;font:850 13px/1.4 system-ui;box-shadow:0 18px 50px rgba(0,0,0,.25)}@media(max-width:620px){.sama-store-share{left:10px;bottom:78px;min-height:54px;padding:0 14px}}
</style><button class="sama-store-share" type="button" data-sama-store-share${disabled}>↗ ${label}</button><script data-sama-store-share-script="${VERSION}">(()=>{const button=document.querySelector('[data-sama-store-share]');if(!button||button.disabled)return;const payload={title:document.title,text:'Découvrez cette boutique et commandez directement sur WhatsApp.',url:${JSON.stringify(target)}};const toast=m=>{let n=document.querySelector('.sama-store-toast');if(!n){n=document.createElement('div');n.className='sama-store-toast';document.body.append(n)}n.textContent=m;clearTimeout(n._t);n._t=setTimeout(()=>n.remove(),3200)};button.onclick=async()=>{if(navigator.share){try{await navigator.share(payload);return}catch(e){if(e&&e.name==='AbortError')return}}try{await navigator.clipboard.writeText(payload.url);toast('Lien de la boutique copié.')}catch(_){const t=document.createElement('textarea');t.value=payload.url;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('Lien copié.')}}})();</script>`;
}

function inject(html, requestUrl) {
  const url = new URL(requestUrl);
  const preview = url.searchParams.has('preview');
  let output = html;
  if (!output.includes('data-sama-storefront-share=')) {
    const head = socialHead(output, url, preview);
    output = /<\/head>/i.test(output) ? output.replace(/<\/head>/i, `${head}</head>`) : `${head}${output}`;
    const experience = shareExperience(url, preview);
    output = /<\/body>/i.test(output) ? output.replace(/<\/body>/i, `${experience}</body>`) : `${output}${experience}`;
  }
  return output;
}

export default {
  async fetch(request, env, ctx) {
    const response = await storefront.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set('x-samabusiness-storefront', VERSION);
    headers.delete('content-length');
    headers.delete('content-encoding');
    if (request.method === 'HEAD') return new Response(null, { status: response.status, statusText: response.statusText, headers });
    const contentType = (headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    const html = inject(await response.text(), request.url);
    headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  },
};
