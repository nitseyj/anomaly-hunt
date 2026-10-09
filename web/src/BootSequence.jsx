/**
 * BootSequence.jsx
 *
 * A one-time "field terminal" boot intro, shown once per browser session
 * (gated by sessionStorage in App.jsx). Lines type in, then the whole
 * thing dismisses itself -- or the player can skip by clicking/pressing
 * any key.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './BootSequence.module.css';

const LINES = [
  'INITIALIZING FIELD INVESTIGATIONS UNIT...',
  'LOADING PROCEDURAL CASE GENERATOR... OK',
  'CALIBRATING STATISTICAL DETECTORS... OK',
  'NO SERVER CONNECTION REQUIRED — RUNNING LOCAL',
  'WELCOME, ANALYST.',
];

export function BootSequence({ onComplete }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= LINES.length) {
      const exitTimer = setTimeout(onComplete, 650);
      return () => clearTimeout(exitTimer);
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 320);
    return () => clearTimeout(t);
  }, [visibleCount, onComplete]);

  useEffect(() => {
    const skip = () => onComplete();
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, [onComplete]);

  return (
    <div className={styles.wrap}>
      <div className={styles.terminal}>
        <AnimatePresence>
          {LINES.slice(0, visibleCount).map((line, i) => (
            <motion.div
              key={line}
              className={styles.line}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className={styles.prompt}>{'>'}</span> {line}
              {i === visibleCount - 1 && <span className={styles.caret} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <p className={styles.skipHint}>click or press any key to skip</p>
    </div>
  );
}
