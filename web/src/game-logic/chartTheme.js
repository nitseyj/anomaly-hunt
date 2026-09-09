/**
 * chartTheme.js
 *
 * Recharts renders SVG presentation attributes (fill/stroke), which don't
 * reliably resolve CSS custom properties the way styled elements do -- so
 * chart colors are kept here as plain hex constants instead of scattered
 * magic strings inside each chart component. Keep this in sync with the
 * :root tokens in styles.css when the palette changes.
 */

export const CHART_COLORS = {
  grid: '#1C2433',
  axisText: '#8B97AA',
  axisLine: '#253044',
  line: '#3E4A63',

  selected: '#4F7CFF', // accent -- a flagged-but-unrevealed point, or a forecast guess marker
  creditHigh: '#25D695', // success -- full/near-full credit, or the revealed actual value
  creditLow: '#1F8F68', // a muted success for partial credit, distinguishable from full credit
  falseAlarm: '#FF5C6C', // danger
  missed: '#25D695', // success, drawn as a hollow ring for a true anomaly the player missed

  detectorFlag: '#00D4FF', // accent-secondary -- "the machine's" signal, visually distinct from the player's own blue
  hint: '#FFB547', // warning -- the rolling-average hint overlay

  // Individual detector marker colors, for the toggleable Human vs Machine layers
  detectorZScore: '#00D4FF',
  detectorIQR: '#FFB547',
  detectorSeasonal: '#B78CFF',
};

/** Maps detectClient.js's internal detector keys to display labels and marker colors. */
export const DETECTOR_META = {
  rolling_zscore: { label: 'Rolling Z-Score', color: CHART_COLORS.detectorZScore },
  iqr: { label: 'Rolling IQR', color: CHART_COLORS.detectorIQR },
  weekly_seasonal_diff: { label: 'Seasonal Diff', color: CHART_COLORS.detectorSeasonal },
};
