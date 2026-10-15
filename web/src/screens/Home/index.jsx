import { motion } from 'motion/react';
import { PageShell } from '../../components/PageShell.jsx';
import { IconBadge, AnomalyIcon, ForecastIcon, DailyIcon } from '../../components/ModeIcon.jsx';
import { Pill } from '../../components/Pill.jsx';
import { getTodayResult } from '../../engine/daily.js';
import { getHistory } from '../../engine/history.js';
import heroPhoto from '../../assets/photos/home-aerial-city.jpg';
import styles from './styles.module.css';

const MODES = [
  {
    id: 'anomaly',
    index: '001',
    Icon: AnomalyIcon,
    title: 'Anomaly Hunt',
    tagline: '5 cases · 45s each',
    body: 'Spot 1-3 injected anomalies in a business metric chart. Score against the same statistical detectors a real analyst would reach for.',
  },
  {
    id: 'forecast',
    index: '002',
    Icon: ForecastIcon,
    title: 'Forecast Call',
    tagline: '5 rounds · untimed',
    body: "See the trend, not the ending. Call the direction, stake your confidence, and find out if you'd have been right.",
  },
  {
    id: 'daily',
    index: '003',
    Icon: DailyIcon,
    title: 'Daily Challenge',
    tagline: 'One shared case per day',
    body: "Today's case is the same for everyone — seeded by the calendar date itself. One attempt per local day.",
  },
];

const MODE_LABELS = { anomaly_hunt: 'Anomaly Hunt', forecast_call: 'Forecast Call', daily_challenge: 'Daily Challenge' };

export function Home({ onNavigate }) {
  const dailyDone = Boolean(getTodayResult());
  const recent = getHistory().slice(0, 4);

  return (
    <PageShell
      eyebrow="Anomaly Hunt — Field Investigations Unit"
      title="Three ways to practice reading data like an analyst."
      subtitle="Every case is procedurally generated in the browser. No two playthroughs look the same, and no server ever sees your data."
      photo={{
        src: heroPhoto,
        caption: 'Every case starts here — pick a line of inquiry and the unit runs the rest.',
        credit: 'Photo — 郭 心宇 / Unsplash',
      }}
    >
      <div className={styles.manifest}>
        {MODES.map((mode, i) => (
          <motion.button
            key={mode.id}
            className={styles.row}
            onClick={() => onNavigate(mode.id)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileHover="hover"
          >
            <motion.span
              className={styles.rowAccent}
              variants={{ hover: { scaleY: 1 } }}
              initial={{ scaleY: 0 }}
              transition={{ duration: 0.2 }}
            />
            <span className={styles.rowIndex}>{mode.index}</span>
            <IconBadge className={styles.rowIcon}>
              <mode.Icon />
            </IconBadge>
            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <span className={styles.rowTitle}>{mode.title}</span>
                {mode.id === 'daily' && dailyDone && <Pill tone="signal">Completed today</Pill>}
              </span>
              <span className={styles.rowTagline}>{mode.tagline}</span>
              <span className={styles.rowDesc}>{mode.body}</span>
            </span>
            <motion.span className={styles.rowEnter} variants={{ hover: { x: 6 } }} transition={{ duration: 0.2 }}>
              ENTER →
            </motion.span>
          </motion.button>
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
        transition={{ delay: 0.3, duration: 0.5 }}
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
