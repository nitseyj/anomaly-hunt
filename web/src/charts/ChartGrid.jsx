/**
 * ChartGrid.jsx
 *
 * Y-axis gridlines + labels, and a sparse X-axis date label row. Ticks
 * come from d3-scale's `.ticks()`, which only picks clean values -- it
 * never touches the scale's own domain, so this can't reintroduce the
 * padding-mismatch bug useChartScales.js exists to avoid.
 */
import styles from './ChartGrid.module.css';

export function ChartGrid({ xScale, yScale, series, width, height, unit, formatValue, tickCount = 5 }) {
  const yTicks = yScale.ticks(tickCount);
  const n = series.length;
  const xTickIndices = [0, Math.floor((n - 1) * 0.25), Math.floor((n - 1) * 0.5), Math.floor((n - 1) * 0.75), n - 1];

  return (
    <g className={styles.grid}>
      {yTicks.map((t) => (
        <g key={t} className={styles.yTick}>
          <line x1={xScale.range()[0]} x2={xScale.range()[1]} y1={yScale(t)} y2={yScale(t)} className={styles.gridLine} />
          <text x={xScale.range()[0] - 8} y={yScale(t)} className={styles.yLabel}>
            {formatValue ? formatValue(t, unit) : t}
          </text>
        </g>
      ))}
      {xTickIndices.map((idx) => (
        <text key={idx} x={xScale(idx)} y={height - 4} className={styles.xLabel} textAnchor="middle">
          {series[idx]?.date?.slice(5) ?? ''}
        </text>
      ))}
    </g>
  );
}
