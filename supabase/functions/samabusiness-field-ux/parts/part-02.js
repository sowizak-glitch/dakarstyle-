lateTimer = setTimeout(() => applyLanguage(root), 30);
  }

  function updateLanguageButton() {
    const button = $('languageBtn');
    if (!button) return;
    const wolof = isWolof();
    button.textContent = wolof ? 'FR' : 'WO';
    button.setAttribute('aria-label', wolof ? 'Passer en français' : 'Jëfandikoo Wolof');
    button.title = wolof ? 'Français' : 'Wolof';
    button.dataset.languageCurrent = wolof ? 'wo' : 'fr';
  }

  function installLanguageControl() {
    const button = $('languageBtn');
    if (!button || button.dataset.sbfuLanguage) return;
    button.dataset.sbfuLanguage = '1';
    button.onclick = () => {
      state.language = state.language === 'wo' ? 'fr' : 'wo';
      try { saveSession(); } catch (_) { localStorage.setItem('sama-language-v1', state.language); }
      try { if (typeof renderAll === 'function' && state.data) renderAll(); } catch (_) {}
      applyLanguage(document.body);
      notify(state.language === 'wo' ? 'Wolof activé' : 'Français activé', state.language === 'wo' ? 'L’application est maintenant en wolof.' : 'L’application est maintenant en français.');
    };
    updateLanguageButton();
  }

  function simplifyAuth() {
    const screen = $('authScreen');
    if (!screen || screen.dataset.sbfuSimple) return;
    screen.dataset.sbfuSimple = '1';
    const emailButton = qs('[data-auth-type="email"]', screen);
    const phoneButton = qs('[data-auth-type="phone"]', screen);
    if (emailButton) emailButton.classList.add(`${PREFIX}-email-secondary`);
    if (phoneButton) phoneButton.classList.add(`${PREFIX}-phone-primary`);
    const typeWrap = qs('.auth-type', screen);
    if (typeWrap && emailButton && !qs('[data-sbfu-email-toggle]', typeWrap)) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = `${PREFIX}-email-toggle`;
      link.dataset.sbfuEmailToggle = '1';
      link.textContent = 'J’utilise un e-mail';
      link.addEventListener('click', () => {
        emailButton.classList.toggle(`${PREFIX}-email-visible`);
        if (emailButton.classList.contains(`${PREFIX}-email-visible`)) emailButton.click();
        else phoneButton?.click();
      });
      typeWrap.appendChild(link);
    }
    const pinLabel = qs('#pinInput')?.closest('.field')?.querySelector('label');
    if (pinLabel) pinLabel.textContent = 'Code secret (6 chiffres ou votre ancien code)';
    const hint = qs('.auth-card > .hint', screen);
    if (hint && !qs(`#${PREFIX}-auth-help`, screen)) {
      const help = document.createElement('p');
      help.id = `${PREFIX}-auth-help`;
      help.className = 'hint';
      help.textContent = 'Votre numéro + votre code secret. Rien d’autre.';
      help.style.textAlign = 'center';
      help.style.fontWeight = '800';
      hint.before(help);
    }
  }

  function injectStyles() {
    if ($(`${PREFIX}-styles`)) return;
    const style = document.createElement('style');
    style.id = `${PREFIX}-styles`;
    style.textContent = `
      #languageBtn{font-weight:950;min-width:52px;border-color:#a8beb4;background:#fff;color:#123c2f}
      .${PREFIX}-phone-primary{flex:1}. ${PREFIX}-email-secondary{display:none!important}. ${PREFIX}-email-secondary.${PREFIX}-email-visible{display:flex!important}
      .${PREFIX}-email-toggle{border:0;background:transparent;color:#315f50;text-decoration:underline;padding:8px;font-weight:800;font-size:12px}
      .${PREFIX}-home-voice{margin:14px 0 2px;border:1px solid rgba(255,255,255,.22);border-radius:20px;background:rgba(255,255,255,.12);padding:12px}
      .${PREFIX}-home-voice button{width:100%;border:0;border-radius:17px;background:#fff;color:#123c2f;display:flex;align-items:center;gap:14px;padding:13px 16px;text-align:left;box-shadow:0 12px 30px rgba(3,24,17,.17)}
      .${PREFIX}-home-voice .mic{width:64px;height:64px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(145deg,#f2b84b,#ffda7a);font-size:30px;box-shadow:0 10px 22px rgba(242,184,75,.3);flex:0 0 auto}
      .${PREFIX}-home-voice b{display:block;font-size:16px}. ${PREFIX}-home-voice small{display:block;margin-top:4px;color:#62716b;line-height:1.35}
      .${PREFIX}-profit{font-size:clamp(27px,5vw,45px)!important;letter-spacing:-.02em}. ${PREFIX}-profit-note{display:block;margin-top:4px;color:rgba(255,255,255,.72);font-size:10px;font-weight:800}
      .${PREFIX}-receipt-actions,.${PREFIX}-stock-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
      .${PREFIX}-mini{border:1px solid #bfd0c7;background:#fff;color:#123c2f;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:900}. ${PREFIX}-mini.fill{background:#123c2f;color:#fff;border-color:#123c2f}. ${PREFIX}-mini.warn{background:#fff5df;color:#7e5100;border-color:#e8c678}
      .${PREFIX}-restock{margin:0 0 12px;padding:14px;border:1px solid #e2c36f;background:linear-gradient(135deg,#fff9e9,#fff);border-radius:17px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}. ${PREFIX}-restock .copy{flex:1;min-width:180px}. ${PREFIX}-restock b{display:block}. ${PREFIX}-restock span{font-size:11px;color:#62716b}
      .${PREFIX}-modal-backdrop{position:fixed;inset:0;z-index:2600;background:rgba(4,20,15,.65);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:14px}. ${PREFIX}-modal-backdrop.open{display:flex}
      .${PREFIX}-modal{width:min(620px,100%);max-height:92vh;overflow:auto;background:#f8faf9;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.3);padding:17px}. ${PREFIX}-modal-head{display:flex;gap:10px;align-items:center;margin-bottom:12px}. ${PREFIX}-modal-head h2{margin:0;font-size:20px}. ${PREFIX}-modal-head button{margin-left:auto}
      .${PREFIX}-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}. ${PREFIX}-field{display:flex;flex-direction:column;gap:5px}. ${PREFIX}-field.full{grid-column:1/-1}. ${PREFIX}-field label{font-size:11px;font-weight:900;color:#3f574e}. ${PREFIX}-field input,.${PREFIX}-field select{border:1px solid #cbd9d2;border-radius:12px;padding:11px 12px;background:#fff;color:#10231d;width:100%}
      .${PREFIX}-receipt-preview{background:#fff;border:1px solid #dce5df;border-radius:16px;padding:8px;overflow:auto}.${PREFIX}-receipt-preview canvas{width:100%;height:auto;display:block;border-radius:11px}
      .${PREFIX}-modal-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}. ${PREFIX}-modal-actions button{flex:1;min-width:135px}
      .${PREFIX}-payment-summary{padding:13px;background:#eef5f1;border-radius:14px;margin-bottom:11px}. ${PREFIX}-payment-summary strong{font-size:22px;display:block;margin-top:3px}
      @media(max-width:620px){.${PREFIX}-home-voice .mic{width:58px;height:58px}. ${PREFIX}-form{grid-template-columns:1fr}. ${PREFIX}-modal{padding:14px}. ${PREFIX}-modal-actions button{min-width:100%}. ${PREFIX}-restock{align-items:flex-start}}
    `.replace(/\. sbfu/g, '.sbfu');
    document.head.appendChild(style);
  }

  function mountHomeVoice() {
    const hero = qs('#view-home .hero'