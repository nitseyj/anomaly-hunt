import { motion } from 'motion/react';
import { Stat } from './Stat.jsx';
import styles from './ResultBreakdown.module.css';

export function ResultBreakdown({ rows, total, totalLabel = 'Total score' }) {
  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {rows.map((r, i) => (
          <motion.li
            key={r.label}
            className={styles.row}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className={styles.rowLabel}>{r.label}</span>
            <span className={`${styles.rowValue} ${r.value < 0 ? styles.negative : ''}`}>
              {r.value > 0 ? '+' : ''}
              {r.value}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className={styles.totalRow}>
        <Stat label={totalLabel} value={total} tone="signal" />
      </div>
    </div>
  );
}
