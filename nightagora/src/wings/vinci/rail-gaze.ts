/** THE CALM GAZE. A leg's view is planned once, when the leg begins, as a
 * smooth curve in time from the view it leaves to the composition it arrives
 * in, following where the way leads in between. The curve is held under a
 * turn rate, its acceleration and its jerk, and when a leg's turning cannot
 * fit its walk under them the walk is slowed until it does: a person turning
 * round slows down, a camera that turns fast smears in the film.
 *
 * The curve is a clamped cubic B-spline whose first three and last three
 * control points are the two held views, so it leaves and arrives with no
 * rate and no acceleration, and it lands on the arriving view exactly.
 */
import { gaitAt, gaitLeg, gaitMetresPerSecond, gaitSecondsAt, type GaitLeg } from './gait'

/** What the plan holds under. `calm-check.mjs` carries the criteria; these sit
 * a margin below them so the frames it samples never read the plan's peak. */
export const CALM_GAZE = { turnDegPerSecond: 11, turnDegPerSecond2: 11, turnDegPerSecond3: 36, zoomPerSecond: .13 } as const
/** The limiter's own rate, under the plan's cap: the spline that smooths its
 * corners rounds them a little past it. The pitch turns at a share of it. */
const LEAD_DEG_PER_SECOND = 9.4, PITCH_SHARE = .45
/** THE PICTURE MAY NOT MOVE MORE THAN THIS PER FILM FRAME, in the film's own
 * pixels at its centre: a frame width in no less than seven seconds at 1920
 * px and 30 frames, under the checker's 9. A narrow lens magnifies a turn,
 * so the caps above fall with the lens where this binds first. */
export const CALM_FILM = { pixelsPerFrame: 8.2, framesPerSecond: 30 } as const
/** The film's focal length in its own pixels for an authored lens: the film
 * keeps the authored width, landscape 1920 px wide and portrait 1080. */
export function filmLensPixels(authoredFov: number, phone: boolean): number {
  const halfWidth = phone ? 540 : 960, aspect = phone ? 390 / 844 : 1280 / 720
  return halfWidth / (Math.tan(authoredFov * Math.PI / 360) * aspect)
}
/** The caps of the plan under way, the degrees above scaled to its lens. */
let caps = { rate: 11, accel: 11, jerk: 36, lead: LEAD_DEG_PER_SECOND }
function capsFor(lensPixels: number) {
  const byLens = lensPixels > 0 ? CALM_FILM.pixelsPerFrame * CALM_FILM.framesPerSecond / lensPixels / RAD : Infinity
  const share = Math.min(1, byLens / CALM_GAZE.turnDegPerSecond)
  return { rate: CALM_GAZE.turnDegPerSecond * share, accel: CALM_GAZE.turnDegPerSecond2 * share, jerk: CALM_GAZE.turnDegPerSecond3 * share, lead: LEAD_DEG_PER_SECOND * share }
}
/** The target is read at this step; the spline's knots are never closer than
 * the first spacing, which is what bounds its acceleration. */
const GRID_SECONDS = 1 / 30, SPACINGS = [1.4, 2, 2.8, 4, 5.6, 8, Infinity], CHECK_HZ = 60
const STRETCH_TRIES = 14
/** Beyond the turn itself at the lead's rate, the time the curve takes to
 * get under way and to settle. */
const EASE_SECONDS = 2.5
const RAD = Math.PI / 180
const FLIP = 100 * RAD
/** The stretch of way either side of the body its direction is averaged
 * over, and the agreement of directions below which it is not followed. */
const WAY_WINDOW_M = 3, STRAIGHT_LEAST = .6
/** A walk that turns out of one room and into the next is slowed up to this
 * much so its view can lead the way between them; past it the view follows
 * the way less, and the walk is not slowed further for the way's sake. */
const COURSE_STRETCH = 2.2, COURSE_SHARES = [1, .6, .3]
/** A pan is closed form and read exactly, so it holds nearer its caps than
 * a fitted curve can. */
const PAN_SHARE = .95
/** THE FLOOR OF A STATION WALK, at the walk pace and scaled with the pace
 * chosen: the body never slower than the first figure between its ramps, and
 * a stretch never longer than its length at the second (or than its own walk
 * where its ramps alone keep it under that). What a turn or the lens cannot
 * take at these speeds is made standing. A leg under the last figure keeps
 * its own timing unless it is planned again for walking backward. */
const FLOOR_MPS = 1, FLOOR_AVERAGE_MPS = 1.4, FLOOR_PACE = 2.4, FLOOR_LEAST_M = 6
const floorShare = (): number => gaitMetresPerSecond() / FLOOR_PACE
const floorSeconds = (lengthM: number): number => Math.max(gaitLeg(lengthM).seconds, lengthM / (FLOOR_AVERAGE_MPS * floorShare()))

export interface GazeAngles { heading: number; elevation: number }
/** Where the way leads from a body position, and how much the view should
 * follow it there (1 on the open way, 0 where the arriving view takes over). */
export interface GazeCourse extends GazeAngles { weight: number }

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * x * (10 + x * (6 * x - 15)) }

/** The clamped knot vector of a cubic with `spans` equal spans over [0, T]. */
function knotsOf(spans: number, total: number): number[] {
  const knots = [0, 0, 0, 0]
  for (let i = 1; i < spans; i++) knots.push(total * i / spans)
  knots.push(total, total, total, total)
  return knots
}
/** The four non-zero basis values at `u` and the first control point they
 * weigh (the standard Cox and de Boor recurrence for a clamped cubic). */
function basis(knots: readonly number[], controls: number, u: number, out: Float64Array): number {
  const last = controls - 1
  let span = 3
  if (u >= knots[controls]!) span = last
  else { let low = 3, high = controls; while (high - low > 1) { const mid = (low + high) >> 1; if (u < knots[mid]!) high = mid; else low = mid }; span = low }
  const left = [0, 0, 0, 0], right = [0, 0, 0, 0]
  out[0] = 1
  for (let j = 1; j <= 3; j++) {
    left[j] = u - knots[span + 1 - j]!
    right[j] = knots[span + j]! - u
    let saved = 0
    for (let r = 0; r < j; r++) {
      const temp = out[r]! / (right[r + 1]! + left[j - r]!)
      out[r] = saved + right[r + 1]! * temp
      saved = left[j - r]! * temp
    }
    out[j] = saved
  }
  return span - 3
}

interface Spline { knots: number[]; heading: Float64Array; elevation: Float64Array; total: number }
const weights = new Float64Array(4)
function evaluate(spline: Spline, tau: number, target: GazeAngles): GazeAngles {
  const controls = spline.heading.length
  if (tau <= 0) { target.heading = spline.heading[0]!; target.elevation = spline.elevation[0]!; return target }
  if (tau >= spline.total) { target.heading = spline.heading[controls - 1]!; target.elevation = spline.elevation[controls - 1]!; return target }
  const first = basis(spline.knots, controls, tau, weights)
  let heading = 0, elevation = 0
  for (let i = 0; i < 4; i++) { heading += weights[i]! * spline.heading[first + i]!; elevation += weights[i]! * spline.elevation[first + i]! }
  target.heading = heading; target.elevation = elevation
  return target
}

/** Least squares for the free control points, the six held ones fixed. A
 * whisper of third-difference penalty keeps a sparse span well posed. */
function fit(samples: Float64Array, times: Float64Array, from: number, to: number, spans: number, total: number): { knots: number[]; points: Float64Array } {
  const knots = knotsOf(spans, total), controls = spans + 3, free = controls - 6
  const points = new Float64Array(controls)
  points[0] = points[1] = points[2] = from
  points[controls - 1] = points[controls - 2] = points[controls - 3] = to
  if (free <= 0) return { knots, points }
  const normal = new Float64Array(free * free), rhs = new Float64Array(free), row = new Float64Array(4)
  for (let k = 0; k < samples.length; k++) {
    const first = basis(knots, controls, times[k]!, row)
    let known = 0
    for (let i = 0; i < 4; i++) { const c = first + i; if (c < 3 || c >= controls - 3) known += row[i]! * points[c]! }
    for (let i = 0; i < 4; i++) {
      const a = first + i - 3
      if (a < 0 || a >= free) continue
      rhs[a] = rhs[a]! + row[i]! * (samples[k]! - known)
      for (let j = 0; j < 4; j++) { const b = first + j - 3; if (b >= 0 && b < free) normal[a * free + b] = normal[a * free + b]! + row[i]! * row[j]! }
    }
  }
  const ridge = 1e-6 * samples.length / controls
  for (let r = 0; r + 3 < controls; r++) {
    const stencil = [-1, 3, -3, 1]
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const a = r + i - 3, b = r + j - 3
      if (a >= 0 && a < free && b >= 0 && b < free) normal[a * free + b] = normal[a * free + b]! + ridge * stencil[i]! * stencil[j]!
      else if (a >= 0 && a < free && (b < 0 || b >= free)) rhs[a] = rhs[a]! - (ridge * stencil[i]! * stencil[j]! * points[r + j]!)
    }
  }
  // Gaussian elimination with partial pivoting; the system is a few dozen wide.
  for (let c = 0; c < free; c++) {
    let pivot = c
    for (let r = c + 1; r < free; r++) if (Math.abs(normal[r * free + c]!) > Math.abs(normal[pivot * free + c]!)) pivot = r
    if (pivot !== c) {
      for (let k = 0; k < free; k++) { const t = normal[c * free + k]!; normal[c * free + k] = normal[pivot * free + k]!; normal[pivot * free + k] = t }
      const t = rhs[c]!; rhs[c] = rhs[pivot]!; rhs[pivot] = t
    }
    const d = normal[c * free + c]!
    for (let r = c + 1; r < free; r++) {
      const f = normal[r * free + c]! / d
      if (f === 0) continue
      for (let k = c; k < free; k++) normal[r * free + k] = normal[r * free + k]! - f * normal[c * free + k]!
      rhs[r] = rhs[r]! - f * rhs[c]!
    }
  }
  for (let c = free - 1; c >= 0; c--) {
    let sum = rhs[c]!
    for (let k = c + 1; k < free; k++) sum -= normal[c * free + k]! * points[k + 3]!
    points[c + 3] = sum / normal[c * free + c]!
  }
  return { knots, points }
}

