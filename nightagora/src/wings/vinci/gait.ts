/** THE WALK BETWEEN TWO STATIONS IS A PERSON WALKING.
 * A leg is not a constant-velocity rail and not one smoothstep over its whole
 * length: the body leans into the walk, strolls, and leans out of it at the
 * station. Every number below is a walking quantity with its own measurement,
 * not a tuning constant, and `gait-check.mjs` reports all of them.
 */

/** THE PACE THE VISITOR SETS, in metres per second. Three, and the middle one
 * is the museum's own walk: at a stroll the rooms of this insertion are half a
 * minute apart, which is a long time to watch a floor. The stroll is kept as
 * the pace the walk was measured at, and the brisk one is a person late for
 * something, not a run.
 */
export const GAIT_PACES = { stroll: 1.6, walk: 2.4, brisk: 3.6 } as const
export type GaitPaceName = keyof typeof GAIT_PACES
/** The stroll, which is what every quantity below was measured against. */
export const strollMetresPerSecond = GAIT_PACES.stroll
/** ONE KEY ON THE DEVICE, like the visit record: a refused store forgets the
 * choice quietly rather than making a visitor answer for their browser. */
const PACE_KEY = 'na-gait-pace'
const named = (value: string | null): GaitPaceName | null =>
  value === 'stroll' || value === 'walk' || value === 'brisk' ? value : null
let pace: GaitPaceName = (() => {
  try { return named(localStorage.getItem(PACE_KEY)) ?? 'walk' } catch { return 'walk' }
})()
export const gaitPace = (): GaitPaceName => pace
export const gaitMetresPerSecond = (): number => GAIT_PACES[pace]
export function setGaitPace(next: GaitPaceName): void {
  pace = next
  try { localStorage.setItem(PACE_KEY, next) } catch { /* a refused store forgets */ }
}
/** Getting under way and stopping. A walker reaches a stroll in about a
 * second and gives the stop a little longer, because a stop is a choice. */
const ACCEL_SECONDS = .9, BRAKE_SECONDS = 1.1
/** A leg never cuts, and a mark on the far side of the museum is a traverse
 * rather than a claim about anyone's pace: past the ceiling the cruise rises.
 * The ceiling is what lets the longest room in the insertion still be walked
 * at a stroll: forty metres is the longest leg that keeps one. */
const MIN_SECONDS = 1.1, MAX_SECONDS = 26
/** One step at this pace. The cadence follows from the speed, it is not set. */
export const stepMetres = .68
/** The rhythm a walker feels in the eye and never notices: 18 mm of rise and
 * fall at the step, 12 mm of sway at the stride. */
const BOB_M = .009, SWAY_M = .006
/** The distance over which the rhythm arrives and leaves, so a station is
 * reached at the exact certified eye however the visitor got there. */
const RHYTHM_FADE_M = 1
/** Past the pace being walked a step rhythm would be a lie about it: a
 * traverse across the whole site carries no step, and the fade ends just above
 * the walking band, so a leg either walks with its rhythm or traverses without
 * one. The band moves with the pace; the RISE AND FALL ITSELF DOES NOT, which
 * is why the clearance certificate's gait envelope is the same number at every
 * pace. */
const RHYTHM_NONE_SHARE = 1.75 / 1.6
/** A visitor who has already asked for the station after this one is not
 * strolling, so the leg's own clock runs at the pace of the asking: each
 * station still waiting adds its share, up to four. The step rhythm goes out
 * with the first of them, because a walker being carried on is not stepping
 * at a stroll's cadence. */
const CARRIED_SHARE = .9, CARRIED_MAX = 4

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
/** Smoothstep: the velocity shape of getting under way and of stopping. */
const shape = (u: number) => { const x = clamp01(u); return x * x * (3 - 2 * x) }
/** Its integral, so the distance is closed form and never accumulated. */
const shapeArea = (u: number) => { const x = clamp01(u); return x * x * x - x * x * x * x / 2 }

