import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "12.3.0";
function experience() {
  'use strict';
  if (window.__SAMA_SITE_EXPERIENCE_V123__) return;
  window.__SAMA_SITE_EXPERIENCE_V123__ = true;
  const VERSION = '12.3.0';
  const AUDIO_API = 'https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-audio-api';
  let adminBusy = false;
  let recorderState = null;
  const CSS = `
#ss-root{--s23-ink:#10231c;--s23-green:#075f45;--s23-green2:#087a45;--s23-gold:#d8a83d;--s23-cream:#fbf8ee;--s23-bg:#f5f8f5;--s23-line:rgba(16,35,28,.11);--s23-muted:#68766f}
#ss-root .ss-shell{background:linear-gradient(180deg,#fbfdfb,#f2f6f3);border:1px solid rgba(255,255,255,.55);box-shadow:0 30px 90px rgba(4,25,18,.28)}
#ss-root .ss-head{background:radial-gradient(circle at 86% 0,rgba(216,168,61,.28),transparent 28%),linear-gradient(120deg,#0b261d,#075f45 72%,#087a45);box-shadow:0 14px 38px rgba(8,60,44,.2)}
#ss-root .ss-head strong{letter-spacing:-.035em}
#ss-root .ss-main{background:radial-gradient(circle at 92% 3%,rgba(216,168,61,.09),transparent 25%),var(--s23-bg)}
#ss-root .ss-top h2{font-size:clamp(2rem,5vw,3.55rem);line-height:.98;letter-spacing:-.055em;color:var(--s23-ink);text-wrap:balance}
#ss-root .ss-top p{font-size:14px;line-height:1.55}
#ss-root .ss-card{border:1px solid var(--s23-line);border-radius:25px;background:rgba(255,255,255,.97);box-shadow:0 12px 34px rgba(16,35,28,.055)}
#ss-root .ss-card-title{font-size:1.04rem;letter-spacing:-.025em}
#ss-root .ss-input,#ss-root .ss-select,#ss-root .ss-text{min-height:54px;border:1.5px solid rgba(16,35,28,.15);border-radius:16px;font-size:16px;background:#fff;color:var(--s23-ink)}
#ss-root .ss-text{min-height:136px;line-height:1.5}
#ss-root .ss-input:focus,#ss-root .ss-select:focus,#ss-root .ss-text:focus{outline:0;border-color:var(--s23-green2);box-shadow:0 0 0 4px rgba(8,122,69,.11)}
#ss-root .ss-choice{min-height:100px;border-radius:20px;background:linear-gradient(145deg,#f9fbfa,#eef4f0);border:1.5px solid transparent;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
#ss-root .ss-choice.on{border-color:var(--s23-green2);background:linear-gradient(145deg,#e9f7ef,#f8fcfa);box-shadow:0 10px 28px rgba(8,122,69,.1)}
#ss-root .ss-btn{min-height:50px;border-radius:16px;font-weight:900}
#ss-root .ss-primary{background:linear-gradient(135deg,#075f45,#087a45);box-shadow:0 12px 28px rgba(8,122,69,.2)}
.s23-guide{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(250px,.7fr);gap:18px;margin:0 0 17px;padding:20px;border-radius:26px;background:radial-gradient(circle at 88% 5%,rgba(216,168,61,.32),transparent 35%),linear-gradient(135deg,#10231c,#075f45);color:#fff;box-shadow:0 18px 48px rgba(12,54,40,.18);overflow:hidden}
.s23-guide-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(255,255,255,.17);border-radius:999px;background:rgba(255,255,255,.09);font-size:10px;font-weight:900;letter-spacing:.08em}
.s23-guide h3{margin:10px 0 7px;font-size:clamp(1.45rem,3.6vw,2.25rem);line-height:1;letter-spacing:-.045em;text-wrap:balance}
.s23-guide p{margin:0;max-width:660px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.55}
.s23-voicebox{display:grid;align-content:center;gap:8px;padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:21px;background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}
.s23-voice-main{min-height:62px;border:0;border-radius:17px;background:linear-gradient(135deg,#f2ca69,#d7a239);color:#15231d;font:950 15px/1 system-ui;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 12px 30px rgba(0,0,0,.14);cursor:pointer}
.s23-voice-main.is-listening{background:#fff;color:#a3372d;animation:s23Pulse 1.2s ease-in-out infinite}
.s23-voice-main.is-uploading{background:#fff;color:#075f45}
.s23-voice-sub{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.s23-voice-sub button{min-height:44px;border:1px solid rgba(255,255,255,.16);border-radius:13px;background:rgba(255,255,255,.09);color:#fff;font:850 12px system-ui;cursor:pointer}
.s23-helper{margin:0 0 14px;padding:11px 13px;border-radius:16px;border:1px solid rgba(216,168,61,.23);background:linear-gradient(135deg,#fffaf0,#fff);color:#624c18;font-size:12px;font-weight:750}
.s23-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 16px}
.s23-step{border:1px solid var(--s23-line);border-radius:16px;background:#fff;padding:10px;text-align:left;color:var(--s23-ink);font:850 12px system-ui;box-shadow:0 7px 18px rgba(16,35,28,.04);cursor:pointer}
.s23-step b{display:inline-grid;width:26px;height:26px;place-items:center;border-radius:9px;background:#eaf6ef;color:#075f45;margin-right:5px}
.s23-step span{display:block;margin:4px 0 0;color:var(--s23-muted);font-size:10px;font-weight:700}
.s23-summary{position:sticky;bottom:8px;z-index:8;margin-top:16px;padding:14px 15px;border:1px solid rgba(8,122,69,.17);border-radius:19px;background:rgba(255,255,255,.94);backdrop-filter:blur(16px);box-shadow:0 16px 42px rgba(16,35,28,.13);display:flex;align-items:center;justify-content:space-between;gap:12px}
.s23-summary strong{display:block;font-size:13px}.s23-summary small{color:var(--s23-muted)}
.s23-counter{display:block;text-align:right;margin-top:4px;color:var(--s23-muted);font-size:10px}
.s23-priority{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:0 0 16px}.s23-priority button{min-height:94px;padding:13px;border:1px solid var(--s23-line);border-radius:19px;background:#fff;text-align:left;color:var(--s23-ink);box-shadow:0 9px 24px rgba(16,35,28,.05)}.s23-priority b{display:block;font-size:1.5rem}.s23-priority span{font-weight:850}.s23-priority small{display:block;color:var(--s23-muted);margin-top:3px}
.s23-notice{position:fixed;z-index:2147483646;left:50%;top:14px;transform:translateX(-50%);width:min(92vw,560px);padding:13px 16px;border-radius:16px;background:#10231c;color:#fff;font:800 13px/1.35 system-ui;box-shadow:0 18px 50px rgba(0,0,0,.24)}.s23-notice.warn{background:#755700}.s23-notice.bad{background:#9f2f26}
@keyframes s23Pulse{50%{transform:scale(.985);box-shadow:0 0 0 8px rgba(255,255,255,.11)}}
@media(max-width:760px){
 #ss-root .ss-overlay{padding:0!important;background:rgba(3,15,28,.86)!important}
 #ss-root .ss-shell{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;border:0!important}
 #ss-root .ss-head{min-height:64px!important;padding:9px 11px!important;gap:9px!important}
 #ss-root .ss-logo{width:42px!important;height:42px!important;border-radius:14px!important;font-size:20px!important}
 #ss-root .ss-head strong{font-size:14px!important}
 #ss-root .ss-head span{font-size:9px!important}
 #ss-root .ss-x{width:42px!important;height:42px!important;border-radius:13px!important}
 #ss-root .ss-body{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:auto 1fr!important;min-width:0!important}
 #ss-root .ss-side{display:block!important;width:100%!important;min-width:0!important;padding:7px 9px!important;border-right:0!important;border-bottom:1px solid var(--s23-line)!important;overflow:hidden!important;background:rgba(255,255,255,.96)!important}
 #ss-root .ss-account{display:none!important}
 #ss-root .ss-tabs{display:flex!important;gap:5px!important;overflow-x:auto!important;scrollbar-width:none;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
 #ss-root .ss-tabs::-webkit-scrollbar{display:none}
 #ss-root .ss-tab{flex:0 0 auto!important;white-space:nowrap!important;min-height:42px!important;padding:8px 11px!important;border-radius:12px!important;font-size:11px!important}
 #ss-root .ss-tab.active{box-shadow:inset 0 -3px var(--s23-green2)!important}
 #ss-root .ss-main{min-width:0!important;padding:13px 11px 116px!important;overflow:auto!important}
 #ss-root .ss-top{display:block!important;margin-bottom:14px!important}
 #ss-root .ss-top h2{font-size:clamp(1.75rem,8vw,2.3rem)!important}
 #ss-root .ss-top p{font-size:12px!important;margin-top:6px!important}
 #ss-root .ss-actions{margin:10px 0 0!important;width:100%!important}
 #ss-root .ss-actions .ss-btn{flex:1!important}
 #ss-root .ss-2{grid-template-columns:1fr!important}
 #ss-root .ss-card{padding:14px!important;border-radius:20px!important}
 #ss-root .ss-choices{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 #ss-root .ss-choice{min-height:92px!important}
 .s23-guide{grid-template-columns:1fr!important;padding:15px!important;border-radius:21px!important;gap:13px!important}
 .s23-guide h3{font-size:1.62rem!important}
 .s23-voicebox{padding:9px!important}
 .s23-voice-main{min-height:58px!important}
 .s23-steps{grid-template-columns:1fr 1fr!important}
 .s23-summary{bottom:8px!important;align-items:flex-start!important;flex-direction:column!important}
 .s23-summary .ss-btn{width:100%!important}
 .s23-priority{grid-template-columns:1fr 1fr!important}
}
@media(max-width:390px){.s23-voice-sub{grid-template-columns:1fr}.s23-step{font-size:11px}.s23-priority{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){#ss-root *,#ss-root *:before,#ss-root *:after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
`;
  function tokenFrom(v) {
    if (!v) return '';
    if (typeof v === 'string') {
      const s = v.trim();
      if (/^sama_[A-Za-z0-9_-]{30,}$/.test(s)) return s;
      try {
        return tokenFrom(JSON.parse(s));
      } catch (_) {
        return '';
      }
    }
    if (typeof v === 'object') {
      for (const k of [
        'token',
        'sessionToken',
        'session_token',
        'accessToken',
        'access_token'
      ]){
        const r = tokenFrom(v[k]);
        if (r) return r;
      }
    }
    return '';
  }
  function getToken() {
    for (const v of [
      window.__SAMA_SESSION_TOKEN__,
      window.SAMA_SESSION_TOKEN,
      window.SAMABUSINESS?.sessionToken,
      window.SAMABUSINESS?.session?.token
    ]){
      const r = tokenFrom(v);
      if (r) return r;
    }
    for (const store of [
      localStorage,
      sessionStorage
    ]){
      try {
        for(let i = 0; i < store.length; i++){
          const k = store.key(i) || '';
          if (!/sama|session|auth/i.test(k)) continue;
          const r = tokenFrom(store.getItem(k));
          if (r) return r;
        }
      } catch (_) {}
    }
    return '';
  }
  function notify(message, kind = 'ok') {
    let box = document.querySelector('#s23-notice');
    if (!box) {
      box = document.createElement('div');
      box.id = 's23-notice';
      document.body.append(box);
    }
    box.className = 's23-notice ' + kind;
    box.textContent = message;
    clearTimeout(box._timer);
    box._timer = setTimeout(()=>box.remove(), 4300);
  }
  function injectStyle() {
    if (document.querySelector('#s23-style')) return;
    const style = document.createElement('style');
    style.id = 's23-style';
    style.textContent = CSS;
    document.head.append(style);
  }
  function setVoiceState(state, label) {
    const btn = document.querySelector('[data-s23="voice"]');
    if (!btn) return;
    btn.classList.toggle('is-listening', state === 'listening');
    btn.classList.toggle('is-uploading', state === 'uploading');
    btn.innerHTML = label || (state === 'idle' ? '🎙️ Parler à SAMA' : state === 'listening' ? '⏹ Arrêter et transcrire' : '⏳ Transcription…');
    btn.disabled = state === 'uploading';
  }
  function appendTranscript(value) {
    const desc = document.querySelector('#ss-desc');
    if (!desc || !value) return;
    desc.value = (desc.value.trim() ? desc.value.trim() + ' ' : '') + String(value).trim();
    desc.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    desc.focus({
      preventScroll: true
    });
  }
  function currentLanguage() {
    const raw = document.querySelector('#ss-lang')?.value || 'fr';
    return raw === 'wo' ? 'wo' : 'fr';
  }
  function stopRecorderTracks() {
    try {
      recorderState?.stream?.getTracks?.().forEach((t)=>t.stop());
    } catch (_) {}
  }
  async function transcribeBlob(blob) {
    const token = getToken();
    if (!token) throw new Error('Reconnectez-vous à Sama Business pour utiliser le vocal.');
    const mime = blob.type || 'audio/webm';
    const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('audio', blob, 'sama-site-vocal.' + ext);
    form.append('language', currentLanguage());
    setVoiceState('uploading');
    const response = await fetch(AUDIO_API, {
      method: 'POST',
      headers: {
        'x-sama-session': token,
        'x-client-info': 'site-experience/' + VERSION
      },
      body: form,
      cache: 'no-store'
    });
    const data = await response.json().catch(()=>({
        ok: false,
        error: 'Réponse audio invalide.'
      }));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Le vocal n’a pas pu être transcrit.');
    appendTranscript(data.text);
    notify('Votre description a été ajoutée. Vous pouvez la corriger avant de continuer.', 'ok');
  }
  async function recordFallback() {
    if (recorderState?.recorder?.state === 'recording') {
      recorderState.recorder.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify('Ce téléphone ne permet pas l’enregistrement vocal ici. Utilisez “Exemple” ou écrivez quelques mots.', 'warn');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ].find((t)=>MediaRecorder.isTypeSupported?.(t));
      const recorder = preferred ? new MediaRecorder(stream, {
        mimeType: preferred
      }) : new MediaRecorder(stream);
      const chunks = [];
      recorderState = {
        recorder,
        stream,
        chunks,
        timer: null
      };
      recorder.ondataavailable = (e)=>{
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onerror = ()=>{
        stopRecorderTracks();
        recorderState = null;
        setVoiceState('idle');
        notify('Le micro a rencontré un problème. Réessayez.', 'warn');
      };
      recorder.onstop = async ()=>{
        clearTimeout(recorderState?.timer);
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, {
          type
        });
        stopRecorderTracks();
        recorderState = null;
        try {
          if (blob.size < 700) throw new Error('Le vocal est trop court. Parlez quelques secondes.');
          await transcribeBlob(blob);
        } catch (error) {
          notify(error.message || 'Transcription impossible.', 'warn');
        } finally{
          setVoiceState('idle');
        }
      };
      recorder.start(250);
      recorderState.timer = setTimeout(()=>{
        if (recorder.state === 'recording') recorder.stop();
      }, 30000);
      setVoiceState('listening');
      notify('Parlez naturellement. Appuyez à nouveau quand vous avez terminé.', 'ok');
    } catch (error) {
      stopRecorderTracks();
      recorderState = null;
      setVoiceState('idle');
      const denied = String(error?.name || '').includes('NotAllowed');
      notify(denied ? 'Autorisez le micro dans Chrome puis réessayez.' : 'Impossible d’ouvrir le micro. Réessayez.', 'warn');
    }
  }
  function browserRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return false;
    try {
      const r = new Recognition();
      let gotResult = false;
      r.lang = currentLanguage() === 'wo' ? 'wo-SN' : 'fr-SN';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.continuous = false;
      setVoiceState('listening', '🎙️ Je vous écoute…');
      notify('Parlez maintenant : activité, produits ou services, ville et WhatsApp.', 'ok');
      r.onresult = (e)=>{
        const value = e.results?.[0]?.[0]?.transcript || '';
        if (value) {
          gotResult = true;
          appendTranscript(value);
          notify('Dictée ajoutée. Vérifiez puis continuez.', 'ok');
        }
      };
      r.onerror = (e)=>{
        setVoiceState('idle');
        const code = String(e?.error || '');
        if ([
          'network',
          'service-not-allowed',
          'audio-capture',
          'not-allowed'
        ].includes(code)) {
          recordFallback();
        } else if (!gotResult) {
          notify('Je n’ai pas bien entendu. Appuyez sur le micro et réessayez lentement.', 'warn');
        }
      };
      r.onend = ()=>{
        if (!recorderState) setVoiceState('idle');
      };
      r.start();
      return true;
    } catch (_) {
      return false;
    }
  }
  async function voiceInput() {
    if (recorderState?.recorder?.state === 'recording') {
      recorderState.recorder.stop();
      return;
    }
    if (!browserRecognition()) await recordFallback();
  }
  function fillExample() {
    const sector = document.querySelector('#ss-root [data-sector].on')?.dataset.sector || 'commerce';
    const examples = {
      commerce: [
        'Boutique Teranga',
        'Nous vendons des produits utiles avec prix clairs, commande WhatsApp et livraison locale.'
      ],
      mode: [
        'Atelier Dakar',
        'Nous vendons des vêtements avec tailles, couleurs, commande WhatsApp et livraison.'
      ],
      restauration: [
        'Saveurs du Sénégal',
        'Nous préparons des plats locaux, menus du jour et livraison sur commande.'
      ],
      artisanat: [
        'Créations Ndar',
        'Nous fabriquons des articles artisanaux et recevons les commandes sur WhatsApp.'
      ],
      services: [
        'Service Express',
        'Nous proposons nos services avec tarifs clairs, prise de contact rapide et rendez-vous.'
      ]
    };
    const values = examples[sector] || examples.services;
    const brand = document.querySelector('#ss-brand'), desc = document.querySelector('#ss-desc');
    if (brand && !brand.value.trim()) brand.value = values[0];
    if (desc && !desc.value.trim()) desc.value = values[1];
    brand?.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    desc?.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    notify('Exemple ajouté. Changez simplement les mots qui ne vous correspondent pas.', 'ok');
  }
  function speakGuide() {
    const text = currentLanguage() === 'wo' ? 'Waxal turu sa liggéey, li ngay jaay walla def, dëkk bi ak sa nimero WhatsApp.' : 'Dites le nom de votre activité, ce que vous vendez ou proposez, votre ville et votre numéro WhatsApp.';
    if (!('speechSynthesis' in window)) {
      notify('La lecture audio n’est pas disponible sur ce téléphone.', 'warn');
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-SN';
    u.rate = .88;
    speechSynthesis.speak(u);
  }
  function scrollStep(index) {
    const sections = [
      ...document.querySelectorAll('#ss-form > .ss-grid > .ss-card,#ss-form > .ss-card')
    ];
    const target = sections[index] || sections[0];
    target?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    target?.querySelector('input,textarea,select,button')?.focus({
      preventScroll: true
    });
  }
  function updateSummary() {
    const box = document.querySelector('.s23-summary');
    if (!box) return;
    const brand = document.querySelector('#ss-brand')?.value.trim() || 'Votre activité';
    const city = document.querySelector('#ss-city')?.value.trim() || 'Sénégal';
    const sector = document.querySelector('#ss-root [data-sector].on')?.textContent.trim() || 'Commerce';
    const target = box.querySelector('[data-s23-summary]');
    if (target) target.textContent = brand + ' · ' + sector + ' · ' + city;
  }
  function enhanceCreate() {
    const form = document.querySelector('#ss-form');
    if (!form || form.dataset.s23) return;
    form.dataset.s23 = '1';
    const guide = document.createElement('div');
    guide.className = 's23-guide';
    guide.innerHTML = '<div><span class="s23-guide-badge">✦ SAMA SITE</span><h3>Dites ce que vous faites. SAMA prépare votre site.</h3><p>Pas besoin de connaître le web. Parlez 20 secondes ou écrivez quelques mots : activité, produits ou services, ville et WhatsApp.</p></div><div class="s23-voicebox"><button type="button" class="s23-voice-main" data-s23="voice">🎙️ Parler à SAMA</button><div class="s23-voice-sub"><button type="button" data-s23="example">✨ Voir un exemple</button><button type="button" data-s23="listen">🔊 Écouter l’aide</button></div></div>';
    form.parentNode.insertBefore(guide, form);
    const helper = document.createElement('div');
    helper.className = 's23-helper';
    helper.textContent = 'Conseil : une phrase simple suffit. Vous pourrez tout modifier avant de publier.';
    form.parentNode.insertBefore(helper, form);
    const steps = document.createElement('div');
    steps.className = 's23-steps';
    const data = [
      [
        '1',
        'Votre activité',
        'Nom + ce que vous faites'
      ],
      [
        '2',
        'Contact',
        'Téléphone + WhatsApp'
      ],
      [
        '3',
        'Votre métier',
        'Choisissez une icône'
      ],
      [
        '4',
        'Votre objectif',
        'Vendre, réserver, présenter'
      ]
    ];
    steps.innerHTML = data.map((x, i)=>'<button type="button" class="s23-step" data-s23-step="' + i + '"><b>' + x[0] + '</b>' + x[1] + '<span>' + x[2] + '</span></button>').join('');
    form.parentNode.insertBefore(steps, form);
    const desc = document.querySelector('#ss-desc');
    if (desc) {
      const counter = document.createElement('small');
      counter.className = 's23-counter';
      desc.insertAdjacentElement('afterend', counter);
      const update = ()=>counter.textContent = desc.value.length + ' / ' + (desc.maxLength || 900) + ' caractères';
      desc.addEventListener('input', update);
      update();
    }
    const phone = document.querySelector('#ss-phone'), wa = document.querySelector('#ss-wa');
    phone?.addEventListener('blur', ()=>{
      if (wa && !wa.value.trim()) {
        wa.value = phone.value;
        wa.dispatchEvent(new Event('input', {
          bubbles: true
        }));
      }
    });
    const summary = document.createElement('div');
    summary.className = 's23-summary';
    summary.innerHTML = '<div><strong>Votre site peut être préparé</strong><small data-s23-summary>Votre activité · Commerce · Sénégal</small></div><button type="button" class="ss-btn ss-secondary" data-s23="review">✓ Vérifier avant de générer</button>';
    form.append(summary);
    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);
    updateSummary();
  }
  function enhanceSites() {
    document.querySelectorAll('#ss-root .ss-site').forEach((card)=>{
      if (card.dataset.s23) return;
      card.dataset.s23 = '1';
      const text = card.textContent || '';
      let score = 40;
      if (/Approuvé/.test(text)) score += 25;
      if (/Publié/.test(text)) score += 25;
      if (/Actif/.test(text)) score += 10;
      score = Math.min(100, score);
      const health = document.createElement('div');
      health.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:5px';
      health.innerHTML = '<div style="height:7px;flex:1;border-radius:99px;background:#e8efeb;overflow:hidden"><i style="display:block;height:100%;width:' + score + '%;background:linear-gradient(90deg,#d8a83d,#087a45)"></i></div><small style="font-weight:800;color:#68766f">' + score + '% prêt</small>';
      card.append(health);
    });
  }
  async function enhanceAdmin() {
    const main = document.querySelector('#ss-main');
    if (!main || !main.textContent.includes('Administration multi-sites') || main.querySelector('.s23-priority') || adminBusy) return;
    adminBusy = true;
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch('https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/samabusiness-site-studio', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sama-session': token,
          'x-client-info': 'site-experience/' + VERSION
        },
        body: JSON.stringify({
          action: 'admin_list_sites'
        }),
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok || !data.ok) return;
      const d = data.adminDashboard || {};
      const panel = document.createElement('div');
      panel.className = 's23-priority';
      const rows = [
        [
          '🛡️',
          d.requiresReview || 0,
          'À vérifier'
        ],
        [
          '📝',
          d.draft || 0,
          'Brouillons'
        ],
        [
          '🔗',
          d.domainsInError || 0,
          'Domaines'
        ],
        [
          '✓',
          d.published || 0,
          'Publiés'
        ]
      ];
      panel.innerHTML = rows.map((x)=>'<button type="button"><b>' + x[0] + ' ' + x[1] + '</b><span>' + x[2] + '</span><small>Accès rapide au suivi</small></button>').join('');
      main.querySelector('.ss-stats')?.insertAdjacentElement('beforebegin', panel);
    } catch (error) {
      console.warn('s23-admin', error);
    } finally{
      adminBusy = false;
    }
  }
  function enhanceHeader() {
    const label = document.querySelector('#ss-root .ss-head strong');
    if (label && !label.dataset.s23) {
      label.dataset.s23 = '1';
      label.insertAdjacentHTML('beforeend', ' <small style="font-size:9px;opacity:.65;letter-spacing:.08em">12.3</small>');
    }
  }
  function enhance() {
    injectStyle();
    enhanceHeader();
    enhanceCreate();
    enhanceSites();
    enhanceAdmin();
  }
  document.addEventListener('click', (event)=>{
    const target = event.target.closest('[data-s23],[data-s23-step]');
    if (!target) return;
    if (target.dataset.s23 === 'voice') {
      event.preventDefault();
      voiceInput();
    }
    if (target.dataset.s23 === 'example') {
      event.preventDefault();
      fillExample();
    }
    if (target.dataset.s23 === 'listen') {
      event.preventDefault();
      speakGuide();
    }
    if (target.dataset.s23 === 'review') {
      event.preventDefault();
      const required = [
        ...document.querySelectorAll('#ss-form input[required],#ss-form textarea[required]')
      ];
      const first = required.find((x)=>!x.value.trim());
      if (first) {
        first.focus();
        notify('Complétez ce champ. SAMA vous guide étape par étape.', 'warn');
      } else notify('Les informations essentielles sont complètes. Vous pouvez générer le site.', 'ok');
    }
    if (target.dataset.s23Step != null) {
      event.preventDefault();
      scrollStep(Number(target.dataset.s23Step));
    }
  }, true);
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(()=>{
      scheduled = false;
      enhance();
    });
  }
  function start() {
    enhance();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, {
      siteExperience: {
        version: VERSION,
        refresh: enhance,
        voiceFallback: 'browser+recorder+server'
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {
    once: true
  });
  else start();
}
const SCRIPT = `;(${experience.toString()})();`;
Deno.serve((req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  return new Response(req.method === "HEAD" ? null : SCRIPT, {
    headers
  });
});
