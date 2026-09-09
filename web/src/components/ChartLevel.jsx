import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Line,
  Area,
  Label,
} from 'recharts';
import { CREDIT_RADIUS } from '../game-logic/scoring.js';
import { formatValue } from '../game-logic/businessMetrics.js';
import { CHART_COLORS, DETECTOR_META } from '../game-logic/chartTheme.js';

/**
 * A generously-sized clickable dot. The visible circle is small, but an
 * invisible larger circle underneath captures the click — this is what
 * makes individual points actually easy to hit, instead of relying on
 * cursor-perfect precision on a thin line among 90 crowded points.
 */
function ClickableDot({ cx, cy, payload, fill, stroke, r = 4, onClick }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        style={fill !== 'transparent' ? { filter: 'drop-shadow(0 0 4px ' + fill + '66)' } : undefined}
      />
      {onClick && (
        <circle
          cx={cx}
          cy={cy}
          r={16}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={() => onClick(payload.idx)}
        />
      )}
    </g>
  );
}

/** A hollow ring marking a true anomaly location -- filled center if you got credit for it, empty if missed. */
function ActualMarker({ cx, cy, found }) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={found ? 8 : 9}
      fill="none"
      stroke={CHART_COLORS.creditHigh}
      strokeWidth={found ? 1.5 : 2.25}
      style={{ filter: `drop-shadow(0 0 3px ${CHART_COLORS.creditHigh}55)` }}
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
 * A minimal custom tooltip: Recharts' default Tooltip renders one row per
 * chart series present at that x-position, but this chart deliberately
 * layers several Area/Line/Scatter elements on the same "value" dataKey
 * (a visible line, a decorative gradient fill, click-target overlays) --
 * the default Tooltip would show a duplicated, sometimes-NaN row per
 * layer. This picks out exactly one valid numeric entry instead.
 */
function ChartTooltip({ active, payload, label, unit, yLabel }) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload.find((p) => typeof p.value === 'number' && !isNaN(p.value));
  if (!entry) return null;
  return (
    <div
      style={{
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        color: 'var(--ink)',
        padding: '8px 10px',
      }}
    >
      <div style={{ color: 'var(--ink-muted)', marginBottom: 2 }}>{label}</div>
      <div>
        {yLabel}: {formatValue(entry.value, unit)}
      </div>
    </div>
  );
}

/**
 * ChartLevel
 *
 * Before reveal: click any point to flag it (shown in accent blue).
 *
 * After reveal, up to five independently toggleable layers can render on
 * the same chart: your own flags (blue = credited, red = false alarm),
 * the true anomaly locations (green rings, filled center if you found
 * them), and one marker row per statistical detector -- letting the
 * player directly compare their own judgement against each model
 * ("Human vs Machine") rather than reading it off a separate table only.
 */
export default function ChartLevel({
  series,
  unit,
  yLabel,
  selectedIndices,
  onToggleIndex,
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

  return (
    <div>
      <div style={{ width: '100%', height: 380 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
            <defs>
              <linearGradient id="ah-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.selected} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.selected} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              interval="preserveStartEnd"
              minTickGap={48}
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
            <Tooltip content={<ChartTooltip unit={unit} yLabel={yLabel} />} />
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

            {/* Unrevealed: plain clickable selection dots */}
            {!revealData && (
              <Scatter
                data={chartData.filter((p) => selectedIndices.has(p.idx))}
                dataKey="value"
                shape={(props) => (
                  <ClickableDot {...props} fill={CHART_COLORS.selected} stroke={CHART_COLORS.selected} r={6} />
                )}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {/* Always-present invisible click targets so every point remains clickable pre-reveal */}
            {!revealData && (
              <Scatter
                data={chartData}
                dataKey="value"
                shape={(props) => <ClickableDot {...props} fill="transparent" stroke="transparent" onClick={onToggleIndex} />}
                legendType="none"
                isAnimationActive={false}
              />
            )}

            {/* Revealed: toggleable Human vs Machine layers */}
            {revealData && layers?.actual && (
              <Scatter
                data={actualPoints}
                dataKey="value"
                shape={(props) => <ActualMarker {...props} found={props.payload.found} />}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {revealData && layers?.yours && (
              <Scatter
                data={yoursPoints}
                dataKey="value"
                shape={(props) => (
                  <ClickableDot
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
          : showRollingAverage
            ? `Dashed line shows the 14-day rolling average. Click any point to flag it — points within ${CREDIT_RADIUS} days of a true anomaly earn partial credit.`
            : `Click any point to flag it. Points within ${CREDIT_RADIUS} days of a true anomaly earn partial credit — you don't need to hit the exact day.`}
      </p>
    </div>
  );
}
