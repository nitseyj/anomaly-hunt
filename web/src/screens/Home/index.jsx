import { motion } from 'motion/react';
import { Card } from '../../components/Card.jsx';
import { Button } from '../../components/Button.jsx';
import { Pill } from '../../components/Pill.jsx';
import { PageShell } from '../../components/PageShell.jsx';
import { IconBadge, AnomalyIcon, ForecastIcon, DailyIcon } from '../../components/ModeIcon.jsx';
import { getTodayResult } from '../../engine/daily.js';
import { getProfile } from '../../engine/profile.js';
import { getHistory } from '../../engine/history.js';
import styles from './styles.module.css';

const MODES = [
  {
    id: 'anomaly',
    Icon: AnomalyIcon,
    title: 'Anomaly Hunt',
    tagline: '5 cases · 45s each',
    body: 'Spot 1-3 injected anomalies in a business metric chart. Score against the same statistical detectors a real analyst would reach for.',
  },
  {
    id: 'forecast',
    Icon: ForecastIcon,
    title: 'Forecast Call',
    tagline: '5 rounds · untimed',
    body: "See the trend, not the ending. Call the direction, stake your confidence, and find out if you'd have been right.",
  },
  {
    id: 'daily',
    Icon: DailyIcon,
    title: 'Daily Challenge',
    tagline: 'One shared case per day',
    body: "Today's case is the same for everyone — seeded by the calendar date itself. One attempt per local day.",
  },
];

const MODE_LABELS = { anomaly_hunt: 'Anomaly Hunt', forecast_call: 'Forecast Call', daily_challenge: 'Daily Challenge' };

export function Home({ onNavigate }) {
  const profile = getProfile();
  const dailyDone = Boolean(getTodayResult());
  const recent = getHistory().slice(0, 4);

  return (
    <PageShell
      eyebrow="Anomaly Hunt — Field Investigations Unit"
      title="Three ways to practice reading data like an analyst."
      subtitle="Every case is procedurally generated in the browser. No two playthroughs look the same, and no server ever sees your data."
      actions={
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('history')}>History</Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('profile')}>
            {profile.rank}
          </Button>
        </div>
      }
    >
      <div className={styles.grid}>
        {MODES.map((mode, i) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card
              tilt
              glow
              className={styles.modeCard}
              onClick={() => onNavigate(mode.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate(mode.id);
                }
              }}
            >
              <div className={styles.modeHead}>
                <IconBadge>
                  <mode.Icon />
                </IconBadge>
                {mode.id === 'daily' && dailyDone && <Pill tone="signal">Completed today</Pill>}
              </div>
              <h3 className={styles.modeTitle}>{mode.title}</h3>
              <p className={styles.tagline}>{mode.tagline}</p>
              <p className={styles.body}>{mode.body}</p>
              <Button variant="primary" size="sm" magnetic className={styles.enter}>
                Enter →
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className={styles.footerRow}>
        <button className={styles.linkBtn} onClick={() => onNavigate('import')}>
          Or bring your own data →
        </button>
      </div>

      <motion.div
        className={styles.logSection}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <div className={styles.logHeader}>
          <h4 className={styles.logTitle}>Field log</h4>
          {recent.length > 0 && (
            <button className={styles.linkBtn} onClick={() => onNavigate('history')}>
              View all →
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <p className={styles.logEmpty}>No investigations logged yet. Your completed cases will show up here.</p>
        ) : (
          <ul className={styles.logList}>
            {recent.map((entry) => (
              <li key={entry.id} className={styles.logRow}>
                <Pill tone="neutral">{MODE_LABELS[entry.mode] ?? entry.mode}</Pill>
                <span className={styles.logCase}>{entry.caseTitle}</span>
                <span className={`${styles.logPoints} ${entry.points < 0 ? styles.logPointsNeg : ''}`}>
                  {entry.points > 0 ? '+' : ''}
                  {entry.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </PageShell>
  );
}
