/**
 * detectors.js
 *
 * Three transparent, classic anomaly-detection methods. Every rolling
 * method excludes the point under test from its own baseline window --
 * including it is a well-known bias: on a small window, one strong
 * outlier pulls the window's own mean toward itself and inflates its own
 * std, which can push an obvious spike's z-score BELOW threshold purely
 * because it was allowed to vouch for its own normalcy.
 */

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function windowExcluding(values, i, window) {
  const n = values.length;
  const start = Math.max(0, i - Math.floor(window / 2));
  const end = Math.min(n, i + Math.floor(window / 2) + 1);
  const out = [];
  for (let j = start; j < end; j++) if (j !== i) out.push(values[j]);
  return out;
}

export function rollingZScoreDetect(values, window = 10, threshold = 3.0) {
  return values.map((v, i) => {
    const w = windowExcluding(values, i, window);
    const s = std(w) || 1e-9;
    return Math.abs((v - mean(w)) / s) > threshold;
  });
}

export function rollingIqrDetect(values, window = 20, k = 1.5) {
  return values.map((v, i) => {
    const sorted = windowExcluding(values, i, window).sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    return v < q1 - k * iqr || v > q3 + k * iqr;
  });
}

/** Compares each point to the same weekday ~7 days prior, then z-scores that difference. */
export function weeklySeasonalDiffDetect(values, threshold = 2.5) {
  const diffs = values.map((v, i) => (i >= 7 ? v - values[i - 7] : null));
  const validDiffs = diffs.filter((d) => d !== null);
  const m = mean(validDiffs);
  const s = std(validDiffs) || 1e-9;
  return diffs.map((d) => (d === null ? false : Math.abs((d - m) / s) > threshold));
}

/**
 * Precision/recall/F1 against ground truth, with a tolerance window.
 * Recall is computed PER ANOMALY EVENT: an anomaly counts as found if at
 * least one flag lands anywhere in its tolerance window, regardless of
 * how many nearby points also got flagged. An index-level recall would
 * structurally cap a perfect human player's recall near 15-30% (detectors
 * flag several contiguous points per anomaly; a single click naturally
 * flags one), making Human-vs-Machine unfair by construction. Precision
 * stays point-based -- it should penalize excess clicking either way.
 */
export function evaluateFlags(flags, groundTruthAnomalies, tolerance = 3) {
  const inToleranceOfAny = new Set();
  for (const a of groundTruthAnomalies) {
    for (let i = a.index - tolerance; i <= a.index + tolerance; i++) inToleranceOfAny.add(i);
  }
  const flaggedIdxs = flags.reduce((acc, f, i) => (f ? [...acc, i] : acc), []);

  let tp = 0;
  let fp = 0;
  for (const idx of flaggedIdxs) {
    if (inToleranceOfAny.has(idx)) tp += 1;
    else fp += 1;
  }

  const anomaliesFound = groundTruthAnomalies.filter((a) => flaggedIdxs.some((idx) => Math.abs(idx - a.index) <= tolerance)).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = groundTruthAnomalies.length > 0 ? anomaliesFound / groundTruthAnomalies.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const round3 = (x) => Math.round(x * 1000) / 1000;
  return { precision: round3(precision), recall: round3(recall), f1: round3(f1) };
}

export const DETECTOR_META = {
  rolling_zscore: { label: 'Rolling Z-Score' },
  rolling_iqr: { label: 'Rolling IQR' },
  weekly_seasonal_diff: { label: 'Seasonal Diff' },
};

export function runAllDetectors(values, groundTruthAnomalies) {
  const flagsByDetector = {
    rolling_zscore: rollingZScoreDetect(values),
    rolling_iqr: rollingIqrDetect(values),
    weekly_seasonal_diff: weeklySeasonalDiffDetect(values),
  };
  const scores = {};
  for (const [name, flags] of Object.entries(flagsByDetector)) {
    scores[name] = evaluateFlags(flags, groundTruthAnomalies);
  }
  const n = values.length;
  const combinedFlags = Array.from({ length: n }, (_, i) => {
    const votes = Object.values(flagsByDetector).filter((flags) => flags[i]).length;
    return votes >= 2;
  });
  return { scores, flagsByDetector, combinedFlags };
}

/**
 * Turns a scoreAnomalyHunt() result into the same {precision, recall, f1}
 * shape evaluateFlags() produces for the statistical detectors, so the
 * player's own row in the "Human vs Machine" table is computed by the
 * same lens as every other row, not a different metric dressed up to
 * look comparable. Was duplicated identically in both AnomalyHunt and
 * DailyChallenge screens before living here.
 */
export function evaluateHumanResult(result) {
  if (!result) return { precision: 0, recall: 0, f1: 0 };
  const tp = result.anomaliesFound;
  const fp = result.falseAlarms;
  const fn = result.anomaliesMissed;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}
