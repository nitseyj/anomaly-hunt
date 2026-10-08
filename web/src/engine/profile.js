/**
 * profile.js
 *
 * Lifetime progression across both game modes -- running sums, not a
 * fabricated points total, so accuracy/false-alarm-rate/reasoning are
 * real derived percentages computed from actual recorded results.
 */
const KEY = 'ah2-profile';

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
    anomalyCasesPlayed: 0,
    anomalyAccuracySum: 0,
    anomalyFalseAlarmRateSum: 0,
    anomalyReasoningSum: 0,
    forecastCasesPlayed: 0,
    forecastCorrectCount: 0,
  };
}

function save(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // unavailable -- stats won't persist this session, non-fatal
  }
  return profile;
}

export function getProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function recordGameResult(mode, points) {
  const profile = getProfile();
  profile.lifetimePoints += points;
  profile.gamesPlayed += 1;
  if (mode === 'anomaly_hunt') profile.bestAnomalyScore = Math.max(profile.bestAnomalyScore, points);
  if (mode === 'forecast_call') profile.bestForecastScore = Math.max(profile.bestForecastScore, points);
  return save(profile);
}

/** reasoningScore: 0.5 = matched the average detector's F1 on that case, 1.0 = beat it by a full point, 0 = a full point worse. */
export function recordAnomalyCase({ accuracyPoints, falseAlarms, totalFlags, humanF1, avgDetectorF1 }) {
  const profile = getProfile();
  profile.anomalyCasesPlayed += 1;
  profile.anomalyAccuracySum += accuracyPoints;
  profile.anomalyFalseAlarmRateSum += totalFlags > 0 ? falseAlarms / totalFlags : 0;
  profile.anomalyReasoningSum += Math.min(1, Math.max(0, 0.5 + (humanF1 - avgDetectorF1)));
  return save(profile);
}

export function recordForecastCase(isCorrect) {
  const profile = getProfile();
  profile.forecastCasesPlayed += 1;
  if (isCorrect) profile.forecastCorrectCount += 1;
  return save(profile);
}

export function getDerivedStats(profile) {
  const casesSolved = profile.anomalyCasesPlayed + profile.forecastCasesPlayed;
  const anomalyAccuracyPct = profile.anomalyCasesPlayed > 0 ? Math.round(profile.anomalyAccuracySum / profile.anomalyCasesPlayed) : null;
  const forecastAccuracyPct =
    profile.forecastCasesPlayed > 0 ? Math.round((100 * profile.forecastCorrectCount) / profile.forecastCasesPlayed) : null;
  const falseAlarmRatePct =
    profile.anomalyCasesPlayed > 0 ? Math.round((100 * profile.anomalyFalseAlarmRateSum) / profile.anomalyCasesPlayed) : null;
  const reasoningPct =
    profile.anomalyCasesPlayed > 0 ? Math.round((100 * profile.anomalyReasoningSum) / profile.anomalyCasesPlayed) : null;
  return { casesSolved, anomalyAccuracyPct, forecastAccuracyPct, falseAlarmRatePct, reasoningPct };
}

export function getRank(lifetimePoints) {
  let current = RANKS[0];
  for (const rank of RANKS) if (lifetimePoints >= rank.threshold) current = rank;
  return current.title;
}

export function getNextRankThreshold(lifetimePoints) {
  const next = RANKS.find((r) => r.threshold > lifetimePoints);
  return next ? next.threshold : null;
}
