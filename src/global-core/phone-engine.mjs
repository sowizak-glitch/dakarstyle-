// SAMABUSINESS Global Core — Phone Engine
//
// Lightweight E.164 normalize/validate/format-as-you-type, metadata-driven
// (data/phone-metadata.json) so adding a region is a data change, not an
// engine change. This intentionally does not replicate the full carrier/
// number-type detection of libphonenumber (no bundler in this Worker to
// ship its ~145KB data tables); it is designed so a real libphonenumber-js
// integration could later replace normalize()/isValid() without touching
// any call site (same {e164, national, valid, region} return shape).
//
// Legacy compatibility: existing Senegal numbers stored as "77 123 45 67",
// "771234567" or "+221771234567" all normalize to the same E.164 value, so
// no destructive rewrite of stored phone columns is required.

export function createPhoneEngine(phoneMetadata) {
  function digitsOnly(value) {
    return String(value || '').replace(/[^\d]/g, '');
  }

  function metadataFor(region) {
    return phoneMetadata[String(region || '').toUpperCase()] || null;
  }

  // Accepts free-form input + a default region (merchant's phoneRegion),
  // returns a best-effort E.164 string or null if it cannot be normalized.
  function normalize(rawValue, defaultRegion) {
    const raw = String(rawValue || '').trim();
    if (!raw) return null;

    if (raw.startsWith('+')) {
      const digits = digitsOnly(raw);
      return digits ? `+${digits}` : null;
    }

    // "00" international prefix (common outside NANP), e.g. 00221771234567
    if (raw.startsWith('00')) {
      const digits = digitsOnly(raw).slice(2);
      return digits ? `+${digits}` : null;
    }

    const meta = metadataFor(defaultRegion);
    let digits = digitsOnly(raw);
    if (!digits) return null;
    if (meta && meta.trunkPrefix && digits.startsWith(meta.trunkPrefix) && digits.length > meta.trunkPrefix.length) {
      digits = digits.slice(meta.trunkPrefix.length);
    }
    if (meta) return `+${meta.callingCode}${digits}`;
    // No metadata for this region: cannot safely assume a calling code.
    return null;
  }

  function isValid(e164Value, region) {
    if (!e164Value || e164Value[0] !== '+') return false;
    const digits = e164Value.slice(1);
    const meta = metadataFor(region);
    if (meta) {
      if (!digits.startsWith(meta.callingCode)) return false;
      const nsn = digits.slice(meta.callingCode.length);
      return meta.nsnLengths.includes(nsn.length);
    }
    // Fallback: any region matching by calling-code prefix length 1-3.
    for (const key of Object.keys(phoneMetadata)) {
      const candidate = phoneMetadata[key];
      if (!candidate || !digits.startsWith(candidate.callingCode)) continue;
      const nsn = digits.slice(candidate.callingCode.length);
      if (candidate.nsnLengths.includes(nsn.length)) return true;
    }
    return digits.length >= 8 && digits.length <= 15; // ITU-T E.164 bounds
  }

  // Human-friendly grouping for display, e.g. +221 77 123 45 67.
  function formatForDisplay(e164Value, region) {
    if (!e164Value) return '';
    const digits = e164Value.replace(/^\+/, '');
    const meta = metadataFor(region);
    const callingCode = meta ? meta.callingCode : digits.slice(0, digits.length > 10 ? 3 : 1);
    const nsn = digits.slice(callingCode.length);
    const groups = nsn.match(/.{1,2}/g) || [nsn];
    return `+${callingCode} ${groups.join(' ')}`.trim();
  }

  function detectRegion(e164Value) {
    if (!e164Value || e164Value[0] !== '+') return null;
    const digits = e164Value.slice(1);
    let best = null;
    for (const [region, meta] of Object.entries(phoneMetadata)) {
      if (digits.startsWith(meta.callingCode) && (!best || meta.callingCode.length > phoneMetadata[best].callingCode.length)) {
        best = region;
      }
    }
    return best;
  }

  return { normalize, isValid, formatForDisplay, detectRegion, metadataFor };
}
