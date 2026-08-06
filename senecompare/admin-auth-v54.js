(() => {
  'use strict';
  const tokenKey = 'senecompare.v53.admin.token';
  const ownerEmail = 'idrissaminata@gmail.com';

  function tokenFrom(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      const url = new URL(text);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      return hash.get('access_token') || '';
    } catch {
      const match = text.match(/(?:^|[#&])access_token=([^&\s]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }
  }

  function mount() {
    const form = document.getElementById('adminLoginForm');
    if (!form || document.getElementById('adminLinkRecovery')) return;
    const section = document.createElement('section');
    section.id = 'adminLinkRecovery';
    section.className = 'sc-auth-recovery';

    const title = document.createElement('h3');
    title.textContent = 'Le lien ouvre localhost ?';
    const copy = document.createElement('p');
    copy.textContent = 'Copiez l’adresse complète affichée dans Chrome, collez-la ici, puis validez. Le jeton reste uniquement dans ce navigateur.';
    const input = document.createElement('textarea');
    input.id = 'adminRecoveryLink';
    input.rows = 3;
    input.placeholder = 'Coller ici le lien commençant par http://localhost…#access_token=…';
    input.setAttribute('aria-label', 'Lien sécurisé reçu par email');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Ouvrir mon administration';
    const status = document.createElement('p');
    status.className = 'sc-auth-recovery-status';
    status.setAttribute('role', 'status');

    button.addEventListener('click', () => {
      const token = tokenFrom(input.value);
      if (!token || token.length < 40) {
        status.textContent = 'Le lien collé ne contient pas de session valide.';
        status.dataset.state = 'error';
        return;
      }
      try {
        sessionStorage.setItem(tokenKey, token);
        status.textContent = 'Accès reconnu. Ouverture du tableau de bord…';
        status.dataset.state = 'success';
        location.replace('/admin');
      } catch {
        status.textContent = 'Le navigateur bloque la session. Ouvrez le lien dans une fenêtre normale.';
        status.dataset.state = 'error';
      }
    });

    section.append(title, copy, input, button, status);
    form.insertAdjacentElement('afterend', section);

    const note = document.createElement('p');
    note.className = 'sc-auth-owner-note';
    note.textContent = 'Compte propriétaire : ' + ownerEmail;
    section.append(note);
  }

  document.addEventListener('DOMContentLoaded', mount, { once: true });
  mount();
  window.__SENECOMPARE_AUTH_RECOVERY__ = Object.freeze({ owner: ownerEmail, mode: 'paste-secure-link' });
})();
