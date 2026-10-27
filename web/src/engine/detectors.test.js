import { describe, it, expect } from 'vitest';
import { rollingZScoreDetect, rollingIqrDetect, weeklySeasonalDiffDetect, evaluateFlags, runAllDetectors, evaluateHumanResult, DETECTOR_META } from './detectors.js';

describe('rollingZScoreDetect', () => {
  it('flags an obvious spike against a flat baseline', () => {
    const values = Array(40).fill(100);
    values[20] = 400;
    const { flags } = rollingZScoreDetect(values);
    expect(flags[20]).toBe(true);
    expect(flags.filter(Boolean)).toHaveLength(1);
  });

  it('returns the rolling mean/std/z-score behind each flag, not just the verdict', () => {
    const values = Array(40).fill(100);
    values[20] = 400;
    const { flags, stats } = rollingZScoreDetect(values);
    expect(stats).toHaveLength(values.length);
    expect(stats[20].mean).toBeCloseTo(100, 0);
    expect(Math.abs(stats[20].z)).toBeGreaterThan(3);
    expect(flags[20]).toBe(true);
  });

  it("does not flag a series with no anomalies", () => {
    // Gentle, deterministic wave -- no point should read as a 3-sigma outlier.
    const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 3);
    const { flags } = rollingZScoreDetect(values);
    expect(flags.every((f) => f === false)).toBe(true);
  });

  it(
    'excludes the point under test from its own baseline window -- a window that ' +
      "counted the spike as part of its own baseline would inflate that window's " +
      'mean and std toward the spike, pulling its z-score back below threshold',
    () => {
      // 10 real neighbor points (mean 100, std ~4.9) live at indices 5-9 and
      // 11-15; index 10 is the point under test. With a window of 10,
      // windowExcluding(values, 10, 10) picks exactly those 10 neighbors.
      //
      // Excluding the spike from its own window (correct): z = (117-100)/4.899 ~= 3.47 -> flagged.
      // Including it as an 11th point (the bug this guards against): the
      // spike drags the window's own mean to ~101.5 and std to ~6.76,
      // giving z ~= 2.29 -- below the 3.0 threshold, i.e. the obvious
      // spike would go completely undetected.
      const values = Array(21).fill(100);
      values[5] = 92;
      values[6] = 108;
      values[7] = 94;
      values[8] = 106;
      values[9] = 96;
      values[11] = 104;
      values[12] = 98;
      values[13] = 102;
      values[14] = 100;
      values[15] = 100;
      values[10] = 117;

      const { flags } = rollingZScoreDetect(values, 10, 3.0);
      expect(flags[10]).toBe(true);
    }
  );

  it('handles a near-constant window without dividing by zero', () => {
    const values = Array(30).fill(50);
    expect(() => rollingZScoreDetect(values)).not.toThrow();
    // A flat series' only "deviation" source is float noise; nothing should trip a 3-sigma threshold.
    expect(rollingZScoreDetect(values).flags.every((f) => f === false)).toBe(true);
  });
});

describe('rollingIqrDetect', () => {
  it('flags a clear spike outside the interquartile fence', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    values[25] = 500;
    const { flags } = rollingIqrDetect(values);
    expect(flags[25]).toBe(true);
  });

  it('does not flag ordinary points inside a quiet series', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const { flags } = rollingIqrDetect(values);
    expect(flags.filter(Boolean)).toHaveLength(0);
  });

  it('returns the q1/q3/iqr/bounds behind each flag', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    values[25] = 500;
    const { stats } = rollingIqrDetect(values);
    expect(stats).toHaveLength(values.length);
    expect(stats[25].iqr).toBeCloseTo(stats[25].q3 - stats[25].q1);
    expect(values[25]).toBeGreaterThan(stats[25].upperBound);
  });
});

describe('weeklySeasonalDiffDetect', () => {
  it('flags a day that breaks from the same weekday the week before', () => {
    // A stable weekly pattern (period 7) with one day that suddenly jumps
    // relative to its own same-weekday baseline.
    const pattern = [100, 110, 105, 108, 112, 90, 95];
    const values = Array.from({ length: 35 }, (_, i) => pattern[i % 7]);
    values[21] = 300; // same weekday as index 0/7/14, way off from them
    const { flags } = weeklySeasonalDiffDetect(values);
    expect(flags[21]).toBe(true);
  });

  it('returns false for the first 7 points (no prior week to diff against)', () => {
    const values = Array.from({ length: 20 }, () => 100);
    const { flags, stats } = weeklySeasonalDiffDetect(values);
    expect(flags.slice(0, 7).every((f) => f === false)).toBe(true);
    expect(stats.slice(0, 7).every((s) => s === null)).toBe(true);
  });
});

