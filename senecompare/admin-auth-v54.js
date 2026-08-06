(() => {
  'use strict';

  const VERSION = '5.4.1';
  const tokenKey = 'senecompare.v53.admin.token';
  const ownerEmail = 'idrissaminata@gmail.com';
  const contactEmail = 'hellodakarstyle@gmail.com';

  function decodePayload(token) {
    try {
      const segment = String(token || '').split('.')[1];
      if (!segment) return null;
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
      const binary = atob(normalized);
      const bytes = Array.from(binary, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
      return JSON.parse(decodeURIComponent(bytes));
    } catch {
      return null;
    }
  }

  function tokenFrom(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('LINK_REQUIRED');
    let token = '';
    let type = '';
    try {
      const url = new URL(text);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      token = hash.get('access_token') || url.searchParams.get('access_token') || '';
      type = hash.get('type') || url.searchParams.get('type') || '';
    } catch {
      const match = text.match(/(?:^|[#&?])access_token=([^&\s]+)/);
      token = match ? decodeURIComponent(match[1]) : '';
    }
    if (!token || token.length < 80) throw new Error('TOKEN_MISSING');
    const payload = decodePayload(token);
    if (!payload) throw new Error('TOKEN_INVALID');
    if (String(payload.email || '').trim().toLowerCase() !== ownerEmail) throw new Error('OWNER_INVALID');
    if (Number(payload.exp || 0) * 1000 <= Date.now()) throw new Error('TOKEN_EXPIRED');
    if (type && !['magiclink', 'email', 'signup', 'recovery'].includes(type)) throw new Error('TOKEN_TYPE_INVALID');
    return token;
  }

  function saveVerifiedToken(token) {
    sessionStorage.setItem(tokenKey, token);
    history.replaceState({}, document.title, '/admin');
  }

  function messageFor(error) {
    return {
      LINK_REQUIRED: 'Collez d’abord le lien complet reçu par email.',
      TOKEN_MISSING: 'Le lien collé ne contient pas de session valide.',
      TOKEN_INVALID: 'Le jeton contenu dans ce lien est illisible ou incomplet.',
      OWNER_INVALID: 'Ce lien ne correspond pas au compte propriétaire autorisé.',
      TOKEN_EXPIRED: 'Ce lien a expiré. Demandez un nouveau lien sécurisé.',
      TOKEN_TYPE_INVALID: 'Ce type de lien ne peut pas ouvrir l’administration.',
    }[error?.message] || 'Le lien ne peut pas être vérifié. Demandez un nouveau lien sécurisé.';
  }

  function consumeCurrentUrl() {
    if (!location.hash.includes('access_token=') && !location.search.includes('access_token=')) return false;
    try {
      const token = tokenFrom(location.href);
      saveVerifiedToken(token);
      location.replace('/admin');
      return true;
    } catch {
      history.replaceState({}, document.title, '/admin');
      return false;
    }
  }

  function mount() {
    if (consumeCurrentUrl()) return;
    const form = document.getElementById('adminLoginForm');
    if (!form || document.getElementById('adminLinkRecovery')) return;
    const section = document.createElement('section');
    section.id = 'adminLinkRecovery';
    section.className = 'sc-auth-recovery';

    const title = document.createElement('h3');
    title.textContent = 'Le lien ouvre localhost ?';
    const copy = document.createElement('p');
    copy.textContent = 'Copiez l’adresse complète affichée dans Chrome, collez-la ici, puis validez. Le jeton est vérifié et reste uniquement dans cette session.';
    const input = document.createElement('textarea');
    input.id = 'adminRecoveryLink';
    input.rows = 3;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.placeholder = 'Coller ici le lien commençant par http://localhost…#access_token=…';
    input.setAttribute('aria-label', 'Lien sécurisé reçu par email');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Vérifier et ouvrir mon administration';
    const status = document.createElement('p');
    status.className = 'sc-auth-recovery-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    button.addEventListener('click', () => {
      status.textContent = 'Vérification sécurisée…';
      status.dataset.state = '';
      try {
        const token = tokenFrom(input.value);
        saveVerifiedToken(token);
        input.value = '';
        status.textContent = 'Adresse propriétaire et validité confirmées. Ouverture du tableau de bord…';
        status.dataset.state = 'success';
        location.replace('/admin');
      } catch (error) {
        status.textContent = messageFor(error);
        status.dataset.state = 'error';
        input.select();
      }
    });

    section.append(title, copy, input, button, status);
    form.insertAdjacentElement('afterend', section);

    const note = document.createElement('p');
    note.className = 'sc-auth-owner-note';
    note.textContent = `Compte propriétaire : ${ownerEmail}`;
    section.append(note);

    const help = document.createElement('a');
    help.className = 'sc-auth-help-link';
    help.href = `mailto:${contactEmail}?subject=${encodeURIComponent('Assistance accès administration SeneCompare')}`;
    help.textContent = `Assistance : ${contactEmail}`;
    help.rel = 'nofollow';
    section.append(help);

    const loginStatus = document.getElementById('adminLoginStatus');
    if (loginStatus) {
      new MutationObserver(() => {
        if (/envoyé/i.test(loginStatus.textContent || '')) {
          loginStatus.textContent = 'Lien sécurisé envoyé. S’il ouvre localhost, copiez son adresse et utilisez la récupération ci-dessous.';
        }
      }).observe(loginStatus, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  window.__SENECOMPARE_AUTH_RECOVERY__ = Object.freeze({
    version: VERSION,
    owner: ownerEmail,
    contact: contactEmail,
    mode: 'verified-owner-magic-link-recovery',
  });
})();
