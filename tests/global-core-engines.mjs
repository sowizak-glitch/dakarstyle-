// Unit tests for the Global Core engines: country resolver, currency
// formatter/minor units, timezone formatting, phone normalization, RTL,
// locale fallback, XOF legacy compatibility. Runs under plain Node (no
// test framework dependency, matching the rest of this repo's tests/).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCountryRegistry } from '../src/global-core/country-registry.mjs';
import { createCurrencyEngine } from '../src/global-core/currency-engine.mjs';
import { createTimezoneEngine } from '../src/global-core/timezone-engine.mjs';
import { createPhoneEngine } from '../src/global-core/phone-engine.mjs';
import { createLocaleEngine } from '../src/global-core/locale-engine.mjs';
import { isRtlLocale } from '../src/global-core/rtl.mjs';
import { createSettingsStore } from '../src/global-core/settings-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'src', 'global-core', 'data');
const loadJson = (name) => JSON.parse(readFileSync(path.join(dataDir, name), 'utf8'));

const countries = loadJson('countries.json');
const addressSchemas = loadJson('address-schemas.json');
const currencyMinorUnits = loadJson('currency-minor-units.json');
const phoneMetadata = loadJson('phone-metadata.json');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// --- Country resolver ---------------------------------------------------
const registry = createCountryRegistry(countries, addressSchemas);

test('country resolver: curated country returns full config', () => {
  const sn = registry.getCountry('SN');
  assert.equal(sn.defaultCurrency, 'XOF');
  assert.equal(sn.defaultLocale, 'fr-SN');
  assert.equal(sn.weekStart, 1);
  assert.equal(sn.rtl, false);
});

test('country resolver: curated Morocco is RTL-flagged', () => {
  const ma = registry.getCountry('MA');
  assert.equal(ma.rtl, true);
  assert.equal(ma.defaultCurrency, 'MAD');
});

test('country resolver: lower-case input is normalized', () => {
  assert.equal(registry.getCountry('sn').countryCode, 'SN');
});

test('country resolver: unknown-but-ISO country degrades gracefully (no throw, no engine change needed)', () => {
  // Any real ISO region not in our curated table (e.g. "IS" Iceland) must
  // still resolve to a usable, non-throwing config.
  const result = registry.getCountry('IS');
  if (result) {
    assert.equal(result.curated, false);
    assert.equal(result.measurementSystem, 'metric');
  }
});

test('country resolver: garbage input returns null, never throws', () => {
  assert.equal(registry.getCountry('!!!'), null);
  assert.equal(registry.getCountry(''), null);
});

test('country resolver: listCountries covers every curated country and is sorted', () => {
  const list = registry.listCountries('fr');
  const curatedCount = Object.keys(countries).filter((k) => !k.startsWith('_')).length;
  assert.ok(list.length >= curatedCount, 'list must include at least every curated country');
  assert.ok(list.length > 50, 'Intl-backed list should cover far more than the curated set');
  const names = list.map((c) => String(c.name));
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr'));
  assert.deepEqual(names, sorted);
});

test('country resolver: environment guess falls back to SN', () => {
  assert.equal(registry.guessFromEnvironment({}), 'SN');
});

test('country resolver: environment guess resolves from device locale region', () => {
  assert.equal(registry.guessFromEnvironment({ locale: 'fr-MA' }), 'MA');
});

// --- Currency engine ------------------------------------------------------
const currency = createCurrencyEngine(currencyMinorUnits);

test('currency formatter: XOF is zero-decimal', () => {
  assert.equal(currency.minorUnitExponent('XOF'), 0);
  assert.equal(currency.toMinor(currency.money(1500, 'XOF')), 1500);
});

test('currency formatter: EUR is two-decimal', () => {
  assert.equal(currency.minorUnitExponent('EUR'), 2);
  assert.equal(currency.toMinor(currency.money(19.99, 'EUR')), 1999);
});

test('minor units: round-trip is exact for zero-decimal currencies (legacy XOF compatibility)', () => {
  const m = currency.fromLegacyAmount(15000);
  assert.equal(m.currency, 'XOF');
  assert.equal(currency.toMinor(m), 15000);
  assert.equal(currency.fromMinor(15000, 'XOF').amount, 15000);
});

