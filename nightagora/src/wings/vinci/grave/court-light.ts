/** THE GRAVE COURT'S OWN LIGHT, for the live engine.
 *
 * The court stands in the shade of its walls: the sky is its key and the sun
 * reaches only the head of the north wall and the back of the supper wall.
 * A path tracer finds both things by itself: that the floor sees less sky
 * near the walls and most in the middle, where the slab lies, and that the
 * sunlit brick sends warm light back into the shade. The live engine lights
 * the whole shade from one sky term, so this module bakes the two on a grid
 * over the court, once, from the walls' own boxes and the hour's sun, and
 * hands them to the court's surfaces as the ambient occlusion and a small
 * emission. Both are engine terms: the film's export address turns them off
 * (`engineBounce`) and its renderer bounces for real.
 */
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, type MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { COURT_TREES, GRAVE_COURT_LEVEL } from './court-plan'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { clamp, float, mix, positionWorld, smoothstep, texture, vec2, vec3 } = TSL as unknown as Record<string, N>

/** the live engine's terms; the film's export address turns them off */
export const COURT_ENGINE_TERMS = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('export'))

/** the bounce is stored at this multiple of its value */
const BOUNCE_SCALE = 3
/** The grid, in the wing's metres, and its cell. */
export const COURT_LIGHT_GRID = { west: -61.4, east: -40.4, south: -34.2, north: -15.6, cell: .35 } as const

/** the hour's sun, from the wing's hour record: 231.9 degrees, 17.39 up */
export const SUN = (() => {
  const az = 231.9 * Math.PI / 180, el = 17.39 * Math.PI / 180
  return { e: Math.sin(az) * Math.cos(el), n: Math.cos(az) * Math.cos(el), u: Math.sin(el) }
})()

interface Solid { w: number; e: number; s: number; n: number; top: number }
/** the court's walls and what stands over its sky, heights over the court */
const SOLIDS: readonly Solid[] = [
  { w: -61.32, e: -60.88, s: -34.2, n: -15.8, top: 7.2 },   // the back wall with its filter band
  { w: -61.2, e: -40.8, s: -16.3, n: -15.8, top: 6.14 },     // the north return
  { w: -61.2, e: -40.8, s: -34.2, n: -33.72, top: 6.14 },    // the south return
  { w: -62, e: -22, s: -64, n: -34.1, top: 5.3 },            // the pavilion
  { w: -45.23, e: -44.77, s: -34.45, n: -24.55, top: 5.94 }, // the supper wall
]

/** A ray from (e, n, h) along (de, dn, dh): does it meet a solid? The slab
 * test is written out: it runs a few hundred thousand times per bake. */
function blocked(e: number, n: number, h: number, de: number, dn: number, dh: number): boolean {
  const ie = 1 / (de || 1e-12), inn = 1 / (dn || 1e-12), ih = 1 / (dh || 1e-12)
  for (let k = 0; k < SOLIDS.length; k++) {
    const s = SOLIDS[k]!
    let a = (s.w - e) * ie, b = (s.e - e) * ie
    let t0 = a < b ? a : b, t1 = a < b ? b : a
    a = (s.s - n) * inn; b = (s.n - n) * inn
    t0 = Math.max(t0, a < b ? a : b); t1 = Math.min(t1, a < b ? b : a)
    a = (-1 - h) * ih; b = (s.top - h) * ih
    t0 = Math.max(t0, a < b ? a : b, 0); t1 = Math.min(t1, a < b ? b : a)
    if (t0 < t1 && t1 > 1e-4) return true
  }
  return false
}
/** how much of a ray a court tree's crown lets through */
function crowns(e: number, n: number, h: number, de: number, dn: number, dh: number): number {
  let through = 1
  for (const t of COURT_TREES) {
    const ce = t.east, cn = t.north, ch = t.height * .62, r = t.height * .4
    const oe = e - ce, on = n - cn, oh = (h - ch) * 1.4
    const b = oe * de + on * dn + oh * dh * 1.4, c = oe * oe + on * on + oh * oh - r * r
    const k = de * de + dn * dn + dh * dh * 1.96
    const disc = b * b - k * c
    if (disc > 0 && (-b + Math.sqrt(disc)) > 0) through *= .45
  }
  return through
}

/** Where a face of the court is sunlit at the hour: the head of the north
 * return over the back wall's shadow, and the back of the supper wall. The
 * filter band lets a little through its slots. */
function sunOn(e: number, n: number, h: number): number {
  const lift = 1e-3
  if (!blocked(e + SUN.e * lift, n + SUN.n * lift, h + SUN.u * lift, SUN.e, SUN.n, SUN.u)) return crowns(e, n, h, SUN.e, SUN.n, SUN.u)
  // a ray that meets the back wall between the band's foot and its top
  // passes a slot about one time in four
  const d = (-60.88 - e) / SUN.e
  const at = h + SUN.u * d, across = n + SUN.n * d
  return d > 0 && at > 6.0 && at < 7.08 && across > -34 && across < -16 ? .25 : 0
}

