/**
 * SOWHAT Control V5 - Tests du socle de securite et du Studio.
 * Aucun appel Meta : le Studio decide seulement ce qui a le droit de partir.
 */

import assert from 'node:assert/strict';
import { prefillDraftFromRecommendation } from '../src/coach-v5.js';
import { prefillDraftFromPlanDay } from '../src/plan-v5.js';
import {
  ALLOWED_MEDIA_TYPES, MEDIA_KEY_PREFIX, SECURITY_ERROR,
  businessIdempotencyKey, checkSafeGate, completeIdempotencyKey, constantTimeEqual,
  CSRF_SECRET_KEY, issueCsrfToken, readIdempotencyRecord, reserveIdempotencyKey,
  resolveCsrfSecret, sanitizeFilename, validateMedia, verifyCsrfToken,
} from '../src/security-v5.js';
import {
  ALLOWED_TRANSITIONS, MAX_CAPTION_LENGTH, STUDIO_ERROR, STUDIO_STATE,
  approveDraft, assertPublishable, beginPublishing, canTransition, cancelSchedule,
  createDraft, markFailed, markPublished, markReady, normalizeHashtags, previewDraft,
  publicationQueue, readDraft, retryFailed, saveDraft, scheduleDraft, transition,
  validateDraft, writeDraft,
} from '../src/studio-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

const NOW = Date.parse('2026-07-01T10:00:00.000Z');
const SECRET = 'un-secret-csrf-de-plus-de-trente-deux-caracteres';

/** Bucket R2 minimal, avec ecriture conditionnelle comme le vrai binding. */
class Bucket {
  constructor() { this.s = new Map(); this.puts = 0; }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v, opts = {}) {
    this.puts += 1;
    if (opts?.onlyIf?.etagDoesNotMatch === '*' && this.s.has(k)) return null;
    this.s.set(k, String(v));
    return { key: k };
  }
  json(k) { const r = this.s.get(k); return r ? JSON.parse(r) : null; }
}

/** Bucket sans support de l ecriture conditionnelle. */
class NaiveBucket extends Bucket {
  async put(k, v) { this.s.set(k, String(v)); return { key: k }; }
}

const goodMedia = () => ({
  r2_key: `${MEDIA_KEY_PREFIX}2026/07/visuel.jpg`,
  content_type: 'image/jpeg',
  size_bytes: 500000,
  filename: 'visuel.jpg',
});

function readyDraft(overrides = {}) {
  const draft = createDraft({
    caption: 'Nouvelle collection disponible.',
    hashtags: ['#dakar', '#style'],
    cta: 'Commande via WhatsApp',
    format: 'IMAGE',
    media: goodMedia(),
    ...overrides,
  }, { now: NOW });
  return markReady(approveDraft(draft, { now: NOW }), { now: NOW });
}

const OPEN_ENV = { SOWHAT_PUBLISH_ENABLED: 'true' };

/* ---------------- SAFE gate ---------------- */

test('SAFE gate : ferme par defaut, ouvert seulement si les deux verrous le sont', () => {
  assert.equal(checkSafeGate({}, { safe_approved: true }).allowed, false);
  assert.equal(checkSafeGate({ SOWHAT_PUBLISH_ENABLED: 'false' }, { safe_approved: true }).allowed, false);
  assert.equal(checkSafeGate({ SOWHAT_PUBLISH_ENABLED: '1' }, { safe_approved: true }).allowed, false);
  assert.equal(checkSafeGate(OPEN_ENV, { safe_approved: false }).allowed, false);
  assert.equal(checkSafeGate(OPEN_ENV, {}).allowed, false);
  assert.equal(checkSafeGate(OPEN_ENV, { safe_approved: 'true' }).allowed, false, 'une chaine n est pas une approbation');
  assert.equal(checkSafeGate(OPEN_ENV, { safe_approved: true }).allowed, true);
});

/* ---------------- CSRF ---------------- */

test('CSRF : jeton valide accepte, jeton falsifie refuse', async () => {
  const env = { SOCIAL_INTELLIGENCE_CSRF_SECRET: SECRET };
  const token = await issueCsrfToken(env, 'session-1', NOW);
  assert.equal((await verifyCsrfToken(env, 'session-1', token, NOW)).valid, true);
  assert.equal((await verifyCsrfToken(env, 'session-1', `${token}x`, NOW)).code, SECURITY_ERROR.CSRF_INVALID);
  assert.equal((await verifyCsrfToken(env, 'session-1', 'nimporte-quoi', NOW)).code, SECURITY_ERROR.CSRF_INVALID);
  assert.equal((await verifyCsrfToken(env, 'session-1', '', NOW)).code, SECURITY_ERROR.CSRF_INVALID);
});

