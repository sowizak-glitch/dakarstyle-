// SAMABUSINESS Global Core — Timezone Engine
//
// Every date/time render goes through Intl.DateTimeFormat with an explicit
// IANA time zone name (never a raw GMT offset, per mission requirement).

export function createTimezoneEngine() {
  const supported = typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
    ? (() => {
        try {
          return new Set(Intl.supportedValuesOf('timeZone'));
        } catch {
          return null;
        }
      })()
    : null;

  function isValidTimeZone(tz) {
    if (!tz) return false;
    if (supported) return supported.has(tz);
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  function detectDeviceTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Dakar';
    } catch {
      return 'Africa/Dakar';
    }
  }

  function format(date, locale, timeZone, options) {
    const d = date instanceof Date ? date : new Date(date);
    const tz = isValidTimeZone(timeZone) ? timeZone : 'Africa/Dakar';
    try {
      return new Intl.DateTimeFormat(locale || 'fr-SN', { timeZone: tz, ...(options || {}) }).format(d);
    } catch {
      return d.toISOString();
    }
  }

  function formatDate(date, locale, timeZone) {
    return format(date, locale, timeZone, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatDateTime(date, locale, timeZone) {
    return format(date, locale, timeZone, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatRelative(date, locale, nowDate) {
    const now = nowDate ? new Date(nowDate) : new Date();
    const d = date instanceof Date ? date : new Date(date);
    const diffSeconds = Math.round((d.getTime() - now.getTime()) / 1000);
    const abs = Math.abs(diffSeconds);
    const units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
    ];
    try {
      const rtf = new Intl.RelativeTimeFormat(locale || 'fr-SN', { numeric: 'auto' });
      for (const [unit, secondsInUnit] of units) {
        if (abs >= secondsInUnit || unit === 'second') {
          return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
        }
      }
    } catch {
      return formatDateTime(d, locale);
    }
    return formatDateTime(d, locale);
  }

  // Week boundaries respecting the merchant's weekStart (0=Sun..6=Sat),
  // computed in the given IANA time zone rather than device-local time.
  function startOfWeek(date, weekStart, timeZone) {
    const tz = isValidTimeZone(timeZone) ? timeZone : 'Africa/Dakar';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(date instanceof Date ? date : new Date(date));
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
    const start = typeof weekStart === 'number' ? weekStart : 1;
    const diff = (weekdayIndex - start + 7) % 7;
    const localMidnight = new Date(`${map.year}-${map.month}-${map.day}T00:00:00`);
    localMidnight.setDate(localMidnight.getDate() - diff);
    return localMidnight;
  }

  return { isValidTimeZone, detectDeviceTimeZone, format, formatDate, formatDateTime, formatRelative, startOfWeek };
}
