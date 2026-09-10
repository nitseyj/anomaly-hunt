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
  onPointClick,
  focusedIndex,
  revealData,
  showRollingAverage,
  detectorFlagsByType,
  layers,
}) {
  const chartData = series.map((point, idx) => ({ idx, date: point.date, value: point.value }));

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

  function handleChartClick(chartState) {
    if (revealData || !chartState || chartState.activeTooltipIndex == null) return;
    onPointClick(chartState.activeTooltipIndex);
  }

  // Sparse marker sets -- never one entry per data point.
  const focusedPoint = !revealData && focusedIndex != null ? [chartData[focusedIndex]] : [];
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
      <div className="dd-chart-container">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
            onClick={handleChartClick}
            style={{ cursor: revealData ? 'default' : 'pointer' }}
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
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              interval={tickInterval}
              axisLine={{ stroke: CHART_COLORS.axisLine }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              tickFormatter={formatY}
              domain={['auto', 'auto']}
              width={64}
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

            {focusedPoint.length > 0 && (
              <Scatter
                data={focusedPoint}
                dataKey="value"
                shape={(props) => <PointMarker {...props} ring stroke={CHART_COLORS.selected} r={9} />}
                legendType="none"
                isAnimationActive={false}
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
      </div>
      <p className="dd-chart-caption">
        {revealData
          ? 'Toggle layers above to compare your flags against the true anomalies and each statistical detector.'
          : `Drag the slider below to browse — dragging alone won't flag anything. Press the Flag button when a day looks wrong. Being within ${CREDIT_RADIUS} days of the real answer still earns partial credit.`}
      </p>
    </div>
  );
}
