import { motion } from 'motion/react';
import styles from './SkillBar.module.css';

export function SkillBar({ label, pct }) {
  return (
    <div className={styles.bar}>
      <div className={styles.header}>
        <span>{label}</span>
        <span>{pct === null ? 'No data yet' : `${pct}%`}</span>
      </div>
      <div className={styles.track}>
        <motion.div
          className={styles.fill}
          initial={{ width: 0 }}
          animate={{ width: `${pct ?? 0}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
