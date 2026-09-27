/** THE HELD VIEW. A walk past the hang, or out through a door, is taken
 * with one steady view, and the view turns at most twice: once at the start,
 * to the view it walks with, and once at the end, to the view it arrives at.
 * A view led down the room and turned back to the wall would turn twice as
 * far; a view that pans the whole length swings across every frame it
 * passes, and one that lifts on its way under a door head sweeps the head
 * through the top of the frame. The caller says which parts turn first.
 *
 * Each turn is the rail's pan (a half cosine in, a held rate, a half cosine
 * out) under a share of the calm caps; the two never overlap, and the walk is
 * slowed only when they do not fit it. The lens changes at one end, with that
 * end's turn and for as long as it needs.
 */
import { gaitAt, gaitSecondsAt, type GaitLeg } from './gait'
import { CALM_FILM, CALM_GAZE, type CalmGazePlan, type GazeAngles } from './rail-gaze'

const RAD = Math.PI / 180
/** The pans hold under this share of the caps, as the rail's own pan does. */
const PAN_SHARE = .95
/** The least share of the leg the arriving turn is given, so a small turn is
 * slow, and the most a long walk gives it: there the turn belongs to the
 * walk's second half, and a walk too short for that is slowed, as a visitor
 * slows to turn to a work. */
export const GALLERY_TURN_SHARE = .4, GALLERY_TURN_MOST = .5
/** A view that leaves looking further down than this below the one it goes to
 * is lifted first. */
export const GALLERY_LIFT_RAD = 4 * Math.PI / 180
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * x * (10 + x * (6 * x - 15)) }

interface Caps { rate: number; accel: number; jerk: number; least: number }
interface Pan { seconds: number; ease: number; rate: number }
/** One pan of `angle` degrees in at least `seconds`: the gentlest ease the time allows. */
function pan(angle: number, seconds: number, caps: Caps): Pan {
  let span = Math.max(0, seconds), ease = span / 2, rate = 0
  for (let attempt = 0; attempt < 40 && angle > 1e-6; attempt++) {
    ease = Math.min(span / 2, Math.max(caps.least, span - angle / caps.rate))
    rate = span > ease ? 1 / (span - ease) : 0
    const peak = rate * angle, accel = Math.PI * peak / (2 * ease), jerk = Math.PI * Math.PI * peak / (2 * ease * ease)
    if (peak <= caps.rate + 1e-9 && accel <= caps.accel + 1e-9 && jerk <= caps.jerk + 1e-9) break
    span *= 1.05
  }
  return angle > 1e-6 ? { seconds: span, ease, rate } : { seconds: 0, ease: 0, rate: 0 }
}
function progressOf(p: Pan, s: number): number {
  if (p.seconds === 0 || s >= p.seconds) return 1
  if (s <= 0) return 0
  const ramp = (x: number) => p.rate * (x / 2 - p.ease / (2 * Math.PI) * Math.sin(Math.PI * x / p.ease))
  if (s <= p.ease) return ramp(s)
  if (s >= p.seconds - p.ease) return 1 - ramp(p.seconds - s)
  return p.rate * (p.ease / 2 + (s - p.ease))
}

export function planGalleryGaze(input: {
  from: GazeAngles; to: GazeAngles
  /** the change of the lens, as the log of the picture's scale */
  zoom: number
  timed: (atLeastSeconds: number) => GaitLeg
  /** the film's focal length in its own pixels at the narrower lens */
  lensPixels: number
  /** what changes at the start instead of the end */
  first: { heading: boolean; elevation: boolean; lens: boolean }
  /** a long walk, whose arriving turn keeps to its second half */
  long: boolean
}): CalmGazePlan {
  const byLens = input.lensPixels > 0 ? CALM_FILM.pixelsPerFrame * CALM_FILM.framesPerSecond / input.lensPixels / RAD : Infinity
  const share = Math.min(1, byLens / CALM_GAZE.turnDegPerSecond) * PAN_SHARE
  const rate = CALM_GAZE.turnDegPerSecond * share, accel = CALM_GAZE.turnDegPerSecond2 * share, jerk = CALM_GAZE.turnDegPerSecond3 * share
  const caps: Caps = { rate, accel, jerk, least: Math.max(Math.PI * rate / (2 * accel), Math.PI * Math.sqrt(rate / (2 * jerk))) }
  const turnHeading = wrap(input.to.heading - input.from.heading), turnElevation = input.to.elevation - input.from.elevation
  const firstHeading = input.first.heading ? turnHeading : 0, firstElevation = input.first.elevation ? turnElevation : 0
  const lastHeading = turnHeading - firstHeading, lastElevation = turnElevation - firstElevation
  const firstAngle = Math.hypot(firstHeading, firstElevation) / RAD, lastAngle = Math.hypot(lastHeading, lastElevation) / RAD
  const lensSeconds = 1.875 * Math.abs(input.zoom) / CALM_GAZE.zoomPerSecond
  const least = (angle: number) => angle > 1e-6 ? angle / caps.rate + caps.least : 0
  const first = pan(firstAngle, least(firstAngle), caps), lastLeast = pan(lastAngle, least(lastAngle), caps).seconds
  // the lens runs from its end of the leg for as long as it needs, at least as long as that end's turn
  const base = input.timed(0), needs = Math.max(first.seconds + lastLeast, lensSeconds, input.long ? lastLeast / GALLERY_TURN_MOST : 0)
  const leg = needs > base.seconds ? input.timed(needs) : base
  const total = leg.seconds
  // the arriving turn takes the walk's last part, slower where the leg has room
  const last = pan(lastAngle, Math.max(lastLeast, Math.min(total - first.seconds, lastAngle > 1e-6 ? GALLERY_TURN_SHARE * total : 0)), caps)
  const lastStart = total - last.seconds
  const lens: [number, number] = input.first.lens ? [0, Math.min(total, Math.max(first.seconds, lensSeconds))] : [Math.max(0, Math.min(lastStart, total - lensSeconds)), total]
  return {
    leg, stretch: leg.seconds / base.seconds, kind: `gallery${input.first.heading ? ' first' : ''}`,
    at(seconds, target) {
      const a = seconds >= total ? 1 : progressOf(first, seconds)
      const b = seconds >= total ? 1 : progressOf(last, seconds - lastStart)
      target.heading = input.from.heading + firstHeading * a + lastHeading * b
      target.elevation = a >= 1 && b >= 1 ? input.to.elevation : input.from.elevation + firstElevation * a + lastElevation * b
      return target
    },
    lens: seconds => lens[1] > lens[0] ? smooth((seconds - lens[0]) / (lens[1] - lens[0])) : seconds >= lens[1] ? 1 : 0,
    walk: seconds => gaitAt(leg, seconds),
    secondsAt: metres => gaitSecondsAt(leg, metres),
  }
}