test('CSRF : un jeton d une autre session ne vaut rien', async () => {
  const env = { SOCIAL_INTELLIGENCE_CSRF_SECRET: SECRET };
  const token = await issueCsrfToken(env, 'session-1', NOW);
  assert.equal((await verifyCsrfToken(env, 'session-2', token, NOW)).valid, false);
});

test('CSRF : jeton perime refuse, jeton du futur refuse', async () => {
  const env = { SOCIAL_INTELLIGENCE_CSRF_SECRET: SECRET };
  const token = await issueCsrfToken(env, 's', NOW);
  const expired = await verifyCsrfToken(env, 's', token, NOW + 3 * 60 * 60 * 1000);
  assert.equal(expired.code, SECURITY_ERROR.CSRF_EXPIRED);
  const future = await issueCsrfToken(env, 's', NOW + 10 * 60 * 1000);
  assert.equal((await verifyCsrfToken(env, 's', future, NOW)).code, SECURITY_ERROR.CSRF_INVALID);
});

test('CSRF : secret absent ou trop court = fail closed', async () => {
  assert.equal((await verifyCsrfToken({}, 's', 'x.y', NOW)).code, SECURITY_ERROR.CSRF_NOT_CONFIGURED);
  assert.equal((await verifyCsrfToken({ SOCIAL_INTELLIGENCE_CSRF_SECRET: 'court' }, 's', 'x.y', NOW)).code, SECURITY_ERROR.CSRF_NOT_CONFIGURED);
  await assert.rejects(() => issueCsrfToken({}, 's', NOW), (e) => e.code === SECURITY_ERROR.CSRF_NOT_CONFIGURED);
});

test('comparaison a duree constante', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
  assert.equal(constantTimeEqual(null, ''), true);
});

/* ---------------- Validation des medias ---------------- */

test('media : type hors allowlist refuse', () => {
  for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream', '']) {
    const result = validateMedia({ ...goodMedia(), content_type: type });
    assert.equal(result.valid, false, type);
    assert.equal(result.code, SECURITY_ERROR.MEDIA_INVALID);
  }
  assert.deepEqual(Object.keys(ALLOWED_MEDIA_TYPES).sort(), ['image/jpeg', 'image/png', 'video/mp4']);
});

test('media : taille bornee par type', () => {
  assert.equal(validateMedia({ ...goodMedia(), size_bytes: 9 * 1024 * 1024 }).valid, false);
  assert.equal(validateMedia({ ...goodMedia(), size_bytes: 0 }).valid, false);
  assert.equal(validateMedia({ ...goodMedia(), size_bytes: null }).valid, false);
  const video = { r2_key: `${MEDIA_KEY_PREFIX}a.mp4`, content_type: 'video/mp4', size_bytes: 50 * 1024 * 1024, filename: 'a.mp4' };
  assert.equal(validateMedia(video).valid, true);
  assert.equal(validateMedia({ ...video, size_bytes: 200 * 1024 * 1024 }).valid, false);
});

test('media : extension incoherente avec le type refusee', () => {
  const result = validateMedia({ ...goodMedia(), filename: 'piege.html' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /extension/.test(e)));
});

test('media : cle R2 hors prefixe ou avec remontee de chemin refusee', () => {
  for (const key of ['autre/chemin/x.jpg', `${MEDIA_KEY_PREFIX}../../secrets.jpg`, `${MEDIA_KEY_PREFIX}a//b.jpg`, '']) {
    assert.equal(validateMedia({ ...goodMedia(), r2_key: key }).valid, false, key);
  }
});

test('nom de fichier neutralise : ni chemin, ni caractere de controle', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('C:\\Users\\x\\photo.jpg'), 'photo.jpg');
  assert.equal(sanitizeFilename('mon fichier (1).jpg'), 'mon-fichier-1-.jpg');
  assert.equal(sanitizeFilename('...'), '');
});

/* ---------------- Idempotence ---------------- */

