/* THE GARDEN FLIGHT'S TREADS, WORN WHERE FEET LAND.

   A tread is not one clean tone: the nosing takes every step down, so its
   arris is rounded, paler and smoother along the line feet land on, and the
   aggregate shows through there; the back of the tread against the riser
   above is where no foot goes and the grit and the damp stay. Colour,
   roughness and a bounded normal only; no tread moves. Assumed wear of a
   used stair, a type and not a survey. */
import * as TSL from 'three/tsl'
import { DoubleSide, MeshStandardNodeMaterial } from 'three/webgpu'
import { hourKey } from './site'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { cameraViewMatrix, float, Fn, fract, length, mix, mx_noise_float, normalWorldGeometry, positionWorld, sin, smoothstep, vec2, vec3 } =
  TSL as unknown as Record<string, N>
/** how far the flight's concrete cheeks stand above each tread */
const CHEEK_RISE = .09
/** toward the sun of the hour, world frame (x east, y up, z south) */
const SUN_TOWARD = ((azimuth: number, elevation: number) => {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})(hourKey.sun_azimuth_deg.value, hourKey.sun_elevation_deg.value)

/** the flight's footprint, its tread count and the heights of its head and foot */
export interface Flight { east: number; width: number; north: number; south: number; count: number; top: number; foot: number }

/** Lay the flight's wear over a material's own colour, roughness and normal,
    on the treads' top faces inside the flight's footprint only. */
