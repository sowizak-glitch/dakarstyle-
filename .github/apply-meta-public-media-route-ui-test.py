from pathlib import Path

p = Path('tests/ui-v5.mjs')
text = p.read_text()
old = "  assert.ok(STUDIO_CLIENT_JS.includes(\"return '/' + key.split('/').map(encodeURIComponent).join('/')\"));"
new = "  assert.ok(STUDIO_CLIENT_JS.includes(\"return '/sowhat-media/v5/' + suffix.split('/').map(encodeURIComponent).join('/')\"));"
if old not in text:
    raise SystemExit('stored preview assertion anchor not found')
p.write_text(text.replace(old, new, 1))
