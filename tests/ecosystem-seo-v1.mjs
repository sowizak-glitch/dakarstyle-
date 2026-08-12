import assert from 'node:assert/strict';
import { handleEcosystemSeoRequest, transformEcosystemSeoResponse, __testing } from '../src/ecosystem-seo-v1.js';

let assertions = 0;
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function req(url, method = 'GET') { return new Request(url, { method }); }
function htmlResponse(body = '<!doctype html><html><head><title>Legacy</title><meta name="description" content="old"></head><body><main><h1>App</h1></main></body></html>', headers = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
}

// 1. One canonical host for DakarStyle.
{
  const response = handleEcosystemSeoRequest(req('https://www.dakarstyle.com/journal/streetwear-senegal-2026/?utm_source=test'));
  equal(response.status, 308, 'www must permanently redirect');
  equal(response.headers.get('location'), 'https://dakarstyle.com/journal/streetwear-senegal-2026/?utm_source=test', 'www redirect preserves path and query');
}

// 2. Main sitemap combines commerce + authority content.
{
  const response = handleEcosystemSeoRequest(req('https://dakarstyle.com/sitemap.xml'));
  const body = await response.text();
  equal(response.status, 200, 'Dakar sitemap status');
  ok(body.includes('https://dakarstyle.com/products/maillot-senegal-2026/'), 'product URLs stay discoverable');
  ok(body.includes('https://dakarstyle.com/journal/streetwear-senegal-2026/'), 'journal URLs are discoverable');
  ok(body.includes('https://dakarstyle.com/ecosysteme/'), 'ecosystem hub is discoverable');
  ok(body.includes('<lastmod>2026-08-12</lastmod>'), 'sitemap has current lastmod');
}

// 3. SeneCompare and Sama Business own separate semantic territories.
{
  const sene = await handleEcosystemSeoRequest(req('https://senecompare.dakarstyle.com/sitemap.xml')).text();
  ok(sene.includes('/guides/comparer-prix-senegal/'), 'SeneCompare comparison guide');
  ok(!sene.includes('gestion-commerce-senegal'), 'SeneCompare sitemap does not absorb Sama Business topics');
  const sama = await handleEcosystemSeoRequest(req('https://samabusiness.dakarstyle.com/sitemap.xml')).text();
  ok(sama.includes('/guides/gestion-commerce-senegal/'), 'Sama Business commerce guide');
  ok(sama.includes('/guides/gestion-stock-dakar/'), 'Sama Business stock guide');
  ok(!sama.includes('prix-telephone-senegal'), 'Sama Business sitemap does not absorb SeneCompare topics');
}

// 4. Historical alias never becomes a duplicate index.
{
  const sitemap = handleEcosystemSeoRequest(req('https://samacahier.dakarstyle.com/sitemap.xml'));
  equal(sitemap.status, 308, 'legacy sitemap redirects');
  equal(sitemap.headers.get('location'), 'https://samabusiness.dakarstyle.com/sitemap.xml', 'legacy sitemap canonical target');
  const guide = handleEcosystemSeoRequest(req('https://samacahier.dakarstyle.com/guides/gestion-commerce-senegal/'));
  equal(guide.status, 308, 'legacy guide redirects');
  ok(guide.headers.get('location').startsWith('https://samabusiness.dakarstyle.com/'), 'legacy guide points at primary host');
}

// 5. Robots preserve crawlability of public pages and exclude machine/private routes.
{
  const dakar = await handleEcosystemSeoRequest(req('https://dakarstyle.com/robots.txt')).text();
  ok(dakar.includes('Disallow: /social-intelligence/'), 'private social cockpit excluded');
  ok(dakar.includes('Sitemap: https://dakarstyle.com/sitemap.xml'), 'Dakar sitemap declared');
  const sene = await handleEcosystemSeoRequest(req('https://senecompare.dakarstyle.com/robots.txt')).text();
  ok(sene.includes('Disallow: /api/'), 'SeneCompare API excluded from crawl budget');
  const sama = await handleEcosystemSeoRequest(req('https://samabusiness.dakarstyle.com/robots.txt')).text();
  ok(sama.includes('Disallow: /sites/'), 'generated/private site routes excluded');
}

// 6. Authority pages are server-rendered, canonical and structured.
for (const [host, pages] of Object.entries(__testing.GUIDE_PAGES)) {
  for (const path of Object.keys(pages)) {
    const response = handleEcosystemSeoRequest(req(`https://${host}${path}`));
    equal(response.status, 200, `guide status ${host}${path}`);
    ok(response.headers.get('x-robots-tag').startsWith('index'), `guide indexable ${host}${path}`);
    const body = await response.text();
    ok(body.includes(`<link rel="canonical" href="https://${host}${path}">`), `canonical ${host}${path}`);
    equal((body.match(/<h1\b/g) || []).length, 1, `one H1 ${host}${path}`);
    ok(body.includes('application/ld+json'), `JSON-LD ${host}${path}`);
    ok(body.includes('BreadcrumbList'), `breadcrumbs schema ${host}${path}`);
    ok(body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length > 280, `substantial copy ${host}${path}`);
  }
}

