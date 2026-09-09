import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Line,
  Label,
} from 'recharts';
import { CREDIT_RADIUS } from '../game-logic/scoring.js';
import { formatValue } from '../game-logic/businessMetrics.js';

/**
 * A generously-sized clickable dot. The visible circle is small, but an
 * invisible larger circle underneath captures the click — this is what
 * makes individual points actually easy to hit, instead of relying on
 * cursor-perfect precision on a thin line among 90 crowded points.
 */
function ClickableDot({ cx, cy, payload, state, onClick }) {
  if (cx == null || cy == null) return null;

  let fill = 'transparent';
  let stroke = '#c6c7cf';
  let r = 3;

  if (state === 'selected') {
    fill = '#3454d1';
    stroke = '#3454d1';
    r = 5;
  } else if (state === 'credit-high') {
    fill = '#1e7f4f';
    stroke = '#1e7f4f';
    r = 6;
  } else if (state === 'credit-low') {
    fill = '#6fae8c';
    stroke = '#6fae8c';
    r = 5;
  } else if (state === 'false-alarm') {
    fill = '#b23b3b';
    stroke = '#b23b3b';
    r = 5;
  } else if (state === 'missed') {
    fill = 'none';
    stroke = '#1e7f4f';
    r = 7;
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={state === 'missed' ? 2 : 1.5} />
      {onClick && (
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={() => onClick(payload.idx)}
        />
      )}
    </g>
  );
}

/**
 * A small upward-pointing triangle marking a point where 2+ statistical
 * detectors agreed something was unusual. Drawn slightly above the data
 * point so it doesn't obscure the click target or the credit/false-alarm
 * coloring underneath it.
 */
function DetectorFlagMarker({ cx, cy }) {
  if (cx == null || cy == null) return null;
  const size = 5;
  const top = cy - 14;
  return (
    <polygon
      points={`${cx},${top - size} ${cx - size},${top + size} ${cx + size},${top + size}`}
      fill="#b9762e"
    />
  );
}

/**
 * ChartLevel
 *
 * Renders the level's series with individually large, reliably-clickable
 * points. Before reveal: click toggles a flag (blue). After reveal:
 * points recolor to show scoring — green (full/partial credit, shaded
 * by closeness), red (false alarm), and a hollow green ring for any
 * true anomaly you missed entirely.
 */
export default function ChartLevel({
  series,
  unit,
  yLabel,
  selectedIndices,
  onToggleIndex,
  revealData,
  showRollingAverage,
  detectorFlags,
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

  function pointState(idx) {
    if (!revealData) {
      return selectedIndices.has(idx) ? 'selected' : 'default';
    }
    const hit = revealData.hits.find((h) => h.matchedIndex === idx);
    if (hit) return hit.distance <= CREDIT_RADIUS / 2 ? 'credit-high' : 'credit-low';
    if (selectedIndices.has(idx)) return 'false-alarm';
    if (revealData.missedIndices.has(idx)) return 'missed';
    return 'default';
  }

  return (
    <div>
      <div style={{ width: '100%', height: 380 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
              interval="preserveStartEnd"
              minTickGap={48}
              axisLine={{ stroke: 'var(--border-strong)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-faint)' }}
              tickFormatter={formatY}
              width={64}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value={yLabel}
                angle={-90}
                position="insideLeft"
                style={{ fontSize: 11, fill: 'var(--ink-faint)', textAnchor: 'middle' }}
              />
            </YAxis>
            <Tooltip
              formatter={(value) => [formatValue(value, unit), yLabel]}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', boxShadow: 'none' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#c6c7cf"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
            />
            {showRollingAverage && (
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke="#b9762e"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            <Scatter
              data={chartData}
              dataKey="value"
              shape={(props) => (
                <ClickableDot
                  {...props}
                  state={pointState(props.payload.idx)}
                  onClick={revealData ? null : onToggleIndex}
                />
              )}
              legendType="none"
              isAnimationActive={false}
            />
            {detectorFlags && (
              <Scatter
                data={chartData.filter((p) => detectorFlags[p.idx])}
                dataKey="value"
                shape={(props) => <DetectorFlagMarker {...props} />}
                legendType="none"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="dd-chart-caption">
        {revealData
          ? 'Green = credit earned (darker is closer). Red = false alarm. Hollow ring = a true anomaly you missed. Amber triangle = 2+ statistical detectors flagged that point.'
          : showRollingAverage
            ? `Dashed line shows the 14-day rolling average. Click any point to flag it — points within ${CREDIT_RADIUS} days of a true anomaly earn partial credit.`
            : `Click any point to flag it. Points within ${CREDIT_RADIUS} days of a true anomaly earn partial credit — you don't need to hit the exact day.`}
      </p>
    </div>
  );
}
