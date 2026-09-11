/** SI schedules transcribed from the fourteen complete engineering dossiers.
 * Time is absolute seconds since a visitor starts the demonstration. Continuous
 * angles stay unwrapped. A finite hoist or rolling demonstration holds its last
 * state until the visitor explicitly starts it again.
 */
import { Quaternion, Vector3 } from 'three/webgpu'
import type { Assembly, Dossier } from './types'

export type JointValues = Record<string, number>
export type Centreline = readonly (readonly number[])[]

const PI = Math.PI
const smoothstep = (u: number): number => u * u * (3 - 2 * u)
const seconds = (t: number): number => Math.max(0, Number.isFinite(t) ? t : 0)

/** Independent coordinates only. A coupling describes their relationship and
 * never creates a second parent or adds another transform to its driven part.
 */
export function jointValuesAt(slug: string, time: number): JointValues {
  const t = seconds(time)
  switch (slug) {
    case 'aerial-screw': return { spin: PI * t / 6 }
    case 'parachute':
    case 'camera-obscura': return {}
    case 'anemometer': return { 'plate-tilt': (PI / 12) * (1 - Math.cos(2 * PI * (t % 12) / 12)) }
    case 'inclinometer': {
      const q = (PI / 18) * Math.sin(2 * PI * (t % 12) / 12)
      return { 'deck-roll': q, 'plumb-roll': -q }
    }
    case 'multi-barrel-gun': {
      const cycle = Math.floor(t / 54)
      const local = t % 54
      const bank = Math.floor(local / 18)
      const phase = local - bank * 18
      const turn = phase <= 6 ? 0 : smoothstep((phase - 6) / 12)
      return { index: cycle * 2 * PI + (bank + turn) * (2 * PI / 3) }
    }
    case 'rolling-mill': {
      const held = Math.min(t, 12)
      return { 'q-in': PI * held / 6, 'q-upper': -PI * held / 18, 'q-lower': PI * held / 18 }
    }
    case 'ball-bearing': {
      const q: JointValues = { 'q-top': PI * t / 36, 'q-carrier': PI * t / 72 }
      for (let i = 0; i < 8; i++) {
        q[`spin-${i}`] = -PI * t / 18
        q[`sep-${i}`] = 0.30381976571384123 * t
      }
      return q
    }
    case 'flywheel': return { q: PI * t / 6 }
    case 'revolving-crane': {
      const held = Math.min(t, 12)
      return { slew: 0, hoist: -0.25 * held, rear: -0.25 * held, tip: -0.25 * held, lift: 0.02 * held }
    }
    case 'lathe': {
      const stroke = 1 - Math.cos(PI * (t % 4) / 2)
      return { spin: -1.2497527072328156 * stroke, foot: -0.05 * stroke, feed: 0 }
    }
    case 'miter-lock-gates': {
      const local = t % 48
      const u = smoothstep((local % 24) / 24)
      const open = local < 24 ? u : 1 - u
      return { 'gate-left': -1.3258176636680323 * open, 'gate-right': 1.3258176636680323 * open }
    }
    case 'water-lifting-screw': return { turn: PI * t / 6 }
    case 'proportional-compass': {
      const local = t % 24
      const u = smoothstep((local % 12) / 12)
      const open = local < 12 ? u : 1 - u
      return { 'open-leg-left': 0.3 * open, 'open-leg-right': -0.3 * open }
    }
    default: throw new Error(`No admitted motion schedule for ${slug}`)
  }
}

/** Deformation is part of the dossier, not a spring or cable simulation.
 * Coordinates remain in the named part's local frame. The drum's own rotation
 * will subsequently carry its wrap exactly once.
 */
export function movingCentreline(
  slug: string,
  part: string,
  rest: Centreline,
  values: JointValues,
): number[][] | null {
  if (slug === 'revolving-crane' && part === 'drum-wrap') {
    const q = values['hoist'] ?? 0
    return Array.from({ length: 65 }, (_, i) => {
      const theta = (1 - q) * i / 64
      return [-0.08 * Math.sin(theta - 1), 0, -0.08 * Math.cos(theta - 1)]
    })
  }
  if (slug === 'revolving-crane' && part === 'hoist-rope') {
    return rest.map((p, i) => [p[0] ?? 0, (p[1] ?? 0) + (i === rest.length - 1 ? (values['lift'] ?? 0) : 0), p[2] ?? 0])
  }
  if (slug === 'lathe' && part === 'bow') {
    const u = values['foot'] ?? 0
    return rest.map((p, i) => [p[0] ?? 0, (p[1] ?? 0) + u * i / 3, p[2] ?? 0])
  }
  if (slug === 'lathe' && part === 'drive-rope') {
    const u = values['foot'] ?? 0
    return rest.map((p, i) => [p[0] ?? 0, (p[1] ?? 0) + (i === 0 || i === rest.length - 1 ? u : 0), p[2] ?? 0])
  }
  return null
}

interface RestPose { position: Vector3; quaternion: Quaternion }
interface MotionState {
  rest: Map<string, RestPose>
  lines: Map<string, Centreline>
  previous: number | null
}
const states = new WeakMap<Assembly, MotionState>()
const rotation = new Quaternion()
const axis = new Vector3()
const pivot = new Vector3()

function capture(dossier: Dossier, assembly: Assembly): MotionState {
  const rest = new Map<string, RestPose>()
  for (const [id, part] of assembly.parts) {
    rest.set(id, { position: part.position.clone(), quaternion: part.quaternion.clone() })
  }
  const lines = new Map<string, Centreline>()
  for (const part of dossier.parts) {
    const points: unknown = part.dimensions_m['centreline']
    if (Array.isArray(points)) lines.set(part.id, points as Centreline)
  }
  return { rest, lines, previous: null }
}

/** Apply T(pivot) R(axis,q) T(-pivot) to the immutable rest transform.
 * Rest orientations use the dossier's XYZ intrinsic convention. In particular,
 * rotating around a parent axis is a quaternion PREmultiply, not local rotateY.
 */
export function applyMotion(dossier: Dossier, assembly: Assembly, time: number): JointValues {
  let state = states.get(assembly)
  if (!state) {
    state = capture(dossier, assembly)
    states.set(assembly, state)
  }
  const t = seconds(time)
  const values = jointValuesAt(dossier.slug, t)
  if (state.previous === t) return values

  for (const joint of dossier.joints) {
    if (joint.type === 'gear' || joint.type === 'belt' || joint.type === 'rope') continue
    const part = assembly.parts.get(joint.child)
    const rest = state.rest.get(joint.child)
    const q = values[joint.id]
    if (!part || !rest || q === undefined) throw new Error(`Unresolved moving joint ${dossier.slug}/${joint.id}`)
    axis.fromArray(joint.axis)
    if (joint.type === 'prismatic') {
      part.position.copy(rest.position).addScaledVector(axis, q)
      part.quaternion.copy(rest.quaternion)
    } else {
      pivot.fromArray(joint.pivot_m)
      rotation.setFromAxisAngle(axis, q)
      part.position.copy(rest.position).sub(pivot).applyQuaternion(rotation).add(pivot)
      part.quaternion.copy(rest.quaternion).premultiply(rotation)
    }
    part.updateMatrix()
  }
  for (const [id, line] of state.lines) {
    const changed = movingCentreline(dossier.slug, id, line, values)
    if (changed) assembly.updateTube(id, changed)
  }
  assembly.object.updateMatrixWorld(true)
  assembly.sync()
  state.previous = t
  return values
}
