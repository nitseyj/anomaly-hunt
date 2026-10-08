import { motion } from 'motion/react';
import { LogoMark } from './Logo.jsx';
import styles from './PageShell.module.css';

/** The consistent wrapper every screen renders inside: a topbar (either
 * the home wordmark+actions, or a "back" link) plus a motion-animated
 * content area so switching screens always gets a consistent entrance. */
export function PageShell({ children, topbar, wide = false }) {
  return (
    <div className={[styles.shell, wide ? styles.wide : ''].filter(Boolean).join(' ')}>
      {topbar}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function TopBar({ onBack, right }) {
  return (
    <div className={styles.topbar}>
      {onBack ? (
        <button className={styles.backLink} onClick={onBack}>
          ← Anomaly Hunt
        </button>
      ) : (
        <span className={styles.wordmark}>
          <LogoMark />
          Anomaly Hunt
        </span>
      )}
      <span className={styles.right}>{right}</span>
    </div>
  );
}
