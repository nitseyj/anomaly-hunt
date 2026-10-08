/**
 * forecast.js
 *
 * Builds one Forecast Call round: a clean trend+seasonality series with
 * the final stretch hidden, plus a dynamically-generated multiple-choice
 * question. Every option -- correct answer and distractors -- is computed
 * from the actual series, never hard-coded.
 */
import { createRng, randomSeed } from './rng.js';
import { pickTemplate, formatValue, SERIES_LENGTH } from './metrics.js';

const HIDDEN_DAYS = 14;
const RECENT_WINDOW = 14;
const QUESTION_TYPES = ['direction', 'range', 'magnitude', 'pattern', 'business'];
const UNIT_BAND_FLOOR = { usd: 50, count: 5, percent: 0.3, ms: 5, roas: 0.1 };

const round2 = (v) => Math.round(v * 100) / 100;
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

function pctChangeOf(recentAvg, futureAvg) {
  const denom = Math.max(Math.abs(recentAvg), 1e-9);
  return ((futureAvg - recentAvg) / denom) * 100;
}

function classifyDirection(pctChange) {
  if (pctChange > 8) return 0; // strong increase
  if (pctChange > 2) return 1; // moderate increase
  if (pctChange >= -2) return 2; // stable
  return 3; // decline
}

function classifyMagnitude(absPctChange) {
  if (absPctChange < 2) return 0;
  if (absPctChange < 5) return 1;
  if (absPctChange < 10) return 2;
  return 3;
}

function classifyPattern(pctChange, hasWeeklySeasonality) {
  if (hasWeeklySeasonality) return 2; // seasonal oscillation dominates what's visually obvious
  if (pctChange > 4) return 0;
  if (pctChange < -4) return 3;
  return 1;
}

/**
 * Four sequential bands centered on futureAvg, with the correct slot's
 * position randomized each round. Near a metric's natural floor, a
 * full-width ladder can push early slots negative -- clamping each
 * edge independently (the naive approach) collapses those into
 * duplicate/zero-width "0%-0%" options, and can even silently move
 * futureAvg into a DIFFERENT slot than the one marked correct. Shrinking
 * the band width instead keeps all 4 slots distinct and keeps futureAvg
 * exactly centered in the slot reported as correct.
 */
function buildRangeQuestion(rng, unit, futureAvg) {
  let width = Math.max(Math.abs(futureAvg) * 0.1, UNIT_BAND_FLOOR[unit] ?? 1);
  const correctSlot = Math.floor(rng() * 4);
  const maxWidthKeepingNonNegative = futureAvg / (correctSlot + 0.5);
  if (maxWidthKeepingNonNegative > 0 && maxWidthKeepingNonNegative < width) {
    width = maxWidthKeepingNonNegative;
  }
  const start = futureAvg - width * (correctSlot + 0.5);
  const bands = [0, 1, 2, 3].map((i) => ({
    low: Math.max(0, start + i * width),
    high: Math.max(0, start + (i + 1) * width),
  }));
  return {
    options: bands.map((b) => `${formatValue(round2(b.low), unit)} – ${formatValue(round2(b.high), unit)}`),
    correctIndex: correctSlot,
  };
}

function buildQuestion(type, rng, { label, unit, futureAvg, pctChange, hasWeeklySeasonality }) {
  const absPctChange = Math.abs(pctChange);

  if (type === 'direction') {
    return {
      type,
      question: `What is the most likely direction of ${label.toLowerCase()} over the next ${HIDDEN_DAYS} days?`,
      options: ['Strong increase', 'Moderate increase', 'Stable', 'Decline'],
      correctIndex: classifyDirection(pctChange),
    };
  }
  if (type === 'range') {
    const { options, correctIndex } = buildRangeQuestion(rng, unit, futureAvg);
    return { type, question: `Which range is most likely for the ${HIDDEN_DAYS}-day average of ${label.toLowerCase()}?`, options, correctIndex };
  }
  if (type === 'magnitude') {
    return {
      type,
      question: `Approximately how much will ${label.toLowerCase()} change over the next ${HIDDEN_DAYS} days?`,
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
  return {
    type,
    question: `Based on recent behaviour, what is the most reasonable expectation for ${label.toLowerCase()}?`,
    options: [
      'Continue accelerating well above recent norms',
      'Grow modestly, in line with recent momentum',
      'Hold roughly steady around current levels',
      'Pull back from where it has been',
    ],
    correctIndex: classifyDirection(pctChange),
  };
}

function buildExplanation(label, unit, recentAvg, futureAvg, pctChange, hasWeeklySeasonality) {
  const sign = pctChange >= 0 ? '+' : '';
  const trend = `${label} moved from an average of ${formatValue(round2(recentAvg), unit)} to ${formatValue(round2(futureAvg), unit)} over the ${HIDDEN_DAYS}-day window (${sign}${pctChange.toFixed(1)}%).`;
  const seasonality = hasWeeklySeasonality
    ? ' Recurring weekly seasonality remained a significant factor across the window.'
    : ' No strong weekly pattern was present, so the move reflects trend and noise alone.';
  return trend + seasonality;
}

export function generateForecastRound(usedTemplateIds = []) {
  const rng = createRng(randomSeed());
  const { template, scenario } = pickTemplate(rng, usedTemplateIds);
  const { dates, values } = template.generate(rng, SERIES_LENGTH);
  const visibleCount = SERIES_LENGTH - HIDDEN_DAYS;

  const recentAvg = mean(values.slice(visibleCount - RECENT_WINDOW, visibleCount));
  const futureAvg = mean(values.slice(visibleCount));
  const pctChange = pctChangeOf(recentAvg, futureAvg);

  const questionType = QUESTION_TYPES[Math.floor(rng() * QUESTION_TYPES.length)];
  const mcq = buildQuestion(questionType, rng, {
    label: template.label,
    unit: template.unit,
    futureAvg,
    pctChange,
    hasWeeklySeasonality: template.hasWeeklySeasonality,
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    templateId: template.id,
    title: scenario.title,
    brief: scenario.brief,
    label: template.label,
    unit: template.unit,
    visibleSeries: dates.slice(0, visibleCount).map((date, i) => ({ date, value: round2(values[i]) })),
    futureSeries: dates.slice(visibleCount).map((date, i) => ({ date, value: round2(values[visibleCount + i]) })),
    question: mcq.question,
    options: mcq.options,
    correctIndex: mcq.correctIndex,
    questionType: mcq.type,
    explanation: buildExplanation(template.label, template.unit, recentAvg, futureAvg, pctChange, template.hasWeeklySeasonality),
  };
}

export const FORECAST_ROUND_COUNT = 5;
export const FORECAST_HIDDEN_DAYS = HIDDEN_DAYS;