test('cle d idempotence : metier, stable, et sensible au contenu', async () => {
  const base = { draft_id: 'D1', instagram_user_id: '178414', scheduled_for: '2026-07-01T12:00:00Z', media_key: 'k', caption: 'texte' };
  const a = await businessIdempotencyKey(base);
  const b = await businessIdempotencyKey({ ...base });
  assert.equal(a, b, 'les memes elements donnent toujours la meme cle');
  assert.notEqual(a, await businessIdempotencyKey({ ...base, caption: 'autre texte' }));
  assert.notEqual(a, await businessIdempotencyKey({ ...base, scheduled_for: '2026-07-02T12:00:00Z' }));
  assert.equal(a.length, 40);
});

test('reservation : la premiere gagne, la seconde est un doublon', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const first = await reserveIdempotencyKey(env, 'cle-1', { draft_id: 'D1' });
  assert.equal(first.reserved, true);
  const second = await reserveIdempotencyKey(env, 'cle-1', { draft_id: 'D1' });
  assert.equal(second.reserved, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.existing.draft_id, 'D1');
});

test('reservation : sans ecriture conditionnelle, on refuse au lieu de risquer un doublon', async () => {
  const env = { VISUALS_BUCKET: new NaiveBucket() };
  const first = await reserveIdempotencyKey(env, 'cle-2');
  assert.equal(first.reserved, false, 'un stockage sans exclusion mutuelle ne doit jamais laisser croire a une reservation');
  assert.equal(first.code, SECURITY_ERROR.IDEMPOTENCY_UNSUPPORTED);
  const sansBucket = await reserveIdempotencyKey({}, 'cle-3');
  assert.equal(sansBucket.reserved, false);
  assert.equal(sansBucket.code, SECURITY_ERROR.IDEMPOTENCY_UNSUPPORTED, 'fail closed sans stockage');
});

test('reservation : l ecriture conditionnelle est reellement verifiee, pas supposee', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const result = await reserveIdempotencyKey(env, 'cle-probe');
  assert.equal(result.reserved, true);
  assert.equal(env.VISUALS_BUCKET.puts, 2, 'une sonde verifie que onlyIf est honore');
});

test('resultat definitif consigne sur la cle', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  await reserveIdempotencyKey(env, 'cle-4', { draft_id: 'D9' });
  await completeIdempotencyKey(env, 'cle-4', { instagram_media_id: '999' });
  const record = await readIdempotencyRecord(env, 'cle-4');
  assert.equal(record.result.instagram_media_id, '999');
  assert.ok(record.completed_at);
});

/* ---------------- Studio : machine a etats ---------------- */

test('les sept etats existent et PUBLISHED est terminal', () => {
  assert.deepEqual(Object.keys(STUDIO_STATE).sort(), ['CANCELLED', 'DRAFT', 'FAILED', 'PUBLISHED', 'PUBLISHING', 'READY', 'SCHEDULED']);
  assert.deepEqual(ALLOWED_TRANSITIONS.PUBLISHED, []);
  assert.equal(canTransition('PUBLISHED', 'DRAFT'), false);
  assert.equal(canTransition('PUBLISHED', 'READY'), false);
});

