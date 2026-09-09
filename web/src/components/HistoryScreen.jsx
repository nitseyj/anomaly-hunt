import { getHistory } from '../game-logic/history.js';

const MODE_LABELS = {
  anomaly_hunt: 'Anomaly Hunt',
  forecast_call: 'Forecast Call',
  daily_challenge: 'Daily Challenge',
};
const MODE_PILLS = {
  anomaly_hunt: 'info',
  forecast_call: 'medium',
  daily_challenge: 'hard',
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * HistoryScreen
 *
 * Every completed case (either mode) is logged here as it happens --
 * see history.js. This is the detailed per-case log, separate from the
 * leaderboard (session totals only) and the profile (aggregate stats).
 */
export default function HistoryScreen({ onExit }) {
  const history = getHistory();

  return (
    <div className="dd-shell">
      <div className="dd-topbar">
        <button className="dd-wordmark dd-wordmark--link" onClick={onExit}>
          ← Anomaly Hunt
        </button>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 650, margin: '16px 0 20px' }}>Investigation history</h1>

      {history.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
          No cases completed yet — play a round of Anomaly Hunt or Forecast Call to start building
          your history.
        </p>
      ) : (
        <ul className="dd-history-list">
          {history.map((entry) => (
            <li key={entry.caseId + entry.date} className="dd-history-item">
              <span className="dd-mono dd-history-case-id">CASE {entry.caseId}</span>
              <span className={`dd-pill dd-pill--${MODE_PILLS[entry.mode] ?? 'info'}`}>
                {MODE_LABELS[entry.mode] ?? entry.mode}
              </span>
              <span className="dd-history-metric">{entry.metric}</span>
              <span className="dd-history-detail">
                {entry.mode === 'forecast_call'
                  ? `${entry.questionType} · ${entry.isCorrect ? 'correct' : 'incorrect'}`
                  : `${entry.difficulty} · ${entry.accuracy}% accuracy`}
              </span>
              <span className="dd-history-score">
                {entry.score >= 0 ? '+' : ''}
                {entry.score} pts
              </span>
              <span className="dd-history-date">{formatDate(entry.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
