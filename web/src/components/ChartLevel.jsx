import { useState, useRef } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Line,
  Area,
  Label,
  ReferenceLine,
} from 'recharts';
import { CREDIT_RADIUS } from '../game-logic/scoring.js';
import { formatValue } from '../game-logic/businessMetrics.js';
import { CHART_COLORS, DETECTOR_META } from '../game-logic/chartTheme.js';

// These MUST match the ComposedChart's own margin/axis-width props below --
// they're not guessed from Recharts' rendering, they're the exact same
// numbers, so the click-overlay's pixel math and the chart's own plotted
// area are guaranteed to agree rather than drifting apart.
const CHART_MARGIN = { top: 8, right: 12, bottom: 8, left: 4 };
const Y_AXIS_WIDTH = 64;
const X_AXIS_HEIGHT = 24;

/**
 * A small marker used for the focused point, flagged points, and (post-
 * reveal) outcome markers. Deliberately sparse: only ever a handful of
 * these render at once (the flagged points, the one focused point) --
 * never one per data point. That's the core change here: instead of 90
 * always-visible dots (hard to parse, hard to click reliably), the
 * chart itself is the click target and only what actually matters gets
 * a marker.
 */
function PointMarker({ cx, cy, fill, stroke, r = 5, ring = false }) {
  if (cx == null || cy == null) return null;
  if (ring) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 4px ${stroke}66)` }}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.5}
      style={{ filter: `drop-shadow(0 0 4px ${fill}66)` }}
    />
  );
}

/** A small triangle marking a point one specific statistical detector flagged. */
function DetectorMarker({ cx, cy, color, rowOffset }) {
  if (cx == null || cy == null) return null;
  const size = 4.5;
  const top = cy - 14 - rowOffset * 11;
  return <polygon points={`${cx},${top - size} ${cx - size},${top + size} ${cx + size},${top + size}`} fill={color} />;
}

/** A simple dart-like marker: a landing point with a small shaft/flight, matching the app's plain-SVG visual language rather than an emoji. */
function DartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ display: 'block', overflow: 'visible' }}>
      <circle cx="11" cy="11" r="3.5" fill={CHART_COLORS.selected} style={{ filter: `drop-shadow(0 0 5px ${CHART_COLORS.selected}88)` }} />
      <line x1="11" y1="11" x2="18" y2="4" stroke={CHART_COLORS.selected} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 4 L21.5 2.5 L19.5 6 Z" fill={CHART_COLORS.selected} />
    </svg>
  );
}

/**
 * ChartLevel
 *
 * The chart itself is read-only feedback, not the primary input: clicking
 * it (best-effort, snaps to the nearest day if it registers) only moves
 * the FOCUSED day -- it never flags anything by itself. The actual
 * selection controls are the DaySlider and ObservationPanel rendered
 * alongside this chart, which always work regardless of whether chart
 * clicks register reliably. The currently-focused day shows as a dashed
 * vertical guide; flagged days show as small markers.
 *
 * After reveal, up to five independently toggleable layers can render:
 * your own flags (blue = credited, red = false alarm), the true anomaly
 * locations (green rings), and one marker row per statistical detector.
 */
export default function ChartLevel({
  series,
  unit,
  yLabel,
  selectedIndices,
  onDartThrow,
  focusedIndex,
  revealData,
  showRollingAverage,
  detectorFlagsByType,
  layers,
}) {
  const chartData = series.map((point, idx) => ({ idx, date: point.date, value: point.value }));
  const overlayRef = useRef(null);
  const [justThrew, setJustThrew] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(null);

  if (showRollingAverage) {
    const window = 14;
    for (let i = 0; i < chartData.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(chartData.length, i + Math.floor(window / 2) + 1);
      const slice = chartData.slice(start, end);
      chartData[i].rollingAvg = slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
    }
  }

  const formatY = (v) => formatValue(v, unit);

  // The series' own value range -- used both to convert a raw click's Y
  // pixel position into a data value, and to keep the dart marker's
  // vertical placement consistent with what the chart actually renders.
  // The YAxis domain below is set to these SAME explicit values (with a
  // small padding baked in) rather than Recharts' auto-domain, so the
  // overlay's pixel math and the rendered chart can't drift apart.
  const values = chartData.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin || 1;
  const yMin = rawMin - rawRange * 0.05;
  const yMax = rawMax + rawRange * 0.05;
  const yRange = yMax - yMin;

  /**
   * Captures a raw click anywhere over the plot area and converts it into
   * a (day index, guessed value) pair -- this is what makes the chart a
   * genuine free-aim target instead of only ever snapping onto the curve.
   * Uses a plain DOM overlay rather than Recharts' click event, since the
   * overlay's pixel math is fully within our control (see CHART_MARGIN /
   * Y_AXIS_WIDTH / X_AXIS_HEIGHT above) rather than depending on Recharts
   * internals that can't be verified without a live browser.
   */
  function handleOverlayClick(e) {
    if (revealData || !onDartThrow) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const xFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yFraction = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const idx = Math.round(xFraction * (chartData.length - 1));
    const guessedValue = yMin + yFraction * yRange;

    onDartThrow(idx, guessedValue, { xFraction, yFraction });
    setJustThrew(true);
    setTimeout(() => setJustThrew(false), 260);
  }

  function handleOverlayMouseMove(e) {
    if (revealData) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const xFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yFraction = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setHoverPosition({ xFraction, yFraction });
  }

  function handleOverlayMouseLeave() {
    setHoverPosition(null);
  }

  // Where the dart marker sits: at the last free-thrown spot if the throw
  // landed on the currently-focused day, otherwise "perfect aim" -- right
  // on the curve at the focused day (matches how the slider/table always
  // aim exactly at the real value). This is what makes moving the slider
  // look like the dart sliding smoothly into a new, precise position
  // rather than a fresh throw.
  let dartPosition = null;
  if (!revealData && focusedIndex != null) {
    const onCurveX = focusedIndex / Math.max(1, chartData.length - 1);
    const onCurveY = (chartData[focusedIndex].value - yMin) / yRange;
    dartPosition = { xFraction: onCurveX, yFraction: onCurveY };
  }

  // Sparse marker sets -- never one entry per data point.
  const flaggedPoints = !revealData ? [...selectedIndices].map((idx) => chartData[idx]) : [];

  // "Yours" layer: one marker per point you clicked, blue if it earned
  // credit for some anomaly, red if it was a false alarm.
  const yoursPoints = revealData
    ? [...selectedIndices].map((idx) => {
        const credited = revealData.hits.some((h) => h.matchedIndex === idx);
        return { ...chartData[idx], credited };
      })
    : [];

  // "Actual" layer: one marker per true anomaly, at its real location.
  const actualPoints = revealData
    ? revealData.hits.map((h) => ({ ...chartData[h.anomalyIndex], found: h.matchedIndex !== null }))
    : [];

  const activeDetectorKeys = detectorFlagsByType
    ? Object.keys(detectorFlagsByType).filter((key) => layers?.[key])
    : [];

  // Simple numeric skip-interval for ~6 evenly-spaced labels -- more
  // predictable than Recharts' "preserveStartEnd" auto-calculation.
  const tickInterval = Math.max(0, Math.ceil(chartData.length / 6) - 1);

  return (
    <div>
      <div className="dd-chart-container" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={chartData}
            margin={CHART_MARGIN}
            style={{ cursor: revealData ? 'default' : 'none' }}
          >
            <defs>
              <linearGradient id="ah-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.selected} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.selected} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              type="category"
              dataKey="date"
              height={X_AXIS_HEIGHT}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              interval={tickInterval}
              axisLine={{ stroke: CHART_COLORS.axisLine }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              tickFormatter={formatY}
              domain={[yMin, yMax]}
              width={Y_AXIS_WIDTH}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value={yLabel}
                angle={-90}
                position="insideLeft"
                style={{ fontSize: 11, fill: CHART_COLORS.axisText, textAnchor: 'middle' }}
              />
            </YAxis>
            {!revealData && focusedIndex != null && (
              <ReferenceLine x={chartData[focusedIndex].date} stroke={CHART_COLORS.selected} strokeDasharray="4 4" />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#ah-area-gradient)"
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.line}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive
              animationDuration={600}
              activeDot={false}
            />
            {showRollingAverage && (
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke={CHART_COLORS.hint}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                activeDot={false}
              />
            )}

            {flaggedPoints.length > 0 && (
              <Scatter
                data={flaggedPoints}
                dataKey="value"
                shape={(props) => <PointMarker {...props} fill={CHART_COLORS.selected} stroke={CHART_COLORS.selected} r={5} />}
                legendType="none"
                isAnimationActive={false}
              />
            )}

            {revealData && layers?.actual && (
              <Scatter
                data={actualPoints}
                dataKey="value"
                shape={(props) => (
                  <PointMarker {...props} ring stroke={CHART_COLORS.creditHigh} r={props.payload.found ? 8 : 9} />
                )}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {revealData && layers?.yours && (
              <Scatter
                data={yoursPoints}
                dataKey="value"
                shape={(props) => (
                  <PointMarker
                    {...props}
                    fill={props.payload.credited ? CHART_COLORS.selected : CHART_COLORS.falseAlarm}
                    stroke={props.payload.credited ? CHART_COLORS.selected : CHART_COLORS.falseAlarm}
                    r={5}
                  />
                )}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {revealData &&
              detectorFlagsByType &&
              activeDetectorKeys.map((key, rowIdx) => (
                <Scatter
                  key={key}
                  data={chartData.filter((p) => detectorFlagsByType[key][p.idx])}
                  dataKey="value"
                  shape={(props) => (
                    <DetectorMarker {...props} color={DETECTOR_META[key]?.color ?? CHART_COLORS.detectorFlag} rowOffset={rowIdx} />
                  )}
                  legendType="none"
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>

        {!revealData && (
          <div
            ref={overlayRef}
            className="dd-dart-overlay"
            onClick={handleOverlayClick}
            onMouseMove={handleOverlayMouseMove}
            onMouseLeave={handleOverlayMouseLeave}
            style={{
              position: 'absolute',
              top: CHART_MARGIN.top,
              left: CHART_MARGIN.left + Y_AXIS_WIDTH,
              right: CHART_MARGIN.right,
              bottom: CHART_MARGIN.bottom + X_AXIS_HEIGHT,
            }}
          >
            {hoverPosition && (
              <div
                className="dd-dart dd-dart--preview"
                style={{
                  left: `${hoverPosition.xFraction * 100}%`,
                  top: `${(1 - hoverPosition.yFraction) * 100}%`,
                }}
                aria-hidden="true"
              >
                <DartIcon />
              </div>
            )}
            {dartPosition && (
              <div
                className={`dd-dart ${justThrew ? 'dd-dart--thrown' : ''}`}
                style={{
                  left: `${dartPosition.xFraction * 100}%`,
                  top: `${(1 - dartPosition.yFraction) * 100}%`,
                }}
                aria-hidden="true"
              >
                <DartIcon />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="dd-chart-caption">
        {revealData
          ? 'Toggle layers above to compare your flags against the true anomalies and each statistical detector.'
          : `Throw a dart anywhere on the chart to flag that spot — you don't have to hit the line exactly. The closer to the true day AND value, the more credit you earn. Drag the slider below for a precise, guided throw instead.`}
      </p>
    </div>
  );
}
