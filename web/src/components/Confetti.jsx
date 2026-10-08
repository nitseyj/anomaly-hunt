import { useMemo } from 'react';
import styles from './Confetti.module.css';

const COLORS = ['#4f7cff', '#00d4ff', '#25d695', '#ffb547'];

/** A lightweight, dependency-free celebratory burst -- pure CSS keyframe
 * animation on a handful of absolutely-positioned particles. Render
 * inside a `position: relative` parent; re-bursts whenever `trigger`
 * changes identity, so pass a round/case id rather than a plain boolean
 * if it should replay across consecutive "great result" screens. */
export function Confetti({ trigger, count = 28 }) {
  const particles = useMemo(() => {
    if (!trigger) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (360 / count) * i + (Math.random() * 24 - 12),
      distance: 70 + Math.random() * 70,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 90,
      size: 5 + Math.random() * 5,
      rotate: Math.random() * 420,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }));
  }, [trigger, count]);

  if (!trigger || particles.length === 0) return null;

  return (
    <div className={styles.container} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            '--angle': `${p.angle}deg`,
            '--distance': `${p.distance}px`,
            '--delay': `${p.delay}ms`,
            '--rotate': `${p.rotate}deg`,
            background: p.color,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  );
}
