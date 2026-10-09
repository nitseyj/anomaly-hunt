/**
 * history.js
 *
 * Local-only match history: every completed Anomaly Hunt case and
 * Forecast Call round gets appended here, persisted to localStorage.
 * This is the single source of truth that profile.js and leaderboard.js
 * derive their aggregates from.
 */

const HISTORY_KEY = 'ah2-history';
const MAX_ENTRIES = 200;

function readRaw() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // storage unavailable -- history just won't persist, non-fatal
  }
}

export function getHistory() {
  return readRaw().sort((a, b) => b.timestamp - a.timestamp);
}

export function addHistoryEntry(entry) {
  const entries = readRaw();
  const record = { ...entry, timestamp: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  entries.push(record);
  writeRaw(entries);
  return record;
}

export function clearHistory() {
  writeRaw([]);
}

export function getHistoryByMode(mode) {
  return getHistory().filter((h) => h.mode === mode);
}
