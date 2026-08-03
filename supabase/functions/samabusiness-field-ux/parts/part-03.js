);
    const quick = qs('#view-home .quick-grid');
    if (!hero || !quick || $(`${PREFIX}-home-voice`)) return;
    const box = document.createElement('div');
    box.id = `${PREFIX}-home-voice`;
    box.className = `${PREFIX}-home-voice`;
    box.innerHTML = `<button type="button" data-sbfu-home-voice><span class="mic">🎙️</span><span><b>Parlez, SAMA remplit pour vous</b><small>Exemple : « J’ai réparé la voiture de Moustapha à 25 000 »</small></span></button>`;
    quick.before(box);
    qs('[data-sbfu-home-voice]', box).addEventListener('click', () => {
      const opener = qs('[data-sbx-open="voice"]');
      if (!opener) return notify('Commande vocale indisponible', 'Actualisez la page puis réessayez.', 'error');
      opener.click();
      setTimeout(() => {
        enhanceVoiceModule();
        $(`sbx-voice-btn`)?.click();
      }, 300);
    });
  }

  function decorateProfit() {
    const summaryData = data().summary || {};
    const profit = $('heroProfit');
    const kpi = $('kpiProfit');
    if (profit) {
      profit.textContent = xof(summaryData.real_profit);
      profit.classList.add(`${PREFIX}-profit`);
      const side = profit.closest('.hero-side');
      if (side) {
        const label = side.querySelector('small');
        if (label) label.textContent = 'Bénéfice réel aujourd’hui';
        if (!qs(`.${PREFIX}-profit-note`, side)) profit.insertAdjacentHTML('afterend', `<span class="${PREFIX}-profit-note">Entrées − coûts − dépenses</span>`);
      }
    }
    if (kpi) kpi.textContent = xof(summaryData.real_profit);
  }

  function saleById(id) {
    return (data().sales || []).find((sale) => String(sale.id) === String(id));
  }

  function filteredSales() {
    const search = ($('salesSearch')?.value || '').toLowerCase();
    const filter = $('salesFilter')?.value || 'all';
    return (data().sales || []).filter((sale) => {
      const haystack = `${sale.description || ''} ${sale.customer_name_snapshot || ''} ${sale.customer_phone_snapshot || ''}`.toLowerCase();
      const debt = Number(sale.remaining_amount) > 0;
      return haystack.includes(search) && (filter === 'all' || (filter === 'debt' && debt) || (filter === 'paid' && !debt));
    });
  }

  function decorateSales() {
    const list = $('salesList');
    if (!list) return;
    const rows = qsa(':scope > .row-card', list);
    const sales = filteredSales();
    rows.forEach((row, index) => {
      const sale = sales[index];
      if (!sale || qs('[data-sbfu-receipt]', row)) return;
      row.dataset.saleId = sale.id;
      const main = qs('.row-main', row) || row;
      const actions = document.createElement('div');
      actions.className = `${PREFIX}-receipt-actions`;
      actions.innerHTML = `<button type="button" class="${PREFIX}-mini fill" data-sbfu-receipt="${esc(sale.id)}">🧾 Reçu</button><button type="button" class="${PREFIX}-mini" data-sbfu-receipt-share="${esc(sale.id)}">📲 WhatsApp</button>`;
      main.appendChild(actions);
    });
  }

  function receiptModel(sale) {
    const description = String(sale.description || 'Vente').trim();
    const items = description.split(/\s*[,;\n]\s*/).filter(Boolean).slice(0, 8);
    return {
      commerce: merchant().name || 'SAMABUSINESS',
      phone: merchant().phone || '',
      customer: sale.customer_name_snapshot || 'Client',
      customerPhone: sale.customer_phone_snapshot || '',
      date: sale.happened_at ? new Date(sale.happened_at) : new Date(),
      items: items.length ? items : ['Vente'],
      total: Number(sale.total_amount || 0),
      paid: Number(sale.paid_amount || 0),
      remaining: Number(sale.remaining_amount || 0),
      status: Number(sale.remaining_amount || 0) > 0 ? 'Reste à payer' : 'Payé',
      reference: String(sale.id || '').slice(0, 8).toUpperCase(),
      payment: sale.payment_method || ''
    };
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text).split(/\s+/);
    let line = '';
    let count = 0;
    for (let index = 0; index < words.length; index++) {
      const test = line ? `${line} ${words[index]}` : words[index];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        count++;
        line = words[index];
        if (count >= maxLines - 1) break;
      } else line = test;
    }
    if (line && count < maxLines) ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function drawReceipt(sale) {
    const model = receiptModel(sale);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f8f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#123c2f';
    ctx.fillRect(0, 0, canvas.width, 250);
    ctx.fillStyle = '#f2b84b';
    ctx.beginPath();
    ctx.arc(930, 85, 125, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 54px Arial';
    ctx.fillText('SAMABUSINESS', 70, 82);
    ctx.font = '800 42px Arial';
    ctx.fillText(model.commerce.slice(0, 32), 70, 148);
    ctx.font = '500 25px Arial';
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.fillText(model.phone ? `Tel: ${model.phone}` : 'Reçu de vente', 70, 196);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#dce5df';
    ctx.lineWidth = 3;
    roundRect(ctx, 55, 285, 970, 930, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10231d';
    ctx.font = '900 34px Arial';
    ctx.fillText('REÇU / FACTURE', 95, 350);
    ctx.font = '600 24px Arial';
    ctx.fillStyle = '#62716b';
    ctx.fillText(`Date: ${model.date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`, 95, 398);
    ctx.fillText(`Référence: ${model.reference}`, 95, 438);
    ctx.fillText(`Client: ${model.customer}`, 95, 478);

    ctx.strokeStyle = '#e0e8e3';
    ctx.beginPath();
    ctx.moveTo(95, 520);
    ctx.lineTo(985, 520);
    ctx.stroke();

    let y = 575;
    ctx.fillStyle = '#10231d';
    ctx.font = '900 26px Arial';
    ctx.fillText('Articles / services', 95, y);
    y += 50;
    ctx.font = '600 25px Arial';
    for (const item of model.items) {
      ctx.fillStyle = '#f2b84b';
      ctx.beginPath();
      ctx.arc(108, y - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#243c33';
      y = wrapCanvasText(ctx, item, 132, y, 820, 34, 2) + 10;
    }

    const boxY = Math.max(y + 20, 840);
    ctx.fillStyle = '#eef5f1';
    roundRect(ctx, 85, boxY, 910, 270, 22);
    ctx.fill();
    ctx.fillStyle = '#455b52';
    ctx.font = '700 25px Arial';
    ctx.fillText('Total', 125, boxY + 58);
    ctx.fillText('Payé', 125, boxY + 118);
    ctx.fillText('Reste', 125, boxY + 178);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#10231d';
    ctx.font = '900 29px Arial';
    ctx.fillText(xof(model.total), 955, boxY + 58);
    ctx.fillText(xof(model.paid), 955, boxY + 118);
    ctx.fillStyle = model.remaining > 0 ? '#a45e00' : '#13