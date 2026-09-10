import { formatValue } from '../game-logic/businessMetrics.js';

/**
 * DataTable
 *
 * A complementary, unambiguous alternative to clicking the chart or
 * dragging the slider: every day is a row in a scrollable list, so
 * there's no pixel-precision or nearest-point guessing involved at all.
 * Because a row click can never be "the wrong point" the way a chart
 * click can, clicking a row directly flags/unflags it in one action --
 * unlike the chart and slider, which only move focus and require the
 * Observation Panel's explicit Flag button. The chart still does the
 * visual pattern-spotting; this does the precision.
 */
export function DataTable({ series, unit, selectedIndices, focusedIndex, onRowClick, disabled, atFlagCap }) {
  return (
    <div className="dd-data-table">
      <div className="dd-data-table-scroll">
        {series.map((point, idx) => {
          const isFlagged = selectedIndices.has(idx);
          const isFocused = idx === focusedIndex;
          const blocked = !isFlagged && atFlagCap;
          return (
            <button
              key={idx}
              className={[
                'dd-data-table-row',
                isFlagged ? 'dd-data-table-row--flagged' : '',
                isFocused ? 'dd-data-table-row--focused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onRowClick(idx)}
              disabled={disabled || blocked}
            >
              <span className="dd-mono">{point.date}</span>
              <span className="dd-data-table-value">{formatValue(point.value, unit)}</span>
              {isFlagged && <span className="dd-pill dd-pill--info">flagged</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
