/**
 * StakeGauge.jsx
 *
 * Replaces a plain row of Low/Medium/High buttons with a single
 * horizontal meter: clicking a zone sets the stake, and a glowing fill
 * animates to that zone's width with spring physics. Still a single
 * click to select -- nothing about choosing a stake got harder, it
 * just reads as a physical "how much am I risking" gauge instead of
 * three interchangeable buttons, which matches what the mechanic
 * actually means (confidence as a magnitude, not a category).
 */
import { motion } from 'motion/react';
import { FORECAST_CONFIDENCE_LEVELS, FORECAST_CONFIDENCE_MULTIPLIERS } from '../engine/scoring.js';
import styles from './StakeGauge.module.css';

const ZONE_WIDTH = 100 / FORECAST_CONFIDENCE_LEVELS.length;

export function StakeGauge({ value, onChange, disabled = false }) {
  const activeIndex = FORECAST_CONFIDENCE_LEVELS.indexOf(value);
  const fillWidth = (activeIndex + 1) * ZONE_WIDTH;

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <motion.div
          className={styles.fill}
          animate={{ width: `${fillWidth}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        />
        {FORECAST_CONFIDENCE_LEVELS.map((level, i) => (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={styles.zone}
            style={{ left: `${i * ZONE_WIDTH}%`, width: `${ZONE_WIDTH}%` }}
            aria-label={`Stake: ${level}`}
          >
            <span className={`${styles.zoneLabel} ${i <= activeIndex ? styles.zoneLabelCovered : ''}`}>{level}</span>
          </button>
        ))}
      </div>
      <span className={styles.multiplier}>{FORECAST_CONFIDENCE_MULTIPLIERS[value].toFixed(1)}x reward / penalty</span>
    </div>
  );
}
