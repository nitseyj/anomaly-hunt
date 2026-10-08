import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { getHistory } from '../../engine/history.js';
import styles from './History.module.css';

const MODE_LABELS = { anomaly_hunt: 'Anomaly Hunt', forecast_call: 'Forecast Call', daily_challenge: 'Daily Challenge' };
const MODE_TONE = { anomaly_hunt: 'info', forecast_call: 'medium', daily_challenge: 'hard' };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen({ onExit }) {
  const history = getHistory();

  return (
    <PageShell>
      <TopBar onBack={onExit} />
      <h1 style={{ fontSize: 22, fontWeight: 650, margin: '16px 0 20px' }}>Investigation history</h1>

      {history.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>No cases completed yet — play a round of Anomaly Hunt or Forecast Call to start building your history.</p>
      ) : (
        <ul className={styles.list}>
          {history.map((entry) => (
            <li key={entry.caseId + entry.date} className={styles.item}>
              <span className={styles.caseId}>CASE {entry.caseId}</span>
              <span className={styles.pill} data-tone={MODE_TONE[entry.mode] ?? 'info'}>
                {MODE_LABELS[entry.mode] ?? entry.mode}
              </span>
              <span className={styles.metric}>{entry.metric}</span>
              <span className={styles.detail}>{entry.mode === 'forecast_call' ? `${entry.questionType} · ${entry.isCorrect ? 'correct' : 'incorrect'}` : `${entry.difficulty} · ${entry.accuracy}% accuracy`}</span>
              <span className={styles.score}>
                {entry.score >= 0 ? '+' : ''}
                {entry.score} pts
              </span>
              <span className={styles.date}>{formatDate(entry.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
