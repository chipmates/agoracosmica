/* THE WIND, AS DATA ON A CLOCK.

   The trees stand still unless the address asks for the wind (`?wind=1`, or
   the film's own export address). The live walk, its shadow cache and every
   gate that reads a still frame see the rest pose; the film drives the same
   trees from the wing's clock, which its harness owns.

   Every component's period divides LOOP_S, so any LOOP_S seconds of wind is
   a seamless loop: a clip that rests on a stop can join its own first frame.
   The displacement is bounded (MAX_SWAY_M at a crown's outermost twig), and
   the certified corridors keep at least that much more air than the rest
   pose needs. */
import { Group, Mesh, MeshStandardNodeMaterial, BufferGeometry, Float32BufferAttribute, DoubleSide } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mulberry } from './tree-growth'

/* TSL's overload types cannot follow a graph built from helpers, so the cast
   happens once, here, and the nodes below stay readable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { attribute, cos, float, fract, normalLocal, positionLocal, sin, smoothstep, texture, uniform, uv, vec3 } = TSL as any

/** The loop the film rests on at a stop, in seconds. */
export const LOOP_S = 12
/** The largest excursion of any vertex from its rest pose, in metres. */
export const MAX_SWAY_M = .16

/** The wind of the hour: from the south-west, a light breeze under the thin
    high veil the sky is drawn with. Assumed weather, as the sky's own label
    says. Each component is [period divisor, amplitude share, phase]. */
export const WIND = {
  fromBearingDeg: 232,
  /** the whole crown leaning with the gusts */
  sway: [[1, .55, .0], [2, .30, 1.7], [3, .15, 4.1]],
  /** a limb answering on its own phase */
  limb: [[3, .6, .4], [4, .4, 2.3]],
  /** a leaf turning on its stalk */
  flutter: [[8, .55, .9], [11, .45, 3.3]],
} as const

/** Whether this page carries the wind. Node checkers have no address and
    always build the rest pose. */
export function windWanted(): boolean {
  if (typeof location === 'undefined') return false
  const query = new URLSearchParams(location.search)
  return query.get('wind') === '1' || query.has('export')
}

/** The wing's clock in seconds, written once a frame by the wing. */
export const windClock = uniform(0)

const TAU = Math.PI * 2
/** sum of the components at the loop's harmonics, one phase shift each */
function harmonics(components: readonly (readonly [number, number, number])[], phase: ReturnType<typeof float>) {
  let total = float(0)
  for (const [k, a, p] of components) {
    total = total.add(sin(windClock.mul(TAU * k / LOOP_S).add(phase.mul(TAU * k)).add(p)).mul(a))
  }
  return total
}

/** The rest pose displaced by the wind, from the geometry's own `wind` data:
    branch phase, leaf phase, flutter and flex, each 0..1. */
export function windPosition() {
  const data = attribute('wind', 'vec4')
  const branchPhase = data.x, leafPhase = data.y, flutter = data.z, flex = data.w
  const bearing = WIND.fromBearingDeg * Math.PI / 180
  // the wind blows toward the bearing opposite the one it comes from
  const toward = vec3(-Math.sin(bearing), 0, Math.cos(bearing))
  const across = vec3(-Math.cos(bearing), 0, -Math.sin(bearing))
  const crown = harmonics(WIND.sway, branchPhase.mul(.15)).mul(flex.mul(flex)).mul(MAX_SWAY_M * .55)
  const limb = harmonics(WIND.limb, branchPhase).mul(flex).mul(MAX_SWAY_M * .25)
  const leaf = harmonics(WIND.flutter, leafPhase).mul(flutter).mul(flex).mul(MAX_SWAY_M * .2)
  const lift = sin(windClock.mul(TAU * 5 / LOOP_S).add(branchPhase.mul(TAU))).mul(flex).mul(MAX_SWAY_M * .08)
  return positionLocal
    .add(toward.mul(crown.add(limb.mul(.6))))
    .add(across.mul(limb.mul(.8)))
    .add(vec3(0, lift, 0))
    .add(normalLocal.mul(leaf))
}

/* ─── a few leaves falling ─────────────────────────────────────────────── */

