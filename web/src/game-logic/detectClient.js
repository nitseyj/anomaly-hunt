/**
 * detectClient.js
 *
 * Lightweight JS ports of the same detection ideas used in
 * data-pipeline/detect_anomalies.py (Python) -- rolling z-score, rolling
 * IQR, and a simple weekly-seasonal-difference z-score (a lightweight
 * stand-in for the Python STL decomposition, avoiding a heavy stats
 * dependency in the browser). Used to power the post-round "what a
 * statistical model would have flagged" comparison.
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
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function rollingZScoreDetect(values, window = 10, threshold = 3.0) {
  const n = values.length;
  const flags = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(n, i + Math.floor(window / 2) + 1);
    const windowVals = values.slice(start, end);
    const m = mean(windowVals);
    const s = std(windowVals) || 1e-9;
    const z = Math.abs((values[i] - m) / s);
    flags[i] = z > threshold;
  }
  return flags;
}

export function iqrDetect(values, window = 20, k = 1.5) {
  const n = values.length;
  const flags = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(n, i + Math.floor(window / 2) + 1);
    const sorted = [...values.slice(start, end)].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - k * iqr;
    const upper = q3 + k * iqr;
    flags[i] = values[i] < lower || values[i] > upper;
  }
  return flags;
}

/** Compares each point to the same weekday ~7 days prior, then z-scores the difference. */
export function weeklySeasonalDetect(values, threshold = 2.5) {
  const diffs = values.map((v, i) => (i >= 7 ? v - values[i - 7] : null));
  const validDiffs = diffs.filter((d) => d !== null);
  const m = mean(validDiffs);
  const s = std(validDiffs) || 1e-9;
  return diffs.map((d) => (d === null ? false : Math.abs((d - m) / s) > threshold));
}

/** Precision/recall/F1 against ground-truth changepoints, with a tolerance window. */
export function evaluateDetector(flags, groundTruthAnomalies, tolerance = 3) {
  const trueIdxs = new Set();
  for (const a of groundTruthAnomalies) {
    for (let i = a.index - tolerance; i <= a.index + tolerance; i++) trueIdxs.add(i);
  }
  const flaggedIdxs = flags.reduce((acc, f, i) => (f ? [...acc, i] : acc), []);

  let tp = 0;
  let fp = 0;
  for (const idx of flaggedIdxs) {
    if (trueIdxs.has(idx)) tp += 1;
    else fp += 1;
  }
  const fn = [...trueIdxs].filter((i) => !flaggedIdxs.includes(i)).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision: round3(precision), recall: round3(recall), f1: round3(f1) };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

export function runAllDetectors(values, groundTruthAnomalies) {
  const flagsByDetector = {
    rolling_zscore: rollingZScoreDetect(values),
    iqr: iqrDetect(values),
    weekly_seasonal_diff: weeklySeasonalDetect(values),
  };
  const scores = {};
  for (const [name, flags] of Object.entries(flagsByDetector)) {
    scores[name] = evaluateDetector(flags, groundTruthAnomalies);
  }

  // Combined flag: true at any index flagged by 2+ of the 3 detectors --
  // shown on the chart as a lightweight "the models mostly agreed here"
  // marker, separate from the per-detector precision/recall breakdown.
  const n = values.length;
  const combinedFlags = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const votes = Object.values(flagsByDetector).filter((flags) => flags[i]).length;
    combinedFlags[i] = votes >= 2;
  }

  return { scores, flagsByDetector, combinedFlags };
}
