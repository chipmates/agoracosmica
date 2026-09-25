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
import { hourKey, polygon } from './site'
import { facadeDistance } from './foundation'
import { anisotropicFootprint } from './masonry-courses'
import { specularAA } from '../../stack/detail'
import { flagFace } from './court-flags'
import { GRAVEL_HEIGHT_M, GRAVEL_SLOPE_RANGE, GRAVEL_TILE_M, gravelMaps } from './gravel-maps'
import { courtWear } from './inner-court'

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
  court: 'Conjectural cobbled court: Loire river cobbles about 40 to 65 mm across, of their own sizes, set in sand in wandering courses and standing up to 11 mm proud, a few sunk or lost, falling to a gutter of stones set lengthwise down the middle of the court, worn flatter and paler along the way from the gate to the door; limestone, sandstone and flint in colour; moss in the joints toward the damp wall feet. Beyond a kerb on the court\'s north-west edge, the walk before the house is flagged with pale limestone slabs about 0.9 by 0.6 m. Types of the period; surface recipes only; no height, outline or level moves.',
} as const

/** mip levels the gravel is read above its pixel, the share of the tile's
    colour contrast kept, and of its relief */
const GRAVEL_BIAS = 1.25, GRAVEL_CONTRAST = .5, GRAVEL_RELIEF = .6
/** the low sun of the hour: its elevation, and the share of its bearing
    that crosses the terrace walk (toward the walk's across axis) */
const SUN_EL = hourKey.sun_elevation_deg.value * Math.PI / 180
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
const SUN_ACROSS = (() => {
  const az = hourKey.sun_azimuth_deg.value * Math.PI / 180
  return Math.sin(az) * LANE.across[0]! + Math.cos(az) * LANE.across[1]!
})()

/** THE ROAD'S CHIP. A carted earth road is packed fines with stones bedded
    in it: the terrace's baked gravel tile read larger and sparser, filtered
    by the sampler the same way, so it holds its grain where a pixel can and
    settles to its mean where it cannot. A factor on the road's albedo around
    one (its luminance only, so the road keeps its own colour), a slope in
    (x, z) for its normal, and the slope's lost variance for its sheen.
    `swept` (0 to 1) is where feet and wheels have cleared it. */
