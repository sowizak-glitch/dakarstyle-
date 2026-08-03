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

export default {
  async fetch(request, env, ctx) {
    const response = await application.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (!SAMABUSINESS_HOSTS.has(url.hostname)) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');

    const contentType = headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      headers.set('content-security-policy', SAMABUSINESS_CSP);
      headers.set('x-frame-options', 'DENY');
    }

    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
