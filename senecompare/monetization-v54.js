(() => {
  'use strict';
  const contactEmail = 'hellodakarstyle@gmail.com';
  const visuals = {
    'sowhat-africa-culture': ['/assets/hero/ensemble-senegal-boutique-2026.jpg', 'Collection Sowhat Africa portée par trois jeunes Sénégalais à Dakar', 'center 34%'],
    'samabusiness-launch': ['/assets/samabusiness/samabusiness-192.webp', 'SamaBusiness, application sénégalaise de gestion commerciale', 'center'],
  };

  function updateCard(card) {
    const descriptor = visuals[card.dataset.campaign || ''];
    let visual = card.querySelector('.sc-sponsored-visual');
    if (!visual) {
      visual = document.createElement('div');
      visual.className = 'sc-sponsored-visual';
      card.prepend(visual);
    }
    if (!descriptor) {
      visual.hidden = true;
      visual.textContent = '';
      return;
    }
    visual.hidden = false;
    let image = visual.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      visual.append(image);
    }
    image.src = descriptor[0];
    image.alt = descriptor[1];
    image.style.objectPosition = descriptor[2];
  }

  function addContact(dialog) {
    const form = dialog && dialog.querySelector('.sc-partner-form');
    if (!form || form.querySelector('.sc-partner-contact')) return;
    const box = document.createElement('div');
    box.className = 'sc-partner-contact';
    const label = document.createElement('span');
    label.textContent = 'Contact partenariats et visibilité';
    const link = document.createElement('a');
    link.href = 'mailto:' + contactEmail;
    link.textContent = contactEmail;
    box.append(label, link);
    form.prepend(box);
  }

  function enhance() {
    const card = document.querySelector('.sc-sponsored-card');
    if (card && !card.dataset.premiumObserved) {
      card.dataset.premiumObserved = 'true';
      updateCard(card);
      new MutationObserver(() => updateCard(card)).observe(card, { attributes: true, attributeFilter: ['data-campaign'] });
    }
    addContact(document.getElementById('scPartnerDialog'));
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', enhance, { once: true });
  enhance();
  window.__SENECOMPARE_PREMIUM_ADS__ = Object.freeze({ contact: contactEmail });
})();
