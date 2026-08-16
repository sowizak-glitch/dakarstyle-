const TARGET = 'https://security.dakarstyle.com/';
const VERSION = '2.0.1-redirect';
const BODY = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=https://security.dakarstyle.com/"><meta name="robots" content="noindex,nofollow,noarchive"><title>SOWHAT Security Control</title><style>html{color-scheme:dark;background:#050a09;font-family:system-ui,sans-serif}body{min-height:100vh;margin:0;display:grid;place-items:center;color:#f3fff8}main{max-width:520px;padding:32px;text-align:center;border:1px solid rgba(162,255,207,.18);border-radius:24px;background:#0b1b17}a{display:inline-block;margin-top:16px;padding:13px 18px;border-radius:12px;background:#60f7a2;color:#042015;text-decoration:none;font-weight:800}</style></head><body><main><h1>SOWHAT Security Control</h1><p>Ouverture du centre de contrôle sécurisé…</p><a href="https://security.dakarstyle.com/">Ouvrir l’application</a></main></body></html>`;
Deno.serve((req)=>{
  if (![
    'GET',
    'HEAD'
  ].includes(req.method)) {
    return new Response(JSON.stringify({
      ok: false,
      code: 'METHOD_NOT_ALLOWED'
    }), {
      status: 405,
      headers: {
        Allow: 'GET, HEAD',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
  return new Response(req.method === 'HEAD' ? null : BODY, {
    status: 302,
    headers: {
      Location: TARGET,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-SOWHAT-Security-App-Version': VERSION
    }
  });
});