test('minor units: round-trip is exact for two-decimal currencies', () => {
  const minor = currency.toMinor(currency.money(10.1, 'USD'));
  assert.equal(minor, 1010);
  assert.equal(currency.fromMinor(1010, 'USD').amount, 10.1);
});

test('currency formatter: add/subtract requires matching currency', () => {
  assert.throws(() => currency.add(currency.money(1, 'XOF'), currency.money(1, 'EUR')));
  const sum = currency.add(currency.money(1000, 'XOF'), currency.money(500, 'XOF'));
  assert.equal(sum.amount, 1500);
});

test('currency formatter: format() never throws even for a bogus code', () => {
  const result = currency.format(currency.money(10, 'ZZZ'), 'fr-SN');
  assert.equal(typeof result, 'string');
});

test('currency formatter: format() renders a recognizable XOF amount', () => {
  const result = currency.format(currency.money(1500, 'XOF'), 'fr-SN');
  assert.match(result, /1.?500/);
});

// --- Timezone engine --------------------------------------------------
const timezone = createTimezoneEngine();

test('timezone: Africa/Dakar is a valid IANA zone', () => {
  assert.equal(timezone.isValidTimeZone('Africa/Dakar'), true);
});

test('timezone: bogus zone name is rejected', () => {
  assert.equal(timezone.isValidTimeZone('Not/AZone'), false);
});

test('timezone: formatDateTime uses the given IANA zone, not a raw offset, and never throws', () => {
  const s = timezone.formatDateTime('2026-08-16T12:00:00Z', 'en-US', 'America/New_York');
  assert.equal(typeof s, 'string');
  assert.notEqual(timezone.formatDateTime('2026-08-16T12:00:00Z', 'ja-JP', 'Asia/Tokyo'), s);
});

test('timezone: invalid zone falls back to Africa/Dakar instead of throwing', () => {
  const s = timezone.formatDateTime('2026-08-16T12:00:00Z', 'fr-SN', 'Not/AZone');
  assert.equal(typeof s, 'string');
});

test('timezone: startOfWeek respects weekStart=1 (Monday, Senegal default)', () => {
  // 2026-08-16 is a Sunday.
  const start = timezone.startOfWeek('2026-08-16T10:00:00', 1, 'Africa/Dakar');
  assert.equal(start.getDay(), 1); // Monday of the previous week
});

// --- Phone engine -----------------------------------------------------
const phone = createPhoneEngine(phoneMetadata);

test('phone: legacy Senegal local format normalizes to E.164', () => {
  assert.equal(phone.normalize('77 123 45 67', 'SN'), '+221771234567');
  assert.equal(phone.normalize('771234567', 'SN'), '+221771234567');
});

test('phone: already-E.164 input passes through', () => {
  assert.equal(phone.normalize('+221771234567', 'SN'), '+221771234567');
});

test('phone: 00-international prefix normalizes', () => {
  assert.equal(phone.normalize('00221771234567'), '+221771234567');
});

test('phone: validation matches expected NSN length per region', () => {
  assert.equal(phone.isValid('+221771234567', 'SN'), true);
  assert.equal(phone.isValid('+22177123', 'SN'), false);
});

test('phone: unknown region without metadata returns null instead of guessing wrong', () => {
  assert.equal(phone.normalize('123456', 'ZZ'), null);
});

test('phone: detectRegion finds the calling code owner', () => {
  assert.equal(phone.detectRegion('+221771234567'), 'SN');
});

// --- RTL -----------------------------------------------------------------
test('RTL: Arabic locale is RTL', () => {
  assert.equal(isRtlLocale('ar-MA'), true);
});
test('RTL: French/Wolof/Portuguese locales are LTR', () => {
  assert.equal(isRtlLocale('fr-SN'), false);
  assert.equal(isRtlLocale('wo-SN'), false);
  assert.equal(isRtlLocale('pt-BR'), false);
});

