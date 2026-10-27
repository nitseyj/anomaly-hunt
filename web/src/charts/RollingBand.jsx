/**
 * RollingBand.jsx
 *
 * Renders the rolling z-score detector's own mean +/- std band behind
 * the series line -- the exact baseline the detector judged every point
 * against, using the same xScale/yScale the line and every other
 * overlay already share. Toggled on from AnomalyChart, off by default
 * so it doesn't clutter a first-time player's chart.
 */
import { area as d3area, curveCatmullRom } from 'd3-shape';
import styles from './RollingBand.module.css';

const curve = curveCatmullRom.alpha(0.5);

export function RollingBand({ stats, xScale, yScale }) {
  const areaGen = d3area()
    .x((_, i) => xScale(i))
    .y0((d) => yScale(d.mean - d.std))
    .y1((d) => yScale(d.mean + d.std))
    .curve(curve);

  const path = areaGen(stats);
  if (!path) return null;

  return <path d={path} className={styles.band} />;
}
