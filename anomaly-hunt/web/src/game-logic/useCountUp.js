import { useEffect, useState, useRef } from 'react';

/**
 * useCountUp
 *
 * Animates a displayed number from 0 up to `target` using a real
 * requestAnimationFrame loop (not a CSS trick), with ease-out easing so
 * it starts fast and settles smoothly. Respects prefers-reduced-motion
 * by jumping straight to the target instead of animating.
 */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    let raf;
    const start = performance.now();
    const from = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(from + eased * (targetRef.current - from)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
