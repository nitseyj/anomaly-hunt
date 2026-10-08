/** Local-only leaderboard (localStorage) -- scores kept per mode since
 * their point scales aren't comparable. */
const KEY = 'ah2-scores';
const MAX_ENTRIES = 20;

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getScores(mode) {
  const all = getAll();
  return Array.isArray(all[mode]) ? all[mode] : [];
}

export function submitScore(mode, playerName, totalPoints, roundsCompleted) {
  const all = getAll();
  const scores = Array.isArray(all[mode]) ? all[mode] : [];
  scores.push({
    playerName: (playerName || '').trim() || 'Anonymous Investigator',
    totalPoints,
    roundsCompleted,
    date: new Date().toISOString(),
  });
  scores.sort((a, b) => b.totalPoints - a.totalPoints);
  const trimmed = scores.slice(0, MAX_ENTRIES);
  all[mode] = trimmed;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // unavailable -- score still shows in-session, non-fatal
  }
  return trimmed;
}