/** Where a falling leaf leaves its crown, where it lands, and its species'
    cell in the leaf atlas. */
export interface FallSource {
  x: number; y: number; z: number
  ground: number
  colour: readonly [number, number, number]
  uv: { u0: number; v0: number; du: number; dv: number }
}

/** How much of the loop a leaf spends in the air; the rest it lies where it
    landed. Every leaf leaves its twig at its own fixed time in the loop, so
    the loop is the same loop every time the film plays it. */
const FALLING = .8

/** A few leaves leave the crowns inside every loop and reach the ground
    inside it. Not a rail solid and not in the shadow body: a leaf in the air
    is not a wall. Only a page that carries the wind builds them. */
export function createFallingLeaves(sources: readonly FallSource[], count: number, map: import('three/webgpu').Texture): Group {
  const group = new Group()
  group.name = 'vinci generated falling leaves'
  if (!sources.length || count <= 0) return group
  const random = mulberry(1517101)
  const position: number[] = [], normal: number[] = [], colour: number[] = [], uvs: number[] = []
  const dropA: number[] = [], dropB: number[] = [], index: number[] = []
  const bearing = WIND.fromBearingDeg * Math.PI / 180
  for (let i = 0; i < count; i++) {
    const s = sources[Math.floor(random() * sources.length)]!
    const start = random() * LOOP_S, drift = 1.5 + random() * 3, turns = 2 + Math.floor(random() * 2), sway = random()
    const size = .075 + random() * .04
    const first = position.length / 3
    for (const [u, v] of [[0, -.5], [0, .5], [1, .5], [1, -.5]] as const) {
      // the card about its own middle, so it can turn about it
      position.push((u - .5) * size, 0, v * size)
      normal.push(0, 1, 0)
      colour.push(...s.colour)
      uvs.push(s.uv.u0 + (.5 + v) * s.uv.du, s.uv.v0 + u * s.uv.dv)
      dropA.push(s.x, s.y, s.z, s.ground)
      dropB.push(start, drift, turns, sway)
    }
    index.push(first, first + 2, first + 1, first, first + 3, first + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colour, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('dropA', new Float32BufferAttribute(dropA, 4))
  geometry.setAttribute('dropB', new Float32BufferAttribute(dropB, 4))
  geometry.setIndex(index)
  const a = attribute('dropA', 'vec4'), b = attribute('dropB', 'vec4')
  // the leaf's own time in the loop, from the moment it leaves its twig
  const t = fract(windClock.sub(b.x).div(LOOP_S)).mul(LOOP_S)
  const f = t.div(LOOP_S * FALLING).min(1)
  const toward = vec3(-Math.sin(bearing), 0, Math.cos(bearing))
  const across = vec3(-Math.cos(bearing), 0, -Math.sin(bearing))
  // it swings across the wind twice a loop and settles as it lands
  const swing = sin(t.mul(TAU * 4 / LOOP_S).add(b.w.mul(TAU))).mul(.35).mul(f.oneMinus())
  const centre = vec3(a.x, a.y.sub(a.y.sub(a.w).sub(.03).mul(f.pow(1.15))), a.z)
    .add(toward.mul(b.y.mul(f))).add(across.mul(swing))
  // whole turns over the loop, flat once it lies on the ground
  const landed = smoothstep(.92, 1, f)
  const roll = t.mul(TAU / LOOP_S).mul(b.z).mul(landed.oneMinus()), yaw = t.mul(.9).add(b.w.mul(TAU))
  const local = positionLocal
  const rolled = vec3(local.x, local.z.mul(sin(roll)), local.z.mul(cos(roll)))
  const turned = vec3(rolled.x.mul(cos(yaw)).sub(rolled.z.mul(sin(yaw))), rolled.y, rolled.x.mul(sin(yaw)).add(rolled.z.mul(cos(yaw))))
  const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .7, side: DoubleSide, alphaTest: .42 })
  material.alphaToCoverage = true
  material.name = 'vinci generated falling leaves'
  material.colorNode = texture(map, uv())
  material.positionNode = centre.add(turned)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'vinci generated falling leaves'
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.userData = { manifestId: 'vinci/wind' }
  group.add(mesh)
  return group
}
