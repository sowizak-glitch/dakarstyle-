import application from './index.js';

const SAMABUSINESS_HOSTS = new Set([
  'samabusiness.dakarstyle.com',
  'samacahier.dakarstyle.com',
]);

const SAMABUSINESS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://xmdpmtvieqgoorbxytey.supabase.co https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://dakarstyle.com https://www.dakarstyle.com",
  "font-src 'self' data: https:",
  "connect-src 'self' https://xmdpmtvieqgoorbxytey.supabase.co wss://xmdpmtvieqgoorbxytey.supabase.co",
  "manifest-src 'self' https://xmdpmtvieqgoorbxytey.supabase.co",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

function isSamabusinessHtmlRoute(url) {
  const mode = String(url.searchParams.get('mode') || '').toLowerCase();
  const nonHtmlModes = new Set(['health', 'manifest', 'sw', 'icon', 'logo']);
  const nonHtmlPaths = new Set([
    '/health',
    '/manifest.webmanifest',
    '/sw.js',
    '/icon.svg',
    '/logo.webp',
  ]);
  return !nonHtmlModes.has(mode) && !nonHtmlPaths.has(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const response = await application.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (!SAMABUSINESS_HOSTS.has(url.hostname)) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');

    const htmlRoute = isSamabusinessHtmlRoute(url);
    const upstreamContentType = headers.get('content-type') || '';
    if (htmlRoute) {
      // Supabase can expose the valid HTML payload as text/plain through its gateway.
      // Force browser parsing only on application document routes; API/PWA assets retain their own types.
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('content-security-policy', SAMABUSINESS_CSP);
      headers.set('x-frame-options', 'DENY');
      headers.set('x-samabusiness-content-type-repaired', upstreamContentType || 'missing');
    } else if (upstreamContentType.includes('text/html')) {
      headers.set('content-security-policy', SAMABUSINESS_CSP);
      headers.set('x-frame-options', 'DENY');
    }

    headers.delete('content-length');
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
