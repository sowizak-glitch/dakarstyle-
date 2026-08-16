// SAMABUSINESS Global Core — Currency Engine
//
// Money is {amount, currency}. `amount` is always a MAJOR-unit decimal
// (e.g. 1500 for 1500 XOF, 19.99 for 19.99 EUR) represented as a JS number
// sourced from Postgres `numeric` — the exact same representation every
// existing sama_sales/sama_orders/sama_expenses/sama_products row already
// uses today. This is a deliberate, non-breaking choice: those columns are
// `numeric`, not `integer` minor-units, and Senegal's XOF has zero decimal
// places, so legacy rows require *no value migration* — they are simply
// "amount in XOF major units" already, which is exactly what this engine
// expects. Precision-sensitive math (rounding, splitting) is done in minor
// units internally to avoid float drift, then converted back.

export function createCurrencyEngine(minorUnitsData) {
  const exponentByCurrency = new Map();
  for (const [exp, list] of Object.entries(minorUnitsData)) {
    if (exp === '_comment') continue;
    for (const code of list) exponentByCurrency.set(code, Number(exp));
  }

  function minorUnitExponent(currency) {
    if (exponentByCurrency.has(currency)) return exponentByCurrency.get(currency);
    return 2; // ISO 4217 default
  }

  function money(amount, currency) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new TypeError('Money amount must be a finite number');
    }
    if (!currency || typeof currency !== 'string') {
      throw new TypeError('Money currency must be an ISO 4217 code');
    }
    return { amount, currency: currency.toUpperCase() };
  }

  // Convert to an integer count of minor units (e.g. cents) for exact
  // arithmetic. Uses the currency's own exponent, so XOF (exponent 0)
  // round-trips through toMinor/fromMinor with the value unchanged.
  function toMinor(m) {
    const exp = minorUnitExponent(m.currency);
    return Math.round(m.amount * 10 ** exp);
  }

  function fromMinor(minorAmount, currency) {
    const exp = minorUnitExponent(currency);
    return money(minorAmount / 10 ** exp, currency);
  }

  function add(a, b) {
    if (a.currency !== b.currency) throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
    return fromMinor(toMinor(a) + toMinor(b), a.currency);
  }

  function subtract(a, b) {
    if (a.currency !== b.currency) throw new Error(`Cannot subtract ${b.currency} from ${a.currency}`);
    return fromMinor(toMinor(a) - toMinor(b), a.currency);
  }

  function isZero(m) {
    return toMinor(m) === 0;
  }

  function format(m, locale, options) {
    const opts = options || {};
    try {
      return new Intl.NumberFormat(locale || 'fr-SN', {
        style: 'currency',
        currency: m.currency,
        currencyDisplay: opts.currencyDisplay || 'symbol',
        minimumFractionDigits: opts.minimumFractionDigits,
        maximumFractionDigits: opts.maximumFractionDigits,
      }).format(m.amount);
    } catch {
      // Unknown/unsupported ISO code for this Intl implementation: never
      // throw in the UI — degrade to a plain numeric + code suffix.
      return `${m.amount.toLocaleString(locale || 'fr-SN')} ${m.currency}`;
    }
  }

  // Legacy compatibility: every pre-Global-Core row is implicitly XOF.
  function fromLegacyAmount(amount, fallbackCurrency) {
    return money(Number(amount) || 0, fallbackCurrency || 'XOF');
  }

  return { money, toMinor, fromMinor, add, subtract, isZero, format, fromLegacyAmount, minorUnitExponent };
}
