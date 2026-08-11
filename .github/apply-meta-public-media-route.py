from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1))

# 1) Public URL is no longer the internal R2 key path. /visuals/* can be owned
# by another Cloudflare route, so Meta gets a dedicated collision-free path.
replace_once(
    'src/media-upload-v5.js',
    "export const V5_PUBLIC_MEDIA_PREFIX = `/${MEDIA_KEY_PREFIX}`;\n\nexport function isV5PublicMediaPath(pathname) {\n  return String(pathname || '').startsWith(V5_PUBLIC_MEDIA_PREFIX);\n}",
    "export const V5_PUBLIC_MEDIA_PREFIX = '/sowhat-media/v5/';\n\nexport function publicMediaPathForKey(r2Key) {\n  const key = String(r2Key || '');\n  if (!key.startsWith(MEDIA_KEY_PREFIX)) return '';\n  const suffix = key.slice(MEDIA_KEY_PREFIX.length);\n  if (!suffix || suffix.includes('..') || suffix.includes('//') || suffix.includes('\\\\')) return '';\n  return `${V5_PUBLIC_MEDIA_PREFIX}${suffix.split('/').map(encodeURIComponent).join('/')}`;\n}\n\nexport function isV5PublicMediaPath(pathname) {\n  return String(pathname || '').startsWith(V5_PUBLIC_MEDIA_PREFIX);\n}",
)

replace_once(
    'src/media-upload-v5.js',
    "  const url = new URL(request.url);\n  let key;\n  try {\n    key = decodeURIComponent(url.pathname.replace(/^\\/+/, ''));\n  } catch {\n    return new Response('Bad Request', { status: 400, headers: { 'cache-control': 'no-store' } });\n  }\n  if (!key.startsWith(MEDIA_KEY_PREFIX) || key.includes('..') || key.includes('//') || key.includes('\\\\')) {\n    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });\n  }",
    "  const url = new URL(request.url);\n  let suffix;\n  try {\n    suffix = decodeURIComponent(url.pathname.slice(V5_PUBLIC_MEDIA_PREFIX.length));\n  } catch {\n    return new Response('Bad Request', { status: 400, headers: { 'cache-control': 'no-store' } });\n  }\n  if (!suffix || suffix.startsWith('/') || suffix.includes('..') || suffix.includes('//') || suffix.includes('\\\\')) {\n    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });\n  }\n  const key = `${MEDIA_KEY_PREFIX}${suffix}`;\n  if (!key.startsWith(MEDIA_KEY_PREFIX) || key.includes('..') || key.includes('//') || key.includes('\\\\')) {\n    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });\n  }",
)

# 2) Publishing composes a public URL, not an R2 key URL.
replace_once(
    'src/publishing-v5.js',
    "import { META_ERROR, MetaApiError } from './instagram-client-v5.js';\n",
    "import { META_ERROR, MetaApiError } from './instagram-client-v5.js';\nimport { publicMediaPathForKey } from './media-upload-v5.js';\n",
)
replace_once(
    'src/publishing-v5.js',
    "  return `${origin}/${key}`;",
    "  const publicPath = publicMediaPathForKey(key);\n  if (!publicPath) {\n    throw publishError(PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, 'cle de media hors du chemin public V5', PUBLISH_STAGE.PREFLIGHT);\n  }\n  return `${origin}${publicPath}`;",
)

# 3) Stored-draft preview uses the same public route.
replace_once(
    'src/studio-client-v5.js',
    "    return '/' + key.split('/').map(encodeURIComponent).join('/');",
    "    var suffix = key.slice(prefix.length);\n    if (!suffix) return '';\n    return '/sowhat-media/v5/' + suffix.split('/').map(encodeURIComponent).join('/');",
)

