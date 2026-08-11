from pathlib import Path

path = Path('tests/instagram-client-v5.mjs')
text = path.read_text()
old = """    assert.ok(!captured[0].url.includes('access_token='), `${flow} : pas de token dans l URL d une ecriture`);
    assert.ok(!captured[0].url.includes(TOKEN), `${flow} : pas de token dans l URL`);
    assert.ok(captured[0].init.body.includes('caption=test'));
    if (flow === META_API_FLOW.FACEBOOK_LOGIN) {
      assert.ok(captured[0].init.body.includes('access_token='), 'flux query : credential dans le corps');
    } else {
      assert.equal(captured[0].init.headers.authorization, `Bearer ${TOKEN}`);
      assert.ok(!captured[0].init.body.includes('access_token='));
    }"""
new = """    assert.ok(!captured[0].url.includes('access_token='), `${flow} : pas de token dans l URL d une ecriture`);
    assert.ok(!captured[0].url.includes(TOKEN), `${flow} : pas de token dans l URL`);
    if (flow === META_API_FLOW.FACEBOOK_LOGIN) {
      assert.equal(typeof captured[0].init.body, 'string');
      assert.ok(captured[0].init.body.includes('caption=test'));
      assert.ok(captured[0].init.body.includes('access_token='), 'flux query : credential dans le corps');
    } else {
      assert.ok(captured[0].init.body instanceof FormData, 'Instagram Login : corps multipart');
      assert.equal(captured[0].init.body.get('caption'), 'test');
      assert.equal(captured[0].init.body.get('access_token'), null, 'Bearer uniquement');
      assert.equal(captured[0].init.headers.authorization, `Bearer ${TOKEN}`);
    }"""
if old not in text:
    raise SystemExit('legacy write assertion anchor not found')
path.write_text(text.replace(old, new, 1))
