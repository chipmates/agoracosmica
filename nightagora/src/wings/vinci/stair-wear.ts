/* THE GARDEN FLIGHT'S TREADS, WORN WHERE FEET LAND.

   A tread is not one clean tone: the nosing takes every step down, so its
   arris is rounded, paler and smoother along the line feet land on, and the
   aggregate shows through there; the back of the tread against the riser
   above is where no foot goes and the grit and the damp stay. Colour,
   roughness and a bounded normal only; no tread moves. Assumed wear of a
   used stair, a type and not a survey. */
import * as TSL from 'three/tsl'
import type { MeshStandardNodeMaterial } from 'three/webgpu'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { cameraViewMatrix, float, fract, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, vec3 } =
  TSL as unknown as Record<string, N>

export interface Flight { east: number; width: number; north: number; south: number; count: number }

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
}
