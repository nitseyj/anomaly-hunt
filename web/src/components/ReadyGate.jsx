/**
 * ReadyGate.jsx
 *
 * A deliberate pause between "the case is loaded" and "the clock (or
 * round) actually starts" -- replaces throwing a live countdown, or an
 * already-sweeping chart, at the player the instant a case mounts. The
 * brief above this (ObservationPanel) is already readable; this is just
 * the moment to read it before anything starts moving.
 */
import { motion } from 'motion/react';
import { Button } from './Button.jsx';
import { CornerBrackets } from './CornerBrackets.jsx';
import styles from './ReadyGate.module.css';

export function ReadyGate({ detail, buttonLabel = 'Start', onStart, secondaryLabel = null, onSecondaryStart = null }) {
  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <CornerBrackets />
      <span className={styles.pulse} />
      <p className={styles.detail}>{detail}</p>
      <div className={styles.buttonRow}>
        <Button variant="primary" size="lg" onClick={onStart}>
          {buttonLabel}
        </Button>
        {secondaryLabel && onSecondaryStart && (
          <Button variant="ghost" size="lg" onClick={onSecondaryStart}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
