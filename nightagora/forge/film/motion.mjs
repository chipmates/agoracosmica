// HOW A WALK FEELS, from its camera track alone: where the eye looks as it
// goes (the heading's swings, the pitch's), which way it walks against the way
// it looks, how its speed changes, and how near it passes what is drawn. The
// calm caps (M46) bound how FAST the view turns; a walk can stay under every
// one of them and still weave toward a wall and away past every painting, or
// brush a door jamb. These readings name that, and the gate's two lines hold it.
//
// A sample is the replay's: [x, y, z, qx, qy, qz, qw, fov], one a frame.

const DEG = 180 / Math.PI

/** THE GATE'S NUMBERS, set from the whole film's table (`motion-audit.mjs`):
    the two legs first seen as wrong on watching the film stand beyond them,
    and the calm walks of the rest inside. */
export const MOTION_CAPS = {
  /** a swing of the view's heading is a reversal once it gives back this much */
  reversalDeg: 5,
  /** the view's heading reversals a walk may make */
  yawReversals: 2,
  /** the view's heading travelled beyond its net turn, in degrees */
  yawExcessDeg: 45,
  /** a swing of the way the eye walks, seen from the view, is a reversal once it gives back this much */
  walkReversalDeg: 10,
  /** the reversals of the way the eye walks against the way it looks */
  walkReversals: 3,
  /** in view: a surface nearer than this along the view axis... */
  nearM: 0.75,
  /** ...over at least this share of the frame... */
  nearShare: 0.05,
  /** ...for longer than this while walking, away from the rest poses */
  nearSeconds: 0.25,
  /** the metres of a leg at each end that belong to its rest poses */
  endsM: 1,
}

/** where a quaternion looks: heading (0 north, positive west, as the rail reads it) and elevation, radians */
export function headingOf(x, y, z, w) {
  const fx = -2 * (w * y + x * z), fy = 2 * (w * x - y * z), fz = -1 + 2 * (x * x + y * y)
  return { heading: Math.atan2(-fx, -fz), elevation: Math.asin(Math.max(-1, Math.min(1, fy))), fx, fz }
}

/** an angle series without its jumps across the half turn */
export function unwrap(series) {
  const out = new Float64Array(series.length)
  let shift = 0
  for (let i = 0; i < series.length; i++) {
    if (i) {
      const d = series[i] + shift - out[i - 1]
      if (d > Math.PI) shift -= 2 * Math.PI
      else if (d < -Math.PI) shift += 2 * Math.PI
    }
    out[i] = series[i] + shift
  }
  return out
}

/**
 * THE SWINGS OF A SERIES: its turning points, each counted once the series has
 * given back `threshold` from the extreme it reached (a zigzag filter). A walk
 * that turns once one way has no reversal; one that looks left, right and left
 * again has two.
 */
export function swings(series, threshold) {
  if (!series.length) return { reversals: 0, pivots: [] }
  const pivots = [{ i: 0, v: series[0] }]
  let dir = 0, ext = series[0], extAt = 0
  for (let i = 1; i < series.length; i++) {
    const v = series[i]
    // the first move of a threshold's size sets the direction; a smaller one before it is noise
    if (dir === 0) { if (Math.abs(v - series[0]) >= threshold) { dir = Math.sign(v - series[0]); ext = v; extAt = i } continue }
    if ((v - ext) * dir > 0) { ext = v; extAt = i; continue }
    if ((ext - v) * dir >= threshold) { pivots.push({ i: extAt, v: ext }); dir = -dir; ext = v; extAt = i }
  }
  if (dir !== 0) pivots.push({ i: extAt, v: ext })
  return { reversals: Math.max(0, pivots.length - 2), pivots }
}

/** a series' travel, its net change, and its swings, in its own unit */
function travel(series, threshold) {
  let total = 0, lo = Infinity, hi = -Infinity
  for (let i = 0; i < series.length; i++) {
    if (i) total += Math.abs(series[i] - series[i - 1])
    lo = Math.min(lo, series[i]); hi = Math.max(hi, series[i])
  }
  const net = series.length ? Math.abs(series[series.length - 1] - series[0]) : 0
  const sw = swings(series, threshold)
  return { reversals: sw.reversals, pivots: sw.pivots, total, net, excess: total - net, range: series.length ? hi - lo : 0 }
}

