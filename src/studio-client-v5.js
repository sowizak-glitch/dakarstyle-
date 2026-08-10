/**
 * SOWHAT Control V5 - Comportement de l ecran « Publier »
 *
 * Ce fichier n est PAS un module serveur : il expose une chaine servie telle
 * quelle au navigateur a l adresse `/social-intelligence/v5/studio/app.js`.
 * Il est sorti du document pour que la page reste sous une CSP sans
 * `unsafe-inline` : aucun script inline, aucun gestionnaire en ligne.
 *
 * Regles tenues par ce script :
 *   - il ne parle qu a sa propre origine, par chemins relatifs ;
 *   - il n ecrit jamais de HTML : uniquement `textContent` et
 *     `createElement`, donc aucune injection possible depuis une legende ;
 *   - il n affiche jamais un code technique a l ecran : chaque erreur connue
 *     est traduite en une phrase que l operateur peut comprendre et suivre ;
 *   - il ne montre ni cle de stockage, ni URL de media, ni JSON.
 *
 * Le code est volontairement ecrit sans gabarits litteraux : la chaine est
 * transportee dans un gabarit litteral, et les imbriquer rendrait le fichier
 * illisible et fragile.
 */

export const STUDIO_CLIENT_CONTENT_TYPE = 'text/javascript; charset=utf-8';

