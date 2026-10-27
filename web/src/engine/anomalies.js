/**
 * anomalies.js
 *
 * Injects 1-3 labeled anomalies into a clean series. Ground truth marks
 * WHERE an anomaly begins, not every point it affects afterward.
 */
import { CREDIT_RADIUS } from './scoring.js';

export const ANOMALY_TYPES = ['point_spike', 'level_shift', 'missing_gap', 'trend_break', 'volatility_spike'];

// Plain-English names for the reveal screen's "here's what you missed"
// message -- naming the shape of a missed anomaly is what lets a player
// build a mental taxonomy of what to look for next time, instead of a
// miss just being an unexplained red mark.
export const ANOMALY_TYPE_LABELS = {
  point_spike: 'a single-day spike',
  level_shift: 'a level shift',
  missing_gap: 'a flattened/missing stretch',
  trend_break: 'a trend break',
  volatility_spike: 'a burst of erratic noise',
};

// Short, title-cased labels for places naming a type outside a sentence
// (a practice-mode button, a case eyebrow) -- ANOMALY_TYPE_LABELS above
// is phrased to read inline ("...missed a level shift"), which looks
// wrong standing alone as a label.
export const ANOMALY_TYPE_SHORT_LABELS = {
  point_spike: 'Point Spikes',
  level_shift: 'Level Shifts',
  missing_gap: 'Missing Gaps',
  trend_break: 'Trend Breaks',
  volatility_spike: 'Volatility Spikes',
};

// `rangeFloor` is a minimum anomaly size as a fraction of the series'
// own value range -- a hard floor independent of std-based scaling, so
// an anomaly can never be too subtle to notice regardless of how calm
// a particular random draw's baseline turned out to be. Easier
// difficulties get a more generous floor (bigger, more obvious
// anomalies); harder difficulties rely more on genuine pattern-reading.
const DIFFICULTY_SETTINGS = {
  easy: { count: 1, magnitudeMult: 3.2, rangeFloor: 0.3, gapLenRange: [5, 8] },
  medium: { count: 2, magnitudeMult: 2.4, rangeFloor: 0.22, gapLenRange: [4, 6] },
  hard: { count: 3, magnitudeMult: 2.0, rangeFloor: 0.16, gapLenRange: [3, 4] },
};

/**
 * Survival mode's continuous difficulty ramp, same settings shape as
 * DIFFICULTY_SETTINGS above so it plugs straight into injectAnomalies().
 * Named tiers top out at 'hard' with nowhere to go for an endless mode,
 * so this interpolates smoothly from roughly 'easy' at wave 1 toward a
 * level tougher than 'hard' by wave 13, then HOLDS there rather than
 * escalating forever -- an endless mode that becomes mathematically
 * unwinnable at infinity isn't more fun, just a longer way to the same
 * guaranteed loss.
 */
export function survivalSettingsForWave(wave) {
  const t = Math.min((wave - 1) / 12, 1);
  return {
    count: Math.min(1 + Math.floor((wave - 1) / 4), 4),
    magnitudeMult: 3.2 - t * 1.6,
    rangeFloor: 0.3 - t * 0.18,
    gapLenRange: [Math.round(5 - t * 2), Math.round(8 - t * 3)],
  };
}

export function stdDev(values) {
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

/** Spaces anomalies > 2x CREDIT_RADIUS apart so no single flag can ever
 * be within radius of two anomalies at once (which would silently
 * double-count credit for one flag). Retries several shuffles before
 * falling back to ignoring spacing (only reachable on a pathologically
 * short series). */
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

/**
 * `referenceStd` lets the caller supply the std of the series BEFORE any
 * smoothing was applied to `cleanValues` (see case.js) -- magnitude is
 * meant to track the metric's natural day-to-day variability, not
 * whatever variability happens to survive smoothing. Scaling off the
 * smoothed series' own (much smaller) std would make every anomaly
 * shrink in lockstep with how calm the baseline was made to look, which
 * is backwards: a calmer baseline should make anomalies read as MORE
 * obvious, not less.
 *
 * `forcedType`, when set, overrides the per-anomaly random type pick so
 * every anomaly in the case is the same type -- used by practice mode to
 * build a case entirely out of a player's weakest anomaly type instead
 * of whatever the normal uniform-random mix happens to deal.
 *
 * `difficulty` accepts either a named tier ('easy'/'medium'/'hard') or a
 * settings object of the same shape directly -- survival mode computes a
 * continuous per-wave settings object (survivalSettingsForWave()) rather
 * than picking from the fixed named tiers, which top out at 'hard'.
 */
export function injectAnomalies(cleanValues, difficulty, rng, referenceStd = null, forcedType = null) {
  const settings = typeof difficulty === 'string' ? DIFFICULTY_SETTINGS[difficulty] : difficulty;
  const out = [...cleanValues];
  const n = out.length;
  const std = referenceStd ?? stdDev(out) ?? 1e-6;
  const range = Math.max(...cleanValues) - Math.min(...cleanValues) || Math.abs(cleanValues[0]) * 0.2 || 1;
  const [gapMin, gapMax] = settings.gapLenRange;

  const chosen = pickAnomalyIndices(n, settings.count, rng);
  const groundTruth = [];

  for (const idx of chosen) {
    const type = forcedType ?? ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
    const direction = rng() < 0.5 ? 1 : -1;
    const stdBasedMagnitude = std * settings.magnitudeMult * (0.85 + rng() * 0.3);
    const magnitude = Math.max(stdBasedMagnitude, range * settings.rangeFloor);

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
    } else if (type === 'trend_break') {
      // the flagged point must itself be visibly off, not just where the
      // slope begins to change -- a pure ramp is exactly zero deviation
      // at i === idx. The immediate step is deliberately LARGER than the
      // base magnitude unit (not a fraction of it) so there's an
      // unmistakable kink right at the break, not a gradual bend that
      // only becomes obvious many points later.
      const immediateStep = magnitude * 1.2;
      const slope = magnitude * 0.08;
      for (let i = idx; i < n; i++) {
        const rawDelta = direction * (immediateStep + (i - idx) * slope);
        const cappedDelta = direction < 0 ? Math.max(rawDelta, -maxDownwardDelta) : rawDelta;
        out[i] += cappedDelta;
      }
    } else {
      // volatility_spike: a short burst of erratic noise around the SAME
      // baseline -- unlike every other type above, the local mean barely
      // moves, only the variance does. The flagged point itself gets a
      // guaranteed real deviation (same fix already applied to
      // trend_break above) -- leaving every point in the burst to a
      // random draw could land the flagged index near zero by chance and
      // make it look perfectly normal despite the burst around it.
      const gapLen = gapMin + Math.floor(rng() * (gapMax - gapMin + 1));
      const amp = magnitude * 0.9;
      out[idx] += (rng() < 0.5 ? -1 : 1) * amp;
      for (let i = idx + 1; i < Math.min(idx + gapLen, n); i++) {
        out[i] += (rng() * 2 - 1) * amp;
      }
    }

    groundTruth.push({ type, index: idx });
  }

  for (let i = 0; i < n; i++) {
    if (cleanValues[i] > 0 && out[i] < cleanValues[i] * 0.15) {
      out[i] = cleanValues[i] * 0.15;
    }
  }

  return { values: out, groundTruth };
}
