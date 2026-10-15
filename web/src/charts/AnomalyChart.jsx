/**
 * AnomalyChart.jsx
 *
 * The interactive investigation surface. Press-drag-release places a
 * flag: a dart follows the pointer with spring physics while held, and
 * on release snaps to the nearest series index, reading its (x, y) back
 * from the SAME scale the line itself is drawn with -- "lands exactly
 * on the curve" is structural, not something to re-verify by hand per
 * case. A plain tap (down+up with no movement) places a flag directly,
 * for players who just want to point and click.
 *
 * Below the main series, a day-over-day DELTA STRIP renders the same
 * data as a first-difference bar chart (today minus yesterday) sharing
 * the main chart's x-scale. This isn't a hint overlay -- it's the same
 * transformation an analyst would actually look at, and it makes any
 * genuine jump (the moment an anomaly starts) read as a visible bar
 * regardless of how calm the smoothed line itself looks either side of
 * it.
 *
 * The drag-throw gesture is inherently a pointer thing, so arrow-key
 * navigation is a real second input path, not just a focus ring for
 * show: Left/Right moves the same `hover` cursor pointer movement
 * already drives (so the visible hover dot and the on-screen date/value
 * readout both just work, unchanged, for keyboard input too), and
 * Enter/Space toggles a flag at that index through the exact same
 * toggleFlag() the pointer path calls. A keyboard placement always lands
 * exactly on the curve's own value -- there's no sub-pixel y-axis
 * equivalent to a mouse position for arrow keys to drive, so rather than
 * guess, it gives keyboard play perfect y-accuracy automatically.
 */
import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { scaleLinear } from 'd3-scale';
import { useChartScales } from './useChartScales.js';
import { ChartGrid } from './ChartGrid.jsx';
import { SeriesPath } from './SeriesPath.jsx';
import { CornerBrackets } from '../components/CornerBrackets.jsx';
import { formatValue } from '../engine/metrics.js';
import styles from './AnomalyChart.module.css';

const WIDTH = 820;
const HEIGHT = 320;
const DELTA_GAP = 18;
const DELTA_HEIGHT = 70;
const TOTAL_HEIGHT = HEIGHT + DELTA_GAP + DELTA_HEIGHT;
const DELTA_TOP = HEIGHT + DELTA_GAP;
const DELTA_MID = DELTA_TOP + DELTA_HEIGHT / 2;

