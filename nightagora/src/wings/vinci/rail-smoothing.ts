import { Vector3 } from 'three/webgpu'

/** Bounded, monotone visitor-look response. No spring or overshoot. */
export function createRailLookSmoother(
  clock: () => number,
  reducedMotion: () => boolean,
  responseSeconds = .1,
) {
  if (!(responseSeconds > 0 && Number.isFinite(responseSeconds))) throw new Error('Invalid look response')
  const value = { yaw: 0, pitch: 0 }
  let targetYaw = 0, targetPitch = 0, previous = clock()
  const clampYaw = (v: number) => Math.max(-.6, Math.min(.6, v))
  const clampPitch = (v: number) => Math.max(-.32, Math.min(.32, v))
  function sample(now = clock()): Readonly<typeof value> {
    const dt = Math.max(0, now - previous)
    previous = now
    const fraction = reducedMotion() ? 1 : -Math.expm1(-dt / responseSeconds)
    // A convex combination cannot overshoot either target, including after reversal.
    value.yaw += (targetYaw - value.yaw) * fraction
    value.pitch += (targetPitch - value.pitch) * fraction
    return value
  }
  function snap(yaw = 0, pitch = 0) {
    value.yaw = targetYaw = clampYaw(yaw)
    value.pitch = targetPitch = clampPitch(pitch)
    previous = clock()
  }
  return {
    sample,
    snap,
    recenter() {
      sample()
      targetYaw = targetPitch = 0
      if (reducedMotion()) snap()
    },
    dragRadians(deltaYaw: number, deltaPitch: number) {
      // Integrate the old target up to the event before accepting its new target.
      // This avoids applying a new event retroactively over the previous frame.
      sample()
      targetYaw = clampYaw(targetYaw + deltaYaw)
      targetPitch = clampPitch(targetPitch + deltaPitch)
      if (reducedMotion()) snap(targetYaw, targetPitch)
    },
  }
}

/** Return true only when the COMPLETE closed ball clears actual collision geometry.
 * Include the gate lining, leaf, soffit, court risers, terrain and other solid props.
 * The caller owns an outside starting point, numerical tolerances and source hashes.
 * A sampled centreline, capped 0.25 m result, or visual inspection is not this proof.
 */
export type RailBallCertificate = (centre: Readonly<Vector3>, radiusM: number) => boolean

export interface RailCornerOptions {
  certifyBall: RailBallCertificate
  /** Cover the actual camera near rectangle, or explicitly declare a centre-only audit. */
  clearanceRadiusM: number
  /** Exhibition choice; maximum trim of each incoming/outgoing leg, in metres. */
  maxTrimM?: number
  minTrimM?: number
  numericalMarginM?: number
  certificateDepth?: number
}

export interface RailCornerReading {
  index: number
  requestedTrimM: number
  acceptedTrimM: number
  certificateCalls: number
  result: 'straight' | 'certified' | 'uncertified' | 'reversal'
}

type LineSpan = { kind: 'line'; a: Vector3; b: Vector3; length: number }
type CurveSpan = {
  kind: 'curve'; a: Vector3; control: Vector3; b: Vector3; length: number
  lengthAt: (u: number) => number
  speedAt: (u: number) => number
}
type Span = LineSpan | CurveSpan

/** Enclosing radius for every orientation of a perspective camera's near rectangle. */
export function railNearRectangleRadius(nearM: number, verticalFovDegrees: number, aspect: number) {
  const height = nearM * Math.tan(verticalFovDegrees * Math.PI / 360)
  return Math.hypot(nearM, height, height * aspect)
}

function curveSpan(a: Vector3, control: Vector3, b: Vector3): CurveSpan {
  const v = control.clone().sub(a).multiplyScalar(2)
  const w = a.clone().add(b).addScaledVector(control, -2).multiplyScalar(2)
  const wLength = w.length(), projection = v.dot(w) / wLength
  const perpendicularSquared = Math.max(0, v.lengthSq() - projection * projection)
  const perpendicular = Math.sqrt(perpendicularSquared)
  const integral = (x: number) => perpendicular > 1e-12
    ? .5 * (x * Math.hypot(x, perpendicular) + perpendicularSquared * Math.asinh(x / perpendicular))
    : .5 * x * Math.abs(x)
  const initial = integral(projection)
  const lengthAt = (u: number) => (integral(projection + wLength * u) - initial) / wLength
  const speedAt = (u: number) => Math.hypot(projection + wLength * u, perpendicular)
  return { kind: 'curve', a, control, b, length: lengthAt(1), lengthAt, speedAt }
}

