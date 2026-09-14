/**
 * leaderboard.js
 *
 * Local-only leaderboard using localStorage — keeps the game fully
 * static/serverless (no backend required to deploy on GitHub Pages).
 * Scores are kept per game mode ('anomaly_hunt' | 'forecast_call') since
 * their point scales aren't comparable. A shared online leaderboard is a
 * natural next step; see the README roadmap.
 */

const STORAGE_KEY = 'anomaly-hunt-scores';
const MAX_ENTRIES = 20;

function getAllScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getScores(mode) {
  const all = getAllScores();
  return Array.isArray(all[mode]) ? all[mode] : [];
}

export function submitScore(mode, playerName, totalPoints, roundsCompleted) {
  const all = getAllScores();
  const scores = Array.isArray(all[mode]) ? all[mode] : [];
  const trimmedName = (playerName || '').trim();

  scores.push({
    playerName: trimmedName || 'Anonymous Investigator',
    totalPoints,
    roundsCompleted,
    date: new Date().toISOString(),
  });
  scores.sort((a, b) => b.totalPoints - a.totalPoints);
  const trimmed = scores.slice(0, MAX_ENTRIES);

  all[mode] = trimmed;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage unavailable (private browsing, etc.) — fail silently,
    // the round score still displays in-session either way.
  }
  return trimmed;
}