export interface GaitLeg {
  lengthM: number
  seconds: number
  cruiseMetresPerSecond: number
  accelSeconds: number
  brakeSeconds: number
  cadenceStepsPerSecond: number
  rhythm: number
}

/** The timing of one leg, from its length alone. */
export function gaitLeg(lengthM: number): GaitLeg {
  const length = Math.max(0, Number.isFinite(lengthM) ? lengthM : 0)
  const walk = gaitMetresPerSecond()
  const full = walk, none = walk * RHYTHM_NONE_SHARE
  const ramps = ACCEL_SECONDS + BRAKE_SECONDS
  const seconds = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, ramps / 2 + length / walk))
  // A leg too short for both ramps keeps their proportion and loses its cruise.
  const scale = Math.min(1, seconds / ramps)
  const accelSeconds = ACCEL_SECONDS * scale, brakeSeconds = BRAKE_SECONDS * scale
  const cruiseMetresPerSecond = length / (seconds - (accelSeconds + brakeSeconds) / 2)
  return {
    lengthM: length, seconds, cruiseMetresPerSecond, accelSeconds, brakeSeconds,
    cadenceStepsPerSecond: cruiseMetresPerSecond / stepMetres,
    rhythm: clamp01((none - cruiseMetresPerSecond) / (none - full)),
  }
}

/** Where the body is along the leg, and how fast it is going, at one instant. */
export function gaitAt(leg: GaitLeg, seconds: number): { metres: number; metresPerSecond: number } {
  const { lengthM, seconds: total, cruiseMetresPerSecond: cruise, accelSeconds: accel, brakeSeconds: brake } = leg
  const t = Math.max(0, Math.min(total, Number.isFinite(seconds) ? seconds : 0))
  if (accel > 0 && t <= accel) return { metres: cruise * accel * shapeArea(t / accel), metresPerSecond: cruise * shape(t / accel) }
  if (t <= total - brake) return { metres: cruise * (accel / 2 + (t - accel)), metresPerSecond: cruise }
  const u = brake > 0 ? (total - t) / brake : 0
  return { metres: lengthM - cruise * brake * shapeArea(u), metresPerSecond: cruise * shape(u) }
}

/** The step rhythm at one point along the leg: a rise and fall at the step
 * and a sway at the stride, in metres, in the walker's own frame. Both ends
 * are exactly zero, so an arrival lands on the certified eye.
 */
export function gaitRhythm(leg: GaitLeg, metres: number, reducedMotion: boolean): { height: number; sway: number } {
  const amount = reducedMotion ? 0
    : leg.rhythm * clamp01(metres / RHYTHM_FADE_M) * clamp01((leg.lengthM - metres) / RHYTHM_FADE_M)
  if (!(amount > 0)) return { height: 0, sway: 0 }
  const phase = Math.PI * metres / stepMetres
  return { height: -BOB_M * amount * Math.cos(2 * phase), sway: SWAY_M * amount * Math.sin(phase) }
}

/** How fast the leg under way runs when stations are already waiting behind
 * it. One is the stroll the leg was timed at. */
export function carriedPace(waiting: number): number {
  const stations = Math.max(0, Math.min(CARRIED_MAX, Math.floor(Number.isFinite(waiting) ? waiting : 0)))
  return 1 + CARRIED_SHARE * stations
}

/** The largest distance the rhythm can carry the eye off its certified path. */
export const gaitEnvelopeM = Math.hypot(BOB_M, SWAY_M)

export interface GaitThreshold { east: number; north: number; radiusM: number; radians: number }

/** A walker lifts the head to what is about to stand over them: the gallery
 * mouth on the street, the step down from the court, the stair to the
 * terrace. Small, and gone again once it is passed.
 */
export function gaitHeadLift(thresholds: readonly GaitThreshold[], east: number, north: number): number {
  let lift = 0
  for (const threshold of thresholds) {
    const distance = Math.hypot(east - threshold.east, north - threshold.north)
    if (distance >= threshold.radiusM) continue
    const near = 1 - distance / threshold.radiusM
    lift = Math.max(lift, threshold.radians * near * near * (3 - 2 * near))
  }
  return lift
}
