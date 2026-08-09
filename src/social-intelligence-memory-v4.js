/**
 * SOWHAT Control - Content Memory (V4)
 *
 * Memoire cumulative du contenu. Contrairement aux classements recalcules a
 * chaque synchronisation, cette memoire agrege l'apprentissage dans la duree :
 * formats, collections, hooks, creneaux de publication.
 *
 * Regle absolue : cette memoire n'invente jamais de statistique. Elle
 * n'enregistre que des observations reelles. Tant qu'aucune observation
 * n'existe, la memoire reste vide et le cockpit le dit explicitement.
 */

export const MEMORY_KEY = 'visuals/social-intelligence/memory.json';
export const MEMORY_VERSION = '4.0.0';

const MAX_ENTRIES_PER_DIMENSION = 40;
const MAX_HOOKS = 30;
const TIMEZONE = 'Africa/Dakar';
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;


export function emptyMemory() {
  return {
    version: MEMORY_VERSION,
    created_at: null,
    updated_at: null,
    observation_count: 0,
    formats: {},
    collections: {},
    hooks: [],
    hours: {},
    weekdays: {},
  };
}

export function normalizeMemory(value) {
  if (!value || typeof value !== 'object') return emptyMemory();
  return {
    ...emptyMemory(),
    ...value,
    formats: isPlainObject(value.formats) ? value.formats : {},
    collections: isPlainObject(value.collections) ? value.collections : {},
    hours: isPlainObject(value.hours) ? value.hours : {},
    weekdays: isPlainObject(value.weekdays) ? value.weekdays : {},
    hooks: Array.isArray(value.hooks) ? value.hooks : [],
    observation_count: toCount(value.observation_count),
  };
}

/**
 * Enregistre une observation mesuree : un contenu Instagram accompagne de ses
 * vraies metriques. `score` doit provenir du moteur de scoring, jamais d'une
 * estimation produite par l'interface.
 */
export function rememberMeasuredContent(memoryValue, observation) {
  const memory = normalizeMemory(memoryValue);
  const format = cleanKey(observation?.format, 40);
  if (!format) return memory;
  const score = toScore(observation?.score);

  memory.formats[format] = accumulate(memory.formats[format], score);

  const collection = cleanKey(observation?.collection, 60);
  if (collection) memory.collections[collection] = accumulate(memory.collections[collection], score);

  const timestamp = Date.parse(String(observation?.published_at || ''));
  if (Number.isFinite(timestamp)) {
    const slot = dakarSlot(timestamp);
    if (slot.hour !== null) memory.hours[slot.hour] = accumulate(memory.hours[slot.hour], score);
    if (slot.weekday) memory.weekdays[slot.weekday] = accumulate(memory.weekdays[slot.weekday], score);
  }

  const hook = cleanKey(observation?.hook, 130);
  if (hook) rememberHook(memory, hook, format, score);

  memory.observation_count += 1;
  memory.created_at = memory.created_at || new Date().toISOString();
  memory.updated_at = new Date().toISOString();
  return prune(memory);
}

function rememberHook(memory, hook, format, score) {
  const existing = memory.hooks.find((row) => row.hook === hook);
  if (existing) {
    existing.n = toCount(existing.n) + 1;
    existing.total_score = toCount(existing.total_score) + score;
    existing.avg_score = round1(existing.total_score / existing.n);
    existing.last_seen_at = new Date().toISOString();
  } else {
    memory.hooks.push({
      hook,
      format,
      n: 1,
      total_score: score,
      avg_score: round1(score),
      last_seen_at: new Date().toISOString(),
    });
  }
  memory.hooks.sort((a, b) => b.avg_score - a.avg_score || b.n - a.n);
  memory.hooks = memory.hooks.slice(0, MAX_HOOKS);
}

/**
 * Enregistre une publication reellement emise. Aucune metrique n'existe a cet
 * instant : on memorise uniquement le fait qu'elle a eu lieu. Le score restera
 * absent tant qu'Instagram n'aura pas renvoye de donnees reelles.
 */
export function rememberPublication(memoryValue, publication) {
  const memory = normalizeMemory(memoryValue);
  const format = cleanKey(publication?.publication_type, 40);
  if (!format) return memory;

  const entry = memory.formats[format] || accumulate(undefined, null);
  entry.published = toCount(entry.published) + 1;
  memory.formats[format] = entry;

  const collection = cleanKey(publication?.collection, 60);
  if (collection) {
    const row = memory.collections[collection] || accumulate(undefined, null);
    row.published = toCount(row.published) + 1;
    memory.collections[collection] = row;
  }

  memory.created_at = memory.created_at || new Date().toISOString();
  memory.updated_at = new Date().toISOString();
  return prune(memory);
}

/**
 * Restitue la memoire sous une forme directement affichable, sans jamais
 * produire de moyenne a partir de zero observation mesuree.
 */
export function summarizeMemory(memoryValue) {
  const memory = normalizeMemory(memoryValue);
  return {
    has_measured_data: measuredTotal(memory) > 0,
    observation_count: memory.observation_count,
    updated_at: memory.updated_at,
    best_formats: rank(memory.formats).slice(0, 5),
    best_collections: rank(memory.collections).slice(0, 5),
    best_hooks: memory.hooks.filter((row) => toCount(row.n) > 0).slice(0, 5),
    best_hours: rank(memory.hours).slice(0, 3).map((row) => ({
      ...row,
      label: `${String(row.key).padStart(2, '0')}h ${TIMEZONE}`,
    })),
    best_weekdays: rank(memory.weekdays).slice(0, 3),
  };
}

function measuredTotal(memory) {
  return Object.values(memory.formats).reduce((total, row) => total + toCount(row?.n), 0);
}

function rank(dimension) {
  return Object.entries(dimension)
    .map(([key, row]) => ({
      key,
      n: toCount(row?.n),
      published: toCount(row?.published),
      avg_score: toCount(row?.n) > 0 ? round1(toCount(row?.total_score) / toCount(row?.n)) : null,
    }))
    .filter((row) => row.n > 0 || row.published > 0)
    .sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1) || b.n - a.n || b.published - a.published);
}

function accumulate(current, score) {
  const row = current && typeof current === 'object'
    ? { ...current }
    : { n: 0, total_score: 0, published: 0 };
  row.n = toCount(row.n);
  row.total_score = toCount(row.total_score);
  row.published = toCount(row.published);
  if (score !== null && score !== undefined) {
    row.n += 1;
    row.total_score += toScore(score);
  }
  row.avg_score = row.n > 0 ? round1(row.total_score / row.n) : null;
  return row;
}

function prune(memory) {
  memory.formats = capDimension(memory.formats, MAX_ENTRIES_PER_DIMENSION);
  memory.collections = capDimension(memory.collections, MAX_ENTRIES_PER_DIMENSION);
  return memory;
}

function capDimension(dimension, max) {
  const entries = Object.entries(dimension);
  if (entries.length <= max) return dimension;
  entries.sort((a, b) => weight(b[1]) - weight(a[1]));
  return Object.fromEntries(entries.slice(0, max));
}

function weight(row) {
  return toCount(row?.n) + toCount(row?.published);
}

function dakarSlot(timestamp) {
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: TIMEZONE, hour: '2-digit', hour12: false, weekday: 'long',
    }).formatToParts(new Date(timestamp));
    const hour = parts.find((part) => part.type === 'hour')?.value ?? null;
    const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
    return { hour: hour === null ? null : String(Number(hour)), weekday };
  } catch {
    return { hour: null, weekday: '' };
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function cleanKey(value, max) {
  return String(value ?? '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
function toScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
