import icon192 from './senecompare-brand-icon192.js';
import icon512 from './senecompare-brand-icon512.js';

export const SENECOMPARE_RELEASE = '5.2.0';

const ASSETS = new Map([
  ['/icon-192.webp', { data: icon192, type: 'image/webp', size: '192x192' }],
  ['/icon-512.webp', { data: icon512, type: 'image/webp', size: '512x512' }],
  ['/maskable-512.webp', { data: icon512, type: 'image/webp', size: '512x512' }],
  ['/profile.webp', { data: icon512, type: 'image/webp', size: '512x512' }],
  ['/apple-touch-icon.webp', { data: icon192, type: 'image/webp', size: '192x192' }],
  ['/favicon.webp', { data: icon192, type: 'image/webp', size: '192x192' }],
]);

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function isBrandAsset(pathname) {
  return ASSETS.has(pathname);
}

export function brandAssetResponse(request, pathname) {
  const asset = ASSETS.get(pathname);
  if (!asset) return null;
  const headers = new Headers({
    'Content-Type': asset.type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-SeneCompare-Release': SENECOMPARE_RELEASE,
    'X-SeneCompare-Asset-Size': asset.size,
  });
  return new Response(request.method === 'HEAD' ? null : decodeBase64(asset.data), { status: 200, headers });
}

export const BRAND_URLS = Object.freeze({
  icon192: '/icon-192.webp?v=520',
  icon512: '/icon-512.webp?v=520',
  maskable512: '/maskable-512.webp?v=520',
  profile: '/profile.webp?v=520',
  appleTouch: '/apple-touch-icon.webp?v=520',
  favicon: '/favicon.webp?v=520',
});
