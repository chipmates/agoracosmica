/** THE LION'S ONE RUN, in seconds from the visitor's start: it stands, a key
 * winds its spring, the wheels take up, it walks six stiff steps over 1.2 m,
 * a count wheel trips and it stops mid-stride, the latch lifts, the chest
 * doors swing open, the lilies come forward, and it holds. Nothing resets
 * inside the run; only the visitor's own control starts it again.
 *
 * Pure numbers: the builder, the checks and the film all read this module.
 */
import { K } from './sdf'

export const LION_PERIOD = 20
export const BEAT = {
  key0: 1.2, key1: 3.4, keyTurns: 2,
  release: 3.6,
  walk0: 3.9, cycle: 2.2, cycles: 3, ease: 0.25,
  latch0: 11.5, latch1: 11.8,
  door0: 12.0, door1: 14.3,
  rack0: 14.8, rack1: 17.6,
} as const
/** Body travel per gait cycle: two steps, one per diagonal pair. */
export const STRIDE = 0.4
/** How far each paw lifts in its swing. */
export const LIFT = 0.07
/** The count wheel's teeth: one shallow notch per step, a deep one at the end. */
export const STEPS = 2 * BEAT.cycles
/** Where the walk ends, in seconds: the train is caught at the last step. */
export const WALK_END = BEAT.walk0 + (BEAT.cycles + BEAT.ease / 2) * BEAT.cycle
/** The body walks this far along its own +z from where it stands at rest. */
export const TRAVEL = STRIDE * BEAT.cycles
/** The great wheel turns once for every RATIO turns of the two crank shafts. */
export const WHEEL_TEETH = 48, PINION_STAVES = 8
export const RATIO = WHEEL_TEETH / PINION_STAVES
/** Doors open this far, radians. */
export const DOOR_OPEN = K.DOOR_OPEN
/** The lily board runs forward this far on its rack. */
export const RACK_RUN = 0.13
/** The latch lifts this far, clear of the opening. */
export const LATCH_LIFT = 0.06

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const smooth = (x: number): number => { const u = clamp01(x); return u * u * (3 - 2 * u) }
const smoother = (x: number): number => { const u = clamp01(x); return u * u * u * (u * (u * 6 - 15) + 10) }
const seconds = (t: number): number => Math.max(0, Number.isFinite(t) ? t : 0)

/** Gait phase in cycles, 0 before the walk and exactly BEAT.cycles after it. */
export function gaitPhase(time: number): number {
  const t = seconds(time), e = BEAT.ease
  const u = (t - BEAT.walk0) / BEAT.cycle
  if (u <= 0) return 0
  const p = u < e ? u * u / (2 * e) : u - e / 2
  return Math.min(p, BEAT.cycles)
}
/** Body advance along z: a spring through a ratchet, surging with each step
 * and slowest as the pairs change over. */
export function travel(p: number): number {
  const a = 0.7
  return STRIDE * (p - a * Math.sin(4 * Math.PI * p) / (4 * Math.PI))
}

/** A short damped shudder, the way a released or caught train jolts. */
const jolt = (t: number, t0: number, amplitude: number): number => {
  const x = t - t0
  return x < 0 ? 0 : amplitude * Math.exp(-x * 14) * Math.sin(x * 70)
}

export type LegId = 'fore-left' | 'fore-right' | 'hind-left' | 'hind-right'
export const LEGS: readonly LegId[] = ['fore-left', 'fore-right', 'hind-left', 'hind-right']
/** Side +1 is the lion's left (+x). Pair 0 swings first. */
const LEG = {
  'fore-left': { fore: true, side: 1, pair: 0 },
  'hind-right': { fore: false, side: -1, pair: 0 },
  'fore-right': { fore: true, side: -1, pair: 1 },
  'hind-left': { fore: false, side: 1, pair: 1 },
} as const

/** Two-bone leg in the lion's yz plane: the rotations of upper, lower and paw
 * about +x that put the wrist at the target while the paw stays level. */
function legIK(S: readonly number[], Kn: readonly number[], W: readonly number[], target: [number, number]): [number, number, number] {
  const u = [Kn[1]! - S[1]!, Kn[2]! - S[2]!], v = [W[1]! - Kn[1]!, W[2]! - Kn[2]!]
  const L1 = Math.hypot(u[0]!, u[1]!), L2 = Math.hypot(v[0]!, v[1]!)
  const tv = [target[0] - S[1]!, target[1] - S[2]!]
  let D = Math.hypot(tv[0]!, tv[1]!)
  D = Math.min(Math.max(D, Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3)
  // the knee keeps the side it bends to at rest
  const rest = Math.atan2(u[0]! * v[1]! - u[1]! * v[0]!, u[0]! * v[0]! + u[1]! * v[1]!)
  const need = Math.PI - Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))))
  const a2 = (rest >= 0 ? 1 : -1) * need - rest
  const c = Math.cos(a2), s = Math.sin(a2)
  const w = [u[0]! + v[0]! * c - v[1]! * s, u[1]! + v[0]! * s + v[1]! * c]
  const a1 = Math.atan2(tv[1]!, tv[0]!) - Math.atan2(w[1]!, w[0]!)
  return [a1, a2, -(a1 + a2)]
}

/** Where one paw's wrist stands on the ground, on the lion's own z, and how
 * high it is lifted, at gait phase p. */
