7546';
    ctx.fillText(xof(model.remaining), 955, boxY + 178);
    ctx.textAlign = 'left';
    ctx.fillStyle = model.remaining > 0 ? '#fff1d6' : '#def5e8';
    roundRect(ctx, 125, boxY + 205, 330, 48, 24);
    ctx.fill();
    ctx.fillStyle = model.remaining > 0 ? '#825000' : '#12683e';
    ctx.font = '900 22px Arial';
    ctx.fillText(model.status.toUpperCase(), 150, boxY + 237);

    ctx.fillStyle = '#62716b';
    ctx.font = '600 21px Arial';
    ctx.fillText('Merci pour votre confiance.', 95, 1275);
    ctx.textAlign = 'right';
    ctx.fillText('Créé avec SAMABUSINESS', 985, 1275);
    ctx.textAlign = 'left';
    return canvas;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function canvasBlob(canvas, type = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Création du fichier impossible.')), type, quality));
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  function jpegPdf(jpegBytes, imageWidth, imageHeight) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [0];
    let length = 0;
    const pushText = (text) => { const bytes = enc.encode(text); parts.push(bytes); length += bytes.length; };
    const pushBytes = (bytes) => { parts.push(bytes); length += bytes.length; };
    const object = (number, header, streamBytes = null) => {
      offsets[number] = length;
      pushText(`${number} 0 obj\n${header}`);
      if (streamBytes) { pushText('\nstream\n'); pushBytes(streamBytes); pushText('\nendstream'); }
      pushText('\nendobj\n');
    };
    pushText('%PDF-1.4\n%SAMABUSINESS\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    object(4, `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`, jpegBytes);
    const margin = 20;
    const maxW = 595 - margin * 2;
    const maxH = 842 - margin * 2;
    const scale = Math.min(maxW / imageWidth, maxH / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (595 - width) / 2;
    const y = (842 - height) / 2;
    const command = `q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    const commandBytes = enc.encode(command);
    object(5, `<< /Length ${commandBytes.length} >>`, commandBytes);
    const xref = length;
    pushText('xref\n0 6\n0000000000 65535 f \n');
    for (let index = 1; index <= 5; index++) pushText(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
    pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob([concatBytes(parts)], { type: 'application/pdf' });
  }

  async function receiptFiles(sale) {
    const canvas = drawReceipt(sale);
    const png = await canvasBlob(canvas, 'image/png', 0.92);
    const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.9);
    const jpegBytes = new Uint8Array(await jpeg.arrayBuffer());
    const pdf = jpegPdf(jpegBytes, canvas.width, canvas.height);
    const ref = receiptModel(sale).reference || Date.now();
    return {
      canvas,
      png,
      pdf,
      pngName: `recu-${ref}.png`,
      pdfName: `recu-${ref}.pdf`
    };
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  function ensureReceiptModal() {
    if ($(`${PREFIX}-receipt-modal`)) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="${PREFIX}-receipt-modal" class="${PREFIX}-modal-backdrop" aria-hidden="true"><section class="${PREFIX}-modal" role="dialog" aria-modal="true" aria-label="Reçu de vente"><div class="${PREFIX}-modal-head"><div><h2>Reçu de vente</h2><p class="hint">Image légère et PDF prêts à partager.</p></div><button type="button" class="${PREFIX}-mini" data-sbfu-modal-close>✕</button></div><div id="${PREFIX}-receipt-preview" class="${PREFIX}-receipt-preview"></div><div class="${PREFIX}-modal-actions"><button type="button" class="${PREFIX}-mini" data-sbfu-receipt-image>🖼️ Télécharger image</button><button type="button" class="${PREFIX}-mini" data-sbfu-receipt-pdf>📄 Télécharger PDF</button><button type="button" class="${PREFIX}-mini fill" data-sbfu-receipt-whatsapp>📲 Partager sur WhatsApp</button></div></section></div>`);
    const modal = $(`${PREFIX}-receipt-modal`);
    qsa('[data-sbfu-modal-close]', modal).forEach((button) => button.addEventListener('click', () => closeModal(modal)));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); });
    qs('[data-sbfu-receipt-image]', modal).addEventListener('click', async () => {
      if (!receiptSale) return;
      const files = await receiptFiles(receiptSale);
      downloadBlob(files.png, files.pngName);
    });
    qs('[data-sbfu-receipt-pdf]', modal).addEventListener('click', async () => {
      if (!receiptSale) return;
      const files = await receiptFiles(receiptSale);
      downloadBlob(files.pdf, files.pdfName);
    });
    qs('[data-sbfu-receipt-whatsapp]', modal).addEventListener('click', () => shareReceipt(receiptSale));
  }

  function openModal(modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function openReceipt(sale) {
    if (!sale) return;
    receiptSale = sale;
    ensureReceiptModal();
    const modal = $(`${PREFIX}-receipt-modal`);
    const preview = $(`${PREFIX}-receipt-preview`);
    preview.innerHTML = '<div class="hint" style="padding:18px;text-align:center">Création du reçu…</div>';
    openModal(modal);
    try {
      const canvas = drawReceipt(sale);
      preview.innerHTML = '';
      preview.appendChild(canvas);
      scheduleLanguage(modal);
    } catch (error) {
      preview.innerHTML = `<div class="hint" style="padd