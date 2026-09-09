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
 */

const RADIUS = 6; // index units (~days) — how far from the true point still earns partial credit
const MAX_ACCURACY_POINTS = 100;
const SPEED_BONUS_MAX = 30;
const FALSE_ALARM_PENALTY = 4; // per flag that doesn't earn credit for any anomaly
const TIME_LIMIT_SECONDS = 45;

/**
 * @param {number[]} guessedIndices - indices the player clicked
 * @param {{type:string,index:number}[]} groundTruthAnomalies
 * @param {number} secondsRemaining - time left when submitted
 */
export function scoreRound(guessedIndices, groundTruthAnomalies, secondsRemaining) {
  const maxPerAnomaly = MAX_ACCURACY_POINTS / Math.max(groundTruthAnomalies.length, 1);
  const usedGuesses = new Set();

  const hits = groundTruthAnomalies.map((anomaly) => {
    let best = null;
    for (const idx of guessedIndices) {
      const dist = Math.abs(idx - anomaly.index);
      if (dist <= RADIUS && (best === null || dist < best.dist)) {
        best = { idx, dist };
      }
    }
    if (best) usedGuesses.add(best.idx);
    const creditFraction = best ? 1 - best.dist / RADIUS : 0;
    return {
      anomalyIndex: anomaly.index,
      type: anomaly.type,
      matchedIndex: best ? best.idx : null,
      distance: best ? best.dist : null,
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
