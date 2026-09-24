/* THE RETAINING WALLS IN THE LOW SUN.

   The terrace wall faces the sun of the hour almost square, so a recessed
   joint hides about a millimetre of itself: joints cannot draw its courses.
   What draws a weathered wall in that light is its stones' own arrises, worn
   round over a few centimetres: the lower one turns down, away from a sun
   seventeen degrees up, the upper one turns to the sky. Under the coping the
   overhang throws its drip shadow and hides part of the sky. Engine-only
   light terms, as the house's joints are: the film's geometry casts them. */
import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lineCoverage, type CourseRecipe } from '../../stack/detail'
import { COPING, copingRuns } from './copings'
import { hourKey } from './site'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, cos, faceDirection, float, floor, fract, normalWorldGeometry, positionWorld, sin, smoothstep, vec2, vec3 } =
  TSL as unknown as Record<string, N>

/** toward the sun of the hour, world frame (x east, y up, z south) */
export const SUN_TOWARD = ((azimuth: number, elevation: number) => {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})(hourKey.sun_azimuth_deg.value, hourKey.sun_elevation_deg.value)

/** the laid module of the retaining walls, shared by their colour and their light */
export const RETAINING_COURSES = { courseM: .30, blockM: .62, jointM: .015, seed: 7.31 } as const

/** Mark each vertical retaining triangle whose head carries a coping with the
    height of the coping's underside (`copingUnder`, -99 where none). */
export function copingUndersides(geometry: BufferGeometry): void {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  const under = new Float32Array(p.count).fill(-99)
  const runs = copingRuns()
  for (let i = 0; i + 2 < p.count; i += 3) {
    if (Math.abs(n.getY(i)) > .5) continue
    let top = -Infinity
    for (let c = 0; c < 3; c++) top = Math.max(top, p.getY(i + c))
    let e = 0, north = 0, k = 0
    for (let c = 0; c < 3; c++) if (p.getY(i + c) > top - .01) { e += p.getX(i + c); north -= p.getZ(i + c); k++ }
    e /= k; north /= k
    for (const r of runs) {
      if (Math.abs(r.level - top) > .06) continue
      const dx = r.to[0] - r.from[0], dn = r.to[1] - r.from[1], len = Math.hypot(dx, dn)
      const ux = dx / len, un = dn / len, qx = e - r.from[0], qn = north - r.from[1]
      const along = qx * ux + qn * un, off = Math.abs(qn * ux - qx * un)
      if (along < -.05 || along > len + .05 || off > .05) continue
      under[i] = under[i + 1] = under[i + 2] = r.level + COPING.proud - COPING.depth
      break
    }
  }
  geometry.setAttribute('copingUnder', new Float32BufferAttribute(under, 1))
}

const hash = (a: N, b: N, salt: number): N => fract(a.mul(31.17).add(b.mul(13.713)).add(salt).sin().mul(4317.1))

/** The direct sun a retaining face takes, as a factor on its received shadow,
    and the sky it sees, as a factor on its occlusion. `U` is the face's own
    metres (along, up), as the material lays its courses in. */
