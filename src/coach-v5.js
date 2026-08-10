/**
 * SOWHAT Control V5 - Coach analytique
 *
 * Le Coach ne produit jamais de conseil sorti de nulle part. Chaque
 * recommandation est adossee a une correlation deja etablie par la Content
 * Memory, et porte obligatoirement :
 *
 *   conclusion, preuves, metriques, sample_size, confidence, prochaine action,
 *   limites de l analyse.
 *
 * Tous les chiffres cites proviennent des correlations. Le Coach ne calcule
 * aucune metrique lui-meme et n en invente aucune. Quand les donnees ne
 * suffisent pas, il le dit et propose de collecter, pas de deviner.
 */

import { CONFIDENCE, INSIGHT_KIND } from './content-memory-v5.js';

/** Une correlation faible ne donne pas un ordre, elle donne un test. */
export const RECOMMENDATION_MODE = Object.freeze({
  APPLY: 'appliquer',
  EXPERIMENT: 'tester',
});

export const MAX_RECOMMENDATIONS = 6;

const CONFIDENCE_ORDER = {
  [CONFIDENCE.HIGH]: 3,
  [CONFIDENCE.MEDIUM]: 2,
  [CONFIDENCE.LOW]: 1,
  [CONFIDENCE.NONE]: 0,
};

const METRIC_LABEL = {
  reach: 'portee',
  engagement_rate: 'taux d engagement',
  saves_shares_rate: 'taux de sauvegardes et partages',
  score: 'score Sowhat',
};

/**
 * Action concrete par dimension. Le `{value}` est toujours une valeur
 * reellement observee, jamais une suggestion inventee.
 */
const ACTION_TEMPLATES = {
  hour_slot: {
    positive: 'Programmer les prochaines publications sur le creneau {value} (heure de Dakar).',
    negative: 'Eviter le creneau {value} pour les prochaines publications et redeployer ces creations sur un creneau mieux note.',
  },
  weekday: {
    positive: 'Placer la publication principale de la semaine le {value}.',
    negative: 'Ne pas reserver les contenus importants au {value}.',
  },
  format: {
    positive: 'Augmenter la part de {value} dans le plan des sept prochains jours.',
    negative: 'Reduire la part de {value} au profit d un format mieux note.',
  },
  media_type: {
    positive: 'Privilegier le type {value} sur les prochains contenus.',
    negative: 'Limiter le type {value} tant que l ecart persiste.',
  },
  product: {
    positive: 'Remettre le produit {value} en avant dans le plan editorial.',
    negative: 'Retravailler l angle utilise pour {value} avant d y consacrer un nouveau creneau.',
  },
  collection: {
    positive: 'Poursuivre la collection {value} avec un nouveau contenu comparable.',
    negative: 'Revoir la presentation de la collection {value} avant de la reprogrammer.',
  },
  campaign: {
    positive: 'Prolonger la campagne {value} sur la periode suivante.',
    negative: 'Arreter d investir des creneaux sur la campagne {value} sans changement d angle.',
  },
  hook_type: {
    positive: 'Ouvrir les prochaines legendes par une accroche de type {value}.',
    negative: 'Changer d accroche : le type {value} est en retrait sur cette fenetre.',
  },
  cta: {
    positive: 'Reprendre l appel a l action {value} sur les prochains contenus.',
    negative: 'Remplacer l appel a l action {value} par celui qui performe le mieux.',
  },
  caption_length: {
    positive: 'Ecrire des legendes de longueur {value} pour les prochains contenus.',
    negative: 'Eviter les legendes de longueur {value} sur cette categorie de contenu.',
  },
  tag: {
    positive: 'Conserver le hashtag {value} dans la selection de tags.',
    negative: 'Retirer le hashtag {value} de la selection courante.',
  },
};

function actionFor(dimension, value, positive) {
  const template = ACTION_TEMPLATES[dimension];
  if (!template) {
    return positive
      ? `Reproduire la configuration ${dimension} = ${value} sur les prochains contenus.`
      : `Eviter la configuration ${dimension} = ${value} sur les prochains contenus.`;
  }
  return (positive ? template.positive : template.negative).replace('{value}', value);
}

/* ------------------------------------------------------------------ */
/* Limites : toujours explicites                                       */
/* ------------------------------------------------------------------ */

