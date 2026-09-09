/**
 * forecastGenerator.js
 *
 * Generates one round of "Forecast Call" as a multiple-choice question,
 * not a free-text guess. A clean (no injected anomalies) business metric
 * series is generated, the final HIDDEN_DAYS are held back as "the
 * future," and a question is built from one of five types -- direction,
 * range, magnitude, pattern, or business interpretation. Every correct
 * answer and every distractor is computed from the actual generated
 * series (see the classify* functions below); nothing is hard-coded.
 *
 * Reuses the same template library as anomalyGenerator.js (via
 * businessMetrics.js) rather than duplicating metric definitions.
 */

import { mulberry32, pickTemplate, formatValue, generateInstanceId, SERIES_LENGTH } from './businessMetrics.js';

const HIDDEN_DAYS = 14;
const RECENT_WINDOW = 14; // how much of the visible history counts as "recent" for comparison

const QUESTION_TYPES = ['direction', 'range', 'magnitude', 'pattern', 'business'];

const UNIT_BAND_FLOOR = { usd: 50, count: 5, percent: 0.3, ms: 5, roas: 0.1 };

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pctChangeOf(recentAvg, futureAvg) {
  const denom = Math.max(Math.abs(recentAvg), 1e-9);
  return ((futureAvg - recentAvg) / denom) * 100;
}

function classifyDirection(pctChange) {
  if (pctChange > 8) return 0; // Strong increase
  if (pctChange > 2) return 1; // Moderate increase
  if (pctChange >= -2) return 2; // Stable
  return 3; // Decline
}

function classifyMagnitude(absPctChange) {
  if (absPctChange < 2) return 0; // Less than 2%
  if (absPctChange < 5) return 1; // 2-5%
  if (absPctChange < 10) return 2; // 5-10%
  return 3; // More than 10%
}

function classifyPattern(pctChange, hasWeeklySeasonality) {
  if (hasWeeklySeasonality) return 2; // Seasonal oscillation
  if (pctChange > 4) return 0; // Continued growth
  if (pctChange < -4) return 3; // Decline
  return 1; // Stable movement
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function buildExplanation(metricLabel, unit, recentAvg, futureAvg, pctChange, hasWeeklySeasonality) {
  const direction = pctChange >= 0 ? '+' : '';
  const trendSentence = `${metricLabel} moved from an average of ${formatValue(round2(recentAvg), unit)} to ${formatValue(
    round2(futureAvg),
    unit
  )} over the ${HIDDEN_DAYS}-day window (${direction}${pctChange.toFixed(1)}%).`;
  const seasonalitySentence = hasWeeklySeasonality
    ? ' Recurring weekly seasonality remained a significant factor across the window.'
    : ' No strong weekly pattern was present in this series, so the move reflects trend and noise alone.';
  return trendSentence + seasonalitySentence;
}

function buildRangeQuestion(rng, unit, futureAvg) {
  const relativeWidth = Math.max(Math.abs(futureAvg) * 0.1, UNIT_BAND_FLOOR[unit] ?? 1);
  const correctSlot = Math.floor(rng() * 4);
  // bandsStart is chosen so futureAvg sits at the midpoint of bands[correctSlot] --
  // this guarantees the true value always falls in exactly one option, with that
  // option's position among the 4 randomized every round.
  const bandsStart = futureAvg - relativeWidth * (correctSlot + 0.5);
  const bands = [0, 1, 2, 3].map((i) => ({
    low: Math.max(0, bandsStart + i * relativeWidth),
    high: Math.max(0, bandsStart + (i + 1) * relativeWidth),
  }));
  const options = bands.map((b) => `${formatValue(round2(b.low), unit)} – ${formatValue(round2(b.high), unit)}`);
  return { options, correctIndex: correctSlot };
}

function buildQuestion(type, rng, { metricLabel, unit, futureAvg, pctChange, hasWeeklySeasonality }) {
  const absPctChange = Math.abs(pctChange);

  if (type === 'direction') {
    return {
      type,
      question: `What is the most likely direction of ${metricLabel.toLowerCase()} over the next ${HIDDEN_DAYS} days?`,
      options: ['Strong increase', 'Moderate increase', 'Stable', 'Decline'],
      correctIndex: classifyDirection(pctChange),
    };
  }

  if (type === 'range') {
    const { options, correctIndex } = buildRangeQuestion(rng, unit, futureAvg);
    return {
      type,
      question: `Which range is most likely for the ${HIDDEN_DAYS}-day average of ${metricLabel.toLowerCase()}?`,
      options,
      correctIndex,
    };
  }

  if (type === 'magnitude') {
    return {
      type,
      question: `Approximately how much will ${metricLabel.toLowerCase()} change over the next ${HIDDEN_DAYS} days?`,
      options: ['Less than 2%', '2–5%', '5–10%', 'More than 10%'],
      correctIndex: classifyMagnitude(absPctChange),
    };
  }

  if (type === 'pattern') {
    return {
      type,
      question: `Which pattern is most likely over the next ${HIDDEN_DAYS} days?`,
      options: ['Continued growth', 'Stable movement', 'Seasonal oscillation', 'Decline'],
      correctIndex: classifyPattern(pctChange, hasWeeklySeasonality),
    };
  }

  // business
  return {
    type,
    question: `Based on recent behaviour, what is the most reasonable expectation for ${metricLabel.toLowerCase()}?`,
    options: [
      'Continue accelerating well above recent norms',
      'Grow modestly, in line with recent momentum',
      'Hold roughly steady around current levels',
      'Pull back from where it has been',
    ],
    correctIndex: classifyDirection(pctChange),
  };
}

/**
 * Builds one fresh Forecast Call round: a real trend+seasonality series
 * with the ending hidden, plus a dynamically-generated MCQ whose correct
 * answer and distractors are both computed from the actual data.
 */
export function generateForecast(usedTemplateIds = []) {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  const { template, scenario } = pickTemplate(rng, usedTemplateIds);

  const { dates, values } = template.generate(rng, SERIES_LENGTH);
  const visibleCount = SERIES_LENGTH - HIDDEN_DAYS;

  const recentAvg = mean(values.slice(visibleCount - RECENT_WINDOW, visibleCount));
  const futureAvg = mean(values.slice(visibleCount));
  const pctChange = pctChangeOf(recentAvg, futureAvg);

  const questionType = QUESTION_TYPES[Math.floor(rng() * QUESTION_TYPES.length)];
  const mcq = buildQuestion(questionType, rng, {
    metricLabel: template.y_label,
    unit: template.unit,
    futureAvg,
    pctChange,
    hasWeeklySeasonality: template.hasWeeklySeasonality,
  });

  const round2v = (v) => Math.round(v * 100) / 100;

  return {
    genId: generateInstanceId(),
    templateId: template.id,
    case_name: scenario.case_name,
    scenario: scenario.scenario,
    y_label: template.y_label,
    unit: template.unit,
    visibleSeries: dates.slice(0, visibleCount).map((date, i) => ({ date, value: round2v(values[i]) })),
    futureSeries: dates.slice(visibleCount).map((date, i) => ({ date, value: round2v(values[visibleCount + i]) })),
    targetDate: dates[visibleCount],
    question: mcq.question,
    options: mcq.options,
    correctIndex: mcq.correctIndex,
    questionType: mcq.type,
    explanation: buildExplanation(template.y_label, template.unit, recentAvg, futureAvg, pctChange, template.hasWeeklySeasonality),
    pctChange: round2v(pctChange),
  };
}

export const FORECAST_ROUND_COUNT = 5;
export const FORECAST_HIDDEN_DAYS = HIDDEN_DAYS;
