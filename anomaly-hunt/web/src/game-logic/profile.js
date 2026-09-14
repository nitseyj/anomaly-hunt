/**
 * profile.js
 *
 * Tracks lifetime progression across both game modes -- not just a
 * points total, but the running sums needed to compute REAL accuracy,
 * false-alarm-rate, and skill percentages (see getDerivedStats below).
 * Nothing here is fabricated: every stat is derived from actual
 * recorded per-case results, most of which are only ever known at
 * runtime (accuracy, F1 scores) and can't be hard-coded.
 */

const STORAGE_KEY = 'anomaly-hunt-profile';

const RANKS = [
  { threshold: 0, title: 'Rookie Investigator' },
  { threshold: 300, title: 'Field Investigator' },
  { threshold: 800, title: 'Senior Investigator' },
  { threshold: 1500, title: 'Lead Analyst' },
  { threshold: 3000, title: 'Master Detective' },
];

function defaultProfile() {
  return {
    lifetimePoints: 0,
    gamesPlayed: 0,
    bestAnomalyScore: 0,
    bestForecastScore: 0,

    // Anomaly Hunt running sums (per case, not per game) -- used to derive
    // real accuracy/false-alarm-rate/reasoning percentages, never guessed.
    anomalyCasesPlayed: 0,
    anomalyAccuracySum: 0, // sum of accuracyPoints (0-100) across cases
    anomalyFalseAlarmRateSum: 0, // sum of (falseAlarms / totalFlags), 0-1 per case
    anomalyReasoningSum: 0, // sum of a 0-1 "beat the average detector" score per case

    // Forecast Call running sums
    forecastCasesPlayed: 0,
    forecastCorrectCount: 0,
  };
}

function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage unavailable -- stats just won't persist this session, non-fatal
  }
  return profile;
}

export function getProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

/** Called once at the end of a game session -- updates lifetime points, games played, and best score. */
export function recordGameResult(mode, points) {
  const profile = getProfile();
  profile.lifetimePoints += points;
  profile.gamesPlayed += 1;
  if (mode === 'anomaly_hunt') profile.bestAnomalyScore = Math.max(profile.bestAnomalyScore, points);
  if (mode === 'forecast_call') profile.bestForecastScore = Math.max(profile.bestForecastScore, points);
  return saveProfile(profile);
}

/**
 * Called once per Anomaly Hunt case (not once per game) -- this is what
 * makes "Anomaly detection accuracy" and "False alarm rate" real running
 * averages rather than a single game's snapshot.
 *
 * reasoningScore is a 0-1 measure of how the player's own F1 compared to
 * the average of the three detectors' F1 on that same case: 0.5 means
 * "matched the average detector," 1.0 means "beat it by a full F1 point"
 * (effectively never reached), 0 means "a full F1 point worse." This is
 * derived directly from the real per-case scores, not assigned.
 */
export function recordAnomalyCase({ accuracyPoints, falseAlarms, totalFlags, humanF1, avgDetectorF1 }) {
  const profile = getProfile();
  profile.anomalyCasesPlayed += 1;
  profile.anomalyAccuracySum += accuracyPoints;
  profile.anomalyFalseAlarmRateSum += totalFlags > 0 ? falseAlarms / totalFlags : 0;
  const reasoning = Math.min(1, Math.max(0, 0.5 + (humanF1 - avgDetectorF1)));
  profile.anomalyReasoningSum += reasoning;
  return saveProfile(profile);
}

/** Called once per Forecast Call case. */
export function recordForecastCase(isCorrect) {
  const profile = getProfile();
  profile.forecastCasesPlayed += 1;
  if (isCorrect) profile.forecastCorrectCount += 1;
  return saveProfile(profile);
}

/** Turns the raw running sums into the percentages the profile screen displays. Null means "not enough data yet," not zero. */
export function getDerivedStats(profile) {
  const casesSolved = profile.anomalyCasesPlayed + profile.forecastCasesPlayed;

  const anomalyAccuracyPct =
    profile.anomalyCasesPlayed > 0 ? Math.round(profile.anomalyAccuracySum / profile.anomalyCasesPlayed) : null;
  const forecastAccuracyPct =
    profile.forecastCasesPlayed > 0
      ? Math.round((100 * profile.forecastCorrectCount) / profile.forecastCasesPlayed)
      : null;
  const falseAlarmRatePct =
    profile.anomalyCasesPlayed > 0
      ? Math.round((100 * profile.anomalyFalseAlarmRateSum) / profile.anomalyCasesPlayed)
      : null;
  const reasoningPct =
    profile.anomalyCasesPlayed > 0 ? Math.round((100 * profile.anomalyReasoningSum) / profile.anomalyCasesPlayed) : null;

  return { casesSolved, anomalyAccuracyPct, forecastAccuracyPct, falseAlarmRatePct, reasoningPct };
}

export function getRank(lifetimePoints) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (lifetimePoints >= rank.threshold) current = rank;
  }
  return current.title;
}

export function getNextRankThreshold(lifetimePoints) {
  const next = RANKS.find((r) => r.threshold > lifetimePoints);
  return next ? next.threshold : null;
}
