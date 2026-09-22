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
import { gaitAt, type GaitLeg } from './gait'

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
}

export function planCalmGaze(input: {
  from: GazeAngles; to: GazeAngles
  /** the change of the lens, as the log of the picture's scale */
  zoom: number
  /** the leg timed to at least a number of seconds */
  timed: (atLeastSeconds: number) => GaitLeg
  /** where the way leads from a body position, or null where the leg is a
   * step between two held views and nothing but those two is looked at */
  course: ((metres: number) => GazeCourse) | null
  lengthM: number
  /** the film's focal length in its own pixels at the narrower of the two
   * lenses, which is what turns degrees into picture motion */
  lensPixels: number
}): CalmGazePlan {
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
  }
}

/** THE PAN. Between two held views and nothing else, the view turns as a
 * camera operator pans: it eases in on a half cosine, holds its rate, and
 * eases out, the shortest way round. The rate is the least that fits the
 * leg, and the leg is slowed only when even the capped rate does not fit. */
function panPlan(from: GazeAngles, to: GazeAngles, atLeast: number, timed: (seconds: number) => GaitLeg, base: GaitLeg): CalmGazePlan {
  const turnHeading = wrap(to.heading - from.heading), turnElevation = to.elevation - from.elevation
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
  }
}
