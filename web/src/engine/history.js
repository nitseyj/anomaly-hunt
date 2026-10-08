/** Per-case investigation history log -- separate from the leaderboard
 * (session totals only) and the profile (running aggregates only). */
const HISTORY_KEY = 'ah2-history';
const COUNTER_KEY = 'ah2-case-counter';
const MAX_HISTORY = 100;

function nextCaseId() {
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    const n = raw ? parseInt(raw, 10) + 1 : 1;
    localStorage.setItem(COUNTER_KEY, String(n));
    return String(n).padStart(4, '0');
  } catch {
    return String(Math.floor(Math.random() * 9000) + 1000);
  }
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

export function addHistoryEntry(entry) {
  const history = getHistory();
  const record = { caseId: nextCaseId(), date: new Date().toISOString(), ...entry };
  const updated = [record, ...history].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // unavailable -- history won't persist this session, non-fatal
  }
  return updated;
}

export const RESET_KEYS = ['ah2-scores', 'ah2-profile', 'ah2-history', 'ah2-case-counter', 'ah2-daily-result'];

export function resetAllLocalData() {
  let ok = true;
  for (const key of RESET_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      ok = false;
    }
  }
  return ok;
}
