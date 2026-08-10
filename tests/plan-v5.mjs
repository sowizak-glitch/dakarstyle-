/**
 * SOWHAT Control V5 - Tests du plan 7 jours et du prefill Studio.
 *
 * Donnees de test explicitement isolees : aucun appel Instagram, aucun media
 * reel, aucun credential. Le chemin complet plan -> Studio -> programmation est
 * verifie de bout en bout sur un bucket en memoire.
 */

import assert from 'node:assert/strict';
import { CONFIDENCE, buildContentMemory } from '../src/content-memory-v5.js';
import { buildCoachBriefing } from '../src/coach-v5.js';
import {
  PLAN_DAYS, bestValueFor, buildSevenDayPlan, hourFromSlot, plannedInstant,
  prefillDraftFromPlanDay, rankedFormats, readPlan, writePlan,
} from '../src/plan-v5.js';
import {
  STUDIO_STATE, approveDraft, markReady, saveDraft, scheduleDraft, validateDraft, writeDraft,
} from '../src/studio-v5.js';
import { MEDIA_KEY_PREFIX } from '../src/security-v5.js';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

class Bucket {
  constructor() { this.s = new Map(); }
  async get(k) { return this.s.has(k) ? { text: async () => this.s.get(k) } : null; }
  async put(k, v, o = {}) {
    if (o?.onlyIf?.etagDoesNotMatch === '*' && this.s.has(k)) return null;
    this.s.set(k, String(v)); return { key: k };
  }
  json(k) { const r = this.s.get(k); return r ? JSON.parse(r) : null; }
}

const NOW = Date.parse('2026-07-01T09:00:00.000Z');
const DAY = 86400000;

/** Corpus de test isole : des Reels du soir, sur la collection bazin, surperforment. */
function testCorpus() {
  const winners = Array.from({ length: 10 }, (_, i) => ({
    instagram_media_id: `W${i}`,
    media_type: 'VIDEO',
    format: 'REEL',
    // 19h00 a Dakar = creneau 18-21
    published_at: new Date(Date.parse('2026-06-20T19:00:00.000Z') - i * DAY).toISOString(),
    caption: 'Decouvre la collection bazin. Commande via WhatsApp. #bazin #dakar',
    hook: 'Decouvre la collection bazin',
    collection: 'bazin',
    product: 'boubou',
    cta: null,
    reach: 3000 + i * 20,
    likes: 200, comments: 20, shares: 30, saves: 60,
    interactions: 250,
    engagement_rate: 0.083,
  }));
  const others = Array.from({ length: 10 }, (_, i) => ({
    instagram_media_id: `O${i}`,
    media_type: 'IMAGE',
    format: 'IMAGE',
    // 09h00 a Dakar = creneau 09-12
    published_at: new Date(Date.parse('2026-06-10T09:00:00.000Z') - i * DAY).toISOString(),
    caption: 'Photo du jour.',
    hook: 'Photo du jour',
    collection: null, product: null, cta: null,
    reach: 900 + i * 10,
    likes: 30, comments: 2, shares: 2, saves: 4,
    interactions: 34,
    engagement_rate: 0.037,
  }));
  return [...winners, ...others];
}

const richMemory = () => buildContentMemory(testCorpus(), { now: NOW });
const emptyMemory = () => buildContentMemory([], { now: NOW });

/* ---------------- Selection fondee sur les donnees ---------------- */

test('la meilleure valeur d une dimension vient d une correlation reelle', () => {
  const memory = richMemory();
  const format = bestValueFor(memory, 'format');
  assert.ok(format, 'un format surperformant doit ressortir');
  assert.equal(format.value, 'REEL');
  assert.ok(format.delta_pct > 0);
  assert.ok(format.sample_size >= 3);
  const source = memory.correlations.find((c) => c.dimension === 'format' && c.value === 'REEL' && c.metric === format.metric);
  assert.equal(format.delta_pct, source.delta_pct, 'aucun chiffre recalcule');
});

test('aucune correlation : aucune valeur choisie, pas de defaut deguise', () => {
  assert.equal(bestValueFor(emptyMemory(), 'format'), null);
  assert.equal(bestValueFor(emptyMemory(), 'hour_slot'), null);
  assert.equal(bestValueFor(null, 'cta'), null);
});

