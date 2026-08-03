ceModule() {
    const button = $('sbx-voice-btn');
    if (!button || button.dataset.sbfuVoice) return;
    const clone = button.cloneNode(true);
    clone.dataset.sbfuVoice = '1';
    button.replaceWith(clone);
    clone.addEventListener('click', () => toggleVoiceRecognition(clone));
    const select = $('sbx-voice-lang');
    if (select && isWolof()) select.value = 'wo-SN';
  }

  function toggleVoiceRecognition(button) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return notify('Micro indisponible', 'Utilisez le micro du clavier du téléphone.', 'warn');
    if (voiceRecognition) {
      try { voiceRecognition.stop(); } catch (_) {}
      voiceRecognition = null;
      return;
    }
    const area = $('sbx-voice-text');
    const title = $('sbx-voice-title');
    const preferred = $('sbx-voice-lang')?.value || (isWolof() ? 'wo-SN' : 'fr-SN');
    const start = (language, fallbackAllowed) => {
      const recognition = new Recognition();
      voiceRecognition = recognition;
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      let finalText = area?.value || '';
      recognition.onstart = () => { button.classList.add('live'); if (title) title.textContent = 'Je vous écoute…'; };
      recognition.onresult = (event) => {
        let interim = '';
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const phrase = event.results[index][0].transcript;
          if (event.results[index].isFinal) finalText += `${finalText ? ' ' : ''}${phrase}`;
          else interim += phrase;
        }
        if (area) area.value = `${finalText}${interim ? ` ${interim}` : ''}`.trim();
      };
      recognition.onerror = (event) => {
        if (fallbackAllowed && language === 'wo-SN' && event.error === 'language-not-supported') {
          voiceRecognition = null;
          notify('Wolof activé avec compatibilité', 'Ce téléphone utilise le moteur français pour reconnaître les mots wolof.', 'warn');
          setTimeout(() => start('fr-SN', false), 100);
        } else notify('Micro interrompu', event.error || 'Réessayez.', 'warn');
      };
      recognition.onend = () => {
        button.classList.remove('live');
        if (title) title.textContent = 'Appuyez puis parlez';
        if (voiceRecognition === recognition) voiceRecognition = null;
        scheduleLanguage(qs('#sbx-module-voice') || document.body);
      };
      recognition.start();
    };
    start(preferred, true);
  }

  async function controlApi(action, payload = {}) {
    const response = await fetch(CONTROL_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sama-session': token(), 'x-client-info': `samabusiness-field-ux/${VERSION}` },
      body: JSON.stringify({ action, ...payload })
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok || result.ok === false) throw new Error(result.error || 'Action impossible.');
    return result;
  }

  function friendlyDebtMessage(sale) {
    const name = sale.customer_name_snapshot || 'cher client';
    const description = sale.description || 'votre achat';
    return `Bonjour ${name} 👋,\n\nJ’espère que vous allez bien. Petit rappel amical concernant le reste de ${xof(sale.remaining_amount)} pour ${description}.\n\nVous pouvez effectuer le versement quand cela vous arrange ou nous indiquer la date prévue. Merci beaucoup.\n\n— ${merchant().name || 'Votre commerce'}`;
  }

  function ensurePaymentModal() {
    if ($(`${PREFIX}-payment-modal`)) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="${PREFIX}-payment-modal" class="${PREFIX}-modal-backdrop" aria-hidden="true"><section class="${PREFIX}-modal"><div class="${PREFIX}-modal-head"><div><h2>Saisir un versement</h2><p class="hint">Le reste à payer sera recalculé automatiquement.</p></div><button type="button" class="${PREFIX}-mini" data-sbfu-modal-close>✕</button></div><div id="${PREFIX}-payment-summary" class="${PREFIX}-payment-summary"></div><form id="${PREFIX}-payment-form" class="${PREFIX}-form"><input type="hidden" name="saleId"><div class="${PREFIX}-field"><label>Montant reçu</label><input name="amount" inputmode="numeric" required></div><div class="${PREFIX}-field"><label>Moyen</label><select name="method"><option value="wave">Wave</option><option value="cash">Espèces</option><option value="orange_money">Orange Money</option><option value="bank">Virement</option></select></div><div class="${PREFIX}-field full"><button class="${PREFIX}-mini fill" type="submit">Enregistrer le versement</button></div></form></section></div>`);
    const modal = $(`${PREFIX}-payment-modal`);
    qsa('[data-sbfu-modal-close]', modal).forEach((button) => button.addEventListener('click', () => closeModal(modal)));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); });
    $(`${PREFIX}-payment-form`).addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await api('payment', { saleId: form.get('saleId'), amount: form.get('amount'), method: form.get('method') });
        closeModal(modal);
        await refreshData(false);
        notify('Versement enregistré', 'Le reste à payer a été mis à jour.');
      } catch (error) { notify('Versement non enregistré', error.message, 'error'); }
    });
  }

  function openPayment(sale) {
    ensurePaymentModal();
    const form = $(`${PREFIX}-payment-form`);
    form.elements.saleId.value = sale.id;
    form.elements.amount.value = Math.round(Number(sale.remaining_amount || 0));
    $(`${PREFIX}-payment-summary`).innerHTML = `<span>${esc(sale.customer_name_snapshot || 'Client')}</span><strong>${xof(sale.remaining_amount)}</strong><small>${esc(sale.description || '')}</small>`;
    openModal($(`${PREFIX}-payment-modal`));
    scheduleLanguage($(`${PREFIX}-payment-modal`));
  }

  function installDebtActions() {
    document.addEventListener('click', async (event) => {
      const reminder = event.target.closest('[data-debt-remind]');
      const payment = event.target.closest('[data-debt-pay]');
      if (!reminder && !payment) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const saleId = reminder?.dataset.debtRemind || payment?.dataset.debtPay;
      const sale = saleById(saleId);
      if (!sale) return notify('Dette introuvable', 'Actualisez les données.', 'error');
      if (payment) return openPayment(sale);
      try {
        const result = await controlApi('schedule_reminder', { saleId, scheduledFor: new Date().toISOString() });
        const phone = normalizePhone(sale.customer_phone_snapshot);
        if (!phone) throw new Error('Ajoutez le numéro WhatsApp du client.');
        window.open(`https://wa.me/${phone}?text=${enco