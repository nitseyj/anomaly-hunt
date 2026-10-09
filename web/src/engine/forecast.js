/**
 * forecast.js
 *
 * Forecast Call: show a trend with the ending hidden, ask one multiple-
 * choice question about what happens next. Every option is computed from
 * the real held-out data, not flavor text -- the correct answer and all
 * distractors are genuine numbers derived from the series.
 */
import { formatValue } from './metrics.js';

export const FORECAST_QUESTION_TYPES = ['direction', 'range', 'magnitude', 'pattern', 'business'];
const VISIBLE_FRACTION = 0.7;

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function splitSeries(series) {
  const cut = Math.floor(series.length * VISIBLE_FRACTION);
  return { visible: series.slice(0, cut), hidden: series.slice(cut), cut };
}

function buildDirectionQuestion(visible, hidden, unit, rng) {
  const lastVisible = visible[visible.length - 1].value;
  const lastHidden = hidden[hidden.length - 1].value;
  const delta = lastHidden - lastVisible;
  const correct = delta > lastVisible * 0.02 ? 'up' : delta < -lastVisible * 0.02 ? 'down' : 'flat';
  const options = shuffle(
    [
      { id: 'up', label: 'Trends up' },
      { id: 'down', label: 'Trends down' },
      { id: 'flat', label: 'Stays flat' },
    ],
    rng
  );
  return {
    type: 'direction',
    prompt: 'Where does this trend go next?',
    options,
    correctId: correct,
  };
}

function buildRangeQuestion(visible, hidden, unit, rng) {
  const lastHidden = hidden[hidden.length - 1].value;
  const visibleValues = visible.map((p) => p.value);
  const spread = Math.max(...visibleValues) - Math.min(...visibleValues) || Math.abs(mean(visibleValues)) * 0.1 || 1;
  // Band width floored so it can never collapse to a degenerate zero-width
  // option near a metric's physical floor (e.g. a defect rate pinned near 0%).
  const bandWidth = Math.max(spread * 0.35, Math.abs(lastHidden) * 0.08, 0.5);

  const correctLow = lastHidden - bandWidth / 2;
  const correctHigh = lastHidden + bandWidth / 2;
  const offset = bandWidth * 1.4;

  const bands = [
    { id: 'correct', low: correctLow, high: correctHigh },
    { id: 'above', low: correctHigh + offset * 0.2, high: correctHigh + offset * 1.2 },
    { id: 'below', low: correctLow - offset * 1.2, high: correctLow - offset * 0.2 },
  ];

  const options = shuffle(
    bands.map((b) => ({
      id: b.id,
      label: `${formatValue(b.low, unit)} – ${formatValue(b.high, unit)}`,
    })),
    rng
  );

  return {
    type: 'range',
    prompt: 'Which range will the final value land in?',
    options,
    correctId: 'correct',
  };
}

function buildMagnitudeQuestion(visible, hidden, unit, rng) {
  const lastVisible = visible[visible.length - 1].value;
  const lastHidden = hidden[hidden.length - 1].value;
  const pctChange = lastVisible !== 0 ? ((lastHidden - lastVisible) / Math.abs(lastVisible)) * 100 : 0;
  const absPct = Math.abs(pctChange);
  const correct = absPct < 5 ? 'small' : absPct < 20 ? 'moderate' : 'large';
  const options = shuffle(
    [
      { id: 'small', label: 'Small move (< 5%)' },
      { id: 'moderate', label: 'Moderate move (5-20%)' },
      { id: 'large', label: 'Large move (> 20%)' },
    ],
    rng
  );
  return {
    type: 'magnitude',
    prompt: 'How big is the move by the end?',
    options,
    correctId: correct,
  };
}

function buildPatternQuestion(visible, hidden, unit, rng) {
  const hiddenValues = hidden.map((p) => p.value);
  const first = hiddenValues[0];
  const last = hiddenValues[hiddenValues.length - 1];
  const maxV = Math.max(...hiddenValues);
  const minV = Math.min(...hiddenValues);
  const monotoneUp = hiddenValues.every((v, i) => i === 0 || v >= hiddenValues[i - 1] - (maxV - minV) * 0.05);
  const monotoneDown = hiddenValues.every((v, i) => i === 0 || v <= hiddenValues[i - 1] + (maxV - minV) * 0.05);

  let correct = 'choppy';
  if (monotoneUp && last > first) correct = 'steady';
  else if (monotoneDown && last < first) correct = 'steady';
  else if (Math.abs(last - first) < (maxV - minV) * 0.25) correct = 'reverts';

  const options = shuffle(
    [
      { id: 'steady', label: 'Keeps moving steadily in one direction' },
      { id: 'reverts', label: 'Swings, then reverts near where it started' },
      { id: 'choppy', label: 'Stays choppy with no clear direction' },
    ],
    rng
  );
  return {
    type: 'pattern',
    prompt: 'Which pattern best describes what happens next?',
    options,
    correctId: correct,
  };
}

const LOWER_IS_BETTER = new Set(['defect_rate', 'response_time', 'support_tickets', 'churn_rate']);

function buildBusinessQuestion(visible, hidden, templateId, label, rng) {
  const lastVisible = visible[visible.length - 1].value;
  const lastHidden = hidden[hidden.length - 1].value;
  const delta = lastHidden - lastVisible;
  const goodDirection = LOWER_IS_BETTER.has(templateId) ? -1 : 1;
  const correct = delta * goodDirection > lastVisible * 0.02 ? 'improves' : delta * goodDirection < -lastVisible * 0.02 ? 'worsens' : 'holds';
  const options = shuffle(
    [
      { id: 'improves', label: `${label} improves` },
      { id: 'worsens', label: `${label} worsens` },
      { id: 'holds', label: `${label} holds steady` },
    ],
    rng
  );
  return {
    type: 'business',
    prompt: `From a business standpoint, what happens to ${label.toLowerCase()}?`,
    options,
    correctId: correct,
  };
}

const BUILDERS = {
  direction: buildDirectionQuestion,
  range: buildRangeQuestion,
  magnitude: buildMagnitudeQuestion,
  pattern: buildPatternQuestion,
};

export function generateForecastRound(caseData, rng) {
  const { series, unit, label, templateId } = caseData;
  const { visible, hidden, cut } = splitSeries(series);
  const type = FORECAST_QUESTION_TYPES[Math.floor(rng() * FORECAST_QUESTION_TYPES.length)];

  const question =
    type === 'business'
      ? buildBusinessQuestion(visible, hidden, templateId, label, rng)
      : BUILDERS[type](visible, hidden, unit, rng);

  return {
    ...question,
    visible,
    hidden,
    cutIndex: cut,
    finalValue: round2(hidden[hidden.length - 1].value),
  };
}
