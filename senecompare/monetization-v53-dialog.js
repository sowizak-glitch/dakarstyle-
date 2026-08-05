(() => {
  'use strict';

  const VERSION = '5.3.1-dialog';

  function relocateCloseButton() {
    const dialog = document.getElementById('scPartnerDialog');
    const panel = dialog?.querySelector('.sc-partner-panel');
    const button = dialog?.querySelector('.sc-partner-close');
    if (!dialog || !panel || !button) return false;
    if (button.parentElement !== dialog) dialog.insertBefore(button, panel);
    dialog.dataset.closeControl = 'direct-child';
    return true;
  }

  function install() {
    if (relocateCloseButton()) return;
    const observer = new MutationObserver(() => {
      if (relocateCloseButton()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.__SENECOMPARE_DIALOG_FIX__ = Object.freeze({ version: VERSION, relocateCloseButton });
})();
