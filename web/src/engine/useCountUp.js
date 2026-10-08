import { useEffect, useState, useRef } from 'react';

/** Animates a displayed number up to `target` via requestAnimationFrame
 * with ease-out cubic easing. Respects prefers-reduced-motion. */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * targetRef.current));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