test('heure derivee d un creneau observe, jamais inventee', () => {
  assert.equal(hourFromSlot('18-21'), 19);
  assert.equal(hourFromSlot('09-12'), 10);
  assert.equal(hourFromSlot(null), null);
  assert.equal(hourFromSlot('n importe quoi'), null);
});

test('formats classes par evidence, rotation neutre en secours', () => {
  assert.equal(rankedFormats(richMemory()).ranked[0], 'REEL');
  const empty = rankedFormats(emptyMemory());
  assert.deepEqual(empty.ranked, []);
  assert.ok(empty.pool.length >= 3, 'une rotation neutre reste disponible');
});

/* ---------------- Structure du plan ---------------- */

test('le plan couvre sept jours consecutifs avec tous les champs exiges', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  assert.equal(plan.days.length, PLAN_DAYS);
  for (const day of plan.days) {
    for (const field of ['format', 'time', 'objective', 'hook', 'angle', 'cta', 'caption_draft', 'hashtags', 'justification', 'confidence']) {
      assert.ok(field in day, `champ manquant : ${field}`);
    }
    assert.ok(day.weekday, 'jour de la semaine manquant');
    assert.equal(day.needs_human_edit, true);
    assert.ok(Array.isArray(day.justification.statements) && day.justification.statements.length > 0);
  }
  const dates = plan.days.map((d) => d.date);
  assert.equal(new Set(dates).size, PLAN_DAYS, 'sept dates distinctes');
});

test('le plan reprend les creneaux et formats reellement observes', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  assert.equal(plan.status, 'ok');
  assert.equal(plan.evidence.format, 'REEL');
  assert.equal(plan.evidence.hour_slot, '18-21');
  assert.equal(plan.days[0].time, '19:00');
  assert.equal(plan.days[0].format, 'REEL');
  assert.equal(plan.evidence.collection, 'bazin');
});

test('chaque justification cite une correlation mesuree, avec sa confiance', () => {
  const memory = richMemory();
  const plan = buildSevenDayPlan(memory, { now: NOW });
  const known = new Set(memory.correlations.map((c) => c.statement));
  for (const day of plan.days) {
    assert.ok(Object.values(CONFIDENCE).includes(day.confidence));
    if (day.justification.basis === 'correlations_observees') {
      for (const statement of day.justification.statements) {
        assert.ok(known.has(statement), `justification non tracable : ${statement}`);
      }
      assert.ok(day.justification.sample_size > 0);
    }
  }
});

test('aucune donnee : rotation neutre annoncee comme telle, aucun chiffre avance', () => {
  const plan = buildSevenDayPlan(emptyMemory(), { now: NOW });
  assert.equal(plan.status, 'no_evidence');
  assert.equal(plan.evidence.correlations_used, 0);
  for (const day of plan.days) {
    assert.equal(day.confidence, CONFIDENCE.NONE);
    assert.equal(day.justification.basis, 'aucune_donnee');
    assert.equal(day.justification.sample_size, 0);
    assert.equal(day.time, null, 'sans creneau observe, aucune heure inventee');
    assert.equal(day.product, null);
    assert.ok(!/\d+ %/.test(day.justification.statements.join(' ')), 'aucun pourcentage invente');
  }
  assert.ok(plan.limits.some((l) => /rotation neutre/.test(l)));
});

test('le plan cite le titre du Coach sans le reecrire', () => {
  const memory = richMemory();
  const briefing = buildCoachBriefing(memory);
  const plan = buildSevenDayPlan(memory, { now: NOW, briefing });
  assert.equal(plan.coach_headline, briefing.headline);
  assert.equal(buildSevenDayPlan(memory, { now: NOW }).coach_headline, null);
});

test('deterministe : deux constructions identiques donnent le meme plan', () => {
  const memory = richMemory();
  assert.deepEqual(buildSevenDayPlan(memory, { now: NOW }), buildSevenDayPlan(memory, { now: NOW }));
});

/* ---------------- Prefill du Studio ---------------- */

