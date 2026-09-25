/** Leaded glazing for every glazed light of the house.
 * Each quarry is its own piece of glass, its face a fraction off the plane
 * of its light and slightly bowed, so the sky and the court come back in
 * broken pieces. The saddle bars behind the glass are geometry; the lead
 * cames are geometry in the film and drawn in the glass at the live tiers,
 * where a 7 mm came is under two pixels at every stop; the film draws them
 * too wherever its built came is thinner than its pixel.
 * The lights' outlines are the shell's own apertures; nothing is surveyed.
 */
import {
  AddEquation, BufferGeometry, CustomBlending, Float32BufferAttribute, Group, Mesh,
  MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, OneFactor, SrcAlphaFactor, ZeroFactor,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { maxFromQuery } from '../../stack/tier'
import { hourKey } from './site'
import { wallRise } from './house-weather'

// TSL's composable overloads are typed once at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, clamp, dFdx, dFdy, float, floor, fract, max, mix, mx_fractal_noise_float, mx_noise_float, normalMap, normalView, normalWorldGeometry, output, positionViewDirection,
  reflectVector, smoothstep, uv, vec2, vec3, vec4 } = TSL as unknown as Record<string, N>
/** The hour's sun, for the side of the sky it warms. */
const SUN_AZ = hourKey.sun_azimuth_deg.value * Math.PI / 180
const SUN_EAST = Math.sin(SUN_AZ), SUN_NORTH = Math.cos(SUN_AZ)
/** the half-angle the light's wall rise is baked across, and what a shaded
 * court wall returns in a pane (the court's brick and tuffeau in its shade) */
const WALL_RISE_SPREAD = 50 * Math.PI / 180
const COURT_WALL_SEEN = vec3(.062, .05, .042)

type V2 = [number, number]
type V3 = [number, number, number]
export type GlazedKind = 'window' | 'lancet' | 'lobe' | 'dormer'
/** One light in its facade frame: `outline` is (along, height) in metres,
 * convex and counter-clockwise; `out` is the glass plane, negative inward. */
export interface GlazedLight {
  id: string
  from: V2
  to: V2
  length: number
  outline: V2[]
  out: number
  kind: GlazedKind
  /** heights of the iron saddle bars across this light, behind the glass */
  bars: number[]
}

/** Diamond quarries of 155 mm sides on a 45 degree lattice, as before. */
export const QUARRY_SIDE_M = .155
const STEP = QUARRY_SIDE_M * Math.SQRT2
const CAME_M = .007, BORDER_CAME_M = .014
/** THE GLINT'S CEILING, in linear luminance before the print: a quarry that
 * mirrors the sun rolls off above the knee toward the cap, which sits under
 * the sunlit stone of the wall that holds it. */
export const GLINT_KNEE = .16, GLINT_CAP = .34
/** A came's edges sink this far behind the glass it holds, so no piece of
 * glass ever shows in front of its own lead. */
const CAME_TUCK_M = .0008

const rand = (a: number, b = 0, c = 0): number => {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123
  return n - Math.floor(n)
}
function area(poly: V2[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; s += a[0] * b[1] - b[0] * a[1] }
  return s / 2
}
/** Clip a convex polygon by the convex, counter-clockwise outline. */
function clipConvex(subject: V2[], outline: V2[]): V2[] {
  let out = subject
  for (let i = 0; i < outline.length && out.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!
    const side = (p: V2): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    const input = out; out = []
    for (let k = 0; k < input.length; k++) {
      const p = input[k]!, q = input[(k + 1) % input.length]!, sp = side(p), sq = side(q)
      if (sp >= 0) out.push(p)
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
    }
  }
  return out
}
/** Clip a segment to the convex outline, or null when nothing remains. */
function clipSegment(p: V2, q: V2, outline: V2[]): [V2, V2] | null {
  let t0 = 0, t1 = 1
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!
    const side = (s: V2): number => (b[0] - a[0]) * (s[1] - a[1]) - (b[1] - a[1]) * (s[0] - a[0])
    const sp = side(p), sq = side(q)
    if (sp < 0 && sq < 0) return null
    if (sp < 0) t0 = Math.max(t0, sp / (sp - sq))
    else if (sq < 0) t1 = Math.min(t1, sp / (sp - sq))
  }
  if (t1 - t0 < 1e-6) return null
  const at = (t: number): V2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  return [at(t0), at(t1)]
}
const ccw = (poly: V2[]): V2[] => area(poly) < 0 ? [...poly].reverse() : poly
/** Whether the edge p-q runs along the light's own outline. */
function onOutline(p: V2, q: V2, outline: V2[]): boolean {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l < 1e-9) continue
    const off = (s: V2): number => Math.abs((b[0] - a[0]) * (s[1] - a[1]) - (b[1] - a[1]) * (s[0] - a[0])) / l
    if (off(p) < 1e-5 && off(q) < 1e-5) return true
  }
  return false
}
/** Drop corners closer than 4 mm to the one before: a clip that grazes a
 * lattice point leaves a hair-thin edge a fan would turn into a needle. */
