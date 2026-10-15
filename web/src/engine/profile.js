/**
 * profile.js
 *
 * Derives the player's aggregate stats from history.js entries. Nothing
 * here is stored independently -- it's a pure projection, so it can
 * never drift out of sync with the history list itself.
 */
import { getHistory } from './history.js';

export const RANKS = [
  { min: 0, name: 'Rookie Analyst' },
  { min: 300, name: 'Field Analyst' },
  { min: 900, name: 'Senior Analyst' },
  { min: 2000, name: 'Lead Investigator' },
  { min: 4000, name: 'Chief Investigator' },
];

function rankIndexForScore(totalScore) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (totalScore >= RANKS[i].min) idx = i;
  }
  return idx;
}

export function getProfile() {
  const entries = getHistory();
  const huntEntries = entries.filter((e) => e.mode === 'anomaly_hunt' || e.mode === 'daily_challenge');
  const forecastEntries = entries.filter((e) => e.mode === 'forecast_call');

  const totalScore = entries.reduce((sum, e) => sum + (e.points || 0), 0);
  const casesPlayed = huntEntries.length;
  const roundsPlayed = forecastEntries.length;

  const anomaliesFound = huntEntries.reduce((sum, e) => sum + (e.anomaliesFound || 0), 0);
  const anomaliesTotal = huntEntries.reduce((sum, e) => sum + (e.anomaliesFound || 0) + (e.anomaliesMissed || 0), 0);
  const huntAccuracy = anomaliesTotal > 0 ? anomaliesFound / anomaliesTotal : 0;

  const forecastCorrect = forecastEntries.filter((e) => e.isCorrect).length;
  const forecastAccuracy = roundsPlayed > 0 ? forecastCorrect / roundsPlayed : 0;

  let bestStreak = 0;
  let currentStreak = 0;
  for (const e of [...forecastEntries].reverse()) {
    if (e.isCorrect) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const dailyStreak = computeDailyStreak(entries.filter((e) => e.mode === 'daily_challenge'));

  const rankIndex = rankIndexForScore(totalScore);
  const currentRank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1] ?? null;
  const rankProgress = nextRank ? (totalScore - currentRank.min) / (nextRank.min - currentRank.min) : 1;

  return {
    totalScore,
    rank: currentRank.name,
    rankIndex,
    nextRank: nextRank?.name ?? null,
    pointsToNextRank: nextRank ? nextRank.min - totalScore : 0,
    rankProgress: Math.max(0, Math.min(1, rankProgress)),
    casesPlayed,
    roundsPlayed,
    huntAccuracy,
    forecastAccuracy,
    bestForecastStreak: bestStreak,
    dailyStreak,
    skills: {
      pointSpike: skillFor(huntEntries, 'point_spike'),
      levelShift: skillFor(huntEntries, 'level_shift'),
      missingGap: skillFor(huntEntries, 'missing_gap'),
      trendBreak: skillFor(huntEntries, 'trend_break'),
    },
  };
}

function skillFor(huntEntries, type) {
  let found = 0;
  let total = 0;
  for (const e of huntEntries) {
    for (const hit of e.hits || []) {
      if (hit.type === type) {
        total += 1;
        if (hit.matchedIndex !== null) found += 1;
      }
    }
  }
  return total > 0 ? found / total : null;
}

function computeDailyStreak(dailyEntries) {
  if (dailyEntries.length === 0) return 0;
  const byDate = [...dailyEntries].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 1;
  for (let i = 1; i < byDate.length; i++) {
    const prevDay = new Date(byDate[i - 1].timestamp);
    const curDay = new Date(byDate[i].timestamp);
    const diffDays = Math.round((prevDay.setHours(0, 0, 0, 0) - curDay.setHours(0, 0, 0, 0)) / 86400000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}
