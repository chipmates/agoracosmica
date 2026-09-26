// THE FILM GATE'S TWO MOTION LINES, measured: each clip's track against the
// drawn world mounted in node (`near.mjs`), read by `motion.mjs`. The film
// check (`film-check.mjs`) holds a release to them; the motion audit
// (`motion-audit.mjs`) writes the whole table they were set from.
import { FPS, FRAMINGS } from './graph.mjs'
import { MOTION_CAPS, headingReadings, middleOf, nearReadings, viewReadings } from './motion.mjs'
import { NEAR_LIMIT_M, gridOf, mountVisible, nearestAtEye, reachOf, viewNear } from './near.mjs'

/** the eye-height distances a pass is read under, metres */
export const UNDER = [1, 0.75, 0.5]
/** the in-view depths a frame's near share is read under, metres */
export const VIEW_UNDER = [0.5, 0.6, 0.75, 0.9, 1]
/** the ray grid over a frame, by framing: about one ray every five degrees */
export const VIEW_GRID = { wide: [24, 12], upright: [10, 22] }
/** the frames a view is read on: every second one, as the caps were set */
export const VIEW_EVERY = 2
/** how deep a ray is followed along the view axis, metres */
export const VIEW_LIMIT_M = 1.5
const round = (n, p = 3) => (n === null || n === undefined || !Number.isFinite(n) ? n : Math.round(n * 10 ** p) / 10 ** p)

/** ONE CLIP'S READINGS from its track (frame 0 the departure still, the last the arrival) and the mounted world */
export function measureClip(grid, samples, framing, { every = VIEW_EVERY, caps = MOTION_CAPS } = {}) {
  const f = FRAMINGS[framing]
  const aspect = f.width / f.height
  const [cols, rows] = VIEW_GRID[framing]
  const mid = middleOf(samples, FPS, caps.endsM)
  const distances = new Float64Array(samples.length), labels = []
  for (let i = 0; i < samples.length; i++) {
    const hit = nearestAtEye(grid, samples[i])
    distances[i] = hit.distance
    labels.push(hit.label)
  }
  const heading = headingReadings(samples, FPS, caps)
  const near = nearReadings(distances, mid, FPS, { under: UNDER })
  near.minWhat = labels[Math.round(near.minAt * FPS)] ?? null
  const view = []
  for (let i = 0; i < samples.length; i += every) {
    const v = viewNear(grid, samples[i], aspect, { cols, rows, limit: VIEW_LIMIT_M, under: [...new Set([...VIEW_UNDER, caps.nearM])] })
    view.push({ i, min: v.min, at: v.at, label: v.label, centre: v.centre, share: v.share })
  }
  const inView = viewReadings(view, mid, FPS, { every, nearM: caps.nearM, nearShare: caps.nearShare })
  // how much of the walk looks at a surface nearer than 1.5 m at the frame's centre
  const walking = view.filter((v) => mid[v.i])
  inView.stareShare = walking.length ? walking.filter((v) => v.centre < 1.5).length / walking.length : 0
  inView.nearShareMax = Object.fromEntries(VIEW_UNDER.map((d) => [d, Math.max(0, ...walking.map((v) => v.share[d]))]))
  return { heading, near, view: inView, mid, distances: Array.from(distances, (d) => round(d, 3)), labels,
    frames: view.map((v) => [v.i, round(v.min, 3), ...VIEW_UNDER.map((d) => round(v.share[d], 3)), round(v.centre, 2)]) }
}

/** the drawn world mounted where a set of tracks can reach, and its grid */
export async function worldFor(tracks, { rev = '', overlay = {} } = {}) {
  const reach = reachOf(tracks.flatMap((s) => s), NEAR_LIMIT_M + 1)
  const world = await mountVisible({ rev, overlay, keep: reach.keep })
  return { world, grid: gridOf(world) }
}

/**
 * EVERY CLIP OF A TREE MEASURED, for the film check: a map from
 * `<clip> <framing>` to its readings (heading and view), and the caps.
 */
export async function motionOfTree(tree, { rev = '', overlay = {}, caps = MOTION_CAPS, grid = null, log = () => {} } = {}) {
  const t0 = Date.now()
  // a clip runs from the departure still (frame 0) to the arrival: the tail after it is the next still
  const clips = [...tree.clips.values()].map((c) => ({ ...c, samples: c.samples.slice(0, c.frames + 1) }))
  // a grid already mounted for the same tree may be handed in
  if (!grid) {
    grid = (await worldFor(clips.map((c) => c.samples), { rev, overlay })).grid
    log(`the drawn world for the motion lines: ${grid.world.count} triangles near the tracks, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  }
  const readings = new Map()
  for (const c of clips) {
    const r = measureClip(grid, c.samples, c.framing, { caps })
    readings.set(`${c.clip} ${c.framing}`, { heading: r.heading, view: r.view })
  }
  log(`${readings.size} clips measured for the motion lines, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { caps, readings }
}
