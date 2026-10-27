import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { AnomalyIcon, ForecastIcon, DailyIcon, SurvivalIcon, IconBadge } from '../../components/ModeIcon.jsx';
import { getHistory, clearHistory } from '../../engine/history.js';
import { requestConfirm } from '../../engine/confirmBus.js';
import heroPhoto from '../../assets/photos/history-typewriter.jpg';
import styles from './styles.module.css';

const MODE_META = {
  anomaly_hunt: { label: 'Anomaly Hunt', Icon: AnomalyIcon },
  forecast_call: { label: 'Forecast Call', Icon: ForecastIcon },
  daily_challenge: { label: 'Daily Challenge', Icon: DailyIcon },
  survival: { label: 'Survival', Icon: SurvivalIcon },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'anomaly_hunt', label: 'Anomaly Hunt' },
  { id: 'forecast_call', label: 'Forecast Call' },
  { id: 'daily_challenge', label: 'Daily Challenge' },
  { id: 'survival', label: 'Survival' },
];

export function History({ onNavigate }) {
  const allEntries = useMemo(() => getHistory(), []);
  const [filter, setFilter] = useState('all');

  const entries = filter === 'all' ? allEntries : allEntries.filter((e) => e.mode === filter);

  async function handleClear() {
    const ok = await requestConfirm({
      title: 'Clear match history?',
      message: 'This permanently deletes every logged case and round from this browser. This cannot be undone.',
      confirmLabel: 'Clear',
      cancelLabel: 'Keep',
    });
    if (!ok) return;
    clearHistory();
    onNavigate('history');
  }

  return (
    <PageShell
      eyebrow="Match Log"
      title="Past investigations."
      subtitle="Stored locally in this browser only — nothing leaves your device."
      photo={{
        src: heroPhoto,
        caption: "The archive doesn't forget a call — right or wrong.",
        credit: 'Photo — Johnny Briggs / Unsplash',
      }}
      actions={
        <Button variant="ghost" size="sm" onClick={handleClear}>Clear</Button>
      }
    >
      {allEntries.length === 0 ? (
        <p className={styles.empty}>No matches logged yet. Go play something.</p>
      ) : (
        <>
          <div className={styles.filterRow}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className={styles.timeline}>
            <div className={styles.rail} />
            <AnimatePresence initial={false}>
              {entries.map((entry, i) => {
                const meta = MODE_META[entry.mode] ?? { label: entry.mode, Icon: AnomalyIcon };
                const { Icon } = meta;
                return (
                  <motion.div
                    key={entry.id}
                    className={styles.row}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35 }}
                  >
                    <div className={styles.node}>
                      <IconBadge className={styles.nodeBadge} size={40}>
                        <Icon />
                      </IconBadge>
                    </div>
                    <div className={styles.card}>
                      <div className={styles.cardTop}>
                        <span className={styles.modeLabel}>{meta.label}</span>
                        <span className={styles.timestamp}>{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className={styles.cardBottom}>
                        <span className={styles.caseTitle}>{entry.caseTitle}</span>
                        <span className={`${styles.points} ${entry.points < 0 ? styles.pointsNeg : ''}`}>
                          {entry.points > 0 ? '+' : ''}
                          {entry.points}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </PageShell>
  );
}
