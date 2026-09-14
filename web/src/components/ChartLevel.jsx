import { useState, useRef, useId } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Label,
} from 'recharts';
import { CREDIT_RADIUS } from '../game-logic/scoring.js';
import { formatValue } from '../game-logic/businessMetrics.js';
import { CHART_COLORS, DETECTOR_META } from '../game-logic/chartTheme.js';

// These MUST match the ComposedChart's own margin/axis-width props below --
// not guessed from Recharts' rendering, the exact same numbers, so the
// overlay's pixel math and the chart's own plotted area agree exactly.
const CHART_MARGIN = { top: 8, right: 12, bottom: 8, left: 4 };
const Y_AXIS_WIDTH = 64;
const X_AXIS_HEIGHT = 24;

/**
 * Standard "nice number" tick-step algorithm (the same one d3-scale/
 * Recharts use internally) -- picks a round step size (1/2/5 x a power of
 * ten) that divides [min, max] into roughly `count` intervals.
 */
function niceTickStep(min, max, count) {
  const span = Math.abs(max - min);
  if (span === 0) return 1;
  const rawStep = span / Math.max(count, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let stepMultiple;
  if (residual >= Math.sqrt(50)) stepMultiple = 10;
  else if (residual >= Math.sqrt(10)) stepMultiple = 5;
  else if (residual >= Math.sqrt(2)) stepMultiple = 2;
  else stepMultiple = 1;
  return stepMultiple * magnitude;
}

/**
 * Clean, evenly-spaced tick VALUES within [min, max] -- deliberately never
 * expands past min/max the way Recharts' own auto-domain does, since the
 * YAxis domain below is locked to the exact (unpadded) data range and we
 * only want nice labels inside it, not a nicer-but-different range.
 */
function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const step = niceTickStep(min, max, count);
  const start = Math.ceil(min / step) * step;
  const end = Math.floor(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step * 1e-9; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks.length > 0 ? ticks : [min, max];
}

/**
 * A naturalistic steel-tip dart -- a dark tapered shaft/barrel with a
 * glossy yellow flight tilted off the back -- rendered at a slight throwing
 * angle rather than dead vertical. The tip (bottom-center of the viewBox)
 * is always the exact landing point regardless of the tilt, so the CSS
 * anchor (translate(-50%, -100%)) still lines up with the actual click.
 */
function DartIcon({ dim = false }) {
  const uid = useId();
  const shaftGradId = `dart-shaft-${uid}`;
  const flightGradId = `dart-flight-${uid}`;
  return (
    <svg width="20" height="28" viewBox="0 0 20 28" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* A bright chrome shaft, not a dark one -- against this app's
            near-black chart background a dark-metal dart nearly vanished.
            Every shape below also gets a thin dark outline so the dart
            still reads crisply over the lighter area-fill gradient. */}
        <linearGradient id={shaftGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F2F5FA" />
          <stop offset="45%" stopColor="#C7CFDC" />
          <stop offset="100%" stopColor="#8A93A6" />
        </linearGradient>
        <linearGradient id={flightGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE477" />
          <stop offset="55%" stopColor="#FFC72C" />
          <stop offset="100%" stopColor="#E6A400" />
        </linearGradient>
      </defs>
      {/* flight -- glossy yellow, tilted off the back of the shaft, with a
          highlight sheen and a fold-line crease */}
      <g opacity={dim ? 0.65 : 1}>
        <path d="M12.5 11 L19 2.5 L18.5 9.5 L13.5 13.5 Z" fill={`url(#${flightGradId})`} stroke="#2A1E00" strokeWidth="0.4" strokeOpacity="0.35" />
        <path d="M12.5 11 L19 2.5 L15.8 8.5 Z" fill="#fff" opacity="0.25" />
        <line x1="12.8" y1="10.5" x2="18.3" y2="4" stroke="#B37F00" strokeWidth="0.35" opacity="0.7" />
      </g>
      {/* shaft + tip (bright chrome, outlined for contrast against the
          background); the point at (10, 28) is the exact spot that lands
          under the cursor */}
      <path
        d="M10 28 L8.9 12.5 L13.6 10.2 L10.9 27.3 Z"
        fill={`url(#${shaftGradId})`}
        stroke="#1A1F2E"
        strokeWidth="0.4"
        strokeOpacity="0.5"
      />
      <path d="M9.6 20 L9 12.8 L10.2 12.3 L10.4 19.6 Z" fill="#fff" opacity="0.45" />
    </svg>
  );
}

/** A small hand-drawn arc showing the dart's throw arc, briefly visible right as a throw lands. */
function ThrowTrail() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'absolute', inset: -29, overflow: 'visible', pointerEvents: 'none' }}>
      <path
        d="M8 60 Q 30 6, 62 24"
        fill="none"
        stroke={CHART_COLORS.selected}
        strokeWidth="1.5"
        strokeDasharray="3 5"
        strokeLinecap="round"
        opacity="0.6"
        className="dd-throw-trail-path"
      />
    </svg>
  );
}

