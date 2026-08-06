(() => {
  'use strict';

  const VERSION = '5.4.0';
  const OWNER = 'idrissaminata@gmail.com';
  const CONTACT = 'hellodakarstyle@gmail.com';
  const TOKEN_KEY = 'senecompare.v53.admin.token';

  function decodePayload(token) {
    try {
      const segment = token.split('.')[1];
      if (!segment) return null;
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
      return JSON.parse(decodeURIComponent(Array.from(atob(normalized), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
    } catch { return null; }
  }

  function extractToken(value) {
    const source = String(value || '').trim();
    if (!source) throw new Error('LINK_REQUIRED');
    let url;
    try { url = new URL(source); }
    catch { throw new Error('LINK_INVALID'); }
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const query = url.searchParams;
    const token = hash.get('access_token') || query.get('access_token') || '';
    const type = hash.get('type') || query.get('type') || '';
    if (!token || token.length < 80) throw new Error('TOKEN_MISSING');
    const payload = decodePayload(token);
    if (!payload || String(payload.email || '').toLowerCase() !== OWNER) throw new Error('OWNER_INVALID');
    if (Number(payload.exp || 0) * 1000 <= Date.now()) throw new Error('TOKEN_EXPIRED');
    if (type && !['magiclink', 'email', 'signup'].includes(type)) throw new Error('TOKEN_TYPE_INVALID');
    return token;
  }

  function mountRecovery() {
    const form = document.getElementById('adminLoginForm');
    if (!form || document.getElementById('scAdminRecovery')) return;
    const security = form.querySelector('.sc-login-security');
    const recovery = document.createElement('section');
    recovery.id = 'scAdminRecovery';
    recovery.className = 'sc-admin-recovery';
    recovery.innerHTML = `
      <button class="sc-recovery-toggle" type="button" aria-expanded="false" aria-controls="scRecoveryPanel"><span>↪</span><span><strong>Le lien ouvre “localhost” ?</strong><small>Récupérer l’accès dans ce navigateur.</small></span></button>
      <div class="sc-recovery-panel" id="scRecoveryPanel" hidden>
        <p>Copiez l’adresse complète affichée dans la barre du navigateur en erreur, puis collez-la ici. Le jeton reste uniquement dans cette session et n’est jamais envoyé ailleurs.</p>
        <label for="scRecoveryLink">Lien reçu par email</label>
        <textarea id="scRecoveryLink" rows="3" spellcheck="false" autocomplete="off" placeholder="http://localhost:3000/#access_token=…"></textarea>
        <button class="sc-recovery-submit" type="button">Valider et ouvrir mon tableau de bord</button>
        <p class="sc-recovery-status" role="status" aria-live="polite"></p>
      </div>`;
    security?.before(recovery);

    const toggle = recovery.querySelector('.sc-recovery-toggle');
    const panel = recovery.querySelector('.sc-recovery-panel');
    const input = recovery.querySelector('textarea');
    const submit = recovery.querySelector('.sc-recovery-submit');
    const status = recovery.querySelector('.sc-recovery-status');

    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    });

    submit.addEventListener('click', () => {
      status.dataset.state = '';
      status.textContent = 'Vérification sécurisée…';
      try {
        const token = extractToken(input.value);
        sessionStorage.setItem(TOKEN_KEY, token);
        input.value = '';
        status.dataset.state = 'success';
        status.textContent = 'Accès vérifié. Ouverture du tableau de bord…';
        history.replaceState({}, document.title, '/admin');
        location.reload();
      } catch (error) {
        const messages = {
          LINK_REQUIRED: 'Collez d’abord le lien complet reçu par email.',
          LINK_INVALID: 'Ce texte n’est pas un lien valide.',
          TOKEN_MISSING: 'Le lien ne contient pas de jeton d’accès.',
          OWNER_INVALID: 'Ce lien ne correspond pas au compte propriétaire autorisé.',
          TOKEN_EXPIRED: 'Ce lien a expiré. Demandez un nouveau lien sécurisé.',
          TOKEN_TYPE_INVALID: 'Ce type de lien ne peut pas ouvrir l’administration.',
        };
        status.dataset.state = 'error';
        status.textContent = messages[error.message] || 'Le lien ne peut pas être vérifié.';
        input.select();
      }
    });

    const loginStatus = document.getElementById('adminLoginStatus');
    if (loginStatus) {
      new MutationObserver(() => {
        if (/envoyé/i.test(loginStatus.textContent || '')) {
          loginStatus.textContent = 'Lien sécurisé envoyé. S’il ouvre localhost, utilisez la récupération juste en dessous.';
        }
      }).observe(loginStatus, { childList: true, subtree: true });
    }

    const help = document.createElement('a');
    help.className = 'sc-admin-help';
    help.href = `mailto:${CONTACT}?subject=${encodeURIComponent('Assistance accès administration SeneCompare')}`;
    help.textContent = `Besoin d’aide : ${CONTACT}`;
    help.rel = 'nofollow';
    form.append(help);
  }

  function sanitizeCurrentUrl() {
    if (!location.hash.includes('access_token=') && !location.search.includes('access_token=')) return;
    try {
      const token = extractToken(location.href);
      sessionStorage.setItem(TOKEN_KEY, token);
      history.replaceState({}, document.title, '/admin');
      location.reload();
    } catch {
      history.replaceState({}, document.title, '/admin');
    }
  }

  function start() {
    sanitizeCurrentUrl();
    mountRecovery();
    window.__SENECOMPARE_ADMIN_AUTH__ = { version: VERSION, mode: 'magic-link-with-localhost-recovery' };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
