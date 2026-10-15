/**
 * ChartShadow.jsx
 *
 * A fog-bank illustration (layered, blurred cloud puffs spanning the full
 * hidden region) with a friendly ghost centered inside it. Both live in
 * ONE group that slides horizontally as a single rigid body -- in from
 * the right on mount, back out the same way in reverse once the player
 * locks in an answer -- so the fog and the ghost can never drift out of
 * sync with each other. A separate, STATIC clip rect (the hidden region's
 * bounds, but widened on the left) is what makes the slide read as
 * "rolling in/out" of the chart rather than sliding a visible hard-edged
 * box across it: the clip never moves, only the content behind it does.
 *
 * All four sides of that clip are widened past the hidden region's own
 * bounds on purpose, with a dedicated ring of edge puffs (varying radii)
 * hugging each one. A puff's blur always reaches past its own edge; if
 * the clip stopped exactly at the region's bounds, every side would get
 * sliced in a razor-straight line regardless -- the fog would still read
 * as a hard rectangle, just a "softer" one. Giving every edge room to
 * bleed, with each puff a different size, is what breaks the rectangle
 * silhouette -- closer to how a real fog bank (or a Plants-vs-Zombies
 * water lane) actually meets dry ground, unevenly, on every side.
 *
 * The ghost is centered on the hidden region's own box, not tied to the
 * last visible value's y-position, and its render size is capped to
 * always fit inside that box regardless of the volatility-driven `scale`
 * -- this is what stops a choppy round's bigger ghost from clipping its
 * head against the plot's top edge.
 */
import { motion } from 'motion/react';
import styles from './ChartShadow.module.css';

const W = 136;
const H = 162;
const SCALLOP_Y = 42;

// A classic ghost silhouette as one closed path: a rounded dome top (one
// big arc) and a 4-bump scalloped bottom edge, drawn from local
// coordinates where (0, 0) is the "shoulder" line, just above the eyes.
const BODY_PATH = (() => {
  const halfW = W / 2;
  const seg = W / 4;
  const bumpDip = SCALLOP_Y + 15;
  return [
    `M ${-halfW} 0`,
    `A ${halfW} ${H - SCALLOP_Y} 0 0 1 ${halfW} 0`,
    `L ${halfW} ${SCALLOP_Y}`,
    `Q ${halfW - seg / 2} ${bumpDip} ${halfW - seg} ${SCALLOP_Y}`,
    `Q ${halfW - 1.5 * seg} ${bumpDip} ${halfW - 2 * seg} ${SCALLOP_Y}`,
    `Q ${halfW - 2.5 * seg} ${bumpDip} ${halfW - 3 * seg} ${SCALLOP_Y}`,
    `Q ${halfW - 3.5 * seg} ${bumpDip} ${-halfW} ${SCALLOP_Y}`,
    'Z',
  ].join(' ');
})();

// The dome's top and the deepest scallop's bottom, in the same local
// frame as BODY_PATH -- used to find the shape's true vertical center,
// which sits well below the shoulder-line origin since the dome is
// taller than the scalloped skirt below it.
const GEO_TOP = -(H - SCALLOP_Y);
const GEO_BOTTOM = SCALLOP_Y + 15;
const GEO_CENTER_OFFSET = (GEO_TOP + GEO_BOTTOM) / 2;

