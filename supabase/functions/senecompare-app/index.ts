const VERSION = '4.1.0';
const html = await Deno.readTextFile(new URL('./app.html', import.meta.url));
Deno.serve((request)=>{
  if (![
    'GET',
    'HEAD',
    'OPTIONS'
  ].includes(request.method)) {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD, OPTIONS'
      }
    });
  }
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204
  });
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), geolocation=(self), microphone=(self), payment=()',
      'X-SeneCompare-Version': VERSION
    }
  });
});
