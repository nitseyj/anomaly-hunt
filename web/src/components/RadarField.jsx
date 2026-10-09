/**
 * RadarField.jsx
 *
 * A large ambient radar/sonar graphic anchored off-canvas in the
 * background -- fills the dead space on screens that are otherwise just
 * a card or two floating in black, and reinforces the field-ops/signal-
 * intelligence identity without competing with foreground content
 * (it sits behind everything, low opacity, pointer-events: none).
 */
import styles from './RadarField.module.css';

const RINGS = [90, 160, 230, 300, 370];
const BLIPS = [
  { angle: 35, radius: 150, delay: 0 },
  { angle: 160, radius: 260, delay: 1.4 },
  { angle: 250, radius: 100, delay: 2.8 },
  { angle: 300, radius: 330, delay: 4.2 },
];

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 400 + Math.cos(rad) * radius, y: 400 + Math.sin(rad) * radius };
}

export function RadarField() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <svg viewBox="0 0 800 800" className={styles.svg}>
        <defs>
          <radialGradient id="radar-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-signal)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent-signal)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sweep-fade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-signal)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--accent-signal)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {RINGS.map((r) => (
          <circle key={r} cx="400" cy="400" r={r} className={styles.ring} />
        ))}

        <line x1="30" y1="400" x2="770" y2="400" className={styles.crosshair} />
        <line x1="400" y1="30" x2="400" y2="770" className={styles.crosshair} />

        <g className={styles.sweepGroup}>
          <path d="M 400 400 L 400 30 A 370 370 0 0 1 647 143 Z" fill="url(#sweep-fade)" />
        </g>

        {BLIPS.map((b, i) => {
          const { x, y } = polar(b.angle, b.radius);
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <circle r="4" className={styles.blipCore} />
              <circle r="4" className={styles.blipPing} style={{ animationDelay: `${b.delay}s` }} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
