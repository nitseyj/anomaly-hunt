import { PageShell } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { Pill } from '../../components/Pill.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { getHistory, clearHistory } from '../../engine/history.js';
import styles from './styles.module.css';

const MODE_LABELS = {
  anomaly_hunt: 'Anomaly Hunt',
  forecast_call: 'Forecast Call',
  daily_challenge: 'Daily Challenge',
};

export function History({ onNavigate }) {
  const entries = getHistory();

  function handleClear() {
    if (window.confirm('Clear all local match history? This cannot be undone.')) {
      clearHistory();
      onNavigate('history');
    }
  }

  return (
    <PageShell
      eyebrow="Match Log"
      title="Past investigations."
      subtitle="Stored locally in this browser only — nothing leaves your device."
      actions={
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={handleClear}>Clear</Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('home')}>← Home</Button>
        </div>
      }
    >
      {entries.length === 0 ? (
        <p className={styles.empty}>No matches logged yet. Go play something.</p>
      ) : (
        <DataTable
          columns={[
            { key: 'mode', label: 'Mode', render: (r) => <Pill tone="neutral">{MODE_LABELS[r.mode] ?? r.mode}</Pill> },
            { key: 'caseTitle', label: 'Case' },
            { key: 'points', label: 'Points', render: (r) => (r.points > 0 ? `+${r.points}` : r.points) },
            { key: 'timestamp', label: 'When', render: (r) => new Date(r.timestamp).toLocaleString() },
          ]}
          rows={entries}
        />
      )}
    </PageShell>
  );
}
