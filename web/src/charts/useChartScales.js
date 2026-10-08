import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';

/**
 * Builds the x/y scales a chart and every marker drawn on top of it share.
 * This is the structural fix for the bug class the old Recharts-based
 * chart hit repeatedly: the Y domain here is the data's EXACT [min, max]
 * -- `.domain()` is set directly, `.nice()` is never called, so nothing
 * silently pads the range outward to a round number. Any code computing a
 * pixel position from a value, and any code reading a pixel position back
 * to a value, both go through these same two scale functions -- there is
 * no second, independently-computed coordinate system for an overlay to
 * drift out of sync with.
 *
 * `.ticks(5)` is used separately, purely for axis labels -- it reads
 * clean round numbers WITHIN the exact domain without ever touching the
 * domain itself.
 */
export function useChartScales(series, width, height) {
  return useMemo(() => {
    const n = series.length;
    const values = series.map((p) => p.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yDomain = yMin === yMax ? [yMin - 1, yMax + 1] : [yMin, yMax];

    const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([0, width]);
    const y = scaleLinear().domain(yDomain).range([height, 0]);

    const xToIndex = (px) => {
      const idx = Math.round(x.invert(Math.max(0, Math.min(width, px))));
      return Math.max(0, Math.min(n - 1, idx));
    };
    const yToValue = (py) => y.invert(Math.max(0, Math.min(height, py)));

    const yTicks = yDomain[0] === yDomain[1] ? [yDomain[0]] : y.ticks(5);

    return { x, y, xToIndex, yToValue, yTicks, yDomain };
  }, [series, width, height]);
}