test('toute transition non declaree est refusee', () => {
  const draft = createDraft({ caption: 'x', media: goodMedia() }, { now: NOW });
  assert.throws(() => transition(draft, STUDIO_STATE.PUBLISHED, { now: NOW }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
  assert.throws(() => transition(draft, STUDIO_STATE.PUBLISHING, { now: NOW }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
  assert.throws(() => transition(draft, 'INVENTE', { now: NOW }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
});

test('l historique des etats est conserve', () => {
  const draft = readyDraft();
  const scheduled = scheduleDraft(draft, new Date(NOW + 3600000).toISOString(), { now: NOW });
  assert.equal(scheduled.state, STUDIO_STATE.SCHEDULED);
  assert.ok(scheduled.history.length >= 3);
  assert.equal(scheduled.history[0].to, STUDIO_STATE.DRAFT);
  assert.equal(scheduled.history.at(-1).to, STUDIO_STATE.SCHEDULED);
});

/* ---------------- Studio : validation ---------------- */

test('un brouillon nait en DRAFT et jamais approuve', () => {
  const draft = createDraft({ caption: 'texte', media: goodMedia() }, { now: NOW });
  assert.equal(draft.state, STUDIO_STATE.DRAFT);
  assert.equal(draft.safe_approved, false);
  assert.equal(draft.instagram_media_id, null);
});

test('validation : legende et media obligatoires, erreurs listees', () => {
  assert.equal(validateDraft(createDraft({ media: goodMedia() }, { now: NOW })).valid, false);
  assert.equal(validateDraft(createDraft({ caption: 'x' }, { now: NOW })).valid, false);
  const errors = validateDraft(createDraft({}, { now: NOW })).errors;
  assert.ok(errors.length >= 2, 'toutes les causes doivent etre listees, pas seulement la premiere');
});

test('validation : coherence format et media', () => {
  const reel = createDraft({ caption: 'x', format: 'REEL', media: goodMedia() }, { now: NOW });
  assert.ok(validateDraft(reel).errors.some((e) => /Reel exige un media video/.test(e)));
  const image = createDraft({
    caption: 'x', format: 'IMAGE',
    media: { r2_key: `${MEDIA_KEY_PREFIX}a.mp4`, content_type: 'video/mp4', size_bytes: 1000, filename: 'a.mp4' },
  }, { now: NOW });
  assert.ok(validateDraft(image).errors.some((e) => /exige un media image/.test(e)));
});

test('legende tronquee a la limite Instagram, hashtags normalises et bornes', () => {
  const draft = createDraft({ caption: 'a'.repeat(3000), hashtags: ['dakar', '#DAKAR', '#style', 'x', '#trop long'] }, { now: NOW });
  assert.equal(draft.caption.length, MAX_CAPTION_LENGTH);
  assert.deepEqual(draft.hashtags, ['#dakar', '#style']);
  assert.equal(normalizeHashtags(Array.from({ length: 50 }, (_, i) => `#tag${i}`)).length, 30);
});

test('apercu : legende finale exacte et blocages listes', () => {
  const preview = previewDraft(readyDraft());
  assert.ok(preview.caption.includes('Nouvelle collection'));
  assert.ok(preview.caption.includes('Commande via WhatsApp'));
  assert.ok(preview.caption.includes('#dakar #style'));
  assert.equal(preview.publishable, true);
  const broken = previewDraft(createDraft({ caption: '' }, { now: NOW }));
  assert.equal(broken.publishable, false);
  assert.ok(broken.blocking_errors.length > 0);
});

/* ---------------- Studio : SAFE, modification, programmation ---------------- */

test('modifier un contenu approuve retire l approbation SAFE', () => {
  const draft = approveDraft(createDraft({ caption: 'texte', media: goodMedia() }, { now: NOW }), { now: NOW });
  assert.equal(draft.safe_approved, true);
  const edited = saveDraft(draft, { caption: 'texte modifie' }, { now: NOW });
  assert.equal(edited.safe_approved, false, 'on n approuve pas un contenu puis on en change la legende');
});

test('un contenu publie ou en cours de publication n est plus modifiable', () => {
  const publishing = beginPublishing(OPEN_ENV, readyDraft(), { now: NOW, jobId: 'JOB1' });
  assert.throws(() => saveDraft(publishing, { caption: 'x' }, { now: NOW }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
  const published = markPublished(publishing, '178414_1', { now: NOW });
  assert.throws(() => saveDraft(published, { caption: 'x' }, { now: NOW }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
});

test('programmation dans le passe refusee', () => {
  const draft = readyDraft();
  assert.throws(() => scheduleDraft(draft, new Date(NOW - 1000).toISOString(), { now: NOW }), (e) => e.code === STUDIO_ERROR.SCHEDULE_IN_PAST);
  assert.throws(() => scheduleDraft(draft, 'pas une date', { now: NOW }), (e) => e.code === STUDIO_ERROR.VALIDATION_FAILED);
});

test('annulation de programmation : etat CANCELLED et date effacee', () => {
  const scheduled = scheduleDraft(readyDraft(), new Date(NOW + 7200000).toISOString(), { now: NOW });
  const cancelled = cancelSchedule(scheduled, { now: NOW });
  assert.equal(cancelled.state, STUDIO_STATE.CANCELLED);
  assert.equal(cancelled.scheduled_for, null);
});

/* ---------------- Studio : publication ---------------- */

test('publication refusee si le portail SAFE est ferme', () => {
  const draft = readyDraft();
  assert.throws(() => assertPublishable({}, draft), (e) => e.code === STUDIO_ERROR.SAFE_GATE_CLOSED);
  assert.throws(() => assertPublishable({ SOWHAT_PUBLISH_ENABLED: 'true' }, { ...draft, safe_approved: false }), (e) => e.code === STUDIO_ERROR.SAFE_GATE_CLOSED);
});

test('publication refusee depuis un etat qui ne le permet pas', () => {
  const draft = createDraft({ caption: 'x', media: goodMedia() }, { now: NOW });
  assert.throws(() => assertPublishable(OPEN_ENV, { ...draft, safe_approved: true }), (e) => e.code === STUDIO_ERROR.INVALID_TRANSITION);
});

test('PUBLISHED exige un identifiant Meta reel', () => {
  const publishing = beginPublishing(OPEN_ENV, readyDraft(), { now: NOW, jobId: 'JOB1' });
  assert.throws(() => markPublished(publishing, '', { now: NOW }), (e) => e.code === STUDIO_ERROR.VALIDATION_FAILED);
  assert.throws(() => markPublished(publishing, null, { now: NOW }), (e) => e.code === STUDIO_ERROR.VALIDATION_FAILED);
  const published = markPublished(publishing, '178414_99', { now: NOW });
  assert.equal(published.state, STUDIO_STATE.PUBLISHED);
  assert.equal(published.instagram_media_id, '178414_99');
});

test('echec : trace complete, puis reprise manuelle vers READY', () => {
  const publishing = beginPublishing(OPEN_ENV, readyDraft(), { now: NOW, jobId: 'JOB1', idempotencyKey: 'K1' });
  const failed = markFailed(publishing, { code: 'meta_rate_limited', detail: 'quota', stage: 'container' }, { now: NOW });
  assert.equal(failed.state, STUDIO_STATE.FAILED);
  assert.equal(failed.failure.code, 'meta_rate_limited');
  const retried = retryFailed(failed, { now: NOW });
  assert.equal(retried.state, STUDIO_STATE.READY);
  assert.equal(retried.idempotency_key, null, 'une reprise repart sur une nouvelle cle d idempotence');
});

/* ---------------- Persistance et file d attente ---------------- */

test('brouillon relu tel quel, cle R2 assainie', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const draft = readyDraft();
  await writeDraft(env, draft);
  assert.deepEqual(await readDraft(env, draft.draft_id), JSON.parse(JSON.stringify(draft)));
  assert.equal(await readDraft(env, 'inexistant'), null);
});

test('file d attente : seulement le programme et l en cours, trie par echeance', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  await writeDraft(env, scheduleDraft(readyDraft({ draft_id: 'DRAFT-A' }), new Date(NOW + 7200000).toISOString(), { now: NOW }));
  await writeDraft(env, scheduleDraft(readyDraft({ draft_id: 'DRAFT-B' }), new Date(NOW + 3600000).toISOString(), { now: NOW }));
  await writeDraft(env, readyDraft({ draft_id: 'DRAFT-C' }));
  const queue = await publicationQueue(env, { now: NOW + 5400000 });
  assert.equal(queue.length, 2);
  assert.equal(queue[0].draft_id, 'DRAFT-B');
  assert.equal(queue[0].due, true, 'la premiere echeance est depassee');
  assert.equal(queue[1].due, false);
});

/* ---------------- Prefill : le plan et le Coach nourrissent le Studio ---------------- */

const RECOMMENDATION = (overrides = {}) => ({
  id: 'RECO-1',
  mode: 'appliquer',
  dimension: 'format',
  value: 'REEL',
  metric: 'reach',
  conclusion: 'format = REEL est associe a une portee superieure de 32 % a la reference.',
  next_action: 'Augmenter la part de REEL dans le plan des sept prochains jours.',
  metrics: { delta_pct: 32 },
  sample_size: 11,
  confidence: 'moyenne',
  limits: ['Correlation observee, pas une relation de cause a effet demontree.'],
  ...overrides,
});

const BRIEFING = (recommendations) => ({
  kind: 'COACH_BRIEFING', status: 'ok', generated_at: '2026-07-01T00:00:00.000Z',
  recommendations,
});

test('prefill Coach : le brouillon nait en DRAFT, sans media et sans approbation', () => {
  const draft = prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION()]), 'RECO-1');
  assert.equal(draft.state, 'DRAFT');
  assert.equal(draft.safe_approved, false, 'une recommandation ne peut jamais approuver');
  assert.equal(draft.media, null, 'le visuel reste un choix humain');
  assert.equal(draft.format, 'REEL');
  assert.equal(draft.source.origin, 'coach_recommandation');
  assert.equal(draft.source.recommendation_id, 'RECO-1');
});

test('prefill Coach : chaque dimension alimente le bon champ', () => {
  const cases = [
    ['product', 'Ensemble Dakar', 'product'],
    ['collection', 'Wear the Culture', 'collection'],
    ['campaign', 'CDM 2026', 'campaign'],
    ['cta', 'Commandez en message prive', 'cta'],
    ['hook_type', 'question', 'hook'],
  ];
  for (const [dimension, value, field] of cases) {
    const draft = prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION({ dimension, value })]), 'RECO-1');
    assert.equal(draft[field], value, `${dimension} doit remplir ${field}`);
  }
  const tagged = prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION({ dimension: 'tag', value: 'dakarstyle' })]), 'RECO-1');
  assert.deepEqual(tagged.hashtags, ['#dakarstyle']);
});

