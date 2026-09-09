/**
 * forecastScoring.js
 *
 * Scores a Forecast Call guess by percentage error against the real
 * value, using the same "full credit near the target, fading to zero"
 * philosophy as the distance-based Anomaly Hunt scoring (scoring.js) --
 * consistent scoring logic across both game modes, just measured in
 * percent-error instead of chart-index distance.
 */

const FULL_CREDIT_PCT = 5; // error at or under this earns full credit
const ZERO_CREDIT_PCT = 40; // error at or over this earns nothing
const MAX_POINTS = 100;

export function scoreForecast(guess, actual) {
  const denom = Math.max(Math.abs(actual), 1e-9);
  const errorPct = (Math.abs(guess - actual) / denom) * 100;

  let creditFraction;
  if (errorPct <= FULL_CREDIT_PCT) {
    creditFraction = 1;
  } else if (errorPct >= ZERO_CREDIT_PCT) {
    creditFraction = 0;
  } else {
    creditFraction = 1 - (errorPct - FULL_CREDIT_PCT) / (ZERO_CREDIT_PCT - FULL_CREDIT_PCT);
  }

  return {
    errorPct: Math.round(errorPct * 10) / 10,
    points: Math.round(creditFraction * MAX_POINTS),
  };
}

export const FORECAST_FULL_CREDIT_PCT = FULL_CREDIT_PCT;
export const FORECAST_ZERO_CREDIT_PCT = ZERO_CREDIT_PCT;
