/**
 * case.js
 *
 * Builds one playable Anomaly Hunt round: pick a template, generate a
 * clean series, inject anomalies, clamp to the unit's physical floor.
 * Every mode (random play, Daily Challenge, imported data) funnels
 * through here so they're scored/detected/displayed identically.
 */
import { createRng, randomSeed } from './rng.js';
import { pickTemplate, clampToUnit, movingAverage, SERIES_LENGTH } from './metrics.js';
import { injectAnomalies } from './anomalies.js';

const round2 = (v) => Math.round(v * 100) / 100;

function caseId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateAnomalyCase(difficulty, usedTemplateIds = [], seed = null) {
  const rng = createRng(seed ?? randomSeed());
  const { template, scenario } = pickTemplate(rng, usedTemplateIds);
  const { dates, values: rawValues } = template.generate(rng, SERIES_LENGTH);
  const cleanValues = movingAverage(rawValues, 3);
  const { values: injected, groundTruth } = injectAnomalies(cleanValues, difficulty, rng);
  const clamped = clampToUnit(injected, template.unit);

  return {
    id: caseId(),
    templateId: template.id,
    title: scenario.title,
    brief: scenario.brief,
    label: template.label,
    unit: template.unit,
    difficulty,
    series: dates.map((date, i) => ({ date, value: round2(clamped[i]) })),
    groundTruth,
  };
}

export function generateCaseFromSeries(series, unit, difficulty, title) {
  const rng = createRng(randomSeed());
  const dates = series.map((p) => p.date);
  const cleanValues = series.map((p) => p.value);
  const { values: injected, groundTruth } = injectAnomalies(cleanValues, difficulty, rng);
  const clamped = clampToUnit(injected, unit || 'count');

  return {
    id: caseId(),
    templateId: 'imported',
    title: title || 'Custom Data Investigation',
    brief: 'Your own imported dataset. Find whatever looks out of place.',
    label: 'Value',
    unit: unit || 'count',
    difficulty,
    series: dates.map((date, i) => ({ date, value: round2(clamped[i]) })),
    groundTruth,
  };
}

export const DIFFICULTY_SEQUENCE = ['easy', 'medium', 'medium', 'hard', 'hard'];
