/* THE TERRACE'S GRAVEL AND THE COURT'S PAVING, AS SURFACE RECIPES.

   The terrace before the garden front is a walk of fine river gravel over
   packed earth, worn back to the earth where people walked and in patches,
   the gravel's gaps holding sand. The house's court is paved with river
   cobbles of the Loire set in sand: grey and cream limestone, ochre
   sandstone, blue-grey flint, each stone standing a little proud of its joint,
   the joints sanded, green with moss toward the damp wall feet and polished
   bare along the way from the gate to the door. Both are types of the
   period, never a record of what Cloux had; each scale is drawn only where a
   pixel can hold it and falls to its own mean where it cannot. No texture: a
   recipe that bakes to colour, height and roughness maps. */
import * as TSL from 'three/tsl'
import { Color } from 'three/webgpu'
import { polygon } from './site'
import { facadeDistance } from './foundation'
import { anisotropicFootprint } from './masonry-courses'

// TSL's overload types cannot follow graphs built from helpers; the cast is
// made once here and the nodes below stay readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, floor, fract, length, mix, mx_noise_float, mx_worley_noise_vec2, normalWorldGeometry, positionWorld,
  positionView, cameraViewMatrix, sin, smoothstep, vec2, vec3 } = TSL as unknown as Record<string, N>
/** the ground's own pixel, in metres */
const pixelOf = (P: N): N => anisotropicFootprint(P)
const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }

export const groundFinishProvenance = {
  manifestId: 'vinci/terrain',
  terrace: 'Conjectural terrace walk: fine river gravel 15 to 30 mm in cells, a sparse coarse stone of 50 to 90 mm, sand in the gaps, packed earth showing through in worn patches and along the walked middle. Surface recipe only; no height, outline or level of the dossier moves.',
  court: 'Conjectural cobbled court: Loire river cobbles about 50 to 60 mm across, of their own sizes, set in sand and standing up to 11 mm proud, worn flatter along the way from the gate to the door; limestone, sandstone and flint in colour; moss in the joints toward the damp wall feet. Beyond a kerb on the court\'s north-west edge, the walk before the house is flagged with pale limestone slabs about 0.9 by 0.6 m. Types of the period; surface recipes only; no height, outline or level moves.',
} as const

/** Signed distance to a convex outline given as (east, north) points,
    positive inside, in metres on the ground plane. */
function convexDistance(points: readonly number[][], p: N): N {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!
    area += a[0]! * b[1]! - b[0]! * a[1]!
  }
  const turn = area > 0 ? 1 : -1
  let d: N = float(1e4)
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!
    const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn)
    // inward normal of a counter-clockwise edge is its left
    const nx = -dn / span * turn, nn = dx / span * turn
    d = d.min(p.x.sub(a[0]!).mul(nx).add(p.y.sub(a[1]!).mul(nn)))
  }
  return d
}

/** Set stones on a plane: the distance to the nearest stone's centre and to
    the next one's, and the nearest stone's own two random draws. `p` is in
    stone cells, kept near the origin so the hash keeps its precision. */
function setStones(p: N, jitter: number): { f1: N; f2: N; a: N; b: N; offset: N } {
  const base = floor(p)
  let f1: N = float(8), f2: N = float(8), a: N = float(0), b: N = float(0), offset: N = vec2(0, 0)
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = base.add(vec2(dx, dy))
    const hx = fract(sin(c.dot(vec2(127.1, 311.7))).mul(43758.5453))
    const hy = fract(sin(c.dot(vec2(269.5, 183.3))).mul(43758.5453))
    const from = p.sub(c.add(vec2(hx, hy).sub(.5).mul(jitter).add(.5)))
    const d = length(from)
    const closer = d.lessThan(f1)
    f2 = closer.select(f1, f2.min(d))
    a = closer.select(hx, a)
    b = closer.select(hy, b)
    offset = closer.select(from, offset)
    f1 = f1.min(d)
  }
  return { f1, f2, a, b, offset }
}

/** The gravel and the cobbles laid over the earth material's own nodes.
    `shows(m)` is how resolved a scale of m metres is at this pixel. */
