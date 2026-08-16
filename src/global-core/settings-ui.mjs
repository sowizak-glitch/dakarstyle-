// SAMABUSINESS Global Core — "Région & langue" settings panel
//
// Injected into the existing #view-more "Outils du commerce" screen as one
// more `.more-card`, and a `.modal-backdrop` matching the exact markup the
// base app already uses for expenseModal/withdrawModal/etc, so it inherits
// all existing styling with zero new layout CSS. The base app wires
// [data-open]/[data-close] once at boot time (not via delegation), so
// elements injected afterwards — like this one — must be wired explicitly;
// openModal()/closeModal() are plain top-level functions in the base app's
// classic <script>, which makes them reachable as window.openModal /
// window.closeModal from this separately-injected script.

import { renderRegionLanguageForm } from './region-language-form.mjs';
import { openModalSafe, closeModalSafe } from './modal-helpers.mjs';

const SETTINGS_MODAL_ID = 'samaGlobalSettingsModal';

export function mountSettingsPanel(core) {
  const { registry, locale, t, store, localePacks, applyLocale } = core;
  const moreGrid = document.querySelector('#view-more .more-grid');
  if (!moreGrid || document.getElementById(SETTINGS_MODAL_ID)) return false;

  const card = document.createElement('button');
  card.className = 'more-card';
  card.id = 'samaGlobalSettingsBtn';
  card.type = 'button';
  card.innerHTML = `<span class="emoji">🌍</span><b>${t('settings.regionLanguage')}</b><span>${t('settings.country')} · ${t('settings.currency')} · ${t('settings.timezone')}</span>`;
  moreGrid.appendChild(card);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = SETTINGS_MODAL_ID;
  modal.innerHTML = `<div class="modal">
    <div class="modal-head"><div><h2>${t('settings.regionLanguage')}</h2></div><button class="close" type="button" data-role="close">✕</button></div>
    <div class="form-grid" data-role="form-host"></div>
    <div class="modal-foot" style="padding:14px 18px;display:flex;justify-content:flex-end;gap:8px">
      <button class="primary" type="button" data-role="save">${t('settings.save')}</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  const formHost = modal.querySelector('[data-role="form-host"]');
  let form = null;

  function renderForm() {
    form = renderRegionLanguageForm(formHost, {
      registry, locale: core.locale, t, values: store.currentSettings(), localePacks,
    });
  }
  renderForm();

  card.addEventListener('click', () => {
    renderForm();
    openModalSafe(SETTINGS_MODAL_ID);
  });
  modal.querySelector('[data-role="close"]').addEventListener('click', () => closeModalSafe(modal));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModalSafe(modal);
  });
  modal.querySelector('[data-role="save"]').addEventListener('click', async () => {
    const saveBtn = modal.querySelector('[data-role="save"]');
    const values = form.readValues();
    saveBtn.disabled = true;
    const result = await store.save(values);
    saveBtn.disabled = false;
    if (result.ok || result.offline) {
      await applyLocale(values.locale);
      notify(t('settings.saved'), false);
      closeModalSafe(modal);
    } else {
      notify(result.error || t('settings.saveError'), true);
    }
  });

  return true;
}

function notify(message, isError) {
  if (typeof window.toast === 'function') {
    window.toast(isError ? '⚠️' : '✓', message, isError ? 'error' : '');
    return;
  }
  // No toast() in scope (e.g. Site Studio host): fall back to a minimal,
  // self-contained, auto-dismissing banner so the user still gets feedback.
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;z-index:9999;left:50%;bottom:24px;transform:translateX(-50%);' +
    `background:${isError ? '#7f2222' : '#10231d'};color:#fff;padding:10px 16px;border-radius:12px;` +
    'font:600 13px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
