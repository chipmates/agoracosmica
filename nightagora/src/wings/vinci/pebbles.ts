/* ONE PEBBLE, AS THE GROUND HOLDS IT.

   Loose stone on packed earth is a river gravel of the Loire type (limestone,
   flint, a little sandstone), worn round, lying flatter than it is wide and
   bedded in the ground it lies on. It is drawn as a low rounded body of its
   own outline, sunk at its foot, shaded round (its normals are the stone's
   curvature, not its facets), in stone colours inside the albedo range of the
   art direction. The pebble is a type, never a record of a stone. */

export type V3 = [number, number, number]
/** one triangle with its three corner normals and one colour */
export type Emit = (a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3, colour: V3) => void

/** Loire gravel, lit and dry, in linear reflectance 0.12 to 0.36. */
const STONES: readonly (readonly [string, number])[] = [
  ['#9a8f7a', 3], ['#8a8171', 3], ['#a59a84', 2], ['#7a7266', 2], ['#6c6459', 1.2],
  ['#b0a58d', 1], ['#8e7c62', 1.2], ['#5f5953', .6],
]
const linear = (hex: string): V3 => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number): number => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}
const STONE_COLOURS = STONES.map(([hex]) => linear(hex))
const STONE_TOTAL = STONES.reduce((a, [, w]) => a + w, 0)

/** A stone colour, a little varied, from one draw in 0..1 and one in 0..1. */
export function stoneColour(pick: number, tone: number): V3 {
  let at = pick * STONE_TOTAL, i = 0
  while (i < STONES.length - 1 && at > STONES[i]![1]) { at -= STONES[i]![1]; i++ }
  const c = STONE_COLOURS[i]!, k = .9 + tone * .18
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** One pebble at (east, north): `size` its long diameter in metres, `flat`
    its height against that diameter, `sides` the points of its outline, and
    `sink` how far its foot lies below the ground there. Returns whether it
    was laid: a stone never bridges a step in the ground under it. */
export function pebble(emit: Emit, heightAt: (east: number, north: number) => number, east: number, north: number,
  size: number, flat: number, turn: number, sides: number, sink: number, colour: V3, random: () => number,
  accept: (east: number, north: number) => boolean = () => true): boolean {
  const ring: { e: number; n: number; r: number; a: number }[] = []
  const long = size / 2, short = long * (.55 + random() * .35)
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2 + (random() - .5) * .5
    const wobble = .86 + random() * .24
    const x = Math.cos(a) * long * wobble, y = Math.sin(a) * short * wobble
    const e = east + x * Math.cos(turn) - y * Math.sin(turn), n = north + x * Math.sin(turn) + y * Math.cos(turn)
    if (!accept(e, n)) return false
    ring.push({ e, n, r: Math.hypot(x, y), a: Math.atan2(n - north, e - east) })
  }
  const levels = ring.map(p => heightAt(p.e, p.n)), centre = heightAt(east, north)
  if (Math.max(...levels, centre) - Math.min(...levels, centre) > Math.max(.012, size * .35)) return false
  const height = size * flat
  // the crown of the stone sits off its middle, as a worn stone's does
  const ce = east + (random() - .5) * long * .3, cn = north + (random() - .5) * short * .3
  const top: V3 = [ce, centre + height - sink, -cn]
  // a shoulder ring at two thirds of the radius carries the roundness
  const shoulder: V3[] = [], foot: V3[] = [], footN: V3[] = [], shoulderN: V3[] = []
  for (let i = 0; i < sides; i++) {
    const p = ring[i]!
    foot.push([p.e, levels[i]! - sink, -p.n])
    const se = ce + (p.e - ce) * .72, sn = cn + (p.n - cn) * .72
    shoulder.push([se, centre + height * (.72 + random() * .1) - sink, -sn])
    const out: V3 = [Math.cos(p.a), 0, -Math.sin(p.a)]
    footN.push(norm([out[0] * .9, .45, out[2] * .9]))
    shoulderN.push(norm([out[0] * .55, .85, out[2] * .55]))
  }
  const up: V3 = [0, 1, 0]
  const shade = (k: number): V3 => [colour[0] * k, colour[1] * k, colour[2] * k]
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    // wound so each face looks out of the stone
    emit(foot[i]!, shoulder[j]!, foot[j]!, footN[i]!, shoulderN[j]!, footN[j]!, shade(.93))
    emit(foot[i]!, shoulder[i]!, shoulder[j]!, footN[i]!, shoulderN[i]!, shoulderN[j]!, shade(.97))
    emit(shoulder[i]!, top, shoulder[j]!, shoulderN[i]!, up, shoulderN[j]!, colour)
  }
  return true
}

function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
