/**
 * ScreenTransition.jsx
 *
 * A full-viewport radar-sweep overlay that flashes across on every
 * screen change -- the signature motion of the app, tying every
 * navigation back to the same "signal sweep" language as RadarField
 * and the chart reveal. Purely decorative (pointer-events: none) and
 * independent of the actual screen's own fade/slide transition, so it
 * never blocks or delays interaction with the new screen.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './ScreenTransition.module.css';

export function ScreenTransition({ triggerKey }) {
  const [active, setActive] = useState(null);

  useEffect(() => {
    setActive(triggerKey);
    const t = setTimeout(() => setActive(null), 500);
    return () => clearTimeout(t);
  }, [triggerKey]);

  return (
    <AnimatePresence>
      {active !== null && (
        <motion.div
          key={active}
          className={styles.wrap}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={styles.beam}
            initial={{ left: '-10%' }}
            animate={{ left: '110%' }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          />
          <motion.div
            className={styles.flash}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
