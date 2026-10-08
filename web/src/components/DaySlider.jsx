import { useEffect } from 'react';
import { formatValue } from '../engine/metrics.js';
import styles from './DaySlider.module.css';

/** A native range input for selecting an exact day -- independent of
 * chart interaction, pinpoint accuracy across the whole series in one
 * gesture, works identically on every device since it's a standard
 * form control. */
export function DaySlider({ series, unit, focusedIndex, onChange, disabled }) {
  const value = focusedIndex ?? 0;
  const point = series[value];

  return (
    <div className={styles.wrap}>
      <input
        type="range"
        min={0}
        max={series.length - 1}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={styles.input}
        aria-label="Select a day"
      />
      <div className={styles.readout}>
        <span className={styles.date}>{point.date}</span>
        <span>{formatValue(point.value, unit)}</span>
      </div>
    </div>
  );
}
