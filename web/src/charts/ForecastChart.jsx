/**
 * ForecastChart.jsx
 *
 * Shows the visible lead-in of a series with its ending hidden -- not
 * behind a flat fog panel or a fan-chart gradient, but an actual fog
 * bank (ChartShadow.jsx: layered blurred cloud puffs spanning the full
 * hidden region) with a friendly ghost centered inside it. Fog and
 * ghost are one rigid group that slides in from the chart's right edge
 * on mount and slides back out the same way once the player locks in
 * an answer, masked by a static clip so it reads as rolling in/out
 * rather than a box sliding across the chart -- see ChartShadow.jsx.
 * The ghost's size still scales with the visible portion's own
 * volatility (a choppier trend gets a bigger ghost), capped so it
 * always fits inside the hidden region regardless. This never leaks
 * the real answer -- the actual hidden path still isn't rendered into
 * the DOM until `revealed`, exactly as before.
 *
 * On reveal, a scanline sweeps across and the hidden tail draws in --
 * sharing the exact same x/y scale as the visible portion, computed
 * from the FULL series up front, so the reveal never re-scales (and
 * thus never re-positions) the line that was already on screen.
 */
import { motion, AnimatePresence } from 'motion/react';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { useChartScales } from './useChartScales.js';
import { ChartGrid } from './ChartGrid.jsx';
import { ChartShadow } from './ChartShadow.jsx';
import { CornerBrackets } from '../components/CornerBrackets.jsx';
import { formatValue } from '../engine/metrics.js';
import styles from './ForecastChart.module.css';

const WIDTH = 820;
const HEIGHT = 320;
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

  // The shadow's size tracks the visible portion's own volatility (the
  // same day-to-day delta spread the old cone used), normalized against
  // the series' own scale so it works the same way for a $10k revenue
  // series or a 2% defect-rate series: a choppier lead-in gets a bigger,
  // more imposing shadow over the hidden region.
  const visibleValues = visible.map((p) => p.value);
  const visibleDeltas = visibleValues.slice(1).map((v, i) => v - visibleValues[i]);
  const deltaSpread = visibleDeltas.length
    ? Math.sqrt(visibleDeltas.reduce((sum, d) => sum + d * d, 0) / visibleDeltas.length)
    : Math.abs(visibleValues[visibleValues.length - 1]) * 0.05;
  const lastVisible = visibleValues[visibleValues.length - 1];
  const relativeVolatility = deltaSpread / (Math.abs(lastVisible) || 1);
  const shadowScale = Math.max(0.85, Math.min(1.35, 0.9 + relativeVolatility * 6));

  return (
    <div className={styles.wrap}>
      <CornerBrackets />

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg}>
        <ChartGrid xScale={xScale} yScale={yScale} series={fullSeries} width={WIDTH} height={HEIGHT} unit={unit} formatValue={formatValue} />

        <path d={revealed ? fullPath : visiblePath} fill="none" className={styles.line} />

        <AnimatePresence>
          {!revealed && (
            <ChartShadow
              key="shadow"
              regionLeft={cutoffX}
              regionRight={WIDTH - padding}
              plotTop={padding}
              plotBottom={HEIGHT - padding}
              scale={shadowScale}
            />
          )}
        </AnimatePresence>

        <line x1={cutoffX} x2={cutoffX} y1={padding} y2={HEIGHT - padding} className={styles.cutoffLine} />
        <text x={cutoffX} y={padding - 8} className={styles.cutoffLabel} textAnchor="middle">
          NOW
        </text>

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
