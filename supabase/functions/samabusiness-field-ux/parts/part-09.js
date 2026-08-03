(() => {
  'use strict';

  const VERSION = '10.3.0';
  const AUDIO_API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-audio-api';
  const SHARE_CACHE = 'samabusiness-shares-v1';
  const SHARED_AUDIO = '/__samabusiness_shared_audio__';
  const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
  let installPrompt = window.__SAMA_PWA_PROMPT || null;
  let audioObjectUrl = '';
  let selectedAudio = null;

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const sessionToken = () => {
    try {
      if (typeof state !== 'undefined' && state?.token) return state.token;
    } catch (_) {}
    return localStorage.getItem('sama-session-v3') || '';
  };
  const notify = (title, message = '', kind = '') => {
    try {
      if (typeof toast === 'function') return toast(title, message, kind);
    } catch (_) {}
    console[kind === 'error' ? 'error' : 'log'](title, message);
  };

  function ensurePwaConfiguration() {
    const wanted = `/manifest.webmanifest?v=${VERSION}`;
    const links = qsa('link[rel="manifest"]');
    let link = links.find((node) => node.hasAttribute('data-samabusiness-manifest')) || links[0];
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = wanted;
    link.setAttribute('data-samabusiness-manifest', VERSION);
    links.filter((node) => node !== link).forEach((node) => node.remove());

    let theme = qs('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = '#123c2f';

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${VERSION}`, { scope: '/', updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => {}))
        .catch(() => {});
    }
  }

  function installStyles() {
    if (qs('#sb-native-pwa-style')) return;
    const style = document.createElement('style');
    style.id = 'sb-native-pwa-style';
    style.textContent = `
      .sb-native-install{margin:14px 0;padding:14px;border:1px solid #c9d8d1;border-radius:18px;background:#f6faf8;display:flex;gap:12px;align-items:center}
      .sb-native-install[hidden]{display:none!important}.sb-native-install img{width:52px;height:52px;border-radius:14px;object-fit:cover;flex:none}
      .sb-native-install strong{display:block;color:#0b2d22;font-size:15px}.sb-native-install p{margin:3px 0 9px;color:#50635b;font-size:13px;line-height:1.35}
      .sb-native-install button,.sb-audio-button{min-height:46px;border:0;border-radius:14px;padding:0 16px;font-weight:800;background:#0b3d2e;color:white;cursor:pointer}
      .sb-audio-button{width:100%;margin:10px 0;background:#123c2f}.sb-audio-hint{font-size:12px;color:#60736b;margin:0 0 8px;line-height:1.45}
      .sb-audio-modal{position:fixed;inset:0;z-index:99999;background:rgba(5,20,15,.62);display:none;align-items:flex-end;justify-content:center;padding:12px}
      .sb-audio-modal.open{display:flex}.sb-audio-sheet{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.32)}
      .sb-audio-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.sb-audio-head h2{margin:0;font-size:21px;color:#102c23}
      .sb-audio-close{width:44px;height:44px;border:0;border-radius:50%;font-size:25px;background:#eef3f0;cursor:pointer}.sb-audio-drop{margin:16px 0;border:2px dashed #9db4aa;border-radius:18px;padding:18px;text-align:center;background:#f7faf8}
      .sb-audio-drop input{width:100%;font-size:16px}.sb-audio-meta{font-size:13px;color:#51645c;margin-top:8px;word-break:break-word}.sb-audio-sheet audio{width:100%;margin:8px 0 14px}
      .sb-audio-sheet label{display:block;font-weight:800;color:#203b31;margin:12px 0 6px}.sb-audio-sheet select,.sb-audio-sheet textarea{width:100%;border:1px solid #c8d6d0;border-radius:14px;padding:12px;font:inherit;background:#fff}
      .sb-audio-sheet textarea{min-height:108px;resize:vertical}.sb-audio-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px}
      .sb-audio-status{min-height:22px;font-size:13px;color:#52665e;margin-top:10px}.sb-audio-status.error{color:#9a1b1b}.sb-audio-status.ok{color:#08733e}
      @media(min-width:700px){.sb-audio-modal{align-items:center}.sb-audio-actions{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function installCard() {
    if (isStandalone()) return;
    const auth = qs('#authScreen');
    if (!auth || qs('#sb-native-install-card')) return;
    const host = qs('.auth-card', auth) || auth;
    const card = document.createElement('section');
    card.id = 'sb-native-install-card';
    card.className = 'sb-native-install';
    card.innerHTML = `
      <img src="/icon-192.png?v=${VERSION}" alt="Logo SAMABUSINESS">
      <div><strong>Installer la vraie application</strong><p>Ouverture plein écran, icône Android et accès direct sans Play Store.</p><button type="button">Installer SAMABUSINESS</button></div>`;
    const button = qs('button', card);
    button.addEventListener('click', requestInstall);
    const form = qs('form', host);
    if (form) host.insertBefore(card, form);
    else host.appendChild(card);
  }

  async function requestInstall() {
    installPrompt = window.__SAMA_PWA_PROMPT || installPrompt;
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      window.__SAMA_PWA_PROMPT = null;
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') notify('Installation lancée', 'SAMABUSINESS sera visible parmi vos applications.');
      return;
    }
    notify('Installation Android', 'Dans Chrome, ouvrez ⋮ puis choisissez « Installer l’application ». Si « Créer un raccourci » apparaît encore, actualisez une fois la page.');
  }

  function openVoiceModule() {
    const more = qs('.nav-btn[data-nav="more"]');
    if (more && more.offsetParent !== null) more.click();
    setTimeout(() => {
      const open = qsa('[data-sbx-open="voice"]').find((node) => node.offsetParent !== null);
      if (open) open.click();
    }, 80);
  }

  function audioModal() {
    let modal = qs('#sb-audio-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'sb-audio-modal';
    modal.className = 'sb-audio-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sb-audio-title');
    modal.innerHTML = `
      <div class="sb-audio-sheet">
        <div class="sb-audio-head"><h2 id="sb-audio-title">Importer un vocal WhatsApp</h2><button class="sb-audio-close" type="button" aria-label="Fermer">×</button></div>
        <p class="sb-audio-hint">Choisissez ou partagez le message vocal. L’audio n’est pas conservé après traitement.</p>
        <div class="sb-audio-drop">
          <input id="sb-audio-file" type="file" accept="audio/*,.ogg,.opus,.m4a,.aac,.mp3,.wav,.webm,.mp4">
          <div id="sb-audio-meta" class="sb-audio-meta">15 Mo maximum</div>
        </div>
        <audio id="sb-audio-player" controls hidden></audio>
        <label for="sb-audio-language">Langue du vocal</label>
        <select id="sb-audio-language"><option value="auto">Automatique : wolof ou français</option><option value="wo">Wolof</option><option value="fr">Français</option></select>
        <label for="sb-audio-transcript">Texte compris</label>
        <textarea id="sb-audio-transcript" placeholder="La transcription apparaîtra ici. Vous pouvez la corriger avant l’analyse."></textarea>
        <div id="sb-audio-status" class="sb-audio-status" aria-live="polite"></div>
        <div class="sb-audio-actions"><button id="sb-audio-transcribe" class="sb-audio-button" type="button">Transcrire et préparer</button><button id="sb-audio-use-text" class="sb-audio-button" type="button">Analyser ce texte</button></div>
      </div>`;
    document.body.appendChild(modal);
    qs('.sb-audio-close', modal).addEventListener('click', closeAudioModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeAudioModal(); });
    qs('#sb-audio-file', modal).addEventListener('change', (event) => selectAudio(event.target.files?.[0] || null));
    qs('#sb-audio-transcribe', modal).addEventListener('click', transcribeAudio);
    qs('#sb-audio-use-text', modal).addEventListener('click', useTranscript);
    return modal;
  }

  function closeAudioModal() {
    qs('#sb-audio-modal')?.classList.remove('open');
  }

  function openAudioModal(file = null) {
    const modal = audioModal();
    modal.classList.add('open');
    if (file) selectAudio(file);
    setTimeout(() => qs('#sb-audio-file', modal)?.focus(), 30);
  }

  function setAudioStatus(message, kind = '') {
    const status = qs('#sb-audio-status');
    if (!status) return;
    status.textContent = message;
    status.className = `sb-audio-status ${kind}`.trim();
  }

  function selectAudio(file) {
    selectedAudio = null;
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = '';
    const player = qs('#sb-audio-player');
    const meta = qs('#sb-audio-meta');
    if (!file) {
      if (player) player.hidden = true;
      if (meta) meta.textContent = '15 Mo maximum';
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setAudioStatus('Ce vocal dépasse 15 Mo. Réduisez-le avant de recommencer.', 'error');
      return;
    }
    const audioLike = String(file.type || '').startsWith('audio/') || /\.(ogg|opus|m4a|aac|mp3|wav|webm|mp4)$/i.test(file.name || '');
    if (!audioLike) {
      setAudioStatus('Le fichier choisi ne semble pas être un message vocal.', 'error');
      return;
    }
    selectedAudio = file;
    audioObjectUrl = URL.createObjectURL(file);
    if (player) {
      player.src = audioObjectUrl;
      player.hidden = false;
    }
    if (meta) meta.textContent = `${file.name || 'Vocal WhatsApp'} — ${(file.size / 1024 / 1024).toFixed(1)} Mo`;
    setAudioStatus('Vocal prêt. Appuyez sur « Transcrire et préparer ».');
  }

  async function transcribeAudio() {
    if (!selectedAudio) return setAudioStatus('Choisissez d’abord un message vocal.', 'error');
    const token = sessionToken();
    if (!token) return setAudioStatus('Connectez-vous avant de transcrire un vocal.', 'error');
    const button = qs('#sb-audio-transcribe');
    if (button) button.disabled = true;
    setAudioStatus('Écoute et transcription en cours…');
    try {
      const form = new FormData();
      form.append('audio', selectedAudio, selectedAudio.name || 'vocal-whatsapp.webm');
      form.append('language', qs('#sb-audio-language')?.value || 'auto');
      const response = await fetch(AUDIO_API, {
        method: 'POST',
        headers: { 'x-sama-session': token },
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Transcription indisponible.');
      const transcript = String(payload.text || '').trim();
      if (!transcript) throw new Error('Aucun texte n’a été reconnu dans ce vocal.');
      const textarea = qs('#sb-audio-transcript');
      if (textarea) textarea.value = transcript;
      setAudioStatus('Vocal compris. Vérifiez le texte puis lancez l’analyse.', 'ok');
    } catch (error) {
      setAudioStatus(`${error.message || 'Transcription indisponible.'} Vous pouvez écouter le vocal et écrire seulement les informations utiles.`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function useTranscript() {
    const transcript = String(qs('#sb-audio-transcript')?.value || '').trim();
    if (!transcript) return setAudioStatus('Écrivez ou transcrivez d’abord le contenu du vocal.', 'error');
    openVoiceModule();
    setTimeout(() => {
      const input = qs('#sbx-voice-text');
      if (!input) return setAudioStatus('Le module vocal n’est pas encore prêt.', 'error');
      input.value = transcript;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      closeAudioModal();
      const analyse = qs('#sbx-voice-analyse');
      if (analyse) analyse.click();
    }, 220);
  }

  function addAudioEntryPoint() {
    const module = qs('#sbx-module-voice');
    if (!module || qs('#sb-audio-import-button', module)) return;
    const textInput = qs('#sbx-voice-text', module);
    const button = document.createElement('button');
    button.id = 'sb-audio-import-button';
    button.type = 'button';
    button.className = 'sb-audio-button';
    button.textContent = '🎧 Importer un vocal WhatsApp';
    button.addEventListener('click', () => openAudioModal());
    const hint = document.createElement('p');
    hint.className = 'sb-audio-hint';
    hint.textContent = 'Depuis WhatsApp, vous pourrez aussi utiliser Partager → SAMABUSINESS après installation.';
    if (textInput) {
      textInput.parentNode.insertBefore(button, textInput);
      textInput.parentNode.insertBefore(hint, textInput);
    } else module.append(button, hint);
  }

  async function consumeSharedAudio() {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open(SHARE_CACHE);
      const response = await cache.match(SHARED_AUDIO);
      if (!response) return;
      const blob = await response.blob();
      const name = decodeURIComponent(response.headers.get('x-sama-file-name') || 'vocal-whatsapp');
      await cache.delete(SHARED_AUDIO);
      if (!blob.size) return;
      const file = new File([blob], name, { type: blob.type || response.headers.get('content-type') || 'audio/webm' });
      openVoiceModule();
      setTimeout(() => openAudioModal(file), 260);
    } catch (_) {}
  }

  function boot() {
    installStyles();
    ensurePwaConfiguration();
    installCard();
    audioModal();
    addAudioEntryPoint();
    consumeSharedAudio();
    const observer = new MutationObserver(() => {
      installCard();
      addAudioEntryPoint();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(ensurePwaConfiguration, 1200);
    setTimeout(ensurePwaConfiguration, 3000);
    window.__SAMABUSINESS_NATIVE_PWA__ = { version: VERSION, audioImport: true, shareTarget: true };
  }

  window.addEventListener('samabusiness-install-ready', () => {
    installPrompt = window.__SAMA_PWA_PROMPT || installPrompt;
    installCard();
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    window.__SAMA_PWA_PROMPT = event;
    installCard();
  });
  window.addEventListener('samabusiness-installed', () => qs('#sb-native-install-card')?.remove());
  window.addEventListener('appinstalled', () => qs('#sb-native-install-card')?.remove());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensurePwaConfiguration(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