export function wearTreads(m: MeshStandardNodeMaterial, flight: Flight, gate: N): void {
  const P = positionWorld, north = P.z.negate(), depth = (flight.north - flight.south) / flight.count
  const half = flight.width / 2
  const inFlight = smoothstep(flight.east - half - .01, flight.east - half + .01, P.x)
    .mul(float(1).sub(smoothstep(flight.east + half - .01, flight.east + half + .01, P.x)))
    .mul(smoothstep(flight.south - .01, flight.south + .01, north)).mul(float(1).sub(smoothstep(flight.north - .01, flight.north + .01, north)))
    .mul(smoothstep(.9, .97, normalWorldGeometry.y)).mul(gate)
  // 0 at the tread's back against the riser above, 1 at its nosing
  const q = fract(float(flight.north).sub(north).div(depth))
  const across = P.x.sub(flight.east).div(half)
  // feet land in the middle and a little to each side of it, and not every
  // tread the same: the line wanders from one tread to the next
  const drift = mx_noise_float(vec3(float(flight.north).sub(north).div(depth).floor().mul(.73), 1.7, 4.2)).mul(.18)
  const walked = TSL.exp(across.sub(drift).div(.5).pow(2).negate())
  const pixel = P.dFdx().length().max(P.dFdy().length()).max(1e-5)
  const held = (metres: number): N => smoothstep(2, 4, float(metres).div(pixel))
  const nosing = smoothstep(.78, .985, q)
  const worn = nosing.mul(walked.mul(.7).add(.3)).mul(inFlight)
  const back = float(1).sub(smoothstep(.02, .3, q)).mul(inFlight)
  // the aggregate the wear opens: pale and dark stones a few mm across
  const aggregate = mx_noise_float(P.mul(160)).mul(held(.008))
  const chips = smoothstep(.62, .82, mx_noise_float(P.mul(55))).mul(nosing).mul(inFlight).mul(held(.02))
  const paler = worn.mul(.13).add(walked.mul(inFlight).mul(q.mul(.05)))
  m.colorNode = (m.colorNode as N).mul(float(1).add(paler).add(aggregate.mul(worn).mul(.12)))
    .mul(float(1).sub(back.mul(.12))).mul(float(1).sub(chips.mul(.16)))
  m.roughnessNode = (m.roughnessNode as N).sub(worn.mul(walked).mul(.09)).add(back.mul(.03))
  // the arris rounded over its last 25 mm: the normal leans down the flight,
  // held while the pixel can draw a rounding that size
  const round = smoothstep(1 - .025 / depth, 1, q).mul(inFlight).mul(held(.025)).mul(worn.mul(.6).add(.4))
  const bent = vec3(0, float(1).sub(round.mul(.45)), round.mul(.62)).normalize().transformDirection(cameraViewMatrix)
  m.normalNode = mix(m.normalNode as N, bent, round.mul(.9)).normalize()
  // A HOLLOW WORN INTO EACH TREAD where feet land: a few millimetres at the
  // walking line, a little behind the nosing, as a slope on the normal
  const hollowD = .0035, hollowX = .42 * half, hollowQ = .3
  const hx = P.x.sub(flight.east).sub(drift.mul(half)).div(hollowX), hq = q.sub(.58).div(hollowQ)
  const bowl = TSL.exp(hx.mul(hx).add(hq.mul(hq)).negate()).mul(inFlight).mul(held(.2))
  // dh/dx and dh/dnorth of -D·bowl; q runs south, so d(q)/d(north) is -1/depth
  const dhx = bowl.mul(hx).mul(2 * hollowD / hollowX), dhn = bowl.mul(hq).mul(-2 * hollowD / hollowQ / depth)
  const dished = vec3(dhx.negate(), 1, dhn).normalize().transformDirection(cameraViewMatrix)
  m.normalNode = mix(m.normalNode as N, dished, bowl.mul(.85)).normalize()
  m.colorNode = (m.colorNode as N).mul(float(1).add(bowl.mul(.08)))
  m.roughnessNode = (m.roughnessNode as N).sub(bowl.mul(.08))
  // EACH TREAD LAID IN TWO OR THREE STONES, their joints across the tread at
  // their own places, and under each nosing its mortar bed: a dark line at
  // the foot of the tread's front face where it sits on the riser below
  const tread = float(flight.north).sub(north).div(depth).floor()
  const h1 = fract(tread.mul(.6180339).add(.13)), h2 = fract(tread.mul(.4142136).add(.71))
  const three = fract(tread.mul(.754877)).greaterThan(.45)
  const j1 = three.select(h1.mul(.12).add(.28), h1.mul(.2).add(.4)).mul(flight.width).add(flight.east - half)
  const j2 = h2.mul(.12).add(.6).mul(flight.width).add(flight.east - half)
  const toCut = P.x.sub(j1).abs().min(three.select(P.x.sub(j2).abs(), float(9)))
  const front = smoothstep(.85, .95, normalWorldGeometry.z)
    .mul(smoothstep(flight.east - half - .01, flight.east - half + .01, P.x)).mul(float(1).sub(smoothstep(flight.east + half - .01, flight.east + half + .01, P.x)))
    .mul(smoothstep(flight.south - .05, flight.south + .01, north)).mul(float(1).sub(smoothstep(flight.north - .01, flight.north + .05, north))).mul(gate)
  const stoneJoint = float(1).sub(smoothstep(.003, .007, toCut)).mul(inFlight.max(front)).mul(held(.012))
  const rise = (flight.top - flight.foot) / flight.count
  const below = fract(float(flight.top).sub(P.y).div(rise)).mul(rise)
  const bed = smoothstep(.044, .049, below).mul(float(1).sub(smoothstep(.059, .061, below))).mul(front).mul(held(.008))
  const faceWear = front.mul(float(1).sub(smoothstep(0, .012, below)))
  m.colorNode = (m.colorNode as N).mul(float(1).sub(stoneJoint.mul(.5)).sub(bed.mul(.62))).mul(float(1).add(faceWear.mul(.08)))
  m.roughnessNode = (m.roughnessNode as N).add(bed.mul(.06))
  // THE CREASE WHERE A TREAD MEETS THE RISER ABOVE sees half the sky the
  // open tread sees, which is what draws a flight standing in shade
  const crease = TSL.exp(q.mul(depth).div(.045).negate()).mul(inFlight)
  m.aoNode = ((m.aoNode as N) ?? float(1)).mul(float(1).sub(crease.mul(.38)))
  // EACH STONE ITS OWN: one quarry's beds, a little paler or greyer or
  // warmer from one stone to the next, the tread and its front one stone
  const which = P.x.greaterThan(j1).select(three.and(P.x.greaterThan(j2)).select(float(2), float(1)), float(0))
  const id = tread.mul(3).add(which)
  const value = fract(id.mul(.7548777).add(.31).sin().mul(4371.13)).sub(.5).mul(1.35)
  const warm = fract(id.mul(.5698403).add(.77).sin().mul(2718.3)).sub(.5)
  const ownStone = inFlight.max(front).mul(held(.05))
  const tint = vec3(float(1).add(value.mul(.15)).add(warm.mul(.05)), float(1).add(value.mul(.15)), float(1).add(value.mul(.15)).sub(warm.mul(.07)))
  m.colorNode = mix(m.colorNode as N, (m.colorNode as N).mul(tint), ownStone)
  // THE WEST CHEEK'S SHADOW ACROSS EACH TREAD, drawn where it falls: a strip
  // as wide as the sun climbs over the cheek's height above the tread, cut
  // where the ray leaves over the nosing. Engine-only, as the house's joints
  // are; the shadow map's texels are too coarse to hold it.
  const [sx, sy, sz] = SUN_TOWARD
  if (sx < -.05 && sy > .02) {
    const fromCheek = P.x.sub(flight.east - half)
    const toNosing = float(1).sub(q).mul(depth)
    const reach = sz > .01 ? float(CHEEK_RISE * -sx / sy).min(toNosing.mul(-sx / sz)) : float(CHEEK_RISE * -sx / sy)
    const px = pixel.mul(.5)
    const cheek = float(1).sub(smoothstep(reach.sub(px), reach.add(px), fromCheek)).mul(inFlight).toVar()
    // and grit gathers along the cheek's foot
    m.colorNode = (m.colorNode as N).mul(float(1).sub(cheek.mul(float(1).sub(smoothstep(0, .06, fromCheek))).mul(.06)))
    // and the filtered edge of a farther shadow drawn in on the flight, as on
    // the wall beside it (`terrace-wall.ts`, sunEdge)
    const onFlight = inFlight.max(front)
    m.receivedShadowNode = Fn(([shadow]: N[]) => mix(shadow, smoothstep(.22, .78, shadow), onFlight).mul(float(1).sub(cheek)))
    m.userData['engineCheekShadow'] = true
  }
}

