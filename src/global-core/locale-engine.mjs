// SAMABUSINESS Global Core — Locale Engine
//
// BCP 47 resolution with fallback (exact tag -> language -> fr-SN), ICU
// MessageFormat-lite interpolation ({name} placeholders), Intl.PluralRules
// pluralization (`key.one` / `key.other` / ... convention), lazy pack
// loading through an injected `loadPack(tag)` so the initial bundle never
// carries languages the merchant didn't choose, and an offline cache
// through an injected storage adapter (localStorage in the browser).

const DEFAULT_LOCALE = 'fr-SN';

export function createLocaleEngine(options) {
  const { loadPack, storage, initialPacks } = options || {};
  const packs = new Map(); // tag -> flat key/value dictionary
  const inflight = new Map();
  let currentLocale = DEFAULT_LOCALE;

  if (initialPacks) {
    for (const [tag, dict] of Object.entries(initialPacks)) packs.set(tag, dict);
  }

  function cacheKey(tag) {
    return `sama-locale-pack-${tag}`;
  }

  function readCache(tag) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(cacheKey(tag));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(tag, dict) {
    if (!storage) return;
    try {
      storage.setItem(cacheKey(tag), JSON.stringify(dict));
    } catch {
      /* storage full/unavailable: pack still works from memory this session */
    }
  }

  function fallbackChain(tag) {
    const chain = [];
    if (tag) {
      chain.push(tag);
      const lang = tag.split('-')[0];
      if (lang !== tag) chain.push(lang);
    }
    if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE);
    const baseDefault = DEFAULT_LOCALE.split('-')[0];
    if (!chain.includes(baseDefault)) chain.push(baseDefault);
    return chain;
  }

  async function ensurePack(tag) {
    if (packs.has(tag)) return packs.get(tag);
    const cached = readCache(tag);
    if (cached) {
      packs.set(tag, cached);
      return cached;
    }
    if (inflight.has(tag)) return inflight.get(tag);
    if (!loadPack) return null;
    const promise = Promise.resolve(loadPack(tag))
      .then((dict) => {
        if (dict) {
          packs.set(tag, dict);
          writeCache(tag, dict);
        }
        inflight.delete(tag);
        return dict || null;
      })
      .catch(() => {
        inflight.delete(tag);
        return null;
      });
    inflight.set(tag, promise);
    return promise;
  }

  async function setLocale(tag) {
    const chain = fallbackChain(tag);
    await Promise.all(chain.map(ensurePack));
    currentLocale = tag || DEFAULT_LOCALE;
    return currentLocale;
  }

  function getLocale() {
    return currentLocale;
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  }

  function pluralize(key, count, locale) {
    try {
      const rules = new Intl.PluralRules(locale || currentLocale);
      return `${key}.${rules.select(count)}`;
    } catch {
      return `${key}.other`;
    }
  }

  // t('nav.sales', {count: 3}) — resolves plural variants automatically
  // when the dictionary defines them (key.one/key.other/...), otherwise
  // treats key as a plain string lookup. Never throws or renders "undefined"
  // in production: unresolved keys fall back to the key itself.
  function t(key, vars) {
    const chain = fallbackChain(currentLocale);
    const hasCount = vars && typeof vars.count === 'number';
    const candidates = hasCount ? [pluralize(key, vars.count), key] : [key];
    for (const tag of chain) {
      const dict = packs.get(tag);
      if (!dict) continue;
      for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(dict, candidate)) {
          return interpolate(dict[candidate], vars);
        }
      }
    }
    return key;
  }

  function hasPack(tag) {
    return packs.has(tag);
  }

  return { setLocale, getLocale, t, hasPack, fallbackChain, ensurePack };
}