test('prefill Coach : une recommandation negative ne prerempli pas ce qu elle deconseille', () => {
  const negative = RECOMMENDATION({
    dimension: 'format', value: 'IMAGE', metrics: { delta_pct: -28 },
    next_action: 'Reduire la part de IMAGE au profit d un format mieux note.',
  });
  const draft = prefillDraftFromRecommendation(BRIEFING([negative]), 'RECO-1');
  assert.equal(draft.format, 'IMAGE', 'le format par defaut reste celui du Studio');
  assert.equal(draft.source.direction, 'a_eviter');
  assert.ok(draft.angle.includes('Reduire'), 'l action conseillee est transmise telle quelle');
});

test('prefill Coach : la legende est une trame explicitement a reecrire', () => {
  const draft = prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION()]), 'RECO-1');
  assert.ok(draft.caption.includes('A REECRIRE'), 'aucune legende n est presentee comme prete');
  assert.ok(draft.caption.includes(RECOMMENDATION().next_action));
});

test('prefill Coach : recommandation absente ou briefing vide refuses', () => {
  assert.throws(
    () => prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION()]), 'RECO-INEXISTANTE'),
    (error) => error.code === 'coach_recommendation_not_found',
  );
  assert.throws(
    () => prefillDraftFromRecommendation({ recommendations: [] }, null),
    (error) => error.code === 'coach_recommendation_not_found',
  );
});

