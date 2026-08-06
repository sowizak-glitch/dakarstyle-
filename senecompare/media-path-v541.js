(() => {
  'use strict';

  const VERSION = '5.4.1';
  const MEDIA = Object.freeze({
    'samabusiness-launch': {
      src: '/media/v541/samabusiness-campaign.webp',
      alt: 'SamaBusiness, application sénégalaise de gestion commerciale',
    },
    'sowhat-africa-culture': {
      src: '/media/v541/sowhat-africa-campaign.webp',
      alt: 'Collection Sowhat Africa portée par trois jeunes Sénégalais à Dakar',
    },
  });

  function apply(card) {
    if (!card) return;
    const descriptor = MEDIA[card.dataset.campaign || ''];
    if (!descriptor) return;
    const image = card.querySelector('.sc-sponsored-visual img');
    if (!image) return;
    if (image.getAttribute('src') !== descriptor.src) image.src = descriptor.src;
    image.alt = descriptor.alt;
    image.decoding = 'async';
    image.loading = card.dataset.campaign === 'samabusiness-launch' ? 'eager' : 'lazy';
  }

  function mount() {
    const card = document.querySelector('.sc-sponsored-card');
    if (!card) return false;
    apply(card);
    if (!card.dataset.mediaPathV541) {
      card.dataset.mediaPathV541 = VERSION;
      new MutationObserver(() => apply(card)).observe(card, {
        attributes: true,
        attributeFilter: ['data-campaign'],
        childList: true,
        subtree: true,
      });
    }
    return true;
  }

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.__SENECOMPARE_MEDIA_PATH__ = Object.freeze({ version: VERSION, mode: 'physical-versioned-path' });
})();