/** A brief expanding ring "impact" flash right where the dart sticks. */
function ImpactFlash() {
  return <span className="dd-impact-flash" aria-hidden="true" />;
}

/** A soft ground shadow beneath a landing dart -- grows and sharpens as the dart "descends," giving the throw a sense of real height/depth instead of a flat pop-in. */
function DartShadow() {
  return <span className="dd-dart-shadow" aria-hidden="true" />;
}

/**
 * A naturalistic hand pinching the dart between thumb and index finger --
 * shown while the slider is being dragged (gripping in place, no extra
 * class) or briefly right after a throw lands (pass `throwing` to fade it
 * out, as if it just let go), positioned on the dart itself rather than on
 * the slider/cursor, since that's where the dart actually is. Offset/sized
 * so the pinch point lands on the dart's shaft and the steel tip still
 * pokes out past the grip.
 */
function HandOnDart({ throwing = false }) {
  const uid = useId();
  const fistGradId = `hand-fist-${uid}`;
  return (
    <svg
      width="26"
      height="32"
      viewBox="0 0 26 32"
      className={`dd-hand-on-dart ${throwing ? 'dd-hand-on-dart--throwing' : ''}`}
      style={{ position: 'absolute', left: -6.8, top: -6.5, overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={fistGradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F2C09A" />
          <stop offset="100%" stopColor="#CE946A" />
        </radialGradient>
      </defs>
      {/* wrist + fist mass (back of hand, curled fingers hidden behind) */}
      <rect x="4" y="22" width="9" height="10" fill="#CE946A" />
      <ellipse cx="10" cy="21" rx="7.6" ry="8.6" fill={`url(#${fistGradId})`} />
      {/* curled knuckle bumps -- middle/ring/pinky, tucked behind the pinch */}
      <ellipse cx="6.5" cy="13.5" rx="2.5" ry="3" fill="#DFA378" />
      <ellipse cx="10" cy="12.3" rx="2.6" ry="3.2" fill="#E7AD84" />
      <ellipse cx="13.5" cy="13.3" rx="2.3" ry="2.9" fill="#DFA378" />
      {/* index finger, curling down from the top of the hand to the pinch */}
      <rect x="10" y="8.7" width="11" height="4.4" rx="2.2" fill="#E7AD84" transform="rotate(48 10 10.9)" />
      <rect x="10.3" y="9.1" width="9" height="1.6" rx="0.8" fill="#F4C79E" opacity="0.5" transform="rotate(48 10 10.9)" />
      {/* thumb, curling up from the fist to meet the index fingertip */}
      <rect x="7" y="19.4" width="11.5" height="4.8" rx="2.4" fill="#E7AD84" transform="rotate(-38 7 21.8)" />
      <rect x="7.3" y="19.8" width="9.5" height="1.7" rx="0.85" fill="#F4C79E" opacity="0.5" transform="rotate(-38 7 21.8)" />
    </svg>
  );
}

/** A small triangle marking a point one specific statistical detector flagged. */
function DetectorMarker({ color, rowOffset }) {
  const size = 4.5;
  const top = -14 - rowOffset * 11;
  return (
    <svg width="12" height="12" style={{ position: 'absolute', left: -6, top, overflow: 'visible' }} aria-hidden="true">
      <polygon points={`6,${-size} ${6 - size},${size} ${6 + size},${size}`} fill={color} />
    </svg>
  );
}

/**
 * ChartLevel
 *
 * Every marker on this chart -- flagged days, the dart itself, the
 * revealed answer, detector flags -- is positioned via a single plain
 * DOM overlay using percentage coordinates, NOT via Recharts' own
 * data-bound rendering. That's a deliberate architectural choice: it
 * means marker placement is fully within our control (simple, verifiable
 * math) rather than depending on Recharts' internal coordinate system.
 * The YAxis domain is locked to this overlay's own exact [yMin, yMax]
 * (see niceTicks below for why 'auto' doesn't work), so the line Recharts
 * draws and the markers this overlay draws always agree on where a value
 * maps to a pixel. Recharts still only draws the line/area/axes -- it
 * just now uses OUR numbers to do it, instead of picking its own.
 */
export default function ChartLevel({
  series,
  unit,
  yLabel,
  selectedIndices,
  onDartThrow,
  focusedIndex,
  yGuesses,
  sliderDragging,
  revealData,
  showRollingAverage,
  detectorFlagsByType,
  layers,
}) {
  const chartData = series.map((point, idx) => ({ idx, date: point.date, value: point.value }));
  const overlayRef = useRef(null);
  const [justThrew, setJustThrew] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(null);
  // The exact free-aim spot of the most recent throw, kept separate from
  // focusedIndex -- this is what lets the dart land exactly where you
  // clicked instead of snapping onto the curve. It naturally stops
  // applying once focus moves elsewhere (slider/table/prev-next), at
  // which point the dart falls back to sitting precisely on the curve.
  const [lastThrow, setLastThrow] = useState(null);

  if (showRollingAverage) {
    const window = 14;
    for (let i = 0; i < chartData.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(chartData.length, i + Math.floor(window / 2) + 1);
      const slice = chartData.slice(start, end);
      chartData[i].rollingAvg = slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
    }
  }

  const formatY = (v) => formatValue(v, unit);

  // Also fed into the YAxis' own `domain` below (not left at 'auto') --
  // measured directly against the rendered SVG line path, domain="auto"
  // does NOT mean exactly [dataMin, dataMax] the way it looks like it
  // should: Recharts "nices" it outward to round numbers (e.g. an exact
  // [2.8, 7.31] rendered as [2, 10]), which silently threw every overlay
  // marker off the curve by an amount that grew the further a point's
  // value sat from the middle of the range. Locking the domain to these
  // exact numbers keeps the rendered line and this overlay in agreement
  // by construction; the earlier "garbled tick labels" bug from doing
  // that (see niceTicks below) came from also leaving Recharts to
  // auto-generate ticks over that non-round domain, not from the
  // explicit domain itself.
  const values = chartData.map((p) => p.value);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yRange = yMax - yMin || 1;
  const yTicks = niceTicks(yMin, yMax);

  const xFractionOf = (idx) => idx / Math.max(1, chartData.length - 1);
  const yFractionOf = (value) => (value - yMin) / yRange;

  function positionFromEvent(e) {
    const rect = overlayRef.current.getBoundingClientRect();
    const xFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yFraction = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    return { xFraction, yFraction };
  }

  /**
   * Captures a raw click anywhere over the plot area and converts it into
   * a (day index, guessed value) pair -- a genuine free-aim throw, not a
   * snap to the nearest point on the line.
   */
  function handleOverlayClick(e) {
    if (revealData || !onDartThrow) return;
    const { xFraction, yFraction } = positionFromEvent(e);
    const idx = Math.round(xFraction * (chartData.length - 1));
    const guessedValue = yMin + yFraction * yRange;

    setLastThrow({ idx, xFraction, yFraction });
    onDartThrow(idx, guessedValue);
    setJustThrew(true);
    setTimeout(() => setJustThrew(false), 540);
  }

  function handleOverlayMouseMove(e) {
    if (revealData) return;
    setHoverPosition(positionFromEvent(e));
  }

  // Where the dart marker sits: exactly where you last threw it, if focus
  // is still on that same day -- otherwise "perfect aim," right on the
  // curve (matching how the slider/table always aim exactly at the real
  // value). Moving the slider therefore looks like the dart sliding
  // smoothly to a new precise spot rather than a fresh throw.
  let dartPosition = null;
  if (!revealData && focusedIndex != null) {
    if (lastThrow && lastThrow.idx === focusedIndex) {
      dartPosition = lastThrow;
    } else {
      dartPosition = { xFraction: xFractionOf(focusedIndex), yFraction: yFractionOf(chartData[focusedIndex].value) };
    }
  }

  // Where a flagged point's Y position should render: the value you
  // actually aimed at (from a real dart throw), never the true curve
  // value -- otherwise a flag would visually "snap" onto the line
  // regardless of how far off your throw really was, which is exactly
  // the bug being fixed here. Falls back to the curve value only for
  // flags placed via the slider/table, which have no guess because they
  // always aim perfectly by construction.
  function displayValueFor(idx) {
    const guess = yGuesses?.[idx];
    return guess != null ? guess : chartData[idx].value;
  }

  const flaggedPoints = !revealData
    ? [...selectedIndices].map((idx) => ({ ...chartData[idx], displayValue: displayValueFor(idx) }))
    : [];
  const yoursPoints = revealData
    ? [...selectedIndices].map((idx) => {
        const credited = revealData.hits.some((h) => h.matchedIndex === idx);
        return { ...chartData[idx], displayValue: displayValueFor(idx), credited };
      })
    : [];
  const activeDetectorKeys = detectorFlagsByType
    ? Object.keys(detectorFlagsByType).filter((key) => layers?.[key])
    : [];

  const tickInterval = Math.max(0, Math.ceil(chartData.length / 6) - 1);

  return (
    <div>
      <div className="dd-chart-container" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={chartData} margin={CHART_MARGIN} style={{ cursor: revealData ? 'default' : 'none' }}>
            <defs>
              <linearGradient id="ah-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.selected} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.selected} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              type="category"
              dataKey="date"
              height={X_AXIS_HEIGHT}
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              interval={tickInterval}
              axisLine={{ stroke: CHART_COLORS.axisLine }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
              tickFormatter={formatY}
              domain={[yMin, yMax]}
              ticks={yTicks}
              width={Y_AXIS_WIDTH}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value={yLabel}
                angle={-90}
                position="insideLeft"
                style={{ fontSize: 11, fill: CHART_COLORS.axisText, textAnchor: 'middle' }}
              />
            </YAxis>
            <Area type="monotone" dataKey="value" stroke="none" fill="url(#ah-area-gradient)" isAnimationActive animationDuration={600} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.line}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive
              animationDuration={600}
              activeDot={false}
            />
            {showRollingAverage && (
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke={CHART_COLORS.hint}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Every marker lives here, positioned by plain percentage math --
            never by Recharts, so the chart's own size/margins can never
            shift because of how many markers are on screen. */}
        <div
          ref={overlayRef}
          className="dd-dart-overlay"
          onClick={handleOverlayClick}
          onMouseMove={handleOverlayMouseMove}
          onMouseLeave={() => setHoverPosition(null)}
          style={{
            position: 'absolute',
            top: CHART_MARGIN.top,
            left: CHART_MARGIN.left + Y_AXIS_WIDTH,
            right: CHART_MARGIN.right,
            bottom: CHART_MARGIN.bottom + X_AXIS_HEIGHT,
            cursor: revealData ? 'default' : 'none',
          }}
        >
          {!revealData &&
            flaggedPoints.map((p) => (
              <div
                key={p.idx}
                className="dd-marker-dot"
                style={{
                  left: `${xFractionOf(p.idx) * 100}%`,
                  top: `${(1 - yFractionOf(p.displayValue)) * 100}%`,
                  background: CHART_COLORS.selected,
                  borderColor: CHART_COLORS.selected,
                }}
              />
            ))}

          {!revealData && hoverPosition && (
            <div
              className="dd-dart dd-dart--preview"
              style={{ left: `${hoverPosition.xFraction * 100}%`, top: `${(1 - hoverPosition.yFraction) * 100}%` }}
              aria-hidden="true"
            >
              <DartIcon dim />
            </div>
          )}
          {!revealData && dartPosition && (
            <div
              className={`dd-dart ${justThrew ? 'dd-dart--thrown' : ''} ${sliderDragging ? 'dd-dart--dragging' : ''}`}
              style={{ left: `${dartPosition.xFraction * 100}%`, top: `${(1 - dartPosition.yFraction) * 100}%` }}
              aria-hidden="true"
            >
              {justThrew && <ThrowTrail />}
              {justThrew && <DartShadow />}
              {justThrew && <ImpactFlash />}
              {justThrew && <HandOnDart throwing />}
              {sliderDragging && <HandOnDart />}
              <DartIcon />
            </div>
          )}

          {/* Revealed answer: a soft pulsing target zone instead of a tiny
              ring, so it reads as "this whole area counts, center is
              best" at a glance rather than a single easy-to-miss dot. */}
          {revealData &&
            layers?.actual &&
            revealData.hits.map((h) => (
              <div
                key={`answer-${h.anomalyIndex}`}
                className="dd-pulse-target"
                style={{
                  left: `${xFractionOf(h.anomalyIndex) * 100}%`,
                  top: `${(1 - yFractionOf(chartData[h.anomalyIndex].value)) * 100}%`,
                }}
              >
                <span className="dd-pulse-ring" />
                <span className="dd-pulse-core" />
              </div>
            ))}

          {revealData &&
            layers?.yours &&
            yoursPoints.map((p) => (
              <div
                key={`yours-${p.idx}`}
                className="dd-marker-dot"
                style={{
                  left: `${xFractionOf(p.idx) * 100}%`,
                  top: `${(1 - yFractionOf(p.displayValue)) * 100}%`,
                  background: p.credited ? CHART_COLORS.selected : CHART_COLORS.falseAlarm,
                  borderColor: p.credited ? CHART_COLORS.selected : CHART_COLORS.falseAlarm,
                }}
              />
            ))}

          {revealData &&
            detectorFlagsByType &&
            activeDetectorKeys.map((key) =>
              chartData
                .filter((p) => detectorFlagsByType[key][p.idx])
                .map((p) => (
                  <div
                    key={`${key}-${p.idx}`}
                    style={{
                      position: 'absolute',
                      left: `${xFractionOf(p.idx) * 100}%`,
                      top: `${(1 - yFractionOf(p.value)) * 100}%`,
                    }}
                  >
                    <DetectorMarker
                      color={DETECTOR_META[key]?.color ?? CHART_COLORS.detectorFlag}
                      rowOffset={activeDetectorKeys.indexOf(key)}
                    />
                  </div>
                ))
            )}
        </div>
      </div>
      <p className="dd-chart-caption">
        {revealData
          ? 'Toggle layers above to compare your flags against the true anomalies and each statistical detector.'
          : `Throw a dart anywhere on the chart to flag that spot — you don't have to hit the line exactly. The closer to the true day AND value, the more credit you earn. Drag the slider below for a precise, guided throw instead.`}
      </p>
    </div>
  );
}
