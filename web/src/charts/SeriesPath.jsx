import { useId, useRef, useLayoutEffect, useState } from 'react';
import { line as d3Line, area as d3Area, curveMonotoneX } from 'd3-shape';
import { CHART_COLORS } from '../design/chartColors.js';

/** The series line + gradient area fill, via d3-shape path generators --
 * built from the exact same scales (see useChartScales) that every
 * overlay marker reads, so the rendered curve and the math agree by
 * construction instead of needing to be independently verified. */
export function SeriesPath({ series, scales, height, color = CHART_COLORS.line, animate = true }) {
  const uid = useId();
  const gradId = `series-area-${uid}`;
  const pathRef = useRef(null);
  // The line's geometric length varies hugely with how jagged the data is
  // (a zigzag path can be many times its bounding box) -- a fixed
  // strokeDasharray would either cut the animation short or leave most of
  // it statically drawn. Measuring the actual rendered length is the only
  // way to make a "draw the line in" animation correct for arbitrary data.
  const [pathLength, setPathLength] = useState(0);
  useLayoutEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, [series, scales]);

  const lineGen = d3Line()
    .x((_, i) => scales.x(i))
    .y((p) => scales.y(p.value))
    .curve(curveMonotoneX);

  const areaGen = d3Area()
    .x((_, i) => scales.x(i))
    .y0(height)
    .y1((p) => scales.y(p.value))
    .curve(curveMonotoneX);

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.areaTop} stopOpacity={0.22} />
          <stop offset="100%" stopColor={CHART_COLORS.areaTop} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaGen(series)} fill={`url(#${gradId})`} />
      <path
        ref={pathRef}
        d={lineGen(series)}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={
          animate && pathLength > 0
            ? {
                strokeDasharray: pathLength,
                strokeDashoffset: pathLength,
                animation: 'dd-draw-line 900ms var(--ease-out) forwards',
              }
            : undefined
        }
      />
    </g>
  );
}
