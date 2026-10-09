/**
 * leaderboard.js
 *
 * This is a backend-free game, so "leaderboard" means the player's own
 * best runs over time, ranked -- a personal-best board, not a global one.
 */
import { getHistory } from './history.js';

export function getPersonalBests(mode, limit = 10) {
  return getHistory()
    .filter((e) => e.mode === mode)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, limit);
}

export function getBestDailyScore() {
  const dailyRuns = getHistory().filter((e) => e.mode === 'daily_challenge');
  if (dailyRuns.length === 0) return null;
  return dailyRuns.reduce((best, e) => (e.points > (best?.points ?? -Infinity) ? e : best), null);
}
