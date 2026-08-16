// SAMABUSINESS Global Core — browser bootstrap
//
// The only file in this package that touches `document`/`window`. Waits
// for the app shell to exist (same MutationObserver pattern already used
// by samabusiness-studio-language-v12, so it degrades the same way if the
// host page structure ever changes), then mounts the settings panel and
// (once) the onboarding flow, and keeps <html lang/dir> in sync with the
// merchant's chosen locale. Never throws past its own boundary: any
// failure here must not be able to break the base app around it.

import { createGlobalCore } from './index.mjs';
import { createSettingsStore } from './settings-store.mjs';
import { mountSettingsPanel } from './settings-ui.mjs';
import { maybeShowOnboarding } from './onboarding-ui.mjs';
import { injectStyles } from './styles.mjs';

const ROOT = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1';
const SETTINGS_API = `${ROOT}/samabusiness-global-settings`;

export async function bootGlobalCore(globalCoreData, localePacksIndex) {
  if (window.__SAMA_GLOBAL_CORE__) return;
  window.__SAMA_GLOBAL_CORE__ = true;

  try {
    injectStyles(document);

    const store = createSettingsStore({ apiUrl: SETTINGS_API });
    const localePackTags = Object.keys(localePacksIndex);
    const localePacksMeta = localePackTags.map((tag) => ({
      tag, name: (localePacksIndex[tag]._meta && localePacksIndex[tag].name) || tag, dir: (localePacksIndex[tag]._meta || {}).dir || 'ltr',
    }));

    const core = createGlobalCore(globalCoreData, {
      localeEngineOptions: {
        storage: (() => { try { return localStorage; } catch { return null; } })(),
        loadPack: (tag) => localePacksIndex[tag] || null, // already fully bundled, no network fetch needed
        initialPacks: localePacksIndex,
      },
    });

    async function applyLocale(tag) {
      await core.locale.setLocale(tag);
      core.applyDirection(tag, document);
    }

    const settings = store.currentSettings();
    await applyLocale(settings.locale);

    window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, {
      global: {
        version: core.version,
        registry: core.registry,
        currency: core.currency,
        timezone: core.timezone,
        phone: core.phone,
        locale: core.locale,
        settings: store,
        applyLocale,
      },
    });

    const t = core.locale.t;
    const mountCtx = { registry: core.registry, locale: core.locale.getLocale(), t, store, localePacks: localePacksMeta, applyLocale };

    function tryMount() {
      try {
        const mountedSettings = mountSettingsPanel(mountCtx);
        const shownOnboarding = maybeShowOnboarding({ ...mountCtx, onboarding: true });
        return mountedSettings || shownOnboarding;
      } catch (error) {
        console.error('sama_global_core_mount', error);
        return false;
      }
    }

    if (!tryMount()) {
      let timer;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(tryMount, 60);
      };
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      schedule();
    }
  } catch (error) {
    // Global Core must never be able to take the host app down with it.
    console.error('sama_global_core_boot', error);
  }
}
