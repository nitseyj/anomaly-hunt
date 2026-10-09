/**
 * daily.js
 *
 * A deterministic, date-seeded Anomaly Hunt case: the calendar date
 * itself is the seed, so every player who opens the game on the same
 * local day gets the exact same case. One attempt per local day.
 */
import { generateAnomalyCase } from './case.js';

const RESULT_KEY = 'ah2-daily-result';

function localDateParts(date = new Date()) {
  return { y: date.getFullYear(), m: String(date.getMonth() + 1).padStart(2, '0'), d: String(date.getDate()).padStart(2, '0') };
}

export function todayKey(date = new Date()) {
  const { y, m, d } = localDateParts(date);
  return `${y}-${m}-${d}`;
}

function seedFromDate(date = new Date()) {
  const { y, m, d } = localDateParts(date);
  return Number(y) * 10000 + Number(m) * 100 + Number(d);
}

function dailyCaseLabel(date = new Date()) {
  const { y, m, d } = localDateParts(date);
  return `D${d}${m}${String(y).slice(2)}`;
}

export function getTodayChallenge() {
  const today = new Date();
  const base = generateAnomalyCase('hard', [], seedFromDate(today));
  return { ...base, dailyLabel: dailyCaseLabel(today), dateKey: todayKey(today) };
}

export function getTodayResult() {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.dateKey === todayKey() ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTodayResult(result) {
  const record = { ...result, dateKey: todayKey() };
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(record));
  } catch {
    // unavailable -- today's result just won't persist, non-fatal
  }
  return record;
}
