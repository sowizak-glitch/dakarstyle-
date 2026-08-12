const RELEASE = 'aether-cwv-2027.1';
const HOST = 'dakarstyle.com';
const CRITICAL_HINTS = [
  '</assets/css/dakarstyle-base-2026.css>; rel=preload; as=style',
  '</assets/js/dakarstyle-base-2026.js>; rel=preload; as=script',
];

function appendLink(headers, value) {
  const existing = headers.get('link');
  if (!existing) {
    headers.set('link', value);
    return;
  }
  if (!existing.includes(value)) headers.set('link', `${existing}, ${value}`);
}

export function applyDakarstyleCwvHints(request, response) {
  if (!response || !['GET', 'HEAD'].includes(request.method)) return response;
  const url = new URL(request.url);
  if (url.hostname !== HOST || url.pathname !== '/' || url.search) return response;
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) return response;

  const headers = new Headers(response.headers);
  for (const hint of CRITICAL_HINTS) appendLink(headers, hint);
  headers.set('x-aether-cwv-release', RELEASE);

  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const __testing = Object.freeze({ RELEASE, HOST, CRITICAL_HINTS });
