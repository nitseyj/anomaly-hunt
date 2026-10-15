import { describe, it, expect } from 'vitest';
import { createRng, gaussian, randomSeed, smoothNoise } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(777);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('does not repeat the same value every call (not stuck)', () => {
    const rng = createRng(42);
    const values = new Set(Array.from({ length: 50 }, () => rng()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('randomSeed', () => {
  it('returns a non-negative integer usable as a createRng seed', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    // must not throw when fed straight into createRng
    expect(() => createRng(seed)()).not.toThrow();
  });
});

describe('gaussian', () => {
  it('samples cluster around the requested mean and std over a large draw', () => {
    const rng = createRng(99);
    const n = 20000;
    const samples = Array.from({ length: n }, () => gaussian(rng, 50, 10));
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    // Loose tolerance -- this is a statistical sanity check, not an exact
    // equality (a Box-Muller sample over 20k draws should land close).
    expect(mean).toBeGreaterThan(48);
    expect(mean).toBeLessThan(52);
    expect(std).toBeGreaterThan(9);
    expect(std).toBeLessThan(11);
  });
});

describe('smoothNoise', () => {
  it('returns a series of the requested length', () => {
    const rng = createRng(5);
    const out = smoothNoise(rng, 90, 10);
    expect(out).toHaveLength(90);
  });

  it('is day-to-day correlated, not independent i.i.d. noise', () => {
    // With momentum, the lag-1 autocorrelation should be clearly positive
    // -- this is the entire point of smoothNoise over plain gaussian().
    const rng = createRng(5);
    const series = smoothNoise(rng, 2000, 10, 0.65);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < series.length; i++) {
      den += (series[i] - mean) ** 2;
      if (i > 0) num += (series[i] - mean) * (series[i - 1] - mean);
    }
    const lag1Autocorrelation = num / den;
    expect(lag1Autocorrelation).toBeGreaterThan(0.4);
  });

  it('its stationary standard deviation tracks the requested std, not the raw innovation std', () => {
    // The whole reason smoothNoise scales down its per-step innovation
    // (innovationStd = std * sqrt(1 - momentum^2)) is so the resulting
    // series' own std still matches the caller's `std` argument --
    // anomaly injection sizes effects off this value (see anomalies.js),
    // so if this drifted, anomaly magnitudes would silently drift too.
    const rng = createRng(123);
    const targetStd = 25;
    const series = smoothNoise(rng, 5000, targetStd, 0.65);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
    const actualStd = Math.sqrt(variance);
    expect(actualStd).toBeGreaterThan(targetStd * 0.85);
    expect(actualStd).toBeLessThan(targetStd * 1.15);
  });
});
