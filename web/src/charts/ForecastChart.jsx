import { useRef, useState, useCallback } from 'react';
import { useChartScales } from './useChartScales.js';
import { ChartGrid, AxisY, AxisX } from './ChartGrid.jsx';
import { SeriesPath } from './SeriesPath.jsx';
import { formatValue } from '../engine/metrics.js';
import { CHART_COLORS } from '../design/chartColors.js';
import styles from './AnomalyChart.module.css';

const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };

/** Before reveal: only visible history, with a labeled cutoff. After
 * reveal: the actual future continues as a second, dashed series from
 * the same cutoff point, sharing the exact scale the visible series used
 * (the combined series' own min/max), so the two segments connect with
 * no seam and no second coordinate system to drift out of sync. */
export default function ForecastChart({ visibleSeries, futureSeries, unit, label, revealed }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 380 });

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

  const width = Math.max(0, size.width - MARGIN.left - MARGIN.right);
  const height = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);

  const combined = revealed && futureSeries?.length ? [...visibleSeries, ...futureSeries] : visibleSeries;
  const scales = useChartScales(combined, width, height);
  const cutoffIndex = visibleSeries.length - 1;

  return (
    <div className={styles.container} ref={measure}>
      <svg width={size.width} height={size.height} className={styles.svg}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <ChartGrid width={width} height={height} scales={scales} />
          <AxisY scales={scales} formatValue={(v) => formatValue(v, unit)} width={width} />
          <AxisX series={combined} scales={scales} height={height} />

          <SeriesPath series={visibleSeries} scales={scales} height={height} animate />

          {revealed && futureSeries?.length > 0 && (
            <path
              d={`M ${scales.x(cutoffIndex)} ${scales.y(visibleSeries[cutoffIndex].value)} ${futureSeries
                .map((p, i) => `L ${scales.x(cutoffIndex + 1 + i)} ${scales.y(p.value)}`)
                .join(' ')}`}
              fill="none"
              stroke={CHART_COLORS.creditHigh}
              strokeWidth={1.75}
              strokeDasharray="5 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          <line
            x1={scales.x(cutoffIndex)}
            x2={scales.x(cutoffIndex)}
            y1={0}
            y2={height}
            stroke={CHART_COLORS.axisLine}
            strokeDasharray="4 4"
          />
          <text x={scales.x(cutoffIndex)} y={-2} textAnchor="middle" fontSize={10} fill={CHART_COLORS.axisText}>
            {revealed ? 'Cutoff' : 'Forecast cutoff'}
          </text>
        </g>
      </svg>
    </div>
  );
}