test('creer a partir de ce jour : le Studio est reellement prerempli', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  const day = plan.days[0];
  const draft = prefillDraftFromPlanDay(plan, 1, { now: NOW });
  assert.equal(draft.format, day.format);
  assert.equal(draft.caption, day.caption_draft);
  assert.deepEqual(draft.hashtags, day.hashtags);
  assert.equal(draft.product, day.product);
  assert.equal(draft.collection, day.collection);
  assert.equal(draft.objective, day.objective);
  assert.equal(draft.hook, day.hook);
  assert.equal(draft.source.origin, 'plan_7_jours');
  assert.equal(draft.source.day_index, 1);
  assert.equal(draft.source.planned_date, day.date);
});

test('un jour inexistant est refuse', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  assert.throws(() => prefillDraftFromPlanDay(plan, 99), (e) => e.code === 'plan_day_not_found');
  assert.throws(() => prefillDraftFromPlanDay(null, 1), (e) => e.code === 'plan_day_not_found');
});

test('un plan ne peut jamais declencher une publication tout seul', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  const draft = prefillDraftFromPlanDay(plan, 2, { now: NOW });
  assert.equal(draft.state, STUDIO_STATE.DRAFT);
  assert.equal(draft.safe_approved, false);
  assert.equal(draft.media, null, 'aucun visuel choisi automatiquement');
  const validation = validateDraft(draft);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((e) => /media absent/.test(e)));
});

/* ---------------- Chemin complet, sans Instagram ---------------- */

test('bout en bout : plan -> brouillon -> media -> approbation -> programmation', async () => {
  const env = { VISUALS_BUCKET: new Bucket() };
  const memory = richMemory();
  const plan = buildSevenDayPlan(memory, { now: NOW });
  await writePlan(env, plan);
  assert.deepEqual(await readPlan(env), JSON.parse(JSON.stringify(plan)));

  const day = plan.days[0];
  let draft = prefillDraftFromPlanDay(plan, day.day_index, { now: NOW });

  // Le visuel reste un geste humain : on l ajoute explicitement.
  draft = saveDraft(draft, {
    format: 'REEL',
    media: {
      r2_key: `${MEDIA_KEY_PREFIX}2026/07/test-isole.mp4`,
      content_type: 'video/mp4',
      size_bytes: 4 * 1024 * 1024,
      filename: 'test-isole.mp4',
    },
  }, { now: NOW });
  assert.equal(validateDraft(draft).valid, true);

  draft = markReady(approveDraft(draft, { now: NOW, approvedBy: 'test' }), { now: NOW });
  assert.equal(draft.state, STUDIO_STATE.READY);
  assert.equal(draft.safe_approved, true);

  const instant = plannedInstant(day);
  assert.ok(instant, 'le jour du plan porte une date et une heure exploitables');
  draft = scheduleDraft(draft, instant, { now: NOW });
  assert.equal(draft.state, STUDIO_STATE.SCHEDULED);
  assert.equal(draft.scheduled_for, instant);

  await writeDraft(env, draft);
  const stored = env.VISUALS_BUCKET.json(`visuals/social-intelligence/v5/drafts/${draft.draft_id}.json`);
  assert.equal(stored.state, STUDIO_STATE.SCHEDULED);
  assert.equal(stored.source.origin, 'plan_7_jours');
  assert.equal(stored.instagram_media_id, null, 'rien n a ete publie : aucun identifiant Meta');
});

test('la date planifiee est exploitable, ou explicitement absente', () => {
  const plan = buildSevenDayPlan(richMemory(), { now: NOW });
  assert.ok(plannedInstant(plan.days[0]).startsWith(plan.days[0].date));
  const blind = buildSevenDayPlan(emptyMemory(), { now: NOW });
  assert.equal(plannedInstant(blind.days[0]), null, 'sans heure observee, aucune date de publication fabriquee');
});

/* ---------------- Execution ---------------- */

let failures = 0;
for (const { name, fn } of cases) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL  ${name}\n        ${error.message}`); }
}
console.log(`\nSOWHAT V5 plan: ${failures ? `FAIL (${failures})` : `PASS (${cases.length} scenarios)`}`);
if (failures) process.exit(1);