export const STUDIO_CLIENT_JS = `'use strict';
(function () {
  var API = '/api/social-intelligence/v5/';
  var MAX_CAPTION = 2200;
  var MAX_HASHTAGS = 30;

  var ACCEPTED = {
    'image/jpeg': { kind: 'IMAGE', max: 8 * 1024 * 1024, label: 'photo JPG' },
    'image/png': { kind: 'IMAGE', max: 8 * 1024 * 1024, label: 'photo PNG' },
    'video/mp4': { kind: 'VIDEO', max: 100 * 1024 * 1024, label: 'video MP4' }
  };

  /* Traduction des codes techniques. Un operateur ne doit jamais lire
     « publish_media_url_not_configured » : il doit lire ce qui se passe et
     ce qu il peut faire. */
  var MESSAGES = {
    media_invalid: 'Ce fichier ne peut pas etre utilise. Choisissez une photo JPG ou PNG, ou une video MP4.',
    media_type_refused: 'Ce type de fichier n est pas accepte. Utilisez une photo JPG ou PNG, ou une video MP4.',
    media_signature_mismatch: 'Ce fichier ne correspond pas a une vraie photo ou video. Choisissez un autre fichier.',
    media_hostile_content: 'Ce fichier ne peut pas etre utilise : ce n est pas une photo ni une video.',
    media_extension_mismatch: 'Le nom du fichier ne correspond pas a son contenu. Choisissez un autre fichier.',
    media_too_large: 'Ce fichier est trop volumineux. Une photo peut aller jusqu a 8 Mo, une video jusqu a 100 Mo.',
    media_file_empty: 'Ce fichier est vide.',
    media_file_missing: 'Aucun fichier n a ete recu. Reessayez.',
    media_not_multipart: 'L envoi du fichier a echoue. Reessayez.',
    media_malformed_form: 'L envoi du fichier a echoue. Reessayez.',
    media_storage_unavailable: 'Le stockage des medias n est pas disponible pour le moment.',
    media_storage_failed: 'L envoi du fichier a echoue. Reessayez.',
    csrf_invalid: 'La session a expire. Rechargez la page.',
    csrf_expired: 'La session a expire. Rechargez la page.',
    csrf_not_configured: 'La securite du cockpit n est pas encore configuree.',
    unauthorized: 'Votre session a expire. Reconnectez-vous a SOWHAT Control.',
    v5_admin_key_not_configured: 'Le cockpit n est pas encore configure.',
    meta_not_configured: 'Instagram n est pas encore connecte.',
    meta_token_expired: 'La connexion Instagram doit etre renouvelee.',
    meta_unauthorized: 'La connexion Instagram doit etre renouvelee.',
    meta_permission_denied: 'Le compte Instagram ne donne pas les autorisations necessaires.',
    meta_rate_limited: 'Instagram limite temporairement les envois. Reessayez dans quelques minutes.',
    safe_gate_closed: 'La publication est encore verrouillee. Approuvez le contenu, ou demandez l ouverture de la publication.',
    publish_media_url_not_configured: 'Le stockage media n est pas encore configure pour la publication.',
    publish_container_error: 'Instagram a refuse ce contenu. Verifiez le format du fichier.',
    publish_container_expired: 'Instagram a mis trop de temps a traiter le fichier. Reessayez.',
    publish_container_timeout: 'Instagram met du temps a traiter la video. Reessayez dans quelques minutes.',
    publish_result_unknown: 'Le resultat est incertain : verifiez le compte Instagram avant de reessayer.',
    publish_not_confirmed: 'La publication n a pas pu etre confirmee : verifiez le compte Instagram.',
    publish_idempotency_unavailable: 'La protection contre les doublons est indisponible. Publication annulee par securite.',
    studio_draft_not_found: 'Ce brouillon n existe plus.',
    studio_invalid_transition: 'Cette action n est pas possible dans l etat actuel du contenu.',
    studio_validation_failed: 'Il manque quelque chose avant de pouvoir publier.',
    studio_schedule_in_past: 'La date choisie est deja passee. Choisissez une date a venir.',
    studio_storage_unavailable: 'Le stockage n est pas disponible pour le moment.',
    studio_body_invalid: 'Les informations envoyees sont incompletes. Reessayez.',
    studio_prefill_source_unknown: 'Cette source de preremplissage est inconnue.',
    studio_plan_unavailable: 'Le plan n est pas disponible pour le moment.',
    plan_day_not_found: 'Ce jour du plan n existe plus.',
    coach_recommendation_not_found: 'Cette recommandation n est plus disponible.',
    network: 'La connexion a echoue. Verifiez votre reseau et reessayez.',
    unknown: 'Une erreur est survenue. Reessayez.'
  };

  function humanError(code, fallback) {
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (fallback) return fallback;
    return MESSAGES.unknown;
  }

  var el = function (id) { return document.getElementById(id); };

  var state = {
    csrf: '',
    published: false,
    media: null,
    draftId: document.body.getAttribute('data-draft-id') || '',
    uploading: false,
    busy: false,
    objectUrl: ''
  };

  var nodes = {
    drop: el('st-drop'), file: el('st-file'), media: el('st-media'),
    frame: el('st-media-frame'), name: el('st-media-name'), line: el('st-media-line'),
    replace: el('st-replace'), remove: el('st-remove'),
    progress: el('st-progress'), bar: el('st-bar'), progressText: el('st-progress-text'),
    mediaState: el('st-media-state'), message: el('st-message'),
    caption: el('st-caption'), captionCount: el('st-caption-count'),
    hashtags: el('st-hashtags'), hashtagsCount: el('st-hashtags-count'),
    cta: el('st-cta'), product: el('st-product'), collection: el('st-collection'),
    campaign: el('st-campaign'), schedule: el('st-schedule'),
    ig: el('st-ig'), igMedia: el('st-ig-media'), igEmpty: el('st-ig-empty'),
    igCaption: el('st-ig-caption'), igCta: el('st-ig-cta'), igTags: el('st-ig-tags'),
    save: el('st-save'), scheduleBtn: el('st-schedule-btn'), publish: el('st-publish')
  };

  /* -------------------- Affichage -------------------- */

  function show(node, visible) { if (node) node.hidden = !visible; }

  function message(text, tone) {
    if (!nodes.message) return;
    nodes.message.textContent = text || '';
    nodes.message.setAttribute('data-tone', tone || 'neutral');
    show(nodes.message, Boolean(text));
    if (text) nodes.message.scrollIntoView({ block: 'nearest' });
  }

  function mediaState(text, tone) {
    if (!nodes.mediaState) return;
    nodes.mediaState.textContent = text || '';
    nodes.mediaState.setAttribute('data-tone', tone || 'neutral');
    show(nodes.mediaState, Boolean(text));
  }

  function humanSize(bytes) {
    var value = Number(bytes) || 0;
    if (value < 1024) return value + ' o';
    if (value < 1024 * 1024) return Math.round(value / 1024) + ' Ko';
    return (value / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
  }

  function normalizeHashtags(raw) {
    var parts = String(raw || '').split(/[\\s,]+/);
    var seen = {};
    var out = [];
    for (var i = 0; i < parts.length; i += 1) {
      var tag = parts[i].trim().toLowerCase();
      if (!tag) continue;
      if (tag.charAt(0) !== '#') tag = '#' + tag;
      if (!/^#[0-9a-z\\u00c0-\\u024f_]{2,40}$/.test(tag)) continue;
      if (seen[tag]) continue;
      seen[tag] = true;
      out.push(tag);
      if (out.length >= MAX_HASHTAGS) break;
    }
    return out;
  }

  function currentFormat() {
    var checked = document.querySelector('input[name="st-format"]:checked');
    return checked ? checked.value : 'IMAGE';
  }

  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  /* -------------------- Apercu Instagram -------------------- */

  function renderPreview() {
    var format = currentFormat();
    if (nodes.ig) nodes.ig.setAttribute('data-format', format);

    var caption = nodes.caption ? nodes.caption.value : '';
    var tags = normalizeHashtags(nodes.hashtags ? nodes.hashtags.value : '');
    var cta = nodes.cta ? nodes.cta.value.trim() : '';

    if (nodes.igCaption) nodes.igCaption.textContent = caption;
    if (nodes.igCta) nodes.igCta.textContent = cta;
    if (nodes.igTags) nodes.igTags.textContent = tags.join(' ');

    if (nodes.captionCount) {
      nodes.captionCount.textContent = caption.length + ' / ' + MAX_CAPTION;
      nodes.captionCount.setAttribute('data-over', String(caption.length > MAX_CAPTION));
    }
    if (nodes.hashtagsCount) {
      nodes.hashtagsCount.textContent = tags.length + ' / ' + MAX_HASHTAGS;
      nodes.hashtagsCount.setAttribute('data-over', String(tags.length >= MAX_HASHTAGS));
    }
    refreshActions();
  }

  function renderMediaPreview(file) {
    if (state.objectUrl) { URL.revokeObjectURL(state.objectUrl); state.objectUrl = ''; }
    clearNode(nodes.frame);
    clearNode(nodes.igMedia);

    if (!file) {
      show(nodes.media, false);
      var empty = document.createElement('p');
      empty.className = 'st-ig-empty';
      empty.textContent = 'Votre photo ou votre video apparaitra ici.';
      if (nodes.igMedia) nodes.igMedia.appendChild(empty);
      return;
    }

    state.objectUrl = URL.createObjectURL(file);
    var isVideo = String(file.type || '').indexOf('video/') === 0;

    var main = document.createElement(isVideo ? 'video' : 'img');
    main.src = state.objectUrl;
    if (isVideo) { main.controls = true; main.playsInline = true; }
    else { main.alt = 'Apercu du visuel selectionne'; }
    if (nodes.frame) nodes.frame.appendChild(main);

    var mini = document.createElement(isVideo ? 'video' : 'img');
    mini.src = state.objectUrl;
    if (isVideo) { mini.muted = true; mini.playsInline = true; mini.controls = false; }
    else { mini.alt = ''; }
    if (nodes.igMedia) nodes.igMedia.appendChild(mini);

    if (nodes.name) nodes.name.textContent = file.name || 'fichier sans nom';
    if (nodes.line) {
      var spec = ACCEPTED[file.type];
      nodes.line.textContent = (spec ? spec.label : 'fichier') + ' — ' + humanSize(file.size);
    }
    show(nodes.media, true);
  }

  /* -------------------- Boutons -------------------- */

  function refreshActions() {
    var caption = nodes.caption ? nodes.caption.value.trim() : '';
    var ready = Boolean(state.media) && caption.length > 0
      && caption.length <= MAX_CAPTION && !state.uploading && !state.busy && !state.published;
    if (nodes.publish) nodes.publish.disabled = !ready;
    if (nodes.scheduleBtn) nodes.scheduleBtn.disabled = !ready;
    // Un contenu publie ne se remodifie pas : le Studio le refuserait, autant
    // que l ecran le dise avant le clic plutot qu apres.
    if (nodes.save) nodes.save.disabled = state.busy || state.uploading || state.published;
  }

  function setBusy(value, label) {
    state.busy = Boolean(value);
    if (label) message(label, 'neutral');
    refreshActions();
  }

  /* -------------------- Reseau -------------------- */

  function apiUrl(path) { return API + path; }

  function call(path, options) {
    var settings = options || {};
    var headers = { accept: 'application/json' };
    if (settings.body !== undefined) headers['content-type'] = 'application/json; charset=utf-8';
    if (settings.method && settings.method !== 'GET') headers['x-sowhat-csrf'] = state.csrf;

    return fetch(apiUrl(path), {
      method: settings.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      body: settings.body === undefined ? undefined : JSON.stringify(settings.body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          var error = new Error(data.error || 'unknown');
          error.code = data.error || 'unknown';
          error.detail = data.detail || '';
          error.errors = data.errors || null;
          error.payload = data;
          throw error;
        }
        return data;
      });
    }, function () {
      var error = new Error('network');
      error.code = 'network';
      throw error;
    });
  }

  /* Le televersement passe par XMLHttpRequest, et non par fetch, pour une
     seule raison : c est le seul moyen d avoir une progression reelle. Une
     barre qui avance toute seule sans mesurer quoi que ce soit serait un
     mensonge a l ecran. */
  function upload(file) {
    return new Promise(function (resolve, reject) {
      var form = new FormData();
      form.append('file', file, file.name);

      var request = new XMLHttpRequest();
      request.open('POST', apiUrl('media/upload'), true);
      request.withCredentials = true;
      request.setRequestHeader('x-sowhat-csrf', state.csrf);
      request.setRequestHeader('accept', 'application/json');

      request.upload.onprogress = function (event) {
        if (!event.lengthComputable) return;
        var percent = Math.round((event.loaded / event.total) * 100);
        if (nodes.bar) nodes.bar.style.width = percent + '%';
        if (nodes.progressText) nodes.progressText.textContent = 'Envoi en cours… ' + percent + ' %';
      };
      request.onerror = function () {
        var error = new Error('network'); error.code = 'network'; reject(error);
      };
      request.onload = function () {
        var data = {};
        try { data = JSON.parse(request.responseText || '{}'); } catch (parseError) { data = {}; }
        if (request.status >= 200 && request.status < 300 && data.ok) { resolve(data); return; }
        var error = new Error(data.error || 'unknown');
        error.code = data.error || 'unknown';
        error.detail = data.detail || '';
        reject(error);
      };
      request.send(form);
    });
  }

  /* -------------------- Choix du fichier -------------------- */

  function handleFile(file) {
    if (!file) return;

    var spec = ACCEPTED[file.type];
    if (!spec) {
      message(MESSAGES.media_type_refused, 'danger');
      return;
    }
    if (!file.size) { message(MESSAGES.media_file_empty, 'danger'); return; }
    if (file.size > spec.max) { message(MESSAGES.media_too_large, 'danger'); return; }

    message('', 'neutral');
    state.media = null;
    renderMediaPreview(file);

    // Le format suit le fichier : proposer un Reel pour une video evite
    // l erreur la plus frequente, sans jamais l imposer.
    if (spec.kind === 'VIDEO') {
      var reel = el('st-format-reel');
      if (reel && !reel.checked) { reel.checked = true; }
    } else {
      var image = el('st-format-image');
      if (image && !image.checked) { image.checked = true; }
    }

    state.uploading = true;
    refreshActions();
    show(nodes.progress, true);
    if (nodes.bar) nodes.bar.style.width = '0%';
    if (nodes.progressText) nodes.progressText.textContent = 'Envoi en cours…';
    mediaState('Envoi en cours', 'warn');

    upload(file).then(function (data) {
      state.media = data.media;
      state.uploading = false;
      show(nodes.progress, false);
      mediaState('Media pret', 'good');
      renderPreview();
    }, function (error) {
      state.uploading = false;
      state.media = null;
      show(nodes.progress, false);
      mediaState('Envoi impossible', 'danger');
      message(humanError(error.code), 'danger');
      refreshActions();
    });
  }

  function clearMedia() {
    state.media = null;
    state.uploading = false;
    if (nodes.file) nodes.file.value = '';
    renderMediaPreview(null);
    show(nodes.progress, false);
    mediaState('', 'neutral');
    renderPreview();
  }

  /* -------------------- Enregistrement et publication -------------------- */

  function draftPayload() {
    return {
      format: currentFormat(),
      caption: nodes.caption ? nodes.caption.value : '',
      hashtags: normalizeHashtags(nodes.hashtags ? nodes.hashtags.value : ''),
      cta: nodes.cta ? nodes.cta.value : '',
      product: nodes.product ? nodes.product.value : '',
      collection: nodes.collection ? nodes.collection.value : '',
      campaign: nodes.campaign ? nodes.campaign.value : '',
      media: state.media
    };
  }

  function persist() {
    var payload = draftPayload();
    if (state.draftId) {
      return call('studio/drafts/' + encodeURIComponent(state.draftId), { method: 'PATCH', body: payload })
        .then(function (data) { return data; });
    }
    return call('studio/drafts', { method: 'POST', body: payload }).then(function (data) {
      state.draftId = data.draft.draft_id;
      document.body.setAttribute('data-draft-id', state.draftId);
      return data;
    });
  }

  function blockersOf(data) {
    var preview = data && data.preview;
    return preview && preview.blocking_errors ? preview.blocking_errors : [];
  }

  function showFailure(error) {
    message(humanError(error.code, error.detail ? null : ''), 'danger');
    if (error.errors && error.errors.length && nodes.message) {
      var list = document.createElement('ul');
      list.className = 'st-blockers';
      for (var i = 0; i < error.errors.length; i += 1) {
        var item = document.createElement('li');
        item.textContent = String(error.errors[i]);
        list.appendChild(item);
      }
      nodes.message.appendChild(list);
    }
  }

  function onSave() {
    if (state.busy) return;
    setBusy(true, 'Enregistrement…');
    persist().then(function () {
      setBusy(false);
      message('Brouillon enregistre.', 'good');
    }, function (error) {
      setBusy(false);
      showFailure(error);
    });
  }

  /** Approuver puis valider : deux gestes distincts cote serveur, un seul
      cote operateur. Aucun n est saute. */
  function prepare() {
    return persist()
      .then(function () { return call('studio/drafts/' + encodeURIComponent(state.draftId) + '/approve', { method: 'POST' }); })
      .then(function () { return call('studio/drafts/' + encodeURIComponent(state.draftId) + '/ready', { method: 'POST' }); });
  }

  function onSchedule() {
    if (state.busy) return;
    var when = nodes.schedule ? nodes.schedule.value : '';
    if (!when) {
      message('Choisissez une date et une heure pour programmer, ou utilisez « Publier maintenant ».', 'warn');
      return;
    }
    var target = new Date(when);
    if (isNaN(target.getTime())) { message(MESSAGES.studio_schedule_in_past, 'danger'); return; }

    setBusy(true, 'Programmation…');
    prepare()
      .then(function () {
        return call('studio/drafts/' + encodeURIComponent(state.draftId) + '/schedule', {
          method: 'POST', body: { scheduled_for: target.toISOString() }
        });
      })
      .then(function () {
        setBusy(false);
        message('Publication programmee.', 'good');
      }, function (error) {
        setBusy(false);
        showFailure(error);
      });
  }

  function onPublish() {
    if (state.busy) return;
    // Le bouton est desactive des le premier clic : une double pression ne
    // part pas deux fois. Le serveur tient la meme garantie de son cote.
    setBusy(true, 'Publication en cours…');
    prepare()
      .then(function () {
        return call('studio/drafts/' + encodeURIComponent(state.draftId) + '/publish', { method: 'POST' });
      })
      .then(function () {
        state.published = true;
        setBusy(false);
        message('Publie sur Instagram.', 'good');
      }, function (error) {
        setBusy(false);
        showFailure(error);
      });
  }

  /* -------------------- Preremplissage -------------------- */

  function applyPrefill(draft) {
    if (!draft) return;
    if (draft.format) {
      var target = draft.format === 'REEL' || draft.format === 'VIDEO' ? el('st-format-reel') : el('st-format-image');
      if (target) target.checked = true;
    }
    if (nodes.caption && draft.caption) nodes.caption.value = draft.caption;
    if (nodes.hashtags && draft.hashtags && draft.hashtags.length) nodes.hashtags.value = draft.hashtags.join(' ');
    if (nodes.cta && draft.cta) nodes.cta.value = draft.cta;
    if (nodes.product && draft.product) nodes.product.value = draft.product;
    if (nodes.collection && draft.collection) nodes.collection.value = draft.collection;
    if (nodes.campaign && draft.campaign) nodes.campaign.value = draft.campaign;
    if (draft.media) { state.media = draft.media; mediaState('Media pret', 'good'); }
    renderPreview();
  }

  function readPrefill() {
    var holder = el('st-prefill');
    if (!holder || !holder.textContent.trim()) return null;
    try { return JSON.parse(holder.textContent); } catch (error) { return null; }
  }

  /* -------------------- Demarrage -------------------- */

  function bind() {
    if (nodes.file) nodes.file.addEventListener('change', function () {
      handleFile(nodes.file.files && nodes.file.files[0]);
    });
    if (nodes.replace) nodes.replace.addEventListener('click', function () {
      if (nodes.file) nodes.file.click();
    });
    if (nodes.remove) nodes.remove.addEventListener('click', clearMedia);

    if (nodes.drop) {
      ['dragenter', 'dragover'].forEach(function (name) {
        nodes.drop.addEventListener(name, function (event) {
          event.preventDefault();
          nodes.drop.setAttribute('data-dragging', 'true');
        });
      });
      ['dragleave', 'drop'].forEach(function (name) {
        nodes.drop.addEventListener(name, function (event) {
          event.preventDefault();
          nodes.drop.setAttribute('data-dragging', 'false');
        });
      });
      nodes.drop.addEventListener('drop', function (event) {
        // Le champ fichier recouvre toute la zone : un depot atterrit sur lui
        // et declenche deja « change ». Traiter aussi l evenement ici
        // enverrait le meme fichier deux fois.
        if (event.target === nodes.file) return;
        var files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) handleFile(files[0]);
      });
    }

    ['input', 'change'].forEach(function (name) {
      if (nodes.caption) nodes.caption.addEventListener(name, renderPreview);
      if (nodes.hashtags) nodes.hashtags.addEventListener(name, renderPreview);
      if (nodes.cta) nodes.cta.addEventListener(name, renderPreview);
    });
    var formats = document.querySelectorAll('input[name="st-format"]');
    for (var i = 0; i < formats.length; i += 1) formats[i].addEventListener('change', renderPreview);

    if (nodes.save) nodes.save.addEventListener('click', onSave);
    if (nodes.scheduleBtn) nodes.scheduleBtn.addEventListener('click', onSchedule);
    if (nodes.publish) nodes.publish.addEventListener('click', onPublish);
  }

  function start() {
    bind();
    applyPrefill(readPrefill());
    renderPreview();
    call('csrf').then(function (data) {
      state.csrf = data.csrf_token || '';
      if (!state.csrf) message(MESSAGES.csrf_not_configured, 'warn');
    }, function (error) {
      message(humanError(error.code), 'danger');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
`;