function paw(leg: LegId, p: number): { z: number; lift: number } {
  const { fore, pair } = LEG[leg]
  const W = fore ? K.WF : K.WH
  const off = pair * 0.5
  const plant = (k: number): number => travel(Math.min(Math.max(k + off + 0.5, 0), BEAT.cycles)) + STRIDE / 4
  const q = p - off
  const k = Math.floor(q)
  const inSwing = q >= 0 && q - k < 0.5 && k < BEAT.cycles && p < BEAT.cycles
  const start = (kk: number): number => (kk <= 0 ? 0 : plant(kk - 1))
  let dz: number, lift = 0
  if (inSwing) {
    const s = (q - k) / 0.5
    dz = start(k) + (plant(k) - start(k)) * smoother(s)
    lift = LIFT * Math.sin(Math.PI * smooth(s))
  } else {
    const last = q < 0 ? -1 : (q - k < 0.5 && p < BEAT.cycles ? k - 1 : k)
    dz = last < 0 ? 0 : plant(Math.min(last, BEAT.cycles - 1))
  }
  return { z: W[2] + dz, lift }
}

export interface LionPose {
  /** body origin on the lion's own z, and the body's small bob and rock */
  z: number; bob: number; pitch: number; roll: number
  legs: Record<LegId, [number, number, number]>
  key: number; barrel: number; foreCrank: number; hindCrank: number
  /** count wheel and its detent lever, the latch rod's pull and the latch bolt's lift */
  count: number; detent: number; pull: number; latch: number
  door: number; rack: number; lilyPinion: number; lilyBloom: number
  phase: number
}

/** The detent rides the count wheel's rim, drops a little into each step's
 * notch, and falls into the deep notch at the end. */
function detentAt(t: number, p: number): number {
  const shallow = 0.05, deep = 0.32
  if (t >= WALK_END) {
    const x = (t - WALK_END) / 0.12
    return shallow + (deep - shallow) * clamp01(x * x)
  }
  // a tick each time a pair plants
  const within = (p * 2) % 1
  const tick = p > 0 && p < BEAT.cycles ? Math.max(0, 1 - Math.abs(within - 0.02) / 0.06) : 0
  return shallow * tick
}

export function lionPose(time: number): LionPose {
  const t = seconds(time)
  const p = gaitPhase(t)
  const z = travel(p)
  const walking = smooth(p / 0.3) * smooth((BEAT.cycles - p) / 0.15)
  let bob = 0.008 * walking * (0.5 - 0.5 * Math.cos(4 * Math.PI * p))
  let roll = 0.01 * walking * Math.sin(2 * Math.PI * p)
  bob += jolt(t, BEAT.release, 0.004) + jolt(t, WALK_END, 0.004)
  const pitch = jolt(t, BEAT.release, 0.006) - jolt(t, WALK_END, 0.007)
  roll += jolt(t, WALK_END, 0.003)
  const legs = {} as Record<LegId, [number, number, number]>
  for (const leg of LEGS) {
    const { fore } = LEG[leg]
    const S = fore ? K.SH : K.HP, Kn = fore ? K.KF : K.KH, W = fore ? K.WF : K.WH
    const f = paw(leg, p)
    const ty = W[1] + f.lift - bob, tz = f.z - z
    legs[leg] = legIK(S, Kn, W, [ty, tz])
  }
  // The crank shafts turn once per cycle; the great wheel and the barrel
  // turn RATIO times slower, the other way.
  const crank = 2 * Math.PI * p
  const winding = smoother((t - BEAT.key0) / (BEAT.key1 - BEAT.key0))
  // the key steps round in quarter turns, the click taking each one
  const quarters = winding * BEAT.keyTurns * 4
  const stepped = Math.floor(quarters) + smooth((quarters % 1) * 1.6)
  const key = 2 * Math.PI * Math.min(stepped / 4, BEAT.keyTurns)
  const latch = LATCH_LIFT * smooth((t - BEAT.latch0) / (BEAT.latch1 - BEAT.latch0))
  const door = DOOR_OPEN * (0.03 * smooth((t - BEAT.latch1) / 0.1) + 0.97 * smoother((t - BEAT.door0) / (BEAT.door1 - BEAT.door0)))
  const run = smoother((t - BEAT.rack0) / (BEAT.rack1 - BEAT.rack0))
  return {
    z, bob, pitch, roll, legs,
    key, barrel: -crank / RATIO, foreCrank: crank, hindCrank: crank + Math.PI,
    count: -crank / RATIO, detent: detentAt(t, p), pull: smooth((t - WALK_END) / 0.12) * 0.03,
    latch, door, rack: RACK_RUN * run, lilyPinion: RACK_RUN * run / 0.022, lilyBloom: run,
    phase: p,
  }
}

/** The joint coordinates the dossier names, at this moment. */
export function lionJoints(time: number): Record<string, number> {
  const q = lionPose(time)
  const out: Record<string, number> = {
    travel: q.z, key: q.key, barrel: q.barrel, 'great-wheel': q.barrel,
    'fore-crank': q.foreCrank, 'hind-crank': q.hindCrank, 'count-wheel': q.count,
    detent: q.detent, 'latch-rod': q.pull, latch: q.latch,
    'door-left': q.door, 'door-right': -q.door, 'lily-rack': q.rack, 'lily-pinion': q.lilyPinion,
  }
  for (const leg of LEGS) {
    const [a1, a2, a3] = q.legs[leg]
    out[`${leg}-upper`] = a1
    out[`${leg}-lower`] = a2
    out[`${leg}-paw`] = a3
  }
  return out
}
