import { useState } from 'react';
import { PageShell, TopBar } from '../../components/PageShell.jsx';
import { Button } from '../../components/Button.jsx';
import { SkillBar } from '../../components/SkillBar.jsx';
import { getProfile, getDerivedStats, getRank, getNextRankThreshold } from '../../engine/profile.js';
import { resetAllLocalData } from '../../engine/history.js';
import styles from './Profile.module.css';

export default function ProfileScreen({ onExit }) {
  const [confirming, setConfirming] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const profile = getProfile();
  const stats = getDerivedStats(profile);
  const rank = getRank(profile.lifetimePoints);
  const nextThreshold = getNextRankThreshold(profile.lifetimePoints);

  return (
    <PageShell>
      <TopBar onBack={onExit} />
      <div className={styles.rankBadge}>
        <span className={styles.rankTitle}>{rank}</span>
        <span className={styles.rankDetail}>
          {profile.lifetimePoints} lifetime pts{nextThreshold !== null && ` · ${nextThreshold - profile.lifetimePoints} to next rank`}
        </span>
      </div>

      <div className={styles.statGrid}>
        <Stat label="Cases solved" value={stats.casesSolved} />
        <Stat label="Anomaly accuracy" value={stats.anomalyAccuracyPct === null ? '—' : `${stats.anomalyAccuracyPct}%`} />
        <Stat label="Forecast accuracy" value={stats.forecastAccuracyPct === null ? '—' : `${stats.forecastAccuracyPct}%`} />
        <Stat label="False alarm rate" value={stats.falseAlarmRatePct === null ? '—' : `${stats.falseAlarmRatePct}%`} />
      </div>

      <h3 className={styles.sectionTitle}>Skills</h3>
      <SkillBar label="Anomaly detection" pct={stats.anomalyAccuracyPct} />
      <SkillBar label="Forecasting" pct={stats.forecastAccuracyPct} />
      <SkillBar label="Statistical reasoning" pct={stats.reasoningPct} />
      <p className={styles.note}>
        Statistical reasoning compares your F1 score against the average of the three detectors on every case you've played — 50% means matching the detectors on average, higher means
        consistently beating them.
      </p>

      <div className={styles.dangerZone}>
        <h3 className={styles.dangerTitle}>Danger zone</h3>
        {justReset ? (
          <p className={styles.note}>All local data cleared. Your rank, history, and leaderboards are reset.</p>
        ) : !confirming ? (
          <Button onClick={() => setConfirming(true)}>Reset all local data</Button>
        ) : (
          <div className={styles.confirmRow}>
            <span className={styles.note}>This clears your rank, lifetime points, history, and both leaderboards. Cannot be undone.</span>
            <Button
              className={styles.dangerBtn}
              onClick={() => {
                resetAllLocalData();
                setConfirming(false);
                setJustReset(true);
              }}
            >
              Confirm reset
            </Button>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
