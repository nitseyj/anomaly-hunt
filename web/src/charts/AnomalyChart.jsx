import { useRef, useState, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useChartScales } from './useChartScales.js';
import { ChartGrid, AxisY, AxisX } from './ChartGrid.jsx';
import { SeriesPath } from './SeriesPath.jsx';
import { formatValue } from '../engine/metrics.js';
import { CHART_COLORS, DETECTOR_META } from '../design/chartColors.js';
import styles from './AnomalyChart.module.css';

const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.6 };

function Dart({ dim = false }) {
  const uid = useId();
  const shaftId = `shaft-${uid}`;
  const flightId = `flight-${uid}`;
  return (
    <svg width="20" height="28" viewBox="0 0 20 28" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={shaftId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f2f5fa" />
          <stop offset="45%" stopColor="#c7cfdc" />
          <stop offset="100%" stopColor="#8a93a6" />
        </linearGradient>
        <linearGradient id={flightId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe477" />
          <stop offset="55%" stopColor="#ffc72c" />
          <stop offset="100%" stopColor="#e6a400" />
        </linearGradient>
      </defs>
      <g opacity={dim ? 0.65 : 1}>
        <path d="M12.5 11 L19 2.5 L18.5 9.5 L13.5 13.5 Z" fill={`url(#${flightId})`} stroke="#2a1e00" strokeWidth="0.4" strokeOpacity="0.35" />
        <path d="M12.5 11 L19 2.5 L15.8 8.5 Z" fill="#fff" opacity="0.25" />
      </g>
      <path d="M10 28 L8.9 12.5 L13.6 10.2 L10.9 27.3 Z" fill={`url(#${shaftId})`} stroke="#1a1f2e" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M9.6 20 L9 12.8 L10.2 12.3 L10.4 19.6 Z" fill="#fff" opacity="0.45" />
    </svg>
  );
}

/**
 * The interactive Anomaly Hunt chart. Press anywhere on the plot area,
 * drag (the dart tracks the pointer with zero lag, same as before), and
 * release to commit a flag exactly where you let go -- the release point
 * is read from the SAME scale the line/axis/every marker use, so "lands
 * exactly under the cursor" is structural rather than independently
 * re-verified. A spring animation plays purely as flourish after the
 * commit; it never changes WHERE the flag lands.
 */
export default function AnomalyChart({
  series,
  unit,
  label,
  selectedIndices,
  yGuesses = {},
  onThrow,
  focusedIndex,
  revealData,
  detectorFlagsByType,
  layers,
  disabled,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 380 });
  const [pointer, setPointer] = useState(null); // {xFraction, yFraction} while hovering/dragging
  const [dragging, setDragging] = useState(false);
  const [throwId, setThrowId] = useState(0);

  const width = Math.max(0, size.width - MARGIN.left - MARGIN.right);
  const height = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);
  const scales = useChartScales(series, width, height);

  const measure = useCallback((node) => {
    if (!node) return;
    containerRef.current = node;
    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect;
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  function localPoint(e) {
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - MARGIN.left;
    const py = e.clientY - rect.top - MARGIN.top;
    return { px: Math.max(0, Math.min(width, px)), py: Math.max(0, Math.min(height, py)) };
  }

  function handlePointerMove(e) {
    if (disabled) return;
    const { px, py } = localPoint(e);
    setPointer({ px, py });
  }

  function handlePointerDown(e) {
    if (disabled || !onThrow) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    handlePointerMove(e);
  }

  function handlePointerUp(e) {
    if (disabled || !onThrow || !dragging) return;
    const { px, py } = localPoint(e);
    const idx = scales.xToIndex(px);
    const value = scales.yToValue(py);
    onThrow(idx, value);
    setDragging(false);
    setThrowId((n) => n + 1);
  }

  const dartFromFocus =
    focusedIndex != null
      ? { px: scales.x(focusedIndex), py: scales.y(yGuesses[focusedIndex] ?? series[focusedIndex].value) }
      : null;
  const dartPos = dragging ? pointer : dartFromFocus;

  const flaggedList = !revealData
    ? [...selectedIndices].map((idx) => ({
        idx,
        value: yGuesses[idx] != null ? yGuesses[idx] : series[idx].value,
      }))
    : [];
  const revealList = revealData
    ? [...selectedIndices].map((idx) => {
        const credited = revealData.hits.some((h) => h.matchedIndex === idx);
        return { idx, value: yGuesses[idx] != null ? yGuesses[idx] : series[idx].value, credited };
      })
    : [];

  const activeDetectorKeys = detectorFlagsByType ? Object.keys(detectorFlagsByType).filter((k) => layers?.[k]) : [];

  return (
    <div className={styles.container} ref={measure}>
      <svg width={size.width} height={size.height} className={styles.svg}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <ChartGrid width={width} height={height} scales={scales} />
          <AxisY scales={scales} formatValue={(v) => formatValue(v, unit)} width={width} />
          <AxisX series={series} scales={scales} height={height} />
          <SeriesPath series={series} scales={scales} height={height} />

          {/* Flagged (unrevealed) points -- shown at the guessed value, not
              snapped to the curve, so a throw's real vertical miss stays visible. */}
          {flaggedList.map((p) => (
            <circle key={p.idx} cx={scales.x(p.idx)} cy={scales.y(p.value)} r={5} fill={CHART_COLORS.selected} stroke={CHART_COLORS.selected} />
          ))}

          {revealData &&
            layers?.actual &&
            revealData.hits.map((h) => (
              <g key={`answer-${h.anomalyIndex}`} transform={`translate(${scales.x(h.anomalyIndex)},${scales.y(series[h.anomalyIndex].value)})`}>
                <circle r={23} fill="none" stroke={CHART_COLORS.creditHigh} strokeWidth={2} className={styles.pulseRing} />
                <circle r={5} fill={CHART_COLORS.creditHigh} style={{ filter: `drop-shadow(0 0 8px ${CHART_COLORS.creditHigh})` }} />
              </g>
            ))}

          {revealData &&
            layers?.yours &&
            revealList.map((p) => {
              const color = p.credited ? CHART_COLORS.selected : CHART_COLORS.falseAlarm;
              return <circle key={`yours-${p.idx}`} cx={scales.x(p.idx)} cy={scales.y(p.value)} r={5} fill={color} stroke={color} />;
            })}

          {revealData &&
            detectorFlagsByType &&
            activeDetectorKeys.map((key) =>
              series
                .map((p, i) => (detectorFlagsByType[key][i] ? i : null))
                .filter((i) => i !== null)
                .map((i, row) => (
                  <polygon
                    key={`${key}-${i}`}
                    points="0,-5 -4.5,4 4.5,4"
                    transform={`translate(${scales.x(i)},${scales.y(series[i].value) - 12 - activeDetectorKeys.indexOf(key) * 11})`}
                    fill={DETECTOR_META[key]?.color ?? CHART_COLORS.hint}
                  />
                ))
            )}

          {/* Hover preview, before a drag commits. The dart's own tip sits
              at local (10, 28) -- the bottom-center of its 20x28 viewBox --
              so shifting the group by (-10, -28) puts that exact tip at
              the pointer, matching how the live/thrown dart is anchored. */}
          {!disabled && !dragging && pointer && !revealData && (
            <g transform={`translate(${pointer.px - 10},${pointer.py - 28})`} className={styles.dartPreview}>
              <Dart dim />
            </g>
          )}
        </g>
      </svg>

      {/* The dart itself lives in an HTML layer on top of the SVG so it can
          use Framer Motion's spring physics -- animating an SVG transform
          with the same spring feel is far more fragile across browsers. */}
      {dartPos && !revealData && (
        <AnimatePresence>
          <motion.div
            key={dragging ? 'live' : throwId}
            className={styles.dartLayer}
            style={{ left: MARGIN.left, top: MARGIN.top }}
            initial={dragging ? false : { x: dartPos.px, y: dartPos.py - 40, opacity: 0, scale: 0.6, rotate: -30 }}
            animate={{ x: dartPos.px, y: dartPos.py, opacity: 1, scale: 1, rotate: 0 }}
            transition={dragging ? { duration: 0 } : SPRING}
          >
            <div className={styles.dartAnchor}>
              <Dart />
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <div
        className={styles.overlay}
        style={{ cursor: disabled ? 'default' : 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => !dragging && setPointer(null)}
      />
    </div>
  );
}
