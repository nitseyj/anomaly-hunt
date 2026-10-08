/**
 * chartColors.js
 *
 * SVG presentation attributes (fill/stroke) don't reliably resolve CSS
 * custom properties the way styled elements do, so chart colors are kept
 * here as plain hex constants -- mirror tokens.css's :root values if the
 * palette ever changes.
 */
export const CHART_COLORS = {
  grid: '#1c2433',
  axisText: '#8b93aa',
  axisLine: '#253044',
  line: '#4a5878',
  areaTop: '#4f7cff',

  selected: '#4f7cff',
  creditHigh: '#25d695',
  falseAlarm: '#ff5c6c',

  detectorZScore: '#00d4ff',
  detectorIqr: '#ffb547',
  detectorSeasonal: '#b78cff',
  hint: '#ffb547',
};

export const DETECTOR_META = {
  rolling_zscore: { label: 'Rolling Z-Score', color: CHART_COLORS.detectorZScore },
  rolling_iqr: { label: 'Rolling IQR', color: CHART_COLORS.detectorIqr },
  weekly_seasonal_diff: { label: 'Seasonal Diff', color: CHART_COLORS.detectorSeasonal },
};
