/**
 * forecastScoring.js
 *
 * Scores a Forecast Call MCQ answer with confidence calibration: higher
 * declared confidence amplifies BOTH the reward for being right and the
 * penalty for being wrong. This is what makes "confidence" a real
 * analytical signal rather than decoration -- a high-confidence wrong
 * answer costs more than a low-confidence wrong answer, and the game
 * rewards well-calibrated judgement (knowing when you're actually sure)
 * over blind conviction.
 */

const BASE_CORRECT_POINTS = 100;
const BASE_INCORRECT_PENALTY = 20;

const CONFIDENCE_MULTIPLIERS = {
  low: 0.8,
  medium: 1.0,
  high: 1.3,
};

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

export function scoreForecastAnswer(isCorrect, confidence) {
  const multiplier = CONFIDENCE_MULTIPLIERS[confidence] ?? 1.0;

  if (isCorrect) {
    return { points: Math.round(BASE_CORRECT_POINTS * multiplier), multiplier };
  }

  const penalty = Math.round(BASE_INCORRECT_PENALTY * multiplier);
  return { points: -penalty, multiplier };
}

export { CONFIDENCE_MULTIPLIERS };
