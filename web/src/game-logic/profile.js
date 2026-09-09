/**
 * profile.js
 *
 * A lightweight local progression system: tracks lifetime points across
 * both game modes and derives an "investigator rank" from the total.
 * Purely cosmetic (no gameplay effect), but gives repeat play a sense of
 * progression beyond a single session's score, and gives the intro
 * screen something to greet a returning player with.
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
  return { lifetimePoints: 0, gamesPlayed: 0, bestAnomalyScore: 0, bestForecastScore: 0 };
}

export function getProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage unavailable -- rank just won't persist this session, non-fatal
  }
  return profile;
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
