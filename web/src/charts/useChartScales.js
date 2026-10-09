/**
 * useChartScales.js
 *
 * Builds x/y scales for a series chart from an EXACT domain -- never
 * `.nice()`'d. A niced/padded domain was the root cause of a real
 * marker-misalignment bug: when the axis silently rounds its range to
 * cleaner numbers, anything computed from the raw data min/max (ground-
 * truth markers, detector overlays, the drag-to-throw dart) lands at a
 * different pixel than the line itself, which was drawn against the
 * padded domain. Every consumer in this app must share THIS scale --
 * never invent a second one from the same data.
 */
import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';

export function useChartScales(series, { width, height, padding = 24, yPadFraction = 0.08 }) {
  return useMemo(() => {
    const n = series.length;
    const values = series.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || Math.abs(rawMax) * 0.1 || 1;
    const yPad = span * yPadFraction;

    const innerWidth = Math.max(width - padding * 2, 1);
    const innerHeight = Math.max(height - padding * 2, 1);

    const xScale = scaleLinear().domain([0, n - 1]).range([padding, padding + innerWidth]);
    const yScale = scaleLinear().domain([rawMin - yPad, rawMax + yPad]).range([padding + innerHeight, padding]);

    return { xScale, yScale, innerWidth, innerHeight, padding, domainMin: rawMin - yPad, domainMax: rawMax + yPad };
  }, [series, width, height, padding, yPadFraction]);
}