/** the eye's ground velocity over a stride's window (the gait's sway is not a change of way), and its path length */
export function groundMotion(samples, fps = 30) {
  const n = samples.length
  const half = Math.max(1, Math.round(fps * 0.25))
  const vx = new Float64Array(n), vz = new Float64Array(n), speed = new Float64Array(n), arc = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - half)], b = samples[Math.min(n - 1, i + half)]
    const dt = (Math.min(n - 1, i + half) - Math.max(0, i - half)) / fps
    if (dt > 0) { vx[i] = (b[0] - a[0]) / dt; vz[i] = (b[2] - a[2]) / dt }
    if (i) arc[i] = arc[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][2] - samples[i - 1][2])
  }
  // the pace along the path, not along the chord: a corner is not a slowing
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half), b = Math.min(n - 1, i + half)
    speed[i] = b > a ? (arc[b] - arc[a]) / ((b - a) / fps) : 0
  }
  return { vx, vz, speed, arc, length: n ? arc[n - 1] : 0 }
}

/** THE WALK'S MIDDLE: frames that move, further than `endsM` of path from both rest poses */
export function middleOf(samples, fps = 30, endsM = MOTION_CAPS.endsM) {
  const { arc, length } = groundMotion(samples, fps)
  const mid = new Uint8Array(samples.length)
  for (let i = 1; i < samples.length; i++) {
    const moved = Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][2] - samples[i - 1][2]) * fps > 0.05
    mid[i] = moved && arc[i] >= endsM && length - arc[i] >= endsM ? 1 : 0
  }
  return mid
}

/** the frames flagged in a mask, as the longest run and the total, in seconds */
export function runsOf(mask, fps = 30) {
  let run = 0, longest = 0, total = 0, start = 0, longestAt = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) { if (!run) start = i; run++; total++; if (run > longest) { longest = run; longestAt = start } } else run = 0
  }
  return { seconds: total / fps, longestSeconds: longest / fps, longestAt: longestAt / fps }
}

/**
 * THE VIEW, THE WAY IT WALKS, THE FACING AND THE PACE of a walk.
 *   samples   the replay's frames, frame 0 the departure still
 */
export function headingReadings(samples, fps = 30, caps = MOTION_CAPS) {
  const n = samples.length
  const heading = [], elevation = [], fwd = []
  for (const s of samples) { const h = headingOf(s[3], s[4], s[5], s[6]); heading.push(h.heading); elevation.push(h.elevation); fwd.push([h.fx, h.fz]) }
  const yaw = unwrap(heading)
  const read = (series) => {
    let rate = 0, rateAt = 0
    for (let i = 1; i < series.length; i++) { const r = Math.abs(series[i] - series[i - 1]) * fps; if (r > rate) { rate = r; rateAt = i } }
    const t = travel(Array.from(series, (v) => v * DEG), caps.reversalDeg)
    return { reversals: t.reversals, pivots: t.pivots.map((p) => ({ s: p.i / fps, deg: p.v })), rateDegPerSecond: rate * DEG, rateAt: rateAt / fps,
      totalDeg: t.total, netDeg: t.net, excessDeg: t.excess, rangeDeg: t.range }
  }
  const g = groundMotion(samples, fps)
  // THE WAY IT WALKS, where the eye walks at a walker's pace: its compass course, and that course seen from the view
  const course = [], relative = [], at = []
  for (let i = 0; i < n; i++) {
    if (Math.hypot(g.vx[i], g.vz[i]) < 0.5) continue
    const c = Math.atan2(-g.vx[i], -g.vz[i])
    course.push(c); relative.push(c - heading[i]); at.push(i)
  }
  const c = travel(Array.from(unwrap(course), (v) => v * DEG), caps.walkReversalDeg)
  const r = travel(Array.from(unwrap(relative), (v) => v * DEG), caps.walkReversalDeg)
  const way = {
    course: { reversals: c.reversals, totalDeg: c.total, netDeg: c.net, excessDeg: c.excess },
    inView: { reversals: r.reversals, totalDeg: r.total, netDeg: r.net, excessDeg: r.excess, rangeDeg: r.range, pivots: r.pivots.map((p) => ({ s: at[p.i] / fps, deg: p.v })) },
  }
  // THE FACING against the way the eye moves
  const back = new Uint8Array(n)
  let sideways = 0, moving = 0, worst = 0, worstAt = 0
  for (let i = 1; i < n; i++) {
    const v = Math.hypot(g.vx[i], g.vz[i])
    if (v < 0.25) continue
    moving++
    const [fx, fz] = fwd[i]
    const f = Math.hypot(fx, fz)
    if (f < 1e-6) continue
    const angle = Math.acos(Math.max(-1, Math.min(1, (g.vx[i] * fx + g.vz[i] * fz) / (v * f)))) * DEG
    if (angle > worst) { worst = angle; worstAt = i }
    if (angle > 90) back[i] = 1
    else if (angle > 60) sideways++
  }
  const backRuns = runsOf(back, fps)
  // THE PACE: its top, its steepest change, and its surges (a slowing and a speeding again by a tenth of the top)
  let accel = 0, accelAt = 0, peak = 0
  for (let i = 1; i < n; i++) {
    const a = Math.abs(g.speed[i] - g.speed[i - 1]) * fps
    if (a > accel) { accel = a; accelAt = i }
    peak = Math.max(peak, g.speed[i])
  }
  const surges = swings(Array.from(g.speed), Math.max(0.05, 0.1 * peak)).reversals
  return {
    frames: n, seconds: (n - 1) / fps, metres: g.length,
    yaw: read(yaw), pitch: read(Float64Array.from(elevation)), way,
    facing: { movingSeconds: moving / fps, backwardSeconds: backRuns.seconds, backwardLongestSeconds: backRuns.longestSeconds, backwardAt: backRuns.longestAt, sidewaysSeconds: sideways / fps, worstDeg: worst, worstAt: worstAt / fps },
    pace: { topMetresPerSecond: peak, accelMetresPerSecond2: accel, accelAt: accelAt / fps, surges },
  }
}

