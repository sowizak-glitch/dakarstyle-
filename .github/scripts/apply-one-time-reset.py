from pathlib import Path

p = Path('src/social-intelligence-v3.js')
s = p.read_text()

old = "const AUTH_PREFIX = 'visuals/social-intelligence/auth/';\n"
new = old + "const LOGIN_PASSWORD_OVERRIDE_KEY = 'visuals/social-intelligence/auth/login-password.json';\nconst PASSWORD_RESET_STATE_KEY = 'visuals/social-intelligence/auth/password-reset-v1.json';\nconst PASSWORD_RESET_TOKEN_SHA256 = '8d82b41e9a81a10984674974e7388f96957c563ff4ba4d53397789b5816eabdc';\n"
if old not in s:
    raise SystemExit('auth constants anchor missing')
s = s.replace(old, new, 1)

old = "  if (url.pathname === '/social-intelligence/login') return handleLogin(request, env);\n"
new = old + "  if (url.pathname === '/social-intelligence/reset-password') return handleOneTimePasswordReset(request, env);\n"
if old not in s:
    raise SystemExit('route anchor missing')
s = s.replace(old, new, 1)

old = "  const expectedHash = String(env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256 || '').trim().toLowerCase();\n"
new = "  const expectedHash = await loginPasswordHash(env);\n"
if old not in s:
    raise SystemExit('login hash anchor missing')
s = s.replace(old, new, 1)

anchor = "async function handleLogout(request, env) {\n"
block = r'''async function handleOneTimePasswordReset(request, env) {
  if (request.method !== 'GET') return methodNotAllowed();
  if (!env.VISUALS_BUCKET) {
    return html(renderSystemMessage('Réinitialisation indisponible', 'Le stockage privé est indisponible.', randomToken(16)), 503);
  }

  const url = new URL(request.url);
  const token = String(url.searchParams.get('token') || '');
  const expected = String(env.SOCIAL_INTELLIGENCE_PASSWORD_RESET_TOKEN_SHA256 || PASSWORD_RESET_TOKEN_SHA256).trim().toLowerCase();
  if (token.length < 32 || !/^[a-f0-9]{64}$/i.test(expected) || !(await matchesHash(token, expected))) {
    return new Response('Not Found', { status: 404, headers: privateHeaders('text/plain; charset=utf-8', '') });
  }

  const existing = await readJson(env, PASSWORD_RESET_STATE_KEY, null);
  if (existing?.status === 'completed') {
    return html(renderSystemMessage('Lien déjà utilisé', 'Ce lien de réinitialisation a déjà été consommé.', randomToken(16)), 410);
  }

  const claimed = await putJsonIfAbsent(env, PASSWORD_RESET_STATE_KEY, {
    status: 'in_flight',
    started_at: Date.now(),
  }, false);
  if (!claimed) {
    const current = await readJson(env, PASSWORD_RESET_STATE_KEY, null);
    const message = current?.status === 'completed' ? 'Ce lien de réinitialisation a déjà été consommé.' : 'Une réinitialisation est déjà en cours.';
    return html(renderSystemMessage('Lien indisponible', message, randomToken(16)), 409);
  }

  try {
    const seed = await sha256Text(`sowhat-password-reset-v1|${token}`);
    const generatedPassword = `SWA-${seed.slice(0, 20)}!9`;
    const passwordHash = await sha256Text(generatedPassword);
    await putJson(env, LOGIN_PASSWORD_OVERRIDE_KEY, {
      password_sha256: passwordHash,
      updated_at: new Date().toISOString(),
      source: 'one_time_reset',
    });
    await revokeAllSessions(env);
    await putJson(env, PASSWORD_RESET_STATE_KEY, {
      status: 'completed',
      completed_at: Date.now(),
    });
    return html(renderSystemMessage('Mot de passe réinitialisé', 'Le nouvel accès est prêt. Vous pouvez fermer cette page et vous reconnecter.', randomToken(16)), 200);
  } catch {
    try { await env.VISUALS_BUCKET.delete(PASSWORD_RESET_STATE_KEY); } catch { /* best effort */ }
    return html(renderSystemMessage('Réinitialisation échouée', 'Aucun changement fiable n’a été enregistré. Réessayez.', randomToken(16)), 503);
  }
}

async function revokeAllSessions(env) {
  if (!env.VISUALS_BUCKET || typeof env.VISUALS_BUCKET.list !== 'function') return;
  let cursor = undefined;
  do {
    const page = await env.VISUALS_BUCKET.list({ prefix: SESSION_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    const objects = Array.isArray(page?.objects) ? page.objects : [];
    await Promise.all(objects.map((object) => env.VISUALS_BUCKET.delete(String(object?.key || ''))));
    cursor = page?.truncated ? page.cursor : undefined;
  } while (cursor);
}

''' + anchor
if anchor not in s:
    raise SystemExit('logout anchor missing')