describe('evaluateFlags', () => {
  it('scores a perfect single-click-per-anomaly human player at recall 1.0', () => {
    const groundTruth = [{ index: 10 }, { index: 50 }];
    const flags = Array(90).fill(false);
    flags[10] = true;
    flags[50] = true;
    const { precision, recall, f1 } = evaluateFlags(flags, groundTruth, 3);
    expect(precision).toBe(1);
    expect(recall).toBe(1);
    expect(f1).toBe(1);
  });

  it(
    'computes recall per ANOMALY EVENT, not per flagged index -- several flags ' +
      'clustered around one anomaly must not inflate recall past what one event is worth',
    () => {
      const groundTruth = [{ index: 10 }, { index: 50 }];
      const flags = Array(90).fill(false);
      // three flags all within tolerance of the SAME event at index 10
      flags[9] = true;
      flags[10] = true;
      flags[11] = true;
      // nothing near the event at index 50

      const { recall } = evaluateFlags(flags, groundTruth, 3);
      // Only 1 of the 2 real anomaly events was found -- an index-based
      // recall would have incorrectly rewarded the 3 clustered flags.
      expect(recall).toBe(0.5);
    }
  );

  it('counts a flag outside every tolerance window as a false alarm, lowering precision', () => {
    const groundTruth = [{ index: 10 }];
    const flags = Array(90).fill(false);
    flags[10] = true; // true positive
    flags[70] = true; // nowhere near any anomaly -- false alarm
    const { precision, recall } = evaluateFlags(flags, groundTruth, 3);
    expect(recall).toBe(1); // the real anomaly was still found
    expect(precision).toBe(0.5); // but only half the flags were "right"
  });

  it('returns zeros for no flags and no ground truth without dividing by zero', () => {
    expect(() => evaluateFlags([], [], 3)).not.toThrow();
    const result = evaluateFlags(Array(10).fill(false), [], 3);
    expect(result).toEqual({ precision: 0, recall: 0, f1: 0 });
  });

  it('gives partial credit via the tolerance window, not just an exact index match', () => {
    const groundTruth = [{ index: 10 }];
    const flags = Array(90).fill(false);
    flags[12] = true; // within tolerance=3 but not the exact index
    const { recall } = evaluateFlags(flags, groundTruth, 3);
    expect(recall).toBe(1);
  });
});

describe('evaluateHumanResult', () => {
  it('matches evaluateFlags\' precision/recall/f1 shape for a perfect result', () => {
    const result = { anomaliesFound: 2, falseAlarms: 0, anomaliesMissed: 0 };
    expect(evaluateHumanResult(result)).toEqual({ precision: 1, recall: 1, f1: 1 });
  });

  it('computes precision/recall from found/false-alarm/missed counts, not from raw flags', () => {
    const result = { anomaliesFound: 1, falseAlarms: 1, anomaliesMissed: 1 };
    const { precision, recall, f1 } = evaluateHumanResult(result);
    expect(precision).toBeCloseTo(0.5);
    expect(recall).toBeCloseTo(0.5);
    expect(f1).toBeCloseTo(0.5);
  });

  it('returns zeros for a null result instead of throwing (e.g. before any round has been revealed)', () => {
    expect(evaluateHumanResult(null)).toEqual({ precision: 0, recall: 0, f1: 0 });
  });
});

describe('runAllDetectors', () => {
  it('returns a scored result for every registered detector', () => {
    const values = Array(40).fill(100);
    values[20] = 400;
    const result = runAllDetectors(values, [{ index: 20, type: 'point_spike' }]);
    expect(Object.keys(result.scores).sort()).toEqual(Object.keys(DETECTOR_META).sort());
    expect(result.combinedFlags).toHaveLength(values.length);
  });

  it('combinedFlags requires at least 2 of 3 detectors to agree', () => {
    const values = Array(40).fill(100);
    values[20] = 400;
    const result = runAllDetectors(values, [{ index: 20, type: 'point_spike' }]);
    const votingDetectors = Object.values(result.flagsByDetector).filter((f) => f[20]).length;
    expect(result.combinedFlags[20]).toBe(votingDetectors >= 2);
  });
});
