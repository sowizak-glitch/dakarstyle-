// SAMABUSINESS Global Core — first-launch onboarding
//
// Shown once per browser, right after the merchant reaches the app shell
// (i.e. after login/signup — never before, so it never interferes with
// the existing auth screen). Pre-selects country/language/currency/
// timezone from device signals (Intl locale + timezone) but the merchant
// always confirms explicitly before anything is saved — nothing is ever
// silently assumed. Uses the same modal chrome as settings-ui so there is
// exactly one look-and-feel for this whole feature, not two.

import { renderRegionLanguageForm } from './region-language-form.mjs';
import { openModalSafe, closeModalSafe } from './modal-helpers.mjs';

const ONBOARDING_MODAL_ID = 'samaGlobalOnboardingModal';

export function maybeShowOnboarding(core) {
  const { store } = core;
  if (store.hasOnboarded()) return false;
  if (!store.isAuthenticated()) return false; // never show before login
  if (document.getElementById(ONBOARDING_MODAL_ID)) return false;

  const { registry, t, localePacks, applyLocale } = core;
  const detected = detectFromEnvironment(registry);
  const values = { ...store.currentSettings(), ...detected };

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = ONBOARDING_MODAL_ID;
  modal.innerHTML = `<div class="modal">
    <div class="modal-head"><div><h2>${t('onboarding.title')}</h2><div class="hint">${t('onboarding.subtitle')}</div></div><button class="close" type="button" data-role="skip">✕</button></div>
    <div class="form-grid" data-role="form-host"></div>
    <p class="hint" style="padding:0 18px 6px">${t('onboarding.detected')}</p>
    <div class="modal-foot" style="padding:14px 18px;display:flex;justify-content:flex-end;gap:8px">
      <button class="primary" type="button" data-role="finish">${t('onboarding.finish')}</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  const formHost = modal.querySelector('[data-role="form-host"]');
  const form = renderRegionLanguageForm(formHost, { registry, locale: core.locale, t, values, localePacks });

  function dismiss() {
    store.markOnboarded();
    closeModalSafe(modal);
  }

  modal.querySelector('[data-role="skip"]').addEventListener('click', dismiss);
  modal.querySelector('[data-role="finish"]').addEventListener('click', async () => {
    const finishBtn = modal.querySelector('[data-role="finish"]');
    finishBtn.disabled = true;
    const chosen = form.readValues();
    await store.save(chosen);
    await applyLocale(chosen.locale);
    finishBtn.disabled = false;
    dismiss();
  });

  openModalSafe(ONBOARDING_MODAL_ID);
  return true;
}

function detectFromEnvironment(registry) {
  let deviceLocale = 'fr-SN';
  let deviceTimeZone = 'Africa/Dakar';
  try {
    deviceLocale = (navigator.languages && navigator.languages[0]) || navigator.language || deviceLocale;
  } catch {
    /* ignore */
  }
  try {
    deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || deviceTimeZone;
  } catch {
    /* ignore */
  }
  const countryCode = registry.guessFromEnvironment({ locale: deviceLocale, timeZone: deviceTimeZone });
  const country = registry.getCountry(countryCode) || registry.getCountry('SN');
  return {
    countryCode: country.countryCode,
    locale: country.defaultLocale || deviceLocale || 'fr-SN',
    currency: country.defaultCurrency || 'XOF',
    timezone: deviceTimeZone,
    phoneRegion: country.countryCode,
    measurementSystem: country.measurementSystem || 'metric',
    weekStart: typeof country.weekStart === 'number' ? country.weekStart : 1,
  };
}
