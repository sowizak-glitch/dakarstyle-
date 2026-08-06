(() => {
  'use strict';

  const VERSION = '5.4.0';
  const CONTACT_EMAIL = 'hellodakarstyle@gmail.com';
  const CAMPAIGNS = {
    'samabusiness-launch': {
      image: '/media/samabusiness-campaign.webp',
      alt: 'SamaBusiness, application sénégalaise de gestion de commerce',
      title: 'Gérez votre commerce, simplement',
      description: 'Ventes, stock, dettes, dépenses et bénéfices réunis dans votre téléphone.',
      cta: 'Installer SamaBusiness',
      tone: 'emerald',
    },
    'sowhat-africa-culture': {
      image: '/media/sowhat-africa-campaign.webp',
      alt: 'Collection Sénégal de Sowhat Africa portée à Dakar',
      title: 'Le Sénégal se porte avec fierté',
      description: 'Streetwear, sport et culture contemporaine imaginés à Dakar pour le Sénégal et sa diaspora.',
      cta: 'Découvrir Sowhat Africa',
      tone: 'heritage',
    },
    'advertise-on-senecompare': {
      image: '/profile.webp?v=520',
      alt: 'SeneCompare Sénégal, espace de visibilité professionnelle',
      title: 'Votre activité devant les bons clients',
      description: 'Une visibilité claire, locale et mesurable, sans encombrer la recherche des visiteurs.',
      cta: 'Présenter mon activité',
      tone: 'sun',
    },
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function mailto(subject, body = '') {
    const params = new URLSearchParams({ subject, body });
    return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
  }

  function ensureVisual(card) {
    let visual = card.querySelector('.sc-sponsored-visual');
    if (visual) return visual;
    visual = document.createElement('figure');
    visual.className = 'sc-sponsored-visual';
    visual.innerHTML = '<img width="384" height="384" decoding="async"><span class="sc-visual-shine" aria-hidden="true"></span>';
    card.prepend(visual);
    return visual;
  }

  function enhanceCard(card) {
    const slug = card.dataset.campaign || '';
    const campaign = CAMPAIGNS[slug];
    if (!campaign) return;
    card.dataset.premium = VERSION;
    card.dataset.tone = campaign.tone;
    const visual = ensureVisual(card);
    const image = visual.querySelector('img');
    if (image && image.getAttribute('src') !== campaign.image) {
      image.src = campaign.image;
      image.alt = campaign.alt;
      image.loading = slug === 'samabusiness-launch' ? 'eager' : 'lazy';
      image.fetchPriority = slug === 'samabusiness-launch' ? 'high' : 'auto';
    }
    const title = card.querySelector('.sc-sponsored-content h3');
    const description = card.querySelector('.sc-sponsored-content p');
    const action = card.querySelector('.sc-sponsored-action a');
    if (title) title.textContent = campaign.title;
    if (description) description.textContent = campaign.description;
    if (action) action.textContent = campaign.cta;
    const label = card.querySelector('.sc-sponsored-label');
    if (label) label.textContent = `${label.textContent.split('·')[0].trim()} · Sponsorisé clairement`;
  }

  function addTilt(card) {
    if (!finePointer || reducedMotion || card.dataset.tiltReady) return;
    card.dataset.tiltReady = 'true';
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      card.style.setProperty('--sc-tilt-x', `${((0.5 - y) * 2.2).toFixed(2)}deg`);
      card.style.setProperty('--sc-tilt-y', `${((x - 0.5) * 2.8).toFixed(2)}deg`);
      card.style.setProperty('--sc-light-x', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--sc-light-y', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--sc-tilt-x');
      card.style.removeProperty('--sc-tilt-y');
      card.style.removeProperty('--sc-light-x');
      card.style.removeProperty('--sc-light-y');
    });
  }

  function enhanceSponsored() {
    const shell = document.getElementById('scSponsored');
    const card = shell?.querySelector('.sc-sponsored-card');
    if (!shell || !card) return false;
    shell.dataset.premium = VERSION;
    const kicker = shell.querySelector('.sc-sponsored-kicker');
    const heading = shell.querySelector('.sc-sponsored-head h2');
    const note = shell.querySelector('.sc-sponsored-note');
    if (kicker) kicker.textContent = 'Sélection utile au Sénégal';
    if (heading) heading.textContent = 'Des marques et outils choisis sans ralentir votre comparaison';
    if (note) note.textContent = 'Une seule mise en avant à la fois. Chaque contenu commercial reste clairement indiqué.';
    enhanceCard(card);
    addTilt(card);
    if (!card.dataset.observedV54) {
      card.dataset.observedV54 = 'true';
      new MutationObserver(() => enhanceCard(card)).observe(card, { attributes: true, attributeFilter: ['data-campaign'] });
    }
    return true;
  }

  function partnerBody(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    return [
      'Bonjour SeneCompare,', '',
      `Entreprise : ${values.business_name || ''}`,
      `Contact : ${values.contact_name || ''}`,
      `Email : ${values.email || ''}`,
      `Téléphone / WhatsApp : ${values.phone || ''}`,
      `Mise en avant : ${values.placement || ''}`, '',
      values.message || '', '',
      'Demande envoyée depuis SeneCompare Sénégal.',
    ].join('\n');
  }

  function enhancePartnerDialog(dialog) {
    if (!dialog || dialog.dataset.premiumV54) return;
    dialog.dataset.premiumV54 = VERSION;
    const form = dialog.querySelector('.sc-partner-form');
    if (!form) return;
    const status = form.querySelector('.sc-partner-status');
    const contact = document.createElement('aside');
    contact.className = 'sc-partner-contact';
    contact.innerHTML = `<div><strong>Contact partenariats</strong><span>${CONTACT_EMAIL}</span></div><a href="${mailto('Partenariat ou visibilité sur SeneCompare')}" rel="nofollow">✉ Écrire directement</a>`;
    form.append(contact);
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'contact_destination';
    hidden.value = CONTACT_EMAIL;
    form.append(hidden);

    form.addEventListener('submit', () => {
      const direct = contact.querySelector('a');
      direct.href = mailto(`Demande de visibilité — ${form.querySelector('[name="business_name"]')?.value || 'Professionnel'}`, partnerBody(form));
    }, { capture: true });

    if (status) {
      new MutationObserver(() => {
        if (status.dataset.state === 'success') {
          status.textContent = `Demande enregistrée. L’équipe partenariats la recevra sur ${CONTACT_EMAIL}.`;
          contact.dataset.state = 'success';
        }
      }).observe(status, { childList: true, attributes: true, subtree: true });
    }
  }

  function addFooterContact() {
    const footer = document.querySelector('.footer-links') || document.querySelector('footer');
    if (!footer || document.getElementById('scPartnerEmailLink')) return;
    const link = document.createElement('a');
    link.id = 'scPartnerEmailLink';
    link.className = 'sc-partner-email-link';
    link.href = mailto('Partenariat avec SeneCompare');
    link.textContent = `✉ Partenaires : ${CONTACT_EMAIL}`;
    link.rel = 'nofollow';
    footer.append(link);
  }

  function start() {
    enhanceSponsored();
    addFooterContact();
    enhancePartnerDialog(document.getElementById('scPartnerDialog'));
    const observer = new MutationObserver(() => {
      enhanceSponsored();
      addFooterContact();
      enhancePartnerDialog(document.getElementById('scPartnerDialog'));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.__SENECOMPARE_PREMIUM_ADS__ = { version: VERSION, contact: CONTACT_EMAIL };
})();
