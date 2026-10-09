/**
 * StampBadge.jsx
 *
 * A case-file ink-stamp verdict ("CASE CLOSED" / "FLAGGED" / etc.) that
 * slams in at an angle like a real rubber stamp -- used at the moment a
 * case/round resolves, before the score breakdown appears.
 */
import { motion } from 'motion/react';
import styles from './StampBadge.module.css';

export function StampBadge({ text, tone = 'signal' }) {
  return (
    <motion.div
      className={`${styles.stamp} ${styles[tone]}`}
      initial={{ scale: 2.4, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: -8, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
    >
      {text}
    </motion.div>
  );
}
