(() => {
  'use strict';
  if (window.__SAMABUSINESS_WHATSAPP_BUSINESS_ROUTER__) return;
  window.__SAMABUSINESS_WHATSAPP_BUSINESS_ROUTER__ = true;

  const VERSION = '1.0.0';
  const ANDROID_PACKAGE = 'com.whatsapp.w4b';
  const BUSINESS_SENDER_PHONE = '221773374762';
  const PLAY_STORE_FALLBACK = 'https://play.google.com/store/apps/details?id=com.whatsapp.w4b';
  const nativeOpen = window.open.bind(window);

  const isAndroid = () => {
    const platform = String(navigator.userAgentData?.platform || navigator.platform || '');
    const ua = String(navigator.userAgent || '');
    return /android/i.test(platform) || /android/i.test(ua);
  };

  const cleanPhone = (value) => String(value || '').replace(/\D/g, '');

  function extractWhatsAppTarget(rawUrl) {
    try {
      const value = String(rawUrl || '');
      if (!value) return null;

      if (/^https?:\/\/(?:www\.)?wa\.me\//i.test(value)) {
        const url = new URL(value, location.href);
        return {
          phone: cleanPhone(url.pathname.split('/').filter(Boolean)[0] || ''),
          text: url.searchParams.get('text') || '',
        };
      }

      if (/^https?:\/\/(?:api\.)?whatsapp\.com\/send/i.test(value)) {
        const url = new URL(value, location.href);
        return {
          phone: cleanPhone(url.searchParams.get('phone') || ''),
          text: url.searchParams.get('text') || '',
        };
      }

      if (/^whatsapp:\/\/send/i.test(value)) {
        const url = new URL(value);
        return {
          phone: cleanPhone(url.searchParams.get('phone') || ''),
          text: url.searchParams.get('text') || '',
        };
      }
    } catch (_) {}
    return null;
  }

  function businessIntent(phone, text) {
    const query = new URLSearchParams();
    if (phone) query.set('phone', phone);
    if (text) query.set('text', text);
    const fallback = encodeURIComponent(PLAY_STORE_FALLBACK);
    return `intent://send?${query.toString()}#Intent;scheme=whatsapp;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }

  function openBusiness(rawUrl) {
    const target = extractWhatsAppTarget(rawUrl);
    if (!target || !isAndroid()) return false;
    location.href = businessIntent(target.phone, target.text);
    return true;
  }

  window.open = function samabusinessBusinessAwareOpen(url, target, features) {
    if (openBusiness(url)) return null;
    return nativeOpen(url, target, features);
  };

  document.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || !isAndroid()) return;
    const href = anchor.getAttribute('href') || '';
    if (!extractWhatsAppTarget(href)) return;
    event.preventDefault();
    event.stopPropagation();
    openBusiness(href);
  }, true);

  window.SAMABUSINESS_WHATSAPP_BUSINESS = Object.freeze({
    version: VERSION,
    package: ANDROID_PACKAGE,
    senderPhone: BUSINESS_SENDER_PHONE,
    androidForced: true,
  });
})();
