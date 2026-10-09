/**
 * ForecastChart.jsx
 *
 * Shows the visible lead-in of a series with its ending hidden behind a
 * frosted cutoff panel. On reveal, a scanline sweeps across and the
 * hidden tail draws in -- sharing the exact same x/y scale as the
 * visible portion, computed from the FULL series up front, so the
 * reveal never re-scales (and thus never re-positions) the line that
 * was already on screen.
 */
import { motion, AnimatePresence } from 'motion/react';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { useChartScales } from './useChartScales.js';
import { ChartGrid } from './ChartGrid.jsx';
import { formatValue } from '../engine/metrics.js';
import styles from './ForecastChart.module.css';

const WIDTH = 820;
const HEIGHT = 340;
const curve = curveCatmullRom.alpha(0.5);

export function ForecastChart({ visible, hidden, unit, revealed = false }) {
  const fullSeries = [...visible, ...hidden];
  const { xScale, yScale, padding } = useChartScales(fullSeries, { width: WIDTH, height: HEIGHT, padding: 64 });

  const cutIndex = visible.length - 1;

  const lineGen = d3line()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.value))
    .curve(curve);

  const visiblePath = lineGen(visible);
  const fullPath = lineGen(fullSeries);
  const cutoffX = xScale(cutIndex);

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg}>
        <ChartGrid xScale={xScale} yScale={yScale} series={fullSeries} width={WIDTH} height={HEIGHT} unit={unit} formatValue={formatValue} />

        <path d={revealed ? fullPath : visiblePath} fill="none" className={styles.line} />

        <line x1={cutoffX} x2={cutoffX} y1={padding} y2={HEIGHT - padding} className={styles.cutoffLine} />
        <text x={cutoffX} y={padding - 8} className={styles.cutoffLabel} textAnchor="middle">
          NOW
        </text>

        {!revealed && (
          <rect x={cutoffX} y={padding} width={WIDTH - padding - cutoffX} height={HEIGHT - padding * 2} className={styles.fogPanel} />
        )}

        <AnimatePresence>
          {revealed && (
            <motion.rect
              key="sweep"
              y={padding}
              width="4"
              height={HEIGHT - padding * 2}
              className={styles.sweep}
              initial={{ x: cutoffX, opacity: 1 }}
              animate={{ x: WIDTH - padding, opacity: [1, 1, 0] }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {revealed && (
          <motion.circle
            r="5"
            className={styles.finalDot}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.3 }}
            cx={xScale(fullSeries.length - 1)}
            cy={yScale(fullSeries[fullSeries.length - 1].value)}
          />
        )}
      </svg>
    </div>
  );
}
