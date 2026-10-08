import { DETECTOR_META } from '../engine/detectors.js';
import { Panel } from './Card.jsx';
import styles from './ResultBreakdown.module.css';

const ANOMALY_TYPE_LABELS = {
  point_spike: 'Point spike',
  level_shift: 'Level shift',
  missing_gap: 'Missing data gap',
  trend_break: 'Trend break',
};

const pct = (v) => `${Math.round(v * 100)}%`;

export function ResultBreakdown({ result, detectorResults, humanScore, caseFile }) {
  return (
    <Panel className={styles.panel}>
      <h3>Investigation report</h3>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.label}>Accuracy</span>
          <span className={styles.value}>{result.accuracyPoints}%</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>False alarms</span>
          <span className={styles.value}>{result.falseAlarms}</span>
        </div>
        <div className={styles.stat}>
          <span className={[styles.label].join(' ')}>Speed bonus</span>
          <span className={[styles.value, styles.success].join(' ')}>+{result.speedBonus}</span>
        </div>
        {result.falseAlarmPenalty > 0 && (
          <div className={styles.stat}>
            <span className={styles.label}>Deductions</span>
            <span className={[styles.value, styles.danger].join(' ')}>−{result.falseAlarmPenalty}</span>
          </div>
        )}
      </div>

      <div className={styles.hitList}>
        {result.hits.map((h) => (
          <div key={h.anomalyIndex} className={styles.hitRow}>
            <span>
              {ANOMALY_TYPE_LABELS[h.type] || h.type} · {caseFile.series[h.anomalyIndex]?.date}
            </span>
            <span className={h.matchedIndex !== null ? styles.success : styles.muted}>
              {h.matchedIndex !== null ? `found · ${h.points} pts` : 'missed'}
            </span>
          </div>
        ))}
      </div>

      <h4 className={styles.subheading}>Human vs machine</h4>
      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            <th>Precision</th>
            <th>Recall</th>
            <th>F1</th>
          </tr>
        </thead>
        <tbody>
          {humanScore && (
            <tr className={styles.humanRow}>
              <td>You</td>
              <td>{pct(humanScore.precision)}</td>
              <td>{pct(humanScore.recall)}</td>
              <td>{humanScore.f1.toFixed(2)}</td>
            </tr>
          )}
          {detectorResults &&
            Object.entries(detectorResults.scores).map(([name, s]) => (
              <tr key={name}>
                <td>{DETECTOR_META[name]?.label ?? name}</td>
                <td>{pct(s.precision)}</td>
                <td>{pct(s.recall)}</td>
                <td>{s.f1.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p className={styles.note}>
        Statistical detectors provide signals rather than absolute truth — different methods respond differently to
        noise, seasonality, and structural change.
      </p>
    </Panel>
  );
}
