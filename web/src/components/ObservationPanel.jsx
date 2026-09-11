import { formatValue } from '../game-logic/businessMetrics.js';

/** A simple hand icon shown next to the slider thumb while dragging -- reinforces that the slider is "a hand carefully placing the dart," distinct from the chart's free throw. */
function HandIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" style={{ display: 'block' }}>
      <rect x="5" y="9" width="8" height="11" rx="4" fill="var(--accent)" />
      <rect x="3" y="6" width="3" height="9" rx="1.5" fill="var(--accent)" />
      <rect x="7" y="4" width="3" height="11" rx="1.5" fill="var(--accent)" />
      <rect x="11" y="5" width="3" height="10" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}

/**
 * DaySlider
 *
 * A native HTML range input for selecting exactly which day is focused --
 * completely independent of chart click-event detection (which has proven
 * unreliable across data with 90 closely-spaced points). Dragging gives
 * pinpoint, one-day-at-a-time accuracy across the whole series in a
 * single gesture, and works identically on every browser/device since
 * it's a standard form control, not a custom hit-testing layer.
 *
 * A small hand icon appears above the thumb while actively dragging (CSS
 * :active, no JS drag-tracking needed) -- visually distinct from the
 * chart's free-throw dart, reinforcing that the slider is a precise,
 * guided placement rather than a thrown guess.
 */
export function DaySlider({ series, unit, focusedIndex, onChange, disabled }) {
  const value = focusedIndex ?? 0;
  const point = series[value];
  const percent = series.length > 1 ? (value / (series.length - 1)) * 100 : 0;

  return (
    <div className="dd-day-slider">
      <div className="dd-day-slider-track-wrap">
        <input
          type="range"
          min={0}
          max={series.length - 1}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="dd-day-slider-input"
          aria-label="Select a day"
        />
        <div className="dd-slider-hand" style={{ left: `${percent}%` }} aria-hidden="true">
          <HandIcon />
        </div>
      </div>
      <div className="dd-day-slider-readout">
        <span className="dd-mono">{point.date}</span>
        <span>{formatValue(point.value, unit)}</span>
      </div>
    </div>
  );
}

/**
 * ObservationPanel
 *
 * Shows exactly which date+value is currently focused (set by clicking
 * the chart, dragging the slider, or the prev/next buttons here), and
 * is the ONLY place a flag actually gets applied or removed -- clicking
 * the chart or moving the slider just changes what's focused, so
 * browsing around never accidentally flags something.
 */
export function ObservationPanel({ series, unit, focusedIndex, onFocusChange, selectedIndices, onToggleFocused, disabled, atFlagCap }) {
  if (focusedIndex === null) {
    return (
      <div className="dd-obs-panel dd-obs-panel--empty">
        Click the chart or drag the slider below it to focus a day — then flag it here.
      </div>
    );
  }

  const point = series[focusedIndex];
  const isFlagged = selectedIndices.has(focusedIndex);
  const blockedByCap = !isFlagged && atFlagCap;

  return (
    <div className="dd-obs-panel">
      <div className="dd-obs-nav">
        <button
          className="dd-obs-nav-btn"
          onClick={() => onFocusChange(Math.max(0, focusedIndex - 1))}
          disabled={disabled || focusedIndex === 0}
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="dd-obs-info">
          <span className="dd-obs-date dd-mono">{point.date}</span>
          <span className="dd-obs-value">{formatValue(point.value, unit)}</span>
        </div>
        <button
          className="dd-obs-nav-btn"
          onClick={() => onFocusChange(Math.min(series.length - 1, focusedIndex + 1))}
          disabled={disabled || focusedIndex === series.length - 1}
          aria-label="Next day"
        >
          ›
        </button>
      </div>
      <button
        className={`dd-btn ${isFlagged ? '' : 'dd-btn--primary'}`}
        style={{ width: '100%' }}
        onClick={onToggleFocused}
        disabled={disabled || blockedByCap}
      >
        {blockedByCap ? 'Flag limit reached — remove one first' : isFlagged ? 'Remove flag' : 'Flag this observation'}
      </button>
    </div>
  );
}

/**
 * FlaggedList
 *
 * A compact summary of every currently-flagged observation, so the
 * player can see exactly what they've selected without hunting for
 * small dots on the chart -- and remove any of them directly.
 */
export function FlaggedList({ series, unit, selectedIndices, onToggle, disabled }) {
  const sorted = [...selectedIndices].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  return (
    <div className="dd-flagged-list">
      <div className="dd-flagged-list-title">Flagged observations ({sorted.length})</div>
      {sorted.map((idx) => (
        <div key={idx} className="dd-flagged-row">
          <span className="dd-mono">{series[idx].date}</span>
          <span>{formatValue(series[idx].value, unit)}</span>
          <button className="dd-flagged-remove" onClick={() => onToggle(idx)} disabled={disabled} aria-label="Remove flag">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
