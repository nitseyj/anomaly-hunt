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
  ReferenceLine,
} from 'recharts';
import { formatValue } from '../game-logic/businessMetrics.js';

/**
 * ForecastChart
 *
 * Shows the visible history as a line. Before the player submits a
 * guess, that's all it shows -- the whole point is predicting from the
 * visible trend alone. After submission, both the player's guess and
 * the real value are plotted at the target date so the gap is visible
 * at a glance.
 */
export default function ForecastChart({ visibleSeries, unit, yLabel, targetDate, guessValue, actualValue }) {
  const revealed = actualValue !== null && actualValue !== undefined;
  const formatY = (v) => formatValue(v, unit);

  const chartData = visibleSeries.map((p) => ({ date: p.date, value: p.value }));
  if (revealed) {
    chartData.push({ date: targetDate, actual: actualValue, guess: guessValue });
  }

  return (
    <div style={{ width: '100%', height: 340 }}>
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
            formatter={(value, name) => [formatValue(value, unit), name]}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', boxShadow: 'none' }}
          />
          {revealed && <ReferenceLine x={targetDate} stroke="var(--border-strong)" strokeDasharray="3 3" />}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3454d1"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          {revealed && (
            <>
              <Scatter dataKey="guess" fill="#3454d1" shape="circle" legendType="none" />
              <Scatter dataKey="actual" fill="#1e7f4f" shape="star" legendType="none" />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