interface Patch { e: number; n: number; h: number; ne: number; nn: number; area: number; lit: number }
function litPatches(): Patch[] {
  const out: Patch[] = []
  const cosIn = (ne: number, nn: number): number => Math.max(0, -(ne * -SUN.e + nn * -SUN.n))
  // the north return's court face, facing south
  for (let e = -60.4; e < -41; e += .8) for (let h = .4; h < 6.1; h += .8) {
    const lit = sunOn(e, -16.3, h)
    if (lit > 0) out.push({ e, n: -16.3, h, ne: 0, nn: -1, area: .64, lit: lit * cosIn(0, -1) })
  }
  // the supper wall's back, facing west into the court
  for (let n = -34.0; n < -24.8; n += .8) for (let h = .4; h < 5.9; h += .8) {
    const lit = sunOn(-45.24, n, h)
    if (lit > 0) out.push({ e: -45.24, n, h, ne: -1, nn: 0, area: .64, lit: lit * cosIn(-1, 0) })
  }
  return out
}

/** THE BAKE: for each cell of the floor, the share of the sky it sees
 * (cosine weighted, the walls and the crowns over it) and the warm light the
 * sunlit faces send it, in the sun's own units. */
export function bakeCourtLight(): { data: Uint8Array; width: number; height: number } {
  const G = COURT_LIGHT_GRID
  const width = Math.round((G.east - G.west) / G.cell), height = Math.round((G.north - G.south) / G.cell)
  // bytes, so any adapter filters it: the sky share whole, the bounce at a
  // third of full scale
  const data = new Uint8Array(width * height * 4)
  // a fixed spiral of directions over the hemisphere, cosine weighted
  const RAYS = 72, dirs: [number, number, number][] = []
  for (let i = 0; i < RAYS; i++) {
    const u = (i + .5) / RAYS, phi = i * 2.399963
    const r = Math.sqrt(u), up = Math.sqrt(1 - u)
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), up])
  }
  const patches = litPatches()
  const h = .05
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const e = G.west + (i + .5) * G.cell, n = G.south + (j + .5) * G.cell
    let sky = 0
    for (const [de, dn, du] of dirs) if (!blocked(e, n, h, de, dn, du)) sky += crowns(e, n, h, de, dn, du)
    sky /= RAYS
    let bounce = 0
    for (const p of patches) {
      const ve = p.e - e, vn = p.n - n, vh = p.h - h
      const r2 = ve * ve + vn * vn + vh * vh
      if (r2 < .04) continue
      const r = Math.sqrt(r2)
      const cosFloor = vh / r, cosWall = -(ve * p.ne + vn * p.nn) / r
      if (cosFloor <= 0 || cosWall <= 0) continue
      bounce += p.lit * cosFloor * cosWall * p.area / (Math.PI * r2)
    }
    const k = (j * width + i) * 4
    data[k] = Math.round(Math.min(1, sky) * 255); data[k + 1] = Math.round(Math.min(1, bounce * BOUNCE_SCALE) * 255)
    data[k + 2] = 0; data[k + 3] = 255
  }
  return { data, width, height }
}

let baked: DataTexture | undefined
function courtTexture(): DataTexture {
  if (baked) return baked
  const { data, width, height } = bakeCourtLight()
  baked = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType)
  baked.magFilter = LinearFilter; baked.minFilter = LinearFilter
  baked.needsUpdate = true
  baked.name = 'vinci/grave-court/light'
  return baked
}

/** the sky share a place of the court sees against its open middle, and the
 * warm light it takes from the sunlit faces; outside the grid, neither */
function courtTerms(P: N): { sky: N; bounce: N; inside: N } {
  const G = COURT_LIGHT_GRID
  const uv = vec2(P.x.sub(G.west).div(G.east - G.west), P.z.negate().sub(G.south).div(G.north - G.south))
  const sample = texture(courtTexture(), uv)
  const inside = smoothstep(0, .02, uv.x).mul(smoothstep(0, .02, uv.y)).mul(smoothstep(1, .98, uv.x)).mul(smoothstep(1, .98, uv.y))
    .mul(smoothstep(GRAVE_COURT_LEVEL + 3.2, GRAVE_COURT_LEVEL + 1.2, P.y))
  return { sky: sample.x, bounce: sample.y.div(BOUNCE_SCALE), inside }
}

/** The sky share at the court's open middle, which reads as the unchanged
 * ambient; a place that sees less is darker in the same proportion. */
const OPEN_SKY = .6
/** the sunlit brick's colour times the hour's key, for the bounce */
const BOUNCE = { colour: [1, .78, .6] as const, gain: 3.2 * .34 * 1.15 }

/** Hand a court surface its two terms: the ambient occlusion (multiplied into
 * any it already has) and the warm bounce, the surface's own albedo times the
 * baked light. `albedo` is the colour node the material already draws. */
export function applyCourtLight(m: MeshStandardNodeMaterial, albedo: N, opts: { floorOnly?: boolean } = {}): void {
  if (!COURT_ENGINE_TERMS) return
  const { sky, bounce, inside } = courtTerms(positionWorld)
  const up = opts.floorOnly ? smoothstep(.6, .9, TSL.normalWorldGeometry.y) : float(1)
  const weight = inside.mul(up)
  const occlusion = mix(float(1), clamp(sky.div(OPEN_SKY), .5, 1.12), weight)
  m.aoNode = m.aoNode ? (m.aoNode as N).mul(occlusion) : occlusion
  const warm = albedo.mul(vec3(...BOUNCE.colour)).mul(bounce.mul(BOUNCE.gain)).mul(weight)
  m.emissiveNode = m.emissiveNode ? (m.emissiveNode as N).add(warm) : warm
  m.userData = { ...m.userData, engineBounce: true }
}