# 4) Tests: media route semantics.
p = Path('tests/media-upload-v5.mjs')
t = p.read_text()
t = t.replace(
    "  handleMediaUpload, isV5PublicMediaPath, newMediaKey, serveV5Media,",
    "  handleMediaUpload, isV5PublicMediaPath, newMediaKey, publicMediaPathForKey, serveV5Media,",
)
t = t.replace(
    "  assert.equal(V5_PUBLIC_MEDIA_PREFIX, `/${MEDIA_KEY_PREFIX}`);\n  assert.equal(isV5PublicMediaPath(`/${MEDIA_KEY_PREFIX}abc.jpg`), true);\n  assert.equal(isV5PublicMediaPath('/visuals/media/autre.jpg'), false, 'la V4 garde son prefixe');",
    "  assert.equal(V5_PUBLIC_MEDIA_PREFIX, '/sowhat-media/v5/');\n  assert.equal(publicMediaPathForKey(`${MEDIA_KEY_PREFIX}abc.jpg`), '/sowhat-media/v5/abc.jpg');\n  assert.equal(isV5PublicMediaPath('/sowhat-media/v5/abc.jpg'), true);\n  assert.equal(isV5PublicMediaPath(`/${MEDIA_KEY_PREFIX}abc.jpg`), false, 'la cle R2 interne n est plus une URL publique');\n  assert.equal(isV5PublicMediaPath('/visuals/media/autre.jpg'), false, 'la V4 garde son prefixe');",
)
t = t.replace(
    "new Request(`https://dakarstyle.com/${uploaded.media.r2_key}`)",
    "new Request(`https://dakarstyle.com${publicMediaPathForKey(uploaded.media.r2_key)}`)",
)
t = t.replace(
    "new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}a.jpg`, { method: 'DELETE' })",
    "new Request('https://dakarstyle.com/sowhat-media/v5/a.jpg', { method: 'DELETE' })",
)
t = t.replace("    `/${MEDIA_KEY_PREFIX}sous/../../../media/secret.jpg`,", "    '/sowhat-media/v5/sous/../../../media/secret.jpg',")
t = t.replace("    `/${MEDIA_KEY_PREFIX}sous//dossier.jpg`,", "    '/sowhat-media/v5/sous//dossier.jpg',")
t = t.replace(
    "new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}piege.jpg`), makeEnv(bucket),",
    "new Request('https://dakarstyle.com/sowhat-media/v5/piege.jpg'), makeEnv(bucket),",
)
t = t.replace(
    "new Request(`https://dakarstyle.com/${MEDIA_KEY_PREFIX}inconnu.jpg`), makeEnv(),",
    "new Request('https://dakarstyle.com/sowhat-media/v5/inconnu.jpg'), makeEnv(),",
)
p.write_text(t)

# Routes: the new public route must bypass auth; the internal R2 key path must not.
p = Path('tests/routes-v5.mjs')
t = p.read_text()
t = t.replace(
    "assert.equal(v5(`/${MEDIA_KEY_PREFIX}abc.jpg`), true, 'les medias V5 doivent etre routes par la V5');",
    "assert.equal(v5('/sowhat-media/v5/abc.jpg'), true, 'les medias V5 doivent etre routes par la V5');\n  assert.equal(v5(`/${MEDIA_KEY_PREFIX}abc.jpg`), false, 'la cle R2 interne ne doit plus etre exposee comme route');",
)
t = t.replace(
    "const response = await call(env, req(`/${MEDIA_KEY_PREFIX}visuel.jpg`, { auth: false }));",
    "const response = await call(env, req('/sowhat-media/v5/visuel.jpg', { auth: false }));",
)
p.write_text(t)

# Publishing + Meta client expected public URLs.
for name in ['tests/publishing-v5.mjs', 'tests/instagram-client-v5.mjs']:
    p = Path(name)
    t = p.read_text().replace('/visuals/social-intelligence/v5/media/', '/sowhat-media/v5/')
    p.write_text(t)

# Publishing tests must use a real V5 R2 key. The public URL is deliberately
# no longer identical to that internal key.
p = Path('tests/publishing-v5.mjs')
t = p.read_text()
t = t.replace(
    "import { handleMediaUpload, isV5PublicMediaPath, newMediaKey, serveV5Media } from '../src/media-upload-v5.js';",
    "import { handleMediaUpload, isV5PublicMediaPath, newMediaKey, publicMediaPathForKey, serveV5Media } from '../src/media-upload-v5.js';",
)
t = t.replace(
    "  assert.equal(mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://visuals.dakarstyle.com' }, 'a/b.jpg'), 'https://visuals.dakarstyle.com/a/b.jpg');\n  for (const base of ['', 'http://visuals.dakarstyle.com', 'https://visuals.dakarstyle.com:8443', 'pas-une-url']) {\n    assert.throws(() => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: base }, 'a.jpg'), (e) => e.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, base);\n  }",
    "  assert.equal(mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: 'https://visuals.dakarstyle.com' }, `${MEDIA_KEY_PREFIX}a/b.jpg`), 'https://visuals.dakarstyle.com/sowhat-media/v5/a/b.jpg');\n  for (const base of ['', 'http://visuals.dakarstyle.com', 'https://visuals.dakarstyle.com:8443', 'pas-une-url']) {\n    assert.throws(() => mediaUrlFor({ SOWHAT_MEDIA_PUBLIC_BASE: base }, `${MEDIA_KEY_PREFIX}a.jpg`), (e) => e.code === PUBLISH_ERROR.MEDIA_URL_NOT_CONFIGURED, base);\n  }",
)
t = t.replace(
    "  assert.equal(url, `https://dakarstyle.com/${key}`);",
    "  assert.equal(url, `https://dakarstyle.com${publicMediaPathForKey(key)}`);",
)
p.write_text(t)

# UI tests can pin the collision-free path to prevent regression.
p = Path('tests/ui-v5.mjs')
t = p.read_text()
needle = "assert.ok(STUDIO_CLIENT_JS.includes('media/upload'))"
if needle in t and "sowhat-media/v5" not in t:
    t = t.replace(needle, needle + ";\n  assert.ok(STUDIO_CLIENT_JS.includes('/sowhat-media/v5/'), 'aperçu stocké sur route publique sans collision')")
p.write_text(t)