test('prefill Coach : le creneau conseille reste une suggestion, jamais une programmation', () => {
  const draft = prefillDraftFromRecommendation(
    BRIEFING([RECOMMENDATION({ dimension: 'hour_slot', value: '19h' })]), 'RECO-1',
  );
  assert.equal(draft.scheduled_for, null, 'programmer reste un geste explicite');
  assert.deepEqual(draft.source.suggested_slot, { dimension: 'hour_slot', value: '19h' });
});

test('prefill Plan et prefill Coach produisent des brouillons de meme nature', () => {
  const plan = {
    generated_at: '2026-07-01T00:00:00.000Z',
    days: [{
      day_index: 1, date: '2026-07-02', time: '19:00', format: 'REEL',
      caption_draft: 'Trame du jour', hashtags: ['#dakarstyle'], cta: 'Commandez',
      product: 'Ensemble', collection: null, objective: 'notoriete', angle: 'angle', hook: 'accroche',
      confidence: 'faible', justification: {},
    }],
  };
  const fromPlan = prefillDraftFromPlanDay(plan, 1);
  const fromCoach = prefillDraftFromRecommendation(BRIEFING([RECOMMENDATION()]), 'RECO-1');
  for (const draft of [fromPlan, fromCoach]) {
    assert.equal(draft.state, 'DRAFT');
    assert.equal(draft.safe_approved, false);
    assert.equal(draft.media, null);
    assert.equal(draft.instagram_media_id, null);
  }
});

/* ---------------- Secret CSRF : configure ou amorce ---------------- */

test('secret configure : utilise tel quel, sans rien ecrire dans le stockage', async () => {
  const bucket = new Bucket();
  const env = { SOCIAL_INTELLIGENCE_CSRF_SECRET: SECRET, VISUALS_BUCKET: bucket };
  assert.equal(await resolveCsrfSecret(env), SECRET);
  assert.equal(bucket.puts, 0, 'un secret configure n a pas besoin d etre amorce');
  assert.equal(bucket.s.has(CSRF_SECRET_KEY), false);
});

