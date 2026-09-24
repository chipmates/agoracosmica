/* THE TERRACE'S GRAVEL AND THE COURT'S PAVING, AS SURFACE RECIPES.

   The terrace before the garden front is a walk of fine river gravel over
   packed earth, worn back to the earth where people walked and in patches,
   the gravel's gaps holding sand. The house's court is paved with river
   cobbles of the Loire set in sand: grey and cream limestone, ochre
   sandstone, blue-grey flint, each stone standing a little proud of its joint,
   the joints sanded, green with moss toward the damp wall feet and polished
   bare along the way from the gate to the door. Both are types of the
   period, never a record of what Cloux had; each scale is drawn only where a
   pixel can hold it and falls to its own mean where it cannot. The gravel's
   stones are baked from their recipe into one tile (`gravel-maps.ts`) that
   the sampler filters; the cobbles and flags stay recipes in the shader. */
import * as TSL from 'three/tsl'
import { Color } from 'three/webgpu'
import { polygon } from './site'
import { facadeDistance } from './foundation'
import { anisotropicFootprint } from './masonry-courses'
import { specularAA } from '../../stack/detail'
import { GRAVEL_HEIGHT_M, GRAVEL_SLOPE_RANGE, GRAVEL_TILE_M, gravelMaps } from './gravel-maps'

// TSL's overload types cannot follow graphs built from helpers; the cast is
// made once here and the nodes below stay readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, floor, fract, length, mix, mx_noise_float, normalWorldGeometry, positionWorld,
  positionView, cameraViewMatrix, sin, smoothstep, texture, vec2, vec3 } = TSL as unknown as Record<string, N>
/** the ground's own pixel, in metres */
const pixelOf = (P: N): N => anisotropicFootprint(P)
const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }

export const groundFinishProvenance = {
  manifestId: 'vinci/terrain',
  terrace: 'Conjectural terrace walk: fine river gravel 15 to 30 mm in cells, a sparse coarse stone of 50 to 90 mm, sand in the gaps, packed earth showing through in worn patches and along the walked middle. Surface recipe only; no height, outline or level of the dossier moves.',
  court: 'Conjectural cobbled court: Loire river cobbles about 40 to 65 mm across, of their own sizes, set in sand and standing up to 11 mm proud, worn flatter along the way from the gate to the door; limestone, sandstone and flint in colour; moss in the joints toward the damp wall feet. Beyond a kerb on the court\'s north-west edge, the walk before the house is flagged with pale limestone slabs about 0.9 by 0.6 m. Types of the period; surface recipes only; no height, outline or level moves.',
} as const

/** mip levels the gravel is read above its pixel, the share of the tile's
    colour contrast kept, and of its relief */
const GRAVEL_BIAS = 1.25, GRAVEL_CONTRAST = .5, GRAVEL_RELIEF = .6
/** the tile turned off the lane's axis */
const TILE_COS = Math.cos(.61), TILE_SIN = Math.sin(.61)
/** the terrace walk's own frame: its middle line from the south-east end,
    in (east, north), its half width and the rise of its crown, in metres */