function tidy(poly: V2[]): V2[] {
  const out: V2[] = []
  for (const p of poly) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > .004) out.push(p) }
  while (out.length > 2 && Math.hypot(out[0]![0] - out[out.length - 1]![0], out[0]![1] - out[out.length - 1]![1]) <= .004) out.pop()
  return out
}
/** The narrowest width of a convex polygon, over its own edge directions. */
function thinnest(poly: V2[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l < 1e-9) continue
    let far = 0
    for (const p of poly) far = Math.max(far, Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / l)
    best = Math.min(best, far)
  }
  return best
}

/** The quarries of one light, and the came lines that part them. */
function lattice(light: GlazedLight): { pieces: V2[][]; lines: [V2, V2][] } {
  const outline = ccw(light.outline)
  if (light.kind === 'lobe') return { pieces: [outline], lines: [] }
  const us = outline.map(p => p[0]), vs = outline.map(p => p[1])
  const cu = (Math.min(...us) + Math.max(...us)) / 2, v0 = Math.min(...vs)
  // Lattice coordinates a=(du+dv)/STEP, b=(dv-du)/STEP; a vertex column
  // stands on the light's centre line, a row of points on its sill.
  const toUV = (a: number, b: number): V2 => [cu + (a - b) * STEP / 2, v0 + (a + b) * STEP / 2]
  const as = outline.map(p => ((p[0] - cu) + (p[1] - v0)) / STEP), bs = outline.map(p => ((p[1] - v0) - (p[0] - cu)) / STEP)
  const [a0, a1, b0, b1] = [Math.floor(Math.min(...as)), Math.ceil(Math.max(...as)), Math.floor(Math.min(...bs)), Math.ceil(Math.max(...bs))]
  const pieces: V2[][] = [], lines: [V2, V2][] = []
  for (let i = a0; i < a1; i++) for (let j = b0; j < b1; j++) {
    const piece = tidy(clipConvex([toUV(i, j), toUV(i + 1, j), toUV(i + 1, j + 1), toUV(i, j + 1)], outline))
    // a sliver along the light's edge lies under its border lead: no glass
    if (piece.length >= 3 && area(piece) > 2.5e-4 && thinnest(piece) > .006) pieces.push(piece)
  }
  for (let i = a0 + 1; i < a1; i++) { const s = clipSegment(toUV(i, b0), toUV(i, b1), outline); if (s) lines.push(s) }
  for (let j = b0 + 1; j < b1; j++) { const s = clipSegment(toUV(a0, j), toUV(a1, j), outline); if (s) lines.push(s) }
  return { pieces, lines }
}

/** A glass triangle's three edges, as the distance in metres from each
 * corner to each edge's line; an edge that is not a quarry's edge reads a
 * full metre everywhere, so no lead is drawn along it. */
const NO_RIM: V3 = [1, 1, 1]
class Sink {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; extra: number[] = []; rims: number[] = []; walls: number[] = []
  /** the light's wall rise to its left, straight out and to its right */
  wallRise: V3 = [0, 0, 0]
  vertex(p: V3, n: V3, t: V2, e: [number, number], rims: V3 = NO_RIM, borders = 0): void {
    this.positions.push(p[0], p[2], -p[1]); this.normals.push(n[0], n[2], -n[1]); this.uvs.push(t[0], t[1]); this.extra.push(e[0], e[1], borders, 0)
    this.rims.push(rims[0], rims[1], rims[2]); this.walls.push(...this.wallRise)
  }
  /** A flat triangle wound to face along `n`, whatever order it came in. */
  tri(a: V3, b: V3, c: V3, n: V3, e: [number, number]): void {
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const g: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (g[0] * n[0] + g[1] * n[1] + g[2] * n[2] < 0) { this.vertex(a, n, [0, 0], e); this.vertex(c, n, [0, 0], e); this.vertex(b, n, [0, 0], e) }
    else { this.vertex(a, n, [0, 0], e); this.vertex(b, n, [0, 0], e); this.vertex(c, n, [0, 0], e) }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    g.setAttribute('glazing', new Float32BufferAttribute(this.extra, 4))
    g.setAttribute('rims', new Float32BufferAttribute(this.rims, 3))
    g.setAttribute('walls', new Float32BufferAttribute(this.walls, 3))
    g.computeBoundingSphere()
    return g
  }
}