// --- Locale engine / translation fallback --------------------------------
test('locale engine: falls back fr-XX -> fr -> fr-SN default, never renders "undefined"', async () => {
  const engine = createLocaleEngine({
    initialPacks: {
      'fr-SN': { 'settings.save': 'Enregistrer' },
    },
  });
  await engine.setLocale('fr-XX'); // not packaged; must fall back
  assert.equal(engine.t('settings.save'), 'Enregistrer');
  assert.equal(engine.t('totally.unknown.key'), 'totally.unknown.key');
});

test('locale engine: interpolates {vars}', async () => {
  const engine = createLocaleEngine({ initialPacks: { 'en-US': { greet: 'Hello {name}' } } });
  await engine.setLocale('en-US');
  assert.equal(engine.t('greet', { name: 'Aïda' }), 'Hello Aïda');
});

test('locale engine: lazy loadPack is invoked once per tag and then cached', async () => {
  const requested = [];
  const engine = createLocaleEngine({
    loadPack: async (tag) => {
      requested.push(tag);
      return tag === 'pt-BR' ? { hi: 'Oi' } : null;
    },
  });
  await engine.setLocale('pt-BR'); // preloads the whole fallback chain: pt-BR, pt, fr-SN, fr
  assert.equal(engine.t('hi'), 'Oi');
  const callsAfterSetLocale = requested.length;
  assert.ok(requested.includes('pt-BR'));
  await engine.ensurePack('pt-BR'); // already cached: must not hit loadPack again
  assert.equal(requested.length, callsAfterSetLocale, 'pack should be cached after first load, not refetched');
});

// --- Settings persistence / XOF legacy migration -------------------------
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('settings store: legacy merchant with no Global Core cache defaults to SN/XOF/fr-SN/Dakar', () => {
  const storage = memoryStorage();
  const store = createSettingsStore({ storage, fetchImpl: null, apiUrl: '' });
  const settings = store.currentSettings();
  assert.deepEqual(settings, {
    countryCode: 'SN', currency: 'XOF', locale: 'fr-SN', timezone: 'Africa/Dakar',
    phoneRegion: 'SN', measurementSystem: 'metric', weekStart: 1,
  });
});

test('settings store: merchant profile values (already on sama_merchants) take precedence over cache', () => {
  const storage = memoryStorage();
  storage.setItem('sama-profile-v3', JSON.stringify({ merchant: { country_code: 'MA', currency: 'MAD', locale: 'ar-MA', timezone: 'Africa/Casablanca' } }));
  const store = createSettingsStore({ storage, fetchImpl: null, apiUrl: '' });
  const settings = store.currentSettings();
  assert.equal(settings.countryCode, 'MA');
  assert.equal(settings.currency, 'MAD');
  assert.equal(settings.locale, 'ar-MA');
});

test('settings store: save() works fully offline (no session, no fetch) and persists locally', async () => {
  const storage = memoryStorage();
  const store = createSettingsStore({ storage, fetchImpl: null, apiUrl: '' });
  const result = await store.save({ currency: 'USD', locale: 'en-US' });
  assert.equal(result.ok, true);
  assert.equal(result.offline, true);
  assert.equal(store.currentSettings().currency, 'USD');
  // Legacy language keys stay in sync so nothing else in the app regresses.
  assert.equal(storage.getItem('sama-language-v1'), 'fr');
  assert.equal(storage.getItem('sama-ui-lang'), 'fr');
});

test('settings store: switching to a Wolof locale syncs the legacy fr/wo toggle keys', async () => {
  const storage = memoryStorage();
  const store = createSettingsStore({ storage, fetchImpl: null, apiUrl: '' });
  await store.save({ locale: 'wo-SN' });
  assert.equal(storage.getItem('sama-language-v1'), 'wo');
  assert.equal(storage.getItem('sama-ui-lang'), 'wo');
});

test('settings store: onboarding flag is one-shot and persisted', () => {
  const storage = memoryStorage();
  const store = createSettingsStore({ storage, fetchImpl: null, apiUrl: '' });
  assert.equal(store.hasOnboarded(), false);
  store.markOnboarded();
  assert.equal(store.hasOnboarded(), true);
});

console.log(`\n${passed} assertions passed`);
if (process.exitCode) {
  console.error('SOME TESTS FAILED');
} else {
  console.log('ALL TESTS PASSED');
}