export function wallInTheSun(U: N, recipe: CourseRecipe, vertical: N): { direct: N; sky: N } {
  const r = recipe, P = positionWorld
  const s = vec3(SUN_TOWARD[0], SUN_TOWARD[1], SUN_TOWARD[2]), sunUp = float(SUN_TOWARD[1])
  const n = normalWorldGeometry, flat = vec2(n.x, n.z)
  const outward = flat.div(flat.length().max(1e-5)).mul(faceDirection)
  const sunN = outward.x.mul(s.x).add(outward.y.mul(s.z))
  // the face's own along axis, the one the courses are laid on
  const t = vec2(n.z, n.x.negate()).div(flat.length().max(1e-5))
  const sunAlong = t.x.mul(s.x).add(t.y.mul(s.z))
  // THE COURSE AND THE BLOCK, as the material lays them
  const wave = (Math.PI * 2) / r.courseWaveM
  const phase = U.y.div(r.courseM).add(sin(U.y.mul(wave)).mul(r.courseSwing))
  const slope = float(1 / r.courseM).add(cos(U.y.mul(wave)).mul(r.courseSwing * wave)).max(.2)
  const row = floor(phase), f = fract(phase), period = float(1).div(slope)
  const down = f.div(slope), up = float(1).sub(f).div(slope)
  const length_ = float(r.blockM).mul(hash(row, float(0), r.seed).sub(.5).mul(r.blockSwing).add(1))
  const g = fract(U.x.div(length_).add(hash(row, float(1), r.seed + 5.1)))
  const left = g.mul(length_), right = float(1).sub(g).mul(length_)
  // no two stones worn alike: some arrises still sharp, some gone round
  const block = hash(row, floor(U.x.div(length_).add(hash(row, float(1), r.seed + 5.1))), r.seed + 23.9)
  const wear = fract(block.mul(17.13)), lean = fract(block.mul(41.7))
  const across = vec2(U.y.dFdx(), U.y.dFdy()).length().max(2e-5), alongPx = vec2(U.x.dFdx(), U.x.dFdy()).length().max(2e-5)
  // each arris worn round over one to five centimetres, leaning twenty to forty-two degrees
  const worn = wear.mul(wear).mul(.04).add(.006), half = worn.mul(.5), mid = half.add(r.jointM / 2)
  const tilt = lean.mul(.42).add(.32), c = cos(tilt), sn = sin(tilt)
  const bottom = lineCoverage(down.sub(mid), half, period, across)
  const topArris = lineCoverage(up.sub(mid), half, period, across)
  const leftArris = lineCoverage(left.sub(mid), half, length_, alongPx)
  const rightArris = lineCoverage(right.sub(mid), half, length_, alongPx)
  const lit = sunN.max(.02)
  const gain = (toward: N): N => sunN.mul(c).add(toward.mul(sn)).max(0).div(lit)
  const facing = smoothstep(.02, .08, sunN).mul(vertical)
  const arris = float(1)
    .add(bottom.mul(gain(sunUp.negate()).sub(1)))
    .add(topArris.mul(gain(sunUp).sub(1)))
    .add(leftArris.mul(gain(sunAlong.negate()).sub(1)))
    .add(rightArris.mul(gain(sunAlong).sub(1)))
  // THE COPING'S DRIP: the overhang shades the face for as far below its
  // underside as the sun climbs over its width
  const under = attribute('copingUnder', 'float')
  const coped = smoothstep(-50, -40, under).mul(vertical)
  const below = under.sub(P.y)
  const dripH = float(COPING.outer).mul(sunUp).div(lit).min(.3)
  const pixelY = vec2(P.y.dFdx(), P.y.dFdy()).length().max(2e-5)
  const drip = lineCoverage(below.sub(dripH.mul(.5)), dripH.mul(.5), 1000, pixelY).mul(coped).mul(smoothstep(0, .02, sunN))
  const direct = float(1).add(arris.sub(1).mul(facing)).mul(float(1).sub(drip))
  // the sky: the overhang hides the upper sky from the face just under it,
  // an arris turned down sees less of it and one turned up more
  const hidden = float(1).sub(below.max(0).div(below.max(0).mul(below.max(0)).add(COPING.outer * COPING.outer).sqrt()))
  const sky = float(1).sub(hidden.mul(.5).mul(coped).mul(smoothstep(-.005, 0, below)))
    .mul(float(1).sub(bottom.mul(.22).mul(vertical))).mul(float(1).add(topArris.mul(.08).mul(vertical)))
  return { direct, sky }
}

/** THE EDGE THE SUN DRAWS. The shadow map's filter spreads an edge over three
    of its texels, a quarter metre in the far cascade, where the sun's own
    penumbra behind a tree or a roof ten to fifteen metres off is about half
    that: the filtered edge is drawn in to that width. */
export function sunEdge(shadow: N): N {
  return smoothstep(.22, .78, shadow)
}