/** Leaded glass that reflects the sky and lets the room behind it through.
 * Colour is what the glass reflects; alpha is what it transmits, so the
 * framebuffer takes reflection + room * transmission. */
function glassMaterial(cames: boolean): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial({ metalness: 0, roughness: .06, ior: 1.52, specularIntensity: 1, transparent: true, depthWrite: false })
  const info = attribute('glazing', 'vec4'), seed = info.x, sill = info.y, borders = info.z, rims = attribute('rims', 'vec3')
  // The leading drawn in the glass: each rim value is the
  // distance in metres to one edge, and its screen gradient is the metres a
  // pixel spans across the came, so the line holds its width at any angle.
  const leadAt = (d: N, bit: number): N => {
    const pixel = vec2(dFdx(d), dFdy(d)).length().max(1e-7)
    const half = mix(float(CAME_M / 2), float(BORDER_CAME_M / 2), floor(borders.div(bit)).mod(2))
    const line = float(1).sub(smoothstep(half.sub(pixel.mul(.75)), half.add(pixel.mul(.75)), d))
    // Where the film builds its cames, the drawn line stands in only for a
    // came too thin for its pixel and yields as the built lead resolves.
    return cames ? line.mul(float(1).sub(smoothstep(1.2, 2.6, half.mul(2).div(pixel)))) : line
  }
  const drawnLead = max(leadAt(rims.x, 1), max(leadAt(rims.y, 2), leadAt(rims.z, 4)))
  const U = uv()
  // Cylinder glass is drawn thin and flattened while soft: a slow ripple
  // runs through each quarry, a few centimetres long, a fraction of a degree.
  const rippleA = mx_noise_float(vec3(U.x.mul(21), U.y.mul(9), seed.mul(17.3)))
  const rippleB = mx_noise_float(vec3(U.x.mul(9), U.y.mul(23), seed.mul(31.7).add(4.1)))
  const perturb = vec2(rippleA, rippleB).mul(.009)
  m.normalNode = normalMap(vec3(perturb.x.add(.5), perturb.y.add(.5), 1), vec2(1, 1))
  // A fired surface that has stood forty years: a little dust, heavier on
  // the lowest quarries where rain splash and cobweb settle.
  const dust = float(.012).add(seed.mul(.014)).add(float(1).sub(smoothstep(.02, .22, sill)).mul(.022))
  m.colorNode = mix(vec3(.60, .60, .55).mul(dust), vec3(.09, .094, .092), drawnLead)
  m.roughnessNode = mix(clamp(float(.07).add(seed.mul(.05)).add(dust.mul(.8)), .06, .18), float(.55), drawnLead)
  const nDotV = clamp(normalView.dot(positionViewDirection), 0, 1)
  // A pane has two faces and old glass sends back from both: about 8 per
  // cent head on, not the 4 of one face, which is why a window takes the sky.
  const fresnel = float(.083).add(float(1 - .083).mul(float(1).sub(nDotV).pow(5)))
  // THE SKY IN THE GLASS. The scene's probe lights surfaces at a fraction of
  // the sky a visitor sees, so the glass adds what a mirror of that sky
  // returns: a hazy horizon, warmer toward the sun, a blue zenith, the
  // ground below, streaks of the high veil. Each quarry's own tilt picks a
  // different piece of it. The film's glass reflects the real sky instead.
  const R = reflectVector
  const up = R.y
  const toSun = vec2(R.x, R.z).normalize().dot(vec2(SUN_EAST, -SUN_NORTH)).mul(.5).add(.5)
  const horizon = mix(vec3(.40, .41, .40), vec3(.50, .44, .33), toSun.pow(3))
  const skyUp = mix(horizon, vec3(.13, .20, .35), smoothstep(0, .55, up).pow(.8))
  const veil = mx_fractal_noise_float(vec3(R.x.mul(2.6), R.y.mul(5.5), R.z.mul(2.1)), 4, 2, .5).clamp(-1, 1)
  const cirrus = smoothstep(.10, .55, veil).mul(smoothstep(.03, .2, up)).mul(float(1).sub(smoothstep(.6, .95, up)))
  const sky = mix(skyUp, vec3(.52, .52, .50), cirrus.mul(.5))
  const ground = mix(vec3(.11, .10, .085), horizon.mul(.55), smoothstep(-.12, 0, up))
  const open = mix(ground, sky, smoothstep(-.006, .006, up))
  // A pane in a court mirrors the walls across it, in their shade, wherever
  // its reflection runs under their heads (`wallRise`, baked per light at
  // 50 degrees either side of straight out).
  const nw = vec2(normalWorldGeometry.x, normalWorldGeometry.z).normalize()
  const flat = vec2(R.x, R.z), run = flat.length().max(1e-4)
  const side = clamp(TSL.atan(flat.dot(vec2(nw.y, nw.x.negate())), flat.dot(nw)).div(WALL_RISE_SPREAD), -1, 1)
  const walls = attribute('walls', 'vec3')
  const rise = mix(mix(walls.y, walls.x, side.negate()), mix(walls.y, walls.z, side), side.greaterThan(0).select(float(1), float(0)))
  const mirrored = float(1).sub(smoothstep(rise.sub(.04), rise.add(.04), R.y.div(run))).mul(smoothstep(.01, .05, rise))
  const seen = mix(open, COURT_WALL_SEEN, mirrored)
  // each melt its own faint cast: greenish, straw or grey
  const melt = fract(seed.mul(7.31))
  const tint = mix(mix(vec3(.90, 1, .90), vec3(1, .97, .84), smoothstep(.3, .7, melt)), vec3(.95, .97, 1), smoothstep(.75, .95, melt))
  // a bowed quarry gathers or spreads what it mirrors: each its own strength
  const gather = fract(seed.mul(13.7)).mul(.7).add(.65)
  m.emissiveNode = seen.mul(fresnel).mul(gather).mul(float(1).sub(dust.mul(6))).mul(tint).mul(float(1).sub(drawnLead))
  // Old glass is faintly green and not quite clear; each quarry its own melt.
  const clear = mix(float(.62), float(.90), seed.mul(seed)).sub(dust.mul(2.4))
  m.opacityNode = clamp(clear.mul(float(1).sub(fresnel)).mul(float(1).sub(drawnLead)), 0, 1)
  // The sun in one quarry is thousands of times the sky in the next; left
  // alone it prints white and swallows the lead round it. Rolled off, the
  // quarries still disagree and every came between them still reads.
  const lit = output.rgb, lum = lit.dot(vec3(.2126, .7152, .0722)).max(1e-5)
  const over = lum.sub(GLINT_KNEE).max(0)
  const held = lum.min(GLINT_KNEE).add(over.div(float(1).add(over.div(GLINT_CAP - GLINT_KNEE))))
  m.outputNode = vec4(lit.mul(held.div(lum)), output.a)
  m.blending = CustomBlending
  m.blendEquation = AddEquation
  m.blendSrc = OneFactor
  m.blendDst = SrcAlphaFactor
  m.blendSrcAlpha = ZeroFactor
  m.blendDstAlpha = OneFactor
  m.name = 'vinci/house-glazing/glass'
  return m
}

function cameMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: 0, roughness: .52 })
  const info = attribute('glazing', 'vec4'), lead = info.x
  // Weathered lead is a soft grey oxide; the saddle bars are forged iron.
  m.colorNode = mix(vec3(.022, .021, .020), vec3(.090, .094, .092), lead)
  m.roughnessNode = mix(float(.62), float(.48), lead)
  m.name = 'vinci/house-glazing/lead'
  return m
}

export interface HouseGlazing { group: Group; quarries: number; cames: number; triangles: number }

/** `detail` 2 builds bowed quarries and the saddle bars, 1 flat quarries.
 * The cames are built in the film (`?tier=max`) and drawn everywhere else. */
export function createHouseGlazing(lights: readonly GlazedLight[], detail: 1 | 2): HouseGlazing {
  const glass = new Sink(), lead = new Sink()
  // the offline checkers build the house with no address to ask
  const built = detail === 2 && typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined' && maxFromQuery()
  let quarries = 0, cames = 0
  for (const light of lights) {
    const dx = (light.to[0] - light.from[0]) / light.length, dy = (light.to[1] - light.from[1]) / light.length
    const outward: V3 = [dy, -dx, 0], along: V3 = [dx, dy, 0]
    const at = (u: number, v: number, out: number): V3 => [light.from[0] + dx * u + dy * out, light.from[1] + dy * u - dx * out, v]
    const { pieces, lines } = lattice(light)
    const outline = ccw(light.outline)
    const v0 = Math.min(...light.outline.map(p => p[1]))
    const us = light.outline.map(p => p[0]), vs = light.outline.map(p => p[1])
    const centre = at((Math.min(...us) + Math.max(...us)) / 2, (v0 + Math.max(...vs)) / 2, light.out)
    glass.wallRise = [-1, 0, 1].map(k => {
      const a = k * WALL_RISE_SPREAD
      return wallRise(centre[0], centre[1], centre[2], outward[0] * Math.cos(a) + along[0] * Math.sin(a), outward[1] * Math.cos(a) + along[1] * Math.sin(a))
    }) as V3
    for (const piece of pieces) {
      quarries++
      const c: V2 = [piece.reduce((s, p) => s + p[0], 0) / piece.length, piece.reduce((s, p) => s + p[1], 0) / piece.length]
      const seed = rand(c[0] * 7.1 + light.from[0], c[1] * 3.3 + light.from[1], light.out)
      // A quarry's face is set a fraction of a degree off its neighbours and
      // bows by well under a millimetre, enough to break a reflected line;
      // its edge stays in the came's channel, so the tilt lives in the normal.
      const ta = (rand(seed, 1.7) - .5) * .05, tb = (rand(seed, 2.9) - .5) * .05
      const set = (rand(seed, 4.3) - .5) * .0003, bow = detail === 2 ? (rand(seed, 6.1) > .5 ? 1 : -1) * (.0003 + rand(seed, 8.2) * .0005) : 0
      const R2 = Math.max(...piece.map(p => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2), 1e-6)
      const vertex = (p: V2, centre: boolean, rims: V3, borders: number): void => {
        const du = p[0] - c[0], dv = p[1] - c[1]
        const h = light.out + set + (centre ? bow : 0)
        const gu = ta - (centre ? 0 : 2 * bow * du / R2), gv = tb - (centre ? 0 : 2 * bow * dv / R2)
        const n: V3 = [outward[0] - gu * along[0], outward[1] - gu * along[1], -gv]
        const l = Math.hypot(...n)
        glass.vertex(at(p[0], p[1], h), [n[0] / l, n[1] / l, n[2] / l], p, [seed, p[1] - v0], rims, borders)
      }
      const reach = (p: V2, a: V2, b: V2): number => {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1])
        return l > 1e-9 ? Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / l : 0
      }
      /** One triangle a-b-c; `ab`, `bc`, `ca` name which of its edges are
       * the quarry's own, where the lead runs. */
      const face = (a: V2, b: V2, cc: V2, ab: boolean, bc: boolean, ca: boolean, centreA: boolean): void => {
        const edge = (p: V2, q: V2, rim: boolean): number => rim && onOutline(p, q, outline) ? 1 : 0
        const borders = edge(a, b, ab) + 2 * edge(b, cc, bc) + 4 * edge(cc, a, ca)
        const far = (rim: boolean, d: number): number => rim ? d : 1, on = (rim: boolean): number => rim ? 0 : 1
        vertex(a, centreA, [on(ab), far(bc, reach(a, b, cc)), on(ca)], borders)
        vertex(b, false, [on(ab), on(bc), far(ca, reach(b, cc, a))], borders)
        vertex(cc, false, [far(ab, reach(cc, a, b)), on(bc), on(ca)], borders)
      }
      // At hero a fan from the centre carries the bow; the lighter tier
      // fans from a corner, half the triangles, the same drawn leading.
      const n = piece.length
      if (detail === 2) for (let k = 0; k < n; k++) face(c, piece[k]!, piece[(k + 1) % n]!, false, true, false, true)
      else for (let k = 1; k < n - 1; k++) face(piece[0]!, piece[k]!, piece[k + 1]!, k === 1, true, k === n - 2, false)
    }
    if (detail < 2) continue
    // THE CAMES stand proud of the glass on its outer face: a flattened
    // ridge, seven millimetres across, fourteen at the light's border, its
    // edges tucked behind the glass so only the lead shows where they cross.
    const norm = (n: V3): V3 => { const l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l] }
    const came = (p: V2, q: V2, width: number, rise: number): void => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (len < 1e-4) return
      // across the came, as a unit vector in the facade's own frame
      const au = -(q[1] - p[1]) / len, av = (q[0] - p[0]) / len
      const half = width / 2 * (rise + CAME_TUCK_M) / rise, slope = (rise + CAME_TUCK_M) / half
      const across: V3 = [along[0] * au, along[1] * au, av]
      const ridgeP = at(p[0], p[1], light.out + rise), ridgeQ = at(q[0], q[1], light.out + rise)
      for (const side of [1, -1]) {
        const e0 = at(p[0] + au * half * side, p[1] + av * half * side, light.out - CAME_TUCK_M)
        const e1 = at(q[0] + au * half * side, q[1] + av * half * side, light.out - CAME_TUCK_M)
        const n = norm([outward[0] + across[0] * side * slope, outward[1] + across[1] * side * slope, across[2] * side * slope])
        lead.tri(e0, e1, ridgeQ, n, [1, 0]); lead.tri(e0, ridgeQ, ridgeP, n, [1, 0])
      }
      cames++
    }
    if (built) {
      for (const [p, q] of lines) came(p, q, CAME_M, .0018)
      const middle = c0(outline)
      const inset = outline.map((p): V2 => [p[0] + (middle[0] - p[0]) * .003, p[1] + (middle[1] - p[1]) * .003])
      for (let i = 0; i < inset.length; i++) came(inset[i]!, inset[(i + 1) % inset.length]!, BORDER_CAME_M, .0022)
    }
    // Saddle bars are fixed on the inside, set into the jambs; from the
    // court they read as dark lines behind the glass.
    for (const height of light.bars) {
      const s = clipSegment([Math.min(...outline.map(p => p[0])) - .1, height], [Math.max(...outline.map(p => p[0])) + .1, height], outline)
      if (!s) continue
      const box = (u0: number, u1: number): void => {
        const back = light.out - .016, front = light.out - .004, half = .006
        const corners = (u: number): V3[] => [at(u, height - half, front), at(u, height + half, front), at(u, height + half, back), at(u, height - half, back)]
        const A = corners(u0 - .04), B = corners(u1 + .04)
        const faces: [V3, V3, V3, V3, V3][] = [
          [A[0]!, B[0]!, B[1]!, A[1]!, outward], [A[1]!, B[1]!, B[2]!, A[2]!, [0, 0, 1]], [A[3]!, B[3]!, B[0]!, A[0]!, [0, 0, -1]],
        ]
        for (const [a, b, c, d, n] of faces) { lead.tri(a, b, c, n, [0, 0]); lead.tri(a, c, d, n, [0, 0]) }
      }
      box(s[0][0], s[1][0])
    }
  }
  const group = new Group(); group.name = 'vinci/house-glazing'
  const meshes: Mesh[] = []
  if (glass.positions.length) {
    const mesh = new Mesh(glass.geometry(), glassMaterial(Boolean(built))); mesh.name = 'vinci/house-glazing/glass'
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 2; meshes.push(mesh)
  }
  if (lead.positions.length) {
    const mesh = new Mesh(lead.geometry(), cameMaterial()); mesh.name = 'vinci/house-glazing/lead'
    mesh.castShadow = false; mesh.receiveShadow = true; meshes.push(mesh)
  }
  for (const mesh of meshes) {
    mesh.userData['manifestId'] = houseGlazingProvenance.manifestId; mesh.userData['asset'] = houseGlazingProvenance.manifestId
    mesh.userData['labelOccluder'] = false
    group.add(mesh)
  }
  group.userData['manifestId'] = houseGlazingProvenance.manifestId
  const triangles = (glass.positions.length + lead.positions.length) / 9
  group.userData['triangles'] = triangles
  return { group, quarries, cames, triangles }
}
function c0(poly: V2[]): V2 { return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length] }

export const houseGlazingProvenance = {
  manifestId: 'vinci/house-glazing',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  recipe: 'Every glazed light of the registered shell holds 155 mm diamond quarries on a 45 degree lattice centred on the light. Each quarry is its own piece, its face tilted up to 1.5 degrees and bowed up to 0.8 mm, sending back the sky from both faces of the pane and each gathering or spreading it by its own bow, with a slow ripple in its surface, its edge held in the lead; 7 mm lead cames and a 14 mm border lead stand about 2 mm proud as geometry in the film and are drawn in the glass at the live tiers; iron saddle bars sit behind the glass. The glass reflects by its Fresnel term and transmits the rest, so the room behind shows through; a quarry mirroring the sun rolls off toward a ceiling under the sunlit stone round it, and the film draws the leading too wherever its built came is thinner than its pixel.',
} as const