/** A flight of stone steps in plan, in the wing's east and north: its top
    tread's back edge runs from `a` along `axis` for `width`, each tread
    `tread` deep going down along `outward`, `count` of them, the top one
    flush with the landing behind it; `walk` is where the walking line
    crosses, in metres along `axis` from `a`. */
export interface StoneFlight {
  a: readonly [number, number]; axis: readonly [number, number]; outward: readonly [number, number]
  width: number; tread: number; count: number; walk: number
}

/** THE COURT'S OLD STEPS. Each tread its own stone or two, hand-dressed;
    a hollow worn behind the nosing on the walking line and the nosing
    itself rounded down there, chipped along its arris, paler and smoother
    where soles land; the grit and the damp held in the corner against the
    riser above, and at the ends, where nobody treads, lichen. The landing
    behind the top step in two large flags. Colour, roughness and a normal
    on the treads' own top faces; no tread moves. */
export function stoneFlightMaterial(f: StoneFlight): MeshStandardNodeMaterial {
  const { attribute, exp, floor } = TSL as unknown as Record<string, N>
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .9, side: DoubleSide })
  const P = positionWorld, pixel = P.dFdx().length().min(P.dFdy().length()).max(P.dFdx().length().max(P.dFdy().length()).div(8)).max(1e-5)
  const held = (metres: number | N): N => smoothstep(2, 4, (typeof metres === 'number' ? float(metres) : metres).div(pixel))
  const rel = vec2(P.x.sub(f.a[0]), P.z.negate().sub(f.a[1]))
  const across = rel.dot(vec2(f.axis[0], f.axis[1])), down = rel.dot(vec2(f.outward[0], f.outward[1]))
  const k = floor(down.div(f.tread)), q = fract(down.div(f.tread))
  const onTread = smoothstep(-.005, .005, down)
  const landing = float(1).sub(onTread)
  const h1 = (salt: number, of: N = k): N => fract(sin(of.mul(12.9898).add(salt)).mul(43758.5453))
  // each tread in two or three stones, their joints at their own places; the
  // landing in flags along the axis
  const three = h1(3.3).greaterThan(.5)
  const j1 = three.select(h1(1.1).mul(.1).add(.28), h1(1.1).mul(.16).add(.42)).mul(f.width)
  const j2 = h1(2.2).mul(.1).add(.62).mul(f.width)
  const stone = onTread.mul(across.greaterThan(j1).select(float(1), float(0)).add(three.and(across.greaterThan(j2)).select(float(1), float(0))))
    .add(landing.mul(floor(across.div(f.width / 2)).add(7)))
  const toCut = mix(across.sub(f.width / 2).abs(), across.sub(j1).abs().min(three.select(across.sub(j2).abs(), float(9))), onTread)
    .min(down.abs())
  const idOf = k.mul(7.31).add(stone.mul(3.17))
  const own = h1(4.4, idOf).sub(.5)
  const hue = mix(vec3(1.04, 1, .94), vec3(.96, .99, 1.04), h1(5.5, idOf))
  // the walking line wanders a little tread to tread
  const drift = h1(6.6).sub(.5).mul(.24)
  const x = across.sub(f.walk).sub(drift)
  const walked = exp(x.div(.5).pow(2).negate())
  // the nosing: rounded over its last few centimetres, lowered and paler on
  // the walking line; the back: the riser above's corner, grit and damp
  const edgeIn = float(f.tread).sub(q.mul(f.tread))
  const roundM = walked.mul(.035).add(.012)
  const rounding = float(1).sub(smoothstep(0, roundM, edgeIn)).mul(onTread)
  const back = float(1).sub(smoothstep(.015, .07, q.mul(f.tread))).mul(onTread).mul(k.greaterThan(0).select(float(1), float(0)))
  const noseChip = smoothstep(.55, .85, mx_noise_float(vec3(across.mul(9), k.mul(3.7), 1.3))).mul(.02)
  const chipped = float(1).sub(smoothstep(noseChip.mul(.6), noseChip.add(.002), edgeIn)).mul(noseChip.greaterThan(.004).select(float(1), float(0)))
    .mul(onTread).mul(held(.02))
  // A HOLLOW WORN INTO EACH TREAD behind its nosing on the walking line
  const hx = x.div(.42), hq = q.sub(.58).div(.3)
  const hollowD = .006
  const bowl = exp(hx.mul(hx).add(hq.mul(hq)).negate()).mul(onTread).mul(held(.15))
  // the mason's bands across the tread, worn off where the soles go
  const bandAt = across.div(.04).add(mx_noise_float(vec3(down.mul(8), k.mul(2.1), 4.4)).mul(.3))
  const band = fract(sin(floor(bandAt).mul(41.37).add(idOf.mul(9.1))).mul(24634.6345)).sub(.5).mul(held(.04)).mul(float(1).sub(walked.mul(.9)))
  const grain = mx_noise_float(vec3(P.x, P.y, P.z).mul(60)).mul(held(.017))
  const fleck = mx_noise_float(vec3(P.x, P.y, P.z).mul(180)).mul(held(.006))
  const cloud = mx_noise_float(vec3(P.x.mul(4), P.y, P.z.mul(4)).add(idOf)).mul(held(.25))
  // lichen rosettes where nobody treads
  const cell = vec2(across, down).div(.07), c = floor(cell), cf = fract(cell)
  const ch = (salt: number): N => fract(sin(c.x.mul(419.2).add(c.y.mul(371.9)).add(salt)).mul(43758.5453))
  const rosette = float(1).sub(smoothstep(.7, 1, length(cf.sub(vec2(ch(2).mul(.4).add(.3), ch(3).mul(.4).add(.3)))).div(ch(4).mul(.18).add(.12))))
    .mul(ch(1).lessThan(float(1).sub(walked).pow(2).mul(.16)).select(float(1), float(0))).mul(held(.02))
  const joint = float(1).sub(smoothstep(.003, .006, toCut)).mul(held(.012))
  const lum = float(1).add(own.mul(.16)).add(band.mul(.07)).add(grain.mul(.06)).add(fleck.mul(.04)).add(cloud.mul(.06))
    .add(walked.mul(onTread.mul(.1).add(landing.mul(.06)))).add(rounding.mul(walked.mul(.1).add(.04))).add(bowl.mul(.06))
    .sub(back.mul(.3)).add(chipped.mul(h1(8.8, idOf).greaterThan(.5).select(float(.12), float(-.2)))).add(rosette.mul(.14))
    .sub(joint.mul(.45))
  let colour: N = attribute('color', 'vec3').mul(hue).mul(lum)
  colour = mix(colour, colour.mul(vec3(.86, .92, .8)), back.mul(float(1).sub(walked)).mul(.6))
  colour = mix(colour, colour.mul(vec3(.95, 1.03, 1)), rosette.mul(.5))
  m.colorNode = colour
  m.roughnessNode = float(.9).add(own.mul(.05)).add(band.abs().mul(.08)).sub(walked.mul(.2)).sub(bowl.mul(.08))
    .add(back.mul(.04)).add(rosette.mul(.05)).add(joint.mul(.05)).clamp(.45, 1)
  // the normal: the hollow's slope and the nosing's rounding, in the wing's frame
  const dhAcross = bowl.mul(hx).mul(2 * hollowD / .42), dhDown = bowl.mul(hq).mul(2 * hollowD / .3 / f.tread).sub(rounding.mul(rounding).mul(walked.mul(.9).add(.5)))
  const axisW = vec3(f.axis[0], 0, -f.axis[1]), outW = vec3(f.outward[0], 0, -f.outward[1])
  const gradient = axisW.mul(dhAcross).add(outW.mul(dhDown))
  m.normalNode = vec3(0, 1, 0).sub(gradient).normalize().transformDirection(cameraViewMatrix)
  return m
}
