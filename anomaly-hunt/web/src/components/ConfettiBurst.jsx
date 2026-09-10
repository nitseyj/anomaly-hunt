import { useMemo } from 'react';

const COLORS = ['#4F7CFF', '#00D4FF', '#25D695', '#FFB547'];

/**
 * ConfettiBurst
 *
 * A lightweight, dependency-free celebratory burst -- pure CSS keyframe
 * animation on a handful of absolutely-positioned particles, no canvas
 * or external library. Render it inside a `position: relative` parent;
 * it fills that parent and bursts outward from the center. Re-renders
 * (and re-bursts) whenever `trigger` changes identity, so pass something
 * like a round/case ID rather than a boolean if you want it to replay
 * across screens that don't fully remount.
 */
export default function ConfettiBurst({ trigger, count = 28 }) {
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
    <div className="dd-confetti-container" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="dd-confetti-particle"
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
