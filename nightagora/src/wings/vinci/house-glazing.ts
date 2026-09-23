/** Leaded glazing for every glazed light of the house.
 * Each quarry is its own piece of glass, a fraction off the plane of its
 * light and slightly bowed, so the sky and the court come back in broken
 * pieces. Lead cames and the saddle bars behind the glass are geometry.
 * The lights' outlines are the shell's own apertures; nothing is surveyed.
 */
import {
  AddEquation, BufferGeometry, CustomBlending, Float32BufferAttribute, Group, Mesh,
  MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, OneFactor, SrcAlphaFactor, ZeroFactor,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { hourKey } from './site'

// TSL's composable overloads are typed once at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, clamp, float, fract, mix, mx_fractal_noise_float, mx_noise_float, normalMap, normalView, positionViewDirection,
  reflectVector, smoothstep, uv, vec2, vec3 } = TSL as unknown as Record<string, N>
/** The hour's sun, for the side of the sky it warms. */
const SUN_AZ = hourKey.sun_azimuth_deg.value * Math.PI / 180
const SUN_EAST = Math.sin(SUN_AZ), SUN_NORTH = Math.cos(SUN_AZ)

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

class Sink {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; extra: number[] = []
  vertex(p: V3, n: V3, t: V2, e: [number, number]): void {
    this.positions.push(p[0], p[2], -p[1]); this.normals.push(n[0], n[2], -n[1]); this.uvs.push(t[0], t[1]); this.extra.push(e[0], e[1])
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
    g.setAttribute('glazing', new Float32BufferAttribute(this.extra, 2))
    g.computeBoundingSphere()
    return g
  }
}

/** Leaded glass that reflects the sky and lets the room behind it through.
 * Colour is what the glass reflects; alpha is what it transmits, so the
 * framebuffer takes reflection + room * transmission. */
function glassMaterial(): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial({ metalness: 0, roughness: .06, ior: 1.52, specularIntensity: 1, transparent: true, depthWrite: false })
  const info = attribute('glazing', 'vec2'), seed = info.x, sill = info.y
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
  m.colorNode = vec3(.60, .60, .55).mul(dust)
  m.roughnessNode = clamp(float(.07).add(seed.mul(.05)).add(dust.mul(.8)), .06, .18)
  const nDotV = clamp(normalView.dot(positionViewDirection), 0, 1)
  const fresnel = float(.043).add(float(1 - .043).mul(float(1).sub(nDotV).pow(5)))
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
  const seen = mix(ground, sky, smoothstep(-.006, .006, up))
  // each melt its own faint cast: greenish, straw or grey
  const melt = fract(seed.mul(7.31))
  const tint = mix(mix(vec3(.90, 1, .90), vec3(1, .97, .84), smoothstep(.3, .7, melt)), vec3(.95, .97, 1), smoothstep(.75, .95, melt))
  m.emissiveNode = seen.mul(fresnel).mul(float(1).sub(dust.mul(6))).mul(tint)
  // Old glass is faintly green and not quite clear; each quarry its own melt.
  const clear = mix(float(.62), float(.90), seed.mul(seed)).sub(dust.mul(2.4))
  m.opacityNode = clamp(clear.mul(float(1).sub(fresnel)), 0, 1)
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
  const info = attribute('glazing', 'vec2'), lead = info.x
  // Weathered lead is a soft grey oxide; the saddle bars are forged iron.
  m.colorNode = mix(vec3(.022, .021, .020), vec3(.090, .094, .092), lead)
  m.roughnessNode = mix(float(.62), float(.48), lead)
  m.name = 'vinci/house-glazing/lead'
  return m
}

export interface HouseGlazing { group: Group; quarries: number; cames: number; triangles: number }

