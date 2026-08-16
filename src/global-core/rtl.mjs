// SAMABUSINESS Global Core — RTL support
//
// Direction is derived from the BCP 47 locale via Intl.Locale's own script
// metadata when available, with a curated fallback set for the RTL
// language subtags used across our supported countries. Applies `lang` and
// `dir` on <html> and toggles a single CSS class so stylesheets written
// with logical properties (margin-inline, padding-inline, inset-inline,
// border-inline) automatically mirror without maintaining two UIs.

const RTL_LANGUAGE_SUBTAGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ug', 'dv']);

export function isRtlLocale(localeTag) {
  if (!localeTag) return false;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
      const loc = new Intl.Locale(localeTag);
      if (typeof loc.getTextInfo === 'function') {
        const info = loc.getTextInfo();
        if (info && info.direction) return info.direction === 'rtl';
      }
      if (loc.textInfo && loc.textInfo.direction) return loc.textInfo.direction === 'rtl';
    }
  } catch {
    /* fall through to subtag heuristic */
  }
  const lang = String(localeTag).split(/[-_]/)[0].toLowerCase();
  return RTL_LANGUAGE_SUBTAGS.has(lang);
}

export function applyDirection(localeTag, doc) {
  const document_ = doc || (typeof document !== 'undefined' ? document : null);
  if (!document_ || !document_.documentElement) return;
  const rtl = isRtlLocale(localeTag);
  document_.documentElement.setAttribute('lang', localeTag || 'fr-SN');
  document_.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  document_.documentElement.classList.toggle('sama-rtl', rtl);
  document_.documentElement.classList.toggle('sama-ltr', !rtl);
  return rtl;
}
