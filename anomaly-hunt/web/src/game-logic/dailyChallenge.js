/**
 * dailyChallenge.js
 *
 * A deterministic, date-seeded Anomaly Hunt case: the date itself is the
 * seed, so every player who opens the game on the same calendar day gets
 * the exact same case -- no backend, no server-assigned puzzle, just a
 * pure function of today's date. One attempt per day is tracked locally.
 */

import { generateCase } from './anomalyGenerator.js';

const STORAGE_KEY = 'anomaly-hunt-daily-result';

function todayDateStr(date = new Date()) {
  // Build the date key from LOCAL calendar components, not toISOString()
  // -- toISOString() converts through UTC first, which reports the WRONG
  // calendar day for several hours around local midnight in any
  // negative-UTC-offset timezone (most of the Americas). A player at
  // 9pm local time is already "tomorrow" in UTC, which would silently
  // regenerate/re-gate the daily challenge at the wrong local moment.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Exposed so the UI can cheaply check "has the local date changed since I last generated a case?" without regenerating anything. */
export function getLocalDateKey() {
  return todayDateStr();
}

function dateSeed(date = new Date()) {
  const [y, m, d] = todayDateStr(date).split('-').map(Number);
  return y * 10000 + m * 100 + d; // a stable 32-bit-safe integer, unique per calendar day
}

function formatCaseId(date = new Date()) {
  const [y, m, d] = todayDateStr(date).split('-');
  return `D${d}${m}${y.slice(2)}`;
}

/** Always returns the same case for anyone calling it on the same calendar day. */
export function getTodayChallenge() {
  const today = new Date();
  const caseFile = generateCase('hard', [], dateSeed(today));
  return { ...caseFile, dailyCaseId: formatCaseId(today), dateStr: todayDateStr(today) };
}

/** Returns today's saved result, or null if the player hasn't played today's challenge yet. */
export function getTodayResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.dateStr === todayDateStr() ? parsed : null; // a saved result from a prior day doesn't count
  } catch {
    return null;
  }
}

export function saveTodayResult(result) {
  const record = { ...result, dateStr: todayDateStr() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable -- today's result just won't persist, non-fatal
  }
  return record;
}