s = s.replace(anchor, block, 1)

anchor = "async function authenticate(request, env) {\n"
helper = r'''async function loginPasswordHash(env) {
  const override = await readJson(env, LOGIN_PASSWORD_OVERRIDE_KEY, null);
  const stored = String(override?.password_sha256 || '').trim().toLowerCase();
  if (/^[a-f0-9]{64}$/i.test(stored)) return stored;
  return String(env.SOCIAL_INTELLIGENCE_LOGIN_PASSWORD_SHA256 || '').trim().toLowerCase();
}

''' + anchor
if anchor not in s:
    raise SystemExit('authenticate anchor missing')
s = s.replace(anchor, helper, 1)
p.write_text(s)

tp = Path('tests/social-intelligence-behaviour.mjs')
t = tp.read_text()
marker = "check('acces refuse sans session', async () => {\n"
test = r'''check('reset mot de passe a usage unique : genere, persiste, revoque et ne se rejoue pas', async () => {
  const env = makeEnv();
  installBridge();
  const oldSession = await login(env);
  const resetToken = 'jeton-reset-test-abcdefghijklmnopqrstuvwxyz-1234567890';
  env.SOCIAL_INTELLIGENCE_PASSWORD_RESET_TOKEN_SHA256 = createHash('sha256').update(resetToken).digest('hex');

  const bad = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/reset-password?token=incorrect-${resetToken}`), env, {});
  assert.equal(bad.status, 404, 'un mauvais jeton ne révèle rien');

  const reset = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/reset-password?token=${encodeURIComponent(resetToken)}`), env, {});
  assert.equal(reset.status, 200, 'le jeton valide réinitialise une seule fois');
  const resetHtml = await reset.text();
  assert.ok(!resetHtml.includes(resetToken), 'le jeton ne doit jamais être reflété');
  assert.ok(!resetHtml.includes('SWA-'), 'le nouveau mot de passe ne doit pas être affiché par l endpoint technique');

  const seed = createHash('sha256').update(`sowhat-password-reset-v1|${resetToken}`).digest('hex');
  const newPassword = `SWA-${seed.slice(0, 20)}!9`;
  const stored = env.VISUALS_BUCKET.readJson('visuals/social-intelligence/auth/login-password.json');
  assert.equal(stored.password_sha256, createHash('sha256').update(newPassword).digest('hex'));

  const oldCookie = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence`, { headers: { cookie: oldSession.cookie } }), env, {});
  assert.ok((await oldCookie.text()).includes('Connexion'), 'les sessions existantes sont révoquées');

  const form = new URLSearchParams({ username: 'sowhat', password: newPassword });
  const relogin = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString(),
  }), env, {});
  assert.equal(relogin.status, 303, 'le nouveau mot de passe fonctionne');

  const replay = await handleSocialIntelligenceV3(new Request(`${ORIGIN}/social-intelligence/reset-password?token=${encodeURIComponent(resetToken)}`), env, {});
  assert.equal(replay.status, 410, 'le jeton est définitivement consommé');
});

''' + marker
if marker not in t:
    raise SystemExit('behaviour marker missing')
t = t.replace(marker, test, 1)
tp.write_text(t)
