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
 */
import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { useChartScales } from './useChartScales.js';
import { ChartGrid } from './ChartGrid.jsx';
import { SeriesPath } from './SeriesPath.jsx';
import { formatValue } from '../engine/metrics.js';
import styles from './AnomalyChart.module.css';

const WIDTH = 820;
const HEIGHT = 360;

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
    const existing = flags.find((f) => f.index === hit.idx);
    if (existing) onRemoveFlag?.(existing.index);
    else onPlaceFlag?.(hit.idx, hit.value);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={handlePointerDown}
        onPointerUp={finishThrow}
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
      </svg>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          {flags.length}/{maxFlags} flags placed
        </span>
        {hover && !disabled && (
          <span className={styles.metaItem}>
            {series[hover.idx].date} · {formatValue(series[hover.idx].value, unit)}
          </span>
        )}
      </div>
    </div>
  );
}
