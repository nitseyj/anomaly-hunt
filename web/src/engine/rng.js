/**
 * rng.js
 *
 * A seedable PRNG (mulberry32) -- every procedural generator in the game
 * takes one of these instead of touching Math.random() directly, so a
 * case can be replayed exactly from its seed (the Daily Challenge) or run
 * fully random (every other mode, seeded from Math.random() once at the
 * top).
 */
export function createRng(seed) {
  let state = seed | 0;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller, scaled to the given mean/std. */
export function gaussian(rng, mean = 0, std = 1) {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/** A fresh, non-deterministic seed for normal (non-Daily-Challenge) play. */
export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