/** The peaks a camera driven by the spline would show at the check's rate:
 * turn rate, its acceleration and its jerk, in degrees. */
function peaks(spline: Spline): { rate: number; accel: number; jerk: number } {
  const step = 1 / CHECK_HZ, count = Math.max(4, Math.ceil(spline.total / step))
  const at = { heading: 0, elevation: 0 }
  let rate = 0, accel = 0, jerk = 0
  let previous = evaluate(spline, 0, { heading: 0, elevation: 0 })
  let r1x = 0, r1y = 0, a1x = 0, a1y = 0, have = 0
  for (let i = 1; i <= count + 2; i++) {
    evaluate(spline, Math.min(spline.total, i * step), at)
    // The whole camera turns, not only its line of sight: a pitched view
    // turning about the vertical also rolls its picture, so no cosine here.
    const rx = (at.heading - previous.heading) / step
    const ry = (at.elevation - previous.elevation) / step
    rate = Math.max(rate, Math.hypot(rx, ry))
    if (have >= 1) {
      const ax = (rx - r1x) / step, ay = (ry - r1y) / step
      accel = Math.max(accel, Math.hypot(ax, ay))
      if (have >= 2) jerk = Math.max(jerk, Math.hypot(ax - a1x, ay - a1y) / step)
      a1x = ax; a1y = ay
    }
    r1x = rx; r1y = ry; have++
    previous = { heading: at.heading, elevation: at.elevation }
  }
  return { rate: rate / RAD, accel: accel / RAD, jerk: jerk / RAD }
}

/** Held under a rate: followed forward from the leaving view, then kept
 * inside the cone the arriving view can still be reached from. Both bounds
 * move at the rate, so what lies between them does too, and it leaves and
 * lands on the two held views whenever the leg is long enough to turn. */
function limit(target: Float64Array, from: number, to: number, perStep: number, times: Float64Array, total: number): Float64Array {
  const n = target.length, out = new Float64Array(n), perSecond = perStep / (total / Math.max(1, n - 1))
  // Followed forward it lags a bend, followed backward it leads it; the mean
  // of the two turns through the bend centred on it, as a walker's eye does.
  let x = from
  for (let k = 0; k < n; k++) { if (k > 0) x += Math.max(-perStep, Math.min(perStep, target[k]! - x)); out[k] = x }
  let y = to
  for (let k = n - 1; k >= 0; k--) { if (k < n - 1) y += Math.max(-perStep, Math.min(perStep, target[k]! - y)); out[k] = (out[k]! + y) / 2 }
  for (let k = 0; k < n; k++) {
    const early = perSecond * times[k]!, late = perSecond * (total - times[k]!)
    out[k] = Math.max(to - late, Math.min(to + late, Math.max(from - early, Math.min(from + early, out[k]!))))
  }
  return out
}

export interface CalmGazePlan {
  /** the leg's timing, slowed where the turning asked for it */
  leg: GaitLeg
  /** how much the walk was slowed, 1 where it was not */
  stretch: number
  /** how the view was led: the share of the way it follows, or a pan */
  kind: string
  /** the view at a time of the leg's own clock; exact at both ends */
  at(seconds: number, target: GazeAngles): GazeAngles
  /** the lens's blend at a time, 0 leaving and 1 arriving */
  lens(seconds: number): number
  /** where the body is along the way at a time of the leg's clock */
  walk(seconds: number): { metres: number; metresPerSecond: number }
  /** when the body reaches a distance along the way */
  secondsAt(metres: number): number
  /** a turned walk the film's heading gate would read red */
  red?: boolean
}

/** seconds walked at a walker's pace facing more than a right angle off the
 * way, past the first metre (a pull-back from the eye) */
function walkedBackward(plan: CalmGazePlan, course: (metres: number, until?: number) => GazeCourse): number {
  const T = plan.leg.seconds, view: GazeAngles = { heading: 0, elevation: 0 }
  let back = 0
  for (let t = 0; t <= T; t += 1 / 15) {
    const w = plan.walk(t)
    if (w.metresPerSecond < .5 || w.metres <= PULL_BACK_MOST_M) continue
    if (Math.abs(wrap(course(w.metres).heading - plan.at(t, view).heading)) > Math.PI / 2) back += 1 / 15
  }
  return back
}
export function planCalmGaze(input: {
  from: GazeAngles; to: GazeAngles
  /** the change of the lens, as the log of the picture's scale */
  zoom: number
  /** the leg timed to at least a number of seconds */
  timed: (atLeastSeconds: number) => GaitLeg
  /** where the way leads from a body position, read no further along it
   * than `until`, or null where the leg is a step between two held views and
   * nothing but those two is looked at */
  course: ((metres: number, until?: number) => GazeCourse) | null
  lengthM: number
  /** the film's focal length in its own pixels at the narrower of the two
   * lenses, which is what turns degrees into picture motion */
  lensPixels: number
  /** where the body may stand still and turn, on a walk that follows its way */
  turns?: GazeTurns
  /** the two lenses as the stage fits them, in degrees, leaving and arriving */
  fovs?: readonly [number, number]
  /** the way's own direction between two distances along it: over a stride
   * either side of the body, it is what the film's gate reads the walk against */
  tangent?: (from: number, to: number) => number
}): CalmGazePlan {
  // A WALK THAT FALLS UNDER THE FLOOR is planned again under it: never slowed
  // for its view, standing and quick where its view faces away from its way.
  // A walk above the floor keeps the plan it has.
  if (input.turns?.floor) {
    const free = planCalmGaze({ ...input, turns: { ...input.turns, floor: false } })
    if (!input.course) return free
    const freeRed = input.tangent ? gateRed(free, input.tangent) : free.red === true
    const slow = input.lengthM >= FLOOR_LEAST_M && !holdsFloor(free)
    const backward = input.turns.forward === true && walkedBackward(free, input.course) > BACKWARD_SECONDS
    if (!slow && !backward && !freeRed && input.turns.turned !== true) return free
    const floored = planTurns({ ...input, turns: { ...input.turns, mayEnds: true } } as TurnInput)
    if (!floored || slow) return floored ?? free
    // a walk the floor holds is changed only where the change is not red and
    // walks backward at most half as long
    if (floored.red === true && !freeRed) return free
    if (input.turns.turned === true) return floored
    return backward && walkedBackward(floored, input.course) > Math.max(BACKWARD_SECONDS, walkedBackward(free, input.course) / 2) ? free : floored
  }
  if (input.course && input.turns) {
    const turning = planTurns(input as TurnInput)
    if (turning) return turning
  }
  return planWay(input)
}

/** Whether a plan's walking keeps the floor: each run of the body no longer
 * than its floor, and nowhere slower than its speed between the ramps. A run
 * of a metre or less is a pull-back and keeps its own time. */
function holdsFloor(plan: CalmGazePlan): boolean {
  const T = plan.leg.seconds, step = .05, least = FLOOR_MPS * floorShare() * .98
  const runs: { from: number; to: number; metres: number }[] = []
  let open = -1, startM = 0
  for (let t = 0; t <= T + step / 2; t += step) {
    const w = plan.walk(Math.min(t, T)), moving = t < T && w.metresPerSecond > STILL_MPS
    if (moving && open < 0) { open = t; startM = w.metres }
    if (!moving && open >= 0) { runs.push({ from: open, to: t, metres: w.metres - startM }); open = -1 }
  }
  for (const r of runs) {
    if (r.metres <= 1.05) continue
    if (r.to - r.from > floorSeconds(r.metres) + .15) return false
    for (let t = r.from + 2; t <= r.to - 2.4; t += step) if (plan.walk(t).metresPerSecond < least) return false
  }
  return true
}

