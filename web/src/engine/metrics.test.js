import { describe, it, expect } from 'vitest';
import { makeDates, movingAverage, clampToUnit, formatValue, pickTemplate, METRIC_TEMPLATES } from './metrics.js';
import { createRng } from './rng.js';

describe('makeDates', () => {
  it('produces consecutive calendar days with no timezone drift', () => {
    const dates = makeDates(10);
    expect(dates).toHaveLength(10);
    expect(dates[0]).toBe('2024-01-01');
    expect(dates[9]).toBe('2024-01-10');
    // every date differs from the previous by exactly one calendar day
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(`${dates[i - 1]}T00:00:00`);
      const curr = new Date(`${dates[i]}T00:00:00`);
      expect((curr - prev) / 86400000).toBe(1);
    }
  });

  it('crosses a month boundary correctly', () => {
    const dates = makeDates(5, 29); // Jan 1 + 29 = Jan 30
    expect(dates).toEqual(['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02', '2024-02-03']);
  });
});

describe('movingAverage', () => {
  it('leaves a constant series unchanged', () => {
    const values = Array(20).fill(50);
    expect(movingAverage(values)).toEqual(values);
  });

  it('smooths out a single-point spike', () => {
    const values = Array(20).fill(50);
    values[10] = 500;
    const smoothed = movingAverage(values, 3);
    expect(smoothed[10]).toBeLessThan(500);
    expect(smoothed[10]).toBeGreaterThan(50);
  });

  it('returns a series of the same length, including at the edges', () => {
    const values = Array.from({ length: 15 }, (_, i) => i);
    const smoothed = movingAverage(values, 5);
    expect(smoothed).toHaveLength(values.length);
  });
});

describe('clampToUnit', () => {
  it('floors ms values at 15 (a response time can\'t be near-zero in practice)', () => {
    const out = clampToUnit([5, 10, 20, 100], 'ms');
    expect(out).toEqual([15, 15, 20, 100]);
  });

  it('floors count/usd/percent/roas at 0', () => {
    expect(clampToUnit([-5, 0, 5], 'count')).toEqual([0, 0, 5]);
  });

  it('passes through an unrecognized unit unchanged', () => {
    const values = [-5, 0, 5];
    expect(clampToUnit(values, 'unknown_unit')).toBe(values);
  });
});

describe('formatValue', () => {
  it('formats each unit with its documented shape', () => {
    expect(formatValue(1234.5, 'usd')).toBe('$1,235');
    expect(formatValue(12.345, 'percent')).toBe('12.35%');
    expect(formatValue(42.1, 'ms')).toBe('42.1ms');
    expect(formatValue(1234.6, 'count')).toBe('1,235');
    expect(formatValue(2.456, 'roas')).toBe('2.46x');
  });
});

describe('pickTemplate', () => {
  it('excludes already-used template ids when alternatives remain', () => {
    const used = METRIC_TEMPLATES.slice(0, -1).map((t) => t.id);
    const rng = createRng(1);
    const { template } = pickTemplate(rng, used);
    expect(template.id).toBe(METRIC_TEMPLATES[METRIC_TEMPLATES.length - 1].id);
  });

  it('falls back to the full pool once every template has been used', () => {
    const allUsed = METRIC_TEMPLATES.map((t) => t.id);
    const rng = createRng(1);
    expect(() => pickTemplate(rng, allUsed)).not.toThrow();
    const { template } = pickTemplate(rng, allUsed);
    expect(METRIC_TEMPLATES.map((t) => t.id)).toContain(template.id);
  });
});
