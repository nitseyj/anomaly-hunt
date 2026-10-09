/**
 * scoring.js
 *
 * Anomaly Hunt: distance-based credit. Each true anomaly has a credit
 * radius around it -- a flag exactly on it earns full credit, a flag
 * within the radius earns credit that fades linearly with distance, a
 * flag outside every radius earns nothing and counts as a false alarm.
 * A dart throw can also miss vertically, so its credit is a genuine 2D
 * circular falloff combining how many days off AND how far off in value.
 *
 * Forecast Call: confidence-calibrated MCQ scoring in scoreForecastAnswer()
 * -- higher declared confidence multiplies both the reward for being
 * right and the penalty for being wrong.
 */

export const CREDIT_RADIUS = 10; // index units (~days)
const MAX_ACCURACY_POINTS = 100;
const SPEED_BONUS_MAX = 30;
const FALSE_ALARM_PENALTY = 4;
export const TIME_LIMIT_SECONDS = 45;
export const MAX_FLAGS_PER_CASE = 6;

export function scoreAnomalyHunt(guessedIndices, groundTruthAnomalies, secondsRemaining, series, yGuesses = {}) {
  const maxPerAnomaly = MAX_ACCURACY_POINTS / Math.max(groundTruthAnomalies.length, 1);
  const usedGuesses = new Set();

  let valueRange = 1;
  if (series && series.length > 0) {
    const values = series.map((p) => p.value);
    valueRange = Math.max(...values) - Math.min(...values) || 1;
  }

  const hits = groundTruthAnomalies.map((anomaly) => {
    let best = null;
    for (const idx of guessedIndices) {
      const dist = Math.abs(idx - anomaly.index);
      if (dist <= CREDIT_RADIUS && (best === null || dist < best.dist)) {
        best = { idx, dist };
      }
    }
    if (best) usedGuesses.add(best.idx);

    let creditFraction = best ? 1 - best.dist / CREDIT_RADIUS : 0;
    let yError = null;

    if (best && series && Object.prototype.hasOwnProperty.call(yGuesses, best.idx)) {
      const trueValue = series[anomaly.index]?.value ?? 0;
      const guessedValue = yGuesses[best.idx];
      yError = Math.abs(guessedValue - trueValue);
      const xFraction = best.dist / CREDIT_RADIUS;
      const yFraction = yError / valueRange;
      const combinedDistance = Math.sqrt(xFraction * xFraction + yFraction * yFraction);
      creditFraction = Math.max(0, 1 - combinedDistance);
    }

    return {
      anomalyIndex: anomaly.index,
      type: anomaly.type,
      matchedIndex: best ? best.idx : null,
      distance: best ? best.dist : null,
      yError,
      points: Math.round(creditFraction * maxPerAnomaly),
    };
  });

  const accuracyPoints = hits.reduce((sum, h) => sum + h.points, 0);
  const falseAlarms = guessedIndices.filter((idx) => !usedGuesses.has(idx)).length;
  const falseAlarmPenalty = Math.min(falseAlarms * FALSE_ALARM_PENALTY, MAX_ACCURACY_POINTS * 0.5);

  const speedBonus = Math.round(SPEED_BONUS_MAX * Math.max(0, secondsRemaining / TIME_LIMIT_SECONDS));
  const anomaliesFound = hits.filter((h) => h.matchedIndex !== null).length;
  const anomaliesMissed = hits.length - anomaliesFound;
  const points = Math.max(0, Math.round(accuracyPoints - falseAlarmPenalty) + speedBonus);

  return {
    hits,
    accuracyPoints: Math.round(accuracyPoints),
    falseAlarms,
    falseAlarmPenalty: Math.round(falseAlarmPenalty),
    speedBonus,
    anomaliesFound,
    anomaliesMissed,
    points,
  };
}

const FORECAST_BASE_CORRECT = 100;
const FORECAST_BASE_PENALTY = 20;
export const FORECAST_CONFIDENCE_MULTIPLIERS = { low: 0.8, medium: 1.0, high: 1.3 };
export const FORECAST_CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

export function scoreForecastAnswer(isCorrect, confidence) {
  const multiplier = FORECAST_CONFIDENCE_MULTIPLIERS[confidence] ?? 1.0;
  if (isCorrect) return { points: Math.round(FORECAST_BASE_CORRECT * multiplier), multiplier };
  return { points: -Math.round(FORECAST_BASE_PENALTY * multiplier), multiplier };
}
