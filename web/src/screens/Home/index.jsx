import { motion } from 'motion/react';
import { LogoMark } from '../../components/Logo.jsx';
import { Card } from '../../components/Card.jsx';
import { Button } from '../../components/Button.jsx';
import { getProfile, getRank, getNextRankThreshold } from '../../engine/profile.js';
import { getTodayResult } from '../../engine/daily.js';
import styles from './Home.module.css';

export default function HomeScreen({ onSelectMode }) {
  const profile = getProfile();
  const rank = getRank(profile.lifetimePoints);
  const nextThreshold = getNextRankThreshold(profile.lifetimePoints);
  const dailyResult = getTodayResult();

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <span className={styles.wordmark}>
          <LogoMark size={18} />
          Anomaly Hunt
        </span>
        <span className={styles.topActions}>
          <Button onClick={() => onSelectMode('profile')}>Profile</Button>
          <Button onClick={() => onSelectMode('history')}>History</Button>
        </span>
      </div>

      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} className={styles.headline}>
        Investigate the signal. Challenge the model. Make the call.
      </motion.h1>
      <p className={styles.subhead}>Every case runs on a freshly generated business metric — no two playthroughs look the same. Choose an investigation below.</p>

      {profile.gamesPlayed > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={styles.rankBadge}>
          <span className={styles.rankTitle}>{rank}</span>
          <span className={styles.rankDetail}>
            {profile.lifetimePoints} lifetime pts{nextThreshold !== null && ` · ${nextThreshold - profile.lifetimePoints} to next rank`}
          </span>
        </motion.div>
      )}

      <Card highlight onClick={() => onSelectMode('daily_challenge')} className={styles.dailyCard}>
        <div className={styles.dailyRow}>
          <span>
            <span className={styles.dailyTitle}>
              <span className={styles.dot} /> Daily Investigation
            </span>
            <span className={styles.dailyDesc}>One case, the same for everyone today. Hard difficulty, one attempt.</span>
          </span>
          <span className={styles.dailyStatus}>{dailyResult ? `Completed · ${dailyResult.score} pts` : 'Play today’s case'}</span>
        </div>
      </Card>

      <div className={styles.modeGrid}>
        <Card onClick={() => onSelectMode('anomaly_hunt')}>
          <span className={styles.modeTitle}>Anomaly Hunt</span>
          <span className={styles.modeDesc}>Five cases, 45 seconds each. Spot the anomaly hidden in real-looking business data before time runs out, then compare your eye to three statistical detectors.</span>
          <span className={styles.modeMeta}>Best: {profile.bestAnomalyScore || '—'} pts</span>
        </Card>
        <Card onClick={() => onSelectMode('forecast_call')}>
          <span className={styles.modeTitle}>Forecast Call</span>
          <span className={styles.modeDesc}>Five cases, no timer. Read the trend, choose the most likely outcome, and stake your confidence on it — conviction is rewarded, and it costs you when you're wrong.</span>
          <span className={styles.modeMeta}>Best: {profile.bestForecastScore || '—'} pts</span>
        </Card>
      </div>

      <button className={styles.importLink} onClick={() => onSelectMode('import')}>
        ▸ Import your own data — run Anomaly Hunt on a real dataset
      </button>
    </div>
  );
}