/** `detail` 2 builds bowed quarries, cames and bars; 1 builds flat quarries. */
export function createHouseGlazing(lights: readonly GlazedLight[], detail: 1 | 2): HouseGlazing {
  const glass = new Sink(), lead = new Sink()
  let quarries = 0, cames = 0
  for (const light of lights) {
    const dx = (light.to[0] - light.from[0]) / light.length, dy = (light.to[1] - light.from[1]) / light.length
    const outward: V3 = [dy, -dx, 0], along: V3 = [dx, dy, 0]
    const at = (u: number, v: number, out: number): V3 => [light.from[0] + dx * u + dy * out, light.from[1] + dy * u - dx * out, v]
    const { pieces, lines } = lattice(light)
    const v0 = Math.min(...light.outline.map(p => p[1]))
    for (const piece of pieces) {
      quarries++
      const c: V2 = [piece.reduce((s, p) => s + p[0], 0) / piece.length, piece.reduce((s, p) => s + p[1], 0) / piece.length]
      const seed = rand(c[0] * 7.1 + light.from[0], c[1] * 3.3 + light.from[1], light.out)
      // A quarry is set a fraction of a degree off its neighbours and bows
      // by well under a millimetre; enough to break a reflected line.
      const ta = (rand(seed, 1.7) - .5) * .028, tb = (rand(seed, 2.9) - .5) * .028
      const set = (rand(seed, 4.3) - .5) * .0008, bow = detail === 2 ? (rand(seed, 6.1) > .5 ? 1 : -1) * (.0003 + rand(seed, 8.2) * .0005) : 0
      const R2 = Math.max(...piece.map(p => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2), 1e-6)
      const vertex = (p: V2, centre: boolean): void => {
        const du = p[0] - c[0], dv = p[1] - c[1]
        const h = light.out + set + ta * du + tb * dv + (centre ? bow : 0)
        const gu = ta - (centre ? 0 : 2 * bow * du / R2), gv = tb - (centre ? 0 : 2 * bow * dv / R2)
        const n: V3 = [outward[0] - gu * along[0], outward[1] - gu * along[1], -gv]
        const l = Math.hypot(...n)
        glass.vertex(at(p[0], p[1], h), [n[0] / l, n[1] / l, n[2] / l], p, [seed, p[1] - v0])
      }
      if (detail === 2) for (let k = 0; k < piece.length; k++) { vertex(c, true); vertex(piece[k]!, false); vertex(piece[(k + 1) % piece.length]!, false) }
      else for (let k = 1; k < piece.length - 1; k++) { vertex(piece[0]!, false); vertex(piece[k]!, false); vertex(piece[k + 1]!, false) }
    }
    if (detail < 2) continue
    // THE CAMES stand a little proud of the glass on its outer face: a
    // flattened ridge, seven millimetres across, ten at the light's border.
    const norm = (n: V3): V3 => { const l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l] }
    const came = (p: V2, q: V2, width: number, rise: number): void => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (len < 1e-4) return
      // across the came, as a unit vector in the facade's own frame
      const au = -(q[1] - p[1]) / len, av = (q[0] - p[0]) / len, half = width / 2, slope = rise / half
      const across: V3 = [along[0] * au, along[1] * au, av]
      const ridgeP = at(p[0], p[1], light.out + rise), ridgeQ = at(q[0], q[1], light.out + rise)
      for (const side of [1, -1]) {
        const e0 = at(p[0] + au * half * side, p[1] + av * half * side, light.out + .0003)
        const e1 = at(q[0] + au * half * side, q[1] + av * half * side, light.out + .0003)
        const n = norm([outward[0] + across[0] * side * slope, outward[1] + across[1] * side * slope, across[2] * side * slope])
        lead.tri(e0, e1, ridgeQ, n, [1, 0]); lead.tri(e0, ridgeQ, ridgeP, n, [1, 0])
      }
      cames++
    }
    for (const [p, q] of lines) came(p, q, CAME_M, .0018)
    const outline = ccw(light.outline), middle = c0(outline)
    const inset = outline.map((p): V2 => [p[0] + (middle[0] - p[0]) * .003, p[1] + (middle[1] - p[1]) * .003])
    for (let i = 0; i < inset.length; i++) came(inset[i]!, inset[(i + 1) % inset.length]!, BORDER_CAME_M, .0022)
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
    const mesh = new Mesh(glass.geometry(), glassMaterial()); mesh.name = 'vinci/house-glazing/glass'
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
  recipe: 'Every glazed light of the registered shell holds 155 mm diamond quarries on a 45 degree lattice centred on the light. Each quarry is its own piece, tilted up to 1 degree and bowed up to 0.8 mm, with a slow ripple in its surface; 7 mm lead cames and a 10 mm border lead stand 2 mm proud; iron saddle bars sit behind the glass. The glass reflects by its Fresnel term and transmits the rest, so the room behind shows through.',
} as const
