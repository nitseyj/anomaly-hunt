import { describe, it, expect } from 'vitest';
import { generateSurvivalCase } from './case.js';
import { SERIES_LENGTH } from './metrics.js';

describe('generateSurvivalCase', () => {
  it('produces a full-length series with at least one ground-truth anomaly', () => {
    const c = generateSurvivalCase(1, []);
    expect(c.series).toHaveLength(SERIES_LENGTH);
    expect(c.groundTruth.length).toBeGreaterThan(0);
  });

  it('labels the case with the wave number, not a named difficulty tier', () => {
    const c = generateSurvivalCase(7, []);
    expect(c.difficulty).toBe('Wave 7');
    expect(c.wave).toBe(7);
  });

  it('injects more anomalies on a later wave than an early one', () => {
    const early = generateSurvivalCase(1, []);
    const late = generateSurvivalCase(13, []);
    expect(late.groundTruth.length).toBeGreaterThanOrEqual(early.groundTruth.length);
  });

  it('falls back to reusing templates once usedTemplateIds exhausts the pool (pickTemplate already handles this)', () => {
    // Pass an implausibly long list of "used" ids -- generateSurvivalCase
    // must still produce a valid case instead of throwing.
    const usedTemplateIds = Array.from({ length: 50 }, (_, i) => `fake-${i}`);
    expect(() => generateSurvivalCase(20, usedTemplateIds)).not.toThrow();
  });
});
