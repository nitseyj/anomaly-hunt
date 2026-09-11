/**
 * scoring.js
 *
 * Distance-based scoring: each true anomaly has a "credit radius" around
 * it. A flag exactly on the anomaly earns full credit; a flag near it
 * earns partial credit that fades linearly to zero at the radius edge;
 * a flag outside every anomaly's radius earns nothing (and is tracked as
 * a false alarm). This is deliberately more forgiving than requiring a
 * pixel-perfect click on the exact index -- the game is testing whether
 * you noticed the right neighborhood of the chart, not whether you can
 * click one specific day out of 90.
 *
 * Flags placed by directly "throwing a dart" at the chart (as opposed to
 * the slider or table, which always aim perfectly at the real curve
 * value) can also miss VERTICALLY -- the game additionally tracks how
 * far off the guessed value was and blends that into a genuine 2D,
 * circular falloff (see scoreRound's yGuesses parameter below), rather
 * than only ever measuring how many days off the flag was.
 */

const RADIUS = 6; // index units (~days) — how far from the true point still earns partial credit
const MAX_ACCURACY_POINTS = 100;
const SPEED_BONUS_MAX = 30;
const FALSE_ALARM_PENALTY = 4; // per flag that doesn't earn credit for any anomaly
const TIME_LIMIT_SECONDS = 45;
// A hard ceiling on how many points can be flagged at once, well above any
// difficulty's true anomaly count (max 3, on "hard"). This exists purely as
// a safety net: flagging is a deliberate, separate action from browsing
// (see ObservationPanel), so this only matters if someone repeatedly hits
// "Flag" while exploring -- without a cap, that can silently flag dozens of
// points, which is confusing to see and never analytically useful anyway.
const MAX_FLAGS = 6;

/**
 * @param {number[]} guessedIndices - indices the player flagged
 * @param {{type:string,index:number}[]} groundTruthAnomalies
 * @param {number} secondsRemaining - time left when submitted
 * @param {{date:string,value:number}[]|null} series - the case's full series,
 *   only needed if yGuesses is provided (to look up true values and the
 *   series' own value range for normalization)
 * @param {Object<number,number>} yGuesses - maps a flagged index to the
 *   VALUE the player aimed at when they threw a dart at the chart there
 *   (not present for flags placed via the slider/table, which always aim
 *   perfectly at the real curve value -- so those still score on distance
 *   alone, exactly as before)
 */
export function scoreRound(guessedIndices, groundTruthAnomalies, secondsRemaining, series = null, yGuesses = {}) {
  const maxPerAnomaly = MAX_ACCURACY_POINTS / Math.max(groundTruthAnomalies.length, 1);
  const usedGuesses = new Set();

  // The series' own value range is what normalizes a Y-miss into the same
  // 0-1 scale as an X-miss (a fraction of CREDIT_RADIUS days), so the two
  // can be combined into one genuine circular (Euclidean) distance instead
  // of an arbitrary weighting between "days off" and "value off."
  let valueRange = 1;
  if (series && series.length > 0) {
    const values = series.map((p) => p.value);
    valueRange = Math.max(...values) - Math.min(...values) || 1;
  }

  const hits = groundTruthAnomalies.map((anomaly) => {
    let best = null;
    for (const idx of guessedIndices) {
      const dist = Math.abs(idx - anomaly.index);
      if (dist <= RADIUS && (best === null || dist < best.dist)) {
        best = { idx, dist };
      }
    }
    if (best) usedGuesses.add(best.idx);

    let creditFraction = best ? 1 - best.dist / RADIUS : 0;
    let yError = null;

    if (best && series && Object.prototype.hasOwnProperty.call(yGuesses, best.idx)) {
      const trueValue = series[anomaly.index]?.value ?? 0;
      const guessedValue = yGuesses[best.idx];
      yError = Math.abs(guessedValue - trueValue);
      const xFraction = best.dist / RADIUS;
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

  const speedBonus = Math.round(
    SPEED_BONUS_MAX * Math.max(0, secondsRemaining / TIME_LIMIT_SECONDS)
  );

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

export const TIME_LIMIT = TIME_LIMIT_SECONDS;
export const CREDIT_RADIUS = RADIUS;
export const MAX_FLAGS_PER_CASE = MAX_FLAGS;