// 7. Query variants of guide pages are intentionally not emitted as duplicate SEO pages.
{
  equal(handleEcosystemSeoRequest(req('https://dakarstyle.com/journal/streetwear-senegal-2026/?ref=instagram')), null, 'guide parameter variant falls through');
  equal(handleEcosystemSeoRequest(req('https://senecompare.dakarstyle.com/guides/comparer-prix-senegal/?q=test')), null, 'SeneCompare guide parameter variant falls through');
}

// 8. DakarStyle home gets AETHER network, canonical metadata and schema exactly once.
{
  const request = req('https://dakarstyle.com/');
  const transformed = await transformEcosystemSeoResponse(request, htmlResponse());
  equal(transformed.headers.get('x-robots-tag').split(',')[0].trim(), 'index', 'Dakar clean root indexable');
  const body = await transformed.text();
  ok(body.includes('DakarStyle Sénégal | Streetwear &amp; Sowhat Africa à Dakar'), 'SEO title upgraded');
  ok(body.includes('data-aether-network="2027"'), 'AETHER network injected');
  ok(body.includes('data-aether-schema="dakarstyle-root"'), 'root graph injected');
  ok(body.includes('https://senecompare.dakarstyle.com/'), 'SeneCompare linked from ecosystem block');
  ok(body.includes('https://samabusiness.dakarstyle.com/'), 'Sama Business linked from ecosystem block');
  const second = __testing.injectDakarHome(body);
  equal((second.match(/data-aether-network="2027"/g) || []).length, 1, 'home injection is idempotent');
}

// 9. Tracking parameters never create a second indexable DakarStyle homepage.
{
  const transformed = await transformEcosystemSeoResponse(req('https://dakarstyle.com/?utm_source=instagram'), htmlResponse());
  equal(transformed.headers.get('x-robots-tag'), 'noindex, follow', 'Dakar parameter variant noindex');
  equal(transformed.headers.get('link'), '<https://dakarstyle.com/>; rel="canonical"', 'Dakar parameter variant canonical');
}

// 10. Critical bug regression: public Sama Business root overrides the legacy global noindex.
{
  const transformed = await transformEcosystemSeoResponse(
    req('https://samabusiness.dakarstyle.com/'),
    htmlResponse(undefined, { 'x-robots-tag': 'noindex, nofollow, noarchive' }),
  );
  ok(transformed.headers.get('x-robots-tag').startsWith('index, follow'), 'Sama public root is indexable');
  const body = await transformed.text();
  ok(body.includes('Sama Business Sénégal | Gestion ventes, stock &amp; WhatsApp'), 'Sama SEO title injected');
  ok(body.includes('data-aether-schema="samabusiness-root"'), 'Sama application schema injected');
  ok(body.includes('<link rel="canonical" href="https://samabusiness.dakarstyle.com/">'), 'Sama canonical injected');
}

// 11. App-state/query variants remain private despite the public root fix.
{
  const transformed = await transformEcosystemSeoResponse(
    req('https://samabusiness.dakarstyle.com/?module=debts'),
    htmlResponse(undefined, { 'x-robots-tag': 'noindex, nofollow, noarchive' }),
  );
  equal(transformed.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', 'Sama app state remains noindex');
}

// 12. Historical samacahier shell remains noindex and canonicalised to Sama Business.
{
  const transformed = await transformEcosystemSeoResponse(
    req('https://samacahier.dakarstyle.com/'),
    htmlResponse(undefined, { 'x-robots-tag': 'noindex, nofollow, noarchive' }),
  );
  equal(transformed.headers.get('x-robots-tag'), 'noindex, follow, noarchive', 'legacy host noindex');
  equal(transformed.headers.get('link'), '<https://samabusiness.dakarstyle.com/>; rel="canonical"', 'legacy canonical header');
  const body = await transformed.text();
  ok(body.includes('<meta name="robots" content="noindex,follow,noarchive">'), 'legacy HTML noindex');
}

// 13. SeneCompare root gets its own indexable identity; search/app states do not.
{
  const root = await transformEcosystemSeoResponse(req('https://senecompare.dakarstyle.com/'), htmlResponse());
  ok(root.headers.get('x-robots-tag').startsWith('index, follow'), 'SeneCompare clean root indexable');
  const body = await root.text();
  ok(body.includes('SeneCompare Sénégal | Comparer prix, produits et services'), 'SeneCompare title');
  ok(body.includes('data-aether-schema="senecompare-root"'), 'SeneCompare SoftwareApplication schema');
  const query = await transformEcosystemSeoResponse(req('https://senecompare.dakarstyle.com/?q=iphone'), htmlResponse());
  equal(query.headers.get('x-robots-tag'), 'noindex, follow', 'SeneCompare dynamic search state noindex');
}

// 14. llms.txt exposes only public knowledge surfaces and canonical identities.
{
  const dakar = await handleEcosystemSeoRequest(req('https://dakarstyle.com/llms.txt')).text();
  ok(dakar.includes('https://sowhatafrica.com/'), 'Sowhat Africa relationship documented');
  const sama = await handleEcosystemSeoRequest(req('https://samabusiness.dakarstyle.com/llms.txt')).text();
  ok(sama.includes('Private user data'), 'Sama privacy boundary documented');
}

// 15. SEO handler is read-only and never captures writes.
{
  equal(handleEcosystemSeoRequest(req('https://samabusiness.dakarstyle.com/', 'POST')), null, 'POST bypasses SEO handler');
}

console.log(`ecosystem-seo-v1: ${assertions} assertions passed`);
