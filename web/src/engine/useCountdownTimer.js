/**
 * useCountdownTimer.js
 *
 * The once-per-second ticking countdown shared by every timed screen
 * (Anomaly Hunt, Daily Challenge) -- was duplicated identically (same
 * setInterval, same clamp-to-zero logic) in both before living here.
 * Deliberately dumb about WHAT happens at zero: it just calls the
 * latest `onExpire` it was given (always the freshest closure, via the
 * ref, even though the interval itself is only set up once per start())
 * and leaves it to the caller to decide whether that's still valid --
 * e.g. a screen checks its own `revealed` flag before auto-revealing,
 * so a timer that's already been stopped-and-restarted some other way
 * can never double-fire a reveal.
 */
import { useEffect, useRef, useState } from 'react';

export function useCountdownTimer(totalSeconds, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const timerRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    if (secondsLeft === 0) onExpireRef.current?.();
  }, [secondsLeft]);

  function start() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stop() {
    clearInterval(timerRef.current);
  }

  function reset(seconds = totalSeconds) {
    clearInterval(timerRef.current);
    setSecondsLeft(seconds);
  }

  return { secondsLeft, start, stop, reset };
}
