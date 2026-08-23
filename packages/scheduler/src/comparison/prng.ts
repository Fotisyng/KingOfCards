/**
 * Builds a seeded pseudo-random number generator (mulberry32), returning a `() => number` in `[0, 1)`.
 *
 * `Math.random()` isn't seedable, and the virtual-learner comparison needs reproducible runs.
 */
export function createRng(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
