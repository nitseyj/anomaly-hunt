import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Label,
  ReferenceLine,
} from 'recharts';
import { formatValue } from '../game-logic/businessMetrics.js';
import { CHART_COLORS } from '../game-logic/chartTheme.js';

/**
 * Same reasoning as ChartLevel.jsx's ChartTooltip: Area+Line pairs on the
 * same dataKey would otherwise duplicate rows in the default Tooltip.
 * Picks the single valid numeric entry and labels it Historical/Actual.
 */
function ForecastTooltip({ active, payload, label, unit }) {
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
        {entry.dataKey === 'future' ? 'Actual' : 'Historical'}: {formatValue(entry.value, unit)}
      </div>
    </div>
  );
}

/**
 * ForecastChart
 *
 * Before reveal: shows only the visible history, with a clearly labeled
 * cutoff marker at the last known day -- the future is genuinely hidden,
 * not just visually de-emphasized.
 *
 * After reveal: the actual future continues as a second, distinctly
 * colored segment from the same cutoff point, so the real outcome reads
 * as a direct continuation of the chart the player reasoned from.
 */
export default function ForecastChart({ visibleSeries, futureSeries, unit, yLabel, targetDate, revealed }) {
  const formatY = (v) => formatValue(v, unit);
  const cutoffDate = visibleSeries[visibleSeries.length - 1]?.date;

  const chartData = visibleSeries.map((p) => ({ date: p.date, historical: p.value }));

  if (revealed && futureSeries?.length) {
    // Duplicate the cutoff point onto the "future" series so the two
    // segments visually connect with no gap between them.
    chartData[chartData.length - 1] = {
      ...chartData[chartData.length - 1],
      future: chartData[chartData.length - 1].historical,
    };
    for (const p of futureSeries) {
      chartData.push({ date: p.date, future: p.value });
    }
  }

  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <defs>
            <linearGradient id="fc-hist-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.selected} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS.selected} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fc-future-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.creditHigh} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS.creditHigh} stopOpacity={0} />
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
          <Tooltip content={<ForecastTooltip unit={unit} />} />
          <ReferenceLine x={cutoffDate} stroke={CHART_COLORS.axisLine} strokeDasharray="4 4">
            <Label
              value={revealed ? 'Cutoff' : 'Forecast cutoff'}
              position="top"
              style={{ fontSize: 10, fill: CHART_COLORS.axisText }}
            />
          </ReferenceLine>
          <Area
            type="monotone"
            dataKey="historical"
            stroke="none"
            fill="url(#fc-hist-gradient)"
            isAnimationActive
            animationDuration={600}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="historical"
            stroke={CHART_COLORS.line}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive
            animationDuration={600}
            connectNulls
          />
          {revealed && (
            <>
              <Area
                type="monotone"
                dataKey="future"
                stroke="none"
                fill="url(#fc-future-gradient)"
                isAnimationActive
                animationDuration={500}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="future"
                stroke={CHART_COLORS.creditHigh}
                strokeWidth={1.75}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive
                animationDuration={500}
                connectNulls
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