const LANE = (() => {
  const [a, b, c, d] = polygon('terrace') as [[number, number], [number, number], [number, number], [number, number]]
  const start = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], end = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]
  const span = Math.hypot(end[0]! - start[0]!, end[1]! - start[1]!)
  const along = [(end[0]! - start[0]!) / span, (end[1]! - start[1]!) / span]
  return { origin: start, along, across: [along[1]!, -along[0]!], half: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, crown: .035 }
})()

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
  // A STONE IS ROUND, SO IT IS RESOLVED ONLY WHEN THE PIXEL'S LONG AXIS HOLDS
  // IT. A ground running away from the eye has a pixel metres long in depth
  // and centimetres across; gated on the short axis, a field of stones is
  // drawn at full strength where every pixel spans several of them in depth,
  // and that is what glitters as the eye moves. Pattern and relief of the
  // round scales are gated on the long axis, the relief later than the tone.
  const long = length(P.dFdx()).max(length(P.dFdy())).max(1e-5)
  const held = (metres: number | N, from: number, to: number): N => smoothstep(from, to, (typeof metres === 'number' ? float(metres) : metres).div(long))
  const drawn = (metres: number): N => held(metres, 2, 4.5)
  const raised = (metres: number): N => held(metres, 4, 9)

  // ─── the terrace's gravel ────────────────────────────────────────────────
  // THE STONES ARE A BAKED TILE, FILTERED BY THE SAMPLER, NEVER FADED: the
  // mips carry each scale's mean and the anisotropic taps a grazing pixel's
  // length, so the grain holds as far as a pixel can see it and settles to
  // its own mean and roughness beyond. Turned off the lane's axis and bent a
  // little, so the tile's repeat never lines up with the kerbs.
  const tileMaps = gravelMaps()
  const bend = vec2(mx_noise_float(vec3(P.x.mul(.19), P.z.mul(.19), 4.1)), mx_noise_float(vec3(P.x.mul(.19), P.z.mul(.19), 9.7))).mul(.06)
  const gx = P.x.add(bend.x), gz = P.z.add(bend.y)
  const tileAt = vec2(gx.mul(TILE_COS).add(gz.mul(TILE_SIN)), gz.mul(TILE_COS).sub(gx.mul(TILE_SIN))).div(GRAVEL_TILE_M)
  // the lane's own frame: across from its middle line and along from its
  // south-east end, in metres
  const fromEnd = ground.sub(vec2(LANE.origin[0], LANE.origin[1]))
  const across = fromEnd.dot(vec2(LANE.across[0], LANE.across[1]))
  const alongLane = fromEnd.dot(vec2(LANE.along[0], LANE.along[1]))
  // loose stones rolled to the kerbs: the same gravel read larger along both
  // edges, in a ragged strip
  const toKerb = float(LANE.half).sub(across.abs())
  const kerbStones = float(1).sub(smoothstep(.12, .5, toKerb.add(mx_noise_float(vec3(P.x, P.z, 7.7).mul(2.3)).mul(.16)))).mul(onTerrace)
  const kerbAt = tileAt.div(2.1).add(vec2(.37, .61))
  // read a little wider than the pixel: a stone's edge that a walking eye
  // sweeps over settles instead of stepping (the moment map keeps the slope)
  const read = (map: N, at: N): N => texture(map, at).bias(GRAVEL_BIAS)
  const fineMap = read(tileMaps.albedo, tileAt), fineRelief = read(tileMaps.relief, tileAt)
  const kerbMap = read(tileMaps.albedo, kerbAt), kerbRelief = read(tileMaps.relief, kerbAt)
  // a limestone gravel is pale stone in a pale matrix: its grain is held at
  // this share of the tile's own contrast about the tile's mean
  const tileMean = texture(tileMaps.albedo, vec2(.5, .5)).level(10).rgb
  const stonesColour = mix(tileMean, mix(fineMap.rgb, kerbMap.rgb, kerbStones), GRAVEL_CONTRAST)
  const laneRelief = mix(fineRelief, kerbRelief, kerbStones)
  // the slope's mean in the tile's frame, turned back onto the ground
  const tileSlope = laneRelief.xy.mul(2 * GRAVEL_SLOPE_RANGE).sub(GRAVEL_SLOPE_RANGE).mul(GRAVEL_RELIEF)
  const stoneSlope = vec2(tileSlope.x.mul(TILE_COS).sub(tileSlope.y.mul(TILE_SIN)), tileSlope.x.mul(TILE_SIN).add(tileSlope.y.mul(TILE_COS)))
  // what the mip averaged away of the slope: second moment less mean squared
  const stoneVariance = laneRelief.z.mul(GRAVEL_SLOPE_RANGE * GRAVEL_SLOPE_RANGE * GRAVEL_RELIEF * GRAVEL_RELIEF).sub(tileSlope.dot(tileSlope)).max(0)
  const stoneHeight = laneRelief.w.mul(GRAVEL_HEIGHT_M).mul(kerbStones.mul(1.3).add(1))
  // A WALK THAT CARTS HAVE USED: two tracks a hand-cart's width apart, off the
  // middle and wandering, each a groove with the gravel pushed up in a lip on
  // either side, the floor packed to fines; the walk crowned to shed water.
  const wander = mx_noise_float(vec3(alongLane.mul(.16), 3.3, 1.9)).mul(.13)
  const lie0 = across.sub(float(-.22).add(wander))
  const inRuts = smoothstep(.15, .55, mx_noise_float(vec3(alongLane.mul(.21), 8.1, 2.6)).add(.3)).mul(smoothstep(.6, 2.2, alongLane))
  const rutW = .055, lipAt = .115, lipW = .038, rutD = .012, lipH = .006
  const groove = (t: N): { h: N; dh: N } => {
    const g = t.div(rutW), a = t.abs().sub(lipAt).div(lipW)
    const floorG = TSL.exp(g.mul(g).negate()), lipG = TSL.exp(a.mul(a).negate())
    return {
      h: floorG.mul(-rutD).add(lipG.mul(lipH)),
      dh: floorG.mul(g.mul(2 * rutD / rutW)).add(lipG.mul(a.mul(-2 * lipH / lipW)).mul(TSL.sign(t))),
    }
  }
  const r1 = groove(lie0.sub(.53)), r2 = groove(lie0.add(.53))
  // a groove is a line: it is held while the pixel ACROSS it can draw its lip
  const acrossPixel = length(vec2(across.dFdx(), across.dFdy())).max(1e-5)
  const rutHeld = smoothstep(2, 4, float(lipW).div(acrossPixel))
  const floorOf = (t: N): N => TSL.exp(t.div(rutW * 1.3).pow(2).negate())
  const lipOf = (t: N): N => TSL.exp(t.abs().sub(lipAt).div(lipW).pow(2).negate())
  const rutFloor = floorOf(lie0.sub(.53)).add(floorOf(lie0.add(.53))).mul(inRuts)
  const rutLips = lipOf(lie0.sub(.53)).add(lipOf(lie0.add(.53))).mul(inRuts)
  const rutSlope = r1.dh.add(r2.dh).mul(inRuts)
  const crownSlope = across.mul(-2 * LANE.crown / (LANE.half * LANE.half))
  const laneSlope = rutSlope.mul(rutHeld).add(crownSlope)
  // the slope the rut's gate took away is spread into the sheen
  const rutLost = rutSlope.abs().mul(float(1).sub(rutHeld)).mul(.7)
  // worn back to the earth in patches and along the walk's middle, and the
  // tracks' floor packed to fines
  const worn = smoothstep(.35, .8, mx_noise_float(vec3(P.x, P.z, 1.3).mul(.55))).mul(shows(1.8)).mul(.55)
  const middle = float(1).sub(smoothstep(.6, 1.6, terrace.sub(2.6).abs()))
  const bare = worn.add(middle.mul(.35)).clamp(0, .8)
  const sand = rgb('#76695a')
  // what the eye reads of a gravel walk beyond arm's length is not the stones
  // but their lie: thicker and thinner in drifts a hand to a stride across
  const lie = mx_noise_float(vec3(P.x, P.z, 6.1).mul(1 / .22)).mul(drawn(.22))
  // the kerbs' feet hold damp and fines: a darker gutter each side
  const gutter = float(1).sub(smoothstep(.05, .5, toKerb)).mul(onTerrace)
  let gravel: N = stonesColour.mul(lie.mul(.1).add(1)).mul(float(1).sub(gutter.mul(.14)))
  // the tracks' floor is packed fines holding the night's damp, the gravel
  // they pushed aside lies a little thicker and paler on their lips
  gravel = mix(gravel, rgb('#665a4a'), rutFloor.mul(rutHeld).mul(.5)).mul(rutLips.mul(rutHeld).mul(.07).add(1))
  const gravelled = onTerrace.mul(float(1).sub(bare))
  m.colorNode = mix(m.colorNode, gravel, gravelled.mul(.92))
  const flattened = float(1).sub(bare.mul(.8)).mul(float(1).sub(rutFloor.mul(rutHeld).mul(.6)))
  const terraceSlope = stoneSlope.mul(flattened).add(laneSlope)
  const terraceVariance = stoneVariance.mul(flattened.mul(flattened))
  const terraceNormal = vec3(terraceSlope.x.negate(), 1, terraceSlope.y.negate()).normalize().transformDirection(cameraViewMatrix)

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
  // SET BY HAND, NOT ON A GRID. About 58 by 46 mm a cell, the rows wandering
  // as a paver's rows wander, each stone packed against its neighbours with
  // its own long axis, its own turn and its own size: about 40 to 65 mm.
  const cellU = .058, cellV = .046
  const drift = vec2(mx_noise_float(vec3(u.mul(1.1), v.mul(1.1), 2.3)), mx_noise_float(vec3(u.mul(1.1), v.mul(1.1), 8.9))).mul(.45)
  const set = setStones(vec2(u.div(cellU), v.div(cellV)).add(drift), .78)
  const turn = set.b.mul(6.2832), squash = set.a.mul(.32).add(.82)
  const ct = TSL.cos(turn), st = TSL.sin(turn)
  const ox = set.offset.x.mul(ct).add(set.offset.y.mul(st)), oy = set.offset.y.mul(ct).sub(set.offset.x.mul(st))
  const radius = set.a.mul(.12).add(.52)
  const reach = length(vec2(ox.div(squash), oy.mul(squash)))
  // how far inside its stone a point stands, in cells: the smaller of the
  // stone's own round and the half-way line to the next stone, less a joint
  const inside = radius.sub(reach).min(set.f2.sub(set.f1).mul(.5).sub(.035)).sub(reach.mul(reach).mul(.06))
  // a stone's edge is as sharp as the pixel lets it be
  const edge = long.div(cellV).mul(1.6).max(.012)
  const stoneShape = smoothstep(edge.negate(), edge, inside)
  const shown = drawn(.05)
  // where the pixel cannot hold a stone the court keeps its stones' share
  const stone = mix(float(.8), stoneShape, shown)
  const relief = raised(.05)
  // each stone domed from its own edge, its cap tipped a little its own way;
  // along the walked way the caps are worn flatter
  const toWall = facadeDistance()
  // from the gate to the foot of the door's steps
  const door = vec2(4.66, -14.06), gate = vec2(16.1, -18.9)
  const way = gate.sub(door), wayLength = length(way)
  const t = ground.sub(door).dot(way).div(wayLength.mul(wayLength)).clamp(0, 1)
  const offWay = length(ground.sub(door.add(way.mul(t))))
  const walked = float(1).sub(smoothstep(.6, 1.7, offWay))
  const rise = inside.div(radius.mul(.55)).clamp(0, 1)
  const tip = set.offset.dot(vec2(set.a.sub(.5), set.b.sub(.5))).mul(.35)
  const dome = float(1).sub(float(1).sub(rise).pow(2)).mul(set.b.mul(.45).add(.65)).add(tip.mul(rise)).max(0)
  const capped = dome.min(float(.8).sub(walked.mul(.25)))
  // one colour draw per stone, held close: Loire gravel, not a mosaic
  const pick = set.a, pick2 = set.b
  let cobble: N = mix(rgb('#958e7e'), rgb('#8d7a5f'), smoothstep(.5, .56, pick))
  cobble = mix(cobble, rgb('#6f6d69'), smoothstep(.78, .82, pick2))
  cobble = mix(cobble, rgb('#a9a191'), smoothstep(.94, .97, pick))
  cobble = cobble.mul(pick2.mul(.12).add(.94))
  // at arm's length a stone is not smooth: pits, grain, a limestone's vein,
  // a darker foot where the sand stains it
  const pits = smoothstep(.55, .8, mx_noise_float(vec3(P.x, P.z, 4.4).mul(220))).mul(drawn(.004))
  const grainNear = mx_noise_float(vec3(P.x, P.z, 2.2).mul(130)).mul(drawn(.008))
  const veinAt = vec2(ox, oy).dot(vec2(TSL.cos(set.a.mul(9.1)), TSL.sin(set.a.mul(9.1))))
  const vein = float(1).sub(smoothstep(.0, .035, mx_noise_float(vec3(veinAt.mul(9), set.b.mul(40), 1.7)).abs()))
    .mul(smoothstep(.6, .7, pick2)).mul(drawn(.004))
  const stain = float(1).sub(rise).pow(2).mul(.27)
  cobble = cobble.mul(grainNear.mul(.08).add(1)).mul(float(1).sub(pits.mul(.2))).mul(float(1).sub(stain.mul(shown)))
    .mul(float(1).sub(vein.mul(.14)))
  // the joints: sand, darker down between the stones, greened toward the
  // wall feet, bare where walked
  const damp = float(1).sub(smoothstep(.3, 2.4, toWall)).mul(float(1).sub(walked.mul(.8)))
  const moss = smoothstep(.2, .7, mx_noise_float(vec3(P.x, P.z, 6.6).mul(3.1)).add(damp.mul(.9))).mul(damp)
  const sandGrain = mx_noise_float(vec3(P.x, P.z, 7.3).mul(140)).mul(.1).mul(drawn(.008)).add(1)
  const deep = smoothstep(.08, 0, inside.negate()).mul(shown)
  const joint = mix(rgb('#7b705c').mul(sandGrain), rgb('#505c30'), moss.mul(.85)).mul(float(1).sub(deep.mul(.26)))
  const paved = mix(joint, cobble.mul(walked.mul(.05).add(1)), stone)
  m.colorNode = mix(m.colorNode, paved, onCobbles)
  const cobbleHeight = capped.mul(stoneShape).mul(.014).mul(relief).mul(onCobbles)

  // the flags: pale limestone slabs about 0.9 by 0.6 m in courses along the
  // house, each its own tone and its own bed of grain, worn on the walk to
  // the door and at the arrises, their joints sanded and green near the walls
  const fu = u.div(.9), fv = v.div(.6)
  const course = floor(fv), shiftU = fract(course.mul(.5)).mul(.9)
  const slab = floor(fu.add(shiftU))
  const inU = fract(fu.add(shiftU)), inV = fract(fv)
  const pixelOfP = pixelOf(P)
  const jointW = float(.008).div(.6).add(float(pixelOfP).div(.6))
  const flagJoint = float(1).sub(smoothstep(jointW.mul(.5), jointW, inU.min(inU.oneMinus()).mul(.6 / .9)).mul(smoothstep(jointW.mul(.5), jointW, inV.min(inV.oneMinus()))))
  const flagTone = fract(sin(slab.mul(12.9898).add(course.mul(78.233))).mul(43758.5453))
  const flagTurn = fract(sin(slab.mul(39.3468).add(course.mul(11.135))).mul(24634.6345)).mul(3.1416)
  // the bedding of the stone: a fine banding at the slab's own angle
  const bedAt = u.mul(TSL.cos(flagTurn)).add(v.mul(TSL.sin(flagTurn)))
  const bedding = mx_noise_float(vec3(bedAt.mul(38), bedAt.mul(3.1), flagTone.mul(17))).mul(held(.012, 2, 4))
  const arris = float(1).sub(smoothstep(0, .07, inU.min(inU.oneMinus()).mul(.9).min(inV.min(inV.oneMinus()).mul(.6)))).mul(held(.05, 2, 4))
  let flag: N = mix(rgb('#a79f8c'), rgb('#9a9180'), flagTone).mul(mx_noise_float(vec3(P.x, P.z, 1.1).mul(3.5)).mul(.06).add(1))
  flag = flag.mul(grainNear.mul(.05).add(1)).mul(float(1).sub(pits.mul(.12))).mul(bedding.mul(.07).add(1))
    .mul(float(1).add(walked.mul(.05))).mul(float(1).sub(arris.mul(.08)))
  const flagJointColour = mix(rgb('#6f6553'), rgb('#4c5830'), moss.mul(.9))
  m.colorNode = mix(m.colorNode, mix(flag, flagJointColour, flagJoint.mul(shows(.02))), onFlags)
  const flagHeight = flagJoint.mul(-.004).mul(shows(.02)).add(arris.mul(-.0015)).mul(onFlags)

  // ─── relief, occlusion and sheen of both ─────────────────────────────────
  const height = cobbleHeight.add(flagHeight).toVar()
  const n = normalWorldGeometry.transformDirection(cameraViewMatrix)
  const sx = positionView.dFdx(), sy = positionView.dFdy(), rx = sy.cross(n), ry = n.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10))
  const bounded = gradient.div(length(gradient).div(.6).max(1)).toVar()
  m.normalNode = mix(m.normalNode, n.sub(bounded).normalize(), onCourt).normalize()
  m.normalNode = mix(m.normalNode, terraceNormal, onTerrace).normalize()
  const gaps = float(1).sub(stoneHeight.div(GRAVEL_HEIGHT_M * .45).clamp(0, 1)).mul(gravelled).mul(.26)
    .add(rutFloor.mul(onTerrace).mul(.1)).add(float(1).sub(stone).mul(onCobbles).mul(.35)).add(flagJoint.mul(onFlags).mul(.3))
  m.aoNode = m.aoNode.mul(float(1).sub(gaps))
  const polished = walked.mul(stone).mul(onCobbles).mul(.2).mul(relief)
  // THE SHEEN FOLLOWS THE RELIEF IT LOST: where a stone's slope is under the
  // pixel, its highlight is spread over the pixel instead of flashing in it
  const lostSlope = float(1).sub(relief).mul(onCobbles).mul(.5).add(length(bounded).mul(.35).mul(onCourt))
    .add(terraceVariance.mul(.5).sqrt().add(rutLost).mul(onTerrace))
  const finished = onTerrace.max(onCourt)
  m.roughnessNode = specularAA(m.roughnessNode.sub(polished).sub(gravelled.mul(.05)).clamp(.05, 1), lostSlope.mul(finished))
  m.userData['yardFinish'] = groundFinishProvenance
}
