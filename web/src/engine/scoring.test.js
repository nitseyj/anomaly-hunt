import { describe, it, expect } from 'vitest';
import { scoreAnomalyHunt, scoreForecastAnswer, CREDIT_RADIUS, TIME_LIMIT_SECONDS, FORECAST_CONFIDENCE_MULTIPLIERS } from './scoring.js';

function flatSeries(length, value = 100) {
  return Array.from({ length }, (_, i) => ({ date: `d${i}`, value }));
}

describe('scoreAnomalyHunt', () => {
  it('gives full per-anomaly credit for a flag exactly on the anomaly', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const result = scoreAnomalyHunt([10], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    expect(result.hits[0].points).toBe(100); // 100 / 1 anomaly, full fraction
    expect(result.accuracyPoints).toBe(100);
    expect(result.falseAlarms).toBe(0);
    expect(result.anomaliesFound).toBe(1);
    expect(result.anomaliesMissed).toBe(0);
  });

  it('credit fades linearly with distance inside the radius and hits zero at the edge', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const half = scoreAnomalyHunt([10 + CREDIT_RADIUS / 2], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    const atEdge = scoreAnomalyHunt([10 + CREDIT_RADIUS], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    expect(half.hits[0].points).toBeCloseTo(50, 0);
    expect(atEdge.hits[0].points).toBe(0);
    // still "found" even at zero credit, since it landed within the radius
    expect(atEdge.anomaliesFound).toBe(1);
  });

  it('counts a guess outside every credit radius as a false alarm, not a miss on a different anomaly', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const result = scoreAnomalyHunt([10 + CREDIT_RADIUS + 5], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    expect(result.anomaliesFound).toBe(0);
    expect(result.anomaliesMissed).toBe(1);
    expect(result.falseAlarms).toBe(1);
    expect(result.falseAlarmPenalty).toBeGreaterThan(0);
  });

  it('splits accuracy credit evenly across multiple ground-truth anomalies', () => {
    const groundTruth = [
      { index: 10, type: 'point_spike' },
      { index: 50, type: 'level_shift' },
    ];
    const result = scoreAnomalyHunt([10, 50], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    expect(result.hits[0].points).toBe(50);
    expect(result.hits[1].points).toBe(50);
    expect(result.accuracyPoints).toBe(100);
  });

  it('matches an anomaly to its closest guess when several guesses fall within its radius, and counts the rest as false alarms', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    // distances from 10: 5, 2, 1 -- the closest (9) should win
    const result = scoreAnomalyHunt([5, 12, 9], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    expect(result.hits[0].matchedIndex).toBe(9);
    expect(result.falseAlarms).toBe(2);
  });

  it(
    "relies on ground-truth anomalies being spaced > 2x CREDIT_RADIUS apart (anomalies.js's " +
      'job) to guarantee one flag is never double-credited across two anomalies -- this just ' +
      'documents that assumption against the actual CREDIT_RADIUS constant, so a future change ' +
      "to either value doesn't silently break the other side of the contract",
    () => {
      const groundTruth = [
        { index: 10, type: 'point_spike' },
        { index: 10 + CREDIT_RADIUS * 2 + 2, type: 'point_spike' },
      ];
      // An even gap puts the midpoint exactly CREDIT_RADIUS + 1 from both --
      // safely outside radius of either anomaly.
      const midpoint = (groundTruth[0].index + groundTruth[1].index) / 2;
      const result = scoreAnomalyHunt([midpoint], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
      expect(result.hits.filter((h) => h.matchedIndex === midpoint)).toHaveLength(0);
    }
  );

  it('scales the speed bonus with time remaining and awards zero at zero seconds left', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const fullTime = scoreAnomalyHunt([10], groundTruth, TIME_LIMIT_SECONDS, flatSeries(90));
    const noTime = scoreAnomalyHunt([10], groundTruth, 0, flatSeries(90));
    expect(fullTime.speedBonus).toBeGreaterThan(noTime.speedBonus);
    expect(noTime.speedBonus).toBe(0);
  });

  it('never returns negative total points even with heavy false-alarm penalties', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const manyFalseAlarms = Array.from({ length: 6 }, (_, i) => 10 + CREDIT_RADIUS + 20 + i);
    const result = scoreAnomalyHunt(manyFalseAlarms, groundTruth, 0, flatSeries(90));
    expect(result.points).toBeGreaterThanOrEqual(0);
  });

  it('incorporates vertical (y) error when a guessed value is supplied', () => {
    const groundTruth = [{ index: 10, type: 'point_spike' }];
    const series = flatSeries(90);
    series[10] = { date: 'd10', value: 500 }; // true value at the anomaly
    const accurateY = scoreAnomalyHunt([10], groundTruth, TIME_LIMIT_SECONDS, series, { 10: 500 });
    const wildlyOffY = scoreAnomalyHunt([10], groundTruth, TIME_LIMIT_SECONDS, series, { 10: -500 });
    expect(accurateY.hits[0].points).toBeGreaterThan(wildlyOffY.hits[0].points);
  });
});

describe('scoreForecastAnswer', () => {
  it('awards more points for a correct call at higher declared confidence', () => {
    const low = scoreForecastAnswer(true, 'low');
    const medium = scoreForecastAnswer(true, 'medium');
    const high = scoreForecastAnswer(true, 'high');
    expect(low.points).toBeLessThan(medium.points);
    expect(medium.points).toBeLessThan(high.points);
    expect(low.points).toBeGreaterThan(0);
  });

  it('penalizes a wrong call more heavily at higher declared confidence', () => {
    const low = scoreForecastAnswer(false, 'low');
    const high = scoreForecastAnswer(false, 'high');
    expect(low.points).toBeLessThan(0);
    expect(high.points).toBeLessThan(low.points); // more negative
  });

  it('applies the documented multiplier for each confidence level', () => {
    for (const [level, mult] of Object.entries(FORECAST_CONFIDENCE_MULTIPLIERS)) {
      const { multiplier } = scoreForecastAnswer(true, level);
      expect(multiplier).toBe(mult);
    }
  });
});