function planWay(input: Parameters<typeof planCalmGaze>[0]): CalmGazePlan {
  const base = input.timed(0)
  // THE WAY IS READ ONCE, by the metre, so slowing the walk costs no second
  // reading of the path; the heading is unwrapped along it as it is read.
  const wayStep = Math.max(.05, input.lengthM / 600), wayCount = Math.max(1, Math.ceil(input.lengthM / wayStep))
  const way = input.course ? { heading: new Float64Array(wayCount + 1), elevation: new Float64Array(wayCount + 1), weight: new Float64Array(wayCount + 1) } : null
  if (way && input.course) {
    let held = input.from.heading
    for (let i = 0; i <= wayCount; i++) {
      const read = input.course(Math.min(input.lengthM, i * wayStep))
      // A way turns by degrees per step; a reading that flips by more is the
      // look ahead jumping across a bend, which no walker follows, and an
      // unwrap across it would count a half turn that was never walked.
      const turned = wrap(read.heading - held), flipped = i > 0 && Math.abs(turned) > FLIP
      if (!flipped) held += turned
      way.heading[i] = held; way.elevation[i] = read.elevation; way.weight[i] = flipped ? 0 : Math.max(0, Math.min(1, read.weight))
    }
    // THE WAY, NOT ITS WIGGLES. The heading is averaged as a direction over a
    // few metres either side, and where those directions disagree (a bend
    // doubling back, a flight of steps turning) the view is not led round it
    // at all: it holds its line and lets the arriving view take it.
    const half = Math.max(1, Math.round(WAY_WINDOW_M / wayStep)), cos = new Float64Array(wayCount + 2), sin = new Float64Array(wayCount + 2)
    for (let i = 0; i <= wayCount; i++) { cos[i + 1] = cos[i]! + Math.cos(way.heading[i]!); sin[i + 1] = sin[i]! + Math.sin(way.heading[i]!) }
    const raw = way.heading.slice()
    for (let i = 0; i <= wayCount; i++) {
      const low = Math.max(0, i - half), high = Math.min(wayCount, i + half), n = high - low + 1
      const c = (cos[high + 1]! - cos[low]!) / n, s = (sin[high + 1]! - sin[low]!) / n
      way.heading[i] = raw[i]! + wrap(Math.atan2(s, c) - raw[i]!)
      way.weight[i] = way.weight[i]! * Math.max(0, Math.min(1, (Math.hypot(c, s) - STRAIGHT_LEAST) / (1 - STRAIGHT_LEAST)))
    }
  }
  const wayAt = (metres: number, target: GazeCourse): GazeCourse => {
    const x = Math.max(0, Math.min(wayCount, metres / wayStep)), i = Math.min(wayCount - 1, Math.floor(x)), f = x - i
    target.heading = way!.heading[i]! + (way!.heading[i + 1]! - way!.heading[i]!) * f
    target.elevation = way!.elevation[i]! + (way!.elevation[i + 1]! - way!.elevation[i]!) * f
    target.weight = way!.weight[i]! + (way!.weight[i + 1]! - way!.weight[i]!) * f
    return target
  }
  const read: GazeCourse = { heading: 0, elevation: 0, weight: 0 }
  const lensSeconds = 1.875 * Math.abs(input.zoom) / CALM_GAZE.zoomPerSecond
  caps = capsFor(input.lensPixels)
  const rate = caps.lead * RAD
  // The way's own last heading, which decides which way round the arriving
  // view is turned to while the way is followed.
  let endHeld = input.from.heading
  if (way) for (let i = wayCount; i >= 0; i--) if (way.weight[i]! > 0) { endHeld = way.heading[i]!; break }
  if (!way) return panPlan(input.from, input.to, Math.max(base.seconds, lensSeconds), input.timed, base)
  let leg = base, spline: Spline | null = null, total = base.seconds, followed = 0
  for (const share of COURSE_SHARES) {
    const toHeading = share > 0 ? endHeld + wrap(input.to.heading - endHeld) : input.from.heading + wrap(input.to.heading - input.from.heading)
    // A leg too short to turn from one held view to the other at the lead's
    // rate is slowed until it is not, with time left over to ease both ends.
    const owed = Math.max(Math.abs(toHeading - input.from.heading) / rate,
      Math.abs(input.to.elevation - input.from.elevation) / (rate * PITCH_SHARE)) + EASE_SECONDS
    total = Math.max(base.seconds, lensSeconds, owed)
    // The budget is set by the pan the leg would be without its way, so a way
    // that winds a whole turn round is not followed round it.
    const shortest = Math.max(Math.abs(wrap(input.to.heading - input.from.heading)) / rate,
      Math.abs(input.to.elevation - input.from.elevation) / (rate * PITCH_SHARE)) + EASE_SECONDS
    const budget = Math.max(base.seconds, lensSeconds, shortest) * COURSE_STRETCH
    for (let attempt = 0; attempt < STRETCH_TRIES && !spline && total <= budget; attempt++) {
      leg = input.timed(total)
      total = leg.seconds
      const count = Math.max(12, Math.ceil(total / GRID_SECONDS)), step = total / count
      const times = new Float64Array(count + 1), heading = new Float64Array(count + 1), elevation = new Float64Array(count + 1)
      // THE TARGET: where the way leads, blended into the straight turn
      // between the two held views wherever the way is not followed.
      let held = input.from.heading
      for (let k = 0; k <= count; k++) {
        times[k] = k * step
        const here = way && share > 0 ? wayAt(gaitAt(leg, times[k]!).metres, read) : null
        const w = here ? here.weight * share : 0, u = smooth(k / count)
        if (here && here.weight > 0) held = here.heading
        heading[k] = (input.from.heading + (toHeading - input.from.heading) * u) * (1 - w) + held * w
        elevation[k] = (input.from.elevation + (input.to.elevation - input.from.elevation) * u) * (1 - w) + (here ? here.elevation : 0) * w
      }
      const headingLed = limit(heading, input.from.heading, toHeading, rate * step, times, total)
      const elevationLed = limit(elevation, input.from.elevation, input.to.elevation, rate * PITCH_SHARE * step, times, total)
      let best = Infinity
      for (const spacing of SPACINGS) {
        const spans = Math.max(3, Math.round(total / spacing))
        const h = fit(headingLed, times, input.from.heading, toHeading, spans, total)
        const e = fit(elevationLed, times, input.from.elevation, input.to.elevation, spans, total)
        const candidate: Spline = { knots: h.knots, heading: h.points, elevation: e.points, total }
        const read = peaks(candidate)
        const ratio = Math.max(read.rate / caps.rate, Math.sqrt(read.accel / caps.accel), Math.cbrt(read.jerk / caps.jerk))
        if (ratio <= 1) { spline = candidate; break }
        best = Math.min(best, ratio)
      }
      if (!spline) total *= Math.max(1.06, Math.min(2, best * 1.03))
    }
    if (spline) { followed = share; break }
  }
  if (!spline) return panPlan(input.from, input.to, Math.max(base.seconds, lensSeconds), input.timed, base)
  const planned = spline
  return {
    leg, stretch: leg.seconds / base.seconds, kind: `way ${followed}`,
    at: (seconds, target) => evaluate(planned, seconds, target),
    lens: seconds => smooth(seconds / planned.total),
    walk: seconds => gaitAt(leg, seconds),
    secondsAt: metres => gaitSecondsAt(leg, metres),
  }
}

/** THE PAN. Between two held views and nothing else, the view turns as a
 * camera operator pans: it eases in on a half cosine, holds its rate, and
 * eases out, the shortest way round. The rate is the least that fits the
 * leg, and the leg is slowed only when even the capped rate does not fit. */
function panPlan(from: GazeAngles, to: GazeAngles, atLeast: number, timed: (seconds: number) => GaitLeg, base: GaitLeg, asGiven = false): CalmGazePlan {
  const turnHeading = asGiven ? to.heading - from.heading : wrap(to.heading - from.heading), turnElevation = to.elevation - from.elevation
  const angle = Math.hypot(turnHeading, turnElevation) / RAD
  const cap = caps.rate * PAN_SHARE
  const least = Math.max(Math.PI * cap / (2 * caps.accel * PAN_SHARE), Math.PI * Math.sqrt(cap / (2 * caps.jerk * PAN_SHARE)))
  let total = Math.max(atLeast, angle > 1e-6 ? angle / cap + least : 0)
  let ease = total / 2, rate = 0
  for (let attempt = 0; attempt < 12; attempt++) {
    // the gentlest ease the leg allows: a whole half cosine if it has time,
    // otherwise the capped rate held between two eases
    ease = angle > 1e-6 ? Math.min(total / 2, Math.max(least, total - angle / cap)) : total / 2
    rate = total > ease ? 1 / (total - ease) : 0
    const peak = rate * angle, accel = Math.PI * peak / (2 * ease), jerk = Math.PI * Math.PI * peak / (2 * ease * ease)
    if (angle <= 1e-6 || (peak <= cap + 1e-9 && accel <= caps.accel * PAN_SHARE + 1e-9 && jerk <= caps.jerk * PAN_SHARE + 1e-9)) break
    total *= 1.05
  }
  const leg = timed(total)
  total = leg.seconds
  if (angle > 1e-6) { ease = Math.min(total / 2, Math.max(least, total - angle / cap)); rate = 1 / (total - ease) }
  const progress = (t: number): number => {
    if (angle <= 1e-6 || t >= total) return 1
    if (t <= 0) return 0
    const ramp = (s: number) => rate * (s / 2 - ease / (2 * Math.PI) * Math.sin(Math.PI * s / ease))
    if (t <= ease) return ramp(t)
    if (t >= total - ease) return 1 - ramp(total - t)
    return rate * (ease / 2 + (t - ease))
  }
  return {
    leg, stretch: leg.seconds / base.seconds, kind: 'pan',
    at(seconds, target) {
      const p = seconds >= total ? 1 : progress(seconds)
      target.heading = p >= 1 ? from.heading + turnHeading : from.heading + turnHeading * p
      target.elevation = p >= 1 ? to.elevation : from.elevation + turnElevation * p
      return target
    },
    lens: seconds => smooth(seconds / total),
    walk: seconds => gaitAt(leg, seconds),
    secondsAt: metres => gaitSecondsAt(leg, metres),
  }
}

/** WHERE A WALK MAY STAND AND TURN. The calm caps turn the view at about ten
 * degrees a second, so a view that faces away from its way would walk it
 * backward for as long as the turn takes, and a turn made in a doorway at a
 * walking pace would sweep the reveals from a hand away. A person turns
 * round before walking on, and in a doorway turns where they stand. */
export interface GazeTurns {
  /** stand at the start and turn to the way when the leaving view faces away from it */
  start: boolean
  /** walk in facing the way, then stand at the arrival and turn to the arriving view */
  end: boolean
  /** distances along the way where it turns in a doorway */
  at: readonly number[]
  /** distances along the way where it passes through a doorway, faced straight */
  doors?: readonly number[]
  /** distances along the way of a doorstep by a station eye that stands
   * against a wall: a walk that leaves facing away draws back to it and turns
   * there, and one that would arrive facing away turns there and backs in */
  porches?: readonly number[]
  /** the rate in degrees a second a turn made standing still may reach */
  quickDegPerSecond?: number
  /** stands turned at the named, quicker rate: at the start, at the end, and at distances along the way */
  named?: { start?: boolean; end?: boolean; at?: readonly number[] }
  /** the rate in degrees a second a named stand may reach */
  namedDegPerSecond?: number
  /** a station walk held to the floor */
  floor?: boolean
  /** where the lens changes: with the body's place, or over its own calm time
   * at the end (a narrowing lens after the turns) or at the start */
  lens?: 'place' | 'last' | 'first'
  /** a leg whose walk the floor cannot hold may stand at either end */
  mayEnds?: boolean
  /** a leg never walked backward, past a pull-back */
  forward?: boolean
  /** a leg whose arriving stand stands close before a wall: it is walked
   * into already turned toward its view, so the wall is not walked at */
  turned?: boolean
  /** stretches of the way on a stair, from end to end, in metres */
  stairs?: readonly (readonly [number, number])[]
}
/** A held view this far off its way is turned from standing; a doorway whose
 * way turns this much is turned in from standing. */
