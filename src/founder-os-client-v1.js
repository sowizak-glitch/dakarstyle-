export const FOUNDER_OS_CLIENT_JS = String.raw`(() => {
  'use strict';

  const csrf = document.querySelector('meta[name="fos-csrf"]')?.content || '';
  const toast = document.querySelector('[data-fos-toast]');
  let toastTimer = null;

  function showToast(message, tone = 'success') {
    if (!toast) return;
    toast.textContent = String(message || 'Action terminee.');
    toast.dataset.tone = tone;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function switchView(id) {
    const target = String(id || 'cockpit');
    document.querySelectorAll('[data-view]').forEach((node) => {
      node.classList.toggle('active', node.dataset.view === target);
    });
    document.querySelectorAll('[data-view-target]').forEach((button) => {
      button.classList.toggle('active', button.dataset.viewTarget === target);
      button.setAttribute('aria-current', button.dataset.viewTarget === target ? 'page' : 'false');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', target === 'cockpit' ? '/founder-os' : '/founder-os#' + encodeURIComponent(target)); } catch (_) {}
  }

  async function api(path, body) {
    const idempotency = 'fos_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? {
        'content-type': 'application/json',
        'x-sowhat-csrf': csrf,
        'x-founder-os-idempotency': idempotency,
      } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || 'founder_os_request_failed');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function refresh() {
    const buttons = [...document.querySelectorAll('[data-refresh-founder-os]')];
    buttons.forEach((button) => { button.disabled = true; button.textContent = 'Verification…'; });
    try {
      await api('/api/founder-os/refresh', { reason: 'operator_refresh' });
      showToast('Controle ecosysteme termine.');
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      showToast(error.message === 'csrf_invalid' ? 'Session de securite expiree. Rechargez la page.' : 'Le controle n a pas pu etre termine.', 'error');
      buttons.forEach((button) => { button.disabled = false; button.textContent = 'Reessayer'; });
    }
  }

  async function decision(button) {
    const id = button.dataset.decisionId;
    const action = button.dataset.decisionAction;
    if (!id || !action) return;
    const card = button.closest('[data-decision-card]');
    card?.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      await api('/api/founder-os/decision', { id, action });
      showToast(action === 'approve' ? 'Decision approuvee et placee dans l outbox verifiee.' : 'Decision refusee.');
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      showToast('Decision non enregistree : ' + error.message, 'error');
      card?.querySelectorAll('button').forEach((item) => { item.disabled = false; });
    }
  }

  async function alertAction(button) {
    const id = button.dataset.alertId;
    const action = button.dataset.alertAction;
    if (!id || !action) return;
    const card = button.closest('[data-alert-card]');
    card?.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      await api('/api/founder-os/alert', { id, action });
      showToast(action === 'resolve' ? 'Alerte marquee resolue.' : 'Alerte prise en compte.');
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      showToast('Alerte non modifiee : ' + error.message, 'error');
      card?.querySelectorAll('button').forEach((item) => { item.disabled = false; });
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button,a');
    if (!target) return;
    if (target.matches('[data-view-target]')) { event.preventDefault(); switchView(target.dataset.viewTarget); return; }
    if (target.matches('[data-view-jump]')) { event.preventDefault(); switchView(target.dataset.viewJump); return; }
    if (target.matches('[data-refresh-founder-os]')) { event.preventDefault(); refresh(); return; }
    if (target.matches('[data-decision-action]')) { event.preventDefault(); decision(target); return; }
    if (target.matches('[data-alert-action]')) { event.preventDefault(); alertAction(target); }
  });

  const initial = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (initial && document.querySelector('[data-view="' + CSS.escape(initial) + '"]')) switchView(initial);
})();`;
