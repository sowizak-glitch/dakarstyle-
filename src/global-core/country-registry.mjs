// SAMABUSINESS Global Core — Country Registry
//
// Country/currency/timezone EXISTENCE and human-readable names come from
// Intl at runtime (zero maintenance, always in sync with the platform's ICU
// data). The curated `countries.json` table only supplies the handful of
// fields Intl cannot derive: default currency, calling code, default
// locale, week start and address schema. Adding a country never touches
// this file — it is one row of data (see data/countries.json).

export function createCountryRegistry(countriesData, addressSchemas) {
  const codes = Object.keys(countriesData).filter((k) => !k.startsWith('_'));
  const intlRegionsSupported = typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function';
  const allIsoRegions = intlRegionsSupported
    ? (() => {
        try {
          return Intl.supportedValuesOf('region').filter((r) => /^[A-Z]{2}$/.test(r));
        } catch {
          return null;
        }
      })()
    : null;

  function displayName(countryCode, locale) {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      try {
        return new Intl.DisplayNames([locale || 'fr'], { type: 'region' }).of(countryCode);
      } catch {
        /* fall through to curated name */
      }
    }
    return (countriesData[countryCode] && countriesData[countryCode].name) || countryCode;
  }

  // A country is "known" (curated pack) if we have merchant-facing defaults
  // for it; it is "supported" (can be selected at all) if either curated or
  // recognised by the platform's own ISO-3166 data via Intl.
  function isSupported(countryCode) {
    if (!countryCode) return false;
    const up = String(countryCode).toUpperCase();
    if (codes.includes(up)) return true;
    if (allIsoRegions) return allIsoRegions.includes(up);
    return false;
  }

  function isCurated(countryCode) {
    return codes.includes(String(countryCode || '').toUpperCase());
  }

  function getCountry(countryCode) {
    const up = String(countryCode || '').toUpperCase();
    const curated = countriesData[up];
    if (curated) {
      return {
        countryCode: up,
        name: curated.name,
        defaultLocale: curated.defaultLocale,
        altLocales: curated.altLocales || [],
        defaultCurrency: curated.defaultCurrency,
        callingCode: curated.callingCode,
        weekStart: typeof curated.weekStart === 'number' ? curated.weekStart : 1,
        measurementSystem: curated.measurementSystem || 'metric',
        addressSchema: addressSchemas[curated.addressSchema] || addressSchemas.generic,
        addressSchemaKey: curated.addressSchema || 'generic',
        rtl: Boolean(curated.rtl),
        curated: true,
      };
    }
    if (!isSupported(up)) return null;
    // Uncurated but ISO-valid country: degrade gracefully instead of
    // breaking. No engine change is required to reach this state — it is
    // the designed fallback for "any country" before someone curates it.
    return {
      countryCode: up,
      name: displayName(up, 'fr'),
      defaultLocale: undefined,
      altLocales: [],
      defaultCurrency: undefined,
      callingCode: undefined,
      weekStart: 1,
      measurementSystem: 'metric',
      addressSchema: addressSchemas.generic,
      addressSchemaKey: 'generic',
      rtl: false,
      curated: false,
    };
  }

  function listCountries(locale) {
    const list = (allIsoRegions || codes).map((code) => {
      const entry = getCountry(code);
      return entry || { countryCode: code, name: displayName(code, locale), curated: false };
    });
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), locale || 'fr'));
    return list;
  }

  // Best-effort guess from environment signals (device locale / timezone),
  // used only to pre-select the onboarding form — the user always keeps
  // final control (mission requirement).
  function guessFromEnvironment(env) {
    const tz = env && env.timeZone;
    const localeTag = env && env.locale;
    if (localeTag) {
      try {
        const region = new Intl.Locale(localeTag).maximize().region;
        if (region && isSupported(region)) return region;
      } catch {
        /* ignore malformed locale */
      }
    }
    if (tz) {
      const byTz = codes.find((c) => {
        const cur = countriesData[c];
        return cur && Array.isArray(cur.timeZones) && cur.timeZones.includes(tz);
      });
      if (byTz) return byTz;
      // Heuristic: match the tz "City" continent segment against curated
      // default locale regions sharing the same IANA area is out of scope
      // for a static table; Intl.DateTimeFormat resolvedOptions already
      // gave us the tz, that's the strongest signal we degrade to fr-SN.
    }
    return 'SN';
  }

  return {
    getCountry,
    listCountries,
    isSupported,
    isCurated,
    displayName,
    guessFromEnvironment,
    curatedCodes: codes.slice(),
  };
}
