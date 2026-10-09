/**
 * rng.js
 *
 * A seedable PRNG (mulberry32) -- every procedural generator takes one of
 * these instead of touching Math.random() directly, so a case can be
 * replayed exactly from its seed (the Daily Challenge) or run fully
 * random (every other mode, seeded from Math.random() once at the top).
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

/**
 * Day-to-day correlated noise (an AR(1) process) instead of independent
 * per-point Gaussian noise. Pure i.i.d. noise makes every metric look
 * like a jagged sawtooth -- visually busy and unlike how a real daily
 * business metric actually moves, where today is usually close to
 * yesterday. `momentum` controls how strongly each point carries over
 * the previous one (0 = back to i.i.d., close to 1 = a slow drift).
 * The innovation variance is scaled so the series' stationary standard
 * deviation still matches `std`, keeping noise magnitude comparable to
 * before -- anomaly injection sizes its effects off this same `std`
 * (see anomalies.js), so that proportionality is preserved.
 */
export function smoothNoise(rng, length, std, momentum = 0.65) {
  const innovationStd = std * Math.sqrt(1 - momentum * momentum);
  const out = [];
  let prev = 0;
  for (let i = 0; i < length; i++) {
    prev = prev * momentum + gaussian(rng, 0, innovationStd);
    out.push(prev);
  }
  return out;
}
