/**
 * forecastGenerator.js
 *
 * Generates one round of "Forecast Call": a clean (no injected anomalies)
 * business metric series with the final stretch hidden. The player
 * predicts the value on the day right after what they can see; scoring
 * is based on percentage error against the real generated value.
 *
 * Deliberately reuses the same template library as anomalyGenerator.js
 * (via businessMetrics.js) rather than duplicating the metric definitions
 * -- the two modes are different challenges built on the same data engine.
 */

import { mulberry32, pickTemplate, SERIES_LENGTH } from './businessMetrics.js';

const HIDDEN_DAYS = 14; // player sees SERIES_LENGTH - HIDDEN_DAYS days, predicts the day right after

/**
 * Builds one fresh Forecast Call round -- a real trend+seasonality series
 * with the ending hidden. Forecast error is already a continuous,
 * self-scaling measure of skill, so unlike Anomaly Hunt this mode doesn't
 * need a difficulty knob.
 */
export function generateForecast(usedTemplateIds = []) {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  const { template, scenario } = pickTemplate(rng, usedTemplateIds);

  const { dates, values } = template.generate(rng, SERIES_LENGTH);
  const visibleCount = SERIES_LENGTH - HIDDEN_DAYS;

  const round2 = (v) => Math.round(v * 100) / 100;

  return {
    templateId: template.id,
    case_name: scenario.case_name,
    scenario: scenario.scenario,
    y_label: template.y_label,
    unit: template.unit,
    visibleSeries: dates.slice(0, visibleCount).map((date, i) => ({ date, value: round2(values[i]) })),
    targetDate: dates[visibleCount],
    actualValue: round2(values[visibleCount]),
  };
}

export const FORECAST_ROUND_COUNT = 5;