export function AnomalyChart({
  series,
  unit,
  flags = [],
  maxFlags = 6,
  onPlaceFlag,
  onRemoveFlag,
  groundTruth = null,
  revealed = false,
  detectorFlags = null,
  disabled = false,
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const { xScale, yScale, padding } = useChartScales(series, { width: WIDTH, height: HEIGHT, padding: 64 });
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);

  const rawDartX = useMotionValue(0);
  const rawDartY = useMotionValue(0);
  const dartX = useSpring(rawDartX, { stiffness: 420, damping: 32 });
  const dartY = useSpring(rawDartY, { stiffness: 420, damping: 32 });

  const deltas = series.map((p, i) => (i === 0 ? 0 : p.value - series[i - 1].value));
  const maxAbsDelta = Math.max(...deltas.map(Math.abs)) || 1;
  const deltaScale = scaleLinear().domain([-maxAbsDelta, maxAbsDelta]).range([DELTA_TOP + DELTA_HEIGHT, DELTA_TOP]);
  const barWidth = Math.max(1.5, (xScale(1) - xScale(0)) * 0.6);

  const toLocal = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = WIDTH / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  }, []);

  const nearestFromLocal = useCallback(
    (local) => {
      const rawIndex = xScale.invert(local.x);
      const idx = Math.max(0, Math.min(series.length - 1, Math.round(rawIndex)));
      const value = yScale.invert(local.y);
      return { idx, value };
    },
    [xScale, yScale, series.length]
  );

  const canThrow = !disabled && flags.length < maxFlags;

  // Shared by the pointer-release path and the keyboard path -- exactly
  // one place that ever places or removes a flag, same as before.
  const toggleFlag = useCallback(
    (idx, value) => {
      if (!canThrow) return;
      const existing = flags.find((f) => f.index === idx);
      if (existing) onRemoveFlag?.(existing.index);
      else onPlaceFlag?.(idx, value);
    },
    [canThrow, flags, onPlaceFlag, onRemoveFlag]
  );

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const base = hover ? hover.idx : 0;
      const idx = Math.max(0, Math.min(series.length - 1, base + delta));
      setHover({ idx, value: series[idx].value });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!hover) {
        setHover({ idx: 0, value: series[0].value });
        return;
      }
      toggleFlag(hover.idx, series[hover.idx].value);
    }
  };

  const handlePointerMove = (e) => {
    const local = toLocal(e.clientX, e.clientY);
    if (!local) return;
    if (dragging) {
      rawDartX.set(local.x);
      rawDartY.set(local.y);
      setHover(nearestFromLocal(local));
    } else if (!disabled) {
      setHover(nearestFromLocal(local));
    }
  };

  const handlePointerDown = (e) => {
    if (!canThrow) return;
    const local = toLocal(e.clientX, e.clientY);
    if (!local) return;
    rawDartX.set(local.x);
    rawDartY.set(local.y);
    setDragging(true);
    e.target.setPointerCapture?.(e.pointerId);
  };

  // Handles both a plain tap (down+up with ~no movement) and a drag-release
  // (down+move+up) through the same path, so there's exactly one place
  // that ever places or removes a flag -- no risk of a tap double-firing
  // through both a pointerup handler and a separate click handler.
  const finishThrow = (e) => {
    if (!dragging) return;
    setDragging(false);
    const local = toLocal(e.clientX, e.clientY);
    if (!local || !canThrow) return;
    const hit = nearestFromLocal(local);
    toggleFlag(hit.idx, hit.value);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.svgWrap}>
      <CornerBrackets />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`}
        className={styles.svg}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={handlePointerDown}
        onPointerUp={finishThrow}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="img"
        aria-label="Metric chart. Use the Left and Right arrow keys to move between days, Enter or Space to flag or unflag the current day."
        style={{ cursor: disabled ? 'default' : flags.length >= maxFlags ? 'not-allowed' : 'crosshair' }}
      >
        <ChartGrid xScale={xScale} yScale={yScale} series={series} width={WIDTH} height={HEIGHT} unit={unit} formatValue={formatValue} />
        <SeriesPath series={series} xScale={xScale} yScale={yScale} />

        {revealed &&
          groundTruth?.map((a) => (
            <g key={`truth-${a.index}`} transform={`translate(${xScale(a.index)}, ${yScale(series[a.index].value)})`}>
              <circle r="14" className={styles.truthRing} />
              <circle r="4" className={styles.truthDot} />
            </g>
          ))}

        {revealed &&
          detectorFlags &&
          detectorFlags.map((flagged, i) =>
            flagged ? (
              <rect key={`det-${i}`} x={xScale(i) - 2} y={padding} width="4" height={HEIGHT - padding * 2} className={styles.detectorTick} />
            ) : null
          )}

        <AnimatePresence>
          {flags.map((f) => (
            <g key={`flag-${f.index}`} transform={`translate(${xScale(f.index)}, ${yScale(f.value)})`} className={styles.flagGroup}>
              <motion.g
                initial={{ opacity: 0, scale: 0.3, y: -26 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: 'spring', stiffness: 480, damping: 16 }}
              >
                <motion.circle
                  r="3"
                  className={styles.sonarRing}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 10, opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.05 }}
                />
                <motion.circle
                  r="3"
                  className={styles.sonarRing}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 10, opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.22 }}
                />
                <path d="M0,-11 L7,8 L0,4 L-7,8 Z" className={styles.dartMark} />
              </motion.g>
            </g>
          ))}
        </AnimatePresence>

        {hover && !dragging && !disabled && flags.length < maxFlags && (
          <g transform={`translate(${xScale(hover.idx)}, 0)`} className={styles.hoverGroup}>
            <line x1="0" x2="0" y1={padding} y2={HEIGHT - padding} className={styles.hoverLine} />
            <circle cx="0" cy={yScale(series[hover.idx].value)} r="5" className={styles.hoverDot} />
          </g>
        )}

        {dragging && (
          <motion.g style={{ x: dartX, y: dartY }} className={styles.liveDartGroup}>
            <path d="M0,-13 L8,9 L0,5 L-8,9 Z" className={styles.liveDart} />
          </motion.g>
        )}

        {/* Delta strip: day-over-day first difference, same x-scale as the
            series above it. Bars above the midline grew vs. yesterday,
            below the midline fell -- an anomaly's onset is the one place
            this reliably spikes regardless of how calm the line looks. */}
        <g className={styles.deltaGroup}>
          <line x1={padding} x2={WIDTH - padding} y1={DELTA_MID} y2={DELTA_MID} className={styles.deltaBaseline} />
          <text x={padding} y={DELTA_TOP - 5} className={styles.deltaLabel}>
            Δ DAY-OVER-DAY
          </text>
          {deltas.map((d, i) =>
            i === 0 ? null : (
              <rect
                key={i}
                x={xScale(i) - barWidth / 2}
                y={Math.min(deltaScale(d), DELTA_MID)}
                width={barWidth}
                height={Math.abs(deltaScale(d) - DELTA_MID)}
                className={d >= 0 ? styles.deltaBarUp : styles.deltaBarDown}
              />
            )
          )}
          {hover && !disabled && (
            <line x1={xScale(hover.idx)} x2={xScale(hover.idx)} y1={DELTA_TOP} y2={DELTA_TOP + DELTA_HEIGHT} className={styles.deltaHoverLine} />
          )}
        </g>
      </svg>
      </div>

      <div className={styles.meta}>
        {flags.length === 0 ? (
          <span className={styles.metaItem}>0/{maxFlags} flags placed</span>
        ) : (
          <div className={styles.evidenceTray}>
            {flags.map((f) => (
              <button key={f.index} className={styles.evidenceChip} onClick={() => onRemoveFlag?.(f.index)} title="Remove flag">
                <span className={styles.evidenceDate}>{series[f.index].date.slice(5)}</span>
                <span className={styles.evidenceClose}>×</span>
              </button>
            ))}
            <span className={styles.evidenceCount}>
              {flags.length}/{maxFlags}
            </span>
          </div>
        )}
        {hover && !disabled && (
          <span className={styles.metaItem} aria-live="polite">
            {series[hover.idx].date} · {formatValue(series[hover.idx].value, unit)}
            {flags.some((f) => f.index === hover.idx) ? ' · flagged' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
