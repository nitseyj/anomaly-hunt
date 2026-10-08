import { formatValue } from '../engine/metrics.js';
import { Button } from './Button.jsx';
import styles from './ObservationPanel.module.css';

/** Shows the currently focused day (set by the chart, slider, or
 * prev/next here) and is the ONLY place a flag actually gets applied --
 * moving focus never flags anything by itself, so browsing never risks
 * an accidental flag. */
export function ObservationPanel({ series, unit, focusedIndex, onFocusChange, selectedIndices, onToggleFocused, disabled, atFlagCap }) {
  if (focusedIndex === null) {
    return <div className={styles.empty}>Drag a dart onto the chart or use the slider below it to focus a day — then flag it here.</div>;
  }

  const point = series[focusedIndex];
  const isFlagged = selectedIndices.has(focusedIndex);
  const blockedByCap = !isFlagged && atFlagCap;

  return (
    <div className={styles.panel}>
      <div className={styles.nav}>
        <button className={styles.navBtn} onClick={() => onFocusChange(Math.max(0, focusedIndex - 1))} disabled={disabled || focusedIndex === 0} aria-label="Previous day">
          ‹
        </button>
        <div className={styles.info}>
          <span className={styles.date}>{point.date}</span>
          <span className={styles.value}>{formatValue(point.value, unit)}</span>
        </div>
        <button
          className={styles.navBtn}
          onClick={() => onFocusChange(Math.min(series.length - 1, focusedIndex + 1))}
          disabled={disabled || focusedIndex === series.length - 1}
          aria-label="Next day"
        >
          ›
        </button>
      </div>
      <Button variant={isFlagged ? 'default' : 'primary'} style={{ width: '100%' }} onClick={onToggleFocused} disabled={disabled || blockedByCap}>
        {blockedByCap ? 'Flag limit reached — remove one first' : isFlagged ? 'Remove flag' : 'Flag this observation'}
      </Button>
    </div>
  );
}

export function FlaggedList({ series, unit, selectedIndices, onToggle, disabled }) {
  const sorted = [...selectedIndices].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  return (
    <div className={styles.flaggedList}>
      <div className={styles.flaggedTitle}>Flagged observations ({sorted.length})</div>
      {sorted.map((idx) => (
        <div key={idx} className={styles.flaggedRow}>
          <span className={styles.flaggedDate}>{series[idx].date}</span>
          <span className={styles.flaggedValue}>{formatValue(series[idx].value, unit)}</span>
          <button className={styles.remove} onClick={() => onToggle(idx)} disabled={disabled} aria-label="Remove flag">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
