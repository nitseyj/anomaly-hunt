import { CHART_COLORS } from '../design/chartColors.js';

/** Horizontal dashed gridlines at each Y tick, plus the left/bottom axis
 * lines. Ticks come from the SAME scale the series/markers use, so a
 * gridline and the data point that touches it are never a px off. */
export function ChartGrid({ width, height, scales }) {
  return (
    <g>
      {scales.yTicks.map((t) => (
        <line
          key={t}
          x1={0}
          x2={width}
          y1={scales.y(t)}
          y2={scales.y(t)}
          stroke={CHART_COLORS.grid}
          strokeDasharray="3 3"
        />
      ))}
    </g>
  );
}

export function AxisY({ scales, formatValue, width }) {
  return (
    <g>
      {scales.yTicks.map((t) => (
        <text
          key={t}
          x={-10}
          y={scales.y(t)}
          dy="0.32em"
          textAnchor="end"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fill={CHART_COLORS.axisText}
        >
          {formatValue(t)}
        </text>
      ))}
    </g>
  );
}

export function AxisX({ series, scales, height }) {
  const n = series.length;
  const interval = Math.max(1, Math.ceil(n / 6));
  return (
    <g>
      <line x1={0} x2={scales.x(n - 1)} y1={height} y2={height} stroke={CHART_COLORS.axisLine} />
      {series.map((p, i) =>
        i % interval === 0 ? (
          <text key={i} x={scales.x(i)} y={height + 18} textAnchor="middle" fontSize={11} fill={CHART_COLORS.axisText}>
            {p.date}
          </text>
        ) : null
      )}
    </g>
  );
}
