import { formatValue } from '../engine/metrics.js';
import styles from './DataTable.module.css';

/** An unambiguous alternative to the chart/slider: every day as a row,
 * so there's no pixel-precision involved. A row click flags/unflags
 * directly in one action (unlike the chart/slider, which only move
 * focus and require the Observation Panel's explicit button). */
export function DataTable({ series, unit, selectedIndices, focusedIndex, onRowClick, disabled, atFlagCap }) {
  return (
    <div className={styles.table}>
      <div className={styles.scroll}>
        {series.map((point, idx) => {
          const isFlagged = selectedIndices.has(idx);
          const isFocused = idx === focusedIndex;
          const blocked = !isFlagged && atFlagCap;
          return (
            <button
              key={idx}
              className={[styles.row, isFlagged ? styles.flagged : '', isFocused ? styles.focused : ''].filter(Boolean).join(' ')}
              onClick={() => onRowClick(idx)}
              disabled={disabled || blocked}
            >
              <span className={styles.date}>{point.date}</span>
              <span className={styles.value}>{formatValue(point.value, unit)}</span>
              {isFlagged && <span className={styles.pill}>flagged</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