const TURN_AWAY_DEG = 90, DOOR_TURN_DEG = 30
/** The last metre before a stand is read for the way the body arrives on. */
const ARRIVING_M = 1
/** A doorway this near either end of a walk is faced from standing there. */
const DOOR_NEAR_M = 5
/** A first stretch this short may draw back from its view, as a pull-back. */
const PULL_BACK_M = 3
/** A stand turned more than this may go the long way round, when that keeps
 * the whole walk turning one way: the gate reads every turn given back. */
const EITHER_WAY_DEG = 120
/** A stretch between stands walks under one steady view while its way stays
 * this near it (a crab at most, never backward): its bends are the path's,
 * and a view led round each of them swings. Beyond the second figure a view
 * off its way is paid for, and past a right angle dearly. */
const STEADY_WITHIN_DEG = 100, OFF_FREE_DEG = 45, CRAB_DEG = 90
/** The turn given back that a walk may spend before a longer turn is cheaper. */
const GIVEN_BACK_DEG = 20
/** How far off the arriving view a turned arrival's last stretch may look. */
const TURNED_ARRIVAL_DEG = 110
/** The way seen from the view swings when it gives back this much; a walk
 * whose way swings under its view more than twice weaves. */
const SWING_DEG = 10, SWINGS_ALLOWED = 2, GATE_WINDOW_S = .25
/** A turn of the view this small is not read as a swing. */
const YAW_SWING_DEG = 5

/** THE FILM GATE'S HEADING LINES, read on a plan as the gate reads a track:
 * the view's heading reversals over 5 degrees (at most 2) and its travel
 * beyond its net turn (at most 45 degrees), and the swings over 10 degrees of
 * the way seen from the view (at most 3), the way read over a quarter second
 * either side of the body wherever it walks at half a metre a second. */
const GATE_TRIES = 40, GATE_FPS = 30, GATE_HALF = 8
function gateRed(plan: CalmGazePlan, tangent: (from: number, to: number) => number): boolean {
  const T = plan.leg.seconds, n = Math.floor(T * GATE_FPS) + 1, view: GazeAngles = { heading: 0, elevation: 0 }
  const metres: number[] = [], heading: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = Math.min(T, i / GATE_FPS)
    metres.push(plan.walk(t).metres)
    const h = plan.at(t, view).heading
    heading.push(i ? heading[i - 1]! + wrap(h - heading[i - 1]!) : h)
  }
  const way: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - GATE_HALF), b = Math.min(n, i + GATE_HALF)
    if (!(b > a) || (metres[b]! - metres[a]!) * GATE_FPS / (b - a) < .5) continue
    const rel = tangent(metres[a]!, metres[b]!) - heading[i]!
    way.push(way.length ? way[way.length - 1]! + wrap(rel - way[way.length - 1]!) : rel)
  }
  let total = 0
  for (let i = 1; i <= n; i++) total += Math.abs(heading[i]! - heading[i - 1]!)
  const excess = total - Math.abs(heading[n]! - heading[0]!)
  return swingsOf(heading, YAW_SWING_DEG * RAD) > 2 || excess > 45 * RAD || swingsOf(way, SWING_DEG * RAD) > 3
}
/** How often a series turns back by more than `threshold` (a zigzag filter). */
function swingsOf(series: readonly number[], threshold: number): number {
  let dir = 0, ext = series[0] ?? 0, pivots = 1
  for (const v of series) {
    if (dir === 0) { if (Math.abs(v - series[0]!) >= threshold) { dir = Math.sign(v - series[0]!); ext = v } continue }
    if ((v - ext) * dir > 0) { ext = v; continue }
    if ((ext - v) * dir >= threshold) { pivots++; dir = -dir; ext = v }
  }
  return Math.max(0, pivots + (dir !== 0 ? 1 : 0) - 2)
}

type TurnInput = Parameters<typeof planCalmGaze>[0] & { course: (metres: number, until?: number) => GazeCourse; turns: GazeTurns }
interface Piece {
  kind: 'walk' | 'turn'
  from: number; to: number
  plan: CalmGazePlan
  start: number; seconds: number
  /** a walk slowed at an end while it carries a turn: its own time at a clock time, its rate there, the clock at its own time */
  warp?: { tau: (t: number) => number; rate: (t: number) => number; clock: (tau: number) => number }
}
/** THE TURN MADE WHILE WALKING. A stand's turn begins while the body slows
 * into it and ends while it sets off, nowhere near a doorway, as far as the
 * view keeps near its way: at a walker's pace within the first figure, slower
 * within the second, so it never looks back along it. */
const CARRIED_PACE = .5, CARRIED_PACE_OFF_DEG = 30, CARRIED_HELD_DEG = 6, CARRIED_OFF_DEG = 60, CARRIED_DOOR_M = .6
/** While it carries a turn the walk may slow to this share of its own pace,
 * so more of the turn is made walking; it eases back over this much of its
 * own time, and a carry never takes more than this share of the walk. */
const CREEP_LEAST = .25, CREEP_EASE_S = 3, CREEP_SHARE = .4
/** A body slower than this is standing. */
const STILL_MPS = .02
/** What the walk cannot take of a turn is made standing and quick, eased onto
 * the quick rate and off it over at least this long. */
const QUICK_EASE_S = 1
/** The quick turn's own ease: at most this acceleration and jerk, in degrees
 * a second squared and cubed, and at most this many film pixels a frame. */
const QUICK_ACCEL = 15, QUICK_JERK = 55, QUICK_FILM_PIXELS = 13.5
/** A named stand's quick turn eases onto its rate at this acceleration. */
const QUICK_NAMED_ACCEL = 22
/** A lens changed by time eases in and out over this long. */
const LENS_EASE_S = 1.5
/** A distance within this of another is the same place on the way. */
const SAME_M = .05, EDGE_M = .01
/** A view within this of the one it ends or starts on counts as held there,
 * and held this long beyond the share carried, so the walk's own turn has
 * settled before the stand's begins on top of it. */
const HELD_DEG = 1e-4, HELD_MARGIN_S = .5
/** The share of the lens's calm rate a stretch between stands may use. */
const LENS_SHARE = .9
/** How a stretch between two stands looks: it holds the view it leaves on,
 * turns to the way it arrives on as it sets off and holds that, pans from one
 * to the other over its length, follows its way, holds a view part way to
 * where the next stand turns (the stand before it turns only so far), or
 * holds the view straight through a doorway it passes. */
type Mode = 'hold' | 'lead' | 'pan' | 'way' | 'toward' | 'door' | 'arrive'
interface Option { mode: Mode; start: number; turn: number; weave: number; doorOff: number; off: number; slow: number; plan: CalmGazePlan; pulled: boolean; back: number; stairBack: number; crab: number; series: number[] }
interface Stretch { a: number; b: number; out: GazeAngles; in: GazeAngles; options: Option[] }
/** The shares of the next stand's turn a stretch may take on ahead of it. */
const TOWARD_SHARES = [.5, .75, 1]
/** A last stretch with no stand after it may hold a view part way to the one
 * it arrives in, by these shares, and turn the rest in its second part: at
 * least this share of the walk, and no less than half of it for the turn's
 * own least time. */
const ARRIVE_SHARES = [.25, .5, .75], ARRIVE_SHARE = .4, ARRIVE_SHARE_MOST = .5
/** Walking this long against the way is walking backward; a pull-back from
 * the eye is no longer than the second figure. */
const BACKWARD_SECONDS = .3, PULL_BACK_MOST_M = 1.05
/** Under the floor: a view further off its way than the first figure walks
 * aslant and costs the third a second, a held view keeps within the second of
 * all its way, and a stand the walk could do without costs the fourth. */
const ASIDE_DEG = 60, GLANCE_DEG = 85, ASLANT_COST = 3, SPARE_STAND_COST = 15
/** Under the floor a stretch between two stands may hold a view between the
 * way it leaves on and the way it arrives on. */
const BETWEEN_SHARES = [.25, .5, .75]

/** THE ARRIVAL IN THE WALK: the view held, then turned to the one it arrives
 * in over the walk's last part, as a visitor turns to a room on entering it. */
function arrivePlan(from: GazeAngles, to: GazeAngles, timed: (seconds: number) => GaitLeg): CalmGazePlan {
  const standing = (seconds: number) => gaitLeg(0, seconds)
  const least = panPlan(from, to, 0, standing, standing(0), true).leg.seconds
  const leg = timed(least / ARRIVE_SHARE_MOST), T = leg.seconds
  const turning = panPlan(from, to, Math.min(T, Math.max(least, ARRIVE_SHARE * T)), standing, standing(0), true)
  const start = Math.max(0, T - turning.leg.seconds)
  return {
    leg, stretch: 1, kind: 'arrive',
    at: (seconds, target) => {
      if (seconds > start) return turning.at(seconds - start, target)
      target.heading = from.heading; target.elevation = from.elevation; return target
    },
    lens: seconds => smooth(seconds / T),
    walk: seconds => gaitAt(leg, seconds),
    secondsAt: metres => gaitSecondsAt(leg, metres),
  }
}

/** THE LEAD: the view turns to where the stretch arrives as the body sets off,
 * at the pan's own calm rate, and holds it. */
function leadPlan(from: GazeAngles, to: GazeAngles, timed: (seconds: number) => GaitLeg): CalmGazePlan {
  const turning = panPlan(from, to, 0, seconds => gaitLeg(0, seconds), gaitLeg(0, 0), true)
  const leg = timed(turning.leg.seconds), turned = turning.leg.seconds
  return {
    leg, stretch: 1, kind: 'lead',
    at: (seconds, target) => turning.at(Math.min(seconds, turned), target),
    lens: seconds => smooth(seconds / leg.seconds),
    walk: seconds => gaitAt(leg, seconds),
    secondsAt: metres => gaitSecondsAt(leg, metres),
  }
}

/** THE WALK THAT STANDS TO TURN, or null when nothing on it asks for a stand.
 * The way is cut at every stand; each stretch between two is its own calm
 * walk from rest to rest, and each stand its own pan, carried into the walk
 * either side as far as the walk allows. The lens follows the body's place, as
 * the unhurried leg over the whole way would hold it there, so a stand holds
 * the lens where it stands and the walked-lens proof is the plain leg's. */
