/**
 * CaseRevealPanel.jsx
 *
 * The "case closed" block every Anomaly Hunt-shaped screen shows once a
 * round is revealed: a stamp verdict, the accuracy/penalty/speed-bonus
 * breakdown, and the Human vs Machine detector comparison table. Was
 * duplicated near-identically between AnomalyHunt and DailyChallenge
 * before living here -- `children` is for anything a specific screen
 * wants between the breakdown and the primary action (DailyChallenge's
 * "next shared case in" countdown), and `footer` is that primary action
 * itself, since AnomalyHunt (Next case / Finish) and DailyChallenge
 * (Back to home) each want something different there.
 */
import { motion } from 'motion/react';
import { DataTable } from './DataTable.jsx';
import { ResultBreakdown } from './ResultBreakdown.jsx';
import { StampBadge } from './StampBadge.jsx';
import { Confetti } from './Confetti.jsx';
import { DETECTOR_META, evaluateHumanResult } from '../engine/detectors.js';
import styles from './CaseRevealPanel.module.css';

export function CaseRevealPanel({ result, detectorData, children, footer }) {
  const stampText = result.anomaliesMissed === 0 && result.falseAlarms === 0 ? 'Clean Sweep' : result.points >= 60 ? 'Case Closed' : 'Needs Review';
  const stampTone = result.points >= 60 ? 'signal' : 'warn';

  const detectorRows = detectorData
    ? [
        { key: 'human', method: 'You', ...evaluateHumanResult(result) },
        ...Object.entries(detectorData.scores).map(([key, s]) => ({ key, method: DETECTOR_META[key].label, ...s })),
      ]
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={styles.reveal}>
      <div className={styles.stampRow}>
        <StampBadge text={stampText} tone={stampTone} />
        {result.points >= 80 && <Confetti />}
      </div>

      <div className={styles.revealGrid}>
        <ResultBreakdown
          total={result.points}
          rows={[
            { label: 'Accuracy', value: result.accuracyPoints },
            { label: 'False alarm penalty', value: -result.falseAlarmPenalty },
            { label: 'Speed bonus', value: result.speedBonus },
          ]}
        />
        {detectorData && (
          <div className={styles.compareWrap}>
            <h4 className={styles.compareTitle}>Human vs. Machine</h4>
            <DataTable
              highlightRowIndex={0}
              columns={[
                { key: 'method', label: 'Method' },
                { key: 'precision', label: 'Precision', render: (r) => r.precision.toFixed(2) },
                { key: 'recall', label: 'Recall', render: (r) => r.recall.toFixed(2) },
                { key: 'f1', label: 'F1', render: (r) => r.f1.toFixed(2) },
              ]}
              rows={detectorRows}
            />
          </div>
        )}
      </div>

      {children}

      {footer && <div className={styles.nextRow}>{footer}</div>}
    </motion.div>
  );
}