// Fractional positions (0-1 across the hidden region's width/height) so
// the same fog-bank layout scales to any region size. Fixed pixel radii
// keep individual puffs looking like actual clouds rather than shapes
// that balloon or shrink oddly on a narrow vs. wide hidden region.
const FOG_PUFFS = [
  { fx: 0.04, fy: 0.72, r: 44, opacity: 0.26 },
  { fx: 0.16, fy: 0.22, r: 52, opacity: 0.18 },
  { fx: 0.28, fy: 0.88, r: 40, opacity: 0.24 },
  { fx: 0.42, fy: 0.1, r: 48, opacity: 0.16 },
  { fx: 0.52, fy: 0.5, r: 58, opacity: 0.2 },
  { fx: 0.66, fy: 0.18, r: 50, opacity: 0.17 },
  { fx: 0.78, fy: 0.8, r: 46, opacity: 0.23 },
  { fx: 0.9, fy: 0.32, r: 52, opacity: 0.19 },
  { fx: 0.1, fy: 0.97, r: 38, opacity: 0.28 },
  { fx: 0.4, fy: 0.97, r: 42, opacity: 0.26 },
  { fx: 0.7, fy: 0.97, r: 42, opacity: 0.26 },
  { fx: 0.95, fy: 0.97, r: 38, opacity: 0.28 },
];

// A dedicated row of puffs centered right on the "NOW" boundary (fx: 0),
// each a different size. Since roughly half of each one bleeds past the
// edge, a bigger radius here means a deeper bulge onto the revealed
// chart at that height and a smaller one means barely any -- the size
// variation itself is what reads as an uneven, scalloped shoreline
// instead of a uniform haze the same depth all the way down.
const LEFT_EDGE_PUFFS = [
  { f: 0.04, r: 46, opacity: 0.24 },
  { f: 0.22, r: 34, opacity: 0.2 },
  { f: 0.38, r: 52, opacity: 0.25 },
  { f: 0.56, r: 30, opacity: 0.19 },
  { f: 0.72, r: 48, opacity: 0.24 },
  { f: 0.88, r: 36, opacity: 0.21 },
];

// Same idea, hugging the top and bottom boundaries instead -- spaced
// across the region's width (f is a fraction of availW here).
const TOP_EDGE_PUFFS = [
  { f: 0.1, r: 38, opacity: 0.2 },
  { f: 0.3, r: 50, opacity: 0.23 },
  { f: 0.52, r: 32, opacity: 0.18 },
  { f: 0.74, r: 46, opacity: 0.22 },
  { f: 0.94, r: 36, opacity: 0.2 },
];

const BOTTOM_EDGE_PUFFS = [
  { f: 0.06, r: 40, opacity: 0.21 },
  { f: 0.26, r: 32, opacity: 0.18 },
  { f: 0.48, r: 48, opacity: 0.23 },
  { f: 0.7, r: 36, opacity: 0.2 },
  { f: 0.9, r: 44, opacity: 0.22 },
];

// The right boundary sits inside the chart's own padding (not against
// live data), so it reads less harshly to begin with -- a lighter touch
// here is enough to keep it from looking like a ruled-off edge.
const RIGHT_EDGE_PUFFS = [
  { f: 0.15, r: 30, opacity: 0.16 },
  { f: 0.45, r: 36, opacity: 0.18 },
  { f: 0.78, r: 28, opacity: 0.15 },
];

const SWEEP_DURATION = 2.1;
const SWEEP_EASE = [0.45, 0, 0.3, 1];

