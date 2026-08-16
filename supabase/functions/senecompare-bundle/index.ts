const VERSION = '1.0.0';
const html = await Deno.readTextFile(new URL('./app.html', import.meta.url));
Deno.serve((request)=>{
  if (![
    'GET',
    'HEAD',
    'OPTIONS'
  ].includes(request.method)) {
    return new Response('Method not allowed', {
      status: 405
    });
  }
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204
  });
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
      'X-SeneCompare-Version': VERSION
    }
  });
});