function sampleSpan(span: Span, distance: number, target: Vector3) {
  if (span.kind === 'line') return target.lerpVectors(span.a, span.b, distance / span.length)
  // Invert the analytic quadratic arc length, with a safeguarded Newton step.
  // Arc-length traversal makes the line/curve joins C1 at a common travel speed.
  let lower = 0, upper = 1, u = Math.max(0, Math.min(1, distance / span.length))
  for (let i = 0; i < 30; i++) {
    const error = span.lengthAt(u) - distance
    if (Math.abs(error) < 1e-11) break
    if (error > 0) upper = u; else lower = u
    const next = u - error / span.speedAt(u)
    u = next > lower && next < upper ? next : (lower + upper) / 2
  }
  const one = 1 - u
  return target.copy(span.a).multiplyScalar(one * one)
    .addScaledVector(span.control, 2 * one * u).addScaledVector(span.b, u * u)
}

/** Round only independently certified corners. Rejected corners retain the old polyline.
 * A quadratic stays in its control hull. A ball enclosing that hull, enlarged by
 * camera radius and a numerical margin, certifies the whole curve, not samples.
 * Subdivision tightens that conservative proof without altering the curve itself.
 * This does not certify the unchanged straight legs; their existing proof must
 * cover complete edges, their exact waypoints, and the same clearance radius.
 */
export function createCertifiedRailPath(input: readonly Vector3[], options: RailCornerOptions) {
  const points = input.map(point => point.clone()).filter((point, index, all) =>
    index === 0 || point.distanceToSquared(all[index - 1]!) > 1e-18)
  if (points.length < 2) throw new Error('A rail path needs two distinct points')
  const maxTrim = options.maxTrimM ?? .5, minTrim = options.minTrimM ?? .01
  const margin = options.numericalMarginM ?? .00001
  const depth = options.certificateDepth ?? 6
  if (!(options.clearanceRadiusM > 0 && Number.isFinite(options.clearanceRadiusM)
    && maxTrim > 0 && Number.isFinite(maxTrim) && minTrim > 0 && minTrim <= maxTrim
    && margin > 0 && Number.isFinite(margin) && Number.isInteger(depth) && depth >= 0 && depth <= 10)) {
    throw new Error('Invalid rail corner certificate options')
  }
  const curves = new Map<number, CurveSpan>(), corners: RailCornerReading[] = []
  for (let i = 1; i < points.length - 1; i++) {
    const vertex = points[i]!, incoming = vertex.clone().sub(points[i - 1]!)
    const outgoing = points[i + 1]!.clone().sub(vertex)
    const incomingLength = incoming.length(), outgoingLength = outgoing.length()
    incoming.divideScalar(incomingLength); outgoing.divideScalar(outgoingLength)
    const cosine = incoming.dot(outgoing)
    // At most 24% at either end leaves a positive unchanged line between fillets.
    const requested = Math.min(maxTrim, .24 * incomingLength, .24 * outgoingLength)
    const reading: RailCornerReading = {
      index: i, requestedTrimM: requested, acceptedTrimM: 0,
      certificateCalls: 0, result: cosine > 1 - 1e-8 ? 'straight' : cosine < -.95 ? 'reversal' : 'uncertified',
    }
    corners.push(reading)
    if (reading.result !== 'uncertified') continue
    function certify(a: Vector3, control: Vector3, b: Vector3, remaining: number): boolean {
      const centre = a.clone().add(control).add(b).multiplyScalar(1 / 3)
      const hullRadius = Math.max(centre.distanceTo(a), centre.distanceTo(control), centre.distanceTo(b))
      reading.certificateCalls++
      if (options.certifyBall(centre, hullRadius + options.clearanceRadiusM + margin)) return true
      if (remaining === 0) return false
      const left = a.clone().lerp(control, .5), right = control.clone().lerp(b, .5)
      const middle = left.clone().lerp(right, .5)
      return certify(a, left, middle, remaining - 1) && certify(middle, right, b, remaining - 1)
    }
    for (let trim = requested; trim >= minTrim; trim /= 2) {
      const a = vertex.clone().addScaledVector(incoming, -trim)
      const b = vertex.clone().addScaledVector(outgoing, trim)
      if (!certify(a, vertex, b, depth)) continue
      curves.set(i, curveSpan(a, vertex.clone(), b))
      reading.acceptedTrimM = trim; reading.result = 'certified'
      break
    }
  }
  const spans: Span[] = []
  let cursor = points[0]!
  function line(to: Vector3) {
    const length = cursor.distanceTo(to)
    if (length > 1e-12) spans.push({ kind: 'line', a: cursor, b: to, length })
    cursor = to
  }
  for (let i = 1; i < points.length - 1; i++) {
    const curve = curves.get(i)
    if (curve) { line(curve.a); spans.push(curve); cursor = curve.b }
    else line(points[i]!)
  }
  line(points.at(-1)!)
  const length = spans.reduce((sum, span) => sum + span.length, 0)
  return {
    length,
    corners: corners as readonly RailCornerReading[],
    pointAtDistance(distance: number, target: Vector3) {
      if (distance <= 0) return target.copy(points[0]!)
      if (distance >= length) return target.copy(points.at(-1)!)
      let remaining = distance
      for (const span of spans) {
        if (remaining <= span.length) return sampleSpan(span, remaining, target)
        remaining -= span.length
      }
      return target.copy(points.at(-1)!)
    },
  }
}