function planTurns(input: TurnInput): CalmGazePlan | null {
  const L = input.lengthM, course = input.course
  if (!(L > 0)) return null
  const leaving = course(0, Math.min(L, input.turns.at.find(m => m > ARRIVING_M) ?? L))
  const arrivingAt = (b: number, a: number) => course(Math.max(a, b - ARRIVING_M), b)
  const away = (a: number, b: number) => Math.abs(wrap(a - b)) / RAD
  const stops: number[] = []
  const porches = input.turns.porches ?? []
  const outPorch = porches.find(m => m > ARRIVING_M - EDGE_M && m <= PULL_BACK_M)
  if (outPorch !== undefined && input.turns.start && away(leaving.heading, input.from.heading) > TURN_AWAY_DEG) stops.push(outPorch)
  for (const m of input.turns.at) {
    if (!(m > ARRIVING_M - EDGE_M && m < L - ARRIVING_M + EDGE_M) || stops.some(x => Math.abs(x - m) < SAME_M)) continue
    const before = stops.length ? stops[stops.length - 1]! : 0
    const next = input.turns.at.find(x => x > m + ARRIVING_M) ?? L
    if (away(course(m, Math.min(L, next)).heading, arrivingAt(m, before).heading) > DOOR_TURN_DEG) stops.push(m)
  }
  const inPorch = porches.find(m => m >= L - PULL_BACK_M && m < L - ARRIVING_M + EDGE_M && !stops.some(x => Math.abs(x - m) < SAME_M))
  const beforeIn = stops.length ? stops[stops.length - 1]! : 0
  const pushIn = inPorch !== undefined && (input.turns.end || input.turns.floor === true) && inPorch > beforeIn + ARRIVING_M
    && away(input.to.heading, arrivingAt(inPorch, beforeIn).heading) > TURN_AWAY_DEG
  if (pushIn) stops.push(inPorch!)
  const cuts = [0, ...stops, L]
  const doors = input.turns.doors ?? [], stairs = input.turns.stairs ?? []
  const doorNear = (from: number, to: number) => doors.some(d => d >= from && d <= to)
  const leavingOff = away(leaving.heading, input.from.heading), arrivingOff = away(input.to.heading, arrivingAt(L, cuts[cuts.length - 2]!).heading)
  const pullBack = cuts[1]! <= PULL_BACK_M && stops.length > (pushIn ? 1 : 0)
  // a view off its way by more than a right angle is turned from standing; a
  // doorway near an end may be faced from standing, if the walk is calmer so
  const mustStart = !pullBack && (input.turns.start || input.turns.floor === true) && leavingOff > TURN_AWAY_DEG
  const mayStart = !pullBack && (doorNear(0, Math.min(cuts[1]!, DOOR_NEAR_M)) || input.turns.mayEnds === true) && leavingOff > DOOR_TURN_DEG
  const mustEnd = !pushIn && (input.turns.end || input.turns.floor === true) && arrivingOff > TURN_AWAY_DEG
  const mayEnd = !pushIn && (doorNear(Math.max(cuts[cuts.length - 2]!, L - DOOR_NEAR_M), L) || input.turns.mayEnds === true) && arrivingOff > (input.turns.mayEnds === true ? SWING_DEG : DOOR_TURN_DEG)
  if (!mustStart && !mayStart && !mustEnd && !mayEnd && !stops.length) return null
  const lensCaps = capsFor(input.lensPixels)
  // THE LENS BY PLACE, read before the stretches are timed: a stretch walked
  // from rest to rest cruises faster than the unhurried leg passes the same
  // place, so each is slowed until the lens's change keeps under its rate
  const lensSeconds = 1.875 * Math.abs(input.zoom) / CALM_GAZE.zoomPerSecond
  const natural = gaitLeg(L, lensSeconds)
  const lensAt = (metres: number) => smooth(gaitSecondsAt(natural, Math.max(0, Math.min(L, metres))) / natural.seconds)
  const lensFloor = (a: number, b: number): number => {
    const length = b - a
    if (!(Math.abs(input.zoom) > 0) || !(length > 0)) return 0
    let slope = 0
    const step = Math.max(.01, length / 400)
    for (let m = a; m < b; m += step) slope = Math.max(slope, Math.abs(lensAt(Math.min(b, m + step)) - lensAt(m)) / Math.min(step, b - m))
    if (!(slope > 0)) return 0
    const fastest = LENS_SHARE * CALM_GAZE.zoomPerSecond / (Math.abs(input.zoom) * slope)
    let low = gaitLeg(length).seconds
    if (gaitLeg(length, low).cruiseMetresPerSecond <= fastest) return 0
    let high = low * 2
    while (gaitLeg(length, high).cruiseMetresPerSecond > fastest && high < 600) high *= 2
    for (let k = 0; k < 30; k++) { const mid = (low + high) / 2; if (gaitLeg(length, mid).cruiseMetresPerSecond > fastest) low = mid; else high = mid }
    return high
  }
  // THE FLOOR, AND THE LENS BY TIME where the body's place would change the
  // lens faster than its calm rate at the floor's pace
  // a short walk replanned for walking backward is held to the floor too
  const floorOn = input.turns.floor === true && (L >= FLOOR_LEAST_M || input.turns.mayEnds === true)
  const strict = floorOn || (input.turns.floor === true && input.turns.forward === true)
  let lensMode = input.turns.lens ?? 'place'
  if (floorOn && lensMode === 'place' && Math.abs(input.zoom) > 0
    && cuts.slice(0, -1).some((a, i) => lensFloor(a, cuts[i + 1]!) > floorSeconds(cuts[i + 1]! - a) + 1e-6)) lensMode = input.zoom < 0 ? 'last' : 'first'
  // each way of looking at each stretch, walked as the film will read it: the
  // body's own direction over a stride against the view, wherever it
  // walks at a walker's pace, and how far off its way the view passes each
  // doorway
  const stretchesFor = (startTurn: boolean, endTurn: boolean): Stretch[] => cuts.slice(0, -1).map((a, i) => {
    caps = lensCaps
    const b = cuts[i + 1]!, first = i === 0, last = i + 2 === cuts.length
    const pick = (g: GazeAngles): GazeAngles => ({ heading: g.heading, elevation: g.elevation })
    const out = pick(first && !startTurn ? input.from : course(a, b))
    const inn = pick(last && !endTurn ? input.to : arrivingAt(b, a))
    const length = b - a
    let turn = wrap(inn.heading - out.heading)
    // under the floor a walked turn near a half turn goes round the way the way itself turns
    if (input.turns.floor === true && Math.abs(turn) > Math.PI / 2) {
      let net = 0, prev = course(a, b).heading
      for (let m = a + .5; m < b; m += .5) { const h = course(m, Math.min(b, m + .6)).heading; net += wrap(h - prev); prev = h }
      if (Math.abs(net) > Math.PI / 2 && Math.sign(net) !== Math.sign(turn)) turn -= Math.sign(turn) * 2 * Math.PI
    }
    const floor = lensMode === 'place' ? lensFloor(a, b) : 0
    const timed = (seconds: number) => gaitLeg(length, Math.max(seconds, floor))
    const cap = floorOn ? Math.max(floorSeconds(length), floor) : Infinity
    const next = last ? input.to.heading : course(b, cuts[i + 2]!).heading
    const standBefore = !first || startTurn, standAfter = !last || endTurn
    const candidates: { mode: Mode; start: number; plan: CalmGazePlan }[] = []
    const held = (heading: number) => panPlan({ heading, elevation: out.elevation }, { heading, elevation: inn.elevation }, 0, timed, timed(0), true)
    // a pull-back holds the view it leaves, lens and pitch too, and the stand after it turns them
    if (standAfter) candidates.push({ mode: 'hold', start: out.heading, plan: first && pullBack ? panPlan(out, out, 0, timed, timed(0), true) : held(out.heading) })
    candidates.push({ mode: 'lead', start: out.heading, plan: leadPlan(out, { heading: out.heading + turn, elevation: inn.elevation }, timed) })
    candidates.push({ mode: 'pan', start: out.heading, plan: panPlan(out, { heading: out.heading + turn, elevation: inn.elevation }, 0, timed, timed(0), true) })
    caps = lensCaps
    candidates.push({ mode: 'way', start: out.heading, plan: planCalmGaze({ from: out, to: { heading: out.heading + turn, elevation: inn.elevation }, zoom: 0, lengthM: length,
      lensPixels: input.lensPixels, timed, course: (m: number) => course(a + m, b) }) })
    // the way's own run over the stretch, as the gate reads it
    const ways: number[] = []
    if (input.turns.floor === true) for (let m = a + .25; m < b - .05; m += .25) {
      const way = strict && input.tangent ? input.tangent(Math.max(a, m - .6), Math.min(b, m + .6)) : course(m, Math.min(b, m + .6)).heading
      ways.push(out.heading + wrap(way - out.heading))
    }
    if (standBefore && standAfter && input.turns.floor === true) {
      for (const share of BETWEEN_SHARES) {
        const heading = out.heading + share * turn
        candidates.push({ mode: 'hold', start: heading, plan: held(heading) })
      }
      // the heading the way keeps longest, and the one nearest every part of it
      if (ways.length) {
        const mean = Math.atan2(ways.reduce((n, h) => n + Math.sin(h), 0), ways.reduce((n, h) => n + Math.cos(h), 0))
        const low = Math.min(...ways), high = Math.max(...ways)
        for (const heading of [out.heading + wrap(mean - out.heading), (low + high) / 2]) candidates.push({ mode: 'hold', start: heading, plan: held(heading) })
      }
    }
    // the view nearest the next one that keeps within a walker's glance aside of the whole way
    if (standBefore && standAfter && input.turns.floor === true && ways.length) {
      const low = Math.min(...ways), high = Math.max(...ways), glance = GLANCE_DEG * RAD
      if (high - low <= 2 * glance) {
        const want = out.heading + wrap(next - out.heading)
        const heading = Math.max(high - glance, Math.min(low + glance, want))
        candidates.push({ mode: 'toward', start: heading, plan: held(heading) })
      }
    }
    // a stretch through a doorway may hold the view straight through it
    if (standBefore && standAfter) for (const d of doors) if (d > a && d < b) {
      const through = course(Math.max(a, d - .3), Math.min(b, d + .3)).heading
      candidates.push({ mode: 'door', start: out.heading + wrap(through - out.heading), plan: held(out.heading + wrap(through - out.heading)) })
    }
    // with no stand after it, a stretch that holds a view holds the one it arrives in
    if (standBefore) for (const share of standAfter ? TOWARD_SHARES : [1]) {
      const heading = out.heading + share * wrap(next - out.heading)
      candidates.push({ mode: 'toward', start: heading, plan: held(heading) })
    }
    if (standBefore && !standAfter) for (const share of ARRIVE_SHARES) {
      const heading = out.heading + share * wrap(inn.heading - out.heading)
      candidates.push({ mode: 'arrive', start: heading, plan: arrivePlan({ heading, elevation: out.elevation }, { heading: heading + wrap(inn.heading - heading), elevation: inn.elevation }, timed) })
    }
    const options: Option[] = []
    for (const { mode, start, plan } of candidates) {
      const series: number[] = [], view: GazeAngles = { heading: 0, elevation: 0 }
      let steady = true, doorOff = 0, previous = 0, off = 0, walked = 0, back = 0, stairBack = 0, crab = 0
      for (let t = 0; t <= plan.leg.seconds + 1e-9; t += 1 / 15) {
        const w = gaitAt(plan.leg, Math.min(t, plan.leg.seconds)), m = Math.max(a + .05, Math.min(a + w.metres, b - .05))
        const seen = wrap((strict && input.tangent ? input.tangent(Math.max(a, m - .6), Math.min(b, m + .6)) : course(m, Math.min(b, m + .6)).heading) - plan.at(t, view).heading)
        if (Math.abs(seen) > STEADY_WITHIN_DEG * RAD) steady = false
        if (w.metresPerSecond >= .5 && Math.abs(seen) > ASIDE_DEG * RAD) crab += 1 / 15
        if (w.metresPerSecond >= .5 && Math.abs(seen) > CRAB_DEG * RAD) {
          back += 1 / 15
          if (stairs.some(([top, foot]) => a + w.metres > top && a + w.metres < foot)) stairBack += 1 / 15
        }
        for (const d of doors) if (d > a && d <= b && previous < d && a + w.metres >= d) doorOff = Math.max(doorOff, Math.abs(seen) / RAD)
        previous = a + w.metres
        if (w.metresPerSecond < .5) continue
        off += Math.abs(seen) / RAD; walked++
        // the gate reads the way over a quarter second either side of the body
        const half = GATE_WINDOW_S * w.metresPerSecond
        const read = strict && input.tangent ? wrap(input.tangent(Math.max(a, m - half), Math.min(b, m + half)) - plan.at(t, view).heading) : seen
        series.push(series.length ? series[series.length - 1]! + wrap(read - series[series.length - 1]!) : read)
      }
      const landed = plan.at(plan.leg.seconds, view).heading
      // the pull-back from the eye left, or the back-in to the eye arrived at
      const pulled = (mode === 'hold' && first && pullBack) || (mode === 'toward' && last && pushIn)
      // a way that no steady view walks is followed, or panned across
      if (steady || mode === 'way' || mode === 'pan' || pulled)
        options.push({ mode, start, turn: landed - start, weave: swingsOf(series, SWING_DEG * RAD), doorOff, off: pulled || !walked ? 0 : off / walked,
          slow: plan.leg.seconds - timed(0).seconds, plan, pulled, back: pulled ? 0 : back, stairBack, crab: pulled ? 0 : crab, series })
    }
    // a stair is never walked down backward; under the floor a stretch is
    // never slowed for its view, nor walked backward: what it cannot take
    // walking is left to the stands either side of it
    const forward = options.filter(o => o.stairBack < BACKWARD_SECONDS)
    const within = (forward.length ? forward : options).filter(o => o.pulled || (o.plan.leg.seconds <= cap + 1e-6 && (!strict || o.back < BACKWARD_SECONDS)))
    const pool = forward.length ? forward : options
    const kept = within.length ? within : [pool.reduce((x, y) => (y.plan.leg.seconds < x.plan.leg.seconds ? y : x))]
    // walked into turned: the last stretch already looks within a glance of the arriving view
    if (last && endTurn && input.turns.turned === true) {
      const turned = kept.filter(o => Math.abs(wrap(input.to.heading - (o.start + o.turn))) <= TURNED_ARRIVAL_DEG * RAD)
      if (turned.length) return { a, b, out, in: inn, options: turned }
    }
    return { a, b, out, in: inn, options: kept }
  })
  // THE WAY ROUND. Every stand may turn the short way or, near a half turn,
  // the long; every stretch picks how it looks; a doorway near an end may be
  // faced from standing or not. What the film's gate would read red costs
  // most; then the walk turns least, once the turn it gives back, its way
  // swinging under the view and a doorway passed askew are paid for.
  type Choice = { cost: number; stretches: Stretch[]; startTurn: boolean; endTurn: boolean; picks: Option[]; longs: Set<number> }
  let best: Choice | null = null
  const ranked: Choice[] = []
  for (const startTurn of mustStart ? [true] : mayStart ? [true, false] : [false]) for (const endTurn of mustEnd ? [true] : mayEnd ? [true, false] : [false]) {
    if (!startTurn && !endTurn && !stops.length) continue
    const stretches = stretchesFor(startTurn, endTurn)
    const count = stretches.reduce((n, x) => n * x.options.length, 1)
    for (let pickIndex = 0; pickIndex < count; pickIndex++) {
      let rest = pickIndex
      const picks = stretches.map(x => { const o = x.options[rest % x.options.length]!; rest = Math.floor(rest / x.options.length); return o })
      const steps: { turn: number; stand: boolean }[] = []
      let facing = input.from.heading
      const standTo = (heading: number) => { steps.push({ turn: wrap(heading - facing), stand: true }); facing = heading }
      stretches.forEach((x, k) => {
        if (k > 0 || startTurn) standTo(picks[k]!.start)
        steps.push({ turn: picks[k]!.turn, stand: false })
        facing = picks[k]!.start + picks[k]!.turn
      })
      if (endTurn) standTo(input.to.heading)
      const either = steps.map((x, k) => (x.stand && Math.abs(x.turn) / RAD > EITHER_WAY_DEG ? k : -1)).filter(k => k >= 0)
      // under the floor the way's swings are read over the whole leg, across its stands, as the gate reads them
      let weave = picks.reduce((n, o) => n + o.weave, 0)
      if (strict) {
        const whole: number[] = []
        for (const o of picks) for (const v of o.series) whole.push(whole.length ? whole[whole.length - 1]! + wrap(v - whole[whole.length - 1]!) : v)
        weave = swingsOf(whole, SWING_DEG * RAD)
      }
      const askew = picks.reduce((n, o) => n + o.doorOff, 0)
      const aside = picks.reduce((n, o) => n + Math.max(0, o.off - OFF_FREE_DEG) + 10 * Math.max(0, o.off - CRAB_DEG), 0)
      const slow = picks.reduce((n, o) => n + o.slow, 0)
      // under the floor a walk well off its way, and a stand it could do without, cost their seconds
      const aslant = strict ? picks.reduce((n, o) => n + o.crab, 0) : 0
      const spare = strict ? (startTurn && !mustStart ? 1 : 0) + (endTurn && !mustEnd ? 1 : 0) : 0
      for (let lm = 0; lm < 1 << either.length; lm++) {
        const longs = new Set(either.filter((_, j) => lm & (1 << j)))
        let total = 0, net = 0, reversals = 0, sign = 0
        steps.forEach((x, k) => {
          const t = longs.has(k) ? x.turn - Math.sign(x.turn) * 2 * Math.PI : x.turn
          total += Math.abs(t); net += t
          if (Math.abs(t) > YAW_SWING_DEG * RAD) { if (sign && Math.sign(t) !== sign) reversals++; sign = Math.sign(t) }
        })
        const given = (total - Math.abs(net)) / RAD
        const red = given > GIVEN_BACK_DEG * 2 || reversals > 2 || weave > SWINGS_ALLOWED + 1
        const cost = (red ? 1000 : 0) + total / RAD + 2 * Math.max(0, given - GIVEN_BACK_DEG) + 5 * weave + 3 * askew + 2 * aside + 5 * slow + ASLANT_COST * aslant + SPARE_STAND_COST * spare
        const choice = { cost, stretches, startTurn, endTurn, picks, longs }
        if (strict) ranked.push(choice)
        if (!best || cost < best.cost - 1e-6) best = choice
      }
    }
  }
  // THE GATE'S READING DECIDES. The way round that costs least is walked
  // unless the film's gate would read its heading red; then the next that
  // costs least and reads green, if one does.
  const first = build(best!)
  if (!strict || !input.tangent) return first
  if (!gateRed(first, input.tangent)) return { ...first, red: false }
  ranked.sort((x, y) => x.cost - y.cost)
  for (const choice of ranked.slice(0, GATE_TRIES)) {
    if (choice === best) continue
    const plan = build(choice)
    if (!gateRed(plan, input.tangent)) return { ...plan, red: false }
  }
  return { ...first, red: true }

  function build(chosen: Choice): CalmGazePlan {
    const { stretches, startTurn, endTurn } = chosen
    const pieces: Piece[] = []
    let clock = 0, step = 0
    let facing: GazeAngles = { heading: input.from.heading, elevation: input.from.elevation }
    const standing = (seconds: number) => gaitLeg(0, seconds)
    const push = (kind: Piece['kind'], from: number, to: number, plan: CalmGazePlan) => {
      pieces.push({ kind, from, to, plan, start: clock, seconds: plan.leg.seconds })
      clock += plan.leg.seconds
    }
    const land = (plan: CalmGazePlan): GazeAngles => plan.at(plan.leg.seconds, { heading: 0, elevation: 0 })
    const stand = (to: GazeAngles, at: number) => {
      let turn = wrap(to.heading - facing.heading)
      if (chosen.longs.has(step)) turn -= Math.sign(turn) * 2 * Math.PI
      step++
      caps = lensCaps
      const plan = panPlan(facing, { heading: facing.heading + turn, elevation: to.elevation }, 0, standing, standing(0), true)
      push('turn', at, at, plan)
      facing = land(plan)
    }
    const modes: string[] = []
    stretches.forEach((x, k) => {
      const pick = chosen.picks[k]!
      if (k > 0 || startTurn) stand({ heading: pick.start, elevation: x.out.elevation }, x.a)
      // the stretch's own plan, carried onto the heading the view stands at
      const shift = facing.heading - pick.start, own = pick.plan
      const plan: CalmGazePlan = shift === 0 ? own : { ...own, at: (seconds, target) => { own.at(seconds, target); target.heading += shift; return target } }
      modes.push(pick.mode)
      step++
      push('walk', x.a, x.b, plan)
      facing = land(plan)
    })
    if (endTurn) stand(input.to, L)
    // THE TURN CARRIED INTO THE WALK. A stand's turn starts before the body
    // stops and finishes after it sets off, the walk slowed there as far as
    // needed, as long as the walk holds its own view there and the view keeps
    // near its way.
    const doorList = input.turns.doors ?? []
    const angles = (plan: CalmGazePlan, seconds: number): GazeAngles => plan.at(seconds, { heading: 0, elevation: 0 })
    const heldOver = (plan: CalmGazePlan, from: number, to: number, on: GazeAngles) => {
      for (let t = Math.max(0, from); t <= to + 1e-9; t += 1 / 15) {
        const g = angles(plan, t)
        if (Math.abs(g.heading - on.heading) > HELD_DEG * RAD || Math.abs(g.elevation - on.elevation) > HELD_DEG * RAD) return false
      }
      return true
    }
    // the view against the way where the body is, at its speed: within the
    // first figure at a walker's pace, the second slower, anything standing;
    // a slowed walk is moving however slow, so it never creeps off askew. At a
    // walker's pace the view turns no more than CARRIED_HELD_DEG from the one
    // the walk holds: the gate reads a larger turn there as the way swinging.
    const nearWay = (w: Piece, own: number, speed: number, heading: number, held: number, slowed: boolean) => {
      if (speed < STILL_MPS && !slowed) return true
      if (speed >= CARRIED_PACE && Math.abs(heading - held) > CARRIED_HELD_DEG * RAD) return false
      const g = gaitAt(w.plan.leg, own)
      const m = Math.max(w.from + .05, Math.min(w.from + g.metres, w.to - .05))
      const off = Math.abs(wrap(course(m, Math.min(w.to, m + .6)).heading - heading))
      return off <= (speed >= CARRIED_PACE ? CARRIED_PACE_OFF_DEG : CARRIED_OFF_DEG) * RAD
    }
    const clearOfDoors = (w: Piece, near: number, far: number) =>
      !doorList.some(d => d > w.from - 1e-6 && d < w.to + 1e-6 && d > near - CARRIED_DOOR_M && d < far + CARRIED_DOOR_M)
    // a carry of `x` clock seconds at `share` of the walk's pace: its own time
    // runs `share` as fast over the carry, so the carry spans share * x of it;
    // a slowed walk is back to its pace before it reaches a doorway
    const carriedBefore = (w: Piece, turn: Piece, x: number, share: number) => {
      const T = w.plan.leg.seconds, span = share * x
      if (span > CREEP_SHARE * T) return false
      const at = w.from + gaitAt(w.plan.leg, T - span - (share < 1 ? CREEP_EASE_S : 0)).metres, held = angles(w.plan, T)
      if (!clearOfDoors(w, at, w.to) || !heldOver(w.plan, T - span - (share < 1 ? CREEP_EASE_S : 0) - HELD_MARGIN_S, T, held)) return false
      const s0 = angles(turn.plan, 0).heading
      for (let t = 0; t <= x + 1e-9; t += 1 / 15) {
        const own = T - share * (x - t)
        if (!nearWay(w, own, gaitAt(w.plan.leg, own).metresPerSecond * share, angles(turn.plan, t).heading + held.heading - s0, held.heading, share < 1)) return false
      }
      return true
    }
    const carriedAfter = (turn: Piece, w: Piece, y: number, share: number) => {
      const F = turn.plan.leg.seconds, T = w.plan.leg.seconds, span = share * y
      if (span > CREEP_SHARE * T) return false
      const at = w.from + gaitAt(w.plan.leg, span + (share < 1 ? CREEP_EASE_S : 0)).metres, held = angles(w.plan, 0)
      if (!clearOfDoors(w, w.from, at) || !heldOver(w.plan, 0, Math.min(T, span + (share < 1 ? CREEP_EASE_S : 0) + HELD_MARGIN_S), held)) return false
      const e0 = angles(turn.plan, F).heading
      for (let t = 0; t <= y + 1e-9; t += 1 / 15) {
        const own = share * t
        if (!nearWay(w, own, gaitAt(w.plan.leg, own).metresPerSecond * share, angles(turn.plan, F - y + t).heading + held.heading - e0, held.heading, share < 1)) return false
      }
      return true
    }
    // the longest share that holds, found by halving: a shorter share turns the
    // walk's view less, so what holds for a share holds for every shorter one
    const longest = (limit: number, holds: (seconds: number) => boolean) => {
      if (!(limit > 0) || !holds(Math.min(limit, 1 / 15))) return 0
      let low = 0, high = limit
      if (holds(high)) return high
      for (let k = 0; k < 12; k++) { const mid = (low + high) / 2; if (holds(mid)) low = mid; else high = mid }
      return low
    }
    // the brisker pace that still carries it
    const brisk = (holds: (share: number) => boolean) => {
      if (holds(1)) return 1
      let low = CREEP_LEAST, high = 1
      for (let k = 0; k < 10; k++) { const mid = (low + high) / 2; if (holds(mid)) low = mid; else high = mid }
      return low
    }
    const creeps = new Map<Piece, { head?: { seconds: number; share: number }; tail?: { seconds: number; share: number } }>()
    const namedAt = input.turns.named
    const isNamed = (p: Piece) => Boolean(namedAt) && ((p.from <= 1e-6 && namedAt!.start === true) || (p.from >= L - 1e-6 && namedAt!.end === true)
      || (namedAt!.at ?? []).some(m => Math.abs(m - p.from) < SAME_M))
    let namedUsed = false
    // a named stand is held to the film's pixel cap at the lens it turns on:
    // the leaving lens at the start and before a lens changed last, the
    // arriving lens at the end of a lens changed with the body's place
    const namedLensPixels = (p: Piece) => {
      if (!input.fovs) return input.lensPixels
      const [f0, f1] = input.fovs, narrow = Math.min(f0, f1)
      const zoomed = Math.abs(input.zoom) > 1e-9
      const fov = !zoomed ? narrow : lensMode === 'last' ? f0
        : lensMode === 'place' && p.from <= EDGE_M ? f0 : lensMode === 'place' && p.from >= L - EDGE_M ? f1 : narrow
      return input.lensPixels * Math.tan(narrow * RAD / 2) / Math.tan(fov * RAD / 2)
    }
    pieces.forEach((turn, j) => {
      if (turn.kind !== 'turn') return
      const before = pieces[j - 1], after = pieces[j + 1], F = turn.plan.leg.seconds
      // at the walk's own pace, or slowed where that carries more of the turn
      const most = (holds: (seconds: number, share: number) => boolean) => {
        const own = longest(F, s => holds(s, 1)), slowed = longest(F, s => holds(s, CREEP_LEAST))
        return slowed > own ? slowed : own
      }
      // under the floor a stand starts and ends at rest: a turn handed on at a
      // walker's pace joins the walk with a jerk above the walk's own
      let x = before?.kind === 'walk' && !floorOn ? most((s, r) => carriedBefore(before, turn, s, r)) : 0
      let y = after?.kind === 'walk' && !floorOn ? most((s, r) => carriedAfter(turn, after, s, r)) : 0
      if (x + y > F) { const k = F / (x + y); x *= k; y *= k }
      const xs = x > 0 ? brisk(r => carriedBefore(before!, turn, x, r)) : 1
      const ys = y > 0 ? brisk(r => carriedAfter(turn, after!, y, r)) : 1
      // the turn is added to the walk's own view, so the two join without a
      // step even where the walk's view is held only to within HELD_DEG
      const start = angles(turn.plan, 0), end = angles(turn.plan, F), turned: GazeAngles = { heading: 0, elevation: 0 }
      if (x > 0) {
        const own = before!.plan, pan = turn.plan
        creeps.set(before!, { ...creeps.get(before!), tail: { seconds: x, share: xs } })
        const T = own.leg.seconds
        before!.plan = { ...own, at: (seconds, target) => {
          own.at(seconds, target)
          const into = x - (T - seconds) / xs
          if (into < 0) return target
          pan.at(into, turned)
          target.heading += turned.heading - start.heading; target.elevation += turned.elevation - start.elevation
          return target
        } }
      }
      if (y > 0) {
        const own = after!.plan, pan = turn.plan
        creeps.set(after!, { ...creeps.get(after!), head: { seconds: y, share: ys } })
        after!.plan = { ...own, at: (seconds, target) => {
          own.at(seconds, target)
          const into = seconds / ys
          if (into >= y) return target
          pan.at(F - y + into, turned)
          target.heading += turned.heading - end.heading; target.elevation += turned.elevation - end.elevation
          return target
        } }
      }
      // what is left is made standing and quick, on its own eased rate: from
      // the rate the walk hands it up to the quick rate, held, and down to the
      // rate the walk takes it back at
      const pan = turn.plan, D = F - x - y
      const h0 = angles(pan, x), h1 = angles(pan, F - y)
      const A = Math.hypot(h1.heading - h0.heading, h1.elevation - h0.elevation) / RAD
      const named = isNamed(turn)
      if (named) namedUsed = true
      const asked = named ? input.turns.namedDegPerSecond ?? input.turns.quickDegPerSecond : input.turns.quickDegPerSecond
      const quick = asked ? Math.min(asked, QUICK_FILM_PIXELS * CALM_FILM.framesPerSecond / Math.max(1, named ? namedLensPixels(turn) : input.lensPixels) / RAD) : 0
      const accelCap = named ? QUICK_NAMED_ACCEL : QUICK_ACCEL
      const rateAt = (t: number) => {
        const a = angles(pan, Math.max(0, t - 1e-3)), b = angles(pan, Math.min(F, t + 1e-3))
        return Math.hypot(b.heading - a.heading, b.elevation - a.elevation) / RAD / (Math.min(F, t + 1e-3) - Math.max(0, t - 1e-3))
      }
      // the rate and its change where the walk hands the turn over, so the
      // stand joins it without a step in either
      const rIn = x > 0 ? rateAt(x) : 0, rOut = y > 0 ? rateAt(F - y) : 0
      const aIn = x > 0 ? (rateAt(x + .02) - rateAt(Math.max(1e-3, x - .02))) / (x + .02 - Math.max(1e-3, x - .02)) : 0
      const aOut = y > 0 ? (rateAt(Math.min(F - 1e-3, F - y + .02)) - rateAt(F - y - .02)) / (Math.min(F - 1e-3, F - y + .02) - (F - y - .02)) : 0
      const easeFor = (delta: number) => Math.max(QUICK_EASE_S, 1.875 * delta / accelCap, Math.sqrt(5.7735 * delta / QUICK_JERK))
      const ramps = (R: number) => {
        const e1 = easeFor(Math.abs(R - rIn)), e3 = easeFor(Math.abs(R - rOut))
        return { e1, e3, covered: e1 * (rIn + R) / 2 + .05 * aIn * e1 * e1 + e3 * (R + rOut) / 2 - .05 * aOut * e3 * e3 }
      }
      let R = quick
      if (quick > Math.max(rIn, rOut) && A > 1e-6 && ramps(Math.max(rIn, rOut)).covered <= A) {
        if (ramps(R).covered > A) {
          let low = Math.max(rIn, rOut), high = R
          for (let k = 0; k < 40; k++) { const mid = (low + high) / 2; if (ramps(mid).covered > A) high = mid; else low = mid }
          R = low
        }
        const { e1, e3, covered } = ramps(R), C = Math.max(0, (A - covered) / R), T = e1 + C + e3
        // the areas under the smooth step, under u(1-u)^3 (the handed-over
        // change of rate as it dies away) and under u^3(u-1) (as it grows in)
        const area = (u: number) => u * u * u * u * (2.5 + u * (u - 3))
        const fading = (u: number) => u * u * (.5 + u * (-1 + u * (.75 - u / 5)))
        const growing = (u: number) => u * u * u * u * (u / 5 - .25)
        const along = (t: number): number => {
          if (t <= 0) return 0
          if (t < e1) { const u = t / e1; return e1 * (rIn * u + (R - rIn) * area(u) + aIn * e1 * fading(u)) }
          const a1 = e1 * (rIn + R) / 2 + .05 * aIn * e1 * e1
          if (t < e1 + C) return a1 + R * (t - e1)
          const u = Math.min(1, (t - e1 - C) / e3)
          return Math.min(A, a1 + R * C + e3 * (R * u + (rOut - R) * area(u) + aOut * e3 * growing(u)))
        }
        turn.plan = { ...pan, at: (seconds, target) => {
          const share = A > 0 ? along(Math.max(0, Math.min(T, seconds))) / A : 1
          target.heading = h0.heading + (h1.heading - h0.heading) * share
          target.elevation = h0.elevation + (h1.elevation - h0.elevation) * share
          return target
        } }
        turn.seconds = T
      } else {
        turn.plan = { ...pan, at: (seconds, target) => pan.at(x + Math.max(0, Math.min(D, seconds)), target) }
        turn.seconds = D
      }
    })
    // THE SLOWED WALKS. A walk that carries a turn runs its own clock at the
    // carry's share over it and eases back to its own pace beside it; the plans
    // above are written in the walk's own time, read here through the clock.
    const easeUp = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * v * (10 + v * (6 * v - 15)) }
    for (const [w, c] of creeps) {
      const T = w.plan.leg.seconds
      const head = c.head && c.head.share < 1 ? c.head : undefined, tail = c.tail && c.tail.share < 1 ? c.tail : undefined
      if (!head && !tail) continue
      const rate = (own: number) => {
        let r = 1
        if (head) { const a = head.share * head.seconds; r = Math.min(r, own <= a ? head.share : head.share + (1 - head.share) * easeUp((own - a) / CREEP_EASE_S)) }
        if (tail) { const b = T - tail.share * tail.seconds; r = Math.min(r, own >= b ? tail.share : tail.share + (1 - tail.share) * easeUp((b - own) / CREEP_EASE_S)) }
        return r
      }
      const N = Math.max(64, Math.ceil(T * 240)), dt = T / N
      const clocks = new Float64Array(N + 1)
      for (let i = 1; i <= N; i++) clocks[i] = clocks[i - 1]! + dt * (1 / rate((i - 1) * dt) + 1 / rate(i * dt)) / 2
      const tau = (t: number) => {
        if (!(t > 0)) return 0
        if (t >= clocks[N]!) return T
        let lo = 0, hi = N
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (clocks[mid]! <= t) lo = mid; else hi = mid }
        return (lo + (t - clocks[lo]!) / (clocks[hi]! - clocks[lo]!)) * dt
      }
      const clock = (own: number) => {
        const u = Math.max(0, Math.min(N, own / dt)), i = Math.min(N - 1, Math.floor(u))
        return clocks[i]! + (u - i) * (clocks[i + 1]! - clocks[i]!)
      }
      const own = w.plan
      w.warp = { tau, rate: (t: number) => rate(tau(t)), clock }
      w.plan = { ...own, at: (seconds, target) => own.at(tau(seconds), target) }
      w.seconds = clocks[N]!
    }
    clock = 0
    for (const p of pieces) { p.start = clock; clock += p.seconds }
    // THE LENS BY TIME: over the time its calm rate asks, read at the narrow
    // end of the change (the stage blends the lens in degrees), last where it
    // narrows and first where it widens; a leg shorter than that stands on at
    // its end until the lens has come
    let lensTime: { start: number; seconds: number; ease: number; rate: number } | null = null
    if (lensMode !== 'place' && Math.abs(input.zoom) > 1e-9) {
      const [f0, f1] = input.fovs ?? [0, 0]
      const perShare = input.fovs && Math.abs(f1 - f0) > 1e-9 ? Math.abs(f1 - f0) * RAD / Math.sin(Math.min(f0, f1) * RAD) : Math.abs(input.zoom)
      const seconds = Math.max(perShare, Math.abs(input.zoom)) / (CALM_GAZE.zoomPerSecond * PAN_SHARE) + LENS_EASE_S
      // a lens changed last waits for the named stands, which turned on the leaving lens
      const narrowing = input.fovs ? input.fovs[0] > input.fovs[1] : false
      const namedEnd = lensMode === 'last' && narrowing ? pieces.reduce((n, p) => (p.kind === 'turn' && isNamed(p) ? Math.max(n, p.start + p.seconds) : n), 0) : 0
      const begin = lensMode === 'last' ? Math.max(clock - seconds, namedEnd) : 0
      if (begin + seconds > clock + 1e-9) {
        const last = pieces[pieces.length - 1]!, rest = last.plan.at(last.seconds, { heading: 0, elevation: 0 }), hold = begin + seconds - clock
        pieces.push({ kind: 'turn', from: L, to: L, plan: panPlan(rest, rest, hold, standing, standing(0), true), start: clock, seconds: hold })
        clock += hold
      }
      const ease = Math.min(LENS_EASE_S, seconds / 2)
      lensTime = { start: begin, seconds, ease, rate: 1 / (seconds - ease) }
    }
    const total = clock
    // THE LENS BY PLACE: the unhurried leg over the whole way, at least as long
    // as the lens's own change asks, read where the body stands
    const pieceAt = (seconds: number): Piece => {
      let p = pieces[0]!
      for (const q of pieces) if (seconds >= q.start) p = q
      return p
    }
    const walk = (seconds: number) => {
      const t = Math.max(0, Math.min(total, seconds)), p = pieceAt(t)
      if (p.kind === 'turn') return { metres: p.from, metresPerSecond: 0 }
      const w = gaitAt(p.plan.leg, p.warp ? p.warp.tau(t - p.start) : t - p.start)
      return { metres: p.from + w.metres, metresPerSecond: w.metresPerSecond * (p.warp ? p.warp.rate(t - p.start) : 1) }
    }
    const leg: GaitLeg = { ...natural, lengthM: L, seconds: total }
    return {
      leg, stretch: total / input.timed(0).seconds, red: chosen.cost >= 1000,
      kind: `turns ${[startTurn ? 'start' : '', ...stops.map(m => m.toFixed(1)), endTurn ? 'end' : ''].filter(Boolean).join(' ')} (${modes.join(' ')})${namedUsed ? ' named' : ''}${lensTime ? ` lens ${lensMode}` : ''}`,
      at(seconds, target) {
        const t = Math.max(0, Math.min(total, seconds)), p = pieceAt(t)
        return p.plan.at(t - p.start, target)
      },
      lens: seconds => {
        if (!lensTime) return smooth(gaitSecondsAt(natural, walk(seconds).metres) / natural.seconds)
        const { start, seconds: T, ease, rate } = lensTime, t = seconds - start
        if (t <= 0) return 0
        if (t >= T) return 1
        const ramp = (x: number) => rate * (x / 2 - ease / (2 * Math.PI) * Math.sin(Math.PI * x / ease))
        return t <= ease ? ramp(t) : t >= T - ease ? 1 - ramp(T - t) : rate * (ease / 2 + (t - ease))
      },
      walk,
      secondsAt(metres) {
        if (!(metres > 0)) return 0
        if (metres >= L) return total
        for (const p of pieces) if (p.kind === 'walk' && metres <= p.to) {
          const own = gaitSecondsAt(p.plan.leg, metres - p.from)
          return p.start + (p.warp ? p.warp.clock(own) : own)
        }
        return total
      },
    }
  }
}
