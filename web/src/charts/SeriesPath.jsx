/**
 * SeriesPath.jsx
 *
 * The line + area fill for a series, via d3-shape. The draw-in animation
 * measures the path's ACTUAL rendered length with getTotalLength() rather
 * than guessing a strokeDasharray constant -- a fixed guess under- or
 * overshoots depending on how jagged a given 90-point series turns out
 * to be, so animation speed would visibly vary case to case.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { line as d3line, area as d3area, curveCatmullRom } from 'd3-shape';
import { motion } from 'motion/react';
import styles from './SeriesPath.module.css';

// Centripetal Catmull-Rom (alpha 0.5) instead of curveMonotoneX: it still
// passes through every actual data point (so markers placed at the same
// (xScale(i), yScale(value)) stay exactly on the curve -- nothing about
// marker alignment depends on which interpolation is used between
// points), but reads as a noticeably calmer, more organic line through
// closely-packed noisy points than monotone's sharper per-segment joints.
const curve = curveCatmullRom.alpha(0.5);

export function SeriesPath({ series, xScale, yScale, animate = true, color }) {
  const pathRef = useRef(null);
  const [length, setLength] = useState(0);

  const lineGen = d3line()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.value))
    .curve(curve);

  const areaGen = d3area()
    .x((_, i) => xScale(i))
    .y0(yScale.range()[0])
    .y1((d) => yScale(d.value))
    .curve(curve);

  const linePath = lineGen(series);
  const areaPath = areaGen(series);

  useLayoutEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, [linePath]);

  return (
    <g className={styles.group}>
      <path d={areaPath} className={styles.area} />
      <path
        ref={pathRef}
        d={linePath}
        fill="none"
        stroke={color || 'var(--series-line)'}
        className={styles.line}
        style={animate ? { opacity: 0 } : undefined}
      />
      {animate && length > 0 && (
        <motion.path
          d={linePath}
          fill="none"
          stroke={color || 'var(--series-line)'}
          className={styles.lineReveal}
          initial={{ strokeDasharray: length, strokeDashoffset: length }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </g>
  );
}