function limitsFor(correlation, memory) {
  const limits = [
    'Correlation observee, pas une relation de cause a effet demontree.',
    `Mesure limitee a la fenetre de ${correlation.comparison_window.days} jours, du ${correlation.comparison_window.start.slice(0, 10)} au ${correlation.comparison_window.end.slice(0, 10)}.`,
    `Conclusion tiree de ${correlation.sample_size} contenu(s) comparable(s).`,
  ];
  if (correlation.confidence === CONFIDENCE.LOW) {
    limits.push('Signal faible : a traiter comme une hypothese a tester, pas comme un acquis.');
  }
  if (correlation.sample_size < 8) {
    limits.push('Echantillon reduit : un seul contenu atypique peut deplacer la mediane.');
  }
  const inWindow = memory?.corpus?.in_window ?? 0;
  const withReach = memory?.corpus?.with_reach ?? 0;
  if (inWindow > 0 && withReach < inWindow) {
    limits.push(`Donnees partielles : ${inWindow - withReach} contenu(s) de la fenetre sans metrique de portee, exclus des calculs.`);
  }
  return limits;
}

/* ------------------------------------------------------------------ */
/* Recommandations                                                     */
/* ------------------------------------------------------------------ */

function toRecommendation(correlation, memory, index) {
  const positive = correlation.delta_pct >= 0;
  const metricLabel = METRIC_LABEL[correlation.metric] || correlation.metric;
  const mode = correlation.confidence === CONFIDENCE.LOW
    ? RECOMMENDATION_MODE.EXPERIMENT
    : RECOMMENDATION_MODE.APPLY;

  const conclusion = mode === RECOMMENDATION_MODE.EXPERIMENT
    ? `Piste a tester : ${correlation.dimension} = ${correlation.value} semble associe a une ${metricLabel} ${positive ? 'superieure' : 'inferieure'} de ${Math.abs(correlation.delta_pct)} %, sur un signal encore faible.`
    : `${correlation.dimension} = ${correlation.value} est associe a une ${metricLabel} ${positive ? 'superieure' : 'inferieure'} de ${Math.abs(correlation.delta_pct)} % a la reference.`;

  return {
    kind: INSIGHT_KIND.RECOMMENDATION,
    id: `RECO-${index + 1}`,
    mode,
    dimension: correlation.dimension,
    value: correlation.value,
    metric: correlation.metric,
    conclusion,
    evidence: [
      correlation.statement,
      `Reference de comparaison : ${metricLabel} mediane ${correlation.baseline} sur l ensemble de la fenetre.`,
      `Regularite : ${Math.round((correlation.share_above_baseline ?? 0) * 100)} % des contenus de ce groupe sont au-dessus de la reference.`,
    ],
    metrics: {
      metric: correlation.metric,
      group_median: correlation.median,
      baseline: correlation.baseline,
      delta_pct: correlation.delta_pct,
      share_above_baseline: correlation.share_above_baseline,
    },
    sample_size: correlation.sample_size,
    confidence: correlation.confidence,
    comparison_window: correlation.comparison_window,
    next_action: actionFor(correlation.dimension, correlation.value, positive),
    limits: limitsFor(correlation, memory),
  };
}

/**
 * Une seule recommandation par couple (dimension, valeur) : celle portee par la
 * correlation la plus solide. Repeter la meme observation sous quatre metriques
 * differentes donnerait une fausse impression d accumulation de preuves.
 */
