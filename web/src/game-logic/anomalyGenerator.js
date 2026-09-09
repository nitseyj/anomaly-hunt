/**
 * anomalyGenerator.js
 *
 * Generates one round of the "Anomaly Hunt" mode: a fresh business
 * metric series (via businessMetrics.js) with 1-3 injected, labeled
 * anomalies. Every call produces different template, parameters, and
 * anomaly placement -- no two rounds look the same.
 */

import { mulberry32, stdDev, clampToUnit, pickTemplate, SERIES_LENGTH } from './businessMetrics.js';

const ANOMALY_TYPES = ['point_spike', 'level_shift', 'missing_gap', 'trend_break'];

const DIFFICULTY_SETTINGS = {
  easy: { nAnomalies: 1, magnitudeMult: 3.2, gapLenRange: [5, 8] },
  medium: { nAnomalies: 2, magnitudeMult: 2.4, gapLenRange: [4, 6] },
  hard: { nAnomalies: 3, magnitudeMult: 2.0, gapLenRange: [3, 4] },
};

function injectAnomalies(values, difficulty, rng) {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const out = [...values];
  const n = out.length;
  const std = stdDev(out) || 1e-6; // guard against a perfectly flat clean series

  const candidateStart = Math.floor(n * 0.15);
  const candidateEnd = Math.floor(n * 0.85);
  const candidates = [];
  for (let i = candidateStart; i < candidateEnd; i++) candidates.push(i);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  // keep chosen anomalies reasonably spaced apart so they don't visually merge
  const chosen = [];
  for (const idx of candidates) {
    if (chosen.every((c) => Math.abs(c - idx) > n * 0.12)) chosen.push(idx);
    if (chosen.length === settings.nAnomalies) break;
  }
  // Fallback: if the spacing rule couldn't seat every requested anomaly
  // (only possible on very short series), fill remaining slots ignoring
  // spacing rather than silently shipping a round with fewer anomalies
  // than its difficulty promises.
  for (const idx of candidates) {
    if (chosen.length >= settings.nAnomalies) break;
    if (!chosen.includes(idx)) chosen.push(idx);
  }

  const [gapMin, gapMax] = settings.gapLenRange;
  const groundTruth = [];

  for (const idx of chosen) {
    const type = ANOMALY_TYPES[Math.floor(rng() * ANOMALY_TYPES.length)];
    const direction = rng() < 0.5 ? 1 : -1;
    // Small random jitter around the difficulty's target magnitude, instead
    // of stacking extra ad-hoc multipliers per type -- keeps "hard" actually
    // subtler than "easy" consistently across every anomaly type.
    const magnitude = std * settings.magnitudeMult * (0.85 + rng() * 0.3);

    if (type === 'point_spike') {
      out[idx] += direction * magnitude;
    } else if (type === 'level_shift') {
      for (let i = idx; i < n; i++) out[i] += direction * magnitude;
    } else if (type === 'missing_gap') {
      const gapLen = gapMin + Math.floor(rng() * (gapMax - gapMin + 1));
      const flatValue = out[Math.max(idx - 1, 0)];
      for (let i = idx; i < Math.min(idx + gapLen, n); i++) out[i] = flatValue;
    } else {
      // trend_break: the flagged point must ITSELF be visibly off, not just
      // a slope pivot that looks identical to its neighbors -- an earlier
      // version added `(i - idx) * slope`, which is exactly zero at
      // i === idx, so the exact point players had to find looked completely
      // normal. Fixed with an immediate step at idx (comparably visible to
      // a level shift at the same difficulty) plus a continuing slope
      // change, so it still reads as a trend break, not a one-off spike.
      const immediateStep = magnitude * 0.9;
      const slope = magnitude * 0.08;
      for (let i = idx; i < n; i++) {
        out[i] += direction * (immediateStep + (i - idx) * slope);
      }
    }

    groundTruth.push({ type, index: idx });
  }

  return { values: out, groundTruth };
}

/**
 * Builds one fresh, randomized Anomaly Hunt round. Call this again any
 * time you want a brand new case — every call produces a different
 * template, different randomized parameters, and different anomalies.
 */
export function generateCase(difficulty, usedTemplateIds = []) {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  const { template, scenario } = pickTemplate(rng, usedTemplateIds);

  const { dates, values: cleanValues } = template.generate(rng, SERIES_LENGTH);
  const { values: injectedValues, groundTruth } = injectAnomalies(cleanValues, difficulty, rng);
  // Anomaly injection (esp. a downward level shift or trend break) can push
  // a metric below what's physically sensible for its unit -- a negative
  // ticket count, a negative user count -- even though the clean generator
  // already floors its own output. Clamp again post-injection to catch that.
  const clampedValues = clampToUnit(injectedValues, template.unit);

  const round2 = (v) => Math.round(v * 100) / 100;

  return {
    templateId: template.id,
    case_name: scenario.case_name,
    scenario: scenario.scenario,
    y_label: template.y_label,
    unit: template.unit,
    difficulty,
    series: dates.map((date, i) => ({ date, value: round2(clampedValues[i]) })),
    ground_truth_anomalies: groundTruth,
  };
}

export const DIFFICULTY_SEQUENCE = ['easy', 'medium', 'medium', 'hard', 'hard'];
