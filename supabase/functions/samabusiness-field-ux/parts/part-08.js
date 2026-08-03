deURIComponent(friendlyDebtMessage(sale))}`, '_blank', 'noopener');
        if (result.reminder?.id) await controlApi('update_reminder', { reminderId: result.reminder.id, status: 'sent' }).catch(() => {});
        notify('WhatsApp ouvert', 'Le message est amical et prêt à envoyer.');
      } catch (error) { notify('Relance impossible', error.message, 'error'); }
    }, true);
  }

  function renameDebtButtons(root = document) {
    qsa('[data-debt-pay]', root).forEach((button) => {
      if (!button.dataset.sbfuRenamed) {
        button.dataset.sbfuRenamed = '1';
        button.textContent = isWolof() ? 'Bind peymaa' : 'Saisir un versement';
      }
    });
  }

  function wrapRenderers() {
    if (window.__SAMABUSINESS_FIELD_RENDERERS__) return;
    window.__SAMABUSINESS_FIELD_RENDERERS__ = true;
    try {
      const original = renderHome;
      renderHome = function() { const result = original.apply(this, arguments); decorateProfit(); mountHomeVoice(); scheduleLanguage($('view-home')); return result; };
    } catch (_) {}
    try {
      const original = renderSales;
      renderSales = function() { const result = original.apply(this, arguments); decorateSales(); scheduleLanguage($('view-sales')); return result; };
    } catch (_) {}
    try {
      const original = renderProducts;
      renderProducts = function() { const result = original.apply(this, arguments); decorateStock(); scheduleLanguage($('view-stock')); return result; };
    } catch (_) {}
    try {
      const original = renderAll;
      renderAll = function() { const result = original.apply(this, arguments); finish(); return result; };
    } catch (_) {}
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (translating) return;
      let relevant = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) relevant = true;
        if (mutation.type === 'characterData') relevant = true;
      }
      if (!relevant) return;
      setTimeout(() => {
        enhanceVoiceModule();
        renameDebtButtons();
        decorateSales();
        decorateStock();
        mountHomeVoice();
        scheduleLanguage(document.body);
      }, 20);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function finish() {
    injectStyles();
    simplifyAuth();
    installLanguageControl();
    mountHomeVoice();
    decorateProfit();
    decorateSales();
    decorateStock();
    wrapSaleButtons();
    enhanceVoiceModule();
    renameDebtButtons();
    scheduleLanguage(document.body);
  }

  function init() {
    if (window.__SAMABUSINESS_FIELD_UX__) return;
    window.__SAMABUSINESS_FIELD_UX__ = { version: VERSION, receipt: true, wolof: true, voice: true, supplier: true };
    injectStyles();
    wrapRenderers();
    installReceiptEvents();
    installStockEvents();
    installVoicePreprocessor();
    installDebtActions();
    installObserver();
    finish();
    setTimeout(finish, 350);
    setTimeout(finish, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