test('secret absent : un secret aleatoire est amorce une fois dans le stockage', async () => {
  const bucket = new Bucket();
  const env = { VISUALS_BUCKET: bucket };
  const secret = await resolveCsrfSecret(env);
  assert.ok(secret.length >= 32, 'le secret amorce doit etre assez long');
  assert.equal(bucket.json(CSRF_SECRET_KEY).secret, secret);
  // Le chemin est prive : il ne tombe pas sous le prefixe des medias publics.
  assert.equal(CSRF_SECRET_KEY.startsWith(MEDIA_KEY_PREFIX), false);

  // Le jeton emis avec ce secret est verifiable : la barriere fonctionne.
  const token = await issueCsrfToken(env, 'session:abc', NOW);
  assert.equal((await verifyCsrfToken(env, 'session:abc', token, NOW)).valid, true);
});

test('secret amorce : reutilise, jamais regenere', async () => {
  const bucket = new Bucket();
  const first = await resolveCsrfSecret({ VISUALS_BUCKET: bucket });
  // Un autre env, meme bucket : le secret doit venir du stockage, pas d un tirage.
  const second = await resolveCsrfSecret({ VISUALS_BUCKET: bucket });
  assert.equal(second, first);

  // Un jeton emis avant reste valide apres : le secret n a pas bouge.
  const token = await issueCsrfToken({ VISUALS_BUCKET: bucket }, 'session:abc', NOW);
  assert.equal((await verifyCsrfToken({ VISUALS_BUCKET: bucket }, 'session:abc', token, NOW)).valid, true);
  assert.equal(bucket.puts, 1, 'une seule ecriture, quel que soit le nombre d appels');
});

test('deux amorcages simultanes convergent vers le meme secret', async () => {
  const bucket = new Bucket();
  // Deux env distincts : le cache memoire ne peut pas masquer la course.
  const [a, b] = await Promise.all([
    resolveCsrfSecret({ VISUALS_BUCKET: bucket }),
    resolveCsrfSecret({ VISUALS_BUCKET: bucket }),
  ]);
  assert.equal(a, b, 'le perdant de la course adopte le secret du gagnant');
  assert.equal(bucket.json(CSRF_SECRET_KEY).secret, a);
});

test('un jeton amorce ne vaut que pour sa session', async () => {
  const bucket = new Bucket();
  const env = { VISUALS_BUCKET: bucket };
  const token = await issueCsrfToken(env, 'session:legitime', NOW);
  assert.equal((await verifyCsrfToken(env, 'session:autre', token, NOW)).valid, false);
  assert.equal((await verifyCsrfToken(env, 'session:autre', token, NOW)).code, SECURITY_ERROR.CSRF_INVALID);
});

test('un jeton amorce expire comme les autres', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const token = await issueCsrfToken(env, 'session:abc', NOW);
  const late = await verifyCsrfToken(env, 'session:abc', token, NOW + 3 * 60 * 60 * 1000);
  assert.equal(late.valid, false);
  assert.equal(late.code, SECURITY_ERROR.CSRF_EXPIRED);
});

test('sans stockage : refus net, aucun secret improvise', async () => {
  for (const env of [{}, { VISUALS_BUCKET: null }, { VISUALS_BUCKET: {} }]) {
    await assert.rejects(
      () => resolveCsrfSecret(env),
      (error) => error.code === SECURITY_ERROR.CSRF_NOT_CONFIGURED,
    );
    await assert.rejects(
      () => issueCsrfToken(env, 'session:abc', NOW),
      (error) => error.code === SECURITY_ERROR.CSRF_NOT_CONFIGURED,
    );
    const check = await verifyCsrfToken(env, 'session:abc', 'x.y', NOW);
    assert.equal(check.valid, false);
    assert.equal(check.code, SECURITY_ERROR.CSRF_NOT_CONFIGURED);
  }
});

test('stockage qui n ecrit rien : refus plutot qu un secret volatil', async () => {
  const bucket = { async get() { return null; }, async put() { return { key: 'x' }; } };
  await assert.rejects(
    () => resolveCsrfSecret({ VISUALS_BUCKET: bucket }),
    (error) => error.code === SECURITY_ERROR.CSRF_NOT_CONFIGURED,
  );
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 studio: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