export function ChartShadow({ regionLeft, regionRight, plotTop, plotBottom, scale = 1 }) {
  const availW = regionRight - regionLeft;
  const availH = plotBottom - plotTop;

  // Fit the ghost's bounding box inside the hidden region with margin,
  // regardless of how big the volatility calculation asked for.
  const fitScale = Math.min((availW * 0.55) / (W + 20), (availH * 0.82) / (GEO_BOTTOM - GEO_TOP + 20));
  const finalScale = Math.max(0.45, Math.min(scale, fitScale));

  const centerX = regionLeft + availW / 2;
  const originY = plotTop + availH / 2 - GEO_CENTER_OFFSET * finalScale;

  // The sliding content group starts shifted a full window-width to the
  // right of its settled position -- far enough that, combined with the
  // static clip below, it's completely hidden at rest -- then animates
  // to 0 (and back on exit) so the fog and ghost move together.
  const entranceOffset = availW;

  // How far the clip is allowed to creep past the hidden region's own
  // bounds on each side -- capped relative to the region's own size so a
  // small region (a round with little left to hide) doesn't get
  // swallowed by its own overflow margin. The left side gets the most
  // room since that's the edge sitting right against live chart data.
  const leftOverflow = Math.min(60, availW * 0.22);
  const rightOverflow = Math.min(34, availW * 0.14);
  const vOverflow = Math.min(30, availH * 0.22);

  return (
    <g className={styles.shadowGroup}>
      <defs>
        <linearGradient id="ghost-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8f7ec" />
          <stop offset="100%" stopColor="#4fd1b0" />
        </linearGradient>
        <filter id="fog-blur" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id="fog-clip">
          <rect
            x={regionLeft - leftOverflow}
            y={plotTop - vOverflow}
            width={availW + leftOverflow + rightOverflow}
            height={availH + vOverflow * 2}
          />
        </clipPath>
      </defs>

      <g clipPath="url(#fog-clip)">
        <motion.g
          initial={{ x: entranceOffset }}
          animate={{ x: 0 }}
          exit={{ x: entranceOffset }}
          transition={{ duration: SWEEP_DURATION, ease: SWEEP_EASE }}
        >
          <g filter="url(#fog-blur)">
            {FOG_PUFFS.map((p, i) => (
              <circle
                key={i}
                cx={regionLeft + p.fx * availW}
                cy={plotTop + p.fy * availH}
                r={p.r}
                className={styles.fogPuff}
                style={{ opacity: p.opacity }}
              />
            ))}
            {LEFT_EDGE_PUFFS.map((p, i) => (
              <circle
                key={`left-${i}`}
                cx={regionLeft}
                cy={plotTop + p.f * availH}
                r={p.r}
                className={styles.fogPuff}
                style={{ opacity: p.opacity }}
              />
            ))}
            {TOP_EDGE_PUFFS.map((p, i) => (
              <circle
                key={`top-${i}`}
                cx={regionLeft + p.f * availW}
                cy={plotTop}
                r={p.r}
                className={styles.fogPuff}
                style={{ opacity: p.opacity }}
              />
            ))}
            {BOTTOM_EDGE_PUFFS.map((p, i) => (
              <circle
                key={`bottom-${i}`}
                cx={regionLeft + p.f * availW}
                cy={plotBottom}
                r={p.r}
                className={styles.fogPuff}
                style={{ opacity: p.opacity }}
              />
            ))}
            {RIGHT_EDGE_PUFFS.map((p, i) => (
              <circle
                key={`right-${i}`}
                cx={regionRight}
                cy={plotTop + p.f * availH}
                r={p.r}
                className={styles.fogPuff}
                style={{ opacity: p.opacity }}
              />
            ))}
          </g>

          <motion.g
            style={{ transformOrigin: `${centerX}px ${originY}px` }}
            initial={{ scale: finalScale * 0.95, y: 0 }}
            animate={{ scale: [finalScale * 0.98, finalScale * 1.02, finalScale * 0.98], y: [0, -6, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <g transform={`translate(${centerX}, ${originY})`} className={styles.bodyGroup}>
              <path d={BODY_PATH} className={styles.body} />

              <circle cx={-24} cy={-9} r="10" className={styles.cheek} />
              <circle cx={24} cy={-9} r="10" className={styles.cheek} />

              <path d={`M -24 15 Q 0 27 24 15`} className={styles.smile} />

              {[-24, 21].map((ex, i) => (
                <motion.g
                  key={i}
                  style={{ transformOrigin: `${ex}px -9px` }}
                  animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
                  transition={{ duration: 4.4, repeat: Infinity, repeatDelay: 1.4 + i * 0.4, times: [0, 0.85, 0.9, 0.95, 1], ease: 'easeInOut' }}
                >
                  <circle cx={ex} cy={-9} r="9" className={styles.eye} />
                  <circle cx={ex - 2.7} cy={-12} r="2.5" className={styles.eyeSparkle} />
                </motion.g>
              ))}
            </g>
          </motion.g>
        </motion.g>
      </g>
    </g>
  );
}
