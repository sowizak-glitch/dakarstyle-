// SAMABUSINESS Global Core — Settings Store
//
// Bridges the Global Core to the app's existing storage/session
// conventions instead of inventing new ones:
//   - 'sama-session-v3'  : session token (set by the base app on login)
//   - 'sama-profile-v3'  : {account, merchant, access} cached by the base app
//   - 'sama-language-v1' : legacy fr/wo toggle read by the base app itself
//   - 'sama-ui-lang'     : legacy fr/wo toggle read by addon/field-ux/site-studio
// Global Core adds one new key ('sama-global-settings-v1') for the fields
// the legacy keys never carried (country, currency, timezone, phone
// region, measurement system, week start), and keeps the legacy keys in
// sync so every existing surface keeps working unmodified.

const SESSION_KEY = 'sama-session-v3';
const PROFILE_KEY = 'sama-profile-v3';
const LEGACY_LANGUAGE_KEY = 'sama-language-v1';
const LEGACY_UI_LANG_KEY = 'sama-ui-lang';
const GLOBAL_SETTINGS_KEY = 'sama-global-settings-v1';
const ONBOARDED_KEY = 'sama-global-onboarded-v1';

export function createSettingsStore(options) {
  const { storage, fetchImpl, apiUrl } = options || {};
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

  function readJson(key) {
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function sessionToken() {
    return store ? store.getItem(SESSION_KEY) || '' : '';
  }

  function isAuthenticated() {
    return Boolean(sessionToken());
  }

  // Merchant snapshot already carries country_code/currency/locale/timezone
  // from samabusiness-api-v10's own session payload (they were added to
  // sama_merchants ahead of this mission); phone_region/measurement_system/
  // week_start are Global-Core-only additions and read from the local
  // Global Core cache until the next full profile refresh includes them.
  function currentSettings() {
    const profile = readJson(PROFILE_KEY);
    const merchant = profile && profile.merchant ? profile.merchant : {};
    const cached = readJson(GLOBAL_SETTINGS_KEY) || {};
    return {
      countryCode: merchant.country_code || cached.countryCode || 'SN',
      currency: merchant.currency || cached.currency || 'XOF',
      locale: merchant.locale || cached.locale || 'fr-SN',
      timezone: merchant.timezone || cached.timezone || 'Africa/Dakar',
      phoneRegion: cached.phoneRegion || merchant.country_code || 'SN',
      measurementSystem: cached.measurementSystem || 'metric',
      weekStart: typeof cached.weekStart === 'number' ? cached.weekStart : 1,
    };
  }

  function persistLocal(settings) {
    if (!store) return;
    try {
      store.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable: in-memory only for this session */
    }
    // Keep every legacy language surface in sync so nothing regresses.
    const shortLang = String(settings.locale || '').startsWith('wo') ? 'wo' : 'fr';
    try {
      store.setItem(LEGACY_LANGUAGE_KEY, shortLang);
      store.setItem(LEGACY_UI_LANG_KEY, shortLang);
    } catch {
      /* ignore */
    }
    // Mirror into the cached profile too, so a page reload before the next
    // API round-trip still reflects the choice everywhere that reads it.
    const profile = readJson(PROFILE_KEY);
    if (profile && profile.merchant) {
      profile.merchant.country_code = settings.countryCode;
      profile.merchant.currency = settings.currency;
      profile.merchant.locale = settings.locale;
      profile.merchant.timezone = settings.timezone;
      try {
        store.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch {
        /* ignore */
      }
    }
  }

  async function save(partialSettings) {
    const merged = { ...currentSettings(), ...partialSettings };
    persistLocal(merged); // optimistic, works offline
    if (!isAuthenticated() || !doFetch) return { ok: true, offline: true, settings: merged };
    try {
      const response = await doFetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sama-session': sessionToken() },
        body: JSON.stringify({ action: 'save_settings', ...partialSettings }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        return { ok: false, offline: false, error: payload.error || `HTTP ${response.status}`, settings: merged };
      }
      if (payload.settings) persistLocal(payload.settings);
      return { ok: true, offline: false, settings: payload.settings || merged };
    } catch (error) {
      // Network failure: local (optimistic) state already saved; caller
      // can surface an "offline, will sync later" message.
      return { ok: false, offline: true, error: String(error && error.message || error), settings: merged };
    }
  }

  function hasOnboarded() {
    return store ? store.getItem(ONBOARDED_KEY) === '1' : true;
  }

  function markOnboarded() {
    if (store) store.setItem(ONBOARDED_KEY, '1');
  }

  return { currentSettings, save, isAuthenticated, hasOnboarded, markOnboarded, sessionToken };
}