export function applyYardFinish(m: N, shows: (metres: number) => N): void {
  const P = positionWorld
  const ground = vec2(P.x, P.z.negate())
  const flat = smoothstep(.93, .985, normalWorldGeometry.y.abs())
  const terrace = convexDistance(polygon('terrace'), ground)
  const court = convexDistance(polygon('courtyard'), ground)
  // each finish only on its own level: the court at 0, the terrace at -1.9
  const onTerrace = smoothstep(-.02, .12, terrace).mul(float(1).sub(smoothstep(.03, .08, P.y.add(1.9).abs()))).mul(flat)
  const onCourt = smoothstep(-3.6, -3.2, court).mul(float(1).sub(smoothstep(.02, .05, P.y.abs()))).mul(flat)

  // ─── the terrace's gravel ────────────────────────────────────────────────
  const fine = mx_worley_noise_vec2(vec2(P.x, P.z).mul(1 / .021))
  const fineStone = smoothstep(.03, .38, fine.y.sub(fine.x)).mul(shows(.021))
  const fineDome = float(1).sub(fine.x.mul(fine.x)).clamp(0, 1)
  const coarse = mx_worley_noise_vec2(vec2(P.x, P.z).mul(1 / .068).add(vec2(13.1, 7.7)))
  const coarseLot = smoothstep(.62, .78, mx_noise_float(vec3(P.x, P.z, 3.7).mul(1 / .068 * .55)))
  const coarseStone = smoothstep(.04, .3, coarse.y.sub(coarse.x)).mul(coarseLot).mul(shows(.068))
  const coarseDome = float(1).sub(coarse.x.mul(coarse.x)).clamp(0, 1)
  // worn back to the earth in patches and along the walk's middle
  const worn = smoothstep(.35, .8, mx_noise_float(vec3(P.x, P.z, 1.3).mul(.55))).mul(shows(1.8)).mul(.55)
  const middle = float(1).sub(smoothstep(.6, 1.6, terrace.sub(2.6).abs()))
  const bare = worn.add(middle.mul(.35)).clamp(0, .8)
  const tone = mx_noise_float(vec3(P.x, P.z, 9.1).mul(1 / .021 * .7)).mul(.5).add(.5)
  const stoneColour = mix(mix(rgb('#b1a68f'), rgb('#8f887b'), smoothstep(.35, .65, tone)), rgb('#9d8664'),
    smoothstep(.72, .9, mx_noise_float(vec3(P.x, P.z, 5.5).mul(1 / .021 * .45))))
  const sand = rgb('#76695a')
  let gravel: N = mix(sand, stoneColour, fineStone.mul(.85).add(.15))
  gravel = mix(gravel, rgb('#a59b86').mul(tone.mul(.2).add(.9)), coarseStone.mul(.8))
  const gravelled = onTerrace.mul(float(1).sub(bare))
  m.colorNode = mix(m.colorNode, gravel, gravelled.mul(.92))
  const gravelHeight = fineDome.mul(fineStone).mul(.004).add(coarseDome.mul(coarseStone).mul(.009)).mul(gravelled)

  // ─── the court's cobbles, and the flags of the walk before the house ────
  // stones set a little longer along the court than across it
  const axis = polygon('courtyard'), a0 = axis[0]!, a1 = axis[1]!
  const along = Math.atan2(a1[1]! - a0[1]!, a1[0]! - a0[0]!)
  const ca = Math.cos(along), sa = Math.sin(along)
  const centre = axis.reduce((sum, q) => [sum[0]! + q[0]! / axis.length, sum[1]! + q[1]! / axis.length], [0, 0])
  const local = ground.sub(vec2(centre[0]!, centre[1]!))
  const u = local.x.mul(ca).add(local.y.mul(sa)), v = local.x.mul(-sa).add(local.y.mul(ca))
  // the flagged walk lies beyond the kerb on the court's north-west edge
  const onFlags = onCourt.mul(float(1).sub(smoothstep(-.14, -.1, court)))
  const onCobbles = onCourt.mul(smoothstep(.1, .14, court))
  // set stones are more even than a random scatter; about 58 by 46 mm
  const cellU = .058, cellV = .046
  const set = setStones(vec2(u.div(cellU), v.div(cellV)), .8)
  const cob = vec2(set.f1, set.f2)
  // a stone's edge is as sharp as the pixel lets it be: one pixel wide near
  // the eye, its own mean far off
  const edge = float(pixelOf(P)).div(cellV).mul(1.2).max(.015)
  // stones are not all one size: each its own radius, the sand between them
  // wider where a small one sits
  const radius = set.a.mul(.12).add(.44)
  const round = float(1).sub(smoothstep(radius.sub(edge), radius.add(edge), cob.x))
  const parted = smoothstep(edge.mul(.5), edge.mul(.5).add(.08), cob.y.sub(cob.x))
  const stone = round.mul(parted)
  const shown = shows(.05)
  const r = cob.x.div(radius).clamp(0, 1)
  // each stone set at its own height, its cap tipped a little its own way;
  // along the walked way the caps are worn flatter
  const toWall = facadeDistance()
  // from the gate to the foot of the door's steps
  const door = vec2(4.66, -14.06), gate = vec2(16.1, -18.9)
  const way = gate.sub(door), wayLength = length(way)
  const t = ground.sub(door).dot(way).div(wayLength.mul(wayLength)).clamp(0, 1)
  const offWay = length(ground.sub(door.add(way.mul(t))))
  const walked = float(1).sub(smoothstep(.6, 1.7, offWay))
  const tip = set.offset.dot(vec2(set.a.sub(.5), set.b.sub(.5))).mul(.55)
  const dome = float(1).sub(r.mul(r)).sqrt().mul(set.b.mul(.5).add(.6)).add(tip).max(0)
  const capped = dome.min(float(.72).sub(walked.mul(.22)))
  // one colour draw per stone, held close: Loire gravel, not a mosaic
  const pick = set.a, pick2 = set.b
  let cobble: N = mix(rgb('#958e7e'), rgb('#8d7a5f'), smoothstep(.5, .56, pick))
  cobble = mix(cobble, rgb('#6f6d69'), smoothstep(.78, .82, pick2))
  cobble = mix(cobble, rgb('#a9a191'), smoothstep(.94, .97, pick))
  cobble = cobble.mul(pick2.mul(.12).add(.94))
  // at arm's length a stone is not smooth: pits, grain, a darker lower ring
  // where the sand stains it
  const pits = smoothstep(.55, .8, mx_noise_float(vec3(P.x, P.z, 4.4).mul(220))).mul(shows(.004))
  const grainNear = mx_noise_float(vec3(P.x, P.z, 2.2).mul(130)).mul(shows(.008))
  const stain = smoothstep(.55, .95, r).mul(.14)
  cobble = cobble.mul(grainNear.mul(.08).add(1)).mul(float(1).sub(pits.mul(.2))).mul(float(1).sub(stain))
  // the joints: sand, greened toward the wall feet, bare where walked
  const damp = float(1).sub(smoothstep(.3, 2.4, toWall)).mul(float(1).sub(walked.mul(.8)))
  const moss = smoothstep(.2, .7, mx_noise_float(vec3(P.x, P.z, 6.6).mul(3.1)).add(damp.mul(.9))).mul(damp)
  const sandGrain = mx_noise_float(vec3(P.x, P.z, 7.3).mul(140)).mul(.1).mul(shows(.008)).add(1)
  const joint = mix(rgb('#7b705c').mul(sandGrain), rgb('#505c30'), moss.mul(.85))
  const paved = mix(joint, cobble.mul(walked.mul(.05).add(1)), stone.mul(shown).add(float(1).sub(shown).mul(.72)))
  m.colorNode = mix(m.colorNode, paved, onCobbles)
  const cobbleHeight = capped.mul(stone).mul(.011).mul(shown).mul(onCobbles)

  // the flags: pale limestone slabs about 0.9 by 0.6 m in courses along the
  // house, each its own tone, their joints sanded and green near the walls
  const fu = u.div(.9), fv = v.div(.6)
  const course = floor(fv), shiftU = fract(course.mul(.5)).mul(.9)
  const slab = floor(fu.add(shiftU))
  const inU = fract(fu.add(shiftU)), inV = fract(fv)
  const jointW = float(.008).div(.6).add(float(pixelOf(P)).div(.6))
  const flagJoint = float(1).sub(smoothstep(jointW.mul(.5), jointW, inU.min(inU.oneMinus()).mul(.6 / .9)).mul(smoothstep(jointW.mul(.5), jointW, inV.min(inV.oneMinus()))))
  const flagTone = fract(sin(slab.mul(12.9898).add(course.mul(78.233))).mul(43758.5453))
  let flag: N = mix(rgb('#a79f8c'), rgb('#9a9180'), flagTone).mul(mx_noise_float(vec3(P.x, P.z, 1.1).mul(3.5)).mul(.06).add(1))
  flag = flag.mul(grainNear.mul(.05).add(1)).mul(float(1).sub(pits.mul(.12)))
  const flagJointColour = mix(rgb('#6f6553'), rgb('#4c5830'), moss.mul(.9))
  m.colorNode = mix(m.colorNode, mix(flag, flagJointColour, flagJoint.mul(shows(.02))), onFlags)
  const flagHeight = flagJoint.mul(-.004).mul(shows(.02)).mul(onFlags)

  // ─── relief, occlusion and sheen of both ─────────────────────────────────
  const height = gravelHeight.add(cobbleHeight).add(flagHeight).toVar()
  const n = normalWorldGeometry.transformDirection(cameraViewMatrix)
  const sx = positionView.dFdx(), sy = positionView.dFdy(), rx = sy.cross(n), ry = n.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10))
  const bounded = gradient.div(length(gradient).div(.6).max(1))
  const finished = onTerrace.max(onCourt)
  m.normalNode = mix(m.normalNode, n.sub(bounded).normalize(), finished).normalize()
  const gaps = float(1).sub(fineStone).mul(onTerrace).mul(.28).add(float(1).sub(stone).mul(shown).mul(onCobbles).mul(.35)).add(flagJoint.mul(onFlags).mul(.3))
  m.aoNode = m.aoNode.mul(float(1).sub(gaps))
  const polished = walked.mul(stone).mul(onCobbles).mul(.2)
  m.roughnessNode = m.roughnessNode.sub(polished).sub(fineStone.mul(onTerrace).mul(.05))
  m.userData['yardFinish'] = groundFinishProvenance
}