function selectCorrelations(correlations, limit) {
  const best = new Map();
  for (const correlation of correlations) {
    if (CONFIDENCE_ORDER[correlation.confidence] === 0) continue;
    const key = `${correlation.dimension}:${correlation.value}`;
    const current = best.get(key);
    const better = !current
      || CONFIDENCE_ORDER[correlation.confidence] > CONFIDENCE_ORDER[current.confidence]
      || (CONFIDENCE_ORDER[correlation.confidence] === CONFIDENCE_ORDER[current.confidence]
        && Math.abs(correlation.delta_pct) > Math.abs(current.delta_pct));
    if (better) best.set(key, correlation);
  }
  return [...best.values()]
    .sort((a, b) => (CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence])
      || (Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
      || `${a.dimension}:${a.value}`.localeCompare(`${b.dimension}:${b.value}`))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Repli quand les donnees ne suffisent pas                            */
/* ------------------------------------------------------------------ */

/**
 * Repli honnete : aucune recommandation fabriquee, mais des actions de collecte
 * concretes et l etat exact de ce qui manque. Un coach qui n a pas de donnees
 * doit le dire, pas meubler.
 */
export function insufficientDataBriefing(memory, reasons) {
  const corpus = memory?.corpus || { in_window: 0, with_reach: 0, total_records: 0 };
  const actions = [];
  if (corpus.in_window < 6) {
    actions.push('Publier et synchroniser davantage de contenus : une comparaison demande au moins trois contenus comparables par groupe.');
  }
  if (corpus.in_window > 0 && corpus.with_reach < corpus.in_window) {
    actions.push('Verifier les permissions Insights : des contenus de la fenetre n ont aucune metrique de portee.');
  }
  const unlabeled = memory?.unlabeled || {};
  for (const dimension of ['product', 'collection', 'campaign']) {
    if ((unlabeled[dimension] ?? 0) > 0 && corpus.in_window > 0 && unlabeled[dimension] === corpus.in_window) {
      actions.push(`Annoter la dimension ${dimension} : aucun contenu de la fenetre ne la renseigne, elle ne peut donc rien apprendre.`);
    }
  }
  // Quand la raison du repli est l absence d ecart significatif, on le dit
  // explicitement : ce n est pas un manque de donnees, c est un corpus plat.
  const flatCorpus = (reasons || []).some((reason) => /bruit|assez solide/.test(String(reason)));
  if (flatCorpus || !actions.length) {
    actions.unshift('Continuer a publier et faire varier les parametres : les ecarts observes restent dans le bruit statistique sur cette fenetre.');
  }

  return {
    kind: 'COACH_BRIEFING',
    status: 'insufficient_data',
    generated_at: new Date().toISOString(),
    comparison_window: memory?.comparison_window || null,
    sample: {
      contents_in_window: corpus.in_window,
      contents_with_reach: corpus.with_reach,
    },
    recommendations: [],
    reasons,
    next_actions: actions,
    limits: [
      'Aucune recommandation produite : les donnees disponibles ne permettent aucune conclusion fiable.',
      'Aucun chiffre n est estime ni extrapole en l absence de mesure.',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Briefing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Construit le briefing du Coach a partir de la memoire.
 * `scoreSummary` est optionnel : c'est l agregat produit par le moteur de
 * score, cite tel quel, jamais recalcule ici.
 */
export function buildCoachBriefing(memory, options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : MAX_RECOMMENDATIONS;
  const correlations = Array.isArray(memory?.correlations) ? memory.correlations : [];
  const corpus = memory?.corpus || { in_window: 0, with_reach: 0, total_records: 0 };

  const reasons = [];
  if (!memory) reasons.push('memoire de contenu absente');
  else if (corpus.in_window === 0) reasons.push('aucun contenu dans la fenetre de comparaison');
  else if (!correlations.length) reasons.push('aucun ecart au-dessus du seuil de bruit sur cette fenetre');

  if (reasons.length) return insufficientDataBriefing(memory, reasons);

  const selected = selectCorrelations(correlations, limit);
  if (!selected.length) {
    return insufficientDataBriefing(memory, ['aucune correlation assez solide pour fonder une recommandation']);
  }

  const recommendations = selected.map((correlation, index) => toRecommendation(correlation, memory, index));
  const strongest = recommendations.reduce(
    (best, item) => (CONFIDENCE_ORDER[item.confidence] > CONFIDENCE_ORDER[best.confidence] ? item : best),
    recommendations[0],
  );

  return {
    kind: 'COACH_BRIEFING',
    status: 'ok',
    generated_at: new Date().toISOString(),
    comparison_window: memory.comparison_window,
    sample: {
      contents_in_window: corpus.in_window,
      contents_with_reach: corpus.with_reach,
      contents_with_score: corpus.with_score ?? 0,
    },
    score_summary: options.scoreSummary ?? null,
    headline: strongest.conclusion,
    recommendations,
    observations_available: Array.isArray(memory.observations) ? memory.observations.length : 0,
    correlations_available: correlations.length,
    limits: [
      'Toutes les conclusions sont des correlations observees sur la fenetre, pas des relations causales.',
      'Les recommandations en mode tester reposent sur un signal faible et doivent etre traitees comme des hypotheses.',
      'Aucun chiffre n est estime : ce qui n a pas ete mesure n apparait pas.',
    ],
  };
}
