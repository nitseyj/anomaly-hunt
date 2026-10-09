import { motion } from 'motion/react';
import styles from './SkillBar.module.css';

export function SkillBar({ label, fraction }) {
  const pct = fraction === null ? null : Math.round(fraction * 100);
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        {pct !== null && (
          <motion.div
            className={styles.fill}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>
      <span className={styles.value}>{pct === null ? '—' : `${pct}%`}</span>
    </div>
  );
}
