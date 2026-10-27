/**
 * RadarSkillChart.jsx
 *
 * A 4-axis spider chart of detection skill by anomaly type, replacing
 * four separate horizontal bars with one shape whose silhouette reads
 * at a glance -- a lopsided shape immediately shows which anomaly types
 * need work, which four disconnected bars require actually reading each
 * number to notice. Ties into the radar/signal-intelligence motif
 * already used for the background and the field-ops aesthetic generally.
 */
import { motion } from 'motion/react';
import styles from './RadarSkillChart.module.css';

const AXES = [
  { key: 'pointSpike', label: 'Point Spikes' },
  { key: 'levelShift', label: 'Level Shifts' },
  { key: 'missingGap', label: 'Missing Gaps' },
  { key: 'trendBreak', label: 'Trend Breaks' },
  { key: 'volatilitySpike', label: 'Volatility Spikes' },
];

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 92;
const RINGS = [0.33, 0.66, 1];

function pointFor(angleDeg, fraction) {
  const rad = (angleDeg * Math.PI) / 180;
  const r = RADIUS * fraction;
  return { x: CENTER + Math.cos(rad) * r, y: CENTER + Math.sin(rad) * r };
}

export function RadarSkillChart({ skills }) {
  const angles = AXES.map((_, i) => -90 + i * (360 / AXES.length));
  const dataPoints = AXES.map((axis, i) => pointFor(angles[i], skills[axis.key] ?? 0));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.svg}>
      {RINGS.map((ringFrac, ri) => {
        const ringPoints = angles.map((a) => pointFor(a, ringFrac));
        return <polygon key={ri} points={ringPoints.map((p) => `${p.x},${p.y}`).join(' ')} className={styles.ring} />;
      })}

      {angles.map((a, i) => {
        const edge = pointFor(a, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={edge.x} y2={edge.y} className={styles.axisLine} />;
      })}

      <motion.g
        className={styles.dataGroup}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.1 }}
      >
        <polygon points={dataPath} className={styles.dataFill} />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" className={styles.dataDot} />
        ))}
      </motion.g>

      {angles.map((a, i) => {
        const labelPos = pointFor(a, 1.3);
        const skill = skills[AXES[i].key];
        // A centered label on a mostly-left or mostly-right axis extends
        // half its width past the viewBox edge and gets clipped -- grow
        // those labels inward (toward center) instead of symmetrically.
        // Keyed off cos(angle) rather than an exact 0/180 match: with N
        // axes evenly spaced, only N=4 ever lands exactly on a cardinal
        // angle -- 5 axes puts labels at -18/126/198 degrees, close
        // enough to horizontal to clip just the same without this.
        const cos = Math.cos((a * Math.PI) / 180);
        const anchor = cos > 0.3 ? 'end' : cos < -0.3 ? 'start' : 'middle';
        return (
          <g key={i}>
            <text x={labelPos.x} y={labelPos.y - 4} textAnchor={anchor} className={styles.axisLabel}>
              {AXES[i].label}
            </text>
            <text x={labelPos.x} y={labelPos.y + 12} textAnchor={anchor} className={styles.axisValue}>
              {skill === null ? '—' : `${Math.round(skill * 100)}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
