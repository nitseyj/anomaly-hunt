/**
 * useCountUp.js
 *
 * Animates a number from its previous value to a new target whenever
 * the target changes, using requestAnimationFrame directly (no deps) so
 * score/stat readouts can tick up rather than snapping.
 */
import { useEffect, useRef, useState } from 'react';

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

export function useCountUp(target, { duration = 700, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutQuint(progress);
      const value = from + (to - from) * eased;
      setDisplay(Number(value.toFixed(decimals)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  return display;
}
