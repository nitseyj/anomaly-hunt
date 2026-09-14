/**
 * resetData.js
 *
 * Clears every piece of local game data -- leaderboard scores, profile
 * stats/rank, investigation history, the daily-challenge counter, and
 * today's daily result. Centralized here (rather than scattered
 * localStorage.clear() calls) so this list stays a single source of
 * truth as new persisted keys get added.
 */

const ALL_STORAGE_KEYS = [
  'anomaly-hunt-scores', // leaderboard.js
  'anomaly-hunt-profile', // profile.js
  'anomaly-hunt-history', // history.js
  'anomaly-hunt-case-counter', // history.js
  'anomaly-hunt-daily-result', // dailyChallenge.js
];

/** Wipes all local game data. Returns true if it fully succeeded. */
export function resetAllLocalData() {
  let ok = true;
  for (const key of ALL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      ok = false;
    }
  }
  return ok;
}
