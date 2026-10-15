/**
 * useFlagging.js
 *
 * The flag-placement state machine shared by every Anomaly Hunt-shaped
 * screen (Anomaly Hunt itself, Daily Challenge): the list of placed
 * flags, the index->guessed-value map scoring needs for the 2D distance
 * falloff, and the place/remove handlers AnomalyChart calls into. Was
 * duplicated identically across both screens before living here.
 */
import { useMemo, useState } from 'react';
import { MAX_FLAGS_PER_CASE } from './scoring.js';

export function useFlagging() {
  const [flags, setFlags] = useState([]);

  const yGuessMap = useMemo(() => {
    const map = {};
    flags.forEach((f) => (map[f.index] = f.value));
    return map;
  }, [flags]);

  function placeFlag(index, value) {
    setFlags((prev) => (prev.length >= MAX_FLAGS_PER_CASE ? prev : [...prev, { index, value }]));
  }

  function removeFlag(index) {
    setFlags((prev) => prev.filter((f) => f.index !== index));
  }

  function resetFlags() {
    setFlags([]);
  }

  return { flags, yGuessMap, placeFlag, removeFlag, resetFlags };
}
