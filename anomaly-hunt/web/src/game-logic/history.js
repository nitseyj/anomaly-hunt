/**
 * history.js
 *
 * Persists a record of every completed case (both modes) to localStorage
 * so the player can review past investigations -- separate from the
 * leaderboard (which only tracks session totals) and the profile (which
 * only tracks running aggregates). This is the detailed, per-case log.
 */

const HISTORY_KEY = 'anomaly-hunt-history';
const COUNTER_KEY = 'anomaly-hunt-case-counter';
const MAX_HISTORY = 100;

function nextCaseId() {
  let n = 1;
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    n = raw ? parseInt(raw, 10) + 1 : 1;
    localStorage.setItem(COUNTER_KEY, String(n));
  } catch {
    n = Math.floor(Math.random() * 9000) + 1000; // fallback if storage is unavailable
  }
  return String(n).padStart(4, '0');
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} entry - { mode, metric, difficulty?, questionType?, score, accuracy?, isCorrect? }
 */
export function addHistoryEntry(entry) {
  const history = getHistory();
  const record = { caseId: nextCaseId(), date: new Date().toISOString(), ...entry };
  const updated = [record, ...history].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable -- history just won't persist this session, non-fatal
  }
  return updated;
}
