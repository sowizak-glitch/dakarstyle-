// SAMABUSINESS Global Core — factory
//
// Pure assembly of the engines from injected data, with no DOM/browser
// dependency, so it can be unit-tested under plain Node and reused
// identically by the browser bootstrap and by Deno edge functions that
// need the same currency/phone/timezone rules server-side.

import { createCountryRegistry } from './country-registry.mjs';
import { createCurrencyEngine } from './currency-engine.mjs';
import { createTimezoneEngine } from './timezone-engine.mjs';
import { createPhoneEngine } from './phone-engine.mjs';
import { createLocaleEngine } from './locale-engine.mjs';
import { isRtlLocale, applyDirection } from './rtl.mjs';

export const GLOBAL_CORE_VERSION = '1.0.0';

export function createGlobalCore(data, options) {
  const { countries, addressSchemas, currencyMinorUnits, phoneMetadata } = data;
  const registry = createCountryRegistry(countries, addressSchemas);
  const currency = createCurrencyEngine(currencyMinorUnits);
  const timezone = createTimezoneEngine();
  const phone = createPhoneEngine(phoneMetadata);
  const localeEngine = createLocaleEngine(options && options.localeEngineOptions);

  return {
    version: GLOBAL_CORE_VERSION,
    registry,
    currency,
    timezone,
    phone,
    locale: localeEngine,
    isRtlLocale,
    applyDirection,
  };
}

export { createCountryRegistry, createCurrencyEngine, createTimezoneEngine, createPhoneEngine, createLocaleEngine, isRtlLocale, applyDirection };
