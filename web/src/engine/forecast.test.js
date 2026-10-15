import { describe, it, expect } from 'vitest';
import {
  generateForecastRound,
  buildRangeQuestion,
  buildDirectionQuestion,
  buildMagnitudeQuestion,
  buildPatternQuestion,
  buildBusinessQuestion,
} from './forecast.js';
import { createRng } from './rng.js';

function series(values) {
  return values.map((value, i) => ({ date: `d${i}`, value }));
}

describe('buildRangeQuestion', () => {
  it(
    'never collapses the correct band to zero width, even when the series is ' +
      'pinned flat at zero (e.g. a defect rate sitting at its own floor) -- a ' +
      'zero-width band would render as a degenerate "0% - 0%" option',
    () => {
      const visible = series(Array(60).fill(0));
      const hidden = series(Array(27).fill(0));
      const rng = createRng(1);
      const q = buildRangeQuestion(visible, hidden, 'percent', rng);
      const correct = q.options.find((o) => o.id === 'correct');
      expect(correct).toBeTruthy();
      // The rendered label embeds the formatted low/high bounds; for a
      // genuinely zero-width band those would be identical.
      const [low, high] = correct.label.split('–').map((s) => s.trim());
      expect(low).not.toBe(high);
    }
  );

  it('keeps the three bands (correct/above/below) non-overlapping', () => {
    const visible = series(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 8));
    const hidden = series(Array.from({ length: 27 }, (_, i) => 100 + Math.cos(i / 3) * 8));
    const rng = createRng(42);
    const q = buildRangeQuestion(visible, hidden, 'usd', rng);
    expect(q.options).toHaveLength(3);
    expect(new Set(q.options.map((o) => o.id)).size).toBe(3);
  });
});

describe('buildDirectionQuestion', () => {
  it('calls a clear rise "up"', () => {
    const visible = series([100]);
    const hidden = series([200]);
    const q = buildDirectionQuestion(visible, hidden, 'count', createRng(1));
    expect(q.correctId).toBe('up');
  });

  it('calls a clear drop "down"', () => {
    const visible = series([100]);
    const hidden = series([20]);
    const q = buildDirectionQuestion(visible, hidden, 'count', createRng(1));
    expect(q.correctId).toBe('down');
  });

  it('calls a negligible move "flat"', () => {
    const visible = series([100]);
    const hidden = series([100.5]);
    const q = buildDirectionQuestion(visible, hidden, 'count', createRng(1));
    expect(q.correctId).toBe('flat');
  });
});

describe('buildMagnitudeQuestion', () => {
  it('buckets percent change into small / moderate / large correctly', () => {
    const small = buildMagnitudeQuestion(series([100]), series([102]), 'count', createRng(1));
    const moderate = buildMagnitudeQuestion(series([100]), series([110]), 'count', createRng(1));
    const large = buildMagnitudeQuestion(series([100]), series([140]), 'count', createRng(1));
    expect(small.correctId).toBe('small');
    expect(moderate.correctId).toBe('moderate');
    expect(large.correctId).toBe('large');
  });
});

describe('buildBusinessQuestion', () => {
  it('for a metric where lower is better (e.g. defect_rate), a drop counts as "improves"', () => {
    const q = buildBusinessQuestion(series([10]), series([5]), 'defect_rate', 'Defect rate', createRng(1));
    expect(q.correctId).toBe('improves');
  });

  it('for a metric where higher is better (e.g. revenue), a rise counts as "improves"', () => {
    const q = buildBusinessQuestion(series([10]), series([20]), 'revenue', 'Revenue', createRng(1));
    expect(q.correctId).toBe('improves');
  });

  it('a revenue drop counts as "worsens", not "improves"', () => {
    const q = buildBusinessQuestion(series([10]), series([5]), 'revenue', 'Revenue', createRng(1));
    expect(q.correctId).toBe('worsens');
  });
});

describe('buildPatternQuestion', () => {
  it('calls a steady monotonic rise "steady"', () => {
    const hidden = series([10, 20, 30, 40, 50]);
    const q = buildPatternQuestion(series([5]), hidden, 'count', createRng(1));
    expect(q.correctId).toBe('steady');
  });

  it('calls a swing back toward the start "reverts"', () => {
    const hidden = series([10, 50, 90, 50, 12]);
    const q = buildPatternQuestion(series([5]), hidden, 'count', createRng(1));
    expect(q.correctId).toBe('reverts');
  });
});

describe('generateForecastRound', () => {
  it('splits the series at 70% visible / 30% hidden', () => {
    const caseData = { series: series(Array.from({ length: 100 }, (_, i) => 100 + i)), unit: 'count', label: 'Tickets opened', templateId: 'support_tickets' };
    const round = generateForecastRound(caseData, createRng(1));
    expect(round.visible).toHaveLength(70);
    expect(round.hidden).toHaveLength(30);
    expect(round.cutIndex).toBe(70);
  });

  it('always produces a correctId that matches one of the rendered options', () => {
    const caseData = { series: series(Array.from({ length: 90 }, (_, i) => 100 + Math.sin(i / 5) * 10)), unit: 'usd', label: 'Revenue', templateId: 'revenue' };
    for (let seed = 0; seed < 20; seed++) {
      const round = generateForecastRound(caseData, createRng(seed));
      expect(round.options.map((o) => o.id)).toContain(round.correctId);
      expect(round.options).toHaveLength(3);
    }
  });
});
