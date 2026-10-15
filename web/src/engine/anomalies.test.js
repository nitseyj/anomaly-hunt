import { describe, it, expect } from 'vitest';
import { injectAnomalies, stdDev, ANOMALY_TYPES } from './anomalies.js';
import { createRng } from './rng.js';
import { CREDIT_RADIUS } from './scoring.js';

function cleanBaseline(length = 90, base = 100, noiseAmp = 2) {
  // Deterministic, gently varying baseline -- not a flat line (a flat
  // line has std 0, which would make the std-based magnitude path
  // degenerate for every test, masking bugs in that path specifically).
  return Array.from({ length }, (_, i) => base + Math.sin(i / 5) * noiseAmp);
}

describe('injectAnomalies', () => {
  it('injects exactly as many anomalies as the difficulty specifies', () => {
    const rng = createRng(1);
    const easy = injectAnomalies(cleanBaseline(), 'easy', rng);
    expect(easy.groundTruth).toHaveLength(1);

    const medium = injectAnomalies(cleanBaseline(), 'medium', createRng(2));
    expect(medium.groundTruth).toHaveLength(2);

    const hard = injectAnomalies(cleanBaseline(), 'hard', createRng(3));
    expect(hard.groundTruth).toHaveLength(3);
  });

  it(
    'spaces anomalies more than 2x CREDIT_RADIUS apart so a single flag can never ' +
      'fall within radius of two anomalies at once (which would double-count credit)',
    () => {
      // Run several seeds -- spacing is probabilistic (shuffled candidates),
      // so a single lucky seed passing wouldn't prove the invariant holds.
      for (let seed = 0; seed < 15; seed++) {
        const rng = createRng(seed * 97 + 1);
        const { groundTruth } = injectAnomalies(cleanBaseline(), 'hard', rng);
        const indices = groundTruth.map((a) => a.index).sort((a, b) => a - b);
        for (let i = 1; i < indices.length; i++) {
          expect(indices[i] - indices[i - 1]).toBeGreaterThan(CREDIT_RADIUS * 2);
        }
      }
    }
  );

  it('only picks anomaly types from the documented set', () => {
    const rng = createRng(4);
    const { groundTruth } = injectAnomalies(cleanBaseline(), 'hard', rng);
    for (const a of groundTruth) {
      expect(ANOMALY_TYPES).toContain(a.type);
    }
  });

  it('a point_spike anomaly visibly deviates at its own index', () => {
    // Force the type by checking across seeds until we land one, since
    // type selection is itself randomized.
    for (let seed = 0; seed < 40; seed++) {
      const clean = cleanBaseline();
      const rng = createRng(seed);
      const { values, groundTruth } = injectAnomalies(clean, 'easy', rng);
      const spike = groundTruth.find((a) => a.type === 'point_spike');
      if (!spike) continue;
      const deviation = Math.abs(values[spike.index] - clean[spike.index]);
      expect(deviation).toBeGreaterThan(0);
      return;
    }
    throw new Error('no point_spike drawn in 40 seeds -- widen the search or check type odds');
  });

  it('a level_shift anomaly stays shifted for every point after its index, not just at it', () => {
    for (let seed = 0; seed < 40; seed++) {
      const clean = cleanBaseline();
      const rng = createRng(seed);
      const { values, groundTruth } = injectAnomalies(clean, 'easy', rng);
      const shift = groundTruth.find((a) => a.type === 'level_shift');
      if (!shift) continue;
      const deltaAtStart = values[shift.index] - clean[shift.index];
      const deltaNearEnd = values[clean.length - 1] - clean[clean.length - 1];
      expect(Math.abs(deltaAtStart)).toBeGreaterThan(0);
      // the shift should persist (same sign, not decayed back to ~0) all the way to the end
      expect(Math.sign(deltaNearEnd)).toBe(Math.sign(deltaAtStart));
      expect(Math.abs(deltaNearEnd)).toBeGreaterThan(0);
      return;
    }
    throw new Error('no level_shift drawn in 40 seeds');
  });

  it('a missing_gap anomaly flattens a run of points to a single repeated value', () => {
    for (let seed = 0; seed < 40; seed++) {
      const clean = cleanBaseline();
      const rng = createRng(seed);
      const { values, groundTruth } = injectAnomalies(clean, 'easy', rng);
      const gap = groundTruth.find((a) => a.type === 'missing_gap');
      if (!gap) continue;
      const flatValue = values[gap.index];
      // at least the next couple of points should repeat the same flat value
      expect(values[gap.index + 1]).toBe(flatValue);
      return;
    }
    throw new Error('no missing_gap drawn in 40 seeds');
  });

  it(
    'a trend_break anomaly is visibly off AT its own index, not just in the slope ' +
      'that follows -- a pure ramp starting at idx would have zero deviation there',
    () => {
      for (let seed = 0; seed < 40; seed++) {
        const clean = cleanBaseline();
        const rng = createRng(seed);
        const { values, groundTruth } = injectAnomalies(clean, 'easy', rng);
        const trendBreak = groundTruth.find((a) => a.type === 'trend_break');
        if (!trendBreak) continue;
        const deviationAtIdx = Math.abs(values[trendBreak.index] - clean[trendBreak.index]);
        expect(deviationAtIdx).toBeGreaterThan(0.01);
        return;
      }
      throw new Error('no trend_break drawn in 40 seeds');
    }
  );

  it('falls back to the range-based magnitude floor on an almost-flat series instead of injecting a vanishing anomaly', () => {
    const almostFlat = Array(90).fill(100);
    expect(stdDev(almostFlat)).toBe(0);
    const rng = createRng(8);
    const { values, groundTruth } = injectAnomalies(almostFlat, 'easy', rng, 0);
    const idx = groundTruth[0].index;
    const deviation = Math.abs(values[idx] - almostFlat[idx]);
    // easy's rangeFloor is 0.3 of the series' own value range; on a flat
    // series the range-fallback (`Math.abs(cleanValues[0]) * 0.2`) still
    // guarantees a real, non-trivial magnitude.
    expect(deviation).toBeGreaterThan(1);
  });

  it('never lets an injected value collapse below 15% of the clean positive value at that point', () => {
    const rng = createRng(11);
    const clean = cleanBaseline(90, 100, 2);
    const { values } = injectAnomalies(clean, 'hard', rng);
    for (let i = 0; i < values.length; i++) {
      if (clean[i] > 0) {
        expect(values[i]).toBeGreaterThanOrEqual(clean[i] * 0.15 - 1e-9);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const clean = cleanBaseline();
    const a = injectAnomalies(clean, 'medium', createRng(555));
    const b = injectAnomalies(clean, 'medium', createRng(555));
    expect(a.values).toEqual(b.values);
    expect(a.groundTruth).toEqual(b.groundTruth);
  });
});
