/* One motion language, ported from concept 01 (camera-path law): every
   animated value is a pure scalar channel of progress, so any journey
   scrubs forward and backward deterministically. */

export type Ease = (t: number) => number

export const EASE: Record<string, Ease> = {
  linear: (t) => t,
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
}

export interface ChannelKey {
  p: number
  v: number
  e?: keyof typeof EASE
}

/** Scalar keyframe channel: `e` is the easing applied approaching that key. */
export function channel(keys: ChannelKey[]): (p: number) => number {
  return (p: number): number => {
    const first = keys[0]
    const last = keys[keys.length - 1]
    if (!first || !last) return 0
    if (p <= first.p) return first.v
    if (p >= last.p) return last.v
    let i = 1
    while (i < keys.length && (keys[i]?.p ?? 1) < p) i += 1
    const a = keys[i - 1]
    const b = keys[i]
    if (!a || !b) return last.v
    const t = (p - a.p) / (b.p - a.p)
    const ease = EASE[b.e ?? 'smooth'] ?? EASE['smooth']
    return a.v + (b.v - a.v) * (ease as Ease)(t)
  }
}

/** 0 before a, 1 after b, smooth ramp within. */
export const win = (p: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
