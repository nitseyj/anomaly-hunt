/**
 * anomalies.js
 *
 * Injects 1-3 labeled anomalies into a clean series. Ground truth marks
 * WHERE an anomaly begins, not every point it affects afterward -- a
 * level shift or trend break changes every subsequent value, but the
 * thing a player (or analyst) should flag is the moment it started, not
 * every day it stays changed.
 */
import { CREDIT_RADIUS } from './scoring.js';

export const ANOMALY_TYPES = ['point_spike', 'level_shift', 'missing_gap', 'trend_break'];

const DIFFICULTY_SETTINGS = {
  easy: { count: 1, magnitudeMult: 3.2, gapLenRange: [5, 8] },
  medium: { count: 2, magnitudeMult: 2.4, gapLenRange: [4, 6] },
  hard: { count: 3, magnitudeMult: 2.0, gapLenRange: [3, 4] },
};

function stdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks anomaly indices spaced far enough apart (> 2x CREDIT_RADIUS) that
 * no single flag can ever be within radius of two anomalies at once --
 * otherwise one flag could silently double-count credit. Retries several
 * shuffles before falling back to ignoring spacing (only reachable on a
 * pathologically short series).
 */
function pickAnomalyIndices(n, count, rng) {
  const minSpacing = Math.max(n * 0.12, CREDIT_RADIUS * 2 + 2);
  const candidateStart = Math.floor(n * 0.15);
  const candidateEnd = Math.floor(n * 0.85);
  const candidates = Array.from({ length: candidateEnd - candidateStart }, (_, i) => candidateStart + i);

  let chosen = [];
  for (let attempt = 0; attempt < 25 && chosen.length < count; attempt++) {
    shuffle(candidates, rng);
    const attemptChosen = [];
    for (const idx of candidates) {
      if (attemptChosen.every((c) => Math.abs(c - idx) > minSpacing)) attemptChosen.push(idx);
      if (attemptChosen.length === count) break;
    }
    if (attemptChosen.length > chosen.length) chosen = attemptChosen;
  }
  for (const idx of shuffle(candidates, rng)) {
    if (chosen.length >= count) break;
    if (!chosen.includes(idx)) chosen.push(idx);
  }
  return chosen;
}

export function injectAnomalies(cleanValues, difficulty, rng) {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const out = [...cleanValues];
  const n = out.length;
  const std = stdDev(out) || 1e-6;
  const [gapMin, gapMax] = settings.gapLenRange;

  const chosen = pickAnomalyIndices(n, settings.count, rng);
  const groundTruth = [];

  for (const idx of chosen) {
    const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
    const direction = rng() < 0.5 ? 1 : -1;
    const magnitude = std * settings.magnitudeMult * (0.85 + rng() * 0.3);

    // A downward shift/break sized from the series-wide std can exceed the
    // LOCAL baseline (especially late in a declining series), flattening a
    // long stretch at a hard floor once clamped -- cap the downward delta
    // at a fraction of the local mean so it stays dramatic without ever
    // fully flattening a run of points.
    const localWindow = out.slice(Math.max(0, idx - 10), idx);
    const localMean = localWindow.length > 0 ? localWindow.reduce((a, b) => a + b, 0) / localWindow.length : out[idx];
    const maxDownwardDelta = Math.abs(localMean) * 0.85;

    if (type === 'point_spike') {
      out[idx] += direction * magnitude;
    } else if (type === 'level_shift') {
      const delta = direction * magnitude;
      const cappedDelta = direction < 0 ? Math.max(delta, -maxDownwardDelta) : delta;
      for (let i = idx; i < n; i++) out[i] += cappedDelta;
    } else if (type === 'missing_gap') {
      const gapLen = gapMin + Math.floor(rng() * (gapMax - gapMin + 1));
      const flatValue = out[Math.max(idx - 1, 0)];
      for (let i = idx; i < Math.min(idx + gapLen, n); i++) out[i] = flatValue;
    } else {
      // trend_break: the flagged point must itself be visibly off, not
      // just where the slope begins to change -- a pure ramp is exactly
      // zero deviation at i === idx. An immediate step (sized like a
      // level shift) plus a continuing slope keeps both properties true.
      const immediateStep = magnitude * 0.9;
      const slope = magnitude * 0.08;
      for (let i = idx; i < n; i++) {
        const rawDelta = direction * (immediateStep + (i - idx) * slope);
        const cappedDelta = direction < 0 ? Math.max(rawDelta, -maxDownwardDelta) : rawDelta;
        out[i] += cappedDelta;
      }
    }

    groundTruth.push({ type, index: idx });
  }

  // Multiple anomalies' capped-but-large deltas can still compound toward
  // a shared floor where their tails overlap -- no point should end up
  // more than ~85% below its pre-anomaly value, however many anomalies
  // jointly touch it.
  for (let i = 0; i < n; i++) {
    if (cleanValues[i] > 0 && out[i] < cleanValues[i] * 0.15) {
      out[i] = cleanValues[i] * 0.15;
    }
  }

  return { values: out, groundTruth };
}