export function roadChip(swept: N): { tone: N; slope: N; variance: N } {
  const P = positionWorld
  const maps = gravelMaps()
  const turn = Math.cos(1.13), turnS = Math.sin(1.13)
  const at = vec2(P.x.mul(turn).add(P.z.mul(turnS)), P.z.mul(turn).sub(P.x.mul(turnS))).div(GRAVEL_TILE_M * 1.35).add(vec2(.23, .71))
  const albedo = texture(maps.albedo, at).bias(GRAVEL_BIAS), relief = texture(maps.relief, at).bias(GRAVEL_BIAS)
  const mean = texture(maps.albedo, vec2(.5, .5)).level(10).rgb
  const lum = (c: N): N => c.dot(vec3(.2126, .7152, .0722))
  // the stones stand in a packed bed: fewer of them show than on a walk
  const bedded = smoothstep(.35, .75, relief.w).mul(float(1).sub(swept.mul(.75)))
  const ratio = lum(albedo.rgb).div(lum(mean).max(.001)).sub(1).mul(bedded).mul(.55).add(1)
  const k = GRAVEL_RELIEF * .7
  const tileSlope = relief.xy.mul(2 * GRAVEL_SLOPE_RANGE).sub(GRAVEL_SLOPE_RANGE).mul(k).mul(bedded)
  const slope = vec2(tileSlope.x.mul(turn).sub(tileSlope.y.mul(turnS)), tileSlope.x.mul(turnS).add(tileSlope.y.mul(turn)))
  const variance = relief.z.mul(GRAVEL_SLOPE_RANGE * GRAVEL_SLOPE_RANGE * k * k).sub(tileSlope.dot(tileSlope)).max(0).mul(bedded)
  return { tone: ratio, slope, variance }
}

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
function setStones(p: N, jitter: number, jitterAcross = jitter): { f1: N; f2: N; a: N; b: N; offset: N } {
  const base = floor(p)
  let f1: N = float(8), f2: N = float(8), a: N = float(0), b: N = float(0), offset: N = vec2(0, 0)
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = base.add(vec2(dx, dy))
    const hx = fract(sin(c.dot(vec2(127.1, 311.7))).mul(43758.5453))
    const hy = fract(sin(c.dot(vec2(269.5, 183.3))).mul(43758.5453))
    const from = p.sub(c.add(vec2(hx, hy).sub(.5).mul(vec2(jitter, jitterAcross)).add(.5)))
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
  // A WALK THAT CARTS HAVE USED: two tracks a hand-cart's width apart, off the
  // middle and wandering, each a flat-floored groove with steep walls, the
  // gravel swept out of it and thrown up in a lip of coarser stones on either
  // side, its floor packed to damp fines; the walk crowned to shed water.
  const wander = mx_noise_float(vec3(alongLane.mul(.16), 3.3, 1.9)).mul(.13)
  const lie0 = across.sub(float(-.22).add(wander))
  const inRuts = smoothstep(.15, .55, mx_noise_float(vec3(alongLane.mul(.21), 8.1, 2.6)).add(.3)).mul(smoothstep(.6, 2.2, alongLane))
  // no two stretches of a track the same: its width and depth wander
  const rutVary = mx_noise_float(vec3(alongLane.mul(.9), 1.7, 6.3))
  const rutW = float(.068).add(rutVary.mul(.012)), lipAt = rutW.mul(1.9), lipW = .045, rutD = float(.015).add(rutVary.mul(.004)), lipH = .009
  const groove = (t: N): { h: N; dh: N } => {
    const g = t.div(rutW), g2 = g.mul(g), a = t.abs().sub(lipAt).div(lipW)
    // between a round groove and a flat-floored one: exp(-g^3)
    const g3 = g2.mul(g.abs()), floorG = TSL.exp(g3.negate()), lipG = TSL.exp(a.mul(a).negate())
    return {
      h: floorG.mul(rutD.negate()).add(lipG.mul(lipH)),
      dh: floorG.mul(g2.mul(TSL.sign(t)).mul(rutD.mul(3).div(rutW))).add(lipG.mul(a.mul(-2 * lipH / lipW)).mul(TSL.sign(t))),
    }
  }
  const r1 = groove(lie0.sub(.53)), r2 = groove(lie0.add(.53))
  // a groove is a line: it is held while the pixel ACROSS it can draw its lip
  const acrossPixel = length(vec2(across.dFdx(), across.dFdy())).max(1e-5)
  const rutHeld = smoothstep(2, 4, float(lipW).div(acrossPixel))
  // its colour is held further out than its slope: a swept floor and a lip
  // of stone still read where the pixel is wider than the wall between them
  const rutSeen = smoothstep(1.5, 3.5, rutW.div(acrossPixel))
  const floorOf = (t: N): N => { const g = t.div(rutW.mul(1.05)); return TSL.exp(g.mul(g).mul(g.abs()).negate()) }
  const lipOf = (t: N): N => TSL.exp(t.abs().sub(lipAt).div(lipW).pow(2).negate())
  const rutFloor = floorOf(lie0.sub(.53)).add(floorOf(lie0.add(.53))).mul(inRuts)
  const rutLips = lipOf(lie0.sub(.53)).add(lipOf(lie0.add(.53))).mul(inRuts)
  const rutSlope = r1.dh.add(r2.dh).mul(inRuts)
  // the groove's wall turned from the low sun holds its own shade
  const rutLee = rutSlope.mul(SUN_ACROSS / Math.tan(SUN_EL)).clamp(0, 1).mul(rutHeld)
  const crownSlope = across.mul(-2 * LANE.crown / (LANE.half * LANE.half))
  const laneSlope = rutSlope.mul(rutHeld).add(crownSlope)
  // the slope the rut's gate took away is spread into the sheen
  const rutLost = rutSlope.abs().mul(float(1).sub(rutHeld)).mul(.7)
  // loose stones rolled to the kerbs: the same gravel read larger along both
  // edges, in a ragged strip
  const toKerb = float(LANE.half).sub(across.abs())
  const kerbStones = float(1).sub(smoothstep(.12, .5, toKerb.add(mx_noise_float(vec3(P.x, P.z, 7.7).mul(2.3)).mul(.16)))).mul(onTerrace)
  // the lip thrown up beside each track is the coarse stone the wheel pushed aside
  const coarse = kerbStones.max(rutLips.mul(rutSeen).mul(.85).mul(onTerrace))
  const kerbAt = tileAt.div(2.1).add(vec2(.37, .61))
  // read a little wider than the pixel: a stone's edge that a walking eye
  // sweeps over settles instead of stepping (the moment map keeps the slope)
  const read = (map: N, at: N): N => texture(map, at).bias(GRAVEL_BIAS)
  const fineMap = read(tileMaps.albedo, tileAt), fineRelief = read(tileMaps.relief, tileAt)
  const kerbMap = read(tileMaps.albedo, kerbAt), kerbRelief = read(tileMaps.relief, kerbAt)
  // a limestone gravel is pale stone in a pale matrix: its grain is held at
  // this share of the tile's own contrast about the tile's mean
  const tileMean = texture(tileMaps.albedo, vec2(.5, .5)).level(10).rgb
  const stonesColour = mix(tileMean, mix(fineMap.rgb, kerbMap.rgb, coarse), float(GRAVEL_CONTRAST).mul(rutLips.mul(rutSeen).mul(.5).add(1)))
  const laneRelief = mix(fineRelief, kerbRelief, coarse)
  // the slope's mean in the tile's frame, turned back onto the ground
  const tileSlope = laneRelief.xy.mul(2 * GRAVEL_SLOPE_RANGE).sub(GRAVEL_SLOPE_RANGE).mul(GRAVEL_RELIEF)
  const stoneSlope = vec2(tileSlope.x.mul(TILE_COS).sub(tileSlope.y.mul(TILE_SIN)), tileSlope.x.mul(TILE_SIN).add(tileSlope.y.mul(TILE_COS)))
  // what the mip averaged away of the slope: second moment less mean squared
  const stoneVariance = laneRelief.z.mul(GRAVEL_SLOPE_RANGE * GRAVEL_SLOPE_RANGE * GRAVEL_RELIEF * GRAVEL_RELIEF).sub(tileSlope.dot(tileSlope)).max(0)
  const stoneHeight = laneRelief.w.mul(GRAVEL_HEIGHT_M).mul(coarse.mul(1.3).add(1))
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
  const fines = rgb('#5a5044').mul(mx_noise_float(vec3(P.x, P.z, 5.2).mul(90)).mul(drawn(.012)).mul(.06).add(1))
  gravel = mix(gravel, fines, rutFloor.mul(rutSeen).mul(.62)).mul(rutLips.mul(rutSeen).mul(.1).add(1))
    .mul(float(1).sub(rutLee.mul(.38)))
  const gravelled = onTerrace.mul(float(1).sub(bare))
  m.colorNode = mix(m.colorNode, gravel, gravelled.mul(.92))
  const flattened = float(1).sub(bare.mul(.8)).mul(float(1).sub(rutFloor.mul(rutSeen).mul(.7)))
  // the crown and the tracks slope across the walk: turned onto (x, z)
  const terraceSlope = stoneSlope.mul(flattened).add(vec2(laneSlope.mul(LANE.across[0]!), laneSlope.mul(-LANE.across[1]!)))
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
  // SET BY HAND IN COURSES. About 58 by 46 mm a cell: the stones run in
  // courses along the court that wander a little as a paver's lines wander,
  // each packed against its neighbours with its own long axis, turn and size,
  // about 40 to 65 mm; down the court's middle a gutter of stones set
  // lengthwise in one straight course, the paving falling to it
  const cellU = .058, cellV = .046
  const gutterV = v.abs()
  const inGutter = float(1).sub(smoothstep(.1, .16, gutterV))
  // THE CART TRACES AND THE DRAIN, worn into the stones on their own lines
  // (`courtWear`): along a trace the caps are worn flat and the joints packed
  // with the grit the tyres grind; the drain is a narrow fall of stones set
  // along it, damp in its joints. Each wanders and swells as it runs.
  const wearLine = (a: readonly number[], b: readonly number[], width: number): { mask: N; across: N; ends: N } => {
    const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn), ux = dx / span, un = dn / span
    const rel = ground.sub(vec2(a[0]!, a[1]!)), tt = rel.dot(vec2(ux, un)).div(span), tc = tt.clamp(0, 1)
    const sway = sin(tc.mul(13)).mul(.015).add(sin(tc.mul(71)).mul(.008))
    const across = rel.dot(vec2(-un, ux)).sub(sway)
    const half = sin(tc.mul(19)).mul(.15).add(sin(tc.mul(83)).mul(.07)).add(.78).mul(width / 2)
    const ends = smoothstep(-.04, .03, tt).mul(smoothstep(1.04, .97, tt))
    return { mask: float(1).sub(smoothstep(half.mul(.55), half.mul(1.3), across.abs())).mul(ends), across, ends }
  }
  const [traceA, traceB] = courtWear.traces
  const trace = wearLine(traceA![0], traceA![1], courtWear.traceWidth).mask.max(wearLine(traceB![0], traceB![1], courtWear.traceWidth).mask)
  const drainLine = wearLine(courtWear.drain[0], courtWear.drain[1], courtWear.drainWidth)
  const drain = drainLine.mask
  // the drain's stones lie along it, turned from the court's own axis
  const drainTurn = Math.atan2(courtWear.drain[1][1] - courtWear.drain[0][1], courtWear.drain[1][0] - courtWear.drain[0][0]) - along
  const drift = vec2(mx_noise_float(vec3(u.mul(1.1), v.mul(1.1), 2.3)).mul(.4), mx_noise_float(vec3(u.mul(.35), v.mul(.35), 8.9)).mul(.5))
  const setAt = vec2(u.div(cellU), v.div(cellV)).add(drift.mul(float(1).sub(inGutter)))
  const set = setStones(setAt, .8, .42)
  // each course laid from its own barrow of stone: a little lighter or darker
  const courseTone = fract(sin(floor(setAt.y.add(set.offset.y.negate())).mul(91.7)).mul(43758.5453)).sub(.5).mul(.1)
  const turn = mix(mix(set.b.mul(.9).sub(.45), set.b.mul(6.2832), float(1).sub(inGutter)), set.b.mul(.7).sub(.35).add(drainTurn), drain)
  const squash = set.a.mul(.45).add(.74).sub(inGutter.mul(.2)).sub(drain.mul(.2))
  // a sett now and then sunk in its bed or lost altogether, its hole sand
  const fate = fract(set.a.mul(71.3).add(set.b.mul(13.7)))
  const lost = smoothstep(.022, .018, fate).mul(float(1).sub(inGutter)), sunk = smoothstep(.07, .06, fate).mul(float(1).sub(lost))
  const ct = TSL.cos(turn), st = TSL.sin(turn)
  const ox = set.offset.x.mul(ct).add(set.offset.y.mul(st)), oy = set.offset.y.mul(ct).sub(set.offset.x.mul(st))
  // stones of their own sizes: the small ones stand in wider beds of sand
  const radius = fract(set.a.mul(17.3).add(set.b.mul(5.1))).mul(.26).add(.42)
  const reach = length(vec2(ox.div(squash), oy.mul(squash)))
  // how far inside its stone a point stands, in cells: the smaller of the
  // stone's own round and the half-way line to the next stone, less a joint
  const inside = radius.sub(reach).min(set.f2.sub(set.f1).mul(.5).sub(.035)).sub(reach.mul(reach).mul(.06))
  // a stone's edge is as sharp as the pixel lets it be
  const edge = long.div(cellV).mul(1.6).max(.012)
  const stoneShape = smoothstep(edge.negate(), edge, inside).mul(float(1).sub(lost))
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
  const walked = float(1).sub(smoothstep(.8, 2.1, offWay))
  const rise = inside.div(radius.mul(.55)).clamp(0, 1)
  const tip = set.offset.dot(vec2(set.a.sub(.5), set.b.sub(.5))).mul(.35)
  const dome = float(1).sub(float(1).sub(rise).pow(2)).mul(set.b.mul(.45).add(.65)).add(tip.mul(rise)).max(0)
  const capped = dome.min(float(.8).sub(walked.mul(.38)).sub(trace.mul(.3))).mul(float(1).sub(lost)).sub(sunk.mul(.3))
  // one colour draw per stone, held close: Loire gravel, not a mosaic
  const pick = set.a, pick2 = set.b
  let cobble: N = mix(rgb('#958e7e'), rgb('#8d7a5f'), smoothstep(.5, .56, pick))
  cobble = mix(cobble, rgb('#6f6d69'), smoothstep(.78, .82, pick2))
  cobble = mix(cobble, rgb('#a9a191'), smoothstep(.94, .97, pick))
  cobble = cobble.mul(pick2.mul(.12).add(.94)).mul(courseTone.mul(held(cellV * 4, 2, 4)).add(1))
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
  const damp = float(1).sub(smoothstep(.3, 2.4, toWall)).max(inGutter.mul(.55)).max(drain.mul(.6)).mul(float(1).sub(walked.mul(.8)))
  const moss = smoothstep(.2, .7, mx_noise_float(vec3(P.x, P.z, 6.6).mul(3.1)).add(damp.mul(.9))).mul(damp)
  const sandGrain = mx_noise_float(vec3(P.x, P.z, 7.3).mul(140)).mul(.1).mul(drawn(.008)).add(1)
  const deep = smoothstep(.08, 0, inside.negate()).mul(shown)
  // grit in the sand: a speck of flint or a crumb of limestone every few mm
  const grit = smoothstep(.55, .75, mx_noise_float(vec3(P.x, P.z, 3.9).mul(260))).mul(drawn(.006))
  const joint = mix(rgb('#7b705c').mul(sandGrain).mul(grit.mul(.22).add(1)), rgb('#505c30'), moss.mul(.85)).mul(float(1).sub(deep.mul(.34)))
    .mul(float(1).sub(trace.mul(.3)))
  // the sunk and the gutter's stones hold the wet; the walked line is paler
  const paved = mix(joint.mul(lost.mul(.2).add(1)), cobble.mul(walked.mul(.15).add(trace.mul(.07)).add(1)).mul(float(1).sub(sunk.mul(.16)).sub(inGutter.mul(.07)).sub(drain.mul(.1))), stone)
  m.colorNode = mix(m.colorNode, paved, onCobbles)
  // the court falls to its gutter, a finger's depth over a stride
  const fall = smoothstep(.16, 1.4, gutterV).mul(.012).sub(lost.mul(.008))
    .sub(float(1).sub(smoothstep(.03, .45, drainLine.across.abs())).mul(drainLine.ends).mul(.006)).sub(trace.mul(.003))
  const cobbleHeight = capped.mul(stoneShape).mul(.014).mul(relief).add(fall).mul(onCobbles)

  // the flags: pale limestone slabs about 0.9 by 0.6 m in courses along the
  // house, hand-dressed, each its own stone (`court-flags.ts`), worn on the
  // walk to the door, their joints sanded and green near the walls
  const fu = u.div(.9), fv = v.div(.6)
  const course = floor(fv), shiftU = fract(course.mul(.5)).mul(.9)
  const inU = fract(fu.add(shiftU)), inV = fract(fv)
  const pixelOfP = pixelOf(P)
  const jointW = float(.008).div(.6).add(float(pixelOfP).div(.6))
  const flagJoint = float(1).sub(smoothstep(jointW.mul(.5), jointW, inU.min(inU.oneMinus()).mul(.6 / .9)).mul(smoothstep(jointW.mul(.5), jointW, inV.min(inV.oneMinus()))))
  // the band under the wall the sun never reaches, a stride wide
  const flagDamp = float(1).sub(smoothstep(.15, 1.1, toWall)).mul(float(1).sub(walked.mul(.6)))
  // the same courses in the face's own terms: courses across the walk, the
  // slabs along it, every other course half a slab on
  const face = flagFace({ east: 0, north: 0, pitchEast: .6, pitchNorth: .9, bond: -.405 }, walked, flagDamp.max(damp.mul(.5)),
    { at: { east: v, north: u }, tooled: 'dressed' })
  const flag: N = rgb('#a39a86').mul(face.tone)
  // the joint is sand with grit in it, a little shadowed down its recess,
  // not a drawn line; green where the walk stays damp
  const jointGrit = mx_noise_float(vec3(P.x, P.z, 5.2).mul(21)).mul(shows(.05))
  const flagJointColour = mix(rgb('#877b63').mul(jointGrit.mul(.12).add(1)), rgb('#55613a'), moss.mul(.8)).mul(.84)
  m.colorNode = mix(m.colorNode, mix(flag, flagJointColour, flagJoint.mul(shows(.02))), onFlags)
  const flagHeight = flagJoint.mul(-.004).mul(shows(.02)).add(face.height).mul(onFlags)

  // ─── relief, occlusion and sheen of both ─────────────────────────────────
  const height = cobbleHeight.add(flagHeight).toVar()
  const n = normalWorldGeometry.transformDirection(cameraViewMatrix)
  const sx = positionView.dFdx(), sy = positionView.dFdy(), rx = sy.cross(n), ry = n.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10))
  const bounded = gradient.div(length(gradient).div(.6).max(1)).toVar()
  m.normalNode = mix(m.normalNode, n.sub(bounded).normalize(), onCourt).normalize()
  m.normalNode = mix(m.normalNode, terraceNormal, onTerrace).normalize()
  const gaps = float(1).sub(stoneHeight.div(GRAVEL_HEIGHT_M * .45).clamp(0, 1)).mul(gravelled).mul(.26)
    .add(rutFloor.mul(onTerrace).mul(.14)).add(rutLee.mul(onTerrace).mul(.2)).add(float(1).sub(stone).mul(onCobbles).mul(.35).add(deep.mul(onCobbles).mul(.1))).add(flagJoint.mul(onFlags).mul(.3))
  m.aoNode = m.aoNode.mul(float(1).sub(gaps))
  const polished = walked.mul(.2).add(trace.mul(.14)).add(drain.mul(.1)).mul(stone).mul(onCobbles).mul(relief).sub(face.rough.mul(onFlags))
  // THE SHEEN FOLLOWS THE RELIEF IT LOST: where a stone's slope is under the
  // pixel, its highlight is spread over the pixel instead of flashing in it
  const lostSlope = float(1).sub(relief).mul(onCobbles).mul(.5).add(length(bounded).mul(.35).mul(onCourt))
    .add(terraceVariance.mul(.5).sqrt().add(rutLost).mul(onTerrace))
  const finished = onTerrace.max(onCourt)
  m.roughnessNode = specularAA(m.roughnessNode.sub(polished).sub(gravelled.mul(.05)).clamp(.05, 1), lostSlope.mul(finished))
  m.userData['yardFinish'] = groundFinishProvenance
}
