/**
 * Deterministic RNG for the forge: identical builds render identical skies,
 * so screenshot judging compares craft, never luck. Seed = founding date.
 */
export const FOUNDING_SEED = 20260718

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random point on a spherical shell between rMin and rMax. */
export function shellPoint(rand: () => number, rMin: number, rMax: number): [number, number, number] {
  const u = rand() * 2 - 1
  const phi = rand() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  const r = rMin + (rMax - rMin) * rand()
  return [r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)]
}
