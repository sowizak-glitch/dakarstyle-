(() => {
  'use strict';
  if (window.__SAMABUSINESS_WHATSAPP_DIRECT_V3__) return;
  window.__SAMABUSINESS_WHATSAPP_DIRECT_V3__ = true;

  const BRIDGE_PACKAGE = 'com.samabusiness.wabridge2';
  const isAndroid = () => /android/i.test(String(navigator.userAgentData?.platform || navigator.platform || '') + ' ' + String(navigator.userAgent || ''));
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const normalizePhone = (value) => {
    let phone = digits(value);
    if (phone.startsWith('00')) phone = phone.slice(2);
    if (phone.length === 9 && /^[37]/.test(phone)) phone = `221${phone}`;
    return phone.length >= 8 && phone.length <= 15 ? phone : '';
  };

  function phoneFromCard(button) {
    const card = button.closest('.sbso-card');
    if (!card) return '';
    const spans = [...card.querySelectorAll('.sbso-meta span')];
    for (const span of spans) {
      const raw = String(span.textContent || '').trim();
      const only = digits(raw);
      if (only.length === 9 || only.length === 12 || only.length === 14) {
        const phone = normalizePhone(raw);
        if (phone) return phone;
      }
    }
    const candidates = String(card.textContent || '').match(/(?:\+?221|00221)?(?:[\s.\-]*\d){9}/g) || [];
    for (const candidate of candidates) {
      const phone = normalizePhone(candidate);
      if (phone) return phone;
    }
    return '';
  }

  function nameFromCard(button) {
    const card = button.closest('.sbso-card');
    return String(card?.querySelector('.sbso-cardtitle b')?.textContent || '').trim();
  }

  function bridgeIntent(phone, text) {
    const query = new URLSearchParams();
    query.set('phone', phone);
    if (text) query.set('text', text);
    return `intent://send/?${query.toString()}#Intent;scheme=samabusiness-wabiz;package=${BRIDGE_PACKAGE};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
  }

  function launch(intentUrl) {
    const anchor = document.createElement('a');
    anchor.href = intentUrl;
    anchor.target = '_self';
    anchor.rel = 'noopener';
    anchor.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;opacity:0';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => anchor.remove(), 1500);
  }

  document.addEventListener('click', (event) => {
    if (!isAndroid()) return;
    const button = event.target?.closest?.('[data-sbso-wa-client],[data-sbso-wa-sale],[data-sbso-remind]');
    if (!button) return;
    const phone = phoneFromCard(button);
    if (!phone) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const name = nameFromCard(button);
    let text = name ? `Bonjour ${name},` : 'Bonjour,';
    if (button.hasAttribute('data-sbso-remind')) text += ' petit rappel concernant votre règlement. Merci.';
    launch(bridgeIntent(phone, text));
  }, true);

  document.documentElement.dataset.samabusinessWhatsappRouter = 'native-v3-bridge2';
})();