/**
 * HOW NEAR THE EYE PASSES what is drawn at its height: per frame distances
 * (metres), frame 0 the departure still. `mid` marks the walk's middle
 * (middleOf): the runs are read there, away from the stops' own poses.
 */
export function nearReadings(distances, mid, fps = 30, { under = [1, 0.5] } = {}) {
  let min = Infinity, minAt = 0
  for (let i = 1; i < distances.length; i++) if (mid[i] && distances[i] < min) { min = distances[i]; minAt = i }
  const runs = {}
  for (const d of under) runs[d] = runsOf(Array.from(distances, (v, i) => (mid[i] && v < d ? 1 : 0)), fps)
  return { minM: Number.isFinite(min) ? min : null, minAt: minAt / fps, restFirstM: distances[0], restLastM: distances[distances.length - 1], under: runs }
}

/**
 * WHAT THE FRAME HOLDS NEAR THE LENS over the walk's middle: `view` holds a
 * reading every `every` frames ({ i, min, share }), `mid` the walk's middle.
 */
export function viewReadings(view, mid, fps = 30, { every = 1, nearM = MOTION_CAPS.nearM, nearShare = MOTION_CAPS.nearShare } = {}) {
  let min = Infinity, minAt = 0, minWhat = null, minWhere = null
  const hit = new Uint8Array(mid.length)
  for (const v of view) {
    if (!mid[v.i]) continue
    if (v.min < min) { min = v.min; minAt = v.i; minWhat = v.label; minWhere = v.at }
    if ((v.share[nearM] ?? 0) >= nearShare) for (let k = v.i; k < Math.min(mid.length, v.i + every); k++) hit[k] = 1
  }
  const run = runsOf(hit, fps)
  return { minM: Number.isFinite(min) ? min : null, minAt: minAt / fps, minWhat, minWhere, near: run }
}

/**
 * THE GATE'S TWO LINES on one clip's readings: red when a drawn surface stands
 * near the lens over part of the frame for longer than the cap while walking,
 * or when the view swings, or the way the eye walks swings under it.
 */
export function motionVerdict({ heading, view }, caps = MOTION_CAPS) {
  const out = { near: null, heading: null }
  if (view) {
    const r = view.near
    if (r.longestSeconds > caps.nearSeconds) out.near = `${r.longestSeconds.toFixed(2)} s with ${caps.nearShare * 100}% or more of the frame nearer than ${caps.nearM} m (from ${r.longestAt.toFixed(2)} s; nearest ${view.minM?.toFixed(2)} m, ${view.minWhat ?? '?'}), the cap ${caps.nearSeconds} s`
  }
  if (heading) {
    const y = heading.yaw, w = heading.way.inView, why = []
    if (y.reversals > caps.yawReversals) why.push(`${y.reversals} view heading reversals over ${caps.reversalDeg} degrees, the cap ${caps.yawReversals}`)
    if (y.excessDeg > caps.yawExcessDeg) why.push(`the view's heading travels ${y.totalDeg.toFixed(0)} degrees for a net turn of ${y.netDeg.toFixed(0)}, the cap ${caps.yawExcessDeg} beyond it`)
    if (w.reversals > caps.walkReversals) why.push(`the way the eye walks swings ${w.reversals} times in the view (over ${caps.walkReversalDeg} degrees, the cap ${caps.walkReversals}): it weaves ${w.totalDeg.toFixed(0)} degrees for a net ${w.netDeg.toFixed(0)}`)
    if (why.length) out.heading = why.join('; ')
  }
  return out
}
